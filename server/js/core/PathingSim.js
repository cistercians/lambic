// PathingSim.js - lightweight simulation harness for movement/path behavior
// Run manually with: node server/js/core/PathingSim.js

const movementSystem = require('./MovementSystem');

function installGlobals() {
  global.tileSize = global.tileSize || 64;
  global.getLoc = (x, y) => [Math.floor(x / global.tileSize), Math.floor(y / global.tileSize)];
  global.getCenter = (c, r) => [c * global.tileSize + global.tileSize / 2, r * global.tileSize + global.tileSize / 2];
  global.isWalkable = () => true;
}

function makeEntity(overrides = {}) {
  return Object.assign({
    id: 'sim-entity',
    type: 'npc',
    class: 'Serf',
    x: global.tileSize,
    y: global.tileSize,
    z: 0,
    currentSpeed: global.tileSize,
    path: null,
    pathCount: 0,
    pathCooldown: 0,
    action: 'work',
    mode: 'work',
    checkAggro: () => {}
  }, overrides);
}

function runShortPathOscillationTest() {
  const entity = makeEntity();
  entity.path = [[1, 1], [1, 2], [1, 3]];
  entity.pathCount = 0;
  entity.currentSpeed = 0; // Force no movement to trigger stuck/oscillation logic
  movementSystem.applyMoveIntent(entity, { z: 0, target: [1, 3], reason: 'deposit', sourceAction: 'deposit' });

  for (let i = 0; i < 5; i++) {
    movementSystem.handlePathFollowing(entity);
  }

  const stillHasPath = !!entity.path;
  return { name: 'short-path-oscillation', passed: stillHasPath, details: { pathStillPresent: stillHasPath } };
}

function runMultiZIntentTest() {
  const entity = makeEntity({
    z: -1,
    moveToCalls: []
  });
  entity.moveTo = (tz, tc, tr) => {
    entity.moveToCalls.push([tz, tc, tr]);
  };

  const result = movementSystem.applyMoveIntent(entity, { z: 0, target: [5, 5], reason: 'deposit', sourceAction: 'deposit' });
  const called = entity.moveToCalls.length === 1;
  return { name: 'multi-z-intent', passed: called, details: { resultStatus: result.status, calls: entity.moveToCalls } };
}

function runDirectMoveTest() {
  const entity = makeEntity();
  entity.moveTo = () => {};
  const result = movementSystem.applyMoveIntent(entity, { z: 0, target: [2, 2], reason: 'work', sourceAction: 'work' });
  return { name: 'direct-move', passed: result.status === 'direct' || result.status === 'success', details: { status: result.status } };
}

function runAll() {
  installGlobals();
  const results = [
    runShortPathOscillationTest(),
    runMultiZIntentTest(),
    runDirectMoveTest()
  ];
  results.forEach(result => {
    const status = result.passed ? 'PASS' : 'FAIL';
    console.log(`[PathingSim] ${status} ${result.name}`, result.details);
  });
}

if (require.main === module) {
  runAll();
}

module.exports = {
  runShortPathOscillationTest,
  runMultiZIntentTest,
  runDirectMoveTest
};
