const assert = require('assert');

const { Character } = require('../server/js/Entity');

function resetGlobals() {
  global.Building = { list: {} };
  global.House = { list: {} };
  global.Player = { list: {} };
  global.Item = { list: {} };
  global.Inventory = () => ({ keyRing: [] });
  global.Fireplace = function() {};
  global.initPack = { player: [], building: [], item: [], light: [], weather: [] };
  global.caveEntrances = [];
  global.matrixO = [];
  global.matrixU = [];
  global.matrixB1 = [];
  global.matrixB2 = [];
  global.matrixB3 = [];
  global.matrixW = [];
  global.getLoc = (x, y) => [Math.floor(x / 64), Math.floor(y / 64)];
  global.getCenter = (c, r) => [c * 64 + 32, r * 64 + 32];
  global.getTile = () => 7;
  global.isWalkable = () => true;
  global.getCachedPath = () => null;
  global.cachePath = () => {};
  global.createMultiZPath = () => null;
  global.findPathContextAware = () => null;
  global.smoothPath = path => path;
  global.getBuilding = () => null;
  global.zones = new Map();
  global.allyCheck = () => 0;
  global.nightfall = false;
  global.stuckEntityAnalytics = {
    enabled: false,
    recordStuckEvent() {},
    getStats() { return { totalEvents: 0 }; },
    maybeLogStats() {}
  };
}

function makeCharacter(overrides = {}) {
  return Character(Object.assign({
    id: 'char-1',
    x: 96,
    y: 96,
    z: 1,
    class: 'Serf'
  }, overrides));
}

function testIndoorExitFallbackUsesDoorAwarePathing() {
  resetGlobals();
  global.Building.list.hut1 = {
    id: 'hut1',
    entrance: [5, 5],
    ustairs: [6, 4],
    dstairs: [4, 6]
  };

  const startCenter = global.getCenter(1, 1);
  global.getBuilding = (x, y) => (x === startCenter[0] && y === startCenter[1] ? 'hut1' : null);

  const calls = [];
  global.findPathContextAware = (start, destination, layer, options) => {
    calls.push({ start, destination, layer, options });
    return [start, destination];
  };

  const entity = makeCharacter();
  entity.getPath(0, 20, 20);

  assert.strictEqual(calls.length, 1, 'expected indoor exit fallback to request a building-floor path');
  assert.strictEqual(calls[0].layer, 3, 'expected indoor exit fallback to use the z=1 pathing layer');
  assert.deepStrictEqual(calls[0].destination, [5, 6], 'expected indoor exit fallback to target the tile south of the hut entrance');
  assert.strictEqual(calls[0].options.allowSpecificDoor, true, 'expected indoor exit fallback to explicitly allow the target exit tile');
  assert.deepStrictEqual(calls[0].options.targetDoor, [5, 6], 'expected indoor exit fallback to whitelist the exact exit tile');
  assert.strictEqual(entity.pathCount, 0, 'expected indoor exit pathing to initialize path traversal state');
}

function testIndoorStairFallbackUsesStairAwarePathing() {
  resetGlobals();
  global.Building.list.house1 = {
    id: 'house1',
    entrance: [5, 5],
    ustairs: [6, 4],
    dstairs: [4, 6]
  };

  const startCenter = global.getCenter(1, 1);
  global.getBuilding = () => 'house1';

  const calls = [];
  global.findPathContextAware = (start, destination, layer, options) => {
    calls.push({ start, destination, layer, options });
    return [start, destination];
  };

  const upstairsEntity = makeCharacter({ id: 'char-up' });
  upstairsEntity.getPath(2, 6, 4);

  const cellarEntity = makeCharacter({ id: 'char-cellar' });
  cellarEntity.getPath(-2, 4, 6);

  assert.strictEqual(calls.length, 2, 'expected indoor stair transitions to pathfind instead of issuing malformed moveTo calls');
  assert.strictEqual(calls[0].layer, 3, 'expected upstairs fallback to remain on the z=1 layer');
  assert.deepStrictEqual(calls[0].destination, [6, 4], 'expected upstairs fallback to target the building staircase');
  assert.deepStrictEqual(calls[0].options.targetStairs, [6, 4], 'expected upstairs fallback to whitelist the staircase tile');
  assert.strictEqual(calls[0].options.avoidStairs, true, 'expected upstairs fallback to avoid unrelated stairs');
  assert.strictEqual(calls[1].layer, 3, 'expected cellar fallback to remain on the z=1 layer');
  assert.deepStrictEqual(calls[1].destination, [4, 6], 'expected cellar fallback to target the cellar staircase');
  assert.deepStrictEqual(calls[1].options.targetStairs, [4, 6], 'expected cellar fallback to whitelist the cellar staircase tile');
  assert.strictEqual(calls[1].options.avoidStairs, true, 'expected cellar fallback to avoid unrelated stairs');
}

function run() {
  testIndoorExitFallbackUsesDoorAwarePathing();
  testIndoorStairFallbackUsesStairAwarePathing();
  console.log('entityIndoorTransition.test.js passed');
}

run();

if (require.main === module) {
  process.exit(0);
}
