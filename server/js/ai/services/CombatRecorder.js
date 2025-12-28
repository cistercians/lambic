// Combat Recorder Service
// Tracks combat events (kills/deaths) for faction AI military intelligence

class CombatRecorder {
  constructor(house, factionAI) {
    this.house = house;
    this.factionAI = factionAI;
    this.combatEvents = []; // Array of combat events
    this.subscriberId = `combat_recorder_${house.id}`;
    
    // Subscribe to EventManager DEATH events
    if (global.eventManager) {
      const subscribed = global.eventManager.subscribe(
        this.subscriberId,
        global.eventManager.categories.DEATH,
        this.onDeathEvent.bind(this)
      );
      
      // Diagnostic logging (once per faction)
      const factionName = house?.name || 'Unknown';
      if (subscribed) {
        console.log(`[COMBAT RECORDER] ${factionName}: Successfully subscribed to DEATH events`);
      } else {
        console.log(`[COMBAT RECORDER] ${factionName}: Failed to subscribe to DEATH events`);
      }
    } else {
      const factionName = house?.name || 'Unknown';
      console.log(`[COMBAT RECORDER] ${factionName}: global.eventManager is not available`);
    }
  }
  
  /**
   * Handle death event from EventManager
   * @param {Object} event - Death event from EventManager
   */
  onDeathEvent(event) {
    // Diagnostic: log all death events (throttled to avoid spam)
    if (!this._eventLogThrottle) {
      this._eventLogThrottle = { lastLog: 0, eventCount: 0 };
    }
    this._eventLogThrottle.eventCount++;
    
    const now = Date.now();
    const LOG_THROTTLE_MS = 10000; // Log every 10 seconds
    const shouldLog = (now - this._eventLogThrottle.lastLog) > LOG_THROTTLE_MS;
    
    if (!event || !event.subject || !event.target) {
      if (shouldLog) {
        const factionName = this.house?.name || 'Unknown';
        console.log(`[COMBAT RECORDER] ${factionName}: Received invalid death event (missing subject/target). Total events received: ${this._eventLogThrottle.eventCount}`);
        this._eventLogThrottle.lastLog = now;
        this._eventLogThrottle.eventCount = 0;
      }
      return; // Need both victim and killer
    }
    
    // Get victim and killer units
    const victim = global.Player && global.Player.list ? global.Player.list[event.subject] : null;
    const killer = event.target ? (global.Player && global.Player.list ? global.Player.list[event.target] : null) : null;
    
    if (!victim || !event.position) {
      if (shouldLog) {
        const factionName = this.house?.name || 'Unknown';
        console.log(`[COMBAT RECORDER] ${factionName}: Received death event but victim/position invalid. Total events received: ${this._eventLogThrottle.eventCount}`);
        this._eventLogThrottle.lastLog = now;
        this._eventLogThrottle.eventCount = 0;
      }
      return; // Need valid victim and position
    }
    
    // Check if victim belongs to our faction
    const isOurVictim = victim.house === this.house.id;
    // Check if killer belongs to our faction
    const isOurKiller = killer && killer.house === this.house.id;
    
    // Record event if it involves our faction
    if (isOurVictim || isOurKiller) {
      this.recordCombatEvent(victim, killer, event.position, isOurKiller);
      
      if (shouldLog) {
        const factionName = this.house?.name || 'Unknown';
        const eventType = isOurKiller ? 'kill' : 'death';
        console.log(`[COMBAT RECORDER] ${factionName}: Recorded ${eventType} event (our ${eventType}). Total events received: ${this._eventLogThrottle.eventCount}, total recorded: ${this.combatEvents.length}`);
        this._eventLogThrottle.lastLog = now;
        this._eventLogThrottle.eventCount = 0;
      }
    }
  }
  
  /**
   * Record a combat event (kill or death)
   * @param {Object} victim - The unit that died
   * @param {Object} killer - The unit that killed (null if no killer)
   * @param {Object} position - {x, y, z} position of death
   * @param {Boolean} isOurKill - True if our faction got the kill
   */
  recordCombatEvent(victim, killer, position, isOurKill) {
    const day = global.day || 1;
    const loc = global.getLoc ? global.getLoc(position.x, position.y) : null;
    
    // Determine zone
    let zoneId = null;
    if (global.zoneManager && loc && Array.isArray(loc)) {
      const zone = global.zoneManager.getZoneAt(loc);
      if (zone && zone.id) {
        zoneId = zone.id;
      }
    }
    
    // Classify enemy type
    let enemyType = 'unknown';
    let enemyHouseId = null;
    let enemyHouseName = null;
    
    if (isOurKill && victim) {
      // We killed someone - classify the victim
      if (victim.house && victim.house !== this.house.id) {
        // Victim belongs to another faction
        enemyType = 'faction';
        enemyHouseId = victim.house;
        if (global.House && global.House.list) {
          const enemyHouse = global.House.list[victim.house];
          enemyHouseName = enemyHouse ? enemyHouse.name : null;
        }
      } else if (victim.class) {
        // Check if victim is fauna
        const animalClasses = ['Wolf', 'Deer', 'Boar', 'Sheep', 'Falcon'];
        if (animalClasses.includes(victim.class)) {
          enemyType = 'fauna';
        } else {
          // Humanoid but no house or same house = neutral
          enemyType = 'neutral';
        }
      }
    } else if (!isOurKill && killer) {
      // We were killed - classify the killer
      if (killer.house && killer.house !== this.house.id) {
        // Killer belongs to another faction
        enemyType = 'faction';
        enemyHouseId = killer.house;
        if (global.House && global.House.list) {
          const enemyHouse = global.House.list[killer.house];
          enemyHouseName = enemyHouse ? enemyHouse.name : null;
        }
      } else if (killer.class) {
        // Check if killer is fauna
        const animalClasses = ['Wolf', 'Deer', 'Boar', 'Sheep', 'Falcon'];
        if (animalClasses.includes(killer.class)) {
          enemyType = 'fauna';
        } else {
          // Humanoid but no house or same house = neutral
          enemyType = 'neutral';
        }
      }
    }
    
    // Create combat event
    const combatEvent = {
      timestamp: Date.now(),
      day: day,
      location: loc || [Math.floor(position.x / 64), Math.floor(position.y / 64), position.z || 0],
      zoneId: zoneId,
      eventType: isOurKill ? 'kill' : 'death',
      ourUnitId: isOurKill ? (killer ? killer.id : null) : (victim ? victim.id : null),
      ourUnitClass: isOurKill ? (killer ? killer.class : null) : (victim ? victim.class : null),
      enemyId: isOurKill ? (victim ? victim.id : null) : (killer ? killer.id : null),
      enemyClass: isOurKill ? (victim ? victim.class : null) : (killer ? killer.class : null),
      enemyType: enemyType,
      enemyHouseId: enemyHouseId,
      enemyHouseName: enemyHouseName
    };
    
    this.combatEvents.push(combatEvent);
    
    // Keep only last 1000 events (prevent memory bloat)
    if (this.combatEvents.length > 1000) {
      this.combatEvents = this.combatEvents.slice(-1000);
    }
  }
  
  /**
   * Get daily combat recap for a specific day
   * @param {Number} day - The day to get recap for
   * @returns {Object} Combat statistics for the day
   */
  getDailyRecap(day) {
    const dayEvents = this.combatEvents.filter(e => e.day === day);
    
    // Diagnostic: log recap generation (throttled)
    if (!this._recapLogThrottle) {
      this._recapLogThrottle = { lastLogDay: 0 };
    }
    if (day !== this._recapLogThrottle.lastLogDay) {
      const factionName = this.house?.name || 'Unknown';
      console.log(`[COMBAT RECORDER] ${factionName}: Generating daily recap for day ${day}. Events for this day: ${dayEvents.length}, total events: ${this.combatEvents.length}`);
      this._recapLogThrottle.lastLogDay = day;
    }
    
    const recap = {
      day: day,
      totalKills: 0,
      totalDeaths: 0,
      momentum: 0,
      zones: {},
      threats: {},
      baseDefense: { events: 0, kills: 0, deaths: 0 }
    };
    
    // Check if position is in base territory
    const isInBaseTerritory = (location) => {
      if (!this.house || !location || !Array.isArray(location) || location.length < 2) {
        return false;
      }
      if (this.factionAI && this.factionAI.territory) {
        const x = location[0] * 64; // Convert tile to pixel coordinates (assuming 64px per tile)
        const y = location[1] * 64;
        return this.factionAI.territory.isInBaseTerritory(x, y);
      }
      return false;
    };
    
    for (const event of dayEvents) {
      // Count kills/deaths
      if (event.eventType === 'kill') {
        recap.totalKills++;
      } else if (event.eventType === 'death') {
        recap.totalDeaths++;
      }
      
      // Track by zone
      const zoneKey = event.zoneId || 'unknown';
      if (!recap.zones[zoneKey]) {
        recap.zones[zoneKey] = { kills: 0, deaths: 0, totalEvents: 0 };
      }
      if (event.eventType === 'kill') {
        recap.zones[zoneKey].kills++;
      } else {
        recap.zones[zoneKey].deaths++;
      }
      recap.zones[zoneKey].totalEvents++;
      
      // Track by threat (enemy faction/type)
      const threatKey = event.enemyHouseName || event.enemyType || 'unknown';
      if (!recap.threats[threatKey]) {
        recap.threats[threatKey] = { kills: 0, deaths: 0 };
      }
      if (event.eventType === 'kill') {
        recap.threats[threatKey].kills++;
      } else {
        recap.threats[threatKey].deaths++;
      }
      
      // Track base defense (combat in base territory)
      if (isInBaseTerritory(event.location)) {
        recap.baseDefense.events++;
        if (event.eventType === 'kill') {
          recap.baseDefense.kills++;
        } else {
          recap.baseDefense.deaths++;
        }
      }
    }
    
    // Calculate momentum (kills - deaths)
    recap.momentum = recap.totalKills - recap.totalDeaths;
    
    return recap;
  }
  
  /**
   * Get combat insights (analyzes patterns and generates insights)
   * @returns {Object} Combat insights
   */
  getCombatInsights() {
    const currentDay = global.day || 1;
    const recentDays = 3; // Analyze last 3 days
    
    const insights = {
      highestActivityZone: null,
      highestActivityZoneEvents: 0,
      primaryThreat: null,
      primaryThreatKills: 0,
      overallMomentum: 0,
      baseUnderAttack: false
    };
    
    // Analyze recent days
    let totalKills = 0;
    let totalDeaths = 0;
    const zoneActivity = {};
    const threatActivity = {};
    let baseDefenseEvents = 0;
    
    for (let d = currentDay - recentDays + 1; d <= currentDay; d++) {
      if (d < 1) continue;
      
      const dayRecap = this.getDailyRecap(d);
      totalKills += dayRecap.totalKills;
      totalDeaths += dayRecap.totalDeaths;
      baseDefenseEvents += dayRecap.baseDefense.events;
      
      // Aggregate zone activity
      for (const [zoneId, stats] of Object.entries(dayRecap.zones)) {
        if (!zoneActivity[zoneId]) {
          zoneActivity[zoneId] = 0;
        }
        zoneActivity[zoneId] += stats.totalEvents;
      }
      
      // Aggregate threat activity
      for (const [threat, stats] of Object.entries(dayRecap.threats)) {
        if (!threatActivity[threat]) {
          threatActivity[threat] = { kills: 0, deaths: 0 };
        }
        threatActivity[threat].kills += stats.kills;
        threatActivity[threat].deaths += stats.deaths;
      }
    }
    
    // Find highest activity zone
    for (const [zoneId, events] of Object.entries(zoneActivity)) {
      if (events > insights.highestActivityZoneEvents) {
        insights.highestActivityZoneEvents = events;
        insights.highestActivityZone = zoneId;
      }
    }
    
    // Find primary threat (enemy with most kills against us)
    for (const [threat, stats] of Object.entries(threatActivity)) {
      if (stats.deaths > insights.primaryThreatKills) {
        insights.primaryThreatKills = stats.deaths;
        insights.primaryThreat = threat;
      }
    }
    
    // Calculate overall momentum
    insights.overallMomentum = totalKills - totalDeaths;
    
    // Check if base is under attack (combat in base territory)
    insights.baseUnderAttack = baseDefenseEvents > 0;
    
    return insights;
  }
  
  /**
   * Clear old events (cleanup)
   * @param {Number} maxAgeDays - Maximum age in days (default 30)
   */
  clearOldEvents(maxAgeDays = 30) {
    const currentDay = global.day || 1;
    const cutoffDay = currentDay - maxAgeDays;
    
    this.combatEvents = this.combatEvents.filter(e => e.day >= cutoffDay);
  }
  
  /**
   * Cleanup (unsubscribe from events)
   */
  cleanup() {
    if (global.eventManager) {
      global.eventManager.unsubscribe(this.subscriberId);
    }
    this.combatEvents = [];
  }
}

module.exports = CombatRecorder;

