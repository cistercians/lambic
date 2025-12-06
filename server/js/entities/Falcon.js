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
    
    // Initialize path and facing direction immediately during construction
    // This ensures the init pack sent to clients has the correct facing from the start
    if(!self.falconry) {
      try {
        self.path = randomSpawnO();
        if(self.path && self.path[0] !== undefined && self.path[1] !== undefined) {
          self.setFacingTowardTarget(self.path[0], self.path[1]);
        } else {
          // Path was set but invalid, pick random facing
          var directions = ['up', 'down', 'left', 'right'];
          self.facing = directions[Math.floor(Math.random() * 4)];
        }
      } catch (err) {
        // Spawn points may not be available yet during initialization
        self.path = null;
        // Set random facing so falcon doesn't always start facing down
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
          // Safely get a new random destination, fallback to current position if spawn points unavailable
          try {
            self.path = randomSpawnO();
            if(self.path && self.path[0] !== undefined && self.path[1] !== undefined) {
              self.setFacingTowardTarget(self.path[0], self.path[1]);
            }
          } catch (err) {
            // Stay at current location if spawn points are unavailable
            self.path = [self.x, self.y];
          }
        }
      } else {
        var dx = self.path[0];
        var dy = self.path[1];
        var diffX = dx - self.x;
        var diffY = dy - self.y;

        if(diffX >= self.maxSpd && diffY >= self.maxSpd){
          self.x += self.maxSpd * (1);
          self.y += self.maxSpd * (1);
          if(diffX > diffY){
            self.pressingRight = true;
            self.pressingLeft = false;
            self.pressingDown = false;
            self.pressingUp = false;
            self.facing = 'right';
          } else {
            self.pressingRight = false;
            self.pressingLeft = false;
            self.pressingDown = true;
            self.pressingUp = false;
            self.facing = 'down';
          }
        } else if(diffX >= self.maxSpd && diffY <= (0-self.maxSpd)){
          self.x += self.maxSpd * (1);
          self.y -= self.maxSpd * (1);
          if(diffX > diffY*(-1)){
            self.pressingRight = true;
            self.pressingLeft = false;
            self.pressingDown = false;
            self.pressingUp = false;
            self.facing = 'right';
          } else {
            self.pressingRight = false;
            self.pressingLeft = false;
            self.pressingDown = false;
            self.pressingUp = true;
            self.facing = 'up';
          }
        } else if(diffX <= (0-self.maxSpd) && diffY >= self.maxSpd){
          self.x -= self.maxSpd * (1);
          self.y += self.maxSpd * (1);
          if(diffX*(-1) > diffY){
            self.pressingRight = false;
            self.pressingLeft = true;
            self.pressingDown = false;
            self.pressingUp = false;
            self.facing = 'left';
          } else {
            self.pressingRight = false;
            self.pressingLeft = false;
            self.pressingDown = true;
            self.pressingUp = false;
            self.facing = 'down';
          }
        } else if(diffX <= (0-self.maxSpd) && diffY <= (0-self.maxSpd)){
          self.x -= self.maxSpd * (1);
          self.y -= self.maxSpd * (1);
          if(diffX < diffY){
            self.pressingRight = false;
            self.pressingLeft = true;
            self.pressingDown = false;
            self.pressingUp = false;
            self.facing = 'left';
          } else {
            self.pressingRight = false;
            self.pressingLeft = false;
            self.pressingDown = false;
            self.pressingUp = true;
            self.facing = 'up';
          }
        } else if(diffX >= self.maxSpd){
          self.x += self.maxSpd * (1);
          self.pressingRight = true;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
          self.facing = 'right';
        } else if(diffX <= (0-self.maxSpd)){
          self.x -= self.maxSpd * (1);
          self.pressingRight = false;
          self.pressingLeft = true;
          self.pressingDown = false;
          self.pressingUp = false;
          self.facing = 'left';
        } else if(diffY >= self.maxSpd){
          self.y += self.maxSpd * (1);
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = true;
          self.pressingUp = false;
          self.facing = 'down';
        } else if(diffY <= (0-self.maxSpd)){
          self.y -= self.maxSpd * (1);
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = true;
          self.facing = 'up';
        } else {
          if(!self.falconry){
            // Reached destination, get a new one
            try {
              self.path = randomSpawnO();
              if(self.path && self.path[0] !== undefined && self.path[1] !== undefined) {
                self.setFacingTowardTarget(self.path[0], self.path[1]);
              }
            } catch (err) {
              // Stay at current location if spawn points are unavailable
              self.path = [self.x, self.y];
            }
          }
        }
      }
    }
    return self;
  }
  
  return Falcon;
};
