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

  self.getDistance = function(pt){ // {x,y}
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
  self.loc = param.loc;
  self.plot = param.plot;
  self.walls = param.walls;
  self.topPlot = param.topPlot;
  self.mats = param.mats;
  self.req = param.req;
  self.hp = param.hp;
  self.occ = 0;

  self.getInitPack = function(){
    return {
      id:self.id,
      type:self.type,
      occ:self.occ,
      plot:self.plot,
      walls:self.walls
    }
  }

  self.getUpdatePack = function(){
    return {
      id:self.id,
      occ:self.occ
    }
  }

  Building.list[self.id] = self;

  initPack.building.push(self.getInitPack());

  return self;
}

Farm = function(param){
  var self = Building(param);
  self.mill = null;
  self.findMill = function(){
    for(var i in Building.list){
      var m = Building.list[i];
      var dist = getDistance({x:self.x,y:self.y},{x:m.x,y:m.y});
      if(m.type == 'mill' && dist <= 384 && m.house == self.house){
        Building.list[m.id].farms[self.id] = self.plot;
        for(var p in self.plot){
          Building.list[m.id].resources.push(self.plot[p]);
        }
        self.mill = m.id;
        console.log('Farm found mill ' + m.id);
        return;
      }
    }
  }
  self.findMill();
}

Mill = function(param){
  var self = Building(param);
  self.farms = {};
  self.tavern = null;
  self.resources = [];
  self.serfs = {};
  self.log = {};
  self.patrol = true;
  self.dailyStores = {grain: 0}; // Track daily resource collection
  self.tally = function(){
    var f = 0;
    var s = 0;
    for(var i in self.farms){
      f++;
    }
    for(var i in self.serfs){
      s++;
    }
    var sr = s/(f*9);
    if(sr < 0.372){
      var grain = 0;
      if(self.tavern){
        // Check if owner still exists
        if(!Player.list[self.owner]){
          console.log('Mill owner no longer exists, skipping serf creation');
        } else if(Player.list[self.owner].house){
          var h = Player.list[self.owner].house;
          grain = House.list[h].stores.grain;
          if(grain >= s){
            Building.list[self.tavern].newSerfs(self.id);
          }
        } else {
          grain = Player.list[self.owner].stores.grain;
        if(grain >= s){
          Building.list[self.tavern].newSerfs(self.id);
          }
        }
      } else if(self.house >= 2 && self.house < 7){
        var hq = House.list[self.house].hq;
        grain = House.list[self.house].stores.grain;
        if(grain >= s){
          House.list[self.house].newSerfs(self.id,hq);
        }
      } else {
        console.log('Mill no tavern');
      }
    }
    for(var i in self.farms){
      var plot = self.farms[i];
      
      // First, check if farm has any harvest tiles (type 10 with wheat)
      var hasHarvest = false;
      for(var n in plot){
        var p = plot[n];
        var gt = getTile(0,p[0],p[1]);
        var gr = getTile(6,p[0],p[1]);
        if(gt == 10 && gr > 0){
          hasHarvest = true;
          break;
        }
      }
      
      // Add tiles based on farm state
      var add = [];
      for(var n in plot){
        var p = plot[n];
        var gt = getTile(0,p[0],p[1]);
        var gr = getTile(6,p[0],p[1]);
        
        if(hasHarvest){
          // Farm is in harvest mode - ONLY work on wheat tiles
          if(gt == 10 && gr > 0){
          add.push(p);
        }
        } else {
          // Farm is in barren/growing mode - work on tiles that need it
          // - Barren (type 8) with resources < 5
          // - Growing (type 9) with resources < 10
          if((gt == 8 && gr < 5) || (gt == 9 && gr < 10)){
            add.push(p);
          }
        }
      }
      
      // Add all workable tiles to resources
        for(var x in add){
          self.resources.push(add[x]);
      }
    }
  }
  self.findFarms = function(){
    for(var i in Building.list){
      var f = Building.list[i];
      var dist = getDistance({x:self.x,y:self.y},{x:f.x,y:f.y});
      if(f.type == 'farm' && dist <= 384 && f.house == self.house && !f.mill){
        self.farms[f.id] = f.plot;
        var count = 0;
        var add = [];
        for(var n in f.plot){
          var p = f.plot[n];
          var gt = getTile(0,p[0],p[1]);
          var gr = getTile(6,p[0],p[1]);
          if((gt == 8 && gr < 25)){
            count++;
          } else if((gt == 9 && gr < 50) || gt == 10){
            add.push(p);
          }
        }
        if(count == 9){
          for(var x in f.plot){
            self.resources.push(f.plot[x]);
          }
        } else {
          for(var x in add){
            self.resources.push(add[x]);
          }
        }
      } else if(f.type == 'tavern' && dist <= 1280 && f.house == self.house && !self.tavern){
        self.tavern = f.id;
        console.log('Mill found tavern ' + f.id);
      }
    }
  }
  self.findFarms();
}

Lumbermill = function(param){
  var self = Building(param);
  self.tavern = null;
  self.resources = [];
  self.serfs = {};
  self.log = {};
  self.patrol = true;
  self.dailyStores = {wood: 0}; // Track daily resource collection
  self.tally = function(){
    var r = 0;
    var s = 0;
    for(var i in self.resources){
      r++;
    }
    for(var i in self.serfs){
      s++;
    }
    var sr = s/r;
    if(sr < 0.372){
      var wood = 0;
      if(self.tavern){
        // Check if owner still exists
        if(!Player.list[self.owner]){
          console.log('Lumbermill owner no longer exists, skipping serf creation');
        } else if(Player.list[self.owner].house){
          var h = Player.list[self.owner].house;
          wood = House.list[h].stores.wood;
          if(wood >= s){
            Building.list[self.tavern].newSerfs(self.id);
          }
        } else {
          wood = Player.list[self.owner].stores.wood;
        if(wood >= s){
          Building.list[self.tavern].newSerfs(self.id);
          }
        }
      } else if(self.house >= 2 && self.house < 7){
        var hq = House.list[self.house].hq;
        wood = House.list[self.house].stores.wood;
        if(wood >= s){
          House.list[self.house].newSerfs(self.id,hq);
        }
      } else {
        console.log('Lumbermill no tavern');
      }
      self.getRes();
    }
  }
  self.findTavern = function(){
    for(var i in Building.list){
      var t = Building.list[i];
      var dist = getDistance({x:self.x,y:self.y},{x:t.x,y:t.y});
      if(t.type == 'tavern' && dist <= 1280 && t.house == self.house){
        self.tavern = t.id;
        console.log('Lumbermill found tavern ' + t.id);
      }
    }
  }
  self.getRes = function(){
    var loc = getLoc(self.x,self.y);
    var loc1 = [loc[0]+1,loc[1]];
    var area = getArea(loc,loc1,6);
    var res = [];
    for(var i in area){
      var r = area[i];
      var c = getCenter(r[0],r[1]);
      var dist = self.getDistance({x:c[0],y:c[1]});
      if(dist <= 384){
        var gt = getTile(0,r[0],r[1]);
        if(gt >= 1 && gt < 3){
          res.push(r);
        }
      }
    }
    self.resources = res;
    console.log('Lumbermill added ' + self.resources.length + ' resources');
  }
  self.getRes();
  self.findTavern();
}

Mine = function(param){
  var self = Building(param);
  self.tavern = null;
  self.cave = null;
  self.resources = [];
  self.serfs = {};
  self.log = {};
  self.patrol = true;
  self.dailyStores = {stone: 0, ironore: 0, silverore: 0, goldore: 0, diamond: 0}; // Track daily resource collection
  self.tally = function(){
    var r = 0;
    var s = 0;
    for(var i in self.resources){
      r++;
    }
    for(var i in self.serfs){
      s++;
    }
    var sr = s/r;
    if(sr < 0.372){
      if(self.cave){
        var ore = 0;
        if(self.tavern){
          // Check if owner still exists
          if(!Player.list[self.owner]){
            console.log('Mine owner no longer exists, skipping serf creation');
          } else if(Player.list[self.owner].house){
            var h = Player.list[self.owner].house;
            ore = House.list[h].stores.ironore;
            if(ore >= s){
              Building.list[self.tavern].newSerfs(self.id);
            }
          } else {
            ore = Player.list[self.owner].stores.ironore;
          if(ore >= s){
            Building.list[self.tavern].newSerfs(self.id);
            }
          }
        } else if(self.house >= 2 && self.house < 7){
          var hq = House.list[self.house].hq;
          ore = House.list[self.house].stores.ironore;
          if(ore >= s){
            House.list[self.house].newSerfs(self.id,hq);
          }
        } else {
          console.log('Mine no tavern');
        }
      } else {
        var stone = 0;
        if(self.tavern){
          // Check if owner still exists
          if(!Player.list[self.owner]){
            console.log('Mine owner no longer exists, skipping serf creation');
          } else if(Player.list[self.owner].house){
            var h = Player.list[self.owner].house;
            stone = House.list[h].stores.stone;
            if(stone >= s){
              Building.list[self.tavern].newSerfs(self.id);
            }
          } else {
            stone = Player.list[self.owner].stores.stone;
          if(stone >= s){
            Building.list[self.tavern].newSerfs(self.id);
            }
          }
        } else if(self.house >= 2 && self.house < 7){
          var hq = House.list[self.house].hq;
          stone = House.list[self.house].stores.stone;
          if(stone >= s){
            House.list[self.house].newSerfs(self.id,hq);
          }
        } else {
          console.log('Mine no tavern');
        }
      }
    }
  }
  self.findTavern = function(){
    for(var i in Building.list){
      var t = Building.list[i];
      var dist = getDistance({x:self.x,y:self.y},{x:t.x,y:t.y});
      if(t.type == 'tavern' && dist <= 1280 && t.house == self.house){
        self.tavern = t.id;
        console.log('Mine found tavern ' + t.id);
      }
    }
  }
  self.getRes = function(){
    for(var i in caveEntrances){
      var cave = caveEntrances[i];
      var c = getCenter(cave[0],cave[1]);
      var dist = self.getDistance({x:c[0],y:c[1]});
      if(dist <= 384){
        self.cave = cave;
        console.log('Mine found a cave at [' + cave[0] + ',' + cave[1] + ']');
      }
    }
    if(self.cave){
      // Ore mine - scan z=-1 cave layer for rocks (stored in tilemap layer 1)
      var caveEntranceCoords = getCenter(self.cave[0], self.cave[1]);
      var area = getArea(self.cave,self.cave,10); // Area around cave entrance, not mine
      for(var i in area){
        var r = area[i];
        // Check cave layer 1 for rocks - cave tiles at z=-1 are stored in layer 1
        var gt = getTile(1,r[0],r[1]); // Layer 1 contains cave tiles
        if(gt >= 3 && gt <= 5){ // Rock tiles in caves (types 3, 4, 5)
          // Verify rock is reachable from cave entrance
          var rockCoords = getCenter(r[0], r[1]);
          var dist = getDistance({x: caveEntranceCoords[0], y: caveEntranceCoords[1]}, {x: rockCoords[0], y: rockCoords[1]});
          if(dist <= 640){ // Within 10 tiles of cave entrance
          self.resources.push(r);
        }
      }
      }
      console.log('Ore mine added ' + self.resources.length + ' cave rock resources (z=-1, layer 1) near entrance [' + self.cave[0] + ',' + self.cave[1] + ']');
    } else {
      // Stone mine - scan z=0 for stone patches
      var loc = getLoc(self.x,self.y);
      var loc1 = [loc[0]+1,loc[1]-1];
      var area = getArea(loc,loc1,6);
      for(var i in area){
        var r = area[i];
        var c = getCenter(r[0],r[1]);
        var dist = self.getDistance({x:c[0],y:c[1]});
        if(dist <= 384){
          var gt = getTile(0,r[0],r[1]);
          if(gt >= 4 && gt < 6){
            self.resources.push(r);
          }
        }
      }
      console.log('Stone mine added ' + self.resources.length + ' stone resources (z=0)');
    }
  }
  self.getRes();
  self.findTavern();
}

Outpost = function(param){
  var self = Building(param);
  self.patrol = true;
  self.damage = 5;
  self.alertedEnemies = {}; // Track which enemies have been alerted about {enemyId: timestamp}
  self.scanTimer = 0; // Check for enemies every 2 seconds
  
  self.update = function(){
    // Scan for enemies every 2 seconds (120 frames at 60fps)
    self.scanTimer++;
    if(self.scanTimer >= 120){
      self.scanTimer = 0;
      
      // Clean up old alerts (remove after 30 seconds)
      var now = Date.now();
      for(var enemyId in self.alertedEnemies){
        if(now - self.alertedEnemies[enemyId] > 30000){
          delete self.alertedEnemies[enemyId];
        }
      }
      
      // Scan for enemies within 12 tiles (768px)
      var detectionRadius = 768;
      for(var id in Player.list){
        var enemy = Player.list[id];
        if(!enemy || enemy.z !== 0) continue; // Only detect on overworld
        
        // Skip ghosts - they are invisible
        if(enemy.ghost) continue;
        
        // Check if enemy
        var alliance = allyCheck(self.owner, enemy.id);
        if(alliance >= 0) continue; // Skip allies
        
        // Check distance
        var dist = self.getDistance({x: enemy.x, y: enemy.y});
        if(dist > detectionRadius) continue;
        
        // Check if already alerted recently
        if(self.alertedEnemies[enemy.id]) continue;
        
        // ENEMY DETECTED! Send alert
        self.alertedEnemies[enemy.id] = now;
        var enemyLoc = getLoc(enemy.x, enemy.y);
        var alertMsg = '⚠️ ALERT: ' + (enemy.class || 'Enemy') + ' detected near your outpost at [' + enemyLoc[0] + ',' + enemyLoc[1] + ']';
        
        // Send alert to owner
        var ownerSocket = SOCKET_LIST[self.owner];
        if(ownerSocket){
          ownerSocket.write(JSON.stringify({msg:'addToChat', message: '<span style="color:orange;">' + alertMsg + '</span>'}));
        }
        
        console.log('🚨 Outpost alert: ' + (enemy.class || 'Enemy') + ' at [' + enemyLoc[0] + ',' + enemyLoc[1] + ']');
        
        // Command nearby guards to respond
        var responseRadius = 1280; // 20 tiles
        for(var guardId in Player.list){
          var guard = Player.list[guardId];
          if(!guard || guard.z !== 0) continue;
          
          // Check if it's a military unit
          if(!guard.military) continue;
          
          // Check if allied
          var guardAlliance = allyCheck(self.owner, guard.id);
          if(guardAlliance < 0) continue; // Not an ally
          
          // Check if in range
          var guardDist = self.getDistance({x: guard.x, y: guard.y});
          if(guardDist > responseRadius) continue;
          
          // Check if already in combat or busy
          if(guard.action === 'combat' || guard.action === 'raid') continue;
          
          // Command guard to investigate threat
          guard.action = 'defend';
          guard.defend = {target: enemy.id, location: enemyLoc};
          console.log('🛡️ ' + guard.class + ' responding to outpost alert');
        }
      }
    }
  }
}

Guardtower = function(param){
  var self = Building(param);
  self.patrol = true;
  self.damage = 10;
  self.attackTimer = 0; // Fire every 2 seconds (120 frames at 60fps)
  self.currentTarget = null;
  
  self.update = function(){
    // Automated arrow defense - shoot enemies within 8 tiles
    self.attackTimer++;
    if(self.attackTimer >= 120){
      self.attackTimer = 0;
      
      // Scan for enemies within 8 tiles (512px)
      var attackRange = 512;
      var nearestEnemy = null;
      var nearestDist = Infinity;
      
      for(var id in Player.list){
        var enemy = Player.list[id];
        if(!enemy || enemy.z !== 0) continue; // Only target on overworld
        
        // Skip ghosts - they are invisible
        if(enemy.ghost) continue;
        
        // Check if enemy
        var alliance = allyCheck(self.owner, enemy.id);
        if(alliance >= 0) continue; // Skip allies
        
        // Check distance
        var dist = self.getDistance({x: enemy.x, y: enemy.y});
        if(dist > attackRange) continue;
        
        // Track nearest enemy
        if(dist < nearestDist){
          nearestDist = dist;
          nearestEnemy = enemy;
        }
      }
      
      // Fire arrow at nearest enemy
      if(nearestEnemy){
        var angle = Math.atan2(nearestEnemy.y - self.y, nearestEnemy.x - self.x);
        
        // Create arrow (unlimited ammo)
        Arrow({
          parent: self.id,
          angle: angle,
          x: self.x,
          y: self.y,
          z: 0,
          spdX: Math.cos(angle) * 10,
          spdY: Math.sin(angle) * 10,
          damage: 10,
          owner: self.owner
        });
        
        console.log('🏹 Guardtower fires at ' + (nearestEnemy.class || nearestEnemy.name) + ' (' + Math.floor(nearestDist) + 'px)');
      }
    }
  }
}

Tavern = function(param){
  var self = Building(param);
  self.market = null;
  self.patrol = true;
  self.findBuildings = function(){
    for(var i in Building.list){
      var b = Building.list[i];
      var dist = getDistance({x:self.x,y:self.y},{x:b.x,y:b.y});
      if(dist <= 1280 && b.house == self.house){
        if(b.type == 'mill' || b.type == 'lumbermill' || b.type == 'mine' || b.type == 'market'){
          if(!b.tavern){
            Building.list[i].tavern = self.id;
            console.log('Tavern found ' + b.type + ' ' + b.id);
          }
          if(b.type == 'market'){
            self.market = b.id;
            console.log('Tavern found market ' + b.id);
          }
        }
      }
    }
  }
  self.newSerfs = function(b){
    // Safety check: ensure owner still exists
    if(!Player.list[self.owner]){
      console.log('Tavern owner no longer exists, skipping serf creation');
      return;
    }
    
    var building = Building.list[b];
    console.log('New serfs for ' + building.type);
    var loc = getLoc(self.x,self.y);
    var mLoc = getLoc(building.x,building.y);
    var area = getArea(loc,mLoc,5);
    var select = [];
    var wselect = [];
    for(var i in area){
      var t = area[i];
      var c = t[0];
      var r = t[1];
      var plot = [[c,r+1],[c+1,r+1],t,[c+1,r]];
      var perim = [[c-1,r-1],[c,r-1],[c+1,r-1],[c+2,r-1],[c-1,r],[c+2,r],[c-1,r+1],[c+2,r+1],[c-1,r+2],[c,r+2],[c+1,r+2],[c+2,r+2]];
      var walls = [[c,r-1],[c+1,r-1]];
      var count = 0;
      for(var n in plot){
        var p = getTile(0,plot[n][0],plot[n][1]);
        if((p >= 3 && p < 4) || p == 7){
          count++;
        }
      }
      var ex = perim[2];
      if(count == 4 && getTile(0,ex[0],ex[1]) != 0){
        count = 0;
        for(var n in perim){
          var m = getTile(0,perim[n][0],perim[n][1]);
          var tm = getTile(5,perim[n][0],perim[n][1]);
          if(m != 11 &&
          m != 11.5 &&
          m != 12 &&
          m != 12.5 &&
          m != 13 &&
          m != 14 &&
          m != 15 &&
          m != 16 &&
          m != 17 &&
          m != 19 &&
          m != 20 &&
          m != 20.5 &&
          (tm == 0 || tm == 'dock6' || tm == 'dock7' || tm == 'dock8')){
            count++;
          }
        }
        if(count == 12){
          select.push(plot);
          wselect.push(walls);
        }
      }
    }
    if(select.length > 0){
      var rand = Math.floor(Math.random() * select.length);
      var plot = select[rand];
      var walls = wselect[rand];
      for(var i in plot){
        var p = plot[i];
        tileChange(0,p[0],p[1],11);
        tileChange(6,p[0],p[1],0);
      }
                          // Tile update automatically handled by tileChange function
      var center = getCoords(plot[3][0],plot[3][1]);
      var id = Math.random();
      Building({
        id:id,
        owner:building.owner,
        house:Player.list[building.owner].house,
        kingdom:Player.list[building.owner].kingdom,
        x:center[0],
        y:center[1],
        z:0,
        type:'hut',
        built:false,
        plot:plot,
        walls:walls,
        topPlot:null,
        mats:{
          wood:30,
          stone:0
        },
        req:5,
        hp:150
      })
      var s1 = Math.random();
      var sp1 = self.plot[13]
      var c1 = getCenter(sp1[0],sp1[1]);
      var s2 = Math.random();
      var sp2 = self.plot[14];
      var c2 = getCenter(sp2[0],sp2[1]);
      var work = {hq:b,spot:null};
      
      // For lumbermill/mine, first serf MUST be male; for mill, can be either
      if(building.type == 'lumbermill' || building.type == 'mine'){
        // First serf must be male
        SerfM({
          id:s1,
          name:randomName('m'),
          x:c1[0],
          y:c1[1],
          z:2,
          house:Player.list[self.owner].house,
          kingdom:Player.list[self.owner].kingdom,
          home:{z:2,loc:sp1},
          work:{hq:b,spot:null},
          hut:id,
          tavern:self.id
        });
      } else {
        // Mill - either gender (60% male)
      if(s1 > 0.4){
        SerfM({
          id:s1,
          name:randomName('m'),
          x:c1[0],
          y:c1[1],
          z:2,
          house:Player.list[self.owner].house,
          kingdom:Player.list[self.owner].kingdom,
          home:{z:2,loc:sp1},
          work:{hq:b,spot:null},
          hut:id,
          tavern:self.id
        });
      } else {
        SerfF({
          id:s1,
          name:randomName('f'),
          x:c1[0],
          y:c1[1],
          z:2,
          house:Player.list[self.owner].house,
          kingdom:Player.list[self.owner].kingdom,
          home:{z:2,loc:sp1},
          hut:id,
          tavern:self.id
        });
      }
      }
      
      // Second serf - either gender (40% male for variety)
      if(s2 > 0.6){
        SerfM({
          id:s2,
          name:randomName('m'),
          x:c2[0],
          y:c2[1],
          z:2,
          house:Player.list[self.owner].house,
          kingdom:Player.list[self.owner].kingdom,
          home:{z:2,loc:sp2},
          work:{hq:b,spot:null},
          hut:id,
          tavern:self.id
        });
      } else {
        SerfF({
          id:s2,
          name:randomName('f'),
          x:c2[0],
          y:c2[1],
          z:2,
          house:Player.list[self.owner].house,
          kingdom:Player.list[self.owner].kingdom,
          home:{z:2,loc:sp2},
          hut:id,
          tavern:self.id
        });
      }
      if(Player.list[s1].sex == 'm'){
        Building.list[b].serfs[s1] = s1;
        Player.list[s1].work = {hq:b,spot:null};
      } else {
        if(building.type == 'mill'){
          Building.list[b].serfs[s1] = s1;
          Player.list[s1].work = {hq:b,spot:null};
        }
      }
      if(Player.list[s2].sex == 'm'){
        Building.list[b].serfs[s2] = s2;
        Player.list[s2].work = {hq:b,spot:null};
      } else {
        if(building.type == 'mill'){
          Building.list[b].serfs[s2] = s2;
          Player.list[s2].work = {hq:b,spot:null};
        }
      }
      self.occ += 2;
      console.log('Serfs have spawned in the tavern: ' + Building.list[b].type);
    }
  }
  
  self.healTimer = 0; // Heal every 2 seconds (120 frames) - faster than monastery
  self.update = function(){
    // Passive healing aura for players inside tavern (faster than monastery)
    self.healTimer++;
    if(self.healTimer >= 120){
      self.healTimer = 0;
      
      // Check all players to find those inside this tavern
      for(var id in Player.list){
        var entity = Player.list[id];
        if(!entity || (entity.z !== 1 && entity.z !== 2)) continue; // Inside buildings (z=1 or z=2)
        
        // Check if entity is inside THIS tavern
        var entityBuilding = getBuilding(entity.x, entity.y);
        if(entityBuilding !== self.id) continue;
        
        // Taverns heal everyone (public house), no alliance check needed
        
        // Check if needs healing
        if(entity.hp >= entity.hpMax) continue;
        
        // Heal 1 HP (faster rate than monastery)
        entity.hp = Math.min(entity.hp + 1, entity.hpMax);
      }
    }
  }
  
  self.findBuildings();
}

Monastery = function(param){
  var self = Building(param);
  self.patrol = true;
  self.healTimer = 0; // Heal every 3 seconds (180 frames at 60fps)
  
  self.update = function(){
    // Passive healing aura for allied units/players inside monastery
    self.healTimer++;
    if(self.healTimer >= 180){
      self.healTimer = 0;
      
      // Check all players to find those inside this monastery
      for(var id in Player.list){
        var entity = Player.list[id];
        if(!entity || entity.z !== 1) continue; // Only inside buildings (z=1)
        
        // Check if entity is inside THIS monastery
        var entityBuilding = getBuilding(entity.x, entity.y);
        if(entityBuilding !== self.id) continue;
        
        // Check if allied
        var alliance = allyCheck(self.owner, entity.id);
        if(alliance < 0) continue; // Not an ally
        
        // Check if needs healing
        if(entity.hp >= entity.hpMax) continue;
        
        // Heal 1 HP
        entity.hp = Math.min(entity.hp + 1, entity.hpMax);
      }
    }
  }
}

Market = function(param){
  var self = Building(param);
  self.patrol = true;
  self.findTavern = function(){
    for(var i in Building.list){
      var t = Building.list[i];
      var dist = getDistance({x:self.x,y:self.y},{x:t.x,y:t.y});
      if(t.type == 'tavern' && dist <= 1280){
        self.tavern = t.id;
        if(!t.market){
          Building.list[i].market = self.id;
        }
      }
    }
  }
  
  // Dynamic orderbook - creates entries on-demand for ANY tradeable item
  self.orderbook = {};
  
  // Helper to ensure orderbook entry exists for any item
  self.getOrderbook = function(itemType) {
    if(!self.orderbook[itemType]){
      self.orderbook[itemType] = {bids: [], asks: []};
    }
    return self.orderbook[itemType];
  };
  
  // Expanded emoji mapping for ALL tradeable items
  self.resourceEmoji = {
    // Resources
    grain: '🌾', wood: '🪵', stone: '🪨',
    ironore: '⛏️', silverore: '⚪', goldore: '🟡',
    diamond: '💎', iron: '⚔️', steel: '🗡️',
    leather: '🧥',
    // Weapons
    sword: '⚔️', bow: '🏹', arrows: '➡️',
    // Armor
    ironarmor: '🛡️', steelarmor: '🛡️',
    // Tools
    torch: '🔦', pickaxe: '⛏️',
    // Consumables
    bread: '🍞', fish: '🐟', flour: '🌾'
  };
  
  // Helper to get emoji for any item (with fallback)
  self.getItemEmoji = function(itemType) {
    return self.resourceEmoji[itemType] || '📦';
  };
  
  self.findTavern();
}

Stable = function(param){
  var self = Building(param);
  self.patrol = true;
  self.horses = 5; // Available horses for rent
  self.horseRegenTimer = 0; // Regenerate horses every hour (216000 frames at 60fps)
  
  self.update = function(){
    // Passive: Regenerate horses over time (based on grain availability)
    self.horseRegenTimer++;
    if(self.horseRegenTimer >= 216000){ // 1 hour
      self.horseRegenTimer = 0;
      
      if(self.horses >= 5) return; // Already at max capacity
      
      // Check if owner has grain for horse upkeep
      var owner = Player.list[self.owner];
      if(!owner) return;
      
      var grain = 0;
      if(House.list[self.owner]){
        grain = House.list[self.owner].stores.grain || 0;
      } else if(owner.house && House.list[owner.house]){
        grain = House.list[owner.house].stores.grain || 0;
      } else {
        grain = owner.stores.grain || 0;
      }
      
      // Regenerate horse if enough grain
      if(grain >= 10){
        // Deduct grain
        if(House.list[self.owner]){
          House.list[self.owner].stores.grain -= 10;
        } else if(owner.house && House.list[owner.house]){
          House.list[owner.house].stores.grain -= 10;
        } else {
          owner.stores.grain -= 10;
        }
        
        self.horses++;
        console.log('🐴 Stable regenerated a horse (' + self.horses + '/5)');
      }
    }
  }
}

Dock = function(param){
  var self = Building(param);
  self.patrol = true;
}

Garrison = function(param){
  var self = Building(param);
  self.queue = []; // Keep for backward compatibility (can be used for manual recruitment later)
  self.productionTimer = 0; // Produce units every 5 minutes (18000 frames at 60fps)
  self.patrol = true;
  
  self.update = function(){
    // Automated military production (only if owner has a House)
    self.productionTimer++;
    if(self.productionTimer >= 18000){
      self.productionTimer = 0;
      
      // Check if owner has a House
      var owner = Player.list[self.owner];
      if(!owner) return;
      
      var house = null;
      if(House.list[self.owner]){
        house = House.list[self.owner];
      } else if(owner.house && House.list[owner.house]){
        house = House.list[owner.house];
      } else {
        // No house - garrisons can't produce units
        return;
      }
      
      // Check grain availability (production based on grain)
      var grain = house.stores.grain || 0;
      if(grain < 20) return; // Need at least 20 grain to produce a unit
      
      // Count current military units for this house
      var militaryCount = 0;
      for(var id in Player.list){
        var unit = Player.list[id];
        if(unit && unit.military && unit.house === house.id){
          militaryCount++;
        }
      }
      
      // Determine max garrison size based on grain (1 unit per 50 grain available)
      var maxGarrison = Math.floor(grain / 50);
      if(militaryCount >= maxGarrison) return; // Already at capacity
      
      // Check for stable (needed for cavalry)
      var hasStable = false;
      for(var bid in Building.list){
        var b = Building.list[bid];
        if(b.type === 'stable' && b.house === house.id){
          var dist = self.getDistance({x: b.x, y: b.y});
          if(dist <= 1280){ // Stable within 20 tiles
            hasStable = true;
            break;
          }
        }
      }
      
      // Determine unit type to produce (priority: footsoldier → skirmisher → cavalier)
      var unitType = 'footsoldier';
      var wood = house.stores.wood || 0;
      var iron = house.stores.iron || 0;
      
      if(iron >= 10 && wood >= 20 && hasStable && grain >= 30){
        unitType = 'cavalier';
      } else if(iron >= 5 && wood >= 15 && grain >= 20){
        unitType = 'skirmisher';
      } else if(wood >= 10 && grain >= 20){
        unitType = 'footsoldier';
      } else {
        return; // Not enough resources
      }
      
      // Deduct resources and spawn unit
      var sp = self.plot[7] || self.plot[0]; // Spawn location
      var spCoords = getCenter(sp[0], sp[1]);
      
      if(unitType === 'footsoldier'){
        house.stores.grain -= 20;
        house.stores.wood -= 10;
            Footsoldier({
          x:spCoords[0],
          y:spCoords[1],
          z:1,
          house:house.id,
          kingdom:house.kingdom,
          home:{z:1, loc:sp}
        });
        console.log('⚔️ Garrison produced Footsoldier for ' + house.name);
      } else if(unitType === 'skirmisher'){
        house.stores.grain -= 20;
        house.stores.wood -= 15;
        house.stores.iron -= 5;
            Skirmisher({
          x:spCoords[0],
          y:spCoords[1],
          z:1,
          house:house.id,
          kingdom:house.kingdom,
          home:{z:1, loc:sp}
        });
        console.log('⚔️ Garrison produced Skirmisher for ' + house.name);
      } else if(unitType === 'cavalier'){
        house.stores.grain -= 30;
        house.stores.wood -= 20;
        house.stores.iron -= 10;
            Cavalier({
          x:spCoords[0],
          y:spCoords[1],
          z:1,
          house:house.id,
          kingdom:house.kingdom,
          home:{z:1, loc:sp}
        });
        console.log('⚔️ Garrison produced Cavalier for ' + house.name);
      }
    }
  }
}

Forge = function(param){
  var self = Building(param);
  self.patrol = true;
  self.blacksmith = null;
  self.conversionTimer = 0; // Convert iron ore every 30 seconds (1800 frames at 60fps)
  
  self.update = function(){
    // Passive iron ore to iron bar conversion
    self.conversionTimer++;
    if(self.conversionTimer >= 1800){
      self.conversionTimer = 0;
      
      // Check if owner has iron ore to convert
      var owner = Player.list[self.owner];
      if(!owner) return;
      
      var ironOre = 0;
      if(House.list[self.owner]){
        // Owner is a House
        ironOre = House.list[self.owner].stores.ironore || 0;
        if(ironOre > 0){
          House.list[self.owner].stores.ironore--;
          House.list[self.owner].stores.iron = (House.list[self.owner].stores.iron || 0) + 1;
          console.log('Forge converted 1 Iron Ore → 1 Iron Bar for ' + House.list[self.owner].name);
        }
      } else if(owner.house){
        // Owner has a house
        var h = owner.house;
        ironOre = House.list[h].stores.ironore || 0;
        if(ironOre > 0){
          House.list[h].stores.ironore--;
          House.list[h].stores.iron = (House.list[h].stores.iron || 0) + 1;
          console.log('Forge converted 1 Iron Ore → 1 Iron Bar for ' + House.list[h].name);
        }
      } else {
        // Owner is a player
        ironOre = owner.stores.ironore || 0;
        if(ironOre > 0){
          owner.stores.ironore--;
          owner.stores.iron = (owner.stores.iron || 0) + 1;
          console.log('Forge converted 1 Iron Ore → 1 Iron Bar for ' + owner.name);
        }
      }
    }
  }
}

Gate = function(param){
  var self = Building(param);
  self.patrol = true;
  self.open = function(){

  }
  self.close = function(){

  }
}

Stronghold = function(param){
  var self = Building(param);
  self.patrol = true;
  self.damage = 15; // Stronger than guardtower
  self.garrisonedUnits = []; // Units inside stronghold (protected storage)
  self.attackTimer = 0; // Fire every 1.5 seconds (90 frames at 60fps)
  
  self.update = function(){
    // Long-range arrow defense - shoot enemies within 12 tiles
    self.attackTimer++;
    if(self.attackTimer >= 90){
      self.attackTimer = 0;
      
      // Scan for enemies within 12 tiles (768px)
      var attackRange = 768;
      var nearestEnemy = null;
      var nearestDist = Infinity;
      
      for(var id in Player.list){
        var enemy = Player.list[id];
        if(!enemy || enemy.z !== 0) continue; // Only target on overworld
        
        // Skip ghosts - they are invisible
        if(enemy.ghost) continue;
        
        // Check if enemy
        var alliance = allyCheck(self.owner, enemy.id);
        if(alliance >= 0) continue; // Skip allies
        
        // Check distance
        var dist = self.getDistance({x: enemy.x, y: enemy.y});
        if(dist > attackRange) continue;
        
        // Track nearest enemy
        if(dist < nearestDist){
          nearestDist = dist;
          nearestEnemy = enemy;
        }
      }
      
      // Fire arrow at nearest enemy
      if(nearestEnemy){
        var angle = Math.atan2(nearestEnemy.y - self.y, nearestEnemy.x - self.x);
        
        // Create arrow (unlimited ammo)
        Arrow({
          parent: self.id,
          angle: angle,
          x: self.x,
          y: self.y,
          z: 0,
          spdX: Math.cos(angle) * 12,
          spdY: Math.sin(angle) * 12,
          damage: 15,
          owner: self.owner
        });
        
        console.log('🏰 Stronghold fires at ' + (nearestEnemy.class || nearestEnemy.name) + ' (' + Math.floor(nearestDist) + 'px)');
      }
    }
  }
  
  // Method to garrison units (units enter stronghold for protection)
  self.garrisonUnit = function(unitId){
    var unit = Player.list[unitId];
    if(!unit || !unit.military) return false;
    
    // Check if unit is close enough
    var dist = self.getDistance({x: unit.x, y: unit.y});
    if(dist > 128) return false; // Must be within 2 tiles
    
    // Check if allied
    var alliance = allyCheck(self.owner, unitId);
    if(alliance < 0) return false;
    
    // Add to garrison
    self.garrisonedUnits.push({
      id: unitId,
      class: unit.class,
      hp: unit.hp,
      hpMax: unit.hpMax
    });
    
    // Remove unit from active play (stored in stronghold)
    unit.z = -999; // Special z-level for "stored" units
    unit.garrisonedIn = self.id;
    
    console.log('🏰 ' + unit.class + ' garrisoned in stronghold');
    return true;
  }
  
  // Method to release garrisoned units
  self.releaseUnit = function(index){
    if(index < 0 || index >= self.garrisonedUnits.length) return false;
    
    var unitData = self.garrisonedUnits[index];
    var unit = Player.list[unitData.id];
    if(!unit) return false;
    
    // Release unit at stronghold entrance
    var sp = self.plot[0];
    var spCoords = getCenter(sp[0], sp[1]);
    unit.x = spCoords[0];
    unit.y = spCoords[1];
    unit.z = 0;
    delete unit.garrisonedIn;
    
    // Remove from garrison
    self.garrisonedUnits.splice(index, 1);
    
    console.log('🏰 ' + unit.class + ' released from stronghold');
    return true;
  }
}

Building.list = {};

Building.update = function(){
  var pack = [];
  for(var i in Building.list){
    var building = Building.list[i];
    if(building.update){
      building.update();
    }
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
  self.gear = {
    head:null,
    armor:null,
    weapon:null,
    weapon2:null,
    accessory:null
  }
  self.inventory = Inventory();
  self.stores = {
    grain:0,
    wood:0,
    stone:0,
    ironore:0,
    iron:0,
    silverore:0,
    silver:0,
    goldore:0,
    gold:0,
    diamond:0
  }
  self.mounted = false;
  self.ranged = false;
  self.military = false;
  self.cleric = false;
  self.stealthed = false;
  self.revealed = false;
  self.spriteSize = 64;
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
  self.baseSpd = 2;
  self.maxSpd = 2;
  self.drag = 1;
  self.idleTime = 0;
  self.idleRange = 1000;
  self.wanderRange = 2048; // Increased 8x from 256 (32 tiles leash range)
  self.aggroRange = 256; // Half viewport (768px / 2 = 384px, ~6 tiles)
  self.actionCooldown = 0;
  self.attackCooldown = 0;
  self.hp = 100;
  self.hpMax = 100;
  self.spirit = null;
  self.spiritMax = null;
  self.strength = 1;
  self.damage = 0;
  self.fortitude = 0;
  self.attackrate = 50;
  self.dexterity = 1;
  self.running = false; // NPCs can run in combat
  self.toRemove = false;
  
  // Phase 5: Kill tracking for NPCs
  self.kills = 0;
  self.skulls = '';
  
  // Phase 6: Sprite scaling for fauna minibosses
  self.spriteScale = 1.0;
  
  self.die = function(report){ // report {id,cause}
    var deathLocation = getLoc(self.x, self.y);
    var deathZ = self.z;
    
    // Phase 5: Kill Tracking for NPCs
    var killerName = 'Unknown';
    if(report.id){
      if(Player.list[report.id]){
        var killer = Player.list[report.id];
        killerName = killer.name || killer.class;
        console.log(killerName + ' has killed ' + self.class);
        
        // Track kill and award skulls
        killer.kills = (killer.kills || 0) + 1;
        
        // Update skull display based on kill count (simplified)
        if(killer.kills >= 10){
          killer.skulls = '☠️'; // Skull and crossbones
        } else if(killer.kills >= 3){
          killer.skulls = '💀'; // Single skull
        }
        
        console.log(killerName + ' now has ' + killer.kills + ' kills ' + killer.skulls);
        
        // Phase 6: Fauna Miniboss Growth
        if(killer.class === 'Boar' || killer.class === 'Wolf'){
          // Increase sprite size at key thresholds (max 2x at 10 kills)
          if(killer.kills >= 10){
            killer.spriteScale = 2.0; // Double size
          } else if(killer.kills >= 3){
            killer.spriteScale = 1.5; // Larger at first skull
          }
          
          console.log('⚠️ ' + killer.class + ' is now a miniboss with ' + killer.kills + ' kills (size: ' + killer.spriteScale + 'x)');
        }
        
        // End combat for killer using simple combat system (DON'T clear combat.target before this!)
        if(global.simpleCombat){
          global.simpleCombat.endCombat(killer);
        }
      } else {
        console.log(self.class + ' has ' + report.cause);
      }
    }
    
    // End combat for killed character using simple combat system (DON'T clear combat.target before this!)
    if(global.simpleCombat){
      global.simpleCombat.endCombat(self);
    }
    
    // Clear any remaining combat state (should already be cleared by endCombat)
    self.combat.target = null;
    self.action = null;
    
    // Clean up aggro interval
    if(self.aggroInterval){
      clearInterval(self.aggroInterval);
      self.aggroInterval = null;
    }
    
    // SPAWN SKELETON AT DEATH LOCATION (only for humanoid NPCs, not animals)
    var animalClasses = ['Wolf', 'Deer', 'Boar', 'Sheep', 'Falcon'];
    var isAnimal = animalClasses.includes(self.class);
    
    if(!isAnimal && global.Skeleton){
      var deathCoords = getCenter(deathLocation[0], deathLocation[1]);
      global.Skeleton({
        id: Math.random(),
        x: deathCoords[0],
        y: deathCoords[1],
        z: deathZ,
        innaWoods: self.innaWoods || false
      });
      console.log(`💀 ${self.class} skeleton spawned at [${deathLocation[0]},${deathLocation[1]}] z=${deathZ}`);
    }
    
    // Phase 4: Death Broadcasts to nearby players
    var deathCoords = getCenter(deathLocation[0], deathLocation[1]);
    var broadcastRadius = 640; // 10 tiles
    for(var id in Player.list){
      var nearbyPlayer = Player.list[id];
      if(!nearbyPlayer || nearbyPlayer.z !== deathZ) continue;
      if(nearbyPlayer.id === self.id) continue; // Skip self
      
      var dist = getDistance({x: nearbyPlayer.x, y: nearbyPlayer.y}, {x: deathCoords[0], y: deathCoords[1]});
      if(dist <= broadcastRadius){
        var socket = SOCKET_LIST[id];
        if(socket){
          var victimName = self.name || self.class;
          var message = '<span style="color:#ff6666;">☠️ ' + victimName + ' was killed by ' + killerName + '</span>';
          socket.write(JSON.stringify({msg:'addToChat', message: message}));
        }
      }
    }
    
    // DROP INVENTORY AND EQUIPPED ITEMS
    var droppedItems = [];
    
    // Drop inventory items
    if(self.inventory){
      for(var item in self.inventory){
        if(item === 'keyRing' || item === 'mapData') continue;
        var qty = self.inventory[item];
        if(qty > 0){
          droppedItems.push({item: item, qty: qty});
          self.inventory[item] = 0;
        }
      }
    }
    
    // Drop store resources
    if(self.stores){
      for(var resource in self.stores){
        var qty = self.stores[resource];
        if(qty > 0){
          droppedItems.push({item: resource, qty: qty});
          self.stores[resource] = 0;
        }
      }
    }
    
    // Scatter items around death location (all entities can drop items)
    if(droppedItems.length > 0 && global.itemFactory){
      var deathCoords = getCenter(deathLocation[0], deathLocation[1]);
      console.log(`💀 ${self.class} dropped ${droppedItems.length} item types`);
      for(var i in droppedItems){
        var drop = droppedItems[i];
        var offsetX = (Math.random() - 0.5) * tileSize * 2;
        var offsetY = (Math.random() - 0.5) * tileSize * 2;
        
        global.itemFactory.createItem(drop.item, {
          x: deathCoords[0] + offsetX,
          y: deathCoords[1] + offsetY,
          z: deathZ,
          qty: drop.qty,
          innaWoods: self.innaWoods || false
        });
      }
    }
    
    // NPC respawning logic
    if(self.house && self.house.type == 'npc'){
      var units = House.list[self.house].military.scout.units;
      if(units.length > 0){
        if(units.includes(self.id)){
          House.list[self.house].military.scout.units.remove(units.indexOf(self.id),1);
          for(var i in Item.list){
            var itm = Item.list[i];
            if(itm.type == 'Banner' && itm.parent == self.id){
              Item.list[itm.id].toRemove = true;
              Item.list[itm.id].toUpdate = true;
            }
          }
        }
      }
      House.list[self.house].respawn(self.class,self.home);
    }
    self.toRemove = true;
  }

  // idle = walk around
  // patrol = walk between targets
  // escort = follow and protect target
  // raid = attack all enemies en route to target
  self.mode = 'idle';

  // combat = eliminate target
  // return = return to previous location and activity
  // flee = disengage and escape from target
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

  self.escort = {
    target:null,
    escorting:[] // unit ids
  }

  self.scout = {
    target:null,
    reached:false,
    return:null,
    enemyLoc:null,
    timer:100
  }

  self.guard = {
    point:null, // {z,loc}
    facing:null
  }

  self.raid = {
    target:null
  }

  self.path = null;
  self.pathCount = 0;
  self.pathEnd = null;
  self.followPoint = null;
  self.caveEntrance = null;
  
  // Explicit z-transition system
  self.transitionIntent = null; // 'enter_cave', 'exit_cave', 'enter_building', 'exit_building', etc.
  self.transitionState = 'none'; // 'none', 'at_entrance', 'transitioning'
  self.targetZLevel = null; // Destination z-level for cross-z navigation

  self.move = function(target){ // [c,r]
    self.working = false;
    self.farming = false;
    self.chopping = false;
    self.mining = false;
    
    // Snap to current tile center before creating path (prevents drift)
    var currentLoc = getLoc(self.x, self.y);
    var currentCenter = getCenter(currentLoc[0], currentLoc[1]);
    self.x = currentCenter[0];
    self.y = currentCenter[1];
    
    // Set simple single-tile path
    self.path = [target];
    self.pathCount = 0;
    
  }

  self.prevLoc = null; // [c,r]
  self.stuck = 0;

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
          const zoneKey = `${zc},${zr}`;
          const zoneEntities = zones.get(zoneKey) || new Set();
          for(const entityId of zoneEntities){
            var p = Player.list[entityId];
            if(p && p.z === self.z){
              var loc = getLoc(self.x,self.y);
              var dLoc = [loc[0],loc[1]+1];
              var pLoc = getLoc(p.x,p.y);
              if(pLoc.toString() == dLoc.toString()){
                if(allyCheck(self.id,p.id) < 0 || self.friendlyfire){
                  Player.list[p.id].hp -= dmg - p.fortitude;
                  Player.list[p.id].working = false;
                  Player.list[p.id].chopping = false;
                  Player.list[p.id].mining = false;
                  Player.list[p.id].farming = false;
                  Player.list[p.id].building = false;
                  Player.list[p.id].fishing = false;
                  if(!p.combat.target){
                    Player.list[p.id].combat.target = self.id;
                  }
                  Player.list[p.id].action = 'combat';
                  Player.list[p.id].stealthed = false;
                  Player.list[p.id].revealed = false;
                  self.stealthed = false;
                  self.revealed = false;
                  self.combat.target = p.id;
                  self.action = 'combat';
                  console.log(self.class + ' attacks ' + p.class);
                }
                // player death & respawn
                if(Player.list[p.id].hp <= 0){
                  Player.list[p.id].die({id:self.id,cause:'melee'});
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
          const zoneKey = `${zc},${zr}`;
          const zoneEntities = zones.get(zoneKey) || new Set();
          for(const entityId of zoneEntities){
            var p = Player.list[entityId];
            if(p && p.z === self.z){
              var loc = getLoc(self.x,self.y);
              var uLoc = [loc[0],loc[1]-1];
              var pLoc = getLoc(p.x,p.y);
              if(pLoc.toString() == uLoc.toString()){
                if(allyCheck(self.id,p.id) < 0 || self.friendlyfire){
                  Player.list[p.id].hp -= dmg - p.fortitude;
                  Player.list[p.id].working = false;
                  Player.list[p.id].chopping = false;
                  Player.list[p.id].mining = false;
                  Player.list[p.id].farming = false;
                  Player.list[p.id].building = false;
                  Player.list[p.id].fishing = false;
                  if(!p.combat.target){
                    Player.list[p.id].combat.target = self.id;
                  }
                  Player.list[p.id].action = 'combat';
                  Player.list[p.id].stealthed = false;
                  Player.list[p.id].revealed = false;
                  self.stealthed = false;
                  self.revealed = false;
                  self.combat.target = p.id;
                  self.action = 'combat';
                  console.log(self.class + ' attacks ' + p.class);
                }
                // player death & respawn
                if(Player.list[p.id].hp <= 0){
                  Player.list[p.id].die({id:self.id,cause:'melee'});
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
          const zoneKey = `${zc},${zr}`;
          const zoneEntities = zones.get(zoneKey) || new Set();
          for(const entityId of zoneEntities){
            var p = Player.list[entityId];
            if(p && p.z === self.z){
              var loc = getLoc(self.x,self.y);
              var lLoc = [loc[0]-1,loc[1]];
              var pLoc = getLoc(p.x,p.y);
              if(pLoc.toString() == lLoc.toString()){
                if(allyCheck(self.id,p.id) < 0 || self.friendlyfire){
                  Player.list[p.id].hp -= dmg - p.fortitude;
                  Player.list[p.id].working = false;
                  Player.list[p.id].chopping = false;
                  Player.list[p.id].mining = false;
                  Player.list[p.id].farming = false;
                  Player.list[p.id].building = false;
                  Player.list[p.id].fishing = false;
                  if(!p.combat.target){
                    Player.list[p.id].combat.target = self.id;
                  }
                  Player.list[p.id].action = 'combat';
                  Player.list[p.id].stealthed = false;
                  Player.list[p.id].revealed = false;
                  self.stealthed = false;
                  self.revealed = false;
                  self.combat.target = p.id;
                  self.action = 'combat';
                  console.log(self.class + ' attacks ' + p.class);
                }
                // player death & respawn
                if(Player.list[p.id].hp <= 0){
                  Player.list[p.id].die({id:self.id,cause:'melee'});
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
          const zoneKey = `${zc},${zr}`;
          const zoneEntities = zones.get(zoneKey) || new Set();
          for(const entityId of zoneEntities){
            var p = Player.list[entityId];
            if(p && p.z === self.z){
              var loc = getLoc(self.x,self.y);
              var rLoc = [loc[0]+1,loc[1]];
              var pLoc = getLoc(p.x,p.y);
              if(pLoc.toString() == rLoc.toString()){
                if(allyCheck(self.id,p.id) < 0 || self.friendlyfire){
                  Player.list[p.id].hp -= dmg - p.fortitude;
                  Player.list[p.id].working = false;
                  Player.list[p.id].chopping = false;
                  Player.list[p.id].mining = false;
                  Player.list[p.id].farming = false;
                  Player.list[p.id].building = false;
                  Player.list[p.id].fishing = false;
                  if(!p.combat.target){
                    Player.list[p.id].combat.target = self.id;
                  }
                  Player.list[p.id].action = 'combat';
                  Player.list[p.id].stealthed = false;
                  Player.list[p.id].revealed = false;
                  self.stealthed = false;
                  self.revealed = false;
                  self.combat.target = p.id;
                  self.action = 'combat';
                  console.log(self.class + ' attacks ' + p.class);
                }
                // player death & respawn
                if(Player.list[p.id].hp <= 0){
                  Player.list[p.id].die({id:self.id,cause:'melee'});
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
    if(self.z != -3){
      LitTorch({
        id:torchId,
        parent:self.id,
        x:self.x,
        y:self.y,
        z:self.z,
        qty:1,
        innaWoods:self.innaWoods || false
      })
      self.hasTorch = torchId;
    }
  }

  self.rightBlocked = false;
  self.leftBlocked = false;
  self.upBlocked = false;
  self.downBlocked = false;

  self.return = function(target){ // target = {z:z,loc:[c,r]}
    var loc = getLoc(self.x,self.y);
    if(!self.path){
      // Determine destination z-level
      var destZ = null;
      if(target){
        destZ = target.z;
      } else if(self.lastLoc){
        destZ = self.lastLoc.z;
      } else if(self.tether){
        destZ = self.tether.z;
      } else if(self.home){
        destZ = self.home.z;
      }
      
      // Special case: If inside a building (z=1) and destination is outside (z=0), exit first
      if(self.z == 1 && destZ == 0){
        var b = getBuilding(self.x, self.y);
        if(b){
          var building = Building.list[b];
          if(building && building.plot){
            // Look for door tile in building plot
            for(var i in building.plot){
              var p = building.plot[i];
              var tile = getTile(0, p[0], p[1]);
              if(tile == 14 || tile == 16){ // Door tiles
                // Path to the tile one tile DOWN from door (inside building, triggers exit when door is checked above)
                self.moveTo(1, p[0], p[1] + 1);
                return; // Exit early, will continue after reaching door
              }
            }
          }
        }
      }
      
      // Normal pathfinding
      if(target){
        self.moveTo(target.z,target.loc[0],target.loc[1]);
      } else if(self.lastLoc){
        self.moveTo(self.lastLoc.z,self.lastLoc.loc[0],self.lastLoc.loc[1]);
      } else if(self.tether){
        self.moveTo(self.tether.z,self.tether.loc[0],self.tether.loc[1]);
      } else if(self.home){
        self.moveTo(self.home.z,self.home.loc[0],self.home.loc[1]);
      }
    }
  }

  self.reposition = function(loc,tLoc){
    var dir = self.calcDir(loc,tLoc);
    if(dir != self.lastDir && dir !== 'd' && dir !== 'u' && dir !== 'l' && dir != 'r'){
      self.lastDir = dir;
    }
    if(dir == 'ul'){
      var d = [loc[0],loc[1]+1];
      if(isWalkable(self.z,d[0],d[1])){
        self.move(d);
      } else {
        var r = [loc[0]+1,loc[1]];
        if(isWalkable(self.z,r[0],r[1])){
          self.move(r);
        }
      }
    } else if(dir == 'lu'){
      var r = [loc[0]+1,loc[1]];
      if(isWalkable(self.z,r[0],r[1])){
        self.move(r);
      } else {
        var d = [loc[0],loc[1]+1];
        if(isWalkable(self.z,d[0],d[1])){
          self.move(d);
        }
      }
    } else if(dir == 'l'){
      var r = [loc[0]+1,loc[1]];
      if(isWalkable(self.z,r[0],r[1])){
        self.move(r);
      } else {
        if(self.lastDir == 'dl' || self.lastDir == 'ld'){
          var u = [loc[0],loc[1]-1];
          if(isWalkable(self.z,u[0],u[1])){
            self.move(u);
          }
        } else {
          var d = [loc[0],loc[1]+1];
          if(isWalkable(self.z,d[0],d[1])){
            self.move(d);
          }
        }
      }
    } else if(dir == 'u'){
      var d = [loc[0],loc[1]+1];
      if(isWalkable(self.z,d[0],d[1])){
        self.move(d);
      } else {
        if(self.lastDir == 'ul' || self.lastDir == 'lu'){
          var r = [loc[0]+1,loc[1]];
          if(isWalkable(self.z,r[0],r[1])){
            self.move(r);
          } else {
            var l = [loc[0]-1,loc[1]];
            if(isWalkable(self.z,l[0],l[1])){
              self.move(l);
            }
          }
        }
      }
    } else if(dir == 'ld'){
      var r = [loc[0]+1,loc[1]];
      if(isWalkable(self.z,r[0],r[1])){
        self.move(r);
      } else {
        var u = [loc[0],loc[1]-1];
        if(isWalkable(self.z,u[0],u[1])){
          self.move(u);
        }
      }
    } else if(dir == 'dl'){
      var u = [loc[0],loc[1]-1];
      if(isWalkable(self.z,u[0],u[1])){
        self.move(u);
      } else {
        var r = [loc[0]+1,loc[1]];
        if(isWalkable(self.z,r[0],r[1])){
          self.move(r);
        }
      }
    } else if(dir == 'd'){
      var u = [loc[0],loc[1]-1];
      if(isWalkable(self.z,u[0],u[1])){
        self.move(u);
      } else {
        if(self.lastDir == 'dl' || self.lastDir == 'ld'){
          var r = [loc[0]+1,loc[1]];
          if(isWalkable(self.z,r[0],r[1])){
            self.move(r);
          }
        } else {
          var l = [loc[0]-1,loc[1]];
          if(isWalkable(self.z,l[0],l[1])){
            self.move(l);
          }
        }
      }
    } else if(dir == 'rd'){
      var l = [loc[0]-1,loc[1]];
      if(isWalkable(self.z,l[0],l[1])){
        self.move(l);
      } else {
        var u = [loc[0],loc[1]-1];
        if(isWalkable(self.z,u[0],u[1])){
          self.move(u);
        }
      }
    } else if(dir == 'dr'){
      var u = [loc[0],loc[1]-1];
      if(isWalkable(self.z,u[0],u[1])){
        self.move(u);
      } else {
        var l = [loc[0]-1,loc[1]];
        if(isWalkable(self.z,l[0],l[1])){
          self.move(l);
        }
      }
    } else if(dir == 'ru'){
      var l = [loc[0]-1,loc[1]];
      if(isWalkable(self.z,l[0],l[1])){
        self.move(l);
      } else {
        var d = [loc[0],loc[1]+1];
        if(isWalkable(self.z,d[0],d[1])){
          self.move(d);
        }
      }
    } else if(dir == 'ur'){
      var d = [loc[0],loc[1]+1];
      if(isWalkable(self.z,d[0],d[1])){
        self.move(d);
      } else {
        var l = [loc[0]-1,loc[1]];
        if(isWalkable(self.z,l[0],l[1])){
          self.move(l);
        }
      }
    } else if(dir == 'r'){
      var l = [loc[0]-1,loc[1]];
      if(isWalkable(self.z,l[0],l[1])){
        self.move(l);
      } else {
        if(self.lastDir == 'dr' || self.lastDir == 'rd'){
          var u = [loc[0],loc[1]-1];
          if(isWalkable(self.z,u[0],u[1])){
            self.move(u);
          } else {
            var d = [loc[0],loc[1]+1];
            if(isWalkable(self.z,d[0],d[1])){
              self.move(d);
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
      const zoneKey = `${zc},${zr}`;
      if (!zones.has(zoneKey)) {
        zones.set(zoneKey, new Set());
      }
      zones.get(zoneKey).add(self.id);
      self.zGrid = [
        [zc-1,zr-1],[zc,zr-1],[zc+1,zr-1],
        [zc-1,zr],self.zone,[zc+1,zr],
        [zc-1,zr+1],[zc,zr+1],[zc+1,zr+1]
      ];
    } else if(zn != [zc,zr]){
      // Remove from old zone
      const oldZoneKey = `${zn[0]},${zn[1]}`;
      if (zones.has(oldZoneKey)) {
        zones.get(oldZoneKey).delete(self.id);
      }
      
      // Add to new zone
      const newZoneKey = `${zc},${zr}`;
      if (!zones.has(newZoneKey)) {
        zones.set(newZoneKey, new Set());
      }
      zones.get(newZoneKey).add(self.id);
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
      var dist = self.getDistance({x:p.x, y:p.y});
      if(dist <= tileSize * 2){ // Within 2 tiles
        var loc = getLoc(self.x, self.y);
        var pLoc = getLoc(p.x, p.y);
        
        // Check if facing the stealthed character
        if(self.facing == 'up' && pLoc[1] < loc[1]){
          Player.list[p.id].revealed = true;
        } else if(self.facing == 'down' && pLoc[1] > loc[1]){
          Player.list[p.id].revealed = true;
        } else if(self.facing == 'left' && pLoc[0] < loc[0]){
          Player.list[p.id].revealed = true;
        } else if(self.facing == 'right' && pLoc[0] > loc[0]){
          Player.list[p.id].revealed = true;
        }
      }
    }
  }

  self.revealCheck = function(){
    // Day + not in woods = revealed
    if(self.z == 0 || self.z == 1 || self.z == 2){
      if(!nightfall && !self.innaWoods){
        self.revealed = true;
        return;
      }
    }
    
    // Light sources ALWAYS reveal at night (even in woods)
    if(nightfall || self.z == -1 || self.z == -2){
      for(i in Light.list){
        var light = Light.list[i];
        if(self.z == light.z){
          var d = self.getDistance({x:light.x,y:light.y});
          if(d <= light.radius * 50){
            self.revealed = true;
            return;
          }
        }
      }
    }
    
    // Otherwise, fully stealthed (night or in woods, away from lights)
    self.revealed = false;
  }

  self.checkAggro = function(){
    // Use SimpleCombat for aggro checking
    if(global.simpleCombat){
      global.simpleCombat.checkAggro(self);
    }
  }
  
  // Start aggro checking interval for all NPCs (type is set to 'npc' in Character constructor)
  if(self.type === 'npc'){
    self.aggroInterval = setInterval(function(){
      if(self.checkAggro){
        self.checkAggro();
      }
    }, 100); // Check every 100ms for responsive aggro
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

  self.moveTo = function(tz,tc,tr){
    var loc = getLoc(self.x,self.y);
    if(!self.prevLoc){
      self.prevLoc = loc;
    }
    var cen = getCenter(loc[0],loc[1]);
    var tLoc = [tc,tr];
    
    // Early return if already at target location on same z-level
    // This prevents infinite pathing loops at z-transition tiles
    if(loc.toString() === tLoc.toString() && tz === self.z){
      return;
    }
    
    if(loc.toString() != tLoc.toString()){
      if(tz == self.z){
        if(self.z == -1){
          //
        } else if(self.z == -2){
          var b = getBuilding(cen[0],cen[1]);
          var tcen = getCenter(tLoc[0],tLoc[1]);
          var tb = getBuilding(tcen[0],tcen[1]);
          if(b !== tb){
            tLoc = Building.list[tb].dstairs;
          }
        } else if(self.z == 1){
          var b = getBuilding(cen[0],cen[1]);
          var tcen = getCenter(tLoc[0],tLoc[1]);
          var tb = getBuilding(tcen[0],tcen[1]);
          if(b !== tb){
            // Safety check: ensure target building exists and has an entrance
            if(!Building.list[tb] || !Building.list[tb].entrance){
              console.error(self.name + ' cannot path to building ' + tb + ' - building does not exist or has no entrance');
              return;
            }
            tLoc = [Building.list[tb].entrance[0],Building.list[tb].entrance[1]+1];
          }
        } else if(self.z == 2){
          var b = getBuilding(cen[0],cen[1]);
          var tcen = getCenter(tLoc[0],tLoc[1]);
          var tb = getBuilding(tcen[0],tcen[1]);
          if(b !== tb){
            // Safety check: ensure target building exists and has upstairs
            if(!Building.list[tb] || !Building.list[tb].ustairs){
              console.error(self.name + ' cannot path to building ' + tb + ' - building does not exist or has no upstairs');
              return;
            }
            tLoc = Building.list[tb].ustairs;
          }
        } else if(self.z == -3) {
          //
        }
      } else {
        if(self.z == 0){
          if(tz == 1 || tz == 2 || tz == -2){
            // Set intent to enter building
            self.transitionIntent = 'enter_building';
            self.targetZLevel = tz;
            
            var tcen = getCenter(tLoc[0],tLoc[1]);
            var tb = getBuilding(tcen[0],tcen[1]);
            // Safety check: ensure target building exists and has an entrance
            if(!Building.list[tb] || !Building.list[tb].entrance){
              console.error(self.name + ' cannot enter building ' + tb + ' - building does not exist or has no entrance');
              return;
            }
            tLoc = Building.list[tb].entrance;
          } else if(tz == -1){
            // Set intent to enter cave
            self.transitionIntent = 'enter_cave';
            self.targetZLevel = -1;
            // tLoc already set to cave entrance coordinates
          }
        } else if(self.z == -1 && tz == 0){
          // Exiting cave (z=-1 to z=0) - set intent and path to the cave EXIT tile
          self.transitionIntent = 'exit_cave';
          self.targetZLevel = 0;
          
          // Check if caveEntrance exists before accessing it
          if(self.caveEntrance && Array.isArray(self.caveEntrance) && self.caveEntrance.length >= 2){
            tLoc = [self.caveEntrance[0], self.caveEntrance[1] + 1]; // Cave exit is one tile south
          } else {
            // Fallback: find nearest cave entrance
            if(global.caveEntrances && global.caveEntrances.length > 0){
              var nearest = global.caveEntrances[0];
              var minDist = Infinity;
              for(var i = 0; i < global.caveEntrances.length; i++){
                var ent = global.caveEntrances[i];
                var dist = Math.abs(self.x - ent[0]*global.tileSize) + Math.abs(self.y - ent[1]*global.tileSize);
                if(dist < minDist){
                  minDist = dist;
                  nearest = ent;
                }
              }
              self.caveEntrance = nearest;
              tLoc = [nearest[0], nearest[1] + 1]; // Cave exit is one tile south
            } else {
              // No cave entrance found, stay in place
              return;
            }
          }
        } else if(self.z == -2){
          var b = getBuilding(cen[0],cen[1]);
          // Use dstairs (bidirectional cellar entrance/exit)
          self.transitionIntent = 'go_upstairs_cellar';
          self.targetZLevel = 1;
          
          if(!b || !Building.list[b] || !Building.list[b].dstairs){
            // Cannot find building - force to first floor as emergency fallback
            if(!b){
              console.warn(self.name + ' stuck at z=-2 with no building detected, forcing to z=1');
              self.z = 1;
              self.path = null;
              self.pathCount = 0;
              return;
            }
            console.error(self.name + ' cannot exit cellar - building ' + b + ' has no dstairs');
            return;
          }
          tLoc = Building.list[b].dstairs;
        } else if(self.z == 1){
          var b = getBuilding(cen[0],cen[1]);
          if(tz == 0 || tz == -1){
            // Exiting building to ground level
            self.transitionIntent = 'exit_building';
            self.targetZLevel = 0;
            
            if(!b || !Building.list[b] || !Building.list[b].entrance){
              // Cannot find building - force to ground level as emergency fallback
              if(!b){
                console.warn(self.name + ' stuck at z=1 with no building detected, forcing to z=0');
                self.z = 0;
                self.path = null;
                self.pathCount = 0;
                return;
              }
              console.error(self.name + ' cannot exit building ' + b + ' - no entrance defined');
              return;
            }
            tLoc = [Building.list[b].entrance[0],Building.list[b].entrance[1]+1];
          } else {
            var tcen = getCenter(tLoc[0],tLoc[1]);
            var tb = getBuilding(tcen[0],tcen[1]);
            if(b == tb){
              // Moving to different floor in same building
              if(tz == 2){
                self.transitionIntent = 'go_upstairs';
                self.targetZLevel = 2;
                
                if(!Building.list[b] || !Building.list[b].ustairs){
                  console.error(self.name + ' cannot go upstairs in building ' + b + ' - no ustairs defined');
                  return;
                }
                tLoc = Building.list[b].ustairs;
              } else if(tz == -2){
                self.transitionIntent = 'go_to_cellar';
                self.targetZLevel = -2;
                
                if(!Building.list[b] || !Building.list[b].dstairs){
                  console.error(self.name + ' cannot go to cellar in building ' + b + ' - no dstairs defined');
                  return;
                }
                tLoc = Building.list[b].dstairs;
              }
            } else {
              // Moving to different building - exit current building first
              if(!b || !Building.list[b] || !Building.list[b].entrance){
                // Cannot find building - force to ground level as emergency fallback
                if(!b){
                  console.warn(self.name + ' stuck at z=1 with no building detected, forcing to z=0');
                  self.z = 0;
                  self.path = null;
                  self.pathCount = 0;
                  return;
                }
                console.error(self.name + ' cannot exit building ' + b + ' - no entrance defined');
                return;
              }
              tLoc = [Building.list[b].entrance[0],Building.list[b].entrance[1]+1];
            }
          }
        } else if(self.z == 2){
          var b = getBuilding(cen[0],cen[1]);
          // When on second floor (z=2), need to go down to first floor (z=1) first
          if(tz != 2){
            // Going to a different z-level - use upstairs (bidirectional staircase)
            self.transitionIntent = 'go_downstairs';
            self.targetZLevel = tz;
            
            if(!b || !Building.list[b] || !Building.list[b].ustairs){
              // Cannot find building - force to first floor as emergency fallback
              if(!b){
                console.warn(self.name + ' stuck at z=2 with no building detected, forcing to z=1');
                self.z = 1;
                self.path = null;
                self.pathCount = 0;
                return;
              }
              console.error(self.name + ' cannot go downstairs from z=2 in building ' + b + ' - no ustairs defined');
              return;
            }
          tLoc = Building.list[b].ustairs;
          } else {
            // Moving within second floor to different building
            var tcen = getCenter(tLoc[0],tLoc[1]);
            var tb = getBuilding(tcen[0],tcen[1]);
            if(b !== tb){
              // Exit current building first by going downstairs via upstairs location
              if(!b || !Building.list[b] || !Building.list[b].ustairs){
                // Cannot find building - force to first floor as emergency fallback
                if(!b){
                  console.warn(self.name + ' stuck at z=2 with no building detected, forcing to z=1');
                  self.z = 1;
                  self.path = null;
                  self.pathCount = 0;
                  return;
                }
                console.error(self.name + ' cannot exit building ' + b + ' from z=2 - no ustairs defined');
                return;
              }
              tLoc = Building.list[b].ustairs;
            }
          }
        } else if(self.z == -3){
          //
        }
      }
    }
    var dir = self.calcDir(loc,tLoc);
    if(dir != self.lastDir){
      self.lastDir = dir;
    }
    var u = [loc[0],loc[1]-1];
    var d = [loc[0],loc[1]+1];
    var l = [loc[0]-1,loc[1]];
    var r = [loc[0]+1,loc[1]];
    // door or cave in path handling
    var doorUp = false;
    var doorLeft = false;
    var doorRight = false;
    var caveDown = false;
    if(self.z == 0){
      var gtu = getTile(0,u[0],u[1]);
      var gtl = getTile(0,l[0],l[1]);
      var gtr = getTile(0,r[0],r[1]);
      var gtd = getTile(0,d[0],d[1]);
      if((gtu == 14 || gtu == 16 || gtu == 6) && u.toString() !== tLoc.toString()){
        doorUp = true;
      } else if((gtl == 14 || gtl == 16 || gtl == 6) && l.toString() !== tLoc.toString()){
        doorLeft = true;
      } else if((gtr == 14 || gtr == 16 || gtr == 6) && r.toString() !== tLoc.toString()){
        doorRight = true;
      } else if(gtd == 6 && d.toString() !== tLoc.toString()){
        caveDown = true;
      }
    }
    if(dir == 'dr'){
      if(isWalkable(self.z,d[0],d[1]) || doorRight){
        self.move(d);
      } else {
        if(isWalkable(self.z,r[0],r[1])){
          self.move(r);
        }
      }
    } else if(dir == 'rd'){
      if(isWalkable(self.z,r[0],r[1]) && !doorRight){
        self.move(r);
      } else {
        if(isWalkable(self.z,d[0],d[1])){
          self.move(d);
        }
      }
    } else if(dir == 'r'){
      if(isWalkable(self.z,r[0],r[1]) && !doorRight){
        self.move(r);
      } else {
        if(self.lastDir == 'ur' || self.lastDir == 'ru'){
          if(isWalkable(self.z,u[0],u[1])){
            self.move(u);
          }
        } else {
          if(isWalkable(self.z,d[0],d[1])){
            self.move(d);
          }
        }
      }
    } else if(dir == 'd'){
      if(isWalkable(self.z,d[0],d[1]) && !caveDown){
        self.move(d);
      } else {
        if(self.lastDir == 'dr' || self.lastDir == 'rd'){
          if(isWalkable(self.z,r[0],r[1])){
            self.move(r);
          } else {
            if(isWalkable(self.z,l[0],l[1])){
              self.move(l);
            }
          }
        }
      }
    } else if(dir == 'ru'){
      if(isWalkable(self.z,r[0],r[1]) || doorUp){
        self.move(r);
      } else {
        if(isWalkable(self.z,u[0],u[1])){
          self.move(u);
        }
      }
    } else if(dir == 'ur'){
      if(isWalkable(self.z,u[0],u[1]) && !doorUp){
        self.move(u);
      } else {
        if(isWalkable(self.z,r[0],r[1])){
          self.move(r);
        }
      }
    } else if(dir == 'u'){
      var u = [loc[0],loc[1]-1];
      if(isWalkable(self.z,u[0],u[1]) && !doorUp){
        self.move(u);
      } else {
        if(self.lastDir == 'ur' || self.lastDir == 'ru'){
          if(isWalkable(self.z,r[0],r[1])){
            self.move(r);
          }
        } else {
          if(isWalkable(self.z,l[0],l[1])){
            self.move(l);
          }
        }
      }
    } else if(dir == 'lu'){
      if(isWalkable(self.z,l[0],l[1]) && !doorLeft){
        self.move(l);
      } else {
        var u = [loc[0],loc[1]-1];
        if(isWalkable(self.z,u[0],u[1])){
          self.move(u);
        }
      }
    } else if(dir == 'ul'){
      var u = [loc[0],loc[1]-1];
      if(isWalkable(self.z,u[0],u[1]) && !doorUp){
        self.move(u);
      } else {
        var l = [loc[0]-1,loc[1]];
        if(isWalkable(self.z,l[0],l[1])){
          self.move(l);
        }
      }
    } else if(dir == 'ld'){
      var l = [loc[0]-1,loc[1]];
      if(isWalkable(self.z,l[0],l[1]) && !doorLeft){
        self.move(l);
      } else {
        var d = [loc[0],loc[1]+1];
        if(isWalkable(self.z,d[0],d[1])){
          self.move(d);
        }
      }
    } else if(dir == 'dl'){
      var d = [loc[0],loc[1]+1];
      if(isWalkable(self.z,d[0],d[1]) || doorLeft){
        self.move(d);
      } else {
        var l = [loc[0]-1,loc[1]];
        if(isWalkable(self.z,l[0],l[1])){
          self.move(l);
        }
      }
    } else if(dir == 'l'){
      var l = [loc[0]-1,loc[1]];
      if(isWalkable(self.z,l[0],l[1]) && !doorLeft){
        self.move(l);
      } else {
        if(self.lastDir == 'ul' || self.lastDir == 'lu'){
          var u = [loc[0],loc[1]-1];
          if(isWalkable(self.z,u[0],u[1])){
            self.move(u);
          } else {
            var d = [loc[0],loc[1]+1];
            if(isWalkable(self.z,d[0],d[1])){
              self.move(d);
            }
          }
        }
      }
    }
    var newLoc = getLoc(self.x,self.y);
    if(newLoc.toString() !== loc.toString()){
      self.prevLoc = loc;
      loc = newLoc;
    }
    var diff = {
      c:loc[0]-self.prevLoc[0],
      r:loc[1]-self.prevLoc[1]
    };
    // Improved stuck detection
    if((diff.c > -2 && diff.c < 2) && diff.r == 0 || (diff.r > -2 && diff.r < 2) && diff.c == 0){
      self.stuck++;
    } else {
      self.stuck = Math.max(0, self.stuck - 1); // Gradually reduce stuck counter
    }
    
    // Enhanced unstuck mechanism
    if(self.stuck >= 150){
      console.log(self.name + ' is stuck! Attempting unstuck...');
      self.stuck = 0;
      
      // Try different unstuck strategies
      if(self.path && self.path.length > 0){
        // Skip ahead in path
        self.pathCount = Math.min(self.pathCount + 3, self.path.length - 1);
      } else {
        // Recalculate path
      self.getPath(tz,tc,tr);
      }
      
      // If still stuck after multiple attempts, try random movement
      if(self.stuck >= 200){
        var randomDir = Math.floor(Math.random() * 4);
        var offsets = [[0,-1], [1,0], [0,1], [-1,0]];
        var offset = offsets[randomDir];
        var newTarget = [loc[0] + offset[0], loc[1] + offset[1]];
        
        if(isWalkable(self.z, newTarget[0], newTarget[1])){
          self.moveTo(newTarget);
        }
        self.stuck = 0;
      }
    }
  }

  self.follow = function(target,attack=false){
    if(!self.path){
      if(self.z != target.z && self.lastTarget){
        self.moveTo(self.lastTarget);
      } else {
        var loc = getLoc(self.x,self.y);
        var tLoc = getLoc(target.x,target.y);
        var dLoc = [tLoc[0],tLoc[1]+1];
        var uLoc = [tLoc[0],tLoc[1]-1];
        var lLoc = [tLoc[0]-1,tLoc[1]];
        var rLoc = [tLoc[0]+1,tLoc[1]];

        self.lastTarget = tLoc;
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
              self.move(d);
            } else {
              var r = [loc[0]+1,loc[1]];
              if(isWalkable(self.z,r[0],r[1])){
                self.move(r);
              }
            }
          } else if(dir == 'rd'){
            var r = [loc[0]+1,loc[1]];
            if(isWalkable(self.z,r[0],r[1])){
              self.move(r);
            } else {
              var d = [loc[0],loc[1]+1];
              if(isWalkable(self.z,d[0],d[1])){
                self.move(d);
              }
            }
          } else if(dir == 'r'){
            var r = [loc[0]+1,loc[1]];
            if(isWalkable(self.z,r[0],r[1])){
              self.move(r);
            } else {
              if(self.lastDir == 'ur' || self.lastDir == 'ru'){
                var u = [loc[0],loc[1]-1];
                if(isWalkable(self.z,u[0],u[1])){
                  self.move(u);
                }
              } else {
                var d = [loc[0],loc[1]+1];
                if(isWalkable(self.z,d[0],d[1])){
                  self.move(d);
                }
              }
            }
          } else if(dir == 'd'){
            var d = [loc[0],loc[1]+1];
            if(isWalkable(self.z,d[0],d[1])){
              self.move(d);
            } else {
              if(self.lastDir == 'dr' || self.lastDir == 'rd'){
                var r = [loc[0]+1,loc[1]];
                if(isWalkable(self.z,r[0],r[1])){
                  self.move(r);
                } else {
                  var l = [loc[0]-1,loc[1]];
                  if(isWalkable(self.z,l[0],l[1])){
                    self.move(l);
                  }
                }
              }
            }
          } else if(dir == 'ru'){
            var r = [loc[0]+1,loc[1]];
            if(isWalkable(self.z,r[0],r[1])){
              self.move(r);
            } else {
              var u = [loc[0],loc[1]-1];
              if(isWalkable(self.z,u[0],u[1])){
                self.move(u);
              }
            }
          } else if(dir == 'ur'){
            var u = [loc[0],loc[1]-1];
            if(isWalkable(self.z,u[0],u[1])){
              self.move(u);
            } else {
              var r = [loc[0]+1,loc[1]];
              if(isWalkable(self.z,r[0],r[1])){
                self.move(r);
              }
            }
          } else if(dir == 'u'){
            var u = [loc[0],loc[1]-1];
            if(isWalkable(self.z,u[0],u[1])){
              self.move(u);
            } else {
              if(self.lastDir == 'ur' || self.lastDir == 'ru'){
                var r = [loc[0]+1,loc[1]];
                if(isWalkable(self.z,r[0],r[1])){
                  self.move(r);
                }
              } else {
                var l = [loc[0]-1,loc[1]];
                if(isWalkable(self.z,l[0],l[1])){
                  self.move(l);
                }
              }
            }
          } else if(dir == 'lu'){
            var l = [loc[0]-1,loc[1]];
            if(isWalkable(self.z,l[0],l[1])){
              self.move(l);
            } else {
              var u = [loc[0],loc[1]-1];
              if(isWalkable(self.z,u[0],u[1])){
                self.move(u);
              }
            }
          } else if(dir == 'ul'){
            var u = [loc[0],loc[1]-1];
            if(isWalkable(self.z,u[0],u[1])){
              self.move(u);
            } else {
              var l = [loc[0]-1,loc[1]];
              if(isWalkable(self.z,l[0],l[1])){
                self.move(l);
              }
            }
          } else if(dir == 'ld'){
            var l = [loc[0]-1,loc[1]];
            if(isWalkable(self.z,l[0],l[1])){
              self.move(l);
            } else {
              var d = [loc[0],loc[1]+1];
              if(isWalkable(self.z,d[0],d[1])){
                self.move(d);
              }
            }
          } else if(dir == 'dl'){
            var d = [loc[0],loc[1]+1];
            if(isWalkable(self.z,d[0],d[1])){
              self.move(d);
            } else {
              var l = [loc[0]-1,loc[1]];
              if(isWalkable(self.z,l[0],l[1])){
                self.move(l);
              }
            }
          } else if(dir == 'l'){
            var l = [loc[0]-1,loc[1]];
            if(isWalkable(self.z,l[0],l[1])){
              self.move(l);
            } else {
              if(self.lastDir == 'ul' || self.lastDir == 'lu'){
                var u = [loc[0],loc[1]-1];
                if(isWalkable(self.z,u[0],u[1])){
                  self.move(u);
                } else {
                  var d = [loc[0],loc[1]+1];
                  if(isWalkable(self.z,d[0],d[1])){
                    self.move(d);
                  }
                }
              }
            }
          } else if(dir == 'c'){
            var dirs = [[loc[0],loc[1]+1],[loc[0],loc[1]-1],[loc[0]+1,loc[1]],[loc[0]-1,loc[1]]];
            var select = [];
            for(var i in dirs){
              var dir = dirs[i];
              if(isWalkable(self.z,dir[0],dir[1])){
                select.push(dir);
              }
            }
            var rand = Math.floor(Math.random() * select.length);
            self.move(select[rand]);
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
    var b = getBuilding(self.x,self.y);
    self.zoneCheck();
    if(self.stealthed){
      self.drag = 0.5;
      self.revealCheck();
    } else {
      self.drag = 1;
    }
    if(self.torchBearer){
      if(!self.hasTorch){
        if((self.z == 0 && nightfall) || self.z == -1 || self.z == -2){
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
        // At cave entrance - set state
        self.transitionState = 'at_entrance';
        
        // For players, auto-set intent (backward compatibility)
        if(self.type === 'player'){
          self.transitionIntent = 'enter_cave';
        }
        
        // Check intent to enter cave
        if(self.transitionIntent === 'enter_cave' && self.isAtPathDestination()){
          self.enterCave(loc);
        }
      } else if(getTile(0,loc[0],loc[1]) >= 1 && getTile(0,loc[0],loc[1]) < 2){
        self.innaWoods = true;
        self.onMtn = false;
        if(self.class != 'Deer' && self.class != 'Boar' && self.class != 'Wolf'){
          self.maxSpd = (self.baseSpd * 0.3) * self.drag;
        }
      } else if(getTile(0,loc[0],loc[1]) >= 2 && getTile(0,loc[0],loc[1]) < 4){
        self.innaWoods = false;
        self.onMtn = false;
        if(self.class != 'Deer' && self.class != 'Boar' && self.class != 'Wolf'){
          self.maxSpd = (self.baseSpd * 0.5) * self.drag;
        }
      } else if(getTile(0,loc[0],loc[1]) >= 4 && getTile(0,loc[0],loc[1]) < 5){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.6) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && !self.onMtn){
        self.innaWoods = false;
        self.maxSpd = (self.baseSpd * 0.2) * self.drag;
        setTimeout(function(){
          if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6){
            self.onMtn = true;
          }
        },2000);
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && self.onMtn){
        self.maxSpd = (self.baseSpd * 0.5) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) == 18){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 1.1) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) == 14 || getTile(0,loc[0],loc[1]) == 16 || getTile(0,loc[0],loc[1]) == 19){
        // At building door - set state
        self.transitionState = 'at_entrance';
        
        // Players: automatic (backward compatibility)
        if(self.type === 'player'){
          self.transitionIntent = 'enter_building';
        }
        
        // Check intent to enter building
        if(self.transitionIntent === 'enter_building' && self.isAtPathDestination()){
          self.enterBuilding(b);
        }
      } else if(getTile(0,loc[0],loc[1]) == 0 && !self.ghost){
        // Ghosts cannot go underwater
        // At water tile - set state
        self.transitionState = 'at_entrance';
        
        // For players, auto-set intent (backward compatibility)
        if(self.type === 'player'){
          self.transitionIntent = 'enter_water';
        }
        
        // Check intent to enter water
        if(self.transitionIntent === 'enter_water'){
          self.enterWater();
        }
      } else {
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd  * self.drag;
      }
    } else if(self.z == -1){
      if(getTile(1,loc[0],loc[1]) == 2){
        // At cave exit - set state
        self.transitionState = 'at_entrance';
        
        // For players, auto-set intent (backward compatibility)
        if(self.type === 'player'){
          self.transitionIntent = 'exit_cave';
        }
        
        // Check intent to exit cave
        if(self.transitionIntent === 'exit_cave' && self.isAtPathDestination()){
          self.exitCave();
        }
        // If no intent or has path, stay in cave
      }
    } else if(self.z == -2){
      if(getTile(8,loc[0],loc[1]) == 5){
        // At cellar stairs - set state
        self.transitionState = 'at_entrance';
        
        // Players: automatic (backward compatibility)
        if(self.type === 'player'){
          self.transitionIntent = 'go_upstairs_cellar';
        }
        
        // Check intent to go upstairs from cellar
        if(self.transitionIntent === 'go_upstairs_cellar' && self.isAtPathDestination()){
          self.goDownstairs(1); // Yes, goDownstairs(1) goes UP from cellar to floor 1
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
      if(getTile(0,loc[0],loc[1]) != 0){
        // At land tile while underwater - set state
        self.transitionState = 'at_entrance';
        
        // For players, auto-set intent (backward compatibility)
        if(self.type === 'player'){
          self.transitionIntent = 'surface_water';
        }
        
        // Check intent to surface
        if(self.transitionIntent === 'surface_water'){
          self.surfaceFromWater();
        }
      }
    } else if(self.z == 1){
      if(getTile(0,loc[0],loc[1] - 1) == 14 || getTile(0,loc[0],loc[1] - 1) == 16  || getTile(0,loc[0],loc[1] - 1) == 19){
        // At building exit - set state
        self.transitionState = 'at_entrance';
        
        // For players, auto-set intent (backward compatibility)
        if(self.type === 'player'){
          self.transitionIntent = 'exit_building';
        }
        
        // Check intent to exit building
        if(self.transitionIntent === 'exit_building' && self.isAtPathDestination()){
        var exit = getBuilding(self.x,self.y-tileSize);
          self.exitBuilding(exit);
        }
      } else if(getTile(4,loc[0],loc[1]) == 3 || getTile(4,loc[0],loc[1]) == 4 || getTile(4,loc[0],loc[1]) == 7){
        // At upstairs tile - set state
        self.transitionState = 'at_entrance';
        
        // For players, auto-set intent (backward compatibility)
        if(self.type === 'player'){
          self.transitionIntent = 'go_upstairs';
        }
        
        // Check intent to go upstairs
        if(self.transitionIntent === 'go_upstairs' && self.isAtPathDestination()){
          self.goUpstairs();
        }
      } else if(getTile(4,loc[0],loc[1]) == 5 || getTile(4,loc[0],loc[1]) == 6){
        // At cellar stairs - set state
        self.transitionState = 'at_entrance';
        
        // For players, auto-set intent (backward compatibility)
        if(self.type === 'player'){
          self.transitionIntent = 'go_to_cellar';
        }
        
        // Check intent to go to cellar
        if(self.transitionIntent === 'go_to_cellar' && self.isAtPathDestination()){
          self.goDownstairs(-2);
        }
      }
    } else if(self.z == 2){
      if(getTile(4,loc[0],loc[1]) == 3 || getTile(4,loc[0],loc[1]) == 4){
        // At downstairs tile - set state
        self.transitionState = 'at_entrance';
        
        // For players, auto-set intent (backward compatibility)
        if(self.type === 'player'){
          self.transitionIntent = 'go_downstairs';
        }
        
        // Check intent to go downstairs
        if(self.transitionIntent === 'go_downstairs' && self.isAtPathDestination()){
          self.goDownstairs(1);
        }
      }
    }

    ////////////////
    // VANILLA AI //
    ////////////////

    // IDLE
    if(self.mode == 'idle'){
      if(!self.action){
        if(self.military){
          var min = Math.floor(House.list[self.house].military.patrol.length/3);
          var count = 0;
          for(const i of Object.keys(Player.list)){
            var p = Player.list[i];
            if(p.house == self.house && p.mode == 'patrol'){
              count++;
            }
          }
          if(count < min){
            self.mode = 'patrol';
          }
        }
        var cHome = getCenter(self.home.loc[0],self.home.loc[1]);
        var hDist = self.getDistance({x:cHome[0],y:cHome[1]});
        if(hDist > self.wanderRange){
          if(!self.path){
            self.return();
          }
        } else if(self.idleTime == 0){
          if(!self.path){
            var col = loc[0];
            var row = loc[1];
            var select = [[col,row-1],[col-1,row],[col,row+1],[col+1,row]];
            var target = select[Math.floor(Math.random() * 4)];
            if(target[0] < mapSize && target[0] > -1 && target[1] < mapSize && target[1] > -1){
              if(isWalkable(self.z,target[0],target[1])){
                self.move(target);
                self.idleTime += Math.floor(Math.random() * self.idleRange);
              }
            }
          }
        }
      } else if(self.action == 'combat'){
        // Use SimpleCombat for all combat logic
        if(global.simpleCombat){
          global.simpleCombat.update(self);
        } else {
          // Fallback: clear invalid combat
          if(!self.combat.target || !Player.list[self.combat.target]){
            self.action = null;
            self.combat.target = null;
            self.path = null;
            self.pathCount = 0;
          }
        }
      } else if(self.action == 'flee'){
        if(!self.path){
          if(self.combat.target){
            var target = Player.list[self.combat.target];
            if(target){
              var tLoc = getLoc(target.x,target.y);
              self.reposition(loc,tLoc);
            } else {
              self.combat.target = null;
              self.action = null;
            }
          } else {
            self.action = null;
          }
        }
      } else if(self.action == 'returning'){
        // Returning home after exceeding leash range
        if(self.home && self.home.loc){
          var homeCoords = getCenter(self.home.loc[0], self.home.loc[1]);
          var homeDist = self.getDistance({x: homeCoords[0], y: homeCoords[1]});
          var leashRange = self.wanderRange || 2048;
          
          if(homeDist <= leashRange * 0.5){
            // Back within safe range - resume normal behavior
            console.log(self.class + ' returned home successfully');
            self.action = null;
            self.path = null;
            self.pathCount = 0;
          } else if(!self.path){
            // No path and still far - move home
            self.return();
          }
        } else {
          self.action = null;
        }
      }
      // PATROL
    } else if(self.mode == 'patrol'){
        if(!self.action){
          if(!self.path){
            var list = House.list[self.house].patrol;
            var select = list[Math.floor(Math.random() * list.length)];
            var build = Building.list[select];
            var area = getArea(build.plot[0],build.plot[build.plot.length-1],2);
            var tiles = [];
            for(var i in area){
              if(isWalkable(0,area[i][0],area[i][1])){
                tiles.push(area[i]);
              }
            }
            var t = tiles[Math.floor(Math.random() * tiles.length)];
            self.moveTo(self.z,t[0],t[1]);
          }
        } else if(self.action == 'combat'){
          var target = Player.list[self.combat.target];
          var lCoords = getCenter(lastLoc.loc[0],lastLoc.loc[1]);
          var lDist = self.getDistance(lCoords[0],lCoords[1]);
          if(!target || (lDist > self.aggroRange*2)){
            self.combat.target = null;
            self.action = null;
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
            self.moveTo(target.z,dest[0],dest[1]);
          }
        }
      } else if(self.action == 'combat'){
        var cTarget = self.combat.target;
        if(cTarget){
          if(tDist > (self.aggroRange*1.5)){
            self.action = null;
          } else {
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
          }
        }
      }
      // SCOUT
    } else if(self.mode == 'scout'){
      if(!self.action){
        var dest = self.scout.target;
        if(loc.toString() == dest.toString()){
          if(self.scout.reached){
            self.scout.timer--;
            if(self.scout.timer == 0){
              House.list[self.house].expand(dest);
              self.action == 'flee';
            }
          } else {
            self.scout.reached = true;
          }
        }
      } else if(self.action == 'combat'){
        if(!self.scout.rally){
          self.scout.rally = loc;
          House.list[self.house].military.campaign.rally = loc;
          Banner({
            x:loc[0],
            y:loc[1],
            z:self.z,
            qty:1,
            parent:self.id
          });
        }
        self.combat.target = null;
        self.action = 'flee';
      } else if(self.action == 'flee'){
        if(!self.path){
          var ret = self.scout.return;
          if(loc.toString() == ret.toString()){
            House.list[self.house].military.scout.units.remove(units.indexOf(self.id),1);
            self.mode = 'idle';
          } else {
            self.moveTo(self.z,ret[0],ret[1]);
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
          if(loc != point.loc){
            self.moveTo(point.z,point.loc[0],point.loc[1]);
          }
        }
      } else if(self.action == 'combat'){
        var target = Player.list[self.combat.target];
        if(!target || pDist > (self.aggroRange*1.5)){
          self.return({z:point.z,loc:point.loc});
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
            self.moveTo(0,dest[0],dest[1]);
          }
        }
      } else if(self.action == 'combat'){
        var target = Player.list[self.combat.target];
        var lCoords = getCenter(lastLoc.loc[0],lastLoc.loc[1]);
        var lDist = self.getDistance(lCoords[0],lCoords[1]);
        if(!target || (lDist > self.aggroRange*4)){
          self.combat.target = null;
          self.action = null;
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
      } else if(self.action == 'flee'){
        if(!self.path){
          if(loc.toString() == self.home.loc.toString()){
            self.mode = 'idle';
          } else {
            self.moveTo(self.home.z,self.home.loc[0],self.home.loc[1]);
          }
        }
      }
    }
    self.updatePosition();
  }

  self.getPath = function(z,c,r){
    self.pathEnd = {z:z,loc:[c,r]};
    self.pathLocked = false; // Clear path lock when starting new pathfinding
    var start = getLoc(self.x,self.y);
    var cst = getCenter(start[0],start[1]);
    var b = getBuilding(cst[0],cst[1]);
    var cd = getCenter(c,r);
    var db = getBuilding(cd[0],cd[1]);
    
    // Use multi-z pathfinding for complex journeys
    if(z != self.z && Math.abs(z - self.z) > 1){
      console.log('Using multi-z pathfinding from z', self.z, 'to z', z);
      var multiZPath = createMultiZPath(self.z, start, z, [c,r]);
      
      if(multiZPath && multiZPath.length > 0){
        // Store the multi-z waypoints
        self.multiZWaypoints = multiZPath;
        self.currentWaypoint = 0;
        
        // Start with first waypoint
        var firstWaypoint = multiZPath[0];
        self.getPath(firstWaypoint.z, firstWaypoint.loc[0], firstWaypoint.loc[1]);
        return;
      }
    }
    
    // Try to get cached path first
    var cachedPath = getCachedPath(start, [c,r], z);
    if(cachedPath){
      self.path = cachedPath;
      return;
    }
    
    if(z == self.z){
      if(self.z == 0){
        if(getLocTile(0,self.x,self.y) == 0){
          var path = global.tilemapSystem.findPath(start, [c,r], 3);
          if(path && path.length > 0){
            path = smoothPath(path, z);
            cachePath(start, [c,r], z, path);
          }
          self.path = path;
        } else {
          // Check if destination is a doorway
          var isTargetDoorway = global.isDoorwayDestination(c, r, z);
          var options = {};
          
          if (isTargetDoorway) {
            // Allow pathfinding to the specific doorway
            options.allowSpecificDoor = true;
            options.targetDoor = [c, r];
          }
          // Note: We don't avoid doors in pathfinding anymore
          // The intent system prevents NPCs from accidentally entering buildings
          // Doors must remain walkable for pathfinding around buildings
          
          var path = global.tilemapSystem.findPath(start, [c,r], 0, options);
          if(path && path.length > 0){
            path = smoothPath(path, z);
            cachePath(start, [c,r], z, path);
          }
          self.path = path;
        }
      } else if(self.z == -1){
        // In cave - check if destination is a cave exit
        // Note: Cave exits on layer 1 are at entrance[0], entrance[1]+1 (one tile south of overworld entrance)
        var isTargetCaveExit = false;
        var isStartCaveExit = false;
        
        for(var i in caveEntrances){
          var ce = caveEntrances[i];
          if(ce[0] == c && ce[1] + 1 == r){
            isTargetCaveExit = true;
          }
          if(ce[0] == start[0] && ce[1] + 1 == start[1]){
            isStartCaveExit = true;
          }
        }
        
        var options = {};
        if(isTargetCaveExit){
          // Allow pathfinding to the specific cave exit
          options.allowSpecificDoor = true;
          options.targetDoor = [c, r];
        }
        // Note: We don't avoid cave exits in pathfinding anymore
        // The intent system prevents NPCs from accidentally exiting caves
        // Cave exits must remain walkable for pathfinding in caves
        
        // If starting from a cave exit, pass it as an allowed exception
        if(isStartCaveExit){
          options.allowStartTile = start;
        }
        
        // Use layer 1 for cave (worldMaps[1] = Underworld)
        var path = global.tilemapSystem.findPath(start, [c,r], 1, options);
        if(path && path.length > 0){
          path = smoothPath(path, z);
          cachePath(start, [c,r], z, path);
        }
        self.path = path;
      } else if(self.z == -2){
        if(b == db){
          var path = global.tilemapSystem.findPath(start, [c,r], -2);
          if(path && path.length > 0){
            path = smoothPath(path, z);
            cachePath(start, [c,r], z, path);
          }
          self.path = path;
        } else {
          //var gridB3b = cloneGrid(-2);
          var stairs = Building.list[b].dstairs;
          //var path = finder.findPath(start[0], start[1], stairs[0], stairs[1], gridB1b);
          //self.path = path;
          self.moveTo(stairs);
        }
      } else if(self.z == 1){
        if(b == db){
          //var gridB1b = cloneGrid(1);
          //var path = finder.findPath(start[0], start[1], c, r, gridB1b);
          //self.path = path;
          self.moveTo([c,r]);
        } else {
          //var gridB1b = cloneGrid(1);
          var exit = Building.list[b].entrance;
          //var path = finder.findPath(start[0], start[1], exit[0], exit[1]+1, gridB1b);
          //self.path = path;
          self.moveTo([exit[0],exit[1]+1]);
        }
      } else if(self.z == 2){
        if(b == db){
          //var gridB2b = cloneGrid(2);
          //var path = finder.findPath(start[0], start[1], c, r, gridB2b);
          //self.path = path;
          self.moveTo([c,r]);
        } else {
          //var gridB2b = cloneGrid(2);
          var stairs = Building.list[b].ustairs;
          //var path = finder.findPath(start[0], start[1], stairs[0], stairs[1], gridB1b);
          //self.path = path;
          self.moveTo(stairs);
        }
      }
    } else {
      if(self.z == 0){ // outdoors
        if(z == -1){ // to cave
          var cave = [];
          var best = null;
          var c = getCoords(c,r);
          for(i in caveEntrances){
            var e = getCoords(caveEntrances[i]);
            var d = getDistance({x:c[0],y:c[1]},{x:e[0],y:e[1]});
            if(!best || d < best){
              cave = caveEntrances[i];
              best = d;
            }
          }
          // When pathfinding to cave entrance, allow the specific cave entrance
          var options = {
            allowSpecificDoor: true,
            targetDoor: [cave[0], cave[1]]
          };
          var path = global.tilemapSystem.findPath(start, [cave[0], cave[1]], 0, options);
          self.path = path;
        } else { // to building
          var ent = Building.list[db].entrance;
          // When pathfinding to a building entrance, allow the specific doorway
          var options = {
            allowSpecificDoor: true,
            targetDoor: [ent[0], ent[1]]
          };
          var path = global.tilemapSystem.findPath(start, [ent[0], ent[1]], 0, options);
          self.path = path;
        }
      } else if(self.z == -1){ // cave
        var best = null;
        var cave = [];
        for(i in caveEntrances){
          var e = getCoords(caveEntrances[i]);
          var d = self.getDistance({x:e[0],y:e[1]});
          if(!best || d < best){
            cave = caveEntrances[i];
            best = d;
          }
        }
        // Path to the cave exit tile (which is at cave[0], cave[1]+1 on layer 1)
        var options = {
          allowSpecificDoor: true,
          targetDoor: [cave[0], cave[1] + 1]
        };
        // Use layer 1 for cave (worldMaps[1] = Underworld)
        var path = global.tilemapSystem.findPath(start, [cave[0], cave[1] + 1], 1, options);
        self.path = path;
      } else if(self.z == 1){ // indoors
        //var gridB1b = cloneGrid(1);
        if(b == db){
          if(z == 2){ // to upstairs
            var stairs = Building.list[b].ustairs;
            //var path = finder.findPath(start[0], start[1], stairs[0], stairs[1], gridB1b);
            //self.path = path;
            self.moveTo(stairs);
          } else if(z == -2){ // to cellar/dungeon
            var stairs = Building.list[b].dstairs;
            //var path = finder.findPath(start[0], start[1], stairs[0], stairs[1], gridB1b);
            //self.path = path;
            self.moveTo(stairs);
          } else { // outdoors
            var exit = Building.list[b].entrance;
            //var path = finder.findPath(start[0], start[1], exit[0], exit[1]+1, gridB1b);
            //self.path = path;
            self.moveTo([exit[0],exit[1]+1]);
          }
        } else {
          var exit = Building.list[b].entrance;
          //var path = finder.findPath(start[0], start[1], exit[0], exit[1]+1, gridB1b);
          //self.path = path;
          self.moveTo([exit[0],exit[1]+1]);
        }
      } else if(self.z == 2){ // upstairs
        //var gridB2b = cloneGrid(2);
        var stairs = Building.list[b].ustairs;
        //var path = finder.findPath(start[0], start[1], stairs[0], stairs[1], gridB2b);
        //self.path = path;
        self.moveTo(stairs);
      } else if(self.z == -2){ // cellar/dungeon
        //var gridB3b = cloneGrid(-2);
        var stairs = Building.list[b].dstairs;
        //var path = finder.findPath(start[0], start[1], stairs[0], stairs[1], gridB3b);
        //self.path = path;
        self.moveTo(stairs);
      } else if(self.z == -3){ // underwater
        self.moveTo([c,r]);
      }
    }
  }

  // Explicit Z-Transition Methods
  self.enterCave = function(entrance) {
    console.log(self.name + ' entering cave at [' + entrance + ']');
    self.z = -1;
    self.caveEntrance = entrance;
    self.path = null;
    self.pathCount = 0;
    self.transitionIntent = null;
    self.transitionState = 'none';
    self.innaWoods = false;
    self.onMtn = false;
    self.maxSpd = self.baseSpd * self.drag;
    // Clear movement flags
    if(!self.ghost){
      self.pressingRight = false;
      self.pressingLeft = false;
      self.pressingDown = false;
      self.pressingUp = false;
    }
  };

  self.exitCave = function() {
    console.log(self.name + ' exiting cave to z=0');
    self.z = 0;
    self.path = null;
    self.pathCount = 0;
    self.caveEntrance = null;
    self.transitionIntent = null;
    self.transitionState = 'none';
    self.innaWoods = false;
    self.onMtn = false;
    self.maxSpd = (self.baseSpd * 0.9) * self.drag;
    // Clear movement flags
    if(!self.ghost){
      self.pressingRight = false;
      self.pressingLeft = false;
      self.pressingDown = false;
      self.pressingUp = false;
    }
  };

  self.enterBuilding = function(buildingId) {
    console.log(self.name + ' entering building ' + buildingId);
    if(Building.list[buildingId]){
      Building.list[buildingId].occ++;
    }
    self.z = 1;
    self.path = null;
    self.pathCount = 0;
    self.transitionIntent = null;
    self.transitionState = 'none';
    self.innaWoods = false;
    self.onMtn = false;
    self.maxSpd = self.baseSpd * self.drag;
    // Clear movement flags
    if(!self.ghost){
      self.pressingRight = false;
      self.pressingLeft = false;
      self.pressingDown = false;
      self.pressingUp = false;
    }
  };

  self.exitBuilding = function(buildingId) {
    console.log(self.name + ' exiting building to z=0');
    if(Building.list[buildingId]){
      Building.list[buildingId].occ--;
    }
    self.z = 0;
    self.path = null;
    self.pathCount = 0;
    self.transitionIntent = null;
    self.transitionState = 'none';
    self.maxSpd = self.baseSpd * self.drag;
    // Clear movement flags
    if(!self.ghost){
      self.pressingRight = false;
      self.pressingLeft = false;
      self.pressingDown = false;
      self.pressingUp = false;
    }
  };

  self.goUpstairs = function() {
    self.z = 2;
    self.path = null;
    self.pathCount = 0;
    self.transitionIntent = null;
    self.transitionState = 'none';
    self.y += (tileSize/2);
    self.facing = 'down';
    // Clear movement flags
    if(!self.ghost){
      self.pressingRight = false;
      self.pressingLeft = false;
      self.pressingDown = false;
      self.pressingUp = false;
    }
  };

  self.goDownstairs = function(targetZ) {
    self.z = targetZ; // Could be 1 or -2
    self.path = null;
    self.pathCount = 0;
    self.transitionIntent = null;
    self.transitionState = 'none';
    self.y += (tileSize/2);
    self.facing = 'down';
    // Clear movement flags
    if(!self.ghost){
      self.pressingRight = false;
      self.pressingLeft = false;
      self.pressingDown = false;
      self.pressingUp = false;
    }
  };

  // Helper method to check if NPC is at their path destination
  self.isAtPathDestination = function() {
    if (!self.path || self.path.length === 0) return true;
    
    var loc = getLoc(self.x, self.y);
    var finalDest = self.path[self.path.length - 1];
    
    return loc[0] === finalDest[0] && loc[1] === finalDest[1];
  };

  self.enterWater = function() {
    self.z = -3;
    self.path = null;
    self.pathCount = 0;
    self.transitionIntent = null;
    self.transitionState = 'none';
    self.innaWoods = false;
    self.onMtn = false;
    self.maxSpd = (self.baseSpd * 0.2) * self.drag;
    // Clear movement flags
    if(!self.ghost){
      self.pressingRight = false;
      self.pressingLeft = false;
      self.pressingDown = false;
      self.pressingUp = false;
    }
  };

  self.surfaceFromWater = function() {
    self.z = 0;
    self.path = null;
    self.pathCount = 0;
    self.transitionIntent = null;
    self.transitionState = 'none';
    self.breath = self.breathMax;
    self.maxSpd = self.baseSpd * self.drag;
    // Clear movement flags
    if(!self.ghost){
      self.pressingRight = false;
      self.pressingLeft = false;
      self.pressingDown = false;
      self.pressingUp = false;
    }
  };

  self.updatePosition = function(){
    // Clear movement flags if no path (units should be idle)
    if(!self.path){
      self.pressingRight = false;
      self.pressingLeft = false;
      self.pressingDown = false;
      self.pressingUp = false;
    }
    
    // Handle multi-z waypoint progression
    if(self.multiZWaypoints && self.multiZWaypoints.length > 0){
      var currentWaypoint = self.multiZWaypoints[self.currentWaypoint];
      
      // Check if we've reached the current waypoint
      var loc = getLoc(self.x, self.y);
      if(self.z == currentWaypoint.z && loc.toString() == currentWaypoint.loc.toString()){
        console.log('Reached waypoint', self.currentWaypoint, 'action:', currentWaypoint.action);
        
        // Execute waypoint action
        if(currentWaypoint.action == 'exit_cave'){
          self.z = currentWaypoint.nextZ;
          self.x = getCenter(currentWaypoint.nextLoc[0], currentWaypoint.nextLoc[1])[0];
          self.y = getCenter(currentWaypoint.nextLoc[0], currentWaypoint.nextLoc[1])[1];
        } else if(currentWaypoint.action == 'enter_cave'){
          self.z = currentWaypoint.nextZ;
          self.x = getCenter(currentWaypoint.nextLoc[0], currentWaypoint.nextLoc[1])[0];
          self.y = getCenter(currentWaypoint.nextLoc[0], currentWaypoint.nextLoc[1])[1];
        } else if(currentWaypoint.action == 'enter_building'){
          self.z = currentWaypoint.nextZ;
          self.x = getCenter(currentWaypoint.nextLoc[0], currentWaypoint.nextLoc[1])[0];
          self.y = getCenter(currentWaypoint.nextLoc[0], currentWaypoint.nextLoc[1])[1];
        } else if(currentWaypoint.action == 'exit_building'){
          self.z = currentWaypoint.nextZ;
          self.x = getCenter(currentWaypoint.nextLoc[0], currentWaypoint.nextLoc[1])[0];
          self.y = getCenter(currentWaypoint.nextLoc[0], currentWaypoint.nextLoc[1])[1];
        } else if(currentWaypoint.action == 'go_upstairs'){
          self.z = currentWaypoint.nextZ;
        } else if(currentWaypoint.action == 'go_downstairs'){
          self.z = currentWaypoint.nextZ;
        } else if(currentWaypoint.action == 'go_to_cellar'){
          self.z = currentWaypoint.nextZ;
        } else if(currentWaypoint.action == 'go_from_cellar'){
          self.z = currentWaypoint.nextZ;
        }
        
        // Move to next waypoint
        self.currentWaypoint++;
        
        if(self.currentWaypoint < self.multiZWaypoints.length){
          var nextWaypoint = self.multiZWaypoints[self.currentWaypoint];
          self.getPath(nextWaypoint.z, nextWaypoint.loc[0], nextWaypoint.loc[1]);
          return;
        } else {
          // Finished multi-z journey
          self.multiZWaypoints = null;
          self.currentWaypoint = 0;
          self.path = null;
          self.pathCount = 0;
          return;
        }
      }
    }
    
    if(self.path){
      if(self.pathCount < self.path.length){
        var next = self.path[self.pathCount];
        
        // Check if next waypoint is still walkable (prevent getting stuck in loops)
        var currentLoc = getLoc(self.x, self.y);
        var isNextBlocked = !isWalkable(self.z, next[0], next[1]);
        var isNotAtNext = currentLoc.toString() != next.toString();
        
        // Track waypoint history to detect oscillation (back-and-forth loops)
        // Only for multi-waypoint paths - single-tile paths will naturally repeat
        var isOscillating = false;
        if(self.path.length > 1){
          if(!self.waypointHistory){
            self.waypointHistory = [];
          }
          self.waypointHistory.push(next.toString());
          if(self.waypointHistory.length > 10){
            self.waypointHistory.shift(); // Keep only last 10 waypoints
          }
          
          // Check for oscillation pattern (same waypoint appears multiple times in recent history)
          var waypointCounts = {};
          for(var i = 0; i < self.waypointHistory.length; i++){
            var wp = self.waypointHistory[i];
            waypointCounts[wp] = (waypointCounts[wp] || 0) + 1;
          }
          for(var wp in waypointCounts){
            if(waypointCounts[wp] >= 4){ // Same waypoint 4+ times in last 10 frames = oscillating
              isOscillating = true;
              break;
            }
          }
        }
        
        // Also check if we've been stuck on the same waypoint for too long
        if(!self.lastWaypoint || self.lastWaypoint.toString() != next.toString()){
          self.lastWaypoint = next;
          self.waypointStuckCounter = 0;
        } else {
          self.waypointStuckCounter = (self.waypointStuckCounter || 0) + 1;
        }
        
        // If blocked OR stuck on same waypoint OR oscillating
        if((isNextBlocked && isNotAtNext) || self.waypointStuckCounter > 60 || isOscillating){
          // OSCILLATION DETECTED - Lock in current path to prevent alternating
          if(isOscillating){
            // Mark path as locked - don't recalculate again
            if(!self.pathLocked){
              console.log((self.name || 'Entity') + ' oscillation detected, locking onto current path');
              self.pathLocked = true;
              self.waypointHistory = []; // Clear history
              // Skip this waypoint and move to next one
              self.pathCount++;
              return;
            } else {
              // Path is locked, skip problematic waypoint
              console.log((self.name || 'Entity') + ' skipping oscillating waypoint (path locked)');
              self.pathCount++;
              self.waypointHistory = []; // Clear history
              return;
            }
          }
          
          // Next waypoint is blocked/unreachable - invalidate path and recalculate
          if(!self.pathRecalcAttempts){
            self.pathRecalcAttempts = 0;
          }
          self.pathRecalcAttempts++;
          
          // Calculate distance to target to determine how many retries to allow
          var maxRetries = 3;
          if(self.pathEnd){
            var targetCoords = getCenter(self.pathEnd.loc[0], self.pathEnd.loc[1]);
            var distToTarget = self.getDistance({x: targetCoords[0], y: targetCoords[1]});
            // For close targets (< 6 tiles), allow more retries - they should be reachable
            if(distToTarget < 384){ // Less than 6 tiles
              maxRetries = 8;
            }
          }
          
          // Try to recalculate based on distance
          if(self.pathRecalcAttempts < maxRetries && self.pathEnd){
            var reason = isNextBlocked ? 'blocked' : 'stuck';
            // Only log every 3rd attempt to reduce spam
            if(self.pathRecalcAttempts % 3 == 1){
              console.log((self.name || 'Entity') + ' path ' + reason + ' at waypoint ' + next + ', recalculating... (attempt ' + self.pathRecalcAttempts + '/' + maxRetries + ')');
            }
            self.path = null;
            self.pathCount = 0;
            self.lastWaypoint = null;
            self.waypointStuckCounter = 0;
            self.waypointHistory = []; // Clear oscillation history
            self.getPath(self.pathEnd.z, self.pathEnd.loc[0], self.pathEnd.loc[1]);
            return;
          } else {
            // Give up after 3 attempts
            console.log((self.name || 'Entity') + ' path failed repeatedly, giving up');
            self.path = null;
            self.pathCount = 0;
            // Don't clear pathEnd if going home - let home action handle retry
            if(self.action != 'home'){
              self.pathEnd = null;
            }
            // If serf is working, clear their work spot so they get assigned a different one
            if(self.work && self.work.spot && (self.action == 'task' || self.action == 'build')){
              console.log((self.name || 'Entity') + ' clearing work spot after path failure at [' + self.work.spot[0] + ',' + self.work.spot[1] + '], current pos: [' + getLoc(self.x, self.y) + ']');
              self.work.spot = null;
              self.action = null; // Clear action to trigger new assignment
            }
            self.pathRecalcAttempts = 0;
            self.lastWaypoint = null;
            self.waypointStuckCounter = 0;
            self.waypointHistory = []; // Clear oscillation history
            self.pathLocked = false; // Clear lock when giving up
            return;
          }
        } else if(self.pathRecalcAttempts > 0 && isWalkable(self.z, next[0], next[1])){
          // Path is clear again, reset recalc counter
          self.pathRecalcAttempts = 0;
        }
        
        //if(self.z == 0){ // sidestep doors in path
          //var tile = getTile(0,next[0],next[1]);
          //if((tile == 14 || tile == 16) && self.path[self.path.length-1].toString() != next.toString()){
            //self.path[self.pathCount] = [next[0]+1,next[1]+1];
          //}
        //}
        var dest = getCenter(next[0],next[1]);
        var dx = dest[0];
        var dy = dest[1];
        var diffX = dx - self.x;
        var diffY = dy - self.y;

        // Clear movement keys at start of frame
        self.pressingRight = false;
        self.pressingLeft = false;
        self.pressingDown = false;
        self.pressingUp = false;

        // Move toward waypoint
        var movedThisFrame = false;
        if(diffX >= self.maxSpd){
          self.x += self.maxSpd;
          self.pressingRight = true;
          self.facing = 'right';
          movedThisFrame = true;
        } else if(diffX <= (0-self.maxSpd)){
          self.x -= self.maxSpd;
          self.pressingLeft = true;
          self.facing = 'left';
          movedThisFrame = true;
        }
        if(diffY >= self.maxSpd){
          self.y += self.maxSpd;
          self.pressingDown = true;
          self.facing = 'down';
          movedThisFrame = true;
        } else if(diffY <= (0-self.maxSpd)){
          self.y -= self.maxSpd;
          self.pressingUp = true;
          self.facing = 'up';
          movedThisFrame = true;
        }
        
        // Check if reached waypoint (both X and Y within maxSpd range)
        if((diffX < self.maxSpd && diffX > (0-self.maxSpd)) && (diffY < self.maxSpd && diffY > (0-self.maxSpd))){
          // Snap to exact waypoint position for precise tile alignment
          self.x = dx;
          self.y = dy;
          // Clear movement flags immediately when waypoint reached
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
          self.pathCount++;
          self.checkAggro();
        }
      } else {
        if(self.pathEnd){
          var loc = getLoc(self.x,self.y);
          if(self.z == self.pathEnd.z && loc.toString() == self.pathEnd.loc.toString()){
            self.pathEnd = null;
          }
        }
        self.path = null;
        self.pathCount = 0;
        self.pathRecalcAttempts = 0;
        self.lastWaypoint = null;
        self.waypointStuckCounter = 0;
        self.waypointHistory = []; // Clear oscillation history
        self.pathLocked = false; // Clear lock when path completes
        // Clear movement keys when path ends
        self.pressingRight = false;
        self.pressingLeft = false;
        self.pressingDown = false;
        self.pressingUp = false;
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
      spiritMax:self.spiritMax,
      action:self.action,
      ghost:self.ghost,
      kills:self.kills,
      skulls:self.skulls,
      spriteScale:self.spriteScale
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
      spiritMax:self.spiritMax,
      action:self.action,
      ghost:self.ghost,
      kills:self.kills,
      skulls:self.skulls,
      spriteScale:self.spriteScale
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
  return self;
}

Deer = function(param){
  var self = Character(param);
  self.class = 'Deer';
  self.aggroRange = 256;
  self.stealthCheck = function(p){
    if(p.stealthed){
      var dist = self.getDistance({x:p.x,y:p.y});
      if(dist <= 256){
        Player.list[p.id].revealed = true;
      }
    }
  }
  self.checkAggro = function(){
    for(var i in self.zGrid){
      var zc = self.zGrid[i][0];
      var zr = self.zGrid[i][1];
      if(zc < 64 && zc > -1 && zr < 64 && zr > -1){
        const zoneKey = `${zc},${zr}`;
        const zoneEntities = zones.get(zoneKey) || new Set();
        for(const entityId of zoneEntities){
          var p = Player.list[entityId];
          if(p && p.z == self.z){
            var pDist = self.getDistance({
              x:p.x,
              y:p.y
            });
            if(pDist <= self.aggroRange && p.class != 'Deer'){
              self.stealthCheck(p);
              if(!Player.list[p.id].stealthed || Player.list[p.id].revealed){ // is not stealthed or is revealed
                self.combat.target = p.id;
                self.action = 'flee';
              }
            }
          }
        }
      }
    }
  }

  setInterval(function(){
    if(global.simpleCombat){
      global.simpleCombat.checkAggro(self);
    } else {
    self.checkAggro();
    }
  },100); // Check every 100ms for faster response

  self.return = function(){
    if(!self.path){
      if(self.innaWoods){
        self.action = null;
      } else {
        self.moveTo(self.home.z,self.home.loc[0],self.home.loc[1]);
      }
    }
  }

  self.update = function(){
    var loc = getLoc(self.x,self.y);
    self.zoneCheck();
    if(self.idleTime > 0){
      self.idleTime--;
    }

    if(getTile(0,loc[0],loc[1]) >= 1 && getTile(0,loc[0],loc[1]) < 2){
      self.innaWoods = true;
      self.onMtn = false;
    } else if(getTile(0,loc[0],loc[1]) >= 2 && getTile(0,loc[0],loc[1]) < 4){
      self.innaWoods = false;
      self.onMtn = false;
    } else if(getTile(0,loc[0],loc[1]) >= 4 && getTile(0,loc[0],loc[1]) < 5){
      self.innaWoods = false;
      self.onMtn = false;
    } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && !self.onMtn){
      self.innaWoods = false;
      self.maxSpd = self.baseSpd * 0.2;
      setTimeout(function(){
        if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6){
          self.onMtn = true;
        }
      },2000);
    } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && self.onMtn){
      self.maxSpd = self.baseSpd;
    } else if(getTile(0,loc[0],loc[1]) == 18){
      self.innaWoods = false;
      self.onMtn = false;
      self.maxSpd = self.baseSpd * 1.1;
    } else if(getTile(0,loc[0],loc[1]) == 0){
      self.z = -3;
      self.innaWoods = false;
      self.onMtn = false;
      self.maxSpd = self.baseSpd * 0.1;
    } else {
      self.innaWoods = false;
      self.onMtn = false;
      self.maxSpd = self.baseSpd;
    }

    if(self.mode == 'idle'){
      if(!self.action){
        self.baseSpd = 4;
        if(!self.innaWoods){
          if(!self.path){
            self.return();
          }
        } else if(self.idleTime == 0){
          if(!self.path){
            var col = loc[0];
            var row = loc[1];
            var select = [[col,row-1],[col-1,row],[col,row+1],[col+1,row]];
            var target = select[Math.floor(Math.random() * 4)];
            if(target[0] < mapSize && target[0] > -1 && target[1] < mapSize && target[1] > -1){
              if(isWalkable(self.z,target[0],target[1])){
                self.move(target);
                self.idleTime += Math.floor(Math.random() * self.idleRange);
              }
            }
          }
        }
      } else if(self.action == 'combat'){
        self.action = 'flee';
      } else if(self.action == 'flee'){
        // Use SimpleFlee system for reliable fleeing
        if(global.simpleFlee){
          global.simpleFlee.update(self);
        } else {
          // Fallback: clear flee if no system available
          self.action = null;
          self.combat.target = null;
          self.baseSpd = 2;
        }
      }
    }
    self.updatePosition();
  }
  return self;
}

Boar = function(param){
  var self = Character(param);
  self.class = 'Boar';
  self.baseSpd = 5;
  self.damage = 12;
  self.aggroRange = 128;
  self.wanderRange = 256; // Tight leash - territorial defense (2x aggro range)
  return self;
}

Wolf = function(param){
  var self = Character(param);
  self.class = 'Wolf';
  self.baseSpd = 5;
  self.damage = 10;
  self.wanderRange = 4096; // Increased 4x from 1024 (64 tiles)
  self.aggroRange = 256; // Set initial aggro range
  self.nightmode = true;
  self.stealthCheck = function(p){
    if(p.stealthed){
      var dist = self.getDistance({x:p.x,y:p.y});
      if(dist <= 256){
        Player.list[p.id].revealed = true;
      }
    }
  }
  self.checkAggro = function(){
    // Use SimpleCombat for wolf aggro
    if(global.simpleCombat){
      global.simpleCombat.checkAggro(self);
    } else {
      // Fallback to old wolf aggro logic
    for(var i in self.zGrid){
      var zc = self.zGrid[i][0];
      var zr = self.zGrid[i][1];
      if(zc < 64 && zc > -1 && zr < 64 && zr > -1){
          const zoneKey = `${zc},${zr}`;
          const zoneEntities = zones.get(zoneKey) || new Set();
          for(const entityId of zoneEntities){
            var p = Player.list[entityId];
          if(p && p.z == self.z){
            var pDist = self.getDistance({
              x:p.x,
              y:p.y
            });
            if(pDist <= self.aggroRange){ // in aggro range
              if(p.class != 'Wolf'){
                self.stealthCheck(p);
                if(!Player.list[p.id].stealthed || Player.list[p.id].revealed){ // is not stealthed or is revealed
                  self.combat.target = p.id;
                  if(self.hp < (self.hpMax * 0.1)){
                    self.action = 'flee';
                  } else {
                    self.action = 'combat';
                  }
                  if(p.type == 'npc' && pDist <= p.aggroRange && p.action != 'combat'){
                    Player.list[p.id].combat.target = self.id;
                    Player.list[p.id].action = 'combat';
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  setInterval(function(){
    if(global.simpleCombat){
      global.simpleCombat.checkAggro(self);
    } else {
    self.checkAggro();
    }
  },100); // Check every 100ms for faster response

  self.update = function(){
    var loc = getLoc(self.x,self.y);
    self.zoneCheck();
    if(nightfall){
      self.nightmode = true;
      self.aggroRange = 320; // Slightly more aggressive at night
      self.idleRange = 300;
    } else {
      self.nightmode = false;
      self.aggroRange = 256; // Standard range during day
      self.idleRange = 1000;
    }
    if(self.idleTime > 0){
      self.idleTime--;
    }
    if(self.z == 0){
      if(getTile(0,loc[0],loc[1]) >= 1 && getTile(0,loc[0],loc[1]) < 2){
        self.innaWoods = true;
        self.onMtn = false;
      } else if(getTile(0,loc[0],loc[1]) >= 2 && getTile(0,loc[0],loc[1]) < 4){
        self.innaWoods = false;
        self.onMtn = false;
      } else if(getTile(0,loc[0],loc[1]) >= 4 && getTile(0,loc[0],loc[1]) < 5){
        self.innaWoods = false;
        self.onMtn = false;
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && !self.onMtn){
        self.innaWoods = false;
        self.maxSpd = (self.baseSpd * 0.2) * self.drag;
        setTimeout(function(){
          if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6){
            self.onMtn = true;
          }
        },2000);
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && self.onMtn){
        self.maxSpd = self.baseSpd * self.drag;
      } else if(getTile(0,loc[0],loc[1]) == 6){
        self.caveEntrance = loc;
        self.z = -1;
        // DON'T clear path - it needs to persist through z-transition
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * self.drag;
      } else if(getTile(0,loc[0],loc[1]) == 18){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * self.drag;
      } else if(getTile(0,loc[0],loc[1]) == 0){
        self.z = -3;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.1) * self.drag;
      } else {
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * self.drag;
      }
    } else if(self.z == -1){
      if(getTile(1,loc[0],loc[1]) == 2){
        // On cave exit tile - only exit if path is complete (no active navigation)
        // This universal rule works for all entities without special cases
        if(!self.path || self.path.length === 0){
        self.caveEntrance = null;
        self.z = 0;
          self.path = null;
          self.pathCount = 0;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.9)  * self.drag;
        }
      }
    }

    if(!self.action){
      self.baseSpd = 5;
      if(!self.nightmode && self.z == 0){
        var t = getTile(0,loc[0],loc[1]);
        if(t >= 2 && !self.path){
          self.return();
        } else {
          if(self.idleTime == 0){
            if(!self.path){
              var col = loc[0];
              var row = loc[1];
              var select = [[col,row-1],[col-1,row],[col,row+1],[col+1,row]];
              var target = select[Math.floor(Math.random() * 4)];
              if(target[0] < mapSize && target[0] > -1 && target[1] < mapSize && target[1] > -1){
                if(isWalkable(self.z,target[0],target[1])){
                  self.move(target);
                  self.idleTime += Math.floor(Math.random() * self.idleRange);
                }
              }
            }
          }
        }
      } else {
        if(self.idleTime == 0){
          if(!self.path){
            var col = loc[0];
            var row = loc[1];
            var select = [[col,row-1],[col-1,row],[col,row+1],[col+1,row]];
            var target = select[Math.floor(Math.random() * 4)];
            if(target[0] < mapSize && target[0] > -1 && target[1] < mapSize && target[1] > -1){
              if(isWalkable(self.z,target[0],target[1])){
                self.move(target);
                self.idleTime += Math.floor(Math.random() * self.idleRange);
              }
            }
          }
        }
      }
    } else if(self.action == 'combat'){
      // Use SimpleCombat for wolf combat
      if(global.simpleCombat){
        global.simpleCombat.update(self);
      } else {
        // Fallback to old wolf combat logic
      if(self.nightmode){
        self.baseSpd = 7;
      } else {
        self.baseSpd = 6;
      }
      var target = Player.list[self.combat.target];
      if(target){
        if(target.hasTorch || getTile(target.z == 1)){
          self.combat.target = null;
          self.action = null;
          if(target.combat.target == self.id){
            Player.list[target.id].combat.target = null;
            Player.list[target.id].action = null;
          }
        } else {
          // Check leash range - don't chase too far from home
          var homeCoords = getCenter(self.home.loc[0], self.home.loc[1]);
          var homeDist = self.getDistance({x: homeCoords[0], y: homeCoords[1]});
          var leashRange = self.wanderRange || 2048; // Default 32 tiles (4x increase)
          
          if(homeDist > leashRange){
            // Too far from home - disengage and return
            console.log(self.class + ' exceeded leash range, returning home');
            self.combat.target = null;
            self.action = 'returning'; // Set returning state to prevent re-aggro
            self.baseSpd = 5;
            if(target.combat.target == self.id){
              Player.list[target.id].combat.target = null;
              Player.list[target.id].action = null;
            }
            self.return(); // Go back home
        } else {
          self.follow(target,true);
          var tDist = self.getDistance({
            x:target.x,
            y:target.y
          });
          if(tDist > self.aggroRange * 1.5){
            self.combat.target = null;
            self.action = null;
            self.baseSpd = 5;
            if(target.combat.target == self.id){
              Player.list[target.id].combat.target = null;
              Player.list[target.id].action = null;
              }
            }
          }
        }
      } else {
        self.combat.target = null;
        self.action = null;
        }
      }
    } else if(self.action == 'flee'){
      // Use SimpleFlee system for reliable fleeing
      if(global.simpleFlee){
        global.simpleFlee.update(self);
      } else {
        // Fallback to old reposition logic
        if(!self.path){
          if(self.combat.target){
            var target = Player.list[self.combat.target];
            if(target){
              self.baseSpd = 6;
              var tLoc = getLoc(target.x,target.y);
              self.reposition(loc,tLoc);
            } else {
              self.combat.target = null;
              self.action = null;
            }
          } else {
            self.action = null;
          }
        }
      }
    } else if(self.action == 'returning'){
      // Returning home after leashing - check if we're back within leash range
      if(self.home && self.home.loc){
        var homeCoords = getCenter(self.home.loc[0], self.home.loc[1]);
        var homeDist = self.getDistance({x: homeCoords[0], y: homeCoords[1]});
        var leashRange = self.wanderRange || 2048;
        
        if(homeDist <= leashRange * 0.5){
          // Back within safe range - resume normal behavior
          console.log(self.class + ' returned home successfully');
          self.action = null;
          self.path = null;
          self.pathCount = 0;
        } else if(!self.path){
          // No path and still far - move home
          self.return();
        }
      } else {
        self.action = null;
      }
    }
    self.updatePosition();
  }
  return self;
}

Falcon = function(param){
  var self = Character(param);
  self.class = 'Falcon';
  self.falconry = param.falconry;
  self.hp = null;
  self.baseSpd = 1;
  self.maxSpd = 1;
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
        self.x += self.maxSpd * (1);
        self.y += self.maxSpd * (1);
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
        self.x += self.maxSpd * (1);
        self.y -= self.maxSpd * (1);
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
        self.x -= self.maxSpd * (1);
        self.y += self.maxSpd * (1);
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
        self.x -= self.maxSpd * (1);
        self.y -= self.maxSpd * (1);
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
        self.x += self.maxSpd * (1);
        self.pressingRight = true;
        self.pressingLeft = false;
        self.pressingDown = false;
        self.pressingUp = false;
        self.facing = 'right';
      } else if(diffX <= (0-self.maxSpd)){
        self.x -= self.maxSpd * (1);
        self.pressingRight = false;
        self.pressingLeft = true;
        self.pressingDown = false;
        self.pressingUp = false;
        self.facing = 'left';
      } else if(diffY >= self.maxSpd){
        self.y += self.maxSpd * (1);
        self.pressingRight = false;
        self.pressingLeft = false;
        self.pressingDown = true;
        self.pressingUp = false;
        self.facing = 'down';
      } else if(diffY <= (0-self.maxSpd)){
        self.y -= self.maxSpd * (1);
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
  return self;
}

// UNITS

SerfM = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'SerfM';
  self.sex = 'm';
  self.spriteSize = tileSize*1.5;
  self.unarmed = true;
  self.tether = null; // {z,loc}
  self.tavern = param.tavern;
  self.hut = param.hut;
  self.work = param.work || {hq:null,spot:null}; // Preserve work HQ from tavern spawn
  self.dayTimer = false;
  self.workTimer = false;
  self.idleCounter = 0; // Track how long serf has been without action
  self.lastPos = {x: param.x, y: param.y}; // Track position for stuck detection
  self.stuckCounter = 0; // Count frames stuck in same position

  // Assign Serf to appropriate work building
  self.assignWorkHQ = function(){
    if(!self.house) return;
    
    var bestHQ = null;
    var bestDistance = Infinity;
    
    // Look for work buildings in the same house
    for(var i in Building.list){
      var b = Building.list[i];
      if(b.house == self.house && (b.type == 'mill' || b.type == 'lumbermill' || b.type == 'mine')){
        var dist = getDistance({x:self.x,y:self.y},{x:b.x,y:b.y});
        if(dist < bestDistance){
          bestDistance = dist;
          bestHQ = i;
        }
      }
    }
    
    if(bestHQ){
      self.work.hq = bestHQ;
      var buildingType = Building.list[bestHQ].type;
      console.log(self.name + ' assigned to work at ' + buildingType);
      
      // Only miners need torches for caves
      if(buildingType === 'mine' && Building.list[bestHQ].cave){
        self.torchBearer = true;
        console.log(self.name + ' is now a torch bearer (ore miner)');
      } else {
        self.torchBearer = false;
      }
    } else {
      console.log(self.name + ' no work buildings found for house ' + self.house);
    }
  };

  // Initialize Serf properly
  self.initializeSerf = function(){
    // Use new behavior system for initialization
    if (global.serfBehaviorSystem) {
      global.serfBehaviorSystem.initializeSerf(self);
    } else {
      // Fallback to old initialization
      if(!self.work.hq){
        self.assignWorkHQ();
      } else {
        // Work HQ was provided by tavern spawn, set torchBearer appropriately (for miners)
        if(self.sex == 'm'){
          var buildingType = Building.list[self.work.hq].type;
          if(buildingType === 'mine' && Building.list[self.work.hq].cave){
            self.torchBearer = true;
            console.log(self.name + ' is now a torch bearer (ore miner)');
          } else {
            self.torchBearer = false;
          }
        }
      }
      
      if(!self.tavern){
        self.findTavern();
      }
      
      if(!self.mode){
        self.mode = 'idle';
      }
      
      console.log(self.name + ' initialized - HQ: ' + (self.work.hq ? Building.list[self.work.hq].type : 'none') + 
                  ', Tavern: ' + (self.tavern ? 'yes' : 'no') + ', Mode: ' + self.mode);
    }
  };

  // Find nearest tavern
  self.findTavern = function(){
    if(!self.house) return;
    
    var bestTavern = null;
    var bestDistance = Infinity;
    
    for(var i in Building.list){
      var b = Building.list[i];
      if(b.type == 'tavern' && b.house == self.house){
        var dist = getDistance({x:self.x,y:self.y},{x:b.x,y:b.y});
        if(dist < bestDistance && dist <= 1280){ // Within reasonable distance
          bestDistance = dist;
          bestTavern = i;
        }
      }
    }
    
    if(bestTavern){
      self.tavern = bestTavern;
      console.log(self.name + ' found tavern ' + bestTavern);
    } else {
      console.log(self.name + ' no tavern found for house ' + self.house);
    }
  };

  // Initialize the Serf
  self.initializeSerf();

  self.update = function(){
    // Use SIMPLIFIED behavior system - just handles basic movement and exits
    if (global.simpleSerfBehavior) {
      global.simpleSerfBehavior.update(self);
    }
    
    var loc = getLoc(self.x,self.y);
    self.zoneCheck();
    
    // Torch bearer logic - auto-light torch in caves or at night
    if(self.torchBearer){
      if(!self.hasTorch){
        if((self.z == 0 && nightfall) || self.z == -1 || self.z == -2){
          self.lightTorch(Math.random());
        }
      }
    }

    if(self.z == 0){
      if(getTile(0,loc[0],loc[1]) == 6){
        // At cave entrance - set state
        self.transitionState = 'at_entrance';
        
        // Check intent to enter cave
        if(self.transitionIntent === 'enter_cave' && (!self.path || self.path.length === 0)){
          self.enterCave(loc);
        }
      } else if(getTile(0,loc[0],loc[1]) >= 1 && getTile(0,loc[0],loc[1]) < 2){
        self.innaWoods = true;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.3) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) >= 2 && getTile(0,loc[0],loc[1]) < 4){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.5) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) >= 4 && getTile(0,loc[0],loc[1]) < 5){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.6) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && !self.onMtn){
        self.innaWoods = false;
        self.maxSpd = (self.baseSpd * 0.2) * self.drag;
        setTimeout(function(){
          if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6){
            self.onMtn = true;
          }
        },2000);
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && self.onMtn){
        self.maxSpd = (self.baseSpd * 0.5) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) == 18){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 1.1) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) == 14 || getTile(0,loc[0],loc[1]) == 16 || getTile(0,loc[0],loc[1]) == 19){
        var b = getBuilding(self.x,self.y);
        if(Building.list[b]){
        Building.list[b].occ++;
        self.z = 1;
        // DON'T clear path - preserve for navigation through buildings
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * self.drag;
          console.log(self.name + ' entered building ' + Building.list[b].type + ' (z=1)');
        }
      } else if(getTile(0,loc[0],loc[1]) == 0){
        self.z = -3;
        // DON'T clear path - preserve for underwater navigation
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.2)  * self.drag;
        // Clear movement to prevent loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      } else {
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd  * self.drag;
      }
    } else if(self.z == -1){
      if(getTile(1,loc[0],loc[1]) == 2){
        // On cave exit tile - only exit if path is complete (no active navigation)
        // This universal rule works for all entities without special cases
        if(!self.path || self.path.length === 0){
        self.caveEntrance = null;
        self.z = 0;
          // Clear path on successful exit (but this was already null/empty)
        self.path = null;
        self.pathCount = 0;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.9)  * self.drag;
        // Clear movement to prevent loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
        }
        // If there IS a path, don't exit - continue into cave
      }
    } else if(self.z == -2){
      if(getTile(8,loc[0],loc[1]) == 5){
        self.z = 1;
        // DON'T clear path - preserve for cross-floor navigation
        self.y += (tileSize/2);
        self.facing = 'down';
        // Clear movement to prevent infinite stair loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
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
      if(getTile(0,loc[0],loc[1]) != 0){
        self.z = 0;
        // DON'T clear path - preserve for navigation after surfacing
        self.breath = self.breathMax;
        // Clear movement to prevent loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      }
    } else if(self.z == 1){
      if(getTile(0,loc[0],loc[1] - 1) == 14 || getTile(0,loc[0],loc[1] - 1) == 16  || getTile(0,loc[0],loc[1] - 1) == 19){
        var exit = getBuilding(self.x,self.y-tileSize);
        if(Building.list[exit]){
        Building.list[exit].occ--;
          console.log(self.name + ' exited building ' + Building.list[exit].type + ' (z=1 -> z=0)');
        }
        self.z = 0;
        // DON'T clear path - preserve for navigation after exiting building
        // Clear movement to prevent loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      } else if(getTile(4,loc[0],loc[1]) == 3 || getTile(4,loc[0],loc[1]) == 4 || getTile(4,loc[0],loc[1]) == 7){
        self.z = 2;
        // DON'T clear path - preserve for multi-floor navigation
        self.y += (tileSize/2);
        self.facing = 'down';
        // Clear movement to prevent infinite stair loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      } else if(getTile(4,loc[0],loc[1]) == 5 || getTile(4,loc[0],loc[1]) == 6){
        self.z = -2;
        // DON'T clear path - preserve for cellar navigation
        self.y += (tileSize/2);
        self.facing = 'down';
        // Clear movement to prevent infinite stair loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      }
    } else if(self.z == 2){
      if(getTile(4,loc[0],loc[1]) == 3 || getTile(4,loc[0],loc[1]) == 4){
        // At downstairs tile - set state
        self.transitionState = 'at_entrance';
        
        // Check intent to go downstairs
        if(self.transitionIntent === 'go_downstairs'){
          self.goDownstairs(1);
        }
      }
    }

    // Improved day/night transition logic
    if(tempus == 'VI.a' && self.mode != 'work' && !self.dayTimer){
      self.dayTimer = true;
      var rand = Math.floor(Math.random() * (3600000/(period*6)));
      console.log(self.name + ' will start work in ' + (rand/1000).toFixed(1) + ' seconds (tempus=' + tempus + ', currentMode=' + self.mode + ')');
      setTimeout(function(){
        if(self.mode != 'work'){ // Double-check mode hasn't changed
        self.mode = 'work';
        self.action = null;
          self.work.spot = null; // Clear previous work spot
        console.log('✅ ' + self.name + ' SWITCHED TO WORK MODE (z=' + self.z + ', pos=' + self.x + ',' + self.y + ', sex=' + self.sex + ')');
        }
        self.dayTimer = false;
      },rand);
    } else if(tempus == 'VI.p' && (self.action == 'task' || self.action == 'build') && !self.dayTimer){
      self.dayTimer = true;
      var rand = Math.floor(Math.random() * (3600000/(period*6)));
      setTimeout(function(){
        if(self.action == 'task' || self.action == 'build'){
        self.action = 'clockout';
        self.work.spot = null;
        console.log(self.name + ' is clocking out');
        }
        self.dayTimer = false;
      },rand);
    } else if(tempus == 'XI.p' && (self.action == 'tavern' || self.action == 'clockout') && !self.dayTimer){
      self.dayTimer = true;
      var rand = Math.floor(Math.random() * (3600000/(period/2)));
      setTimeout(function(){
        if(self.action == 'tavern' || self.action == 'clockout'){
        self.tether = null;
          self.action = 'home';
          self.mode = 'idle';
        console.log(self.name + ' heads home for the night');
        }
        self.dayTimer = false;
      },rand);
    }

    if(self.idleTime > 0){
      self.idleTime--;
    }

    // STUCK DETECTION - Check if Serf hasn't moved in a while
    var dist = Math.sqrt(Math.pow(self.x - self.lastPos.x, 2) + Math.pow(self.y - self.lastPos.y, 2));
    
    // Only count as stuck if we have a path but aren't moving
    if(self.path && self.pathCount < self.path.length && dist < 2){ // Moved less than 2 pixels
      self.stuckCounter++;
      if(self.stuckCounter > 180){ // Stuck for 3 seconds at 60fps
        console.log(self.name + ' stuck with active path - clearing (z=' + self.z + ', pathCount=' + self.pathCount + '/' + self.path.length + ')');
        self.path = null;
        self.pathCount = 0;
          self.action = null;
        self.work.spot = null;
        self.stuckCounter = 0;
        // Clear movement keys
        self.pressingRight = false;
        self.pressingLeft = false;
        self.pressingDown = false;
        self.pressingUp = false;
        // Reset idle time so serf can pick new destination quickly
        self.idleTime = 0;
      }
    } else {
      self.stuckCounter = 0; // Reset if moved or no path
    }
    self.lastPos = {x: self.x, y: self.y};

    // SIMPLIFIED HOUSE BUILDING - Male serfs build their hut when work begins
    if(self.mode == 'work'){
      
      // Check if serf needs to build their hut
      if(!self.action){
        if(!self.hut || !Building.list[self.hut]){
          console.log(self.name + ' ERROR: has no hut assigned, switching to idle');
          self.mode = 'idle';
          return;
        }
        
        var hut = Building.list[self.hut];
        console.log('🏠 ' + self.name + ' checking hut ' + self.hut + ': built=' + hut.built + ', plot=' + (hut.plot ? hut.plot.length : 'none'));
        
        // If hut is not built yet, build it first
        if(!hut.built){
                  var select = [];
          for(var i in hut.plot){
            var p = hut.plot[i];
            var t = getTile(0, p[0], p[1]);
            console.log('  🔍 Checking plot tile [' + p[0] + ',' + p[1] + ']: tile=' + t);
            if(t == 11){ // Foundation tile that needs building
                      select.push(p);
                    }
                  }
          
          console.log('🏗️ ' + self.name + ' hut NOT built, found ' + select.length + ' foundation tiles (type 11)');
          
                  if(select.length > 0){
                    self.work.spot = select[Math.floor(Math.random() * select.length)];
                    self.action = 'build';
            console.log('✅ ' + self.name + ' ASSIGNED to build hut at [' + self.work.spot[0] + ',' + self.work.spot[1] + ']');
          } else {
            console.log('❌ ' + self.name + ' ERROR: hut not built but no foundation tiles found!');
            self.mode = 'idle';
            self.action = null;
          }
        } else {
          // Hut is built, transition to economic work
          console.log('✅ ' + self.name + ' hut is complete, transitioning to economic work');
          
          // Make sure serf has a work assignment
          if(!self.work.hq){
            console.log('🏢 ' + self.name + ' has no work.hq, attempting to assign...');
            self.assignWorkHQ();
          }
          
          // If serf has a work assignment, assign a work spot and task action
          if(self.work.hq && Building.list[self.work.hq]){
            var hq = Building.list[self.work.hq];
            
            // Don't assign new task if serf has resources to deposit
            var hasResourcesToDeposit = self.inventory.wood >= 1 || self.inventory.stone >= 1 || 
                                        self.inventory.ironore >= 1 || self.inventory.silverore >= 1 || 
                                        self.inventory.goldore >= 1 || self.inventory.diamond >= 1 ||
                                        self.inventory.grain >= 1;
            
            if(hasResourcesToDeposit){
              // Set action to 'task' but don't assign new spot - let deposit logic handle it
              self.action = 'task';
              console.log('📦 ' + self.name + ' has resources to deposit, setting task mode without new spot');
            }
            // Assign a work spot from hq resources (same logic as SerfF)
            else if(hq.resources && hq.resources.length > 0){
              var tDist = 0;
              var avgDist = null;
              for(var i in hq.resources){
                var res = hq.resources[i];
                var r = getCenter(res[0],res[1]);
                var dist = getDistance({x:hq.x,y:hq.y},{x:r[0],y:r[1]});
                tDist += dist;
              }
              avgDist = tDist/hq.resources.length;
          var select = [];
          for(var i in hq.resources){
            var res = hq.resources[i];
            var r = getCenter(res[0],res[1]);
            var dist = getDistance({x:hq.x,y:hq.y},{x:r[0],y:r[1]});
                if(dist <= avgDist){
              select.push(res);
            }
          }
          
          // Check if any spots were found
          if(select.length > 0){
            self.work.spot = select[Math.floor(Math.random() * select.length)];
            Building.list[self.work.hq].log[self.id] = self.work.spot;
            self.action = 'task';
            console.log('🔨 ' + self.name + ' assigned to task at ' + hq.type + ' spot [' + self.work.spot[0] + ',' + self.work.spot[1] + ']');
          } else {
            console.log('⚠️ ' + self.name + ' no nearby resources found, switching to idle');
            self.mode = 'idle';
            self.action = null;
          }
          } else {
              console.log('⚠️ ' + self.name + ' work HQ has no resources available, switching to idle');
              self.mode = 'idle';
              self.action = null;
          }
        } else {
            console.log('⚠️ ' + self.name + ' has no valid work assignment, switching to idle');
            self.mode = 'idle';
            self.action = null;
          }
        }
      } else if(self.action == 'build'){
        var spot = self.work.spot;
        if(spot){
          var cs = getCenter(spot[0],spot[1]);
          var build = getBuilding(cs[0],cs[1]);
          if(Building.list[build].built){
            self.work.spot = null;
            self.action = null;
          } else {
            if(loc.toString() == spot.toString()){
                var gt = getTile(0,spot[0],spot[1]);
                if(gt == 11){
                  if(!self.building){
                    Build(self.id);
                  }
                } else {
                  var plot = Building.list[build].plot;
                  var select = [];
                  for(var i in plot){
                    var p = plot[i];
                    var t = getTile(0,p[0],p[1]);
                    if(t == 11){
                      select.push(p);
                    }
                  }
                  self.work.spot = select[Math.floor(Math.random() * select.length)];
                }
            } else {
              if(!self.path){
                self.moveTo(0,spot[0],spot[1]);
              }
            }
          }
        } else {
          self.action = null;
        }
      } else if(self.action == 'task'){
        var spot = self.work.spot;
          var hq = Building.list[self.work.hq];
        
        // Allow task action without spot if serf has resources to deposit
        var hasResourcesToDeposit = self.inventory.wood >= 1 || self.inventory.stone >= 1 || 
                                    self.inventory.ironore >= 1 || self.inventory.silverore >= 1 || 
                                    self.inventory.goldore >= 1 || self.inventory.diamond >= 1 ||
                                    self.inventory.grain >= 1;
        
        if(!spot && !hasResourcesToDeposit){
          self.action = null;
        } else if(hq) {
          if(hq.type == 'mill'){
            if(self.inventory.grain >= 1){
              var b = Building.list[self.work.hq];
              var dropoff = [b.plot[0][0],b.plot[0][1]+1];
              if(loc.toString() == dropoff.toString()){
                self.facing = 'up';
                var totalGrain = self.inventory.grain;
                var buildingShare = Math.floor(totalGrain * 0.85); // 85% to building
                var serfWage = totalGrain - buildingShare;         // 15% wage for serf
                
                self.inventory.grain = 0;
                self.stores.grain = (self.stores.grain || 0) + serfWage; // Keep wage
                
                if(House.list[b.owner]){
                  House.list[b.owner].stores.grain += buildingShare;
                  console.log(House.list[b.owner].name + ' +' + buildingShare + ' Grain (' + self.name + ' kept ' + serfWage + ' as wage)');
                } else if(Player.list[b.owner].house){
                  var h = Player.list[b.owner].house;
                  House.list[h].stores.grain += buildingShare;
                  console.log(House.list[h].name + ' +' + buildingShare + ' Grain (' + self.name + ' kept ' + serfWage + ' as wage)');
                } else {
                  Player.list[b.owner].stores.grain += buildingShare;
                  console.log(Player.list[b.owner].name + ' +' + buildingShare + ' Grain (' + self.name + ' kept ' + serfWage + ' as wage)');
                }
                // Track daily deposits (building share only)
                if(!b.dailyStores) b.dailyStores = {grain: 0};
                b.dailyStores.grain += buildingShare;
                
                // Convert deposited grain to flour (3:1 ratio - uses building's share only)
                self.inventory.flour += Math.floor(buildingShare / 3);
              } else {
                if(!self.path){
                  self.moveTo(0,dropoff[0],dropoff[1]);
                }
              }
            } else {
              if(loc.toString() == spot.toString()){
                var tile = getTile(0,spot[0],spot[1]);
                self.working = true;
                self.farming = true;
                if(!self.workTimer){
                  self.workTimer = true;
                  setTimeout(function(){
                    if(self.farming){
                      var b = getBuilding(self.x,self.y);
                      var f = Building.list[b];
                      // Safety check: ensure farm building still exists
                      if(!f || !f.plot){
                        console.log(self.name + ' farm building no longer exists, stopping work');
                        self.workTimer = false;
                        self.working = false;
                        self.farming = false;
                        return;
                      }
                      if(tile == 8){
                        tileChange(6,spot[0],spot[1],1,true);
                        var count = 0;
                        var next = [];
                        for(var i in f.plot){
                          var p = f.plot[i];
                          if(getTile(6,p[0],p[1]) >= 5){
                            count++;
                          } else {
                            next.push(p);
                          }
                        }
                        if(count == 9){
                          for(var i in f.plot){
                            var p = f.plot[i];
                            tileChange(0,p[0],p[1],9);
                          }
                          // Tile update automatically handled by tileChange function
                        } else {
                          var res = getTile(6,spot[0],spot[1]);
                          if(res >= 5){
                            for(var n in hq.resources){
                              var r = hq.resources[n];
                              if(r.toString() == spot.toString()){
                                Building.list[self.work.hq].resources.splice(n,1);
                              }
                            }
                          }
                          var rand = Math.floor(Math.random() * next.length);
                          self.work.spot = next[rand];
                          Building.list[self.work.hq].log[self.id] = self.work.spot;
                        }
                      } else if(tile == 9){
                        tileChange(6,spot[0],spot[1],1,true);
                        var count = 0;
                        var next = [];
                        for(var i in f.plot){
                          var p = f.plot[i];
                          if(getTile(6,p[0],p[1]) >= 10){
                            count++;
                          }
                        }
                        if(count == 9){
                          for(var i in f.plot){
                            var p = f.plot[i];
                            tileChange(0,p[0],p[1],10);
                            tileChange(6,p[0],p[1],10); // Initialize harvest with 10 resources
                          }
                          // Tile update automatically handled by tileChange function
                        } else {
                          var res = getTile(6,spot[0],spot[1]);
                          if(res >= 10){
                            for(var n in hq.resources){
                              var r = hq.resources[n];
                              if(r.toString() == spot.toString()){
                                Building.list[self.work.hq].resources.splice(n,1);
                              }
                            }
                          }
                          var rand = Math.floor(Math.random() * next.length);
                          self.work.spot = next[rand];
                          Building.list[self.work.hq].log[self.id] = self.work.spot;
                        }
                      } else {
                        tileChange(6,spot[0],spot[1],-1,true);
                        if(getTile(6,spot[0],spot[1]) == 0){
                          tileChange(0,spot[0],spot[1],8);
                          var count = 0;
                          var next = [];
                          for(var i in f.plot){
                            var p = f.plot[i]
                            var t = getTile(0,p[0],p[1]);
                            if(t == 8){
                              count++;
                            } else {
                              next.push(p);
                            }
                          }
                          if(count == 9){
                            for(var n in f.plot){
                              var p = f.plot[n];
                              if(p.toString() == spot.toString()){
                                continue;
                              } else {
                                Building.list[self.work.hq].resources.push(p);
                              }
                            }
                          } else {
                            for(var n in hq.resources){
                              var r = hq.resources[n];
                              if(r.toString() == spot.toString()){
                                Building.list[self.work.hq].resources.splice(n,1);
                              }
                            }
                            var rand = Math.floor(Math.random() * next.length);
                            self.work.spot = next[rand];
                            Building.list[self.work.hq].log[self.id] = self.work.spot;
                          }
                        }
                        // Tile update automatically handled by tileChange function
                      }
                    }
                    self.workTimer = false;
                    self.working = false;
                    self.farming = false;
                  },10000/self.strength);
                }
              } else {
                if(!self.path){
                  self.moveTo(0,spot[0],spot[1]);
                }
              }
            }
          } else if(hq.type == 'lumbermill'){
            var spot = self.work.spot;
            
            // If no spot and no wood, we need a new assignment - don't clear action
            if(!spot && self.inventory.wood < 1){
              // Just log and continue - spot will be assigned by mode logic
              console.log(self.name + ' at lumbermill needs spot assignment');
              // Don't clear action or return - let the flow continue
            }
            
            // Only check tile validity when at the spot (to avoid premature clearing)
            if(spot && loc.toString() == spot.toString() && !self.workTimer){
            var gt = getTile(0,spot[0],spot[1]);
            if(gt >= 3){
                // Tree is gone, clear spot and remove from resources
                console.log(self.name + ' tree at spot [' + spot + '] is gone, clearing');
                var depletedSpot = spot.toString(); // Store before nulling
              self.work.spot = null;
                spot = null;
              for(var i in hq.resources){
                var f = hq.resources[i];
                  if(f && f.toString() == depletedSpot){
                  Building.list[self.work.hq].resources.splice(i,1);
                }
              }
                // Continue to get new assignment
              }
            }
            if(self.inventory.wood >= 1){
              // Clear work spot - we're depositing, not gathering
              self.work.spot = null;
              var b = Building.list[self.work.hq];
              var dropoff = [b.plot[0][0],b.plot[0][1]+1];
              if(loc.toString() == dropoff.toString()){
                self.facing = 'up';
                var totalWood = self.inventory.wood;
                var buildingShare = Math.floor(totalWood * 0.85); // 85% to building
                var serfWage = totalWood - buildingShare;         // 15% wage for serf
                
                self.inventory.wood = 0;
                self.stores.wood = (self.stores.wood || 0) + serfWage; // Keep wage
                
                if(House.list[b.owner]){
                  House.list[b.owner].stores.wood += buildingShare;
                  console.log(House.list[b.owner].name + ' +' + buildingShare + ' Wood (' + self.name + ' kept ' + serfWage + ' as wage)');
                } else if(Player.list[b.owner] && Player.list[b.owner].house){
                  var h = Player.list[b.owner].house;
                  House.list[h].stores.wood += buildingShare;
                  console.log(House.list[h].name + ' +' + buildingShare + ' Wood (' + self.name + ' kept ' + serfWage + ' as wage)');
                } else if(Player.list[b.owner]){
                  Player.list[b.owner].stores.wood += buildingShare;
                  console.log(Player.list[b.owner].name + ' +' + buildingShare + ' Wood (' + self.name + ' kept ' + serfWage + ' as wage)');
                }
                // Track daily deposits (building share only)
                if(!b.dailyStores) b.dailyStores = {wood: 0};
                b.dailyStores.wood += buildingShare;
              } else {
                if(!self.path){
                  self.moveTo(0,dropoff[0],dropoff[1]);
                }
              }
            } else {
              // Need a spot to chop wood
              if(!spot){
                // Don't immediately fail - spot assignment happens in mode logic
                return;
              }
              
              // Check if already at work spot
              if(loc.toString() == spot.toString()){
                var tile = getTile(0,spot[0],spot[1]);
                self.working = true;
                self.chopping = true;
                if(!self.workTimer){
                  self.workTimer = true;
                  setTimeout(function(){
                    if(self.chopping){
                      tileChange(6,spot[0],spot[1],-1,true);
                      self.inventory.wood += 10; // ALPHA
                      console.log(self.name + ' chopped 10 Wood');
                      var res = getTile(6,spot[0],spot[1]);
                      if(res <= 0 ){
                        tileChange(0,spot[0],spot[1],1,true);
                        // Tile update automatically handled by tileChange function
                        for(var i in hq.resources){
                          var f = hq.resources[i];
                          if(f.toString() == spot.toString()){
                            Building.list[self.work.hq].resources.splice(i,1);
                          }
                        }
                        self.action = null;
                      } else if(res < 101){
                        var gt = getTile(0,spot[0],spot[1]);
                        if(gt >= 1 && gt < 2){
                          tileChange(0,spot[0],spot[1],1,true);
                          // Tile update automatically handled by tileChange function
                        }
                      }
                    }
                    self.workTimer = false;
                    self.working = false;
                    self.chopping = false;
                  },10000/self.strength);
                }
              } else {
                if(!self.path){
                  self.moveTo(0,spot[0],spot[1]);
                  if(!self.path){
                    console.log(self.name + ' failed to create path to wood spot - clearing spot to try again');
                    self.work.spot = null;
                    self.action = null;
                  }
                }
              }
            }
          } else if(hq.type == 'mine'){
            if(hq.cave){ // metal
              var spot = self.work.spot;
              
              // Check if serf has ore to deposit first (priority over getting new spot)
              var hasOreToDeposit = self.inventory.ironore >= 1 || self.inventory.silverore >= 1 || 
                                    self.inventory.goldore >= 1 || self.inventory.diamond >= 1;
              
              // Only assign new spot if no ore to deposit
              if(!spot && !hasOreToDeposit && hq.resources && hq.resources.length > 0){
                var rand = Math.floor(Math.random() * hq.resources.length);
                self.work.spot = hq.resources[rand];
                spot = self.work.spot;
                console.log(self.name + ' assigned ore mine spot ['+spot[0]+','+spot[1]+'] at z=' + self.z);
              }
              
              if(self.inventory.ironore >= 1){
                // Clear work spot - we're depositing, not gathering
                self.work.spot = null;
                
                // Set intent to exit cave for deposit (if currently in cave)
                if(self.z === -1){
                  self.transitionIntent = 'exit_cave';
                  self.targetZLevel = 0;
                }
                
                var b = Building.list[self.work.hq];
                var drop = [b.plot[0][0],b.plot[0][1]+1];
                if(loc.toString() == drop.toString()){
                  self.facing = 'up';
                  var totalIron = self.inventory.ironore;
                  var buildingShare = Math.floor(totalIron * 0.85); // 85% to building
                  var serfWage = totalIron - buildingShare;         // 15% wage for serf
                  
                  self.inventory.ironore = 0;
                  self.stores.ironore = (self.stores.ironore || 0) + serfWage; // Keep wage
                  
                  if(House.list[b.owner]){
                    House.list[b.owner].stores.ironore += buildingShare;
                    console.log(House.list[b.owner].name + ' +' + buildingShare + ' Iron Ore (' + self.name + ' kept ' + serfWage + ' as wage)');
                  } else if(Player.list[b.owner] && Player.list[b.owner].house){
                    var h = Player.list[b.owner].house;
                    House.list[h].stores.ironore += buildingShare;
                    console.log(House.list[h].name + ' +' + buildingShare + ' Iron Ore (' + self.name + ' kept ' + serfWage + ' as wage)');
                  } else if(Player.list[b.owner]){
                    Player.list[b.owner].stores.ironore += buildingShare;
                    console.log(Player.list[b.owner].name + ' +' + buildingShare + ' Iron Ore (' + self.name + ' kept ' + serfWage + ' as wage)');
                  }
                  // Track daily deposits (building share only)
                  if(!b.dailyStores) b.dailyStores = {stone: 0, ironore: 0, silverore: 0, goldore: 0, diamond: 0};
                  b.dailyStores.ironore += buildingShare;
                } else {
                  if(!self.path){
                    self.moveTo(0,drop[0],drop[1]);
                  }
                }
              } else if(self.inventory.silverore >= 1){
                // Clear work spot - we're depositing, not gathering
                self.work.spot = null;
                
                // Set intent to exit cave for deposit (if currently in cave)
                if(self.z === -1){
                  self.transitionIntent = 'exit_cave';
                  self.targetZLevel = 0;
                }
                
                var b = Building.list[self.work.hq];
                var drop = [b.plot[0][0],b.plot[0][1]+1];
                if(loc.toString() == drop.toString()){
                  self.facing = 'up';
                  self.inventory.silverore--;
                  if(House.list[b.owner]){
                    House.list[b.owner].stores.silverore++;
                    console.log(House.list[b.owner].name + ' +1 Silver Ore');
                  } else if(Player.list[b.owner] && Player.list[b.owner].house){
                    var h = Player.list[b.owner].house;
                    House.list[h].stores.silverore++;
                    console.log(House.list[h].name + ' +1 Silver Ore');
                  } else if(Player.list[b.owner]){
                    Player.list[b.owner].stores.silverore++;
                    console.log(Player.list[b.owner].name + ' +1 Silver Ore');
                  }
                  // Track daily deposits
                  if(!b.dailyStores) b.dailyStores = {stone: 0, ironore: 0, silverore: 0, goldore: 0, diamond: 0};
                  b.dailyStores.silverore++;
                } else {
                  if(!self.path){
                    self.moveTo(0,drop[0],drop[1]);
                  }
                }
              } else if(self.inventory.goldore >= 1){
                // Clear work spot - we're depositing, not gathering
                self.work.spot = null;
                
                // Set intent to exit cave for deposit (if currently in cave)
                if(self.z === -1){
                  self.transitionIntent = 'exit_cave';
                  self.targetZLevel = 0;
                }
                
                var b = Building.list[self.work.hq];
                var drop = [b.plot[0][0],b.plot[0][1]+1];
                if(loc.toString() == drop.toString()){
                  self.facing = 'up';
                  self.inventory.goldore--;
                  if(House.list[b.owner]){
                    House.list[b.owner].stores.goldore++;
                    console.log(House.list[b.owner].name + ' +1 Gold Ore');
                  } else if(Player.list[b.owner] && Player.list[b.owner].house){
                    var h = Player.list[b.owner].house;
                    House.list[h].stores.goldore++;
                    console.log(House.list[h].name + ' +1 Gold Ore');
                  } else if(Player.list[b.owner]){
                    Player.list[b.owner].stores.goldore++;
                    console.log(Player.list[b.owner].name + ' +1 Gold Ore');
                  }
                  // Track daily deposits
                  if(!b.dailyStores) b.dailyStores = {stone: 0, ironore: 0, silverore: 0, goldore: 0, diamond: 0};
                  b.dailyStores.goldore++;
                } else {
                  if(!self.path){
                    self.moveTo(0,drop[0],drop[1]);
                  }
                }
              } else if(self.inventory.diamond >= 1){
                // Clear work spot - we're depositing, not gathering
                self.work.spot = null;
                
                // Set intent to exit cave for deposit (if currently in cave)
                if(self.z === -1){
                  self.transitionIntent = 'exit_cave';
                  self.targetZLevel = 0;
                }
                
                var b = Building.list[self.work.hq];
                var drop = [b.plot[0][0],b.plot[0][1]+1];
                if(loc.toString() == drop.toString()){
                  self.facing = 'up';
                  self.inventory.diamond--;
                  if(House.list[b.owner]){
                    House.list[b.owner].stores.diamond++;
                    console.log(House.list[b.owner].name + ' +1 Diamond');
                  } else if(Player.list[b.owner] && Player.list[b.owner].house){
                    var h = Player.list[b.owner].house;
                    House.list[h].stores.diamond++;
                    console.log(House.list[h].name + ' +1 Diamond');
                  } else if(Player.list[b.owner]){
                    Player.list[b.owner].stores.diamond++;
                    console.log(Player.list[b.owner].name + ' +1 Diamond');
                  }
                  // Track daily deposits
                  if(!b.dailyStores) b.dailyStores = {stone: 0, ironore: 0, silverore: 0, goldore: 0, diamond: 0};
                  b.dailyStores.diamond++;
                } else {
                  if(!self.path){
                    self.moveTo(0,drop[0],drop[1]);
                  }
                }
              } else {
                // No ore to deposit - continue mining
                // Ore mining - serfs need to go to cave (z=-1)
                
                // If no spot assigned, can't continue (serf needs task assignment)
                if(!spot){
                  console.log(self.name + ' at ore mine with no spot and no ore to deposit, z=' + self.z);
                  self.action = null; // Let the !action block assign a new task
                  return;
                }
                
                if(self.z == -1){
                  // Only check tile validity if not actively working
                  if(!self.workTimer){
                    var gt = getTile(1,spot[0],spot[1]);
                    if(gt < 3 || gt > 5){
                      // Rock is gone, clear spot
                      self.work.spot = null;
                      for(var i in hq.resources){
                        var f = hq.resources[i];
                        if(f.toString() == spot.toString()){
                          Building.list[self.work.hq].resources.splice(i,1);
                        }
                      }
                      return;
                    }
                  }
                  
                  // Already in cave, path to ore spot
                  if(loc.toString() == spot.toString()){
                  var tile = getTile(1,spot[0],spot[1]); // Layer 1 for cave rocks
                  self.working = true;
                  self.mining = true;
                  if(!self.workTimer){
                    self.workTimer = true;
                    setTimeout(function(){
                      if(self.mining){
                        // Mine ore - random chance for different ores
                        var roll = Math.random();
                        if(roll < 0.001){
                          self.inventory.diamond++;
                          console.log(self.name + ' mined 1 Diamond');
                        } else if(roll < 0.01){
                          self.inventory.goldore++;
                          console.log(self.name + ' mined 1 Gold Ore');
                        } else if(roll < 0.1){
                          self.inventory.silverore++;
                          console.log(self.name + ' mined 1 Silver Ore');
                        } else if(roll < 0.5){
                          self.inventory.ironore++;
                          console.log(self.name + ' mined 1 Iron Ore');
                        } else {
                          // 50% chance to get nothing (mining is hard!)
                          console.log(self.name + ' mined but found nothing this time');
                        }
                        // Always deplete the resource and complete the work cycle
                        tileChange(7,spot[0],spot[1],-1,true);
                        var res = getTile(7,spot[0],spot[1]);
                        if(res <= 0){
                          tileChange(1,spot[0],spot[1],1); // Change layer 1 (cave floor) to floor tile
                          // Tile update automatically handled by tileChange function
                          for(var i in hq.resources){
                            var f = hq.resources[i];
                            if(f.toString() == spot.toString()){
                              Building.list[self.work.hq].resources.splice(i,1);
                            }
                          }
                          var adj = [[spot[0]-1,spot[1]],[spot[0],spot[1]-1],[spot[0]+1,spot[1]],[spot[0],spot[1]+1]];
                          var n = [];
                          for(var i in adj){
                            var t = adj[i];
                            var gt = getTile(1,t[0],t[1]);
                            if(gt == 1){
                              n.push(t);
                            }
                          }
                          if(n.length > 0){
                            for(var i in n){
                              var r = n[i];
                              var num = 3 + Number((Math.random()*0.9).toFixed(2));
                              tileChange(1,r[0],r[1],num);
                              matrixChange(1,r[0],r[1],0);
                              Building.list[self.work.hq].resources.push(r);
                            }
                            // Tile update automatically handled by tileChange function
                          }
                          // Clear spot AND action so serf will deposit ore
                          self.work.spot = null;
                          self.action = null;
                        }
                      }
                      self.workTimer = false;
                      self.working = false;
                      self.mining = false;
                    },10000/self.strength);
                  }
                  } else {
                    // In cave but not at spot yet - path to ore rock
                    if(!self.path){
                      var currentLoc = getLoc(self.x, self.y);
                      console.log(self.name + ' at z=-1 ['+currentLoc[0]+','+currentLoc[1]+'] pathing to ore spot ['+spot[0]+','+spot[1]+']');
                      self.moveTo(-1,spot[0],spot[1]);
                      if(!self.path){
                        console.log(self.name + ' failed to create path to ore spot in cave - clearing spot to try again');
                        // Clear the unreachable spot so a new one can be assigned
                        self.work.spot = null;
                        self.action = null;
                      }
                    }
                  }
                } else {
                  // Not in cave yet (at z=0, z=1, or z=2) - path to cave entrance
                  // moveTo will automatically handle building exits if at z=1 or z=2
                  if(hq.cave){
                    var caveEntrance = hq.cave;
                    
                    // Set intent to enter cave for mining
                    self.transitionIntent = 'enter_cave';
                    self.targetZLevel = -1;
                    
                    // Don't path if already at cave entrance on z=0 (waiting for transition)
                    var alreadyAtEntrance = (self.z === 0 && loc.toString() === caveEntrance.toString());
                    if(!self.path && !alreadyAtEntrance){
                      self.moveTo(0,caveEntrance[0],caveEntrance[1]);
                    }
                  }
                }
              }
            } else { // stone
              // Need a spot to mine stone
              if(!spot && self.inventory.stone < 1){
                // Just log - spot assignment happens in mode logic
                console.log(self.name + ' at stone mine needs spot assignment');
                // Don't clear action or return
              }
              
              // Only check tile validity when at the spot (to avoid premature clearing)
              if(spot && loc.toString() == spot.toString() && !self.workTimer){
              var gt = getTile(0,spot[0],spot[1]);
              if(gt < 4 || gt > 6){
                  // Stone is gone, clear spot and remove from resources
                  console.log(self.name + ' stone at spot [' + spot + '] is gone, clearing');
                  var depletedSpot = spot.toString(); // Store before nulling
                self.work.spot = null;
                  spot = null;
                for(var i in hq.resources){
                  var f = hq.resources[i];
                    if(f && f.toString() == depletedSpot){
                    Building.list[self.work.hq].resources.splice(i,1);
                  }
                }
                  // Continue to get new assignment
                }
              }
              if(self.inventory.stone >= 1){
                // Clear work spot - we're depositing, not gathering
                self.work.spot = null;
                var b = Building.list[self.work.hq];
                var drop = [b.plot[0][0],b.plot[0][1]+1];
                if(loc.toString() == drop.toString()){
                  self.facing = 'up';
                  var totalStone = self.inventory.stone;
                  var buildingShare = Math.floor(totalStone * 0.85); // 85% to building
                  var serfWage = totalStone - buildingShare;         // 15% wage for serf
                  
                  self.inventory.stone = 0;
                  self.stores.stone = (self.stores.stone || 0) + serfWage; // Keep wage
                  
                  if(House.list[b.owner]){
                    House.list[b.owner].stores.stone += buildingShare;
                    console.log(House.list[b.owner].name + ' +' + buildingShare + ' Stone (' + self.name + ' kept ' + serfWage + ' as wage)');
                  } else if(Player.list[b.owner] && Player.list[b.owner].house){
                    var h = Player.list[b.owner].house;
                    House.list[h].stores.stone += buildingShare;
                    console.log(House.list[h].name + ' +' + buildingShare + ' Stone (' + self.name + ' kept ' + serfWage + ' as wage)');
                  } else if(Player.list[b.owner]){
                    Player.list[b.owner].stores.stone += buildingShare;
                    console.log(Player.list[b.owner].name + ' +' + buildingShare + ' Stone (' + self.name + ' kept ' + serfWage + ' as wage)');
                  }
                  // Track daily deposits (building share only)
                  if(!b.dailyStores) b.dailyStores = {stone: 0, ironore: 0, silverore: 0, goldore: 0, diamond: 0};
                  b.dailyStores.stone += buildingShare;
                } else {
                  if(!self.path){
                    self.moveTo(0,drop[0],drop[1]);
                  }
                }
              } else {
                // Need a spot to mine
                if(!spot){
                  // Don't immediately fail - spot assignment happens in mode logic
                  return;
                }
                
                if(loc.toString() == spot.toString()){
                  var tile = getTile(0,spot[0],spot[1]);
                  self.working = true;
                  self.mining = true;
                  if(!self.workTimer){
                    self.workTimer = true;
                    setTimeout(function(){
                      if(self.mining){
                        tileChange(6,spot[0],spot[1],-1,true);
                        self.inventory.stone += 10; // ALPHA
                        console.log(self.name + ' quarried 10 Stone');
                        var res = getTile(6,spot[0],spot[1]);
                        if(res <= 0){
                          tileChange(0,spot[0],spot[1],7);
                          // Tile update automatically handled by tileChange function
                          for(var i in hq.resources){
                            var f = hq.resources[i];
                            if(f.toString() == spot.toString()){
                              Building.list[self.work.hq].resources.splice(i,1);
                            }
                          }
                          self.action = null;
                        } else if(tile >= 5 && tile < 6 && res <= 50){
                          tileChange(0,spot[0],spot[1],-1,true);
                          // Tile update automatically handled by tileChange function
                        }
                      }
                      self.workTimer = false;
                      self.working = false;
                      self.mining = false;
                    },10000/self.strength);
                  }
                } else {
                  if(!self.path){
                    self.moveTo(0,spot[0],spot[1]);
                    if(!self.path){
                      console.log(self.name + ' failed to create path to stone spot - clearing spot to try again');
                      self.work.spot = null;
                      self.action = null;
                    }
                  }
                }
              }
            }
          }
        }
      } else if(self.action == 'clockout'){
        self.working = false;
        self.building = false;
        self.farming = false;
        self.chopping = false;
        self.mining = false;
        var b = Building.list[self.work.hq];
        var drop = [b.plot[0][0],b.plot[0][1]+1];
        if(loc.toString() == drop.toString()){
          self.facing = 'up';
          if(b.type == 'mill'){
            if(self.inventory.grain >= 3){
              self.inventory.grain -= 3;
              var grainDeposited = 2;
              if(House.list[b.owner]){
                House.list[b.owner].stores.grain += grainDeposited;
                console.log(self.name + ' dropped off 2 Grain.');
              } else if(Player.list[b.owner].house){
                var h = Player.list[b.owner].house;
                House.list[h].stores.grain += grainDeposited;
                console.log(self.name + ' dropped off 2 Grain.');
              } else {
                Player.list[b.owner].stores.grain += grainDeposited;
                console.log(self.name + ' dropped off 2 Grain.');
              }
              // Track daily deposits
              if(!b.dailyStores) b.dailyStores = {grain: 0};
              b.dailyStores.grain += grainDeposited;
              
              self.inventory.flour++;
            } else {
              // Not enough grain, transition to next action
              console.log(self.name + ' not enough grain to drop off, transitioning');
              self.mode = 'idle';
              self.action = null; // Clear action so serf can transition
            }
          } else if(b.type == 'lumbermill'){
            if(self.inventory.wood >= 3){
              var totalWood = 3;
              var buildingShare = Math.floor(totalWood * 0.85); // 2 wood to building
              var serfWage = totalWood - buildingShare;          // 1 wood wage
              
              self.inventory.wood -= totalWood;
              self.stores.wood = (self.stores.wood || 0) + serfWage;
              
              if(House.list[b.owner]){
                House.list[b.owner].stores.wood += buildingShare;
                console.log(self.name + ' dropped off ' + buildingShare + ' Wood, kept ' + serfWage + ' as wage.');
              } else if(Player.list[b.owner].house){
                var h = Player.list[b.owner].house;
                House.list[h].stores.wood += buildingShare;
                console.log(self.name + ' dropped off ' + buildingShare + ' Wood, kept ' + serfWage + ' as wage.');
              } else {
                Player.list[b.owner].stores.wood += buildingShare;
                console.log(self.name + ' dropped off ' + buildingShare + ' Wood, kept ' + serfWage + ' as wage.');
              }
              // Track daily deposits (building share only)
              if(!b.dailyStores) b.dailyStores = {wood: 0};
              b.dailyStores.wood += buildingShare;
            } else {
              // Not enough wood, transition to next action
              console.log(self.name + ' not enough wood to drop off, transitioning');
              self.mode = 'idle';
              self.action = null; // Clear action so serf can transition
            }
          } else if(b.type == 'mine'){
            if(b.cave){
              if(self.inventory.ironore >= 3){
                self.inventory.ironore -= 2;
                if(House.list[b.owner]){
                  House.list[b.owner].stores.ironore += 2;
                  console.log(self.name + ' dropped off 2 Iron Ore.');
                } else if(Player.list[b.owner].house){
                  var h = Player.list[b.owner].house;
                  House.list[h].stores.ironore += 2;
                  console.log(self.name + ' dropped off 2 Iron Ore.');
                } else {
                  Player.list[b.owner].stores.stone += 2;
                  console.log(self.name + ' dropped off 2 Iron Ore.');
                }
              } else if(self.inventory.silverore > 0){
                self.inventory.silverore--;
                if(House.list[b.owner]){
                  House.list[b.owner].stores.silverore ++;
                  console.log(self.name + ' dropped off 1 Silver Ore.');
                } else if(Player.list[b.owner].house){
                  var h = Player.list[b.owner].house;
                  House.list[h].stores.silverore++;
                  console.log(self.name + ' dropped off 1 Silver Ore.');
                } else {
                  Player.list[b.owner].stores.silverore++;
                  console.log(self.name + ' dropped off 1 Silver Ore.');
                }
              } else if(self.inventory.goldore > 0){
                self.inventory.goldore--;
                if(House.list[b.owner]){
                  House.list[b.owner].stores.goldore ++;
                  console.log(self.name + ' dropped off 1 Gold Ore.');
                } else if(Player.list[b.owner].house){
                  var h = Player.list[b.owner].house;
                  House.list[h].stores.goldore++;
                  console.log(self.name + ' dropped off 1 Gold Ore.');
                } else {
                  Player.list[b.owner].stores.goldore++;
                  console.log(self.name + ' dropped off 1 Gold Ore.');
                }
              } else if(self.inventory.diamond > 0){
                self.inventory.diamond--;
                if(House.list[b.owner]){
                  House.list[b.owner].stores.ironore ++;
                  console.log(self.name + ' dropped off 1 Diamond.');
                } else if(Player.list[b.owner].house){
                  var h = Player.list[b.owner].house;
                  House.list[h].stores.diamond++;
                  console.log(self.name + ' dropped off 1 Diamond.');
                } else {
                  Player.list[b.owner].stores.diamond++;
                  console.log(self.name + ' dropped off 1 Diamond.');
                }
              } else {
                self.mode = 'idle';
              }
            } else {
              if(self.inventory.stone >= 3){
                self.inventory.stone -= 2;
                var stoneDeposited = 2;
                if(House.list[b.owner]){
                  House.list[b.owner].stores.stone += stoneDeposited;
                  console.log(self.name + ' dropped off 2 Stone.');
                } else if(Player.list[b.owner].house){
                  var h = Player.list[b.owner].house;
                  House.list[h].stores.stone += stoneDeposited;
                  console.log(self.name + ' dropped off 2 Stone.');
                } else {
                  Player.list[b.owner].stores.stone += stoneDeposited;
                  console.log(self.name + ' dropped off 2 Stone.');
                }
                // Track daily deposits
                if(!b.dailyStores) b.dailyStores = {stone: 0, ironore: 0};
                b.dailyStores.stone += stoneDeposited;
              } else {
                self.mode = 'idle'
              }
            }
          }
        } else {
          if(!self.path){
            self.moveTo(0,drop[0],drop[1]);
          }
        }
      } else if(self.action == 'combat'){
        self.action = 'flee';
      } else if(self.action == 'flee'){
        // Use SimpleFlee system for reliable fleeing (same as deer)
        if(global.simpleFlee){
          global.simpleFlee.update(self);
          } else {
          // Fallback: clear flee if no system available
            self.action = null;
          self.combat.target = null;
          self.baseSpd = 2;
        }
      }
      // IDLE
    } else if(self.mode == 'idle'){
      if(!self.action){
        var cHome = getCenter(self.home.loc[0],self.home.loc[1]);
        var hDist = self.getDistance({
          x:cHome[0],
          y:cHome[1]
        });
        if(hDist > self.wanderRange){
          if(!self.path){
            self.return();
          }
        } else if(self.idleTime == 0){
          if(!self.path){  // Only create new wander if no current path
          var col = loc[0];
          var row = loc[1];
          var select = [[col,row-1],[col-1,row],[col,row+1],[col+1,row]];
          var target = select[Math.floor(Math.random() * 4)];
          if(target[0] < mapSize && target[0] > -1 && target[1] < mapSize && target[1] > -1){
            if(isWalkable(self.z,target[0],target[1])){
              self.move(target);
                self.idleTime = Math.floor(Math.random() * self.idleRange);  // SET, not ADD
              }
            }
          }
        }
      } else if(self.action == 'clockout'){
        var rand = Math.random();
        if(self.tavern){
          if(Building.list[self.tavern].market){
            var inv = self.inventory;
            var hasItemsToSell = (inv.flour > 0 || inv.wood > 0 || inv.stone > 0 || inv.ironore > 0 || 
                                   inv.silverore > 0 || inv.goldore > 0 || inv.diamond > 0);
            var hasMoneyToBuy = (self.stores.silver || 0) > 20;
            
            // Phase 4: Increased market frequency
            // 80% chance if have items to sell
            // 40% chance if have money to buy
            // 15% chance to go anyway (check prices, socialize)
            if(hasItemsToSell || (hasMoneyToBuy && rand < 0.4) || rand < 0.15){
              self.action = 'market';
              console.log(self.name + ' heads to the market');
            } else if(rand > 0.85){
              self.action = 'home';
              console.log(self.name + ' heads home for the night');
            } else {
              self.action = 'tavern';
              console.log(self.name + ' heads to the tavern');
            }
          } else {
            // No market - normal tavern/home choice
            if(rand < 0.6){
              self.action = 'tavern';
              console.log(self.name + ' heads to the tavern');
            } else {
              self.action = 'home';
              console.log(self.name + ' heads home for the night');
            }
          }
        } else {
          self.action = 'home';
          console.log(self.name + ' heads home for the night');
        }
      } else if(self.action == 'home'){
        // Navigate to home location
        if(self.home){
          var loc = getLoc(self.x, self.y);
          if(self.z != self.home.z || loc.toString() != self.home.loc.toString()){
            // Special case: If in cellar (z=-2) and home is outside (z=0), go upstairs first
            if(self.z == -2 && self.home.z == 0 && !self.path){
              var b = getBuilding(self.x, self.y);
              if(b){
                var building = Building.list[b];
                if(building && building.dstairs){
                  console.log(self.name + ' in cellar, going upstairs to exit');
                  self.moveTo(-2, building.dstairs[0], building.dstairs[1]);
                }
              }
            }
            // Special case: If on second floor (z=2) and home is outside (z=0), go downstairs first
            else if(self.z == 2 && self.home.z == 0 && !self.path){
              var b = getBuilding(self.x, self.y);
              if(b){
                var building = Building.list[b];
                if(building && building.ustairs){
                  console.log(self.name + ' on second floor, going downstairs to exit');
                  self.moveTo(2, building.ustairs[0], building.ustairs[1]);
                }
              }
            }
            // Special case: If inside a building (z=1) and home is outside (z=0), exit first
            else if(self.z == 1 && self.home.z == 0 && !self.path){
              // Find the door to exit
              var b = getBuilding(self.x, self.y);
              if(b){
                var building = Building.list[b];
                if(building && building.plot){
                  // Look for door tile in building plot
                  for(var i in building.plot){
                    var p = building.plot[i];
                    var tile = getTile(0, p[0], p[1]);
                    if(tile == 14 || tile == 16){ // Door tiles
                      console.log(self.name + ' inside building, exiting to go home');
                      // Path to the tile one tile DOWN from door (inside building, triggers exit when door is checked above)
                      self.moveTo(1, p[0], p[1] + 1);
                      break;
                    }
                  }
                }
              }
            }
            
            // Track how long we've been trying to go home
            if(!self.homeAttempts){
              self.homeAttempts = 0;
            }
            self.homeAttempts++;
            
            // If stuck trying to go home for too long, just become idle where we are
            if(self.homeAttempts > 600){ // 10 seconds at 60fps
              console.log(self.name + ' stuck trying to go home for too long, giving up');
              self.action = null;
              self.mode = 'idle';
              self.homeAttempts = 0;
              self.path = null; // Clear any bad path
              self.tether = null; // Clear tether
            } else {
              // Try to path to home
              if(!self.path){
                self.moveTo(self.home.z, self.home.loc[0], self.home.loc[1]);
              }
              // If still no path after trying to create one, we might be stuck
              if(!self.path && self.homeAttempts > 60){ // If no path after 1 second of trying
                if(self.homeAttempts > 180){ // Give up after 3 seconds of trying
                  console.log(self.name + ' stuck trying to go home for too long, giving up');
                  self.action = null;
                  self.mode = 'idle';
                  self.homeAttempts = 0;
                  self.tether = null;
                  self.path = null;
                } else if(self.homeAttempts % 60 == 0){ // Only log every 60 frames (1 second)
                console.log(self.name + ' cannot create path home, clearing tether and retrying');
                self.tether = null; // Clear tether in case it's blocking us
                self.path = null;
                }
              }
            }
          } else {
            // Arrived home, become idle
            self.action = null;
            self.mode = 'idle';
            self.homeAttempts = 0;
            console.log(self.name + ' has arrived home');
          }
        } else {
          // No home location, just become idle
          self.action = null;
          self.mode = 'idle';
          self.homeAttempts = 0;
          console.log(self.name + ' has no home, staying idle');
        }
      } else if(self.action == 'market'){
        var market = Building.list[self.tavern].market;
        var m = Building.list[market];
        if(getBuilding(self.x,self.y) != market){
          if(!self.path){
            var rand = Math.floor(Math.random() * m.plot.length);
            var dest = m.plot[rand];
            self.tether = {z:1,loc:dest};
            self.moveTo(1,dest[0],dest[1]);
          }
        } else {
          var inv = self.inventory;
          // if has inventory, sell inventory via market orderbook (ONCE per market visit)
          if(!self.hasPlacedMarketOrder){
            var soldSomething = false;
            
          if(inv.flour > 0){
              // Transfer flour to stores, then sell 75%, keep 25%
              var totalFlour = inv.flour;
              var sellAmount = Math.floor(totalFlour * 0.75); // Sell 75%
              var keepAmount = totalFlour - sellAmount;        // Keep 25%
              
              self.stores.grain = (self.stores.grain || 0) + keepAmount;
              inv.flour = 0;
              
              if(sellAmount > 0){
                var price = global.getCompetitiveAskPrice(m, 'grain') || 3;
                global.processSellOrder(self.id, m, 'grain', sellAmount, price);
                console.log(self.name + ' sold ' + sellAmount + ' grain @ ' + price + ' silver, kept ' + keepAmount);
                soldSomething = true;
              }
          } else if(inv.wood > 0){
              // Transfer wood to stores, then sell 75%, keep 25%
              var totalWood = inv.wood;
              var sellAmount = Math.floor(totalWood * 0.75);
              var keepAmount = totalWood - sellAmount;
              
              self.stores.wood = (self.stores.wood || 0) + keepAmount;
              inv.wood = 0;
              
              if(sellAmount > 0){
                var price = global.getCompetitiveAskPrice(m, 'wood') || 8;
                global.processSellOrder(self.id, m, 'wood', sellAmount, price);
                console.log(self.name + ' sold ' + sellAmount + ' wood @ ' + price + ' silver, kept ' + keepAmount);
                soldSomething = true;
              }
          } else if(inv.stone > 0){
              // Transfer stone to stores, then sell 75%, keep 25%
              var totalStone = inv.stone;
              var sellAmount = Math.floor(totalStone * 0.75);
              var keepAmount = totalStone - sellAmount;
              
              self.stores.stone = (self.stores.stone || 0) + keepAmount;
              inv.stone = 0;
              
              if(sellAmount > 0){
                var price = global.getCompetitiveAskPrice(m, 'stone') || 10;
                global.processSellOrder(self.id, m, 'stone', sellAmount, price);
                console.log(self.name + ' sold ' + sellAmount + ' stone @ ' + price + ' silver, kept ' + keepAmount);
                soldSomething = true;
              }
          } else if(inv.ironore > 0){
              // Transfer ironore to stores, then sell 75%, keep 25%
              var totalOre = inv.ironore;
              var sellAmount = Math.floor(totalOre * 0.75);
              var keepAmount = totalOre - sellAmount;
              
              self.stores.ironore = (self.stores.ironore || 0) + keepAmount;
              inv.ironore = 0;
              
              if(sellAmount > 0){
                var price = global.getCompetitiveAskPrice(m, 'ironore') || 15;
                global.processSellOrder(self.id, m, 'ironore', sellAmount, price);
                console.log(self.name + ' sold ' + sellAmount + ' ironore @ ' + price + ' silver, kept ' + keepAmount);
                soldSomething = true;
              }
            } else if(inv.silverore > 0){
              // Precious ore - sell 100% (no keeping, goes entirely to building owner)
              self.stores.silverore = (self.stores.silverore || 0) + inv.silverore;
              inv.silverore = 0;
              
              var price = global.getCompetitiveAskPrice(m, 'silverore') || 40;
              global.processSellOrder(self.id, m, 'silverore', self.stores.silverore, price);
              console.log(self.name + ' sold ' + self.stores.silverore + ' silverore @ ' + price + ' silver (precious ore - no keeping)');
              soldSomething = true;
            } else if(inv.goldore > 0){
              // Precious ore - sell 100% (no keeping, goes entirely to building owner)
              self.stores.goldore = (self.stores.goldore || 0) + inv.goldore;
              inv.goldore = 0;
              
              var price = global.getCompetitiveAskPrice(m, 'goldore') || 80;
              global.processSellOrder(self.id, m, 'goldore', self.stores.goldore, price);
              console.log(self.name + ' sold ' + self.stores.goldore + ' goldore @ ' + price + ' silver (precious ore - no keeping)');
              soldSomething = true;
            } else if(inv.diamond > 0){
              // Precious gem - sell 100% (no keeping, goes entirely to building owner)
              self.stores.diamond = (self.stores.diamond || 0) + inv.diamond;
              inv.diamond = 0;
              
              var price = global.getCompetitiveAskPrice(m, 'diamond') || 200;
              global.processSellOrder(self.id, m, 'diamond', self.stores.diamond, price);
              console.log(self.name + ' sold ' + self.stores.diamond + ' diamond @ ' + price + ' silver (precious gem - no keeping)');
              soldSomething = true;
            }
            
            if(soldSomething){
              self.hasPlacedMarketOrder = true; // Mark that we've sold, don't sell again
            }
          }
          
          // Phase 5: NPC Buying Behavior
          if(!soldSomething && (self.stores.silver || 0) > 30){
            var rand = Math.random();
            var desiredResource = null;
            
            // Determine what to buy based on serf's work
            if(self.work && self.work.hq){
              var hqBuilding = Building.list[self.work.hq];
              if(hqBuilding){
                // Buy resources related to work building
                if(hqBuilding.type === 'mill'){
                  if(rand < 0.5) desiredResource = 'grain'; // Buy more grain to process
                } else if(hqBuilding.type === 'lumbermill'){
                  if(rand < 0.5) desiredResource = 'wood';
                } else if(hqBuilding.type === 'mine'){
                  if(rand < 0.3) desiredResource = 'ironore';
                  else if(rand < 0.5) desiredResource = 'silverore';
                }
              }
            }
            
            // Random chance to buy consumables or tools
            if(!desiredResource && rand < 0.3){
              var buyables = ['grain', 'wood', 'stone', 'bread', 'torch'];
              desiredResource = buyables[Math.floor(Math.random() * buyables.length)];
            }
            
            if(desiredResource){
              var price = global.getCompetitiveBidPrice(m, desiredResource) || 5;
              var maxSpend = Math.floor((self.stores.silver || 0) * 0.4); // Spend max 40% of silver
              var buyAmount = Math.floor(maxSpend / price);
              
              if(buyAmount > 0){
                global.processBuyOrder(self.id, m, desiredResource, buyAmount, price);
                console.log(self.name + ' placed buy order for ' + buyAmount + ' ' + desiredResource + ' @ ' + price + ' silver');
                self.hasPlacedMarketOrder = true;
              }
            }
          }
          
          if(!self.hasPlacedMarketOrder){
            if(!self.dayTimer){
              self.dayTimer = true;
              var rand = Math.floor(Math.random() * (3600000/(period/3)));
              setTimeout(function(){
                self.tether = null;
                self.action = 'tavern';
                self.hasPlacedMarketOrder = false; // Reset for next market visit
                self.dayTimer = false;
                console.log(self.name + ' heads to the tavern');
              },rand);
            }
            var ct = getCenter(self.tether.loc[0],self.tether.loc[1]);
            var tDist = self.getDistance({
              x:ct[0],
              y:ct[1]
            });
            if(tDist > self.wanderRange){
              if(!self.path){
                self.return();
              }
            } else if(self.idleTime == 0){
              var col = loc[0];
              var row = loc[1];
              var select = [[col,row-1],[col-1,row],[col,row+1],[col+1,row]];
              var target = select[Math.floor(Math.random() * 4)];
              if(target[0] < mapSize && target[0] > -1 && target[1] < mapSize && target[1] > -1){
                if(isWalkable(self.z,target[0],target[1])){
                  self.move(target);
                  self.idleTime += Math.floor(Math.random() * self.idleRange);
                }
              }
            }
          }
        }
      } else if(self.action == 'tavern'){
        var t = Building.list[self.tavern];
        if(getBuilding(self.x,self.y) != self.tavern){
          if(!self.path){
            var select = [];
            for(var i in t.plot){
              var p = t.plot[i];
              if(isWalkable(1,p[0],p[1])){
                select.push(p);
              }
            }
            var rand = Math.floor(Math.random() * select.length);
            var dest = select[rand];
            self.tether = {z:1,loc:dest};
            self.moveTo(1,dest[0],dest[1]);
          }
        } else {
          var ct = getCenter(self.tether.loc[0],self.tether.loc[1]);
          var tDist = self.getDistance({
            x:ct[0],
            y:ct[1]
          });
          if(tDist > self.wanderRange){
            if(!self.path){
              self.return();
            }
          } else if(self.idleTime == 0){
            var col = loc[0];
            var row = loc[1];
            var select = [[col,row-1],[col-1,row],[col,row+1],[col+1,row]];
            var target = select[Math.floor(Math.random() * 4)];
            if(target[0] < mapSize && target[0] > -1 && target[1] < mapSize && target[1] > -1){
              if(isWalkable(self.z,target[0],target[1])){
                self.move(target);
                self.idleTime += Math.floor(Math.random() * self.idleRange);
              }
            }
          }
        }
      } else if(self.action == 'combat'){
        self.action = 'flee';
      } else if(self.action == 'flee'){
        // Use SimpleFlee system for reliable fleeing (same as deer)
        if(global.simpleFlee){
          global.simpleFlee.update(self);
          } else {
          // Fallback: clear flee if no system available
            self.action = null;
          self.combat.target = null;
          self.baseSpd = 2;
        }
      }
    }
    self.updatePosition();
  }
}

SerfF = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'SerfF';
  self.sex = 'f';
  self.spriteSize = tileSize*1.5;
  self.unarmed = true;
  self.tether = null; // {z,loc}
  self.tavern = param.tavern;
  self.hut = param.hut;
  self.work = param.work || {hq:null,spot:null}; // Preserve work HQ from tavern spawn
  self.dayTimer = false;
  self.workTimer = false;
  self.idleCounter = 0; // Track how long serf has been without action
  self.lastPos = {x: param.x, y: param.y}; // Track position for stuck detection
  self.stuckCounter = 0; // Count frames stuck in same position

  // Assign Serf to appropriate work building (Female serfs can only work mills/farms)
  self.assignWorkHQ = function(){
    if(!self.house) return;
    
    var bestHQ = null;
    var bestDistance = Infinity;
    
    // Look for work buildings in the same house (females can only work mills/farms)
    for(var i in Building.list){
      var b = Building.list[i];
      if(b.house == self.house && (b.type == 'mill' || b.type == 'farm')){
        var dist = getDistance({x:self.x,y:self.y},{x:b.x,y:b.y});
        if(dist < bestDistance){
          bestDistance = dist;
          bestHQ = i;
        }
      }
    }
    
    // If no work found in own house, try to find allied house work
    if(!bestHQ && self.house){
      var myHouse = House.list[self.house];
      if(myHouse && myHouse.allies){
        for(var i in Building.list){
          var b = Building.list[i];
          // Check if building is mill/farm and house is allied
          if((b.type == 'mill' || b.type == 'farm') && b.house && myHouse.allies.indexOf(b.house) !== -1){
            var dist = getDistance({x:self.x,y:self.y},{x:b.x,y:b.y});
            if(dist < bestDistance && dist <= 2000){ // Within reasonable distance
              bestDistance = dist;
              bestHQ = i;
            }
          }
        }
      }
    }
    
    if(bestHQ){
      self.work.hq = bestHQ;
      console.log(self.name + ' (female) assigned to work at ' + Building.list[bestHQ].type);
    } else {
      // No work available - serf will idle at home
      console.log(self.name + ' (female) no suitable work found, will idle at home');
      self.work.hq = null;
    }
  };

  // Initialize Serf properly
  self.initializeSerf = function(){
    // Use new behavior system for initialization
    if (global.serfBehaviorSystem) {
      global.serfBehaviorSystem.initializeSerf(self);
    } else {
      // Fallback to old initialization
      if(!self.work.hq){
        self.assignWorkHQ();
      } else {
        // Work HQ was provided by tavern spawn, set torchBearer appropriately (for miners)
        if(self.sex == 'm'){
          var buildingType = Building.list[self.work.hq].type;
          if(buildingType === 'mine' && Building.list[self.work.hq].cave){
            self.torchBearer = true;
            console.log(self.name + ' is now a torch bearer (ore miner)');
          } else {
            self.torchBearer = false;
          }
        }
      }
      
      if(!self.tavern){
        self.findTavern();
      }
      
      if(!self.mode){
        self.mode = 'idle';
      }
      
      console.log(self.name + ' initialized - HQ: ' + (self.work.hq ? Building.list[self.work.hq].type : 'none') + 
                  ', Tavern: ' + (self.tavern ? 'yes' : 'no') + ', Mode: ' + self.mode);
    }
  };

  // Find nearest tavern
  self.findTavern = function(){
    if(!self.house) return;
    
    var bestTavern = null;
    var bestDistance = Infinity;
    
    for(var i in Building.list){
      var b = Building.list[i];
      if(b.type == 'tavern' && b.house == self.house){
        var dist = getDistance({x:self.x,y:self.y},{x:b.x,y:b.y});
        if(dist < bestDistance && dist <= 1280){ // Within reasonable distance
          bestDistance = dist;
          bestTavern = i;
        }
      }
    }
    
    if(bestTavern){
      self.tavern = bestTavern;
      console.log(self.name + ' found tavern ' + bestTavern);
    } else {
      console.log(self.name + ' no tavern found for house ' + self.house);
    }
  };

  // Initialize the Serf
  self.initializeSerf();

  self.update = function(){
    // Use SIMPLIFIED behavior system - just handles basic movement and exits
    if (global.simpleSerfBehavior) {
      global.simpleSerfBehavior.update(self);
    }
    
    var loc = getLoc(self.x,self.y);
    var b = getBuilding(self.x,self.y);
    self.zoneCheck();

    if(self.z == 0){
      if(getTile(0,loc[0],loc[1]) == 6){
        self.caveEntrance = loc;
        self.z = -1;
        // DON'T clear path - it needs to persist through z-transition
        // self.path and self.pathCount should remain intact
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * self.drag;
      } else if(getTile(0,loc[0],loc[1]) >= 1 && getTile(0,loc[0],loc[1]) < 2){
        self.innaWoods = true;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.3) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) >= 2 && getTile(0,loc[0],loc[1]) < 4){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.5) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) >= 4 && getTile(0,loc[0],loc[1]) < 5){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.6) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && !self.onMtn){
        self.innaWoods = false;
        self.maxSpd = (self.baseSpd * 0.2) * self.drag;
        setTimeout(function(){
          if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6){
            self.onMtn = true;
          }
        },2000);
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && self.onMtn){
        self.maxSpd = (self.baseSpd * 0.5) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) == 18){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 1.1) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) == 14 || getTile(0,loc[0],loc[1]) == 16 || getTile(0,loc[0],loc[1]) == 19){
        Building.list[b].occ++;
        self.z = 1;
        // DON'T clear path - preserve for building navigation
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * self.drag;
        // Clear movement to prevent loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      } else if(getTile(0,loc[0],loc[1]) == 0){
        self.z = -3;
        // DON'T clear path - preserve for underwater navigation
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.2)  * self.drag;
        // Clear movement to prevent loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      } else {
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd  * self.drag;
      }
    } else if(self.z == -1){
      if(getTile(1,loc[0],loc[1]) == 2){
        // On cave exit tile - only exit if path is complete (no active navigation)
        // This universal rule works for all entities without special cases
        if(!self.path || self.path.length === 0){
        self.caveEntrance = null;
        self.z = 0;
          // Clear path on successful exit (but this was already null/empty)
        self.path = null;
        self.pathCount = 0;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.9)  * self.drag;
        // Clear movement to prevent loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
        }
        // If there IS a path, don't exit - continue into cave
      }
    } else if(self.z == -2){
      if(getTile(8,loc[0],loc[1]) == 5){
        self.z = 1;
        // DON'T clear path - preserve for cross-floor navigation
        self.y += (tileSize/2);
        self.facing = 'down';
        // Clear movement to prevent infinite stair loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
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
      if(getTile(0,loc[0],loc[1]) != 0){
        self.z = 0;
        // DON'T clear path - preserve for navigation after surfacing
        self.breath = self.breathMax;
        // Clear movement to prevent loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      }
    } else if(self.z == 1){
      if(getTile(0,loc[0],loc[1] - 1) == 14 || getTile(0,loc[0],loc[1] - 1) == 16  || getTile(0,loc[0],loc[1] - 1) == 19){
        var exit = getBuilding(self.x,self.y-tileSize);
        if(Building.list[exit]){
        Building.list[exit].occ--;
          console.log(self.name + ' exited building ' + Building.list[exit].type + ' (z=1 -> z=0)');
        }
        self.z = 0;
        // DON'T clear path - preserve for navigation after exiting building
        // Clear movement to prevent loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      } else if(getTile(4,loc[0],loc[1]) == 3 || getTile(4,loc[0],loc[1]) == 4 || getTile(4,loc[0],loc[1]) == 7){
        self.z = 2;
        // DON'T clear path - preserve for multi-floor navigation
        self.y += (tileSize/2);
        self.facing = 'down';
        // Clear movement to prevent infinite stair loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      } else if(getTile(4,loc[0],loc[1]) == 5 || getTile(4,loc[0],loc[1]) == 6){
        self.z = -2;
        // DON'T clear path - preserve for cellar navigation
        self.y += (tileSize/2);
        self.facing = 'down';
        // Clear movement to prevent infinite stair loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      }
    } else if(self.z == 2){
      if(getTile(4,loc[0],loc[1]) == 3 || getTile(4,loc[0],loc[1]) == 4){
        self.z = 1;
        // DON'T clear path - preserve for multi-floor navigation
        self.y += (tileSize/2);
        self.facing = 'down';
        // Clear movement to prevent infinite stair loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      }
    }

    if(tempus == 'VI.a' && self.mode !== 'work' && !self.dayTimer){
      self.dayTimer = true;
      var rand = Math.floor(Math.random() * (3600000/(period*6)));
      setTimeout(function(){
        self.mode = 'work';
        self.action = null;
        self.dayTimer = false;
        console.log(self.name + ' heads to work');
      },rand);
    } else if(tempus == 'VI.p' && self.action == 'task' && !self.dayTimer){
      self.dayTimer = true;
      var rand = Math.floor(Math.random() * (3600000/(period*6)));
      setTimeout(function(){
        self.action = 'clockout';
        self.dayTimer = false;
        console.log(self.name + ' is clocking out');
      },rand);
    } else if(tempus == 'XI.p' && self.action == 'tavern' && !self.dayTimer){
      self.dayTimer = true;
      var rand = Math.floor(Math.random() * (3600000/(period/2)));
      setTimeout(function(){
        self.tether = null;
        self.action = 'home';
        self.dayTimer = false;
        console.log(self.name + ' heads home for the night');
      },rand);
    }

    if(self.idleTime > 0){
      self.idleTime--;
    }

    // WORK
    if(self.mode == 'work'){
      if(!Building.list[self.hut].built){
        var hut = Building.list[self.hut];
        var select = [];
        for(var i in hut.plot){
          var p = hut.plot[i];
          var t = getTile(0,p[0],p[1]);
          if(t == 11){
            select.push(p);
          }
        }
        self.work.spot = select[Math.floor(Math.random() * select.length)];
        self.action = 'build';
      } else if(self.work.hq){
        var hq = Building.list[self.work.hq];
        if(!self.action){
          if(Building.list[self.hut].built){ // if hut is built
            // Check if there are any resources available
            if(hq.resources && hq.resources.length > 0){
            var tDist = 0;
            var avgDist = null;
            for(var i in hq.resources){
              var res = hq.resources[i];
              var r = getCenter(res[0],res[1]);
              var dist = getDistance({x:hq.x,y:hq.y},{x:r[0],y:r[1]});
              tDist += dist;
            }
            avgDist = tDist/hq.resources.length;
            var select = [];
            for(var i in hq.resources){
              var res = hq.resources[i];
              var r = getCenter(res[0],res[1]);
              var dist = getDistance({x:hq.x,y:hq.y},{x:r[0],y:r[1]});
              if(dist <= avgDist){
                select.push(res);
              }
            }
              
              // Only assign task if we found a valid spot
              if(select.length > 0){
            self.work.spot = select[Math.floor(Math.random() * select.length)];
            Building.list[self.work.hq].log[self.id] = self.work.spot;
            self.action = 'task';
              console.log(self.name + ' working @ ' + hq.type);
            } else {
                // No resources within average distance, try again next frame
                self.idleTime = 30;
              }
            } else {
              // No resources available at all, idle for a bit
              self.idleTime = 60;
            }
          }
        } else if(self.action == 'build'){
          var spot = self.work.spot;
          var cs = getCenter(spot[0],spot[1]);
          var build = getBuilding(cs[0],cs[1]);
          if(Building.list[build].built){
            self.work.spot = null;
            self.action = null;
          } else {
            if(loc.toString() == spot.toString()){
                var gt = getTile(0,spot[0],spot[1]);
                if(gt == 11){
                  if(!self.building){
                    Build(self.id);
                  }
                } else {
                  var plot = Building.list[build].plot;
                  var select = [];
                  for(var i in plot){
                    var p = plot[i];
                    var t = getTile(0,p[0],p[1]);
                    if(t == 11){
                      select.push(p);
                    }
                  }
                  self.work.spot = select[Math.floor(Math.random() * select.length)];
                }
            } else {
              if(!self.path){
                self.moveTo(0,spot[0],spot[1]);
              }
            }
          }
        } else if(self.action == 'task'){
          var spot = self.work.spot;
          if(!spot){
            self.action = null;
          } else {
            if(self.inventory.grain == 10){
              var hq = Building.list[self.work.hq];
              var dropoff = [hq.plot[0][0],hq.plot[0][1]+1];
              if(loc.toString() == dropoff.toString()){
                self.facing = 'up';
                self.inventory.grain -= 9;
                var grainDeposited = 6;
                if(Player.list[hq.owner].house){
                  var h = Player.list[hq.owner].house;
                  House.list[h].stores.grain += grainDeposited;
                } else {
                  Player.list[hq.owner].stores.grain += grainDeposited
                }
                // Track daily deposits
                if(!hq.dailyStores) hq.dailyStores = {grain: 0};
                hq.dailyStores.grain += grainDeposited;
                
                self.inventory.flour += 3;
              } else {
                if(!self.path){
                  self.moveTo(0,dropoff[0],dropoff[1]);
                }
              }
            } else {
              if(loc.toString() == spot.toString()){
                var tile = getTile(0,spot[0],spot[1]);
                var res = getTile(6,spot[0],spot[1]);
                self.working = true;
                self.farming = true;
                if(!self.workTimer){
                  self.workTimer = true;
                  setTimeout(function(){
                    if(self.farming){
                      var b = getBuilding(self.x,self.y);
                      var f = Building.list[b];
                      // Safety check: ensure farm building still exists
                      if(!f || !f.plot){
                        console.log(self.name + ' farm building no longer exists, stopping work');
                        self.workTimer = false;
                        self.working = false;
                        self.farming = false;
                        return;
                      }
                      if(tile == 8){
                        tileChange(6,spot[0],spot[1],1,true);
                        var count = 0;
                        var next = [];
                        for(var i in f.plot){
                          var p = f.plot[i];
                          if(getTile(6,p[0],p[1]) >= 5){
                            count++;
                          } else {
                            next.push(p);
                          }
                        }
                        if(count == 9){
                          for(var i in f.plot){
                            var p = f.plot[i];
                            tileChange(0,p[0],p[1],9);
                          }
                          // Tile update automatically handled by tileChange function
                        } else {
                          var res = getTile(6,spot[0],spot[1]);
                          if(res >= 5){
                          for(var n in hq.resources){
                            var r = hq.resources[n];
                            if(r.toString() == spot.toString()){
                              Building.list[self.work.hq].resources.splice(n,1);
                              }
                            }
                          }
                          var rand = Math.floor(Math.random() * next.length);
                          self.work.spot = next[rand];
                          Building.list[self.work.hq].log[self.id] = self.work.spot;
                        }
                      } else if(tile == 9){
                        tileChange(6,spot[0],spot[1],1,true);
                        var count = 0;
                        var next = [];
                        for(var i in f.plot){
                          var p = f.plot[i];
                          if(getTile(6,p[0],p[1]) >= 10){
                            count++;
                          }
                        }
                        if(count == 9){
                          for(var i in f.plot){
                            var p = f.plot[i];
                            tileChange(0,p[0],p[1],10);
                            tileChange(6,p[0],p[1],10); // Initialize harvest with 10 resources
                          }
                          // Tile update automatically handled by tileChange function
                        } else {
                          var res = getTile(6,spot[0],spot[1]);
                          if(res >= 10){
                          for(var n in hq.resources){
                            var r = hq.resources[n];
                            if(r.toString() == spot.toString()){
                              Building.list[self.work.hq].resources.splice(n,1);
                              }
                            }
                          }
                          var rand = Math.floor(Math.random() * next.length);
                          self.work.spot = next[rand];
                          Building.list[self.work.hq].log[self.id] = self.work.spot;
                        }
                      } else {
                        tileChange(6,spot[0],spot[1],-1,true);
                        if(getTile(6,spot[0],spot[1]) == 0){
                          tileChange(0,spot[0],spot[1],8);
                          var count = 0;
                          var next = [];
                          for(var i in f.plot){
                            var p = f.plot[i]
                            var t = getTile(0,p[0],p[1]);
                            if(t == 8){
                              count++;
                            } else {
                              next.push(p);
                            }
                          }
                          if(count == 9){
                            for(var n in f.plot){
                              var p = f.plot[n];
                              if(p.toString() == spot.toString()){
                                continue;
                              } else {
                                Building.list[self.work.hq].resources.push(p);
                              }
                            }
                          } else {
                            for(var n in hq.resources){
                              var r = hq.resources[n];
                              if(r.toString() == spot.toString()){
                                Building.list[self.work.hq].resources.splice(n,1);
                              }
                            }
                            var rand = Math.floor(Math.random() * next.length);
                            self.work.spot = next[rand];
                            Building.list[self.work.hq].log[self.id] = self.work.spot;
                          }
                        }
                        // Tile update automatically handled by tileChange function
                      }
                    }
                    self.workTimer = false;
                    self.working = false;
                    self.farming = false;
                  },10000/self.strength);
                }
              } else {
                if(!self.path){
                  self.moveTo(0,spot[0],spot[1]);
                }
              }
            }
          }
        } else if(self.action == 'clockout'){
          self.working = false;
          self.building = false;
          self.farming = false;
          self.chopping = false;
          self.mining = false;
          var b = Building.list[self.work.hq];
          var drop = [b.plot[0][0],b.plot[0][1]+1];
          if(loc.toString() == drop.toString()){
            self.facing = 'up';
            if(self.inventory.grain >= 3){
              self.inventory.grain -= 3;
              var grainDeposited = 2;
              if(Player.list[b.owner].house){
                var h = Player.list[b.owner].house;
                House.list[h].stores.grain += grainDeposited;
              } else {
                Player.list[b.owner].stores.grain += grainDeposited
              }
              // Track daily deposits
              if(!b.dailyStores) b.dailyStores = {grain: 0};
              b.dailyStores.grain += grainDeposited;
              
              self.inventory.flour++;
            } else {
              self.mode = 'idle';
            }
          } else {
            if(!self.path){
              self.moveTo(0,drop[0],drop[1]);
            }
          }
        } else if(self.action == 'combat'){
          self.action = 'flee';
        } else if(self.action == 'flee'){
          if(self.combat.target){
            var target = Player.list[self.combat.target];
            if(target){
              var tLoc = getLoc(target.x,target.y);
              self.reposition(loc,tLoc);
            } else {
              self.combat.target = null;
              self.action = null;
            }
          } else {
            self.action = null;
          }
        }
      }
      // IDLE
    } else if(self.mode == 'idle'){
      if(!self.action){
        var cHome = getCenter(self.home.loc[0],self.home.loc[1]);
        var hDist = self.getDistance({
          x:cHome[0],
          y:cHome[1]
        });
        if(hDist > self.wanderRange){
          if(!self.path){
            self.return();
          }
        } else if(self.idleTime == 0){
          if(!self.path){  // Only create new wander if no current path
          var col = loc[0];
          var row = loc[1];
          var select = [[col,row-1],[col-1,row],[col,row+1],[col+1,row]];
          var target = select[Math.floor(Math.random() * 4)];
          if(target[0] < mapSize && target[0] > -1 && target[1] < mapSize && target[1] > -1){
            if(isWalkable(self.z,target[0],target[1])){
              self.move(target);
                self.idleTime = Math.floor(Math.random() * self.idleRange);  // SET, not ADD
              }
            }
          }
        }
      } else if(self.action == 'clockout'){
        var rand = Math.random();
        if(self.tavern){
          if(Building.list[self.tavern].market){
            var inv = self.inventory;
            if(inv.flour > 0 || inv.wood > 0 || inv.stone > 0 || inv.ironore > 0){
              self.action = 'market';
              console.log(self.name + ' heads to the market');
            } else {
              if(rand < 0.2 && (inv.gold > 0 || inv.silver > 0)){
                self.action = 'market';
                console.log(self.name + ' heads to the market');
              } else if(rand > 0.8){
                self.action = 'tavern';
                console.log(self.name + ' heads to the tavern');
              } else {
                self.action = 'home';
                console.log(self.name + ' heads home for the night');
              }
            }
          } else {
            if(rand < 0.8){
              self.action = 'home';
              console.log(self.name + ' heads home for the night');
            } else {
              self.action = 'tavern';
              console.log(self.name + ' heads to the tavern');
            }
          }
        } else {
          self.action = 'home';
          console.log(self.name + ' heads home for the night');
        }
      } else if(self.action == 'home'){
        // Navigate to home location
        if(self.home){
          var loc = getLoc(self.x, self.y);
          if(self.z != self.home.z || loc.toString() != self.home.loc.toString()){
            // Special case: If in cellar (z=-2) and home is outside (z=0), go upstairs first
            if(self.z == -2 && self.home.z == 0 && !self.path){
              var b = getBuilding(self.x, self.y);
              if(b){
                var building = Building.list[b];
                if(building && building.dstairs){
                  console.log(self.name + ' in cellar, going upstairs to exit');
                  self.moveTo(-2, building.dstairs[0], building.dstairs[1]);
                }
              }
            }
            // Special case: If on second floor (z=2) and home is outside (z=0), go downstairs first
            else if(self.z == 2 && self.home.z == 0 && !self.path){
              var b = getBuilding(self.x, self.y);
              if(b){
                var building = Building.list[b];
                if(building && building.ustairs){
                  console.log(self.name + ' on second floor, going downstairs to exit');
                  self.moveTo(2, building.ustairs[0], building.ustairs[1]);
                }
              }
            }
            // Special case: If inside a building (z=1) and home is outside (z=0), exit first
            else if(self.z == 1 && self.home.z == 0 && !self.path){
              // Find the door to exit
              var b = getBuilding(self.x, self.y);
              if(b){
                var building = Building.list[b];
                if(building && building.plot){
                  // Look for door tile in building plot
                  for(var i in building.plot){
                    var p = building.plot[i];
                    var tile = getTile(0, p[0], p[1]);
                    if(tile == 14 || tile == 16){ // Door tiles
                      console.log(self.name + ' inside building, exiting to go home');
                      // Path to the tile one tile DOWN from door (inside building, triggers exit when door is checked above)
                      self.moveTo(1, p[0], p[1] + 1);
                      break;
                    }
                  }
                }
              }
            }
            
            // Track how long we've been trying to go home
            if(!self.homeAttempts){
              self.homeAttempts = 0;
            }
            self.homeAttempts++;
            
            // If stuck trying to go home for too long, just become idle where we are
            if(self.homeAttempts > 600){ // 10 seconds at 60fps
              console.log(self.name + ' stuck trying to go home for too long, giving up');
              self.action = null;
              self.mode = 'idle';
              self.homeAttempts = 0;
              self.path = null; // Clear any bad path
              self.tether = null; // Clear tether
            } else {
              // Try to path to home
              if(!self.path){
                self.moveTo(self.home.z, self.home.loc[0], self.home.loc[1]);
              }
              // If still no path after trying to create one, we might be stuck
              if(!self.path && self.homeAttempts > 60){ // If no path after 1 second of trying
                if(self.homeAttempts > 180){ // Give up after 3 seconds of trying
                  console.log(self.name + ' stuck trying to go home for too long, giving up');
                  self.action = null;
                  self.mode = 'idle';
                  self.homeAttempts = 0;
                  self.tether = null;
                  self.path = null;
                } else if(self.homeAttempts % 60 == 0){ // Only log every 60 frames (1 second)
                console.log(self.name + ' cannot create path home, clearing tether and retrying');
                self.tether = null; // Clear tether in case it's blocking us
                self.path = null;
                }
              }
            }
          } else {
            // Arrived home, become idle
            self.action = null;
            self.mode = 'idle';
            self.homeAttempts = 0;
            console.log(self.name + ' has arrived home');
          }
        } else {
          // No home location, just become idle
          self.action = null;
          self.mode = 'idle';
          self.homeAttempts = 0;
          console.log(self.name + ' has no home, staying idle');
        }
      } else if(self.action == 'market'){
        var market = Building.list[self.tavern].market;
        var m = Building.list[market];
        if(getBuilding(self.x,self.y) != market){
          if(!self.path){
            var rand = Math.floor(Math.random() * m.plot.length);
            var dest = m.plot[rand];
            self.tether = {z:1,loc:dest};
            self.moveTo(1,dest[0],dest[1]);
          }
        } else {
          var inv = self.inventory;
          // if has inventory, sell inventory via market orderbook (ONCE per market visit)
          if(!self.hasPlacedMarketOrder){
            var soldSomething = false;
            
          if(inv.bread > 0){
              // Transfer bread to stores, then sell
              self.stores.grain = (self.stores.grain || 0) + inv.bread;
              inv.bread = 0;
              var price = 5; // Base price for bread
              global.processSellOrder(self.id, m, 'grain', self.stores.grain, price);
              soldSomething = true;
            } else if(inv.flour > 0){
              // Transfer flour to stores, then sell
              self.stores.grain = (self.stores.grain || 0) + inv.flour;
              inv.flour = 0;
              var price = 3; // Base price for flour
              global.processSellOrder(self.id, m, 'grain', self.stores.grain, price);
              soldSomething = true;
            }
            
            if(soldSomething){
              self.hasPlacedMarketOrder = true; // Mark that we've sold, don't sell again
              console.log(self.name + ' sold resources at market');
            }
          }
          
          if(!soldSomething){
            if(inv.silver > 0 || inv.gold > 0){
              // buy something nice
            }
            if(!self.dayTimer){
              self.dayTimer = true;
              var rand = Math.floor(Math.random() * (3600000/(period/3)));
              setTimeout(function(){
                self.tether = null;
                self.action = null;
                self.hasPlacedMarketOrder = false; // Reset for next market visit
                self.dayTimer = false;
                console.log(self.name + ' heads home for the night');
              },rand);
            }
            var ct = getCenter(self.tether.loc[0],self.tether.loc[1]);
            var tDist = self.getDistance({
              x:ct[0],
              y:ct[1]
            });
            if(tDist > self.wanderRange){
              if(!self.path){
                self.return();
              }
            } else if(self.idleTime == 0){
              var col = loc[0];
              var row = loc[1];
              var select = [[col,row-1],[col-1,row],[col,row+1],[col+1,row]];
              var target = select[Math.floor(Math.random() * 4)];
              if(target[0] < mapSize && target[0] > -1 && target[1] < mapSize && target[1] > -1){
                if(isWalkable(self.z,target[0],target[1])){
                  self.move(target);
                  self.idleTime += Math.floor(Math.random() * self.idleRange);
                }
              }
            }
          }
        }
      } else if(self.action == 'tavern'){
        var t = Building.list[self.tavern];
        if(getBuilding(self.x,self.y) != self.tavern){
          if(!self.path){
            var select = [];
            for(var i in t.plot){
              var p = t.plot[i];
              if(isWalkable(1,p[0],p[1])){
                select.push(p);
              }
            }
            var rand = Math.floor(Math.random() * select.length);
            var dest = select[rand];
            self.tether = {z:1,loc:dest};
            self.moveTo(1,dest[0],dest[1]);
          }
        } else {
          var ct = getCenter(self.tether.loc[0],self.tether.loc[1]);
          var tDist = self.getDistance({
            x:ct[0],
            y:ct[1]
          });
          if(tDist > self.wanderRange){
            if(!self.path){
              self.return();
            }
          } else if(self.idleTime == 0){
            var col = loc[0];
            var row = loc[1];
            var select = [[col,row-1],[col-1,row],[col,row+1],[col+1,row]];
            var target = select[Math.floor(Math.random() * 4)];
            if(target[0] < mapSize && target[0] > -1 && target[1] < mapSize && target[1] > -1){
              if(isWalkable(self.z,target[0],target[1])){
                self.move(target);
                self.idleTime += Math.floor(Math.random() * self.idleRange);
              }
            }
          }
        }
      } else if(self.action == 'combat'){
        self.action = 'flee';
      } else if(self.action == 'flee'){
        // Use SimpleFlee system for reliable fleeing (same as deer)
        if(global.simpleFlee){
          global.simpleFlee.update(self);
          } else {
          // Fallback: clear flee if no system available
            self.action = null;
          self.combat.target = null;
          self.baseSpd = 2;
        }
      }
    }
    self.updatePosition();
  }
}

Innkeeper = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'Innkeeper';
  self.sex = 'm';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
  self.torchBearer = true;
  self.unarmed = true;
  self.leashCheckTimer = 0; // Check leash every 5 seconds (300 frames)
  
  var super_update = self.update;
  self.update = function(){
    // Leashing system - keep innkeeper near tavern
    self.leashCheckTimer++;
    if(self.leashCheckTimer >= 300){
      self.leashCheckTimer = 0;
      
      if(self.home && self.home.loc){
        var homeCoords = getCenter(self.home.loc[0], self.home.loc[1]);
        var homeDist = self.getDistance({x: homeCoords[0], y: homeCoords[1]});
        var leashRange = 640; // 10 tiles
        
        if(homeDist > leashRange && self.z === 0){
          // Too far from tavern - return home
          if(!self.path && self.action !== 'combat'){
            console.log(self.name + ' wandered too far from tavern, returning home');
            self.action = 'returning';
            self.moveTo(self.home.z, self.home.loc[0], self.home.loc[1]);
          }
        } else if(self.action === 'returning' && homeDist <= leashRange * 0.5){
          // Back near tavern - resume normal behavior
          self.action = null;
          self.path = null;
        }
      }
    }
    
    // Call parent update
    super_update();
  }
}

Blacksmith = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'SerfM';
  self.sex = 'm';
  self.unarmed = true;
  self.forge = param.forge;
  self.work = 100;

  self.update = function(){
    var loc = getLoc(self.x,self.y);
    var b = getBuilding(self.x,self.y);
    self.zoneCheck();

    if(self.z == 0){
      if(getTile(0,loc[0],loc[1]) == 6){
        self.z = -1;
        // DON'T clear path - preserve for cave navigation
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * self.drag;
      } else if(getTile(0,loc[0],loc[1]) >= 1 && getTile(0,loc[0],loc[1]) < 2){
        self.innaWoods = true;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.3) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) >= 2 && getTile(0,loc[0],loc[1]) < 4){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.5) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) >= 4 && getTile(0,loc[0],loc[1]) < 5){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.6) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && !self.onMtn){
        self.innaWoods = false;
        self.maxSpd = (self.baseSpd * 0.2) * self.drag;
        setTimeout(function(){
          if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6){
            self.onMtn = true;
          }
        },2000);
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && self.onMtn){
        self.maxSpd = (self.baseSpd * 0.5) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) == 18){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 1.1) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) == 14 || getTile(0,loc[0],loc[1]) == 16 || getTile(0,loc[0],loc[1]) == 19){
        Building.list[b].occ++;
        self.z = 1;
        // DON'T clear path - preserve for building navigation
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * self.drag;
        // Clear movement to prevent loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      } else if(getTile(0,loc[0],loc[1]) == 0){
        self.z = -3;
        // DON'T clear path - preserve for underwater navigation
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.2)  * self.drag;
        // Clear movement to prevent loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      } else {
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd  * self.drag;
      }
    } else if(self.z == -1){
      // Decrement cave enter cooldown
      if(self.caveEnterCooldown > 0){
        self.caveEnterCooldown--;
      }
      
      if(getTile(1,loc[0],loc[1]) == 2){
        // On cave exit tile - check if we should exit
        var shouldExit = true;
        
        // Don't exit if just entered (cooldown active)
        if(self.caveEnterCooldown > 0){
          shouldExit = false;
        }
        // Don't exit if we have a path going deeper into the cave
        else if(self.path && self.path.length > 0){
          shouldExit = false;
        }
        // Special case: serfs in work mode with cave work spot and no ore
        else if(self.mode === 'work' && self.work && self.work.spot){
          var hq = Building.list[self.work.hq];
          if(hq && hq.cave && !self.inventory.ironore && !self.inventory.silverore && !self.inventory.goldore && !self.inventory.diamond){
            shouldExit = false;
          }
        }
        
        if(shouldExit){
          self.caveEnterCooldown = 0;
        self.z = 0;
        self.path = null;
        self.pathCount = 0;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.9)  * self.drag;
        }
      }
    } else if(self.z == -2){
      if(getTile(8,loc[0],loc[1]) == 5){
        self.z = 1;
        // DON'T clear path - preserve for cross-floor navigation
        self.y += (tileSize/2);
        self.facing = 'down';
        // Clear movement to prevent infinite stair loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
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
      if(getTile(0,loc[0],loc[1]) != 0){
        self.z = 0;
        // DON'T clear path - preserve for navigation after surfacing
        self.breath = self.breathMax;
        // Clear movement to prevent loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      }
    } else if(self.z == 1){
      if(getTile(0,loc[0],loc[1] - 1) == 14 || getTile(0,loc[0],loc[1] - 1) == 16  || getTile(0,loc[0],loc[1] - 1) == 19){
        var exit = getBuilding(self.x,self.y-tileSize);
        if(Building.list[exit]){
        Building.list[exit].occ--;
          console.log(self.name + ' exited building ' + Building.list[exit].type + ' (z=1 -> z=0)');
        }
        self.z = 0;
        // DON'T clear path - preserve for navigation after exiting building
        // Clear movement to prevent loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      } else if(getTile(4,loc[0],loc[1]) == 3 || getTile(4,loc[0],loc[1]) == 4 || getTile(4,loc[0],loc[1]) == 7){
        self.z = 2;
        // DON'T clear path - preserve for multi-floor navigation
        self.y += (tileSize/2);
        self.facing = 'down';
        // Clear movement to prevent infinite stair loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      } else if(getTile(4,loc[0],loc[1]) == 5 || getTile(4,loc[0],loc[1]) == 6){
        self.z = -2;
        // DON'T clear path - preserve for cellar navigation
        self.y += (tileSize/2);
        self.facing = 'down';
        // Clear movement to prevent infinite stair loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      }
    } else if(self.z == 2){
      if(getTile(4,loc[0],loc[1]) == 3 || getTile(4,loc[0],loc[1]) == 4){
        self.z = 1;
        // DON'T clear path - preserve for multi-floor navigation
        self.pathCount = 0;
        self.y += (tileSize/2);
        self.facing = 'down';
        // Clear movement to prevent infinite stair loops (except for ghosts)
        if(!self.ghost){
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      }
    }

    if(self.idleTime > 0){
      self.idleTime--;
    }

    //WORK
    if(self.mode == 'work'){
      if(self.loc.toString() != self.home.loc.toString()){
        if(!self.path){
          self.return();
        }
      } else {
        if(!self.action){
          self.facing = 'right';
          self.working = true;
          self.building = true;
          if(self.work > 0){
            self.work--;
          } else {
            if(self.house){
              var goldore = House.list[self.house].stores.goldore;
              var silverore = House.list[self.house].stores.silverore;
              var ironore = House.list[self.house].stores.ironore;
              if(goldore > 0){
                House.list[self.house].stores.goldore--;
                House.list[self.house].stores.gold++;
                console.log('Blacksmith: +1 gold');
                self.work += 100;
              } else if(silverore > 0){
                House.list[self.house].stores.silverore--;
                House.list[self.house].stores.silver++;
                console.log('Blacksmith: +1 silver');
                self.work += 100;
              } else if(ironore > 0){
                House.list[self.house].stores.ironore--;
                House.list[self.house].stores.iron++;
                console.log('Blacksmith: +1 iron');
                self.work += 100;
              } else {
                self.mode = 'idle';
                console.log('Blacksmith done');
              }
            } else {
              var p = Building.list[self.forge].owner;
              var goldore = Player.list[p].stores.goldore;
              var silverore = Player.list[p].stores.silverore;
              var ironore = Player.list[p].stores.ironore;
              if(goldore > 0){
                Player.list[p].stores.goldore--;
                Player.list[p].stores.gold++;
                console.log('Blacksmith: +1 gold');
                self.work += 100;
              } else if(silverore > 0){
                Player.list[p].stores.silverore--;
                Player.list[p].stores.silver++;
                console.log('Blacksmith: +1 silver');
                self.work += 100;
              } else if(ironore > 0){
                Player.list[p].stores.ironore--;
                Player.list[p].stores.iron++;
                console.log('Blacksmith: +1 iron');
                self.work += 100;
              } else {
                self.mode = 'idle';
                console.log('Blacksmith done');
              }
            }
          }
        } else if(self.action == 'combat'){
          self.action = 'flee';
        } else if(self.action == 'flee'){
          if(self.combat.target){
            var target = Player.list[self.combat.target];
            if(target){
              var tLoc = getLoc(target.x,target.y);
              self.reposition(loc,tLoc);
            } else {
              self.combat.target = null;
              self.action = null;
            }
          } else {
            self.action = null;
          }
        }
      }
      //IDLE
    } else if(self.mode == 'idle'){
      if(!self.action){
        var cHome = getCenter(self.home.loc[0],self.home.loc[1]);
        var hDist = self.getDistance({
          x:cHome[0],
          y:cHome[1]
        });
        if(hDist > self.wanderRange){
          if(!self.path){
            self.return();
          }
        } else if(self.idleTime == 0){
          if(!self.path){  // Only create new wander if no current path
          var col = loc[0];
          var row = loc[1];
          var select = [[col,row-1],[col-1,row],[col,row+1],[col+1,row]];
          var target = select[Math.floor(Math.random() * 4)];
          if(target[0] < mapSize && target[0] > -1 && target[1] < mapSize && target[1] > -1){
            if(isWalkable(self.z,target[0],target[1])){
              self.move(target);
                self.idleTime = Math.floor(Math.random() * self.idleRange);  // SET, not ADD
              }
            }
          }
        }
      } else if(self.action == 'combat'){
        self.action = 'flee';
      } else if(self.action == 'flee'){
        // Use SimpleFlee system for reliable fleeing (same as deer)
        if(global.simpleFlee){
          global.simpleFlee.update(self);
          } else {
          // Fallback: clear flee if no system available
            self.action = null;
          self.combat.target = null;
          self.baseSpd = 2;
        }
      }
    }
    self.updatePosition();
  }
  Building.list[self.forge].blacksmith = self.id;
}

Monk = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'Monk';
  self.sex = 'm';
  self.cleric = true;
  self.baseSpd = 2;
}

Bishop = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'Bishop';
  self.sex = 'm';
  self.rank = '♝ ';
  self.cleric = true;
  self.baseSpd = 2;
}

Friar = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'Friar';
  self.sex = 'm';
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
  self.sex = 'm';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
  self.torchBearer = true;
  self.unarmed = true;
}

Footsoldier = function(param){
  var self = Character(param);
  self.name = 'Footsoldier';
  self.class = 'Footsoldier';
  self.sex = 'm';
  self.military = true;
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3.5;
  self.damage = 10;
}

Skirmisher = function(param){
  var self = Character(param);
  self.name = 'Skirmisher';
  self.class = 'Skirmisher';
  self.sex = 'm';
  self.military = true;
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3.5;
  self.damage = 15;
}

Cavalier = function(param){
  var self = Character(param);
  self.name = 'Cavalier';
  self.class = 'Cavalier';
  self.sex = 'm';
  self.military = true;
  self.spriteSize = tileSize*1.5;
  self.mounted = true;
  self.baseSpd = 6.5;
  self.damage = 20;
}

General = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'General';
  self.sex = 'm';
  self.rank = '♞ ';
  self.spriteSize = tileSize*2;
  self.mounted = true;
  self.baseSpd = 6.5;
  self.damage = 25;
}

Warden = function(param){
  var self = Character(param);
  self.name = 'Warden';
  self.class = 'Warden';
  self.sex = 'm';
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
  self.sex = 'm';
  self.spriteSize = tileSize*2;
  self.damage = 15;
}

Hospitaller = function(param){
  var self = Character(param);
  self.name = 'Hospitaller';
  self.class = 'Hospitaller';
  self.sex = 'm';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
  self.damage = 20;
}

ImperialKnight = function(param){
  var self = Character(param);
  self.name = 'Imperial Knight';
  self.class = 'ImperialKnight';
  self.sex = 'm';
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
  self.sex = 'm';
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

Galley = function(param){
  var self = Character(param);
  self.class = 'Galley';
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
  self.sex = 'm';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3.5;
  self.damage = 5;
}

Oathkeeper = function(param){
  var self = Character(param);
  self.name = 'Oathkeeper';
  self.class = 'Oathkeeper';
  self.sex = 'm';
  self.rank = '♝ ';
  self.spriteSize = tileSize*1.5;
  self.cleric = true;
  self.baseSpd = 3.5;
  self.torchBearer = true;
}

Apparition = function(param){
  var self = Character(param);
  self.class = 'Apparition';
  self.spriteSize = tileSize*1.5;
  self.damage = 1;
}

Apollyon = function(param){
  var self = Character(param);
  self.name = 'APOLLYON';
  self.class = 'Apollyon';
  self.sex = 'm';
  self.rank = '♚ ';
  self.house = 'City of Destruction';
}

Goth = function(param){
  var self = Character(param);
  self.name = 'Goth';
  self.class = 'Goth';
  self.sex = 'm';
  self.military = true;
  self.spriteSize = tileSize*1.5;
  self.damage = 10;
}

Cataphract = function(param){
  var self = Character(param);
  self.name = 'Cataphract';
  self.class = 'Cataphract';
  self.sex = 'm';
  self.military = true;
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
  self.sex = 'm';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3.5;
  self.torchBearer = true;
  self.damage = 5;
}

HighPriestess = function(param){
  var self = Character(param);
  self.name = 'High Priestess';
  self.class = 'HighPriestess';
  self.sex = 'f';
  self.rank = '♝ ';
  self.spriteSize = tileSize*1.5;
  self.cleric = true;
  self.baseSpd = 3.5;
  self.torchBearer = true;
}

Alaric = function(param){
  var self = Character(param);
  self.name = 'Alaric I';
  self.class = 'Alaric';
  self.sex = 'm';
  self.rank = '♜ ';
}

Drakkar = function(param){
  var self = Character(param);
  self.name = 'Drakkar';
  self.class = 'Drakkar';
  self.ranged = true;
  self.torchBearer = true;
  self.damage = 15;
}

NorseSword = function(param){
  var self = Character(param);
  self.name = 'Norseman';
  self.class = 'NorseSword';
  self.sex = 'm';
  self.military = true;
  self.spriteSize = tileSize*1.5;
  self.damage = 15;
}

NorseSpear = function(param){
  var self = Character(param);
  self.name = 'Norseman';
  self.class = 'NorseSpear';
  self.sex = 'm';
  self.military = true;
  self.spriteSize = tileSize*1.5;
  self.damage = 15;
}

Seidr = function(param){
  var self = Character(param);
  self.name = 'Seidr';
  self.class = 'Seidr';
  self.sex = 'm';
  self.rank = '♝ ';
  self.cleric = true;
  self.baseSpd = 2;
}

Huskarl = function(param){
  var self = Character(param);
  self.name = 'Huskarl';
  self.class = 'Huskarl';
  self.sex = 'm';
  self.military = true;
  self.rank = '♞ ';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
  self.damage = 20;
}

FrankSword = function(param){
  var self = Character(param);
  self.name = 'Frank';
  self.class = 'FrankSword';
  self.sex = 'm';
  self.military = true;
  self.damage = 10;
}

FrankSpear = function(param){
  var self = Character(param);
  self.name = 'Frank';
  self.class = 'FrankSpear';
  self.sex = 'm';
  self.military = true;
  self.spriteSize = tileSize*2;
  self.damage = 10;
}

FrankBow = function(param){
  var self = Character(param);
  self.name = 'Frank';
  self.class = 'FrankBow';
  self.sex = 'm';
  self.military = true;
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
  self.sex = 'm';
  self.military = true;
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
  self.name = 'Charlemagne';
  self.class = 'Charlemagne';
  self.sex = 'm';
  self.rank = '♚ ';
  self.mounted = true;
  self.baseSpd = 6;
  self.spriteSize = tileSize*3;
  self.damage = 25;
}

CeltAxe = function(param){
  var self = Character(param);
  self.name = 'Celt';
  self.class = 'CeltAxe';
  self.sex = 'm';
  self.military = true;
  self.spriteSize = tileSize*1.5;
  self.damage = 10;
}

CeltSpear = function(param){
  var self = Character(param);
  self.name = 'Celt';
  self.class = 'CeltSpear';
  self.sex = 'm';
  self.military = true;
  self.spriteSize = tileSize*2;
  self.damage = 10;
}

Headhunter = function(param){
  var self = Character(param);
  self.name = 'Headhunter';
  self.class = 'Headhunter';
  self.sex = 'm';
  self.military = true;
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
  self.sex = 'm';
  self.rank = '♝ ';
  self.spriteSize = tileSize*1.5;
  self.cleric = true;
  self.baseSpd = 2;
  self.torchBearer = true;
}

ScoutShip = function(param){
  var self = Character(param);
  self.name = 'Scout Ship';
  self.class = 'ScoutShip';
  self.military = true;
  self.ranged = true;
  self.torchBearer = true;
  self.damage = 10;
}

Longship = function(param){
  var self = Character(param);
  self.name = 'Longship';
  self.class = 'Longship';
  self.military = true;
  self.ranged = true;
  self.torchBearer = true;
  self.damage = 10;
}


Morrigan = function(param){
  var self = Character(param);
  self.name = 'Morrigan';
  self.class = 'Morrigan';
  self.sex = 'f';
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
  self.sex = 'f';
  self.rank = '♛ ';
  self.torchBearer = true;
}

TeutonPike = function(param){
  var self = Character(param);
  self.name = 'Teuton';
  self.class = 'TeutonPike';
  self.sex = 'm';
  self.military = true;
  self.spriteSize = tileSize*2;
  self.damage = 15;
}

TeutonBow = function(param){
  var self = Character(param);
  self.name = 'Teuton';
  self.class = 'TeutonBow';
  self.sex = 'm';
  self.military = true;
  self.spriteSize = tileSize*1.5;
  self.ranged = true;
  self.damage = 10;
}

TeutonicKnight = function(param){
  var self = Character(param);
  self.name = 'Teutonic Knight';
  self.class = 'TeutonicKnight';
  self.sex = 'm';
  self.military = true;
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
  self.sex = 'm';
  self.cleric = true;
  self.baseSpd = 2;
  self.torchBearer = true;
}

Archbishop = function(param){
  var self = Character(param);
  self.name = 'Archbishop';
  self.class = 'Archbishop';
  self.sex = 'm';
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
  self.sex = 'm';
  self.rank = '♜ ';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
  self.torchBearer = true;
  self.damage = 25;
}

Trapper = function(param){
  var self = Character(param);
  self.name = 'Trapper';
  self.class = 'Trapper';
  self.sex = 'm';
  self.spriteSize = tileSize*1.5;
  self.damage = 10;
  self.stealthed = true;
  self.stealthTimer = false;
  var super_update = self.update;
  self.update = function(){
    if(!self.stealthed){
      if(((self.z == 0 && (nightfall || self.innaWoods)) || self.z == -1 || self.z == -2) && !self.stealthTimer && !self.action){
        self.stealthTimer = true;
        setTimeout(function(){
          if(((self.z == 0 && (nightfall || self.innaWoods)) || self.z == -1 || self.z == -2) && !self.action){
            self.stealthed = true;
            self.stealthTimer = false;
          }
        },3000);
      }
    }
    super_update();
  }
}

Outlaw = function(param){
  var self = Character(param);
  self.name = 'Outlaw';
  self.class = 'Outlaw';
  self.sex = 'm';
  self.spriteSize = tileSize*1.5;
  self.ranged = true;
  self.torchBearer = true;
  self.damage = 5;
}

Poacher = function(param){
  var self = Character(param);
  self.name = 'Poacher';
  self.class = 'Poacher';
  self.sex = 'm';
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
  self.sex = 'm';
  self.spriteSize = tileSize*1.5;
  self.damage = 10;
  self.stealthed = true;
  self.stealthTimer = false;
  var super_update = self.update;
  self.update = function(){
    if(!self.stealthed){
      if(((self.z == 0 && (nightfall || self.innaWoods)) || self.z == -1 || self.z == -2) && !self.stealthTimer && !self.action){
        self.stealthTimer = true;
        setTimeout(function(){
          if(((self.z == 0 && (nightfall || self.innaWoods)) || self.z == -1 || self.z == -2) && !self.action){
            self.stealthed = true;
            self.stealthTimer = false;
          }
        },3000);
      }
    }
    super_update();
  }
}

Strongman = function(param){
  var self = Character(param);
  self.name = 'Strongman';
  self.class = 'Strongman';
  self.sex = 'm';
  self.spriteSize = tileSize*2;
  self.baseSpd = 3.5;
  self.torchBearer = true;
  self.damage = 15;
}

Marauder = function(param){
  var self = Character(param);
  self.name = 'Marauder';
  self.class = 'Marauder';
  self.sex = 'm';
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
  self.sex = 'm';
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
        const zoneKey = `${zc},${zr}`;
        const zoneEntities = zones.get(zoneKey) || new Set();
        for(const entityId of zoneEntities){
          var p = Player.list[entityId];
          if(p){
            if(self.getDistance(p) < 32 && self.z == p.z && self.parent != p.id){
              Player.list[p.id].hp -= Player.list[self.parent].dmg - p.fortitude;
              Player.list[p.id].working = false;
              Player.list[p.id].chopping = false;
              Player.list[p.id].mining = false;
              Player.list[p.id].farming = false;
              Player.list[p.id].building = false;
              Player.list[p.id].fishing = false;
              Player.list[self.parent].stealthed = false;
              Player.list[self.parent].revealed = false;
              Player.list[p.id].combat.target = self.id;
              Player.list[p.id].action = 'combat';
              Player.list[p.id].stealthed = false;
              Player.list[p.id].revealed = false;
              // player death & respawn
              if(Player.list[p.id].hp <= 0){
                Player.list[p.id].die({id:self.parent,cause:'arrow'});
              }
              self.toRemove = true;
            }
          }
        }
      }
    }
    if(self.x == 0 || self.x == mapPx || self.y == 0 || self.y == mapPx){
      self.toRemove = true;
    } else if(self.z == 0 && getLocTile(0,self.x,self.y) == 5 &&
    getLocTile(0,Player.list[self.parent].x,Player.list[self.parent].y) != 5){
      self.toRemove = true;
    } else if(self.z == 0 && getLocTile(0,self.x,self.y) == 1 &&
    getLocTile(0,Player.list[self.parent].x,Player.list[self.parent].y) != 1){
      self.toRemove = true;
    } else if(self.z == 0 && (getLocTile(0,self.x,self.y) == 13 ||
    getLocTile(0,self.x,self.y) == 14 || getLocTile(0,self.x,self.y) == 15 ||
    getLocTile(0,self.x,self.y) == 16 || getLocTile(0,self.x,self.y) == 19)){
      self.toRemove = true;
    } else if(self.z == -1 && getLocTile(1,self.x,self.y) == 1){
      self.toRemove = true;
    } else if(self.z == -2 && getLocTile(8,self.x,self.y) == 0){
      self.toRemove = true;
    } else if(self.z == 1 &&
      (getLocTile(3,self.x,self.y) == 0 || getLocTile(4,self.x,self.y) != 0)){
      self.toRemove = true;
    } else if(self.z == 2 &&
      (getLocTile(5,self.x,self.y) == 0 || getLocTile(4,self.x,self.y) != 0)){
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Wood</b>.'}));
    } else if(player.inventory.wood + self.qty > 10){
      var q = 10 - player.inventory.wood;
      self.qty -= q;
      Player.list[id].inventory.wood += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Wood</b>.'}));
    } else {
      Player.list[id].inventory.wood += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Wood</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Stone</b>.'}));
    } else if(player.inventory.stone + self.qty > 10){
      var q = 10 - player.inventory.stone;
      self.qty -= q;
      Player.list[id].inventory.stone += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Stone</b>.'}));
    } else {
      Player.list[id].inventory.stone += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Stone</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>IronOre</b>.'}));
    } else if(player.inventory.ironore + self.qty > 10){
      var q = 10 - player.inventory.ironore;
      self.qty -= q;
      Player.list[id].inventory.ironore += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>IronOre</b>.'}));
    } else {
      Player.list[id].inventory.ironore += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>IronOre</b>.'}));
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// IRON BAR
Iron = function(param){
  var self = Item(param);
  self.type = 'Iron';
  self.class = 'resource';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.iron > 9){
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Iron</b>.'}));
    } else if(player.inventory.iron + self.qty > 10){
      var q = 10 - player.inventory.iron;
      self.qty -= q;
      Player.list[id].inventory.iron += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Iron</b>.'}));
    } else {
      Player.list[id].inventory.iron += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Iron</b>.'}));
      self.toRemove = true;
    }
  }
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// STEEL BAR
Steel = function(param){
  var self = Item(param);
  self.type = 'Steel';
  self.class = 'resource';
  self.rank = 0;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.steel > 9){
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Steel</b>.'}));
    } else if(player.inventory.steel + self.qty > 10){
      var q = 10 - player.inventory.steel;
      self.qty -= q;
      Player.list[id].inventory.steel += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Steel</b>.'}));
    } else {
      Player.list[id].inventory.steel += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Steel</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BoarHide</b>.'}));
    } else if(player.inventory.boarhide + self.qty > 25){
      var q = 25 - player.inventory.boarhide;
      self.qty -= q;
      Player.list[id].inventory.boarhide += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>BoarHide</b>.'}));
    } else {
      Player.list[id].inventory.boarhide += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>BoarHide</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Leather</b>.'}));
    } else if(player.inventory.leather + self.qty > 25){
      var q = 25 - player.inventory.leather;
      self.qty -= q;
      Player.list[id].inventory.leather += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Leather</b>.'}));
    } else {
      Player.list[id].inventory.leather += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Leather</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>SilverOre</b>.'}));
    } else if(player.inventory.silverore + self.qty > 10){
      var q = 10 - player.inventory.silverore;
      self.qty -= q;
      Player.list[id].inventory.silverore += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>SilverOre</b>.'}));
    } else {
      Player.list[id].inventory.silverore += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>SilverOre</b>.'}));
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
    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Silver</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>GoldOre</b>.'}));
    } else if(player.inventory.goldore + self.qty > 10){
      var q = 10 - player.inventory.goldore;
      self.qty -= q;
      Player.list[id].inventory.goldore += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>GoldOre</b>.'}));
    } else {
      Player.list[id].inventory.goldore += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>GoldOre</b>.'}));
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
    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Gold</b>.'}));
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
    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Diamond</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>HuntingKnife</b>.'}));
    } else if(player.inventory.huntingknife + self.qty > 10){
      var q = 10 - player.inventory.huntingknife;
      self.qty -= q;
      Player.list[id].inventory.huntingknife += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>HuntingKnife</b>.'}));
    } else {
      Player.list[id].inventory.huntingknife += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>HuntingKnife</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Dague</b>.'}));
    } else if(player.inventory.dague + self.qty > 10){
      var q = 10 - player.inventory.dague;
      self.qty -= q;
      Player.list[id].inventory.dague += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Dague</b>.'}));
    } else {
      Player.list[id].inventory.dague += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Dague</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Rondel</b>.'}));
    } else if(player.inventory.rondel + self.qty > 10){
      var q = 10 - player.inventory.rondel;
      self.qty -= q;
      Player.list[id].inventory.rondel += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Rondel</b>.'}));
    } else {
      Player.list[id].inventory.rondel += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Rondel</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Misericorde</b>.'}));
    } else if(player.inventory.misericorde + self.qty > 10){
      var q = 10 - player.inventory.misericorde;
      self.qty -= q;
      Player.list[id].inventory.misericorde += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Misericorde</b>.'}));
    } else {
      Player.list[id].inventory.misericorde += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Misericorde</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BastardSword</b>.'}));
    } else if(player.inventory.bastardsword + self.qty > 10){
      var q = 10 - player.inventory.bastardsword;
      self.qty -= q;
      Player.list[id].inventory.bastardsword += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>BastardSword</b>.'}));
    } else {
      Player.list[id].inventory. bastardsword += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>BastardSword</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Longsword</b>.'}));
    } else if(player.inventory.longsword + self.qty > 10){
      var q = 10 - player.inventory.longsword;
      self.qty -= q;
      Player.list[id].inventory.longsword += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Longsword</b>.'}));
    } else {
      Player.list[id].inventory.longsword += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Longsword</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Zweihander</b>.'}));
    } else if(player.inventory.zweihander + self.qty > 10){
      var q = 10 - player.inventory.zweihander;
      self.qty -= q;
      Player.list[id].inventory.zweihander += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Zweihander</b>.'}));
    } else {
      Player.list[id].inventory.zweihander += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Zweihander</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Morallta</b>.'}));
    } else if(player.inventory.morallta + self.qty > 10){
      var q = 10 - player.inventory.morallta;
      self.qty -= q;
      Player.list[id].inventory.morallta += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Morallta</b>.'}));
    } else {
      Player.list[id].inventory.morallta += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Morallta</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Bow</b>.'}));
    } else if(player.inventory.bow + self.qty > 10){
      var q = 10 - player.inventory.bow;
      self.qty -= q;
      Player.list[id].inventory.bow += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Bow</b>.'}));
    } else {
      Player.list[id].inventory.bow += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Bow</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>WelshLongbow</b>.'}));
    } else if(player.inventory.welshlongbow + self.qty > 10){
      var q = 10 - player.inventory.welshlongbow;
      self.qty -= q;
      Player.list[id].inventory.welshlongbow += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>WelshLongbow</b>.'}));
    } else {
      Player.list[id].inventory.welshlongbow += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>WelshLongbow</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>KnightLance</b>.'}));
    } else if(player.inventory.knightlance + self.qty > 10){
      var q = 10 - player.inventory.knightlance;
      self.qty -= q;
      Player.list[id].inventory.knightlance += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>KnightLance</b>.'}));
    } else {
      Player.list[id].inventory.knightlance += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>KnightLance</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>RusticLance</b>.'}));
    } else if(player.inventory.rusticlance + self.qty > 10){
      var q = 10 - player.inventory.rusticlance;
      self.qty -= q;
      Player.list[id].inventory.rusticlance += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>RusticLance</b>.'}));
    } else {
      Player.list[id].inventory.rusticlance += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>RusticLance</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>PaladinLance</b>.'}));
    } else if(player.inventory.paladinlance + self.qty > 10){
      var q = 10 - player.inventory.paladinlance;
      self.qty -= q;
      Player.list[id].inventory.paladinlance += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>PaladinLance</b>.'}));
    } else {
      Player.list[id].inventory.paladinlance += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>PaladinLance</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Brigandine</b>.'}));
    } else if(player.inventory.brigandine + self.qty > 10){
      var q = 10 - player.inventory.brigandine;
      self.qty -= q;
      Player.list[id].inventory.brigandine += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Brigandine</b>.'}));
    } else {
      Player.list[id].inventory.brigandine += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Brigandine</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Lamellar</b>.'}));
    } else if(player.inventory.lamellar + self.qty > 10){
      var q = 10 - player.inventory.lamellar;
      self.qty -= q;
      Player.list[id].inventory.lamellar += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Lamellar</b>.'}));
    } else {
      Player.list[id].inventory.lamellar += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Lamellar</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Maille</b>.'}));
    } else if(player.inventory.maille + self.qty > 10){
      var q = 10 - player.inventory.maille;
      self.qty -= q;
      Player.list[id].inventory.maille += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Maille</b>.'}));
    } else {
      Player.list[id].inventory.maille += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Maille</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Hauberk</b>.'}));
    } else if(player.inventory.hauberk + self.qty > 10){
      var q = 10 - player.inventory.hauberk;
      self.qty -= q;
      Player.list[id].inventory.hauberk += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Hauberk</b>.'}));
    } else {
      Player.list[id].inventory.hauberk += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Hauberk</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Brynja</b>.'}));
    } else if(player.inventory.brynja + self.qty > 10){
      var q = 10 - player.inventory.brynja;
      self.qty -= q;
      Player.list[id].inventory.brynja += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Brynja</b>.'}));
    } else {
      Player.list[id].inventory.brynja += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Brynja</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Cuirass</b>.'}));
    } else if(player.inventory.cuirass + self.qty > 10){
      var q = 10 - player.inventory.cuirass;
      self.qty -= q;
      Player.list[id].inventory.cuirass += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Cuirass</b>.'}));
    } else {
      Player.list[id].inventory.cuirass += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Cuirass</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>SteelPlate</b>.'}));
    } else if(player.inventory.steelplate + self.qty > 10){
      var q = 10 - player.inventory.steelplate;
      self.qty -= q;
      Player.list[id].inventory.steelplate += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>SteelPlate</b>.'}));
    } else {
      Player.list[id].inventory.steelplate += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>SteelPlate</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>GreenwichPlate</b>.'}));
    } else if(player.inventory.greenwichplate + self.qty > 10){
      var q = 10 - player.inventory.greenwichplate;
      self.qty -= q;
      Player.list[id].inventory.greenwichplate += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>GreenwichPlate</b>.'}));
    } else {
      Player.list[id].inventory.greenwichplate += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>GreenwichPlate</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>GothicPlate</b>.'}));
    } else if(player.inventory.gothicplate + self.qty > 10){
      var q = 10 - player.inventory.gothicplate;
      self.qty -= q;
      Player.list[id].inventory.gothicplate += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>GothicPlate</b>.'}));
    } else {
      Player.list[id].inventory.gothicplate += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>GothicPlate</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>ClericRobe</b>.'}));
    } else if(player.inventory.clericrobe + self.qty > 10){
      var q = 10 - player.inventory.clericrobe;
      self.qty -= q;
      Player.list[id].inventory.clericrobe += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>ClericRobe</b>.'}));
    } else {
      Player.list[id].inventory.clericrobe += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>ClericRobe</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>MonkCowl</b>.'}));
    } else if(player.inventory.monkcowl + self.qty > 10){
      var q = 10 - player.inventory.monkcowl;
      self.qty -= q;
      Player.list[id].inventory.monkcowl += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>MonkCowl</b>.'}));
    } else {
      Player.list[id].inventory.monkcowl += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>MonkCowl</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BlackCloak</b>.'}));
    } else if(player.inventory.blackcloak + self.qty > 10){
      var q = 10 - player.inventory.blackcloak;
      self.qty -= q;
      Player.list[id].inventory.blackcloak += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>BlackCloak</b>.'}));
    } else {
      Player.list[id].inventory.blackcloak += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>BlackCloak</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Tome</b>.'}));
    } else if(player.inventory.tome + self.qty > 10){
      var q = 10 - player.inventory.tome;
      self.qty -= q;
      Player.list[id].inventory.tome += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Tome</b>.'}));
    } else {
      Player.list[id].inventory.tome += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Tome</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>RunicScroll</b>.'}));
    } else if(player.inventory.runicscroll + self.qty > 10){
      var q = 10 - player.inventory.runicscroll;
      self.qty -= q;
      Player.list[id].inventory.runicscroll += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>RunicScroll</b>.'}));
    } else {
      Player.list[id].inventory.runicscroll += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>RunicScroll</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>SacredText</b>.'}));
    } else if(player.inventory.sacredtext + self.qty > 10){
      var q = 10 - player.inventory.sacredtext;
      self.qty -= q;
      Player.list[id].inventory.sacredtext += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>SacredText</b>.'}));
    } else {
      Player.list[id].inventory.sacredtext += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>SacredText</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>StoneAxe</b>.'}));
    } else if(player.inventory.stoneaxe + self.qty > 10){
      var q = 10 - player.inventory.stoneaxe;
      self.qty -= q;
      Player.list[id].inventory.stoneaxe += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>StoneAxe</b>.'}));
    } else {
      Player.list[id].inventory.stoneaxe += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>StoneAxe</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>IronAxe</b>.'}));
    } else if(player.inventory.ironaxe + self.qty > 10){
      var q = 10 - player.inventory.ironaxe;
      self.qty -= q;
      Player.list[id].inventory.ironaxe += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>IronAxe</b>.'}));
    } else {
      Player.list[id].inventory.ironaxe += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>IronAxe</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>PickAxe</b>.'}));
    } else if(player.inventory.pickaxe + self.qty > 10){
      var q = 10 - player.inventory.pickaxe;
      self.qty -= q;
      Player.list[id].inventory.pickaxe += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Pickaxe</b>.'}));
    } else {
      Player.list[id].inventory.pickaxe += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Pickaxe</b>.'}));
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
  self.name = param.name;
  self.class = 'tool';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up a </i><b>Key</b>.'}));
    Player.list[id].inventory.key++;
    Player.list[id].inventory.keyRing.push({id:self.id,name:self.name});
  }
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Torch</b>.'}));
    } else if(player.inventory.torch + self.qty > 25){
      var q = 25 - player.inventory.torch;
      self.qty -= q;
      Player.list[id].inventory.torch += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Torch</b>.'}));
    } else {
      Player.list[id].inventory.torch += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Torch</b>.'}));
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
    self.timer++;
    if(self.timer > 8000){
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

// FURNACE
Furnace = function(param){
  var self = Item(param);
  self.type = 'Furnace';
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

// BANNER
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
  self.inventory = Inventory();
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
  self.inventory = Inventory();
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Bread</b>.'}));
    } else if(player.inventory.bread + self.qty > 25){
      var q = 25 - player.inventory.bread;
      self.qty -= q;
      Player.list[id].inventory.bread += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Bread</b>.'}));
    } else {
      Player.list[id].inventory.bread += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Bread</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Fish</b>.'}));
    } else if(player.inventory.fish + self.qty > 25){
      var q = 25 - player.inventory.fish;
      self.qty -= q;
      Player.list[id].inventory.fish += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Fish</b>.'}));
    } else {
      Player.list[id].inventory.fish += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Fish</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Lamb</b>.'}));
    } else if(player.inventory.lamb + self.qty > 25){
      var q = 25 - player.inventory.lamb;
      self.qty -= q;
      Player.list[id].inventory.lamb += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Lamb</b>.'}));
    } else {
      Player.list[id].inventory.lamb += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Lamb</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>BoarMeat</b>.'}));
    } else if(player.inventory.boarmeat + self.qty > 25){
      var q = 25 - player.inventory.boarmeat;
      self.qty -= q;
      Player.list[id].inventory.boarmeat += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>BoarMeat</b>.'}));
    } else {
      Player.list[id].inventory.boarmeat += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>BoarMeat</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Venison</b>.'}));
    } else if(player.inventory.venison + self.qty > 25){
      var q = 25 - player.inventory.venison;
      self.qty -= q;
      Player.list[id].inventory.venison += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Venison</b>.'}));
    } else {
      Player.list[id].inventory.venison += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Venison</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>PoachedFish</b>.'}));
    } else if(player.inventory.poachedfish + self.qty > 25){
      var q = 25 - player.inventory.poachedfish;
      self.qty -= q;
      Player.list[id].inventory.poachedfish += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>PoachedFish</b>.'}));
    } else {
      Player.list[id].inventory.poachedfish += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>PoachedFish</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>LambChop</b>.'}));
    } else if(player.inventory.lambchop + self.qty > 25){
      var q = 25 - player.inventory.lambchop;
      self.qty -= q;
      Player.list[id].inventory.lambchop += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>LambChop</b>.'}));
    } else {
      Player.list[id].inventory.lambchop += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>LambChop</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BoarShank</b>.'}));
    } else if(player.inventory.boarshank + self.qty > 25){
      var q = 25 - player.inventory.boarshank;
      self.qty -= q;
      Player.list[id].inventory.boarshank += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>BoarShank</b>.'}));
    } else {
      Player.list[id].inventory.boarshank += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>BoarShank</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>VenisonLoin</b>.'}));
    } else if(player.inventory.venisonloin + self.qty > 25){
      var q = 25 - player.inventory.venisonloin;
      self.qty -= q;
      Player.list[id].inventory.venisonloin += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>VenisonLoin</b>.'}));
    } else {
      Player.list[id].inventory.venisonloin += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>VenisonLoin</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Mead</b>.'}));
    } else if(player.inventory.mead + self.qty > 25){
      var q = 25 - player.inventory.mead;
      self.qty -= q;
      Player.list[id].inventory.mead += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Mead</b>.'}));
    } else {
      Player.list[id].inventory.mead += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Mead</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Saison</b>.'}));
    } else if(player.inventory.saison + self.qty > 25){
      var q = 25 - player.inventory.saison;
      self.qty -= q;
      Player.list[id].inventory.saison += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Saison</b>.'}));
    } else {
      Player.list[id].inventory.saison += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Saison</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Flanders</b>.'}));
    } else if(player.inventory.flanders + self.qty > 25){
      var q = 25 - player.inventory.flanders;
      self.qty -= q;
      Player.list[id].inventory.flanders += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Flanders</b>.'}));
    } else {
      Player.list[id].inventory.flanders += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Flanders</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BiereDeGarde</b>.'}));
    } else if(player.inventory.bieredegarde + self.qty > 25){
      var q = 25 - player.inventory.bieredegarde;
      self.qty -= q;
      Player.list[id].inventory.bieredegarde += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>BiereDeGarde</b>.'}));
    } else {
      Player.list[id].inventory.bieredegarde += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>BiereDeGarde</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Bordeaux</b>.'}));
    } else if(player.inventory.bordeaux + self.qty > 25){
      var q = 25 - player.inventory.bordeaux;
      self.qty -= q;
      Player.list[id].inventory.bordeaux += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Bordeaux</b>.'}));
    } else {
      Player.list[id].inventory.bordeaux += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Bordeaux</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Bourgogne</b>.'}));
    } else if(player.inventory.bourgogne + self.qty > 25){
      var q = 25 - player.inventory.bourgogne;
      self.qty -= q;
      Player.list[id].inventory.bourgogne += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Bourgogne</b>.'}));
    } else {
      Player.list[id].inventory.bourgogne += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Bourgogne</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Chianti</b>.'}));
    } else if(player.inventory.chianti + self.qty > 25){
      var q = 25 - player.inventory.chianti;
      self.qty -= q;
      Player.list[id].inventory.chianti += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Chianti</b>.'}));
    } else {
      Player.list[id].inventory.chianti += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Chianti</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Crown</b>.'}));
    } else if(player.inventory.crown + self.qty > 10){
      var q = 10 - player.inventory.crown;
      self.qty -= q;
      Player.list[id].inventory.crown += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Crown</b>.'}));
    } else {
      Player.list[id].inventory.crown += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Crown</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Arrows</b>.'}));
    } else if(player.inventory.arrows + self.qty > 50){
      var q = 50 - player.inventory.arrows;
      self.qty -= q;
      Player.list[id].inventory.arrows += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>Arrows</b>.'}));
    } else {
      Player.list[id].inventory.arrows += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>Arrows</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>WorldMap</b>.'}));
    } else if(player.inventory.worldmap + self.qty > 10){
      var q = 10 - player.inventory.worldmap;
      self.qty -= q;
      Player.list[id].inventory.worldmap += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>WorldMap</b>.'}));
    } else {
      Player.list[id].inventory.worldmap += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>WorldMap</b>.'}));
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
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying a</i> <b>Relic</b>.'}));
    } else {
      Player.list[id].inventory.relic += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up the</i> <b>Relic</b>.'}));
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
    if(Item.list[self.parent].type == 'Campfire'){
      self.toUpdate = true;
    }
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

// SKELETON
Skeleton = function(param){
  var self = Item(param);
  self.variation = param.variation || Math.floor(Math.random() * 2); // 0 or 1
  self.type = self.variation === 0 ? 'Skeleton1' : 'Skeleton2'; // Match client expectations
  self.class = 'Skeleton';
  self.canPickup = false;
  self.blocker(0); // Skeletons don't block movement
  
  self.getInitPack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      z: self.z,
      type: self.type,
      innaWoods: self.innaWoods || false
    };
  };
  
  self.getUpdatePack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      z: self.z,
      innaWoods: self.innaWoods || false
    };
  };
  
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

// Export Skeleton globally for NPC death system
global.Skeleton = Skeleton;

// DROPPED ITEM (from death)
DroppedItem = function(param){
  var self = Item(param);
  self.type = 'DroppedItem';
  self.itemType = param.itemType; // 'inventory' or 'stores'
  self.itemName = param.itemName; // grain, wood, longsword, etc
  self.quantity = param.quantity;
  self.canPickup = true;
  self.blocker(0); // Dropped items don't block movement
  
  self.getInitPack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      z: self.z,
      type: self.type,
      itemType: self.itemType,
      itemName: self.itemName,
      quantity: self.quantity
    };
  };
  
  self.getUpdatePack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      z: self.z
    };
  };
  
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

