const assert = require('assert');

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

function ensureEntityConstructors() {
  const entityModule = require('../server/js/Entity');
  global.Building = entityModule.Building;
}

function createUnitConstructor(unitClass) {
  return (params) => {
    const id = `${unitClass}-${Object.keys(global.Player.list).length + 1}`;
    const unit = {
      ...params,
      id,
      class: unitClass,
      name: unitClass,
      military: true
    };
    global.Player.list[id] = unit;
    return unit;
  };
}

function createGarrison(house) {
  const plot = [];
  plot[0] = [10, 10];
  plot[7] = [11, 10];

  return global.Garrison({
    id: 'garrison-1',
    x: 10 * 64,
    y: 10 * 64,
    z: 0,
    type: 'garrison',
    built: true,
    owner: house.id,
    house: house.id,
    kingdom: house.kingdom,
    plot
  });
}

function runGarrisonUpdate(stores) {
  const house = {
    id: 6,
    name: 'Teutons',
    kingdom: 'Teutons',
    stores
  };
  const recruitmentEvents = [];
  let units = [];

  withGlobals({
    Player: { list: {} },
    House: { list: { 6: house } },
    initPack: { building: [] },
    tileSize: 64,
    mapSize: 200,
    getCenter: (col, row) => [col * 64 + 32, row * 64 + 32],
    isWalkable: () => true,
    TeutonPike: createUnitConstructor('TeutonPike'),
    TeutonBow: createUnitConstructor('TeutonBow'),
    eventManager: {
      militaryUnitRecruited(unitClass, houseName, houseId, position) {
        recruitmentEvents.push({ unitClass, houseName, houseId, position });
      }
    }
  }, () => {
    ensureEntityConstructors();
    global.Building.list = {};
    global.TeutonPike = createUnitConstructor('TeutonPike');
    global.TeutonBow = createUnitConstructor('TeutonBow');

    const garrison = createGarrison(house);
    garrison.productionTimer = 17999;
    garrison.update();
    units = Object.values(global.Player.list);
  });

  return {
    units,
    recruitmentEvents
  };
}

function testStockedGarrisonProducesMilitaryUnit() {
  const result = runGarrisonUpdate({ grain: 20, fish: 0 });

  assert.strictEqual(result.units.length, 1, 'expected stocked garrison to produce one military unit');
  assert.strictEqual(result.units[0].house, 6, 'expected produced unit to belong to the garrison house');
  assert.strictEqual(result.units[0].mode, 'patrol', 'expected produced unit to start on patrol');
  assert.strictEqual(result.recruitmentEvents.length, 1, 'expected recruitment event to be emitted');
}

function testStarvingGarrisonDoesNotProduceMilitaryUnit() {
  const result = runGarrisonUpdate({ grain: 0, fish: 0 });

  assert.strictEqual(result.units.length, 0, 'expected starving garrison not to produce a unit');
  assert.strictEqual(result.recruitmentEvents.length, 0, 'expected failed production not to emit recruitment event');
}

function run() {
  testStockedGarrisonProducesMilitaryUnit();
  testStarvingGarrisonDoesNotProduceMilitaryUnit();
  console.log('garrisonProduction.test.js passed');
}

run();
