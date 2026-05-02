const assert = require('assert');

const FactionAI = require('../server/js/ai/FactionAI');

function createAI() {
  return {
    house: { id: 'goths', name: 'Goths' },
    _pendingOutpostGoals: [],
    _outpostPlanKeys: new Set(),
    logger: { collectAction() {}, collectInfo() {} },
    getScoutResourceBuildingGoals: FactionAI.prototype.getScoutResourceBuildingGoals,
    getScoutGatherGoal: FactionAI.prototype.getScoutGatherGoal,
    enqueueOutpostFollowup: FactionAI.prototype.enqueueOutpostFollowup
  };
}

function testWoodScoutQueuesTowerThenLumbermillOnce() {
  const ai = createAI();
  const zone = { id: 'forest-zone', center: [32, 40] };

  assert.strictEqual(ai.enqueueOutpostFollowup(zone, 'wood'), true);
  assert.strictEqual(ai.enqueueOutpostFollowup(zone, 'wood'), false);
  assert.deepStrictEqual(
    ai._pendingOutpostGoals.map(goal => goal.type),
    ['BUILD_GUARDTOWER', 'BUILD_LUMBERMILL', 'GATHER_RESOURCE'],
    'expected wood scout follow-up to build defense before resource extraction and gathering'
  );
}

function testGrainScoutQueuesMillAndFarm() {
  const ai = createAI();

  ai.enqueueOutpostFollowup({ id: 'grain-zone', center: [12, 14] }, 'grain');

  assert.deepStrictEqual(
    ai._pendingOutpostGoals.map(goal => goal.type),
    ['BUILD_GUARDTOWER', 'BUILD_MILL', 'BUILD_FARM', 'GATHER_RESOURCE'],
    'expected grain scout follow-up to include mill, farm, and gathering after guard tower'
  );
}

function run() {
  testWoodScoutQueuesTowerThenLumbermillOnce();
  testGrainScoutQueuesMillAndFarm();
  console.log('scoutOutpostFollowup.test.js passed');
}

run();
