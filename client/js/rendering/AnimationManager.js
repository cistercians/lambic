/**
 * AnimationManager - Manages all game animations
 * 
 * Extracted from client.js for better organization.
 */

class AnimationManager {
  constructor() {
    this.timers = {
      water: 0,
      clouds: 0,
      flicker: 0,
      shipWakes: 0,
      fly: 0,
      walk: 0,
      working: 0
    };

    // Animation state variables (would be set from globals)
    this.waterFrame = 0;
    this.cloudFrame = 0;
    this.flyFrame = 0;
    this.walkFrame = 0;
    this.workingFrame = 0;
    this.flicker = 0;
    this.flickerRange = [0.95, 0.96, 0.97, 0.98, 0.99, 1.0, 1.01, 1.02, 1.03, 1.04, 1.05];
  }

  /**
   * Update all animations based on delta time
   * @param {number} deltaTime - Time since last frame in milliseconds
   * @param {object} dependencies - External dependencies (shipWakes, tileHighlights, tileSize, PlayerList, checkInView)
   */
  update(deltaTime, dependencies = {}) {
    const { shipWakes, tileHighlights, tileSize, PlayerList, checkInView } = dependencies;

    // Water animation (cycle every 1200ms)
    this.timers.water += deltaTime;
    if (this.timers.water >= 1200) {
      this.waterFrame = (this.waterFrame + 1) % 3;
      this.timers.water -= 1200;
    }

    // Clouds animation (cycle every 2000ms)
    this.timers.clouds += deltaTime;
    if (this.timers.clouds >= 2000) {
      this.cloudFrame = (this.cloudFrame + 1) % 3;
      this.timers.clouds -= 2000;
    }

    // Flicker (update every 50ms)
    this.timers.flicker += deltaTime;
    if (this.timers.flicker >= 50) {
      this.flicker = this.flickerRange[Math.floor(Math.random() * this.flickerRange.length)];
      this.timers.flicker -= 50;
    }

    // Ship wakes (update every 100ms)
    this.timers.shipWakes += deltaTime;
    if (this.timers.shipWakes >= 100) {
      if (tileSize > 0) {
        if (shipWakes && typeof shipWakes.update === 'function' && PlayerList) {
          shipWakes.update({ PlayerList, checkInView, tileSize });
        }
        if (tileHighlights && typeof tileHighlights.update === 'function') {
          tileHighlights.update();
        }
      }
      this.timers.shipWakes -= 100;
    }

    // Fly animation (cycle every 600ms)
    this.timers.fly += deltaTime;
    if (this.timers.fly >= 600) {
      this.flyFrame = (this.flyFrame + 1) % 7; // 0-6
      this.timers.fly -= 600;
    }

    // Walk animation (cycle every 400ms)
    this.timers.walk += deltaTime;
    if (this.timers.walk >= 400) {
      this.walkFrame = (this.walkFrame + 1) % 2; // 0-1
      this.timers.walk -= 400;
    }

    // Working icon animation (cycle every 800ms)
    this.timers.working += deltaTime;
    if (this.timers.working >= 800) {
      this.workingFrame = (this.workingFrame + 1) % 2; // 0-1
      this.timers.working -= 800;
    }
  }

  /**
   * Get current animation frame values
   * @returns {object} Animation frame values
   */
  getFrames() {
    return {
      water: this.waterFrame,
      clouds: this.cloudFrame,
      fly: this.flyFrame,
      walk: this.walkFrame,
      working: this.workingFrame,
      flicker: this.flicker
    };
  }

  /**
   * Reset all animations
   */
  reset() {
    this.timers = {
      water: 0,
      clouds: 0,
      flicker: 0,
      shipWakes: 0,
      fly: 0,
      walk: 0,
      working: 0
    };
    this.waterFrame = 0;
    this.cloudFrame = 0;
    this.flyFrame = 0;
    this.walkFrame = 0;
    this.workingFrame = 0;
    this.flicker = 1.0;
  }
}

// Export for use in client.js
if (typeof window !== 'undefined') {
  window.AnimationManager = AnimationManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnimationManager;
}
