# Item System Documentation

## Overview

The item system in Lambic is a comprehensive inventory, equipment, and storage management system that handles all items in the game world. This document provides an in-depth breakdown of item types, equipping mechanics, stat calculations, inventory/storage systems, dropping/looting, and all related code.

## Table of Contents

1. [Item Types and Classification](#item-types-and-classification)
2. [Item Creation and Factory System](#item-creation-and-factory-system)
3. [Inventory System](#inventory-system)
4. [Equipping System](#equipping-system)
5. [Stats and Bonuses](#stats-and-bonuses)
6. [Storage Systems](#storage-systems)
7. [Dropping System](#dropping-system)
8. [Looting System](#looting-system)
9. [Item Pickup](#item-pickup)
10. [Code Architecture](#code-architecture)

---

## Item Types and Classification

### Item Categories

Items are organized into several categories, each with distinct properties and purposes:

#### 1. Resources (`class: 'resource'`)
Basic materials used for crafting and building:
- **Common (rank 0)**: `wood`, `stone`, `grain`, `ironore`, `iron`, `silverore`, `silver`, `goldore`, `gold`, `boarhide`, `leather` (maxStack: 10)
- **Rare (rank 1)**: `steel` (maxStack: 10)
- **Lore (rank 2)**: `diamond` (maxStack: 5)

#### 2. Weapons (`class: 'weapon'`)
Combat items that can be equipped in weapon slots:
- **Common (rank 0)**: `dague`, `rondel`, `misericorde`, `bow`, `rusticlance`, `arrows` (maxStack: 50 for arrows, 1 for others)
- **Rare (rank 1)**: `bastardsword`, `longsword`, `zweihander`, `morallta`, `welshlongbow`, `knightlance` (maxStack: 1)
- **Lore (rank 2)**: `paladinlance` (maxStack: 1)

#### 3. Armor (`class: 'armor'`)
Protective equipment worn on the body:
- **Common (rank 0)**: `brigandine`, `lamellar`, `clericrobe`, `monkcowl` (maxStack: 1)
- **Rare (rank 1)**: `maille`, `hauberk`, `brynja`, `cuirass`, `blackcloak` (maxStack: 1)
- **Lore (rank 2)**: `steelplate`, `greenwichplate`, `gothicplate` (maxStack: 1)

#### 4. Tools (`class: 'tool'`)
Utility items for gathering and crafting:
- **Common (rank 0)**: `pickaxe`, `stoneaxe`, `ironaxe`, `huntingknife` (maxStack: 1), `torch` (maxStack: 10)

#### 5. Magic Items (`class: 'magic'`)
Mystical items with special properties:
- **Common (rank 0)**: `tome` (maxStack: 1)
- **Rare (rank 1)**: `runicscroll` (maxStack: 1)
- **Lore (rank 2)**: `sacredtext` (maxStack: 1)

#### 6. Food & Consumables
- **Food (`class: 'food'`)**: `bread`, `fish`, `meat`, `lamb`, `boarmeat`, `venison` (maxStack: 15-20), `poachedfish`, `lambchop`, `boarshank`, `venisonloin` (maxStack: 10)
- **Drinks (`class: 'drink'`)**: `mead`, `saison` (maxStack: 10, rank 0), `flanders`, `bieredegarde` (maxStack: 10, rank 1), `bordeaux`, `bourgogne`, `chianti` (maxStack: 10, rank 2)

#### 7. Environment Objects (`class: 'environment'`)
Decorative and interactive world objects (non-pickupable):
- `barrel`, `crates`, `bookshelf`, `suitarmor`, `anvil`, `runestone`, `dummy`, `cross`, `skeleton1`, `skeleton2`, `shipwreckage`, `goods1-4`, `stash1-2`, `desk`, `swordrack`, `bed`, `jail`, `jaildoor`, `chains`, `throne`, `banner`, `staghead`, `blood`

#### 8. Containers (`class: 'tool'`)
Storage items:
- `chest`, `lockedchest` (maxStack: 1, rank 0)

#### 9. Special Items
- **Keys (`class: 'key'`)**: `key` (maxStack: 50, rank 0)
- **Special (`class: 'special'`)**: `crown` (maxStack: 1, rank 3), `worldmap` (maxStack: 1, rank 0), `relic` (maxStack: 1, rank 3)

**Source**: [`server/js/entities/ItemFactory.js`](server/js/entities/ItemFactory.js) lines 6-120

### Rarity System

Items have a **rank** property that determines their rarity:

| Rank | Name | Color | Border Color |
|------|------|-------|--------------|
| 0 | Common | `#ffffff` (white) | `#808080` (gray) |
| 1 | Rare | `#00ff00` (green) | `#00ff00` (green) |
| 2 | Lore | `#0080ff` (blue) | `#0080ff` (blue) |
| 3 | Mythic | `#a020f0` (purple) | `#a020f0` (purple) |

**Source**: [`server/js/entities/ItemFactory.js`](server/js/entities/ItemFactory.js) lines 197-221

---

## Item Creation and Factory System

### BaseItem Class

All items inherit from the `BaseItem` class, which provides core functionality:

**File**: [`server/js/entities/BaseItem.js`](server/js/entities/BaseItem.js)

#### Properties

```javascript
{
  id: number,              // Unique identifier (Math.random() or provided)
  x: number,               // World X coordinate
  y: number,               // World Y coordinate
  z: number,               // Z-level (0=overworld, -3=underwater, etc.)
  qty: number,             // Quantity (default: 1)
  type: string,            // Item type (e.g., 'Wood', 'Dague')
  class: string,           // Item category (e.g., 'resource', 'weapon')
  rank: number,            // Rarity rank (0-3)
  parent: any,             // Parent entity reference
  maxStack: number,        // Maximum stack size
  canPickup: boolean,      // Whether item can be picked up
  toUpdate: boolean,       // Flag for update packet
  toRemove: boolean,       // Flag for removal
  innaWoods: boolean       // Whether item is in woods (affects rendering)
}
```

#### Key Methods

- **`register()`**: Registers item in `global.Item.list` and adds to init pack
- **`pickup(playerId)`**: Universal pickup logic for all items
- **`getDisplayName()`**: Returns formatted display name
- **`getRarity()`**: Returns rarity name string
- **`getRarityColor()`**: Returns color hex for rarity
- **`getInitPack()`**: Returns initialization data for client
- **`getUpdatePack()`**: Returns update data for client

**Source**: [`server/js/entities/BaseItem.js`](server/js/entities/BaseItem.js) lines 1-167

### ItemFactory

The `ItemFactory` class manages item creation and configuration:

**File**: [`server/js/entities/ItemFactory.js`](server/js/entities/ItemFactory.js)

#### Configuration System

All items are defined in `itemConfigs` object:

```javascript
{
  itemType: {
    maxStack: number,      // Maximum stack size
    class: string,         // Item category
    rank: number           // Rarity rank
  }
}
```

#### Creation Process

1. `createItem(type, param)` is called with item type and parameters
2. Configuration is looked up from `itemConfigs`
3. Global `Item` constructor is used to create item entity
4. Type is capitalized (client expects `'Wood'` not `'wood'`)
5. Properties from config are applied (`class`, `rank`, `canPickup`)
6. Pickup function is attached (checks stack limits)
7. Item is registered in `Item.list` and added to init pack

**Source**: [`server/js/entities/ItemFactory.js`](server/js/entities/ItemFactory.js) lines 123-195

---

## Inventory System

### Inventory Data Structure

Inventories use a simple object structure where keys are item types and values are quantities:

**File**: [`server/js/Inventory.js`](server/js/Inventory.js)

```javascript
{
  // Resources
  wood: 0,
  stone: 0,
  grain: 0,
  ironore: 0,
  iron: 0,
  steel: 0,
  // ... all item types initialized to 0
  
  // Special properties
  keyRing: [],           // Array of key objects: {id: building_id, name: building_name}
  mapData: null          // Map data storage
}
```

### Stacking Mechanics

- Items stack up to their `maxStack` value (defined in ItemFactory)
- Attempting to pick up items when at max stack shows error message
- Partial pickup is supported: if player has 9/10 wood and picks up 5, they get 1 and item retains 4

### Inventory Total Calculation

The `Inventory` function provides a `total()` method that sums all numeric inventory values (excluding special properties like `keyRing` and `mapData`):

```javascript
self.total = function(){
  var total = 0;
  var keys = Object.keys(self);
  for(i in keys){
    if(!Number.isNaN(self[keys[i]])){
      total += self[keys[i]];
    }
  }
  return total;
}
```

**Source**: [`server/js/Inventory.js`](server/js/Inventory.js) lines 78-87

### Special Properties

#### KeyRing

The `keyRing` array stores keys to locked chests and buildings:

```javascript
keyRing: [
  {id: building_id, name: building_name},
  // ...
]
```

Keys are checked when interacting with locked chests.

**Source**: [`server/js/Inventory.js`](server/js/Inventory.js) line 74

#### MapData

The `mapData` property stores map information (world maps, cave maps).

**Source**: [`server/js/Inventory.js`](server/js/Inventory.js) line 75

---

## Equipping System

### Equipment Slots

Players have 5 equipment slots:

1. **weapon** - Primary weapon (main hand)
2. **weapon2** - Secondary weapon (off hand) - switch with X key
3. **armor** - Body armor
4. **head** - Head gear (crowns, etc.)
5. **accessory** - Accessory slot

**Source**: [`lambic.js`](lambic.js) lines 8039-8150, [`client/index.html`](client/index.html) lines 1913-1933

### Equip Process

#### Client-Side Initiation

1. Player clicks item in inventory or uses `/equip [item]` command
2. Client sends `equipItem` message with `itemType`

**Source**: [`client/js/ui/InventoryHandler.js`](client/js/ui/InventoryHandler.js) lines 147-200

#### Server-Side Handling

**File**: [`lambic.js`](lambic.js) lines 8039-8150

The server processes `equipItem` messages:

1. Validates player has item in inventory
2. Checks item type to determine slot:
   - Weapons (`dagger`, `sword`, `bow`, `lance`) → `gear.weapon` slot
   - Armor (`leather`, `chainmail`, `plate`, `cloth`) → `gear.armor` slot
   - Head items → `gear.head` slot
3. Unequips current item in slot (if exists) - calls `unequip()` function which adds item back to inventory
4. Decrements inventory count
5. Sets `player.gear[slot] = item` (item from `global.equip`)
6. Calls `recalculatePlayerStats(player.id)` to apply stat bonuses
7. Sends `gearUpdate` message to client with updated inventory and class

### Equipment Requirements

The `EquipCommand` class enforces equipment requirements:

**File**: [`server/js/commands/commands/EquipCommand.js`](server/js/commands/commands/EquipCommand.js)

#### Weapon Requirements

- **Daggers**: Require leather/cloth armor, cannot be mounted
- **Swords**: Cannot wear cloth armor
- **Bows**: Cannot wear cloth or plate armor
- **Lances**: Must be mounted and wearing plate armor

#### Armor Requirements

- **Light armor** (brigandine, lamellar): Cannot have lance equipped
- **Medium armor** (maille, hauberk, brynja): Cannot have lance or dagger
- **Heavy armor** (cuirass, steelplate, etc.): Cannot have bow or dagger
- **Cloth armor** (clericrobe, monkcowl, blackcloak): Special requirements (cannot be mounted for clericrobe, must have dagger for monkcowl/blackcloak)

**Source**: [`server/js/commands/commands/EquipCommand.js`](server/js/commands/commands/EquipCommand.js) lines 16-59

### Unequipping

#### Via Command

Use `/unequip [slot]` command:
- `/unequip weapon` - Unequip primary weapon
- `/unequip weapon2` - Unequip secondary weapon
- `/unequip armor` - Unequip armor
- `/unequip head` - Unequip head gear
- `/unequip` - List all equipped items

**File**: [`server/js/commands/commands/UnequipCommand.js`](server/js/commands/commands/UnequipCommand.js)

#### Via UI

Right-click equipped item in character display or use context menu.

#### Automatic Unequip

- When equipping a new item in a slot, the old item is automatically unequipped
- When equipping armor that conflicts with weapon, weapon may be unequipped
- Equipment can be unequipped during combat restrictions

### Weapon Switching

Players can switch between primary and secondary weapons by pressing `X`:

**File**: [`lambic.js`](lambic.js) lines 3732-3781

- If player has `weapon2` equipped, pressing X swaps `weapon` and `weapon2`
- Creates social event for weapon switch
- Shows message with new weapon name

---

## Stats and Bonuses

### Equipment Stat Definitions

All equipment stats are defined in the `equip` object:

**File**: [`server/js/Equip.js`](server/js/Equip.js)

#### Weapon Stats

```javascript
weaponName: {
  name: string,           // Display name
  type: string,           // Weapon type (dagger, sword, bow, lance)
  dmg: number,            // Base damage
  attackrate: number,     // Attack speed (milliseconds)
  strengthBonus: number,  // Strength stat bonus
  dexterityBonus: number, // Dexterity stat bonus
  hpBonus: number,        // Maximum HP bonus (optional)
  unequip: function(id)   // Handler to return item to inventory
}
```

**Example Weapons**:
- `huntingknife`: dmg: 15, attackrate: 500, strengthBonus: 1, dexterityBonus: 2
- `dague`: dmg: 20, attackrate: 500, strengthBonus: 2, dexterityBonus: 3
- `bastardsword`: dmg: 45, attackrate: 500, strengthBonus: 5, dexterityBonus: 1
- `paladinlance`: dmg: 100, attackrate: 500, strengthBonus: 12, hpBonus: 30

**Source**: [`server/js/Equip.js`](server/js/Equip.js) lines 2-144

#### Armor Stats

```javascript
armorName: {
  name: string,           // Display name
  type: string,           // Armor type (leather, chainmail, plate, cloth)
  defense: number,        // Defense value (damage reduction)
  hpBonus: number,        // Maximum HP bonus
  spiritBonus: number,    // Maximum spirit bonus (for cloth armor)
  unequip: function(id)   // Handler to return item to inventory
}
```

**Example Armor**:
- `brigandine`: defense: 5, hpBonus: 10 (leather)
- `maille`: defense: 10, hpBonus: 20 (chainmail)
- `cuirass`: defense: 20, hpBonus: 35 (plate)
- `gothicplate`: defense: 35, hpBonus: 60 (plate, rank 2)
- `clericrobe`: defense: 3, hpBonus: 20, spiritBonus: 50 (cloth)

**Source**: [`server/js/Equip.js`](server/js/Equip.js) lines 146-257

#### Head Gear Stats

```javascript
headName: {
  name: string,
  type: string,           // Always 'head'
  unequip: function(id)
}
```

**Source**: [`server/js/Equip.js`](server/js/Equip.js) lines 259-266

### Stat Calculation

The `recalculatePlayerStats` function applies equipment bonuses:

**File**: [`lambic.js`](lambic.js) lines 5434-5481

#### Base Stats

```javascript
player.strength = 10;           // Base strength
player.dexterity = 1;           // Base dexterity
player.hpMax = player.hpNat || 100;  // Base HP (or natural HP)
player.spiritMax = player.spiritNat || 100;  // Base spirit
player.defense = 0;             // Base defense
```

#### Weapon Bonuses

```javascript
if(player.gear.weapon && equip[player.gear.weapon]){
  var weapon = equip[player.gear.weapon];
  player.damage = weapon.dmg || player.damage;
  player.attackRate = weapon.attackrate || player.attackRate;
  player.strength += weapon.strengthBonus || 0;
  player.dexterity += weapon.dexterityBonus || 0;
  player.hpMax += weapon.hpBonus || 0;
}
```

#### Armor Bonuses

```javascript
if(player.gear.armor && equip[player.gear.armor]){
  var armor = equip[player.gear.armor];
  player.defense += armor.defense || 0;
  player.hpMax += armor.hpBonus || 0;
  player.spiritMax += armor.spiritBonus || 0;
}
```

#### Head Gear Bonuses

```javascript
if(player.gear.head && equip[player.gear.head]){
  var head = equip[player.gear.head];
  player.defense += head.defense || 0;
  player.hpMax += head.hpBonus || 0;
  player.spiritMax += head.spiritBonus || 0;
}
```

#### HP/Spirit Clamping

After applying bonuses, current HP/spirit are clamped to new maximums:

```javascript
if(player.hp > player.hpMax){
  player.hp = player.hpMax;
}
if(player.spirit > player.spiritMax){
  player.spirit = player.spiritMax;
}
```

**Source**: [`lambic.js`](lambic.js) lines 5438-5481

---

## Storage Systems

### Chest Storage

Chests are item entities that can store other items:

**Types**:
- `Chest` - Regular chest (anyone can access)
- `LockedChest` - Locked chest (requires key from `keyRing`)

#### Chest Inventory

Chests have an `inventory` property (same structure as player inventory):

```javascript
chest.inventory = Inventory();  // Creates empty inventory structure
```

#### Opening Chests

**File**: [`server/js/Interact.js`](server/js/Interact.js) lines 216-265, 418-465

1. Player interacts with chest (clicks on it)
2. Server checks if chest is locked (`LockedChest` type)
3. If locked, checks `player.inventory.keyRing` for matching key:
   ```javascript
   for(var k in player.inventory.keyRing){
     var key = player.inventory.keyRing[k];
     if(key && (key.id === chest.id || key === chest.id)){
       hasKey = true;
       break;
     }
   }
   ```
4. If unlocked (or key found), sends `openChest` message to client:
   ```javascript
   {
     msg: 'openChest',
     chestId: chest.id,
     chestType: chest.type,
     inventory: chest.inventory || {},
     playerInventory: player.inventory || {}
   }
   ```

#### Storing Items

**File**: [`lambic.js`](lambic.js) lines 8294-8350

Client sends `storeInChest` message:
```javascript
{
  msg: 'storeInChest',
  chestId: number,
  itemType: string,
  quantity: number
}
```

Server process:
1. Validates chest exists and is accessible
2. Checks player has item in inventory
3. Validates quantity
4. Checks chest stack limits (if applicable)
5. Transfers item: `player.inventory[itemType] -= quantity`, `chest.inventory[itemType] += quantity`
6. Updates client with new inventories

#### Taking Items

**File**: [`lambic.js`](lambic.js) lines 8182-8293

Client sends `takeFromChest` message:
```javascript
{
  msg: 'takeFromChest',
  chestId: number,
  itemType: string,
  quantity: number
}
```

Server process:
1. Validates chest exists and is accessible
2. Checks chest has item
3. Validates quantity
4. Checks player stack limits (`maxStack`)
5. Calculates transfer quantity: `Math.min(requestedQuantity, availableInChest, playerCapacity)`
6. Transfers item atomically
7. Updates client with new inventories

### Building Storage

Buildings can store resources in their `stores` property:

**File**: [`server/js/Interact.js`](server/js/Interact.js) lines 20-56

#### Types of Building Storage

1. **Mills** (`mill`) - Store `grain`
   - Players deposit grain from inventory
   - Opens deposit UI when interacted with

2. **Lumbermills** (`lumbermill`) - Store `wood`
   - Players deposit wood from inventory
   - Opens deposit UI when interacted with

3. **Mines** (`mine`) - Store `stone`, `ironore`, `silverore`, `goldore`, `diamond`
   - Players deposit ores from inventory
   - Opens deposit UI with all ore types

#### Deposit UI

When player interacts with storage building:
```javascript
socket.write(JSON.stringify({
  msg: 'openDeposit',
  buildingType: 'mill' | 'lumbermill' | 'mine',
  buildingId: number,
  buildingOwner: playerId,
  resources: {
    grain: player.inventory.grain || 0,  // Or wood, ores, etc.
    // ...
  }
}));
```

#### Building Stores Property

Buildings store resources in `building.stores`:
```javascript
building.stores = {
  grain: 0,
  wood: 0,
  stone: 0,
  ironore: 0,
  // ... etc
}
```

Resources in `stores` are separate from player inventory and persist in the building.

---

## Dropping System

### Manual Dropping

#### Via Command

**File**: [`server/js/commands/commands/DropCommand.js`](server/js/commands/commands/DropCommand.js)

Use `/drop [quantity] [item]`:
- `/drop 5 wood` - Drop 5 wood
- `/drop 1 dague` - Drop 1 dague
- `/drop key [number]` - Drop specific key from keyRing

#### Via UI

**File**: [`client/js/ui/InventoryHandler.js`](client/js/ui/InventoryHandler.js) lines 253-273

Right-click item in inventory → "Drop" option:
- If quantity > 1: Opens quantity modal
- If quantity = 1: Drops immediately

#### Server Handler

**File**: [`lambic.js`](lambic.js) lines 8150-8181

Client sends `dropItem` message:
```javascript
{
  msg: 'dropItem',
  itemType: string,
  quantity: number
}
```

Server process:
1. Validates player has item in inventory
2. Validates quantity (not more than player has)
3. Removes from inventory: `player.inventory[itemType] -= quantity`
4. Creates item in world using `itemFactory.createItem()`:
   ```javascript
   const droppedItem = itemFactory.createItem(itemType, {
     x: player.x,
     y: player.y,
     z: player.z,
     qty: quantity
   });
   ```
5. Sends confirmation message to player

### Death Drops

When an entity dies, all inventory and stores are dropped:

**File**: [`server/js/Entity.js`](server/js/Entity.js) lines 2205-2247, [`lambic.js`](lambic.js) lines 2721-2770

#### Drop Process

1. **Collect inventory items**:
   ```javascript
   for(var item in self.inventory){
     if(item === 'keyRing' || item === 'mapData') continue;  // Skip special properties
     var qty = self.inventory[item];
     if(qty > 0){
       droppedItems.push({item: item, qty: qty});
       self.inventory[item] = 0;
     }
   }
   ```

2. **Collect store resources**:
   ```javascript
   if(self.stores){
     for(var resource in self.stores){
       var qty = self.stores[resource];
       if(qty > 0){
         droppedItems.push({item: resource, qty: qty});
         self.stores[resource] = 0;
       }
     }
   }
   ```

3. **Scatter items around death location**:
   ```javascript
   var deathCoords = getCenter(deathLocation[0], deathLocation[1]);
   for(var i in droppedItems){
     var drop = droppedItems[i];
     var offsetX = (Math.random() - 0.5) * tileSize * 2;  // Random within 2 tiles
     var offsetY = (Math.random() - 0.5) * tileSize * 2;
     
     global.itemFactory.createItem(drop.item, {
       x: deathCoords[0] + offsetX,
       y: deathCoords[1] + offsetY,
       z: deathZ,
       qty: drop.qty,
       innaWoods: self.innaWoods || false
     });
   }
   ```

#### Special Handling

- `keyRing` and `mapData` are **not dropped** (persist after death)
- Items are scattered randomly within 2 tiles of death location
- Items retain `innaWoods` flag for rendering
- Death drops are logged via event system

---

## Looting System

### Player Pickup

Players can pick up items by walking near them:

**File**: [`server/js/entities/BaseItem.js`](server/js/entities/BaseItem.js) lines 48-98

#### Pickup Logic

1. **Stack limit check**:
   ```javascript
   const currentAmount = player.inventory[this.type] || 0;
   if (currentAmount >= this.maxStack) {
     // Show error: "You are already carrying too much [item]"
     return;
   }
   ```

2. **Calculate transfer quantity**:
   ```javascript
   const canTake = Math.min(this.qty, this.maxStack - currentAmount);
   const remaining = this.qty - canTake;
   ```

3. **Update inventory**:
   ```javascript
   player.inventory[this.type] = currentAmount + canTake;
   ```

4. **Blockchain integration** (for gold):
   ```javascript
   if (this.type === 'gold' && player.wallet && global.GoldTradeManager) {
     global.GoldTradeManager.createMiningTransaction(player, canTake);
   }
   ```

5. **Update item**:
   ```javascript
   this.qty = remaining;
   this.toUpdate = true;
   if (remaining <= 0) {
     this.toRemove = true;  // Remove item from world
   }
   ```

6. **Send feedback**:
   ```javascript
   socket.write(JSON.stringify({
     msg: 'addToChat',
     message: `<i>You picked up</i> ${canTake} <b>${this.getDisplayName()}</b>.`
   }));
   ```

7. **Event logging**:
   ```javascript
   if(global.eventManager){
     global.eventManager.itemPickedUp(this, player, { x: this.x, y: this.y, z: this.z });
   }
   ```

### NPC Looting

NPCs automatically loot items based on their type:

**File**: [`server/js/Entity.js`](server/js/Entity.js) lines 3861-3913

#### Loot Check

NPCs check for nearby items every 3 seconds (180 frames):

```javascript
self.checkLoot = function() {
  if(self.action === 'combat') return;  // Don't loot during combat
  
  const lootRadius = 128;  // 2 tiles
  
  for(const itemId in Item.list) {
    const item = Item.list[itemId];
    if(!item || item.z !== self.z) continue;
    
    const dist = getDistance({x: self.x, y: self.y}, {x: item.x, y: item.y});
    if(dist < lootRadius) {
      if(self.canLoot && self.canLoot(item)) {
        if(!self.hasNearbyHumanoids || !self.hasNearbyHumanoids(64)) {
          if(item.pickup) {
            item.pickup(self.id);
            break;  // One item per check
          }
        }
      }
    }
  }
};
```

#### Loot Preferences by NPC Type

**Wolves** (`class === 'Wolf'`):
- Loot and consume: `venison`, `boarmeat`, `lamb`, `fish`, `venisonloin`, `boarshank`, `lambchop`, `poachedfish`

**Military Units** (`self.military`):
- Loot everything: weapons, armor, resources

**Serfs** (`class === 'Serf' || 'SerfM' || 'SerfF'`):
- Loot work-related items: `grain`, `wood`, `stone`, `ironore`, `bread`

**Other Humanoid NPCs**:
- Loot basic supplies: `bread`, `grain`, `wood`
- Excludes: `Deer`, `Boar`, `Falcon`

**Source**: [`server/js/Entity.js`](server/js/Entity.js) lines 3891-3913

### Underwater Item Discovery

Items that sink into water (z=-3) can be discovered while fishing:

**File**: [`server/js/Entity.js`](server/js/Entity.js) lines 6705-6720

```javascript
function getUnderwaterItemsNear(x, y, radiusTiles) {
  var items = [];
  var radiusPx = radiusTiles * tileSize;
  
  for(var id in Item.list) {
    var item = Item.list[id];
    if(item.z === -3) {  // Underwater layer
      var dist = getDistance({x: x, y: y}, {x: item.x, y: item.y});
      if(dist <= radiusPx) {
        items.push(item);
      }
    }
  }
  
  return items;
}
```

---

## Item Pickup

### Pickup Function

The `pickup` method is attached to all items during creation:

**File**: [`server/js/entities/ItemFactory.js`](server/js/entities/ItemFactory.js) lines 149-185

#### Stack Limit Enforcement

```javascript
const currentAmount = player.inventory[type] || 0;
const maxStack = config.maxStack;

if (currentAmount >= maxStack) {
  socket.write(JSON.stringify({
    msg: 'addToChat',
    message: `<i>You are already carrying too much</i> <b>${type}</b>.`
  }));
  return;
}
```

#### Partial Pickup

If player has space but not enough for all items:
```javascript
const canTake = Math.min(item.qty, maxStack - currentAmount);
const remaining = item.qty - canTake;

player.inventory[type] = currentAmount + canTake;
item.qty = remaining;

if (remaining <= 0) {
  item.toRemove = true;  // Item fully picked up, remove from world
}
```

### Item Removal

When `toRemove` is set to `true`, the item is removed from the world during the update loop:

**File**: [`server/js/Entity.js`](server/js/Entity.js) lines 10829-10901

```javascript
Item.update = function(){
  // ... item processing ...
  
  if(item.toRemove){
    delete Item.list[i];
    removePack.item.push(item.id);  // Notify clients to remove
  }
}
```

---

## Code Architecture

### Item Registry

All items are stored in a global registry:

```javascript
Item.list = {};  // Key: item.id, Value: item object
global.Item = Item;
```

**Source**: [`server/js/Entity.js`](server/js/Entity.js) lines 10826-10827

### Item Update Loop

Items are updated each game tick:

**File**: [`server/js/Entity.js`](server/js/Entity.js) lines 10829-10901

#### Update Process

1. **Consumable Despawning**: Food items despawn after 10 minutes (if `despawnAfter` is set)
2. **Terrain Sinking**:
   - Water items sink after 10 seconds to z=-3
   - Land items sink after 7 days (2520 ticks) or 100 days for skeletons (36000 ticks)
   - Items indoors (z=1, z=2, z=-2) never sink
   - Unique items (relic, crown) never sink
3. **Update Pack Generation**: Items with `toUpdate` flag generate update packets
4. **Removal**: Items with `toRemove` flag are deleted and added to removal pack

#### Update Packet Format

```javascript
{
  id: number,
  x: number,
  y: number,
  z: number,
  innaWoods: boolean
}
```

#### Init Packet Format

```javascript
{
  id: number,
  parent: any,
  type: string,
  x: number,
  y: number,
  z: number,
  qty: number,
  innaWoods: boolean
}
```

### Client-Server Synchronization

#### Initial Load

When client connects, server sends all items via `initPack`:
```javascript
if (global.initPack && global.initPack.item) {
  global.initPack.item.push(item.getInitPack());
}
```

**Source**: [`server/js/entities/BaseItem.js`](server/js/entities/BaseItem.js) lines 43-45

#### Updates

Each tick, server sends:
- **Update pack**: Items that changed position/state
- **Remove pack**: Items that were removed

**Source**: [`server/js/Entity.js`](server/js/Entity.js) lines 10882-10900

### Client-Side Rendering

#### Item Renderer

**File**: [`client/js/rendering/ItemRenderer.js`](client/js/rendering/ItemRenderer.js)

The `ItemRenderer` class handles visual representation of items on the map:
- Maps item types to sprite images
- Handles quantity-based sprite changes (wood1, wood2, wood3, etc.)
- Manages animated items (torches, fires)
- Handles special rendering (underwater items, etc.)

#### Inventory UI

**Files**: 
- [`client/js/ui/InventoryUI.js`](client/js/ui/InventoryUI.js) - Display system
- [`client/js/ui/InventoryHandler.js`](client/js/ui/InventoryHandler.js) - Interaction handlers

The inventory UI:
- Displays all items with quantities
- Shows rarity colors based on rank
- Handles left-click (use/equip) and right-click (context menu)
- Updates in real-time from server `gearUpdate` messages

#### Rarity Display

**File**: [`client/js/utils/ItemRarityHelper.js`](client/js/utils/ItemRarityHelper.js)

The `ItemRarityHelper` provides:
- Rank lookup for item types
- Rarity color mapping (matches server)
- Border color mapping (matches server)
- Rarity name strings

---

## Summary

The item system in Lambic is a comprehensive system that handles:

1. **60+ item types** across 9 categories with rarity rankings
2. **Flexible stacking** with per-item stack limits
3. **Equipment system** with 5 slots, requirements, and stat bonuses
4. **Storage systems** for chests and building resources
5. **Dropping mechanics** for manual drops and death drops
6. **NPC looting** with type-specific preferences
7. **Real-time synchronization** between server and clients

All systems work together to provide a complete item management experience that integrates seamlessly with combat, crafting, building, and trading systems.

