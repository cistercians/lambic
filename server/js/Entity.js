// ENTITY
Entity = function(param){
  var self = {
    x:0,
    y:0,
    z:0,
    spdX:0,
    spdY:0,
    id:Math.random()
  }

  if(param){
    if(param.x)
      self.x = param.x;
    if(param.y)
      self.y = param.y;
    if(param.z)
      self.z = param.z;
    if(param.id)
      self.id = param.id;
  }

  self.update = function(){
    self.updatePosition();
  }

  self.updatePosition = function(){
    self.x += self.spdX;
    self.y += self.spdY;
  }

  self.getDistance = function(pt){
    return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2));
  }
  return self;
};

// BUILDING
Building = function(param){
  var self = Entity(param);
  self.owner = param.owner;
  self.house = param.house;
  self.kingdom = param.kingdom;
  self.type = param.type;
  self.plot = param.plot;
  self.walls = param.walls;
  self.topPlot = param.topPlot;
  self.mats = param.mats;
  self.req = param.req;
  self.hp = param.hp;

  Building.list[self.id] = self;
  buildingCount++;
  buildingId.push(self.id);

  io.emit('newBuilding',{
    bCount:buildingCount,
    bId:buildingId,
    bList:Building.list
  });

  return self;
}

buildingCount = 0;
buildingId = [];
Building.list = {}

// CHARACTER
Character = function(param){
  var self = Entity(param);
  self.gear = {
    head:null,
    body:null,
    weapon:null,
    offhand:null,
    trinket1:null,
    trinket2:null
  }
  self.inventory = {
    gold:0,
    keys:[],
    wood:0,
    stone:0,
    grain:0,
    torch:10
  }
  self.facing = 'down';
  self.inTrees = false;
  self.onMtn = false;
  self.working = false;
  self.baseSpd = 4;
  self.maxSpd = 4;
  self.actionCooldown = 0;
  self.attackCooldown = 0;
  self.hp = 100;
  self.hpMax = 100;
  self.mana = 100;
  self.manaMax = 100;
  self.strength = 10;
  self.dexterity = 1;

  return self;
}

// PLAYER
Player = function(param){
  var self = Character(param);
  self.username = param.username;
  self.home = null; // [1,x,y] must be inside building player owns
  self.house = null;
  self.kingdom = null;
  self.title = '';
  self.pressingRight = false;
  self.pressingLeft = false;
  self.pressingUp = false;
  self.pressingDown = false;
  self.pressingAttack = false;
  self.pressingT = false;
  self.pressingE = false;
  self.pressing1 = false;
  self.pressing2 = false;
  self.pressing3 = false;
  self.mouseAngle = 0;
  self.hpNat = 100;
  self.manaNat = 100;

  var super_update = self.update;
  self.update = function(){
    self.updateSpd();
    super_update();

    if(self.actionCooldown > 0){
      self.actionCooldown--;
    }

    if(self.attackCooldown > 0){
      self.attackCooldown--;
    }

    if(self.pressingAttack && self.attackCooldown === 0){ // EDIT to use attack of weapon type
      self.shootArrow(self.mouseAngle);
      self.attackCooldown = 50/self.dexterity;
    }

    if(self.pressingT && self.inventory.torch > 0 && self.actionCooldown === 0){
      self.lightTorch();
      self.actionCooldown = 10;
    }

    // ACTIONS
    if(self.pressingE && self.actionCooldown === 0 && !self.working){
      var loc = getLoc(self.x,self.y);
      // clear brush
      if(self.z === 0 && getTile(0,loc[0],loc[1]) === 3){
        self.working = true;
        setTimeout(function(){
          if(self.working){
            world[0][loc[1]][loc[0]] = 7;
            io.emit('mapEdit',world);
            self.working = false;
          } else {
            return;
          }
        },3000/self.strength);
      }
      // gather wood
      if(self.z === 0 && (getTile(0,loc[0],loc[1]) === 1 || getTile(0,loc[0],loc[1]) === 2)){
        self.working = true;
        self.actionCooldown = 10;
        setTimeout(function(){
          if(self.working){
            world[6][loc[1]][loc[0]] -= 1;
            self.inventory.wood += 1;
            self.working = false;
          } else {
            return;
          }
        },6000/self.strength);
        // gather stone
      } else if(self.z === 0 && (getTile(0,loc[0],loc[1]) === 4 || getTile(0,loc[0],loc[1]) === 5)){
        self.working = true;
        self.actionCooldown = 10;
        setTimeout(function(){
          if(self.working){
            world[6][loc[1]][loc[0]] -= 1;
            self.inventory.stone += 1;
            self.working = false;
          } else {
            return;
          }
        },10000/self.strength);
      } else if(self.z === -1 && getTile(0,loc[0],loc[1]) === 3){
        self.working = true;
        self.actionCooldown = 10;
        setTimeout(function(){
          if(self.working){
            world[7][loc[1]][loc[0]] -= 1;
            self.inventory.stone += 1;
            self.working = false;
          } else {
            return;
          }
        },10000/self.strength);
          // farm
      } else if(self.z === 0 && getTile(0,loc[0],loc[1]) === 8){
        var f = getBuilding(self.x,self.y);
        self.working = true;
        self.actionCooldown = 10;
        setTimeout(function(){
          if(self.working && world[6][loc[1]][loc[0]] < 25){
            world[6][loc[1]][loc[0]] += 1;
            io.emit('mapEdit',world);
            self.working = false;
            var count = 0;
            var plot = Building.list[f].plot;
            for(i in plot){
              var n = plot[i];
              console.log(world[6][n[1]][n[0]]);
              if(world[6][n[1]][n[0]] === 25){
                count++;
              } else {
                continue;
              }
            }
            console.log(count);
            if(count === 9){
              for(i in plot){
                var n = plot[i];
                world[0][n[1]][n[0]] = 9;
              }
              io.emit('mapEdit',world);
            }
          } else {
            return;
          }
        },10000);
      } else if(self.z === 0 && getTile(0,loc[0],loc[1]) === 9){
        var f = Building.list[getBuilding(self.x,self.y)];
        self.working = true;
        self.actionCooldown = 10;
        setTimeout(function(){
          if(self.working && world[6][loc[1]][loc[0]] < 50){
            world[6][loc[1]][loc[0]] += 5;
            io.emit('mapEdit',world);
            self.working = false;
            var count = 0;
            var plot = f.plot;
            for(i in plot){
              if(world[6][plot[i][1]][plot[i][0]] === 50){
                count++;
              } else {
                continue;
              }
            }
            if(count === 9){
              for(i in plot){
                world[0][plot[i][1]][plot[i][0]] = 10;
              }
              io.emit('mapEdit',world);
            }
          } else {
            return;
          }
        },10000);
      } else if(self.z === 0 && getTile(0,loc[0],loc[1]) === 10){
        var f = getBuilding(self.x,self.y);
        self.working = true;
        self.actionCooldown = 10;
        setTimeout(function(){
          if(self.working){
            world[6][loc[1]][loc[0]] -= 1;
            self.inventory.grain += 1;
            self.working = false;
            if(world[6][loc[1]][loc[0]] === 0){
              world[0][loc[1]][loc[0]] = 8;
              io.emit('mapEdit', world);
            }
          } else {
            return;
          }
        },10000);
        // build
      } else if(self.z === 0 && getTile(0,loc[0],loc[1]) === 11){
        self.working = true;
        self.actionCooldown = 10;
        var b = Building.list[getBuilding(self.x,self.y)];
        setTimeout(function(){
          if(self.working){
            world[6][loc[1]][loc[0]] += 10;
            self.working = false;
            var count = 0;
            var plot = b.plot;
            var walls = b.walls;
            var top = b.topPlot;
            if(world[6][loc[1]][loc[0]] >= b.req){
              world[0][loc[1]][loc[0]] = 12;
              io.emit('mapEdit',world);
            }
            for(i in plot){
              if(world[6][plot[i][1]][plot[i][0]] >= b.req){
                count++;
              } else {
                continue;
              }
            }
            if(count === plot.length){
              if(b.type === 'hut'){
                for(i in plot){
                  world[0][plot[i][1]][plot[i][0]] = 13;
                  world[3][plot[i][1]][plot[i][0]] = String('hut' + i);
                  if(world[3][plot[i][1]][plot[i][0]] === 'hut1'){
                    world[0][plot[i][1]][plot[i][0]] = 14;
                  }
                }
                for(i in walls){
                  var n = walls[i];
                  world[4][n[1]][n[0]] = 1;
                }
              } else if(b.type === 'house'){
                for(i in plot){
                  world[0][plot[i][1]][plot[i][0]] = 15;
                  world[3][plot[i][1]][plot[i][0]] = String('house' + i);
                  if(world[3][plot[i][1]][plot[i][0]] === 'house1'){
                    world[0][plot[i][1]][plot[i][0]] = 19;
                  } else if(world[3][plot[i][1]][plot[i][0]] === 'house4'){
                    world[0][plot[i][1]][plot[i][0]] = 17;
                  }
                }
                for(i in walls){
                  var n = walls[i];
                  world[4][n[1]][n[0]] = 2;
                }
                Player.list[b.owner].inventory.keys.push(b.id);
              } else if(b.type === 'fort'){
                world[0][plot[0][1]][plot[0][0]] = 18;
                world[3][plot[0][1]][plot[0][0]] = 'fort';
              } else if(b.type === 'wall'){
                world[0][plot[0][1]][plot[0][0]] = 18;
                world[3][plot[0][1]][plot[0][0]] = 'wall';
              } else if(b.type === 'outpost'){
                world[0][plot[0][1]][plot[0][0]] = 18;
                world[3][plot[0][1]][plot[0][0]] = 'outpost0';
                world[5][top[0][1]][top[0][0]] = 'outpost1';
              } else if(b.type === 'gtower'){
                for(i in plot){
                  world[0][plot[i][1]][plot[i][0]] = 18;
                  world[3][top[i][1]][top[i][0]] = String('gtower' + i);
                }
                world[5][top[0][1]][top[0][0]] = 'gtower4';
                world[5][top[1][1]][top[1][0]] = 'gtower5';
              } else if(b.type === 'tower'){
                for(i in plot){
                  world[3][plot[i][1]][plot[i][0]] = String('tower' + i);
                  if(world[3][plot[i][1]][plot[i][0]] === 'tower0'){
                    world[0][plot[i][1]][plot[i][0]] = 19;
                    world[5][plot[i][1]][plot[i][0]] = 15;
                  } else if(world[3][plot[i][1]][plot[i][0]] === 'tower1' || world[3][plot[i][1]][plot[i][0]] === 'tower3' || world[3][plot[i][1]][plot[i][0]] === 'tower4'){
                    world[0][plot[i][1]][plot[i][0]] = 17;
                    world[5][plot[i][1]][plot[i][0]] = 15;
                  } else {
                    world[0][plot[i][1]][plot[i][0]] = 15;
                    world[5][plot[i][1]][plot[i][0]] = 15;
                  }
                }
                var ii = 9;
                for(i in top){
                  var n = top[i];
                  world[5][n[1]][n[0]] = String('tower' + ii);
                  world[4][n[1]][n[0]] = 2;
                  if(world[5][n[1]][n[0]] === 'tower10'){
                    world[4][n[1]][n[0]] = 4;
                  } else if(world[5][n[1]][n[0]] === 'tower12' || world[5][n[1]][n[0]] === 'tower13' || world[5][n[1]][n[0]] === 'tower14'){
                    world[4][n[1]][n[0]] = 0;
                  }
                  ii++;
                }
                Player.list[b.owner].inventory.keys.push(b.id);
              } else if(b.type === 'tavern'){
                for(i in plot){
                  world[3][plot[i][1]][plot[i][0]] = String('tavern' + i);
                  if(world[3][plot[i][1]][plot[i][0]] === 'tavern1'){
                    world[0][plot[i][1]][plot[i][0]] = 14;
                    world[5][plot[i][1]][plot[i][0]] = 14;
                  } else {
                    world[0][plot[i][1]][plot[i][0]] = 13;
                    world[5][plot[i][1]][plot[i][0]] = 13;
                  }
                }
                var ii = 17;
                for(i in top){
                  var n = top[i];
                  world[5][n[1]][n[0]] = String('tavern' + ii);
                  ii++;
                }
                for(i in walls){
                  var n = walls[i];
                  world[4][n[1]][n[0]] = 1;
                }
                world[4][walls[4][1]][walls[4][0]] = 3;
              } else if(b.type === 'monastery'){
                for(i in plot){
                  world[3][plot[i][1]][plot[i][0]] = String('monastery' + i);
                  if(world[3][plot[i][1]][plot[i][0]] === 'monastery0'){
                    world[0][plot[i][1]][plot[i][0]] = 16;
                  } else if(world[3][plot[i][1]][plot[i][0]] === 'monastery1' || world[3][plot[i][1]][plot[i][0]] === 'monastery2' || world[3][plot[i][1]][plot[i][0]] === 'monastery4' || world[3][plot[i][1]][plot[i][0]] === 'monastery5' || world[3][plot[i][1]][plot[i][0]] === 'monastery6'){
                    world[0][plot[i][1]][plot[i][0]] = 17;
                  } else if(world[3][plot[i][1]][plot[i][0]] === 'monastery3' || world[3][plot[i][1]][plot[i][0]] === 'monastery7'){
                    world[0][plot[i][1]][plot[i][0]] = 15;
                  } else if(world[3][plot[i][1]][plot[i][0]] === 'monastery12' || world[3][plot[i][1]][plot[i][0]] === 'monastery13'){
                    world[0][plot[i][1]][plot[i][0]] = 15;
                    world[5][plot[i][1]][plot[i][0]] = 17;
                  } else {
                    world[0][plot[i][1]][plot[i][0]] = 15;
                    world[5][plot[i][1]][plot[i][0]] = 15;
                  }
                }
                var ii = 14;
                for(i in top){
                  var n = top[i];
                  world[5][n[1]][n[0]] = String('monastery' + ii);
                  ii++;
                }
                for(i in walls){
                  var n = walls[i];
                  world[4][n[1]][n[0]] = 2;
                }
                world[4][walls[1][1]][walls[1][0]] = 4;
              } else if(b.type === 'market'){
                for(i in plot){
                  world[3][plot[i][1]][plot[i][0]] = String('market' + i);
                  if(world[3][plot[i][1]][plot[i][0]] === 'market0' || world[3][plot[i][1]][plot[i][0]] === 'market1' || world[3][plot[i][1]][plot[i][0]] === 'market2'){
                    world[0][plot[i][1]][plot[i][0]] = 14;
                  } else {
                    world[0][plot[i][1]][plot[i][0]] = 13;
                    world[5][plot[i][1]][plot[i][0]] = 13;
                  }
                }
                var ii = 12;
                for(i in top){
                  var n = top[i];
                  world[5][n[1]][n[0]] = String('market' + ii);
                  ii++;
                }
                for(i in walls){
                  var n = walls[i];
                  if(world[5][n[1]][n[0]] === 'market12'){
                    world[4][n[1]][n[0]] = 3;
                  } else {
                    world[4][n[1]][n[0]] = 1;
                  }
                }
              }
              io.emit('mapEdit',world);
            }
          }
        },10000/self.strength);
      } else {
        return;
      }
    }
  }

  self.shootArrow = function(angle){
    Arrow({
      parent:self.id,
      angle:angle,
      x:self.x,
      y:self.y,
      z:self.z
    });
  }

  self.lightTorch = function(){
    Torch({
      parent:self.id,
      x:self.x,
      y:self.y,
      z:self.z,
    })
    self.inventory.torch--;
    console.log(self.inventory.torch);
  }

  // x,y movement
  self.updateSpd = function(){
    var loc = getLoc(self.x, self.y);
    var rightBlocked = false;
    var leftBlocked = false;
    var upBlocked = false;
    var downBlocked = false;

    // outdoor collisions
    if(self.z === 0 && (getLocTile(0,self.x+(tileSize/2),self.y) === 13 || getLocTile(0,self.x+(tileSize/2),self.y) === 15 || getLocTile(0,self.x+(tileSize/2),self.y) === 17 || getLocTile(0,self.x+(tileSize/2),self.y) === 18 || (self.x + 10) > (mapPx - tileSize))){
      rightBlocked = true;
    }
    if(self.z === 0 && (getLocTile(0,self.x-(tileSize/2),self.y) === 13 || getLocTile(0,self.x-(tileSize/2),self.y) === 15 || getLocTile(0,self.x-(tileSize/2),self.y) === 17 || getLocTile(0,self.x-(tileSize/2),self.y) === 18 || (self.x - 10) < 0)){
      leftBlocked = true;
    }
    if(self.z === 0 && (getLocTile(0,self.x,self.y-(tileSize/2)) === 13 || getLocTile(0,self.x,self.y-(tileSize/2)) === 15 || getLocTile(0,self.x,self.y-(tileSize/2)) === 17 || getLocTile(0,self.x,self.y-(tileSize/2)) === 18 || (getLocTile(0,self.x,self.y-(tileSize/2)) === 19 && !keyCheck(self.x,self.y-(tileSize/2),self.id)) || (self.y - 10) < 0)){
      upBlocked = true;
    }
    if(self.z === 0 && (getLocTile(0,self.x,self.y+(tileSize*0.75)) === 13 || getLocTile(0,self.x,self.y+(tileSize*0.75)) === 15 || getLocTile(0,self.x,self.y+(tileSize*0.75)) === 17 || getLocTile(0,self.x,self.y+(tileSize*0.75)) === 18 || (self.y + 10) > (mapPx - tileSize))){
      downBlocked = true;
    }

    // collision in caves
    if(self.z === -1 && (getLocTile(1,self.x+(tileSize/2),self.y) === 1 || (self.x + 10) > (mapPx - tileSize))){
      rightBlocked = true;
    }
    if(self.z === -1 && (getLocTile(1,self.x-(tileSize/2),self.y) === 1 || (self.x - 10) < 0)){
      leftBlocked = true;
    }
    if(self.z === -1 && (getLocTile(1,self.x,self.y-(tileSize/4)) === 1 || (self.y - 10) < 0)){
      upBlocked = true;
    }
    if(self.z === -1 && (getLocTile(1,self.x,self.y+(tileSize*0.75)) === 1 || (self.y + 10) > (mapPx - tileSize))){
      downBlocked = true;
    }

    // indoor1 collisions
    if(self.z === 1 && getLocTile(3,self.x+(tileSize/2),self.y) === 0){
      rightBlocked = true;
    }
    if(self.z === 1 && getLocTile(3,self.x-(tileSize/2),self.y) === 0){
      leftBlocked = true;
    }
    if(self.z === 1 && (getLocTile(4,self.x,self.y-(tileSize/6)) === 1 || getLocTile(4,self.x,self.y-(tileSize/6)) === 2)){
      upBlocked = true;
    }
    if(self.z === 1 && getLocTile(0,self.x,self.y) !== 14 && getLocTile(0,self.x,self.y) !== 16 && getLocTile(0,self.x,self.y) !== 19 && getLocTile(3,self.x,self.y+(tileSize*0.75)) === 0){
      downBlocked = true;
    }

    // indoor2 collisions
    if(self.z === 2 && getLocTile(3,self.x+(tileSize/2),self.y) === 0){
      rightBlocked = true;
    }
    if(self.z === 2 && getLocTile(3,self.x-(tileSize/2),self.y) === 0){
      leftBlocked = true;
    }
    if(self.z === 2 && (getLocTile(4,self.x,self.y-(tileSize/6)) === 1 || getLocTile(4,self.x,self.y-(tileSize/6)) === 2)){
      upBlocked = true;
    }
    if(self.z === 2 && getLocTile(5,self.x,self.y+(tileSize*0.75)) === 0){
      downBlocked = true;
    }

    if(self.pressingRight && !rightBlocked){
      self.spdX = self.maxSpd;
      self.facing = 'right';
      self.working = false;
    } else if(self.pressingLeft && !leftBlocked){
      self.spdX = -self.maxSpd;
      self.facing = 'left';
      self.working = false;
    } else {
      self.spdX = 0;
    }

    if(self.pressingUp && !upBlocked){
      self.spdY = -self.maxSpd;
      self.facing = 'up';
      self.working = false;
    } else if(self.pressingDown && !downBlocked){
      self.spdY = self.maxSpd;
      self.facing = 'down';
      self.working = false;
    } else {
      self.spdY = 0;
    }

    // terrain effects and z movement
    if(self.z === 0){
      if(getTile(0,loc[0],loc[1]) === 6){
        self.z = -1;
        self.inTrees = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd;
      } else if(getTile(0,loc[0],loc[1]) === 1){
        self.inTrees = true;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 0.3;
      } else if(getTile(0,loc[0],loc[1]) === 2 || getTile(0,loc[0],loc[1]) === 3){
        self.inTrees = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 0.5;
      } else if(getTile(0,loc[0],loc[1]) === 4){
        self.inTrees = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 0.75;
      } else if(getTile(0,loc[0],loc[1]) === 5 && !self.onMtn){
        self.inTrees = false;
        self.maxSpd = self.baseSpd * 0.2;
        setTimeout(function(){
          if(getTile(0,loc[0],loc[1]) === 5){
            self.onMtn = true;
          }
        },2000);
      } else if(getTile(0,loc[0],loc[1]) === 5 && self.onMtn){
        self.maxSpd = self.baseSpd * 0.5;
      } else if(getTile(0,loc[0],loc[1]) === 14 || getTile(0,loc[0],loc[1]) === 16 || getTile(0,loc[0],loc[1]) === 19){
        if(getTile(0,loc[0],loc[1]) === 19){
          self.z = 1;
          SOCKET_LIST[self.id].emit('addToChat','<i>You unlock the door.</i>');
        } else {
          self.z = 1;
        }
        self.inTrees = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd;
      } else {
        self.maxSpd = self.baseSpd;
      }
    } else if(self.z === -1){
      if(getTile(1,loc[0],loc[1]) === 2){
        self.z = 0;
        self.inTrees = false;
        self.onMtn = false;
      }
    } else if(self.z === 1){
      if(getTile(0,loc[0],loc[1] - 1) === 14 || getTile(0,loc[0],loc[1] - 1) === 16  || getTile(0,loc[0],loc[1] - 1) === 19){
        self.z = 0;
      } else if(getTile(4,loc[0],loc[1]) === 3 || getTile(4,loc[0],loc[1]) === 4){
        self.z = 2;
        self.y += (tileSize/2);
        self.facing = 'down'
      }
    } else if(self.z === 2){
      if(getTile(4,loc[0],loc[1]) === 3 || getTile(4,loc[0],loc[1]) === 4){
        self.z = 1;
        self.y += (tileSize/2);
        self.facing = 'down'
      }
    }
  }

  self.getInitPack = function(){
    return {
      username:self.username,
      id:self.id,
      x:self.x,
      y:self.y,
      z:self.z,
      inTrees:self.inTrees,
      facing:self.facing,
      hp:self.hp,
      hpMax:self.hpMax,
      mana:self.mana,
      manaMax:self.manaMax
    };
  }

  self.getUpdatePack = function(){
    return {
      id:self.id,
      x:self.x,
      y:self.y,
      z:self.z,
      inTrees:self.inTrees,
      facing:self.facing,
      pressingUp:self.pressingUp,
      pressingDown:self.pressingDown,
      pressingLeft:self.pressingLeft,
      pressingRight:self.pressingRight,
      pressingAttack:self.pressingAttack,
      angle:self.mouseAngle,
      working:self.working,
      hp:self.hp,
      hpMax:self.hpMax,
      mana:self.mana,
      manaMax:self.manaMax
    }
  }

  Player.list[self.id] = self;

  initPack.player.push(self.getInitPack());
  return self;
}

Player.list = {};

Player.onConnect = function(socket,username){
  var spawn = randomSpawnO();
  var player = Player({
    username:username,
    id:socket.id,
    z: 0,
    x: spawn[0],
    y: spawn[1]
  });
  console.log(player.id + ' spawned at : ' + spawn + ' z: 0')
  // player control inputs
  socket.on('keyPress',function(data){
    if(data.inputId === 'left'){
      player.pressingLeft = data.state;
    } else if(data.inputId === 'right'){
      player.pressingRight = data.state;
    } else if(data.inputId === 'up'){
      player.pressingUp = data.state;
    } else if(data.inputId === 'down'){
      player.pressingDown = data.state;
    } else if(data.inputId === 'attack'){
      player.pressingAttack = data.state;
    } else if(data.inputId === 't'){
      player.pressingT = data.state;
    } else if(data.inputId === 'e'){
      player.pressingE = data.state;
    } else if(data.inputId === '1'){
      player.pressing1 = data.state;
    } else if(data.inputId === '2'){
      player.pressing2 = data.state;
    } else if(data.inputId === '3'){
      player.pressing3 = data.state;
    } else if(data.inputId === 'mouseAngle'){
      player.mouseAngle = data.state;
    }
  });

  socket.on('sendMsgToServer',function(data){
    for(var i in SOCKET_LIST){
      SOCKET_LIST[i].emit('addToChat','<b>' + data.username + ':</b> ' + data.message);
    }
  });

  socket.on('sendPmToServer',function(data){
    var recipient = null;
    for(var i in Player.list){
      if(Player.list[i].username === data.recip){
        recipient = SOCKET_LIST[i];
      }
    }
    if(recipient === null){
      socket.emit('addToChat','DM: ' + data.recip + ' is not online.');
    } else {
      recipient.emit('addToChat','<b>@' + player.username + '</b> whispers: <i>' + data.message + '</i>');
      SOCKET_LIST[player.id].emit('addToChat','To ' + data.recip + ': <i>' + data.message + '</i>');
    }
  });

  socket.emit('init',{
    selfId:player.id,
    player:Player.getAllInitPack(),
    arrow:Arrow.getAllInitPack(),
    item:Item.getAllInitPack(),
    light:Light.getAllInitPack()
  })
  console.log('init player id: ' + player.id);
}

Player.getAllInitPack = function(){
  var players = [];
  for(var i in Player.list)
    players.push(Player.list[i].getInitPack());
  return players;
}

Player.onDisconnect = function(socket){
  delete Player.list[socket.id];
  removePack.player.push(socket.id);
}

Player.update = function(){
  var pack = [];
  for(var i in Player.list){
    var player = Player.list[i];
    player.update();
    pack.push(player.getUpdatePack());
  }
  return pack;
}

// ARROWS
Arrow = function(param){
  var self = Entity(param);
  self.angle = param.angle;
  self.spdX = Math.cos(param.angle/180*Math.PI) * 50;
  self.spdY = Math.sin(param.angle/180*Math.PI) * 50;
  self.parent = param.parent;

  self.timer = 0;
  self.toRemove = false;
  var super_update = self.update;
  self.update = function(){
    if(self.timer++ > 100){
      self.toRemove = true;
    }
    super_update();

    for(var i in Player.list){
      var p = Player.list[i];
      if(self.getDistance(p) < 32 && self.z === p.z && self.parent !== p.id){
        p.hp -= 5;
        // defines shooter
        var shooter = Player.list[self.parent];
        // player death & respawn
        if(p.hp <= 0){
          p.hp = p.hpMax;
          var spawn = randomSpawn;
          p.x = spawn[0]; // replace this
          p.y = spawm[1]; // replace this
        }
        self.toRemove = true;
      } else if(self.x === 0 || self.x === mapPx || self.y === 0 || self.y === mapPx){
        self.toRemove = true;
      } else if(self.z === 0 && getLocTile(0,self.x,self.y) === 5 && getLocTile(0,Player.list[self.parent].x,Player.list[self.parent].y) !== 5){
        self.toRemove = true;
      } else if(self.z === 0 && getLocTile(0,self.x,self.y) === 1 && getLocTile(0,Player.list[self.parent].x,Player.list[self.parent].y) !== 1){
        self.toRemove = true;
      } else if(self.z === 0 && (getLocTile(0,self.x,self.y) === 13 || getLocTile(0,self.x,self.y) === 14 || getLocTile(0,self.x,self.y) === 15 || getLocTile(0,self.x,self.y) === 16 || getLocTile(0,self.x,self.y) === 18 || getLocTile(0,self.x,self.y) === 19)){
        self.toRemove = true;
      } else if(self.z === -1 && getLocTile(1,self.x,self.y) === 1){
        self.toRemove = true;
      } else if(self.z === 1 && (getLocTile(3,self.x,self.y) === 0 || getLocTile(4,self.x,self.y) !== 0)){
        self.toRemove = true;
      } else if(self.z === 2 && (getLocTile(5,self.x,self.y) === 0 || getLocTile(4,self.x,self.y) !== 0)){
        self.toRemove = true;
      }
    }
  }

  self.getInitPack = function(){
    return {
      id:self.id,
      angle:self.angle,
      x:self.x,
      y:self.y,
      z:self.z
    };
  }

  self.getUpdatePack = function(){
    return {
      id:self.id,
      x:self.x,
      y:self.y,
      z:self.z
    }
  }

  Arrow.list[self.id] = self;
  initPack.arrow.push(self.getInitPack());
  return self;
}

Arrow.list = {};

Arrow.update = function(){
  var pack = [];
  for(var i in Arrow.list){
    var arrow = Arrow.list[i];
    arrow.update();
    if(arrow.toRemove){
      delete Arrow.list[i];
      removePack.arrow.push(arrow.id);
    } else
      pack.push(arrow.getUpdatePack());
  }
  return pack;
}

Arrow.getAllInitPack = function(){
  var arrows = [];
  for(var i in Arrow.list)
    arrows.push(Arrow.list[i].getInitPack());
  return arrows;
}

// ITEM
Item = function(param){
  var self = Entity(param);
  self.x = param.x;
  self.y = param.y;
  self.z = param.z;
  self.type = null;
  self.rank = null;
  self.parent = param.parent;
  self.canPickup = true;
  self.toRemove = false;

  self.getInitPack = function(){
    return {
      id:self.id,
      parent:self.parent,
      type:self.type,
      x:self.x,
      y:self.y,
      z:self.z,
    };
  }

  self.getUpdatePack = function(){
    return{
      id:self.id,
      x:self.x,
      y:self.y,
      z:self.z
    }
  }
  return self;
}

Item.list = {};

Item.update = function(){
  var pack = [];
  for(var i in Item.list){
    var item = Item.list[i];
    item.update();
    if(item.toRemove){
      delete Item.list[i];
      removePack.item.push(item.id);
    } else
      pack.push(item.getUpdatePack());
  }
  return pack;
}

Item.getAllInitPack = function(){
  var items = [];
  for(var i in Item.list)
    items.push(Item.list[i].getInitPack());
  return items;
}

// TORCH
Torch = function(param){
  var self = Item(param);
  self.type = 'torch';
  self.rank = 0;
  self.canPickup = false;
  self.timer = 0;
  var super_update = self.update;
  self.update = function(){
    if(Player.list[self.parent]){
      self.x = Player.list[self.parent].x - (tileSize * 0.75);
      self.y = Player.list[self.parent].y - (tileSize * 0.75);
      self.z = Player.list[self.parent].z;
    } else {
      self.toRemove = true;
    }
    if(self.timer++ > 3000){
      self.toRemove = true;
    }
    super_update();
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  Light({
    parent:self.id,
    radius:1,
    x:self.x,
    y:self.y,
    z:self.z
  });
  return self;
}

// LIGHT SOURCE
Light = function(param){
  var self = Entity(param);
  self.parent = param.parent;
  self.radius = param.radius;
  self.toRemove = false;
  var super_update = self.update;
  self.update = function(){
    if(Item.list[self.parent]){
      self.x = Item.list[self.parent].x + (tileSize * 0.25);
      self.y = Item.list[self.parent].y;
      self.z = Item.list[self.parent].z;
    }
    else {
      self.toRemove = true;
    }
    super_update();
  }

  self.getInitPack = function(){
    return {
      id:self.id,
      x:self.x,
      y:self.y,
      z:self.z,
      radius:self.radius
    };
  }

  self.getUpdatePack = function(){
    return {
      id:self.id,
      x:self.x,
      y:self.y,
      z:self.z
    }
  }

  Light.list[self.id] = self;
  initPack.light.push(self.getInitPack());
  return self;
}

Light.list = {};

Light.update = function(){
  var pack = [];
  for(var i in Light.list){
    var light = Light.list[i];
    light.update();
    if(light.toRemove){
      delete Light.list[i];
      removePack.light.push(light.id);
    } else
      pack.push(light.getUpdatePack());
  }
  return pack;
}

Light.getAllInitPack = function(){
  var lights = [];
  for(var i in Light.list)
    lights.push(Light.list[i].getInitPack());
  return lights;
}
