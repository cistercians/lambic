const assert = require('assert');
const mapContextHelpers = require('../server/js/core/MapContextHelpers');

function run() {
  const mainWorldEntity = { id: 'p1', inBattleground: false, battlegroundMatchId: null };
  const bgEntity = { id: 'p2', inBattleground: true, battlegroundMatchId: 'm1' };
  const bgEntitySameMatch = { id: 'p3', inBattleground: true, battlegroundMatchId: 'm1' };
  const bgEntityOtherMatch = { id: 'p4', inBattleground: true, battlegroundMatchId: 'm2' };

  assert.strictEqual(
    mapContextHelpers.areInSameContext(mainWorldEntity, bgEntity),
    false,
    'main world vs battleground should be different contexts'
  );
  assert.strictEqual(
    mapContextHelpers.areInSameContext(bgEntity, bgEntitySameMatch),
    true,
    'entities in same match should share context'
  );
  assert.strictEqual(
    mapContextHelpers.areInSameContext(bgEntity, bgEntityOtherMatch),
    false,
    'entities in different matches should be different contexts'
  );

  const mixedEntities = [mainWorldEntity, bgEntity, bgEntitySameMatch, bgEntityOtherMatch];
  const filtered = mapContextHelpers.filterEntitiesByContext(mixedEntities, bgEntity);
  assert.deepStrictEqual(
    filtered.map(e => e.id).sort(),
    ['p2', 'p3'].sort(),
    'filterEntitiesByContext should keep only same-context entities'
  );

  console.log('mapContextHelpers.test.js passed');
}

run();
