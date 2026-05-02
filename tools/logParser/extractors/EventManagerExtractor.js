const BaseExtractor = require('./BaseExtractor');

class EventManagerExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('eventManager', config);
    this.stats = this.initializeStats();
  }

  initializeStats() {
    return {
      totalEvents: 0,
      byCategory: {},
      byAction: {},
      byCommunicationMode: {},
      byDay: {},
      byHour: {},
      hotspots: {
        combat: [],
        economic: [],
        death: [],
        building: [],
        social: [],
        military: [],
        item: [],
        faction: []
      },
      entityRelationships: {
        kills: {},
        attacks: {},
        interactions: {}
      },
      // Combat specific stats
      combat: {
        totalAttacks: 0,
        totalEscapes: 0,
        totalMinibossUpgrades: 0,
        totalDamage: 0,
        damageByActor: {},
        attacksByTarget: {},
        escapesByEnemy: {},
        minibossKillCounts: {},
        minibossUpgrades: []
      },
      // Death specific stats
      death: {
        totalDeaths: 0,
        totalRespawns: 0,
        deathsByKiller: {},
        deathsByVictim: {},
        deathLocations: [],
        respawnLocations: []
      },
      // Building specific stats
      building: {
        totalCompletions: 0,
        totalStarts: 0,
        totalFailures: 0,
        completionsByType: {},
        completionsByOwner: {},
        completionsByHouse: {},
        failuresByType: {},
        failuresByReason: {},
        buildingLocations: []
      },
      // Environment specific stats
      environment: {
        dayNightTransitions: 0,
        hourChanges: 0,
        dailyRecaps: 0,
        zoneEntries: 0,
        caveEntries: 0,
        transitions: [],
        zoneEntriesByZone: {},
        caveEntriesByCave: {}
      },
      // Social specific stats
      social: {
        totalSpeech: 0,
        totalInteractions: 0,
        totalUIFeedback: 0,
        speechByNPC: {},
        interactionsByType: {},
        uiFeedbackByType: {}
      },
      // Military specific stats
      military: {
        totalRecruitments: 0,
        totalUpgrades: 0,
        recruitmentsByUnitType: {},
        recruitmentsByHouse: {},
        upgradesByUnitType: {},
        upgradesByHouse: {},
        upgradePaths: []
      },
      // Item specific stats
      item: {
        totalDrops: 0,
        totalPickups: 0,
        dropsByItemType: {},
        pickupsByItemType: {},
        dropsByDropper: {},
        pickupsByPicker: {},
        itemLocations: []
      },
      // Faction specific stats (enhanced)
      faction: {
        totalMissions: 0,
        successfulMissions: 0,
        failedMissions: 0,
        zonesCleared: 0,
        conflictZones: 0,
        missionsByHouse: {},
        missionSuccessRate: 0,
        missionsByType: {},
        conflictZonesByLocation: []
      },
      // AI specific stats
      ai: {
        totalEvents: 0,
        eventsByType: {},
        decisionPatterns: {},
        serfRuntime: {
          normalizedStates: 0,
          recoveries: 0,
          idleWanders: 0,
          recoveryReasons: {},
          normalizedRecoveryTypes: {}
        }
      },
      // Serf spawning specific stats
      serfSpawning: {
        tallyStarts: 0,
        spawnAttempts: 0,
        spawnsSuccessful: 0,
        spawnsFailed: 0,
        totalSerfsSpawned: 0,
        byBuilding: {},
        byHouse: {},
        byBuildingType: {},
        bySpawnMethod: {},
        decisionReasons: {},
        failedReasons: {},
        failedPlacementReasons: {},
        saturatedFailures: 0
      },
      // Faction creation specific stats
      factionCreation: {
        totalFactionsCreated: 0,
        totalResourcesTransferred: 0,
        totalBuildingsConverted: 0,
        totalUnitsConverted: 0,
        byHouse: {},
        byResourceType: {},
        resourceTransfers: 0,
        buildingConversions: 0,
        unitConversions: 0
      }
    };
  }

  reset() {
    super.reset();
    // Initialize anomaly detection tracking
    this._anomalyTracking = {
      eventRatesByWindow: [],
      currentWindow: { start: null, events: 0, byCategory: {} },
      windowSize: 1000, // 1000 events per window
      lastEventRate: 0,
      expectedEvents: {
        hourChange: { lastDay: null, lastHour: null, expected: true },
        dailyRecap: { lastDay: null, expected: true },
        dayNightTransition: { lastTransition: null, expected: true }
      }
    };
  }

  extract(line, context) {
    if (!line.startsWith('[EVENT]')) {
      return false;
    }

    const payloadRaw = line.slice('[EVENT]'.length).trim();
    if (!payloadRaw) {
      return true;
    }

    let payload;
    try {
      payload = JSON.parse(payloadRaw);
    } catch (error) {
      this.addError({
        severity: 'WARN',
        category: 'event_manager',
        message: 'Failed to parse EventManager payload',
        lineNumber: context.lineNumber,
        day: context.currentDay || null,
        hour: context.currentHour || null
      });
      return true;
    }

    this.stats.totalEvents += 1;
    const category = payload.category || 'unknown';
    const action = payload.action || 'unknown';
    
    this._increment(this.stats.byCategory, category);
    this._increment(this.stats.byAction, action);
    
    // Track communication mode
    const communication = payload.communication || 'None';
    if (Array.isArray(communication)) {
      communication.forEach(mode => this._increment(this.stats.byCommunicationMode, mode));
    } else {
      this._increment(this.stats.byCommunicationMode, communication);
    }
    
    // Track temporal patterns
    if (context.currentDay !== null) {
      this._increment(this.stats.byDay, context.currentDay);
    }
    if (context.currentHour !== null) {
      this._increment(this.stats.byHour, context.currentHour);
    }
    
    // Track position-based hotspots
    if (payload.position) {
      this._trackHotspot(category, payload.position);
    }
    
    // Track entity relationships
    this._trackEntityRelationships(payload);

    // Category-specific tracking
    const categoryLower = category.toLowerCase();
    if (categoryLower === 'combat') {
      this._trackCombat(payload, context);
    } else if (categoryLower === 'death') {
      this._trackDeath(payload, context);
    } else if (categoryLower === 'building') {
      this._trackBuilding(payload, context);
    } else if (categoryLower === 'environment') {
      this._trackEnvironment(payload, context);
    } else if (categoryLower === 'social') {
      this._trackSocial(payload, context);
    } else if (categoryLower === 'military') {
      this._trackMilitary(payload, context);
    } else if (categoryLower === 'item') {
      this._trackItem(payload, context);
    } else if (categoryLower === 'faction') {
      this._trackFaction(payload, context);
      this._trackFactionCreation(payload, context);
    } else if (categoryLower === 'ai') {
      this._trackAI(payload, context);
    }
    
    // Track serf spawning events (Economic category)
    if (categoryLower === 'economic' || category === 'ECONOMIC') {
      this._trackSerfSpawning(payload, context);
    }

    // Detect anomalies
    this._detectAnomalies(payload, context);

    this.addEvent({
      type: 'event_manager',
      category: payload.category || null,
      action: payload.action || null,
      subject: payload.subject || null,
      subjectName: payload.subjectName || null,
      target: payload.target || null,
      targetName: payload.targetName || null,
      quantity: payload.quantity || null,
      house: payload.house || null,
      houseName: payload.houseName || null,
      position: payload.position || null,
      metadata: payload.metadata || null,
      timestamp: payload.ts || null,
      lineNumber: context.lineNumber
    });
    
    return true;
  }

  _increment(map, key, amount = 1) {
    if (!key) return;
    map[key] = (map[key] || 0) + amount;
  }

  _trackHotspot(category, position) {
    if (!position || !category) return;
    
    const categoryLower = category.toLowerCase();
    let hotspotCategory = null;
    
    if (categoryLower === 'combat') hotspotCategory = 'combat';
    else if (categoryLower === 'economic') hotspotCategory = 'economic';
    else if (categoryLower === 'death') hotspotCategory = 'death';
    else if (categoryLower === 'building') hotspotCategory = 'building';
    else if (categoryLower === 'social') hotspotCategory = 'social';
    else if (categoryLower === 'military') hotspotCategory = 'military';
    else if (categoryLower === 'item') hotspotCategory = 'item';
    else if (categoryLower === 'faction') hotspotCategory = 'faction';
    
    if (!hotspotCategory) return;
    
    // Use 512x512 tile regions matching EventManager combat hotspots
    const regionX = Math.floor(position.x / 512);
    const regionY = Math.floor(position.y / 512);
    const key = `${regionX},${regionY}`;
    
    const hotspots = this.stats.hotspots[hotspotCategory];
    let hotspot = hotspots.find(h => h.key === key);
    
    if (hotspot) {
      hotspot.count++;
    } else {
      hotspots.push({
        key,
        count: 1,
        x: regionX * 512,
        y: regionY * 512,
        z: position.z || 0
      });
    }
  }

  _trackEntityRelationships(payload) {
    if (!payload.subject || !payload.action) return;
    
    // Track kills (death events with killer)
    if (payload.category === 'Death' && payload.target && payload.action === 'died') {
      const killerKey = payload.target || 'unknown';
      const victimKey = payload.subject || 'unknown';
      const relationshipKey = `${killerKey}->${victimKey}`;
      this._increment(this.stats.entityRelationships.kills, relationshipKey);
      this._increment(this.stats.entityRelationships.kills, killerKey);
    }
    
    // Track attacks (combat events with target)
    if (payload.category === 'Combat' && payload.target && payload.quantity) {
      const attackerKey = payload.subject || 'unknown';
      const targetKey = payload.target || 'unknown';
      const relationshipKey = `${attackerKey}->${targetKey}`;
      this._increment(this.stats.entityRelationships.attacks, relationshipKey);
    }
    
    // Track general interactions (subject -> target)
    if (payload.target && payload.subject) {
      const relationshipKey = `${payload.subject}->${payload.target}`;
      this._increment(this.stats.entityRelationships.interactions, relationshipKey);
    }
  }

  _trackCombat(payload, context) {
    const action = payload.action || '';
    const combatStats = this.stats.combat;
    
    if (action.includes('damage') || action.includes('attacked')) {
      combatStats.totalAttacks += 1;
      const damage = payload.quantity || 0;
      combatStats.totalDamage += damage;
      
      if (payload.subject) {
        this._increment(combatStats.damageByActor, payload.subject, damage);
      }
      if (payload.target) {
        this._increment(combatStats.attacksByTarget, payload.target);
      }
    } else if (action.includes('escaped') || action.includes('escape')) {
      combatStats.totalEscapes += 1;
      if (payload.target) {
        this._increment(combatStats.escapesByEnemy, payload.target);
      }
    } else if (action.includes('miniboss') || action.includes('became miniboss')) {
      combatStats.totalMinibossUpgrades += 1;
      const killCount = payload.quantity || 0;
      
      if (payload.subject) {
        combatStats.minibossKillCounts[payload.subject] = killCount;
      }
      
      if (payload.position) {
        combatStats.minibossUpgrades.push({
          subject: payload.subject,
          subjectName: payload.subjectName,
          killCount,
          position: payload.position,
          day: context.currentDay || null,
          hour: context.currentHour || null
        });
      }
      
      this.addHighlight({
        type: 'miniboss_upgrade',
        summary: `${payload.subjectName || 'Unknown'} became miniboss with ${killCount} kills`,
        subject: payload.subjectName,
        killCount,
        day: context.currentDay || null,
        hour: context.currentHour || null
      });
    }
  }

  _trackDeath(payload, context) {
    const action = payload.action || '';
    const deathStats = this.stats.death;
    
    if (action === 'died' || action.includes('died')) {
      deathStats.totalDeaths += 1;
      
      if (payload.target) {
        const killerKey = payload.target || 'unknown';
        this._increment(deathStats.deathsByKiller, killerKey);
      }
      
      if (payload.subject) {
        const victimKey = payload.subject || 'unknown';
        this._increment(deathStats.deathsByVictim, victimKey);
      }
      
      if (payload.position) {
        deathStats.deathLocations.push({
          victim: payload.subjectName || 'unknown',
          killer: payload.targetName || null,
          position: payload.position,
          day: context.currentDay || null,
          hour: context.currentHour || null
        });
      }
      
      // Add highlight for notable deaths
      if (payload.target) {
        this.addHighlight({
          type: 'death',
          summary: `${payload.subjectName || 'Unknown'} was slain by ${payload.targetName || 'unknown'}`,
          victim: payload.subjectName,
          killer: payload.targetName,
          day: context.currentDay || null,
          hour: context.currentHour || null
        });
      }
    } else if (action.includes('respawn') || action.includes('respawned')) {
      deathStats.totalRespawns += 1;
      
      if (payload.position) {
        deathStats.respawnLocations.push({
          subject: payload.subjectName || 'unknown',
          position: payload.position,
          day: context.currentDay || null,
          hour: context.currentHour || null
        });
      }
    }
  }

  _trackBuilding(payload, context) {
    const action = payload.action || '';
    const buildingStats = this.stats.building;
    
    if (action === 'completed' || action.includes('completed')) {
      buildingStats.totalCompletions += 1;
      
      if (payload.subjectName) {
        this._increment(buildingStats.completionsByType, payload.subjectName);
      }
      
      if (payload.ownerName) {
        this._increment(buildingStats.completionsByOwner, payload.ownerName);
      }
      
      if (payload.houseName) {
        this._increment(buildingStats.completionsByHouse, payload.houseName);
      }
      
      if (payload.position) {
        buildingStats.buildingLocations.push({
          type: payload.subjectName || 'unknown',
          owner: payload.ownerName || null,
          house: payload.houseName || null,
          position: payload.position,
          day: context.currentDay || null,
          hour: context.currentHour || null
        });
      }
      
      this.addHighlight({
        type: 'building_completed',
        summary: `${payload.subjectName || 'Building'} completed${payload.ownerName ? ` by ${payload.ownerName}` : ''}`,
        buildingType: payload.subjectName,
        owner: payload.ownerName,
        house: payload.houseName,
        day: context.currentDay || null,
        hour: context.currentHour || null
      });
    } else if (action.includes('started') || action.includes('start')) {
      buildingStats.totalStarts += 1;
    } else if (action.includes('failed') || action.includes('failure')) {
      buildingStats.totalFailures += 1;
      
      if (payload.subjectName) {
        this._increment(buildingStats.failuresByType, payload.subjectName);
      }
      
      const metadata = payload.metadata || {};
      const reason = metadata.reason || 'unknown';
      this._increment(buildingStats.failuresByReason, reason);
      
      // Add anomaly if many failures
      const failureCount = buildingStats.failuresByReason[reason] || 0;
      if (failureCount === 10) {
        this.addAnomaly({
          type: 'building_failure',
          summary: `Building failures for reason "${reason}" reached 10 occurrences`,
          reason,
          count: failureCount
        });
      }
    }
  }

  _trackEnvironment(payload, context) {
    const action = payload.action || '';
    const envStats = this.stats.environment;
    const metadata = payload.metadata || {};
    
    if (action === 'Nightfall' || action === 'Dawn' || action.includes('nightfall') || action.includes('dawn')) {
      envStats.dayNightTransitions += 1;
      envStats.transitions.push({
        state: action,
        day: context.currentDay || null,
        hour: context.currentHour || null
      });
    } else if (action === 'hour change' || action.includes('hour')) {
      envStats.hourChanges += 1;
    } else if (action === 'daily recap' || action.includes('daily recap')) {
      envStats.dailyRecaps += 1;
      
      // Extract daily recap metadata
      if (metadata.day !== undefined) {
        this.addHighlight({
          type: 'daily_recap',
          summary: `Daily recap for Day ${metadata.day}`,
          day: metadata.day,
          population: metadata.populationBefore || {},
          changes: metadata.changes || {}
        });
      }
    } else if (action.includes('entered zone') || action.includes('zone entry')) {
      envStats.zoneEntries += 1;
      const zoneName = payload.targetName || 'unknown';
      this._increment(envStats.zoneEntriesByZone, zoneName);
    } else if (action.includes('entered cave') || action.includes('cave entry')) {
      envStats.caveEntries += 1;
      const caveName = payload.targetName || 'unknown';
      this._increment(envStats.caveEntriesByCave, caveName);
    }
  }

  _trackSocial(payload, context) {
    const action = payload.action || '';
    const socialStats = this.stats.social;
    
    if (action === 'said' || action.includes('said') || action.includes('speech')) {
      socialStats.totalSpeech += 1;
      if (payload.subjectName) {
        this._increment(socialStats.speechByNPC, payload.subjectName);
      }
    } else if (action.includes('interaction') || action.includes('conversation')) {
      socialStats.totalInteractions += 1;
      const interactionType = action || 'unknown';
      this._increment(socialStats.interactionsByType, interactionType);
    } else {
      // UI feedback messages
      socialStats.totalUIFeedback += 1;
      const feedbackType = action || 'unknown';
      this._increment(socialStats.uiFeedbackByType, feedbackType);
    }
  }

  _trackMilitary(payload, context) {
    const action = payload.action || '';
    const militaryStats = this.stats.military;
    
    if (action === 'recruited' || action.includes('recruited')) {
      militaryStats.totalRecruitments += 1;
      
      const unitType = payload.targetName || 'unknown';
      this._increment(militaryStats.recruitmentsByUnitType, unitType);
      
      if (payload.houseName) {
        this._increment(militaryStats.recruitmentsByHouse, payload.houseName);
      }
      
      this.addHighlight({
        type: 'military_recruitment',
        summary: `${payload.houseName || 'Unknown'} recruited ${unitType}`,
        house: payload.houseName,
        unitType,
        day: context.currentDay || null,
        hour: context.currentHour || null
      });
    } else if (action === 'upgraded' || action.includes('upgraded')) {
      militaryStats.totalUpgrades += 1;
      
      const oldType = payload.subjectName || 'unknown';
      const newType = payload.targetName || 'unknown';
      
      this._increment(militaryStats.upgradesByUnitType, newType);
      
      if (payload.houseName) {
        this._increment(militaryStats.upgradesByHouse, payload.houseName);
      }
      
      militaryStats.upgradePaths.push({
        oldType,
        newType,
        house: payload.houseName || null,
        day: context.currentDay || null,
        hour: context.currentHour || null
      });
      
      this.addHighlight({
        type: 'military_upgrade',
        summary: `${oldType} upgraded to ${newType}${payload.houseName ? ` (${payload.houseName})` : ''}`,
        oldType,
        newType,
        house: payload.houseName,
        day: context.currentDay || null,
        hour: context.currentHour || null
      });
    }
  }

  _trackItem(payload, context) {
    const action = payload.action || '';
    const itemStats = this.stats.item;
    
    if (action.includes('dropped') || action.includes('drop')) {
      itemStats.totalDrops += 1;
      
      // Extract item type from action (e.g., "dropped sword" -> "sword")
      const itemMatch = action.match(/dropped\s+(.+)/i);
      const itemType = itemMatch ? itemMatch[1] : 'unknown';
      
      this._increment(itemStats.dropsByItemType, itemType);
      
      if (payload.subject) {
        this._increment(itemStats.dropsByDropper, payload.subject);
      }
      
      if (payload.position) {
        itemStats.itemLocations.push({
          type: 'drop',
          itemType,
          dropper: payload.subjectName || null,
          quantity: payload.quantity || 1,
          position: payload.position,
          day: context.currentDay || null,
          hour: context.currentHour || null
        });
      }
    } else if (action.includes('picked up') || action.includes('pickup')) {
      itemStats.totalPickups += 1;
      
      // Extract item type from action
      const itemMatch = action.match(/picked\s+up\s+(.+)/i);
      const itemType = itemMatch ? itemMatch[1] : 'unknown';
      
      this._increment(itemStats.pickupsByItemType, itemType);
      
      if (payload.subject) {
        this._increment(itemStats.pickupsByPicker, payload.subject);
      }
      
      if (payload.position) {
        itemStats.itemLocations.push({
          type: 'pickup',
          itemType,
          picker: payload.subjectName || null,
          quantity: payload.quantity || 1,
          position: payload.position,
          day: context.currentDay || null,
          hour: context.currentHour || null
        });
      }
    }
  }

  _trackFaction(payload, context) {
    const action = payload.action || '';
    const factionStats = this.stats.faction;
    const metadata = payload.metadata || {};
    
    // Track scouting mission events
    if (action.includes('scouting mission') || action.includes('departed') || action.includes('returned')) {
      factionStats.totalMissions += 1;
      
      if (action.includes('returned') && metadata.missionSuccess !== undefined) {
        if (metadata.missionSuccess) {
          factionStats.successfulMissions += 1;
        } else {
          factionStats.failedMissions += 1;
        }
      } else if (action.includes('failed') || action.includes('failure')) {
        factionStats.failedMissions += 1;
      }
      
      if (payload.houseName) {
        this._increment(factionStats.missionsByHouse, payload.houseName);
      }
      
      const missionType = action || 'unknown';
      this._increment(factionStats.missionsByType, missionType);
    }
    
    // Track zone clearing
    if (action.includes('zone cleared') || action.includes('cleared for expansion')) {
      factionStats.zonesCleared += 1;
      
      if (payload.position) {
        this.addHighlight({
          type: 'zone_cleared',
          summary: `${payload.houseName || 'Unknown'} cleared zone ${payload.targetName || 'unknown'}`,
          house: payload.houseName,
          zone: payload.targetName,
          position: payload.position,
          day: context.currentDay || null,
          hour: context.currentHour || null
        });
      }
    }
    
    // Track conflict zones (banner placement)
    if (action.includes('contested banner') || action.includes('placed contested banner')) {
      factionStats.conflictZones += 1;
      
      if (payload.position) {
        factionStats.conflictZonesByLocation.push({
          house: payload.houseName || null,
          enemyHouse: metadata.enemyHouseName || null,
          conflictZone: metadata.conflictZone || null,
          position: payload.position,
          day: context.currentDay || null,
          hour: context.currentHour || null
        });
        
        this.addHighlight({
          type: 'conflict_zone',
          summary: `${payload.houseName || 'Unknown'} placed contested banner against ${metadata.enemyHouseName || 'unknown'}`,
          house: payload.houseName,
          enemyHouse: metadata.enemyHouseName,
          position: payload.position,
          day: context.currentDay || null,
          hour: context.currentHour || null
        });
      }
    }
    
    // Calculate success rate
    if (factionStats.totalMissions > 0) {
      factionStats.missionSuccessRate = 
        (factionStats.successfulMissions / factionStats.totalMissions) * 100;
    }
  }

  _trackAI(payload, context) {
    const action = payload.action || '';
    const aiStats = this.stats.ai;
    
    aiStats.totalEvents += 1;
    
    const eventType = action || 'unknown';
    this._increment(aiStats.eventsByType, eventType);
    
    // Track decision patterns if metadata contains decision info
    const metadata = payload.metadata || {};
    if (metadata.decision || metadata.pattern) {
      const pattern = metadata.decision || metadata.pattern || 'unknown';
      this._increment(aiStats.decisionPatterns, pattern);
    }

    const serfRuntime = aiStats.serfRuntime;
    if (action === 'serf state normalized') {
      serfRuntime.normalizedStates += 1;
      this._increment(serfRuntime.normalizedRecoveryTypes, metadata.recovery || 'unknown');
    } else if (action === 'serf recovery transition') {
      serfRuntime.recoveries += 1;
      this._increment(serfRuntime.recoveryReasons, metadata.reason || metadata.recovery || 'unknown');
    } else if (action === 'serf idle wander') {
      serfRuntime.idleWanders += 1;
    }
  }

  _trackSerfSpawning(payload, context) {
    // Only track ECONOMIC category events with serf spawning actions
    // EventManager uses 'Economic' (capital E) not 'ECONOMIC'
    const category = payload.category || '';
    if (category !== 'Economic' && category !== 'ECONOMIC') return;

    const action = payload.action || '';
    const metadata = payload.metadata || {};
    const serfStats = this.stats.serfSpawning;

    // Track tally starts
    if (action === 'serf spawn tally started' || action.includes('tally started')) {
      serfStats.tallyStarts += 1;
      if (payload.subjectName) {
        this._increment(serfStats.byBuildingType, payload.subjectName);
      }
      if (payload.houseName) {
        this._increment(serfStats.byHouse, payload.houseName);
      }
      return;
    }

    // Track spawn decisions
    if (action === 'serf spawn decision' || action.includes('spawn decision')) {
      const decision = metadata.decision || 'unknown';
      const reason = metadata.reason || null;
      if (reason) {
        this._increment(serfStats.decisionReasons, reason);
      }
      return;
    }

    // Track spawn attempts
    if (action === 'serf spawn attempt' || action.includes('spawn attempt')) {
      serfStats.spawnAttempts += 1;
      const spawnMethod = metadata.spawnMethod || 'unknown';
      this._increment(serfStats.bySpawnMethod, spawnMethod);
      if (payload.subjectName) {
        this._increment(serfStats.byBuildingType, payload.subjectName);
      }
      if (payload.houseName) {
        this._increment(serfStats.byHouse, payload.houseName);
      }
      return;
    }

    // Track successful spawns
    if (action === 'serfs spawned' || action.includes('spawned')) {
      serfStats.spawnsSuccessful += 1;
      const spawnCount = payload.quantity || metadata.spawnCount || 1;
      serfStats.totalSerfsSpawned += spawnCount;

      if (payload.subject) {
        this._increment(serfStats.byBuilding, payload.subject, spawnCount);
      }
      if (payload.subjectName) {
        this._increment(serfStats.byBuildingType, payload.subjectName, spawnCount);
      }
      if (payload.houseName) {
        this._increment(serfStats.byHouse, payload.houseName, spawnCount);
      }

      const spawnMethod = metadata.spawnMethod || 'unknown';
      this._increment(serfStats.bySpawnMethod, spawnMethod, spawnCount);

      // Add highlight for significant spawns
      if (spawnCount >= 2) {
        this.addHighlight({
          type: 'serf_spawn',
          summary: `${payload.houseName || 'Unknown'} spawned ${spawnCount} serfs at ${payload.subjectName || 'building'}`,
          building: payload.subjectName,
          house: payload.houseName,
          count: spawnCount,
          day: context.currentDay || null,
          hour: context.currentHour || null
        });
      }
      return;
    }

    // Track failed spawns
    if (action === 'serf spawn failed' || action.includes('spawn failed')) {
      serfStats.spawnsFailed += 1;
      const reason = metadata.reason || 'unknown';
      this._increment(serfStats.failedReasons, reason);

       const placement = metadata.placement || {};
       if (placement.dominantFailure) {
        this._increment(serfStats.failedPlacementReasons, placement.dominantFailure);
      }
      if (placement.isSaturated) {
        serfStats.saturatedFailures += 1;
      }

      if (payload.subjectName) {
        this._increment(serfStats.byBuildingType, payload.subjectName);
      }
      if (payload.houseName) {
        this._increment(serfStats.byHouse, payload.houseName);
      }

      // Add anomaly if many failures
      const failureCount = serfStats.failedReasons[reason] || 0;
      if (failureCount === 10) {
        this.addAnomaly({
          type: 'serf_spawn_failure',
          summary: `Serf spawn failures for reason "${reason}" reached 10 occurrences`,
          reason,
          count: failureCount
        });
      }
      return;
    }
  }

  _trackFactionCreation(payload, context) {
    const category = payload.category || '';
    const action = payload.action || '';
    const metadata = payload.metadata || {};
    const factionStats = this.stats.factionCreation;

    // Track faction creation events
    if (category === 'Faction' || category === 'FACTION') {
      // Track faction creation itself
      if (action === 'created faction' || action.includes('created faction')) {
        factionStats.totalFactionsCreated += 1;
        if (payload.houseName) {
          this._increment(factionStats.byHouse, payload.houseName);
        }
        // Add highlight for faction creation
        this.addHighlight({
          type: 'faction_created',
          summary: `${payload.subjectName || 'Unknown'} created faction "${payload.houseName || 'Unknown'}"`,
          player: payload.subjectName,
          house: payload.houseName,
          day: context.currentDay || null,
          hour: context.currentHour || null
        });
        return;
      }

      // Track unit conversions
      if (action === 'converted units to faction' || action.includes('converted units')) {
        factionStats.unitConversions += 1;
        const unitCount = payload.quantity || 0;
        factionStats.totalUnitsConverted += unitCount;
        if (payload.houseName) {
          this._increment(factionStats.byHouse, payload.houseName, unitCount);
        }
        return;
      }
    }

    // Track resource transfers (ECONOMIC category)
    if (category === 'Economic' || category === 'ECONOMIC') {
      if (action && action.includes('transferred') && action.includes('to faction')) {
        factionStats.resourceTransfers += 1;
        const quantity = payload.quantity || 0;
        factionStats.totalResourcesTransferred += quantity;
        
        // Extract resource type from action (e.g., "transferred grain to faction" -> "grain")
        const resourceMatch = action.match(/transferred\s+(\w+)\s+to\s+faction/);
        if (resourceMatch) {
          const resourceType = resourceMatch[1];
          this._increment(factionStats.byResourceType, resourceType, quantity);
        }
        
        if (payload.houseName) {
          this._increment(factionStats.byHouse, payload.houseName, quantity);
        }
        return;
      }
    }

    // Track building conversions (BUILDING category)
    if (category === 'Building' || category === 'BUILDING') {
      if (action === 'converted buildings to faction' || action.includes('converted buildings')) {
        factionStats.buildingConversions += 1;
        const buildingCount = payload.quantity || 0;
        factionStats.totalBuildingsConverted += buildingCount;
        if (payload.houseName) {
          this._increment(factionStats.byHouse, payload.houseName, buildingCount);
        }
        return;
      }
    }
  }

  _detectAnomalies(payload, context) {
    this._detectSpikes(payload, context);
    this._detectMissingEvents(payload, context);
    this._detectPatternAnomalies(payload, context);
  }

  _detectSpikes(payload, context) {
    const tracking = this._anomalyTracking;
    
    // Track events in current window
    if (!tracking.currentWindow.start) {
      tracking.currentWindow.start = context.lineNumber;
    }
    
    tracking.currentWindow.events += 1;
    const category = payload.category || 'unknown';
    this._increment(tracking.currentWindow.byCategory, category);
    
    // When window is full, check for spikes
    if (tracking.currentWindow.events >= tracking.windowSize) {
      const currentRate = tracking.currentWindow.events;
      const previousRate = tracking.lastEventRate;
      
      // Detect spike: current rate is more than 2x previous rate
      if (previousRate > 0 && currentRate > previousRate * 2) {
        this.addAnomaly({
          type: 'event_spike',
          summary: `Event rate spike detected: ${currentRate} events/window (previous: ${previousRate})`,
          currentRate,
          previousRate,
          spikeRatio: (currentRate / previousRate).toFixed(2),
          category: category,
          windowStart: tracking.currentWindow.start,
          windowEnd: context.lineNumber
        });
      }
      
      // Save window and reset
      tracking.eventRatesByWindow.push({
        start: tracking.currentWindow.start,
        end: context.lineNumber,
        events: currentRate,
        byCategory: { ...tracking.currentWindow.byCategory }
      });
      
      tracking.lastEventRate = currentRate;
      tracking.currentWindow = { start: context.lineNumber + 1, events: 0, byCategory: {} };
      
      // Keep only last 10 windows for memory efficiency
      if (tracking.eventRatesByWindow.length > 10) {
        tracking.eventRatesByWindow.shift();
      }
    }
    
    // Detect category-specific spikes
    const categoryCount = tracking.currentWindow.byCategory[category] || 0;
    const categoryRatio = tracking.currentWindow.events > 0 
      ? categoryCount / tracking.currentWindow.events 
      : 0;
    
    // Alert if a single category dominates (>50% of events)
    if (categoryRatio > 0.5 && tracking.currentWindow.events >= 100) {
      this.addAnomaly({
        type: 'category_dominance',
        summary: `Category "${category}" dominates events: ${(categoryRatio * 100).toFixed(1)}% of last ${tracking.currentWindow.events} events`,
        category,
        ratio: categoryRatio,
        count: categoryCount,
        total: tracking.currentWindow.events
      });
    }
  }

  _detectMissingEvents(payload, context) {
    const tracking = this._anomalyTracking;
    const action = payload.action || '';
    const metadata = payload.metadata || {};
    
    // Track hour change events
    if (payload.category === 'Environment' && action === 'hour change') {
      const currentDay = context.currentDay || null;
      const currentHour = context.currentHour || null;
      const expected = tracking.expectedEvents.hourChange;
      
      if (expected.lastDay !== null && expected.lastHour !== null) {
        // Check if hour change is missing (should happen regularly)
        const dayDiff = currentDay - expected.lastDay;
        if (dayDiff > 1) {
          this.addAnomaly({
            type: 'missing_hour_changes',
            summary: `Missing hour change events: ${dayDiff} days since last hour change`,
            lastDay: expected.lastDay,
            currentDay,
            daysMissing: dayDiff
          });
        }
      }
      
      expected.lastDay = currentDay;
      expected.lastHour = currentHour;
    }
    
    // Track daily recap events
    if (payload.category === 'Environment' && action === 'daily recap') {
      const currentDay = metadata.day || context.currentDay || null;
      const expected = tracking.expectedEvents.dailyRecap;
      
      if (expected.lastDay !== null && currentDay !== null) {
        const dayDiff = currentDay - expected.lastDay;
        if (dayDiff > 1) {
          this.addAnomaly({
            type: 'missing_daily_recaps',
            summary: `Missing daily recap: ${dayDiff} days since last recap`,
            lastDay: expected.lastDay,
            currentDay,
            daysMissing: dayDiff
          });
        }
      }
      
      expected.lastDay = currentDay;
    }
    
    // Track day/night transitions (should alternate)
    if (payload.category === 'Environment' && (action === 'Nightfall' || action === 'Dawn')) {
      const expected = tracking.expectedEvents.dayNightTransition;
      
      if (expected.lastTransition !== null) {
        // Check if transitions are alternating properly
        if (expected.lastTransition === action) {
          this.addAnomaly({
            type: 'transition_anomaly',
            summary: `Repeated transition: ${action} (expected alternating pattern)`,
            transition: action,
            previousTransition: expected.lastTransition
          });
        }
      }
      
      expected.lastTransition = action;
    }
  }

  _detectPatternAnomalies(payload, context) {
    const category = payload.category || '';
    const action = payload.action || '';
    
    // Detect unusual death patterns
    if (category === 'Death') {
      const deathStats = this.stats.death;
      
      // Check for excessive deaths from a single killer
      if (payload.target) {
        const killerDeaths = deathStats.deathsByKiller[payload.target] || 0;
        const totalDeaths = deathStats.totalDeaths;
        
        if (totalDeaths > 10 && killerDeaths / totalDeaths > 0.3) {
          this.addAnomaly({
            type: 'killer_dominance',
            summary: `${payload.targetName || payload.target} responsible for ${((killerDeaths / totalDeaths) * 100).toFixed(1)}% of deaths`,
            killer: payload.targetName || payload.target,
            killCount: killerDeaths,
            totalDeaths,
            ratio: (killerDeaths / totalDeaths)
          });
        }
      }
      
      // Check for excessive deaths of a single victim
      if (payload.subject) {
        const victimDeaths = deathStats.deathsByVictim[payload.subject] || 0;
        
        if (victimDeaths > 5) {
          this.addAnomaly({
            type: 'repeated_deaths',
            summary: `${payload.subjectName || payload.subject} has died ${victimDeaths} times`,
            victim: payload.subjectName || payload.subject,
            deathCount: victimDeaths
          });
        }
      }
    }
    
    // Detect unusual combat patterns
    if (category === 'Combat') {
      const combatStats = this.stats.combat;
      
      // Check for excessive damage from single actor
      if (payload.subject && payload.quantity) {
        const actorDamage = combatStats.damageByActor[payload.subject] || 0;
        const totalDamage = combatStats.totalDamage;
        
        if (totalDamage > 100 && actorDamage / totalDamage > 0.5) {
          this.addAnomaly({
            type: 'combat_dominance',
            summary: `${payload.subjectName || payload.subject} dealt ${((actorDamage / totalDamage) * 100).toFixed(1)}% of total damage`,
            actor: payload.subjectName || payload.subject,
            damage: actorDamage,
            totalDamage,
            ratio: (actorDamage / totalDamage)
          });
        }
      }
    }
    
    // Detect unusual failure rates
    if (category === 'Building') {
      const buildingStats = this.stats.building;
      
      if (buildingStats.totalCompletions + buildingStats.totalFailures > 10) {
        const failureRate = buildingStats.totalFailures / 
          (buildingStats.totalCompletions + buildingStats.totalFailures);
        
        if (failureRate > 0.3) {
          this.addAnomaly({
            type: 'high_failure_rate',
            summary: `Building failure rate is ${(failureRate * 100).toFixed(1)}% (${buildingStats.totalFailures} failures, ${buildingStats.totalCompletions} completions)`,
            failureRate,
            failures: buildingStats.totalFailures,
            completions: buildingStats.totalCompletions
          });
        }
      }
    }
    
    // Detect unusual faction mission failure rates
    if (category === 'Faction') {
      const factionStats = this.stats.faction;
      
      if (factionStats.totalMissions > 10) {
        const failureRate = factionStats.failedMissions / factionStats.totalMissions;
        
        if (failureRate > 0.5) {
          this.addAnomaly({
            type: 'faction_mission_failure',
            summary: `Faction mission failure rate is ${(failureRate * 100).toFixed(1)}% (${factionStats.failedMissions}/${factionStats.totalMissions} failed)`,
            failureRate,
            failed: factionStats.failedMissions,
            total: factionStats.totalMissions
          });
        }
      }
    }
  }
}

module.exports = EventManagerExtractor;
