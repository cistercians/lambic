const BaseExtractor = require('./BaseExtractor');

class EnvironmentExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('environment', config);
    this.stats = this.initializeStats();
  }

  initializeStats() {
    return {
      totalEvents: 0,
      nightfalls: 0,
      dawns: 0,
      byType: {}
    };
  }

  extract(line, context) {
    if (!line.includes('[ENVIRONMENT]')) return false;

    const envMatch = line.match(/^\[ENVIRONMENT\]\s+(.+)$/);
    if (envMatch) {
      const eventType = envMatch[1].trim();

      this.stats.totalEvents += 1;
      this._increment(this.stats.byType, eventType);

      if (eventType.toLowerCase() === 'nightfall') {
        this.stats.nightfalls += 1;
      } else if (eventType.toLowerCase() === 'dawn') {
        this.stats.dawns += 1;
      }

      this.addEvent({
        type: 'environment',
        eventType,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // Claim any [ENVIRONMENT] line even if pattern doesn't match
    return true;
  }

  _increment(map, key, amount = 1) {
    if (!key) return;
    map[key] = (map[key] || 0) + amount;
  }
}

module.exports = EnvironmentExtractor;
