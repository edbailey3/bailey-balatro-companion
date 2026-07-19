/**
 * State Management & Round Progression for Balatro Tactical Companion (v1.2)
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
      const stored = localStorage.getItem('balatro_companion_state_v1.2');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.baselineDeck = parsed.baselineDeck || createStandardDeck();
        this.remainingDeck = parsed.remainingDeck || this.copyDeck(this.baselineDeck);
        
        this.max_hand_size = parsed.max_hand_size !== undefined ? parsed.max_hand_size : 8;
        this.hand_size_locked = parsed.hand_size_locked !== undefined ? parsed.hand_size_locked : false;
        
        this.hand = parsed.hand || Array(this.max_hand_size).fill(null);
        if (this.hand.length !== this.max_hand_size) {
          if (this.hand.length > this.max_hand_size) {
            this.hand = this.hand.slice(0, this.max_hand_size);
          } else {
            while (this.hand.length < this.max_hand_size) {
              this.hand.push(null);
            }
          }
        }
        
        this.selectedForDiscard = new Set(parsed.selectedForDiscard || []);
        
        // Graveyard pool initialization
        this.graveyard_pool = parsed.graveyard_pool || [];
        this.played_pool = parsed.played_pool || [];
        
        const defaultActive = ['Flush', 'Straight', 'Full House', 'Four of a Kind', 'Two Pair'];
        this.enabledHands = new Set(parsed.enabledHands || defaultActive);
        
        this.targetParams = parsed.targetParams || this.getDefaultParams();
        this.autoDetectTargets = parsed.autoDetectTargets !== undefined ? parsed.autoDetectTargets : true;
        this.app_mode = parsed.app_mode || 'live';
        this.dock_locked = parsed.dock_locked !== undefined ? parsed.dock_locked : false;
        this.validateState();
        return;
      }
    } catch (e) {
      console.error('Failed to load state from localStorage', e);
    }

    // Default Setup
    this.baselineDeck = createStandardDeck();
    this.remainingDeck = this.copyDeck(this.baselineDeck);
    this.max_hand_size = 8;
    this.hand_size_locked = false;
    this.hand = Array(8).fill(null);
    this.selectedForDiscard = new Set();
    this.graveyard_pool = [];
    this.played_pool = [];
    this.enabledHands = new Set(['Flush', 'Straight', 'Full House', 'Four of a Kind', 'Two Pair']);
    this.targetParams = this.getDefaultParams();
    this.autoDetectTargets = true;
    this.app_mode = 'live';
    this.dock_locked = false;
  }

  saveState() {
    try {
      const stateObj = {
        baselineDeck: this.baselineDeck,
        remainingDeck: this.remainingDeck,
        hand: this.hand,
        selectedForDiscard: Array.from(this.selectedForDiscard),
        graveyard_pool: this.graveyard_pool,
        played_pool: this.played_pool,
        max_hand_size: this.max_hand_size,
        hand_size_locked: this.hand_size_locked,
        enabledHands: Array.from(this.enabledHands),
        targetParams: this.targetParams,
        autoDetectTargets: this.autoDetectTargets,
        app_mode: this.app_mode,
        dock_locked: this.dock_locked
      };
      localStorage.setItem('balatro_companion_state_v1.2', JSON.stringify(stateObj));
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

  resetToStandard() {
    this.baselineDeck = createStandardDeck();
    this.remainingDeck = this.copyDeck(this.baselineDeck);
    if (!this.hand_size_locked) {
      this.max_hand_size = 8;
    }
    this.hand = Array(this.max_hand_size).fill(null);
    this.selectedForDiscard.clear();
    this.graveyard_pool = [];
    this.played_pool = [];
    this.dock_locked = false;
    this.enabledHands = new Set(['Flush', 'Straight', 'Full House', 'Four of a Kind', 'Two Pair']);
    this.autoDetectTargets = true;
    this.targetParams = this.getDefaultParams();
    this.notify();
  }

  clearDeck() {
    this.baselineDeck = [];
    this.remainingDeck = [];
    if (!this.hand_size_locked) {
      this.max_hand_size = 8;
    }
    this.hand = Array(this.max_hand_size).fill(null);
    this.selectedForDiscard.clear();
    this.graveyard_pool = [];
    this.played_pool = [];
    this.dock_locked = false;
    this.notify();
  }

  resetRound() {
    this.remainingDeck = this.copyDeck(this.baselineDeck);
    if (!this.hand_size_locked) {
      this.max_hand_size = 8;
    }
    this.hand = Array(this.max_hand_size).fill(null);
    this.selectedForDiscard.clear();
    this.graveyard_pool = [];
    this.played_pool = [];
    this.dock_locked = false;
    this.notify();
  }

  setAppMode(mode) {
    if (mode !== 'live' && mode !== 'practice') return;
    this.app_mode = mode;
    this.hand = Array(this.max_hand_size).fill(null);
    this.selectedForDiscard.clear();
    this.graveyard_pool = [];
    this.played_pool = [];
    this.remainingDeck = this.copyDeck(this.baselineDeck);
    this.dock_locked = false;
    this.notify();
  }

  drawRandomCards(count) {
    if (this.remainingDeck.length === 0) return [];
    const drawn = [];
    const drawCount = Math.min(count, this.remainingDeck.length);
    for (let i = 0; i < drawCount; i++) {
      const randomIndex = Math.floor(Math.random() * this.remainingDeck.length);
      const card = this.remainingDeck.splice(randomIndex, 1)[0];
      drawn.push(card);
    }
    return drawn;
  }

  dealInitialHand() {
    if (this.app_mode !== 'practice') return;
    this.hand = Array(this.max_hand_size).fill(null);
    this.selectedForDiscard.clear();
    this.dock_locked = false;
    
    const drawn = this.drawRandomCards(this.max_hand_size);
    for (let i = 0; i < drawn.length; i++) {
      this.hand[i] = drawn[i];
    }
    this.notify();
  }

  refillHandRandomly() {
    const emptySlotsIndices = [];
    for (let i = 0; i < this.max_hand_size; i++) {
      if (this.hand[i] === null) {
        emptySlotsIndices.push(i);
      }
    }
    
    const needed = emptySlotsIndices.length;
    if (needed === 0) return;
    
    const available = this.remainingDeck.length;
    if (available < needed) {
      this.dock_locked = true;
    }
    
    const toDraw = Math.min(needed, available);
    const drawn = this.drawRandomCards(toDraw);
    
    for (let i = 0; i < drawn.length; i++) {
      const slotIdx = emptySlotsIndices[i];
      this.hand[slotIdx] = drawn[i];
    }
  }

  executeDiscard() {
    if (this.selectedForDiscard.size === 0) return;

    for (let i = 0; i < this.max_hand_size; i++) {
      const card = this.hand[i];
      if (card && this.selectedForDiscard.has(card.id)) {
        this.graveyard_pool.push(card); // Move to graveyard pool
        this.hand[i] = null; // Awaiting refill
      }
    }
    this.selectedForDiscard.clear();
    
    if (this.app_mode === 'practice') {
      this.refillHandRandomly();
    }
    
    this.notify();
  }

  executePlayHand() {
    if (this.selectedForDiscard.size === 0) return;

    for (let i = 0; i < this.max_hand_size; i++) {
      const card = this.hand[i];
      if (card && this.selectedForDiscard.has(card.id)) {
        this.played_pool.push(card); // Move to played pool
        this.hand[i] = null; // Awaiting refill
      }
    }
    this.selectedForDiscard.clear();
    
    if (this.app_mode === 'practice') {
      this.refillHandRandomly();
    }
    
    this.notify();
  }

  // --- Grid Configurations ---

  incrementDeckCard(rank, suit) {
    const card = createCard(rank, suit);
    this.baselineDeck.push(card);
    this.remainingDeck.push({ ...card });
    this.notify();
  }

  decrementDeckCard(rank, suit) {
    const remIdx = this.remainingDeck.findIndex(c => c.base_rank === rank && c.base_suit === suit);
    if (remIdx !== -1) {
      this.remainingDeck.splice(remIdx, 1);
    } else {
      const handIdx = this.hand.findIndex(c => c && c.base_rank === rank && c.base_suit === suit);
      if (handIdx !== -1) {
        const cardToRemove = this.hand[handIdx];
        this.hand[handIdx] = null;
        this.selectedForDiscard.delete(cardToRemove.id);
      } else {
        // If not in hand or remaining, check graveyard
        const graveIdx = this.graveyard_pool.findIndex(c => c.base_rank === rank && c.base_suit === suit);
        if (graveIdx !== -1) {
          this.graveyard_pool.splice(graveIdx, 1);
        } else {
          // If not in graveyard, check played pool
          const playIdx = this.played_pool.findIndex(c => c.base_rank === rank && c.base_suit === suit);
          if (playIdx !== -1) {
            this.played_pool.splice(playIdx, 1);
          }
        }
      }
    }

    const baseIdx = this.baselineDeck.findIndex(c => c.base_rank === rank && c.base_suit === suit);
    if (baseIdx !== -1) {
      this.baselineDeck.splice(baseIdx, 1);
    }
    this.notify();
  }

  // --- Card Refills ---

  /**
   * Refill slot - STRICT remainingDeck check, no auto-increment of baseline here.
   */
  addCardToHand(rank, suit) {
    if (this.app_mode === 'practice') return; // Guard for practice mode
    const emptyIdx = this.hand.findIndex(c => c === null);
    if (emptyIdx === -1) return; // Hand is full

    const remIdx = this.remainingDeck.findIndex(c => c.base_rank === rank && c.base_suit === suit);
    if (remIdx === -1) {
      return; // STRICT BLOCK: Card is not available in the remaining deck!
    }

    const card = this.remainingDeck[remIdx];
    this.remainingDeck.splice(remIdx, 1);
    this.hand[emptyIdx] = card;
    this.notify();
  }

  removeCardFromHand(cardId) {
    if (this.app_mode === 'practice') return; // Guard for practice mode
    const idx = this.hand.findIndex(c => c && c.id === cardId);
    if (idx !== -1) {
      const card = this.hand[idx];
      this.hand[idx] = null;
      this.selectedForDiscard.delete(cardId);
      this.remainingDeck.push(card);
    }
    this.notify();
  }

  setMaxHandSize(newSize) {
    if (newSize < 1 || newSize > 12) return;
    
    const oldSize = this.max_hand_size;
    this.max_hand_size = newSize;

    if (newSize < oldSize) {
      // If hand size is decremented, drop right-most cards from the dock back into the deck pool (N)
      for (let i = oldSize - 1; i >= newSize; i--) {
        if (this.hand[i] !== undefined) {
          const card = this.hand[i];
          if (card !== null) {
            this.remainingDeck.push(card);
            this.selectedForDiscard.delete(card.id);
          }
        }
      }
      this.hand = this.hand.slice(0, newSize);
    } else if (newSize > oldSize) {
      while (this.hand.length < newSize) {
        this.hand.push(null);
      }
    }
    this.notify();
  }

  setHandSizeLocked(value) {
    this.hand_size_locked = value;
    this.notify();
  }

  toggleDiscardSelection(cardId) {
    if (this.dock_locked) return; // Guard for locked dock
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

  detectTargets() {
    const handCards = this.hand.filter(c => c !== null);
    const detected = this.getDefaultParams();

    if (handCards.length === 0) {
      return detected;
    }

    // Identify dominant suit in the hand dock
    let dominantSuit = 'Spades';
    let maxSuitFreq = -1;
    let maxSuitOuts = -1;

    for (const suit of SUITS) {
      const freq = handCards.filter(c => c.base_suit === suit).length;
      const outs = this.remainingDeck.filter(c => c.base_suit === suit).length;

      if (freq > maxSuitFreq) {
        maxSuitFreq = freq;
        maxSuitOuts = outs;
        dominantSuit = suit;
      } else if (freq === maxSuitFreq) {
        if (outs > maxSuitOuts) {
          maxSuitOuts = outs;
          dominantSuit = suit;
        }
      }
    }

    detected.flush_suit = dominantSuit;
    detected.flushhouse_suit = dominantSuit;
    detected.flushfive_suit = dominantSuit;
    
    // royal_suit detection
    const highRanksSet = new Set(['10', 'Jack', 'Queen', 'King', 'Ace']);
    const royalSuitCounts = {};
    for (const card of handCards) {
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
    for (const card of handCards) {
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

    const suitCards = handCards.filter(c => c.base_suit === dominantSuit);
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
    const uniqueVals = Array.from(new Set(handCards.map(c => RANK_TO_VAL[c.base_rank]))).sort((a, b) => a - b);
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
