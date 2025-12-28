/**
 * AssaultMode - One team assaults the other's fortified position
 * Defenders protect a capture point, attackers try to capture it
 */

const BaseGameMode = require('./BaseGameMode');
const BattlegroundsAssaultSpawnManager = require('../BattlegroundsAssaultSpawnManager');

class AssaultMode extends BaseGameMode {
  constructor(matchManager) {
    super(matchManager);
    this.name = 'assault';
    this.match = null; // Will be set in init()
    this.capturePoint = null;
    this.captureRadius = 3; // tiles
    this.captureTime = 10; // seconds to hold
    this.captureTimer = 0;
    this.capturingTeam = null;
    this.spawnManager = new BattlegroundsAssaultSpawnManager();
  }

  /**
   * Initialize the game mode with match data
   * @param {object} match - Current match object
   */
  init(match) {
    super.init(match);
    this.match = match;
    this.initCapturePoint();
    this.initDefenderNPCs();
  }

  /**
   * Get available maps for Assault (Continental, Mainland, Islands)
   */
  getAvailableMaps() {
    return ['continental', 'mainland', 'islands'];
  }

  /**
   * Initialize capture point (should be in defender's base/dungeon)
   */
  initCapturePoint() {
    if (!this.match || !this.match.mapData) return;
    
    // Capture point should be placed in defender's stronghold/dungeon
    // For now, use center of map or a designated point
    // This will be set properly by map post-processor
    const mapSize = this.match.mapSize;
    const tileSize = global.tileSize || 64;
    const mapBounds = mapSize * tileSize;
    
    this.capturePoint = {
      x: mapBounds / 2,
      y: mapBounds / 2,
      z: this.match.mapData.startingZ || 0
    };
    
    // If map has a capture point defined, use it
    if (this.match.mapData.capturePoint) {
      this.capturePoint = { ...this.match.mapData.capturePoint };
    }
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
    
    // Find team spawn areas
    const attackerArea = mapSpawnPoints.find(sp => sp.team === 'team1');
    const defenderArea = mapSpawnPoints.find(sp => sp.team === 'team2' && sp.stronghold);
    
    if (!attackerArea || !defenderArea) {
      console.warn('Team spawn areas not found in mapData, using fallback');
      return this.getFallbackSpawnPoints();
    }

    // Update capture point from defender stronghold
    if (defenderArea.center) {
      this.capturePoint = { ...defenderArea.center };
    } else if (!this.capturePoint) {
      this.initCapturePoint();
    }

    // Assign spawn points to attackers
    const attackers = participants.filter(p => p.team === 'team1');
    attackers.forEach((participant, index) => {
      const point = attackerArea.points[index % attackerArea.points.length];
      if (point) {
        spawnPoints[participant.id] = {
          x: point.x,
          y: point.y,
          z: point.z
        };
      }
    });
    
    // Assign spawn points to defenders
    const defenders = participants.filter(p => p.team === 'team2');
    defenders.forEach((participant, index) => {
      const point = defenderArea.points[index % defenderArea.points.length];
      if (point) {
        spawnPoints[participant.id] = {
          x: point.x,
          y: point.y,
          z: point.z
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
    const centerY = mapBounds / 2;
    
    const attackers = participants.filter(p => p.team === 'team1');
    const leftSpawnX = mapBounds * 0.15;
    attackers.forEach((participant, index) => {
      const spacing = (mapBounds * 0.5) / (attackers.length + 1);
      const y = centerY - ((attackers.length - 1) * spacing / 2) + (index * spacing);
      spawnPoints[participant.id] = {
        x: leftSpawnX,
        y: Math.max(0, Math.min(mapBounds, y)),
        z: this.match.mapData.startingZ || 0
      };
    });
    
    const defenders = participants.filter(p => p.team === 'team2');
    if (!this.capturePoint) {
      this.initCapturePoint();
    }
    
    const defenderBaseX = mapBounds * 0.75; // 75% from left (defender side)
    defenders.forEach((participant, index) => {
      const spacing = (mapBounds * 0.3) / (defenders.length + 1);
      const y = centerY - ((defenders.length - 1) * spacing / 2) + (index * spacing);
      
      spawnPoints[participant.id] = {
        x: defenderBaseX,
        y: Math.max(0, Math.min(mapBounds, y)),
        z: this.capturePoint ? this.capturePoint.z : (this.match.mapData.startingZ || 0)
      };
    });
    
    return spawnPoints;
  }

  /**
   * Check if a position is within capture radius
   */
  isInCaptureRadius(x, y, z) {
    if (!this.capturePoint) return false;
    
    const dx = x - this.capturePoint.x;
    const dy = y - this.capturePoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const tileSize = global.tileSize || 64;
    
    return distance <= (this.captureRadius * tileSize) && z === this.capturePoint.z;
  }

  /**
   * Check win condition - capture point or team elimination
   */
  checkWinCondition() {
    if (!this.match) return null;
    
    // Check team elimination
    const attackersAlive = this.match.participants.filter(p => p.team === 'team1' && p.alive);
    const defendersAlive = this.match.participants.filter(p => p.team === 'team2' && p.alive);
    
    if (attackersAlive.length === 0 && defendersAlive.length > 0) {
      return {
        winner: 'team2',
        winnerType: 'team',
        reason: 'team_elimination',
        message: 'Defenders win!'
      };
    }
    
    if (defendersAlive.length === 0 && attackersAlive.length > 0) {
      return {
        winner: 'team1',
        winnerType: 'team',
        reason: 'team_elimination',
        message: 'Attackers win!'
      };
    }
    
    // Check capture point (handled in update method)
    if (this.captureTimer >= 1.0) { // Timer is normalized 0-1
      return {
        winner: this.capturingTeam,
        winnerType: 'team',
        reason: 'capture_point',
        message: `${this.capturingTeam === 'team1' ? 'Attackers' : 'Defenders'} captured the point!`
      };
    }
    
    return null;
  }

  /**
   * Update logic - check capture point
   */
  update() {
    if (!this.match || this.match.status !== 'in_progress') {
      return;
    }
    
    if (!this.capturePoint) {
      this.initCapturePoint();
      return;
    }
    
    // Count attackers and defenders in capture radius
    const attackersInRadius = [];
    const defendersInRadius = [];
    
    // Check players
    this.match.participants.forEach(participant => {
      if (!participant.alive) return;
      
      const player = global.Player.list[participant.id];
      if (!player) return;
      
      if (this.isInCaptureRadius(player.x, player.y, player.z)) {
        if (participant.team === 'team1') {
          attackersInRadius.push(participant.id);
        } else if (participant.team === 'team2') {
          defendersInRadius.push(participant.id);
        }
      }
    });
    
    // Check elite NPCs (if they're close enough)
    // TODO: Add NPC position checking when NPC system is integrated
    
    // Only attackers can capture (defenders just need to prevent capture)
    if (attackersInRadius.length > 0 && defendersInRadius.length === 0) {
      // Attackers are capturing
      if (this.capturingTeam !== 'team1') {
        this.capturingTeam = 'team1';
        this.captureTimer = 0;
      }
      
      // Increment capture timer (update is called every second, timer is normalized 0-1)
      // Increment by 1/captureTime per second (e.g., 0.1 per second for 10 second capture)
      this.captureTimer = Math.min(1.0, this.captureTimer + (1.0 / this.captureTime));
      
      // Check win condition (timer normalized 0-1)
      if (this.captureTimer >= 1.0) {
        const winCondition = this.checkWinCondition();
        if (winCondition && this.matchManager) {
          this.matchManager.endMatch(winCondition);
        }
      }
    } else {
      // Capture is contested or no attackers present
      if (this.capturingTeam === 'team1' && this.captureTimer > 0) {
        // Decay capture progress when contested (decay faster than capture rate)
        this.captureTimer = Math.max(0, this.captureTimer - (0.5 / this.captureTime));
        if (this.captureTimer <= 0) {
          this.capturingTeam = null;
        }
      } else {
        // Not capturing
        this.capturingTeam = null;
        this.captureTimer = 0;
      }
    }
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
    
    // Check for win condition (team elimination)
    const winCondition = this.checkWinCondition();
    if (winCondition && this.matchManager) {
      this.matchManager.endMatch(winCondition);
    }
  }

  /**
   * Start attacker spawn system (steady flow of basic units)
   */
  startAttackerSpawns() {
    if (this.spawnManager && this.match) {
      this.spawnManager.startAttackerSpawns(this.match);
    }
  }

  /**
   * Stop attacker spawn system
   */
  stopAttackerSpawns() {
    if (this.spawnManager) {
      this.spawnManager.stopAttackerSpawns();
    }
  }

  /**
   * Initialize defender NPCs (finite number)
   */
  initDefenderNPCs() {
    if (this.spawnManager && this.match) {
      this.spawnManager.initializeDefenders(this.match);
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stopAttackerSpawns();
    if (this.spawnManager) {
      this.spawnManager.cleanup();
    }
    this.capturePoint = null;
    this.captureTimer = 0;
    this.capturingTeam = null;
    super.cleanup();
  }
}

module.exports = AssaultMode;
