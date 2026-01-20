const BaseExtractor = require('./BaseExtractor');

class CombatExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('combat', config);
    this.stats = this.initializeStats();
  }

  initializeStats() {
    return {
      totalAttacks: 0,
      totalDeaths: 0,
      totalDamage: 0,
      attacksByActor: {},
      deathsByKiller: {}
    };
  }

  extract(line, context) {
    if (!line.includes('[COMBAT]') && !line.includes('[DEATH]') && !line.includes('[COMBAT RECORDER]')) {
      return;
    }

    const attackMatch = line.match(/^\[COMBAT\]\s+(.+?) attacked (.+?) for ([\d.]+) damage at \[(\d+),(\d+)\] z=([-\d]+)/);
    if (attackMatch) {
      const attacker = attackMatch[1];
      const target = attackMatch[2];
      const damage = Number(attackMatch[3]);
      const x = Number(attackMatch[4]);
      const y = Number(attackMatch[5]);
      const z = Number(attackMatch[6]);

      this.stats.totalAttacks += 1;
      this.stats.totalDamage += damage;
      this._increment(this.stats.attacksByActor, attacker);

      this.addEvent({
        type: 'attack',
        attacker,
        target,
        damage,
        position: { x, y, z },
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return;
    }

    const deathMatch = line.match(/^\[DEATH\]\s+(.+?) killed by (.+?) at \[(\d+),(\d+)\] z=([-\d]+)/);
    if (deathMatch) {
      const victim = deathMatch[1];
      const killer = deathMatch[2];
      const x = Number(deathMatch[3]);
      const y = Number(deathMatch[4]);
      const z = Number(deathMatch[5]);

      this.stats.totalDeaths += 1;
      this._increment(this.stats.deathsByKiller, killer);

      this.addEvent({
        type: 'death',
        victim,
        killer,
        position: { x, y, z },
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return;
    }

    const recorderMatch = line.match(/^\[COMBAT RECORDER\]\s+([^:]+):\s+(.*)$/);
    if (recorderMatch) {
      const faction = recorderMatch[1].trim();
      const message = recorderMatch[2];
      this.addSample({
        type: 'combat_recorder',
        faction,
        message,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
    }
  }

  _increment(map, key, amount = 1) {
    map[key] = (map[key] || 0) + amount;
  }
}

module.exports = CombatExtractor;
