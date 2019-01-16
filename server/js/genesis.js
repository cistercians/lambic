var SimplexNoise = require('simplex-noise');
var Canvas = require('canvas');
var fs = require('fs');

function genesis(){
  // smaller tiles for bigger map
  // should be a factor of canvas width/height (default: 256)
  var tile = 2;

  var simplex = new SimplexNoise(),
      canvas = Canvas.createCanvas(256,256),
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
    var tileMap = [];
    var i = 0;

    for(var x = 0; x < width; x += tileWidth){
      var set = [];
      for(var y = 0; y < height; y += tileHeight){
        // 0: water, 1: heavy forest, 2: forest, 3: brush, 4: rocks, 5: mountain
        if (source[i][0] > 0.48){
          set.push(0);
          i++;
        } else {
          if (source[i][1] > 0.97){
            set.push(5);
            i++;
          } else if (source[i][1] > 0.86){
            set.push(4);
            i++;
          } else if (source[i][0] <= 0.26){
            set.push(3);
            i++;
          } else if (source[i][0] < 0.31){
            set.push(2);
            i++;
          } else {
            set.push(1);
            i++;
          }
        }
      }
      tileMap.push(set);
    }
    return tileMap;
  };

  // generate noise
  for (var x = 0; x < 256; x++) {
    for (var y = 0; y < 256; y++) {
      var r = simplex.noise2D(x / 160, y / 120) * 1.25 + 0.25;
      var g = simplex.noise2D(x / 32, y / 32) * 0.5 + 0.25;
      var b = simplex.noise2D(x / 16, y / 16) * 0.15;
      data[(x + y * 256) * 4 + 0] = r * 125;
      data[(x + y * 256) * 4 + 1] = (r + g + b) * 160;
      data[(x + y * 256) * 4 + 2] = 70;
      data[(x + y * 256) * 4 + 3] = 255;
    }
  };

  // draw image and apply tile effect
  ctx.putImageData(imgdata, 0, 0);
  mosaic(ctx, canvas.width, canvas.height, tile, tile);

  // contains (h,v) data
  var hvData = getHv(ctx, canvas.width, canvas.height, tile, tile);

  // "a whole new world!"
  var overworldMap = terraform(hvData, canvas.width, canvas.height, tile, tile);

  return overworldMap;
};


module.exports = {
  map: genesis()
}
