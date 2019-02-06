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
    wood:0,
    stone:0,
    torch:10
  }
  self.facing = 'down';
  self.inTrees = false;
  self.onMtn = false;
  self.working = false;
  self.baseSpd = 6;
  self.maxSpd = 6;
  self.actionCooldown = 0;
  self.attackCooldown = 0;
  self.hp = 100;
  self.hpMax = 100;
  self.mana = 100;
  self.manaMax = 100;
  self.strength = 1;
  self.dexterity = 1;

  return self;
}

// PLAYER
Player = function(param){
  var self = Character(param);
  self.username = param.username;
  self.pressingRight = false;
  self.pressingLeft = false;
  self.pressingUp = false;
  self.pressingDown = false;
  self.pressingAttack = false;
  self.pressingC = false;
  self.pressingT = false;
  self.pressingG = false;
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

    if(self.pressingC && self.actionCooldown === 0){
      self.clearBrush();
      self.actionCooldown = 10;
    }

    if(self.pressingT && self.inventory.torch > 0 && self.actionCooldown === 0){
      self.lightTorch();
      self.actionCooldown = 10;
    }

    if(self.pressingG && self.actionCooldown === 0){
      var loc = getLoc(self.x,self.y);
      if(self.z === 0 && (getTile(0,loc[0],loc[1]) === 1 || getTile(0,loc[0],loc[1]) === 2)){
        var res = world[5][loc[1]][loc[0]];
        self.working = true;
        self.actionCooldown = 10;
        setTimeout(function(){
          if(self.working && res > 0){
            world[5][loc[1]][loc[0]] -= 1;
            self.inventory.wood += 1;
            self.working = false;
          } else {
            return;
          }
        },10000/self.strength);
      } else if(self.z === 0 && (getTile(0,loc[0],loc[1]) === 4 || getTile(0,loc[0],loc[1]) === 5)){
        var res = world[5][loc[1]][loc[0]];
        self.working = true;
        self.actionCooldown = 10;
        setTimeout(function(){
          if(self.working){
            world[5][loc[1]][loc[0]] -= 1;
            self.inventory.stone += 1;
            self.working = false;
          } else {
            return;
          }
        },10000/self.strength);
      } else if(self.z === -1 && getTile(0,loc[0],loc[1]) === 3){
        var res = world[6][loc[1]][loc[0]];
        self.working = true;
        self.actionCooldown = 10;
        setTimeout(function(){
          if(self.working){
            world[6][loc[1]][loc[0]] -= 1;
            self.inventory.stone += 1;
            console.log(self.inventory.stone);
            console.log(world[6][loc[1]][loc[0]]);
            self.working = false;
          } else {
            return;
          }
        },10000/self.strength);
      } else {
        return;
      }
    }
  }

  self.clearBrush = function(){
    var loc = getLoc(self.x,self.y);
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
      },3000);
    } else {
      return;
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
      itemId:0,
      parent:self.id,
      x:self.x,
      y:self.y,
      z:self.z,
      canPickup:false
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

    // building collisions
    if(self.z === 0 && (getLocTile(0,self.x+(tileSize/2),self.y) === 10 || (self.x + 10) > (mapPx - tileSize))){
      rightBlocked = true;
    }
    if(self.z === 0 && (getLocTile(0,self.x-(tileSize/2),self.y) === 10 || (self.x - 10) < 0)){
      leftBlocked = true;
    }
    if(self.z === 0 && (getLocTile(0,self.x,self.y-(tileSize/2)) === 10 || (self.y - 10) < 0)){
      upBlocked = true;
    }
    if(self.z === 0 && (getLocTile(0,self.x,self.y+(tileSize/2)) === 10 || (self.y + 10) > (mapPx - tileSize))){
      downBlocked = true;
    }

    // collision in caves
    if(self.z === -1 && (getLocTile(1,self.x+(tileSize/2),self.y) === 1 || getLocTile(1,self.x+(tileSize/2),self.y) === 10 || (self.x + 10) > (mapPx - tileSize))){
      rightBlocked = true;
    }
    if(self.z === -1 && (getLocTile(1,self.x-(tileSize/2),self.y) === 1 || getLocTile(1,self.x-(tileSize/2),self.y) === 10 || (self.x - 10) < 0)){
      leftBlocked = true;
    }
    if(self.z === -1 && (getLocTile(1,self.x,self.y-(tileSize/2)) === 1 || getLocTile(1,self.x,self.y-(tileSize/2)) === 10 (self.y - 10) < 0)){
      upBlocked = true;
    }
    if(self.z === -1 && (getLocTile(1,self.x,self.y+(tileSize/2)) === 1 || getLocTile(1,self.x,self.y+(tileSize/2)) === 10 || (self.y + 10) > (mapPx - tileSize))){
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
      } else if(getTile(0,loc[0],loc[1]) === 1 || getTile(0,loc[0],loc[1]) === 21 || getTile(0,loc[0],loc[1]) === 12){
        self.inTrees = true;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 0.3;
      } else if(getTile(0,loc[0],loc[1]) === 2){
        self.inTrees = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 0.4;
      } else if(getTile(0,loc[0],loc[1]) === 3){
        self.inTrees = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 0.5;
      } else if(getTile(0,loc[0],loc[1]) === 4){
        self.inTrees = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * 0.75;
      } else if(getTile(0,loc[0],loc[1]) === 5 && !self.onMtn){
        self.inTrees = false;
        self.maxSpd = self.baseSpd * 0.1;
        setTimeout(function(){
          if(getTile(0,loc[0],loc[1]) === 5 && !self.onMtn){
            self.maxSpd = 0.5;
            self.onMtn = true;
          }
        },3000);
      } else if(getTile(0,loc[0],loc[1]) === 5 && self.onMtn){
        self.maxSpd = self.baseSpd * 0.5;
      } else {
        self.maxSpd = self.baseSpd;
      }
    } else if(self.z === -1){
      if(getTile(1,loc[0],loc[1]) === 2){
        self.z = 0;
        self.inTrees = false;
        self.onMtn = false;
      }
    } // else if other z values...
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
    } else if(data.inputId === 'c'){
      player.pressingC = data.state;
    } else if(data.inputId === 't'){
      player.pressingT = data.state;
    } else if(data.inputId === 'g'){
      player.pressingG = data.state;
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
      SOCKET_LIST[i].emit('addToChat',data.username + ': ' + data.message);
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
      socket.emit('addToChat',data.recip + ' is not online.');
    } else {
      recipient.emit('addToChat','@' + player.username + ' whispers: ' + data.message);
      SOCKET_LIST[player.id].emit('addToChat','To ' + data.recip + ': ' + data.message);
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
      } else if(self.z === -1 && getLocTile(1,self.x,self.y) === 1){
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

// itemId list:
// 0: Torch,

// ITEM
Item = function(param){
  var self = Entity(param);
  self.x = param.x;
  self.y = param.y;
  self.z = param.z;
  self.itemId = param.itemId;
  self.parent = param.parent;
  self.canPickup = param.canPickup;
  self.toRemove = false;

  self.getInitPack = function(){
    return {
      id:self.id,
      parent:self.parent,
      itemId:self.itemId,
      x:self.x,
      y:self.y,
      z:self.z,
      canPickup:self.canPickup
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
    radius:150,
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
