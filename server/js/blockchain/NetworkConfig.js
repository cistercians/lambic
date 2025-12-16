module.exports = {
  // Blockchain network settings
  BLOCKCHAIN_PORT: process.env.BLOCKCHAIN_PORT || 6001,
  
  // Known peer nodes (bootstrap nodes)
  // Combines hardcoded bootstrap nodes with environment variable
  BOOTSTRAP_PEERS: (() => {
    const hardcodedBootstrapNodes = [
      // Add well-known bootstrap nodes here
      // Example: 'ws://bootstrap1.example.com:6001',
      // Example: 'ws://bootstrap2.example.com:6001',
    ];
    
    const envPeers = (process.env.BOOTSTRAP_PEERS || '').split(',').filter(Boolean);
    
    // Combine and deduplicate
    const allPeers = [...hardcodedBootstrapNodes, ...envPeers];
    return [...new Set(allPeers)]; // Remove duplicates
  })(),
  
  // Mining settings
  MINING_DIFFICULTY: parseInt(process.env.MINING_DIFFICULTY) || 4,
  MINING_REWARD: parseInt(process.env.MINING_REWARD) || 10,
  BLOCK_TIME_TARGET: 30000, // Target 30 seconds per block
  
  // Transaction pool
  MAX_PENDING_TRANSACTIONS: 100,
  TRANSACTION_TIMEOUT: 300000, // 5 minutes
  
  // P2P Network settings
  MAX_PEERS: parseInt(process.env.MAX_PEERS) || 10,
  MAX_KNOWN_PEERS: parseInt(process.env.MAX_KNOWN_PEERS) || 50
};
