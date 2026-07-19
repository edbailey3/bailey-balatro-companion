/**
 * State Management & Round Progression for Balatro Tactical Companion (v1.1)
 */

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];
const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];

export const RANK_TO_VAL = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'Jack': 11, 'Queen': 12, 'King': 13, 'Ace': 14
};

export const VAL_TO_RANK = {
  1: 'Ace', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace'
};

export const STRAIGHT_RANGES = [
  { label: 'A-2-3-4-5', vals: [1, 2, 3, 4, 5] },
  { label: '2-3-4-5-6', vals: [2, 3, 4, 5, 6] },
  { label: '3-4-5-6-7', vals: [3, 4, 5, 6, 7] },
  { label: '4-5-6-7-8', vals: [4, 5, 6, 7, 8] },
  { label: '5-6-7-8-9', vals: [5, 6, 7, 8, 9] },
  { label: '6-7-8-9-10', vals: [6, 7, 8, 9, 10] },
  { label: '7-8-9-10-J', vals: [7, 8, 9, 10, 11] },
  { label: '8-9-10-J-Q', vals: [8, 9, 10, 11, 12] },
  { label: '9-10-J-Q-K', vals: [9, 10, 11, 12, 13] },
  { label: '10-J-Q-K-A', vals: [10, 11, 12, 13, 14] }
];

export const ALL_HAND_TYPES = [
  'Flush', 'Straight', 'Full House', 'Four of a Kind', 'Two Pair',
  'High Card', 'Pair', 'Three of a Kind', 'Royal Flush',
  'Five of a Kind', 'Flush House', 'Flush Five'
];

export function createCard(rank, suit) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
    base_rank: rank,
    base_suit: suit,
    enhancement: 'None',
    edition: 'None',
    seal: 'None',
    is_destroyed: false
  };
}

export function createStandardDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(createCard(rank, suit));
    }
  }
  return deck;
}

export class AppState {
  constructor() {
    this.listeners = [];
    this.loadInitialState();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    listener(this);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.saveState();
    for (const listener of this.listeners) {
      listener(this);
    }
  }

  loadInitialState() {
    try {
      const stored = localStorage.getItem('balatro_companion_state_v1.1');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.baselineDeck = parsed.baselineDeck || createStandardDeck();
        this.remainingDeck = parsed.remainingDeck || this.copyDeck(this.baselineDeck);
        this.hand = parsed.hand || Array(8).fill(null);
        this.selectedForDiscard = new Set(parsed.selectedForDiscard || []);
        
        const defaultActive = ['Flush', 'Straight', 'Full House', 'Four of a Kind', 'Two Pair'];
        this.enabledHands = new Set(parsed.enabledHands || defaultActive);
        
        this.targetParams = parsed.targetParams || this.getDefaultParams();
        this.autoDetectTargets = parsed.autoDetectTargets !== undefined ? parsed.autoDetectTargets : true;
        this.validateState();
        return;
      }
    } catch (e) {
      console.error('Failed to load state from localStorage', e);
    }

    // Default State Setup
    this.baselineDeck = createStandardDeck();
    this.remainingDeck = this.copyDeck(this.baselineDeck);
    this.hand = Array(8).fill(null);
    this.selectedForDiscard = new Set();
    this.enabledHands = new Set(['Flush', 'Straight', 'Full House', 'Four of a Kind', 'Two Pair']);
    this.targetParams = this.getDefaultParams();
    this.autoDetectTargets = true;
  }

  saveState() {
    try {
      const stateObj = {
        baselineDeck: this.baselineDeck,
        remainingDeck: this.remainingDeck,
        hand: this.hand,
        selectedForDiscard: Array.from(this.selectedForDiscard),
        enabledHands: Array.from(this.enabledHands),
        targetParams: this.targetParams,
        autoDetectTargets: this.autoDetectTargets
      };
      localStorage.setItem('balatro_companion_state_v1.1', JSON.stringify(stateObj));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  copyDeck(deck) {
    return deck.map(c => ({
      ...c,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
    }));
  }

  getDefaultParams() {
    return {
      pair_rank: 'Ace',
      twopair_rankA: 'Ace',
      twopair_rankB: 'King',
      three_rank: 'Ace',
      straight_range: '10-J-Q-K-A',
      flush_suit: 'Spades',
      fh_rankA: 'Ace',
      fh_rankB: 'King',
      four_rank: 'Ace',
      five_rank: 'Ace',
      flushhouse_suit: 'Spades',
      flushhouse_rankA: 'Ace',
      flushhouse_rankB: 'King',
      flushfive_suit: 'Spades',
      flushfive_rank: 'Ace',
      royal_suit: 'Spades'
    };
  }

  validateState() {
    // Clean hand elements: ensure any Card in hand still has a valid representation
    // Ensure selectedForDiscard elements are still present in hand
    const handIds = new Set();
    for (const card of this.hand) {
      if (card) handIds.add(card.id);
    }
    for (const id of this.selectedForDiscard) {
      if (!handIds.has(id)) {
        this.selectedForDiscard.delete(id);
      }
    }
  }

  // --- Stateful Round Progression Mutators ---

  /**
   * Resets baseline configurations to standard 52 and shuffles round.
   */
  resetToStandard() {
    this.baselineDeck = createStandardDeck();
    this.remainingDeck = this.copyDeck(this.baselineDeck);
    this.hand = Array(8).fill(null);
    this.selectedForDiscard.clear();
    this.enabledHands = new Set(['Flush', 'Straight', 'Full House', 'Four of a Kind', 'Two Pair']);
    this.autoDetectTargets = true;
    this.targetParams = this.getDefaultParams();
    this.notify();
  }

  /**
   * Empties baseline deck and clears hand dock.
   */
  clearDeck() {
    this.baselineDeck = [];
    this.remainingDeck = [];
    this.hand = Array(8).fill(null);
    this.selectedForDiscard.clear();
    this.notify();
  }

  /**
   * Performs the round reset: restores remainingDeck to baseline, empties hand.
   */
  resetRound() {
    this.remainingDeck = this.copyDeck(this.baselineDeck);
    this.hand = Array(8).fill(null);
    this.selectedForDiscard.clear();
    this.notify();
  }

  /**
   * Permanently discards selected cards from round.
   */
  executeDiscard() {
    if (this.selectedForDiscard.size === 0) return;

    for (let i = 0; i < 8; i++) {
      const card = this.hand[i];
      if (card && this.selectedForDiscard.has(card.id)) {
        this.hand[i] = null; // Leaves placeholder awaiting input
      }
    }
    this.selectedForDiscard.clear();
    this.notify();
  }

  // --- Grid Configurations ---

  incrementDeckCard(rank, suit) {
    const card = createCard(rank, suit);
    this.baselineDeck.push(card);
    // Also add to remaining deck so the new card is immediately in the round pool
    this.remainingDeck.push({ ...card });
    this.notify();
  }

  decrementDeckCard(rank, suit) {
    // Remove from remaining deck first
    const remIdx = this.remainingDeck.findIndex(c => c.base_rank === rank && c.base_suit === suit);
    if (remIdx !== -1) {
      this.remainingDeck.splice(remIdx, 1);
    } else {
      // If not in remaining deck, it must be held in the hand dock. Remove it.
      const handIdx = this.hand.findIndex(c => c && c.base_rank === rank && c.base_suit === suit);
      if (handIdx !== -1) {
        const cardToRemove = this.hand[handIdx];
        this.hand[handIdx] = null;
        this.selectedForDiscard.delete(cardToRemove.id);
      }
    }

    // Remove from baseline deck
    const baseIdx = this.baselineDeck.findIndex(c => c.base_rank === rank && c.base_suit === suit);
    if (baseIdx !== -1) {
      this.baselineDeck.splice(baseIdx, 1);
    }
    this.notify();
  }

  // --- Card Refills ---

  /**
   * Frictionless refill draw mechanic.
   */
  addCardToHand(rank, suit) {
    const emptyIdx = this.hand.findIndex(c => c === null);
    if (emptyIdx === -1) return; // Hand is already full

    // Look for matching card in remaining deck
    const remIdx = this.remainingDeck.findIndex(c => c.base_rank === rank && c.base_suit === suit);
    let card;

    if (remIdx !== -1) {
      card = this.remainingDeck[remIdx];
      this.remainingDeck.splice(remIdx, 1);
    } else {
      // Auto-increment baseline deck to avoid blockages
      const newCard = createCard(rank, suit);
      this.baselineDeck.push(newCard);
      card = { ...newCard };
    }

    this.hand[emptyIdx] = card;
    this.notify();
  }

  /**
   * Removes card from hand and returns it to the remaining deck.
   */
  removeCardFromHand(cardId) {
    const idx = this.hand.findIndex(c => c && c.id === cardId);
    if (idx !== -1) {
      const card = this.hand[idx];
      this.hand[idx] = null;
      this.selectedForDiscard.delete(cardId);
      this.remainingDeck.push(card);
    }
    this.notify();
  }

  toggleDiscardSelection(cardId) {
    if (this.selectedForDiscard.has(cardId)) {
      this.selectedForDiscard.delete(cardId);
    } else {
      this.selectedForDiscard.add(cardId);
    }
    this.notify();
  }

  toggleHandEnabled(handType) {
    if (this.enabledHands.has(handType)) {
      this.enabledHands.delete(handType);
    } else {
      this.enabledHands.add(handType);
    }
    this.notify();
  }

  updateTargetParams(params) {
    this.targetParams = { ...this.targetParams, ...params };
    this.notify();
  }

  setAutoDetectTargets(value) {
    this.autoDetectTargets = value;
    this.notify();
  }

  // --- Getters ---

  get isHandFull() {
    return this.hand.every(c => c !== null);
  }

  get keptHand() {
    return this.hand.filter(c => c !== null && !this.selectedForDiscard.has(c.id));
  }

  /**
   * Auto-detection from kept card subset.
   */
  detectTargets() {
    const kept = this.keptHand;
    const detected = this.getDefaultParams();

    if (kept.length === 0) {
      return detected;
    }

    // 1. Suit counts
    const suitCounts = {};
    for (const card of kept) {
      suitCounts[card.base_suit] = (suitCounts[card.base_suit] || 0) + 1;
    }
    let maxSuit = 'Spades';
    let maxSuitCount = -1;
    for (const suit of SUITS) {
      if ((suitCounts[suit] || 0) > maxSuitCount) {
        maxSuitCount = suitCounts[suit];
        maxSuit = suit;
      }
    }
    detected.flush_suit = maxSuit;
    detected.flushhouse_suit = maxSuit;
    detected.flushfive_suit = maxSuit;
    
    const highRanksSet = new Set(['10', 'Jack', 'Queen', 'King', 'Ace']);
    const royalSuitCounts = {};
    for (const card of kept) {
      if (highRanksSet.has(card.base_rank)) {
        royalSuitCounts[card.base_suit] = (royalSuitCounts[card.base_suit] || 0) + 1;
      }
    }
    let maxRoyalSuit = 'Spades';
    let maxRoyalSuitCount = -1;
    for (const suit of SUITS) {
      if ((royalSuitCounts[suit] || 0) > maxRoyalSuitCount) {
        maxRoyalSuitCount = royalSuitCounts[suit];
        maxRoyalSuit = suit;
      }
    }
    detected.royal_suit = maxRoyalSuit;

    // 2. Rank counts
    const rankCounts = {};
    for (const card of kept) {
      rankCounts[card.base_rank] = (rankCounts[card.base_rank] || 0) + 1;
    }
    let maxRank = 'Ace';
    let maxRankCount = -1;
    for (const rank of RANKS) {
      if ((rankCounts[rank] || 0) > maxRankCount) {
        maxRankCount = rankCounts[rank];
        maxRank = rank;
      }
    }
    detected.pair_rank = maxRank;
    detected.three_rank = maxRank;
    detected.four_rank = maxRank;
    detected.five_rank = maxRank;

    // 3. Dual rank counts
    const sortedRanksByCount = Object.entries(rankCounts)
      .sort((a, b) => b[1] - a[1]);

    if (sortedRanksByCount.length >= 1) {
      detected.twopair_rankA = sortedRanksByCount[0][0];
      detected.fh_rankA = sortedRanksByCount[0][0];
    }
    if (sortedRanksByCount.length >= 2) {
      detected.twopair_rankB = sortedRanksByCount[1][0];
      detected.fh_rankB = sortedRanksByCount[1][0];
    } else {
      detected.twopair_rankB = detected.twopair_rankA === 'Ace' ? 'King' : 'Ace';
      detected.fh_rankB = detected.fh_rankA === 'Ace' ? 'King' : 'Ace';
    }

    const suitCards = kept.filter(c => c.base_suit === maxSuit);
    const suitRankCounts = {};
    for (const card of suitCards) {
      suitRankCounts[card.base_rank] = (suitRankCounts[card.base_rank] || 0) + 1;
    }
    const sortedSuitRanks = Object.entries(suitRankCounts)
      .sort((a, b) => b[1] - a[1]);

    if (sortedSuitRanks.length >= 1) {
      detected.flushhouse_rankA = sortedSuitRanks[0][0];
      detected.flushfive_rank = sortedSuitRanks[0][0];
    }
    if (sortedSuitRanks.length >= 2) {
      detected.flushhouse_rankB = sortedSuitRanks[1][0];
    } else {
      detected.flushhouse_rankB = detected.flushhouse_rankA === 'Ace' ? 'King' : 'Ace';
    }

    // 4. Straight Range
    const uniqueVals = Array.from(new Set(kept.map(c => RANK_TO_VAL[c.base_rank]))).sort((a, b) => a - b);
    if (uniqueVals.includes(14)) {
      uniqueVals.unshift(1);
    }

    let bestRange = '10-J-Q-K-A';
    let bestCount = -1;

    for (const range of STRAIGHT_RANGES) {
      const rangeSet = new Set(range.vals);
      const count = uniqueVals.filter(v => rangeSet.has(v)).length;
      if (count > bestCount) {
        bestCount = count;
        bestRange = range.label;
      }
    }
    detected.straight_range = bestRange;

    return detected;
  }

  get activeTargets() {
    if (this.autoDetectTargets) {
      return this.detectTargets();
    }
    return this.targetParams;
  }
}
