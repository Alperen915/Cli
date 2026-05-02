import { BaseAgent } from './baseAgent.js';
import { ethers } from 'ethers';

export class OnchainAgent extends BaseAgent {
  constructor(name, network = 'sepolia', options = {}) {
    super(name, 'onchain', network, options);
    this.contractAddress = null;
    this.deploymentTx = null;
    this.isDeployed = false;
  }

  getSystemPrompt() {
    return `${super.getSystemPrompt()}

As an On-Chain Agent, you specialize in:
- Deploying and managing smart contracts on Arbitrum
- Executing on-chain transactions autonomously
- Interacting with Arbitrum DeFi protocols
- Managing on-chain state and storage
- Gas optimization for Arbitrum L2

You understand:
- Arbitrum Stylus (Rust/C++ smart contracts)
- Solidity contract deployment
- ERC-20/721/1155 token standards
- Arbitrum bridge operations
- Cross-chain messaging

When deploying contracts, always:
1. Estimate gas costs first
2. Verify contract code before deployment
3. Use testnet (Sepolia) for testing
4. Provide transaction hashes for tracking`;
  }

  async prepareDeployment(contractBytecode) {
    if (!this.signer) throw new Error('Wallet not connected. Call attachWallet(privateKey) first.');

    const provider = this._wallet.provider;
    const estimatedGas = await provider.estimateGas({ data: contractBytecode });
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || 0n;

    return {
      estimatedGas: estimatedGas.toString(),
      gasPriceGwei: ethers.formatUnits(gasPrice, 'gwei'),
      estimatedCostEth: ethers.formatEther(estimatedGas * gasPrice),
      network: this.network
    };
  }

  async deploy(contractBytecode, abi = [], constructorArgs = []) {
    if (!this.signer) throw new Error('Wallet not connected. Call attachWallet(privateKey) first.');

    const factory = new ethers.ContractFactory(abi, contractBytecode, this.signer);
    const contract = await factory.deploy(...constructorArgs);
    await contract.waitForDeployment();

    this.contractAddress = await contract.getAddress();
    this.deploymentTx = contract.deploymentTransaction()?.hash;
    this.isDeployed = true;

    const explorer = this.executor?._explorer() || 'https://sepolia.arbiscan.io';
    return {
      contractAddress: this.contractAddress,
      transactionHash: this.deploymentTx,
      explorer:    `${explorer}/address/${this.contractAddress}`,
      txExplorer:  `${explorer}/tx/${this.deploymentTx}`
    };
  }

  async callContract(contractAddress, abi, methodName, args = []) {
    if (!this.signer) throw new Error('Wallet not connected.');
    const contract = new ethers.Contract(contractAddress, abi, this.signer);
    return contract[methodName](...args);
  }

  async readContract(contractAddress, abi, methodName, args = []) {
    const contract = new ethers.Contract(contractAddress, abi, this._wallet.provider);
    return contract[methodName](...args);
  }

  async getContractCode(address) {
    const code = await this._wallet.provider.getCode(address);
    return { address, hasCode: code !== '0x', codeLength: (code.length - 2) / 2 };
  }

  fallbackThink(input) {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('deploy') || lowerInput.includes('contract')) {
      return {
        thought: 'Deploying contracts on Arbitrum is fast and cost-effective.',
        action: 'deploy_guide',
        reasoning: 'Arbitrum L2 has low gas fees for contract deployment',
        steps: [
          '1. Compile your contract (Hardhat, Foundry, or Remix)',
          '2. Connect wallet: arb wallet connect',
          '3. Get testnet ETH from faucet for Sepolia',
          '4. Run: arb onchain deploy',
          '5. Provide bytecode when prompted'
        ],
        tools: [
          'Hardhat: https://hardhat.org',
          'Foundry: https://getfoundry.sh',
          'Remix: https://remix.ethereum.org',
          'Sepolia Faucet: https://sepoliafaucet.com'
        ],
        tip: 'Enable OPENAI_API_KEY for AI-assisted contract analysis'
      };
    }
    
    if (lowerInput.includes('verify') || lowerInput.includes('verification')) {
      return {
        thought: 'Contract verification makes your code public and trustworthy.',
        action: 'verify_guide',
        reasoning: 'Verified contracts show source code on Arbiscan',
        steps: [
          '1. Deploy your contract first',
          '2. Run: arb onchain verify --address <CONTRACT_ADDRESS>',
          '3. Provide contract source code',
          '4. View on Arbiscan'
        ],
        links: [
          'Arbiscan Mainnet: https://arbiscan.io',
          'Arbiscan Sepolia: https://sepolia.arbiscan.io'
        ],
        tip: 'Verification increases user trust in your contract'
      };
    }
    
    if (lowerInput.includes('interact') || lowerInput.includes('call') || lowerInput.includes('function')) {
      return {
        thought: 'You can interact with deployed contracts through the CLI.',
        action: 'interact_guide',
        reasoning: 'Call read or write functions on your contracts',
        steps: [
          '1. Have contract address and ABI ready',
          '2. Run: arb onchain interact',
          '3. Select function to call',
          '4. Provide parameters if needed'
        ],
        tip: 'Enable OPENAI_API_KEY for intelligent function suggestions'
      };
    }
    
    if (lowerInput.includes('gas') || lowerInput.includes('cost') || lowerInput.includes('fee')) {
      return {
        thought: 'Arbitrum has significantly lower gas fees than Ethereum mainnet.',
        action: 'gas_info',
        reasoning: 'L2 scaling reduces transaction costs by 10-100x',
        features: [
          'Contract deployment: ~$0.50-$5 (vs $50-$500 on mainnet)',
          'Simple transactions: ~$0.01-$0.10',
          'Complex interactions: ~$0.10-$1.00',
          'Gas price varies with network congestion'
        ],
        links: [
          'Arbitrum Gas Tracker: https://arbiscan.io/gastracker'
        ],
        tip: 'Use Sepolia testnet for free testing before mainnet'
      };
    }
    
    return {
      thought: `I am ${this.name}, an on-chain agent on ${this.network}.`,
      action: 'info',
      reasoning: `My capabilities: ${this.capabilities.join(', ')}`,
      features: [
        'Deploy smart contracts to Arbitrum',
        'Verify contracts on Arbiscan',
        'Interact with deployed contracts',
        'Estimate gas costs'
      ],
      tip: 'Enable OPENAI_API_KEY for AI-powered contract assistance'
    };
  }

  getDeploymentInfo() {
    return {
      isDeployed: this.isDeployed,
      contractAddress: this.contractAddress,
      deploymentTx: this.deploymentTx,
      network: this.network
    };
  }

  getInfo() {
    return {
      ...super.getInfo(),
      isDeployed: this.isDeployed,
      contractAddress: this.contractAddress,
      deploymentTx: this.deploymentTx
    };
  }
}
