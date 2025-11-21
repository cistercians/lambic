const Transaction = require('./Transaction');
const WalletManager = require('./WalletManager');

class GoldTradeManager {
  static async executeTrade(fromPlayer, toPlayer, amount) {
    try {
      if (!fromPlayer.wallet || !toPlayer.wallet) {
        throw new Error('Both players must have wallets');
      }
      
      // Validate amount
      if (amount <= 0) {
        throw new Error('Trade amount must be positive');
      }
      
      // Validate balance
      const balance = WalletManager.getBalance(fromPlayer.wallet.address);
      if (balance < amount) {
        throw new Error('Insufficient Gold balance');
      }
      
      // Decrypt private key to sign transaction
      const privateKey = WalletManager.decryptPrivateKey(
        fromPlayer.wallet.encryptedPrivateKey,
        process.env.WALLET_ENCRYPTION_KEY || 'default-master-key-change-in-production'
      );
      
      // Create transaction
      const transaction = new Transaction(
        fromPlayer.wallet.address,
        toPlayer.wallet.address,
        amount,
        'transfer',
        {
          fromPlayer: fromPlayer.name,
          toPlayer: toPlayer.name,
          timestamp: Date.now()
        }
      );
      
      // Sign transaction
      WalletManager.signTransaction(privateKey, transaction);
      
      // Add to blockchain
      global.blockchain.addTransaction(transaction);
      
      // Broadcast to network
      if (global.p2pNetwork) {
        global.p2pNetwork.broadcast({
          type: 'NEW_TRANSACTION',
          data: transaction
        });
      }
      
      // Update in-game inventories (will sync with blockchain)
      fromPlayer.inventory.gold = (fromPlayer.inventory.gold || 0) - amount;
      toPlayer.inventory.gold = (toPlayer.inventory.gold || 0) + amount;
      
      
      return transaction;
    } catch (err) {
      throw err;
    }
  }
  
  static async createMiningTransaction(player, amount) {
    try {
      if (!player.wallet) {
        throw new Error('Player must have a wallet');
      }
      
      // Create mining transaction (no sender = newly mined)
      const transaction = new Transaction(
        null, // No sender (new Gold)
        player.wallet.address, // Player's wallet
        amount,
        'mining',
        {
          playerName: player.name,
          location: player.x && player.y ? [Math.floor(player.x), Math.floor(player.y)] : null,
          timestamp: Date.now()
        }
      );
      
      // Add to blockchain pending transactions
      global.blockchain.addTransaction(transaction);
      
      // Broadcast to network
      if (global.p2pNetwork) {
        global.p2pNetwork.broadcast({
          type: 'NEW_TRANSACTION',
          data: transaction
        });
      }
      
      // Update in-game inventory (will sync with blockchain)
      player.inventory.gold = (player.inventory.gold || 0) + amount;
      
      
      return transaction;
    } catch (err) {
      throw err;
    }
  }
}

module.exports = GoldTradeManager;

