# Player System Documentation

## Table of Contents
1. [Introduction and Overview](#introduction-and-overview)
2. [Player Entity Structure](#player-entity-structure)
3. [Controls and Input](#controls-and-input)
4. [Movement and Navigation](#movement-and-navigation)
5. [Stats and Attributes](#stats-and-attributes)
6. [Inventory System](#inventory-system)
7. [Combat Mechanics](#combat-mechanics)
8. [Work Systems](#work-systems)
9. [Interactions](#interactions)
10. [Death and Respawn](#death-and-respawn)
11. [Progression Systems](#progression-systems)
12. [Special Modes](#special-modes)
13. [Technical Details](#technical-details)
14. [Code References](#code-references)

---

## Introduction and Overview

The Player system is the core entity representing human-controlled characters in Lambic. Players inherit from the Character base class and have unique mechanics for direct control, including click-based navigation, work systems, combat, and interactions with the world.

**Key Characteristics:**
- Direct player control via keyboard and mouse input
- Click-based pathfinding navigation
- Auto-work system for resource gathering
- Combat system with attack commands
- Death/respawn cycle with ghost mode
- Inventory and equipment management
- Building and NPC interactions
- Progression tracking (kills, titles, skulls)

---

## Player Entity Structure

### Server-Side Player Constructor

The Player entity is defined in [`lambic.js`](lambic.js) starting at line 2570:

```javascript
const Player = function(param) {
  const self = Character(param);
  self.type = param.type || 'player';
  self.name = param.name;
  self.class = param.class || 'SerfM'; // Players MUST have a class
  // ... player-specific properties
}
```

### Inheritance Hierarchy

```
Entity (base)
  └── Character (line ~1920 in server/js/Entity.js)
      └── Player (line ~2570 in lambic.js)
```

**Player inherits from Character, which provides:**
- Base entity properties (x, y, z, id, spdX, spdY)
- Inventory system
- Stores system (grain, wood, stone, ores, etc.)
- Gear slots (head, armor, weapon, weapon2, accessory)
- Combat properties (hp, hpMax, strength, dexterity, damage, fortitude)
- Work flags (working, chopping, mining, farming, building, fishing)
- Movement properties (baseSpd, runSpd, facing, pressingRight/Left/Up/Down)
- Terrain awareness (innaWoods, onMtn)

### Player-Specific Properties

**Identity & Status:**
- `type`: Always `'player'` for player entities
- `name`: Player's display name
- `class`: Entity class (e.g., 'SerfM', 'Knight', 'Archer') - **required** (defaults to 'SerfM')
- `knighted`: Boolean flag for knight status
- `crowned`: Boolean flag for crowned status
- `title`: String for player title
- `friendlyfire`: Boolean for friendly fire settings

**Input State:**
- `pressingE`, `pressingT`, `pressingI`, `pressingP`, `pressingF`, `pressingH`, `pressingK`, `pressingL`, `pressingX`, `pressingC`, `pressingN`, `pressingM`: Action key states
- `pressing1` through `pressing0`: Number key states (1-0)
- `mouseAngle`: Mouse angle for ranged combat direction
- `workTargetTile`: Target tile for auto-work system (null or `{tileX, tileY, z, workType, fishingWaterTile?}`)
- `pendingInteraction`: Pending interaction target (`{type, id}` or null)

**Movement & Navigation:**
- `running`: Boolean for walk/run toggle (Shift key)
- `ghost`: Boolean for ghost mode (post-death state)
- `path`: Array of pathfinding waypoints `[[x,y], ...]`
- `pathCount`: Current waypoint index in path

**Stats (Player-Specific):**
- `hpNat`: Natural HP (100)
- `spiritNat`: Natural spirit (100)
- `spirit`: Current spirit (100)
- `spiritMax`: Maximum spirit (100)
- `breath`: Current breath for underwater (100)
- `breathMax`: Maximum breath (100)
- `strength`: Base strength (10)
- `dexterity`: Base dexterity (1)

**Ship Boarding:**
- `isBoarded`: Boolean - true when player is on a ship
- `boardedShip`: ID of ship player is on (null if not boarded)
- `boardCooldown`: Cooldown timer for boarding ships

**Progression:**
- `kills`: Kill count (integer)
- `skulls`: Skull display string ('💀' for 3+ kills, '☠️' for 10+ kills)

**Special Modes:**
- `godMode`: Boolean for god mode (spectator camera)
- `godModeReturnPos`: Position to return to when exiting god mode

**Wallet:**
- `wallet`: Blockchain wallet object (created via WalletManager)

**Starting Inventory:**
- Players start with 3 torches: `self.inventory.torch = 3`

### Client-Side PlayerEntity

The client-side player entity is defined in [`client/js/entities/PlayerEntity.js`](client/js/entities/PlayerEntity.js):

```javascript
function PlayerEntity(initPack) {
  // Client-side representation of player
  // Handles rendering, sprite assignment, and client-side state
}
```

**Key Client Properties:**
- Sprite assignment via `assignSpriteToEntity()`
- Rendering via `PlayerRenderer.render()`
- Client-side input state synchronization
- Visual state (ghost, stealthed, revealed, working flags)

---

## Controls and Input

### Input Handler

All player input is managed by [`client/js/core/InputHandler.js`](client/js/core/InputHandler.js), which handles keyboard and mouse events and sends messages to the server.

### Keyboard Controls

**Movement (Legacy - Click Navigation is Primary):**
- `W` / `Up Arrow`: Move up (sends `keyPress` with `inputId: 'up'`)
- `S` / `Down Arrow`: Move down (sends `keyPress` with `inputId: 'down'`)
- `A` / `Left Arrow`: Move left (sends `keyPress` with `inputId: 'left'`)
- `D` / `Right Arrow`: Move right (sends `keyPress` with `inputId: 'right'`)

**Action Keys:**
- `E`: Interact key (toggles `pressingE`)
- `T`: Toggle key (toggles `pressingT`)
- `I`: Inventory key (toggles `pressingI`)
- `P`: Character sheet key (toggles `pressingP`)
- `F`: Work command mode / Fishing key (toggles `pressingF`)
- `H`: Help key (toggles `pressingH`)
- `K`: Key command (toggles `pressingK`)
- `L`: Light torch key (toggles `pressingL`)
- `X`: Special action key (toggles `pressingX`)
- `C`: Special action key (toggles `pressingC` - keydown only)
- `N`: Special action key (toggles `pressingN`)
- `M`: Map key (toggles `pressingM` - keydown only)

**Number Keys (1-0):**
- `1` through `0`: Number key states (toggles `pressing1` through `pressing0`)

**Modifiers:**
- `Shift`: Toggle running (walk/run toggle) - keydown only, toggles `running` boolean

**Combat:**
- `A`: Attack command mode (when not in work mode) - handled differently from movement A key

### Mouse Controls

**Click Navigation:**
- **Left Click**: Navigate to clicked tile (sends `clickNavigate` message with `{tileX, tileY, z}`)
- **Right Click**: Context menu / alternative actions
- **Mouse Movement**: Updates `mouseAngle` for ranged combat direction (sends `keyPress` with `inputId: 'mouseAngle'`)

### Input Message System

All input is sent to the server via WebSocket messages in the format:

```javascript
{
  msg: 'keyPress',
  inputId: 'up' | 'down' | 'left' | 'right' | 'e' | 't' | 'i' | 'p' | 'f' | 'h' | 'k' | 'l' | 'x' | 'c' | 'n' | 'm' | '1'-'0' | 'shift' | 'mouseAngle',
  state: true | false | angle (for mouseAngle)
}
```

**Click Navigation Message:**
```javascript
{
  msg: 'clickNavigate',
  tileX: number,
  tileY: number,
  z: number
}
```

### Server-Side Input Processing

Input is processed in [`lambic.js`](lambic.js) starting at line 6781 in the socket message handler:

```javascript
if(data.msg == 'keyPress'){
  // Update player input state
  if(data.inputId == 'e'){
    player.pressingE = data.state;
  }
  // ... other keys
  else if(data.inputId == 'shift'){
    if(data.state){
      player.running = !player.running; // Toggle running
    }
  }
}
```

**Click Navigation Processing** (line ~6866):
- Validates target tile walkability
- Handles z-level transitions
- Creates pathfinding path using tilemap system
- Sets `player.path` and `player.pathCount = 0`
- Clears work targets and attack-move commands

---

## Movement and Navigation

### Pathfinding System

Players use the **tilemap pathfinding system** for navigation. When a player clicks a destination:

1. **Path Calculation**: Uses `global.tilemapSystem.findPath(startLoc, targetLoc, layer, options)`
2. **Path Storage**: Path stored as array of waypoints in `player.path`
3. **Path Following**: Player moves toward each waypoint sequentially
4. **Path Completion**: When `pathCount >= path.length`, path is cleared

### Movement Mechanics

**Path Following** (implemented in `updateSpd()`, line ~3141):
```javascript
if(self.path && self.path.length > 0){
  if(self.pathCount < self.path.length){
    var next = self.path[self.pathCount];
    var dest = getCenter(next[0], next[1]);
    // Move toward waypoint
    // When within maxSpd range, snap to waypoint and increment pathCount
  }
}
```

**Movement Flags:**
- `pressingRight`, `pressingLeft`, `pressingUp`, `pressingDown`: Set during path following
- `facing`: Updated based on movement direction ('up', 'down', 'left', 'right')

### Speed System

**Base Speed:**
- **Walking**: `baseSpd = 2` (when `running = false`)
- **Running**: `baseSpd = 4` (when `running = true`)
- Toggled with `Shift` key

**Terrain Speed Modifiers** (calculated in `updateSpd()`, line ~2966):

| Terrain Type | Speed Modifier | Notes |
|-------------|----------------|-------|
| Heavy Forest | 30% of baseSpd | `innaWoods = true` |
| Light Forest | 50% of baseSpd | |
| Rocks | 60% of baseSpd | |
| Mountain | 20% (first time) → 50% (after 2s) | `onMtn` flag set after delay |
| Road | 110% of baseSpd | |
| Water (Underwater) | 10% of baseSpd | Running disabled, forced to walk |
| Normal | 100% of baseSpd | |
| Caves/Buildings | 100% of baseSpd | No terrain modifiers |

**Final Speed Calculation:**
```javascript
maxSpd = (baseSpd * terrainModifier) * drag
```

**Ghost Mode Speed:**
- Fixed speed: `baseSpd = 4`, `maxSpd = 4`
- Ignores all terrain modifiers
- No running toggle (always at run speed)

### Z-Level Transitions

Players can navigate across multiple Z-levels:

**Z-Level Hierarchy:**
- `-3`: Underwater
- `-2`: Cellar
- `-1`: Cave (underworld)
- `0`: Overworld
- `1`: Building ground floor
- `2`: Building second floor

**Transition Types:**
- **Cave Entrance** (Overworld → Cave): Tile type 6, transitions to z=-1
- **Cave Exit** (Cave → Overworld): Tile type 2 on cave layer, transitions to z=0
- **Building Door** (Overworld → Building): Tile type 14 or 16, transitions to z=1
- **Building Exit** (Building → Overworld): Exit via door tile
- **Stairs** (Building Floor 1 ↔ Floor 2): Tile type 3/4/7, transitions between z=1 and z=2
- **Cellar Stairs** (Cellar ↔ Building Floor 1): Tile type 5, transitions between z=-2 and z=1
- **Water** (Overworld → Underwater): Tile type 0 (water), transitions to z=-3

**Multi-Z Pathfinding:**
- Uses `createMultiZPath()` function to plan routes across Z-levels
- Finds optimal transition points (cave entrances, building doors, stairs)
- Creates waypoints for each Z-level transition

### Collision Detection

**Blocking Checks** (in `updateSpd()`, line ~3056):
- **Map Bounds**: Blocks movement at map edges
- **Terrain**: Non-walkable tiles block movement
- **Doors**: Locked doors require keys (checked via `keyCheck()`)
- **Gates**: Gates require faction/house permissions (checked via `gateCheck()`)
- **Buildings**: Building walls block movement

**Ghost Mode Collision:**
- Only blocked by map bounds
- Can pass through all terrain, doors, gates, and buildings

### Movement Interruptions

**Navigation Interrupts:**
- Clicking a new destination clears current path and creates new one
- Work actions can interrupt movement
- Combat can interrupt movement
- Z-level transitions pause movement briefly (`zTransitionHalt` flag)

---

## Stats and Attributes

### Health System

**Health Properties:**
- `hp`: Current health points
- `hpMax`: Maximum health points
- `hpNat`: Natural/base health (100)

**Health Management:**
- Default: `hp = 100`, `hpMax = 100`
- Can be modified by equipment, buffs, or class
- When `hp <= 0`, player dies (triggers `die()` function)

### Spirit System

**Spirit Properties:**
- `spirit`: Current spirit points
- `spiritMax`: Maximum spirit points
- `spiritNat`: Natural/base spirit (100)

**Spirit Usage:**
- Default: `spirit = 100`, `spiritMax = 100`
- Used for special abilities or magic (if implemented)
- Can be modified by equipment or class

### Breath System

**Breath Properties:**
- `breath`: Current breath points (for underwater)
- `breathMax`: Maximum breath points (100)

**Underwater Mechanics:**
- When `z === -3` (underwater), breath decreases over time
- When breath reaches 0, player takes damage or dies
- Surfacing restores breath to `breathMax`
- Ghosts are immediately moved to surface if underwater when dying

### Combat Attributes

**Strength:**
- `strength`: Base strength stat (default: 10 for players)
- Affects melee damage

**Dexterity:**
- `dexterity`: Base dexterity stat (default: 1 for players)
- Affects attack speed and accuracy

**Damage:**
- `damage`: Additional damage modifier
- Added to base damage calculations

**Fortitude:**
- `fortitude`: Defense/resistance stat
- Reduces incoming damage

**Attack Rate:**
- `attackrate`: Attack speed/cooldown (default: 50)
- Lower values = faster attacks

### Progression Stats

**Kills:**
- `kills`: Total kill count (integer)
- Incremented when player kills another entity
- Used for skull display and miniboss growth (for fauna)

**Skulls Display:**
- `skulls`: String display for kill count
- `''` (empty): 0-2 kills
- `'💀'`: 3-9 kills
- `'☠️'`: 10+ kills

---

## Inventory System

### Inventory Structure

The inventory system is defined in [`server/js/Inventory.js`](server/js/Inventory.js) and provides a comprehensive item storage system.

**Inventory Object:**
```javascript
{
  // Resources
  key: 0,
  wood: 0,
  stone: 0,
  grain: 0,
  ironore: 0,
  iron: 0,
  steel: 0,
  boarhide: 0,
  leather: 0,
  silverore: 0,
  silver: 0,
  goldore: 0,
  gold: 0,
  diamond: 0,
  
  // Weapons
  huntingknife: 0,
  dague: 0,
  rondel: 0,
  misericorde: 0,
  bastardsword: 0,
  longsword: 0,
  zweihander: 0,
  morallta: 0,
  bow: 0,
  welshlongbow: 0,
  knightlance: 0,
  rusticlance: 0,
  paladinlance: 0,
  
  // Armor
  brigandine: 0,
  lamellar: 0,
  maille: 0,
  hauberk: 0,
  brynja: 0,
  cuirass: 0,
  steelplate: 0,
  greenwichplate: 0,
  gothicplate: 0,
  clericrobe: 0,
  monkcowl: 0,
  blackcloak: 0,
  
  // Tools & Items
  tome: 0,
  runicscroll: 0,
  sacredtext: 0,
  stoneaxe: 0,
  ironaxe: 0,
  pickaxe: 0,
  torch: 0,
  
  // Food
  bread: 0,
  fish: 0,
  lamb: 0,
  boarmeat: 0,
  venison: 0,
  poachedfish: 0,
  lambchop: 0,
  boarshank: 0,
  venisonloin: 0,
  
  // Beverages
  mead: 0,
  saison: 0,
  flanders: 0,
  bieredegarde: 0,
  bordeaux: 0,
  bourgogne: 0,
  chianti: 0,
  
  // Special Items
  crown: 0,
  arrows: 0,
  worldmap: 0,
  cavemap: 0,
  relic: 0,
  
  // Special Properties
  keyRing: [], // Array of {id: building_id, name: building_name}
  mapData: null
}
```

### Key Ring System

**Key Ring:**
- `keyRing`: Array of key objects `[{id: building_id, name: building_name}, ...]`
- Used to access locked buildings and locked chests
- Keys are added when player receives building ownership or finds keys
- Checked via `keyCheck(x, y, playerId)` function

### Starting Inventory

**New Players:**
- Start with 3 torches: `inventory.torch = 3`
- Gold initialized to 0 (via wallet system)

### Inventory Management

**Item Stacking:**
- Most items stack (quantity stored as number)
- Max stack sizes vary by item type (typically 10, but can be customized)

**Inventory Limits:**
- No explicit total inventory limit (unlimited slots)
- Individual item quantities may have max stack limits

**Inventory Access:**
- Press `I` to open inventory UI
- Inventory displayed in character sheet
- Can transfer items to/from chests

### Stores System

Players also have a `stores` object (inherited from Character) for bulk resource storage:

```javascript
stores: {
  grain: 0,
  wood: 0,
  stone: 0,
  ironore: 0,
  iron: 0,
  silverore: 0,
  silver: 0,
  goldore: 0,
  gold: 0,
  diamond: 0
}
```

**Stores vs Inventory:**
- `inventory`: Personal carrying capacity (used for active items, tools, weapons)
- `stores`: Bulk storage (used for resources, can be deposited in buildings)

---

## Combat Mechanics

### Attack Command Mode

**Activation:**
- Press `A` key (when not in work command mode)
- Enters attack command mode
- Click on target entity to attack

**Attack System:**
- Uses `SimpleCombat` system for combat resolution
- Players choose when to engage (no automatic aggro checks)
- Attack-move commands: Player moves toward target and attacks when in range

### Combat State

**Combat Properties:**
- `combat.target`: Target entity ID (null when not in combat)
- `combat.action`: Combat action state
- `attackCooldown`: Cooldown timer between attacks
- `actionCooldown`: General action cooldown

### Ranged Combat

**Mouse Angle:**
- `mouseAngle`: Direction for ranged attacks
- Updated continuously via mouse movement
- Sent to server via `keyPress` message with `inputId: 'mouseAngle'`

**Ranged Classes:**
- Classes with `ranged = true` use mouse angle for attack direction
- Examples: 'TeutonBow', 'FrankBow', 'Poacher', 'Archer'

### Auto-Attack

**Auto-Attack System:**
- When in combat, player automatically attacks target
- Can be paused by clicking new destination (`autoAttackPaused = true`)
- Resumes when target is in range or combat ends

### Combat Integration

**SimpleCombat System:**
- Players use `global.simpleCombat` for combat resolution
- Combat ends when:
  - Target dies
  - Target escapes
  - Player manually cancels (by navigating away)

**Combat End:**
- `global.simpleCombat.endCombat(player)` called when combat ends
- Clears `combat.target` and combat state

---

## Work Systems

### Auto-Work System

The auto-work system allows players to automatically perform work actions at target tiles.

**Work Target:**
- `workTargetTile`: Object containing work target information:
  ```javascript
  {
    tileX: number,
    tileY: number,
    z: number,
    workType: 'chopping' | 'mining' | 'farming' | 'fishing' | 'building' | 'clearing',
    fishingWaterTile?: {x, y} // For fishing work type
  }
  ```

**Work Command Mode:**
- Press `F` to enter work command mode
- Right-click on resource tile to set work target
- Player automatically paths to target and begins work

### Work Types

#### Chopping (Wood Gathering)

**Activation:**
- Right-click on forest tile (heavy forest or light forest) in work mode
- Sets `workTargetTile` with `workType: 'chopping'`

**Mechanics:**
- Player paths to target tile
- When adjacent/at tile, calls `handleWorkAction()`
- Checks if tile has wood resources (`getTile(6, x, y) > 0`)
- If wood available:
  - Sets `chopping = true`, `working = true`
  - After timeout, adds wood to inventory
  - Decrements tile wood count
  - **Auto-continues**: If tile still has wood, automatically continues chopping
- If no wood, clears work target

**Code Location:** [`lambic.js`](lambic.js) line ~4099

#### Mining (Stone/Ore Gathering)

**Activation:**
- Right-click on rock/mountain tile in work mode
- Sets `workTargetTile` with `workType: 'mining'`

**Mechanics:**
- Player paths to target tile
- When at tile, checks for stone/ore resources
- If resources available:
  - Sets `mining = true`, `working = true`
  - After timeout, adds resources to inventory (stone, ironore, silverore, goldore, diamond)
  - Decrements tile resource count
  - **Auto-continues**: If tile still has resources, automatically continues mining
- If no resources, clears work target

**Code Location:** [`lambic.js`](lambic.js) line ~4189

#### Farming

**Activation:**
- Right-click on farm tile in work mode
- Sets `workTargetTile` with `workType: 'farming'`

**Farm States:**
- **Empty**: Can seed with grain
- **Seeded**: Grows over time
- **Grown**: Can harvest grain

**Mechanics:**
- **Seeding**: Player seeds farm tile with grain from inventory
- **Growing**: Farm tile grows automatically over time
- **Harvesting**: Player harvests grain when farm is grown
  - Sets `farming = true`, `working = true`
  - After timeout, adds grain to inventory
  - Resets farm tile to empty state
  - **Auto-continues**: If farm tile still needs work, automatically continues

**Code Location:** [`lambic.js`](lambic.js) line ~4337

#### Fishing

**Activation:**
- Right-click on water tile in work mode
- Sets `workTargetTile` with `workType: 'fishing'` and `fishingWaterTile: {x, y}`

**Mechanics:**
- Player paths to land tile adjacent to target water tile
- When adjacent, checks water tile for fish (`getTile(6, waterX, waterY) > 0`)
- If fish available:
  - Sets `fishing = true`, `working = true`
  - After random timeout (0-6000ms), adds fish to inventory
  - Decrements water tile fish count
  - **Auto-continues**: If water tile still has fish, automatically continues fishing
- If no fish, clears work target

**Special Case - Ship Fishing:**
- If player is controlling a fishing ship (`shipType === 'fishingship'`)
- Can fish directly from ship (no need to be on land)
- Fish stored in ship inventory (max 20)
- 5-second cooldown between catches

**Code Location:** [`lambic.js`](lambic.js) line ~3941

#### Building (Construction)

**Activation:**
- Right-click on foundation/construction tile in work mode
- Sets `workTargetTile` with `workType: 'building'`

**Mechanics:**
- Player paths to construction tile
- When at tile, checks if building needs construction
- If construction needed:
  - Sets `building = true`, `working = true`
  - Player contributes resources from inventory/stores
  - Building construction progress increases
  - **Auto-continues**: If building still needs construction, automatically continues
- When building complete, clears work target

**Code Location:** [`lambic.js`](lambic.js) line ~4352

#### Clearing (Brush Removal)

**Activation:**
- Right-click on brush tile in work mode
- Sets `workTargetTile` with `workType: 'clearing'`

**Mechanics:**
- Player paths to brush tile
- When at tile:
  - Sets `working = true`
  - After timeout, converts brush tile to empty terrain
  - **Auto-continues**: If tile still has brush, automatically continues clearing
- Can reveal sunk items (items at z=-3 that were dropped in water)

**Code Location:** [`lambic.js`](lambic.js) line ~4023

### Work Action Handler

**Main Function:** `handleWorkAction()` (line ~3874)

This function:
1. Checks `workTargetTile` for target location
2. Determines work type
3. Validates work can be performed (resources available, correct tile type)
4. Sets work flags (`working`, `chopping`, `mining`, etc.)
5. Performs work action after timeout
6. Updates inventory/resources
7. Auto-continues if work target still valid

**Work Interruption:**
- Clicking new destination clears `workTargetTile`
- Movement interrupts work
- Combat can interrupt work
- Death clears all work flags

---

## Interactions

### Building Interactions

**Interaction System:** [`server/js/Interact.js`](server/js/Interact.js)

**Activation:**
- Press `E` key or click on building (when adjacent)
- Player must be adjacent to building to interact
- Uses `isPlayerAdjacentToEntity()` to check adjacency

**Building Types & Interactions:**

#### Mill
- Opens deposit UI for grain
- Player can deposit grain from inventory

#### Lumbermill
- Opens deposit UI for wood
- Player can deposit wood from inventory

#### Mine
- Opens deposit UI for stone and ores
- Player can deposit: stone, ironore, silverore, goldore, diamond

#### Dock
- Opens dock interaction menu
- Shows available ships to build (fishing ships)
- Shows owned ships at this dock
- Shows cargo ships available for boarding
- Access control: Neutral players or friendly factions can access (not just owner)

#### Stable
- Interact with horses (if available)

#### Market
- Interact with market goods (Goods1-4 items on z=1)
- Opens market orderbook UI
- View buy/sell orders
- Place orders via commands: `/buy [amt] [item] [price]`, `/sell [amt] [item] [price]`

#### Garrison
- Interact with desk (on z=2)
- If building owner: Opens house creation UI
- If house member: Access military reports
- If no house: Request to join house

### Item Interactions

#### Chests

**Regular Chest:**
- Click on chest (when adjacent)
- Opens chest inventory UI
- Can transfer items between player inventory and chest

**Locked Chest:**
- Requires key in `keyRing`
- Key must match chest ID
- If no key, shows message: "This chest is locked. You need a key to open it."

**Chest Locations:**
- Can be on overworld (z=0)
- Can be inside buildings (z=1, z=2)
- Can be in caves (z=-1)
- Can be underwater (z=-3)

#### Item Pickup

**Pickup System:**
- Items on ground can be picked up automatically when player walks over them
- Or manually via interaction
- Uses `Item.pickup(playerId)` method

### Ship Interactions

#### Boarding Ships

**Activation:**
- Click on ship (when adjacent) in interact mode
- Sets `pendingInteraction` with `{type: 'ship', id: shipId}`
- Player paths to ship
- When adjacent, calls `ship.boardPassenger(playerId)`

**Ship Types:**
- **Fishing Ship**: Player-owned ships can be boarded if at dock or abandoned
- **Cargo Ship**: Public transport, always boardable

**Ship Boarding Rules:**
- Player-owned ships at dock: Only owner can board
- Abandoned ships (not at dock): Anyone can board
- Cargo ships: Always boardable (public transport)

**Boarding State:**
- `isBoarded = true` when on ship
- `boardedShip = shipId` stores ship reference
- `boardCooldown` prevents rapid boarding/unboarding

**Ship Navigation:**
- When aboard ship as navigator, WASD keys control ship sails
- Ship movement uses momentum-based system
- `F` key used for fishing (if fishing ship)

### Pending Interaction System

**Pending Interaction:**
- `pendingInteraction`: Object storing interaction target `{type: 'building'|'item'|'ship', id: entityId}`
- Set when player clicks on interactable entity
- Player paths to entity
- When adjacent, interaction is triggered
- Cleared after interaction completes or is cancelled

**Adjacency Check:**
- Uses `isPlayerAdjacentToEntity(entity, entityType, playerLoc)` function
- Checks all 8 adjacent directions
- For buildings: Checks building plot tiles
- For items: Checks item location
- For ships: Checks ship location

---

## Death and Respawn

### Death System

**Death Handler:** `Player.die(report)` (line ~2656)

**Death Triggers:**
- `hp <= 0` (from combat, drowning, etc.)
- Death report contains: `{id: killerId, cause: 'drowning'|'combat'|etc.}`

**Death Process:**

1. **Kill Tracking:**
   - If killed by another player/NPC, killer's `kills` incremented
   - Killer's skull display updated (💀 at 3 kills, ☠️ at 10 kills)
   - For fauna killers (Boar/Wolf): Sprite scale increases at kill thresholds

2. **Combat End:**
   - Ends combat for both killed player and killer
   - Clears combat targets

3. **Death Event:**
   - Creates death event via `eventManager.death()`
   - Logs death location, killer, cause

4. **Skeleton Spawn:**
   - Spawns skeleton entity at death location
   - Skeleton contains death location marker

5. **Inventory Dropping:**
   - All inventory items dropped and scattered around death location
   - All stores resources dropped
   - Items scattered in random pattern (within 2 tiles)
   - Special properties (`keyRing`, `mapData`) not dropped

6. **Ghost Mode Entry** (Players only):
   - Sets `ghost = true`
   - Sets `ghostTimer = 5400` (90 seconds at 60fps)
   - Sets `hp = 1` (ghosts can't die again)
   - Sets fixed speed: `baseSpd = 4`, `maxSpd = 4`
   - Clears all work flags
   - If underwater, immediately moves to surface
   - Clears combat state and path
   - Sends death message to player with ghost instructions
   - Triggers ghost mode audio/visual effects

7. **NPC Respawn** (NPCs only):
   - Immediate respawn at random spawn location
   - Full HP restored
   - All state cleared

### Ghost Mode

**Ghost Properties:**
- `ghost = true`: Player is in ghost mode
- `ghostTimer = 5400`: Countdown timer (90 seconds)
- `hp = 1`: Minimal HP (can't die)
- Fixed speed: `baseSpd = 4`, `maxSpd = 4` (run speed)
- `drag = 1`: No terrain modifiers
- `running = false`: Running disabled
- Ignores terrain collision (except map bounds)
- Can pass through doors, gates, buildings
- Can walk through water (but not required to)

**Ghost Movement:**
- Uses same pathfinding system
- Speed fixed at 4 (run speed)
- No terrain speed modifiers
- Can navigate to any location for respawn

**Ghost Timer:**
- Counts down from 5400 frames (90 seconds at 60fps)
- When timer reaches 0, auto-respawns at current location
- Player can manually respawn earlier via `/respawn` command

**Ghost Visual/Audio:**
- Special ghost mode rendering (handled client-side)
- Audio effects triggered via `ghostMode` message

### Respawn System

**Respawn Function:** `respawnFromGhost(location, isManualRespawn)` (line ~2857)

**Respawn Process:**

1. **Validation:**
   - Checks `ghost === true` (only ghosts can respawn)
   - If not ghost, returns early

2. **Ghost State Clear:**
   - Sets `ghost = false`
   - Sets `ghostTimer = 0`
   - Restores `hp = hpMax`

3. **Location:**
   - If `location` provided: Respawns at specified location `{x, y, z}`
   - If no location: Respawns at current ghost location

4. **Facing Direction:**
   - If `isManualRespawn = true`: Faces 'up' (toward fireplace at home)
   - Otherwise: Keeps current facing

5. **State Reset:**
   - Clears `innaWoods`, `onMtn`, `revealed` flags
   - Clears stealth state

6. **Respawn Immunity:**
   - Sets `respawnImmunity = true`
   - After 3 seconds, sets `respawnImmunity = false`
   - Prevents immediate death after respawn

7. **Respawn Event:**
   - Creates respawn event via event system
   - Sends respawn message to player
   - Restores normal audio/visual effects

**Respawn Commands:**
- `/respawn`: Manual respawn at current location (faces up)
- Auto-respawn: After 90 seconds, respawns at current ghost location

**Respawn Locations:**
- **Manual**: Current ghost location (player chose where to respawn)
- **Auto**: Current ghost location (where ghost was when timer expired)
- **Home Respawn**: Can respawn at home via command (if implemented)

---

## Progression Systems

### Kill Tracking

**Kill Count:**
- `kills`: Integer tracking total kills
- Incremented when player kills another entity (player or NPC)
- Tracked in `die()` function when `report.id` exists

**Kill Rewards:**
- Each kill increments killer's `kills` counter
- Skull display updated based on kill count

### Skull Display System

**Skull Progression:**
- `skulls = ''` (empty): 0-2 kills
- `skulls = '💀'`: 3-9 kills (single skull)
- `skulls = '☠️'`: 10+ kills (skull and crossbones)

**Display:**
- Shown above player name/portrait
- Visible to other players
- Indicates player's combat prowess

### Title System

**Title Properties:**
- `knighted`: Boolean flag for knight status
- `crowned`: Boolean flag for crowned status
- `title`: String for custom title

**Title Display:**
- Titles shown in player name display
- Can be combined (e.g., "Sir [Name]" for knighted, "[Name] the Crowned" for crowned)

### Faction Relationships

**Faction Properties:**
- `house`: House/faction ID
- `kingdom`: Kingdom ID
- `friends`: Array of friend entity IDs
- `enemies`: Array of enemy entity IDs

**Relationship System:**
- Friends: Non-hostile, can share resources/buildings
- Enemies: Hostile, can attack on sight
- Neutral: Default state for unknown players

**Faction Interactions:**
- Building access based on house/kingdom
- Combat targeting based on enemies list
- Trade and resource sharing based on relationships

### Miniboss Growth (Fauna)

**Special Progression:**
- For fauna classes (Boar, Wolf): Kill count affects sprite size
- **3 kills**: `spriteScale = 1.3` (30% larger)
- **10 kills**: `spriteScale = 1.6` (60% larger)
- Visual indicator of dangerous fauna

---

## Special Modes

### God Mode

**God Mode Properties:**
- `godMode = true`: Player is in god mode
- `godModeReturnPos`: Position to return to when exiting god mode

**Activation:**
- Entered via `/godmode` command
- Switches to spectator camera system
- Player entity remains but camera is detached

**God Mode Features:**
- Free camera movement (WASD keys)
- Z-level navigation (Up/Down arrows)
- Faction cycling (Left/Right arrows)
- View-only mode (cannot interact with world)
- Exit via `/godmode` command again

**Camera Controls:**
- `W`/`S`: Move camera up/down
- `A`/`D`: Move camera left/right
- `Up Arrow`/`Down Arrow`: Change Z-level
- `Left Arrow`/`Right Arrow`: Cycle between factions

### Spectate Mode

**Spectate Mode:**
- No player entity created
- Camera-only view of the world
- Entered when connecting without creating player
- Uses `spectateCameraSystem` for camera control

**Differences from God Mode:**
- No player entity exists
- Cannot switch back to player mode (must reconnect)
- Pure spectator experience

### Ghost Mode

**Ghost Mode:**
- Post-death state for players
- See [Death and Respawn](#death-and-respawn) section for details
- Special movement and rendering
- Temporary state (90 seconds or until manual respawn)

---

## Technical Details

### Player Update Loop

**Update Function:**
- Players are updated in main game loop via `Player.update()`
- Located in [`lambic.js`](lambic.js) around line 5121
- Calls `player.update()` for each player entity
- Which triggers `Character.update()` from base class

**Update Process:**
1. **Input Processing**: Handles key press states
2. **Movement**: Updates position via `updateSpd()`
3. **Work Actions**: Checks and executes work actions
4. **Combat**: Updates combat state and auto-attack
5. **Terrain Effects**: Applies terrain modifiers
6. **Z-Level Transitions**: Handles Z-level changes
7. **State Updates**: Updates cooldowns, timers, etc.

### Client-Server Synchronization

**Init Pack:**
- Sent when player connects or entity is created
- Contains all initial player state
- Includes: position, class, inventory, stats, gear, etc.

**Update Pack:**
- Sent periodically (throttled)
- Contains delta changes to player state
- Includes: position updates, stat changes, inventory changes, etc.

**Input Messages:**
- Sent immediately on input events
- Not throttled (real-time input)
- Includes: key presses, mouse movement, click navigation

### Sprite System

**Sprite Assignment:**
- Sprites assigned via `assignSpriteToEntity()` function
- Sprite size determined by class (from `SPRITE_SIZES` constant)
- Ghost sprites use special ghost variant
- Sprite size stored in `spriteSize` property

**Sprite Sizes:**
- Most classes: 96px
- Some classes: 128px (Knights, Lancers, etc.)
- Special classes: 192px (Charlemagne, ImperialKnight, etc.)
- Fauna: 64px (Sheep, Deer, Boar, Wolf) or 448px (Falcon)

**Rendering:**
- Handled by `PlayerRenderer.render()` on client
- Located in [`client/js/rendering/PlayerRenderer.js`](client/js/rendering/PlayerRenderer.js)
- Handles sprite drawing, animations, UI overlays, etc.

### Pathfinding Integration

**Tilemap System:**
- Uses `global.tilemapSystem.findPath()` for pathfinding
- Supports multi-Z pathfinding via `createMultiZPath()`
- Path caching for performance
- Path smoothing to reduce zigzag movement

**Path Options:**
- `avoidDoors`: Avoid building entrances (unless targeting)
- `avoidCaveEntrances`: Avoid cave entrances (unless targeting)
- `avoidWater`: Avoid water tiles (unless targeting or ghost)
- `ghost`: Allow ghost pathfinding (can walk through water)
- `allowSpecificDoor`: Allow specific door/building
- `targetCaveEntrance`: Target specific cave entrance
- `targetWaterTile`: Target specific water tile

### Event System Integration

**Event Manager:**
- Player actions trigger events via `global.eventManager`
- Event categories: DEATH, ECONOMIC, SOCIAL, etc.
- Events logged and can trigger notifications
- Used for death messages, work completion, interactions, etc.

---

## Code References

### Server-Side Files

- **Player Constructor**: [`lambic.js`](lambic.js) line ~2570
- **Character Base Class**: [`server/js/Entity.js`](server/js/Entity.js) line ~1920
- **Inventory System**: [`server/js/Inventory.js`](server/js/Inventory.js)
- **Interaction System**: [`server/js/Interact.js`](server/js/Interact.js)
- **Input Processing**: [`lambic.js`](lambic.js) line ~6781
- **Click Navigation**: [`lambic.js`](lambic.js) line ~6866
- **Movement System**: [`lambic.js`](lambic.js) line ~2966 (`updateSpd()`)
- **Work System**: [`lambic.js`](lambic.js) line ~3874 (`handleWorkAction()`)
- **Death System**: [`lambic.js`](lambic.js) line ~2656 (`die()`)
- **Respawn System**: [`lambic.js`](lambic.js) line ~2857 (`respawnFromGhost()`)

### Client-Side Files

- **PlayerEntity Constructor**: [`client/js/entities/PlayerEntity.js`](client/js/entities/PlayerEntity.js)
- **Input Handler**: [`client/js/core/InputHandler.js`](client/js/core/InputHandler.js)
- **Player Renderer**: [`client/js/rendering/PlayerRenderer.js`](client/js/rendering/PlayerRenderer.js)
- **Sprite Assigner**: [`client/js/core/SpriteAssigner.js`](client/js/core/SpriteAssigner.js)

### Related Systems

- **Pathfinding**: Global tilemap system (`global.tilemapSystem`)
- **Combat**: SimpleCombat system (`global.simpleCombat`)
- **Events**: EventManager system (`global.eventManager`)
- **Wallet**: WalletManager system (`WalletManager`)

---

## Summary

The Player system is a comprehensive entity system that provides:

- **Direct Control**: Keyboard and mouse input for player actions
- **Smart Navigation**: Click-based pathfinding with multi-Z support
- **Work Automation**: Auto-work system for resource gathering
- **Combat System**: Attack commands and auto-attack mechanics
- **Rich Interactions**: Building, item, and ship interactions
- **Death/Respawn Cycle**: Ghost mode with manual and automatic respawn
- **Progression Tracking**: Kills, skulls, titles, and faction relationships
- **Special Modes**: God mode, spectate mode, and ghost mode

Players are the primary interactive entities in Lambic, with sophisticated systems for movement, work, combat, and world interaction, all built on top of the Character base class with player-specific enhancements.









