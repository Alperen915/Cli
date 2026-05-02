// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AgentToken
 * @notice ERC-20 token that represents an AI agent on Arbitrum.
 *
 * Inspired by:
 *   - Virtuals Protocol  — agent token with revenue sharing
 *   - ai16z / ElizaOS    — autonomous agent governance token
 *   - Botto              — governance-led AI agent token
 *
 * Features:
 *   1. Standard ERC-20 (transfer, approve, transferFrom)
 *   2. On-chain agent metadata (name, type, description)
 *   3. Revenue sharing (EIP-2222 style dividend tracking)
 *      - Owner deposits ETH via depositRevenue()
 *      - Holders claim their proportional share via claimRevenue()
 *   4. Governance weight (balanceOf = voting power)
 *   5. Ownership transfer
 */
contract AgentToken {

    // ── ERC-20 ────────────────────────────────────────────────────────────────

    string  public name;
    string  public symbol;
    uint8   public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ── Agent Metadata ────────────────────────────────────────────────────────

    address public owner;
    string  public agentName;
    string  public agentType;
    string  public description;
    string  public agentNetwork;
    uint256 public createdAt;
    uint256 public version;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ── Revenue Sharing (EIP-2222 Dividend Tracking) ──────────────────────────
    //
    // Algorithm:
    //   dividendPerToken accumulates: += depositAmount * PRECISION / totalSupply
    //   Each holder has a credit snapshot (dividendCredit[addr])
    //   Claimable = balance * (dividendPerToken - credit) / PRECISION
    //
    // This allows O(1) deposit and O(1) claim regardless of holder count.

    uint256 private constant PRECISION      = 1e18;
    uint256 public dividendPerToken;
    mapping(address => uint256) public dividendCredit;
    mapping(address => uint256) public claimable;
    uint256 public totalRevenue;
    uint256 public totalUnclaimed;

    event RevenueDeposited(address indexed depositor, uint256 amount, uint256 newDividendPerToken);
    event RevenueClaimed(address indexed holder, uint256 amount);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(
        string memory _name,
        string memory _symbol,
        uint256       _totalSupply,
        string memory _agentName,
        string memory _agentType,
        string memory _description,
        string memory _agentNetwork
    ) {
        name         = _name;
        symbol       = _symbol;
        owner        = msg.sender;
        agentName    = _agentName;
        agentType    = _agentType;
        description  = _description;
        agentNetwork = _agentNetwork;
        createdAt    = block.timestamp;
        version      = 1;

        uint256 supply   = _totalSupply * 10 ** 18;
        totalSupply      = supply;
        _balances[msg.sender] = supply;
        dividendCredit[msg.sender] = 0;

        emit Transfer(address(0), msg.sender, supply);
    }

    // ── ERC-20 Implementation ─────────────────────────────────────────────────

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner_, address spender) external view returns (uint256) {
        return _allowances[owner_][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(_allowances[from][msg.sender] >= amount, "AgentToken: insufficient allowance");
        _allowances[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "AgentToken: transfer from zero address");
        require(to   != address(0), "AgentToken: transfer to zero address");
        require(_balances[from] >= amount, "AgentToken: insufficient balance");

        // Snapshot dividends before balance change
        _updateClaimable(from);
        _updateClaimable(to);

        _balances[from] -= amount;
        _balances[to]   += amount;
        emit Transfer(from, to, amount);
    }

    // ── Revenue Sharing ───────────────────────────────────────────────────────

    receive() external payable {
        depositRevenue();
    }

    /**
     * @notice Deposit ETH revenue to be shared proportionally among all token holders.
     * @dev Anyone can deposit, but typically called by the agent owner after profitable operations.
     */
    function depositRevenue() public payable {
        require(msg.value > 0, "AgentToken: deposit amount must be > 0");
        require(totalSupply  > 0, "AgentToken: no token supply");

        dividendPerToken += (msg.value * PRECISION) / totalSupply;
        totalRevenue     += msg.value;
        totalUnclaimed   += msg.value;

        emit RevenueDeposited(msg.sender, msg.value, dividendPerToken);
    }

    /**
     * @notice Claim all pending ETH revenue for msg.sender.
     */
    function claimRevenue() external returns (uint256 amount) {
        _updateClaimable(msg.sender);
        amount = claimable[msg.sender];
        require(amount > 0, "AgentToken: nothing to claim");

        claimable[msg.sender]  = 0;
        totalUnclaimed        -= amount;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "AgentToken: ETH transfer failed");

        emit RevenueClaimed(msg.sender, amount);
    }

    /**
     * @notice View pending revenue for any holder (read-only).
     */
    function pendingRevenue(address account) external view returns (uint256) {
        uint256 owedPerToken = dividendPerToken - dividendCredit[account];
        return claimable[account] + (_balances[account] * owedPerToken) / PRECISION;
    }

    function _updateClaimable(address account) internal {
        uint256 owedPerToken     = dividendPerToken - dividendCredit[account];
        claimable[account]       += (_balances[account] * owedPerToken) / PRECISION;
        dividendCredit[account]  = dividendPerToken;
    }

    // ── Governance ────────────────────────────────────────────────────────────

    /**
     * @notice Voting power = token balance (1 token = 1 vote).
     */
    function getVotes(address account) external view returns (uint256) {
        return _balances[account];
    }

    // ── Info ──────────────────────────────────────────────────────────────────

    function getAgentInfo() external view returns (
        string  memory _agentName,
        string  memory _agentType,
        string  memory _description,
        string  memory _agentNetwork,
        address _owner,
        uint256 _totalSupply,
        uint256 _createdAt,
        uint256 _totalRevenue,
        uint256 _dividendPerToken
    ) {
        return (
            agentName,
            agentType,
            description,
            agentNetwork,
            owner,
            totalSupply,
            createdAt,
            totalRevenue,
            dividendPerToken
        );
    }

    // ── Ownership ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "AgentToken: not owner");
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "AgentToken: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }
}
