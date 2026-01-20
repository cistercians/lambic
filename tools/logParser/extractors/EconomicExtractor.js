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
      amountByFactionResource: {}
    };
  }

  extract(line, context) {
    if (!line.includes('[ECONOMIC]')) return;

    const depositMatch = line.match(/^\[ECONOMIC\]\s+.+? deposited ([\d.]+) ([a-zA-Z_]+) to ([A-Za-z0-9_ ]+)/);
    if (!depositMatch) return;

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
