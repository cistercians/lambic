/**
 * TransitionPlanner - Z-level transition helper
 * 
 * Minimal stub to provide z-level to layer mapping
 * This was referenced in lambic.js but file didn't exist
 */

class TransitionPlanner {
  constructor(options = {}) {
    this.tilemapSystem = options.tilemapSystem || null;
    this.logger = options.logger || (() => {});
  }

  /**
   * Map z-level to tilemap layer (static method)
   */
  static getLayerForZ(z) {
    const layerMap = {
      0: 0,    // Overworld
      '-1': 1, // Cave
      1: 3,    // Building floor 1
      2: 5,    // Building floor 2
      '-2': 8, // Cellar
      '-3': 2  // Underwater
    };
    return layerMap[z] !== undefined ? layerMap[z] : 0;
  }

  /**
   * Map layer to z-level (static method)
   */
  static getZForLayer(layer) {
    const zMap = {
      0: 0,    // Overworld
      1: -1,   // Cave
      3: 1,    // Building floor 1
      5: 2,    // Building floor 2
      8: -2,   // Cellar
      2: -3    // Underwater
    };
    return zMap[layer] !== undefined ? zMap[layer] : 0;
  }

  /**
   * Check if navigation requires crossing buildings (static method)
   */
  static needsCrossBuildingNav(startZ, endZ) {
    // Simplified logic - returns true if transitioning between different building floors
    return (startZ === 1 && endZ === 2) || (startZ === 2 && endZ === 1);
  }

  /**
   * Build navigation context (static method)
   */
  static buildContext(entity, destination) {
    return {
      startZ: entity.z,
      endZ: destination.z || entity.z,
      startLoc: global.getLoc ? global.getLoc(entity.x, entity.y) : [0, 0],
      endLoc: destination.loc || [destination.col || 0, destination.row || 0]
    };
  }

  // Instance methods (delegate to static)
  getLayerForZ(z) {
    return TransitionPlanner.getLayerForZ(z);
  }

  getZForLayer(layer) {
    return TransitionPlanner.getZForLayer(layer);
  }

  needsCrossBuildingNav(startZ, endZ) {
    return TransitionPlanner.needsCrossBuildingNav(startZ, endZ);
  }

  buildContext(entity, destination) {
    return TransitionPlanner.buildContext(entity, destination);
  }
}

module.exports = { TransitionPlanner };
