# Event Manager System Breakdown

## System Overview

The Event Manager (`server/js/core/EventManager.js`) is a centralized event communication system that replaces ad-hoc console.log and chat message patterns. It handles event logging, communication, history tracking, and subscriptions.

## Core Architecture

### Event Structure

Every event contains:

- `id`: Random unique identifier
- `timestamp`: Date.now() when created
- `category`: One of 11 predefined categories
- `subject`: Entity ID performing the action
- `subjectName`: Display name of subject
- `action`: Description of what happened
- `target`: Entity ID being acted upon (optional)
- `targetName`: Display name of target (optional)
- `quantity`: Numeric value (damage, resources, etc.) (optional)
- `owner`: Entity ID who owns the subject (optional)
- `ownerName`: Display name of owner (optional)
- `house`: House ID (optional)
- `houseName`: House name (optional)
- `communication`: Communication mode(s) - single or array
- `message`: HTML formatted message for players (optional)
- `log`: Console log message (optional)
- `position`: {x, y, z} coordinates (optional)
- `metadata`: Additional event-specific data (optional)

### Event History

- Ring buffer with 1000 event capacity
- Events older than 10 minutes are considered stale
- Automatic cleanup every 5 minutes
- Batched logging (flushed every 100ms)

## Event Categories

### 1. ECONOMIC

**Purpose**: Resource gathering, trading, economic activities

**Helper Method**: `resourceGathered(gatherer, resourceType, quantity, position)`

**Direct Usage Locations**:
- `lambic.js:4043` - Wood gathering (50 wood)
- `lambic.js:4133` - Stone gathering (50 stone)
- `lambic.js:3833` - Fishing ship caught fish
- `lambic.js:3891` - Player caught fish
- `server/js/core/SimpleSerfBehavior.js:1084` - Serf deposited resources to building

**Event Details**:
- Subject: Entity gathering resources
- Action: "gathered [resourceType]" or "caught fish" or "deposited [resourceType]"
- Quantity: Amount gathered/deposited
- Communication: Usually NONE (logged only)
- Position: Location of gathering

### 2. BUILDING

**Purpose**: Building construction and completion

**Helper Method**: `buildingCompleted(building, owner, position)`

**Direct Usage Locations**:
- `server/js/Build.js:104` - Building construction finished

**Event Details**:
- Subject: Building entity
- Action: "completed"
- Owner: Player/NPC who owns the building
- House: House ID associated with building
- Communication: PLAYER (if owner exists) or SPECTATOR
- Message: "Your [building type] is complete!" or "[building type] completed!"
- Position: Building location

### 3. COMBAT

**Purpose**: Combat actions, attacks, escapes, miniboss upgrades

**Helper Methods**:
- `combatAttack(attacker, target, damage, position)`
- `combatEscape(escapee, enemy, position)`
- `minibossUpgrade(entity, killCount, newScale, position)`

**Direct Usage Locations**:
- `server/js/core/SimpleCombat.js:293` - Combat attack events
- `server/js/core/SimpleCombat.js:1197` - Combat escape events
- `server/js/Entity.js:2119` - Miniboss upgrade events

**Event Details**:
- Subject: Attacker/escapee/upgraded entity
- Target: Target entity (for attacks/escapes)
- Action: "dealt [damage] damage", "escaped from combat", "became miniboss"
- Quantity: Damage dealt or kill count
- Communication: SPECTATOR (attacks), PLAYER (escapes), AREA+SPECTATOR (miniboss)
- Position: Combat location

### 4. ENVIRONMENT

**Purpose**: World state changes, time transitions, zone entries, cave entries

**Helper Methods**:
- `dayNightTransition(newState, isNight)`
- `hourChange(newTempus, day)`
- `dailyRecap(day, populationBefore, changes)`

**Direct Usage Locations**:
- `lambic.js:6025` - Hour change events
- `lambic.js:6158` - Daily recap events
- `lambic.js:6184` - Nightfall transition
- `lambic.js:6186` - Dawn transition
- `lambic.js:5307` - Zone entry events
- `server/js/Entity.js:5428` - Cave entry events

**Event Details**:
- Subject: Player (for zone/cave entries) or null (for time events)
- Action: "hour change", "daily recap", "Nightfall", "Dawn", "entered zone", "entered cave"
- Target: Zone ID (for zone entries)
- TargetName: Zone name or cave name
- Communication: GLOBAL (day/night), PLAYER (zone/cave), NONE (hour/daily recap)
- Metadata: Contains tempus, day, population stats, changes (for daily recap)

### 5. SOCIAL

**Purpose**: Player/NPC speech, interactions, UI feedback messages

**Direct Usage Locations**:
- `server/js/core/SocialSystem.js:217` - NPC speech (farewell)
- `server/js/core/SocialSystem.js:293` - NPC speech (conversation)
- `server/js/core/SocialSystem.js:360` - NPC speech (busy response)
- `server/js/core/SocialSystem.js:485` - NPC speech (spontaneous)
- `lambic.js:7552` - Player chat messages
- `lambic.js:2856` - Cannot light torch underwater
- `lambic.js:2871` - No torches available
- `lambic.js:3410` - Door unlocked
- `lambic.js:3579` - Nothing to pick up
- `lambic.js:3611` - Try again shortly (horse)
- `lambic.js:3626` - Not wearing riding gear
- `lambic.js:3641` - Does not own horse
- `lambic.js:3669` - Switched weapons
- `lambic.js:3683` - No secondary weapon
- `lambic.js:3698` - No weapons equipped
- `lambic.js:3713` - Try again shortly (weapon switch)

**Event Details**:
- Subject: Speaking/interacting entity
- Action: "said", "cannot light torch here", "unlocked door", "switched weapons", etc.
- Message: HTML formatted message for display
- Communication: AREA (speech), PLAYER (UI feedback)
- Position: Location of interaction

### 6. DEATH

**Purpose**: Entity deaths and respawns

**Helper Method**: `death(victim, killer, position)`

**Direct Usage Locations**:
- `server/js/Entity.js:2149` - Entity death
- `lambic.js:2628` - Player death
- `lambic.js:2813` - Player respawn from ghost

**Event Details**:
- Subject: Victim entity
- Target: Killer entity (if exists)
- Action: "died" or "respawned from ghost"
- Communication: AREA+SPECTATOR (death), PLAYER (respawn)
- Message: "💀 [victim] was slain by [killer]!" or "✨ You have respawned!"
- Position: Death/respawn location

### 7. STEALTH

**Purpose**: Stealth-related actions (category defined but no events found)

**Event Details**:
- Currently unused category
- Reserved for future stealth system events

### 8. FACTION

**Purpose**: Faction-related activities (category defined but no events found)

**Event Details**:
- Currently unused category
- Reserved for future faction system events

### 9. MILITARY

**Purpose**: Military unit recruitment and upgrades

**Helper Methods**:
- `militaryUnitRecruited(unitClass, houseName, houseId, position)`

**Direct Usage Locations**:
- `server/js/Entity.js:1603` - Military unit recruitment
- `server/js/core/SimpleCombat.js:1258` - Military unit upgrade

**Event Details**:
- Subject: Unit class (for recruitment) or old class (for upgrade)
- Target: New class (for upgrade)
- Action: "recruited" or "upgraded"
- House: House ID
- HouseName: House name
- Communication: HOUSE+AREA (recruitment), HOUSE (upgrade)
- Message: "⚔️ [house] recruited a [unitClass]!" or "⬆️ [oldClass] upgraded to [newClass]!"
- Position: Recruitment/upgrade location

### 10. ITEM

**Purpose**: Item drops and pickups

**Helper Methods**:
- `itemDropped(item, dropper, position)`
- `itemPickedUp(item, picker, position)`

**Direct Usage Locations**:
- `server/js/entities/BaseItem.js:96` - Item pickup
- `lambic.js:3579` - Nothing to pick up (UI feedback)

**Event Details**:
- Subject: Entity dropping/picking up
- Action: "dropped [item.type]" or "picked up [item.type]" or "nothing to pick up"
- Quantity: Item quantity
- Communication: NONE (logged only) or PLAYER (UI feedback)
- Position: Item location

### 11. AI

**Purpose**: AI system events (category defined but no events found)

**Event Details**:
- Currently unused category
- Reserved for future AI system events

## Communication Modes

### NONE

- No player communication
- Events logged to console only
- Used for: Resource gathering, item drops, hour changes, daily recaps

### PLAYER

- Message sent to specific player (subject)
- Used for: UI feedback, respawn messages, zone entries, cave entries

### HOUSE

- Message sent to all members of a house
- Used for: Building completions, military recruitment, unit upgrades

### AREA

- Message sent to all players within 768 pixels (~12 tiles) radius
- Used for: Deaths, NPC speech, player chat, combat escapes

### GLOBAL

- Message sent to all connected players
- Used for: Day/night transitions

### SPECTATOR

- Message sent to all spectators
- Also sends structured event data (not just chat message)
- Used for: Combat attacks, deaths, miniboss upgrades

### Multiple Modes

- Can specify array of modes: `[HOUSE, AREA]`
- Used for: Deaths (AREA+SPECTATOR), military recruitment (HOUSE+AREA)

## Event Querying Methods

### getEventsByCategory(category, timeWindow = 60000)

Returns all events of a specific category within the time window.

### getEventsBySubject(subjectId, timeWindow = 60000)

Returns all events where the subject matches the ID.

### getEventsByPosition(x, y, z, radius, timeWindow = 60000)

Returns all events within a radius of a position on the same z-level.

### getEventStats(timeWindow = 60000)

Returns statistics including:
- Total event count
- Count by category
- Combat hotspots (grouped by 512x512 tile areas)
- Economic activity count
- Death count

## Event Subscriptions

### subscribe(subscriberId, categories, callback)

Allows AI systems or other modules to subscribe to specific event categories.

### unsubscribe(subscriberId)

Removes all subscriptions for a subscriber.

### notifySubscribers(event)

Automatically called when events are created, notifying all relevant subscribers.

## Event Creation Patterns

### Pattern 1: Helper Methods

Predefined methods for common event types:
- `combatAttack()`
- `death()`
- `combatEscape()`
- `militaryUnitRecruited()`
- `minibossUpgrade()`
- `resourceGathered()`
- `buildingCompleted()`
- `dayNightTransition()`
- `itemDropped()`
- `itemPickedUp()`
- `hourChange()`
- `dailyRecap()`

### Pattern 2: Direct createEvent()

Used for custom events that don't fit helper methods:
- Social interactions
- UI feedback messages
- Zone/cave entries
- Serf resource deposits
- Military unit upgrades

## Event Statistics Tracking

The system tracks:
- Combat hotspots (grouped by 512x512 tile areas)
- Economic activity counts
- Death counts
- Category-based event counts
- All within configurable time windows

## Performance Features

- Batched logging (100ms intervals)
- Ring buffer for history (prevents memory growth)
- Automatic cleanup of stale events (5 minute intervals)
- Efficient position-based queries (radius squared calculations)



