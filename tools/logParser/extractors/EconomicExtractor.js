const BaseExtractor = require('./BaseExtractor');

class EconomicExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('economy', config);
    this.stats = this.initializeStats();
  }

  initializeStats() {
    return {
      totalDeposits: 0,
      depositsByFaction: {},
      depositsByResource: {},
      amountByFactionResource: {},
      // Serf spawn tracking
      spawnTallies: 0,
      spawnDecisions: 0,
      spawnAttempts: 0,
      spawnsSuccessful: 0,
      spawnsFailed: 0,
      // Resource gathering
      resourceGathers: 0,
      gathersByResource: {},
      gathersByActor: {}
    };
  }

  extract(line, context) {
    if (!line.includes('[ECONOMIC]')) return false;

    // Handle deposits (existing functionality)
    const depositMatch = line.match(/^\[ECONOMIC\]\s+.+? deposited ([\d.]+) ([a-zA-Z_]+) to ([A-Za-z0-9_ ]+)/);
    if (depositMatch) {
      const amount = Number(depositMatch[1]);
      const resource = depositMatch[2];
      const faction = depositMatch[3].trim();

      this.stats.totalDeposits += 1;
      this._increment(this.stats.depositsByFaction, faction);
      this._increment(this.stats.depositsByResource, resource);
      this._incrementNested(this.stats.amountByFactionResource, faction, resource, amount);

      this.addEvent({
        type: 'deposit',
        amount,
        resource,
        faction,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // Handle serf spawn tallies
    const tallyMatch = line.match(/^\[ECONOMIC\]\s+(\w+)#([\d.]+)\s+tally:\s+(\d+)\s+serfs?,\s+(\d+)\s+work\s+spots?/);
    if (tallyMatch) {
      const buildingType = tallyMatch[1];
      const buildingId = tallyMatch[2];
      const serfs = Number(tallyMatch[3]);
      const workSpots = Number(tallyMatch[4]);

      this.stats.spawnTallies += 1;

      this.addEvent({
        type: 'spawn_tally',
        buildingType,
        buildingId,
        serfs,
        workSpots,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // Handle spawn decisions
    const decisionMatch = line.match(/^\[ECONOMIC\]\s+(\w+)#([\d.]+)\s+decision:\s+(\w+(?:_\w+)*)(?:\s+\(([^)]+)\))?/);
    if (decisionMatch) {
      const buildingType = decisionMatch[1];
      const buildingId = decisionMatch[2];
      const decision = decisionMatch[3];
      const reason = decisionMatch[4] || null;

      this.stats.spawnDecisions += 1;

      this.addEvent({
        type: 'spawn_decision',
        buildingType,
        buildingId,
        decision,
        reason,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // Handle spawn attempts
    const attemptMatch = line.match(/^\[ECONOMIC\]\s+(\w+)#([\d.]+)\s+attempting\s+to\s+spawn\s+(\d+)\s+serf\(s\)\s+via\s+(\w+)/);
    if (attemptMatch) {
      const buildingType = attemptMatch[1];
      const buildingId = attemptMatch[2];
      const count = Number(attemptMatch[3]);
      const method = attemptMatch[4];

      this.stats.spawnAttempts += 1;

      this.addEvent({
        type: 'spawn_attempt',
        buildingType,
        buildingId,
        count,
        method,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // Handle successful spawns
    const spawnMatch = line.match(/^\[ECONOMIC\]\s+(\w+)#([\d.]+)\s+spawned\s+(\d+)\s+serf\(s\)/);
    if (spawnMatch) {
      const buildingType = spawnMatch[1];
      const buildingId = spawnMatch[2];
      const count = Number(spawnMatch[3]);

      this.stats.spawnsSuccessful += 1;

      this.addEvent({
        type: 'spawn_success',
        buildingType,
        buildingId,
        count,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // Handle resource gathering
    const gatherMatch = line.match(/^\[ECONOMIC\]\s+(\w+)\s+gathered\s+(\d+)\s+(\w+)/);
    if (gatherMatch) {
      const actor = gatherMatch[1];
      const amount = Number(gatherMatch[2]);
      const resource = gatherMatch[3];

      this.stats.resourceGathers += 1;
      this._increment(this.stats.gathersByResource, resource, amount);
      this._increment(this.stats.gathersByActor, actor, amount);

      this.addEvent({
        type: 'resource_gather',
        actor,
        amount,
        resource,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // If we get here, it's an [ECONOMIC] line but we don't recognize the pattern
    // Return true to claim it (prevents it from being unrecognized) but don't add stats
    return true;
  }

  _increment(map, key, amount = 1) {
    map[key] = (map[key] || 0) + amount;
  }

  _incrementNested(map, keyA, keyB, amount) {
    if (!map[keyA]) map[keyA] = {};
    map[keyA][keyB] = (map[keyA][keyB] || 0) + amount;
  }
}

module.exports = EconomicExtractor;
