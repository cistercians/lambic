// Chat Engine - Pattern Matching NLP System
// Handles intent classification, entity recognition, and response generation

class ChatEngine {
  constructor() {
    // Pattern definitions for intent classification
    this.patterns = {
      greeting: [
        /^(hello|hi|hey|greetings|hail|good (morning|afternoon|evening|day))/i,
        /^(howdy|salutations|well met|sup|yo)/i,
        /(greetings|hello|hi|hey)/i  // Match anywhere in message
      ],
      farewell: [
        /^(goodbye|bye|farewell|see you|later|take care)/i,
        /(goodbye|bye|farewell|gotta go)/i
      ],
      question_howAreYou: [
        /(how (are|do) you|how('s| is) it going|what('s| is) up)/i,
        /(you (okay|alright|good|well))/i,
        /(doing (okay|alright|well|good))/i
      ],
      question_seen: [
        /((have you )?seen|know (where|about)|heard (of|about)).+(any|enemy|enemies|wolf|deer|boar|knight|player|building)/i,
        /(seen any|notice any|spot any)/i,
        /(danger|threat|enemy|enemies|wolf|wolves)/i
      ],
      question_whatDoYouDo: [
        /(what (do|are) you (do|doing)|what('s| is) your (job|work|role))/i,
        /(your (work|job|role|duty))/i,
        /(what brings you|why are you here)/i
      ],
      question_location: [
        /(where (is|are)|do you know where|can you tell me where)/i,
        /(looking for|trying to find|need to find)/i
      ],
      question_faction: [
        /(your (faction|house|kingdom|allegiance)|who do you (serve|follow|support))/i,
        /(which (faction|house|side))/i
      ],
      question_trade: [
        /(trade|buy|sell|have any|got any).+(wood|stone|iron|gold|weapon|armor|food)/i,
        /(need|want|looking for).+(wood|stone|iron|gold)/i
      ],
      statement_complaint: [
        /(tired|exhausted|difficult|hard work|my back|aches|hungry|thirsty)/i
      ],
      statement_weather: [
        /(nice (day|weather)|beautiful|cold|hot|rainy)/i,
        /(weather|rain|sun|wind)/i
      ],
      question_general: [
        /(what|why|how|when|where|who)/i  // Catch any question words
      ]
    };
    
    // Entity extraction patterns
    this.entities = {
      enemies: ['wolf', 'wolves', 'boar', 'enemy', 'enemies', 'bandit', 'outlaws'],
      animals: ['deer', 'wolf', 'wolves', 'boar', 'falcon', 'sheep'],
      resources: ['wood', 'stone', 'iron', 'gold', 'silver', 'grain', 'diamond'],
      buildings: ['mill', 'mine', 'lumbermill', 'farm', 'tavern', 'hut', 'stronghold'],
      classes: ['serf', 'knight', 'archer', 'monk', 'bishop', 'hunter', 'rogue', 'mage']
    };
    
    // Topic keywords for conversation memory
    this.topicKeywords = {
      weather: ['weather', 'rain', 'cold', 'hot', 'nice day'],
      work: ['work', 'job', 'tired', 'busy', 'hauling', 'chopping', 'mining'],
      faction: ['faction', 'house', 'kingdom', 'allegiance', 'serve', 'loyalty'],
      danger: ['danger', 'enemy', 'wolf', 'attack', 'combat', 'fight', 'death'],
      trade: ['trade', 'buy', 'sell', 'gold', 'market'],
      location: ['where', 'location', 'place', 'find']
    };
  }
  
  // ============================================================================
  // INPUT PARSING
  // ============================================================================
  
  /**
   * Parse player input and extract intent, entities, and topic
   */
  parse(message) {
    const lowerMessage = message.toLowerCase().trim();
    
    return {
      originalMessage: message,
      intent: this.classifyIntent(lowerMessage),
      entities: this.extractEntities(lowerMessage),
      topic: this.extractTopic(lowerMessage),
      keywords: this.extractKeywords(lowerMessage)
    };
  }
  
  /**
   * Classify the intent of the message
   */
  classifyIntent(message) {
    for (const [intent, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          return intent;
        }
      }
    }
    return 'unknown';
  }
  
  /**
   * Extract entities (NPCs, items, locations) from message
   */
  extractEntities(message) {
    const found = {
      enemies: [],
      animals: [],
      resources: [],
      buildings: [],
      classes: []
    };
    
    for (const [category, items] of Object.entries(this.entities)) {
      for (const item of items) {
        if (message.includes(item)) {
          found[category].push(item);
        }
      }
    }
    
    return found;
  }
  
  /**
   * Extract primary topic for conversation memory
   */
  extractTopic(message) {
    for (const [topic, keywords] of Object.entries(this.topicKeywords)) {
      for (const keyword of keywords) {
        if (message.includes(keyword)) {
          return topic;
        }
      }
    }
    return 'general';
  }
  
  /**
   * Extract important keywords
   */
  extractKeywords(message) {
    // Simple keyword extraction - split and filter common words
    const commonWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 
                         'have', 'has', 'had', 'can', 'could', 'will', 'would', 'you', 'your'];
    
    const words = message.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.includes(word));
    
    return words.slice(0, 5); // Return top 5 keywords
  }
  
  // ============================================================================
  // RESPONSE GENERATION
  // ============================================================================
  
  /**
   * Generate a response based on parsed input and NPC context
   */
  generateResponse(parsedInput, npcContext) {
    const { intent, entities, topic } = parsedInput;
    const { npc, memory, dialogues } = npcContext;
    
    // Allow repeated topics - removed overly aggressive repetition check
    // NPCs can discuss the same topics naturally in conversation
    
    // Generate response based on intent
    switch (intent) {
      case 'greeting':
        return this.generateGreeting(npc, memory, npcContext.targetId, dialogues);
        
      case 'farewell':
        return this.generateFarewell(npc, dialogues);
        
      case 'question_howAreYou':
        return this.generateStatusResponse(npc, memory, dialogues);
        
      case 'question_seen':
        return this.generateSeenResponse(npc, memory, entities, dialogues);
        
      case 'question_whatDoYouDo':
        return this.generateWorkResponse(npc, dialogues);
        
      case 'question_faction':
        return this.generateFactionResponse(npc, dialogues);
        
      case 'question_location':
        return this.generateLocationResponse(npc, entities, dialogues);
        
      case 'question_trade':
        return this.generateTradeResponse(npc, entities, dialogues);
      
      case 'question_general':
        return this.generateGeneralResponse(npc, memory, dialogues);
        
      default:
        return this.generateDefaultResponse(npc, dialogues);
    }
  }
  
  /**
   * Generate greeting response
   */
  generateGreeting(npc, memory, targetId, dialogues) {
    const relationship = targetId ? memory.getAcquaintance(targetId)?.relationship : 'stranger';
    const timeOfDay = this.getTimeOfDay();
    
    const greetings = {
      friend: ['Well met, friend!', 'Good to see thee again!', 'Ah, mine friend! How farest thou?'],
      acquaintance: ['Greetings!', 'Hail to thee!', 'Well met!'],
      stranger: ['Hail, stranger.', 'Greetings, traveler.', 'Well met, though I know thee not.']
    };
    
    const greeting = this.randomChoice(greetings[relationship] || greetings.stranger);
    
    // Add time-based variation
    if (timeOfDay === 'night') {
      return greeting + ' Dark be the night, is\'t not?';
    }
    
    return greeting;
  }
  
  /**
   * Generate farewell response
   */
  generateFarewell(npc, dialogues) {
    const farewells = ['Fare thee well!', 'Safe travels to thee!', 'Until we meet anon.', 'Godspeed!'];
    return this.randomChoice(farewells);
  }
  
  /**
   * Generate status response (how are you)
   */
  generateStatusResponse(npc, memory, dialogues) {
    // Check recent events that might affect mood
    const recentEvent = memory.getRecentEvent(300000); // 5 minutes
    
    if (recentEvent) {
      if (recentEvent.type === 'combat_attacked') {
        return 'Not well! I was attacked by ' + (recentEvent.details.attackerName || 'an enemy') + '!';
      }
      if (recentEvent.type === 'death_witnessed') {
        return 'Shaken... I just witnessed a death. Most terrible business.';
      }
    }
    
    // Class-based responses
    const responses = {
      serf: ['Weary from all this toil.', 'Well enough, though mine back doth ache.', 'Busy as ever.'],
      serfm: ['Weary from all this toil.', 'Well enough, though mine back doth ache.', 'Busy hauling resources.'],
      serff: ['Weary from all this toil.', 'Well enough, though mine back doth ache.', 'Busy as ever.'],
      innkeeper: ['Doing well! The tavern keepeth me busy.', 'Well, I thank thee for asking!'],
      monk: ['Blessed, I thank thee.', 'In good spirits, by God\'s grace.', 'Well, and thou?'],
      knight: ['Ready for battle, as always.', 'Well. Mine sword arm be strong.', 'In fine form.'],
      archer: ['Sharp-eyed and ready.', 'Well enough. The bow be steady.', 'Good, keeping watch.']
    };
    
    const classResponses = responses[npc.class?.toLowerCase()] || ['I fare well enough.', 'Well, and thou?'];
    return this.randomChoice(classResponses);
  }
  
  /**
   * Generate response about what they've seen
   */
  generateSeenResponse(npc, memory, entities, dialogues) {
    // Check for relevant recent events
    const recentEvent = memory.getRecentEvent(600000); // 10 minutes
    
    if (recentEvent) {
      if (recentEvent.type === 'death_witnessed') {
        const who = recentEvent.details.victimName || 'someone';
        return `Aye, most terrible... ${who} was slain not long ago.`;
      }
      
      if (recentEvent.type === 'enemy_sighted' || recentEvent.type === 'combat_attacked') {
        const enemy = recentEvent.details.enemyType || 'enemies';
        const location = recentEvent.location ? ` near ${recentEvent.location}` : ' nearby';
        return `Aye! I saweth ${enemy}${location}. Be thou careful!`;
      }
    }
    
    // Check if asking about specific entities
    if (entities.enemies.length > 0) {
      return 'I have seen some dangerous creatures about. Watch thyself.';
    }
    
    return 'Naught unusual, though I wander not far.';
  }
  
  /**
   * Generate response about their work
   */
  generateWorkResponse(npc, dialogues) {
    const workResponses = {
      serf: 'I worketh the land, haul resources. Honest toil, though tiring.',
      serfm: 'I chop wood and mine ore for mine house. Hard work.',
      serff: 'I work at the mill, grinding grain. \'Tis steady work.',
      innkeeper: 'I runneth this tavern. Keep travelers fed and housed.',
      monk: 'I serveth the Lord and tend to spiritual matters.',
      bishop: 'I leadeth the faithful and guide our flock.',
      knight: 'I protect these lands and serve mine liege.',
      archer: 'I keep watch and defend against threats.',
      hunter: 'I hunt game in the forest. Deer, boar, whatsoever I can find.'
    };
    
    return workResponses[npc.class?.toLowerCase()] || 'I do what I must to survive.';
  }
  
  /**
   * Generate faction/allegiance response
   */
  generateFactionResponse(npc, dialogues) {
    if (npc.house && global.House?.list[npc.house]) {
      const house = global.House.list[npc.house];
      return `I serveth ${house.name || 'mine house'} loyally.`;
    }
    
    if (npc.kingdom) {
      return `I belong to ${npc.kingdom}.`;
    }
    
    return 'I serve nay lord, I be independent.';
  }
  
  /**
   * Generate location response
   */
  generateLocationResponse(npc, entities, dialogues) {
    if (entities.buildings.length > 0) {
      return 'I be not sure exactly. Thou must explore and find it thyself.';
    }
    return 'I know not these lands well enough to guide thee.';
  }
  
  /**
   * Generate trade response
   */
  generateTradeResponse(npc, entities, dialogues) {
    if (npc.class === 'innkeeper') {
      return 'I trade not directly, but thou might find goods at the market.';
    }
    return 'I be not a merchant. Try thou the market or a trader.';
  }
  
  /**
   * Generate general question response
   */
  generateGeneralResponse(npc, memory, dialogues) {
    const responses = {
      serf: [
        'Just trying to get mine work done.',
        'Not much to say, truly.',
        'Life goeth on, I suppose.',
        'Same as always - toil, rest, toil again.'
      ],
      serfm: [
        'Just trying to get mine work done.',
        'Not much to say, truly.',
        'Life goeth on, I suppose.'
      ],
      serff: [
        'Just trying to get mine work done.',
        'Not much to say, truly.',
        'Life goeth on, I suppose.'
      ],
      knight: [
        'Ever ready to defend.',
        'That be not mine concern.',
        'I focus on mine duty.',
        'Ask thou someone else about that.'
      ],
      monk: [
        'The Lord worketh in mysterious ways.',
        'Faith provideth the answers we seek.',
        'Hast thou considered prayer?',
        'The Lord guideth us all.'
      ]
    };
    
    const classResponses = responses[npc.class?.toLowerCase()] || [
      'I could not say.',
      'Not sure about that.',
      'Mayhaps thou shouldst ask someone else.',
      'An interesting question.'
    ];
    return this.randomChoice(classResponses);
  }
  
  /**
   * Generate default/fallback response
   */
  generateDefaultResponse(npc, dialogues) {
    const defaults = [
      'Aye.',
      'Indeed.',
      'I see.',
      'Fair enough.',
      'As thou sayest.',
      'Hmm.',
      'True enough.',
      'Mayhaps.'
    ];
    return this.randomChoice(defaults);
  }
  
  /**
   * Generate varied response to avoid repetition
   */
  generateVariedResponse(intent, npc, memory, dialogues) {
    const varied = [
      'We spoke of this already.',
      'As I said before...',
      'I have nothing new to add.',
      'You already asked me that.'
    ];
    return this.randomChoice(varied);
  }
  
  // ============================================================================
  // UTILITY
  // ============================================================================
  
  /**
   * Get current time of day
   */
  getTimeOfDay() {
    if (global.nightfall) return 'night';
    return 'day';
  }
  
  /**
   * Random choice from array
   */
  randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }
  
  /**
   * Format NPC speech with name
   */
  formatSpeech(npc, message) {
    const name = npc.name || npc.class;
    return `<span style="color:#88ccff;"><b>${name}:</b></span> ${message}`;
  }
}

module.exports = ChatEngine;

