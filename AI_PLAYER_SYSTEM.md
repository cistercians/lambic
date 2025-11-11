# 🤖 Claude AI Player System
## "An AI Learning to Play Lambic"

**Status**: 📌 Bookmarked for Future Implementation  
**Priority**: Medium (after game stability improvements)  
**Last Updated**: 2025-11-10

---

## 🎯 Project Vision

Create a system where Claude (or any LLM) can connect to Lambic as a player, learn the game mechanics through trial and error, and develop emergent gameplay strategies. This serves as both:
- A fascinating AI research experiment in embodied cognition
- A testing tool for game balance and NPC behavior
- A potential showcase of AI capabilities in complex environments

---

## 🏗️ Architecture Overview

```
┌─────────────────┐
│  Lambic Server  │
│   (Port 2000)   │
└────────┬────────┘
         │ WebSocket/TCP
         │ JSON Protocol
┌────────▼────────┐
│  Claude Player  │◄─────┐
│   (Node.js)     │      │
└────────┬────────┘      │
         │               │
         │ API Calls     │ Perception
         │               │ & Memory
┌────────▼────────┐      │
│ Anthropic API   │      │
│ (Claude Sonnet) │──────┘
└─────────────────┘
```

### Components

1. **Connection Layer** (`claude-player.js`)
   - WebSocket client connecting to game server
   - Authentication and session management
   - Message parsing and buffering

2. **Perception System**
   - Game state tracking (players, items, buildings, terrain)
   - Spatial awareness (distances, directions)
   - Temporal awareness (time of day, events)
   - Social context (chat messages, player relationships)

3. **Decision Engine**
   - Calls Claude API with current game state
   - Receives structured decisions (JSON)
   - Implements decision cooldown (3-5 seconds)

4. **Action Executor**
   - Translates decisions to game commands
   - Handles timing (key press/release durations)
   - Manages action queues

5. **Memory System**
   - Conversation history (last 10 exchanges)
   - Success/failure tracking
   - Learned patterns and strategies

---

## 📊 Technical Specifications

### Game Protocol Integration

**Incoming Messages:**
```javascript
{msg: 'signInResponse', success: true, selfId: '...'}
{msg: 'init', world: [...], player: [...], ...}
{msg: 'update', player: [...], item: [...], building: [...]}
{msg: 'addToChat', message: '...'}
{msg: 'death', id: '...'}
```

**Outgoing Messages:**
```javascript
{msg: 'signIn', name: 'Claude_AI', password: '...'}
{msg: 'keyPress', inputId: 'up|down|left|right|attack', state: true|false}
{msg: 'msgToServer', name: '...', message: '...'}
```

### Decision Format

```json
{
  "action": "move|attack|interact|chat|wait",
  "direction": "up|down|left|right|null",
  "duration": 2000,
  "chatMessage": "Hello world!",
  "reasoning": "Gathering wood from nearby tree because inventory is low"
}
```

### Performance Considerations

- **Decision Rate**: 1 decision every 3-5 seconds (configurable)
- **API Cost**: ~$0.015 per decision (Claude Sonnet 3.5)
- **Hourly Cost**: ~$10-15 per hour of gameplay
- **Context Window**: Keep last 10 decisions + current perception
- **Token Usage**: ~1000 input + 500 output tokens per decision

---

## 🎮 Learning Phases

### Phase 1: Disorientation (0-10 min)
**Goal**: Basic motor control and interaction discovery

- Random exploration
- Testing each action type
- Observing cause-effect relationships
- Building spatial awareness

**Expected Outcomes:**
- Understands movement mechanics
- Knows how to interact with objects
- Recognizes basic UI feedback

### Phase 2: Pattern Recognition (10-30 min)
**Goal**: Identify game systems and rules

- Resource gathering mechanics
- Building purposes and locations
- Player types and behaviors
- Danger recognition (enemies, hazards)
- Time/weather effects

**Expected Outcomes:**
- Can gather resources intentionally
- Avoids obvious dangers
- Recognizes faction dynamics

### Phase 3: Goal Formation (30-60 min)
**Goal**: Develop meaningful objectives

- Economic understanding (resource chains)
- Social integration (faction membership)
- Risk assessment (when to engage/flee)
- Efficiency optimization (routing, timing)

**Expected Outcomes:**
- Contributes to faction goals
- Maintains inventory strategically
- Coordinates with other players

### Phase 4: Tactical Play (1-2 hours)
**Goal**: Complex decision-making under constraints

- Multi-factor prioritization
- Threat response protocols
- Resource optimization
- Social coordination

**Expected Outcomes:**
- Behaves like competent human player
- Adapts to changing situations
- Communicates effectively

### Phase 5: Strategic Play (2+ hours)
**Goal**: Meta-game understanding

- Faction politics
- Long-term planning
- Combat mastery (if applicable)
- Teaching/coordinating with others

**Expected Outcomes:**
- Develops "personality" through learned behaviors
- Contributes meaningfully to faction success
- May discover novel strategies

---

## 💡 Interesting Research Questions

1. **Emergent Personality**: Will Claude develop consistent behavioral patterns?
2. **Social Integration**: How will human players react to and interact with AI?
3. **Strategy Discovery**: Will AI find tactics humans haven't considered?
4. **Learning Speed**: How quickly can AI match human player competence?
5. **Failure Recovery**: How does AI handle setbacks (death, resource loss)?
6. **Communication Style**: What chat patterns will emerge?
7. **Ethical Behavior**: Will AI follow social norms without explicit rules?

---

## 🚀 Implementation Roadmap

### Prerequisites
- [ ] Game server stability (no critical bugs)
- [ ] Consistent API for game state updates
- [ ] Authentication system supports programmatic logins
- [ ] Rate limiting won't block AI player
- [ ] Budget allocated for API costs

### Phase 1: Basic Connection (1-2 days)
- [ ] Implement WebSocket client
- [ ] Handle authentication
- [ ] Parse game state updates
- [ ] Test connection stability

### Phase 2: Perception System (2-3 days)
- [ ] Build game state representation
- [ ] Implement spatial awareness
- [ ] Track nearby entities
- [ ] Format perception for Claude

### Phase 3: Decision Engine (2-3 days)
- [ ] Integrate Anthropic API
- [ ] Design prompt templates
- [ ] Parse Claude responses
- [ ] Handle API errors/retries

### Phase 4: Action Execution (1-2 days)
- [ ] Implement movement commands
- [ ] Handle timing/duration
- [ ] Add action queue if needed
- [ ] Test responsiveness

### Phase 5: Memory & Learning (2-3 days)
- [ ] Conversation history management
- [ ] Success/failure tracking
- [ ] Pattern recognition
- [ ] Strategy persistence

### Phase 6: Testing & Refinement (Ongoing)
- [ ] Monitor decision quality
- [ ] Tune prompt engineering
- [ ] Optimize token usage
- [ ] Improve error handling

**Total Estimated Time**: 10-15 days

---

## 💰 Cost Analysis

### Per-Session Costs (Claude Sonnet 3.5)
- Decision interval: 5 seconds
- Decisions per hour: 720
- Cost per decision: ~$0.015
- **Hourly cost: ~$10.80**

### Budget Options

1. **Demo Mode** (1 hour sessions)
   - Cost: ~$11
   - Use case: Show off AI capabilities
   - Frequency: Occasional

2. **Research Mode** (Daily 2-hour sessions)
   - Cost: ~$22/day, ~$660/month
   - Use case: Study AI learning progression
   - Frequency: Regular testing

3. **Production Mode** (Always-on AI player)
   - Cost: ~$260/day, ~$7,800/month
   - Use case: Permanent AI participant
   - Frequency: Continuous

### Cost Optimization Strategies
- Increase decision interval (10s = 50% cost reduction)
- Use Claude Haiku for simple decisions (~90% cheaper)
- Implement decision caching (repeated scenarios)
- Offline training mode (simulation, no API)

---

## 📋 Code Structure

```
ai-brain/
├── claude-player.js          # Main AI player class
├── run-claude.js              # Entry point / CLI
├── perception/
│   ├── game-state.js          # State management
│   ├── spatial-awareness.js   # Distance/direction utils
│   └── pattern-recognition.js # Learning systems
├── decision/
│   ├── prompt-templates.js    # Claude prompts
│   ├── decision-parser.js     # Parse AI responses
│   └── strategy-engine.js     # High-level planning
├── action/
│   ├── executor.js            # Execute game commands
│   └── action-queue.js        # Timing/sequencing
├── memory/
│   ├── conversation-history.js
│   ├── success-tracker.js
│   └── learned-patterns.js
├── config/
│   └── config.json            # Settings
├── logs/
│   └── session-YYYYMMDD.log   # Session recordings
└── package.json
```

---

## 🎯 Success Metrics

### Quantitative
- **Survival time**: Average time between deaths
- **Resource efficiency**: Resources gathered per hour
- **Decision quality**: % of decisions that advance objectives
- **API efficiency**: Average tokens per decision
- **Social integration**: Messages exchanged with humans

### Qualitative
- **Behavioral coherence**: Does AI show consistent "personality"?
- **Strategic depth**: Does AI plan beyond immediate actions?
- **Social acceptance**: Do human players enjoy interacting with AI?
- **Novel insights**: Does AI discover unexpected strategies?

---

## 🔮 Future Enhancements

### Short-term
- Multiple AI players with different "personalities"
- Real-time decision explanation UI
- Learning from human player demonstrations
- Offline simulation mode for rapid learning

### Long-term
- Multi-agent coordination (AI teams)
- Visual perception (screenshot → image analysis)
- Voice integration (text-to-speech chat)
- Reinforcement learning hybrid approach
- Open source AI player framework

---

## 📚 Related Resources

- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Embodied AI Research Papers](...)
- [Game AI Design Patterns](...)
- [LLM Agent Frameworks](...)

---

## 👥 Contributors

- **Johan Argan** - Game Designer, Lambic Creator
- **Claude (Anthropic)** - AI Player Subject
- Future contributors welcome!

---

## 📝 Notes & Observations

_This section will be populated during implementation and testing_

### Interesting Behaviors Observed
- TBD

### Challenges Encountered
- TBD

### Unexpected Insights
- TBD

---

**Last Updated**: 2025-11-10  
**Next Review**: When game reaches stable beta


