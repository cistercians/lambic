// Social System - Coordinates NPC social interactions and conversations
// Manages conversation triggers, proximity detection, and speech bubbles

const NPCMemory = require('./NPCMemory.js');
const ChatEngine = require('./ChatEngine.js');

class SocialSystem {
  constructor() {
    this.chatEngine = new ChatEngine();
    this.npcMemories = new Map(); // npcId -> NPCMemory
    
    // Conversation sessions - tracks active dialogues
    this.conversationSessions = new Map(); // sessionId -> {participants: [id1, id2], startTime, lastMessageTime}
    this.participantToSession = new Map(); // participantId -> sessionId
    
    // NPC spontaneous conversation settings
    this.spontaneousChancePerMinute = 0.05; // 5% chance per minute for idle NPCs
    this.conversationRadius = 128; // 2 tiles (128px) - must be within this to converse
    this.lastSpontaneousCheckTime = Date.now();
    
    // Speech bubble tracking
    this.activeSpeechBubbles = new Map(); // participantId -> timeout
  }
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  /**
   * Initialize NPC with social profile
   */
  initializeNPC(npc) {
    if (!this.npcMemories.has(npc.id)) {
      this.npcMemories.set(npc.id, new NPCMemory(npc.id));
    }
    return this.npcMemories.get(npc.id);
  }
  
  /**
   * Remove NPC from system (on death/removal)
   */
  removeNPC(npcId) {
    this.npcMemories.delete(npcId);
    
    // End any active conversation session
    const sessionId = this.participantToSession.get(npcId);
    if (sessionId) {
      this.endConversation(sessionId);
    }
    
    // Clear speech bubble if active
    if (this.activeSpeechBubbles.has(npcId)) {
      const timeout = this.activeSpeechBubbles.get(npcId);
      if (timeout) clearTimeout(timeout);
      this.activeSpeechBubbles.delete(npcId);
    }
  }
  
  /**
   * Get or create memory for NPC
   */
  getMemory(npcId) {
    if (!this.npcMemories.has(npcId)) {
      this.npcMemories.set(npcId, new NPCMemory(npcId));
    }
    return this.npcMemories.get(npcId);
  }
  
  // ============================================================================
  // CONVERSATION SESSION MANAGEMENT
  // ============================================================================
  
  /**
   * Start a new conversation session
   */
  startConversation(id1, id2) {
    const sessionId = `${id1}-${id2}-${Date.now()}`;
    
    this.conversationSessions.set(sessionId, {
      participants: [id1, id2],
      startTime: Date.now(),
      lastMessageTime: Date.now()
    });
    
    this.participantToSession.set(id1, sessionId);
    this.participantToSession.set(id2, sessionId);
    
    // Show speech bubbles for both participants
    this.showSpeechBubble(id1, 0); // 0 = permanent until conversation ends
    this.showSpeechBubble(id2, 0);
    
    return sessionId;
  }
  
  /**
   * End a conversation session
   */
  endConversation(sessionId) {
    const session = this.conversationSessions.get(sessionId);
    if (!session) return;
    
    // Hide speech bubbles
    for (const participantId of session.participants) {
      this.hideSpeechBubble(participantId);
      this.participantToSession.delete(participantId);
    }
    
    this.conversationSessions.delete(sessionId);
  }
  
  /**
   * Check if character is in a conversation
   */
  isInConversation(characterId) {
    return this.participantToSession.has(characterId);
  }
  
  /**
   * Get conversation session for a character
   */
  getConversationSession(characterId) {
    const sessionId = this.participantToSession.get(characterId);
    return sessionId ? this.conversationSessions.get(sessionId) : null;
  }
  
  /**
   * Update conversation activity
   */
  updateConversationActivity(sessionId) {
    const session = this.conversationSessions.get(sessionId);
    if (session) {
      session.lastMessageTime = Date.now();
    }
  }
  
  /**
   * Check if conversation should end due to distance
   */
  checkConversationProximity() {
    for (const [sessionId, session] of this.conversationSessions) {
      const [id1, id2] = session.participants;
      const char1 = global.Player?.list[id1];
      const char2 = global.Player?.list[id2];
      
      if (!char1 || !char2) {
        this.endConversation(sessionId);
        continue;
      }
      
      // Check if they're still on same z-level
      if (char1.z !== char2.z) {
        this.endConversation(sessionId);
        continue;
      }
      
      // Check distance
      const distance = Math.sqrt(
        Math.pow(char1.x - char2.x, 2) + 
        Math.pow(char1.y - char2.y, 2)
      );
      
      // End conversation if they move apart (2 tiles = 128px)
      if (distance > this.conversationRadius) {
        this.endConversation(sessionId);
      }
    }
  }
  
  // ============================================================================
  // PLAYER-INITIATED CONVERSATIONS
  // ============================================================================
  
  /**
   * Handle player talking to NPC
   */
  handlePlayerToNPC(playerId, npcId, message) {
    const player = global.Player?.list[playerId];
    const npc = global.Player?.list[npcId];
    
    if (!player || !npc) return;
    if (npc.type !== 'npc') return; // Only NPCs can have conversations
    
    // Get NPC memory
    const memory = this.getMemory(npcId);
    
    // Record acquaintance
    memory.addAcquaintance(playerId, {
      name: player.name,
      class: player.class,
      house: player.house,
      kingdom: player.kingdom
    });
    
    // Parse player message
    const parsedInput = this.chatEngine.parse(message);
    
    // Check if NPC is busy working
    const npcIsBusy = npc.working || npc.chopping || npc.mining || 
                      npc.farming || npc.building || npc.fishing ||
                      npc.action === 'combat' || npc.action === 'flee';
    
    // Check for farewell intent
    if (parsedInput.intent === 'farewell') {
      const sessionId = this.participantToSession.get(playerId);
      if (sessionId) {
        // Generate farewell response then end conversation
        const npcContext = {
          npc: npc,
          memory: memory,
          dialogues: global.dialogues || {},
          targetId: playerId
        };
        const response = this.chatEngine.generateResponse(parsedInput, npcContext);
        
        // Create event in EventManager (handles console logging and broadcasting to nearby players)
        if (global.eventManager) {
          global.eventManager.createEvent({
            category: global.eventManager.categories.SOCIAL,
            subject: npc.id,
            subjectName: npc.name || npc.class,
            action: 'said',
            message: this.chatEngine.formatSpeech(npc, response),
            communication: global.eventManager.commModes.AREA,
            log: `[SOCIAL] ${npc.name || npc.class} said: "${response}" at [${Math.floor(npc.x)},${Math.floor(npc.y)}] z=${npc.z}`,
            position: { x: npc.x, y: npc.y, z: npc.z }
          });
        }
        
        // End conversation after farewell
        this.endConversation(sessionId);
        
        // Record conversation for cooldown after it ends
        memory.recordConversation(playerId, parsedInput.topic);
        memory.startConversation();
        return;
      }
    }
    
    // If NPC is busy, only give brief contextual responses (no conversation session)
    if (npcIsBusy) {
      this.handleBusyNPCResponse(playerId, npc, memory, parsedInput);
      return;
    }
    
    // Check if already in conversation with this NPC
    let sessionId = this.participantToSession.get(playerId);
    let session = sessionId ? this.conversationSessions.get(sessionId) : null;
    
    if (session && session.participants.includes(npcId)) {
      // Continue existing conversation - no cooldowns
      this.updateConversationActivity(sessionId);
    } else if (this.isInConversation(playerId)) {
      // Player is talking to someone else - ignore
      return;
    } else if (this.isInConversation(npcId)) {
      // NPC is talking to someone else
      const socket = global.SOCKET_LIST[playerId];
      if (socket) {
        const response = this.chatEngine.formatSpeech(npc, "I be speaking with someone else at present.");
        socket.write(JSON.stringify({ msg: 'addToChat', message: response }));
      }
      return;
    } else {
      // Check cooldown before starting new conversation
      const acquaintance = memory.getAcquaintance(playerId);
      const timeSinceLastChat = acquaintance ? (Date.now() - acquaintance.lastConversationTime) : Infinity;
      
      if (timeSinceLastChat < 10000) { // 10 seconds cooldown between conversations
        // Too soon, skip silently
        return;
      }
      
      // Start new conversation session
      sessionId = this.startConversation(playerId, npcId);
    }
    
    // Generate response
    const npcContext = {
      npc: npc,
      memory: memory,
      dialogues: global.dialogues || {},
      targetId: playerId
    };
    
    const response = this.chatEngine.generateResponse(parsedInput, npcContext);
    
    // Record conversation
    memory.recordConversation(playerId, parsedInput.topic);
    memory.startConversation();
    
    // Create event in EventManager (handles console logging and broadcasting to nearby players)
    if (global.eventManager) {
      global.eventManager.createEvent({
        category: global.eventManager.categories.SOCIAL,
        subject: npc.id,
        subjectName: npc.name || npc.class,
        action: 'said',
        message: this.chatEngine.formatSpeech(npc, response),
        communication: global.eventManager.commModes.AREA,
        log: `[SOCIAL] ${npc.name || npc.class} said: "${response}" at [${Math.floor(npc.x)},${Math.floor(npc.y)}] z=${npc.z}`,
        position: { x: npc.x, y: npc.y, z: npc.z }
      });
    }
    
    // Show speech bubble
    this.showSpeechBubble(npcId);
  }
  
  /**
   * Handle brief response from busy NPC (working, in combat, etc)
   */
  handleBusyNPCResponse(playerId, npc, memory, parsedInput) {
    const socket = global.SOCKET_LIST[playerId];
    if (!socket) return;
    
    // Cooldown check - busy NPCs respond less frequently
    const acquaintance = memory.getAcquaintance(playerId);
    const timeSinceLastChat = acquaintance ? (Date.now() - acquaintance.lastConversationTime) : Infinity;
    
    if (timeSinceLastChat < 30000) { // 30 seconds for busy NPCs
      return; // Too soon, ignore silently
    }
    
    // Generate brief contextual response
    let response = '';
    
    // Check what they're doing
    if (npc.chopping) {
      const busyResponses = ['*chop* Busy! *chop*', 'Cannot talk now... *chop*', 'Working here!'];
      response = busyResponses[Math.floor(Math.random() * busyResponses.length)];
    } else if (npc.mining) {
      const busyResponses = ['*mining* Not now!', 'Busy mining!', 'Canst see I be busy!'];
      response = busyResponses[Math.floor(Math.random() * busyResponses.length)];
    } else if (npc.farming) {
      const busyResponses = ['Working the fields!', 'Busy farming!', 'Not now, I be busy!'];
      response = busyResponses[Math.floor(Math.random() * busyResponses.length)];
    } else if (npc.building) {
      const busyResponses = ['Building here!', 'Busy with construction!', 'Not now!'];
      response = busyResponses[Math.floor(Math.random() * busyResponses.length)];
    } else if (npc.fishing) {
      const busyResponses = ['Shhh! Fishing!', 'Quiet... the fish will hear!', 'Fishing here!'];
      response = busyResponses[Math.floor(Math.random() * busyResponses.length)];
    } else if (npc.action === 'combat') {
      const busyResponses = ['*fighting* Not now!', 'In combat!', 'Busy fighting!'];
      response = busyResponses[Math.floor(Math.random() * busyResponses.length)];
    } else if (npc.action === 'flee') {
      const busyResponses = ['*running* Can\'t talk!', 'Fleeing!', 'No time!'];
      response = busyResponses[Math.floor(Math.random() * busyResponses.length)];
    } else if (parsedInput.intent === 'greeting') {
      // Simple greeting while busy
      const greetings = ['*nods*', 'Aye.', 'Hail.', '*waves briefly*'];
      response = greetings[Math.floor(Math.random() * greetings.length)];
    } else {
      // Default busy response
      response = 'I be busy at present.';
    }
    
    // Create event in EventManager (handles console logging and broadcasting to nearby players)
    if (global.eventManager) {
      global.eventManager.createEvent({
        category: global.eventManager.categories.SOCIAL,
        subject: npc.id,
        subjectName: npc.name || npc.class,
        action: 'said',
        message: this.chatEngine.formatSpeech(npc, response),
        communication: global.eventManager.commModes.AREA,
        log: `[SOCIAL] ${npc.name || npc.class} said: "${response}" at [${Math.floor(npc.x)},${Math.floor(npc.y)}] z=${npc.z}`,
        position: { x: npc.x, y: npc.y, z: npc.z }
      });
    }
    
    // Show temporary speech bubble (3 seconds, not permanent)
    this.showSpeechBubble(npc.id, 3000);
    
    // Record brief interaction
    memory.recordConversation(playerId, 'brief');
    memory.startConversation();
  }
  
  // ============================================================================
  // NPC-INITIATED CONVERSATIONS
  // ============================================================================
  
  /**
   * Update - check for spontaneous NPC conversations and proximity
   * Called from main game loop
   */
  update() {
    const now = Date.now();
    
    // Check conversation proximity every frame (cheap operation)
    this.checkConversationProximity();
    
    // Check for spontaneous conversations every 30 seconds
    if (now - this.lastSpontaneousCheckTime > 30000) {
      this.checkSpontaneousConversations();
      this.lastSpontaneousCheckTime = now;
    }
  }
  
  /**
   * Check if any NPCs want to spontaneously chat
   */
  checkSpontaneousConversations() {
    if (!global.Player?.list) return;
    
    // Get all humanoid NPCs that are IDLE
    const npcs = Object.values(global.Player.list).filter(p => {
      if (p.type !== 'npc') return false;
      if (!this.isHumanoidNPC(p)) return false;
      
      // Only idle NPCs can spontaneously chat
      const isBusy = p.working || p.chopping || p.mining || 
                     p.farming || p.building || p.fishing ||
                     p.action === 'combat' || p.action === 'flee';
      
      return !isBusy;
    });
    
    for (const npc of npcs) {
      // Skip if already in conversation
      if (this.isInConversation(npc.id)) continue;
      
      const memory = this.getMemory(npc.id);
      
      // Check if can initiate conversation
      if (!memory.canInitiateConversation()) continue;
      
      // Random chance to want to chat
      if (Math.random() > this.spontaneousChancePerMinute) continue;
      
      // Find nearby characters to chat with
      const nearby = this.findNearbyCharacters(npc, this.conversationRadius);
      
      if (nearby.length > 0) {
        // Pick random target
        const target = nearby[Math.floor(Math.random() * nearby.length)];
        this.initiateNPCConversation(npc, target, memory);
      }
    }
  }
  
  /**
   * NPC initiates conversation with another character
   */
  initiateNPCConversation(npc, target, memory) {
    // Check if target is idle (for players and NPCs)
    const targetIsBusy = target.working || target.chopping || target.mining || 
                         target.farming || target.building || target.fishing ||
                         target.action === 'combat' || target.action === 'flee';
    
    if (targetIsBusy) {
      // Don't start dialogue session with busy characters
      return;
    }
    
    // Check if target is already in a conversation
    if (this.isInConversation(target.id)) return;
    
    // Record acquaintance
    memory.addAcquaintance(target.id, {
      name: target.name || target.class,
      class: target.class,
      house: target.house,
      kingdom: target.kingdom
    });
    
    // Check if can talk to this person
    if (!memory.canConversateWith(target.id)) return;
    
    // Generate spontaneous greeting/comment
    const message = this.generateSpontaneousMessage(npc, target, memory);
    
    if (!message) return;
    
    // Start conversation session
    const sessionId = this.startConversation(npc.id, target.id);
    
    // Record conversation
    memory.recordConversation(target.id, 'greeting');
    memory.startConversation();
    
    // Create event in EventManager (handles console logging and broadcasting to nearby players)
    if (global.eventManager) {
      global.eventManager.createEvent({
        category: global.eventManager.categories.SOCIAL,
        subject: npc.id,
        subjectName: npc.name || npc.class,
        action: 'said',
        message: this.chatEngine.formatSpeech(npc, message),
        communication: global.eventManager.commModes.AREA,
        log: `[SOCIAL] ${npc.name || npc.class} said: "${message}" at [${Math.floor(npc.x)},${Math.floor(npc.y)}] z=${npc.z}`,
        position: { x: npc.x, y: npc.y, z: npc.z }
      });
    }
  }
  
  /**
   * Generate spontaneous message for NPC
   */
  generateSpontaneousMessage(npc, target, memory) {
    const relationship = memory.getAcquaintance(target.id)?.relationship || 'stranger';
    
    // Check for recent events to comment on
    const recentEvent = memory.getRecentEvent(600000); // 10 minutes
    
    if (recentEvent) {
      if (recentEvent.type === 'combat_attacked') {
        return `Be careful out there! I was just attacked by ${recentEvent.details.attackerName || 'an enemy'}!`;
      }
      if (recentEvent.type === 'death_witnessed') {
        return `Did you see that? ${recentEvent.details.victimName || 'Someone'} was slain! Terrible...`;
      }
    }
    
    // Relationship-based greetings
    if (relationship === 'friend') {
      const greetings = [
        `Good to see you, ${target.name || 'friend'}!`,
        `Ah, ${target.name || 'friend'}! How goes it?`,
        `${target.name || 'Friend'}! Been a while.`
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }
    
    if (relationship === 'acquaintance') {
      const greetings = [
        'Greetings!',
        'Hail, traveler!',
        'Well met!'
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }
    
    // Stranger - less likely to initiate, but if they do...
    if (Math.random() < 0.3) { // 30% chance to actually say something
      return 'Greetings, stranger.';
    }
    
    return null; // Don't say anything
  }
  
  // ============================================================================
  // EVENT RECORDING
  // ============================================================================
  
  /**
   * Record combat event
   */
  recordCombatEvent(victimId, attackerId) {
    const victim = global.Player?.list[victimId];
    const attacker = global.Player?.list[attackerId];
    
    if (!victim || !attacker) return;
    
    const victimMemory = this.getMemory(victimId);
    
    victimMemory.addEvent({
      type: 'combat_attacked',
      description: `Attacked by ${attacker.name || attacker.class}`,
      involvedCharacters: [attackerId],
      details: {
        attackerName: attacker.name || attacker.class,
        attackerClass: attacker.class
      }
    });
    
    // Mark as enemy
    victimMemory.setEnemy(attackerId, {
      name: attacker.name,
      class: attacker.class,
      house: attacker.house,
      kingdom: attacker.kingdom
    });
  }
  
  /**
   * Record death witnessed by nearby NPCs
   */
  recordDeathWitnessed(victimId, location, withinRadius = 1280) {
    const victim = global.Player?.list[victimId];
    if (!victim) return;
    
    // Find nearby NPCs who witnessed it
    const witnesses = this.findNearbyCharacters(victim, withinRadius, true); // NPCs only
    
    for (const witness of witnesses) {
      const memory = this.getMemory(witness.id);
      memory.addEvent({
        type: 'death_witnessed',
        description: `Witnessed death of ${victim.name || victim.class}`,
        involvedCharacters: [victimId],
        location: location,
        details: {
          victimName: victim.name || victim.class,
          victimClass: victim.class
        }
      });
    }
  }
  
  /**
   * Record trade event
   */
  recordTradeEvent(npcId, traderId) {
    const memory = this.getMemory(npcId);
    const trader = global.Player?.list[traderId];
    
    if (!trader) return;
    
    memory.addEvent({
      type: 'trade',
      description: `Traded with ${trader.name || trader.class}`,
      involvedCharacters: [traderId],
      details: {
        traderName: trader.name || trader.class
      }
    });
    
    memory.addAcquaintance(traderId, {
      name: trader.name,
      class: trader.class,
      house: trader.house,
      kingdom: trader.kingdom
    });
  }
  
  // ============================================================================
  // SPEECH BUBBLES
  // ============================================================================
  
  /**
   * Show speech bubble emoji next to character
   * @param {string} characterId - Character ID
   * @param {number} duration - Duration in ms, 0 = permanent (until hideSpeechBubble called)
   */
  showSpeechBubble(characterId, duration = 3000) {
    // Clear existing timeout if any
    if (this.activeSpeechBubbles.has(characterId)) {
      const existingTimeout = this.activeSpeechBubbles.get(characterId);
      if (existingTimeout) clearTimeout(existingTimeout);
    }
    
    // Broadcast to nearby players
    this.broadcastSpeechBubble(characterId, true);
    
    // Set timeout to hide bubble (if not permanent)
    if (duration > 0) {
      const timeout = setTimeout(() => {
        this.broadcastSpeechBubble(characterId, false);
        this.activeSpeechBubbles.delete(characterId);
      }, duration);
      
      this.activeSpeechBubbles.set(characterId, timeout);
    } else {
      // Permanent bubble (for conversations)
      this.activeSpeechBubbles.set(characterId, null);
    }
  }
  
  /**
   * Hide speech bubble for character
   */
  hideSpeechBubble(characterId) {
    if (this.activeSpeechBubbles.has(characterId)) {
      const timeout = this.activeSpeechBubbles.get(characterId);
      if (timeout) clearTimeout(timeout);
      this.activeSpeechBubbles.delete(characterId);
    }
    
    this.broadcastSpeechBubble(characterId, false);
  }
  
  /**
   * Broadcast speech bubble state to clients
   */
  broadcastSpeechBubble(npcId, show) {
    const npc = global.Player?.list[npcId];
    if (!npc) return;
    
    const message = JSON.stringify({
      msg: 'npcSpeaking',
      id: npcId,
      show: show
    });
    
    // Send to all connected players
    if (global.SOCKET_LIST) {
      for (const socketId in global.SOCKET_LIST) {
        const socket = global.SOCKET_LIST[socketId];
        if (socket) {
          socket.write(message);
        }
      }
    }
  }
  
  /**
   * Broadcast NPC message to nearby players
   */
  broadcastNPCMessage(npc, message, radius = 512) {
    const formattedMessage = this.chatEngine.formatSpeech(npc, message);
    
    if (!global.Player?.list || !global.SOCKET_LIST) return;
    
    // Find nearby players
    for (const playerId in global.Player.list) {
      const player = global.Player.list[playerId];
      if (player.type !== 'player') continue;
      if (player.z !== npc.z) continue;
      
      const distance = Math.sqrt(
        Math.pow(player.x - npc.x, 2) + 
        Math.pow(player.y - npc.y, 2)
      );
      
      if (distance <= radius) {
        const socket = global.SOCKET_LIST[playerId];
        if (socket) {
          socket.write(JSON.stringify({
            msg: 'addToChat',
            message: formattedMessage
          }));
        }
      }
    }
  }
  
  // ============================================================================
  // UTILITY
  // ============================================================================
  
  /**
   * Find nearby characters (NPCs or players)
   */
  findNearbyCharacters(origin, radius, npcsOnly = false) {
    const nearby = [];
    
    if (!global.Player?.list) return nearby;
    
    for (const id in global.Player.list) {
      const char = global.Player.list[id];
      if (char.id === origin.id) continue; // Skip self
      if (char.z !== origin.z) continue; // Different z-level
      
      if (npcsOnly && char.type !== 'npc') continue;
      
      const distance = Math.sqrt(
        Math.pow(char.x - origin.x, 2) + 
        Math.pow(char.y - origin.y, 2)
      );
      
      if (distance <= radius) {
        nearby.push(char);
      }
    }
    
    return nearby;
  }
  
  /**
   * Check if NPC is humanoid (can have conversations)
   */
  isHumanoidNPC(npc) {
    const humanoidClasses = [
      'serf', 'serfm', 'serff', 'innkeeper',
      'knight', 'archer', 'footsoldier', 'cavalry', 'swordsman',
      'monk', 'bishop', 'friar', 'druid', 'priest',
      'hunter', 'rogue', 'mage', 'warlock',
      'king', 'general', 'crusader', 'templar'
    ];
    
    return humanoidClasses.includes(npc.class?.toLowerCase());
  }
  
  /**
   * Get system statistics
   */
  getStats() {
    return {
      totalNPCs: this.npcMemories.size,
      activeConversations: this.conversationSessions.size,
      activeSpeechBubbles: this.activeSpeechBubbles.size,
      totalAcquaintances: Array.from(this.npcMemories.values())
        .reduce((sum, mem) => sum + mem.acquaintances.size, 0),
      totalEvents: Array.from(this.npcMemories.values())
        .reduce((sum, mem) => sum + mem.eventMemories.length, 0)
    };
  }
}

module.exports = SocialSystem;

