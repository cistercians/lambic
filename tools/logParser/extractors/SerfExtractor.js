const BaseExtractor = require('./BaseExtractor');

class SerfExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('serf', config);
    this.stats = this.initializeStats();
  }

  initializeStats() {
    return {
      workEvents: 0,
      warnings: 0,
      workByFaction: {},
      workByBuilding: {},
      warningByMessage: {}
    };
  }

  extract(line, context) {
    if (line.includes('[SERF WORK]')) {
      this.stats.workEvents += 1;
      const workMatch = line.match(/^\[SERF WORK\]\s+([^:]+):\s+(.*)$/);
      if (workMatch) {
        const faction = workMatch[1].trim();
        const message = workMatch[2];
        this._increment(this.stats.workByFaction, faction);
        const buildingType = this._extractBuildingType(message);
        if (buildingType) {
          this._increment(this.stats.workByBuilding, buildingType);
        }

        this.addEvent({
          type: 'serf_work',
          faction,
          buildingType,
          message,
          day: context.currentDay || null,
          hour: context.currentHour || null,
          lineNumber: context.lineNumber
        });
      }
      return;
    }

    if (line.includes('[SerfLogger:WARN]')) {
      this.stats.warnings += 1;
      const message = line.split('] ').slice(1).join(']').trim();
      this._increment(this.stats.warningByMessage, message);
      this.addError({
        severity: 'WARN',
        category: 'SerfLogger',
        message,
        lineNumber: context.lineNumber,
        day: context.currentDay || null,
        hour: context.currentHour || null
      });
    }
  }

  _extractBuildingType(message) {
    const lower = message.toLowerCase();
    if (lower.includes('lumbermill')) return 'lumbermill';
    if (lower.includes('mine')) return 'mine';
    if (lower.includes('farm')) return 'farm';
    if (lower.includes('mill')) return 'mill';
    if (lower.includes('smith')) return 'smith';
    return null;
  }

  _increment(map, key, amount = 1) {
    if (!key) return;
    map[key] = (map[key] || 0) + amount;
  }
}

module.exports = SerfExtractor;
