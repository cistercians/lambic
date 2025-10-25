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
    console.log('🗺️ Adding geographic features to zone manager...');
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
      console.log(`📍 Created geographic zone: ${feature.name} (${feature.type}, ${feature.size} tiles)`);
    });
    
    this._bulkOperation = false;
    console.log(`✅ Added ${features.length} geographic zones`);
  }

  // Add faction territory zones
  addFactionZones(territoryZones) {
    console.log('🏰 Adding faction territories to zone manager...');
    this._bulkOperation = true;
    
    territoryZones.forEach(zone => {
      this.addZone(zone);
      console.log(`🏰 Created faction zone: ${zone.name} (${zone.type}, ${zone.size} tiles)`);
    });
    
    this._bulkOperation = false;
    console.log(`✅ Added ${territoryZones.length} faction zones`);
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
      console.log(`📍 Created zone: ${zone.name} (${zone.type}, ${zone.size} tiles)`);
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
