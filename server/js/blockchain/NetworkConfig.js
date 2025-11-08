module.exports = {
  // Blockchain network settings
  BLOCKCHAIN_PORT: process.env.BLOCKCHAIN_PORT || 6001,
  
  // Known peer nodes (bootstrap nodes)
  BOOTSTRAP_PEERS: (process.env.BOOTSTRAP_PEERS || '').split(',').filter(Boolean),
  
  // Mining settings
  MINING_DIFFICULTY: parseInt(process.env.MINING_DIFFICULTY) || 4,
  MINING_REWARD: parseInt(process.env.MINING_REWARD) || 10,
  BLOCK_TIME_TARGET: 30000, // Target 30 seconds per block
  
  // Transaction pool
  MAX_PENDING_TRANSACTIONS: 100,
  TRANSACTION_TIMEOUT: 300000 // 5 minutes
};

