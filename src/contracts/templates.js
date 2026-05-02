export const CONTRACT_TEMPLATES = {
  simpleStorage: {
    name: 'Simple Storage',
    description: 'Basic storage contract for testing deployment',
    bytecode: '0x608060405234801561001057600080fd5b5060f78061001f6000396000f3fe6080604052348015600f57600080fd5b5060043610603c5760003560e01c80632e64cec11460415780636057361d146059575b600080fd5b60476071565b60405190815260200160405180910390f35b606f60048036038101906069919060a0565b607a565b005b60008054905090565b8060008190555050565b600080fd5b6000819050919050565b609381608a565b8114609d57600080fd5b50565b60008135905060aa81608c565b92915050565b60006020828403121560c35760c2607d565b5b600060d184828501609d565b9150509291505056fea26469706673582212207f4e7f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f64736f6c63430008130033',
    abi: [
      {
        "inputs": [],
        "name": "retrieve",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [{"internalType": "uint256", "name": "num", "type": "uint256"}],
        "name": "store",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ],
    constructorArgs: []
  }
};

export function getTemplate(name) {
  return CONTRACT_TEMPLATES[name] || null;
}

export function listTemplates() {
  return Object.entries(CONTRACT_TEMPLATES).map(([key, value]) => ({
    id: key,
    name: value.name,
    description: value.description
  }));
}
