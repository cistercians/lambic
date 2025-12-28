/**
 * BattlegroundsPostGameUI - Manages the post-game UI overlay for Battlegrounds
 * Displays final scoreboard, statistics, and map voting interface
 */

class BattlegroundsPostGameUI {
  constructor() {
    this.isActive = false;
    this.matchData = null;
    this.endData = null;
    this.votingState = null;
    this.container = null;
    this.socket = null; // Will be set from socket handler
  }

  /**
   * Initialize the UI container
   */
  init() {
    if (this.container) return; // Already initialized

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'battlegrounds-post-game-ui';
    this.container.style.position = 'fixed';
    this.container.style.top = '50%';
    this.container.style.left = '50%';
    this.container.style.transform = 'translate(-50%, -50%)';
    this.container.style.width = '800px';
    this.container.style.maxWidth = '90vw';
    this.container.style.maxHeight = '80vh';
    this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
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
   * Show the post-game UI
   * @param {object} endData - End data from server
   * @param {object} matchData - Match data
   */
  show(endData, matchData) {
    this.init();
    this.isActive = true;
    this.endData = endData;
    this.matchData = matchData;
    this.container.style.display = 'block';
    this.render();
  }

  /**
   * Hide the post-game UI
   */
  hide() {
    this.isActive = false;
    if (this.container) {
      this.container.style.display = 'none';
    }
    this.endData = null;
    this.matchData = null;
    this.votingState = null;
  }

  /**
   * Update voting state
   * @param {object} votingState - Voting state from server
   */
  updateVotingState(votingState) {
    this.votingState = votingState;
    if (this.isActive) {
      this.render();
    }
  }

  /**
   * Render the UI
   */
  render() {
    if (!this.container) return;

    const { endData, matchData, votingState } = this;

    // Build HTML
    let html = '<div style="text-align: center; margin-bottom: 20px;">';
    html += '<h2 style="margin: 0 0 10px 0; color: #ffd700;">MATCH ENDED</h2>';
    
    if (endData && endData.winner) {
      const winnerText = this.getWinnerText(endData.winner, matchData);
      html += `<div style="font-size: 18px; color: #00ff00; margin-bottom: 10px;">${winnerText}</div>`;
    }
    
    html += '</div>';

    // Scoreboard
    if (endData && endData.scores) {
      html += this.renderScoreboard(endData.scores, matchData);
    }

    // Voting section
    if (votingState) {
      html += this.renderVoting(votingState);
    }

    this.container.innerHTML = html;
  }

  /**
   * Render scoreboard
   */
  renderScoreboard(scores, matchData) {
    let html = '<div style="margin-bottom: 20px;">';
    html += '<h3 style="margin: 0 0 10px 0; color: #ffff00;">Scoreboard</h3>';
    html += '<table style="width: 100%; border-collapse: collapse;">';
    html += '<thead><tr>';
    html += '<th style="padding: 8px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.3);">Player</th>';
    html += '<th style="padding: 8px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.3);">Kills</th>';
    html += '<th style="padding: 8px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.3);">Deaths</th>';
    html += '<th style="padding: 8px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.3);">K/D</th>';
    html += '<th style="padding: 8px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.3);">Placement</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    // Sort players by placement (if available) or kills
    const players = Object.keys(scores).map(playerId => ({
      id: playerId,
      ...scores[playerId],
      name: this.getPlayerName(playerId)
    })).sort((a, b) => {
      if (a.placement && b.placement) {
        return a.placement - b.placement;
      }
      return (b.kills || 0) - (a.kills || 0);
    });

    players.forEach((player, index) => {
      const kd = player.deaths > 0 ? (player.kills / player.deaths).toFixed(2) : (player.kills || 0).toFixed(2);
      const rowColor = index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '';
      html += '<tr style="' + (rowColor ? `color: ${rowColor};` : '') + '">';
      html += `<td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">${player.name || player.id}</td>`;
      html += `<td style="padding: 8px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1);">${player.kills || 0}</td>`;
      html += `<td style="padding: 8px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1);">${player.deaths || 0}</td>`;
      html += `<td style="padding: 8px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1);">${kd}</td>`;
      html += `<td style="padding: 8px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1);">#${player.placement || (index + 1)}</td>`;
      html += '</tr>';
    });

    html += '</tbody></table>';
    html += '</div>';

    return html;
  }

  /**
   * Render voting interface
   */
  renderVoting(votingState) {
    let html = '<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.3);">';
    html += '<h3 style="margin: 0 0 10px 0; color: #ffff00;">Map Voting</h3>';

    if (votingState.isClassicMap) {
      html += '<div style="margin-bottom: 10px; color: #aaa;">Vote on this Classic Map</div>';
    } else {
      html += '<div style="margin-bottom: 10px; color: #aaa;">Save this map as a Classic Map?</div>';
    }

    // Voting buttons
    html += '<div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 10px;">';
    html += '<button id="bg-vote-yes" style="';
    html += 'padding: 10px 30px; background-color: rgba(0, 200, 0, 0.7); ';
    html += 'border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 5px; ';
    html += 'color: white; font-size: 16px; cursor: pointer; font-family: monospace;';
    html += '">YES</button>';
    html += '<button id="bg-vote-no" style="';
    html += 'padding: 10px 30px; background-color: rgba(200, 0, 0, 0.7); ';
    html += 'border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 5px; ';
    html += 'color: white; font-size: 16px; cursor: pointer; font-family: monospace;';
    html += '">NO</button>';
    html += '</div>';

    // Voting status
    if (votingState.yesVotes !== undefined) {
      html += '<div style="text-align: center; color: #aaa; font-size: 14px;">';
      html += `Votes: ${votingState.yesVotes} Yes / ${votingState.noVotes} No `;
      if (votingState.remainingVotes > 0) {
        html += `(${votingState.remainingVotes} remaining)`;
      }
      html += '</div>';
    }

    // Timer
    if (votingState.remainingTime !== undefined) {
      const seconds = Math.ceil(votingState.remainingTime / 1000);
      html += `<div style="text-align: center; color: #ffaa00; font-size: 14px; margin-top: 5px;">Time remaining: ${seconds}s</div>`;
    }

    html += '</div>';

    // Add event listeners
    setTimeout(() => {
      this.attachVotingListeners();
    }, 0);

    return html;
  }

  /**
   * Attach voting button event listeners
   */
  attachVotingListeners() {
    const yesButton = document.getElementById('bg-vote-yes');
    const noButton = document.getElementById('bg-vote-no');

    if (yesButton) {
      yesButton.onclick = () => this.vote('yes');
      yesButton.onmouseover = function() { this.style.backgroundColor = 'rgba(0, 255, 0, 0.8)'; };
      yesButton.onmouseout = function() { this.style.backgroundColor = 'rgba(0, 200, 0, 0.7)'; };
    }

    if (noButton) {
      noButton.onclick = () => this.vote('no');
      noButton.onmouseover = function() { this.style.backgroundColor = 'rgba(255, 0, 0, 0.8)'; };
      noButton.onmouseout = function() { this.style.backgroundColor = 'rgba(200, 0, 0, 0.7)'; };
    }
  }

  /**
   * Send vote to server
   * @param {string} vote - 'yes' or 'no'
   */
  vote(vote) {
    if (!this.matchData || !this.matchData.matchId) return;
    
    // Try to get socket from SocketManager or global scope
    let socketToUse = this.socket;
    if (!socketToUse) {
      if (typeof window !== 'undefined' && window.SocketManager && window.SocketManager.getSocket) {
        socketToUse = window.SocketManager.getSocket();
      } else if (typeof window !== 'undefined' && window.socket) {
        socketToUse = window.socket;
      } else if (typeof socket !== 'undefined') {
        socketToUse = socket;
      }
    }
    
    if (!socketToUse) {
      console.error('No socket available for voting');
      return;
    }

    const message = JSON.stringify({
      msg: 'battlegroundsMapVote',
      matchId: this.matchData.matchId,
      vote: vote
    });

    try {
      if (socketToUse.write) {
        socketToUse.write(message);
      } else if (socketToUse.send) {
        socketToUse.send(message);
      } else {
        console.error('Socket does not have write or send method');
        return;
      }
      
      // Disable buttons after voting
      const yesButton = document.getElementById('bg-vote-yes');
      const noButton = document.getElementById('bg-vote-no');
      if (yesButton) {
        yesButton.disabled = true;
        yesButton.style.opacity = '0.5';
        yesButton.style.cursor = 'not-allowed';
      }
      if (noButton) {
        noButton.disabled = true;
        noButton.style.opacity = '0.5';
        noButton.style.cursor = 'not-allowed';
      }
    } catch (e) {
      console.error('Error sending vote:', e);
    }
  }

  /**
   * Get winner text
   */
  getWinnerText(winner, matchData) {
    if (!matchData || !matchData.gameMode) return 'Winner: ' + winner;

    if (matchData.gameMode === 'deathmatch') {
      const winnerName = this.getPlayerName(winner);
      return `Winner: ${winnerName}`;
    } else if (matchData.gameMode === 'skirmish' || matchData.gameMode === 'assault') {
      if (winner === 'team1') {
        return 'Team 1 Wins!';
      } else if (winner === 'team2') {
        return 'Team 2 Wins!';
      }
    }

    return 'Winner: ' + winner;
  }

  /**
   * Get player name by ID
   */
  getPlayerName(playerId) {
    if (typeof Player !== 'undefined' && Player.list && Player.list[playerId]) {
      return Player.list[playerId].name || playerId;
    }
    return playerId;
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
  window.battlegroundsPostGameUI = new BattlegroundsPostGameUI();
}

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BattlegroundsPostGameUI;
}

