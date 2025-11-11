// server/js/core/BuildingConstruction.js
// Unified building construction system used by both players and AI

class BuildingConstruction {
  
  // Construct a forge building (tiles, matrix, items)
  static constructForge(buildingId, plot, walls) {
    // Update terrain - forge is a 3x2 building with walls
    for (let i = 0; i < plot.length; i++) {
      global.tileChange(3, plot[i][0], plot[i][1], String('forge' + i));
      if (global.getTile(3, plot[i][0], plot[i][1]) == 'forge1') {
        global.matrixChange(1, plot[i][0], plot[i][1], 0);
        global.matrixChange(1, plot[i][0], plot[i][1] + 1, 0);
        global.tileChange(0, plot[i][0], plot[i][1], 14);
        global.Building.list[buildingId].entrance = [plot[i][0], plot[i][1]];
      } else {
        global.matrixChange(0, plot[i][0], plot[i][1], 1);
        global.matrixChange(1, plot[i][0], plot[i][1], 0);
        global.tileChange(0, plot[i][0], plot[i][1], 13);
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
    
    // Add interior items
    const fr = global.getCoords(walls[1][0], walls[1][1]);
    const fp = global.getCoords(plot[0][0], plot[0][1]);
    const br = global.getCoords(plot[3][0], plot[3][1]);
    const anv = global.getCoords(plot[5][0], plot[5][1]);
    
    global.Furnace({ x: fr[0], y: fr[1], z: 1, qty: 1, parent: buildingId });
    global.Firepit({ x: fp[0], y: fp[1], z: 0, qty: 1, parent: buildingId });
    global.Barrel({ x: br[0], y: br[1], z: 1, qty: 1, parent: buildingId });
    global.Anvil({ x: anv[0], y: anv[1], z: 1, qty: 1, parent: buildingId });
  }
  
  // Construct a garrison building (tiles, matrix, items)
  static constructGarrison(buildingId, plot, topPlot, walls) {
    // Update terrain - garrison is a 4x3 building with walls and upper floor
    for (let i = 0; i < plot.length; i++) {
      global.tileChange(3, plot[i][0], plot[i][1], String('garrison' + i));
      if (global.getTile(3, plot[i][0], plot[i][1]) == 'garrison0') {
        global.matrixChange(1, plot[i][0], plot[i][1], 0);
        global.matrixChange(1, plot[i][0], plot[i][1] + 1, 0);
        global.tileChange(0, plot[i][0], plot[i][1], 16);
        global.Building.list[buildingId].entrance = [plot[i][0], plot[i][1]];
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
    
    // Wall tiles
    for (const n of walls) {
      if (global.getTile(5, n[0], n[1]) == 'garrison12') {
        global.tileChange(4, n[0], n[1], 4);
        global.matrixChange(1, n[0], n[1], 0);
        global.matrixChange(2, n[0], n[1], 0);
        global.Building.list[buildingId].ustairs = [n[0], n[1]];
      } else {
        global.tileChange(4, n[0], n[1], 2);
      }
    }
    
    // Add interior items
    const sa = global.getCoords(walls[0][0], walls[0][1]);
    const sr1 = global.getCoords(walls[2][0], walls[2][1]);
    const sr2 = global.getCoords(walls[3][0], walls[3][1]);
    const fp = global.getCoords(plot[1][0], plot[1][1]);
    const d1 = global.getCoords(plot[2][0], plot[2][1]);
    const d2 = global.getCoords(plot[3][0], plot[3][1]);
    const d3 = global.getCoords(plot[6][0], plot[6][1]);
    const d4 = global.getCoords(plot[7][0], plot[7][1]);
    const dk = global.getCoords(plot[8][0], plot[8][1]);
    
    // Z-level 1 items
    global.SuitArmor({ x: sa[0], y: sa[1], z: 1, qty: 1, parent: buildingId });
    global.Swordrack({ x: sr1[0], y: sr1[1], z: 1, qty: 1, parent: buildingId });
    global.Swordrack({ x: sr2[0], y: sr2[1], z: 1, qty: 1, parent: buildingId });
    global.Firepit({ x: fp[0], y: fp[1], z: 0, qty: 1, parent: buildingId });
    global.Firepit({ x: fp[0], y: fp[1], z: 1, qty: 1, parent: buildingId });
    global.Dummy({ x: d1[0], y: d1[1], z: 1, qty: 1, parent: buildingId });
    global.Dummy({ x: d2[0], y: d2[1], z: 1, qty: 1, parent: buildingId });
    
    // Z-level 2 items
    global.WallTorch({ x: sa[0], y: sa[1], z: 2, qty: 1, parent: buildingId });
    global.Swordrack({ x: sr1[0], y: sr1[1], z: 2, qty: 1, parent: buildingId });
    global.Swordrack({ x: sr2[0], y: sr2[1], z: 2, qty: 1, parent: buildingId });
    global.Dummy({ x: d3[0], y: d3[1], z: 2, qty: 1, parent: buildingId });
    global.Dummy({ x: d4[0], y: d4[1], z: 2, qty: 1, parent: buildingId });
    global.Desk({ x: dk[0], y: dk[1], z: 2, qty: 1, parent: buildingId });
  }
}

module.exports = BuildingConstruction;

