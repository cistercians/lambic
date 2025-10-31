var SimplexNoise = require('simplex-noise');
var Canvas = require('canvas');
var fs = require('fs');

/*
============================================================================
INTERACTIVE NOISE PARAMETER EXPERIMENTATION GUIDE
============================================================================

This file generates procedural maps using Simplex Noise. All key parameters
are now extracted into clearly named variables for easy experimentation.

QUICK EXPERIMENTS TO TRY:

1. MORE DRAMATIC COASTLINES:
   - Lower redFrequencyX/Y (e.g., 100, 80) for larger landmasses
   - Higher redFrequencyX/Y (e.g., 200, 150) for more islands/fractured coasts
   - Adjust redAmplitude (1.0-1.5) for more/less contrast

2. VARIED BIOME SIZES:
   - Lower greenFrequencyX/Y (e.g., 20, 20) for larger biome regions
   - Higher greenFrequencyX/Y (e.g., 50, 50) for more mixed terrain
   - Adjust greenAmplitude (0.3-0.7) for biome contrast

3. TERRAIN DISTRIBUTION:
   - Lower waterThreshold (e.g., 0.4) for more water
   - Lower mountainThreshold (e.g., 0.9) for more mountains
   - Adjust brushThreshold (0.2-0.3) for arid regions

4. FINE DETAILS:
   - Lower blueFrequencyX/Y (e.g., 10, 10) for smoother terrain
   - Higher blueFrequencyX/Y (e.g., 25, 25) for more detailed/noisy terrain

PARAMETER RANGES:
- Frequencies: 10-300 (lower = larger features)
- Amplitudes: 0.1-2.0 (higher = more contrast)
- Offsets: 0.0-0.5 (shifts baseline)
- Thresholds: 0.1-0.9 (lower = more of that terrain)

============================================================================
*/

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

function genesis(){
  // map dimensions
  // smaller tiles for bigger map
  // should be a factor of canvas width/height
  var tile = 1;
  var canvasSize = 192; // Map size (192×192 = 36,864 tiles)
  var mapTiles = canvasSize / tile;

  // ============================================================================
  // NOISE PARAMETERS - EXPERIMENT WITH THESE VALUES FOR DIFFERENT MAP STYLES
  // ============================================================================
  
  // RED CHANNEL: Controls large-scale features (continents/oceans/water boundaries)
  // Lower frequency = larger landmasses, Higher frequency = more islands/fractured coastlines
  var redFrequencyX = 90; // Horizontal scale for large features
  var redFrequencyY = 78; // Vertical scale for large features  
  var redAmplitude = 0.7; // Controls contrast between land/water
  var redOffset = 0.33;    // Baseline shift
  
  // GREEN CHANNEL: Controls medium-scale features (biomes/terrain patches)
  // Lower frequency = larger biome regions, Higher frequency = more varied/mixed terrain
  var greenFrequencyX = 16; // Horizontal scale for biome features
  var greenFrequencyY = 22; // Vertical scale for biome features
  var greenAmplitude = 0.74; // Controls biome contrast
  var greenOffset = 0.42;   // Baseline shift for biome distribution
  
  // BLUE CHANNEL: Controls fine details and local variation
  // Lower frequency = smoother terrain, Higher frequency = more detailed/noisy terrain
  var blueFrequencyX = 6;   // Horizontal scale for fine details
  var blueFrequencyY = 6;   // Vertical scale for fine details
  var blueAmplitude = 0.35; // Controls detail intensity
  var blueOffset = 0.15;      // No baseline shift for details

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

  // ============================================================================
  // TERRAIN CLASSIFICATION THRESHOLDS - EXPERIMENT WITH THESE FOR DIFFERENT TERRAIN DISTRIBUTIONS
  // ============================================================================
  
  // These thresholds convert HSV values from noise into terrain types
  // Lower thresholds = more of that terrain type, Higher thresholds = less of that terrain type
  
  var waterThreshold = 0.39;    // Hue threshold for water (higher = more land)
  var mountainThreshold = 0.99;  // Value threshold for mountains (0.99 = very high elevation)
  var rocksThreshold = 0.85;     // Value threshold for rocks (0.85 = high elevation)
  var brushThreshold = 0.3;     // Hue threshold for brush (0.3 = dry/arid regions)
  var lightForestThreshold = 0.32; // Hue threshold for light forest (0.32 = transition zone)

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
        // WATER: Hue > waterThreshold (creates oceans/lakes)
        if (source[i][0] > waterThreshold){
          oSet.push(0);
          uSet.push(1);
          i++;
        } else {
          // MOUNTAIN: Value > mountainThreshold (highest elevation)
          if (source[i][1] > mountainThreshold){
            oSet.push(5 + Number((Math.random()*0.9).toFixed(2)));
            uSet.push(0);
            i++;
          // ROCKS: Value > rocksThreshold (high elevation, rocky terrain)
          } else if (source[i][1] > rocksThreshold){
            oSet.push(4 + Number((Math.random()*0.9).toFixed(2)));
            uSet.push(0);
            i++;
          // BRUSH: Hue <= brushThreshold (dry/arid regions)
          } else if (source[i][0] <= brushThreshold){
            oSet.push(3 + Number((Math.random()*0.9).toFixed(2)));
            uSet.push(0);
            i++;
          // LIGHT FOREST: Hue < lightForestThreshold (transitional forest)
          } else if (source[i][0] < lightForestThreshold){
            oSet.push(2 + Number((Math.random()*0.9).toFixed(2)));
            uSet.push(0);
            i++;
          // HEAVY FOREST: Default terrain (dense forest)
          } else {
            oSet.push(1 + Number((Math.random()*0.9).toFixed(2)));
            uSet.push(0);
            i++;
          }
        }
      }
      overworldTiles.push(oSet);
      underwaterTiles.push(uSet);
    }
    var underworldTiles = createArray(mapTiles,mapTiles);
    var buildI = createArray(mapTiles,mapTiles);
    var buildII = createArray(mapTiles,mapTiles);
    var buildIII = createArray(mapTiles,mapTiles);
    var resI = createArray(mapTiles,mapTiles);
    var resII = createArray(mapTiles,mapTiles);
    var buildIV = createArray(mapTiles,mapTiles);

    for(x = 0; x < mapTiles; x++){
      for(y = 0; y < mapTiles; y++){
        underworldTiles[y][x] = 1;
        buildI[y][x] = 0;
        buildII[y][x] = 0;
        buildIII[y][x] = 0;
        resI[y][x] = 0;
        resII[y][x] = 0;
        buildIV[y][x] = 0;
      }
    };

    allTileMaps.push(overworldTiles); // 0
    allTileMaps.push(underworldTiles); // 1
    allTileMaps.push(underwaterTiles); // 2
    allTileMaps.push(buildI); // 3
    allTileMaps.push(buildII); // 4
    allTileMaps.push(buildIII); // 5
    allTileMaps.push(resI); // 6
    allTileMaps.push(resII); // 7
    allTileMaps.push(buildIV); // 8

    return allTileMaps;
  };

  // UNDERWORLD
  //identifies potential cave entrances
  var entrances = [];

  function idEntrances(){
    var subsection = Math.floor(mapTiles / 4);
    for(x = 0; x < mapTiles; x += subsection){
      for(y = 0; y < mapTiles; y += subsection){
        var select = [];
        for(c = x; c < x + subsection; c++){
          for(r = y; r < y + subsection; r++){
            if(r < mapTiles-1){
              var tile = worldMaps[0][r][c];
              var tileBelow = worldMaps[0][r+1][c];
              if(tile >= 5 && tile < 6 && tileBelow < 5 && r != mapTiles-1){
                select.push([c,r]);
              } else {
                continue;
              }
            }
          }
        }
        if(select.length > 0){
          if(Math.random() > 0.25){
            entrances.push(select[Math.floor(Math.random() * select.length)]);
          }
          select = [];
        }
      }
    }
  };

  function geoform(map,c,r) {
    // Highly chaotic cave generation - maximum randomness and chaos
    let maxTunnels = 250, // Many more tunnels for maximum chaos
        maxLength = 12, // Shorter max length for more twists and turns
        minLength = 1, // Allow single-tile tunnels for maximum chaos
        roomChance = 0.18, // 18% chance to create a room
        roomSize = 3, // Size of rooms (3x3 to 5x5)
        continueDirectionChance = 0.35, // 35% chance to continue same direction (low persistence = more chaos)
        branchChance = 0.45, // 45% chance to create a branch (very frequent branching)
        randomWalkChance = 0.35, // 35% chance for completely random direction (high chaos)
        currentRow = c, // our current row - start at a random spot
        currentColumn = r, // our current column - start at a random spot
        directions = [[-1, 0],[1, 0],[0, -1],[0, 1]], // array to get a random direction from (left,right,up,down)
        lastDirection = [], // save the last direction we went
        randomDirection; // next turn/direction - holds a value from directions

    // Initialize starting point (one tile south of entrance)
    map[currentRow][currentColumn] = 0;
    currentColumn--;

    // Helper function to create a room
    function createRoom(map, row, col, size) {
      var roomSize = Math.floor(Math.random() * (size - 1)) + size; // Random size between size and size+2
      var startRow = Math.max(1, row - Math.floor(roomSize / 2));
      var startCol = Math.max(1, col - Math.floor(roomSize / 2));
      var endRow = Math.min(map.length - 2, row + Math.floor(roomSize / 2));
      var endCol = Math.min(map[0].length - 2, col + Math.floor(roomSize / 2));
      
      for(var r = startRow; r <= endRow; r++) {
        for(var c = startCol; c <= endCol; c++) {
          map[r][c] = 0; // Clear room tiles
        }
      }
    }

    while (maxTunnels > 0) {
      // Decide: continue tunnel or create room?
      if (lastDirection.length > 0 && Math.random() < roomChance) {
        // Create a room
        createRoom(map, currentRow, currentColumn, roomSize);
        maxTunnels--;
        // After room, continue in same direction
        continue;
      }

      // Choose direction with mix of organization and chaos
      if (lastDirection.length > 0 && Math.random() < randomWalkChance) {
        // 20% chance for pure random walk (complete chaos)
        randomDirection = directions[Math.floor(Math.random() * directions.length)];
      } else if (lastDirection.length > 0 && Math.random() < continueDirectionChance) {
        // 45% chance to continue in same direction (maintains some structure)
        randomDirection = lastDirection;
      } else {
        // 35% chance to change direction, but avoid going backwards
        do {
          randomDirection = directions[Math.floor(Math.random() * directions.length)];
        } while (lastDirection.length > 0 && 
                 randomDirection[0] == -lastDirection[0] && 
                 randomDirection[1] == -lastDirection[1]);
      }

      // Create tunnel with random length (longer on average)
      var randomLength = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
      var tunnelLength = 0;

      while (tunnelLength < randomLength) {
        // Check bounds
        if (((currentRow <= 1) && (randomDirection[0] == -1)) ||
            ((currentColumn <= 1) && (randomDirection[1] == -1)) ||
            ((currentRow >= map.length - 2) && (randomDirection[0] == 1)) ||
            ((currentColumn >= map[0].length - 2) && (randomDirection[1] == 1))) {
          break;
        } else {
          // Clear the tile
          map[currentRow][currentColumn] = 0;
          
          // Very frequently create side branches for maximum chaotic exploration
          if (tunnelLength > 0 && Math.random() < branchChance && maxTunnels > 5) {
            var branchDirection = directions[Math.floor(Math.random() * directions.length)];
            // Make sure branch doesn't go backwards or same direction
            if (!(branchDirection[0] == -randomDirection[0] && branchDirection[1] == -randomDirection[1]) &&
                !(branchDirection[0] == randomDirection[0] && branchDirection[1] == randomDirection[1])) {
              var branchRow = currentRow;
              var branchCol = currentColumn;
              // Variable branch lengths for maximum chaos
              var branchLength = Math.floor(Math.random() * 10) + 1; // 1-10 tile branches
              
              for(var b = 0; b < branchLength; b++) {
                if (((branchRow <= 1) && (branchDirection[0] == -1)) ||
                    ((branchCol <= 1) && (branchDirection[1] == -1)) ||
                    ((branchRow >= map.length - 2) && (branchDirection[0] == 1)) ||
                    ((branchCol >= map[0].length - 2) && (branchDirection[1] == 1))) {
                  break;
                }
                map[branchRow][branchCol] = 0;
                
                // Branches frequently branch again for maximum chaos
                if (b > 0 && Math.random() < 0.25 && maxTunnels > 3) {
                  var subBranchDir = directions[Math.floor(Math.random() * directions.length)];
                  if (!(subBranchDir[0] == -branchDirection[0] && subBranchDir[1] == -branchDirection[1])) {
                    var subRow = branchRow;
                    var subCol = branchCol;
                    var subLength = Math.floor(Math.random() * 6) + 1; // 1-6 tile sub-branches
                    for(var sb = 0; sb < subLength; sb++) {
                      if (((subRow <= 1) && (subBranchDir[0] == -1)) ||
                          ((subCol <= 1) && (subBranchDir[1] == -1)) ||
                          ((subRow >= map.length - 2) && (subBranchDir[0] == 1)) ||
                          ((subCol >= map[0].length - 2) && (subBranchDir[1] == 1))) {
                        break;
                      }
                      map[subRow][subCol] = 0;
                      
                      // Even sub-branches can branch (extreme chaos!)
                      if (sb > 0 && Math.random() < 0.12 && maxTunnels > 2) {
                        var subSubDir = directions[Math.floor(Math.random() * directions.length)];
                        if (!(subSubDir[0] == -subBranchDir[0] && subSubDir[1] == -subBranchDir[1])) {
                          var subSubRow = subRow;
                          var subSubCol = subCol;
                          var subSubLength = Math.floor(Math.random() * 4) + 1;
                          for(var ssb = 0; ssb < subSubLength; ssb++) {
                            if (((subSubRow <= 1) && (subSubDir[0] == -1)) ||
                                ((subSubCol <= 1) && (subSubDir[1] == -1)) ||
                                ((subSubRow >= map.length - 2) && (subSubDir[0] == 1)) ||
                                ((subSubCol >= map[0].length - 2) && (subSubDir[1] == 1))) {
                              break;
                            }
                            map[subSubRow][subSubCol] = 0;
                            subSubRow += subSubDir[0];
                            subSubCol += subSubDir[1];
                          }
                          maxTunnels--;
                        }
                      }
                      
                      subRow += subBranchDir[0];
                      subCol += subBranchDir[1];
                    }
                    maxTunnels--;
                  }
                }
                
                branchRow += branchDirection[0];
                branchCol += branchDirection[1];
              }
              maxTunnels--; // Branch counts as a tunnel
            }
          }
          
          // Move forward
          currentRow += randomDirection[0];
          currentColumn += randomDirection[1];
          tunnelLength++;
        }
      }

      if (tunnelLength > 0) {
        lastDirection = randomDirection;
        maxTunnels--;
      } else {
        // If we can't move in chosen direction, try a different one
        var attempts = 0;
        while (attempts < 4) {
          randomDirection = directions[Math.floor(Math.random() * directions.length)];
          if (!((currentRow <= 1 && randomDirection[0] == -1) ||
                (currentColumn <= 1 && randomDirection[1] == -1) ||
                (currentRow >= map.length - 2 && randomDirection[0] == 1) ||
                (currentColumn >= map[0].length - 2 && randomDirection[1] == 1))) {
            lastDirection = randomDirection;
            break;
          }
          attempts++;
        }
        // If we're stuck, stop generating from this entrance
        if (attempts >= 4) {
          break;
        }
      }
    }
  };

  // generate noise using extracted parameters
  for (var x = 0; x < canvasSize; x++) {
    for (var y = 0; y < canvasSize; y++) {
      var r = simplex.noise2D(x / redFrequencyX, y / redFrequencyY) * redAmplitude + redOffset;
      var g = simplex.noise2D(x / greenFrequencyX, y / greenFrequencyY) * greenAmplitude + greenOffset;
      var b = simplex.noise2D(x / blueFrequencyX, y / blueFrequencyY) * blueAmplitude + blueOffset;
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
  // [0]: Overworld, [1]: Underworld, [2]: Underwater, [3]: Build I, [4]: Build II ,[5]: Resources I, [6]: Resources II
  var worldMaps = terraform(hvData, canvas.width, canvas.height, tile, tile);

  // edit underworld
  idEntrances();

  // random walk caves
  for(i = 0; i < entrances.length; i++){
    if(entrances[i]){
      geoform(worldMaps[1],entrances[i][1],entrances[i][0]);
    }
  };

  // add entrance/exit tiles
  for(i = 0; i < entrances.length; i++){
    worldMaps[0][entrances[i][1]][entrances[i][0]] = 6;
    worldMaps[1][entrances[i][1]+1][entrances[i][0]] = 2;
  }

  // add resources to Overworld
  for(x = 0; x < mapTiles; x++){
    for(y = 0; y < mapTiles; y++){
      if((worldMaps[0][y][x] >= 2 && worldMaps[0][y][x] < 3) || (worldMaps[0][y][x] >= 4 && worldMaps[0][y][x] < 5)){
        worldMaps[6][y][x] = 50;
      } else if((worldMaps[0][y][x] >= 1 && worldMaps[0][y][x] < 2) || (worldMaps[0][y][x] >= 5 && worldMaps[0][y][x] < 6)){
        worldMaps[6][y][x] = 100;
      } else {
        continue;
      }
    }
  }

  // add resources to Underworld (doubled ore generation)
  for(x = 1; x < (mapTiles - 1); x++){
    for(y = 1; y < (mapTiles - 1); y++){
      roll = Math.random();
      // Doubled from 0.1 to 0.2 - now 20% chance instead of 10%
      if(worldMaps[1][y][x] == 1 && roll < 0.2 && (worldMaps[1][y+1][x] == 0 || worldMaps[1][y-1][x] == 0 || worldMaps[1][y][x+1] == 0 || worldMaps[1][y][x-1] == 0)){
        worldMaps[1][y][x] = 3 + Number((Math.random()*0.9).toFixed(2));
        worldMaps[7][y][x] = 150;
      } else {
        continue;
      }
    }
  }

  // "...And God saw that it was good."
  return {
    worldMaps: worldMaps,
    entrances: entrances
  };
};

const genesisResult = genesis();

module.exports = {
  map: genesisResult.worldMaps,
  entrances: genesisResult.entrances
}
