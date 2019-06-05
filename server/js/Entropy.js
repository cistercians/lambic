entropy = function(){
  // FLORA
  // add res to trees and update
  var toHF = [];
  var toF = [];
  var toB = [];
  for(var c = 0; c < mapSize; c++){
    for(var r = 0; r < mapSize; r++){
      if(world[0][r][c] === 0){
        if(Math.random() < 0.25){
          world[6][r][c] = Math.ceil(Math.random() * 10);
        } else {
          world[6][r][c] = 0;
        }
      } else if(world[0][r][c] >= 1 && world[0][r][c] < 2 && day > 0){
        if(world[6][r][c] < 300){
          world[6][r][c] += Math.floor(Math.random() * 6);
        }
      } else if(world[0][r][c] >= 2 && world[0][r][c] < 3 && day > 0){
        world[6][r][c] += Math.floor(Math.random() * 6);
        if(world[6][r][c] > 100){
          toHF.push([c,r]);
        }
      } else if(world[0][r][c] >= 3 && world[0][r][c] < 4 && c > 0 && c < mapSize && r > 0 && r < mapSize && day > 0){
        var check = [getTile(0,c,r-1),getTile(6,c,r-1),getTile(0,c,r+1),getTile(6,c,r+1),getTile(0,c-1,r),getTile(6,c-1,r),getTile(0,c+1,r),getTile(6,c+1,r)];
        if((check[0] >= 1 && check[0] < 3 && check[1] > 49) ||
        (check[2] >= 1 || check[2] < 3 && check[3] > 49) ||
        (check[4] >= 1 || check[4] < 3 && check[5] > 49) ||
        (check[6] >= 1 || check[6] < 3 && check[7] > 49)){
          toF.push([c,r]);
        }
      } else if(world[0][r][c] === 7 && c > 0 && c < mapSize && r > 0 && r < mapSize && day > 0){
        var check = [getTile(0,c,r-1),getTile(0,c,r+1),getTile(0,c-1,r),getTile(0,c+1,r)];
        if((check[0] >= 1 && check[0] < 4) ||
        (check[1] >= 1 && check[1] < 4) ||
        (check[2] >= 1 && check[2] < 4) ||
        (check[3] >= 1 && check[3] < 4)){
          toB.push([c,r]);
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
    if(Math.random() < 0.3){
      world[0][toF[i][1]][toF[i][0]] -= 1;
      world[6][toF[i][1]][toF[i][0]] = 50;
      //biomes.forest++;
    }
  }
  for(i in toB){
    if(Math.random() < 0.1){
      world[0][toB[i][1]][toB[i][0]] = 3 + Number((Math.random()*0.9).toFixed(2));
      //biomes.brush++;
    }
  }

  // FAUNA
  var deerRatio = Math.floor(biomes.hForest/200);
  var boarRatio = Math.floor(biomes.hForest/800);
  var wolfRatio = Math.floor(biomes.hForest/400);

  var deerPop = 0;
  var boarPop = 0;
  var wolfPop = 0;

  for(i in Player.list){
    var cl = Player.list[i].class;
    if(cl === 'deer'){
      deerPop++;
    } else if(cl === 'boar'){
      boarPop++;
    } else if(cl === 'wolf'){
      wolfPop++;
    }
  }
  if(deerPop < deerRatio){
    var num = 0;
    if(day === 0){
      num = Math.floor(deerRatio * 0.75);
    } else {
      num = Math.floor((deerRatio - deerPop)/4);
    }
    for(var i = 0; i < num; i++){
      var sp = randomSpawnHF();
      Deer({
        x:sp[0],
        y:sp[1],
        z:0
      });
    }
  }
  if(boarPop < boarRatio){
    var num = 0;
    if(day === 0){
      num = Math.floor(boarRatio * 0.75);
    } else {
      num = Math.floor((boarRatio - boarPop)/4);
    }
    for(var i = 0; i < num; i++){
      var sp = randomSpawnHF();
      Boar({
        x:sp[0],
        y:sp[1],
        z:0
      });
    }
  }
  if(wolfPop < wolfRatio){
    var num = 0;
    if(day === 0){
      num = Math.floor(wolfRatio * 0.75);
    } else {
      num = Math.floor((wolfRatio - wolfPop)/4);
    }
    for(var i = 0; i < num; i++){
      var sp = randomSpawnHF();
      Wolf({
        x:sp[0],
        y:sp[1],
        z:0
      });
    }
  }
  io.emit('mapEdit',world);
};
