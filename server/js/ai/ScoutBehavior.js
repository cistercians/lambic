// Scout Behavior System
// Scouts physically explore the map and report discoveries back to base

class ScoutBehavior {
  constructor(unit, house) {
    this.unit = unit;
    this.house = house;
    this.mission = null; // Current scouting mission
    this.discoveries = []; // Things found this mission
    this.returningToBase = false;
    this.scanRadius = 3; // How far scout can see
  }
  
  // Assign scouting mission to a destination
  assignMission(destination) {
    this.mission = {
      destination,
      startTime: Date.now(),
      startLocation: [this.unit.x, this.unit.y]
    };
    this.returningToBase = false;
    this.discoveries = [];
    
    console.log(`Scout ${this.unit.id} assigned mission to [${destination}]`);
  }
  
  // Called each update tick (continuous scanning)
  update() {
    if (!this.mission) return;
    
    // Check surroundings for discoveries
    this.scanArea();
    
    // If reached destination, head back to base
    if (this.reachedDestination()) {
      this.returnToBase();
    }
    
    // If back at base, file report
    if (this.isAtBase() && this.returningToBase) {
      this.fileReport();
    }
  }
  
  // Scan area around scout for discoveries
  scanArea() {
    const currentLoc = this.getUnitLocation();
    const area = this.getArea(currentLoc, this.scanRadius);
    
    for (const tile of area) {
      // Check for resources
      const resourceDensity = this.analyzeResourceDensity(tile, this.scanRadius);
      if (resourceDensity.total > 10) {
        // Found significant resources
        this.discoveries.push({
          type: 'RESOURCE',
          location: tile,
          resourceType: resourceDensity.primaryType,
          density: resourceDensity.total,
          tiles: area
        });
      }
      
      // Check for enemy units
      const enemies = this.getEnemiesAt(tile);
      if (enemies.length > 0) {
        this.discoveries.push({
          type: 'ENEMY',
          location: tile,
          enemies: enemies.map(e => ({
            type: e.class,
            house: e.house,
            id: e.id
          })),
          threatLevel: this.calculateThreatLevel(enemies),
          tiles: [tile]
        });
        
        // If enemies are dangerous, abort mission and return
        if (this.calculateThreatLevel(enemies) > 50) {
          console.log(`Scout ${this.unit.id} detected high threat, returning to base`);
          this.returnToBase();
        }
      }
    }
  }
  
  // Analyze resource density at location
  analyzeResourceDensity(tile, radius) {
    const area = this.getArea(tile, radius);
    const resources = {
      forest: 0,
      rocks: 0,
      farmland: 0,
      cave: 0
    };
    
    for (const t of area) {
      const terrain = this.getTerrain(t[0], t[1]);
      
      // Count terrain types
      if (terrain === 1 || terrain === 2) resources.forest++; // HEAVY_FOREST or LIGHT_FOREST
      if (terrain === 4) resources.rocks++; // ROCKS
      if (terrain === 7 || terrain === 3) resources.farmland++; // EMPTY or BRUSH
      if (terrain === 6) resources.cave++; // CAVE_ENTRANCE
    }
    
    // Determine primary resource and total value
    let primaryType = 'farmland';
    let maxCount = resources.farmland;
    
    if (resources.forest > maxCount) {
      primaryType = 'forest';
      maxCount = resources.forest;
    }
    if (resources.rocks > maxCount) {
      primaryType = 'rocks';
      maxCount = resources.rocks;
    }
    if (resources.cave > 0) {
      primaryType = 'cave';
      maxCount = resources.cave * 20; // Caves are very valuable
    }
    
    return {
      ...resources,
      primaryType,
      total: resources.forest + resources.rocks + resources.farmland + (resources.cave * 20)
    };
  }
  
  // Calculate threat level of enemies
  calculateThreatLevel(enemies) {
    let threat = 0;
    
    for (const enemy of enemies) {
      // Simple threat calculation based on class
      if (enemy.class && enemy.class.includes('Knight')) threat += 30;
      else if (enemy.class && enemy.class.includes('Soldier')) threat += 20;
      else if (enemy.class && enemy.class.includes('Archer')) threat += 15;
      else threat += 10;
    }
    
    return Math.min(threat, 100);
  }
  
  // Check if scout has reached destination
  reachedDestination() {
    if (!this.mission || this.returningToBase) return false;
    
    const currentLoc = this.getUnitLocation();
    const dist = this.getDistance(currentLoc, this.mission.destination);
    
    return dist < 2; // Within 2 tiles
  }
  
  // Tell scout to return to base
  returnToBase() {
    if (this.returningToBase) return;
    
    this.returningToBase = true;
    console.log(`Scout ${this.unit.id} returning to base with ${this.discoveries.length} discoveries`);
    
    // TODO: Set unit's path back to HQ
    // For now, we'll check distance in isAtBase()
  }
  
  // Check if scout is at base
  isAtBase() {
    const currentLoc = this.getUnitLocation();
    const hqLoc = this.house.hq;
    const dist = this.getDistance(currentLoc, hqLoc);
    
    return dist < 5; // Within 5 tiles of HQ
  }
  
  // File report with faction AI
  fileReport() {
    if (!this.house.ai || !this.house.ai.knowledge) {
      console.warn(`Scout ${this.unit.id}: No AI knowledge system to report to`);
      return;
    }
    
    // Report all unique discoveries to faction AI
    const uniqueDiscoveries = this.getUniqueDiscoveries();
    
    uniqueDiscoveries.forEach(discovery => {
      this.house.ai.knowledge.reportDiscovery(this.unit, discovery);
    });
    
    console.log(`Scout ${this.unit.id} filed report: ${uniqueDiscoveries.length} unique discoveries`);
    
    // Clear mission
    this.mission = null;
    this.discoveries = [];
    this.returningToBase = false;
  }
  
  // Get unique discoveries (remove duplicates)
  getUniqueDiscoveries() {
    const seen = new Set();
    const unique = [];
    
    for (const discovery of this.discoveries) {
      const key = `${discovery.type}:${discovery.location[0]},${discovery.location[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(discovery);
      }
    }
    
    return unique;
  }
  
  // Helpers
  getUnitLocation() {
    if (this.unit.loc) {
      return this.unit.loc;
    }
    return [Math.floor(this.unit.x / 64), Math.floor(this.unit.y / 64)];
  }
  
  getArea(tile, radius) {
    if (global.getArea) {
      return global.getArea(tile, tile, radius);
    }
    
    // Fallback
    const area = [];
    for (let c = tile[0] - radius; c <= tile[0] + radius; c++) {
      for (let r = tile[1] - radius; r <= tile[1] + radius; r++) {
        area.push([c, r]);
      }
    }
    return area;
  }
  
  getTerrain(c, r) {
    if (global.getTile) {
      return global.getTile(0, c, r);
    }
    return 7; // Default to EMPTY
  }
  
  getEnemiesAt(tile) {
    const enemies = [];
    
    if (typeof Player !== 'undefined' && Player.list) {
      for (const id in Player.list) {
        const player = Player.list[id];
        const playerLoc = [Math.floor(player.x / 64), Math.floor(player.y / 64)];
        
        // Check if enemy and at this location
        if (this.isEnemy(player) && playerLoc[0] === tile[0] && playerLoc[1] === tile[1]) {
          enemies.push(player);
        }
      }
    }
    
    return enemies;
  }
  
  isEnemy(entity) {
    if (!entity.house) return false;
    if (entity.house === this.house.id) return false;
    
    // Check if house is in enemies list
    return this.house.enemies && this.house.enemies.includes(entity.house);
  }
  
  getDistance(point1, point2) {
    if (global.getDistance) {
      return global.getDistance(
        {x: point1[0], y: point1[1]},
        {x: point2[0], y: point2[1]}
      );
    }
    
    const dx = point1[0] - point2[0];
    const dy = point1[1] - point2[1];
    return Math.sqrt(dx * dx + dy * dy);
  }
}

module.exports = ScoutBehavior;

