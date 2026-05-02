const assert = require('assert');
const SimpleCombat = require('../server/js/core/SimpleCombat');

const tileSize = 64;

function resetGlobals() {
  global.Player = { list: {} };
  global.getLoc = (x, y) => [Math.floor(x / tileSize), Math.floor(y / tileSize)];
  global.isWalkable = () => true;
}

function center(col, row) {
  return {
    x: col * tileSize + tileSize / 2,
    y: row * tileSize + tileSize / 2
  };
}

function calcEntityDirection(loc, targetLoc) {
  let c = targetLoc[0] - loc[0];
  let r = targetLoc[1] - loc[1];
  if (c === 0 && r === 0) return 'c';
  if (c >= 0 && r >= 0) {
    if (c >= r) return r > 0 ? 'rd' : 'r';
    return c > 0 ? 'dr' : 'd';
  }
  if (c >= 0 && r < 0) {
    r *= -1;
    if (c >= r) return r > 0 ? 'ru' : 'r';
    return c > 0 ? 'ur' : 'u';
  }
  if (c < 0 && r < 0) {
    return c <= r ? 'lu' : 'ul';
  }
  if (c < 0 && r >= 0) {
    c *= -1;
    if (c >= r) return r > 0 ? 'ld' : 'l';
    return c > 0 ? 'dl' : 'd';
  }
  return 'c';
}

function moveOneTileLikeEntity(entity, targetLoc) {
  const loc = global.getLoc(entity.x, entity.y);
  const dir = calcEntityDirection(loc, targetLoc);
  const next = loc.slice();
  const firstAxis = dir[0];
  if (firstAxis === 'r') next[0]++;
  if (firstAxis === 'l') next[0]--;
  if (firstAxis === 'd') next[1]++;
  if (firstAxis === 'u') next[1]--;

  const pos = center(next[0], next[1]);
  entity.x = pos.x;
  entity.y = pos.y;
  entity.moveHistory.push(next.join(','));
}

function makeNpc(id, col, row) {
  const pos = center(col, row);
  return {
    id,
    type: 'npc',
    class: 'Footsoldier',
    x: pos.x,
    y: pos.y,
    z: 0,
    hp: 100,
    hpMax: 100,
    action: 'combat',
    combat: {},
    military: true,
    moveHistory: [`${col},${row}`],
    moveTo(z, targetCol, targetRow) {
      this.path = null;
      moveOneTileLikeEntity(this, [targetCol, targetRow]);
    }
  };
}

function run() {
  resetGlobals();

  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  global.setTimeout = () => ({ mocked: true });
  global.clearTimeout = () => {};

  try {
    const combat = new SimpleCombat();
    const attacker = makeNpc('npc-attacker', 10, 10);
    const target = makeNpc('npc-target', 11, 12);

    global.Player.list[attacker.id] = attacker;
    global.Player.list[target.id] = target;

    combat.initCombatState(attacker, target.id);
    combat.handleChase(attacker, target);

    const attackerLoc = global.getLoc(attacker.x, attacker.y);
    assert.strictEqual(
      attackerLoc[1],
      11,
      'expected offset vertical melee chase to close row distance before sidestepping'
    );

    attacker.x = center(10, 10).x;
    attacker.y = center(10, 10).y;
    attacker.moveHistory = ['10,10', '11,10', '10,10', '11,10'];
    attacker.combatState._combatChase = {
      targetId: target.id,
      history: attacker.moveHistory.slice(),
      axisBias: null,
      biasUses: 0
    };

    combat.handleChase(attacker, target);
    const recoveryLoc = global.getLoc(attacker.x, attacker.y);
    assert.strictEqual(
      recoveryLoc[1],
      11,
      'expected ABAB combat chase recovery to try the alternate movement axis'
    );
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }

  console.log('simpleCombatMeleeOscillation.test.js passed');
}

run();
