class GameWalletLedger {
  constructor(options = {}) {
    this.playerBalances = new Map();
    this.worldBalance = 0;
    this.auditLog = [];
    this.auditLimit = options.auditLimit || 200;
    this.seeded = false;
  }

  ensureSeeded() {
    if (this.seeded) return;
    this.seeded = true;

    // Seed player balances from current inventories
    if (global.Player && global.Player.list) {
      for (const id in global.Player.list) {
        const player = global.Player.list[id];
        if (!player || !player.inventory) continue;
        const balance = player.inventory.gold || 0;
        if (balance > 0) {
          this.playerBalances.set(player.id, balance);
        }
      }
    }

    // Seed world balance from existing gold items on the ground
    if (global.Item && global.Item.list) {
      let worldGold = 0;
      for (const id in global.Item.list) {
        const item = global.Item.list[id];
        if (!item || !item.type) continue;
        const itemType = String(item.type).toLowerCase();
        if (itemType === 'gold') {
          const qty = typeof item.qty === 'number' ? item.qty : 1;
          worldGold += qty;
        }
      }
      if (worldGold > 0) {
        this.worldBalance = worldGold;
      }
    }
  }

  getGameWalletBalance() {
    if (!global.blockchain || !global.gameWallet) return 0;
    return global.blockchain.getBalanceOfAddress(global.gameWallet.address) || 0;
  }

  getPlayerBalance(playerId) {
    return this.playerBalances.get(playerId) || 0;
  }

  getWorldBalance() {
    return this.worldBalance;
  }

  getCirculationTotal() {
    let total = this.worldBalance;
    for (const balance of this.playerBalances.values()) {
      total += balance;
    }
    return total;
  }

  getHeadroom() {
    return this.getGameWalletBalance() - this.getCirculationTotal();
  }

  canMint(amount) {
    return this.getHeadroom() >= amount;
  }

  creditPlayer(player, amount, reason = 'credit') {
    this.ensureSeeded();
    if (!player || !amount || amount <= 0) return false;
    if (!this.canMint(amount)) return false;

    const current = this.getPlayerBalance(player.id);
    const next = current + amount;
    this.playerBalances.set(player.id, next);
    this.syncInventory(player, next);
    this.audit('credit', player.id, amount, reason);
    return true;
  }

  debitPlayer(player, amount, reason = 'debit') {
    this.ensureSeeded();
    if (!player || !amount || amount <= 0) return false;
    const current = this.getPlayerBalance(player.id);
    if (current < amount) return false;
    const next = current - amount;
    this.playerBalances.set(player.id, next);
    this.syncInventory(player, next);
    this.audit('debit', player.id, amount, reason);
    return true;
  }

  transfer(fromId, toId, amount, reason = 'transfer') {
    this.ensureSeeded();
    if (!amount || amount <= 0) return false;

    const fromBalance = this.getAccountBalance(fromId);
    if (fromBalance < amount) return false;
    this.setAccountBalance(fromId, fromBalance - amount);

    const toBalance = this.getAccountBalance(toId);
    this.setAccountBalance(toId, toBalance + amount);
    this.audit('transfer', `${fromId}->${toId}`, amount, reason);
    return true;
  }

  transferPlayers(fromPlayer, toPlayer, amount, reason = 'transfer') {
    this.ensureSeeded();
    if (!fromPlayer || !toPlayer || !amount || amount <= 0) return false;
    const fromBalance = this.getPlayerBalance(fromPlayer.id);
    if (fromBalance < amount) return false;
    const toBalance = this.getPlayerBalance(toPlayer.id);
    this.playerBalances.set(fromPlayer.id, fromBalance - amount);
    this.playerBalances.set(toPlayer.id, toBalance + amount);
    this.syncInventory(fromPlayer, fromBalance - amount);
    this.syncInventory(toPlayer, toBalance + amount);
    this.audit('transfer', `${fromPlayer.id}->${toPlayer.id}`, amount, reason);
    return true;
  }

  transferWorldToPlayer(player, amount, reason = 'pickup') {
    this.ensureSeeded();
    if (!player || !amount || amount <= 0) return false;

    let remaining = amount;
    if (this.worldBalance > 0) {
      const fromWorld = Math.min(this.worldBalance, remaining);
      this.worldBalance -= fromWorld;
      remaining -= fromWorld;
    }

    if (remaining > 0 && !this.canMint(remaining)) {
      return false;
    }

    const current = this.getPlayerBalance(player.id);
    const next = current + amount;
    this.playerBalances.set(player.id, next);
    this.syncInventory(player, next);
    this.audit('worldToPlayer', player.id, amount, reason);
    return true;
  }

  transferPlayerToWorld(player, amount, reason = 'drop') {
    this.ensureSeeded();
    if (!player || !amount || amount <= 0) return false;
    const current = this.getPlayerBalance(player.id);
    if (current < amount) return false;
    const next = current - amount;
    this.playerBalances.set(player.id, next);
    this.worldBalance += amount;
    this.syncInventory(player, next);
    this.audit('playerToWorld', player.id, amount, reason);
    return true;
  }

  syncInventory(player, balance) {
    if (!player || !player.inventory) return;
    player.inventory.gold = balance;
  }

  getAccountBalance(accountId) {
    if (accountId === 'world') return this.worldBalance;
    return this.getPlayerBalance(accountId);
  }

  setAccountBalance(accountId, amount) {
    if (accountId === 'world') {
      this.worldBalance = amount;
    } else {
      this.playerBalances.set(accountId, amount);
    }
  }

  audit(action, subject, amount, reason) {
    this.auditLog.push({
      at: Date.now(),
      action,
      subject,
      amount,
      reason
    });
    if (this.auditLog.length > this.auditLimit) {
      this.auditLog.shift();
    }
  }
}

module.exports = GameWalletLedger;
