const assert = require('assert');

const SimpleSerfBehavior = require('../server/js/core/SimpleSerfBehavior');
const movementSystem = require('../server/js/core/MovementSystem');

function resetGlobals() {
  global.Building = { list: {} };
  global.House = { list: {} };
  global.__aiEvents = [];
  global.eventManager = {
    aiEvent(action, payload) {
      global.__aiEvents.push({ action, payload });
    }
  };
  global.serfLogger = null;
  global.nightfall = false;
  global.getLoc = (x, y) => [Math.floor(x / 64), Math.floor(y / 64)];
  global.getTile = () => 7;
  global.isWalkable = () => true;
  global.getBuilding = () => null;
}

function makeSerf(overrides = {}) {
  return Object.assign({
    id: 'serf-1',
    class: 'Serf',
    house: 1,
    x: 64,
    y: 64,
    z: 0,
    mode: 'idle',
    action: null,
    work: { hq: null, spot: null, assignedSpot: null, workTile: null, workTileFor: null },
    idleTime: 0,
    idleRange: 20,
    moveTarget: null,
    move(target) {
      this.moveTarget = target;
    },
    findNearestWalkableTile(c, r) {
      return [c + 1, r];
    }
  }, overrides);
}

function testNormalizeWorkModeDuringDay() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  global.Building.list.mine1 = { id: 'mine1', type: 'mine', cave: true, built: true, resources: [[2, 2]], assignedSpots: {} };

  const serf = makeSerf({
    z: -1,
    mode: 'idle',
    work: { hq: 'mine1', spot: null, assignedSpot: null, workTile: null, workTileFor: null }
  });

  behavior.normalizeSerfState(serf);

  assert.strictEqual(serf.mode, 'work', 'expected on-shift serf to normalize back into work mode');
  assert.strictEqual(serf.serfState, 'working', 'expected normalization to set working state');
}

function testNormalizeWorkModeClearsStaleOffWorkStateDuringDay() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  global.Building.list.millStale = { id: 'millStale', type: 'mill', built: true, resources: [[5, 5]], assignedSpots: {} };

  const serf = makeSerf({
    mode: 'idle',
    action: 'task',
    _offWorkTargetType: 'tavern',
    _savedWorkSpot: [5, 5],
    _pendingTransition: { type: 'offworkDecision', at: Date.now() - 1000 },
    work: { hq: 'millStale', spot: [20, 20], assignedSpot: null, workTile: null, workTileFor: null }
  });

  behavior.normalizeSerfState(serf);

  assert.strictEqual(serf.mode, 'work', 'expected stale off-work task state to normalize back into work mode during day');
  assert.strictEqual(serf.action, null, 'expected stale off-work task action to be cleared during day');
  assert.strictEqual(serf._offWorkTargetType, null, 'expected stale off-work target type to be cleared');
  assert.strictEqual(serf._savedWorkSpot, null, 'expected saved off-work spot to be cleared after restoration');
  assert.strictEqual(serf._pendingTransition, null, 'expected stale off-work transition to be cleared during day');
  assert.deepStrictEqual(serf.work.spot, [5, 5], 'expected saved work spot to be restored before work resumes');
}

function testAssignWorkSpotSkipsRejectedSpot() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  const building = {
    id: 'mill1',
    type: 'mill',
    built: true,
    resources: [[1, 1], [2, 2]],
    assignedSpots: {},
    isSpotAvailable() {
      return true;
    },
    assignSpot(serfId, spot) {
      this.assignedSpots[serfId] = spot;
    },
    releaseSpot(serfId) {
      delete this.assignedSpots[serfId];
    }
  };
  global.Building.list.mill1 = building;

  const serf = makeSerf({
    work: { hq: 'mill1', spot: null, assignedSpot: null, workTile: null, workTileFor: null }
  });

  behavior.rememberRejectedWorkSpot(serf, building, [1, 1], 'test_rejection');
  const selected = behavior.assignWorkSpot(serf, building);

  assert.deepStrictEqual(selected, [2, 2], 'expected assignWorkSpot to skip recently rejected coordinates');
  assert.deepStrictEqual(serf.work.assignedSpot, [2, 2], 'expected alternate spot to be assigned');
}

function testRecoverFromPathFailureResetsSpot() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  let released = false;
  global.Building.list.mine2 = {
    id: 'mine2',
    type: 'mine',
    cave: true,
    built: true,
    resources: [[3, 3]],
    assignedSpots: { 'serf-1': [3, 3] },
    releaseSpot(serfId) {
      released = true;
      delete this.assignedSpots[serfId];
    }
  };

  const serf = makeSerf({
    x: 128,
    y: 128,
    z: -1,
    mode: 'work',
    work: { hq: 'mine2', spot: [3, 3], assignedSpot: [3, 3], workTile: null, workTileFor: null },
    _lastPathInvalidation: { reason: 'gaveUp', at: Date.now(), data: {} }
  });

  behavior.recoverFromPathFailure(serf);

  assert.strictEqual(released, true, 'expected building reservation to be released during recovery');
  assert.strictEqual(serf.work.assignedSpot, null, 'expected assigned spot to be cleared during recovery');
  assert.strictEqual(serf.action, null, 'expected recovery to leave serf ready for reassignment');
  assert.deepStrictEqual(serf.moveTarget, [3, 2], 'expected recovery to nudge serf toward a nearby safe tile');
}

function testRecoverFromPathFailurePreservesDepositIntent() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  global.Building.list.mineDeposit = {
    id: 'mineDeposit',
    type: 'mine',
    built: true,
    resources: [[3, 3]],
    assignedSpots: { 'serf-1': [3, 3] }
  };

  const serf = makeSerf({
    action: 'deposit',
    mode: 'work',
    path: [[4, 4]],
    pathCount: 0,
    pathEnd: { z: 0, loc: [1, 1] },
    inventory: { stone: 10 },
    work: { hq: 'mineDeposit', spot: [3, 3], assignedSpot: [3, 3], workTile: null, workTileFor: null },
    _lastPathInvalidation: { reason: 'gaveUp', at: Date.now(), data: {} }
  });

  behavior.recoverFromPathFailure(serf);

  assert.strictEqual(serf.action, 'deposit', 'expected deposit path recovery to preserve deposit intent');
  assert.deepStrictEqual(serf.work.assignedSpot, [3, 3], 'expected deposit recovery not to release the work reservation');
  assert.strictEqual(serf.path, null, 'expected deposit recovery to clear the failed path so the handler can retry');
  assert.ok(
    global.__aiEvents.some(event => event.action === 'serf recovery transition' && event.payload.metadata.recovery === 'path_failure_retry'),
    'expected retry recovery diagnostics for deposit path failures'
  );
}

function testRecoverFromPathFailurePreservesClockoutIntentWhileIdle() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  global.Building.list.millClockout = {
    id: 'millClockout',
    type: 'mill',
    built: true,
    resources: [[3, 3]],
    assignedSpots: {}
  };

  const serf = makeSerf({
    action: 'clockout',
    mode: 'idle',
    path: [[4, 4]],
    pathCount: 0,
    home: { z: 1, loc: [8, 8] },
    inventory: { grain: 10 },
    work: { hq: 'millClockout', spot: null, assignedSpot: null, workTile: null, workTileFor: null },
    _lastPathInvalidation: { reason: 'gaveUp', at: Date.now(), data: {} }
  });

  behavior.recoverFromPathFailure(serf);

  assert.strictEqual(serf.action, 'clockout', 'expected idle clockout path recovery to preserve clockout intent');
  assert.strictEqual(serf.path, null, 'expected clockout recovery to clear failed movement so clockout can retry');
}

function testUndergroundIdleWandering() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  const serf = makeSerf({
    z: -1,
    x: 320,
    y: 320,
    mode: 'idle'
  });

  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    behavior.handleWandering(serf);
  } finally {
    Math.random = originalRandom;
  }

  assert.deepStrictEqual(serf.moveTarget, [5, 4], 'expected idle wandering to work on underground z-layers');
}

function testResumeWorkFromInteriorRequestsSurfaceExit() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  const building = {
    id: 'mill2',
    type: 'mill',
    built: true,
    entrance: [10, 10],
    resources: [[12, 12]],
    assignedSpots: {}
  };
  global.Building.list.mill2 = building;

  const serf = makeSerf({
    x: 640,
    y: 704,
    z: 1,
    mode: 'work',
    work: { hq: 'mill2', spot: [12, 12], assignedSpot: [12, 12], workTile: null, workTileFor: null }
  });

  const originalApplyMoveIntent = movementSystem.applyMoveIntent;
  let lastIntent = null;
  movementSystem.applyMoveIntent = (entity, intent) => {
    lastIntent = { entity, intent };
    return { status: 'direct' };
  };

  try {
    behavior.handleDefaultWork(serf);
  } finally {
    movementSystem.applyMoveIntent = originalApplyMoveIntent;
  }

  assert.ok(lastIntent, 'expected resume from interior to request a move intent');
  assert.strictEqual(lastIntent.entity, serf, 'expected move intent to target the waking serf');
  assert.strictEqual(lastIntent.intent.z, 0, 'expected interior resume to request surface movement for surface jobs');
  assert.strictEqual(lastIntent.intent.reason, 'resume_work', 'expected interior resume reason to be recorded');
  assert.strictEqual(serf._interiorResume?.expectedZ, 0, 'expected interior resume requests to stay pending until the serf exits the hut');
}

function testRecoverFromPathFailureForcesInteriorExit() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  global.Building.list.work1 = {
    id: 'work1',
    type: 'mill',
    built: true,
    entrance: [10, 10],
    resources: [[12, 12]],
    assignedSpots: {}
  };
  global.Building.list.hut1 = {
    id: 'hut1',
    type: 'gothhut',
    built: true,
    entrance: [4, 4]
  };
  global.getBuilding = () => 'hut1';

  const serf = makeSerf({
    x: 256,
    y: 256,
    z: 1,
    mode: 'work',
    work: { hq: 'work1', spot: [12, 12], assignedSpot: [12, 12], workTile: null, workTileFor: null },
    _interiorResume: { buildingId: 'work1', expectedZ: 0, requestedAt: Date.now(), target: [10, 10], status: 'direct' },
    _lastPathInvalidation: { reason: 'gaveUp', at: Date.now(), data: {} },
    exitBuilding(buildingId) {
      this.exitedBuildingId = buildingId;
      this.z = 0;
    }
  });

  behavior.recoverFromPathFailure(serf);

  assert.strictEqual(serf.z, 0, 'expected z1 path failures during work resume to force an exit from the hut');
  assert.strictEqual(serf.exitedBuildingId, 'hut1', 'expected forced exit to use the current interior building');
  assert.strictEqual(serf.work.assignedSpot.toString(), '12,12', 'expected forced exit recovery to preserve the current work assignment');
  assert.strictEqual(serf._interiorResume, null, 'expected forced exit recovery to clear pending interior-resume state');
  assert.ok(
    global.__aiEvents.some(event => event.action === 'serf recovery transition' && event.payload.metadata.recovery === 'resume_from_interior_forced_exit'),
    'expected forced-exit recovery diagnostics'
  );
}

function testCaveWorkPrimesPreferredEntrance() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  const building = {
    id: 'mine3',
    type: 'mine',
    cave: [9, 9],
    built: true,
    resources: [[12, 12]],
    assignedSpots: {}
  };
  global.Building.list.mine3 = building;

  const serf = makeSerf({
    z: 0,
    mode: 'work',
    moveTo() {},
    work: { hq: 'mine3', spot: [12, 12], assignedSpot: [12, 12], workTile: null, workTileFor: null }
  });

  const originalApplyMoveIntent = movementSystem.applyMoveIntent;
  let lastIntent = null;
  movementSystem.applyMoveIntent = (entity, intent) => {
    lastIntent = { entity, intent };
    return { status: 'success' };
  };

  try {
    behavior.executeWork(serf, building, [12, 12]);
  } finally {
    movementSystem.applyMoveIntent = originalApplyMoveIntent;
  }

  assert.deepStrictEqual(serf.preferredCaveEntrance, [9, 9], 'expected cave miners to retain the mine entrance as navigation hint');
  assert.ok(lastIntent, 'expected cave miner to request movement toward underground work');
  assert.strictEqual(lastIntent.intent.z, -1, 'expected cave miner work move to target cave z-level');
  assert.deepStrictEqual(lastIntent.intent.target, [12, 12], 'expected cave miner to path toward the underground work tile');
}

function testCaveSurfaceRecoveryRetriesEntry() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  const building = {
    id: 'mine4',
    type: 'mine',
    cave: [7, 7],
    built: true,
    resources: [[14, 14]],
    assignedSpots: {}
  };
  global.Building.list.mine4 = building;

  const serf = makeSerf({
    z: 0,
    mode: 'work',
    transitionIntent: null,
    targetZLevel: null,
    work: { hq: 'mine4', spot: [14, 14], assignedSpot: [14, 14], workTile: null, workTileFor: null },
    _lastCaveApproachAt: Date.now() - 10000,
    _lastPathInvalidation: { reason: 'no_path', at: Date.now(), data: {} }
  });

  const originalApplyMoveIntent = movementSystem.applyMoveIntent;
  let lastIntent = null;
  movementSystem.applyMoveIntent = (entity, intent) => {
    lastIntent = { entity, intent };
    return { status: 'success' };
  };

  try {
    const recovered = behavior.maybeRecoverSurfaceCaveApproach(serf, building, [14, 14]);
    assert.strictEqual(recovered, true, 'expected stalled cave miner to trigger explicit cave-entry recovery');
  } finally {
    movementSystem.applyMoveIntent = originalApplyMoveIntent;
  }

  assert.ok(lastIntent, 'expected cave recovery to issue a fresh move intent');
  assert.strictEqual(lastIntent.intent.reason, 'recover_cave_entry', 'expected recovery move intent to use cave recovery reason');
  assert.strictEqual(lastIntent.intent.z, -1, 'expected recovery move to target cave z-level');
  assert.deepStrictEqual(serf.preferredCaveEntrance, [7, 7], 'expected recovery to restore preferred cave entrance');
  assert.ok(global.__aiEvents.some(event => event.action === 'serf recovery transition'), 'expected recovery diagnostics to be emitted');
}

function testCaveEntryCooldownWaitsWithoutRequestingNewPath() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  const building = {
    id: 'mineCooldown',
    type: 'mine',
    cave: [7, 7],
    built: true,
    resources: [[14, 14]],
    assignedSpots: {}
  };
  global.Building.list.mineCooldown = building;

  const serf = makeSerf({
    z: 0,
    mode: 'work',
    transitionIntent: 'enter_cave',
    targetZLevel: -1,
    mineExitCooldown: 4,
    moveTo() {},
    work: { hq: 'mineCooldown', spot: [14, 14], assignedSpot: [14, 14], workTile: null, workTileFor: null }
  });

  const originalApplyMoveIntent = movementSystem.applyMoveIntent;
  let moveRequests = 0;
  movementSystem.applyMoveIntent = () => {
    moveRequests += 1;
    return { status: 'success' };
  };

  try {
    behavior.executeWork(serf, building, [14, 14]);
  } finally {
    movementSystem.applyMoveIntent = originalApplyMoveIntent;
  }

  assert.strictEqual(moveRequests, 0, 'expected cave cooldown wait not to issue repeated cave-entry move intents');
  assert.strictEqual(serf.action, null, 'expected cave cooldown wait to preserve normal work action state');
  assert.strictEqual(serf._serfDebug.lastFailure, 'cave_entry_waiting_for_cooldown', 'expected cooldown wait diagnostics');
}

function testCaveEntryNoSurfacePathThrottlesRetry() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  const building = {
    id: 'mineNoSurfacePath',
    type: 'mine',
    cave: [7, 7],
    built: true,
    resources: [[14, 14]],
    assignedSpots: {}
  };
  global.Building.list.mineNoSurfacePath = building;

  const serf = makeSerf({
    z: 0,
    mode: 'work',
    path: null,
    moveTo() {},
    work: { hq: 'mineNoSurfacePath', spot: [14, 14], assignedSpot: [14, 14], workTile: null, workTileFor: null }
  });

  const originalApplyMoveIntent = movementSystem.applyMoveIntent;
  let moveRequests = 0;
  movementSystem.applyMoveIntent = (entity) => {
    moveRequests += 1;
    entity.transitionIntent = 'enter_cave';
    entity.targetZLevel = -1;
    entity.targetLoc = [14, 14];
    entity.caveEntrance = [7, 7];
    entity.path = null;
    return { status: 'direct' };
  };

  try {
    behavior.executeWork(serf, building, [14, 14]);
    behavior.executeWork(serf, building, [14, 14]);
  } finally {
    movementSystem.applyMoveIntent = originalApplyMoveIntent;
  }

  assert.strictEqual(moveRequests, 1, 'expected cave entry path failures to throttle immediate retry attempts');
  assert.strictEqual(serf._serfDebug.lastFailure, 'cave_entry_waiting_for_retry', 'expected retry-wait diagnostics after blocked cave entry');
  assert.strictEqual(serf._lastPathInvalidation.reason, 'no_surface_path_to_cave', 'expected blocked cave entry to register path invalidation');
}

function testCaveMineIdleWarningSuppressedAtNight() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  global.nightfall = true;
  global.Building.list.mineNight = {
    id: 'mineNight',
    type: 'mine',
    cave: [7, 7],
    built: true,
    resources: [[14, 14]],
    assignedSpots: {}
  };

  const serf = makeSerf({
    z: 1,
    mode: 'idle',
    work: { hq: 'mineNight', spot: [14, 14], assignedSpot: [14, 14], workTile: null, workTileFor: null }
  });

  const originalWarn = console.warn;
  let warningCount = 0;
  console.warn = () => {
    warningCount += 1;
  };

  try {
    behavior.handleDefaultWork(serf);
  } finally {
    console.warn = originalWarn;
  }

  assert.strictEqual(warningCount, 0, 'expected off-shift cave miners not to emit work-mode warnings at night');
  assert.strictEqual(serf.mode, 'idle', 'expected off-shift cave miner to remain idle at night');
}

function testClockoutWithInventoryDoesNotGoHomeWhenDropoffMissing() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  global.Building.list.millNoDropoff = {
    id: 'millNoDropoff',
    type: 'mill',
    built: true,
    resources: [[3, 3]],
    assignedSpots: {}
  };
  behavior.getDropoffLocationForSerf = () => null;

  const serf = makeSerf({
    action: 'clockout',
    mode: 'idle',
    inventory: { grain: 10 },
    home: { z: 1, loc: [10, 10] },
    moveTo() {
      this.homeMoveRequested = true;
    },
    work: { hq: 'millNoDropoff', spot: null, assignedSpot: null, workTile: null, workTileFor: null }
  });

  behavior.handleClockout(serf);

  assert.strictEqual(serf.action, 'clockout', 'expected clockout to keep deposit-first intent when dropoff is missing');
  assert.strictEqual(serf.homeMoveRequested, undefined, 'expected serf not to path home while still carrying resources');
  assert.strictEqual(serf._serfDebug.lastFailure, 'clockout_dropoff_missing', 'expected missing-dropoff diagnostics');
  assert.ok(global.__aiEvents.some(event => event.action === 'serf clockout deposit blocked'), 'expected blocked deposit diagnostics');
}

function testPendingHutDoesNotBypassSchedule() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  global.Building.list.hut1 = { id: 'hut1', type: 'gothhut', built: false };
  global.Building.list.work1 = { id: 'work1', type: 'mill', built: true, resources: [[2, 2]], assignedSpots: {} };
  global.nightfall = true;

  const serf = makeSerf({
    mode: 'idle',
    hut: 'hut1',
    work: { hq: 'work1', spot: null, assignedSpot: null, workTile: null, workTileFor: null }
  });

  behavior.handleDefaultWork(serf);

  assert.strictEqual(serf.mode, 'idle', 'expected pending hut to respect current off-work state');
  assert.strictEqual(serf.action, null, 'expected pending hut not to force immediate build action before dawn');
  assert.strictEqual(serf.serfState, 'idle', 'expected serf to remain in idle state until scheduled startWork');
}

function testPendingPersonalHutBlocksBuildAssist() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  global.Building.list.hut1 = { id: 'hut1', type: 'gothhut', built: false };
  global.Building.list.build1 = {
    id: 'build1',
    house: 1,
    type: 'mill',
    built: false,
    plot: [[2, 2]]
  };
  global.getTile = (z, x, y) => (x === 2 && y === 2 ? 11 : 7);

  const serf = makeSerf({
    house: 1,
    hut: null,
    _personalHutId: 'hut1'
  });

  const target = behavior.getBuildAssistTarget(serf);
  const assigned = behavior.assignBuildAssist(serf, global.Building.list.build1);

  assert.strictEqual(target, null, 'expected pending personal hut to block generic build-assist targeting');
  assert.strictEqual(assigned, false, 'expected assignBuildAssist to refuse serfs with unresolved personal huts');
  assert.strictEqual(serf.hut, 'hut1', 'expected tracked personal hut id to restore serf.hut when missing');
  assert.ok(global.__aiEvents.some(event => event.action === 'serf build assist skipped'), 'expected assist-skip diagnostics for pending huts');
  assert.ok(global.__aiEvents.some(event => event.action === 'serf build assist blocked'), 'expected assist-block diagnostics for pending huts');
}

function testHandleDefaultWorkRestoresPersonalHutPriority() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  global.Building.list.hut1 = { id: 'hut1', type: 'gothhut', built: false };
  global.Building.list.work1 = { id: 'work1', type: 'mill', built: true, resources: [[3, 3]], assignedSpots: {} };
  global.Building.list.build1 = {
    id: 'build1',
    house: 1,
    type: 'lumbermill',
    built: false,
    plot: [[4, 4]]
  };
  global.getTile = (z, x, y) => (x === 4 && y === 4 ? 11 : 7);

  const serf = makeSerf({
    house: 1,
    mode: 'work',
    action: null,
    hut: 'hut1',
    _buildAssistBuilding: 'build1',
    work: { hq: 'work1', spot: null, assignedSpot: null, workTile: null, workTileFor: null }
  });

  behavior.handleDefaultWork(serf);

  assert.strictEqual(serf.action, 'build', 'expected serf to stay on personal hut construction');
  assert.strictEqual(serf._buildAssistBuilding, null, 'expected stale assist target to be cleared when a personal hut is pending');
  assert.ok(global.__aiEvents.some(event => event.action === 'serf hut priority restored'), 'expected hut-priority restoration diagnostics');
}

function testHandleBuildPreservesPersonalHutIntentWhenHutIsMissing() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();

  const serf = makeSerf({
    mode: 'work',
    action: 'build',
    hut: 'hut1',
    _personalHutId: 'hut1',
    _buildAssistBuilding: 'build1',
    work: { hq: 'work1', spot: [5, 5], assignedSpot: null, workTile: null, workTileFor: null }
  });

  behavior.handleBuild(serf);

  assert.strictEqual(serf.action, 'build', 'expected missing personal hut to keep the serf in build intent');
  assert.strictEqual(serf.mode, 'work', 'expected missing personal hut to keep the serf on work duty');
  assert.strictEqual(serf._buildAssistBuilding, null, 'expected stale assist target to be discarded when personal hut takes priority');
  assert.strictEqual(serf.work.spot, null, 'expected build spot to reset when the personal hut target cannot be resolved');
  assert.ok(global.__aiEvents.some(event => event.action === 'serf build exit' && event.payload.metadata.reason === 'personal_hut_missing'), 'expected personal hut missing diagnostics');
}

function testHandleBuildReturnsToProfessionAfterPersonalHutCompletion() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  global.Building.list.hut1 = { id: 'hut1', type: 'gothhut', built: true };

  const serf = makeSerf({
    mode: 'work',
    action: 'build',
    hut: 'hut1',
    _personalHutId: 'hut1',
    work: { hq: 'work1', spot: [6, 6], assignedSpot: null, workTile: null, workTileFor: null }
  });

  behavior.handleBuild(serf);

  assert.strictEqual(serf.action, null, 'expected completed personal hut to release the serf back to profession work');
  assert.strictEqual(serf.mode, 'work', 'expected completed personal hut to keep the serf in work mode');
  assert.strictEqual(serf.work.spot, null, 'expected hut build spot to be cleared once construction is complete');
  assert.ok(global.__aiEvents.some(event => event.action === 'serf build exit' && event.payload.metadata.reason === 'personal_hut_complete'), 'expected personal hut completion diagnostics');
}

function testHandleBuildSelectsWalkableFoundationTile() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  global.Building.list.hut1 = {
    id: 'hut1',
    type: 'gothhut',
    built: false,
    plot: [[1, 1], [2, 1], [1, 0], [2, 0]]
  };
  global.getTile = (z, x, y) => ((x === 1 || x === 2) && (y === 0 || y === 1) ? 11 : 7);
  global.isWalkable = (z, x, y) => x === 2 && y === 1;

  const serf = makeSerf({
    x: 64,
    y: 64,
    mode: 'work',
    action: 'build',
    hut: 'hut1',
    moveTo() {},
    work: { hq: 'work1', spot: null, assignedSpot: null, workTile: null, workTileFor: null }
  });

  const originalApplyMoveIntent = movementSystem.applyMoveIntent;
  let lastIntent = null;
  movementSystem.applyMoveIntent = (entity, intent) => {
    lastIntent = { entity, intent };
    return { status: 'success' };
  };

  try {
    behavior.handleBuild(serf);
  } finally {
    movementSystem.applyMoveIntent = originalApplyMoveIntent;
  }

  assert.deepStrictEqual(serf.work.spot, [2, 1], 'expected builder to choose the walkable foundation tile');
  assert.ok(lastIntent, 'expected hut build selection to issue a movement intent');
  assert.deepStrictEqual(lastIntent.intent.target, [2, 1], 'expected builder to path directly onto the selected foundation tile');
  assert.ok(global.__aiEvents.some(event => event.action === 'serf build target selected'), 'expected build target selection diagnostics');
}

function run() {
  testNormalizeWorkModeDuringDay();
  testNormalizeWorkModeClearsStaleOffWorkStateDuringDay();
  testAssignWorkSpotSkipsRejectedSpot();
  testRecoverFromPathFailureResetsSpot();
  testRecoverFromPathFailurePreservesDepositIntent();
  testRecoverFromPathFailurePreservesClockoutIntentWhileIdle();
  testUndergroundIdleWandering();
  testResumeWorkFromInteriorRequestsSurfaceExit();
  testRecoverFromPathFailureForcesInteriorExit();
  testCaveWorkPrimesPreferredEntrance();
  testCaveSurfaceRecoveryRetriesEntry();
  testCaveEntryCooldownWaitsWithoutRequestingNewPath();
  testCaveEntryNoSurfacePathThrottlesRetry();
  testCaveMineIdleWarningSuppressedAtNight();
  testClockoutWithInventoryDoesNotGoHomeWhenDropoffMissing();
  testPendingHutDoesNotBypassSchedule();
  testPendingPersonalHutBlocksBuildAssist();
  testHandleDefaultWorkRestoresPersonalHutPriority();
  testHandleBuildPreservesPersonalHutIntentWhenHutIsMissing();
  testHandleBuildReturnsToProfessionAfterPersonalHutCompletion();
  testHandleBuildSelectsWalkableFoundationTile();
  console.log('simpleSerfBehaviorRecovery.test.js passed');
}

run();
