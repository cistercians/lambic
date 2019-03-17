/////////////////////////////////////////////////////////////////////////
//                                                                     //
//                 ((🔥))   S T R O N G H O D L   ((🔥))               //
//                   \\                            //                  //
//                                                                     //
//   ☩  A   S O L I S   O R T V   V S Q V E   A D   O C C A S V M  ☩   //
//                                                                     //
//            A game by Johan Argyne, Cistercian Capital               //
//                                                                     //
/////////////////////////////////////////////////////////////////////////

var fs = require('fs');

// BUILD MAP
var genesis = require('./server/js/genesis');
world = genesis.map;
tileSize = 64;
mapSize = world[0].length;
mapPx = mapSize * tileSize;

// MAP TOOLS
// spawn points (Overworld)
spawnPointsO = [];

for(x = 0; x < mapSize; x++){
  for(y = 0; y < mapSize; y++){
    var tile = world[0][y][x];
    if(tile !== 0){
      spawnPointsO.push([x,y]);
    } else {
      continue;
    }
  }
}

// spawn points (Underworld)
spawnPointsU = [];

for(x = 0; x < mapSize; x++){
  for(y = 0; y < mapSize; y++){
    var tile = world[1][y][x];
    if(tile === 0){
      spawnPointsU.push([x,y]);
    } else {
      continue;
    }
  }
}

// get tile type from (l,c,r)
// l === 'layer'
// 0: Overworld, 1: Underworld,  2: Underwater, 3: Buildings
getTile = function(l,c,r){
  if(r >= 0 && r <= mapSize && c >= 0 && c <= mapSize){
    return world[l][r][c];
  } else {
    return;
  }
};

// get loc from (x,y)
getLoc = function(x,y){
  var loc = [Math.floor(x/tileSize),Math.floor(y/tileSize)];
  return loc;
};

// get tile type from (l,x,y)
getLocTile = function(l,x,y){
  if(x >= 0 && x <= mapPx && y >= 0 && y <= mapPx){
    var loc = getLoc(x,y);
    return world[l][loc[1]][loc[0]];
  }
};

// get building id from (x,y)
getBuilding = function(x,y){
  var loc = getLoc(x,y);
  for(i = 0; i < buildingCount; i++){
    var b = Building.list[buildingId[i]];
    for(n = 0; n < b.plot.length; n++){
      if(b.plot[n][0] === loc[0] && b.plot[n][1] === loc[1]){
        return b.id;
      } else {
        continue;
      }
    }
  }
}

// check if player has key to door from (x,y,player.id)
keyCheck = function(x,y,p){
  var key = getBuilding(x,y);
  var pKeys = Player.list[p].inventory.keys;
  for(i in pKeys){
    if(pKeys[i] === key){
      return true;
    } else {
      continue;
    }
    return false;
  }
}

// check if player can pass through closed gate
gateCheck = function(x,y,h,k){
  var gateH = Building.list[getBuilding(x,y)].house;
  var gateK = Building.list[getBuilding(x,y)].kingdom;
  if(k && k === gateK){
    return true;
  } else {
    if(h && h === gateH){
      return true;
    } else {
      return false;
    }
  }
}

// get random tile + its loc
var randomTile = function(l){
  var max = mapSize;
  var c = Math.floor(Math.random() * max);
  var r = Math.floor(Math.random() * max);
  return [world[l][r][c],c,r];
};

// get (x,y) coords of tile from loc
getCoords = function(c,r){
  var coords = [c * tileSize, r * tileSize];
  return coords;
};

// random spawner (Overworld)
randomSpawnO = function(){
  var rand = Math.floor(Math.random() * (spawnPointsO.length - 1));
  var point = spawnPointsO[rand];
  var spawn = getCoords(point[0],point[1]);
  return spawn;
};

// random spawner (Underworld)
randomSpawnU = function(){
  var rand = Math.floor(Math.random() * (spawnPointsU.length - 1));
  var point = spawnPointsU[rand];
  var spawn = getCoords(point[0],point[1]);
  return spawn;
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
var period = 360; // 1=1hr, 2=30m, 4=15m, 12=5m, 60=1m, 360=10s
var cycle = ['XII.a','I.a','II.a','III.a','IV.a','V.a','VI.a','VII.a','VIII.a','IX.a','X.a','XI.a',
            'XII.p','I.p','II.p','III.p','IV.p','V.p','VI.p','VII.p','VIII.p','IX.p','X.p','XI.p'];
var tick = 1;
var days = 0;

// weather

// DATABASE
var mongojs = require('mongojs');
var db = mongojs('localhost:27017/myGame',['account','progress']);

require('./server/js/Entity');
require('./server/js/Commands');
require('./server/js/entropy');

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
console.log("     ♜  S T R O N G H O D L ♜");
console.log("");
console.log("   A SOLIS ORTV VSQVE AD OCCASVM");
console.log("");
console.log("###################################");

SOCKET_LIST = {};

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

io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;
  console.log('Socket connected: ' + socket.id);

  socket.on('signIn',function(data){
    isValidPassword(data,function(res){
      if(res){
        Player.onConnect(socket, data.username);
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
    if(data.username.length > 0){
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
    } else {
      socket.emit('signUpResponse',{success:false});
    }
  });

  socket.on('disconnect',function(){
    delete SOCKET_LIST[socket.id];
    Player.onDisconnect(socket);
    console.log('Socket disconnected: ' + socket.id);
  });

  socket.on('evalCmd',function(data){
    EvalCmd(data);
  });
});

// GAME STATE

// day/night cycle
var dayNight = function(){
  tempus = cycle[tick];
  if(tempus === 'XII.a'){
    days++;
    entropy();
  }
  io.emit('tempus',{
    tempus:tempus
  })
  console.log(tempus);
  if(tick < 23){
    tick++;
  } else {
    tick = 0
  }
};

// initiate day/night cycle
setInterval(dayNight, 3600000/period);
console.log(tempus);

initPack = {player:[],arrow:[],item:[], light:[]};
removePack = {player:[],arrow:[],item:[], light:[]};

setInterval(function(){
  var pack = {
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
