// NPC Memory System
// Manages acquaintances, event memories, and conversational history for NPCs

class NPCMemory {
  constructor(npcId) {
    this.npcId = npcId;
    
    // Acquaintances tracking
    this.acquaintances = new Map(); // id -> acquaintance data
    this.maxAcquaintances = 10;
    
    // Event memories (significant life events)
    this.eventMemories = [];
    this.maxEventMemories = 20;
    
    // Last conversation timestamp (global cooldown)
    this.lastConversationTime = 0;
    this.conversationCooldown = 30000; // 30 seconds between conversations
  }
  
  // ============================================================================
  // ACQUAINTANCE MANAGEMENT
  // ============================================================================
  
  /**
   * Add or update an acquaintance
   * @param {string} targetId - Character ID
   * @param {object} targetData - Character data (name, class, house, kingdom)
   */
  addAcquaintance(targetId, targetData) {
    if (!this.acquaintances.has(targetId)) {
      // New acquaintance
      this.acquaintances.set(targetId, {
        id: targetId,
        name: targetData.name || targetData.class,
        class: targetData.class,
        house: targetData.house,
        kingdom: targetData.kingdom,
        relationship: 'stranger', // stranger, acquaintance, friend, enemy
        interactionCount: 0,
        firstMet: Date.now(),
        lastInteraction: Date.now(),
        conversationTopics: [], // Topics discussed
        lastConversationTime: 0
      });
      
      // Limit acquaintances to prevent memory bloat
      if (this.acquaintances.size > this.maxAcquaintances) {
        // Remove oldest acquaintance (by last interaction)
        let oldestId = null;
        let oldestTime = Infinity;
        for (const [id, data] of this.acquaintances) {
          if (data.lastInteraction < oldestTime) {
            oldestTime = data.lastInteraction;
            oldestId = id;
          }
        }
        if (oldestId) {
          this.acquaintances.delete(oldestId);
        }
      }
    } else {
      // Update existing acquaintance
      const acquaintance = this.acquaintances.get(targetId);
      acquaintance.lastInteraction = Date.now();
      acquaintance.interactionCount++;
      
      // Update relationship level based on interaction count
      if (acquaintance.interactionCount >= 10) {
        acquaintance.relationship = 'friend';
      } else if (acquaintance.interactionCount >= 3) {
        acquaintance.relationship = 'acquaintance';
      }
    }
  }
  
  /**
   * Mark someone as enemy
   */
  setEnemy(targetId, targetData) {
    this.addAcquaintance(targetId, targetData);
    const acquaintance = this.acquaintances.get(targetId);
    if (acquaintance) {
      acquaintance.relationship = 'enemy';
    }
  }
  
  /**
   * Get acquaintance data
   */
  getAcquaintance(targetId) {
    return this.acquaintances.get(targetId) || null;
  }
  
  /**
   * Check if can have conversation (respects cooldown per acquaintance)
   */
  canConversateWith(targetId) {
    const acquaintance = this.acquaintances.get(targetId);
    if (!acquaintance) return true; // Can talk to strangers
    
    const timeSinceLastChat = Date.now() - acquaintance.lastConversationTime;
    return timeSinceLastChat > 300000; // 5 minutes between conversations with same person
  }
  
  /**
   * Record a conversation topic
   */
  recordConversation(targetId, topic) {
    const acquaintance = this.acquaintances.get(targetId);
    if (acquaintance) {
      if (!acquaintance.conversationTopics.includes(topic)) {
        acquaintance.conversationTopics.push(topic);
        
        // Limit topics to last 5
        if (acquaintance.conversationTopics.length > 5) {
          acquaintance.conversationTopics.shift();
        }
      }
      acquaintance.lastConversationTime = Date.now();
    }
  }
  
  /**
   * Check if topic was recently discussed
   */
  hasDiscussedTopic(targetId, topic) {
    const acquaintance = this.acquaintances.get(targetId);
    if (!acquaintance) return false;
    return acquaintance.conversationTopics.includes(topic);
  }
  
  // ============================================================================
  // EVENT MEMORY MANAGEMENT
  // ============================================================================
  
  /**
   * Add an event to memory
   * @param {object} event - Event data
   */
  addEvent(event) {
    const memoryEvent = {
      type: event.type, // 'combat', 'death_witnessed', 'trade', 'joined_faction', etc.
      timestamp: Date.now(),
      description: event.description,
      involvedCharacters: event.involvedCharacters || [],
      location: event.location || null,
      details: event.details || {}
    };
    
    this.eventMemories.unshift(memoryEvent); // Add to front (most recent)
    
    // Maintain max size (FIFO)
    if (this.eventMemories.length > this.maxEventMemories) {
      this.eventMemories.pop();
    }
  }
  
  /**
   * Get recent events of a specific type
   */
  getEventsByType(type, limit = 5) {
    return this.eventMemories
      .filter(event => event.type === type)
      .slice(0, limit);
  }
  
  /**
   * Get most recent event
   */
  getRecentEvent(withinMs = 600000) { // Default: within last 10 minutes
    if (this.eventMemories.length === 0) return null;
    
    const recent = this.eventMemories[0];
    if (Date.now() - recent.timestamp <= withinMs) {
      return recent;
    }
    return null;
  }
  
  /**
   * Get events involving a specific character
   */
  getEventsWithCharacter(characterId, limit = 3) {
    return this.eventMemories
      .filter(event => event.involvedCharacters.includes(characterId))
      .slice(0, limit);
  }
  
  /**
   * Check if recently attacked by someone
   */
  wasRecentlyAttackedBy(characterId, withinMs = 300000) { // 5 minutes
    const combatEvents = this.getEventsByType('combat_attacked', 3);
    for (const event of combatEvents) {
      if (event.involvedCharacters.includes(characterId) && 
          Date.now() - event.timestamp <= withinMs) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Check if witnessed death recently
   */
  witnessedDeathRecently(withinMs = 600000) { // 10 minutes
    const deathEvents = this.getEventsByType('death_witnessed', 1);
    if (deathEvents.length > 0) {
      return Date.now() - deathEvents[0].timestamp <= withinMs;
    }
    return false;
  }
  
  // ============================================================================
  // CONVERSATION COOLDOWN
  // ============================================================================
  
  /**
   * Check if NPC can initiate conversation (global cooldown)
   */
  canInitiateConversation() {
    const timeSinceLast = Date.now() - this.lastConversationTime;
    return timeSinceLast > this.conversationCooldown;
  }
  
  /**
   * Mark that NPC is in conversation
   */
  startConversation() {
    this.lastConversationTime = Date.now();
  }
  
  // ============================================================================
  // UTILITY
  // ============================================================================
  
  /**
   * Get summary for debugging
   */
  getSummary() {
    return {
      acquaintances: this.acquaintances.size,
      eventMemories: this.eventMemories.length,
      recentEvent: this.eventMemories[0] || null,
      canChat: this.canInitiateConversation()
    };
  }
}

module.exports = NPCMemory;

