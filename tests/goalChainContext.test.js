const assert = require('assert');

const GoalChain = require('../server/js/ai/GoalChain');
const { BuildMineGoal, ScoutForResourceGoal } = require('../server/js/ai/Goals');

function testContextAwareDeduping() {
  const chain = new GoalChain(new BuildMineGoal());
  const steps = [
    new ScoutForResourceGoal('wood'),
    new ScoutForResourceGoal('stone'),
    new ScoutForResourceGoal('wood'),
    new BuildMineGoal(null, 'stone'),
    new BuildMineGoal(null, 'cave')
  ];

  const deduped = chain.removeDuplicates(steps);
  const scoutGoals = deduped.filter(step => step.type === 'SCOUT_FOR_RESOURCE');
  const mineGoals = deduped.filter(step => step.type === 'BUILD_MINE');

  assert.strictEqual(scoutGoals.length, 2, 'expected distinct scout goals to remain after dedupe');
  assert.strictEqual(mineGoals.length, 2, 'expected distinct mine variants to remain after dedupe');
  assert.ok(
    scoutGoals.some(step => step.resourceType === 'wood') &&
    scoutGoals.some(step => step.resourceType === 'stone'),
    'expected dedupe to preserve resource-specific scout identities'
  );
}

function testPermanentLocationBlockingDoesNotClearChain() {
  const chain = new GoalChain({ type: 'BUILD_GARRISON' });
  const step = {
    type: 'BUILD_GARRISON',
    getFailureHistoryKey() {
      return 'BUILD_GARRISON';
    }
  };

  chain.steps = [step];

  const house = {
    ai: {
      goalFailureHistory: new Map([
        ['BUILD_GARRISON', { locationBlockCount: 6, lastLocationBlockDay: 1 }]
      ])
    }
  };

  global.day = 1;
  GoalChain._validateChain(chain, house, null);

  assert.strictEqual(chain.steps.length, 1, 'expected chain steps to remain intact under permanent location saturation');
  assert.ok(Array.isArray(chain.errors) && chain.errors.length > 0, 'expected warning to be recorded on the chain');
}

function run() {
  testContextAwareDeduping();
  testPermanentLocationBlockingDoesNotClearChain();
  console.log('goalChainContext.test.js passed');
}

run();
