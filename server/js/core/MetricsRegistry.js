class MetricsRegistry {
  constructor() {
    this.counters = new Map();
    this.gauges = new Map();
    this.timings = new Map();
  }

  increment(name, value = 1) {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  setGauge(name, value) {
    this.gauges.set(name, value);
  }

  recordTiming(name, value) {
    if (!this.timings.has(name)) {
      this.timings.set(name, []);
    }
    const list = this.timings.get(name);
    list.push(value);
    if (list.length > 100) {
      list.shift();
    }
  }

  snapshot() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      timings: Object.fromEntries(this.timings)
    };
  }
}

module.exports = new MetricsRegistry();
