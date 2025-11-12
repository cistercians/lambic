// STUCK ENTITY ANALYTICS - Global tracking
if (!global.stuckEntityAnalytics) {
  global.stuckEntityAnalytics = {
    enabled: true,
    stuckEvents: [],
    maxHistorySize: 200,
    entityStuckCounts: new Map(), // entityId -> count
    waypointStuckCounts: new Map(), // waypoint -> count
    layerStuckCounts: new Map(), // z-level -> count
    reasonCounts: { blocked: 0, stuck: 0, oscillating: 0, gaveUp: 0 },
    recalcAttempts: [],
    lastLog: Date.now(),
    logInterval: 10000, // Log every 10 seconds
    
    recordStuckEvent: function(entity, waypoint, reason, attempts, z) {
      if (!this.enabled) return;
      
      const event = {
        timestamp: Date.now(),
        entityId: entity.id,
        entityName: entity.name || entity.class || 'Unknown',
        entityClass: entity.class,
        waypoint: waypoint ? waypoint.toString() : 'unknown',
        reason: reason,
        attempts: attempts,
        z: z,
        position: { x: Math.floor(entity.x), y: Math.floor(entity.y) }
      };
      
      this.stuckEvents.push(event);
      if (this.stuckEvents.length > this.maxHistorySize) {
        this.stuckEvents.shift();
      }
      
      // Track entity stuck counts
      const entityKey = `${entity.class}:${entity.id}`;
      this.entityStuckCounts.set(entityKey, (this.entityStuckCounts.get(entityKey) || 0) + 1);
      
      // Track waypoint stuck counts
      if (waypoint) {
        const wpKey = waypoint.toString();
        this.waypointStuckCounts.set(wpKey, (this.waypointStuckCounts.get(wpKey) || 0) + 1);
      }
      
      // Track z-level stuck counts
      this.layerStuckCounts.set(z, (this.layerStuckCounts.get(z) || 0) + 1);
      
      // Track reason counts
      if (this.reasonCounts[reason] !== undefined) {
        this.reasonCounts[reason]++;
      }
      
      // Track recalc attempts
      if (attempts) {
        this.recalcAttempts.push(attempts);
        if (this.recalcAttempts.length > 100) {
          this.recalcAttempts.shift();
        }
      }
    },
    
    getStats: function() {
      const avgRecalc = this.recalcAttempts.length > 0
        ? (this.recalcAttempts.reduce((a, b) => a + b, 0) / this.recalcAttempts.length).toFixed(2)
        : 0;
      const maxRecalc = this.recalcAttempts.length > 0 ? Math.max(...this.recalcAttempts) : 0;
      
      // Get top stuck entities
      const topEntities = Array.from(this.entityStuckCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([entity, count]) => ({ entity, count }));
      
      // Get top stuck waypoints
      const topWaypoints = Array.from(this.waypointStuckCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([waypoint, count]) => ({ waypoint, count }));
      
      // Get layer distribution
      const layerDist = Array.from(this.layerStuckCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([layer, count]) => ({ layer, count }));
      
      return {
        totalEvents: this.stuckEvents.length,
        recentEvents: this.stuckEvents.slice(-10),
        reasonCounts: this.reasonCounts,
        recalcAttempts: { avg: avgRecalc, max: maxRecalc },
        topStuckEntities: topEntities,
        topStuckWaypoints: topWaypoints,
        layerDistribution: layerDist
      };
    },
    
    maybeLogStats: function() {
      if (!this.enabled) return;
      
      const now = Date.now();
      if (now - this.lastLog >= this.logInterval) {
        const stats = this.getStats();
        
        if (stats.totalEvents > 0) {
          console.log('🚫 Stuck Entity Analytics:');
          console.log(`   Total stuck events: ${stats.totalEvents}`);
          console.log(`   Reasons: blocked=${stats.reasonCounts.blocked}, stuck=${stats.reasonCounts.stuck}, oscillating=${stats.reasonCounts.oscillating}, gaveUp=${stats.reasonCounts.gaveUp}`);
          console.log(`   Recalc attempts: avg=${stats.recalcAttempts.avg}, max=${stats.recalcAttempts.max}`);
          
          if (stats.topStuckWaypoints.length > 0) {
            console.log(`   Top stuck waypoints:`);
            stats.topStuckWaypoints.slice(0, 5).forEach((w, i) => {
              console.log(`     ${i + 1}. ${w.waypoint}: ${w.count} times`);
            });
          }
          
          if (stats.layerDistribution.length > 0) {
            console.log(`   Layer distribution:`);
            stats.layerDistribution.forEach(l => {
              console.log(`     z=${l.layer}: ${l.count} stuck events`);
            });
          }
        }
        
        this.lastLog = now;
      }
    }
  };
}

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
  
  // Find nearest walkable tile near target (spiral search) - OPTIMIZED
  self.findNearestWalkableTile = function(targetX, targetY, targetZ, maxRadius = 5){
    // Try the target first
    if(isWalkable(targetZ, targetX, targetY)){
      return [targetX, targetY];
    }
    
    // Spiral outward from target (optimized iteration order)
    for(var radius = 1; radius <= maxRadius; radius++){
      // Check cardinal directions first (most common successful cases)
      var cardinals = [[0, radius], [radius, 0], [0, -radius], [-radius, 0]];
      for(var c = 0; c < cardinals.length; c++){
        var checkX = targetX + cardinals[c][0];
        var checkY = targetY + cardinals[c][1];
        if(checkX >= 0 && checkX < mapSize && checkY >= 0 && checkY < mapSize){
          if(isWalkable(targetZ, checkX, checkY)){
            return [checkX, checkY];
          }
        }
      }
      
      // Then check diagonals and other positions
      for(var dx = -radius; dx <= radius; dx++){
        for(var dy = -radius; dy <= radius; dy++){
          // Skip tiles we already checked and interior tiles
          if((Math.abs(dx) == radius || Math.abs(dy) == radius) && 
             !(dx == 0 || dy == 0)){ // Skip cardinals already checked
            var checkX2 = targetX + dx;
            var checkY2 = targetY + dy;
            
            if(checkX2 >= 0 && checkX2 < mapSize && checkY2 >= 0 && checkY2 < mapSize){
              if(isWalkable(targetZ, checkX2, checkY2)){
                return [checkX2, checkY2];
              }
            }
          }
        }
      }
    }
    
    return null; // No walkable tile found nearby
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

  // Spot tracking for work assignments
  self.assignedSpots = {}; // {serfId: [col,row]}
  self.availableResources = []; // Copy of resources for tracking
  
  // Dock-specific properties
  if(self.type === 'dock'){
    self.network = param.network || []; // Array of connected dock building IDs
    self.cargoShip = param.cargoShip || null; // Reference to cargo ship if this dock has one
    
    // Create bidirectional dock association (called when ship docks at new location)
    self.createDockAssociation = function(otherDockId){
      if(!otherDockId || otherDockId === self.id) return;
      
      var otherDock = Building.list[otherDockId];
      if(!otherDock || otherDock.type !== 'dock') return;
      
      // Add to this dock's network
      if(self.network.indexOf(otherDockId) === -1){
        self.network.push(otherDockId);
        console.log('🔗 Dock ' + self.id + ' linked to dock ' + otherDockId);
      }
      
      // Add this dock to other dock's network (bidirectional)
      if(!otherDock.network) otherDock.network = [];
      if(otherDock.network.indexOf(self.id) === -1){
        otherDock.network.push(self.id);
        console.log('🔗 Dock ' + otherDockId + ' linked to dock ' + self.id);
      }
      
      // Spawn cargo ships if needed
      // Spawn at this dock if it just got its first connection
      if(self.network.length === 1 && !self.cargoShip){
        self.spawnCargoShip();
      }
      
      // Spawn at other dock if it just got its first connection
      if(otherDock.network.length === 1 && !otherDock.cargoShip){
        otherDock.spawnCargoShip();
      }
    };
    
    // Spawn cargo ship for this dock
    self.spawnCargoShip = function(){
      // Find water tile adjacent to dock
      var waterTile = null;
      for(var i in self.plot){
        var dockLoc = self.plot[i];
        var adjacent = [
          [dockLoc[0], dockLoc[1] + 1],
          [dockLoc[0], dockLoc[1] - 1],
          [dockLoc[0] - 1, dockLoc[1]],
          [dockLoc[0] + 1, dockLoc[1]]
        ];
        
        for(var j in adjacent){
          var at = adjacent[j];
          if(at[0] >= 0 && at[0] < global.mapSize && at[1] >= 0 && at[1] < global.mapSize){
            if(getTile(0, at[0], at[1]) == 0){ // Water
              waterTile = at;
              break;
            }
          }
        }
        if(waterTile) break;
      }
      
      if(!waterTile){
        console.log('⚠️ Dock ' + self.id + ' has network but no adjacent water, cannot spawn cargo ship');
        return;
      }
      
      // Create cargo ship at water tile adjacent to dock
      // Check if CargoShip function exists (defined later in file)
      if(typeof CargoShip === 'undefined'){
        console.error('CargoShip not defined yet - cannot spawn cargo ship');
        return;
      }
      
      var waterCoords = getCenter(waterTile[0], waterTile[1]);
      
      console.log('🚢 Attempting to spawn CargoShip - typeof CargoShip:', typeof CargoShip);
      
      var cargoShip = null;
      try {
        cargoShip = CargoShip({
          x: waterCoords[0],
          y: waterCoords[1],
          z: 0,
          homeDock: self.id,
          currentDock: self.id,
          mode: 'waiting'
        });
        console.log('🚢 CargoShip created, id:', cargoShip ? cargoShip.id : 'undefined');
      } catch(err){
        console.error('Error creating CargoShip:', err);
        return;
      }
      
      // Select first destination and start waiting
      if(cargoShip && cargoShip.selectNextDestination){
        if(cargoShip.selectNextDestination()){
          cargoShip.announceDestination();
          cargoShip.startWaiting();
          self.cargoShip = cargoShip.id;
          console.log('🚢 Spawned cargo ship at dock ' + self.id);
        } else {
          // Failed to select destination, remove ship
          if(cargoShip.toRemove !== undefined){
            cargoShip.toRemove = true;
          }
          console.error('Failed to select destination for cargo ship at dock ' + self.id);
        }
      } else {
        console.error('CargoShip creation failed at dock ' + self.id);
      }
    };
  }

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

  // Method to mark spot as assigned
  self.assignSpot = function(serfId, spot){
    self.assignedSpots[serfId] = spot;
  };

  // Method to release spot
  self.releaseSpot = function(serfId){
    delete self.assignedSpots[serfId];
  };

  // Method to check if spot is available
  self.isSpotAvailable = function(spot){
    for(var id in self.assignedSpots){
      var assigned = self.assignedSpots[id];
      if(assigned[0] === spot[0] && assigned[1] === spot[1]){
        return false;
      }
    }
    return true;
  };

  // Method to update resources list (call after resource depletion)
  self.updateResources = function(){
    if(!self.resources) return;
    
    // Filter out depleted resources based on building type
    if(self.type === 'lumbermill'){
      self.resources = self.resources.filter(r => {
        var tile = getTile(0, r[0], r[1]);
        return tile >= 1 && tile < 2; // Has trees
      });
    } else if(self.type === 'mine'){
      self.resources = self.resources.filter(r => {
        var tile = getTile(1, r[0], r[1]);
        return tile >= 2 && tile < 5; // Has ore/stone
      });
    } else if(self.type === 'mill' || self.type === 'farm'){
      // Farms are handled specially (see below)
      self.updateFarmResources();
    }
  };

  // Special farm resource tracking
  self.updateFarmResources = function(){
    if(self.type !== 'mill' && self.type !== 'farm') return;
    
    var barren = [];
    var growing = [];
    var wheat = [];
    
    // For mills: check all linked farm plots
    // For farms: check own plot
    var plotsToCheck = [];
    if(self.type === 'mill' && self.farms){
      // Mill: gather all farm plots
      for(var farmId in self.farms){
        var farmPlot = self.farms[farmId];
        for(var i in farmPlot){
          plotsToCheck.push(farmPlot[i]);
        }
      }
    } else {
      // Farm: check own plot
      plotsToCheck = self.plot || [];
    }
    
    for(var i in plotsToCheck){
      var p = plotsToCheck[i];
      var tile = getTile(0, p[0], p[1]);
      var res = getTile(6, p[0], p[1]);
      
      if(tile === 8){ // Barren/Growing phase
        if(res < 50){
          barren.push(p); // Needs planting/watering
        } else {
          growing.push(p); // Still growing, maxed resources
        }
      } else if(tile === 9){ // Wheat ready
        wheat.push(p);
      }
    }
    
    // Assign based on farm state
    if(wheat.length > 0){
      // Wheat mode - only assign wheat tiles
      self.resources = wheat;
    } else {
      // Growing mode - only assign barren tiles (not maxed)
      self.resources = barren;
    }
  };

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
  self.assignedSpots = {}; // Track which spots are assigned to which serfs {serfId: [x,y]}
  self.log = {};
  self.patrol = true;
  self.dailyStores = {grain: 0}; // Track daily resource collection
  
  // Resource depletion reporting - called by serfs when they deplete a resource
  self.reportDepletedResource = function(x, y, serfId) {
    // Remove from resources array
    self.resources = self.resources.filter(function(r) {
      return r[0] !== x || r[1] !== y;
    });
    // Remove from assigned spots
    if(self.assignedSpots[serfId]) {
      delete self.assignedSpots[serfId];
    }
  };
  
  self.tally = function(){
    var f = 0;
    var s = 0;
    for(var i in self.farms){
      f++;
    }
    for(var i in self.serfs){
      s++;
    }
    
    // New logic: spawn serfs based on available work spots
    // Target = half the number of available work spots (rounded up)
    var availableWorkSpots = self.resources.length;
    var idealSerfCount = Math.ceil(availableWorkSpots / 2);
    
    if(s < idealSerfCount){
      var grain = 0;
      if(self.tavern){
        // Check if owner still exists
        if(!Player.list[self.owner]){
          // Mill owner no longer exists, skip serf creation
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
        if(grain >= s && House.list[self.house].newSerfs){
          House.list[self.house].newSerfs(self.id,hq);
        }
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
  self.assignedSpots = {}; // Track which spots are assigned to which serfs {serfId: [x,y]}
  self.log = {};
  self.patrol = true;
  self.dailyStores = {wood: 0}; // Track daily resource collection
  
  // Resource depletion reporting - called by serfs when they deplete a resource
  self.reportDepletedResource = function(x, y, serfId) {
    // Remove from resources array
    self.resources = self.resources.filter(function(r) {
      return r[0] !== x || r[1] !== y;
    });
    // Remove from assigned spots
    if(self.assignedSpots[serfId]) {
      delete self.assignedSpots[serfId];
    }
  };
  
  self.tally = function(){
    var r = 0;
    var s = 0;
    for(var i in self.resources){
      r++;
    }
    for(var i in self.serfs){
      s++;
    }
    
    // New logic: spawn serfs based on available work spots
    // Target = half the number of available work spots (rounded up)
    var availableWorkSpots = self.resources.length;
    var idealSerfCount = Math.ceil(availableWorkSpots / 2);
    
    if(s < idealSerfCount){
      var wood = 0;
      if(self.tavern){
        // Check if owner still exists
        if(!Player.list[self.owner]){
          // Lumbermill owner no longer exists, skip serf creation
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
        if(wood >= s && House.list[self.house].newSerfs){
          House.list[self.house].newSerfs(self.id,hq);
        }
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
  self.assignedSpots = {}; // Track which spots are assigned to which serfs {serfId: [x,y]}
  self.log = {};
  self.patrol = true;
  self.dailyStores = {stone: 0, ironore: 0, silverore: 0, goldore: 0, diamond: 0}; // Track daily resource collection
  
  // Resource depletion reporting - called by serfs when they deplete a resource
  self.reportDepletedResource = function(x, y, serfId) {
    // Remove from resources array
    self.resources = self.resources.filter(function(r) {
      return r[0] !== x || r[1] !== y;
    });
    // Remove from assigned spots
    if(self.assignedSpots[serfId]) {
      delete self.assignedSpots[serfId];
    }
  };
  
  self.tally = function(){
    var r = 0;
    var s = 0;
    for(var i in self.resources){
      r++;
    }
    for(var i in self.serfs){
      s++;
    }
    
    // New logic: spawn serfs based on available work spots
    // Target = half the number of available work spots (rounded up)
    var availableWorkSpots = self.resources.length;
    var idealSerfCount = Math.ceil(availableWorkSpots / 2);
    
    if(s < idealSerfCount){
      if(self.cave){
        var ore = 0;
        if(self.tavern){
          // Check if owner still exists
          if(!Player.list[self.owner]){
            // Mine owner no longer exists, skip serf creation
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
          if(ore >= s && House.list[self.house].newSerfs){
            House.list[self.house].newSerfs(self.id,hq);
          }
        }
      } else {
        var stone = 0;
        if(self.tavern){
          // Check if owner still exists
          if(!Player.list[self.owner]){
            // Mine owner no longer exists, skip serf creation
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
          if(stone >= s && House.list[self.house].newSerfs){
            House.list[self.house].newSerfs(self.id,hq);
          }
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
        var alertMsg = '⚠️ ALERT: ' + (enemy.name || enemy.class || 'Enemy') + ' detected near your outpost at [' + enemyLoc[0] + ',' + enemyLoc[1] + ']';
        
        // Send alert to owner
        var ownerSocket = SOCKET_LIST[self.owner];
        if(ownerSocket){
          ownerSocket.write(JSON.stringify({msg:'addToChat', message: '<span style="color:orange;">' + alertMsg + '</span>'}));
        }
        
        // Outpost alert logging handled via event system
        
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
          // Guard response logging handled via event system
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
        var angleDegrees = angle * 180 / Math.PI; // Convert radians to degrees
        
        // Create arrow (unlimited ammo)
        Arrow({
          parent: self.id,
          angle: angleDegrees,
          x: self.x,
          y: self.y,
          z: 0,
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
        if(b.type == 'mill' || b.type == 'lumbermill' || b.type == 'mine' || b.type == 'dock' || b.type == 'market'){
          if(!b.tavern){
            Building.list[i].tavern = self.id;
          }
          if(b.type == 'market'){
            self.market = b.id;
          }
        }
      }
    }
  }
  self.newSerfs = function(b){
    // Safety check: ensure owner still exists
    if(!Player.list[self.owner]){
      // Tavern owner no longer exists, skip serf creation
      return;
    }
    
    var building = Building.list[b];
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
      
      // For lumbermill/mine/dock, first serf MUST be male; for mill, can be either
      if(building.type == 'lumbermill' || building.type == 'mine' || building.type == 'dock'){
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
        if(building.type == 'mill' || building.type == 'dock'){
          Building.list[b].serfs[s1] = s1;
          Player.list[s1].work = {hq:b,spot:null};
        }
      }
      if(Player.list[s2].sex == 'm'){
        Building.list[b].serfs[s2] = s2;
        Player.list[s2].work = {hq:b,spot:null};
      } else {
        if(building.type == 'mill' || building.type == 'dock'){
          Building.list[b].serfs[s2] = s2;
          Player.list[s2].work = {hq:b,spot:null};
        }
      }
      self.occ += 2;
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
  self.tavern = null;
  self.resources = []; // Not used for docks - boats go to random water locations
  self.serfs = {};
  self.assignedSpots = {}; // Track which serf is assigned to which ship {serfId: shipId}
  self.log = {};
  self.ships = []; // Array of fishing ship IDs spawned by this dock (max 4)
  self.patrol = true;
  self.dailyStores = {fish: 0}; // Track daily fish collection
  
  // Zone name is passed during construction (checked BEFORE tiles are converted)
  self.zoneName = param.zoneName || 'Dock';
  
  // Dock networking system  
  self.storedShips = []; // Ships currently stored at this dock {shipId, shipType, owner, cargo}
  
  // NOTE: No reportDepletedResource() - fish are unlimited
  
  self.tally = function(){
    var s = 0;
    for(var i in self.serfs){
      s++;
    }
    
    // Ship-based work spot system
    // Max 4 fishing ships per dock
    var shipCount = Math.min(self.ships.length, 4);
    var idealSerfCount = shipCount; // 1:1 ratio with ships
    
    // Spawn serfs based on available ships (1 serf per ship)
    // Extra serfs without boats will fish from shore
    if(s < idealSerfCount){
      var fish = 0;
      if(self.tavern){
        // Check if owner still exists
        if(!Player.list[self.owner]){
          // Dock owner no longer exists, skip serf creation
        } else if(Player.list[self.owner].house){
          var h = Player.list[self.owner].house;
          fish = House.list[h].stores.fish || 0;
          if(fish >= s){
            Building.list[self.tavern].newSerfs(self.id);
          }
        } else {
          fish = Player.list[self.owner].stores.fish || 0;
          if(fish >= s){
            Building.list[self.tavern].newSerfs(self.id);
          }
        }
      } else if(self.house >= 2 && self.house < 7){
        var hq = House.list[self.house].hq;
        fish = House.list[self.house].stores.fish || 0;
        if(fish >= s && House.list[self.house].newSerfs){
          House.list[self.house].newSerfs(self.id,hq);
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
      }
    }
  }
  
  // Find geographic zone on init
  self.findZone = function() {
    if(global.zoneManager) {
      var loc = getLoc(self.x, self.y);
      var zone = global.zoneManager.getZoneAt(loc);
      
      // Only use geographic features (not faction territories)
      if(zone && zone.type === 'geographic') {
        self.zoneName = zone.name;
        console.log('⚓ Dock initialized in zone: ' + zone.name);
      }
    }
  };
  
  self.findTavern();
  self.findZone();
}

// Faction-to-basic-unit mapping for garrison spawning
const FACTION_BASIC_UNITS = {
  'Goths': ['Goth'], // Generic Goth unit
  'Franks': ['FrankSpear', 'FrankSword', 'FrankBow'],
  'Celts': ['CeltSpear', 'CeltAxe'], // CeltSword and CeltBow don't exist yet
  'Teutons': ['TeutonPike', 'TeutonBow'], // TeutonSpear and TeutonSword don't exist yet
  'Norsemen': ['NorseSpear', 'NorseSword'] // NorseBow doesn't exist yet
  // Player houses default to Footsoldier/Skirmisher/Cavalier progression
};

// Comprehensive faction unit progression (basic -> elite -> mounted)
const FACTION_UNIT_PROGRESSION = {
  // Player factions
  'Player': {
    basic: ['Footsoldier'],
    elite: 'Skirmisher',
    mounted: 'Cavalier'
  },
  
  // NPC factions
  'Goths': {
    basic: ['Goth'],
    elite: null,
    mounted: 'Cataphract'
  },
  'Norsemen': {
    basic: ['NorseSpear', 'NorseSword'],
    elite: 'Huskarl',
    mounted: null
  },
  'Franks': {
    basic: ['FrankSpear', 'FrankSword', 'FrankBow'],
    elite: null,
    mounted: 'Carolingian'
  },
  'Celts': {
    basic: ['CeltSpear', 'CeltAxe'],
    elite: null,
    mounted: 'Headhunter'
  },
  'Teutons': {
    basic: ['TeutonPike', 'TeutonBow'],
    elite: null,
    mounted: 'TeutonicKnight'
  },
  'Papal States': {
    basic: ['SwissGuard'],
    elite: 'Hospitaller',
    mounted: 'ImperialKnight'
  }
};

// Expose to global scope for access by other modules
global.FACTION_UNIT_PROGRESSION = FACTION_UNIT_PROGRESSION;

// Auto-upgrade all units with 10+ kills when stable is built
global.autoUpgradeUnitsOnStable = function(houseId) {
  const house = House.list[houseId];
  if (!house) return;
  
  const progression = FACTION_UNIT_PROGRESSION[house.name];
  if (!progression || !progression.mounted) return;
  
  let upgradeCount = 0;
  
  // Find all military units with 10+ kills
  for (const id in Player.list) {
    const unit = Player.list[id];
    if (unit.military && unit.house === houseId && unit.kills >= 10) {
      // Check if not already mounted
      if (!unit.mounted && global.simpleCombat) {
        global.simpleCombat.upgradeMilitaryUnit(unit, progression.mounted, house);
        upgradeCount++;
      }
    }
  }
  
  if(upgradeCount > 0){
    console.log(`🏇 Auto-upgraded ${upgradeCount} units with 10+ kills for ${house.name} (stable completed)`);
  }
};

Garrison = function(param){
  var self = Building(param);
  self.queue = []; // Keep for backward compatibility (can be used for manual recruitment later)
  self.productionTimer = 0; // Produce units every 5 minutes (18000 frames at 60fps)
  self.patrol = true;
  
  self.update = function(){
    // Debug: Log that garrison update is being called
    if(self.productionTimer === 0 || self.productionTimer % 3600 === 0){
      console.log('🏰 Garrison update called (timer: ' + self.productionTimer + ')');
    }
    
    // Automated military production (only if owner has a House)
    self.productionTimer++;
    if(self.productionTimer >= 18000){
      self.productionTimer = 0;
      
      // Resolve house ownership (works for both player and NPC factions)
      var house = null;
      if(House.list[self.owner]){
        // Owner is directly a house ID (NPC factions)
        house = House.list[self.owner];
      } else if(House.list[self.house]){
        // Building has house property
        house = House.list[self.house];
      } else {
        // Try to get house through player owner
        var owner = Player.list[self.owner];
        if(owner && owner.house && House.list[owner.house]){
          house = House.list[owner.house];
        }
      }
      
      if(!house){
        // No house found - garrison can't produce units
        return;
      }
      
      // Check food availability (fish first, then grain)
      var fish = house.stores.fish || 0;
      var grain = house.stores.grain || 0;
      var totalFood = fish + grain;
      
      if(totalFood < 20) return; // Need at least 20 food to produce a unit
      
      // Count current military units for this house
      var militaryCount = 0;
      for(var id in Player.list){
        var unit = Player.list[id];
        if(unit && unit.military && unit.house === house.id){
          militaryCount++;
        }
      }
      
      // Determine max garrison size based on total food (1 unit per 50 food available)
      var maxGarrison = Math.floor(totalFood / 50);
      if(militaryCount >= maxGarrison) return; // Already at capacity
      
      // Spawn location
      var sp = self.plot[7] || self.plot[0];
      var spCoords = getCenter(sp[0], sp[1]);
      
      // Determine unit type based on faction progression and buildings
      var progression = FACTION_UNIT_PROGRESSION[house.name];
      var unitClass;
      
      console.log('🔍 Garrison attempting production for ' + house.name + ' (grain: ' + grain + ', wood: ' + (house.stores.wood || 0) + ', military: ' + militaryCount + '/' + maxGarrison + ')');
      
      if(progression){
        // Use progression system
        console.log('📊 Using progression for ' + house.name + ' (stronghold: ' + house.hasStronghold + ', elite: ' + progression.elite + ')');
        
        // Check if stronghold exists (produces elite units)
        if(house.hasStronghold && progression.elite){
          unitClass = progression.elite;
        } else {
          // No stronghold, produce basic units
          var basicUnits = progression.basic;
          unitClass = basicUnits[Math.floor(Math.random() * basicUnits.length)];
        }
        
        // Check resources (basic units need food + wood)
        // Consume fish first, then grain
        var wood = house.stores.wood || 0;
        if(totalFood < 20 || wood < 10){
          console.log('⚠️ Not enough resources for ' + house.name + ' (fish: ' + fish + ', grain: ' + grain + ', wood: ' + wood + ')');
          return;
        }
        
        // Consume fish first, then grain
        if(fish >= 20){
          house.stores.fish -= 20;
        } else {
          // Use fish first, then remainder from grain
          var fishUsed = fish;
          var grainNeeded = 20 - fishUsed;
          house.stores.fish = 0;
          house.stores.grain -= grainNeeded;
        }
        house.stores.wood -= 10;
      } else {
        // Fallback for factions without progression defined (use old system)
        console.log('📊 No progression found for ' + house.name + ', using FACTION_BASIC_UNITS fallback');
        var factionUnits = FACTION_BASIC_UNITS[house.name];
        if(!factionUnits || factionUnits.length === 0){
          console.log('⚠️ No basic units defined for ' + house.name);
          return;
        }
        
        var randomIndex = Math.floor(Math.random() * factionUnits.length);
        unitClass = factionUnits[randomIndex];
        
        var wood = house.stores.wood || 0;
        if(totalFood < 20 || wood < 10){
          console.log('⚠️ Not enough resources for ' + house.name + ' (fish: ' + fish + ', grain: ' + grain + ', wood: ' + wood + ')');
          return;
        }
        
        // Consume fish first, then grain
        if(fish >= 20){
          house.stores.fish -= 20;
        } else {
          // Use fish first, then remainder from grain
          var fishUsed = fish;
          var grainNeeded = 20 - fishUsed;
          house.stores.fish = 0;
          house.stores.grain -= grainNeeded;
        }
        house.stores.wood -= 10;
      }
      
      console.log('✅ Selected unit class: ' + unitClass + ' for ' + house.name);
      
      if(unitClass){
        
        // Spawn the unit using global constructor
        var unitConstructor = global[unitClass];
        if(unitConstructor){
          var newUnit = unitConstructor({
          x:spCoords[0],
          y:spCoords[1],
          z:1,
          house:house.id,
          kingdom:house.kingdom,
          home:{z:1, loc:sp}
        });
          
          // Initialize patrol mode (uses faction's universal patrol list)
          newUnit.mode = 'patrol';
          newUnit.patrol = {
            enabled: true,
            targetTiles: {}, // Cache of chosen patrol points per building
            idleTimer: 0,
            resumePoint: null
          };
          
          // Create military recruitment event
          if(global.eventManager){
            global.eventManager.militaryUnitRecruited(
              unitClass,
              house.name,
              house.id,
              { x: newUnit.x, y: newUnit.y, z: newUnit.z }
            );
          }
          
          console.log('⚔️ Garrison produced ' + unitClass + ' for ' + house.name);
        } else {
          console.error('⚠️ Unit constructor not found: ' + unitClass);
        }
      } else {
        console.log('⚠️ Garrison production failed: unitClass is ' + unitClass + ' for ' + house.name);
      }
    }
  }
  
  return self;
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
  
  return self;
}

Gate = function(param){
  var self = Building(param);
  self.patrol = true;
  self.open = function(){

  }
  self.close = function(){

  }
  
  return self;
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
  
  return self;
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
  // Speed management system
  self.updateSpeed = function() {
    // Step 1: Determine target speed based on state
    let targetSpeed;
    if (self.action === 'flee') {
      targetSpeed = self.runSpd || 6;
    } else if (self.action === 'combat') {
      targetSpeed = self.runSpd || 6;
    } else {
      targetSpeed = self.baseSpd;
    }
    
    // Step 2: Apply terrain modifiers for final speed
    const loc = getLoc(self.x, self.y);
    if (getTile(0, loc[0], loc[1]) >= 5 && getTile(0, loc[0], loc[1]) < 6) {
      // Mountain terrain - 20% speed
      self.currentSpeed = targetSpeed * 0.2;
    } else if (getTile(0, loc[0], loc[1]) == 18) {
      // Road terrain - 110% speed
      self.currentSpeed = targetSpeed * 1.1;
    } else if (getTile(0, loc[0], loc[1]) == 0) {
      // Water terrain - 10% speed
      self.currentSpeed = targetSpeed * 0.1;
    } else {
      // Normal terrain - 100% speed
      self.currentSpeed = targetSpeed;
    }
  };
  self.baseSpd = 2;
  self.runSpd = 6; // Running/fleeing speed
  self.currentSpeed = 2; // Current movement speed (updated by updateSpeed)
  self.drag = 1;
  self.idleRange = 1000;
  self.idleTime = 0; // Initialize idle timer
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
  
  // Social System Integration - Initialize social profile for humanoid NPCs
  self.socialProfile = null;
  if (global.socialSystem) {
    self.socialProfile = global.socialSystem.initializeNPC(self);
  }
  
  self.die = function(report){ // report {id,cause}
    var deathLocation = getLoc(self.x, self.y);
    var deathZ = self.z;
    
    // Notify social system of death for witness recording
    if (global.socialSystem) {
      global.socialSystem.recordDeathWitnessed(self.id, deathLocation, 1280);
      global.socialSystem.removeNPC(self.id);
    }
    
    // Phase 5: Kill Tracking for NPCs
    var killerName = 'Unknown';
    if(report.id){
      if(Player.list[report.id]){
        var killer = Player.list[report.id];
        killerName = killer.name || killer.class;
        // Kill tracking logged via death event
        
        // Track kill and award skulls
        killer.kills = (killer.kills || 0) + 1;
        
        // Update skull display based on kill count (simplified)
        if(killer.kills >= 10){
          killer.skulls = '☠️'; // Skull and crossbones
        } else if(killer.kills >= 3){
          killer.skulls = '💀'; // Single skull
        }
        
        // Kill count tracking logged via death event
        
        // Phase 6: Fauna Miniboss Growth
        if(killer.class === 'Boar' || killer.class === 'Wolf'){
          // Check for miniboss upgrade thresholds
          let newScale = killer.spriteScale;
          let shouldUpgrade = false;
          
          if(killer.kills === 3 && killer.spriteScale < 1.3){
            newScale = 1.3; // 30% larger at 3 kills
            shouldUpgrade = true;
          } else if(killer.kills === 10 && killer.spriteScale < 1.6){
            newScale = 1.6; // 60% larger at 10 kills
            shouldUpgrade = true;
          }
          
          if(shouldUpgrade){
            killer.spriteScale = newScale;
            
            // Create miniboss upgrade event
            if(global.eventManager){
              global.eventManager.minibossUpgrade(killer, killer.kills, newScale, { x: killer.x, y: killer.y, z: killer.z });
            }
          }
        }
        
        // Phase 7: Military Unit Kill-Based Upgrades
        if(killer.military && killer.house){
          const house = House.list[killer.house];
          if(house && global.simpleCombat){
            global.simpleCombat.checkMilitaryUpgrade(killer, house);
          }
        }
        
        // End combat for killer using simple combat system (DON'T clear combat.target before this!)
        if(global.simpleCombat){
          global.simpleCombat.endCombat(killer);
        }
      } else {
        // Death cause logged via death event
      }
    }
    
    // End combat for killed character using simple combat system (DON'T clear combat.target before this!)
    if(global.simpleCombat){
      global.simpleCombat.endCombat(self);
    }
    
    // Create death event
    if (global.eventManager) {
      const killer = report.id ? Player.list[report.id] : null;
      global.eventManager.death(self, killer, { x: self.x, y: self.y, z: deathZ });
    }
    
    // Comprehensive cleanup
    self.cleanup();
    
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
      // Skeleton spawn logged via death event
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

  // Comprehensive cleanup method for all timers and references
  self.cleanup = function() {
    // Clear aggro interval
    if(self.aggroInterval){
      clearInterval(self.aggroInterval);
      self.aggroInterval = null;
    }
    
    // Clear any other timers (pathfinding timeout, etc.)
    if(self._pathfindTimeout){
      clearTimeout(self._pathfindTimeout);
      self._pathfindTimeout = null;
    }
    
    // Clear all pending action timeouts (fishing, etc.)
    if(self.actionTimeouts && Array.isArray(self.actionTimeouts)){
      self.actionTimeouts.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      self.actionTimeouts = [];
    }
    
    // Unsubscribe from EventManager
    if(global.eventManager){
      global.eventManager.unsubscribe(self.id);
    }
    
    // Remove from zones
    if(self.zone){
      const zoneKey = `${self.zone[0]},${self.zone[1]}`;
      const zoneSet = zones.get(zoneKey);
      if(zoneSet){
        zoneSet.delete(self.id);
      }
    }
    
    // Remove from spatial system
    if(global.spatialSystem){
      global.spatialSystem.removeEntity(self.id);
    }
    
    // Clear combat state
    if(self.combat && self.combat.target){
      const target = Player.list[self.combat.target];
      if(target && target.combat && target.combat.target === self.id){
        target.combat.target = null;
        target.action = null;
      }
    }
    self.combat.target = null;
    self.action = null;
  };

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
  self.currentZone = null; // Track current zone for notifications

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
                // player death & respawn (only if entity has HP - exclude invulnerable entities like falcons)
                if(Player.list[p.id].hp !== null && Player.list[p.id].hp <= 0){
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
                // player death & respawn (only if entity has HP - exclude invulnerable entities like falcons)
                if(Player.list[p.id].hp !== null && Player.list[p.id].hp <= 0){
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
                // player death & respawn (only if entity has HP - exclude invulnerable entities like falcons)
                if(Player.list[p.id].hp !== null && Player.list[p.id].hp <= 0){
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
                // player death & respawn (only if entity has HP - exclude invulnerable entities like falcons)
                if(Player.list[p.id].hp !== null && Player.list[p.id].hp <= 0){
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
    // Only players consume arrows; NPCs have unlimited
    if(self.type === 'player'){
      self.inventory.arrows--;
    }
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

  self.shouldRequestPath = function(tz, tc, tr){
    if(!self.path || !self.pathEnd){
      return true;
    }
    if(self.pathEnd.z !== tz){
      return true;
    }
    if(!self.pathEnd.loc || self.pathEnd.loc[0] !== tc || self.pathEnd.loc[1] !== tr){
      return true;
    }
    return false;
  };

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
          // Use pathfinding for cave navigation
          if(self.shouldRequestPath(tz, tLoc[0], tLoc[1])){
            self.getPath(-1, tLoc[0], tLoc[1]);
          }
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
        } else {
          // For other z-levels that need pathfinding, request it here
          if(self.shouldRequestPath(self.z, tLoc[0], tLoc[1])){
            self.getPath(self.z, tLoc[0], tLoc[1]);
          }
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
                var loc = getLoc(self.x, self.y);
                console.warn(self.name + ' stuck at z=2 at ['+loc+'] trying to reach z='+tz+' ['+tLoc+']. Work: ' + (self.work ? 'hq='+self.work.hq+', spot='+self.work.spot : 'none') + '. Home: z='+self.home.z+'. Forcing to z=1');
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
                  var loc = getLoc(self.x, self.y);
                  console.warn(self.name + ' (case 2) stuck at z=2 at ['+loc+'] trying to reach different building at z=2. Work: ' + (self.work ? 'hq='+self.work.hq : 'none') + '. Forcing to z=1');
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
      // Serf stuck logging handled via event system
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

  // ============================================================================
  // NPC LOOTING SYSTEM
  // ============================================================================
  
  self.checkLoot = function() {
    // Don't loot during combat
    if(self.action === 'combat') return;
    
    // Type-specific loot preferences
    const lootRadius = 128; // 2 tiles
    
    for(const itemId in Item.list) {
      const item = Item.list[itemId];
      if(!item || item.z !== self.z) continue;
      
      const dist = getDistance({x: self.x, y: self.y}, {x: item.x, y: item.y});
      if(dist < lootRadius) {
        // Check if this NPC wants this item type
        if(self.canLoot && self.canLoot(item)) {
          // Check for other humanoids nearby (avoid conflicts)
          if(!self.hasNearbyHumanoids || !self.hasNearbyHumanoids(64)) {
            if(item.pickup) {
              item.pickup(self.id);
              break; // One item per check
            }
          }
        }
      }
    }
  };
  
  self.canLoot = function(item) {
    // Wolves loot and consume meat
    if(self.class === 'Wolf') {
      return ['venison', 'boarmeat', 'lamb', 'fish', 'venisonloin', 'boarshank', 'lambchop', 'poachedfish'].includes(item.type);
    }
    
    // Military units loot everything from kills (handled separately in post-kill)
    if(self.military) {
      return true; // Loot weapons, armor, resources
    }
    
    // Serfs loot work-related items
    if(self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF') {
      return ['grain', 'wood', 'stone', 'ironore', 'bread'].includes(item.type);
    }
    
    // Other humanoid NPCs loot basic supplies
    if(self.type === 'npc' && (self.class !== 'Deer' && self.class !== 'Boar' && self.class !== 'Falcon')) {
      return ['bread', 'grain', 'wood'].includes(item.type);
    }
    
    return false;
  };
  
  self.hasNearbyHumanoids = function(radius) {
    const radiusSquared = radius * radius;
    for(const id in Player.list) {
      const entity = Player.list[id];
      if(!entity || entity.id === self.id) continue;
      if(entity.z !== self.z) continue;
      
      // Check if humanoid (not fauna)
      const isFauna = ['Deer', 'Boar', 'Wolf', 'Falcon'].includes(entity.class);
      if(isFauna) continue;
      
      const dx = entity.x - self.x;
      const dy = entity.y - self.y;
      const distSquared = dx * dx + dy * dy;
      
      if(distSquared < radiusSquared) {
        return true; // Humanoid nearby
      }
    }
    return false;
  };

  // ============================================================================
  // FIRST CHARACTER UPDATE (lines 3719-5340)
  // ============================================================================
  // This is the most comprehensive update function containing:
  // - Terrain transitions (cave, building, water entry/exit)
  // - Speed modifiers based on terrain type
  // - NPC AI modes (idle, patrol, escort, guard, raid, scout, flee, retreat)
  // - Complex pathfinding and waypoint navigation
  // - Stealth mechanics
  // - Cooldown management
  // - HP/Spirit regeneration
  // Dependencies: Called every frame for all Character instances
  // ============================================================================
  
  self.update = function(){
    // ===== GUARD: Boarded entities are controlled by ships =====
    // Boarded players should not run this update logic
    if(self.isBoarded){
      return;
    }
    
    // ===== CORE SETUP (lines 3725-3727) =====
    // Get current tile location and building
    var loc = getLoc(self.x,self.y);
    var b = getBuilding(self.x,self.y);
    self.zoneCheck();
    
    // ===== STEALTH MECHANICS (lines 3728-3733) =====
    // Stealthed characters have reduced drag (move slower), check for reveals
    if(self.stealthed){
      self.drag = 0.5;
      self.revealCheck();
    } else {
      self.drag = 1;
    }
    
    // ===== TORCH BEARER AUTO-LIGHTING (lines 3734-3740) =====
    // Automatically light torch in dark areas (night, caves, cellars)
    if(self.torchBearer){
      if(!self.hasTorch){
        if((self.z == 0 && nightfall) || self.z == -1 || self.z == -2){
          self.lightTorch(Math.random());
        }
      }
    }
    
    // ===== COOLDOWN MANAGEMENT (lines 3741-3750) =====
    // Decrement various cooldown timers
    if(self.idleTime > 0){
      self.idleTime--;
    }
    if(self.attackCooldown > 0){
      self.attackCooldown--;
    }
    // Decrement mine exit cooldown for serfs
    if(self.mineExitCooldown && self.mineExitCooldown > 0){
      self.mineExitCooldown--;
    }
    
    // ===== PERIODIC LOOT CHECK (lines 3752-3761) =====
    // NPCs check for nearby loot every 3 seconds (180 frames)
    if(self.type === 'npc' && self.checkLoot){
      if(!self._lootCheckCounter) self._lootCheckCounter = 0;
      self._lootCheckCounter++;
      
      if(self._lootCheckCounter >= 180) {
        self._lootCheckCounter = 0;
        self.checkLoot();
      }
    }

    // ===== TERRAIN TRANSITIONS & SPEED MODIFIERS (lines 3790-3920) =====
    // Handles z-level transitions (overworld, cave, building, water, cellar)
    // Sets speed modifiers based on terrain type (woods, mountains, roads)
    // Uses transitionIntent system to prevent accidental transitions for NPCs
    if(self.z == 0){
      if(getTile(0,loc[0],loc[1]) == 6){
        // At cave entrance - set state
        self.transitionState = 'at_entrance';
        
        // For players, auto-set intent (backward compatibility)
        if(self.type === 'player'){
          self.transitionIntent = 'enter_cave';
        }
        
        // Check intent to enter cave (with cooldown check for serfs)
        const isSerfClass = (self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF');
        const cooldownOK = !isSerfClass || (self.mineExitCooldown === 0);
        if(self.transitionIntent === 'enter_cave' && self.isAtPathDestination() && cooldownOK){
          self.enterCave(loc);
        } else if(self.transitionIntent === 'enter_cave' && !cooldownOK){
          // Serf wants to enter but cooldown active - clear intent to prevent stuck state
          self.transitionIntent = null;
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
          // Check CURRENT location, not stale loc from 2 seconds ago
          var currentLoc = getLoc(self.x, self.y);
          if(getTile(0,currentLoc[0],currentLoc[1]) >= 5 && getTile(0,currentLoc[0],currentLoc[1]) < 6){
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
      } else if(getTile(0,loc[0],loc[1]) == 0 && !self.ghost && !self.isBoarded){
        // Ghosts cannot go underwater, and boarded players should not enter water
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
      if(self.hp !== null && self.hp <= 0){
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

    // ===== NPC AI MODES (lines 3990-4350) =====
    // Complex behavioral state machine for NPCs
    // Modes: idle (wandering), patrol (building circuits), escort (follow target),
    //        guard (defend position), raid (attack enemies), scout (explore)
    // Actions: flee (escape combat), retreat (organized withdrawal), returning (leash enforcement)
    // Each mode has combat handling and action handling
    ////////////////
    // VANILLA AI //
    ////////////////

    // IDLE MODE - Random wandering within leash range
    if(self.mode == 'idle'){
      if(!self.action){
        // Military units only switch to patrol on first spawn (not every frame)
        // Removed automatic idle→patrol transition to prevent infinite loops
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
      } else if(self.action == 'retreat'){
        // Retreat action - move to retreat target without fighting back
        if(self.retreatTarget){
          var targetPos = self.retreatTarget;
          var currentPos = [self.x, self.y];
          var distance = Math.sqrt(
            Math.pow(targetPos[0] - currentPos[0], 2) + 
            Math.pow(targetPos[1] - currentPos[1], 2)
          );
          
          // If close enough to retreat target, clear retreat action
          if(distance <= 5){
            self.action = null;
            self.retreatTarget = null;
            // Clear combat targets
            if(self.combat){
              self.combat.target = null;
            }
            return;
          }
          
          // Move toward retreat target
          if(!self.path){
            self.moveTo(targetPos[0], targetPos[1]);
          }
          
          // If attacked while retreating, don't fight back - keep fleeing
          if(self.combat && self.combat.target){
            // Clear combat target to prevent fighting back
            self.combat.target = null;
          }
        } else {
          // No retreat target, clear action
          self.action = null;
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
        // Initialize patrol object if not present
        if(!self.patrol){
          self.patrol = {
            enabled: true,
            buildings: [],
            currentIndex: 0,
            idleTimer: 0,
            idleDuration: Math.floor(Math.random() * 600) + 300,
            resumePoint: null
          };
        }
        
        if(!self.action){
          // Safety check: ensure house exists
          if(!self.house || !House.list[self.house]){
            self.mode = 'idle';
            self.action = null;
            return;
          }
          
          // Use faction's universal patrol list
          var house = House.list[self.house];
          if(!house || !house.patrolBuildings || house.patrolBuildings.length === 0){
            // No strategic buildings to patrol
            if(self.mode !== 'idle'){
              console.log('⚠️ ' + (self.class || 'Unit') + ' has no faction patrol buildings, switching to idle');
              self.mode = 'idle';
            }
            return;
          }
          
          // Check if unit is idling at a building
          if(self.patrol.idleTimer > 0){
            // Standing guard
            self.patrol.idleTimer--;
            // Don't move while idling
          } else {
            // Get HQ position and territory radius
            var hqCoords = getCenter(house.hq[0], house.hq[1]);
            var territoryRadius = (house.territoryRadius || 30) * tileSize; // Default 30 tiles
            
            // Find all buildings within faction territory
            var buildingsInTerritory = [];
            
            for(var i = 0; i < house.patrolBuildings.length; i++){
              var bid = house.patrolBuildings[i];
              var b = Building.list[bid];
              
              if(!b || !b.built) continue;
              
              // Calculate distance from HQ (not from unit)
              var dx = b.x - hqCoords[0];
              var dy = b.y - hqCoords[1];
              var distFromHQ = Math.sqrt(dx * dx + dy * dy);
              
              // Only consider buildings within faction territory
              if(distFromHQ <= territoryRadius){
                buildingsInTerritory.push(b);
              }
            }
            
            if(buildingsInTerritory.length === 0){
              // No buildings within territory, switch to idle
              if(self.mode !== 'idle'){
                console.log('⚠️ ' + (self.class || 'Unit') + ' has no patrol buildings within territory (' + (territoryRadius / tileSize) + ' tiles from HQ), switching to idle');
                self.mode = 'idle';
              }
              return;
            }
            
            // Pick a RANDOM building from those in territory (not nearest - avoids loops)
            var randomIndex = Math.floor(Math.random() * buildingsInTerritory.length);
            var targetBuilding = buildingsInTerritory[randomIndex];
            
            // Pick a walkable tile near the building
            if(!self.patrol.targetTiles){
              self.patrol.targetTiles = {}; // Store chosen tiles per building
            }
            
            var buildingLoc;
            if(!self.patrol.targetTiles[targetBuilding.id]){
              // First visit - pick a random walkable tile near building
              var baseTile = targetBuilding.plot[0];
              var patrolRange = 3;
              var attempts = 0;
              var maxAttempts = 20;
              
              while(attempts < maxAttempts){
                var offsetCol = Math.floor(Math.random() * (patrolRange * 2 + 1)) - patrolRange;
                var offsetRow = Math.floor(Math.random() * (patrolRange * 2 + 1)) - patrolRange;
                var targetCol = baseTile[0] + offsetCol;
                var targetRow = baseTile[1] + offsetRow;
                
                if(targetCol >= 0 && targetCol < mapSize && targetRow >= 0 && targetRow < mapSize){
                  if(isWalkable(0, targetCol, targetRow)){
                    buildingLoc = [targetCol, targetRow];
                    self.patrol.targetTiles[targetBuilding.id] = buildingLoc;
                    break;
                  }
                }
                attempts++;
              }
              
              if(!buildingLoc){
                buildingLoc = [baseTile[0] + 1, baseTile[1] + 1];
                self.patrol.targetTiles[targetBuilding.id] = buildingLoc;
              }
            } else {
              buildingLoc = self.patrol.targetTiles[targetBuilding.id];
            }
            
            var buildingDist = self.getDistance({x: targetBuilding.x, y: targetBuilding.y});
            
            // Check if arrived at building (within 3 tiles)
            if(buildingDist <= tileSize * 3){
              // Arrived - start idle timer
              console.log('✓ ' + (self.class || 'Unit') + ' arrived at ' + targetBuilding.type + ', idling for ' + Math.floor((Math.random() * 600 + 300) / 60) + 's');
              self.patrol.idleTimer = Math.floor(Math.random() * 600) + 300; // 5-15 seconds
              
              // Clear target so next patrol picks a new random building
              delete self.patrol.targetTiles[targetBuilding.id];
            } else {
              // Path to building - buildings are always on z=0 (overworld)
              var targetZ = 0;
              
              // If unit is inside a building (z=1 or z=2), first exit to overworld
              if(self.z !== targetZ){
                if(self.home && self.home.loc){
                  self.moveTo(self.z, self.home.loc[0], self.home.loc[1]);
                }
              } else {
                // On overworld, path to chosen patrol point
                if(buildingLoc && buildingLoc.length === 2){
                  self.moveTo(targetZ, buildingLoc[0], buildingLoc[1]);
                }
              }
            }
          }
        } else if(self.action == 'combat'){
          // Save current position as resume point when first entering combat
          if(!self.patrol.resumePoint){
            self.patrol.resumePoint = {
              x: self.x,
              y: self.y,
              buildingIndex: self.patrol.currentIndex
            };
            console.log('📍 ' + (self.class || 'Unit') + ' saved patrol resume point');
          }
          
          // In combat - use SimpleCombat
          if(global.simpleCombat){
            global.simpleCombat.update(self);
          } else {
            // Fallback combat logic
          var target = Player.list[self.combat.target];
            if(!target){
              // Target gone, resume patrol from saved point
            self.combat.target = null;
            self.action = null;
              
              // Clear resume point after combat
              if(self.patrol.resumePoint){
                console.log('🔄 ' + (self.class || 'Unit') + ' resuming patrol after combat');
                self.patrol.resumePoint = null;
          }
              return;
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
    // Check pathfinding cooldown to prevent spam
    if(self.pathCooldown && self.pathCooldown > 0){
      return; // Skip pathfinding while on cooldown
    }
    
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
          // DON'T smooth cave paths - caves have narrow tunnels and smoothing causes wall-walking
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
    
    // If pathfinding failed (path is null), apply cooldown to prevent spam
    if(!self.path){
      if(!self.pathCooldown) self.pathCooldown = 0;
      self.pathCooldown = 90; // 1.5 seconds at 60fps
    }
  }

  // Helper function to extract base name from feature names
  // Examples: "X mountains" -> "X", "North X woods" -> "X", "X mountain" -> "X"
  function extractBaseFeatureName(zoneName) {
    if (!zoneName) return null;
    
    // Remove directional prefixes (North, South, East, West)
    let name = zoneName.trim();
    const directions = ['North', 'South', 'East', 'West'];
    for (const dir of directions) {
      if (name.startsWith(dir + ' ')) {
        name = name.substring(dir.length + 1).trim();
        break;
      }
    }
    
    // Remove common suffixes (mountains, mountain, woods, wood, etc.)
    const suffixes = ['mountains', 'mountain', 'woods', 'wood', 'forest', 'forests'];
    for (const suffix of suffixes) {
      // Case-insensitive matching
      const lowerName = name.toLowerCase();
      const lowerSuffix = suffix.toLowerCase();
      if (lowerName.endsWith(' ' + lowerSuffix)) {
        name = name.substring(0, name.length - suffix.length - 1).trim();
        break;
      }
    }
    
    return name || zoneName; // Return original if extraction failed
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
    
    // Create cave entry event with zone-based name
    if (global.zoneManager && global.eventManager && self.type === 'player') {
      const zone = global.zoneManager.getZoneAt(entrance);
      if (zone && zone.name) {
        const baseName = extractBaseFeatureName(zone.name);
        const caveName = baseName ? baseName + ' caves' : 'the caves';
        
        global.eventManager.createEvent({
          category: global.eventManager.categories.ENVIRONMENT,
          subject: self.id,
          subjectName: self.name,
          action: 'entered cave',
          target: zone.id,
          targetName: caveName,
          communication: global.eventManager.commModes.PLAYER,
          message: `<i>You have entered <b>${caveName}</b></i>`,
          log: `${self.name} entered ${caveName}`,
          position: { x: self.x, y: self.y, z: self.z }
        });
      }
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
    
    // Set cooldown for serfs to prevent immediate re-entry
    if(self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF'){
      self.mineExitCooldown = 120; // 2 seconds at 60fps
    }
    
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
        // DISABLED for caves (z=-1) - cave pathfinding is simple, oscillation detection causes wall-walking
        // Only for multi-waypoint paths - single-tile paths will naturally repeat
        var isOscillating = false;
        if(self.path.length > 1 && self.z !== -1){
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
        
        // IMPROVED STUCK DETECTION: Track both waypoint and actual movement
        if(!self.lastWaypoint || self.lastWaypoint.toString() != next.toString()){
          self.lastWaypoint = next;
          self.waypointStuckCounter = 0;
          self.waypointStuckPosition = {x: self.x, y: self.y};
        } else {
          self.waypointStuckCounter = (self.waypointStuckCounter || 0) + 1;
          
          // Check if entity has actually moved
          if(self.waypointStuckPosition){
            var distMoved = Math.sqrt(
              Math.pow(self.x - self.waypointStuckPosition.x, 2) + 
              Math.pow(self.y - self.waypointStuckPosition.y, 2)
            );
            
            // If entity moved significantly, reset stuck counter (temporary blockage)
            if(distMoved > 10){
              self.waypointStuckCounter = Math.max(0, self.waypointStuckCounter - 10);
              self.waypointStuckPosition = {x: self.x, y: self.y};
            }
          }
        }
        
        // IMPROVED: Differentiate between "temporarily blocked" and "truly stuck"
        // Entity is truly stuck if:
        // 1. Waypoint is blocked AND entity hasn't moved in a while, OR
        // 2. Waypoint counter exceeded threshold (60 frames = 1 second), OR
        // 3. Oscillating back and forth
        var isTrulyStuck = (isNextBlocked && isNotAtNext && self.waypointStuckCounter > 30) || 
                           self.waypointStuckCounter > 60 || 
                           isOscillating;
        
        if(isTrulyStuck){
          // OSCILLATION DETECTED - Immediately recalculate to get a different path
          if(isOscillating){
            // ANALYTICS: Record oscillation event
            if(global.stuckEntityAnalytics){
              global.stuckEntityAnalytics.recordStuckEvent(self, next, 'oscillating', self.pathRecalcAttempts || 0, self.z);
            }
            
            // Don't try to skip waypoints - the whole path is bad
            // Immediately clear and let pathfinding find a different route
            self.path = null;
            self.pathCount = 0;
            self.pathLocked = false;
            self.waypointHistory = [];
            self.skippedWaypointCount = 0;
            
            // Add cooldown to prevent immediate retry with same bad path
            if(!self.pathCooldown) self.pathCooldown = 0;
            self.pathCooldown = 30; // 0.5 seconds before retry
              return;
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
            
            // THROTTLING: Check if entity has actually moved
            if(!self.lastRecalcPosition){
              self.lastRecalcPosition = {x: self.x, y: self.y};
            }
            var distMoved = Math.sqrt(Math.pow(self.x - self.lastRecalcPosition.x, 2) + Math.pow(self.y - self.lastRecalcPosition.y, 2));
            
            // EXPONENTIAL BACKOFF: Wait longer between recalc attempts
            if(!self.nextRecalcTime) self.nextRecalcTime = 0;
            var now = Date.now();
            
            // Calculate backoff delay (exponential: 0ms, 100ms, 200ms, 400ms, 800ms, ...)
            var backoffDelay = self.pathRecalcAttempts > 0 ? Math.min(1600, 100 * Math.pow(2, self.pathRecalcAttempts - 1)) : 0;
            
            // Skip recalc if:
            // 1. Entity hasn't moved significantly (< 5 pixels) AND
            // 2. Not enough time has passed since last recalc (backoff)
            if(distMoved < 5 && now < self.nextRecalcTime){
              // Wait for backoff period
              return;
            }
            
            // ANALYTICS: Record stuck event
            if(global.stuckEntityAnalytics){
              global.stuckEntityAnalytics.recordStuckEvent(self, next, reason, self.pathRecalcAttempts, self.z);
            }
            
            // Update recalc tracking
            self.lastRecalcPosition = {x: self.x, y: self.y};
            self.nextRecalcTime = now + backoffDelay;
            
            // Only log every 3rd attempt to reduce spam
            if(self.pathRecalcAttempts % 3 == 1){
              console.log((self.name || 'Entity') + ' path ' + reason + ' at waypoint ' + next + ', recalculating... (attempt ' + self.pathRecalcAttempts + '/' + maxRetries + ', backoff=' + backoffDelay + 'ms)');
            }
            self.path = null;
            self.pathCount = 0;
            self.lastWaypoint = null;
            self.waypointStuckCounter = 0;
            self.waypointHistory = []; // Clear oscillation history
            self.getPath(self.pathEnd.z, self.pathEnd.loc[0], self.pathEnd.loc[1]);
            return;
          } else {
            // ANALYTICS: Record gave up event
            if(global.stuckEntityAnalytics){
              global.stuckEntityAnalytics.recordStuckEvent(self, next, 'gaveUp', self.pathRecalcAttempts, self.z);
              global.stuckEntityAnalytics.maybeLogStats();
            }
            
            // FALLBACK BEHAVIOR: Try alternative strategies before completely giving up
            var fallbackSuccessful = false;
            
            // Strategy 1: Try pathfinding to nearest walkable tile near target
            if(self.pathEnd && !fallbackSuccessful){
              var nearbyWalkable = self.findNearestWalkableTile(self.pathEnd.loc[0], self.pathEnd.loc[1], self.pathEnd.z);
              if(nearbyWalkable){
                console.log((self.name || 'Entity') + ' trying fallback: nearest walkable to ' + nearbyWalkable);
                self.getPath(self.pathEnd.z, nearbyWalkable[0], nearbyWalkable[1]);
                if(self.path){
                  fallbackSuccessful = true;
                  self.pathRecalcAttempts = 0; // Reset attempts for new target
                }
              }
            }
            
            // Strategy 2: For serfs going home, try alternative building entrances
            if(self.action == 'home' && self.home && !fallbackSuccessful && self.class == 'Serf'){
              // Look for other doors in the building
              var buildingId = getBuilding(getCenter(self.home.loc[0], self.home.loc[1])[0], getCenter(self.home.loc[0], self.home.loc[1])[1]);
              if(buildingId && Building.list[buildingId] && Building.list[buildingId].plot){
                var building = Building.list[buildingId];
                for(var i in building.plot){
                  var plotTile = building.plot[i];
                  var tile = getTile(0, plotTile[0], plotTile[1]);
                  if(tile == 14 || tile == 16){ // Door tiles
                    // Try different door
                    if(plotTile[0] != self.home.loc[0] || plotTile[1] != self.home.loc[1]){
                      console.log((self.name || 'Entity') + ' trying alternative door at ' + plotTile);
                      self.getPath(1, plotTile[0], plotTile[1] + 1);
                      if(self.path){
                        fallbackSuccessful = true;
                        self.pathRecalcAttempts = 0;
                        break;
                      }
                    }
                  }
                }
              }
            }
            
            // If all fallbacks failed, give up
            if(!fallbackSuccessful){
              // Give up after max attempts - add cooldown to prevent immediate retry
              self.path = null;
              self.pathCount = 0;
              // Don't clear pathEnd if going home - let home action handle retry
              if(self.action != 'home'){
                self.pathEnd = null;
              }
              // DON'T clear work assignments during work mode - let them retry after cooldown
              // Only clear assignments if NOT in work mode
              if(self.work && self.work.spot && (self.action == 'task' || self.action == 'build') && self.mode !== 'work'){
                self.work.spot = null;
                self.action = null; // Clear action to trigger new assignment
              }
              self.pathRecalcAttempts = 0;
              self.lastWaypoint = null;
              self.waypointStuckCounter = 0;
              self.waypointHistory = []; // Clear oscillation history
              self.pathLocked = false; // Clear lock when giving up
              
              // Add pathfinding cooldown to prevent immediate retry (reduce CPU load)
              if(!self.pathCooldown) self.pathCooldown = 0;
              self.pathCooldown = 90; // 1.5 seconds at 60fps before trying again
            }
            return;
          }
        } else if(self.pathRecalcAttempts > 0 && isWalkable(self.z, next[0], next[1])){
          // Path is clear again, reset recalc counter and backoff timers
          self.pathRecalcAttempts = 0;
          self.nextRecalcTime = 0;
          self.lastRecalcPosition = null;
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
        if(diffX >= self.currentSpeed){
          self.x += self.currentSpeed;
          self.pressingRight = true;
          self.facing = 'right';
          movedThisFrame = true;
        } else if(diffX <= (0-self.currentSpeed)){
          self.x -= self.currentSpeed;
          self.pressingLeft = true;
          self.facing = 'left';
          movedThisFrame = true;
        }
        if(diffY >= self.currentSpeed){
          self.y += self.currentSpeed;
          self.pressingDown = true;
          self.facing = 'down';
          movedThisFrame = true;
        } else if(diffY <= (0-self.currentSpeed)){
          self.y -= self.currentSpeed;
          self.pressingUp = true;
          self.facing = 'up';
          movedThisFrame = true;
        }
        
        // Check if reached waypoint (both X and Y within currentSpeed range)
        if((diffX < self.currentSpeed && diffX > (0-self.currentSpeed)) && (diffY < self.currentSpeed && diffY > (0-self.currentSpeed))){
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
        self.skippedWaypointCount = 0; // Reset skip counter
        // Clear movement keys when path ends
        self.pressingRight = false;
        self.pressingLeft = false;
        self.pressingDown = false;
        self.pressingUp = false;
      }
    } else {
      return;
    }
    
    // ===== PASSIVE REGENERATION (lines 5366-5376) =====
    // HP and Spirit regeneration for all characters
    // Passive HP Regeneration for all characters (NPCs and Players)
    if(!self.ghost && self.hp < self.hpMax){
      // Regenerate HP at ~0.0042 per frame = 0.25 HP/second at 60fps
      self.hp = Math.min(self.hp + 0.0042, self.hpMax);
    }
    
    // Passive Spirit Regeneration (if character has spirit)
    if(!self.ghost && self.spirit && self.spiritMax && self.spirit < self.spiritMax){
      // Regenerate Spirit at ~0.0017 per frame = 0.1 Spirit/second at 60fps
      self.spirit = Math.min(self.spirit + 0.0017, self.spiritMax);
    }
  }
  // ===== END FIRST CHARACTER UPDATE =====

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
      onMtn:self.onMtn,
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
      spriteScale:self.spriteScale,
      isBoarded:self.isBoarded,
      boardedShip:self.boardedShip
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
      onMtn:self.onMtn,
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
      spriteScale:self.spriteScale,
      isBoarded:self.isBoarded,
      boardedShip:self.boardedShip
    }
  }

  Player.list[self.id] = self;

  initPack.player.push(self.getInitPack());
  return self;
}

// ============================================================================
// DOCK NETWORKING SYSTEM
// ============================================================================

// Create association between docks (called when ship travels between them)
Building.prototype.createDockAssociation = function(otherDockId) {
  var self = this;
  if(self.type !== 'dock') return;
  if(!otherDockId) return;
  if(otherDockId === self.id) return; // Can't associate with self
  
  var otherDock = Building.list[otherDockId];
  if(!otherDock || otherDock.type !== 'dock') return;
  
  // Add to this dock's association list (if not already present)
  if(!self.associatedDocks.includes(otherDockId)) {
    self.associatedDocks.push(otherDockId);
    console.log('🚢 ' + (self.zoneName || 'Dock') + ' associated with ' + (otherDock.zoneName || 'Dock'));
    
    // Propagate: Add all of the other dock's associations
    for(var i = 0; i < otherDock.associatedDocks.length; i++) {
      var thirdDockId = otherDock.associatedDocks[i];
      if(thirdDockId !== self.id && !self.associatedDocks.includes(thirdDockId)) {
        self.associatedDocks.push(thirdDockId);
        var thirdDock = Building.list[thirdDockId];
        console.log('  ↳ Learned about ' + (thirdDock && thirdDock.zoneName ? thirdDock.zoneName : 'Dock'));
      }
    }
  }
  
  // Bidirectional: Add this dock to other dock's list
  if(!otherDock.associatedDocks.includes(self.id)) {
    otherDock.associatedDocks.push(self.id);
  }
};

// Retrieve ship from storage
Building.prototype.retrieveShip = function(playerId, shipIndex) {
  var self = this;
  if(self.type !== 'dock') return null;
  if(shipIndex < 0 || shipIndex >= self.storedShips.length) return null;
  
  var shipData = self.storedShips[shipIndex];
  
  // Verify player owns this ship
  if(shipData.owner !== playerId) return null;
  
  // Remove from storage
  self.storedShips.splice(shipIndex, 1);
  
  // Respawn ship at dock entrance
  var spawnLoc = self.plot[0] || getLoc(self.x, self.y);
  var spawnCoords = getCenter(spawnLoc[0], spawnLoc[1]);
  
  // Recreate ship based on type
  var shipConstructor = global[shipData.shipType];
  if(!shipConstructor) return null;
  
  var ship = shipConstructor({
    x: spawnCoords[0],
    y: spawnCoords[1],
    z: 3, // Ship layer
    owner: playerId,
    house: self.house,
    kingdom: self.kingdom
  });
  
  // Restore cargo
  if(shipData.cargo) {
    ship.stores = shipData.cargo;
  }
  
  // Restore last dock
  ship.lastDock = self.id;
  
  console.log('⚓ ' + shipData.shipType + ' retrieved from ' + (self.zoneName || 'dock'));
  return ship.id;
};

// ============================================================================
// SHIP DOCKING SYSTEM
// ============================================================================

// Check if ship has contacted a dock
Character.prototype.checkDockContact = function() {
  var self = this;
  
  // Only for ships
  if(self.type !== 'ship') return false;
  
  var loc = getLoc(self.x, self.y);
  var buildingId = getBuilding(self.x, self.y);
  
  if(buildingId) {
    var building = Building.list[buildingId];
    
    // Check if it's a dock
    if(building && building.type === 'dock') {
      // Check if friendly (same house/kingdom)
      var isFriendly = (building.house === self.house) || 
                       (building.kingdom && building.kingdom === self.kingdom);
      
      if(isFriendly) {
        // Store ship at dock
        self.dockAtPort(building.id);
        return true;
      }
    }
  }
  
  return false;
};

// Dock ship at port
Character.prototype.dockAtPort = function(dockId) {
  var self = this;
  var dock = Building.list[dockId];
  if(!dock) return;
  
  // Record this dock visit - create association BEFORE updating lastDock
  if(self.lastDock && self.lastDock !== dockId) {
    // Create dock network association using OLD lastDock
    if(dock.createDockAssociation) {
      dock.createDockAssociation(self.lastDock);
    }
  }
  
  // Automatically unload fish from ship to owner's stores
  if(self.inventory && self.inventory.fish > 0){
    var fishToUnload = self.inventory.fish;
    
    // Determine where to deposit fish (player stores or house stores)
    if(Player.list[self.owner]){
      var owner = Player.list[self.owner];
      if(owner.house && House.list[owner.house]){
        // Deposit to house stores
        if(!House.list[owner.house].stores.fish){
          House.list[owner.house].stores.fish = 0;
        }
        House.list[owner.house].stores.fish += fishToUnload;
        console.log('🐟 Unloaded ' + fishToUnload + ' fish to house stores');
      } else {
        // Deposit to player stores
        if(!owner.stores.fish){
          owner.stores.fish = 0;
        }
        owner.stores.fish += fishToUnload;
        console.log('🐟 Unloaded ' + fishToUnload + ' fish to player stores');
      }
    } else if(dock.house && House.list[dock.house]){
      // Dock owned by faction - deposit to faction stores
      if(!House.list[dock.house].stores.fish){
        House.list[dock.house].stores.fish = 0;
      }
      House.list[dock.house].stores.fish += fishToUnload;
      console.log('🐟 Unloaded ' + fishToUnload + ' fish to faction stores');
    }
    
    // Clear ship's fish inventory
    self.inventory.fish = 0;
  }
  
  // Store ship data (fish is now cleared)
  dock.storedShips.push({
    shipId: self.id,
    shipType: self.shipType || self.class,
    owner: self.owner,
    cargo: self.stores // Preserve other cargo
  });
  
  // Update last dock AFTER creating association
  self.lastDock = dockId;
  
  // Remove ship from active play
  delete Player.list[self.id];
  
  console.log('⚓ ' + self.class + ' docked and stored at ' + (dock.zoneName || 'dock'));
};

// ============================================================================
// FISHING SYSTEM
// ============================================================================

// Helper: Get underwater items near coordinates
function getUnderwaterItemsNear(x, y, radiusTiles) {
  var items = [];
  var radiusPx = radiusTiles * tileSize;
  
  for(var id in Item.list) {
    var item = Item.list[id];
    if(item.z === -3) { // Underwater layer
      var dist = getDistance({x: x, y: y}, {x: item.x, y: item.y});
      if(dist <= radiusPx) {
        items.push(item);
      }
    }
  }
  
  return items;
}
global.getUnderwaterItemsNear = getUnderwaterItemsNear;

// Helper: Determine what was caught while fishing
function determineFishingCatch(character) {
  // Check for underwater items within 5 tiles
  var underwaterItems = getUnderwaterItemsNear(character.x, character.y, 5);
  
  if(underwaterItems.length > 0 && Math.random() < 0.1) {
    // 10% chance to catch item instead of fish
    var item = underwaterItems[Math.floor(Math.random() * underwaterItems.length)];
    return {
      type: 'item',
      data: item,
      emoji: '🐟' // Keep fish emoji to make it a surprise
    };
  }
  
  // Catch fish
  var fishCount;
  if(character.shipType === 'fishingship') {
    // Fishing ships only: 1-10 average, up to 20 max
    // Use weighted random for bell curve around 5-6
    fishCount = Math.min(20, Math.floor(Math.random() * 8) + Math.floor(Math.random() * 8) + 1);
  } else {
    // Shore fishing (players on land): always 1
    fishCount = 1;
  }
  
  return {
    type: 'fish',
    count: fishCount,
    emoji: '🐟'
  };
}
global.determineFishingCatch = determineFishingCatch;

// Start fishing (add to Character prototype)
Character.prototype.startFishing = function() {
  var self = this;
  
  // IMPORTANT: Only fishing ships can fish from ships (not longships, scout ships, etc.)
  if(self.type === 'ship' && self.shipType !== 'fishingship') {
    return; // Reject fishing for non-fishing ships
  }
  
  self.fishing = true;
  self.fishingTimer = 0;
  self.fishingCatchPending = null; // Stores pending catch data
};

// Update fishing logic (called each frame if fishing)
Character.prototype.updateFishing = function() {
  var self = this;
  if(!self.fishing) return;
  
  // Safety check: only fishing ships can fish
  if(self.type === 'ship' && self.shipType !== 'fishingship') {
    self.fishing = false;
    return;
  }
  
  self.fishingTimer++;
  
  // Check for catch every 60 frames (1 second at 60fps)
  if(self.fishingTimer % 60 === 0) {
    // Base catch chance
    var catchChance;
    if(self.shipType === 'fishingship') {
      catchChance = 0.15; // 15% per second for fishing ships only
    } else {
      catchChance = 0.08; // 8% per second for shore fishing (players on land)
    }
    
    if(Math.random() < catchChance) {
      // SUCCESS - something caught!
      self.fishingCatchPending = determineFishingCatch(self);
      
      // Send catch notification to client
      if(SOCKET_LIST[self.id]){
        SOCKET_LIST[self.id].write(JSON.stringify({
          msg: 'fishCatch',
          emoji: self.fishingCatchPending.emoji
        }));
      }
      
      // Give player 1 second to press F
      setTimeout(function() {
        if(self.fishingCatchPending) {
          // Missed it - reset
          self.fishingCatchPending = null;
        }
      }, 1000);
    }
  }
};

// Process fish catch (called when player presses F)
Character.prototype.processFishCatch = function() {
  var self = this;
  if(!self.fishingCatchPending) return false;
  
  var catchData = self.fishingCatchPending;
  self.fishingCatchPending = null;
  
  if(catchData.type === 'fish') {
    // Award fish
    self.stores.fish = (self.stores.fish || 0) + catchData.count;
    
    // Send notification
    if(SOCKET_LIST[self.id]){
      SOCKET_LIST[self.id].write(JSON.stringify({
        msg: 'addToChat',
        message: '🐟 Caught ' + catchData.count + ' fish!'
      }));
    }
    
    // For fishing ships controlled by serfs, reposition to new random water location
    if(self.shipType === 'fishingship' && self.type === 'ship'){
      // Find new random water location within dock radius
      // (This will be handled by serf AI behavior)
    }
    
    return true;
  } else if(catchData.type === 'item') {
    // Award item
    var item = catchData.data;
    if(item && Item.list[item.id]){
      // Remove item from world and add to inventory
      delete Item.list[item.id];
      
      // Add to inventory (simplified)
      if(!self.inventory.items) self.inventory.items = [];
      self.inventory.items.push(item);
      
      // Send notification
      if(SOCKET_LIST[self.id]){
        SOCKET_LIST[self.id].write(JSON.stringify({
          msg: 'addToChat',
          message: '📦 Found: ' + (item.name || 'Unknown Item') + '!'
        }));
      }
    }
    
    return true;
  }
  
  return false;
};

// FAUNA

Sheep = function(param){
  var self = Character(param);
  self.class = 'Sheep';
  return self;
}

Deer = function(param){
  var self = Character(param);
  self.class = 'Deer';
  self.isPrey = true; // Prey animal
  self.isNonCombatant = true; // Doesn't trigger outposts
  self.aggroRange = 256;
  self.runSpd = 5; // Deer flee speed
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

  // Store interval reference for cleanup
  self.aggroInterval = setInterval(function(){
    if(global.simpleCombat){
      global.simpleCombat.checkAggro(self);
    } else {
    self.checkAggro();
    }
  },100); // Check every 100ms for faster response

  // Find nearest heavy forest area
  self.findNearestForest = function(){
    var loc = getLoc(self.x, self.y);
    var bestForest = null;
    var bestDistance = Infinity;
    
    // Search in expanding radius for heavy forest (tile type 1)
    for(var radius = 1; radius <= 20; radius++){
      for(var dx = -radius; dx <= radius; dx++){
        for(var dy = -radius; dy <= radius; dy++){
          // Only check perimeter of current radius
          if(Math.abs(dx) !== radius && Math.abs(dy) !== radius && radius > 1) continue;
          
          var checkCol = loc[0] + dx;
          var checkRow = loc[1] + dy;
          
          // Bounds check
          if(checkCol < 0 || checkCol >= mapSize || checkRow < 0 || checkRow >= mapSize) continue;
          
          // Check if this tile is heavy forest
          if(getTile(0, checkCol, checkRow) >= 1 && getTile(0, checkCol, checkRow) < 2){
            var dist = Math.sqrt(dx*dx + dy*dy);
            if(dist < bestDistance){
              bestDistance = dist;
              bestForest = [checkCol, checkRow];
            }
          }
        }
      }
      
      // If we found a forest within reasonable distance, use it
      if(bestForest && bestDistance <= 10){
        break;
      }
    }
    
    return bestForest;
  };

  self.return = function(){
    if(!self.path){
      if(self.innaWoods){
        // Already in forest, just idle
        self.action = null;
      } else {
        // Find nearest forest instead of returning to home
        var forestLoc = self.findNearestForest();
        if(forestLoc){
          self.moveTo(self.z, forestLoc[0], forestLoc[1]);
        } else {
          // No forest found, just idle where we are
          self.action = null;
        }
      }
    }
  };

  // ============================================================================
  // SECOND CHARACTER UPDATE (lines 5934-6020)
  // ============================================================================
  // Simplified update function for fauna/simple NPCs
  // Contains:
  // - Pathfinding cooldown management
  // - Speed updates via updateSpeed() method
  // - Simplified terrain state tracking (innaWoods, onMtn)
  // - Automatic water entry (z=-3) without transition intent
  // - Basic idle mode with random wandering and flee behavior
  // - Calls updatePosition() to apply movement
  // NOTE: This creates overlap with first update - fauna might use either
  // Dependencies: Called for simple Character instances (Deer, Sheep, etc.)
  // ============================================================================
  
  self.update = function(){
    // ===== GUARD: Boarded entities are controlled by ships =====
    // Boarded players should not run normal update logic - their position is controlled by the ship
    if(self.isBoarded){
      return;
    }
    
    // ===== PATHFINDING COOLDOWN (lines 5940-5943) =====
    // Decrement pathfinding cooldown
    if(self.pathCooldown && self.pathCooldown > 0){
      self.pathCooldown--;
    }
    
    // ===== SPEED UPDATE (line 5946) =====
    // Update speed based on current state and terrain
    self.updateSpeed();
    
    // ===== CORE SETUP & COOLDOWNS (lines 5948-5952) =====
    var loc = getLoc(self.x,self.y);
    self.zoneCheck();
    if(self.idleTime > 0){
      self.idleTime--;
    }

    // ===== SIMPLIFIED TERRAIN STATE TRACKING (lines 5954-5983) =====
    // Only tracks terrain state (innaWoods, onMtn), NOT speed modifiers
    // Speed is handled by updateSpeed() method
    // Terrain state tracking (speed is handled by updateSpeed())
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
      setTimeout(function(){
        if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6){
          self.onMtn = true;
        }
      },2000);
    } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && self.onMtn){
      // Mountain terrain - no speed change needed (handled by updateSpeed)
    } else if(getTile(0,loc[0],loc[1]) == 18){
      self.innaWoods = false;
      self.onMtn = false;
    } else if(getTile(0,loc[0],loc[1]) == 0 && !self.isBoarded){
      self.z = -3;
      self.innaWoods = false;
      self.onMtn = false;
    } else {
      self.innaWoods = false;
      self.onMtn = false;
    }

    // ===== IDLE MODE ONLY (lines 6007-6040) =====
    // Simple fauna behavior: wander in woods, flee from combat
    if(self.mode == 'idle'){
      if(!self.action){
        // Speed is now managed by updateSpeed() - no manual speed changes needed
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
        }
      }
    }
    
    // ===== MOVEMENT UPDATE (line 6041) =====
    // Apply velocity to position for all non-ship entities
    self.updatePosition();
  }
  // ===== END SECOND CHARACTER UPDATE =====
  
  return self;
}

Boar = function(param){
  var self = Character(param);
  self.class = 'Boar';
  self.baseSpd = 5;
  self.runSpd = 7; // Boar run speed
  self.damage = 12;
  self.aggroRange = 128;
  self.wanderRange = 256; // Tight leash - territorial defense (2x aggro range)
  return self;
}

Wolf = function(param){
  var self = Character(param);
  self.class = 'Wolf';
  self.baseSpd = 3;
  self.runSpd = 5; // Default wolf run speed (day), updated dynamically based on day/night
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

  // Store interval reference for cleanup
  self.aggroInterval = setInterval(function(){
    if(global.simpleCombat){
      global.simpleCombat.checkAggro(self);
    } else {
    self.checkAggro();
    }
  },100); // Check every 100ms for faster response

  self.update = function(){
    // Update speed based on current state and terrain
    self.updateSpeed();
    
    var loc = getLoc(self.x,self.y);
    self.zoneCheck();
    if(nightfall){
      self.nightmode = true;
      self.aggroRange = 320; // Slightly more aggressive at night
      self.idleRange = 300;
      self.runSpd = 6; // Faster at night
    } else {
      self.nightmode = false;
      self.aggroRange = 256; // Standard range during day
      self.idleRange = 1000;
      self.runSpd = 5; // Slower during day
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
        // Don't modify maxSpd when fleeing (SimpleFlee manages speed)
        if(self.action !== 'flee'){
          self.maxSpd = (self.baseSpd * 0.2) * self.drag;
        }
        setTimeout(function(){
          // Check CURRENT location, not stale loc from 2 seconds ago
          var currentLoc = getLoc(self.x, self.y);
          if(getTile(0,currentLoc[0],currentLoc[1]) >= 5 && getTile(0,currentLoc[0],currentLoc[1]) < 6){
            self.onMtn = true;
          }
        },2000);
      } else if(getTile(0,loc[0],loc[1]) >= 5 && getTile(0,loc[0],loc[1]) < 6 && self.onMtn){
        // Don't modify maxSpd when fleeing (SimpleFlee manages speed)
        if(self.action !== 'flee'){
          self.maxSpd = self.baseSpd * self.drag;
        }
      } else if(getTile(0,loc[0],loc[1]) == 6){
        self.caveEntrance = loc;
        self.z = -1;
        // DON'T clear path - it needs to persist through z-transition
        self.innaWoods = false;
        self.onMtn = false;
        // Don't modify maxSpd when fleeing (SimpleFlee manages speed)
        if(self.action !== 'flee'){
          self.maxSpd = self.baseSpd * self.drag;
        }
      } else if(getTile(0,loc[0],loc[1]) == 18){
        self.innaWoods = false;
        self.onMtn = false;
        // Don't modify maxSpd when fleeing (SimpleFlee manages speed)
        if(self.action !== 'flee'){
          self.maxSpd = self.baseSpd * self.drag;
        }
      } else if(getTile(0,loc[0],loc[1]) == 0 && !self.isBoarded){
        self.z = -3;
        self.innaWoods = false;
        self.onMtn = false;
        // Don't modify maxSpd when fleeing (SimpleFlee manages speed)
        if(self.action !== 'flee'){
          self.maxSpd = (self.baseSpd * 0.1) * self.drag;
        }
      } else {
        self.innaWoods = false;
        self.onMtn = false;
        // Don't modify maxSpd when fleeing (SimpleFlee manages speed)
        if(self.action !== 'flee'){
          self.maxSpd = self.baseSpd * self.drag;
        }
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
      self.baseSpd = 3;
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
        // Fallback to old wolf combat logic - use runSpd
        if(self.nightmode){
          self.baseSpd = 7; // Night speed
        } else {
          self.baseSpd = 6; // Day speed
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
            self.baseSpd = 3;
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
            self.baseSpd = 3;
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
  self.type = 'fauna'; // Not 'npc' - falcons are passive fauna with no combat
  self.falconry = param.falconry;
  self.hp = null; // Invulnerable - falcons cannot be damaged
  self.baseSpd = 1;
  self.maxSpd = 1;
  self.spriteSize = tileSize*7;
  self.update = function(){
    if(!self.path){
      if(!self.falconry){
        // Safely get a new random destination, fallback to current position if spawn points unavailable
        try {
          self.path = randomSpawnO();
        } catch (err) {
          console.error('Falcon failed to get random spawn, staying in place:', err);
          // Stay at current location if spawn points are unavailable
          self.path = [self.x, self.y];
        }
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
          // Reached destination, get a new one
          try {
            self.path = randomSpawnO();
          } catch (err) {
            console.error('Falcon failed to get random spawn, staying in place:', err);
            // Stay at current location if spawn points are unavailable
            self.path = [self.x, self.y];
          }
        }
      }
    }
  }
  return self;
}

FishingShip = function(param){
  var self = Character(param);
  self.class = 'FishingShip';
  self.type = 'ship';
  self.name = 'Fishing Ship'; // Default name
  self.shipType = 'fishingship'; // Ship type identifier
  self.spriteSize = tileSize * 2; // Larger than serfs
  self.baseSpd = 1.5; // Slower than walking
  self.maxSpd = 1.5;
  self.currentSpeed = 1.5;
  
  // Ship properties
  self.dock = param.dock; // Reference to home dock building ID
  self.lastDock = param.dock; // Last dock this ship docked at (starts as home dock)
  self.embarkedSerfs = []; // Array of serf IDs currently on board
  self.passengers = []; // Array of player IDs aboard ship {playerId, isController}
  self.controller = null; // Player ID of who's controlling ship movement
  self.inventory = {fish: 0}; // Ship's fish inventory
  self.maxFish = 20; // Return to dock when this is reached
  self.owner = param.owner || null; // Player who owns/control this ship
  self.storedPlayer = null; // Player character stored when boarding
  self.isPlayerControlled = false; // True when player is actively controlling this ship
  self.spawned = param.spawned !== undefined ? param.spawned : true; // False for player ships until boarded
  self.dockedTimer = 0; // Timer for how long ship has been docked (1 hour before despawn)
  self.sailingGracePeriod = 0; // 3-second grace period after starting to sail (prevents immediate disembark)
  
  // Ship physics for smooth movement
  self.velocity = {x: 0, y: 0}; // Current velocity
  self.targetHeading = 0; // Target direction in radians
  self.currentHeading = 0; // Current direction in radians
  self.acceleration = 0.05; // How fast ship accelerates
  self.deceleration = 0.03; // How fast ship decelerates
  self.turnRate = 0.08; // How fast ship turns (radians per frame)
  self.maxVelocity = 1.5; // Maximum speed
  
  // Sailing control system - 2 points total to allocate
  self.sailPoints = {
    up: 0,    // W - north
    down: 0,  // S - south
    left: 0,  // A - west
    right: 0  // D - east
  };
  
  // State tracking
  self.mode = param.owner ? 'docked' : 'fishing'; // Player ships start docked
  self.workTimer = false; // Fishing timer
  self.fishingCooldown = 0; // Cooldown between catches
  
  self.update = function(){
    // Handle combat state (if ship gets aggroed)
    if(self.action === 'combat'){
      if(global.simpleCombat){
        global.simpleCombat.update(self);
      } else {
        // Fallback: clear invalid combat
        if(!self.combat || !self.combat.target || !Player.list[self.combat.target]){
          self.action = null;
          if(self.combat) self.combat.target = null;
        }
      }
    }
    
    // Decrement cooldowns
    if(self.fishingCooldown > 0){
      self.fishingCooldown--;
    }
    if(self.sailingGracePeriod > 0){
      self.sailingGracePeriod--;
    }
    
    // Handle docked timer - despawn after 1 minute
    if(self.mode == 'docked' && self.dockedTimer > 0){
      self.dockedTimer--;
      if(self.dockedTimer <= 0){
        console.log('Fishing ship despawning after 1 minute at dock');
        self.toRemove = true;
        return;
      }
    }
    
    // Don't run autonomous AI if player is controlling this ship
    if(self.isPlayerControlled){
      // Check if player is trying to move (any sail points > 0)
      var isMoving = self.sailPoints.up > 0 || self.sailPoints.down > 0 || 
                     self.sailPoints.left > 0 || self.sailPoints.right > 0;
      
      // If player starts moving while anchored/docked, begin sailing with grace period
      if(isMoving && (self.mode === 'docked' || self.mode === 'anchored')){
        self.mode = 'sailing';
        self.name = 'Fishing Ship'; // Remove anchor emoji
        self.sailingGracePeriod = 180; // 3 seconds at 60fps
        console.log('⚓ Ship departing - 3 second grace period started');
      }
      
      // Player-controlled ships always run physics to build velocity
      // Grace period only prevents disembark check (not movement)
      self.updateShipPhysics();
      
      // Sync all passengers' positions to ship position (NEW passenger system)
      for(var i = 0; i < self.passengers.length; i++){
        var passenger = self.passengers[i];
        if(Player.list[passenger.playerId]){
          Player.list[passenger.playerId].x = self.x;
          Player.list[passenger.playerId].y = self.y;
          Player.list[passenger.playerId].z = self.z;
        }
      }
      
      // Sync storedPlayer position to ship position (OLD boarding system)
      if(self.storedPlayer && Player.list[self.storedPlayer.id]){
        Player.list[self.storedPlayer.id].x = self.x;
        Player.list[self.storedPlayer.id].y = self.y;
        Player.list[self.storedPlayer.id].z = self.z;
      }
      
      return;
    }
    
    // Check if work hours ended - return to dock (only for AI ships)
    if((tempus == 'VI.p' || tempus == 'VII.p' || tempus == 'VIII.p' || tempus == 'IX.p' || tempus == 'X.p' || tempus == 'XI.p') && self.mode == 'fishing'){
      self.mode = 'returning';
      console.log('Fishing ship returning to dock (work hours ended, tempus: ' + tempus + ')');
      
      // Also trigger clockout for all embarked serfs
      for(var i = 0; i < self.embarkedSerfs.length; i++){
        var serfId = self.embarkedSerfs[i];
        if(Player.list[serfId]){
          Player.list[serfId].action = 'clockout';
        }
      }
    }
    
    // Check if inventory full - return to dock
    if(self.inventory.fish >= self.maxFish && self.mode == 'fishing'){
      self.mode = 'returning';
      console.log('Fishing ship returning to dock (inventory full: ' + self.inventory.fish + ' fish)');
    }
    
    var loc = getLoc(self.x, self.y);
    var tile = getTile(0, loc[0], loc[1]);
    
    // Check if at dock
    if(tile == 13 && self.dock && Building.list[self.dock]){ // Dock tile
      if(self.mode == 'returning'){
        // Deposit fish and disembark serfs
        this.depositFishAndDisembark();
        return;
      }
    }
    
    if(self.mode == 'fishing'){
      // Navigate to water and fish
      if(tile == 0 && self.fishingCooldown == 0){ // On water
        // Fish if serfs are aboard and there are fish in this tile
        if(self.embarkedSerfs.length > 0){
          var fishCount = getTile(6, loc[0], loc[1]); // Check fish resource layer
          if(fishCount > 0){
            self.fishingCooldown = 300; // 5 seconds between catches
            
            // Each serf aboard can catch 1 fish
            var catchAmount = Math.min(self.embarkedSerfs.length, fishCount);
            self.inventory.fish += catchAmount;
            
            // Deplete fish from tile
            tileChange(6, loc[0], loc[1], -catchAmount, true);
            
            console.log('🎣 Fishing ship caught ' + catchAmount + ' fish (total: ' + self.inventory.fish + '/' + self.maxFish + ')');
          }
        }
      }
      
      // Wander on water if not full (simple direct movement, no pathfinding)
      if(self.inventory.fish < self.maxFish && !self.path){
        // Find random water tile to navigate to
        var waterSpots = [];
        for(var i = -5; i <= 5; i++){
          for(var j = -5; j <= 5; j++){
            var checkC = loc[0] + i;
            var checkR = loc[1] + j;
            if(checkC >= 0 && checkC < mapSize && checkR >= 0 && checkR < mapSize){
              if(getTile(0, checkC, checkR) == 0){ // Water
                waterSpots.push([checkC, checkR]);
              }
            }
          }
        }
        if(waterSpots.length > 0){
          var rand = Math.floor(Math.random() * waterSpots.length);
          var dest = waterSpots[rand];
          var destCoords = getCenter(dest[0], dest[1]);
          // Set simple path target (ship will move directly toward it)
          self.path = [destCoords[0], destCoords[1]];
        }
      }
      
      // Direct movement toward water destination
      if(self.path && typeof self.path[0] === 'number'){
        var dx = self.path[0];
        var dy = self.path[1];
        var diffX = dx - self.x;
        var diffY = dy - self.y;
        
        // Move toward destination
        if(Math.abs(diffX) > self.currentSpeed || Math.abs(diffY) > self.currentSpeed){
          if(Math.abs(diffX) > self.currentSpeed){
            self.x += (diffX > 0 ? self.currentSpeed : -self.currentSpeed);
            self.facing = diffX > 0 ? 'right' : 'left';
            self.pressingRight = diffX > 0;
            self.pressingLeft = diffX < 0;
          }
          if(Math.abs(diffY) > self.currentSpeed){
            self.y += (diffY > 0 ? self.currentSpeed : -self.currentSpeed);
            self.facing = diffY > 0 ? 'down' : 'up';
            self.pressingDown = diffY > 0;
            self.pressingUp = diffY < 0;
          }
        } else {
          // Reached destination
          self.path = null;
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
        }
      }
    } else if(self.mode == 'returning'){
      // Path back to dock using direct movement
      if(self.dock && Building.list[self.dock]){
        var dockBuilding = Building.list[self.dock];
        // Find closest dock tile
        if(dockBuilding.plot && dockBuilding.plot.length > 0){
          var closestDockTile = null;
          var closestDist = Infinity;
          
          for(var i in dockBuilding.plot){
            var dt = dockBuilding.plot[i];
            var dtCoords = getCenter(dt[0], dt[1]);
            var dist = self.getDistance({x: dtCoords[0], y: dtCoords[1]});
            if(dist < closestDist){
              closestDist = dist;
              closestDockTile = dt;
            }
          }
          
          if(closestDockTile){
            var dockCoords = getCenter(closestDockTile[0], closestDockTile[1]);
            // Move directly toward dock
            var diffX = dockCoords[0] - self.x;
            var diffY = dockCoords[1] - self.y;
            
            if(Math.abs(diffX) > self.currentSpeed || Math.abs(diffY) > self.currentSpeed){
              if(Math.abs(diffX) > self.currentSpeed){
                self.x += (diffX > 0 ? self.currentSpeed : -self.currentSpeed);
                self.facing = diffX > 0 ? 'right' : 'left';
                self.pressingRight = diffX > 0;
                self.pressingLeft = diffX < 0;
              }
              if(Math.abs(diffY) > self.currentSpeed){
                self.y += (diffY > 0 ? self.currentSpeed : -self.currentSpeed);
                self.facing = diffY > 0 ? 'down' : 'up';
                self.pressingDown = diffY > 0;
                self.pressingUp = diffY < 0;
              }
            } else {
              // Reached dock, clear movement flags
              self.pressingRight = false;
              self.pressingLeft = false;
              self.pressingDown = false;
              self.pressingUp = false;
            }
          }
        }
      }
    }
    
    // Don't call updatePosition() - ship handles its own movement
  }
  
  // Handle sail point allocation when keys are pressed
  self.adjustSailPoints = function(direction){
    if(!self.isPlayerControlled) return;
    
    var opposites = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left'
    };
    
    var opposite = opposites[direction];
    var totalPoints = self.sailPoints.up + self.sailPoints.down + self.sailPoints.left + self.sailPoints.right;
    
    // If pressing a direction that has points in its opposite, remove a point from opposite
    if(self.sailPoints[opposite] > 0){
      self.sailPoints[opposite]--;
      console.log('🚢 Removed point from ' + opposite + ', now at: ' + self.sailPoints[opposite]);
    }
    // Otherwise, add a point to this direction (if we have points available)
    else if(totalPoints < 2){
      self.sailPoints[direction]++;
      console.log('🚢 Added point to ' + direction + ', now at: ' + self.sailPoints[direction]);
    }
    
    // Log current sail state
    var activePoints = [];
    if(self.sailPoints.up > 0) activePoints.push('N:' + self.sailPoints.up);
    if(self.sailPoints.down > 0) activePoints.push('S:' + self.sailPoints.down);
    if(self.sailPoints.left > 0) activePoints.push('W:' + self.sailPoints.left);
    if(self.sailPoints.right > 0) activePoints.push('E:' + self.sailPoints.right);
    console.log('⛵ Sail points: [' + (activePoints.length > 0 ? activePoints.join(', ') : 'STOPPED') + ']');
  };
  
  // Smooth ship physics update
  self.updateShipPhysics = function(){
    // Debug: Log ship position and tile on first physics tick
    if(self.sailingGracePeriod === 0 && (self.velocity.x === 0 && self.velocity.y === 0)){
      var currentLoc = getLoc(self.x, self.y);
      var currentTile = getTile(0, currentLoc[0], currentLoc[1]);
      console.log('🚢 Ship physics starting - position: [' + self.x.toFixed(1) + ', ' + self.y.toFixed(1) + '], tile: ' + currentTile + ' at [' + currentLoc[0] + ',' + currentLoc[1] + ']');
    }
    
    // Calculate target direction based on sail points
    var targetVelX = 0;
    var targetVelY = 0;
    var speedPerPoint = 0.75;
    
    if(self.sailPoints.right > 0) targetVelX += self.sailPoints.right * speedPerPoint;
    if(self.sailPoints.left > 0) targetVelX -= self.sailPoints.left * speedPerPoint;
    if(self.sailPoints.down > 0) targetVelY += self.sailPoints.down * speedPerPoint;
    if(self.sailPoints.up > 0) targetVelY -= self.sailPoints.up * speedPerPoint;
    
    // Calculate target speed and heading
    var targetSpeed = Math.sqrt(targetVelX * targetVelX + targetVelY * targetVelY);
    
    if(targetSpeed > 0){
      // Calculate target heading (in radians)
      self.targetHeading = Math.atan2(targetVelY, targetVelX);
      
      // Gradually turn towards target heading
      var headingDiff = self.targetHeading - self.currentHeading;
      
      // Normalize angle difference to [-PI, PI]
      while(headingDiff > Math.PI) headingDiff -= 2 * Math.PI;
      while(headingDiff < -Math.PI) headingDiff += 2 * Math.PI;
      
      // Apply turn rate
      if(Math.abs(headingDiff) > self.turnRate){
        self.currentHeading += Math.sign(headingDiff) * self.turnRate;
      } else {
        self.currentHeading = self.targetHeading;
      }
      
      // Normalize current heading to [0, 2*PI]
      while(self.currentHeading < 0) self.currentHeading += 2 * Math.PI;
      while(self.currentHeading >= 2 * Math.PI) self.currentHeading -= 2 * Math.PI;
      
      // Calculate velocity in the direction of current heading
      var currentSpeed = Math.sqrt(self.velocity.x * self.velocity.x + self.velocity.y * self.velocity.y);
      var targetVelocityMagnitude = Math.min(targetSpeed, self.maxVelocity);
      
      // Accelerate towards target speed
      var speedDiff = targetVelocityMagnitude - currentSpeed;
      currentSpeed += speedDiff * self.acceleration;
      
      // Apply velocity in current heading direction
      self.velocity.x = Math.cos(self.currentHeading) * currentSpeed;
      self.velocity.y = Math.sin(self.currentHeading) * currentSpeed;
    } else {
      // Decelerating - gradually slow down
      self.velocity.x *= (1 - self.deceleration);
      self.velocity.y *= (1 - self.deceleration);
      
      // Stop completely if velocity is very small
      if(Math.abs(self.velocity.x) < 0.01) self.velocity.x = 0;
      if(Math.abs(self.velocity.y) < 0.01) self.velocity.y = 0;
    }
    
    // Apply velocity to position
    var nextX = self.x + self.velocity.x;
    var nextY = self.y + self.velocity.y;
    
    var nextLoc = getLoc(nextX, nextY);
    var nextTile = getTile(0, nextLoc[0], nextLoc[1]);
    
    // Only check for land/dock collisions if ship is actually moving
    // This prevents immediate disembark when physics first starts from dock
    var isMoving = Math.abs(self.velocity.x) > 0.1 || Math.abs(self.velocity.y) > 0.1;
    
    if(isMoving){
      // Check if touching walkable dock tile (14) - this is the entrance
      if(nextTile == 14){ // Walkable dock entrance tile
      console.log('🚢 Ship approaching dock entrance (tile 14)');
      // Check if this is the ship's home dock
      if(self.dock && Building.list[self.dock]){
        var dockBuilding = Building.list[self.dock];
        for(var i in dockBuilding.plot){
          var dockLoc = dockBuilding.plot[i];
          if(dockLoc[0] == nextLoc[0] && dockLoc[1] == nextLoc[1]){
            // Touching home dock entrance - store boat and disembark
            console.log('⚓ Ship docking at home dock - storing ship');
            self.storeAtDock();
            return;
          }
        }
      }
      // Not home dock entrance - treat as land, disembark
      console.log('🏖️ Ship touching foreign dock - disembarking onto shore');
      var navigatorId = self.passengers.find(p => p.isNavigator)?.playerId;
      if(navigatorId){
        self.disembarkPassenger(navigatorId, nextLoc);
      }
        return;
      }
      
      // Check if touching any non-water tile (land = auto-disembark)
      if(nextTile != 0){ // Not water (any land tile)
        // Check if this is a dock building before disembarking
        var buildingId = getBuilding(nextX, nextY);
        if(buildingId){
          var building = Building.list[buildingId];
          if(building && building.type === 'dock'){
            console.log('🚢 Ship touching dock (tile: ' + nextTile + ') - docking at port');
            // Create dock association before storing
            if(building.createDockAssociation && self.lastDock){
              building.createDockAssociation(self.lastDock);
            }
            // Update lastDock for future associations
            self.lastDock = buildingId;
            
            // If this is home dock, store the ship
            if(buildingId === self.dock){
              console.log('⚓ Ship docking at home dock - storing ship');
              self.storeAtDock();
            } else {
              // Foreign dock - just disembark
              console.log('🏖️ Ship at foreign dock - disembarking');
              if(self.isPlayerControlled && self.passengers.length > 0 && self.mode === 'sailing' && self.sailingGracePeriod === 0){
                var navigatorId = self.passengers.find(p => p.isNavigator)?.playerId;
                if(navigatorId){
                  self.disembarkPassenger(navigatorId, nextLoc);
                }
              }
            }
            return;
          }
        }
        
        // Not a dock - regular land, disembark
        if(self.isPlayerControlled && self.passengers.length > 0 && self.mode === 'sailing' && self.sailingGracePeriod === 0){
          console.log('🏖️ Ship touching land (tile: ' + nextTile + ') - disembarking onto shore');
          // Disembark navigator onto the land, boat stays at current water position
          var navigatorId = self.passengers.find(p => p.isNavigator)?.playerId;
          if(navigatorId){
            self.disembarkPassenger(navigatorId, nextLoc);
          }
        }
        return; // Don't move forward
      }
    }
    
    // Move ship to new position (even if not moving fast yet)
    if(nextTile == 0){ // Water
      self.x = nextX;
      self.y = nextY;
      
      // Update facing direction based on velocity
      if(Math.abs(self.velocity.x) > Math.abs(self.velocity.y)){
        self.facing = self.velocity.x > 0 ? 'right' : 'left';
      } else if(Math.abs(self.velocity.y) > 0){
        self.facing = self.velocity.y > 0 ? 'down' : 'up';
      }
      
      // Update spdX and spdY for network sync
      self.spdX = self.velocity.x;
      self.spdY = self.velocity.y;
    }
  };
  
  // Board a passenger onto the ship
  self.boardPassenger = function(playerId){
    var player = Player.list[playerId];
    if(!player){
      console.error('Player not found:', playerId);
      return false;
    }
    
    // Check if already aboard
    var alreadyAboard = self.passengers.some(function(p){ return p.playerId === playerId; });
    if(alreadyAboard){
      console.log('Player already aboard ship');
      return false;
    }
    
    // First passenger becomes navigator (controller)
    var isNavigator = self.passengers.length === 0;
    
    // Store player's original state
    var storedPlayerData = {
      id: playerId,
      originalX: player.x,
      originalY: player.y,
      originalZ: player.z,
      originalClass: player.class,
      originalName: player.name
    };
    
    // Add to passengers list
    self.passengers.push({
      playerId: playerId,
      isNavigator: isNavigator,
      storedData: storedPlayerData
    });
    
    // If this is the navigator, set up ship control
    if(isNavigator){
      self.controller = playerId;
      self.isPlayerControlled = true;
      self.storedPlayer = storedPlayerData; // For backwards compatibility
      
      // Transfer control to ship
      var socket = SOCKET_LIST[playerId];
      if(socket){
        // CRITICAL: Ensure client has ship entity before boarding
        // Send ship's init pack if they don't have it yet
        socket.write(JSON.stringify({
          msg: 'init',
          selfId: undefined, // Don't change selfId yet
          pack: {
            player: [self.getInitPack()],
            arrow: [],
            item: [],
            light: [],
            building: []
          }
        }));
        
        // Now send board message
        socket.write(JSON.stringify({
          msg: 'boardShip',
          shipId: self.id,
          isNavigator: true
        }));
        socket.write(JSON.stringify({
          msg:'addToChat',
          message:'<i>⚓ You are now navigating the ship. Use WASD to control sails.</i>'
        }));
      }
      
      console.log('⚓ ' + player.name + ' boarded as NAVIGATOR');
    } else {
      // Just a passenger
      var socket = SOCKET_LIST[playerId];
      if(socket){
        socket.write(JSON.stringify({
          msg:'addToChat',
          message:'<i>🚢 You boarded the ship as a passenger.</i>'
        }));
      }
      
      console.log('🚢 ' + player.name + ' boarded as PASSENGER');
    }
    
    // CRITICAL: Mark player as boarded BEFORE syncing position
    // This prevents terrain checks from setting z=-3 when player is moved to water
    player.isBoarded = true;
    player.boardedShip = self.id;
    
    // Now sync player position to ship
    // Player's position becomes the ship's position
    player.x = self.x;
    player.y = self.y;
    player.z = self.z;
    
    console.log('✅ Player boarded - isBoarded: true, boardedShip: ' + self.id + ', player position synced to ship');
    
    // Keep ship anchored until player moves
    if(self.mode === 'docked'){
      self.mode = 'anchored';
      self.name = 'Fishing Ship ⚓'; // Show anchor emoji
    }
    
    return true;
  };
  
  // Disembark a specific passenger
  self.disembarkPassenger = function(playerId, landLoc){
    var passengerIndex = self.passengers.findIndex(function(p){ return p.playerId === playerId; });
    if(passengerIndex === -1){
      console.error('Passenger not found on ship:', playerId);
      return false;
    }
    
    var passenger = self.passengers[passengerIndex];
    var player = Player.list[playerId];
    if(!player){
      console.error('Player not found:', playerId);
      return false;
    }
    
    // Place player on land - at least 1 tile away from ship to prevent auto re-boarding
    // Find a land tile that's at least 1 tile from the ship
    var disembarkLoc = landLoc;
    var shipLoc = getLoc(self.x, self.y);
    var dist = Math.sqrt(Math.pow(landLoc[0] - shipLoc[0], 2) + Math.pow(landLoc[1] - shipLoc[1], 2));
    
    // If too close, try to find a further land tile
    if(dist < 1){
      var searchRadius = 2;
      for(var dx = -searchRadius; dx <= searchRadius; dx++){
        for(var dy = -searchRadius; dy <= searchRadius; dy++){
          var checkLoc = [landLoc[0] + dx, landLoc[1] + dy];
          if(checkLoc[0] >= 0 && checkLoc[0] < global.mapSize && checkLoc[1] >= 0 && checkLoc[1] < global.mapSize){
            var checkTile = getTile(0, checkLoc[0], checkLoc[1]);
            if(checkTile !== 0){ // Not water
              var checkDist = Math.sqrt(Math.pow(checkLoc[0] - shipLoc[0], 2) + Math.pow(checkLoc[1] - shipLoc[1], 2));
              if(checkDist >= 1){
                disembarkLoc = checkLoc;
                break;
              }
            }
          }
        }
        if(disembarkLoc !== landLoc) break;
      }
    }
    
    var landCoords = getCenter(disembarkLoc[0], disembarkLoc[1]);
    player.x = landCoords[0];
    player.y = landCoords[1];
    player.z = 0;
    player.isBoarded = false;
    player.boardedShip = null;
    player.boardCooldown = 180; // 3 second cooldown
    
    // If this was the navigator, transfer control
    if(passenger.isNavigator){
      self.passengers.splice(passengerIndex, 1);
      
      // Transfer control back to player
      var socket = SOCKET_LIST[playerId];
      if(socket){
        socket.write(JSON.stringify({
          msg: 'disembarkShip',
          newSelfId: playerId
        }));
        socket.write(JSON.stringify({
          msg:'addToChat',
          message:'<i>🏖️ Disembarked onto shore. Type /board to board your ship again.</i>'
        }));
      }
      
      console.log('🏖️ Player disembarked - isBoarded should be false, position: [' + player.x.toFixed(0) + ', ' + player.y.toFixed(0) + ']');
      
      // Check if there are more passengers to become navigator
      if(self.passengers.length > 0){
        // Next passenger becomes navigator
        self.passengers[0].isNavigator = true;
        self.controller = self.passengers[0].playerId;
        self.storedPlayer = self.passengers[0].storedData;
        
        var newNavigator = Player.list[self.passengers[0].playerId];
        var navSocket = SOCKET_LIST[self.passengers[0].playerId];
        if(navSocket){
          navSocket.write(JSON.stringify({
            msg: 'boardShip',
            shipId: self.id,
            isNavigator: true
          }));
          navSocket.write(JSON.stringify({
            msg:'addToChat',
            message:'<i>⚓ You are now navigating the ship.</i>'
          }));
        }
        console.log('⚓ ' + newNavigator.name + ' is now the navigator');
      } else {
        // No more passengers - ship becomes AI controlled or anchored
        self.controller = null;
        self.isPlayerControlled = false;
        self.storedPlayer = null;
        self.sailPoints = {up: 0, down: 0, left: 0, right: 0};
        self.mode = 'anchored';
        console.log('⚓ Ship is now empty and anchored');
      }
    } else {
      // Just a passenger disembarking
      self.passengers.splice(passengerIndex, 1);
      
      var socket = SOCKET_LIST[playerId];
      if(socket){
        socket.write(JSON.stringify({
          msg:'addToChat',
          message:'<i>🏖️ Disembarked onto shore.</i>'
        }));
      }
    }
    
    console.log('🏖️ ' + player.name + ' disembarked from ship');
    return true;
  };
  
  // Disembark player onto land (boat stays visible on water)
  self.disembarkOntoLand = function(landLoc){
    // Use new passenger system if navigator is aboard
    if(self.controller){
      return self.disembarkPassenger(self.controller, landLoc);
    }
    
    // Legacy system for backwards compatibility
    if(!self.storedPlayer){
      console.error('No player stored in ship to disembark');
      // Stop the ship from moving
      self.sailPoints = {up: 0, down: 0, left: 0, right: 0};
      self.mode = 'anchored';
      self.isPlayerControlled = false;
      return;
    }
    
    var playerId = self.storedPlayer.id;
    var player = Player.list[playerId];
    
    if(!player){
      console.error('Stored player not found:', playerId);
      // Clear stored player and stop ship
      self.storedPlayer = null;
      self.sailPoints = {up: 0, down: 0, left: 0, right: 0};
      self.mode = 'anchored';
      self.isPlayerControlled = false;
      return;
    }
    
    // Place player on the land tile
    var landCoords = getCenter(landLoc[0], landLoc[1]);
    player.x = landCoords[0];
    player.y = landCoords[1];
    player.z = 0;
    player.isBoarded = false;
    player.boardedShip = null;
    player.boardCooldown = 180; // 3 second cooldown before re-boarding
    
    // Transfer control back to player
    var socket = SOCKET_LIST[playerId];
    if(socket){
      socket.write(JSON.stringify({
        msg: 'disembarkShip',
        newSelfId: playerId
      }));
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>🏖️ Disembarked onto shore. Type <b>/board</b> to board your ship again.</i>'}));
    }
    
    // Ship stays visible at current position, stop all movement
    self.isPlayerControlled = false;
    self.mode = 'anchored'; // New mode: anchored at sea
    self.sailPoints = {up: 0, down: 0, left: 0, right: 0}; // Clear all sail points
    self.storedPlayer = null;
    self.name = 'Fishing Ship ⚓'; // Update name to show anchored status
    
    console.log(player.name + ' disembarked onto land at [' + landLoc + '], ship anchored at sea');
  };
  
  // Store boat at home dock and disembark
  self.storeAtDock = function(){
    if(!self.storedPlayer){
      console.error('No player stored in ship to disembark');
      return;
    }
    
    var playerId = self.storedPlayer.id;
    var player = Player.list[playerId];
    
    if(!player){
      console.error('Stored player not found:', playerId);
      return;
    }
    
    var dockBuilding = Building.list[self.dock];
    if(!dockBuilding){
      console.error('Dock building not found');
      return;
    }
    
    // Restore player at dock entrance
    var entranceTile = null;
    for(var i in dockBuilding.plot){
      var tile = getTile(0, dockBuilding.plot[i][0], dockBuilding.plot[i][1]);
      if(tile == 14){ // Walkable entrance
        entranceTile = dockBuilding.plot[i];
        break;
      }
    }
    
    if(!entranceTile){
      // Fallback to first plot tile
      entranceTile = dockBuilding.plot[0];
    }
    
    var dockCoords = getCenter(entranceTile[0], entranceTile[1]);
    player.x = dockCoords[0];
    player.y = dockCoords[1];
    player.z = 0;
    player.isBoarded = false;
    player.boardedShip = null;
    player.boardCooldown = 180; // 3 second cooldown before re-boarding
    
    // Transfer control back to player
    var socket = SOCKET_LIST[playerId];
    if(socket){
      socket.write(JSON.stringify({
        msg: 'disembarkShip',
        newSelfId: playerId
      }));
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>⚓ Ship docked. Boat will be stored here for 1 hour.</i>'}));
    }
    
    // Mark ship as docked and set timer
    self.isPlayerControlled = false;
    self.mode = 'docked';
    self.dockedTimer = 3600; // 1 in-game hour (60 minutes * 60 frames/sec)
    self.sailPoints = {up: 0, down: 0, left: 0, right: 0}; // Clear sail points
    self.storedPlayer = null;
    self.name = 'Fishing Ship ⚓'; // Update name to show docked status
    
    console.log(player.name + ' docked ship at home dock ' + self.dock);
  };
  
  self.depositFishAndDisembark = function(){
    if(!self.dock || !Building.list[self.dock]){
      console.error('Fishing ship has no valid dock to disembark at');
      return;
    }
    
    var dockBuilding = Building.list[self.dock];
    var totalFish = self.inventory.fish;
    
    if(totalFish > 0){
      // Split fish: 85% to building, 15% divided among serfs
      var buildingShare = Math.floor(totalFish * 0.85);
      var totalWage = totalFish - buildingShare;
      var wagePerSerf = self.embarkedSerfs.length > 0 ? Math.floor(totalWage / self.embarkedSerfs.length) : 0;
      
      // Deposit to building's house
      if(dockBuilding.house && House.list[dockBuilding.house]){
        if(!House.list[dockBuilding.house].stores.fish) House.list[dockBuilding.house].stores.fish = 0;
        House.list[dockBuilding.house].stores.fish += buildingShare;
        console.log('✅ Fishing ship deposited ' + buildingShare + ' fish to ' + House.list[dockBuilding.house].name);
      } else if(Player.list[dockBuilding.owner]){
        if(!Player.list[dockBuilding.owner].stores.fish) Player.list[dockBuilding.owner].stores.fish = 0;
        Player.list[dockBuilding.owner].stores.fish += buildingShare;
      }
      
      // Track daily deposits
      if(!dockBuilding.dailyStores) dockBuilding.dailyStores = {fish: 0};
      dockBuilding.dailyStores.fish += buildingShare;
      
      // Give wage to each serf
      for(var i = 0; i < self.embarkedSerfs.length; i++){
        var serfId = self.embarkedSerfs[i];
        if(Player.list[serfId]){
          if(!Player.list[serfId].stores.fish) Player.list[serfId].stores.fish = 0;
          Player.list[serfId].stores.fish += wagePerSerf;
        }
      }
    }
    
    // Disembark all serfs
    var dockLoc = dockBuilding.plot[0]; // First dock tile
    var dockCoords = getCenter(dockLoc[0], dockLoc[1]);
    
    for(var i = 0; i < self.embarkedSerfs.length; i++){
      var serfId = self.embarkedSerfs[i];
      if(Player.list[serfId]){
        var serf = Player.list[serfId];
        // Respawn serf at dock
        serf.x = dockCoords[0];
        serf.y = dockCoords[1];
        serf.z = 0;
        serf.onShip = false;
        console.log(serf.name + ' disembarked from fishing ship');
      }
    }
    
    // Clear ship
    self.embarkedSerfs = [];
    self.inventory.fish = 0;
    
    // Despawn ship
    self.toRemove = true;
    console.log('Fishing ship despawned after disembarkation');
  }
  
  // Override die function to handle ship destruction
  self.die = function(report){
    var deathLocation = getLoc(self.x, self.y);
    var deathCoords = getCenter(deathLocation[0], deathLocation[1]);
    
    console.log('🚢💥 Fishing ship destroyed at [' + deathLocation + ']');
    
    // Eject all stored players into water (they immediately sink)
    if(self.storedPlayer){
      var playerId = self.storedPlayer.id;
      var player = Player.list[playerId];
      
      if(player){
        // Place player in water where ship died
        player.x = deathCoords[0];
        player.y = deathCoords[1];
        player.z = -3; // Underwater - they sink immediately
        player.isBoarded = false;
        player.boardedShip = null;
        player.breath = player.breathMax * 0.5; // Start with half breath
        
        // Transfer control back to player
        var socket = SOCKET_LIST[playerId];
        if(socket){
          socket.write(JSON.stringify({
            msg: 'disembarkShip',
            newSelfId: playerId
          }));
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>🚢💥 Ship destroyed! You are sinking...</i>'}));
        }
        
        console.log(player.name + ' ejected into water as ship sank');
      }
    }
    
    // Eject all inventory items scattered around wreckage
    if(self.inventory){
      for(var item in self.inventory){
        var qty = self.inventory[item];
        if(qty > 0){
          // Random offset (within 2 tiles)
          var offsetX = (Math.random() - 0.5) * tileSize * 2;
          var offsetY = (Math.random() - 0.5) * tileSize * 2;
          
          if(global.itemFactory){
            global.itemFactory.createItem(item, {
              id: Math.random(),
              x: deathCoords[0] + offsetX,
              y: deathCoords[1] + offsetY,
              z: 0, // Items float on water surface initially
              qty: qty
            });
          }
        }
      }
    }
    
    // Create wreckage item (floats for 10 seconds, then sinks)
    ShipWreckage({
      id: Math.random(),
      x: deathCoords[0],
      y: deathCoords[1],
      z: 0,
      sinkTimer: 600 // 10 seconds at 60fps
    });
    console.log('🪦 Ship wreckage created, will sink in 10 seconds');
    
    // Remove ship
    self.toRemove = true;
  };
  
  // Override getUpdatePack to include sail points and mode
  var super_getUpdatePack = self.getUpdatePack;
  self.getUpdatePack = function(){
    var pack = super_getUpdatePack();
    // Add ship-specific data
    pack.sailPoints = self.sailPoints;
    pack.shipMode = self.mode; // 'sailing', 'anchored', 'docked', 'fishing', 'returning'
    pack.shipType = self.shipType;
    return pack;
  };
  
  Player.list[self.id] = self;
  initPack.player.push(self.getInitPack());
  return self;
}

CargoShip = function(param){
  var self = Character(param);
  self.class = 'CargoShip';
  self.type = 'ship';
  self.name = 'Cargo Ship';
  self.shipType = 'cargoship';
  self.spriteSize = tileSize * 2.5; // Larger than fishing ship
  self.baseSpd = 1.2;
  self.maxSpd = 1.2;
  self.currentSpeed = 1.2;
  
  // Cargo ship properties
  self.homeDock = param.homeDock; // Dock that created this ship
  self.lastDock = param.homeDock; // Last dock visited (for network associations)
  self.currentDock = param.currentDock || param.homeDock; // Current dock location
  self.targetDock = null; // Next destination dock
  self.visitedDocks = []; // Docks visited in current cycle
  self.passengers = []; // Passive passengers only (max 4)
  self.maxPassengers = 4;
  self.controller = null; // Always null (AI controlled)
  self.isPlayerControlled = false; // Always false
  self.waitTimer = 0; // Countdown timer at dock (3600 = 1 minute)
  self.mode = param.mode || 'waiting'; // 'waiting' | 'sailing' | 'docked'
  
  // Ship physics for smooth movement
  self.velocity = {x: 0, y: 0};
  self.targetHeading = 0;
  self.currentHeading = 0;
  self.acceleration = 0.04;
  self.deceleration = 0.03;
  self.turnRate = 0.06;
  self.maxVelocity = 1.2;
  
  // Select next destination from dock network
  self.selectNextDestination = function(){
    if(!self.homeDock || !Building.list[self.homeDock]){
      console.error('Cargo ship home dock not found');
      return false;
    }
    
    var homeDock = Building.list[self.homeDock];
    if(!homeDock.network || homeDock.network.length === 0){
      console.error('Home dock has no network');
      return false;
    }
    
    // Filter out visited docks AND current dock
    var unvisited = homeDock.network.filter(function(dockId){
      return self.visitedDocks.indexOf(dockId) === -1 && dockId !== self.currentDock;
    });
    
    // If all docks visited, return to home (only if not already at home)
    if(unvisited.length === 0){
      if(self.currentDock === self.homeDock){
        console.error('Cargo ship at home with no unvisited docks - this should not happen');
        return false;
      }
      self.targetDock = self.homeDock;
      return true;
    }
    
    // Pick random unvisited dock
    var randomIndex = Math.floor(Math.random() * unvisited.length);
    self.targetDock = unvisited[randomIndex];
    return true;
  };
  
  // Announce destination to nearby players
  self.announceDestination = function(){
    if(!self.targetDock || !Building.list[self.targetDock]){
      return;
    }
    
    var targetDockBuilding = Building.list[self.targetDock];
    var targetDockName = targetDockBuilding.zoneName || targetDockBuilding.name || 'Unknown Dock';
    
    var isReturning = self.targetDock === self.homeDock;
    var announcement = isReturning ? 
      '<b>🚢 Cargo Ship</b>: <i>Now returning to ' + targetDockName + '</i>' :
      '<b>🚢 Cargo Ship</b>: <i>Next destination: ' + targetDockName + '</i>';
    
    // Broadcast to nearby area (10 tiles)
    for(var playerId in Player.list){
      var p = Player.list[playerId];
      if(p.type === 'player' && p.z === self.z){
        var dist = Math.sqrt(Math.pow(p.x - self.x, 2) + Math.pow(p.y - self.y, 2));
        if(dist < tileSize * 10){
          var socket = SOCKET_LIST[playerId];
          if(socket){
            socket.write(JSON.stringify({
              msg: 'addToChat',
              message: announcement
            }));
          }
        }
      }
    }
    
    console.log('🚢 Cargo ship announced destination: ' + targetDockName);
  };
  
  // Start waiting period at dock
  self.startWaiting = function(){
    self.mode = 'waiting';
    self.waitTimer = 3600; // 1 minute at 60fps
    self.name = 'Cargo Ship ⚓';
    console.log('🚢 Cargo ship waiting for 1 minute at dock');
  };
  
  // Navigate to target dock (using A* pathfinding on water)
  self.navigateToTarget = function(){
    if(!self.targetDock || !Building.list[self.targetDock]){
      console.error('Target dock not found');
      return;
    }
    
    var targetDock = Building.list[self.targetDock];
    var currentLoc = getLoc(self.x, self.y);
    
    // Generate path if we don't have one
    if(!self.path || self.path.length === 0){
      // Find closest water tile adjacent to target dock
      var closestWaterTile = null;
      var closestDist = Infinity;
      
      if(targetDock.plot && targetDock.plot.length > 0){
        for(var i in targetDock.plot){
          var dockTile = targetDock.plot[i];
          var adjacent = [
            [dockTile[0], dockTile[1] + 1],
            [dockTile[0], dockTile[1] - 1],
            [dockTile[0] - 1, dockTile[1]],
            [dockTile[0] + 1, dockTile[1]]
          ];
          
          for(var j in adjacent){
            var at = adjacent[j];
            if(at[0] >= 0 && at[0] < mapSize && at[1] >= 0 && at[1] < mapSize){
              if(getTile(0, at[0], at[1]) == 0){ // Water
                var dist = Math.sqrt(Math.pow(at[0] - currentLoc[0], 2) + Math.pow(at[1] - currentLoc[1], 2));
                if(dist < closestDist){
                  closestDist = dist;
                  closestWaterTile = at;
                }
              }
            }
          }
        }
      }
      
      if(closestWaterTile){
        // Use layer 0 (overworld) with waterOnly option for ship navigation
        var path = global.tilemapSystem.findPath(currentLoc, closestWaterTile, 0, {waterOnly: true});
        if(path && path.length > 0){
          self.path = path;
          console.log('🚢 Cargo ship generated path to ' + (targetDock.zoneName || 'target dock') + ' (' + path.length + ' waypoints)');
        } else {
          console.error('🚢 Failed to generate path to target dock');
          self.path = null;
        }
      }
    }
    
    // Follow the pathfinding waypoints
    if(self.path && self.path.length > 0){
      var nextWaypoint = self.path[0];
      var waypointCoords = getCenter(nextWaypoint[0], nextWaypoint[1]);
      var diffX = waypointCoords[0] - self.x;
      var diffY = waypointCoords[1] - self.y;
      var dist = Math.sqrt(diffX * diffX + diffY * diffY);
      
      if(dist > self.currentSpeed){
        // Move toward waypoint
        var moveX = (diffX / dist) * self.currentSpeed;
        var moveY = (diffY / dist) * self.currentSpeed;
        
        self.x += moveX;
        self.y += moveY;
        
        // Update facing
        if(Math.abs(diffX) > Math.abs(diffY)){
          self.facing = diffX > 0 ? 'right' : 'left';
        } else {
          self.facing = diffY > 0 ? 'down' : 'up';
        }
      } else {
        // Reached waypoint, move to next
        self.path.shift();
      }
      
      // Check if reached destination
      if(self.path.length === 0){
        // Arrived at dock
        self.mode = 'docked';
        self.currentDock = self.targetDock;
        console.log('🚢 Cargo ship arrived at destination dock');
        
        // Create dock network association (cargo ships also link docks)
        var arrivedDock = Building.list[self.currentDock];
        if(arrivedDock && arrivedDock.createDockAssociation){
          arrivedDock.createDockAssociation(self.lastDock);
        }
        
        // Update lastDock for next association
        self.lastDock = self.currentDock;
        
        // Add current dock to visited list (unless it's home dock)
        if(self.currentDock !== self.homeDock && self.visitedDocks.indexOf(self.currentDock) === -1){
          self.visitedDocks.push(self.currentDock);
        }
        
        // Disembark all passengers
        var passengersToDisembark = self.passengers.slice(); // Copy array
        for(var i = 0; i < passengersToDisembark.length; i++){
          self.disembarkPassenger(passengersToDisembark[i].playerId, getLoc(targetDock.x, targetDock.y));
        }
        
        // Select next destination
        if(self.currentDock === self.homeDock){
          // Back home - clear visited list and restart cycle
          self.visitedDocks = [];
          console.log('🚢 Cargo ship returned home, restarting cycle');
        }
        
        self.selectNextDestination();
        self.announceDestination();
        self.startWaiting();
      }
    }
  };
  
  self.update = function(){
    // Handle combat state (if ship gets aggroed)
    if(self.action === 'combat'){
      if(global.simpleCombat){
        global.simpleCombat.update(self);
      } else {
        // Fallback: clear invalid combat
        if(!self.combat || !self.combat.target || !Player.list[self.combat.target]){
          self.action = null;
          if(self.combat) self.combat.target = null;
        }
      }
    }
    
    // Decrement wait timer
    if(self.waitTimer > 0){
      self.waitTimer--;
      if(self.waitTimer === 0 && self.mode === 'waiting'){
        // Depart for destination
        self.mode = 'sailing';
        self.name = 'Cargo Ship';
        console.log('🚢 Cargo ship departing for destination');
        
        // Announce departure to passengers
        for(var i = 0; i < self.passengers.length; i++){
          var socket = SOCKET_LIST[self.passengers[i].playerId];
          if(socket){
            socket.write(JSON.stringify({
              msg: 'addToChat',
              message: '<i>⛵ The cargo ship is departing...</i>'
            }));
          }
        }
      }
    }
    
    // Handle sailing mode
    if(self.mode === 'sailing'){
      self.navigateToTarget();
    }
    
    // Sync all passengers' positions to ship position
    for(var i = 0; i < self.passengers.length; i++){
      var passenger = self.passengers[i];
      if(Player.list[passenger.playerId]){
        var player = Player.list[passenger.playerId];
        player.x = self.x;
        player.y = self.y;
        player.z = 0; // Always overworld
      }
    }
  };
  
  // Board a passenger onto the cargo ship (always passive)
  self.boardPassenger = function(playerId){
    var player = Player.list[playerId];
    if(!player){
      console.error('Player not found:', playerId);
      return false;
    }
    
    // Check capacity
    if(self.passengers.length >= self.maxPassengers){
      var socket = SOCKET_LIST[playerId];
      if(socket){
        socket.write(JSON.stringify({
          msg: 'addToChat',
          message: '<i>Cargo ship is full (4/4 passengers)</i>'
        }));
      }
      return false;
    }
    
    // Check if already aboard
    var alreadyAboard = self.passengers.some(function(p){ return p.playerId === playerId; });
    if(alreadyAboard){
      console.log('Player already aboard cargo ship');
      return false;
    }
    
    // Store player's original state
    var storedPlayerData = {
      id: playerId,
      originalX: player.x,
      originalY: player.y,
      originalZ: player.z,
      originalClass: player.class,
      originalName: player.name
    };
    
    // Add to passengers list (all passengers are passive, no navigator)
    self.passengers.push({
      playerId: playerId,
      isNavigator: false, // Cargo ships have no navigator
      storedData: storedPlayerData
    });
    
    // CRITICAL: Mark player as boarded AND sync all coordinates atomically
    // This prevents terrain checks from setting z=-3 when player is moved to water
    player.isBoarded = true;
    player.boardedShip = self.id;
    player.x = self.x;
    player.y = self.y;
    player.z = 0; // Always overworld, don't sync z from ship
    
    // EXTRA SAFETY: Force z=0 explicitly again after all position updates
    player.z = 0;
    
    console.log('✅ Passenger boarded cargo ship');
    console.log('  - Ship z: ' + self.z + ', Player z set to: ' + player.z);
    console.log('  - Ship position: [' + self.x.toFixed(0) + ', ' + self.y.toFixed(0) + ']');
    console.log('  - Player position: [' + player.x.toFixed(0) + ', ' + player.y.toFixed(0) + ']');
    console.log('  - Player isBoarded: ' + player.isBoarded);
    console.log('  - Player boardedShip: ' + player.boardedShip);
    console.log('  - Player type: ' + player.type);
    
    // Send boarding confirmation with boardShip message for client-side hide/music
    var socket = SOCKET_LIST[playerId];
    if(socket){
      // Send boardShip message to hide player and play music (as passenger, not navigator)
      socket.write(JSON.stringify({
        msg: 'boardShip',
        shipId: self.id,
        isNavigator: false
      }));
      
      var targetDockName = 'Unknown';
      if(self.targetDock && Building.list[self.targetDock]){
        var targetDock = Building.list[self.targetDock];
        targetDockName = targetDock.zoneName || targetDock.name || 'Unknown';
      }
      
      var timeRemaining = Math.ceil(self.waitTimer / 60);
      socket.write(JSON.stringify({
        msg: 'addToChat',
        message: '<i>🚢 Boarded cargo ship to <b>' + targetDockName + '</b>. Departing in ' + timeRemaining + ' seconds. (' + self.passengers.length + '/' + self.maxPassengers + ' passengers)</i>'
      }));
    }
    
    console.log('🚢 ' + player.name + ' boarded cargo ship as passenger (' + self.passengers.length + '/' + self.maxPassengers + ')');
    return true;
  };
  
  // Disembark a passenger
  self.disembarkPassenger = function(playerId, landLoc){
    var passengerIndex = self.passengers.findIndex(function(p){ return p.playerId === playerId; });
    if(passengerIndex === -1){
      console.error('Passenger not found on cargo ship:', playerId);
      return false;
    }
    
    var passenger = self.passengers[passengerIndex];
    var player = Player.list[playerId];
    if(!player){
      console.error('Player not found:', playerId);
      return false;
    }
    
    // Place player on dock
    var landCoords = getCenter(landLoc[0], landLoc[1]);
    player.x = landCoords[0];
    player.y = landCoords[1];
    player.z = 0;
    player.isBoarded = false;
    player.boardedShip = null;
    player.boardCooldown = 180;
    
    // Remove from passengers
    self.passengers.splice(passengerIndex, 1);
    
    // Notify player and restore visibility
    var socket = SOCKET_LIST[playerId];
    if(socket){
      // CRITICAL: Send disembarkShip message to clear isBoarded flag on client
      socket.write(JSON.stringify({
        msg: 'disembarkShip',
        newSelfId: playerId
      }));
      socket.write(JSON.stringify({
        msg: 'addToChat',
        message: '<i>🏖️ You have arrived at your destination.</i>'
      }));
    }
    
    console.log('🚢 ' + player.name + ' disembarked from cargo ship');
    return true;
  };
  
  // Override getInitPack
  var super_getInitPack = self.getInitPack;
  self.getInitPack = function(){
    var pack = super_getInitPack();
    pack.shipType = self.shipType;
    pack.shipMode = self.mode;
    pack.waitTimer = self.waitTimer;
    pack.passengerCount = self.passengers.length;
    pack.maxPassengers = self.maxPassengers;
    return pack;
  };
  
  // Override getUpdatePack
  var super_getUpdatePack = self.getUpdatePack;
  self.getUpdatePack = function(){
    var pack = super_getUpdatePack();
    pack.shipType = self.shipType;
    pack.shipMode = self.mode;
    pack.waitTimer = self.waitTimer;
    pack.passengerCount = self.passengers.length;
    pack.maxPassengers = self.maxPassengers;
    return pack;
  };
  
  Player.list[self.id] = self;
  initPack.player.push(self.getInitPack());
  return self;
}

// UNITS

Serf = function(param){
  var self = Character(param);
  self.name = param.name;
  self.sex = param.sex || 'm';
  self.class = self.sex === 'f' ? 'SerfF' : 'SerfM'; // Visual distinction
  self.spriteSize = tileSize*1.5;
  self.unarmed = true;
  self.tether = null; // {z,loc}
  self.tavern = param.tavern;
  self.hut = param.hut;
  self.work = param.work || {hq:null, spot:null, assignedSpot:null};
  self.dayTimer = false;
  self.workTimer = false;
  self.idleCounter = 0; // Track how long serf has been without action
  self.lastPos = {x: param.x, y: param.y}; // Track position for stuck detection
  self.stuckCounter = 0; // Count frames stuck in same position
  self.torchBearer = false; // Set during assignWorkHQ
  self.isNonCombatant = true; // Civilian - doesn't trigger outposts
  self.mineExitCooldown = 0; // Prevent immediate re-entry after exiting cave (~2 seconds)

  // Assign Serf to appropriate work building
  self.assignWorkHQ = function(){
    if(!self.house) return;
    
    var bestHQ = null;
    var bestDistance = Infinity;
    
    // Gender restrictions
    var validBuildingTypes = [];
    if(self.sex === 'f'){
      // Females: only mills and farms
      validBuildingTypes = ['mill', 'farm'];
    } else {
      // Males: all economic buildings
      validBuildingTypes = ['mill', 'farm', 'lumbermill', 'mine', 'dock'];
    }
    
    // Look for work buildings in the same house
    for(var i in Building.list){
      var b = Building.list[i];
      if(b.house == self.house && validBuildingTypes.indexOf(b.type) !== -1){
        var dist = getDistance({x:self.x,y:self.y},{x:b.x,y:b.y});
        if(dist < bestDistance){
          bestDistance = dist;
          bestHQ = i;
        }
      }
    }
    
    // If no work found in own house and female, try allied houses
    if(!bestHQ && self.sex === 'f' && self.house){
      var myHouse = House.list[self.house];
      if(myHouse && myHouse.allies){
        for(var i in Building.list){
          var b = Building.list[i];
          // Check if building is mill/farm and house is allied
          if((b.type === 'mill' || b.type === 'farm') && b.house && myHouse.allies.indexOf(b.house) !== -1){
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
      var buildingType = Building.list[bestHQ].type;
      console.log(self.name + ' (' + self.sex + ') assigned to work at ' + buildingType);
      
      // Only miners need torches for caves
      if(buildingType === 'mine' && Building.list[bestHQ].cave){
        self.torchBearer = true;
        self.inventory.torch = 3; // Torchbearers get 3 torches (free light, don't consume)
        console.log(self.name + ' is now a torch bearer (ore miner)');
      } else {
        self.torchBearer = false;
      }
    } else {
      console.log(self.name + ' (' + self.sex + ') no suitable work found for house ' + self.house);
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
          var buildingType = Building.list[self.work.hq].type;
          if(buildingType === 'mine' && Building.list[self.work.hq].cave){
            self.torchBearer = true;
            self.inventory.torch = 3; // Torchbearers get 3 torches (free light, don't consume)
            console.log(self.name + ' is now a torch bearer (ore miner)');
          } else {
            self.torchBearer = false;
        }
      }
      
      if(!self.tavern){
        self.findTavern();
      }
      
      if(!self.mode){
        self.mode = 'idle';
      }
      
      console.log(self.name + ' (' + self.sex + ') initialized - HQ: ' + (self.work.hq ? Building.list[self.work.hq].type : 'none') + 
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
    } else {
      console.log(self.name + ' no tavern found for house ' + self.house);
    }
  };

  // Unified work assignment (Daily Spot System)
  self.assignDailyWorkSpot = function(){
    if(!self.work.hq || !Building.list[self.work.hq]) return false;
    
    var hq = Building.list[self.work.hq];
    
    // If serf already has assigned spot for today, reuse it
    if(self.work.assignedSpot && hq.assignedSpots[self.id]){
      var spot = self.work.assignedSpot;
      
      // Verify spot still valid (has resources)
      var stillValid = false;
      if(hq.resources){
        for(var i in hq.resources){
          var r = hq.resources[i];
          if(r[0] === spot[0] && r[1] === spot[1]){
            stillValid = true;
            break;
          }
        }
      }
      
      if(stillValid){
        self.work.spot = spot;
        return true;
      } else {
        // Spot depleted, release it and get new one
        hq.releaseSpot(self.id);
        self.work.assignedSpot = null;
      }
    }
    
    // Update building resources before assigning
    if(hq.updateResources){
      hq.updateResources();
    }
    
    // Find available unassigned spots
    if(!hq.resources || hq.resources.length === 0) return false;
    
    var availableSpots = [];
    for(var i in hq.resources){
      var res = hq.resources[i];
      if(hq.isSpotAvailable(res)){
        availableSpots.push(res);
      }
    }
    
    if(availableSpots.length === 0) return false;
    
    // Assign random available spot
    var selected = availableSpots[Math.floor(Math.random() * availableSpots.length)];
    self.work.assignedSpot = selected;
    self.work.spot = selected;
    hq.assignSpot(self.id, selected);
    
    console.log(self.name + ' assigned daily spot at ' + hq.type + ': [' + selected[0] + ',' + selected[1] + ']');
    return true;
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
    
    // Decrement mine exit cooldown
    if(self.mineExitCooldown > 0){
      self.mineExitCooldown--;
    }
    
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
        // Cave entrance - enter only if no active path AND cooldown expired
        if((!self.path || self.path.length === 0) && self.mineExitCooldown === 0){
          self.caveEntrance = loc;
          self.z = -1;
          self.path = null;
          self.pathCount = 0;
        } else if(self.mineExitCooldown > 0){
          // Waiting for cooldown to expire
          if(!self._cooldownLogTimer) self._cooldownLogTimer = 0;
          self._cooldownLogTimer++;
          if(self._cooldownLogTimer >= 60){ // Log once per second
            console.log(self.name + ' waiting at cave entrance (cooldown: ' + self.mineExitCooldown + ' frames)');
            self._cooldownLogTimer = 0;
          }
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
          // Check CURRENT location, not stale loc from 2 seconds ago
          var currentLoc = getLoc(self.x, self.y);
          if(getTile(0,currentLoc[0],currentLoc[1]) >= 5 && getTile(0,currentLoc[0],currentLoc[1]) < 6){
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
      } else if(getTile(0,loc[0],loc[1]) == 0 && !self.isBoarded){
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
          
          // Set cooldown to prevent immediate re-entry (120 frames = 2 seconds at 60fps)
          self.mineExitCooldown = 120;
          
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
      if(self.hp !== null && self.hp <= 0){
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

    // Improved day/night transition logic with better staggering to avoid lag spikes
    if(tempus == 'VI.a' && self.mode != 'work' && !self.dayTimer){
      self.dayTimer = true;
      // PERFORMANCE FIX: Spread work assignments over 60 seconds instead of ~10 seconds
      // This prevents thundering herd when all serfs wake up at dawn
      var rand = Math.floor(Math.random() * 60000); // 0-60 seconds
      if(!global.SERF_DEBUG_MODE) {
        // Only log occasionally to reduce console spam
        if(Math.random() < 0.1) {
          console.log(self.name + ' will start work in ' + (rand/1000).toFixed(1) + ' seconds (tempus=' + tempus + ', currentMode=' + self.mode + ')');
        }
      } else {
        console.log(self.name + ' will start work in ' + (rand/1000).toFixed(1) + ' seconds (tempus=' + tempus + ', currentMode=' + self.mode + ')');
      }
      setTimeout(function(){
        if(self.mode != 'work'){ // Double-check mode hasn't changed
        self.mode = 'work';
        self.action = null;
          self.work.spot = null; // Clear previous work spot
        // Serf work mode switch logged via event system
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
        console.log(self.name + ' stuck with active path - clearing (z=' + self.z + ', pathCount=' + self.pathCount + '/' + self.path.length + ', action=' + self.action + ')');
        self.path = null;
        self.pathCount = 0;
        // DON'T clear action or work spot during work mode - let them retry with same assignment
        if(self.mode !== 'work'){
          self.action = null;
        self.work.spot = null;
        }
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
        // Serf hut checking logged via event system
        
        // If hut is not built yet, build it first
        if(!hut.built){
                  var select = [];
          for(var i in hut.plot){
            var p = hut.plot[i];
            var t = getTile(0, p[0], p[1]);
            // Plot tile checking logged via event system
            if(t == 11){ // Foundation tile that needs building
                      select.push(p);
                    }
                  }
          
          // Hut building status logged via event system
          
                  if(select.length > 0){
                    self.work.spot = select[Math.floor(Math.random() * select.length)];
                    self.action = 'build';
            // Serf assignment logged via event system
          } else {
            // Serf error logged via event system
            self.mode = 'idle';
            self.action = null;
          }
        } else {
          // Hut is built, transition to economic work
          // Hut completion logged via event system
          
          // Make sure serf has a work assignment
          if(!self.work.hq){
            // Serf work assignment logged via event system
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
            console.log('🔨 ' + self.name + ' assigned to task at ' + hq.type + ' spot [' + self.work.spot[0] + ',' + self.work.spot[1] + '] (z=' + self.z + ')');
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
              // Path to work spot
              if(!self.path){
                self.moveTo(0,spot[0],spot[1]);
              }
            }
          }
        } else {
          self.action = null;
        }
      } else if(self.action == 'task'){
        // CRITICAL: Don't re-read spot from work.spot - it causes reassignment loops
        // The spot is assigned in the !action block and should persist
          var hq = Building.list[self.work.hq];
        var spot = self.work.spot;
        
        // Allow task action without spot if serf has resources to deposit
        var hasResourcesToDeposit = self.inventory.wood >= 1 || self.inventory.stone >= 1 || 
                                    self.inventory.ironore >= 1 || self.inventory.silverore >= 1 || 
                                    self.inventory.goldore >= 1 || self.inventory.diamond >= 1 ||
                                    self.inventory.grain >= 1;
        
        if(!spot && !hasResourcesToDeposit){
          // No spot and no resources - go back to assignment phase
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
                
                // Deposit to building's house (not owner) - CRITICAL FIX
                if(b.house && House.list[b.house]){
                  var beforeGrain = House.list[b.house].stores.grain || 0;
                  House.list[b.house].stores.grain += buildingShare;
                  var afterGrain = House.list[b.house].stores.grain;
                  console.log('✅ ' + self.name + ' deposited ' + buildingShare + ' grain to ' + House.list[b.house].name + ' (house ID: ' + b.house + ', type: ' + typeof b.house + ') - Total: ' + beforeGrain + ' → ' + afterGrain);
                  
                  // Create deposit event
                  if(global.eventManager && buildingShare > 0){
                    global.eventManager.createEvent({
                      category: global.eventManager.categories.ECONOMIC,
                      subject: self.id,
                      subjectName: self.name || self.class,
                      action: 'deposited grain',
                      target: b.house,
                      targetName: House.list[b.house].name,
                      quantity: buildingShare,
                      communication: global.eventManager.commModes.NONE,
                      log: `[ECONOMIC] ${self.name} deposited ${buildingShare} grain to ${House.list[b.house].name}`,
                      position: {x: self.x, y: self.y, z: self.z}
                    });
                  }
                } else if(Player.list[b.owner] && Player.list[b.owner].house){
                  // Fallback: owner's house
                  var h = Player.list[b.owner].house;
                  House.list[h].stores.grain += buildingShare;
                  console.log('✅ ' + self.name + ' deposited ' + buildingShare + ' grain to owner\'s house');
                } else if(Player.list[b.owner]){
                  // Independent player
                  Player.list[b.owner].stores.grain += buildingShare;
                  console.log('✅ ' + self.name + ' deposited ' + buildingShare + ' grain to independent player');
                }
                // Track daily deposits (building share only)
                if(!b.dailyStores) b.dailyStores = {grain: 0};
                b.dailyStores.grain += buildingShare;
                
                // Convert deposited grain to flour (3:1 ratio - uses building's share only)
                self.inventory.flour += Math.floor(buildingShare / 3);
              } else {
                // Path to dropoff
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
                        self.inventory.grain += 10; // Harvest grain
                        console.log(self.name + ' harvested 10 Grain');
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
                // Path to work spot
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
                
                // Deposit to building's house (not owner) - CRITICAL FIX
                if(b.house && House.list[b.house]){
                  House.list[b.house].stores.wood += buildingShare;
                  console.log('✅ ' + self.name + ' deposited ' + buildingShare + ' wood to ' + House.list[b.house].name);
                  
                  // Create deposit event
                  if(global.eventManager && buildingShare > 0){
                    global.eventManager.createEvent({
                      category: global.eventManager.categories.ECONOMIC,
                      subject: self.id,
                      subjectName: self.name || self.class,
                      action: 'deposited wood',
                      target: b.house,
                      targetName: House.list[b.house].name,
                      quantity: buildingShare,
                      communication: global.eventManager.commModes.NONE,
                      log: `[ECONOMIC] ${self.name} deposited ${buildingShare} wood to ${House.list[b.house].name}`,
                      position: {x: self.x, y: self.y, z: self.z}
                    });
                  }
                } else if(Player.list[b.owner] && Player.list[b.owner].house){
                  var h = Player.list[b.owner].house;
                  House.list[h].stores.wood += buildingShare;
                  console.log('✅ ' + self.name + ' deposited ' + buildingShare + ' wood to owner\'s house');
                } else if(Player.list[b.owner]){
                  Player.list[b.owner].stores.wood += buildingShare;
                  console.log('✅ ' + self.name + ' deposited ' + buildingShare + ' wood to independent player');
                }
                // Track daily deposits (building share only)
                if(!b.dailyStores) b.dailyStores = {wood: 0};
                b.dailyStores.wood += buildingShare;
              } else {
                // Path to dropoff
                if(!self.path){
                  self.moveTo(0,dropoff[0],dropoff[1]);
                }
              }
            } else {
              // Need a spot to chop wood
              if(!spot){
                // Spot will be assigned in next update cycle by mode logic
                // Don't return - let serf idle naturally
              } else if(loc.toString() == spot.toString()){
              // Check if already at work spot
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
                // Path to work spot
                if(!self.path){
                  self.moveTo(0,spot[0],spot[1]);
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
                
                // If in cave, exit first before depositing
                if(self.z === -1){
                  if(self.caveEntrance){
                    console.log('💼 ' + self.name + ' has iron ore, exiting cave to deposit');
                    // Keep calling moveTo to follow the path until cave exit
                    self.moveTo(0, self.caveEntrance[0], self.caveEntrance[1]);
                }
                  // Don't return - let path following code execute so serf actually moves!
                } else {
                
                  console.log('💼 ' + self.name + ' has ' + self.inventory.ironore + ' iron ore, heading to deposit at mine (z=' + self.z + ')');
                
                var b = Building.list[self.work.hq];
                var drop = [b.plot[0][0],b.plot[0][1]+1];
                if(loc.toString() == drop.toString()){
                  self.facing = 'up';
                  var totalIron = self.inventory.ironore;
                  var buildingShare = Math.floor(totalIron * 0.85); // 85% to building
                  var serfWage = totalIron - buildingShare;         // 15% wage for serf
                  
                  console.log('💰 ' + self.name + ' AT DEPOSIT POINT - Total: ' + totalIron + ' (Building: ' + buildingShare + ', Wage: ' + serfWage + ')');
                  
                  self.inventory.ironore = 0;
                  self.stores.ironore = (self.stores.ironore || 0) + serfWage; // Keep wage
                  
                  // Deposit to building's house (not owner) - CRITICAL FIX
                  if(b.house && House.list[b.house]){
                    House.list[b.house].stores.ironore += buildingShare;
                    console.log('✅ ' + self.name + ' deposited ' + buildingShare + ' iron ore to ' + House.list[b.house].name + ' (total now: ' + House.list[b.house].stores.ironore + ')');
                    
                    // Create deposit event
                    if(global.eventManager && buildingShare > 0){
                      global.eventManager.createEvent({
                        category: global.eventManager.categories.ECONOMIC,
                        subject: self.id,
                        subjectName: self.name || self.class,
                        action: 'deposited iron ore',
                        target: b.house,
                        targetName: House.list[b.house].name,
                        quantity: buildingShare,
                        communication: global.eventManager.commModes.NONE,
                        log: `[ECONOMIC] ${self.name} deposited ${buildingShare} iron ore to ${House.list[b.house].name}`,
                        position: {x: self.x, y: self.y, z: self.z}
                      });
                    }
                  } else if(Player.list[b.owner] && Player.list[b.owner].house){
                    var h = Player.list[b.owner].house;
                    House.list[h].stores.ironore += buildingShare;
                    console.log('✅ ' + self.name + ' deposited ' + buildingShare + ' iron ore to owner\'s house');
                  } else if(Player.list[b.owner]){
                    Player.list[b.owner].stores.ironore += buildingShare;
                    console.log('✅ ' + self.name + ' deposited ' + buildingShare + ' iron ore to independent player');
                  }
                  // Track daily deposits (building share only)
                  if(!b.dailyStores) b.dailyStores = {stone: 0, ironore: 0, silverore: 0, goldore: 0, diamond: 0};
                  b.dailyStores.ironore += buildingShare;
                } else {
                    // Keep calling moveTo to follow the path until destination is reached
                    self.moveTo(0,drop[0],drop[1]);
                  }
                }
              } else if(self.inventory.silverore >= 1){
                // Clear work spot - we're depositing, not gathering
                self.work.spot = null;
                
                // If in cave, exit first before depositing
                if(self.z === -1){
                  if(self.caveEntrance){
                    console.log('💼 ' + self.name + ' has silver ore, exiting cave to deposit');
                    // Keep calling moveTo to follow the path until cave exit
                    self.moveTo(0, self.caveEntrance[0], self.caveEntrance[1]);
                }
                  // Don't return - let path following code execute!
                } else {
                var b = Building.list[self.work.hq];
                var drop = [b.plot[0][0],b.plot[0][1]+1];
                if(loc.toString() == drop.toString()){
                  self.facing = 'up';
                  self.inventory.silverore--;
                  // Deposit to building's house (not owner) - CRITICAL FIX
                  if(b.house && House.list[b.house]){
                    House.list[b.house].stores.silverore++;
                    console.log('✅ ' + self.name + ' deposited 1 silver ore to ' + House.list[b.house].name);
                  } else if(Player.list[b.owner] && Player.list[b.owner].house){
                    var h = Player.list[b.owner].house;
                    House.list[h].stores.silverore++;
                    console.log('✅ ' + self.name + ' deposited 1 silver ore to owner\'s house');
                  } else if(Player.list[b.owner]){
                    Player.list[b.owner].stores.silverore++;
                    console.log('✅ ' + self.name + ' deposited 1 silver ore to independent player');
                  }
                  // Track daily deposits
                  if(!b.dailyStores) b.dailyStores = {stone: 0, ironore: 0, silverore: 0, goldore: 0, diamond: 0};
                  b.dailyStores.silverore++;
                } else {
                    // Keep calling moveTo to follow the path until destination is reached
                    self.moveTo(0,drop[0],drop[1]);
                  }
                }
              } else if(self.inventory.goldore >= 1){
                // Clear work spot - we're depositing, not gathering
                self.work.spot = null;
                
                // If in cave, exit first before depositing
                if(self.z === -1){
                  if(self.caveEntrance){
                    console.log('💼 ' + self.name + ' has gold ore, exiting cave to deposit');
                    // Keep calling moveTo to follow the path until cave exit
                    self.moveTo(0, self.caveEntrance[0], self.caveEntrance[1]);
                }
                  // Don't return - let path following code execute!
                } else {
                var b = Building.list[self.work.hq];
                var drop = [b.plot[0][0],b.plot[0][1]+1];
                if(loc.toString() == drop.toString()){
                  self.facing = 'up';
                  self.inventory.goldore--;
                  // Deposit to building's house (not owner) - CRITICAL FIX
                  if(b.house && House.list[b.house]){
                    House.list[b.house].stores.goldore++;
                    console.log('✅ ' + self.name + ' deposited 1 gold ore to ' + House.list[b.house].name);
                  } else if(Player.list[b.owner] && Player.list[b.owner].house){
                    var h = Player.list[b.owner].house;
                    House.list[h].stores.goldore++;
                    console.log('✅ ' + self.name + ' deposited 1 gold ore to owner\'s house');
                  } else if(Player.list[b.owner]){
                    Player.list[b.owner].stores.goldore++;
                    console.log('✅ ' + self.name + ' deposited 1 gold ore to independent player');
                  }
                  // Track daily deposits
                  if(!b.dailyStores) b.dailyStores = {stone: 0, ironore: 0, silverore: 0, goldore: 0, diamond: 0};
                  b.dailyStores.goldore++;
                } else {
                    // Keep calling moveTo to follow the path until destination is reached
                    self.moveTo(0,drop[0],drop[1]);
                  }
                }
              } else if(self.inventory.diamond >= 1){
                // Clear work spot - we're depositing, not gathering
                self.work.spot = null;
                
                // If in cave, exit first before depositing
                if(self.z === -1){
                  if(self.caveEntrance){
                    console.log('💼 ' + self.name + ' has diamond, exiting cave to deposit');
                    // Keep calling moveTo to follow the path until cave exit
                    self.moveTo(0, self.caveEntrance[0], self.caveEntrance[1]);
                }
                  // Don't return - let path following code execute!
                } else {
                var b = Building.list[self.work.hq];
                var drop = [b.plot[0][0],b.plot[0][1]+1];
                if(loc.toString() == drop.toString()){
                  self.facing = 'up';
                  self.inventory.diamond--;
                  // Deposit to building's house (not owner) - CRITICAL FIX
                  if(b.house && House.list[b.house]){
                    House.list[b.house].stores.diamond++;
                    console.log('✅ ' + self.name + ' deposited 1 diamond to ' + House.list[b.house].name);
                  } else if(Player.list[b.owner] && Player.list[b.owner].house){
                    var h = Player.list[b.owner].house;
                    House.list[h].stores.diamond++;
                    console.log('✅ ' + self.name + ' deposited 1 diamond to owner\'s house');
                  } else if(Player.list[b.owner]){
                    Player.list[b.owner].stores.diamond++;
                    console.log(Player.list[b.owner].name + ' +1 Diamond');
                  }
                  // Track daily deposits
                  if(!b.dailyStores) b.dailyStores = {stone: 0, ironore: 0, silverore: 0, goldore: 0, diamond: 0};
                  b.dailyStores.diamond++;
                } else {
                    // Keep calling moveTo to follow the path until destination is reached
                    self.moveTo(0,drop[0],drop[1]);
                  }
                }
              } else {
                // No ore to deposit - continue mining
                // Ore mining - serfs need to go to cave (z=-1)
                
                // If no spot assigned, wait for next cycle to get one
                if(!spot){
                  // Spot will be assigned in next update cycle by mode logic
                  // Don't return or clear action - let serf idle naturally
                } else {
                
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
                          if(global.eventManager){
                            global.eventManager.resourceGathered(self, 'diamond', 1, {x: self.x, y: self.y, z: self.z});
                          }
                        } else if(roll < 0.01){
                          self.inventory.goldore++;
                          console.log(self.name + ' mined 1 Gold Ore');
                          if(global.eventManager){
                            global.eventManager.resourceGathered(self, 'gold ore', 1, {x: self.x, y: self.y, z: self.z});
                          }
                        } else if(roll < 0.1){
                          self.inventory.silverore++;
                          console.log(self.name + ' mined 1 Silver Ore');
                          if(global.eventManager){
                            global.eventManager.resourceGathered(self, 'silver ore', 1, {x: self.x, y: self.y, z: self.z});
                          }
                        } else if(roll < 0.5){
                          self.inventory.ironore++;
                          console.log('⛏️ ' + self.name + ' mined 1 Iron Ore (now has ' + self.inventory.ironore + ')');
                          
                          // Create mining event
                          if(global.eventManager){
                            global.eventManager.resourceGathered(self, 'iron ore', 1, {x: self.x, y: self.y, z: self.z});
                          }
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
                      var currentLoc = getLoc(self.x, self.y);
                    var currentTile = getTile(1, currentLoc[0], currentLoc[1]);
                    
                    // If stuck on a wall, teleport to cave entrance to escape
                    if(currentTile === 1 && self.caveEntrance){
                      console.log('🚨 ' + self.name + ' STUCK ON WALL at ['+currentLoc+'] - teleporting to cave entrance');
                      var exitCoords = getCenter(self.caveEntrance[0], self.caveEntrance[1] + 1);
                      self.x = exitCoords[0];
                      self.y = exitCoords[1];
                      self.path = null;
                      self.pathCount = 0;
                      return;
                    }
                    
                    // Keep calling getPath to follow the path until destination is reached
                    self.getPath(-1,spot[0],spot[1]);
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
            if(!alreadyAtEntrance){
              if(self.shouldRequestPath(0, caveEntrance[0], caveEntrance[1])){
                self.getPath(0, caveEntrance[0], caveEntrance[1]);
              }
            }
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
                  
                  // Deposit to building's house (not owner) - CRITICAL FIX
                  if(b.house && House.list[b.house]){
                    House.list[b.house].stores.stone += buildingShare;
                    console.log('✅ ' + self.name + ' deposited ' + buildingShare + ' stone to ' + House.list[b.house].name);
                    
                    // Create deposit event
                    if(global.eventManager && buildingShare > 0){
                      global.eventManager.createEvent({
                        category: global.eventManager.categories.ECONOMIC,
                        subject: self.id,
                        subjectName: self.name || self.class,
                        action: 'deposited stone',
                        target: b.house,
                        targetName: House.list[b.house].name,
                        quantity: buildingShare,
                        communication: global.eventManager.commModes.NONE,
                        log: `[ECONOMIC] ${self.name} deposited ${buildingShare} stone to ${House.list[b.house].name}`,
                        position: {x: self.x, y: self.y, z: self.z}
                      });
                    }
                  } else if(Player.list[b.owner] && Player.list[b.owner].house){
                    var h = Player.list[b.owner].house;
                    House.list[h].stores.stone += buildingShare;
                    console.log('✅ ' + self.name + ' deposited ' + buildingShare + ' stone to owner\'s house');
                  } else if(Player.list[b.owner]){
                    Player.list[b.owner].stores.stone += buildingShare;
                    console.log('✅ ' + self.name + ' deposited ' + buildingShare + ' stone to independent player');
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
                  // Spot will be assigned in next update cycle by mode logic
                  // Don't return - let serf idle naturally
                } else if(loc.toString() == spot.toString()){
                  // Already at work spot
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
                // Path to work spot
                  if(!self.path){
                    self.moveTo(0,spot[0],spot[1]);
                  }
                }
              }
            }
          } else if(hq.type == 'dock'){
            // Dock work - serf embarks on fishing ship
            // Check if serf is already on a ship
            if(self.onShip){
              // Serf is aboard, do nothing (ship handles fishing)
              return;
            }
            
            // Path to any dock tile
            var dockTile = null;
            if(hq.plot && hq.plot.length > 0){
              // Find closest dock tile
              var closestDist = Infinity;
              for(var i in hq.plot){
                var dt = hq.plot[i];
                var dtCoords = getCenter(dt[0], dt[1]);
                var dist = self.getDistance({x: dtCoords[0], y: dtCoords[1]});
                if(dist < closestDist){
                  closestDist = dist;
                  dockTile = dt;
                }
              }
            }
            
            if(!dockTile){
              console.log(self.name + ' dock has no valid tiles, switching to idle');
              self.mode = 'idle';
                      self.action = null;
              return;
            }
            
            // Check if serf is at a dock tile
            var tile = getTile(0, loc[0], loc[1]);
            if(tile == 13){ // Dock tile
              // EMBARK - find existing ship or spawn new one
              var availableShip = null;
              
              // Check if dock has ships already available
              if(hq.ships && hq.ships.length > 0){
                // Find a ship that's not full and near the dock
                for(var i = 0; i < hq.ships.length; i++){
                  var shipId = hq.ships[i];
                  var ship = Player.list[shipId];
                  if(ship && ship.embarkedSerfs.length < 3){ // Max 3 serfs per ship
                    var shipLoc = getLoc(ship.x, ship.y);
                    var shipDist = self.getDistance({x: ship.x, y: ship.y});
                    // Ship must be within 3 tiles of dock
                    if(shipDist < 192){ // 3 tiles
                      availableShip = ship;
                      break;
                    }
                  }
                }
              }
              
              if(!availableShip){
                // Spawn new fishing ship
                console.log('🚢 ' + self.name + ' reached dock, spawning new fishing ship');
                
                // Find adjacent water tile to spawn ship
                var waterTile = null;
                var adjacentTiles = [
                  [loc[0], loc[1] + 1],  // down
                  [loc[0], loc[1] - 1],  // up
                  [loc[0] - 1, loc[1]],  // left
                  [loc[0] + 1, loc[1]]   // right
                ];
                
                for(var i in adjacentTiles){
                  var at = adjacentTiles[i];
                  if(at[0] >= 0 && at[0] < mapSize && at[1] >= 0 && at[1] < mapSize){
                    if(getTile(0, at[0], at[1]) == 0){ // Water
                      waterTile = at;
                      break;
                    }
                  }
                }
                
                if(!waterTile){
                  console.log('⚠️ ' + self.name + ' no adjacent water found at dock, cannot spawn ship');
                  return;
                }
                
                // Spawn fishing ship at water tile (in docked state)
                var waterCoords = getCenter(waterTile[0], waterTile[1]);
                availableShip = FishingShip({
                  x: waterCoords[0],
                  y: waterCoords[1],
                  z: 0,
                  dock: self.work.hq,
                  house: hq.house,
                  kingdom: hq.kingdom
                });
                
                // Set ship to docked state with 1-minute despawn timer
                availableShip.mode = 'docked';
                availableShip.dockedTimer = 60 * 60; // 1 minute at 60fps (3600 frames)
                
                // Track ship in dock's registry
                if(!hq.ships) hq.ships = [];
                hq.ships.push(availableShip.id);
              }
              
              // Embark serf on ship
              availableShip.embarkedSerfs.push(self.id);
              self.onShip = true;
              
              // Hide serf from world (move to invalid coordinates)
              self.x = -1000;
              self.y = -1000;
              self.z = -10; // Invalid z-level
              
              console.log('🚢 ' + self.name + ' embarked on fishing ship ' + availableShip.id + ' (crew: ' + availableShip.embarkedSerfs.length + ')');
            } else {
              // Not at dock yet, path to it
              if(!self.path){
                self.moveTo(0, dockTile[0], dockTile[1]);
              }
            }
          }
        }
      } else if(self.action == 'clockout'){
        // Special handling for dock workers - they're on ships
        if(self.onShip){
          // Serf is on fishing ship, do nothing - ship will handle return and disembarkation
          return;
        }
        
        self.working = false;
        self.building = false;
        self.farming = false;
        self.chopping = false;
        self.mining = false;
        var b = Building.list[self.work.hq];
        if (!b || !b.plot || !b.plot[0]) {
          // Building doesn't exist or has invalid plot data
          self.action = null;
          return;
        }
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
              } else if(Player.list[b.owner] && Player.list[b.owner].house){
                var h = Player.list[b.owner].house;
                House.list[h].stores.grain += grainDeposited;
                console.log(self.name + ' dropped off 2 Grain.');
              } else if(Player.list[b.owner]){
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
              } else if(Player.list[b.owner] && Player.list[b.owner].house){
                var h = Player.list[b.owner].house;
                House.list[h].stores.wood += buildingShare;
                console.log(self.name + ' dropped off ' + buildingShare + ' Wood, kept ' + serfWage + ' as wage.');
              } else if(Player.list[b.owner]){
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
                } else if(Player.list[b.owner] && Player.list[b.owner].house){
                  var h = Player.list[b.owner].house;
                  House.list[h].stores.ironore += 2;
                  console.log(self.name + ' dropped off 2 Iron Ore.');
                } else if(Player.list[b.owner]){
                  Player.list[b.owner].stores.stone += 2;
                  console.log(self.name + ' dropped off 2 Iron Ore.');
                }
              } else if(self.inventory.silverore > 0){
                self.inventory.silverore--;
                if(House.list[b.owner]){
                  House.list[b.owner].stores.silverore ++;
                  console.log(self.name + ' dropped off 1 Silver Ore.');
                } else if(Player.list[b.owner] && Player.list[b.owner].house){
                  var h = Player.list[b.owner].house;
                  House.list[h].stores.silverore++;
                  console.log(self.name + ' dropped off 1 Silver Ore.');
                } else if(Player.list[b.owner]){
                  Player.list[b.owner].stores.silverore++;
                  console.log(self.name + ' dropped off 1 Silver Ore.');
                }
              } else if(self.inventory.goldore > 0){
                self.inventory.goldore--;
                if(House.list[b.owner]){
                  House.list[b.owner].stores.goldore ++;
                  console.log(self.name + ' dropped off 1 Gold Ore.');
                } else if(Player.list[b.owner] && Player.list[b.owner].house){
                  var h = Player.list[b.owner].house;
                  House.list[h].stores.goldore++;
                  console.log(self.name + ' dropped off 1 Gold Ore.');
                } else if(Player.list[b.owner]){
                  Player.list[b.owner].stores.goldore++;
                  console.log(self.name + ' dropped off 1 Gold Ore.');
                }
              } else if(self.inventory.diamond > 0){
                self.inventory.diamond--;
                if(House.list[b.owner]){
                  House.list[b.owner].stores.ironore ++;
                  console.log(self.name + ' dropped off 1 Diamond.');
                } else if(Player.list[b.owner] && Player.list[b.owner].house){
                  var h = Player.list[b.owner].house;
                  House.list[h].stores.diamond++;
                  console.log(self.name + ' dropped off 1 Diamond.');
                } else if(Player.list[b.owner]){
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
                } else if(Player.list[b.owner] && Player.list[b.owner].house){
                  var h = Player.list[b.owner].house;
                  House.list[h].stores.stone += stoneDeposited;
                  console.log(self.name + ' dropped off 2 Stone.');
                } else if(Player.list[b.owner]){
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
          // Restore original speed when fleeing ends
          if (self._originalBaseSpd !== undefined) {
            self.baseSpd = self._originalBaseSpd;
            delete self._originalBaseSpd;
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
          // Restore original speed when fleeing ends
          if (self._originalBaseSpd !== undefined) {
            self.baseSpd = self._originalBaseSpd;
            delete self._originalBaseSpd;
          }
        }
      }
    }
    self.updatePosition();
  }
}

// Backward-compatible aliases
SerfM = function(param){
  param.sex = 'm';
  return Serf(param);
};

SerfF = function(param){
  param.sex = 'f';
  return Serf(param);
};

Innkeeper = function(param){
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
          var buildingType = Building.list[self.work.hq].type;
          if(buildingType === 'mine' && Building.list[self.work.hq].cave){
            self.torchBearer = true;
            self.inventory.torch = 3; // Torchbearers get 3 torches (free light, don't consume)
            console.log(self.name + ' is now a torch bearer (ore miner)');
          } else {
            self.torchBearer = false;
        }
      }
      
      if(!self.tavern){
        self.findTavern();
      }
      
      if(!self.mode){
        self.mode = 'idle';
      }
      
      console.log(self.name + ' (' + self.sex + ') initialized - HQ: ' + (self.work.hq ? Building.list[self.work.hq].type : 'none') + 
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
    } else {
      console.log(self.name + ' no tavern found for house ' + self.house);
    }
  };

  // Unified work assignment (Daily Spot System)
  self.assignDailyWorkSpot = function(){
    if(!self.work.hq || !Building.list[self.work.hq]) return false;
    
    var hq = Building.list[self.work.hq];
    
    // If serf already has assigned spot for today, reuse it
    if(self.work.assignedSpot && hq.assignedSpots[self.id]){
      var spot = self.work.assignedSpot;
      
      // Verify spot still valid (has resources)
      var stillValid = false;
      if(hq.resources){
        for(var i in hq.resources){
          var r = hq.resources[i];
          if(r[0] === spot[0] && r[1] === spot[1]){
            stillValid = true;
            break;
          }
        }
      }
      
      if(stillValid){
        self.work.spot = spot;
        return true;
      } else {
        // Spot depleted, release it and get new one
        hq.releaseSpot(self.id);
        self.work.assignedSpot = null;
      }
    }
    
    // Update building resources before assigning
    if(hq.updateResources){
      hq.updateResources();
    }
    
    // Find available unassigned spots
    if(!hq.resources || hq.resources.length === 0) return false;
    
    var availableSpots = [];
    for(var i in hq.resources){
      var res = hq.resources[i];
      if(hq.isSpotAvailable(res)){
        availableSpots.push(res);
      }
    }
    
    if(availableSpots.length === 0) return false;
    
    // Assign random available spot
    var selected = availableSpots[Math.floor(Math.random() * availableSpots.length)];
    self.work.assignedSpot = selected;
    self.work.spot = selected;
    hq.assignSpot(self.id, selected);
    
    console.log(self.name + ' assigned daily spot at ' + hq.type + ': [' + selected[0] + ',' + selected[1] + ']');
    return true;
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
          // Check CURRENT location, not stale loc from 2 seconds ago
          var currentLoc = getLoc(self.x, self.y);
          if(getTile(0,currentLoc[0],currentLoc[1]) >= 5 && getTile(0,currentLoc[0],currentLoc[1]) < 6){
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
      } else if(getTile(0,loc[0],loc[1]) == 0 && !self.isBoarded){
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
      if(self.hp !== null && self.hp <= 0){
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
      // PERFORMANCE FIX: Spread work assignments over 60 seconds to avoid lag spikes
      var rand = Math.floor(Math.random() * 60000); // 0-60 seconds
      setTimeout(function(){
        self.mode = 'work';
        self.action = null;
        self.dayTimer = false;
        if(!global.SERF_DEBUG_MODE && Math.random() < 0.1) {
          console.log(self.name + ' heads to work');
        }
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
                // Path to work spot
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
                // Path to dropoff
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
                // Path to work spot
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
              } else if(Player.list[b.owner]){
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
          // Restore original speed when fleeing ends
          if (self._originalBaseSpd !== undefined) {
            self.baseSpd = self._originalBaseSpd;
            delete self._originalBaseSpd;
          }
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
  self.runSpd = 5; // Innkeeper run speed
  self.torchBearer = true;
  self.inventory.torch = 3; // Torchbearers get 3 torches (free light, don't consume)
  self.unarmed = true;
  self.isNonCombatant = true; // Civilian NPC
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
  self.isNonCombatant = true; // Civilian NPC
  self.forge = param.forge;
  self.work = 100;
  self.spriteSize = tileSize * 1.5; // Same as SerfM - 1.5x size (96px)
  self.baseSpd = 3;
  self.runSpd = 5; // Blacksmith run speed

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
          // Check CURRENT location, not stale loc from 2 seconds ago
          var currentLoc = getLoc(self.x, self.y);
          if(getTile(0,currentLoc[0],currentLoc[1]) >= 5 && getTile(0,currentLoc[0],currentLoc[1]) < 6){
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
      } else if(getTile(0,loc[0],loc[1]) == 0 && !self.isBoarded){
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
      if(self.hp !== null && self.hp <= 0){
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
          // Restore original speed when fleeing ends
          if (self._originalBaseSpd !== undefined) {
            self.baseSpd = self._originalBaseSpd;
            delete self._originalBaseSpd;
          }
        }
      }
    }
    self.updatePosition();
  }
  
  Player.list[self.id] = self;
  initPack.player.push(self.getInitPack());
  Building.list[self.forge].blacksmith = self.id;
  return self;
}

Monk = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'Monk';
  self.sex = 'm';
  self.cleric = true;
  self.baseSpd = 2;
  self.runSpd = 4; // Monk run speed
  self.isNonCombatant = true; // Civilian NPC
}

Bishop = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'Bishop';
  self.sex = 'm';
  self.rank = '♝ ';
  self.cleric = true;
  self.baseSpd = 2;
  self.runSpd = 4; // Bishop run speed
  self.isNonCombatant = true; // Civilian NPC
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
  self.runSpd = 4; // Friar run speed
  self.torchBearer = true;
}

Shipwright = function(param){
  var self = Character(param);
  self.name = param.name;
  self.class = 'Shipwright';
  self.sex = 'm';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
  self.runSpd = 5; // Shipwright run speed
  self.torchBearer = true;
  self.unarmed = true;
  self.isNonCombatant = true; // Civilian NPC
}

Footsoldier = function(param){
  var self = Character(param);
  self.name = 'Footsoldier';
  self.class = 'Footsoldier';
  self.sex = 'm';
  self.military = true;
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3.5;
  self.runSpd = 6; // Footsoldier run speed
  self.damage = 10;
  return self;
}

Skirmisher = function(param){
  var self = Character(param);
  self.name = 'Skirmisher';
  self.class = 'Skirmisher';
  self.sex = 'm';
  self.military = true;
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3.5;
  self.runSpd = 6; // Skirmisher run speed
  self.damage = 15;
  return self;
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
  self.runSpd = 8; // Cavalier run speed
  self.damage = 20;
  return self;
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
  self.runSpd = 8; // General run speed
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
  self.runSpd = 9; // Warden run speed
  self.torchBearer = true;
  self.damage = 20;
  self.inventory.arrows = Math.floor(Math.random() * 21) + 20; // 20-40 arrows
}

SwissGuard = function(param){
  var self = Character(param);
  self.name = 'Swiss Guard';
  self.class = 'SwissGuard';
  self.sex = 'm';
  self.spriteSize = tileSize*2;
  self.baseSpd = 3;
  self.runSpd = 5; // Swiss Guard run speed
  self.damage = 15;
}

Hospitaller = function(param){
  var self = Character(param);
  self.name = 'Hospitaller';
  self.class = 'Hospitaller';
  self.sex = 'm';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
  self.runSpd = 5; // Hospitaller run speed
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
  self.runSpd = 8; // Imperial Knight run speed
  self.spriteSize = tileSize*3;
  self.damage = 25;
}

Trebuchet = function(param){
  var self = Character(param);
  self.class = 'Trebuchet';
  self.spriteSize = tileSize*10;
  self.ranged = true;
  self.damage = 100;
  self.inventory.arrows = Math.floor(Math.random() * 21) + 20; // 20-40 arrows
}

BombardCannon = function(param){
  var self = Character(param);
  self.class = 'BombardCannon';
  self.baseSpd = 2;
  self.ranged = true;
  self.damage = 250;
  self.inventory.arrows = Math.floor(Math.random() * 21) + 20; // 20-40 arrows
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

// CargoShip is defined earlier in file (line ~7109) with full implementation

Galley = function(param){
  var self = Character(param);
  self.class = 'Galley';
  self.ranged = true;
  self.torchBearer = true;
  self.damage = 15;
  self.inventory.arrows = Math.floor(Math.random() * 21) + 20; // 20-40 arrows
}

Caravel = function(param){
  var self = Character(param);
  self.class = 'Caravel';
  self.ranged = true;
  self.torchBearer = true;
  self.inventory.arrows = Math.floor(Math.random() * 21) + 20; // 20-40 arrows
}

Galleon = function(param){
  var self = Character(param);
  self.class = 'Galleon';
  self.rank = '♜ ';
  self.ranged = true;
  self.torchBearer = true;
  self.damage = 150;
  self.inventory.arrows = Math.floor(Math.random() * 21) + 20; // 20-40 arrows
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
  return self;
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
  self.inventory.arrows = Math.floor(Math.random() * 21) + 20; // 20-40 arrows
}

NorseSword = function(param){
  var self = Character(param);
  self.name = 'Norseman';
  self.class = 'NorseSword';
  self.sex = 'm';
  self.military = true;
  self.spriteSize = tileSize*1.5;
  self.damage = 15;
  return self;
}

NorseSpear = function(param){
  var self = Character(param);
  self.name = 'Norseman';
  self.class = 'NorseSpear';
  self.sex = 'm';
  self.military = true;
  self.spriteSize = tileSize*1.5;
  self.damage = 15;
  return self;
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
  return self;
}

FrankSpear = function(param){
  var self = Character(param);
  self.name = 'Frank';
  self.class = 'FrankSpear';
  self.sex = 'm';
  self.military = true;
  self.spriteSize = tileSize*2;
  self.damage = 10;
  return self;
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
  self.inventory.arrows = Math.floor(Math.random() * 21) + 20; // 20-40 arrows
  return self;
}

Mangonel = function(param){
  var self = Character(param);
  self.name = 'Mangonel';
  self.class = 'Mangonel';
  self.baseSpd = 2;
  self.spriteSize = tileSize*2;
  self.ranged = true;
  self.damage = 50;
  self.inventory.arrows = Math.floor(Math.random() * 21) + 20; // 20-40 arrows
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
  self.inventory.arrows = Math.floor(Math.random() * 21) + 20; // 20-40 arrows
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
  return self;
}

CeltSpear = function(param){
  var self = Character(param);
  self.name = 'Celt';
  self.class = 'CeltSpear';
  self.sex = 'm';
  self.military = true;
  self.spriteSize = tileSize*2;
  self.damage = 10;
  return self;
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
  self.inventory.arrows = Math.floor(Math.random() * 21) + 20; // 20-40 arrows
}

Longship = function(param){
  var self = Character(param);
  self.name = 'Longship';
  self.class = 'Longship';
  self.military = true;
  self.ranged = true;
  self.torchBearer = true;
  self.damage = 10;
  self.inventory.arrows = Math.floor(Math.random() * 21) + 20; // 20-40 arrows
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
  return self;
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
  self.inventory.arrows = Math.floor(Math.random() * 21) + 20; // 20-40 arrows
  return self;
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
  self.runSpd = 8; // Teutonic Knight run speed
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
  self.runSpd = 4; // Prior run speed
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
  self.runSpd = 5; // Archbishop run speed
  self.torchBearer = true;
}

Hochmeister = function(param){
  var self = Character(param);
  self.name = 'Hochmeister';
  self.class = 'Hochmeister';
  self.sex = 'm';
  self.rank = '♜ ';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
  self.runSpd = 5; // Hochmeister run speed
  self.torchBearer = true;
  self.damage = 25;
}

Trapper = function(param){
  var self = Character(param);
  self.name = 'Trapper';
  self.class = 'Trapper';
  self.sex = 'm';
  self.spriteSize = tileSize*1.5;
  self.baseSpd = 3;
  self.runSpd = 5; // Trapper run speed
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
  self.baseSpd = 3;
  self.runSpd = 5; // Outlaw run speed
  self.ranged = true;
  self.torchBearer = true;
  self.damage = 5;
  self.inventory.arrows = Math.floor(Math.random() * 21) + 20; // 20-40 arrows
}

Poacher = function(param){
  var self = Character(param);
  self.name = 'Poacher';
  self.class = 'Poacher';
  self.sex = 'm';
  self.rank = '♞ ';
  self.mounted = true;
  self.baseSpd = 7;
  self.runSpd = 9; // Poacher run speed
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
  self.baseSpd = 3;
  self.runSpd = 5; // Cutthroat run speed
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
  self.inventory.arrows = Math.floor(Math.random() * 21) + 20; // 20-40 arrows
}

// ARROWS
Arrow = function(param){
  var self = Entity(param);
  self.angle = param.angle;
  self.spdX = Math.cos(param.angle/180*Math.PI) * 50;
  self.spdY = Math.sin(param.angle/180*Math.PI) * 50;
  self.parent = param.parent;
  
  // Check if parent is a player or building/entity
  var parentEntity = Player.list[self.parent];
  if(parentEntity){
    self.innaWoods = parentEntity.innaWoods;
    self.zGrid = parentEntity.zGrid;
    self.damage = parentEntity.dmg; // Store parent's damage
    self.parentX = parentEntity.x; // Store parent's position for collision checks
    self.parentY = parentEntity.y;
  } else {
    // Parent is not a player (e.g., building like guardtower)
    self.innaWoods = false;
    // Calculate zGrid based on arrow's position
    var loc = getLoc(self.x, self.y);
    var zc = Math.floor(loc[0]/8);
    var zr = Math.floor(loc[1]/8);
    self.zGrid = [
      [zc-1,zr-1],[zc,zr-1],[zc+1,zr-1],
      [zc-1,zr],[zc,zr],[zc+1,zr],
      [zc-1,zr+1],[zc,zr+1],[zc+1,zr+1]
    ];
    self.damage = param.damage || 10; // Use provided damage or default to 10
    self.parentX = self.x; // Store spawn position for collision checks
    self.parentY = self.y;
  }

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
              Player.list[p.id].hp -= self.damage - p.fortitude;
              Player.list[p.id].working = false;
              Player.list[p.id].chopping = false;
              Player.list[p.id].mining = false;
              Player.list[p.id].farming = false;
              Player.list[p.id].building = false;
              Player.list[p.id].fishing = false;
              
              // Only update parent stealth if parent is a player
              var parentPlayer = Player.list[self.parent];
              if(parentPlayer){
                parentPlayer.stealthed = false;
                parentPlayer.revealed = false;
              }
              
              Player.list[p.id].combat.target = self.parent; // Target the shooter, not the arrow
              Player.list[p.id].action = 'combat';
              Player.list[p.id].stealthed = false;
              Player.list[p.id].revealed = false;
              // player death & respawn (only if entity has HP - exclude invulnerable entities like falcons)
              if(Player.list[p.id].hp !== null && Player.list[p.id].hp <= 0){
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
    getLocTile(0,self.parentX,self.parentY) != 5){
      self.toRemove = true;
    } else if(self.z == 0 && getLocTile(0,self.x,self.y) == 1 &&
    getLocTile(0,self.parentX,self.parentY) != 1){
      self.toRemove = true;
    } else if(self.z == 0 && (getLocTile(0,self.x,self.y) == 13 ||
    getLocTile(0,self.x,self.y) == 14 || getLocTile(0,self.x,self.y) == 15 ||
    getLocTile(0,self.x,self.y) == 16 || getLocTile(0,self.x,self.y) == 19)){
      // Only remove if arrow has moved away from spawn point (prevents immediate removal from guardtowers on building tiles)
      var hasMoved = Math.abs(self.x - self.parentX) > 10 || Math.abs(self.y - self.parentY) > 10;
      if(hasMoved){
      self.toRemove = true;
      }
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
      angle:self.angle,
      x:self.x,
      y:self.y,
      z:self.z,
      innaWoods:self.innaWoods
    };
  };

  Arrow.list[self.id] = self;
  initPack.arrow.push(self.getInitPack());
  console.log('🏹 Arrow created: ID=' + self.id + ', angle=' + self.angle + '°, velocity=[' + self.spdX.toFixed(2) + ',' + self.spdY.toFixed(2) + '], pos=[' + Math.floor(self.x) + ',' + Math.floor(self.y) + '] z=' + self.z);
  return self;
}

Arrow.list = {};

Arrow.update = function(){
  var pack = [];
  var arrowCount = Object.keys(Arrow.list).length;
  for(var i in Arrow.list){
    var arrow = Arrow.list[i];
    arrow.update();
    if(arrow.toRemove){
      delete Arrow.list[i];
      removePack.arrow.push(arrow.id);
      console.log('🏹 Arrow removed: ID=' + arrow.id + ', timer=' + arrow.timer + ', pos=[' + Math.floor(arrow.x) + ',' + Math.floor(arrow.y) + ']');
    } else {
      pack.push(arrow.getUpdatePack());
    }
  }
  if(arrowCount > 0){
    console.log('🏹 Arrow.update(): ' + arrowCount + ' arrows, ' + pack.length + ' in pack');
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
  
  // Item lifecycle properties
  self.spawnTime = Date.now();
  self.spawnDay = global.day || 1; // Day item was spawned (for tick-based sinking)
  self.spawnTick = global.tick || 1; // Tick item was spawned (for tick-based sinking)
  self.despawnAfter = null; // Set by specific item types (consumables only)
  self.sinkTime = null; // When item started sinking process (water items only)
  self.sunk = false; // Has item sunk into terrain?

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
global.Item = Item;

Item.update = function(){
  var pack = [];
  const now = Date.now();
  
  for(var i in Item.list){
    var item = Item.list[i];
    
    // CONSUMABLE DESPAWN: Food items despawn after 10 minutes
    if(item.despawnAfter && item.spawnTime) {
      const age = now - item.spawnTime;
      if(age > item.despawnAfter) {
        item.toRemove = true;
        console.log(`${item.type} despawned after ${Math.floor(age/1000)}s`);
      }
    }
    
    // TERRAIN SINKING: Items at z=0 sink into terrain after time
    if(item.z === 0 && !item.sunk && item.spawnTime) {
      const loc = getLoc(item.x, item.y);
      const terrain = getTile(0, loc[0], loc[1]);
      
      // Water items sink after 10 seconds (real-time) to z=-3
      if(terrain === 0) {
        if(!item.sinkTime) item.sinkTime = now;
        const elapsed = now - item.sinkTime;
        
        if(elapsed > 10000) {
          item.z = -3; // Underwater layer
          item.sinkTime = null; // Reset for potential future sinking
          console.log(`${item.type} sank underwater at [${loc}]`);
        }
      }
      // Land items sink after time to z=-3
      // Skip permanent fixtures (firepits, torches, furniture, etc.)
      // Skeletons: 100 days (36000 ticks)
      // Other pickupable items: 7 days (2520 ticks)
      else if(terrain !== 0 && item.canPickup !== false) {
        const elapsedTicks = (global.day - item.spawnDay) * 360 + (global.tick - item.spawnTick);
        const isSkeleton = item.class === 'Skeleton' || item.type === 'Skeleton1' || item.type === 'Skeleton2';
        const sinkThreshold = isSkeleton ? 36000 : 2520; // 100 days for skeletons, 7 days for others
        
        if(elapsedTicks >= sinkThreshold) {
          item.sunk = true;
          item.z = -3; // Underwater layer (land tiles)
          const days = Math.floor(elapsedTicks / 360);
          console.log(`${item.type} sank into terrain at [${loc}] after ${days} days (retrievable by clearing brush)`);
        }
      }
    }
    
    // Skip sinking for items indoors (z=1, z=2, z=-2) or unique items
    if(item.z === 1 || item.z === 2 || item.z === -2 || 
       item.type === 'relic' || item.type === 'crown') {
      item.sinkTime = null; // Never sink
    }
    
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
  self.despawnAfter = 600000; // 10 minutes for consumables
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
  self.despawnAfter = 600000; // 10 minutes for consumables
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
  self.despawnAfter = 600000; // 10 minutes for consumables
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
  self.despawnAfter = 600000; // 10 minutes for consumables
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
  self.despawnAfter = 600000; // 10 minutes for consumables
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
  self.despawnAfter = 600000; // 10 minutes for consumables
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
  self.despawnAfter = 600000; // 10 minutes for consumables
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
  self.despawnAfter = 600000; // 10 minutes for consumables
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
  self.despawnAfter = 600000; // 10 minutes for consumables
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
}

// CAVEMAP
CaveMap = function(param){
  var self = Item(param);
  self.type = 'CaveMap';
  self.class = 'tool';
  self.rank = 1;
  self.canPickup = true;
  self.pickup = function(id){
    var player = Player.list[id];
    var socket = SOCKET_LIST[id];
    if(player.inventory.cavemap > 9){
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>CaveMap</b>.'}));
    } else if(player.inventory.cavemap + self.qty > 10){
      var q = 10 - player.inventory.cavemap;
      self.qty -= q;
      Player.list[id].inventory.cavemap += q;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + q + ' <b>CaveMap</b>.'}));
    } else {
      Player.list[id].inventory.cavemap += self.qty;
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up</i> ' + self.qty + ' <b>CaveMap</b>.'}));
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
      if(socket){
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>You picked up the</i> <b>Relic</b>.'}));
      }
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

// SHIP WRECKAGE
ShipWreckage = function(param){
  var self = Item(param);
  self.type = 'shipwreckage';
  self.class = 'environment';
  self.canPickup = false;
  self.sinkTimer = param.sinkTimer || 600; // 10 seconds before sinking
  self.sunk = false;
  self.toUpdate = true; // Enable updates for this item
  self.blocker(0); // Wreckage doesn't block movement
  
  self.update = function(){
    if(self.sinkTimer > 0){
      self.sinkTimer--;
      
      // When timer runs out, sink to z=-3
      if(self.sinkTimer <= 0 && !self.sunk){
        self.z = -3; // Sink to ocean floor
        self.sunk = true;
        console.log('🪦 Ship wreckage sank to ocean floor');
      }
    }
  };
  
  self.getInitPack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      z: self.z,
      type: self.type,
      sunk: self.sunk
    };
  };
  
  self.getUpdatePack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      z: self.z,
      sunk: self.sunk
    };
  };
  
  Item.list[self.id] = self;
  initPack.item.push(self.getInitPack());
  return self;
}

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

// WEATHER SYSTEM
Weather = function(param){
  var self = Entity({
    x: param.x || 0,
    y: param.y || 0,
    z: 0, // Always on overworld
    id: param.id || Math.random()
  });
  
  self.class = 'Weather';
  self.weatherType = param.weatherType; // 'fog' or 'storm'
  self.intensity = param.intensity || 1.0; // 0-1 intensity
  self.lifetime = param.lifetime || 0; // Remaining time in ticks
  self.moveSpeed = param.moveSpeed || 0.1; // Very slow movement
  self.moveDirection = Math.random() * 2 * Math.PI;
  self.moveTimer = 0;
  self.toRemove = false;
  
  self.type = 'weather';
  
  self.update = function(){
    // FOG: Auto-despawn based on time of day (disappear by noon)
    if(self.weatherType === 'fog'){
      // Start fading at X.a, gone by XII.p
      if(['X.a', 'XI.a'].includes(tempus)){
        // Fade out intensity
        self.intensity = Math.max(0, self.intensity - 0.01);
        if(self.intensity <= 0){
          self.toRemove = true;
          return;
        }
      } else if(tempus === 'XII.p' || tempus === 'I.p' || tempus === 'II.p' || tempus === 'III.p'){
        // Fog should be gone during afternoon/evening
        self.toRemove = true;
        return;
      }
    }
    
    // STORM: Use lifetime (decreases with each tick)
    if(self.weatherType === 'storm'){
      if(self.lifetime > 0){
        self.lifetime--;
        if(self.lifetime <= 0){
          self.toRemove = true;
          return;
        }
      }
    }
    
    // Random slow movement
    self.moveTimer++;
    if(self.moveTimer > 60){ // Change direction every 60 ticks
      self.moveDirection += (Math.random() - 0.5) * Math.PI / 2;
      self.moveTimer = 0;
    }
    
    // Move in current direction
    self.x += Math.cos(self.moveDirection) * self.moveSpeed;
    self.y += Math.sin(self.moveDirection) * self.moveSpeed;
    
    // Keep within map bounds
    var mapBounds = mapSize * tileSize;
    if(self.x < 0) self.x = 0;
    if(self.y < 0) self.y = 0;
    if(self.x > mapBounds) self.x = mapBounds;
    if(self.y > mapBounds) self.y = mapBounds;
  };
  
  self.getInitPack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      weatherType: self.weatherType,
      intensity: self.intensity
    };
  };
  
  self.getUpdatePack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      weatherType: self.weatherType,
      intensity: self.intensity
    };
  };
  
  Weather.list[self.id] = self;
  return self;
};

Weather.list = {};

Weather.getAllUpdatePack = function(){
  var pack = [];
  for(var i in Weather.list){
    pack.push(Weather.list[i].getUpdatePack());
  }
  return pack;
};

Weather.update = function(){
  var pack = [];
  for(var i in Weather.list){
    var weather = Weather.list[i];
    weather.update();
    if(weather.toRemove){
      delete Weather.list[i];
    } else {
      pack.push(weather.getUpdatePack());
    }
  }
  return pack;
};

// LOAD EXTRACTED ENTITIES
// This will be called from lambic.js after all globals are set up
global.initModularEntities = function() {
  try {
    const entityRegistry = require('./entities/index.js');
    const entities = entityRegistry(Character, {
      zones,
      getTile,
      getLoc,
      getCenter,
      isWalkable,
      mapSize,
      tileSize,
      randomSpawnO
    });
    
    // Assign to globals (override old definitions)
    global.Sheep = entities.Sheep;
    global.Deer = entities.Deer;
    global.Boar = entities.Boar;
    global.Wolf = entities.Wolf;
    global.Falcon = entities.Falcon;
    
    console.log('✅ Loaded modular entity definitions: Sheep, Deer, Boar, Wolf, Falcon');
  } catch(err) {
    console.error('⚠️  Failed to load modular entities, using inline definitions:', err.message);
  }
};
