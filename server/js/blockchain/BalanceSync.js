class BalanceSync {
  static syncPlayerBalances() {
    if (!global.Player || !global.blockchain) {
      return;
    }
    
    let syncedCount = 0;
    
    for (const playerId in global.Player.list) {
      const player = global.Player.list[playerId];
      if (!player || player.type !== 'player') continue;

      // Reconcile inventory vs game wallet ledger (do not overwrite)
      if (global.gameWalletLedger) {
        const ledgerBalance = global.gameWalletLedger.getPlayerBalance(player.id);
        const inventoryBalance = (player.inventory && player.inventory.gold) || 0;
        if (ledgerBalance !== inventoryBalance) {
          syncedCount++;
        }
      }
    }
    
    if (syncedCount > 0) {
      console.warn(`[BalanceSync] Detected ${syncedCount} gold balance mismatches`);
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

