const BaseExtractor = require('./BaseExtractor');

class NetworkExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('network', config);
    this.stats = this.initializeStats();
  }

  initializeStats() {
    return {
      totalRequests: 0,
      requestsByPath: {},
      requestsByStatus: {},
      totalResponseTime: 0,
      averageResponseTime: null,
      unfinishedRequests: 0
    };
  }

  extract(line, context) {
    if (!line.trim().startsWith('GET ')) return false;

    // Pattern: GET /path 123ms 200
    const completeMatch = line.match(/^GET\s+([^\s]+)\s+(\d+)ms\s+(\d+)$/);
    if (completeMatch) {
      const path = completeMatch[1];
      const responseTime = Number(completeMatch[2]);
      const status = completeMatch[3];

      this.stats.totalRequests += 1;
      this.stats.totalResponseTime += responseTime;
      this._increment(this.stats.requestsByPath, path);
      this._increment(this.stats.requestsByStatus, status);

      if (this.stats.totalRequests > 0) {
        this.stats.averageResponseTime = Math.round(this.stats.totalResponseTime / this.stats.totalRequests);
      }

      this.addEvent({
        type: 'http_request',
        method: 'GET',
        path,
        status,
        responseTime,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // Pattern: GET /path 123ms (unfinished)
    const unfinishedMatch = line.match(/^GET\s+([^\s]+)\s+(\d+)ms\s+\(unfinished\)$/);
    if (unfinishedMatch) {
      const path = unfinishedMatch[1];
      const responseTime = Number(unfinishedMatch[2]);

      this.stats.totalRequests += 1;
      this.stats.unfinishedRequests += 1;
      this._increment(this.stats.requestsByPath, path);

      this.addEvent({
        type: 'http_request',
        method: 'GET',
        path,
        status: 'unfinished',
        responseTime,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // If we get here, it's a GET line but we don't recognize the pattern
    // Return true to claim it
    return true;
  }

  _increment(map, key, amount = 1) {
    map[key] = (map[key] || 0) + amount;
  }
}

module.exports = NetworkExtractor;
