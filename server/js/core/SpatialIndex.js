// server/js/core/SpatialIndex.js
// Intelligent spatial partitioning system for efficient entity queries

class SpatialIndex {
  constructor(cellSize = 64) {
    this.cellSize = cellSize; // Size of each spatial cell in pixels
    this.cells = new Map(); // Map<cellKey, Set<entityId>>
    this.entityCells = new Map(); // Map<entityId, Set<cellKeys>> - tracks which cells each entity is in
    this.queryCache = new Map(); // Cache for common queries
    this.cacheTimeout = 5000; // Cache expires after 5 seconds - longer cache to improve hit rates
    this.stats = {
      queries: 0,
      cacheHits: 0,
      cellsUsed: 0,
      entitiesTracked: 0
    };
  }

  // Convert world coordinates to cell key
  getCellKey(x, y) {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  // Get all cell keys that an entity with given bounds occupies
  getEntityCells(x, y, radius = 0) {
    const cells = new Set();
    const minX = x - radius;
    const maxX = x + radius;
    const minY = y - radius;
    const maxY = y + radius;

    const minCellX = Math.floor(minX / this.cellSize);
    const maxCellX = Math.floor(maxX / this.cellSize);
    const minCellY = Math.floor(minY / this.cellSize);
    const maxCellY = Math.floor(maxY / this.cellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        cells.add(`${cx},${cy}`);
      }
    }
    return cells;
  }

  // Add entity to spatial index
  addEntity(entityId, x, y, radius = 0) {
    const newCells = this.getEntityCells(x, y, radius);
    const oldCells = this.entityCells.get(entityId) || new Set();

    // Remove from old cells
    for (const cellKey of oldCells) {
      if (!newCells.has(cellKey)) {
        const cell = this.cells.get(cellKey);
        if (cell) {
          cell.delete(entityId);
          if (cell.size === 0) {
            this.cells.delete(cellKey);
          }
        }
      }
    }

    // Add to new cells
    for (const cellKey of newCells) {
      if (!this.cells.has(cellKey)) {
        this.cells.set(cellKey, new Set());
      }
      this.cells.get(cellKey).add(entityId);
    }

    this.entityCells.set(entityId, newCells);
    this.stats.entitiesTracked = this.entityCells.size;
    this.stats.cellsUsed = this.cells.size;
  }

  // Remove entity from spatial index
  removeEntity(entityId) {
    const cells = this.entityCells.get(entityId);
    if (cells) {
      for (const cellKey of cells) {
        const cell = this.cells.get(cellKey);
        if (cell) {
          cell.delete(entityId);
          if (cell.size === 0) {
            this.cells.delete(cellKey);
          }
        }
      }
      this.entityCells.delete(entityId);
    }
    this.stats.entitiesTracked = this.entityCells.size;
    this.stats.cellsUsed = this.cells.size;
  }

  // Find entities within radius of a point
  findNearby(x, y, radius, filter = null) {
    this.stats.queries++;
    
    // Check cache first
    const cacheKey = `${Math.floor(x)},${Math.floor(y)},${radius}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.stats.cacheHits++;
      return cached.result;
    }

    const nearby = new Set();
    const cellsToCheck = this.getEntityCells(x, y, radius);

    for (const cellKey of cellsToCheck) {
      const cell = this.cells.get(cellKey);
      if (cell) {
        for (const entityId of cell) {
          if (filter && !filter(entityId)) continue;
          
          const entity = global.Player.list[entityId];
          if (!entity) continue;

          const distance = Math.sqrt(
            Math.pow(entity.x - x, 2) + Math.pow(entity.y - y, 2)
          );
          
          if (distance <= radius) {
            nearby.add(entityId);
          }
        }
      }
    }

    const result = Array.from(nearby);
    
    // Cache the result
    this.queryCache.set(cacheKey, {
      result: result,
      timestamp: Date.now()
    });

    // Clean old cache entries
    if (this.queryCache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of this.queryCache.entries()) {
        if (now - value.timestamp > this.cacheTimeout) {
          this.queryCache.delete(key);
        }
      }
    }

    return result;
  }

  // Find entities in a rectangular area
  findInRect(minX, minY, maxX, maxY, filter = null) {
    const entities = new Set();
    const minCellX = Math.floor(minX / this.cellSize);
    const maxCellX = Math.floor(maxX / this.cellSize);
    const minCellY = Math.floor(minY / this.cellSize);
    const maxCellY = Math.floor(maxY / this.cellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const cellKey = `${cx},${cy}`;
        const cell = this.cells.get(cellKey);
        if (cell) {
          for (const entityId of cell) {
            if (filter && !filter(entityId)) continue;
            
            const entity = global.Player.list[entityId];
            if (!entity) continue;

            if (entity.x >= minX && entity.x <= maxX && 
                entity.y >= minY && entity.y <= maxY) {
              entities.add(entityId);
            }
          }
        }
      }
    }

    return Array.from(entities);
  }

  // Get entities that could potentially interact with the given entity
  getPotentialInteractions(entityId, interactionRadius = 100) {
    const entity = global.Player.list[entityId];
    if (!entity) return [];

    return this.findNearby(entity.x, entity.y, interactionRadius, (id) => id !== entityId);
  }

  // Optimize cell size based on entity density
  optimizeCellSize() {
    const totalEntities = this.stats.entitiesTracked;
    const totalCells = this.stats.cellsUsed;
    
    if (totalEntities === 0 || totalCells === 0) return;

    const avgEntitiesPerCell = totalEntities / totalCells;
    
    // If too many entities per cell, increase cell size
    if (avgEntitiesPerCell > 10) {
      this.cellSize = Math.min(this.cellSize * 1.5, 128);
    }
    // If too few entities per cell, decrease cell size
    else if (avgEntitiesPerCell < 2 && this.cellSize > 32) {
      this.cellSize = Math.max(this.cellSize * 0.8, 32);
    }
  }

  // Get performance statistics
  getStats() {
    return {
      ...this.stats,
      cellSize: this.cellSize,
      cacheSize: this.queryCache.size,
      cacheHitRate: this.stats.queries > 0 ? (this.stats.cacheHits / this.stats.queries * 100).toFixed(1) + '%' : '0%'
    };
  }

  // Clear all data
  clear() {
    this.cells.clear();
    this.entityCells.clear();
    this.queryCache.clear();
    this.stats = {
      queries: 0,
      cacheHits: 0,
      cellsUsed: 0,
      entitiesTracked: 0
    };
  }
}

module.exports = SpatialIndex;
