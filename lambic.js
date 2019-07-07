/////////////////////////////////////////////////////////////////////////
//                                                                     //
//                 ((🔥))   S T R O N G H O D L   ((🔥))               //
//                   \\                            //                  //
//                                                                     //
//      A   S O L I S   O R T V   V S Q V E   A D   O C C A S V M      //
//                                                                     //
//            A game by Johan Argyne, Cistercian Capital               //
//                                                                     //
/////////////////////////////////////////////////////////////////////////

var fs = require('fs');
var PF = require('pathfinding');
require('./server/js/Pathing');
require('./server/js/Entity');
require('./server/js/Commands');
require('./server/js/Entropy');
require('./server/js/Equip');
require('./server/js/Houses');
require('./server/js/Dialogue');
require('./server/js/Inspection');

// BUILD MAP
var genesis = require('./server/js/Genesis');
world = genesis.map;
tileSize = 64;
mapSize = world[0].length;
mapPx = mapSize * tileSize;

// pathfinding
matrixO = pathing(0); // overworld
matrixU = pathing(-1); // underworld
matrixB1 = pathing(); // first floor buildings
matrixB2 = pathing(); // second floor buildings
matrixB3 = pathing(); // dungeons/cellars
matrixW = pathing(-3); // underwater
matrixS = pathing(3); // ships

gridO = new PF.Grid(matrixO); // z = 0
gridU = new PF.Grid(matrixU); // z = -1
gridB1 = new PF.Grid(matrixB1); // z = 1
gridB2 = new PF.Grid(matrixB2); // z = 2
gridB3 = new PF.Grid(matrixB3); // z = -2
gridW = new PF.Grid(matrixW); // z = -3
gridS = new PF.Grid(matrixS); // ships

finder = new PF.AStarFinder();

// biome levels
biomes = {
  water:0,
  forest:0,
  hForest:0,
  brush:0,
  rocks:0,
  mtn:0
}

// spawn points
spawnPointsO = []; // overworld
spawnPointsU = []; // underworld
waterSpawns = [];
hForestSpawns = [];
mtnSpawns = [];

caveEntrances = [];

// territories
territories = {
  northwest:{
    contestants:[]
  },
  north:{
    contestants:[]
  },
  northeast:{
    contestants:[]
  },
  west:{
    contestants:[]
  },
  midland:{
    contestants:[]
  },
  east:{
    contestants:[]
  },
  southwest:{
    contestants:[]
  },
  south:{
    contestants:[]
  },
  southeast:{
    contestants:[]
  }
}

for(x = 0; x < mapSize; x++){
  for(y = 0; y < mapSize; y++){
    var tile = world[0][y][x];
    var uTile = world[1][y][x];
    if(tile !== 0){
      spawnPointsO.push([x,y]);
      if(tile >= 1 && tile < 2){
        biomes.hForest++;
        hForestSpawns.push([x,y]);
      } else if(tile >= 2 && tile < 3){
        biomes.forest++;
      } else if(tile >= 3 && tile < 4){
        biomes.brush++;
      } else if(tile >= 4 && tile < 5){
        biomes.rocks++;
      } else if(tile >= 5 && tile < 6){
        biomes.mtn++;
        mtnSpawns.push([x,y]);
      } else if(tile === 6){
        biomes.mtn++;
        caveEntrances.push([x,y]);
      }
    } else {
      biomes.water++;
      waterSpawns.push([x,y]);
    }
    if(uTile === 0){
      spawnPointsU.push([x,y]);
    } else {
      continue;
    }
  }
}

// RANDOM NAME GENERATOR

maleNames = [];
femaleNames = [];
surnames = [];

fs.readFile('./malenames.txt', function(err, data){
  if(err) throw err;
  var lines = data.toString().split("\n");
  for(var i in lines){
    maleNames.push(lines[i]);
  }
});

fs.readFile('./femalenames.txt', function(err, data){
  if(err) throw err;
  var lines = data.toString().split("\n");
  for(var i in lines){
    femaleNames.push(lines[i]);
  }
});

fs.readFile('./surnames.txt', function(err, data){
  if(err) throw err;
  var lines = data.toString().split("\n");
  for(var i in lines){
    surnames.push(lines[i]);
  }
});

randomName = function(x){
  if(x === 'm'){
    return maleNames[Math.floor(Math.random()*maleNames.length)];
  } else if(x === 'f'){
    return femaleNames[Math.floor(Math.random()*femaleNames.length)];
  } else {
    return surnames[Math.floor(Math.random()*surnames.length)];
  }
};

console.log('#############');
console.log('Terrain Data:');
console.log('#############');
console.log('');
console.log(Number((biomes.water/(mapSize*mapSize))*100).toFixed() + '% Water');
console.log(Number((biomes.hForest/(mapSize*mapSize))*100).toFixed() + '% Heavy Forest');
console.log(Number((biomes.forest/(mapSize*mapSize))*100).toFixed() + '% Light Forest');
console.log(Number((biomes.brush/(mapSize*mapSize))*100).toFixed() + '% Brush');
console.log(Number((biomes.rocks/(mapSize*mapSize))*100).toFixed() + '% Rocks');
console.log(Number((biomes.mtn/(mapSize*mapSize))*100).toFixed() + '% Mountains');
console.log('');

// MAP TOOLS

// get tile walkable status
isWalkable = function(z, c, r){
  if(c < 0 || c > mapSize-1 || r < 0 || r > mapSize-1){
    return false;
  } else {
    if(z === 0){
      if(matrixO[r][c] === 0){
        return true;
      } else {
        return false;
      }
    } else if(z === -1){
      if(matrixU[r][c] === 0){
        return true;
      } else {
        return false;
      }
    } else if(z === 1){
      if(matrixB1[r][c] === 0){
        return true;
      } else {
        return false;
      }
    } else if(z === 2){
      if(matrixB2[r][c] === 0){
        return true;
      } else {
        return false;
      }
    } else if(z === -2){
      if(matrixB3[r][c] === 0){
        return true;
      } else {
        return false;
      }
    }
  }
}

// get tile type from (l,c,r)
// l === 'layer'
// 0: Overworld, 1: Underworld,  2: Underwater, 3: BuildI, 4: BuildII, 5: BuildIII, 6: resI, 7: resII, 8: BuildIV
getTile = function(l,c,r){
  if(r >= 0 && r < mapSize && c >= 0 && c < mapSize){
    return world[l][r][c];
  } else {
    return;
  }
};

// get loc from (x,y)
getLoc = function(x,y){
  var loc = [Math.floor(x/tileSize),Math.floor(y/tileSize)];
  return loc;
};

// get tile type from (l,x,y)
getLocTile = function(l,x,y){
  if(x >= 0 && x <= mapPx && y >= 0 && y <= mapPx){
    var loc = getLoc(x,y);
    return world[l][loc[1]][loc[0]];
  }
};

// get item type from (z,c,r)
getItem = function(z,c,r){
  if(z === 0){
    return matrixO[r][c];
  } else if(z === -1){
    return matrixU[r][c];
  } else if(z === 1){
    return matrixB1[r][c];
  } else if(z === 2){
    return matrixB2[r][c];
  } else if(z === -2){
    return matrixB3[r][c];
  } else if(z === -3){
    return matrixW[r][c];
  }
}

// get building id from (x,y)
getBuilding = function(x,y){
  var loc = getLoc(x,y);
  for(var i = 0; i < buildingCount; i++){
    var b = Building.list[buildingId[i]];
    for(n = 0; n < b.plot.length; n++){
      if(b.plot[n][0] === loc[0] && b.plot[n][1] === loc[1]){
        return b.id;
      } else {
        continue;
      }
    }
  }
}

// check if player has key to door from (x,y,player.id)
keyCheck = function(x,y,p){
  var key = getBuilding(x,y);
  var pKeys = Player.list[p].keys;
  for(var i in pKeys){
    if(pKeys[i] === key){
      return true;
    } else {
      continue;
    }
    return false;
  }
}

// returns chest id if player can access it from (z,x,y,player.id)
chestCheck = function(z,x,y,p){
  var player = Player.list[p];
  for(var i in Item.list){
    var itm = Item.list[i];
    if(itm.type === 'LockedChest' && itm.z === z && itm.x === x && itm.y === y){
      for(var k in player.inventory.keys){
        var key = player.inventory.keys[k];
        if(itm.id === key){
          return itm.id;
        } else {
          continue;
        }
      }
    } else if(itm.type === 'Chest' && itm.z === z && itm.x === x && itm.y === y){
      return itm.id;
    } else {
      continue;
    }
  }
  return false;
}

// check if player can pass through closed gate
gateCheck = function(x,y,h,k){
  var gateH = Building.list[getBuilding(x,y)].house;
  var gateK = Building.list[getBuilding(x,y)].kingdom;
  if(k && k === gateK){
    return true;
  } else {
    if(h && h === gateH){
      return true;
    } else {
      return false;
    }
  }
}

// check if same faction(2), ally(1), neutral(0), enemy(-1)
allyCheck = function(p,id){
  var player = Player.list[p];
  var other = Player.list[id]
  var pHouse = House.list[player.house];
  var oHouse = House.list[other.house];

  if(pHouse){
    if(pHouse.hostile){
      if(oHouse){
        if(player.house === other.house){
          return 2;
        } else {
          for(var i in pHouse.allies){
            if(pHouse.allies[i] === other.house){
              return 1;
            } else {
              continue;
            }
          }
          return -1;
        }
      } else {
        return -1;
      }
    } else {
      if(oHouse){
        if(player.house === other.house){
          return 2;
        } else {
          for(var i in pHouse.allies){
            if(pHouse.allies[i] === other.house){
              return 1;
            } else {
              continue;
            }
          }
          if(oHouse.hostile){
            return -1;
          } else {
            for(var i in pHouse.enemies){
              if(pHouse.enemies[i] === other.house){
                return -1;
              } else {
                continue;
              }
            }
          }
          return 0;
        }
      } else {
        for(var i in pHouse.enemies){
          if(pHouse.enemies[i] === id){
            return -1;
          } else {
            continue;
          }
        }
        return 0;
      }
    }
  } else {
    if(oHouse){
      if(oHouse.hostile){
        return -1;
      } else {
        for(var i in oHouse.enemies){
          if(oHouse.enemies[i] === p){
            return -1;
          } else {
            continue;
          }
        }
        return 0;
      }
    } else {
      for(var i in player.friends){
        if(player.friends[i] === id){
          return 1;
        } else {
          continue;
        }
      }
      for(var i in player.enemies){
        if(player.enemies[i] === id){
          return -1;
        } else {
          continue;
        }
      }
      return 0;
    }
  }
}


// get random tile + its loc
var randomTile = function(l){
  var max = mapSize-1;
  var c = Math.floor(Math.random() * max);
  var r = Math.floor(Math.random() * max);
  return [world[l][r][c],c,r];
};

// get (x,y) coords of tile from loc
getCoords = function(c,r){
  var coords = [c * tileSize, r * tileSize];
  return coords;
};

// get (x,y) coords of tile from loc
getCenter = function(c,r){
  var coords = [(c * tileSize) + (tileSize/2), (r * tileSize) + (tileSize/2)];
  return coords;
};

// random spawner (Overworld)
randomSpawnO = function(){
  var rand = Math.floor(Math.random() * spawnPointsO.length);
  var point = spawnPointsO[rand];
  var spawn = getCenter(point[0],point[1]);
  return spawn;
};

// random spawner (HForest)
randomSpawnHF = function(){
  var rand = Math.floor(Math.random() * hForestSpawns.length);
  var point = hForestSpawns[rand];
  var spawn = getCenter(point[0],point[1]);
  return spawn;
};

// random spawner (Underworld)
randomSpawnU = function(){
  var rand = Math.floor(Math.random() * spawnPointsU.length);
  var point = spawnPointsU[rand];
  var spawn = getCenter(point[0],point[1]);
  return spawn;
};

// faction spawner
factionSpawn = function(id){
  if(id === 1){
    var select = [];
    var gridSelect = [];
    for(var i in spawnPointsU){
      var count = 0;
      var c = spawnPointsU[i][0];
      var r = spawnPointsU[i][1];
      var grid = [[c,r],[c+1,r],[c+2,r],[c+3,r],
      [c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],
      [c,r+2],[c+1,r+2],[c+2,r+2],[c+3,r+2],
      [c,r+3],[c+1,r+3],[c+2,r+3],[c+3,r+3]];
      if(c < (mapSize-4) && r < (mapSize-4)){
        for(var n in grid){
          var tile = grid[n];
          if(getTile(1,tile[0],tile[1]) === 0){
            count++;
          }
        }
        if(count === grid.length){
          var r = Math.random();
          if(r < 0.25){
            select.push(grid[5]);
            grid.splice(5,1);
            gridSelect.push(grid);
          } else if(r < 0.5){
            select.push(grid[6]);
            grid.splice(6,1);
            gridSelect.push(grid);
          } else if (r < 0.75){
            select.push(grid[9]);
            grid.splice(9,1);
            gridSelect.push(grid);
          } else {
            select.push(grid[10]);
            grid.splice(10,1);
            gridSelect.push(grid);
          }
        }
      } else {
        continue;
      }
    }
    var rand = Math.floor(Math.random() * select.length);
    originGrids.brotherhood = gridSelect[rand];
    return select[rand];
  } else if(id === 2){
    var select = [];
    var gridSelect = [];
    for(var i in mtnSpawns){
      var count = 0;
      var c = mtnSpawns[i][0];
      var r = mtnSpawns[i][1];
      var grid = [[c,r],[c+1,r],[c+2,r],[c+3,r],[c+4,r],
      [c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r+1],
      [c,r+2],[c+1,r+2],[c+2,r+2],[c+3,r+2],[c+4,r+2],
      [c,r+3],[c+1,r+3],[c+2,r+3],[c+3,r+3],[c+4,r+3],
      [c,r+4],[c+1,r+4],[c+2,r+4],[c+3,r+4],[c+4,r+4]];
      if(c < (mapSize-4) && r < (mapSize-4)){
        for(var n in grid){
          var tile = grid[n];
          if(getTile(0,tile[0],tile[1]) >= 5 && getTile(0,tile[0],tile[1]) < 6){
            count++;
          }
        }
        if(count === grid.length){
          select.push(grid[12]);
          grid.splice(12,1);
          gridSelect.push(grid);
        }
      } else {
        continue;
      }
    }
    var rand = Math.floor(Math.random() * select.length);
    originGrids.goths = gridSelect[rand];
    return select[rand];
  } else if(id === 3){
    var select = [];
    var gridSelect = [];
    for(var i in waterSpawns){
      var count = 0;
      var c = waterSpawns[i][0];
      var r = waterSpawns[i][1];
      var grid = [[c,r],[c+1,r],[c+2,r],[c+3,r],[c+4,r],
      [c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r+1],
      [c,r+2],[c+1,r+2],[c+2,r+2],[c+3,r+2],[c+4,r+2],
      [c,r+3],[c+1,r+3],[c+2,r+3],[c+3,r+3],[c+4,r+3],
      [c,r+4],[c+1,r+4],[c+2,r+4],[c+3,r+4],[c+4,r+4]];
      if(c < (mapSize-4) && r < (mapSize-4)){
        for(var n in grid){
          var tile = grid[n];
          if(getTile(0,tile[0],tile[1]) === 0){
            count++;
          }
        }
        if(count === grid.length){
          select.push(grid[12]);
          gridSelect.push(grid);
        }
      } else {
        continue;
      }
    }
    var rand = Math.floor(Math.random() * select.length);
    // originGrids.norsemen = gridSelect[rand];
    return select[rand];
  } else if(id === 4){
    var select = [];
    var gridSelect = [];
    for(var i in spawnPointsO){
      var count = 0;
      var c = spawnPointsO[i][0];
      var r = spawnPointsO[i][1];
      var grid = [[c,r],[c+1,r],[c+2,r],[c+3,r],[c+4,r],
      [c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r+1],
      [c,r+2],[c+1,r+2],[c+2,r+2],[c+3,r+2],[c+4,r+2],
      [c,r+3],[c+1,r+3],[c+2,r+3],[c+3,r+3],[c+4,r+3],
      [c,r+4],[c+1,r+4],[c+2,r+4],[c+3,r+4],[c+4,r+4]];
      if(c < (mapSize-4) && r < (mapSize-4)){
        for(var n in grid){
          var tile = grid[n];
          if(getTile(0,tile[0],tile[1]) >= 2 && getTile(0,tile[0],tile[1]) < 4){
            count++;
          }
        }
        if(count === grid.length){
          select.push(grid[12]);
          grid.splice(12,1);
          gridSelect.push(grid);
        }
      } else {
        continue;
      }
    }
    var rand = Math.floor(Math.random() * select.length);
    originGrids.franks = gridSelect[rand];
    return select[rand];
  } else if(id === 5){
    var select = [];
    var gridSelect = [];
    for(var i in hForestSpawns){
      var count = 0;
      var c = hForestSpawns[i][0];
      var r = hForestSpawns[i][1];
      var grid = [[c,r],[c+1,r],[c+2,r],[c+3,r],[c+4,r],
      [c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r+1],
      [c,r+2],[c+1,r+2],[c+2,r+2],[c+3,r+2],[c+4,r+2],
      [c,r+3],[c+1,r+3],[c+2,r+3],[c+3,r+3],[c+4,r+3],
      [c,r+4],[c+1,r+4],[c+2,r+4],[c+3,r+4],[c+4,r+4]];
      if(c < (mapSize-4) && r < (mapSize-4)){
        for(var n in grid){
          var tile = grid[n];
          if(getTile(0,tile[0],tile[1]) >= 1 && getTile(0,tile[0],tile[1]) < 2){
            count++;
          }
        }
        if(count === grid.length){
          select.push(grid[12]);
          grid.splice(12,1);
          gridSelect.push(grid);
        }
      } else {
        continue;
      }
    }
    var rand = Math.floor(Math.random() * select.length);
    originGrids.celts = gridSelect[rand];
    return select[rand];
  } else if(id === 6){
    var select = [];
    var gridSelect = [];
    for(var i in spawnPointsO){
      var count = 0;
      var c = spawnPointsO[i][0];
      var r = spawnPointsO[i][1];
      var grid = [[c,r],[c+1,r],[c+2,r],[c+3,r],[c+4,r],
      [c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r+1],
      [c,r+2],[c+1,r+2],[c+2,r+2],[c+3,r+2],[c+4,r+2],
      [c,r+3],[c+1,r+3],[c+2,r+3],[c+3,r+3],[c+4,r+3],
      [c,r+4],[c+1,r+4],[c+2,r+4],[c+3,r+4],[c+4,r+4]];
      if(c < (mapSize-4) && r < (mapSize-4)){
        for(var n in grid){
          var tile = grid[n];
          if(getTile(0,tile[0],tile[1]) >= 4 && getTile(0,tile[0],tile[1]) < 6){
            count++;
          }
        }
        if(count === grid.length){
          select.push(grid[12]);
          grid.splice(12,1);
          gridSelect.push(grid);
        }
      } else {
        continue;
      }
    }
    var rand = Math.floor(Math.random() * select.length);
    originGrids.teutons = gridSelect[rand];
    return select[rand];
  } else if(id === 7){
    var select = [];
    var gridSelect = [];
    for(var i in hForestSpawns){
      var count = 0;
      var c = hForestSpawns[i][0];
      var r = hForestSpawns[i][1];
      var grid = [[c,r],[c+1,r],[c+2,r],[c+3,r],[c+4,r],
      [c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r+1],
      [c,r+2],[c+1,r+2],[c+2,r+2],[c+3,r+2],[c+4,r+2],
      [c,r+3],[c+1,r+3],[c+2,r+3],[c+3,r+3],[c+4,r+3],
      [c,r+4],[c+1,r+4],[c+2,r+4],[c+3,r+4],[c+4,r+4]];
      if(c < (mapSize-4) && r < (mapSize-4)){
        for(var n in grid){
          var tile = grid[n];
          if(getTile(0,tile[0],tile[1]) >= 1 && getTile(0,tile[0],tile[1]) < 2){
            count++;
          }
        }
        if(count === grid.length){
          select.push(grid[12]);
          grid.splice(12,1);
          gridSelect.push(grid);
        }
      } else {
        continue;
      }
    }
    var rand = Math.floor(Math.random() * select.length);
    originGrids.outlaws = gridSelect[rand];
    return select[rand];
  } else if(id === 8){
    var select = [];
    var gridSelect = [];
    for(var i in spawnPointsU){
      var count = 0;
      var c = spawnPointsU[i][0];
      var r = spawnPointsU[i][1];
      var grid = [[c,r],[c+1,r],[c+2,r],[c+3,r],[c+4,r],
      [c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r+1],
      [c,r+2],[c+1,r+2],[c+2,r+2],[c+3,r+2],[c+4,r+2],
      [c,r+3],[c+1,r+3],[c+2,r+3],[c+3,r+3],[c+4,r+3],
      [c,r+4],[c+1,r+4],[c+2,r+4],[c+3,r+4],[c+4,r+4]];
      if(c < (mapSize-4) && r < (mapSize-4)){
        for(var n in grid){
          var tile = grid[n];
          if(getTile(1,tile[0],tile[1]) === 0){
            count++;
          }
        }
        if(count === grid.length){
          select.push(grid[12]);
          grid.splice(12,1);
          gridSelect.push(grid);
        }
      } else {
        continue;
      }
    }
    var rand = Math.floor(Math.random() * select.length);
    originGrids.mercenaries = gridSelect[rand];
    return select[rand];
  }
}

// save map file?
var saveMap = false;

if(saveMap){
  fs.writeFile("./mapFiles/map.txt", world, function(err){
    if(err){
      return console.log(err);
    }
    console.log("Map file saved to '/mapfiles' folder.");
  });
};

// day/night cycle
tempus = 'XII.a';
period = 60; // 1=1hr, 2=30m, 4=15m, 12=5m, 60=1m, 120=30s, 360=10s (number of game days per 24 hours)
var cycle = ['XII.a','I.a','II.a','III.a','IV.a','V.a','VI.a','VII.a','VIII.a','IX.a','X.a','XI.a'
            ,'XII.p','I.p','II.p','III.p','IV.p','V.p','VI.p','VII.p','VIII.p','IX.p','X.p','XI.p'];
var tick = 1;
day = 0;

// weather

// DATABASE
var mongojs = require('mongojs');
var db = mongojs('localhost:27017/myGame',['account','progress']);

// NETWORKING
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req, res) {
  res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));

serv.listen(2000);
console.log("###################################");
console.log("");
console.log("     ♜  S T R O N G H O D L ♜");
console.log("");
console.log("   A SOLIS ORTV VSQVE AD OCCASVM");
console.log("");
console.log("###################################");

SOCKET_LIST = {};

// SERVER
var isValidPassword = function(data,cb){
  db.account.find({username:data.name,password:data.password},function(err,res){
    if(res.length > 0)
      cb(true);
    else
      cb(false);
  });
}

var isUsernameTaken = function(data,cb){
  db.account.find({username:data.name},function(err,res){
    if(res.length > 0)
      cb(true);
    else
      cb(false);
  });
}

var addUser = function(data,cb){
  db.account.insert({username:data.name,password:data.password},function(err){
    cb();
  });
}

io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;
  console.log('Socket connected: ' + socket.id);

  socket.on('signIn',function(data){
    isValidPassword(data,function(res){
      if(res){
        Player.onConnect(socket, data.name);
        socket.emit('signInResponse',{
          success:true,
          world: world,
          tileSize: tileSize,
          mapSize: mapSize,
          tempus: tempus
        });
        console.log(data.name + ' logged in.');
      } else {
        socket.emit('signInResponse',{success:false});
      }
    })
  });

  socket.on('signUp',function(data){
    if(data.name.length > 0){
      isUsernameTaken(data,function(res){
        if(res){
          socket.emit('signUpResponse',{success:false});
        } else {
          addUser(data,function(){
            socket.emit('signUpResponse',{success:true});
            console.log(data.name + ' signed up.');
          });
        }
      })
    } else {
      socket.emit('signUpResponse',{success:false});
    }
  });

  socket.on('disconnect',function(){
    delete SOCKET_LIST[socket.id];
    Player.onDisconnect(socket);
    console.log('Socket disconnected: ' + socket.id);
  });

  socket.on('evalCmd',function(data){
    EvalCmd(data);
  });
});

// GAME STATE

// day/night cycle
var dayNight = function(){
  tempus = cycle[tick];
  if(tempus === 'XII.a'){
    day++;
    entropy();
    console.log('');
    console.log('Day ' + day);
    console.log('');
  }
  io.emit('tempus',{
    tempus:tempus
  })
  console.log(tempus);
  if(tick < 23){
    tick++;
  } else {
    tick = 0
  }
};

// initiate day/night cycle
setInterval(dayNight, 3600000/period);
console.log('');
console.log('Day ' + day + ' (' + period + 'x)');
console.log('');
console.log(tempus);

initPack = {player:[],arrow:[],item:[],light:[]};
removePack = {player:[],arrow:[],item:[],light:[]};

setInterval(function(){
  var pack = {
    player:Player.update(),
    arrow:Arrow.update(),
    item:Item.update(),
    light:Light.update(),
    building:Building.update(),
    house:House.update()
  }

  for(var i in SOCKET_LIST){
    var socket = SOCKET_LIST[i];
    socket.emit('init',initPack);
    socket.emit('update',pack);
    socket.emit('remove',removePack);
  }

  initPack.player = [];
  initPack.arrow = [];
  initPack.item = [];
  initPack.light = [];
  removePack.player = [];
  removePack.arrow = [];
  removePack.item = [];
  removePack.light = [];

},40);

// spawn fauna
entropy();

// create NPC factions
Brotherhood({
  id:1,
  type:'npc',
  name:'Brotherhood',
  flag:'',
  hq:factionSpawn(1),
  origin:true,
  hostile:true
});

Goths({
  id:2,
  type:'npc',
  name:'Goths',
  flag:'',
  hq:factionSpawn(2),
  origin:true,
  hostile:true
});

Norsemen({
  id:3,
  type:'npc',
  name:'Norsemen',
  flag:'',
  hq:factionSpawn(3),
  origin:true,
  hostile:true
});

Franks({
  id:4,
  type:'npc',
  name:'Franks',
  flag:'',
  hq:factionSpawn(4),
  origin:true,
  hostile:true
});

Celts({
  id:5,
  type:'npc',
  name:'Celts',
  flag:'',
  hq:factionSpawn(5),
  origin:true,
  hostile:true
});

Teutons({
  id:6,
  type:'npc',
  name:'Teutons',
  flag:'',
  hq:factionSpawn(6),
  origin:true,
  hostile:true
});

Outlaws({
  id:7,
  type:'npc',
  name:'Outlaws',
  flag:'☠️',
  hq:factionSpawn(7),
  origin:true,
  hostile:true
});

Mercenaries({
  id:8,
  type:'npc',
  name:'Mercenaries',
  flag:'',
  hq:factionSpawn(8),
  origin:true,
  hostile:true
});

Kingdom({
  id:1,
  name:'Papal States',
  flag:'🇻🇦'
});
