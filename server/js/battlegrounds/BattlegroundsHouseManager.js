/**
 * BattlegroundsHouseManager - Manages temporary House overrides for battleground rules
 */

class BattlegroundsHouseManager {
  constructor() {
    this.temporaryHouses = {}; // Store temporary houses by match ID
    this.houseCounter = -1000000; // Start with negative IDs to avoid conflicts
  }

  /**
   * Create temporary Houses for a battleground match
   * @param {object} match - Match object
   */
  createBattlegroundHouses(match) {
    if (!match) return;
    
    const houses = {};
    const { gameMode, teams } = match;
    
    if (gameMode === 'deathmatch') {
      // Each player gets unique House (all hostile to each other)
      match.participants.forEach(participant => {
        const houseId = this.getNextHouseId();
        const house = this.createTemporaryHouse(houseId, `BG_${participant.id}`, true);
        houses[participant.id] = houseId;
        this.temporaryHouses[houseId] = house;
        match.teams[participant.id] = { houseId: houseId, team: 'solo' };
      });
    } else if (gameMode === 'skirmish' || gameMode === 'assault') {
      // Two Houses (hostile to each other)
      const house1Id = this.getNextHouseId();
      const house2Id = this.getNextHouseId();
      
      const house1 = this.createTemporaryHouse(house1Id, 'BG_Team1', true);
      const house2 = this.createTemporaryHouse(house2Id, 'BG_Team2', true);
      
      // Set them as enemies
      house1.enemies = [house2Id];
      house2.enemies = [house1Id];
      
      houses.team1 = house1Id;
      houses.team2 = house2Id;
      
      this.temporaryHouses[house1Id] = house1;
      this.temporaryHouses[house2Id] = house2;
      
      match.teams.team1.houseId = house1Id;
      match.teams.team2.houseId = house2Id;
    }
    
    match.temporaryHouses = houses;
  }

  /**
   * Create a temporary House
   */
  createTemporaryHouse(id, name, hostile) {
    // Use House constructor if available
    if (typeof global.House === 'function') {
      const house = global.House({
        id: id,
        type: 'battleground',
        name: name,
        hostile: hostile,
        hq: [0, 0], // Dummy HQ
        leader: null,
        kingdom: null
      });
      
      // Mark as temporary
      house.isBattlegroundHouse = true;
      house.temporary = true;
      
      return house;
    }
    
    // Fallback: create minimal house object
    return {
      id: id,
      name: name,
      hostile: hostile,
      enemies: [],
      allies: [],
      isBattlegroundHouse: true,
      temporary: true
    };
  }

  /**
   * Get next available House ID
   */
  getNextHouseId() {
    return this.houseCounter--;
  }

  /**
   * Cleanup temporary Houses after match
   */
  cleanupBattlegroundHouses(match) {
    if (!match || !match.temporaryHouses) return;
    
    Object.values(match.temporaryHouses).forEach(houseId => {
      const house = this.temporaryHouses[houseId];
      if (house) {
        // Remove from House.list if it exists
        if (global.House && global.House.list && global.House.list[houseId]) {
          delete global.House.list[houseId];
        }
        delete this.temporaryHouses[houseId];
      }
    });
  }

  /**
   * Get temporary House by ID
   */
  getTemporaryHouse(houseId) {
    return this.temporaryHouses[houseId] || null;
  }

  /**
   * Check if a House ID is a temporary battleground House
   */
  isTemporaryHouse(houseId) {
    return this.temporaryHouses[houseId] !== undefined;
  }
}

module.exports = BattlegroundsHouseManager;




