// Shared constants and helper functions used across the server bootstrap

const TERRAIN = {
  WATER: 0,
  HEAVY_FOREST: 1,
  LIGHT_FOREST: 2,
  BRUSH: 3,
  ROCKS: 4,
  MOUNTAIN: 5,
  CAVE_ENTRANCE: 6,
  EMPTY: 7,
  FARM_SEED: 8,
  FARM_GROWING: 9,
  FARM_READY: 10,
  BUILD_MARKER: 11,
  BUILD_MARKER_ALT: 11.5,
  DOOR_OPEN: 14,
  DOOR_OPEN_ALT: 16,
  ROAD: 18,
  DOOR_LOCKED: 19
};

const Z_LEVELS = {
  UNDERWATER: -3,
  CELLAR: -2,
  UNDERWORLD: -1,
  OVERWORLD: 0,
  BUILDING_1: 1,
  BUILDING_2: 2,
  SHIP: 3
};

const TILE_SIZE = 64;

const FACTION_IDS = {
  BROTHERHOOD: 1,
  GOTHS: 2,
  NORSEMEN: 3,
  FRANKS: 4,
  CELTS: 5,
  TEUTONS: 6,
  OUTLAWS: 7,
  MERCENARIES: 8
};

// Centralized lists of interactable building and object types
const INTERACTABLE_BUILDING_TYPES = ['dock', 'mill', 'mine', 'lumbermill', 'stable', 'tavern', 'market', 'monastery'];
const INTERACTABLE_OBJECT_TYPES = ['Goods1', 'Goods2', 'Goods3', 'Goods4', 'Desk', 'Chest', 'LockedChest'];

// Helper function to check if a destination is a doorway (must be defined before Entity.js)
function isDoorwayDestination(x, y, z) {
  if (z !== 0) return false;
  // Use a simple check that doesn't depend on other functions
  if (typeof global.tilemapSystem !== 'undefined') {
    const tile = global.tilemapSystem.getTile(0, x, y);
    return tile === 55 || tile === 56; // TERRAIN.DOOR_OPEN and TERRAIN.DOOR_OPEN_ALT values
  }
  return false;
}

// Helper function to check if terrain is a large rock (resource-carrying)
// Large rocks have values > TERRAIN.ROCKS (4) && < TERRAIN.MOUNTAIN (5)
function isLargeRock(terrain) {
  return terrain > TERRAIN.ROCKS && terrain < TERRAIN.MOUNTAIN;
}

// Helper functions to check if an entity is interactable
function isInteractableBuilding(building) {
  if (!building) return false;
  // Check for dynamic interactable property first
  if (building.interactable === true) return true;
  // Check if building type is in the interactable list
  return INTERACTABLE_BUILDING_TYPES.indexOf(building.type) !== -1;
}

function isInteractableObject(item) {
  if (!item) return false;
  // Check for dynamic interactable property first
  if (item.interactable === true) return true;
  // Check if item type is in the interactable list
  return INTERACTABLE_OBJECT_TYPES.indexOf(item.type) !== -1;
}

// Map context validation configuration (default: enabled + enforce)
const CONTEXT_VALIDATION_ENABLED = process.env.CONTEXT_VALIDATION_ENABLED !== 'false';
const CONTEXT_VALIDATION_ENFORCE = process.env.CONTEXT_VALIDATION_ENFORCE !== 'false';
const contextValidationConfig = {
  enabled: CONTEXT_VALIDATION_ENABLED,
  enforce: CONTEXT_VALIDATION_ENFORCE
};

// Expose globals immediately so they're available to modules
global.TERRAIN = TERRAIN;
global.Z_LEVELS = Z_LEVELS;
global.isDoorwayDestination = isDoorwayDestination;
global.isLargeRock = isLargeRock;
global.contextValidationConfig = contextValidationConfig;

module.exports = {
  TERRAIN,
  Z_LEVELS,
  TILE_SIZE,
  FACTION_IDS,
  INTERACTABLE_BUILDING_TYPES,
  INTERACTABLE_OBJECT_TYPES,
  isDoorwayDestination,
  isLargeRock,
  isInteractableBuilding,
  isInteractableObject,
  contextValidationConfig
};
