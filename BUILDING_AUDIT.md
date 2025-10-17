# Building System Audit Report

**Date**: October 17, 2025  
**Purpose**: Document all existing building types and their current functionality before implementing special abilities

---

## Building Categories

### 1. ECONOMIC BUILDINGS

#### Farm (`Entity.js` lines 79-98)
**Current Functionality:**
- Links to nearest mill within 6 tiles (384px)
- Provides 9 plot tiles for farming
- **No special abilities**

**Properties:**
- `mill`: Reference to associated mill building

**Methods:**
- `findMill()`: Scans for nearby mills and registers farm

---

#### Mill (`Entity.js` lines 100-224)
**Current Functionality:**
- Hub for multiple farms (manages farm work assignments)
- Spawns serfs when ratio of serfs:farm-tiles is low
- Tracks daily grain production

**Properties:**
- `farms`: Object storing all linked farms
- `tavern`: Reference to spawning tavern
- `resources`: Array of workable farm tiles
- `serfs`: Object tracking assigned workers
- `dailyStores`: {grain: 0}

**Methods:**
- `tally()`: Checks serf ratio and spawns more if needed; scans farms for harvest/barren/growing tiles
- `findFarms()`: Scans for nearby farms and taverns

**Special Features:**
- Intelligent farm cycle management (barren → growing → harvest)
- Priority system (only harvest wheat when available)

---

#### Lumbermill (`Entity.js` lines 226-305)
**Current Functionality:**
- Manages tree resources within 6 tiles
- Spawns serfs based on worker ratio
- Tracks daily wood production

**Properties:**
- `tavern`: Reference to spawning tavern
- `resources`: Array of tree tiles
- `serfs`: Assigned workers
- `dailyStores`: {wood: 0}

**Methods:**
- `tally()`: Checks serf ratio and spawns if needed
- `findTavern()`: Links to nearby tavern
- `getRes()`: Scans for trees (tiles 1-3)

---

#### Mine (`Entity.js` lines 307-438)
**Current Functionality:**
- Two modes: Stone mine (surface) or Ore mine (cave-based)
- Spawns serfs based on worker ratio
- Tracks daily stone and ore production

**Properties:**
- `cave`: Cave entrance location (if ore mine)
- `resources`: Stone patches or cave rocks
- `serfs`: Assigned workers
- `dailyStores`: {stone: 0, ironore: 0, silverore: 0, goldore: 0, diamond: 0}

**Methods:**
- `tally()`: Spawns serfs based on resource type (ore vs stone)
- `findTavern()`: Links to spawning tavern
- `getRes()`: Scans for cave rocks (z=-1) or stone patches (z=0)

**Special Features:**
- Cave detection system
- Dual resource mode (ore vs stone)

---

### 2. INFRASTRUCTURE BUILDINGS

#### Tavern (`Entity.js` lines 452-670)
**Current Functionality:**
- Central hub for serf spawning
- Links to nearby work buildings (mills, lumbermills, mines, markets)
- Creates worker housing (huts) near work sites

**Properties:**
- `market`: Reference to linked market
- `occ`: Building occupancy counter

**Methods:**
- `findBuildings()`: Scans for nearby work buildings and markets
- `newSerfs(buildingId)`: Spawns 2 serfs (gender based on building type), creates hut, assigns to work building

**Special Features:**
- Complex serf spawning logic with hut placement
- Gender assignment based on work type (males for mines/lumbermills)
- Occupancy tracking (serfs spawn at z=2)

---

#### Market (`Entity.js` lines 677-694)
**Current Functionality:**
- Links to nearby tavern
- Has orderbook property (trading system not implemented)

**Properties:**
- `orderbook`: Empty object (trading stub)
- `tavern`: Reference to linked tavern

**Methods:**
- `findTavern()`: Links to tavern within 20 tiles

**Special Features:**
- Trading infrastructure exists but not functional

---

#### Monastery (`Entity.js` lines 672-675)
**Current Functionality:**
- Basic building with patrol flag only
- **No special abilities implemented**

**Properties:**
- `patrol`: true

---

#### Stable (`Entity.js` lines 696-700)
**Current Functionality:**
- Stores horses (property exists, not used)

**Properties:**
- `horses`: 5 (initial value)

**Special Features:**
- Horse inventory system ready for implementation

---

#### Dock (`Entity.js` lines 702-705)
**Current Functionality:**
- Basic building with patrol flag only
- **No special abilities implemented**

---

#### Forge (`Entity.js` lines 761-765)
**Current Functionality:**
- Has blacksmith reference property
- **No crafting/repair implemented**

**Properties:**
- `blacksmith`: null (reference to blacksmith NPC)

---

### 3. MILITARY BUILDINGS

#### Outpost (`Entity.js` lines 440-444)
**Current Functionality:**
- Defensive structure with damage value
- **No active defense implemented**

**Properties:**
- `damage`: 5
- `patrol`: true

---

#### Guardtower (`Entity.js` lines 446-450)
**Current Functionality:**
- Stronger defensive structure
- **No active defense implemented**

**Properties:**
- `damage`: 10
- `patrol`: true

---

#### Garrison (`Entity.js` lines 707-759)
**Current Functionality:**
- **ACTIVE**: Unit training system implemented
- Spawns military units from queue (footsoldiers, skirmishers, cavaliers)
- Timer-based production

**Properties:**
- `queue`: Array of units to produce
- `timer`: Production countdown

**Methods:**
- `update()`: Processes queue and spawns units

**Special Features:**
- Only building with active update loop
- Military unit production system

---

#### Stronghold (`Entity.js` lines 778-782)
**Current Functionality:**
- Defensive structure with damage value
- **No garrison/rally features implemented**

**Properties:**
- `damage`: 10
- `patrol`: true

---

#### Gate (`Entity.js` lines 767-776)
**Current Functionality:**
- Has open/close methods (not implemented)
- **No actual gate mechanics**

**Properties:**
- `patrol`: true

**Methods (Stubs):**
- `open()`: Empty
- `close()`: Empty

---

## Summary Statistics

**Total Building Types**: 14
- Economic: 4 (Farm, Mill, Lumbermill, Mine)
- Infrastructure: 6 (Tavern, Market, Monastery, Stable, Dock, Forge)
- Military: 4 (Outpost, Guardtower, Garrison, Stronghold, Gate)

**Buildings With Active Functionality**: 5
- Mill (serf spawning, farm management)
- Lumbermill (serf spawning, resource scanning)
- Mine (serf spawning, cave detection)
- Tavern (serf spawning, hut creation)
- Garrison (unit training with update loop)

**Buildings With Partial Implementation**: 3
- Market (has orderbook property, no trading)
- Stable (has horses property, not used)
- Forge (has blacksmith reference, no crafting)
- Gate (has open/close stubs, no mechanics)

**Buildings With No Special Features**: 5
- Farm, Monastery, Dock, Outpost, Guardtower, Stronghold

---

## Key Observations

1. **Garrison is the only building with an active update loop** - This provides a template for other buildings with passive/automated abilities

2. **Tavern has the most complex logic** - Serf spawning, hut placement, multi-building coordination

3. **Economic buildings have mature systems** - Resource tracking, serf management, daily reporting all functional

4. **Most military buildings are placeholders** - Only garrison has actual functionality beyond damage values

5. **Trading/crafting systems are stubbed** - Market orderbook exists, Forge blacksmith reference exists, but no implementation

6. **All buildings have `patrol` flag** - Not clear what this controls (needs investigation)

---

## Recommendations for Special Abilities

Based on current code structure and avoiding conflicts with existing systems, buildings can be categorized by implementation approach:

**Category A - Ready for Interactive Abilities** (extend Interact.js):
- Monastery (healing)
- Market (trading)
- Forge (repair/craft)
- Stable (mount rental)

**Category B - Ready for Passive Abilities** (add update loop like Garrison):
- Outpost (vision/alerts)
- Guardtower (auto-defense)
- Stronghold (garrison/rally)

**Category C - Already Functional** (enhancement only):
- Tavern (add rest/healing on entry)
- Mill/Lumbermill/Mine (production bonuses)

**Category D - Need System Design First**:
- Gate (requires tile-based open/close mechanics)
- Dock (ship construction/naval system)


