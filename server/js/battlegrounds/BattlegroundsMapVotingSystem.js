/**
 * BattlegroundsMapVotingSystem - Handles map voting at the end of matches
 * Players can vote to save a map as a Classic Map, or vote on existing Classic Maps
 */

class BattlegroundsMapVotingSystem {
  constructor() {
    this.activeVotes = {}; // {matchId: {mapId: string, votes: {playerId: 'yes'|'no'|null}, humanPlayers: [playerId]}}
    this.votingDuration = 10 * 1000; // 10 seconds (matches post-game cooldown)
  }

  /**
   * Start voting for a map after match ends
   * @param {string} matchId - Match ID
   * @param {object} match - Match object with mapData, participants, etc.
   */
  startVoting(matchId, match) {
    if (!match || !match.mapData) {
      console.warn('Cannot start voting: invalid match or map data');
      return;
    }

    // Get list of human players (exclude NPCs)
    const humanPlayers = match.participants
      .filter(p => !p.isNPC)
      .map(p => p.id);

    if (humanPlayers.length === 0) {
      console.log('No human players to vote, skipping map voting');
      return;
    }

    // Determine if this is a Classic Map or a new map
    const mapId = match.mapData.classicMapId || null;
    const isClassicMap = mapId !== null;

    this.activeVotes[matchId] = {
      mapId: mapId, // null if new map, otherwise the Classic Map ID
      isClassicMap: isClassicMap,
      votes: {}, // {playerId: 'yes'|'no'|null}
      humanPlayers: humanPlayers,
      match: match, // Store match reference for saving new maps
      startTime: Date.now()
    };

    // Broadcast voting start to all participants
    this.broadcastVotingStart(matchId);

    // Set timeout to end voting
    setTimeout(() => {
      this.processVotingResults(matchId);
    }, this.votingDuration);
  }

  /**
   * Record a player's vote
   * @param {string} matchId - Match ID
   * @param {string} playerId - Player ID
   * @param {string} vote - 'yes' or 'no'
   * @returns {boolean} Success
   */
  recordVote(matchId, playerId, vote) {
    const voteData = this.activeVotes[matchId];
    if (!voteData) {
      console.warn(`No active voting for match ${matchId}`);
      return false;
    }

    // Check if player is a human participant
    if (!voteData.humanPlayers.includes(playerId)) {
      console.warn(`Player ${playerId} is not a human participant in match ${matchId}`);
      return false;
    }

    // Validate vote
    if (vote !== 'yes' && vote !== 'no') {
      console.warn(`Invalid vote: ${vote}. Must be 'yes' or 'no'`);
      return false;
    }

    // Record vote
    voteData.votes[playerId] = vote;

    // Broadcast vote update
    this.broadcastVoteUpdate(matchId);

    console.log(`Player ${playerId} voted ${vote} for map in match ${matchId}`);
    return true;
  }

  /**
   * Process voting results when voting period ends
   * @param {string} matchId - Match ID
   */
  processVotingResults(matchId) {
    const voteData = this.activeVotes[matchId];
    if (!voteData) {
      return; // Voting already processed or never started
    }

    const { mapId, isClassicMap, votes, humanPlayers, match } = voteData;

    // Count votes
    const yesVotes = Object.values(votes).filter(v => v === 'yes').length;
    const noVotes = Object.values(votes).filter(v => v === 'no').length;
    const totalVotes = yesVotes + noVotes;
    const totalHumanPlayers = humanPlayers.length;

    // Determine if majority voted yes (more than 50% of human players)
    const majorityYes = yesVotes > (totalHumanPlayers / 2);

    // For Classic Maps: if 100% voted yes, increment positiveVotes counter
    if (isClassicMap && mapId) {
      if (yesVotes === totalHumanPlayers && totalVotes === totalHumanPlayers) {
        // 100% positive votes - increment positiveVotes counter
        if (global.battlegroundsMapLibrary) {
          global.battlegroundsMapLibrary.incrementPositiveVotes(mapId);
          console.log(`Classic Map ${mapId} received 100% positive votes, incrementing positiveVotes counter`);
        }
      }
    } else {
      // For new maps: if majority voted yes, save as Classic Map
      if (majorityYes && match && match.mapData) {
        this.saveMapAsClassic(match);
      }
    }

    // Broadcast voting results
    this.broadcastVotingResults(matchId, {
      yesVotes,
      noVotes,
      totalVotes,
      totalHumanPlayers,
      majorityYes,
      saved: !isClassicMap && majorityYes,
      positiveVotesIncremented: isClassicMap && yesVotes === totalHumanPlayers && totalVotes === totalHumanPlayers
    });

    // Clean up
    delete this.activeVotes[matchId];
  }

  /**
   * Save a map as a Classic Map
   * @param {object} match - Match object
   */
  saveMapAsClassic(match) {
    if (!global.battlegroundsMapLibrary || !match.mapData) {
      console.error('Cannot save map: map library or map data missing');
      return;
    }

    const { mapData, gameMode } = match;
    
    // Generate unique map ID
    const mapId = global.battlegroundsMapLibrary.generateMapId(gameMode, mapData.mapType);

    // Get post-processing info from current game mode
    let postProcessing = null;
    if (match.currentGameMode) {
      // Store game mode-specific post-processing details
      // This allows the map to be reused with the same post-processing
      postProcessing = {
        gameMode: gameMode,
        // Store any game mode-specific data that was applied
        // (e.g., spawn points, capture point location, etc.)
      };
    }

    // Save the map
    const success = global.battlegroundsMapLibrary.saveClassicMap(mapId, mapData, {
      gameMode: gameMode,
      postProcessing: postProcessing,
      createdBy: 'voting', // Indicates this was saved via voting
      votes: 1, // Initial vote count
      timesPlayed: 0 // Will be incremented when used
    });

    if (success) {
      console.log(`Saved new Classic Map: ${mapId} for ${gameMode} (${mapData.mapSize}x${mapData.mapSize})`);
      
      // Broadcast to all participants
      match.participants.forEach(participant => {
        const socket = global.SOCKET_LIST[participant.id];
        if (socket) {
          socket.write(JSON.stringify({
            msg: 'addToChat',
            message: `<i><span style="color:#00ff00;">Map saved as Classic Map!</span></i>`
          }));
        }
      });
    } else {
      console.error(`Failed to save Classic Map: ${mapId}`);
    }
  }

  /**
   * Broadcast voting start to all participants
   * @param {string} matchId - Match ID
   */
  broadcastVotingStart(matchId) {
    const voteData = this.activeVotes[matchId];
    if (!voteData) return;

    const { match, isClassicMap, mapId } = voteData;
    const message = JSON.stringify({
      msg: 'battlegroundsVotingStart',
      matchId: matchId,
      isClassicMap: isClassicMap,
      mapId: mapId,
      votingDuration: this.votingDuration,
      mapType: match.mapData.mapType,
      mapSize: match.mapData.mapSize
    });

    match.participants.forEach(participant => {
      const socket = global.SOCKET_LIST[participant.id];
      if (socket) {
        try {
          socket.write(message);
        } catch (e) {
          console.error(`Error broadcasting voting start to participant ${participant.id}:`, e);
        }
      }
    });
  }

  /**
   * Broadcast vote update to all participants
   * @param {string} matchId - Match ID
   */
  broadcastVoteUpdate(matchId) {
    const voteData = this.activeVotes[matchId];
    if (!voteData) return;

    const { match, votes, humanPlayers } = voteData;
    const yesVotes = Object.values(votes).filter(v => v === 'yes').length;
    const noVotes = Object.values(votes).filter(v => v === 'no').length;
    const totalVotes = yesVotes + noVotes;
    const remainingVotes = humanPlayers.length - totalVotes;

    const message = JSON.stringify({
      msg: 'battlegroundsVotingUpdate',
      matchId: matchId,
      yesVotes: yesVotes,
      noVotes: noVotes,
      totalVotes: totalVotes,
      remainingVotes: remainingVotes,
      totalHumanPlayers: humanPlayers.length
    });

    match.participants.forEach(participant => {
      const socket = global.SOCKET_LIST[participant.id];
      if (socket) {
        try {
          socket.write(message);
        } catch (e) {
          console.error(`Error broadcasting vote update to participant ${participant.id}:`, e);
        }
      }
    });
  }

  /**
   * Broadcast voting results to all participants
   * @param {string} matchId - Match ID
   * @param {object} results - Voting results
   */
  broadcastVotingResults(matchId, results) {
    const voteData = this.activeVotes[matchId];
    if (!voteData) return;

    const { match } = voteData;
    const message = JSON.stringify({
      msg: 'battlegroundsVotingResults',
      matchId: matchId,
      results: results
    });

    match.participants.forEach(participant => {
      const socket = global.SOCKET_LIST[participant.id];
      if (socket) {
        try {
          socket.write(message);
        } catch (e) {
          console.error(`Error broadcasting voting results to participant ${participant.id}:`, e);
        }
      }
    });
  }

  /**
   * Get current voting state for a match
   * @param {string} matchId - Match ID
   * @returns {object|null} Voting state or null
   */
  getVotingState(matchId) {
    const voteData = this.activeVotes[matchId];
    if (!voteData) return null;

    const { votes, humanPlayers, isClassicMap, mapId } = voteData;
    const yesVotes = Object.values(votes).filter(v => v === 'yes').length;
    const noVotes = Object.values(votes).filter(v => v === 'no').length;
    const totalVotes = yesVotes + noVotes;
    const remainingVotes = humanPlayers.length - totalVotes;
    const remainingTime = Math.max(0, this.votingDuration - (Date.now() - voteData.startTime));

    return {
      isClassicMap: isClassicMap,
      mapId: mapId,
      yesVotes: yesVotes,
      noVotes: noVotes,
      totalVotes: totalVotes,
      remainingVotes: remainingVotes,
      totalHumanPlayers: humanPlayers.length,
      remainingTime: remainingTime
    };
  }

  /**
   * Clean up voting for a match (if voting was interrupted)
   * @param {string} matchId - Match ID
   */
  cleanup(matchId) {
    if (this.activeVotes[matchId]) {
      delete this.activeVotes[matchId];
      console.log(`Cleaned up voting for match ${matchId}`);
    }
  }
}

module.exports = BattlegroundsMapVotingSystem;





