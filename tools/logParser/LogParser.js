const fs = require('fs');
const readline = require('readline');

class LogParser {
  constructor({ extractors = [], unrecognizedExtractor = null, parserVersion = '1.0.0' } = {}) {
    this.extractors = extractors;
    this.unrecognizedExtractor = unrecognizedExtractor;
    this.parserVersion = parserVersion;
  }

  async parseFile(filePath) {
    this._resetExtractors();

    const context = {
      lineNumber: 0,
      currentDay: null,
      currentHour: null,
      firstTimestamp: null,
      lastTimestamp: null
    };

    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      context.lineNumber += 1;
      this._updateTempusContext(line, context);
      this._updateTimestampContext(line, context);
      this._runExtractors(line, context);
    }

    return this._buildReport(filePath, context);
  }

  _resetExtractors() {
    for (const extractor of this.extractors) {
      if (extractor && typeof extractor.reset === 'function') {
        extractor.reset();
      }
    }
    if (this.unrecognizedExtractor && typeof this.unrecognizedExtractor.reset === 'function') {
      this.unrecognizedExtractor.reset();
    }
  }

  _runExtractors(line, context) {
    let handled = false;

    for (const extractor of this.extractors) {
      if (!extractor || extractor.enabled === false) continue;
      const result = extractor.extract(line, context);
      if (result) handled = true;
    }

    if (!handled && this.unrecognizedExtractor && this.unrecognizedExtractor.enabled !== false) {
      this.unrecognizedExtractor.extract(line, context);
    }
  }

  _updateTempusContext(line, context) {
    const tempusMatch = line.match(/^\[TEMPUS\]\s+Day\s+(\d+),\s+Hour:\s+([A-Za-z0-9.]+)/);
    if (!tempusMatch) return;
    context.currentDay = Number(tempusMatch[1]);
    context.currentHour = tempusMatch[2];
  }

  _updateTimestampContext(line, context) {
    const tsMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/);
    if (!tsMatch) return;
    const ts = tsMatch[1];
    if (!context.firstTimestamp) {
      context.firstTimestamp = ts;
    }
    context.lastTimestamp = ts;
  }

  _buildReport(filePath, context) {
    const stats = {};
    const highlights = [];
    const anomalies = [];
    const evidence = { events: [], errors: [], samples: [] };

    const allExtractors = this.unrecognizedExtractor
      ? [...this.extractors, this.unrecognizedExtractor]
      : this.extractors;

    for (const extractor of allExtractors) {
      if (!extractor || extractor.enabled === false) continue;
      const result = extractor.getResults();
      if (result.stats) {
        stats[extractor.name] = result.stats;
      }
      if (result.highlights && result.highlights.length) {
        highlights.push(...result.highlights);
      }
      if (result.anomalies && result.anomalies.length) {
        anomalies.push(...result.anomalies);
      }
      if (result.events && result.events.length) {
        evidence.events.push(...result.events);
      }
      if (result.errors && result.errors.length) {
        evidence.errors.push(...result.errors);
      }
      if (result.samples && result.samples.length) {
        evidence.samples.push(...result.samples);
      }
    }

    return {
      meta: {
        logFile: filePath,
        processedAt: new Date().toISOString(),
        totalLines: context.lineNumber,
        timeRange: {
          start: context.firstTimestamp,
          end: context.lastTimestamp
        },
        parserVersion: this.parserVersion
      },
      highlights,
      stats,
      anomalies,
      evidence
    };
  }
}

module.exports = LogParser;
