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
  self.update = function(){
    //
  };

  self.getInitPack = function(){
    return {
      id:self.id,
      type:self.type,
      hp:self.hp,
      plot:self.plot,
      walls:self.walls
    };
  }

  self.getUpdatePack = function(){
    return {
      hp:self.hp
    };
  }

  Building.list[self.id] = self;

  initPack.building.push(self.getInitPack());

  return self;
};

Building.list = {};

Building.update = function(){
  var pack = [];
  for(var i in Building.list){
    var building = Building.list[i];
    building.update();
    pack.push(building.getUpdatePack());
  }
  return pack;
}

Building.getAllInitPack = function(){
  var buildings = [];
  for(var i in Building.list)
    buildings.push(Building.list[i].getInitPack());
  return buildings;
}

// CHARACTER
Character = function(param){
  var self = Entity(param);
  self.zone = null;
  self.zGrid = null;
  self.type = 'npc';
  self.name = null;
  self.sex = param.sex; // 'm' or 'f'
  self.house = param.house;
  self.kingdom = param.kingdom;
  self.home = param.home; // {z,loc}
  self.class = null;
  self.rank = null;
  self.keys = [];
  self.gear = {
    head:null,
    armor:null,
    weapon:null,
    weapon2:null,
    accessory:null
  }
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
    flanders:0,
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
  self.revealed = false;
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
  self.damage = 0;
  self.fortitude = 0;
  self.attackrate = 50;
  self.dexterity = 1;
  self.toRemove = false;
  self.die = function(report){ // report {id,cause}
    if(report.id){
      if(Player.list[report.id]){
        Player.list[report.id].combat.target = null;
        if(Player.list[report.id].type == 'npc'){
          Player.list[report.id].action = 'return';
        } else {
          Player.list[report.id].action = null;
        }
        console.log(Player.list[report.id].name + ' has killed ' + self.name);
      } else {
        console.log(self.name + ' has ' + report.cause);
      }
    }
    if(self.house && self.house.type == 'npc'){
      if(!self.rank){
        House.list[self.house].respawn(0,self.home);
      } else if(self.rank == '♞ ' || self.rank ==  '♝ '){
        House.list[self.house].respawn(1,self.home);
      } else if(self.rank == '♜ '){
        House.list[self.house].respawn(2,self.home);
      } else if(self.rank == '♚ ' || self.rank == '♛ '){
        House.list[self.house].respawn(3,self.home);
      }
    }
    self.toRemove = true;
  }

  // idle = walk around
  // patrol = walk between targets
  // escort = follow and protect target
  // raid = attack all enemies en route to target
  self.mode = 'idle';

  // combat = eliminate target
  // flee = disengage and escape from target
  // return = return to previous location and activity
  self.action = null;

  self.lastLoc = null; // {z,loc}

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
  }

  self.guard = {
    point:null, // {z,loc}
    facing:null
  }

  self.raid = {
    target:null
  }

  self.pathEnd = null; // {z,loc}
  self.path = null;
  self.pathCount = 0;

  self.attack = function(dir){
    self.pressingAttack = true;
    self.working = false;
    self.chopping = false;
    self.mining = false;
    self.farming = false;
    self.building = false;
    self.fishing = false;
    var dmg = self.damage;
    if(self.type == 'player'){
      dmg = self.gear.weapon.dmg;
    }
    if(dir == 'down'){
      for(var i in self.zGrid){
        var zc = self.zGrid[i][0];
        var zr = self.zGrid[i][1];
        if(zc < 64 && zc > -1 && zr < 64 && zr > -1){
          for(var n in zones[zr][zc]){
            var p = Player.list[zones[zr][zc][n]];
            if(p){
              var loc = getLoc(self.x,self.y);
              var dLoc = [loc[0],loc[1]+1];
              var pLoc = getLoc(p.x,p.y);
              if(pLoc.toString() == dLoc.toString()){
                if(allyCheck(self.id,p.id) < 1 || self.friendlyfire){
                  Player.list[zones[zr][zc][n]].hp -= dmg - p.fortitude;
                  Player.list[zones[zr][zc][n]].working = false;
                  Player.list[zones[zr][zc][n]].chopping = false;
                  Player.list[zones[zr][zc][n]].mining = false;
                  Player.list[zones[zr][zc][n]].farming = false;
                  Player.list[zones[zr][zc][n]].building = false;
                  Player.list[zones[zr][zc][n]].fishing = false;
                  if(self.stealthed){
                    self.stealthed = false;
                    Player.list[zones[zr][zc][n]].combat.target = self.id;
                    Player.list[zones[zr][zc][n]].action = 'combat';
                  }
                }
                console.log(self.name + ' attacks ' + p.name);
                // player death & respawn
                if(Player.list[zones[zr][zc][n]].hp <= 0){
                  Player.list[zones[zr][zc][n]].die({id:self.id,cause:'melee'});
                }
              }
            }
          }
        }
      }
    } else if(dir == 'up'){
      for(var i in self.zGrid){
        var zc = self.zGrid[i][0];
        var zr = self.zGrid[i][1];
        if(zc < 64 && zc > -1 && zr < 64 && zr > -1){
          for(var n in zones[zr][zc]){
            var p = Player.list[zones[zr][zc][n]];
            if(p){
              var loc = getLoc(self.x,self.y);
              var uLoc = [loc[0],loc[1]-1];
              var pLoc = getLoc(p.x,p.y);
              if(pLoc.toString() == uLoc.toString()){
                if(allyCheck(self.id,p.id) < 1 || self.friendlyfire){
                  Player.list[zones[zr][zc][n]].hp -= dmg - p.fortitude;
                  Player.list[zones[zr][zc][n]].working = false;
                  Player.list[zones[zr][zc][n]].chopping = false;
                  Player.list[zones[zr][zc][n]].mining = false;
                  Player.list[zones[zr][zc][n]].farming = false;
                  Player.list[zones[zr][zc][n]].building = false;
                  Player.list[zones[zr][zc][n]].fishing = false;
                  if(self.stealthed){
                    self.stealthed = false;
                    Player.list[zones[zr][zc][n]].combat.target = self.id;
                    Player.list[zones[zr][zc][n]].action = 'combat';
                  }
                }
                console.log(self.name + ' attacks ' + p.name);
                // player death & respawn
                if(Player.list[zones[zr][zc][n]].hp <= 0){
                  Player.list[zones[zr][zc][n]].die({id:self.id,cause:'melee'});
                }
              }
            }
          }
        }
      }
    } else if(dir == 'left'){
      for(var i in self.zGrid){
        var zc = self.zGrid[i][0];
        var zr = self.zGrid[i][1];
        if(zc < 64 && zc > -1 && zr < 64 && zr > -1){
          for(var n in zones[zr][zc]){
            var p = Player.list[zones[zr][zc][n]];
            if(p){
              var loc = getLoc(self.x,self.y);
              var lLoc = [loc[0]-1,loc[1]];
              var pLoc = getLoc(p.x,p.y);
              if(pLoc.toString() == lLoc.toString()){
                if(allyCheck(self.id,p.id) < 1 || self.friendlyfire){
                  Player.list[zones[zr][zc][n]].hp -= dmg - p.fortitude;
                  Player.list[zones[zr][zc][n]].working = false;
                  Player.list[zones[zr][zc][n]].chopping = false;
                  Player.list[zones[zr][zc][n]].mining = false;
                  Player.list[zones[zr][zc][n]].farming = false;
                  Player.list[zones[zr][zc][n]].building = false;
                  Player.list[zones[zr][zc][n]].fishing = false;
                  if(self.stealthed){
                    self.stealthed = false;
                    Player.list[zones[zr][zc][n]].combat.target = self.id;
                    Player.list[zones[zr][zc][n]].action = 'combat';
                  }
                }
                console.log(self.name + ' attacks ' + p.name);
                // player death & respawn
                if(Player.list[zones[zr][zc][n]].hp <= 0){
                  Player.list[zones[zr][zc][n]].die({id:self.id,cause:'melee'});
                }
              }
            }
          }
        }
      }
    } else if(dir == 'right'){
      for(var i in self.zGrid){
        var zc = self.zGrid[i][0];
        var zr = self.zGrid[i][1];
        if(zc < 64 && zc > -1 && zr < 64 && zr > -1){
          for(var n in zones[zr][zc]){
            var p = Player.list[zones[zr][zc][n]];
            if(p){
              var loc = getLoc(self.x,self.y);
              var rLoc = [loc[0]+1,loc[1]];
              var pLoc = getLoc(p.x,p.y);
              if(pLoc.toString() == rLoc.toString()){
                if(allyCheck(self.id,p.id) < 1 || self.friendlyfire){
                  Player.list[zones[zr][zc][n]].hp -= dmg - p.fortitude;
                  Player.list[zones[zr][zc][n]].working = false;
                  Player.list[zones[zr][zc][n]].chopping = false;
                  Player.list[zones[zr][zc][n]].mining = false;
                  Player.list[zones[zr][zc][n]].farming = false;
                  Player.list[zones[zr][zc][n]].building = false;
                  Player.list[zones[zr][zc][n]].fishing = false;
                  if(self.stealthed){
                    self.stealthed = false;
                    Player.list[zones[zr][zc][n]].combat.target = self.id;
                    Player.list[zones[zr][zc][n]].action = 'combat';
                  }
                }
                console.log(self.name + ' attacks ' + p.name);
                // player death & respawn
                if(Player.list[zones[zr][zc][n]].hp <= 0){
                  Player.list[zones[zr][zc][n]].die({id:self.id,cause:'melee'});
                }
              }
            }
          }
        }
      }
    }
    self.attackCooldown = self.attackrate/self.dexterity;
    setTimeout(function(){
      self.pressingAttack = false;
    },250);
  }

  self.shootArrow = function(angle){
    console.log(self.name + ' shoots arrow @ ' + Player.list[self.combat.target].name);
    self.pressingAttack = true;
    self.working = false;
    self.chopping = false;
    self.mining = false;
    self.farming = false;
    self.building = false;
    self.fishing = false;
    // add variable inaccuracy to angle?
    Arrow({
      parent:self.id,
      angle:angle,
      x:self.x,
      y:self.y,
      z:self.z
    });
    self.attackCooldown = (self.attackrate*2)/self.dexterity;
    setTimeout(function(){
      self.pressingAttack = false;
    },250);
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

  self.reposition = function(loc,tLoc){
    console.log(self.name + ' repositioning...');
    var dir = self.calcDir(loc,tLoc);
    if(dir != self.lastDir){
      self.lastDir = dir;
    }
    if(dir == 'ul'){
      var d = [loc[0],loc[1]+1];
      if(isWalkable(self.z,d[0],d[1])){
        self.path = [d];
      } else {
        var r = [loc[0]+1,loc[1]];
        if(isWalkable(self.z,r[0],r[1])){
          self.path = [r];
        }
      }
    } else if(dir == 'lu'){
      var r = [loc[0]+1,loc[1]];
      if(isWalkable(self.z,r[0],r[1])){
        self.path = [r];
      } else {
        var d = [loc[0],loc[1]+1];
        if(isWalkable(self.z,d[0],d[1])){
          self.path = [d];
        }
      }
    } else if(dir == 'l'){
      var r = [loc[0]+1,loc[1]];
      if(isWalkable(self.z,r[0],r[1])){
        self.path = [r];
      } else {
        if(self.lastDir == 'dl' || self.lastDir == 'ld'){
          var u = [loc[0],loc[1]-1];
          if(isWalkable(self.z,u[0],u[1])){
            self.path = [u];
          }
        } else {
          var d = [loc[0],loc[1]+1];
          if(isWalkable(self.z,d[0],d[1])){
            self.path = [d];
          }
        }
      }
    } else if(dir == 'u'){
      var d = [loc[0],loc[1]+1];
      if(isWalkable(self.z,d[0],d[1])){
        self.path = [d];
      } else {
        if(self.lastDir == 'ul' || self.lastDir == 'lu'){
          var r = [loc[0]+1,loc[1]];
          if(isWalkable(self.z,r[0],r[1])){
            self.path = [r];
          } else {
            var l = [loc[0]-1,loc[1]];
            if(isWalkable(self.z,l[0],l[1])){
              self.path = [l];
            }
          }
        }
      }
    } else if(dir == 'ld'){
      var r = [loc[0]+1,loc[1]];
      if(isWalkable(self.z,r[0],r[1])){
        self.path = [r];
      } else {
        var u = [loc[0],loc[1]-1];
        if(isWalkable(self.z,u[0],u[1])){
          self.path = [u];
        }
      }
    } else if(dir == 'dl'){
      var u = [loc[0],loc[1]-1];
      if(isWalkable(self.z,u[0],u[1])){
        self.path = [u];
      } else {
        var r = [loc[0]+1,loc[1]];
        if(isWalkable(self.z,r[0],r[1])){
          self.path = [r];
        }
      }
    } else if(dir == 'd'){
      var u = [loc[0],loc[1]-1];
      if(isWalkable(self.z,u[0],u[1])){
        self.path = [u];
      } else {
        if(self.lastDir == 'dl' || self.lastDir == 'ld'){
          var r = [loc[0]+1,loc[1]];
          if(isWalkable(self.z,r[0],r[1])){
            self.path = [r];
          }
        } else {
          var l = [loc[0]-1,loc[1]];
          if(isWalkable(self.z,l[0],l[1])){
            self.path = [l];
          }
        }
      }
    } else if(dir == 'rd'){
      var l = [loc[0]-1,loc[1]];
      if(isWalkable(self.z,l[0],l[1])){
        self.path = [l];
      } else {
        var u = [loc[0],loc[1]-1];
        if(isWalkable(self.z,u[0],u[1])){
          self.path = [u];
        }
      }
    } else if(dir == 'dr'){
      var u = [loc[0],loc[1]-1];
      if(isWalkable(self.z,u[0],u[1])){
        self.path = [u];
      } else {
        var l = [loc[0]-1,loc[1]];
        if(isWalkable(self.z,l[0],l[1])){
          self.path = [l];
        }
      }
    } else if(dir == 'ru'){
      var l = [loc[0]-1,loc[1]];
      if(isWalkable(self.z,l[0],l[1])){
        self.path = [l];
      } else {
        var d = [loc[0],loc[1]+1];
        if(isWalkable(self.z,d[0],d[1])){
          self.path = [d];
        }
      }
    } else if(dir == 'ur'){
      var d = [loc[0],loc[1]+1];
      if(isWalkable(self.z,d[0],d[1])){
        self.path = [d];
      } else {
        var l = [loc[0]-1,loc[1]];
        if(isWalkable(self.z,l[0],l[1])){
          self.path = [l];
        }
      }
    } else if(dir == 'r'){
      var l = [loc[0]-1,loc[1]];
      if(isWalkable(self.z,l[0],l[1])){
        self.path = [l];
      } else {
        if(self.lastDir == 'dr' || self.lastDir == 'rd'){
          var u = [loc[0],loc[1]-1];
          if(isWalkable(self.z,u[0],u[1])){
            self.path = [u];
          } else {
            var d = [loc[0],loc[1]+1];
            if(isWalkable(self.z,d[0],d[1])){
              self.path = [d];
            }
          }
        }
      }
    }
  }

  self.getAngle = function(x,y){
    var dx = x - self.x;
    var dy = y - self.y;
    var angle = Math.atan2(dy,dx) / Math.PI * 180;
    return angle;
  }

  self.zoneCheck = function(){
    var loc = getLoc(self.x,self.y);
    var zn = self.zone;
    var zc = Math.floor(loc[0]/8);
    var zr = Math.floor(loc[1]/8);

    if(!zn){
      self.zone = [zc,zr];
      zones[zr][zc][self.id = self.id];
      self.zGrid = [
        [zc-1,zr-1],[zc,zr-1],[zc+1,zr-1],
        [zc-1,zr],self.zone,[zc+1,zr],
        [zc-1,zr+1],[zc,zr+1],[zc+1,zr+1]
      ];
    } else if(zn !== [zc,zr]){
      delete zones[zn[1]][zn[0]][self.id];
      zones[zr][zc][self.id] = self.id;
      self.zone = [zc,zr];
      self.zGrid = [
        self.zone,[zc-1,zr-1],[zc,zr-1],
        [zc+1,zr-1],[zc-1,zr],[zc+1,zr],
        [zc-1,zr+1],[zc,zr+1],[zc+1,zr+1]
      ];
    }
  }

  self.stealthCheck = function(p){
    if(p.stealthed){
      var loc = getLoc(self.x,self.y);
      var pLoc = getLoc(p.x,p.y);
      if(self.facing == 'up'){
        var uLoc = [loc[0],loc[1]-1];
        if(pLoc.toString() == uLoc.toString()){
          Player.list[p.id].revealed = true;
        }
      } else if(self.facing == 'right'){
        var rLoc = [loc[0]+1,loc[1]];
        if(pLoc.toString() == rLoc.toString()){
          Player.list[p.id].revealed = true;
        }
      } else if(self.facing == 'down'){
        var dLoc = [loc[0],loc[1]+1];
        if(pLoc.toString() == dLoc.toString()){
          Player.list[p.id].revealed = true;
        }
      } else if(self.facing == 'left'){
        var lLoc = [loc[0]-1,loc[1]];
        if(pLoc.toString() == lLoc.toString()){
          Player.list[p.id].revealed = true;
        }
      }
    }
  }

  self.revealCheck = function(){
    for(i in Light.list){
      var light = Light.list[i];
      if(self.z == light.z){
        var d = self.getDistance({x:light.x,y:light.y});
        if(d >= light.radius * 1.5){
          self.revealed = true;
          return;
        }
      }
    }
    self.revealed = false;
  }

  self.checkAggro = function(){
    for(var i in self.zGrid){
      var zc = self.zGrid[i][0];
      var zr = self.zGrid[i][1];
      if(zc < 64 && zc > -1 && zr < 64 && zr > -1){
        for(var n in zones[zr][zc]){
          var p = Player.list[zones[zr][zc][n]];
          if(p && p.z == self.z){
            var pDist = self.getDistance({
              x:p.x,
              y:p.y
            });
            if(pDist <= self.aggroRange){ // in aggro range
              var ally = allyCheck(self.id,p.id);
              if(self.innaWoods == p.innaWoods || (self.innaWoods && !p.innaWoods)){ // both in woods, both out of woods or in woods and they are not
                if(ally <= 0){ // is neutral or enemy
                  self.stealthCheck(p);
                  if(!Player.list[zones[zr][zc][n]].stealthed || Player.list[zones[zr][zc][n]].revealed){ // not stealthed or revealed
                    if(ally == -1){ // is enemy
                      self.combat.target = p.id;
                      if(self.hp < (self.hpMax * 0.1) || self.class == 'SerfM' ||
                      self.class == 'SerfF' || self.class == 'Deer' || self.class == 'Sheep'){
                        self.action = 'flee';
                      } else {
                        self.lastLoc = {z:self.z,loc:getLoc(self.x,self.y)};
                        self.action = 'combat';
                        console.log(self.name + ' aggro @ ' + p.name);
                      }
                      if(!self.stealthed && !p.action){
                        Player.list[zones[zr][zc][n]].combat.target = self.id;
                        Player.list[zones[zr][zc][n]].action = 'combat';
                      }
                    } else {
                      continue;
                    }
                  }
                }
              } else { // not in woods and they are
                if(ally == -1){ // is enemy
                  if((!self.stealthed || self.revealed) && p.type == 'npc' && !p.action){
                    Player.list[zones[zr][zc][n]].combat.target = self.id;
                    Player.list[zones[zr][zc][n]].action = 'combat';
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  self.calcDir = function(loc,tLoc){
    var c = tLoc[0] - loc[0];
    var r = tLoc[1] - loc[1];
    if(c == 0 && r == 0){
      return 'c';
    } else if(c >= 0 && r >= 0){ // down/right
      if(c >= r){
        if(r > 0){
          return 'rd';
        } else {
          return 'r';
        }
      } else {
        if(c > 0){
          return 'dr';
        } else {
          return 'd';
        }
      }
    } else if(c >= 0 && r < 0){ // up/right
      r *= -1;
      if(c >= r){
        if(r > 0){
          return 'ru';
        } else {
          return 'r';
        }
      } else {
        if(c > 0){
          return 'ur';
        } else {
          return 'u';
        }
      }
    } else if(c < 0 && r < 0){ // up/left
      if(c <= r){
        return 'lu';
      } else {
        return 'ul';
      }
    } else if(c < 0 && r >= 0){ // down/left
      c *= -1;
      if(c >= r){
        if(r > 0){
          return 'ld';
        } else {
          return 'l';
        }
      } else {
        if(c > 0){
          return 'dl';
        } else {
          return 'd';
        }
      }
    }
  }

  self.lastDir = null;
  self.lastTarget = null;

  self.moveTo = function(tLoc){
    if(!self.path){
      var loc = getLoc(self.x,self.y);
      if(loc.toString() != tLoc.toString()){
        var dir = self.calcDir(loc,tLoc);
        if(dir != self.lastDir){
          self.lastDir = dir;
        }
        if(dir == 'dr'){
          var d = [loc[0],loc[1]+1];
          if(isWalkable(self.z,d[0],d[1])){
            self.path = [d];
          } else {
            var r = [loc[0]+1,loc[1]];
            if(isWalkable(self.z,r[0],r[1])){
              self.path = [r];
            }
          }
        } else if(dir == 'rd'){
          var r = [loc[0]+1,loc[1]];
          if(isWalkable(self.z,r[0],r[1])){
            self.path = [r];
          } else {
            var d = [loc[0],loc[1]+1];
            if(isWalkable(self.z,d[0],d[1])){
              self.path = [d];
            }
          }
        } else if(dir == 'r'){
          var r = [loc[0]+1,loc[1]];
          if(isWalkable(self.z,r[0],r[1])){
            self.path = [r];
          } else {
            if(self.lastDir == 'ur' || self.lastDir == 'ru'){
              var u = [loc[0],loc[1]-1];
              if(isWalkable(self.z,u[0],u[1])){
                self.path = [u];
              }
            } else {
              var d = [loc[0],loc[1]+1];
              if(isWalkable(self.z,d[0],d[1])){
                self.path = [d];
              }
            }
          }
        } else if(dir == 'd'){
          var d = [loc[0],loc[1]+1];
          if(isWalkable(self.z,d[0],d[1])){
            self.path = [d];
          } else {
            if(self.lastDir == 'dr' || self.lastDir == 'rd'){
              var r = [loc[0]+1,loc[1]];
              if(isWalkable(self.z,r[0],r[1])){
                self.path = [r];
              } else {
                var l = [loc[0]-1,loc[1]];
                if(isWalkable(self.z,l[0],l[1])){
                  self.path = [l];
                }
              }
            }
          }
        } else if(dir == 'ru'){
          var r = [loc[0]+1,loc[1]];
          if(isWalkable(self.z,r[0],r[1])){
            self.path = [r];
          } else {
            var u = [loc[0],loc[1]-1];
            if(isWalkable(self.z,u[0],u[1])){
              self.path = [u];
            }
          }
        } else if(dir == 'ur'){
          var u = [loc[0],loc[1]-1];
          if(isWalkable(self.z,u[0],u[1])){
            self.path = [u];
          } else {
            var r = [loc[0]+1,loc[1]];
            if(isWalkable(self.z,r[0],r[1])){
              self.path = [r];
            }
          }
        } else if(dir == 'u'){
          var u = [loc[0],loc[1]-1];
          if(isWalkable(self.z,u[0],u[1])){
            self.path = [u];
          } else {
            if(self.lastDir == 'ur' || self.lastDir == 'ru'){
              var r = [loc[0]+1,loc[1]];
              if(isWalkable(self.z,r[0],r[1])){
                self.path = [r];
              }
            } else {
              var l = [loc[0]-1,loc[1]];
              if(isWalkable(self.z,l[0],l[1])){
                self.path = [l];
              }
            }
          }
        } else if(dir == 'lu'){
          var l = [loc[0]-1,loc[1]];
          if(isWalkable(self.z,l[0],l[1])){
            self.path = [l];
          } else {
            var u = [loc[0],loc[1]-1];
            if(isWalkable(self.z,u[0],u[1])){
              self.path = [u];
            }
          }
        } else if(dir == 'ul'){
          var u = [loc[0],loc[1]-1];
          if(isWalkable(self.z,u[0],u[1])){
            self.path = [u];
          } else {
            var l = [loc[0]-1,loc[1]];
            if(isWalkable(self.z,l[0],l[1])){
              self.path = [l];
            }
          }
        } else if(dir == 'ld'){
          var l = [loc[0]-1,loc[1]];
          if(isWalkable(self.z,l[0],l[1])){
            self.path = [l];
          } else {
            var d = [loc[0],loc[1]+1];
            if(isWalkable(self.z,d[0],d[1])){
              self.path = [d];
            }
          }
        } else if(dir == 'dl'){
          var d = [loc[0],loc[1]+1];
          if(isWalkable(self.z,d[0],d[1])){
            self.path = [d];
          } else {
            var l = [loc[0]-1,loc[1]];
            if(isWalkable(self.z,l[0],l[1])){
              self.path = [l];
            }
          }
        } else if(dir == 'l'){
          var l = [loc[0]-1,loc[1]];
          if(isWalkable(self.z,l[0],l[1])){
            self.path = [l];
          } else {
            if(self.lastDir == 'ul' || self.lastDir == 'lu'){
              var u = [loc[0],loc[1]-1];
              if(isWalkable(self.z,u[0],u[1])){
                self.path = [u];
              } else {
                var d = [loc[0],loc[1]+1];
                if(isWalkable(self.z,d[0],d[1])){
                  self.path = [d];
                }
              }
            }
          }
        }
      }
    }
  }

  self.follow = function(target,attack=false){
    if(!self.path){
      if(self.z != target.z){
        self.moveTo(self.lastTarget);
      } else {
        var loc = getLoc(self.x,self.y);
        var tLoc = getLoc(target.x,target.y);
        var dLoc = [tLoc[0],tLoc[1]+1];
        var uLoc = [tLoc[0],tLoc[1]-1];
        var lLoc = [tLoc[0]-1,tLoc[1]];
        var rLoc = [tLoc[0]+1,tLoc[1]];

        if(!self.lastTarget || tLoc.toString() != self.lastTarget.toString()){
          self.lastTarget = tLoc;
        }
        if(loc.toString() != uLoc.toString() &&
        loc.toString() != dLoc.toString() &&
        loc.toString() != rLoc.toString() &&
        loc.toString() != lLoc.toString()){
          var dir = self.calcDir(loc,tLoc);
          if(dir != self.lastDir){
            self.lastDir = dir;
          }
          if(dir == 'dr'){
            var d = [loc[0],loc[1]+1];
            if(isWalkable(self.z,d[0],d[1])){
              self.path = [d];
            } else {
              var r = [loc[0]+1,loc[1]];
              if(isWalkable(self.z,r[0],r[1])){
                self.path = [r];
              }
            }
          } else if(dir == 'rd'){
            var r = [loc[0]+1,loc[1]];
            if(isWalkable(self.z,r[0],r[1])){
              self.path = [r];
            } else {
              var d = [loc[0],loc[1]+1];
              if(isWalkable(self.z,d[0],d[1])){
                self.path = [d];
              }
            }
          } else if(dir == 'r'){
            var r = [loc[0]+1,loc[1]];
            if(isWalkable(self.z,r[0],r[1])){
              self.path = [r];
            } else {
              if(self.lastDir == 'ur' || self.lastDir == 'ru'){
                var u = [loc[0],loc[1]-1];
                if(isWalkable(self.z,u[0],u[1])){
                  self.path = [u];
                }
              } else {
                var d = [loc[0],loc[1]+1];
                if(isWalkable(self.z,d[0],d[1])){
                  self.path = [d];
                }
              }
            }
          } else if(dir == 'd'){
            var d = [loc[0],loc[1]+1];
            if(isWalkable(self.z,d[0],d[1])){
              self.path = [d];
            } else {
              if(self.lastDir == 'dr' || self.lastDir == 'rd'){
                var r = [loc[0]+1,loc[1]];
                if(isWalkable(self.z,r[0],r[1])){
                  self.path = [r];
                } else {
                  var l = [loc[0]-1,loc[1]];
                  if(isWalkable(self.z,l[0],l[1])){
                    self.path = [l];
                  }
                }
              }
            }
          } else if(dir == 'ru'){
            var r = [loc[0]+1,loc[1]];
            if(isWalkable(self.z,r[0],r[1])){
              self.path = [r];
            } else {
              var u = [loc[0],loc[1]-1];
              if(isWalkable(self.z,u[0],u[1])){
                self.path = [u];
              }
            }
          } else if(dir == 'ur'){
            var u = [loc[0],loc[1]-1];
            if(isWalkable(self.z,u[0],u[1])){
              self.path = [u];
            } else {
              var r = [loc[0]+1,loc[1]];
              if(isWalkable(self.z,r[0],r[1])){
                self.path = [r];
              }
            }
          } else if(dir == 'u'){
            var u = [loc[0],loc[1]-1];
            if(isWalkable(self.z,u[0],u[1])){
              self.path = [u];
            } else {
              if(self.lastDir == 'ur' || self.lastDir == 'ru'){
                var r = [loc[0]+1,loc[1]];
                if(isWalkable(self.z,r[0],r[1])){
                  self.path = [r];
                }
              } else {
                var l = [loc[0]-1,loc[1]];
                if(isWalkable(self.z,l[0],l[1])){
                  self.path = [l];
                }
              }
            }
          } else if(dir == 'lu'){
            var l = [loc[0]-1,loc[1]];
            if(isWalkable(self.z,l[0],l[1])){
              self.path = [l];
            } else {
              var u = [loc[0],loc[1]-1];
              if(isWalkable(self.z,u[0],u[1])){
                self.path = [u];
              }
            }
          } else if(dir == 'ul'){
            var u = [loc[0],loc[1]-1];
            if(isWalkable(self.z,u[0],u[1])){
              self.path = [u];
            } else {
              var l = [loc[0]-1,loc[1]];
              if(isWalkable(self.z,l[0],l[1])){
                self.path = [l];
              }
            }
          } else if(dir == 'ld'){
            var l = [loc[0]-1,loc[1]];
            if(isWalkable(self.z,l[0],l[1])){
              self.path = [l];
            } else {
              var d = [loc[0],loc[1]+1];
              if(isWalkable(self.z,d[0],d[1])){
                self.path = [d];
              }
            }
          } else if(dir == 'dl'){
            var d = [loc[0],loc[1]+1];
            if(isWalkable(self.z,d[0],d[1])){
              self.path = [d];
            } else {
              var l = [loc[0]-1,loc[1]];
              if(isWalkable(self.z,l[0],l[1])){
                self.path = [l];
              }
            }
          } else if(dir == 'l'){
            var l = [loc[0]-1,loc[1]];
            if(isWalkable(self.z,l[0],l[1])){
              self.path = [l];
            } else {
              if(self.lastDir == 'ul' || self.lastDir == 'lu'){
                var u = [loc[0],loc[1]-1];
                if(isWalkable(self.z,u[0],u[1])){
                  self.path = [u];
                } else {
                  var d = [loc[0],loc[1]+1];
                  if(isWalkable(self.z,d[0],d[1])){
                    self.path = [d];
                  }
                }
              }
            }
          } else if(dir == 'c'){
            if(target.facing == 'up'){
              var d = [loc[0],loc[1]+1];
              self.path = [d];
            } else if(target.facing == 'down'){
              var u = [loc[0],loc[1]-1];
              self.path = [u];
            } else if(target.facing == 'left'){
              var r = [loc[0]+1,loc[1]];
              self.path = [r];
            } else if(target.facing == 'right'){
              var l = [loc[0]-1,loc[1]];
              self.path = [l];
            }
          }
        } else {
          if(loc.toString() == uLoc.toString()){
            self.facing = 'down';
          } else if(loc.toString() == dLoc.toString()){
            self.facing = 'up';
          } else if(loc.toString() == lLoc.toString()){
            self.facing = 'right';
          } else if(loc.toString() == rLoc.toString()){
            self.facing = 'left';
          }
          if(attack && self.attackCooldown == 0){
            self.attack(self.facing);
          }
        }
      }
    }
  }

  self.update = function(){
    var loc = getLoc(self.x,self.y);
    self.zoneCheck();

    if(self.stealthed){
      self.revealCheck();
    }

    if(self.torchBearer){
      if(!self.hasTorch){
        if((self.z == 0 && (tempus == 'VIII.p' || tempus == 'IX.p' ||
        tempus == 'X.p' || tempus == 'XI.p' || tempus == 'XII.a' ||
        tempus == 'I.a' || tempus == 'II.a' || tempus == 'III.a' ||
        tempus == 'IV.a')) || self.z == -1 || self.z == -2){
          self.lightTorch(Math.random());
        }
      }
    }

    if(self.idleTime > 0){
      self.idleTime--;
    }
    if(self.attackCooldown > 0){
      self.attackCooldown--;
    }

    if(self.z == 0){
      if(getTile(0,loc[0],loc[1]) == 6){
        self.z = -1;
        self.path = null;
        self.pathCount = 0;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd;
        if(self.pathEnd){
          self.getPath(self.pathEnd.z,self.pathEnd.loc[0],self.pathEnd.loc[1]);
        }
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
      } else if(getTile(0,loc[0],loc[1]) == 18){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 1.1;
      } else if(getTile(0,loc[0],loc[1]) == 14 || getTile(0,loc[0],loc[1]) == 16 || getTile(0,loc[0],loc[1]) == 19){
        self.z = 1;
        self.path = null;
        self.pathCount = 0;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd;
        if(self.pathEnd){
          self.getPath(self.pathEnd.z,self.pathEnd.loc[0],self.pathEnd.loc[1]);
        }
      } else if(getTile(0,loc[0],loc[1]) == 0){
        self.z = -3;
        self.path = null;
        self.pathCount = 0;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 0.1;
        if(self.pathEnd){
          self.getPath(self.pathEnd.z,self.pathEnd.loc[0],self.pathEnd.loc[1]);
        }
      } else {
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd;
      }
    } else if(self.z == -1){
      if(getTile(1,loc[0],loc[1]) == 2){
        self.z = 0;
        self.path = null;
        self.pathCount = 0;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 0.9;
        if(self.pathEnd){
          self.getPath(self.pathEnd.z,self.pathEnd.loc[0],self.pathEnd.loc[1]);
        }
      }
    } else if(self.z == -2){
      if(getTile(8,loc[0],loc[1]) == 5){
        self.z = 1;
        self.path = null;
        self.pathCount = 0;
        self.y += (tileSize/2);
        self.facing = 'down';
        if(self.pathEnd){
          self.getPath(self.pathEnd.z,self.pathEnd.loc[0],self.pathEnd.loc[1]);
        }
      }
    } else if(self.z == -3){
      if(self.breath > 0){
        self.breath -= 0.25;
      } else {
        self.hp -= 0.5;
      }
      if(self.hp <= 0){
        self.die({cause:'drowned'});
      }
      if(getTile(0,loc[0],loc[1]) !== 0){
        self.z = 0;
        self.breath = self.breathMax;
        if(self.pathEnd){
          self.getPath(self.pathEnd.z,self.pathEnd.loc[0],self.pathEnd.loc[1]);
        }
      }
    } else if(self.z == 1){
      if(getTile(0,loc[0],loc[1] - 1) == 14 || getTile(0,loc[0],loc[1] - 1) == 16  || getTile(0,loc[0],loc[1] - 1) == 19){
        self.z = 0;
        self.path = null;
        self.pathCount = 0;
        if(self.pathEnd){
          self.getPath(self.pathEnd.z,self.pathEnd.loc[0],self.pathEnd.loc[1]);
        }
      } else if(getTile(4,loc[0],loc[1]) == 3 || getTile(4,loc[0],loc[1]) == 4 || getTile(4,loc[0],loc[1]) == 7){
        self.z = 2;
        self.path = null;
        self.pathCount = 0;
        self.y += (tileSize/2);
        self.facing = 'down'
        if(self.pathEnd){
          self.getPath(self.pathEnd.z,self.pathEnd.loc[0],self.pathEnd.loc[1]);
        }
      } else if(getTile(4,loc[0],loc[1]) == 5 || getTile(4,loc[0],loc[1]) == 6){
        self.z = -2;
        self.path = null;
        self.pathCount = 0;
        self.y += (tileSize/2);
        self.facing = 'down';
        if(self.pathEnd){
          self.getPath(self.pathEnd.z,self.pathEnd.loc[0],self.pathEnd.loc[1]);
        }
      }
    } else if(self.z == 2){
      if(getTile(4,loc[0],loc[1]) == 3 || getTile(4,loc[0],loc[1]) == 4){
        self.z = 1;
        self.path = null;
        self.pathCount = 0;
        self.y += (tileSize/2);
        self.facing = 'down';
        if(self.pathEnd){
          self.getPath(self.pathEnd.z,self.pathEnd.loc[0],self.pathEnd.loc[1]);
        }
      }
    }

    ////////////////
    // VANILLA AI //
    ////////////////

    // IDLE
    if(self.mode == 'idle'){
      if(!self.action){
        var cHome = getCenter(self.home.loc[0],self.home.loc[1]);
        var hDist = self.getDistance({
          x:cHome[0],
          y:cHome[1]
        });
        if(hDist > self.wanderRange){
          self.action = 'return';
        } else if(self.idleTime == 0){
          if(!self.path){
            var col = loc[0];
            var row = loc[1];
            var select = [[col,row-1],[col-1,row],[col,row+1],[col+1,row]];
            var target = select[Math.floor(Math.random() * 4)];
            if(target[0] < mapSize && target[0] > -1 && target[1] < mapSize && target[1] > -1){
              if(isWalkable(self.z,target[0],target[1])){
                self.path = [target];
                self.idleTime += Math.floor(Math.random() * self.idleRange);
              }
            }
          }
        }
      } else if(self.action == 'combat'){
        var target = Player.list[self.combat.target];
        if(!target){
          self.combat.target = null;
          self.action = 'return';
          console.log(self.name + ' return');
        } else {
          if(self.ranged){
            var tLoc = getLoc(target.x,target.y);
            var dist = self.getDistance({
              x:target.x,
              y:target.y
            })
            if(dist < self.aggroRange/2){
              self.reposition(loc,tLoc);
            } else {
              if(self.attackCooldown <= 0){
                var angle = self.getAngle(target.x,target.y);
                self.shootArrow(angle);
              }
              if(dist > self.aggroRange){
                self.follow(target);
              }
            }
          } else {
            self.follow(target,true);
          }
          var cHome = getCenter(self.home.loc[0],self.home.loc[1]);
          var hDist = self.getDistance({
            x:cHome[0],
            y:cHome[1]
          });
          var tDist = self.getDistance({
            x:target.x,
            y:target.y
          });
          if(hDist > self.wanderRange * 4 || tDist > self.aggroRange * 2){
            self.combat.target = null;
            self.action == 'return';
            console.log(self.name + ' return');
          }
        }
      } else if(self.action == 'return'){
        if(self.lastLoc){
          if(!self.path){
            if(loc.toString() == self.lastLoc.loc.toString() && self.z == self.lastLoc.z){
              self.action = null;
              self.lastLoc = null;
            } else {
              self.getPath(self.lastLoc.z,self.lastLoc.loc[0],self.lastLoc.loc[1]);
            }
          }
        } else {
          if(!self.path){
            if(loc.toString() == self.home.loc.toString()){
              self.action = null;
            } else {
              self.getPath(self.home.z,self.home.loc[0],self.home.loc[1]);
            }
          }
        }
      } else if(self.action == 'flee'){
        if(self.combat.target){
          var target = Player.list[self.combat.target];
          var dist = self.getDistance({
            x:target.x,
            y:target.y
          })
          if(dist > self.aggroRange * 2){
            console.log(self.name + ' fled from ' + target.name);
            self.combat.target = null;
            self.action = null;
          } else {
            var tLoc = getLoc(target.x,target.y);
            self.reposition(loc,tLoc);
          }
        }
      }
      // PATROL
    } else if(self.mode == 'patrol'){
      if(!self.patrol.bList){
        var list = [];
        for(var i in Building.list){
          var b = Building.list[i];
          if(b.built && b.house == self.house && b.patrolPoint){
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
          if(!self.path){
            if(self.lastLoc){
              self.action = 'return';
            } else if(!self.patrol.next || self.patrol.next.toString() == loc.toString()){
              var rand = Math.floor(Math.random() * self.patrol.bList.length);
              var select = self.patrol.bList[rand];
              self.patrol.next = select;
              self.getPath(self.z,select[0],select[1]);
            }
          }
        } else if(self.action == 'combat'){
          var target = Player.list[self.combat.target];
          var lCoords = getCenter(lastLoc.loc[0],lastLoc.loc[1]);
          var lDist = self.getDistance(lCoords[0],lCoords[1]);
          if(!target || (lDist > self.aggroRange*2)){
            self.action = 'return';
          }
          if(self.ranged){
            var tLoc = getLoc(target.x,target.y);
            var dist = self.getDistance({
              x:target.x,
              y:target.y
            })
            if(self.attackCooldown > 0){
              if(dist < 256){
                self.reposition(loc,tLoc);
              }
            } else {
              if(dist > 256){
                var angle = self.getAngle(target.x,target.y);
                self.shootArrow(angle);
                self.attackCooldown += self.attackRate/self.dexterity;
              } else {
                self.reposition(loc,tLoc);
              }
            }
          } else {
            self.follow(target,true);
          }
        } else if(self.action == 'return'){
          if(!self.path){
            if(loc.toString() == self.lastLoc.loc.toString()){
              self.action = null;
              self.lastLoc = null;
            } else {
              self.getPath(self.lastLoc.z,self.lastLoc.loc[0],self.lastLoc.loc[1]);
            }
          }
        }
      }
      // ESCORT
    } else if(self.mode == 'escort'){
      var target = Player.list[self.escort.target];
      var tDist = getDistance({x:target.x,y:target.y});
      if(!self.action){
        if(!self.path){
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
            self.getPath(target.z,dest[0],dest[1]);
          }
        }
      } else if(self.action == 'combat'){
        var cTarget = self.combat.target;
        if(!cTarget || tDist > (self.aggroRange*1.5)){
          self.action = 'return';
        }
        if(self.ranged){
          var tLoc = getLoc(target.x,target.y);
          var dist = self.getDistance({
            x:Player.list[cTarget].x,
            y:Player.list[cTarget].y
          })
          if(self.attackCooldown > 0){
            if(dist < 256){
              self.reposition(loc,tLoc);
            }
          } else {
            if(dist > 256){
              var angle = self.getAngle(Player.list[cTarget].x,Player.list[cTarget].y);
              self.shootArrow(angle);
              self.attackCooldown += self.attackRate/self.dexterity;
            } else {
              self.reposition(loc,tLoc);
            }
          }
        } else {
          self.follow(cTarget,true);
        }
      } else if(self.action == 'return'){
        if(!self.path){
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
            self.getPath(target.z,dest[0],dest[1]);
          } else {
            self.action = null;
          }
        }
      }
      // SCOUT
    } else if(self.mode == 'scout'){
      var dest = self.scout.target;
      if(!self.scout.enemyBuilding){
        //
      }
      if(!self.action){
        if(!self.path){
          if(loc.toString() == dest.toString()){
            self.action = 'flee';
          }
        }
      } else if(self.action == 'combat'){
        self.combat.target = null;
        self.action = 'flee';
      } else if(self.action == 'flee'){
        if(!self.path){
          var ret = self.scout.return;
          if(loc.toString() == ret.toString()){
            self.mode = 'idle';
          } else {
            self.getPath(self.z,ret[0],ret[1]);
          }
        }
      }
      // GUARD
    } else if(self.mode == 'guard'){
      var point = self.guard.point;
      var pCoord = getCenter(point[0],point[1]);
      var pDist = self.getDistance({
        x:pCoord[0],
        y:pCoord[1]
      });
      if(!self.action){
        if(!self.path){
          if(loc !== point.loc){
            self.getPath(point.z,point.loc[0],point.loc[1]);
          }
        }
      } else if(self.action == 'combat'){
        var target = Player.list[self.combat.target];
        if(!target || pDist > (self.aggroRange*1.5)){
          self.action = 'return';
        }
        if(self.ranged){
          var tLoc = getLoc(target.x,target.y);
          var dist = self.getDistance({
            x:target.x,
            y:target.y
          })
          if(self.attackCooldown > 0){
            if(dist < 256){
              self.reposition(loc,tLoc);
            }
          } else {
            if(dist > 256){
              var angle = self.getAngle(target.x,target.y);
              self.shootArrow(angle);
              self.attackCooldown += self.attackRate/self.dexterity;
            } else {
              self.reposition(loc,tLoc);
            }
          }
        } else {
          self.follow(target,true);
        }
      } else if(self.action == 'return'){
        if(!self.path){
          if(loc !== point){
            self.getPath(point.z,point.loc[0],point.loc[1]);
          }
        }
      }
      // RAID
    } else if(self.mode == 'raid'){
      var dest = self.raid.target;
      var dCoords = getCoords(dest[0],dest[1]);
      var dDist = self.getDistance(dCoords[0],dCoords[1]);
      if(!self.action){
        if(!self.path){
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
            self.getPath(0,dest[0],dest[1]);
          }
        }
      } else if(self.action == 'combat'){
        var target = Player.list[self.combat.target];
        var lCoords = getCenter(lastLoc.loc[0],lastLoc.loc[1]);
        var lDist = self.getDistance(lCoords[0],lCoords[1]);
        if(!target || (lDist > self.aggroRange*4)){
          self.action = 'return';
        }
        if(self.ranged){
          var tLoc = getLoc(target.x,target.y);
          var dist = self.getDistance({
            x:target.x,
            y:target.y
          })
          if(self.attackCooldown > 0){
            if(dist < 256){
              self.reposition(loc,tLoc);
            }
          } else {
            if(dist > 256){
              var angle = self.getAngle(target.x,target.y);
              self.shootArrow(angle);
              self.attackCooldown += self.attackRate/self.dexterity;
            } else {
              self.reposition(loc,tLoc);
            }
          }
        } else {
          self.follow(target,true);
        }
      } else if(self.action == 'return'){
        if(!self.path){
          if(loc == self.lastLoc.loc){
            self.action = null;
            self.lastLoc = null;
          } else {
            self.getPath(self.lastLoc.z,self.lastLoc.loc[0],self.lastLoc.loc[1]);
          }
        }
      } else if(self.action == 'flee'){
        if(!self.path){
          if(loc.toString() == self.home.loc.toString()){
            self.mode = 'idle';
          } else {
            self.getPath(self.home.z,self.home.loc[0],self.home.loc[1]);
          }
        }
      }
    }
    self.updatePosition();
  }

  self.getPath = function(z,c,r){
    var start = getLoc(self.x,self.y);
    if(z == self.z){
      self.pathEnd = null;
      if(self.z == 0 && getLocTile(0,self.x,self.y) == 0){
        var gridSb = cloneGrid(3);
        var path = finder.findPath(start[0], start[1], c, r, gridSb);
        self.path = path;
      } else if(self.z == 0){
        var gridOb = cloneGrid(0);
        var path = finder.findPath(start[0], start[1], c, r, gridOb);
        self.path = path;
      } else if(self.z == -1){
        var gridUb = cloneGrid(-1);
        var path = finder.findPath(start[0], start[1], c, r, gridUb);
        self.path = path;
      } else if(self.z == -2){
        var gridB3b = cloneGrid(-2);
        var path = finder.findPath(start[0], start[1], c, r, gridB3b);
        self.path = path;
      } else if(self.z == 1){
        var gridB1b = cloneGrid(1);
        var path = finder.findPath(start[0], start[1], c, r, gridB1b);
        self.path = path;
      } else if(self.z == 2){
        var gridB2b = cloneGrid(2);
        var path = finder.findPath(start[0], start[1], c, r, gridB2b);
        self.path = path;
      }
    } else {
      if(!self.pathEnd){
        self.pathEnd = {z:z,loc:[c,r]};
      }
      if(self.z == 0){ // outdoors
        var gridOb = cloneGrid(0);
        if(z == -1){ // to cave
          var cave = [];
          var best = null;
          var c = getCoords(self.pathEnd.loc[0],self.pathEnd.loc[1]);
          for(i in caveEntrances){
            var e = getCoords(caveEntrances[i]);
            var d = getDistance({x:c[0],y:c[1]},{x:e[0],y:e[1]});
            if(!best || d < best){
              cave = caveEntrances[i];
              best = d;
            }
          }
          var path = finder.findPath(start[0], start[1], cave[0], cave[1], gridOb);
          self.path = path;
        } else { // to building
          var c = getCoords(self.pathEnd.loc[0],self.pathEnd.loc[1]);
          var b = getBuilding(c[0],c[1]);
          var ent = Building.list[b].entrance;
          var path = finder.findPath(start[0], start[1], ent[0], ent[1], gridOb);
          self.path = path;
        }
      } else if(self.z == -1){ // cave
        var gridUb = cloneGrid(-1);
        for(i in caveEntrances){
          var e = getCoords(caveEntrances[i]);
          var d = self.getDistance({x:e[0],y:e[1]});
          if(!best || d < best){
            cave = caveEntrances[i];
            best = d;
          }
        }
        var path = finder.findPath(start[0], start[1], cave[0], cave[1]+1, gridUb);
        self.path = path;
      } else if(self.z == 1){ // indoors
        var gridB1b = cloneGrid(1);
        var b = getBuilding(start[0],start[1]);
        if(z == 2){ // to upstairs
          var stairs = Building.list[b].ustairs;
          var path = finder.findPath(start[0], start[1], stairs[0], stairs[1], gridB1b);
          self.path = path;
        } else if(z == -2){ // to cellar/dungeon
          var stairs = Building.list[b].dstairs;
          var path = finder.findPath(start[0], start[1], stairs[0], stairs[1], gridB1b);
          self.path = path;
        } else { // outdoors
          var exit = Building.list[b].entrance;
          var path = finder.findPath(start[0], start[1], exit[0], exit[1]+1, gridB1b);
          self.path = path;
        }
      } else if(self.z == 2){ // upstairs
        var gridB2b = cloneGrid(2);
        var stairs = Building.list[b].ustairs;
        var path = finder.findPath(start[0], start[1], stairs[0], stairs[1], gridB1b);
        self.path = path;
      } else if(self.z == -2){ // cellar/dungeon
        var gridB3b = cloneGrid(-2);
        var stairs = Building.list[b].dstairs;
        var path = finder.findPath(start[0], start[1], stairs[0], stairs[1], gridB1b);
        self.path = path;
      } else if(self.z == -3){ // underwater
        self.moveTo([c,r]);
      }
    }
  }

  self.orient = function(dir){
    if(dir == 'ul' || dir == 'u' || dir == 'ur'){
      self.facing = 'up';
    } else if(dir == 'ru' || dir == 'r' || dir == 'rd'){
      self.facing = 'right';
    } else if(dir == 'dl' || dir == 'd' || dir == 'dr'){
      self.facing = 'down';
    } else if(dir == 'lu' || dir == 'l' || dir == 'ld'){
      self.facing = 'left';
    }
  }

  self.updatePosition = function(){
    if(self.path){
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
          if(self.action == 'combat'){
            self.orient(self.lastDir);
          } else {
            self.facing = 'right';
          }
        } else if(diffX <= (0-self.maxSpd)){
          self.x -= self.maxSpd;
          self.pressingLeft = true;
          if(self.action == 'combat'){
            self.orient(self.lastDir);
          } else {
            self.facing = 'left';
          }
        }
        if(diffY >= self.maxSpd){
          self.y += self.maxSpd;
          self.pressingDown = true;
          if(self.action == 'combat'){
            self.orient(self.lastDir);
          } else {
            self.facing = 'down';
          }
        } else if(diffY <= (0-self.maxSpd)){
          self.y -= self.maxSpd;
          self.pressingUp = true;
          if(self.action == 'combat'){
            self.orient(self.lastDir);
          } else {
            self.facing = 'up';
          }
        }
        if((diffX < self.maxSpd && diffX > (0-self.maxSpd)) && (diffY < self.maxSpd && diffY > (0-self.maxSpd))){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
          self.pathCount++;
          if(!self.combat.target && !self.action){
            self.checkAggro();
          }
        }
      } else {
        self.path = null;
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
      gear:self.gear,
      friends:self.friends,
      enemies:self.enemies,
      spriteSize:self.spriteSize,
      innaWoods:self.innaWoods,
      facing:self.facing,
      stealthed:self.stealthed,
      ranged:self.ranged,
      revealed:self.revealed,
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
      revealed:self.revealed,
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
  self.damage = 12;
}

Wolf = function(param){
  var self = Character(param);
  self.class = 'Wolf';
  self.baseSpd = 6;
  self.damage = 10;
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
  self.torchBearer = true;
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
  self.torchBearer = true;
}

Shipwright = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'Shipwright';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
  self.torchBearer = true;
}

Footsoldier = function(param){
  var self = Character(param);
  self.name = 'Footsoldier';
  self.class = 'Footsoldier';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3.5;
  self.damage = 10;
}

Skirmisher = function(param){
  var self = Character(param);
  self.name = 'Skirmisher';
  self.class = 'Skirmisher';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3.5;
  self.damage = 15;
}

Cavalier = function(param){
  var self = Character(param);
  self.name = 'Cavalier';
  self.class = 'Cavalier';
  self.rank = '♞ ';
  self.spriteSize = tileSize*1.5;
  self.mounted = true;
  self.baseSpd = 6.5;
  self.damage = 20;
}

General = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'General';
  self.rank = '♜ ';
  self.spriteSize = tileSize*2;
  self.mounted = true;
  self.baseSpd = 6.5;
  self.damage = 25;
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
  self.torchBearer = true;
  self.damage = 20;
}

SwissGuard = function(param){
  var self = Character(param);
  self.name = 'Swiss Guard';
  self.class = 'SwissGuard';
  self.spriteSize = tileSize*2;
  self.damage = 15;
}

Hospitaller = function(param){
  var self = Character(param);
  self.name = 'Hospitaller';
  self.class = 'Hospitaller';
  self.rank = '♞ ';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
  self.damage = 20;
}

ImperialKnight = function(param){
  var self = Character(param);
  self.name = 'Imperial Knight';
  self.class = 'ImperialKnight';
  self.rank = '♞ ';
  self.mounted = true;
  self.baseSpd = 6;
  self.spriteSize = tileSize*3;
  self.damage = 25;
}

Trebuchet = function(param){
  var self = Character(param);
  self.class = 'Trebuchet';
  self.spriteSize = tileSize*10;
  self.ranged = true;
  self.damage = 100;
}

BombardCannon = function(param){
  var self = Character(param);
  self.class = 'BombardCannon';
  self.baseSpd = 2;
  self.ranged = true;
  self.damage = 250;
}

TradeCart = function(param){
  var self = Character(param);
  self.class = 'TradeCart';
  self.mounted = true;
  self.baseSpd = 2;
  self.torchBearer = true;
}

Merchant = function(param){
  var self = Character(param);
  self.class = 'Merchant';
  self.baseSpd = 2;
  self.torchBearer = true;
}

FishingBoat = function(param){
  var self = Character(param);
  self.class = 'FishingBoat';
}

CargoShip = function(param){
  var self = Character(param);
  self.class = 'CargoShip';
  self.torchBearer = true;
}

Longship = function(param){
  var self = Character(param);
  self.class = 'Longship';
  self.rank = '♞ ';
  self.ranged = true;
  self.torchBearer = true;
  self.damage = 15;
}

Caravel = function(param){
  var self = Character(param);
  self.class = 'Caravel';
  self.ranged = true;
  self.torchBearer = true;
}

Galleon = function(param){
  var self = Character(param);
  self.class = 'Galleon';
  self.rank = '♜ ';
  self.ranged = true;
  self.torchBearer = true;
  self.damage = 150;
}

// ENEMIES

Brother = function(param){
  var self = Character(param);
  self.name = 'Brother';
  self.class = 'Brother';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3.5;
  self.damage = 5;
}

Oathkeeper = function(param){
  var self = Character(param);
  self.name = 'Oathkeeper';
  self.class = 'Oathkeeper';
  self.rank = '♝ ';
  self.spriteSize = tileSize*1.5;
  self.cleric = true;
  self.baseSpd = 3.5;
  self.torchBearer = true;
}

DarkEntity = function(param){
  var self = Character(param);
  self.class = 'DarkEntity';
  self.spriteSize = tileSize*1.5;
  self.damage = 1;
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
  self.damage = 10;
}

Cataphract = function(param){
  var self = Character(param);
  self.name = 'Cataphract';
  self.class = 'Cataphract';
  self.rank = '♞ ';
  self.mounted = true;
  self.spriteSize = tileSize*3;
  self.baseSpd = 6;
  self.damage = 20;
}

Acolyte = function(param){
  var self = Character(param);
  self.name = 'Acolyte';
  self.class = 'Acolyte';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3.5;
  self.torchBearer = true;
  self.damage = 5;
}

HighPriestess = function(param){
  var self = Character(param);
  self.name = 'High Priestess';
  self.class = 'HighPriestess';
  self.rank = '♝ ';
  self.spriteSize = tileSize*1.5;
  self.cleric = true;
  self.baseSpd = 3.5;
  self.torchBearer = true;
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
  self.torchBearer = true;
  self.damage = 15;
}

NorseSword = function(param){
  var self = Character(param);
  self.name = 'Norseman';
  self.class = 'NorseSword';
  self.spriteSize = tileSize*1.5;
  self.damage = 15;
}

NorseSpear = function(param){
  var self = Character(param);
  self.name = 'Norseman';
  self.class = 'NorseSpear';
  self.spriteSize = tileSize*1.5;
  self.damage = 15;
}

Huskarl = function(param){
  var self = Character(param);
  self.name = 'Huskarl';
  self.class = 'Huskarl';
  self.rank = '♞ ';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
  self.damage = 20;
}

FrankSword = function(param){
  var self = Character(param);
  self.name = 'Frank';
  self.class = 'FrankSword';
  self.damage = 10;
}

FrankSpear = function(param){
  var self = Character(param);
  self.name = 'Frank';
  self.class = 'FrankSpear';
  self.spriteSize = tileSize*2;
  self.damage = 10;
}

FrankBow = function(param){
  var self = Character(param);
  self.name = 'Frank';
  self.class = 'FrankBow';
  self.spriteSize = tileSize*1.5;
  self.ranged = true;
  self.damage = 5;
}

Mangonel = function(param){
  var self = Character(param);
  self.name = 'Mangonel';
  self.class = 'Mangonel';
  self.baseSpd = 2;
  self.spriteSize = tileSize*2;
  self.ranged = true;
  self.damage = 50;
}

Carolingian = function(param){
  var self = Character(param);
  self.name = 'Carolingian';
  self.class = 'Carolingian';
  self.rank = '♞ ';
  self.mounted = true;
  self.baseSpd = 6;
  self.spriteSize = tileSize*3;
  self.damage = 20;
}

Malvoisin = function(param){
  var self = Character(param);
  self.name = 'Malvoisin';
  self.class = 'Malvoisin';
  self.rank = '♜ ';
  self.spriteSize = tileSize*12;
  self.ranged = true;
  self.damage = 150;
}

Charlemagne = function(param){
  var self = Character(param);
  self.name = 'King Charlemagne';
  self.class = 'Charlemagne';
  self.rank = '♚ ';
  self.mounted = true;
  self.baseSpeed = 6;
  self.spriteSize = tileSize*3;
  self.damage = 25;
}

CeltAxe = function(param){
  var self = Character(param);
  self.name = 'Celt';
  self.class = 'CeltAxe';
  self.spriteSize = tileSize*1.5;
  self.damage = 10;
}

CeltSpear = function(param){
  var self = Character(param);
  self.name = 'Celt';
  self.class = 'CeltSpear';
  self.spriteSize = tileSize*2;
  self.damage = 10;
}

Headhunter = function(param){
  var self = Character(param);
  self.name = 'Headhunter';
  self.class = 'Headhunter';
  self.rank = '♞ ';
  self.baseSpd = 7;
  self.mounted = true;
  self.spriteSize = tileSize*2;
  self.torchBearer = true;
  self.damage = 20;
}

Druid = function(param){
  var self = Character(param);
  self.name = 'Druid';
  self.class = 'Druid';
  self.rank = '♝ ';
  self.spriteSize = tileSize*1.5;
  self.cleric = true;
  self.baseSpd = 2;
  self.torchBearer = true;
}

Morrigan = function(param){
  var self = Character(param);
  self.name = 'Morrigan';
  self.class = 'Morrigan';
  self.rank = '♜ ';
  self.mounted = true;
  self.baseSpd = 6;
  self.spriteSize = tileSize*2;
  self.torchBearer = true;
  self.damage = 25;
}

Gwenllian = function(param){
  var self = Character(param);
  self.name = 'Queen Gwenllian';
  self.class = 'Gwenllian';
  self.rank = '♛ ';
  self.torchBearer = true;
}

TeutonPike = function(param){
  var self = Character(param);
  self.name = 'Teuton';
  self.class = 'TeutonPike';
  self.spriteSize = tileSize*2;
  self.damage = 15;
}

TeutonBow = function(param){
  var self = Character(param);
  self.name = 'Teuton';
  self.class = 'TeutonBow';
  self.spriteSize = tileSize*1.5;
  self.ranged = true;
  self.damage = 10;
}

TeutonicKnight = function(param){
  var self = Character(param);
  self.name = 'Teutonic Knight';
  self.class = 'TeutonicKnight';
  self.rank = '♞ ';
  self.mounted = true;
  self.baseSpd = 6;
  self.spriteSize = tileSize*3;
  self.damage = 25;
}

Prior = function(param){
  var self = Character(param);
  self.name = 'Prior';
  self.class = 'Prior';
  self.cleric = true;
  self.baseSpd = 2;
  self.torchBearer = true;
}

Duke = function(param){
  var self = Character(param);
  self.name = 'Duke';
  self.class = 'Duke';
  self.rank = '♝ ';
  self.spriteSize = tileSize*1.5;
  self.cleric = true;
  self.baseSpd = 3.5;
  self.torchBearer = true;s
}

Hochmeister = function(param){
  var self = Character(param);
  self.name = 'Hochmeister';
  self.class = 'Hochmeister';
  self.rank = '♜ ';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
  self.torchBearer = true;
  self.damage = 25;
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
  self.damage = 10;
  self.stealthed = true;
}

Outlaw = function(param){
  var self = Character(param);
  self.name = 'Outlaw';
  self.class = 'Outlaw';
  self.spriteSize = tileSize*1.5;
  self.ranged = true;
  self.torchBearer = true;
  self.damage = 5;
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
  self.torchBearer = true;
  self.damage = 10;
}

Cutthroat = function(param){
  var self = Character(param);
  self.name = 'Cutthroat';
  self.class = 'Cutthroat';
  self.spriteSize = tileSize*1.5;
  self.damage = 10;
  self.stealthed = true;
}

Strongman = function(param){
  var self = Character(param);
  self.name = 'Strongman';
  self.class = 'Strongman';
  self.spriteSize = tileSize*2;
  self.baseSpd = 3.5;
  self.torchBearer = true;
  self.damage = 15;
}

Marauder = function(param){
  var self = Character(param);
  self.name = 'Marauder';
  self.class = 'Marauder';
  self.rank = '♞ ';
  self.mounted = true;
  self.baseSpd = 6;
  self.spriteSize = tileSize*3;
  self.torchBearer = true;
  self.damage = 20;
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
  self.torchBearer = true;
  self.damage = 25;
}

// ARROWS
Arrow = function(param){
  var self = Entity(param);
  self.angle = param.angle;
  self.spdX = Math.cos(param.angle/180*Math.PI) * 50;
  self.spdY = Math.sin(param.angle/180*Math.PI) * 50;
  self.parent = param.parent;
  self.innaWoods = Player.list[self.parent].innaWoods;
  self.zGrid = Player.list[self.parent].zGrid;

  self.timer = 0;
  self.toRemove = false;
  var super_update = self.update;
  self.update = function(){
    super_update();
    if(self.z == 0 && getLocTile(0,self.x,self.y) >= 1 && getLocTile(0,self.x,self.y) < 2){
      self.innaWoods = true;
    } else {
      self.innaWoods = false;
    }
    if(self.timer++ > 100){
      self.toRemove = true;
    }
    for(var i in self.zGrid){
      var zc = self.zGrid[i][0];
      var zr = self.zGrid[i][1];
      if(zc < 64 && zc > -1 && zr < 64 && zr > -1){
        for(var n in zones[zr][zc]){
          var p = Player.list[zones[zr][zc][n]];
          if(p){
            if(self.getDistance(p) < 32 && self.z == p.z && self.parent != p.id){
              Player.list[zones[zr][zc][n]].hp -= Player.list[self.parent].dmg - p.fortitude;
              Player.list[zones[zr][zc][n]].working = false;
              Player.list[zones[zr][zc][n]].chopping = false;
              Player.list[zones[zr][zc][n]].mining = false;
              Player.list[zones[zr][zc][n]].farming = false;
              Player.list[zones[zr][zc][n]].building = false;
              Player.list[zones[zr][zc][n]].fishing = false;
              if(Player.list[self.parent].stealthed){
                Player.list[self.parent].stealthed = false;
                Player.list[zones[zr][zc][n]].combat.target = self.id;
                Player.list[zones[zr][zc][n]].action = 'combat';
              }
              // player death & respawn
              if(Player.list[zones[zr][zc][n]].hp <= 0){
                Player.list[zones[zr][zc][n]].die({id:self.parent,cause:'arrow'});
              }
              self.toRemove = true;
            }
          }
        }
      }
    }
    if(self.x == 0 || self.x == mapPx || self.y == 0 || self.y == mapPx){
      self.toRemove = true;
    } else if(self.z == 0 && getLocTile(0,self.x,self.y) == 5 && getLocTile(0,Player.list[self.parent].x,Player.list[self.parent].y) !== 5){
      self.toRemove = true;
    } else if(self.z == 0 && getLocTile(0,self.x,self.y) == 1 && getLocTile(0,Player.list[self.parent].x,Player.list[self.parent].y) !== 1){
      self.toRemove = true;
    } else if(self.z == 0 && (getLocTile(0,self.x,self.y) == 13 || getLocTile(0,self.x,self.y) == 14 || getLocTile(0,self.x,self.y) == 15 || getLocTile(0,self.x,self.y) == 16 || getLocTile(0,self.x,self.y) == 19)){
      self.toRemove = true;
    } else if(self.z == -1 && getLocTile(1,self.x,self.y) == 1){
      self.toRemove = true;
    } else if(self.z == -2 && getLocTile(8,self.x,self.y) == 0){
      self.toRemove = true;
    } else if(self.z == 1 && (getLocTile(3,self.x,self.y) == 0 || getLocTile(4,self.x,self.y) !== 0)){
      self.toRemove = true;
    } else if(self.z == 2 && (getLocTile(5,self.x,self.y) == 0 || getLocTile(4,self.x,self.y) !== 0)){
      self.toRemove = true;
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
  };

  self.getUpdatePack = function(){
    return {
      id:self.id,
      x:self.x,
      y:self.y,
      z:self.z,
      innaWoods:self.innaWoods
    };
  };

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
    } else {
      pack.push(arrow.getUpdatePack());
    }
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
  self.toUpdate = false;
  self.toRemove = false;
  if(self.z == 0 && getLocTile(0,self.x,self.y) >= 1 && getLocTile(0,self.x,self.y) < 2){
    self.innaWoods = true;
  } else {
    self.innaWoods = false;
  }

  self.blocker = function(n){
    var loc = getLoc(self.x,self.y);
    if(self.z == 0){
      matrixChange(0,loc[0],loc[1],n);
    } else if(self.z == 1){
      matrixChange(1,loc[0],loc[1],n);
    } else if(self.z == 2){
      matrixChange(2,loc[0],loc[1],n);
    } else if(self.z == -1){
      matrixChange(-1,loc[0],loc[1],n);
    } else if(self.z == -2){
      matrixChange(-2,loc[0],loc[1],n);
    } else if(self.z == -3){
      matrixChange(-3,loc[0],loc[1],n);
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
    if(item.toUpdate){
      item.update();
      if(item.toRemove){
        delete Item.list[i];
        removePack.item.push(item.id);
      } else {
        pack.push(item.getUpdatePack());
      }
    }
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
  self.toUpdate = true;
  var super_update = self.update;
  self.update = function(){
    if(Player.list[self.parent]){
      self.x = Player.list[self.parent].x - (tileSize * 0.75);
      self.y = Player.list[self.parent].y - (tileSize * 0.75);
      self.z = Player.list[self.parent].z;
      self.innaWoods = Player.list[self.parent].innaWoods;
    } else {
      self.toRemove = true;
    }
    if(self.timer++ > 3000){
      self.toRemove = true;
      Player.list[self.parent].hasTorch = false;
    }
    if(self.z == -3){
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
    radius:1,
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
  self.toUpdate = true;
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
  self.toUpdate = true;
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
    flanders:0,
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
    flanders:0,
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
Flanders = function(param){
  var self = Item(param);
  self.type = 'Flanders';
  self.class = 'consumable';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.flanders > 24){
      socket.emit('addToChat','<i>You are already carrying too many</i> <b>Flanders</b>.');
    } else if(player.inventory.flanders + self.qty > 25){
      var q = 25 - player.inventory.flanders;
      self.qty -= q;
      Player.list[id].inventory.flanders += q;
      socket.emit('addToChat','<i>You picked up</i> ' + q + ' <b>Flanders</b>.');
    } else {
      Player.list[id].inventory.flanders += self.qty;
      socket.emit('addToChat','<i>You picked up</i> ' + self.qty + ' <b>Flanders</b>.');
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
  self.toUpdate = false;
  var super_update = self.update;
  if(Item.list[self.parent].type == 'LitTorch'){
    self.toUpdate = true;
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
    if(light.toUpdate){
      light.update();
      if(light.toRemove){
        delete Light.list[i];
        removePack.light.push(light.id);
      } else {
        pack.push(light.getUpdatePack());
      }
    }
  }
  return pack;
}

Light.getAllInitPack = function(){
  var lights = [];
  for(var i in Light.list)
    lights.push(Light.list[i].getInitPack());
  return lights;
}
