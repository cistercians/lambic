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
    const scoreboard = document.getElementById('scoreboard');
    if (!scoreboard) return;

    // Clear existing content
    scoreboard.innerHTML = '';

    if (!factionResources || Object.keys(factionResources).length === 0) {
      scoreboard.innerHTML = '<p style="color:#888;padding:10px;">No faction data available</p>';
      return;
    }

    // Sort factions by total resources (wood + stone + grain)
    const factions = Object.keys(factionResources).map(id => ({
      id,
      name: typeof houseList !== 'undefined' && houseList && houseList[id] ? houseList[id].name : id,
      resources: factionResources[id]
    })).sort((a, b) => {
      const totalA = (a.resources.wood || 0) + (a.resources.stone || 0) + (a.resources.grain || 0);
      const totalB = (b.resources.wood || 0) + (b.resources.stone || 0) + (b.resources.grain || 0);
      return totalB - totalA;
    });

    // Build HTML
    let html = '<h3>🏆 Faction Resources</h3>';
    html += '<table style="width:100%;border-collapse:collapse;">';
    html += '<thead><tr><th>Faction</th><th>Wood</th><th>Stone</th><th>Grain</th></tr></thead>';
    html += '<tbody>';

    for (const faction of factions) {
      html += '<tr>';
      html += `<td>${faction.name}</td>`;
      html += `<td>${faction.resources.wood || 0}</td>`;
      html += `<td>${faction.resources.stone || 0}</td>`;
      html += `<td>${faction.resources.grain || 0}</td>`;
      html += '</tr>';
    }

    html += '</tbody></table>';
    scoreboard.innerHTML = html;
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
