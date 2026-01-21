// Serf Count Utilities
// Utility module for counting serfs and querying serf spawning events

class SerfCountUtils {
  constructor() {
    this._cache = {};
    this._cacheInvalidated = true;
  }

  // Invalidate cache (call when serfs spawn or die)
  invalidateCache() {
    this._cacheInvalidated = true;
    this._cache = {};
  }

  // Count serfs assigned to a specific building
  countSerfsByBuilding(buildingId) {
    if (!global.Player || !global.Player.list) return 0;
    
    let count = 0;
    for (const id in global.Player.list) {
      const player = global.Player.list[id];
      const entityClass = (player.class || '').toString();
      const isSerf = entityClass === 'Serf' || entityClass === 'SerfM' || entityClass === 'SerfF' ||
                     entityClass === 'serf' || entityClass === 'serfm' || entityClass === 'serff';
      
      if (isSerf && player.work && player.work.hq === buildingId) {
        count++;
      }
    }
    return count;
  }

  // Count all serfs for a house
  countSerfsByHouse(houseId) {
    if (!houseId) return 0;
    if (!this._cacheInvalidated && this._cache.house && this._cache.house[houseId] !== undefined) {
      return this._cache.house[houseId];
    }

    if (!global.Player || !global.Player.list) return 0;
    
    let count = 0;
    for (const id in global.Player.list) {
      const player = global.Player.list[id];
      const entityClass = (player.class || '').toString();
      const isSerf = entityClass === 'Serf' || entityClass === 'SerfM' || entityClass === 'SerfF' ||
                     entityClass === 'serf' || entityClass === 'serfm' || entityClass === 'serff';
      
      if (isSerf && player.house === houseId) {
        count++;
      }
    }

    if (!this._cache.house) this._cache.house = {};
    this._cache.house[houseId] = count;
    return count;
  }

  // Count serfs by building type for a house
  countSerfsByBuildingType(houseId, buildingType) {
    if (!houseId || !buildingType) return 0;
    if (!global.Player || !global.Player.list) return 0;
    if (!global.Building || !global.Building.list) return 0;

    let count = 0;
    for (const id in global.Player.list) {
      const player = global.Player.list[id];
      const entityClass = (player.class || '').toString();
      const isSerf = entityClass === 'Serf' || entityClass === 'SerfM' || entityClass === 'SerfF' ||
                     entityClass === 'serf' || entityClass === 'serfm' || entityClass === 'serff';
      
      if (isSerf && player.house === houseId && player.work && player.work.hq) {
        const building = global.Building.list[player.work.hq];
        if (building && building.type === buildingType) {
          count++;
        }
      }
    }
    return count;
  }

  // Get global serf count
  getGlobalSerfCount() {
    if (!this._cacheInvalidated && this._cache.global !== undefined) {
      return this._cache.global;
    }

    if (!global.Player || !global.Player.list) return 0;
    
    let count = 0;
    for (const id in global.Player.list) {
      const player = global.Player.list[id];
      const entityClass = (player.class || '').toString();
      const isSerf = entityClass === 'Serf' || entityClass === 'SerfM' || entityClass === 'SerfF' ||
                     entityClass === 'serf' || entityClass === 'serfm' || entityClass === 'serff';
      
      if (isSerf) {
        count++;
      }
    }

    this._cache.global = count;
    return count;
  }

  // Get serf statistics
  getSerfStatistics() {
    const stats = {
      global: this.getGlobalSerfCount(),
      byHouse: {},
      byBuildingType: {},
      recentSpawns: []
    };

    // Count by house
    if (global.House && global.House.list) {
      for (const houseId in global.House.list) {
        stats.byHouse[houseId] = {
          name: global.House.list[houseId].name || 'Unknown',
          count: this.countSerfsByHouse(houseId)
        };
      }
    }

    // Count by building type (aggregate across all houses)
    const buildingTypes = ['mill', 'farm', 'mine', 'lumbermill', 'dock'];
    for (const type of buildingTypes) {
      let total = 0;
      if (global.House && global.House.list) {
        for (const houseId in global.House.list) {
          total += this.countSerfsByBuildingType(houseId, type);
        }
      }
      if (total > 0) {
        stats.byBuildingType[type] = total;
      }
    }

    // Get recent spawns from Event Manager
    if (global.eventManager) {
      const timeWindow = 24 * 60 * 60 * 1000; // 24 hours
      const events = global.eventManager.getEventsByCategory(global.eventManager.categories.ECONOMIC, timeWindow);
      const spawnEvents = events.filter(e => e.action === 'serfs spawned');
      stats.recentSpawns = spawnEvents.slice(-10).map(e => ({
        building: e.subjectName,
        buildingId: e.subject,
        house: e.houseName,
        count: e.quantity || 0,
        timestamp: e.timestamp
      }));
    }

    return stats;
  }

  // Get serf spawn events for a building
  getSerfSpawnEvents(buildingId, timeWindow = 24 * 60 * 60 * 1000) {
    if (!global.eventManager || !buildingId) return [];
    
    const events = global.eventManager.getEventsByCategory(global.eventManager.categories.ECONOMIC, timeWindow);
    return events.filter(e => 
      e.subject === buildingId && 
      (e.action === 'serf spawn tally started' || 
       e.action === 'serf spawn decision' ||
       e.action === 'serf spawn attempt' ||
       e.action === 'serfs spawned' ||
       e.action === 'serf spawn failed')
    );
  }

  // Get serf spawn events by house
  getSerfSpawnEventsByHouse(houseId, timeWindow = 24 * 60 * 60 * 1000) {
    if (!global.eventManager || !houseId) return [];
    
    const events = global.eventManager.getEventsByCategory(global.eventManager.categories.ECONOMIC, timeWindow);
    return events.filter(e => 
      e.house === houseId && 
      (e.action === 'serf spawn tally started' || 
       e.action === 'serf spawn decision' ||
       e.action === 'serf spawn attempt' ||
       e.action === 'serfs spawned' ||
       e.action === 'serf spawn failed')
    );
  }

  // Get serf spawn statistics
  getSerfSpawnStatistics(timeWindow = 24 * 60 * 60 * 1000) {
    if (!global.eventManager) return null;

    const events = global.eventManager.getEventsByCategory(global.eventManager.categories.ECONOMIC, timeWindow);
    const spawnEvents = events.filter(e => 
      e.action === 'serf spawn tally started' || 
      e.action === 'serf spawn attempt' ||
      e.action === 'serfs spawned' ||
      e.action === 'serf spawn failed'
    );

    const stats = {
      tallyStarts: 0,
      spawnAttempts: 0,
      spawnsSuccessful: 0,
      spawnsFailed: 0,
      totalSerfsSpawned: 0,
      byHouse: {},
      byBuildingType: {},
      byBuilding: {},
      failedReasons: {}
    };

    for (const event of spawnEvents) {
      if (event.action === 'serf spawn tally started') {
        stats.tallyStarts++;
      } else if (event.action === 'serf spawn attempt') {
        stats.spawnAttempts++;
      } else if (event.action === 'serfs spawned') {
        stats.spawnsSuccessful++;
        stats.totalSerfsSpawned += (event.quantity || 0);
        if (event.houseName) {
          stats.byHouse[event.houseName] = (stats.byHouse[event.houseName] || 0) + (event.quantity || 0);
        }
        if (event.subjectName) {
          stats.byBuildingType[event.subjectName] = (stats.byBuildingType[event.subjectName] || 0) + (event.quantity || 0);
        }
        if (event.subject) {
          stats.byBuilding[event.subject] = (stats.byBuilding[event.subject] || 0) + (event.quantity || 0);
        }
      } else if (event.action === 'serf spawn failed') {
        stats.spawnsFailed++;
        const reason = event.metadata && event.metadata.reason ? event.metadata.reason : 'unknown';
        stats.failedReasons[reason] = (stats.failedReasons[reason] || 0) + 1;
      }
    }

    return stats;
  }
}

module.exports = SerfCountUtils;
