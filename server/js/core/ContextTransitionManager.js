/**
 * ContextTransitionManager - Unified system for managing map context transitions
 * Ensures all data flows are properly updated when players move between main world and battlegrounds
 */

const mapContextHelpers = require('./MapContextHelpers');

class ContextTransitionManager {
  constructor() {
    this.transitionsInProgress = new Map(); // playerId -> transition data
    this.transitionHooks = {
      beforeTransition: [],
      duringTransition: [],
      afterTransition: []
    };
  }

  /**
   * Register a hook to be called during context transitions
   * @param {string} phase - 'beforeTransition', 'duringTransition', or 'afterTransition'
   * @param {Function} callback - Function to call: (playerId, fromContext, toContext, transitionData) => void
   */
  registerHook(phase, callback) {
    if (!this.transitionHooks[phase]) {
      console.warn(`[ContextTransitionManager] Unknown hook phase: ${phase}`);
      return;
    }
    this.transitionHooks[phase].push(callback);
  }

  /**
   * Execute hooks for a given phase
   * @param {string} phase - Hook phase to execute
   * @param {string} playerId - Player ID transitioning
   * @param {Object} fromContext - Source context {inBattleground: bool, matchId: string|null}
   * @param {Object} toContext - Target context {inBattleground: bool, matchId: string|null}
   * @param {Object} transitionData - Additional transition data
   */
  async executeHooks(phase, playerId, fromContext, toContext, transitionData) {
    const hooks = this.transitionHooks[phase] || [];
    for (const hook of hooks) {
      try {
        await hook(playerId, fromContext, toContext, transitionData);
      } catch (error) {
        console.error(`[ContextTransitionManager] Error in ${phase} hook:`, error);
      }
    }
  }

  /**
   * Transition a player to a new map context
   * This is the UNIFIED entry point for all context transitions
   * @param {string} playerId - Player ID to transition
   * @param {Object} toContext - Target context {matchId: string|null, position: {x, y, z}, worldData: any}
   * @param {Object} options - Transition options
   * @returns {Promise<Object>} Transition result
   */
  async transitionPlayer(playerId, toContext, options = {}) {
    const player = global.Player.list[playerId];
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    // Get current context
    const fromContext = {
      inBattleground: !!(player.inBattleground && player.battlegroundMatchId),
      matchId: player.battlegroundMatchId || null
    };

    // Get target context
    const targetContext = {
      inBattleground: !!toContext.matchId,
      matchId: toContext.matchId || null
    };

    // Check if transition is needed
    if (fromContext.inBattleground === targetContext.inBattleground &&
        fromContext.matchId === targetContext.matchId) {
      // Already in target context
      return { success: true, skipped: true };
    }

    // Mark transition as in progress
    const transitionId = `${playerId}_${Date.now()}`;
    const transitionData = {
      id: transitionId,
      playerId,
      fromContext,
      toContext: targetContext,
      position: toContext.position || { x: player.x, y: player.y, z: player.z },
      worldData: toContext.worldData,
      options,
      startTime: Date.now()
    };
    this.transitionsInProgress.set(playerId, transitionData);

    try {
      // Phase 1: Before transition - prepare systems
      await this.executeHooks('beforeTransition', playerId, fromContext, targetContext, transitionData);

      // Phase 2: During transition - update entity context and position
      await this.executeHooks('duringTransition', playerId, fromContext, targetContext, transitionData);
      
      // Update player context
      if (mapContextHelpers) {
        mapContextHelpers.setEntityContext(player, targetContext.matchId);
      } else {
        player.inBattleground = targetContext.inBattleground;
        player.battlegroundMatchId = targetContext.matchId;
      }

      // Update position if provided
      if (toContext.position) {
        player.x = toContext.position.x;
        player.y = toContext.position.y;
        player.z = toContext.position.z;
      }

      // Phase 3: After transition - notify systems and send updates
      await this.executeHooks('afterTransition', playerId, fromContext, targetContext, transitionData);

      // Mark transition complete
      this.transitionsInProgress.delete(playerId);

      return {
        success: true,
        transitionId,
        fromContext,
        toContext: targetContext
      };
    } catch (error) {
      console.error(`[ContextTransitionManager] Error during transition for player ${playerId}:`, error);
      this.transitionsInProgress.delete(playerId);

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if a player is currently transitioning
   * @param {string} playerId - Player ID to check
   * @returns {boolean} True if player is transitioning
   */
  isTransitioning(playerId) {
    return this.transitionsInProgress.has(playerId);
  }

  /**
   * Get transition data for a player
   * @param {string} playerId - Player ID
   * @returns {Object|null} Transition data or null if not transitioning
   */
  getTransition(playerId) {
    return this.transitionsInProgress.get(playerId) || null;
  }

  /**
   * Cancel an in-progress transition
   * @param {string} playerId - Player ID
   */
  cancelTransition(playerId) {
    if (this.transitionsInProgress.has(playerId)) {
      this.transitionsInProgress.delete(playerId);
    }
  }
}

module.exports = new ContextTransitionManager();

