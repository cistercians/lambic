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
    self.falconry = param.falconry;
    self.hp = null; // Invulnerable - falcons cannot be damaged
    self.baseSpd = 1;
    self.maxSpd = 1;
    self.spriteSize = tileSize*7;
    self.update = function(){
      if(!self.path){
        if(!self.falconry){
          // Safely get a new random destination, fallback to current position if spawn points unavailable
          try {
            self.path = randomSpawnO();
          } catch (err) {
            console.error('Falcon failed to get random spawn, staying in place:', err);
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
            } catch (err) {
              console.error('Falcon failed to get random spawn, staying in place:', err);
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

