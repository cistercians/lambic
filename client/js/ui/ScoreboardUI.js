/**
 * ScoreboardUI - Manages scoreboard/faction resources display
 * 
 * Extracted from client.js for better organization.
 */

class ScoreboardUI {
  constructor() {
    this.currentTab = 'resources';
    this.initTabs();
  }

  /**
   * Initialize tab switching functionality
   */
  initTabs() {
    // Wait for DOM to be ready
    if (typeof document !== 'undefined') {
      document.addEventListener('DOMContentLoaded', () => {
        this.setupTabs();
      });
      
      // Also try immediately in case DOM is already ready
      if (document.readyState === 'loading') {
        // DOM is still loading, wait for DOMContentLoaded
      } else {
        // DOM is already loaded
        this.setupTabs();
      }
    }
  }

  /**
   * Setup tab click handlers
   */
  setupTabs() {
    const tabs = document.querySelectorAll('.scoreboard-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        this.switchTab(tabName);
      });
    });

    // Setup sort dropdown for Battlegrounds tab
    const sortSelect = document.getElementById('bg-leaderboard-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        const sortBy = e.target.value;
        this.requestBattlegroundsLeaderboard(sortBy);
      });
    }
  }

  /**
   * Switch to a different tab
   */
  switchTab(tabName) {
    this.currentTab = tabName;

    // Update tab buttons
    const tabs = document.querySelectorAll('.scoreboard-tab');
    tabs.forEach(tab => {
      if (tab.getAttribute('data-tab') === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update tab content
    const resourcesTab = document.getElementById('scoreboard-resources-tab');
    const battlegroundsTab = document.getElementById('scoreboard-battlegrounds-tab');
    
    if (tabName === 'resources') {
      if (resourcesTab) resourcesTab.classList.add('active');
      if (battlegroundsTab) battlegroundsTab.classList.remove('active');
    } else if (tabName === 'battlegrounds') {
      if (resourcesTab) resourcesTab.classList.remove('active');
      if (battlegroundsTab) battlegroundsTab.classList.add('active');
      
      // Request leaderboard data when switching to Battlegrounds tab
      const sortSelect = document.getElementById('bg-leaderboard-sort');
      const sortBy = sortSelect ? sortSelect.value : 'wins';
      this.requestBattlegroundsLeaderboard(sortBy);
    }
  }

  /**
   * Request Battlegrounds leaderboard from server
   */
  requestBattlegroundsLeaderboard(sortBy = 'wins') {
    if (typeof socket !== 'undefined' && socket) {
      socket.send(JSON.stringify({
        msg: 'getBattlegroundsLeaderboard',
        sortBy: sortBy
      }));
    } else if (typeof window !== 'undefined' && window.socket) {
      window.socket.send(JSON.stringify({
        msg: 'getBattlegroundsLeaderboard',
        sortBy: sortBy
      }));
    }
  }

  /**
   * Update scoreboard UI with faction resources
   * @param {object} factionResources - Resources by faction
   */
  updateScoreboardUI(factionResources) {
    const scoreboardBody = document.getElementById('scoreboard-body');
    if (!scoreboardBody) {
      console.warn('Scoreboard body element not found');
      return;
    }

    // Clear existing rows
    scoreboardBody.innerHTML = '';

    if (!factionResources || Object.keys(factionResources).length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = '<td colspan="13" style="text-align:center;color:#888;padding:20px;">No faction data available</td>';
      scoreboardBody.appendChild(emptyRow);
      return;
    }

    // Sort factions by total resources (grain + fish + lumber + stone + iron + steel + silver + gold)
    const factions = Object.keys(factionResources).map(id => {
      const res = factionResources[id];
      const factionName = res.name || (typeof houseList !== 'undefined' && houseList && houseList[id] ? houseList[id].name : id);
      return {
        id,
        name: factionName,
        resources: res
      };
    }).sort((a, b) => {
      const totalA = (a.resources.grain || 0) + (a.resources.fish || 0) + (a.resources.lumber || 0) + 
                     (a.resources.stone || 0) + (a.resources.iron || 0) + (a.resources.steel || 0) +
                     (a.resources.silver || 0) + (a.resources.gold || 0);
      const totalB = (b.resources.grain || 0) + (b.resources.fish || 0) + (b.resources.lumber || 0) + 
                     (b.resources.stone || 0) + (b.resources.iron || 0) + (b.resources.steel || 0) +
                     (b.resources.silver || 0) + (b.resources.gold || 0);
      return totalB - totalA;
    });

    // Build table rows
    for (const faction of factions) {
      const row = document.createElement('tr');
      const res = faction.resources;
      
      row.innerHTML = `
        <td>${faction.name}</td>
        <td>${res.grain || 0}</td>
        <td>${res.fish || 0}</td>
        <td>${res.lumber || 0}</td>
        <td>${res.stone || 0}</td>
        <td>${res.ironore || 0}</td>
        <td>${res.iron || 0}</td>
        <td>${res.steel || 0}</td>
        <td>${res.silver || 0}</td>
        <td>${res.gold || 0}</td>
        <td>${res.serfs || 0}</td>
        <td>${res.military || 0}</td>
        <td>${res.buildings || 0}</td>
      `;
      
      scoreboardBody.appendChild(row);
    }
  }

  /**
   * Update Battlegrounds leaderboard UI
   * @param {Array} leaderboardData - Array of player stats
   * @param {string} sortBy - Sort field used
   */
  updateBattlegroundsLeaderboard(leaderboardData, sortBy = 'wins') {
    const leaderboardBody = document.getElementById('battlegrounds-leaderboard-body');
    if (!leaderboardBody) {
      console.warn('Battlegrounds leaderboard body element not found');
      return;
    }

    // Clear existing rows
    leaderboardBody.innerHTML = '';

    if (!leaderboardData || leaderboardData.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = '<td colspan="9" style="text-align:center;color:#888;padding:20px;">No Battlegrounds statistics available</td>';
      leaderboardBody.appendChild(emptyRow);
      return;
    }

    // Build table rows
    leaderboardData.forEach((playerStats, index) => {
      const row = document.createElement('tr');
      
      // Add rank class for top 3
      if (index === 0) row.classList.add('top1');
      else if (index === 1) row.classList.add('top2');
      else if (index === 2) row.classList.add('top3');
      
      const rank = index + 1;
      const winRate = playerStats.winRate || 0;
      const kdr = playerStats.kdr || 0;
      
      row.innerHTML = `
        <td class="placement">${rank}</td>
        <td>${playerStats.playerName}</td>
        <td>${playerStats.matchesPlayed || 0}</td>
        <td>${playerStats.wins || 0}</td>
        <td>${playerStats.losses || 0}</td>
        <td>${playerStats.kills || 0}</td>
        <td>${playerStats.deaths || 0}</td>
        <td>${kdr.toFixed(2)}</td>
        <td>${winRate.toFixed(2)}%</td>
      `;
      
      leaderboardBody.appendChild(row);
    });
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.ScoreboardUI = ScoreboardUI;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScoreboardUI;
}
