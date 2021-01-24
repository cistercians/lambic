factionGrids = {
  brotherhood:null,
  goths:null,
  norsemen:null,
  franks:null,
  celts:null,
  teutons:null,
  outlaws:null,
  mercenaries:null
}

House = function(param){
  var self = Entity(param);
  self.init = true;
  self.type = param.type;
  self.name = param.name;
  self.flag = param.flag;
  self.hq = param.hq;
  self.patrolPoints = [];
  self.leader = param.leader;
  self.kingdom = param.kingdom;
  self.hostile = param.hostile; // true = attacks neutral players/units
  self.underAttack = false;
  self.allies = [];
  self.enemies = [];

  self.maxPop = null;
  self.spawnRate = 3600000/period;
  self.respawn = function(rank,spawn){ // 0:pawn, 1:ranked
    if(self.spawn){
      var rand = Math.floor(Math.random() * spawnRate);
      setTimeout(function(){
        self.spawn(rank,spawn);
      },rand)
    }
  }
  self.chapter = 0;

  self.stores = {
    grain:0,
    wood:0,
    stone:0,
    iron:0,
    silver:0,
    gold:0
  }

  self.update = function(){

  }

  House.list[self.id] = self;

  io.emit('newFaction',{
    houseList:House.list,
    kingdomList:Kingdom.list
  })
  return self;
}

House.list = {};

House.update = function(){
  for(var i in House.list){
    var house = House.list[i];
    if(house.update){
      house.update();
    }
  }
}

// BROTHERHOOD
Brotherhood = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null
  }
  self.spawn = function(rank,spawn){
    var sCoords = getCenter(spawn.loc[0],spawn.loc[1]);
    if(rank == 0){
      Brother({
        x:sCoords[0],
        y:sCoords[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:-1,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else {
      //
    }
  }

  var super_update = self.update;
  self.update = function(){
    if(self.init){
      if(self.chapter == 0){
        var grid = factionGrids.brotherhood;
        var point = [self.hq[0],self.hq[1]+1];
        self.patrolPoints.push(point);
        // fire
        var fireId = Math.random();
        var coords = getCoords(self.hq[0],self.hq[1]);
        InfiniteFire({
          id:fireId,
          parent:self.id,
          x:coords[0],
          y:coords[1],
          z:-1,
          qty:1
        });
        self.scene.fire = fireId;
        // pawns
        for(var i = 0; i < 3; i++){
          var rand = Math.floor(Math.random() * grid.length);
          var select = grid[rand];
          grid.splice(rand,1);
          var sCoords = getCenter(select[0],select[1]);
          Brother({
            x:sCoords[0],
            y:sCoords[1],
            z:-1,
            house:self.id,
            home:{
              z:-1,
              loc:select
            }
          })
        }
        self.init = false;
        console.log('Brotherhood: ' + self.hq);
      }
    }
    super_update();
    // check for next chapter conditions
  }
}

// GOTHS
Goths = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null
  }
  self.spawn = function(){

  }

  var super_update = self.update;
  self.update = function(){
    if(self.init){
      if(self.chapter == 0){
        var grid = factionGrids.goths;
        var point = [self.hq[0],self.hq[1]+1];
        self.patrolPoints.push(point);
        // fire
        var fireId = Math.random();
        var coords = getCoords(self.hq[0],self.hq[1]);
        InfiniteFire({
          id:fireId,
          parent:self.id,
          x:coords[0],
          y:coords[1],
          z:0,
          qty:1
        });
        self.scene.fire = fireId;
        // pawns
        for(var i = 0; i < 4; i++){
          var rand = Math.floor(Math.random() * grid.length);
          var select = grid[rand];
          grid.splice(rand,1);
          var sCoords = getCenter(select[0],select[1]);
          var flip = Math.random();
          if(flip > 0.4){
            Goth({
              x:sCoords[0],
              y:sCoords[1],
              z:0,
              house:self.id,
              home:{
                z:0,
                loc:select
              }
            })
          } else {
            Acolyte({
              x:sCoords[0],
              y:sCoords[1],
              z:0,
              house:self.id,
              home:{
                z:0,
                loc:select
              }
            })
          }
        }
        self.init = false;
        console.log('Goths: ' + self.hq);
      }
    }
    super_update();
    // check for next chapter conditions
  }
}

// NORSEMEN
Norsemen = function(param){
  var self = House(param);
  self.scene = {
    // objects
    runestone:null,
    fire:null
  }

  self.update = function(){
    if(self.init){
      if(self.chapter == 0){
        var grid = factionGrids.norsemen;
      }
    }
  }
}

// FRANKS
Franks = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null
  }

  var super_update = self.update;
  self.update = function(){
    if(self.init){
      if(self.chapter == 0){
        var grid = factionGrids.franks;
        var point = [self.hq[0],self.hq[1]+1];
        self.patrolPoints.push(point);
        // fire
        var fireId = Math.random();
        var coords = getCoords(self.hq[0],self.hq[1]);
        InfiniteFire({
          id:fireId,
          parent:self.id,
          x:coords[0],
          y:coords[1],
          z:0,
          qty:1
        });
        self.scene.fire = fireId;
        // pawns
        for(var i = 0; i < 4; i++){
          var rand = Math.floor(Math.random() * grid.length);
          var select = grid[rand];
          grid.splice(rand,1);
          var sCoords = getCenter(select[0],select[1]);
          var flip = Math.random();
          if(flip < 0.25){
            FrankSword({
              x:sCoords[0],
              y:sCoords[1],
              z:0,
              house:self.id,
              home:{
                z:0,
                loc:select
              }
            })
          } else if(flip < 0.5){
            FrankBow({
              x:sCoords[0],
              y:sCoords[1],
              z:0,
              house:self.id,
              home:{
                z:0,
                loc:select
              }
            })
          } else {
            FrankSpear({
              x:sCoords[0],
              y:sCoords[1],
              z:0,
              house:self.id,
              home:{
                z:0,
                loc:select
              }
            })
          }
        }
        self.init = false;
        console.log('Franks: ' + self.hq);
      }
    }
    super_update();
  }
}

// CELTS
Celts = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null
  }

  var super_update = self.update;
  self.update = function(){
    if(self.init){
      if(self.chapter == 0){
        var grid = factionGrids.celts;
        var point = [self.hq[0],self.hq[1]+1];
        self.patrolPoints.push(point);
        // fire
        var fireId = Math.random();
        var coords = getCoords(self.hq[0],self.hq[1]);
        InfiniteFire({
          id:fireId,
          parent:self.id,
          x:coords[0],
          y:coords[1],
          z:0,
          qty:1
        });
        self.scene.fire = fireId;
        // pawns
        for(var i = 0; i < 4; i++){
          var rand = Math.floor(Math.random() * grid.length);
          var select = grid[rand];
          grid.splice(rand,1);
          var sCoords = getCenter(select[0],select[1]);
          var flip = Math.random();
          if(flip > 0.4){
            CeltAxe({
              x:sCoords[0],
              y:sCoords[1],
              z:0,
              house:self.id,
              home:{
                z:0,
                loc:select
              }
            })
          } else {
            CeltSpear({
              x:sCoords[0],
              y:sCoords[1],
              z:0,
              house:self.id,
              home:{
                z:0,
                loc:select
              }
            })
          }
        }
        self.init = false;
        console.log('Celts: ' + self.hq);
      }
    }
    super_update();
  }
}

// TEUTONS
Teutons = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null
  }

  var super_update = self.update;
  self.update = function(){
    if(self.init){
      if(self.chapter == 0){
        var grid = factionGrids.teutons;
        var point = [self.hq[0],self.hq[1]+1];
        self.patrolPoints.push(point);
        // fire
        var fireId = Math.random();
        var coords = getCoords(self.hq[0],self.hq[1]);
        InfiniteFire({
          id:fireId,
          parent:self.id,
          x:coords[0],
          y:coords[1],
          z:0,
          qty:1
        });
        self.scene.fire = fireId;
        // pawns
        for(var i = 0; i < 3; i++){
          var rand = Math.floor(Math.random() * grid.length);
          var select = grid[rand];
          grid.splice(rand,1);
          var sCoords = getCenter(select[0],select[1]);
          TeutonicKnight({
            x:sCoords[0],
            y:sCoords[1],
            z:0,
            house:self.id,
            home:{
              z:0,
              loc:select
            }
          })
        }
        self.init = false;
        console.log('Teutons: ' + self.hq);
      }
    }
    super_update();
  }
}

// OUTLAWS
Outlaws = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null
  }

  var super_update = self.update;
  self.update = function(){
    if(self.init){
      if(self.chapter == 0){
        var grid = factionGrids.outlaws;
        var point = [self.hq[0],self.hq[1]+1];
        self.patrolPoints.push(point);
        // fire
        var fireId = Math.random();
        var coords = getCoords(self.hq[0],self.hq[1]);
        InfiniteFire({
          id:fireId,
          parent:self.id,
          x:coords[0],
          y:coords[1],
          z:0,
          qty:1
        });
        self.scene.fire = fireId;
        // pawns
        for(var i = 0; i < 3; i++){
          var rand = Math.floor(Math.random() * grid.length);
          var select = grid[rand];
          grid.splice(rand,1);
          var sCoords = getCenter(select[0],select[1]);
          var flip = Math.random();
          if(flip > 0.33){
            Trapper({
              x:sCoords[0],
              y:sCoords[1],
              z:0,
              house:self.id,
              home:{
                z:0,
                loc:select
              }
            })
          } else {
            Outlaw({
              x:sCoords[0],
              y:sCoords[1],
              z:0,
              house:self.id,
              home:{
                z:0,
                loc:select
              }
            })
          }
        }
        self.init = false;
        console.log('Outlaws: ' + self.hq);
      }
    }
    super_update();
  }
}

// MERCENARIES
Mercenaries = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null,
    barrel1:null,
    chest:null,
    crates:null,
    swordrack1:null,
    swordrack2:null
  }

  var super_update = self.update;
  self.update = function(){
    if(self.init){
      if(self.chapter == 0){
        var grid = factionGrids.mercenaries;
        var point = [self.hq[0],self.hq[1]+1];
        self.patrolPoints.push(point);
        // fire
        var fireId = Math.random();
        var coords = getCoords(self.hq[0],self.hq[1]);
        InfiniteFire({
          id:fireId,
          parent:self.id,
          x:coords[0],
          y:coords[1],
          z:-1,
          qty:1
        });
        self.scene.fire = fireId;
        // pawns
        for(var i = 0; i < 3; i++){
          var rand = Math.floor(Math.random() * grid.length);
          var select = grid[rand];
          grid.splice(rand,1);
          var sCoords = getCenter(select[0],select[1]);
          var flip = Math.random();
          if(flip > 0.33){
            Cutthroat({
              x:sCoords[0],
              y:sCoords[1],
              z:-1,
              house:self.id,
              home:{
                z:-1,
                loc:select
              }
            })
          } else {
            Strongman({
              x:sCoords[0],
              y:sCoords[1],
              z:-1,
              house:self.id,
              home:{
                z:-1,
                loc:select
              }
            })
          }
        }
        self.init = false;
        console.log('Mercenaries: ' + self.hq);
      }
    }
    super_update();
  }
}

Kingdom = function(param){
  var self = Entity(param);
  self.name = param.name;
  self.flag = param.flag;
  self.hq = param.hq;
  self.king = param.king;
  self.houses = param.houses;
  self.hostile = param.hostile;
  self.allies = [];
  self.enemies = [];

  self.stores = {
    grain:0,
    wood:0,
    stone:0,
    iron:0,
    silver:0,
    gold:0
  }
  Kingdom.list[self.id] = self;

  io.emit('newFaction',{
    houseList:House.list,
    kingdomList:Kingdom.list
  })

  return self;
}

Kingdom.list = {};

flags = [
  ['🇦🇽',0], // 0
  ['🇦🇱',0], // 1
  ['🇦🇲',0], // 2
  ['🇦🇼',0], // 3
  ['🇦🇹',0], // 4
  ['🇧🇧',0], // 5
  ['🇧🇹',0], // 6
  ['🇧🇦',0], // 7
  ['🇧🇼',0], // 8
  ['🇧🇳',0], // 9
  ['🇧🇮',0], // 10
  ['🇰🇭',0], // 11
  ['🇨🇻',0], // 12
  ['🇧🇶',0], // 13
  ['🇨🇫',0], // 14
  ['🇨🇴',0], // 15
  ['🇨🇷',0], // 16
  ['🇭🇷',0], // 17
  ['🇩🇰',0], // 18
  ['🇩🇴',0], // 19
  ['🇪🇨',0], // 20
  ['🇪🇪',0], // 21
  ['🇫🇴',0], // 22
  ['🇫🇮',0], // 23
  ['🇵🇫',0], // 24
  ['🇬🇦',0], // 25
  ['🇬🇲',0], // 26
  ['🇬🇪',0], // 27
  ['🇩🇪',0], // 28
  ['🇬🇮',0], // 29
  ['🇬🇱',0], // 30
  ['🇬🇬',0], // 31
  ['🇭🇹',0], // 32
  ['🇭🇳',0], // 33
  ['🇮🇸',0], // 34
  ['🇮🇲',0], // 35
  ['🇯🇪',0], // 36
  ['🇰🇮',0], // 37
  ['🇱🇦',0], // 38
  ['🇱🇻',0], // 39
  ['🇱🇮',0], // 40
  ['🇲🇹',0], // 41
  ['🇲🇭',0], // 42
  ['🇲🇶',0], // 43
  ['🇲🇪',0], // 44
  ['🇴🇲',0], // 45
  ['🇵🇼',0], // 46
  ['🇵🇦',0], // 47
  ['🇵🇬',0], // 48
  ['🇵🇹',0], // 49
  ['🇶🇦',0], // 50
  ['🇷🇼',0], // 51
  ['🇸🇲',0], // 52
  ['🇷🇸',0], // 53
  ['🇸🇱',0], // 54
  ['🇸🇬',0], // 55
  ['🇸🇰',0], // 56
  ['🇪🇸',0], // 57
  ['🇱🇰',0], // 58
  ['🇧🇱',0], // 59
  ['🇵🇲',0], // 60
  ['🇻🇨',0], // 61
  ['🇸🇪',0], // 62
  ['🇨🇭',0], // 63
  ['🇹🇴',0], // 64
  ['🇹🇹',0], // 65
  ['🇻🇮',0], // 66
  ['🇺🇦',0], // 67
  ['🇳🇴',0], // 68
  ['🇼🇫',0], // 69
];
