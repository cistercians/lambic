const BaseExtractor = require('./BaseExtractor');

class MiscGameplayExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('miscGameplay', config);
    this.stats = this.initializeStats();
  }

  initializeStats() {
    return {
      totalEvents: 0,
      socialEvents: 0,
      respawns: 0,
      minibossEvents: 0,
      dailyRecaps: 0,
      byType: {}
    };
  }

  extract(line, context) {
    // SOCIAL events
    if (line.includes('[SOCIAL]')) {
      this.stats.totalEvents += 1;
      this.stats.socialEvents += 1;
      this._increment(this.stats.byType, 'social');

      this.addEvent({
        type: 'social',
        message: line,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // RESPAWN events
    if (line.includes('[RESPAWN]')) {
      this.stats.totalEvents += 1;
      this.stats.respawns += 1;
      this._increment(this.stats.byType, 'respawn');

      // Try to extract respawn details
      const respawnMatch = line.match(/\[RESPAWN\]\s+(.+)$/);
      this.addEvent({
        type: 'respawn',
        message: respawnMatch ? respawnMatch[1] : line,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // MINIBOSS events
    if (line.includes('[MINIBOSS]')) {
      this.stats.totalEvents += 1;
      this.stats.minibossEvents += 1;
      this._increment(this.stats.byType, 'miniboss');

      const minibossMatch = line.match(/\[MINIBOSS\]\s+(.+)$/);
      this.addEvent({
        type: 'miniboss',
        message: minibossMatch ? minibossMatch[1] : line,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // DAILY RECAP
    if (line.includes('[DAILY RECAP]')) {
      this.stats.totalEvents += 1;
      this.stats.dailyRecaps += 1;
      this._increment(this.stats.byType, 'daily_recap');

      const recapMatch = line.match(/\[DAILY RECAP\]\s+(.+)$/);
      this.addEvent({
        type: 'daily_recap',
        message: recapMatch ? recapMatch[1] : line,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    return false;
  }

  _increment(map, key, amount = 1) {
    if (!key) return;
    map[key] = (map[key] || 0) + amount;
  }
}

module.exports = MiscGameplayExtractor;
