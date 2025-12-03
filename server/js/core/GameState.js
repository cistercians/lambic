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
    this.updateTempus();

    if (this.tick >= this.period) {
      this.tick = 1;
      this.day++;
      
      // Trigger faction AI evaluation on new day
      if (typeof House !== 'undefined' && House.evaluateAI) {
        House.evaluateAI();
      }
    }
  }

  updateTempus() {
    // Use the original cycle array logic
    const cycle = ['XII.a','I.a','II.a','III.a','IV.a','V.a','VI.a','VII.a','VIII.a','IX.a','X.a',
      'XI.a','XII.p','I.p','II.p','III.p','IV.p','V.p','VI.p','VII.p','VIII.p','IX.p','X.p','XI.p'];

    // Calculate which hour we're in (24 hours total, 0-23)
    // Each hour should last (period / 24) ticks
    const hourIndex = Math.floor((this.tick / this.period) * 24);
    const cycleIndex = hourIndex % 24;

    const newTempus = cycle[cycleIndex];
    
    // Don't fire events here - events are fired in dayNight() where tempus changes are actually detected
    // This function just updates the tempus value every frame
    
    this.tempus = newTempus;
    this.previousTempus = newTempus;

    // Nightfall is true during these hours: VIII.p, IX.p, X.p, XI.p, XII.a, I.a, II.a, III.a, IV.a
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
