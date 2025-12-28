// Poker Game Manager - Handles invitations, game sessions, and location validation
const { getPlayersInRadius } = require('../core/IterationHelpers.js');

class PokerGameManager {
  constructor() {
    this.activeGames = {}; // sessionId -> game object (managed by TexasHoldEm)
    this.pendingInvitations = {}; // playerId -> { inviterId, sessionId, timestamp }
    this.playerCooldowns = {}; // playerId -> lastUseTimestamp
    this.playerSessions = {}; // playerId -> sessionId (which game they're in)
    this.invitationTimeouts = {}; // sessionId -> timeout handle
  }
  
  // Check if player is in a tavern
  isPlayerInTavern(playerId) {
    const player = global.Player.list[playerId];
    if (!player) return false;
    
    // Check if player is on ground floor (z=1) of a building
    if (player.z !== 1) return false;
    
    // Get building at player location
    const buildingId = global.getBuilding(player.x, player.y);
    if (!buildingId) return false;
    
    const building = global.Building.list[buildingId];
    if (!building) return false;
    
    // Check if it's a tavern
    return building.type === 'tavern' && building.built === true;
  }
  
  // Check if player is on same z-level as another player
  isSameZLevel(playerId1, playerId2) {
    const player1 = global.Player.list[playerId1];
    const player2 = global.Player.list[playerId2];
    if (!player1 || !player2) return false;
    return player1.z === player2.z;
  }
  
  // Validate player location (in tavern, same z-level as game)
  validatePlayerLocation(playerId, sessionId) {
    const game = this.activeGames[sessionId];
    if (!game) return false;
    
    if (!this.isPlayerInTavern(playerId)) return false;
    
    // Check if player is on same z-level as other players in game
    const gamePlayers = game.getPlayers();
    if (gamePlayers.length === 0) return false;
    
    const firstPlayer = gamePlayers[0];
    return this.isSameZLevel(playerId, firstPlayer);
  }
  
  // Check cooldown (60 seconds)
  isOnCooldown(playerId) {
    const lastUse = this.playerCooldowns[playerId];
    if (!lastUse) return false;
    return (Date.now() - lastUse) < 60000; // 60 seconds
  }
  
  // Check if player is already in a game
  isPlayerInGame(playerId) {
    return this.playerSessions[playerId] !== undefined;
  }
  
  // Create invitation session
  createInvitation(playerId) {
    const player = global.Player.list[playerId];
    const socket = global.SOCKET_LIST[playerId];
    
    if (!player || !socket) {
      return { success: false, message: 'Player not found' };
    }
    
    // Check cooldown
    if (this.isOnCooldown(playerId)) {
      const remaining = Math.ceil((60000 - (Date.now() - this.playerCooldowns[playerId])) / 1000);
      return { success: false, message: `You must wait ${remaining} more seconds before starting another game.` };
    }
    
    // Check if already in a game
    if (this.isPlayerInGame(playerId)) {
      return { success: false, message: 'You are already in a poker game.' };
    }
    
    // Check if player is in tavern
    if (!this.isPlayerInTavern(playerId)) {
      return { success: false, message: 'You must be inside a tavern to play poker.' };
    }
    
    // Find nearby players and NPCs (same z-level, within ~320 pixels / 5 tiles)
    const nearbyEntities = getPlayersInRadius(player.x, player.y, 320, player.z);
    const nearbyPlayers = [];
    const nearbyNPCs = [];
    
    for (const entity of nearbyEntities) {
      if (entity.id === playerId) continue; // Skip self
      
      // Check if it's an NPC (has class but no socket) or player (has socket)
      if (global.SOCKET_LIST[entity.id]) {
        // It's a player
        if (!this.isPlayerInGame(entity.id)) {
          nearbyPlayers.push(entity.id);
        }
      } else {
        // It's an NPC - check if it's a valid NPC type (not animals, etc.)
        const npcClass = entity.class;
        if (npcClass && !['Wolf', 'Boar', 'Deer'].includes(npcClass)) {
          nearbyNPCs.push(entity.id);
        }
      }
    }
    
    if (nearbyPlayers.length === 0 && nearbyNPCs.length === 0) {
      return { success: false, message: 'No nearby players or NPCs to invite.' };
    }
    
    // Create session ID
    const sessionId = `poker_${playerId}_${Date.now()}`;
    
    // Store invitation
    this.pendingInvitations[sessionId] = {
      inviterId: playerId,
      inviterName: player.name,
      sessionId: sessionId,
      timestamp: Date.now(),
      invitedPlayers: [...nearbyPlayers],
      invitedNPCs: [...nearbyNPCs],
      acceptedPlayers: [playerId], // Inviter auto-accepts
      acceptedNPCs: []
    };
    
    // Send invitations to players
    for (const invitedPlayerId of nearbyPlayers) {
      const invitedSocket = global.SOCKET_LIST[invitedPlayerId];
      if (invitedSocket) {
        invitedSocket.write(JSON.stringify({
          msg: 'pokerInvitation',
          inviterName: player.name,
          inviterId: playerId,
          sessionId: sessionId
        }));
      }
    }
    
    // NPCs have 30% chance to accept immediately
    for (const npcId of nearbyNPCs) {
      if (Math.random() < 0.30) {
        this.acceptInvitation(npcId, playerId, sessionId, true); // true = isNPC
      }
    }
    
    // Set cooldown
    this.playerCooldowns[playerId] = Date.now();
    
    // Set timeout to start game after 10 seconds
    this.invitationTimeouts[sessionId] = setTimeout(() => {
      this.startGameIfReady(sessionId);
    }, 10000);
    
    socket.write(JSON.stringify({
      msg: 'addToChat',
      message: `<i>You've invited ${nearbyPlayers.length} player(s) and ${nearbyNPCs.length} NPC(s) to play poker. Waiting for responses...</i>`
    }));
    
    return { success: true, sessionId, nearbyPlayers, nearbyNPCs };
  }
  
  // Accept invitation
  acceptInvitation(playerId, inviterId, sessionId, isNPC = false) {
    const invitation = this.pendingInvitations[sessionId];
    if (!invitation) {
      return { success: false, message: 'Invitation not found or expired.' };
    }
    
    if (invitation.inviterId !== inviterId) {
      return { success: false, message: 'Invalid invitation.' };
    }
    
    // Check if already accepted
    if (invitation.acceptedPlayers.includes(playerId) || invitation.acceptedNPCs.includes(playerId)) {
      return { success: false, message: 'You have already accepted this invitation.' };
    }
    
    // Check if player is still in tavern and on same z-level
    if (!isNPC) {
      if (!this.isPlayerInTavern(playerId)) {
        return { success: false, message: 'You must be in a tavern to join.' };
      }
      
      const inviter = global.Player.list[inviterId];
      const player = global.Player.list[playerId];
      if (!inviter || !player || inviter.z !== player.z) {
        return { success: false, message: 'You must be on the same floor as the inviter.' };
      }
    }
    
    // Add to accepted list
    if (isNPC) {
      invitation.acceptedNPCs.push(playerId);
    } else {
      invitation.acceptedPlayers.push(playerId);
    }
    
    // Notify inviter
    const inviterSocket = global.SOCKET_LIST[inviterId];
    const acceptingPlayer = global.Player.list[playerId];
    if (inviterSocket && acceptingPlayer) {
      inviterSocket.write(JSON.stringify({
        msg: 'addToChat',
        message: `<i>${acceptingPlayer.name} has accepted your poker invitation.</i>`
      }));
    }
    
    return { success: true };
  }
  
  // Decline invitation
  declineInvitation(playerId, inviterId, sessionId) {
    const invitation = this.pendingInvitations[sessionId];
    if (!invitation) return;
    
    // Remove from invited list
    const playerIndex = invitation.invitedPlayers.indexOf(playerId);
    if (playerIndex !== -1) {
      invitation.invitedPlayers.splice(playerIndex, 1);
    }
    
    // Notify inviter
    const inviterSocket = global.SOCKET_LIST[inviterId];
    const player = global.Player.list[playerId];
    if (inviterSocket && player) {
      inviterSocket.write(JSON.stringify({
        msg: 'addToChat',
        message: `<i>${player.name} has declined your poker invitation.</i>`
      }));
    }
  }
  
  // Start game if ready (called after 10 second timeout)
  startGameIfReady(sessionId) {
    const invitation = this.pendingInvitations[sessionId];
    if (!invitation) return;
    
    // Clear timeout
    if (this.invitationTimeouts[sessionId]) {
      clearTimeout(this.invitationTimeouts[sessionId]);
      delete this.invitationTimeouts[sessionId];
    }
    
    // Count total accepted players
    const totalPlayers = invitation.acceptedPlayers.length + invitation.acceptedNPCs.length;
    
    if (totalPlayers < 2) {
      // Not enough players, cancel invitation
      this.cancelInvitation(sessionId, 'Not enough players joined.');
      return;
    }
    
    // Start game
    const TexasHoldEm = require('./TexasHoldEm.js');
    const allPlayers = [...invitation.acceptedPlayers, ...invitation.acceptedNPCs];
    const game = new TexasHoldEm(sessionId, allPlayers);
    this.registerGame(sessionId, game);
    delete this.pendingInvitations[sessionId];
    
    // Start first hand
    game.broadcast(`<i>Poker game starting! ${allPlayers.length} players joined.</i>`);
    setTimeout(() => {
      game.startHand();
    }, 1000);
  }
  
  // Cancel invitation
  cancelInvitation(sessionId, reason) {
    const invitation = this.pendingInvitations[sessionId];
    if (!invitation) return;
    
    // Clear timeout
    if (this.invitationTimeouts[sessionId]) {
      clearTimeout(this.invitationTimeouts[sessionId]);
      delete this.invitationTimeouts[sessionId];
    }
    
    // Notify all accepted players
    const allPlayers = [...invitation.acceptedPlayers, ...invitation.acceptedNPCs];
    for (const playerId of allPlayers) {
      const socket = global.SOCKET_LIST[playerId];
      if (socket) {
        socket.write(JSON.stringify({
          msg: 'addToChat',
          message: `<i>Poker game cancelled: ${reason}</i>`
        }));
      }
    }
    
    // Reset cooldown for inviter
    delete this.playerCooldowns[invitation.inviterId];
    
    delete this.pendingInvitations[sessionId];
  }
  
  // Register game session
  registerGame(sessionId, gameInstance) {
    this.activeGames[sessionId] = gameInstance;
    
    // Track players in session
    const players = gameInstance.getPlayers();
    for (const playerId of players) {
      this.playerSessions[playerId] = sessionId;
    }
  }
  
  // End game and cleanup
  endGame(sessionId) {
    const game = this.activeGames[sessionId];
    if (!game) return;
    
    // Remove player session tracking
    const players = game.getPlayers();
    for (const playerId of players) {
      delete this.playerSessions[playerId];
    }
    
    // Reset cooldowns for all players
    for (const playerId of players) {
      delete this.playerCooldowns[playerId];
    }
    
    delete this.activeGames[sessionId];
  }
  
  // Get game for player
  getPlayerGame(playerId) {
    const sessionId = this.playerSessions[playerId];
    if (!sessionId) return null;
    return this.activeGames[sessionId] || null;
  }
  
  // Get pending invitation for player
  getPendingInvitation(playerId) {
    for (const sessionId in this.pendingInvitations) {
      const invitation = this.pendingInvitations[sessionId];
      if (invitation.invitedPlayers.includes(playerId)) {
        return invitation;
      }
    }
    return null;
  }
}

// Create singleton instance
const pokerGameManager = new PokerGameManager();

module.exports = pokerGameManager;

