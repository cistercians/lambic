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
  
  // Construct a forge
  buildForge(location = null) {
    const hq = this.house.hq;
    const searchCenter = location || hq;
    const radius = location ? 3 : 10;
    
    const spot = global.tilemapSystem.findBuildingSpot('forge', searchCenter, radius, {
      excludeTiles: this.getOccupiedTiles()
    });
    
    if (!spot) {
      console.log(`${this.house.name}: No valid location for forge`);
      return null;
    }
    
    const plot = spot.plot;
    const walls = spot.walls;
    const center = global.getCenter(plot[0][0], plot[0][1]);
    
    // Update terrain - forge is a 2x2 building with walls
    for (let i = 0; i < plot.length; i++) {
      global.tileChange(3, plot[i][0], plot[i][1], String('forge' + i));
      if (global.getTile(3, plot[i][0], plot[i][1]) == 'forge1') {
        global.matrixChange(1, plot[i][0], plot[i][1], 0);
        global.matrixChange(1, plot[i][0], plot[i][1] + 1, 0);
        global.tileChange(0, plot[i][0], plot[i][1], 14);
      } else {
        global.matrixChange(0, plot[i][0], plot[i][1], 1);
        global.matrixChange(1, plot[i][0], plot[i][1], 0);
      }
    }
    
    // Wall tiles
    let ii = 5;
    for (const n of walls) {
      global.tileChange(5, n[0], n[1], String('forge' + ii));
      if (global.getTile(5, n[0], n[1]) == 'forge5') {
        global.tileChange(5, n[0], n[1], 0);
        global.tileChange(4, n[0], n[1], 1);
      } else {
        global.tileChange(4, n[0], n[1], 1);
      }
      ii++;
    }
    
    // Create forge building
    const forgeId = Math.random();
    Forge({
      id: forgeId,
      house: this.house.id,
      owner: this.house.id,
      x: center[0],
      y: center[1],
      z: 0,
      type: 'forge',
      built: true,
      plot: plot,
      walls: walls,
      mats: { wood: 50, stone: 100 },
      req: 5,
      hp: 200
    });
    
    console.log(`${this.house.name}: Built forge at [${plot[0]}]`);
    return forgeId;
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
    const walls = spot.walls;
    const center = global.getCenter(plot[0][0], plot[0][1]);
    
    // Update terrain - copied exactly from Build.js player garrison code
    for (let i = 0; i < plot.length; i++) {
      global.tileChange(3, plot[i][0], plot[i][1], String('garrison' + i));
      if (global.getTile(3, plot[i][0], plot[i][1]) == 'garrison0') {
        global.matrixChange(1, plot[i][0], plot[i][1], 0);
        global.matrixChange(1, plot[i][0], plot[i][1] + 1, 0);
        global.tileChange(0, plot[i][0], plot[i][1], 16);
      } else if (global.getTile(3, plot[i][0], plot[i][1]) == 'garrison1' ||
                 global.getTile(3, plot[i][0], plot[i][1]) == 'garrison2' ||
                 global.getTile(3, plot[i][0], plot[i][1]) == 'garrison3') {
        global.matrixChange(0, plot[i][0], plot[i][1], 1);
        global.matrixChange(1, plot[i][0], plot[i][1], 0);
        global.tileChange(0, plot[i][0], plot[i][1], 15);
      } else {
        global.matrixChange(0, plot[i][0], plot[i][1], 1);
        global.matrixChange(1, plot[i][0], plot[i][1], 0);
        global.matrixChange(2, plot[i][0], plot[i][1], 0);
        global.tileChange(0, plot[i][0], plot[i][1], 15);
        global.tileChange(5, plot[i][0], plot[i][1], 15);
      }
    }
    
    // Top plot tiles
    let ii = 12;
    for (const n of topPlot) {
      global.tileChange(5, n[0], n[1], String('garrison' + ii));
      ii++;
    }
    
    // Walls
    for (const n of walls) {
      if (global.getTile(5, n[0], n[1]) == 'garrison12') {
        global.tileChange(4, n[0], n[1], 4);
        global.matrixChange(1, n[0], n[1], 0);
        global.matrixChange(2, n[0], n[1], 0);
      } else {
        global.tileChange(4, n[0], n[1], 2);
      }
    }
    
    // Create garrison
    const garrisonId = Math.random();
    const entrance = [plot[0][0], plot[0][1]];
    const ustairs = walls.length > 0 ? [walls[0][0], walls[0][1]] : null;
    
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
      walls: walls,
      entrance: entrance,
      ustairs: ustairs,
      mats: { wood: 50, stone: 30 },
      req: 5,
      hp: 200
    });
    
    // Add interior items (like player garrisons)
    const sa = global.getCoords(walls[0][0], walls[0][1]);
    const sr1 = global.getCoords(walls[2][0], walls[2][1]);
    const sr2 = global.getCoords(walls[3][0], walls[3][1]);
    const fp = global.getCoords(plot[1][0], plot[1][1]);
    const dk = global.getCoords(plot[8][0], plot[8][1]);
    
    SuitArmor({ x: sa[0], y: sa[1], z: 1, qty: 1, parent: garrisonId });
    Swordrack({ x: sr1[0], y: sr1[1], z: 1, qty: 1, parent: garrisonId });
    Swordrack({ x: sr2[0], y: sr2[1], z: 1, qty: 1, parent: garrisonId });
    Firepit({ x: fp[0], y: fp[1], z: 0, qty: 1, parent: garrisonId });
    Firepit({ x: fp[0], y: fp[1], z: 1, qty: 1, parent: garrisonId });
    Desk({ x: dk[0], y: dk[1], z: 1, qty: 1, parent: garrisonId });
    
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

