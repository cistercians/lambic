const assert = require('assert');

function makeStores() {
  return {
    grain: 0,
    wood: 0,
    stone: 0,
    ironore: 0,
    iron: 0,
    silverore: 0,
    silver: 0,
    goldore: 0,
    gold: 0,
    diamond: 0,
    fish: 0
  };
}

function loadConvertHouse() {
  const housesPath = require.resolve('../server/js/Houses');
  delete require.cache[housesPath];
  require(housesPath);
  return global.convertHouse;
}

function run() {
  global.Player = { list: {} };
  global.Building = { list: {} };
  global.House = function House() {};
  global.House.list = {};
  global.eventManager = null;

  const convertHouse = loadConvertHouse();

  const founder = {
    id: 'player-1',
    type: 'player',
    name: 'Founder',
    house: 'house-1',
    stores: makeStores(),
    x: 0,
    y: 0,
    z: 0
  };

  global.Player.list[founder.id] = founder;
  global.House.list[founder.house] = {
    id: founder.house,
    name: 'Founders',
    stores: makeStores(),
    military: { patrol: [] }
  };

  global.Building.list.tavern1 = {
    id: 'tavern1',
    owner: founder.id,
    house: null,
    type: 'tavern',
    built: true,
    patrol: true,
    plot: [[10, 10], [11, 10], [10, 11]],
    serfs: {},
    innkeeper: 'innkeeper-linked'
  };

  global.Player.list['innkeeper-linked'] = {
    id: 'innkeeper-linked',
    type: 'npc',
    class: 'Innkeeper',
    isNonCombatant: true,
    house: null,
    tavern: 'tavern1',
    home: { z: 1, loc: [10, 10] }
  };

  global.Player.list['innkeeper-legacy'] = {
    id: 'innkeeper-legacy',
    type: 'npc',
    class: 'Innkeeper',
    isNonCombatant: true,
    house: null,
    home: { z: 1, loc: [11, 10] }
  };

  global.Player.list['linked-serf'] = {
    id: 'linked-serf',
    type: 'npc',
    class: 'SerfM',
    house: null,
    work: { hq: 'tavern1' }
  };

  convertHouse(founder.id);

  assert.strictEqual(global.Building.list.tavern1.house, founder.house, 'expected player-owned tavern to convert to founder house');
  assert.strictEqual(global.Player.list['innkeeper-linked'].house, founder.house, 'expected linked innkeeper to convert to founder house');
  assert.strictEqual(global.Player.list['innkeeper-legacy'].house, founder.house, 'expected legacy innkeeper home linkage to convert to founder house');
  assert.strictEqual(global.Player.list['linked-serf'].house, founder.house, 'expected linked serf conversion to still work');
  assert.deepStrictEqual(global.House.list[founder.house].military.patrol, ['tavern1'], 'expected built patrol tavern to be tracked for the house');

  console.log('innkeeperFactionConversion.test.js passed');
}

run();
