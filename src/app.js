import { AppState, RANK_TO_VAL, VAL_TO_RANK, STRAIGHT_RANGES, ALL_HAND_TYPES } from './state.js';
import { hypergeometricCdf, calculateMultivariateHypergeometric } from './math.js';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];
const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];

const SUIT_SYMBOLS = {
  'Spades': '♠',
  'Hearts': '♥',
  'Diamonds': '♦',
  'Clubs': '♣'
};

const state = new AppState();

// DOM References
const matrixGridEl = document.getElementById('matrix-grid');
const handDockEl = document.getElementById('hand-dock');
const resetBtn = document.getElementById('reset-btn');
const clearBtn = document.getElementById('clear-btn');
const resetRoundBtn = document.getElementById('reset-round-btn');
const executeDiscardBtn = document.getElementById('execute-discard-btn');
const autoDetectToggle = document.getElementById('auto-detect-toggle');
const chasingMatrixEl = document.getElementById('chasing-matrix');
const globalTelemetryNEl = document.getElementById('global-telemetry-N');
const globalTelemetrynEl = document.getElementById('global-telemetry-n');
const engineStatusEl = document.getElementById('engine-status-text');

// Setup Action Listeners
resetBtn.addEventListener('click', () => state.resetToStandard());
clearBtn.addEventListener('click', () => state.clearDeck());
resetRoundBtn.addEventListener('click', () => state.resetRound());
executeDiscardBtn.addEventListener('click', () => state.executeDiscard());

autoDetectToggle.addEventListener('click', () => {
  const nextValue = !state.autoDetectTargets;
  state.setAutoDetectTargets(nextValue);
  
  if (nextValue) {
    autoDetectToggle.classList.add('active');
    autoDetectToggle.textContent = 'ON';
  } else {
    autoDetectToggle.classList.remove('active');
    autoDetectToggle.textContent = 'OFF';
  }
});

// Render 13x4 Deck Inventory Matrix Grid
function renderDeckMatrix() {
  matrixGridEl.innerHTML = '';
  
  // Count remaining deck instances
  const countsMap = {};
  for (const card of state.remainingDeck) {
    const key = `${card.base_rank}_${card.base_suit}`;
    countsMap[key] = (countsMap[key] || 0) + 1;
  }

  // Count baseline deck configurations
  const baseCountsMap = {};
  for (const card of state.baselineDeck) {
    const key = `${card.base_rank}_${card.base_suit}`;
    baseCountsMap[key] = (baseCountsMap[key] || 0) + 1;
  }

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const key = `${rank}_${suit}`;
      const count = countsMap[key] || 0;
      const baseCount = baseCountsMap[key] || 0;

      const cell = document.createElement('div');
      cell.className = `matrix-cell suit-${suit.toLowerCase()}`;
      if (count === 0) {
        cell.classList.add('disabled');
      }
      
      const rankSpan = document.createElement('span');
      rankSpan.className = 'matrix-cell-rank';
      rankSpan.textContent = getRankLabel(rank);

      const suitSpan = document.createElement('span');
      suitSpan.className = 'matrix-cell-suit';
      suitSpan.textContent = SUIT_SYMBOLS[suit];

      cell.appendChild(rankSpan);
      cell.appendChild(suitSpan);

      const badge = document.createElement('div');
      badge.className = `matrix-cell-count-badge ${count === 0 ? 'zero' : ''}`;
      badge.textContent = `x${count}`;
      cell.appendChild(badge);

      const adjusters = document.createElement('div');
      adjusters.className = 'matrix-cell-adjusters';

      const container = document.createElement('div');
      container.className = 'matrix-cell-adjusters-container';

      const row = document.createElement('div');
      row.className = 'matrix-cell-adjusters-row';

      const minusBtn = document.createElement('button');
      minusBtn.className = 'adjuster-btn minus-btn';
      minusBtn.textContent = '-';
      minusBtn.disabled = (baseCount === 0);
      minusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.decrementDeckCard(rank, suit);
      });

      const plusBtn = document.createElement('button');
      plusBtn.className = 'adjuster-btn plus-btn';
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.incrementDeckCard(rank, suit);
      });

      row.appendChild(minusBtn);
      row.appendChild(plusBtn);

      const drawBtn = document.createElement('button');
      drawBtn.className = 'adjuster-btn draw-btn';
      drawBtn.textContent = 'Draw';
      drawBtn.disabled = (count === 0);
      drawBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (count > 0) {
          state.addCardToHand(rank, suit);
        }
      });

      container.appendChild(row);
      container.appendChild(drawBtn);
      adjusters.appendChild(container);
      cell.appendChild(adjusters);

      cell.addEventListener('click', () => {
        if (count > 0) {
          state.addCardToHand(rank, suit);
        }
      });

      matrixGridEl.appendChild(cell);
    }
  }
}

function getRankLabel(rank) {
  if (rank === 'Jack') return 'J';
  if (rank === 'Queen') return 'Q';
  if (rank === 'King') return 'K';
  if (rank === 'Ace') return 'A';
  return rank;
}

// Render the 8-Slot Hand Dock
function renderHandDock() {
  handDockEl.innerHTML = '';
  
  for (let i = 0; i < 8; i++) {
    const slot = document.createElement('div');
    const card = state.hand[i];
    
    if (card !== null) {
      slot.className = 'hand-slot';
      const isSelected = state.selectedForDiscard.has(card.id);

      const cardEl = document.createElement('div');
      cardEl.className = `hand-card suit-${card.base_suit.toLowerCase()} ${isSelected ? 'selected-discard' : ''}`;
      
      const rankSpan = document.createElement('span');
      rankSpan.className = 'hand-card-rank';
      rankSpan.textContent = getRankLabel(card.base_rank);

      const suitSpan = document.createElement('span');
      suitSpan.className = 'hand-card-suit';
      suitSpan.textContent = SUIT_SYMBOLS[card.base_suit];

      const discardTag = document.createElement('div');
      discardTag.className = 'hand-card-discard-tag';
      discardTag.textContent = 'DISCARD';

      const removeBtn = document.createElement('button');
      removeBtn.className = 'hand-card-remove-btn';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.removeCardFromHand(card.id);
      });

      cardEl.appendChild(rankSpan);
      cardEl.appendChild(suitSpan);
      cardEl.appendChild(discardTag);
      cardEl.appendChild(removeBtn);

      cardEl.addEventListener('click', () => {
        state.toggleDiscardSelection(card.id);
      });

      slot.appendChild(cardEl);
    } else {
      // Highlighted empty placeholder awaiting card input
      slot.className = 'hand-slot awaiting-input';
      slot.textContent = 'Awaiting Refill';
    }

    handDockEl.appendChild(slot);
  }

  // Update Execute Discard Button enable/disable state
  executeDiscardBtn.disabled = (state.selectedForDiscard.size === 0);
}

// Render Chasing Matrix and execute calculations
function renderChasingMatrix() {
  chasingMatrixEl.innerHTML = '';
  const targets = state.activeTargets;
  const isAuto = state.autoDetectTargets;
  const isHandFull = state.isHandFull;

  const N = state.remainingDeck.length;
  const n = state.selectedForDiscard.size;
  const kept = state.keptHand;
  const remDeck = state.remainingDeck;

  const t0 = performance.now();

  for (const handType of ALL_HAND_TYPES) {
    const isEnabled = state.enabledHands.has(handType);
    const row = document.createElement('div');
    
    let KDisp = '0';
    let kDisp = '0';
    let prob = 0;

    // Calculate probabilities if hand is full and enabled
    if (isEnabled && isHandFull) {
      const calcResult = calculateHandOdds(handType, targets, N, n, kept, remDeck);
      prob = calcResult.prob;
      KDisp = calcResult.KDisp;
      kDisp = calcResult.kDisp;
    }

    let probClass = 'prob-none';
    if (isEnabled && isHandFull) {
      if (prob > 0.75) probClass = 'prob-high';
      else if (prob > 0.4) probClass = 'prob-med';
      else if (prob > 0.15) probClass = 'prob-low';
    }

    row.className = `chasing-row ${isEnabled ? 'active' : 'inactive'} ${!isHandFull && isEnabled ? 'awaiting-refill' : ''} ${probClass}`;

    // Column 1: Switch checkbox
    const switchDiv = document.createElement('div');
    switchDiv.className = 'chasing-switch-container';
    
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'chasing-checkbox';
    chk.checked = isEnabled;
    chk.addEventListener('change', () => {
      state.toggleHandEnabled(handType);
    });
    switchDiv.appendChild(chk);
    row.appendChild(switchDiv);

    // Column 2: Hand Name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'chasing-hand-name';
    nameSpan.textContent = handType;
    row.appendChild(nameSpan);

    // Column 3: Config sub-selectors
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'chasing-controls';
    renderRowControls(handType, targets, isAuto, isEnabled, controlsDiv);
    row.appendChild(controlsDiv);

    // Column 4: Progress bar and telemetry info
    const progressWrapper = document.createElement('div');
    progressWrapper.className = 'chasing-progress-wrapper';

    const progressBg = document.createElement('div');
    progressBg.className = 'chasing-progress-bg';

    const progressFill = document.createElement('div');
    progressFill.className = 'chasing-progress-fill';
    if (isEnabled && isHandFull) {
      progressFill.style.width = `${prob * 100}%`;
    }
    progressBg.appendChild(progressFill);

    const statsText = document.createElement('span');
    statsText.className = 'chasing-telemetry-text';
    if (isEnabled) {
      if (isHandFull) {
        statsText.textContent = `N: ${N} | K: ${KDisp} | n: ${n} | k: ${kDisp}`;
      } else {
        statsText.textContent = 'Awaiting Refill...';
      }
    } else {
      statsText.textContent = 'Disabled';
    }

    progressWrapper.appendChild(progressBg);
    progressWrapper.appendChild(statsText);
    row.appendChild(progressWrapper);

    // Column 5: Odds percentage
    const oddsSpan = document.createElement('span');
    oddsSpan.className = 'chasing-odds-percentage';
    if (isEnabled) {
      if (isHandFull) {
        oddsSpan.textContent = `${(prob * 100).toFixed(2)}%`;
      } else {
        oddsSpan.textContent = 'REFILL';
      }
    } else {
      oddsSpan.textContent = '—';
    }
    row.appendChild(oddsSpan);

    chasingMatrixEl.appendChild(row);
  }

  const t1 = performance.now();
  const latency = t1 - t0;

  // Update global telemetry items
  globalTelemetryNEl.textContent = N.toString();
  globalTelemetrynEl.textContent = n.toString();

  if (isHandFull) {
    engineStatusEl.textContent = `READY (${latency.toFixed(2)}ms)`;
    engineStatusEl.style.color = 'var(--neon-blue)';
    if (latency > 50) {
      console.warn(`Hypergeometric engine exceeded latency: ${latency.toFixed(2)}ms`);
      engineStatusEl.style.color = 'var(--neon-red)';
    }
  } else {
    engineStatusEl.textContent = 'AWAITING REFILL';
    engineStatusEl.style.color = 'var(--neon-gold)';
  }
}

// Sub-selectors layout helper
function renderRowControls(handType, targets, isAuto, isEnabled, container) {
  const disabled = isAuto || !isEnabled;

  if (handType === 'Flush' || handType === 'Royal Flush') {
    const key = handType === 'Flush' ? 'flush_suit' : 'royal_suit';
    if (isAuto) {
      container.appendChild(createBadge(targets[key]));
    } else {
      container.appendChild(createMiniSelect(SUITS, targets[key], disabled, (val) => {
        state.updateTargetParams({ [key]: val });
      }));
    }
  } else if (handType === 'Pair' || handType === 'Three of a Kind' || handType === 'Four of a Kind' || handType === 'Five of a Kind') {
    const key = handType === 'Pair' ? 'pair_rank' : (handType === 'Three of a Kind' ? 'three_rank' : (handType === 'Four of a Kind' ? 'four_rank' : 'five_rank'));
    if (isAuto) {
      container.appendChild(createBadge(targets[key]));
    } else {
      container.appendChild(createMiniSelect(RANKS, targets[key], disabled, (val) => {
        state.updateTargetParams({ [key]: val });
      }));
    }
  } else if (handType === 'Two Pair' || handType === 'Full House') {
    const prefix = handType === 'Two Pair' ? 'twopair' : 'fh';
    if (isAuto) {
      container.appendChild(createBadge(targets[`${prefix}_rankA`]));
      container.appendChild(createBadge(targets[`${prefix}_rankB`]));
    } else {
      container.appendChild(createMiniSelect(RANKS, targets[`${prefix}_rankA`], disabled, (val) => {
        if (val === state.targetParams[`${prefix}_rankB`]) {
          const nextB = val === 'Ace' ? 'King' : 'Ace';
          state.updateTargetParams({ [`${prefix}_rankA`]: val, [`${prefix}_rankB`]: nextB });
        } else {
          state.updateTargetParams({ [`${prefix}_rankA`]: val });
        }
      }));
      container.appendChild(createMiniSelect(RANKS, targets[`${prefix}_rankB`], disabled, (val) => {
        if (val === state.targetParams[`${prefix}_rankA`]) {
          const nextA = val === 'Ace' ? 'King' : 'Ace';
          state.updateTargetParams({ [`${prefix}_rankB`]: val, [`${prefix}_rankA`]: nextA });
        } else {
          state.updateTargetParams({ [`${prefix}_rankB`]: val });
        }
      }));
    }
  } else if (handType === 'Straight') {
    const options = STRAIGHT_RANGES.map(r => r.label);
    if (isAuto) {
      container.appendChild(createBadge(targets.straight_range));
    } else {
      container.appendChild(createMiniSelect(options, targets.straight_range, disabled, (val) => {
        state.updateTargetParams({ straight_range: val });
      }));
    }
  } else if (handType === 'Flush House') {
    if (isAuto) {
      container.appendChild(createBadge(targets.flushhouse_suit));
      container.appendChild(createBadge(targets.flushhouse_rankA));
      container.appendChild(createBadge(targets.flushhouse_rankB));
    } else {
      container.appendChild(createMiniSelect(SUITS, targets.flushhouse_suit, disabled, (val) => {
        state.updateTargetParams({ flushhouse_suit: val });
      }));
      container.appendChild(createMiniSelect(RANKS, targets.flushhouse_rankA, disabled, (val) => {
        if (val === state.targetParams.flushhouse_rankB) {
          const nextB = val === 'Ace' ? 'King' : 'Ace';
          state.updateTargetParams({ flushhouse_rankA: val, flushhouse_rankB: nextB });
        } else {
          state.updateTargetParams({ flushhouse_rankA: val });
        }
      }));
      container.appendChild(createMiniSelect(RANKS, targets.flushhouse_rankB, disabled, (val) => {
        if (val === state.targetParams.flushhouse_rankA) {
          const nextA = val === 'Ace' ? 'King' : 'Ace';
          state.updateTargetParams({ flushhouse_rankB: val, flushhouse_rankA: nextA });
        } else {
          state.updateTargetParams({ flushhouse_rankB: val });
        }
      }));
    }
  } else if (handType === 'Flush Five') {
    if (isAuto) {
      container.appendChild(createBadge(targets.flushfive_suit));
      container.appendChild(createBadge(targets.flushfive_rank));
    } else {
      container.appendChild(createMiniSelect(SUITS, targets.flushfive_suit, disabled, (val) => {
        state.updateTargetParams({ flushfive_suit: val });
      }));
      container.appendChild(createMiniSelect(RANKS, targets.flushfive_rank, disabled, (val) => {
        state.updateTargetParams({ flushfive_rank: val });
      }));
    }
  } else {
    container.textContent = 'None';
  }
}

function createBadge(text) {
  const span = document.createElement('span');
  span.className = 'chasing-mini-badge auto';
  span.textContent = text;
  return span;
}

function createMiniSelect(options, selectedVal, disabled, onChange) {
  const sel = document.createElement('select');
  sel.className = 'chasing-mini-select';
  sel.disabled = disabled;
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    if (opt === selectedVal) {
      o.selected = true;
    }
    sel.appendChild(o);
  }
  sel.addEventListener('change', (e) => {
    onChange(e.target.value);
  });
  return sel;
}

function calculateHandOdds(handType, targets, N, n, kept, remDeck) {
  let KDisp = '0';
  let kDisp = '0';
  let prob = 0;

  if (handType === 'High Card') {
    const k = kept.length >= 1 ? 0 : 1;
    const K = N;
    prob = hypergeometricCdf(k, N, K, n);
    KDisp = K.toString();
    kDisp = k.toString();

  } else if (handType === 'Pair') {
    const rank = targets.pair_rank;
    const K = remDeck.filter(c => c.base_rank === rank).length;
    const c = kept.filter(c => c.base_rank === rank).length;
    const k = Math.max(0, 2 - c);
    
    prob = hypergeometricCdf(k, N, K, n);
    KDisp = K.toString();
    kDisp = k.toString();

  } else if (handType === 'Three of a Kind') {
    const rank = targets.three_rank;
    const K = remDeck.filter(c => c.base_rank === rank).length;
    const c = kept.filter(c => c.base_rank === rank).length;
    const k = Math.max(0, 3 - c);
    
    prob = hypergeometricCdf(k, N, K, n);
    KDisp = K.toString();
    kDisp = k.toString();

  } else if (handType === 'Four of a Kind') {
    const rank = targets.four_rank;
    const K = remDeck.filter(c => c.base_rank === rank).length;
    const c = kept.filter(c => c.base_rank === rank).length;
    const k = Math.max(0, 4 - c);
    
    prob = hypergeometricCdf(k, N, K, n);
    KDisp = K.toString();
    kDisp = k.toString();

  } else if (handType === 'Five of a Kind') {
    const rank = targets.five_rank;
    const K = remDeck.filter(c => c.base_rank === rank).length;
    const c = kept.filter(c => c.base_rank === rank).length;
    const k = Math.max(0, 5 - c);
    
    prob = hypergeometricCdf(k, N, K, n);
    KDisp = K.toString();
    kDisp = k.toString();

  } else if (handType === 'Two Pair') {
    const rA = targets.twopair_rankA;
    const rB = targets.twopair_rankB;

    const KA = remDeck.filter(c => c.base_rank === rA).length;
    const KB = remDeck.filter(c => c.base_rank === rB).length;

    const cA = kept.filter(c => c.base_rank === rA).length;
    const cB = kept.filter(c => c.base_rank === rB).length;

    const kA = Math.max(0, 2 - cA);
    const kB = Math.max(0, 2 - cB);

    prob = calculateMultivariateHypergeometric(N, n, [
      { K: KA, k: kA },
      { K: KB, k: kB }
    ]);
    KDisp = `${KA}/${KB}`;
    kDisp = `${kA}/${kB}`;

  } else if (handType === 'Full House') {
    const rA = targets.fh_rankA;
    const rB = targets.fh_rankB;

    const KA = remDeck.filter(c => c.base_rank === rA).length;
    const KB = remDeck.filter(c => c.base_rank === rB).length;

    const cA = kept.filter(c => c.base_rank === rA).length;
    const cB = kept.filter(c => c.base_rank === rB).length;

    const kA = Math.max(0, 3 - cA);
    const kB = Math.max(0, 2 - cB);

    prob = calculateMultivariateHypergeometric(N, n, [
      { K: KA, k: kA },
      { K: KB, k: kB }
    ]);
    KDisp = `${KA}/${KB}`;
    kDisp = `${kA}/${kB}`;

  } else if (handType === 'Flush') {
    const suit = targets.flush_suit;
    const K = remDeck.filter(c => c.base_suit === suit).length;
    const c = kept.filter(c => c.base_suit === suit).length;
    const k = Math.max(0, 5 - c);

    prob = hypergeometricCdf(k, N, K, n);
    KDisp = K.toString();
    kDisp = k.toString();

  } else if (handType === 'Flush House') {
    const suit = targets.flushhouse_suit;
    const rA = targets.flushhouse_rankA;
    const rB = targets.flushhouse_rankB;

    const KA = remDeck.filter(c => c.base_rank === rA && c.base_suit === suit).length;
    const KB = remDeck.filter(c => c.base_rank === rB && c.base_suit === suit).length;

    const cA = kept.filter(c => c.base_rank === rA && c.base_suit === suit).length;
    const cB = kept.filter(c => c.base_rank === rB && c.base_suit === suit).length;

    const kA = Math.max(0, 3 - cA);
    const kB = Math.max(0, 2 - cB);

    prob = calculateMultivariateHypergeometric(N, n, [
      { K: KA, k: kA },
      { K: KB, k: kB }
    ]);
    KDisp = `${KA}/${KB}`;
    kDisp = `${kA}/${kB}`;

  } else if (handType === 'Flush Five') {
    const suit = targets.flushfive_suit;
    const rank = targets.flushfive_rank;

    const K = remDeck.filter(c => c.base_rank === rank && c.base_suit === suit).length;
    const c = kept.filter(c => c.base_rank === rank && c.base_suit === suit).length;
    const k = Math.max(0, 5 - c);

    prob = hypergeometricCdf(k, N, K, n);
    KDisp = K.toString();
    kDisp = k.toString();

  } else if (handType === 'Straight' || handType === 'Straight Flush') {
    const rangeLabel = targets.straight_range;
    const suit = (handType === 'Straight Flush') ? targets.flush_suit : null;
    
    const rangeObj = STRAIGHT_RANGES.find(r => r.label === rangeLabel);
    const rangeVals = rangeObj ? rangeObj.vals : [10, 11, 12, 13, 14];

    const targetArr = [];
    const kVals = [];
    const KVals = [];

    for (const val of rangeVals) {
      const rank = VAL_TO_RANK[val];
      
      let hasCard = false;
      if (suit) {
        hasCard = kept.some(c => c.base_rank === rank && c.base_suit === suit);
      } else {
        hasCard = kept.some(c => c.base_rank === rank);
      }

      const k_c = hasCard ? 0 : 1;
      
      let K_c = 0;
      if (suit) {
        K_c = remDeck.filter(c => c.base_rank === rank && c.base_suit === suit).length;
      } else {
        K_c = remDeck.filter(c => c.base_rank === rank).length;
      }

      targetArr.push({ K: K_c, k: k_c });
      kVals.push(k_c);
      KVals.push(K_c);
    }

    prob = calculateMultivariateHypergeometric(N, n, targetArr);
    KDisp = KVals.join(',');
    kDisp = kVals.join(',');

  } else if (handType === 'Royal Flush') {
    const suit = targets.royal_suit;
    const rangeVals = [10, 11, 12, 13, 14];

    const targetArr = [];
    const kVals = [];
    const KVals = [];

    for (const val of rangeVals) {
      const rank = VAL_TO_RANK[val];
      const hasCard = kept.some(c => c.base_rank === rank && c.base_suit === suit);
      const k_c = hasCard ? 0 : 1;
      
      const K_c = remDeck.filter(c => c.base_rank === rank && c.base_suit === suit).length;

      targetArr.push({ K: K_c, k: k_c });
      kVals.push(k_c);
      KVals.push(K_c);
    }

    prob = calculateMultivariateHypergeometric(N, n, targetArr);
    KDisp = KVals.join(',');
    kDisp = kVals.join(',');
  }

  return { prob, KDisp, kDisp };
}

function syncHeaderUI() {
  if (state.autoDetectTargets) {
    autoDetectToggle.classList.add('active');
    autoDetectToggle.textContent = 'ON';
  } else {
    autoDetectToggle.classList.remove('active');
    autoDetectToggle.textContent = 'OFF';
  }
}

state.subscribe((s) => {
  syncHeaderUI();
  renderDeckMatrix();
  renderHandDock();
  renderChasingMatrix();
});
