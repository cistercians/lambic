const assert = require('assert');
const SimpleCombat = require('../server/js/core/SimpleCombat');

function resetGlobals() {
  global.Player = { list: {} };
  global.getLoc = (x, y) => [Math.floor(x / 64), Math.floor(y / 64)];
}

function run() {
  resetGlobals();

  const combat = new SimpleCombat();

  const attacker = {
    id: 'npc1',
    type: 'npc',
    class: 'Footsoldier',
    x: 0,
    y: 0,
    z: 0,
    hp: 10,
    hpMax: 100,
    action: 'combat',
    combat: {},
    home: { z: 0, loc: [0, 0] }
  };

  const target = {
    id: 'npc2',
    type: 'npc',
    class: 'Footsoldier',
    x: 128,
    y: 0,
    z: 0,
    hp: 100,
    hpMax: 100,
    combat: {}
  };

  global.Player.list[attacker.id] = attacker;
  global.Player.list[target.id] = target;

  const initialized = combat.initCombatState(attacker, target.id);
  assert.strictEqual(initialized, true, 'expected combat state to initialize');

  combat.update(attacker);

  assert.strictEqual(attacker.action, 'flee', 'expected low HP to trigger flee');
  assert.strictEqual(attacker.combatState.target, target.id, 'expected combat target to be retained during flee');

  console.log('simpleCombatEscape.test.js passed');
}

run();
