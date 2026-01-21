const BaseExtractor = require('./BaseExtractor');

class StrategyExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('strategy', config);
    this.stats = this.initializeStats();
    this.inReportSection = false;
    this.currentReport = null;
  }

  initializeStats() {
    return {
      totalEvents: 0,
      garrisonPlacements: 0,
      farmPlacements: 0,
      resourceScans: 0,
      forestSearches: 0,
      gatherResourceEvents: 0,
      byFaction: {},
      byType: {}
    };
  }

  extract(line, context) {
    // GARRISON PLACEMENT
    const garrisonMatch = line.match(/^\[GARRISON PLACEMENT\]\s+(\w+):\s+(.+)$/);
    if (garrisonMatch) {
      const faction = garrisonMatch[1];
      const message = garrisonMatch[2];

      this.stats.totalEvents += 1;
      this.stats.garrisonPlacements += 1;
      this._increment(this.stats.byFaction, faction);
      this._increment(this.stats.byType, 'garrison_placement');

      this.addEvent({
        type: 'garrison_placement',
        faction,
        message,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // FARM PLACEMENT
    const farmMatch = line.match(/^\[FARM PLACEMENT\]\s+(\w+):\s+(.+)$/);
    if (farmMatch) {
      const faction = farmMatch[1];
      const message = farmMatch[2];

      this.stats.totalEvents += 1;
      this.stats.farmPlacements += 1;
      this._increment(this.stats.byFaction, faction);
      this._increment(this.stats.byType, 'farm_placement');

      this.addEvent({
        type: 'farm_placement',
        faction,
        message,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // MINE RESOURCE SCAN
    const scanMatch = line.match(/^\[MINE RESOURCE SCAN\]\s+(\w+):\s+(.+)$/);
    if (scanMatch) {
      const faction = scanMatch[1];
      const message = scanMatch[2];

      this.stats.totalEvents += 1;
      this.stats.resourceScans += 1;
      this._increment(this.stats.byFaction, faction);
      this._increment(this.stats.byType, 'resource_scan');

      this.addEvent({
        type: 'resource_scan',
        faction,
        message,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // FOREST SEARCH (generic pattern, handles CELTS FOREST SEARCH and others)
    const forestMatch = line.match(/^\[(\w+)\s+FOREST SEARCH\]\s+(\w+):\s+(.+)$/);
    if (forestMatch) {
      const searchType = forestMatch[1];
      const faction = forestMatch[2];
      const message = forestMatch[3];

      this.stats.totalEvents += 1;
      this.stats.forestSearches += 1;
      this._increment(this.stats.byFaction, faction);
      this._increment(this.stats.byType, 'forest_search');

      this.addEvent({
        type: 'forest_search',
        searchType,
        faction,
        message,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // GATHER_RESOURCE
    const gatherMatch = line.match(/^\[GATHER_RESOURCE\]\s+(\w+):\s+(.+)$/);
    if (gatherMatch) {
      const faction = gatherMatch[1];
      const message = gatherMatch[2];

      this.stats.totalEvents += 1;
      this.stats.gatherResourceEvents += 1;
      this._increment(this.stats.byFaction, faction);
      this._increment(this.stats.byType, 'gather_resource');

      // Try to extract resource and progress info
      const resourceMatch = message.match(/gathering\s+(\w+)/i);
      const currentMatch = message.match(/current:\s*(\d+)/i);
      const targetMatch = message.match(/target:\s*(\d+)/i);

      this.addEvent({
        type: 'gather_resource',
        faction,
        message,
        resource: resourceMatch ? resourceMatch[1] : null,
        current: currentMatch ? Number(currentMatch[1]) : null,
        target: targetMatch ? Number(targetMatch[1]) : null,
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

module.exports = StrategyExtractor;
