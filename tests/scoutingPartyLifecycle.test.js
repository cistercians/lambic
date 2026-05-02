const assert = require('assert');

const ScoutingParty = require('../server/js/ai/ScoutingParty');

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

function createLeader(houseId) {
  return {
    id: 'leader-1',
    name: 'Goth',
    house: houseId,
    x: 64,
    y: 64,
    z: 0,
    hp: 100,
    mode: 'idle',
    action: null,
    moveTo(z, col, row) {
      this.pathEnd = { z, loc: [col, row] };
      this.path = [[1, 1], [col, row]];
    }
  };
}

function testOnHoldPartyStartsAtDawnWithHouseIdLeader() {
  const events = [];
  const scoutDeployments = { count: 0 };
  const house = {
    id: 'goths',
    name: 'Goths',
    hq: [1, 1],
    ai: {
      logger: {
        recordScoutingDeployment() {
          scoutDeployments.count++;
        }
      }
    }
  };

  withGlobals({
    day: 2,
    tempus: 'VI.a',
    gameState: { nightfall: false, tempus: 'VI.a' },
    House: { list: { goths: house } },
    getCenter(col, row) {
      return [col * 64 + 32, row * 64 + 32];
    },
    eventManager: {
      categories: { FACTION: 'Faction' },
      commModes: { NONE: 'none' },
      createEvent(event) {
        events.push(event);
      }
    }
  }, () => {
    const leader = createLeader('goths');
    const party = new ScoutingParty(leader, [], {
      id: 'forest-zone',
      name: 'South Forest',
      center: [10, 12]
    }, 'wood');

    party.assignMissionOrders();
    party.update();

    assert.strictEqual(party.status, 'traveling', 'expected dawn update to release party from on_hold');
    assert.deepStrictEqual(leader.moveIntent.target, [10, 12], 'expected scout move intent to target zone center');
    assert.deepStrictEqual(leader.scoutingMoveTarget.target, [10, 12], 'expected persistent scout movement target');
    assert.strictEqual(events[0].house, 'goths', 'expected event house to resolve from numeric/string leader.house ids');
    assert.strictEqual(events[0].houseName, 'Goths', 'expected event houseName to resolve from House.list');
    assert.strictEqual(scoutDeployments.count, 1, 'expected deployment to be recorded on the resolved house logger');
  });
}

function testTravelingPartyEmitsDestinationEvent() {
  const events = [];
  const house = { id: 'goths', name: 'Goths', hq: [1, 1], ai: { logger: {} } };

  withGlobals({
    day: 2,
    tempus: 'VII.a',
    gameState: { nightfall: false, tempus: 'VII.a' },
    House: { list: { goths: house } },
    getCenter(col, row) {
      return [col * 64 + 32, row * 64 + 32];
    },
    eventManager: {
      categories: { FACTION: 'Faction' },
      commModes: { NONE: 'none' },
      createEvent(event) {
        events.push(event);
      }
    }
  }, () => {
    const leader = createLeader('goths');
    leader.x = 10 * 64 + 32;
    leader.y = 12 * 64 + 32;
    const party = new ScoutingParty(leader, [], {
      id: 'forest-zone',
      name: 'South Forest',
      center: [10, 12]
    }, 'wood');

    party.status = 'traveling';
    party.update();

    assert.strictEqual(party.status, 'camping', 'expected party at destination to enter camping state');
    assert.ok(
      events.some(event => event.action === 'reached scouting destination' && event.house === 'goths'),
      'expected reached scouting destination event with resolved house id'
    );
  });
}

function testReturnSuccessNotifiesOnce() {
  const completions = { count: 0 };
  const house = {
    id: 'goths',
    name: 'Goths',
    hq: [1, 1],
    ai: {
      logger: {},
      knowledge: {
        markZoneAsKnown() {}
      },
      onScoutingComplete() {
        completions.count++;
      }
    }
  };

  withGlobals({
    day: 2,
    House: { list: { goths: house } }
  }, () => {
    const leader = createLeader('goths');
    const party = new ScoutingParty(leader, [], {
      id: 'forest-zone',
      name: 'South Forest',
      center: [10, 12]
    }, 'wood');

    party.notifyZoneClear();
    party.notifyReturnSuccess();
    party.notifyReturnSuccess();

    assert.strictEqual(completions.count, 1, 'expected scout completion to be reported once after return');
  });
}

function run() {
  testOnHoldPartyStartsAtDawnWithHouseIdLeader();
  testTravelingPartyEmitsDestinationEvent();
  testReturnSuccessNotifiesOnce();
  console.log('scoutingPartyLifecycle.test.js passed');
}

run();
