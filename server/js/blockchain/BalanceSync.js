class BalanceSync {
  static syncPlayerBalances() {
    if (!global.Player || !global.blockchain) {
      return;
    }
    
    let syncedCount = 0;
    
    for (const playerId in global.Player.list) {
      const player = global.Player.list[playerId];
      
      if (player.type === 'player' && player.wallet && player.wallet.address) {
        // Get balance from blockchain
        const blockchainBalance = global.blockchain.getBalanceOfAddress(
          player.wallet.address
        );
        
        // Initialize inventory.gold if it doesn't exist
        if (!player.inventory) {
          player.inventory = {};
        }
        
        // Update in-game inventory
        const oldBalance = player.inventory.gold || 0;
        player.inventory.gold = blockchainBalance;
        
        if (oldBalance !== blockchainBalance) {
          syncedCount++;
        }
      }
    }
    
    if (syncedCount > 0) {
    }
  }
  
  static startSyncLoop() {
    // Sync every minute
    setInterval(() => {
      this.syncPlayerBalances();
    }, 60000);
    
  }
}

module.exports = BalanceSync;

