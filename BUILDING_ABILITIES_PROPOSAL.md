# Building Special Abilities - Design Proposal (REVISED)

**Status**: AWAITING USER APPROVAL ON PRIORITIES  
**Updated**: Per user feedback on market, forge, garrison, and other systems

---

## Design Principles

1. **Use Existing Systems**: Leverage proven patterns (Garrison update loop, Interact.js)
2. **Automated Production**: Forges auto-convert ore, stables regenerate horses, garrisons produce troops
3. **NPC Integration**: Markets auto-populated by NPCs selling excess resources
4. **Military Focus**: Buildings support military buildup (forge → iron → troops, garrison → soldiers)

---

## REVISED BUILDING DESIGNS

### 1. Monastery - Passive Healing Aura ✅ APPROVED

**Ability: Gradual Health Regeneration**
- **Type**: Passive
- **Effect**: +1 HP every 3 seconds for allied units/players inside (z=1)
- **Cost**: Free
- **Implementation**: Add update() method, check occupancy, verify alliance, heal gradually

**Status**: Design approved by user

---

### 2. Market - Trading System

**System Requirements:**
- **Orderbook**: Players can list items for sale with custom prices
- **Browse**: Players can lookup/search available items
- **NPC Sellers**: NPCs automatically sell excess resources at end of day
- **Auto-Stocking**: Keeps market populated with buyable items

**Player Interactions:**
- `/market list` - Show all items for sale
- `/market list [resource]` - Show specific resource listings
- `/market sell [resource] [amount] [price]` - List item for sale
- `/market buy [orderID]` - Purchase item from orderbook
- Spacebar in market - Show quick menu of top items

**NPC Integration:**
- At VII.p (end of work), Houses check for excess resources
- If stores exceed threshold, create sell order at market
- Default NPC prices: wood=2g, stone=3g, grain=1g, iron=5g

**Implementation:**
- Extend existing `self.orderbook` in Market
- Add order structure: {id, seller, resource, amount, price, timestamp}
- Add Commands.js handlers for market commands
- Add NPC sell logic to dayNight() at VII.p
- Implement currency (gold) system if not present

**Complexity**: High  
**Priority**: Medium (foundational economic system)

---

### 3. Forge - Ore Conversion & Crafting

**Passive Ability: Auto-Convert Iron Ore**
- **Type**: Passive (automated production)
- **Effect**: Converts iron ore → iron bars for building owner
- **Rate**: 1 iron ore → 1 iron bar every 30 seconds per forge
- **Scaling**: Multiple forges = faster conversion
- **Resource Change**: Replace "ironore" with "iron" as primary resource
- **Purpose**: Critical for military buildup (iron → weapons → troops)

**Active Ability: Player Crafting**
- **Type**: Interactive (spacebar menu)
- **Recipes**:
  - Iron Ore → Iron Bar (1:1, instant)
  - Iron Bar + Wood → Iron Sword (2 iron + 1 wood)
  - Iron Bar → Iron Armor (3 iron)
  - Iron Bar → Steel Bar (2 iron → 1 steel, requires coal/charcoal)
  - Steel Bar + Wood → Steel Sword (1 steel + 1 wood)
- **Activation**: Spacebar inside forge, shows crafting menu
- **Cost**: Resources deducted from player inventory
- **Output**: Item added to player inventory or gear

**Implementation:**
- Add `update()` method to Forge for passive ore conversion
- Track conversion timer per forge
- Deduct iron ore, add iron to owner's stores
- Add crafting menu to Interact.js
- Create recipe validation system
- Integrate with Equip.js for gear creation
- **Global Resource Change**: Rename all "ironore" references to "iron"

**Complexity**: High (passive conversion: Medium, crafting system: High)  
**Priority**: High (critical for military progression)

---

### 4. Garrison - Automated Military Production

**Passive Ability: Auto-Produce Guards/Soldiers**
- **Type**: Passive (automated, replaces queue system)
- **Effect**: Automatically creates military units based on House needs
- **Production Logic**:
  - Check House military count vs desired garrison size
  - If understaffed, produce units (footsoldier → skirmisher → cavalier priority)
  - Stop when garrison size reached or resources depleted
- **Resource Costs**:
  - Footsoldier: 20 grain + 10 wood
  - Skirmisher: 20 grain + 15 wood + 5 iron
  - Cavalier: 30 grain + 20 wood + 10 iron (requires stable)
- **Production Rate**: 1 unit per 5 minutes
- **Garrison Size**: Scales with House territory (1 unit per work building owned)

**Existing Feature: House Creation**
- Keep existing ability for players to create Houses/factions
- Garrison manages House's military automatically once created

**Implementation:**
- Modify existing Garrison.update() method
- Remove manual queue, make fully automated
- Check House.list[owner].stores for resources
- Calculate desired garrison size from House buildings
- Spawn units with House affiliation
- Set patrol routes around garrison

**Complexity**: High (automated logic, resource management, scaling)  
**Priority**: High (core military system)

---

### 5. Stable - Mount System

**Passive Ability: Enable Mounted Units**
- **Type**: Passive (unlocks cavalier production)
- **Effect**: Garrisons can produce cavalier units if stable exists nearby
- **Requirement**: Stable within 20 tiles of garrison

**Active Ability: Rent Mount**
- **Type**: Interactive (spacebar)
- **Effect**: Player gains +50% movement speed for 10 minutes
- **Cost**: 5 grain (paid to stable owner)
- **Limit**: 5 horses available, regenerate 1 horse per hour (based on grain availability)
- **Dismount**: Automatic after 10 min or player command `/dismount`
- **Chat**: "You rent a horse. +50% speed for 10 minutes"

**Horse Regeneration Logic:**
- Every hour, check stable owner's grain stores
- If grain >= 10, regenerate 1 horse (up to 5 max)
- Deduct 10 grain per horse regenerated

**Implementation:**
- Track `self.horses` (already exists)
- Add `lastRegenTime` for horse regeneration
- Add player.mounted flag and speed modifier
- Check stable.horses before allowing rental
- Garrison checks for nearby stable before producing cavaliers

**Complexity**: Medium  
**Priority**: Medium (enhances both player and NPC gameplay)

---

### 6. Outpost - Sentry Alert & Auto-Response

**Ability: Enemy Detection & Alert**
- **Type**: Passive
- **Effect**: Detects enemies within 12 tiles, alerts owner, triggers guard response
- **Detection Frequency**: Every 2 seconds (120 frames)
- **Alert**: "⚠️ ALERT: [Enemy type] detected near your outpost at [X,Y]"
- **Auto-Response**: Nearby guards/soldiers auto-path to threat location

**Guard Response Logic:**
- Find all friendly military units within 20 tiles of outpost
- Set their action to 'defend' with threat location as target
- Guards path to threat and engage if enemy still present
- Guards return to patrol after threat eliminated

**Implementation:**
- Add `update()` method to Outpost
- Use spatial system to find enemies in 12-tile radius
- Track `alertedEnemies` to prevent spam (clear after 30 sec)
- Send socket message to owner
- Scan for friendly military units and command them
- Add 'defend' action to military unit AI

**Complexity**: Medium  
**Priority**: HIGH - User requested ASAP implementation

---

### 7. Guardtower - Automated Arrow Defense

**Ability: Auto-Attack Enemies**
- **Type**: Passive
- **Effect**: Shoots arrows at enemies within 8 tiles (512px)
- **Damage**: 10 per arrow
- **Attack Rate**: 1 arrow per 2 seconds
- **Ammo**: Automated production (see below)

**Arrow Production System:**
- Guardtower passively produces arrows over time
- Rate: 1 arrow per 10 seconds
- Max Storage: 100 arrows per tower
- Resource Cost: 1 wood per 10 arrows produced (deducted from owner)
- If owner has no wood, production stops

**Implementation:**
- Add `update()` method to Guardtower
- Track `self.arrows` (current ammo) and `self.arrowTimer`
- Produce arrows: deduct wood, increment arrows
- Attack logic: scan for enemies, shoot if ammo available
- Create Arrow entity with guardtower as parent
- Cooldown between shots

**Complexity**: Medium  
**Priority**: High (automated defense is important)

---

### 8. Stronghold - Garrison Storage & Defense

**Ability 1: Garrison Units**
- **Type**: Interactive (command-based)
- **Effect**: Store military units inside stronghold for later deployment
- **Capacity**: 20 units (larger than garrison's 10)
- **Commands**:
  - `/garrison` - Store current unit inside
  - `/garrison list` - Show garrisoned units
  - `/garrison deploy [type]` - Deploy stored unit
- **Chat**: "Unit garrisoned. [X/20 capacity]"

**Ability 2: Arrow Defense (Like Guardtower)**
- **Type**: Passive
- **Range**: 16 tiles (double guardtower range)
- **Damage**: 15 per arrow
- **Ammo**: Same automated production as guardtower

**Implementation:**
- Add `garrisonedUnits` array to Stronghold
- Add `update()` method for arrow defense
- Store unit data (serialize stats, gear, position)
- Restore units on deploy command
- Use guardtower arrow production pattern

**Complexity**: High (unit storage), Medium (arrow defense)  
**Priority**: Medium (nice-to-have, not critical)

---

### 9. Tavern - Rest & Provisions

**Passive Ability: Health Restoration**
- **Type**: Passive (like monastery)
- **Effect**: +1 HP every 2 seconds for players inside tavern (faster than monastery)
- **Cost**: Free
- **Range**: Inside tavern only (z=1, z=2)

**Active Ability: Buy Food/Alcohol**
- **Type**: Interactive (spacebar or command)
- **Requires**: Innkeeper alive and inside/near tavern
- **Items Available**:
  - Bread (5 grain) - Restores 25 HP instantly
  - Ale (3 grain) - Restores 10 HP, +1 strength for 5 min
  - Wine (5 grain) - Restores 15 HP, +1 dexterity for 5 min
- **Commands**: `/buy bread`, `/buy ale`, `/buy wine`
- **Chat**: "You purchase [item] from the innkeeper"

**Innkeeper Leashing System:**
- Innkeepers have `home` location at tavern
- If distance from tavern > 10 tiles (640px), return home
- Check every 5 seconds
- Path back to tavern entrance
- Prevents innkeepers from wandering away

**Implementation:**
- Add update() to Tavern for passive healing
- Add innkeeper check to Interact.js
- Extend Commands.js with buy commands
- Add leash check to Innkeeper update in Entity.js
- Create consumable item effects (HP restore, stat buffs)

**Complexity**: Medium (healing: Low, provisions: Medium, leashing: Low)  
**Priority**: Medium

---

## CRITICAL SYSTEM CHANGES

### Resource System Overhaul: Iron Ore → Iron

**Current**: Serfs mine "iron ore" which sits unused  
**New**: Iron ore is automatically converted to usable "iron" by forges

**Changes Required:**
1. Keep "ironore" as intermediate (mined resource)
2. Add "iron" as usable resource (converted by forges)
3. Forges passively convert: ironore → iron
4. Military units require "iron" not "ironore"
5. Daily reports show both ironore (mined) and iron (available)

**Impact**: Medium (rename/add resource tracking throughout codebase)

---

### Arrow Production System

**Guardtowers and Strongholds need automated arrow production**

**System Design:**
- Each defensive building produces arrows over time
- Cost: 1 wood per 10 arrows
- Storage: 100 arrows max per building
- Rate: 1 arrow per 10 seconds
- Deduct from owner's wood stores

**Alternative - Simpler**:
- Unlimited arrows, no ammo system
- Just cooldown between shots

**Recommendation**: Start with unlimited arrows, add production later if needed

---

### NPC Market Selling

**End-of-Day Resource Sale:**
- At VII.p, before resource report
- For each House, check if stores exceed thresholds:
  - Grain > 100: Sell 50 grain at market for 1g each
  - Wood > 100: Sell 50 wood at market for 2g each
  - Stone > 50: Sell 25 stone at market for 3g each
  - Iron > 30: Sell 10 iron at market for 5g each
- Create sell orders in nearest market's orderbook
- Adds economic flow, keeps markets stocked

**Implementation:**
- Add to dayNight() function at VII.p
- Find nearest market for each House
- Create sell orders with NPC as seller
- Add gold to House stores when items purchased

---

## Implementation Roadmap (Proposed)

### Phase 1: Critical Systems (Week 1)
**Priority: ASAP per user request**
1. **Outpost Sentry Alerts** - Enemy detection + guard auto-response
2. **Innkeeper Leashing** - Keep innkeepers at taverns
3. **Monastery Healing** - Passive HP restoration

**Why First**: Simple, high-impact, no complex dependencies

---

### Phase 2: Resource Automation (Week 2)
**Priority: High - Foundation for military**
4. **Forge Iron Conversion** - Passive ironore → iron
5. **Guardtower Defense** - Automated arrows (unlimited to start)
6. **Tavern Healing** - Passive HP restoration

**Why Next**: Enables military progression, sets up automation patterns

---

### Phase 3: Military Production (Week 2-3)
**Priority: High - Core military system**
7. **Garrison Auto-Production** - Automated soldier creation
8. **Stable Mount System** - Passive: enable cavalry, Active: player mounts
9. **Stronghold Defense** - Arrow defense + unit storage

**Why Third**: Depends on forge iron system, complex logic

---

### Phase 4: Economic Systems (Week 3-4)
**Priority: Medium - Long-term depth**
10. **Market Trading** - Full orderbook, NPC sellers, player trading
11. **Tavern Provisions** - Food/alcohol purchases from innkeeper
12. **Forge Crafting** - Player weapon/armor creation

**Why Last**: Complex, requires currency system, can be refined iteratively

---

## Questions for User (Please Prioritize)

1. **Should I start with Phase 1 (Outpost, Monastery, Innkeeper)?** This gets quick wins done first.

2. **Arrow System**: Start with unlimited arrows (simple) or implement production from day 1?
   - a) Unlimited arrows (implement now, add production later)
   - b) Full arrow production system from start

3. **Currency (Gold)**: Required for market/tavern. Should I:
   - a) Implement simple gold system (Houses/Players have gold stores)
   - b) Use grain as currency for now (simpler, no new system)
   - c) Full currency with gold mining, treasures, etc.

4. **Garrison Production Logic**: When should garrisons stop producing units?
   - a) When garrison size = 1 unit per work building owned
   - b) When garrison size = fixed number (e.g., 10 units)
   - c) Never stop, keep producing until resources run out

5. **Iron Ore → Iron Conversion**: Should this happen immediately, or wait until forge automation is implemented?
   - a) Do it now (simple resource rename)
   - b) Keep ironore for now, add iron as separate resource with forge conversion

**Please provide answers so I can proceed with implementation in the correct order.**

