/**
 * SkirmishMode - Two teams, elimination-based
 */

const BaseGameMode = require('./BaseGameMode');

class SkirmishMode extends BaseGameMode {
  constructor(matchManager) {
    super(matchManager);
    this.name = 'skirmish';
  }

  /**
   * Initialize the game mode with match data
   * @param {object} match - Current match object
   */
  init(match) {
    super.init(match);
  }

  /**
   * Get available maps for Skirmish (all except Islands)
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
    
    // Find team spawn areas
    const team1Area = mapSpawnPoints.find(sp => sp.team === 'team1');
    const team2Area = mapSpawnPoints.find(sp => sp.team === 'team2');
    
    if (!team1Area || !team2Area) {
      console.warn('Team spawn areas not found in mapData, using fallback');
      return this.getFallbackSpawnPoints();
    }

    // Assign spawn points to team members
    const team1Players = participants.filter(p => p.team === 'team1');
    const team2Players = participants.filter(p => p.team === 'team2');
    
    const startingZ = this.match.mapData.startingZ || 0;
    
    team1Players.forEach((participant, index) => {
      const point = team1Area.points[index % team1Area.points.length];
      if (point) {
        spawnPoints[participant.id] = {
          x: point.x,
          y: point.y,
          z: point.z !== undefined ? point.z : startingZ // Use point.z if valid, otherwise use startingZ
        };
      }
    });
    
    team2Players.forEach((participant, index) => {
      const point = team2Area.points[index % team2Area.points.length];
      if (point) {
        spawnPoints[participant.id] = {
          x: point.x,
          y: point.y,
          z: point.z !== undefined ? point.z : startingZ // Use point.z if valid, otherwise use startingZ
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
    
    const team1Players = participants.filter(p => p.team === 'team1');
    const team2Players = participants.filter(p => p.team === 'team2');
    
    const leftSpawnX = mapBounds * 0.2;
    team1Players.forEach((participant, index) => {
      const spacing = (mapBounds * 0.6) / (team1Players.length + 1);
      const y = centerY - ((team1Players.length - 1) * spacing / 2) + (index * spacing);
      spawnPoints[participant.id] = {
        x: leftSpawnX,
        y: Math.max(0, Math.min(mapBounds, y)),
        z: this.match.mapData.startingZ || 0
      };
    });
    
    const rightSpawnX = mapBounds * 0.8;
    team2Players.forEach((participant, index) => {
      const spacing = (mapBounds * 0.6) / (team2Players.length + 1);
      const y = centerY - ((team2Players.length - 1) * spacing / 2) + (index * spacing);
      spawnPoints[participant.id] = {
        x: rightSpawnX,
        y: Math.max(0, Math.min(mapBounds, y)),
        z: this.match.mapData.startingZ || 0
      };
    });
    
    return spawnPoints;
  }

  /**
   * Check win condition - team elimination
   */
  checkWinCondition() {
    if (!this.match) return null;
    
    const team1Alive = this.match.participants.filter(p => p.team === 'team1' && p.alive);
    const team2Alive = this.match.participants.filter(p => p.team === 'team2' && p.alive);
    
    if (team1Alive.length === 0 && team2Alive.length > 0) {
      return {
        winner: 'team2',
        winnerType: 'team',
        reason: 'team_elimination',
        message: 'Team 2 wins!'
      };
    }
    
    if (team2Alive.length === 0 && team1Alive.length > 0) {
      return {
        winner: 'team1',
        winnerType: 'team',
        reason: 'team_elimination',
        message: 'Team 1 wins!'
      };
    }
    
    if (team1Alive.length === 0 && team2Alive.length === 0) {
      return {
        winner: null,
        winnerType: null,
        reason: 'draw',
        message: 'Draw - both teams eliminated'
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
    // Skirmish doesn't need special update logic
    // Win condition is checked on death
  }
}

module.exports = SkirmishMode;

