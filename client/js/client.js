var WIDTH = 768;
var HEIGHT = 768;
var world = [];
var tileSize = 0;
var mapSize = 0;

var socket = io();

// SIGN IN
var signDiv = document.getElementById('signDiv');
var signDivUsername = document.getElementById('signDiv-username');
var signDivPassword = document.getElementById('signDiv-password');
var signDivSignIn = document.getElementById('signDiv-signIn');
var signDivSignUp = document.getElementById('signDiv-signUp');

signDivSignIn.onclick = function(){
  socket.emit('signIn',{name:signDivUsername.value,password:signDivPassword.value});
}

signDivSignUp.onclick = function(){
  socket.emit('signUp',{name:signDivUsername.value,password:signDivPassword.value});
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

socket.on('mapEdit',function(data){
  world = data;
});

chatForm.onsubmit = function(e){
  e.preventDefault();
  if(chatInput.value[0] === '/'){ // command
    socket.emit('evalCmd',{
      id:selfId,
      cmd:chatInput.value.slice(1)
    });
  } else if(chatInput.value[0] === '@'){ // private message
    socket.emit('sendPmToServer',{
      recip:chatInput.value.slice(1,chatInput.value.indexOf(' ')),
      message:chatInput.value.slice(chatInput.value.indexOf(' ') + 1)
    });
  } else { // chat
    socket.emit('sendMsgToServer',{
      name:Player.list[selfId].name,
      message:chatInput.value
    });
  }
  chatInput.value = '';
}

// GAME

var fly = 0
setInterval(function(){
  if(fly === 6){
    fly = 0;
  } else {
    fly += 1;
  }
},600);

// ICONS
// walking animation
var wlk = 0;
setInterval(function(){
  if(wlk === 1){
    wlk = 0;
  } else {
    wlk = 1;
  }
},400);

// working
var workingIcon = ['⌛️','⏳'];
var wrk = 0;
setInterval(function(){
  if(wrk === 1){
    wrk = 0;
  } else {
    wrk = 1;
  }
},800);

var ctx = document.getElementById('ctx').getContext('2d');
var lighting = document.getElementById('lighting').getContext('2d');
ctx.font = '30px Arial';

// BUILDINGS
buildingCount = 0;
buildingId = [];
buildingList = {}

// PLAYER
var Player = function(initPack){
  var self = {};
  self.type = initPack.type;
  self.name = initPack.name;
  self.id = initPack.id;
  self.x = initPack.x;
  self.y = initPack.y;
  self.z = initPack.z;
  self.class = initPack.class;
  self.rank = initPack.rank;
  self.gear = initPack.gear;
  self.inventory = initPack.inventory;
  self.facing = 'down';
  self.stealthed = initPack.stealthed;
  self.visible = initPack.visible;
  self.angle = 0;
  self.pressingDown = false;
  self.pressingUp = false;
  self.pressingLeft = false;
  self.pressingRight = false;
  self.pressingAttack = false;
  self.innaWoods = initPack.innaWoods;
  self.working = false;
  self.chopping = false;
  self.mining = false;
  self.farming = false;
  self.building = false;
  self.fishing = false;
  self.hp = initPack.hp;
  self.hpMax = initPack.hpMax;
  self.mana = initPack.mana;
  self.manaMax = initPack.manaMax;
  self.sprite = maleserf;
  self.spriteSize = initPack.spriteSize;

  self.draw = function(){

    var x = 0;
    var y = 0;

    if(self.spriteSize === tileSize * 1.5){
      x = (self.x - (tileSize*0.75)) - Player.list[selfId].x + WIDTH/2;
      y = (self.y - (tileSize*0.75)) - Player.list[selfId].y + HEIGHT/2;
    } else if(self.spriteSize === tileSize * 2){
      x = (self.x - tileSize) - Player.list[selfId].x + WIDTH/2;
      y = (self.y - tileSize) - Player.list[selfId].y + HEIGHT/2;
    } else if(self.spriteSize === tileSize * 3){
      x = (self.x - (tileSize*1.5)) - Player.list[selfId].x + WIDTH/2;
      y = (self.y - (tileSize*1.5)) - Player.list[selfId].y + HEIGHT/2;
    } else if(self.spriteSize === tileSize * 7){
      x = (self.x - (tileSize*3.5)) - Player.list[selfId].x + WIDTH/2;
      y = (self.y - (tileSize*3.5)) - Player.list[selfId].y + HEIGHT/2;
    } else if(self.spriteSize === tileSize * 10){
      x = (self.x - (tileSize*5)) - Player.list[selfId].x + WIDTH/2;
      y = (self.y - (tileSize*5)) - Player.list[selfId].y + HEIGHT/2;
    } else if(self.spriteSize === tileSize * 12){
      x = (self.x - (tileSize*6)) - Player.list[selfId].x + WIDTH/2;
      y = (self.y - (tileSize*6)) - Player.list[selfId].y + HEIGHT/2;
    } else {
      x = (self.x - (tileSize/2)) - Player.list[selfId].x + WIDTH/2;
      y = (self.y - (tileSize/2)) - Player.list[selfId].y + HEIGHT/2;
    }

    // hp and mana bars
    var barX = (self.x - (tileSize/2)) - Player.list[selfId].x + WIDTH/2;
    var barY = (self.y - (tileSize/2)) - Player.list[selfId].y + HEIGHT/2;

    var hpWidth = 60 * self.hp / self.hpMax;
    var manaWidth = null;
    var brWidth = 60 * self.breath / self.breathMax;
    if(self.mana){
      manaWidth = 60 * self.mana / self.manaMax;
    }

    if(self.hp){
      ctx.fillStyle = 'red';
      ctx.fillRect(barX,barY - 30,60,6);
      ctx.fillStyle = 'limegreen';
      ctx.fillRect(barX,barY - 30,hpWidth,6);
    }
    if(self.mana){
      ctx.fillStyle = 'red';
      ctx.fillRect(barX,barY - 20,60,4);
      ctx.fillStyle = 'royalblue';
      ctx.fillRect(barX,barY - 20,manaWidth,4);
    }
    if(self.z === -3){
      ctx.fillStyle = 'azure';
      ctx.fillRect(barX,barY - 30,brWidth,6);
    }

    // username
    if(self.rank){
      if(self.kingdom){
        ctx.fillStyle = 'white';
        ctx.font = '15px minion web';
        ctx.textAlign = 'center';
        ctx.fillText(Kingdom.list[self.kingdom].flag + ' ' + self.rank + self.name,barX + 30,barY - 40,100);
      } else if(self.house){
        ctx.fillStyle = 'white';
        ctx.font = '15px minion web';
        ctx.textAlign = 'center';
        ctx.fillText(House.list[self.house].flag + ' ' + self.rank + self.name,barX + 30,barY - 40,100);
      } else {
        ctx.fillStyle = 'white';
        ctx.font = '15px minion web';
        ctx.textAlign = 'center';
        ctx.fillText(self.rank + self.name,barX + 30,barY - 40,100);
      }
    } else if(self.name){
      if(self.kingdom){
        ctx.fillStyle = 'white';
        ctx.font = '15px minion web';
        ctx.textAlign = 'center';
        ctx.fillText(Kingdom.list[self.kingdom].flag + ' ' + self.name,barX + 30,barY - 40,100);
      } else if(self.house){
        ctx.fillStyle = 'white';
        ctx.font = '15px minion web';
        ctx.textAlign = 'center';
        ctx.fillText(House.list[self.house].flag + ' ' + self.name,barX + 30,barY - 40,100);
      } else {
        ctx.fillStyle = 'white';
        ctx.font = '15px minion web';
        ctx.textAlign = 'center';
        ctx.fillText(self.name,barX + 30,barY - 40,100);
      }
    }

    // status
    if(self.working){
      ctx.fillText(workingIcon[wrk], barX + 80, barY - 20);
    }

    // character sprite
    if(self.pressingAttack && self.type === 'player' && self.gear.weapon){
      if(self.gear.weapon.type === 'bow'){
        if(self.inventory.arrows > 0){
          if(self.angle > 45 && self.angle <= 115){
            ctx.drawImage(
              self.sprite.attackdb,
              x,
              y,
              self.spriteSize,
              self.spriteSize
            );
          } else if(self.angle > -135 && self.angle <= -15){
            ctx.drawImage(
              self.sprite.attackub,
              x,
              y,
              self.spriteSize,
              self.spriteSize
            );
          } else if(self.angle > 115 || self.angle <= -135){
            ctx.drawImage(
              self.sprite.attacklb,
              x,
              y,
              self.spriteSize,
              self.spriteSize
            );
          } else if(self.angle > -15 || self.angle <= 45){
            ctx.drawImage(
              self.sprite.attackrb,
              x,
              y,
              self.spriteSize,
              self.spriteSize
            );
          }
        }
      } else {
        if(self.facing === 'down'){
          ctx.drawImage(
            self.sprite.attackd,
            x,
            y,
            self.spriteSize,
            self.spriteSize
          );
        } else if(self.facing === 'up'){
          ctx.drawImage(
            self.sprite.attacku,
            x,
            y,
            self.spriteSize,
            self.spriteSize
          );
        } else if(self.facing === 'left'){
          ctx.drawImage(
            self.sprite.attackl,
            x,
            y,
            self.spriteSize,
            self.spriteSize
          );
        } else if(self.facing === 'right'){
          ctx.drawImage(
            self.sprite.attackr,
            x,
            y,
            self.spriteSize,
            self.spriteSize
          );
        }
      }
    } else if(self.chopping){
      ctx.drawImage(
        self.sprite.chopping[wrk],
        x,
        y,
        self.spriteSize,
        self.spriteSize
      );
    } else if(self.mining){
      ctx.drawImage(
        self.sprite.mining[wrk],
        x,
        y,
        self.spriteSize,
        self.spriteSize
      );
    } else if(self.farming){
      ctx.drawImage(
        self.sprite.farming[wrk],
        x,
        y,
        self.spriteSize,
        self.spriteSize
      );
    } else if(self.building){
      ctx.drawImage(
        self.sprite.building[wrk],
        x,
        y,
        self.spriteSize,
        self.spriteSize
      );
    } else if(self.fishing){
      if(self.facing === 'down'){
        ctx.drawImage(
          self.sprite.fishingd,
          x,
          y,
          self.spriteSize,
          self.spriteSize
        );
      } else if(self.facing === 'up'){
        ctx.drawImage(
          self.sprite.fishingu,
          x,
          y,
          self.spriteSize,
          self.spriteSize
        );
      } else if(self.facing === 'left'){
        ctx.drawImage(
          self.sprite.fishingl,
          x,
          y,
          self.spriteSize,
          self.spriteSize
        );
      } else if(self.facing === 'right'){
        ctx.drawImage(
          self.sprite.fishingr,
          x,
          y,
          self.spriteSize,
          self.spriteSize
        );
      }
    } else if(self.pressingAttack && self.type === 'npc'){
      if(self.facing === 'down'){
        ctx.drawImage(
          self.sprite.attackd,
          x,
          y,
          self.spriteSize,
          self.spriteSize
        );
      } else if(self.facing === 'up'){
        ctx.drawImage(
          self.sprite.attacku,
          x,
          y,
          self.spriteSize,
          self.spriteSize
        );
      } else if(self.facing === 'left'){
        ctx.drawImage(
          self.sprite.attackl,
          x,
          y,
          self.spriteSize,
          self.spriteSize
        );
      } else if(self.facing === 'right'){
        ctx.drawImage(
          self.sprite.attackr,
          x,
          y,
          self.spriteSize,
          self.spriteSize
        );
      }
    } else if(self.facing === 'down' && !self.pressingDown){
      ctx.drawImage(
        self.sprite.facedown,
        x,
        y,
        self.spriteSize,
        self.spriteSize
      );
    } else if(self.pressingDown){
      ctx.drawImage(
        self.sprite.walkdown[wlk],
        x,
        y,
        self.spriteSize,
        self.spriteSize
      );
    } else if(self.facing === 'up' && !self.pressingUp){
      ctx.drawImage(
        self.sprite.faceup,
        x,
        y,
        self.spriteSize,
        self.spriteSize
      );
    } else if(self.pressingUp){
      ctx.drawImage(
        self.sprite.walkup[wlk],
        x,
        y,
        self.spriteSize,
        self.spriteSize
      );
    } else if(self.facing === 'left' && !self.pressingLeft){
      ctx.drawImage(
        self.sprite.faceleft,
        x,
        y,
        self.spriteSize,
        self.spriteSize
      );
    } else if(self.pressingLeft){
      ctx.drawImage(
        self.sprite.walkleft[wlk],
        x,
        y,
        self.spriteSize,
        self.spriteSize
      );
    } else if(self.facing === 'right' && !self.pressingRight){
      ctx.drawImage(
        self.sprite.faceright,
        x,
        y,
        self.spriteSize,
        self.spriteSize
      );
    } else if(self.pressingRight){
      ctx.drawImage(
        self.sprite.walkright[wlk],
        x,
        y,
        self.spriteSize,
        self.spriteSize
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
  self.innaWoods = initPack.innaWoods;

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
  self.type = initPack.type;
  self.x = initPack.x;
  self.y = initPack.y;
  self.z = initPack.z;
  self.qty = initPack.qty;
  self.innaWoods = initPack.innaWoods;

  self.draw = function(){
    if(self.type === 'Wood'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 9){
        ctx.drawImage(
        Img.wood3,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 4){
        ctx.drawImage(
        Img.wood2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.wood1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'Stone'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 9){
        ctx.drawImage(
        Img.stone2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.stone1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'Grain'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 9){
        ctx.drawImage(
        Img.grain3,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 4){
        ctx.drawImage(
        Img.grain2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.grain1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'IronOre'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.ore1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'IronBar'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.ironbars,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.ironbar,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'SteelBar'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.steelbars,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.steelbar,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'BoarHide'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.boarhides,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.boarhide,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'Leather'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.leathers,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.leather,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'SilverOre'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.ore1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Silver'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 999){
        ctx.drawImage(
        Img.silver9,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 499){
        ctx.drawImage(
        Img.silver8,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 249){
        ctx.drawImage(
        Img.silver7,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 99){
        ctx.drawImage(
        Img.silver6,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 49){
        ctx.drawImage(
        Img.silver5,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 24){
        ctx.drawImage(
        Img.silver4,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 9){
        ctx.drawImage(
        Img.silver3,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 4){
        ctx.drawImage(
        Img.silver2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.silver1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'GoldOre'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.ore2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Gold'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 999){
        ctx.drawImage(
        Img.gold9,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 499){
        ctx.drawImage(
        Img.gold8,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 249){
        ctx.drawImage(
        Img.gold7,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 99){
        ctx.drawImage(
        Img.gold6,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 49){
        ctx.drawImage(
        Img.gold5,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 24){
        ctx.drawImage(
        Img.gold4,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 9){
        ctx.drawImage(
        Img.gold3,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 4){
        ctx.drawImage(
        Img.gold2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.gold1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'Diamond'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 2){
        ctx.drawImage(
        Img.diamonds,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.diamond,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'HuntingKnife'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.dagger1,
      x,
      y,
      tileSize,
      tileSize
      );
    }else if(self.type === 'Dague'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.dagger2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Rondel'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.dagger2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Misericorde'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.dagger3,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'BastardSword'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.sword1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Longsword'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.sword2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Zweihander'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.sword2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Morallta'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.sword3,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Bow'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.bow,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'WelshLongbow'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.longbow,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'KnightLance'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.lance1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'RusticLance'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.lance1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'PaladinLance'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.lance2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Brigandine'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.leathergarb,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Lamellar'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.leathergarb,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Maille'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.chainmail,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Hauberk'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.chainmail,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Brynja'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.chainmail,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Cuirass'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.plate1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'SteelPlate'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.plate1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'GreenwichPlate'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.plate2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'GothicPlate'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.plate3,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'ClericRobe'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.robe1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'MonkCowl'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.robe2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'BlackCloak'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.robe3,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Tome'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.tome,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'RunicScroll'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.scroll,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'SacredText'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.sacredtext,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Stoneaxe' || self.type === 'IronAxe'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.axe,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Pickaxe'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.pickaxe,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Key'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.key,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Torch'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.torch,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'LitTorch'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      torchFlame[flm],
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'WallTorch'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      wtorchFlame[flm],
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Campfire'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      fireFlame[flm],
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Firepit'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      firepitFlame[flm],
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Fireplace'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      fireplaceFlame[flm],
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Forge'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      forgeFlame[flm],
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type === 'Barrel'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.barrel,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Crates'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.crates,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Bookshelf'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.bookshelf,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type === 'SuitArmor'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.suitarmor,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type === 'Anvil'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.anvil,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Runestone'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.runestone,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Dummy'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.dummy,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Cross'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.cross,
      x,
      y,
      tileSize * 2,
      tileSize * 1.5
      );
    } else if(self.type === 'Skeleton1'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.skeleton1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Skeleton2'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.skeleton2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Goods1'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.goods1,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type === 'Goods2'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.goods2,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type === 'Goods3'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.goods3,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type === 'Goods4'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.goods4,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type === 'Stash1'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.stash1,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type === 'Stash2'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.stash2,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type === 'Desk'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.desk,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Swordrack'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.swordrack,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type === 'Bed'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.bed,
      x,
      y,
      tileSize * 2,
      tileSize * 2
      );
    } else if(self.type === 'Jail'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.jail,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'JailDoor'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.jaildoor,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Chains'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.chains,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Throne'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.throne,
      x + (tileSize/2),
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type === 'Banner'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.banner,
      x ,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'StagHead'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.staghead,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Blood'){ // MUST ONLY SEE WITH TRACKER SKILL !!!
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.blood,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Chest'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.chest,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'LockedChest'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.chest,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Bread'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.breads,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.bread,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'Fish'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.fishes,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.fish,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'Lamb'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.rawmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.rawmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'BoarMeat'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.rawmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.rawmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'Venison'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.rawmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.rawmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'PoachedFish'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.poachedfishes,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.poachedfish,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'LambChop'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.cookedmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.cookedmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'BoarShank'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.cookedmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.cookedmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'VenisonLoin'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.cookedmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.cookedmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'Mead' || self.type === 'Saison'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 2){
        ctx.drawImage(
        Img.beers,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.beer,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'FlandersRedAle' || self.type === 'BiereDeGarde'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 2){
        ctx.drawImage(
        Img.bottles1,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.bottle1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'Bordeaux' || self.type === 'Bourgogne' || self.type === 'Chianti'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      if(self.qty > 2){
        ctx.drawImage(
        Img.bottles2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.bottle2,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type === 'Crown'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.crown,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Arrows'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.arrows,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'WorldMap'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.map,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type === 'Relic'){
      var x = self.x - Player.list[selfId].x + WIDTH/2;
      var y = self.y - Player.list[selfId].y + HEIGHT/2;
      ctx.drawImage(
      Img.relic,
      x,
      y,
      tileSize,
      tileSize
      );
    }
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
Light.list = {
  antilag:{
    id:null,
    x:-100,
    y:-100,
    z:99,
    radius:0
  }
};

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
      if(pack.name !== undefined)
        p.name = pack.name;
      if(pack.x !== undefined)
        p.x = pack.x;
      if(pack.y !== undefined)
        p.y = pack.y;
      if(pack.z !== undefined)
        p.z = pack.z;
      if(pack.class !== undefined)
        p.class = pack.class;
      if(pack.rank !== undefined)
        p.rank = pack.rank;
      if(pack.gear !== undefined)
        p.gear = pack.gear;
      if(pack.inventory !== undefined)
        p.inventory = pack.inventory;
      if(pack.spriteSize !== undefined)
        p.spriteSize = pack.spriteSize;
      if(pack.facing !== undefined)
        p.facing = pack.facing;
      if(pack.stealthed !== undefined)
        p.stealthed = pack.stealthed;
      if(pack.visible !== undefined)
        p.visible = pack.visible;
      if(pack.pressingUp !== undefined)
        p.pressingUp = pack.pressingUp;
      if(pack.pressingDown !== undefined)
        p.pressingDown = pack.pressingDown;
      if(pack.pressingLeft !== undefined)
        p.pressingLeft = pack.pressingLeft;
      if(pack.pressingRight !== undefined)
        p.pressingRight = pack.pressingRight;
      if(pack.pressingAttack !== undefined)
        p.pressingAttack = pack.pressingAttack;
      if(pack.innaWoods !== undefined)
        p.innaWoods = pack.innaWoods;
      if(pack.angle !== undefined)
        p.angle = pack.angle;
      if(pack.working !== undefined)
        p.working = pack.working;
      if(pack.chopping !== undefined)
        p.chopping = pack.chopping;
      if(pack.mining !== undefined)
        p.mining = pack.mining;
      if(pack.farming !== undefined)
        p.farming = pack.farming;
      if(pack.building !== undefined)
        p.building = pack.building;
      if(pack.fishing !== undefined)
        p.fishing = pack.fishing;
      if(pack.hp !== undefined)
        p.hp = pack.hp;
      if(pack.hpMax !== undefined)
        p.hpMax = pack.hpMax;
      if(pack.mana !== undefined)
        p.mana = pack.mana;
      if(pack.manaMax !== undefined)
        p.manaMax = pack.manaMax;
      if(pack.breath !== undefined)
        p.breath = pack.breath;
      if(pack.breathMax !== undefined)
        p.breathMax = pack.breathMax;

      if(p.class === 'Sheep'){
        p.sprite = sheep;
      } else if(p.class === 'Deer'){
        p.sprite = deer;
      } else if(p.class === 'Boar'){
        p.sprite = boar;
      } else if(p.class === 'Wolf'){
        p.sprite = wolf;
      } else if(p.class === 'Falcon'){
        p.sprite = falcon;
      } else if(p.class === 'Serf' || p.class === 'SerfM'){
        p.sprite = maleserf;
      } else if(p.class === 'Rogue' || p.class === 'Trapper' || p.class === 'Cutthroat'){
        p.sprite = rogue;
      } else if(p.class === 'Hunter'){
        p.sprite = hunter;
      } else if(p.class === 'Scout'){
        p.sprite = scout;
      } else if(p.class === 'Ranger' || p.class === 'Warden'){
        p.sprite = ranger;
      } else if(p.class === 'Swordsman'){
        p.sprite = swordsman;
      } else if(p.class === 'Archer'){
        p.sprite = archer;
      } else if(p.class === 'Horseman'){
        p.sprite = horseman;
      } else if(p.class === 'MountedArcher'){
        p.sprite = mountedarcher;
      } else if(p.class === 'Hero'){
        p.sprite = hero;
      } else if(p.class === 'Templar' || p.class === 'Hospitaller' || p.class === 'Hochmeister'){
        p.sprite = templar;
      } else if(p.class === 'Cavalry'){
        p.sprite = cavalry;
      } else if(p.class === 'Knight'){
        p.sprite = knight;
      } else if(p.class === 'Lancer'){
        p.sprite = lancer;
      } else if(p.class === 'Crusader'){
        p.sprite = crusader;
      } else if(p.class === 'Priest' || p.class === 'Monk' || p.class === 'Prior'){
        p.sprite = monk;
      } else if(p.class === 'Mage' || p.class === 'Acolyte'){
        p.sprite = mage;
      } else if(p.class === 'Warlock' || p.class === 'Brother'){
        p.sprite = warlock;
      } else if(p.class === 'King' || p.class === 'Lothair'){
        p.sprite = king;
      } else if(p.class === 'SerfF'){
        p.sprite = femaleserf;
      } else if(p.class === 'Innkeeper' || p.class === 'Shipwright'){
        p.sprite = innkeeper;
      } else if(p.class === 'Bishop'){
        p.sprite = bishop;
      } else if(p.class === 'Friar'){
        p.sprite = friar;
      } else if(p.class === 'Footsoldier'){
        p.sprite = footsoldier;
      } else if(p.class === 'Skirmisher'){
        p.sprite = skirmisher;
      } else if(p.class === 'Cavalier'){
        p.sprite = cavalier;
      } else if(p.class === 'General'){
        p.sprite = general;
      } else if(p.class === 'ImperialKnight' || p.class == 'TeutonicKnight'){
        p.sprite = teutonicknight;
      } else if(p.class === 'Trebuchet'){
        p.sprite = trebuchet;
      } else if(p.class === 'Oathkeeper' || p.class === 'Inquisitor'){
        p.sprite = inquisitor;
      } else if(p.class === 'DarkEntity'){
        p.sprite = darkentity;
      } else if(p.class === 'Goth' || p.class === 'NorseSword'){
        p.sprite = goth;
      } else if(p.class === 'HighPriestess'){
        p.sprite = highpriestess;
      } else if(p.class === 'Cataphract' || p.class === 'Carolingian' || p.class === 'Marauder'){
        p.sprite = marauder;
      } else if(p.class === 'NorseSpear'){
        p.sprite = norsespear;
      } else if(p.class === 'Huskarl'){
        p.sprite = huskarl;
      } else if(p.class === 'FrankSword'){
        p.sprite = franksword;
      } else if(p.class === 'FrankSpear'){
        p.sprite = frankspear;
      } else if(p.class === 'FrankBow' || p.class === 'Outlaw'){
        p.sprite = frankbow;
      } else if(p.class === 'Mangonel'){
        p.sprite = mangonel;
      } else if(p.class === 'Malvoisin'){
        p.sprite = malvoisin;
      } else if(p.class === 'CeltAxe'){
        p.sprite = celtaxe;
      } else if(p.class === 'CeltSpear'){
        p.sprite = celtspear;
      } else if(p.class === 'Headhunter'){
        p.sprite = headhunter;
      } else if(p.class === 'Druid'){
        p.sprite = druid;
      } else if(p.class === 'Morrigan'){
        p.sprite = morrigan;
      } else if(p.class === 'Gwenllian'){
        p.sprite = gwenllian;
      } else if(p.class === 'TeutonPike'){
        p.sprite = teutonpike;
      } else if(p.class === 'TeutonBow'){
        p.sprite = teutonbow;
      } else if(p.class === 'TeutonicKnight'){
        p.sprite = teutonicknight;
      } else if(p.class === 'Poacher'){
        p.sprite = poacher;
      } else if(p.class === 'Strongman'){
        p.sprite = strongman;
      } else if(p.class === 'Condottiere'){
        p.sprite = condottiere;
      }
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

var inView = function(z,x,y,innaWoods){
  var top = (viewport.startTile[1] - 1) * tileSize;
  var left = (viewport.startTile[0] - 1) * tileSize;
  var right = (viewport.endTile[0] + 2) * tileSize;
  var bottom = (viewport.endTile[1] + 2) * tileSize;

  if(z === Player.list[selfId].z && x > left && x < right && y > top && y < bottom){
    if(z === 0 && innaWoods && !Player.list[selfId].innaWoods){
      return false;
    } else {
      return true;
    }
  } else {
    return false;
  }
}

var hasFire = function(z,x,y){
  for(i in Light.list){
    var light = Light.list[i];
    if(light.z === z && (getBuilding(light.x,light.y) === getBuilding(x,y) || getBuilding(light.x,light.y+tileSize) === getBuilding(x,y)) && light.radius > 1){
      return true;
    } else {
      continue;
    }
  }
  return false;
}

setInterval(function(){
  if(!selfId) // check that player is signed in
    return;
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  renderMap();
  for(var i in Item.list){
    if(inView(Item.list[i].z,Item.list[i].x,Item.list[i].y,Item.list[i].innaWoods)){
      if((Player.list[selfId].z === 1 || Player.list[selfId].z === 2) && (getBuilding(Item.list[i].x,Item.list[i].y) === getBuilding(Player.list[selfId].x,Player.list[selfId].y) || getBuilding(Item.list[i].x,Item.list[i].y+(tileSize * 1.1)) === getBuilding(Player.list[selfId].x,Player.list[selfId].y))){
        Item.list[i].draw();
      } else if(Player.list[selfId].z !== 1 && Player.list[selfId].z !== 2){
        Item.list[i].draw();
      } else {
        continue;
      }
    } else {
      continue;
    }
  }
  for(var i in Player.list){
    if(Player.list[i].class !== 'Falcon'){
      if(inView(Player.list[i].z,Player.list[i].x,Player.list[i].y,Player.list[i].innaWoods)){
        if((Player.list[selfId].z === 1 || Player.list[selfId].z === 2) && (getBuilding(Player.list[i].x,Player.list[i].y) === getBuilding(Player.list[selfId].x,Player.list[selfId].y))){
          Player.list[i].draw();
        } else if(Player.list[selfId].z !== 1 && Player.list[selfId].z !== 2){
          Player.list[i].draw();
        } else {
          continue;
        }
      } else {
        continue;
      }
    }
  }
  for(var i in Arrow.list){
    if(inView(Arrow.list[i].z,Arrow.list[i].x,Arrow.list[i].y,Arrow.list[i].innaWoods)){
      if((Player.list[selfId].z === 1 || Player.list[selfId].z === 2) && (getBuilding(Item.list[i].x,Item.list[i].y) === getBuilding(Arrow.list[selfId].x,Arrow.list[selfId].y))){
        Arrow.list[i].draw();
      } else if(Player.list[selfId].z !== 1 && Player.list[selfId].z !== 2){
        Arrow.list[i].draw();
      } else {
        continue;
      }
    } else {
      continue;
    }
  }
  if(Player.list[selfId].innaWoods){
    renderForest();
  }
  renderTops();
  for(var i in Player.list){
    if(Player.list[i].class === 'Falcon'){
      if(inView(Player.list[i].z,Player.list[i].x,Player.list[i].y,false)){
        Player.list[i].draw();
      }
    }
  }
  renderLighting();
  if(Player.list[selfId].z === 0){
    if(tempus === 'VIII.p' || tempus === 'IX.p' || tempus === 'X.p' || tempus === 'XI.p' || tempus === 'XII.a' || tempus === 'I.a' || tempus === 'II.a' || tempus === 'III.a' || tempus === 'IV.a'){
      renderLightSources(2);
    } else {
      renderLightSources(1);
    }
  } else if(Player.list[selfId].z === 1 || Player.list[selfId].z === 2){
    renderLightSources(1);
  } else if(Player.list[selfId].z === -1 || Player.list[selfId].z === -2){
    renderLightSources(3);
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

// get building id from (x,y)
getBuilding = function(x,y){
  var loc = getLoc(x,y);
  for(i = 0; i < buildingCount; i++){
    var b = buildingList[buildingId[i]];
    for(n = 0; n < b.plot.length; n++){
      if(b.plot[n][0] === loc[0] && b.plot[n][1] === loc[1]){
        return b.id;
      } else {
        continue;
      }
    }
  }
}

// update environment
tempus = null;

houseList = null;
kingdomList = null;

socket.on('tempus',function(data){
  tempus = data.tempus;
});

socket.on('newBuilding',function(data){
  buildingCount = data.bCount;
  buildingId = data.bId;
  buildingList = data.bList;
});

socket.on('newFaction',function(data){
  houseList = data.houseList;
  kingdomList = data.kingdomlist;
})

// update sprite
socket.on('sprite',function(data){
  if(data === 'serf'){
    Player.list[selfId].sprite = maleserf;
  } else if(data === 'Rogue'){
    Player.list[selfId].sprite = rogue;
  } else if(data === 'Hunter'){
    Player.list[selfId].sprite = hunter;
  } else if(data === 'Scout'){
    Player.list[selfId].sprite = scout;
  } else if(data === 'Ranger'){
    Player.list[selfId].sprite = ranger;
  } else if(data === 'Swordsman'){
    Player.list[selfId].sprite = swordsman;
  } else if(data === 'Archer'){
    Player.list[selfId].sprite = archer;
  } else if(data === 'Scout'){
    Player.list[selfId].sprite = scout;
  } else if(data === 'Horseman'){
    Player.list[selfId].sprite = horseman;
  } else if(data === 'MountedArcher'){
    Player.list[selfId].sprite = mountedarcher;
  } else if(data === 'Hero'){
    Player.list[selfId].sprite = hero;
  } else if(data === 'Templar'){
    Player.list[selfId].sprite = templar;
  } else if(data === 'Cavalry'){
    Player.list[selfId].sprite = cavalry;
  } else if(data === 'Knight'){
    Player.list[selfId].sprite = knight;
  } else if(data === 'Lancer'){
    Player.list[selfId].sprite = lancer;
  } else if(data === 'Crusader'){
    Player.list[selfId].sprite = crusader;
  } else if(data === 'Priest'){
    Player.list[selfId].sprite = monk;
  } else if(data === 'Mage'){
    Player.list[selfId].sprite = mage;
  } else if(data === 'Warlock'){
    Player.list[selfId].sprite = warlock;
  }
});

// viewport
var viewport = {
  screen: [WIDTH,HEIGHT],
  startTile: [0,0],
  endTile: [0,0],
  offset: [0,0],
  update: function(c,r){
    this.offset[0] = Math.floor((this.screen[0]/2) - c);
    this.offset[1] = Math.floor((this.screen[1]/2) - r);

    var tile = [Math.floor(c/tileSize),Math.floor(r/tileSize)];

    this.startTile[0] = tile[0] - 1 - Math.ceil((this.screen[0]/2) / tileSize);
    this.startTile[1] = tile[1] - 1 - Math.ceil((this.screen[1]/2) / tileSize);

    if(this.startTile[0] < 0){
      this.startTile[0] = 0;
    }
    if(this.startTile[1] < 0){
      this.startTile[1] = 0;
    }

    this.endTile[0] = tile[0] + 1 + Math.ceil((this.screen[0]/2) / tileSize);
    this.endTile[1] = tile[1] + 1 + Math.ceil((this.screen[1]/2) / tileSize);

    if(this.endTile[0] >= mapSize){
      this.endTile[0] = mapSize;
    }
    if(this.endTile[1] >= mapSize){
      this.endTile[1] = mapSize;
    }
  }
};

// renderer
var renderMap = function(){
  var z = Player.list[selfId].z;

  // overworld
  if(z === 0){
    var cloudscape = ctx.createPattern(clouds[cld], "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = cloudscape;
    ctx.fill();

    for(var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for(var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
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
        } else if(tile >= 1 && tile < 2){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          if(!Player.list[selfId].innaWoods){
            if(tile >= 1 && tile < 1.3){
              ctx.drawImage(
                Img.hforest, // image
                xOffset - (tileSize/4), // target x
                yOffset - (tileSize/1.75), // target y
                tileSize, // target width
                tileSize * 1.5 // target height
              );
            } else if(tile >= 1 && tile < 1.6){
              ctx.drawImage(
                Img.hforest, // image
                xOffset, // target x
                yOffset - (tileSize/1.25), // target y
                tileSize, // target width
                tileSize * 1.5 // target height
              );
            } else {
              ctx.drawImage(
                Img.hforest, // image
                xOffset, // target x
                yOffset - (tileSize/2), // target y
                tileSize, // target width
                tileSize * 1.5 // target height
              );
            }
          }
        } else if(tile >= 2 && tile < 2.3){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.forest, // image
            xOffset - (tileSize/4), // target x
            yOffset - (tileSize/3), // target y
            tileSize, // target width
            tileSize * 1.25 // target height
          );
        } else if(tile >= 2 && tile < 2.6){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.forest, // image
            xOffset - (tileSize/3), // target x
            yOffset - (tileSize/4), // target y
            tileSize, // target width
            tileSize * 1.25 // target height
          );
        } else if(tile >= 2 && tile < 3){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.forest, // image
            xOffset, // target x
            yOffset - (tileSize/4), // target y
            tileSize, // target width
            tileSize * 1.25 // target height
          );
        } else if(tile >= 3 && tile < 3.3){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.brush, // image
            xOffset - (tileSize/4), // target x
            yOffset - (tileSize/3), // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 3 && tile < 3.6){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.brush, // image
            xOffset - (tileSize/3), // target x
            yOffset - (tileSize/4), // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 3 && tile < 4){
          ctx.drawImage(
            Img.grass, // image
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
        } else if(tile >= 4 && tile < 4.3){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.rocks, // image
            xOffset - (tileSize/4), // target x
            yOffset - (tileSize/3), // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 4 && tile < 4.6){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.rocks, // image
            xOffset - (tileSize/3), // target x
            yOffset - (tileSize/4), // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 4 && tile < 5){
          ctx.drawImage(
            Img.grass, // image
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
        } else if(tile >= 5 && tile < 5.3){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.mountain, // image
            xOffset - (tileSize/4), // target x
            yOffset - (tileSize/3), // target y
            tileSize, // target width
            tileSize // target height
          );;
        } else if(tile >= 5 && tile < 5.6){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.mountain, // image
            xOffset - (tileSize/3), // target x
            yOffset - (tileSize/4), // target y
            tileSize, // target width
            tileSize // target height
          );;
        } else if(tile >= 5 && tile < 6){
          ctx.drawImage(
            Img.grass, // image
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
        } else if(tile === 6){
          ctx.drawImage(
            Img.grass, // image
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
        } else if(tile === 7){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 8){
          ctx.drawImage(
            Img.farm1, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 9){
          ctx.drawImage(
            Img.farm2, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 10){
          ctx.drawImage(
            Img.farm3, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 11){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.build1, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 11.5){
          ctx.drawImage(
            waterTiles[wtr], // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.build1w, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 12){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.build2, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 12.5){
          ctx.drawImage(
            waterTiles[wtr], // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.build2, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if (tile === 18){
          ctx.drawImage(
            Img.road, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 13 || tile === 14 || tile === 15 || tile === 16 || tile === 17 || tile === 19 || tile === 20){
          var bTile = getTile(3,c,r);
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          if(bTile === 'hut0'){
            ctx.drawImage(
              Img.hut0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'hut1'){
            ctx.drawImage(
              Img.hut1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'hut2'){
            ctx.drawImage(
              Img.hut2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'hut3'){
            ctx.drawImage(
              Img.hut3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'mill0'){
            ctx.drawImage(
              Img.mill0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'mill1'){
            ctx.drawImage(
              Img.mill1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'mill2'){
            ctx.drawImage(
              Img.mill2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'mill3'){
            ctx.drawImage(
              Img.mill3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'house0'){
            ctx.drawImage(
              Img.house0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'house1'){
            ctx.drawImage(
              Img.house1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'house2'){
            ctx.drawImage(
              Img.house2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }  else if(bTile === 'house3'){
            ctx.drawImage(
              Img.house3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'house4'){
            ctx.drawImage(
              Img.house4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'house5'){
            ctx.drawImage(
              Img.house5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'house6'){
            ctx.drawImage(
              Img.house6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'house7'){
            ctx.drawImage(
              Img.house7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'house8'){
            ctx.drawImage(
              Img.house8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'fort'){
            var l = getTile(3,c-1,r);
            var rr = getTile(3,c+1,r);
            var u = getTile(3,c,r-1);
            var d = getTile(3,c,r+1);
            ctx.drawImage(
              Img.grass, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
            if((l !== 'fort' && rr !== 'fort' && u !== 'fort' && d !== 'fort') ||
            (l === 'fort' && rr === 'fort' && u === 'fort' && d === 'fort') ||
            (l === 'fort' && rr !== 'fort' && u !== 'fort' && d !== 'fort') ||
            (l !== 'fort' && rr === 'fort' && u !== 'fort' && d !== 'fort') ||
            (l !== 'fort' && rr !== 'fort' && u === 'fort' && d !== 'fort') ||
            (l !== 'fort' && rr !== 'fort' && u !== 'fort' && d === 'fort') ||
            (l !== 'fort' && rr === 'fort' && u !== 'fort' && d === 'fort') ||
            (l === 'fort' && rr !== 'fort' && u !== 'fort' && d === 'fort') ||
            (l === 'fort' && rr !== 'fort' && u === 'fort' && d !== 'fort') ||
            (l !== 'fort' && rr === 'fort' && u === 'fort' && d !== 'fort') ||
            (l !== 'fort' && rr === 'fort' && u === 'fort' && d === 'fort') ||
            (l === 'fort' && rr === 'fort' && u !== 'fort' && d === 'fort') ||
            (l === 'fort' && rr !== 'fort' && u === 'fort' && d === 'fort') ||
            (l === 'fort' && rr === 'fort' && u === 'fort' && d !== 'fort')){
              ctx.drawImage(
                Img.fortc, // image
                xOffset, // target x
                yOffset - (tileSize/2), // target y
                tileSize, // target width
                tileSize * 1.5 // target height
              );
            } else if(l === 'fort' && rr === 'fort' && u !== 'fort' && d !== 'fort'){
              ctx.drawImage(
                Img.fortlr, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else if(l !== 'fort' && rr !== 'fort' && u === 'fort' && d === 'fort'){
              ctx.drawImage(
                Img.fortud, // image
                xOffset, // target x
                yOffset - (tileSize/2), // target y
                tileSize, // target width
                tileSize * 2 // target height
              );
            }
          } else if(bTile === 'wall'){
            var l = getTile(3,c-1,r);
            var rr = getTile(3,c+1,r);
            var u = getTile(3,c,r-1);
            var d = getTile(3,c,r+1);
            ctx.drawImage(
              Img.grass, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
            if((l !== 'wall' && rr !== 'wall' && u !== 'wall' && d !== 'wall') ||
            (l === 'wall' && rr === 'wall' && u === 'wall' && d === 'wall') ||
            (l === 'wall' && rr !== 'wall' && u !== 'wall' && d !== 'wall') ||
            (l !== 'wall' && rr === 'wall' && u !== 'wall' && d !== 'wall') ||
            (l !== 'wall' && rr !== 'wall' && u === 'wall' && d !== 'wall') ||
            (l !== 'wall' && rr !== 'wall' && u !== 'wall' && d === 'wall') ||
            (l !== 'wall' && rr === 'wall' && u !== 'wall' && d === 'wall') ||
            (l === 'wall' && rr !== 'wall' && u !== 'wall' && d === 'wall') ||
            (l === 'wall' && rr !== 'wall' && u === 'wall' && d !== 'wall') ||
            (l !== 'wall' && rr === 'wall' && u === 'wall' && d !== 'wall') ||
            (l !== 'wall' && rr === 'wall' && u === 'wall' && d === 'wall') ||
            (l === 'wall' && rr === 'wall' && u !== 'wall' && d === 'wall') ||
            (l === 'wall' && rr !== 'wall' && u === 'wall' && d === 'wall') ||
            (l === 'wall' && rr === 'wall' && u === 'wall' && d !== 'wall')){
              ctx.drawImage(
                Img.wallc, // image
                xOffset, // target x
                yOffset - (tileSize/2), // target y
                tileSize, // target width
                tileSize * 1.5 // target height
              );
            } else if(l === 'wall' && rr === 'wall' && u !== 'wall' && d !== 'wall'){
              ctx.drawImage(
                Img.walllr, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else if(l !== 'wall' && rr !== 'wall' && u === 'wall' && d === 'wall'){
              ctx.drawImage(
                Img.wallud, // image
                xOffset, // target x
                yOffset - (tileSize/2), // target y
                tileSize, // target width
                tileSize * 2 // target height
              );
            }
          } else if(bTile === 'outpost0'){
            ctx.drawImage(
              Img.outpost0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'gtower0'){
            ctx.drawImage(
              Img.gtower0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'gtower1'){
            ctx.drawImage(
              Img.gtower1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'gtower2'){
            ctx.drawImage(
              Img.gtower2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'gtower3'){
            ctx.drawImage(
              Img.gtower3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tower0'){
            ctx.drawImage(
              Img.tower0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tower1'){
            ctx.drawImage(
              Img.tower1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tower2'){
            ctx.drawImage(
              Img.tower2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tower3'){
            ctx.drawImage(
              Img.tower3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tower4'){
            ctx.drawImage(
              Img.tower4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tower5'){
            ctx.drawImage(
              Img.tower5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tower6'){
            ctx.drawImage(
              Img.tower6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tower7'){
            ctx.drawImage(
              Img.tower7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tower8'){
            ctx.drawImage(
              Img.tower8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tavern0'){
            ctx.drawImage(
              Img.tavern0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tavern1'){
            ctx.drawImage(
              Img.tavern1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tavern2'){
            ctx.drawImage(
              Img.tavern2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tavern3'){
            ctx.drawImage(
              Img.tavern3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tavern4'){
            ctx.drawImage(
              Img.tavern4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tavern5'){
            ctx.drawImage(
              Img.tavern5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tavern6'){
            ctx.drawImage(
              Img.tavern6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tavern7'){
            ctx.drawImage(
              Img.tavern7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tavern8'){
            ctx.drawImage(
              Img.tavern8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tavern9'){
            ctx.drawImage(
              Img.tavern9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tavern10'){
            ctx.drawImage(
              Img.tavern10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tavern11'){
            ctx.drawImage(
              Img.tavern11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tavern12'){
            ctx.drawImage(
              Img.tavern12, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tavern13'){
            ctx.drawImage(
              Img.tavern13, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tavern14'){
            ctx.drawImage(
              Img.tavern14, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tavern15'){
            ctx.drawImage(
              Img.tavern15, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'tavern16'){
            ctx.drawImage(
              Img.tavern16, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'monastery0'){
            ctx.drawImage(
              Img.monastery0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'monastery1'){
            ctx.drawImage(
              Img.monastery1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'monastery2'){
            ctx.drawImage(
              Img.monastery2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'monastery3'){
            ctx.drawImage(
              Img.monastery3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'monastery4'){
            ctx.drawImage(
              Img.monastery4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'monastery5'){
            ctx.drawImage(
              Img.monastery5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'monastery6'){
            ctx.drawImage(
              Img.monastery6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'monastery7'){
            ctx.drawImage(
              Img.monastery7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'monastery8'){
            ctx.drawImage(
              Img.monastery8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'monastery9'){
            ctx.drawImage(
              Img.monastery9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'monastery10'){
            ctx.drawImage(
              Img.monastery10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'monastery11'){
            ctx.drawImage(
              Img.monastery11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'monastery12'){
            ctx.drawImage(
              Img.monastery12, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'monastery13'){
            ctx.drawImage(
              Img.monastery13, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'market0'){
            ctx.drawImage(
              Img.market0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'market1'){
            ctx.drawImage(
              Img.market1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'market2'){
            ctx.drawImage(
              Img.market2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'market3'){
            ctx.drawImage(
              Img.market3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'market4'){
            ctx.drawImage(
              Img.market4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'market5'){
            ctx.drawImage(
              Img.market5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'market6'){
            ctx.drawImage(
              Img.market6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'market7'){
            ctx.drawImage(
              Img.market7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'market8'){
            ctx.drawImage(
              Img.market8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'market9'){
            ctx.drawImage(
              Img.market9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'market10'){
            ctx.drawImage(
              Img.market10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'market11'){
            ctx.drawImage(
              Img.market11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stable0'){
            ctx.drawImage(
              Img.stable0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stable1'){
            ctx.drawImage(
              Img.stable1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stable2'){
            ctx.drawImage(
              Img.stable2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stable3'){
            ctx.drawImage(
              Img.stable3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stable4'){
            ctx.drawImage(
              Img.stable4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stable5'){
            ctx.drawImage(
              Img.stable5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stable6'){
            ctx.drawImage(
              Img.stable6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stable7'){
            ctx.drawImage(
              Img.stable7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stable8'){
            ctx.drawImage(
              Img.stable8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stable9'){
            ctx.drawImage(
              Img.stable9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stable10'){
            ctx.drawImage(
              Img.stable10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stable11'){
            ctx.drawImage(
              Img.stable11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'dock0'){
            ctx.drawImage(
              waterTiles[wtr], // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
            ctx.drawImage(
              Img.dock0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'dock1'){
            ctx.drawImage(
              waterTiles[wtr], // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
            ctx.drawImage(
              Img.dock1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'dock2'){
            ctx.drawImage(
              waterTiles[wtr], // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
            ctx.drawImage(
              Img.dock2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'dock3'){
            ctx.drawImage(
              waterTiles[wtr], // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
            ctx.drawImage(
              Img.dock3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'dock4'){
            ctx.drawImage(
              waterTiles[wtr], // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
            ctx.drawImage(
              Img.dock4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'dock5'){
            ctx.drawImage(
              waterTiles[wtr], // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
            ctx.drawImage(
              Img.dock5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'garrison0'){
            ctx.drawImage(
              Img.garrison0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'garrison1'){
            ctx.drawImage(
              Img.garrison1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'garrison2'){
            ctx.drawImage(
              Img.garrison2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'garrison3'){
            ctx.drawImage(
              Img.garrison3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'garrison4'){
            ctx.drawImage(
              Img.garrison4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'garrison5'){
            ctx.drawImage(
              Img.garrison5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'garrison6'){
            ctx.drawImage(
              Img.garrison6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'garrison7'){
            ctx.drawImage(
              Img.garrison7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'garrison8'){
            ctx.drawImage(
              Img.garrison8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'garrison9'){
            ctx.drawImage(
              Img.garrison9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'garrison10'){
            ctx.drawImage(
              Img.garrison10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'garrison11'){
            ctx.drawImage(
              Img.garrison11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'bsmith0'){
            ctx.drawImage(
              Img.bsmith0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'bsmith1'){
            ctx.drawImage(
              Img.bsmith1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'bsmith2'){
            ctx.drawImage(
              Img.bsmith2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'bsmith3'){
            ctx.drawImage(
              Img.bsmith3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'bsmith4'){
            ctx.drawImage(
              Img.bsmith4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'bsmith5'){
            ctx.drawImage(
              Img.bsmith5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold0'){
            ctx.drawImage(
              Img.stronghold0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold1'){
            ctx.drawImage(
              Img.stronghold1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold2'){
            ctx.drawImage(
              Img.stronghold2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold3'){
            ctx.drawImage(
              Img.stronghold3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold4'){
            ctx.drawImage(
              Img.stronghold4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold5'){
            ctx.drawImage(
              Img.stronghold5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold6'){
            ctx.drawImage(
              Img.stronghold6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold7'){
            ctx.drawImage(
              Img.stronghold7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold8'){
            ctx.drawImage(
              Img.stronghold8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold9'){
            ctx.drawImage(
              Img.stronghold9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold10'){
            ctx.drawImage(
              Img.stronghold10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold11'){
            ctx.drawImage(
              Img.stronghold11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold12'){
            ctx.drawImage(
              Img.stronghold12, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold13'){
            ctx.drawImage(
              Img.stronghold13, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold14'){
            ctx.drawImage(
              Img.stronghold14, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold15'){
            ctx.drawImage(
              Img.stronghold15, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold16'){
            ctx.drawImage(
              Img.stronghold16, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold17'){
            ctx.drawImage(
              Img.stronghold17, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold18'){
            ctx.drawImage(
              Img.stronghold18, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold19'){
            ctx.drawImage(
              Img.stronghold19, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold20'){
            ctx.drawImage(
              Img.stronghold20, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold21'){
            ctx.drawImage(
              Img.stronghold21, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold22'){
            ctx.drawImage(
              Img.stronghold22, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold23'){
            ctx.drawImage(
              Img.stronghold23, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold24'){
            ctx.drawImage(
              Img.stronghold24, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold25'){
            ctx.drawImage(
              Img.stronghold25, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold26'){
            ctx.drawImage(
              Img.stronghold26, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold27'){
            ctx.drawImage(
              Img.stronghold27, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold28'){
            ctx.drawImage(
              Img.stronghold28, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold29'){
            ctx.drawImage(
              Img.stronghold29, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold30'){
            ctx.drawImage(
              Img.stronghold30, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold31'){
            ctx.drawImage(
              Img.stronghold31, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold32'){
            ctx.drawImage(
              Img.stronghold32, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold33'){
            ctx.drawImage(
              Img.stronghold33, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold34'){
            ctx.drawImage(
              Img.stronghold34, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold35'){
            ctx.drawImage(
              Img.stronghold35, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold36'){
            ctx.drawImage(
              Img.stronghold36, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold37'){
            ctx.drawImage(
              Img.stronghold37, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold38'){
            ctx.drawImage(
              Img.stronghold38, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold39'){
            ctx.drawImage(
              Img.stronghold39, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold40'){
            ctx.drawImage(
              Img.stronghold40, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold41'){
            ctx.drawImage(
              Img.stronghold41, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold42'){
            ctx.drawImage(
              Img.stronghold42, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold43'){
            ctx.drawImage(
              Img.stronghold43, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold44'){
            ctx.drawImage(
              Img.stronghold44, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold45'){
            ctx.drawImage(
              Img.stronghold45, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold46'){
            ctx.drawImage(
              Img.stronghold46, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold47'){
            ctx.drawImage(
              Img.stronghold47, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold48'){
            ctx.drawImage(
              Img.stronghold48, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold49'){
            ctx.drawImage(
              Img.stronghold49, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold50'){
            ctx.drawImage(
              Img.stronghold50, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold51'){
            ctx.drawImage(
              Img.stronghold51, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold52'){
            ctx.drawImage(
              Img.stronghold52, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold53'){
            ctx.drawImage(
              Img.stronghold53, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold54'){
            ctx.drawImage(
              Img.stronghold54, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold55'){
            ctx.drawImage(
              Img.stronghold55, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold56'){
            ctx.drawImage(
              Img.stronghold56, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile === 'stronghold57'){
            ctx.drawImage(
              Img.stronghold57, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
        }
      }
    }
  } else if(z === -1){
    var morecave = ctx.createPattern(Img.cavefloor, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = morecave;
    ctx.fill();
    var evenmorecave = ctx.createPattern(Img.cavewall, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = evenmorecave;
    ctx.fill();
    for(var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for(var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
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
        } else if(tile >= 3 && tile < 3.3){
          ctx.drawImage(
            Img.cavefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.rocks, // image
            xOffset - (tileSize/4), // target x
            yOffset - (tileSize/3), // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 3 && tile < 3.6){
          ctx.drawImage(
            Img.cavefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.rocks, // image
            xOffset - (tileSize/3), // target x
            yOffset - (tileSize/4), // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 3 && tile < 4){
          ctx.drawImage(
            Img.cavefloor, // image
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
        }
      }
    }
  } else if(z === -2){
    var dark = ctx.createPattern(Img.void, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = dark;
    ctx.fill();
    for(var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for(var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(8, c, r);
        var below = getTile(8,c,r+1);
        if(tile === 1){
          ctx.drawImage(
            Img.stonefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 0 && below === 1){
          ctx.drawImage(
            Img.stonewall, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 5){
          ctx.drawImage(
            Img.sstairsu, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else {
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
        }
      }
    }
  } else if(z === -3){
    var dark = ctx.createPattern(Img.void, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = dark;
    ctx.fill();
    for(var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for(var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(0, c, r);
        if(tile === 11.5 || tile === 12.5 || tile === 20){
          ctx.drawImage(
            Img.woodfloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 0){
          ctx.drawImage(
            Img.sand, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else {
          ctx.drawImage(
            Img.cavewall, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        }
      }
    }
  } else if(z === 1){
    var pBuilding = getBuilding(Player.list[selfId].x,Player.list[selfId].y);
    var dark = ctx.createPattern(Img.void, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = dark;
    ctx.fill();
    for(var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for(var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(0, c, r);
        var wtile = getTile(4, c, r);
        var bCoords = getCoords(c,r);
        var bbCoords = getCoords(c,r+1);
        var building = getBuilding(bCoords[0],bCoords[1]);
        var bbuilding = getBuilding(bbCoords[0],bbCoords[1]);
        if(pBuilding === building || pBuilding === bbuilding){
          if(wtile === 1){
            ctx.drawImage(
              Img.woodwall, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile === 2){
            ctx.drawImage(
              Img.stonewall, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile === 3){
            ctx.drawImage(
              Img.wstairsu, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile === 4){
            ctx.drawImage(
              Img.sstairsu, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile === 5){
            ctx.drawImage(
              Img.wstairsd, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile === 6){
            ctx.drawImage(
              Img.sstairsd, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile === 7){
            ctx.drawImage(
              Img.lstairsu, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile === 13){
            ctx.drawImage(
              Img.woodfloor, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile === 14){
            ctx.drawImage(
              Img.woodexit, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile === 15){
            ctx.drawImage(
              Img.stonefloor, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile === 16){
            ctx.drawImage(
              Img.stoneexit, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile === 17){
            ctx.drawImage(
              Img.carpet, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile === 19){
            ctx.drawImage(
              Img.stoneexit, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
        }
      }
    }
  } else if(z === 2){
    var pBuilding = getBuilding(Player.list[selfId].x,Player.list[selfId].y);
    var dark = ctx.createPattern(Img.void, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = dark;
    ctx.fill();
    for (var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for (var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(5, c, r);
        var wtile = getTile(4, c, r);
        var below = getTile(5, c, r+1);
        var bCoords = getCoords(c,r);
        var bbCoords = getCoords(c,r+1);
        var building = getBuilding(bCoords[0],bCoords[1]);
        var bbuilding = getBuilding(bbCoords[0],bbCoords[1]);
        if(pBuilding === building || pBuilding === bbuilding){
          if(wtile === 1){
            if(below !== 0){
              ctx.drawImage(
                Img.woodwall, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile === 2){
            if(below !== 0){
              ctx.drawImage(
                Img.stonewall, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile === 3){
            if(below !== 0){
              ctx.drawImage(
                Img.wstairsd, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile === 4){
            if(below !== 0){
              ctx.drawImage(
                Img.sstairsd, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile === 5){
            if(below !== 0){
              ctx.drawImage(
                Img.woodwall, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile === 6){
            if(below !== 0){
              ctx.drawImage(
                Img.stonewall, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile === 7){
            if(below !== 0){
              ctx.drawImage(
                Img.sstairsd, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(tile === 13){
            ctx.drawImage(
              Img.woodfloor, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile === 17){
            ctx.drawImage(
              Img.carpet, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile === 15){
            ctx.drawImage(
              Img.stonefloor, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
        }
      }
    }
  }
};

var renderTops = function(){
  if(Player.list[selfId].z === 0){
    for (var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for (var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(5, c, r);
        if(tile === 'mill4'){
          ctx.drawImage(
            Img.mill4, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'mill5'){
          ctx.drawImage(
            Img.mill5, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'outpost1'){
          ctx.drawImage(
            Img.outpost1, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'gtower4'){
          ctx.drawImage(
            Img.gtower4, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'gtower5'){
          ctx.drawImage(
            Img.gtower5, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        }else if(tile === 'tower9'){
          ctx.drawImage(
            Img.tower9, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'tower10'){
          ctx.drawImage(
            Img.tower10, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'tower11'){
          ctx.drawImage(
            Img.tower11, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'tower12'){
          ctx.drawImage(
            Img.tower12, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'tower13'){
          ctx.drawImage(
            Img.tower13, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'tower14'){
          ctx.drawImage(
            Img.tower14, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'tavern17'){
          ctx.drawImage(
            Img.tavern17, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'tavern18'){
          ctx.drawImage(
            Img.tavern18, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'tavern19'){
          ctx.drawImage(
            Img.tavern19, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'monastery14'){
          ctx.drawImage(
            Img.monastery14, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'monastery15'){
          ctx.drawImage(
            Img.monastery15, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'monastery16'){
          ctx.drawImage(
            Img.monastery16, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'market12'){
          ctx.drawImage(
            Img.market12, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'market13'){
          ctx.drawImage(
            Img.market13, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'market14'){
          ctx.drawImage(
            Img.market14, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'market15'){
          ctx.drawImage(
            Img.market15, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'market16'){
          ctx.drawImage(
            Img.market16, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'stable12'){
          ctx.drawImage(
            Img.stable12, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'stable13'){
          ctx.drawImage(
            Img.stable13, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'stable14'){
          ctx.drawImage(
            Img.stable14, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'dock6'){
          ctx.drawImage(
            Img.dock6, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'dock7'){
          ctx.drawImage(
            Img.dock7, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'dock8'){
          ctx.drawImage(
            Img.dock8, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'garrison12'){
          ctx.drawImage(
            Img.garrison12, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'garrison13'){
          ctx.drawImage(
            Img.garrison13, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'garrison14'){
          ctx.drawImage(
            Img.garrison14, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'bsmith6'){
          ctx.drawImage(
            Img.bsmith6, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'bsmith7'){
          ctx.drawImage(
            Img.bsmith7, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'gateo'){
          if(getTile(3,c-1,r) === 'wall'){
            ctx.drawImage(
              Img.gateo0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else {
            ctx.drawImage(
              Img.gateo1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
        } else if(tile === 'gatec'){
          if(getTile(3,c-1,r) === 'wall'){
            ctx.drawImage(
              Img.gatec0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else {
            ctx.drawImage(
              Img.gatec1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
        } else if(tile === 'stronghold58'){
          ctx.drawImage(
            Img.stronghold58, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'stronghold59'){
          ctx.drawImage(
            Img.stronghold59, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'stronghold60'){
          ctx.drawImage(
            Img.stronghold60, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'stronghold61'){
          ctx.drawImage(
            Img.stronghold61, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'stronghold62'){
          ctx.drawImage(
            Img.stronghold62, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'stronghold63'){
          ctx.drawImage(
            Img.stronghold63, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'stronghold64'){
          ctx.drawImage(
            Img.stronghold64, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'stronghold65'){
          ctx.drawImage(
            Img.stronghold65, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 'stronghold66'){
          ctx.drawImage(
            Img.stronghold66, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        }
      }
    }
  }
};

var renderForest = function(){
  var pLoc = getLoc(Player.list[selfId].x,Player.list[selfId].y);
  var pc = pLoc[0];
  var pr = pLoc[1];

  if(Player.list[selfId].z === 0){
    for (var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for (var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var dist =  function(){
          if((c === pc-1 && r === pr-1) ||
          (c === pc && r === pr-1) ||
          (c === pc+1 && r === pr-1) ||
          (c === pc-1 && r === pr) ||
          (c === pc && r === pr) ||
          (c === pc+1 && r === pr) ||
          (c === pc-1 && r === pr+1) ||
          (c === pc && r === pr+1) ||
          (c === pc+1 && r === pr+1)){
            return 40;
          } else if((c === pc-1 && r === pr-2) ||
          (c === pc && r === pr-2) ||
          (c === pc+1 && r === pr-2) ||
          (c === pc-2 && r === pr-1) ||
          (c === pc-2 && r === pr) ||
          (c === pc-2 && r === pr+1) ||
          (c === pc-1 && r === pr+2) ||
          (c === pc && r === pr+2) ||
          (c === pc+1 && r === pr+2) ||
          (c === pc+2 && r === pr-1) ||
          (c === pc+2 && r === pr) ||
          (c === pc+2 && r === pr+1)){
            return 60;
          } else if((c === pc-2 && r === pr-3) ||
          (c === pc-1 && r === pr-3) ||
          (c === pc && r === pr-3) ||
          (c === pc+1 && r === pr-3) ||
          (c === pc+2 && r === pr-3) ||
          (c === pc+2 && r === pr-2) ||
          (c === pc+3 && r === pr-2) ||
          (c === pc+3 && r === pr-1) ||
          (c === pc+3 && r === pr) ||
          (c === pc+3 && r === pr+1) ||
          (c === pc+3 && r === pr+2) ||
          (c === pc+2 && r === pr+2) ||
          (c === pc+2 && r === pr+3) ||
          (c === pc+1 && r === pr+3) ||
          (c === pc && r === pr+3) ||
          (c === pc-1 && r === pr+3) ||
          (c === pc-2 && r === pr+3) ||
          (c === pc-2 && r === pr+2) ||
          (c === pc-3 && r === pr+2) ||
          (c === pc-3 && r === pr+1) ||
          (c === pc-3 && r === pr) ||
          (c === pc-3 && r === pr-1) ||
          (c === pc-3 && r === pr-2) ||
          (c === pc-2 && r === pr-2)){
            return 80;
          } else {
            return;
          }
        }
        var tile = getTile(0, c, r);
        if(tile >= 1 && tile < 1.3){
          if(dist() === 40){
            ctx.drawImage(
              Img.hforest40, // image
              xOffset - (tileSize/4), // target x
              yOffset - (tileSize/1.75), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else if(dist() === 60){
            ctx.drawImage(
              Img.hforest60, // image
              xOffset - (tileSize/4), // target x
              yOffset - (tileSize/1.75), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else if(dist() === 80){
            ctx.drawImage(
              Img.hforest80, // image
              xOffset - (tileSize/4), // target x
              yOffset - (tileSize/1.75), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else {
            ctx.drawImage(
              Img.hforest, // image
              xOffset - (tileSize/4), // target x
              yOffset - (tileSize/1.75), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          }
        } else if(tile >= 1 && tile < 1.6){
          if(dist() === 40){
            ctx.drawImage(
              Img.hforest40, // image
              xOffset, // target x
              yOffset - (tileSize/1.25), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else if(dist() === 60){
            ctx.drawImage(
              Img.hforest60, // image
              xOffset, // target x
              yOffset - (tileSize/1.25), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else if(dist() === 80){
            ctx.drawImage(
              Img.hforest80, // image
              xOffset, // target x
              yOffset - (tileSize/1.25), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else {
            ctx.drawImage(
              Img.hforest, // image
              xOffset, // target x
              yOffset - (tileSize/1.25), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          }
        } else if(tile >= 1 && tile < 2){
          if(dist() === 40){
            ctx.drawImage(
              Img.hforest40, // image
              xOffset, // target x
              yOffset - (tileSize/2), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else if(dist() === 60){
            ctx.drawImage(
              Img.hforest60, // image
              xOffset, // target x
              yOffset - (tileSize/2), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else if(dist() === 80){
            ctx.drawImage(
              Img.hforest80, // image
              xOffset, // target x
              yOffset - (tileSize/2), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else {
            ctx.drawImage(
              Img.hforest, // image
              xOffset, // target x
              yOffset - (tileSize/2), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          }
        }
      }
    }
  }
};

//lighting and light sources
// [z,x,y,radius]
var flickerRange = [0.4,0.65,0.7,0.75,0.75,0.8,0.8,0.85,0.9,0.95,1,1.5];
var flicker = 0;
setInterval(function(){
  flicker = flickerRange[Math.floor(Math.random() * flickerRange.length)];
}, 50);

var illuminate = function(x, y, radius, env){
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
}

var renderLightSources = function(env){
  for(i in Light.list){
    var light = Light.list[i];
    var player = Player.list[selfId];
    var rnd = (0.05 * Math.sin(1.1 * Date.now() / 200) * flicker);
    var x = light.x - player.x + WIDTH/2;
    var y = light.y - player.y + HEIGHT/2;
    if(light.z === player.z || light.z ===  99){
      illuminate(x,y,(45 * light.radius),env);
      illuminate(x,y,7,env);
      //remove darkness layer
      if((light.z === 0 || light.z === -1 || light.z === -2 || light.z === 99) || ((light.z === 1 || light.z === 2) && !hasFire(player.z,player.x,player.y))){
        lighting.save();
        lighting.globalCompositeOperation = 'destination-out';
        lighting.beginPath();
        lighting.arc(x, y, ((45 * light.radius) * (1 + rnd)) * env, 0, 2 * Math.PI, false);
        lighting.fill();
        lighting.restore();
      }
    }
  }
}

var renderLighting = function(){
  var z = Player.list[selfId].z;
  if(z === 0){
    if(tempus === 'IX.p' || tempus === 'X.p' || tempus === 'XI.p' || tempus === 'XII.a' || tempus === 'I.a' || tempus === 'II.a' || tempus === 'III.a'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(5, 5, 30, 0.9)"; // night
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
  } else if(z === 1 || z === 2){
    var player = Player.list[selfId];
    if(tempus === 'IX.p' || tempus === 'X.p' || tempus === 'XI.p' || tempus === 'XII.a' || tempus === 'I.a' || tempus === 'II.a' || tempus === 'III.a'){
      if(hasFire(player.z,player.x,player.y)){
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(224, 104, 0, 0.4)"; // fire
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      } else {
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(5, 5, 30, 0.9)"; // night
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      }
    } else if(tempus === 'IV.a'){
      if(hasFire(player.z,player.x,player.y)){
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(224, 104, 0, 0.4)"; // fire
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      } else {
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(5, 5, 30, 0.8)"; // early hours
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      }
    } else if(tempus === 'V.a'){
      if(hasFire(player.z,player.x,player.y)){
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(224, 104, 0, 0.4)"; // fire
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      } else {
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(5, 5, 30, 0.6)"; // early morning
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      }
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
      if(hasFire(player.z,player.x,player.y)){
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(224, 104, 0, 0.4)"; // fire
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      } else {
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(5, 5, 30, 0.4)"; // twilight
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      }
    } else if(tempus === 'VIII.p'){
      if(hasFire(player.z,player.x,player.y)){
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(224, 104, 0, 0.4)"; // fire
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      } else {
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(5, 5, 30, 0.7)"; // evening
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      }
    }
  } else if(z === -1){
    ctx.fillStyle = "rgba(224, 104, 0, 0.3)"; // light layer
    ctx.fillRect(0,0,WIDTH,HEIGHT);
    lighting.clearRect(0,0,WIDTH,HEIGHT);
    lighting.fillStyle = "rgba(0, 0, 0, 0.95)"; // darkness
    lighting.fillRect(0,0,WIDTH,HEIGHT);
  } else if(z === -2){
    ctx.fillStyle = "rgba(224, 104, 0, 0.3)"; // light layer
    ctx.fillRect(0,0,WIDTH,HEIGHT);
    lighting.clearRect(0,0,WIDTH,HEIGHT);
    lighting.fillStyle = "rgba(0, 0, 0, 0.85)"; // darkness
    lighting.fillRect(0,0,WIDTH,HEIGHT);
  } else if(z === -3){
    lighting.clearRect(0,0,WIDTH,HEIGHT);
    lighting.fillStyle = "rgba(0, 48, 99, 0.9)"; // underwater
    lighting.fillRect(0,0,WIDTH,HEIGHT);
  }
}

// CONTROLS
document.onkeydown = function(event){
  var chatFocus = (document.activeElement === chatInput);
  if(!chatFocus){
    if(event.keyCode === 68){ // d
      socket.emit('keyPress',{inputId:'right',state:true});
      Player.list[selfId].pressingRight = true;
    } else if(event.keyCode === 83){ // s
      socket.emit('keyPress',{inputId:'down',state:true});
      Player.list[selfId].pressingDown = true;
    } else if(event.keyCode === 65){ // a
      socket.emit('keyPress',{inputId:'left',state:true});
      Player.list[selfId].pressingLeft = true;
    } else if(event.keyCode === 87){ // w
      socket.emit('keyPress',{inputId:'up',state:true});
      Player.list[selfId].pressingUp = true;
    } else if(event.keyCode === 32){ // space
      socket.emit('keyPress',{inputId:'attack',state:true});
      Player.list[selfId].pressingAttack = true;
    } else if(event.keyCode === 69){ // e
       socket.emit('keyPress',{inputId:'e',state:true});
    } else if(event.keyCode === 84){ // t
      socket.emit('keyPress',{inputId:'t',state:true});
    } else if(event.keyCode === 73){ // i
      socket.emit('keyPress',{inputId:'i',state:true});
    } else if(event.keyCode === 80){ // p
      socket.emit('keyPress',{inputId:'p',state:true});
    } else if(event.keyCode === 70){ // f
      socket.emit('keyPress',{inputId:'f',state:true});
    } else if(event.keyCode === 72){ // h
      socket.emit('keyPress',{inputId:'h',state:true});
    } else if(event.keyCode === 75){ // k
      socket.emit('keyPress',{inputId:'k',state:true});
    } else if(event.keyCode === 76){ // l
      socket.emit('keyPress',{inputId:'l',state:true});
    } else if(event.keyCode === 88){ // x
      socket.emit('keyPress',{inputId:'x',state:true});
    } else if(event.keyCode === 67){ // c
      socket.emit('keyPress',{inputId:'c',state:true});
    } else if(event.keyCode === 66){ // b
      socket.emit('keyPress',{inputId:'b',state:true});
    } else if(event.keyCode === 78){ // n
      socket.emit('keyPress',{inputId:'n',state:true});
    } else if(event.keyCode === 77){ // m
      socket.emit('keyPress',{inputId:'m',state:true});
    } else if(event.keyCode === 49){ // 1
      socket.emit('keyPress',{inputId:'1',state:true});
    } else if(event.keyCode === 50){ // 2
      socket.emit('keyPress',{inputId:'2',state:true});
    } else if(event.keyCode === 51){ // 3
      socket.emit('keyPress',{inputId:'3',state:true});
    } else if(event.keyCode === 52){ // 4
      socket.emit('keyPress',{inputId:'4',state:true});
    } else if(event.keyCode === 53){ // 5
      socket.emit('keyPress',{inputId:'5',state:true});
    } else if(event.keyCode === 54){ // 6
      socket.emit('keyPress',{inputId:'6',state:true});
    } else if(event.keyCode === 55){ // 7
      socket.emit('keyPress',{inputId:'7',state:true});
    } else if(event.keyCode === 56){ // 8
      socket.emit('keyPress',{inputId:'8',state:true});
    } else if(event.keyCode === 57){ // 9
      socket.emit('keyPress',{inputId:'9',state:true});
    } else if(event.keyCode === 48){ // 0
      socket.emit('keyPress',{inputId:'0',state:true});
    }
  }
}

document.onkeyup = function(event){
  if(event.keyCode === 68){ // d
    socket.emit('keyPress',{inputId:'right',state:false});
    Player.list[selfId].pressingRight = false;
  } else if(event.keyCode === 83){ // s
    socket.emit('keyPress',{inputId:'down',state:false});
    Player.list[selfId].pressingDown = false;
  } else if(event.keyCode === 65){ // a
    socket.emit('keyPress',{inputId:'left',state:false});
    Player.list[selfId].pressingLeft = false;
  } else if(event.keyCode === 87){ // w
    socket.emit('keyPress',{inputId:'up',state:false});
    Player.list[selfId].pressingUp = false;
  } else if(event.keyCode === 32){ // space
    socket.emit('keyPress',{inputId:'attack',state:false});
    Player.list[selfId].pressingAttack = false;
  } else if(event.keyCode === 69){ // e
    socket.emit('keyPress',{inputId:'e',state:false});
  } else if(event.keyCode === 84){ // t
    socket.emit('keyPress',{inputId:'t',state:false});
  } else if(event.keyCode === 73){ // i
    socket.emit('keyPress',{inputId:'i',state:false});
  } else if(event.keyCode === 80){ // p
    socket.emit('keyPress',{inputId:'p',state:false});
  } else if(event.keyCode === 70){ // f
    socket.emit('keyPress',{inputId:'f',state:false});
  } else if(event.keyCode === 72){ // h
    socket.emit('keyPress',{inputId:'h',state:false});
  } else if(event.keyCode === 75){ // k
    socket.emit('keyPress',{inputId:'k',state:false});
  } else if(event.keyCode === 76){ // l
    socket.emit('keyPress',{inputId:'l',state:false});
  } else if(event.keyCode === 88){ // x
    socket.emit('keyPress',{inputId:'x',state:false});
  } else if(event.keyCode === 67){ // c
    socket.emit('keyPress',{inputId:'c',state:false});
  } else if(event.keyCode === 66){ // b
    socket.emit('keyPress',{inputId:'b',state:false});
  } else if(event.keyCode === 78){ // n
    socket.emit('keyPress',{inputId:'n',state:false});
  } else if(event.keyCode === 77){ // m
    socket.emit('keyPress',{inputId:'m',state:false});
  } else if(event.keyCode === 49){ // 1
    socket.emit('keyPress',{inputId:'1',state:false});
  } else if(event.keyCode === 50){ // 2
    socket.emit('keyPress',{inputId:'2',state:false});
  } else if(event.keyCode === 51){ // 3
    socket.emit('keyPress',{inputId:'3',state:false});
  } else if(event.keyCode === 52){ // 4
    socket.emit('keyPress',{inputId:'4',state:false});
  } else if(event.keyCode === 53){ // 5
    socket.emit('keyPress',{inputId:'5',state:false});
  } else if(event.keyCode === 54){ // 6
    socket.emit('keyPress',{inputId:'6',state:false});
  } else if(event.keyCode === 55){ // 7
    socket.emit('keyPress',{inputId:'7',state:false});
  } else if(event.keyCode === 56){ // 8
    socket.emit('keyPress',{inputId:'8',state:false});
  } else if(event.keyCode === 57){ // 9
    socket.emit('keyPress',{inputId:'9',state:false});
  } else if(event.keyCode === 48){ // 0
    socket.emit('keyPress',{inputId:'0',state:false});
  }
}

document.onmousemove = function(event){
  if(selfId){
    var x = -250 + event.clientX - 8;
    var y = -250 + event.clientY - 8;
    var angle = Math.atan2(y,x) / Math.PI * 180;
    socket.emit('keyPress',{inputId:'mouseAngle',state:angle});
  }
}

document.oncontextmenu = function(event){
  //event.preventDefault();
}
