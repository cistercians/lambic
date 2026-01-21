// ============================================================================
// EVENT MANAGER - Standardized Event Communication System
// ============================================================================
// Centralizes all game event logging and communication
// Replaces ad-hoc console.log and chat message patterns

class EventManager {
  constructor() {
    // Event history - ring buffer for recent events
    this.historySize = 1000;
    this.eventHistory = [];
    this.historyIndex = 0;
    
    // Batched logging - flush every 100ms
    this.logBuffer = [];
    this.logFlushInterval = 100; // ms
    this.lastFlush = Date.now();
    
    // Automatic cleanup of old events (every 5 minutes)
    this.cleanupInterval = 300000; // 5 minutes
    this.eventTTL = 600000; // 10 minutes - events older than this are considered stale
    this.lastCleanup = Date.now();
    
    // Event categories
    this.categories = {
      ECONOMIC: 'Economic',
      BUILDING: 'Building',
      COMBAT: 'Combat',
      ENVIRONMENT: 'Environment',
      SOCIAL: 'Social',
      DEATH: 'Death',
      STEALTH: 'Stealth',
      FACTION: 'Faction',
      MILITARY: 'Military',
      ITEM: 'Item',
      AI: 'AI'
    };
    
    // Communication modes
    this.commModes = {
      NONE: 'None',
      PLAYER: 'Player',
      HOUSE: 'House',
      AREA: 'Area',
      GLOBAL: 'Global',
      SPECTATOR: 'Spectator'
    };
    
    // Start flush timer
    this.startFlushTimer();
    
    // Start cleanup timer
    this.startCleanupTimer();
    
    // Event subscribers (for AI systems, etc.)
    this.subscribers = new Map();
  }
  
  // ============================================================================
  // CORE EVENT CREATION
  // ============================================================================
  
  createEvent(eventData) {
    const event = {
      id: Math.random(),
      timestamp: Date.now(),
      category: eventData.category || this.categories.SOCIAL,
      subject: eventData.subject || null,
      subjectName: eventData.subjectName || null,
      action: eventData.action || 'unknown action',
      target: eventData.target || null,
      targetName: eventData.targetName || null,
      quantity: eventData.quantity || null,
      owner: eventData.owner || null,
      ownerName: eventData.ownerName || null,
      house: eventData.house || null,
      houseName: eventData.houseName || null,
      communication: eventData.communication || this.commModes.NONE,
      message: eventData.message || null,
      log: eventData.log || null,
      position: eventData.position || null, // {x, y, z}
      metadata: eventData.metadata || {} // Extra data for specific event types
    };
    
    // Add to history buffer
    this.addToHistory(event);
    
    // Handle logging (batched)
    const structuredLog = this._formatEventLog(event);
    if (structuredLog) {
      this.logBuffer.push(structuredLog);
    }
    if (event.log) {
      this.logBuffer.push(event.log);
    }
    
    // Handle communication (immediate)
    this.communicate(event);
    
    // Notify subscribers
    this.notifySubscribers(event);
    
    return event;
  }

  _formatEventLog(event) {
    if (!event) return null;
    const payload = {
      id: event.id,
      ts: event.timestamp,
      category: event.category,
      action: event.action,
      subject: event.subject,
      subjectName: event.subjectName,
      target: event.target,
      targetName: event.targetName,
      quantity: event.quantity,
      house: event.house,
      houseName: event.houseName,
      position: event.position,
      metadata: this._safeSerialize(event.metadata)
    };
    try {
      return `[EVENT] ${JSON.stringify(payload)}`;
    } catch (error) {
      return `[EVENT] ${String(payload.action || 'event')}`;
    }
  }

  _safeSerialize(value) {
    if (value === null || value === undefined) return value;
    try {
      JSON.stringify(value);
      return value;
    } catch (error) {
      return String(value);
    }
  }
  
  // ============================================================================
  // HISTORY MANAGEMENT
  // ============================================================================
  
  addToHistory(event) {
    // Ring buffer - overwrite oldest events
    this.eventHistory[this.historyIndex] = event;
    this.historyIndex = (this.historyIndex + 1) % this.historySize;
  }
  
  getEventsByCategory(category, timeWindow = 60000) {
    const cutoff = Date.now() - timeWindow;
    return this.eventHistory.filter(e => 
      e && e.category === category && e.timestamp >= cutoff
    );
  }
  
  getEventsBySubject(subjectId, timeWindow = 60000) {
    const cutoff = Date.now() - timeWindow;
    return this.eventHistory.filter(e => 
      e && e.subject === subjectId && e.timestamp >= cutoff
    );
  }
  
  getEventsByPosition(x, y, z, radius, timeWindow = 60000) {
    const cutoff = Date.now() - timeWindow;
    const radiusSquared = radius * radius;
    
    return this.eventHistory.filter(e => {
      if (!e || !e.position || e.timestamp < cutoff) return false;
      if (e.position.z !== z) return false;
      
      const dx = e.position.x - x;
      const dy = e.position.y - y;
      const distSquared = dx * dx + dy * dy;
      
      return distSquared <= radiusSquared;
    });
  }
  
  getEventStats(timeWindow = 60000) {
    const cutoff = Date.now() - timeWindow;
    const recentEvents = this.eventHistory.filter(e => e && e.timestamp >= cutoff);
    
    const stats = {
      total: recentEvents.length,
      byCategory: {},
      combatHotspots: [],
      economicActivity: 0,
      deaths: 0
    };
    
    // Count by category
    for (const cat in this.categories) {
      stats.byCategory[this.categories[cat]] = 0;
    }
    
    recentEvents.forEach(event => {
      stats.byCategory[event.category] = (stats.byCategory[event.category] || 0) + 1;
      
      if (event.category === this.categories.COMBAT) {
        // Track combat locations
        if (event.position) {
          const key = `${Math.floor(event.position.x / 512)},${Math.floor(event.position.y / 512)}`;
          const hotspot = stats.combatHotspots.find(h => h.key === key);
          if (hotspot) {
            hotspot.count++;
          } else {
            stats.combatHotspots.push({ key, count: 1, x: event.position.x, y: event.position.y, z: event.position.z });
          }
        }
      }
      
      if (event.category === this.categories.ECONOMIC) {
        stats.economicActivity++;
      }
      
      if (event.category === this.categories.DEATH) {
        stats.deaths++;
      }
    });
    
    // Sort hotspots by activity
    stats.combatHotspots.sort((a, b) => b.count - a.count);
    
    return stats;
  }
  
  // ============================================================================
  // COMMUNICATION
  // ============================================================================
  
  communicate(event) {
    if (!event.message || event.communication === this.commModes.NONE) {
      return;
    }
    
    // Handle multiple communication modes (array or single mode)
    const modes = Array.isArray(event.communication) ? event.communication : [event.communication];
    
    for (const mode of modes) {
      switch (mode) {
        case this.commModes.PLAYER:
          this.sendToPlayer(event);
          break;
        case this.commModes.HOUSE:
          this.sendToHouse(event);
          break;
        case this.commModes.AREA:
          this.sendToArea(event);
          break;
        case this.commModes.GLOBAL:
          this.sendToAll(event);
          break;
        case this.commModes.SPECTATOR:
          this.sendToSpectators(event);
          break;
      }
    }
  }
  
  sendToPlayer(event) {
    if (!event.subject || !global.SOCKET_LIST) return;
    
    const socket = global.SOCKET_LIST[event.subject];
    if (socket) {
      socket.write(JSON.stringify({
        msg: 'addToChat',
        message: event.message
      }));
    }
  }
  
  sendToHouse(event) {
    if (!event.house || !global.Player || !global.SOCKET_LIST) return;
    
    // Send to all house members
    for (const id in global.Player.list) {
      const player = global.Player.list[id];
      if (player.house === event.house && player.type === 'player') {
        const socket = global.SOCKET_LIST[id];
        if (socket) {
          socket.write(JSON.stringify({
            msg: 'addToChat',
            message: event.message
          }));
        }
      }
    }
  }
  
  sendToArea(event) {
    if (!event.position || !global.Player || !global.SOCKET_LIST) return;
    
    const areaRadius = 768; // ~12 tiles
    const radiusSquared = areaRadius * areaRadius;
    
    // Send to all players in range
    for (const id in global.Player.list) {
      const player = global.Player.list[id];
      if (player.type === 'player' && player.z === event.position.z) {
        const dx = player.x - event.position.x;
        const dy = player.y - event.position.y;
        const distSquared = dx * dx + dy * dy;
        
        if (distSquared <= radiusSquared) {
          const socket = global.SOCKET_LIST[id];
          if (socket) {
            socket.write(JSON.stringify({
              msg: 'addToChat',
              message: event.message
            }));
          }
        }
      }
    }
  }
  
  sendToAll(event) {
    if (!global.SOCKET_LIST) return;
    
    // Broadcast to all connected players
    for (const id in global.SOCKET_LIST) {
      const socket = global.SOCKET_LIST[id];
      if (socket) {
        socket.write(JSON.stringify({
          msg: 'addToChat',
          message: event.message
        }));
      }
    }
  }
  
  sendToSpectators(event) {
    if (!global.spectators || !global.SOCKET_LIST) return;
    
    // Send to all spectators
    for (const id in global.spectators) {
      const socket = global.SOCKET_LIST[id];
      if (socket) {
        // Send as both chat message and structured event data
        if (event.message) {
          socket.write(JSON.stringify({
            msg: 'addToChat',
            message: event.message
          }));
        }
        
        socket.write(JSON.stringify({
          msg: 'spectatorEvent',
          event: {
            category: event.category,
            subject: event.subject,
            subjectName: event.subjectName,
            action: event.action,
            target: event.target,
            targetName: event.targetName,
            position: event.position,
            timestamp: event.timestamp
          }
        }));
      }
    }
  }
  
  // ============================================================================
  // LOGGING
  // ============================================================================
  
  startFlushTimer() {
    if (this.flushTimerId) {
      clearInterval(this.flushTimerId);
    }
    this.flushTimerId = setInterval(() => {
      this.flushLogs();
    }, this.logFlushInterval);
  }
  
  stopFlushTimer() {
    if (this.flushTimerId) {
      clearInterval(this.flushTimerId);
      this.flushTimerId = null;
    }
  }
  
  // Start cleanup timer for old events
  startCleanupTimer() {
    if (this.cleanupTimerId) {
      clearInterval(this.cleanupTimerId);
    }
    this.cleanupTimerId = setInterval(() => {
      this.cleanupOldEvents();
    }, this.cleanupInterval);
  }
  
  // Stop cleanup timer
  stopCleanupTimer() {
    if (this.cleanupTimerId) {
      clearInterval(this.cleanupTimerId);
      this.cleanupTimerId = null;
    }
  }
  
  // Cleanup old events from history
  cleanupOldEvents() {
    const now = Date.now();
    const cutoff = now - this.eventTTL;
    let cleaned = 0;
    
    // Clean up old events in the ring buffer
    for (let i = 0; i < this.eventHistory.length; i++) {
      const event = this.eventHistory[i];
      if (event && event.timestamp < cutoff) {
        this.eventHistory[i] = null; // Mark as null instead of deleting to maintain ring buffer structure
        cleaned++;
      }
    }
    
    // If we cleaned a significant number, log it
    if (cleaned > 0) {
      const activeEvents = this.eventHistory.filter(e => e !== null).length;
      console.log(`🧹 EventManager: Cleaned ${cleaned} old events (${activeEvents}/${this.historySize} active)`);
    }
    
    this.lastCleanup = now;
  }
  
  // Cleanup method to properly shut down EventManager
  cleanup() {
    this.stopFlushTimer();
    this.stopCleanupTimer();
    this.flushLogs(); // Flush any remaining logs
    this.subscribers.clear();
    this.eventHistory = [];
    this.logBuffer = [];
    console.log('EventManager cleaned up');
  }
  
  flushLogs() {
    if (this.logBuffer.length === 0) return;
    
    // Batch output to console
    const logs = this.logBuffer.join('\n');
    console.log(logs);
    
    this.logBuffer = [];
    this.lastFlush = Date.now();
  }
  
  // Force immediate log flush (for critical events)
  forceFlush() {
    this.flushLogs();
  }
  
  // ============================================================================
  // EVENT SUBSCRIPTIONS (for AI systems)
  // ============================================================================
  
  subscribe(subscriberId, categories, callback) {
    if (!this.subscribers.has(subscriberId)) {
      this.subscribers.set(subscriberId, []);
    }
    
    this.subscribers.get(subscriberId).push({
      categories: Array.isArray(categories) ? categories : [categories],
      callback
    });
  }
  
  unsubscribe(subscriberId) {
    this.subscribers.delete(subscriberId);
  }
  
  notifySubscribers(event) {
    for (const [subscriberId, subscriptions] of this.subscribers) {
      for (const sub of subscriptions) {
        if (sub.categories.includes(event.category)) {
          try {
            sub.callback(event);
          } catch (err) {
            console.error(`Error in event subscriber ${subscriberId}:`, err);
          }
        }
      }
    }
  }
  
  // ============================================================================
  // HELPER METHODS - Convenient event creators
  // ============================================================================
  
  // Combat events
  combatAttack(attacker, target, damage, position) {
    return this.createEvent({
      category: this.categories.COMBAT,
      subject: attacker.id,
      subjectName: attacker.name || attacker.class,
      action: `dealt ${damage} damage`,
      target: target.id,
      targetName: target.name || target.class,
      quantity: damage,
      communication: this.commModes.SPECTATOR,
      message: `<span style="color:#ff6666;">${attacker.name || attacker.class} attacked ${target.name || target.class} for ${damage} damage!</span>`,
      log: `[COMBAT] ${attacker.name || attacker.class} attacked ${target.name || target.class} for ${damage} damage at [${Math.floor(position.x)},${Math.floor(position.y)}] z=${position.z}`,
      position
    });
  }
  
  death(victim, killer, position) {
    return this.createEvent({
      category: this.categories.DEATH,
      subject: victim.id,
      subjectName: victim.name || victim.class,
      action: 'died',
      target: killer ? killer.id : null,
      targetName: killer ? (killer.name || killer.class) : 'unknown',
      communication: [this.commModes.AREA, this.commModes.SPECTATOR],
      message: killer 
        ? `<span style="color:#ff0000;">💀 ${victim.name || victim.class} was slain by ${killer.name || killer.class}!</span>`
        : `<span style="color:#ff0000;">💀 ${victim.name || victim.class} has died!</span>`,
      log: `[DEATH] ${victim.name || victim.class} ${killer ? `killed by ${killer.name || killer.class}` : 'died'} at [${Math.floor(position.x)},${Math.floor(position.y)}] z=${position.z}`,
      position
    });
  }
  
  combatEscape(escapee, enemy, position) {
    return this.createEvent({
      category: this.categories.COMBAT,
      subject: escapee.id,
      subjectName: escapee.name || escapee.class,
      action: 'escaped from combat',
      target: enemy ? enemy.id : null,
      targetName: enemy ? (enemy.name || enemy.class) : null,
      communication: this.commModes.PLAYER,
      message: `<i>You escaped from combat.</i>`,
      log: `[COMBAT] ${escapee.name || escapee.class} escaped from ${enemy ? (enemy.name || enemy.class) : 'combat'}`,
      position
    });
  }
  
  // Military events
  militaryUnitRecruited(unitClass, houseName, houseId, position) {
    return this.createEvent({
      category: this.categories.MILITARY,
      action: 'recruited',
      targetName: unitClass,
      house: houseId,
      houseName: houseName,
      communication: [this.commModes.HOUSE, this.commModes.AREA],
      message: `<span style="color:#4488ff;">⚔️ ${houseName} recruited a ${unitClass}!</span>`,
      log: `[MILITARY] ${houseName} recruited ${unitClass} at [${Math.floor(position.x)},${Math.floor(position.y)}] z=${position.z}`,
      position
    });
  }
  
  minibossUpgrade(entity, killCount, newScale, position) {
    const bossType = killCount >= 10 ? 'boss' : 'miniboss';
    return this.createEvent({
      category: this.categories.COMBAT,
      subject: entity.id,
      subjectName: entity.name || entity.class,
      action: 'became miniboss',
      quantity: killCount,
      communication: [this.commModes.AREA, this.commModes.SPECTATOR],
      message: `<span style="color:#ff8800;">⚠️ ${entity.name || entity.class} has become a ${bossType} with ${killCount} kills!</span>`,
      log: `[MINIBOSS] ${entity.name || entity.class} upgraded to miniboss with ${killCount} kills (size: ${newScale}x) at [${Math.floor(position.x)},${Math.floor(position.y)}] z=${position.z}`,
      position
    });
  }
  
  // Economic events
  resourceGathered(gatherer, resourceType, quantity, position) {
    return this.createEvent({
      category: this.categories.ECONOMIC,
      subject: gatherer.id,
      subjectName: gatherer.name || gatherer.class,
      action: `gathered ${resourceType}`,
      quantity,
      communication: this.commModes.NONE,
      log: `[ECONOMIC] ${gatherer.name || gatherer.class} gathered ${quantity} ${resourceType}`,
      position
    });
  }
  
  // Serf spawning events
  serfSpawnTallyStart(building, currentSerfs, availableSpots) {
    const house = building.house ? (global.House && global.House.list && global.House.list[building.house]) : null;
    return this.createEvent({
      category: this.categories.ECONOMIC,
      subject: building.id,
      subjectName: building.type,
      action: 'serf spawn tally started',
      house: building.house,
      houseName: house ? house.name : null,
      communication: this.commModes.NONE,
      log: `[ECONOMIC] ${building.type}#${building.id} tally: ${currentSerfs} serfs, ${availableSpots} work spots`,
      position: { x: building.x, y: building.y, z: building.z || 0 },
      metadata: {
        currentSerfs,
        availableWorkSpots: availableSpots,
        buildingType: building.type
      }
    });
  }

  serfSpawnDecision(building, decision, reason, metadata = {}) {
    const house = building.house ? (global.House && global.House.list && global.House.list[building.house]) : null;
    return this.createEvent({
      category: this.categories.ECONOMIC,
      subject: building.id,
      subjectName: building.type,
      action: 'serf spawn decision',
      house: building.house,
      houseName: house ? house.name : null,
      communication: this.commModes.NONE,
      log: `[ECONOMIC] ${building.type}#${building.id} decision: ${decision}${reason ? ` (${reason})` : ''}`,
      position: { x: building.x, y: building.y, z: building.z || 0 },
      metadata: Object.assign({
        decision,
        reason
      }, metadata)
    });
  }

  serfSpawnAttempt(building, spawnCount, method, metadata = {}) {
    const house = building.house ? (global.House && global.House.list && global.House.list[building.house]) : null;
    return this.createEvent({
      category: this.categories.ECONOMIC,
      subject: building.id,
      subjectName: building.type,
      action: 'serf spawn attempt',
      house: building.house,
      houseName: house ? house.name : null,
      quantity: spawnCount,
      communication: this.commModes.NONE,
      log: `[ECONOMIC] ${building.type}#${building.id} attempting to spawn ${spawnCount} serf(s) via ${method}`,
      position: { x: building.x, y: building.y, z: building.z || 0 },
      metadata: Object.assign({
        spawnCount,
        spawnMethod: method
      }, metadata)
    });
  }

  serfSpawned(building, serfIds, spawnCount, metadata = {}) {
    const house = building.house ? (global.House && global.House.list && global.House.list[building.house]) : null;
    return this.createEvent({
      category: this.categories.ECONOMIC,
      subject: building.id,
      subjectName: building.type,
      action: 'serfs spawned',
      house: building.house,
      houseName: house ? house.name : null,
      quantity: spawnCount,
      communication: this.commModes.NONE,
      log: `[ECONOMIC] ${building.type}#${building.id} spawned ${spawnCount} serf(s)`,
      position: { x: building.x, y: building.y, z: building.z || 0 },
      metadata: Object.assign({
        serfIds: Array.isArray(serfIds) ? serfIds : [serfIds],
        spawnCount
      }, metadata)
    });
  }

  serfSpawnFailed(building, reason, metadata = {}) {
    const house = building.house ? (global.House && global.House.list && global.House.list[building.house]) : null;
    return this.createEvent({
      category: this.categories.ECONOMIC,
      subject: building.id,
      subjectName: building.type,
      action: 'serf spawn failed',
      house: building.house,
      houseName: house ? house.name : null,
      communication: this.commModes.NONE,
      log: `[ECONOMIC] ${building.type}#${building.id} spawn failed: ${reason}`,
      position: { x: building.x, y: building.y, z: building.z || 0 },
      metadata: Object.assign({
        reason
      }, metadata)
    });
  }
  
  // Building events
  buildingCompleted(building, owner, position) {
    return this.createEvent({
      category: this.categories.BUILDING,
      subject: building.id,
      subjectName: building.type,
      action: 'completed',
      owner: owner ? owner.id : null,
      ownerName: owner ? (owner.name || owner.class) : null,
      house: building.house,
      communication: owner ? this.commModes.PLAYER : this.commModes.SPECTATOR,
      message: owner ? `<span style="color:#66ff66;">ℹ️ Your ${building.type} is complete!</span>` : `<span style="color:#66ff66;">🏗️ ${building.type} completed!</span>`,
      log: `[BUILDING] ${building.type}${owner ? ` owned by ${owner.name || owner.class}` : ''} completed at [${Math.floor(position.x)},${Math.floor(position.y)}]`,
      position
    });
  }

  buildingStarted(builder, buildingType, position, metadata = {}) {
    return this.createEvent({
      category: this.categories.BUILDING,
      subject: builder ? builder.id : null,
      subjectName: builder ? (builder.name || builder.class) : null,
      action: `started ${buildingType}`,
      communication: this.commModes.NONE,
      position,
      metadata
    });
  }

  buildingFailed(builder, buildingType, reason, position, metadata = {}) {
    return this.createEvent({
      category: this.categories.BUILDING,
      subject: builder ? builder.id : null,
      subjectName: builder ? (builder.name || builder.class) : null,
      action: `failed ${buildingType}`,
      communication: this.commModes.NONE,
      position,
      metadata: Object.assign({ reason }, metadata)
    });
  }
  
  // Environment events
  dayNightTransition(newState, isNight) {
    return this.createEvent({
      category: this.categories.ENVIRONMENT,
      action: newState,
      communication: this.commModes.GLOBAL,
      message: isNight 
        ? `<span style="color:#6666ff;">🌙 The sun has set... nightfall is here.</span>`
        : `<span style="color:#ffff66;">☀️ Dawn breaks across the land.</span>`,
      log: `[ENVIRONMENT] ${newState}`
    });
  }
  
  // Item events
  itemDropped(item, dropper, position) {
    return this.createEvent({
      category: this.categories.ITEM,
      subject: dropper ? dropper.id : null,
      subjectName: dropper ? (dropper.name || dropper.class) : null,
      action: `dropped ${item.type}`,
      quantity: item.qty,
      communication: this.commModes.NONE,
      log: `[ITEM] ${item.type} (${item.qty}) dropped${dropper ? ` by ${dropper.name || dropper.class}` : ''} at [${Math.floor(position.x)},${Math.floor(position.y)}] z=${position.z}`,
      position
    });
  }
  
  itemPickedUp(item, picker, position) {
    return this.createEvent({
      category: this.categories.ITEM,
      subject: picker.id,
      subjectName: picker.name || picker.class,
      action: `picked up ${item.type}`,
      quantity: item.qty,
      communication: this.commModes.NONE,
      log: `[ITEM] ${picker.name || picker.class} picked up ${item.type} (${item.qty})`,
      position
    });
  }
  
  // Time/Environment events
  hourChange(newTempus, day) {
    return this.createEvent({
      category: this.categories.ENVIRONMENT,
      action: 'hour change',
      quantity: day,
      communication: this.commModes.NONE,
      message: null,
      log: `[TEMPUS] Day ${day}, Hour: ${newTempus}`,
      metadata: { tempus: newTempus, day }
    });
  }
  
  dailyRecap(day, populationBefore, changes) {
    // Build population breakdown message
    const popBreakdown = `Players: ${populationBefore.players}, NPCs: ${populationBefore.npcs}, Fauna: ${populationBefore.fauna}`;
    
    // Build changes summary
    const changesParts = [];
    if (changes.tilesChanged > 0) {
      changesParts.push(`${changes.tilesChanged} tiles changed by entropy`);
    }
    if (changes.faunaAdded > 0) {
      changesParts.push(`${changes.faunaAdded} fauna added`);
    }
    if (changes.serfsAdded && Object.keys(changes.serfsAdded).length > 0) {
      const serfParts = [];
      for (const houseName in changes.serfsAdded) {
        if (changes.serfsAdded[houseName] > 0) {
          serfParts.push(`${houseName}: ${changes.serfsAdded[houseName]}`);
        }
      }
      if (serfParts.length > 0) {
        changesParts.push(`Serfs added: ${serfParts.join(', ')}`);
      }
    }
    if (changes.militaryUnitsAdded && Object.keys(changes.militaryUnitsAdded).length > 0) {
      const militaryParts = [];
      for (const houseName in changes.militaryUnitsAdded) {
        if (changes.militaryUnitsAdded[houseName] > 0) {
          militaryParts.push(`${houseName}: ${changes.militaryUnitsAdded[houseName]}`);
        }
      }
      if (militaryParts.length > 0) {
        changesParts.push(`Military units added: ${militaryParts.join(', ')}`);
      }
    }
    
    const changesSummary = changesParts.length > 0 
      ? `Changes: ${changesParts.join('; ')}`
      : 'No changes';
    
    const logMessage = `[DAILY RECAP] Day ${day} - ${popBreakdown}. ${changesSummary}`;
    
    return this.createEvent({
      category: this.categories.ENVIRONMENT,
      action: 'daily recap',
      quantity: day,
      communication: this.commModes.NONE,
      message: null,
      log: logMessage,
      metadata: {
        day,
        populationBefore,
        changes
      }
    });
  }

  aiEvent(action, data = {}) {
    return this.createEvent(Object.assign({
      category: this.categories.AI,
      action,
      communication: this.commModes.NONE
    }, data));
  }

  battlegroundEvent(action, data = {}) {
    return this.createEvent(Object.assign({
      category: this.categories.ENVIRONMENT,
      action,
      communication: this.commModes.NONE
    }, data));
  }

  pathfindingEvent(action, data = {}) {
    return this.aiEvent(action, data);
  }

  validationEvent(action, data = {}) {
    return this.aiEvent(action, data);
  }
}

module.exports = EventManager;

