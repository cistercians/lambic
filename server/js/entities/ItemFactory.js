// Item Factory - Creates items using the base class
const BaseItem = require('./BaseItem.js');

class ItemFactory {
  constructor() {
    this.itemConfigs = {
      // Resources
      wood: { maxStack: 10, class: 'resource', rank: 0 },
      stone: { maxStack: 10, class: 'resource', rank: 0 },
      grain: { maxStack: 10, class: 'resource', rank: 0 },
      ironore: { maxStack: 10, class: 'resource', rank: 0 },
      iron: { maxStack: 10, class: 'resource', rank: 0 },
      steel: { maxStack: 10, class: 'resource', rank: 1 },
      silverore: { maxStack: 10, class: 'resource', rank: 0 },
      silver: { maxStack: 10, class: 'resource', rank: 0 },
      goldore: { maxStack: 10, class: 'resource', rank: 0 },
      gold: { maxStack: 10, class: 'resource', rank: 0 },
      diamond: { maxStack: 5, class: 'resource', rank: 2 },
      boarhide: { maxStack: 10, class: 'resource', rank: 0 },
      leather: { maxStack: 10, class: 'resource', rank: 0 },
      
      // Tools
      pickaxe: { maxStack: 1, class: 'tool', rank: 0 },
      stoneaxe: { maxStack: 1, class: 'tool', rank: 0 },
      ironaxe: { maxStack: 1, class: 'tool', rank: 0 },
      huntingknife: { maxStack: 1, class: 'tool', rank: 0 },
      torch: { maxStack: 10, class: 'tool', rank: 0 },
      
      // Weapons
      dague: { maxStack: 1, class: 'weapon', rank: 0 },
      rondel: { maxStack: 1, class: 'weapon', rank: 0 },
      misericorde: { maxStack: 1, class: 'weapon', rank: 0 },
      bastardsword: { maxStack: 1, class: 'weapon', rank: 1 },
      longsword: { maxStack: 1, class: 'weapon', rank: 1 },
      zweihander: { maxStack: 1, class: 'weapon', rank: 1 },
      morallta: { maxStack: 1, class: 'weapon', rank: 1 },
      bow: { maxStack: 1, class: 'weapon', rank: 0 },
      welshlongbow: { maxStack: 1, class: 'weapon', rank: 1 },
      knightlance: { maxStack: 1, class: 'weapon', rank: 1 },
      rusticlance: { maxStack: 1, class: 'weapon', rank: 0 },
      paladinlance: { maxStack: 1, class: 'weapon', rank: 2 },
      arrows: { maxStack: 50, class: 'weapon', rank: 0 },
      
      // Armor
      brigandine: { maxStack: 1, class: 'armor', rank: 0 },
      lamellar: { maxStack: 1, class: 'armor', rank: 0 },
      maille: { maxStack: 1, class: 'armor', rank: 1 },
      hauberk: { maxStack: 1, class: 'armor', rank: 1 },
      brynja: { maxStack: 1, class: 'armor', rank: 1 },
      cuirass: { maxStack: 1, class: 'armor', rank: 1 },
      steelplate: { maxStack: 1, class: 'armor', rank: 2 },
      greenwichplate: { maxStack: 1, class: 'armor', rank: 2 },
      gothicplate: { maxStack: 1, class: 'armor', rank: 2 },
      clericrobe: { maxStack: 1, class: 'armor', rank: 0 },
      monkcowl: { maxStack: 1, class: 'armor', rank: 0 },
      blackcloak: { maxStack: 1, class: 'armor', rank: 1 },
      
      // Magic items
      tome: { maxStack: 1, class: 'magic', rank: 0 },
      runicscroll: { maxStack: 1, class: 'magic', rank: 1 },
      sacredtext: { maxStack: 1, class: 'magic', rank: 2 },
      
      // Food & Consumables
      bread: { maxStack: 20, class: 'food', rank: 0 },
      meat: { maxStack: 15, class: 'food', rank: 0 },
      fish: { maxStack: 20, class: 'food', rank: 0 },
      lamb: { maxStack: 15, class: 'food', rank: 0 },
      boarmeat: { maxStack: 15, class: 'food', rank: 0 },
      venison: { maxStack: 15, class: 'food', rank: 0 },
      poachedfish: { maxStack: 10, class: 'food', rank: 0 },
      lambchop: { maxStack: 10, class: 'food', rank: 1 },
      boarshank: { maxStack: 10, class: 'food', rank: 1 },
      venisonloin: { maxStack: 10, class: 'food', rank: 1 },
      mead: { maxStack: 10, class: 'drink', rank: 0 },
      saison: { maxStack: 10, class: 'drink', rank: 0 },
      flanders: { maxStack: 10, class: 'drink', rank: 1 },
      bieredegarde: { maxStack: 10, class: 'drink', rank: 1 },
      bordeaux: { maxStack: 10, class: 'drink', rank: 2 },
      bourgogne: { maxStack: 10, class: 'drink', rank: 2 },
      chianti: { maxStack: 10, class: 'drink', rank: 2 },
      
      // Environment objects
      barrel: { maxStack: 1, class: 'environment', rank: 0 },
      crates: { maxStack: 1, class: 'environment', rank: 0 },
      bookshelf: { maxStack: 1, class: 'environment', rank: 0 },
      suitarmor: { maxStack: 1, class: 'environment', rank: 0 },
      anvil: { maxStack: 1, class: 'environment', rank: 0 },
      runestone: { maxStack: 1, class: 'environment', rank: 0 },
      dummy: { maxStack: 1, class: 'environment', rank: 0 },
      cross: { maxStack: 1, class: 'environment', rank: 0 },
      skeleton1: { maxStack: 1, class: 'environment', rank: 0 },
      skeleton2: { maxStack: 1, class: 'environment', rank: 0 },
      goods1: { maxStack: 1, class: 'environment', rank: 0 },
      goods2: { maxStack: 1, class: 'environment', rank: 0 },
      goods3: { maxStack: 1, class: 'environment', rank: 0 },
      goods4: { maxStack: 1, class: 'environment', rank: 0 },
      stash1: { maxStack: 1, class: 'environment', rank: 0 },
      stash2: { maxStack: 1, class: 'environment', rank: 0 },
      desk: { maxStack: 1, class: 'environment', rank: 0 },
      swordrack: { maxStack: 1, class: 'environment', rank: 0 },
      bed: { maxStack: 1, class: 'environment', rank: 0 },
      jail: { maxStack: 1, class: 'environment', rank: 0 },
      jaildoor: { maxStack: 1, class: 'environment', rank: 0 },
      chains: { maxStack: 1, class: 'environment', rank: 0 },
      throne: { maxStack: 1, class: 'environment', rank: 0 },
      banner: { maxStack: 1, class: 'environment', rank: 0 },
      staghead: { maxStack: 1, class: 'environment', rank: 0 },
      blood: { maxStack: 1, class: 'environment', rank: 0 },
      
      // Containers
      chest: { maxStack: 1, class: 'tool', rank: 0 },
      lockedchest: { maxStack: 1, class: 'tool', rank: 0 },
      
      // Special items
      key: { maxStack: 50, class: 'key', rank: 0 },
      crown: { maxStack: 1, class: 'special', rank: 3 },
      worldmap: { maxStack: 1, class: 'special', rank: 0 },
      relic: { maxStack: 1, class: 'special', rank: 3 }
    };
  }
  
  createItem(type, param = {}) {
    const config = this.itemConfigs[type];
    if (!config) {
      console.error(`Unknown item type: ${type}`);
      return null;
    }
    
    // Use the global Item constructor from Entity.js instead of BaseItem
    if (!global.Item) {
      console.error('Item constructor not available');
      return null;
    }
    
    // Capitalize first letter for type (client expects 'Wood' not 'wood')
    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
    
    const item = global.Item({
      ...param,
      qty: param.qty || 1
    });
    
    // Set additional properties from config
    item.type = capitalizedType; // Client expects capitalized types
    item.class = config.class;
    item.rank = config.rank;
    item.canPickup = true;
    
    // Simple pickup function for all items
    item.pickup = function(playerId) {
      const player = global.Player.list[playerId];
      const socket = global.SOCKET_LIST[playerId];
      
      if (!player || !socket) return;
      
      const currentAmount = player.inventory[type] || 0;
      const maxStack = config.maxStack;
      
      if (currentAmount >= maxStack) {
        socket.write(JSON.stringify({
          msg: 'addToChat',
          message: `<i>You are already carrying too much</i> <b>${type}</b>.`
        }));
        return;
      }
      
      const canTake = Math.min(item.qty, maxStack - currentAmount);
      const remaining = item.qty - canTake;
      
      // Update player inventory
      player.inventory[type] = currentAmount + canTake;
      
      // Update item quantity
      item.qty = remaining;
      
      // Remove item if completely picked up
      if (remaining <= 0) {
        item.toRemove = true;
      }
      
      // Send feedback to player
      socket.write(JSON.stringify({
        msg: 'addToChat',
        message: `<i>You picked up</i> ${canTake} <b>${type}</b>.`
      }));
    };
    
    // Register with Item.list and initPack
    global.Item.list[item.id] = item;
    
    if (global.initPack && global.initPack.item) {
      global.initPack.item.push(item.getInitPack());
    }
    
    return item;
  }
  
  // Rarity system helpers
  static getRarityName(rank) {
    const rarities = ['Common', 'Rare', 'Lore', 'Mythic'];
    return rarities[rank] || 'Common';
  }
  
  static getRarityColor(rank) {
    const colors = {
      0: '#ffffff', // Common - white
      1: '#00ff00', // Rare - green
      2: '#0080ff', // Lore - blue
      3: '#a020f0'  // Mythic - purple
    };
    return colors[rank] || '#ffffff';
  }
  
  static getRarityBorderColor(rank) {
    const colors = {
      0: '#808080', // Common - gray
      1: '#00ff00', // Rare - green
      2: '#0080ff', // Lore - blue
      3: '#a020f0'  // Mythic - purple
    };
    return colors[rank] || '#808080';
  }
  
  // Convenience methods for common items
  createWood(param) { return this.createItem('wood', param); }
  createStone(param) { return this.createItem('stone', param); }
  createIron(param) { return this.createItem('iron', param); }
  createGold(param) { return this.createItem('gold', param); }
  createSilver(param) { return this.createItem('silver', param); }
  createPickaxe(param) { return this.createItem('pickaxe', param); }
  createStoneaxe(param) { return this.createItem('stoneaxe', param); }
  createIronaxe(param) { return this.createItem('ironaxe', param); }
  createKey(param) { return this.createItem('key', param); }
  createTorch(param) { return this.createItem('torch', param); }
}

// Create global factory instance
const itemFactory = new ItemFactory();

// Export factory functions for backward compatibility
const Wood = (param) => itemFactory.createWood(param);
const Stone = (param) => itemFactory.createStone(param);
const Iron = (param) => itemFactory.createIron(param);
const Gold = (param) => itemFactory.createGold(param);
const Silver = (param) => itemFactory.createSilver(param);
const Pickaxe = (param) => itemFactory.createPickaxe(param);
const Stoneaxe = (param) => itemFactory.createStoneaxe(param);
const Ironaxe = (param) => itemFactory.createIronaxe(param);
const Key = (param) => itemFactory.createKey(param);
const Torch = (param) => itemFactory.createTorch(param);

// Export everything
module.exports = {
  ItemFactory,
  itemFactory,
  Wood,
  Stone,
  Iron,
  Gold,
  Silver,
  Pickaxe,
  Stoneaxe,
  Ironaxe,
  Key,
  Torch
};
