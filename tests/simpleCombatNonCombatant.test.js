const assert = require('assert');
const SimpleCombat = require('../server/js/core/SimpleCombat');

function resetGlobals() {
  global.Player = { list: {} };
  global.getLoc = (x, y) => [Math.floor(x / 64), Math.floor(y / 64)];
  global.isAlly = () => false;
}

function run() {
  resetGlobals();

  const combat = new SimpleCombat();
  const innkeeper = {
    id: 'npc-innkeeper',
    type: 'npc',
    class: 'Innkeeper',
    isNonCombatant: true,
    x: 0,
    y: 0,
    z: 0,
    hp: 100,
    hpMax: 100,
    action: null,
    combat: {}
  };

  const target = {
    id: 'npc-target',
    type: 'npc',
    class: 'Footsoldier',
    x: 64,
    y: 0,
    z: 0,
    hp: 100,
    hpMax: 100,
    combat: {}
  };

  global.Player.list[innkeeper.id] = innkeeper;
  global.Player.list[target.id] = target;

  assert.strictEqual(combat.shouldSkipAggroCheck(innkeeper), true, 'expected non-combatant NPCs to skip aggro checks');
  assert.strictEqual(combat.canAggroTarget(innkeeper, target, 512, false), false, 'expected non-combatant NPCs to never aggro targets');

  combat.checkAggro(innkeeper);

  assert.strictEqual(innkeeper.action, null, 'expected innkeeper to stay out of combat after aggro scan');
  assert.ok(!innkeeper.combatState || !innkeeper.combatState.target, 'expected innkeeper to have no combat target');

  console.log('simpleCombatNonCombatant.test.js passed');
}

run();
