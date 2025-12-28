/**
 * BattlegroundsScoreManager - Tracks scores and statistics
 */

class BattlegroundsScoreManager {
  constructor() {
    // Statistics storage (would integrate with database)
    this.statistics = {};
  }

  /**
   * Calculate final scores for a match
   */
  calculateFinalScores(match, endReason) {
    if (!match || !match.participants) return;
    
    match.scores = {};
    
    match.participants.forEach(participant => {
      match.scores[participant.id] = {
        kills: participant.kills || 0,
        deaths: participant.deaths || 0,
        alive: participant.alive || false,
        placement: 0 // Will be calculated
      };
    });
    
    // Calculate placements
    const sorted = [...match.participants].sort((a, b) => {
      if (match.gameMode === 'deathmatch') {
        // Sort by alive status, then kills, then deaths
        if (a.alive !== b.alive) return a.alive ? -1 : 1;
        if (a.kills !== b.kills) return b.kills - a.kills;
        return a.deaths - b.deaths;
      } else {
        // Team modes: sort by kills then deaths
        if (a.kills !== b.kills) return b.kills - a.kills;
        return a.deaths - b.deaths;
      }
    });
    
    sorted.forEach((participant, index) => {
      match.scores[participant.id].placement = index + 1;
    });
    
    // Determine winners
    if (match.gameMode === 'deathmatch') {
      const winner = sorted.find(p => p.alive);
      if (winner) {
        match.winner = winner.id;
      }
    } else if (match.gameMode === 'skirmish' || match.gameMode === 'assault') {
      // Winner is determined by endReason
      if (endReason && endReason.winner) {
        match.winner = endReason.winner;
      }
    }
  }

  /**
   * Save match statistics to player records
   */
  saveMatchStatistics(match) {
    if (!match || !match.participants) return;
    
    match.participants.forEach(participant => {
      const playerId = participant.id;
      const player = global.Player.list[playerId];
      if (!player) return;
      
      // Initialize statistics if needed
      if (!player.battlegroundsStats) {
        player.battlegroundsStats = {
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          kills: 0,
          deaths: 0,
          favoriteGameMode: {},
          favoriteMap: {}
        };
      }
      
      const stats = player.battlegroundsStats;
      stats.matchesPlayed++;
      stats.kills += participant.kills || 0;
      stats.deaths += participant.deaths || 0;
      
      // Update win/loss
      const score = match.scores[playerId];
      if (score) {
        const isWinner = match.winner === playerId || 
                        (match.winner === 'team1' && participant.team === 'team1') ||
                        (match.winner === 'team2' && participant.team === 'team2');
        
        if (isWinner) {
          stats.wins++;
        } else {
          stats.losses++;
        }
      }
      
      // Track favorite game mode and map
      stats.favoriteGameMode[match.gameMode] = (stats.favoriteGameMode[match.gameMode] || 0) + 1;
      stats.favoriteMap[match.mapType] = (stats.favoriteMap[match.mapType] || 0) + 1;
      
      // Mark player data as needing save (if save system exists)
      // The battlegroundsStats property will be persisted automatically if player data persistence is implemented
      player.battlegroundsStatsUpdated = true;
    });
  }

  /**
   * Initialize battlegrounds statistics for a player (called when player is created/loaded)
   * @param {string} playerId - Player ID
   */
  initializePlayerStats(playerId) {
    const player = global.Player.list[playerId];
    if (!player) return;
    
    // Initialize if not already present (allows loading from saved data)
    if (!player.battlegroundsStats) {
      player.battlegroundsStats = {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        kills: 0,
        deaths: 0,
        favoriteGameMode: {},
        favoriteMap: {}
      };
    }
  }

  /**
   * Get player statistics
   */
  getPlayerStatistics(playerId) {
    const player = global.Player.list[playerId];
    if (!player || !player.battlegroundsStats) {
      return {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        kills: 0,
        deaths: 0,
        winRate: 0,
        kdr: 0
      };
    }
    
    const stats = player.battlegroundsStats;
    const winRate = stats.matchesPlayed > 0 ? (stats.wins / stats.matchesPlayed) * 100 : 0;
    const kdr = stats.deaths > 0 ? stats.kills / stats.deaths : stats.kills;
    
    return {
      ...stats,
      winRate: winRate.toFixed(2),
      kdr: kdr.toFixed(2)
    };
  }

  /**
   * Get leaderboard (all players sorted by stats)
   * @param {string} sortBy - 'wins' | 'kills' | 'kdr' | 'winRate' | 'matchesPlayed'
   * @returns {Array} Array of player stats sorted by sortBy
   */
  getLeaderboard(sortBy = 'wins') {
    const leaderboard = [];
    
    // Collect stats from all players
    for (const playerId in global.Player.list) {
      const player = global.Player.list[playerId];
      if (!player || !player.battlegroundsStats) continue;
      
      const stats = this.getPlayerStatistics(playerId);
      leaderboard.push({
        playerId: playerId,
        playerName: player.name || `Player ${playerId.substring(0, 8)}`,
        ...stats,
        kdr: parseFloat(stats.kdr),
        winRate: parseFloat(stats.winRate)
      });
    }
    
    // Sort by specified field (descending)
    leaderboard.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      // Handle numeric comparisons
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return bVal - aVal;
      }
      
      // Fallback to string comparison
      return String(bVal).localeCompare(String(aVal));
    });
    
    return leaderboard;
  }
}

module.exports = BattlegroundsScoreManager;


