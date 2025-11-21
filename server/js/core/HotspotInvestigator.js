// HotspotInvestigator.js - Investigate common stuck locations
// This utility helps diagnose why specific waypoints cause entities to get stuck

class HotspotInvestigator {
  constructor() {
    this.investigations = new Map();
  }
  
  // Investigate a specific waypoint location
  investigateWaypoint(waypointStr) {
    const [x, y] = waypointStr.split(',').map(Number);
    
    if (!x || !y) {
      return null;
    }
    
    const investigation = {
      waypoint: waypointStr,
      location: [x, y],
      timestamp: new Date().toISOString(),
      findings: []
    };
    
    // Check all z-levels
    for (let z of [0, -1, 1, -2, -3]) {
      const tile = global.getTile ? global.getTile(z, x, y) : null;
      const walkable = global.isWalkable ? global.isWalkable(z, x, y) : null;
      
      investigation.findings.push({
        z: z,
        tile: tile,
        walkable: walkable,
        description: this.describeTile(tile, z)
      });
    }
    
    // Check for buildings at this location
    const building = global.getBuilding ? global.getBuilding(x * global.tileSize, y * global.tileSize) : null;
    if (building) {
      investigation.building = {
        id: building,
        type: global.Building && global.Building.list[building] ? global.Building.list[building].type : 'unknown'
      };
    }
    
    // Check surrounding tiles
    investigation.surroundings = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nearX = x + dx;
        const nearY = y + dy;
        const nearTile = global.getTile ? global.getTile(0, nearX, nearY) : null;
        const nearWalkable = global.isWalkable ? global.isWalkable(0, nearX, nearY) : null;
        
        investigation.surroundings.push({
          offset: [dx, dy],
          location: [nearX, nearY],
          tile: nearTile,
          walkable: nearWalkable
        });
      }
    }
    
    this.investigations.set(waypointStr, investigation);
    return investigation;
  }
  
  // Describe what a tile represents
  describeTile(tile, z) {
    // Common tile types (adjust based on your TERRAIN constants)
    const descriptions = {
      0: 'Water/Empty',
      1: 'Grass',
      2: 'Light Forest',
      3: 'Heavy Forest',
      4: 'Rocks',
      5: 'Mountain',
      6: 'Sand',
      7: 'Road',
      14: 'Door (Open)',
      16: 'Door (Open Alt)',
      17: 'Door (Locked)',
      19: 'Cave Entrance',
      20: 'Wood Floor',
      21: 'Stone Floor',
      22: 'Wood Wall',
      23: 'Stone Wall',
      24: 'Cave Wall',
      25: 'Cave Floor'
    };
    
    return descriptions[tile] || `Unknown (${tile})`;
  }
  
  // Automatically investigate top stuck waypoints
  investigateTopHotspots(limit = 10) {
    if (!global.stuckEntityAnalytics) {
      return;
    }
    
    const stats = global.stuckEntityAnalytics.getStats();
    const topWaypoints = stats.topStuckWaypoints.slice(0, limit);
    
    
    for (const {waypoint, count} of topWaypoints) {
      const investigation = this.investigateWaypoint(waypoint);
      
      if (investigation) {
        
        // Report findings for overworld (z=0)
        const overworldFinding = investigation.findings.find(f => f.z === 0);
        if (overworldFinding) {
        }
        
        // Report building if present
        if (investigation.building) {
        }
        
        // Check if surrounded by unwalkable tiles
        const walkableSurroundings = investigation.surroundings.filter(s => s.walkable);
        
        if (walkableSurroundings.length < 3) {
        }
      }
    }
    
  }
  
  // Get investigation results
  getInvestigation(waypointStr) {
    return this.investigations.get(waypointStr);
  }
  
  // Export all investigations
  exportInvestigations() {
    const results = {};
    for (const [waypoint, investigation] of this.investigations) {
      results[waypoint] = investigation;
    }
    return results;
  }
}

module.exports = HotspotInvestigator;






