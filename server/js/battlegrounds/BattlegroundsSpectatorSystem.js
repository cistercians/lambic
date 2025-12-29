/**
 * BattlegroundsSpectatorSystem - Manages spectator mode for battleground matches
 * Filters to battleground participants only and subscribes to battleground events
 */

class BattlegroundsSpectatorSystem {
  constructor() {
    this.spectators = {}; // {playerId: {matchId, currentTargetId, availableTargets: []}}
    this.updateInterval = null;
    this.updateIntervalMs = 1000; // Update every second
  }

  /**
   * Enable spectator mode for a player in a battleground match
   * @param {string} playerId - Player ID
   * @param {string} matchId - Match ID
   */
  enableSpectatorMode(playerId, matchId) {
    if (!playerId || !matchId) return false;

    const player = global.Player.list[playerId];
    if (!player) return false;

    // Get match to find available targets
    const match = this.getMatch(matchId);
    if (!match) return false;

    // Get alive participants as potential spectate targets
    const availableTargets = match.participants
      .filter(p => p.alive && !p.disqualified)
      .map(p => p.id)
      .filter(id => {
        const target = global.Player.list[id];
        return target && !target.toRemove;
      });

    if (availableTargets.length === 0) {
      // No targets available
      return false;
    }

    // Set up spectator data
    this.spectators[playerId] = {
      matchId: matchId,
      currentTargetId: availableTargets[0], // Start spectating first available target
      availableTargets: availableTargets
    };

    // Mark player as spectating
    player.spectating = true;
    player.spectateMatchId = matchId;

    // Notify client
    this.sendSpectatorUpdate(playerId, availableTargets[0], availableTargets);

    console.log(`Spectator mode enabled for player ${playerId} in match ${matchId}`);
    return true;
  }

  /**
   * Disable spectator mode for a player
   * @param {string} playerId - Player ID
   */
  disableSpectatorMode(playerId) {
    if (!this.spectators[playerId]) return;

    const player = global.Player.list[playerId];
    if (player) {
      player.spectating = false;
      player.spectateMatchId = null;
    }

    delete this.spectators[playerId];

    // Notify client
    const socket = global.SOCKET_LIST[playerId];
    if (socket) {
      try {
        socket.write(JSON.stringify({
          msg: 'battlegroundsSpectate',
          enabled: false
        }));
      } catch (e) {
        console.error(`Error disabling spectator mode for player ${playerId}:`, e);
      }
    }
  }

  /**
   * Switch spectator target
   * @param {string} playerId - Player ID
   * @param {string} targetId - Target player ID to spectate
   */
  switchSpectatorTarget(playerId, targetId) {
    if (!this.spectators[playerId]) return false;

    const spectator = this.spectators[playerId];
    
    // Verify target is valid and available
    if (!spectator.availableTargets.includes(targetId)) {
      return false;
    }

    const target = global.Player.list[targetId];
    if (!target || !target.alive || target.toRemove) {
      return false;
    }

    spectator.currentTargetId = targetId;
    this.sendSpectatorUpdate(playerId, targetId, spectator.availableTargets);

    return true;
  }

  /**
   * Get next available target for spectator
   * @param {string} playerId - Player ID
   */
  getNextSpectatorTarget(playerId) {
    if (!this.spectators[playerId]) return null;

    const spectator = this.spectators[playerId];
    const currentIndex = spectator.availableTargets.indexOf(spectator.currentTargetId);
    
    if (currentIndex === -1 || spectator.availableTargets.length === 0) {
      return null;
    }

    // Get next target (wrap around)
    const nextIndex = (currentIndex + 1) % spectator.availableTargets.length;
    return spectator.availableTargets[nextIndex];
  }

  /**
   * Get previous available target for spectator
   * @param {string} playerId - Player ID
   */
  getPreviousSpectatorTarget(playerId) {
    if (!this.spectators[playerId]) return null;

    const spectator = this.spectators[playerId];
    const currentIndex = spectator.availableTargets.indexOf(spectator.currentTargetId);
    
    if (currentIndex === -1 || spectator.availableTargets.length === 0) {
      return null;
    }

    // Get previous target (wrap around)
    const prevIndex = (currentIndex - 1 + spectator.availableTargets.length) % spectator.availableTargets.length;
    return spectator.availableTargets[prevIndex];
  }

  /**
   * Update spectator targets list (remove dead/disqualified players)
   * @param {string} matchId - Match ID
   */
  updateSpectatorTargets(matchId) {
    const match = this.getMatch(matchId);
    if (!match) return;

    // Update available targets for all spectators of this match
    Object.keys(this.spectators).forEach(playerId => {
      const spectator = this.spectators[playerId];
      if (spectator.matchId !== matchId) return;

      // Get current alive participants
      const availableTargets = match.participants
        .filter(p => p.alive && !p.disqualified)
        .map(p => p.id)
        .filter(id => {
          const target = global.Player.list[id];
          return target && !target.toRemove;
        });

      // Update available targets
      spectator.availableTargets = availableTargets;

      // If current target is no longer available, switch to first available
      if (availableTargets.length > 0 && !availableTargets.includes(spectator.currentTargetId)) {
        spectator.currentTargetId = availableTargets[0];
        this.sendSpectatorUpdate(playerId, spectator.currentTargetId, availableTargets);
      } else if (availableTargets.length === 0) {
        // No targets left, disable spectator mode
        this.disableSpectatorMode(playerId);
      }
    });
  }

  /**
   * Send spectator update to client
   */
  sendSpectatorUpdate(playerId, targetId, availableTargets) {
    const socket = global.SOCKET_LIST[playerId];
    if (!socket) return;

    const target = global.Player.list[targetId];
    if (!target) return;

    try {
      socket.write(JSON.stringify({
        msg: 'battlegroundsSpectate',
        enabled: true,
        matchId: this.spectators[playerId]?.matchId,
        targetId: targetId,
        targetName: target.name || target.class || 'Unknown',
        targetPosition: {
          x: target.x,
          y: target.y,
          z: target.z
        },
        availableTargets: availableTargets.map(id => {
          const t = global.Player.list[id];
          return {
            id: id,
            name: t ? (t.name || t.class || 'Unknown') : 'Unknown'
          };
        })
      }));

      // Also send target's current position immediately
      socket.write(JSON.stringify({
        msg: 'spectatorTargetUpdate',
        targetId: targetId,
        x: target.x,
        y: target.y,
        z: target.z
      }));
    } catch (e) {
      console.error(`Error sending spectator update to player ${playerId}:`, e);
    }
  }

  /**
   * Start spectator update interval for a match
   */
  startSpectatorUpdates(matchId) {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.updateSpectators(matchId);
    }, this.updateIntervalMs);
  }

  /**
   * Stop spectator update interval
   */
  stopSpectatorUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Update all spectators for a match
   */
  updateSpectators(matchId) {
    const match = this.getMatch(matchId);
    if (!match || match.status !== 'in_progress') {
      this.stopSpectatorUpdates();
      return;
    }

    // Update available targets
    this.updateSpectatorTargets(matchId);

    // Send position updates for all spectators' current targets
    Object.keys(this.spectators).forEach(playerId => {
      const spectator = this.spectators[playerId];
      if (spectator.matchId !== matchId) return;

      const target = global.Player.list[spectator.currentTargetId];
      if (target && !target.toRemove) {
        const socket = global.SOCKET_LIST[playerId];
        if (socket) {
          try {
            socket.write(JSON.stringify({
              msg: 'spectatorTargetUpdate',
              targetId: target.id,
              x: target.x,
              y: target.y,
              z: target.z
            }));
          } catch (e) {
            console.error(`Error sending spectator target update to player ${playerId}:`, e);
          }
        }
      }
    });
  }

  /**
   * Cleanup all spectators for a match
   */
  cleanupMatchSpectators(matchId) {
    Object.keys(this.spectators).forEach(playerId => {
      const spectator = this.spectators[playerId];
      if (spectator.matchId === matchId) {
        this.disableSpectatorMode(playerId);
      }
    });

    this.stopSpectatorUpdates();
  }

  /**
   * Get match by ID
   */
  getMatch(matchId) {
    if (global.battlegroundsMatchManager) {
      return global.battlegroundsMatchManager.getMatch(matchId);
    }
    return null;
  }

  /**
   * Subscribe to battleground events (if event manager exists)
   */
  subscribeToBattlegroundEvents(matchId) {
    // This would integrate with the event manager to subscribe to battleground-specific events
    // For now, we'll handle updates manually via the update interval
    // TODO: Integrate with event manager if needed for more granular event subscriptions
  }

  /**
   * Unsubscribe from battleground events
   */
  unsubscribeFromBattlegroundEvents(matchId) {
    // TODO: Clean up event subscriptions if implemented
  }
}

module.exports = BattlegroundsSpectatorSystem;




