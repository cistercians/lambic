// SimpleSerfBehavior - Simple action-based serf behavior system
// Modeled after military unit pattern: simple action checks, direct pathfinding
// Work buildings are pre-assigned at spawn - no reassignment needed

const timerManager = global.timerManager || null;
const movementSystem = require('./MovementSystem');

class SimpleSerfBehavior {
  constructor() {
    this.BUILDING_SHARE = 0.85; // 85% to building
    this.SERF_WAGE = 0.15; // 15% wage for serf
    this.logThrottle = {}; // Throttle frequent logs: {serfId: {lastLogTime: timestamp, lastState: state}}
    this.LOG_THROTTLE_MS = 5000; // Only log same message every 5 seconds per serf
  }

  getSerfLogger() {
    return global.serfLogger || null;
  }

  setSerfDebug(serf, data) {
    if (!serf || !data || typeof data !== 'object') return;
    if (!serf._serfDebug) {
      serf._serfDebug = {};
    }
    Object.assign(serf._serfDebug, data, { at: Date.now() });
  }

  setSerfState(serf, nextState, reason = '') {
    if (!serf) return;
    const prevState = serf.serfState || null;
    if (prevState === nextState) return;
    serf.serfState = nextState;
    this.setSerfDebug(serf, {
      lastState: nextState,
      lastStateFrom: prevState || 'none',
      lastStateReason: reason || null,
      lastAction: serf.action || null,
      lastMode: serf.mode || null
    });
    const logger = this.getSerfLogger();
    if (logger && typeof logger.stateTransition === 'function') {
      try {
        logger.stateTransition(serf, prevState || 'none', nextState, reason);
      } catch (error) {
        // Ignore logging failures
      }
    }
  }

  enterFleeState(serf) {
    if (!serf || serf._fleeInitialized) return;
    this.clearWorkTimers(serf);
    serf.path = null;
    serf.pathCount = 0;
    serf.working = false;
    serf.farming = false;
    serf.chopping = false;
    serf.mining = false;
    serf._fleeInitialized = true;
    this.setSerfState(serf, 'fleeing', 'enterFlee');
  }

  recoverFromFlee(serf) {
    if (!serf) return;
    const preFlee = serf._preFleeState || {};
    if (typeof preFlee.mode === 'string') {
      serf.mode = preFlee.mode;
    }
    serf.action = null;
    serf.path = null;
    serf.pathCount = 0;
    serf._fleeInitialized = false;
    serf._pendingFleeRecovery = false;
    serf._preFleeState = null;
    const logger = this.getSerfLogger();
    if (logger && typeof logger.info === 'function') {
      logger.info('Recovered from flee', serf, { reason: serf._fleeEndReason || null });
    }
    serf._fleeEndReason = null;
    const nextState = (serf.mode === 'work') ? 'working' : 'idle';
    this.setSerfState(serf, nextState, 'recoverFromFlee');
  }

  findAdjacentWalkableTile(z, spot, serf = null) {
    if (!spot || !Array.isArray(spot) || spot.length !== 2) return null;
    const candidates = [
      [spot[0] + 1, spot[1]],
      [spot[0] - 1, spot[1]],
      [spot[0], spot[1] + 1],
      [spot[0], spot[1] - 1]
    ];
    const walkable = [];
    for (const tile of candidates) {
      if (global.isWalkable && global.isWalkable(z, tile[0], tile[1], serf)) {
        walkable.push(tile);
      }
    }
    if (walkable.length === 0) return null;
    if (!serf) return walkable[0];
    const loc = this.getLoc(serf);
    let best = walkable[0];
    let bestDist = Infinity;
    for (const tile of walkable) {
      const dist = Math.abs(tile[0] - loc[0]) + Math.abs(tile[1] - loc[1]);
      if (dist < bestDist) {
        bestDist = dist;
        best = tile;
      }
    }
    return best;
  }

  getWorkTileForSpot(serf, spot, z) {
    if (!serf || !spot || typeof z !== 'number') return null;
    if (global.isWalkable && global.isWalkable(z, spot[0], spot[1], serf)) {
      return spot;
    }
    const spotKey = Array.isArray(spot) ? `${z}:${spot.toString()}` : '';
    if (serf.work && serf.work.workTile && serf.work.workTileFor === spotKey) {
      const workTile = serf.work.workTile;
      if (global.isWalkable && global.isWalkable(z, workTile[0], workTile[1], serf)) {
        return workTile;
      }
    }
    let workTile = this.findAdjacentWalkableTile(z, spot, serf);
    if (!workTile && typeof serf.findNearestWalkableTile === 'function') {
      workTile = serf.findNearestWalkableTile(spot[0], spot[1], z, 2);
    }
    if (serf.work) {
      serf.work.workTile = workTile;
      serf.work.workTileFor = workTile ? spotKey : null;
    }
    return workTile;
  }

  resolveWalkableTarget(serf, z, target) {
    if (!serf || !target || !Array.isArray(target) || target.length !== 2) return target;
    if (global.isWalkable && global.isWalkable(z, target[0], target[1], serf)) {
      return target;
    }
    if (typeof serf.findNearestWalkableTile === 'function') {
      const fallback = serf.findNearestWalkableTile(target[0], target[1], z, 3);
      if (fallback && Array.isArray(fallback) && fallback.length === 2) {
        return fallback;
      }
    }
    return target;
  }

  isNightTime() {
    if (global.gameState && typeof global.gameState.nightfall === 'boolean') {
      return global.gameState.nightfall;
    }
    if (typeof global.nightfall === 'boolean') {
      return global.nightfall;
    }
    return false;
  }

  tryReassignWork(serf) {
    if (!serf || typeof serf.assignWorkHQ !== 'function') return false;
    const now = Date.now();
    if (serf._nextWorkAssignTime && now < serf._nextWorkAssignTime) {
      return false;
    }
    serf._nextWorkAssignTime = now + 10000;
    try {
      serf.assignWorkHQ();
      if (serf.work && serf.work.hq) {
        serf.mode = 'work';
        return true;
      }
    } catch (error) {
      // Ignore assignment errors
    }
    return false;
  }

  getValidWorkBuildingTypes(serf) {
    if (!serf) return [];
    if (serf.sex === 'f') {
      return ['mill', 'farm'];
    }
    return ['mill', 'farm', 'lumbermill', 'mine', 'dock'];
  }

  isHutBuilding(building) {
    if (!building || !building.type) return false;
    return String(building.type).toLowerCase().includes('hut');
  }

  getHouseSerfs(houseId) {
    if (!houseId || !global.Player || !global.Player.list) return [];
    return Object.values(global.Player.list).filter(entity => {
      if (!entity) return false;
      const isSerf = entity.class === 'Serf' || entity.class === 'SerfM' || entity.class === 'SerfF';
      return isSerf && entity.house === houseId;
    });
  }

  findBuildableTile(building) {
    if (!building || !building.plot || !Array.isArray(building.plot)) return null;
    for (const tile of building.plot) {
      if (Array.isArray(tile) && tile.length === 2) {
        const gt = global.getTile ? global.getTile(0, tile[0], tile[1]) : null;
        if (gt === 11) {
          return tile;
        }
      }
    }
    return null;
  }

  getBuildAssistTarget(serf) {
    if (!serf || !serf.house || !global.Building || !global.Building.list) return null;
    if (serf.hut && global.Building.list[serf.hut] && !global.Building.list[serf.hut].built) {
      return null;
    }

    const allSerfs = this.getHouseSerfs(serf.house);
    const eligibleSerfs = allSerfs.filter(entity => {
      if (!entity) return false;
      if (entity.action === 'build') return false;
      if (entity.hut && global.Building.list[entity.hut] && !global.Building.list[entity.hut].built) {
        return false;
      }
      return true;
    });

    if (!eligibleSerfs.length) return null;
    const builderCount = Math.max(1, Math.floor(eligibleSerfs.length * 0.25));
    const selectedSerfs = eligibleSerfs
      .slice()
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .slice(0, builderCount);

    const isSelected = selectedSerfs.some(entity => entity.id === serf.id);
    if (!isSelected) return null;

    const buildings = Object.values(global.Building.list).filter(b => {
      if (!b || b.house !== serf.house || b.built) return false;
      if (this.isHutBuilding(b)) return false;
      return !!this.findBuildableTile(b);
    });

    if (!buildings.length) return null;

    let best = null;
    let bestDistance = Infinity;
    for (const b of buildings) {
      const dist = global.getDistance
        ? global.getDistance({ x: serf.x, y: serf.y }, { x: b.x, y: b.y })
        : Math.hypot((serf.x || 0) - (b.x || 0), (serf.y || 0) - (b.y || 0));
      if (dist < bestDistance) {
        bestDistance = dist;
        best = b;
      }
    }

    return best;
  }

  assignBuildAssist(serf, building) {
    if (!serf || !building) return false;
    serf._buildAssistBuilding = building.id;
    serf.work.spot = null;
    serf.work.assignedSpot = null;
    serf.action = 'build';
    return true;
  }

  logWorkHqNull(serf, reason, extra = {}) {
    if (!serf) return;
    const logger = this.getSerfLogger();
    if (!logger || typeof logger.warn !== 'function') return;
    const now = Date.now();
    const throttleKey = `workHqNull-${serf.id}`;
    const lastLog = this.logThrottle[throttleKey];
    if (lastLog && (now - lastLog) < this.LOG_THROTTLE_MS * 2) return;
    logger.warn('Work HQ set to null', serf, Object.assign({
      reason: reason || 'unknown',
      mode: serf.mode || null,
      action: serf.action || null
    }, extra || {}));
    this.logThrottle[throttleKey] = now;
  }

  tryReassignWorkToAlternative(serf, excludeBuildingId) {
    if (!serf || !global.Building || !global.Building.list) return false;
    const validTypes = this.getValidWorkBuildingTypes(serf);
    const candidates = Object.values(global.Building.list).filter(b => {
      if (!b || b.id === excludeBuildingId) return false;
      if (b.house !== serf.house) return false;
      if (!b.built) return false;
      if (!validTypes.includes(b.type)) return false;
      if (Array.isArray(b.resources) && b.resources.length === 0) return false;
      return true;
    });

    if (!candidates.length) return false;
    let best = null;
    let bestDistance = Infinity;
    for (const b of candidates) {
      const dist = global.getDistance
        ? global.getDistance({ x: serf.x, y: serf.y }, { x: b.x, y: b.y })
        : Math.hypot((serf.x || 0) - (b.x || 0), (serf.y || 0) - (b.y || 0));
      if (dist < bestDistance) {
        bestDistance = dist;
        best = b;
      }
    }

    if (!best) return false;
    serf.work.hq = best.id;
    serf.work.spot = null;
    serf.work.assignedSpot = null;
    serf.work.workTile = null;
    serf.work.workTileFor = null;
    serf.mode = 'work';
    return true;
  }

  evaluateBuildingDepletion(building) {
    if (!building) return { depleted: false, resourceCount: 0 };
    let resourceCount = Array.isArray(building.resources) ? building.resources.length : 0;

    if (building.updateResources && typeof building.updateResources === 'function') {
      try {
        building.updateResources();
        resourceCount = Array.isArray(building.resources) ? building.resources.length : 0;
      } catch (error) {
        // Ignore update errors
      }
    }

    if (resourceCount === 0 && building.type === 'mine' && typeof building.getRes === 'function') {
      try {
        building.getRes();
        resourceCount = Array.isArray(building.resources) ? building.resources.length : 0;
      } catch (error) {
        // Ignore getRes errors
      }
    }

    return { depleted: resourceCount === 0, resourceCount };
  }

  notifyDepletedBuilding(serf, building, reason) {
    const house = this.getBuildingHouse(building);
    if (!house || !house.ai || !house.ai.productionMonitor) return;
    if (house.ai.isNonEconomicFaction && house.ai.isNonEconomicFaction()) return;
    if (typeof house.ai.productionMonitor.requestRebuildForBuilding === 'function') {
      house.ai.productionMonitor.requestRebuildForBuilding(building, {
        serfId: serf ? serf.id : null,
        reason: reason || 'depleted_resources'
      });
    }
  }

  getWorkZ(building) {
    if (!building || !building.type) return 0;
    return (building.type === 'mine' && building.cave) ? -1 : 0;
  }

  getLoc(entity) {
    if (!entity) return [0, 0];
    return global.getLoc ? global.getLoc(entity.x, entity.y, entity) : [
      Math.floor(entity.x / 64),
      Math.floor(entity.y / 64)
    ];
  }

  getTile(entity, layer, c, r) {
    return global.getTile ? global.getTile(layer, c, r, entity) : 0;
  }

  tileChange(entity, layer, c, r, value, incr = false) {
    if (typeof global.tileChange === 'function') {
      global.tileChange(layer, c, r, value, incr, entity);
    }
  }

  matrixChange(entity, layer, c, r, value) {
    if (typeof global.matrixChange === 'function') {
      global.matrixChange(layer, c, r, value, entity);
    }
  }

  /**
   * Main update method - called from Entity.js
   * Simple action-based system like military units
   */
  update(serf) {
    try {
      if (!serf) return;

      // Ensure required properties exist
      if (!serf.work) {
        serf.work = { hq: null, spot: null, assignedSpot: null, workTile: null, workTileFor: null };
      }
      if (!serf.inventory) {
        serf.inventory = {};
      }
      if (!serf.stores) {
        serf.stores = {};
      }

      this.trackMovementStall(serf);

      if (serf._pendingFleeRecovery && serf.action !== 'flee') {
        this.recoverFromFlee(serf);
      }

      // Handle actions (like military units)
      if (!serf.action) {
        this.handleDefaultWork(serf);
      } else if (serf.action === 'deposit') {
        this.handleDeposit(serf);
      } else if (serf.action === 'build') {
        this.handleBuild(serf);
      } else if (serf.action === 'clockout') {
        this.handleClockout(serf);
      } else if (serf.action === 'task') {
        this.handleTask(serf);
      } else if (serf.action === 'flee') {
        // Use SimpleFlee system for fleeing
        this.enterFleeState(serf);
        if (global.simpleFlee) {
          global.simpleFlee.update(serf);
        }
      } else if (serf.mode !== 'work') {
        this.handleWandering(serf);
      } else {
        this.handleUnknownAction(serf);
      }
    } catch (error) {
      // Simple error handling - reset to safe state
      if (serf) {
        const now = Date.now();
        const throttleKey = `updateError-${serf.id}`;
        const lastLog = this.logThrottle[throttleKey];
        if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS) {
          const logger = this.getSerfLogger();
          if (logger && typeof logger.error === 'function') {
            logger.error('Serf update error', error, serf);
          } else {
            console.error('[SERF] Update error:', error);
          }
          this.logThrottle[throttleKey] = now;
        }
        this.setSerfDebug(serf, {
          lastError: error ? error.message : 'unknown',
          lastErrorStack: error ? error.stack : null
        });
        serf.path = null;
        serf.pathCount = 0;
        serf.action = null;
      }
    }
  }

  /**
   * Detect and recover from prolonged movement stalls
   */
  trackMovementStall(serf) {
    if (!serf) return;
    const isMovingState = (
      serf.action === 'deposit' ||
      serf.action === 'build' ||
      serf.action === 'clockout' ||
      serf.action === 'task' ||
      (!serf.action && serf.mode === 'work')
    );

    if (!isMovingState || serf.working || serf.farming || serf.chopping || serf.mining) {
      serf.stuckCounter = 0;
      serf.lastPos = { x: serf.x, y: serf.y };
      return;
    }

    if (!serf.lastPos) {
      serf.lastPos = { x: serf.x, y: serf.y };
      serf.stuckCounter = 0;
      return;
    }

    const dx = Math.abs(serf.x - serf.lastPos.x);
    const dy = Math.abs(serf.y - serf.lastPos.y);
    const moved = dx > 1 || dy > 1;

    if (moved) {
      serf.lastPos = { x: serf.x, y: serf.y };
      serf.stuckCounter = 0;
      return;
    }

    serf.stuckCounter = (serf.stuckCounter || 0) + 1;
    const now = Date.now();
    if (serf.stuckCounter > 120 && (!serf._nextStuckRecovery || now >= serf._nextStuckRecovery)) {
      serf._nextStuckRecovery = now + 3000;
      this.recoverFromStuck(serf);
      serf.stuckCounter = 0;
    }
  }

  /**
   * Recover serf from a stuck movement state
   */
  recoverFromStuck(serf) {
    if (!serf) return;
    const logger = this.getSerfLogger();

    serf.path = null;
    serf.pathCount = 0;
    serf.pathEnd = null;

    if (serf.action === 'deposit' || serf.action === 'clockout') {
      serf.action = null;
      this.setSerfDebug(serf, { lastFailure: 'stuck_recovery_deposit' });
      return;
    }

    if (serf.action === 'build') {
      if (serf.work) {
        serf.work.spot = null;
      }
      serf.action = null;
      this.setSerfDebug(serf, { lastFailure: 'stuck_recovery_build' });
      return;
    }

    if (!serf.action && serf.mode === 'work' && serf.work) {
      serf.work.spot = null;
      serf.work.assignedSpot = null;
      serf.work.workTile = null;
      serf.work.workTileFor = null;
      this.setSerfDebug(serf, { lastFailure: 'stuck_recovery_work' });
    }
  }

  /**
   * Handle default work behavior (action === null)
   * Work building is pre-assigned at spawn
   */
  handleDefaultWork(serf) {
    if (serf.mode !== 'work') {
      const needsHutBuild = !!(serf.hut && global.Building && global.Building.list && global.Building.list[serf.hut] && !global.Building.list[serf.hut].built);
      if (needsHutBuild && serf.work && serf.work.hq) {
        serf.mode = 'work';
      } else if (!this.isNightTime()) {
        if (!serf.work || !serf.work.hq) {
          this.tryReassignWork(serf);
        }
        if (serf.work && serf.work.hq) {
          serf.mode = 'work';
        }
      }
      if (serf.mode !== 'work') {
      // Log when serfs are not in work mode (for cave mine debugging, throttled)
      if (serf.work && serf.work.hq && global.Building && global.Building.list) {
        const building = global.Building.list[serf.work.hq];
        if (building && building.type === 'mine' && building.cave) {
          const now = Date.now();
          const throttleKey = `caveMineIdle-${serf.id}`;
          const lastLog = this.logThrottle[throttleKey];
          // Increase throttle time to 30 seconds (6x default) to reduce spam
          if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 6) {
            const factionName = serf.house && global.House && global.House.list 
              ? (global.House.list[serf.house]?.name || 'Unknown')
              : 'Unknown';
            console.warn(`[SERF WORK] ${factionName}: Cave mine serf not in 'work' mode - mode: ${serf.mode}, work.hq: ${serf.work.hq}, hut: ${serf.hut || 'none'}`);
            this.logThrottle[throttleKey] = now;
          }
        }
      }
      this.setSerfState(serf, 'idle', 'notInWorkMode');
      this.setSerfDebug(serf, { lastFailure: 'not_in_work_mode' });
      this.handleWandering(serf);
      return;
      }
    }

    if (serf._workHqInvalid || serf._workHqDepleted) {
      const reassigned = this.tryReassignWorkToAlternative(serf, serf.work && serf.work.hq);
      if (reassigned) {
        serf._workHqInvalid = false;
        serf._workHqDepleted = false;
      } else {
        this.setSerfState(serf, 'idle', 'workHqUnavailable');
        this.setSerfDebug(serf, { lastFailure: 'work_hq_unavailable' });
        this.handleWandering(serf);
        return;
      }
    }

    this.setSerfState(serf, 'working', 'defaultWork');

    // PRIORITY: Check if hut needs building first
    if (serf.hut && global.Building && global.Building.list) {
      const hut = global.Building.list[serf.hut];
      if (hut && !hut.built) {
        serf.action = 'build';
        return; // Let handleBuild() take over
      }
    }

    // Limited build assistance for non-hut buildings
    const assistTarget = this.getBuildAssistTarget(serf);
    if (assistTarget) {
      this.assignBuildAssist(serf, assistTarget);
      return;
    }

    // Check if work building is valid
    const building = this.getWorkBuilding(serf);
    if (!building || !building.built) {
      // Log why work building is invalid
      const factionName = serf.house && global.House && global.House.list 
        ? (global.House.list[serf.house]?.name || 'Unknown')
        : 'Unknown';
      const hasWorkHq = serf.work && serf.work.hq;
      const buildingId = hasWorkHq ? serf.work.hq : 'none';
      const buildingExists = hasWorkHq && global.Building && global.Building.list && global.Building.list[buildingId];
      const buildingBuilt = buildingExists ? global.Building.list[buildingId].built : false;

      if (buildingExists && !buildingBuilt) {
        const assistTargetForInvalid = this.getBuildAssistTarget(serf);
        if (assistTargetForInvalid && assistTargetForInvalid.id === buildingExists.id) {
          this.assignBuildAssist(serf, buildingExists);
          return;
        }
      }
      console.warn(`[SERF WORK] ${factionName}: Work building invalid for serf - work.hq: ${buildingId}, building exists: ${buildingExists}, built: ${buildingBuilt}, serf.mode: ${serf.mode}, serf.hut: ${serf.hut || 'none'}`);
      const logger = this.getSerfLogger();
      if (logger && typeof logger.warn === 'function') {
        logger.warn('Work building invalid for serf', serf, {
          workHq: buildingId,
          buildingExists,
          buildingBuilt
        });
      }
      this.setSerfDebug(serf, {
        lastFailure: 'work_building_invalid',
        buildingId,
        buildingExists,
        buildingBuilt
      });
      if (buildingExists && serf.work && serf.work.assignedSpot && buildingExists.releaseSpot && typeof buildingExists.releaseSpot === 'function') {
        try {
          buildingExists.releaseSpot(serf.id);
        } catch (error) {
          // Ignore release errors
        }
      }
      const reassigned = this.tryReassignWork(serf);
      if (!reassigned) {
        serf.mode = 'idle';
        if (!buildingExists) {
          serf._workHqInvalid = true;
          this.logWorkHqNull(serf, 'work_building_missing', { buildingId });
        }
        serf.work.spot = null;
        serf.work.assignedSpot = null;
        serf.work.workTile = null;
        serf.work.workTileFor = null;
      }
      return;
    }

    // Check if has resources to deposit
    if (this.hasResourcesToDeposit(serf)) {
      serf.action = 'deposit';
      return;
    }

    // Check if needs work spot
    if (!serf.work.spot) {
      const spot = this.assignWorkSpot(serf, building);
      if (!spot) {
        // No spots available - log why (throttled)
        const now = Date.now();
        const throttleKey = `noWorkSpot-${building.id}`;
        const lastLog = this.logThrottle[throttleKey];
        if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 2) {
          const house = this.getBuildingHouse(building);
          const factionName = house ? house.name : 'Unknown';
          const hasResources = building.resources && Array.isArray(building.resources);
          const resourceCount = hasResources ? building.resources.length : 0;
          console.warn(`[SERF WORK] ${factionName}: No work spot assigned for serf at ${building.type} - building.resources exists: ${hasResources}, count: ${resourceCount}, building.updateResources: ${typeof building.updateResources === 'function'}`);
          const logger = this.getSerfLogger();
          if (logger && typeof logger.warn === 'function') {
            logger.warn('No work spot assigned for serf', serf, {
              buildingType: building.type,
              resourceCount
            });
          }
          this.logThrottle[throttleKey] = now;
        }
        const depletionInfo = this.evaluateBuildingDepletion(building);
        this.setSerfDebug(serf, {
          lastFailure: 'no_work_spot',
          resourceCount: depletionInfo.resourceCount,
          depleted: depletionInfo.depleted
        });
        const reassigned = this.tryReassignWorkToAlternative(serf, building.id);
        if (reassigned) {
          return;
        }
        if (depletionInfo.depleted) {
          this.notifyDepletedBuilding(serf, building, 'no_available_spots');
          if (serf.work) {
            serf._workHqDepleted = true;
            this.logWorkHqNull(serf, 'work_hq_depleted', {
              buildingId: building.id,
              buildingType: building.type
            });
            serf.work.spot = null;
            serf.work.assignedSpot = null;
            serf.work.workTile = null;
            serf.work.workTileFor = null;
          }
        }
        // No spots available - wait
        return;
      }
    } else {
      // Validate work spot is still valid for this building
      // This catches cases where work.spot was set to a hut plot tile during building
      let spotValid = false;
      if (building.resources && Array.isArray(building.resources)) {
        for (const res of building.resources) {
          if (Array.isArray(res) && res.length === 2 && res.toString() === serf.work.spot.toString()) {
            spotValid = true;
            break;
          }
        }
      }
      if (!spotValid) {
        // Work spot is invalid (e.g., was set to hut plot tile) - clear it and reassign
        if (serf.work.assignedSpot && building.releaseSpot && typeof building.releaseSpot === 'function') {
          try {
            building.releaseSpot(serf.id);
          } catch (error) {
            // Ignore release errors
          }
        }
        serf.work.spot = null;
        serf.work.assignedSpot = null;
        serf.work.workTile = null;
        serf.work.workTileFor = null;
        serf.path = null;
        serf.pathCount = 0;
        const spot = this.assignWorkSpot(serf, building);
        if (!spot) {
          // No spots available - wait
          this.setSerfDebug(serf, { lastFailure: 'invalid_work_spot' });
          return;
        }
      }
    }

    // Execute work based on building type
    this.executeWork(serf, building, serf.work.spot);
  }

  /**
   * Handle deposit action - path to building and deposit resources
   */
  handleDeposit(serf) {
    this.setSerfState(serf, 'depositing', 'handleDeposit');
    const building = this.getWorkBuilding(serf);
    if (!building || !building.built) {
      serf.action = null;
      return;
    }

    // Check if still has resources
    if (!this.hasResourcesToDeposit(serf)) {
      serf.action = null;
      return;
    }

    const house = this.getBuildingHouse(building);
    const houseName = house ? house.name : 'Unknown';
    const resourceTypes = Object.keys(serf.inventory || {}).filter(r => (serf.inventory[r] || 0) > 0);
    const hasStoneOrIronore = resourceTypes.some(r => r === 'stone' || r === 'ironore');

    const dropoff = this.getDropoffLocationForSerf(serf, building);
    if (!dropoff) {
      // Log dropoff location failure (not throttled - this is an error)
      console.log(`[SERF DEPOSIT] ${houseName}: Failed to get dropoff location for ${building.type} at [${building.x}, ${building.y}], z=${building.z}`);
      this.setSerfDebug(serf, { lastFailure: 'dropoff_missing' });
      serf.action = null;
      return;
    }

    const loc = this.getLoc(serf);

    const isAtDropoff = this.isAtDropoff(serf, building);
    
    // Throttled logging - only log state changes or every 5 seconds
    const now = Date.now();
    const throttleKey = `deposit-${serf.id}`;
    const lastState = this.logThrottle[throttleKey];
    const stateChanged = !lastState || lastState.isAtDropoff !== isAtDropoff;
    const shouldLog = stateChanged || (now - (lastState?.lastLogTime || 0)) > this.LOG_THROTTLE_MS;
    
    if (hasStoneOrIronore && shouldLog) {
      if (stateChanged && isAtDropoff) {
        // Log when reaching dropoff (state change)
      } else if (!isAtDropoff) {
        // Throttled log when not at dropoff
      }
      this.logThrottle[throttleKey] = { lastLogTime: now, isAtDropoff };
    }

    if (isAtDropoff) {
      // At dropoff - deposit all resources
      // Log serf inventory before deposit attempt (for debugging) - THROTTLED
      if (hasStoneOrIronore) {
        const throttleKeyAttempt = `depositAttempt-${serf.id}-${building.id}`;
        const lastAttemptLog = this.logThrottle[throttleKeyAttempt];
        if (!lastAttemptLog || (now - lastAttemptLog) > this.LOG_THROTTLE_MS * 3) {
          const inventoryBefore = Object.keys(serf.inventory || {}).filter(r => (serf.inventory[r] || 0) > 0)
            .map(r => `${r}:${serf.inventory[r]}`).join(', ');
          this.logThrottle[throttleKeyAttempt] = now;
        }
      }
      
      serf.facing = 'up';
      const deposited = this.depositAllResources(serf, building);
      if (!deposited) {
        // Log deposit failure - THROTTLED (recurring errors should be throttled to avoid spam)
        const throttleKeyFailure = `depositFailure-${serf.id}-${building.id}`;
        const lastFailureLog = this.logThrottle[throttleKeyFailure];
        if (!lastFailureLog || (now - lastFailureLog) > this.LOG_THROTTLE_MS * 3) {
          console.log(`[SERF DEPOSIT] ${houseName}: Failed to deposit resources (${resourceTypes.join(', ')}) to ${building.type} at [${building.x}, ${building.y}], z=${building.z}, serf z=${serf.z}`);
          this.logThrottle[throttleKeyFailure] = now;
        }
        this.setSerfDebug(serf, { lastFailure: 'deposit_failed' });
      } else if (hasStoneOrIronore) {
        // Log successful deposit - THROTTLED (frequent successes don't need constant logging)
        const throttleKeySuccess = `depositSuccessDebug-${serf.id}-${building.id}`;
        const lastSuccessLog = this.logThrottle[throttleKeySuccess];
        if (!lastSuccessLog || (now - lastSuccessLog) > this.LOG_THROTTLE_MS * 2) {
          const depositedAmounts = resourceTypes.map(r => `${r}:${serf.inventory[r] || 0}`).join(', ');
          this.logThrottle[throttleKeySuccess] = now;
        }
      }
      serf.action = null; // Resume work
      if (serf.mode === 'work') {
        this.setSerfState(serf, 'working', 'depositComplete');
      }
    } else if (!serf.path || serf.path.length === 0) {
      // Path to dropoff
      if (typeof serf.moveTo === 'function') {
        // Use building's z-level if available, otherwise default to 0 (overworld)
        // CRITICAL: For cave mines, building is at z=0, so serfs at z=-1 must pathfind to z=0
        const dropoffZ = (building && typeof building.z === 'number') ? building.z : 0;
        
        // Enhanced logging for cave mine deposits when pathfinding
        if (building.type === 'mine' && building.cave && serf.z !== dropoffZ) {
          const now = Date.now();
          const throttleKey = `caveMinePathfind-${serf.id}`;
          const lastLog = this.logThrottle[throttleKey];
          if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 2) {
            this.logThrottle[throttleKey] = now;
          }
        }
        
        const target = this.resolveWalkableTarget(serf, dropoffZ, dropoff);
        movementSystem.applyMoveIntent(serf, {
          z: dropoffZ,
          target,
          reason: 'deposit',
          sourceAction: serf.action || 'deposit'
        });
      }
    }
  }

  /**
   * Handle build action - build hut (male serfs only)
   */
  handleBuild(serf) {
    this.setSerfState(serf, 'building', 'handleBuild');
    if (!global.Building || !global.Building.list) {
      serf.action = null;
      if (serf.work && serf.work.hq) {
        serf.mode = 'work';
      } else {
        serf.mode = 'idle';
      }
      return;
    }

    const buildTargetId = serf._buildAssistBuilding || serf.hut;
    if (!buildTargetId) {
      serf.action = null;
      serf._buildAssistBuilding = null;
      if (serf.work && serf.work.hq) {
        serf.mode = 'work';
      } else {
        serf.mode = 'idle';
      }
      return;
    }

    const targetBuilding = global.Building.list[buildTargetId];
    const isAssistBuild = !!serf._buildAssistBuilding;
    if (!targetBuilding || targetBuilding.built) {
      serf.action = null;
      if (isAssistBuild) {
        serf._buildAssistBuilding = null;
      }
      // CRITICAL FIX: Clear work.spot when hut is built - it was set to hut plot tile during building
      // and is no longer valid as a work spot for the actual work building
      serf.work.spot = null;
      serf.work.assignedSpot = null;
      // Clear path to prevent oscillation
      serf.path = null;
      serf.pathCount = 0;
      if (!serf.work.hq) {
        serf.mode = 'idle';
      }
      if (serf.mode === 'work') {
        this.setSerfState(serf, 'working', 'buildComplete');
      }
      return;
    }

    // Find foundation tile if no spot
    if (!serf.work.spot) {
      const buildableTiles = [];
      if (targetBuilding.plot && Array.isArray(targetBuilding.plot)) {
        for (const i in targetBuilding.plot) {
          const p = targetBuilding.plot[i];
          if (Array.isArray(p) && p.length === 2) {
            const t = this.getTile(serf, 0, p[0], p[1]);
            if (t === 11) { // Foundation tile
              buildableTiles.push(p);
            }
          }
        }
      }

      if (buildableTiles.length > 0) {
        serf.work.spot = buildableTiles[Math.floor(Math.random() * buildableTiles.length)];
      } else {
        serf.action = null;
        if (isAssistBuild) {
          serf._buildAssistBuilding = null;
        }
        serf.mode = 'idle';
        return;
      }
    }

    const loc = this.getLoc(serf);

    if (loc && Array.isArray(loc) && loc.length === 2 && loc.toString() === serf.work.spot.toString()) {
      // At building spot
      const gt = this.getTile(serf, 0, serf.work.spot[0], serf.work.spot[1]);
      if (gt === 11) {
        if (!serf.building && typeof global.Build === 'function') {
          global.Build(serf.id);
        }
      } else {
        // Tile already built, find new one
        serf.work.spot = null;
      }
    } else if (loc && Array.isArray(loc) && loc.length === 2) {
      const dist = Math.abs(loc[0] - serf.work.spot[0]) + Math.abs(loc[1] - serf.work.spot[1]);
      if (dist === 1) {
        const gt = this.getTile(serf, 0, serf.work.spot[0], serf.work.spot[1]);
        if (gt === 11) {
          if (!serf.building && typeof global.Build === 'function') {
            global.Build(serf.id, serf.work.spot);
          }
          return;
        }
        if (gt === 11) {
          if (!serf.building && typeof global.Build === 'function') {
            global.Build(serf.id, serf.work.spot);
          }
          return;
        }
      }
    }

    if (!serf.path || serf.path.length === 0) {
      // Path to building spot (use walkable adjacent tile, not the foundation tile itself)
      if (typeof serf.moveTo === 'function') {
        const buildLoc = this.getWorkTileForSpot(serf, serf.work.spot, 0);
        if (!buildLoc) {
          serf.work.spot = null;
          return;
        }
        const logger = this.getSerfLogger();
        const now = Date.now();
        const throttleKey = `pathStart-build-${serf.id}`;
        const lastLog = this.logThrottle[throttleKey];
        if (logger && typeof logger.debug === 'function' && (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS)) {
          logger.debug('Serf starting path to build spot', serf, {
            target: buildLoc,
            spot: serf.work.spot,
            serfZ: serf.z
          });
          this.logThrottle[throttleKey] = now;
        }
        movementSystem.applyMoveIntent(serf, {
          z: 0,
          target: buildLoc,
          reason: 'build',
          sourceAction: serf.action || 'build'
        });
      }
    }
  }

  /**
   * Handle clockout action - deposit resources then go home
   */
  handleClockout(serf) {
    this.setSerfState(serf, 'clocking_out', 'handleClockout');
    // First deposit resources if any
    if (this.hasResourcesToDeposit(serf)) {
      const building = this.getWorkBuilding(serf);
      if (building && building.built) {
        const dropoff = this.getDropoffLocationForSerf(serf, building);
        if (dropoff) {
          const loc = this.getLoc(serf);

          if (this.isAtDropoff(serf, building)) {
            serf.facing = 'up';
            this.depositAllResources(serf, building);
            // Continue to go home logic below
          } else if (!serf.path || serf.path.length === 0) {
            if (typeof serf.moveTo === 'function') {
              // Use building's z-level if available, otherwise default to 0 (overworld)
              const dropoffZ = (building && typeof building.z === 'number') ? building.z : 0;
              const target = this.resolveWalkableTarget(serf, dropoffZ, dropoff);
              movementSystem.applyMoveIntent(serf, {
                z: dropoffZ,
                target,
                reason: 'deposit',
                sourceAction: serf.action || 'clockout'
              });
            }
            return; // Wait for pathfinding
          } else {
            return; // Still pathfinding
          }
        }
      }
    }

    // No resources or done depositing - go home
    if (serf.home) {
      const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
        Math.floor(serf.x / 64),
        Math.floor(serf.y / 64)
      ];

      if (loc && Array.isArray(loc) && loc.length === 2) {
        const homeTarget = this.resolveWalkableTarget(serf, serf.home.z, serf.home.loc);
        if (serf.z !== serf.home.z || loc.toString() !== homeTarget.toString()) {
          if (!serf.path || serf.path.length === 0) {
            if (typeof serf.moveTo === 'function') {
              // Use serf.home.z to support multi-z pathfinding (e.g., z=1 for building homes)
              movementSystem.applyMoveIntent(serf, {
                z: serf.home.z,
                target: homeTarget,
                reason: 'home',
                sourceAction: serf.action || 'clockout'
              });
            }
          }
        } else {
          // Arrived home
          serf.action = null;
          serf.mode = 'idle';
          this.setSerfState(serf, 'idle', 'clockoutComplete');
        }
      }
    } else {
      // No home - just become idle
      serf.action = null;
      serf.mode = 'idle';
      this.setSerfState(serf, 'idle', 'clockoutNoHome');
    }
  }

  /**
   * Handle task action (outpost workers or legacy tasks)
   */
  handleTask(serf) {
    this.setSerfState(serf, 'tasking', 'handleTask');
    if (!serf || !serf.work || !Array.isArray(serf.work.spot)) {
      serf.action = null;
      return;
    }

    const target = serf.work.spot;
    const loc = this.getLoc(serf);
    const atTarget = loc && Array.isArray(loc) && loc.toString() === target.toString() && serf.z === 0;

    if (atTarget) {
      // Task completed or no specific work logic for outposts
      serf.action = null;
      if (serf.mode !== 'work') {
        serf.mode = 'idle';
      }
      return;
    }

    if (!serf.path || serf.path.length === 0) {
      if (typeof serf.moveTo === 'function') {
        const dest = this.resolveWalkableTarget(serf, 0, target);
        movementSystem.applyMoveIntent(serf, {
          z: 0,
          target: dest,
          reason: 'task',
          sourceAction: serf.action || 'task'
        });
      }
    }
  }

  /**
   * Handle unknown actions in work mode to avoid deadlocks
   */
  handleUnknownAction(serf) {
    if (!serf) return;
    const logger = this.getSerfLogger();
    if (logger && typeof logger.warn === 'function') {
      logger.warn('Unknown serf action in work mode - clearing action', serf, { action: serf.action });
    }
    this.setSerfDebug(serf, { lastFailure: 'unknown_action', lastAction: serf.action });
    serf.action = null;
  }

  /**
   * Handle wandering when idle
   */
  handleWandering(serf) {
    if (serf.z !== 0) return;
    if (serf.path || serf.idleTime > 0) return;

    const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
      Math.floor(serf.x / 64),
      Math.floor(serf.y / 64)
    ];

    if (!loc || !Array.isArray(loc) || loc.length !== 2) return;

    // Pick random adjacent tile
    const col = loc[0];
    const row = loc[1];
    const directions = [
      [col, row - 1], // North
      [col, row + 1], // South
      [col - 1, row], // West
      [col + 1, row]  // East
    ];

    const target = directions[Math.floor(Math.random() * directions.length)];
    const mapSize = global.mapContextManager
      ? global.mapContextManager.getMapSize(serf)
      : (global.mapSize || 1000);

    if (target[0] >= 0 && target[0] < mapSize &&
        target[1] >= 0 && target[1] < mapSize) {
      const isWalkable = global.isWalkable ? global.isWalkable(0, target[0], target[1], serf) : true;
      const targetTile = this.getTile(serf, 0, target[0], target[1]);
      const isWater = (targetTile === 0);
      const isTransitionTile = (targetTile === 6 || targetTile === 14 || targetTile === 16 || targetTile === 19);

      if (isWalkable && !isWater && !isTransitionTile) {
        if (typeof serf.move === 'function') {
          serf.move(target);
          serf.idleTime = Math.floor(Math.random() * (serf.idleRange || 1000));
        }
      } else {
        serf.idleTime = Math.floor(Math.random() * 60) + 30;
      }
    } else {
      serf.idleTime = Math.floor(Math.random() * 60) + 30;
    }
  }

  // ============================================================================
  // WORK SPOT ASSIGNMENT (from SerfWorkManager)
  // ============================================================================

  /**
   * Assign a work spot from building resources
   */
  assignWorkSpot(serf, building) {
    try {
      if (!serf || !building) return null;

      // Release any previously assigned spot
      if (serf.work.assignedSpot && building.releaseSpot && typeof building.releaseSpot === 'function') {
        try {
          building.releaseSpot(serf.id);
        } catch (error) {
          // Release failed, continue
        }
      }
      serf.work.assignedSpot = null;

      // Update building resources
      if (building.updateResources && typeof building.updateResources === 'function') {
        try {
          building.updateResources();
        } catch (error) {
          // Update failed, continue
        }
      }

      // Find available spots
      if (!building.resources || !Array.isArray(building.resources) || building.resources.length === 0) {
        // For mines, try refreshing resources if empty
        if (building.type === 'mine' && typeof building.getRes === 'function') {
          try {
            building.getRes();
            // Check again after refresh
            if (building.resources && Array.isArray(building.resources) && building.resources.length > 0) {
              // Resources found after refresh, continue with assignment
            } else {
              // Still empty after refresh - log for debugging (throttled)
              const now = Date.now();
              const throttleKey = `mineNoResources-${building.id}`;
              const lastLog = this.logThrottle[throttleKey];
              if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 3) {
          const house = this.getBuildingHouse(building);
          const factionName = house ? house.name : 'Unknown';
                console.warn(`[SERF WORK] ${factionName}: Mine at [${building.x}, ${building.y}] has no resources after getRes() - cave: ${building.cave ? 'yes' : 'no'}`);
                this.logThrottle[throttleKey] = now;
              }
              this.setSerfDebug(serf, { lastFailure: 'no_building_resources' });
              return null;
            }
          } catch (error) {
            console.error(`[SERF WORK] Error calling getRes() for mine:`, error);
            this.setSerfDebug(serf, { lastFailure: 'getRes_error' });
            return null;
          }
        } else {
          this.setSerfDebug(serf, { lastFailure: 'no_building_resources' });
          return null;
        }
      }

      const availableSpots = [];
      const house = this.getBuildingHouse(building);
      const factionName = house ? house.name : 'Unknown';
      
      // Removed routine "Processing cave mine resources" log to reduce spam
      // Only log when there are issues (no resources, etc.) - handled below
      
      const targetZ = this.getWorkZ(building);
      for (const i in building.resources) {
        try {
          const res = building.resources[i];
          if (Array.isArray(res) && res.length === 2) {
            if (building.isSpotAvailable && typeof building.isSpotAvailable === 'function') {
              const isAvailable = building.isSpotAvailable(res);
              if (isAvailable) {
                if (this.getWorkTileForSpot(serf, res, targetZ)) {
                  availableSpots.push(res);
                }
              } else {
                // Log when spot is filtered out by isSpotAvailable (throttled, building-specific)
                const now = Date.now();
                let throttleKey;
                if (building.type === 'mine' && building.cave) {
                  throttleKey = `caveMineSpotFiltered-${building.id}`;
                } else if (building.type === 'lumbermill') {
                  throttleKey = `lumbermillSpotFiltered-${building.id}`;
                } else if (building.type === 'mill') {
                  throttleKey = `millSpotFiltered-${building.id}`;
                } else {
                  throttleKey = `spotFiltered-${building.type}-${building.id}`;
                }
                
                const lastLog = this.logThrottle[throttleKey];
                if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 3) {
                  // Log filtered spot with context
                  const house = this.getBuildingHouse(building);
                  const houseName = house ? house.name : 'Unknown';
                  console.log(`[SERF WORK] ${houseName}: ${building.type} spot [${res[0]}, ${res[1]}] filtered out by isSpotAvailable`);
                  
                  // For lumbermills, provide additional context
                  if (building.type === 'lumbermill') {
                    const terrain = this.getTile(building, 6, res[0], res[1]); // Check resource layer (tree layer)
                    const baseTerrain = this.getTile(building, 0, res[0], res[1]); // Check base terrain
                    console.log(`[SERF WORK] ${houseName}: Lumbermill spot [${res[0]}, ${res[1]}] - resource terrain: ${terrain}, base terrain: ${baseTerrain}`);
                  }
                  
                  this.logThrottle[throttleKey] = now;
                }
              }
            } else {
              availableSpots.push(res);
            }
          } else {
            // Log invalid resource format (throttled)
            const now = Date.now();
            const throttleKey = `invalidResourceFormat-${building.id}`;
            const lastLog = this.logThrottle[throttleKey];
            if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 3) {
              console.warn(`[SERF WORK] ${factionName}: Invalid resource format at index ${i} for ${building.type} - not an array of length 2:`, res);
              if (building.type === 'mine' && building.cave) {
                console.warn(`[SERF WORK] ${factionName}: Cave mine resource at index ${i} has invalid format - type: ${typeof res}, isArray: ${Array.isArray(res)}, length: ${Array.isArray(res) ? res.length : 'N/A'}`);
              }
              this.logThrottle[throttleKey] = now;
            }
          }
        } catch (error) {
          // Log errors (throttled to avoid spam)
          const now = Date.now();
          const throttleKey = `resourceProcessingError-${building.id}`;
          const lastLog = this.logThrottle[throttleKey];
          if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 3) {
            console.error(`[SERF WORK] ${factionName}: Error processing resource at index ${i} for ${building.type}:`, error);
            this.logThrottle[throttleKey] = now;
          }
          continue;
        }
      }
      
      // Log final available spots count for cave mines (throttled)
      if (building.type === 'mine' && building.cave && availableSpots.length === 0) {
        // Only log when there are no spots (this is a problem)
        const now = Date.now();
        const throttleKey = `caveMineNoSpots-${building.id}`;
        const lastLog = this.logThrottle[throttleKey];
        if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 2) {
          console.warn(`[SERF WORK] ${factionName}: Cave mine available spots after processing: ${availableSpots.length} out of ${building.resources.length} resources`);
          this.logThrottle[throttleKey] = now;
        }
      }

      if (availableSpots.length === 0) {
        // Log why no spots available (throttled)
        const house = this.getBuildingHouse(building);
        const factionName = house ? house.name : 'Unknown';
        const now = Date.now();
        const throttleKey = `noAvailableSpots-${building.id}`;
        const lastLog = this.logThrottle[throttleKey];
        if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 2) {
          const hasIsSpotAvailable = building.isSpotAvailable && typeof building.isSpotAvailable === 'function';
          const totalResources = building.resources ? building.resources.length : 0;
          const filteredOut = totalResources - availableSpots.length;
          
          // Enhanced logging with detailed diagnostics
          let diagnosticMsg = `[SERF WORK] ${factionName}: No available spots for ${building.type} at [${building.x}, ${building.y}]`;
          diagnosticMsg += ` - total resources: ${totalResources}, available: ${availableSpots.length}, filtered: ${filteredOut}`;
          diagnosticMsg += `, isSpotAvailable: ${hasIsSpotAvailable}, cave: ${building.cave ? 'yes' : 'no'}`;
          
          // Add building-specific diagnostics
          if (building.type === 'lumbermill') {
            // Check if building has forest tiles nearby
            const hasForestNearby = this.checkForestNearby(building);
            diagnosticMsg += `, forest nearby: ${hasForestNearby}`;
          } else if (building.type === 'mine') {
            diagnosticMsg += `, mine type: ${building.cave ? 'cave' : 'stone'}`;
          }
          
          console.warn(diagnosticMsg);
          
          // Also log to FactionAI logger if available
          const house = this.getBuildingHouse(building);
          if (house && house.ai && house.ai.logger) {
            house.ai.logger.collectInfo(`Work spot assignment failed for ${building.type} at [${building.x}, ${building.y}]: ${totalResources} resources, ${availableSpots.length} available after filtering`);
          }
          
          this.logThrottle[throttleKey] = now;
        }
        this.setSerfDebug(serf, { lastFailure: 'no_available_spots' });
        return null;
      }

      // Assign random available spot
      const selected = availableSpots[Math.floor(Math.random() * availableSpots.length)];
      if (Array.isArray(selected) && selected.length === 2) {
        serf.work.assignedSpot = selected;
        serf.work.spot = selected;
        serf.work.workTile = null;
        serf.work.workTileFor = null;
        const workTile = this.getWorkTileForSpot(serf, selected, targetZ);
        if (!workTile) {
          serf.work.assignedSpot = null;
          serf.work.spot = null;
          return null;
        }

        if (building.assignSpot && typeof building.assignSpot === 'function') {
          building.assignSpot(serf.id, selected);
        }

        return selected;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Release a work spot
   */
  releaseWorkSpot(serf) {
    try {
      if (!serf || !serf.work) return;

      if (serf.work.hq) {
        const BuildingList = global.Building && global.Building.list ? global.Building.list : {};
        if (BuildingList && typeof BuildingList === 'object') {
          const building = BuildingList[serf.work.hq];
          if (building && building.releaseSpot && typeof building.releaseSpot === 'function') {
            try {
              building.releaseSpot(serf.id);
            } catch (error) {
              // Release failed, continue
            }
          }
        }
      }

      serf.work.assignedSpot = null;
      serf.work.spot = null;
      serf.work.workTile = null;
      serf.work.workTileFor = null;
    } catch (error) {
      if (serf && serf.work) {
        serf.work.assignedSpot = null;
        serf.work.spot = null;
        serf.work.workTile = null;
        serf.work.workTileFor = null;
      }
    }
  }

  /**
   * Get work building for a serf
   */
  getWorkBuilding(serf) {
    try {
      if (!serf || !serf.work || !serf.work.hq) return null;

      const BuildingList = global.Building && global.Building.list ? global.Building.list : {};
      if (!BuildingList || typeof BuildingList !== 'object') return null;

      const building = BuildingList[serf.work.hq];
      return building && typeof building === 'object' ? building : null;
    } catch (error) {
      return null;
    }
  }

  getBuildingHouseId(building) {
    if (!building || typeof building !== 'object') return null;
    return (building.house !== undefined && building.house !== null)
      ? building.house
      : (building.owner !== undefined && building.owner !== null ? building.owner : null);
  }

  getBuildingHouse(building) {
    const houseId = this.getBuildingHouseId(building);
    if (!houseId || !global.House || !global.House.list) return null;
    return global.House.list[houseId] || null;
  }

  // ============================================================================
  // WORK EXECUTION (from SerfWorkExecutor)
  // ============================================================================

  /**
   * Execute work based on building type
   */
  executeWork(serf, building, spot) {
    try {
      if (!serf || !building || !building.type || !building.built) return;

      const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
        Math.floor(serf.x / 64),
        Math.floor(serf.y / 64)
      ];

      if (!loc || !Array.isArray(loc) || loc.length !== 2) return;

      // Determine expected z-level for work spot
      const expectedZ = this.getWorkZ(building);
      const atCorrectZ = serf.z === expectedZ;
      let workLoc = spot;
      workLoc = this.getWorkTileForSpot(serf, spot, expectedZ);
      if (!workLoc) {
        const logger = this.getSerfLogger();
        if (logger && typeof logger.warn === 'function') {
          logger.warn('No walkable tile available for work spot', serf, { spot, z: expectedZ });
        }
        this.setSerfDebug(serf, { lastFailure: 'no_walkable_work_tile' });
        serf.work.spot = null;
        serf.work.assignedSpot = null;
        serf.work.workTile = null;
        serf.work.workTileFor = null;
        return;
      }
      const atCorrectXY = workLoc && Array.isArray(workLoc) && workLoc.length === 2 && loc.toString() === workLoc.toString();

      // Check if at work spot (both x,y AND z-level must match)
      if (atCorrectXY && atCorrectZ) {
        // At spot - start work based on building type
        switch (building.type) {
          case 'mill':
          case 'farm':
            this.startFarmingWork(serf, building, spot);
            break;
          case 'lumbermill':
            this.startLumberingWork(serf, building, spot);
            break;
          case 'mine':
            if (building.cave) {
              this.startMiningWork(serf, building, spot);
            } else {
              this.startStoneMiningWork(serf, building, spot);
            }
            break;
        }
      } else if (!serf.path || serf.path.length === 0) {
        // Not at spot or wrong z-level - path to work spot
        if (atCorrectXY && !atCorrectZ) {
          // At correct x,y but wrong z-level - log for debugging (heavily throttled)
          const now = Date.now();
          const throttleKey = `wrongZLevel-${serf.id}`;
          const lastLog = this.logThrottle[throttleKey];
          if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 5) {
            const house = this.getBuildingHouse(building);
            const factionName = house ? house.name : 'Unknown';
            console.log(`[SERF WORK] ${factionName}: Serf at work spot x,y but wrong z-level (serf.z=${serf.z}, expected=${expectedZ}) - pathfinding to correct z-level`);
            this.logThrottle[throttleKey] = now;
          }
        }
        if (typeof serf.moveTo === 'function') {
        const logger = this.getSerfLogger();
        const now = Date.now();
        const throttleKey = `pathStart-work-${serf.id}`;
        const lastLog = this.logThrottle[throttleKey];
        if (logger && typeof logger.debug === 'function' && (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS)) {
          logger.debug('Serf starting path to work spot', serf, {
            expectedZ,
            workLoc,
            spot,
            serfZ: serf.z
          });
          this.logThrottle[throttleKey] = now;
        }
          movementSystem.applyMoveIntent(serf, {
            z: expectedZ,
            target: workLoc,
            reason: 'work',
            sourceAction: serf.action || 'work'
          });
        }
      }
    } catch (error) {
      // Error in work execution
    }
  }

  /**
   * Clear work timers
   */
  clearWorkTimers(serf) {
    if (!serf) return;

    if (serf.workTimerId) {
      if (timerManager) {
        timerManager.clear(serf.workTimerId);
      } else if (global.clearTimeout) {
        global.clearTimeout(serf.workTimerId);
      }
      serf.workTimerId = null;
    }

    if (serf.workTimeoutId) {
      if (timerManager) {
        timerManager.clear(serf.workTimeoutId);
      } else if (global.clearTimeout) {
        global.clearTimeout(serf.workTimeoutId);
      }
      serf.workTimeoutId = null;
    }

    serf.workTimer = false;
    serf.working = false;
    serf.farming = false;
    serf.chopping = false;
    serf.mining = false;
  }

  /**
   * Start farming work
   */
  startFarmingWork(serf, building, spot) {
    try {
      if (!serf || !building || !spot || serf.workTimer) return;

      this.clearWorkTimers(serf);
      serf.working = true;
      serf.farming = true;
      serf.workTimer = true;

    const tile = this.getTile(serf, 0, spot[0], spot[1]);
      const hq = building;

      const workCallback = () => {
        try {
          if (!serf || !serf.farming) {
            this.clearWorkTimers(serf);
            return;
          }

          const b = global.getBuilding ? global.getBuilding(serf.x, serf.y) : null;
          const f = global.Building && global.Building.list ? global.Building.list[b] : null;

          if (!f || !f.plot) {
            this.clearWorkTimers(serf);
            return;
          }

          if (tile === 8) {
            // Seed tile - progress to growing
            this.tileChange(serf, 6, spot[0], spot[1], 1, true);
            let count = 0;
            const next = [];

            for (const i in f.plot) {
              const p = f.plot[i];
              if (this.getTile(serf, 6, p[0], p[1]) >= 5) {
                count++;
              } else {
                next.push(p);
              }
            }

            if (count === 9) {
              // All tiles ready - transition from barren (8) to growing (9)
              for (const i in f.plot) {
                const p = f.plot[i];
                this.tileChange(serf, 0, p[0], p[1], 9);
              }
              // Re-add all tiles to work spots (now all are type 9)
              if (hq.updateFarmResources) {
                hq.updateFarmResources();
              }
            } else {
              const res = this.getTile(serf, 6, spot[0], spot[1]);
              if (res >= 5) {
                for (let n = hq.resources.length - 1; n >= 0; n--) {
                  const r = hq.resources[n];
                  if (r && r.toString() === spot.toString()) {
                    hq.resources.splice(n, 1);
                  }
                }
              }
              if (next.length > 0) {
                const rand = Math.floor(Math.random() * next.length);
                serf.work.spot = next[rand];
                if (hq.log) hq.log[serf.id] = serf.work.spot;
              }
            }
          } else if (tile === 9) {
            // Growing tile - progress to ready
            this.tileChange(serf, 6, spot[0], spot[1], 1, true);
            let count = 0;

            for (const i in f.plot) {
              const p = f.plot[i];
              if (this.getTile(serf, 6, p[0], p[1]) >= 10) {
                count++;
              }
            }

            if (count === 9) {
              // All tiles ready - transition from growing (9) to grain (10)
              for (const i in f.plot) {
                const p = f.plot[i];
                this.tileChange(serf, 0, p[0], p[1], 10);
                this.tileChange(serf, 6, p[0], p[1], 10);
              }
              // Re-add all tiles to work spots (now all are type 10)
              if (hq.updateFarmResources) {
                hq.updateFarmResources();
              }
            } else {
              const res = this.getTile(serf, 6, spot[0], spot[1]);
              if (res >= 10) {
                for (let n = hq.resources.length - 1; n >= 0; n--) {
                  const r = hq.resources[n];
                  if (r && r.toString() === spot.toString()) {
                    hq.resources.splice(n, 1);
                  }
                }
              }
            }
          } else {
            // Ready tile - harvest grain
            this.tileChange(serf, 6, spot[0], spot[1], -1, true);
            serf.inventory.grain = (serf.inventory.grain || 0) + 10;

            if (this.getTile(serf, 6, spot[0], spot[1]) === 0) {
              this.tileChange(serf, 0, spot[0], spot[1], 8);

              let count = 0;
              const next = [];

              for (const i in f.plot) {
                const p = f.plot[i];
                const t = this.getTile(serf, 0, p[0], p[1]);
                if (t === 8) {
                  count++;
                } else {
                  next.push(p);
                }
              }

              if (count === 9) {
                // All tiles depleted - transition from grain (10) to barren (8)
                // Re-add all tiles to work spots (now all are type 8)
                if (hq.updateFarmResources) {
                  hq.updateFarmResources();
                } else {
                  // Fallback: manually add all tiles (excluding current spot)
                  for (const i in f.plot) {
                    const p = f.plot[i];
                    if (p.toString() !== spot.toString()) {
                      hq.resources.push(p);
                    }
                  }
                }
              } else {
                for (let n = hq.resources.length - 1; n >= 0; n--) {
                  const r = hq.resources[n];
                  if (r && r.toString() === spot.toString()) {
                    hq.resources.splice(n, 1);
                  }
                }
                if (next.length > 0) {
                  const rand = Math.floor(Math.random() * next.length);
                  serf.work.spot = next[rand];
                  if (hq.log) hq.log[serf.id] = serf.work.spot;
                }
              }
            }
          }

          this.clearWorkTimers(serf);
        } catch (error) {
          this.clearWorkTimers(serf);
        }
      };

      const workDelay = 10000 / (serf.strength || 1);
      if (timerManager) {
        const workTimerName = `serf-work-${serf.id}-${Date.now()}`;
        serf.workTimerId = workTimerName;
        timerManager.setTimeout(workTimerName, workCallback, workDelay);
      } else {
        serf.workTimerId = setTimeout(workCallback, workDelay);
      }
    } catch (error) {
      this.clearWorkTimers(serf);
    }
  }

  /**
   * Start lumbering work
   */
  startLumberingWork(serf, building, spot) {
    try {
      if (!serf || !building || !spot || serf.workTimer) return;

      this.clearWorkTimers(serf);
      serf.working = true;
      serf.chopping = true;
      serf.workTimer = true;

      const workCallback = () => {
        try {
          if (!serf || !serf.chopping) {
            this.clearWorkTimers(serf);
            return;
          }

          if (!Array.isArray(spot) || spot.length !== 2) {
            this.clearWorkTimers(serf);
            return;
          }

          // Chop wood
          this.tileChange(serf, 6, spot[0], spot[1], -1, true);
          serf.inventory.wood = (serf.inventory.wood || 0) + 10;

          const res = this.getTile(serf, 6, spot[0], spot[1]);
          if (res <= 0) {
            // Tree depleted
            this.tileChange(serf, 0, spot[0], spot[1], 1, true);

            if (building.resources && Array.isArray(building.resources)) {
              for (let i = building.resources.length - 1; i >= 0; i--) {
                const f = building.resources[i];
                if (f && f.toString() === spot.toString()) {
                  building.resources.splice(i, 1);
                }
              }
            }
            serf.work.spot = null;
            serf.work.workTile = null;
            serf.work.workTileFor = null;
          } else if (res < 101) {
            const gt = this.getTile(serf, 0, spot[0], spot[1]);
            if (gt >= 1 && gt < 2) {
              this.tileChange(serf, 0, spot[0], spot[1], 1, true);
            }
          }

          this.clearWorkTimers(serf);
        } catch (error) {
          this.clearWorkTimers(serf);
        }
      };

      const workDelay = 10000 / (serf.strength || 1);
      if (timerManager) {
        const workTimerName = `serf-work-${serf.id}-${Date.now()}`;
        serf.workTimerId = workTimerName;
        timerManager.setTimeout(workTimerName, workCallback, workDelay);
      } else {
        serf.workTimerId = setTimeout(workCallback, workDelay);
      }
    } catch (error) {
      this.clearWorkTimers(serf);
    }
  }

  /**
   * Start mining work (cave/ore)
   */
  startMiningWork(serf, building, spot) {
    try {
      if (!serf || !building || !spot || serf.workTimer) return;

      this.clearWorkTimers(serf);
      serf.working = true;
      serf.mining = true;
      serf.workTimer = true;

      const workCallback = () => {
        try {
          if (!serf || !serf.mining) {
            this.clearWorkTimers(serf);
            return;
          }

          if (!Array.isArray(spot) || spot.length !== 2) {
            this.clearWorkTimers(serf);
            return;
          }

          // Mine ore - random chance
          const roll = Math.random();
          const diamondChance = 0.001;
          const goldChance = global.gameWalletLedger && global.gameWalletLedger.canMint(1) ? 0.01 : 0;
          const silverChance = 0.09;
          const ironChance = 0.4;

          if (roll < diamondChance) {
            serf.inventory.diamond = (serf.inventory.diamond || 0) + 1;
          } else if (roll < diamondChance + goldChance) {
            serf.inventory.goldore = (serf.inventory.goldore || 0) + 1;
          } else if (roll < diamondChance + goldChance + silverChance) {
            serf.inventory.silverore = (serf.inventory.silverore || 0) + 1;
          } else if (roll < diamondChance + goldChance + silverChance + ironChance) {
            serf.inventory.ironore = (serf.inventory.ironore || 0) + 1;
          }

          // Deplete resource
          this.tileChange(serf, 7, spot[0], spot[1], -1, true);
          const res = this.getTile(serf, 7, spot[0], spot[1]);

          if (res <= 0) {
            // Rock depleted
            this.tileChange(serf, 1, spot[0], spot[1], 1);

            if (building.resources && Array.isArray(building.resources)) {
              for (let i = building.resources.length - 1; i >= 0; i--) {
                const f = building.resources[i];
                if (f && f.toString() === spot.toString()) {
                  building.resources.splice(i, 1);
                }
              }
            }

            // Discover adjacent rocks
            this.discoverAdjacentRocks(spot, building);
            serf.work.spot = null;
            serf.work.workTile = null;
            serf.work.workTileFor = null;
          }

          this.clearWorkTimers(serf);
        } catch (error) {
          this.clearWorkTimers(serf);
        }
      };

      const workDelay = 10000 / (serf.strength || 1);
      if (timerManager) {
        const workTimerName = `serf-work-${serf.id}-${Date.now()}`;
        serf.workTimerId = workTimerName;
        timerManager.setTimeout(workTimerName, workCallback, workDelay);
      } else {
        serf.workTimerId = setTimeout(workCallback, workDelay);
      }
    } catch (error) {
      this.clearWorkTimers(serf);
    }
  }

  /**
   * Start stone mining work
   */
  startStoneMiningWork(serf, building, spot) {
    try {
      if (!serf || !building || !spot || serf.workTimer) return;

      this.clearWorkTimers(serf);
      serf.working = true;
      serf.mining = true;
      serf.workTimer = true;

      const workCallback = () => {
        try {
          if (!serf || !serf.mining) {
            this.clearWorkTimers(serf);
            return;
          }

          if (!Array.isArray(spot) || spot.length !== 2) {
            this.clearWorkTimers(serf);
            return;
          }

          // Mine stone
          this.tileChange(serf, 6, spot[0], spot[1], -1, true);
          serf.inventory.stone = (serf.inventory.stone || 0) + 10;

          const res = this.getTile(serf, 6, spot[0], spot[1]);
          if (res <= 0) {
            // Stone depleted
            this.tileChange(serf, 0, spot[0], spot[1], 7);

            if (building.resources && Array.isArray(building.resources)) {
              for (let i = building.resources.length - 1; i >= 0; i--) {
                const f = building.resources[i];
                if (f && f.toString() === spot.toString()) {
                  building.resources.splice(i, 1);
                }
              }
            }
            serf.work.spot = null;
            serf.work.workTile = null;
            serf.work.workTileFor = null;
          } else {
            const tile0 = this.getTile(serf, 0, spot[0], spot[1]);
            if (tile0 >= 5 && tile0 < 6 && res <= 50) {
              this.tileChange(serf, 0, spot[0], spot[1], -1, true);
            }
          }

          this.clearWorkTimers(serf);
        } catch (error) {
          this.clearWorkTimers(serf);
        }
      };

      const workDelay = 10000 / (serf.strength || 1);
      if (timerManager) {
        const workTimerName = `serf-work-${serf.id}-${Date.now()}`;
        serf.workTimerId = workTimerName;
        timerManager.setTimeout(workTimerName, workCallback, workDelay);
      } else {
        serf.workTimerId = setTimeout(workCallback, workDelay);
      }
    } catch (error) {
      this.clearWorkTimers(serf);
    }
  }

  /**
   * Discover adjacent rocks when a rock is depleted
   */
  discoverAdjacentRocks(spot, building) {
    try {
      if (!spot || !Array.isArray(spot) || spot.length !== 2 || !building) return;

      const adj = [
        [spot[0] - 1, spot[1]],
        [spot[0], spot[1] - 1],
        [spot[0] + 1, spot[1]],
        [spot[0], spot[1] + 1]
      ];
      const newRocks = [];

      for (const t of adj) {
        if (Array.isArray(t) && t.length === 2) {
          const gt = this.getTile(building, 1, t[0], t[1]);
          if (gt === 1) {
            newRocks.push(t);
          }
        }
      }

      if (newRocks.length > 0) {
        for (const r of newRocks) {
          if (Array.isArray(r) && r.length === 2) {
            const num = 3 + Number((Math.random() * 0.9).toFixed(2));
            this.tileChange(building, 1, r[0], r[1], num);
            this.matrixChange(building, 1, r[0], r[1], 0);
            if (building.resources && Array.isArray(building.resources)) {
              building.resources.push(r);
            }
          }
        }
      }
    } catch (error) {
      // Discovery failed, continue
    }
  }

  // ============================================================================
  // RESOURCE MANAGEMENT (from SerfResourceManager)
  // ============================================================================

  /**
   * Check if serf has resources to deposit
   */
  hasResourcesToDeposit(serf) {
    try {
      if (!serf || !serf.inventory) return false;

      return ((serf.inventory.wood || 0) >= 10) ||
             ((serf.inventory.stone || 0) >= 10) ||
             ((serf.inventory.ironore || 0) >= 10) ||
             ((serf.inventory.grain || 0) >= 10) ||
             ((serf.inventory.silverore || 0) >= 1) ||
             ((serf.inventory.goldore || 0) >= 1) ||
             ((serf.inventory.diamond || 0) >= 1);
    } catch (error) {
      return false;
    }
  }

  /**
   * Deposit all resources to building
   */
  depositAllResources(serf, building) {
    try {
      if (!serf || !building) return false;

      const isClockout = serf.action === 'clockout';
      let anyDeposited = false;

      // Common resources (deposit all when triggered, or any amount during clockout)
      const commonResources = ['grain', 'wood', 'stone', 'ironore'];
      for (const resourceType of commonResources) {
        const amount = serf.inventory[resourceType] || 0;
        if (isClockout || amount > 0) {
          if (amount > 0 && this.depositResource(serf, resourceType, building)) {
            anyDeposited = true;
          }
        }
      }

      // Rare ores (deposit all when triggered, or any amount during clockout)
      const rareResources = ['silverore', 'goldore', 'diamond'];
      for (const resourceType of rareResources) {
        const amount = serf.inventory[resourceType] || 0;
        if (isClockout || amount > 0) {
          // Deposit all rare resources (one at a time)
          while ((serf.inventory[resourceType] || 0) > 0 && this.depositResource(serf, resourceType, building, 1)) {
            anyDeposited = true;
          }
        }
      }

      return anyDeposited;
    } catch (error) {
      return false;
    }
  }

  /**
   * Deposit a resource to a building
   */
  depositResource(serf, resourceType, building, amount = null) {
    try {
      if (!serf || !building || !resourceType) return false;

      const singleItemResources = ['silverore', 'goldore', 'diamond'];
      const isSingleItem = singleItemResources.includes(resourceType);

      if (amount === null) {
        amount = serf.inventory[resourceType] || 0;
      }

      if (typeof amount !== 'number' || amount <= 0 || !isFinite(amount)) {
        return false;
      }

      if (isSingleItem && amount > 1) {
        amount = 1;
      }

      // Calculate shares
      let buildingShare, serfWage;
      if (isSingleItem) {
        buildingShare = amount;
        serfWage = 0;
      } else {
        buildingShare = Math.floor(amount * this.BUILDING_SHARE);
        if (amount >= 1 && buildingShare === 0) {
          buildingShare = 1;
        }
        serfWage = amount - buildingShare;
      }

      // Enhanced logging for stone/ironore deposits (throttled)
      const isStoneOrIronore = resourceType === 'stone' || resourceType === 'ironore';
      const house = this.getBuildingHouse(building);
      const houseName = house ? house.name : 'Unknown';
      
      // Diagnostic logging for stone deposits at cave-classified mines
      if (resourceType === 'stone' && building.type === 'mine' && building.cave) {
        const now = Date.now();
        const throttleKey = `stoneDepositCaveMine-${building.id}`;
        const lastLog = this.logThrottle[throttleKey];
        if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 5) {
          console.log(`[MINE DEPOSIT DIAGNOSTIC] ${houseName}: Attempting stone deposit at cave-classified mine [${Math.floor(building.x)}, ${Math.floor(building.y)}] - amount: ${amount}, building.cave: yes`);
          this.logThrottle[throttleKey] = now;
        }
      }
      
      // Only log depositResource calls occasionally (throttled)
      if (isStoneOrIronore) {
        const now = Date.now();
        const throttleKey = `depositResource-${building.id}-${resourceType}`;
        const lastLog = this.logThrottle[throttleKey];
        if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS) {
          // Only log occasionally, not every call
          this.logThrottle[throttleKey] = now;
        }
      }

      // Deposit to building's house
      let deposited = false;
      const houseId = this.getBuildingHouseId(building);
      if (houseId && global.House && global.House.list && global.House.list[houseId]) {
        const house = global.House.list[houseId];
        if (house && house.stores) {
          const beforeAmount = house.stores[resourceType] || 0;
          house.stores[resourceType] = beforeAmount + buildingShare;
          deposited = true;
          
          // Only log actual deposits occasionally (throttled, but successful deposits are important)
          if (isStoneOrIronore && buildingShare > 0) {
            const now = Date.now();
            const throttleKey = `depositSuccess-${building.id}-${resourceType}`;
            const lastLog = this.logThrottle[throttleKey];
            if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS) {
              this.logThrottle[throttleKey] = now;
            }
          }

          // Create deposit event
          if (global.eventManager && typeof global.eventManager.createEvent === 'function' && buildingShare > 0) {
            try {
              global.eventManager.createEvent({
                category: global.eventManager.categories?.ECONOMIC,
                subject: serf.id,
                subjectName: serf.name || serf.class,
                action: `deposited ${resourceType}`,
                target: houseId,
                targetName: house.name,
                quantity: buildingShare,
                communication: global.eventManager.commModes?.NONE,
                log: `[ECONOMIC] ${serf.name || serf.class} deposited ${buildingShare} ${resourceType} to ${house.name}`,
                position: { x: serf.x, y: serf.y, z: serf.z }
              });
            } catch (error) {
              // Event creation failed, but deposit succeeded
            }
          }
        }
      }

      if (deposited) {
        // Clear inventory
        serf.inventory[resourceType] = Math.max(0, (serf.inventory[resourceType] || 0) - amount);

        // Give serf wage
        if (serfWage > 0) {
          serf.stores[resourceType] = (serf.stores[resourceType] || 0) + serfWage;
        }

        // Track daily deposits
        if (building) {
          if (!building.dailyStores) {
            building.dailyStores = {};
          }
          building.dailyStores[resourceType] = (building.dailyStores[resourceType] || 0) + buildingShare;
        }

        // Grain -> flour conversion (mills only)
        if (resourceType === 'grain' && building.type === 'mill' && serf.inventory) {
          try {
            serf.inventory.flour = (serf.inventory.flour || 0) + Math.floor(buildingShare / 3);
          } catch (error) {
            // Conversion failed, but deposit succeeded
          }
        }
      }

      return deposited;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get dropoff location for a building
   */
  getDropoffLocation(building) {
    try {
      if (!building || !building.plot || !Array.isArray(building.plot) || building.plot.length === 0) {
        return null;
      }

      const firstPlot = building.plot[0];
      if (!Array.isArray(firstPlot) || firstPlot.length !== 2) {
        return null;
      }

      const col = firstPlot[0];
      const row = firstPlot[1];

      if (typeof col !== 'number' || typeof row !== 'number' || !isFinite(col) || !isFinite(row)) {
        return null;
      }

      return [col, row + 1];
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if serf is at dropoff location
   */
  isAtDropoff(serf, building) {
    try {
      if (!serf || !building) return false;

      const dropoff = this.getDropoffLocationForSerf(serf, building);
      if (!dropoff || !Array.isArray(dropoff) || dropoff.length !== 2) {
        return false;
      }

      const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
        Math.floor(serf.x / 64),
        Math.floor(serf.y / 64)
      ];

      if (!loc || !Array.isArray(loc) || loc.length !== 2) {
        return false;
      }

      // Check if serf is at the building's z-level (not hardcoded to 0)
      // This fixes stone mine deposits - serfs must be at building.z, not necessarily z=0
      const buildingZ = (building && typeof building.z === 'number') ? building.z : 0;
      const atCorrectZ = serf.z === buildingZ;
      const atCorrectXY = loc.toString() === dropoff.toString();
      
      // Enhanced logging for cave mines when not at dropoff
      if (building.type === 'mine' && building.cave && !atCorrectZ) {
        const house = this.getBuildingHouse(building);
        const houseName = house ? house.name : 'Unknown';
        const now = Date.now();
        const throttleKey = `isAtDropoffZ-${serf.id}`;
        const lastLog = this.logThrottle[throttleKey];
        if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 2) {
          this.logThrottle[throttleKey] = now;
        }
      }
      
      // Diagnostic logging for stone deposits at cave-classified mines
      // This helps detect if stone deposits are failing due to misclassification
      if (building.type === 'mine' && building.cave && atCorrectZ && atCorrectXY) {
        const house = this.getBuildingHouse(building);
        const houseName = house ? house.name : 'Unknown';
        const serfHasStone = serf.inventory && serf.inventory.stone && serf.inventory.stone > 0;
        if (serfHasStone) {
          const now = Date.now();
          const throttleKey = `stoneDepositAtCaveMine-${building.id}`;
          const lastLog = this.logThrottle[throttleKey];
          if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 5) {
            console.log(`[MINE DEPOSIT DIAGNOSTIC] ${houseName}: Stone deposit attempt at cave-classified mine [${Math.floor(building.x)}, ${Math.floor(building.y)}] - serf has stone: ${serf.inventory.stone}, building.cave: ${building.cave ? 'yes' : 'no'}`);
            this.logThrottle[throttleKey] = now;
          }
        }
      }
      
      return atCorrectZ && atCorrectXY;
    } catch (error) {
      return false;
    }
  }

  getDropoffLocationForSerf(serf, building) {
    const dropoff = this.getDropoffLocation(building);
    if (!dropoff || !Array.isArray(dropoff) || dropoff.length !== 2) {
      return dropoff;
    }
    const dropoffZ = (building && typeof building.z === 'number') ? building.z : 0;
    return this.resolveWalkableTarget(serf, dropoffZ, dropoff);
  }
}

module.exports = SimpleSerfBehavior;
