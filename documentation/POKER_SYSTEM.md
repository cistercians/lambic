# Poker System Documentation

## Overview

The Poker System allows players to play Texas Hold'em poker with nearby players and NPCs while inside taverns. Players use a DeckOfCards item to initiate games, invite others, and participate in full poker sessions with betting, turn management, and hand evaluation.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Game Mechanics](#game-mechanics)
3. [Commands](#commands)
4. [Visual Indicators](#visual-indicators)
5. [Technical Architecture](#technical-architecture)
6. [File Structure](#file-structure)
7. [API Reference](#api-reference)
8. [Game Flow](#game-flow)
9. [NPC Behavior](#npc-behavior)
10. [Location Requirements](#location-requirements)

## Getting Started

### Prerequisites

- Players spawn with a `deckofcards` item in their inventory
- Players must be inside a tavern (ground floor, z-level 1)
- At least 2 players/NPCs must be nearby (within ~5 tiles, same z-level)

### Starting a Game

1. **Use the DeckOfCards item** from your inventory
2. The system automatically finds nearby players and NPCs
3. Players receive invitation popups with Accept/Decline buttons
4. NPCs have a 30% chance to automatically accept
5. After 10 seconds, if at least 2 players have accepted, the game begins
6. If not enough players join, the invitation expires

### Cooldown

- Players cannot start a new game for 60 seconds after using the DeckOfCards item
- Cooldown resets when a game ends or fails to start

## Game Mechanics

### Texas Hold'em Rules

The game follows standard Texas Hold'em poker rules:

1. **Blinds**: Small blind (10 chips) and big blind (20 chips) are posted automatically
2. **Hole Cards**: Each player receives 2 private cards
3. **Community Cards**: 
   - Flop: 3 cards
   - Turn: 1 card
   - River: 1 card
4. **Betting Rounds**: Pre-flop, post-flop, turn, and river
5. **Showdown**: Best 5-card hand wins (using 2 hole cards + 5 community cards)

### Starting Chips

- Each player starts with **500 chips** per game session
- Chips are virtual and only used within the game session
- Future enhancement: Will use actual in-game silver for buy-ins

### Hand Rankings

1. **Royal Flush** (A-K-Q-J-10, same suit)
2. **Straight Flush** (5 consecutive cards, same suit)
3. **Four of a Kind** (4 cards of same rank)
4. **Full House** (3 of a kind + pair)
5. **Flush** (5 cards, same suit)
6. **Straight** (5 consecutive cards)
7. **Three of a Kind** (3 cards of same rank)
8. **Two Pair** (2 pairs)
9. **One Pair** (2 cards of same rank)
10. **High Card** (highest card wins)

### Betting System

- **Blinds**: Small blind (10) and big blind (20) posted automatically
- **Minimum Bet**: Must match or exceed the current highest bet
- **All-In**: Players can bet all remaining chips
- **Pot**: All bets are collected into a central pot
- **Winnings**: Distributed to winner(s) at showdown

### Turn Management

- **Turn Duration**: 5 seconds initial + 5 seconds warning
- **Warning**: "5 seconds remaining..." message at 5 seconds
- **Auto-Action**: After 10 seconds total:
  - Auto-check if no bet to call
  - Auto-fold if bet must be called
- **Location Check**: Players must remain in tavern during their turn
  - Auto-fold if player leaves tavern
  - Checked before each action

## Commands

### `/bet <amount>`

Place a bet or call a bet.

- **Usage**: `/bet 50`
- **Minimum**: Must match or exceed current highest bet
- **Maximum**: Cannot exceed player's chip count
- **Example**: `/bet 100` - Bets 100 chips

### `/fold`

Fold your hand and exit the current round.

- **Usage**: `/fold`
- **Effect**: Player is removed from current hand
- **Cannot be undone**

### `/check`

Check (pass) when no bet needs to be called.

- **Usage**: `/check`
- **Requirement**: Current bet must be 0, or player has already matched the bet
- **Cannot check** if there's an uncalled bet (must use `/bet` to call)

### `/sitout`

Sit out the current hand (equivalent to folding).

- **Usage**: `/sitout`
- **Effect**: Same as `/fold`

## Visual Indicators

### Joker Card Emoji (🃏)

The joker card emoji (🃏) appears next to a player's name when it's their turn in the poker game. This provides a clear visual indicator of whose turn it is, similar to the work emoji (⌛️) for working players.

- **Display**: Next to player name, above HP bar
- **Priority**: Poker turn indicator takes priority over work emoji
- **Updates**: Automatically updates as turns change
- **Visibility**: Visible to all players in the game

### Card Display Format

Cards are displayed in chat with suit before value:

- **Format**: `♥A` (suit emoji + value)
- **Colors**: 
  - Red for hearts (♥) and diamonds (♦)
  - Black for spades (♠) and clubs (♣)
- **Styling**: White background with colored text
- **Examples**:
  - `Your cards: ♠A ♥K`
  - `Flop: ♥10 ♠7 ♣2`
  - `Turn: ♦5`
  - `River: ♣J`

### Suit Emojis

- ♥ Hearts (red)
- ♠ Spades (black)
- ♣ Clubs (black)
- ♦ Diamonds (red)

## Technical Architecture

### Core Components

1. **CardDeck.js**: Deck simulation with shuffle and draw
2. **PokerGameManager.js**: Invitation system, game sessions, location validation
3. **TexasHoldEm.js**: Full game logic, betting, hand evaluation
4. **Command Handlers**: BetCommand, FoldCommand, CheckCommand, SitoutCommand
5. **Client UI**: Invitation popup handler

### Data Flow

```
Player uses DeckOfCards
  ↓
Check tavern location & cooldown
  ↓
Find nearby players/NPCs (same z-level, ~5 tiles)
  ↓
Send invitations (players get popup, NPCs 30% chance)
  ↓
Wait 10 seconds
  ↓
If ≥2 players accepted → Start game
  ↓
Deal cards → Post blinds → Betting rounds
  ↓
Community cards (flop, turn, river)
  ↓
Showdown → Distribute pot → Next hand or end game
```

### Game State Management

Each game session tracks:
- **Session ID**: Unique identifier for the game
- **Players**: Array of player data (chips, hole cards, bets, status)
- **Dealer**: Rotates each hand
- **Current Round**: preflop, flop, turn, river, showdown, ended
- **Community Cards**: Cards on the table
- **Pot**: Total chips in the pot
- **Current Bet**: Highest bet this round
- **Turn Timer**: 5s + 5s warning system

### Player State

Each player in a game has:
- **chips**: Current chip count (starts at 500)
- **holeCards**: Array of 2 private cards
- **hasFolded**: Boolean, true if player folded
- **isAllIn**: Boolean, true if player has no chips left
- **currentBet**: Amount bet this action
- **totalBetThisRound**: Total bet this betting round
- **isNPC**: Boolean, true if NPC player
- **pokerTurn**: Boolean, true when it's this player's turn (for visual indicator)

## File Structure

```
server/js/
  games/
    CardDeck.js              # Deck simulation, shuffle, card formatting
    PokerGameManager.js       # Invitations, sessions, location validation
    TexasHoldEm.js           # Full game logic, betting, hand evaluation
  commands/
    commands/
      BetCommand.js          # /bet command handler
      FoldCommand.js         # /fold command handler
      CheckCommand.js        # /check command handler
      SitoutCommand.js      # /sitout command handler
  entities/
    ItemFactory.js           # Item registration (deckofcards)
  Inventory.js              # Inventory template (deckofcards:0)

client/js/
  core/
    SocketMessageHandler.js  # Handles pokerInvitation messages
  rendering/
    PlayerRenderer.js        # Renders joker emoji for poker turns

lambic.js                   # useItem handler, player spawn, update pack
```

## API Reference

### Server-Side Messages

#### `pokerInvitation`
Sent to players when invited to a game.

```json
{
  "msg": "pokerInvitation",
  "inviterName": "PlayerName",
  "inviterId": "socketId",
  "sessionId": "gameSessionId"
}
```

#### `pokerAcceptInvitation`
Sent by client when accepting invitation.

```json
{
  "msg": "pokerAcceptInvitation",
  "inviterId": "socketId",
  "sessionId": "gameSessionId"
}
```

#### `pokerDeclineInvitation`
Sent by client when declining invitation.

```json
{
  "msg": "pokerDeclineInvitation",
  "inviterId": "socketId",
  "sessionId": "gameSessionId"
}
```

### Player Properties

#### `player.pokerTurn`
Boolean property indicating if it's this player's turn in poker.

- **Set**: Automatically by TexasHoldEm when turn starts
- **Cleared**: When turn ends, round ends, hand ends, or game ends
- **Synced**: Included in player update pack to clients
- **Display**: Renders joker emoji (🃏) next to player name

## Game Flow

### 1. Invitation Phase

1. Player uses DeckOfCards item
2. System checks:
   - Player is in tavern (z=1, building.type='tavern')
   - Cooldown expired (60 seconds)
   - Player not already in a game
3. Find nearby players/NPCs (same z-level, ~320px radius)
4. Send invitations:
   - Players: UI popup with Accept/Decline
   - NPCs: 30% chance to auto-accept
5. Wait 10 seconds
6. If ≥2 players accepted → Start game
7. If <2 players → Cancel invitation

### 2. Hand Setup

1. Shuffle deck (Fisher-Yates algorithm)
2. Deal 2 hole cards to each player (privately)
3. Rotate dealer (moves one position each hand)
4. Post blinds:
   - Small blind: Player after dealer (10 chips)
   - Big blind: Player after small blind (20 chips)
5. Start pre-flop betting round

### 3. Betting Round

1. First player to act: Player after big blind
2. Each player's turn:
   - 5 seconds to act
   - Warning at 5 seconds
   - Auto-action at 10 seconds (check or fold)
   - Location validation before action
3. Actions:
   - **Bet/Raise**: Increase the bet
   - **Call**: Match the current bet
   - **Check**: Pass when no bet to call
   - **Fold**: Exit the hand
4. Round ends when:
   - All players have matched the current bet
   - All but one player has folded

### 4. Community Cards

After each betting round (except pre-flop):

- **Flop**: Deal 3 community cards
- **Turn**: Deal 1 community card
- **River**: Deal 1 community card

Each followed by a betting round.

### 5. Showdown

1. All active players reveal their hole cards
2. Evaluate best 5-card hand for each player (2 hole + 5 community)
3. Compare hands using standard poker rankings
4. Winner(s) receive the pot
5. If tie: Pot split evenly among winners

### 6. Hand End

1. Clear poker turn indicators
2. Check if game should continue (≥2 players with chips)
3. If yes: Start new hand after 3 seconds
4. If no: End game, show final chip counts

## NPC Behavior

### Invitation Acceptance

- **Chance**: 30% to accept invitation
- **Decision**: Made immediately when invitation is sent
- **No UI**: NPCs don't see invitation popups

### Betting AI

NPCs use a simple AI system based on hand strength:

- **Strong Hand** (>0.7): Bet/raise (1.5x current bet)
- **Medium Hand** (0.4-0.7): Call/check
- **Weak Hand** (<0.4): Fold

**Hand Strength Calculation**:
- Pre-flop: Based on hole cards (pairs, high cards)
- Post-flop: Based on best possible hand rank (normalized 0-1)

**Timing**: NPCs act with 1-3 second delay to feel natural

### Location Validation

- NPCs are automatically folded if they leave the tavern
- Same validation as players (checked before each turn)

## Location Requirements

### Tavern Detection

Players must be:
1. **Inside a tavern building**:
   - `building.type === 'tavern'`
   - `building.built === true`
   - Player's tile location is within `building.plot`
2. **On ground floor**:
   - `player.z === 1` (ground floor of building)
3. **Same z-level as other players**:
   - All players in a game must be on the same z-level

### Nearby Detection

- **Radius**: ~320 pixels (~5 tiles at 64px/tile)
- **Z-Level**: Must match inviting player's z-level
- **Exclusions**: 
  - Inviting player (self)
  - Players already in a game
  - Invalid NPC types (animals excluded)

### Location Validation During Game

- **Before each turn**: Check if player is still in tavern
- **Before each action**: Validate location
- **Auto-fold**: If player leaves tavern during their turn

## Card System

### Deck Structure

- **Standard 52-card deck**
- **Suits**: hearts, spades, clubs, diamonds
- **Values**: A, 2-10, J, Q, K
- **Shuffle**: Fisher-Yates algorithm
- **Draw**: Removes from top of array (first element)

### Card Formatting

Cards are formatted for chat display with:
- **Suit emoji**: ♥ ♠ ♣ ♦
- **Value**: A, 2-10, J, Q, K
- **Order**: Suit before value (e.g., `♥A`, `♠K`)
- **Styling**: White background, red/black text

### Card Evaluation

- **Value mapping**: A=14, K=13, Q=12, J=11, 2-10 as numbers
- **Hand ranking**: Standard poker hand rankings
- **Best hand**: Selects best 5-card combination from 7 cards (2 hole + 5 community)

## Error Handling

### Common Errors

- **"You must be inside a tavern to play poker"**: Player not in tavern
- **"You must wait X more seconds"**: Cooldown not expired
- **"You are already in a poker game"**: Player already in active game
- **"No nearby players or NPCs to invite"**: No valid targets found
- **"Not enough players joined"**: <2 players accepted after 10 seconds
- **"You must be in the tavern to continue playing"**: Player left during game
- **"It's not your turn"**: Command used out of turn
- **"Minimum bet is X chips"**: Bet amount too low
- **"You don't have enough chips"**: Bet exceeds chip count

## Future Enhancements

### Planned Features

1. **Silver Buy-In System**: Use actual in-game silver instead of virtual chips
2. **Spectator Mode**: Allow players to watch games without participating
3. **Game History**: Track and display past game results
4. **Statistics**: Win/loss records, chip totals, etc.
5. **Tournament Mode**: Multi-table tournaments
6. **Side Pots**: Handle all-in scenarios with multiple pots
7. **Advanced NPC AI**: More sophisticated betting strategies

### Known Limitations

- **Virtual Chips**: Currently uses fake chips, not real currency
- **Simple AI**: NPCs use basic hand strength evaluation
- **No Side Pots**: All-in players can't win more than they contributed
- **No Rebuy**: Players eliminated can't rejoin the same game
- **Fixed Blinds**: Small/big blind amounts are fixed (10/20)

## Testing

### Test Scenarios

1. **Basic Game Flow**:
   - Start game with 2+ players
   - Complete a full hand (pre-flop → showdown)
   - Verify pot distribution

2. **Location Validation**:
   - Start game in tavern
   - Leave tavern during turn
   - Verify auto-fold

3. **Turn Timeouts**:
   - Wait 5 seconds → verify warning
   - Wait 10 seconds → verify auto-action

4. **NPC Behavior**:
   - Test 30% acceptance rate
   - Verify NPC betting decisions
   - Test NPC location validation

5. **Commands**:
   - Test all commands (/bet, /fold, /check, /sitout)
   - Test invalid commands (wrong turn, invalid amounts)
   - Test command during timeout

6. **Visual Indicators**:
   - Verify joker emoji appears on active player
   - Verify emoji updates as turns change
   - Verify emoji clears when game ends

## Troubleshooting

### Game Won't Start

- Check if player is in tavern (z=1, building.type='tavern')
- Verify cooldown has expired (60 seconds)
- Ensure at least 2 players/NPCs are nearby
- Check if player is already in another game

### Commands Not Working

- Verify player is in an active poker game
- Check if it's the player's turn
- Ensure player is still in tavern
- Verify command syntax is correct

### Visual Issues

- Joker emoji not appearing: Check if `player.pokerTurn` is set
- Cards not displaying: Verify CardDeck.formatCard() is working
- Invitation popup not showing: Check SocketMessageHandler.js

## Code Examples

### Starting a Game

```javascript
// Player uses DeckOfCards item
const pokerGameManager = require('./server/js/games/PokerGameManager.js');
const result = pokerGameManager.createInvitation(playerId);

if (result.success) {
  // Invitations sent, game will start after 10 seconds if ≥2 players accept
}
```

### Handling a Bet

```javascript
// In TexasHoldEm.js
handleBet(playerId, amount) {
  // Validate turn, location, amount
  // Place bet
  // Update pot
  // Advance to next player
}
```

### Displaying Cards

```javascript
// Format single card
const cardDisplay = CardDeck.formatCard(card); // Returns: "<span style="...">♥A</span>"

// Format multiple cards
const cardsDisplay = CardDeck.formatCards(cards); // Returns formatted string with spaces
```

## Summary

The Poker System provides a complete Texas Hold'em poker experience within the game. Players can use the DeckOfCards item in taverns to start games, invite others, and play full poker sessions with betting, turn management, and hand evaluation. The system includes visual indicators, NPC support, location validation, and comprehensive error handling.

