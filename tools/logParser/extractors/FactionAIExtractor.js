const BaseExtractor = require('./BaseExtractor');

class FactionAIExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('factionAI', config);
    this.stats = this.initializeStats();
  }

  initializeStats() {
    return {
      totalEvents: 0,
      byComponent: {},
      chainErrors: 0,
      decisions: 0
    };
  }

  extract(line, context) {
    if (!line.includes('[FactionAI]') &&
        !line.includes('[GoalExecutor]') &&
        !line.includes('[COMBAT RECORDER]') &&
        !line.includes('Goal chain') &&
        !line.includes('Chain creation errors')) {
      return;
    }

    this.stats.totalEvents += 1;

    const componentMatch = line.match(/^\[([^\]]+)\]/);
    const component = componentMatch ? componentMatch[1] : 'unknown';
    this._increment(this.stats.byComponent, component);

    if (line.includes('Chain creation errors') || line.includes('Goal chain')) {
      this.stats.chainErrors += 1;
    }

    if (line.includes('[DECISION]') || line.includes('Decision')) {
      this.stats.decisions += 1;
    }

    this.addEvent({
      type: 'faction_ai',
      component,
      message: line,
      day: context.currentDay || null,
      hour: context.currentHour || null,
      lineNumber: context.lineNumber
    });
  }

  _increment(map, key, amount = 1) {
    if (!key) return;
    map[key] = (map[key] || 0) + amount;
  }
}

module.exports = FactionAIExtractor;
