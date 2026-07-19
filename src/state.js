/**
 * State Management & Outs Identification for Balatro Tactical Companion
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

  /**
   * Register a state change listener
   */
  subscribe(listener) {
    this.listeners.push(listener);
    // Trigger immediately for initial render
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
      const stored = localStorage.getItem('balatro_companion_state');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.totalDeck = parsed.totalDeck || createStandardDeck();
        this.hand = parsed.hand || [];
        this.selectedForDiscard = new Set(parsed.selectedForDiscard || []);
        this.targetHandType = parsed.targetHandType || 'Flush';
        this.targetParams = parsed.targetParams || {
          targetSuit: 'Spades',
          targetRank: 'Ace',
          rankA: 'Ace',
          rankB: 'King',
          rankLower: '4',
          rankUpper: '9',
          rankInside: '7'
        };
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
    this.targetHandType = 'Flush';
    this.targetParams = {
      targetSuit: 'Spades',
      targetRank: 'Ace',
      rankA: 'Ace',
      rankB: 'King',
      rankLower: '4',
      rankUpper: '9',
      rankInside: '7'
    };
    this.autoDetectTargets = true;
  }

  saveState() {
    try {
      const stateObj = {
        totalDeck: this.totalDeck,
        hand: this.hand,
        selectedForDiscard: Array.from(this.selectedForDiscard),
        targetHandType: this.targetHandType,
        targetParams: this.targetParams,
        autoDetectTargets: this.autoDetectTargets
      };
      localStorage.setItem('balatro_companion_state', JSON.stringify(stateObj));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  validateState() {
    // Ensure all hand cards exist in totalDeck
    const totalDeckIds = new Set(this.totalDeck.map(c => c.id));
    this.hand = this.hand.filter(c => totalDeckIds.has(c.id));

    // Ensure selectedForDiscard only has cards that are actually in hand
    const handIds = new Set(this.hand.map(c => c.id));
    for (const id of this.selectedForDiscard) {
      if (!handIds.has(id)) {
        this.selectedForDiscard.delete(id);
      }
    }
  }

  // --- State Mutators ---

  /**
   * Resets the entire state to standard 52-card deck and empty hand.
   */
  resetToStandard() {
    this.totalDeck = createStandardDeck();
    this.hand = [];
    this.selectedForDiscard.clear();
    this.targetHandType = 'Flush';
    this.autoDetectTargets = true;
    this.targetParams = {
      targetSuit: 'Spades',
      targetRank: 'Ace',
      rankA: 'Ace',
      rankB: 'King',
      rankLower: '4',
      rankUpper: '9',
      rankInside: '7'
    };
    this.notify();
  }

  /**
   * Clears the entire deck and hand.
   */
  clearDeck() {
    this.totalDeck = [];
    this.hand = [];
    this.selectedForDiscard.clear();
    this.notify();
  }

  /**
   * Sets all totalDeck cards to conform to v0 schemas.
   */
  incrementDeckCard(rank, suit) {
    const card = createCard(rank, suit);
    this.totalDeck.push(card);
    this.notify();
  }

  decrementDeckCard(rank, suit) {
    // Find a card of this rank and suit that is NOT currently in hand.
    // If all matching cards are in hand, we must remove it from the hand first, then from deck.
    const handIds = new Set(this.hand.map(c => c.id));
    const deckIdx = this.totalDeck.findIndex(c => c.base_rank === rank && c.base_suit === suit && !handIds.has(c.id));
    
    if (deckIdx !== -1) {
      this.totalDeck.splice(deckIdx, 1);
    } else {
      // If we can't find one that is NOT in hand, see if we can find one that IS in hand.
      const anyIdx = this.totalDeck.findIndex(c => c.base_rank === rank && c.base_suit === suit);
      if (anyIdx !== -1) {
        const cardToRemove = this.totalDeck[anyIdx];
        this.totalDeck.splice(anyIdx, 1);
        this.removeCardFromHand(cardToRemove.id);
        return; // removeCardFromHand already calls notify
      }
    }
    this.notify();
  }

  /**
   * Draws a card of rank/suit into hand dock.
   */
  addCardToHand(rank, suit) {
    if (this.hand.length >= 8) return;

    // Check if there is an available card of this rank/suit in totalDeck that is not in hand.
    const handIds = new Set(this.hand.map(c => c.id));
    let availableCard = this.totalDeck.find(c => c.base_rank === rank && c.base_suit === suit && !handIds.has(c.id));

    if (!availableCard) {
      // If none are available in the deck, automatically add one to the totalDeck.
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

  setTargetHandType(type) {
    this.targetHandType = type;
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
   * Performs automatic detection of target ranks and suits based on the kept hand.
   */
  detectTargets() {
    const kept = this.keptHand;

    // Default fallback params
    const detected = {
      targetSuit: 'Spades',
      targetRank: 'Ace',
      rankA: 'Ace',
      rankB: 'King',
      rankLower: '4',
      rankUpper: '9',
      rankInside: '7'
    };

    if (kept.length === 0) {
      return detected;
    }

    // 1. Flush (Target Suit)
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
    detected.targetSuit = maxSuit;

    // 2. Four of a Kind (Target Rank)
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
    detected.targetRank = maxRank;

    // 3. Full House (Rank A - 3 of, Rank B - 2 of)
    const sortedRanksByCount = Object.entries(rankCounts)
      .sort((a, b) => b[1] - a[1]); // Sort by count descending

    if (sortedRanksByCount.length >= 1) {
      detected.rankA = sortedRanksByCount[0][0];
    }
    if (sortedRanksByCount.length >= 2) {
      detected.rankB = sortedRanksByCount[1][0];
    } else {
      // If we only have 1 rank, choose a different rank for B
      detected.rankB = detected.rankA === 'Ace' ? 'King' : 'Ace';
    }

    // 4. Straight Calculations (Outside & Inside)
    // Map kept unique ranks to values
    const uniqueVals = Array.from(new Set(kept.map(c => RANK_TO_VAL[c.base_rank]))).sort((a, b) => a - b);
    
    // Check if Ace can be low
    if (uniqueVals.includes(14)) {
      uniqueVals.unshift(1); // Add value 1 (Low Ace) at the beginning
    }

    let detectedOutside = false;
    let detectedInside = false;

    // Helper to check if 4 values form an Outside Straight draw (sequential span of 4, both ends open in range [1, 14])
    // Loop through uniqueVals to find 4 consecutive elements
    for (let i = 0; i <= uniqueVals.length - 4; i++) {
      const v1 = uniqueVals[i];
      const v2 = uniqueVals[i+1];
      const v3 = uniqueVals[i+2];
      const v4 = uniqueVals[i+3];

      if (v2 === v1 + 1 && v3 === v1 + 2 && v4 === v1 + 3) {
        // We have 4 sequential elements!
        const lowerVal = v1 - 1;
        const upperVal = v4 + 1;

        if (lowerVal >= 1 && upperVal <= 14) {
          detected.rankLower = VAL_TO_RANK[lowerVal];
          detected.rankUpper = VAL_TO_RANK[upperVal];
          detectedOutside = true;
          break;
        }
      }
    }

    // If outside not detected, default to standard J-Q-K-A outs or similar
    if (!detectedOutside) {
      // Try to find any sequential block of size 3 or 4, or just default.
      detected.rankLower = '4';
      detected.rankUpper = '9';
    }

    // Inside Straight: check for 4 values spanning a range of 5 with 1 missing interior element
    // Or a one-ended straight (e.g. 1-2-3-4 needing 5, or 11-12-13-14 needing 10)
    for (let i = 0; i <= uniqueVals.length - 4; i++) {
      // Check all subsets of size 4
      const subset = uniqueVals.slice(i, i + 4);
      const min = subset[0];
      const max = subset[3];

      if (max - min === 4) {
        // Check which element is missing in the range [min, max]
        const valsSet = new Set(subset);
        for (let v = min + 1; v < max; v++) {
          if (!valsSet.has(v)) {
            detected.rankInside = VAL_TO_RANK[v];
            detectedInside = true;
            break;
          }
        }
      }
      if (detectedInside) break;
    }

    // Check one-ended cases specifically:
    // A-2-3-4 (1, 2, 3, 4) needs 5
    if (!detectedInside) {
      const lowAceStr = new Set([1, 2, 3, 4]);
      if (uniqueVals.filter(v => lowAceStr.has(v)).length === 4) {
        detected.rankInside = '5';
        detectedInside = true;
      }
    }
    // J-Q-K-A (11, 12, 13, 14) needs 10
    if (!detectedInside) {
      const highStr = new Set([11, 12, 13, 14]);
      if (uniqueVals.filter(v => highStr.has(v)).length === 4) {
        detected.rankInside = '10';
        detectedInside = true;
      }
    }

    if (!detectedInside) {
      detected.rankInside = '7';
    }

    return detected;
  }

  /**
   * Retrieves the active targets (either detected or overridden)
   */
  get activeTargets() {
    if (this.autoDetectTargets) {
      return this.detectTargets();
    }
    return this.targetParams;
  }
}
