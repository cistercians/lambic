/**
 * ArrowEntity - Client-side Arrow entity constructor
 * 
 * Extracted from client.js for better organization.
 */

function ArrowEntity(initPack) {
  // Ensure Arrow.list exists (preserve from early initialization)
  if (!Arrow.list) Arrow.list = {};
  var self = {};
  self.id = initPack.id;
  self.angle = initPack.angle;
  self.number = initPack.number;
  self.x = initPack.x;
  self.y = initPack.y;
  self.z = initPack.z;
  self.innaWoods = initPack.innaWoods;

  // Arrow rendering extracted to ArrowRenderer.js
  // Use ArrowRenderer.render() instead
  self.draw = function() {
    if (typeof ArrowRenderer !== 'undefined' && ArrowRenderer.render) {
      return ArrowRenderer.render(self, {
        ctx: ctx,
        Img: Img,
        getCameraPosition: getCameraPosition,
        WIDTH: WIDTH,
        HEIGHT: HEIGHT,
        tileSize: tileSize
      });
    }
    // Legacy fallback
    var cameraPos = getCameraPosition();
    
    function drawArrow(angle) {
      var x = self.x - cameraPos.x + WIDTH / 2;
      var y = self.y - cameraPos.y + HEIGHT / 2;

      if (angle >= -120 && angle < -60) {
        ctx.drawImage(Img.arrow1, x, y, tileSize, tileSize);
      } else if (angle >= -60 && angle < -30) {
        ctx.drawImage(Img.arrow2, x, y, tileSize, tileSize);
      } else if (angle >= -30 && angle < 30) {
        ctx.drawImage(Img.arrow3, x, y, tileSize, tileSize);
      } else if (angle >= 30 && angle < 60) {
        ctx.drawImage(Img.arrow4, x, y, tileSize, tileSize);
      } else if (angle >= 60 && angle < 120) {
        ctx.drawImage(Img.arrow5, x, y, tileSize, tileSize);
      } else if (angle >= 120 && angle < 150) {
        ctx.drawImage(Img.arrow6, x, y, tileSize, tileSize);
      } else if (angle >= 150 && angle > -150) {
        ctx.drawImage(Img.arrow7, x, y, tileSize, tileSize);
      } else {
        ctx.drawImage(Img.arrow8, x, y, tileSize, tileSize);
      }
    }
    drawArrow(self.angle);
  }

  Arrow.list[self.id] = self;
  return self;
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.ArrowEntity = ArrowEntity;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArrowEntity;
}

