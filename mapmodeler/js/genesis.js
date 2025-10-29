// MapModeler Genesis - Browser-adapted noise generation
// Based on server/js/genesis.js but adapted for browser use

// Simplex Noise implementation for browser
// Using a simple implementation since we can't use node modules
class SimplexNoise {
  constructor(seed = Math.random) {
    this.p = [];
    this.perm = [];
    this.gradP = [];
    
    // Initialize permutation table
    for (let i = 0; i < 256; i++) {
      this.p[i] = Math.floor(seed() * 256);
    }
    
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.gradP[i] = this.grad3[this.perm[i] % 12];
    }
  }
  
  grad3 = [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
    [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
  ];
  
  dot2(g, x, y) {
    return g[0]*x + g[1]*y;
  }
  
  noise2D(xin, yin) {
    const F2 = 0.5*(Math.sqrt(3.0)-1.0);
    const G2 = (3.0-Math.sqrt(3.0))/6.0;
    
    const s = (xin+yin)*F2;
    const i = Math.floor(xin+s);
    const j = Math.floor(yin+s);
    
    const t = (i+j)*G2;
    const x0 = xin-(i-t);
    const y0 = yin-(j-t);
    
    let i1, j1;
    if(x0>y0) { i1=1; j1=0; }
    else { i1=0; j1=1; }
    
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;
    
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.perm[ii+this.perm[jj]] % 12;
    const gi1 = this.perm[ii+i1+this.perm[jj+j1]] % 12;
    const gi2 = this.perm[ii+1+this.perm[jj+1]] % 12;
    
    let t0 = 0.5 - x0*x0-y0*y0;
    if(t0<0) t0 = 0.0;
    t0 *= t0;
    const n0 = t0 * t0 * this.dot2(this.grad3[gi0], x0, y0);
    
    let t1 = 0.5 - x1*x1-y1*y1;
    if(t1<0) t1 = 0.0;
    t1 *= t1;
    const n1 = t1 * t1 * this.dot2(this.grad3[gi1], x1, y1);
    
    let t2 = 0.5 - x2*x2-y2*y2;
    if(t2<0) t2 = 0.0;
    t2 *= t2;
    const n2 = t2 * t2 * this.dot2(this.grad3[gi2], x2, y2);
    
    return 70.0 * (n0 + n1 + n2);
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
}

// Main genesis function adapted for browser
function generateMap(params = {}) {
  // Default parameters
  const defaults = {
    // Red Channel (Continents/Oceans)
    redFrequencyX: 90,
    redFrequencyY: 78,
    redAmplitude: 0.7,
    redOffset: 0.33,
    
    // Green Channel (Biomes/Terrain)
    greenFrequencyX: 16,
    greenFrequencyY: 22,
    greenAmplitude: 0.74,
    greenOffset: 0.42,
    
    // Blue Channel (Fine Details)
    blueFrequencyX: 6,
    blueFrequencyY: 6,
    blueAmplitude: 0.35,
    blueOffset: 0.15,
    
    // Terrain Thresholds
    waterThreshold: 0.39,
    mountainThreshold: 0.99,
    rocksThreshold: 0.85,
    brushThreshold: 0.3,
    lightForestThreshold: 0.32,
    
    // Map settings
    canvasSize: 192,
    tile: 1
  };
  
  // Merge with defaults
  const config = { ...defaults, ...params };
  
  // Map dimensions
  const canvasSize = config.canvasSize;
  const tile = config.tile;
  const mapTiles = canvasSize / tile;

  // Create simplex noise instance
  const simplex = new SimplexNoise(() => Math.random());
  
  // Create canvas for noise generation
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d');
  const imgdata = ctx.createImageData(canvas.width, canvas.height);
  const data = imgdata.data;

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
  }

  // apply tiles to noise
  function mosaic(ctx, width, height, tileWidth, tileHeight) {
    for(var x = 0; x < width; x += tileWidth) {
      for(var y = 0; y < height; y += tileHeight) {
        var rgba = ctx.getImageData(x, y, 1, 1).data;
        ctx.fillStyle = "rgba(" + [rgba[0], rgba[1], rgba[2], rgba[3]].join(',') + ")";
        ctx.fillRect(x, y, tileWidth, tileHeight);
      }
    }
  }

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
  }

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
        if (source[i][0] > config.waterThreshold){
          oSet.push(0);
          uSet.push(1);
          i++;
        } else {
          // MOUNTAIN: Value > mountainThreshold (highest elevation)
          if (source[i][1] > config.mountainThreshold){
            oSet.push(5 + Number((Math.random()*0.9).toFixed(2)));
            uSet.push(0);
            i++;
          // ROCKS: Value > rocksThreshold (high elevation, rocky terrain)
          } else if (source[i][1] > config.rocksThreshold){
            oSet.push(4 + Number((Math.random()*0.9).toFixed(2)));
            uSet.push(0);
            i++;
          // BRUSH: Hue <= brushThreshold (dry/arid regions)
          } else if (source[i][0] <= config.brushThreshold){
            oSet.push(3 + Number((Math.random()*0.9).toFixed(2)));
            uSet.push(0);
            i++;
          // LIGHT FOREST: Hue < lightForestThreshold (transitional forest)
          } else if (source[i][0] < config.lightForestThreshold){
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
    }

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
  }

  // generate noise using parameters
  for (var x = 0; x < canvasSize; x++) {
    for (var y = 0; y < canvasSize; y++) {
      var r = simplex.noise2D(x / config.redFrequencyX, y / config.redFrequencyY) * config.redAmplitude + config.redOffset;
      var g = simplex.noise2D(x / config.greenFrequencyX, y / config.greenFrequencyY) * config.greenAmplitude + config.greenOffset;
      var b = simplex.noise2D(x / config.blueFrequencyX, y / config.blueFrequencyY) * config.blueAmplitude + config.blueOffset;
      data[(x + y * canvasSize) * 4 + 0] = r * 125;
      data[(x + y * canvasSize) * 4 + 1] = (r + g + b) * 160;
      data[(x + y * canvasSize) * 4 + 2] = 70;
      data[(x + y * canvasSize) * 4 + 3] = 255;
    }
  }

  // draw image and apply tile effect
  ctx.putImageData(imgdata, 0, 0);
  mosaic(ctx, canvas.width, canvas.height, tile, tile);

  // contains (h,v) data
  var hvData = getHv(ctx, canvas.width, canvas.height, tile, tile);

  // generate map set
  var worldMaps = terraform(hvData, canvas.width, canvas.height, tile, tile);

  // Return the overworld tiles (layer 0) for rendering
  return {
    terrain: worldMaps[0], // Overworld tiles
    mapSize: mapTiles,
    config: config,
    generationTime: Date.now()
  };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateMap, SimplexNoise };
} else {
  window.MapModelerGenesis = { generateMap, SimplexNoise };
}

