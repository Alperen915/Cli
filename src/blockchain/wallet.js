import { ethers } from 'ethers';
import { config } from '../utils/config.js';
import { display } from '../utils/display.js';

export class ArbitrumWallet {
  constructor(network = 'sepolia') {
    this.network = network;
    this.networkConfig = config.arbitrum[network];
    this.provider = new ethers.JsonRpcProvider(this.networkConfig.rpcUrl);
    this.wallet = null;
  }

  async connect(privateKey) {
    try {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      return {
        address: this.wallet.address,
        network: this.networkConfig.name
      };
    } catch (error) {
      throw new Error(`Failed to connect wallet: ${error.message}`);
    }
  }

  generateWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic.phrase
    };
  }

  async getBalance(address) {
    try {
      const balance = await this.provider.getBalance(address || this.wallet?.address);
      return ethers.formatEther(balance);
    } catch (error) {
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  async getGasPrice() {
    try {
      const feeData = await this.provider.getFeeData();
      return {
        gasPrice: ethers.formatUnits(feeData.gasPrice, 'gwei'),
        maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') : null,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : null
      };
    } catch (error) {
      throw new Error(`Failed to get gas price: ${error.message}`);
    }
  }

  async getBlockNumber() {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      throw new Error(`Failed to get block number: ${error.message}`);
    }
  }

  async sendTransaction(to, amount) {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await this.wallet.sendTransaction({
        to,
        value: ethers.parseEther(amount.toString())
      });
      return {
        hash: tx.hash,
        explorer: `${this.networkConfig.explorer}/tx/${tx.hash}`
      };
    } catch (error) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  async estimateGas(to, data) {
    try {
      const estimate = await this.provider.estimateGas({
        to,
        data: data || '0x'
      });
      return estimate.toString();
    } catch (error) {
      throw new Error(`Gas estimation failed: ${error.message}`);
    }
  }

  getNetworkInfo() {
    return {
      name: this.networkConfig.name,
      chainId: this.networkConfig.chainId,
      rpcUrl: this.networkConfig.rpcUrl,
      explorer: this.networkConfig.explorer
    };
  }
}
