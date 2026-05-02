import { BaseAgent } from './baseAgent.js';

export class CustomAgent extends BaseAgent {
  constructor(name, network = 'sepolia', options = {}) {
    super(name, 'custom', network, options);
    this.customCapabilities = [];
    this.customData = {};
  }

  getSystemPrompt() {
    return `${super.getSystemPrompt()}

As a Custom Agent, you are fully configurable and can:
- Perform any combination of trading, DeFi, NFT, and social tasks
- Execute custom workflows defined by the user
- Integrate with any Arbitrum protocol
- Adapt to specific use cases

You are highly flexible and can learn from user instructions.
Always ask clarifying questions when the task is ambiguous.

Custom capabilities added: ${this.customCapabilities.join(', ') || 'None yet'}`;
  }

  fallbackThink(input) {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('add') || lowerInput.includes('capability')) {
      return {
        thought: 'Custom agents can be extended with new capabilities.',
        action: 'add_capability',
        reasoning: 'You can customize this agent to suit your specific needs',
        examples: [
          'Add trading capabilities for specific DEXs',
          'Add monitoring for specific tokens',
          'Add automation for recurring tasks',
          'Add integration with external APIs'
        ],
        tip: 'Enable OPENAI_API_KEY to describe capabilities in natural language'
      };
    }
    
    if (lowerInput.includes('help') || lowerInput.includes('what')) {
      return {
        thought: `I am ${this.name}, a fully customizable agent on ${this.network}.`,
        action: 'info',
        reasoning: 'As a custom agent, I can be configured for any task',
        currentCapabilities: this.customCapabilities.length > 0 
          ? this.customCapabilities 
          : ['No custom capabilities added yet'],
        defaultCapabilities: this.capabilities,
        tip: 'Enable OPENAI_API_KEY for intelligent task execution'
      };
    }
    
    return {
      thought: 'I am ready to be customized for your specific needs.',
      action: 'awaiting_instructions',
      reasoning: `Current capabilities: ${this.capabilities.join(', ')}`,
      suggestions: [
        'Tell me what tasks you want me to perform',
        'Describe your workflow requirements',
        'Specify which protocols to integrate with'
      ],
      tip: 'Enable OPENAI_API_KEY for natural language customization'
    };
  }

  addCapability(capability) {
    this.customCapabilities.push(capability);
    this.capabilities.push(capability);
  }

  setData(key, value) {
    this.customData[key] = value;
  }

  getData(key) {
    return this.customData[key];
  }

  getInfo() {
    return {
      ...super.getInfo(),
      customCapabilities: this.customCapabilities,
      customDataKeys: Object.keys(this.customData)
    };
  }
}
