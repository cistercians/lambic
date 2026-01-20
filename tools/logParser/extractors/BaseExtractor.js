class BaseExtractor {
  constructor(name, config = {}) {
    this.name = name;
    this.enabled = config.enabled !== false;
    this.config = config;
    this.reset();
  }

  reset() {
    if (typeof this.initializeStats === 'function') {
      this.stats = this.initializeStats();
    } else {
      this.stats = {};
    }
    this.events = [];
    this.errors = [];
    this.samples = [];
    this.highlights = [];
    this.anomalies = [];
  }

  extract(_line, _context) {
    // To be implemented by subclasses.
  }

  addEvent(event) {
    if (!event) return;
    if (this._isAtLimit(this.events)) return;
    this.events.push(event);
  }

  addError(error) {
    if (!error) return;
    if (this._isAtLimit(this.errors)) return;
    this.errors.push(error);
  }

  addSample(sample) {
    if (!sample) return;
    if (this._isAtLimit(this.samples)) return;
    this.samples.push(sample);
  }

  addHighlight(highlight) {
    if (!highlight) return;
    this.highlights.push(highlight);
  }

  addAnomaly(anomaly) {
    if (!anomaly) return;
    this.anomalies.push(anomaly);
  }

  getResults() {
    return {
      stats: this.stats,
      events: this.events,
      errors: this.errors,
      samples: this.samples,
      highlights: this.highlights,
      anomalies: this.anomalies
    };
  }

  _isAtLimit(list) {
    const limit = this.config.maxEntries;
    return Number.isFinite(limit) && list.length >= limit;
  }
}

module.exports = BaseExtractor;
