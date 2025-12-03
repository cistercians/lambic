/**
 * AllyCheckHelper - Helper for checking faction relationships
 * 
 * Extracted from client.js for better organization.
 * Returns: 2 = same faction, 1 = ally, 0 = neutral, -1 = enemy
 */

class AllyCheckHelper {
  constructor() {
    // Dependencies would be injected
  }

  /**
   * Check faction relationship
   * @param {string} id - Entity ID to check
   * @param {object} config - Configuration
   * @param {string} config.selfId - Player ID
   * @param {object} config.PlayerList - Player list
   * @param {object} config.houseList - House list
   * @param {object} config.kingdomList - Kingdom list
   * @returns {number} Relationship (2=same, 1=ally, 0=neutral, -1=enemy)
   */
  check(id, config) {
    const { selfId, PlayerList, houseList, kingdomList } = config;

    // During login mode, treat everyone as neutral
    if (!selfId || !PlayerList[selfId] || !houseList || !kingdomList) {
      return 0;
    }

    // Check if checking against self
    if (selfId === id) return 2; // Same entity

    const player = PlayerList[selfId];
    const other = PlayerList[id];

    // Safety check: ensure both entities exist
    if (!player || !other) {
      return 0;
    }

    // Safety check for houses
    if (!houseList) {
      return 0;
    }

    const pHouse = houseList[player.house];
    const oHouse = houseList[other.house];

    if (pHouse) {
      if (pHouse.hostile) {
        if (oHouse) {
          if (player.house === other.house) {
            return 2; // Same house
          } else {
            // Check allies
            for (const allyId of pHouse.allies || []) {
              if (allyId === other.house) {
                return 1; // Ally
              }
            }
            return -1; // Enemy
          }
        } else {
          return -1; // No house = enemy
        }
      } else {
        if (oHouse) {
          if (player.house === other.house) {
            return 2; // Same house
          } else {
            // Check allies
            for (const allyId of pHouse.allies || []) {
              if (allyId === other.house) {
                return 1; // Ally
              }
            }
            // Check if other house is hostile
            if (oHouse.hostile) {
              return -1; // Enemy
            }
            // Check explicit enemies
            for (const enemyId of pHouse.enemies || []) {
              if (enemyId === other.house) {
                return -1; // Enemy
              }
            }
            return 0; // Neutral
          }
        } else {
          // Other has no house - check individual enemies
          for (const enemyId of pHouse.enemies || []) {
            if (enemyId === id) {
              return -1; // Individual enemy
            }
          }
          return 0; // Neutral
        }
      }
    } else {
      // Player has no house
      if (oHouse) {
        if (oHouse.hostile) {
          return -1; // Enemy
        } else {
          // Check if other house has player as enemy
          for (const enemyId of oHouse.enemies || []) {
            if (enemyId === selfId) {
              return -1; // Enemy
            }
          }
          return 0; // Neutral
        }
      } else {
        // Both have no house - check wild animals and individual relationships
        const wildAnimals = ['Wolf', 'Boar'];
        if (wildAnimals.includes(player.class) || wildAnimals.includes(other.class)) {
          return -1; // Hostile
        }

        // Check friends
        for (const friendId of player.friends || []) {
          if (friendId === id) {
            return 1; // Friend
          }
        }

        // Check enemies
        for (const enemyId of player.enemies || []) {
          if (enemyId === id) {
            return -1; // Enemy
          }
        }

        return 0; // Neutral
      }
    }
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.AllyCheckHelper = AllyCheckHelper;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AllyCheckHelper;
}
