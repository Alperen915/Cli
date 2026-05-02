// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SimpleAgent
 * @dev A simple on-chain AI agent contract for Arbitrum
 * @notice This contract stores agent state and can execute simple operations
 */
contract SimpleAgent {
    address public owner;
    string public agentName;
    string public agentType;
    bool public isActive;
    uint256 public createdAt;
    uint256 public lastAction;
    
    mapping(string => string) public state;
    string[] public stateKeys;
    
    event AgentCreated(string name, string agentType, address owner);
    event StateUpdated(string key, string value);
    event AgentActivated(bool active);
    event ActionExecuted(string action, uint256 timestamp);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    constructor(string memory _name, string memory _type) {
        owner = msg.sender;
        agentName = _name;
        agentType = _type;
        isActive = true;
        createdAt = block.timestamp;
        lastAction = block.timestamp;
        
        emit AgentCreated(_name, _type, msg.sender);
    }
    
    function setState(string memory key, string memory value) external onlyOwner {
        if (bytes(state[key]).length == 0) {
            stateKeys.push(key);
        }
        state[key] = value;
        lastAction = block.timestamp;
        
        emit StateUpdated(key, value);
    }
    
    function getState(string memory key) external view returns (string memory) {
        return state[key];
    }
    
    function getAllStateKeys() external view returns (string[] memory) {
        return stateKeys;
    }
    
    function setActive(bool _active) external onlyOwner {
        isActive = _active;
        lastAction = block.timestamp;
        
        emit AgentActivated(_active);
    }
    
    function executeAction(string memory action) external onlyOwner {
        require(isActive, "Agent is not active");
        lastAction = block.timestamp;
        
        emit ActionExecuted(action, block.timestamp);
    }
    
    function getAgentInfo() external view returns (
        string memory name,
        string memory agentTypeInfo,
        address agentOwner,
        bool active,
        uint256 created,
        uint256 lastActionTime
    ) {
        return (agentName, agentType, owner, isActive, createdAt, lastAction);
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}
