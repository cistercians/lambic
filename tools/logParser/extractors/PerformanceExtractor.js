const BaseExtractor = require('./BaseExtractor');

class PerformanceExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('performance', config);
    this.stats = this.initializeStats();
  }

  initializeStats() {
    return {
      fps: [],
      frameMs: [],
      packetBytes: [],
      memoryMb: []
    };
  }

  extract(line, context) {
    let matched = false;
    const fpsMatch = line.match(/fps[:=]\s*([\d.]+)/i);
    if (fpsMatch) {
      this.stats.fps.push(Number(fpsMatch[1]));
      this.addSample({ type: 'fps', value: Number(fpsMatch[1]), lineNumber: context.lineNumber });
      matched = true;
    }

    const frameMatch = line.match(/frame(?:\s*time)?[:=]\s*([\d.]+)\s*ms/i);
    if (frameMatch) {
      this.stats.frameMs.push(Number(frameMatch[1]));
      this.addSample({ type: 'frame_ms', value: Number(frameMatch[1]), lineNumber: context.lineNumber });
      matched = true;
    }

    const packetMatch = line.match(/packet(?:\s*size)?[:=]\s*([\d.]+)\s*(kb|mb|bytes)?/i);
    if (packetMatch) {
      const value = this._toBytes(Number(packetMatch[1]), packetMatch[2]);
      this.stats.packetBytes.push(value);
      this.addSample({ type: 'packet_bytes', value, lineNumber: context.lineNumber });
      matched = true;
    }

    const memoryMatch = line.match(/memory[:=]\s*([\d.]+)\s*(kb|mb|gb)?/i);
    if (memoryMatch) {
      const value = this._toMb(Number(memoryMatch[1]), memoryMatch[2]);
      this.stats.memoryMb.push(value);
      this.addSample({ type: 'memory_mb', value, lineNumber: context.lineNumber });
      matched = true;
    }
    return matched;
  }

  getResults() {
    const stats = {
      avgFps: this._average(this.stats.fps),
      avgFrameMs: this._average(this.stats.frameMs),
      avgPacketBytes: this._average(this.stats.packetBytes),
      avgMemoryMb: this._average(this.stats.memoryMb)
    };
    return {
      ...super.getResults(),
      stats
    };
  }

  _average(values) {
    if (!values.length) return null;
    const sum = values.reduce((acc, value) => acc + value, 0);
    return Number((sum / values.length).toFixed(2));
  }

  _toBytes(value, unit) {
    if (!unit || unit.toLowerCase() === 'bytes') return value;
    if (unit.toLowerCase() === 'kb') return value * 1024;
    if (unit.toLowerCase() === 'mb') return value * 1024 * 1024;
    return value;
  }

  _toMb(value, unit) {
    if (!unit || unit.toLowerCase() === 'mb') return value;
    if (unit.toLowerCase() === 'kb') return value / 1024;
    if (unit.toLowerCase() === 'gb') return value * 1024;
    return value;
  }
}

module.exports = PerformanceExtractor;
