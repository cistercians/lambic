// Centralized Game State Management
// NOTE: Entity management is handled by EntityRegistry - this class focuses on world/time state
class GameState {
  constructor() {
    // Game world state
    this.world = null;
    this.day = 1;
    this.tick = 1;
    this.tempus = 'XII.a';
    this.previousTempus = 'XII.a';
    this.previousHourIndex = 0;
    this.nightfall = true;
    this.period = 360;

    // Game settings
    this.tileSize = 64;
    this.mapSize = 0;
    this.mapPx = 0;
  }

  // World state management
  initializeWorld(worldData) {
    this.world = worldData;
    this.mapSize = worldData[0].length;
    this.mapPx = this.mapSize * this.tileSize;
  }

  updateTime() {
    this.tick++;
    // NOTE: updateTempus() no longer calculates tempus from tick - tempus is managed by dayNight()
    // We still call it to sync nightfall, but it won't change tempus
    this.updateTempus();

    // NOTE: Day increment is now handled by dayNight() when hourTick cycles back to 0
    // We reset tick counter but don't increment day here anymore
    if (this.tick >= this.period) {
      this.tick = 1;
      // Day increment moved to dayNight() function
    }
  }

  updateTempus() {
    // NOTE: Tempus is now managed by dayNight() function in lambic.js, which runs every 10 seconds
    // This function is kept for compatibility but should not override tempus values
    // It only updates nightfall based on current tempus (which is set by dayNight())
    this.nightfall = ['VIII.p', 'IX.p', 'X.p', 'XI.p', 'XII.a', 'I.a', 'II.a', 'III.a', 'IV.a'].includes(this.tempus);
  }

  // Serialization for client updates
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
