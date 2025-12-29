/**
 * BattlegroundsLobbyManager - Manages lobby state, player queues, and matchmaking
 */

class BattlegroundsLobbyManager {
  constructor() {
    this.MAX_PLAYERS = 10;
    this.COUNTDOWN_TIME = 15; // seconds
    this.lobbyState = {
      players: [], // Array of {id, name, team: null|'team1'|'team2'}
      waitingList: [], // Array of player IDs
      gameMode: null, // 'deathmatch' | 'skirmish' | 'assault'
      countdownTimer: 0,
      status: 'waiting', // 'waiting' | 'countdown' | 'map_selection' | 'in_match'
      chatMessages: [], // Store recent lobby chat messages
      originalPlayerPositions: {} // Store player positions when they join lobby {playerId: {x, y, z, house}}
    };
    
    this.countdownInterval = null;
    this.gameModes = ['deathmatch', 'skirmish', 'assault'];
    this.onGameModeSelectedCallback = null;
    this.onMatchStartCallback = null;
    this.matchManager = null;
  }

  /**
   * Join the lobby
   * @param {string} playerId - Player ID
   * @param {string} playerName - Player name
   * @returns {object} Result object with status and message
   */
  joinLobby(playerId, playerName) {
    // Check if player is already in lobby
    const existingPlayer = this.lobbyState.players.find(p => p.id === playerId);
    if (existingPlayer) {
      return { success: true, message: 'Already in lobby', alreadyInLobby: true };
    }

    // Check if lobby is full
    if (this.lobbyState.players.length >= this.MAX_PLAYERS) {
      // Add to waiting list
      if (!this.lobbyState.waitingList.includes(playerId)) {
        this.lobbyState.waitingList.push(playerId);
      }
      this.broadcastLobbyUpdate();
      return { success: true, message: 'Added to waiting list', inWaitingList: true };
    }

    // Get player data for portrait
    const player = global.Player.list[playerId];
    const playerClass = player ? (player.class || 'SerfM') : 'SerfM';
    const playerSex = player ? (player.sex || 'm') : 'm';

    // IMPORTANT: Store player's original position when joining lobby
    // This ensures we restore them to the correct position after match ends
    if (player) {
      this.lobbyState.originalPlayerPositions[playerId] = {
        x: player.x,
        y: player.y,
        z: player.z,
        house: player.house
      };
      console.log(`Stored original position for player ${playerId} when joining lobby: x=${player.x}, y=${player.y}, z=${player.z}, house=${player.house}`);
    }

    // Add to lobby
    this.lobbyState.players.push({
      id: playerId,
      name: playerName,
      team: null,
      class: playerClass,
      sex: playerSex
    });

    // If this is the first player, start game mode selection and countdown
    if (this.lobbyState.players.length === 1 && this.lobbyState.status === 'waiting') {
      this.randomizeGameMode();
      this.startCountdown();
    }

    this.broadcastLobbyUpdate();
    this.broadcastLobbyChat(`${playerName} joined the lobby`, 'system');

    return { success: true, message: 'Joined lobby', inLobby: true };
  }

  /**
   * Leave the lobby
   * @param {string} playerId - Player ID
   */
  leaveLobby(playerId) {
    const playerIndex = this.lobbyState.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
      const player = this.lobbyState.players[playerIndex];
      this.lobbyState.players.splice(playerIndex, 1);
      
      // Move first waiting player into lobby if available
      if (this.lobbyState.waitingList.length > 0 && this.lobbyState.status !== 'in_match') {
        const waitingPlayerId = this.lobbyState.waitingList.shift();
        const waitingPlayer = global.Player.list[waitingPlayerId];
        if (waitingPlayer) {
          this.lobbyState.players.push({
            id: waitingPlayerId,
            name: waitingPlayer.name || 'Player',
            team: null
          });
        }
      }

      this.broadcastLobbyUpdate();
      this.broadcastLobbyChat(`${player.name} left the lobby`, 'system');
    } else {
      // Check waiting list
      const waitingIndex = this.lobbyState.waitingList.indexOf(playerId);
      if (waitingIndex !== -1) {
        this.lobbyState.waitingList.splice(waitingIndex, 1);
        this.broadcastLobbyUpdate();
      }
    }
  }

  /**
   * Select team for Skirmish/Assault modes
   * @param {string} playerId - Player ID
   * @param {string} team - 'team1' or 'team2'
   */
  selectTeam(playerId, team) {
    if (this.lobbyState.gameMode === 'deathmatch') {
      return { success: false, message: 'Team selection not available in Deathmatch' };
    }

    if (team !== 'team1' && team !== 'team2') {
      return { success: false, message: 'Invalid team' };
    }

    const player = this.lobbyState.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, message: 'Player not in lobby' };
    }

    // Only allow team selection during countdown and before match starts
    if (this.lobbyState.status !== 'countdown' && this.lobbyState.status !== 'waiting') {
      return { success: false, message: 'Cannot change team now' };
    }

    player.team = team;
    this.broadcastLobbyUpdate();
    return { success: true, message: `Joined ${team}` };
  }

  /**
   * Randomize game mode
   */
  randomizeGameMode() {
    const availableModes = this.getAvailableModes();
    if (availableModes.length === 0) {
      this.lobbyState.gameMode = 'deathmatch'; // Fallback
      return;
    }
    
    const randomIndex = Math.floor(Math.random() * availableModes.length);
    this.lobbyState.gameMode = availableModes[randomIndex];
    
    // Auto-assign teams for Skirmish/Assault
    if (this.lobbyState.gameMode === 'skirmish' || this.lobbyState.gameMode === 'assault') {
      this.autoAssignTeams();
    }
  }

  /**
   * Get available game modes based on player count
   */
  getAvailableModes() {
    // All modes available for now, can add restrictions later
    return this.gameModes;
  }

  /**
   * Auto-assign teams for Skirmish/Assault
   */
  autoAssignTeams() {
    const players = this.lobbyState.players;
    for (let i = 0; i < players.length; i++) {
      if (!players[i].team) {
        players[i].team = (i % 2 === 0) ? 'team1' : 'team2';
      }
    }
  }

  /**
   * Start countdown timer
   */
  startCountdown() {
    if (this.lobbyState.status !== 'waiting' && this.lobbyState.status !== 'countdown') {
      return;
    }

    this.lobbyState.status = 'countdown';
    this.lobbyState.countdownTimer = this.COUNTDOWN_TIME;

    // Clear existing interval if any
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    this.countdownInterval = setInterval(() => {
      this.lobbyState.countdownTimer--;
      this.broadcastLobbyUpdate();

      if (this.lobbyState.countdownTimer <= 0) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
        this.startMatch();
      }
    }, 1000);
  }

  /**
   * Start the match
   */
  startMatch() {
    if (this.lobbyState.status === 'in_match') {
      return; // Already started
    }

    // Lock teams
    if (this.lobbyState.gameMode === 'skirmish' || this.lobbyState.gameMode === 'assault') {
      // Ensure all players have teams
      this.autoAssignTeams();
      
      // Check minimum players for Skirmish (requires at least 2 players, 1 per team)
      if (this.lobbyState.gameMode === 'skirmish') {
        const team1Count = this.lobbyState.players.filter(p => p.team === 'team1').length;
        const team2Count = this.lobbyState.players.filter(p => p.team === 'team2').length;
        
        if (team1Count === 0 || team2Count === 0) {
          // Not enough players - match manager will spawn NPCs to fill teams
          // This is handled in BattlegroundsMatchManager.startMatch()
          console.log(`Skirmish match starting with ${team1Count} team1 and ${team2Count} team2 players. NPCs will be spawned to balance teams.`);
        }
      }
    }

    this.lobbyState.status = 'in_match';
    this.broadcastLobbyUpdate();

    // Notify match manager to start match
    // Pass original player positions stored when they joined the lobby
    if (this.matchManager) {
      this.matchManager.startMatch({
        players: this.lobbyState.players.map(p => ({ id: p.id, name: p.name, team: p.team })),
        gameMode: this.lobbyState.gameMode,
        originalPlayerPositions: this.lobbyState.originalPlayerPositions // Pass stored positions
      }).catch(err => {
        console.error('Error starting match:', err);
        this.resetLobby();
      });
    } else if (this.onMatchStartCallback) {
      this.onMatchStartCallback({
        players: this.lobbyState.players.map(p => ({ id: p.id, name: p.name, team: p.team })),
        gameMode: this.lobbyState.gameMode
      });
    }
  }

  /**
   * Reset lobby after match ends
   */
  resetLobby() {
    this.lobbyState.players = [];
    this.lobbyState.waitingList = [];
    this.lobbyState.gameMode = null;
    this.lobbyState.countdownTimer = 0;
    this.lobbyState.status = 'waiting';
    this.lobbyState.chatMessages = [];
    this.lobbyState.originalPlayerPositions = {}; // Clear stored positions

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    // Move waiting list players into lobby
    while (this.lobbyState.waitingList.length > 0 && this.lobbyState.players.length < this.MAX_PLAYERS) {
      const waitingPlayerId = this.lobbyState.waitingList.shift();
      const waitingPlayer = global.Player.list[waitingPlayerId];
      if (waitingPlayer) {
        this.lobbyState.players.push({
          id: waitingPlayerId,
          name: waitingPlayer.name || 'Player',
          team: null
        });
      }
    }

    // If players in lobby, start new countdown
    if (this.lobbyState.players.length > 0) {
      this.randomizeGameMode();
      this.startCountdown();
    }

    this.broadcastLobbyUpdate();
  }

  /**
   * Send lobby chat message
   * @param {string} playerId - Player ID
   * @param {string} message - Chat message
   */
  sendLobbyChat(playerId, message) {
    const player = this.lobbyState.players.find(p => p.id === playerId);
    if (!player) {
      // Check if in waiting list (they can still chat)
      const isWaiting = this.lobbyState.waitingList.includes(playerId);
      if (!isWaiting) {
        return { success: false, message: 'Not in lobby' };
      }
    }

    const chatMessage = {
      playerId: playerId,
      playerName: player ? player.name : (global.Player.list[playerId]?.name || 'Player'),
      message: message,
      timestamp: Date.now()
    };

    this.lobbyState.chatMessages.push(chatMessage);
    
    // Keep only last 50 messages
    if (this.lobbyState.chatMessages.length > 50) {
      this.lobbyState.chatMessages.shift();
    }

    this.broadcastLobbyChat(chatMessage.message, chatMessage.playerName, chatMessage.playerId);
    return { success: true };
  }

  /**
   * Broadcast lobby chat to all lobby participants and waiting list
   * Routes through existing game chat system instead of separate chat box
   */
  broadcastLobbyChat(message, sender, senderId = null) {
    const allParticipants = [
      ...this.lobbyState.players.map(p => p.id),
      ...this.lobbyState.waitingList
    ];

    // Format message for game chat
    let formattedMessage = '';
    if (sender === 'system') {
      formattedMessage = `<i style="color: #aaa;">[Battlegrounds] ${message}</i>`;
    } else {
      formattedMessage = `<b style="color: #00ff00;">[Battlegrounds] ${sender}:</b> ${message}`;
    }

    for (const playerId of allParticipants) {
      const socket = global.SOCKET_LIST[playerId];
      if (socket) {
        // Use existing game chat system
        socket.write(JSON.stringify({
          msg: 'addToChat',
          message: formattedMessage
        }));
      }
    }
  }

  /**
   * Broadcast lobby state update to all participants
   */
  broadcastLobbyUpdate() {
    const allParticipants = [
      ...this.lobbyState.players.map(p => p.id),
      ...this.lobbyState.waitingList
    ];

    // Merge NPCs from match participants if match exists
    let allPlayers = [...this.lobbyState.players];
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BattlegroundsLobbyManager.js:377',message:'broadcastLobbyUpdate checking match',data:{hasMatchManager:!!this.matchManager,hasCurrentMatch:!!this.matchManager?.currentMatch,hasParticipants:!!this.matchManager?.currentMatch?.participants,participantsCount:this.matchManager?.currentMatch?.participants?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    if (this.matchManager && this.matchManager.currentMatch && this.matchManager.currentMatch.participants) {
      const matchNPCs = this.matchManager.currentMatch.participants
        .filter(p => p.isNPC)
        .map(npc => ({
          id: npc.id,
          name: npc.name || 'NPC',
          class: npc.class || 'SerfM',
          sex: npc.sex || 'm',
          team: npc.team || null,
          isNPC: true
        }));
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BattlegroundsLobbyManager.js:389',message:'Found NPCs in match participants',data:{matchNPCsCount:matchNPCs.length,matchNPCsIds:matchNPCs.map(n=>n.id),allPlayersCountBefore:allPlayers.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      // Add NPCs that aren't already in the players list
      for (const npc of matchNPCs) {
        if (!allPlayers.find(p => p.id === npc.id)) {
          allPlayers.push(npc);
        }
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BattlegroundsLobbyManager.js:397',message:'NPCs merged into allPlayers',data:{allPlayersCountAfter:allPlayers.length,npcPlayers:allPlayers.filter(p=>p.isNPC).map(p=>({id:p.id,name:p.name}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
    }

    const lobbyData = {
      players: allPlayers,
      participants: allPlayers, // Also include as participants for compatibility
      waitingList: this.lobbyState.waitingList.length,
      gameMode: this.lobbyState.gameMode,
      countdownTimer: this.lobbyState.countdownTimer,
      status: this.lobbyState.status
    };

    for (const playerId of allParticipants) {
      const socket = global.SOCKET_LIST[playerId];
      if (socket) {
        socket.write(JSON.stringify({
          msg: 'battlegroundsLobbyUpdate',
          lobby: lobbyData
        }));
      }
    }
  }

  /**
   * Get lobby state for a specific player
   */
  getLobbyState(playerId) {
    const isInLobby = this.lobbyState.players.some(p => p.id === playerId);
    const isWaiting = this.lobbyState.waitingList.includes(playerId);

    return {
      ...this.lobbyState,
      isInLobby: isInLobby,
      isWaiting: isWaiting,
      playerTeam: isInLobby ? this.lobbyState.players.find(p => p.id === playerId)?.team : null
    };
  }

  /**
   * Set callback for when match should start
   */
  setMatchStartCallback(callback) {
    this.onMatchStartCallback = callback;
  }

  /**
   * Set match manager
   */
  setMatchManager(matchManager) {
    this.matchManager = matchManager;
  }

  /**
   * Check if player is in lobby
   */
  isPlayerInLobby(playerId) {
    return this.lobbyState.players.some(p => p.id === playerId);
  }

  /**
   * Get player count
   */
  getPlayerCount() {
    return this.lobbyState.players.length;
  }
}

module.exports = BattlegroundsLobbyManager;

