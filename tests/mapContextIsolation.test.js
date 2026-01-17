const assert = require('assert');
const mapContextHelpers = require('../server/js/core/MapContextHelpers');

function resetGlobals() {
  global.Item = { list: {} };
  global.Building = { list: {} };
  global.Arrow = { list: {} };
  global.Light = { list: {} };
  global.Weather = { list: {} };
}

function run() {
  resetGlobals();

  global.Item.list.item1 = { id: 'item1', inBattleground: true, battlegroundMatchId: 'm1' };
  global.Building.list.building1 = { id: 'building1', inBattleground: false, battlegroundMatchId: null };
  global.Arrow.list.arrow1 = { id: 'arrow1', inBattleground: true, battlegroundMatchId: 'm1' };
  global.Light.list.light1 = { id: 'light1', inBattleground: true, battlegroundMatchId: 'm1' };
  global.Weather.list.weather1 = { id: 'weather1', inBattleground: true, battlegroundMatchId: 'm1' };

  const updatePack = {
    player: [{ id: 'p1', inBattleground: true, battlegroundMatchId: 'm1' }],
    item: [{ id: 'item1' }],
    building: [{ id: 'building1' }],
    arrow: [{ id: 'arrow1' }],
    light: [{ id: 'light1' }],
    weather: [{ id: 'weather1' }]
  };

  const okResult = mapContextHelpers.validateContextIsolation(updatePack, 'm1');
  assert.strictEqual(okResult.valid, false, 'building in main world should be flagged');
  assert.ok(okResult.issues.some(issue => issue.includes('Building')), 'expected building issue');

  const mainResult = mapContextHelpers.validateContextIsolation(updatePack, null);
  assert.strictEqual(mainResult.valid, false, 'battleground entities should be flagged in main world');
  assert.ok(mainResult.issues.some(issue => issue.includes('Item')), 'expected item issue');
  assert.ok(mainResult.issues.some(issue => issue.includes('Arrow')), 'expected arrow issue');
  assert.ok(mainResult.issues.some(issue => issue.includes('Light')), 'expected light issue');
  assert.ok(mainResult.issues.some(issue => issue.includes('Weather')), 'expected weather issue');

  console.log('mapContextIsolation.test.js passed');
}

run();
