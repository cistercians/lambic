pathing = function(z){
  function createArray(length){
    var arr = new Array(length || 0),
        i = length;

    if(arguments.length > 1){
        var args = Array.prototype.slice.call(arguments, 1);
        while(i--) arr[length-1 - i] = createArray.apply(this, args);
    }
    return arr;
  };

  var grid = createArray(mapSize,mapSize);

  if(z === 0){
    for(x = 0; x < mapSize; x++){
      for(y = 0; y < mapSize; y++){
        if(world[0][y][x] === 0){
          grid[y][x] = 1;
        } else {
          grid[y][x] = 0;
        }
      }
    }
  } else if(z === -1){
    for(x = 0; x < mapSize; x++){
      for(y = 0; y < mapSize; y++){
        if(world[1][y][x] === 1){
          grid[y][x] = 1;
        } else {
          grid[y][x] = 0;
        }
      }
    }
  } else if(z === 3){
    for(x = 0; x < mapSize; x++){
      for(y = 0; y < mapSize; y++){
        if(world[0][y][x] === 0){
          grid[y][x] = 0;
        } else {
          grid[y][x] = 1;
        }
      }
    }
  } else if(z === -3){
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
}
