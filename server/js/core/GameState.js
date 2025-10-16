// Centralized Game State Management
class GameState {
  constructor() {
    this.entities = new Map();
    this.players = new Map();
    this.buildings = new Map();
    this.items = new Map();
    this.houses = new Map();
    this.kingdoms = new Map();

    // Game world state
    this.world = null;
    this.day = 1;
    this.tick = 1;
    this.tempus = 'XII.a';
    this.nightfall = true;
    this.period = 360;

    // Game settings
    this.tileSize = 64;
    this.mapSize = 0;
    this.mapPx = 0;
  }

  // Entity management
  addEntity(entity) {
    this.entities.set(entity.id, entity);

    // Add to specific collections
    if (entity.type === 'player') {
      this.players.set(entity.id, entity);
    } else if (entity.type === 'building') {
      this.buildings.set(entity.id, entity);
    } else if (entity.type === 'item') {
      this.items.set(entity.id, entity);
    }
  }

  removeEntity(id) {
    const entity = this.entities.get(id);
    if (entity) {
      this.entities.delete(id);

      // Remove from specific collections
      this.players.delete(id);
      this.buildings.delete(id);
      this.items.delete(id);
    }
  }

  getEntity(id) {
    return this.entities.get(id);
  }

  getPlayer(id) {
    return this.players.get(id);
  }

  getBuilding(id) {
    return this.buildings.get(id);
  }

  getItem(id) {
    return this.items.get(id);
  }

  // World state management
  initializeWorld(worldData) {
    this.world = worldData;
    this.mapSize = worldData[0].length;
    this.mapPx = this.mapSize * this.tileSize;
  }

  updateTime() {
    this.tick++;
    this.updateTempus();

    if (this.tick >= this.period) {
      this.tick = 1;
      this.day++;
    }
  }

  updateTempus() {
    // Use the original cycle array logic
    const cycle = ['XII.a','I.a','II.a','III.a','IV.a','V.a','VI.a','VII.a','VIII.a','IX.a','X.a',
      'XI.a','XII.p','I.p','II.p','III.p','IV.p','V.p','VI.p','VII.p','VIII.p','IX.p','X.p','XI.p'];

    // Calculate which hour we're in (24 hours total, 0-23)
    const hourIndex = Math.floor((this.tick / this.period) * 24);
    const cycleIndex = hourIndex % 24;

    this.tempus = cycle[cycleIndex];

    // Nightfall is true during these hours: VIII.p, IX.p, X.p, XI.p, XII.a, I.a, II.a, III.a, IV.a
    this.nightfall = ['VIII.p', 'IX.p', 'X.p', 'XI.p', 'XII.a', 'I.a', 'II.a', 'III.a', 'IV.a'].includes(this.tempus);
  }

  // Resource management
  addResource(playerId, resourceType, amount) {
    const player = this.getPlayer(playerId);
    if (player && player.inventory) {
      if (!player.inventory[resourceType]) {
        player.inventory[resourceType] = 0;
      }
      player.inventory[resourceType] += amount;
    }
  }

  removeResource(playerId, resourceType, amount) {
    const player = this.getPlayer(playerId);
    if (player && player.inventory && player.inventory[resourceType]) {
      player.inventory[resourceType] = Math.max(0, player.inventory[resourceType] - amount);
    }
  }

  hasResource(playerId, resourceType, amount = 1) {
    const player = this.getPlayer(playerId);
    return player && player.inventory && (player.inventory[resourceType] || 0) >= amount;
  }

  // Utility methods
  getAllPlayers() {
    return Array.from(this.players.values());
  }

  getAllBuildings() {
    return Array.from(this.buildings.values());
  }

  getAllItems() {
    return Array.from(this.items.values());
  }

  // Serialization for client updates
  getPlayerUpdatePack(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return null;

    return {
      id: player.id,
      x: player.x,
      y: player.y,
      z: player.z,
      facing: player.facing,
      hp: player.hp,
      inventory: player.inventory
    };
  }

  getWorldUpdatePack() {
    return {
      day: this.day,
      tick: this.tick,
      tempus: this.tempus,
      nightfall: this.nightfall
    };
  }
}

// Create global game state instance
const gameState = new GameState();

// Export for use in other modules
module.exports = {
  GameState,
  gameState
};
