// Streamlined Serf Behavior System
// This replaces the complex, buggy Serf logic with a clean state machine

class SerfBehaviorSystem {
  constructor() {
    this.states = {
      IDLE: 'idle',
      WORKING: 'working', 
      BUILDING: 'building',
      GOING_TO_WORK: 'going_to_work',
      GOING_HOME: 'going_home',
      GOING_TO_TAVERN: 'going_to_tavern',
      AT_TAVERN: 'at_tavern',
      STUCK: 'stuck'
    };
    
    this.workTypes = {
      ECONOMIC: 'economic', // mill, lumbermill, mine
      BUILDING: 'building'  // construction projects
    };
    
    this.debugMode = false; // Disabled to reduce console spam
  }

  // Initialize a Serf with clean state
  initializeSerf(serf) {
    serf.behaviorState = this.states.IDLE;
    serf.workTarget = null;
    serf.workType = null;
    serf.lastActionTime = Date.now();
    serf.stuckCounter = 0;
    serf.lastPosition = { x: serf.x, y: serf.y };
    serf.positionHistory = [];
    serf.maxPositionHistory = 10;
    
    // Assign work HQ
    this.assignWorkHQ(serf);
    
    // Find tavern
    this.findTavern(serf);
    
    this.log(serf, `Initialized - State: ${serf.behaviorState}, HQ: ${serf.work.hq ? 'assigned' : 'none'}, Tavern: ${serf.tavern ? 'found' : 'none'}`);
  }

  // Main update function - called every frame
  updateSerf(serf) {
    if (!serf || !serf.behaviorState) {
      this.initializeSerf(serf);
      return;
    }
    
    // Check if this is a fresh spawn with no work.hq
    // This happens for enemy NPC Serfs that just spawned
    if (!serf.work || !serf.work.hq) {
      // Try to assign work, if it fails after initialization, fall back to old system
      if (!serf.hasTriedInitialization) {
        this.assignWorkHQ(serf);
        serf.hasTriedInitialization = true;
      }
      
      // If still no work.hq after trying, this Serf might need the old system
      if (!serf.work || !serf.work.hq) {
        this.log(serf, 'No work HQ available, skipping behavior system update');
        // Don't update using new system, let old system handle it
        return;
      }
    }

    // Handle basic movement and terrain effects
    this.handleBasicMovement(serf);
    
    // Update position tracking for stuck detection
    this.updatePositionTracking(serf);
    
    // Check for stuck condition
    if (this.isStuck(serf)) {
      this.handleStuck(serf);
      return;
    }

    // Handle current state
    switch (serf.behaviorState) {
      case this.states.IDLE:
        this.handleIdle(serf);
        break;
      case this.states.WORKING:
        this.handleWorking(serf);
        break;
      case this.states.BUILDING:
        this.handleBuilding(serf);
        break;
      case this.states.GOING_TO_WORK:
        this.handleGoingToWork(serf);
        break;
      case this.states.GOING_HOME:
        this.handleGoingHome(serf);
        break;
      case this.states.GOING_TO_TAVERN:
        this.handleGoingToTavern(serf);
        break;
      case this.states.AT_TAVERN:
        this.handleAtTavern(serf);
        break;
      case this.states.STUCK:
        this.handleStuck(serf);
        break;
    }

    // Check day/night transitions
    this.checkDayNightTransition(serf);
    
    // Update position
    serf.updatePosition();
  }

  // Handle basic movement and terrain effects
  handleBasicMovement(serf) {
    const loc = global.getLoc(serf.x, serf.y);
    
    // Handle terrain effects and z-level changes
    if (serf.z === 0) {
      const tile = global.getTile(0, loc[0], loc[1]);
      
      // Cave entrance
      if (tile === 6) {
        serf.caveEntrance = loc;
        serf.z = -1;
        serf.path = null;
        serf.pathCount = 0;
        serf.innaWoods = false;
        serf.onMtn = false;
        serf.maxSpd = serf.baseSpd * serf.drag;
        return;
      }
      
      // Forest terrain
      if (tile >= 1 && tile < 2) {
        serf.innaWoods = true;
        serf.onMtn = false;
        serf.maxSpd = (serf.baseSpd * 0.3) * serf.drag;
      }
      // Brush terrain
      else if (tile >= 2 && tile < 4) {
        serf.innaWoods = false;
        serf.onMtn = false;
        serf.maxSpd = (serf.baseSpd * 0.5) * serf.drag;
      }
      // Light forest
      else if (tile >= 4 && tile < 5) {
        serf.innaWoods = false;
        serf.onMtn = false;
        serf.maxSpd = (serf.baseSpd * 0.6) * serf.drag;
      }
      // Mountain terrain
      else if (tile >= 5 && tile < 6) {
        serf.innaWoods = false;
        if (!serf.onMtn) {
          serf.maxSpd = (serf.baseSpd * 0.2) * serf.drag;
          setTimeout(() => {
            if (global.getTile(0, loc[0], loc[1]) >= 5 && global.getTile(0, loc[0], loc[1]) < 6) {
              serf.onMtn = true;
            }
          }, 2000);
        } else {
          serf.maxSpd = (serf.baseSpd * 0.5) * serf.drag;
        }
      }
      // Road terrain
      else if (tile === 18) {
        serf.innaWoods = false;
        serf.onMtn = false;
        serf.maxSpd = (serf.baseSpd * 1.1) * serf.drag;
      }
      // Building entrance
      else if (tile === 14 || tile === 16 || tile === 19) {
        const b = global.getBuilding(serf.x, serf.y);
        if (global.Building.list[b]) {
          global.Building.list[b].occ++;
          serf.z = 1;
          serf.path = null;
          serf.pathCount = 0;
          serf.innaWoods = false;
          serf.onMtn = false;
          serf.maxSpd = serf.baseSpd * serf.drag;
        }
      }
      // Default terrain
      else {
        serf.innaWoods = false;
        serf.onMtn = false;
        serf.maxSpd = serf.baseSpd * serf.drag;
      }
    } 
    else if (serf.z === 1) {
      // Inside a building - check for exit
      const exitTile = global.getTile(0, loc[0], loc[1] - 1);
      if (exitTile === 14 || exitTile === 16 || exitTile === 19) {
        const exit = global.getBuilding(serf.x, serf.y - global.tileSize);
        const BuildingList = global.Building ? global.Building.list : {};
        if (BuildingList[exit]) {
          BuildingList[exit].occ--;
        }
        serf.z = 0;
        serf.path = null;
        serf.pathCount = 0;
        serf.innaWoods = false;
        serf.onMtn = false;
        serf.maxSpd = serf.baseSpd * serf.drag;
        this.log(serf, 'Exited building');
      }
    }
    else if (serf.z === -1) {
      // In cave - check for exit
      if (global.getTile(1, loc[0], loc[1]) === 2) {
        serf.caveEntrance = null;
        serf.z = 0;
        serf.path = null;
        serf.pathCount = 0;
        serf.innaWoods = false;
        serf.onMtn = false;
        serf.maxSpd = (serf.baseSpd * 0.9) * serf.drag;
        this.log(serf, 'Exited cave');
      }
    }
    else if (serf.z === -3) {
      // Underwater - need to surface
      if (serf.breath > 0) {
        serf.breath -= 0.25;
      } else {
        serf.hp -= 0.5;
      }
      if (serf.hp !== null && serf.hp <= 0) {
        serf.die({cause: 'drowned'});
        return;
      }
      // Surface if on land
      if (global.getTile(0, loc[0], loc[1]) !== 0) {
        serf.z = 0;
        serf.path = null;
        serf.pathCount = 0;
        serf.breath = serf.breathMax;
        this.log(serf, 'Surfaced from water');
      }
    }
    
    // Handle path following
    if (serf.path && serf.pathCount < serf.path.length) {
      const next = serf.path[serf.pathCount];
      const dest = global.getCenter(next[0], next[1]);
      const dx = dest[0];
      const dy = dest[1];
      const diffX = dx - serf.x;
      const diffY = dy - serf.y;

      if (diffX >= serf.maxSpd) {
        serf.x += serf.maxSpd;
        serf.pressingRight = true;
        serf.facing = 'right';
      } else if (diffX <= (0 - serf.maxSpd)) {
        serf.x -= serf.maxSpd;
        serf.pressingLeft = true;
        serf.facing = 'left';
      }
      
      if (diffY >= serf.maxSpd) {
        serf.y += serf.maxSpd;
        serf.pressingDown = true;
        serf.facing = 'down';
      } else if (diffY <= (0 - serf.maxSpd)) {
        serf.y -= serf.maxSpd;
        serf.pressingUp = true;
        serf.facing = 'up';
      }
      
      if ((diffX < serf.maxSpd && diffX > (0 - serf.maxSpd)) && 
          (diffY < serf.maxSpd && diffY > (0 - serf.maxSpd))) {
        serf.pressingRight = false;
        serf.pressingLeft = false;
        serf.pressingDown = false;
        serf.pressingUp = false;
        serf.pathCount++;
      }
    } else {
      // Clear movement keys when no path
      serf.pressingRight = false;
      serf.pressingLeft = false;
      serf.pressingDown = false;
      serf.pressingUp = false;
    }
  }

  // Position tracking for stuck detection
  updatePositionTracking(serf) {
    const currentPos = { x: serf.x, y: serf.y };
    
    // Add to position history
    serf.positionHistory.push(currentPos);
    if (serf.positionHistory.length > serf.maxPositionHistory) {
      serf.positionHistory.shift();
    }
    
    serf.lastPosition = currentPos;
  }

  // Improved stuck detection
  isStuck(serf) {
    if (serf.positionHistory.length < 5) return false;
    
    // Check if serf has been in the same general area for too long
    const recentPositions = serf.positionHistory.slice(-5);
    const firstPos = recentPositions[0];
    const lastPos = recentPositions[recentPositions.length - 1];
    
    const distance = Math.sqrt(
      Math.pow(lastPos.x - firstPos.x, 2) + 
      Math.pow(lastPos.y - firstPos.y, 2)
    );
    
    // If serf has moved less than 64 pixels in 5 updates, consider stuck
    if (distance < 64) {
      serf.stuckCounter++;
      return serf.stuckCounter > 10; // Stuck for 10+ frames
    } else {
      serf.stuckCounter = 0;
      return false;
    }
  }

  // Handle stuck serf
  handleStuck(serf) {
    this.log(serf, 'STUCK - Attempting recovery');
    
    // Clear current path and action
    serf.path = null;
    serf.pathCount = 0;
    serf.action = null;
    
    // Try different recovery strategies
    if (serf.behaviorState === this.states.GOING_TO_WORK) {
      // If going to work, try to find a different work spot
      this.findWorkTarget(serf);
    } else if (serf.behaviorState === this.states.GOING_HOME) {
      // If going home, try to find home again
      this.findHomeTarget(serf);
    } else {
      // Default: go to idle state
      this.setState(serf, this.states.IDLE);
    }
    
    // Reset stuck counter
    serf.stuckCounter = 0;
  }

  // State management
  setState(serf, newState, reason = '') {
    const oldState = serf.behaviorState;
    serf.behaviorState = newState;
    serf.lastActionTime = Date.now();
    
    // Clear path when changing states
    serf.path = null;
    serf.pathCount = 0;
    serf.action = null;
    
    this.log(serf, `State change: ${oldState} -> ${newState} ${reason ? '(' + reason + ')' : ''}`);
  }

  // Handle idle state
  handleIdle(serf) {
    // Check if it's time to work
    if (this.shouldStartWork(serf)) {
      this.setState(serf, this.states.GOING_TO_WORK, 'time to work');
      return;
    }
    
    // Check if it's time to go to tavern
    if (this.shouldGoToTavern(serf)) {
      this.setState(serf, this.states.GOING_TO_TAVERN, 'time for tavern');
      return;
    }
    
    // Stay idle
    serf.action = 'idle';
  }

  // Handle going to work
  handleGoingToWork(serf) {
    if (!serf.workTarget) {
      this.findWorkTarget(serf);
    }
    
    if (serf.workTarget) {
      // Ensure work target has z property
      if (!serf.workTarget.z) {
        serf.workTarget.z = 0; // Work is usually on overworld
      }
      
      // Move to work target
      this.moveToTarget(serf, serf.workTarget, () => {
        this.setState(serf, this.states.WORKING, 'arrived at work');
      });
    } else {
      // No work available, go idle
      this.setState(serf, this.states.IDLE, 'no work available');
    }
  }

  // Handle working state
  handleWorking(serf) {
    if (!serf.workTarget) {
      this.setState(serf, this.states.IDLE, 'no work target');
      return;
    }
    
    // Check if still at work location
    const distance = this.getDistance(serf, serf.workTarget);
    if (distance > 128) { // More than 2 tiles away
      this.setState(serf, this.states.GOING_TO_WORK, 'moved away from work');
      return;
    }
    
    // Perform work
    this.performWork(serf);
    
    // Check if work is done
    if (this.isWorkComplete(serf)) {
      this.setState(serf, this.states.IDLE, 'work complete');
    }
  }

  // Handle building state
  handleBuilding(serf) {
    if (!serf.workTarget) {
      this.setState(serf, this.states.IDLE, 'no build target');
      return;
    }
    
    // Check if still at build location
    const distance = this.getDistance(serf, serf.workTarget);
    if (distance > 128) { // More than 2 tiles away
      this.setState(serf, this.states.GOING_TO_WORK, 'moved away from build site');
      return;
    }
    
    // Perform building
    this.performBuilding(serf);
    
    // Check if building is complete
    if (this.isBuildingComplete(serf)) {
      this.setState(serf, this.states.IDLE, 'building complete');
    }
  }

  // Handle going home
  handleGoingHome(serf) {
    if (!serf.home) {
      this.setState(serf, this.states.IDLE, 'no home');
      return;
    }
    
    const homeTarget = { 
      x: serf.home.loc[0] * 64, 
      y: serf.home.loc[1] * 64,
      z: serf.home.z || 0
    };
    this.moveToTarget(serf, homeTarget, () => {
      this.setState(serf, this.states.IDLE, 'arrived home');
    });
  }

  // Handle going to tavern
  handleGoingToTavern(serf) {
    if (!serf.tavern) {
      this.setState(serf, this.states.IDLE, 'no tavern');
      return;
    }
    
    const tavernTarget = { 
      x: serf.tavern.x, 
      y: serf.tavern.y,
      z: 0 // Taverns are on overworld level, but you enter them at z=1
    };
    this.moveToTarget(serf, tavernTarget, () => {
      this.setState(serf, this.states.AT_TAVERN, 'arrived at tavern');
    });
  }

  // Handle at tavern
  handleAtTavern(serf) {
    // Stay at tavern for a while, then go home
    const timeAtTavern = Date.now() - serf.lastActionTime;
    if (timeAtTavern > 30000) { // 30 seconds at tavern
      this.setState(serf, this.states.GOING_HOME, 'tavern time over');
    }
  }

  // Day/night transition logic
  checkDayNightTransition(serf) {
    const currentTime = global.tempus || 'VI.a';
    
    // Morning - start work
    if (currentTime === 'VI.a' && serf.behaviorState === this.states.IDLE) {
      this.setState(serf, this.states.GOING_TO_WORK, 'morning work time');
    }
    
    // Evening - finish work
    if (currentTime === 'VI.p' && (serf.behaviorState === this.states.WORKING || serf.behaviorState === this.states.BUILDING)) {
      this.setState(serf, this.states.IDLE, 'evening - work done');
    }
    
    // Night - go to tavern or home
    if (currentTime === 'XI.p' && serf.behaviorState === this.states.IDLE) {
      if (serf.tavern && Math.random() < 0.7) { // 70% chance to go to tavern
        this.setState(serf, this.states.GOING_TO_TAVERN, 'night tavern time');
      } else {
        this.setState(serf, this.states.GOING_HOME, 'night home time');
      }
    }
  }

  // Work assignment
  assignWorkHQ(serf) {
    if (!serf.house) return;
    
    let bestHQ = null;
    let bestDistance = Infinity;
    
    // Look for work buildings in the same house
    const BuildingList = global.Building ? global.Building.list : (typeof Building !== 'undefined' ? Building.list : {});
    for (const [id, building] of Object.entries(BuildingList)) {
      if (building.house === serf.house && 
          (building.type === 'mill' || building.type === 'lumbermill' || building.type === 'mine')) {
        const distance = this.getDistance(serf, building);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestHQ = id;
        }
      }
    }
    
    if (bestHQ) {
      serf.work.hq = bestHQ;
      const BuildingList = global.Building ? global.Building.list : (typeof Building !== 'undefined' ? Building.list : {});
      this.log(serf, `Assigned to work at ${BuildingList[bestHQ].type}`);
    } else {
      this.log(serf, `No work buildings found for house ${serf.house}`);
    }
  }

  // Find work target
  findWorkTarget(serf) {
    if (!serf.work.hq) {
      this.assignWorkHQ(serf);
      if (!serf.work.hq) return null;
    }
    
    const BuildingList = global.Building ? global.Building.list : (typeof Building !== 'undefined' ? Building.list : {});
    const hq = BuildingList[serf.work.hq];
    if (!hq) return null;
    
    // Check for building projects first
    if (this.findBuildingProject(serf)) {
      return serf.workTarget;
    }
    
    // Check for economic work
    if (hq.resources && hq.resources.length > 0) {
      const availableSpots = hq.resources.filter(resource => {
        const distance = this.getDistance(hq, { x: resource[0] * 64, y: resource[1] * 64 });
        return distance <= 1280; // Within reasonable distance
      });
      
      if (availableSpots.length > 0) {
        const selectedSpot = availableSpots[Math.floor(Math.random() * availableSpots.length)];
        serf.workTarget = { x: selectedSpot[0] * 64, y: selectedSpot[1] * 64 };
        serf.workType = this.workTypes.ECONOMIC;
        this.log(serf, `Found economic work at ${selectedSpot}`);
        return serf.workTarget;
      }
    }
    
    return null;
  }

  // Find home target
  findHomeTarget(serf) {
    if (!serf.home) {
      this.log(serf, 'No home defined');
      return null;
    }
    
    const homeTarget = { x: serf.home.loc[0] * 64, y: serf.home.loc[1] * 64 };
    this.log(serf, `Found home target at ${homeTarget.x}, ${homeTarget.y}`);
    return homeTarget;
  }

  // Find building project
  findBuildingProject(serf) {
    if (!serf.house) return false;
    
    const BuildingList = global.Building ? global.Building.list : (typeof Building !== 'undefined' ? Building.list : {});
    for (const [id, building] of Object.entries(BuildingList)) {
      if (building.house === serf.house && !building.built) {
        const distance = this.getDistance(serf, building);
        if (distance <= 1280) {
          // Find available build spots
          const availableSpots = building.plot.filter(plot => {
            const tile = global.tilemapSystem.getTile(0, plot[0], plot[1]);
            return tile === 11 || tile === 11.5; // Foundation tiles
          });
          
          if (availableSpots.length > 0) {
            const selectedSpot = availableSpots[Math.floor(Math.random() * availableSpots.length)];
            serf.workTarget = { x: selectedSpot[0] * 64, y: selectedSpot[1] * 64 };
            serf.workType = this.workTypes.BUILDING;
            this.log(serf, `Found building project: ${building.type}`);
            return true;
          }
        }
      }
    }
    
    return false;
  }

  // Find tavern
  findTavern(serf) {
    if (!serf.house) return;
    
    let bestTavern = null;
    let bestDistance = Infinity;
    
    const BuildingList = global.Building ? global.Building.list : (typeof Building !== 'undefined' ? Building.list : {});
    for (const [id, building] of Object.entries(BuildingList)) {
      if (building.house === serf.house && building.type === 'tavern') {
        const distance = this.getDistance(serf, building);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestTavern = id;
        }
      }
    }
    
    if (bestTavern) {
      const BuildingList = global.Building ? global.Building.list : (typeof Building !== 'undefined' ? Building.list : {});
      serf.tavern = BuildingList[bestTavern];
      this.log(serf, 'Found tavern');
    } else {
      this.log(serf, 'No tavern found');
    }
  }

  // Movement helper
  moveToTarget(serf, target, onArrive) {
    const distance = this.getDistance(serf, target);
    
    if (distance < 64) { // Within 1 tile
      if (onArrive) onArrive();
      return;
    }
    
    // If in a building and target is outside, first move to the exit
    if (serf.z === 1 && target.z !== 1) {
      // Find the building exit by moving one tile up (north)
      const loc = global.getLoc(serf.x, serf.y);
      const exitLoc = [loc[0], loc[1] - 1];
      const exitCenter = global.getCenter(exitLoc[0], exitLoc[1]);
      const distToExit = this.getDistance(serf, {x: exitCenter[0], y: exitCenter[1]});
      
      if (distToExit > 32) {
        // Not at exit yet, move there first
        this.log(serf, 'Moving to building exit');
        serf.path = [exitLoc];
        serf.pathCount = 0;
        serf.action = 'move';
        return;
      }
      // At exit, will transition on next update
      return;
    }
    
    // Use existing pathfinding system
    const start = global.getLoc(serf.x, serf.y);
    const end = global.getLoc(target.x, target.y);
    
    if (serf.z === 0) {
      const path = global.tilemapSystem.findPath(start, end, 0);
      if (path && path.length > 0) {
        serf.path = path;
        serf.pathCount = 0;
        serf.action = 'move';
        this.log(serf, `Pathfinding to [${end[0]},${end[1]}], path length: ${path.length}`);
      } else {
        this.log(serf, `Pathfinding failed to [${end[0]},${end[1]}]`);
      }
    }
  }

  // Work performance
  performWork(serf) {
    if (serf.workType === this.workTypes.ECONOMIC) {
      // Economic work (mill, lumbermill, mine)
      const BuildingList = global.Building ? global.Building.list : (typeof Building !== 'undefined' ? Building.list : {});
      const hq = BuildingList[serf.work.hq];
      if (hq && hq.resources) {
        // Add resources to the building
        const resourceType = hq.type === 'mill' ? 'food' : 
                           hq.type === 'lumbermill' ? 'wood' : 'stone';
        const amount = Math.floor(Math.random() * 10) + 5; // 5-15 resources
        
        if (!hq.resourceCount) hq.resourceCount = {};
        hq.resourceCount[resourceType] = (hq.resourceCount[resourceType] || 0) + amount;
        
        this.log(serf, `${hq.type} added ${amount} ${resourceType}`);
      }
    }
  }

  // Building performance
  performBuilding(serf) {
    // Find the building being constructed
    const BuildingList = global.Building ? global.Building.list : (typeof Building !== 'undefined' ? Building.list : {});
    for (const [id, building] of Object.entries(BuildingList)) {
      if (building.house === serf.house && !building.built) {
        const distance = this.getDistance(serf, building);
        if (distance <= 1280) {
          // Progress the building construction
          if (!building.constructionProgress) building.constructionProgress = 0;
          building.constructionProgress += 1;
          
          if (building.constructionProgress >= 100) {
            building.built = true;
            this.log(serf, `Completed building: ${building.type}`);
          }
          break;
        }
      }
    }
  }

  // Utility functions
  getDistance(obj1, obj2) {
    return Math.sqrt(
      Math.pow(obj2.x - obj1.x, 2) + 
      Math.pow(obj2.y - obj1.y, 2)
    );
  }

  shouldStartWork(serf) {
    const currentTime = global.tempus || 'VI.a';
    return currentTime === 'VI.a' || currentTime === 'I.a' || currentTime === 'II.a';
  }

  shouldGoToTavern(serf) {
    const currentTime = global.tempus || 'VI.a';
    return currentTime === 'XI.p' || currentTime === 'XII.p';
  }

  isWorkComplete(serf) {
    // Work is complete when it's evening or when no more work is available
    const currentTime = global.tempus || 'VI.a';
    return currentTime === 'VI.p' || !this.findWorkTarget(serf);
  }

  isBuildingComplete(serf) {
    // Check if the building being constructed is complete
    const BuildingList = global.Building ? global.Building.list : (typeof Building !== 'undefined' ? Building.list : {});
    for (const [id, building] of Object.entries(BuildingList)) {
      if (building.house === serf.house && !building.built) {
        return false; // Still has incomplete buildings
      }
    }
    return true; // All buildings complete
  }

  // Logging
  log(serf, message) {
    if (this.debugMode) {
      console.log(`[${serf.name}] ${message}`);
    }
  }
}

module.exports = SerfBehaviorSystem;
