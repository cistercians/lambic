/**
 * Deer Entity
 * Prey animal - flees from threats, stays in forests
 */

module.exports = function(Character, globals) {
  const { Player, zones, getTile, getLoc, isWalkable, mapSize } = globals;
  
  const Deer = function(param){
    var self = Character(param);
    self.class = 'Deer';
    self.isPrey = true; // Prey animal
    self.isNonCombatant = true; // Doesn't trigger outposts
    self.aggroRange = 256;
    self.runSpd = 5; // Deer flee speed
    self.stealthCheck = function(p){
      if(p.stealthed){
        var dist = self.getDistance({x:p.x,y:p.y});
        if(dist <= 256){
          Player.list[p.id].revealed = true;
        }
      }
    }
    self.checkAggro = function(){
      for(var i in self.zGrid){
        var zc = self.zGrid[i][0];
        var zr = self.zGrid[i][1];
        if(zc < 64 && zc > -1 && zr < 64 && zr > -1){
          const zoneKey = `${zc},${zr}`;
          const zoneEntities = zones.get(zoneKey) || new Set();
          for(const entityId of zoneEntities){
            var p = Player.list[entityId];
            if(p && p.z == self.z){
              var pDist = self.getDistance({
                x:p.x,
                y:p.y
              });
              if(pDist <= self.aggroRange && p.class != 'Deer'){
                self.stealthCheck(p);
                if(!Player.list[p.id].stealthed || Player.list[p.id].revealed){ // is not stealthed or is revealed
                  self.combat.target = p.id;
                  self.action = 'flee';
                }
              }
            }
          }
        }
      }
    }

    // Store interval reference for cleanup
    self.aggroInterval = setInterval(function(){
      if(global.simpleCombat){
        global.simpleCombat.checkAggro(self);
      } else {
      self.checkAggro();
      }
    },100); // Check every 100ms for faster response

    // Find nearest heavy forest area
    self.findNearestForest = function(){
      var loc = getLoc(self.x, self.y);
      var bestForest = null;
      var bestDistance = Infinity;
      
      // Search in expanding radius for heavy forest (tile type 1)
      for(var radius = 1; radius <= 20; radius++){
        for(var dx = -radius; dx <= radius; dx++){
          for(var dy = -radius; dy <= radius; dy++){
            // Only check perimeter of current radius
            if(Math.abs(dx) !== radius && Math.abs(dy) !== radius && radius > 1) continue;
            
            var checkCol = loc[0] + dx;
            var checkRow = loc[1] + dy;
            
            // Bounds check
            if(checkCol < 0 || checkCol >= mapSize || checkRow < 0 || checkRow >= mapSize) continue;
            
            // Check if this tile is heavy forest
            if(getTile(0, checkCol, checkRow) >= 1 && getTile(0, checkCol, checkRow) < 2){
              var dist = Math.sqrt(dx*dx + dy*dy);
              if(dist < bestDistance){
                bestDistance = dist;
                bestForest = [checkCol, checkRow];
              }
            }
          }
        }
        
        // If we found a forest within reasonable distance, use it
        if(bestForest && bestDistance <= 10){
          break;
        }
      }
      
      return bestForest;
    };

    self.return = function(){
      if(!self.path){
        if(self.innaWoods){
          // Already in forest, just idle
          self.action = null;
        } else {
          // Find nearest forest instead of returning to home
          var forestLoc = self.findNearestForest();
          if(forestLoc){
            self.moveTo(self.z, forestLoc[0], forestLoc[1]);
          } else {
            // No forest found, just idle where we are
            self.action = null;
          }
        }
      }
    };

    self.update = function(){
      // Decrement pathfinding cooldown
      if(self.pathCooldown && self.pathCooldown > 0){
        self.pathCooldown--;
      }
      
      // Update speed based on current state and terrain
      self.updateSpeed();
      
      var loc = getLoc(self.x,self.y);
      self.zoneCheck();
      if(self.idleTime > 0){
        self.idleTime--;
      }

      // Terrain state tracking (speed is handled by updateSpeed())
      if(getTile(0,loc[0],loc[1]) >= 1 && getTile(0,loc[0],loc[1]) < 2){
        self.innaWoods = true;
        self.onMtn = false;
      } else if(getTile(0,loc[0],loc[1]) >= 2 && getTile(0,loc[0],loc[1]) < 4){
        self.innaWoods = false;
        self.onMtn = false;
      } else if(getTile(0,loc[0],loc[1]) >= 4 && getTile(0,loc[0],loc[1]) < 5){
        self.innaWoods = false;
        self.onMtn = false;
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && !self.onMtn){
        self.innaWoods = false;
        setTimeout(function(){
          if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6){
            self.onMtn = true;
          }
        },2000);
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && self.onMtn){
        // Mountain terrain - no speed change needed (handled by updateSpeed)
      } else if(getTile(0,loc[0],loc[1]) == 18){
        self.innaWoods = false;
        self.onMtn = false;
      } else if(getTile(0,loc[0],loc[1]) == 0){
        self.z = -3;
        self.innaWoods = false;
        self.onMtn = false;
      } else {
        self.innaWoods = false;
        self.onMtn = false;
      }

      if(self.mode == 'idle'){
        if(!self.action){
          // Speed is now managed by updateSpeed() - no manual speed changes needed
          if(!self.innaWoods){
            if(!self.path){
              self.return();
            }
          } else if(self.idleTime == 0){
            if(!self.path){
              var col = loc[0];
              var row = loc[1];
              var select = [[col,row-1],[col-1,row],[col,row+1],[col+1,row]];
              var target = select[Math.floor(Math.random() * 4)];
              if(target[0] < mapSize && target[0] > -1 && target[1] < mapSize && target[1] > -1){
                if(isWalkable(self.z,target[0],target[1])){
                  self.move(target);
                  self.idleTime += Math.floor(Math.random() * self.idleRange);
                }
              }
            }
          }
        } else if(self.action == 'combat'){
          self.action = 'flee';
        } else if(self.action == 'flee'){
          // Use SimpleFlee system for reliable fleeing
          if(global.simpleFlee){
            global.simpleFlee.update(self);
          } else {
            // Fallback: clear flee if no system available
            self.action = null;
            self.combat.target = null;
          }
        }
      }
      self.updatePosition();
    }
    return self;
  }
  
  return Deer;
};

