/**
 * ScoreboardUI - Manages scoreboard/faction resources display
 * 
 * Extracted from client.js for better organization.
 */

class ScoreboardUI {
  constructor() {
    // Dependencies would be injected here
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
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.ScoreboardUI = ScoreboardUI;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScoreboardUI;
}
