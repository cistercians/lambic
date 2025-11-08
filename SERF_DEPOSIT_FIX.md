# Serf Resource Deposit Fix

## Problem
Serfs were depositing resources but they weren't showing up in faction stores or reports. Only player deposits were being counted.

## Root Cause
**CRITICAL BUG**: Serf deposit logic was checking `House.list[b.owner]` instead of `House.list[b.house]`.

### The Difference
- **`building.owner`**: The player ID who built the building
- **`building.house`**: The faction/house ID the building belongs to

When a player builds a mill for their faction:
- `building.owner = playerID` (e.g., "abc123")
- `building.house = factionID` (e.g., "franks_faction_id")

The old code tried:
```javascript
if(House.list[b.owner]){  // b.owner = "abc123" (player ID)
  House.list[b.owner].stores.grain += buildingShare;  // FAILS - "abc123" is not a House
}
```

This check **always failed** because player IDs aren't in `House.list`, so deposits fell through to the fallback logic which might not work correctly.

## Solution Applied

Changed **all serf deposit logic** to check `b.house` first:

```javascript
if(b.house && House.list[b.house]){
  House.list[b.house].stores.grain += buildingShare;  // SUCCESS
  console.log('✅ Serf deposited X grain to FactionName');
}
```

## Files Modified

**File**: `server/js/Entity.js`

Fixed deposits for all resources:

1. **Grain** (lines 5744-5757)
2. **Wood** (lines 5943-5954)
3. **Iron Ore** (lines 6054-6065)
4. **Stone** (lines 6344-6355)
5. **Silver Ore** (lines 6089-6100)
6. **Gold Ore** (lines 6124-6135)
7. **Diamonds** (lines 6159-6170)

Each now uses:
- **Primary**: `b.house && House.list[b.house]` ✅
- **Fallback 1**: Owner's house (if owner is a player in a house)
- **Fallback 2**: Independent player stores

## Expected Behavior

✅ Serf deposits now go to the correct faction  
✅ Scoreboard shows accurate faction resource totals  
✅ Daily reports show serf contributions  
✅ Console logs confirm deposits: `"✅ Serf deposited 17 grain to Franks"`

## Verification

Watch the console logs - you should now see:
```
✅ Lysa deposited 17 grain to Franks
✅ Marcus deposited 8 wood to Goths
✅ Erik deposited 12 iron ore to Teutons
```

Resources will accumulate in faction stores and appear on:
- Tab scoreboard
- Daily resource reports
- House stores






