const BaseExtractor = require('./BaseExtractor');

class TempusExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('tempus', config);
    this.stats = this.initializeStats();
  }

  initializeStats() {
    return {
      totalTimeChanges: 0,
      dayChanges: 0,
      hourChanges: 0,
      lastDay: null,
      lastHour: null
    };
  }

  extract(line, context) {
    if (!line.includes('[TEMPUS]')) return false;

    const tempusMatch = line.match(/^\[TEMPUS\]\s+Day\s+(\d+),\s+Hour:\s+([A-Za-z0-9.]+)/);
    if (tempusMatch) {
      const day = Number(tempusMatch[1]);
      const hour = tempusMatch[2];

      this.stats.totalTimeChanges += 1;

      if (this.stats.lastDay !== day) {
        this.stats.dayChanges += 1;
        this.stats.lastDay = day;
      }

      if (this.stats.lastHour !== hour) {
        this.stats.hourChanges += 1;
        this.stats.lastHour = hour;
      }

      // Don't add events for every time change to avoid cluttering,
      // but we track stats and claim the line
      return true;
    }

    // If we get here, it's a [TEMPUS] line but we don't recognize the pattern
    // Return true to claim it
    return true;
  }
}

module.exports = TempusExtractor;
