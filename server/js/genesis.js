var SimplexNoise = require('simplex-noise');
var Canvas = require('canvas');
var fs = require('fs');

// create n-dimensional array
function createArray(length) {
  var arr = new Array(length || 0),
      i = length;

  if (arguments.length > 1) {
      var args = Array.prototype.slice.call(arguments, 1);
      while(i--) arr[length-1 - i] = createArray.apply(this, args);
  }

  return arr;
};

function genesis(){
  // map dimensions
  // smaller tiles for bigger map
  // should be a factor of canvas width/height
  var tile = 2;
  var canvasSize = 512;
  var mapTiles = canvasSize / tile;



  // OVERWORLD
  var simplex = new SimplexNoise(),
      canvas = Canvas.createCanvas(canvasSize,canvasSize),
      ctx = canvas.getContext('2d'),
      imgdata = ctx.getImageData(0, 0, canvas.width, canvas.height),
      data = imgdata.data;

  // rgb to hsv conversion
  function rgbToHsv(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, v = max;

    var d = max - min;
    s = max == 0 ? 0 : d / max;

    if (max == min) {
      h = 0; // achromatic
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [Number((h).toFixed(3)),Number((v).toFixed(3))];
  };

  // apply tiles to noise
  function mosaic(ctx, width, height, tileWidth, tileHeight) {
    for(var x = 0; x < width; x += tileWidth) {
      for(var y = 0; y < height; y += tileHeight) {
        var rgba = ctx.getImageData(x, y, 1, 1).data;
        // note: rgba is Uint8ClampedArray
        ctx.fillStyle = "rgba(" + [rgba[0], rgba[1], rgba[2], rgba[3]].join(',') + ")";
        ctx.fillRect(x, y, tileWidth, tileHeight);
      }
    }
  };

  // converts mosaic to hsv values
  function getHv(ctx, width, height, tileWidth, tileHeight) {
    var hv = [];
    for(var x = 0; x < width; x += tileWidth) {
      for(var y = 0; y < height; y += tileHeight) {
        var rgba = ctx.getImageData(x, y, 1, 1).data;
        var conv = rgbToHsv(rgba[0], rgba[1], rgba[2]);
        hv.push([conv[0], conv[1]]);
      }
    }
    return hv;
  };

  // converts (h,v) data to game tilemap format
  function terraform(source, width, height, tileWidth, tileHeight){
    var allTileMaps = [];
    var overworldTiles = [];
    var underwaterTiles = [];
    var i = 0;

    for(var x = 0; x < width; x += tileWidth){
      var oSet = [];
      var uSet = [];
      for(var y = 0; y < height; y += tileHeight){
        // 0: water, 1: heavy forest, 2: forest, 3: brush, 4: rocks, 5: mountain
        if (source[i][0] > 0.48){
          oSet.push(0);
          uSet.push(1);
          i++;
        } else {
          if (source[i][1] > 0.97){
            oSet.push(5);
            uSet.push(0);
            i++;
          } else if (source[i][1] > 0.86){
            oSet.push(4);
            uSet.push(0);
            i++;
          } else if (source[i][0] <= 0.26){
            oSet.push(3);
            uSet.push(0);
            i++;
          } else if (source[i][0] < 0.31){
            oSet.push(2);
            uSet.push(0);
            i++;
          } else {
            oSet.push(1);
            uSet.push(0);
            i++;
          }
        }
      }
      overworldTiles.push(oSet);
      underwaterTiles.push(uSet);
    }
    var underworldTiles = createArray(mapTiles,mapTiles);
    var buildTiles = createArray(mapTiles,mapTiles);

    for(x = 0; x < mapTiles; x++){
      for(y = 0; y < mapTiles; y++){
        underworldTiles[x][y] = 0;
        buildTiles[x][y] = 0;
      }
    };

    allTileMaps.push(overworldTiles);
    allTileMaps.push(underworldTiles);
    allTileMaps.push(underwaterTiles);
    allTileMaps.push(buildTiles);

    return allTileMaps;
  };

  // UNDERWORLD
  //identifies potential cave entrances
  function idEntrances(){
    var subsection = Math.floor(mapTiles / 3);
    var trueLength = subsection * 3
    var result = [];
    for(x = 0; x < trueLength; x += subsection){
      for(y = 0; y < trueLength; y += subsection){
        var selection = [];
        for(c = x; c < x + subsection; c++){
          for(r = y; r < y + subsection; r++){
            var tile = worldMaps[0][c][r];
            var tileBelow = worldMaps[0][c][r+1];
            if(tile === 5 && tileBelow !== 5 && r !== 0){
              selection.push([c,r]);
            } else {
              continue;
            }
          }
        }
        result.push(selection[Math.floor(Math.random() * selection.length)]);
      }
    }
    //randomly select 2/3 of them
    var entrances = [];
    for(i = 0; i < Math.ceil(result.length * 0.66); i++){
      var n = Math.floor(Math.random() * result.length);
      entrances.push(result[n]);
      result.splice(n,n);
    }
    for(i = 0; i < entrances.length; i++){
      worldMaps[0][entrances[i][0]][entrances[i][1]] = 6;
    }
    return entrances;
  };

  function geoform(map,c,r) {
    let dimensions = 100, // width and height of the map // current best: // 5500:12
        maxTunnels = 200, // max number of tunnels possible ===
        maxLength = 12, // max length each tunnel can have ===
        currentRow = c, // our current row - start at a random spot
        currentColumn = r, // our current column - start at a random spot
        directions = [[-1, 0], [1, 0], [0, -1], [0, 1]], // array to get a random direction from (left,right,up,down)
        lastDirection = [], // save the last direction we went
        randomDirection; // next turn/direction - holds a value from directions

    map[currentRow][currentColumn] = 0;
    currentRow++;

    while (maxTunnels && dimensions && maxLength) {
      do {
        randomDirection = directions[Math.floor(Math.random() * directions.length)];
      } while ((randomDirection[0] === -lastDirection[0] && randomDirection[1] === -lastDirection[1]) || (randomDirection[0] === lastDirection[0] && randomDirection[1] === lastDirection[1]));

      var randomLength = Math.ceil(Math.random() * maxLength), // length the next tunnel will be (max of maxLength)
          tunnelLength = 0; // current length of tunnel being created

  		// lets loop until our tunnel is long enough or until we hit an edge
      while (tunnelLength < randomLength) {

          //break the loop if it is going out of the map
        if (((currentRow === 0) && (randomDirection[0] === -1)) ||
            ((currentColumn === 0) && (randomDirection[1] === -1)) ||
            ((currentRow === map.length - 1) && (randomDirection[0] === 1)) ||
            ((currentColumn === map.length - 1) && (randomDirection[1] === 1))) {
          break;
        } else {
          map[currentRow][currentColumn] = 0; //set the value of the index in map to 0 (a tunnel, making it one longer)
          currentRow += randomDirection[0]; //add the value from randomDirection to row and col (-1, 0, or 1) to update our location
          currentColumn += randomDirection[1];
          tunnelLength++; //the tunnel is now one longer, so lets increment that variable
        }
      }

      if (tunnelLength) { // update our variables unless our last loop broke before we made any part of a tunnel
        lastDirection = randomDirection; //set lastDirection, so we can remember what way we went
        maxTunnels--; // we created a whole tunnel so lets decrement how many we have left to create
      }
    }
  };

  // generate noise
  for (var x = 0; x < canvasSize; x++) {
    for (var y = 0; y < canvasSize; y++) {
      var r = simplex.noise2D(x / 160, y / 120) * 1.25 + 0.25;
      var g = simplex.noise2D(x / 32, y / 32) * 0.5 + 0.25;
      var b = simplex.noise2D(x / 16, y / 16) * 0.15;
      data[(x + y * canvasSize) * 4 + 0] = r * 125;
      data[(x + y * canvasSize) * 4 + 1] = (r + g + b) * 160;
      data[(x + y * canvasSize) * 4 + 2] = 70;
      data[(x + y * canvasSize) * 4 + 3] = 255;
    }
  };

  // draw image and apply tile effect
  ctx.putImageData(imgdata, 0, 0);
  mosaic(ctx, canvas.width, canvas.height, tile, tile);

  // contains (h,v) data
  var hvData = getHv(ctx, canvas.width, canvas.height, tile, tile);

  // generate map set
  // [0]: Overworld, [1]: Underworld, [2]: Underwater, [3]: Build I, [4]: Build II
  var worldMaps = terraform(hvData, canvas.width, canvas.height, tile, tile);

  // edit underworld
  var caveEntrances = idEntrances();
  console.log(caveEntrances);

  // random walk caves
  for(i = 0; i < caveEntrances.length; i++){
    geoform(worldMaps[1],caveEntrances[i][0],caveEntrances[i][1]);
  };

  // "...And God saw that it was good."
  return worldMaps;
};


module.exports = {
  map: genesis()
}
