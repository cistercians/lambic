const assert = require('assert');

const SimpleSerfBehavior = require('../server/js/core/SimpleSerfBehavior');

function resetGlobals() {
  global.Building = { list: {} };
  global.serfLogger = null;
}

function testReturningPrefersDeposit() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  behavior.hasResourcesToDeposit = () => true;

  let returnedHome = false;
  const serf = {
    id: 'serf-1',
    action: 'returning',
    mode: 'work',
    work: {},
    return() {
      returnedHome = true;
    }
  };

  behavior.handleReturning(serf);

  assert.strictEqual(serf.action, 'deposit', 'expected returning serf with resources to switch to deposit');
  assert.strictEqual(returnedHome, false, 'expected deposit path to short-circuit return-home behavior');
}

function testReturningDelegatesToEntityReturn() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();
  behavior.hasResourcesToDeposit = () => false;

  let returnedHome = false;
  const serf = {
    id: 'serf-2',
    action: 'returning',
    mode: 'work',
    work: {},
    return() {
      returnedHome = true;
    }
  };

  behavior.handleReturning(serf);

  assert.strictEqual(returnedHome, true, 'expected handleReturning to delegate to entity.return()');
  assert.strictEqual(serf.action, 'returning', 'expected returning state to remain active while returning home');
}

function testTaskTargetZUsesWorkBuilding() {
  resetGlobals();
  const behavior = new SimpleSerfBehavior();

  global.Building.list.mine1 = {
    id: 'mine1',
    type: 'mine',
    cave: true
  };

  const serf = {
    work: {
      hq: 'mine1'
    }
  };

  assert.strictEqual(behavior.getTaskTargetZ(serf), -1, 'expected cave work tasks to target cave z-level');
}

function run() {
  testReturningPrefersDeposit();
  testReturningDelegatesToEntityReturn();
  testTaskTargetZUsesWorkBuilding();
  console.log('simpleSerfBehaviorReturning.test.js passed');
}

run();
