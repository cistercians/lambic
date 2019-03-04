entropy = function(){
  // add res to inTrees and update
  var toHF = [];
  var toF = [];
  var toB = [];
  for(var c = 0; c < mapSize; c++){
    for(var r = 0; r < mapSize; r++){
      if(world[0][r][c] === 1){
        if(world[6][r][c] < 300){
          world[6][r][c] += 5;
        }
      } else if(world[0][r][c] === 2){
        world[6][r][c] += 5;
        if(world[6][r][c] > 100){
          toHF.push([c,r]);
        }
      } else if(world[0][r][c] === 3 && c > 0 && c < mapSize-1 && r > 0 && r < mapSize-1){
        var check = [getTile(0,c,r-1),getTile(6,c,r-1),getTile(0,c,r+1),getTile(6,c,r+1),getTile(0,c-1,r),getTile(6,c-1,r),getTile(0,c+1,r),getTile(6,c+1,r)];
        if(((check[0] === 1 || check[0] === 2) && check[1] > 49) ||
        ((check[2] === 1 || check[2] === 2) && check[3] > 49) ||
        ((check[4] === 1 || check[4] === 2) && check[5] > 49) ||
        ((check[6] === 1 || check[6] === 2) && check[7] > 49)){
          toF.push([c,r]);
        }
      } else if(world[0][r][c] === 7 && c > 0 && c < mapSize-1 && r > 0 && r < mapSize-1){
        var check = [getTile(0,c,r-1),getTile(0,c,r+1),getTile(0,c-1,r),getTile(0,c+1,r)];
        if((check[0] === 1 || check[0] === 2 || check[0] === 3) ||
        (check[1] === 1 || check[1] === 2 || check[1] === 3) ||
        (check[2] === 1 || check[2] === 2 || check[2] === 3) ||
        (check[3] === 1 || check[3] === 2 || check[3] === 3)){
          toB.push([c,r]);
        }
      }
    }
  }
  console.log('added res');

  for(i in toHF){
    world[0][toHF[i][1]][toHF[i][0]] = 1;
  }
  for(i in toF){
    if(Math.random() < 0.3){
      world[0][toF[i][1]][toF[i][0]] = 2;
      world[6][toF[i][1]][toF[i][0]] = 50;
    }
  }
  for(i in toB){
    if(Math.random() < 0.3){
      world[0][toB[i][1]][toB[i][0]] = 3;
    }
  }
  io.emit('mapEdit',world);
  console.log('finished');
};
