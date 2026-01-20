const BaseExtractor = require('./BaseExtractor');

class ErrorExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('errors', config);
    this.stats = this.initializeStats();
    this.warningCounts = {};
  }

  initializeStats() {
    return {
      totalErrors: 0,
      totalWarnings: 0,
      byCategory: {},
      byMessage: {}
    };
  }

  extract(line, context) {
    const severity = this._detectSeverity(line);
    if (!severity) return;

    const { category, message } = this._parseCategoryAndMessage(line);
    const key = message || line;

    if (severity === 'ERROR') {
      this.stats.totalErrors += 1;
    } else {
      this.stats.totalWarnings += 1;
    }

    this._increment(this.stats.byCategory, category);
    this._increment(this.stats.byMessage, key);

    this.addError({
      severity,
      category,
      message,
      lineNumber: context.lineNumber,
      day: context.currentDay || null,
      hour: context.currentHour || null
    });

    if (message) {
      const warningKey = `${severity}:${message}`;
      this.warningCounts[warningKey] = (this.warningCounts[warningKey] || 0) + 1;
      if (this.warningCounts[warningKey] === 10) {
        this.addAnomaly({
          type: 'repeat_warning',
          summary: message,
          count: this.warningCounts[warningKey]
        });
      }
    }
  }

  _detectSeverity(line) {
    if (line.includes('[SerfLogger:WARN]') || line.includes('[WARN]')) return 'WARN';
    if (line.includes('[ERROR]') || line.includes('ERROR')) return 'ERROR';
    if (line.includes('Exception') || line.includes('exception')) return 'ERROR';
    if (line.includes('Error') && line.includes(']')) return 'ERROR';
    return null;
  }

  _parseCategoryAndMessage(line) {
    const bracketMatch = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (!bracketMatch) {
      return { category: 'unknown', message: line.trim() };
    }

    const rawCategory = bracketMatch[1];
    const message = bracketMatch[2].trim();
    const category = rawCategory.split(':')[0];
    return { category, message };
  }

  _increment(map, key, amount = 1) {
    if (!key) return;
    map[key] = (map[key] || 0) + amount;
  }
}

module.exports = ErrorExtractor;
