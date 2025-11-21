// Zone Manager System
// Manages all zones (geographic + faction territories) and player tracking

class ZoneManager {
  constructor() {
    this.zones = new Map(); // id -> zone
    this.tileIndex = new Map(); // "c,r" -> [zoneIds]
    this.playerZones = new Map(); // playerId -> currentZoneId
  }

  // Add geographic features as zones
  addGeographicFeatures(features) {
    this._bulkOperation = true;
    
    features.forEach(feature => {
      const zone = {
        id: feature.id,
        type: 'geographic',
        subtype: feature.type,
        name: feature.name,
        tiles: feature.tiles,
        tileArray: feature.tileArray,
        center: feature.center,
        bounds: feature.bounds,
        size: feature.size,
        faction: null,
        isOutpost: false
      };
      
      this.addZone(zone);
    });
    
    this._bulkOperation = false;
  }

  // Add faction territory zones
  addFactionZones(territoryZones) {
    this._bulkOperation = true;
    
    territoryZones.forEach(zone => {
      this.addZone(zone);
    });
    
    this._bulkOperation = false;
  }

  // Add a single zone to the manager
  addZone(zone) {
    this.zones.set(zone.id, zone);
    
    // Index all tiles for fast lookup
    zone.tileArray.forEach(([c, r]) => {
      const key = `${c},${r}`;
      if (!this.tileIndex.has(key)) {
        this.tileIndex.set(key, []);
      }
      this.tileIndex.get(key).push(zone.id);
    });
    
    // Log zone creation (only for individual zones, not bulk operations)
    if (!this._bulkOperation) {
    }
  }

  // Remove a zone from the manager
  removeZone(zoneId) {
    const zone = this.zones.get(zoneId);
    if (!zone) return;
    
    // Remove from tile index
    zone.tileArray.forEach(([c, r]) => {
      const key = `${c},${r}`;
      const zoneIds = this.tileIndex.get(key);
      if (zoneIds) {
        const index = zoneIds.indexOf(zoneId);
        if (index > -1) {
          zoneIds.splice(index, 1);
        }
        if (zoneIds.length === 0) {
          this.tileIndex.delete(key);
        }
      }
    });
    
    // Remove from zones map
    this.zones.delete(zoneId);
    
    // Clear any player references to this zone
    this.playerZones.forEach((currentZoneId, playerId) => {
      if (currentZoneId === zoneId) {
        this.playerZones.delete(playerId);
      }
    });
  }

  // Get zone at specific tile coordinates
  getZoneAt(tile) {
    const key = `${tile[0]},${tile[1]}`;
    const zoneIds = this.tileIndex.get(key) || [];
    
    if (zoneIds.length === 0) return null;
    
    // Prioritize: faction territory > faction outpost > geographic feature
    for (const zoneId of zoneIds) {
      const zone = this.zones.get(zoneId);
      if (zone.type === 'faction_territory') return zone;
    }
    
    for (const zoneId of zoneIds) {
      const zone = this.zones.get(zoneId);
      if (zone.type === 'faction_outpost') return zone;
    }
    
    // Return first geographic feature
    return this.zones.get(zoneIds[0]);
  }

  // Check if player entered a new zone
  checkPlayerZoneTransition(playerId, tile) {
    const newZone = this.getZoneAt(tile);
    const currentZoneId = this.playerZones.get(playerId);
    
    if (newZone && newZone.id !== currentZoneId) {
      // Player entered a new zone
      this.playerZones.set(playerId, newZone.id);
      return {
        entered: newZone,
        exited: currentZoneId ? this.zones.get(currentZoneId) : null
      };
    }
    
    return null;
  }

  // Get all zones of a specific type
  getZonesByType(type) {
    const result = [];
    this.zones.forEach(zone => {
      if (zone.type === type) {
        result.push(zone);
      }
    });
    return result;
  }

  // Get all zones for a specific faction
  getZonesByFaction(factionName) {
    const result = [];
    this.zones.forEach(zone => {
      if (zone.faction === factionName) {
        result.push(zone);
      }
    });
    return result;
  }

  // Get zones within a radius of a point
  getZonesNear(tile, radius) {
    const nearbyZones = new Set();
    
    for (let c = tile[0] - radius; c <= tile[0] + radius; c++) {
      for (let r = tile[1] - radius; r <= tile[1] + radius; r++) {
        const key = `${c},${r}`;
        const zoneIds = this.tileIndex.get(key) || [];
        
        zoneIds.forEach(zoneId => {
          nearbyZones.add(zoneId);
        });
      }
    }
    
    return Array.from(nearbyZones).map(zoneId => this.zones.get(zoneId));
  }

  // Get zones adjacent to a specific zone (distance-based)
  getAdjacentZones(zoneId, maxDistance = 30) {
    const targetZone = this.zones.get(zoneId);
    if (!targetZone) return [];
    
    const adjacentZones = [];
    const targetCenter = targetZone.center;
    
    for (const [id, zone] of this.zones) {
      if (id === zoneId) continue; // Skip self
      
      const distance = this.getDistance(targetCenter, zone.center);
      if (distance <= maxDistance) {
        adjacentZones.push(zone);
      }
    }
    
    return adjacentZones;
  }

  // Analyze zone's resource types based on terrain
  getZoneResourceTypes(zone) {
    const resources = {
      forest: 0,
      rocks: 0,
      farmland: 0,
      caves: 0,
      water: 0
    };
    
    for (const [c, r] of zone.tileArray) {
      const terrain = global.getTile ? global.getTile(0, c, r) : 7;
      
      // Count terrain types
      if (terrain === 1 || terrain === 2) resources.forest++; // HEAVY_FOREST or LIGHT_FOREST
      if (terrain === 4) resources.rocks++; // ROCKS
      if (terrain === 7 || terrain === 3) resources.farmland++; // EMPTY or BRUSH
      if (terrain === 6) resources.caves++; // CAVE_ENTRANCE
      if (terrain === 0) resources.water++; // WATER
    }
    
    return resources;
  }

  // Check if zone is within faction's territory
  isZoneInTerritory(zone, house) {
    if (!house.territory || !house.territory.coreBase) return false;
    
    const territoryCenter = house.territory.coreBase.center;
    const territoryRadius = house.territory.coreBase.radius;
    const zoneCenter = zone.center;
    
    const distance = this.getDistance(territoryCenter, zoneCenter);
    return distance <= territoryRadius;
  }

  // Helper method to calculate distance between two points
  getDistance(point1, point2) {
    const dx = point1[0] - point2[0];
    const dy = point1[1] - point2[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Get player's current zone
  getPlayerZone(playerId) {
    const zoneId = this.playerZones.get(playerId);
    return zoneId ? this.zones.get(zoneId) : null;
  }

  // Clear player's zone (when they disconnect)
  clearPlayerZone(playerId) {
    this.playerZones.delete(playerId);
  }

  // Get zone statistics
  getStats() {
    const stats = {
      totalZones: this.zones.size,
      geographicZones: 0,
      factionZones: 0,
      outpostZones: 0,
      playersInZones: this.playerZones.size,
      indexedTiles: this.tileIndex.size
    };
    
    this.zones.forEach(zone => {
      switch (zone.type) {
        case 'geographic':
          stats.geographicZones++;
          break;
        case 'faction_territory':
          stats.factionZones++;
          break;
        case 'faction_outpost':
          stats.outpostZones++;
          break;
      }
    });
    
    return stats;
  }

  // Get all zones (for debugging)
  getAllZones() {
    return Array.from(this.zones.values());
  }

  // Update faction zone (when territory changes)
  updateFactionZone(zoneId, newTiles) {
    const zone = this.zones.get(zoneId);
    if (!zone) return;
    
    // Remove old tile references
    zone.tileArray.forEach(([c, r]) => {
      const key = `${c},${r}`;
      const zoneIds = this.tileIndex.get(key);
      if (zoneIds) {
        const index = zoneIds.indexOf(zoneId);
        if (index > -1) {
          zoneIds.splice(index, 1);
        }
        if (zoneIds.length === 0) {
          this.tileIndex.delete(key);
        }
      }
    });
    
    // Update zone with new tiles
    zone.tileArray = newTiles;
    zone.tiles = new Set(newTiles.map(tile => `${tile[0]},${tile[1]}`));
    
    // Add new tile references
    newTiles.forEach(([c, r]) => {
      const key = `${c},${r}`;
      if (!this.tileIndex.has(key)) {
        this.tileIndex.set(key, []);
      }
      this.tileIndex.get(key).push(zoneId);
    });
  }
}

module.exports = ZoneManager;
