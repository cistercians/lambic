/////////////////////////////////////////////////////////////////////////
//                                                                     //
//                 ((🔥))   S T R O N G H O D L   ((🔥))               //
//                   \\                            //                  //
//                                                                     //
//   ☩  A   S O L I S   O R T V   V S Q V E   A D   O C C A S V M  ☩   //
//                                                                     //
//            A game by Johan Argyne / Templar Ventures.               //
//                                                                     //
/////////////////////////////////////////////////////////////////////////

// "The only way to prove anything to anybody is actually do something."
//  - Paul T.

var fs = require('fs');

// BUILD MAP
var genesis = require('./server/js/genesis');
var world = genesis.map;
var tileSize = 64;
var mapSize = world[0].length;
var mapPx = mapSize * tileSize;

// MAP TOOLS

// get tile type from (l,c,r)
// l === 'layer' 0: Overworld, 1: Underworld,  2: Underwater, 3: Buildings
var getTile = function(l,c,r){
  if(r >= 0 && r <= mapSize && c >= 0 && c <= mapSize){
    return world[l][r][c];
  } else {
    return;
  }
};

// get loc from (x,y)
var getLoc = function(x,y){
  var loc = [Math.floor(x/tileSize),Math.floor(y/tileSize)];
  return loc;
};

var getLocTile = function(l,x,y){
  if(x >= 0 && x <= mapPx && y >= 0 && y <= mapPx){
    var loc = getLoc(x,y);
    return world[l][loc[1]][loc[0]];
  }
};

// get random tile + its loc
var randomTile = function(l){
  var max = mapSize;
  var c = Math.floor(Math.random() * max);
  var r = Math.floor(Math.random() * max);
  return [world[l][r][c],c,r];
};

// get (x,y) coords of tile from loc
var getCoords = function(c,r){
  var coords = [c * tileSize, r * tileSize];
  return coords;
};

// random spawner
var randomSpawn = function(){
  var spawn = [];
  var select = [];

  for(var i = 0; i < 20; i++){
    select.push(randomTile(0));
  }
  for(var n = 0; n < 7; n++){
    var target = select[n];
    // skips over water and heavy forest
    if(target[0] !== 0 && target[0] !== 1){
      var point = getCoords(target[1],target[2]);
      return point;
      console.log(point);
    } else {
      continue;
    }
  }
};

// save map file?
var saveMap = false;

if(saveMap){
  fs.writeFile("./mapFiles/map.txt", world, function(err){
    if(err){
      return console.log(err);
    }
    console.log("Map file saved to '/mapfiles' folder.");
  });
};

// dayNight cycle
var tempus = 'XII.a';
var period = 360; // 1: 1hr, 2: 30m, 4: 15m, 12: 5m, 60: 1m, 360: 10s
var cycle = ['XII.a','I.a','II.a','III.a','IV.a','V.a','VI.a','VII.a','VIII.a','IX.a','X.a','XI.a',
            'XII.p','I.p','II.p','III.p','IV.p','V.p','VI.p','VII.p','VIII.p','IX.p','X.p','XI.p'];
var tick = 1;
var days = 0;

// weather

// DATABASE
var mongojs = require('mongojs');
var db = mongojs('localhost:27017/myGame',['account','progress']);

// NETWORKING
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req, res) {
  res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));

serv.listen(2000);
console.log("###################################");
console.log("");
console.log("        S T R O N G H O D L");
console.log("");
console.log("   A SOLIS ORTV VSQVE AD OCCASVM");
console.log("");
console.log("###################################");

var SOCKET_LIST = {};

// DEBUG - change to false when deploying to public
var DEBUG = true;

// ENTITY
var Entity = function(param){
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
var Character = function(param){
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
    torch:10
  }
  self.facing = 'down';
  self.inTrees = false;
  self.onMtn = false;
  self.baseSpd = 6;
  self.maxSpd = 6;
  self.actionCooldown = 0;
  self.attackCooldown = 0;
  self.hp = 100;
  self.hpMax = 100;
  self.mana = 100;
  self.manaMax = 100;
  self.dexterity = 1;

  return self;
}

// PLAYER
var Player = function(param){
  var self = Character(param);
  self.number = Math.floor(10 * Math.random());
  self.pressingRight = false;
  self.pressingLeft = false;
  self.pressingUp = false;
  self.pressingDown = false;
  self.pressingAttack = false;
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

    if(self.pressing1 && self.inventory.torch > 0 && self.actionCooldown === 0){
      self.lightTorch();
      self.actionCooldown = 10;
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

    // collision in caves
    if(self.z === -1 && getLocTile(1,self.x+(tileSize/2),self.y) === 1){
      rightBlocked = true;
    }
    if(self.z === -1 && getLocTile(1,self.x-(tileSize/2),self.y) === 1){
      leftBlocked = true;
    }
    if(self.z === -1 && getLocTile(1,self.x,self.y-(tileSize/2)) === 1){
      upBlocked = true;
    }
    if(self.z === -1 && getLocTile(1,self.x,self.y+(tileSize/2)) === 1){
      downBlocked = true;
    }

    if(self.pressingRight && !rightBlocked){
      self.spdX = self.maxSpd;
      self.facing = 'right';
    } else if(self.pressingLeft && !leftBlocked){
      self.spdX = -self.maxSpd;
      self.facing = 'left';
    } else {
      self.spdX = 0;
    }

    if(self.pressingUp && !upBlocked){
      self.spdY = -self.maxSpd;
      self.facing = 'up';
    } else if(self.pressingDown && !downBlocked){
      self.spdY = self.maxSpd;
      self.facing = 'down';
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
      id:self.id,
      x:self.x,
      y:self.y,
      z:self.z,
      inTrees:self.inTrees,
      number:self.number,
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
      attackCooldown:self.attackCooldown,
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

Player.onConnect = function(socket){
  var spawn = randomSpawn();
  var player = Player({
    id:socket.id,
    z: 0,
    x: spawn[0],
    y: spawn[1]
  });
  console.log(player.id + ' spawned at : ' + spawn + ' z: 0')
  // player control inputs
  socket.on('keyPress',function(data){
    if(data.inputId === 'left')
      player.pressingLeft = data.state;
    else if(data.inputId === 'right')
      player.pressingRight = data.state;
    else if(data.inputId === 'up')
      player.pressingUp = data.state;
    else if(data.inputId === 'down')
      player.pressingDown = data.state;
    else if(data.inputId === 'attack')
      player.pressingAttack = data.state;
    else if(data.inputId === '1')
      player.pressing1 = data.state;
    else if(data.inputId === '2')
      player.pressing1 = data.state;
    else if(data.inputId === '3')
      player.pressing1 = data.state;
    else if(data.inputId === 'mouseAngle')
      player.mouseAngle = data.state;
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
var Arrow = function(param){
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
var Item = function(param){
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
var Torch = function(param){
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
var Light = function(param){
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

// SERVER
var isValidPassword = function(data,cb){
  db.account.find({username:data.username,password:data.password},function(err,res){
    if(res.length > 0)
      cb(true);
    else
      cb(false);
  });
}

var isUsernameTaken = function(data,cb){
  db.account.find({username:data.username},function(err,res){
    if(res.length > 0)
      cb(true);
    else
      cb(false);
  });
}

var addUser = function(data,cb){
  db.account.insert({username:data.username,password:data.password},function(err){
    cb();
  });
}

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;
  console.log('Socket connected: ' + socket.id);

  socket.on('signIn',function(data){
    isValidPassword(data,function(res){
      if(res){
        Player.onConnect(socket);
        socket.emit('signInResponse',{
          success:true,
          world: world,
          tileSize: tileSize,
          mapSize: mapSize,
          tempus: tempus
        });
        console.log(data.username + ' logged in.');
      } else {
        socket.emit('signInResponse',{success:false});
      }
    })
  });

  socket.on('signUp',function(data){
    isUsernameTaken(data,function(res){
      if(res){
        socket.emit('signUpResponse',{success:false});
      } else {
        addUser(data,function(){
          socket.emit('signUpResponse',{success:true});
          console.log(data.username + ' signed up.');
        });
      }
    })
  });

  socket.on('disconnect',function(){
    delete SOCKET_LIST[socket.id];
    Player.onDisconnect(socket);
    console.log('Socket disconnected: ' + socket.id);
  });

  socket.on('sendMsgToServer',function(data){
    var playerName = ("" + socket.id).slice(2,7);
    for(var i in SOCKET_LIST){
      SOCKET_LIST[i].emit('addToChat',playerName + ': ' + data);
    }
  });

  socket.on('evalServer',function(data){
    if(!DEBUG)
      return;
    var res = eval(data);
    socket.emit('evalAnswer',res);
  });
});

// GAME STATE

// day/night cycle
var dayNight = function(){
  tempus = cycle[tick];
  if(tempus === 'XII.a'){
    days++;
  }
  io.emit('tempus',{
    tempus:tempus
  })
  console.log(tempus);
  if(tick < 23){
    tick++;
  } else {
    tick = 0
  };
};

// initiate dayNight cycle
setInterval(dayNight, 3600000/period);
console.log(tempus);

var initPack = {player:[],arrow:[],item:[], light:[]};
var removePack = {player:[],arrow:[],item:[], light:[]};

setInterval(function(){
  var pack =  {
    player:Player.update(),
    arrow:Arrow.update(),
    item:Item.update(),
    light:Light.update()
  }

  for(var i in SOCKET_LIST){
    var socket = SOCKET_LIST[i];
    socket.emit('init',initPack);
    socket.emit('update',pack);
    socket.emit('remove',removePack);
  }

  initPack.player = [];
  initPack.arrow = [];
  initPack.item = [];
  initPack.light = [];
  removePack.player = [];
  removePack.arrow = [];
  removePack.item = [];
  removePack.light = [];

},1000/25);
