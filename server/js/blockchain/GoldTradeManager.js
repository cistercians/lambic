const Transaction = require('./Transaction');
const WalletManager = require('./WalletManager');

class GoldTradeManager {
  static async executeTrade(fromPlayer, toPlayer, amount) {
    try {
      if (!global.gameWalletLedger) {
        throw new Error('Game wallet ledger is not available');
      }
      // Validate amount
      if (amount <= 0) {
        throw new Error('Trade amount must be positive');
      }

      const success = global.gameWalletLedger.transferPlayers(
        fromPlayer,
        toPlayer,
        amount,
        'trade'
      );

      if (!success) {
        throw new Error('Insufficient Gold balance');
      }

      return { type: 'ledger-transfer', amount };
    } catch (err) {
      throw err;
    }
  }
  
  static async createMiningTransaction(player, amount) {
    try {
      if (!global.gameWalletLedger) {
        throw new Error('Game wallet ledger is not available');
      }
      const success = global.gameWalletLedger.creditPlayer(player, amount, 'mining');
      if (!success) {
        throw new Error('Game wallet has insufficient headroom');
      }
      return { type: 'ledger-credit', amount };
    } catch (err) {
      throw err;
    }
  }

  static async executeWithdrawal(player, toAddress, amount) {
    try {
      if (!global.gameWalletLedger || !global.gameWallet) {
        throw new Error('Game wallet ledger is not available');
      }
      if (!toAddress) {
        throw new Error('Withdrawal address is required');
      }
      if (amount <= 0) {
        throw new Error('Withdrawal amount must be positive');
      }

      const debited = global.gameWalletLedger.debitPlayer(player, amount, 'withdraw');
      if (!debited) {
        throw new Error('Insufficient Gold balance');
      }

      const privateKey = WalletManager.decryptPrivateKey(
        global.gameWallet.encryptedPrivateKey,
        process.env.WALLET_ENCRYPTION_KEY || 'default-master-key-change-in-production'
      );

      const transaction = new Transaction(
        global.gameWallet.address,
        toAddress,
        amount,
        'withdrawal',
        {
          playerName: player.name,
          timestamp: Date.now()
        }
      );

      WalletManager.signTransaction(privateKey, transaction);
      global.blockchain.addTransaction(transaction);

      if (global.p2pNetwork) {
        global.p2pNetwork.broadcast({
          type: 'NEW_TRANSACTION',
          data: transaction
        });
      }

      return transaction;
    } catch (err) {
      throw err;
    }
  }
}

module.exports = GoldTradeManager;

