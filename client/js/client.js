var WIDTH = 768;
var HEIGHT = 768;
var world = [];
var tileSize = 0;
var mapSize = 0;

var socket = io();

//SIGN IN
var signDiv = document.getElementById('signDiv');
var signDivUsername = document.getElementById('signDiv-username');
var signDivPassword = document.getElementById('signDiv-password');
var signDivSignIn = document.getElementById('signDiv-signIn');
var signDivSignUp = document.getElementById('signDiv-signUp');

signDivSignIn.onclick = function(){
  socket.emit('signIn',{username:signDivUsername.value,password:signDivPassword.value});
}

signDivSignUp.onclick = function(){
  socket.emit('signUp',{username:signDivUsername.value,password:signDivPassword.value});
}

socket.on('signInResponse',function(data){
  if(data.success){
    world = data.world;
    tileSize = data.tileSize;
    mapSize = data.mapSize;
    tempus = data.tempus;
    signDiv.style.display = 'none';
    gameDiv.style.display = 'inline-block';
    UI.style.display = 'inline-block';
  } else
    alert('Sign-in failed.')
});

socket.on('signUpResponse',function(data){
  if(data.success){
    alert('Sign-up successful.')
  } else
    alert('Sign-up failed.')
});

// CHAT & COMMANDS
var chatText = document.getElementById('chat-text');
var chatInput = document.getElementById('chat-input');
var chatForm = document.getElementById('chat-form');

socket.on('addToChat',function(data){
  chatText.innerHTML += '<div>' + data + '</div>';
});

socket.on('evalAnswer',function(data){
  chatText.innerHTML += '<div>' + data + '</div>';
  console.log(data);
});

chatForm.onsubmit = function(e){
  e.preventDefault();
  if(chatInput.value[0] === '/')
    socket.emit('evalServer',chatInput.value.slice(1));
  else
    socket.emit('sendMsgToServer',chatInput.value);
  chatInput.value = '';
}

// GAME

// IMAGES
// walking animation
var wlk = 0;
setInterval(function(){
  if(wlk === 1){
    wlk = 0;
  } else {
    wlk = 1;
  }
},400);

var Img = {};

// TILES
Img.grassland = new Image();
Img.grassland.src = '/client/img/tiles/grassland.png';
Img.water1 = new Image();
Img.water1.src = '/client/img/tiles/water1.png';
Img.water2 = new Image();
Img.water2.src = '/client/img/tiles/water2.png';
Img.water3 = new Image();
Img.water3.src = '/client/img/tiles/water3.png';
Img.hforest = new Image();
Img.hforest.src = '/client/img/tiles/hforest.png';
Img.forest = new Image();
Img.forest.src = '/client/img/tiles/forest.png';
Img.brush = new Image();
Img.brush.src = '/client/img/tiles/brush.png';
Img.rocks = new Image();
Img.rocks.src = '/client/img/tiles/rocks.png';
Img.mountain = new Image();
Img.mountain.src = '/client/img/tiles/mountain.png';
Img.clouds1 = new Image();
Img.clouds1.src = '/client/img/tiles/clouds1.png';
Img.clouds2 = new Image();
Img.clouds2.src = '/client/img/tiles/clouds2.png';
Img.clouds3 = new Image();
Img.clouds3.src = '/client/img/tiles/clouds3.png';
Img.cavein = new Image();
Img.cavein.src = '/client/img/tiles/cavein.png';
Img.caveout = new Image();
Img.caveout.src = '/client/img/tiles/caveout.png';
Img.cavewall = new Image();
Img.cavewall.src = '/client/img/tiles/cavewall.png';
Img.cavefloor = new Image();
Img.cavefloor.src = '/client/img/tiles/cavefloor.png';

// CHARACTERS

// male serf
// stand
Img.maleserfstandd = new Image();
Img.maleserfstandd.src = '/client/img/chars/serf/male/standd.png';
Img.maleserfstandu = new Image();
Img.maleserfstandu.src = '/client/img/chars/serf/male/standu.png';
Img.maleserfstandl = new Image();
Img.maleserfstandl.src = '/client/img/chars/serf/male/standl.png';
Img.maleserfstandr = new Image();
Img.maleserfstandr.src = '/client/img/chars/serf/male/standr.png';

// walk
Img.maleserfwalkd1 = new Image();
Img.maleserfwalkd1.src = '/client/img/chars/serf/male/walkd1.png';
Img.maleserfwalkd2 = new Image();
Img.maleserfwalkd2.src = '/client/img/chars/serf/male/walkd2.png';
Img.maleserfwalku1 = new Image();
Img.maleserfwalku1.src = '/client/img/chars/serf/male/walku1.png';
Img.maleserfwalku2 = new Image();
Img.maleserfwalku2.src = '/client/img/chars/serf/male/walku2.png';
Img.maleserfwalkl1 = new Image();
Img.maleserfwalkl1.src = '/client/img/chars/serf/male/walkl1.png';
Img.maleserfwalkl2 = new Image();
Img.maleserfwalkl2.src = '/client/img/chars/serf/male/walkl2.png';
Img.maleserfwalkr1 = new Image();
Img.maleserfwalkr1.src = '/client/img/chars/serf/male/walkr1.png';
Img.maleserfwalkr2 = new Image();
Img.maleserfwalkr2.src = '/client/img/chars/serf/male/walkr2.png';

var maleserfwalkd = [Img.maleserfwalkd1,Img.maleserfwalkd2];
var maleserfwalku = [Img.maleserfwalku1,Img.maleserfwalku2];
var maleserfwalkl = [Img.maleserfwalkl1,Img.maleserfwalkl2];
var maleserfwalkr = [Img.maleserfwalkr1,Img.maleserfwalkr2];

// attack
Img.maleserfattackds = new Image();
Img.maleserfattackds.src = '/client/img/chars/serf/male/attackds.png';
Img.maleserfattackus = new Image();
Img.maleserfattackus.src = '/client/img/chars/serf/male/attackus.png';
Img.maleserfattackls = new Image();
Img.maleserfattackls.src = '/client/img/chars/serf/male/attackls.png';
Img.maleserfattackrs = new Image();
Img.maleserfattackrs.src = '/client/img/chars/serf/male/attackrs.png';
Img.maleserfattackdb = new Image();
Img.maleserfattackdb.src = '/client/img/chars/serf/male/attackdb.png';
Img.maleserfattackub = new Image();
Img.maleserfattackub.src = '/client/img/chars/serf/male/attackub.png';
Img.maleserfattacklb = new Image();
Img.maleserfattacklb.src = '/client/img/chars/serf/male/attacklb.png';
Img.maleserfattackrb = new Image();
Img.maleserfattackrb.src = '/client/img/chars/serf/male/attackrb.png';

var maleserf = {
  facedown: Img.maleserfstandd,
  faceup: Img.maleserfstandu,
  faceleft: Img.maleserfstandl,
  faceright: Img.maleserfstandr,
  walkdown: maleserfwalkd,
  walkup: maleserfwalku,
  walkleft: maleserfwalkl,
  walkright: maleserfwalkr,
  attackds: Img.maleserfattackds,
  attackus: Img.maleserfattackus,
  attackls: Img.maleserfattackls,
  attackrs: Img.maleserfattackrs,
  attackdb: Img.maleserfattackdb,
  attackub: Img.maleserfattackub,
  attacklb: Img.maleserfattacklb,
  attackrb: Img.maleserfattackrb
};

// female serf
//stand
Img.femaleserfstandd = new Image();
Img.femaleserfstandd.src = '/client/img/chars/serf/female/standd.png';
Img.femaleserfstandu = new Image();
Img.femaleserfstandu.src = '/client/img/chars/serf/female/standu.png';
Img.femaleserfstandl = new Image();
Img.femaleserfstandl.src = '/client/img/chars/serf/female/standl.png';
Img.femaleserfstandr = new Image();
Img.femaleserfstandr.src = '/client/img/chars/serf/female/standr.png';

// walk
Img.femaleserfwalkd1 = new Image();
Img.femaleserfwalkd1.src = '/client/img/chars/serf/female/walkd1.png';
Img.femaleserfwalkd2 = new Image();
Img.femaleserfwalkd2.src = '/client/img/chars/serf/female/walkd2.png';
Img.femaleserfwalku1 = new Image();
Img.femaleserfwalku1.src = '/client/img/chars/serf/female/walku1.png';
Img.femaleserfwalku2 = new Image();
Img.femaleserfwalku2.src = '/client/img/chars/serf/female/walku2.png';
Img.femaleserfwalkl1 = new Image();
Img.femaleserfwalkl1.src = '/client/img/chars/serf/female/walkl1.png';
Img.femaleserfwalkl2 = new Image();
Img.femaleserfwalkl2.src = '/client/img/chars/serf/female/walkl2.png';
Img.femaleserfwalkr1 = new Image();
Img.femaleserfwalkr1.src = '/client/img/chars/serf/female/walkr1.png';
Img.femaleserfwalkr2 = new Image();
Img.femaleserfwalkr2.src = '/client/img/chars/serf/female/walkr2.png';

var femaleserfwalkd = [Img.femaleserfwalkd1,Img.femaleserfwalkd2];
var femaleserfwalku = [Img.femaleserfwalku1,Img.femaleserfwalku2];
var femaleserfwalkl = [Img.femaleserfwalkl1,Img.femaleserfwalkl2];
var femaleserfwalkr = [Img.femaleserfwalkr1,Img.femaleserfwalkr2];

// attack
Img.femaleserfattackds = new Image();
Img.femaleserfattackds.src = '/client/img/chars/serf/female/attackds.png';
Img.femaleserfattackus = new Image();
Img.femaleserfattackus.src = '/client/img/chars/serf/female/attackus.png';
Img.femaleserfattackls = new Image();
Img.femaleserfattackls.src = '/client/img/chars/serf/female/attackls.png';
Img.femaleserfattackrs = new Image();
Img.femaleserfattackrs.src = '/client/img/chars/serf/female/attackrs.png';
Img.femaleserfattackdb = new Image();
Img.femaleserfattackdb.src = '/client/img/chars/serf/female/attackdb.png';
Img.femaleserfattackub = new Image();
Img.femaleserfattackub.src = '/client/img/chars/serf/female/attackub.png';
Img.femaleserfattacklb = new Image();
Img.femaleserfattacklb.src = '/client/img/chars/serf/female/attacklb.png';
Img.femaleserfattackrb = new Image();
Img.femaleserfattackrb.src = '/client/img/chars/serf/female/attackrb.png';

var femaleserf = {
  facedown: Img.femaleserfstandd,
  faceup: Img.femaleserfstandu,
  faceleft: Img.femaleserfstandl,
  faceright: Img.femaleserfstandr,
  walkdown: femaleserfwalkd,
  walkup: femaleserfwalku,
  walkleft: femaleserfwalkl,
  walkright: femaleserfwalkr,
  attackds: Img.femaleserfattackds,
  attackus: Img.femaleserfattackus,
  attackls: Img.femaleserfattackls,
  attackrs: Img.femaleserfattackrs,
  attackdb: Img.femaleserfattackdb,
  attackub: Img.femaleserfattackub,
  attacklb: Img.femaleserfattacklb,
  attackrb: Img.femaleserfattackrb
};

// male villager
// stand
Img.malevillagerstandd = new Image();
Img.malevillagerstandd.src = '/client/img/chars/villager/male/standd.png';
Img.malevillagerstandu = new Image();
Img.malevillagerstandu.src = '/client/img/chars/villager/male/standu.png';
Img.malevillagerstandl = new Image();
Img.malevillagerstandl.src = '/client/img/chars/villager/male/standl.png';
Img.malevillagerstandr = new Image();
Img.malevillagerstandr.src = '/client/img/chars/villager/male/standr.png';

// walk
Img.malevillagerwalkd1 = new Image();
Img.malevillagerwalkd1.src = '/client/img/chars/villager/male/walkd1.png';
Img.malevillagerwalkd2 = new Image();
Img.malevillagerwalkd2.src = '/client/img/chars/villager/male/walkd2.png';
Img.malevillagerwalku1 = new Image();
Img.malevillagerwalku1.src = '/client/img/chars/villager/male/walku1.png';
Img.malevillagerwalku2 = new Image();
Img.malevillagerwalku2.src = '/client/img/chars/villager/male/walku2.png';
Img.malevillagerwalkl1 = new Image();
Img.malevillagerwalkl1.src = '/client/img/chars/villager/male/walkl1.png';
Img.malevillagerwalkl2 = new Image();
Img.malevillagerwalkl2.src = '/client/img/chars/villager/male/walkl2.png';
Img.malevillagerwalkr1 = new Image();
Img.malevillagerwalkr1.src = '/client/img/chars/villager/male/walkr1.png';
Img.malevillagerwalkr2 = new Image();
Img.malevillagerwalkr2.src = '/client/img/chars/villager/male/walkr2.png';

var malevillagerwalkd = [Img.malevillagerwalkd1,Img.malevillagerwalkd2];
var malevillagerwalku = [Img.malevillagerwalku1,Img.malevillagerwalku2];
var malevillagerwalkl = [Img.malevillagerwalkl1,Img.malevillagerwalkl2];
var malevillagerwalkr = [Img.malevillagerwalkr1,Img.malevillagerwalkr2];

// attack
Img.malevillagerattackds = new Image();
Img.malevillagerattackds.src = '/client/img/chars/villager/male/attackds.png';
Img.malevillagerattackus = new Image();
Img.malevillagerattackus.src = '/client/img/chars/villager/male/attackus.png';
Img.malevillagerattackls = new Image();
Img.malevillagerattackls.src = '/client/img/chars/villager/male/attackls.png';
Img.malevillagerattackrs = new Image();
Img.malevillagerattackrs.src = '/client/img/chars/villager/male/attackrs.png';
Img.malevillagerattackdb = new Image();
Img.malevillagerattackdb.src = '/client/img/chars/villager/male/attackdb.png';
Img.malevillagerattackub = new Image();
Img.malevillagerattackub.src = '/client/img/chars/villager/male/attackub.png';
Img.malevillagerattacklb = new Image();
Img.malevillagerattacklb.src = '/client/img/chars/villager/male/attacklb.png';
Img.malevillagerattackrb = new Image();
Img.malevillagerattackrb.src = '/client/img/chars/villager/male/attackrb.png';

var malevillager = {
  facedown: Img.malevillagerstandd,
  faceup: Img.malevillagerstandu,
  faceleft: Img.malevillagerstandl,
  faceright: Img.malevillagerstandr,
  walkdown: malevillagerwalkd,
  walkup: malevillagerwalku,
  walkleft: malevillagerwalkl,
  walkright: malevillagerwalkr,
  attackds: Img.malevillagerattackds,
  attackus: Img.malevillagerattackus,
  attackls: Img.malevillagerattackls,
  attackrs: Img.malevillagerattackrs,
  attackdb: Img.malevillagerattackdb,
  attackub: Img.malevillagerattackub,
  attacklb: Img.malevillagerattacklb,
  attackrb: Img.malevillagerattackrb
}

// female villager
// stand
Img.femalevillagerstandd = new Image();
Img.femalevillagerstandd.src = '/client/img/chars/villager/female/standd.png';
Img.femalevillagerstandu = new Image();
Img.femalevillagerstandu.src = '/client/img/chars/villager/female/standu.png';
Img.femalevillagerstandl = new Image();
Img.femalevillagerstandl.src = '/client/img/chars/villager/female/standl.png';
Img.femalevillagerstandr = new Image();
Img.femalevillagerstandr.src = '/client/img/chars/villager/female/standr.png';

// walk
Img.femalevillagerwalkd1 = new Image();
Img.femalevillagerwalkd1.src = '/client/img/chars/villager/female/walkd1.png';
Img.femalevillagerwalkd2 = new Image();
Img.femalevillagerwalkd2.src = '/client/img/chars/villager/female/walkd2.png';
Img.femalevillagerwalku1 = new Image();
Img.femalevillagerwalku1.src = '/client/img/chars/villager/female/walku1.png';
Img.femalevillagerwalku2 = new Image();
Img.femalevillagerwalku2.src = '/client/img/chars/villager/female/walku2.png';
Img.femalevillagerwalkl1 = new Image();
Img.femalevillagerwalkl1.src = '/client/img/chars/villager/female/walkl1.png';
Img.femalevillagerwalkl2 = new Image();
Img.femalevillagerwalkl2.src = '/client/img/chars/villager/female/walkl2.png';
Img.femalevillagerwalkr1 = new Image();
Img.femalevillagerwalkr1.src = '/client/img/chars/villager/female/walkr1.png';
Img.femalevillagerwalkr2 = new Image();
Img.femalevillagerwalkr2.src = '/client/img/chars/villager/female/walkr2.png';

var femalevillagerwalkd = [Img.femalevillagerwalkd1,Img.femalevillagerwalkd2];
var femalevillagerwalku = [Img.femalevillagerwalku1,Img.femalevillagerwalku2];
var femalevillagerwalkl = [Img.femalevillagerwalkl1,Img.femalevillagerwalkl2];
var femalevillagerwalkr = [Img.femalevillagerwalkr1,Img.femalevillagerwalkr2];

// attack
Img.femalevillagerattackds = new Image();
Img.femalevillagerattackds.src = '/client/img/chars/villager/female/attackds.png';
Img.femalevillagerattackus = new Image();
Img.femalevillagerattackus.src = '/client/img/chars/villager/female/attackus.png';
Img.femalevillagerattackls = new Image();
Img.femalevillagerattackls.src = '/client/img/chars/villager/female/attackls.png';
Img.femalevillagerattackrs = new Image();
Img.femalevillagerattackrs.src = '/client/img/chars/villager/female/attackrs.png';
Img.femalevillagerattackdb = new Image();
Img.femalevillagerattackdb.src = '/client/img/chars/villager/female/attackdb.png';
Img.femalevillagerattackub = new Image();
Img.femalevillagerattackub.src = '/client/img/chars/villager/female/attackub.png';
Img.femalevillagerattacklb = new Image();
Img.femalevillagerattacklb.src = '/client/img/chars/villager/female/attacklb.png';
Img.femalevillagerattackrb = new Image();
Img.femalevillagerattackrb.src = '/client/img/chars/villager/female/attackrb.png';

var femalevillager = {
  facedown: Img.femalevillagerstandd,
  faceup: Img.femalevillagerstandu,
  faceleft: Img.femalevillagerstandl,
  faceright: Img.femalevillagerstandr,
  walkdown: femalevillagerwalkd,
  walkup: femalevillagerwalku,
  walkleft: femalevillagerwalkl,
  walkright: femalevillagerwalkr,
  attackds: Img.femalevillagerattackds,
  attackus: Img.femalevillagerattackus,
  attackls: Img.femalevillagerattackls,
  attackrs: Img.femalevillagerattackrs,
  attackdb: Img.femalevillagerattackdb,
  attackub: Img.femalevillagerattackub,
  attacklb: Img.femalevillagerattacklb,
  attackrb: Img.femalevillagerattackrb
}

// ITEMS
Img.torch1 = new Image();
Img.torch1.src = '/client/img/items/torch1.png';
Img.torch2 = new Image();
Img.torch2.src = '/client/img/items/torch2.png';
Img.torch3 = new Image();
Img.torch3.src = '/client/img/items/torch3.png';
var trc = 0; // torch
var torchFlame = [Img.torch1,Img.torch2,Img.torch3];
setInterval(function(){
  if(trc === 2){
    trc = 0;
  } else {
    trc++;
  }
},300);

// ARROWS
Img.arrow1 = new Image();
Img.arrow1.src = '/client/img/bullets/arrow1.png';
Img.arrow2 = new Image();
Img.arrow2.src = '/client/img/bullets/arrow2.png';
Img.arrow3 = new Image();
Img.arrow3.src = '/client/img/bullets/arrow3.png';
Img.arrow4 = new Image();
Img.arrow4.src = '/client/img/bullets/arrow4.png';
Img.arrow5 = new Image();
Img.arrow5.src = '/client/img/bullets/arrow5.png';
Img.arrow6 = new Image();
Img.arrow6.src = '/client/img/bullets/arrow6.png';
Img.arrow7 = new Image();
Img.arrow7.src = '/client/img/bullets/arrow7.png';
Img.arrow8 = new Image();
Img.arrow8.src = '/client/img/bullets/arrow8.png';

var ctx = document.getElementById('ctx').getContext('2d');
var lighting = document.getElementById('lighting').getContext('2d');
ctx.font = '30px Arial';

// PLAYER
var Player = function(initPack){
  var self = {};
  self.id = initPack.id;
  self.number = initPack.number;
  self.x = initPack.x;
  self.y = initPack.y;
  self.z = initPack.z;
  self.facing = 'down';
  self.angle = 0;
  self.pressingDown = false;
  self.pressingUp = false;
  self.pressingLeft = false;
  self.pressingRight = false;
  self.pressingAttack = false;
  self.inTrees = initPack.inTrees;
  self.hp = initPack.hp;
  self.hpMax = initPack.hpMax;
  self.mana = initPack.mana;
  self.manaMax = initPack.manaMax;
  self.sprite = maleserf;

  self.draw = function(){
    var x = (self.x - (tileSize/2)) - Player.list[selfId].x + WIDTH/2;
    var y = (self.y - (tileSize/2)) - Player.list[selfId].y + HEIGHT/2;

    // hp and mana bars
    var hpWidth = 60 * self.hp / self.hpMax;
    var manaWidth = 60 * self.mana / self.manaMax;

    ctx.fillStyle = 'red';
    ctx.fillRect(x,y - 50,60,8);
    ctx.fillStyle = 'green';
    ctx.fillRect(x,y - 50,hpWidth,8);
    ctx.fillStyle = 'red';
    ctx.fillRect(x,y - 40,60,5);
    ctx.fillStyle = 'blue';
    ctx.fillRect(x,y - 40,manaWidth,5);
    ctx.fillStyle = 'black';

    // character sprite
    if(self.angle > 45 && self.angle <= 115 && self.pressingAttack){
      ctx.drawImage(
        self.sprite.attackdb,
        x,
        y,
        tileSize,
        tileSize
      );
    } else if(self.angle > -135 && self.angle <= -15 && self.pressingAttack){
      ctx.drawImage(
        self.sprite.attackub,
        x,
        y,
        tileSize,
        tileSize
      );
    } else if((self.angle > 115 || self.angle <= -135) && self.pressingAttack){
      ctx.drawImage(
        self.sprite.attacklb,
        x,
        y,
        tileSize,
        tileSize
      );
    } else if((self.angle > -15 || self.angle <= 45) && self.pressingAttack){
      ctx.drawImage(
        self.sprite.attackrb,
        x,
        y,
        tileSize,
        tileSize
      );
    } else if(self.facing === 'down' && !self.pressingDown){
      ctx.drawImage(
        self.sprite.facedown,
        x,
        y,
        tileSize,
        tileSize
      );
    } else if(self.pressingDown){
      ctx.drawImage(
        self.sprite.walkdown[wlk],
        x,
        y,
        tileSize,
        tileSize
      );
    } else if(self.facing === 'up' && !self.pressingUp){
      ctx.drawImage(
        self.sprite.faceup,
        x,
        y,
        tileSize,
        tileSize
      );
    } else if(self.pressingUp){
      ctx.drawImage(
        self.sprite.walkup[wlk],
        x,
        y,
        tileSize,
        tileSize
      );
    } else if(self.facing === 'left' && !self.pressingLeft){
      ctx.drawImage(
        self.sprite.faceleft,
        x,
        y,
        tileSize,
        tileSize
      );
    } else if(self.pressingLeft){
      ctx.drawImage(
        self.sprite.walkleft[wlk],
        x,
        y,
        tileSize,
        tileSize
      );
    } else if(self.facing === 'right' && !self.pressingRight){
      ctx.drawImage(
        self.sprite.faceright,
        x,
        y,
        tileSize,
        tileSize
      );
    } else if(self.pressingRight){
      ctx.drawImage(
        self.sprite.walkright[wlk],
        x,
        y,
        tileSize,
        tileSize
      );
    }
  }

  Player.list[self.id] = self;
  return self;
}
Player.list = {};

// ARROWS
var Arrow = function(initPack){
  var self = {};
  self.id = initPack.id;
  self.angle = initPack.angle;
  self.number = initPack.number;
  self.x = initPack.x;
  self.y = initPack.y;
  self.z = initPack.z;

  self.draw = function(){
    function drawArrow(angle){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;

      if(angle >= -120 && angle < -60){
        ctx.drawImage(Img.arrow1, x, y, tileSize, tileSize);
      } else if(angle >= -60 && angle < -30){
        ctx.drawImage(Img.arrow2, x, y, tileSize, tileSize);
      } else if(angle >= -30 && angle < 30){
        ctx.drawImage(Img.arrow3, x, y, tileSize, tileSize);
      } else if(angle >= 30 && angle < 60){
        ctx.drawImage(Img.arrow4, x, y, tileSize, tileSize);
      } else if(angle >= 60 && angle < 120){
        ctx.drawImage(Img.arrow5, x, y, tileSize, tileSize);
      } else if(angle >= 120 && angle < 150){
        ctx.drawImage(Img.arrow6, x, y, tileSize, tileSize);
      } else if(angle >= 150 && angle > -150){
        ctx.drawImage(Img.arrow7, x, y, tileSize, tileSize);
      } else {
        ctx.drawImage(Img.arrow8, x, y, tileSize, tileSize);
      }
    }
    drawArrow(self.angle);
  }

  Arrow.list[self.id] = self;
  return self;
}
Arrow.list = {};

// ITEMS

var Item = function(initPack){
  var self = {};
  self.id = initPack.id;
  self.itemId = initPack.itemId;
  self.x = initPack.x;
  self.y = initPack.y;
  self.z = initPack.z;
  self.canPickup = initPack.canPickup;

  self.draw = function(){
    if(self.itemId === 0){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      torchFlame[trc],
      x,
      y,
      tileSize,
      tileSize
      );
    } // add more items here...
  }

  Item.list[self.id] = self;
  return self;
}
Item.list = {};

// LIGHTS
var Light = function(initPack){
  var self = {};
  self.id = initPack.id;
  self.x = initPack.x;
  self.y = initPack.y;
  self.z = initPack.z;
  self.radius = initPack.radius;

  Light.list[self.id] = self;
  return self;
}
Light.list = {};

// player's id
var selfId = null;

// init
socket.on('init',function(data){
  if(data.selfId)
    selfId = data.selfId;
  // { player : [{id:123,number:'1',x:0,y:0},{id:1,x:0,y:0}] arrow : []}
  for(var i = 0 ; i < data.player.length; i++){
    new Player(data.player[i]);
  }
  for(var i = 0 ; i < data.arrow.length; i++){
    new Arrow(data.arrow[i]);
  }
  for(var i = 0 ; i < data.item.length; i++){
    new Item(data.item[i]);
  }
  for(var i = 0 ; i < data.light.length; i++){
    new Light(data.light[i]);
  }
});

// update
socket.on('update',function(data){
  // { player : [{id:123,number:'1',x:0,y:0},{id:1,x:0,y:0}] arrow : []}
  for(var i = 0 ; i < data.player.length; i++){
    var pack = data.player[i];
    var p = Player.list[pack.id];
    if(p){
      if(pack.x !== undefined)
        p.x = pack.x;
      if(pack.y !== undefined)
        p.y = pack.y;
      if(pack.z !== undefined)
        p.z = pack.z;
      if(pack.facing !== undefined)
        p.facing = pack.facing;
      if(pack.hp !== undefined)
        p.hp = pack.hp;
      if(pack.hpMax !== undefined)
        p.hpMax = pack.hpMax;
      if(pack.mana !== undefined)
        p.mana = pack.mana;
      if(pack.manaMax !== undefined)
        p.manaMax = pack.manaMax;
    }
  }
  for(var i = 0 ; i < data.arrow.length; i++){
    var pack = data.arrow[i];
    var b = Arrow.list[data.arrow[i].id];
    if(b){
      if(pack.x !== undefined)
        b.x = pack.x;
      if(pack.y !== undefined)
        b.y = pack.y;
      if(pack.z !== undefined)
        b.z = pack.z;
    }
  }
  for(var i = 0 ; i < data.item.length; i++){
    var pack = data.item[i];
    var itm = Item.list[data.item[i].id];
    if(itm){
      if(pack.x !== undefined)
        itm.x = pack.x;
      if(pack.y !== undefined)
        itm.y = pack.y;
      if(pack.z !== undefined)
        itm.z = pack.z;
    }
  }
  for(var i = 0 ; i < data.light.length; i++){
    var pack = data.light[i];
    var l = Light.list[data.light[i].id];
    if(l){
      if(pack.x !== undefined)
        l.x = pack.x;
      if(pack.y !== undefined)
        l.y = pack.y;
      if(pack.z !== undefined)
        l.z = pack.z;
    }
  }
});

// remove
socket.on('remove',function(data){
  // {player:[12323],arrow:[12323,123123]}
  for(var i = 0 ; i < data.player.length; i++){
    delete Player.list[data.player[i]];
  }
  for(var i = 0 ; i < data.arrow.length; i++){
    delete Arrow.list[data.arrow[i]];
  }
  for(var i = 0 ; i < data.item.length; i++){
    delete Item.list[data.item[i]];
  }
  for(var i = 0 ; i < data.light.length; i++){
    delete Light.list[data.light[i]];
  }
});

// DRAW TO SCREEN

//cyclical animation timers
var wtr = 0; // water
var waterTiles = [Img.water1,Img.water2,Img.water3];
setInterval(function(){
  if(wtr === 2){
    wtr = 0;
  } else {
    wtr++;
  }
},1200);

var cld = 0; // clouds
var clouds = [Img.clouds1,Img.clouds2,Img.clouds3];
setInterval(function(){
  if(cld === 2){
    cld = 0;
  } else {
    cld++;
  }
},4000);

var inView = function(z,x,y){
  var top = (viewport.startTile[1] - 1) * tileSize;
  var left = (viewport.startTile[0] - 1) * tileSize;
  var right = (viewport.endTile[0] + 2) * tileSize;
  var bottom = (viewport.endTile[1] + 2) * tileSize;

  if(z === Player.list[selfId].z && x > left && x < right && y > top && y < bottom){
    return true;
  } else {
    return false;
  }
}

setInterval(function(){
  if(!selfId) // check that player is signed in
    return;
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  renderMap();
  renderLighting();
  for(var i in Player.list){
    if(inView(Player.list[i].z,Player.list[i].x,Player.list[i].y)){
      Player.list[i].draw();
    } else {
      continue;
    }
  }
  for(var i in Arrow.list){
    if(inView(Arrow.list[i].z,Arrow.list[i].x,Arrow.list[i].y)){
      Arrow.list[i].draw();
    } else {
      continue;
    }
  }
  for(var i in Item.list){
    if(inView(Item.list[i].z,Item.list[i].x,Item.list[i].y)){
      Item.list[i].draw();
    } else {
      continue;
    }
  }
  if(Player.list[selfId].z === 0){
    if(tempus === 'IX.p' || tempus === 'X.p' || tempus === 'XI.p' || tempus === 'XII.a' || tempus === 'I.a' || tempus === 'II.a' || tempus === 'III.a'){
      renderLightSources(1);
    } else if(tempus === 'VIII.p' || tempus === 'IV.a'){
      renderLightSources(0.8);
    } else if(tempus === 'VII.p' || tempus === 'V.a'){
      renderLightSources(0.55);
    } else {
      renderLightSources(0.3);
    }
  } else if(Player.list[selfId].z === -1){
    renderLightSources(2);
  }
  viewport.update(Player.list[selfId].x,Player.list[selfId].y);
  console.log(getLoc(Player.list[selfId].x,Player.list[selfId].y));
},40);

// RENDER MAP

// MAP TOOLS
var getTile = function(l,c,r){
  return world[l][r][c];
};

// get loc from (x,y)
var getLoc = function(x,y){
  var loc = [Math.floor(x/tileSize),Math.floor(y/tileSize)];
  return loc;
}

// get (x,y) coords of tile from loc
var getCoords = function(c,r){
  var coords = [c * tileSize, r * tileSize];
  return coords;
};

// update environment
tempus = null;

socket.on('tempus',function(data){
  tempus = data.tempus;
});

// viewport
var viewport = {
  screen: [WIDTH,HEIGHT],
  startTile: [0,0],
  endTile: [0,0],
  offset: [0,0],
  // takes player's loc as argument
  update: function(c,r){
    this.offset[0] = Math.floor((this.screen[0]/2) - c);
    this.offset[1] = Math.floor((this.screen[1]/2) - r);

    var tile = [Math.floor(c/tileSize),Math.floor(r/tileSize)];

    this.startTile[0] = tile[0] - 1 - Math.ceil((this.screen[0]/2) / tileSize);
    this.startTile[1] = tile[1] - 1 - Math.ceil((this.screen[1]/2) / tileSize);

    if(this.startTile[0] < 0){this.startTile[0] = 0;}
    if(this.startTile[1] < 0){this.startTile[1] = 0;}

    this.endTile[0] = tile[0] + 1 + Math.ceil((this.screen[0]/2) / tileSize);
    this.endTile[1] = tile[1] + 1 + Math.ceil((this.screen[1]/2) / tileSize);

    if(this.endTile[0] >= mapSize){this.endTile[0] = mapSize - 1;}
    if(this.endTile[1] >= mapSize){this.endTile[1] = mapSize - 1;}
  }
};

// renderer
var renderMap = function(){
  var z = Player.list[selfId].z;
  var x = 0;
  var y = 0;

  // overworld
  if(z === 0){
    var cloudscape = ctx.createPattern(clouds[cld], "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = cloudscape;
    ctx.fill();

    for (var c = viewport.startTile[0]; c < viewport.endTile[0]; c++) {
      for (var r = viewport.startTile[1]; r < viewport.endTile[1]; r++) {
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(0, c, r);
        if(tile === 0){
          ctx.drawImage(
          waterTiles[wtr], // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );
          y++;
        } else if(tile === 1){
          ctx.drawImage(
          Img.grassland, // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );
          ctx.drawImage(
          Img.hforest, // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );
          y++;
        } else if(tile === 2){
          ctx.drawImage(
          Img.grassland, // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );
          ctx.drawImage(
          Img.forest, // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );
          y++;
        } else if(tile === 3){
          ctx.drawImage(
          Img.grassland, // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );
          ctx.drawImage(
          Img.brush, // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );
          y++;
        } else if(tile === 4){
          ctx.drawImage(
          Img.grassland, // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );
          ctx.drawImage(
          Img.rocks, // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );
          y++;
        } else if(tile === 5){
          ctx.drawImage(
          Img.grassland, // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );
          ctx.drawImage(
          Img.mountain, // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );;
          y++;
        } else if(tile === 6){
          ctx.drawImage(
          Img.grassland, // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );
          ctx.drawImage(
          Img.cavein, // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );
          y++;
        }
      }
    }
    x++;
  } else if(z === -1){
    var morecave = ctx.createPattern(Img.cavefloor, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = morecave;
    ctx.fill();
    var evenmorecave = ctx.createPattern(Img.cavewall, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = evenmorecave;
    ctx.fill();
    for (var c = viewport.startTile[0]; c < viewport.endTile[0]; c++) {
      for (var r = viewport.startTile[1]; r < viewport.endTile[1]; r++) {
        var tile = getTile(1, c, r);
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        if(tile === 0){
          ctx.drawImage(
          Img.cavefloor, // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );
          y++;
        } else if(tile === 1){
          ctx.drawImage(
          Img.cavefloor, // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );
          ctx.drawImage(
          Img.cavewall, // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );
          y++;
        } else if(tile === 2){
          ctx.drawImage(
          Img.cavefloor, // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );
          ctx.drawImage(
          Img.caveout, // image
          xOffset, // target x
          yOffset, // target y
          tileSize, // target width
          tileSize // target height
          );
          y++;
        }
      }
    }
    x++;
  }
};

//lighting and light sources
// [z,x,y,radius]
var flickerRange = [0.4,0.65,0.7,0.75,0.75,0.8,0.8,0.85,0.9,0.95,1,1.5];
var flicker = 0;
setInterval(function(){
  flicker = flickerRange[Math.floor(Math.random() * flickerRange.length)];
}, 50);

var illuminate = function(x, y, radius){
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  var rnd = (0.05 * Math.sin(1.1 * Date.now() / 200) * flicker);
  radius = (radius * (1 + rnd));
  var radialGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  radialGradient.addColorStop(0.0, '#BB9');
  radialGradient.addColorStop(0.2 + rnd, '#AA8');
  radialGradient.addColorStop(0.7 + rnd, '#330');
  radialGradient.addColorStop(0.90, '#110');
  radialGradient.addColorStop(1, '#000');
  ctx.fillStyle = radialGradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
  //remove darkness layer
  lighting.save();
  lighting.globalCompositeOperation = 'destination-out';
  lighting.beginPath();
  lighting.arc(x, y, radius * 0.9, 0, 2 * Math.PI, false);
  lighting.fill();
  lighting.restore();
}

var renderLightSources = function(env){
  for(i in Light.list){
    var light = Light.list[i];
    var x = light.x - Player.list[selfId].x + WIDTH/2;
    var y = light.y - Player.list[selfId].y + HEIGHT/2;
    if(light.z === Player.list[selfId].z){
      illuminate(x,y,light.radius * env);
      illuminate(x,y,(light.radius/4) * env);
    }
  }
}

var renderLighting = function(){
  var z = Player.list[selfId].z;
  if(z === 0){
    if(tempus === 'IX.p' || tempus === 'X.p' || tempus === 'XI.p' || tempus === 'XII.a' || tempus === 'I.a' || tempus === 'II.a' || tempus === 'III.a'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(5, 5, 30, 0.85)"; // night
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus === 'IV.a'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(5, 5, 30, 0.8)"; // early hours
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus === 'V.a'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(5, 5, 30, 0.6)"; // early morning
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus === 'VI.a'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(244, 214, 65, 0.1)"; // sunrise
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus === 'VII.a' || tempus === 'VIII.a' || tempus === 'IX.a'|| tempus === 'X.a' || tempus === 'XI.a' || tempus === 'XII.p' || tempus === 'I.p' || tempus === 'II.p' || tempus === 'III.p'){
      lighting.clearRect(0,0,WIDTH,HEIGHT); // morning + daytime
    } else if(tempus === 'IV.p'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(255, 204, 22, 0.07)"; // afternoon
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus === 'V.p'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(255, 204, 22, 0.1)"; // late afternoon
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus === 'VI.p'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(232, 112, 0, 0.25)"; // sunset
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus === 'VII.p'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(5, 5, 30, 0.4)"; // twilight
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus === 'VIII.p'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(5, 5, 30, 0.7)"; // evening
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    }
  } else if(z === -1){
    lighting.clearRect(0,0,WIDTH,HEIGHT);
    lighting.fillStyle = "rgba(0, 0, 0, 0.9)"; // cave darkness
    lighting.fillRect(0,0,WIDTH,HEIGHT);
  }
}

// CONTROLS
document.onkeydown = function(event){
  if(event.keyCode === 68){ // d
    socket.emit('keyPress',{inputId:'right',state:true});
    Player.list[selfId].pressingRight = true;
  }
  else if(event.keyCode === 83){ // s
    socket.emit('keyPress',{inputId:'down',state:true});
    Player.list[selfId].pressingDown = true;
  }
  else if(event.keyCode === 65){ // a
    socket.emit('keyPress',{inputId:'left',state:true});
    Player.list[selfId].pressingLeft = true;
  }
  else if(event.keyCode === 87){ // w
    socket.emit('keyPress',{inputId:'up',state:true});
    Player.list[selfId].pressingUp = true;
  }
  else if(event.keyCode === 32){ // space
    socket.emit('keyPress',{inputId:'attack',state:true});
    Player.list[selfId].pressingAttack = true;
  }
  else if(event.keyCode === 49) // 1
    socket.emit('keyPress',{inputId:'1',state:true});
  else if(event.keyCode === 50) // 2
    socket.emit('keyPress',{inputId:'2',state:true});
  else if(event.keyCode === 51) // 3
    socket.emit('keyPress',{inputId:'3',state:true});
}

document.onkeyup = function(event){
  if(event.keyCode === 68){ // d
    socket.emit('keyPress',{inputId:'right',state:false});
    Player.list[selfId].pressingRight = false;
  }
  else if(event.keyCode === 83){ // s
    socket.emit('keyPress',{inputId:'down',state:false});
    Player.list[selfId].pressingDown = false;
  }
  else if(event.keyCode === 65){ // a
    socket.emit('keyPress',{inputId:'left',state:false});
    Player.list[selfId].pressingLeft = false;
  }
  else if(event.keyCode === 87){ // w
    socket.emit('keyPress',{inputId:'up',state:false});
    Player.list[selfId].pressingUp = false;
  }
  else if(event.keyCode === 32){ // space
    socket.emit('keyPress',{inputId:'attack',state:false});
    Player.list[selfId].pressingAttack = false;
  }
  else if(event.keyCode === 49) // 1
    socket.emit('keyPress',{inputId:'1',state:false});
  else if(event.keyCode === 50) // 2
    socket.emit('keyPress',{inputId:'2',state:false});
  else if(event.keyCode === 51) // 3
    socket.emit('keyPress',{inputId:'3',state:false});
}

document.onmousemove = function(event){
  if(selfId){
    var x = -250 + event.clientX - 8;
    var y = -250 + event.clientY - 8;
    var angle = Math.atan2(y,x) / Math.PI * 180;
    socket.emit('keyPress',{inputId:'mouseAngle',state:angle});
    Player.list[selfId].angle = angle;
  }
}

document.oncontextmenu = function(event){
  //event.preventDefault();
}
