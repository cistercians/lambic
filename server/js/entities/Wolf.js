/**
 * Wolf Entity
 * Predatory animal - more aggressive at night
 */

module.exports = function(Character, globals) {
  const { zones, getTile, getLoc, getCenter, isWalkable, mapSize } = globals;
  // Note: Player.list is accessed as a global at runtime
  
  const Wolf = function(param){
    var self = Character(param);
    self.class = 'Wolf';
    self.baseSpd = 3;
    self.runSpd = 5; // Default wolf run speed (day), updated dynamically based on day/night
    self.damage = 10;
    self.wanderRange = 4096; // Increased 4x from 1024 (64 tiles)
    self.aggroRange = 256; // Set initial aggro range
    self.nightmode = true;
    self.stealthCheck = function(p){
      if(p.stealthed){
        var dist = self.getDistance({x:p.x,y:p.y});
        if(dist <= 256){
          Player.list[p.id].revealed = true;
        }
      }
    }
    self.checkAggro = function(){
      // Use SimpleCombat for wolf aggro
      if(global.simpleCombat){
        global.simpleCombat.checkAggro(self);
      } else {
        // Fallback to old wolf aggro logic
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
              if(pDist <= self.aggroRange){ // in aggro range
                if(p.class != 'Wolf'){
                  self.stealthCheck(p);
                  if(!Player.list[p.id].stealthed || Player.list[p.id].revealed){ // is not stealthed or is revealed
                    self.combat.target = p.id;
                    if(self.hp < (self.hpMax * 0.1)){
                      self.action = 'flee';
                    } else {
                      self.action = 'combat';
                    }
                    if(p.type == 'npc' && pDist <= p.aggroRange && p.action != 'combat'){
                      Player.list[p.id].combat.target = self.id;
                      Player.list[p.id].action = 'combat';
                      }
                    }
                  }
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

    self.update = function(){
      // Update speed based on current state and terrain
      self.updateSpeed();
      
      var loc = getLoc(self.x,self.y);
      self.zoneCheck();
      if(nightfall){
        self.nightmode = true;
        self.aggroRange = 320; // Slightly more aggressive at night
        self.idleRange = 300;
        self.runSpd = 6; // Faster at night
      } else {
        self.nightmode = false;
        self.aggroRange = 256; // Standard range during day
        self.idleRange = 1000;
        self.runSpd = 5; // Slower during day
      }
      if(self.idleTime > 0){
        self.idleTime--;
      }
      if(self.z == 0){
        if(getTile(0,loc[0],loc[1]) >= 1 && getTile(0,loc[1],loc[1]) < 2){
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
          // Don't modify maxSpd when fleeing (SimpleFlee manages speed)
          if(self.action !== 'flee'){
            self.maxSpd = (self.baseSpd * 0.2) * self.drag;
          }
          setTimeout(function(){
            // Check CURRENT location, not stale loc from 2 seconds ago
            var currentLoc = getLoc(self.x, self.y);
            if(getTile(0,currentLoc[0],currentLoc[1]) >= 5 && getTile(0,currentLoc[0],currentLoc[1]) < 6){
              self.onMtn = true;
            }
          },2000);
        } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && self.onMtn){
          // Don't modify maxSpd when fleeing (SimpleFlee manages speed)
          if(self.action !== 'flee'){
            self.maxSpd = self.baseSpd * self.drag;
          }
        } else if(getTile(0,loc[0],loc[1]) == 6){
          // Wolves should not enter caves - ignore cave entrances
          self.innaWoods = false;
          self.onMtn = false;
        } else if(getTile(0,loc[0],loc[1]) == 18){
          self.innaWoods = false;
          self.onMtn = false;
          // Don't modify maxSpd when fleeing (SimpleFlee manages speed)
          if(self.action !== 'flee'){
            self.maxSpd = self.baseSpd * self.drag;
          }
        } else if(getTile(0,loc[0],loc[1]) == 0){
          // Wolves should not enter water - stay on overworld
          // Note: Pathfinding should already avoid water, but this is a safety check
          self.innaWoods = false;
          self.onMtn = false;
          // Slow down on water edge but don't change z-level
          if(self.action !== 'flee'){
            self.maxSpd = (self.baseSpd * 0.5) * self.drag;
          }
        } else {
          self.innaWoods = false;
          self.onMtn = false;
          // Don't modify maxSpd when fleeing (SimpleFlee manages speed)
          if(self.action !== 'flee'){
            self.maxSpd = self.baseSpd * self.drag;
          }
        }
      } else if(self.z == -1){
        if(getTile(1,loc[0],loc[1]) == 2){
          // On cave exit tile - only exit if path is complete (no active navigation)
          // This universal rule works for all entities without special cases
          if(!self.path || self.path.length === 0){
          self.caveEntrance = null;
          self.z = 0;
            self.path = null;
            self.pathCount = 0;
          self.innaWoods = false;
          self.onMtn = false;
          self.maxSpd = (self.baseSpd * 0.9)  * self.drag;
          }
        }
      }

      if(!self.action){
        self.baseSpd = 3;
        if(!self.nightmode && self.z == 0){
          var t = getTile(0,loc[0],loc[1]);
          if(t >= 2 && !self.path){
            self.return();
          } else {
            if(self.idleTime == 0){
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
          }
        } else {
          if(self.idleTime == 0){
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
        }
      } else if(self.action == 'combat'){
        // Use SimpleCombat for wolf combat
        if(global.simpleCombat){
          global.simpleCombat.update(self);
        } else {
          // Fallback to old wolf combat logic - use runSpd
          if(self.nightmode){
            self.baseSpd = 7; // Night speed
          } else {
            self.baseSpd = 6; // Day speed
          }
        var target = Player.list[self.combat.target];
        if(target){
          if(target.hasTorch || getTile(target.z == 1)){
            self.combat.target = null;
            self.action = null;
            if(target.combat.target == self.id){
              Player.list[target.id].combat.target = null;
              Player.list[target.id].action = null;
            }
          } else {
            // Check leash range - don't chase too far from home
            var homeCoords = getCenter(self.home.loc[0], self.home.loc[1]);
            var homeDist = self.getDistance({x: homeCoords[0], y: homeCoords[1]});
            var leashRange = self.wanderRange || 2048; // Default 32 tiles (4x increase)
            
            if(homeDist > leashRange){
              // Too far from home - disengage and return
              self.combat.target = null;
              self.action = 'returning'; // Set returning state to prevent re-aggro
              self.baseSpd = 3;
              if(target.combat.target == self.id){
                Player.list[target.id].combat.target = null;
                Player.list[target.id].action = null;
              }
              self.return(); // Go back home
          } else {
            self.follow(target,true);
            var tDist = self.getDistance({
              x:target.x,
              y:target.y
            });
            if(tDist > self.aggroRange * 1.5){
              self.combat.target = null;
              self.action = null;
              self.baseSpd = 3;
              if(target.combat.target == self.id){
                Player.list[target.id].combat.target = null;
                Player.list[target.id].action = null;
                }
              }
            }
          }
        } else {
          self.combat.target = null;
          self.action = null;
          }
        }
      } else if(self.action == 'flee'){
        // Use SimpleFlee system for reliable fleeing
        if(global.simpleFlee){
          global.simpleFlee.update(self);
        } else {
          // Fallback to old reposition logic
          if(!self.path){
            if(self.combat.target){
              var target = Player.list[self.combat.target];
              if(target){
                self.baseSpd = 6;
                var tLoc = getLoc(target.x,target.y);
                self.reposition(loc,tLoc);
              } else {
                self.combat.target = null;
                self.action = null;
              }
            } else {
              self.action = null;
            }
          }
        }
      } else if(self.action == 'returning'){
        // Returning home after leashing - check if we're back within leash range
        if(self.home && self.home.loc){
          var homeCoords = getCenter(self.home.loc[0], self.home.loc[1]);
          var homeDist = self.getDistance({x: homeCoords[0], y: homeCoords[1]});
          var leashRange = self.wanderRange || 2048;
          
          if(homeDist <= leashRange * 0.5){
            // Back within safe range - resume normal behavior
            self.action = null;
            self.path = null;
            self.pathCount = 0;
          } else if(!self.path){
            // No path and still far - move home
            self.return();
          }
        } else {
          self.action = null;
        }
      }
      self.updatePosition();
    }
    return self;
  }
  
  return Wolf;
};

