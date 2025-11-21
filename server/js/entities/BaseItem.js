// Base Item Class - Eliminates duplication across all item types
class BaseItem {
  constructor(type, maxStack = 10, param = {}) {
    // Basic properties
    this.id = param.id || Math.random();
    this.x = param.x || 0;
    this.y = param.y || 0;
    this.z = param.z || 0;
    this.qty = param.qty || 1;
    this.type = type;
    this.class = param.class || 'resource';
    this.rank = param.rank || 0;
    this.parent = param.parent;
    this.maxStack = maxStack;
    
    // State flags
    this.canPickup = true;
    this.toUpdate = false;
    this.toRemove = false;
    this.innaWoods = this.checkInnaWoods();
    
    // Register with global systems
    this.register();
  }
  
  checkInnaWoods() {
    if (this.z === 0 && global.getLocTile) {
      const tile = global.getLocTile(0, this.x, this.y);
      return tile >= 1 && tile < 2;
    }
    return false;
  }
  
  // Distance calculation method (inherited from old Entity system)
  getDistance(pt) {
    return Math.sqrt(Math.pow(this.x - pt.x, 2) + Math.pow(this.y - pt.y, 2));
  }
  
  register() {
    if (global.Item && global.Item.list) {
      global.Item.list[this.id] = this;
    }
    if (global.initPack && global.initPack.item) {
      global.initPack.item.push(this.getInitPack());
    }
  }
  
  // Universal pickup logic for all items
  pickup(playerId) {
    const player = global.Player.list[playerId];
    const socket = global.SOCKET_LIST[playerId];
    
    if (!player || !socket) return;
    
    const currentAmount = player.inventory[this.type] || 0;
    
    if (currentAmount >= this.maxStack) {
      socket.write(JSON.stringify({
        msg: 'addToChat',
        message: `<i>You are already carrying too much</i> <b>${this.getDisplayName()}</b>.`
      }));
      return;
    }
    
    const canTake = Math.min(this.qty, this.maxStack - currentAmount);
    const remaining = this.qty - canTake;
    
    // Update player inventory
    player.inventory[this.type] = currentAmount + canTake;
    
    // Blockchain integration for Gold
    if (this.type === 'gold' && player.wallet && global.GoldTradeManager) {
      try {
        global.GoldTradeManager.createMiningTransaction(player, canTake);
      } catch (err) {
      }
    }
    
    // Update item quantity
    this.qty = remaining;
    this.toUpdate = true;
    
    // Remove item if completely picked up
    if (remaining <= 0) {
      this.toRemove = true;
    }
    
    // Send feedback to player
    socket.write(JSON.stringify({
      msg: 'addToChat',
      message: `<i>You picked up</i> ${canTake} <b>${this.getDisplayName()}</b>.`
    }));
    
    // Create item pickup event
    if(global.eventManager){
      global.eventManager.itemPickedUp(this, player, { x: this.x, y: this.y, z: this.z });
    }
  }
  
  getDisplayName() {
    // Convert type to display name (e.g., 'ironore' -> 'Iron Ore')
    return this.type.charAt(0).toUpperCase() + this.type.slice(1).replace(/([A-Z])/g, ' $1');
  }
  
  getRarity() {
    const rarities = ['Common', 'Rare', 'Lore', 'Mythic'];
    return rarities[this.rank] || 'Common';
  }
  
  getRarityColor() {
    const colors = {
      0: '#ffffff', // Common - white
      1: '#00ff00', // Rare - green
      2: '#0080ff', // Lore - blue
      3: '#a020f0'  // Mythic - purple
    };
    return colors[this.rank] || '#ffffff';
  }
  
  getRarityBorderColor() {
    const colors = {
      0: '#808080', // Common - gray
      1: '#00ff00', // Rare - green
      2: '#0080ff', // Lore - blue
      3: '#a020f0'  // Mythic - purple
    };
    return colors[this.rank] || '#808080';
  }
  
  getInitPack() {
    return {
      id: this.id,
      parent: this.parent,
      type: this.type,
      x: this.x,
      y: this.y,
      z: this.z,
      qty: this.qty,
      innaWoods: this.innaWoods
    };
  }
  
  getUpdatePack() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      z: this.z,
      innaWoods: this.innaWoods
    };
  }
  
  update() {
    // Override in subclasses for special update logic
  }
  
  blocker(n) {
    if (global.getLoc && global.matrixChange) {
      const loc = global.getLoc(this.x, this.y);
      global.matrixChange(this.z, loc[0], loc[1], n);
    }
  }
}

// Export for use in other modules
module.exports = BaseItem;
