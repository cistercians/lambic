// Card Deck System - Simulates a standard 52-card deck
class CardDeck {
  constructor() {
    this.cards = [];
    this.reset();
  }
  
  // Reset deck to full 52 cards
  reset() {
    this.cards = [];
    const suits = ['hearts', 'spades', 'clubs', 'diamonds'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    for (const suit of suits) {
      for (const value of values) {
        this.cards.push({ suit, value });
      }
    }
  }
  
  // Shuffle deck using Fisher-Yates algorithm
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }
  
  // Draw a card from the top of the deck
  draw() {
    if (this.cards.length === 0) {
      return null;
    }
    return this.cards.shift(); // Remove and return first card
  }
  
  // Draw multiple cards
  drawMultiple(count) {
    const drawn = [];
    for (let i = 0; i < count && this.cards.length > 0; i++) {
      drawn.push(this.draw());
    }
    return drawn;
  }
  
  // Get remaining card count
  remaining() {
    return this.cards.length;
  }
  
  // Format card for chat display (suit before value: ♥A)
  static formatCard(card) {
    if (!card) return '';
    
    const suitSymbols = {
      'hearts': '♥',
      'spades': '♠',
      'clubs': '♣',
      'diamonds': '♦'
    };
    
    const suitSymbol = suitSymbols[card.suit] || '';
    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    const color = isRed ? 'red' : 'black';
    
    // Format: suit before value (♥A)
    return `<span style="background-color: white; color: ${color};">${suitSymbol}${card.value}</span>`;
  }
  
  // Format multiple cards for display
  static formatCards(cards) {
    if (!cards || cards.length === 0) return '';
    return cards.map(card => CardDeck.formatCard(card)).join(' ');
  }
  
  // Get card value for comparison (A=14, K=13, Q=12, J=11, 2-10 as numbers)
  static getCardValue(card) {
    if (!card) return 0;
    
    const valueMap = {
      'A': 14,
      'K': 13,
      'Q': 12,
      'J': 11,
      '10': 10,
      '9': 9,
      '8': 8,
      '7': 7,
      '6': 6,
      '5': 5,
      '4': 4,
      '3': 3,
      '2': 2
    };
    
    return valueMap[card.value] || 0;
  }
  
  // Get suit for comparison
  static getCardSuit(card) {
    return card ? card.suit : null;
  }
}

module.exports = CardDeck;

