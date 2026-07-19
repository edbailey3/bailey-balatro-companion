import { AppState, RANK_TO_VAL, VAL_TO_RANK } from './state.js';
import { hypergeometricCdf, multivariateHypergeometricCdf } from './math.js';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];
const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];

const SUIT_SYMBOLS = {
  'Spades': '♠',
  'Hearts': '♥',
  'Diamonds': '♦',
  'Clubs': '♣'
};

// Instantiate core state manager
const state = new AppState();

// DOM References
const matrixGridEl = document.getElementById('matrix-grid');
const handDockEl = document.getElementById('hand-dock');
const resetBtn = document.getElementById('reset-btn');
const clearBtn = document.getElementById('clear-btn');
const autoDetectToggle = document.getElementById('auto-detect-toggle');
const configsControlsEl = document.getElementById('configs-controls');
const oddsPercentageEl = document.getElementById('odds-percentage');
const gaugeProgressEl = document.getElementById('gauge-progress');
const telemetryNEl = document.getElementById('telemetry-N');
const telemetryKEl = document.getElementById('telemetry-K');
const telemetrynEl = document.getElementById('telemetry-n');
const telemetrykEl = document.getElementById('telemetry-k');
const engineStatusEl = document.getElementById('engine-status-text');

// Initialize hand type buttons
const targetToggles = document.querySelectorAll('.target-toggle');

targetToggles.forEach(btn => {
  btn.addEventListener('click', () => {
    targetToggles.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.setTargetHandType(btn.dataset.hand);
  });
});

// Setup actions
resetBtn.addEventListener('click', () => state.resetToStandard());
clearBtn.addEventListener('click', () => state.clearDeck());

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

// Render the 13x4 Deck Inventory Matrix Grid
function renderDeckMatrix() {
  matrixGridEl.innerHTML = '';
  
  // Count existing card instances in state.totalDeck
  const countsMap = {};
  for (const card of state.totalDeck) {
    const key = `${card.base_rank}_${card.base_suit}`;
    countsMap[key] = (countsMap[key] || 0) + 1;
  }

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const key = `${rank}_${suit}`;
      const count = countsMap[key] || 0;

      const cell = document.createElement('div');
      cell.className = `matrix-cell suit-${suit.toLowerCase()}`;
      
      const rankSpan = document.createElement('span');
      rankSpan.className = 'matrix-cell-rank';
      rankSpan.textContent = getRankLabel(rank);

      const suitSpan = document.createElement('span');
      suitSpan.className = 'matrix-cell-suit';
      suitSpan.textContent = SUIT_SYMBOLS[suit];

      cell.appendChild(rankSpan);
      cell.appendChild(suitSpan);

      // Badge showing active count
      const badge = document.createElement('div');
      badge.className = `matrix-cell-count-badge ${count === 0 ? 'zero' : ''}`;
      badge.textContent = `x${count}`;
      cell.appendChild(badge);

      // Adjusters Revealed on Hover
      const adjusters = document.createElement('div');
      adjusters.className = 'matrix-cell-adjusters';

      const container = document.createElement('div');
      container.className = 'matrix-cell-adjusters-container';

      const row = document.createElement('div');
      row.className = 'matrix-cell-adjusters-row';

      const minusBtn = document.createElement('button');
      minusBtn.className = 'adjuster-btn minus-btn';
      minusBtn.textContent = '-';
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
      drawBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.addCardToHand(rank, suit);
      });

      container.appendChild(row);
      container.appendChild(drawBtn);
      adjusters.appendChild(container);
      cell.appendChild(adjusters);

      // Cell click behaves as Draw to Hand Dock
      cell.addEventListener('click', () => {
        state.addCardToHand(rank, suit);
      });

      matrixGridEl.appendChild(cell);
    }
  }
}

// Convert rank strings to standard labels (e.g. Jack -> J, 10 -> 10)
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
    slot.className = 'hand-slot';
    
    if (i < state.hand.length) {
      const card = state.hand[i];
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
      slot.textContent = 'Empty';
    }

    handDockEl.appendChild(slot);
  }
}

// Render the Target Dropdown Config Sub-Selectors
function renderTargetConfigs() {
  configsControlsEl.innerHTML = '';
  const targets = state.activeTargets;
  const isAuto = state.autoDetectTargets;

  if (state.targetHandType === 'Flush') {
    // Suit Selector
    configsControlsEl.appendChild(createDropdownControl(
      'Target Suit', 
      SUITS, 
      targets.targetSuit, 
      isAuto, 
      (val) => state.updateTargetParams({ targetSuit: val })
    ));
  } else if (state.targetHandType === 'Four of a Kind') {
    // Rank Selector
    configsControlsEl.appendChild(createDropdownControl(
      'Target Rank', 
      RANKS, 
      targets.targetRank, 
      isAuto, 
      (val) => state.updateTargetParams({ targetRank: val })
    ));
  } else if (state.targetHandType === 'Full House') {
    // Rank A and Rank B Selectors
    configsControlsEl.appendChild(createDropdownControl(
      'Rank A (Need 3)', 
      RANKS, 
      targets.rankA, 
      isAuto, 
      (val) => {
        if (val === state.targetParams.rankB) {
          // Keep distinct
          const nextB = val === 'Ace' ? 'King' : 'Ace';
          state.updateTargetParams({ rankA: val, rankB: nextB });
        } else {
          state.updateTargetParams({ rankA: val });
        }
      }
    ));
    configsControlsEl.appendChild(createDropdownControl(
      'Rank B (Need 2)', 
      RANKS, 
      targets.rankB, 
      isAuto, 
      (val) => {
        if (val === state.targetParams.rankA) {
          // Keep distinct
          const nextA = val === 'Ace' ? 'King' : 'Ace';
          state.updateTargetParams({ rankB: val, rankA: nextA });
        } else {
          state.updateTargetParams({ rankB: val });
        }
      }
    ));
  } else if (state.targetHandType === 'Straight (Outside)') {
    // Lower Out and Upper Out Selectors
    configsControlsEl.appendChild(createDropdownControl(
      'Lower Out Rank', 
      RANKS, 
      targets.rankLower, 
      isAuto, 
      (val) => state.updateTargetParams({ rankLower: val })
    ));
    configsControlsEl.appendChild(createDropdownControl(
      'Upper Out Rank', 
      RANKS, 
      targets.rankUpper, 
      isAuto, 
      (val) => state.updateTargetParams({ rankUpper: val })
    ));
  } else if (state.targetHandType === 'Straight (Inside)') {
    // Inside Out Selector
    configsControlsEl.appendChild(createDropdownControl(
      'Inside Out Rank', 
      RANKS, 
      targets.rankInside, 
      isAuto, 
      (val) => state.updateTargetParams({ rankInside: val })
    ));
  }
}

// Utility to generate a dropdown selector with proper bindings
function createDropdownControl(label, options, selectedValue, disabled, onChange) {
  const container = document.createElement('div');
  container.className = 'config-control-group';

  const lbl = document.createElement('label');
  lbl.textContent = label;
  if (disabled) lbl.textContent += ' (Auto)';

  const wrapper = document.createElement('div');
  wrapper.className = 'config-select-wrapper';

  const select = document.createElement('select');
  select.className = 'config-select';
  if (disabled) select.disabled = true;

  for (const opt of options) {
    const el = document.createElement('option');
    el.value = opt;
    el.textContent = opt;
    if (opt === selectedValue) {
      el.selected = true;
    }
    select.appendChild(el);
  }

  select.addEventListener('change', (e) => {
    onChange(e.target.value);
  });

  wrapper.appendChild(select);
  container.appendChild(lbl);
  container.appendChild(wrapper);
  return container;
}

// Perform Real-Time Hypergeometric Computations
function runCalculations() {
  const t0 = performance.now();

  const N = state.remainingDeck.length;
  const n = state.selectedForDiscard.size;
  const kept = state.keptHand;
  const remDeck = state.remainingDeck;
  const targets = state.activeTargets;
  const handType = state.targetHandType;

  let K = 0;
  let k = 0;
  let probability = 0;

  // Track telemetry strings (for cases like Full House where K/k are dual values)
  let kDisp = '0';
  let KDisp = '0';

  if (handType === 'Flush') {
    const suit = targets.targetSuit;
    K = remDeck.filter(c => c.base_suit === suit).length;
    const cKeep = kept.filter(c => c.base_suit === suit).length;
    k = Math.max(0, 5 - cKeep);

    probability = hypergeometricCdf(k, N, K, n);
    KDisp = K.toString();
    kDisp = k.toString();

  } else if (handType === 'Four of a Kind') {
    const rank = targets.targetRank;
    K = remDeck.filter(c => c.base_rank === rank).length;
    const cKeep = kept.filter(c => c.base_rank === rank).length;
    k = Math.max(0, 4 - cKeep);

    probability = hypergeometricCdf(k, N, K, n);
    KDisp = K.toString();
    kDisp = k.toString();

  } else if (handType === 'Full House') {
    const rA = targets.rankA;
    const rB = targets.rankB;

    const KA = remDeck.filter(c => c.base_rank === rA).length;
    const KB = remDeck.filter(c => c.base_rank === rB).length;

    const cA = kept.filter(c => c.base_rank === rA).length;
    const cB = kept.filter(c => c.base_rank === rB).length;

    const kA = Math.max(0, 3 - cA);
    const kB = Math.max(0, 2 - cB);

    probability = multivariateHypergeometricCdf(kA, kB, N, KA, KB, n);
    
    // Telemetry representations
    KDisp = `${KA} / ${KB}`;
    kDisp = `${kA} / ${kB}`;

  } else if (handType === 'Straight (Outside)') {
    const rL = targets.rankLower;
    const rU = targets.rankUpper;

    K = remDeck.filter(c => c.base_rank === rL || c.base_rank === rU).length;
    const cKeep = kept.filter(c => c.base_rank === rL || c.base_rank === rU).length;
    k = cKeep >= 1 ? 0 : 1;

    probability = hypergeometricCdf(k, N, K, n);
    KDisp = K.toString();
    kDisp = k.toString();

  } else if (handType === 'Straight (Inside)') {
    const rI = targets.rankInside;

    K = remDeck.filter(c => c.base_rank === rI).length;
    const cKeep = kept.filter(c => c.base_rank === rI).length;
    k = cKeep >= 1 ? 0 : 1;

    probability = hypergeometricCdf(k, N, K, n);
    KDisp = K.toString();
    kDisp = k.toString();
  }

  const t1 = performance.now();
  const latency = t1 - t0;

  // Update odds displays
  updateOddsUI(probability);

  // Update telemetry feed
  telemetryNEl.textContent = N.toString();
  telemetryKEl.textContent = KDisp;
  telemetrynEl.textContent = n.toString();
  telemetrykEl.textContent = kDisp;

  engineStatusEl.textContent = `READY (${latency.toFixed(2)}ms)`;
  
  if (latency > 50) {
    console.warn(`Hypergeometric engine exceeded 50ms latency threshold: ${latency.toFixed(2)}ms`);
    engineStatusEl.style.color = 'var(--neon-red)';
  } else {
    engineStatusEl.style.color = 'var(--neon-blue)';
  }
}

// Update the odds ring gauge and visual percentage representation
function updateOddsUI(probability) {
  const percentText = (probability * 100).toFixed(2) + '%';
  oddsPercentageEl.textContent = percentText;

  // Update progress ring offset
  // Radius is 90. Circumference is 2 * PI * 90 = 565.4867
  const circumference = 2 * Math.PI * 90;
  const offset = circumference - (probability * circumference);
  gaugeProgressEl.style.strokeDashoffset = offset.toString();

  // Color coordinate the percentage font drop shadow depending on odds magnitude
  if (probability > 0.75) {
    oddsPercentageEl.style.textShadow = '0 0 20px rgba(57, 255, 20, 0.4)';
    oddsPercentageEl.style.color = 'var(--neon-green)';
  } else if (probability > 0.4) {
    oddsPercentageEl.style.textShadow = '0 0 20px rgba(0, 229, 255, 0.4)';
    oddsPercentageEl.style.color = 'var(--neon-blue)';
  } else if (probability > 0.15) {
    oddsPercentageEl.style.textShadow = '0 0 20px rgba(255, 215, 0, 0.4)';
    oddsPercentageEl.style.color = 'var(--neon-gold)';
  } else {
    oddsPercentageEl.style.textShadow = '0 0 20px rgba(255, 62, 62, 0.4)';
    oddsPercentageEl.style.color = 'var(--neon-red)';
  }
}

// Sync UI active hand selection button states on reload
function syncHandTypeUI() {
  targetToggles.forEach(btn => {
    if (btn.dataset.hand === state.targetHandType) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (state.autoDetectTargets) {
    autoDetectToggle.classList.add('active');
    autoDetectToggle.textContent = 'ON';
  } else {
    autoDetectToggle.classList.remove('active');
    autoDetectToggle.textContent = 'OFF';
  }
}

// Core subscribe binding to trigger full render loop
state.subscribe((s) => {
  syncHandTypeUI();
  renderDeckMatrix();
  renderHandDock();
  renderTargetConfigs();
  runCalculations();
});
