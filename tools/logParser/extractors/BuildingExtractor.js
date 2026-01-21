const BaseExtractor = require('./BaseExtractor');

class BuildingExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('building', config);
    this.stats = this.initializeStats();
  }

  initializeStats() {
    return {
      totalCompletions: 0,
      completionsByType: {},
      completionsByOwner: {},
      buildings: []
    };
  }

  extract(line, context) {
    if (!line.includes('[BUILDING]')) return false;

    // Pattern 1: [BUILDING] buildingtype completed at [x,y]
    const simpleMatch = line.match(/^\[BUILDING\]\s+(\w+)\s+completed\s+at\s+\[(\d+),(\d+)\]/);
    if (simpleMatch) {
      const buildingType = simpleMatch[1];
      const x = Number(simpleMatch[2]);
      const y = Number(simpleMatch[3]);

      this.stats.totalCompletions += 1;
      this._increment(this.stats.completionsByType, buildingType);

      this.addEvent({
        type: 'building_completion',
        buildingType,
        position: { x, y, z: null },
        owner: null,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // Pattern 2: [BUILDING] buildingtype owned by owner completed at [x,y]
    const ownedMatch = line.match(/^\[BUILDING\]\s+(\w+)\s+owned\s+by\s+(\w+)\s+completed\s+at\s+\[(\d+),(\d+)\]/);
    if (ownedMatch) {
      const buildingType = ownedMatch[1];
      const owner = ownedMatch[2];
      const x = Number(ownedMatch[3]);
      const y = Number(ownedMatch[4]);

      this.stats.totalCompletions += 1;
      this._increment(this.stats.completionsByType, buildingType);
      this._increment(this.stats.completionsByOwner, owner);

      this.addEvent({
        type: 'building_completion',
        buildingType,
        owner,
        position: { x, y, z: null },
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // If we get here, it's a [BUILDING] line but we don't recognize the pattern
    // Return true to claim it
    return true;
  }

  _increment(map, key, amount = 1) {
    map[key] = (map[key] || 0) + amount;
  }
}

module.exports = BuildingExtractor;
