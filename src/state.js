/**
 * State Management & Outs Identification for Balatro Tactical Companion (v1)
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
  { label: '8-9-10-J-Q', did: 8, vals: [8, 9, 10, 11, 12] },
  { label: '9-10-J-Q-K', vals: [9, 10, 11, 12, 13] },
  { label: '10-J-Q-K-A', vals: [10, 11, 12, 13, 14] }
];

export const ALL_HAND_TYPES = [
  'Flush', 'Straight', 'Full House', 'Four of a Kind', 'Two Pair',
  'High Card', 'Pair', 'Three of a Kind', 'Royal Flush',
  'Five of a Kind', 'Flush House', 'Flush Five'
];

/**
 * Creates a card conformant to the Card Priming State Schema.
 */
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

/**
 * Generates a standard 52-card deck.
 */
export function createStandardDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(createCard(rank, suit));
    }
  }
  return deck;
}

/**
 * Application state store
 */
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
      const stored = localStorage.getItem('balatro_companion_state_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.totalDeck = parsed.totalDeck || createStandardDeck();
        this.hand = parsed.hand || [];
        this.selectedForDiscard = new Set(parsed.selectedForDiscard || []);
        
        // Parallel active hands tracking
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

    // Default Fallback State
    this.totalDeck = createStandardDeck();
    this.hand = [];
    this.selectedForDiscard = new Set();
    this.enabledHands = new Set(['Flush', 'Straight', 'Full House', 'Four of a Kind', 'Two Pair']);
    this.targetParams = this.getDefaultParams();
    this.autoDetectTargets = true;
  }

  saveState() {
    try {
      const stateObj = {
        totalDeck: this.totalDeck,
        hand: this.hand,
        selectedForDiscard: Array.from(this.selectedForDiscard),
        enabledHands: Array.from(this.enabledHands),
        targetParams: this.targetParams,
        autoDetectTargets: this.autoDetectTargets
      };
      localStorage.setItem('balatro_companion_state_v1', JSON.stringify(stateObj));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
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
    const totalDeckIds = new Set(this.totalDeck.map(c => c.id));
    this.hand = this.hand.filter(c => totalDeckIds.has(c.id));
    const handIds = new Set(this.hand.map(c => c.id));
    for (const id of this.selectedForDiscard) {
      if (!handIds.has(id)) {
        this.selectedForDiscard.delete(id);
      }
    }
  }

  // --- State Mutators ---

  resetToStandard() {
    this.totalDeck = createStandardDeck();
    this.hand = [];
    this.selectedForDiscard.clear();
    this.enabledHands = new Set(['Flush', 'Straight', 'Full House', 'Four of a Kind', 'Two Pair']);
    this.autoDetectTargets = true;
    this.targetParams = this.getDefaultParams();
    this.notify();
  }

  clearDeck() {
    this.totalDeck = [];
    this.hand = [];
    this.selectedForDiscard.clear();
    this.notify();
  }

  incrementDeckCard(rank, suit) {
    const card = createCard(rank, suit);
    this.totalDeck.push(card);
    this.notify();
  }

  decrementDeckCard(rank, suit) {
    const handIds = new Set(this.hand.map(c => c.id));
    const deckIdx = this.totalDeck.findIndex(c => c.base_rank === rank && c.base_suit === suit && !handIds.has(c.id));
    
    if (deckIdx !== -1) {
      this.totalDeck.splice(deckIdx, 1);
    } else {
      const anyIdx = this.totalDeck.findIndex(c => c.base_rank === rank && c.base_suit === suit);
      if (anyIdx !== -1) {
        const cardToRemove = this.totalDeck[anyIdx];
        this.totalDeck.splice(anyIdx, 1);
        this.removeCardFromHand(cardToRemove.id);
        return;
      }
    }
    this.notify();
  }

  addCardToHand(rank, suit) {
    if (this.hand.length >= 8) return;
    const handIds = new Set(this.hand.map(c => c.id));
    let availableCard = this.totalDeck.find(c => c.base_rank === rank && c.base_suit === suit && !handIds.has(c.id));

    if (!availableCard) {
      availableCard = createCard(rank, suit);
      this.totalDeck.push(availableCard);
    }

    this.hand.push(availableCard);
    this.notify();
  }

  removeCardFromHand(cardId) {
    this.hand = this.hand.filter(c => c.id !== cardId);
    this.selectedForDiscard.delete(cardId);
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

  // --- Getters & Calculations ---

  get remainingDeck() {
    const handIds = new Set(this.hand.map(c => c.id));
    return this.totalDeck.filter(c => !handIds.has(c.id));
  }

  get keptHand() {
    return this.hand.filter(c => !this.selectedForDiscard.has(c.id));
  }

  /**
   * Performs automatic detection of target ranks and suits for all 12 hand types based on kept cards.
   */
  detectTargets() {
    const kept = this.keptHand;
    const detected = this.getDefaultParams();

    if (kept.length === 0) {
      return detected;
    }

    // 1. Suit counts (Flush, Flush House, Flush Five, Royal Flush)
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
    
    // For Royal Flush, count suit matching high cards (10, J, Q, K, A)
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

    // 2. Rank counts (Pair, Three, Four, Five of a Kind)
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

    // 3. Dual rank counts (Two Pair, Full House, Flush House)
    const sortedRanksByCount = Object.entries(rankCounts)
      .sort((a, b) => b[1] - a[1]); // Sort by count descending

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

    // Among the cards matching the target suit, find ranks
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

    // 4. Straight search (Straight, Straight Flush)
    const uniqueVals = Array.from(new Set(kept.map(c => RANK_TO_VAL[c.base_rank]))).sort((a, b) => a - b);
    if (uniqueVals.includes(14)) {
      uniqueVals.unshift(1); // Low Ace
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
