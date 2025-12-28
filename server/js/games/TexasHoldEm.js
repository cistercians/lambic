// Texas Hold'em Poker Game Logic
const CardDeck = require('./CardDeck.js');
const pokerGameManager = require('./PokerGameManager.js');

class TexasHoldEm {
  constructor(sessionId, playerIds) {
    this.sessionId = sessionId;
    this.players = []; // Array of { id, name, chips, holeCards, hasFolded, isAllIn, currentBet, totalBetThisRound, isNPC }
    this.dealerIndex = 0;
    this.currentPlayerIndex = -1;
    this.communityCards = [];
    this.pot = 0;
    this.currentRound = 'waiting'; // waiting, preflop, flop, turn, river, showdown, ended
    this.deck = new CardDeck();
    this.smallBlind = 10;
    this.bigBlind = 20;
    this.currentBet = 0; // Highest bet this round
    this.turnTimeout = null;
    this.turnStartTime = null;
    this.warningSent = false;
    
    // Initialize players
    for (const playerId of playerIds) {
      const player = global.Player.list[playerId];
      if (player) {
        this.players.push({
          id: playerId,
          name: player.name,
          chips: 500, // Starting chips
          holeCards: [],
          hasFolded: false,
          isAllIn: false,
          currentBet: 0,
          totalBetThisRound: 0,
          isNPC: !global.SOCKET_LIST[playerId]
        });
      }
    }
    
    if (this.players.length < 2) {
      throw new Error('Not enough players to start game');
    }
  }
  
  // Get list of player IDs
  getPlayers() {
    return this.players.map(p => p.id);
  }
  
  // Send message to all players
  broadcast(message) {
    for (const player of this.players) {
      const socket = global.SOCKET_LIST[player.id];
      if (socket) {
        socket.write(JSON.stringify({
          msg: 'addToChat',
          message: message
        }));
      }
    }
  }
  
  // Send message to specific player
  sendToPlayer(playerId, message) {
    const socket = global.SOCKET_LIST[playerId];
    if (socket) {
      socket.write(JSON.stringify({
        msg: 'addToChat',
        message: message
      }));
    }
  }
  
  // Start a new hand
  startHand() {
    // Reset round state
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.currentRound = 'preflop';
    this.warningSent = false;
    
    // Clear pokerTurn indicators
    this.clearPokerTurn();
    
    // Reset player states
    for (const player of this.players) {
      player.holeCards = [];
      player.hasFolded = false;
      player.isAllIn = false;
      player.currentBet = 0;
      player.totalBetThisRound = 0;
    }
    
    // Shuffle deck
    this.deck.reset();
    this.deck.shuffle();
    
    // Rotate dealer
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    
    // Deal hole cards (2 per player)
    for (let i = 0; i < 2; i++) {
      for (const player of this.players) {
        player.holeCards.push(this.deck.draw());
      }
    }
    
    // Send hole cards to each player privately
    for (const player of this.players) {
      const cardDisplay = CardDeck.formatCards(player.holeCards);
      this.sendToPlayer(player.id, `<i>Your cards: ${cardDisplay}</i>`);
    }
    
    // Post blinds
    const smallBlindIndex = (this.dealerIndex + 1) % this.players.length;
    const bigBlindIndex = (this.dealerIndex + 2) % this.players.length;
    
    const smallBlindPlayer = this.players[smallBlindIndex];
    const bigBlindPlayer = this.players[bigBlindIndex];
    
    // Post small blind
    const smallBlindAmount = Math.min(this.smallBlind, smallBlindPlayer.chips);
    smallBlindPlayer.chips -= smallBlindAmount;
    smallBlindPlayer.currentBet = smallBlindAmount;
    smallBlindPlayer.totalBetThisRound = smallBlindAmount;
    this.pot += smallBlindAmount;
    if (smallBlindPlayer.chips === 0) {
      smallBlindPlayer.isAllIn = true;
    }
    
    // Post big blind
    const bigBlindAmount = Math.min(this.bigBlind, bigBlindPlayer.chips);
    bigBlindPlayer.chips -= bigBlindAmount;
    bigBlindPlayer.currentBet = bigBlindAmount;
    bigBlindPlayer.totalBetThisRound = bigBlindAmount;
    this.pot += bigBlindAmount;
    this.currentBet = bigBlindAmount;
    if (bigBlindPlayer.chips === 0) {
      bigBlindPlayer.isAllIn = true;
    }
    
    this.broadcast(`<i>${smallBlindPlayer.name} posts small blind (${smallBlindAmount}), ${bigBlindPlayer.name} posts big blind (${bigBlindAmount})</i>`);
    
    // Start betting round (first player after big blind)
    this.currentPlayerIndex = (bigBlindIndex + 1) % this.players.length;
    this.startBettingRound();
  }
  
  // Start a betting round
  startBettingRound() {
    // Clear pokerTurn indicators
    this.clearPokerTurn();
    
    // Reset current bet tracking for this round
    for (const player of this.players) {
      player.currentBet = 0;
      player.totalBetThisRound = 0;
    }
    
    // Find first active player
    this.findNextActivePlayer();
    
    if (this.currentPlayerIndex === -1) {
      // All players folded or all-in, end hand
      this.endHand();
      return;
    }
    
    this.currentBet = 0; // Reset for new betting round
    this.warningSent = false;
    this.turnStartTime = Date.now();
    
    // Set pokerTurn indicator for current player
    const currentPlayer = this.players[this.currentPlayerIndex];
    this.setPokerTurn(currentPlayer.id);
    
    // Start turn timer
    this.startTurnTimer();
    
    // Handle NPC turn immediately
    if (currentPlayer.isNPC) {
      this.handleNPCTurn();
    } else {
      this.sendToPlayer(currentPlayer.id, `<i>It's your turn. Use /bet, /fold, /check, or /sitout</i>`);
    }
  }
  
  // Find next active player (not folded, not all-in)
  findNextActivePlayer() {
    let attempts = 0;
    while (attempts < this.players.length) {
      const player = this.players[this.currentPlayerIndex];
      if (!player.hasFolded && !player.isAllIn) {
        // Check if player needs to act (hasn't matched current bet)
        if (player.totalBetThisRound < this.currentBet) {
          return; // Found player who needs to act
        }
      }
      
      // Move to next player
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
      attempts++;
    }
    
    // No active players found
    this.currentPlayerIndex = -1;
  }
  
  // Start turn timer (5s initial + 5s warning)
  startTurnTimer() {
    if (this.turnTimeout) {
      clearTimeout(this.turnTimeout);
    }
    
    // 5 second warning
    this.turnTimeout = setTimeout(() => {
      this.warningSent = true;
      const currentPlayer = this.players[this.currentPlayerIndex];
      if (currentPlayer && !currentPlayer.isNPC) {
        this.sendToPlayer(currentPlayer.id, `<i><span style="color:#ff6666;">5 seconds remaining...</span></i>`);
      }
      
      // Auto-action after 5 more seconds (total 10s)
      this.turnTimeout = setTimeout(() => {
        this.handleTurnTimeout();
      }, 5000);
    }, 5000);
  }
  
  // Handle turn timeout (auto-check or fold)
  handleTurnTimeout() {
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (!currentPlayer) return;
    
    // Validate location first
    if (!pokerGameManager.validatePlayerLocation(currentPlayer.id, this.sessionId)) {
      this.handleFold(currentPlayer.id);
      return;
    }
    
    // Try to check, otherwise fold
    if (this.currentBet === 0 || currentPlayer.totalBetThisRound >= this.currentBet) {
      this.handleCheck(currentPlayer.id);
    } else {
      this.handleFold(currentPlayer.id);
    }
  }
  
  // Handle player bet
  handleBet(playerId, amount) {
    if (this.currentPlayerIndex === -1) return false;
    
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (currentPlayer.id !== playerId) {
      this.sendToPlayer(playerId, `<i>It's not your turn.</i>`);
      return false;
    }
    
    // Validate location
    if (!pokerGameManager.validatePlayerLocation(playerId, this.sessionId)) {
      this.sendToPlayer(playerId, `<i>You must be in the tavern to continue playing.</i>`);
      this.handleFold(playerId);
      return false;
    }
    
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.hasFolded || player.isAllIn) {
      return false;
    }
    
    // Validate amount
    const minBet = this.currentBet - player.totalBetThisRound;
    if (amount < minBet) {
      this.sendToPlayer(playerId, `<i>Minimum bet is ${minBet} chips.</i>`);
      return false;
    }
    
    if (amount > player.chips) {
      this.sendToPlayer(playerId, `<i>You don't have enough chips.</i>`);
      return false;
    }
    
    // Place bet
    const betAmount = Math.min(amount, player.chips);
    player.chips -= betAmount;
    player.currentBet = betAmount;
    player.totalBetThisRound += betAmount;
    this.pot += betAmount;
    
    if (player.chips === 0) {
      player.isAllIn = true;
    }
    
    // Update current bet if this is a raise
    if (player.totalBetThisRound > this.currentBet) {
      this.currentBet = player.totalBetThisRound;
      this.broadcast(`<i>${player.name} bets ${betAmount} chips (total: ${player.totalBetThisRound})</i>`);
    } else {
      this.broadcast(`<i>${player.name} calls ${betAmount} chips</i>`);
    }
    
    // Clear timer and move to next player
    if (this.turnTimeout) {
      clearTimeout(this.turnTimeout);
      this.turnTimeout = null;
    }
    
    this.advanceTurn();
    return true;
  }
  
  // Handle player fold
  handleFold(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.hasFolded) return false;
    
    player.hasFolded = true;
    this.broadcast(`<i>${player.name} folds</i>`);
    
    // Check if only one player left
    const activePlayers = this.players.filter(p => !p.hasFolded);
    if (activePlayers.length === 1) {
      this.endHand();
      return true;
    }
    
    // Clear timer and advance
    if (this.turnTimeout) {
      clearTimeout(this.turnTimeout);
      this.turnTimeout = null;
    }
    
    this.advanceTurn();
    return true;
  }
  
  // Handle player check
  handleCheck(playerId) {
    if (this.currentPlayerIndex === -1) return false;
    
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (currentPlayer.id !== playerId) {
      this.sendToPlayer(playerId, `<i>It's not your turn.</i>`);
      return false;
    }
    
    // Validate location
    if (!pokerGameManager.validatePlayerLocation(playerId, this.sessionId)) {
      this.sendToPlayer(playerId, `<i>You must be in the tavern to continue playing.</i>`);
      this.handleFold(playerId);
      return false;
    }
    
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.hasFolded || player.isAllIn) {
      return false;
    }
    
    // Can only check if no bet to call
    if (this.currentBet > 0 && player.totalBetThisRound < this.currentBet) {
      this.sendToPlayer(playerId, `<i>You must call or fold. Use /bet to call.</i>`);
      return false;
    }
    
    this.broadcast(`<i>${player.name} checks</i>`);
    
    // Clear timer and advance
    if (this.turnTimeout) {
      clearTimeout(this.turnTimeout);
      this.turnTimeout = null;
    }
    
    this.advanceTurn();
    return true;
  }
  
  // Handle player sit out
  handleSitOut(playerId) {
    return this.handleFold(playerId);
  }
  
  // Advance to next player or next round
  advanceTurn() {
    // Clear pokerTurn for all players
    this.clearPokerTurn();
    
    // Find next active player
    this.findNextActivePlayer();
    
    if (this.currentPlayerIndex === -1) {
      // All players have acted, move to next round
      this.nextRound();
      return;
    }
    
    // Check if betting round is complete (all players have matched current bet)
    const allMatched = this.players
      .filter(p => !p.hasFolded && !p.isAllIn)
      .every(p => p.totalBetThisRound >= this.currentBet);
    
    if (allMatched) {
      // Betting round complete, move to next round
      this.nextRound();
      return;
    }
    
    // Continue betting round
    this.turnStartTime = Date.now();
    this.warningSent = false;
    
    const currentPlayer = this.players[this.currentPlayerIndex];
    
    // Validate location before starting turn
    if (!currentPlayer.isNPC && !pokerGameManager.validatePlayerLocation(currentPlayer.id, this.sessionId)) {
      // Player left tavern, auto-fold
      this.handleFold(currentPlayer.id);
      return;
    }
    
    // Set pokerTurn indicator for current player
    this.setPokerTurn(currentPlayer.id);
    
    this.startTurnTimer();
    
    if (currentPlayer.isNPC) {
      this.handleNPCTurn();
    } else {
      this.sendToPlayer(currentPlayer.id, `<i>It's your turn. Use /bet, /fold, /check, or /sitout</i>`);
    }
  }
  
  // Set pokerTurn indicator for a player
  setPokerTurn(playerId) {
    const player = global.Player.list[playerId];
    if (player) {
      player.pokerTurn = true;
      player.toUpdate = true; // Mark for update
    }
  }
  
  // Clear pokerTurn indicator for all players
  clearPokerTurn() {
    for (const playerData of this.players) {
      const player = global.Player.list[playerData.id];
      if (player && player.pokerTurn) {
        player.pokerTurn = false;
        player.toUpdate = true; // Mark for update
      }
    }
  }
  
  // Move to next round (flop, turn, river, or showdown)
  nextRound() {
    // Clear pokerTurn indicators when moving to next round
    this.clearPokerTurn();
    
    if (this.currentRound === 'preflop') {
      // Deal flop (3 cards)
      this.communityCards.push(this.deck.draw());
      this.communityCards.push(this.deck.draw());
      this.communityCards.push(this.deck.draw());
      this.currentRound = 'flop';
      const flopDisplay = CardDeck.formatCards(this.communityCards);
      this.broadcast(`<i>Flop: ${flopDisplay}</i>`);
      this.startBettingRound();
    } else if (this.currentRound === 'flop') {
      // Deal turn (1 card)
      this.communityCards.push(this.deck.draw());
      this.currentRound = 'turn';
      const turnCard = CardDeck.formatCard(this.communityCards[this.communityCards.length - 1]);
      this.broadcast(`<i>Turn: ${turnCard}</i>`);
      this.startBettingRound();
    } else if (this.currentRound === 'turn') {
      // Deal river (1 card)
      this.communityCards.push(this.deck.draw());
      this.currentRound = 'river';
      const riverCard = CardDeck.formatCard(this.communityCards[this.communityCards.length - 1]);
      this.broadcast(`<i>River: ${riverCard}</i>`);
      this.startBettingRound();
    } else if (this.currentRound === 'river') {
      // Showdown
      this.showdown();
    }
  }
  
  // Showdown - determine winner
  showdown() {
    this.currentRound = 'showdown';
    
    // Clear pokerTurn indicators (no turns during showdown)
    this.clearPokerTurn();
    
    // Get active players (not folded)
    const activePlayers = this.players.filter(p => !p.hasFolded);
    
    if (activePlayers.length === 1) {
      // Only one player left, they win
      const winner = activePlayers[0];
      winner.chips += this.pot;
      this.broadcast(`<i>${winner.name} wins ${this.pot} chips!</i>`);
      this.endHand();
      return;
    }
    
    // Evaluate all hands
    const hands = activePlayers.map(player => ({
      player: player,
      hand: this.evaluateHand(player.holeCards, this.communityCards)
    }));
    
    // Sort by hand strength (best first)
    hands.sort((a, b) => this.compareHands(b.hand, a.hand));
    
    // Find winner(s) - handle ties
    const winners = [hands[0]];
    for (let i = 1; i < hands.length; i++) {
      if (this.compareHands(hands[i].hand, hands[0].hand) === 0) {
        winners.push(hands[i]);
      } else {
        break;
      }
    }
    
    // Distribute pot
    const winningsPerPlayer = Math.floor(this.pot / winners.length);
    for (const winner of winners) {
      winner.player.chips += winningsPerPlayer;
      const handDisplay = CardDeck.formatCards(winner.player.holeCards);
      this.broadcast(`<i>${winner.player.name} shows ${handDisplay} - ${winner.hand.name}</i>`);
    }
    
    if (winners.length === 1) {
      this.broadcast(`<i>${winners[0].player.name} wins ${winningsPerPlayer} chips with ${winners[0].hand.name}!</i>`);
    } else {
      this.broadcast(`<i>${winners.map(w => w.player.name).join(' and ')} tie and win ${winningsPerPlayer} chips each!</i>`);
    }
    
    this.endHand();
  }
  
  // Evaluate hand (returns { rank, name, cards })
  evaluateHand(holeCards, communityCards) {
    const allCards = [...holeCards, ...communityCards];
    const all7 = this.getAllCombinations(allCards, 5);
    
    let bestHand = null;
    let bestRank = 0;
    
    for (const combo of all7) {
      const hand = this.rankHand(combo);
      if (hand.rank > bestRank) {
        bestRank = hand.rank;
        bestHand = hand;
      }
    }
    
    return bestHand || { rank: 0, name: 'High Card', cards: [] };
  }
  
  // Get all combinations of 5 cards from 7
  getAllCombinations(cards, k) {
    const combinations = [];
    const n = cards.length;
    
    function combine(start, combo) {
      if (combo.length === k) {
        combinations.push([...combo]);
        return;
      }
      for (let i = start; i < n; i++) {
        combo.push(cards[i]);
        combine(i + 1, combo);
        combo.pop();
      }
    }
    
    combine(0, []);
    return combinations;
  }
  
  // Rank a 5-card hand
  rankHand(cards) {
    const values = cards.map(c => CardDeck.getCardValue(c)).sort((a, b) => b - a);
    const suits = cards.map(c => CardDeck.getCardSuit(c));
    
    const valueCounts = {};
    for (const v of values) {
      valueCounts[v] = (valueCounts[v] || 0) + 1;
    }
    
    const counts = Object.values(valueCounts).sort((a, b) => b - a);
    const isFlush = suits.every(s => s === suits[0]);
    const isStraight = this.isStraight(values);
    
    // Royal flush
    if (isFlush && isStraight && values[0] === 14 && values[4] === 10) {
      return { rank: 9, name: 'Royal Flush', cards: cards };
    }
    
    // Straight flush
    if (isFlush && isStraight) {
      return { rank: 8, name: 'Straight Flush', cards: cards };
    }
    
    // Four of a kind
    if (counts[0] === 4) {
      return { rank: 7, name: 'Four of a Kind', cards: cards };
    }
    
    // Full house
    if (counts[0] === 3 && counts[1] === 2) {
      return { rank: 6, name: 'Full House', cards: cards };
    }
    
    // Flush
    if (isFlush) {
      return { rank: 5, name: 'Flush', cards: cards };
    }
    
    // Straight
    if (isStraight) {
      return { rank: 4, name: 'Straight', cards: cards };
    }
    
    // Three of a kind
    if (counts[0] === 3) {
      return { rank: 3, name: 'Three of a Kind', cards: cards };
    }
    
    // Two pair
    if (counts[0] === 2 && counts[1] === 2) {
      return { rank: 2, name: 'Two Pair', cards: cards };
    }
    
    // One pair
    if (counts[0] === 2) {
      return { rank: 1, name: 'One Pair', cards: cards };
    }
    
    // High card
    return { rank: 0, name: 'High Card', cards: cards };
  }
  
  // Check if values form a straight
  isStraight(values) {
    // Handle A-2-3-4-5 straight (wheel)
    if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
      return true;
    }
    
    // Check normal straight
    for (let i = 0; i < values.length - 1; i++) {
      if (values[i] - values[i + 1] !== 1) {
        return false;
      }
    }
    return true;
  }
  
  // Compare two hands (returns -1 if hand1 < hand2, 0 if equal, 1 if hand1 > hand2)
  compareHands(hand1, hand2) {
    if (hand1.rank !== hand2.rank) {
      return hand1.rank > hand2.rank ? 1 : -1;
    }
    // Same rank, compare high cards (simplified)
    return 0; // For now, just tie
  }
  
  // Handle NPC turn (simple AI)
  handleNPCTurn() {
    const player = this.players[this.currentPlayerIndex];
    if (!player || !player.isNPC) return;
    
    // Simple AI: evaluate hand strength and decide
    const handStrength = this.evaluateHandStrength(player.holeCards, this.communityCards);
    
    // Random delay to make it feel more natural
    setTimeout(() => {
      if (handStrength > 0.7) {
        // Strong hand - bet/raise
        const betAmount = Math.min(Math.floor(this.currentBet * 1.5), player.chips);
        this.handleBet(player.id, betAmount);
      } else if (handStrength > 0.4) {
        // Medium hand - call/check
        if (this.currentBet > 0 && player.totalBetThisRound < this.currentBet) {
          this.handleBet(player.id, this.currentBet - player.totalBetThisRound);
        } else {
          this.handleCheck(player.id);
        }
      } else {
        // Weak hand - fold
        this.handleFold(player.id);
      }
    }, 1000 + Math.random() * 2000); // 1-3 second delay
  }
  
  // Evaluate hand strength (0-1, simplified)
  evaluateHandStrength(holeCards, communityCards) {
    if (communityCards.length === 0) {
      // Pre-flop: evaluate hole cards
      const values = holeCards.map(c => CardDeck.getCardValue(c)).sort((a, b) => b - a);
      const isPair = values[0] === values[1];
      const highCard = values[0];
      
      if (isPair && highCard >= 10) return 0.8; // High pair
      if (isPair) return 0.6; // Low pair
      if (highCard >= 12) return 0.5; // High cards
      return 0.3; // Low cards
    }
    
    // Post-flop: evaluate best hand
    const hand = this.evaluateHand(holeCards, communityCards);
    return hand.rank / 9; // Normalize to 0-1
  }
  
  // End hand and start new one or end game
  endHand() {
    if (this.turnTimeout) {
      clearTimeout(this.turnTimeout);
      this.turnTimeout = null;
    }
    
    // Clear pokerTurn indicators
    this.clearPokerTurn();
    
    // Check if game should continue
    const playersWithChips = this.players.filter(p => p.chips > 0);
    
    if (playersWithChips.length < 2) {
      // Game over
      this.endGame();
      return;
    }
    
    // Start new hand after 3 seconds
    setTimeout(() => {
      this.startHand();
    }, 3000);
  }
  
  // End game
  endGame() {
    if (this.turnTimeout) {
      clearTimeout(this.turnTimeout);
      this.turnTimeout = null;
    }
    
    // Clear pokerTurn indicators
    this.clearPokerTurn();
    
    this.currentRound = 'ended';
    this.broadcast(`<i>Poker game ended. Final chip counts:</i>`);
    for (const player of this.players) {
      this.broadcast(`<i>${player.name}: ${player.chips} chips</i>`);
    }
    
    // Cleanup via manager
    pokerGameManager.endGame(this.sessionId);
  }
}

module.exports = TexasHoldEm;

