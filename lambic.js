var fs = require('fs');

// BUILD MAP
var genesis = require('./server/js/genesis');
var world = genesis.map;
var tileSize = 16;
var mapSize = world[0].length;

// dayNight cycle
var tempus = 'XII.a';
var period = 360; // 1: 1hr, 2: 30m, 4: 15m, 12: 5m, 60: 1m, 360: 10s
var cycle = ['XII.a','I.a','II.a','III.a','IV.a','V.a','VI.a','VII.a','VIII.a','IX.a','X.a','XI.a',
            'XII.p','I.p','II.p','III.p','IV.p','V.p','VI.p','VII.p','VIII.p','IX.p','X.p','XI.p'];
var tick = 1;

// MAP TOOLS
// get tile type from (c,r)
var getTile = function(col,row){
  return mapData[col][row];
};
// get random tile + its (c,r)
var randomTile = function(){
  min = 0;
  max = mapSize;
  var col = Math.floor(Math.random() * (max - min + 1)) + min;
  var row = Math.floor(Math.random() * (max - min + 1)) + min;
  return [world[col][row],col,row];
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
console.log("Server online.");

var SOCKET_LIST = {};

// DEBUG - change to false when deploying to public
var DEBUG = true;

// ENTITY
var Entity = function(c,r){
  var self = {
    x:288,
    y:288,
    loc:[c,r],
    spdX:0,
    spdY:0,
    id:""
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
}

var firstSpawn = function(){
  var times = [1,1,1,1,1,1,1];
  var selection = [];
  times.forEach(function(i){
    var rtile = randomTile();
    if(rtile[0] !== 0 && rtile[0] !== 1 && rtile[0] !== 5){
      selection.push(rtile);
    }
  });
  var spawn = selection[Math.floor(Math.random() * selection.length)];
  console.log(spawn);
  return spawn;
}

// PLAYER
var Player = function(id){
  // spawns at random tile
  var self = Entity(firstSpawn()[1],randomTile()[2]);
  self.id = id;
  self.number = Math.floor(10 * Math.random());
  self.pressingRight = false;
  self.pressingLeft = false;
  self.pressingUp = false;
  self.pressingDown = false;
  self.pressingAttack = false;
  self.mouseAngle = 0;
  self.maxSpd = 50;
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
      self.shootBullet(self.mouseAngle);
    }
  }

  self.shootBullet = function(angle){
    var a = Bullet(self.id,angle);
    a.x = self.x;
    a.y = self.y;
  }

  self.updateSpd = function(){
    if(self.pressingRight){
      self.spdX = self.maxSpd;
      self.loc[0] += 1;
    } else if(self.pressingLeft){
      self.spdX = -self.maxSpd;
      self.loc[0] -= 1;
    } else {
      self.spdX = 0;
    }

    if(self.pressingUp){
      self.spdY = -self.maxSpd;
      self.loc[1] -= 1;
    } else if(self.pressingDown){
      self.spdY = self.maxSpd;
      self.loc[1] += 1;
    } else {
      self.spdY = 0;
    }
  }

  self.getInitPack = function(){
    return {
      id:self.id,
      x:self.x,
      y:self.y,
      loc:self.loc,
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
      hp:self.hp,
      hpMax:self.hpMax,
      mana:self.mana,
      manaMax:self.manaMax
    }
  }

  Player.list[id] = self;

  initPack.player.push(self.getInitPack());
  return self;
}

Player.list = {};

Player.onConnect = function(socket){
  var player = Player(socket.id);
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

  // send map data
  socket.emit('mapData',{
    world: world,
    tileSize: tileSize,
    mapSize: mapSize
  })

  socket.emit('init',{
    selfId:socket.id,
    player:Player.getAllInitPack(),
    bullet:Bullet.getAllInitPack()
  })
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
var Bullet = function(parent,angle){
  var self = Entity();
  self.id = Math.random();
  self.spdX = Math.cos(angle/180*Math.PI) * 10;
  self.spdY = Math.sin(angle/180*Math.PI) * 10;
  self.parent = parent;
  self.timer = 0;
  self.toRemove = false;
  var super_update = self.update;
  self.update = function(){
    if(self.timer++ > 100)
      self.toRemove = true;
    super_update();

    for(var i in Player.list){
      var p = Player.list[i];
      if(self.getDistance(p) < 32 && self.parent !== p.id){
        p.hp -= 5;
        // defines shooter
        var shooter = Player.list[self.parent];
        // player death & respawn
        if(p.hp <= 0){
          p.hp = p.hpMax;
          p.x = Math.random() * 500;
          p.y = Math.random() * 500;
        }
        self.toRemove = true;
      }
    }
  }

  self.getInitPack = function(){
    return {
      id:self.id,
      x:self.x,
      y:self.y
    };
  }

  self.getUpdatePack = function(){
    return {
      id:self.id,
      x:self.x,
      y:self.y
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
        socket.emit('signInResponse',{success:true});
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

  // dayNight cycle
  var dayNight = function(){
    tempus = cycle[tick];
    socket.emit('tempus',{
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

});

// GAME STATE

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
