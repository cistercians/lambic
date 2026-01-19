/**
 * Entity.js - Core entity definitions for the game
 * 
 * This file contains all entity constructors. For new code, prefer importing
 * specific constructors via module.exports rather than using globals:
 * 
 *   const { Character, Building, Item } = require('./Entity');
 * 
 * File Structure:
 * - Entity (base class) - Line ~13
 * - Building - Line ~94
 * - Character - Line ~1791 (base for all NPCs/players)
 * - Serf, SerfM, SerfF - Line ~7898 (civilian workers)
 * - Arrow - Line ~12102
 * - Item - Line ~12326
 * - Light - Line ~14870
 * - Weather - Line ~15076
 * 
 * TODO: This file should be split into separate modules over time.
 * See server/js/entities/ for the modular entity structure.
 */

const dependencyInjector = require('./core/DependencyInjector');

function getSocialSystem() {
  try {
    return dependencyInjector.resolve('socialSystem');
  } catch (error) {
    return global.socialSystem;
  }
}

// Stub for stuck entity analytics - disabled by default to save memory
// Enable with: global.stuckEntityAnalytics.enabled = true
if (!global.stuckEntityAnalytics) {
  global.stuckEntityAnalytics = {
    enabled: false,
    recordStuckEvent: function() {},
    getStats: function() { return { totalEvents: 0 }; },
    maybeLogStats: function() {}
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
    const contextMapSize = global.mapContextManager
      ? global.mapContextManager.getMapSize(self)
      : mapSize;
    
    // Try the target first
    if(isWalkable(targetZ, targetX, targetY, self)){
      return [targetX, targetY];
    }
    
    // Spiral outward from target (optimized iteration order)
    for(var radius = 1; radius <= maxRadius; radius++){
      // Check cardinal directions first (most common successful cases)
      var cardinals = [[0, radius], [radius, 0], [0, -radius], [-radius, 0]];
      for(var c = 0; c < cardinals.length; c++){
        var checkX = targetX + cardinals[c][0];
        var checkY = targetY + cardinals[c][1];
        if(checkX >= 0 && checkX < contextMapSize && checkY >= 0 && checkY < contextMapSize){
          if(isWalkable(targetZ, checkX, checkY, self)){
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
            
            if(checkX2 >= 0 && checkX2 < contextMapSize && checkY2 >= 0 && checkY2 < contextMapSize){
              if(isWalkable(targetZ, checkX2, checkY2, self)){
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
  self.baseTerrain = param.baseTerrain || []; // Original terrain values for each plot tile
  
  self.mats = param.mats;
  self.req = param.req;
  self.hp = param.hp;
  self.occ = 0;

  // Spot tracking for work assignments
  self.assignedSpots = {}; // {serfId: [col,row]}
  self.availableResources = []; // Copy of resources for tracking

  // Ensure building context is set consistently (inherit from owner or explicit matchId)
  const ownerEntity = self.owner && Player.list ? Player.list[self.owner] : null;
  if (global.mapContextHelpers) {
    let matchId = null;
    if (param.battlegroundMatchId) {
      matchId = param.battlegroundMatchId;
    } else if (param.matchId) {
      matchId = param.matchId;
    } else if (param.inBattleground && param.battlegroundMatchId) {
      matchId = param.battlegroundMatchId;
    } else if (ownerEntity && ownerEntity.inBattleground && ownerEntity.battlegroundMatchId) {
      matchId = ownerEntity.battlegroundMatchId;
    }
    global.mapContextHelpers.setEntityContext(self, matchId);
  } else if (ownerEntity) {
    self.inBattleground = !!(ownerEntity.inBattleground && ownerEntity.battlegroundMatchId);
    self.battlegroundMatchId = ownerEntity.battlegroundMatchId || null;
  }
  
  // Dock-specific properties
  if(self.type === 'dock'){
    self.network = param.network || []; // Array of connected dock building IDs
    self.cargoShip = param.cargoShip || null; // Reference to cargo ship if this dock has one
    
    // Create bidirectional dock association (called when ship docks at new location)
    self.createDockAssociation = function(otherDockId){
      if(!otherDockId || otherDockId === self.id) {
        return;
      }
      
      var otherDock = Building.list[otherDockId];
      if(!otherDock || otherDock.type !== 'dock') {
        return;
      }
      
      // Add to this dock's network
      if(self.network.indexOf(otherDockId) === -1){
        self.network.push(otherDockId);
      }
      
      // Add this dock to other dock's network (bidirectional)
      if(!otherDock.network) otherDock.network = [];
      if(otherDock.network.indexOf(self.id) === -1){
        otherDock.network.push(self.id);
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
          const contextMapSize = global.mapContextManager
            ? global.mapContextManager.getMapSize(self)
            : global.mapSize;
          if(at[0] >= 0 && at[0] < contextMapSize && at[1] >= 0 && at[1] < contextMapSize){
            var tileValue = getTile(0, at[0], at[1], self);
            if(tileValue == 0){ // Water
              waterTile = at;
              break;
            }
          }
        }
        if(waterTile) break;
      }
      
      if(!waterTile){
        return;
      }
      
      // Create cargo ship at water tile adjacent to dock
      // Check if CargoShip function exists (defined later in file)
      if(typeof CargoShip === 'undefined'){
        return;
      }
      
      var waterCoords = getCenter(waterTile[0], waterTile[1]);
      
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
      } catch(err){
        return;
      }
      
      // Select first destination and start waiting
      if(cargoShip && cargoShip.selectNextDestination){
        if(cargoShip.selectNextDestination()){
          cargoShip.announceDestination();
          cargoShip.startWaiting();
          self.cargoShip = cargoShip.id;
        } else {
          // Failed to select destination, remove ship
          if(cargoShip.toRemove !== undefined){
            cargoShip.toRemove = true;
          }
        }
      }
    };
  }

  self.getInitPack = function(){
    return {
      id:self.id,
      type:self.type,
      occ:self.occ,
      plot:self.plot,
      walls:self.walls,
      topPlot:self.topPlot,
      baseTerrain:self.baseTerrain || [],
      inBattleground: !!(self.inBattleground && self.battlegroundMatchId),
      battlegroundMatchId: self.battlegroundMatchId || null
    }
  }

  self.getUpdatePack = function(){
    return {
      id:self.id,
      occ:self.occ,
      inBattleground: !!(self.inBattleground && self.battlegroundMatchId),
      battlegroundMatchId: self.battlegroundMatchId || null
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
        if(self.cave){
          // Ore mine - check layer 1 for cave rocks
          var tile = getTile(1, r[0], r[1]);
          return tile >= 2 && tile < 5; // Has ore
        } else {
          // Stone mine - check layer 6 for stone resources and verify it's a large rock
          var layer6Res = getTile(6, r[0], r[1]);
          var terrain = getTile(0, r[0], r[1]);
          // Only keep large rocks (resource-carrying) with resources on layer 6
          return (global.isLargeRock && global.isLargeRock(terrain)) && layer6Res > 0;
        }
      });
    } else if(self.type === 'mill' || self.type === 'farm'){
      // Farms are handled specially (see below)
      self.updateFarmResources();
    }
  };

  // Special farm resource tracking
  self.updateFarmResources = function(){
    if(self.type !== 'mill' && self.type !== 'farm') return;
    
    // CRITICAL FIX: Clear assigned spots proactively before processing tile states
    // This ensures spots are always cleared before new resource assignment,
    // preventing persistent blocking between phase transitions
    if(self.assignedSpots){
      self.assignedSpots = {}; // Clear all assigned spots at start of update
    }
    
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
    
    // Track tile states for debugging
    var tileStateCounts = { tile8: 0, tile9: 0, tile10: 0, other: 0 };
    var resourceCounts = { below50: 0, above50: 0 };
    
    for(var i in plotsToCheck){
      var p = plotsToCheck[i];
      var tile = getTile(0, p[0], p[1]);
      var res = getTile(6, p[0], p[1]);
      
      // Track tile states
      if(tile === 8) tileStateCounts.tile8++;
      else if(tile === 9) tileStateCounts.tile9++;
      else if(tile === 10) tileStateCounts.tile10++;
      else tileStateCounts.other++;
      
      // Track resource levels (for debugging)
      if(tile === 8){
        if(res < 5) resourceCounts.below50++;
        else resourceCounts.above50++;
      } else if(tile === 9){
        if(res < 10) resourceCounts.below50++;
        else resourceCounts.above50++;
      } else if(tile === 10){
        if(res > 0) resourceCounts.below50++;
        else resourceCounts.above50++;
      }
      
      if(tile === 8){ // Barren phase - needs work until res >= 5
        if(res < 5){
          barren.push(p); // Needs planting/watering
        }
        // If res >= 5, exclude (ready for phase transition to growing)
      } else if(tile === 9){ // Growing phase - needs work until res >= 10
        if(res < 10){
          growing.push(p); // Still needs work
        }
        // If res >= 10, exclude (ready for phase transition to grain)
      } else if(tile === 10){ // Grain phase - harvest until res === 0
        if(res > 0){
          wheat.push(p); // Has grain to harvest
        }
        // If res === 0, exclude (depleted, ready for phase transition back to barren)
      }
    }
    
    // Get current time once for all throttling checks
    const now = Date.now();
    
    // Log tile state diagnostics when state changes (throttled)
    if(!self._farmTileState){
      self._farmTileState = { tile8: 0, tile9: 0, tile10: 0, lastLogTime: 0 };
    }
    
    const tileStateChanged = 
      self._farmTileState.tile8 !== tileStateCounts.tile8 ||
      self._farmTileState.tile9 !== tileStateCounts.tile9 ||
      self._farmTileState.tile10 !== tileStateCounts.tile10;
    
    const timeSinceLastTileLog = now - self._farmTileState.lastLogTime;
    const TILE_STATE_LOG_THROTTLE_MS = 60000; // 1 minute between tile state logs
    
    if(tileStateChanged && timeSinceLastTileLog > TILE_STATE_LOG_THROTTLE_MS){
      const buildingName = self.type === 'mill' ? 'mill' : 'farm';
      const ownerName = self.owner && global.House && global.House.list 
        ? (global.House.list[self.owner]?.name || 'Unknown')
        : 'Unknown';
      
      
      self._farmTileState.tile8 = tileStateCounts.tile8;
      self._farmTileState.tile9 = tileStateCounts.tile9;
      self._farmTileState.tile10 = tileStateCounts.tile10;
      self._farmTileState.lastLogTime = now;
    }
    
    // Initialize state tracking if needed
    if(!self._farmResourceState){
      self._farmResourceState = { wheat: 0, barren: 0, growing: 0, lastLogTime: 0 };
    }
    
    // Check for state changes
    const stateChanged = 
      self._farmResourceState.wheat !== wheat.length ||
      self._farmResourceState.barren !== barren.length ||
      self._farmResourceState.growing !== growing.length;
    const timeSinceLastLog = now - self._farmResourceState.lastLogTime;
    const LOG_THROTTLE_MS = 30000; // 30 seconds between logs
    const shouldLog = stateChanged && timeSinceLastLog > LOG_THROTTLE_MS;
    
    // Log only on state changes (throttled)
    if(shouldLog){
      const buildingName = self.type === 'mill' ? 'mill' : 'farm';
      const ownerName = self.owner && global.House && global.House.list 
        ? (global.House.list[self.owner]?.name || 'Unknown')
        : 'Unknown';
      
      // Log state change
      
      // Update state tracking
      self._farmResourceState.wheat = wheat.length;
      self._farmResourceState.barren = barren.length;
      self._farmResourceState.growing = growing.length;
      self._farmResourceState.lastLogTime = now;
    }
    
    // Assign based on farm state - PRIORITIZE WHEAT (grain tiles)
    // Priority order: wheat (type 10) > growing (type 9) > barren (type 8)
    if(wheat.length > 0){
      // Wheat mode - only assign wheat tiles (grain should be prioritized)
      self.resources = wheat;
      
      // Log when wheat becomes available (state change from 0 to >0)
      if(shouldLog && self._farmResourceState.wheat === 0 && wheat.length > 0){
        const buildingName = self.type === 'mill' ? 'mill' : 'farm';
        const ownerName = self.owner && global.House && global.House.list 
          ? (global.House.list[self.owner]?.name || 'Unknown')
          : 'Unknown';
      }
    } else if(growing.length > 0){
      // Growing mode - assign growing tiles (type 9)
      self.resources = growing;
      
      // Log when growing becomes available (state change)
      if(shouldLog && self._farmResourceState.growing === 0 && growing.length > 0){
        const buildingName = self.type === 'mill' ? 'mill' : 'farm';
        const ownerName = self.owner && global.House && global.House.list 
          ? (global.House.list[self.owner]?.name || 'Unknown')
          : 'Unknown';
      }
    } else {
      // Barren mode - assign barren tiles (type 8)
      self.resources = barren;
      
      // Only log "no grain available" if we had grain before (state change)
      if(shouldLog && self._farmResourceState.wheat > 0 && wheat.length === 0){
        const buildingName = self.type === 'mill' ? 'mill' : 'farm';
        const ownerName = self.owner && global.House && global.House.list 
          ? (global.House.list[self.owner]?.name || 'Unknown')
          : 'Unknown';
      }
    }
  };

  Building.list[self.id] = self;

  initPack.building.push(self.getInitPack());

  return self;
}

Farm = function(param){
  var self = Building(param);
  self.resources = [];
  self.serfs = {};
  self.mill = null;
  self.findMill = function(){
    for(var i in Building.list){
      var m = Building.list[i];
      // CRITICAL: Check map context - only interact with buildings in same context
      if(global.mapContextHelpers && !global.mapContextHelpers.areInSameContext(self, m)) {
        continue;
      }
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
  if (typeof self.updateFarmResources === 'function') {
    self.updateFarmResources();
  }
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
    // Farm resource management is now handled by updateFarmResources()
    // This method only handles serf spawning logic
  }
  self.findFarms = function(){
    for(var i in Building.list){
      var f = Building.list[i];
      // CRITICAL: Check map context - only interact with buildings in same context
      if(global.mapContextHelpers && !global.mapContextHelpers.areInSameContext(self, f)) {
        continue;
      }
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
      // CRITICAL: Check map context - only interact with buildings in same context
      if(global.mapContextHelpers && !global.mapContextHelpers.areInSameContext(self, t)) {
        continue;
      }
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
      // CRITICAL: Check map context - only interact with buildings in same context
      if(global.mapContextHelpers && !global.mapContextHelpers.areInSameContext(self, t)) {
        continue;
      }
      var dist = getDistance({x:self.x,y:self.y},{x:t.x,y:t.y});
      if(t.type == 'tavern' && dist <= 1280 && t.house == self.house){
        self.tavern = t.id;
      }
    }
  }
  self.getRes = function(){
    // Reset cave classification
    self.cave = null;
    
    // Check distance to cave entrances (6 tiles = 384 pixels)
    for(var i in caveEntrances){
      var cave = caveEntrances[i];
      var c = getCenter(cave[0],cave[1]);
      var dist = self.getDistance({x:c[0],y:c[1]});
      if(dist <= 384){
        self.cave = cave;
        // Log mine classification (only once per mine)
        if(!self._classificationLogged){
          const ownerName = self.owner && global.House && global.House.list 
            ? (global.House.list[self.owner]?.name || 'Unknown')
            : 'Unknown';
          self._classificationLogged = true;
        }
        break; // Found a cave entrance, no need to check others
      }
    }
    
    // Log if mine is classified as stone mine (only once)
    if(!self.cave && !self._classificationLogged){
      const ownerName = self.owner && global.House && global.House.list 
        ? (global.House.list[self.owner]?.name || 'Unknown')
        : 'Unknown';
      self._classificationLogged = true;
    }
    if(self.cave){
      // Ore mine - scan z=-1 cave layer for rocks (stored in tilemap layer 1)
      var caveEntranceCoords = getCenter(self.cave[0], self.cave[1]);
      var area = getArea(self.cave,self.cave,10); // Area around cave entrance, not mine
      var resourcesBefore = self.resources.length;
      for(var i in area){
        var r = area[i];
        // Check cave layer 1 for rocks - cave tiles at z=-1 are stored in layer 1
        var gt = getTile(1,r[0],r[1]); // Layer 1 contains cave tiles
        if(gt >= 3 && gt <= 5){ // Rock tiles in caves (types 3, 4, 5)
          // Verify rock is reachable from cave entrance
          var rockCoords = getCenter(r[0], r[1]);
          var dist = getDistance({x: caveEntranceCoords[0], y: caveEntranceCoords[1]}, {x: rockCoords[0], y: rockCoords[1]});
          if(dist <= 640){ // Within 10 tiles of cave entrance
            // Ensure r is a valid [col, row] array before pushing
            if(Array.isArray(r) && r.length === 2 && typeof r[0] === 'number' && typeof r[1] === 'number'){
              self.resources.push(r);
            } else {
              console.warn(`[MINE] Cave mine: Invalid resource format from getArea - expected [col, row], got:`, r);
            }
          }
        }
      }
      // Diagnostic logging: Check if cave mine found resources
      if(self.resources.length === 0 && !self._noResourcesLogged){
        const ownerName = self.owner && global.House && global.House.list 
          ? (global.House.list[self.owner]?.name || 'Unknown')
          : 'Unknown';
        console.warn(`[MINE RESOURCE SCAN] ${ownerName}: Cave mine at [${Math.floor(self.x)}, ${Math.floor(self.y)}] found NO ore resources after scanning z=-1 (cave entrance: [${self.cave[0]}, ${self.cave[1]}])`);
        self._noResourcesLogged = true;
      }
    } else {
      // Stone mine - scan z=0 for stone patches
      var loc = getLoc(self.x,self.y);
      var loc1 = [loc[0]+1,loc[1]-1];
      var area = getArea(loc,loc1,6);
      var resourcesBefore = self.resources.length;
      for(var i in area){
        var r = area[i];
        var c = getCenter(r[0],r[1]);
        var dist = self.getDistance({x:c[0],y:c[1]});
        if(dist <= 384){
          var gt = getTile(0,r[0],r[1]);
          // Check for all stone types:
          // - Regular stone: exactly 4 (TERRAIN.ROCKS)
          // - Large stone: > 4 && < 5 (decimal rocks)
          // - Mountain: >= 5 && < 6 (TERRAIN.MOUNTAIN with possible decimals)
          var isStoneResource = (gt === 4) || 
                                (gt > 4 && gt < 5) || 
                                (gt >= 5 && gt < 6);
          if(isStoneResource){
            self.resources.push(r);
          }
        }
      }
      // Diagnostic logging: Check if stone mine found resources
      if(self.resources.length === 0 && !self._noResourcesLogged){
        const ownerName = self.owner && global.House && global.House.list 
          ? (global.House.list[self.owner]?.name || 'Unknown')
          : 'Unknown';
        console.warn(`[MINE RESOURCE SCAN] ${ownerName}: Stone mine at [${Math.floor(self.x)}, ${Math.floor(self.y)}] found NO stone resources after scanning z=0`);
        self._noResourcesLogged = true;
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
      // Use context-aware entity filtering to only check entities in same context
      const enemyCandidates = global.mapContextHelpers 
        ? global.mapContextHelpers.getEntitiesInSameContext(self, { z: 0 })
        : Object.values(Player.list).filter(p => p && p.z === 0);
      
      for(var enemy of enemyCandidates){
        if(!enemy) continue;
        
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
        // Use context-aware entity filtering to only check entities in same context
        const guardCandidates = global.mapContextHelpers 
          ? global.mapContextHelpers.getEntitiesInSameContext(self, { z: 0 })
          : Object.values(Player.list).filter(p => p && p.z === 0);
        
        for(var guard of guardCandidates){
          if(!guard) continue;
          
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
      
      // Use context-aware entity filtering to only check entities in same context
      const enemyCandidates = global.mapContextHelpers 
        ? global.mapContextHelpers.getEntitiesInSameContext(self, { z: 0 })
        : Object.values(Player.list).filter(p => p && p.z === 0);
      
      for(var enemy of enemyCandidates){
        if(!enemy) continue;
        
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
      // CRITICAL: Check map context - only interact with buildings in same context
      if(global.mapContextHelpers && !global.mapContextHelpers.areInSameContext(self, b)) {
        continue;
      }
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
    var serfLogger = global.serfLogger;
    
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
      // Store original terrain before changing tiles
      var baseTerrain = [];
      for(var i in plot){
        var p = plot[i];
        baseTerrain.push(getTile(0, p[0], p[1]));
        tileChange(0,p[0],p[1],11);
        // Foundation tiles must remain walkable during construction
        matrixChange(0,p[0],p[1],0);
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
        baseTerrain:baseTerrain,
        mats:{
          wood:30,
          stone:0
        },
        req:5,
        hp:150
      })
      var logTavernSpawn = function(serf, role){
        if(!serfLogger || typeof serfLogger.info !== 'function' || !serf) return;
        var night = null;
        if(global.gameState && typeof global.gameState.nightfall === 'boolean'){
          night = global.gameState.nightfall;
        } else if(typeof global.nightfall === 'boolean'){
          night = global.nightfall;
        }
        var serfLoc = getLoc(serf.x, serf.y);
        serfLogger.info('Tavern serf spawned', serf, {
          tavernId: self.id,
          workHq: b,
          hutId: id,
          role: role || 'unknown',
          z: serf.z,
          loc: serfLoc,
          nightfall: night,
          mode: serf.mode || null,
          action: serf.action || null
        });
      };
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
        var serf1 = SerfM({
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
          tavern:self.id,
          mode:'idle',
          action:null
        });
        logTavernSpawn(serf1, 'primary');
      } else {
        // Mill - either gender (60% male)
      if(s1 > 0.4){
        var serf1 = SerfM({
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
          tavern:self.id,
          mode:'idle',
          action:null
        });
        logTavernSpawn(serf1, 'primary');
      } else {
        var serf1 = SerfF({
          id:s1,
          name:randomName('f'),
          x:c1[0],
          y:c1[1],
          z:2,
          house:Player.list[self.owner].house,
          kingdom:Player.list[self.owner].kingdom,
          home:{z:2,loc:sp1},
          hut:id,
          tavern:self.id,
          mode:'idle',
          action:null
        });
        logTavernSpawn(serf1, 'primary');
      }
      }
      
      // Second serf - either gender (40% male for variety)
      if(s2 > 0.6){
        var serf2 = SerfM({
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
          tavern:self.id,
          mode:'idle',
          action:null
        });
        logTavernSpawn(serf2, 'secondary');
      } else {
        var serf2 = SerfF({
          id:s2,
          name:randomName('f'),
          x:c2[0],
          y:c2[1],
          z:2,
          house:Player.list[self.owner].house,
          kingdom:Player.list[self.owner].kingdom,
          home:{z:2,loc:sp2},
          hut:id,
          tavern:self.id,
          mode:'idle',
          action:null
        });
        logTavernSpawn(serf2, 'secondary');
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
      // Use context-aware entity filtering to only check entities in same context
      const entityCandidates = global.mapContextHelpers 
        ? global.mapContextHelpers.getEntitiesInSameContext(self, { z: 1 })
        : Object.values(Player.list).filter(p => p && (p.z === 1 || p.z === 2));
      
      for(var entity of entityCandidates){
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
      // Use context-aware entity filtering to only check entities in same context
      const entityCandidates = global.mapContextHelpers 
        ? global.mapContextHelpers.getEntitiesInSameContext(self, { z: 1 })
        : Object.values(Player.list).filter(p => p && p.z === 1);
      
      for(var entity of entityCandidates){
        if(!entity) continue;
        
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
      // CRITICAL: Check map context - only interact with buildings in same context
      if(global.mapContextHelpers && !global.mapContextHelpers.areInSameContext(self, t)) {
        continue;
      }
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
      // CRITICAL: Check map context - only interact with buildings in same context
      if(global.mapContextHelpers && !global.mapContextHelpers.areInSameContext(self, t)) {
        continue;
      }
      var dist = getDistance({x:self.x,y:self.y},{x:t.x,y:t.y});
      if(t.type == 'tavern' && dist <= 1280 && t.house == self.house){
        self.tavern = t.id;
      }
    }
  }
  
  // Find geographic zone on init - use land zone from plot tiles, not water zone
  self.findZone = function() {
    if(global.zoneManager && self.plot) {
      // Iterate through dock's plot tiles to find a tile with value 11 (BUILD_MARKER = land tile)
      // Docks use tile value 11 for land tiles and 11.5 for water tiles
      for(var i = 0; i < self.plot.length; i++) {
        var plotTile = self.plot[i];
        var tileValue = getTile(0, plotTile[0], plotTile[1]);
        
        // Check if this is a land tile (tile value 11 = BUILD_MARKER)
        if(tileValue === 11) {
          // Found a land tile - get zone name from this location
          var zone = global.zoneManager.getZoneAt(plotTile);
      
          // Only use geographic features (not faction territories)
          if(zone && zone.type === 'geographic') {
            self.zoneName = zone.name;
            return; // Found land zone, stop searching
          }
        }
      }
      
      // Fallback: if no land tile found with zone, try center location
      var loc = getLoc(self.x, self.y, self);
      var zone = global.zoneManager.getZoneAt(loc);
      if(zone && zone.type === 'geographic') {
        self.zoneName = zone.name;
      } else {
        self.zoneName = self.zoneName || 'Dock';
      }
    } else {
      self.zoneName = self.zoneName || 'Dock';
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
global.FACTION_BASIC_UNITS = FACTION_BASIC_UNITS;
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
  }
};

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
      
      if(global.console && global.console.log){
        console.log('[Garrison] Production timer triggered', {
          garrisonId: self.id,
          built: self.built,
          house: self.house,
          owner: self.owner
        });
      }
      
      // Check if building is built
      if(!self.built){
        if(global.console && global.console.log){
          console.log('[Garrison] Production skipped: Building not built', self.id);
        }
        return;
      }
      
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
        if(global.console && global.console.log){
          console.log('[Garrison] Production failed: No house found for garrison', self.id);
        }
        return;
      }
      
      // Determine unit type based on faction progression and buildings (check early)
      var progression = FACTION_UNIT_PROGRESSION[house.name];
      // Fallback to Player progression for unknown faction names (player-created houses)
      if(!progression && FACTION_UNIT_PROGRESSION['Player']){
        progression = FACTION_UNIT_PROGRESSION['Player'];
        if(global.console && global.console.log){
          console.log('[Garrison] Using Player progression as fallback for faction', house.name);
        }
      }
      var unitClass;
      var grain = house.stores.grain || 0;
      var fish = house.stores.fish || 0;
      var wood = house.stores.wood || 0;
      
      // Count current military units for this house
      var militaryCount = 0;
      for(var id in Player.list){
        var unit = Player.list[id];
        if(unit && unit.military && unit.house === house.id){
          militaryCount++;
        }
      }
      
      // Surplus resource validation for automatic training (units are FREE, but need surplus food)
      // Each unit requires 10 food in stores to be supported
      var requiredReserve = militaryCount * 10; // Food needed to support existing units
      var totalFood = grain + fish; // Total available food
      var surplusFood = totalFood - requiredReserve; // Food available after reserving for existing units
      
      // Check if we have surplus to support a new unit
      if(surplusFood < 10){
        if(global.console && global.console.log){
          console.log('[Garrison] Production failed: Insufficient surplus food', {
            house: house.name,
            militaryCount: militaryCount,
            totalFood: totalFood,
            requiredReserve: requiredReserve,
            surplusFood: surplusFood,
            required: 10
          });
        }
        return; // Can't train - not enough surplus
      }
      
      // If surplusFood < 0, faction is over-extended (more units than food supports)
      if(surplusFood < 0){
        if(global.console && global.console.log){
          console.log('[Garrison] Production failed: Over-extended (more units than food supports)', {
            house: house.name,
            militaryCount: militaryCount,
            totalFood: totalFood,
            requiredReserve: requiredReserve,
            surplusFood: surplusFood
          });
        }
        return; // Can't train - over-extended
      }
      
      if(progression){
        // Check if stronghold exists (produces elite units)
        if(house.hasStronghold && progression.elite){
          unitClass = progression.elite;
        } else {
          // No stronghold, produce basic units
          var basicUnits = progression.basic;
          if(!basicUnits || basicUnits.length === 0){
            if(global.console && global.console.log){
              console.log('[Garrison] Production failed: No basic units defined for progression', house.name);
            }
            return;
          }
          unitClass = basicUnits[Math.floor(Math.random() * basicUnits.length)];
        }
        
        // Automatic training is FREE - no resource consumption
        // Units are included in garrison building cost
        // Only surplus food check is required (already validated above)
      } else {
        // Fallback for factions without progression defined (use old system)
        // Requires 10 grain
        if(grain < 10){
          if(global.console && global.console.log){
            console.log('[Garrison] Production failed: Insufficient grain', {
              house: house.name,
              grain: grain,
              required: 10
            });
          }
          return;
        }
        
        var factionUnits = FACTION_BASIC_UNITS[house.name];
        // Fallback to Player progression basic units for unknown faction names
        if(!factionUnits || factionUnits.length === 0){
          if(FACTION_UNIT_PROGRESSION['Player'] && FACTION_UNIT_PROGRESSION['Player'].basic){
            factionUnits = FACTION_UNIT_PROGRESSION['Player'].basic;
            if(global.console && global.console.log){
              console.log('[Garrison] Using Player basic units as fallback for faction', house.name);
            }
          } else {
            if(global.console && global.console.log){
              console.log('[Garrison] Production failed: No faction units defined', house.name);
            }
            return;
          }
        }
        
        var randomIndex = Math.floor(Math.random() * factionUnits.length);
        unitClass = factionUnits[randomIndex];
        
        // Automatic training is FREE - no resource consumption
        // Units are included in garrison building cost
        // Only surplus food check is required (already validated above)
      }
      
      // Spawn location
      var sp = self.plot[7] || self.plot[0];
      var spCoords = getCenter(sp[0], sp[1]);
      
      
      if(unitClass){
        
        // Spawn the unit using global constructor
        var unitConstructor = global[unitClass];
        if(unitConstructor){
          try {
            var newUnit = unitConstructor({
              x:spCoords[0],
              y:spCoords[1],
              z:self.z || 0,
              house:house.id,
              kingdom:house.kingdom,
              home:{z:self.z || 0, loc:sp}
            });
            
            if(newUnit){
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
              
              if(global.console && global.console.log){
                console.log('[Garrison] Unit produced successfully', {
                  house: house.name,
                  unitClass: unitClass,
                  location: { x: newUnit.x, y: newUnit.y, z: newUnit.z }
                });
              }
            } else {
              if(global.console && global.console.log){
                console.log('[Garrison] Production failed: Unit constructor returned null', {
                  house: house.name,
                  unitClass: unitClass
                });
              }
            }
          } catch(error){
            if(global.console && global.console.error){
              console.error('[Garrison] Production failed: Error spawning unit', {
                house: house.name,
                unitClass: unitClass,
                error: error.message || error
              });
            }
          }
        } else {
          if(global.console && global.console.log){
            console.log('[Garrison] Production failed: Unit constructor not found', {
              house: house.name,
              unitClass: unitClass,
              available: Object.keys(global).filter(k => typeof global[k] === 'function' && k === unitClass)
            });
          }
        }
      } else {
        if(global.console && global.console.log){
          console.log('[Garrison] Production failed: No unit class determined', {
            house: house.name,
            progression: !!progression
          });
        }
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
        }
      } else if(owner.house){
        // Owner has a house
        var h = owner.house;
        ironOre = House.list[h].stores.ironore || 0;
        if(ironOre > 0){
          House.list[h].stores.ironore--;
          House.list[h].stores.iron = (House.list[h].stores.iron || 0) + 1;
        }
      } else {
        // Owner is a player
        ironOre = owner.stores.ironore || 0;
        if(ironOre > 0){
          owner.stores.ironore--;
          owner.stores.iron = (owner.stores.iron || 0) + 1;
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
// SPRITE_SIZES - Single source of truth for sprite sizes per entity class
// All sizes are hard-coded pixel values - no calculations, no complexity
const SPRITE_SIZES = {
  // Fauna
  'Falcon': 448,
  'Sheep': 64,
  'Deer': 64,
  'Boar': 64,
  'Wolf': 64,
  
  // Ships
  'FishingShip': 128,
  'CargoShip': 160,
  
  // Serfs
  'Serf': 96,
  'SerfM': 96,
  'SerfF': 96,
  
  // Most classes use 96px
  'Rogue': 96,
  'Trapper': 96,
  'Cutthroat': 96,
  'Hunter': 96,
  'Outlaw': 96,
  'Scout': 96,
  'Ranger': 96,
  'Swordsman': 96,
  'Archer': 96,
  'Horseman': 96,
  'MountedArcher': 96,
  'Hero': 96,
  'Footsoldier': 96,
  'Skirmisher': 96,
  'Cavalier': 96,
  'Templar': 96,
  'Hospitaller': 96,
  'Hochmeister': 96,
  'Priest': 96,
  'Monk': 96,
  'Prior': 96,
  'Bishop': 96,
  'Friar': 96,
  'Brother': 96,
  'Acolyte': 96,
  'Oathkeeper': 96,
  'Archbishop': 96,
  'Mage': 96,
  'Warlock': 96,
  'King': 96,
  'Alaric': 96,
  'Innkeeper': 96,
  'Shipwright': 96,
  'Blacksmith': 96,
  'Apparition': 96,
  'Goth': 96,
  'NorseSword': 96,
  'NorseSpear': 96,
  'Huskarl': 96,
  'Headhunter': 128,
  'Seidr': 64,
  'HighPriestess': 96,
  'Druid': 96,
  'Morrigan': 128,
  'Gwenllian': 64,
  'FrankSword': 64,
  'FrankSpear': 128,
  'FrankBow': 96,
  'TeutonPike': 128,
  'TeutonBow': 96,
  'CeltAxe': 96,
  'Condottiere': 128,
  
  // Classes that use 128px
  'Cavalry': 128,
  'Knight': 128,
  'Lancer': 128,
  'Crusader': 128,
  'CeltSpear': 128,
  'SwissGuard': 128,
  'Mangonel': 128,
  'Strongman': 128,
  'General': 128,
  'Warden': 128,
  'Poacher': 128,
  
  // Classes that use 192px (3x)
  'Charlemagne': 192,
  'ImperialKnight': 192,
  'TeutonicKnight': 192,
  'Cataphract': 192,
  'Carolingian': 192,
  'Marauder': 192,
  
  // Siege equipment
  'Trebuchet': 640,
  'Malvoisin': 768
};

/**
 * Get sprite size for an entity class
 * @param {string} entityClass - Entity class name
 * @returns {number} Sprite size in pixels
 */
function getSpriteSizeForClass(entityClass) {
  // Hard-coded values - no calculations, no complexity
  const size = SPRITE_SIZES[entityClass];
  if (size !== undefined && size !== null) {
    return size;
  }
  // Fallback: most entities are 96px, but this should rarely be used
  // If a class is missing from SPRITE_SIZES, it's a bug
  return 96;
}

Character = function(param){
  var self = Entity(param);
  const getLoc = (x, y, entity = self) => global.getLoc ? global.getLoc(x, y, entity) : [Math.floor(x / 64), Math.floor(y / 64)];
  const getTile = (l, c, r, entity = self) => global.getTile ? global.getTile(l, c, r, entity) : undefined;
  const isWalkable = (z, c, r, entity = self) => global.isWalkable ? global.isWalkable(z, c, r, entity) : false;
  self.zone = null;
  self.zGrid = null;
  self.type = 'npc';
  self.name = param.name || null; // Use param.name if provided, otherwise null
  self.sex = param.sex; // 'm' or 'f'
  self.house = param.house;
  self.kingdom = param.kingdom;
  self.home = param.home; // {z,loc}
  self.class = param.class || null; // Use param.class if provided, otherwise null
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
  // spriteSize will be calculated based on class in getInitPack()
  // Individual entity constructors can override it if needed
  // For now, set a placeholder - will be recalculated when class is set
  self.spriteSize = (typeof tileSize !== 'undefined' ? tileSize : 64) * 1.5; // Default for serfs, will be overridden by entity constructors
  self.facing = 'down';
  self.pressingRight = false;
  self.pressingLeft = false;
  self.pressingUp = false;
  self.pressingDown = false;
  self.pressingAttack = false;
  self.innaWoods = false;
  self.onMtn = false;
  self.hasTorch = false;
  
  // Initialize terrain-based properties based on spawn location
  // This ensures properties like innaWoods are set correctly on spawn
  if(self.z === 0 && typeof getLoc === 'function' && typeof getTile === 'function'){
    const loc = getLoc(self.x, self.y, self);
    const tile = getTile(0, loc[0], loc[1], self);
    // Heavy forest tiles (1.x range)
    if(tile >= 1 && tile < 2){
      if(self.class !== 'Falcon'){
        self.innaWoods = true;
      }
      self.onMtn = false;
    }
    // Mountain tiles (5.x range)
    else if(tile >= 5 && tile < 6){
      self.innaWoods = false;
      self.onMtn = true;
    }
  }
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
    const loc = getLoc(self.x, self.y, self);
    if (getTile(0, loc[0], loc[1], self) >= 5 && getTile(0, loc[0], loc[1], self) < 6) {
      // Mountain terrain - 20% speed
      self.currentSpeed = targetSpeed * 0.2;
    } else if (getTile(0, loc[0], loc[1], self) == 18) {
      // Road terrain - 110% speed
      self.currentSpeed = targetSpeed * 1.1;
    } else if (getTile(0, loc[0], loc[1], self) == 0) {
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

  // Ensure character context is set consistently (use explicit matchId if provided)
  if (global.mapContextHelpers) {
    let matchId = null;
    if (param.battlegroundMatchId) {
      matchId = param.battlegroundMatchId;
    } else if (param.matchId) {
      matchId = param.matchId;
    } else if (param.inBattleground && param.battlegroundMatchId) {
      matchId = param.battlegroundMatchId;
    }
    global.mapContextHelpers.setEntityContext(self, matchId);
  }
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
  const socialSystem = getSocialSystem();
  if (socialSystem) {
    self.socialProfile = socialSystem.initializeNPC(self);
  }
  
  self.die = function(report){ // report {id,cause}
    var deathLocation = getLoc(self.x, self.y, self);
    var deathZ = self.z;
    
    // Notify social system of death for witness recording
    const socialSystem = getSocialSystem();
    if (socialSystem) {
      socialSystem.recordDeathWitnessed(self.id, deathLocation, 1280);
      socialSystem.removeNPC(self.id);
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
    // Death broadcasts are now handled by EventManager.death() above (line 2028-2030)
    // No need to send duplicate messages here
    
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
        if(timeoutId) clearTimeout(timeoutId);
      });
      self.actionTimeouts = [];
    }
    
    // Clear any tracked timers (if timer tracking system is in use)
    if(self._trackedTimers && Array.isArray(self._trackedTimers)){
      self._trackedTimers.forEach(timerId => {
        if(timerId) {
          clearTimeout(timerId);
          clearInterval(timerId);
        }
      });
      self._trackedTimers = [];
    }
    
    // Clear any other common timer properties
    if(self.timeoutId) {
      clearTimeout(self.timeoutId);
      self.timeoutId = null;
    }
    if(self.intervalId) {
      clearInterval(self.intervalId);
      self.intervalId = null;
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
  self.preferredCaveEntrance = null; // Preferred entrance (from building.cave for mining)
  self.targetLoc = null; // Final destination during multi-step transitions
  
  // Explicit z-transition system
  self.transitionIntent = null; // 'enter_cave', 'exit_cave', 'enter_building', 'exit_building', etc.
  self.transitionState = 'none'; // 'none', 'at_entrance', 'transitioning'
  self.targetZLevel = null; // Destination z-level for cross-z navigation
  self.lastZTransition = null; // Timestamp of last z-level transition (prevents rapid loops for NPCs)
  self.zTransitionCooldown = 0; // Cooldown to prevent immediate re-pathing after z-transition (player only)
  self.zTransitionHalt = false; // If true, completely halt all path following until new click (player only)

  self.move = function(target){ // [c,r]
    // Safety check: NPCs should not move to water tiles (unless they're already underwater)
    if(self.type === 'npc' && self.z === 0 && !self.ghost && !self.isBoarded){
      var targetTile = getTile(0, target[0], target[1]);
      if(targetTile === 0){ // TERRAIN.WATER
        // Don't allow NPCs to move to water tiles
        return;
      }
    }
    
    self.working = false;
    self.farming = false;
    self.chopping = false;
    self.mining = false;
    
    // Snap to current tile center before creating path (prevents drift)
    var currentLoc = getLoc(self.x, self.y, self);
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

  self.shootArrow = function(targetIdOrAngle){
    self.pressingAttack = true;
    self.working = false;
    self.chopping = false;
    self.mining = false;
    self.farming = false;
    self.building = false;
    self.fishing = false;
    
    // Determine if input is targetId or angle (backward compatibility)
    var angle;
    var target = null;
    if(typeof targetIdOrAngle === 'string' || typeof targetIdOrAngle === 'number'){
      // Check if it's a target ID (entity exists in Player.list)
      target = Player.list[targetIdOrAngle];
      if(target){
        // Calculate angle to target
        angle = Math.atan2(target.y - self.y, target.x - self.x) * 180 / Math.PI;
      } else {
        // Treat as angle (backward compatibility)
        angle = targetIdOrAngle;
      }
    } else {
      // Default to facing angle if nothing provided
      angle = self.mouseAngle || 0;
    }
    
    // Only players consume arrows; NPCs have unlimited
    if(self.type === 'player'){
      self.inventory.arrows--;
    }
    Arrow({
      parent:self.id,
      angle:angle,
      x:self.x,
      y:self.y,
      z:self.z,
      target:target ? target.id : null // Store target ID for tracking
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

  self.zoneCheck = function(entityId){
    // Use entityId parameter or fall back to self.id
    const contextEntityId = entityId || self.id;
    var loc = getLoc(self.x,self.y,contextEntityId);
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
        var loc = getLoc(self.x, self.y, self);
        var pLoc = getLoc(p.x, p.y, p.id);
        
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
  // Use SimpleCombat.checkAggro() for all NPC aggro checks
  if(self.type === 'npc'){
    self.aggroInterval = setInterval(function(){
      if(global.simpleCombat && global.simpleCombat.checkAggro){
        global.simpleCombat.checkAggro(self);
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

  /**
   * Select cave entrance for pathfinding
   * Priority: preferredEntrance > existing caveEntrance > nearest to target > nearest to current position
   * 
   * @param {Object} entity - The entity needing cave entrance
   * @param {number} targetZ - Target z-level (-1 for entering cave)
   * @param {Array} targetLoc - Target location [col, row]
   * @param {Array} preferredEntrance - Preferred entrance (from building.cave for mining)
   * @returns {Array|null} - [col, row] cave entrance or null
   */
  function selectCaveEntrance(entity, targetZ, targetLoc, preferredEntrance) {
    // Priority 1: Use preferred entrance if provided (from building.cave for mining)
    if (preferredEntrance && Array.isArray(preferredEntrance) && preferredEntrance.length >= 2) {
      return preferredEntrance;
    }
    
    // Priority 2: Use existing caveEntrance if already set and valid
    if (entity.caveEntrance && Array.isArray(entity.caveEntrance) && entity.caveEntrance.length >= 2) {
      // Validate it still exists in global.caveEntrances
      if (global.caveEntrances && Array.isArray(global.caveEntrances)) {
        for (var i = 0; i < global.caveEntrances.length; i++) {
          var ent = global.caveEntrances[i];
          if (Array.isArray(ent) && ent.length >= 2 &&
              ent[0] === entity.caveEntrance[0] && ent[1] === entity.caveEntrance[1]) {
            return entity.caveEntrance;
          }
        }
      }
    }
    
    // Priority 3: Find nearest cave entrance to target location (for entering cave)
    if (targetZ === -1 && global.caveEntrances && Array.isArray(global.caveEntrances) && global.caveEntrances.length > 0) {
      var nearest = null;
      var bestDist = Infinity;
      var targetCoords = getCenter(targetLoc[0], targetLoc[1]);
      
      for (var i = 0; i < global.caveEntrances.length; i++) {
        var entrance = global.caveEntrances[i];
        if (!Array.isArray(entrance) || entrance.length < 2) continue;
        
        var entranceCoords = getCenter(entrance[0], entrance[1]);
        var dist = getDistance(
          { x: targetCoords[0], y: targetCoords[1] },
          { x: entranceCoords[0], y: entranceCoords[1] }
        );
        
        if (dist < bestDist) {
          bestDist = dist;
          nearest = entrance;
        }
      }
      
      if (nearest) {
        return nearest;
      }
    }
    
    // Priority 4: Find nearest to current position (for exit pathfinding fallback only)
    // NOTE: This should rarely be needed since caveEntrance should be set when entering
    // Only used as fallback if entity somehow got into cave without going through enterCave()
    if (entity.z === -1 && global.caveEntrances && Array.isArray(global.caveEntrances) && global.caveEntrances.length > 0) {
      var nearest = null;
      var bestDist = Infinity;
      
      for (var i = 0; i < global.caveEntrances.length; i++) {
        var entrance = global.caveEntrances[i];
        if (!Array.isArray(entrance) || entrance.length < 2) continue;
        
        var entranceCoords = getCenter(entrance[0], entrance[1]);
        var dist = getDistance(
          { x: entity.x, y: entity.y },
          { x: entranceCoords[0], y: entranceCoords[1] }
        );
        
        if (dist < bestDist) {
          bestDist = dist;
          nearest = entrance;
        }
      }
      
      if (nearest) {
        return nearest;
      }
    }
    
    return null;
  }

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
    
    // CRITICAL: Clear path immediately if z-level has changed
    // This prevents infinite loops when pathfinding after z-transition
    if(tz !== self.z){
      self.path = null;
      self.pathCount = 0;
      self.pathEnd = null;
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
              return;
            }
            tLoc = Building.list[tb].entrance;

            // Use pathfinding to reach the entrance instead of greedy movement
            if (self.shouldRequestPath(self.z, tLoc[0], tLoc[1])) {
              self.getPath(self.z, tLoc[0], tLoc[1]);
              if (self.path) {
                return;
              }
            }
          } else if(tz == -1){
            // Set intent to enter cave
            // CRITICAL: Prevent re-entry if serf just exited (within last 2 seconds) and is depositing
            var justExitedCave = self.lastZTransition && (Date.now() - self.lastZTransition < 2000);
            var isSerfClass = (self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF');
            if (isSerfClass && justExitedCave && self.serfState === 'depositing') {
              // Serf just exited and is depositing - don't allow re-entry
              // Pathfind on z=0 instead (will be handled by caller retrying with z=0)
              var serfLogger = global.serfLogger;
              if(serfLogger){
                serfLogger.debug(`[moveTo] Blocking cave re-entry: serf=${self.id} justExited=${justExitedCave} state=${self.serfState}`, self);
              }
              return; // Don't enter cave - caller should retry with z=0
            }
            
            self.transitionIntent = 'enter_cave';
            self.targetZLevel = -1;
            // #region agent log
            // #endregion
            
            // Store final destination for continuation after cave entry
            self.targetLoc = [tc, tr];
            
            // Select cave entrance (preferred from building.cave for mining, or nearest)
            var preferredEntrance = self.preferredCaveEntrance || null;
            var caveEntrance = selectCaveEntrance(self, tz, tLoc, preferredEntrance);
            
            // Clear preferred entrance after use (to avoid stale values)
            self.preferredCaveEntrance = null;
            
            if (caveEntrance && Array.isArray(caveEntrance) && caveEntrance.length >= 2) {
              // Store for later use (exit pathfinding)
              self.caveEntrance = caveEntrance;
              // Redirect target to cave entrance
              tLoc = caveEntrance;
              
              // Check cooldown for serfs (prevent immediate re-entry after exit)
              if (isSerfClass && self.mineExitCooldown > 0) {
                // Cooldown active - wait before pathfinding
                // Path will be requested again after cooldown expires
                // Don't clear intent, just delay pathfinding
                // Note: targetLoc is preserved for retry after cooldown
                return;
              }

              // Use pathfinding to reach the entrance instead of greedy movement
              if (self.shouldRequestPath(self.z, tLoc[0], tLoc[1])) {
                self.getPath(self.z, tLoc[0], tLoc[1]);
                if (self.path) {
                  return;
                }
              }
            } else {
              // No cave entrance found - cannot path to cave
              self.targetLoc = null;
              return;
            }
          }
        } else if(self.z == -1 && tz == 0){
          // Exiting cave (z=-1 to z=0) - use multi-z pathfinding if available
          // Check if we should use multi-z pathfinding (for complex journeys like dropoff locations)
          // Multi-z pathfinding will handle: exit cave -> path to final destination
          var shouldUseMultiZ = Math.abs(tz - self.z) >= 1;
          if(shouldUseMultiZ){
            // Use multi-z pathfinding - call getPath directly with target z-level
            // This will trigger multi-z pathfinding which handles: exit cave -> path to final destination
            if(self.shouldRequestPath(tz, tLoc[0], tLoc[1])){
              self.getPath(tz, tLoc[0], tLoc[1]);
            }
            return;
          } else {
            // Legacy single-step exit: Set intent and pathfind to exit tile, let transition detection handle actual transition
            self.transitionIntent = 'exit_cave';
            self.targetZLevel = 0;
            
            // Use stored caveEntrance (set by enterCave() when entering)
            // Exit is always one tile south of the entrance
            if(self.caveEntrance && Array.isArray(self.caveEntrance) && self.caveEntrance.length >= 2){
              tLoc = [self.caveEntrance[0], self.caveEntrance[1] + 1]; // Cave exit is one tile south
            } else {
              // Fallback: find nearest cave entrance (shouldn't happen if enterCave() was called)
              var nearestEntrance = selectCaveEntrance(self, tz, tLoc, null);
              if(nearestEntrance && Array.isArray(nearestEntrance) && nearestEntrance.length >= 2){
                self.caveEntrance = nearestEntrance; // Store for future use
                tLoc = [nearestEntrance[0], nearestEntrance[1] + 1];
              } else {
                // No cave entrance found - cannot exit
                if(self.type === 'npc' && (self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF')){
                  var serfLogger = global.serfLogger;
                  if(serfLogger){
                    serfLogger.warn(`[moveTo] Cannot exit cave - no entrance found: serf=${self.id} z=${self.z}->${tz}`, self);
                  }
                }
                return;
              }
            }
            
            // Pathfind to the cave exit tile (like building exits pathfind to door)
            if(self.shouldRequestPath(-1, tLoc[0], tLoc[1])){
              self.getPath(-1, tLoc[0], tLoc[1]);
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
              self.z = 1;
              self.path = null;
              self.pathCount = 0;
              return;
            }
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
                self.z = 0;
                self.path = null;
                self.pathCount = 0;
                return;
              }
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
                  return;
                }
                tLoc = Building.list[b].ustairs;
              } else if(tz == -2){
                self.transitionIntent = 'go_to_cellar';
                self.targetZLevel = -2;
                
                if(!Building.list[b] || !Building.list[b].dstairs){
                  return;
                }
                tLoc = Building.list[b].dstairs;
              }
            } else {
              // Moving to different building - exit current building first
              if(!b || !Building.list[b] || !Building.list[b].entrance){
                // Cannot find building - force to ground level as emergency fallback
                if(!b){
                  self.z = 0;
                  self.path = null;
                  self.pathCount = 0;
                  return;
                }
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
                var loc = getLoc(self.x, self.y, self);
                self.z = 1;
                self.path = null;
                self.pathCount = 0;
                return;
              }
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
                  var loc = getLoc(self.x, self.y, self);
                  self.z = 1;
                  self.path = null;
                  self.pathCount = 0;
                  return;
                }
                return;
              }
              tLoc = Building.list[b].ustairs;
            }
          }
        } else if(self.z == -3){
          //
        } else {
          // Unhandled z-transition - should call getPath for multi-z pathfinding
          if(self.shouldRequestPath(tz, tLoc[0], tLoc[1])){
            self.getPath(tz, tLoc[0], tLoc[1]);
            return;
          }
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
      if(global.mapContextHelpers && !global.mapContextHelpers.areInSameContext(self, item)) continue;
      
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
    
    // ===== CRITICAL: Track z-level at start of update =====
    // This allows us to detect z-level changes and stop movement immediately
    var previousZ = self.z;
    
    // ===== NEW: Using prototype methods =====
    Character.prototype.updateStealthMechanics.call(this);
    Character.prototype.updateTorchBearer.call(this);
    Character.prototype.updateCooldowns.call(this);
    
    // ===== CORE SETUP (lines 3725-3727) =====
    // Get current tile location and building
    var loc = getLoc(self.x,self.y);
    var b = getBuilding(self.x,self.y);
    self.zoneCheck();
    
    // ===== CRITICAL: Stop all movement if z-level changed =====
    // This MUST happen before any movement processing to prevent continued movement
    if(self.z !== previousZ){
      // Z-level changed - STOP ALL MOVEMENT IMMEDIATELY
      self.path = null;
      self.pathCount = 0;
      self.pathEnd = null;
      self.pressingRight = false;
      self.pressingLeft = false;
      self.pressingDown = false;
      self.pressingUp = false;
      self.transitionIntent = null;
      self.transitionState = 'none';
      // Don't return - continue with update for other systems, but no movement will occur
    }
    
    // OLD: ===== STEALTH MECHANICS (lines 3728-3733) =====
    // OLD: Stealthed characters have reduced drag (move slower), check for reveals
    // OLD: if(self.stealthed){
    // OLD:   self.drag = 0.5;
    // OLD:   self.revealCheck();
    // OLD: } else {
    // OLD:   self.drag = 1;
    // OLD: }
    
    // OLD: ===== TORCH BEARER AUTO-LIGHTING (lines 3734-3740) =====
    // OLD: Automatically light torch in dark areas (night, caves, cellars)
    // OLD: if(self.torchBearer){
    // OLD:   if(!self.hasTorch){
    // OLD:     if((self.z == 0 && nightfall) || self.z == -1 || self.z == -2){
    // OLD:       self.lightTorch(Math.random());
    // OLD:     }
    // OLD:   }
    // OLD: }
    
    // OLD: ===== COOLDOWN MANAGEMENT (lines 3741-3750) =====
    // OLD: Decrement various cooldown timers
    // OLD: if(self.idleTime > 0){
    // OLD:   self.idleTime--;
    // OLD: }
    // OLD: if(self.attackCooldown > 0){
    // OLD:   self.attackCooldown--;
    // OLD: }
    // OLD: Decrement mine exit cooldown for serfs
    // OLD: if(self.mineExitCooldown && self.mineExitCooldown > 0){
    // OLD:   self.mineExitCooldown--;
    // OLD: }
    
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

    // ===== PATH COMPLETION CHECK (before terrain transitions) =====
    // This ensures path is cleared BEFORE any z-transition can happen.
    // Without this, the stair transition code moves the player away from the destination,
    // and the path following code thinks it still needs to reach the destination, causing an infinite loop.
    // By checking path completion HERE, the path is marked complete BEFORE any position changes happen.
    if(self.type === 'player' && self.path && self.path.length > 0){
      var pathLoc = getLoc(self.x, self.y, self);
      var finalDest = self.path[self.path.length - 1];
      if(pathLoc[0] === finalDest[0] && pathLoc[1] === finalDest[1]){
        // Player has reached path destination - clear path immediately
        // This prevents the path from persisting after a z-transition moves the player
        self.path = null;
        self.pathCount = 0;
        self.pathEnd = null;
        // Clear movement flags since we've arrived
        self.pressingRight = false;
        self.pressingLeft = false;
        self.pressingDown = false;
        self.pressingUp = false;
        
        // If player was in combat and autoAttackPaused was set, resume auto-attack
        // This allows players to navigate during combat and resume attacking when path completes
        // Only resume if player still has a combat target within range
        if(self.action === 'combat' && self.autoAttackPaused){
          // Check if player still has a valid combat target
          var hasValidTarget = false;
          if(self.combatState && self.combatState.target){
            var targetId = self.combatState.target;
            var target = global.Player.list[targetId];
            if(!target && global.Character && global.Character.list){
              target = global.Character.list[targetId];
            }
            
            if(target && global.simpleCombat){
              // Check if target is still valid and within range
              var distance = global.simpleCombat.getDistance(self, target);
              var attackRange = global.simpleCombat.getAttackRange(self);
              
              // Use small tolerance (1 pixel) to account for floating point precision
              var rangeTolerance = 1;
              if(distance <= attackRange + rangeTolerance){
                hasValidTarget = true;
              }
            }
          }
          
          // Resume auto-attack if target is still valid and within range
          if(hasValidTarget){
            self.autoAttackPaused = false;
            // Clear any resume timeout
            if(self._autoAttackResumeTimeout){
              clearTimeout(self._autoAttackResumeTimeout);
              self._autoAttackResumeTimeout = null;
            }
          }
        }
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
        // Don't auto-set if zTransitionHalt is active (prevents infinite loops after z-transition)
        if(self.type === 'player' && !self.zTransitionHalt){
          self.transitionIntent = 'enter_cave';
        }
        // For idle NPCs, allow transition if they have intent set (from idle wandering logic)
        else if(self.type === 'npc' && self.mode === 'idle' && !self.transitionIntent){
          // If idle NPC is on cave entrance but doesn't have intent yet, set it (fallback)
          if(!self.lastZTransition || (Date.now() - self.lastZTransition > 2000)){
            self.transitionIntent = 'enter_cave';
          }
        }
        
        // Check intent to enter cave (cooldown check moved to moveTo())
        // For idle NPCs, allow transition even if not at path destination
        var canTransition = false;
        if(self.type === 'player'){
          canTransition = !self.zTransitionHalt && self.isAtPathDestination();
        } else if(self.type === 'npc' && self.mode === 'idle'){
          canTransition = true; // Idle NPCs can transition when on cave entrance
        } else {
          canTransition = self.isAtPathDestination();
        }
        
        if(self.transitionIntent === 'enter_cave' && canTransition){
          // Store target location before entering (for continuation after entry)
          var previousTargetZ = self.targetZLevel;
          var previousTargetLoc = self.targetLoc;
          
          self.enterCave(loc);
          
          // If we were pathfinding to a location in the cave, continue pathfinding
          if(previousTargetZ === -1 && previousTargetLoc && Array.isArray(previousTargetLoc) && previousTargetLoc.length >= 2){
            // Clear transition intent since we've entered
            self.transitionIntent = null;
            self.targetZLevel = null;
            // Continue pathfinding to final destination in cave
            self.moveTo(-1, previousTargetLoc[0], previousTargetLoc[1]);
            // Clear stored target after use
            self.targetLoc = null;
          }
        }
      } else if(getTile(0,loc[0],loc[1]) >= 1 && getTile(0,loc[0],loc[1]) < 2){
        if(self.class !== 'Falcon'){
          self.innaWoods = true;
        }
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
      } else if(getTile(0,loc[0],loc[1], self) >= 4 && getTile(0,loc[0],loc[1], self) < 5){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.6) * self.drag;
      } else if(getTile(0,loc[0],loc[1], self) >= 5 && getTile(0,loc[0],loc[1], self) < 6 && !self.onMtn){
        self.innaWoods = false;
        self.maxSpd = (self.baseSpd * 0.2) * self.drag;
        setTimeout(function(){
          // Check CURRENT location, not stale loc from 2 seconds ago
          var currentLoc = getLoc(self.x, self.y, self);
          if(getTile(0,currentLoc[0],currentLoc[1], self) >= 5 && getTile(0,currentLoc[0],currentLoc[1], self) < 6){
            self.onMtn = true;
          }
        },2000);
      } else if(getTile(0,loc[0],loc[1], self) >= 5 && getTile(0,loc[0],loc[1], self) < 6 && self.onMtn){
        self.maxSpd = (self.baseSpd * 0.5) * self.drag;
      } else if(getTile(0,loc[0],loc[1], self) == 18){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 1.1) * self.drag;
      } else if(getTile(0,loc[0],loc[1], self) == 14 || getTile(0,loc[0],loc[1], self) == 16 || getTile(0,loc[0],loc[1], self) == 19){
        // At building door - set state
        self.transitionState = 'at_entrance';
        
        // Players: automatic (backward compatibility)
        // Don't auto-set if zTransitionHalt is active (prevents infinite loops after z-transition)
        if(self.type === 'player' && !self.zTransitionHalt){
          self.transitionIntent = 'enter_building';
        }
        // For idle NPCs, allow transition if they have intent set (from idle wandering logic)
        else if(self.type === 'npc' && self.mode === 'idle' && !self.transitionIntent){
          // If idle NPC is on building door but doesn't have intent yet, set it (fallback)
          if(!self.lastZTransition || (Date.now() - self.lastZTransition > 2000)){
            self.transitionIntent = 'enter_building';
          }
        }
        
        // Check intent to enter building
        // Also verify zTransitionHalt is not active (second layer of protection)
        // For idle NPCs, allow transition even if not at path destination
        var canTransition = false;
        if(self.type === 'player'){
          canTransition = !self.zTransitionHalt && self.isAtPathDestination();
        } else if(self.type === 'npc' && self.mode === 'idle'){
          canTransition = true; // Idle NPCs can transition when on building door
        } else {
          canTransition = self.isAtPathDestination();
        }
        
        if(self.transitionIntent === 'enter_building' && canTransition){
          self.enterBuilding(b);
        }
      } else if(getTile(0,loc[0],loc[1]) == 0 && !self.ghost && !self.isBoarded){
        // Ghosts cannot go underwater, and boarded players should not enter water
        // At water tile - set state
        self.transitionState = 'at_entrance';
        
        // For players, auto-set intent (backward compatibility)
        // Don't auto-set if zTransitionHalt is active (prevents infinite loops after z-transition)
        if(self.type === 'player' && !self.zTransitionHalt){
          self.transitionIntent = 'enter_water';
        }
        
        // NPCs automatically enter water when they step on it (no intent needed)
        // Players need intent for backward compatibility
        if(self.transitionIntent === 'enter_water' || self.type === 'npc'){
          self.enterWater();
        }
      } else {
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd  * self.drag;
      }
    } else if(self.z == -1){
      var tileValue = getTile(1,loc[0],loc[1]);
      if(tileValue == 2){
        // At cave exit - set state
        self.transitionState = 'at_entrance';
        
        // For players, auto-set intent (backward compatibility)
        // Don't auto-set if zTransitionHalt is active (prevents infinite loops after z-transition)
        if(self.type === 'player' && !self.zTransitionHalt){
          self.transitionIntent = 'exit_cave';
        }
        // For idle NPCs, allow transition if they have intent set (from idle wandering logic)
        else if(self.type === 'npc' && self.mode === 'idle' && !self.transitionIntent){
          // If idle NPC is on cave exit but doesn't have intent yet, set it (fallback)
          if(!self.lastZTransition || (Date.now() - self.lastZTransition > 2000)){
            self.transitionIntent = 'exit_cave';
          }
        }
        // For serfs in work mode, ensure intent is set if not already set
        else if(self.type === 'npc' && (self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF') && self.mode === 'work' && !self.transitionIntent){
          // Serf in work mode at exit - should have intent from moveTo(), but set it if missing
          self.transitionIntent = 'exit_cave';
        }
        
        // Check intent to exit cave
        // Also verify zTransitionHalt is not active (second layer of protection)
        // For NPCs (including serfs), allow transition when at exit tile even if path doesn't match exactly
        // This handles cases where path was cleared or pathfinding completed but destination doesn't match
        var canTransition = false;
        if(self.type === 'player'){
          canTransition = !self.zTransitionHalt && self.isAtPathDestination();
        } else if(self.type === 'npc'){
          // NPCs (including serfs) can transition when at exit tile, even if path doesn't match
          // Check if we're at the exit tile (tile value 2 on layer 1)
          var atExitTile = (getTile(1, loc[0], loc[1]) == 2);
          // Also check if path destination matches (for cases where path is still valid)
          var pathMatches = self.isAtPathDestination();
          // For serfs with exit intent, prioritize atExitTile check - if at exit tile, transition immediately
          if((self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF') && self.transitionIntent === 'exit_cave'){
            // Serfs: if at exit tile with exit intent, transition immediately (don't wait for path match)
            canTransition = atExitTile || pathMatches;
            
            // Log transition check for serfs
            var serfLogger = global.serfLogger;
            if(serfLogger){
              serfLogger.debug(`[TRANSITION_CHECK] serf=${self.id} z=${self.z} loc=[${loc[0]},${loc[1]}] intent=${self.transitionIntent} atExitTile=${atExitTile} pathMatches=${pathMatches} canTransition=${canTransition} path=${self.path?.length || 0}`, self);
            }
          } else {
            // Other NPCs: use same logic
            canTransition = atExitTile || pathMatches;
          }
        } else {
          canTransition = self.isAtPathDestination();
        }
        
        if(self.transitionIntent === 'exit_cave' && canTransition){
          self.exitCave();
        }
        // If no intent or has path, stay in cave
      }
    } else if(self.z == -2){
      if(getTile(8,loc[0],loc[1]) == 5){
        // At cellar stairs - set state
        self.transitionState = 'at_entrance';
        
        // Players: automatic (backward compatibility)
        // Don't auto-set if zTransitionHalt is active (prevents infinite loops after z-transition)
        if(self.type === 'player' && !self.zTransitionHalt){
          self.transitionIntent = 'go_upstairs_cellar';
        }
        // For idle NPCs, allow transition if they have intent set (from idle wandering logic)
        else if(self.type === 'npc' && self.mode === 'idle' && !self.transitionIntent){
          // If idle NPC is on cellar stairs but doesn't have intent yet, set it (fallback)
          if(!self.lastZTransition || (Date.now() - self.lastZTransition > 2000)){
            self.transitionIntent = 'go_upstairs_cellar';
          }
        }
        
        // Check intent to go upstairs from cellar
        // Also verify zTransitionHalt is not active (second layer of protection)
        // For idle NPCs, allow transition even if not at path destination
        var canTransition = false;
        if(self.type === 'player'){
          canTransition = !self.zTransitionHalt && self.isAtPathDestination();
        } else if(self.type === 'npc' && self.mode === 'idle'){
          canTransition = true; // Idle NPCs can transition when on cellar stairs
        } else {
          canTransition = self.isAtPathDestination();
        }
        
        if(self.transitionIntent === 'go_upstairs_cellar' && canTransition){
          self.goDownstairs(1); // Yes, goDownstairs(1) goes UP from cellar to floor 1
        }
      }
    } else if(self.z == -3){
      // In battlegrounds, prevent drowning deaths (player should be spawned at correct z)
      if(self.inBattleground && self.battlegroundMatchId){
        // Don't process drowning in battlegrounds - this shouldn't happen
        // If player is underwater in battleground, it's a spawn bug, not a drowning
        // Just surface them immediately
        if(getTile(0,loc[0],loc[1]) != 0){
          self.transitionState = 'at_entrance';
          if(self.type === 'player' && !self.zTransitionHalt){
            self.transitionIntent = 'surface_water';
          }
          if(self.transitionIntent === 'surface_water'){
            self.surfaceFromWater();
          }
        }
        return;
      }
      
      if(self.breath > 0){
        self.breath -= 0.25;
      } else {
        self.hp -= 0.5;
      }
      if(self.hp !== null && self.hp <= 0){
        // Check if already dead to prevent repeated deaths
        if(self.inBattleground && self.inBattlegroundDead){
          return; // Already dead in battleground
        }
        self.die({cause:'drowned'});
      }
      if(getTile(0,loc[0],loc[1]) != 0){
        // At land tile while underwater - set state
        self.transitionState = 'at_entrance';
        
        // For players, auto-set intent (backward compatibility)
        // Don't auto-set if zTransitionHalt is active (prevents infinite loops after z-transition)
        if(self.type === 'player' && !self.zTransitionHalt){
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
        // Don't auto-set if zTransitionHalt is active (prevents infinite loops after z-transition)
        if(self.type === 'player' && !self.zTransitionHalt){
          self.transitionIntent = 'exit_building';
        }
        // For idle NPCs, allow transition if they have intent set (from idle wandering logic)
        else if(self.type === 'npc' && self.mode === 'idle' && !self.transitionIntent){
          // If idle NPC is on building exit but doesn't have intent yet, set it (fallback)
          if(!self.lastZTransition || (Date.now() - self.lastZTransition > 2000)){
            self.transitionIntent = 'exit_building';
          }
        }
        
        // Check intent to exit building
        // Also verify zTransitionHalt is not active (second layer of protection)
        // For idle NPCs, allow transition even if not at path destination
        var canTransition = false;
        if(self.type === 'player'){
          canTransition = !self.zTransitionHalt && self.isAtPathDestination();
        } else if(self.type === 'npc' && self.mode === 'idle'){
          canTransition = true; // Idle NPCs can transition when on building exit
        } else {
          canTransition = self.isAtPathDestination();
        }
        
        if(self.transitionIntent === 'exit_building' && canTransition){
          var exit = getBuilding(self.x,self.y-tileSize);
          self.exitBuilding(exit);
        }
      } else if(getTile(4,loc[0],loc[1]) == 3 || getTile(4,loc[0],loc[1]) == 4 || getTile(4,loc[0],loc[1]) == 7){
        // At upstairs tile - set state
        self.transitionState = 'at_entrance';
        
        // For players, auto-set intent (backward compatibility)
        // Don't auto-set if zTransitionHalt is active (prevents infinite loops after z-transition)
        if(self.type === 'player' && !self.zTransitionHalt){
          self.transitionIntent = 'go_upstairs';
        }
        // For idle NPCs, allow transition if they have intent set (from idle wandering logic)
        // This allows NPCs to naturally wander upstairs during idle mode
        else if(self.type === 'npc' && self.mode === 'idle' && !self.transitionIntent){
          // If idle NPC is on stairs but doesn't have intent yet, set it (fallback)
          // This handles cases where NPC wandered onto stairs before the idle logic set intent
          if(!self.lastZTransition || (Date.now() - self.lastZTransition > 2000)){
            self.transitionIntent = 'go_upstairs';
          }
        }
        
        // Check intent to go upstairs
        // Also verify zTransitionHalt is not active (second layer of protection)
        // For idle NPCs, allow transition even if not at path destination (they may have wandered onto stairs)
        var canTransition = false;
        if(self.type === 'player'){
          canTransition = !self.zTransitionHalt && self.isAtPathDestination();
        } else if(self.type === 'npc' && self.mode === 'idle'){
          // Idle NPCs can transition when on stairs, regardless of path destination
          canTransition = true;
        } else {
          canTransition = self.isAtPathDestination();
        }
        
        if(self.transitionIntent === 'go_upstairs' && canTransition){
          self.goUpstairs();
          // Transition time is tracked in goUpstairs() to prevent rapid loops
        }
      } else if(getTile(4,loc[0],loc[1]) == 5 || getTile(4,loc[0],loc[1]) == 6){
        // At cellar stairs - set state
        self.transitionState = 'at_entrance';
        
        // For players, auto-set intent (backward compatibility)
        // Don't auto-set if zTransitionHalt is active (prevents infinite loops after z-transition)
        if(self.type === 'player' && !self.zTransitionHalt){
          self.transitionIntent = 'go_to_cellar';
        }
        // For idle NPCs, allow transition if they have intent set (from idle wandering logic)
        else if(self.type === 'npc' && self.mode === 'idle' && !self.transitionIntent){
          // If idle NPC is on cellar stairs but doesn't have intent yet, set it (fallback)
          if(!self.lastZTransition || (Date.now() - self.lastZTransition > 2000)){
            self.transitionIntent = 'go_to_cellar';
          }
        }
        
        // Check intent to go to cellar
        // Also verify zTransitionHalt is not active (second layer of protection)
        // For idle NPCs, allow transition even if not at path destination
        var canTransition = false;
        if(self.type === 'player'){
          canTransition = !self.zTransitionHalt && self.isAtPathDestination();
        } else if(self.type === 'npc' && self.mode === 'idle'){
          canTransition = true; // Idle NPCs can transition when on cellar stairs
        } else {
          canTransition = self.isAtPathDestination();
        }
        
        if(self.transitionIntent === 'go_to_cellar' && canTransition){
          self.goDownstairs(-2);
        }
      }
    } else if(self.z == 2){
      if(getTile(4,loc[0],loc[1]) == 3 || getTile(4,loc[0],loc[1]) == 4){
        // At downstairs tile - set state
        self.transitionState = 'at_entrance';
        
        // For players, auto-set intent (backward compatibility)
        // Don't auto-set if zTransitionHalt is active (prevents infinite loops after z-transition)
        if(self.type === 'player' && !self.zTransitionHalt){
          self.transitionIntent = 'go_downstairs';
        }
        // For idle NPCs, allow transition if they have intent set (from idle wandering logic)
        // This allows NPCs to naturally wander downstairs during idle mode
        else if(self.type === 'npc' && self.mode === 'idle' && !self.transitionIntent){
          // If idle NPC is on stairs but doesn't have intent yet, set it (fallback)
          // This handles cases where NPC wandered onto stairs before the idle logic set intent
          if(!self.lastZTransition || (Date.now() - self.lastZTransition > 2000)){
            self.transitionIntent = 'go_downstairs';
          }
        }
        
        // Check intent to go downstairs
        // Also verify zTransitionHalt is not active (second layer of protection)
        // For idle NPCs, allow transition even if not at path destination (they may have wandered onto stairs)
        var canTransition = false;
        if(self.type === 'player'){
          canTransition = !self.zTransitionHalt && self.isAtPathDestination();
        } else if(self.type === 'npc' && self.mode === 'idle'){
          // Idle NPCs can transition when on stairs, regardless of path destination
          canTransition = true;
        } else {
          canTransition = self.isAtPathDestination();
        }
        
        if(self.transitionIntent === 'go_downstairs' && canTransition){
          self.goDownstairs(1);
          // Transition time is tracked in goDownstairs() to prevent rapid loops
        }
      }
    }
    
    // Track if z-level changed (used later for movement processing)
    var zLevelChanged = (self.z !== previousZ);
    
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
        // Check if home exists before accessing (Battlegrounds NPCs may not have home)
        if(self.home && self.home.loc){
          var cHome = getCenter(self.home.loc[0],self.home.loc[1]);
          var hDist = self.getDistance({x:cHome[0],y:cHome[1]});
          if(hDist > self.wanderRange){
            if(!self.path){
              self.return();
            }
          } else if(self.idleTime == 0){
          if(!self.path){
            // Check if NPC is on any transition tile and should transition
            var shouldTransition = false;
            
            // Only transition if not recently transitioned (prevent loops)
            var canTransition = !self.lastZTransition || (Date.now() - self.lastZTransition > 2000);
            
            if(canTransition){
              // On z=0: check for cave entrance or building door
              if(self.z == 0){
                var tile0 = getTile(0, loc[0], loc[1]);
                if(tile0 == 6){
                  // At cave entrance - allow transition
                  self.transitionIntent = 'enter_cave';
                  shouldTransition = true;
                } else if(tile0 == 14 || tile0 == 16 || tile0 == 19){
                  // At building door - allow transition
                  self.transitionIntent = 'enter_building';
                  shouldTransition = true;
                }
              }
              // On z=-1: check for cave exit
              else if(self.z == -1){
                var tile1 = getTile(1, loc[0], loc[1]);
                if(tile1 == 2){
                  // At cave exit - allow transition
                  self.transitionIntent = 'exit_cave';
                  shouldTransition = true;
                }
              }
              // On z=1: check for building exit, upstairs stairs, or cellar stairs
              else if(self.z == 1){
                // Check for building exit (tile north of current position)
                var exitTile = getTile(0, loc[0], loc[1] - 1);
                if(exitTile == 14 || exitTile == 16 || exitTile == 19){
                  // At building exit - allow transition
                  self.transitionIntent = 'exit_building';
                  shouldTransition = true;
                } else {
                  // Check for stairs
                  var stairsTile = getTile(4, loc[0], loc[1]);
                  if(stairsTile == 3 || stairsTile == 4 || stairsTile == 7){
                    // On upstairs stairs - allow transition up
                    self.transitionIntent = 'go_upstairs';
                    shouldTransition = true;
                  } else if(stairsTile == 5 || stairsTile == 6){
                    // On cellar stairs - allow transition down
                    self.transitionIntent = 'go_to_cellar';
                    shouldTransition = true;
                  }
                }
              }
              // On z=2: check for downstairs stairs
              else if(self.z == 2){
                var stairsTile = getTile(4, loc[0], loc[1]);
                if(stairsTile == 3 || stairsTile == 4){
                  // On downstairs stairs - allow transition down
                  self.transitionIntent = 'go_downstairs';
                  shouldTransition = true;
                }
              }
              // On z=-2: check for cellar stairs
              else if(self.z == -2){
                var cellarStairsTile = getTile(8, loc[0], loc[1]);
                if(cellarStairsTile == 5){
                  // At cellar stairs - allow transition up
                  self.transitionIntent = 'go_upstairs_cellar';
                  shouldTransition = true;
                }
              }
            }
            
            // If transitioning, skip normal wandering this frame
            if(shouldTransition){
              self.idleTime += Math.floor(Math.random() * self.idleRange);
            } else {
              // Normal idle wandering
              var col = loc[0];
              var row = loc[1];
              var select = [[col,row-1],[col-1,row],[col,row+1],[col+1,row]];
              var target = select[Math.floor(Math.random() * 4)];
              if(target[0] < mapSize && target[0] > -1 && target[1] < mapSize && target[1] > -1){
                // Check if tile is walkable and not water (NPCs should avoid water during idle pathing)
                var targetTile = getTile(0, target[0], target[1]);
                var isWater = (targetTile === 0); // TERRAIN.WATER
                
                // Avoid all transition tiles during idle wandering to prevent getting stuck
                // (NPCs will transition when already on transition tiles, but won't seek them out)
                var isTransitionTile = false;
                if(self.z == 0){
                  // Avoid cave entrances and building doors
                  isTransitionTile = (targetTile == 6 || targetTile == 14 || targetTile == 16 || targetTile == 19);
                } else if(self.z == -1){
                  // Avoid cave exits
                  var targetTile1 = getTile(1, target[0], target[1]);
                  isTransitionTile = (targetTile1 == 2);
                } else if(self.z == 1){
                  // Avoid building exits (check tile north of target) and stairs
                  var exitTile = getTile(0, target[0], target[1] - 1);
                  var targetStairsTile = getTile(4, target[0], target[1]);
                  isTransitionTile = (exitTile == 14 || exitTile == 16 || exitTile == 19 || 
                                     targetStairsTile == 3 || targetStairsTile == 4 || 
                                     targetStairsTile == 5 || targetStairsTile == 6 || targetStairsTile == 7);
                } else if(self.z == 2){
                  // Avoid stairs
                  var targetStairsTile = getTile(4, target[0], target[1]);
                  isTransitionTile = (targetStairsTile == 3 || targetStairsTile == 4);
                } else if(self.z == -2){
                  // Avoid cellar stairs
                  var cellarStairsTile = getTile(8, target[0], target[1]);
                  isTransitionTile = (cellarStairsTile == 5);
                }
                
                if(isWalkable(self.z,target[0],target[1]) && !isWater && !isTransitionTile){
                  self.move(target);
                  self.idleTime += Math.floor(Math.random() * self.idleRange);
                }
              }
            }
          }
        }
        // End of if(self.home && self.home.loc) block
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
            // Get base center and radius (use baseRadius instead of territoryRadius)
            var baseCenter = house.baseCenterCoords;
            if (!baseCenter) {
              // Fallback to HQ if baseCenterCoords not set
              baseCenter = getCenter(house.hq[0], house.hq[1]);
            }
            var territoryRadius = house.baseRadius || (30 * tileSize); // Use baseRadius, default 30 tiles
            
            // Find all buildings within faction territory
            var buildingsInTerritory = [];
            
            for(var i = 0; i < house.patrolBuildings.length; i++){
              var bid = house.patrolBuildings[i];
              var b = Building.list[bid];
              
              if(!b || !b.built) continue;
              
              // Calculate distance from base center (not from unit)
              var dx = b.x - baseCenter[0];
              var dy = b.y - baseCenter[1];
              var distFromCenter = Math.sqrt(dx * dx + dy * dy);
              
              // Only consider buildings within faction territory
              if(distFromCenter <= territoryRadius){
                buildingsInTerritory.push(b);
              }
            }
            
            if(buildingsInTerritory.length === 0){
              // No buildings within territory, switch to idle
              if(self.mode !== 'idle'){
                self.mode = 'idle';
              }
              return;
            }
            
            // Pick a RANDOM building from those in territory (not nearest - avoids loops)
            var randomIndex = Math.floor(Math.random() * buildingsInTerritory.length);
            var targetBuilding = buildingsInTerritory[randomIndex];
            
            // Initialize stuck detection tracking
            if(!self.patrol.lastTarget){
              self.patrol.lastTarget = {building: null, tile: null, attempts: 0};
            }
            
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
            
            // Stuck detection: If same target for too long, try different building
            if(self.patrol.lastTarget.building === targetBuilding.id && 
               self.patrol.lastTarget.tile && 
               self.patrol.lastTarget.tile.toString() === buildingLoc.toString()){
              self.patrol.lastTarget.attempts++;
              if(self.patrol.lastTarget.attempts > 60){ // 1 second at 60fps
                // Try different building - clear this target and reset
                delete self.patrol.targetTiles[targetBuilding.id];
                self.patrol.lastTarget = {building: null, tile: null, attempts: 0};
                return; // Skip this frame, try again next frame
              }
            } else {
              // New target, reset counter
              self.patrol.lastTarget = {building: targetBuilding.id, tile: buildingLoc, attempts: 0};
            }
            
            // Check distance to chosen patrol tile instead of building center
            var patrolTileCenter = getCenter(buildingLoc[0], buildingLoc[1]);
            var patrolDist = self.getDistance({x: patrolTileCenter[0], y: patrolTileCenter[1]});
            
            // Check if arrived at patrol tile (within 2 tiles)
            if(patrolDist <= tileSize * 2){
              // Arrived - start idle timer
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
                  // Only call moveTo if we don't have a valid path already
                  if(!self.path || !self.pathEnd || 
                     self.pathEnd.loc[0] !== buildingLoc[0] || 
                     self.pathEnd.loc[1] !== buildingLoc[1] ||
                     self.pathEnd.z !== targetZ){
                    self.moveTo(targetZ, buildingLoc[0], buildingLoc[1]);
                  }
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
        // Add null check to prevent crash
        if(!self.scout || !self.scout.target){
          // Invalid scout state - reset to idle
          self.mode = 'idle';
          return;
        }
        var dest = self.scout.target;
        if(dest && loc && loc.toString() == dest.toString()){
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
      if (!self.raid || !self.raid.target) {
        return; // Can't raid without a target
      }
      
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
    
    // ===== CRITICAL: Skip movement processing if z-level changed =====
    // Don't process movement if z-level changed during this update
    if(!zLevelChanged){
      self.updatePosition();
    } else {
      // Z-level changed - just clear movement flags, don't process movement
      // Movement flags already cleared above, just ensure updatePosition doesn't run
    }
  }

  self.getPath = function(z,c,r){
    // Check pathfinding cooldown to prevent spam
    // EXCEPTION: Allow multi-z pathfinding requests to bypass cooldown (critical for navigation)
    // Also allow bypass when processing multi-z waypoints (recursive calls for waypoint navigation)
    const isMultiZTransition = z != self.z && Math.abs(z - self.z) >= 1;
    const isProcessingWaypoint = self.multiZWaypoints && self.multiZWaypoints.length > 0;
    if(self.pathCooldown && self.pathCooldown > 0 && !isMultiZTransition && !isProcessingWaypoint){
      return; // Skip pathfinding while on cooldown
    }
    
    self.pathEnd = {z:z,loc:[c,r]};
    self.pathLocked = false; // Clear path lock when starting new pathfinding
    const isBattleground = !!(self.inBattleground && self.battlegroundMatchId);
    var start = getLoc(self.x,self.y,self);
    var cst = getCenter(start[0],start[1]);
    var b = getBuilding(cst[0],cst[1]);
    var cd = getCenter(c,r);
    var db = getBuilding(cd[0],cd[1]);
    
    // Use multi-z pathfinding for complex journeys (including single-level transitions)
    var zDiff = Math.abs(z - self.z);
    var shouldUseMultiZ = z != self.z && zDiff >= 1;
    if(shouldUseMultiZ){
      var multiZPath = createMultiZPath(self.z, start, z, [c,r], self);
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
    
    if(z == self.z){
      if(self.z == 0){
        var isOnWater = getLocTile(0, self.x, self.y, self) == 0;
        var options = {};
        
        // Check if destination is a doorway
        var isTargetDoorway = !isBattleground && global.isDoorwayDestination(c, r, z);
        if (isTargetDoorway) {
          options.allowSpecificDoor = true;
          options.targetDoor = [c, r];
        }

        // Check if destination is a cave entrance (must be explicitly targeted)
        if (!isBattleground && global.caveEntrances && Array.isArray(global.caveEntrances)) {
          for (var i = 0; i < global.caveEntrances.length; i++) {
            var cave = global.caveEntrances[i];
            if (Array.isArray(cave) && cave[0] === c && cave[1] === r) {
              options.targetCaveEntrance = [c, r];
              options.avoidCaveEntrances = true;
              break;
            }
          }
        }
        
        // GHOST MODE: Allow ghosts to pathfind through water tiles
        if (self.ghost) {
          options.ghost = true;
          // If ghost is on water, allow the start tile
          if (isOnWater) {
            options.allowStartTile = start;
          }
        }
        
        // Ghosts on water use overworld pathfinding (layer 0) with ghost options
        // Non-ghosts on water use underwater pathfinding (layer 3)
        var pathLayer = (self.ghost && isOnWater) ? 0 : (isOnWater ? 3 : 0);
        var cacheOptions = Object.assign({ layer: pathLayer }, options);
        var cachedPath = getCachedPath(start, [c,r], z, self, cacheOptions);
        if(cachedPath){
          self.path = cachedPath;
          self.pathCount = 0; // Initialize path counter
          return;
        }
        var path = findPathContextAware(start, [c,r], pathLayer, options, self);
        if(path && path.length > 0){
          path = smoothPath(path, z);
          cachePath(start, [c,r], z, path, self, cacheOptions);
        }
        self.path = path;
        self.pathCount = 0; // Initialize path counter
      } else if(self.z == -1){
        // In cave - check if destination is a cave exit
        // Note: Cave exits on layer 1 are at entrance[0], entrance[1]+1 (one tile south of overworld entrance)
        var isTargetCaveExit = false;
        var isStartCaveExit = false;
        
        if(!isBattleground && caveEntrances && caveEntrances.length > 0){
          for(var i in caveEntrances){
            var ce = caveEntrances[i];
            if(ce[0] == c && ce[1] + 1 == r){
              isTargetCaveExit = true;
            }
            if(ce[0] == start[0] && ce[1] + 1 == start[1]){
              isStartCaveExit = true;
            }
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
        var cacheOptions = Object.assign({ layer: 1 }, options);
        var cachedPath = getCachedPath(start, [c,r], z, self, cacheOptions);
        if(cachedPath){
          self.path = cachedPath;
          self.pathCount = 0; // Initialize path counter
          return;
        }
        var path = findPathContextAware(start, [c,r], 1, options, self);
        if(path && path.length > 0){
          // DON'T smooth cave paths - caves have narrow tunnels and smoothing causes wall-walking
          cachePath(start, [c,r], z, path, self, cacheOptions);
        }
        self.path = path;
        self.pathCount = 0; // Initialize path counter
      } else if(self.z == -2){
        if(b == db){
          var cacheOptions = { layer: 8 };
          var cachedPath = getCachedPath(start, [c,r], z, self, cacheOptions);
          if(cachedPath){
            self.path = cachedPath;
            self.pathCount = 0; // Initialize path counter
            return;
          }
          var path = findPathContextAware(start, [c,r], 8, {}, self);
          if(path && path.length > 0){
            path = smoothPath(path, z);
            cachePath(start, [c,r], z, path, self, cacheOptions);
          }
          self.path = path;
          self.pathCount = 0; // Initialize path counter
        } else {
          // Safety check: ensure building exists and has dstairs
          if(!b || !Building.list[b] || !Building.list[b].dstairs){
            self.path = null;
            self.pathCount = 0;
            return;
          }
          //var gridB3b = cloneGrid(-2);
          var stairs = Building.list[b].dstairs;
          //var path = finder.findPath(start[0], start[1], stairs[0], stairs[1], gridB1b);
          //self.path = path;
          self.moveTo(stairs);
        }
      } else if(self.z == 1){
        if(b == db){
          // Use tilemap system for pathfinding on building floor 1 (layer 3)
          // Check if destination is stairs - if so, allow only that stairs tile
          var targetTile = global.getTile(4, c, r, self);
          var options = {};
          if(targetTile === 3 || targetTile === 4 || targetTile === 5 || targetTile === 6 || targetTile === 7){
            // Destination is stairs or upstairs/downstairs transition - allow only this tile
            options.targetStairs = [c, r];
            options.avoidStairs = true;
          }
          var cacheOptions = Object.assign({ layer: 3 }, options);
          var cachedPath = getCachedPath(start, [c,r], z, self, cacheOptions);
          if(cachedPath){
            self.path = cachedPath;
            self.pathCount = 0; // Initialize path counter
            return;
          }
          var path = findPathContextAware(start, [c,r], 3, options, self);
          if(path && path.length > 0){
            path = smoothPath(path, z);
            cachePath(start, [c,r], z, path, self, cacheOptions);
          }
          self.path = path;
          self.pathCount = 0; // Initialize path counter
        } else {
          // Moving to different building - path to exit first
          // Safety check: ensure building exists and has entrance
          if(!b || !Building.list[b] || !Building.list[b].entrance){
            self.path = null;
            self.pathCount = 0;
            return;
          }
          var exit = Building.list[b].entrance;
          // Use tilemap system for pathfinding on building floor 1 (layer 3)
          var cacheOptions = { layer: 3 };
          var cachedPath = getCachedPath(start, [exit[0],exit[1]+1], z, self, cacheOptions);
          if(cachedPath){
            self.path = cachedPath;
            self.pathCount = 0; // Initialize path counter
            return;
          }
          var path = findPathContextAware(start, [exit[0],exit[1]+1], 3, {}, self);
          if(path && path.length > 0){
            path = smoothPath(path, z);
            cachePath(start, [exit[0],exit[1]+1], z, path, self, cacheOptions);
          }
          self.path = path;
          self.pathCount = 0; // Initialize path counter
        }
      } else if(self.z == 2){
        if(b == db){
          // Use tilemap system for pathfinding on building floor 2 (layer 5)
          // Check if destination is stairs - if so, allow only that stairs tile
          var targetTile = global.getTile(4, c, r, self);
          var options = {};
          if(targetTile === 3 || targetTile === 4){
            // Destination is upstairs stairs - allow only this tile
            options.targetStairs = [c, r];
            options.avoidStairs = true;
          }
          var cacheOptions = Object.assign({ layer: 5 }, options);
          var cachedPath = getCachedPath(start, [c,r], z, self, cacheOptions);
          if(cachedPath){
            self.path = cachedPath;
            self.pathCount = 0; // Initialize path counter
            return;
          }
          var path = findPathContextAware(start, [c,r], 5, options, self);
          if(path && path.length > 0){
            path = smoothPath(path, z);
            cachePath(start, [c,r], z, path, self, cacheOptions);
          }
          self.path = path;
          self.pathCount = 0; // Initialize path counter
        } else {
          // Moving to different building - path to stairs first
          // Safety check: ensure building exists and has ustairs
          if(!b || !Building.list[b] || !Building.list[b].ustairs){
            self.path = null;
            self.pathCount = 0;
            return;
          }
          var stairs = Building.list[b].ustairs;
          // Use tilemap system for pathfinding on building floor 2 (layer 5)
          // Allow stairs as destination only
          var options = {
            targetStairs: stairs,
            avoidStairs: true
          };
          var cacheOptions = Object.assign({ layer: 5 }, options);
          var cachedPath = getCachedPath(start, stairs, z, self, cacheOptions);
          if(cachedPath){
            self.path = cachedPath;
            self.pathCount = 0; // Initialize path counter
            return;
          }
          var path = findPathContextAware(start, stairs, 5, options, self);
          if(path && path.length > 0){
            path = smoothPath(path, z);
            cachePath(start, stairs, z, path, self, cacheOptions);
          }
          self.path = path;
          self.pathCount = 0; // Initialize path counter
        }
      }
    } else {
      if(self.z == 0){ // outdoors
        if(z == -1){ // to cave
          // Use preferred entrance if set, otherwise find nearest
          var preferredEntrance = self.preferredCaveEntrance || null;
          var cave = selectCaveEntrance(self, z, [c, r], preferredEntrance);
          
          if(cave && Array.isArray(cave) && cave.length >= 2){
            // Store for later use (exit pathfinding)
            self.caveEntrance = cave;
            // When pathfinding to cave entrance, allow only the specific cave entrance
            var options = {
              targetCaveEntrance: [cave[0], cave[1]],
              avoidCaveEntrances: true
            };
            var cacheOptions = Object.assign({ layer: 0 }, options);
            var cachedPath = getCachedPath(start, [cave[0], cave[1]], z, self, cacheOptions);
            if(cachedPath){
              self.path = cachedPath;
            } else {
              var path = findPathContextAware(start, [cave[0], cave[1]], 0, options, self);
              if(path && path.length > 0){
                cachePath(start, [cave[0], cave[1]], z, path, self, cacheOptions);
              }
              self.path = path;
            }
          }
        } else { // to building
          var ent = Building.list[db].entrance;
          // When pathfinding to a building entrance, allow the specific doorway
          var options = {
            allowSpecificDoor: true,
            targetDoor: [ent[0], ent[1]]
          };
          var cacheOptions = Object.assign({ layer: 0 }, options);
          var cachedPath = getCachedPath(start, [ent[0], ent[1]], z, self, cacheOptions);
          if(cachedPath){
            self.path = cachedPath;
          } else {
            var path = findPathContextAware(start, [ent[0], ent[1]], 0, options, self);
            if(path && path.length > 0){
              cachePath(start, [ent[0], ent[1]], z, path, self, cacheOptions);
            }
            self.path = path;
          }
        }
      } else if(self.z == -1){ // cave
        // Use stored caveEntrance (set when entering) - exit is one tile south
        var cave = null;
        if(self.caveEntrance && Array.isArray(self.caveEntrance) && self.caveEntrance.length >= 2){
          cave = self.caveEntrance;
        } else {
          // Fallback: find nearest cave entrance (shouldn't happen if enterCave() was called)
          var best = null;
          for(i in caveEntrances){
            var e = getCoords(caveEntrances[i]);
            var d = self.getDistance({x:e[0],y:e[1]});
            if(!best || d < best){
              cave = caveEntrances[i];
              best = d;
            }
          }
          // Store for future use
          if(cave && Array.isArray(cave)){
            self.caveEntrance = cave;
          }
        }
        
        if(cave && Array.isArray(cave) && cave.length >= 2){
          // Path to the cave exit tile (which is at cave[0], cave[1]+1 on layer 1)
          var options = {
            allowSpecificDoor: true,
            targetDoor: [cave[0], cave[1] + 1]
          };
          // Use layer 1 for cave (worldMaps[1] = Underworld)
          var cacheOptions = Object.assign({ layer: 1 }, options);
          var cachedPath = getCachedPath(start, [cave[0], cave[1] + 1], z, self, cacheOptions);
          if(cachedPath){
            self.path = cachedPath;
          } else {
            var path = findPathContextAware(start, [cave[0], cave[1] + 1], 1, options, self);
            if(path && path.length > 0){
              cachePath(start, [cave[0], cave[1] + 1], z, path, self, cacheOptions);
            }
            self.path = path;
          }
        }
      } else if(self.z == 1){ // indoors
        //var gridB1b = cloneGrid(1);
        // Safety check: ensure building exists
        if(!b || !Building.list[b]){
          self.path = null;
          self.pathCount = 0;
          return;
        }
        if(b == db){
          if(z == 2){ // to upstairs
            // Safety check: ensure building has ustairs
            if(!Building.list[b].ustairs){
              self.path = null;
              self.pathCount = 0;
              return;
            }
            var stairs = Building.list[b].ustairs;
            //var path = finder.findPath(start[0], start[1], stairs[0], stairs[1], gridB1b);
            //self.path = path;
            self.moveTo(stairs);
          } else if(z == -2){ // to cellar/dungeon
            // Safety check: ensure building has dstairs
            if(!Building.list[b].dstairs){
              self.path = null;
              self.pathCount = 0;
              return;
            }
            var stairs = Building.list[b].dstairs;
            //var path = finder.findPath(start[0], start[1], stairs[0], stairs[1], gridB1b);
            //self.path = path;
            self.moveTo(stairs);
          } else { // outdoors
            // Safety check: ensure building has entrance
            if(!Building.list[b].entrance){
              self.path = null;
              self.pathCount = 0;
              return;
            }
            var exit = Building.list[b].entrance;
            //var path = finder.findPath(start[0], start[1], exit[0], exit[1]+1, gridB1b);
            //self.path = path;
            self.moveTo([exit[0],exit[1]+1]);
          }
        } else {
          // Safety check: ensure building has entrance
          if(!Building.list[b].entrance){
            self.path = null;
            self.pathCount = 0;
            return;
          }
          var exit = Building.list[b].entrance;
          //var path = finder.findPath(start[0], start[1], exit[0], exit[1]+1, gridB1b);
          //self.path = path;
          self.moveTo([exit[0],exit[1]+1]);
        }
      } else if(self.z == 2){ // upstairs
        // Safety check: ensure building exists and has ustairs
        if(!b || !Building.list[b] || !Building.list[b].ustairs){
          self.path = null;
          self.pathCount = 0;
          return;
        }
        //var gridB2b = cloneGrid(2);
        var stairs = Building.list[b].ustairs;
        //var path = finder.findPath(start[0], start[1], stairs[0], stairs[1], gridB2b);
        //self.path = path;
        self.moveTo(stairs);
      } else if(self.z == -2){ // cellar/dungeon
        // Safety check: ensure building exists and has dstairs
        if(!b || !Building.list[b] || !Building.list[b].dstairs){
          self.path = null;
          self.pathCount = 0;
          return;
        }
        //var gridB3b = cloneGrid(-2);
        var stairs = Building.list[b].dstairs;
        //var path = finder.findPath(start[0], start[1], stairs[0], stairs[1], gridB3b);
        //self.path = path;
        self.moveTo(stairs);
      } else if(self.z == -3){ // underwater
        // Use proper pathfinding for underwater (layer 2)
        var path = findPathContextAware(start, [c,r], 2, {}, self);
        if(path && path.length > 0){
          path = smoothPath(path, z);
          cachePath(start, [c,r], z, path, self);
        }
        self.path = path;
        self.pathCount = 0; // Initialize path counter
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
    self.z = -1;
    self.caveEntrance = entrance;
    self.path = null;
    self.pathCount = 0;
    self.pathEnd = null; // Clear path end to prevent re-navigation
    // Track transition time for NPCs to prevent rapid loops
    if(self.type === 'npc'){
      self.lastZTransition = Date.now();
    }
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
    var loc = getLoc(self.x, self.y, self);
    var preservedEntrance = self.caveEntrance; // Preserve for logging and potential future use
    if(self.type === 'npc' && (self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF')){
      var serfLogger = global.serfLogger;
      if(serfLogger){
        serfLogger.debug(`[exitCave] serf=${self.id} z=${self.z}->0 loc=[${loc[0]},${loc[1]}] entrance=${preservedEntrance ? '[' + preservedEntrance[0] + ',' + preservedEntrance[1] + ']' : 'null'}`, self);
      }
    }
    // Align with exitBuilding() pattern: clear path and let state machine re-request naturally
    self.z = 0;
    self.path = null;
    self.pathCount = 0;
    self.pathEnd = null; // Clear path end to prevent re-navigation (matches exitBuilding)
    // DON'T clear caveEntrance - preserve it for future exits
    self.transitionIntent = null;
    self.transitionState = 'none';
    // Track transition time for NPCs to prevent rapid loops
    if(self.type === 'npc'){
      self.lastZTransition = Date.now();
    }
    // Clear movement flags (matches exitBuilding pattern)
    if(!self.ghost){
      self.pressingRight = false;
      self.pressingLeft = false;
      self.pressingDown = false;
      self.pressingUp = false;
    }
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
    if(Building.list[buildingId]){
      Building.list[buildingId].occ++;
    }
    self.z = 1;
    self.path = null;
    // Track transition time for NPCs to prevent rapid loops
    if(self.type === 'npc'){
      self.lastZTransition = Date.now();
    }
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
    if(Building.list[buildingId]){
      Building.list[buildingId].occ--;
    }
    self.z = 0;
    self.path = null;
    // Track transition time for NPCs to prevent rapid loops
    if(self.type === 'npc'){
      self.lastZTransition = Date.now();
    }
    self.pathCount = 0;
    self.pathEnd = null; // Clear path end to prevent re-navigation
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
    self.clearAllMovement();
    self.y += (tileSize/2);
    self.facing = 'down';
    // Track transition time for NPCs to prevent rapid loops
    if(self.type === 'npc'){
      self.lastZTransition = Date.now();
    }
  };

  self.goDownstairs = function(targetZ) {
    self.z = targetZ; // Could be 1 or -2
    self.clearAllMovement();
    self.y += (tileSize/2);
    self.facing = 'down';
    // Track transition time for NPCs to prevent rapid loops
    if(self.type === 'npc'){
      self.lastZTransition = Date.now();
    }
  };

  // Helper function to clear all movement state
  // This should be called whenever z-layer changes to prevent infinite pathing loops
  self.clearAllMovement = function() {
    self.path = null;
    self.pathCount = 0;
    self.pathEnd = null;
    self.multiZWaypoints = null;
    self.currentWaypoint = 0;
    self.transitionIntent = null;
    self.transitionState = 'none';
    // Clear velocity to stop all movement immediately
    self.spdX = 0;
    self.spdY = 0;
    // Clear path recalculation state to prevent paths from being regenerated
    self.pathRecalcAttempts = 0;
    self.lastWaypoint = null;
    self.waypointStuckCounter = 0;
    self.waypointHistory = null;
    self.pathLocked = false;
    self.skippedWaypointCount = 0;
    // Set z-transition halt flag to completely stop path following (player only)
    // This prevents infinite loops when stairs move the player back toward the stair tile
    // The flag is only cleared when a NEW clickNavigate is received
    if(self.type === 'player'){
      self.zTransitionCooldown = 30; // ~0.5 seconds at 60fps
      self.zTransitionHalt = true; // Completely halt path following until new click
    }
    // Clear movement flags (except for ghosts)
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
    
    var loc = getLoc(self.x, self.y, self);
    var finalDest = self.path[self.path.length - 1];
    
    return loc[0] === finalDest[0] && loc[1] === finalDest[1];
  };

  self.enterWater = function() {
    self.z = -3;
    self.path = null;
    self.pathCount = 0;
    self.pathEnd = null; // Clear path end to prevent re-navigation
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
    self.pathEnd = null; // Clear path end to prevent re-navigation
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
      var loc = getLoc(self.x, self.y, self);
      if(self.z == currentWaypoint.z && loc.toString() == currentWaypoint.loc.toString()){
        
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
    
    // Handle z-transition halt for players (prevents infinite stair loops)
    // If zTransitionHalt is true, completely skip all path following
    // This flag is only cleared when a new clickNavigate is received
    if(self.type === 'player' && self.zTransitionHalt){
      // Decrement cooldown but keep halt active
      if(self.zTransitionCooldown > 0){
        self.zTransitionCooldown--;
      }
      // Skip all path processing - player must click somewhere new to move
      return;
    }
    
    if(self.path){
      if(self.pathCount < self.path.length){
        var next = self.path[self.pathCount];
        
        // Check if next waypoint is still walkable (prevent getting stuck in loops)
        var currentLoc = getLoc(self.x, self.y, self);
        var isNextBlocked = !isWalkable(self.z, next[0], next[1], self);
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
            // Serf observability (throttled)
            if(self.type === 'npc' && (self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF')){
              var serfLogger = global.serfLogger;
              var now = Date.now();
              if(serfLogger && (!self._serfStuckLogAt || (now - self._serfStuckLogAt > 5000))){
                serfLogger.warn('Path oscillation detected', self, { next, z: self.z, pathLen: self.path?.length || 0 });
                self._serfStuckLogAt = now;
              }
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
            
            // Serf observability (throttled)
            if(self.type === 'npc' && (self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF')){
              var serfLogger = global.serfLogger;
              var now = Date.now();
              if(serfLogger && (!self._serfStuckLogAt || (now - self._serfStuckLogAt > 5000))){
                serfLogger.warn('Pathfinding stuck', self, { reason, next, z: self.z, attempts: self.pathRecalcAttempts });
                self._serfStuckLogAt = now;
              }
            }
            
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
    
    // ===== NEW: Using prototype method =====
    Character.prototype.updateRegeneration.call(this);
    
    // OLD: ===== PASSIVE REGENERATION (lines 5366-5376) =====
    // OLD: HP and Spirit regeneration for all characters
    // OLD: Passive HP Regeneration for all characters (NPCs and Players)
    // OLD: if(!self.ghost && self.hp < self.hpMax){
    // OLD:   // Regenerate HP at ~0.0042 per frame = 0.25 HP/second at 60fps
    // OLD:   self.hp = Math.min(self.hp + 0.0042, self.hpMax);
    // OLD: }
    // OLD: 
    // OLD: // Passive Spirit Regeneration (if character has spirit)
    // OLD: if(!self.ghost && self.spirit && self.spiritMax && self.spirit < self.spiritMax){
    // OLD:   // Regenerate Spirit at ~0.0017 per frame = 0.1 Spirit/second at 60fps
    // OLD:   self.spirit = Math.min(self.spirit + 0.0017, self.spiritMax);
    // OLD: }
  }
  // ===== END FIRST CHARACTER UPDATE =====

  self.getInitPack = function(){
    // CRITICAL: Ensure fauna entities have both type and class set
    // If class indicates fauna but type is missing, set type to 'fauna'
    const faunaClasses = ['Deer', 'Boar', 'Wolf', 'Falcon', 'Sheep'];
    if (faunaClasses.includes(self.class) && self.type !== 'fauna') {
      console.warn('CRITICAL: Fauna class detected but type not set to "fauna" - fixing:', {
        id: self.id,
        class: self.class,
        currentType: self.type
      });
      self.type = 'fauna';
    }
    
    // CRITICAL: Validate that fauna entities always have a class property
    // Fauna entities (Deer, Boar, Wolf, Sheep, Falcon) must have class set for proper rendering
    if (self.type === 'fauna' && (!self.class || self.class === null || self.class === undefined)) {
      console.error('CRITICAL: Fauna entity missing class property in getInitPack:', {
        id: self.id,
        type: self.type,
        name: self.name
      });
      // Don't return incomplete pack - this will cause rendering issues on client
      // The entity should have class set by its constructor (Deer, Boar, Wolf, etc.)
    }
    
    // Set spriteSize from hard-coded lookup - only for Character entities
    // Items, Buildings, and other entities don't have a class property and don't need sprite sizes
    // CRITICAL: Include 'fauna' type (Deer, Boar, Wolf, Sheep, Falcon) - they are Character entities with classes
    if (self.class && (self.type === 'npc' || self.type === 'player' || self.type === 'ship' || self.type === 'fauna')) {
      self.spriteSize = getSpriteSizeForClass(self.class);
    }
    // For non-character entities, spriteSize is not needed - don't set it and don't warn
    
    var pack = {
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
      boardedShip:self.boardedShip,
      inBattleground: !!(self.inBattleground && self.battlegroundMatchId),
      battlegroundMatchId: self.battlegroundMatchId || null
    };
    // Add ship-specific properties if this is a ship OR if player is boarded on a ship
    if(self.shipType){
      pack.shipType = self.shipType;
      // Only include ship control properties if this entity is actually a ship
      if(self.type === 'ship'){
        pack.isPlayerControlled = self.isPlayerControlled;
        pack.owner = self.owner; // Include owner for ship ownership checks
      }
    }
    return pack;
  }

  self.getUpdatePack = function(){
    // Set spriteSize from hard-coded lookup - only for Character entities
    // Items, Buildings, and other entities don't have a class property and don't need sprite sizes
    // CRITICAL: Include 'fauna' type (Deer, Boar, Wolf, Sheep, Falcon) - they are Character entities with classes
    if (self.class && (self.type === 'npc' || self.type === 'player' || self.type === 'ship' || self.type === 'fauna')) {
      self.spriteSize = getSpriteSizeForClass(self.class);
    }
    // For non-character entities, spriteSize is not needed - don't set it
    
    var pack = {
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
      boardedShip:self.boardedShip,
      target:self.target,
      inBattleground: !!(self.inBattleground && self.battlegroundMatchId),
      battlegroundMatchId: self.battlegroundMatchId || null
    };
    // Add ship-specific properties if this is a ship OR if player is boarded on a ship
    if(self.shipType){
      pack.shipType = self.shipType;
      // Only include ship control properties if this entity is actually a ship
      if(self.type === 'ship'){
        pack.isPlayerControlled = self.isPlayerControlled;
        pack.owner = self.owner; // Include owner for ship ownership checks
      }
    }
    return pack;
  }

  Player.list[self.id] = self;

  const initPackData = self.getInitPack();
  initPack.player.push(initPackData);
  
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
    
    // Propagate: Add all of the other dock's associations
    for(var i = 0; i < otherDock.associatedDocks.length; i++) {
      var thirdDockId = otherDock.associatedDocks[i];
      if(thirdDockId !== self.id && !self.associatedDocks.includes(thirdDockId)) {
        self.associatedDocks.push(thirdDockId);
        var thirdDock = Building.list[thirdDockId];
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
  if(self.type !== 'dock') {
    return null;
  }
  
  // Check if shipIndex is valid
  if(!self.storedShips || shipIndex < 0 || shipIndex >= self.storedShips.length) {
    // Also check if ship is active in Player.list (not yet stored)
    // Try to find ship by owner in active ships at this dock
    for(var shipId in Player.list){
      var activeShip = Player.list[shipId];
      if(activeShip.type === 'ship' && activeShip.owner == playerId && (activeShip.lastDock === self.id || activeShip.dock === self.id)){
        return activeShip.id; // Return active ship ID instead of trying to retrieve
      }
    }
    return null;
  }
  
  var shipData = self.storedShips[shipIndex];
  
  // Verify player owns this ship (use == for type coercion, IDs might be string or number)
  if(shipData.owner != playerId) {
    return null;
  }
  
  // Remove from storage
  self.storedShips.splice(shipIndex, 1);
  
  // Respawn ship at dock entrance - find a water tile adjacent to dock
  var spawnCoords = null;
  var mapSize = global.mapSize || 1000;
  
  // Try to find a water tile adjacent to the dock plot
  for(var i = 0; i < self.plot.length; i++){
    var plotTile = self.plot[i];
    var adjacent = [
      [plotTile[0], plotTile[1] + 1],
      [plotTile[0], plotTile[1] - 1],
      [plotTile[0] - 1, plotTile[1]],
      [plotTile[0] + 1, plotTile[1]]
    ];
    for(var j = 0; j < adjacent.length; j++){
      var at = adjacent[j];
      if(at[0] >= 0 && at[0] < mapSize && at[1] >= 0 && at[1] < mapSize){
        if(getTile(0, at[0], at[1]) === 0){ // Water tile
          spawnCoords = getCenter(at[0], at[1]);
          break;
        }
      }
    }
    if(spawnCoords) break;
  }
  
  // Fallback to dock position if no water found
  if(!spawnCoords){
    var spawnLoc = self.plot[0] || getLoc(self.x, self.y, self);
    spawnCoords = getCenter(spawnLoc[0], spawnLoc[1]);
  }
  
  // Map shipType to constructor name (shipType is lowercase, constructors are PascalCase)
  var shipTypeMap = {
    'fishingship': 'FishingShip',
    'cargoship': 'CargoShip'
  };
  var constructorName = shipTypeMap[shipData.shipType] || shipData.shipType;
  
  // Recreate ship based on type
  var shipConstructor = global[constructorName];
  if(!shipConstructor) {
    return null;
  }
  
  var ship = shipConstructor({
    x: spawnCoords[0],
    y: spawnCoords[1],
    z: 0, // Overworld level (ships sail on z=0)
    owner: playerId,
    dock: self.id, // Set this dock as home dock
    house: self.house,
    kingdom: self.kingdom,
    mode: 'docked' // Start in docked mode
  });
  
  if(!ship) {
    return null;
  }
  
  // Verify ship is in Player.list
  if(!Player.list[ship.id]) {
    return null;
  }
  
  // Restore cargo
  if(shipData.cargo) {
    ship.stores = shipData.cargo;
  }
  
  // Restore inventory (for fishing ships)
  if(shipData.inventory) {
    ship.inventory = shipData.inventory;
  }
  
  // Restore last dock reference
  ship.lastDock = self.id;
  
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
  
  var loc = getLoc(self.x, self.y, self);
  var buildingId = getBuilding(self.x, self.y);
  console.log('[checkDockContact] Ship', self.id, 'at location', loc, 'buildingId:', buildingId);
  
  if(buildingId) {
    var building = Building.list[buildingId];
    console.log('[checkDockContact] Building found:', building ? building.type : 'null');
    
    // Check if it's a dock
    if(building && building.type === 'dock') {
      console.log('[checkDockContact] Dock detected. Ship house:', self.house, 'dock house:', building.house, 'ship kingdom:', self.kingdom, 'dock kingdom:', building.kingdom);
      
      // Check if friendly (same house/kingdom) OR if player owns both ship and dock
      var isFriendly = (building.house === self.house) || 
                       (building.kingdom && building.kingdom === self.kingdom);
      console.log('[checkDockContact] Initial isFriendly (house/kingdom match):', isFriendly);
      
      // Also allow docking if player owns both the ship and the dock
      if(!isFriendly && self.owner && building.owner) {
        isFriendly = (self.owner === building.owner);
        console.log('[checkDockContact] Checking owner match - ship owner:', self.owner, 'dock owner:', building.owner, 'match:', isFriendly);
      }
      
      console.log('[checkDockContact] Final isFriendly:', isFriendly);
      if(isFriendly) {
        console.log('[checkDockContact] Calling dockAtPort for dock', building.id);
        // Store ship at dock
        self.dockAtPort(building.id);
        return true;
      } else {
        console.log('[checkDockContact] NOT docking - not friendly');
      }
    } else {
      console.log('[checkDockContact] Building is not a dock');
    }
  } else {
    console.log('[checkDockContact] No building at location');
  }
  
  return false;
};

// Dock ship at port
Character.prototype.dockAtPort = function(dockId) {
  var self = this;
  var dock = Building.list[dockId];
  if(!dock) {
    return;
  }
  
  // Prevent duplicate docking (ship might already be stored)
  if(self.mode === 'docked' && self.dockedTimer <= 0) {
    return;
  }
  
  // INFORMATION TRANSFER: Pass boat's home dock data to this dock
  // This creates network associations between docks, enabling cargo ship routes
  // Must happen BEFORE updating lastDock to ensure proper association tracking
  var dockToAssociate = self.dock || self.lastDock;
  if(dockToAssociate && dockToAssociate !== dockId && dock.createDockAssociation) {
    // Transfer home dock information: create bidirectional network association
    // This allows the dock to know about the boat's origin dock
    dock.createDockAssociation(dockToAssociate);
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
      } else {
        // Deposit to player stores
        if(!owner.stores.fish){
          owner.stores.fish = 0;
        }
        owner.stores.fish += fishToUnload;
      }
    } else if(dock.house && House.list[dock.house]){
      // Dock owned by faction - deposit to faction stores
      if(!House.list[dock.house].stores.fish){
        House.list[dock.house].stores.fish = 0;
      }
      House.list[dock.house].stores.fish += fishToUnload;
    }
    
    // Clear ship's fish inventory
    self.inventory.fish = 0;
  }
  
  // IMPORTANT: Remove ship from any previous dock's storedShips first
  // This ensures ships are only stored at the dock where they currently dock
  if(self.lastDock && self.lastDock !== dockId) {
    var previousDock = Building.list[self.lastDock];
    if(previousDock && previousDock.type === 'dock' && previousDock.storedShips) {
      // Find and remove this ship from previous dock's storedShips
      for(var i = previousDock.storedShips.length - 1; i >= 0; i--) {
        if(previousDock.storedShips[i].shipId === self.id) {
          previousDock.storedShips.splice(i, 1);
          break;
        }
      }
    }
  }
  
  // CRITICAL: Disembark all passengers BEFORE storing the ship
  // Otherwise passengers will be stuck with boardedShip set to a ship that no longer exists
  var dockLoc = getLoc(dock.x, dock.y);
  // Find a safe disembark location near the dock
  var disembarkLoc = null;
  if(dock.plot && dock.plot.length > 0){
    // Try to find a walkable tile near the dock
    for(var i = 0; i < dock.plot.length; i++){
      var plotTile = dock.plot[i];
      var adjacentTiles = [
        [plotTile[0], plotTile[1] + 1],
        [plotTile[0], plotTile[1] - 1],
        [plotTile[0] - 1, plotTile[1]],
        [plotTile[0] + 1, plotTile[1]]
      ];
      for(var j = 0; j < adjacentTiles.length; j++){
        var adjTile = adjacentTiles[j];
        if(adjTile[0] >= 0 && adjTile[0] < global.mapSize && adjTile[1] >= 0 && adjTile[1] < global.mapSize){
          var tile = getTile(0, adjTile[0], adjTile[1]);
          if(tile !== 0){ // Not water
            disembarkLoc = adjTile;
            break;
          }
        }
      }
      if(disembarkLoc) break;
    }
  }
  // Fallback to dock location if no adjacent tile found
  if(!disembarkLoc){
    disembarkLoc = dockLoc;
  }
  
  // Disembark all passengers (new system)
  if(self.passengers && self.passengers.length > 0){
    var passengersToDisembark = self.passengers.slice(); // Copy array to avoid modification during iteration
    for(var k = 0; k < passengersToDisembark.length; k++){
      var passenger = passengersToDisembark[k];
      if(passenger && passenger.playerId && Player.list[passenger.playerId]){
        if(typeof self.disembarkPassenger === 'function'){
          self.disembarkPassenger(passenger.playerId, disembarkLoc);
        }
      }
    }
  }
  
  // Also handle old boarding system (storedPlayer)
  if(self.storedPlayer && self.storedPlayer.id && Player.list[self.storedPlayer.id]){
    var oldPlayer = Player.list[self.storedPlayer.id];
    var oldDisembarkLoc = disembarkLoc;
    var oldLandCoords = getCenter(oldDisembarkLoc[0], oldDisembarkLoc[1]);
    oldPlayer.x = oldLandCoords[0];
    oldPlayer.y = oldLandCoords[1];
    oldPlayer.z = 0;
    oldPlayer.isBoarded = false;
    oldPlayer.boardedShip = null;
    oldPlayer.boardCooldown = 180; // 3 second cooldown
    
    var oldSocket = SOCKET_LIST[oldPlayer.id];
    if(oldSocket){
      oldSocket.write(JSON.stringify({
        msg: 'disembarkShip',
        newSelfId: oldPlayer.id
      }));
      oldSocket.write(JSON.stringify({
        msg:'addToChat',
        message:'<i>🏖️ Ship docked. You have been disembarked.</i>'
      }));
    }
    self.storedPlayer = null;
    self.controller = null;
    self.isPlayerControlled = false;
  }
  
  // Set ship to docked mode and start timer (do NOT store immediately)
  // Ship remains in Player.list and visible in UI until timer expires
  self.mode = 'docked';
  self.dockedTimer = 3600; // 1 hour (60 seconds * 60 frames/sec)
  self.lastDock = dockId;
  
  // Update ship name to show docked status
  if(self.shipType === 'fishingship'){
    self.name = 'Fishing Ship ⚓';
  }
  
  
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

// ============================================================================
// FAUNA ENTITIES
// ============================================================================
// NOTE: Fauna entities (Sheep, Deer, Boar, Wolf, Falcon) are now defined in
// server/js/entities/ as modular exports and loaded via initModularEntities().
// This eliminates code duplication and makes fauna easier to maintain.
// See server/js/entities/index.js for the entity registry.
// ============================================================================

// ============================================================================
// CHARACTER PROTOTYPE METHODS - PHASE 2: SIMPLE COMMON LOGIC
// ============================================================================
// These methods extract simple, isolated logic that's common across all characters.
// They are added alongside existing update functions (not replacing them yet).
// Will be integrated into existing updates in Phase 3.
// ============================================================================

/**
 * Update all cooldown timers
 * Handles: actionCooldown, attackCooldown, idleTime, mineExitCooldown, pathCooldown
 * Used by: All character types
 */
Character.prototype.updateCooldowns = function() {
  // Idle time countdown (used by NPCs for random wandering timing)
  if(this.idleTime > 0){
    this.idleTime--;
  }
  
  // Attack cooldown (prevents rapid-fire attacks)
  if(this.attackCooldown > 0){
    this.attackCooldown--;
  }
  
  // Pathfinding cooldown (prevents excessive pathfinding calculations)
  if(this.pathCooldown && this.pathCooldown > 0){
    this.pathCooldown--;
  }
  
  // Mine exit cooldown for serfs (prevents immediate re-entry to mines)
  if(this.mineExitCooldown && this.mineExitCooldown > 0){
    this.mineExitCooldown--;
  }
  
  // Action cooldown (generic action throttling - used by Player.update)
  if(this.actionCooldown > 0){
    this.actionCooldown--;
  }
  
  // Mount cooldown (used by Player.update)
  if(this.mountCooldown > 0){
    this.mountCooldown--;
  }
  
  // Switch cooldown (used by Player.update)
  if(this.switchCooldown > 0){
    this.switchCooldown--;
  }
  
  // Board cooldown (used by Player.update)
  if(this.boardCooldown > 0){
    this.boardCooldown--;
  }
};

/**
 * Passive HP and Spirit regeneration
 * Regenerates health and spirit for non-ghost characters
 * Used by: All character types
 */
Character.prototype.updateRegeneration = function() {
  // Passive HP Regeneration for all characters (NPCs and Players)
  if(!this.ghost && this.hp < this.hpMax){
    // Regenerate HP at ~0.0042 per frame = 0.25 HP/second at 60fps
    this.hp = Math.min(this.hp + 0.0042, this.hpMax);
  }
  
  // Passive Spirit Regeneration (if character has spirit)
  if(!this.ghost && this.spirit && this.spiritMax && this.spirit < this.spiritMax){
    // Regenerate Spirit at ~0.0017 per frame = 0.1 Spirit/second at 60fps
    this.spirit = Math.min(this.spirit + 0.0017, this.spiritMax);
  }
};

/**
 * Stealth mechanics: drag and reveal checks
 * Stealthed characters move slower and can be revealed
 * Used by: Characters with stealth capability
 */
Character.prototype.updateStealthMechanics = function() {
  if(this.stealthed){
    this.drag = 0.5; // Reduced speed while stealthed
    this.revealCheck(); // Check if stealth should be broken
  } else {
    this.drag = 1; // Normal speed
  }
};

/**
 * Torch bearer auto-lighting
 * Automatically lights torch in dark areas (night, caves, cellars)
 * Used by: Characters with torchBearer flag
 */
Character.prototype.updateTorchBearer = function() {
  if(this.torchBearer){
    if(!this.hasTorch){
      // Auto-light torch if in dark area: overworld at night, caves (z=-1), or cellars (z=-2)
      if((this.z == 0 && nightfall) || this.z == -1 || this.z == -2){
        this.lightTorch(Math.random());
      }
    }
  }
};

// ============================================================================
// END PROTOTYPE METHODS - PHASE 2
// ============================================================================

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

  // Inherit map context from dock if available
  const dockEntity = self.dock && Building.list ? Building.list[self.dock] : null;
  if (dockEntity && global.mapContextHelpers) {
    global.mapContextHelpers.setEntityContext(self, dockEntity.battlegroundMatchId || null);
  }
  
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
  if(self.mode === 'docked' || self.mode === 'anchored'){
    self.name = 'Fishing Ship ⚓';
  }
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
    
    // Handle docked timer - store ship at dock after timer expires
    if(self.mode == 'docked' && self.dockedTimer > 0){
      self.dockedTimer--;
      if(self.dockedTimer <= 0){
        // Store ship at dock before removing from active play
        var dockId = self.lastDock || self.dock;
        var dock = Building.list[dockId];
        if(dock && dock.type === 'dock'){
          // Initialize storedShips array if needed
          if(!dock.storedShips) dock.storedShips = [];
          
          // Check if ship is already in storedShips (avoid duplicates)
          var alreadyStored = false;
          for(var i = 0; i < dock.storedShips.length; i++){
            if(dock.storedShips[i].shipId === self.id){
              alreadyStored = true;
              break;
            }
          }
          
          if(!alreadyStored){
            // Store ship data at the dock when timer expires
            dock.storedShips.push({
              shipId: self.id,
              shipType: self.shipType || self.class,
              owner: self.owner,
              cargo: self.stores || {},
              inventory: self.inventory || {}
            });
          }
        }
        
        // Remove ship from active play
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
    }
    
    var loc = getLoc(self.x, self.y, self);
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
    }
    // Otherwise, add a point to this direction (if we have points available)
    else if(totalPoints < 2){
      self.sailPoints[direction]++;
    }
    
    // Log current sail state
    var activePoints = [];
    if(self.sailPoints.up > 0) activePoints.push('N:' + self.sailPoints.up);
    if(self.sailPoints.down > 0) activePoints.push('S:' + self.sailPoints.down);
    if(self.sailPoints.left > 0) activePoints.push('W:' + self.sailPoints.left);
    if(self.sailPoints.right > 0) activePoints.push('E:' + self.sailPoints.right);
  };
  
  // Smooth ship physics update
  self.updateShipPhysics = function(){
    // Debug: Log ship position and tile on first physics tick
    if(self.sailingGracePeriod === 0 && (self.velocity.x === 0 && self.velocity.y === 0)){
      var currentLoc = getLoc(self.x, self.y, self);
      var currentTile = getTile(0, currentLoc[0], currentLoc[1], self);
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
      // Check if touching any non-water tile (land or dock)
      if(nextTile != 0){ // Not water (any land tile)
        // Check if this is a dock building at the next position
        var buildingId = getBuilding(nextX, nextY);
        var hitDock = null;
        if(buildingId){
          var building = Building.list[buildingId];
          if(building && building.type === 'dock'){
            // Check if friendly (same house/kingdom) OR if player owns both ship and dock
            var isFriendly = (building.house === self.house) || 
                             (building.kingdom && building.kingdom === self.kingdom);
            
            // Also allow docking if player owns both the ship and the dock
            if(!isFriendly && self.owner && building.owner) {
              isFriendly = (self.owner === building.owner);
            }
            
            if(isFriendly) {
              hitDock = building;
            }
          }
        }
        
        // Disembark player onto land/dock - ship stays on water
        if(self.isPlayerControlled && self.passengers.length > 0 && self.mode === 'sailing' && self.sailingGracePeriod === 0){
          // Disembark navigator onto the land, boat stays at current water position
          var navigatorId = self.passengers.find(p => p.isNavigator)?.playerId;
          if(navigatorId){
            // If we hit a friendly dock, update lastDock before disembarking
            // This helps the disembark logic know we're at a dock
            if(hitDock){
              self.lastDock = hitDock.id;
            }
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
      return false;
    }
    
    // Check if already aboard
    var alreadyAboard = self.passengers.some(function(p){ return p.playerId === playerId; });
    if(alreadyAboard){
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
      
    } else {
      // Just a passenger
      var socket = SOCKET_LIST[playerId];
      if(socket){
        socket.write(JSON.stringify({
          msg:'addToChat',
          message:'<i>🚢 You boarded the ship as a passenger.</i>'
        }));
      }
      
    }
    
    // CRITICAL: Mark player as boarded BEFORE syncing position
    // This prevents terrain checks from setting z=-3 when player is moved to water
    player.isBoarded = true;
    player.boardedShip = self.id;
    // Set shipType for passengers (navigators switch selfId to ship, so they don't need this)
    if(!isNavigator){
      player.shipType = self.shipType; // Set shipType so AudioManager can detect ship context
    }
    
    // Now sync player position to ship
    // Player's position becomes the ship's position
    player.x = self.x;
    player.y = self.y;
    player.z = self.z;
    
    
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
      return false;
    }
    
    var passenger = self.passengers[passengerIndex];
    var player = Player.list[playerId];
    if(!player){
      return false;
    }
    
    // Place player on land - at least 1 tile away from ship to prevent auto re-boarding
    // Find a land tile that's at least 1 tile from the ship
    var disembarkLoc = landLoc;
    var shipLoc = getLoc(self.x, self.y, self);
    const contextMapSize = global.mapContextManager
      ? global.mapContextManager.getMapSize(self)
      : global.mapSize;
    var dist = Math.sqrt(Math.pow(landLoc[0] - shipLoc[0], 2) + Math.pow(landLoc[1] - shipLoc[1], 2));
    
    // If too close, try to find a further land tile
    if(dist < 1){
      var searchRadius = 2;
      for(var dx = -searchRadius; dx <= searchRadius; dx++){
        for(var dy = -searchRadius; dy <= searchRadius; dy++){
          var checkLoc = [landLoc[0] + dx, landLoc[1] + dy];
          if(checkLoc[0] >= 0 && checkLoc[0] < contextMapSize && checkLoc[1] >= 0 && checkLoc[1] < contextMapSize){
            var checkTile = getTile(0, checkLoc[0], checkLoc[1], self);
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
    player.shipType = null; // Clear shipType when disembarking
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
      } else {
        // No more passengers - ship becomes AI controlled or docked/anchored
        self.controller = null;
        self.isPlayerControlled = false;
        self.storedPlayer = null;
        self.sailPoints = {up: 0, down: 0, left: 0, right: 0};
        self.velocity = {x: 0, y: 0}; // Stop movement
        
        // Check if ship just hit a dock (lastDock was updated by updateShipPhysics before disembark)
        // or if ship is adjacent to a dock
        var atDock = false;
        var dockBuildingId = null;
        
        // First, check if lastDock is a valid dock we're near
        if(self.lastDock && Building.list[self.lastDock] && Building.list[self.lastDock].type === 'dock'){
          var dock = Building.list[self.lastDock];
          var shipLoc = getLoc(self.x, self.y, self);
          
          // Check if ship is within 3 tiles of any dock plot tile
          for(var p = 0; p < dock.plot.length; p++){
            var plotTile = dock.plot[p];
            var distX = Math.abs(shipLoc[0] - plotTile[0]);
            var distY = Math.abs(shipLoc[1] - plotTile[1]);
            if(distX <= 3 && distY <= 3){
              atDock = true;
              dockBuildingId = self.lastDock;
              break;
            }
          }
        }
        
        // If not near lastDock, check adjacent tiles for any dock
        if(!atDock){
          var shipLoc = getLoc(self.x, self.y, self);
          var adjacentTiles = [
            [shipLoc[0], shipLoc[1]],
            [shipLoc[0] + 1, shipLoc[1]],
            [shipLoc[0] - 1, shipLoc[1]],
            [shipLoc[0], shipLoc[1] + 1],
            [shipLoc[0], shipLoc[1] - 1],
            [shipLoc[0] + 2, shipLoc[1]],
            [shipLoc[0] - 2, shipLoc[1]],
            [shipLoc[0], shipLoc[1] + 2],
            [shipLoc[0], shipLoc[1] - 2]
          ];
          
          for(var i = 0; i < adjacentTiles.length; i++){
            var checkLoc = adjacentTiles[i];
            if(checkLoc[0] >= 0 && checkLoc[0] < global.mapSize && checkLoc[1] >= 0 && checkLoc[1] < global.mapSize){
              var checkCoords = getCenter(checkLoc[0], checkLoc[1]);
              var buildingId = getBuilding(checkCoords[0], checkCoords[1]);
              if(buildingId){
                var building = Building.list[buildingId];
                if(building && building.type === 'dock'){
                  atDock = true;
                  dockBuildingId = buildingId;
                  break;
                }
              }
            }
          }
        }
        
        if(atDock){
          // Ship is at a dock - call dockAtPort to create associations and store ship
          // Use Character.prototype to ensure method is available
          if(Character.prototype.dockAtPort) {
            Character.prototype.dockAtPort.call(self, dockBuildingId);
          }
        } else {
          // Not at dock - set to anchored
          self.mode = 'anchored';
          self.name = 'Fishing Ship ⚓';
        }
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
      // Stop the ship from moving
      self.sailPoints = {up: 0, down: 0, left: 0, right: 0};
      self.mode = 'anchored';
      self.isPlayerControlled = false;
      return;
    }
    
    var playerId = self.storedPlayer.id;
    var player = Player.list[playerId];
    
    if(!player){
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
    
  };
  
  // Store boat at home dock (set ship to docked state)
  // Note: Player disembarkation is handled by disembarkPassenger, this just sets ship state
  self.storeAtDock = function(){
    var dockBuilding = Building.list[self.dock];
    if(!dockBuilding){
      return;
    }
    
    // Mark ship as docked and set timer
    self.isPlayerControlled = false;
    self.controller = null;
    self.mode = 'docked';
    self.dockedTimer = 3600; // 1 in-game hour (60 minutes * 60 frames/sec)
    self.sailPoints = {up: 0, down: 0, left: 0, right: 0}; // Clear sail points
    self.velocity = {x: 0, y: 0}; // Stop movement
    self.storedPlayer = null;
    self.name = 'Fishing Ship ⚓'; // Update name to show docked status
    
  };
  
  self.depositFishAndDisembark = function(){
    if(!self.dock || !Building.list[self.dock]){
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
      }
    }
    
    // Clear ship
    self.embarkedSerfs = [];
    self.inventory.fish = 0;
    
    // Despawn ship
    self.toRemove = true;
  }
  
  // Override die function to handle ship destruction
  self.die = function(report){
    var deathLocation = getLoc(self.x, self.y, self);
    var deathCoords = getCenter(deathLocation[0], deathLocation[1]);
    
    
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
    
    // Remove ship
    self.toRemove = true;
  };
  
  // Override getInitPack to include ship mode
  var super_getInitPack = self.getInitPack;
  self.getInitPack = function(){
    var pack = super_getInitPack();
    // Add ship-specific data
    pack.shipMode = self.mode; // 'sailing', 'anchored', 'docked', 'fishing', 'returning'
    return pack;
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
global.FishingShip = FishingShip;

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

  // Inherit map context from home dock if available
  const homeDockEntity = self.homeDock && Building.list ? Building.list[self.homeDock] : null;
  if (homeDockEntity && global.mapContextHelpers) {
    global.mapContextHelpers.setEntityContext(self, homeDockEntity.battlegroundMatchId || null);
  }
  
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
      return false;
    }
    
    var homeDock = Building.list[self.homeDock];
    if(!homeDock.network || homeDock.network.length === 0){
      return false;
    }
    
    // Filter out visited docks AND current dock
    var unvisited = homeDock.network.filter(function(dockId){
      return self.visitedDocks.indexOf(dockId) === -1 && dockId !== self.currentDock;
    });
    
    // If all docks visited, return to home (only if not already at home)
    if(unvisited.length === 0){
      if(self.currentDock === self.homeDock){
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
      '<b>⛵ Cargo Ship</b>: <i>Now returning to ' + targetDockName + '</i>' :
      '<b>⛵ Cargo Ship</b>: <i>Next destination: ' + targetDockName + '</i>';
    
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
    
  };
  
  // Start waiting period at dock
  self.startWaiting = function(){
    self.mode = 'waiting';
    self.waitTimer = 3600; // 1 minute at 60fps
    self.name = 'Cargo Ship ⚓';
  };
  
  // Navigate to target dock (using A* pathfinding on water)
  self.navigateToTarget = function(){
    if(!self.targetDock || !Building.list[self.targetDock]){
      return;
    }
    
    var targetDock = Building.list[self.targetDock];
    var currentLoc = getLoc(self.x, self.y, self);
    const contextMapSize = global.mapContextManager
      ? global.mapContextManager.getMapSize(self)
      : mapSize;
    
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
            if(at[0] >= 0 && at[0] < contextMapSize && at[1] >= 0 && at[1] < contextMapSize){
              if(getTile(0, at[0], at[1], self) == 0){ // Water
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
        var path = findPathContextAware(currentLoc, closestWaterTile, 0, {waterOnly: true}, self);
        if(path && path.length > 0){
          self.path = path;
        } else {
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
        self.name = 'Cargo Ship ⚓'; // Update name to show anchor when docked
        self.currentDock = self.targetDock;
        
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
        }
        
        self.selectNextDestination();
        self.announceDestination();
        self.startWaiting();
      }
    }
  };
  
  self.update = function(){
    // FIRST: Ensure name is always in sync with mode (run every frame as safeguard)
    if(self.mode === 'sailing'){
      // Ensure anchor emoji is removed from name when sailing
      if(!self.name || self.name.includes('⚓')){
        self.name = 'Cargo Ship';
      }
    } else if(self.mode === 'waiting' || self.mode === 'docked'){
      // Ensure anchor emoji is present when waiting/docked
      if(!self.name || !self.name.includes('⚓')){
        self.name = 'Cargo Ship ⚓';
      }
    }
    
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
    player.shipType = self.shipType; // Set shipType so AudioManager can detect ship context
    player.x = self.x;
    player.y = self.y;
    player.z = 0; // Always overworld, don't sync z from ship
    
    // EXTRA SAFETY: Force z=0 explicitly again after all position updates
    player.z = 0;
    
    
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
        message: '<i>⛵ Boarded cargo ship to <b>' + targetDockName + '</b>. Departing in ' + timeRemaining + ' seconds. (' + self.passengers.length + '/' + self.maxPassengers + ' passengers)</i>'
      }));
    }
    
    return true;
  };
  
  // Disembark a passenger
  self.disembarkPassenger = function(playerId, landLoc){
    var passengerIndex = self.passengers.findIndex(function(p){ return p.playerId === playerId; });
    if(passengerIndex === -1){
      return false;
    }
    
    var passenger = self.passengers[passengerIndex];
    var player = Player.list[playerId];
    if(!player){
      return false;
    }
    
    // Place player on dock
    var landCoords = getCenter(landLoc[0], landLoc[1]);
    player.x = landCoords[0];
    player.y = landCoords[1];
    player.z = 0;
    player.isBoarded = false;
    player.boardedShip = null;
    player.shipType = null; // Clear shipType when disembarking
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
global.CargoShip = CargoShip;

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
  self.work = param.work || {hq:null, spot:null, assignedSpot:null, workTile:null, workTileFor:null};
  if (!self.work.workTile) {
    self.work.workTile = null;
  }
  if (!self.work.workTileFor) {
    self.work.workTileFor = null;
  }
  self.dayTimer = false;
  self.workTimer = false;
  self.idleCounter = 0; // Track how long serf has been without action
  self.lastPos = {x: param.x, y: param.y}; // Track position for stuck detection
  self.stuckCounter = 0; // Count frames stuck in same position
  self.serfState = param.serfState || 'idle';
  self.torchBearer = false; // Set during assignWorkHQ
  self.isNonCombatant = true; // Civilian - doesn't trigger outposts
  self.mineExitCooldown = 0; // Prevent immediate re-entry after exiting cave (~2 seconds)

  // Assign Serf to appropriate work building
  self.assignWorkHQ = function(){
    if(!self.house) return;
    
    var serfLogger = global.serfLogger;
    var now = Date.now();
    var shouldLog = !self._lastWorkAssignLogAt || (now - self._lastWorkAssignLogAt) > 5000;
    var candidateCount = 0;
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
        candidateCount++;
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
      if(serfLogger && typeof serfLogger.info === 'function' && shouldLog){
        serfLogger.info('Serf work assignment', self, {
          result: 'assigned',
          workHq: bestHQ,
          buildingType: buildingType,
          distance: bestDistance,
          candidateCount: candidateCount
        });
        self._lastWorkAssignLogAt = now;
        self._lastWorkAssignHq = bestHQ;
      }
      
      // Only miners need torches for caves
      if(buildingType === 'mine' && Building.list[bestHQ].cave){
        self.torchBearer = true;
        self.inventory.torch = 3; // Torchbearers get 3 torches (free light, don't consume)
        self.preferredCaveEntrance = Building.list[bestHQ].cave;
      } else {
        self.torchBearer = false;
        self.preferredCaveEntrance = null;
      }
    } else {
      self.work.hq = null;
      if(serfLogger && typeof serfLogger.warn === 'function' && shouldLog){
        serfLogger.warn('Serf work assignment failed', self, {
          result: 'noCandidate',
          candidateCount: candidateCount,
          validBuildingTypes: validBuildingTypes
        });
        self._lastWorkAssignLogAt = now;
        self._lastWorkAssignHq = null;
      }
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
            self.preferredCaveEntrance = Building.list[self.work.hq].cave;
          } else {
            self.torchBearer = false;
            self.preferredCaveEntrance = null;
        }
      }
      
      if(!self.tavern){
        self.findTavern();
      }
      
      if(!self.mode){
        self.mode = 'idle';
      }
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
    
    return true;
  };

  // Initialize the Serf
  self.initializeSerf();

  self.update = function(){
    // CRITICAL: Prevent serfs from entering combat mode FIRST (before any other logic)
    // This ensures combat mode is blocked immediately, even if something tries to set it
    if (self.action === 'combat') {
      self.action = null;
      return;
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
    
    // Use simple behavior system for serf behavior
    if (global.simpleSerfBehavior) {
      global.simpleSerfBehavior.update(self);
    }
    
    // Z-level transitions and day/night logic - always run (both old and new systems)
    if(self.z == 0){
      if(getTile(0,loc[0],loc[1]) == 6){
        // Cave entrance - only enter when intent is set (prevents accidental transitions)
        self.transitionState = 'at_entrance';
        if(self.transitionIntent === 'enter_cave'){
          if(self.mineExitCooldown === 0){
            const canTransition = (!self.path || self.path.length === 0 || self.isAtPathDestination());
            if(canTransition){
              // Preserve target for continuation after entry
              const previousTargetZ = self.targetZLevel;
              const previousTargetLoc = self.targetLoc;
              self.enterCave(loc);
              if(previousTargetZ === -1 && previousTargetLoc && Array.isArray(previousTargetLoc) && previousTargetLoc.length >= 2){
                // Continue pathfinding inside the cave
                self.targetZLevel = null;
                self.moveTo(-1, previousTargetLoc[0], previousTargetLoc[1]);
                self.targetLoc = null;
              }
            }
          } else {
            // Waiting for cooldown to expire
            if(!self._cooldownLogTimer) self._cooldownLogTimer = 0;
            self._cooldownLogTimer++;
            if(self._cooldownLogTimer >= 60){ // Log once per second
              self._cooldownLogTimer = 0;
            }
          }
        }
      } else if(getTile(0,loc[0],loc[1]) >= 1 && getTile(0,loc[0],loc[1]) < 2){
        if(self.class !== 'Falcon'){
          self.innaWoods = true;
        }
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.3) * self.drag;
      } else if(getTile(0,loc[0],loc[1], self) >= 2 && getTile(0,loc[0],loc[1], self) < 4){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.5) * self.drag;
      } else if(getTile(0,loc[0],loc[1], self) >= 4 && getTile(0,loc[0],loc[1], self) < 5){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.6) * self.drag;
      } else if(getTile(0,loc[0],loc[1], self) >= 5 && getTile(0,loc[0],loc[1], self) < 6 && !self.onMtn){
        self.innaWoods = false;
        self.maxSpd = (self.baseSpd * 0.2) * self.drag;
        setTimeout(function(){
          // Check CURRENT location, not stale loc from 2 seconds ago
          var currentLoc = getLoc(self.x, self.y, self);
          if(getTile(0,currentLoc[0],currentLoc[1], self) >= 5 && getTile(0,currentLoc[0],currentLoc[1], self) < 6){
            self.onMtn = true;
          }
        },2000);
      } else if(getTile(0,loc[0],loc[1], self) >= 5 && getTile(0,loc[0],loc[1], self) < 6 && self.onMtn){
        self.maxSpd = (self.baseSpd * 0.5) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) == 18){
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 1.1) * self.drag;
      } else if(getTile(0,loc[0],loc[1]) == 14 || getTile(0,loc[0],loc[1]) == 16 || getTile(0,loc[0],loc[1]) == 19){
        // Only enter buildings when transition intent is set
        if(self.transitionIntent === 'enter_building'){
          var b = getBuilding(self.x,self.y);
          if(Building.list[b]){
            self.enterBuilding(b);
          }
        } else {
          self.innaWoods = false;
          self.onMtn = false;
          self.maxSpd = self.baseSpd * self.drag;
        }
      } else if(getTile(0,loc[0],loc[1]) == 0 && !self.isBoarded){
        self.enterWater();
      } else {
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd  * self.drag;
      }
    } else if(self.z == -1){
      var tileValue = getTile(1,loc[0],loc[1]);
      if(tileValue == 2){
        // At cave exit - set state
        self.transitionState = 'at_entrance';
        
        // For serfs in work mode, ensure intent is set if not already set
        if(self.mode === 'work' && !self.transitionIntent){
          // Serf in work mode at exit - should have intent from moveTo(), but set it if missing
          self.transitionIntent = 'exit_cave';
        }
        
        // Check intent to exit cave
        // For serfs, allow transition when at exit tile, even if path doesn't match exactly
        // This handles cases where path was cleared or pathfinding completed but destination doesn't match
        var canTransition = false;
        if(self.type === 'npc'){
          // Check if we're at the exit tile (tile value 2 on layer 1)
          var atExitTile = (getTile(1, loc[0], loc[1]) == 2);
          // Also check if path destination matches (for cases where path is still valid)
          var pathMatches = self.isAtPathDestination();
          // For serfs with exit intent, prioritize atExitTile check - if at exit tile, transition immediately
          if((self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF') && self.transitionIntent === 'exit_cave'){
            // Serfs: if at exit tile with exit intent, transition immediately (don't wait for path match)
            canTransition = atExitTile || pathMatches;
            
            // Log transition check for serfs
            var serfLogger = global.serfLogger;
            if(serfLogger){
              serfLogger.debug(`[TRANSITION_CHECK] serf=${self.id} z=${self.z} loc=[${loc[0]},${loc[1]}] intent=${self.transitionIntent} atExitTile=${atExitTile} pathMatches=${pathMatches} canTransition=${canTransition} path=${self.path?.length || 0}`, self);
            }
          } else {
            // Other NPCs: use same logic
            canTransition = atExitTile || pathMatches;
          }
        } else {
          canTransition = self.isAtPathDestination();
        }
        
        if(self.transitionIntent === 'exit_cave' && canTransition){
          self.exitCave();
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
        const canTransition = (!self.path || self.path.length === 0 || self.isAtPathDestination());
        if(canTransition){
          var exit = getBuilding(self.x,self.y-tileSize);
          self.exitBuilding(exit);
        }
      } else if(getTile(4,loc[0],loc[1]) == 3 || getTile(4,loc[0],loc[1]) == 4 || getTile(4,loc[0],loc[1]) == 7){
        self.z = 2;
        // For players, clear all movement to prevent infinite loops
        if(self.type === 'player'){
          self.clearAllMovement();
        } else {
          // For NPCs, preserve path for multi-floor navigation
          // Clear movement to prevent infinite stair loops (except for ghosts)
          if(!self.ghost){
            self.pressingRight = false;
            self.pressingLeft = false;
            self.pressingDown = false;
            self.pressingUp = false;
          }
        }
        self.y += (tileSize/2);
        self.facing = 'down';
      } else if(getTile(4,loc[0],loc[1]) == 5 || getTile(4,loc[0],loc[1]) == 6){
        self.z = -2;
        // For players, clear all movement to prevent infinite loops
        if(self.type === 'player'){
          self.clearAllMovement();
        } else {
          // For NPCs, preserve path for cellar navigation
          // Clear movement to prevent infinite stair loops (except for ghosts)
          if(!self.ghost){
            self.pressingRight = false;
            self.pressingLeft = false;
            self.pressingDown = false;
            self.pressingUp = false;
          }
        }
        self.y += (tileSize/2);
        self.facing = 'down';
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

    // Day/night transition logic - works with both old and new systems
    if(tempus == 'VI.a' && self.mode != 'work' && !self.dayTimer){
      self.dayTimer = true;
      // PERFORMANCE FIX: Spread work assignments over 15 seconds instead of ~10 seconds
      // This prevents thundering herd when all serfs wake up at dawn
      var rand = Math.floor(Math.random() * 15000); // 0-15 seconds
      
      // DIAGNOSTIC LOGGING: Track dawn transition for mining serfs
      var isMineSerf = false;
      var buildingType = 'unknown';
      if(self.work && self.work.hq && global.Building && global.Building.list){
        var building = global.Building.list[self.work.hq];
        if(building){
          buildingType = building.type || 'unknown';
          isMineSerf = (building.type === 'mine');
        }
      }
      var factionName = self.house && global.House && global.House.list 
        ? (global.House.list[self.house]?.name || 'Unknown')
        : 'Unknown';
      
      if(isMineSerf){
      }
      
      if(!global.SERF_DEBUG_MODE) {
        // Only log occasionally to reduce console spam
        if(Math.random() < 0.1) {
        }
      } else {
      }
      setTimeout(function(){
        if(self.mode != 'work'){ // Double-check mode hasn't changed
          // DIAGNOSTIC LOGGING: Verify transition completed
          if(isMineSerf){
          }
        self.mode = 'work';
        self.action = null;
          self.work.spot = null; // Clear previous work spot
        // Serf work mode switch logged via event system
        }
        self.dayTimer = false;
      },rand);
    } else if(tempus == 'VI.p' && 
         (((self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF') && self.mode == 'work') ||
          (self.action == 'task' || self.action == 'build')) && 
         !self.dayTimer){
      self.dayTimer = true;
      var rand = Math.floor(Math.random() * (3600000/(period*6)));
      setTimeout(function(){
        // Check if serf in work mode OR has task/build action
        var isSerfInWorkMode = (self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF') && self.mode == 'work';
        var hasTaskOrBuildAction = (self.action == 'task' || self.action == 'build');
        
        if(isSerfInWorkMode || hasTaskOrBuildAction){
          self.action = 'clockout';
          self.work.spot = null;
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
        }
        self.dayTimer = false;
      },rand);
    }

    // Idle time decrement (used by state machine)
    if(self.idleTime > 0){
      self.idleTime--;
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
    } else {
      // No work available - serf will idle at home
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
            self.preferredCaveEntrance = Building.list[self.work.hq].cave;
          } else {
            self.torchBearer = false;
            self.preferredCaveEntrance = null;
        }
      }
      
      if(!self.tavern){
        self.findTavern();
      }
      
      if(!self.mode){
        self.mode = 'idle';
      }
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
    
    return true;
  };

  // Initialize the Serf
  self.initializeSerf();

  self.update = function(){
    var loc = getLoc(self.x,self.y);
    var b = getBuilding(self.x,self.y);
    self.zoneCheck();

    // Prevent serfs from entering combat mode (they should only flee)
    if (self.action === 'combat') {
      self.action = null;
      return;
    }

    // Use simple behavior system for serf behavior
    if (global.simpleSerfBehavior) {
      global.simpleSerfBehavior.update(self);
    }

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
          var currentLoc = getLoc(self.x, self.y, self);
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
      var tileValue = getTile(1,loc[0],loc[1]);
      if(tileValue == 2){
        // At cave exit - set state
        self.transitionState = 'at_entrance';
        
        // For serfs in work mode, ensure intent is set if not already set
        if(self.mode === 'work' && !self.transitionIntent){
          // Serf in work mode at exit - should have intent from moveTo(), but set it if missing
          self.transitionIntent = 'exit_cave';
        }
        
        // Check intent to exit cave
        // For serfs, allow transition when at exit tile, even if path doesn't match exactly
        // This handles cases where path was cleared or pathfinding completed but destination doesn't match
        var canTransition = false;
        if(self.type === 'npc'){
          // Check if we're at the exit tile (tile value 2 on layer 1)
          var atExitTile = (getTile(1, loc[0], loc[1]) == 2);
          // Also check if path destination matches (for cases where path is still valid)
          var pathMatches = self.isAtPathDestination();
          // For serfs with exit intent, prioritize atExitTile check - if at exit tile, transition immediately
          if((self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF') && self.transitionIntent === 'exit_cave'){
            // Serfs: if at exit tile with exit intent, transition immediately (don't wait for path match)
            canTransition = atExitTile || pathMatches;
            
            // Log transition check for serfs
            var serfLogger = global.serfLogger;
            if(serfLogger){
              serfLogger.debug(`[TRANSITION_CHECK] serf=${self.id} z=${self.z} loc=[${loc[0]},${loc[1]}] intent=${self.transitionIntent} atExitTile=${atExitTile} pathMatches=${pathMatches} canTransition=${canTransition} path=${self.path?.length || 0}`, self);
            }
          } else {
            // Other NPCs: use same logic
            canTransition = atExitTile || pathMatches;
          }
        } else {
          canTransition = self.isAtPathDestination();
        }
        
        if(self.transitionIntent === 'exit_cave' && canTransition){
          self.exitCave();
        }
      }
    } else if(self.z == -2){
      if(getTile(8,loc[0],loc[1]) == 5){
        self.z = 1;
        // For players, clear all movement to prevent infinite loops
        if(self.type === 'player'){
          self.clearAllMovement();
        } else {
          // For NPCs, preserve path for cross-floor navigation
          // Clear movement to prevent infinite stair loops (except for ghosts)
          if(!self.ghost){
            self.pressingRight = false;
            self.pressingLeft = false;
            self.pressingDown = false;
            self.pressingUp = false;
          }
        }
        self.y += (tileSize/2);
        self.facing = 'down';
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
        // For players, clear all movement to prevent infinite loops
        if(self.type === 'player'){
          self.clearAllMovement();
        } else {
          // For NPCs, preserve path for multi-floor navigation
          // Clear movement to prevent infinite stair loops (except for ghosts)
          if(!self.ghost){
            self.pressingRight = false;
            self.pressingLeft = false;
            self.pressingDown = false;
            self.pressingUp = false;
          }
        }
        self.y += (tileSize/2);
        self.facing = 'down';
      } else if(getTile(4,loc[0],loc[1]) == 5 || getTile(4,loc[0],loc[1]) == 6){
        self.z = -2;
        // For players, clear all movement to prevent infinite loops
        if(self.type === 'player'){
          self.clearAllMovement();
        } else {
          // For NPCs, preserve path for cellar navigation
          // Clear movement to prevent infinite stair loops (except for ghosts)
          if(!self.ghost){
            self.pressingRight = false;
            self.pressingLeft = false;
            self.pressingDown = false;
            self.pressingUp = false;
          }
        }
        self.y += (tileSize/2);
        self.facing = 'down';
      }
    } else if(self.z == 2){
      if(getTile(4,loc[0],loc[1]) == 3 || getTile(4,loc[0],loc[1]) == 4){
        self.z = 1;
        // For players, clear all movement to prevent infinite loops
        if(self.type === 'player'){
          self.clearAllMovement();
        } else {
          // For NPCs, preserve path for multi-floor navigation
          // Clear movement to prevent infinite stair loops (except for ghosts)
          if(!self.ghost){
            self.pressingRight = false;
            self.pressingLeft = false;
            self.pressingDown = false;
            self.pressingUp = false;
          }
        }
        self.y += (tileSize/2);
        self.facing = 'down';
      }
    }

    if(tempus == 'VI.a' && self.mode !== 'work' && !self.dayTimer){
      self.dayTimer = true;
      // PERFORMANCE FIX: Spread work assignments over 15 seconds to avoid lag spikes
      var rand = Math.floor(Math.random() * 15000); // 0-15 seconds
      setTimeout(function(){
        self.mode = 'work';
        self.action = null;
        self.dayTimer = false;
        if(!global.SERF_DEBUG_MODE && Math.random() < 0.1) {
        }
      },rand);
    } else if(tempus == 'VI.p' && self.action == 'task' && !self.dayTimer){
      self.dayTimer = true;
      var rand = Math.floor(Math.random() * (3600000/(period*6)));
      setTimeout(function(){
        self.action = 'clockout';
        self.dayTimer = false;
      },rand);
    } else if(tempus == 'XI.p' && self.action == 'tavern' && !self.dayTimer){
      self.dayTimer = true;
      var rand = Math.floor(Math.random() * (3600000/(period/2)));
      setTimeout(function(){
        self.tether = null;
        self.action = 'home';
        self.dayTimer = false;
      },rand);
    }

    if(self.idleTime > 0){
      self.idleTime--;
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
  self.class = 'Blacksmith';
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
        if(self.class !== 'Falcon'){
          self.innaWoods = true;
        }
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
          var currentLoc = getLoc(self.x, self.y, self);
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
        // For players, clear all movement to prevent infinite loops
        if(self.type === 'player'){
          self.clearAllMovement();
        } else {
          // For NPCs, preserve path for cross-floor navigation
          // Clear movement to prevent infinite stair loops (except for ghosts)
          if(!self.ghost){
            self.pressingRight = false;
            self.pressingLeft = false;
            self.pressingDown = false;
            self.pressingUp = false;
          }
        }
        self.y += (tileSize/2);
        self.facing = 'down';
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
        // For players, clear all movement to prevent infinite loops
        if(self.type === 'player'){
          self.clearAllMovement();
        } else {
          // For NPCs, preserve path for multi-floor navigation
          // Clear movement to prevent infinite stair loops (except for ghosts)
          if(!self.ghost){
            self.pressingRight = false;
            self.pressingLeft = false;
            self.pressingDown = false;
            self.pressingUp = false;
          }
        }
        self.y += (tileSize/2);
        self.facing = 'down';
      } else if(getTile(4,loc[0],loc[1]) == 5 || getTile(4,loc[0],loc[1]) == 6){
        self.z = -2;
        // For players, clear all movement to prevent infinite loops
        if(self.type === 'player'){
          self.clearAllMovement();
        } else {
          // For NPCs, preserve path for cellar navigation
          // Clear movement to prevent infinite stair loops (except for ghosts)
          if(!self.ghost){
            self.pressingRight = false;
            self.pressingLeft = false;
            self.pressingDown = false;
            self.pressingUp = false;
          }
        }
        self.y += (tileSize/2);
        self.facing = 'down';
      }
    } else if(self.z == 2){
      if(getTile(4,loc[0],loc[1]) == 3 || getTile(4,loc[0],loc[1]) == 4){
        self.z = 1;
        // For players, clear all movement to prevent infinite loops
        if(self.type === 'player'){
          self.clearAllMovement();
        } else {
          // For NPCs, preserve path for multi-floor navigation
          // Clear movement to prevent infinite stair loops (except for ghosts)
          if(!self.ghost){
            self.pressingRight = false;
            self.pressingLeft = false;
            self.pressingDown = false;
            self.pressingUp = false;
          }
        }
        self.y += (tileSize/2);
        self.facing = 'down';
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
                self.work += 100;
              } else if(silverore > 0){
                House.list[self.house].stores.silverore--;
                House.list[self.house].stores.silver++;
                self.work += 100;
              } else if(ironore > 0){
                House.list[self.house].stores.ironore--;
                House.list[self.house].stores.iron++;
                self.work += 100;
              } else {
                self.mode = 'idle';
              }
            } else {
              var p = Building.list[self.forge].owner;
              var goldore = Player.list[p].stores.goldore;
              var silverore = Player.list[p].stores.silverore;
              var ironore = Player.list[p].stores.ironore;
              if(goldore > 0){
                Player.list[p].stores.goldore--;
                Player.list[p].stores.gold++;
                self.work += 100;
              } else if(silverore > 0){
                Player.list[p].stores.silverore--;
                Player.list[p].stores.silver++;
                self.work += 100;
              } else if(ironore > 0){
                Player.list[p].stores.ironore--;
                Player.list[p].stores.iron++;
                self.work += 100;
              } else {
                self.mode = 'idle';
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
    }
    
    //IDLE (Blacksmith - not wrapped, different entity type)
    if(self.mode == 'idle'){
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
  self.spriteSize = getSpriteSizeForClass('Monk'); // 96px
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
  self.spriteSize = getSpriteSizeForClass('Seidr'); // 64px
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
  self.spriteSize = tileSize; // 64px (1x)
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
  self.spriteSize = getSpriteSizeForClass('Gwenllian'); // 64px
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
    // Inherit map context from parent
    if(global.mapContextHelpers) {
      global.mapContextHelpers.setEntityContext(self, parentEntity.battlegroundMatchId || null);
    } else {
      // Fallback if helpers not available
      self.inBattleground = !!(parentEntity.inBattleground && parentEntity.battlegroundMatchId);
      self.battlegroundMatchId = parentEntity.battlegroundMatchId || null;
    }
  } else {
    // Parent is not a player (e.g., building like guardtower)
    self.innaWoods = false;
    // Calculate zGrid based on arrow's position
    var loc = getLoc(self.x, self.y, self);
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
    if(self.z == 0 && getLocTile(0,self.x,self.y,self) >= 1 && getLocTile(0,self.x,self.y,self) < 2){
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
          // Check both players and NPCs (NPCs are also in Player.list with type='npc')
          var p = Player.list[entityId];
          if(!p && Character && Character.list && Character.list[entityId]){
            p = Character.list[entityId];
          }
          if(p){
            if(self.getDistance(p) < 32 && self.z == p.z && self.parent != p.id){
              // Get parent entity (attacker) - could be player, NPC, or building
              var attacker = Player.list[self.parent];
              var isBuildingArrow = !attacker;
              
              // Skip if target is invalid (ghost, god mode, etc.)
              if(p.ghost || p.godMode || (p.hp !== null && p.hp <= 0) || p.toRemove){
                self.toRemove = true;
                continue;
              }
              
              // Stop target's work actions
              p.working = false;
              p.chopping = false;
              p.mining = false;
              p.farming = false;
              p.building = false;
              p.fishing = false;
              
              // Use standardized damage system
              if(global.simpleCombat && attacker){
                // Apply damage using standardized combat system (for player/NPC arrows)
                global.simpleCombat.applyDamage(attacker, p, 'ranged');
                
                // Remove stealth from both attacker and target (arrow hit reveals both)
                global.simpleCombat.removeStealth(attacker);
                global.simpleCombat.removeStealth(p);
                
                // Start combat if target is alive and not already in combat
                if(p.hp !== null && p.hp > 0 && p.action !== 'combat'){
                  // Use SimpleCombat to start combat properly (handles stealth, etc.)
                  global.simpleCombat.startCombat(p, attacker);
                }
              } else if(isBuildingArrow && global.simpleCombat){
                // Building arrows (guardtowers, strongholds) - use arrow's damage directly
                // Create a temporary attacker object for damage calculation
                var tempAttacker = {
                  id: self.parent,
                  damage: self.damage || 10,
                  type: 'building',
                  name: 'Building',
                  class: 'Building'
                };
                
                // Apply damage using standardized system
                global.simpleCombat.applyDamage(tempAttacker, p, 'ranged');
                
                // Remove stealth from target (arrow hit reveals them)
                global.simpleCombat.removeStealth(p);
                
                // Buildings don't enter combat, but target should be aware
                if(p.hp !== null && p.hp > 0){
                  // Target can't counter-attack buildings, but they're aware of the attack
                  // (Combat system will handle this appropriately)
                }
              } else {
                // Fallback to old system if SimpleCombat not available
                var netDamage = self.damage - (p.fortitude || 0);
                if(netDamage < 1) netDamage = 1; // Minimum 1 damage
                if(p.hp !== null){
                  p.hp -= netDamage;
                }
                
                if(attacker){
                  attacker.stealthed = false;
                  attacker.revealed = false;
                }
                p.stealthed = false;
                p.revealed = false;
                
                if(attacker && p.hp !== null && p.hp > 0){
                  if(!p.combat) p.combat = {};
                  p.combat.target = self.parent;
                  p.action = 'combat';
                }
                
                // Check for death
                if(p.hp !== null && p.hp <= 0){
                  p.die({id:self.parent,cause:'arrow'});
                }
              }
              
              self.toRemove = true;
            }
          }
        }
      }
    }
    const contextMapSize = global.mapContextManager
      ? global.mapContextManager.getMapSize(self)
      : mapSize;
    const contextMapPx = contextMapSize * (global.tileSize || tileSize || 64);
    if(self.x == 0 || self.x == contextMapPx || self.y == 0 || self.y == contextMapPx){
      self.toRemove = true;
    } else if(self.z == 0 && getLocTile(0,self.x,self.y,self) == 5 &&
    getLocTile(0,self.parentX,self.parentY,self) != 5){
      self.toRemove = true;
    } else if(self.z == 0 && getLocTile(0,self.x,self.y,self) == 1 &&
    getLocTile(0,self.parentX,self.parentY,self) != 1){
      self.toRemove = true;
    } else if(self.z == 0 && (getLocTile(0,self.x,self.y,self) == 13 ||
    getLocTile(0,self.x,self.y,self) == 14 || getLocTile(0,self.x,self.y,self) == 15 ||
    getLocTile(0,self.x,self.y,self) == 16 || getLocTile(0,self.x,self.y,self) == 19)){
      // Only remove if arrow has moved away from spawn point (prevents immediate removal from guardtowers on building tiles)
      var hasMoved = Math.abs(self.x - self.parentX) > 10 || Math.abs(self.y - self.parentY) > 10;
      if(hasMoved){
      self.toRemove = true;
      }
    } else if(self.z == -1 && getLocTile(1,self.x,self.y,self) == 1){
      self.toRemove = true;
    } else if(self.z == -2 && getLocTile(8,self.x,self.y,self) == 0){
      self.toRemove = true;
    } else if(self.z == 1 &&
      (getLocTile(3,self.x,self.y,self) == 0 || getLocTile(4,self.x,self.y,self) != 0)){
      self.toRemove = true;
    } else if(self.z == 2 &&
      (getLocTile(5,self.x,self.y,self) == 0 || getLocTile(4,self.x,self.y,self) != 0)){
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
      innaWoods:self.innaWoods,
      inBattleground: !!(self.inBattleground && self.battlegroundMatchId),
      battlegroundMatchId: self.battlegroundMatchId || null
    };
  };

  self.getUpdatePack = function(){
    return {
      id:self.id,
      angle:self.angle,
      x:self.x,
      y:self.y,
      z:self.z,
      innaWoods:self.innaWoods,
      inBattleground: !!(self.inBattleground && self.battlegroundMatchId),
      battlegroundMatchId: self.battlegroundMatchId || null
    };
  };

  Arrow.list[self.id] = self;
  initPack.arrow.push(self.getInitPack());
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
  if(self.z == 0 && getLocTile(0,self.x,self.y,self) >= 1 && getLocTile(0,self.x,self.y,self) < 2){
    self.innaWoods = true;
  } else {
    self.innaWoods = false;
  }

  // Ensure item context is set consistently (inherit from parent or explicit matchId)
  const parentEntity = self.parent && Player.list ? Player.list[self.parent] : null;
  const parentBuilding = self.parent && Building.list ? Building.list[self.parent] : null;
  if (global.mapContextHelpers) {
    let matchId = null;
    if (param.battlegroundMatchId) {
      matchId = param.battlegroundMatchId;
    } else if (param.matchId) {
      matchId = param.matchId;
    } else if (param.inBattleground && param.battlegroundMatchId) {
      matchId = param.battlegroundMatchId;
    } else if (parentEntity && parentEntity.inBattleground && parentEntity.battlegroundMatchId) {
      matchId = parentEntity.battlegroundMatchId;
    } else if (parentBuilding && parentBuilding.inBattleground && parentBuilding.battlegroundMatchId) {
      matchId = parentBuilding.battlegroundMatchId;
    }
    global.mapContextHelpers.setEntityContext(self, matchId);
  } else if (parentEntity || parentBuilding) {
    const contextSource = parentEntity || parentBuilding;
    self.inBattleground = !!(contextSource.inBattleground && contextSource.battlegroundMatchId);
    self.battlegroundMatchId = contextSource.battlegroundMatchId || null;
  }
  
  // Item lifecycle properties
  self.spawnTime = Date.now();
  self.spawnDay = global.day || 1; // Day item was spawned (for tick-based sinking)
  self.spawnTick = global.tick || 1; // Tick item was spawned (for tick-based sinking)
  self.despawnAfter = null; // Set by specific item types (consumables only)
  self.sinkTime = null; // When item started sinking process (water items only)
  self.sunk = false; // Has item sunk into terrain?

  self.blocker = function(n){
    var loc = getLoc(self.x,self.y,self);
    if(self.z == 0){
      matrixChange(0,loc[0],loc[1],n,self);
    } else if(self.z == 1){
      matrixChange(1,loc[0],loc[1],n,self);
    } else if(self.z == 2){
      matrixChange(2,loc[0],loc[1],n,self);
    } else if(self.z == -1){
      matrixChange(-1,loc[0],loc[1],n,self);
    } else if(self.z == -2){
      matrixChange(-2,loc[0],loc[1],n,self);
    } else if(self.z == -3){
      matrixChange(-3,loc[0],loc[1],n,self);
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
      innaWoods:self.innaWoods,
      inBattleground: !!(self.inBattleground && self.battlegroundMatchId),
      battlegroundMatchId: self.battlegroundMatchId || null
    };
  }

  self.getUpdatePack = function(){
    return{
      id:self.id,
      x:self.x,
      y:self.y,
      z:self.z,
      innaWoods:self.innaWoods,
      inBattleground: !!(self.inBattleground && self.battlegroundMatchId),
      battlegroundMatchId: self.battlegroundMatchId || null
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
      }
    }
    
    // TERRAIN SINKING: Items at z=0 sink into terrain after time
    if(item.z === 0 && !item.sunk && item.spawnTime) {
      const loc = getLoc(item.x, item.y, item);
      const terrain = getTile(0, loc[0], loc[1], item);
      
      // Water items sink after 10 seconds (real-time) to z=-3
      if(terrain === 0) {
        if(!item.sinkTime) item.sinkTime = now;
        const elapsed = now - item.sinkTime;
        
        if(elapsed > 10000) {
          item.z = -3; // Underwater layer
          item.sinkTime = null; // Reset for potential future sinking
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
        // Clean up interactability for interactable objects (Goods1-4, Desk)
        if(typeof global.clearTileInteractable === 'function'){
          var interactableTypes = ['Goods1', 'Goods2', 'Goods3', 'Goods4', 'Desk'];
          if(interactableTypes.indexOf(item.type) !== -1){
            var loc = getLoc(item.x, item.y, item);
            global.clearTileInteractable(item.z, loc[0], loc[1], item);
          }
        }
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
    if (global.gameWalletLedger) {
      try {
        global.gameWalletLedger.transferWorldToPlayer(player, self.qty, 'pickup');
      } catch (err) {
      }
    }
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
  self.toUpdate = true; // CRITICAL: Must be true so Item.update() includes it
  var super_update = self.update;
  self.update = function(){
    if(Player.list[self.parent]){
      const parentPlayer = Player.list[self.parent];
      self.x = parentPlayer.x - (tileSize * 0.75);
      self.y = parentPlayer.y - (tileSize * 0.75);
      self.z = parentPlayer.z;
      self.innaWoods = parentPlayer.innaWoods;
      
      // CRITICAL: Inherit map context from parent player
      if(global.mapContextHelpers) {
        global.mapContextHelpers.setEntityContext(self, parentPlayer.battlegroundMatchId || null);
      } else {
        self.inBattleground = !!(parentPlayer.inBattleground && parentPlayer.battlegroundMatchId);
        self.battlegroundMatchId = parentPlayer.battlegroundMatchId || null;
      }
    } else {
      self.toRemove = true;
    }
    if(self.timer++ > 3000){
      self.toRemove = true;
      if(self.parent && Player.list[self.parent]){
        Player.list[self.parent].hasTorch = false;
      }
    }
    if(self.z == -3){
      self.toRemove = true;
      if(self.parent && Player.list[self.parent]){
        Player.list[self.parent].hasTorch = false;
      }
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
  // Mark tile as interactable (same tile that was made unwalkable by blocker)
  var loc = getLoc(self.x, self.y, self);
  if(typeof global.setTileInteractable === 'function'){
    global.setTileInteractable(self.z, loc[0], loc[1], self.id, self);
  }
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
  // Mark tile as interactable (same tile that was made unwalkable by blocker)
  var loc = getLoc(self.x, self.y, self);
  if(typeof global.setTileInteractable === 'function'){
    global.setTileInteractable(self.z, loc[0], loc[1], self.id, self);
  }
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
  // Mark tile as interactable (same tile that was made unwalkable by blocker)
  var loc = getLoc(self.x, self.y, self);
  if(typeof global.setTileInteractable === 'function'){
    global.setTileInteractable(self.z, loc[0], loc[1], self.id, self);
  }
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
  // Mark tile as interactable (same tile that was made unwalkable by blocker)
  var loc = getLoc(self.x, self.y, self);
  if(typeof global.setTileInteractable === 'function'){
    global.setTileInteractable(self.z, loc[0], loc[1], self.id, self);
  }
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
  // Mark tile as interactable (same tile that was made unwalkable by blocker)
  var loc = getLoc(self.x, self.y, self);
  if(typeof global.setTileInteractable === 'function'){
    global.setTileInteractable(self.z, loc[0], loc[1], self.id, self);
  }
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
    if(!player) return; // Safety check: player doesn't exist (e.g., NPC without player entry)
    
    var socket = SOCKET_LIST[id];
    if(player.inventory.relic > 0){
      if(socket){
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying a</i> <b>Relic</b>.'}));
      }
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
  const parentItem = Item.list[self.parent];
  
  // Safety check: ensure parent item exists before accessing its properties
  if(!Item.list || !Item.list[self.parent]){
    console.error('Light constructor: Parent item not found in Item.list', {parentId: self.parent, lightId: self.id});
    self.toRemove = true; // Mark for removal if parent doesn't exist
    Light.list[self.id] = self;
    initPack.light.push(self.getInitPack());
    return self;
  }

  // Inherit map context from parent item or its parent entity (player/building)
  if (parentItem && global.mapContextHelpers) {
    let matchId = null;
    if (parentItem.battlegroundMatchId) {
      matchId = parentItem.battlegroundMatchId;
    } else if (parentItem.inBattleground && parentItem.battlegroundMatchId) {
      matchId = parentItem.battlegroundMatchId;
    } else if (parentItem.parent && Player.list && Player.list[parentItem.parent]) {
      matchId = Player.list[parentItem.parent].battlegroundMatchId || null;
    } else if (parentItem.parent && Building.list && Building.list[parentItem.parent]) {
      matchId = Building.list[parentItem.parent].battlegroundMatchId || null;
    }
    global.mapContextHelpers.setEntityContext(self, matchId);
  } else if (parentItem) {
    self.inBattleground = !!(parentItem.inBattleground && parentItem.battlegroundMatchId);
    self.battlegroundMatchId = parentItem.battlegroundMatchId || null;
  }
  
  if(Item.list[self.parent].type == 'LitTorch'){
    self.toUpdate = true;
    self.update = function(){
      if(Item.list[self.parent]){
        const torchItem = Item.list[self.parent];
        self.x = torchItem.x + (tileSize * 0.25);
        self.y = torchItem.y;
        self.z = torchItem.z;
        
        // CRITICAL: Inherit map context from torch's parent player
        if(torchItem.parent && Player.list[torchItem.parent]){
          const torchParent = Player.list[torchItem.parent];
          if(global.mapContextHelpers) {
            global.mapContextHelpers.setEntityContext(self, torchParent.battlegroundMatchId || null);
          } else {
            self.inBattleground = !!(torchParent.inBattleground && torchParent.battlegroundMatchId);
            self.battlegroundMatchId = torchParent.battlegroundMatchId || null;
          }
        }
      } else {
        self.toRemove = true;
      }
      super_update();
    }
  } else {
    // Campfire and Firepit lights don't need special update logic, just mark as updateable
    if(Item.list[self.parent].type == 'Campfire' || Item.list[self.parent].type == 'Firepit'){
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
      radius:self.radius,
      parent:self.parent, // Include parent to identify light sources (firepit, torch, etc.)
      inBattleground: !!(self.inBattleground && self.battlegroundMatchId),
      battlegroundMatchId: self.battlegroundMatchId || null
    };
  }

  self.getUpdatePack = function(){
    return {
      id:self.id,
      x:self.x,
      y:self.y,
      z:self.z,
      // Ensure radius is always defined (handle legacy lights)
      radius:self.radius !== undefined ? self.radius : 1,
      inBattleground: !!(self.inBattleground && self.battlegroundMatchId),
      battlegroundMatchId: self.battlegroundMatchId || null
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

// CAMERA/VIEWER ENTITY
// Camera entities represent viewer/camera positions for spatial filtering
// They replace the need to use player positions directly for determining what entities to send to clients
Camera = function(param){
  var self = Entity(param);

  // Camera properties
  self.id = param.id || Math.random();
  self.x = param.x || 0;
  self.y = param.y || 0;
  self.z = param.z || 0;
  self.mode = param.mode || 'player'; // 'player', 'godmode', 'spectate', 'login'
  self.locked = param.locked || false; // Whether camera is locked to a target
  self.lockedToEntityId = param.lockedToEntityId || null; // Entity ID camera is locked to
  self.ownerPlayerId = param.ownerPlayerId || null; // Associated player ID (null for spectators)
  self.context = param.context || null; // Additional context (battleground info, etc.)

  // Camera doesn't need updates - it's a static position marker for filtering
  self.update = function(){
    // Cameras don't move on their own - they're updated externally
  };

  self.getInitPack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      z: self.z,
      mode: self.mode,
      locked: self.locked,
      lockedToEntityId: self.lockedToEntityId,
      ownerPlayerId: self.ownerPlayerId,
      context: self.context
    };
  };

  self.getUpdatePack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      z: self.z,
      mode: self.mode,
      locked: self.locked,
      lockedToEntityId: self.lockedToEntityId,
      ownerPlayerId: self.ownerPlayerId,
      context: self.context
    };
  };

  // Camera registry
  Camera.list[self.id] = self;
  return self;
};

Camera.list = {};

// Get all cameras for initialization
Camera.getAllInitPack = function(){
  var pack = [];
  for(var i in Camera.list){
    pack.push(Camera.list[i].getInitPack());
  }
  return pack;
};

// Update all cameras (though cameras typically don't change frequently)
Camera.update = function(){
  var pack = [];
  for(var i in Camera.list){
    var camera = Camera.list[i];
    camera.update();
    pack.push(camera.getUpdatePack());
  }
  return pack;
};

// Helper to get viewer anchors for spatial filtering
Camera.getViewerAnchors = function(){
  var anchors = [];
  for(var i in Camera.list){
    var camera = Camera.list[i];
    anchors.push({
      x: camera.x,
      y: camera.y,
      z: camera.z,
      cameraId: camera.id,
      mode: camera.mode,
      ownerPlayerId: camera.ownerPlayerId,
      context: camera.context,
      inBattleground: camera.context && camera.context.inBattleground,
      battlegroundMatchId: camera.context ? camera.context.battlegroundMatchId : null
    });
  }
  return anchors;
};

// Export Camera globally
global.Camera = Camera;

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

  // Ensure weather context is set consistently (inherit from creator or explicit matchId)
  const creatorEntity = param.creatorId && Player.list ? Player.list[param.creatorId] : null;
  if (global.mapContextHelpers) {
    let matchId = null;
    if (param.battlegroundMatchId) {
      matchId = param.battlegroundMatchId;
    } else if (param.matchId) {
      matchId = param.matchId;
    } else if (param.inBattleground && param.battlegroundMatchId) {
      matchId = param.battlegroundMatchId;
    } else if (creatorEntity && creatorEntity.inBattleground && creatorEntity.battlegroundMatchId) {
      matchId = creatorEntity.battlegroundMatchId;
    }
    global.mapContextHelpers.setEntityContext(self, matchId);
  } else if (creatorEntity) {
    self.inBattleground = !!(creatorEntity.inBattleground && creatorEntity.battlegroundMatchId);
    self.battlegroundMatchId = creatorEntity.battlegroundMatchId || null;
  }
  
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
    const contextMapSize = global.mapContextManager
      ? global.mapContextManager.getMapSize(self)
      : mapSize;
    var mapBounds = contextMapSize * tileSize;
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
      intensity: self.intensity,
      inBattleground: !!(self.inBattleground && self.battlegroundMatchId),
      battlegroundMatchId: self.battlegroundMatchId || null
    };
  };
  
  self.getUpdatePack = function(){
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      weatherType: self.weatherType,
      intensity: self.intensity,
      inBattleground: !!(self.inBattleground && self.battlegroundMatchId),
      battlegroundMatchId: self.battlegroundMatchId || null
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
    
    // Assign to globals
    global.Sheep = entities.Sheep;
    global.Deer = entities.Deer;
    global.Boar = entities.Boar;
    global.Wolf = entities.Wolf;
    global.Falcon = entities.Falcon;
    
    console.log('✓ Modular fauna entities loaded successfully');
  } catch(err) {
    console.error('CRITICAL: Error loading modular entities:', err.message, err.stack);
    console.error('Providing minimal fallback fauna definitions...');
    
    // Fallback definitions (minimal functional entities if modular loading fails)
    global.Sheep = global.Sheep || function(param) {
      var self = Character(param);
      self.class = 'Sheep';
      return self;
    };
    
    global.Deer = global.Deer || function(param) {
      var self = Character(param);
      self.class = 'Deer';
      self.isPrey = true;
      return self;
    };
    
    global.Boar = global.Boar || function(param) {
      var self = Character(param);
      self.class = 'Boar';
      self.baseSpd = 5;
      self.damage = 12;
      return self;
    };
    
    global.Wolf = global.Wolf || function(param) {
      var self = Character(param);
      self.class = 'Wolf';
      self.baseSpd = 3;
      self.damage = 10;
      return self;
    };
    
    global.Falcon = global.Falcon || function(param) {
      var self = Character(param);
      self.class = 'Falcon';
      self.type = 'fauna';
      self.hp = null;
      return self;
    };
  }
};

// Module exports for new code to import constructors
// This allows gradual migration away from globals
module.exports = {
  Entity,
  get Player() { return global.Player; },
  Building,
  Character,
  Serf,
  SerfM,
  SerfF,
  Arrow,
  Item,
  Light,
  Weather,
  // Static methods
  initModularEntities
};
