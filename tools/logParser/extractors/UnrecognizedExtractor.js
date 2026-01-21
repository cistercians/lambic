const BaseExtractor = require('./BaseExtractor');

class UnrecognizedExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('unrecognized', config);
    this.stats = this.initializeStats();
  }

  initializeStats() {
    return {
      totalUnrecognized: 0,
      byPrefix: {}
    };
  }

  extract(line, context) {
    if (!line || !line.trim()) return false;

    this.stats.totalUnrecognized += 1;
    const prefix = this._extractPrefix(line);
    this._increment(this.stats.byPrefix, prefix);

    this.addSample({
      type: 'unrecognized',
      prefix,
      line,
      lineNumber: context.lineNumber,
      day: context.currentDay || null,
      hour: context.currentHour || null
    });

    return true;
  }

  _extractPrefix(line) {
    const bracketMatch = line.match(/^\[([^\]]+)\]/);
    if (bracketMatch) {
      return bracketMatch[1].split(':')[0];
    }
    const token = line.trim().split(/\s+/)[0];
    return token || 'unknown';
  }

  _increment(map, key, amount = 1) {
    if (!key) return;
    map[key] = (map[key] || 0) + amount;
  }
}

module.exports = UnrecognizedExtractor;
