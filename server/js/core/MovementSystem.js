/**
 * MovementSystem - Centralized movement utilities
 *
 * This module exposes helper functions for entity movement, pathfinding,
 * and stuck detection. The system works independently and relies on globals
 * for pathfinding and transition planning.
 *
 * Usage:
 *   const MovementSystem = require('./MovementSystem');
 *   MovementSystem.moveTowardTarget(entity, target);
 *   MovementSystem.handleStuckDetection(entity);
 */

// MovementSystem relies on global systems (no direct requires to avoid circular dependencies)

class MovementSystem {
  constructor() {
    // Constants
    this.STUCK_THRESHOLD = 150;
    this.STUCK_RECOVERY_THRESHOLD = 200;
    this.MAX_PATH_RECALC_ATTEMPTS = 3;

    // Direction map for 8-way movement
    this.DIRECTIONS = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
      upLeft: [-1, -1],
      upRight: [1, -1],
      downLeft: [-1, 1],
      downRight: [1, 1]
    };

    // Cardinal directions for priority movement
    this.CARDINALS = ['up', 'down', 'left', 'right'];
    this.DIAGONALS = ['upLeft', 'upRight', 'downLeft', 'downRight'];

    this.pathfinder = null;
    this.layerFallback = {
      0: 0,
      1: 3,
      2: 5,
      '-1': 1,
      '-2': 8,
      '-3': 2
    };

    this.PATH_INVALIDATION_REASONS = {
      OSCILLATING: 'oscillating',
      BLOCKED: 'blocked',
      STUCK: 'stuck',
      GAVE_UP: 'gaveUp',
      COOLDOWN: 'cooldown',
      NO_PATH: 'no_path'
    };

    this.OSCILLATION_CONFIG = {
      default: { windowSize: 10, repeatThreshold: 4 },
      shortPath: { windowSize: 12, repeatThreshold: 6 }
    };
  }

  /**
   * Register an existing SimplePathfinder instance to share the same path data.
   */
  registerPathfinder(pathfinderInstance) {
    if (pathfinderInstance && typeof pathfinderInstance.findPath === 'function') {
      this.pathfinder = pathfinderInstance;
      if (global.debugPathfinding) {
        console.log('[MovementSystem] Pathfinder registered');
      }
      return true;
    }
    if (global.debugPathfinding) {
      console.warn('[MovementSystem] Failed to register pathfinder', pathfinderInstance);
    }
    return false;
  }

  /**
   * Ensure we have a pathfinder available (lazy init fallback).
   */
  ensurePathfinder() {
    if (this.pathfinder) return true;
    // Use global tilemapSystem's pathfinder if available
    if (global.tilemapSystem && global.tilemapSystem.pathfindingSystem) {
      this.pathfinder = global.tilemapSystem.pathfindingSystem;
      return true;
    }
    return false;
  }

  /**
   * Resolve the tile layer associated with a z-level.
   */
  resolveLayerForZ(z) {
    // Use global transitionPlanner if available
    if (global.transitionPlanner && typeof global.transitionPlanner.getLayerForZ === 'function') {
      return global.transitionPlanner.getLayerForZ(z);
    }
    return this.layerFallback[z] !== undefined ? this.layerFallback[z] : 0;
  }

  /**
   * Find a path using the registered pathfinder or fallback to the legacy tilemap.
   */
  findPath(start, destination, z, options = {}) {
    if (global.debugPathfinding) {
      console.log('[MovementSystem] findPath CALLED start=%j dest=%j z=%s hasPathfinder=%s', start, destination, z, !!this.pathfinder);
    }
    
    if (!Array.isArray(start) || !Array.isArray(destination)) {
      if (global.debugPathfinding) {
        console.log('[MovementSystem] findPath REJECTED: invalid inputs');
      }
      return null;
    }

    const layer = options.layer !== undefined ? options.layer : this.resolveLayerForZ(z);

    // MovementSystem no longer does pathfinding directly
    // All pathfinding goes through PathfindingManager or TilemapSystem
    // This fallback is here for compatibility but shouldn't be used

    if (global.findPathContextAware && options.entity) {
      return global.findPathContextAware(start, destination, layer, options, options.entity);
    }

    if (global.tilemapSystem && typeof global.tilemapSystem.findPath === 'function') {
      if (global.debugPathfinding) {
        console.log('[MovementSystem] findPath (TilemapSystem fallback) start=%j dest=%j layer=%s', start, destination, layer);
      }
      try {
        const fallbackPath = global.tilemapSystem.findPath(start, destination, layer, options);
        if (global.debugPathfinding) {
          console.log('[MovementSystem] fallback returned pathLength=%s', fallbackPath ? fallbackPath.length : 'null');
        }
        return fallbackPath;
      } catch (err) {
        if (global.debugPathfinding) {
          console.warn('[MovementSystem] fallback findPath threw', err.message);
        }
      }
    }

    if (global.debugPathfinding) {
      console.log('[MovementSystem] findPath returning null (no path found)');
    }
    return null;
  }
  
  // ============================================================================
  // LOCATION UTILITIES
  // ============================================================================
  
  /**
   * Get tile location from pixel coordinates
   */
  getLoc(x, y) {
    if (global.getLoc) {
      return global.getLoc(x, y);
    }
    const tileSize = global.tileSize || 64;
    return [Math.floor(x / tileSize), Math.floor(y / tileSize)];
  }
  
  /**
   * Get center pixel coordinates of a tile
   */
  getCenter(col, row) {
    if (global.getCenter) {
      return global.getCenter(col, row);
    }
    const tileSize = global.tileSize || 64;
    return [col * tileSize + tileSize / 2, row * tileSize + tileSize / 2];
  }
  
  /**
   * Check if a tile is walkable
   */
  isWalkable(z, col, row) {
    if (global.isWalkable) {
      return global.isWalkable(z, col, row);
    }
    return true;
  }
  
  /**
   * Get tile type at location
   */
  getTile(z, col, row) {
    if (global.getTile) {
      return global.getTile(z, col, row);
    }
    return 7; // Empty terrain
  }
  
  /**
   * Calculate distance between two points
   */
  getDistance(p1, p2) {
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ============================================================================
  // MOVE INTENT + PATH RESULT
  // ============================================================================

  normalizeMoveIntent(entity, intent) {
    if (!entity || !intent) return null;
    const target = intent.target || intent.loc || intent.destination;
    if (!Array.isArray(target) || target.length < 2) return null;

    const normalized = {
      target: [target[0], target[1]],
      z: intent.z !== undefined ? intent.z : entity.z,
      reason: intent.reason || null,
      priority: intent.priority || 0,
      avoidanceFlags: intent.avoidanceFlags || {},
      allowTransition: intent.allowTransition !== false,
      sourceAction: intent.sourceAction || entity.action || entity.mode || null,
      requestedAt: Date.now()
    };

    return normalized;
  }

  buildPathResult(status, data = {}) {
    return Object.assign({
      status,
      timestamp: Date.now()
    }, data);
  }

  applyMoveIntent(entity, intent) {
    const normalized = this.normalizeMoveIntent(entity, intent);
    if (!normalized) {
      const invalidResult = this.buildPathResult('invalid', { reason: 'invalid_intent' });
      entity.lastPathResult = invalidResult;
      return invalidResult;
    }

    entity.moveIntent = normalized;
    entity.lastMoveIntent = normalized;
    const result = this.requestPathForIntent(entity, normalized);
    entity.lastPathResult = result;
    return result;
  }

  shouldBypassPathCooldown(entity, intent) {
    if (!entity || !intent) return false;
    const isMultiZTransition = intent.z !== entity.z;
    const isProcessingWaypoint = entity.multiZWaypoints && entity.multiZWaypoints.length > 0;
    const isDepositMove = intent.sourceAction === 'deposit' || intent.sourceAction === 'clockout' || intent.reason === 'deposit';
    return isMultiZTransition || isProcessingWaypoint || isDepositMove;
  }

  requestPathForIntent(entity, intent) {
    if (!entity || !intent) {
      return this.buildPathResult('invalid', { reason: 'missing_entity_or_intent' });
    }

    if (entity.type === 'player' && entity.zTransitionHalt) {
      return this.buildPathResult('halted', { reason: 'z_transition_halt' });
    }

    if (entity.pathCooldown && entity.pathCooldown > 0 && !this.shouldBypassPathCooldown(entity, intent)) {
      return this.buildPathResult('throttled', { reason: this.PATH_INVALIDATION_REASONS.COOLDOWN, cooldown: entity.pathCooldown });
    }

    if (entity.shouldRequestPath && typeof entity.shouldRequestPath === 'function') {
      if (!entity.shouldRequestPath(intent.z, intent.target[0], intent.target[1])) {
        return this.buildPathResult('noop', {
          reason: 'already_pathing',
          pathLen: entity.path ? entity.path.length : 0
        });
      }
    }

    let usedMoveTo = false;
    if (typeof entity.moveTo === 'function') {
      usedMoveTo = true;
      entity.moveTo(intent.z, intent.target[0], intent.target[1]);
    } else if (typeof entity.getPath === 'function') {
      entity.getPath(intent.z, intent.target[0], intent.target[1]);
    }

    if (entity.path && entity.path.length > 0) {
      return this.buildPathResult('success', {
        pathLen: entity.path.length,
        target: intent.target,
        z: intent.z
      });
    }

    if (usedMoveTo) {
      return this.buildPathResult('direct', {
        target: intent.target,
        z: intent.z
      });
    }

    return this.buildPathResult('no_path', {
      reason: this.PATH_INVALIDATION_REASONS.NO_PATH,
      target: intent.target,
      z: intent.z
    });
  }
  
  // ============================================================================
  // DIRECTION CALCULATION
  // ============================================================================
  
  /**
   * Calculate direction code from source to target location
   * Returns: 'u', 'd', 'l', 'r', 'ul', 'ur', 'dl', 'dr', 'lu', 'ld', 'ru', 'rd', 'c'
   */
  calcDirection(loc, targetLoc) {
    const dx = targetLoc[0] - loc[0];
    const dy = targetLoc[1] - loc[1];
    
    if (dx === 0 && dy === 0) return 'c'; // Center - at target
    
    // Determine primary and secondary directions
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    
    const horizontal = dx > 0 ? 'r' : (dx < 0 ? 'l' : '');
    const vertical = dy > 0 ? 'd' : (dy < 0 ? 'u' : '');
    
    // Pure cardinal direction
    if (dx === 0) return vertical;
    if (dy === 0) return horizontal;
    
    // Diagonal - primary direction first
    if (absDx >= absDy) {
      return horizontal + vertical; // 'rd', 'ru', 'ld', 'lu'
    } else {
      return vertical + horizontal; // 'dr', 'ur', 'dl', 'ul'
    }
  }

  /**
   * Calculate direction (alias for calcDirection for backward compatibility)
   */
  calcDir(loc, targetLoc) {
    return this.calcDirection(loc, targetLoc);
  }
  
  /**
   * Get the facing direction string from direction code
   */
  getFacing(direction) {
    if (direction.includes('d')) return 'down';
    if (direction.includes('u')) return 'up';
    if (direction.includes('l')) return 'left';
    if (direction.includes('r')) return 'right';
    return 'down';
  }
  
  /**
   * Get offset array [dx, dy] from direction code
   */
  getOffset(direction) {
    const offsets = {
      'u': [0, -1], 'd': [0, 1], 'l': [-1, 0], 'r': [1, 0],
      'ul': [-1, -1], 'lu': [-1, -1],
      'ur': [1, -1], 'ru': [1, -1],
      'dl': [-1, 1], 'ld': [-1, 1],
      'dr': [1, 1], 'rd': [1, 1],
      'c': [0, 0]
    };
    return offsets[direction] || [0, 0];
  }
  
  // ============================================================================
  // MOVEMENT HELPERS
  // ============================================================================
  
  /**
   * Get all walkable adjacent tiles
   */
  getWalkableAdjacent(z, col, row) {
    const adjacent = [];
    const offsets = [
      [0, -1], [0, 1], [-1, 0], [1, 0] // Cardinal only for stability
    ];
    
    for (const [dx, dy] of offsets) {
      const newCol = col + dx;
      const newRow = row + dy;
      
      if (this.isWalkable(z, newCol, newRow)) {
        adjacent.push([newCol, newRow]);
      }
    }
    
    return adjacent;
  }
  
  /**
   * Find best movement direction toward target
   */
  getBestMoveDirection(entity, targetLoc) {
    const loc = this.getLoc(entity.x, entity.y);
    const direction = this.calcDirection(loc, targetLoc);
    const offset = this.getOffset(direction);
    
    const primaryTarget = [loc[0] + offset[0], loc[1] + offset[1]];
    
    if (this.isWalkable(entity.z, primaryTarget[0], primaryTarget[1])) {
      return primaryTarget;
    }
    
    // Try alternate directions
    const alternates = this.getAlternateDirections(direction);
    for (const altDir of alternates) {
      const altOffset = this.getOffset(altDir);
      const altTarget = [loc[0] + altOffset[0], loc[1] + altOffset[1]];
      
      if (this.isWalkable(entity.z, altTarget[0], altTarget[1])) {
        return altTarget;
      }
    }
    
    return null; // No valid movement
  }
  
  /**
   * Get alternate directions when primary is blocked
   */
  getAlternateDirections(primaryDir) {
    const alternates = {
      'u': ['l', 'r', 'ul', 'ur'],
      'd': ['l', 'r', 'dl', 'dr'],
      'l': ['u', 'd', 'ul', 'dl'],
      'r': ['u', 'd', 'ur', 'dr'],
      'ul': ['u', 'l', 'ur', 'dl'],
      'ur': ['u', 'r', 'ul', 'dr'],
      'dl': ['d', 'l', 'ul', 'dr'],
      'dr': ['d', 'r', 'ur', 'dl'],
      'lu': ['u', 'l', 'ur', 'dl'],
      'ru': ['u', 'r', 'ul', 'dr'],
      'ld': ['d', 'l', 'ul', 'dr'],
      'rd': ['d', 'r', 'ur', 'dl']
    };
    return alternates[primaryDir] || ['u', 'd', 'l', 'r'];
  }
  
  // ============================================================================
  // STUCK DETECTION
  // ============================================================================
  
  /**
   * Initialize stuck tracking for an entity
   */
  initStuckTracking(entity) {
    if (!entity._movement) {
      entity._movement = {
        stuck: 0,
        prevLoc: null,
        pathRecalcAttempts: 0,
        lastMoveTime: Date.now()
      };
    }
    return entity._movement;
  }
  
  /**
   * Update stuck detection for an entity
   * Call this after movement attempts
   */
  updateStuckDetection(entity) {
    const movement = this.initStuckTracking(entity);
    const loc = this.getLoc(entity.x, entity.y);
    
    if (!movement.prevLoc) {
      movement.prevLoc = loc;
      return false;
    }
    
    const dx = loc[0] - movement.prevLoc[0];
    const dy = loc[1] - movement.prevLoc[1];
    
    // Check if position changed
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
      movement.stuck++;
    } else {
      movement.stuck = Math.max(0, movement.stuck - 2);
      movement.pathRecalcAttempts = 0;
    }
    
    movement.prevLoc = loc;
    movement.lastMoveTime = Date.now();
    
    return movement.stuck >= this.STUCK_THRESHOLD;
  }
  
  /**
   * Handle stuck entity recovery
   */
  handleStuckRecovery(entity) {
    const movement = this.initStuckTracking(entity);
    
    if (movement.stuck < this.STUCK_THRESHOLD) {
      return false;
    }
    
    // Strategy 1: Skip ahead in path
    if (entity.path && entity.path.length > 0 && 
        movement.pathRecalcAttempts < this.MAX_PATH_RECALC_ATTEMPTS) {
      entity.pathCount = Math.min(entity.pathCount + 3, entity.path.length - 1);
      movement.pathRecalcAttempts++;
      return true;
    }
    
    // Strategy 2: Recalculate path
    if (entity.pathEnd && movement.pathRecalcAttempts < this.MAX_PATH_RECALC_ATTEMPTS) {
      this.getPathForEntity(entity, entity.pathEnd.z, entity.pathEnd.loc[0], entity.pathEnd.loc[1]);
      movement.pathRecalcAttempts++;
      return true;
    }
    
    // Strategy 3: Random movement
    if (movement.stuck >= this.STUCK_RECOVERY_THRESHOLD) {
      const randomDir = Math.floor(Math.random() * 4);
      const offsets = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      const offset = offsets[randomDir];
      const loc = this.getLoc(entity.x, entity.y);
      const newTarget = [loc[0] + offset[0], loc[1] + offset[1]];
      
      if (this.isWalkable(entity.z, newTarget[0], newTarget[1])) {
        this.moveTo(entity, entity.z, newTarget[0], newTarget[1]);
        movement.stuck = 0;
        return true;
      }
    }
    
    return false;
  }

  // ============================================================================
  // PATH FOLLOWING + INVALIDATION (CENTRALIZED)
  // ============================================================================

  getOscillationConfig(entity) {
    const pathLen = entity && entity.path ? entity.path.length : 0;
    const isShortPath = pathLen > 0 && pathLen <= 3;
    const baseConfig = isShortPath ? this.OSCILLATION_CONFIG.shortPath : this.OSCILLATION_CONFIG.default;
    const intent = entity ? entity.moveIntent : null;
    const isDeposit = intent && (intent.reason === 'deposit' || intent.sourceAction === 'deposit' || intent.sourceAction === 'clockout');
    const windowSize = isDeposit ? baseConfig.windowSize + 2 : baseConfig.windowSize;
    const repeatThreshold = isDeposit ? baseConfig.repeatThreshold + 1 : baseConfig.repeatThreshold;
    return {
      enabled: entity && entity.z !== -1,
      windowSize,
      repeatThreshold
    };
  }

  recordPathEvent(entity, reason, data = {}) {
    if (!entity) return;
    if (!entity._pathMetrics) {
      entity._pathMetrics = {
        invalidations: 0,
        oscillations: 0,
        blocked: 0,
        stuck: 0,
        gaveUp: 0,
        throttled: 0,
        lastReason: null,
        lastAt: null
      };
    }

    const metrics = entity._pathMetrics;
    metrics.invalidations++;
    metrics.lastReason = reason;
    metrics.lastAt = Date.now();
    if (reason === this.PATH_INVALIDATION_REASONS.OSCILLATING) metrics.oscillations++;
    if (reason === this.PATH_INVALIDATION_REASONS.BLOCKED) metrics.blocked++;
    if (reason === this.PATH_INVALIDATION_REASONS.STUCK) metrics.stuck++;
    if (reason === this.PATH_INVALIDATION_REASONS.GAVE_UP) metrics.gaveUp++;
    if (reason === this.PATH_INVALIDATION_REASONS.COOLDOWN) metrics.throttled++;

    if (entity.type === 'npc' && (entity.class === 'Serf' || entity.class === 'SerfM' || entity.class === 'SerfF')) {
      const serfLogger = global.serfLogger;
      const now = Date.now();
      if (serfLogger && (!entity._serfStuckLogAt || (now - entity._serfStuckLogAt > 5000))) {
        serfLogger.warn('Path invalidation', entity, Object.assign({ reason }, data));
        entity._serfStuckLogAt = now;
      }
    }
  }

  handlePathFollowing(entity) {
    if (!entity || !entity.path) {
      return false;
    }

    if (entity.type === 'player' && entity.zTransitionHalt) {
      if (entity.zTransitionCooldown > 0) {
        entity.zTransitionCooldown--;
      }
      return false;
    }

    if (entity.pathCount < entity.path.length) {
      const next = entity.path[entity.pathCount];
      const currentLoc = this.getLoc(entity.x, entity.y, entity);
      const isNextBlocked = !this.isWalkable(entity.z, next[0], next[1], entity);
      const isNotAtNext = currentLoc.toString() !== next.toString();

      // Track waypoint history to detect oscillation (back-and-forth loops)
      let isOscillating = false;
      if (entity.path.length > 1) {
        const oscConfig = this.getOscillationConfig(entity);
        if (oscConfig.enabled) {
          if (!entity.waypointHistory) {
            entity.waypointHistory = [];
          }
          entity.waypointHistory.push(next.toString());
          if (entity.waypointHistory.length > oscConfig.windowSize) {
            entity.waypointHistory.shift();
          }

          const waypointCounts = {};
          for (let i = 0; i < entity.waypointHistory.length; i++) {
            const wp = entity.waypointHistory[i];
            waypointCounts[wp] = (waypointCounts[wp] || 0) + 1;
          }
          for (const wp in waypointCounts) {
            if (waypointCounts[wp] >= oscConfig.repeatThreshold) {
              isOscillating = true;
              break;
            }
          }
        }
      }

      // Track stuck detection for waypoint
      if (!entity.lastWaypoint || entity.lastWaypoint.toString() !== next.toString()) {
        entity.lastWaypoint = next;
        entity.waypointStuckCounter = 0;
        entity.waypointStuckPosition = { x: entity.x, y: entity.y };
      } else {
        entity.waypointStuckCounter = (entity.waypointStuckCounter || 0) + 1;
        if (entity.waypointStuckPosition) {
          const distMoved = Math.sqrt(
            Math.pow(entity.x - entity.waypointStuckPosition.x, 2) +
            Math.pow(entity.y - entity.waypointStuckPosition.y, 2)
          );
          if (distMoved > 10) {
            entity.waypointStuckCounter = Math.max(0, entity.waypointStuckCounter - 10);
            entity.waypointStuckPosition = { x: entity.x, y: entity.y };
          }
        }
      }

      const isTrulyStuck = (isNextBlocked && isNotAtNext && entity.waypointStuckCounter > 30) ||
        entity.waypointStuckCounter > 60 ||
        (isOscillating && entity.waypointStuckCounter > 30);

      if (isTrulyStuck) {
        if (isOscillating) {
          if (global.stuckEntityAnalytics) {
            global.stuckEntityAnalytics.recordStuckEvent(entity, next, this.PATH_INVALIDATION_REASONS.OSCILLATING, entity.pathRecalcAttempts || 0, entity.z);
          }
          this.recordPathEvent(entity, this.PATH_INVALIDATION_REASONS.OSCILLATING, { next, z: entity.z, pathLen: entity.path ? entity.path.length : 0 });

          entity.path = null;
          entity.pathCount = 0;
          entity.pathLocked = false;
          entity.waypointHistory = [];
          entity.skippedWaypointCount = 0;
          if (!entity.pathCooldown) entity.pathCooldown = 0;
          entity.pathCooldown = 30;
          return true;
        }

        if (!entity.pathRecalcAttempts) {
          entity.pathRecalcAttempts = 0;
        }
        entity.pathRecalcAttempts++;

        let maxRetries = 3;
        if (entity.pathEnd) {
          const targetCoords = this.getCenter(entity.pathEnd.loc[0], entity.pathEnd.loc[1]);
          const distToTarget = entity.getDistance
            ? entity.getDistance({ x: targetCoords[0], y: targetCoords[1] })
            : this.getDistance([entity.x, entity.y], targetCoords);
          if (distToTarget < 384) {
            maxRetries = 8;
          }
        }

        if (entity.pathRecalcAttempts < maxRetries && entity.pathEnd) {
          const reason = isNextBlocked ? this.PATH_INVALIDATION_REASONS.BLOCKED : this.PATH_INVALIDATION_REASONS.STUCK;
          this.recordPathEvent(entity, reason, { next, z: entity.z, attempts: entity.pathRecalcAttempts });

          if (!entity.lastRecalcPosition) {
            entity.lastRecalcPosition = { x: entity.x, y: entity.y };
          }
          const distMoved = Math.sqrt(Math.pow(entity.x - entity.lastRecalcPosition.x, 2) + Math.pow(entity.y - entity.lastRecalcPosition.y, 2));

          if (!entity.nextRecalcTime) entity.nextRecalcTime = 0;
          const now = Date.now();
          const backoffDelay = entity.pathRecalcAttempts > 0 ? Math.min(1600, 100 * Math.pow(2, entity.pathRecalcAttempts - 1)) : 0;
          if (distMoved < 5 && now < entity.nextRecalcTime) {
            return true;
          }

          if (global.stuckEntityAnalytics) {
            global.stuckEntityAnalytics.recordStuckEvent(entity, next, reason, entity.pathRecalcAttempts, entity.z);
          }

          entity.lastRecalcPosition = { x: entity.x, y: entity.y };
          entity.nextRecalcTime = now + backoffDelay;
          entity.path = null;
          entity.pathCount = 0;
          entity.lastWaypoint = null;
          entity.waypointStuckCounter = 0;
          entity.waypointHistory = [];

          const intent = entity.moveIntent;
          if (intent) {
            this.requestPathForIntent(entity, intent);
          } else if (entity.getPath && entity.pathEnd) {
            entity.getPath(entity.pathEnd.z, entity.pathEnd.loc[0], entity.pathEnd.loc[1]);
          }
          return true;
        }

        if (global.stuckEntityAnalytics) {
          global.stuckEntityAnalytics.recordStuckEvent(entity, next, this.PATH_INVALIDATION_REASONS.GAVE_UP, entity.pathRecalcAttempts, entity.z);
          global.stuckEntityAnalytics.maybeLogStats();
        }
        this.recordPathEvent(entity, this.PATH_INVALIDATION_REASONS.GAVE_UP, { next, z: entity.z });

        let fallbackSuccessful = false;
        if (entity.pathEnd && !fallbackSuccessful && typeof entity.findNearestWalkableTile === 'function') {
          const nearbyWalkable = entity.findNearestWalkableTile(entity.pathEnd.loc[0], entity.pathEnd.loc[1], entity.pathEnd.z);
          if (nearbyWalkable) {
            entity.getPath(entity.pathEnd.z, nearbyWalkable[0], nearbyWalkable[1]);
            if (entity.path) {
              fallbackSuccessful = true;
              entity.pathRecalcAttempts = 0;
            }
          }
        }

        if (entity.action === 'home' && entity.home && !fallbackSuccessful && entity.class === 'Serf') {
          const getBuilding = global.getBuilding;
          const getTile = global.getTile;
          if (getBuilding && getTile && global.Building && global.Building.list) {
            const buildingId = getBuilding(this.getCenter(entity.home.loc[0], entity.home.loc[1])[0], this.getCenter(entity.home.loc[0], entity.home.loc[1])[1]);
            if (buildingId && global.Building.list[buildingId] && global.Building.list[buildingId].plot) {
              const building = global.Building.list[buildingId];
              for (const i in building.plot) {
                const plotTile = building.plot[i];
                const tile = getTile(0, plotTile[0], plotTile[1]);
                if (tile === 14 || tile === 16) {
                  if (plotTile[0] !== entity.home.loc[0] || plotTile[1] !== entity.home.loc[1]) {
                    entity.getPath(1, plotTile[0], plotTile[1] + 1);
                    if (entity.path) {
                      fallbackSuccessful = true;
                      entity.pathRecalcAttempts = 0;
                      break;
                    }
                  }
                }
              }
            }
          }
        }

        if (!fallbackSuccessful) {
          entity.path = null;
          entity.pathCount = 0;
          if (entity.action !== 'home') {
            entity.pathEnd = null;
          }
          if (entity.work && entity.work.spot && (entity.action === 'task' || entity.action === 'build') && entity.mode !== 'work') {
            entity.work.spot = null;
            entity.action = null;
          }
          entity.pathRecalcAttempts = 0;
          entity.lastWaypoint = null;
          entity.waypointStuckCounter = 0;
          entity.waypointHistory = [];
          entity.pathLocked = false;
          if (!entity.pathCooldown) entity.pathCooldown = 0;
          entity.pathCooldown = 90;
        }
        return true;
      } else if (entity.pathRecalcAttempts > 0 && this.isWalkable(entity.z, next[0], next[1], entity)) {
        entity.pathRecalcAttempts = 0;
        entity.nextRecalcTime = 0;
        entity.lastRecalcPosition = null;
      }

      const dest = this.getCenter(next[0], next[1]);
      const dx = dest[0];
      const dy = dest[1];
      const diffX = dx - entity.x;
      const diffY = dy - entity.y;

      entity.pressingRight = false;
      entity.pressingLeft = false;
      entity.pressingDown = false;
      entity.pressingUp = false;

      if (diffX >= entity.currentSpeed) {
        entity.x += entity.currentSpeed;
        entity.pressingRight = true;
        entity.facing = 'right';
      } else if (diffX <= (0 - entity.currentSpeed)) {
        entity.x -= entity.currentSpeed;
        entity.pressingLeft = true;
        entity.facing = 'left';
      }
      if (diffY >= entity.currentSpeed) {
        entity.y += entity.currentSpeed;
        entity.pressingDown = true;
        entity.facing = 'down';
      } else if (diffY <= (0 - entity.currentSpeed)) {
        entity.y -= entity.currentSpeed;
        entity.pressingUp = true;
        entity.facing = 'up';
      }

      if ((diffX < entity.currentSpeed && diffX > (0 - entity.currentSpeed)) && (diffY < entity.currentSpeed && diffY > (0 - entity.currentSpeed))) {
        entity.x = dx;
        entity.y = dy;
        entity.pressingRight = false;
        entity.pressingLeft = false;
        entity.pressingDown = false;
        entity.pressingUp = false;
        entity.pathCount++;
        if (entity.checkAggro) {
          entity.checkAggro();
        }
      }
    } else {
      if (entity.pathEnd) {
        const loc = this.getLoc(entity.x, entity.y);
        if (entity.z === entity.pathEnd.z && loc.toString() === entity.pathEnd.loc.toString()) {
          entity.pathEnd = null;
        }
      }
      entity.path = null;
      entity.pathCount = 0;
      entity.pathRecalcAttempts = 0;
      entity.lastWaypoint = null;
      entity.waypointStuckCounter = 0;
      entity.waypointHistory = [];
      entity.pathLocked = false;
      entity.skippedWaypointCount = 0;
      entity.pressingRight = false;
      entity.pressingLeft = false;
      entity.pressingDown = false;
      entity.pressingUp = false;
    }

    return true;
  }

  // ============================================================================
  // ENTITY MOVEMENT DELEGATION
  // ============================================================================

  /**
   * Move entity to target location (delegates to entity's moveTo if exists, otherwise handles directly)
   * This is a wrapper that can be called from Entity.js
   * @param {object} entity - Entity to move
   * @param {number} tz - Target Z level
   * @param {number} tc - Target column
   * @param {number} tr - Target row
   */
  moveTo(entity, tz, tc, tr) {
    // If entity has its own moveTo, delegate to it (for backward compatibility)
    if (entity.moveTo && typeof entity.moveTo === 'function') {
      return entity.moveTo(tz, tc, tr);
    }

    // Otherwise, handle movement here
    const loc = this.getLoc(entity.x, entity.y);
    
    // Early return if already at target
    if (loc[0] === tc && loc[1] === tr && tz === entity.z) {
      return;
    }

    // Clear path if z-level changed
    if (tz !== entity.z) {
      entity.path = null;
      entity.pathCount = 0;
      entity.pathEnd = null;
    }

    // Request path if needed
    if (loc[0] !== tc || loc[1] !== tr) {
      if (entity.shouldRequestPath && typeof entity.shouldRequestPath === 'function') {
        if (entity.shouldRequestPath(tz, tc, tr)) {
          this.getPathForEntity(entity, tz, tc, tr);
        }
      } else {
        this.getPathForEntity(entity, tz, tc, tr);
      }
    }

    // Update direction
    const dir = this.calcDir(loc, [tc, tr]);
    if (dir !== entity.lastDir) {
      entity.lastDir = dir;
    }

    // Handle movement based on direction
    this.executeMovement(entity, dir, loc, [tc, tr]);
    
    // Update stuck detection
    this.updateStuckDetection(entity);
    
    // Handle stuck recovery if needed
    if (this.updateStuckDetection(entity)) {
      this.handleStuckRecovery(entity);
    }
  }

  /**
   * Get path for entity (delegates to entity's getPath if exists)
   * @param {object} entity - Entity
   * @param {number} z - Z level
   * @param {number} c - Column
   * @param {number} r - Row
   */
  getPathForEntity(entity, z, c, r) {
    // If entity has its own getPath, delegate to it (for backward compatibility)
    if (entity.getPath && typeof entity.getPath === 'function') {
      return entity.getPath(z, c, r);
    }

    // Otherwise, use MovementSystem pathfinding
    const start = this.getLoc(entity.x, entity.y);
    const path = this.findPath(start, [c, r], z);
    
    if (path && path.length > 0) {
      entity.path = path;
      entity.pathCount = 0;
      entity.pathEnd = { z: z, loc: [c, r] };
    }
    
    return path;
  }

  /**
   * Execute movement based on direction
   * @param {object} entity - Entity to move
   * @param {string} dir - Direction code
   * @param {Array} loc - Current location [c, r]
   * @param {Array} tLoc - Target location [c, r]
   */
  executeMovement(entity, dir, loc, tLoc) {
    // Get offsets for direction
    const offset = this.getOffset(dir);
    const target = [loc[0] + offset[0], loc[1] + offset[1]];

    // Check if primary direction is walkable
    if (this.isWalkable(entity.z, target[0], target[1])) {
      this.move(entity, target);
      return;
    }

    // Try alternate directions
    const alternates = this.getAlternateDirections(dir);
    for (const altDir of alternates) {
      const altOffset = this.getOffset(altDir);
      const altTarget = [loc[0] + altOffset[0], loc[1] + altOffset[1]];
      
      if (this.isWalkable(entity.z, altTarget[0], altTarget[1])) {
        this.move(entity, altTarget);
        return;
      }
    }
  }

  /**
   * Move entity to a tile location
   * @param {object} entity - Entity to move
   * @param {Array} target - Target tile [c, r]
   */
  move(entity, target) {
    // If entity has its own move method, use it
    if (entity.move && typeof entity.move === 'function') {
      return entity.move(target);
    }

    // Otherwise, update position directly
    const getCoords = global.getCoords || ((c, r) => [c * 64, r * 64]);
    const coords = getCoords(target[0], target[1]);
    
    entity.x = coords[0];
    entity.y = coords[1];
    
    // Update facing direction
    const loc = this.getLoc(entity.x, entity.y);
    if (entity.prevLoc) {
      const dx = loc[0] - entity.prevLoc[0];
      const dy = loc[1] - entity.prevLoc[1];
      
      if (dy < 0) entity.facing = 'up';
      else if (dy > 0) entity.facing = 'down';
      else if (dx < 0) entity.facing = 'left';
      else if (dx > 0) entity.facing = 'right';
    }
    
    entity.prevLoc = loc;
  }

  /**
   * Move entity toward a target entity
   * @param {object} entity - Entity to move
   * @param {object} target - Target entity
   * @param {boolean} attack - Whether this is for attack
   */
  moveTowardTarget(entity, target, attack = false) {
    if (!target || !target.x || !target.y) {
      return false;
    }

    // Check if on different z-level
    if (entity.z !== target.z) {
      if (entity.lastTarget) {
        this.moveTo(entity, entity.lastTarget.z, entity.lastTarget.loc[0], entity.lastTarget.loc[1]);
      }
      return false;
    }

    const loc = this.getLoc(entity.x, entity.y);
    const tLoc = this.getLoc(target.x, target.y);

    // Check if adjacent
    const adjacent = [
      [tLoc[0], tLoc[1] + 1],
      [tLoc[0], tLoc[1] - 1],
      [tLoc[0] + 1, tLoc[1]],
      [tLoc[0] - 1, tLoc[1]]
    ];

    const isAdjacent = adjacent.some(adj => adj[0] === loc[0] && adj[1] === loc[1]);

    if (isAdjacent) {
      return true; // Already adjacent
    }

    // Store last target
    entity.lastTarget = tLoc;

    // Calculate direction and move
    const dir = this.calcDir(loc, tLoc);
    if (dir !== entity.lastDir) {
      entity.lastDir = dir;
    }

    this.executeMovement(entity, dir, loc, tLoc);
    return true;
  }

  /**
   * Follow a target entity
   * @param {object} entity - Entity to move
   * @param {object} target - Target entity
   * @param {boolean} attack - Whether this is for attack
   */
  follow(entity, target, attack = false) {
    if (!entity.path) {
      if (entity.z !== target.z && entity.lastTarget) {
        this.moveTo(entity, entity.lastTarget.z, entity.lastTarget.loc[0], entity.lastTarget.loc[1]);
      } else {
        return this.moveTowardTarget(entity, target, attack);
      }
    }

    // Follow path if exists
    if (entity.path && entity.path.length > 0) {
      if (entity.pathCount < entity.path.length) {
        const nextStep = entity.path[entity.pathCount];
        if (Array.isArray(nextStep) && nextStep.length >= 2) {
          this.move(entity, [nextStep[0], nextStep[1]]);
          entity.pathCount++;
        }
      }
    }

    return true;
  }
}

// Export singleton instance
const movementSystem = new MovementSystem();
module.exports = movementSystem;