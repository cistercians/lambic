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

// MAP TOOLS

// get tile type from (l,c,r)
// l === 'layer' 0: Overworld, 1: Underworld,  2: Underwater, 3: Buildings
var getTile = function(l,c,r){
  return world[l][c][r];
};
// get random tile + its loc
var randomTile = function(l){
  max = mapSize;
  var c = Math.floor(Math.random() * max);
  var r = Math.floor(Math.random() * max);
  return [world[l][c][r],c,r];
};

// get loc from (x,y)
var getLoc = function(x,y){
  var loc = [Math.floor(x/tileSize),Math.floor(y/tileSize)];
  return loc;
}

// get (x,y) coords of center of tile from loc
var getCoords = function(c,r){
  var coords = [c * tileSize, r * tileSize];
  return coords;
};

// random spawner
var randomSpawn = function(){
  var spawn = [];
  var select = [];

  for(var i = 0; i < 7; i++){
    select.push(randomTile(0));
  }
  for(var n = 0; n < 7; n++){
    var target = select[n];
    // skips over water and heavy forest
    if(target[0] !== 0 && target[0] !== 1){
      var point = getCoords(target[1],target[2]);
      return point;
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
var period = 60; // 1: 1hr, 2: 30m, 4: 15m, 12: 5m, 60: 1m, 360: 10s
var cycle = ['XII.a','I.a','II.a','III.a','IV.a','V.a','VI.a','VII.a','VIII.a','IX.a','X.a','XI.a',
            'XII.p','I.p','II.p','III.p','IV.p','V.p','VI.p','VII.p','VIII.p','IX.p','X.p','XI.p'];
var tick = 1;

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
console.log("A SOLIS ORTV VSQVE AD OCCASVM");

var SOCKET_LIST = {};

// DEBUG - change to false when deploying to public
var DEBUG = true;

// ENTITY
var Entity = function(param){
  var self = {
    x:0,
    y:0,
    loc:[0,0],
    z:0,
    spdX:0,
    spdY:0,
    id:""
  }
  if(param){
    if(param.x)
      self.x = param.x;
    if(param.y)
      self.y = param.y;
    if(param.loc)
      self.loc = param.loc;
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
    self.loc = getLoc(self.x,self.y);
  }

  self.getDistance = function(pt){
    return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2));
  }
  return self;
};

// PLAYER
var Player = function(param){
  var self = Entity(param);
  self.number = Math.floor(10 * Math.random());
  self.pressingRight = false;
  self.pressingLeft = false;
  self.pressingUp = false;
  self.pressingDown = false;
  self.pressingAttack = false;
  self.facing = 'down';
  self.mouseAngle = 0;
  self.maxSpd = 10;
  self.hp = 100;
  self.hpMax = 100;
  self.hpNat = 100;
  self.mana = 100;
  self.manaMax = 100;
  self.manaNat = 100;

  var super_update = self.update;
  self.update = function(){
    self.updateSpd();
    super_update();

    if(self.pressingAttack){
      self.shootBullet(self.mouseAngle); // EDIT to use attack of weapon type
    }
  }

  self.shootBullet = function(angle){
    Bullet({
      parent:self.id,
      angle:angle,
      x:self.x,
      y:self.y
    });
  }

  // x,y movement
  self.updateSpd = function(){
    if(self.pressingRight){
      self.spdX = self.maxSpd;
      self.facing = 'right';
    } else if(self.pressingLeft){
      self.spdX = -self.maxSpd;
      self.facing = 'left';
    } else {
      self.spdX = 0;
    }

    if(self.pressingUp){
      self.spdY = -self.maxSpd;
      self.facing = 'up';
    } else if(self.pressingDown){
      self.spdY = self.maxSpd;
      self.facing = 'down';
    } else {
      self.spdY = 0;
    }

    // z movement
    if(self.z === 0 && getTile(0,self.loc[0],self.loc[1] === 6)){
      self.z = -1;
      console.log('fire');
    }
    if(self.z === -1 && getTile(1,self.loc[0],self.loc[1] === 2)){
      self.z = 0;
      console.log('fire');
    }
  }

  self.getInitPack = function(){
    return {
      id:self.id,
      x:self.x,
      y:self.y,
      loc:self.loc,
      z:self.z,
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
      loc:self.loc,
      z:self.z,
      facing:self.facing,
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
    x: spawn[0],
    y: spawn[1],
    loc: getLoc(spawn[0],spawn[1])
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
    else if(data.inputId === 'mouseAngle')
      player.mouseAngle = data.state;
  });

  socket.emit('init',{
    selfId:player.id,
    player:Player.getAllInitPack(),
    bullet:Bullet.getAllInitPack()
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

// BULLETS
var Bullet = function(param){
  var self = Entity(param);
  self.id = Math.random();
  self.angle = param.angle;
  self.spdX = Math.cos(param.angle/180*Math.PI) * 30;
  self.spdY = Math.sin(param.angle/180*Math.PI) * 30;
  self.parent = param.parent;

  self.timer = 0;
  self.toRemove = false;
  var super_update = self.update;
  self.update = function(){
    if(self.timer++ > 100)
      self.toRemove = true;
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
          p.x = Math.random() * 500; // replace this
          p.y = Math.random() * 500; // replace this
        }
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

  Bullet.list[self.id] = self;
  initPack.bullet.push(self.getInitPack());
  return self;
}

Bullet.list = {};

Bullet.update = function(){
  var pack = [];
  for(var i in Bullet.list){
    var bullet = Bullet.list[i];
    bullet.update();
    if(bullet.toRemove){
      delete Bullet.list[i];
      removePack.bullet.push(bullet.id);
    } else
      pack.push(bullet.getUpdatePack());
  }
  return pack;
}

Bullet.getAllInitPack = function(){
  var bullets = [];
  for(var i in Bullet.list)
    bullets.push(Bullet.list[i].getInitPack());
  return bullets;
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

var initPack = {player:[],bullet:[]};
var removePack = {player:[],bullet:[]};

setInterval(function(){
  var pack =  {
    player:Player.update(),
    bullet:Bullet.update()
  }

  for(var i in SOCKET_LIST){
    var socket = SOCKET_LIST[i];
    socket.emit('init',initPack);
    socket.emit('update',pack);
    socket.emit('remove',removePack);
  }

  initPack.player = [];
  initPack.bullet = [];
  removePack.player = [];
  removePack.bullet = [];

},1000/25);
