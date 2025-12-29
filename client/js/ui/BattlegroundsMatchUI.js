/**
 * BattlegroundsMatchUI - Manages the in-match UI overlay for Battlegrounds
 * Displays timer, scores, match status, and game mode information
 */

class BattlegroundsMatchUI {
  constructor() {
    this.isActive = false;
    this.matchData = null;
    this.updateInterval = null;
    this.container = null;
    this.timerElement = null;
    this.timerContainer = null;
    this.leaveButton = null;
    this.scoreElement = null;
    this.statusElement = null;
    this.gameModeElement = null;
    this.mapTypeElement = null;
  }

  /**
   * Initialize the UI container
   */
  init() {
    // Create container if it doesn't exist
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'battlegrounds-match-ui';
      this.container.style.position = 'fixed';
      this.container.style.top = '10px';
      this.container.style.left = '50%';
      this.container.style.transform = 'translateX(-50%)';
      this.container.style.zIndex = '999';
      this.container.style.pointerEvents = 'none';
      this.container.style.fontFamily = 'monospace';
      this.container.style.color = 'white';
      this.container.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.8)';
      this.container.style.display = 'none';
      
      // Create UI elements
      this.statusElement = document.createElement('div');
      this.statusElement.style.fontSize = '18px';
      this.statusElement.style.fontWeight = 'bold';
      this.statusElement.style.marginBottom = '5px';
      this.statusElement.style.textAlign = 'center';
      
      // Create container for timer and leave button
      this.timerContainer = document.createElement('div');
      this.timerContainer.style.display = 'flex';
      this.timerContainer.style.flexDirection = 'column';
      this.timerContainer.style.alignItems = 'center';
      this.timerContainer.style.gap = '5px';
      this.timerContainer.style.marginBottom = '10px';
      this.timerContainer.style.pointerEvents = 'auto'; // Enable pointer events for interactive elements
      
      this.timerElement = document.createElement('div');
      this.timerElement.style.fontSize = '24px';
      this.timerElement.style.fontWeight = 'bold';
      this.timerElement.style.textAlign = 'center';
      
      // Create LEAVE button (small and subtle)
      this.leaveButton = document.createElement('button');
      this.leaveButton.textContent = 'LEAVE';
      this.leaveButton.style.fontSize = '11px';
      this.leaveButton.style.padding = '4px 8px';
      this.leaveButton.style.backgroundColor = 'rgba(200, 0, 0, 0.3)';
      this.leaveButton.style.border = '1px solid rgba(255, 255, 255, 0.2)';
      this.leaveButton.style.borderRadius = '3px';
      this.leaveButton.style.color = 'rgba(255, 255, 255, 0.7)';
      this.leaveButton.style.cursor = 'pointer';
      this.leaveButton.style.fontFamily = 'monospace';
      this.leaveButton.style.opacity = '0.6';
      this.leaveButton.style.transition = 'opacity 0.2s';
      this.leaveButton.style.pointerEvents = 'auto'; // Enable pointer events for button
      this.leaveButton.onclick = () => this.exitMatch();
      this.leaveButton.onmouseover = function() { 
        this.style.opacity = '0.9';
        this.style.backgroundColor = 'rgba(200, 0, 0, 0.5)';
      };
      this.leaveButton.onmouseout = function() { 
        this.style.opacity = '0.6';
        this.style.backgroundColor = 'rgba(200, 0, 0, 0.3)';
      };
      
      this.timerContainer.appendChild(this.timerElement);
      this.timerContainer.appendChild(this.leaveButton);
      
      this.gameModeElement = document.createElement('div');
      this.gameModeElement.style.fontSize = '14px';
      this.gameModeElement.style.marginBottom = '5px';
      this.gameModeElement.style.textAlign = 'center';
      this.gameModeElement.style.opacity = '0.8';
      
      this.mapTypeElement = document.createElement('div');
      this.mapTypeElement.style.fontSize = '12px';
      this.mapTypeElement.style.marginBottom = '10px';
      this.mapTypeElement.style.textAlign = 'center';
      this.mapTypeElement.style.opacity = '0.7';
      
      this.scoreElement = document.createElement('div');
      this.scoreElement.style.fontSize = '14px';
      this.scoreElement.style.textAlign = 'center';
      
      // Assemble container
      this.container.appendChild(this.statusElement);
      this.container.appendChild(this.timerContainer);
      this.container.appendChild(this.gameModeElement);
      this.container.appendChild(this.mapTypeElement);
      this.container.appendChild(this.scoreElement);
      
      // Add to gameDiv or body
      const gameDiv = document.getElementById('gameDiv');
      if (gameDiv) {
        gameDiv.appendChild(this.container);
      } else {
        document.body.appendChild(this.container);
      }
    }
  }

  /**
   * Show the match UI
   * @param {object} matchData - Match data from server
   */
  show(matchData) {
    this.init();
    this.isActive = true;
    this.matchData = matchData;
    this.container.style.display = 'block';
    this.update();
    this.startUpdateInterval();
  }

  /**
   * Hide the match UI
   */
  hide() {
    this.isActive = false;
    if (this.container) {
      this.container.style.display = 'none';
    }
    this.stopUpdateInterval();
    this.matchData = null;
  }

  /**
   * Update match data
   * @param {object} matchData - Updated match data from server
   */
  updateMatchData(matchData) {
    this.matchData = matchData;
    this.update();
  }

  /**
   * Update UI elements
   */
  update() {
    if (!this.isActive || !this.matchData || !this.container) return;

    const { status, gameMode, mapType, mapSize, startTime, endTime, scores } = this.matchData;

    // Update status
    if (this.statusElement) {
      if (status === 'preview') {
        this.statusElement.textContent = 'Match Preview';
        this.statusElement.style.color = '#ffff00';
      } else if (status === 'starting') {
        this.statusElement.textContent = 'Starting...';
        this.statusElement.style.color = '#00ffff';
      } else if (status === 'in_progress') {
        this.statusElement.textContent = 'IN PROGRESS';
        this.statusElement.style.color = '#00ff00';
      } else if (status === 'ending') {
        this.statusElement.textContent = 'MATCH ENDED';
        this.statusElement.style.color = '#ff0000';
      } else {
        this.statusElement.textContent = status.toUpperCase();
        this.statusElement.style.color = '#ffffff';
      }
    }

    // Update timer
    if (this.timerElement) {
      if (status === 'in_progress' && startTime) {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, (5 * 60 * 1000) - elapsed); // 5 minutes match duration
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        this.timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        this.timerElement.style.color = remaining < 60000 ? '#ff0000' : remaining < 120000 ? '#ffaa00' : '#ffffff';
        this.timerElement.style.fontSize = '24px'; // Reset to normal size for match timer
      } else if (status === 'preview' || status === 'map_preview') {
        this.timerElement.textContent = 'Preview';
        this.timerElement.style.color = '#ffff00';
        this.timerElement.style.fontSize = '24px';
      } else if (status === 'starting') {
        // Show countdown timer value
        const countdown = this.matchData.countdownTimer || 0;
        this.timerElement.textContent = countdown > 0 ? countdown.toString() : 'Starting...';
        this.timerElement.style.color = '#00ffff';
        this.timerElement.style.fontSize = '32px'; // Make countdown more prominent
      } else {
        this.timerElement.textContent = '--:--';
        this.timerElement.style.color = '#888888';
        this.timerElement.style.fontSize = '24px';
      }
    }

    // Update game mode
    if (this.gameModeElement) {
      const gameModeName = gameMode === 'deathmatch' ? 'Deathmatch' :
                          gameMode === 'skirmish' ? 'Skirmish' :
                          gameMode === 'assault' ? 'Assault' : gameMode;
      this.gameModeElement.textContent = gameModeName;
    }

    // Update map type
    if (this.mapTypeElement) {
      const mapTypeName = mapType ? mapType.charAt(0).toUpperCase() + mapType.slice(1) : '';
      const mapInfo = mapSize ? `${mapTypeName} (${mapSize}x${mapSize})` : mapTypeName;
      this.mapTypeElement.textContent = mapInfo;
    }

    // Update scores
    if (this.scoreElement && scores && status === 'in_progress') {
      this.updateScores(scores, gameMode);
    } else if (this.scoreElement) {
      this.scoreElement.innerHTML = '';
    }
  }

  /**
   * Update score display based on game mode
   * @param {object} scores - Score data
   * @param {string} gameMode - Game mode
   */
  updateScores(scores, gameMode) {
    if (!this.scoreElement) return;

    // Get current player's score if available
    const selfId = (typeof window !== 'undefined' && window.selfId) ? window.selfId :
                   (typeof selfId !== 'undefined') ? selfId : 
                   (typeof Player !== 'undefined' && Player.list) ? Object.keys(Player.list)[0] : null;
    
    if (!selfId) {
      this.scoreElement.innerHTML = '';
      return;
    }

    const playerScore = scores[selfId];
    if (!playerScore) {
      this.scoreElement.innerHTML = '';
      return;
    }

    if (gameMode === 'deathmatch') {
      // Deathmatch: Show kills/deaths
      this.scoreElement.innerHTML = `
        <div style="display: inline-block; margin: 0 15px;">
          <span style="color: #00ff00;">Kills: ${playerScore.kills || 0}</span>
        </div>
        <div style="display: inline-block; margin: 0 15px;">
          <span style="color: #ff0000;">Deaths: ${playerScore.deaths || 0}</span>
        </div>
      `;
    } else if (gameMode === 'skirmish' || gameMode === 'assault') {
      // Team modes: Show kills/deaths and team info
      // TODO: Get team information from match data if available
      this.scoreElement.innerHTML = `
        <div style="display: inline-block; margin: 0 15px;">
          <span style="color: #00ff00;">Kills: ${playerScore.kills || 0}</span>
        </div>
        <div style="display: inline-block; margin: 0 15px;">
          <span style="color: #ff0000;">Deaths: ${playerScore.deaths || 0}</span>
        </div>
      `;
    }
  }

  /**
   * Start update interval for timer
   */
  startUpdateInterval() {
    this.stopUpdateInterval();
    this.updateInterval = setInterval(() => {
      if (this.isActive && this.matchData) {
        this.update();
      } else {
        this.stopUpdateInterval();
      }
    }, 1000); // Update every second
  }

  /**
   * Stop update interval
   */
  stopUpdateInterval() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Exit match
   */
  exitMatch() {
    console.log('[BattlegroundsMatchUI] exitMatch called');
    
    // Get socket - try multiple ways to access it
    let socketToUse = null;
    if (typeof window !== 'undefined' && window.socket) {
      socketToUse = window.socket;
    } else if (typeof socket !== 'undefined') {
      socketToUse = socket;
    } else if (typeof window !== 'undefined' && window.SOCKET) {
      socketToUse = window.SOCKET;
    }

    if (!socketToUse) {
      console.error('[BattlegroundsMatchUI] No socket available for exiting match');
      alert('Unable to exit match: No connection to server');
      return;
    }

    const message = JSON.stringify({
      msg: 'exitBattlegroundsMatch'
    });

    console.log('[BattlegroundsMatchUI] Sending exitBattlegroundsMatch message:', message);

    try {
      // Try send first (most common for WebSocket)
      if (typeof socketToUse.send === 'function') {
        socketToUse.send(message);
        console.log('[BattlegroundsMatchUI] Message sent via socket.send()');
      } else if (typeof socketToUse.write === 'function') {
        socketToUse.write(message);
        console.log('[BattlegroundsMatchUI] Message sent via socket.write()');
      } else {
        console.error('[BattlegroundsMatchUI] Socket has neither send() nor write() method');
        alert('Unable to exit match: Invalid socket connection');
      }
    } catch (e) {
      console.error('[BattlegroundsMatchUI] Error exiting match:', e);
      alert('Error exiting match: ' + e.message);
    }
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.battlegroundsMatchUI = new BattlegroundsMatchUI();
}

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BattlegroundsMatchUI;
}

