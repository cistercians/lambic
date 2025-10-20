# STRONGHODL - Game State Audit & Analysis
**Date:** October 20, 2025  
**Codebase Size:** ~54,000 lines

---

## Executive Summary

STRONGHODL is a multiplayer medieval strategy/RPG with persistent world simulation, featuring 8 AI factions, economic systems, combat, stealth mechanics, and z-layered terrain (caves, buildings, surface, underwater).

**Core Stats:**
- **Total Codebase:** 54,000 lines
- **Main Server:** 4,254 lines (`lambic.js`)
- **Entity System:** 11,210 lines (`Entity.js`)
- **Commands:** 14,517 lines (`Commands.js`)
- **Client:** 7,846 lines (`client.js`)
- **Faction System:** 2,582 lines (`Houses.js`)

---

## Part 1: Game Mechanics

### World Structure

**Map:**
- 256x256 tile grid
- 64px tile size = 16,384px world space
- **7 Z-Layers:**
  - z=-3: Underwater
  - z=-2: Cellar
  - z=-1: Underworld (caves)
  - z=0: Overworld (main surface)
  - z=1: Building Floor 1
  - z=2: Building Floor 2
  - z=3: Ship deck

**Terrain Types:**
- Water (0), Heavy Forest (1), Light Forest (2), Brush (3)
- Rocks (4), Mountains (5), Cave Entrance (6), Grass (7)
- Farm tiles (8-10), Building markers (11-20.5), Road (18)

### Player Capabilities

**Movement:**
- WASD directional control
- Shift to toggle run/walk
- Speed modified by terrain (forest 30%, water 10%, road 110%)
- Automatic z-layer transitions (caves, buildings, water)

**Combat:**
- Mouse-click attacks
- Ranged (bow) or melee (sword)
- HP regeneration: 0.25/second
- Spirit regeneration: 0.1/second
- Death → Ghost mode (2 minute timer, can respawn at home)

**Building:**
- Construct tavern, hut, cottage, tower, stronghold
- Set home location for respawning
- Economic buildings: mill, lumbermill, mine, farm, market

**Economy:**
- Gather resources: wood, stone, iron, gold, silver, diamonds
- Craft items, trade at markets
- Inventory system with item management
- Equipment: armor, weapons

**Special Modes:**
- **Ghost:** Temporary after death, invisible to NPCs, high speed
- **Stealth:** Transparency based on location/time, reduced aggro
- **God Mode:** Spectator camera, faction cycling, no interaction

### NPC Factions (8 Total)

**Major Factions with Economy:**
1. **Goths** - Surface, farms & mills
2. **Franks** - Surface, farms & mills  
3. **Celts** - Heavy forest, mines
4. **Teutons** - Mountains, mines & lumbermills

**Other Factions:**
5. **Brotherhood** - Underground bases
6. **Norsemen** - Coastal/surface
7. **Outlaws** - Heavy forest
8. **Mercenaries** - Underground

**NPC Behaviors:**
- Serfs: Gather resources, build huts, work at economic buildings
- Warriors: Patrol, aggro on enemies, combat
- Fauna: Deer, boar, wolf, falcon (ambient wildlife)
- Kill tracking → Miniboss scaling (wolves/boars grow at 3, 6, 9, 10+ kills)

### Economic System

**Resource Flow:**
1. Serfs gather from resource nodes (trees, rocks, ore veins)
2. Deposit at work buildings (mill, lumbermill, mine)
3. Buildings keep some, serfs keep some as "wages"
4. Serfs with excess visit market to sell
5. Dynamic pricing based on supply/demand

**Markets:**
- Separate orderbooks per market
- Buy/sell orders with price discovery
- NPC and player participation
- UI for market interaction (inside building only)

---

## Part 2: System Architecture

### Core Systems

#### 1. Movement & Pathfinding (2,365 lines)

**Files:**
- `PathfindingSystem.js` (229 lines) - A* pathfinding with caching
- `SimpleSerfBehavior.js` (168 lines) - Serf-specific pathfinding
- `SerfBehaviorSystem.js` (784 lines) - Deprecated/unused?
- `lambic.js` Player.updateSpd(), moveTo() (~500 lines)
- `Entity.js` Character movement (~200 lines)

**Current Implementation:**
- A* pathfinding with grid generation per z-layer
- Path caching system (not always effective)
- Movement validation on every frame
- Terrain speed modifiers applied in updateSpd()
- Z-layer transitions automatic for players, intent-based for NPCs

**Issues:**
- Multiple overlapping systems (PathfindingSystem vs SimpleSerfBehavior)
- Grid regeneration may be inefficient
- Movement code duplicated between player and NPC logic
- Z-layer transition logic scattered

#### 2. Combat System (304 lines)

**Files:**
- `SimpleCombat.js` (304 lines) - Active system
- `CombatSystem.js` (unknown) - Deprecated?
- `SimpleFlee.js` (134 lines) - Flee behavior

**Current Implementation:**
- Frame-based combat updates
- Distance-based attack ranges
- Cooldown timers for attacks
- Kill tracking with skull emojis
- Aggro checking every 1 second

**Strengths:**
- Simple, direct damage model
- Clear state management
- Good early exit conditions

#### 3. Building & Placement (2,789 lines)

**Files:**
- `TilemapSystem.js` (1,129 lines) - New intelligent placement
- `Build.js` (1,630 lines) - Building construction/completion
- `Houses.js` faction init (~500 lines) - Mixed old/new systems

**Current Implementation:**
- **New system:** Terrain-aware, overlap-prevention, scoring
- **Old system:** Manual plot generation (still used in some factions)
- Building completion triggers serf spawning
- Home setting for residential buildings

**Issues:**
- Some factions (Teutons - just fixed) still use old manual placement
- Possible overlap with Build.js validation

#### 4. Rendering (12,681 lines)

**Files:**
- `client.js` (7,846 lines) - Main renderer
- `imgloader.js` (4,409 lines) - Image asset loading
- `OptimizedRenderer.js` (226 lines) - Viewport optimization
- `audioloader.js` (429 lines) - Audio assets

**Current Implementation:**
- Canvas-based tile rendering
- Entity sprites with facing directions
- Lighting effects (day/night, torches)
- Camera systems: player-follow, login camera, god mode camera
- Forest overlay transparency (innaWoods)

**Strengths:**
- Viewport culling working
- Multiple camera modes successful
- Good separation of render layers

#### 5. State Management (1,148 lines)

**Files:**
- `OptimizedGameLoop.js` (168 lines) - Main game loop
- `OptimizedEntityManager.js` (113 lines) - Entity tracking
- `GameState.js` (364 lines) - World state
- `SpatialIndex.js` (235 lines) - Spatial queries
- `SpatialIntegration.js` (199 lines) - Integration layer

**Current Implementation:**
- 40ms tick rate (25 FPS)
- Update packs sent to clients
- Spatial indexing for proximity queries
- Entity lifecycle management

#### 6. Command System (14,517 lines)

**Files:**
- `Commands.js` (14,517 lines) - MASSIVE, all chat commands
- `CommandHandler.js` (503 lines) - Modular handler (unused?)

**Issues:**
- Commands.js is extremely bloated
- CommandHandler exists but may not be utilized
- Opportunity for massive simplification

---

## Part 3: Identified Issues & Opportunities

### Critical Issues

1. **Commands.js is 14,517 lines** - Needs modularization
2. **Entity.js is 11,210 lines** - Likely contains dead code
3. **Multiple combat systems** - CombatSystem.js vs SimpleCombat.js (one deprecated?)
4. **Multiple serf behavior systems** - SerfBehaviorSystem.js (784 lines) vs SimpleSerfBehavior.js (168 lines)
5. **Pathfinding duplication** - PathfindingSystem vs serf-specific pathfinding

### Performance Concerns

1. **Grid generation** - May regenerate too frequently
2. **Aggro checking** - Every entity checks every 1 second (could be spatial-query-based)
3. **Update pack size** - Sending full inventory/gear every frame?
4. **Movement validation** - Checking terrain every frame for every entity

### Code Quality Issues

1. **Inconsistent building placement** - Some factions use new system, some old
2. **Scattered terrain constants** - TERRAIN defined in multiple places
3. **Mixed old/new systems** - Migration incomplete in some areas
4. **Verbose logging** - Many debug logs still active

### Integration Gaps

1. **God mode** - Had to add special cases instead of treating like login camera
2. **Market system** - May not be fully integrated with serf behavior
3. **Building completion** - Complex trigger chain for serf spawning

---

## Part 4: Cleanup Priorities

### High Priority (Immediate Impact)

1. **Modularize Commands.js** - Split into category files (combat, building, economy, admin)
2. **Remove deprecated systems** - CombatSystem.js, SerfBehaviorSystem.js if unused
3. **Consolidate pathfinding** - Single system for all entity types
4. **Update remaining factions** - Finish migration to new building placement

### Medium Priority (Code Quality)

5. **Consolidate terrain constants** - Single source of truth
6. **Remove debug logging** - Clean up console output
7. **Simplify Entity.js** - Extract weapon/item definitions to separate files
8. **Document complex functions** - Add comments to key algorithms

### Low Priority (Nice to Have)

9. **Optimize update packs** - Delta updates instead of full state
10. **Spatial aggro queries** - Use spatial system instead of iteration
11. **Path caching improvements** - Better invalidation logic
12. **Object pooling** - For frequently created/destroyed entities

---

## Part 5: Next Steps

### Phase 2 Will Focus On:

**Pathfinding & Movement Deep Dive:**
- Analyze PathfindingSystem.js vs SimpleSerfBehavior.js
- Identify which is primary, which is redundant
- Check SerfBehaviorSystem.js usage (784 lines - is it used?)
- Consolidate movement validation logic
- Optimize grid generation

This audit will guide the cleanup process to ensure stability while maximizing improvements.

