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
  self.inBattleground = initPack.inBattleground;
  self.battlegroundMatchId = initPack.battlegroundMatchId || null;
  
  // Client-side interpolation for smooth movement
  self.renderX = initPack.x; // Interpolated position for rendering
  self.renderY = initPack.y;
  self.prevX = initPack.x; // Previous position
  self.prevY = initPack.y;
  self.targetX = initPack.x; // Target position from server
  self.targetY = initPack.y;
  self.lastUpdateTime = Date.now(); // Timestamp of last position update
  self.updateInterval = 40; // Expected update interval in ms (~25 FPS from server)

  // Update interpolated position for smooth rendering
  self.updateInterpolation = function() {
    var now = Date.now();
    var timeSinceUpdate = now - self.lastUpdateTime;
    
    // If we haven't received an update in a while, snap to target
    if (timeSinceUpdate > self.updateInterval * 3) {
      self.renderX = self.targetX;
      self.renderY = self.targetY;
      self.prevX = self.targetX;
      self.prevY = self.targetY;
      return;
    }
    
    // Calculate interpolation factor (0 = at prev position, 1 = at target position)
    var t = Math.min(1, timeSinceUpdate / self.updateInterval);
    
    // Linear interpolation between previous and target position
    self.renderX = self.prevX + (self.targetX - self.prevX) * t;
    self.renderY = self.prevY + (self.targetY - self.prevY) * t;
  };
  
  // Arrow rendering extracted to ArrowRenderer.js
  // Use ArrowRenderer.render() instead
  self.draw = function() {
    // Update interpolation before rendering
    self.updateInterpolation();
    
    // Create a temporary object with interpolated position for rendering
    var renderArrow = {
      id: self.id,
      angle: self.angle,
      x: self.renderX,
      y: self.renderY,
      z: self.z,
      innaWoods: self.innaWoods
    };
    
    if (typeof ArrowRenderer !== 'undefined' && ArrowRenderer.render) {
      return ArrowRenderer.render(renderArrow, {
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
      var x = renderArrow.x - cameraPos.x + WIDTH / 2;
      var y = renderArrow.y - cameraPos.y + HEIGHT / 2;
      // Arrows should be half the size of a tile
      const arrowSize = tileSize / 2;

      if (angle >= -120 && angle < -60) {
        ctx.drawImage(Img.arrow1, x, y, arrowSize, arrowSize);
      } else if (angle >= -60 && angle < -30) {
        ctx.drawImage(Img.arrow2, x, y, arrowSize, arrowSize);
      } else if (angle >= -30 && angle < 30) {
        ctx.drawImage(Img.arrow3, x, y, arrowSize, arrowSize);
      } else if (angle >= 30 && angle < 60) {
        ctx.drawImage(Img.arrow4, x, y, arrowSize, arrowSize);
      } else if (angle >= 60 && angle < 120) {
        ctx.drawImage(Img.arrow5, x, y, arrowSize, arrowSize);
      } else if (angle >= 120 && angle < 150) {
        ctx.drawImage(Img.arrow6, x, y, arrowSize, arrowSize);
      } else if (angle >= 150 && angle > -150) {
        ctx.drawImage(Img.arrow7, x, y, arrowSize, arrowSize);
      } else {
        ctx.drawImage(Img.arrow8, x, y, arrowSize, arrowSize);
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

