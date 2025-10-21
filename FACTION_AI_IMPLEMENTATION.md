# Faction AI System - Implementation Status

## Completed Components

### Core AI Framework ✓

1. **TerritoryManager.js** - Dynamically calculates faction territory
   - Tracks core base vs outposts
   - Calculates center of mass and territory radius
   - Identifies when territory is full (needs expansion)
   - Finds optimal building spots within territory

2. **MapAnalyzer.js** - Analyzes map for optimal HQ placement
   - Scans entire map for suitable locations
   - Scores locations based on resources (farmland, forest, rocks, caves)
   - Finds optimal HQ locations with proper spacing between factions

3. **Goals.js** - Goal system with dependencies
   - Base Goal class with resource requirements and building prerequisites
   - Specific goal types: BuildMill, BuildFarm, BuildMine, BuildLumbermill, BuildGarrison
   - Military goals: TrainMilitary, DeployScout, DefendTerritory
   - Expansion goals: EstablishOutpost
   - Resource gathering goals

4. **ResourcePlanner.js** - Plans resource acquisition
   - Checks if goals are affordable
   - Calculates resource deficits
   - Estimates production rates
   - Plans subgoals for resource gathering

5. **GoalChain.js** - Multi-step goal execution
   - Resolves goal dependencies recursively
   - Creates chains: [GatherResources → BuildPrerequisite → MainGoal]
   - Tracks progress through chain

6. **FactionKnowledge.js** - Intelligence database
   - Tracks explored tiles (fog of war for AI)
   - Stores known resource locations
   - Records enemy sightings
   - Provides exploration statistics

7. **ScoutBehavior.js** - Scout unit behavior
   - Physical exploration of map
   - Area scanning for resources and enemies
   - Report filing back to base
   - Threat detection and avoidance

8. **FactionProfiles.js** - Strategic parameters for each faction
   - Economic priorities (what resources to focus on)
   - Building preferences (utility values, max counts)
   - Military strategy (defensive, aggressive, guerrilla, etc.)
   - Expansion style and parameters
   - Goal utility modifiers (faction-specific priorities)

9. **FactionStrategy.js** (Base) - Strategy pattern framework
   - Default goal evaluation methods
   - Utility modification system
   - Building preference checks

10. **CeltsStrategy.js** - Celts-specific strategy
    - Prioritizes mines near caves
    - NEVER builds lumbermills
    - Higher scouting priority
    - Guerrilla warfare focus

11. **TeutonsStrategy.js** - Teutons-specific strategy
    - Military-focused (garrison priority)
    - Heavy emphasis on mines and lumbermills
    - Aggressive expansion
    - Higher attack propensity

12. **FranksStrategy.js** - Franks-specific strategy
    - Farming experts (5 farms per mill)
    - Mills are highest priority
    - Balanced approach

13. **GothsStrategy.js** - Goths-specific strategy
    - Defensive farming faction
    - Stone mines preferred
    - Moderate expansion

14. **FactionAI.js** - Main AI controller
    - Integrates all systems
    - Daily evaluation and decision-making
    - Goal selection and execution
    - Loads faction-specific strategies

### Game Integration ✓

1. **GameState.updateTime()** - Daily AI trigger added
   - Calls `House.evaluateAI()` when new day starts

2. **House.evaluateAI()** - Faction AI evaluation method
   - Iterates through all factions
   - Calls each faction's AI to evaluate and act

3. **Faction Initialization** - AI added to all factions
   - Brotherhood: AI initialized
   - Goths: AI initialized
   - Norsemen: AI initialized
   - Franks: AI initialized
   - Celts: AI initialized
   - Teutons: AI initialized
   - Outlaws: AI initialized
   - Mercenaries: AI initialized

## Current Status

**The AI system is integrated and will run**, but goals currently only:
- Log their intentions
- Deduct resources from faction stores
- Update status

**What's Missing for Full Functionality:**

### 1. Actual Building Construction
Goals need to execute the actual building placement logic:
```javascript
// In BuildMineGoal.execute()
const location = this.location || house.ai.territory.findBuildingSpotInTerritory('mine');
if (location) {
  // Use existing TilemapSystem.findBuildingSpot or similar
  const buildingData = constructMine(house, location);
}
```

### 2. Serf Assignment for Gathering
GatherResourceGoal needs to:
- Assign idle serfs to gathering tasks
- Monitor resource accumulation
- Complete when target reached

### 3. Military Unit Training
TrainMilitaryGoal needs to:
- Actually spawn military units
- Assign them to patrol/defense duties
- Track them in house.military.units

### 4. Scout Deployment
DeployScoutGoal needs to:
- Spawn scout units
- Assign ScoutBehavior to them
- Set scouting destinations

### 5. Initial Territory Knowledge
When AI initializes, it should know about resources in immediate vicinity:
- Scan area around HQ (radius 15)
- Add to knowledge.knownResources
- This prevents needing scouts for obvious nearby resources

## How It Works (Current State)

**On Server Start:**
- Factions are created with existing init() methods (places buildings immediately)
- AI controllers are initialized for each faction
- AI starts with knowledge of only the HQ location

**On Day 1 (First Daily Evaluation):**
- Each faction's AI evaluates possible goals
- Goals are scored based on faction strategy
- Top goal is selected and converted to goal chain
- Chain starts executing (currently just logging)

**On Subsequent Days:**
- AI continues executing current goal chain
- When chain completes, evaluates new goals
- Adapts to changing circumstances

## Next Steps

To make the AI fully functional:

1. **Implement goal execution logic** - Make goals actually build/train/scout
2. **Connect to existing build system** - Use TilemapSystem for placement validation
3. **Initial territory scan** - Give AI knowledge of nearby resources on startup
4. **Scout unit creation** - Implement actual scout spawning and behavior hooks
5. **Serf task assignment** - Connect gathering goals to serf work system

Once these are implemented, factions will develop organically over time through AI decisions rather than hardcoded initialization.

