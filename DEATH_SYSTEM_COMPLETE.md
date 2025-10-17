# Enhanced Death & Ghost System - Complete Guide

**Status**: ✅ FULLY IMPLEMENTED  
**Date**: October 17, 2025  
**Focus**: Immersive Death Mechanics with Ghost Mode

---

## Death Sequence

### **When a Player Dies:**

**1. Skeleton Spawns** 💀
- Random skeleton variation (0 or 1)
- Spawns at exact death location
- Non-blocking, permanent decoration
- Marks the site of death

**2. Items Scatter** 💎
- All inventory items drop
- All store resources drop (grain, wood, ores, silver, etc.)
- Items scatter randomly within 2 tiles of skeleton
- Each item type becomes a `DroppedItem` entity
- Console logs all dropped items

**3. Ghost Mode Activates** 👻
- Player becomes a ghost (sprite changes to ghost)
- HP set to 1 (can't die again)
- Combat state cleared
- 5-second timer begins countdown

**Console Output:**
```
💀 Skeleton spawned at [125,89] z=0
💀 PlayerName dropped 5 item types at [125,89] z=0
  - 50 grain
  - 30 wood
  - 15 ironore
  - 1 longsword
  - 200 silver
👻 PlayerName entered ghost mode at [125,89] z=0
```

---

## Ghost Mode Features

### **Visual Effects** (Client-Side)
- Ghost sprite displayed
- Fades in and out (pulsing effect)
- Semi-transparent appearance

### **Movement**
- **Terrain-ignoring**: Can move through trees, rocks, walls
- **Z-level access**: Can still use cave entrances/exits and building doors
- **Speed**: Normal movement speed
- **No underwater**: Cannot go underwater (z=-3)

### **Invisibility**
- **NPCs cannot see ghosts**: No aggro detection
- **No combat**: Cannot attack or be attacked
- **Full map access**: Can explore freely

### **Timer Countdown**
```
👻 Respawning in 5 seconds...
👻 Respawning in 4 seconds...
👻 Respawning in 3 seconds...
👻 Respawning in 2 seconds...
👻 Respawning in 1 second...
✨ You have respawned!
```

### **Chat Messages**
```
☠️ YOU DIED
Killed by: Cutthroat
Your items have been dropped at the death location

👻 You are now a ghost. Move to where you want to respawn.
Auto-respawn in 5 seconds, or type /respawn to respawn at home
```

---

## Respawn Options

### **Option 1: Wait for Auto-Respawn** ⏰
- Timer runs for 5 seconds
- Move ghost to desired respawn location
- When timer expires, respawn at current ghost location
- Useful for choosing a strategic spawn point

### **Option 2: Manual Respawn at Home** 🏠
```
/respawn
```
- Immediately respawn at your home location
- Requires home to be set
- If no home: respawns at random spawn point

**Chat:**
```
✨ Respawned at home
```

or

```
✨ Respawned at random location (no home set)
```

---

## Home Location System

### **Auto-Home Setting**
When you build certain buildings, your home is automatically set (if not already set):

**Home-Eligible Buildings:**
- Hut (all variations: normal, goth, frank, celt, teuton)
- Cottage
- Villa
- Tavern
- Tower
- Stronghold

**Chat Message:**
```
🏠 Home set to your new hut
```

### **Manual Home Setting**
```
/sethome
```

**Requirements:**
- Must be inside a building (z=1 or z=2)
- Must own the building
- Overrides auto-set home

**Chat:**
```
✅ Home set to tavern at [45,67]
```

**Errors:**
- `❌ You do not own this building`
- `❌ Not inside a building`
- `❌ You must be inside a building to set home`

---

## Item Recovery

### **Dropped Item System**

**DroppedItem Entity** (`Entity.js` lines 10358-10392):
- Each item type becomes a separate DroppedItem
- Stores: item name, quantity, type (inventory/stores)
- Scattered randomly within 2-tile radius
- Can be picked up by any player
- Visible at same z-level as death

**Recovery Process:**
1. Return to death location (look for skeleton)
2. Pick up scattered items (spacebar)
3. Items go back into inventory/stores

---

## NPC vs Player Death

### **Players** 👤
- Enter ghost mode
- 5-second timer
- Can choose respawn location
- Items drop and scatter
- Skeleton spawns

### **NPCs** 🤖
- Immediate respawn at random location
- No ghost mode
- Items still drop and scatter
- Skeleton still spawns

---

## Implementation Details

### **Files Modified:**

**1. lambic.js**
- `self.die()` - Enhanced death handler (lines 1427-1562)
- `self.respawnFromGhost()` - Ghost respawn handler (lines 1564-1596)
- Ghost timer countdown in `Player.update()` (lines 2780-2797)
- Ghost collision bypass (lines 1750-1754)
- Ghost aggro immunity in `checkAggro()` (line 1600)

**2. Entity.js**
- `Skeleton` entity (lines 10325-10356)
- `DroppedItem` entity (lines 10358-10392)

**3. Build.js**
- Auto-home setting on building completion (lines 41-55)

**4. Commands.js**
- `/respawn` command (lines 14150-14165)
- `/sethome` command (lines 14168-14188)

### **Technical Details:**

**Ghost Timer:**
- 300 frames = 5 seconds at 60fps
- Countdown messages every 60 frames (1 second)
- Auto-respawn when timer reaches 0

**Item Scattering:**
- Random offset: `±1 tile` from death location
- Uses `(Math.random() - 0.5) * tileSize * 2`
- Each item type gets its own DroppedItem entity

**Home Location Format:**
```javascript
player.home = {
  z: 1,              // Building first floor
  loc: [45, 67]      // Tile coordinates
}
```

---

## Gameplay Examples

### **Example 1: PvP Death**
```
[You're fighting an enemy]
⚔️ Enemy hits you for 50 dmg (HP: 0/100)

☠️ YOU DIED
Killed by: Cutthroat
Your items have been dropped at the death location

👻 You are now a ghost. Move to where you want to respawn.
Auto-respawn in 5 seconds, or type /respawn to respawn at home

[Move ghost to desired location]
👻 Respawning in 4 seconds...
👻 Respawning in 3 seconds...

[Or type /respawn]
✨ Respawned at home
```

### **Example 2: Environmental Death**
```
[You're drowning underwater]

☠️ YOU DIED
Cause: drowned
Your items have been dropped at the death location

👻 You are now a ghost. Move to where you want to respawn.
Auto-respawn in 5 seconds, or type /respawn to respawn at home

[Wait for timer]
👻 Respawning in 1 second...
✨ You have respawned!
```

### **Example 3: Building First Home**
```
[Building your hut]
🏗️ Construction complete

🏠 Home set to your new hut

[Later, you die]
/respawn
✨ Respawned at home
```

### **Example 4: Manual Home Setting**
```
[Inside your tavern, z=1]
/sethome
✅ Home set to tavern at [45,67]

[Later, die far away]
/respawn
✨ Respawned at home
```

---

## Strategic Implications

**Death Penalties:**
- **Item loss**: Valuable resources and equipment drop
- **Recovery risk**: Death location may be dangerous
- **Time loss**: 5-second ghost timer
- **Strategic vulnerability**: Enemies can loot your corpse

**Benefits:**
- **Ghost scouting**: Use ghost mode to scout enemy positions
- **Strategic respawn**: Choose spawn location during ghost timer
- **Home advantage**: Quick respawn at home with `/respawn`
- **Full looting**: All items remain in game economy

---

**All code compiles successfully!** ✅

The death system now creates dramatic, high-stakes moments with meaningful consequences and strategic choices! ☠️👻✨


