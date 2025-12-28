/**
 * BattlegroundsLobbyUI - Manages the Battlegrounds lobby UI overlay
 * Displays player list, team selection, game mode, chat, and countdown
 */

class BattlegroundsLobbyUI {
  constructor() {
    this.isActive = false;
    this.lobbyState = {
      players: [],
      participants: [],
      waitingList: [],
      gameMode: null,
      countdownTimer: 0,
      status: 'waiting'
    };
    this.container = null;
    this.chatMessages = [];
    this.socket = null; // Will be set from socket handler
  }

  /**
   * Initialize the UI container
   */
  init() {
    if (this.container) return; // Already initialized

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'battlegrounds-lobby-ui';
    this.container.style.position = 'fixed';
    this.container.style.top = '50%';
    this.container.style.left = '50%';
    this.container.style.transform = 'translate(-50%, -50%)';
    this.container.style.width = '1000px';
    this.container.style.maxWidth = '80vw';
    this.container.style.maxHeight = '75vh';
    this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
    this.container.style.border = '2px solid rgba(255, 255, 255, 0.3)';
    this.container.style.borderRadius = '10px';
    this.container.style.padding = '20px';
    this.container.style.zIndex = '2000';
    this.container.style.pointerEvents = 'auto';
    this.container.style.display = 'none';
    this.container.style.overflowY = 'auto';
    this.container.style.fontFamily = 'monospace';
    this.container.style.color = 'white';
    this.container.style.boxShadow = '0 0 30px rgba(0, 0, 0, 0.9)';

    // Add to body
    document.body.appendChild(this.container);
  }

  /**
   * Show the lobby UI
   * @param {object} lobbyState - Lobby state from server
   */
  show(lobbyState) {
    this.init();
    this.isActive = true;
    // Merge with existing state to preserve data (smart merge for arrays)
    if (lobbyState) {
      // Initialize lobbyState if null
      if (!this.lobbyState) {
        this.lobbyState = {
          players: [],
          participants: [],
          waitingList: [],
          gameMode: null,
          countdownTimer: 0,
          status: 'waiting'
        };
      }
      const mergedState = { ...this.lobbyState, ...lobbyState };
      // Smart merge: only replace players/participants if new ones are provided and non-empty
      if (lobbyState.players && lobbyState.players.length > 0) {
        mergedState.players = lobbyState.players;
      }
      if (lobbyState.participants && lobbyState.participants.length > 0) {
        mergedState.participants = lobbyState.participants;
      }
      this.lobbyState = mergedState;
    } else if (!this.lobbyState) {
      // Initialize empty state if no lobbyState provided
      this.lobbyState = {
        players: [],
        participants: [],
        waitingList: [],
        gameMode: null,
        countdownTimer: 0,
        status: 'waiting'
      };
    }
    this.container.style.display = 'grid';
    // Grid layout: top info, then 3 columns (left/center/right), then bottom info
    this.container.style.gridTemplateColumns = '1fr 1fr 1fr';
    this.container.style.gridTemplateRows = 'auto 1fr auto';
    this.container.style.gap = '15px';
    this.render();
  }

  /**
   * Hide the lobby UI
   */
  hide() {
    this.isActive = false;
    if (this.container) {
      this.container.style.display = 'none';
    }
    // Don't clear lobbyState completely - preserve it for when lobby is shown again
    // Just reset to empty state
    this.lobbyState = {
      players: [],
      participants: [],
      waitingList: [],
      gameMode: this.lobbyState?.gameMode || null,
      countdownTimer: 0,
      status: 'waiting'
    };
    this.chatMessages = [];
  }

  /**
   * Update lobby state
   * @param {object} lobbyState - Updated lobby state from server
   */
  updateLobbyState(lobbyState) {
    // Merge with existing state to preserve data (especially participants from match updates)
    // Smart merge: only replace players/participants if new ones are provided and non-empty
    if (lobbyState) {
      // Initialize lobbyState if null
      if (!this.lobbyState) {
        this.lobbyState = {
          players: [],
          participants: [],
          waitingList: [],
          gameMode: null,
          countdownTimer: 0,
          status: 'waiting'
        };
      }
      const mergedState = { ...this.lobbyState, ...lobbyState };
      // Smart merge: only replace players/participants if new ones are provided and non-empty
      if (lobbyState.players && lobbyState.players.length > 0) {
        mergedState.players = lobbyState.players;
      }
      if (lobbyState.participants && lobbyState.participants.length > 0) {
        mergedState.participants = lobbyState.participants;
      }
      this.lobbyState = mergedState;
    }
    if (this.isActive) {
      this.render();
    }
  }

  /**
   * Add chat message
   * @param {string} message - Chat message (can be HTML formatted)
   * @param {string} sender - Optional sender name
   * @param {string} senderId - Optional sender ID
   */
  addChatMessage(message, sender, senderId) {
    // Format message with sender if provided
    let formattedMessage = message;
    if (sender && sender !== 'system') {
      formattedMessage = `<b>${sender}:</b> ${message}`;
    } else if (sender === 'system') {
      formattedMessage = `<i style="color: #aaa;">${message}</i>`;
    }
    
    this.chatMessages.push(formattedMessage);
    // Keep only last 50 messages
    if (this.chatMessages.length > 50) {
      this.chatMessages.shift();
    }
    if (this.isActive) {
      this.render();
    }
  }

  /**
   * Render the UI
   */
  render() {
    if (!this.container || !this.lobbyState) return;

    const { players = [], waitingList = [], gameMode = null, countdownTimer = 0, status = 'waiting', participants = [] } = this.lobbyState || {};

    // Use participants if available (includes NPCs), otherwise use players
    // Ensure we have an array even if empty
    const allParticipants = (participants && participants.length > 0) ? participants : 
                           (players && players.length > 0) ? players : [];
    
    // Debug logging
    console.log('[BattlegroundsLobbyUI] Rendering lobby:', {
      playersCount: players.length,
      participantsCount: participants.length,
      allParticipantsCount: allParticipants.length,
      gameMode,
      status
    });

    // Clear container
    this.container.innerHTML = '';

    // TOP INFO AREA (spans all columns)
    const topInfo = document.createElement('div');
    topInfo.style.gridColumn = '1 / -1';
    topInfo.style.textAlign = 'center';
    topInfo.style.marginBottom = '10px';
    topInfo.style.paddingBottom = '15px';
    topInfo.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
    topInfo.innerHTML = `
      <h2 style="margin: 0 0 10px 0; color: #ffd700;">BATTLEGROUNDS LOBBY</h2>
      <div style="display: flex; justify-content: center; gap: 20px; align-items: center; flex-wrap: wrap;">
        <div style="font-size: 14px; color: #aaa;">Mode: <span style="color: #fff;">${gameMode ? this.formatGameMode(gameMode) : 'Unknown'}</span></div>
        <div style="font-size: 14px; color: #aaa;">Status: <span style="color: ${this.getStatusColor(status)};">${status || 'waiting'}</span></div>
        ${countdownTimer > 0 ? `<div style="font-size: 20px; color: #00ff00; font-weight: bold; text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);">${status === 'map_preview' ? 'Map Preview: ' : status === 'starting' ? 'Match Starting: ' : 'Starting in: '}${countdownTimer}s</div>` : ''}
      </div>
    `;
    this.container.appendChild(topInfo);

    // LEFT COLUMN: Deathmatch all players, or Team 1 players
    const leftColumn = document.createElement('div');
    leftColumn.style.display = 'flex';
    leftColumn.style.flexDirection = 'column';
    leftColumn.style.gap = '15px';

    // Determine which players to show in left column
    let leftColumnPlayers = [];
    let leftColumnTitle = '';
    if (gameMode === 'deathmatch') {
      leftColumnPlayers = allParticipants;
      leftColumnTitle = `Players (${allParticipants.length})`;
    } else if (gameMode === 'skirmish' || gameMode === 'assault') {
      // For team modes, show Team 1 players (or players without a team yet)
      leftColumnPlayers = allParticipants.filter(p => !p.team || p.team === 'team1');
      leftColumnTitle = `Team 1 (${leftColumnPlayers.length})`;
    } else {
      leftColumnPlayers = allParticipants;
      leftColumnTitle = `Players (${allParticipants.length})`;
    }

    const playerListSection = document.createElement('div');
    playerListSection.innerHTML = `<h3 style="margin: 0 0 10px 0; color: #ffff00;">${leftColumnTitle}</h3>`;
    
    const playerList = document.createElement('div');
    playerList.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
    playerList.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    playerList.style.borderRadius = '5px';
    playerList.style.padding = '10px';
    playerList.style.maxHeight = '400px';
    playerList.style.overflowY = 'auto';

    if (leftColumnPlayers.length === 0) {
      playerList.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No players</div>';
    } else {
      leftColumnPlayers.forEach((player) => {
        const playerDiv = this.createPlayerDiv(player);
        playerList.appendChild(playerDiv);
      });
    }

    playerListSection.appendChild(playerList);
    leftColumn.appendChild(playerListSection);

    // Team selection (only for Skirmish/Assault, in left column)
    if (gameMode === 'skirmish' || gameMode === 'assault') {
      const teamSelection = document.createElement('div');
      teamSelection.innerHTML = '<h3 style="margin: 0 0 10px 0; color: #ffff00;">Select Team</h3>';
      
      const teamButtons = document.createElement('div');
      teamButtons.style.display = 'flex';
      teamButtons.style.gap = '10px';
      teamButtons.style.flexDirection = 'column';

      const team1Button = document.createElement('button');
      team1Button.textContent = 'Join Team 1';
      team1Button.style.padding = '10px 20px';
      team1Button.style.backgroundColor = 'rgba(0, 100, 200, 0.7)';
      team1Button.style.border = '1px solid rgba(255, 255, 255, 0.3)';
      team1Button.style.borderRadius = '5px';
      team1Button.style.color = 'white';
      team1Button.style.cursor = 'pointer';
      team1Button.style.fontFamily = 'monospace';
      team1Button.onclick = () => this.selectTeam('team1');
      team1Button.onmouseover = function() { this.style.backgroundColor = 'rgba(0, 150, 255, 0.8)'; };
      team1Button.onmouseout = function() { this.style.backgroundColor = 'rgba(0, 100, 200, 0.7)'; };

      const team2Button = document.createElement('button');
      team2Button.textContent = 'Join Team 2';
      team2Button.style.padding = '10px 20px';
      team2Button.style.backgroundColor = 'rgba(200, 0, 0, 0.7)';
      team2Button.style.border = '1px solid rgba(255, 255, 255, 0.3)';
      team2Button.style.borderRadius = '5px';
      team2Button.style.color = 'white';
      team2Button.style.cursor = 'pointer';
      team2Button.style.fontFamily = 'monospace';
      team2Button.onclick = () => this.selectTeam('team2');
      team2Button.onmouseover = function() { this.style.backgroundColor = 'rgba(255, 0, 0, 0.8)'; };
      team2Button.onmouseout = function() { this.style.backgroundColor = 'rgba(200, 0, 0, 0.7)'; };

      teamButtons.appendChild(team1Button);
      teamButtons.appendChild(team2Button);
      teamSelection.appendChild(teamButtons);
      leftColumn.appendChild(teamSelection);
    }

    // CENTER COLUMN: Map preview area (hidden until map preview is ready)
    const centerColumn = document.createElement('div');
    centerColumn.id = 'battlegrounds-lobby-map-preview';
    centerColumn.style.display = 'flex';
    centerColumn.style.flexDirection = 'column';
    centerColumn.style.alignItems = 'center';
    centerColumn.style.justifyContent = 'center';
    centerColumn.style.minHeight = '500px';
    centerColumn.style.height = '100%';
    centerColumn.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    centerColumn.style.border = '1px dashed rgba(255, 255, 255, 0.2)';
    centerColumn.style.borderRadius = '5px';
    centerColumn.style.padding = '10px';
    
    // Check if map preview is available (from BattlegroundsMapPreviewUI)
    const mapPreviewAvailable = typeof window !== 'undefined' && 
                                 window.battlegroundsMapPreviewUI && 
                                 window.battlegroundsMapPreviewUI.isActive &&
                                 window.battlegroundsMapPreviewUI.previewData;
    
    if (mapPreviewAvailable) {
      // Render map preview directly into center column
      window.battlegroundsMapPreviewUI.renderToContainer(centerColumn);
    } else {
      // No map preview yet - show placeholder
      centerColumn.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">Map preview will appear here</div>';
    }

    // RIGHT COLUMN: Team 2 players (only for Skirmish/Assault), hidden otherwise
    const rightColumn = document.createElement('div');
    if (gameMode === 'skirmish' || gameMode === 'assault') {
      rightColumn.style.display = 'flex';
      rightColumn.style.flexDirection = 'column';
      rightColumn.style.gap = '15px';
      
      const team2Players = allParticipants.filter(p => p.team === 'team2');
      const team2Title = `Team 2 (${team2Players.length})`;
      
      const team2Section = document.createElement('div');
      team2Section.innerHTML = `<h3 style="margin: 0 0 10px 0; color: #ffff00;">${team2Title}</h3>`;
      
      const team2List = document.createElement('div');
      team2List.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
      team2List.style.border = '1px solid rgba(255, 255, 255, 0.2)';
      team2List.style.borderRadius = '5px';
      team2List.style.padding = '10px';
      team2List.style.maxHeight = '400px';
      team2List.style.overflowY = 'auto';

      if (team2Players.length === 0) {
        team2List.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No players</div>';
      } else {
        team2Players.forEach((player) => {
          const playerDiv = this.createPlayerDiv(player);
          team2List.appendChild(playerDiv);
        });
      }

      team2Section.appendChild(team2List);
      rightColumn.appendChild(team2Section);
    } else {
      // Hide right column for deathmatch
      rightColumn.style.display = 'none';
    }

    // Append columns
    this.container.appendChild(leftColumn);
    this.container.appendChild(centerColumn);
    this.container.appendChild(rightColumn);

    // BOTTOM INFO AREA: Help messages (spans all columns)
    const bottomInfo = document.createElement('div');
    bottomInfo.style.gridColumn = '1 / -1';
    bottomInfo.style.paddingTop = '15px';
    bottomInfo.style.borderTop = '1px solid rgba(255, 255, 255, 0.2)';
    bottomInfo.style.display = 'flex';
    bottomInfo.style.justifyContent = 'space-between';
    bottomInfo.style.alignItems = 'center';
    bottomInfo.style.flexWrap = 'wrap';
    bottomInfo.style.gap = '10px';

    const helpText = document.createElement('div');
    helpText.style.fontSize = '13px';
    helpText.style.color = '#aaa';
    helpText.style.lineHeight = '1.6';
    helpText.innerHTML = `
      <span style="color: #aaa;">Lobby chat: Type <b style="color: #fff;">/lobby [message]</b> in the main game chat</span>
    `;
    bottomInfo.appendChild(helpText);

    const leaveButton = document.createElement('button');
    leaveButton.textContent = 'Leave Lobby';
    leaveButton.style.padding = '10px 20px';
    leaveButton.style.backgroundColor = 'rgba(200, 0, 0, 0.7)';
    leaveButton.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    leaveButton.style.borderRadius = '5px';
    leaveButton.style.color = 'white';
    leaveButton.style.cursor = 'pointer';
    leaveButton.style.fontFamily = 'monospace';
    leaveButton.onclick = () => this.leaveLobby();
    leaveButton.onmouseover = function() { this.style.backgroundColor = 'rgba(255, 0, 0, 0.8)'; };
    leaveButton.onmouseout = function() { this.style.backgroundColor = 'rgba(200, 0, 0, 0.7)'; };
    bottomInfo.appendChild(leaveButton);

    this.container.appendChild(bottomInfo);
  }

  /**
   * Format game mode name
   */
  formatGameMode(gameMode) {
    if (gameMode === 'deathmatch') return 'Deathmatch';
    if (gameMode === 'skirmish') return 'Skirmish';
    if (gameMode === 'assault') return 'Assault';
    return gameMode || 'Unknown';
  }

  /**
   * Get status color
   */
  getStatusColor(status) {
    if (status === 'waiting') return '#ffaa00';
    if (status === 'countdown') return '#00ff00';
    if (status === 'starting') return '#00ffff';
    return '#ffffff';
  }

  /**
   * Get team color
   */
  getTeamColor(team) {
    if (team === 'team1') return '#0096ff';
    if (team === 'team2') return '#ff0000';
    return '#ffffff';
  }

  /**
   * Create a player div element for display in the lobby
   * @param {object} player - Player object with id, name, team, class, sex, isNPC
   * @returns {HTMLElement} - The created player div element
   */
  createPlayerDiv(player) {
    const playerDiv = document.createElement('div');
    playerDiv.style.padding = '8px';
    playerDiv.style.marginBottom = '5px';
    playerDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
    playerDiv.style.borderRadius = '3px';
    playerDiv.style.display = 'flex';
    playerDiv.style.justifyContent = 'space-between';
    playerDiv.style.alignItems = 'center';
    playerDiv.style.gap = '10px';

    // Create portrait container
    const portraitContainer = document.createElement('div');
    portraitContainer.style.width = '40px';
    portraitContainer.style.height = '40px';
    portraitContainer.style.flexShrink = '0';
    portraitContainer.style.borderRadius = '4px';
    portraitContainer.style.overflow = 'hidden';
    portraitContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    portraitContainer.style.border = '1px solid rgba(255, 255, 255, 0.2)';

    // Create portrait canvas
    const portraitCanvas = document.createElement('canvas');
    portraitCanvas.width = 40;
    portraitCanvas.height = 40;
    portraitCanvas.style.width = '100%';
    portraitCanvas.style.height = '100%';
    portraitCanvas.style.imageRendering = 'pixelated';
    
    // Draw portrait
    const portraitCtx = portraitCanvas.getContext('2d');
    const entityClass = player.class || 'SerfM';
    const entitySex = player.sex || 'm';
    
    // Get portrait image using PortraitHelper
    let portraitImage = null;
    if (typeof window !== 'undefined' && window.portraitHelperInstance) {
      portraitImage = window.portraitHelperInstance.getPortraitImage(entityClass, entitySex);
    } else if (typeof PortraitHelper !== 'undefined') {
      const helper = new PortraitHelper();
      if (typeof Img !== 'undefined') {
        helper.setImageAssets(Img);
        portraitImage = helper.getPortraitImage(entityClass, entitySex);
      }
    }
    
    if (portraitImage && portraitImage.complete && portraitImage.width > 0 && portraitImage.height > 0) {
      try {
        portraitCtx.clearRect(0, 0, 40, 40);
        portraitCtx.drawImage(portraitImage, 0, 0, 40, 40);
      } catch (e) {
        console.warn('Failed to draw portrait for class:', entityClass, e);
        // Draw placeholder
        portraitCtx.fillStyle = 'rgba(100, 100, 100, 0.5)';
        portraitCtx.fillRect(0, 0, 40, 40);
      }
    } else {
      // Draw placeholder if portrait not available
      portraitCtx.fillStyle = 'rgba(100, 100, 100, 0.5)';
      portraitCtx.fillRect(0, 0, 40, 40);
    }
    
    portraitContainer.appendChild(portraitCanvas);

    // Create name container
    const nameContainer = document.createElement('div');
    nameContainer.style.display = 'flex';
    nameContainer.style.flexDirection = 'column';
    nameContainer.style.flex = '1';
    nameContainer.style.minWidth = '0';

    const playerName = document.createElement('span');
    const displayName = player.name || player.id;
    playerName.textContent = player.isNPC ? `[NPC] ${displayName}` : displayName;
    playerName.style.color = player.team ? this.getTeamColor(player.team) : '#fff';
    if (player.isNPC) {
      playerName.style.fontStyle = 'italic';
      playerName.style.opacity = '0.8';
    }

    const teamBadge = document.createElement('span');
    if (player.team) {
      teamBadge.textContent = player.team === 'team1' ? 'Team 1' : 'Team 2';
      teamBadge.style.padding = '2px 8px';
      teamBadge.style.backgroundColor = this.getTeamColor(player.team);
      teamBadge.style.color = '#000';
      teamBadge.style.borderRadius = '3px';
      teamBadge.style.fontSize = '12px';
      teamBadge.style.width = 'fit-content';
      teamBadge.style.marginTop = '4px';
    } else {
      teamBadge.textContent = 'No team';
      teamBadge.style.color = '#888';
      teamBadge.style.fontSize = '12px';
      teamBadge.style.marginTop = '4px';
    }

    nameContainer.appendChild(playerName);
    nameContainer.appendChild(teamBadge);

    playerDiv.appendChild(portraitContainer);
    playerDiv.appendChild(nameContainer);

    return playerDiv;
  }

  /**
   * Select team
   */
  selectTeam(team) {
    // Get socket
    let socketToUse = this.socket;
    if (!socketToUse) {
      if (typeof window !== 'undefined' && window.socket) {
        socketToUse = window.socket;
      } else if (typeof socket !== 'undefined') {
        socketToUse = socket;
      }
    }

    if (!socketToUse) {
      console.error('No socket available for team selection');
      return;
    }

    const message = JSON.stringify({
      msg: 'selectBattlegroundsTeam',
      team: team
    });

    try {
      if (socketToUse.write) {
        socketToUse.write(message);
      } else if (socketToUse.send) {
        socketToUse.send(message);
      }
    } catch (e) {
      console.error('Error selecting team:', e);
    }
  }

  /**
   * Send chat message
   */
  sendChatMessage(message) {
    // Get socket
    let socketToUse = this.socket;
    if (!socketToUse) {
      if (typeof window !== 'undefined' && window.socket) {
        socketToUse = window.socket;
      } else if (typeof socket !== 'undefined') {
        socketToUse = socket;
      }
    }

    if (!socketToUse) {
      console.error('No socket available for chat');
      return;
    }

    const msg = JSON.stringify({
      msg: 'battlegroundsLobbyChat',
      message: message
    });

    try {
      if (socketToUse.write) {
        socketToUse.write(msg);
      } else if (socketToUse.send) {
        socketToUse.send(msg);
      }
    } catch (e) {
      console.error('Error sending chat message:', e);
    }
  }

  /**
   * Leave lobby
   */
  leaveLobby() {
    // Get socket
    let socketToUse = this.socket;
    if (!socketToUse) {
      if (typeof window !== 'undefined' && window.socket) {
        socketToUse = window.socket;
      } else if (typeof socket !== 'undefined') {
        socketToUse = socket;
      }
    }

    if (!socketToUse) {
      console.error('No socket available for leaving lobby');
      return;
    }

    const message = JSON.stringify({
      msg: 'leaveBattlegroundsLobby'
    });

    try {
      if (socketToUse.write) {
        socketToUse.write(message);
      } else if (socketToUse.send) {
        socketToUse.send(message);
      }
      
      // Hide UI
      this.hide();
    } catch (e) {
      console.error('Error leaving lobby:', e);
    }
  }

  /**
   * Set socket reference
   */
  setSocket(socket) {
    this.socket = socket;
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.battlegroundsLobbyUI = new BattlegroundsLobbyUI();
}

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BattlegroundsLobbyUI;
}

