// ============================================================================
// SPECTATOR DIRECTOR - Event-Driven Camera System
// ============================================================================
// Intelligent camera director that uses game events to select interesting targets
// for spectator viewing

class SpectatorDirector {
  constructor() {
    this.isActive = false;
    this.currentTarget = null;
    this.targetLockTime = 0;
    this.minLockDuration = 5000; // Minimum 5 seconds on a target
    
    // Event tracking
    this.combatParticipants = new Map(); // playerId -> {damage, attacks, lastActivity}
    this.buildingActivity = new Map(); // buildingId -> {completions, activity}
    this.economicActivity = new Map(); // playerId -> {milestones, activity}
    
    // Priority weights for different event types
    this.priorities = {
      DEATH: 100,
      COMBAT_DAMAGE: 10,
      BUILDING_COMPLETION: 20,
      ECONOMIC_MILESTONE: 5,
      ENVIRONMENT: 1
    };
    
    // Camera transition settings
    this.transitionDuration = 2000; // 2 seconds smooth transition
    this.isTransitioning = false;
    
    // Event history for pattern recognition
    this.recentEvents = [];
    this.maxRecentEvents = 50;
  }
  
  // ============================================================================
  // MAIN DIRECTOR METHODS
  // ============================================================================
  
  start() {
    this.isActive = true;
    console.log('SpectatorDirector: Started event-driven camera');
  }
  
  stop() {
    this.isActive = false;
    this.currentTarget = null;
    this.combatParticipants.clear();
    this.buildingActivity.clear();
    this.economicActivity.clear();
    console.log('SpectatorDirector: Stopped');
  }
  
  // Called when spectator receives an event from server
  processEvent(event) {
    if (!this.isActive) return;
    
    // Add to recent events
    this.addRecentEvent(event);
    
    // Process based on event category
    switch (event.category) {
      case 'Combat':
        this.processCombatEvent(event);
        break;
      case 'Death':
        this.processDeathEvent(event);
        break;
      case 'Building':
        this.processBuildingEvent(event);
        break;
      case 'Economic':
        this.processEconomicEvent(event);
        break;
      case 'Environment':
        this.processEnvironmentEvent(event);
        break;
    }
    
    // Check if we should switch targets
    this.evaluateTargetSwitch();
  }
  
  // ============================================================================
  // EVENT PROCESSING
  // ============================================================================
  
  processCombatEvent(event) {
    if (!event.subject || !event.position) return;
    
    const participantId = event.subject;
    const damage = event.quantity || 0;
    
    // Update combat participant tracking
    if (!this.combatParticipants.has(participantId)) {
      this.combatParticipants.set(participantId, {
        damage: 0,
        attacks: 0,
        lastActivity: Date.now(),
        position: event.position
      });
    }
    
    const participant = this.combatParticipants.get(participantId);
    participant.damage += damage;
    participant.attacks++;
    participant.lastActivity = Date.now();
    participant.position = event.position;
    
    // High combat activity = high priority
    if (damage > 0) {
      this.considerTarget(participantId, this.priorities.COMBAT_DAMAGE, event.position);
    }
  }
  
  processDeathEvent(event) {
    if (!event.subject || !event.position) return;
    
    const victimId = event.subject;
    
    // Death is highest priority - immediately switch to this location
    this.switchToTarget(victimId, event.position, 'death');
    
    // Clean up combat tracking for dead player
    this.combatParticipants.delete(victimId);
  }
  
  processBuildingEvent(event) {
    if (!event.subject || !event.position) return;
    
    const buildingId = event.subject;
    
    // Track building activity
    if (!this.buildingActivity.has(buildingId)) {
      this.buildingActivity.set(buildingId, {
        completions: 0,
        lastActivity: Date.now(),
        position: event.position
      });
    }
    
    const building = this.buildingActivity.get(buildingId);
    building.completions++;
    building.lastActivity = Date.now();
    building.position = event.position;
    
    // Building completion is high priority
    this.considerTarget(buildingId, this.priorities.BUILDING_COMPLETION, event.position);
  }
  
  processEconomicEvent(event) {
    if (!event.subject || !event.position) return;
    
    const playerId = event.subject;
    const quantity = event.quantity || 0;
    
    // Only track significant economic activity
    if (quantity < 100) return;
    
    // Track economic milestones
    if (!this.economicActivity.has(playerId)) {
      this.economicActivity.set(playerId, {
        milestones: 0,
        totalQuantity: 0,
        lastActivity: Date.now(),
        position: event.position
      });
    }
    
    const economic = this.economicActivity.get(playerId);
    economic.milestones++;
    economic.totalQuantity += quantity;
    economic.lastActivity = Date.now();
    economic.position = event.position;
    
    // Economic milestones are lower priority
    this.considerTarget(playerId, this.priorities.ECONOMIC_MILESTONE, event.position);
  }
  
  processEnvironmentEvent(event) {
    // Environment events are low priority but can provide context
    this.considerTarget('environment', this.priorities.ENVIRONMENT, null);
  }
  
  // ============================================================================
  // TARGET SELECTION LOGIC
  // ============================================================================
  
  considerTarget(targetId, priority, position) {
    // Don't switch if we're in a transition
    if (this.isTransitioning) return;
    
    // Don't switch if we haven't been on current target long enough
    if (this.currentTarget && (Date.now() - this.targetLockTime) < this.minLockDuration) {
      return;
    }
    
    // Calculate target score
    const score = this.calculateTargetScore(targetId, priority);
    const currentScore = this.currentTarget ? this.calculateTargetScore(this.currentTarget.id, 0) : 0;
    
    // Switch if new target is significantly more interesting
    if (score > currentScore * 1.5) {
      this.switchToTarget(targetId, position, 'higher_priority');
    }
  }
  
  calculateTargetScore(targetId, basePriority) {
    let score = basePriority;
    
    // Add recency bonus
    const now = Date.now();
    const recentEvents = this.recentEvents.filter(e => 
      e.subject === targetId && (now - e.timestamp) < 30000 // Last 30 seconds
    );
    score += recentEvents.length * 2;
    
    // Add activity bonuses
    if (this.combatParticipants.has(targetId)) {
      const combat = this.combatParticipants.get(targetId);
      score += combat.damage * 0.1;
      score += combat.attacks * 2;
      
      // Recent activity bonus
      const timeSinceActivity = now - combat.lastActivity;
      if (timeSinceActivity < 10000) { // Last 10 seconds
        score += 20;
      }
    }
    
    if (this.buildingActivity.has(targetId)) {
      const building = this.buildingActivity.get(targetId);
      score += building.completions * 10;
      
      const timeSinceActivity = now - building.lastActivity;
      if (timeSinceActivity < 30000) { // Last 30 seconds
        score += 15;
      }
    }
    
    if (this.economicActivity.has(targetId)) {
      const economic = this.economicActivity.get(targetId);
      score += economic.milestones * 5;
      
      const timeSinceActivity = now - economic.lastActivity;
      if (timeSinceActivity < 60000) { // Last minute
        score += 5;
      }
    }
    
    return score;
  }
  
  switchToTarget(targetId, position, reason) {
    if (this.isTransitioning) return;
    
    console.log(`SpectatorDirector: Switching to ${targetId} (${reason})`);
    
    this.isTransitioning = true;
    this.currentTarget = {
      id: targetId,
      position: position,
      switchTime: Date.now(),
      reason: reason
    };
    this.targetLockTime = Date.now();
    
    // Send camera command to client
    this.sendCameraCommand(targetId, position);
    
    // End transition after duration
    setTimeout(() => {
      this.isTransitioning = false;
    }, this.transitionDuration);
  }
  
  evaluateTargetSwitch() {
    // Clean up old activity data
    this.cleanupOldActivity();
    
    // If no current target, find the most active one
    if (!this.currentTarget) {
      this.findMostActiveTarget();
      return;
    }
    
    // Check if current target is still active
    const currentActivity = this.getTargetActivity(this.currentTarget.id);
    if (currentActivity === 0) {
      // Current target is inactive, find a new one
      this.findMostActiveTarget();
    }
  }
  
  findMostActiveTarget() {
    let bestTarget = null;
    let bestScore = 0;
    
    // Check combat participants
    for (const [id, combat] of this.combatParticipants) {
      const score = this.calculateTargetScore(id, this.priorities.COMBAT_DAMAGE);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = { id, position: combat.position };
      }
    }
    
    // Check building activity
    for (const [id, building] of this.buildingActivity) {
      const score = this.calculateTargetScore(id, this.priorities.BUILDING_COMPLETION);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = { id, position: building.position };
      }
    }
    
    // Check economic activity
    for (const [id, economic] of this.economicActivity) {
      const score = this.calculateTargetScore(id, this.priorities.ECONOMIC_MILESTONE);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = { id, position: economic.position };
      }
    }
    
    if (bestTarget) {
      this.switchToTarget(bestTarget.id, bestTarget.position, 'most_active');
    }
  }
  
  getTargetActivity(targetId) {
    const now = Date.now();
    const recentEvents = this.recentEvents.filter(e => 
      e.subject === targetId && (now - e.timestamp) < 30000
    );
    return recentEvents.length;
  }
  
  cleanupOldActivity() {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    
    // Clean combat participants
    for (const [id, combat] of this.combatParticipants) {
      if (now - combat.lastActivity > maxAge) {
        this.combatParticipants.delete(id);
      }
    }
    
    // Clean building activity
    for (const [id, building] of this.buildingActivity) {
      if (now - building.lastActivity > maxAge) {
        this.buildingActivity.delete(id);
      }
    }
    
    // Clean economic activity
    for (const [id, economic] of this.economicActivity) {
      if (now - economic.lastActivity > maxAge) {
        this.economicActivity.delete(id);
      }
    }
    
    // Clean recent events
    this.recentEvents = this.recentEvents.filter(e => 
      now - e.timestamp < maxAge
    );
  }
  
  addRecentEvent(event) {
    this.recentEvents.push({
      subject: event.subject,
      category: event.category,
      timestamp: event.timestamp || Date.now()
    });
    
    // Keep only recent events
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.shift();
    }
  }
  
  // ============================================================================
  // CAMERA CONTROL
  // ============================================================================
  
  sendCameraCommand(targetId, position) {
    // This will be called by the client-side camera system
    // For now, we'll dispatch a custom event that the camera can listen to
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      const event = new CustomEvent('spectatorCameraTarget', {
        detail: {
          targetId: targetId,
          position: position,
          reason: this.currentTarget ? this.currentTarget.reason : 'unknown'
        }
      });
      window.dispatchEvent(event);
    }
  }
  
  // ============================================================================
  // DEBUGGING & STATUS
  // ============================================================================
  
  getStatus() {
    return {
      isActive: this.isActive,
      currentTarget: this.currentTarget,
      combatParticipants: this.combatParticipants.size,
      buildingActivity: this.buildingActivity.size,
      economicActivity: this.economicActivity.size,
      recentEvents: this.recentEvents.length
    };
  }
  
  getDebugInfo() {
    return {
      combatParticipants: Array.from(this.combatParticipants.entries()).map(([id, data]) => ({
        id,
        damage: data.damage,
        attacks: data.attacks,
        lastActivity: new Date(data.lastActivity).toISOString()
      })),
      buildingActivity: Array.from(this.buildingActivity.entries()).map(([id, data]) => ({
        id,
        completions: data.completions,
        lastActivity: new Date(data.lastActivity).toISOString()
      })),
      economicActivity: Array.from(this.economicActivity.entries()).map(([id, data]) => ({
        id,
        milestones: data.milestones,
        totalQuantity: data.totalQuantity,
        lastActivity: new Date(data.lastActivity).toISOString()
      }))
    };
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpectatorDirector;
} else if (typeof window !== 'undefined') {
  window.SpectatorDirector = SpectatorDirector;
}
