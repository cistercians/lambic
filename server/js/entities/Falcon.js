/**
 * Falcon Entity
 * Flying bird - invulnerable, wanders the map
 */

module.exports = function(Character, globals) {
  const { tileSize, randomSpawnO } = globals;
  
  const Falcon = function(param){
    var self = Character(param);
    self.class = 'Falcon';
    self.type = 'fauna'; // Not 'npc' - falcons are passive fauna with no combat
    self.mode = null; // Falcons don't use standard NPC modes - prevents idle wander
    self.falconry = param.falconry;
    self.hp = null; // Invulnerable - falcons cannot be damaged
    self.baseSpd = 1;
    self.maxSpd = 1;
    self.spriteSize = tileSize*7;
    
    // Helper to set facing direction toward a target point
    // Called immediately when a new path is assigned so facing is correct from the first frame
    self.setFacingTowardTarget = function(targetX, targetY) {
      var diffX = targetX - self.x;
      var diffY = targetY - self.y;
      var absDiffX = Math.abs(diffX);
      var absDiffY = Math.abs(diffY);
      
      // Determine dominant direction based on which axis has greater displacement
      if(absDiffX >= absDiffY) {
        // Horizontal movement is dominant
        self.facing = diffX >= 0 ? 'right' : 'left';
      } else {
        // Vertical movement is dominant
        self.facing = diffY >= 0 ? 'down' : 'up';
      }
    };
    
    // Helper function to get a valid destination that's far enough from current position
    // Ensures falcons never get stuck by always returning a destination that's different from current position
    self.getValidDestination = function(minDistance, maxAttempts) {
      minDistance = minDistance || 10; // Default minimum distance of 10 pixels
      maxAttempts = maxAttempts || 5; // Default max 5 attempts
      
      for (var attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          var destination = randomSpawnO();
          if (destination && 
              destination[0] !== undefined && 
              destination[1] !== undefined) {
            // Check minimum distance
            var dx = destination[0] - self.x;
            var dy = destination[1] - self.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist >= minDistance) {
              return destination;
            }
          }
        } catch (err) {
          // Continue to next attempt or fallback
        }
      }
      
      // Fallback: generate random destination away from current position
      // This ensures falcons never get stuck even if randomSpawnO() fails
      var angle = Math.random() * Math.PI * 2;
      var distance = minDistance + Math.random() * 100; // 10-110 pixels away
      return [
        self.x + Math.cos(angle) * distance,
        self.y + Math.sin(angle) * distance
      ];
    };
    
    // Initialize path and facing direction immediately during construction
    // This ensures the init pack sent to clients has the correct facing from the start
    if(!self.falconry) {
      // Use getValidDestination to ensure we always get a valid path that's different from current position
      self.path = self.getValidDestination();
      if(self.path && self.path[0] !== undefined && self.path[1] !== undefined) {
        self.setFacingTowardTarget(self.path[0], self.path[1]);
      } else {
        // Path was set but invalid, pick random facing
        var directions = ['up', 'down', 'left', 'right'];
        self.facing = directions[Math.floor(Math.random() * 4)];
      }
      
      // Update the init pack with correct facing
      // Character constructor already pushed to initPack with default 'down' facing
      if(global.initPack && global.initPack.player && global.initPack.player.length > 0) {
        var lastPack = global.initPack.player[global.initPack.player.length - 1];
        if(lastPack && lastPack.id === self.id) {
          lastPack.facing = self.facing;
        }
      }
    }
    
    self.update = function(){
      if(!self.path){
        if(!self.falconry){
          // Get a new valid destination that's guaranteed to be different from current position
          self.path = self.getValidDestination();
          if(self.path && self.path[0] !== undefined && self.path[1] !== undefined) {
            self.setFacingTowardTarget(self.path[0], self.path[1]);
          }
        }
      } else {
        var targetX = self.path[0];
        var targetY = self.path[1];
        var diffX = targetX - self.x;
        var diffY = targetY - self.y;
        var absDiffX = Math.abs(diffX);
        var absDiffY = Math.abs(diffY);
        
        // Check if we've reached the destination (within 1 pixel threshold)
        if(absDiffX < 1 && absDiffY < 1){
          // Reached destination, get a new one
          if(!self.falconry){
            // Get a new valid destination that's guaranteed to be different from current position
            self.path = self.getValidDestination();
            if(self.path && self.path[0] !== undefined && self.path[1] !== undefined) {
              self.setFacingTowardTarget(self.path[0], self.path[1]);
            }
          } else {
            // Falconry falcon - clear path when reached
            self.path = null;
          }
        } else {
          // Calculate distance to target
          var distance = Math.sqrt(diffX * diffX + diffY * diffY);
          
          // Normalize direction and move toward target
          var moveX = 0;
          var moveY = 0;
          
          if(distance > 0){
            // Normalize direction vector
            var dirX = diffX / distance;
            var dirY = diffY / distance;
            
            // Move at maxSpd toward target (but don't overshoot)
            var moveDistance = Math.min(self.maxSpd, distance);
            moveX = dirX * moveDistance;
            moveY = dirY * moveDistance;
          }
          
          // Update position
          self.x += moveX;
          self.y += moveY;
          
          // Update facing direction based on dominant movement axis
          if(absDiffX >= absDiffY){
            // Horizontal movement is dominant
            self.facing = diffX >= 0 ? 'right' : 'left';
            self.pressingRight = diffX > 0;
            self.pressingLeft = diffX < 0;
            self.pressingDown = false;
            self.pressingUp = false;
          } else {
            // Vertical movement is dominant
            self.facing = diffY >= 0 ? 'down' : 'up';
            self.pressingRight = false;
            self.pressingLeft = false;
            self.pressingDown = diffY > 0;
            self.pressingUp = diffY < 0;
          }
        }
      }
    }
    return self;
  }
  
  return Falcon;
};
