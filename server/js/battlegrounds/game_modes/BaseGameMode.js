/**
 * BaseGameMode - Base class for all Battlegrounds game modes
 */

class BaseGameMode {
  constructor(matchManager) {
    this.matchManager = matchManager;
    this.match = null; // Will be set in init()
  }

  /**
   * Initialize the game mode with match data
   * @param {object} match - Current match object
   */
  init(match) {
    this.match = match;
  }

  /**
   * Check win condition for this game mode
   * @returns {object|null} Win condition result or null
   */
  checkWinCondition() {
    throw new Error('checkWinCondition must be implemented by subclass');
  }

  /**
   * Get spawn points for participants
   * @returns {object} Map of playerId -> {x, y, z}
   */
  getSpawnPoints() {
    throw new Error('getSpawnPoints must be implemented by subclass');
  }

  /**
   * Handle participant death
   * @param {string} playerId - ID of player who died
   * @param {string} killerId - ID of killer (if any)
   */
  onParticipantDeath(playerId, killerId) {
    // Default implementation - can be overridden
  }

  /**
   * Update game mode logic (called every update cycle)
   */
  update() {
    // Default implementation - can be overridden
  }

  /**
   * Get available maps for this game mode
   * @returns {array} Array of map type strings
   */
  getAvailableMaps() {
    return ['continental', 'mainland', 'wild', 'caves', 'dungeons', 'islands'];
  }

  /**
   * Cleanup when match ends
   */
  cleanup() {
    this.match = null;
  }
}

module.exports = BaseGameMode;

