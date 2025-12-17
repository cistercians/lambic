// SerfWorkManager - Handles work building and spot assignment
// Centralizes task assignment logic for better maintainability

class SerfWorkManager {
  constructor() {
    // Gender-based work restrictions
    this.femaleBuildingTypes = ['mill', 'farm'];
    this.maleBuildingTypes = ['mill', 'farm', 'lumbermill', 'mine', 'dock'];
  }

  /**
   * Assign a work building to a serf
   * Finds nearest appropriate building based on gender
   * 
   * @param {Object} serf - The serf entity
   * @returns {string|null} - Building ID or null if none found
   */
  assignWorkBuilding(serf) {
    try {
      // Validate serf
      if (!serf) {
        return null;
      }

      if (!serf.house) {
        return null;
      }

      // Ensure work object exists
      if (!serf.work) {
        serf.work = { hq: null, spot: null, assignedSpot: null };
      }

      if (!serf.inventory) {
        serf.inventory = {};
      }

      let bestHQ = null;
      let bestDistance = Infinity;

      // Get valid building types for this serf's gender
      const validBuildingTypes = serf.sex === 'f' 
        ? this.femaleBuildingTypes 
        : this.maleBuildingTypes;

      // Look for work buildings in the same house
      const BuildingList = global.Building && global.Building.list ? global.Building.list : {};
      
      if (!BuildingList || typeof BuildingList !== 'object') {
        return null;
      }

      for (const i in BuildingList) {
        try {
          const b = BuildingList[i];
          if (!b || typeof b !== 'object') {
            continue;
          }

          if (b.house === serf.house && validBuildingTypes.indexOf(b.type) !== -1) {
            if (typeof b.x === 'number' && typeof b.y === 'number' && 
                typeof serf.x === 'number' && typeof serf.y === 'number') {
              const dist = global.getDistance 
                ? global.getDistance({ x: serf.x, y: serf.y }, { x: b.x, y: b.y })
                : Infinity;
              
              if (isFinite(dist) && dist < bestDistance) {
                bestDistance = dist;
                bestHQ = i;
              }
            }
          }
        } catch (error) {
          // Skip invalid building
          continue;
        }
      }

      // If no work found in own house and female, try allied houses
      if (!bestHQ && serf.sex === 'f' && serf.house) {
        try {
          const myHouse = global.House && global.House.list ? global.House.list[serf.house] : null;
          if (myHouse && myHouse.allies && Array.isArray(myHouse.allies)) {
            for (const i in BuildingList) {
              try {
                const b = BuildingList[i];
                if (!b || typeof b !== 'object') {
                  continue;
                }

                // Check if building is mill/farm and house is allied
                if ((b.type === 'mill' || b.type === 'farm') && 
                    b.house && 
                    myHouse.allies.indexOf(b.house) !== -1) {
                  if (typeof b.x === 'number' && typeof b.y === 'number' && 
                      typeof serf.x === 'number' && typeof serf.y === 'number') {
                    const dist = global.getDistance 
                      ? global.getDistance({ x: serf.x, y: serf.y }, { x: b.x, y: b.y })
                      : Infinity;
                    
                    if (isFinite(dist) && dist < bestDistance && dist <= 2000) { // Within reasonable distance
                      bestDistance = dist;
                      bestHQ = i;
                    }
                  }
                }
              } catch (error) {
                // Skip invalid building
                continue;
              }
            }
          }
        } catch (error) {
          // Allied house check failed, continue with what we have
        }
      }

      if (bestHQ && BuildingList[bestHQ]) {
        try {
          serf.work.hq = bestHQ;
          const buildingType = BuildingList[bestHQ].type;

          // Only miners need torches for caves
          if (buildingType === 'mine' && BuildingList[bestHQ].cave) {
            serf.torchBearer = true;
            serf.inventory.torch = 3; // Torchbearers get 3 torches (free light, don't consume)
          } else {
            serf.torchBearer = false;
          }

          return bestHQ;
        } catch (error) {
          // Assignment failed
          serf.work.hq = null;
          return null;
        }
      } else {
        serf.work.hq = null;
        return null;
      }
    } catch (error) {
      // Error in assignment
      if (serf && serf.work) {
        serf.work.hq = null;
      }
      return null;
    }
  }

  /**
   * Assign a work spot from building resources
   * Uses building's spot management system
   * 
   * @param {Object} serf - The serf entity
   * @param {Object} building - The work building
   * @returns {Array|null} - [col, row] spot or null if none available
   */
  assignWorkSpot(serf, building) {
    try {
      // Validate inputs
      if (!serf || !building) {
        return null;
      }

      if (!serf.work) {
        serf.work = { hq: null, spot: null, assignedSpot: null };
      }

      // If serf already has assigned spot for today, reuse it
      if (serf.work.assignedSpot && Array.isArray(serf.work.assignedSpot) && 
          building.assignedSpots && building.assignedSpots[serf.id]) {
        try {
          const spot = serf.work.assignedSpot;

          // Verify spot still valid (has resources)
          let stillValid = false;
          if (building.resources && Array.isArray(building.resources)) {
            for (const i in building.resources) {
              const r = building.resources[i];
              if (Array.isArray(r) && r.length === 2 && 
                  r[0] === spot[0] && r[1] === spot[1]) {
                stillValid = true;
                break;
              }
            }
          }

          if (stillValid) {
            serf.work.spot = spot;
            return spot;
          } else {
            // Spot depleted, release it and get new one
            try {
              if (building.releaseSpot && typeof building.releaseSpot === 'function') {
                building.releaseSpot(serf.id);
              }
            } catch (error) {
              // Release failed, continue
            }
            serf.work.assignedSpot = null;
          }
        } catch (error) {
          // Reuse failed, get new spot
          serf.work.assignedSpot = null;
        }
      }

      // Update building resources before assigning
      try {
        if (building.updateResources && typeof building.updateResources === 'function') {
          building.updateResources();
        }
      } catch (error) {
        // Update failed, continue with existing resources
      }

      // Find available unassigned spots
      if (!building.resources || !Array.isArray(building.resources) || building.resources.length === 0) {
        return null;
      }

      const availableSpots = [];
      for (const i in building.resources) {
        try {
          const res = building.resources[i];
          if (Array.isArray(res) && res.length === 2) {
            if (building.isSpotAvailable && typeof building.isSpotAvailable === 'function') {
              if (building.isSpotAvailable(res)) {
                availableSpots.push(res);
              }
            } else {
              // No availability check - assume available
              availableSpots.push(res);
            }
          }
        } catch (error) {
          // Skip invalid resource
          continue;
        }
      }

      if (availableSpots.length === 0) {
        return null;
      }

      // Assign random available spot
      try {
        const selected = availableSpots[Math.floor(Math.random() * availableSpots.length)];
        if (Array.isArray(selected) && selected.length === 2) {
          serf.work.assignedSpot = selected;
          serf.work.spot = selected;
          
          if (building.assignSpot && typeof building.assignSpot === 'function') {
            building.assignSpot(serf.id, selected);
          }

          return selected;
        }
      } catch (error) {
        // Assignment failed
        return null;
      }

      return null;
    } catch (error) {
      // Error in spot assignment
      return null;
    }
  }

  /**
   * Validate if current work assignment is still valid
   * 
   * @param {Object} serf - The serf entity
   * @returns {boolean} - True if assignment is valid
   */
  validateWorkAssignment(serf) {
    try {
      // Validate serf
      if (!serf) {
        return false;
      }

      if (!serf.work || !serf.work.hq) {
        return false;
      }

      const BuildingList = global.Building && global.Building.list ? global.Building.list : {};
      if (!BuildingList || typeof BuildingList !== 'object') {
        return false;
      }

      const building = BuildingList[serf.work.hq];
      if (!building || typeof building !== 'object') {
        return false;
      }

      // Check if building still exists and is valid
      if (!building.built) {
        return false;
      }

      // Check if spot is still valid
      if (serf.work.spot) {
        try {
          const spot = serf.work.spot;
          if (!Array.isArray(spot) || spot.length !== 2) {
            this.releaseWorkSpot(serf);
            return false;
          }

          let spotValid = false;
          if (building.resources && Array.isArray(building.resources)) {
            for (const i in building.resources) {
              const r = building.resources[i];
              if (Array.isArray(r) && r.length === 2 && 
                  r[0] === spot[0] && r[1] === spot[1]) {
                spotValid = true;
                break;
              }
            }
          }

          if (!spotValid) {
            // Spot depleted
            this.releaseWorkSpot(serf);
            return false;
          }
        } catch (error) {
          // Spot validation failed
          this.releaseWorkSpot(serf);
          return false;
        }
      }

      return true;
    } catch (error) {
      // Validation failed
      return false;
    }
  }

  /**
   * Release a work spot
   * 
   * @param {Object} serf - The serf entity
   */
  releaseWorkSpot(serf) {
    try {
      if (!serf) {
        return;
      }

      if (!serf.work) {
        serf.work = { hq: null, spot: null, assignedSpot: null };
        return;
      }

      if (!serf.work.hq) {
        serf.work.assignedSpot = null;
        serf.work.spot = null;
        return;
      }

      const BuildingList = global.Building && global.Building.list ? global.Building.list : {};
      if (BuildingList && typeof BuildingList === 'object') {
        const building = BuildingList[serf.work.hq];
        if (building && building.releaseSpot && typeof building.releaseSpot === 'function') {
          try {
            building.releaseSpot(serf.id);
          } catch (error) {
            // Release failed, continue to clear serf's spot
          }
        }
      }

      serf.work.assignedSpot = null;
      serf.work.spot = null;
    } catch (error) {
      // Error releasing spot - try to clear serf's spot anyway
      if (serf && serf.work) {
        serf.work.assignedSpot = null;
        serf.work.spot = null;
      }
    }
  }

  /**
   * Get work building for a serf
   * 
   * @param {Object} serf - The serf entity
   * @returns {Object|null} - Building object or null
   */
  getWorkBuilding(serf) {
    try {
      if (!serf) {
        return null;
      }

      if (!serf.work || !serf.work.hq) {
        return null;
      }

      const BuildingList = global.Building && global.Building.list ? global.Building.list : {};
      if (!BuildingList || typeof BuildingList !== 'object') {
        return null;
      }

      const building = BuildingList[serf.work.hq];
      if (building && typeof building === 'object') {
        return building;
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = SerfWorkManager;

