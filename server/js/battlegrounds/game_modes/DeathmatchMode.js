/**
 * DeathmatchMode - Free-for-all, last man standing
 */

const BaseGameMode = require('./BaseGameMode');

class DeathmatchMode extends BaseGameMode {
  constructor(matchManager) {
    super(matchManager);
    this.name = 'deathmatch';
  }

  /**
   * Initialize the game mode with match data
   * @param {object} match - Current match object
   */
  init(match) {
    super.init(match);
  }

  /**
   * Get available maps for Deathmatch (all except Islands)
   */
  getAvailableMaps() {
    return ['continental', 'mainland', 'wild', 'caves', 'dungeons'];
  }

  /**
   * Get spawn points - use spawn points calculated during post-processing
   */
  getSpawnPoints() {
    if (!this.match || !this.match.mapData) {
      return {};
    }

    // Use spawn points from mapData (calculated during post-processing)
    const mapSpawnPoints = this.match.mapData.spawnPoints || [];
    if (mapSpawnPoints.length === 0) {
      console.warn('No spawn points found in mapData, using fallback');
      return this.getFallbackSpawnPoints();
    }

    const spawnPoints = {};
    const participants = this.match.participants;
    
    // Assign spawn points to participants
    participants.forEach((participant, index) => {
      const spawnPoint = mapSpawnPoints[index % mapSpawnPoints.length];
      if (spawnPoint) {
        spawnPoints[participant.id] = {
          x: spawnPoint.x,
          y: spawnPoint.y,
          z: spawnPoint.z
        };
      }
    });
    
    return spawnPoints;
  }

  /**
   * Fallback spawn points if mapData doesn't have them
   */
  getFallbackSpawnPoints() {
    const spawnPoints = {};
    const participants = this.match.participants;
    const mapSize = this.match.mapSize;
    const tileSize = global.tileSize || 64;
    const mapBounds = mapSize * tileSize;
    const centerX = mapBounds / 2;
    const centerY = mapBounds / 2;
    
    const count = participants.length;
    const angleStep = (2 * Math.PI) / count;
    const radius = mapBounds * 0.35;
    
    participants.forEach((participant, index) => {
      const angle = index * angleStep;
      spawnPoints[participant.id] = {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        z: this.match.mapData.startingZ || 0
      };
    });
    
    return spawnPoints;
  }

  /**
   * Check win condition - last man standing
   */
  checkWinCondition() {
    if (!this.match) return null;
    
    const alivePlayers = this.match.participants.filter(p => p.alive);
    
    if (alivePlayers.length === 1) {
      return {
        winner: alivePlayers[0].id,
        winnerType: 'player',
        reason: 'last_man_standing',
        message: `${alivePlayers[0].name || 'Player'} wins!`
      };
    }
    
    if (alivePlayers.length === 0) {
      return {
        winner: null,
        winnerType: null,
        reason: 'draw',
        message: 'Draw - no survivors'
      };
    }
    
    return null;
  }

  /**
   * Handle participant death
   */
  onParticipantDeath(playerId, killerId) {
    if (!this.match) return;
    
    const participant = this.match.participants.find(p => p.id === playerId);
    if (!participant || !participant.alive) {
      return;
    }
    
    participant.alive = false;
    participant.deaths++;
    
    if (killerId) {
      const killer = this.match.participants.find(p => p.id === killerId);
      if (killer && killer.alive) {
        killer.kills++;
      }
    }
    
    // Check for win condition
    const winCondition = this.checkWinCondition();
    if (winCondition && this.matchManager) {
      this.matchManager.endMatch(winCondition);
    }
  }

  /**
   * Update logic - called periodically
   */
  update() {
    // Deathmatch doesn't need special update logic
    // Win condition is checked on death
  }
}

module.exports = DeathmatchMode;

