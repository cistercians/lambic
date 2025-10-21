// Building Constructor for AI
// Handles actual building placement and construction for AI goals

class BuildingConstructor {
  constructor(house) {
    this.house = house;
  }
  
  // Construct a mill
  buildMill(location = null) {
    const hq = this.house.hq;
    const searchCenter = location || hq;
    const radius = location ? 3 : 10;
    
    // Find suitable location using tilemap system
    const spot = global.tilemapSystem.findBuildingSpot('mill', searchCenter, radius, {
      excludeTiles: this.getOccupiedTiles()
    });
    
    if (!spot) {
      console.log(`${this.house.name}: No valid location for mill`);
      return null;
    }
    
    const plot = spot.plot;
    const topPlot = spot.topPlot;
    const center = global.getCenter(plot[0][0], plot[0][1]);
    
    // Update terrain tiles
    for (const tile of plot) {
      global.tileChange(0, tile[0], tile[1], 13); // BUILD marker
      global.tileChange(3, tile[0], tile[1], `mill${plot.indexOf(tile)}`);
      global.matrixChange(0, tile[0], tile[1], 1); // Block pathfinding
    }
    global.tileChange(5, topPlot[0][0], topPlot[0][1], 'mill4');
    global.tileChange(5, topPlot[1][0], topPlot[1][1], 'mill5');
    
    // Create mill building
    const millId = Math.random();
    Mill({
      id: millId,
      house: this.house.id,
      owner: this.house.id,
      x: center[0],
      y: center[1],
      z: 0,
      type: 'mill',
      built: true,
      plot: plot,
      topPlot: topPlot,
      mats: { wood: 40, stone: 0 },
      req: 5,
      hp: 150
    });
    
    console.log(`${this.house.name}: Built mill at [${plot[0]}]`);
    return millId;
  }
  
  // Construct a farm
  buildFarm(location = null) {
    // Find nearest mill if no location specified
    const mills = this.getBuildingsByType('mill');
    if (mills.length === 0) {
      console.log(`${this.house.name}: Cannot build farm - no mill exists`);
      return null;
    }
    
    const mill = mills[0]; // Use first mill
    const searchCenter = mill.plot[0];
    
    const spot = global.tilemapSystem.findBuildingSpot('farm', searchCenter, 4, {
      excludeTiles: this.getOccupiedTiles()
    });
    
    if (!spot) {
      console.log(`${this.house.name}: No valid location for farm near mill`);
      return null;
    }
    
    const plot = spot.plot;
    const center = global.getCenter(plot[4][0], plot[4][1]);
    
    // Update terrain
    for (const tile of plot) {
      global.tileChange(0, tile[0], tile[1], 8); // FARM_SEED
      global.tileChange(6, tile[0], tile[1], 0);
    }
    
    // Create farm
    Farm({
      house: this.house.id,
      owner: this.house.id,
      x: center[0],
      y: center[1],
      z: 0,
      type: 'farm',
      built: true,
      plot: plot
    });
    
    console.log(`${this.house.name}: Built farm at [${plot[0]}]`);
    return true;
  }
  
  // Construct a mine
  buildMine(location = null) {
    const hq = this.house.hq;
    const searchCenter = location || hq;
    const radius = location ? 3 : 10;
    
    const spot = global.tilemapSystem.findBuildingSpot('mine', searchCenter, radius, {
      excludeTiles: this.getOccupiedTiles()
    });
    
    if (!spot || !spot.plot || !spot.plot[0]) {
      console.log(`${this.house.name}: No valid location for mine`);
      return null;
    }
    
    const plot = spot.plot;
    const center = global.getCenter(plot[0][0], plot[0][1]);
    
    // Update terrain (mines are just a base plot, no topPlot)
    for (let i = 0; i < plot.length; i++) {
      global.tileChange(0, plot[i][0], plot[i][1], 13);
      global.tileChange(3, plot[i][0], plot[i][1], `mine${i}`);
      global.matrixChange(0, plot[i][0], plot[i][1], 1);
    }
    
    // Create mine (no topPlot property needed)
    const mineId = Math.random();
    Mine({
      id: mineId,
      house: this.house.id,
      owner: this.house.id,
      x: center[0],
      y: center[1],
      z: 0,
      type: 'mine',
      built: true,
      plot: plot,
      mats: { wood: 40, stone: 0 },
      req: 5,
      hp: 150
    });
    
    console.log(`${this.house.name}: Built mine at [${plot[0]}]`);
    return mineId;
  }
  
  // Construct a lumbermill
  buildLumbermill(location = null) {
    const hq = this.house.hq;
    const searchCenter = location || hq;
    const radius = location ? 3 : 10;
    
    const spot = global.tilemapSystem.findBuildingSpot('lumbermill', searchCenter, radius, {
      excludeTiles: this.getOccupiedTiles()
    });
    
    if (!spot) {
      console.log(`${this.house.name}: No valid location for lumbermill`);
      return null;
    }
    
    const plot = spot.plot;
    const topPlot = spot.topPlot;
    const center = global.getCenter(plot[0][0], plot[0][1]);
    
    // Update terrain
    for (let i = 0; i < plot.length; i++) {
      global.tileChange(0, plot[i][0], plot[i][1], 13);
      global.tileChange(3, plot[i][0], plot[i][1], `lumbermill${i}`);
      global.matrixChange(0, plot[i][0], plot[i][1], 1);
    }
    global.tileChange(5, topPlot[0][0], topPlot[0][1], 'lumbermill2');
    global.tileChange(5, topPlot[1][0], topPlot[1][1], 'lumbermill3');
    
    // Create lumbermill
    const lumbermillId = Math.random();
    Lumbermill({
      id: lumbermillId,
      house: this.house.id,
      owner: this.house.id,
      x: center[0],
      y: center[1],
      z: 0,
      type: 'lumbermill',
      built: true,
      plot: plot,
      topPlot: topPlot,
      mats: { wood: 35, stone: 0 },
      req: 5,
      hp: 150
    });
    
    console.log(`${this.house.name}: Built lumbermill at [${plot[0]}]`);
    return lumbermillId;
  }
  
  // Construct a garrison
  buildGarrison(location = null) {
    const hq = this.house.hq;
    const searchCenter = location || hq;
    const radius = location ? 3 : 10;
    
    const spot = global.tilemapSystem.findBuildingSpot('garrison', searchCenter, radius, {
      excludeTiles: this.getOccupiedTiles()
    });
    
    if (!spot) {
      console.log(`${this.house.name}: No valid location for garrison`);
      return null;
    }
    
    const plot = spot.plot;
    const topPlot = spot.topPlot;
    const center = global.getCenter(plot[0][0], plot[0][1]);
    
    // Update terrain
    for (let i = 0; i < plot.length; i++) {
      global.tileChange(0, plot[i][0], plot[i][1], 13);
      global.tileChange(3, plot[i][0], plot[i][1], `garrison${i}`);
      global.matrixChange(0, plot[i][0], plot[i][1], 1);
    }
    global.tileChange(5, topPlot[0][0], topPlot[0][1], 'garrison4');
    global.tileChange(5, topPlot[1][0], topPlot[1][1], 'garrison5');
    
    // Create garrison
    const garrisonId = Math.random();
    Garrison({
      id: garrisonId,
      house: this.house.id,
      owner: this.house.id,
      x: center[0],
      y: center[1],
      z: 0,
      type: 'garrison',
      built: true,
      plot: plot,
      topPlot: topPlot,
      mats: { wood: 50, stone: 30 },
      req: 5,
      hp: 200
    });
    
    console.log(`${this.house.name}: Built garrison at [${plot[0]}]`);
    return garrisonId;
  }
  
  // Helper: get all occupied tiles (buildings + HQ)
  getOccupiedTiles() {
    const occupied = [this.house.hq];
    
    if (typeof Building !== 'undefined' && Building.list) {
      for (const id in Building.list) {
        const building = Building.list[id];
        if (building.owner === this.house.id && building.plot) {
          occupied.push(...building.plot);
        }
      }
    }
    
    return occupied;
  }
  
  // Helper: get buildings by type
  getBuildingsByType(type) {
    const buildings = [];
    
    if (typeof Building !== 'undefined' && Building.list) {
      for (const id in Building.list) {
        const building = Building.list[id];
        if (building.owner === this.house.id && building.type === type) {
          buildings.push(building);
        }
      }
    }
    
    return buildings;
  }
}

module.exports = BuildingConstructor;

