House = function(param){
  var self = Entity(param);
  self.type = param.type;
  self.name = param.name;
  self.flag = param.flag;
  self.hq = param.hq;
  self.leader = param.leader;
  self.kingdom = param.kingdom;
  self.hostile = param.hostile; // true = attacks neutral players/units
  self.underAttack = false;
  self.allies = [];
  self.enemies = [];

  self.spawnRate = 3600000/period;
  self.respawn = function(cl,spawn){ // 0:pawn, 1:knight/bishop, 2:rook, 3:king/queen
    if(self.spawn){
      var rand = Math.floor(Math.random() * spawnRate);
      setTimeout(function(){
        self.spawn(cl,spawn);
      },rand)
    }
  }

  self.chapter = 0;

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

  self.military = {
    units:{
      i:0,
      ii:0
    },
    territory:[self.hq],
    patrol:[self.hq],
    scout:{
      units:[],
      points:[]
    },
    alarm:null,
    campaign:{
      rally:null
    }
  }

  self.getTerritory = function(){
    var n = null;
    var w = null;
    var e = null;
    var s = null;
    for(var i in self.military.patrol){
      var building = Building.list[self.military.patrol[i]];
      if(!n || building.loc[1] < n){
        n = building.loc[1];
      }
      if(!w || building.loc[0] < w){
        w = building.loc[0];
      }
      if(!e || building.loc[0] > e){
        e = building.loc[0];
      }
      if(!s || building.loc[1] > s){
        s = building.loc[1];
      }
    }
    var nw = [w,n];
    var se = [e,s];
    var area = getArea(nw,se,5);
    return area;
  }
  self.update = function(){
    // tally military units
    for(var i in Player.list){
      var unit = Player.list[i];
      if(unit.house == self.id && unit.military){
        if(unit.rank == '♞ '){
          self.military.units.ii++;
        } else if(!unit.rank){
          self.military.units.i++;
        }
      }
    }
  }

  House.list[self.id] = self;
  emit({
    msg:'newFaction',
    houseList:House.list,
    kingdomList:Kingdom.list
  })
  return self;
}

House.list = {};

// Helper: Find safe location for firepit (avoids blocking important tiles like cave entrances)
function findSafeFirepitLocation(hq, z, grid) {
  // Check if HQ tile is a cave entrance (terrain 6) - if so, use adjacent tile
  if(z === 0 && global.getTile && global.getTile(0, hq[0], hq[1]) === 6){
    console.log(`HQ at [${hq}] is a cave entrance - placing firepit adjacent`);
    // Use first available tile from grid (already validated as walkable)
    if(grid && grid.length > 0){
      return grid[0]; // Return tile coords, not pixel coords
    }
  }
  
  // Default: place at HQ
  return hq;
}

House.update = function(){
  for(var i in House.list){
    var house = House.list[i];
    if(house.update){
      house.update();
    }
  }
}

// Faction AI evaluation (called once per in-game day)
House.evaluateAI = function(){
  for(var i in House.list){
    var house = House.list[i];
    if(house.ai && house.ai.evaluateAndAct){
      try {
        house.ai.evaluateAndAct();
      } catch (error) {
        console.error(`Error in ${house.name} AI:`, error);
      }
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
  self.spawn = function(cl,spawn){
    var c = getCenter(spawn.loc[0],spawn.loc[1]);
    if(cl == 'Brother'){
      Brother({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Oathkeeper'){
      Oathkeeper({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    }
  }
  self.init = function(){
    var grid = [];
    var area = getArea(self.hq,self.hq,4);
    for(var i in area){
      var t = area[i];
      if(isWalkable(-1,t[0],t[1]) && t.toString() != self.hq.toString()){
        grid.push(t);
      }
    }
    // fire
    var fireId = Math.random();
    var coords = getCoords(self.hq[0],self.hq[1]);
    Firepit({
      id:fireId,
      parent:self.id,
      x:coords[0],
      y:coords[1],
      z:-1,
      qty:1
    });
    self.scene.fire = fireId;
    // pawns
    if(grid.length < 3){
      console.warn(`Brotherhood: Insufficient walkable space at HQ [${self.hq}], only ${grid.length} tiles available`);
    }
    const spawnCount = Math.min(3, grid.length);
    for(var i = 0; i < spawnCount; i++){
      var rand = Math.floor(Math.random() * grid.length);
      var select = grid[rand];
      grid.splice(rand,1);
      var c = getCenter(select[0],select[1]);
      Brother({
        x:c[0],
        y:c[1],
        z:-1,
        house:self.id,
        home:{
          z:-1,
          loc:select
        }
      })
    }
    console.log('Brotherhood: ' + self.hq);
  }

  var super_update = self.update;
  self.update = function(){
    super_update();
    // check for next chapter conditions
  }
  self.init();
  
  // Initialize AI controller for Brotherhood (underground - no building goals)
  const FactionAI = require('./ai/FactionAI');
  Object.defineProperty(self, 'ai', {
    value: new FactionAI(self),
    writable: true,
    enumerable: false,
    configurable: true
  });
}

// GOTHS
Goths = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null
  }
  
  self.newSerfs = function(b,hq){
    var building = Building.list[b];
    var loc = getLoc(building.x,building.y);
    
    // Use new building placement system
    var hutSpot = global.tilemapSystem.findBuildingSpot('gothhut', loc, 5);
    
    if(hutSpot){
      var plot = hutSpot.plot;
      var walls = hutSpot.walls;
      for(var i in plot){
        var p = plot[i];
        tileChange(0,p[0],p[1],11);
        tileChange(6,p[0],p[1],0);
      }
      mapEdit();
      var center = getCoords(plot[3][0],plot[3][1]);
      var id = Math.random();
      Building({
        id:id,
        house:self.id,
        owner:self.id,
        x:center[0],
        y:center[1],
        z:0,
        type:'gothhut',
        built:false,
        plot:plot,
        walls:walls,
        mats:{
          wood:30,
          stone:0
        },
        req:5,
        hp:150
      })
      area = getArea(hq,hq,2);
      var grid = [];
      for(var i in area){
        var s = area[i];
        if(isWalkable(0,s[0],s[1])){
          grid.push(s);
        }
      }
      var rand = Math.floor(Math.random() * grid.length);
      var s1 = Math.random();
      var sp1 = grid[rand];
      var c1 = getCenter(sp1[0],sp1[1]);
      grid.splice(rand,1);
      rand = Math.floor(Math.random() * grid.length);
      var s2 = Math.random();
      var sp2 = grid[rand];
      var c2 = getCenter(sp2[0],sp2[1]);
      var work = {hq:b,spot:null};
      // For lumbermill/mine, first serf MUST be male; for mill/farm, can be either
      if(building.type == 'mill' || building.type == 'farm'){
        if(s1 > 0.4){
          SerfM({
            id:s1,
            name:'Serf',
            x:c1[0],
            y:c1[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp1},
            hut:id
          });
        } else {
          SerfF({
            id:s1,
            name:'Serf',
            x:c1[0],
            y:c1[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp1},
            hut:id
          });
        }
      } else {
        // Lumbermill or mine - first serf must be male
        SerfM({
          id:s1,
          name:'Serf',
          x:c1[0],
          y:c1[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp1},
          hut:id
        });
      }
      if(building.type == 'mill' || building.type == 'farm'){
        // Mills and farms can have either gender
        if(s2 > 0.6){
          SerfM({
            id:s2,
            name:'Serf',
            x:c2[0],
            y:c2[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp2},
            hut:id
          });
        } else {
          SerfF({
            id:s2,
            name:'Serf',
            x:c2[0],
            y:c2[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp2},
            hut:id
          });
        }
        Building.list[b].serfs[s1] = s1;
        Player.list[s1].work = {hq:b,spot:null};
        Building.list[b].serfs[s2] = s2;
        Player.list[s2].work = {hq:b,spot:null};
      } else {
        // Lumbermill or mine - second serf can be either, but only males get work assigned
        if(s2 > 0.5){
          SerfM({
            id:s2,
            name:'Serf',
            x:c2[0],
            y:c2[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp2},
            hut:id
          });
        } else {
          SerfF({
            id:s2,
            name:'Serf',
            x:c2[0],
            y:c2[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp2},
            hut:id
          });
        }
        // First serf is always male, so always assign
        Building.list[b].serfs[s1] = s1;
        Player.list[s1].work = {hq:b,spot:null};
        // Second serf only gets work if male
        if(Player.list[s2].sex == 'm'){
          Building.list[b].serfs[s2] = s2;
          Player.list[s2].work = {hq:b,spot:null};
        }
      }
      console.log('Serfs have spawned for Goths: ' + Building.list[b].type);
    }
  }
  self.spawn = function(cl,spawn){
    var c = getCenter(spawn.loc[0],spawn.loc[1]);
    if(cl == 'Goth'){
      Goth({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Acolyte'){
      Acolyte({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Cataphract'){
      Cataphract({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    }
  }
  self.init = function(){
    var grid = [];
    var area = getArea(self.hq,self.hq,5);
    for(var i in area){
      var t = area[i];
      if(isWalkable(0,t[0],t[1]) && t.toString() != self.hq.toString()){
        grid.push(t);
      }
    }
    // fire (avoid blocking cave entrances)
    var fireId = Math.random();
    var firepitLoc = findSafeFirepitLocation(self.hq, 0, grid);
    var coords = getCoords(firepitLoc[0], firepitLoc[1]);
    Firepit({
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
      var c = getCenter(select[0],select[1]);
      var flip = Math.random();
      if(flip < 0.618){
        Goth({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          }
        })
      } else {
        Acolyte({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          }
        })
      }
    }
    
    // GOTHS INITIALIZATION: Farming + Stone Mining
    const BASE_RADIUS = 10;
    const MIN_ROCKS_FOR_MINE = 15;
    const MIN_FOREST_FOR_LUMBERMILL = 10;
    
    const resources = global.tilemapSystem.assessBaseResources(self.hq, BASE_RADIUS, 0);
    console.log(`Goths @ [${self.hq}]: Grass=${resources.grass}, Forest=${resources.totalForest}, Rocks=${resources.rocks}`);
    
    // Use new building placement system for mills (tight radius for compact base)
    var excludedTiles = [self.hq]; // Start with HQ location
    var millSpot1 = global.tilemapSystem.findBuildingSpot('mill', self.hq, 5, {
      excludeTiles: excludedTiles
    });
    
    var m1 = null;
    var m2 = null;
    if(millSpot1){
      m1 = millSpot1.plot;
      var m1top = millSpot1.topPlot;
      var m1c = getCenter(m1[0][0],m1[0][1]);
      
      // Add mill plot to excluded tiles
      excludedTiles.push(...m1);
      for(var i in m1){
        var n = m1[i];
        tileChange(0,n[0],n[1],13);
        tileChange(3,n[0],n[1],String('mill' + i));
        matrixChange(0,n[0],n[1],1);
      }
      tileChange(5,m1top[0][0],m1top[0][1],'mill4');
      tileChange(5,m1top[1][0],m1top[1][1],'mill5');
      var mill1Id = Math.random();
      Mill({
        id:mill1Id,
        house:self.id,
        owner:self.id,
        x:m1c[0],
        y:m1c[1],
        z:0,
        type:'mill',
        built:true,
        plot:m1,
        topPlot:m1top,
        mats:{
          wood:40,
          stone:0
        },
        req:5,
        hp:150
      });
      
      
      // Place farm near mill using new system
      var farmSpot = global.tilemapSystem.findBuildingSpot('farm', m1[0], 4, {
        excludeTiles: excludedTiles
      });
      if(farmSpot){
        var fp = farmSpot.plot;
        excludedTiles.push(...fp);
        for(var p in fp){
          var n = fp[p];
          tileChange(0,n[0],n[1],8);
          tileChange(6,n[0],n[1],0);
        }
        var center = getCenter(fp[4][0],fp[4][1]);
        Farm({
          house:self.id,
          owner:self.id,
          x:center[0],
          y:center[1],
          z:0,
          type:'farm',
          built:true,
          plot:fp
        });
        // Farm auto-links to mill via findMill()
      }
      
      // Place second mill using new system (if possible)
      var millSpot2 = global.tilemapSystem.findBuildingSpot('mill', self.hq, 5, {
        excludedTiles: excludedTiles
      });
      
      if(millSpot2){
        m2 = millSpot2.plot;
        var m2top = millSpot2.topPlot;
        var m2c = getCenter(m2[0][0],m2[0][1]);
        excludedTiles.push(...m2);
        
        for(var i in m2){
          var n = m2[i];
          tileChange(0,n[0],n[1],13);
          tileChange(3,n[0],n[1],String('mill' + i));
          matrixChange(0,n[0],n[1],1);
        }
        tileChange(5,m2top[0][0],m2top[0][1],'mill4');
        tileChange(5,m2top[1][0],m2top[1][1],'mill5');
        var mill2Id = Math.random();
        Mill({
          id:mill2Id,
          house:self.id,
          owner:self.id,
          x:m2c[0],
          y:m2c[1],
          z:0,
          type:'mill',
          built:true,
          plot:m2,
          topPlot:m2top,
          mats:{
            wood:40,
            stone:0
          },
          req:5,
          hp:150
        });
        
        
        // Place farm near second mill
        var farmSpot2 = global.tilemapSystem.findBuildingSpot('farm', m2[0], 4, {
          excludeTiles: excludedTiles
        });
        if(farmSpot2){
          var fp2 = farmSpot2.plot;
          for(var p in fp2){
            var n = fp2[p];
            tileChange(0,n[0],n[1],8);
            tileChange(6,n[0],n[1],0);
          }
          var center2 = getCenter(fp2[4][0],fp2[4][1]);
          Farm({
            house:self.id,
            owner:self.id,
            x:center2[0],
            y:center2[1],
            z:0,
            type:'farm',
            built:true,
            plot:fp2
          });
          // Farm auto-links to mill via findMill()
        }
      }
    }
    
    // Track what was built
    var millsBuilt = 0;
    var farmsBuilt = 0;
    
    if(m1){
      millsBuilt++;
      if(farmSpot){
        farmsBuilt++;
      }
    }
    if(m2){
      millsBuilt++;
      if(farmSpot2){
        farmsBuilt++;
      }
    }
    
    // PRIORITY 2: Build stone mine if enough rocks
    if(resources.rocks >= MIN_ROCKS_FOR_MINE){
      const mineSpot = global.tilemapSystem.findBuildingSpot('mine', self.hq, 7, {
        excludeTiles: excludedTiles
      });
      
      if(mineSpot){
        const plot = mineSpot.plot;
        const center = getCenter(plot[0][0], plot[0][1]);
        
        for(var i in plot){
          tileChange(0,plot[i][0],plot[i][1],13);
          tileChange(3,plot[i][0],plot[i][1],String('mine' + i));
          matrixChange(0,plot[i][0],plot[i][1],1);
        }
        
        Mine({
          id:Math.random(),
          house:self.id,
          owner:self.id,
          x:center[0],
          y:center[1],
          z:0,
          type:'mine',
          built:true,
          plot:plot,
          mats:{wood:40, stone:0},
          req:5,
          hp:150
        });
        
        console.log(`Goths: Stone mine built at [${plot[0]}]`);
      }
    }
    
    // PRIORITY 3: Build lumbermill if enough forest
    if(resources.totalForest >= MIN_FOREST_FOR_LUMBERMILL){
      const lumberSpot = global.tilemapSystem.findBuildingSpot('lumbermill', self.hq, 7, {
        excludeTiles: excludedTiles
      });
      
      if(lumberSpot){
        const plot = lumberSpot.plot;
        const nearbyForest = global.tilemapSystem.countNearbyTerrain(plot[0], [1, 2], 5, 0);
        
        if(nearbyForest >= 8){
          const topPlot = lumberSpot.topPlot;
          const center = getCenter(plot[0][0], plot[0][1]);
          
          for(var i in plot){
            tileChange(0,plot[i][0],plot[i][1],13);
            tileChange(3,plot[i][0],plot[i][1],String('lumbermill' + i));
            matrixChange(0,plot[i][0],plot[i][1],1);
          }
          tileChange(5,topPlot[0][0],topPlot[0][1],'lumbermill2');
          tileChange(5,topPlot[1][0],topPlot[1][1],'lumbermill3');
          
          Lumbermill({
            id:Math.random(),
            house:self.id,
            owner:self.id,
            x:center[0],
            y:center[1],
            z:0,
            type:'lumbermill',
            built:true,
            plot:plot,
            topPlot:topPlot,
            mats:{wood:25, stone:0},
            req:5,
            hp:100
          });
          
          console.log(`Goths: Lumbermill built at [${plot[0]}] (${nearbyForest} forest nearby)`);
        }
      }
    }
    
    mapEdit();
    console.log(`Goths initialization complete: ${millsBuilt} mills, ${farmsBuilt} farms`);
  }
  self.scout = function(start){
    var points = [];
    var grid = [];
    var area = getArea(start,start,24);
    for(var i in area){
      var sc = getCenter(start[0],start[1]);
      var t = area[i];
      var gt = getTile(0,t[0],t[1]);
      var tc = getCenter(t[0],t[1]);
      var dist = getDistance({x:sc[0],y:sc[1]},{x:tc[0],y:tc[1]});
      if(((gt >= 3 && gt < 4) || gt == 7) && dist > 768){
        grid.push(t);
      }
    }
    for(var i in grid){
      var t = grid[i];
      var tArea = getArea(t,t,12);
      var count = 0;
      for(var a in tArea){
        var gt = getTile(0,a[0],a[1]);
        if((gt >= 3 && gt < 4) || gt == 7){
          count++;
        }
      }
      if(count > (tArea.length * 0.75)){
        points.push(t);
      }
    }
    var rand = Math.floor(Math.random() * points.length);
    var target = points[rand];
    var units = [];
    for(var i in Player.list){
      var unit = Player.list[i];
      if(unit.house == self.id && unit.type == 'npc' && unit.mounted){
        units.push(unit.id);
      }
    }
    rand = Math.floor(Math.random() * units.length);
    Player.list[units[rand]].scout.target = target;
    Player.list[units[rand]].scout.return = self.hq;
    Player.list[units[rand]].mode = 'scout';
    console.log(self.name + ' have sent a scout to ' + target);
  }
  self.expand = function(point){
    console.log(self.name + ' are claiming new territory');
    var fp = getCoords(point[0],point[1]);
    var pc = point[0];
    var pr = point[1];
    Firepit({
      x:fp[0],
      y:fp[1],
      z:0,
      qty:1,
      parent:self.id
    });
    var grid = [
      [pc-2,pr-2],[pc-1,pr-2],[pc,pr-2],[pc+1,pr-2],[pc+2,pr-2],
      [pc-2,pr-1],[pc+1,pr-1],[pc+2,pr-1],
      [pc-2,pr],[pc+1,pr],[pc+2,pr]];
    var rand = Math.floor(Math.random() * grid.length);
    var twr = grid[rand];
    var plot = [twr,[twr[0]+1,twr[1]],[twr[0],twr[1]+1],[twr[0]+1,twr[1]+1]];
    var topPlot = [[twr[0],twr[1]-1],[twr[0]+1,twr[1]-1]];
    for(var i in plot){
      tileChange(0,plot[i][0],plot[i][1],11);
      tileChange(6,plot[i][0],plot[i][1],0);
    }
    var coords = getCoords(twr[0],twr[1]);
    Guardtower({
      owner:self.id,
      house:self.id,
      kingdom:self.kingdom,
      x:coords[0],
      y:coords[1],
      z:0,
      type:'gothtower',
      built:false,
      plot:plot,
      topPlot:topPlot
    })
  }

  var super_update = self.update;
  self.update = function(){
    super_update();
    // check for next chapter conditions
    if(self.chapter == 0){
      for(var b in Building.list){
        var building = Building.list[b];
        if(building.house == self.id && building.type == 'gothmarket' && building.built){
          self.chapter = 1;
        }
      }
      if(self.chapter == 0 && self.stores.grain >= 100){
        var terr = self.getTerritory();
        var plots = [];
        for(var i in terr){
          var t = terr[i];
          var tc = t[0];
          var tr = t[1];
          var count = 0;
          var grid = [
            t,[tc+1,tr],[tc+2,tr],[tc+3,tr],[tc+4,tr],[tc+5,tr],
            [tc,tr+1],[tc+1,tr+1],[tc+2,tr+1],[tc+3,tr+1],[tc+4,tr+1],[tc+5,tr+1],
            [tc,tr+2],[tc+1,tr+2],[tc+2,tr+2],[tc+3,tr+2],[tc+4,tr+2],[tc+5,tr+2],
            [tc,tr+3],[tc+1,tr+3],[tc+2,tr+3],[tc+3,tr+3],[tc+4,tr+3],[tc+5,tr+3]
          ]
          for(var g in grid){
            var gt = getTile(0,grid[g][0],grid[g][1]);
            if((gt >= 3 && gt < 4) || gt == 7){
              count++
            }
          }
          if(count == 24){
            plots.push(grid);
          }
        }
        if(plots.length > 0){
          var rand = Math.floor(Math.random() * plots.length);
          var select = plots[rand];
          var plot = [select[7],select[8],select[9],select[10],select[13],select[14],select[15],select[16]];
          var walls = [select[1],select[2],select[3],select[4]];
          var topPlot = [select[2],select[3]];
          var ent = plot[7];
          var coords = getCoords(ent[0],ent[1]);
          for(var i in plot){
            var p = plot[i];
            tileChange(0,p[0],p[1],11);
            tileChange(6,p[0],p[1],0);
          }
          mapEdit();
          Market({
            owner:self.id,
            house:self.id,
            kingdom:self.kingdom,
            x:coords[0],
            y:coords[1],
            z:0,
            type:'gothmarket',
            built:false,
            plot:plot,
            walls:walls,
            topPlot:topPlot,
            mats:{
              wood:75,
              stone:0
            },
            req:5,
            hp:500
          });
        }
      }
    } else if(self.chapter == 1){
      if(self.military.scout.units.length < self.military.territory.length){
        self.scout(self.hq);
      }
    }
  }
  self.init();
  
  // Initialize AI controller for Goths
  const FactionAI = require('./ai/FactionAI');
  Object.defineProperty(self, 'ai', {
    value: new FactionAI(self),
    writable: true,
    enumerable: false, // Exclude from JSON.stringify
    configurable: true
  });
  
  // Give starting resources for AI-driven development
  self.stores.wood = 100;
  self.stores.stone = 60;
  self.stores.grain = 50;
}

// NORSEMEN
Norsemen = function(param){
  var self = House(param);
  self.scene = {
    // objects
    runestone:null,
    fire:null
  }
  self.init = function(){

  }
  
  // Initialize AI controller for Norsemen
  const FactionAI = require('./ai/FactionAI');
  Object.defineProperty(self, 'ai', {
    value: new FactionAI(self),
    writable: true,
    enumerable: false, // Exclude from JSON.stringify
    configurable: true
  });
  
  // Give starting resources for AI-driven development
  self.stores.wood = 100;
  self.stores.stone = 60;
  self.stores.grain = 50;
}

// FRANKS
Franks = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null
  }
  self.newSerfs = function(b,hq){
    var building = Building.list[b];
    var loc = getLoc(building.x,building.y);
    
    // Use new building placement system
    var hutSpot = global.tilemapSystem.findBuildingSpot('frankhut', loc, 5);
    
    if(hutSpot){
      var plot = hutSpot.plot;
      var walls = hutSpot.walls;
      for(var i in plot){
        var p = plot[i];
        tileChange(0,p[0],p[1],11);
        tileChange(6,p[0],p[1],0);
      }
      mapEdit();
      var center = getCoords(plot[3][0],plot[3][1]);
      var id = Math.random();
      Building({
        id:id,
        house:self.id,
        owner:self.id,
        x:center[0],
        y:center[1],
        z:0,
        type:'frankhut',
        built:false,
        plot:plot,
        walls:walls,
        mats:{
          wood:30,
          stone:0
        },
        req:5,
        hp:150
      })
      area = getArea(hq,hq,2);
      var grid = [];
      for(var i in area){
        var s = area[i];
        if(isWalkable(0,s[0],s[1])){
          grid.push(s);
        }
      }
      var rand = Math.floor(Math.random() * grid.length);
      var s1 = Math.random();
      var sp1 = grid[rand];
      var c1 = getCenter(sp1[0],sp1[1]);
      grid.splice(rand,1);
      rand = Math.floor(Math.random() * grid.length);
      var s2 = Math.random();
      var sp2 = grid[rand];
      var c2 = getCenter(sp2[0],sp2[1]);
      var work = {hq:b,spot:null};
      // For lumbermill/mine, first serf MUST be male; for mill/farm, can be either
      if(building.type == 'mill' || building.type == 'farm'){
        if(s1 > 0.4){
          SerfM({
            id:s1,
            name:'Serf',
            x:c1[0],
            y:c1[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp1},
            hut:id
          });
        } else {
          SerfF({
            id:s1,
            name:'Serf',
            x:c1[0],
            y:c1[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp1},
            hut:id
          });
        }
      } else {
        // Lumbermill or mine - first serf must be male
        SerfM({
          id:s1,
          name:'Serf',
          x:c1[0],
          y:c1[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp1},
          hut:id
        });
      }
      if(building.type == 'mill' || building.type == 'farm'){
        // Mills and farms can have either gender
        if(s2 > 0.6){
          SerfM({
            id:s2,
            name:'Serf',
            x:c2[0],
            y:c2[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp2},
            hut:id
          });
        } else {
          SerfF({
            id:s2,
            name:'Serf',
            x:c2[0],
            y:c2[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp2},
            hut:id
          });
        }
        Building.list[b].serfs[s1] = s1;
        Player.list[s1].work = {hq:b,spot:null};
        Building.list[b].serfs[s2] = s2;
        Player.list[s2].work = {hq:b,spot:null};
      } else {
        // Lumbermill or mine - second serf can be either, but only males get work assigned
        if(s2 > 0.5){
          SerfM({
            id:s2,
            name:'Serf',
            x:c2[0],
            y:c2[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp2},
            hut:id
          });
        } else {
          SerfF({
            id:s2,
            name:'Serf',
            x:c2[0],
            y:c2[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp2},
            hut:id
          });
        }
        // First serf is always male, so always assign
        Building.list[b].serfs[s1] = s1;
        Player.list[s1].work = {hq:b,spot:null};
        // Second serf only gets work if male
        if(Player.list[s2].sex == 'm'){
          Building.list[b].serfs[s2] = s2;
          Player.list[s2].work = {hq:b,spot:null};
        }
      }
      console.log('Serfs have spawned for Franks: ' + Building.list[b].type);
    }
  }
  self.spawn = function(cl,spawn){
    var c = getCenter(spawn.loc[0],spawn.loc[1]);
    if(cl == 'FrankSword'){
      FrankSword({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'FrankSpear'){
      FrankSpear({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'FrankBow'){
      FrankBow({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Carolingian'){
      Carolingian({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    }
  }
  self.init = function(){
    var grid = [];
    var area = getArea(self.hq,self.hq,5);
    for(var i in area){
      var t = area[i];
      if(isWalkable(0,t[0],t[1]) && t.toString() != self.hq.toString()){
        grid.push(t);
      }
    }
    // fire (avoid blocking cave entrances)
    var fireId = Math.random();
    var firepitLoc = findSafeFirepitLocation(self.hq, 0, grid);
    var coords = getCoords(firepitLoc[0], firepitLoc[1]);
    Firepit({
      id:fireId,
      parent:self.id,
      x:coords[0],
      y:coords[1],
      z:0,
      qty:1
    });
    self.scene.fire = fireId;
    
    // FRANKS INITIALIZATION: Heavy Farming + Opportunistic Resources
    const BASE_RADIUS = 12;
    const MIN_FOREST_FOR_LUMBERMILL = 15;
    const MIN_ROCKS_FOR_MINE = 20;
    
    const resources = global.tilemapSystem.assessBaseResources(self.hq, BASE_RADIUS, 0);
    console.log(`Franks @ [${self.hq}]: Grass=${resources.grass}, Forest=${resources.totalForest}, Rocks=${resources.rocks}, Caves=${resources.caveEntrances.length}`);
    
    // pawns
    for(var i = 0; i < 4; i++){
      var rand = Math.floor(Math.random() * grid.length);
      var select = grid[rand];
      grid.splice(rand,1);
      var c = getCenter(select[0],select[1]);
      var flip = Math.random();
      if(flip < 0.25){
        FrankSword({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          }
        })
      } else if(flip < 0.5){
        FrankBow({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          },
        })
      } else {
        FrankSpear({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          }
        })
      }
    }
    
    // Use new building placement system for mills (tight radius for compact base)
    var excludedTiles = [self.hq];
    var millSpot1 = global.tilemapSystem.findBuildingSpot('mill', self.hq, 5, {
      excludeTiles: excludedTiles
    });
    
    var m1 = null;
    var m2 = null;
    if(millSpot1){
      m1 = millSpot1.plot;
      var m1top = millSpot1.topPlot;
      var m1c = getCenter(m1[0][0],m1[0][1]);
      excludedTiles.push(...m1);
      
      for(var i in m1){
        var n = m1[i];
        tileChange(0,n[0],n[1],13);
        tileChange(3,n[0],n[1],String('mill' + i));
        matrixChange(0,n[0],n[1],1);
      }
      tileChange(5,m1top[0][0],m1top[0][1],'mill4');
      tileChange(5,m1top[1][0],m1top[1][1],'mill5');
      var frankMill1Id = Math.random();
      Mill({
        id:frankMill1Id,
        house:self.id,
        owner:self.id,
        x:m1c[0],
        y:m1c[1],
        z:0,
        type:'mill',
        built:true,
        plot:m1,
        topPlot:m1top,
        mats:{
          wood:40,
          stone:0
        },
        req:5,
        hp:150
      });
      
      
      // Place farm near mill
      var farmSpot = global.tilemapSystem.findBuildingSpot('farm', m1[0], 4, {
        excludeTiles: excludedTiles
      });
      if(farmSpot){
        var fp = farmSpot.plot;
        excludedTiles.push(...fp);
        for(var p in fp){
          var n = fp[p];
          tileChange(0,n[0],n[1],8);
          tileChange(6,n[0],n[1],0);
        }
        var center = getCenter(fp[4][0],fp[4][1]);
        Farm({
          house:self.id,
          owner:self.id,
          x:center[0],
          y:center[1],
          z:0,
          type:'farm',
          built:true,
          plot:fp
        });
        // Farm auto-links to mill via findMill()
      }
      
      // Place second mill
      var millSpot2 = global.tilemapSystem.findBuildingSpot('mill', self.hq, 5, {
        excludeTiles: excludedTiles
      });
      
      if(millSpot2){
        m2 = millSpot2.plot;
        var m2top = millSpot2.topPlot;
        var m2c = getCenter(m2[0][0],m2[0][1]);
        excludedTiles.push(...m2);
        
        for(var i in m2){
          var n = m2[i];
          tileChange(0,n[0],n[1],13);
          tileChange(3,n[0],n[1],String('mill' + i));
          matrixChange(0,n[0],n[1],1);
        }
        tileChange(5,m2top[0][0],m2top[0][1],'mill4');
        tileChange(5,m2top[1][0],m2top[1][1],'mill5');
        var frankMill2Id = Math.random();
        Mill({
          id:frankMill2Id,
          house:self.id,
          owner:self.id,
          x:m2c[0],
          y:m2c[1],
          z:0,
          type:'mill',
          built:true,
          plot:m2,
          topPlot:m2top,
          mats:{
            wood:40,
            stone:0
          },
          req:5,
          hp:150
        });
        
        
        // Place farm near second mill
        var farmSpot2 = global.tilemapSystem.findBuildingSpot('farm', m2[0], 4, {
          excludedTiles: excludedTiles
        });
        if(farmSpot2){
          var fp2 = farmSpot2.plot;
          for(var p in fp2){
            var n = fp2[p];
            tileChange(0,n[0],n[1],8);
            tileChange(6,n[0],n[1],0);
          }
          var center2 = getCenter(fp2[4][0],fp2[4][1]);
          Farm({
            house:self.id,
            owner:self.id,
            x:center2[0],
            y:center2[1],
            z:0,
            type:'farm',
            built:true,
            plot:fp2
          });
          // Farm auto-links to mill via findMill()
        }
      }
    }
    
    // Track primary buildings
    var millsBuilt = 0;
    var farmsBuilt = 0;
    if(m1){
      millsBuilt++;
      if(farmSpot){
        farmsBuilt++;
      }
    }
    if(m2){
      millsBuilt++;
      if(farmSpot2){
        farmsBuilt++;
      }
    }
    
    // SECONDARY BUILDINGS: Opportunistic resource exploitation
    
    // Build lumbermill if enough forest
    if(resources.totalForest >= MIN_FOREST_FOR_LUMBERMILL){
      const lumberSpot = global.tilemapSystem.findBuildingSpot('lumbermill', self.hq, 8, {
        excludedTiles: excludedTiles
      });
      
      if(lumberSpot){
        const plot = lumberSpot.plot;
        const nearbyForest = global.tilemapSystem.countNearbyTerrain(plot[0], [1, 2], 5, 0);
        
        if(nearbyForest >= 8){
          const topPlot = lumberSpot.topPlot;
          const center = getCenter(plot[0][0], plot[0][1]);
          
          for(var i in plot){
            tileChange(0,plot[i][0],plot[i][1],13);
            tileChange(3,plot[i][0],plot[i][1],String('lumbermill' + i));
            matrixChange(0,plot[i][0],plot[i][1],1);
          }
          tileChange(5,topPlot[0][0],topPlot[0][1],'lumbermill2');
          tileChange(5,topPlot[1][0],topPlot[1][1],'lumbermill3');
          
          Lumbermill({
            id:Math.random(),
            house:self.id,
            owner:self.id,
            x:center[0],
            y:center[1],
            z:0,
            type:'lumbermill',
            built:true,
            plot:plot,
            topPlot:topPlot,
            mats:{wood:25, stone:0},
            req:5,
            hp:100
          });
          
          console.log(`Franks: Lumbermill built (${nearbyForest} forest nearby)`);
        }
      }
    }
    
    // Build ore mine if cave in radius
    if(resources.caveEntrances.length > 0){
      const cave = resources.caveEntrances[0].tile;
      const mineSpot = global.tilemapSystem.findBuildingSpot('mine', cave, 6, {
        excludeTiles: excludedTiles
      });
      
      if(mineSpot){
        const plot = mineSpot.plot;
        const center = getCenter(plot[0][0], plot[0][1]);
        
        for(var i in plot){
          tileChange(0,plot[i][0],plot[i][1],13);
          tileChange(3,plot[i][0],plot[i][1],String('mine' + i));
          matrixChange(0,plot[i][0],plot[i][1],1);
        }
        
        Mine({
          id:Math.random(),
          house:self.id,
          owner:self.id,
          x:center[0],
          y:center[1],
          z:0,
          type:'mine',
          built:true,
          plot:plot,
          mats:{wood:40, stone:0},
          req:5,
          hp:150
        });
        
        console.log(`Franks: Ore mine built near cave`);
      }
    }
    // Build stone mine if enough rocks  
    else if(resources.rocks >= MIN_ROCKS_FOR_MINE){
      const mineSpot = global.tilemapSystem.findBuildingSpot('mine', self.hq, 8, {
        excludeTiles: excludedTiles
      });
      
      if(mineSpot){
        const plot = mineSpot.plot;
        const center = getCenter(plot[0][0], plot[0][1]);
        
        for(var i in plot){
          tileChange(0,plot[i][0],plot[i][1],13);
          tileChange(3,plot[i][0],plot[i][1],String('mine' + i));
          matrixChange(0,plot[i][0],plot[i][1],1);
        }
        
        Mine({
          id:Math.random(),
          house:self.id,
          owner:self.id,
          x:center[0],
          y:center[1],
          z:0,
          type:'mine',
          built:true,
          plot:plot,
          mats:{wood:40, stone:0},
          req:5,
          hp:150
        });
        
        console.log(`Franks: Stone mine built`);
      }
    }
    
    mapEdit();
    console.log(`Franks initialization complete: ${millsBuilt} mills, ${farmsBuilt} farms`);
  }
  self.scout = function(start){
    var points = [];
    var grid = [];
    var area = getArea(start,start,24);
    for(var i in area){
      var sc = getCenter(start[0],start[1]);
      var t = area[i];
      var gt = getTile(0,t[0],t[1]);
      var tc = getCenter(t[0],t[1]);
      var dist = getDistance({x:sc[0],y:sc[1]},{x:tc[0],y:tc[1]});
      if(((gt >= 3 && gt < 4) || gt == 7) && dist > 768){
        grid.push(t);
      }
    }
    for(var i in grid){
      var t = grid[i];
      var tArea = getArea(t,t,12);
      var count = 0;
      for(var a in tArea){
        var gt = getTile(0,a[0],a[1]);
        if((gt >= 3 && gt < 4) || gt == 7){
          count++;
        }
      }
      if(count > (tArea.length * 0.75)){
        points.push(t);
      }
    }
    var rand = Math.floor(Math.random() * points.length);
    var target = points[rand];
    var units = [];
    for(var i in Player.list){
      var unit = Player.list[i];
      if(unit.house == self.id && unit.type == 'npc' && unit.mounted){
        units.push(unit.id);
      }
    }
    rand = Math.floor(Math.random() * units.length);
    Player.list[units[rand]].scout.target = target;
    Player.list[units[rand]].scout.return = self.hq;
    Player.list[units[rand]].mode = 'scout';
    console.log(self.name + ' have sent a scout to ' + target);
  }
  self.expand = function(point){
    console.log(self.name + ' are claiming new territory');
    var fp = getCoords(point[0],point[1]);
    var pc = point[0];
    var pr = point[1];
    Firepit({
      x:fp[0],
      y:fp[1],
      z:0,
      qty:1,
      parent:self.id
    });
    var grid = [
      [pc-2,pr-2],[pc-1,pr-2],[pc,pr-2],[pc+1,pr-2],[pc+2,pr-2],
      [pc-2,pr-1],[pc+1,pr-1],[pc+2,pr-1],
      [pc-2,pr],[pc+1,pr],[pc+2,pr]];
    var rand = Math.floor(Math.random() * grid.length);
    var twr = grid[rand];
    var plot = [twr,[twr[0]+1,twr[1]],[twr[0],twr[1]+1],[twr[0]+1,twr[1]+1]];
    var topPlot = [[twr[0],twr[1]-1],[twr[0]+1,twr[1]-1]];
    for(var i in plot){
      tileChange(0,plot[i][0],plot[i][1],11);
      tileChange(6,plot[i][0],plot[i][1],0);
    }
    var coords = getCoords(twr[0],twr[1]);
    Guardtower({
      owner:self.id,
      house:self.id,
      kingdom:self.kingdom,
      x:coords[0],
      y:coords[1],
      z:0,
      type:'franktower',
      built:false,
      plot:plot,
      topPlot:topPlot
    })
  }

  var super_update = self.update;
  self.update = function(){
    super_update();
  }
  self.init();
  
  // Initialize AI controller for Franks
  const FactionAI = require('./ai/FactionAI');
  Object.defineProperty(self, 'ai', {
    value: new FactionAI(self),
    writable: true,
    enumerable: false, // Exclude from JSON.stringify
    configurable: true
  });
  
  // Give starting resources for AI-driven development
  self.stores.wood = 100;
  self.stores.stone = 60;
  self.stores.grain = 50;
}

// CELTS
Celts = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null
  }
  self.newSerfs = function(b,hq){
    var building = Building.list[b];
    var loc = getLoc(building.x,building.y);
    
    // Use new building placement system
    var hutSpot = global.tilemapSystem.findBuildingSpot('celthut', loc, 5);
    
    if(hutSpot){
      var plot = hutSpot.plot;
      var walls = hutSpot.walls;
      for(var i in plot){
        var p = plot[i];
        tileChange(0,p[0],p[1],11);
        tileChange(6,p[0],p[1],0);
      }
      mapEdit();
      var center = getCoords(plot[3][0],plot[3][1]);
      var id = Math.random();
      Building({
        id:id,
        house:self.id,
        owner:self.id,
        x:center[0],
        y:center[1],
        z:0,
        type:'celthut',
        built:false,
        plot:plot,
        walls:walls,
        mats:{
          wood:30,
          stone:0
        },
        req:5,
        hp:150
      })
      area = getArea(hq,hq,2);
      var grid = [];
      for(var i in area){
        var s = area[i];
        if(isWalkable(0,s[0],s[1])){
          grid.push(s);
        }
      }
      var rand = Math.floor(Math.random() * grid.length);
      var s1 = Math.random();
      var sp1 = grid[rand];
      var c1 = getCenter(sp1[0],sp1[1]);
      grid.splice(rand,1);
      rand = Math.floor(Math.random() * grid.length);
      var s2 = Math.random();
      var sp2 = grid[rand];
      var c2 = getCenter(sp2[0],sp2[1]);
      var work = {hq:b,spot:null};
      // For lumbermill/mine, first serf MUST be male; for mill/farm, can be either
      if(building.type == 'mill' || building.type == 'farm'){
        if(s1 > 0.4){
          SerfM({
            id:s1,
            name:'Serf',
            x:c1[0],
            y:c1[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp1},
            hut:id
          });
        } else {
          SerfF({
            id:s1,
            name:'Serf',
            x:c1[0],
            y:c1[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp1},
            hut:id
          });
        }
      } else {
        // Lumbermill or mine - first serf must be male
        SerfM({
          id:s1,
          name:'Serf',
          x:c1[0],
          y:c1[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp1},
          hut:id
        });
      }
      if(building.type == 'mill' || building.type == 'farm'){
        // Mills and farms can have either gender
        if(s2 > 0.6){
          SerfM({
            id:s2,
            name:'Serf',
            x:c2[0],
            y:c2[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp2},
            hut:id
          });
        } else {
          SerfF({
            id:s2,
            name:'Serf',
            x:c2[0],
            y:c2[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp2},
            hut:id
          });
        }
        Building.list[b].serfs[s1] = s1;
        Player.list[s1].work = {hq:b,spot:null};
        Building.list[b].serfs[s2] = s2;
        Player.list[s2].work = {hq:b,spot:null};
      } else {
        // Lumbermill or mine - second serf can be either, but only males get work assigned
        if(s2 > 0.5){
          SerfM({
            id:s2,
            name:'Serf',
            x:c2[0],
            y:c2[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp2},
            hut:id
          });
        } else {
          SerfF({
            id:s2,
            name:'Serf',
            x:c2[0],
            y:c2[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp2},
            hut:id
          });
        }
        // First serf is always male, so always assign
        Building.list[b].serfs[s1] = s1;
        Player.list[s1].work = {hq:b,spot:null};
        // Second serf only gets work if male
        if(Player.list[s2].sex == 'm'){
          Building.list[b].serfs[s2] = s2;
          Player.list[s2].work = {hq:b,spot:null};
        }
      }
      console.log('Serfs have spawned for Celts: ' + Building.list[b].type);
    }
  }
  self.spawn = function(cl,spawn){
    var c = getCenter(spawn.loc[0],spawn.loc[1]);
    if(cl == 'CeltAxe'){
      CeltAxe({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'CeltSpear'){
      CeltSpear({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Headhunter'){
      Headhunter({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Druid'){
      Druid({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'ScoutShip'){
      ScoutShip({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Longship'){
      Longship({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    }
  }
  self.init = function(){
    // CELTS INITIALIZATION: Mining Specialists
    // Base radius: 9 tiles
    // Priority: 2 ore mines near cave entrance
    
    const BASE_RADIUS = 9;
    
    // Assess available resources
    const resources = global.tilemapSystem.assessBaseResources(self.hq, BASE_RADIUS, 0);
    console.log(`Celts @ [${self.hq}]: Forest=${resources.totalForest}, Rocks=${resources.rocks}, Caves=${resources.caveEntrances.length}`);
    
    // Spawn initial units
    var grid = [];
    var area = getArea(self.hq,self.hq,5);
    for(var i in area){
      var t = area[i];
      if(isWalkable(0,t[0],t[1]) && t.toString() != self.hq.toString()){
        grid.push(t);
      }
    }
    
    // Create firepit (avoid blocking cave entrances)
    var fireId = Math.random();
    var firepitLoc = findSafeFirepitLocation(self.hq, 0, grid);
    var coords = getCoords(firepitLoc[0], firepitLoc[1]);
    Firepit({
      id:fireId,
      parent:self.id,
      x:coords[0],
      y:coords[1],
      z:0,
      qty:1
    });
    self.scene.fire = fireId;
    
    // Spawn 4 initial units
    for(var i = 0; i < 4; i++){
      var rand = Math.floor(Math.random() * grid.length);
      var select = grid[rand];
      grid.splice(rand,1);
      var c = getCenter(select[0],select[1]);
      var flip = Math.random();
      if(flip < 0.618){
        CeltAxe({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{z:0, loc:select}
        })
      } else {
        CeltSpear({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{z:0, loc:select}
        })
      }
    }
    
    // PRIORITY 1: Build 2 ore mines near cave entrance
    var minesBuilt = 0;
    var excludedTiles = [self.hq];
    
    if(resources.caveEntrances.length > 0){
      // Use nearest cave
      const cave = resources.caveEntrances[0].tile;
      console.log(`Celts: Cave entrance at [${cave}], ${resources.caveEntrances[0].distInTiles} tiles away`);
      
      // Try increasing search radius until we place 2 mines
      for(let searchRadius = 4; searchRadius <= 6 && minesBuilt < 2; searchRadius++){
        const mineSpot = global.tilemapSystem.findBuildingSpot('mine', cave, searchRadius, {
        excludeTiles: excludedTiles
      });
      
        if(mineSpot){
          const plot = mineSpot.plot;
          const center = getCenter(plot[0][0], plot[0][1]);
          excludedTiles.push(...plot);
          
          for(var i in plot){
            tileChange(0,plot[i][0],plot[i][1],13);
            tileChange(3,plot[i][0],plot[i][1],String('mine' + i));
            matrixChange(0,plot[i][0],plot[i][1],1);
          }
          
        Mine({
            id:Math.random(),
          house:self.id,
          owner:self.id,
            x:center[0],
            y:center[1],
          z:0,
          type:'mine',
          built:true,
            plot:plot,
            mats:{wood:40, stone:0},
          req:5,
          hp:150
        });
        
          minesBuilt++;
          console.log(`Celts: Ore mine #${minesBuilt} built at [${plot[0]}]`);
      }
      }
      
      mapEdit();
    } else {
      console.error('⚠️ Celts: NO CAVE ENTRANCE in radius - faction incomplete!');
    }
    
    console.log(`Celts initialization complete: ${minesBuilt}/2 ore mines built`);
  }
  self.scout = function(start){
    var points = [];
    var grid = [];
    var area = getArea(start,start,24);
    for(var i in area){
      var sc = getCenter(start[0],start[1]);
      var t = area[i];
      var gt = getTile(0,t[0],t[1]);
      var tc = getCenter(t[0],t[1]);
      var dist = getDistance({x:sc[0],y:sc[1]},{x:tc[0],y:tc[1]});
      if(gt >= 1 && gt < 2 && dist > 768){
        grid.push(t);
      }
    }
    for(var i in grid){
      var t = grid[i];
      var tArea = getArea(t,t,12);
      var count = 0;
      for(var a in tArea){
        var gt = getTile(0,a[0],a[1]);
        if(gt >= 1 && gt < 2){
          count++;
        }
      }
      if(count > (tArea.length * 0.75)){
        points.push(t);
      }
    }
    var rand = Math.floor(Math.random() * points.length);
    var target = points[rand];
    var units = [];
    for(var i in Player.list){
      var unit = Player.list[i];
      if(unit.house == self.id && unit.type == 'npc' && unit.mounted){
        units.push(unit.id);
      }
    }
    rand = Math.floor(Math.random() * units.length);
    Player.list[units[rand]].scout.target = target;
    Player.list[units[rand]].scout.return = self.hq;
    Player.list[units[rand]].mode = 'scout';
    console.log(self.name + ' have sent a scout to ' + target);
  }
  self.expand = function(point){
    console.log(self.name + ' are claiming new territory');
    var fp = getCoords(point[0],point[1]);
    var pc = point[0];
    var pr = point[1];
    Firepit({
      x:fp[0],
      y:fp[1],
      z:0,
      qty:1,
      parent:self.id
    });
    var grid = [
      [pc-2,pr-2],[pc-1,pr-2],[pc,pr-2],[pc+1,pr-2],[pc+2,pr-2],
      [pc-2,pr-1],[pc+1,pr-1],[pc+2,pr-1],
      [pc-2,pr],[pc+1,pr],[pc+2,pr]];
    var rand = Math.floor(Math.random() * grid.length);
    var twr = grid[rand];
    var plot = [twr,[twr[0]+1,twr[1]],[twr[0],twr[1]+1],[twr[0]+1,twr[1]+1]];
    var topPlot = [[twr[0],twr[1]-1],[twr[0]+1,twr[1]-1]];
    for(var i in plot){
      tileChange(0,plot[i][0],plot[i][1],11);
      tileChange(6,plot[i][0],plot[i][1],0);
    }
    var coords = getCoords(twr[0],twr[1]);
    Guardtower({
      owner:self.id,
      house:self.id,
      kingdom:self.kingdom,
      x:coords[0],
      y:coords[1],
      z:0,
      type:'celttower',
      built:false,
      plot:plot,
      topPlot:topPlot
    })
  }

  var super_update = self.update;
  self.update = function(){
    super_update();
  }
  self.init();
  
  // Initialize AI controller for Celts
  const FactionAI = require('./ai/FactionAI');
  Object.defineProperty(self, 'ai', {
    value: new FactionAI(self),
    writable: true,
    enumerable: false, // Exclude from JSON.stringify
    configurable: true
  });
  
  // Give starting resources for AI-driven development
  self.stores.wood = 100;
  self.stores.stone = 60;
  self.stores.grain = 50;
}

// TEUTONS
Teutons = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null
  }
  self.newSerfs = function(b,hq){
    var building = Building.list[b];
    var loc = getLoc(building.x,building.y);
    
    // Use new building placement system
    var hutSpot = global.tilemapSystem.findBuildingSpot('teuthut', loc, 5);
    
    if(hutSpot){
      var plot = hutSpot.plot;
      var walls = hutSpot.walls;
      for(var i in plot){
        var p = plot[i];
        tileChange(0,p[0],p[1],11);
        tileChange(6,p[0],p[1],0);
      }
      mapEdit();
      var center = getCoords(plot[3][0],plot[3][1]);
      var id = Math.random();
      Building({
        id:id,
        house:self.id,
        owner:self.id,
        x:center[0],
        y:center[1],
        z:0,
        type:'teuthut',
        built:false,
        plot:plot,
        walls:walls,
        mats:{
          wood:30,
          stone:0
        },
        req:5,
        hp:150
      })
      area = getArea(hq,hq,2);
      var grid = [];
      for(var i in area){
        var s = area[i];
        if(isWalkable(0,s[0],s[1])){
          grid.push(s);
        }
      }
      var rand = Math.floor(Math.random() * grid.length);
      var s1 = Math.random();
      var sp1 = grid[rand];
      var c1 = getCenter(sp1[0],sp1[1]);
      grid.splice(rand,1);
      rand = Math.floor(Math.random() * grid.length);
      var s2 = Math.random();
      var sp2 = grid[rand];
      var c2 = getCenter(sp2[0],sp2[1]);
      var work = {hq:b,spot:null};
      // For lumbermill/mine, first serf MUST be male; for mill/farm, can be either
      if(building.type == 'mill' || building.type == 'farm'){
        if(s1 > 0.4){
          SerfM({
            id:s1,
            name:'Serf',
            x:c1[0],
            y:c1[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp1},
            hut:id
          });
        } else {
          SerfF({
            id:s1,
            name:'Serf',
            x:c1[0],
            y:c1[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp1},
            hut:id
          });
        }
      } else {
        // Lumbermill or mine - first serf must be male
        SerfM({
          id:s1,
          name:'Serf',
          x:c1[0],
          y:c1[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp1},
          hut:id
        });
      }
      if(building.type == 'mill' || building.type == 'farm'){
        // Mills and farms can have either gender
        if(s2 > 0.6){
          SerfM({
            id:s2,
            name:'Serf',
            x:c2[0],
            y:c2[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp2},
            hut:id
          });
        } else {
          SerfF({
            id:s2,
            name:'Serf',
            x:c2[0],
            y:c2[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp2},
            hut:id
          });
        }
        Building.list[b].serfs[s1] = s1;
        Player.list[s1].work = {hq:b,spot:null};
        Building.list[b].serfs[s2] = s2;
        Player.list[s2].work = {hq:b,spot:null};
      } else {
        // Lumbermill or mine - second serf can be either, but only males get work assigned
        if(s2 > 0.5){
          SerfM({
            id:s2,
            name:'Serf',
            x:c2[0],
            y:c2[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp2},
            hut:id
          });
        } else {
          SerfF({
            id:s2,
            name:'Serf',
            x:c2[0],
            y:c2[1],
            z:0,
            house:self.id,
            home:{z:0,loc:sp2},
            hut:id
          });
        }
        // First serf is always male, so always assign
        Building.list[b].serfs[s1] = s1;
        Player.list[s1].work = {hq:b,spot:null};
        // Second serf only gets work if male
        if(Player.list[s2].sex == 'm'){
          Building.list[b].serfs[s2] = s2;
          Player.list[s2].work = {hq:b,spot:null};
        }
      }
      console.log('Serfs have spawned for Teutons: ' + Building.list[b].type);
    }
  }
  self.spawn = function(cl,spawn){
    var c = getCenter(spawn.loc[0],spawn.loc[1]);
    if(cl == 'TeutonPike'){
      TeutonPike({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'TeutonBow'){
      TeutonBow({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Prior'){
      Prior({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'TeutonicKnight'){
      TeutonicKnight({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    }
  }
  self.init = function(){
    // TEUTONS INITIALIZATION: Ore + Stone Mining + Lumber
    // Base radius: 10 tiles
    // Priority: 1) Ore mines (if cave), 2) Stone mines, 3) Lumbermills (if forest)
    
    const BASE_RADIUS = 10;
    const MAX_MINES = 2;
    const MIN_FOREST_FOR_LUMBERMILL = 12;
    const MIN_FOREST_PER_LUMBERMILL = 8;
    
    // Assess available resources
    const resources = global.tilemapSystem.assessBaseResources(self.hq, BASE_RADIUS, 0);
    console.log(`Teutons @ [${self.hq}]: Forest=${resources.totalForest}, Rocks=${resources.rocks}, Mountains=${resources.mountains}, Caves=${resources.caveEntrances.length}`);
    
    // Spawn initial units
    var grid = [];
    var area = getArea(self.hq,self.hq,5);
    for(var i in area){
      var t = area[i];
      if(isWalkable(0,t[0],t[1]) && t.toString() != self.hq.toString()){
        grid.push(t);
      }
    }
    
    // Create firepit (avoid blocking cave entrances)
    var fireId = Math.random();
    var firepitLoc = findSafeFirepitLocation(self.hq, 0, grid);
    var coords = getCoords(firepitLoc[0], firepitLoc[1]);
    Firepit({
      id:fireId,
      parent:self.id,
      x:coords[0],
      y:coords[1],
      z:0,
      qty:1
    });
    self.scene.fire = fireId;
    
    // Spawn 4 initial units
    for(var i = 0; i < 4; i++){
      var rand = Math.floor(Math.random() * grid.length);
      var select = grid[rand];
      grid.splice(rand,1);
      var c = getCenter(select[0],select[1]);
      var flip = Math.random();
      if(flip < 0.618){
        TeutonPike({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{z:0, loc:select}
        })
      } else {
        TeutonBow({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{z:0, loc:select}
        })
      }
    }
    
    var minesBuilt = 0;
    var excludedTiles = [self.hq];
    
    // PRIORITY 1: Build ore mines if cave entrance present (within 6 tiles)
    if(resources.caveEntrances.length > 0){
      const cave = resources.caveEntrances[0].tile;
      console.log(`Teutons: Cave entrance found at [${cave}], ${resources.caveEntrances[0].distInTiles} tiles away`);
      
      // Try to place 2 ore mines near cave
      for(let searchRadius = 4; searchRadius <= 6 && minesBuilt < MAX_MINES; searchRadius++){
        const mineSpot = global.tilemapSystem.findBuildingSpot('mine', cave, searchRadius, {
          excludeTiles: excludedTiles
        });
        
        if(mineSpot){
          const plot = mineSpot.plot;
          const center = getCenter(plot[0][0], plot[0][1]);
          excludedTiles.push(...plot);
          
          for(var i in plot){
            tileChange(0,plot[i][0],plot[i][1],13);
            tileChange(3,plot[i][0],plot[i][1],String('mine' + i));
            matrixChange(0,plot[i][0],plot[i][1],1);
          }
          
      Mine({
            id:Math.random(),
        house:self.id,
        owner:self.id,
            x:center[0],
            y:center[1],
        z:0,
        type:'mine',
        built:true,
            plot:plot,
            mats:{wood:40, stone:0},
        req:5,
        hp:150
      });
      
          minesBuilt++;
          console.log(`Teutons: Ore mine #${minesBuilt} built near cave`);
        }
      }
    }
    
    // PRIORITY 2: Build stone mines to fill remaining mine slots
    if(minesBuilt < MAX_MINES && (resources.rocks > 0 || resources.mountains > 0)){
      for(let searchRadius = 5; searchRadius <= 8 && minesBuilt < MAX_MINES; searchRadius++){
        const mineSpot = global.tilemapSystem.findBuildingSpot('mine', self.hq, searchRadius, {
          excludeTiles: excludedTiles
        });
        
        if(mineSpot){
          const plot = mineSpot.plot;
          const center = getCenter(plot[0][0], plot[0][1]);
          excludedTiles.push(...plot);
          
          for(var i in plot){
            tileChange(0,plot[i][0],plot[i][1],13);
            tileChange(3,plot[i][0],plot[i][1],String('mine' + i));
            matrixChange(0,plot[i][0],plot[i][1],1);
          }
          
        Mine({
            id:Math.random(),
          house:self.id,
          owner:self.id,
            x:center[0],
            y:center[1],
          z:0,
          type:'mine',
          built:true,
            plot:plot,
            mats:{wood:40, stone:0},
          req:5,
          hp:150
        });
          
          minesBuilt++;
          console.log(`Teutons: Stone mine #${minesBuilt} built at [${plot[0]}]`);
        }
      }
    }
    
    // PRIORITY 3: Build lumbermills if enough forest
    var lumbermillsBuilt = 0;
    if(resources.totalForest >= MIN_FOREST_FOR_LUMBERMILL){
      console.log(`Teutons: ${resources.totalForest} forest tiles, attempting lumbermills`);
      
      for(let searchRadius = 5; searchRadius <= 8 && lumbermillsBuilt < 2; searchRadius++){
        const lumberSpot = global.tilemapSystem.findBuildingSpot('lumbermill', self.hq, searchRadius, {
          excludeTiles: excludedTiles
        });
        
        if(lumberSpot){
          const plot = lumberSpot.plot;
          
          // Verify this spot has enough nearby forest
          const nearbyForest = global.tilemapSystem.countNearbyTerrain(plot[0], [1, 2], 5, 0);
          if(nearbyForest >= MIN_FOREST_PER_LUMBERMILL){
            const topPlot = lumberSpot.topPlot;
            const center = getCenter(plot[0][0], plot[0][1]);
            excludedTiles.push(...plot);
            
            for(var i in plot){
              tileChange(0,plot[i][0],plot[i][1],13);
              tileChange(3,plot[i][0],plot[i][1],String('lumbermill' + i));
              matrixChange(0,plot[i][0],plot[i][1],1);
            }
            tileChange(5,topPlot[0][0],topPlot[0][1],'lumbermill2');
            tileChange(5,topPlot[1][0],topPlot[1][1],'lumbermill3');
            
        Lumbermill({
              id:Math.random(),
          house:self.id,
          owner:self.id,
              x:center[0],
              y:center[1],
          z:0,
          type:'lumbermill',
          built:true,
              plot:plot,
              topPlot:topPlot,
              mats:{wood:25, stone:0},
          req:5,
          hp:100
        });
            
            lumbermillsBuilt++;
            console.log(`Teutons: Lumbermill #${lumbermillsBuilt} built at [${plot[0]}] (${nearbyForest} forest nearby)`);
      }
    }
      }
    } else {
      console.log(`Teutons: Only ${resources.totalForest} forest tiles, skipping lumbermills`);
    }
    
    mapEdit();
    console.log(`Teutons initialization complete: ${minesBuilt}/2 mines, ${lumbermillsBuilt} lumbermills`);
  }
  self.scout = function(start){
    var points = [];
    var grid = [];
    var area = getArea(start,start,24);
    for(var i in area){
      var sc = getCenter(start[0],start[1]);
      var t = area[i];
      var gt = getTile(0,t[0],t[1]);
      var tc = getCenter(t[0],t[1]);
      var dist = getDistance({x:sc[0],y:sc[1]},{x:tc[0],y:tc[1]});
      if(gt >= 4 && gt < 7 && dist > 768){
        grid.push(t);
      }
    }
    for(var i in grid){
      var t = grid[i];
      var tArea = getArea(t,t,12);
      var count = 0;
      for(var a in tArea){
        var gt = getTile(0,a[0],a[1]);
        if(gt >= 4 && gt < 7){
          count++;
        }
      }
      if(count > (tArea.length * 0.75)){
        points.push(t);
      }
    }
    var rand = Math.floor(Math.random() * points.length);
    var target = points[rand];
    var units = [];
    for(var i in Player.list){
      var unit = Player.list[i];
      if(unit.house == self.id && unit.type == 'npc' && unit.mounted){
        units.push(unit.id);
      }
    }
    rand = Math.floor(Math.random() * units.length);
    Player.list[units[rand]].scout.target = target;
    Player.list[units[rand]].scout.return = self.hq;
    Player.list[units[rand]].mode = 'scout';
    console.log(self.name + ' have sent a scout to ' + target);
  }
  self.expand = function(){

  }

  var super_update = self.update;
  self.update = function(){
    super_update();
  }
  self.init();
  
  // Initialize AI controller for Teutons
  const FactionAI = require('./ai/FactionAI');
  Object.defineProperty(self, 'ai', {
    value: new FactionAI(self),
    writable: true,
    enumerable: false, // Exclude from JSON.stringify
    configurable: true
  });
  
  // Give starting resources for AI-driven development
  self.stores.wood = 100;
  self.stores.stone = 60;
  self.stores.grain = 50;
}

// OUTLAWS
Outlaws = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null
  }
  self.spawn = function(rank,spawn){
    var c = getCenter(spawn.loc[0],spawn.loc[1]);
    if(cl == 'Trapper'){
      Trapper({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Outlaw'){
      Outlaw({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    }
  }
  self.init = function(){
    var grid = [];
    var area = getArea(self.hq,self.hq,5);
    for(var i in area){
      var t = area[i];
      if(isWalkable(0,t[0],t[1]) && t.toString() != self.hq.toString()){
        grid.push(t);
      }
    }
    // fire (avoid blocking cave entrances)
    var fireId = Math.random();
    var firepitLoc = findSafeFirepitLocation(self.hq, 0, grid);
    var coords = getCoords(firepitLoc[0], firepitLoc[1]);
    InfiniteFire({
      id:fireId,
      parent:self.id,
      x:coords[0],
      y:coords[1],
      z:0,
      qty:1
    });
    self.scene.fire = fireId;
    
    // Spawn 1-3 random huts around the firepit (standard 2x2 huts like serfs build)
    var numHuts = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3 huts
    var excludedTiles = [firepitLoc]; // Don't build on the fire
    
    for(var i = 0; i < numHuts; i++){
      // Use tilemap system to find a valid hut location near the firepit
      var hutSpot = global.tilemapSystem.findBuildingSpot('hut', firepitLoc, 5, {
        excludeTiles: excludedTiles
      });
      
      if(hutSpot && hutSpot.plot){
        var plot = hutSpot.plot;
        var walls = hutSpot.walls || [[plot[0][0],plot[0][1]-2],[plot[1][0],plot[1][1]-2]];
        var center = getCenter(plot[0][0], plot[0][1]);
        
        // Update terrain tiles exactly like Build.js does for completed huts
        for(var j = 0; j < plot.length; j++){
          matrixChange(0, plot[j][0], plot[j][1], 1);
          matrixChange(1, plot[j][0], plot[j][1], 0);
          tileChange(0, plot[j][0], plot[j][1], 13);
          tileChange(3, plot[j][0], plot[j][1], String('hut' + j));
          // Set entrance tile (hut1 is the entrance)
          if(getTile(3, plot[j][0], plot[j][1]) == 'hut1'){
            tileChange(0, plot[j][0], plot[j][1], 14);
            matrixChange(0, plot[j][0], plot[j][1], 0);
            matrixChange(1, plot[j][0], plot[j][1]+1, 0);
          }
        }
        
        // Add walls
        for(var j in walls){
          var n = walls[j];
          tileChange(4, n[0], n[1], 1);
        }
        
        // Create the hut building (pre-built for Outlaws)
        var hutId = Math.random();
        Building({
          id: hutId,
          house: self.id,
          owner: self.id,
          x: center[0],
          y: center[1],
          z: 0,
          type: 'hut',
          built: true,
          plot: plot,
          walls: walls,
          entrance: null, // Will be set by tile logic above
          mats: { wood: 30, stone: 0 },
          req: 5,
          hp: 150
        });
        
        // Add fireplace inside the hut
        if(walls && walls[1]){
          var fp = getCoords(walls[1][0], walls[1][1]);
          Fireplace({
            x: fp[0],
            y: fp[1],
            z: 1,
            qty: 1,
            parent: hutId
          });
        }
        
        // Add plot to excluded tiles so next hut doesn't overlap
        excludedTiles.push(...plot);
        
        console.log(`Outlaws hut ${i+1} placed at [${plot[0]}]`);
      } else {
        console.log(`Outlaws: Could not find spot for hut ${i+1}`);
      }
    }
    
    // pawns
    for(var i = 0; i < 3; i++){
      var rand = Math.floor(Math.random() * grid.length);
      var select = grid[rand];
      grid.splice(rand,1);
      var c = getCenter(select[0],select[1]);
      var flip = Math.random();
      if(flip > 0.33){
        Trapper({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          }
        })
      } else {
        Outlaw({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          }
        })
      }
    }
    console.log('Outlaws: ' + self.hq);
  }

  var super_update = self.update;
  self.update = function(){
    super_update();
  }
  self.init();
  
  // Initialize AI controller for Outlaws (no building goals for now)
  const FactionAI = require('./ai/FactionAI');
  Object.defineProperty(self, 'ai', {
    value: new FactionAI(self),
    writable: true,
    enumerable: false,
    configurable: true
  });
}

// MERCENARIES
Mercenaries = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null,
    barrel:null,
    chest:null,
    crates:null,
    swordrack:null,
  }
  self.spawn = function(rank,spawn){
    var c = getCenter(spawn.loc[0],spawn.loc[1]);
    if(cl == 'Cutthroat'){
      Cutthroat({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Strongman'){
      Strongman({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Marauder'){
      Marauder({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    }
  }
  self.init = function(){
    var grid = [];
    var area = getArea(self.hq,self.hq,4);
    for(var i in area){
      var t = area[i];
      if(isWalkable(-1,t[0],t[1]) && t.toString() != self.hq.toString()){
        grid.push(t);
      }
    }
    // fire
    var fireId = Math.random();
    var coords = getCoords(self.hq[0],self.hq[1]);
    Firepit({
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
      var c = getCenter(select[0],select[1]);
      var flip = Math.random();
      if(flip > 0.33){
        Cutthroat({
          x:c[0],
          y:c[1],
          z:-1,
          house:self.id,
          home:{
            z:-1,
            loc:select
          }
        })
      } else {
        Strongman({
          x:c[0],
          y:c[1],
          z:-1,
          house:self.id,
          home:{
            z:-1,
            loc:select
          }
        })
      }
    }
    
    // MERCENARIES INITIALIZATION: Random objects around firepit
    const BASE_RADIUS = 6;
    const objectTypes = ['barrel', 'crates', 'stash2'];
    
    // Place 5 random objects within radius using direct constructors
    for(let i = 0; i < 5 && grid.length > 0; i++){
      const randIndex = Math.floor(Math.random() * grid.length);
      const tile = grid[randIndex];
      grid.splice(randIndex, 1);
      
      const roll = Math.random();
      const coords = getCoords(tile[0], tile[1]);
      
      if(roll < 0.33){
        Barrel({
          id: Math.random(),
          x: coords[0],
          y: coords[1],
          z: -1,
          qty: 1
        });
        console.log(`Mercenaries: Placed Barrel at [${tile}]`);
      } else if(roll < 0.66){
        Crates({
          id: Math.random(),
          x: coords[0],
          y: coords[1],
          z: -1,
          qty: 1
        });
        console.log(`Mercenaries: Placed Crates at [${tile}]`);
      } else {
        Stash2({
          id: Math.random(),
          x: coords[0],
          y: coords[1],
          z: -1,
          qty: 1
        });
        console.log(`Mercenaries: Placed Stash2 at [${tile}]`);
      }
    }
    
    // Place locked chest 1-2 tiles from firepit
    const chestDistance = (Math.random() > 0.5) ? 1 : 2;
    const chestArea = getArea(self.hq, self.hq, chestDistance);
    const validChestSpots = chestArea.filter(t => 
      isWalkable(-1, t[0], t[1]) && t.toString() != self.hq.toString()
    );
    
    if(validChestSpots.length > 0){
      const chestTile = validChestSpots[Math.floor(Math.random() * validChestSpots.length)];
      const chestCoords = getCoords(chestTile[0], chestTile[1]);
      
      LockedChest({
        id: Math.random(),
        x: chestCoords[0],
        y: chestCoords[1],
        z: -1,
        qty: 1
      });
      console.log(`Mercenaries: Locked chest placed ${chestDistance} tiles from firepit at [${chestTile}]`);
    }
    
    console.log('Mercenaries initialization complete: firepit + 5 objects + locked chest');
  }

  var super_update = self.update;
  self.update = function(){
    super_update();
  }
  self.init();
  
  // Initialize AI controller for Mercenaries (underground - no building goals)
  const FactionAI = require('./ai/FactionAI');
  Object.defineProperty(self, 'ai', {
    value: new FactionAI(self),
    writable: true,
    enumerable: false,
    configurable: true
  });
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
    ironore:0,
    iron:0,
    silverore:0,
    silver:0,
    goldore:0,
    gold:0,
    diamond:0
  }
  Kingdom.list[self.id] = self;

  emit({
    msg:'newFaction',
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

convertHouse = function(id){
  var player = Player.list[id];
  var house = player.house;
   var grain = player.stores.grain;
   House.list[house].stores.grain += grain;
   Player.list[id].stores.grain = 0;
   var wood = player.stores.wood;
   House.list[house].stores.wood += wood;
   Player.list[id].stores.wood = 0;
   var stone = player.stores.stone;
   House.list[house].stores.stone += stone;
   Player.list[id].stores.stone = 0;
   var ironore = player.stores.ironore;
   House.list[house].stores.ironore += ironore;
   Player.list[id].stores.ironore = 0;
   var iron = player.stores.iron;
   House.list[house].stores.iron += iron;
   Player.list[id].stores.ironore = 0;
   var silverore = player.stores.silverore;
   House.list[house].stores.silverore += silverore;
   Player.list[id].stores.silver = 0;
   var silver = player.stores.silver;
   House.list[house].stores.silver += silver;
   Player.list[id].stores.silver = 0;
   var goldore = player.stores.goldore;
   House.list[house].stores.goldore += goldore;
   Player.list[id].stores.goldore = 0;
   var gold = player.stores.gold;
   House.list[house].stores.gold += gold;
   Player.list[id].stores.gold = 0;
   var diamond = player.stores.diamond;
   House.list[house].stores.diamond += diamond;
   Player.list[id].stores.diamond = 0;
  for(var i in Building.list){
    var b = Building.list[i];
    if(b.owner == id){
      Building.list[i].house = house;
      if(b.patrol && b.built){
        House.list[house].military.patrol.push(b.id);
      }
      if(b.serfs){
        for(var s in b.serfs){
          var serf = b.serfs[s];
          Player.list[serf].house = house;
        }
      }
    }
  }
}

convertKingdom = function(hid){
  var house = House.list[hid];
  var kingdom = house.kingdom;
}
