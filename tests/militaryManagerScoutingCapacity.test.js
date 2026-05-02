const assert = require('assert');

const MilitaryManager = require('../server/js/ai/MilitaryManager');

function withGlobals(overrides, fn) {
  const previous = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = global[key];
    global[key] = overrides[key];
  }

  try {
    fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) {
        delete global[key];
      } else {
        global[key] = previous[key];
      }
    }
  }
}

function createUnit(id) {
  return {
    id,
    name: `Soldier ${id}`,
    house: 'goths',
    military: true,
    hp: 100,
    x: 64,
    y: 64,
    z: 0
  };
}

function createManager(units) {
  const house = { id: 'goths', name: 'Goths', hq: [1, 1] };
  const ai = {
    house,
    logger: { collectAction() {} },
    getMilitaryUnits() {
      return units;
    }
  };
  house.ai = ai;
  return new MilitaryManager(house, ai);
}

function testCapacityScalesWithMilitarySize() {
  withGlobals({
    day: 1,
    House: { list: {} }
  }, () => {
    const units = [1, 2, 3, 4, 5, 6].map(createUnit);
    const manager = createManager(units);

    assert.strictEqual(manager.getMaxScoutingParties(), 2, 'expected six military units to support two scouting parties');
  });
}

function testBusyScoutUnitsAreNotReused() {
  withGlobals({
    day: 1,
    House: { list: {} }
  }, () => {
    const units = [1, 2, 3, 4, 5, 6].map(createUnit);
    const manager = createManager(units);

    const firstParty = manager.deployScoutingParty({ id: 'zone-a', center: [10, 10] }, 'wood');
    const firstPartyUnits = new Set([firstParty.leader, ...firstParty.backupUnits]);
    const secondParty = manager.deployScoutingParty({ id: 'zone-b', center: [20, 20] }, 'stone');

    assert.ok(firstParty, 'expected first party to deploy');
    assert.ok(secondParty, 'expected second party to deploy with remaining units');
    assert.ok(!firstPartyUnits.has(secondParty.leader), 'expected second party leader not to be reused');
    for (const unit of secondParty.backupUnits) {
      assert.ok(!firstPartyUnits.has(unit), 'expected second party backup not to be reused');
    }
    assert.strictEqual(manager.deployScoutingParty({ id: 'zone-c', center: [30, 30] }, 'grain'), null, 'expected third party to be capped');
  });
}

function run() {
  testCapacityScalesWithMilitarySize();
  testBusyScoutUnitsAreNotReused();
  console.log('militaryManagerScoutingCapacity.test.js passed');
}

run();
