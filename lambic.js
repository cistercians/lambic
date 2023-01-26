/////////////////////////////////////////////////////////////////////////
//                                                                     //
//                      ♜ S T R O N G H O D L ♜                       //
//                                                                     //
//      A   S O L I S   O R T V   V S Q V E   A D   O C C A S V M      //
//                                                                     //
//                      A game by Johan Argyne                         //
//                                                                     //
/////////////////////////////////////////////////////////////////////////

var fs = require('fs');
var PF = require('pathfinding');
require('./server/js/Database')
require('./server/js/Entity');
require('./server/js/Inventory');
require('./server/js/Commands');
require('./server/js/Equip');
require('./server/js/Houses');
require('./server/js/Dialogue');
require('./server/js/Inspect');
require('./server/js/Build');
require('./server/js/Interact');
require('./server/js/Econ');

// BUILD MAP
var genesis = require('./server/js/Genesis');
var world = genesis.map;
nightfall = true;
tileSize = 64;
mapSize = world[0].length;
mapPx = mapSize * tileSize;

// pathing
var pathing = function(z){
  var grid = createArray(mapSize,mapSize);

  if(z == 0){
    for(x = 0; x < mapSize; x++){
      for(y = 0; y < mapSize; y++){
        if(world[0][y][x] == 0){
          grid[y][x] = 1;
        } else {
          grid[y][x] = 0;
        }
      }
    }
  } else if(z == -1){
    for(x = 0; x < mapSize; x++){
      for(y = 0; y < mapSize; y++){
        if(world[1][y][x] == 1){
          grid[y][x] = 1;
        } else {
          grid[y][x] = 0;
        }
      }
    }
  } else if(z == 3){
    for(x = 0; x < mapSize; x++){
      for(y = 0; y < mapSize; y++){
        if(world[0][y][x] == 0){
          grid[y][x] = 0;
        } else {
          grid[y][x] = 1;
        }
      }
    }
  } else if(z == -3){
    for(x = 0; x < mapSize; x++){
      for(y = 0; y < mapSize; y++){
        grid[y][x] = 0;
      }
    }
  } else {
    for(x = 0; x < mapSize; x++){
      for(y = 0; y < mapSize; y++){
        grid[y][x] = 1;
      }
    }
  }
  return grid;
};

// pathfinding
var matrixO = pathing(0); // overworld
var matrixU = pathing(-1); // underworld
var matrixB1 = pathing(); // first floor buildings
var matrixB2 = pathing(); // second floor buildings
var matrixB3 = pathing(); // dungeons/cellars
var matrixW = pathing(-3); // underwater
var matrixS = pathing(3); // ships

var gridO = new PF.Grid(matrixO); // z = 0
var gridU = new PF.Grid(matrixU); // z = -1
var gridB1 = new PF.Grid(matrixB1); // z = 1
var gridB2 = new PF.Grid(matrixB2); // z = 2
var gridB3 = new PF.Grid(matrixB3); // z = -2
var gridW = new PF.Grid(matrixW); // z = -3
var gridS = new PF.Grid(matrixS); // ships

finder = new PF.AStarFinder();

cloneGrid = function(g){
  if(g == 0){
    return gridO.clone();
  } else if(g == -1){
    return gridU.clone();
  } else if(g == 1){
    return gridB1.clone();
  } else if(g == 2){
    return gridB2.clone();
  } else if(g == -2){
    return gridB3.clone();
  } else if(g == -3){
    return gridW.clone();
  } else if(g == 3){
    return gridS.clone();
  }
}

// entropy
var entropy = function(){
  // FLORA
  // add res to trees and update
  var toHF = [];
  var toF = [];
  var toB = [];
  for(var c = 0; c < mapSize; c++){
    for(var r = 0; r < mapSize; r++){
      // fish
      if(getTile(0,c,r) == 0){
        if(Math.random() < 0.2){
          world[6][r][c] = Math.ceil(Math.random() * 10);
        } else {
          world[6][r][c] = 0;
        }
        // tree growth
      } else if(world[0][r][c] >= 1 && world[0][r][c] < 2 && day > 0){
        if(world[6][r][c] < 300){
          world[6][r][c] += Math.floor(Math.random() * 4);
        }
        // forest to heavy forest
      } else if(world[0][r][c] >= 2 && world[0][r][c] < 3 && day > 0){
        world[6][r][c] += Math.floor(Math.random() * 4);
        if(world[6][r][c] > 100){
          toHF.push([c,r]);
        }
      } else if(world[0][r][c] >= 3 && world[0][r][c] < 4 && c > 0 && c < mapSize && r > 0 && r < mapSize && day > 0){
        var check = [getTile(0,c,r-1),getTile(6,c,r-1),getTile(0,c,r+1),getTile(6,c,r+1),getTile(0,c-1,r),getTile(6,c-1,r),getTile(0,c+1,r),getTile(6,c+1,r)];
        if((check[0] >= 1 && check[0] < 3 && check[1] > 49) ||
        (check[2] >= 1 || check[2] < 3 && check[3] > 49) ||
        (check[4] >= 1 || check[4] < 3 && check[5] > 49) ||
        (check[6] >= 1 || check[6] < 3 && check[7] > 49)){
          if(Math.random < 0.1){
            toF.push([c,r]);
          }
        }
      } else if(world[0][r][c] == 7 && c > 0 && c < mapSize && r > 0 && r < mapSize && day > 0){
        var check = [getTile(0,c,r-1),getTile(0,c,r+1),getTile(0,c-1,r),getTile(0,c+1,r)];
        if((check[0] >= 1 && check[0] < 4) ||
        (check[1] >= 1 && check[1] < 4) ||
        (check[2] >= 1 && check[2] < 4) ||
        (check[3] >= 1 && check[3] < 4)){
          if(Math.random < 0.15){
            toB.push([c,r]);
          }
        }
      }
    }
  }

  for(i in toHF){
    world[0][toHF[i][1]][toHF[i][0]] -= 1;
    biomes.hForest++;
    hForestSpawns.push(toHF[i]);
  }
  for(i in toF){
    world[0][toF[i][1]][toF[i][0]] -= 1;
    world[6][toF[i][1]][toF[i][0]] = 50;
    //biomes.forest++;
  }
  for(i in toB){
    world[0][toB[i][1]][toB[i][0]] = 3 + Number((Math.random()*0.9).toFixed(2));
    //biomes.brush++;
  }

  // FAUNA
  var deerRatio = Math.floor(biomes.hForest/400);
  var boarRatio = Math.floor(biomes.hForest/1600);
  var wolfRatio = Math.floor(biomes.hForest/800);
  var falconRatio = Math.floor(biomes.hForest/2400);

  var deerPop = 0;
  var boarPop = 0;
  var wolfPop = 0;
  var falconPop = 0;

  for(i in Player.list){
    var cl = Player.list[i].class;
    if(cl == 'deer'){
      deerPop++;
    } else if(cl == 'boar'){
      boarPop++;
    } else if(cl == 'wolf'){
      wolfPop++;
    } else if(cl == 'falcon'){
      falconPop++;
    }
  }
  if(deerPop < deerRatio){
    var num = 0;
    if(day == 0){
      num = Math.floor(deerRatio * 0.618);
    } else {
      num = Math.floor((deerRatio - deerPop) * 0.02);
    }
    for(var i = 0; i < num; i++){
      var sp = randomSpawnHF();
      var sLoc = getLoc(sp[0],sp[1]);
      Deer({
        x:sp[0],
        y:sp[1],
        z:0,
        home:{
          z:0,
          loc:[sLoc[0],sLoc[1]]
        }
      });
    }
  }
  if(boarPop < boarRatio){
    var num = 0;
    if(day == 0){
      num = Math.floor(boarRatio * 0.618);
    } else {
      num = Math.floor((boarRatio - boarPop) * 0.02);
    }
    for(var i = 0; i < num; i++){
      var sp = randomSpawnHF();
      var sLoc = getLoc(sp[0],sp[1]);
      Boar({
        x:sp[0],
        y:sp[1],
        z:0,
        home:{
          z:0,
          loc:[sLoc[0],sLoc[1]]
        }
      });
    }
  }
  if(wolfPop < wolfRatio){
    var num = 0;
    if(day == 0){
      num = Math.floor(wolfRatio * 0.618);
    } else {
      num = Math.floor((wolfRatio - wolfPop) * 0.02);
    }
    for(var i = 0; i < num; i++){
      var sp = randomSpawnHF();
      var sLoc = getLoc(sp[0],sp[1]);
      Wolf({
        x:sp[0],
        y:sp[1],
        z:0,
        home:{
          z:0,
          loc:[sLoc[0],sLoc[1]]
        }
      });
    }
  }
  if(falconPop < falconRatio){
    var num = 0;
    if(day == 0){
      num = Math.floor(falconRatio * 0.618);
    } else {
      num = Math.floor((falconRatio - falconPop) * 0.01);
    }
    for(var i = 0; i < num; i++){
      var sp = randomSpawnHF();
      Falcon({
        x:sp[0],
        y:sp[1],
        z:0,
        falconry:false
      });
    }
  }
  emit({msg:'mapEdit',world:world});
};

// biome levels
var biomes = {
  water:0,
  forest:0,
  hForest:0,
  brush:0,
  rocks:0,
  mtn:0
}

// spawn points
var spawnPointsO = []; // overworld
var spawnPointsU = []; // underworld
var waterSpawns = [];
var hForestSpawns = [];
var mtnSpawns = [];

caveEntrances = [];

// daily tally
var dailyTally = function(){
  for(var i in Building.list){
    var b = Building.list[i];
    if(b.built && (b.type == 'mill' || b.type == 'lumbermill' || b.type == 'mine')){
      Building.list[i].tally();
    }
  }
}

// create n-dimensional array
function createArray(length){
  var arr = new Array(length || 0),
      i = length;

  if(arguments.length > 1){
      var args = Array.prototype.slice.call(arguments, 1);
      while(i--) arr[length-1 - i] = createArray.apply(this, args);
  }
  return arr;
};

// zones
zones = createArray(64,64);

for(x = 0; x < 64; x++){
  for(y = 0; y < 64; y++){
    zones[y][x] = {};
  }
};

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
      } else if(tile == 6){
        biomes.mtn++;
        caveEntrances.push([x,y]);
      }
    } else {
      biomes.water++;
      waterSpawns.push([x,y]);
    }
    if(uTile == 0){
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
  if(x == 'm'){
    return maleNames[Math.floor(Math.random()*maleNames.length)];
  } else if(x == 'f'){
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

//edit world tiles
tileChange = function(l,c,r,n,incr=false){
  if(incr){
    world[l][r][c] += n;
  } else {
    world[l][r][c] = n;
  }
};

matrixChange = function(l,c,r,n){
  if(l == 0){
    matrixO[r][c] = n;
    if(n == 0){
      gridO.setWalkableAt(c,r,true);
    } else {
      gridO.setWalkableAt(c,r,false);
    }
  } else if(l == -1){
    matrixU[r][c] = n;
    if(n == 0){
      gridU.setWalkableAt(c,r,true);
    } else {
      gridU.setWalkableAt(c,r,false);
    }
  } else if(l == 1){
    matrixB1[r][c] = n;
    if(n == 0){
      gridB1.setWalkableAt(c,r,true);
    } else {
      gridB1.setWalkableAt(c,r,false);
    }
  } else if(l == 2){
    matrixB2[r][c] = n;
    if(n == 0){
      gridB2.setWalkableAt(c,r,true);
    } else {
      gridB2.setWalkableAt(c,r,false);
    }
  } else if(l == -2){
    matrixB3[r][c] = n;
    if(n == 0){
      gridB3.setWalkableAt(c,r,true);
    } else {
      gridB3.setWalkableAt(c,r,false);
    }
  } else if(l == -3){
    matrixW[r][c] = n;
    if(n == 0){
      gridW.setWalkableAt(c,r,true);
    } else {
      gridW.setWalkableAt(c,r,false);
    }
  } else if(l == 3){
    matrixS[r][c] = n;
    if(n == 0){
      gridS.setWalkableAt(c,r,true);
    } else {
      gridS.setWalkableAt(c,r,false);
    }
  }
};

// send mapEdit
mapEdit = function(l,c,r){
  if(l){
    if(c && r){
      emit({msg:'tileEdit',l:l,c:c,r:r,tile:world[l][r][c]});
    } else {
      emit({msg:'layerEdit',l:l,layer:world[l]});
    }
  } else {
    emit({msg:'mapEdit',world:world});
  }
}

// get tile walkable status
isWalkable = function(z, c, r){
  if(c < 0 || c > mapSize-1 || r < 0 || r > mapSize-1){
    return false;
  } else {
    if(z == 0){
      if(matrixO[r][c] == 0){
        return true;
      } else {
        return false;
      }
    } else if(z == -1){
      if(matrixU[r][c] == 0){
        return true;
      } else {
        return false;
      }
    } else if(z == 1){
      if(matrixB1[r][c] == 0){
        return true;
      } else {
        return false;
      }
    } else if(z == 2){
      if(matrixB2[r][c] == 0){
        return true;
      } else {
        return false;
      }
    } else if(z == -2){
      if(matrixB3[r][c] == 0){
        return true;
      } else {
        return false;
      }
    }
  }
}

getDistance = function(pt1,pt2){
  return Math.sqrt(Math.pow(pt1.x-pt2.x,2) + Math.pow(pt1.y-pt2.y,2));
}

// get tile type from (l,c,r)
// l == 'layer'
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
  if(z == 0){
    return matrixO[r][c];
  } else if(z == -1){
    return matrixU[r][c];
  } else if(z == 1){
    return matrixB1[r][c];
  } else if(z == 2){
    return matrixB2[r][c];
  } else if(z == -2){
    return matrixB3[r][c];
  } else if(z == -3){
    return matrixW[r][c];
  }
}

// get building id from (x,y)
getBuilding = function(x,y){
  var loc = getLoc(x,y);
  for(var i in Building.list){
    var b = Building.list[i];
    for(n = 0; n < b.plot.length; n++){
      if(b.plot[n][0] == loc[0] && b.plot[n][1] == loc[1]){
        return b.id;
      }
    }
  }
}

// check if player has key to door from (x,y,player.id)
keyCheck = function(x,y,p){
  var key = getBuilding(x,y);
  var pKeys = Player.list[p].inventory.keyRing;
  for(var i in pKeys){
    if(pKeys[i].id == key){
      return true;
    }
    return false;
  }
}

// returns chest id if player can access it from (z,x,y,player.id)
chestCheck = function(z,x,y,p){
  var player = Player.list[p];
  for(var i in Item.list){
    var itm = Item.list[i];
    if(itm.type == 'LockedChest' && itm.z == z && itm.x == x && itm.y == y){
      for(var k in player.inventory.keyRing){
        var key = player.inventory.keyRing[k];
        if(itm.id == key){
          return itm.id;
        } else {
          continue;
        }
      }
    } else if(itm.type == 'Chest' && itm.z == z && itm.x == x && itm.y == y){
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
  if(k && k == gateK){
    return true;
  } else {
    if(h && h == gateH){
      return true;
    } else {
      return false;
    }
  }
}

// check if same faction(2), ally(1), neutral(0), enemy(-1)
allyCheck = function(p,id){
  if(Player.list[p]){
    var player = Player.list[p];
    var other = Player.list[id]
    var pHouse = House.list[player.house];
    var oHouse = House.list[other.house];

    if(pHouse){
      if(pHouse.hostile){
        if(oHouse){
          if(player.house == other.house){
            return 2;
          } else {
            for(var i in pHouse.allies){
              if(pHouse.allies[i] == other.house){
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
          if(player.house == other.house){
            return 2;
          } else {
            for(var i in pHouse.allies){
              if(pHouse.allies[i] == other.house){
                return 1;
              } else {
                continue;
              }
            }
            if(oHouse.hostile){
              return -1;
            } else {
              for(var i in pHouse.enemies){
                if(pHouse.enemies[i] == other.house){
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
            if(pHouse.enemies[i] == id){
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
            if(oHouse.enemies[i] == p){
              return -1;
            } else {
              continue;
            }
          }
          return 0;
        }
      } else {
        for(var i in player.friends){
          if(player.friends[i] == id){
            return 1;
          } else {
            continue;
          }
        }
        for(var i in player.enemies){
          if(player.enemies[i] == id){
            return -1;
          } else {
            continue;
          }
        }
        return 0;
      }
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

// get grid of a rectangular area
getArea = function(loc1,loc2,margin=0){
  var c1 = loc1[0];
  var c2 = loc2[0];
  var r1 = loc1[1];
  var r2 = loc2[1];
  var tl = [];
  var br = [];
  var c = 0;
  var r = 0;
  var grid = [];
  if(c1 <= c2){
    c = c2 - c1;
    if(r1 <= r2){
      r = r2 - r1;
      tl = [c1-margin,r1-margin];
      br = [c2+margin,r2+margin];
    } else {
      r = r1 - r2;
      tl = [c1-margin,r2-margin];
      br = [c2+margin,r1+margin];
    }
  } else {
    c = c1 - c2;
    if(r1 <= r2){
      r = r2 - r1;
      tl = [c2-margin,r1-margin];
      br = [c1+margin,r2+margin];
    } else {
      r = r1 - r2;
      tl = [c2-margin,r2-margin];
      br = [c1+margin,r1+margin];
    }
  }
  for(var y = tl[1]; y < br[1]; y++){
    for(var x = tl[0]; x < br[0]; x++){
      if(x >= 0 && x < mapSize && y >= 0 && y < mapSize){
        grid.push([x,y]);
      }
    }
  }
  return grid;
}

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
  if(id == 1){ // brotherhood
    var select = [];
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
          if(getTile(1,tile[0],tile[1]) == 0){
            count++;
          }
        }
        if(count == grid.length){
          var r = Math.random();
          if(r < 0.25){
            select.push(grid[5]);
          } else if(r < 0.5){
            select.push(grid[6]);
          } else if (r < 0.75){
            select.push(grid[9]);
          } else {
            select.push(grid[10]);
          }
        }
      }
    }
    var rand = Math.floor(Math.random() * select.length);
    return select[rand];
  } else if(id == 2){ // goths
    var select = [];
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
          if(getTile(0,tile[0],tile[1]) >= 3 && getTile(0,tile[0],tile[1]) < 4){
            count++;
          }
        }
        if(count == grid.length){
          select.push(grid[12]);
        }
      }
    }
    var rand = Math.floor(Math.random() * select.length);
    return select[rand];
  } else if(id == 3){ // norsemen
    var select = [];
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
          if(getTile(0,tile[0],tile[1]) == 0){
            count++;
          }
        }
        if(count == grid.length){
          select.push(grid[12]);
        }
      }
    }
    var rand = Math.floor(Math.random() * select.length);
    return select[rand];
  } else if(id == 4){ // franks
    var select = [];
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
          if(getTile(0,tile[0],tile[1]) >= 3 && getTile(0,tile[0],tile[1]) < 4){
            count++;
          }
        }
        if(count == grid.length){
          select.push(grid[12]);
        }
      } else {
        continue;
      }
    }
    var rand = Math.floor(Math.random() * select.length);
    return select[rand];
  } else if(id == 5){ // celts
    var best = null;
    var select = null;
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
        if(count == grid.length){
          var center = getCenter(grid[12][0],grid[12][1]);
          for(var e in caveEntrances){
            var ent = caveEntrances[e];
            var cent = getCenter(ent[0],ent[1]);
            var dist = getDistance({x:center[0],y:center[1]},{x:cent[0],y:cent[1]});
            if(!best){
              best = dist;
              select = grid[12];
            } else if(dist < best){
              best = dist;
              select = grid[12];
            }
          }
        }
      }
    }
    return select;
  } else if(id == 6){ // teutons
    var select = [];
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
          if(getTile(0,tile[0],tile[1]) >= 4 && getTile(0,tile[0],tile[1]) < 7){
            count++;
          }
        }
        if(count == grid.length){
          select.push(grid[12]);
        }
      }
    }
    var rand = Math.floor(Math.random() * select.length);
    return select[rand];
  } else if(id == 7){ // outlaws
    var select = [];
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
        if(count == grid.length){
          select.push(grid[12]);
        }
      }
    }
    var rand = Math.floor(Math.random() * select.length);
    return select[rand];
  } else if(id == 8){ // mercenaries
    var select = [];
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
          if(getTile(1,tile[0],tile[1]) == 0 || getTile(1,tile[0],tile[1]) == 3){
            count++;
          }
        }
        if(count == grid.length){
          select.push(grid[12]);
        } else if(count >= grid.length-5){
          var exits = 0;
          for(var n in grid){
            var tile = grid[n];
            var t = getTile(1,tile[0],tile[1]);
            if(t == 2){
              exits++;
            }
          }
          if(exits == 0){
            for(var n in grid){
              var tile = grid[n];
              var t = getTile(1,tile[0],tile[1]);
              if(t == 1){
                tileChange(1,tile[0],tile[1],0);
              }
            }
            select.push(grid[12]);
          }
        }
      }
    }
    var rand = Math.floor(Math.random() * select.length);
    return select[rand];
  }
}

// save map file?
var saveMap = false;

if(saveMap){
  fs.writeFile("./maps/map.txt", JSON.stringify(world), function(err){
    if(err){
      return console.log(err);
    }
    console.log("Map file saved to '/mapfiles' folder.");
  });
};

// day/night cycle
tempus = 'XII.a';
period = 360; // 1=1hr, 2=30m, 4=15m, 12=5m, 60=1m, 120=30s, 360=10s (number of game days per 24 hours)
var cycle = ['XII.a','I.a','II.a','III.a','IV.a','V.a','VI.a','VII.a','VIII.a','IX.a','X.a',
'XI.a','XII.p','I.p','II.p','III.p','IV.p','V.p','VI.p','VII.p','VIII.p','IX.p','X.p','XI.p'];
var tick = 1;
day = 0;

// weather

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

// PLAYER
Player = function(param){
  var self = Character(param);
  self.type = 'player';
  self.name = param.name;
  self.hasHorse = false;
  self.spriteSize = tileSize*1.5;
  self.knighted = false;
  self.crowned = false;
  self.title = '';
  self.friendlyfire = false;
  self.pressingE = false;
  self.pressingT = false;
  self.pressingI = false;
  self.pressingP = false;
  self.pressingF = false;
  self.pressingH = false;
  self.pressingK = false;
  self.pressingL = false;
  self.pressingX = false;
  self.pressingC = false;
  self.pressingB = false;
  self.pressingN = false;
  self.pressingM = false;
  self.pressing1 = false;
  self.pressing2 = false;
  self.pressing3 = false;
  self.pressing4 = false;
  self.pressing5 = false;
  self.pressing6 = false;
  self.pressing7 = false;
  self.pressing8 = false;
  self.pressing9 = false;
  self.pressing0 = false;
  self.mouseAngle = 0;
  self.mountCooldown = 0;
  self.switchCooldown = 0;
  self.hpNat = 100;
  self.spiritNat = 100;
  self.spirit = 100;
  self.spiritMax = 100;
  self.breath = 100;
  self.breathMax = 100;
  self.strength = 10; // ALPHA, default: 1
  self.dexterity = 1;
  self.ghost = false;
  self.die = function(report){
    if(report.id){
      if(Player.list[report.id]){
        Player.list[report.id].combat.target = null;
        Player.list[report.id].action = null;
      }
      if(Player.list[report.id].name){
        console.log(Player.list[report.id].name + ' has killed ' + self.name);
      } else {
        console.log(Player.list[report.id].class + ' has killed ' + self.name);
      }
    } else {
      console.log(self.name + ' has ' + report.cause);
    }
    self.hp = self.hpMax; // ALPHA replace this
    var spawn = randomSpawnO(); // ALPHA replace this
    self.x = spawn[0]; // ALPHA replace this
    self.y = spawn[1]; // ALPHA replace this
  }

  self.checkAggro = function(){
    if(!self.combat.target){
      self.action = null;
    }
    for(var i in self.zGrid){
      var zc = self.zGrid[i][0];
      var zr = self.zGrid[i][1];
      if(zc < 64 && zc > -1 && zr < 64 && zr > -1){
        for(var n in zones[zr][zc]){
          var p = Player.list[zones[zr][zc][n]];
          if(p && p.z == self.z){
            var pDist = self.getDistance({
              x:p.x,
              y:p.y
            });
            if(pDist <= p.aggroRange){ // in aggro range
              var ally = allyCheck(self.id,p.id);
              if(ally <= 0){ // is neutral or enemy
                self.stealthCheck(p);
                if(ally == -1 && p.type == 'npc' &&
                (self.innaWoods == p.innaWoods || (!self.innaWoods && p.innaWoods))){ // is enemy, both in/out woods or not in woods and they are
                  if(!self.stealthed){
                    Player.list[p.id].combat.target = self.id;
                    Player.list[p.id].action = 'combat';
                    console.log(p.class + ' aggro @ ' + self.name);
                  } else if(!self.revealed){
                    Player.list[p.id].combat.target = self.id;
                    Player.list[p.id].action = 'combat';
                    console.log(p.class + ' aggro @ ' + self.name);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  setInterval(function(){
    self.checkAggro();
  },1000);

  self.update = function(){
    self.updateSpd();
    self.zoneCheck();

    if(self.stealthed){
      self.revealCheck();
    }

    if(self.actionCooldown > 0){
      self.actionCooldown--;
    }

    if(self.attackCooldown > 0){
      self.attackCooldown--;
    }

    if(self.mountCooldown > 0){
      self.mountCooldown--;
    }

    if(self.switchCooldown > 0){
      self.switchCooldown--;
    }

    // TORCH
    if(self.pressingT && self.actionCooldown == 0){
      self.lightTorch(Math.random());
      self.actionCooldown = 10;
    }

    // INSPECT

    // PICKUP
    if(self.pressingP && self.actionCooldown == 0 && !self.working){
      var socket = SOCKET_LIST[self.id];
      self.actionCooldown = 10;
      for(var i in Item.list){
        var item = Item.list[i];
        var dist = item.getDistance({x:self.x,y:self.y});
        if(dist < tileSize && item.canPickup){
          Item.list[i].toUpdate = true;
          Item.list[i].pickup(self.id);
          return;
        } else {
          continue;
        }
      }
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>There is nothing to pick up.</i>'}));
    }

    // HORSE
    if(self.pressingH && self.actionCooldown == 0 && !self.working){
    var socket = SOCKET_LIST[self.id];
      if(self.mounted){
        self.actionCooldown = 10;
        self.mounted = false;
        self.baseSpd -= 3;
        self.mountCooldown = 200;
      } else {
        if(self.hasHorse){
          if(self.gear.armor && self.gear.armor.type !== 'cloth'){
            if(self.mountCooldown == 0){
              self.actionCooldown = 10;
              self.mounted = true;
              self.baseSpd += 3;
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Try again shortly.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not wearing any riding gear.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not own a horse.</i>'}));
        }
      }
    }

    // SWITCH WEAPONS
    if(self.pressingX && self.actionCooldown == 0){
      var socket = SOCKET_LIST[self.id];
      if(self.switchCooldown == 0){
        if(self.gear.weapon){
          if(self.gear.weapon2){
            var switchwep = self.gear.weapon2;
            self.gear.weapon2 = self.gear.weapon;
            self.gear.weapon = switchwep;
            self.actionCooldown = 10;
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You switch weapons to </i><b>' + self.gear.weapon.name + '</b>.'}));
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You have no secondary weapon equipped.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You have no weapons equipped.</i>'}));
        }
      } else {
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>Try again shortly.</i>'}));
      }
    }

    // BAG
    if(self.pressingB && self.actionCooldown == 0){
      self.actionCooldown += 10;
      var socket = SOCKET_LIST[self.id];
      var all = '';
      if(self.inventory.key > 0){
        var keys = '<b>Keys</b>: ' + self.inventory.key + '<br>';
        all += keys;
      }
      if(self.inventory.wood > 0){
        var wood = '<b>Wood</b>: ' + self.inventory.wood + '<br>';
        all += wood;
      }
      if(self.inventory.stone > 0){
        var stone = '<b>Stone</b>: ' + self.inventory.stone + '<br>';
        all += stone;
      }
      if(self.inventory.grain > 0){
        var grain = '<b>Grain</b>: ' + self.inventory.grain + '<br>';
        all += grain;
      }
      if(self.inventory.ironore > 0){
        var ironore = '<b>IronOre</b>: ' + self.inventory.ironore + '<br>';
        all += ironore;
      }
      if(self.inventory.ironbar > 0){
        var ironbar = '<b>Iron</b>: ' + self.inventory.iron + '<br>';
        all += ironbar;
      }
      if(self.inventory.steelbar > 0){
        var steelbar = '<b>Steel</b>: ' + self.inventory.steel + '<br>';
        all += steelbar;
      }
      if(self.inventory.boarhide > 0){
        var boarhide = '<b>BoarHide</b>: ' + self.inventory.boarhide + '<br>';
        all += boarhide;
      }
      if(self.inventory.leather > 0){
        var leather = '<b>Leather</b>: ' + self.inventory.leather + '<br>';
        all += leather;
      }
      if(self.inventory.silverore > 0){
        var silverore = '<b>SilverOre</b>: ' + self.inventory.silverore + '<br>';
        all += silverore;
      }
      if(self.inventory.silver > 0){
        var silver = '<b>Silver</b>: ' + self.inventory.silver + '<br>';
        all += silver;
      }
      if(self.inventory.goldore > 0){
        var goldore = '<b>GoldOre</b>: ' + self.inventory.goldore + '<br>';
        all += goldore;
      }
      if(self.inventory.gold > 0){
        var gold = '<b>Gold</b>: ' + self.inventory.gold + '<br>';
        all += gold;
      }
      if(self.inventory.diamond > 0){
        var diamond = '<b>Diamond</b>: ' + self.inventory.diamond + '<br>';
        all += diamond;
      }
      if(self.inventory.huntingknife > 0){
        var huntingknife = '<b>HuntingKnife</b>: ' + self.inventory.huntingknife + '<br>';
        all += huntingknife;
      }
      if(self.inventory.dague > 0){
        var dague = '<b>Dague</b>: ' + self.inventory.dague + '<br>';
        all += dague;
      }
      if(self.inventory.rondel > 0){
        var rondel = '<b>Rondel</b>: ' + self.inventory.rondel + '<br>';
        all += rondel;
      }
      if(self.inventory.misericorde > 0){
        var misericorde = '<b>Misericorde</b>: ' + self.inventory.misericorde + '<br>';
        all += misericorde;
      }
      if(self.inventory.bastardsword > 0){
        var bastardsword = '<b>BastardSword</b>: ' + self.inventory.bastardsword + '<br>';
        all += bastardsword;
      }
      if(self.inventory.longsword > 0){
        var longsword = '<b>Longsword</b>: ' + self.inventory.longsword + '<br>';
        all += longsword;
      }
      if(self.inventory.zweihander > 0){
        var zweihander = '<b>Zweihander</b>: ' + self.inventory.zweihander + '<br>';
        all += zweihander;
      }
      if(self.inventory.morallta > 0){
        var morallta = '<b>Morallta</b>: ' + self.inventory.morallta + '<br>';
        all += morallta;
      }
      if(self.inventory.bow > 0){
        var bow = '<b>Bow</b>: ' + self.inventory.bow + '<br>';
        all += bow;
      }
      if(self.inventory.welshlongbow > 0){
        var welshlongbow = '<b>WelshLongbow</b>: ' + self.inventory.welshlongbow + '<br>';
        all += welshlongbow;
      }
      if(self.inventory.knightlance > 0){
        var knightlance = '<b>KnightLance</b>: ' + self.inventory.knightlance + '<br>';
        all += knightlance;
      }
      if(self.inventory.rusticlance > 0){
        var rusticlance = '<b>RusticLance</b>: ' + self.inventory.rusticlance + '<br>';
        all += rusticlance;
      }
      if(self.inventory.paladinlance > 0){
        var paladinlance = '<b>PaladinLance</b>: ' + self.inventory.paladinlance + '<br>';
        all += paladinlance;
      }
      if(self.inventory.brigandine > 0){
        var brigandine = '<b>Brigandine</b>: ' + self.inventory.brigandine + '<br>';
        all += brigandine;
      }
      if(self.inventory.lamellar > 0){
        var lamellar = '<b>Lamellar</b>: ' + self.inventory.lamellar + '<br>';
        all += lamellar;
      }
      if(self.inventory.maille > 0){
        var maille = '<b>Maille</b>: ' + self.inventory.maille + '<br>';
        all += maille;
      }
      if(self.inventory.hauberk > 0){
        var hauberk = '<b>Hauberk</b>: ' + self.inventory.hauberk + '<br>';
        all += hauberk;
      }
      if(self.inventory.brynja > 0){
        var brynja = '<b>Brynja</b>: ' + self.inventory.brynja + '<br>';
        all += brynja;
      }
      if(self.inventory.cuirass > 0){
        var cuirass = '<b>Cuirass</b>: ' + self.inventory.cuirass + '<br>';
        all += cuirass;
      }
      if(self.inventory.steelplate > 0){
        var steelplate = '<b>SteelPlate</b>: ' + self.inventory.steelplate + '<br>';
        all += steelplate;
      }
      if(self.inventory.greenwichplate > 0){
        var greenwichplate = '<b>GreenwichPlate</b>: ' + self.inventory.greenwichplate + '<br>';
        all += greenwichplate;
      }
      if(self.inventory.gothicplate > 0){
        var gothicplate = '<b>GothicPlate</b>: ' + self.inventory.gothicplate + '<br>';
        all += gothicplate;
      }
      if(self.inventory.clericrobe > 0){
        var clericrobe = '<b>ClericRobe</b>: ' + self.inventory.clericrobe + '<br>';
        all += clericrobe;
      }
      if(self.inventory.monkcowl > 0){
        var monkcowl = '<b>MonkCowl</b>: ' + self.inventory.monkcowl + '<br>';
        all += monkcowl;
      }
      if(self.inventory.blackcloak > 0){
        var blackcloak = '<b>BlackCloak</b>: ' + self.inventory.blackcloak + '<br>';
        all += blackcloak;
      }
      if(self.inventory.tome > 0){
        var tome = '<b>Tome</b>: ' + self.inventory.tome + '<br>';
        all += tome;
      }
      if(self.inventory.runicscroll > 0){
        var runicscroll = '<b>RunicScroll</b>: ' + self.inventory.runicscroll + '<br>';
        all += runicscroll;
      }
      if(self.inventory.sacredtext > 0){
        var sacredtext = '<b>SacredText</b>: ' + self.inventory.sacredtext + '<br>';
        all += sacredtext;
      }
      if(self.inventory.stoneaxe > 0){
        var stoneaxe = '<b>StoneAxe</b>: ' + self.inventory.stoneaxe + '<br>';
        all += stoneaxe;
      }
      if(self.inventory.ironaxe > 0){
        var ironaxe = '<b>IronAxe</b>: ' + self.inventory.ironaxe + '<br>';
        all += ironaxe;
      }
      if(self.inventory.pickaxe > 0){
        var pickaxe = '<b>PickAxe</b>: ' + self.inventory.pickaxe + '<br>';
        all += pickaxe;
      }
      if(self.inventory.torch > 0){
        var torch = '<b>Torch</b>: ' + self.inventory.torch + '<br>';
        all += torch;
      }
      if(self.inventory.bread > 0){
        var bread = '<b>Bread</b>: ' + self.inventory.bread + '<br>';
        all += bread;
      }
      if(self.inventory.fish > 0){
        var fish = '<b>Fish</b>: ' + self.inventory.fish + '<br>';
        all += fish;
      }
      if(self.inventory.lamb > 0){
        var lamb = '<b>Lamb</b>: ' + self.inventory.lamb + '<br>';
        all += lamb;
      }
      if(self.inventory.boarmeat > 0){
        var boarmeat = '<b>BoarMeat</b>: ' + self.inventory.boarmeat + '<br>';
        all += boarmeat;
      }
      if(self.inventory.venison > 0){
        var venison = '<b>Venison</b>: ' + self.inventory.venison + '<br>';
        all += venison;
      }
      if(self.inventory.poachedfish > 0){
        var poachedfish = '<b>PoachedFish</b>: ' + self.inventory.poachedfish + '<br>';
        all += poachedfish;
      }
      if(self.inventory.lambchop > 0){
        var lambchop = '<b>LambChop</b>: ' + self.inventory.lambchop + '<br>';
        all += lambchop;
      }
      if(self.inventory.boarshank > 0){
        var boarshank = '<b>BoarShank</b>: ' + self.inventory.boarshank + '<br>';
        all += boarshank;
      }
      if(self.inventory.venisonloin > 0){
        var venisonloin = '<b>VenisonLoin</b>: ' + self.inventory.venisonloin + '<br>';
        all += venisonloin;
      }
      if(self.inventory.mead > 0){
        var mead = '<b>Mead</b>: ' + self.inventory.mead + '<br>';
        all += mead;
      }
      if(self.inventory.saison > 0){
        var saison = '<b>Saison</b>: ' + self.inventory.saison + '<br>';
        all += saison;
      }
      if(self.inventory.flanders > 0){
        var flanders = '<b>Flanders</b>: ' + self.inventory.flanders + '<br>';
        all += flanders;
      }
      if(self.inventory.bieredegarde > 0){
        var bieredegarde = '<b>BiereDeGarde</b>: ' + self.inventory.bieredegarde + '<br>';
        all += bieredegarde;
      }
      if(self.inventory.bordeaux > 0){
        var bordeaux = '<b>Bordeaux</b>: ' + self.inventory.bordeaux + '<br>';
        all += bordeaux;
      }
      if(self.inventory.bourgogne > 0){
        var bourgogne = '<b>Bourgogne</b>: ' + self.inventory.bourgogne + '<br>';
        all += bourgogne;
      }
      if(self.inventory.chianti > 0){
        var chianti = '<b>Chianti</b>: ' + self.inventory.chianti + '<br>';
        all += chianti;
      }
      if(self.inventory.crown > 0){
        var crown = '<b>Crown</b>: ' + self.inventory.crown + '<br>';
        all += crown;
      }
      if(self.inventory.worldmap > 0){
        var worldmap = '<b>WorldMap</b>: ' + self.inventory.worldmap + '<br>';
        all += worldmap;
      }
      if(self.inventory.arrows > 0){
        var arrows = '<b>Arrows</b>: ' + self.inventory.arrows + '<br>';
        all += arrows;
      }
      if(self.inventory.relic > 0){
        var relic = '<b>Relic</b>: ' + self.inventory.relic + '<br>';
        all += relic;
      }
      if(all == ''){
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>You have nothing in your bag.</i>'}));
      } else {
        socket.write(JSON.stringify({msg:'addToChat',message:'<p>'+all+'</p>'}));
      }
    }

    // INTERACTIONS
    if(self.pressingAttack && self.actionCooldown == 0 && !self.working){
      var loc = getLoc(self.x,self.y);
      var dir = null;
      if(self.facing == 'down'){
        dir = [loc[0],loc[1]+1];
      } else if(self.facing == 'up'){
        dir = [loc[0],loc[1]-1];
      } else if(self.facing == 'left'){
        dir = [loc[0]-1,loc[1]];
      } else if(self.facing == 'right'){
        dir = [loc[0]+1,loc[1]];
      }
      if(!isWalkable(self.z,dir[0],dir[1])){
        Interact(self.id,dir);
      } else {
        if(self.gear.weapon && self.attackCooldown == 0 && self.z !== -3){
          if(self.gear.weapon.type == 'bow' && self.inventory.arrows > 0){
            self.shootArrow(self.mouseAngle);
            self.attackCooldown += self.gear.weapon.attackrate/self.dexterity;
          } else {
            self.attack(self.facing);
            self.attackCooldown += self.gear.weapon.attackrate/self.dexterity;
          }
        }
      }
    }

    // WORK ACTIONS
    if(self.pressingF && self.actionCooldown == 0 && !self.working){
      var socket = SOCKET_LIST[self.id];
      var loc = getLoc(self.x,self.y);
      var tile = getTile(0,loc[0],loc[1]);
      var uLoc = getLoc(self.x,self.y-tileSize);
      var dLoc = getLoc(self.x,self.y+tileSize);
      var lLoc = getLoc(self.x-tileSize,self.y);
      var rLoc = getLoc(self.x+tileSize,self.y);
      // fish
      if(self.z == 0 && self.facing == 'up' && getTile(0,uLoc[0],uLoc[1]) == 0){
        self.actionCooldown = 10;
        if(getTile(6,uLoc[0],uLoc[1]) > 0){
          var rand = Math.floor(Math.random() * 6000);
          self.working = true;
          self.fishing = true;
          setTimeout(function(){
            if(self.fishing){
              self.working = false;
              self.fishing = false;
              self.inventory.fish++;
              tileChange(6,uLoc[0],uLoc[1],-1,true);
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You caught a Fish.</i>'}));
            } else {
              return;
            }
          },rand);
        } else {
          self.working = true;
          self.fishing = true;
        }
      } else if(self.z == 0 && self.facing == 'down' && getTile(0,dLoc[0],dLoc[1]) == 0){
        self.actionCooldown = 10;
        if(getTile(6,dLoc[0],dLoc[1]) > 0){
          var rand = Math.floor(Math.random() * 6000);
          self.working = true;
          self.fishing = true;
          setTimeout(function(){
            if(self.working){
              self.working = false;
              self.fishing = false;
              self.inventory.fish++;
              tileChange(6,dLoc[0],dLoc[1],-1,true);
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You caught a Fish.</i>'}));
            } else {
              return;
            }
          },rand);
        } else {
          self.working = true;
          self.fishing = true;
        }
      } else if(self.z == 0 && self.facing == 'left' && getTile(0,lLoc[0],lLoc[1]) == 0){
        self.actionCooldown = 10;
        if(getTile(6,lLoc[0],lLoc[1]) > 0){
          var rand = Math.floor(Math.random() * 6000);
          self.working = true;
          self.fishing = true;
          setTimeout(function(){
            if(self.working){
              self.working = false;
              self.fishing = false;
              self.inventory.fish++;
              tileChange(6,lLoc[0],lLoc[1],-1,true);
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You caught a Fish.</i>'}));
            } else {
              return;
            }
          },rand);
        } else {
          self.working = true;
          self.fishing = true;
        }
      } else if(self.z == 0 && self.facing == 'right' && getTile(0,rLoc[0],rLoc[1]) == 0){
        self.actionCooldown = 10;
        if(getTile(6,rLoc[0],rLoc[1]) > 0){
          var rand = Math.floor(Math.random() * 6000);
          self.working = true;
          self.fishing = true;
          setTimeout(function(){
            if(self.working){
              self.working = false;
              self.fishing = false;
              self.inventory.fish++;
              tileChange(6,rLoc[0],rLoc[1],-1,true);
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You caught a Fish.</i>'}));
            } else {
              return;
            }
          },rand);
        } else {
          self.working = true;
          self.fishing = true;
        }
        // clear brush
      } else if(self.z == 0 && tile >= 3 && tile < 4){
        self.actionCooldown = 10;
        self.working = true;
        setTimeout(function(){
          if(self.working){
            tileChange(0,loc[0],loc[1],7);
            emit({msg:'mapEdit',world:world});
            self.working = false;
          } else {
            return;
          }
        },3000/self.strength);
        // gather wood
      } else if(self.z == 0 && (tile >= 1 && tile < 3)){
        self.actionCooldown = 10;
        self.working = true;
        if(self.inventory.stoneaxe > 0 || self.inventory.ironaxe > 0){
          self.chopping = true;
        }
        setTimeout(function(){
          if(self.working){
            tileChange(6,loc[0],loc[1],-50,true); // ALPHA
            self.inventory.wood += 50; // ALPHA
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You chopped 50 Wood.</i>'}));
            self.working = false;
            self.chopping = false;
            var tile = getTile(0,loc[0],loc[1]);
            var res = getTile(6,loc[0],loc[1]);
            if(tile >= 1 && tile < 2 && res <= 100){
              tileChange(0,loc[0],loc[1],1,true);
              for(var i in hForestSpawns){
                if(hForestSpawns[i].toString() == loc.toString()){
                  biomes.hForest--;
                  hForestSpawns.splice(i,1);
                  return;
                } else {
                  continue;
                }
              }
              emit({msg:'mapEdit',world:world});
            } else if(tile >= 2 && tile < 3 && getTile(6,loc[0],loc[1]) <= 0){
              tileChange(0,loc[0],loc[1],7);
              emit({msg:'mapEdit',world:world});
            }
          } else {
            return;
          }
        },6000/self.strength);
        // gather stone
      } else if(self.z == 0 && tile >= 4 && tile < 6){
        self.actionCooldown = 10;
        self.working = true;
        var mult = 3;
        if(self.inventory.pickaxe > 0){
          self.mining = true;
          mult = 1;
        }
        setTimeout(function(){
          if(self.working){
            tileChange(6,loc[0],loc[1],-50,true); // ALPHA
            self.inventory.stone += 50; // ALPHA
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You quarried 50 Stone.</i>'}));
            self.working = false;
            self.mining = false;
            if(tile >= 4 && tile < 5 && getTile(6,loc[0],loc[1]) <= 0){
              tileChange(0,loc[0],loc[1],7);
              emit({msg:'mapEdit',world:world});
            }
          } else {
            return;
          }
        },(10000*mult)/self.strength);
        // mine metal
      } else if(self.z == -1 && getTile(1,loc[0],loc[1]) >= 3 && getTile(1,loc[0],loc[1]) < 4){
        self.actionCooldown = 10;
        self.working = true;
        var mult = 3;
        if(self.inventory.pickaxe > 0){
          self.mining = true;
          mult = 1;
        }
        setTimeout(function(){
          if(self.working && self.mining){
            tileChange(7,loc[0],loc[1],-1,true);
            //
            self.working = false;
            self.mining = false;
          } else {
            return;
          }
        },(10000*mult)/self.strength);
        // farm
      } else if(self.z == 0 && tile == 8){
        self.actionCooldown = 10;
        if(!nightfall){
          var f = Building.list[getBuilding(self.x,self.y)];
          var count = 0;
          for(var i in f.plot){
            if(getTile(0,f.plot[i][0],f.plot[i][1]) == 8){
              count++;
            }
          }
          if(count == 9 && getTile(6,loc[0],loc[1]) < 25){
            self.working = true;
            self.farming = true;
            setTimeout(function(){
              if(self.working && self.farming){
                tileChange(6,loc[0],loc[1],25,true); // ALPHA, default:1
                self.working = false;
                self.farming = false;
                var count = 0;
                for(var i in f.plot){
                  var n = f.plot[i];
                  if(getTile(6,n[0],n[1]) >= 25){
                    count++;
                  } else {
                    continue;
                  }
                }
                if(count == 9){
                  for(var i in f.plot){
                    var n = f.plot[i];
                    tileChange(0,n[0],n[1],9);
                  }
                  emit({msg:'mapEdit',world:world});
                }
              } else {
                return;
              }
            },10000);
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>There is no more work to be done here.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>It is too dark out for farmwork.</i>'}));
        }
      } else if(self.z == 0 && getTile(0,loc[0],loc[1]) == 9){
        self.actionCooldown = 10;
        if(!nightfall){
          if(getTile(6,loc[0],loc[1]) < 50){
            var f = Building.list[getBuilding(self.x,self.y)];
            self.working = true;
            self.farming = true;
            setTimeout(function(){
              if(self.working && getTile(6,loc[0],loc[1]) < 50){
                tileChange(6,loc[0],loc[1],25,true); // ALPHA, default:1
                self.working = false;
                self.farming = false;
                var count = 0;
                var plot = f.plot;
                for(var i in plot){
                  if(getTile(6,plot[i][0],plot[i][1]) >= 50){
                    count++;
                  } else {
                    continue;
                  }
                }
                if(count == 9){
                  for(var i in plot){
                    tileChange(0,plot[i][0],plot[i][1],10);
                  }
                  emit({msg:'mapEdit',world:world});
                }
              } else {
                return;
              }
            },10000);
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>There is no more work to be done here.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>It is too dark out for farmwork.</i>'}));
        }
      } else if(self.z == 0 && getTile(0,loc[0],loc[1]) == 10){
        self.actionCooldown = 10;
        var f = getBuilding(self.x,self.y);
        self.working = true;
        self.farming = true;
        setTimeout(function(){
          if(self.working){
            tileChange(6,loc[0],loc[1],-1,true);
            self.inventory.grain += 1;
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You harvested Grain.</i>'}));
            self.working = false;
            self.farming = false;
            if(getTile(6,loc[0],loc[1]) <= 0){
              tileChange(0,loc[0],loc[1],8);
              emit({msg:'mapEdit',world:world});
            }
          } else {
            return;
          }
        },10000);
        // build
      } else if(self.z == 0 && (getTile(0,loc[0],loc[1]) == 11 || getTile(0,loc[0],loc[1]) == 11.5)){
        Build(self.id);
      } else {
        return;
      }
    }

    // CLASS
    if(self.gear.head && self.gear.head.name == 'crown' && self.crowned){
      self.class = 'King';
      self.spriteSize = tileSize;
    } else if(self.gear.armor){
      if(self.gear.armor.type == 'leather'){
        if(self.mounted && self.gear.weapon){
          if(self.gear.weapon.type == 'bow'){
            self.class = 'Ranger';
            self.spriteSize = tileSize * 2;
          } else {
            self.class = 'Scout';
            self.spriteSize = tileSize * 2;
          }
        } else if(self.mounted){
          self.class = 'Scout';
          self.spriteSize = tileSize * 2;
        } else {
          if(self.gear.weapon){
            if(self.gear.weapon.type == 'bow'){
              self.class = 'Hunter';
              self.spriteSize = tileSize * 1.5;
            } else {
              self.class = 'Rogue';
              self.spriteSize = tileSize * 1.5;
            }
          } else {
            self.class = 'Rogue';
            self.spriteSize = tileSize * 1.5;
          }
        }
      } else if(self.gear.armor.type == 'chainmail'){
        if(self.mounted && self.gear.weapon){
          if(self.gear.weapon.type == 'bow'){
            self.class = 'MountedArcher';
            self.spriteSize = tileSize * 2;
          } else {
            self.class = 'Horseman';
            self.spriteSize = tileSize * 2;
          }
        } else if(self.mounted){
          self.class = 'Horseman';
          self.spriteSize = tileSize * 2;
        } else if(self.gear.weapon){
          if(self.gear.weapon.type == 'bow'){
            self.class = 'Archer';
            self.spriteSize = tileSize * 1.5;
          } else {
            self.class = 'Swordsman';
            self.spriteSize = tileSize * 1.5;
          }
        } else {
          self.class = 'Swordsman';
          self.spriteSize = tileSize * 1.5;
        }
      } else if(self.gear.armor.type == 'plate'){
        if(self.knighted){
          if(self.mounted && self.gear.weapon){
            if(self.gear.weapon.type == 'lance'){
              self.class = 'Crusader';
              self.spriteSize = tileSize * 3;
            } else {
              self.class = 'Knight';
              self.spriteSize = tileSize * 2;
            }
          } else if(self.mounted){
            self.class = 'Knight';
            self.spriteSize = tileSize * 2;
          } else {
            self.class = 'Templar';
            self.spriteSize = tileSize * 1.5;
          }
        } else {
          if(self.mounted && self.gear.weapon){
            if(self.gear.weapon.type == 'lance'){
              self.class = 'Lancer';
              self.spriteSize = tileSize * 3;
            } else {
              self.class = 'Cavalry';
              self.spriteSize = tileSize * 2;
            }
          } else if(self.mounted){
            self.class = 'Cavalry';
            self.spriteSize = tileSize * 2;
          } else {
            self.class = 'Hero';
            self.spriteSize = tileSize * 1.5;
          }
        }
      } else if(self.gear.armor.type == 'cloth'){
        if(self.gear.armor.name == 'MonkCowl'){
          self.class = 'Mage';
          self.spriteSize = tileSize * 1.5;
        } else if(self.gear.armor.name == 'BlackCloak'){
          self.class = 'Warlock';
          self.spriteSize = tileSize * 1.5;
        } else {
          self.class = 'Priest';
          self.spriteSize = tileSize;
        }
      }
    } else {
      self.class = 'Serf';
      self.spriteSize = tileSize * 1.5;
    }
  }

  self.lightTorch = function(torchId){
    if(self.hasTorch){
      Item.list[self.hasTorch].toRemove = true;
      self.hasTorch = false;
    } else if(self.inventory.torch > 0){
      if(self.z !== -3){
        LitTorch({
          id:torchId,
          parent:self.id,
          x:self.x,
          y:self.y,
          z:self.z,
          qty:1,
          innaWoods:self.innaWoods
        })
        self.inventory.torch--;
        self.hasTorch = torchId;
      } else {
        SOCKET_LIST[self.id].write({msg:'addToChat',message:'<i>You cannot do that here.</i>'});
      }
    } else {
      SOCKET_LIST[self.id].write({msg:'addToChat',message:'<i>You have no torches.</i>'});
    }
  }

  // x,y movement
  self.updateSpd = function(){
    var socket = SOCKET_LIST[self.id];
    var loc = getLoc(self.x, self.y);
    var rLoc = getLoc(self.x + (tileSize/8), self.y);
    var lLoc = getLoc(self.x - (tileSize/8), self.y);
    var uLoc = getLoc(self.x, self.y - (tileSize/8));
    var dLoc = getLoc(self.x, self.y + (tileSize/2));
    var b = getBuilding(self.x,self.y);
    var exit = getBuilding(self.x,self.y-tileSize);
    var b2 = getBuilding(self.x,self.y+tileSize);
    var rightBlocked = false;
    var leftBlocked = false;
    var upBlocked = false;
    var downBlocked = false;

    // outdoor collisions
    if(self.z == 0){
      if(((getTile(0,rLoc[0],rLoc[1]) == 19 && !keyCheck(self.x+(tileSize/2),self.y,self.id)) ||
      (!isWalkable(0,rLoc[0],rLoc[1]) && getTile(0,rLoc[0],rLoc[1]) !== 0) ||
      (self.x + 10) > (mapPx - tileSize)) && isWalkable(0,loc[0],loc[1])){
        rightBlocked = true;
      }
      if(((getTile(0,lLoc[0],lLoc[1]) == 19 && !keyCheck(self.x-(tileSize/2),self.y,self.id)) || (!isWalkable(0,lLoc[0],lLoc[1]) && getTile(0,lLoc[0],lLoc[1]) !== 0) ||
      (self.x - 10) < 0) && isWalkable(0,loc[0],loc[1])){
        leftBlocked = true;
      }
      if(((getTile(0,uLoc[0],uLoc[1]) == 19 && !keyCheck(self.x,self.y-(tileSize/2),self.id)) || (!isWalkable(0,uLoc[0],uLoc[1]) && getTile(0,uLoc[0],uLoc[1]) !== 0) ||
      (getTile(5,uLoc,uLoc[1]) == 'gatec' && !gateCheck(self.x,self.y-(tileSize/2),self.house,self.kingdom)) ||
      (self.y - 10) < 0) && isWalkable(0,loc[0],loc[1])){
        upBlocked = true;
      }
      if((getTile(0,dLoc[0],dLoc[1]) == 6 || (getTile(0,dLoc[0],dLoc[1]) == 19 && !keyCheck(self.x,self.y+(tileSize/2),self.id)) || (!isWalkable(0,dLoc[0],dLoc[1]) && getTile(0,dLoc[0],dLoc[1]) !== 0) ||
      (getTile(5,dLoc[0],dLoc[1]) == 'gatec' && !gateCheck(self.x,self.y+(tileSize/2),self.house,self.kingdom)) ||
      (self.y + 10) > (mapPx - tileSize)) && isWalkable(0,loc[0],loc[1])){
        downBlocked = true;
      }
    }

    // cave collisions
    if(self.z == -1){
      if(!isWalkable(-1,rLoc[0],rLoc[1]) || getTile(1,rLoc[0],rLoc[1]) == 2 || (self.x + 10) > (mapPx - tileSize)){
        rightBlocked = true;
      }
      if(!isWalkable(-1,lLoc[0],lLoc[1]) || getTile(1,lLoc[0],lLoc[1]) == 2 || (self.x - 10) < 0){
        leftBlocked = true;
      }
      if(!isWalkable(-1,uLoc[0],uLoc[1]) || getTile(1,uLoc[0],uLoc[1]) == 2 || (self.y - 10) < 0){
        upBlocked = true;
      }
      if(!isWalkable(-1,dLoc[0],dLoc[1]) || (self.y + 10) > (mapPx - tileSize)){
        downBlocked = true;
      }
    }

    // indoor1 collisions
    if(self.z == 1){
      if(!isWalkable(1,rLoc[0],rLoc[1])){
        rightBlocked = true;
      }
      if(!isWalkable(1,lLoc[0],lLoc[1])){
        leftBlocked = true;
      }
      if(!isWalkable(1,uLoc[0],uLoc[1]) || (getTile(4,uLoc[0],uLoc[1]) == 7 && !self.rank &&
      (Building.list[b].house == self.house || Building.list[b].kingdom == self.kingdom))){
        upBlocked = true;
      }
      if(!isWalkable(1,dLoc[0],dLoc[1])){
        downBlocked = true;
      }
    }

    // indoor2 collisions
    if(self.z == 2){
      if(!isWalkable(2,rLoc[0],rLoc[1])){
        rightBlocked = true;
      }
      if(!isWalkable(2,lLoc[0],lLoc[1])){
        leftBlocked = true;
      }
      if(!isWalkable(2,uLoc[0],uLoc[1])){
        upBlocked = true;
      }
      if(!isWalkable(2,dLoc[0],dLoc[1])){
        downBlocked = true;
      }
    }

    // cellar/dungeon collisions
    if(self.z == -2){
      if(!isWalkable(-2,rLoc[0],rLoc[1])){
        rightBlocked = true;
      }
      if(!isWalkable(-2,lLoc[0],lLoc[1])){
        leftBlocked = true;
      }
      if(!isWalkable(-2,uLoc[0],uLoc[1])){
        upBlocked = true;
      }
      if(!isWalkable(-2,dLoc[0],dLoc[1])){
        downBlocked = true;
      }
    }

    if(self.pressingRight){
      self.facing = 'right';
      self.working = false;
      self.chopping = false;
      self.mining = false;
      self.farming = false;
      self.building = false;
      self.fishing = false;
      if(!rightBlocked){
        self.x += self.maxSpd;
      }
    } else if(self.pressingLeft){
      self.facing = 'left';
      self.working = false;
      self.chopping = false;
      self.mining = false;
      self.farming = false;
      self.building = false;
      self.fishing = false;
      if(!leftBlocked){
        self.x -= self.maxSpd;
      }
    }

    if(self.pressingUp){
      self.facing = 'up';
      self.working = false;
      self.chopping = false;
      self.mining = false;
      self.farming = false;
      self.building = false;
      self.fishing = false;
      if(!upBlocked){
        self.y -= self.maxSpd;
      }
    } else if(self.pressingDown){
      self.facing = 'down';
      self.working = false;
      self.chopping = false;
      self.mining = false;
      self.farming = false;
      self.building = false;
      self.fishing = false;
      if(!downBlocked){
        self.y += self.maxSpd;
      }
    }

    // terrain effects and z movement
    if(self.z == 0){
      var tile = getTile(0,loc[0],loc[1]);
      if(tile == 6){
        self.z = -1;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * self.drag;
        socket.write(JSON.stringify({msg:'bgm',x:self.x,y:self.y,z:self.z}));
      } else if(tile >= 1 && tile < 2){
        self.innaWoods = true;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.3) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) >= 2 && getTile(0,loc[0],loc[1]) < 4){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.5) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) >= 4 && getTile(0,loc[0],loc[1]) < 5){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.6) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && !self.onMtn){
        self.innaWoods = false;
        self.maxSpd = (self.baseSpd * 0.2) * self.drag;
        setTimeout(function(){
          if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6){
            self.onMtn = true;
          }
        },2000);
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && self.onMtn){
        self.maxSpd = (self.baseSpd * 0.5) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) == 18){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 1.1) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) == 14 || getTile(0,loc[0],loc[1]) == 16){
        Building.list[b].occ++;
        self.z = 1;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * self.drag;
        setTimeout(function(){
          socket.write(JSON.stringify({msg:'bgm',x:self.x,y:self.y,z:self.z,b:b}));
        },100);
      } else if(getTile(0,loc[0],loc[1]) == 19){
        Building.list[b].occ++;
        self.z = 1;
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>🗝 You unlock the door.</i>'}));
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * self.drag;
        setTimeout(function(){
          socket.write(JSON.stringify({msg:'bgm',x:self.x,y:self.y,z:self.z,b:b}));
        },100);
      } else if(getTile(0,loc[0],loc[1]) == 0){
        self.z = -3;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.2) * self.drag;
        socket.write(JSON.stringify({msg:'bgm',x:self.x,y:self.y,z:self.z}));
      } else {
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * self.drag;
      }
    } else if(self.z == -1){
      if(getTile(1,loc[0],loc[1]) == 2){
        self.z = 0;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.9) * self.drag;
        socket.write(JSON.stringify({msg:'bgm',x:self.x,y:self.y,z:self.z}));
      }
    } else if(self.z == -2){
      if(getTile(8,loc[0],loc[1]) == 5){
        self.z = 1;
        self.y += (tileSize/2);
        self.facing = 'down';
        socket.write(JSON.stringify({msg:'bgm',x:self.x,y:self.y,z:self.z,b:b2}));
      }
    } else if(self.z == -3){
      if(self.breath > 0){
        self.breath -= 0.25;
      } else {
        self.hp -= 0.5;
      }
      if(self.hp <= 0){
        self.die({cause:'drowned'});
      }
      if(getTile(0,loc[0],loc[1]) !== 0){
        self.z = 0;
        self.breath = self.breathMax;
        socket.write(JSON.stringify({msg:'bgm',x:self.x,y:self.y,z:self.z}));
      }
    } else if(self.z == 1){
      if(getTile(0,loc[0],loc[1] - 1) == 14 || getTile(0,loc[0],loc[1] - 1) == 16  || getTile(0,loc[0],loc[1] - 1) == 19){
        Building.list[exit].occ--;
        self.z = 0;
        socket.write(JSON.stringify({msg:'bgm',x:self.x,y:self.y,z:self.z}));
      } else if(getTile(4,loc[0],loc[1]) == 3 || getTile(4,loc[0],loc[1]) == 4 || getTile(4,loc[0],loc[1]) == 7){
        self.z = 2;
        self.y += (tileSize/2);
        self.facing = 'down'
        socket.write(JSON.stringify({msg:'bgm',x:self.x,y:self.y,z:self.z,b:b2}));
      } else if(getTile(4,loc[0],loc[1]) == 5 || getTile(4,loc[0],loc[1]) == 6){
        self.z = -2;
        self.y += (tileSize/2);
        self.facing = 'down';
        socket.write(JSON.stringify({msg:'bgm',x:self.x,y:self.y,z:self.z,b:b2}));
      }
    } else if(self.z == 2){
      if(getTile(4,loc[0],loc[1]) == 3 || getTile(4,loc[0],loc[1]) == 4){
        self.z = 1;
        self.y += (tileSize/2);
        self.facing = 'down';
        socket.write(JSON.stringify({msg:'bgm',x:self.x,y:self.y,z:self.z,b:b2}));
      }
    }
  }

  self.getInitPack = function(){
    return {
      type:self.type,
      name:self.name,
      id:self.id,
      house:self.house,
      kingdom:self.kingdom,
      x:self.x,
      y:self.y,
      z:self.z,
      class:self.class,
      rank:self.rank,
      friends:self.friends,
      enemies:self.enemies,
      gear:self.gear,
      inventory:{
        arrows:self.inventory.arrows
      },
      spriteSize:self.spriteSize,
      innaWoods:self.innaWoods,
      facing:self.facing,
      stealthed:self.stealthed,
      revealed:self.revealed,
      hp:self.hp,
      hpMax:self.hpMax,
      spirit:self.spirit,
      spiritMax:self.spiritMax,
      breath:self.breath,
      breathMax:self.breathMax,
      action:self.action,
      ghost:self.ghost
    };
  }

  self.getUpdatePack = function(){
    return {
      id:self.id,
      house:self.house,
      kingdom:self.kingdom,
      x:self.x,
      y:self.y,
      z:self.z,
      class:self.class,
      rank:self.rank,
      friends:self.friends,
      enemies:self.enemies,
      gear:self.gear,
      inventory:{
        arrows:self.inventory.arrows
      },
      spriteSize:self.spriteSize,
      innaWoods:self.innaWoods,
      facing:self.facing,
      stealthed:self.stealthed,
      revealed:self.revealed,
      pressingUp:self.pressingUp,
      pressingDown:self.pressingDown,
      pressingLeft:self.pressingLeft,
      pressingRight:self.pressingRight,
      pressingAttack:self.pressingAttack,
      angle:self.mouseAngle,
      working:self.working,
      chopping:self.chopping,
      mining:self.mining,
      farming:self.farming,
      building:self.building,
      fishing:self.fishing,
      hp:self.hp,
      hpMax:self.hpMax,
      spirit:self.spirit,
      spiritMax:self.spiritMax,
      breath:self.breath,
      breathMax:self.breathMax,
      action:self.action,
      ghost:self.ghost
    }
  }

  // !!! ALPHA HAX !!!

  self.hasHorse = true;
  self.knighted = true;
  // !!! ALPHA HAX !!!

  Player.list[self.id] = self;

  initPack.player.push(self.getInitPack());
  return self;
}

Player.list = {};

Player.onConnect = function(socket,name){
  socket.write(JSON.stringify({
    msg:'tempus',
    tempus:tempus,
    nightfall:nightfall
  }))
  var spawn = randomSpawnO();
  var player = Player({
    name:name,
    id:socket.id,
    z: 0,
    x: spawn[0],
    y: spawn[1],
    home:{z:0,
      x:spawn[0],
      y:spawn[1]}
  });
  console.log(player.name + ' spawned at : ' + spawn + ' z: 0');

  socket.on('data',function(string){
    var data = JSON.parse(string);
    if(data.msg == 'keyPress'){
      if(data.inputId == 'left'){
        player.pressingLeft = data.state;
      } else if(data.inputId == 'right'){
        player.pressingRight = data.state;
      } else if(data.inputId == 'up'){
        player.pressingUp = data.state;
      } else if(data.inputId == 'down'){
        player.pressingDown = data.state;
      } else if(data.inputId == 'attack'){
        player.pressingAttack = data.state;
      } else if(data.inputId == 'e'){
        player.pressingE = data.state;
      } else if(data.inputId == 't'){
        player.pressingT = data.state;
      } else if(data.inputId == 'i'){
        player.pressingI = data.state;
      } else if(data.inputId == 'p'){
        player.pressingP = data.state;
      } else if(data.inputId == 'f'){
        player.pressingF = data.state;
      } else if(data.inputId == 'h'){
        player.pressingH = data.state;
      } else if(data.inputId == 'k'){
        player.pressingK = data.state;
      } else if(data.inputId == 'l'){
        player.pressingL = data.state;
      } else if(data.inputId == 'x'){
        player.pressingX = data.state;
      } else if(data.inputId == 'c'){
        player.pressingC = data.state;
      } else if(data.inputId == 'b'){
        player.pressingB = data.state;
      } else if(data.inputId == 'n'){
        player.pressingN = data.state;
      } else if(data.inputId == 'm'){
        player.pressingM = data.state;
      } else if(data.inputId == '1'){
        player.pressing1 = data.state;
      } else if(data.inputId == '2'){
        player.pressing2 = data.state;
      } else if(data.inputId == '3'){
        player.pressing3 = data.state;
      } else if(data.inputId == '4'){
        player.pressing4 = data.state;
      } else if(data.inputId == '5'){
        player.pressing5 = data.state;
      } else if(data.inputId == '6'){
        player.pressing6 = data.state;
      } else if(data.inputId == '7'){
        player.pressing7 = data.state;
      } else if(data.inputId == '8'){
        player.pressing8 = data.state;
      } else if(data.inputId == '9'){
        player.pressing9 = data.state;
      } else if(data.inputId == '0'){
        player.pressing0 = data.state;
      } else if(data.inputId == 'mouseAngle'){
        player.mouseAngle = data.state;
      }
    } else if(data.msg == 'msgToServer'){
      emit({msg:'addToChat',message:'<b>' + data.name + ':</b> ' + data.message});
    } else if(data.msg == 'pmToServer'){
      var recipient = null;
      for(var i in Player.list){
        if(Player.list[i].name == data.recip){
          recipient = SOCKET_LIST[i];
        }
      }
      if(recipient == null){
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>' + data.recip + ' is not online.</i>'}));
      } else {
        recipient.write(JSON.stringify({msg:'addToChat',message:'<b>@' + player.name + '</b> whispers: <i>' + data.message + '</i>'}));
        SOCKET_LIST[player.id].write(JSON.stringify({msg:'addToChat',message:'To ' + data.recip + ': <i>' + data.message + '</i>'}));
      }
    }
  });

  socket.write(JSON.stringify({
    msg:'newFaction',
    houseList:House.list,
    kingdomList:Kingdom.list
  }));

  socket.write(JSON.stringify({
    msg:'init',
    selfId:player.id,
    pack:{
      player:Player.getAllInitPack(),
      arrow:Arrow.getAllInitPack(),
      item:Item.getAllInitPack(),
      light:Light.getAllInitPack(),
      building:Building.getAllInitPack()
    }
  }));
  console.log('init player id: ' + player.id);
};

Player.getAllInitPack = function(){
  var players = [];
  for(var i in Player.list)
    players.push(Player.list[i].getInitPack());
  return players;
}

Player.onDisconnect = function(socket){
  delete Player.list[socket.id];
  removePack.player.push(socket.id);
}

Player.update = function(){
  var pack = [];
  for(var i in Player.list){
    var player = Player.list[i];
    player.update();
    if(player.toRemove){
      delete Player.list[i];
      delete zones[player.zone[1]][player.zone[0]][player.id];
      removePack.player.push(player.id);
    } else {
      pack.push(player.getUpdatePack());
    }
  }
  return pack;
};

var sockjs = require('sockjs');
io = sockjs.createServer();
io.installHandlers(serv, {prefix:'/io'});
emit = function(data){
  for(i in SOCKET_LIST){
    SOCKET_LIST[i].write(JSON.stringify(data));
  }
}
io.on('connection', function(socket){
  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;
  console.log('Socket connected: ' + socket.id);

  socket.on('data',function(string){
    var data = JSON.parse(string);
    if(data.msg == 'signIn'){
      isValidPassword(data,function(res){
        if(res){
          Player.onConnect(socket, data.name);
          socket.write(JSON.stringify({
            msg:'signInResponse',
            success:true,
            world: world,
            tileSize: tileSize,
            mapSize: mapSize,
            tempus: tempus
          }));
          console.log(data.name + ' logged in.');
        } else {
          socket.write(JSON.stringify({msg:'signInResponse',success:false}));
        }
      })
    } else if(data.msg == 'signUp'){
      if(data.name.length > 0){
        isUsernameTaken(data.name,function(res){
          if(res){
            socket.write(JSON.stringify({
              msg:'signUpResponse',
              success:false}));
          } else {
            addUser(data,function(){
              socket.write(JSON.stringify({
                msg:'signUpResponse',
                success:true
              }));
              console.log(data.name + ' signed up.');
            });
          }
        })
      } else {
        socket.write(JSON.stringify({msg:'signUpResponse',success:false}));
      }
    } else if(data.msg == 'evalCmd'){
      EvalCmd(data);
    }
  });
  socket.onclose = function(){
    Player.onDisconnect(socket);
  }
});

// GAME STATE

// day/night cycle
var dayNight = function(){
  tempus = cycle[tick];
  if(tempus == 'XII.a'){
    day++;
    dailyTally();
    entropy();
    console.log('');
    console.log('Day ' + day);
    console.log('');

    var count = 0;
    for(var i in Player.list){
      count++;
    }
    console.log('Population: ' + count);
    if(saveMap){
      fs.writeFile("./maps/map" + day + ".txt", JSON.stringify(world), function(err){
        if(err){
          return console.log(err);
        }
        console.log("Map file saved to '/mapfiles' folder.");
      });
    };
  }
  if(tempus == 'VIII.p' || tempus == 'IX.p' ||
  tempus == 'X.p' || tempus == 'XI.p' || tempus == 'XII.a' ||
  tempus == 'I.a' || tempus == 'II.a' || tempus == 'III.a' ||
  tempus == 'IV.a'){
    nightfall = true;
  } else {
    nightfall = false;
  }
  emit({
    msg:'tempus',
    tempus:tempus,
    nightfall:nightfall
  })
  console.log(tempus);

  House.update;
  Kingdom.update;

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

initPack = {player:[],arrow:[],item:[],light:[],building:[]};
removePack = {player:[],arrow:[],item:[],light:[],building:[]};

setInterval(function(){
  var pack = {
    player:Player.update(),
    arrow:Arrow.update(),
    item:Item.update(),
    light:Light.update(),
    building:Building.update(),
  }


  emit({msg:'init',pack:initPack});
  emit({msg:'update',pack:pack});
  emit({msg:'remove',pack:removePack});

  initPack.player = [];
  initPack.arrow = [];
  initPack.item = [];
  initPack.light = [];
  initPack.building = [];
  removePack.player = [];
  removePack.arrow = [];
  removePack.item = [];
  removePack.light = [];
  removePack.building = [];

},40);

// spawn fauna
entropy();

// hide relics
var rel1 = randomSpawnHF();
var cr1 = getLoc(rel1[0],rel1[1]);
Relic({
  x:rel1[0],
  y:rel1[1],
  z:0,
  qty:1
});
console.log('Relic hidden in the forest @ ' + cr1.toString());
var rel2 = randomSpawnU();
var cr2 = getLoc(rel2[0],rel2[1]);
Relic({
  x:rel2[0],
  y:rel2[1],
  z:-1,
  qty:1
});
console.log('Relic hidden in the caves @ ' + cr2.toString());
var wsp = waterSpawns[Math.floor(Math.random() * waterSpawns.length)];
var rel3 = getCoords(wsp[0],wsp[1]);
Relic({
  x:rel3[0],
  y:rel3[1],
  z:-3,
  qty:1
});
console.log('Relic hidden in the sea @ ' + wsp.toString());

// create NPC factions
Brotherhood({
  id:1,
  type:'npc',
  name:'Brotherhood',
  flag:'',
  hq:factionSpawn(1),
  hostile:true
});

Goths({
  id:2,
  type:'npc',
  name:'Goths',
  flag:'',
  hq:factionSpawn(2),
  hostile:true
});

Norsemen({
  id:3,
  type:'npc',
  name:'Norsemen',
  flag:'',
  hq:factionSpawn(3),
  hostile:true
});

Franks({
  id:4,
  type:'npc',
  name:'Franks',
  flag:'',
  hq:factionSpawn(4),
  hostile:true
});

Celts({
  id:5,
  type:'npc',
  name:'Celts',
  flag:'',
  hq:factionSpawn(5),
  hostile:true
});

Teutons({
  id:6,
  type:'npc',
  name:'Teutons',
  flag:'',
  hq:factionSpawn(6),
  hostile:true
});

Outlaws({
  id:7,
  type:'npc',
  name:'Outlaws',
  flag:'☠️',
  hq:factionSpawn(7),
  hostile:true
});

Mercenaries({
  id:8,
  type:'npc',
  name:'Mercenaries',
  flag:'',
  hq:factionSpawn(8),
  hostile:true
});

Kingdom({
  id:1,
  name:'Papal States',
  flag:'🇻🇦'
});

dailyTally();
