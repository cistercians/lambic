// Item Factory - Creates items using the base class
const BaseItem = require('./BaseItem.js');

class ItemFactory {
  constructor() {
    this.itemConfigs = {
      // Resources
      wood: { maxStack: 10, class: 'resource', rank: 0 },
      stone: { maxStack: 10, class: 'resource', rank: 0 },
      ironore: { maxStack: 10, class: 'resource', rank: 0 },
      iron: { maxStack: 10, class: 'resource', rank: 0 },
      silverore: { maxStack: 10, class: 'resource', rank: 0 },
      silver: { maxStack: 10, class: 'resource', rank: 0 },
      goldore: { maxStack: 10, class: 'resource', rank: 0 },
      gold: { maxStack: 10, class: 'resource', rank: 0 },
      diamond: { maxStack: 5, class: 'resource', rank: 2 },
      
      // Tools
      pickaxe: { maxStack: 1, class: 'tool', rank: 0 },
      stoneaxe: { maxStack: 1, class: 'tool', rank: 0 },
      ironaxe: { maxStack: 1, class: 'tool', rank: 0 },
      
      // Weapons
      dague: { maxStack: 1, class: 'weapon', rank: 0 },
      rondel: { maxStack: 1, class: 'weapon', rank: 0 },
      longsword: { maxStack: 1, class: 'weapon', rank: 1 },
      
      // Armor
      brigandine: { maxStack: 1, class: 'armor', rank: 0 },
      maille: { maxStack: 1, class: 'armor', rank: 1 },
      
      // Food
      bread: { maxStack: 20, class: 'food', rank: 0 },
      meat: { maxStack: 15, class: 'food', rank: 0 },
      
      // Special items
      key: { maxStack: 50, class: 'key', rank: 0 },
      torch: { maxStack: 10, class: 'tool', rank: 0 }
    };
  }
  
  createItem(type, param = {}) {
    const config = this.itemConfigs[type];
    if (!config) {
      console.error(`Unknown item type: ${type}`);
      return null;
    }
    
    return new BaseItem(type, config.maxStack, {
      ...param,
      class: config.class,
      rank: config.rank
    });
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
