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
    this.TRANSITION_WINDOW_MS = 10000; // 10s stagger window
    this.OFFWORK_MARKET_IDLE_CHANCE = 0.1;
    this.WORK_SPOT_RETRY_MS = 15000;
    this.PATH_RECOVERY_THROTTLE_MS = 4000;
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

  recordSerfRuntimeEvent(serf, action, metadata = {}) {
    if (!serf || !global.eventManager || typeof global.eventManager.aiEvent !== 'function') return;
    const houseName = serf.house && global.House && global.House.list
      ? (global.House.list[serf.house]?.name || null)
      : null;
    global.eventManager.aiEvent(action, {
      subject: serf.id,
      subjectName: serf.name || serf.class || 'Serf',
      house: serf.house || null,
      houseName,
      metadata: Object.assign({
        mode: serf.mode || null,
        action: serf.action || null,
        z: typeof serf.z === 'number' ? serf.z : null,
        workHq: serf.work?.hq || null,
        spot: Array.isArray(serf.work?.spot) ? serf.work.spot : null
      }, metadata || {})
    });
  }

  clearMoveState(serf, options = {}) {
    if (!serf) return;
    serf.path = null;
    serf.pathCount = 0;
    serf.pathEnd = null;
    serf.moveIntent = null;
    if (options.resetCooldown) {
      serf.pathCooldown = 0;
    }
  }

  clearInteriorResumeState(serf) {
    if (!serf) return;
    serf._interiorResume = null;
  }

  markInteriorResumePending(serf, building, expectedZ, target, result) {
    if (!serf) return;
    serf._interiorResume = {
      buildingId: building?.id || null,
      expectedZ,
      requestedAt: Date.now(),
      target: Array.isArray(target) ? target.slice() : null,
      status: result?.status || 'unknown'
    };
  }

  shouldResumeWorkFromInterior(serf, building) {
    if (!serf || !building) return false;
    const expectedZ = this.getWorkZ(building);
    return serf.z === 1 && expectedZ <= 0;
  }

  getCurrentInteriorBuildingId(serf) {
    if (!serf || serf.z !== 1 || typeof global.getBuilding !== 'function') return null;
    if (typeof serf.x !== 'number' || typeof serf.y !== 'number') return null;
    try {
      return global.getBuilding(serf.x, serf.y) || null;
    } catch (error) {
      return null;
    }
  }

  forceExitInteriorForWork(serf, building, reason = 'resume_from_interior_failed') {
    if (!this.shouldResumeWorkFromInterior(serf, building)) return false;
    const interiorBuildingId = this.getCurrentInteriorBuildingId(serf);
    if (!interiorBuildingId || typeof serf.exitBuilding !== 'function') return false;
    const interiorBuilding = global.Building?.list?.[interiorBuildingId];
    if (!interiorBuilding || !Array.isArray(interiorBuilding.entrance)) return false;

    this.clearMoveState(serf, { resetCooldown: true });

    try {
      serf.exitBuilding(interiorBuildingId);
    } catch (error) {
      return false;
    }

    this.clearInteriorResumeState(serf);
    serf._lastRecoveryAt = Date.now();
    serf._lastPathInvalidation = null;
    this.setSerfDebug(serf, {
      lastRecovery: 'resume_from_interior_forced_exit',
      expectedZ: this.getWorkZ(building),
      currentZ: serf.z,
      interiorBuildingId
    });
    this.recordSerfRuntimeEvent(serf, 'serf recovery transition', {
      recovery: 'resume_from_interior_forced_exit',
      reason,
      interiorBuildingId,
      workBuildingId: building?.id || null,
      expectedZ: this.getWorkZ(building)
    });
    return true;
  }

  noteWorkAttempt(serf, reason = null) {
    if (!serf) return;
    serf._lastWorkAttemptAt = Date.now();
    if (reason) {
      this.setSerfDebug(serf, { lastWorkAttemptReason: reason });
    }
  }

  ensurePersonalHutTracking(serf) {
    if (!serf) return null;
    if (serf.hut && !serf._personalHutId) {
      serf._personalHutId = serf.hut;
    }
    if (!serf.hut && serf._personalHutId) {
      serf.hut = serf._personalHutId;
    }
    return serf._personalHutId || serf.hut || null;
  }

  getPersonalHutStatus(serf) {
    const hutId = this.ensurePersonalHutTracking(serf);
    const hut = hutId && global.Building?.list ? global.Building.list[hutId] : null;
    return {
      hutId,
      hut,
      exists: !!hut,
      built: !!hut?.built,
      missing: !!hutId && !hut,
      pending: !!hutId && (!hut || !hut.built)
    };
  }

  recordHutPriorityEvent(serf, action, metadata = {}, options = {}) {
    if (!serf) return;
    const throttleMs = typeof options.throttleMs === 'number' ? options.throttleMs : this.LOG_THROTTLE_MS;
    const throttleKey = options.throttleKey || `hutPriority-${action}-${serf.id}`;
    if (throttleMs > 0) {
      const now = Date.now();
      const lastLog = this.logThrottle[throttleKey];
      if (lastLog && (now - lastLog) < throttleMs) {
        return;
      }
      this.logThrottle[throttleKey] = now;
    }
    const hutStatus = this.getPersonalHutStatus(serf);
    this.recordSerfRuntimeEvent(serf, action, Object.assign({
      hutId: hutStatus.hutId,
      hutExists: hutStatus.exists,
      hutBuilt: hutStatus.built,
      hutPending: hutStatus.pending,
      buildAssistBuilding: serf._buildAssistBuilding || null
    }, metadata || {}));
  }

  getSpotKey(spot) {
    return Array.isArray(spot) && spot.length === 2 ? `${spot[0]},${spot[1]}` : null;
  }

  rememberRejectedWorkSpot(serf, building, spot, reason = 'rejected') {
    if (!serf || !building || !Array.isArray(spot) || spot.length !== 2) return;
    const buildingKey = building.id || building.type || 'unknown';
    const spotKey = this.getSpotKey(spot);
    if (!spotKey) return;
    if (!serf._workSpotBlacklist || typeof serf._workSpotBlacklist !== 'object') {
      serf._workSpotBlacklist = {};
    }
    if (!serf._workSpotBlacklist[buildingKey]) {
      serf._workSpotBlacklist[buildingKey] = {};
    }
    serf._workSpotBlacklist[buildingKey][spotKey] = {
      reason,
      until: Date.now() + this.WORK_SPOT_RETRY_MS
    };
  }

  isSpotTemporarilyRejected(serf, building, spot) {
    if (!serf || !building || !serf._workSpotBlacklist) return false;
    const buildingKey = building.id || building.type || 'unknown';
    const spotKey = this.getSpotKey(spot);
    if (!spotKey) return false;
    const blacklist = serf._workSpotBlacklist[buildingKey];
    if (!blacklist || !blacklist[spotKey]) return false;
    if (blacklist[spotKey].until <= Date.now()) {
      delete blacklist[spotKey];
      return false;
    }
    return true;
  }

  resetWorkSpotAssignment(serf, reason = 'reset_work_spot', options = {}) {
    if (!serf || !serf.work) return;
    const building = options.building || this.getWorkBuilding(serf);
    const currentSpot = Array.isArray(serf.work.assignedSpot) ? serf.work.assignedSpot : serf.work.spot;

    if (options.blacklistSpot !== false && building && currentSpot) {
      this.rememberRejectedWorkSpot(serf, building, currentSpot, reason);
    }

    if (building && building.releaseSpot && typeof building.releaseSpot === 'function') {
      try {
        building.releaseSpot(serf.id);
      } catch (error) {
        // Ignore release errors during recovery.
      }
    }

    serf.work.assignedSpot = null;
    serf.work.spot = null;
    serf.work.workTile = null;
    serf.work.workTileFor = null;
    serf.work.shipId = null;
    serf.work.isStoredShip = false;
    serf._lastWorkSpotFailure = {
      reason,
      buildingType: building?.type || null
    };
    this.setSerfDebug(serf, { lastFailure: reason });
  }

  isSerfIntentionallyOffWork(serf) {
    if (!serf) return false;
    if (serf.action === 'clockout' || serf.action === 'deposit' || serf.action === 'build' || serf.action === 'returning') {
      return true;
    }
    if (this.isNightTime() && serf.action === 'task' && serf._offWorkTargetType) {
      return true;
    }
    const pendingType = serf._pendingTransition?.type;
    return this.isNightTime() && (pendingType === 'clockout' || pendingType === 'offworkDecision');
  }

  clearStaleOffWorkStateForWorkday(serf) {
    if (!serf || this.isNightTime()) return;
    const stalePending = serf._pendingTransition &&
      (serf._pendingTransition.type === 'clockout' || serf._pendingTransition.type === 'offworkDecision');
    if (stalePending) {
      serf._pendingTransition = null;
    }

    if (serf.action === 'task' && serf._offWorkTargetType) {
      if (serf.work) {
        serf.work.spot = Array.isArray(serf._savedWorkSpot) ? serf._savedWorkSpot : null;
      }
      serf.action = null;
    }

    if (serf.action === 'clockout' && !this.hasResourcesToDeposit(serf)) {
      serf.action = null;
    }

    if (serf._offWorkTargetType || serf._savedWorkSpot) {
      serf._offWorkTargetType = null;
      serf._savedWorkSpot = null;
    }
  }

  shouldBeWorkingNow(serf) {
    if (!serf || !serf.work || !serf.work.hq) return false;
    const hasUrgentHutBuild = this.getPersonalHutStatus(serf).pending;
    if (hasUrgentHutBuild) return true;
    if (this.isNightTime()) return false;
    return !this.isSerfIntentionallyOffWork(serf);
  }

  normalizeAssignedWorkSpot(serf, building) {
    if (!serf || !serf.work || !building) return;
    const assignedSpot = serf.work.assignedSpot;
    if (!Array.isArray(assignedSpot) || assignedSpot.length !== 2) return;

    if (building.type === 'dock') {
      const assignedShipId = building.assignedSpots?.[serf.id];
      if (!assignedShipId) {
        this.resetWorkSpotAssignment(serf, 'stale_reservation', { building, blacklistSpot: false });
      }
      return;
    }

    if (!Array.isArray(building.resources) || !building.resources.some(res => Array.isArray(res) && res[0] === assignedSpot[0] && res[1] === assignedSpot[1])) {
      this.resetWorkSpotAssignment(serf, 'stale_reservation', { building, blacklistSpot: false });
      return;
    }

    const workTile = this.getWorkTileForSpot(serf, assignedSpot, this.getWorkZ(building));
    if (!workTile) {
      this.resetWorkSpotAssignment(serf, 'unreachable_work_tile', { building });
      return;
    }

    if (!building.assignedSpots || typeof building.assignedSpots !== 'object') {
      building.assignedSpots = {};
    }
    const ownedBy = building.assignedSpots[serf.id];
    if (!ownedBy) {
      if (building.isSpotAvailable && !building.isSpotAvailable(assignedSpot)) {
        this.resetWorkSpotAssignment(serf, 'stale_reservation', { building, blacklistSpot: false });
        return;
      }
      if (building.assignSpot && typeof building.assignSpot === 'function') {
        building.assignSpot(serf.id, assignedSpot);
      }
    }

    serf.work.spot = assignedSpot;
  }

  normalizeSerfState(serf) {
    if (!serf || serf.action === 'flee') return;

    if (serf.z !== 1 && serf._interiorResume) {
      this.clearInteriorResumeState(serf);
    }

    if (!serf.work || typeof serf.work !== 'object') {
      serf.work = { hq: null, spot: null, assignedSpot: null, workTile: null, workTileFor: null };
    }

    const building = this.getWorkBuilding(serf);
    if (building) {
      this.normalizeAssignedWorkSpot(serf, building);
    } else if (serf.work.hq && (serf.work.spot || serf.work.assignedSpot)) {
      this.resetWorkSpotAssignment(serf, 'work_hq_missing', { blacklistSpot: false });
    }

    this.clearStaleOffWorkStateForWorkday(serf);

    if (this.shouldBeWorkingNow(serf) && serf.mode !== 'work') {
      serf.mode = 'work';
      if (serf._offWorkTargetType) {
        serf._offWorkTargetType = null;
      }
      if (serf.action === 'task' && serf._savedWorkSpot) {
        serf.work.spot = serf._savedWorkSpot;
        serf._savedWorkSpot = null;
        serf.action = null;
      }
      this.setSerfState(serf, 'working', 'normalizeWorkMode');
      this.setSerfDebug(serf, { lastRecovery: 'normalize_work_mode' });
      this.recordSerfRuntimeEvent(serf, 'serf state normalized', {
        recovery: 'normalize_work_mode'
      });
    }
  }

  recoverFromPathFailure(serf) {
    if (!serf || !serf.work || !serf.work.hq) return;
    const retryableAction = serf.action === 'deposit' || serf.action === 'clockout' || serf.action === 'returning';
    const relevantAction = !serf.action || serf.action === 'task' || serf.action === 'build' || retryableAction;
    if (!relevantAction && serf.mode !== 'work') return;
    const building = this.getWorkBuilding(serf);

    const lastInvalidation = serf._lastPathInvalidation;
    const lastResult = serf.lastPathResult;
    const now = Date.now();
    let reason = null;

    if (lastInvalidation && (now - lastInvalidation.at) <= this.PATH_RECOVERY_THROTTLE_MS) {
      reason = lastInvalidation.reason || 'path_invalidated';
    } else if (lastResult && lastResult.status === 'no_path' && (now - lastResult.timestamp) <= this.PATH_RECOVERY_THROTTLE_MS) {
      reason = lastResult.reason || 'no_path';
    }

    if (!reason) return;
    if (serf._lastRecoveryAt && (now - serf._lastRecoveryAt) < this.PATH_RECOVERY_THROTTLE_MS) return;

    if (this.forceExitInteriorForWork(serf, building, reason)) {
      return;
    }

    if (retryableAction) {
      this.clearMoveState(serf, { resetCooldown: true });
      serf._lastRecoveryAt = now;
      serf._lastPathInvalidation = null;
      this.setSerfDebug(serf, { lastRecovery: reason, retryAction: serf.action });
      this.recordSerfRuntimeEvent(serf, 'serf recovery transition', {
        recovery: 'path_failure_retry',
        reason,
        retryAction: serf.action
      });
      return;
    }

    const loc = this.getLoc(serf);
    const safeTile = typeof serf.findNearestWalkableTile === 'function'
      ? serf.findNearestWalkableTile(loc[0], loc[1], serf.z, 2)
      : null;

    this.clearMoveState(serf, { resetCooldown: true });

    if (safeTile && safeTile.toString() !== loc.toString() && typeof serf.move === 'function') {
      serf.move(safeTile);
    }

    this.resetWorkSpotAssignment(serf, reason, { building });
    serf.action = null;
    serf.mode = this.shouldBeWorkingNow(serf) ? 'work' : serf.mode;
    serf._lastRecoveryAt = now;
    serf._lastPathInvalidation = null;
    this.setSerfDebug(serf, { lastRecovery: reason });
    this.recordSerfRuntimeEvent(serf, 'serf recovery transition', {
      recovery: 'path_failure_reset',
      reason,
      safeTile: safeTile || null
    });
  }

  isIdleTransitionTile(serf, target) {
    if (!serf || !target) return false;
    if (serf.z === 0) {
      const tile = this.getTile(serf, 0, target[0], target[1]);
      return tile === 6 || tile === 14 || tile === 16 || tile === 19;
    }
    if (serf.z === -1) {
      return this.getTile(serf, 1, target[0], target[1]) === 2;
    }
    if (serf.z === 1) {
      const exitTile = this.getTile(serf, 0, target[0], target[1] - 1);
      const stairsTile = this.getTile(serf, 4, target[0], target[1]);
      return exitTile === 14 || exitTile === 16 || exitTile === 19 || stairsTile === 3 || stairsTile === 4 || stairsTile === 5 || stairsTile === 6 || stairsTile === 7;
    }
    if (serf.z === 2) {
      const stairsTile = this.getTile(serf, 4, target[0], target[1]);
      return stairsTile === 3 || stairsTile === 4;
    }
    if (serf.z === -2) {
      return this.getTile(serf, 8, target[0], target[1]) === 5;
    }
    return false;
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

  getBuildableFoundationTiles(serf, building, z = 0) {
    if (!serf || !building || !Array.isArray(building.plot)) return [];
    const tiles = [];
    for (const tile of building.plot) {
      if (!Array.isArray(tile) || tile.length !== 2) continue;
      const terrain = this.getTile(serf, z, tile[0], tile[1]);
      if (terrain === 11) {
        tiles.push(tile);
      }
    }
    return tiles;
  }

  selectBuildFoundationTarget(serf, building, z = 0) {
    const buildableTiles = this.getBuildableFoundationTiles(serf, building, z);
    const loc = this.getLoc(serf);
    const distanceFor = tile => {
      if (!loc || !Array.isArray(loc) || loc.length !== 2) return Infinity;
      return Math.abs(tile[0] - loc[0]) + Math.abs(tile[1] - loc[1]);
    };

    const directTiles = buildableTiles
      .filter(tile => global.isWalkable && global.isWalkable(z, tile[0], tile[1], serf))
      .sort((a, b) => distanceFor(a) - distanceFor(b));

    const approachTiles = buildableTiles
      .map(tile => ({
        spot: tile,
        approach: this.findAdjacentWalkableTile(z, tile, serf) ||
          (typeof serf.findNearestWalkableTile === 'function'
            ? serf.findNearestWalkableTile(tile[0], tile[1], z, 3)
            : null)
      }))
      .filter(entry => Array.isArray(entry.approach));

    return {
      buildableTiles,
      directTiles,
      approachTiles,
      spot: directTiles.length > 0 ? directTiles[0] : null,
      target: directTiles.length > 0 ? directTiles[0] : null
    };
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
    const hutStatus = this.getPersonalHutStatus(serf);
    if (hutStatus.pending) {
      this.recordHutPriorityEvent(serf, 'serf build assist skipped', {
        reason: hutStatus.missing ? 'personal_hut_missing' : 'personal_hut_pending'
      });
      return null;
    }

    const allSerfs = this.getHouseSerfs(serf.house);
    const eligibleSerfs = allSerfs.filter(entity => {
      if (!entity) return false;
      if (entity.action === 'build') return false;
      const entityHutStatus = this.getPersonalHutStatus(entity);
      if (entityHutStatus.pending) {
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

    if (best) {
      this.recordHutPriorityEvent(serf, 'serf build assist eligible', {
        assistBuildingId: best.id,
        assistBuildingType: best.type
      });
    }

    return best;
  }

  assignBuildAssist(serf, building) {
    if (!serf || !building) return false;
    const hutStatus = this.getPersonalHutStatus(serf);
    if (hutStatus.pending) {
      this.recordHutPriorityEvent(serf, 'serf build assist blocked', {
        reason: hutStatus.missing ? 'personal_hut_missing' : 'personal_hut_pending',
        assistBuildingId: building.id,
        assistBuildingType: building.type
      }, { throttleMs: 0 });
      return false;
    }
    serf._buildAssistBuilding = building.id;
    serf.work.spot = null;
    serf.work.assignedSpot = null;
    serf.action = 'build';
    this.recordHutPriorityEvent(serf, 'serf build assist assigned', {
      assistBuildingId: building.id,
      assistBuildingType: building.type
    }, { throttleMs: 0 });
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

  getBuildingTargetTile(building) {
    if (!building) return null;
    if (Array.isArray(building.entrance) && building.entrance.length === 2) {
      return building.entrance;
    }
    if (Array.isArray(building.plot) && building.plot.length > 0) {
      const tile = building.plot[0];
      if (Array.isArray(tile) && tile.length === 2) {
        return tile;
      }
    }
    if (typeof building.x === 'number' && typeof building.y === 'number') {
      return global.getLoc ? global.getLoc(building.x, building.y, building) : [
        Math.floor(building.x / 64),
        Math.floor(building.y / 64)
      ];
    }
    return null;
  }

  isCaveMineBuilding(building) {
    return !!(building && building.type === 'mine' && Array.isArray(building.cave) && building.cave.length === 2);
  }

  getCaveEntranceForBuilding(building) {
    return this.isCaveMineBuilding(building) ? building.cave.slice() : null;
  }

  primeCaveWorkNavigation(serf, building, workLoc = null, spot = null) {
    if (!serf || !this.isCaveMineBuilding(building)) return null;
    const entrance = this.getCaveEntranceForBuilding(building);
    serf.preferredCaveEntrance = entrance ? entrance.slice() : null;

    const targetKey = JSON.stringify({
      buildingId: building.id || null,
      entrance,
      workLoc,
      spot
    });
    if (serf._lastCaveTargetKey !== targetKey) {
      serf._lastCaveTargetKey = targetKey;
      this.recordSerfRuntimeEvent(serf, 'serf cave work target selected', {
        recovery: 'cave_work_target_selected',
        buildingId: building.id || null,
        buildingType: building.type || null,
        entrance,
        workLoc: Array.isArray(workLoc) ? workLoc : null,
        targetSpot: Array.isArray(spot) ? spot : null
      });
    }

    this.setSerfDebug(serf, {
      caveEntrance: entrance,
      caveWorkLoc: Array.isArray(workLoc) ? workLoc : null
    });
    return entrance;
  }

  maybeRecoverSurfaceCaveApproach(serf, building, workLoc) {
    if (!serf || !this.isCaveMineBuilding(building) || serf.z !== 0 || !Array.isArray(workLoc)) {
      return false;
    }

    const entrance = this.primeCaveWorkNavigation(serf, building, workLoc, serf.work?.spot || null);
    if (!entrance) return false;

    const now = Date.now();
    const lastInvalidation = serf._lastPathInvalidation;
    const lastResult = serf.lastPathResult;
    const hasRecentFailure = (
      (lastInvalidation && (now - lastInvalidation.at) <= this.PATH_RECOVERY_THROTTLE_MS) ||
      (lastResult && lastResult.status === 'no_path' && (now - lastResult.timestamp) <= this.PATH_RECOVERY_THROTTLE_MS)
    );
    const waitingForEntry = serf.transitionIntent === 'enter_cave' && serf.targetZLevel === -1;
    const stalledOnSurface = !waitingForEntry &&
      !!serf._lastCaveApproachAt &&
      (now - serf._lastCaveApproachAt) > (this.PATH_RECOVERY_THROTTLE_MS * 2);

    if (!hasRecentFailure && !stalledOnSurface) {
      if (!waitingForEntry) {
        serf._lastCaveApproachAt = now;
      }
      return false;
    }
    if (serf._lastCaveRecoveryAt && (now - serf._lastCaveRecoveryAt) < this.PATH_RECOVERY_THROTTLE_MS) {
      return false;
    }

    this.clearMoveState(serf, { resetCooldown: true });
    const result = movementSystem.applyMoveIntent(serf, {
      z: -1,
      target: workLoc,
      reason: 'recover_cave_entry',
      sourceAction: serf.action || 'work'
    });
    if (serf.z === 0 && this.isWaitingForCaveEntry(serf) && (!serf.path || serf.path.length === 0)) {
      this.markCaveEntryPathBlocked(serf, result?.reason || 'no_surface_path_to_cave');
    }

    serf._lastCaveApproachAt = now;
    serf._lastCaveRecoveryAt = now;
    this.setSerfDebug(serf, {
      lastRecovery: 'recover_cave_entry',
      caveEntrance: entrance,
      caveRecoveryStatus: result?.status || 'unknown'
    });
    this.recordSerfRuntimeEvent(serf, 'serf recovery transition', {
      recovery: 'recover_cave_entry',
      reason: hasRecentFailure ? 'surface_path_failure' : 'surface_cave_stall',
      entrance,
      workLoc,
      status: result?.status || 'unknown'
    });
    return true;
  }

  isWaitingForCaveEntry(serf) {
    return !!(serf && serf.transitionIntent === 'enter_cave' && serf.targetZLevel === -1);
  }

  shouldDelayCaveEntryRetry(serf) {
    if (!this.isWaitingForCaveEntry(serf)) return false;
    if (serf.path && serf.path.length > 0) return false;
    return !!(serf._lastCaveEntryPathBlockedAt &&
      (Date.now() - serf._lastCaveEntryPathBlockedAt) < this.PATH_RECOVERY_THROTTLE_MS);
  }

  markCaveEntryPathBlocked(serf, reason = 'no_surface_path_to_cave') {
    if (!serf || !this.isWaitingForCaveEntry(serf)) return;
    if (serf.path && serf.path.length > 0) return;
    const now = Date.now();
    serf._lastCaveEntryPathBlockedAt = now;
    serf._lastPathInvalidation = {
      reason,
      at: now,
      data: {
        target: Array.isArray(serf.targetLoc) ? serf.targetLoc : null,
        entrance: Array.isArray(serf.caveEntrance) ? serf.caveEntrance : null,
        z: serf.z
      }
    };
    this.setSerfDebug(serf, { lastFailure: reason });
  }

  resumeWorkFromInterior(serf, building) {
    if (!serf || !building) return false;
    const expectedZ = this.getWorkZ(building);
    if (serf.z === expectedZ) return false;

    // Workers waking up inside huts/buildings need an explicit move intent
    // so they exit the interior before the normal work-spot loop runs.
    if (serf.z === 1 && expectedZ <= 0) {
      if (this.forceExitInteriorForWork(serf, building, 'resume_from_interior')) {
        return true;
      }
      if (this.isCaveMineBuilding(building)) {
        this.primeCaveWorkNavigation(serf, building, null, serf.work?.spot || null);
      }
      const target = this.resolveWalkableTarget(serf, expectedZ, this.getBuildingTargetTile(building));
      const result = movementSystem.applyMoveIntent(serf, {
        z: expectedZ,
        target,
        reason: 'resume_work',
        sourceAction: serf.action || 'work'
      });
      this.markInteriorResumePending(serf, building, expectedZ, target, result);

      if (!serf._lastInteriorResumeAt || (Date.now() - serf._lastInteriorResumeAt) > this.LOG_THROTTLE_MS) {
        serf._lastInteriorResumeAt = Date.now();
        this.recordSerfRuntimeEvent(serf, 'serf recovery transition', {
          recovery: 'resume_from_interior',
          reason: 'resume_from_interior',
          fromZ: serf.z,
          toZ: expectedZ,
          status: 'requested',
          pathStatus: result?.status || 'unknown'
        });
      }
      this.setSerfDebug(serf, {
        lastRecovery: 'resume_from_interior_requested',
        expectedZ,
        currentZ: serf.z,
        interiorResumeStatus: result?.status || 'unknown'
      });
      return true;
    }

    return false;
  }

  isMarketBuilding(building) {
    if (!building || !building.type) return false;
    return String(building.type).toLowerCase().includes('market');
  }

  getMarketForSerf(serf) {
    if (!serf || !global.Building || !global.Building.list) return null;
    if (serf.tavern && global.Building.list[serf.tavern]) {
      const tavern = global.Building.list[serf.tavern];
      if (tavern.market && global.Building.list[tavern.market]) {
        const market = global.Building.list[tavern.market];
        if (market.built) return market;
      }
    }
    const candidates = Object.values(global.Building.list).filter(b => {
      if (!b || !b.built || b.house !== serf.house) return false;
      if (!this.isMarketBuilding(b)) return false;
      if (global.mapContextHelpers && !global.mapContextHelpers.areInSameContext(serf, b)) {
        return false;
      }
      return true;
    });
    if (!candidates.length) return null;
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
    return best;
  }

  getTavernForSerf(serf) {
    if (!serf || !global.Building || !global.Building.list) return null;
    if (serf.tavern && global.Building.list[serf.tavern]) {
      const tavern = global.Building.list[serf.tavern];
      if (tavern.built) return tavern;
    }
    if (serf.work && serf.work.hq && global.Building.list[serf.work.hq]) {
      const hq = global.Building.list[serf.work.hq];
      if (hq.tavern && global.Building.list[hq.tavern]) {
        const tavern = global.Building.list[hq.tavern];
        if (tavern.built) return tavern;
      }
    }
    return null;
  }

  hasMarketItems(serf) {
    if (!serf) return false;
    const inventoryItems = Object.entries(serf.inventory || {})
      .filter(([key, value]) => key !== 'torch' && value > 0);
    const storeItems = Object.entries(serf.stores || {})
      .filter(([key, value]) => value > 0);
    return inventoryItems.length > 0 || storeItems.length > 0;
  }

  scheduleTransition(serf, type, delayMs) {
    if (!serf) return;
    const now = Date.now();
    const delay = typeof delayMs === 'number'
      ? delayMs
      : Math.floor(Math.random() * this.TRANSITION_WINDOW_MS);
    const at = now + Math.max(0, delay);
    if (serf._pendingTransition && serf._pendingTransition.type === type) {
      if (serf._pendingTransition.at <= at) return;
    }
    serf._pendingTransition = { type, at };
  }

  processTransition(serf) {
    if (!serf || !serf._pendingTransition) return;
    const now = Date.now();
    if (now < serf._pendingTransition.at) return;
    const type = serf._pendingTransition.type;
    serf._pendingTransition = null;
    if (type === 'startWork') {
      serf.mode = 'work';
      if (serf.action === 'clockout') {
        serf.action = null;
      }
      serf._offWorkTargetType = null;
      serf._savedWorkSpot = null;
      if (serf.work) {
        serf.work.spot = null;
        serf.work.assignedSpot = null;
        serf.work.workTile = null;
        serf.work.workTileFor = null;
      }
      return;
    }
    if (type === 'clockout') {
      if (serf.action !== 'build' && serf.action !== 'deposit') {
        serf.action = 'clockout';
      }
      serf.mode = 'idle';
      return;
    }
    if (type === 'offworkDecision') {
      this.decideOffWorkAction(serf);
    }
  }

  handleDailySchedule(serf) {
    if (!serf) return;
    const isNight = this.isNightTime();
    if (serf._lastNightfall === undefined) {
      serf._lastNightfall = isNight;
    }
    if (isNight !== serf._lastNightfall) {
      if (isNight) {
        this.scheduleTransition(serf, 'clockout');
      } else {
        if (serf.work && serf.work.hq) {
          this.scheduleTransition(serf, 'startWork');
        }
      }
      serf._lastNightfall = isNight;
    }

    this.processTransition(serf);

    if (isNight && !serf.action && serf.mode !== 'work') {
      if (!serf._pendingTransition) {
        this.scheduleTransition(serf, 'offworkDecision');
      }
    }
  }

  decideOffWorkAction(serf) {
    if (!serf || serf.action) return;
    const market = this.getMarketForSerf(serf);
    const hasItems = this.hasMarketItems(serf);
    const wantsMarket = market && (hasItems || Math.random() < this.OFFWORK_MARKET_IDLE_CHANCE);
    if (wantsMarket) {
      const target = this.getBuildingTargetTile(market);
      if (target && serf.work) {
        serf._savedWorkSpot = serf.work.spot;
        serf.work.spot = target;
        serf.action = 'task';
        serf.mode = 'idle';
        serf._offWorkTargetType = 'market';
        return;
      }
    }

    const tavern = this.getTavernForSerf(serf);
    const tavernChance = serf.sex === 'f' ? 0.3 : 0.5;
    if (tavern && Math.random() < tavernChance) {
      const target = this.getBuildingTargetTile(tavern);
      if (target && serf.work) {
        serf._savedWorkSpot = serf.work.spot;
        serf.work.spot = target;
        serf.action = 'task';
        serf.mode = 'idle';
        serf._offWorkTargetType = 'tavern';
        return;
      }
    }

    if (serf.home) {
      serf.action = 'clockout';
      serf.mode = 'idle';
      serf._offWorkTargetType = 'home';
      return;
    }

    serf.mode = 'idle';
    serf.action = null;
    serf._offWorkTargetType = 'idle';
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

      this.normalizeSerfState(serf);
      this.trackMovementStall(serf);

      if (serf._pendingFleeRecovery && serf.action !== 'flee') {
        this.recoverFromFlee(serf);
      }

      this.handleDailySchedule(serf);
      this.normalizeSerfState(serf);
      this.recoverFromPathFailure(serf);

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
      } else if (serf.action === 'returning') {
        this.handleReturning(serf);
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
      serf.action === 'returning' ||
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
      this.setSerfDebug(serf, { lastFailure: 'stuck_recovery_retry', retryAction: serf.action });
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

    if (serf.action === 'returning') {
      if (typeof serf.return === 'function') {
        serf.return();
      } else {
        serf.action = null;
      }
      this.setSerfDebug(serf, { lastFailure: 'stuck_recovery_returning' });
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
      // CRITICAL: Don't force work mode here - let the schedule system handle transitions
      // The schedule system (handleDailySchedule + processTransition) controls all mode transitions:
      // - Serfs spawn in idle mode
      // - At dawn, processTransition() executes 'startWork' transition and sets mode to 'work'
      // - At dusk, processTransition() executes 'clockout' transition
      // - After clockout completes (deposit + go home), serf transitions to idle
      // A pending hut should change what work they do once scheduled on-shift, but must not
      // bypass the dawn/dusk transition and start work immediately after spawn.
      if (!serf.work || !serf.work.hq) {
        this.tryReassignWork(serf);
      }

      if (serf.mode !== 'work') {
      // Log when serfs are not in work mode (for cave mine debugging, throttled)
      if (!this.isNightTime() && this.shouldBeWorkingNow(serf) && serf.work && serf.work.hq && global.Building && global.Building.list) {
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
    this.noteWorkAttempt(serf, 'default_work');

    // PRIORITY: Check if hut needs building first
    const hutStatus = this.getPersonalHutStatus(serf);
    if (hutStatus.pending) {
      if (serf._buildAssistBuilding) {
        this.recordHutPriorityEvent(serf, 'serf hut priority restored', {
          previousAssistBuilding: serf._buildAssistBuilding,
          reason: hutStatus.missing ? 'personal_hut_missing' : 'personal_hut_pending'
        }, { throttleMs: 0 });
        serf._buildAssistBuilding = null;
      } else {
        this.recordHutPriorityEvent(serf, 'serf hut priority check', {
          reason: hutStatus.missing ? 'personal_hut_missing' : 'personal_hut_pending'
        });
      }
      serf.action = 'build';
      return; // Let handleBuild() take over
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
      if (global.eventManager && typeof global.eventManager.aiEvent === 'function') {
        global.eventManager.aiEvent('serf work building invalid', {
          subject: serf.id,
          subjectName: serf.name || serf.class,
          house: serf.house || null,
          houseName: factionName,
          metadata: {
            workHq: buildingId,
            buildingExists: !!buildingExists,
            buildingBuilt
          }
        });
      }
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

    if (this.resumeWorkFromInterior(serf, building)) {
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
        const failureInfo = serf._lastWorkSpotFailure || {};
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
          if (global.eventManager && typeof global.eventManager.aiEvent === 'function') {
            global.eventManager.aiEvent('serf work spot missing', {
              subject: serf.id,
              subjectName: serf.name || serf.class,
              house: serf.house || null,
              houseName: factionName,
              metadata: {
                buildingId: building.id,
                buildingType: building.type,
                resourceCount,
                reason: failureInfo.reason || 'unknown'
              }
            });
          }
          const logger = this.getSerfLogger();
          if (logger && typeof logger.warn === 'function') {
            logger.warn('No work spot assigned for serf', serf, {
              buildingType: building.type,
              resourceCount,
              reason: failureInfo.reason || 'unknown'
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

    // Special handling for docks - serfs must board ships to work
    if (building.type === 'dock') {
      this.handleDockWork(serf, building);
      return;
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
        // For stone mines: serfs work at z=0, building at z=0
        // For cave mines: serfs work at z=-1, must exit to z=0 to deposit at building (z=0)
        const dropoffZ = (building && typeof building.z === 'number') ? building.z : 0;
        
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
    const hutStatus = this.getPersonalHutStatus(serf);

    const resetBuildSpot = () => {
      if (!serf.work) return;
      serf.work.spot = null;
      serf.work.assignedSpot = null;
      serf.work.workTile = null;
      serf.work.workTileFor = null;
    };

    const finishBuild = (reason, options = {}) => {
      const preserveBuildAction = !!options.preserveBuildAction;
      const clearAssist = !!options.clearAssist;
      const clearSpot = options.clearSpot !== false;
      const nextMode = options.nextMode || (serf.work && serf.work.hq ? 'work' : 'idle');
      const metadata = options.metadata || {};

      this.recordHutPriorityEvent(serf, 'serf build exit', Object.assign({
        reason,
        nextMode,
        preserveBuildAction
      }, metadata), { throttleMs: 0 });
      this.setSerfDebug(serf, { lastFailure: reason });

      if (clearAssist) {
        serf._buildAssistBuilding = null;
      }
      if (clearSpot) {
        resetBuildSpot();
      }
      this.clearMoveState(serf);

      if (preserveBuildAction) {
        serf.action = 'build';
        serf.mode = nextMode;
        return;
      }

      serf.action = null;
      serf.mode = nextMode;
      if (nextMode === 'work') {
        this.setSerfState(serf, 'working', reason);
      } else {
        this.setSerfState(serf, 'idle', reason);
      }
    };

    if (!global.Building || !global.Building.list) {
      finishBuild('building_registry_unavailable', {
        clearAssist: true,
        preserveBuildAction: hutStatus.pending,
        metadata: { buildTargetId: serf._buildAssistBuilding || hutStatus.hutId || null }
      });
      return;
    }

    if (hutStatus.pending && serf._buildAssistBuilding) {
      this.recordHutPriorityEvent(serf, 'serf hut priority restored', {
        previousAssistBuilding: serf._buildAssistBuilding,
        reason: hutStatus.missing ? 'personal_hut_missing' : 'personal_hut_pending'
      }, { throttleMs: 0 });
      serf._buildAssistBuilding = null;
    }

    const buildTargetId = hutStatus.pending ? hutStatus.hutId : (serf._buildAssistBuilding || hutStatus.hutId);
    const isPersonalHutBuild = !!(hutStatus.hutId && buildTargetId === hutStatus.hutId);
    const isAssistBuild = !!(serf._buildAssistBuilding && !isPersonalHutBuild);

    if (!buildTargetId) {
      finishBuild('no_build_target', {
        clearAssist: true,
        metadata: { buildTargetId: null }
      });
      return;
    }

    const targetBuilding = global.Building.list[buildTargetId];
    if (!targetBuilding || targetBuilding.built) {
      const reason = !targetBuilding
        ? (isPersonalHutBuild ? 'personal_hut_missing' : 'assist_target_missing')
        : (isPersonalHutBuild ? 'personal_hut_complete' : 'assist_build_complete');
      finishBuild(reason, {
        clearAssist: isAssistBuild,
        preserveBuildAction: isPersonalHutBuild && !targetBuilding,
        metadata: {
          buildTargetId,
          buildTargetType: targetBuilding?.type || null,
          isAssistBuild,
          isPersonalHutBuild
        }
      });
      return;
    }

    const buildTarget = this.selectBuildFoundationTarget(serf, targetBuilding, 0);
    if (!buildTarget.buildableTiles.length) {
      finishBuild(isPersonalHutBuild ? 'personal_hut_no_buildable_tiles' : 'assist_build_no_buildable_tiles', {
        clearAssist: isAssistBuild,
        preserveBuildAction: isPersonalHutBuild,
        metadata: {
          buildTargetId,
          buildTargetType: targetBuilding.type,
          isAssistBuild,
          isPersonalHutBuild
        }
      });
      return;
    }

    const currentSpotKey = Array.isArray(serf.work.spot) ? `${serf.work.spot[0]},${serf.work.spot[1]}` : null;
    const currentSpotStillBuildable = currentSpotKey && buildTarget.buildableTiles.some(tile => `${tile[0]},${tile[1]}` === currentSpotKey);
    const currentSpotWalkable = currentSpotStillBuildable && global.isWalkable && global.isWalkable(0, serf.work.spot[0], serf.work.spot[1], serf);

    if (!currentSpotWalkable) {
      if (buildTarget.spot) {
        const nextSpotKey = `${buildTarget.spot[0]},${buildTarget.spot[1]}`;
        if (currentSpotKey !== nextSpotKey) {
          this.recordHutPriorityEvent(serf, 'serf build target selected', {
            buildTargetId,
            buildTargetType: targetBuilding.type,
            selectedSpot: buildTarget.spot,
            directAccessibleTiles: buildTarget.directTiles.length,
            approachTiles: buildTarget.approachTiles.length
          }, { throttleMs: 0 });
        }
        serf.work.spot = buildTarget.spot;
        serf.work.workTile = buildTarget.spot;
        serf.work.workTileFor = `0:${buildTarget.spot.toString()}`;
        this.clearMoveState(serf);
      } else {
        finishBuild(isPersonalHutBuild ? 'personal_hut_no_work_tile' : 'assist_build_no_work_tile', {
          clearAssist: isAssistBuild,
          preserveBuildAction: isPersonalHutBuild,
          metadata: {
            buildTargetId,
            buildTargetType: targetBuilding.type,
            isAssistBuild,
            isPersonalHutBuild,
            buildableTiles: buildTarget.buildableTiles.length,
            directAccessibleTiles: buildTarget.directTiles.length,
            approachTiles: buildTarget.approachTiles.length
          }
        });
        return;
      }
    }

    const loc = this.getLoc(serf);

    // CRITICAL: Serf must be ON the plot tile to build, not adjacent
    // Building from adjacent tiles causes serfs to build off-plot while plot tiles still get constructed
    if (loc && Array.isArray(loc) && loc.length === 2 && loc.toString() === serf.work.spot.toString()) {
      // At building spot - verify we're on a plot tile
      const gt = this.getTile(serf, 0, serf.work.spot[0], serf.work.spot[1]);
      if (gt === 11) {
        // Verify this spot is actually in the building's plot
        const isInPlot = targetBuilding.plot && targetBuilding.plot.some(p => 
          Array.isArray(p) && p.length === 2 && p[0] === serf.work.spot[0] && p[1] === serf.work.spot[1]
        );
        
        if (isInPlot && !serf.building && typeof global.Build === 'function') {
          const logger = this.getSerfLogger();
          if (logger && typeof logger.debug === 'function') {
            logger.debug('Serf building hut tile', serf, {
              spot: serf.work.spot,
              buildingId: buildTargetId,
              buildingType: targetBuilding.type
            });
          }
          global.Build(serf.id);
        } else if (!isInPlot) {
          // Spot is not in plot - clear it and find a valid one
          const logger = this.getSerfLogger();
          if (logger && typeof logger.warn === 'function') {
            logger.warn('Serf tried to build on non-plot tile', serf, {
              spot: serf.work.spot,
              buildingId: buildTargetId,
              plot: targetBuilding.plot
            });
          }
          serf.work.spot = null;
        }
      } else {
        // Tile already built, find new one
        serf.work.spot = null;
      }
    } else {
      // Not at building spot - pathfind to it (don't allow building from adjacent tiles)
      // The old code allowed building from distance 1, which caused the off-plot building bug
    }

    if (!serf.path || serf.path.length === 0) {
      // Path directly onto the walkable foundation tile; building only succeeds on-plot.
      if (typeof serf.moveTo === 'function') {
        const buildLoc = Array.isArray(serf.work.spot) && global.isWalkable && global.isWalkable(0, serf.work.spot[0], serf.work.spot[1], serf)
          ? serf.work.spot
          : null;
        if (!buildLoc) {
          resetBuildSpot();
          this.recordHutPriorityEvent(serf, 'serf build exit', {
            reason: isPersonalHutBuild ? 'personal_hut_no_work_tile' : 'assist_build_no_work_tile',
            nextMode: serf.mode || null,
            preserveBuildAction: isPersonalHutBuild,
            buildTargetId,
            buildTargetType: targetBuilding.type,
            isAssistBuild,
            isPersonalHutBuild,
            buildableTiles: buildTarget.buildableTiles.length,
            directAccessibleTiles: buildTarget.directTiles.length,
            approachTiles: buildTarget.approachTiles.length
          }, { throttleMs: 0 });
          if (!isPersonalHutBuild && isAssistBuild) {
            serf._buildAssistBuilding = null;
            serf.action = null;
          }
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
      if (!building || !building.built) {
        this.setSerfDebug(serf, {
          lastFailure: 'clockout_deposit_building_unavailable',
          workHq: serf.work?.hq || null
        });
        this.recordSerfRuntimeEvent(serf, 'serf clockout deposit blocked', {
          reason: 'building_unavailable',
          workHq: serf.work?.hq || null
        });
        return;
      }
      if (building && building.built) {
        const dropoff = this.getDropoffLocationForSerf(serf, building);
        if (!dropoff) {
          this.setSerfDebug(serf, {
            lastFailure: 'clockout_dropoff_missing',
            buildingId: building.id || null,
            buildingType: building.type || null
          });
          this.recordSerfRuntimeEvent(serf, 'serf clockout deposit blocked', {
            reason: 'dropoff_missing',
            buildingId: building.id || null,
            buildingType: building.type || null
          });
          return;
        }
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
          if (this.isNightTime()) {
            this.scheduleTransition(serf, 'offworkDecision');
          }
        }
      }
    } else {
      // No home - just become idle
      serf.action = null;
      serf.mode = 'idle';
      this.setSerfState(serf, 'idle', 'clockoutNoHome');
      if (this.isNightTime()) {
        this.scheduleTransition(serf, 'offworkDecision');
      }
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
    const targetZ = this.getTaskTargetZ(serf);
    const atTarget = loc && Array.isArray(loc) && loc.toString() === target.toString() && serf.z === targetZ;

    if (atTarget) {
      // Task completed or no specific work logic for outposts
      serf.action = null;
      if (serf.mode !== 'work') {
        serf.mode = 'idle';
      }
      if (serf._offWorkTargetType) {
        serf._offWorkTargetType = null;
        if (serf.work) {
          serf.work.spot = null;
        }
        if (this.isNightTime()) {
          this.scheduleTransition(serf, 'offworkDecision');
        }
      }
      return;
    }

    if (!serf.path || serf.path.length === 0) {
      if (typeof serf.moveTo === 'function') {
        const dest = this.resolveWalkableTarget(serf, targetZ, target);
        movementSystem.applyMoveIntent(serf, {
          z: targetZ,
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
    this.recordSerfRuntimeEvent(serf, 'serf state normalized', {
      recovery: 'unknown_action_cleared',
      invalidAction: serf.action
    });
    serf.action = null;
  }

  getTaskTargetZ(serf) {
    if (!serf || !serf.work) return 0;
    if (typeof serf.work.targetZ === 'number') {
      return serf.work.targetZ;
    }
    const buildingId = serf.work.hq;
    const building = global.Building?.list?.[buildingId];
    if (building) {
      return this.getWorkZ(building);
    }
    return 0;
  }

  handleReturning(serf) {
    if (!serf) return;
    this.setSerfState(serf, 'returning', 'handleReturning');

    if (this.hasResourcesToDeposit(serf)) {
      serf.action = 'deposit';
      return;
    }

    if (typeof serf.return === 'function') {
      serf.return();
      return;
    }

    serf.action = null;
  }

  /**
   * Handle wandering when idle
   */
  handleWandering(serf) {
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
      const isWalkable = global.isWalkable ? global.isWalkable(serf.z, target[0], target[1], serf) : true;
      const targetTile = this.getTile(serf, serf.z === -1 ? 1 : 0, target[0], target[1]);
      const isWater = (serf.z === 0 && targetTile === 0);
      const isTransitionTile = this.isIdleTransitionTile(serf, target);

      if (isWalkable && !isWater && !isTransitionTile) {
        if (typeof serf.move === 'function') {
          serf.move(target);
          serf.idleTime = Math.floor(Math.random() * (serf.idleRange || 1000));
          if (serf.z !== 0) {
            const now = Date.now();
            if (!serf._lastIdleWanderEventAt || (now - serf._lastIdleWanderEventAt) > 10000) {
              serf._lastIdleWanderEventAt = now;
              this.recordSerfRuntimeEvent(serf, 'serf idle wander', {
                target,
                z: serf.z
              });
            }
          }
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
   * Assign a work spot for dock buildings (ships are the work spots)
   * Serfs path to dock tiles, then board ships when they arrive
   */
  assignDockWorkSpot(serf, dock) {
    try {
      if (!serf || !dock || dock.type !== 'dock') return null;

      // Check if dock has ships (active or stored)
      const hasActiveShips = dock.ships && Array.isArray(dock.ships) && dock.ships.length > 0;
      const hasStoredShips = dock.storedShips && Array.isArray(dock.storedShips) && dock.storedShips.length > 0;
      
      if (!hasActiveShips && !hasStoredShips) {
        // No ships available - this is why "No work spot assigned" warning appears
        serf._lastWorkSpotFailure = { reason: 'no_ships_available', buildingType: dock.type };
        return null;
      }

      // Find available ship (one with space for more serfs, max 2 per ship)
      // Check active ships first, then stored ships
      const PlayerList = global.Player && global.Player.list ? global.Player.list : {};
      let availableShip = null;
      let availableShipId = null;
      let isStoredShip = false;

      // Check active ships
      if (hasActiveShips) {
        for (const shipId of dock.ships) {
          const ship = PlayerList[shipId];
          if (!ship || ship.toRemove) continue;
          if (ship.mode !== 'docked' && ship.mode !== 'anchored') continue; // Only docked/anchored ships

          // Check how many serfs are already on this ship
          const embarkedCount = ship.embarkedSerfs ? ship.embarkedSerfs.length : 0;
          if (embarkedCount < 2) {
            // Ship has space
            // Check if this serf is already assigned to this ship
            const alreadyAssigned = dock.assignedSpots && dock.assignedSpots[serf.id] === shipId;
            if (!alreadyAssigned) {
              availableShip = ship;
              availableShipId = shipId;
              break;
            }
          }
        }
      }

      // If no active ship available, check stored ships
      if (!availableShip && hasStoredShips) {
        for (let i = 0; i < dock.storedShips.length; i++) {
          const storedShip = dock.storedShips[i];
          // Stored ships need to be retrieved - we'll handle that when serf arrives at dock
          // For now, just mark that we have a stored ship available
          // We'll retrieve it when the serf reaches the dock
          availableShipId = storedShip.shipId;
          isStoredShip = true;
          break; // Use first available stored ship
        }
      }

      if (!availableShipId) {
        // All ships are full or no ships available
        serf._lastWorkSpotFailure = { reason: 'dock_capacity_full', buildingType: dock.type };
        return null;
      }

      // Assign serf to ship via dock's assignedSpots
      if (!dock.assignedSpots) {
        dock.assignedSpots = {};
      }
      dock.assignedSpots[serf.id] = availableShipId;

      // Set work spot to dock location (serf will path to dock tiles, then board ship)
      // Use first dock plot tile as the work spot
      const dockLoc = dock.plot && Array.isArray(dock.plot) && dock.plot.length > 0
        ? dock.plot[0]
        : (global.getLoc ? global.getLoc(dock.x, dock.y) : [Math.floor(dock.x / 64), Math.floor(dock.y / 64)]);

      serf.work.assignedSpot = dockLoc;
      serf.work.spot = dockLoc;
      serf.work.workTile = null;
      serf.work.workTileFor = null;
      serf.work.shipId = availableShipId; // Store ship ID for boarding
      serf.work.isStoredShip = isStoredShip; // Mark if ship needs to be retrieved

      return dockLoc;
    } catch (error) {
      console.error('[SERF WORK] Error assigning dock work spot:', error);
      return null;
    }
  }

  /**
   * Assign a work spot from building resources
   */
  assignWorkSpot(serf, building) {
    try {
      if (!serf || !building) return null;
      serf._lastWorkSpotFailure = null;
      this.noteWorkAttempt(serf, 'assign_work_spot');

      // Special handling for docks - ships are the "work spots"
      if (building.type === 'dock') {
        return this.assignDockWorkSpot(serf, building);
      }

      if (Array.isArray(serf.work.assignedSpot)) {
        this.normalizeAssignedWorkSpot(serf, building);
        if (Array.isArray(serf.work.assignedSpot)) {
          return serf.work.assignedSpot;
        }
      }

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
              serf._lastWorkSpotFailure = { reason: 'no_building_resources', buildingType: building.type };
              return null;
            }
          } catch (error) {
            console.error(`[SERF WORK] Error calling getRes() for mine:`, error);
            this.setSerfDebug(serf, { lastFailure: 'getRes_error' });
            serf._lastWorkSpotFailure = { reason: 'getRes_error', buildingType: building.type };
            return null;
          }
        } else {
          this.setSerfDebug(serf, { lastFailure: 'no_building_resources' });
          serf._lastWorkSpotFailure = { reason: 'no_building_resources', buildingType: building.type };
          return null;
        }
      }

      const availableSpots = [];
      const rejectionCounts = {
        reserved: 0,
        blacklisted: 0,
        unreachable: 0,
        invalid: 0
      };
      const house = this.getBuildingHouse(building);
      const factionName = house ? house.name : 'Unknown';
      
      // Removed routine "Processing cave mine resources" log to reduce spam
      // Only log when there are issues (no resources, etc.) - handled below
      
      const targetZ = this.getWorkZ(building);
      for (const i in building.resources) {
        try {
          const res = building.resources[i];
          if (Array.isArray(res) && res.length === 2) {
            if (this.isSpotTemporarilyRejected(serf, building, res)) {
              rejectionCounts.blacklisted++;
              continue;
            }
            if (building.isSpotAvailable && typeof building.isSpotAvailable === 'function') {
              const isAvailable = building.isSpotAvailable(res);
              if (isAvailable) {
                if (this.getWorkTileForSpot(serf, res, targetZ)) {
                  availableSpots.push(res);
                } else {
                  rejectionCounts.unreachable++;
                }
              } else {
                rejectionCounts.reserved++;
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
              if (this.getWorkTileForSpot(serf, res, targetZ)) {
                availableSpots.push(res);
              } else {
                rejectionCounts.unreachable++;
              }
            }
          } else {
            rejectionCounts.invalid++;
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
        let failureReason = 'no_available_spots';
        const totalResources = building.resources ? building.resources.length : 0;
        if (rejectionCounts.reserved >= totalResources && totalResources > 0) {
          failureReason = 'all_spots_reserved';
        } else if (rejectionCounts.unreachable > 0 && (rejectionCounts.unreachable + rejectionCounts.blacklisted) >= totalResources) {
          failureReason = 'unreachable_work_tile';
        } else if (rejectionCounts.invalid >= totalResources && totalResources > 0) {
          failureReason = 'invalid_spot_geometry';
        }
        serf._lastWorkSpotFailure = {
          reason: failureReason,
          buildingType: building.type,
          resourceCount: building.resources ? building.resources.length : 0,
          reservedCount: rejectionCounts.reserved,
          blacklistedCount: rejectionCounts.blacklisted,
          unreachableCount: rejectionCounts.unreachable
        };
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
          this.resetWorkSpotAssignment(serf, 'no_walkable_work_tile', { building });
          return null;
        }

        if (this.isCaveMineBuilding(building)) {
          this.primeCaveWorkNavigation(serf, building, workTile, selected);
        }

        if (building.assignSpot && typeof building.assignSpot === 'function') {
          building.assignSpot(serf.id, selected);
        }

        return selected;
      }

      return null;
    } catch (error) {
      if (serf) {
        serf._lastWorkSpotFailure = { reason: 'work_spot_exception', buildingType: building?.type || 'unknown' };
      }
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
      serf.work.shipId = null;
      serf.work.isStoredShip = false;
    } catch (error) {
      if (serf && serf.work) {
        serf.work.assignedSpot = null;
        serf.work.spot = null;
        serf.work.workTile = null;
        serf.work.workTileFor = null;
        serf.work.shipId = null;
        serf.work.isStoredShip = false;
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
   * Handle dock work - serfs must board ships to fish
   * Serfs path to dock tiles, then board ships when they arrive
   */
  handleDockWork(serf, dock) {
    try {
      if (!serf || !dock || dock.type !== 'dock') return;

      const PlayerList = global.Player && global.Player.list ? global.Player.list : {};
      const shipId = serf.work.shipId || (dock.assignedSpots && dock.assignedSpots[serf.id]);
      const isStoredShip = serf.work.isStoredShip || false;

      // If no ship assigned, try to assign one
      if (!shipId) {
        const spot = this.assignWorkSpot(serf, dock);
        if (!spot) {
          // No ships available
          return;
        }
        // Spot assigned, will have shipId now
        const newShipId = serf.work.shipId || (dock.assignedSpots && dock.assignedSpots[serf.id]);
        if (!newShipId) {
          return;
        }
        // Continue with new ship assignment
        const newIsStoredShip = serf.work.isStoredShip || false;
        if (newIsStoredShip) {
          // Ship is stored - serf should path to dock, we'll retrieve ship when they arrive
          const dockLoc = dock.plot && Array.isArray(dock.plot) && dock.plot.length > 0
            ? dock.plot[0]
            : (global.getLoc ? global.getLoc(dock.x, dock.y) : [Math.floor(dock.x / 64), Math.floor(dock.y / 64)]);
          const serfLoc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
            Math.floor(serf.x / 64),
            Math.floor(serf.y / 64)
          ];
          if (dockLoc && serfLoc && dockLoc.toString() !== serfLoc.toString()) {
            // Not at dock - path to dock tiles
            if (typeof serf.moveTo === 'function') {
              const movementSystem = require('../core/MovementSystem');
              if (movementSystem && movementSystem.applyMoveIntent) {
                movementSystem.applyMoveIntent(serf, {
                  z: dock.z || 0,
                  target: dockLoc,
                  reason: 'dock_work',
                  sourceAction: serf.action || 'work'
                });
              } else {
                serf.moveTo(dock.z || 0, dockLoc[0], dockLoc[1]);
              }
            }
          }
          return;
        } else {
          // Active ship - check if it exists
          const ship = PlayerList[newShipId];
          if (!ship || ship.toRemove) {
            // Ship no longer exists, clear assignment
            if (dock.assignedSpots) {
              delete dock.assignedSpots[serf.id];
            }
            serf.work.shipId = null;
            serf.work.spot = null;
            serf.work.assignedSpot = null;
            return;
          }
        }
      }

      // Check if serf is at dock location (not ship location - ships may be stored)
      const dockLoc = dock.plot && Array.isArray(dock.plot) && dock.plot.length > 0
        ? dock.plot[0]
        : (global.getLoc ? global.getLoc(dock.x, dock.y) : [Math.floor(dock.x / 64), Math.floor(dock.y / 64)]);
      const serfLoc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
        Math.floor(serf.x / 64),
        Math.floor(serf.y / 64)
      ];

      const atDock = dockLoc && serfLoc && dockLoc.toString() === serfLoc.toString();

      if (!atDock) {
        // Not at dock - path to dock tiles
        if (typeof serf.moveTo === 'function') {
          const movementSystem = require('../core/MovementSystem');
          if (movementSystem && movementSystem.applyMoveIntent) {
            movementSystem.applyMoveIntent(serf, {
              z: dock.z || 0,
              target: dockLoc,
              reason: 'dock_work',
              sourceAction: serf.action || 'work'
            });
          } else {
            serf.moveTo(dock.z || 0, dockLoc[0], dockLoc[1]);
          }
        }
        return;
      }

      // Serf is at dock - now handle ship boarding
      let ship = shipId ? PlayerList[shipId] : null;

      // If ship is stored, retrieve it first
      if (isStoredShip || (!ship && dock.storedShips)) {
        // Find stored ship and retrieve it
        let storedShipIndex = -1;
        for (let i = 0; i < dock.storedShips.length; i++) {
          if (dock.storedShips[i].shipId == shipId) {
            storedShipIndex = i;
            break;
          }
        }

        if (storedShipIndex >= 0) {
          // Retrieve ship from storage (spawns it at dock)
          // Use Building.prototype.retrieveShip since it may not be directly on the dock object
          const Building = global.Building;
          if (Building && Building.prototype && typeof Building.prototype.retrieveShip === 'function') {
            const house = this.getBuildingHouse(dock);
            const ownerId = house ? house.id : (dock.owner || dock.house);
            const retrievedShipId = Building.prototype.retrieveShip.call(dock, ownerId, storedShipIndex);
            if (retrievedShipId) {
              ship = PlayerList[retrievedShipId];
              if (ship) {
                // Update assignment to new ship ID
                if (dock.assignedSpots) {
                  dock.assignedSpots[serf.id] = retrievedShipId;
                }
                serf.work.shipId = retrievedShipId;
                serf.work.isStoredShip = false;
                // Add ship to dock.ships array if not already there
                if (dock.ships && dock.ships.indexOf(retrievedShipId) === -1) {
                  dock.ships.push(retrievedShipId);
                }
              }
          }
        }
      }
      }

      if (!ship || ship.toRemove) {
        // Ship not available - clear assignment and try to reassign
        if (dock.assignedSpots) {
          delete dock.assignedSpots[serf.id];
        }
        serf.work.shipId = null;
        serf.work.spot = null;
        serf.work.assignedSpot = null;
        serf.work.isStoredShip = false;
        return;
      }

      // Check if serf is already on the ship
      const isBoarded = ship.embarkedSerfs && ship.embarkedSerfs.indexOf(serf.id) !== -1;
      if (isBoarded) {
        // Serf is already on ship - ship handles fishing, serf just waits
        // The ship's update() method will handle fishing when on water tiles
        return;
      }

      // Check if ship is at dock (should be if we just retrieved it, or if it's docked/anchored)
      const shipLoc = global.getLoc ? global.getLoc(ship.x, ship.y) : [
        Math.floor(ship.x / 64),
        Math.floor(ship.y / 64)
      ];
      const shipAtDock = shipLoc && dockLoc && (
        shipLoc.toString() === dockLoc.toString() ||
        (ship.mode === 'docked' || ship.mode === 'anchored')
      );

      if (shipAtDock) {
        // Ship is at dock - board it
        if (ship.boardPassenger && typeof ship.boardPassenger === 'function') {
          const boarded = ship.boardPassenger(serf.id);
          if (boarded) {
            // Successfully boarded - add serf to embarkedSerfs array for fishing logic
            if (!ship.embarkedSerfs) {
              ship.embarkedSerfs = [];
            }
            if (ship.embarkedSerfs.indexOf(serf.id) === -1) {
              ship.embarkedSerfs.push(serf.id);
            }
            // Mark serf as boarded
            serf.isBoarded = true;
            serf.boardedShip = ship.id;
            // Ship will handle fishing when it sails to water tiles
            // For AI ships, they should start fishing when serfs board
            if (ship.mode === 'docked' || ship.mode === 'anchored') {
              ship.mode = 'fishing';
            }
          }
        }
      } else {
        // Ship not at dock yet - wait for it to arrive or retrieve it
        // (This shouldn't happen often, but handle it gracefully)
        if (ship.mode === 'returning') {
          // Ship is returning to dock - wait
          return;
        }
      }
    } catch (error) {
      console.error('[SERF WORK] Error handling dock work:', error);
    }
  }

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
      if (this.isCaveMineBuilding(building)) {
        this.primeCaveWorkNavigation(serf, building, workLoc, spot);
      }
      if (!workLoc) {
        const logger = this.getSerfLogger();
        if (logger && typeof logger.warn === 'function') {
          logger.warn('No walkable tile available for work spot', serf, { spot, z: expectedZ });
        }
        if (this.isCaveMineBuilding(building)) {
          this.recordSerfRuntimeEvent(serf, 'serf cave underground path failed', {
            recovery: 'cave_work_tile_missing',
            reason: 'no_walkable_work_tile',
            targetSpot: Array.isArray(spot) ? spot : null,
            expectedZ
          });
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
      } else if (!serf.path || serf.path.length === 0 || (atCorrectXY && !atCorrectZ)) {
        // Not at spot or wrong z-level - path to work spot
        this.noteWorkAttempt(serf, 'execute_work_move');
        if (this.isCaveMineBuilding(building) && serf.z === 0) {
          if (this.shouldDelayCaveEntryRetry(serf)) {
            this.setSerfDebug(serf, {
              lastFailure: 'cave_entry_waiting_for_retry',
              retryAfter: serf._lastCaveEntryPathBlockedAt + this.PATH_RECOVERY_THROTTLE_MS
            });
            return;
          }
          if (this.maybeRecoverSurfaceCaveApproach(serf, building, workLoc)) {
            return;
          }
          serf._lastCaveApproachAt = Date.now();
        }
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
        if (
          this.isCaveMineBuilding(building) &&
          serf.z === 0 &&
          serf.transitionIntent === 'enter_cave' &&
          serf.targetZLevel === -1 &&
          serf.mineExitCooldown > 0
        ) {
          this.setSerfDebug(serf, {
            lastFailure: 'cave_entry_waiting_for_cooldown',
            mineExitCooldown: serf.mineExitCooldown
          });
          return;
        }
        if (this.isCaveMineBuilding(building) && serf.z === 0 && this.shouldDelayCaveEntryRetry(serf)) {
          this.setSerfDebug(serf, {
            lastFailure: 'cave_entry_waiting_for_retry',
            retryAfter: serf._lastCaveEntryPathBlockedAt + this.PATH_RECOVERY_THROTTLE_MS
          });
          return;
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
          const result = movementSystem.applyMoveIntent(serf, {
            z: expectedZ,
            target: workLoc,
            reason: 'work',
            sourceAction: serf.action || 'work'
          });
          if (this.isCaveMineBuilding(building)) {
            if (serf.z === 0 && this.isWaitingForCaveEntry(serf) && (!serf.path || serf.path.length === 0)) {
              this.markCaveEntryPathBlocked(serf, result?.reason || 'no_surface_path_to_cave');
            }
            this.recordSerfRuntimeEvent(serf, 'serf cave approach requested', {
              recovery: 'cave_approach_requested',
              entrance: this.getCaveEntranceForBuilding(building),
              workLoc,
              status: result?.status || 'unknown',
              expectedZ
            });
            if (result && result.status === 'no_path') {
              this.recordSerfRuntimeEvent(serf, 'serf cave underground path failed', {
                recovery: 'cave_path_request_failed',
                reason: result.reason || 'no_path',
                entrance: this.getCaveEntranceForBuilding(building),
                workLoc,
                expectedZ
              });
            }
          }
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
            if (global.eventManager) {
              global.eventManager.resourceGathered(serf, 'grain', 10, { x: serf.x, y: serf.y, z: serf.z || 0 });
            }

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
          if (global.eventManager) {
            global.eventManager.resourceGathered(serf, 'wood', 10, { x: serf.x, y: serf.y, z: serf.z || 0 });
          }

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
            if (global.eventManager) {
              global.eventManager.resourceGathered(serf, 'diamond', 1, { x: serf.x, y: serf.y, z: serf.z || 0 });
            }
          } else if (roll < diamondChance + goldChance) {
            serf.inventory.goldore = (serf.inventory.goldore || 0) + 1;
            if (global.eventManager) {
              global.eventManager.resourceGathered(serf, 'goldore', 1, { x: serf.x, y: serf.y, z: serf.z || 0 });
            }
          } else if (roll < diamondChance + goldChance + silverChance) {
            serf.inventory.silverore = (serf.inventory.silverore || 0) + 1;
            if (global.eventManager) {
              global.eventManager.resourceGathered(serf, 'silverore', 1, { x: serf.x, y: serf.y, z: serf.z || 0 });
            }
          } else if (roll < diamondChance + goldChance + silverChance + ironChance) {
            serf.inventory.ironore = (serf.inventory.ironore || 0) + 1;
            if (global.eventManager) {
              global.eventManager.resourceGathered(serf, 'ironore', 1, { x: serf.x, y: serf.y, z: serf.z || 0 });
            }
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
          if (global.eventManager) {
            global.eventManager.resourceGathered(serf, 'stone', 10, { x: serf.x, y: serf.y, z: serf.z || 0 });
          }

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

      // Lower thresholds slightly to improve deposit efficiency (8 instead of 10 for common resources)
      // This encourages more frequent deposits and reduces resource loss from pathfinding issues
      return ((serf.inventory.wood || 0) >= 8) ||
             ((serf.inventory.stone || 0) >= 8) ||
             ((serf.inventory.ironore || 0) >= 8) ||
             ((serf.inventory.grain || 0) >= 8) ||
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

      // Check if serf is at the building's z-level and position
      // For stone mines: serfs work at z=0, building at z=0, both must match
      // For cave mines: serfs work at z=-1, but must exit to z=0 to deposit at building (z=0)
      const buildingZ = (building && typeof building.z === 'number') ? building.z : 0;
      const atCorrectZ = serf.z === buildingZ;
      const atCorrectXY = loc.toString() === dropoff.toString();
      
      // Both z-level and position must match for all mines
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
