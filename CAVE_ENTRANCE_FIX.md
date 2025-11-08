# Cave Entrance/Exit Loop Fix

## Problem
Serfs, especially ore miners, were getting stuck in infinite loops at cave entrances - continuously entering and exiting without doing any work.

## Root Cause
Serfs had **no cooldown** preventing immediate re-entry after exiting a cave. The workflow was:

1. Serf exits cave with ore → Sets `transitionIntent = 'exit_cave'`
2. Exits to z=0 via `exitCave()`
3. Deposits ore at mine building
4. Immediately sets `transitionIntent = 'enter_cave'` to get more ore
5. **Instantly re-enters cave** (no delay)
6. If work logic triggers another exit (e.g., full inventory), serf exits again
7. **Loop continues indefinitely**

## Solution Implemented

### 1. Added `mineExitCooldown` Property
**File**: `server/js/Entity.js` line 5095

All serfs now have a cooldown counter:
```javascript
self.mineExitCooldown = 0; // Prevent immediate re-entry after exiting cave (~2 seconds)
```

### 2. Cooldown Decrement (Character.update)
**File**: `server/js/Entity.js` lines 3027-3030

Cooldown decrements every frame for all entities that have it:
```javascript
// Decrement mine exit cooldown for serfs
if(self.mineExitCooldown && self.mineExitCooldown > 0){
  self.mineExitCooldown--;
}
```

### 3. Cooldown Decrement (Serf.update)
**File**: `server/js/Entity.js` lines 5292-5295

Also decrements in Serf-specific update:
```javascript
// Decrement mine exit cooldown
if(self.mineExitCooldown > 0){
  self.mineExitCooldown--;
}
```

### 4. Set Cooldown on Exit
**File**: `server/js/Entity.js` lines 3933-3936

When a serf exits a cave, set 2-second cooldown:
```javascript
// Set cooldown for serfs to prevent immediate re-entry
if(self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF'){
  self.mineExitCooldown = 120; // 2 seconds at 60fps
}
```

**Also set in Serf.update()** (lines 5408-5410) when using the alternative exit path.

### 5. Check Cooldown Before Entry (Direct Entry)
**File**: `server/js/Entity.js` lines 5319-5334

Serf-specific cave entrance handler checks cooldown:
```javascript
if((!self.path || self.path.length === 0) && self.mineExitCooldown === 0){
  // Enter cave
} else if(self.mineExitCooldown > 0){
  // Log waiting (diagnostic)
  console.log(self.name + ' waiting at cave entrance (cooldown: X frames)');
}
```

### 6. Check Cooldown Before Entry (TransitionIntent System)
**File**: `server/js/Entity.js` lines 3042-3050

Character.update() cave entrance handler also checks cooldown:
```javascript
const isSerfClass = (self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF');
const cooldownOK = !isSerfClass || (self.mineExitCooldown === 0);
if(self.transitionIntent === 'enter_cave' && self.isAtPathDestination() && cooldownOK){
  self.enterCave(loc);
} else if(self.transitionIntent === 'enter_cave' && !cooldownOK){
  // Clear intent to prevent stuck state
  self.transitionIntent = null;
}
```

## How It Works

**Normal Flow (No Loop)**:
1. Serf in cave, mines ore
2. Inventory full → exits cave
3. `exitCave()` called → `mineExitCooldown = 120`
4. Serf at cave entrance (z=0) for 120 frames (~2 seconds)
5. During cooldown: cannot enter cave, waits outside
6. After cooldown expires: can enter cave again for next load
7. **Result**: 2-second pause between trips, prevents loop

**Cooldown Timer**: 120 frames @ 60fps = 2 seconds
- Long enough to complete deposit action
- Short enough not to impact productivity
- Prevents rapid enter/exit cycles

## Diagnostic Logging

Added logging to monitor cooldown behavior:
```
Lysa waiting at cave entrance (cooldown: 98 frames)
Lysa waiting at cave entrance (cooldown: 38 frames)
```

This helps identify if serfs are properly waiting or if there are other pathfinding issues.

## Additional Benefits

- **Prevents re-entry loops** at all cave entrances, not just mines
- **No impact on players** - cooldown only applies to serfs
- **No impact on non-serf NPCs** - wolves, deer, etc. can still use caves normally
- **Backward compatible** - uses existing transitionIntent system

## Testing Verification

Monitor server logs for ore mining serfs:
- ✅ Should see "waiting at cave entrance" messages
- ✅ Should see 2-second gaps between cave entries
- ❌ Should NOT see rapid enter/exit cycles
- ❌ Should NOT see serfs stuck indefinitely

If loops persist, check:
1. Is cooldown being decremented? (verify logs)
2. Is cooldown being set on BOTH exit paths? (verify both Character and Serf updates)
3. Are there OTHER cave entry points we missed?






