/**
 * Entities.js - Clean API for accessing entity constructors
 * 
 * This module provides a clean interface to the entity system.
 * Use this for new code instead of accessing globals directly.
 * 
 * Usage:
 *   const Entities = require('./entities/Entities');
 *   const building = new Entities.Building({ x: 100, y: 200 });
 * 
 * Or with destructuring:
 *   const { Character, Building, Item } = require('./entities/Entities');
 */

// Import from the main Entity.js file
const EntityModule = require('../Entity');

// Re-export with cleaner structure
module.exports = {
  // Base classes
  Entity: EntityModule.Entity,
  Character: EntityModule.Character,
  Building: EntityModule.Building,
  
  // Character types
  Serf: EntityModule.Serf,
  SerfM: EntityModule.SerfM,
  SerfF: EntityModule.SerfF,
  
  // Other entities
  Arrow: EntityModule.Arrow,
  Item: EntityModule.Item,
  Light: EntityModule.Light,
  Weather: EntityModule.Weather,
  
  // Initialization
  initModularEntities: EntityModule.initModularEntities,
  
  // Entity lists (for backward compatibility)
  get PlayerList() { return global.Player ? global.Player.list : {}; },
  get BuildingList() { return global.Building ? global.Building.list : {}; },
  get ItemList() { return global.Item ? global.Item.list : {}; },
  get ArrowList() { return global.Arrow ? global.Arrow.list : {}; },
  get LightList() { return global.Light ? global.Light.list : {}; },
  get WeatherList() { return global.Weather ? global.Weather.list : {}; }
};

