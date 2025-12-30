/**
 * BattlegroundsLeashManager - Prevents players from escaping combat zones in Cave/Dungeon maps
 * Uses a leashing system that warns players and disqualifies them if they leave the combat area
 */

class BattlegroundsLeashManager {
  constructor() {
    this.leashWarnings = {}; // {playerId: {warned: boolean, warningTime: number, disqualified: boolean}}
    this.leashWarningDuration = 5000; // 5 seconds warning before disqualification
    this.updateInterval = null;
    this.updateIntervalMs = 1000; // Check every second
  }

  /**
   * Start leash monitoring for a match
   */
  startLeashMonitoring(match) {
    if (!match || !match.mapData) return;

    const mapType = match.mapData.mapType || match.mapType;
    
    // Only enable leashing for Cave and Dungeon maps
    if (mapType !== 'caves' && mapType !== 'dungeons') {
      return;
    }

    // Clear previous warnings
    this.leashWarnings = {};

    // Start monitoring interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.checkLeashViolations(match);
    }, this.updateIntervalMs);

    console.log(`Leash monitoring started for ${mapType} battleground match ${match.matchId}`);
  }

  /**
   * Stop leash monitoring
   */
  stopLeashMonitoring() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.leashWarnings = {};
  }

  /**
   * Check for leash violations
   */
  checkLeashViolations(match) {
    if (!match || match.status !== 'in_progress') {
      this.stopLeashMonitoring();
      return;
    }

    const mapType = match.mapData.mapType || match.mapType;
    
    // Only check for Cave and Dungeon maps
    if (mapType !== 'caves' && mapType !== 'dungeons') {
      return;
    }

    const { participants } = match;

    participants.forEach(participant => {
      if (!participant.alive) return; // Skip dead players

      const player = global.Player.list[participant.id];
      if (!player) return;

      // Check if player is on z=0 (overworld) when they should be in caves/dungeons
      if (player.z === 0) {
        // Player has escaped to overworld
        this.handleLeashViolation(player, participant, match);
      } else {
        // Player is in correct z-level, clear any warnings
        if (this.leashWarnings[player.id]) {
          delete this.leashWarnings[player.id];
          // Notify player they're back in the combat zone
          this.sendLeashWarningCleared(player);
        }
      }
    });
  }

  /**
   * Handle leash violation (player on z=0 when they should be in combat zone)
   */
  handleLeashViolation(player, participant, match) {
    const playerId = player.id;
    const now = Date.now();

    if (!this.leashWarnings[playerId]) {
      // First violation - issue warning
      this.leashWarnings[playerId] = {
        warned: true,
        warningTime: now,
        disqualified: false
      };

      this.sendLeashWarning(player);
    } else {
      const warning = this.leashWarnings[playerId];
      
      // Check if warning time has elapsed
      const timeSinceWarning = now - warning.warningTime;
      
      if (timeSinceWarning >= this.leashWarningDuration && !warning.disqualified) {
        // Disqualify player
        this.disqualifyPlayer(player, participant, match);
      }
    }
  }

  /**
   * Send leash warning to player
   */
  sendLeashWarning(player) {
    const socket = global.SOCKET_LIST[player.id];
    if (!socket) return;

    const remainingTime = Math.ceil((this.leashWarningDuration - (Date.now() - this.leashWarnings[player.id].warningTime)) / 1000);
    
    const warningMsg = JSON.stringify({
      msg: 'addToChat',
      message: `<span style="color:#ffaa00;"><b>⚠️ WARNING: Return to combat zone!</b></span><br>` +
               `<span style="color:#ffaa00;">You have ${remainingTime} seconds to return before disqualification.</span>`
    });

    try {
      socket.write(warningMsg);
      
      // Also send a match update with warning
      socket.write(JSON.stringify({
        msg: 'battlegroundsLeashWarning',
        timeRemaining: remainingTime,
        disqualified: false
      }));
    } catch (e) {
      console.error(`Error sending leash warning to player ${player.id}:`, e);
    }
  }

  /**
   * Send notification that leash warning is cleared
   */
  sendLeashWarningCleared(player) {
    const socket = global.SOCKET_LIST[player.id];
    if (!socket) return;

    try {
      socket.write(JSON.stringify({
        msg: 'addToChat',
        message: '<span style="color:#00ff00;">✓ Returned to combat zone.</span>'
      }));

      socket.write(JSON.stringify({
        msg: 'battlegroundsLeashWarning',
        timeRemaining: 0,
        disqualified: false,
        cleared: true
      }));
    } catch (e) {
      console.error(`Error sending leash warning cleared to player ${player.id}:`, e);
    }
  }

  /**
   * Disqualify player for leaving combat zone
   */
  disqualifyPlayer(player, participant, match) {
    const warning = this.leashWarnings[player.id];
    if (!warning || warning.disqualified) return;

    warning.disqualified = true;

    // Mark participant as disqualified (treat as dead for match purposes)
    participant.alive = false;
    participant.disqualified = true;

    // Notify player
    const socket = global.SOCKET_LIST[player.id];
    if (socket) {
      try {
        socket.write(JSON.stringify({
          msg: 'addToChat',
          message: '<span style="color:#ff0000;"><b>❌ DISQUALIFIED</b></span><br>' +
                   '<span style="color:#ff0000;">You have been disqualified for leaving the combat zone.</span><br>' +
                   '<span style="color:#aaaaaa;">You can now move freely or exit the match.</span>'
        }));

        socket.write(JSON.stringify({
          msg: 'battlegroundsLeashWarning',
          timeRemaining: 0,
          disqualified: true
        }));
      } catch (e) {
        console.error(`Error sending disqualification to player ${player.id}:`, e);
      }
    }

    // Broadcast disqualification to other participants
    this.broadcastDisqualification(match, player, participant);

    // Check win condition (player is effectively dead)
    if (global.battlegroundsMatchManager && global.battlegroundsMatchManager.currentMatch) {
      const matchManager = global.battlegroundsMatchManager;
      if (matchManager.currentGameMode && matchManager.currentGameMode.checkWinCondition) {
        const winCondition = matchManager.currentGameMode.checkWinCondition();
        if (winCondition) {
          matchManager.endMatch(winCondition);
        }
      }
    }

    console.log(`Player ${player.id} disqualified from battleground match ${match.matchId} for leaving combat zone`);
  }

  /**
   * Broadcast player disqualification to all participants
   */
  broadcastDisqualification(match, player, participant) {
    if (!match || !match.participants) return;

    const message = JSON.stringify({
      msg: 'battlegroundsParticipantDisqualified',
      matchId: match.matchId,
      playerId: player.id,
      playerName: player.name || player.class || 'Player',
      reason: 'left_combat_zone'
    });

    match.participants.forEach(p => {
      const socket = global.SOCKET_LIST[p.id];
      if (socket) {
        try {
          socket.write(message);
        } catch (e) {
          console.error(`Error broadcasting disqualification to participant ${p.id}:`, e);
        }
      }
    });
  }

  /**
   * Check if a player is disqualified
   */
  isPlayerDisqualified(playerId) {
    const warning = this.leashWarnings[playerId];
    return warning && warning.disqualified;
  }

  /**
   * Get remaining warning time for a player
   */
  getWarningTimeRemaining(playerId) {
    const warning = this.leashWarnings[playerId];
    if (!warning || warning.disqualified) return 0;

    const elapsed = Date.now() - warning.warningTime;
    return Math.max(0, this.leashWarningDuration - elapsed);
  }
}

module.exports = BattlegroundsLeashManager;





