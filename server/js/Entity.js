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
  self.built = param.built;
  self.plot = param.plot;
  self.walls = param.walls;
  self.topPlot = param.topPlot;
  self.patrolPoint = param.patrolPoint;
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
Building.list = {};

Building.update = function(){
  var pack = null;
  for(var i in Building.list){
    var building = Building.list[i];
    if(building.update){
      building.update();
    }
  }
  return pack;
}

// CHARACTER
Character = function(param){
  var self = Entity(param);
  self.type = 'npc';
  self.name = null;
  self.house = param.house;
  self.kingdom = param.kingdom;
  self.home = param.home; // {z,x,y}
  self.class = null;
  self.rank = null;
  self.keys = [];
  self.inventory = {
    wood:0,
    stone:0,
    grain:0,
    ironore:0,
    ironbar:0,
    steelbar:0,
    boarhide:0,
    leather:0,
    silverore:0,
    silver:0,
    goldore:0,
    gold:0,
    diamond:0,
    huntingknife:0,
    dague:0,
    rondel:0,
    misericorde:0,
    bastardsword:0,
    longsword:0,
    zweihander:0,
    morallta:0,
    bow:0,
    welshlongbow:0,
    knightlance:0,
    rusticlance:0,
    paladinlance:0,
    brigandine:0,
    lamellar:0,
    maille:0,
    hauberk:0,
    brynja:0,
    cuirass:0,
    steelplate:0,
    greenwichplate:0,
    gothicplate:0,
    clericrobe:0,
    monkcowl:0,
    blackcloak:0,
    tome:0,
    runicscroll:0,
    sacredtext:0,
    stoneaxe:0,
    ironaxe:0,
    pickaxe:0,
    torch:0,
    bread:0,
    fish:0,
    lamb:0,
    boarmeat:0,
    venison:0,
    poachedfish:0,
    lambchop:0,
    boarshank:0,
    venisonloin:0,
    mead:0,
    saison:0,
    flandersredale:0,
    bieredegarde:0,
    bordeaux:0,
    bourgogne:0,
    chianti:0,
    crown:0,
    arrows:0,
    worldmap:0,
    relic:0
  }
  self.mounted = false;
  self.stealthed = false;
  self.ranged = false;
  self.cleric = false;
  self.visible = false;
  self.spriteSize = tileSize;
  self.facing = 'down';
  self.pressingRight = false;
  self.pressingLeft = false;
  self.pressingUp = false;
  self.pressingDown = false;
  self.pressingAttack = false;
  self.innaWoods = false;
  self.onMtn = false;
  self.hasTorch = false;
  self.working = false;
  self.chopping = false;
  self.mining = false;
  self.farming = false;
  self.building = false;
  self.fishing = false;
  self.baseSpd = 4;
  self.maxSpd = 4;
  self.idleTime = 0;
  self.idleRange = 1000;
  self.wanderRange = 256;
  self.aggroRange = 256;
  self.actionCooldown = 0;
  self.attackCooldown = 0;
  self.hp = 100;
  self.hpMax = 100;
  self.spirit = null;
  self.spiritMax = null;
  self.dmg = null;
  self.attackrate = 100;
  self.dexterity = 1;

  // idle = walk around
  // patrol = walk between targets
  // escort = follow and protect target
  // raid = attack all enemies en route to target
  self.mode = 'idle';

  // combat = eliminate target
  // flee = disengage and escape from target
  // return = return to previous location and activity
  self.action = null;

  self.lastLoc = null;

  self.dialogue = {};

  self.friends = [];
  self.enemies = [];

  self.combat = {
    target:null,
    targetDmg:0,
    altDmg:0
  }

  self.patrol = {
    bList:null,
    next:null
  }

  self.escort = {
    target:null,
    escorting:[] // unit ids
  }

  self.scout = {
    target:null,
    return:null,
    enemyBuilding:null,
    attacked:null
  }

  self.guard = {
    point:null,
    facing:null
  }

  self.raid = {
    target:null
  }

  self.path = null; // z = 0
  self.path1 = null; // z = 1
  self.path2 = null; // z = 2
  self.pathU = null; // z = -1
  self.pathD = null; // z = -2
  self.pathCount = 0;

  self.attack = function(dir){
    self.pressingAttack = true;
    self.working = false;
    self.chopping = false;
    self.mining = false;
    self.farming = false;
    self.building = false;
    self.fishing = false;
    var dmg = self.dmg;
    if(self.type === 'player'){
      dmg = self.gear.weapon.dmg;
    }
    if(dir === 'down'){
      for(var i in Player.list){
        var p = Player.list[i];
        if(Math.sqrt(Math.pow(self.x-p.x,2) + Math.pow((self.y + tileSize)-p.y,2)) < 32){
          if(allyCheck(self.id,p.id) < 1 || self.friendlyfire){
            p.hp -= dmg;
          }
          // player death & respawn
          if(p.hp <= 0){
            p.hp = p.hpMax;
            var spawn = randomSpawnO();
            p.x = spawn[0]; // replace this
            p.y = spawn[1]; // replace this
            self.combat.target = null;
            self.action = null;
          }
        }
      }
    } else if(dir === 'up'){
      for(var i in Player.list){
        var p = Player.list[i];
        if(Math.sqrt(Math.pow(self.x-p.x,2) + Math.pow((self.y - tileSize)-p.y,2)) < 32){
          if(allyCheck(self.id,p.id) < 1 || self.friendlyfire){
            p.hp -= dmg;
          }
          // player death & respawn
          if(p.hp <= 0){
            p.hp = p.hpMax;
            var spawn = randomSpawnO();
            p.x = spawn[0]; // replace this
            p.y = spawn[1]; // replace this
            self.combat.target = null;
            self.action = null;
          }
        }
      }
    } else if(dir === 'left'){
      for(var i in Player.list){
        var p = Player.list[i];
        if(Math.sqrt(Math.pow((self.x - tileSize)-p.x,2) + Math.pow((self.y)-p.y,2)) < 32){
          if(allyCheck(self.id,p.id) < 1 || self.friendlyfire){
            p.hp -= dmg;
          }
          // player death & respawn
          if(p.hp <= 0){
            p.hp = p.hpMax;
            var spawn = randomSpawnO();
            p.x = spawn[0]; // replace this
            p.y = spawn[1]; // replace this
            self.combat.target = null;
            self.action = null;
          }
        }
      }
    } else if(dir === 'right'){
      for(var i in Player.list){
        var p = Player.list[i];
        if(Math.sqrt(Math.pow((self.x + tileSize)-p.x,2) + Math.pow((self.y)-p.y,2)) < 32){
          if(allyCheck(self.id,p.id) < 1 || self.friendlyfire){
            p.hp -= dmg;
          }
          // player death & respawn
          if(p.hp <= 0){
            p.hp = p.hpMax;
            var spawn = randomSpawnO();
            p.x = spawn[0]; // replace this
            p.y = spawn[1]; // replace this
            self.combat.target = null;
            self.action = null;
          }
        }
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

  self.lightTorch = function(torchId){
    if(self.z !== -3){
      LitTorch({
        id:torchId,
        parent:self.id,
        x:self.x,
        y:self.y,
        z:self.z,
        qty:1
      })
      self.hasTorch = torchId;
    }
  }

  self.rightBlocked = false;
  self.leftBlocked = false;
  self.upBlocked = false;
  self.downBlocked = false;

  self.reposition = function(target){
    var target = Player.list[target];
    var angle = self.getAngle(target.x,target.y);
    if(angle > 45 && angle <= 115){ // go up (or left/right)
      if(!self.upBlocked){
        self.y -= self.maxSpd;
        self.pressingUp = true;
        self.facing = 'up';
      } else {
        if(self.x < target.x){
          if(!self.leftBlocked){
            self.x -= self.maxSpd;
            self.pressingLeft = true;
            self.facing = 'left';
          } else if(!self.rightBlocked){
            self.x += self.maxSpd;
            self.pressingRight = true;
            self.facing = 'right';
          }
        } else {
          if(!self.rightBlocked){
            self.x += self.maxSpd;
            self.pressingRight = true;
            self.facing = 'right';
          } else if(!self.leftBlocked){
            self.x -= self.maxSpd;
            self.pressingLeft = true;
            self.facing = 'left';
          }
        }
      }
    } else if(self.angle > -135 && self.angle <= -15){ // go down (or left/right)
      if(!self.downlocked){
        self.y += self.maxSpd;
        self.pressingDown = true;
        self.facing = 'down';
      } else {
        if(self.x < target.x){
          if(!self.leftBlocked){
            self.x -= self.maxSpd;
            self.pressingLeft = true;
            self.facing = 'left';
          } else if(!self.rightBlocked){
            self.x += self.maxSpd;
            self.pressingRight = true;
            self.facing = 'right';
          }
        } else {
          if(!self.rightBlocked){
            self.x += self.maxSpd;
            self.pressingRight = true;
            self.facing = 'right';
          } else if(!self.leftBlocked){
            self.x -= self.maxSpd;
            self.pressingLeft = true;
            self.facing = 'left';
          }
        }
      }
    } else if(self.angle > 115 || self.angle <= -135){ // go right (or up/down)
      if(!self.rightBlocked){
        self.x += self.maxSpd;
        self.pressingRight = true;
        self.facing = 'right';
      } else {
        if(target.y < self.y){
          if(!self.downBlocked){
            self.y += self.maxSpd;
            self.pressingDown = true;
            self.facing = 'down';
          } else if(!self.upBlocked){
            self.y -= self.maxSpd;
            self.pressingUp = true;
            self.facing = 'up';
          }
        } else {
          if(!self.upBlocked){
            self.y -= self.maxSpd;
            self.pressingUp = true;
            self.facing = 'up';
          } else if(!self.downBlocked){
            self.y += self.maxSpd;
            self.pressingDown = true;
            self.facing = 'down';
          }
        }
      }
    } else if(self.angle > -15 || self.angle <= 45){ // go left (or up/down)
      if(!self.leftBlocked){
        self.x -= self.maxSpd;
        self.pressingLeft = true;
        self.facing = 'left';
      } else {
        if(target.y < self.y){
          if(!self.downBlocked){
            self.y += self.maxSpd;
            self.pressingDown = true;
            self.facing = 'down';
          } else if(!self.upBlocked){
            self.y -= self.maxSpd;
            self.pressingUp = true;
            self.facing = 'up';
          }
        } else {
          if(!self.upBlocked){
            self.y -= self.maxSpd;
            self.pressingUp = true;
            self.facing = 'up';
          } else if(!self.downBlocked){
            self.y += self.maxSpd;
            self.pressingDown = true;
            self.facing = 'down';
          }
        }
      }
    }
  }

  self.getAngle = function(x,y){
    var angle = Math.atan2(y,x) / Math.PI * 180;
    return angle;
  }

  self.checkAggro = function(){
    for(var i in Player.list){
      var p = Player.list[i];
      var pDist = self.getDistance(p.x,p.y);
      if(pDist < self.aggroRange){
        if(allyCheck(self.id,p.id) < 0){
          self.combat.target = p.id;
          if(self.hp < (self.hpMax * 0.1) || self.class === 'Deer' || self.class === 'SerfM' || self.class === 'SerfF'){
            self.action = 'flee';
          } else {
            self.action = 'combat';
            if(!self.lastLoc){
              self.lastLoc = loc;
            }
          }
        }
      }
    }
  }

  self.hardAggro = function(){
    for(var i in Player.list){
      var p = Player.list[i];
      var pDist = self.getDistance(p.x,p.y);
      if(pDist < self.aggroRange){
        if(allyCheck(self.id,p.id) < 0){
          self.combat.target = p.id;
          self.action = 'combat';
        }
      }
    }
  }

  self.update = function(){
    if(self.idleTime > 0){
      self.idleTime--;
    }
    if(self.attackCooldown > 0){
      self.attackCooldown--;
    }

    var loc = getLoc(self.x, self.y);
    if(self.z === 0){
      if(getTile(0,loc[0],loc[1]) === 6){
        self.z = -1;
        self.path = null;
        self.pathCount = 0;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd;
      } else if(getTile(0,loc[0],loc[1]) >= 1 && getTile(0,loc[0],loc[1]) < 2){
        self.innaWoods = true;
        self.onMtn = false;
        if(self.class !== 'Deer' && self.class !== 'Boar' && self.class !== 'Wolf'){
          self.maxSpd = self.baseSpd * 0.3;
        }
      } else if(getTile(0,loc[0],loc[1]) >= 2 && getTile(0,loc[0],loc[1]) < 4){
        self.innaWoods = false;
        self.onMtn = false;
        if(self.class !== 'Deer' && self.class !== 'Boar' && self.class !== 'Wolf'){
          self.maxSpd = self.baseSpd * 0.5;
        }
      } else if(getTile(0,loc[0],loc[1]) >= 4 && getTile(0,loc[0],loc[1]) < 5){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 0.6;
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && !self.onMtn){
        self.innaWoods = false;
        self.maxSpd = self.baseSpd * 0.2;
        setTimeout(function(){
          if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6){
            self.onMtn = true;
          }
        },2000);
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && self.onMtn){
        self.maxSpd = self.baseSpd * 0.5;
      } else if(getTile(0,loc[0],loc[1]) === 18){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 1.1;
      } else if(getTile(0,loc[0],loc[1]) === 14 || getTile(0,loc[0],loc[1]) === 16 || getTile(0,loc[0],loc[1]) === 19){
        self.z = 1;
        self.path = null;
        self.pathCount = 0;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd;
      } else if(getTile(0,loc[0],loc[1]) === 19){
        self.z = 1;
        self.path = null;
        self.pathCount = 0;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd;
      } else if(getTile(0,loc[0],loc[1]) === 0){
        self.z = -3;
        self.path = null;
        self.pathCount = 0;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 0.1;
      } else {
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd;
      }
    } else if(self.z === -1){
      if(getTile(1,loc[0],loc[1]) === 2){
        self.z = 0;
        self.pathU = null;
        self.pathCount = 0;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 0.9;
      }
    } else if(self.z === -2){
      if(getTile(8,loc[0],loc[1]) === 5){
        self.z = 1;
        self.pathD = null;
        self.pathCount = 0;
        self.y += (tileSize/2);
        self.facing = 'down';
      }
    } else if(self.z === -3){
      if(self.breath > 0){
        self.breath -= 0.25;
      } else {
        self.hp -= 0.5;
      }
      if(getTile(0,loc[0],loc[1]) !== 0){
        self.z = 0;
        self.breath = self.breathMax;
      }
    } else if(self.z === 1){
      if(getTile(0,loc[0],loc[1] - 1) === 14 || getTile(0,loc[0],loc[1] - 1) === 16  || getTile(0,loc[0],loc[1] - 1) === 19){
        self.z = 0;
        self.path1 = null;
        self.pathCount = 0;
      } else if(getTile(4,loc[0],loc[1]) === 3 || getTile(4,loc[0],loc[1]) === 4 || getTile(4,loc[0],loc[1]) === 7){
        self.z = 2;
        self.path1 = null;
        self.pathCount = 0;
        self.y += (tileSize/2);
        self.facing = 'down'
      } else if(getTile(4,loc[0],loc[1]) === 5 || getTile(4,loc[0],loc[1]) === 6){
        self.z = -2;
        self.path1 = null;
        self.pathCount = 0;
        self.y += (tileSize/2);
        self.facing = 'down';
      }
    } else if(self.z === 2){
      if(getTile(4,loc[0],loc[1]) === 3 || getTile(4,loc[0],loc[1]) === 4){
        self.z = 1;
        self.path2 = null;
        self.pathCount = 0;
        self.y += (tileSize/2);
        self.facing = 'down';
      }
    }

    ////////////////
    // VANILLA AI //
    ////////////////

    // IDLE
    if(self.mode === 'idle'){
      var loc = getLoc(self.x,self.y);

      if(!self.action){
        self.checkAggro();
        var hDist = self.getDistance(self.home.x,self.home.y);
        if(self.z === self.home.z && hDist > self.wanderRange){
          self.action === 'return';
        } else if(self.idleTime === 0){
          if((self.z === 0 && !self.path) ||
          (self.z === 1 && !self.path1) ||
          (self.z === 2 && !self.path2) ||
          (self.z === -1 && !self.pathU) ||
          (self.z === -2 && !self.pathD)){
            var col = loc[0];
            var row = loc[1];
            var select = [[col,row-1],[col-1,row],[col,row+1],[col+1,row]];
            var target = select[Math.floor(Math.random() * 4)];
            if(target[0] < mapSize && target[0] > -1 && target[1] < mapSize && target[1] > -1){
              if(isWalkable(self.z,target[0],target[1])){
                if(self.z === 0){
                  self.path = [target];
                } else if(self.z === 1){
                  self.path1 = [target];
                } else if(self.z === 2){
                  self.path2 = [target];
                } else if(self.z === -1){
                  self.pathU = [target];
                } else if(self.z === -2){
                  self.pathD = [target];
                }
                self.idleTime += Math.floor(Math.random() * self.idleRange);
              }
            }
          }
        }
      } else if(self.action === 'combat'){
        var target = self.combat.target;
        if(!target){
          self.action = 'return';
        } else if(self.hp < (self.hpMax * 0.1)){
          self.action = 'flee';
        }
        if(self.ranged){
          var dist = self.getDistance({
            x:Player.list[target].x,
            y:Player.list[target].y
          })
          if(self.attackCooldown > 0){
            if(dist < 256){
              self.reposition(target);
            }
          } else {
            if(dist > 256){
              var angle = self.getAngle(Player.list[target].x,Player.list[target].y);
              self.shootArrow(angle);
              self.attackCooldown += self.attackRate/self.dexterity;
            } else {
              self.reposition(target);
            }
          }
        } else {
          var angle = self.getAngle(Player.list[target].x,Player.list[target].y);
          var tLoc = getLoc(Player.list[target].x,Player.list[target].y);

          if(angle > 45 && angle <= 115){ // attack down
            var uLoc = getLoc(Player.list[target].x,Player.list[target].y-tileSize);
            if(loc[0] !== tLoc[0] || loc[1] < uLoc[1]){
              self.getPath(uLoc[0],uLoc[1]);
            } else {
              self.facing = 'down';
              self.attack('down');
              self.attackCooldown += self.attackrate/self.dexterity;
            }
          } else if(angle > -135 && angle <= -15){ // attack up
            var dLoc = getLoc(Player.list[target].x,Player.list[target].y+tileSize);
            if(loc[0] !== tLoc[0] || loc[1] > tLoc[1]){
              self.getPath(dLoc[0],dLoc[1]);
            } else {
              self.facing = 'up';
              self.attack('up');
              self.attackCooldown += self.attackrate/self.dexterity;
            }
          } else if(angle > 115 || angle <= -135){ // attack left
            var rLoc = getLoc(Player.list[target].x+tileSize,Player.list[target].y);
            if(loc[0] > tLoc[0] || loc[1] !== tLoc[1]){
              self.getPath(rLoc[0],rLoc[1]);
            } else {
              self.facing = 'left';
              self.attack('left');
              self.attackCooldown += self.attackrate/self.dexterity;
            }
          } else if(angle > -15 || angle <= 45){ // attack right
            var lLoc = getLoc(Player.list[target].x-tileSize,Player.list[target].y);
            if(loc[0] < tLoc[0] || loc[1] !== tLoc[1]){
              self.getPath(lLoc[0],lLoc[1]);
            } else {
              self.facing = 'right';
              self.attack('right');
              self.attackCooldown += self.attackrate/self.dexterity;
            }
          }
        }
      } else if(self.action === 'return'){
        if(self.lastLoc){
          if((self.z === 0 && !self.path) ||
          (self.z === 1 && !self.path1) ||
          (self.z === 2 && !self.path2) ||
          (self.z === -1 && !self.pathU) ||
          (self.z === -2 && !self.pathD)){
            if(loc === self.lastLoc){
              self.action = null;
              self.lastLoc = null;
            } else {
              self.getPath(self.lastLoc[0],self.lastLoc[1]);
            }
          }
        } else {
          var hLoc = getLoc(self.home.x,self.home.y);
          if((self.z === 0 && !self.path) ||
          (self.z === 1 && !self.path1) ||
          (self.z === 2 && !self.path2) ||
          (self.z === -1 && !self.pathU) ||
          (self.z === -2 && !self.pathD)){
            if(loc === hLoc){
              self.action = null;
            } else {
              self.getPath(hLoc[0],hLoc[1]);
            }
          }
        }
        self.checkAggro();
      } else if(self.action === 'flee'){
        var target = self.combat.target;
        var dist = self.getDistance({
          x:Player.list[target].x,
          y:Player.list[target].y
        })
        if(dist > self.aggroRange){
          self.action = null;
        } else {
          self.reposition(target);
        }
      }
      // PATROL
    } else if(self.mode === 'patrol'){
      var loc = getLoc(self.x,self.y);
      if(!self.patrol.bList){
        var list = [];
        for(var i in Building.list){
          var b = Building.list[i];
          if(b.built && b.house === self.house && b.patrolPoint){
            list.push(b.patrolPoint);
          }
        }
        var house = House.list[self.house];
        if(house.patrolPoints){
          for(var i in house.patrolPoints){
            list.push(house.patrolPoints[i]);
          }
        }
        self.patrol.bList = list;
      } else {
        if(!self.action){
          if((self.z === 0 && !self.path) ||
          (self.z === 1 && !self.path1) ||
          (self.z === 2 && !self.path2) ||
          (self.z === -1 && !self.pathU) ||
          (self.z === -2 && !self.pathD)){
            if(self.lastLoc){
              self.action = 'return';
            } else if(!self.patrol.next || self.patrol.next === loc){
              var rand = Math.floor(Math.random() * self.patrol.bList.length);
              var select = self.patrol.bList[rand];
              self.patrol.next = select;
              self.getPath(select[0],select[1]);
            }
          }
          self.checkAggro();
        } else if(self.action === 'combat'){
          var target = self.combat.target;
          var lastLoc = self.lastLoc;
          var lCoords = getCenter(lastLoc[0],lastLoc[1]);
          var lDist = self.getDistance(lCoords[0],lCoords[1]);
          if(!target || (lDist > self.aggroRange*2)){
            self.action = 'return';
          }
          if(self.ranged){
            var dist = self.getDistance({
              x:Player.list[target].x,
              y:Player.list[target].y
            })
            if(self.attackCooldown > 0){
              if(dist < 256){
                self.reposition(target);
              }
            } else {
              if(dist > 256){
                var angle = self.getAngle(Player.list[target].x,Player.list[target].y);
                self.shootArrow(angle);
                self.attackCooldown += self.attackRate/self.dexterity;
              } else {
                self.reposition(target);
              }
            }
          } else {
            var angle = self.getAngle(Player.list[target].x,Player.list[target].y);
            var tLoc = getLoc(Player.list[target].x,Player.list[target].y);

            if(angle > 45 && angle <= 115){ // attack down
              var uLoc = getLoc(Player.list[target].x,Player.list[target].y-tileSize);
              if(loc[0] !== tLoc[0] || loc[1] < uLoc[1]){
                self.getPath(uLoc[0],uLoc[1]);
              } else {
                self.attack('down');
                self.attackCooldown += self.attackrate/self.dexterity;
              }
            } else if(angle > -135 && angle <= -15){ // attack up
              var dLoc = getLoc(Player.list[target].x,Player.list[target].y+tileSize);
              if(loc[0] !== tLoc[0] || loc[1] > tLoc[1]){
                self.getPath(dLoc[0],dLoc[1]);
              } else {
                self.attack('up');
                self.attackCooldown += self.attackrate/self.dexterity;
              }
            } else if(angle > 115 || angle <= -135){ // attack left
              var rLoc = getLoc(Player.list[target].x+tileSize,Player.list[target].y);
              if(loc[0] > tLoc[0] || loc[1] !== tLoc[1]){
                self.getPath(rLoc[0],rLoc[1]);
              } else {
                self.attack('left');
                self.attackCooldown += self.attackrate/self.dexterity;
              }
            } else if(angle > -15 || angle <= 45){ // attack right
              var lLoc = getLoc(Player.list[target].x-tileSize,Player.list[target].y);
              if(loc[0] < tLoc[0] || loc[1] !== tLoc[1]){
                self.getPath(lLoc[0],lLoc[1]);
              } else {
                self.attack('right');
                self.attackCooldown += self.attackrate/self.dexterity;
              }
            }
          }
        } else if(self.action === 'return'){
          if((self.z === 0 && !self.path) ||
          (self.z === 1 && !self.path1) ||
          (self.z === 2 && !self.path2) ||
          (self.z === -1 && !self.pathU) ||
          (self.z === -2 && !self.pathD)){
            if(loc === self.lastLoc){
              self.action = null;
              self.lastLoc = null;
            } else {
              self.getPath(self.lastLoc[0],self.lastLoc[1]);
            }
          }
          self.checkAggro();
        }
      }
      // ESCORT
    } else if(self.mode === 'escort'){
      var target = Player.list[self.escort.target];
      var loc = getLoc(self.x,self.y);
      var tDist = getDistance({x:target.x,y:target.y});
      if(!self.action){
        if((self.z === 0 && !self.path) ||
        (self.z === 1 && !self.path1) ||
        (self.z === 2 && !self.path2) ||
        (self.z === -1 && !self.pathU) ||
        (self.z === -2 && !self.pathD)){
          if(tDist > self.aggroRange){
            var tLoc = getLoc(target.x,target.y);
            var c = tLoc[0];
            var r = tLoc[1];
            var select = [];
            var grid = [[c-2,r-3],[c-1,r-3],[c,r-3],[c+1,r-3],[c+2,r-3],
            [c-3,r-2],[c-2,r-2],[c-1,r-2],[c,r-2],[c+1,r-2],[c+2,r-2],[c+3,r-2],
            [c-3,r-1],[c-2,r-1],[c-1,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],
            [c-3,r],[c-2,r],[c+2,r],[c+3,r],
            [c-3,r+1],[c-2,r+1],[c-1,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],
            [c-3,r+2],[c-2,r+2],[c-1,r+2],[c,r+2],[c+1,r+2],[c+2,r+2],[c+3,r+2],
            [c-2,r+3],[c-1,r+3],[c,r+3],[c+1,r+3],[c+2,r+3]];
            for(var i in grid){
              var tile = grid[i];
              if(tile[0] > -1 && tile[0] < mapSize && tile[1] > -1 && tile[1] < mapSize){
                if(isWalkable(target.z,tile[0],tile[1])){
                  select.push(tile);
                }
              }
            }
            var rand = Math.floor(Math.random() * select.length);
            var dest = select[rand];
            self.getPath(dest[0],dest[1]);
          }
        }
        self.hardAggro();
      } else if(self.action === 'combat'){
        var cTarget = self.combat.target;
        if(!cTarget || tDist > (self.aggroRange*1.5)){
          self.action = 'return';
        }
        if(self.ranged){
          var dist = self.getDistance({
            x:Player.list[cTarget].x,
            y:Player.list[cTarget].y
          })
          if(self.attackCooldown > 0){
            if(dist < 256){
              self.reposition(target);
            }
          } else {
            if(dist > 256){
              var angle = self.getAngle(Player.list[cTarget].x,Player.list[cTarget].y);
              self.shootArrow(angle);
              self.attackCooldown += self.attackRate/self.dexterity;
            } else {
              self.reposition(target);
            }
          }
        } else {
          var angle = self.getAngle(Player.list[cTarget].x,Player.list[cTarget].y);
          var tLoc = getLoc(Player.list[cTarget].x,Player.list[cTarget].y);

          if(angle > 45 && angle <= 115){ // attack down
            var uLoc = getLoc(Player.list[cTarget].x,Player.list[cTarget].y-tileSize);
            if(loc[0] !== tLoc[0] || loc[1] < uLoc[1]){
              self.getPath(uLoc[0],uLoc[1]);
            } else {
              self.attack('down');
              self.attackCooldown += self.attackrate/self.dexterity;
            }
          } else if(angle > -135 && angle <= -15){ // attack up
            var dLoc = getLoc(Player.list[cTarget].x,Player.list[cTarget].y+tileSize);
            if(loc[0] !== tLoc[0] || loc[1] > tLoc[1]){
              self.getPath(dLoc[0],dLoc[1]);
            } else {
              self.attack('up');
              self.attackCooldown += self.attackrate/self.dexterity;
            }
          } else if(angle > 115 || angle <= -135){ // attack left
            var rLoc = getLoc(Player.list[cTarget].x+tileSize,Player.list[cTarget].y);
            if(loc[0] > tLoc[0] || loc[1] !== tLoc[1]){
              self.getPath(rLoc[0],rLoc[1]);
            } else {
              self.attack('left');
              self.attackCooldown += self.attackrate/self.dexterity;
            }
          } else if(angle > -15 || angle <= 45){ // attack right
            var lLoc = getLoc(Player.list[cTarget].x-tileSize,Player.list[cTarget].y);
            if(loc[0] < tLoc[0] || loc[1] !== tLoc[1]){
              self.getPath(lLoc[0],lLoc[1]);
            } else {
              self.attack('right');
              self.attackCooldown += self.attackrate/self.dexterity;
            }
          }
        }
      } else if(self.action === 'return'){
        if((self.z === 0 && !self.path) ||
        (self.z === 1 && !self.path1) ||
        (self.z === 2 && !self.path2) ||
        (self.z === -1 && !self.pathU) ||
        (self.z === -2 && !self.pathD)){
          if(tDist > self.aggroRange){
            var tLoc = getLoc(target.x,target.y);
            var c = tLoc[0];
            var r = tLoc[1];
            var select = [];
            var grid = [[c-2,r-3],[c-1,r-3],[c,r-3],[c+1,r-3],[c+2,r-3],
            [c-3,r-2],[c-2,r-2],[c-1,r-2],[c,r-2],[c+1,r-2],[c+2,r-2],[c+3,r-2],
            [c-3,r-1],[c-2,r-1],[c-1,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],
            [c-3,r],[c-2,r],[c+2,r],[c+3,r],
            [c-3,r+1],[c-2,r+1],[c-1,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],
            [c-3,r+2],[c-2,r+2],[c-1,r+2],[c,r+2],[c+1,r+2],[c+2,r+2],[c+3,r+2],
            [c-2,r+3],[c-1,r+3],[c,r+3],[c+1,r+3],[c+2,r+3]];
            for(var i in grid){
              var tile = grid[i];
              if(tile[0] > -1 && tile[0] < mapSize && tile[1] > -1 && tile[1] < mapSize){
                if(isWalkable(target.z,tile[0],tile[1])){
                  select.push(tile);
                }
              }
            }
            var rand = Math.floor(Math.random() * select.length);
            var dest = select[rand];
            self.getPath(dest[0],dest[1]);
          } else {
            self.action = null;
          }
        }
      }
      // SCOUT
    } else if(self.mode === 'scout'){
      var loc = getLoc(self.x,self.y);
      var dest = self.scout.target;
      if(!self.scout.enemyBuilding){

      }
      if(!self.action){
        if((self.z === 0 && !self.path) ||
        (self.z === 1 && !self.path1) ||
        (self.z === 2 && !self.path2) ||
        (self.z === -1 && !self.pathU) ||
        (self.z === -2 && !self.pathD)){
          if(loc === dest){
            self.action = 'flee';
          }
        }
      } else if(self.action === 'combat'){
        self.combat.target = null;
        self.action = 'flee';
      } else if(self.action === 'flee'){
        if((self.z === 0 && !self.path) ||
        (self.z === 1 && !self.path1) ||
        (self.z === 2 && !self.path2) ||
        (self.z === -1 && !self.pathU) ||
        (self.z === -2 && !self.pathD)){
          var ret = self.scout.return;
          if(loc === ret){
            self.mode = 'idle';
          } else {
            self.getPath(ret[0],ret[1]);
          }
        }
      }
    } else if(self.mode === 'guard'){
      var point = self.guard.point;
      var pCoord = getCenter(point[0],point[1]);
      var pDist = self.getDistance({
        x:pCoord[0],
        y:pCoord[1]
      });
      if(!self.action){
        if((self.z === 0 && !self.path) ||
        (self.z === 1 && !self.path1) ||
        (self.z === 2 && !self.path2) ||
        (self.z === -1 && !self.pathU) ||
        (self.z === -2 && !self.pathD)){
          if(loc !== point){
            self.getPath(point[0],point[1]);
          }
        }
        self.hardAggro();
      } else if(self.action === 'combat'){
        var target = self.combat.target;
        if(!target || pDist > (self.aggroRange*1.5)){
          self.action = 'return';
        }
        if(self.ranged){
          var dist = self.getDistance({
            x:Player.list[target].x,
            y:Player.list[target].y
          })
          if(self.attackCooldown > 0){
            if(dist < 256){
              self.reposition(target);
            }
          } else {
            if(dist > 256){
              var angle = self.getAngle(Player.list[target].x,Player.list[target].y);
              self.shootArrow(angle);
              self.attackCooldown += self.attackRate/self.dexterity;
            } else {
              self.reposition(target);
            }
          }
        } else {
          var angle = self.getAngle(Player.list[target].x,Player.list[target].y);
          var tLoc = getLoc(Player.list[target].x,Player.list[target].y);

          if(angle > 45 && angle <= 115){ // attack down
            var uLoc = getLoc(Player.list[target].x,Player.list[target].y-tileSize);
            if(loc[0] !== tLoc[0] || loc[1] < uLoc[1]){
              self.getPath(uLoc[0],uLoc[1]);
            } else {
              self.attack('down');
              self.attackCooldown += self.attackrate/self.dexterity;
            }
          } else if(angle > -135 && angle <= -15){ // attack up
            var dLoc = getLoc(Player.list[target].x,Player.list[target].y+tileSize);
            if(loc[0] !== tLoc[0] || loc[1] > tLoc[1]){
              self.getPath(dLoc[0],dLoc[1]);
            } else {
              self.attack('up');
              self.attackCooldown += self.attackrate/self.dexterity;
            }
          } else if(angle > 115 || angle <= -135){ // attack left
            var rLoc = getLoc(Player.list[target].x+tileSize,Player.list[target].y);
            if(loc[0] > tLoc[0] || loc[1] !== tLoc[1]){
              self.getPath(rLoc[0],rLoc[1]);
            } else {
              self.attack('left');
              self.attackCooldown += self.attackrate/self.dexterity;
            }
          } else if(angle > -15 || angle <= 45){ // attack right
            var lLoc = getLoc(Player.list[target].x-tileSize,Player.list[target].y);
            if(loc[0] < tLoc[0] || loc[1] !== tLoc[1]){
              self.getPath(lLoc[0],lLoc[1]);
            } else {
              self.attack('right');
              self.attackCooldown += self.attackrate/self.dexterity;
            }
          }
        }
      } else if(self.action === 'return'){
        if((self.z === 0 && !self.path) ||
        (self.z === 1 && !self.path1) ||
        (self.z === 2 && !self.path2) ||
        (self.z === -1 && !self.pathU) ||
        (self.z === -2 && !self.pathD)){
          if(loc !== point){
            self.getPath(point[0],point[1]);
          }
        }
        self.hardAggro();
      }
      // RAID
    } else if(self.mode === 'raid'){
      var loc = getLoc(self.x,self.y);
      var dest = self.raid.target;
      var dCoords = getCoords(dest[0],dest[1]);
      var dDist = self.getDistance(dCoords[0],dCoords[1]);
      if(!self.action){
        if((self.z === 0 && !self.path) ||
        (self.z === 1 && !self.path1) ||
        (self.z === 2 && !self.path2) ||
        (self.z === -1 && !self.pathU) ||
        (self.z === -2 && !self.pathD)){
          if(dDist > self.aggroRange){
            var c = dest[0];
            var r = dest[1];
            var select = [];
            var grid = [[c-2,r-3],[c-1,r-3],[c,r-3],[c+1,r-3],[c+2,r-3],
            [c-3,r-2],[c-2,r-2],[c-1,r-2],[c,r-2],[c+1,r-2],[c+2,r-2],[c+3,r-2],
            [c-3,r-1],[c-2,r-1],[c-1,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],
            [c-3,r],[c-2,r],[c+2,r],[c+3,r],
            [c-3,r+1],[c-2,r+1],[c-1,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],
            [c-3,r+2],[c-2,r+2],[c-1,r+2],[c,r+2],[c+1,r+2],[c+2,r+2],[c+3,r+2],
            [c-2,r+3],[c-1,r+3],[c,r+3],[c+1,r+3],[c+2,r+3]];
            for(var i in grid){
              var tile = grid[i];
              if(tile[0] > -1 && tile[0] < mapSize && tile[1] > -1 && tile[1] < mapSize){
                if(isWalkable(0,tile[0],tile[1])){
                  select.push(tile);
                }
              }
            }
            var rand = Math.floor(Math.random() * select.length);
            var dest = select[rand];
            self.getPath(dest[0],dest[1]);
          }
        }
        self.checkAggro();
      } else if(self.action === 'combat'){
        var target = self.combat.target;
        var lastLoc = self.lastLoc;
        var lCoords = getCenter(lastLoc[0],lastLoc[1]);
        var lDist = self.getDistance(lCoords[0],lCoords[1]);
        if(!target || (lDist > self.aggroRange*4)){
          self.action = 'return';
        }
        if(self.ranged){
          var dist = self.getDistance({
            x:Player.list[target].x,
            y:Player.list[target].y
          })
          if(self.attackCooldown > 0){
            if(dist < 256){
              self.reposition(target);
            }
          } else {
            if(dist > 256){
              var angle = self.getAngle(Player.list[target].x,Player.list[target].y);
              self.shootArrow(angle);
              self.attackCooldown += self.attackRate/self.dexterity;
            } else {
              self.reposition(target);
            }
          }
        } else {
          var angle = self.getAngle(Player.list[target].x,Player.list[target].y);
          var tLoc = getLoc(Player.list[target].x,Player.list[target].y);

          if(angle > 45 && angle <= 115){ // attack down
            var uLoc = getLoc(Player.list[target].x,Player.list[target].y-tileSize);
            if(loc[0] !== tLoc[0] || loc[1] < uLoc[1]){
              self.getPath(uLoc[0],uLoc[1]);
            } else {
              self.attack('down');
              self.attackCooldown += self.attackrate/self.dexterity;
            }
          } else if(angle > -135 && angle <= -15){ // attack up
            var dLoc = getLoc(Player.list[target].x,Player.list[target].y+tileSize);
            if(loc[0] !== tLoc[0] || loc[1] > tLoc[1]){
              self.getPath(dLoc[0],dLoc[1]);
            } else {
              self.attack('up');
              self.attackCooldown += self.attackrate/self.dexterity;
            }
          } else if(angle > 115 || angle <= -135){ // attack left
            var rLoc = getLoc(Player.list[target].x+tileSize,Player.list[target].y);
            if(loc[0] > tLoc[0] || loc[1] !== tLoc[1]){
              self.getPath(rLoc[0],rLoc[1]);
            } else {
              self.attack('left');
              self.attackCooldown += self.attackrate/self.dexterity;
            }
          } else if(angle > -15 || angle <= 45){ // attack right
            var lLoc = getLoc(Player.list[target].x-tileSize,Player.list[target].y);
            if(loc[0] < tLoc[0] || loc[1] !== tLoc[1]){
              self.getPath(lLoc[0],lLoc[1]);
            } else {
              self.attack('right');
              self.attackCooldown += self.attackrate/self.dexterity;
            }
          }
        }
      } else if(self.action === 'return'){
        if((self.z === 0 && !self.path) ||
        (self.z === 1 && !self.path1) ||
        (self.z === 2 && !self.path2) ||
        (self.z === -1 && !self.pathU) ||
        (self.z === -2 && !self.pathD)){
          if(loc === self.lastLoc){
            self.action = null;
            self.lastLoc = null;
          } else {
            self.getPath(self.lastLoc[0],self.lastLoc[1]);
          }
        }
        self.checkAggro();
      } else if(self.action === 'flee'){
        if((self.z === 0 && !self.path) ||
        (self.z === 1 && !self.path1) ||
        (self.z === 2 && !self.path2) ||
        (self.z === -1 && !self.pathU) ||
        (self.z === -2 && !self.pathD)){
          var ret = self.home;
          if(loc === [ret[1],ret[2]]){
            self.mode = 'idle';
          } else {
            self.getPath(ret[1],ret[2]);
          }
        }
      }
    }
    self.updatePosition();
  }

  self.getPath = function(c,r){ // add z consideration for 3D pathing
    var start = getLoc(self.x,self.y);
    if(self.z === 0 && getLocTile(0,self.x,self.y) === 0){
      var gridSb = gridS.clone();
      var path = finder.findPath(start[0], start[1], c, r, gridSb);
      self.path = path;
    } else if(self.z === 0){
      var gridOb = gridO.clone();
      var path = finder.findPath(start[0], start[1], c, r, gridOb);
      self.path = path;
    } else if(self.z === -1){
      var gridUb = gridU.clone();
      var path = finder.findPath(start[0], start[1], c, r, gridUb);
      self.pathU = path;
    } else if(self.z === -2){
      var gridB3b = gridB3.clone();
      var path = finder.findPath(start[0], start[1], c, r, gridB3b);
      self.pathD = path;
    } else if(self.z === 1){
      var gridB1b = gridB1.clone();
      var path = finder.findPath(start[0], start[1], c, r, gridB1b);
      self.path1 = path;
    } else if(self.z === 2){
      var gridB2b = gridB2.clone();
      var path = finder.findPath(start[0], start[1], c, r, gridB2b);
      self.path2 = path;
    }
  }

  self.updatePosition = function(){
    if(self.z === 0 && self.path){
      var len = self.path.length;
      if(self.pathCount < len){
        var dest = getCenter(self.path[self.pathCount][0],self.path[self.pathCount][1]);
        var dx = dest[0];
        var dy = dest[1];
        var diffX = dx - self.x;
        var diffY = dy - self.y;

        if(diffX >= self.maxSpd){
          self.x += self.maxSpd;
          self.pressingRight = true;
          self.facing = 'right';
        } else if(diffX <= (0-self.maxSpd)){
          self.x -= self.maxSpd;
          self.pressingLeft = true;
          self.facing = 'left';
        }
        if(diffY >= self.maxSpd){
          self.y += self.maxSpd;
          self.pressingDown = true;
          self.facing = 'down';
        } else if(diffY <= (0-self.maxSpd)){
          self.y -= self.maxSpd;
          self.pressingUp = true;
          self.facing = 'up';
        }
        if((diffX < self.maxSpd && diffX > (0-self.maxSpd)) && (diffY < self.maxSpd && diffY > (0-self.maxSpd))){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
          self.pathCount++;
        }
      } else {
        self.path = null;
        self.pathCount = 0;
      }
    } else if(self.z === 1 && self.path1){
      var len = self.path1.length;
      if(self.pathCount < len){
        var dest = getCenter(self.path1[self.pathCount][0],self.path1[self.pathCount][1]);
        var dx = dest[0];
        var dy = dest[1];
        var diffX = dx - self.x;
        var diffY = dy - self.y;

        if(diffX >= self.maxSpd){
          self.x += self.maxSpd;
          self.pressingRight = true;
          self.facing = 'right';
        } else if(diffX <= (0-self.maxSpd)){
          self.x -= self.maxSpd;
          self.pressingLeft = true;
          self.facing = 'left';
        }
        if(diffY >= self.maxSpd){
          self.y += self.maxSpd;
          self.pressingDown = true;
          self.facing = 'down';
        } else if(diffY <= (0-self.maxSpd)){
          self.y -= self.maxSpd;
          self.pressingUp = true;
          self.facing = 'up';
        }
        if((diffX < self.maxSpd && diffX > (0-self.maxSpd)) && (diffY < self.maxSpd && diffY > (0-self.maxSpd))){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
          self.pathCount++;
        }
      } else {
        self.path1 = null;
        self.pathCount = 0;
      }
    } else if(self.z === 2 && self.path2){
      var len = self.path2.length;
      if(self.pathCount < len){
        var dest = getCenter(self.path2[self.pathCount][0],self.path2[self.pathCount][1]);
        var dx = dest[0];
        var dy = dest[1];
        var diffX = dx - self.x;
        var diffY = dy - self.y;

        if(diffX >= self.maxSpd){
          self.x += self.maxSpd;
          self.pressingRight = true;
          self.facing = 'right';
        } else if(diffX <= (0-self.maxSpd)){
          self.x -= self.maxSpd;
          self.pressingLeft = true;
          self.facing = 'left';
        }
        if(diffY >= self.maxSpd){
          self.y += self.maxSpd;
          self.pressingDown = true;
          self.facing = 'down';
        } else if(diffY <= (0-self.maxSpd)){
          self.y -= self.maxSpd;
          self.pressingUp = true;
          self.facing = 'up';
        }
        if((diffX < self.maxSpd && diffX > (0-self.maxSpd)) && (diffY < self.maxSpd && diffY > (0-self.maxSpd))){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
          self.pathCount++;
        }
      } else {
        self.path2 = null;
        self.pathCount = 0;
      }
    } else if(self.z === -1 && self.pathU){
      var len = self.pathU.length;
      if(self.pathCount < len){
        var dest = getCenter(self.pathU[self.pathCount][0],self.pathU[self.pathCount][1]);
        var dx = dest[0];
        var dy = dest[1];
        var diffX = dx - self.x;
        var diffY = dy - self.y;

        if(diffX >= self.maxSpd){
          self.x += self.maxSpd;
          self.pressingRight = true;
          self.facing = 'right';
        } else if(diffX <= (0-self.maxSpd)){
          self.x -= self.maxSpd;
          self.pressingLeft = true;
          self.facing = 'left';
        }
        if(diffY >= self.maxSpd){
          self.y += self.maxSpd;
          self.pressingDown = true;
          self.facing = 'down';
        } else if(diffY <= (0-self.maxSpd)){
          self.y -= self.maxSpd;
          self.pressingUp = true;
          self.facing = 'up';
        }
        if((diffX < self.maxSpd && diffX > (0-self.maxSpd)) && (diffY < self.maxSpd && diffY > (0-self.maxSpd))){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
          self.pathCount++;
        }
      } else {
        self.pathU = null;
        self.pathCount = 0;
      }
    } else if(self.z === -2 && self.pathD){
      var len = self.pathD.length;
      if(self.pathCount < len){
        var dest = getCenter(self.pathD[self.pathCount][0],self.pathD[self.pathCount][1]);
        var dx = dest[0];
        var dy = dest[1];
        var diffX = dx - self.x;
        var diffY = dy - self.y;

        if(diffX >= self.maxSpd){
          self.x += self.maxSpd;
          self.pressingRight = true;
          self.facing = 'right';
        } else if(diffX <= (0-self.maxSpd)){
          self.x -= self.maxSpd;
          self.pressingLeft = true;
          self.facing = 'left';
        }
        if(diffY >= self.maxSpd){
          self.y += self.maxSpd;
          self.pressingDown = true;
          self.facing = 'down';
        } else if(diffY <= (0-self.maxSpd)){
          self.y -= self.maxSpd;
          self.pressingUp = true;
          self.facing = 'up';
        }
        if((diffX < self.maxSpd && diffX > (0-self.maxSpd)) && (diffY < self.maxSpd && diffY > (0-self.maxSpd))){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
          self.pathCount++;
        }
      } else {
        self.pathD = null;
        self.pathCount = 0;
      }
    } else {
      return;
    }
  }

  self.getInitPack = function(){
    return {
      type:self.type,
      name:self.name,
      id:self.id,
      house:self.house,
      kingdom:self.kingdom,
      x:self.x,
      y:self.y,
      z:self.z,
      class:self.class,
      rank:self.rank,
      friends:self.friends,
      enemies:self.enemies,
      spriteSize:self.spriteSize,
      innaWoods:self.innaWoods,
      facing:self.facing,
      stealthed:self.stealthed,
      ranged:self.ranged,
      visible:self.visible,
      hp:self.hp,
      hpMax:self.hpMax,
      spirit:self.spirit,
      spiritMax:self.spiritMax
    }
  }

  self.getUpdatePack = function(){
    return {
      name:self.name,
      id:self.id,
      house:self.house,
      kingdom:self.kingdom,
      x:self.x,
      y:self.y,
      z:self.z,
      class:self.class,
      rank:self.rank,
      friends:self.friends,
      enemies:self.enemies,
      spriteSize:self.spriteSize,
      innaWoods:self.innaWoods,
      facing:self.facing,
      stealthed:self.stealthed,
      ranged:self.ranged,
      visible:self.visible,
      pressingUp:self.pressingUp,
      pressingDown:self.pressingDown,
      pressingLeft:self.pressingLeft,
      pressingRight:self.pressingRight,
      pressingAttack:self.pressingAttack,
      working:self.working,
      chopping:self.chopping,
      mining:self.mining,
      farming:self.farming,
      building:self.building,
      fishing:self.fishing,
      hp:self.hp,
      hpMax:self.hpMax,
      spirit:self.spirit,
      spiritMax:self.spiritMax
    }
  }

  Player.list[self.id] = self;

  initPack.player.push(self.getInitPack());
  return self;
}

// FAUNA

Sheep = function(param){
  var self = Character(param);
  self.class = 'Sheep';
}

Deer = function(param){
  var self = Character(param);
  self.class = 'Deer';
  self.baseSpd = 7;
}

Boar = function(param){
  var self = Character(param);
  self.class = 'Boar';
  self.baseSpd = 5;
}

Wolf = function(param){
  var self = Character(param);
  self.class = 'Wolf';
  self.baseSpd = 6;
}

Falcon = function(param){
  var self = Character(param);
  self.class = 'Falcon';
  self.falconry = param.falconry;
  self.hp = null;
  self.baseSpd = 3;
  self.maxSpd = 3;
  self.spriteSize = tileSize*7;
  self.update = function(){
    if(!self.path){
      if(!self.falconry){
        self.path = randomSpawnO();
      }
    } else {
      var dx = self.path[0];
      var dy = self.path[1];
      var diffX = dx - self.x;
      var diffY = dy - self.y;

      if(diffX >= self.maxSpd && diffY >= self.maxSpd){
        self.x += self.maxSpd;
        self.y += self.maxSpd;
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
        self.x += self.maxSpd;
        self.y -= self.maxSpd;
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
        self.x -= self.maxSpd;
        self.y += self.maxSpd;
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
        self.x -= self.maxSpd;
        self.y -= self.maxSpd;
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
        self.x += self.maxSpd;
        self.pressingRight = true;
        self.pressingLeft = false;
        self.pressingDown = false;
        self.pressingUp = false;
        self.facing = 'right';
      } else if(diffX <= (0-self.maxSpd)){
        self.x -= self.maxSpd;
        self.pressingRight = false;
        self.pressingLeft = true;
        self.pressingDown = false;
        self.pressingUp = false;
        self.facing = 'left';
      } else if(diffY >= self.maxSpd){
        self.y += self.maxSpd;
        self.pressingRight = false;
        self.pressingLeft = false;
        self.pressingDown = true;
        self.pressingUp = false;
        self.facing = 'down';
      } else if(diffY <= (0-self.maxSpd)){
        self.y -= self.maxSpd;
        self.pressingRight = false;
        self.pressingLeft = false;
        self.pressingDown = false;
        self.pressingUp = true;
        self.facing = 'up';
      } else {
        if(!self.falconry){
          self.path = randomSpawnO();
        }
      }
    }
  }
}

// UNITS

SerfM = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'SerfM';
  self.spriteSize = tileSize*1.5;
}

SerfF = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'SerfF';
  self.spriteSize = tileSize*1.5;
}

Innkeeper = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'Innkeeper';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
}

Monk = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'Monk';
  self.cleric = true;
  self.baseSpd = 2;
}

Bishop = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'Bishop';
  self.rank = '♝ ';
  self.cleric = true;
  self.baseSpd = 2;
}

Friar = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'Friar';
  self.spriteSize = tileSize*1.5;
  self.mounted = true;
  self.cleric = true;
  self.baseSpd = 2;
}

Shipwright = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'Shipwright';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
}

Footsoldier = function(param){
  var self = Character(param);
  self.name = 'Footsoldier';
  self.class = 'Footsoldier';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3.5;
}

Skirmisher = function(param){
  var self = Character(param);
  self.name = 'Skirmisher';
  self.class = 'Skirmisher';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3.5;
}

Cavalier = function(param){
  var self = Character(param);
  self.name = 'Cavalier';
  self.class = 'Cavalier';
  self.rank = '♞ ';
  self.spriteSize = tileSize*1.5;
  self.mounted = true;
  self.baseSpd = 6.5;
}

General = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'General';
  self.rank = '♜ ';
  self.spriteSize = tileSize*2;
  self.mounted = true;
  self.baseSpd = 6.5;
}

Warden = function(param){
  var self = Character(param);
  self.name = 'Warden';
  self.class = 'Warden';
  self.rank = '♞ ';
  self.spriteSize = tileSize*2;
  self.mounted = true;
  self.ranged = true;
  self.baseSpd = 7;
}

SwissGuard = function(param){
  var self = Character(param);
  self.name = 'Swiss Guard';
  self.class = 'SwissGuard';
  self.spriteSize = tileSize*2;
}

Hospitaller = function(param){
  var self = Character(param);
  self.name = 'Hospitaller';
  self.class = 'Hospitaller';
  self.rank = '♞ ';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
}

ImperialKnight = function(param){
  var self = Character(param);
  self.name = 'Imperial Knight';
  self.class = 'ImperialKnight';
  self.rank = '♞ ';
  self.mounted = true;
  self.baseSpd = 6;
  self.spriteSize = tileSize*3;
}

Trebuchet = function(param){
  var self = Character(param);
  self.class = 'Trebuchet';
  self.spriteSize = tileSize*10;
  self.ranged = true;
}

BombardCannon = function(param){
  var self = Character(param);
  self.class = 'BombardCannon';
  self.baseSpd = 2;
  self.ranged = true;
}

TradeCart = function(param){
  var self = Character(param);
  self.class = 'TradeCart';
  self.mounted = true;
  self.baseSpd = 2;
}

Merchant = function(param){
  var self = Character(param);
  self.class = 'Merchant';
  self.baseSpd = 2;
}

FishingBoat = function(param){
  var self = Character(param);
  self.class = 'FishingBoat';
}

CargoShip = function(param){
  var self = Character(param);
  self.class = 'CargoShip';
}

Longship = function(param){
  var self = Character(param);
  self.class = 'Longship';
  self.rank = '♞ ';
  self.ranged = true;
}

Caravel = function(param){
  var self = Character(param);
  self.class = 'Caravel';
  self.ranged = true;
}

Galleon = function(param){
  var self = Character(param);
  self.class = 'Galleon';
  self.rank = '♜ ';
  self.ranged = true;
}

// ENEMIES

Brother = function(param){
  var self = Character(param);
  self.name = 'Brother';
  self.class = 'Brother';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3.5;
}

Oathkeeper = function(param){
  var self = Character(param);
  self.name = 'Oathkeeper';
  self.class = 'Oathkeeper';
  self.rank = '♝ ';
  self.spriteSize = tileSize*1.5;
  self.cleric = true;
  self.baseSpd = 3.5;
}

DarkEntity = function(param){
  var self = Character(param);
  self.class = 'DarkEntity';
  self.spriteSize = tileSize*1.5;
}

Apollyon = function(param){
  var self = Character(param);
  self.name = 'APOLLYON';
  self.class = 'Apollyon';
  self.rank = '♚ ';
  self.house = 'City of Destruction';
}

Goth = function(param){
  var self = Character(param);
  self.name = 'Goth';
  self.class = 'Goth';
  self.spriteSize = tileSize*1.5;
}

Cataphract = function(param){
  var self = Character(param);
  self.name = 'Cataphract';
  self.class = 'Cataphract';
  self.rank = '♞ ';
  self.mounted = true;
  self.spriteSize = tileSize*3;
  self.baseSpd = 6;
}

Acolyte = function(param){
  var self = Character(param);
  self.name = 'Acolyte';
  self.class = 'Acolyte';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3.5;
}

HighPriestess = function(param){
  var self = Character(param);
  self.name = 'High Priestess';
  self.class = 'HighPriestess';
  self.rank = '♝ ';
  self.spriteSize = tileSize*1.5;
  self.cleric = true;
  self.baseSpd = 3.5;
}

Archmage = function(param){
  var self = Character(param);
  self.name = 'Archmage';
  self.class = 'Archmage';
  self.rank = '♝ ';
  self.cleric = true;
  self.baseSpd = 2;
}

NorseShip = function(param){
  var self = Character(param);
  self.name = 'Norse Longship';
  self.class = 'NorseShip';
  self.ranged = true;
}

NorseSword = function(param){
  var self = Character(param);
  self.name = 'Norseman';
  self.class = 'NorseSword';
  self.spriteSize = tileSize*1.5;
}

NorseSpear = function(param){
  var self = Character(param);
  self.name = 'Norseman';
  self.class = 'NorseSpear';
  self.spriteSize = tileSize*1.5;
}

Huskarl = function(param){
  var self = Character(param);
  self.name = 'Huskarl';
  self.class = 'Huskarl';
  self.rank = '♞ ';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
}

FrankSword = function(param){
  var self = Character(param);
  self.name = 'Frank';
  self.class = 'FrankSword';
}

FrankSpear = function(param){
  var self = Character(param);
  self.name = 'Frank';
  self.class = 'FrankSpear';
  self.spriteSize = tileSize*2;
}

FrankBow = function(param){
  var self = Character(param);
  self.name = 'Frank';
  self.class = 'FrankBow';
  self.spriteSize = tileSize*1.5;
  self.ranged = true;
}

Mangonel = function(param){
  var self = Character(param);
  self.name = 'Mangonel';
  self.class = 'Mangonel';
  self.baseSpd = 2;
  self.spriteSize = tileSize*2;
  self.ranged = true;
}

Carolingian = function(param){
  var self = Character(param);
  self.name = 'Carolingian';
  self.class = 'Carolingian';
  self.rank = '♞ ';
  self.mounted = true;
  self.baseSpd = 6;
  self.spriteSize = tileSize*3;
}

Malvoisin = function(param){
  var self = Character(param);
  self.name = 'Malvoisin';
  self.class = 'Malvoisin';
  self.rank = '♜ ';
  self.spriteSize = tileSize*12;
  self.ranged = true;
}

Charlemagne = function(param){
  var self = Character(param);
  self.name = 'King Charlemagne';
  self.class = 'Charlemagne';
  self.rank = '♚ ';
  self.mounted = true;
  self.baseSpeed = 6;
  self.spriteSize = tileSize*3;
}

CeltAxe = function(param){
  var self = Character(param);
  self.name = 'Celt';
  self.class = 'CeltAxe';
  self.spriteSize = tileSize*1.5;
}

CeltSpear = function(param){
  var self = Character(param);
  self.name = 'Celt';
  self.class = 'CeltSpear';
  self.spriteSize = tileSize*2;
}

Headhunter = function(param){
  var self = Character(param);
  self.name = 'Headhunter';
  self.class = 'Headhunter';
  self.rank = '♞ ';
  self.baseSpd = 7;
  self.mounted = true;
  self.spriteSize = tileSize*2;
}

Druid = function(param){
  var self = Character(param);
  self.name = 'Druid';
  self.class = 'Druid';
  self.rank = '♝ ';
  self.spriteSize = tileSize*1.5;
  self.cleric = true;
  self.baseSpd = 2;
}

Morrigan = function(param){
  var self = Character(param);
  self.name = 'Morrigan';
  self.class = 'Morrigan';
  self.rank = '♜ ';
  self.mounted = true;
  self.baseSpd = 6;
  self.spriteSize = tileSize*2;
}

Gwenllian = function(param){
  var self = Character(param);
  self.name = 'Queen Gwenllian';
  self.class = 'Gwenllian';
  self.rank = '♛ ';
}

TeutonPike = function(param){
  var self = Character(param);
  self.name = 'Teuton';
  self.class = 'TeutonPike';
  self.spriteSize = tileSize*2;
}

TeutonBow = function(param){
  var self = Character(param);
  self.name = 'Teuton';
  self.class = 'TeutonBow';
  self.spriteSize = tileSize*1.5;
  self.ranged = true;
}

TeutonicKnight = function(param){
  var self = Character(param);
  self.name = 'Teutonic Knight';
  self.class = 'TeutonicKnight';
  self.rank = '♞ ';
  self.mounted = true;
  self.baseSpd = 6;
  self.spriteSize = tileSize*3;
}

Prior = function(param){
  var self = Character(param);
  self.name = 'Prior';
  self.class = 'Prior';
  self.cleric = true;
  self.baseSpd = 2;
}

Duke = function(param){
  var self = Character(param);
  self.name = 'Duke';
  self.class = 'Duke';
  self.rank = '♝ ';
  self.spriteSize = tileSize*1.5;
  self.cleric = true;
  self.baseSpd = 3.5;
}

Hochmeister = function(param){
  var self = Character(param);
  self.name = 'Hochmeister';
  self.class = 'Hochmeister';
  self.rank = '♜ ';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
}

Lothair = function(param){
  var self = Character(param);
  self.name = 'King Lothair II';
  self.class = 'Lothair';
  self.rank = '♚ ';
}

Trapper = function(param){
  var self = Character(param);
  self.name = 'Trapper';
  self.class = 'Trapper';
  self.spriteSize = tileSize*1.5;
}

Outlaw = function(param){
  var self = Character(param);
  self.name = 'Outlaw';
  self.class = 'Outlaw';
  self.spriteSize = tileSize*1.5;
  self.ranged = true;
}

Poacher = function(param){
  var self = Character(param);
  self.name = 'Poacher';
  self.class = 'Poacher';
  self.rank = '♞ ';
  self.mounted = true;
  self.baseSpd = 7;
  self.spriteSize = tileSize*2;
  self.ranged = true;
}

Cutthroat = function(param){
  var self = Character(param);
  self.name = 'Cutthroat';
  self.class = 'Cutthroat';
  self.spriteSize = tileSize*1.5;
}

Strongman = function(param){
  var self = Character(param);
  self.name = 'Strongman';
  self.class = 'Strongman';
  self.spriteSize = tileSize*2;
  self.baseSpd = 3.5;
}

Marauder = function(param){
  var self = Character(param);
  self.name = 'Marauder';
  self.class = 'Marauder';
  self.rank = '♞ ';
  self.mounted = true;
  self.baseSpd = 6;
  self.spriteSize = tileSize*3;
}

Condottiere = function(param){
  var self = Character(param);
  self.name = 'Condottiere';
  self.class = 'Condottiere';
  self.rank = '♜ ';
  self.mounted = true;
  self.baseSpd = 6.5;
  self.spriteSize = tileSize*2;
  self.ranged = true;
}

// PLAYER
Player = function(param){
  var self = Character(param);
  self.type = 'player';
  self.name = param.name;
  self.gear = {
    head:null,
    armor:null,
    weapon:null,
    weapon2:null,
    accessory:null
  }
  self.hasHorse = false;
  self.spriteSize = tileSize*1.5;
  self.knighted = false;
  self.crowned = false;
  self.title = '';
  self.friendlyfire = false;
  self.pressingE = false;
  self.pressingT = false;
  self.pressingI = false;
  self.pressingP = false;
  self.pressingF = false;
  self.pressingH = false;
  self.pressingK = false;
  self.pressingL = false;
  self.pressingX = false;
  self.pressingC = false;
  self.pressingB = false;
  self.pressingN = false;
  self.pressingM = false;
  self.pressing1 = false;
  self.pressing2 = false;
  self.pressing3 = false;
  self.pressing4 = false;
  self.pressing5 = false;
  self.pressing6 = false;
  self.pressing7 = false;
  self.pressing8 = false;
  self.pressing9 = false;
  self.pressing0 = false;
  self.mouseAngle = 0;
  self.mountCooldown = 0;
  self.switchCooldown = 0;
  self.hpNat = 100;
  self.spiritNat = 100;
  self.spirit = 100;
  self.spiritMax = 100;
  self.breath = 100;
  self.breathMax = 100;
  self.strength = 10; // ALPHA
  self.dexterity = 1;

  self.stores = {
    grain:0,
    wood:0,
    stone:0,
    iron:0,
    silver:0,
    gold:0
  }

  self.update = function(){
    self.updateSpd();

    if(self.actionCooldown > 0){
      self.actionCooldown--;
    }

    if(self.attackCooldown > 0){
      self.attackCooldown--;
    }

    if(self.mountCooldown > 0){
      self.mountCooldown--;
    }

    if(self.switchCooldown > 0){
      self.switchCooldown--;
    }

    if(self.pressingAttack && self.gear.weapon && self.attackCooldown === 0 && self.z !== -3){
      if(self.gear.weapon.type === 'bow'){
        self.shootArrow(self.mouseAngle);
        self.attackCooldown += self.gear.weapon.attackrate/self.dexterity;
      } else {
        self.attack(self.facing);
        self.attackCooldown += self.gear.weapon.attackrate/self.dexterity;
      }
    }

    // TORCH
    if(self.pressingT && self.actionCooldown === 0){
      self.lightTorch(Math.random());
      self.actionCooldown = 10;
    }

    // INSPECT

    // PICKUP
    if(self.pressingP && self.actionCooldown === 0 && !self.working){
      var socket = SOCKET_LIST[self.id];
      self.actionCooldown = 10;
      for(var i in Item.list){
        var item = Item.list[i];
        var dist = item.getDistance({x:self.x,y:self.y});
        if(dist < tileSize && item.canPickup){
          Item.list[i].pickup(self.id);
          return;
        } else {
          continue;
        }
      }
      socket.emit('addToChat','<i>There is nothing to pick up.</i>');
    }

    // HORSE
    if(self.pressingH && self.actionCooldown === 0 && !self.working){
      var socket = SOCKET_LIST[self.id];
      if(self.hasHorse){
        if(self.mounted){
          self.actionCooldown = 10;
          self.mounted = false;
          self.baseSpd -= 3;
          self.mountCooldown = 200;
        } else {
          if(self.gear.armor && self.gear.armor.type !== 'cloth'){
            if(self.mountCooldown === 0){
              self.actionCooldown = 10;
              self.mounted = true;
              self.baseSpd += 3;
            } else {
              socket.emit('addToChat','<i>Try again shortly.</i>');
            }
          } else {
            socket.emit('addToChat','<i>You are not wearing any riding gear.</i>');
          }
        }
      } else {
        socket.emit('addToChat','<i>You do not own a horse.</i>');
      }
    }

    // SWITCH WEAPONS
    if(self.pressingX && self.actionCooldown === 0){
      var socket = SOCKET_LIST[self.id];
      if(self.switchCooldown === 0){
        if(self.gear.weapon){
          if(self.gear.weapon2){
            var switchwep = self.gear.weapon2;
            self.gear.weapon2 = self.gear.weapon;
            self.gear.weapon = switchwep;
            self.actionCooldown = 10;
            socket.emit('addToChat','<i>You switch weapons to </i><b>' + self.gear.weapon.name + '</b>.');
          } else {
            socket.emit('addToChat','<i>You have no secondary weapon equipped.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You have no weapons equipped.</i>');
        }
      } else {
        socket.emit('addToChat','<i>Try again shortly.</i>');
      }
    }

    // BAG
    if(self.pressingB && self.actionCooldown === 0){
      self.actionCooldown += 10;
      var socket = SOCKET_LIST[self.id];
      var all = '';
      if(self.keys.length > 0){
        var keys = '<b>Keys</b>: ' + self.keys.length + '<br>';
        all += keys;
      }
      if(self.inventory.wood > 0){
        var wood = '<b>Wood</b>: ' + self.inventory.wood + '<br>';
        all += wood;
      }
      if(self.inventory.stone > 0){
        var stone = '<b>Stone</b>: ' + self.inventory.stone + '<br>';
        all += stone;
      }
      if(self.inventory.grain > 0){
        var grain = '<b>Grain</b>: ' + self.inventory.grain + '<br>';
        all += grain;
      }
      if(self.inventory.ironore > 0){
        var ironore = '<b>IronOre</b>: ' + self.inventory.ironore + '<br>';
        all += ironore;
      }
      if(self.inventory.ironbar > 0){
        var ironbar = '<b>IronBar</b>: ' + self.inventory.ironbar + '<br>';
        all += ironbar;
      }
      if(self.inventory.steelbar > 0){
        var steelbar = '<b>SteelBar</b>: ' + self.inventory.steelbar + '<br>';
        all += steelbar;
      }
      if(self.inventory.boarhide > 0){
        var boarhide = '<b>BoarHide</b>: ' + self.inventory.boarhide + '<br>';
        all += boarhide;
      }
      if(self.inventory.leather > 0){
        var leather = '<b>Leather</b>: ' + self.inventory.leather + '<br>';
        all += leather;
      }
      if(self.inventory.silverore > 0){
        var silverore = '<b>SilverOre</b>: ' + self.inventory.silverore + '<br>';
        all += silverore;
      }
      if(self.inventory.silver > 0){
        var silver = '<b>Silver</b>: ' + self.inventory.silver + '<br>';
        all += silver;
      }
      if(self.inventory.goldore > 0){
        var goldore = '<b>GoldOre</b>: ' + self.inventory.goldore + '<br>';
        all += goldore;
      }
      if(self.inventory.gold > 0){
        var gold = '<b>Gold</b>: ' + self.inventory.gold + '<br>';
        all += gold;
      }
      if(self.inventory.diamond > 0){
        var diamond = '<b>Diamond</b>: ' + self.inventory.diamond + '<br>';
        all += diamond;
      }
      if(self.inventory.huntingknife > 0){
        var huntingknife = '<b>HuntingKnife</b>: ' + self.inventory.huntingknife + '<br>';
        all += huntingknife;
      }
      if(self.inventory.dague > 0){
        var dague = '<b>Dague</b>: ' + self.inventory.dague + '<br>';
        all += dague;
      }
      if(self.inventory.rondel > 0){
        var rondel = '<b>Rondel</b>: ' + self.inventory.rondel + '<br>';
        all += rondel;
      }
      if(self.inventory.misericorde > 0){
        var misericorde = '<b>Misericorde</b>: ' + self.inventory.misericorde + '<br>';
        all += misericorde;
      }
      if(self.inventory.bastardsword > 0){
        var bastardsword = '<b>BastardSword</b>: ' + self.inventory.bastardsword + '<br>';
        all += bastardsword;
      }
      if(self.inventory.longsword > 0){
        var longsword = '<b>Longsword</b>: ' + self.inventory.longsword + '<br>';
        all += longsword;
      }
      if(self.inventory.zweihander > 0){
        var zweihander = '<b>Zweihander</b>: ' + self.inventory.zweihander + '<br>';
        all += zweihander;
      }
      if(self.inventory.morallta > 0){
        var morallta = '<b>Morallta</b>: ' + self.inventory.morallta + '<br>';
        all += morallta;
      }
      if(self.inventory.bow > 0){
        var bow = '<b>Bow</b>: ' + self.inventory.bow + '<br>';
        all += bow;
      }
      if(self.inventory.welshlongbow > 0){
        var welshlongbow = '<b>WelshLongbow</b>: ' + self.inventory.welshlongbow + '<br>';
        all += welshlongbow;
      }
      if(self.inventory.knightlance > 0){
        var knightlance = '<b>KnightLance</b>: ' + self.inventory.knightlance + '<br>';
        all += knightlance;
      }
      if(self.inventory.rusticlance > 0){
        var rusticlance = '<b>RusticLance</b>: ' + self.inventory.rusticlance + '<br>';
        all += rusticlance;
      }
      if(self.inventory.paladinlance > 0){
        var paladinlance = '<b>PaladinLance</b>: ' + self.inventory.paladinlance + '<br>';
        all += paladinlance;
      }
      if(self.inventory.brigandine > 0){
        var brigandine = '<b>Brigandine</b>: ' + self.inventory.brigandine + '<br>';
        all += brigandine;
      }
      if(self.inventory.lamellar > 0){
        var lamellar = '<b>Lamellar</b>: ' + self.inventory.lamellar + '<br>';
        all += lamellar;
      }
      if(self.inventory.maille > 0){
        var maille = '<b>Maille</b>: ' + self.inventory.maille + '<br>';
        all += maille;
      }
      if(self.inventory.hauberk > 0){
        var hauberk = '<b>Hauberk</b>: ' + self.inventory.hauberk + '<br>';
        all += hauberk;
      }
      if(self.inventory.brynja > 0){
        var brynja = '<b>Brynja</b>: ' + self.inventory.brynja + '<br>';
        all += brynja;
      }
      if(self.inventory.cuirass > 0){
        var cuirass = '<b>Cuirass</b>: ' + self.inventory.cuirass + '<br>';
        all += cuirass;
      }
      if(self.inventory.steelplate > 0){
        var steelplate = '<b>SteelPlate</b>: ' + self.inventory.steelplate + '<br>';
        all += steelplate;
      }
      if(self.inventory.greenwichplate > 0){
        var greenwichplate = '<b>GreenwichPlate</b>: ' + self.inventory.greenwichplate + '<br>';
        all += greenwichplate;
      }
      if(self.inventory.gothicplate > 0){
        var gothicplate = '<b>GothicPlate</b>: ' + self.inventory.gothicplate + '<br>';
        all += gothicplate;
      }
      if(self.inventory.clericrobe > 0){
        var clericrobe = '<b>ClericRobe</b>: ' + self.inventory.clericrobe + '<br>';
        all += clericrobe;
      }
      if(self.inventory.monkcowl > 0){
        var monkcowl = '<b>MonkCowl</b>: ' + self.inventory.monkcowl + '<br>';
        all += monkcowl;
      }
      if(self.inventory.blackcloak > 0){
        var blackcloak = '<b>BlackCloak</b>: ' + self.inventory.blackcloak + '<br>';
        all += blackcloak;
      }
      if(self.inventory.tome > 0){
        var tome = '<b>Tome</b>: ' + self.inventory.tome + '<br>';
        all += tome;
      }
      if(self.inventory.runicscroll > 0){
        var runicscroll = '<b>RunicScroll</b>: ' + self.inventory.runicscroll + '<br>';
        all += runicscroll;
      }
      if(self.inventory.sacredtext > 0){
        var sacredtext = '<b>SacredText</b>: ' + self.inventory.sacredtext + '<br>';
        all += sacredtext;
      }
      if(self.inventory.stoneaxe > 0){
        var stoneaxe = '<b>StoneAxe</b>: ' + self.inventory.stoneaxe + '<br>';
        all += stoneaxe;
      }
      if(self.inventory.ironaxe > 0){
        var ironaxe = '<b>IronAxe</b>: ' + self.inventory.ironaxe + '<br>';
        all += ironaxe;
      }
      if(self.inventory.pickaxe > 0){
        var pickaxe = '<b>PickAxe</b>: ' + self.inventory.pickaxe + '<br>';
        all += pickaxe;
      }
      if(self.inventory.torch > 0){
        var torch = '<b>Torch</b>: ' + self.inventory.torch + '<br>';
        all += torch;
      }
      if(self.inventory.bread > 0){
        var bread = '<b>Bread</b>: ' + self.inventory.bread + '<br>';
        all += bread;
      }
      if(self.inventory.fish > 0){
        var fish = '<b>Fish</b>: ' + self.inventory.fish + '<br>';
        all += fish;
      }
      if(self.inventory.lamb > 0){
        var lamb = '<b>Lamb</b>: ' + self.inventory.lamb + '<br>';
        all += lamb;
      }
      if(self.inventory.boarmeat > 0){
        var boarmeat = '<b>BoarMeat</b>: ' + self.inventory.boarmeat + '<br>';
        all += boarmeat;
      }
      if(self.inventory.venison > 0){
        var venison = '<b>Venison</b>: ' + self.inventory.venison + '<br>';
        all += venison;
      }
      if(self.inventory.poachedfish > 0){
        var poachedfish = '<b>PoachedFish</b>: ' + self.inventory.poachedfish + '<br>';
        all += poachedfish;
      }
      if(self.inventory.lambchop > 0){
        var lambchop = '<b>LambChop</b>: ' + self.inventory.lambchop + '<br>';
        all += lambchop;
      }
      if(self.inventory.boarshank > 0){
        var boarshank = '<b>BoarShank</b>: ' + self.inventory.boarshank + '<br>';
        all += boarshank;
      }
      if(self.inventory.venisonloin > 0){
        var venisonloin = '<b>VenisonLoin</b>: ' + self.inventory.venisonloin + '<br>';
        all += venisonloin;
      }
      if(self.inventory.mead > 0){
        var mead = '<b>Mead</b>: ' + self.inventory.mead + '<br>';
        all += mead;
      }
      if(self.inventory.saison > 0){
        var saison = '<b>Saison</b>: ' + self.inventory.saison + '<br>';
        all += saison;
      }
      if(self.inventory.flandersredale > 0){
        var flandersredale = '<b>FlandersRedAle</b>: ' + self.inventory.flandersredale + '<br>';
        all += flandersredale;
      }
      if(self.inventory.bieredegarde > 0){
        var bieredegarde = '<b>BiereDeGarde</b>: ' + self.inventory.bieredegarde + '<br>';
        all += bieredegarde;
      }
      if(self.inventory.bordeaux > 0){
        var bordeaux = '<b>Bordeaux</b>: ' + self.inventory.bordeaux + '<br>';
        all += bordeaux;
      }
      if(self.inventory.bourgogne > 0){
        var bourgogne = '<b>Bourgogne</b>: ' + self.inventory.bourgogne + '<br>';
        all += bourgogne;
      }
      if(self.inventory.chianti > 0){
        var chianti = '<b>Chianti</b>: ' + self.inventory.chianti + '<br>';
        all += chianti;
      }
      if(self.inventory.crown > 0){
        var crown = '<b>Crown</b>: ' + self.inventory.crown + '<br>';
        all += crown;
      }
      if(self.inventory.worldmap > 0){
        var worldmap = '<b>WorldMap</b>: ' + self.inventory.worldmap + '<br>';
        all += worldmap;
      }
      if(self.inventory.arrows > 0){
        var arrows = '<b>Arrows</b>: ' + self.inventory.arrows + '<br>';
        all += arrows;
      }
      if(self.inventory.relic > 0){
        var relic = '<b>Relic</b>: ' + self.inventory.relic + '<br>';
        all += relic;
      }
      if(all === ''){
        socket.emit('addToChat','<i>You have nothing in your bag.</i>');
      } else {
        socket.emit('addToChat','<p>'+all+'</p>');
      }
    }

    // INTERACTIONS



    // WORK ACTIONS
    if(self.pressingF && self.actionCooldown === 0 && !self.working){
      var socket = SOCKET_LIST[self.id];
      var loc = getLoc(self.x,self.y);
      var uLoc = getLoc(self.x,self.y-tileSize);
      var dLoc = getLoc(self.x,self.y+tileSize);
      var lLoc = getLoc(self.x-tileSize,self.y);
      var rLoc = getLoc(self.x+tileSize,self.y);
      // fish
      if(self.z === 0 && self.facing === 'up' && getTile(0,uLoc[0],uLoc[1]) === 0){
        if(getTile(6,uLoc[0],uLoc[1]) > 0){
          var rand = Math.floor(Math.random() * 6000);
          self.working = true;
          self.fishing = true;
          setTimeout(function(){
            if(self.working){
              self.working = false;
              self.fishing = false;
              self.inventory.fish++;
              world[6][uLoc[1]][uLoc[0]]--;
              socket.emit('addToChat','<i>You caught a fish.</i>');
            } else {
              return;
            }
          },rand);
        } else {
          self.working = true;
          self.fishing = true;
        }
      } else if(self.z === 0 && self.facing === 'down' && getTile(0,dLoc[0],dLoc[1]) === 0){
        if(getTile(6,dLoc[0],dLoc[1]) > 0){
          var rand = Math.floor(Math.random() * 6000);
          self.working = true;
          self.fishing = true;
          setTimeout(function(){
            if(self.working){
              self.working = false;
              self.fishing = false;
              self.inventory.fish++;
              world[6][dLoc[1]][dLoc[0]]--;
              socket.emit('addToChat','<i>You caught a fish.</i>');
            } else {
              return;
            }
          },rand);
        } else {
          self.working = true;
          self.fishing = true;
        }
      } else if(self.z === 0 && self.facing === 'left' && getTile(0,lLoc[0],lLoc[1]) === 0){
        if(getTile(6,lLoc[0],lLoc[1]) > 0){
          var rand = Math.floor(Math.random() * 6000);
          self.working = true;
          self.fishing = true;
          setTimeout(function(){
            if(self.working){
              self.working = false;
              self.fishing = false;
              self.inventory.fish++;
              world[6][lLoc[1]][lLoc[0]]--;
              socket.emit('addToChat','<i>You caught a fish.</i>');
            } else {
              return;
            }
          },rand);
        } else {
          self.working = true;
          self.fishing = true;
        }
      } else if(self.z === 0 && self.facing === 'right' && getTile(0,rLoc[0],rLoc[1]) === 0){
        if(getTile(6,rLoc[0],rLoc[1]) > 0){
          var rand = Math.floor(Math.random() * 6000);
          self.working = true;
          self.fishing = true;
          setTimeout(function(){
            if(self.working){
              self.working = false;
              self.fishing = false;
              self.inventory.fish++;
              world[6][rLoc[1]][rLoc[0]]--;
              socket.emit('addToChat','<i>You caught a fish.</i>');
            } else {
              return;
            }
          },rand);
        } else {
          self.working = true;
          self.fishing = true;
        }
        // clear brush
      } else if(self.z === 0 && getTile(0,loc[0],loc[1]) >= 3 && getTile(0,loc[0],loc[1]) < 4){
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
        // gather wood
      } else if(self.z === 0 && (getTile(0,loc[0],loc[1]) >= 1 && getTile(0,loc[0],loc[1]) < 3)){
        self.working = true;
        if(self.inventory.stoneaxe > 0 || self.inventory.ironaxe > 0){
          self.chopping = true;
        }
        self.actionCooldown = 10;
        setTimeout(function(){
          if(self.working){
            world[6][loc[1]][loc[0]] -= 50; // ALPHA
            self.inventory.wood += 50; // ALPHA
            self.working = false;
            self.chopping = false;
            if(getTile(0,loc[0],loc[1]) >= 1 && getTile(0,loc[0],loc[1]) < 2 && getTile(6,loc[0],loc[1]) < 101){
              world[0][loc[1]][loc[0]] += 1;
              for(var i in hForestSpawns){
                if(hForestSpawns[i] === loc){
                  biomes.hForest--;
                  hForestSpawns.splice(i,1);
                  return;
                } else {
                  continue;
                }
              }
              io.emit('mapEdit',world);
            } else if(getTile(0,loc[0],loc[1]) >= 2 && getTile(0,loc[0],loc[1]) < 3 && getTile(6,loc[0],loc[1]) <= 0){
              world[0][loc[1]][loc[0]] = 7;
              io.emit('mapEdit',world);
            }
          } else {
            return;
          }
        },6000/self.strength);
        // gather stone
      } else if(self.z === 0 && getTile(0,loc[0],loc[1]) >= 4 && getTile(0,loc[0],loc[1]) < 6){
        self.working = true;
        if(self.inventory.pickaxe > 0){
          self.mining = true;
        }
        self.actionCooldown = 10;
        setTimeout(function(){
          if(self.working){
            world[6][loc[1]][loc[0]] -= 50; // ALPHA
            self.inventory.stone += 50; // ALPHA
            self.working = false;
            self.mining = false;
            if(getTile(0,loc[0],loc[1]) >= 4 && getTile(0,loc[0],loc[1]) < 5 && getTile(6,loc[0],loc[1]) <= 0){
              world[0][loc[1]][loc[0]] = 7;
              io.emit('mapEdit',world);
            }
          } else {
            return;
          }
        },10000/self.strength);
        // mine metal
      } else if(self.z === -1 && getTile(1,loc[0],loc[1]) >= 3 && getTile(1,loc[0],loc[1]) < 4){
        self.working = true;
        if(self.inventory.pickaxe > 0){
          self.mining = true;
        }
        self.actionCooldown = 10;
        setTimeout(function(){
          if(self.working){
            world[7][loc[1]][loc[0]] -= 1;
            self.inventory.stone += 1;
            self.working = false;
            self.mining = false;
          } else {
            return;
          }
        },10000/self.strength);
        // farm
      } else if(self.z === 0 && getTile(0,loc[0],loc[1]) === 8){
        if(tempus === 'V.a' || tempus === 'VI.a' || tempus === 'VII.a' ||
        tempus === 'VIII.a' || tempus === 'IX.a' || tempus === 'X.a' ||
        tempus === 'XI.a' || tempus === 'XII.p' || tempus === 'I.p' ||
        tempus === 'II.p' || tempus === 'III.p' || tempus === 'IV.p' ||
        tempus === 'V.p' || tempus === 'VI.p'){
          var f = getBuilding(self.x,self.y);
          self.working = true;
          self.farming = true;
          self.actionCooldown = 10;
          setTimeout(function(){
            if(self.working && world[6][loc[1]][loc[0]] < 25){
              world[6][loc[1]][loc[0]] += 25; // ALPHA, default:5
              //io.emit('mapEdit',world);
              self.working = false;
              self.farming = false;
              var count = 0;
              var plot = Building.list[f].plot;
              for(var i in plot){
                var n = plot[i];
                if(world[6][n[1]][n[0]] >= 25){
                  count++;
                } else {
                  continue;
                }
              }
              if(count === 9){
                for(var i in plot){
                  var n = plot[i];
                  world[0][n[1]][n[0]] = 9;
                }
                io.emit('mapEdit',world);
              }
            } else {
              return;
            }
          },10000);
        } else {
          socket.emit('addToChat','<i>Farmwork is done during daylight hours.</i>');
        }
      } else if(self.z === 0 && getTile(0,loc[0],loc[1]) === 9){
        if(tempus === 'V.a' || tempus === 'VI.a' || tempus === 'VII.a' ||
        tempus === 'VIII.a' || tempus === 'IX.a' || tempus === 'X.a' ||
        tempus === 'XI.a' || tempus === 'XII.p' || tempus === 'I.p' ||
        tempus === 'II.p' || tempus === 'III.p' || tempus === 'IV.p' ||
        tempus === 'V.p' || tempus === 'VI.p'){
          var f = Building.list[getBuilding(self.x,self.y)];
          self.working = true;
          self.farming = true;
          self.actionCooldown = 10;
          setTimeout(function(){
            if(self.working && world[6][loc[1]][loc[0]] < 50){
              world[6][loc[1]][loc[0]] += 25; // ALPHA, default:1
              //io.emit('mapEdit',world);
              self.working = false;
              self.farming = false;
              var count = 0;
              var plot = f.plot;
              for(var i in plot){
                if(world[6][plot[i][1]][plot[i][0]] >= 50){
                  count++;
                } else {
                  continue;
                }
              }
              if(count === 9){
                for(var i in plot){
                  world[0][plot[i][1]][plot[i][0]] = 10;
                }
                io.emit('mapEdit',world);
              }
            } else {
              return;
            }
          },10000);
        } else {
          socket.emit('addToChat','<i>Farmwork is done during daylight hours.</i>');
        }
      } else if(self.z === 0 && getTile(0,loc[0],loc[1]) === 10){
        var f = getBuilding(self.x,self.y);
        self.working = true;
        self.farming = true;
        self.actionCooldown = 10;
        setTimeout(function(){
          if(self.working){
            world[6][loc[1]][loc[0]] -= 1;
            self.inventory.grain += 1;
            self.working = false;
            self.farming = false;
            if(world[6][loc[1]][loc[0]] <= 0){
              world[0][loc[1]][loc[0]] = 8;
              io.emit('mapEdit', world);
            }
          } else {
            return;
          }
        },10000);
        // build
      } else if(self.z === 0 && (getTile(0,loc[0],loc[1]) === 11 || getTile(0,loc[0],loc[1]) === 11.5)){
        self.working = true;
        self.building = true;
        self.actionCooldown = 10;
        var b = Building.list[getBuilding(self.x,self.y)];
        setTimeout(function(){
          if(self.working){
            world[6][loc[1]][loc[0]] += 10; // ALPHA, default:1
            self.working = false;
            self.building = false;
            var count = 0;
            var plot = b.plot;
            var walls = b.walls;
            var top = b.topPlot;
            if(world[6][loc[1]][loc[0]] >= b.req){
              if(world[0][loc[1]][loc[0]] === 11){
                world[0][loc[1]][loc[0]] = 12;
              } else if(world[0][loc[1]][loc[0]] === 11.5){
                world[0][loc[1]][loc[0]] = 12.5;
              }
              io.emit('mapEdit',world);
            }
            for(var i in plot){
              if(getTile(6,plot[i][0],plot[i][1]) >= b.req){
                count++;
              } else {
                continue;
              }
            }
            if(count === plot.length){
              if(b.type === 'hut'){
                Building.list[getBuilding(self.x,self.y)].built = true;
                for(var i in plot){
                  matrixO[plot[i][1]][plot[i][0]] = 1;
                  gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                  matrixB1[plot[i][1]][plot[i][0]] = 0;
                  gridO.setWalkableAt(plot[i][0],plot[i][1],true);
                  world[0][plot[i][1]][plot[i][0]] = 13;
                  world[3][plot[i][1]][plot[i][0]] = String('hut' + i);
                  if(world[3][plot[i][1]][plot[i][0]] === 'hut1'){
                    world[0][plot[i][1]][plot[i][0]] = 14;
                    matrixO[plot[i][1]][plot[i][0]] = 0;
                    gridO.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB1[plot[i][1]+1][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][1],plot[i][0]+1,true);
                  }
                }
                for(var i in walls){
                  var n = walls[i];
                  world[4][n[1]][n[0]] = 1;
                }
                var fp = getCoords(walls[1][0],walls[1][1]);
                Fireplace({
                  x:fp[0],
                  y:fp[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
              } else if(b.type === 'mill'){
                Building.list[getBuilding(self.x,self.y)].built = true;
                for(var i in plot){
                  world[0][plot[i][1]][plot[i][0]] = 13;
                  world[3][plot[i][1]][plot[i][0]] = String('mill' + i);
                  matrixO[plot[i][1]][plot[i][0]] = 1;
                  gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                }
                world[5][top[0][1]][top[0][0]] = 'mill4';
                world[5][top[1][1]][top[1][0]] = 'mill5';
              } else if(b.type === 'cottage'){
                Building.list[getBuilding(self.x,self.y)].built = true;
                for(var i in plot){
                  matrixO[plot[i][1]][plot[i][0]] = 1;
                  gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                  matrixB1[plot[i][1]][plot[i][0]] = 0;
                  gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                  world[0][plot[i][1]][plot[i][0]] = 15;
                  world[3][plot[i][1]][plot[i][0]] = String('cottage' + i);
                  if(world[3][plot[i][1]][plot[i][0]] === 'cottage1'){
                    matrixO[plot[i][1]][plot[i][0]] = 0;
                    gridO.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB1[plot[i][1]+1][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1]+1,true);
                    world[0][plot[i][1]][plot[i][0]] = 19;
                  }
                }
                for(var i in walls){
                  var n = walls[i];
                  world[4][n[1]][n[0]] = 2;
                }
                var fp = getCoords(walls[1][0],walls[1][1]);
                Fireplace({
                  x:fp[0],
                  y:fp[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Player.list[b.owner].keys.push(b.id);
              } else if(b.type === 'fort'){
                Building.list[getBuilding(self.x,self.y)].built = true;
                world[0][plot[0][1]][plot[0][0]] = 13;
                matrixO[plot[0][1]][plot[0][0]] = 1;
                gridO.setWalkableAt(plot[0][0],plot[0][1],false);
                world[3][plot[0][1]][plot[0][0]] = 'fort';
              } else if(b.type === 'wall'){
                Building.list[getBuilding(self.x,self.y)].built = true;
                world[0][plot[0][1]][plot[0][0]] = 15;
                matrixO[plot[0][1]][plot[0][0]] = 1;
                gridO.setWalkableAt(plot[0][0],plot[0][1],false);
                world[3][plot[0][1]][plot[0][0]] = 'wall';
              } else if(b.type === 'outpost'){
                Building.list[getBuilding(self.x,self.y)].built = true;
                world[0][plot[0][1]][plot[0][0]] = 13;
                matrixO[plot[0][1]][plot[0][0]] = 1;
                gridO.setWalkableAt(plot[0][0],plot[0][1],false);
                world[3][plot[0][1]][plot[0][0]] = 'outpost0';
                world[5][top[0][1]][top[0][0]] = 'outpost1';
              } else if(b.type === 'guardtower'){
                Building.list[getBuilding(self.x,self.y)].built = true;
                for(var i in plot){
                  world[0][plot[i][1]][plot[i][0]] = 15;
                  matrixO[plot[i][1]][plot[i][0]] = 1;
                  gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                  world[3][plot[i][1]][plot[i][0]] = String('gtower' + i);
                }
                world[5][top[0][1]][top[0][0]] = 'gtower4';
                world[5][top[1][1]][top[1][0]] = 'gtower5';
                var fp = getCoords(plot[1][0],plot[1][1]);
                Firepit({
                  x:fp[0],
                  y:fp[1],
                  z:0,
                  qty:1,
                  parent:b.id
                })
              } else if(b.type === 'tower'){
                Building.list[getBuilding(self.x,self.y)].built = true;
                for(var i in plot){
                  world[3][plot[i][1]][plot[i][0]] = String('tower' + i);
                  if(world[3][plot[i][1]][plot[i][0]] === 'tower0'){
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB2[plot[i][1]][plot[i][0]] = 0;
                    gridB2.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB1[plot[i][1]+1][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1]+1,true);
                    world[0][plot[i][1]][plot[i][0]] = 19;
                    world[5][plot[i][1]][plot[i][0]] = 15;
                  } else {
                    matrixO[plot[i][1]][plot[i][0]] = 1;
                    gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB2[plot[i][1]][plot[i][0]] = 0;
                    gridB2.setWalkableAt(plot[i][0],plot[i][1],true);
                    world[0][plot[i][1]][plot[i][0]] = 15;
                    world[5][plot[i][1]][plot[i][0]] = 15;
                  }
                }
                var ii = 9;
                for(var i in top){
                  var n = top[i];
                  world[5][n[1]][n[0]] = String('tower' + ii);
                  world[4][n[1]][n[0]] = 2;
                  if(world[5][n[1]][n[0]] === 'tower10'){
                    world[4][n[1]][n[0]] = 4;
                    matrixB1[n[1]][n[0]] = 0;
                    gridB1.setWalkableAt(n[0],n[1],true);
                    matrixB2[n[1]][n[0]] = 0;
                    gridB2.setWalkableAt(n[0],n[1],true);
                  } else if(world[5][n[1]][n[0]] === 'tower12' || world[5][n[1]][n[0]] === 'tower13' || world[5][n[1]][n[0]] === 'tower14'){
                    world[4][n[1]][n[0]] = 0;
                  }
                  ii++;
                }
                var fp = getCoords(walls[2][0],walls[2][1]);
                Fireplace({
                  x:fp[0],
                  y:fp[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Player.list[b.owner].keys.push(b.id);
              } else if(b.type === 'tavern'){
                Building.list[getBuilding(self.x,self.y)].built = true;
                for(var i in plot){
                  world[3][plot[i][1]][plot[i][0]] = String('tavern' + i);
                  if(world[3][plot[i][1]][plot[i][0]] === 'tavern1'){
                    matrixO[plot[i][1]][plot[i][0]] = 0;
                    gridO.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB1[plot[i][1]+1][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1]+1,true);
                    world[0][plot[i][1]][plot[i][0]] = 14;
                  } else if(world[3][plot[i][1]][plot[i][0]] === 'tavern0' || world[3][plot[i][1]][plot[i][0]] === 'tavern2'){
                    matrixO[plot[i][1]][plot[i][0]] = 1;
                    gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    world[0][plot[i][1]][plot[i][0]] = 13;
                  } else {
                    matrixO[plot[i][1]][plot[i][0]] = 1;
                    gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB2[plot[i][1]][plot[i][0]] = 0;
                    gridB2.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB3[plot[i][1]][plot[i][0]] = 0;
                    gridB3.setWalkableAt(plot[i][0],plot[i][1],true);
                    world[0][plot[i][1]][plot[i][0]] = 13;
                    world[5][plot[i][1]][plot[i][0]] = 13;
                    world[8][plot[i][1]][plot[i][0]] = 1;
                  }
                }
                var ii = 17;
                for(var i in top){
                  var n = top[i];
                  world[5][n[1]][n[0]] = String('tavern' + ii);
                  ii++;
                }
                for(var i in walls){
                  var n = walls[i];
                  world[4][n[1]][n[0]] = 1;
                }
                world[4][walls[0][1]][walls[0][0]] = 5;
                matrixB1[walls[0][1]][walls[0][0]] = 0;
                gridB1.setWalkableAt(walls[0][0],walls[0][1],true);
                world[8][walls[0][1]][walls[0][0]] = 5;
                matrixB3[walls[0][1]][walls[0][0]] = 0;
                gridB3.setWalkableAt(walls[0][0],walls[0][1],true);
                world[4][walls[4][1]][walls[4][0]] = 3;
                matrixB1[walls[4][1]][walls[4][0]] = 0;
                gridB1.setWalkableAt(walls[4][0],walls[4][1],true);
                matrixB2[walls[4][1]][walls[4][0]] = 0;
                gridB2.setWalkableAt(walls[4][0],walls[4][1],true);
                var fp = getCoords(walls[2][0],walls[2][1]);
                var sh = getCoords(walls[3][0],walls[3][1]);
                var b1 = getCoords(plot[0][0],plot[0][1]);
                var b2 = getCoords(plot[2][0],plot[2][1]);
                var b3 = getCoords(plot[3][0],plot[3][1]);
                var b4 = getCoords(plot[7][0],plot[7][1]);
                var b5 = getCoords(plot[8][0],plot[8][1]);
                var bd = getCoords(walls[0][0],walls[0][1]);
                var ch = getCoords(plot[16][0],plot[16][1]);
                var wt = getCoords(walls[1][0],walls[1][1])
                var b6 = getCoords(plot[4][0],plot[4][1]);
                var cr = getCoords(plot[5][0],plot[5][1]);
                var b7 = getCoords(plot[6][0],plot[6][1]);
                var b8 = getCoords(plot[12][0],plot[12][1]);
                var sp1 = getCenter(plot[16][0],plot[16][1]);
                Fireplace({
                  x:fp[0],
                  y:fp[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                StagHead({
                  x:sh[0],
                  y:sh[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Firepit({
                  x:b1[0],
                  y:b1[1],
                  z:0,
                  qty:1,
                  parent:b.id
                });
                Barrel({
                  x:b1[0],
                  y:b1[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Firepit({
                  x:b2[0],
                  y:b2[1],
                  z:0,
                  qty:1,
                  parent:b.id
                });
                Barrel({
                  x:b2[0],
                  y:b2[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Barrel({
                  x:b3[0],
                  y:b3[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Barrel({
                  x:b4[0],
                  y:b4[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Barrel({
                  x:b5[0],
                  y:b5[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Bed({
                  x:bd[0],
                  y:bd[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Fireplace({
                  x:fp[0],
                  y:fp[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Barrel({
                  x:b3[0],
                  y:b3[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Barrel({
                  x:b4[0],
                  y:b4[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Chest({
                  x:ch[0],
                  y:ch[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                WallTorch({
                  x:wt[0],
                  y:wt[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                Barrel({
                  x:b3[0],
                  y:b3[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                Barrel({
                  x:b6[0],
                  y:b6[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                Crates({
                  x:cr[0],
                  y:cr[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                Barrel({
                  x:b7[0],
                  y:b7[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                Barrel({
                  x:b4[0],
                  y:b4[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                Barrel({
                  x:b5[0],
                  y:b5[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                Barrel({
                  x:b8[0],
                  y:b8[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                Innkeeper({
                  x:sp1[0],
                  y:sp1[1],
                  z:1,
                  name:'Innkeeper ' + randomName('m'),
                  house:self.house,
                  kingdom:self.kingdom,
                  home:{
                    z:1,
                    x:sp1[0],
                    y:sp1[1]
                  }
                });
              } else if(b.type === 'monastery'){
                Building.list[getBuilding(self.x,self.y)].built = true;
                for(var i in plot){
                  world[3][plot[i][1]][plot[i][0]] = String('monastery' + i);
                  if(world[3][plot[i][1]][plot[i][0]] === 'monastery0'){
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB1[plot[i][1]+1][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1]+1,true);
                    world[0][plot[i][1]][plot[i][0]] = 16;
                  } else if(world[3][plot[i][1]][plot[i][0]] === 'monastery1' || world[3][plot[i][1]][plot[i][0]] === 'monastery2' || world[3][plot[i][1]][plot[i][0]] === 'monastery3' || world[3][plot[i][1]][plot[i][0]] === 'monastery4' || world[3][plot[i][1]][plot[i][0]] === 'monastery5' || world[3][plot[i][1]][plot[i][0]] === 'monastery6' || world[3][plot[i][1]][plot[i][0]] === 'monastery7'){
                    matrixO[plot[i][1]][plot[i][0]] = 1;
                    gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    world[0][plot[i][1]][plot[i][0]] = 15;
                  } else {
                    matrixO[plot[i][1]][plot[i][0]] = 1;
                    gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB2[plot[i][1]][plot[i][0]] = 0;
                    gridB2.setWalkableAt(plot[i][0],plot[i][1],true);
                    world[0][plot[i][1]][plot[i][0]] = 15;
                    world[5][plot[i][1]][plot[i][0]] = 15;
                  }
                }
                var ii = 14;
                for(var i in top){
                  var n = top[i];
                  world[5][n[1]][n[0]] = String('monastery' + ii);
                  ii++;
                }
                for(var i in walls){
                  var n = walls[i];
                  world[4][n[1]][n[0]] = 2;
                }
                world[4][walls[1][1]][walls[1][0]] = 4;
                matrixB1[walls[1][1]][walls[1][0]] = 0;
                gridB1.setWalkableAt(walls[1][0],walls[1][1],true);
                matrixB2[walls[1][1]][walls[1][0]] = 0;
                gridB2.setWalkableAt(walls[1][0],walls[1][1],true);
                var wt = getCoords(walls[0][0],walls[0][1]);
                var cr = getCoords(walls[2][0],walls[2][1]);
                var bs = getCoords(walls[3][0],walls[3][1]);
                var sp1 = getCenter(plot[13][0],plot[13][1]);
                var sp2 = getCenter(plot[8][0],plot[8][1]);
                var sp3 = getCenter(plot[10][0],plot[10][1]);
                WallTorch({
                  x:wt[0],
                  y:wt[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Cross({
                  x:cr[0],
                  y:cr[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Bookshelf({
                  x:cr[0],
                  y:cr[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Bookshelf({
                  x:bs[0],
                  y:bs[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Bishop({
                  x:sp1[0],
                  y:sp1[1],
                  z:1,
                  name:'Father ' + randomName(),
                  house:self.house,
                  kingdom:self.kingdom,
                  home:{
                    z:1,
                    x:sp1[0],
                    y:sp1[1]
                  }
                });
                Monk({
                  x:sp2[0],
                  y:sp2[1],
                  z:1,
                  name:'Brother ' + randomName(),
                  house:self.house,
                  kingdom:self.kingdom,
                  home:{
                    z:1,
                    x:sp2[0],
                    y:sp2[1]
                  }
                });
                Monk({
                  x:sp3[0],
                  y:sp3[1],
                  z:1,
                  name:'Brother ' + randomName(),
                  house:self.house,
                  kingdom:self.kingdom,
                  home:{
                    z:1,
                    x:sp3[0],
                    y:sp3[1]
                  }
                });
              } else if(b.type === 'market'){
                Building.list[getBuilding(self.x,self.y)].built = true;
                for(var i in plot){
                  world[3][plot[i][1]][plot[i][0]] = String('market' + i);
                  if(world[3][plot[i][1]][plot[i][0]] === 'market0' || world[3][plot[i][1]][plot[i][0]] === 'market1' || world[3][plot[i][1]][plot[i][0]] === 'market2'){
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB1[plot[i][1]+1][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1]+1,true);
                    world[0][plot[i][1]][plot[i][0]] = 14;
                  } else {
                    matrixO[plot[i][1]][plot[i][0]] = 1;
                    gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB2[plot[i][1]][plot[i][0]] = 0;
                    gridB2.setWalkableAt(plot[i][0],plot[i][1],true);
                    world[0][plot[i][1]][plot[i][0]] = 13;
                    world[5][plot[i][1]][plot[i][0]] = 13;
                  }
                }
                var ii = 12;
                for(var i in top){
                  var n = top[i];
                  world[5][n[1]][n[0]] = String('market' + ii);
                  ii++;
                }
                for(var i in walls){
                  var n = walls[i];
                  if(world[5][n[1]][n[0]] === 'market12'){
                    world[4][n[1]][n[0]] = 3;
                    matrixB1[n[1]][n[0]] = 0;
                    gridB1.setWalkableAt(n[0],n[1],true);
                    matrixB2[n[1]][n[0]] = 0;
                    gridB2.setWalkableAt(n[0],n[1],true);
                  } else {
                    world[4][n[1]][n[0]] = 1;
                  }
                }
                var g1 = getCoords(walls[1][0],walls[1][1]);
                var g2 = getCoords(walls[2][0],walls[2][1]);
                var g3 = getCoords(walls[3][0],walls[3][1]);
                var g4 = getCoords(walls[4][0],walls[4][1]);
                var fp1 = getCoords(plot[3][0],plot[3][1]+1);
                var fp2 = getCoords(plot[7][0],plot[7][1]+1);
                var cr1 = getCoords(plot[8][0],plot[8][1]);
                var d1 = getCoords(plot[9][0],plot[9][1]);
                var d2 = getCoords(plot[10][0],plot[10][1]);
                var cr2 = getCoords(plot[11][0],plot[11][1]);
                WallTorch({
                  x:g1[0],
                  y:g1[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Goods1({
                  x:g1[0],
                  y:g1[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Goods2({
                  x:g2[0],
                  y:g2[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Goods3({
                  x:g3[0],
                  y:g3[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                WallTorch({
                  x:g4[0],
                  y:g4[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Goods4({
                  x:g4[0],
                  y:g4[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Firepit({
                  x:fp1[0],
                  y:fp1[1],
                  z:0,
                  qty:1,
                  parent:b.id
                });
                Firepit({
                  x:fp2[0],
                  y:fp2[1],
                  z:0,
                  qty:1,
                  parent:b.id
                });
                WallTorch({
                  x:g1[0],
                  y:g1[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Stash1({
                  x:g2[0],
                  y:g2[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Stash2({
                  x:g3[0],
                  y:g3[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                WallTorch({
                  x:g4[0],
                  y:g4[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Crates({
                  x:cr1[0],
                  y:cr1[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Desk({
                  x:d1[0],
                  y:d1[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Desk({
                  x:d2[0],
                  y:d2[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Crates({
                  x:cr2[0],
                  y:cr2[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
              } else if(b.type === 'stable'){
                Building.list[getBuilding(self.x,self.y)].built = true;
                for(var i in plot){
                  world[3][plot[i][1]][plot[i][0]] = String('stable' + i);
                  world[0][plot[i][1]][plot[i][0]] = 13;
                  matrixO[plot[i][1]][plot[i][0]] = 1;
                  if(world[3][plot[i][1]][plot[i][0]] === 'stable0' ||
                  world[3][plot[i][1]][plot[i][0]] === 'stable1' ||
                  world[3][plot[i][1]][plot[i][0]] === 'stable2' ||
                  world[3][plot[i][1]][plot[i][0]] === 'stable3'){
                    matrixO[plot[i][1]][plot[i][0]] = 'stable';
                  } else {
                    matrixO[plot[i][1]][plot[i][0]] = 1;
                  }
                  gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                }
                var ii = 12;
                for(var i in top){
                  var n = top[i];
                  world[5][n[1]][n[0]] = String('stable' + ii);
                  ii++;
                }
                var wt = getCoords(plot[1][0],plot[1][1]);
                WallTorch({
                  x:wt[0],
                  y:wt[1],
                  z:0,
                  qty:1,
                  parent:b.id
                });
              } else if(b.type === 'dock'){
                Building.list[getBuilding(self.x,self.y)].built = true;
                for(var i in plot){
                  world[3][plot[i][1]][plot[i][0]] = String('dock' + i);
                  if(world[3][plot[i][1]][plot[i][0]] === 'dock4'){
                    world[0][plot[i][1]][plot[i][0]] = 13;
                    matrixO[plot[i][1]][plot[i][0]] = 'dock';
                    gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                    matrixW[plot[i][1]][plot[i][0]] = 1;
                    gridW.setWalkableAt(plot[i][0],plot[i][1],false);
                    matrixS[plot[i][1]][plot[i][0]] = 1;
                    gridS.setWalkableAt(plot[i][0],plot[i][1],false);
                  } else {
                    if(getTile(0,plot[i][0],plot[i][1]) === 12.5){
                      world[0][plot[i][1]][plot[i][0]] = 20.5;
                    } else {
                      world[0][plot[i][1]][plot[i][0]] = 20;
                    }
                    matrixO[plot[i][1]][plot[i][0]] = 0;
                    gridO.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixS[plot[i][1]][plot[i][0]] = 1;
                    gridS.setWalkableAt(plot[i][0],plot[i][1],false);
                  }
                }
                var ii = 6;
                for(var i in top){
                  var n = top[i];
                  world[5][n[1]][n[0]] = String('dock' + ii);
                  ii++;
                }
                var wt = getCoords(plot[4][0],plot[4][1]);
                var sp = getCenter(plot[1][0],plot[1][1]);
                WallTorch({
                  x:wt[0],
                  y:wt[1],
                  z:0,
                  qty:1,
                  parent:b.id
                });
                Shipwright({
                  x:sp[0],
                  y:sp[1],
                  z:0,
                  name:'Shipwright ' + randomName('m'),
                  house:self.house,
                  kingdom:self.kingdom,
                  home:{
                    z:0,
                    x:sp[0],
                    y:sp[1]
                  }
                });
              } else if(b.type === 'garrison'){
                Building.list[getBuilding(self.x,self.y)].built = true;
                for(var i in plot){
                  world[3][plot[i][1]][plot[i][0]] = String('garrison' + i);
                  if(world[3][plot[i][1]][plot[i][0]] === 'garrison0'){
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB1[plot[i][1]+1][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1]+1,true);
                    world[0][plot[i][1]][plot[i][0]] = 16;
                  } else if(world[3][plot[i][1]][plot[i][0]] === 'garrison1' || world[3][plot[i][1]][plot[i][0]] === 'garrison2' || world[3][plot[i][1]][plot[i][0]] === 'garrison3'){
                    matrixO[plot[i][1]][plot[i][0]] = 1;
                    gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    world[0][plot[i][1]][plot[i][0]] = 15;
                  } else {
                    matrixO[plot[i][1]][plot[i][0]] = 1;
                    gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB2[plot[i][1]][plot[i][0]] = 0;
                    gridB2.setWalkableAt(plot[i][0],plot[i][1],true);
                    world[0][plot[i][1]][plot[i][0]] = 15;
                    world[5][plot[i][1]][plot[i][0]] = 15;
                  }
                }
                var ii = 12;
                for(var i in top){
                  var n = top[i];
                  world[5][n[1]][n[0]] = String('garrison' + ii);
                  ii++;
                }
                for(var i in walls){
                  var n = walls[i];
                  if(world[5][n[1]][n[0]] === 'garrison12'){
                    world[4][n[1]][n[0]] = 4;
                    matrixB1[n[1]][n[0]] = 0;
                    gridB1.setWalkableAt(n[0],n[1],true);
                    matrixB2[n[1]][n[0]] = 0;
                    gridB2.setWalkableAt(n[0],n[1],true);
                  } else {
                    world[4][n[1]][n[0]] = 2;
                  }
                }
                var sa = getCoords(walls[0][0],walls[0][1]);
                var sr1 = getCoords(walls[2][0],walls[2][1]);
                var sr2 = getCoords(walls[3][0],walls[3][1]);
                var fp = getCoords(plot[1][0],plot[1][1]);
                var d1 = getCoords(plot[2][0],plot[2][1]);
                var d2 = getCoords(plot[3][0],plot[3][1]);
                var d3 = getCoords(plot[6][0],plot[6][1]);
                var d4 = getCoords(plot[7][0],plot[7][1]);
                var dk = getCoords(plot[8][0],plot[8][1]);
                SuitArmor({
                  x:sa[0],
                  y:sa[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Swordrack({
                  x:sr1[0],
                  y:sr1[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Swordrack({
                  x:sr2[0],
                  y:sr2[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Firepit({
                  x:fp[0],
                  y:fp[1],
                  z:0,
                  qty:1,
                  parent:b.id
                });
                Firepit({
                  x:fp[0],
                  y:fp[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Dummy({
                  x:d1[0],
                  y:d1[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Dummy({
                  x:d2[0],
                  y:d2[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                WallTorch({
                  x:sa[0],
                  y:sa[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Swordrack({
                  x:sr1[0],
                  y:sr1[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Swordrack({
                  x:sr2[0],
                  y:sr2[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Dummy({
                  x:d3[0],
                  y:d3[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Dummy({
                  x:d4[0],
                  y:d4[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Desk({
                  x:dk[0],
                  y:dk[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
              } else if(b.type === 'blacksmith'){
                Building.list[getBuilding(self.x,self.y)].built = true;
                for(var i in plot){
                  world[3][plot[i][1]][plot[i][0]] = String('bsmith' + i);
                  if(world[3][plot[i][1]][plot[i][0]] === 'bsmith1'){
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB1[plot[i][1]+1][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1]+1,true);
                    world[0][plot[i][1]][plot[i][0]] = 14;
                  } else {
                    matrixO[plot[i][1]][plot[i][0]] = 1;
                    gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    world[0][plot[i][1]][plot[i][0]] = 13;
                  }
                }
                var ii = 5;
                for(var i in walls){
                  var n = walls[i];
                  world[5][n[1]][n[0]] = String('bsmith' + ii);
                  if(world[5][n[1]][n[0]] === 'bsmith5'){
                    world[5][n[1]][n[0]] = 0;
                    world[4][n[1]][n[0]] = 1;
                  } else {
                    world[4][n[1]][n[0]] = 1;
                  }
                  ii++;
                }
                var fg = getCoords(walls[1][0],walls[1][1]);
                var fp = getCoords(plot[0][0],plot[0][1]);
                var br = getCoords(plot[3][0],plot[3][1]);
                var anv = getCoords(plot[5][0],plot[5][1]);
                Forge({
                  x:fg[0],
                  y:fg[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Firepit({
                  x:fp[0],
                  y:fp[1],
                  z:0,
                  qty:1,
                  parent:b.id
                });
                Barrel({
                  x:br[0],
                  y:br[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Anvil({
                  x:anv[0],
                  y:anv[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
              } else if(b.type === 'stronghold'){
                Building.list[getBuilding(self.x,self.y)].built = true;
                for(var i in plot){
                  world[3][plot[i][1]][plot[i][0]] = String('stronghold' + i);
                  if(world[3][plot[i][1]][plot[i][0]] === 'stronghold1' || world[3][plot[i][1]][plot[i][0]] === 'stronghold2'){
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB1[plot[i][1]+1][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1]+1,true);
                    world[0][plot[i][1]][plot[i][0]] = 16;
                  } else if(world[3][plot[i][1]][plot[i][0]] === 'stronghold0' || world[3][plot[i][1]][plot[i][0]] === 'stronghold3'){
                    matrixO[plot[i][1]][plot[i][0]] = 1;
                    gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    world[0][plot[i][1]][plot[i][0]] = 15;
                  } else if(world[3][plot[i][1]][plot[i][0]] === 'stronghold7' ||
                  world[3][plot[i][1]][plot[i][0]] === 'stronghold8' ||
                  world[3][plot[i][1]][plot[i][0]] === 'stronghold15' ||
                  world[3][plot[i][1]][plot[i][0]] === 'stronghold16' ||
                  world[3][plot[i][1]][plot[i][0]] === 'stronghold23' ||
                  world[3][plot[i][1]][plot[i][0]] === 'stronghold24' ||
                  world[3][plot[i][1]][plot[i][0]] === 'stronghold31' ||
                  world[3][plot[i][1]][plot[i][0]] === 'stronghold32' ||
                  world[3][plot[i][1]][plot[i][0]] === 'stronghold39' ||
                  world[3][plot[i][1]][plot[i][0]] === 'stronghold40' ||
                  world[3][plot[i][1]][plot[i][0]] === 'stronghold46' ||
                  world[3][plot[i][1]][plot[i][0]] === 'stronghold47' ||
                  world[3][plot[i][1]][plot[i][0]] === 'stronghold53' ||
                  world[3][plot[i][1]][plot[i][0]] === 'stronghold54'){
                    matrixO[plot[i][1]][plot[i][0]] = 1;
                    gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB2[plot[i][1]][plot[i][0]] = 0;
                    gridB2.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB3[plot[i][1]][plot[i][0]] = 0;
                    gridB3.setWalkableAt(plot[i][0],plot[i][1],true);
                    world[0][plot[i][1]][plot[i][0]] = 17;
                    world[5][plot[i][1]][plot[i][0]] = 15;
                    world[8][plot[i][1]][plot[i][0]] = 1;
                  } else {
                    matrixO[plot[i][1]][plot[i][0]] = 1;
                    gridO.setWalkableAt(plot[i][0],plot[i][1],false);
                    matrixB1[plot[i][1]][plot[i][0]] = 0;
                    gridB1.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB2[plot[i][1]][plot[i][0]] = 0;
                    gridB2.setWalkableAt(plot[i][0],plot[i][1],true);
                    matrixB3[plot[i][1]][plot[i][0]] = 0;
                    gridB3.setWalkableAt(plot[i][0],plot[i][1],true);
                    world[0][plot[i][1]][plot[i][0]] = 15;
                    world[5][plot[i][1]][plot[i][0]] = 15;
                    world[8][plot[i][1]][plot[i][0]] = 1;
                  }
                }
                var ii = 58;
                for(var i in top){
                  var n = top[i];
                  world[5][n[1]][n[0]] = String('stronghold' + ii);
                  ii++;
                }
                for(var i in walls){
                  var n = walls[i];
                  if(world[5][n[1]][n[0]] === 'stronghold58' || world[5][n[1]][n[0]] === 'stronghold62'){
                    world[4][n[1]][n[0]] = 7;
                    matrixB1[n[1]][n[0]] = 0;
                    gridB1.setWalkableAt(n[0],n[1],true);
                    matrixB2[n[1]][n[0]] = 0;
                    gridB2.setWalkableAt(n[0],n[1],true);
                  } else {
                    world[4][n[1]][n[0]] = 2;
                  }
                }
                matrixB1[walls[0][1]][walls[0][0]] = 0;
                gridB1.setWalkableAt(walls[0][0],walls[0][1],true);
                matrixB3[walls[0][1]][walls[0][0]] = 0;
                gridB3.setWalkableAt(walls[0][0],walls[0][1],true);
                world[4][walls[0][1]][walls[0][0]] = 6;
                world[8][walls[0][1]][walls[0][0]] = 5;
                var sa1 = getCoords(walls[2][0],walls[2][1]);
                var thr = getCoords(walls[3][0],walls[3][1]);
                var b2 = getCoords(walls[4][0],walls[4][1]);
                var sa2 = getCoords(walls[5][0],walls[5][1]);
                var sr = getCoords(walls[7][0],walls[7][1]);
                var fp1 = getCoords(plot[0][0],plot[0][1]);
                var fp2 = getCoords(plot[3][0],plot[3][1]);
                var fp3 = getCoords(plot[22][0],plot[22][1]);
                var fp4 = getCoords(plot[25][0],plot[25][1]);
                var fp5 = getCoords(plot[45][0],plot[45][1]);
                var fp6 = getCoords(plot[48][0],plot[48][1]);
                var ch2 = getCoords(walls[4][0],walls[4][1]);
                var ch3 = getCoords(walls[6][0],walls[6][1]);
                var fp7 = getCoords(plot[24][0],plot[24][1]);
                var j1 = getCoords(plot[44][0],plot[44][1]);
                var j3 = getCoords(plot[46][0],plot[46][1]);
                var j4 = getCoords(plot[47][0],plot[47][1]);
                var j6 = getCoords(plot[49][0],plot[49][1]);
                var j7 = getCoords(plot[50][0],plot[50][1]);
                SuitArmor({
                  x:sa1[0],
                  y:sa1[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Banner({
                  x:thr[0],
                  y:thr[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Banner({
                  x:b2[0],
                  y:b2[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Throne({
                  x:thr[0],
                  y:thr[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                SuitArmor({
                  x:sa2[0],
                  y:sa2[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Swordrack({
                  x:sr[0],
                  y:sr[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Firepit({
                  x:fp1[0],
                  y:fp1[1],
                  z:0,
                  qty:1,
                  parent:b.id
                });
                Firepit({
                  x:fp1[0],
                  y:fp1[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Firepit({
                  x:fp2[0],
                  y:fp2[1],
                  z:0,
                  qty:1,
                  parent:b.id
                });
                Firepit({
                  x:fp2[0],
                  y:fp2[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Firepit({
                  x:fp3[0],
                  y:fp3[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Firepit({
                  x:fp4[0],
                  y:fp4[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Firepit({
                  x:fp5[0],
                  y:fp5[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                Firepit({
                  x:fp6[0],
                  y:fp6[1],
                  z:1,
                  qty:1,
                  parent:b.id
                });
                WallTorch({
                  x:sa1[0],
                  y:sa1[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Bed({
                  x:thr[0],
                  y:thr[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                WallTorch({
                  x:sa2[0],
                  y:sa2[1],
                  z:2,
                  qty:1,
                  parent:b.id
                });
                Chains({
                  x:sa1[0],
                  y:sa1[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                Chains({
                  x:ch2[0],
                  y:ch2[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                Chains({
                  x:ch3[0],
                  y:ch3[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                Jail({
                  x:j1[0],
                  y:j1[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                Jail({
                  x:fp5[0],
                  y:fp5[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                Jail({
                  x:j3[0],
                  y:j3[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                WallTorch({
                  x:j3[0],
                  y:j3[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                JailDoor({
                  x:j4[0],
                  y:j4[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                Jail({
                  x:fp6[0],
                  y:fp6[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                WallTorch({
                  x:fp6[0],
                  y:fp6[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                Jail({
                  x:j6[0],
                  y:j6[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                Jail({
                  x:j7[0],
                  y:j7[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
                Firepit({
                  x:fp7[0],
                  y:fp7[1],
                  z:-2,
                  qty:1,
                  parent:b.id
                });
              }
              io.emit('mapEdit',world);
            }
          }
        },10000/self.strength);
      } else {
        return;
      }
    }

    // CLASS
    if(self.gear.head && self.gear.head.name === 'crown' && self.crowned){
      self.class = 'King';
      self.spriteSize = tileSize;
    } else if(self.gear.armor){
      if(self.gear.armor.type === 'leather'){
        if(self.mounted && self.gear.weapon){
          if(self.gear.weapon.type === 'bow'){
            self.class = 'Ranger';
            self.spriteSize = tileSize * 2;
          } else {
            self.class = 'Scout';
            self.spriteSize = tileSize * 2;
          }
        } else if(self.mounted){
          self.class = 'Scout';
          self.spriteSize = tileSize * 2;
        } else {
          if(self.gear.weapon){
            if(self.gear.weapon.type === 'bow'){
              self.class = 'Hunter';
              self.spriteSize = tileSize * 1.5;
            } else {
              self.class = 'Rogue';
              self.spriteSize = tileSize * 1.5;
            }
          } else {
            self.class = 'Rogue';
            self.spriteSize = tileSize * 1.5;
          }
        }
      } else if(self.gear.armor.type === 'chainmail'){
        if(self.mounted && self.gear.weapon){
          if(self.gear.weapon.type === 'bow'){
            self.class = 'MountedArcher';
            self.spriteSize = tileSize * 2;
          } else {
            self.class = 'Horseman';
            self.spriteSize = tileSize * 2;
          }
        } else if(self.mounted){
          self.class = 'Horseman';
          self.spriteSize = tileSize * 2;
        } else if(self.gear.weapon){
          if(self.gear.weapon.type === 'bow'){
            self.class = 'Archer';
            self.spriteSize = tileSize * 1.5;
          } else {
            self.class = 'Swordsman';
            self.spriteSize = tileSize * 1.5;
          }
        } else {
          self.class = 'Swordsman';
          self.spriteSize = tileSize * 1.5;
        }
      } else if(self.gear.armor.type === 'plate'){
        if(self.knighted){
          if(self.mounted && self.gear.weapon){
            if(self.gear.weapon.type === 'lance'){
              self.class = 'Crusader';
              self.spriteSize = tileSize * 3;
            } else {
              self.class = 'Knight';
              self.spriteSize = tileSize * 2;
            }
          } else if(self.mounted){
            self.class = 'Knight';
            self.spriteSize = tileSize * 2;
          } else {
            self.class = 'Templar';
            self.spriteSize = tileSize * 1.5;
          }
        } else {
          if(self.mounted && self.gear.weapon){
            if(self.gear.weapon.type === 'lance'){
              self.class = 'Lancer';
              self.spriteSize = tileSize * 3;
            } else {
              self.class = 'Cavalry';
              self.spriteSize = tileSize * 2;
            }
          } else if(self.mounted){
            self.class = 'Cavalry';
            self.spriteSize = tileSize * 2;
          } else {
            self.class = 'Hero';
            self.spriteSize = tileSize * 1.5;
          }
        }
      } else if(self.gear.armor.type === 'cloth'){
        if(self.gear.armor.name === 'MonkCowl'){
          self.class = 'Mage';
          self.spriteSize = tileSize * 1.5;
        } else if(self.gear.armor.name === 'BlackCloak'){
          self.class = 'Warlock';
          self.spriteSize = tileSize * 1.5;
        } else {
          self.class = 'Priest';
          self.spriteSize = tileSize;
        }
      }
    } else {
      self.class = 'Serf';
      self.spriteSize = tileSize * 1.5;
    }
  }

  self.lightTorch = function(torchId){
    if(self.hasTorch){
      Item.list[self.hasTorch].toRemove = true;
      self.hasTorch = false;
    } else if(self.inventory.torch > 0){
      if(self.z !== -3){
        LitTorch({
          id:torchId,
          parent:self.id,
          x:self.x,
          y:self.y,
          z:self.z,
          qty:1
        })
        self.inventory.torch--;
        self.hasTorch = torchId;
      } else {
        SOCKET_LIST[self.id].emit('addToChat','<i>You cannot do that here.</i>');
      }
    } else {
      SOCKET_LIST[self.id].emit('addToChat','<i>You have no torches.</i>');
    }
  }

  // x,y movement
  self.updateSpd = function(){
    var loc = getLoc(self.x, self.y);
    var rLoc = getLoc(self.x + (tileSize/8), self.y);
    var lLoc = getLoc(self.x - (tileSize/8), self.y);
    var uLoc = getLoc(self.x, self.y - (tileSize/8));
    var dLoc = getLoc(self.x, self.y + (tileSize/2));
    var b = getBuilding(self.x,self.y);
    var rightBlocked = false;
    var leftBlocked = false;
    var upBlocked = false;
    var downBlocked = false;

    // outdoor collisions
    if(self.z === 0){
      if(((getTile(0,rLoc[0],rLoc[1]) === 19 && !keyCheck(self.x+(tileSize/2),self.y,self.id)) ||
      (!isWalkable(0,rLoc[0],rLoc[1]) && getTile(0,rLoc[0],rLoc[1]) !== 0) ||
      (self.x + 10) > (mapPx - tileSize)) && isWalkable(0,loc[0],loc[1])){
        rightBlocked = true;
      }
      if(((getTile(0,lLoc[0],lLoc[1]) === 19 && !keyCheck(self.x-(tileSize/2),self.y,self.id)) || (!isWalkable(0,lLoc[0],lLoc[1]) && getTile(0,lLoc[0],lLoc[1]) !== 0) ||
      (self.x - 10) < 0) && isWalkable(0,loc[0],loc[1])){
        leftBlocked = true;
      }
      if(((getTile(0,uLoc[0],uLoc[1]) === 19 && !keyCheck(self.x,self.y-(tileSize/2),self.id)) || (!isWalkable(0,uLoc[0],uLoc[1]) && getTile(0,uLoc[0],uLoc[1]) !== 0) ||
      (getTile(5,uLoc,uLoc[1]) === 'gatec' && !gateCheck(self.x,self.y-(tileSize/2),self.house,self.kingdom)) ||
      (self.y - 10) < 0) && isWalkable(0,loc[0],loc[1])){
        upBlocked = true;
      }
      if((getTile(0,dLoc[0],dLoc[1]) === 6 || (getTile(0,dLoc[0],dLoc[1]) === 19 && !keyCheck(self.x,self.y+(tileSize/2),self.id)) || (!isWalkable(0,dLoc[0],dLoc[1]) && getTile(0,dLoc[0],dLoc[1]) !== 0) ||
      (getTile(5,dLoc[0],dLoc[1]) === 'gatec' && !gateCheck(self.x,self.y+(tileSize/2),self.house,self.kingdom)) ||
      (self.y + 10) > (mapPx - tileSize)) && isWalkable(0,loc[0],loc[1])){
        downBlocked = true;
      }
    }

    // cave collisions
    if(self.z === -1){
      if(!isWalkable(-1,rLoc[0],rLoc[1]) || getTile(1,rLoc[0],rLoc[1]) === 2 || (self.x + 10) > (mapPx - tileSize)){
        rightBlocked = true;
      }
      if(!isWalkable(-1,lLoc[0],lLoc[1]) || getTile(1,lLoc[0],lLoc[1]) === 2 || (self.x - 10) < 0){
        leftBlocked = true;
      }
      if(!isWalkable(-1,uLoc[0],uLoc[1]) || getTile(1,uLoc[0],uLoc[1]) === 2 || (self.y - 10) < 0){
        upBlocked = true;
      }
      if(!isWalkable(-1,dLoc[0],dLoc[1]) || (self.y + 10) > (mapPx - tileSize)){
        downBlocked = true;
      }
    }

    // indoor1 collisions
    if(self.z === 1){
      if(!isWalkable(1,rLoc[0],rLoc[1])){
        rightBlocked = true;
      }
      if(!isWalkable(1,lLoc[0],lLoc[1])){
        leftBlocked = true;
      }
      if(!isWalkable(1,uLoc[0],uLoc[1]) || (getTile(4,uLoc[0],uLoc[1]) === 7 && !self.rank &&
      (Building.list[b].house === self.house || Building.list[b].kingdom === self.kingdom))){
        upBlocked = true;
      }
      if(!isWalkable(1,dLoc[0],dLoc[1])){
        downBlocked = true;
      }
    }

    // indoor2 collisions
    if(self.z === 2){
      if(!isWalkable(2,rLoc[0],rLoc[1])){
        rightBlocked = true;
      }
      if(!isWalkable(2,lLoc[0],lLoc[1])){
        leftBlocked = true;
      }
      if(!isWalkable(2,uLoc[0],uLoc[1])){
        upBlocked = true;
      }
      if(!isWalkable(2,dLoc[0],dLoc[1])){
        downBlocked = true;
      }
    }

    // cellar/dungeon collisions
    if(self.z === -2){
      if(!isWalkable(-2,rLoc[0],rLoc[1])){
        rightBlocked = true;
      }
      if(!isWalkable(-2,lLoc[0],lLoc[1])){
        leftBlocked = true;
      }
      if(!isWalkable(-2,uLoc[0],uLoc[1])){
        upBlocked = true;
      }
      if(!isWalkable(-2,dLoc[0],dLoc[1])){
        downBlocked = true;
      }
    }

    if(self.pressingRight){
      self.facing = 'right';
      self.working = false;
      self.chopping = false;
      self.mining = false;
      self.farming = false;
      self.building = false;
      self.fishing = false;
      if(!rightBlocked){
        self.x += self.maxSpd;
      }
    } else if(self.pressingLeft){
      self.facing = 'left';
      self.working = false;
      self.chopping = false;
      self.mining = false;
      self.farming = false;
      self.building = false;
      self.fishing = false;
      if(!leftBlocked){
        self.x -= self.maxSpd;
      }
    }

    if(self.pressingUp){
      self.facing = 'up';
      self.working = false;
      self.chopping = false;
      self.mining = false;
      self.farming = false;
      self.building = false;
      self.fishing = false;
      if(!upBlocked){
        self.y -= self.maxSpd;
      }
    } else if(self.pressingDown){
      self.facing = 'down';
      self.working = false;
      self.chopping = false;
      self.mining = false;
      self.farming = false;
      self.building = false;
      self.fishing = false;
      if(!downBlocked){
        self.y += self.maxSpd;
      }
    }

    // terrain effects and z movement
    if(self.z === 0){
      if(getTile(0,loc[0],loc[1]) === 6){
        self.z = -1;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd;
      } else if(getTile(0,loc[0],loc[1]) >= 1 && getTile(0,loc[0],loc[1]) < 2){
        self.innaWoods = true;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 0.3;
      } else if(getTile(0,loc[0],loc[1]) >= 2 && getTile(0,loc[0],loc[1]) < 4){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 0.5;
      } else if(getTile(0,loc[0],loc[1]) >= 4 && getTile(0,loc[0],loc[1]) < 5){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 0.6;
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && !self.onMtn){
        self.innaWoods = false;
        self.maxSpd = self.baseSpd * 0.2;
        setTimeout(function(){
          if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6){
            self.onMtn = true;
          }
        },2000);
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && self.onMtn){
        self.maxSpd = self.baseSpd * 0.5;
      } else if(getTile(0,loc[0],loc[1]) === 18){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 1.1;
      } else if(getTile(0,loc[0],loc[1]) === 14 || getTile(0,loc[0],loc[1]) === 16 || getTile(0,loc[0],loc[1]) === 19){
        self.z = 1;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd;
      } else if(getTile(0,loc[0],loc[1]) === 19){
        self.z = 1;
        SOCKET_LIST[self.id].emit('addToChat','<i>🗝 You unlock the door.</i>');
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd;
      } else if(getTile(0,loc[0],loc[1]) === 0){
        self.z = -3;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 0.1;
      } else {
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd;
      }
    } else if(self.z === -1){
      if(getTile(1,loc[0],loc[1]) === 2){
        self.z = 0;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 0.9;
      }
    } else if(self.z === -2){
      if(getTile(8,loc[0],loc[1]) === 5){
        self.z = 1;
        self.y += (tileSize/2);
        self.facing = 'down';
      }
    } else if(self.z === -3){
      if(self.breath > 0){
        self.breath -= 0.25;
      } else {
        self.hp -= 0.5;
      }
      if(getTile(0,loc[0],loc[1]) !== 0){
        self.z = 0;
        self.breath = self.breathMax;
      }
    } else if(self.z === 1){
      if(getTile(0,loc[0],loc[1] - 1) === 14 || getTile(0,loc[0],loc[1] - 1) === 16  || getTile(0,loc[0],loc[1] - 1) === 19){
        self.z = 0;
      } else if(getTile(4,loc[0],loc[1]) === 3 || getTile(4,loc[0],loc[1]) === 4 || getTile(4,loc[0],loc[1]) === 7){
        self.z = 2;
        self.y += (tileSize/2);
        self.facing = 'down'
      } else if(getTile(4,loc[0],loc[1]) === 5 || getTile(4,loc[0],loc[1]) === 6){
        self.z = -2;
        self.y += (tileSize/2);
        self.facing = 'down';
      }
    } else if(self.z === 2){
      if(getTile(4,loc[0],loc[1]) === 3 || getTile(4,loc[0],loc[1]) === 4){
        self.z = 1;
        self.y += (tileSize/2);
        self.facing = 'down';
      }
    }
  }

  self.getInitPack = function(){
    return {
      type:self.type,
      name:self.name,
      id:self.id,
      house:self.house,
      kingdom:self.kingdom,
      x:self.x,
      y:self.y,
      z:self.z,
      class:self.class,
      rank:self.rank,
      friends:self.friends,
      enemies:self.enemies,
      gear:self.gear,
      inventory:{
        arrows:self.inventory.arrows
      },
      spriteSize:self.spriteSize,
      innaWoods:self.innaWoods,
      facing:self.facing,
      stealthed:self.stealthed,
      visible:self.visible,
      hp:self.hp,
      hpMax:self.hpMax,
      spirit:self.spirit,
      spiritMax:self.spiritMax,
      breath:self.breath,
      breathMax:self.breathMax
    };
  }

  self.getUpdatePack = function(){
    return {
      id:self.id,
      house:self.house,
      kingdom:self.kingdom,
      x:self.x,
      y:self.y,
      z:self.z,
      class:self.class,
      rank:self.rank,
      friends:self.friends,
      enemies:self.enemies,
      gear:self.gear,
      inventory:{
        arrows:self.inventory.arrows
      },
      spriteSize:self.spriteSize,
      innaWoods:self.innaWoods,
      facing:self.facing,
      stealthed:self.stealthed,
      visible:self.visible,
      pressingUp:self.pressingUp,
      pressingDown:self.pressingDown,
      pressingLeft:self.pressingLeft,
      pressingRight:self.pressingRight,
      pressingAttack:self.pressingAttack,
      angle:self.mouseAngle,
      working:self.working,
      chopping:self.chopping,
      mining:self.mining,
      farming:self.farming,
      building:self.building,
      fishing:self.fishing,
      hp:self.hp,
      hpMax:self.hpMax,
      spirit:self.spirit,
      spiritMax:self.spiritMax,
      breath:self.breath,
      breathMax:self.breathMax
    }
  }

  // !!! ALPHA HAX !!!
  for(var i in self.inventory){
    self.inventory[i] += 10;
  }
  self.hasHorse = true;
  self.knighted = true;
  // !!! ALPHA HAX !!!

  Player.list[self.id] = self;

  initPack.player.push(self.getInitPack());
  return self;
}

Player.list = {};

Player.onConnect = function(socket,name){
  var spawn = randomSpawnO();
  var player = Player({
    name:name,
    id:socket.id,
    z: 0,
    x: spawn[0],
    y: spawn[1],
    home:{z:0,
      x:spawn[0],
      y:spawn[1]}
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
    } else if(data.inputId === 'e'){
      player.pressingE = data.state;
    } else if(data.inputId === 't'){
      player.pressingT = data.state;
    } else if(data.inputId === 'i'){
      player.pressingI = data.state;
    } else if(data.inputId === 'p'){
      player.pressingP = data.state;
    } else if(data.inputId === 'f'){
      player.pressingF = data.state;
    } else if(data.inputId === 'h'){
      player.pressingH = data.state;
    } else if(data.inputId === 'k'){
      player.pressingK = data.state;
    } else if(data.inputId === 'l'){
      player.pressingL = data.state;
    } else if(data.inputId === 'x'){
      player.pressingX = data.state;
    } else if(data.inputId === 'c'){
      player.pressingC = data.state;
    } else if(data.inputId === 'b'){
      player.pressingB = data.state;
    } else if(data.inputId === 'n'){
      player.pressingN = data.state;
    } else if(data.inputId === 'm'){
      player.pressingM = data.state;
    } else if(data.inputId === '1'){
      player.pressing1 = data.state;
    } else if(data.inputId === '2'){
      player.pressing2 = data.state;
    } else if(data.inputId === '3'){
      player.pressing3 = data.state;
    } else if(data.inputId === '4'){
      player.pressing4 = data.state;
    } else if(data.inputId === '5'){
      player.pressing5 = data.state;
    } else if(data.inputId === '6'){
      player.pressing6 = data.state;
    } else if(data.inputId === '7'){
      player.pressing7 = data.state;
    } else if(data.inputId === '8'){
      player.pressing8 = data.state;
    } else if(data.inputId === '9'){
      player.pressing9 = data.state;
    } else if(data.inputId === '0'){
      player.pressing0 = data.state;
    } else if(data.inputId === 'mouseAngle'){
      player.mouseAngle = data.state;
    }
  });

  socket.on('sendMsgToServer',function(data){
    for(var i in SOCKET_LIST){
      SOCKET_LIST[i].emit('addToChat','<b>' + data.name + ':</b> ' + data.message);
    }
  });

  socket.on('sendPmToServer',function(data){
    var recipient = null;
    for(var i in Player.list){
      if(Player.list[i].name === data.recip){
        recipient = SOCKET_LIST[i];
      }
    }
    if(recipient === null){
      socket.emit('addToChat','<i>' + data.recip + ' is not online.</i>');
    } else {
      recipient.emit('addToChat','<b>@' + player.name + '</b> whispers: <i>' + data.message + '</i>');
      SOCKET_LIST[player.id].emit('addToChat','To ' + data.recip + ': <i>' + data.message + '</i>');
    }
  });

  socket.emit('newBuilding',{
    bCount:buildingCount,
    bId:buildingId,
    bList:Building.list
  })

  socket.emit('newFaction',{
    houseList:House.list,
    kingdomList:Kingdom.list
  })

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
  self.innaWoods = false;

  self.timer = 0;
  self.toRemove = false;
  var super_update = self.update;
  self.update = function(){
    if(self.z === 0 && getLocTile(0,self.x,self.y) >= 1 && getLocTile(0,self.x,self.y) < 2){
      self.innaWoods = true;
    } else {
      self.innaWoods = false;
    }
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
          var spawn = randomSpawnO();
          p.x = spawn[0]; // replace this
          p.y = spawn[1]; // replace this
        }
        self.toRemove = true;
      } else if(self.x === 0 || self.x === mapPx || self.y === 0 || self.y === mapPx){
        self.toRemove = true;
      } else if(self.z === 0 && getLocTile(0,self.x,self.y) === 5 && getLocTile(0,Player.list[self.parent].x,Player.list[self.parent].y) !== 5){
        self.toRemove = true;
      } else if(self.z === 0 && getLocTile(0,self.x,self.y) === 1 && getLocTile(0,Player.list[self.parent].x,Player.list[self.parent].y) !== 1){
        self.toRemove = true;
      } else if(self.z === 0 && (getLocTile(0,self.x,self.y) === 13 || getLocTile(0,self.x,self.y) === 14 || getLocTile(0,self.x,self.y) === 15 || getLocTile(0,self.x,self.y) === 16 || getLocTile(0,self.x,self.y) === 19)){
        self.toRemove = true;
      } else if(self.z === -1 && getLocTile(1,self.x,self.y) === 1){
        self.toRemove = true;
      } else if(self.z === -2 && getLocTile(8,self.x,self.y) === 0){
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
      z:self.z,
      innaWoods:self.innaWoods
    };
  }

  self.getUpdatePack = function(){
    return {
      id:self.id,
      x:self.x,
      y:self.y,
      z:self.z,
      innaWoods:self.innaWoods
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
  self.qty = param.qty;
  self.type = null;
  self.class = null;
  self.rank = null; // 0 = common, 1 = rare, 2 = lore, 3 = mythic, 4 = relic
  self.parent = param.parent;
  self.canPickup = true;
  self.toRemove = false;
  self.innaWoods = false;
  if(self.z === 0 && getLocTile(0,self.x,self.y) >= 1 && getLocTile(0,self.x,self.y) < 2){
    self.innaWoods = true;
  }

  self.blocker = function(n){
    var loc = getLoc(self.x,self.y);
    if(self.z === 0){
      matrixO[loc[1]][loc[0]] = n;
      gridO.setWalkableAt(loc[1],loc[0],false);
    } else if(self.z === 1){
      matrixB1[loc[1]][loc[0]] = n;
      gridB1.setWalkableAt(loc[1],loc[0],false);
    } else if(self.z === 2){
      matrixB2[loc[1]][loc[0]] = n;
      gridB2.setWalkableAt(loc[1],loc[0],false);
    } else if(self.z === -1){
      matrixU[loc[1]][loc[0]] = n;
      gridU.setWalkableAt(loc[1],loc[0],false);
    } else if(self.z === -2){
      matrixB3[loc[1]][loc[0]] = n;
      gridB3.setWalkableAt(loc[1],loc[0],false);
    } else if(self.z === -3){
      matrixW[loc[1]][loc[0]] = n;
    }
  }

  self.getInitPack = function(){
    return {
      id:self.id,
      parent:self.parent,
      type:self.type,
      x:self.x,
      y:self.y,
      z:self.z,
      qty:self.qty,
      innaWoods:self.innaWoods
    };
  }

  self.getUpdatePack = function(){
    return{
      id:self.id,
      x:self.x,
      y:self.y,
      z:self.z,
      innaWoods:self.innaWoods
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

// WOOD
Wood = function(param){
  var self = Item(param);
  self.type = 'Wood';
  self.class = 'resource';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.wood > 9){
      socket.emit('addToChat','<i>You are already carrying too much</i> <b>Wood</b>.');
    } else if(player.inventory.wood + self.qty > 10){
      var q = 10 - player.inventory.wood;
      self.qty -= q;
      Player.list[id].inventory.wood += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Wood</b>.');
    } else {
      Player.list[id].inventory.wood += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Wood</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// STONE
Stone = function(param){
  var self = Item(param);
  self.type = 'Stone';
  self.class = 'resource';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.stone > 9){
      socket.emit('addToChat','<i>You are already carrying too much</i> <b>Stone</b>.');
    } else if(player.inventory.stone + self.qty > 10){
      var q = 10 - player.inventory.stone;
      self.qty -= q;
      Player.list[id].inventory.stone += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Stone</b>.');
    } else {
      Player.list[id].inventory.stone += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Stone</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// GRAIN
Grain = function(param){
  var self = Item(param);
  self.type = 'Grain';
  self.class = 'resource';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    return;
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// IRON ORE
IronOre = function(param){
  var self = Item(param);
  self.type = 'IronOre';
  self.class = 'resource';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.ironore > 9){
      socket.emit('addToChat','<i>You are already carrying too much</i> <b>IronOre</b>.');
    } else if(player.inventory.ironore + self.qty > 10){
      var q = 10 - player.inventory.ironore;
      self.qty -= q;
      Player.list[id].inventory.ironore += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>IronOre</b>.');
    } else {
      Player.list[id].inventory.ironore += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>IronOre</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// IRON BAR
IronBar = function(param){
  var self = Item(param);
  self.type = 'IronBar';
  self.class = 'resource';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.ironbar > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>IronBar</b>.');
    } else if(player.inventory.ironbar + self.qty > 10){
      var q = 10 - player.inventory.ironbar;
      self.qty -= q;
      Player.list[id].inventory.ironbar += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>IronBar</b>.');
    } else {
      Player.list[id].inventory.ironbar += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>IronBar</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// STEEL BAR
SteelBar = function(param){
  var self = Item(param);
  self.type = 'SteelBar';
  self.class = 'resource';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.steelbar > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>SteelBar</b>.');
    } else if(player.inventory.steelbar + self.qty > 10){
      var q = 10 - player.inventory.steelbar;
      self.qty -= q;
      Player.list[id].inventory.steelbar += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>SteelBar</b>.');
    } else {
      Player.list[id].inventory.steelbar += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>SteelBar</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// BOAR HIDE
BoarHide = function(param){
  var self = Item(param);
  self.type = 'BoarHide';
  self.class = 'resource';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.boarhide > 24){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>BoarHide</b>.');
    } else if(player.inventory.boarhide + self.qty > 25){
      var q = 25 - player.inventory.boarhide;
      self.qty -= q;
      Player.list[id].inventory.boarhide += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>BoarHide</b>.');
    } else {
      Player.list[id].inventory.boarhide += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>BoarHide</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// LEATHER
Leather = function(param){
  var self = Item(param);
  self.type = 'Leather';
  self.class = 'resource';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.leather > 24){
      socket.emit('addToChat','<i>You are already carrying too much</i> <b>Leather</b>.');
    } else if(player.inventory.leather + self.qty > 25){
      var q = 25 - player.inventory.leather;
      self.qty -= q;
      Player.list[id].inventory.leather += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Leather</b>.');
    } else {
      Player.list[id].inventory.leather += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Leather</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// SILVER ORE
SilverOre = function(param){
  var self = Item(param);
  self.type = 'SilverOre';
  self.class = 'resource';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.silverore > 9){
      socket.emit('addToChat','<i>You are already carrying too much</i> <b>SilverOre</b>.');
    } else if(player.inventory.silverore + self.qty > 10){
      var q = 10 - player.inventory.silverore;
      self.qty -= q;
      Player.list[id].inventory.silverore += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>SilverOre</b>.');
    } else {
      Player.list[id].inventory.silverore += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>SilverOre</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// SILVER
Silver = function(param){
  var self = Item(param);
  self.type = 'Silver';
  self.class = 'resource';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    Player.list[id].inventory.silver += self.qty;
    socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Silver</b>.');
    self.toRemove = true;
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// GOLD ORE
GoldOre = function(param){
  var self = Item(param);
  self.type = 'Goldore';
  self.class = 'resource';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.goldore > 9){
      socket.emit('addToChat','<i>You are already carrying too much</i> <b>GoldOre</b>.');
    } else if(player.inventory.goldore + self.qty > 10){
      var q = 10 - player.inventory.goldore;
      self.qty -= q;
      Player.list[id].inventory.goldore += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>GoldOre</b>.');
    } else {
      Player.list[id].inventory.goldore += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>GoldOre</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// GOLD
Gold = function(param){
  var self = Item(param);
  self.type = 'Gold';
  self.class = 'resource';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    Player.list[id].inventory.gold += self.qty;
    socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Gold</b>.');
    self.toRemove = true;
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// DIAMOND
Diamond = function(param){
  var self = Item(param);
  self.type = 'Diamond';
  self.class = 'resource';
  self.rank = 2;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    Player.list[id].inventory.diamond += self.qty;
    socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Diamond</b>.');
    self.toRemove = true;
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// HUNTING KNIFE
HuntingKnife = function(param){
  var self = Item(param);
  self.type = 'HuntingKnife';
  self.class = 'dagger';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.huntingknife > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>HuntingKnife</b>.');
    } else if(player.inventory.huntingknife + self.qty > 10){
      var q = 10 - player.inventory.huntingknife;
      self.qty -= q;
      Player.list[id].inventory.huntingknife += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>HuntingKnife</b>.');
    } else {
      Player.list[id].inventory.huntingknife += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>HuntingKnife</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

Dague = function(param){
  var self = Item(param);
  self.type = 'Dague';
  self.class = 'dagger';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.dague > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Dague</b>.');
    } else if(player.inventory.dague + self.qty > 10){
      var q = 10 - player.inventory.dague;
      self.qty -= q;
      Player.list[id].inventory.dague += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Dague</b>.');
    } else {
      Player.list[id].inventory.dague += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Dague</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

Rondel = function(param){
  var self = Item(param);
  self.type = 'Rondel';
  self.class = 'dagger';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.rondel > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Rondel</b>.');
    } else if(player.inventory.rondel + self.qty > 10){
      var q = 10 - player.inventory.rondel;
      self.qty -= q;
      Player.list[id].inventory.rondel += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Rondel</b>.');
    } else {
      Player.list[id].inventory.rondel += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Rondel</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

Misericorde = function(param){
  var self = Item(param);
  self.type = 'Misericorde';
  self.class = 'dagger';
  self.rank = 2;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.misericorde > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Misericorde</b>.');
    } else if(player.inventory.misericorde + self.qty > 10){
      var q = 10 - player.inventory.misericorde;
      self.qty -= q;
      Player.list[id].inventory.misericorde += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Misericorde</b>.');
    } else {
      Player.list[id].inventory.misericorde += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Misericorde</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// BASTARD SWORD
BastardSword = function(param){
  var self = Item(param);
  self.type = 'BastardSword';
  self.class = 'sword';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.bastardsword > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>BastardSword</b>.');
    } else if(player.inventory.bastardsword + self.qty > 10){
      var q = 10 - player.inventory.bastardsword;
      self.qty -= q;
      Player.list[id].inventory.bastardsword += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>BastardSword</b>.');
    } else {
      Player.list[id].inventory. bastardsword += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>BastardSword</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// LONGSWORD
Longsword = function(param){
  var self = Item(param);
  self.type = 'Longsword';
  self.class = 'sword';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.longsword > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Longsword</b>.');
    } else if(player.inventory.longsword + self.qty > 10){
      var q = 10 - player.inventory.longsword;
      self.qty -= q;
      Player.list[id].inventory.longsword += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Longsword</b>.');
    } else {
      Player.list[id].inventory.longsword += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Longsword</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// ZWEIHANDER
Zweihander = function(param){
  var self = Item(param);
  self.type = 'Zweihander';
  self.class = 'sword';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.zweihander > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Zweihander</b>.');
    } else if(player.inventory.zweihander + self.qty > 10){
      var q = 10 - player.inventory.zweihander;
      self.qty -= q;
      Player.list[id].inventory.zweihander += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Zweihander</b>.');
    } else {
      Player.list[id].inventory.zweihander += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Zweihander</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// MORALLTA
Morallta = function(param){
  var self = Item(param);
  self.type = 'Morallta';
  self.class = 'sword';
  self.rank = 3;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.morallta > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Morallta</b>.');
    } else if(player.inventory.morallta + self.qty > 10){
      var q = 10 - player.inventory.morallta;
      self.qty -= q;
      Player.list[id].inventory.morallta += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Morallta</b>.');
    } else {
      Player.list[id].inventory.morallta += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Morallta</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// BOW
Bow = function(param){
  var self = Item(param);
  self.type = 'Bow';
  self.class = 'bow';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.bow > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Bow</b>.');
    } else if(player.inventory.bow + self.qty > 10){
      var q = 10 - player.inventory.bow;
      self.qty -= q;
      Player.list[id].inventory.bow += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Bow</b>.');
    } else {
      Player.list[id].inventory.bow += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Bow</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// WELSH LONGBOW
WelshLongbow = function(param){
  var self = Item(param);
  self.type = 'WelshLongbow';
  self.class = 'bow';
  self.rank = 2;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.welshlongbow > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>WelshLongbow</b>.');
    } else if(player.inventory.welshlongbow + self.qty > 10){
      var q = 10 - player.inventory.welshlongbow;
      self.qty -= q;
      Player.list[id].inventory.welshlongbow += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>WelshLongbow</b>.');
    } else {
      Player.list[id].inventory.welshlongbow += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>WelshLongbow</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// KNIGHT LANCE
KnightLance = function(param){
  var self = Item(param);
  self.type = 'KnightLance';
  self.class = 'lance';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.knightlance > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>KnightLance</b>.');
    } else if(player.inventory.knightlance + self.qty > 10){
      var q = 10 - player.inventory.knightlance;
      self.qty -= q;
      Player.list[id].inventory.knightlance += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>KnightLance</b>.');
    } else {
      Player.list[id].inventory.knightlance += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>KnightLance</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// RUSTIC LANCE
RusticLance = function(param){
  var self = Item(param);
  self.type = 'RusticLance';
  self.class = 'lance';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.rusticlance > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>RusticLance</b>.');
    } else if(player.inventory.rusticlance + self.qty > 10){
      var q = 10 - player.inventory.rusticlance;
      self.qty -= q;
      Player.list[id].inventory.rusticlance += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>RusticLance</b>.');
    } else {
      Player.list[id].inventory.rusticlance += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>RusticLance</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// PALADIN LANCE
PaladinLance = function(param){
  var self = Item(param);
  self.type = 'PaladinLance';
  self.class = 'lance';
  self.rank = 2;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.paladinlance > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>PaladinLance</b>.');
    } else if(player.inventory.paladinlance + self.qty > 10){
      var q = 10 - player.inventory.paladinlance;
      self.qty -= q;
      Player.list[id].inventory.paladinlance += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>PaladinLance</b>.');
    } else {
      Player.list[id].inventory.paladinlance += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>PaladinLance</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// BRIGANDINE
Brigandine = function(param){
  var self = Item(param);
  self.type = 'Brigandine';
  self.class = 'leather';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.brigandine > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Brigandine</b>.');
    } else if(player.inventory.brigandine + self.qty > 10){
      var q = 10 - player.inventory.brigandine;
      self.qty -= q;
      Player.list[id].inventory.brigandine += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Brigandine</b>.');
    } else {
      Player.list[id].inventory.brigandine += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Brigandine</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// LAMELLAR
Lamellar = function(param){
  var self = Item(param);
  self.type = 'Lamellar';
  self.class = 'leather';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.lamellar > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Lamellar</b>.');
    } else if(player.inventory.lamellar + self.qty > 10){
      var q = 10 - player.inventory.lamellar;
      self.qty -= q;
      Player.list[id].inventory.lamellar += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Lamellar</b>.');
    } else {
      Player.list[id].inventory.lamellar += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Lamellar</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// IRON MAIL
Maille = function(param){
  var self = Item(param);
  self.type = 'Maille';
  self.class = 'chainmail';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.maille > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Maille</b>.');
    } else if(player.inventory.maille + self.qty > 10){
      var q = 10 - player.inventory.maille;
      self.qty -= q;
      Player.list[id].inventory.maille += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Maille</b>.');
    } else {
      Player.list[id].inventory.maille += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Maille</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// STEEL MAIL
Hauberk = function(param){
  var self = Item(param);
  self.type = 'Hauberk';
  self.class = 'chainmail';
  self.rank = 0;
  self.canPickup = true;
  Item.list[self.id] = self;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.hauberk > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Hauberk</b>.');
    } else if(player.inventory.hauberk + self.qty > 10){
      var q = 10 - player.inventory.hauberk;
      self.qty -= q;
      Player.list[id].inventory.hauberk += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Hauberk</b>.');
    } else {
      Player.list[id].inventory.hauberk += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Hauberk</b>.');
      self.toRemove = true;
    }
  }
  initPack.item.push(self.getInitPack());
  return self;
}

// BRYNJA
Brynja = function(param){
  var self = Item(param);
  self.type = 'Brynja';
  self.class = 'chainmail';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.brynja > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Brynja</b>.');
    } else if(player.inventory.brynja + self.qty > 10){
      var q = 10 - player.inventory.brynja;
      self.qty -= q;
      Player.list[id].inventory.brynja += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Brynja</b>.');
    } else {
      Player.list[id].inventory.brynja += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Brynja</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// CUIRASS
Cuirass = function(param){
  var self = Item(param);
  self.type = 'Cuirass';
  self.class = 'plate';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.cuirass > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Cuirass</b>.');
    } else if(player.inventory.cuirass + self.qty > 10){
      var q = 10 - player.inventory.cuirass;
      self.qty -= q;
      Player.list[id].inventory.cuirass += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Cuirass</b>.');
    } else {
      Player.list[id].inventory.cuirass += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Cuirass</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// STEEL PLATE
SteelPlate = function(param){
  var self = Item(param);
  self.type = 'SteelPlate';
  self.class = 'plate';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.steelplate > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>SteelPlate</b>.');
    } else if(player.inventory.steelplate + self.qty > 10){
      var q = 10 - player.inventory.steelplate;
      self.qty -= q;
      Player.list[id].inventory.steelplate += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>SteelPlate</b>.');
    } else {
      Player.list[id].inventory.steelplate += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>SteelPlate</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// GREENWICH PLATE
GreenwichPlate = function(param){
  var self = Item(param);
  self.type = 'GreenwichPlate';
  self.class = 'plate';
  self.rank = 2;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.greenwichplate > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>GreenwichPlate</b>.');
    } else if(player.inventory.greenwichplate + self.qty > 10){
      var q = 10 - player.inventory.greenwichplate;
      self.qty -= q;
      Player.list[id].inventory.greenwichplate += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>GreenwichPlate</b>.');
    } else {
      Player.list[id].inventory.greenwichplate += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>GreenwichPlate</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// GOTHIC PLATE
GothicPlate = function(param){
  var self = Item(param);
  self.type = 'GothicPlate';
  self.class = 'plate';
  self.rank = 3;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.gothicplate > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>GothicPlate</b>.');
    } else if(player.inventory.gothicplate + self.qty > 10){
      var q = 10 - player.inventory.gothicplate;
      self.qty -= q;
      Player.list[id].inventory.gothicplate += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>GothicPlate</b>.');
    } else {
      Player.list[id].inventory.gothicplate += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>GothicPlate</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// CLERIC ROBE
ClericRobe = function(param){
  var self = Item(param);
  self.type = 'ClericRobe';
  self.class = 'cloth';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.clericrobe > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>ClericRobe</b>.');
    } else if(player.inventory.clericrobe + self.qty > 10){
      var q = 10 - player.inventory.clericrobe;
      self.qty -= q;
      Player.list[id].inventory.clericrobe += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>ClericRobe</b>.');
    } else {
      Player.list[id].inventory.clericrobe += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>ClericRobe</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// MONK COWL
MonkCowl = function(param){
  var self = Item(param);
  self.type = 'MonkCowl';
  self.class = 'cloth';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.monkcowl > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>MonkCowl</b>.');
    } else if(player.inventory.monkcowl + self.qty > 10){
      var q = 10 - player.inventory.monkcowl;
      self.qty -= q;
      Player.list[id].inventory.monkcowl += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>MonkCowl</b>.');
    } else {
      Player.list[id].inventory.monkcowl += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>MonkCowl</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// BLACK CLOAK
BlackCloak = function(param){
  var self = Item(param);
  self.type = 'BlackCloak';
  self.class = 'cloth';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.blackcloak > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>BlackCloak</b>.');
    } else if(player.inventory.blackcloak + self.qty > 10){
      var q = 10 - player.inventory.blackcloak;
      self.qty -= q;
      Player.list[id].inventory.blackcloak += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>BlackCloak</b>.');
    } else {
      Player.list[id].inventory.blackcloak += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>BlackCloak</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// TOME
Tome = function(param){
  var self = Item(param);
  self.type = 'Tome';
  self.class = 'text';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.tome > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Tome</b>.');
    } else if(player.inventory.tome + self.qty > 10){
      var q = 10 - player.inventory.tome;
      self.qty -= q;
      Player.list[id].inventory.tome += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Tome</b>.');
    } else {
      Player.list[id].inventory.tome += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Tome</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// RUNIC SCROLL
RunicScroll = function(param){
  var self = Item(param);
  self.type = 'RunicScroll';
  self.class = 'text';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.runicscroll > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>RunicScroll</b>.');
    } else if(player.inventory.runicscroll + self.qty > 10){
      var q = 10 - player.inventory.runicscroll;
      self.qty -= q;
      Player.list[id].inventory.runicscroll += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>RunicScroll</b>.');
    } else {
      Player.list[id].inventory.runicscroll += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>RunicScroll</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// SACRED TEXT
SacredText = function(param){
  var self = Item(param);
  self.type = 'SacredText';
  self.class = 'text';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.sacredtext > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>SacredText</b>.');
    } else if(player.inventory.sacredtext + self.qty > 10){
      var q = 10 - player.inventory.sacredtext;
      self.qty -= q;
      Player.list[id].inventory.sacredtext += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>SacredText</b>.');
    } else {
      Player.list[id].inventory.sacredtext += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>SacredText</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// STONE AXE
StoneAxe = function(param){
  var self = Item(param);
  self.type = 'StoneAxe';
  self.class = 'tool';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.stoneaxe > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>StoneAxe</b>.');
    } else if(player.inventory.stoneaxe + self.qty > 10){
      var q = 10 - player.inventory.stoneaxe;
      self.qty -= q;
      Player.list[id].inventory.stoneaxe += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>StoneAxe</b>.');
    } else {
      Player.list[id].inventory.stoneaxe += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>StoneAxe</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// IRON AXE
IronAxe = function(param){
  var self = Item(param);
  self.type = 'IronAxe';
  self.class = 'tool';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.ironaxe > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>IronAxe</b>.');
    } else if(player.inventory.ironaxe + self.qty > 10){
      var q = 10 - player.inventory.ironaxe;
      self.qty -= q;
      Player.list[id].inventory.ironaxe += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>IronAxe</b>.');
    } else {
      Player.list[id].inventory.ironaxe += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>IronAxe</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// PICKAXE
Pickaxe = function(param){
  var self = Item(param);
  self.type = 'Pickaxe';
  self.class = 'tool';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.pickaxe > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>PickAxe</b>.');
    } else if(player.inventory.pickaxe + self.qty > 10){
      var q = 10 - player.inventory.pickaxe;
      self.qty -= q;
      Player.list[id].inventory.pickaxe += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Pickaxe</b>.');
    } else {
      Player.list[id].inventory.pickaxe += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Pickaxe</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// KEY
Key = function(param){
  var self = Item(param);
  self.type = 'Key';
  self.class = 'tool';
  self.rank = 1;
  self.canPickup = true;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// TORCH
Torch = function(param){
  var self = Item(param);
  self.type = 'Torch';
  self.class = 'tool';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.torch > 24){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Torch</b>.');
    } else if(player.inventory.torch + self.qty > 25){
      var q = 25 - player.inventory.torch;
      self.qty -= q;
      Player.list[id].inventory.torch += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Torch</b>.');
    } else {
      Player.list[id].inventory.torch += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Torch</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// LIT TORCH
LitTorch = function(param){
  var self = Item(param);
  self.type = 'LitTorch';
  self.rank = 0;
  self.canPickup = false;
  self.timer = 0;
  var super_update = self.update;
  self.update = function(){
    if(self.z === 0 && getLocTile(0,self.x,self.y) >= 1 && getLocTile(0,self.x,self.y) < 2){
      self.innaWoods = true;
    } else {
      self.innaWoods = false;
    }
    if(Player.list[self.parent]){
      self.x = Player.list[self.parent].x - (tileSize * 0.75);
      self.y = Player.list[self.parent].y - (tileSize * 0.75);
      self.z = Player.list[self.parent].z;
    } else {
      self.toRemove = true;
    }
    if(self.timer++ > 3000){
      self.toRemove = true;
      Player.list[self.parent].hasTorch = false;
    }
    if(self.z === -3){
      self.toRemove = true;
      Player.list[self.parent].hasTorch = false;
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

// WALL TORCH
WallTorch = function(param){
  var self = Item(param);
  self.type = 'WallTorch';
  self.class = 'tool';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  Light({
    parent:self.id,
    radius:1.01,
    x:self.x + (tileSize/2),
    y:self.y,
    z:self.z
  });
  return self;
}

//CAMPFIRE
Campfire = function(param){
  var self = Item(param);
  self.type = 'Campfire';
  self.class = 'tool';
  self.rank = 0;
  self.canPickup = false;
  self.timer = 0;
  var super_update = self.update;
  self.update = function(){
    if(self.timer++ > 8000){
      self.toRemove = true;
    }
    super_update();
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  Light({
    parent:self.id,
    radius:1.2,
    x:self.x + (tileSize/2),
    y:self.y + (tileSize/2),
    z:self.z
  });
  return self;
}

//CAMPFIRE
InfiniteFire = function(param){
  var self = Item(param);
  self.type = 'Campfire';
  self.class = 'tool';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  Light({
    parent:self.id,
    radius:1.2,
    x:self.x + (tileSize/2),
    y:self.y + (tileSize/2),
    z:self.z
  });
  return self;
}

// FIREPIT
Firepit = function(param){
  var self = Item(param);
  self.type = 'Firepit';
  self.class = 'tool';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  Light({
    parent:self.id,
    radius:1.2,
    x:self.x + (tileSize/2),
    y:self.y + (tileSize/2),
    z:self.z
  });
  self.blocker(1);
  return self;
}

// FIREPLACE
Fireplace = function(param){
  var self = Item(param);
  self.type = 'Fireplace';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  Light({
    parent:self.id,
    radius:1.01,
    x:self.x + (tileSize/2),
    y:self.y + (tileSize/1.5),
    z:self.z
  });
  return self;
}

// FORGE
Forge = function(param){
  var self = Item(param);
  self.type = 'Forge';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  Light({
    parent:self.id,
    radius:1.01,
    x:self.x + (tileSize/2),
    y:self.y + (tileSize * 0.75),
    z:self.z
  });
  self.blocker(self.type);
  return self;
}

// BARREL
Barrel = function(param){
  var self = Item(param);
  self.type = 'Barrel';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  self.blocker(self.type);
  return self;
}

// CRATES
Crates = function(param){
  var self = Item(param);
  self.type = 'Crates';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  self.blocker(self.type);
  return self;
}

// BOOKSHELF
Bookshelf = function(param){
  var self = Item(param);
  self.type = 'Bookshelf';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  self.blocker(self.type);
  return self;
}

// SUIT OF ARMOR
SuitArmor = function(param){
  var self = Item(param);
  self.type = 'SuitArmor';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// ANVIL
Anvil = function(param){
  var self = Item(param);
  self.type = 'Anvil';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  self.blocker(self.type);
  return self;
}

// RUNESTONE
Runestone = function(param){
  var self = Item(param);
  self.type = 'Runestone';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  self.blocker(1);
  return self;
}

// DUMMY
Dummy = function(param){
  var self = Item(param);
  self.type = 'Dummy';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  self.blocker(self.type);
  return self;
}

// CROSS
Cross = function(param){
  var self = Item(param);
  self.type = 'Cross';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// SKELETON1
Skeleton1 = function(param){
  var self = Item(param);
  self.type = 'Skeleton1';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// SKELETON2
Skeleton2 = function(param){
  var self = Item(param);
  self.type = 'Skeleton2';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// GOODS1
Goods1 = function(param){
  var self = Item(param);
  self.type = 'Goods1';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  self.blocker(self.type);
  return self;
}

// GOODS2
Goods2 = function(param){
  var self = Item(param);
  self.type = 'Goods2';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  self.blocker(self.type);
  return self;
}

// GOODS3
Goods3 = function(param){
  var self = Item(param);
  self.type = 'Goods3';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  self.blocker(self.type);
  return self;
}

// GOODS4
Goods4 = function(param){
  var self = Item(param);
  self.type = 'Goods4';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  self.blocker(self.type);
  return self;
}

// STASH1
Stash1 = function(param){
  var self = Item(param);
  self.type = 'Stash1';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  self.blocker(1);
  return self;
}

// STASH2
Stash2 = function(param){
  var self = Item(param);
  self.type = 'Stash2';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  self.blocker(1);
  return self;
}

// DESK
Desk = function(param){
  var self = Item(param);
  self.type = 'Desk';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  self.blocker(self.type);
  return self;
}

// SWORDRACK
Swordrack = function(param){
  var self = Item(param);
  self.type = 'Swordrack';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// BED
Bed = function(param){
  var self = Item(param);
  self.type = 'Bed';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// JAIL
Jail = function(param){
  var self = Item(param);
  self.type = 'Jail';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  self.blocker(1);
  return self;
}

// JAIL
JailDoor = function(param){
  var self = Item(param);
  self.type = 'JailDoor';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  self.blocker(self.type);
  return self;
}

// CHAINS
Chains = function(param){
  var self = Item(param);
  self.type = 'Chains';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// THRONE
Throne = function(param){
  var self = Item(param);
  self.type = 'Throne';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// THRONE
Banner = function(param){
  var self = Item(param);
  self.type = 'Banner';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// STAG HEAD
StagHead = function(param){
  var self = Item(param);
  self.type = 'StagHead';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// BLOOD
Blood = function(param){
  var self = Item(param);
  self.type = 'Blood';
  self.class = 'environment';
  self.rank = 0;
  self.canPickup = false;
  var super_update = self.update;
  self.update = function(){
    if(self.timer++ > 16000){
      self.toRemove = true;
    }
    super_update();
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// CHEST
Chest = function(param){
  var self = Item(param);
  self.type = 'Chest';
  self.class = 'tool';
  self.rank = 0;
  self.canPickup = false;
  self.inventory = {
    wood:0,
    stone:0,
    grain:0,
    ironore:0,
    ironbar:0,
    steelbar:0,
    boarhide:0,
    leather:0,
    silverore:0,
    silver:0,
    goldore:0,
    gold:0,
    diamond:0,
    huntingknife:0,
    dague:0,
    rondel:0,
    misericorde:0,
    bastardsword:0,
    longsword:0,
    zweihander:0,
    morallta:0,
    bow:0,
    welshlongbow:0,
    knightlance:0,
    rusticlance:0,
    paladinlance:0,
    brigandine:0,
    lamellar:0,
    maille:0,
    hauberk:0,
    brynja:0,
    cuirass:0,
    steelplate:0,
    greenwichplate:0,
    gothicplate:0,
    clericrobe:0,
    monkcowl:0,
    blackcloak:0,
    tome:0,
    runicscroll:0,
    sacredtext:0,
    stoneaxe:0,
    ironaxe:0,
    pickaxe:0,
    torch:0,
    bread:0,
    fish:0,
    lamb:0,
    boarmeat:0,
    venison:0,
    poachedfish:0,
    lambchop:0,
    boarshank:0,
    venisonloin:0,
    mead:0,
    saison:0,
    flandersredale:0,
    bieredegarde:0,
    bordeaux:0,
    bourgogne:0,
    chianti:0,
    crown:0,
    arrows:0,
    worldmap:0,
    relic:0
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  self.blocker(self.type);
  return self;
}

// LOCKED CHEST
LockedChest = function(param){
  var self = Item(param);
  self.type = 'LockedChest';
  self.class = 'tool';
  self.rank = 0;
  self.canPickup = false;
  self.inventory = {
    wood:0,
    stone:0,
    grain:0,
    ironore:0,
    ironbar:0,
    steelbar:0,
    boarhide:0,
    leather:0,
    silverore:0,
    silver:0,
    goldore:0,
    gold:0,
    diamond:0,
    huntingknife:0,
    dague:0,
    rondel:0,
    misericorde:0,
    bastardsword:0,
    longsword:0,
    zweihander:0,
    morallta:0,
    bow:0,
    welshlongbow:0,
    knightlance:0,
    rusticlance:0,
    paladinlance:0,
    brigandine:0,
    lamellar:0,
    maille:0,
    hauberk:0,
    brynja:0,
    cuirass:0,
    steelplate:0,
    greenwichplate:0,
    gothicplate:0,
    clericrobe:0,
    monkcowl:0,
    blackcloak:0,
    tome:0,
    runicscroll:0,
    sacredtext:0,
    stoneaxe:0,
    ironaxe:0,
    pickaxe:0,
    torch:0,
    bread:0,
    fish:0,
    lamb:0,
    boarmeat:0,
    venison:0,
    poachedfish:0,
    lambchop:0,
    boarshank:0,
    venisonloin:0,
    mead:0,
    saison:0,
    flandersredale:0,
    bieredegarde:0,
    bordeaux:0,
    bourgogne:0,
    chianti:0,
    crown:0,
    arrows:0,
    worldmap:0,
    relic:0
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  self.blocker(self.type);
  return self;
}

// BREAD
Bread = function(param){
  var self = Item(param);
  self.type = 'Bread';
  self.class = 'consumable';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.bread > 24){
      socket.emit('addToChat','<i>You are already carrying too much</i> <b>Bread</b>.');
    } else if(player.inventory.bread + self.qty > 25){
      var q = 25 - player.inventory.bread;
      self.qty -= q;
      Player.list[id].inventory.bread += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Bread</b>.');
    } else {
      Player.list[id].inventory.bread += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Bread</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// FISH
Fish = function(param){
  var self = Item(param);
  self.type = 'Fish';
  self.class = 'consumable';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.fish > 24){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Fish</b>.');
    } else if(player.inventory.fish + self.qty > 25){
      var q = 25 - player.inventory.fish;
      self.qty -= q;
      Player.list[id].inventory.fish += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Fish</b>.');
    } else {
      Player.list[id].inventory.fish += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Fish</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// LAMB
Lamb = function(param){
  var self = Item(param);
  self.type = 'Lamb';
  self.class = 'resource';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.lamb > 24){
      socket.emit('addToChat','<i>You are already carrying too much</i> <b>Lamb</b>.');
    } else if(player.inventory.lamb + self.qty > 25){
      var q = 25 - player.inventory.lamb;
      self.qty -= q;
      Player.list[id].inventory.lamb += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Lamb</b>.');
    } else {
      Player.list[id].inventory.lamb += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Lamb</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// BOAR MEAT
BoarMeat = function(param){
  var self = Item(param);
  self.type = 'BoarMeat';
  self.class = 'resource';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.boarmeat > 24){
      socket.emit('addToChat','<i>You are already carrying too much</i> <b>BoarMeat</b>.');
    } else if(player.inventory.boarmeat + self.qty > 25){
      var q = 25 - player.inventory.boarmeat;
      self.qty -= q;
      Player.list[id].inventory.boarmeat += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>BoarMeat</b>.');
    } else {
      Player.list[id].inventory.boarmeat += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>BoarMeat</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// VENISON
Venison = function(param){
  var self = Item(param);
  self.type = 'Venison';
  self.class = 'resource';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.venison > 24){
      socket.emit('addToChat','<i>You are already carrying too much</i> <b>Venison</b>.');
    } else if(player.inventory.venison + self.qty > 25){
      var q = 25 - player.inventory.venison;
      self.qty -= q;
      Player.list[id].inventory.venison += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Venison</b>.');
    } else {
      Player.list[id].inventory.venison += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Venison</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// POACHED FISH
PoachedFish = function(param){
  var self = Item(param);
  self.type = 'PoachedFish';
  self.class = 'consumable';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.poachedfish > 24){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>PoachedFish</b>.');
    } else if(player.inventory.poachedfish + self.qty > 25){
      var q = 25 - player.inventory.poachedfish;
      self.qty -= q;
      Player.list[id].inventory.poachedfish += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>PoachedFish</b>.');
    } else {
      Player.list[id].inventory.poachedfish += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>PoachedFish</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// LAMB CHOP
LambChop = function(param){
  var self = Item(param);
  self.type = 'LambChop';
  self.class = 'consumable';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.lambchop > 24){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>LambChop</b>.');
    } else if(player.inventory.lambchop + self.qty > 25){
      var q = 25 - player.inventory.lambchop;
      self.qty -= q;
      Player.list[id].inventory.lambchop += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>LambChop</b>.');
    } else {
      Player.list[id].inventory.lambchop += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>LambChop</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// BOAR SHANK
BoarShank = function(param){
  var self = Item(param);
  self.type = 'BoarShank';
  self.class = 'consumable';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.boarshank > 24){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>BoarShank</b>.');
    } else if(player.inventory.boarshank + self.qty > 25){
      var q = 25 - player.inventory.boarshank;
      self.qty -= q;
      Player.list[id].inventory.boarshank += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>BoarShank</b>.');
    } else {
      Player.list[id].inventory.boarshank += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>BoarShank</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// VENISON LOIN
VenisonLoin = function(param){
  var self = Item(param);
  self.type = 'VenisonLoin';
  self.class = 'consumable';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.venisonloin > 24){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>VenisonLoin</b>.');
    } else if(player.inventory.venisonloin + self.qty > 25){
      var q = 25 - player.inventory.venisonloin;
      self.qty -= q;
      Player.list[id].inventory.venisonloin += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>VenisonLoin</b>.');
    } else {
      Player.list[id].inventory.venisonloin += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>VenisonLoin</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// MEAD
Mead = function(param){
  var self = Item(param);
  self.type = 'Mead';
  self.class = 'consumable';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.mead > 24){
      socket.emit('addToChat','<i>You are already carrying too much</i> <b>Mead</b>.');
    } else if(player.inventory.mead + self.qty > 25){
      var q = 25 - player.inventory.mead;
      self.qty -= q;
      Player.list[id].inventory.mead += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Mead</b>.');
    } else {
      Player.list[id].inventory.mead += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Mead</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// SAISON
Saison = function(param){
  var self = Item(param);
  self.type = 'Saison';
  self.class = 'consumable';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.saison > 24){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Saison</b>.');
    } else if(player.inventory.saison + self.qty > 25){
      var q = 25 - player.inventory.saison;
      self.qty -= q;
      Player.list[id].inventory.saison += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Saison</b>.');
    } else {
      Player.list[id].inventory.saison += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Saison</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// FLANDERS
FlandersRedAle = function(param){
  var self = Item(param);
  self.type = 'FlandersRedAle';
  self.class = 'consumable';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.flandersredale > 24){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>FlandersRedAle</b>.');
    } else if(player.inventory.flandersredale + self.qty > 25){
      var q = 25 - player.inventory.flandersredale;
      self.qty -= q;
      Player.list[id].inventory.flandersredale += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>FlandersRedAle</b>.');
    } else {
      Player.list[id].inventory.flandersredale += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>FlandersRedAle</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// BIERE DE GARDE
BiereDeGarde = function(param){
  var self = Item(param);
  self.type = 'BiereDeGarde';
  self.class = 'consumable';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.bieredegarde > 24){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>BiereDeGarde</b>.');
    } else if(player.inventory.bieredegarde + self.qty > 25){
      var q = 25 - player.inventory.bieredegarde;
      self.qty -= q;
      Player.list[id].inventory.bieredegarde += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>BiereDeGarde</b>.');
    } else {
      Player.list[id].inventory.bieredegarde += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>BiereDeGarde</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// BORDEAUX
Bordeaux = function(param){
  var self = Item(param);
  self.type = 'Bordeaux';
  self.class = 'consumable';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.bordeaux > 24){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Bordeaux</b>.');
    } else if(player.inventory.bordeaux + self.qty > 25){
      var q = 25 - player.inventory.bordeaux;
      self.qty -= q;
      Player.list[id].inventory.bordeaux += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Bordeaux</b>.');
    } else {
      Player.list[id].inventory.bordeaux += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Bordeaux</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// BOURGOGNE
Bourgogne = function(param){
  var self = Item(param);
  self.type = 'Bourgogne';
  self.class = 'consumable';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.bourgogne > 24){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Bourgogne</b>.');
    } else if(player.inventory.bourgogne + self.qty > 25){
      var q = 25 - player.inventory.bourgogne;
      self.qty -= q;
      Player.list[id].inventory.bourgogne += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Bourgogne</b>.');
    } else {
      Player.list[id].inventory.bourgogne += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Bourgogne</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// CHIANTI
Chianti = function(param){
  var self = Item(param);
  self.type = 'Chianti';
  self.class = 'consumable';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.chianti > 24){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Chianti</b>.');
    } else if(player.inventory.chianti + self.qty > 25){
      var q = 25 - player.inventory.chianti;
      self.qty -= q;
      Player.list[id].inventory.chianti += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Chianti</b>.');
    } else {
      Player.list[id].inventory.chianti += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Chianti</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// CROWN
Crown = function(param){
  var self = Item(param);
  self.type = 'Crown';
  self.class = 'head';
  self.rank = 3;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.crown > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Crown</b>.');
    } else if(player.inventory.crown + self.qty > 10){
      var q = 10 - player.inventory.crown;
      self.qty -= q;
      Player.list[id].inventory.crown += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Crown</b>.');
    } else {
      Player.list[id].inventory.crown += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Crown</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// ARROWS
Arrows = function(param){
  var self = Item(param);
  self.type = 'Arrows';
  self.class = 'tool';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.arrows > 49){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Arrows</b>.');
    } else if(player.inventory.arrows + self.qty > 50){
      var q = 50 - player.inventory.arrows;
      self.qty -= q;
      Player.list[id].inventory.arrows += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Arrows</b>.');
    } else {
      Player.list[id].inventory.arrows += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Arrows</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// MAP
WorldMap = function(param){
  var self = Item(param);
  self.type = 'WorldMap';
  self.class = 'tool';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.worldmap > 9){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>WorldMap</b>.');
    } else if(player.inventory.worldmap + self.qty > 10){
      var q = 10 - player.inventory.worldmap;
      self.qty -= q;
      Player.list[id].inventory.worldmap += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>WorldMap</b>.');
    } else {
      Player.list[id].inventory.worldmap += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>WorldMap</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// RELIC
Relic = function(param){
  var self = Item(param);
  self.type = 'Relic';
  self.class = 'relic';
  self.rank = 4;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.relic > 0){
      socket.emit('addToChat','<i>You are already carrying a</i> <b>Relic</b>.');
    } else {
      Player.list[id].inventory.relic += self.qty;
      socket.emit('addToChat','<i>You picked up the</i> <b>Relic</b>.');
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// LIGHT SOURCE
Light = function(param){
  var self = Entity(param);
  self.parent = param.parent;
  self.radius = param.radius;
  self.toRemove = false;
  var super_update = self.update;
  if(Item.list[self.parent].type === 'LitTorch'){
    self.update = function(){
      if(Item.list[self.parent]){
        self.x = Item.list[self.parent].x + (tileSize * 0.25);
        self.y = Item.list[self.parent].y;
        self.z = Item.list[self.parent].z;
      } else {
        self.toRemove = true;
      }
      super_update();
    }
  } else {
    self.update = function(){
      if(!Item.list[self.parent]){
        self.toRemove = true;
      }
      super_update();
    }
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
