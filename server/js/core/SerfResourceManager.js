// SerfResourceManager - Consolidated resource deposit logic
// Eliminates ~400 lines of duplicated code across Serf work activities

class SerfResourceManager {
  constructor() {
    this.BUILDING_SHARE = 0.85; // 85% to building
    this.SERF_WAGE = 0.15; // 15% wage for serf
  }

  /**
   * Deposit a resource to a building
   * Handles building share (85%) vs serf wage (15%), events, and daily tracking
   * 
   * @param {Object} serf - The serf entity
   * @param {string} resourceType - Type of resource: 'grain', 'wood', 'stone', 'ironore', 'silverore', 'goldore', 'diamond'
   * @param {Object} building - The building to deposit to
   * @param {number} amount - Optional: specific amount to deposit (defaults to all in inventory)
   * @returns {boolean} - True if deposit was successful
   */
  depositResource(serf, resourceType, building, amount = null) {
    try {
      // Validate inputs
      if (!serf || !building) {
        return false;
      }

      if (!serf.inventory) {
        serf.inventory = {};
      }

      if (!serf.stores) {
        serf.stores = {};
      }

      if (!resourceType || typeof resourceType !== 'string') {
        return false;
      }

      // For single-item resources (silverore, goldore, diamond), deposit one at a time
      const singleItemResources = ['silverore', 'goldore', 'diamond'];
      const isSingleItem = singleItemResources.includes(resourceType);
      
      if (amount === null) {
        amount = serf.inventory[resourceType] || 0;
      }
      
      // Bounds checking
      if (typeof amount !== 'number' || amount <= 0 || !isFinite(amount)) {
        return false;
      }

      // For single-item resources, always deposit 1 at a time
      if (isSingleItem && amount > 1) {
        amount = 1;
      }

      // Calculate shares (for bulk resources like grain/wood/stone/ironore)
      // Single-item resources go 100% to building (no wage split)
      let buildingShare, serfWage;
      if (isSingleItem) {
        buildingShare = amount;
        serfWage = 0;
      } else {
        buildingShare = Math.floor(amount * this.BUILDING_SHARE);
        serfWage = amount - buildingShare;
      }

      // Clear serf inventory (subtract amount, not set to 0 for single-item resources)
      serf.inventory[resourceType] = Math.max(0, (serf.inventory[resourceType] || 0) - amount);

      // Give serf their wage (only for bulk resources)
      if (serfWage > 0) {
        serf.stores[resourceType] = (serf.stores[resourceType] || 0) + serfWage;
      }

      // Deposit to building's house (not owner) - CRITICAL FIX
      let deposited = false;
      try {
        if (building.house && global.House && global.House.list && global.House.list[building.house]) {
          const house = global.House.list[building.house];
          if (house && house.stores) {
            house.stores[resourceType] = (house.stores[resourceType] || 0) + buildingShare;
            deposited = true;

            // Create deposit event
            try {
              if (global.eventManager && typeof global.eventManager.createEvent === 'function' && buildingShare > 0) {
                global.eventManager.createEvent({
                  category: global.eventManager.categories?.ECONOMIC,
                  subject: serf.id,
                  subjectName: serf.name || serf.class,
                  action: `deposited ${resourceType}`,
                  target: building.house,
                  targetName: house.name,
                  quantity: buildingShare,
                  communication: global.eventManager.commModes?.NONE,
                  log: `[ECONOMIC] ${serf.name || serf.class} deposited ${buildingShare} ${resourceType} to ${house.name}`,
                  position: { x: serf.x, y: serf.y, z: serf.z }
                });
              }
            } catch (error) {
              // Event creation failed, but deposit succeeded
            }
          }
        } else if (global.Player && global.Player.list && building.owner && global.Player.list[building.owner]) {
          const owner = global.Player.list[building.owner];
          if (owner) {
            if (owner.house && global.House && global.House.list && global.House.list[owner.house]) {
              // Fallback: owner's house
              const house = global.House.list[owner.house];
              if (house && house.stores) {
                house.stores[resourceType] = (house.stores[resourceType] || 0) + buildingShare;
                deposited = true;
              }
            } else if (owner.stores) {
              // Independent player
              owner.stores[resourceType] = (owner.stores[resourceType] || 0) + buildingShare;
              deposited = true;
            }
          }
        }
      } catch (error) {
        // Deposit failed - return false
        return false;
      }

      // Track daily deposits (building share only)
      if (building) {
        if (!building.dailyStores) {
          building.dailyStores = {};
        }
        building.dailyStores[resourceType] = (building.dailyStores[resourceType] || 0) + buildingShare;
      }

      // Special handling for grain -> flour conversion (mills only)
      if (resourceType === 'grain' && building.type === 'mill' && serf.inventory) {
        try {
          // Convert deposited grain to flour (3:1 ratio - uses building's share only)
          serf.inventory.flour = (serf.inventory.flour || 0) + Math.floor(buildingShare / 3);
        } catch (error) {
          // Flour conversion failed, but deposit succeeded
        }
      }

      return deposited;
    } catch (error) {
      // Error in deposit - return false
      return false;
    }
  }

  /**
   * Check if serf has resources to deposit
   * 
   * @param {Object} serf - The serf entity
   * @returns {boolean} - True if serf has any resources
   */
  hasResourcesToDeposit(serf) {
    try {
      if (!serf) {
        return false;
      }

      if (!serf.inventory) {
        return false;
      }

      return ((serf.inventory.wood || 0) >= 1) ||
             ((serf.inventory.stone || 0) >= 1) ||
             ((serf.inventory.ironore || 0) >= 1) ||
             ((serf.inventory.silverore || 0) >= 1) ||
             ((serf.inventory.goldore || 0) >= 1) ||
             ((serf.inventory.diamond || 0) >= 1) ||
             ((serf.inventory.grain || 0) >= 1);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the dropoff location for a building
   * Standard dropoff is one tile south of the first plot tile
   * 
   * @param {Object} building - The building
   * @returns {Array|null} - [col, row] or null if building has no plot
   */
  getDropoffLocation(building) {
    try {
      if (!building) {
        return null;
      }

      if (!building.plot || !Array.isArray(building.plot) || building.plot.length === 0) {
        return null;
      }

      const firstPlot = building.plot[0];
      if (!Array.isArray(firstPlot) || firstPlot.length !== 2) {
        return null;
      }

      const col = firstPlot[0];
      const row = firstPlot[1];

      if (typeof col !== 'number' || typeof row !== 'number' || !isFinite(col) || !isFinite(row)) {
        return null;
      }

      return [col, row + 1];
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if serf is at the dropoff location
   * 
   * @param {Object} serf - The serf entity
   * @param {Object} building - The building
   * @returns {boolean} - True if serf is at dropoff
   */
  isAtDropoff(serf, building) {
    try {
      if (!serf || !building) {
        return false;
      }

      const dropoff = this.getDropoffLocation(building);
      if (!dropoff || !Array.isArray(dropoff) || dropoff.length !== 2) {
        return false;
      }

      const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
        Math.floor(serf.x / 64),
        Math.floor(serf.y / 64)
      ];

      if (!loc || !Array.isArray(loc) || loc.length !== 2) {
        return false;
      }

      return loc.toString() === dropoff.toString();
    } catch (error) {
      return false;
    }
  }
}

module.exports = SerfResourceManager;

