// ===== MAIN APPLICATION CONTROLLER =====

class App {
  constructor() {
    this.machine = null;
    this.graph = null;
    this.playInterval = null;
    this.speed = 500; // ms per step
    this.isPlaying = false;
    this.currentPresetKey = null;
    this.currentAlgoKey = null;
    this.currentTapeConfig = null;
    this.historyStack = [];
    this.isSandboxMode = false;
    this.complexityDataPoints = []; // {n, steps} for chart
    this.analyticsHistory = []; // persistent across resets: {n, steps, result, algo, tapes, timestamp}
    this._cachedFits = {}; // regression fits per tape count
    this.leftSidebarWidth = this._loadLeftSidebarWidth();
    this.isRightSidebarCollapsed = false;
    this.rightSidebarExpandedWidth = this._loadRightSidebarWidth();

    this._initGraph();
    this._populateAlgorithmDropdown();
    this._bindEvents();
    this._applyLeftSidebarWidth(this.leftSidebarWidth, false);
    this._applyRightSidebarWidth(this.rightSidebarExpandedWidth, false);
    this._loadAlgorithm('palindrome');
  }

  _initGraph() {
    this.graph = new GraphVisualization('graph-container');
  }

  // ===== DYNAMIC ALGORITHM DROPDOWN WITH OPTGROUPS =====
  _populateAlgorithmDropdown() {
    const select = document.getElementById('algo-select');
    select.innerHTML = '';

    ALGORITHM_CATEGORIES.forEach(cat => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = cat.label;
      cat.algorithms.forEach(algoKey => {
        const algoData = ALGORITHM_MAP[algoKey];
        if (!algoData) return;
        const opt = document.createElement('option');
        opt.value = algoKey;
        opt.textContent = algoData.name;
        optgroup.appendChild(opt);
      });
      select.appendChild(optgroup);
    });
  }

  // ===== ALGORITHM & PRESET LOADING =====
  _loadAlgorithm(algoKey) {
    const previousAlgoKey = this.currentAlgoKey;
    this.currentAlgoKey = algoKey;
    const algoData = ALGORITHM_MAP[algoKey];
    if (!algoData) return;

    if (previousAlgoKey && previousAlgoKey !== algoKey) {
      this._resetAnalyticsForAlgorithmChange();
    }

    document.getElementById('algo-select').value = algoKey;

    this.isSandboxMode = !!algoData.isSandbox;

    // Update complexity info card
    this._updateComplexityCard(algoData);

    // Update context-aware input labels
    this._updateInputLabels(algoData);

    // Show/hide sandbox-specific UI
    this._toggleSandboxUI(this.isSandboxMode);

    // Update both tape-count inputs with the default tape count
    const tapeCountEl = document.getElementById('tape-count');
    const playgroundTapeCountEl = document.getElementById('playground-tape-count');
    const defaultConfig = algoData.tapes[algoData.tapes.length - 1];

    // Populate the tape count dropdown with valid options for this algorithm
    if (!this.isSandboxMode) {
      tapeCountEl.innerHTML = '';
      algoData.tapes.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.count;
        opt.textContent = t.count === 1 ? '1 Tape' : `${t.count} Tapes`;
        if (t.count === defaultConfig.count) opt.selected = true;
        tapeCountEl.appendChild(opt);
      });
    } else {
      tapeCountEl.innerHTML = '';
      for (let i = 1; i <= 4; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i === 1 ? '1 Tape' : `${i} Tapes`;
        if (i === defaultConfig.count) opt.selected = true;
        tapeCountEl.appendChild(opt);
      }
    }
    tapeCountEl.value = defaultConfig.count;
    if (playgroundTapeCountEl) playgroundTapeCountEl.value = defaultConfig.count;

    this._onTapeChange(parseInt(tapeCountEl.value));
  }

  _resetAnalyticsForAlgorithmChange() {
    this.analyticsHistory = [];
    this.complexityDataPoints = [];
    this._cachedFits = {};
    this._cachedFit = null;
    this._renderAnalyticsHistory();
    this._renderAnalyticsChart();
  }

  _setRightSidebarCollapsed(collapsed) {
    this.isRightSidebarCollapsed = !!collapsed;
    const sidebar = document.getElementById('right-sidebar');
    const icon = document.getElementById('right-sidebar-collapse-icon');
    if (!sidebar) return;

    if (this.isRightSidebarCollapsed) {
      const currentWidth = parseInt(sidebar.style.width, 10) || sidebar.getBoundingClientRect().width || this.rightSidebarExpandedWidth;
      this.rightSidebarExpandedWidth = currentWidth;
    }

    sidebar.classList.toggle('right-sidebar-collapsed', this.isRightSidebarCollapsed);
    if (icon) {
      icon.textContent = this.isRightSidebarCollapsed
        ? 'keyboard_double_arrow_left'
        : 'keyboard_double_arrow_right';
    }

    if (this.isRightSidebarCollapsed) {
      sidebar.style.width = '42px';
      sidebar.style.minWidth = '42px';
      sidebar.style.maxWidth = '42px';
      sidebar.style.overflow = 'hidden';
    } else {
      sidebar.style.maxWidth = '';
      sidebar.style.overflow = '';
      this._applyRightSidebarWidth(this.rightSidebarExpandedWidth, false);
    }
  }

  _loadRightSidebarWidth() {
    try {
      const saved = window.localStorage.getItem('turing-atheneum-right-sidebar-width');
      const parsed = saved ? parseInt(saved, 10) : NaN;
      return Number.isFinite(parsed) ? parsed : 340;
    } catch {
      return 340;
    }
  }

  _loadLeftSidebarWidth() {
    try {
      const saved = window.localStorage.getItem('turing-atheneum-left-sidebar-width');
      const parsed = saved ? parseInt(saved, 10) : NaN;
      return Number.isFinite(parsed) ? parsed : 275;
    } catch {
      return 275;
    }
  }

  _saveLeftSidebarWidth(width) {
    try {
      window.localStorage.setItem('turing-atheneum-left-sidebar-width', String(width));
    } catch {
      // ignore storage errors
    }
  }

  _clampLeftSidebarWidth(width) {
    const minWidth = 220;
    const maxWidth = 420;
    return Math.max(minWidth, Math.min(maxWidth, Math.round(width)));
  }

  _applyLeftSidebarWidth(width, persist = true) {
    const sidebar = document.querySelector('.left-sidebar');
    if (!sidebar) return;

    const clampedWidth = this._clampLeftSidebarWidth(width);
    this.leftSidebarWidth = clampedWidth;
    sidebar.style.width = `${clampedWidth}px`;
    sidebar.style.minWidth = `${clampedWidth}px`;

    if (persist) {
      this._saveLeftSidebarWidth(clampedWidth);
    }
  }

  _saveRightSidebarWidth(width) {
    try {
      window.localStorage.setItem('turing-atheneum-right-sidebar-width', String(width));
    } catch {
      // ignore storage errors
    }
  }

  _clampRightSidebarWidth(width) {
    const minWidth = 280;
    const maxWidth = 620;
    return Math.max(minWidth, Math.min(maxWidth, Math.round(width)));
  }

  _applyRightSidebarWidth(width, persist = true) {
    const sidebar = document.getElementById('right-sidebar');
    if (!sidebar) return;

    const clampedWidth = this._clampRightSidebarWidth(width);
    this.rightSidebarExpandedWidth = clampedWidth;

    if (!this.isRightSidebarCollapsed) {
      sidebar.style.width = `${clampedWidth}px`;
      sidebar.style.minWidth = `${clampedWidth}px`;
    }

    if (persist) {
      this._saveRightSidebarWidth(clampedWidth);
    }
  }

  _onTapeChange(count) {
    if (count < 1) count = 1;
    const algoData = ALGORITHM_MAP[this.currentAlgoKey];
    let tapeConfig = algoData.tapes.find(t => t.count === count);

    // For sandbox or if no exact match, generate a dynamic config
    if (!tapeConfig && this.isSandboxMode) {
      tapeConfig = {
        count,
        presetKey: `sandbox-${count}tape`,
        timeComplexity: 'Custom',
        tcExplanation: `Custom ${count}-tape Turing Machine`
      };
      // Dynamically generate a sandbox preset if it doesn't exist
      if (!PRESETS[tapeConfig.presetKey]) {
        PRESETS[tapeConfig.presetKey] = {
          name: `Research Laboratory (${count}-Tape)`,
          description: `A blank ${count}-tape Turing Machine. Define your own transition function δ.`,
          numTapes: count,
          timeComplexity: 'Custom',
          inputAlphabet: ['0', '1'],
          tapeAlphabet: ['0', '1', 'X', 'B'],
          blankSymbol: 'B',
          states: ['q0', 'q_acc', 'q_rej'],
          initialState: 'q0',
          acceptStates: ['q_acc'],
          rejectStates: ['q_rej'],
          defaultInput: '',
          isSandbox: true,
          stateDescriptions: {
            'q0': 'Initial state — define your transitions',
            'q_acc': 'Accept state',
            'q_rej': 'Reject state'
          },
          transitions: []
        };
      }
    } else if (!tapeConfig) {
      // Non-sandbox: clamp to closest valid tape config
      const sorted = [...algoData.tapes].sort((a, b) => Math.abs(a.count - count) - Math.abs(b.count - count));
      tapeConfig = sorted[0];
    }

    // Sync both UI inputs
    const tapeSelect = document.getElementById('tape-count');
    tapeSelect.value = tapeConfig.count;
    if (document.getElementById('playground-tape-count')) {
      document.getElementById('playground-tape-count').value = tapeConfig.count;
    }

    this.currentTapeConfig = tapeConfig;
    this._updateComplexityDisplay(tapeConfig, algoData);
    this._updateEfficiencyBadge(tapeConfig, algoData);
    this._updateTopologyLabel(tapeConfig, algoData);
    this._loadPreset(tapeConfig.presetKey);
  }

  // ===== CONTEXT-AWARE INPUT LABELS =====
  _updateInputLabels(algoData) {
    const tape1Label = document.getElementById('tape1-label');
    const tape2Label = document.getElementById('tape2-label');

    if (tape1Label) {
      tape1Label.textContent = algoData.inputLabels?.tape1 || 'Tape 1 Input';
    }
    if (tape2Label) {
      tape2Label.textContent = algoData.inputLabels?.tape2 || 'Tape 2 Input (optional)';
    }
  }

  // ===== COMPLEXITY INFO CARD =====
  _updateComplexityCard(algoData) {
    const card = document.getElementById('complexity-card');
    const summaryEl = document.getElementById('complexity-card-summary');
    const benefitTextEl = document.getElementById('complexity-card-benefit-text');
    const benefitEl = document.getElementById('complexity-card-benefit');

    if (!card) return;

    if (algoData.complexityCard) {
      card.classList.remove('hidden');
      summaryEl.textContent = algoData.complexityCard.summary;
      benefitTextEl.textContent = algoData.complexityCard.benefit;
      benefitEl.style.display = 'flex';
    } else {
      card.classList.add('hidden');
    }
  }

  // ===== TIME COMPLEXITY & EFFICIENCY BADGE =====
  _updateComplexityDisplay(tapeConfig, algoData) {
    const tcEl = document.getElementById('machine-tc');
    const explanationEl = document.getElementById('tc-explanation');

    if (tcEl) {
      tcEl.textContent = `Time Complexity: ${tapeConfig.timeComplexity}`;
      tcEl.style.display = 'block';
    }
    if (explanationEl && tapeConfig.tcExplanation) {
      explanationEl.textContent = tapeConfig.tcExplanation;
      explanationEl.style.display = 'block';
    } else if (explanationEl) {
      explanationEl.style.display = 'none';
    }
  }

  _updateEfficiencyBadge(tapeConfig, algoData) {
    const badge = document.getElementById('efficiency-badge');
    const badgeText = document.getElementById('efficiency-badge-text');
    if (!badge || !badgeText) return;

    if (algoData.tapes.length <= 1) {
      badge.classList.add('hidden');
      return;
    }

    const worstTC = algoData.tapes[0].timeComplexity;
    const currentTC = tapeConfig.timeComplexity;

    if (worstTC === 'O(n²)' && currentTC === 'O(n)') {
      badge.classList.remove('hidden');
      badgeText.textContent = 'Quadratic Speedup Achieved!';
      badge.className = 'efficiency-badge efficiency-badge-quadratic';
    } else if (worstTC !== currentTC) {
      badge.classList.remove('hidden');
      badgeText.textContent = 'Improved Efficiency!';
      badge.className = 'efficiency-badge efficiency-badge-improved';
    } else {
      const bestTC = algoData.tapes[algoData.tapes.length - 1].timeComplexity;
      if (bestTC !== currentTC && algoData.tapes.length > 1) {
        badge.classList.remove('hidden');
        badgeText.textContent = 'Faster option available ↓';
        badge.className = 'efficiency-badge efficiency-badge-hint';
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  _updateTopologyLabel(tapeConfig, algoData) {
    const topologyEl = document.getElementById('graph-topology');
    if (!topologyEl) return;

    if (algoData.isMultiHead) {
      topologyEl.textContent = `Automaton Topology: Multi-Head (1 Tape, ${tapeConfig.heads || 2} Heads)`;
    } else if (tapeConfig.count === 1) {
      topologyEl.textContent = 'Automaton Topology: Single-Tape';
    } else {
      topologyEl.textContent = `Automaton Topology: ${tapeConfig.count}-Tape`;
    }
  }

  _loadPreset(key) {
    this.currentPresetKey = key;
    this._cachedFit = null; // Reset regression for new preset
    const preset = PRESETS[key];
    if (!preset) return;

    this.stop();
    this.machine = new TuringMachine(preset);

    const algoData = ALGORITHM_MAP[this.currentAlgoKey];

    // Update UI
    document.getElementById('machine-title').textContent = preset.name;
    document.getElementById('machine-desc').textContent = preset.description;

    // Guide Card logic
    const guideCard = document.getElementById('guide-card');
    const guideText = document.getElementById('guide-card-text');
    if (preset.guideText) {
      guideText.innerHTML = preset.guideText;
      guideCard.style.display = 'block';
    } else {
      guideCard.style.display = 'none';
    }

    // Handle dynamic tape input fields
    this._buildDynamicTapeInputs(preset, algoData);

    // Update editor hint for sandbox
    if (this.isSandboxMode) {
      const hintEl = document.getElementById('editor-tape-count');
      if (hintEl) hintEl.textContent = preset.numTapes;
      this._updateEditorHint(preset.numTapes);
      this._renderEditorRulesList();
      this._renderEditorStatesList();
      this._buildHeadStartInputs(preset.numTapes);
      this._buildWorkbenchTapeInputs(preset.numTapes);
      this._updateWorkbenchSteps(preset.numTapes);
    }

    this._resetMachine();
    this._buildRuleTable();
    this._updateStateInfo();
  }

  // ===== DYNAMIC TAPE INPUT FIELDS =====
  _buildDynamicTapeInputs(preset, algoData) {
    const container = document.getElementById('dynamic-tape-inputs');
    if (!container) return;
    container.innerHTML = '';

    // Prevent duplicate tape rendering conflicting with the Workbench logic
    if (this.isSandboxMode) {
      container.style.display = 'none';
      return;
    }
    
    container.style.display = 'block';

    const numTapes = preset.numTapes;

    for (let t = 0; t < numTapes; t++) {
      const group = document.createElement('div');
      group.className = 'config-group';

      const label = document.createElement('label');
      label.className = 'config-label';
      label.setAttribute('for', `tape-input-${t}`);

      // Use algo-specific labels for tape 1 and 2 if available
      if (t === 0 && algoData?.inputLabels?.tape1) {
        label.textContent = algoData.inputLabels.tape1;
      } else if (t === 1 && algoData?.inputLabels?.tape2) {
        label.textContent = algoData.inputLabels.tape2;
      } else {
        label.textContent = `Tape ${t + 1} Input`;
      }

      const input = document.createElement('input');
      input.className = 'config-input';
      input.id = `tape-input-${t}`;
      input.type = 'text';
      input.spellcheck = false;

      input.addEventListener('input', (e) => {
        if (this.machine && typeof this.machine.setTape === 'function') {
          this.machine.setTape(t, e.target.value);
          this._renderTapes();
          this._clearTrace();
          this._updateControls();
          this._updateStateInfo();
          this._updateStats();
        }
      });

      // Set default values
      if (t === 0) {
        input.value = preset.defaultInput || '';
        input.placeholder = 'e.g. 10101';
      } else if (t === 1 && preset.tape2Init) {
        input.value = preset.tape2Init;
        input.placeholder = 'Enter value';
      } else {
        input.value = '';
        input.placeholder = 'Leave blank for empty';
      }

      // Hide tape2 input if it's a disabled/work tape
      if (t === 1 && algoData?.tape2Disabled) {
        group.style.display = 'none';
      }
      // Hide tapes beyond 2 if tape2Disabled (work tapes)
      if (t >= 2 && algoData?.tape2Disabled) {
        group.style.display = 'none';
      }

      // Enter key triggers reset
      input.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') this.reset();
      });

      group.appendChild(label);
      group.appendChild(input);
      container.appendChild(group);
    }
  }

  _resetMachine() {
    const numTapes = this.machine.config.numTapes;
    const algoData = ALGORITHM_MAP[this.currentAlgoKey];

    // Collect all tape inputs from dynamic fields
    const tapeInputs = [];
    for (let t = 0; t < numTapes; t++) {
      const el = document.getElementById(`tape-input-${t}`);
      tapeInputs.push(el ? el.value : '');
    }

    // Explicitly purge tape 2 input if it's considered disabled/work tape
    if (algoData && algoData.tape2Disabled && tapeInputs.length > 1) {
      tapeInputs[1] = '';
    }

    // Substring Search: build combined tape with § delimiter
    if (this.currentPresetKey === 'substring-search-multihead') {
      const fullInput = tapeInputs[0] + '§' + (tapeInputs[1] || '');
      this.machine.reset([fullInput, '']);
      this.historyStack = [];
      this.machine.heads[0] = 1;
      this.machine.heads[1] = 1;

    // Synchronized Parity: H2 at last character
    } else if (this.currentPresetKey === 'sync-parity-multihead') {
      this.machine.reset(tapeInputs);
      this.historyStack = [];
      this.machine.heads[0] = 1;
      this.machine.heads[1] = Math.max(1, tapeInputs[0].length);

    // All other algorithms: standard reset
    } else {
      this.machine.reset(tapeInputs);
      this.historyStack = [];
    }

    // Apply custom head starting positions (playground mode)
    if (this.isSandboxMode) {
      for (let t = 0; t < numTapes; t++) {
        const headEl = document.getElementById(`head-start-${t}`);
        if (headEl) {
          const startPos = parseInt(headEl.value, 10) || 0;
          this.machine.heads[t] = startPos + 1; // +1 for leading blank cell
        }
      }
    }

    // Record starting data point for complexity chart
    this.complexityDataPoints = [];
    this._recordChartPoint();

    this.graph.buildGraph(this.machine);
    this._renderTapes();
    this._clearTrace();
    this._updateControls();
    this._updateStateInfo();
    this._updateStats();
    this._updateAnalytics();
    this._renderAnalyticsChart();
  }

  // ===== TAPE RENDERING =====
  _renderTapes() {
    const container = document.getElementById('tape-container');
    container.innerHTML = '';

    const state = this.machine.getState();
    const nodeEl = document.getElementById('current-node-display');
    if (nodeEl) nodeEl.textContent = state.currentState;
    const numTapes = this.machine.config.numTapes;
    const isMultiHead = this.machine.config.isMultiHead || false;
    const loopTapes = isMultiHead ? 1 : numTapes;

    for (let t = 0; t < loopTapes; t++) {
      const tape = state.tapes[t];

      const tapeRow = document.createElement('div');
      tapeRow.className = 'tape-row';

      // Tape label
      const label = document.createElement('span');
      label.className = 'tape-label';
      label.textContent = isMultiHead ? `TAPE` : `T${t + 1}`;
      tapeRow.appendChild(label);

      // Tape cells container
      const cellsWrapper = document.createElement('div');
      cellsWrapper.className = 'tape-cells-wrapper';

      const cellsContainer = document.createElement('div');
      cellsContainer.className = 'tape-cells';
      cellsContainer.id = `tape-cells-${t}`;

      for (let i = 0; i < tape.length; i++) {
        const cell = document.createElement('div');
        cell.className = 'tape-cell';

        const activeHeads = [];
        if (isMultiHead) {
          state.heads.forEach((pos, idx) => {
            if (pos === i) activeHeads.push(idx);
          });
        } else {
          if (state.heads[t] === i) activeHeads.push(t);
        }

        if (activeHeads.length > 0) {
          cell.classList.add('tape-cell-active');
        } else if (tape[i] === this.machine.config.blankSymbol) {
          cell.classList.add('tape-cell-blank');
        }

        const symbolSpan = document.createElement('span');
        symbolSpan.className = 'tape-symbol';
        // Display □ for blank symbol in UI
        symbolSpan.textContent = tape[i] === this.machine.config.blankSymbol ? '□' : tape[i];
        cell.appendChild(symbolSpan);

        activeHeads.forEach(headIdx => {
          const headIndicator = document.createElement('div');
          headIndicator.className = 'tape-head-indicator';
          if (isMultiHead) headIndicator.classList.add(`head-idx-${headIdx}`);
          cell.appendChild(headIndicator);

          const headLabel = document.createElement('div');
          headLabel.className = 'tape-head-label tape-head-pulse';
          if (isMultiHead) {
            headLabel.textContent = `▲ H${headIdx + 1}`;
            headLabel.classList.add(`head-label-${headIdx}`);
          } else {
            headLabel.textContent = '▲ HEAD';
          }
          cell.appendChild(headLabel);
        });

        cellsContainer.appendChild(cell);
      }

      cellsWrapper.appendChild(cellsContainer);
      tapeRow.appendChild(cellsWrapper);
      container.appendChild(tapeRow);

      requestAnimationFrame(() => {
        const activeCell = cellsContainer.querySelector('.tape-cell-active');
        if (activeCell) {
          const wrapperRect = cellsWrapper.getBoundingClientRect();
          const cellRect = activeCell.getBoundingClientRect();
          const targetScroll = activeCell.offsetLeft - (wrapperRect.width / 2) + (cellRect.width / 2);
          cellsWrapper.scrollTo({ left: targetScroll, behavior: 'smooth' });
        }
      });
    }
  }

  // ===== ENHANCED EXECUTION TRACE (Linz δ notation) =====
  _addTraceEntry(result) {
    const traceContainer = document.getElementById('trace-entries');

    const entry = document.createElement('div');
    entry.className = 'trace-entry';
    if (result.event === 'ACCEPTED') entry.classList.add('trace-accept');
    if (result.event === 'REJECTED' || result.event === 'HALT_NO_TRANSITION') entry.classList.add('trace-reject');

    const header = document.createElement('div');
    header.className = 'trace-header';

    const stepBadge = document.createElement('span');
    stepBadge.className = 'trace-step';
    stepBadge.textContent = `Step ${result.step}`;

    const stateBadge = document.createElement('span');
    stateBadge.className = 'trace-state';
    stateBadge.textContent = result.fromState + (result.toState ? ` → ${result.toState}` : '');

    header.appendChild(stepBadge);
    header.appendChild(stateBadge);
    entry.appendChild(header);

    // Formal δ notation summary line
    if (result.transition) {
      const deltaDiv = document.createElement('div');
      deltaDiv.className = 'trace-delta';
      deltaDiv.textContent = this.machine.formatLinzDelta(result.transition);
      entry.appendChild(deltaDiv);
    }

    // Enhanced descriptive summary line
    if (result.transition) {
      const summaryDiv = document.createElement('div');
      summaryDiv.className = 'trace-summary';
      summaryDiv.innerHTML = this._buildTraceSummary(result);
      entry.appendChild(summaryDiv);
    }

    // Transition details
    if (result.transition) {
      const details = document.createElement('div');
      details.className = 'trace-details';
      const isMultiHead = this.machine.config.isMultiHead || false;

      for (let i = 0; i < result.readSymbols.length; i++) {
        const tapeLine = document.createElement('div');
        tapeLine.className = 'trace-tape-line';

        const sym = (s) => s === this.machine.config.blankSymbol ? '□' : s;
        const moveWord = result.movements[i] === 'R' ? 'Right' : (result.movements[i] === 'L' ? 'Left' : 'Stay');
        const labelPrefix = isMultiHead ? `H${i + 1}` : `T${i + 1}`;
        tapeLine.innerHTML = `<span class="trace-tape-label">${labelPrefix}:</span> Read <span class="trace-highlight">${sym(result.readSymbols[i])}</span> → Write <span class="trace-highlight">${sym(result.writeSymbols[i])}</span>, Move <span class="trace-move">${moveWord}</span>`;
        details.appendChild(tapeLine);
      }

      entry.appendChild(details);

      // Rule used — formal δ notation
      const rule = document.createElement('div');
      rule.className = 'trace-rule';
      rule.innerHTML = `<span class="material-symbols-outlined" style="font-size:12px">rule</span> ${this.machine.formatLinzDelta(result.transition)}`;
      entry.appendChild(rule);
    }

    // Event badges
    if (result.event === 'ACCEPTED') {
      const badge = document.createElement('div');
      badge.className = 'trace-event-badge trace-event-accept';
      badge.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">check_circle</span> ACCEPTED';
      entry.appendChild(badge);
    } else if (result.event === 'REJECTED') {
      const badge = document.createElement('div');
      badge.className = 'trace-event-badge trace-event-reject';
      badge.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">cancel</span> REJECTED';
      entry.appendChild(badge);
    } else if (result.event === 'HALT_NO_TRANSITION') {
      const badge = document.createElement('div');
      badge.className = 'trace-event-badge trace-event-reject';
      badge.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">error</span> HALTED — No δ transition defined';
      entry.appendChild(badge);
    }

    traceContainer.insertBefore(entry, traceContainer.firstChild);
    traceContainer.scrollTop = 0;
  }

  // Build a human-readable summary for each trace step
  _buildTraceSummary(result) {
    const isMultiHead = this.machine.config.isMultiHead || false;
    const sym = (s) => s === this.machine.config.blankSymbol ? '□' : s;
    const parts = [];

    // State description
    parts.push(`<span class="trace-summary-state">State ${result.fromState}</span>`);

    // Read summary
    const readParts = [];
    for (let i = 0; i < result.readSymbols.length; i++) {
      const label = isMultiHead ? `Head ${String.fromCharCode(65 + i)}` : `T${i + 1}`;
      readParts.push(`${label} found <span class="trace-highlight">${sym(result.readSymbols[i])}</span>`);
    }
    parts.push(readParts.join(', '));

    // Write summary (only show if something actually changed)
    const writeParts = [];
    for (let i = 0; i < result.writeSymbols.length; i++) {
      if (result.writeSymbols[i] !== result.readSymbols[i]) {
        const label = isMultiHead ? `Head ${String.fromCharCode(65 + i)}` : `Tape ${i + 1}`;
        writeParts.push(`Writing <span class="trace-highlight">${sym(result.writeSymbols[i])}</span> to ${label}`);
      }
    }
    if (writeParts.length > 0) {
      parts.push(writeParts.join('. ') + '.');
    }

    return parts.join(': ');
  }

  _clearTrace() {
    document.getElementById('trace-entries').innerHTML = `
      <div class="trace-init">
        <span class="material-symbols-outlined" style="font-size:16px;color:#10b981">play_circle</span>
        <span>Ready to simulate. Press <strong>Step</strong> or <strong>Play</strong> to begin.</span>
      </div>
    `;
  }

  // ===== RULE TABLE (Linz δ notation — single column) =====
  _buildRuleTable() {
    const tbody = document.getElementById('rule-table-body');
    tbody.innerHTML = '';

    const transitions = this.machine.config.transitions;

    transitions.forEach((t, index) => {
      const row = document.createElement('tr');
      row.className = 'rule-row';
      row.id = `rule-${index}`;

      const deltaCell = document.createElement('td');
      deltaCell.className = 'rule-cell rule-cell-delta';
      deltaCell.textContent = this.machine.formatLinzDelta(t);

      row.appendChild(deltaCell);
      tbody.appendChild(row);
    });
  }

  _highlightRule(transition) {
    document.querySelectorAll('.rule-row').forEach(r => r.classList.remove('rule-active'));
    if (!transition) return;
    const transitions = this.machine.config.transitions;
    const index = transitions.indexOf(transition);
    if (index >= 0) {
      const row = document.getElementById(`rule-${index}`);
      if (row) {
        row.classList.add('rule-active');
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  // ===== STATE INFO =====
  _updateStateInfo() {
    const state = this.machine.getState();
    const el = document.getElementById('current-state-display');
    el.textContent = state.currentState;

    const nodeEl = document.getElementById('current-node-display');
    if (nodeEl) nodeEl.textContent = state.currentState;
    const nodeBannerEl = document.getElementById('tape-node-banner');
    if (nodeBannerEl) {
      nodeBannerEl.classList.remove('tape-node-running', 'tape-node-accept', 'tape-node-reject', 'tape-node-halt');
      if (state.accepted) nodeBannerEl.classList.add('tape-node-accept');
      else if (state.rejected) nodeBannerEl.classList.add('tape-node-reject');
      else if (state.halted) nodeBannerEl.classList.add('tape-node-halt');
      else nodeBannerEl.classList.add('tape-node-running');
    }

    const descEl = document.getElementById('state-description');
    const desc = this.machine.config.stateDescriptions?.[state.currentState];
    descEl.textContent = desc || '';

    const statusEl = document.getElementById('machine-status');
    if (state.accepted) {
      statusEl.textContent = 'ACCEPTED';
      statusEl.className = 'status-badge status-accept';
    } else if (state.rejected) {
      statusEl.textContent = 'REJECTED';
      statusEl.className = 'status-badge status-reject';
    } else if (state.halted) {
      statusEl.textContent = 'HALTED';
      statusEl.className = 'status-badge status-halt';
    } else {
      statusEl.textContent = 'READY';
      statusEl.className = 'status-badge status-ready';
    }
  }

  _updateStats() {
    const state = this.machine.getState();
    document.getElementById('step-counter').textContent = state.stepCount;
    document.getElementById('state-counter').textContent = this.machine.config.states.length;

    const isMultiHead = this.machine.config.isMultiHead || false;
    const tapeCounterEl = document.getElementById('tape-counter');
    if (isMultiHead) {
      tapeCounterEl.textContent = `1×${this.machine.config.numTapes}H`;
      tapeCounterEl.title = `1 Tape, ${this.machine.config.numTapes} Heads`;
    } else {
      tapeCounterEl.textContent = this.machine.config.numTapes;
      tapeCounterEl.title = '';
    }

    document.getElementById('transition-counter').textContent = this.machine.config.transitions.length;
  }

  // ===== SANDBOX UI MANAGEMENT =====
  _toggleSandboxUI(show) {
    const analyticsPanel = document.getElementById('sandbox-analytics');
    const editorTab = document.getElementById('tab-editor');
    const headStartSection = document.getElementById('head-start-section');
    const panelEditor = document.getElementById('panel-editor');
    const workbenchTapeStrings = document.getElementById('workbench-tape-strings');
    const presetTapeCount = document.getElementById('preset-tape-count-group');

    if (analyticsPanel) {
      if (show) analyticsPanel.classList.remove('hidden');
      else analyticsPanel.classList.add('hidden');
    }
    if (presetTapeCount) {
      presetTapeCount.style.display = show ? 'none' : 'block';
    }
    if (editorTab) {
      editorTab.style.display = show ? '' : 'none';
    }

    // Workbench sequential steps
    const workbenchSteps = [headStartSection, panelEditor, workbenchTapeStrings];
    for (const el of workbenchSteps) {
      if (el) {
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
    }
  }

  // Update workbench sequential step visibility based on current state
  _updateWorkbenchSteps(numTapes) {
    const tapeStringsSection = document.getElementById('workbench-tape-strings');
    const headStartSection = document.getElementById('head-start-section');
    const panelEditor = document.getElementById('panel-editor');

    // Step 2: Tape strings appear once tape count is set (always show in sandbox)
    if (tapeStringsSection) tapeStringsSection.classList.remove('hidden');

    // Step 3: Head positions appear after tapes are defined  
    if (headStartSection) headStartSection.classList.remove('hidden');

    // Step 4+5: Rule builder appears after head positions
    if (panelEditor) panelEditor.classList.remove('hidden');

    // Build the structured rule form for this tape count
    this._buildStructuredRuleForm(numTapes);
  }

  // ===== STRUCTURED FILL-IN-THE-BLANKS RULE FORM =====
  _buildStructuredRuleForm(numTapes) {
    const container = document.getElementById('structured-rule-form');
    if (!container) return;
    container.innerHTML = '';

    // Row 1: δ( [Current State], [Read 1], ..., [Read k] )
    const topRow = document.createElement('div');
    topRow.className = 'srf-row';
    topRow.innerHTML = '<span class="srf-label">δ(</span>';

    const stateFromInput = document.createElement('input');
    stateFromInput.className = 'srf-input srf-input-state';
    stateFromInput.id = 'srf-from-state';
    stateFromInput.placeholder = 'q₀';
    stateFromInput.spellcheck = false;
    topRow.appendChild(stateFromInput);

    for (let t = 0; t < numTapes; t++) {
      topRow.appendChild(this._srfComma());
      const readInput = document.createElement('input');
      readInput.className = 'srf-input srf-input-symbol';
      readInput.id = `srf-read-${t}`;
      readInput.placeholder = `R${t + 1}`;
      readInput.maxLength = 1;
      readInput.spellcheck = false;
      topRow.appendChild(readInput);
    }

    const closeParen1 = document.createElement('span');
    closeParen1.className = 'srf-label';
    closeParen1.textContent = ' )';
    topRow.appendChild(closeParen1);

    // Arrow row
    const arrowRow = document.createElement('div');
    arrowRow.className = 'srf-arrow';
    arrowRow.textContent = '→';

    // Row 2: ( [Next State], [Write 1], ..., [Write k], [Move 1], ..., [Move k] )
    const botRow = document.createElement('div');
    botRow.className = 'srf-row';
    botRow.innerHTML = '<span class="srf-label">(</span>';

    const stateToInput = document.createElement('input');
    stateToInput.className = 'srf-input srf-input-state';
    stateToInput.id = 'srf-to-state';
    stateToInput.placeholder = 'q₁';
    stateToInput.spellcheck = false;
    botRow.appendChild(stateToInput);

    for (let t = 0; t < numTapes; t++) {
      botRow.appendChild(this._srfComma());
      const writeInput = document.createElement('input');
      writeInput.className = 'srf-input srf-input-symbol';
      writeInput.id = `srf-write-${t}`;
      writeInput.placeholder = `W${t + 1}`;
      writeInput.maxLength = 1;
      writeInput.spellcheck = false;
      botRow.appendChild(writeInput);
    }

    for (let t = 0; t < numTapes; t++) {
      botRow.appendChild(this._srfComma());
      const moveSelect = document.createElement('select');
      moveSelect.className = 'srf-select';
      moveSelect.id = `srf-move-${t}`;
      ['R', 'L', 'S'].forEach(dir => {
        const opt = document.createElement('option');
        opt.value = dir;
        opt.textContent = dir;
        moveSelect.appendChild(opt);
      });
      botRow.appendChild(moveSelect);
    }

    const closeParen2 = document.createElement('span');
    closeParen2.className = 'srf-label';
    closeParen2.textContent = ' )';
    botRow.appendChild(closeParen2);

    // Add Rule button natively placed
    const addBtn = document.createElement('button');
    addBtn.className = 'editor-btn editor-btn-add srf-add-btn';
    addBtn.id = 'btn-add-rule';
    addBtn.title = 'Add Rule';
    addBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">add</span>';
    addBtn.addEventListener('click', () => this._addRuleFromStructuredForm());
    
    // Manage dynamic layout based on large tapes count
    if (numTapes > 2) {
      const layout = document.createElement('div');
      layout.style.display = 'flex';
      layout.style.flexDirection = 'column';
      layout.style.gap = '6px';
      
      const r1 = document.createElement('div');
      r1.style.display = 'flex';
      r1.style.flexWrap = 'wrap';
      r1.style.alignItems = 'center';
      r1.style.gap = '8px';
      r1.appendChild(topRow);
      
      const r2 = document.createElement('div');
      r2.style.display = 'flex';
      r2.style.flexWrap = 'wrap';
      r2.style.alignItems = 'center';
      r2.style.gap = '8px';
      r2.appendChild(arrowRow);
      r2.appendChild(botRow);
      r2.appendChild(addBtn);

      layout.appendChild(r1);
      layout.appendChild(r2);
      container.appendChild(layout);
    } else {
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.flexWrap = 'wrap';
      wrap.style.alignItems = 'center';
      wrap.style.gap = '8px';
      wrap.appendChild(topRow);
      wrap.appendChild(arrowRow);
      wrap.appendChild(botRow);
      wrap.appendChild(addBtn);
      container.appendChild(wrap);
    }

    // Enter key support on all inputs
    container.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') this._addRuleFromStructuredForm();
      });
    });
  }

  _srfComma() {
    const span = document.createElement('span');
    span.className = 'srf-comma';
    span.textContent = ',';
    return span;
  }

  _addRuleFromStructuredForm() {
    const numTapes = this.machine.config.numTapes;
    const errorEl = document.getElementById('editor-error');

    const fromState = document.getElementById('srf-from-state')?.value.trim();
    const toState = document.getElementById('srf-to-state')?.value.trim();

    if (!fromState || !toState) {
      errorEl.textContent = 'Current State and Next State are required.';
      errorEl.classList.remove('hidden');
      return;
    }

    const reads = [], writes = [], moves = [];
    for (let t = 0; t < numTapes; t++) {
      const r = document.getElementById(`srf-read-${t}`)?.value.trim();
      const w = document.getElementById(`srf-write-${t}`)?.value.trim();
      const m = document.getElementById(`srf-move-${t}`)?.value;
      if (!r) {
        errorEl.textContent = `Read symbol for tape ${t + 1} is required.`;
        errorEl.classList.remove('hidden');
        return;
      }
      if (!w) {
        errorEl.textContent = `Write symbol for tape ${t + 1} is required.`;
        errorEl.classList.remove('hidden');
        return;
      }
      reads.push(r === '□' ? this.machine.config.blankSymbol : r);
      writes.push(w === '□' ? this.machine.config.blankSymbol : w);
      moves.push(m);
    }

    // Build the formal string and use existing _addSandboxRule
    const readStr = reads.join(', ');
    const writeStr = writes.join(', ');
    const moveStr = moves.join(', ');
    const ruleStr = `δ(${fromState}, ${readStr}) = (${toState}, ${writeStr}, ${moveStr})`;

    if (this._addSandboxRule(ruleStr)) {
      // Clear form inputs (keep state names for faster entry)
      for (let t = 0; t < numTapes; t++) {
        const rEl = document.getElementById(`srf-read-${t}`);
        const wEl = document.getElementById(`srf-write-${t}`);
        if (rEl) rEl.value = '';
        if (wEl) wEl.value = '';
      }
      errorEl.classList.add('hidden');
    }
  }

  _updateAnalytics() {
    if (!this.isSandboxMode || !this.machine) return;

    const state = this.machine.getState();
    let n = 0;
    const numTapes = this.machine.config.numTapes || 1;
    for (let t = 0; t < numTapes; t++) {
      const el = document.getElementById(this.isSandboxMode ? `workbench-tape-${t}` : `tape-input-${t}`);
      if (el) n += el.value.length;
    }
    if (n === 0) n = 1;

    const steps = state.stepCount;

    document.getElementById('analytics-n').textContent = n;
    document.getElementById('analytics-steps').textContent = steps;

    if (steps > 0) {
      const ratio = (steps / n).toFixed(2);
      const effEl = document.getElementById('analytics-efficiency');
      effEl.textContent = `${ratio} (≈ ${this._guessComplexity(steps, n)})`;
    } else {
      document.getElementById('analytics-efficiency').textContent = '—';
    }
  }

  _guessComplexity(steps, n) {
    if (n <= 1) return 'N/A';
    const ratio = steps / n;
    if (ratio <= 1.5) return 'O(n)';
    if (ratio <= n * 0.8) return 'O(n log n)';
    return 'O(n²)';
  }

  // ===== COMPLEXITY CHART (SVG) =====
  _recordChartPoint() {
    if (!this.machine) return;
    let n = 0;
    const numTapes = this.machine.config.numTapes || 1;
    for (let t = 0; t < numTapes; t++) {
      const el = document.getElementById(this.isSandboxMode ? `workbench-tape-${t}` : `tape-input-${t}`);
      if (el) n += el.value.length;
    }
    const steps = this.machine.getState().stepCount;
    this.complexityDataPoints.push({ n, steps });
  }

  _renderComplexityChart() {
    const svg = document.getElementById('complexity-chart-svg');
    if (!svg) return;
    svg.innerHTML = '';

    const W = 230, H = 140;
    const pad = { t: 12, r: 12, b: 26, l: 32 };
    const cw = W - pad.l - pad.r;
    const ch = H - pad.t - pad.b;

    // Determine the theoretical complexity for the current config
    const tc = this.currentTapeConfig?.timeComplexity || 'Custom';
    const theoryFn = tc.includes('n²') ? (n => n * n)
                   : tc.includes('n log') ? (n => n * Math.log2(Math.max(n, 1)))
                   : (n => n); // default to O(n)

    // Compute axis maximums from data + theory
    const dataPoints = this.complexityDataPoints;
    const maxN = Math.max(1, ...dataPoints.map(p => p.n));
    const maxSteps = Math.max(1, ...dataPoints.map(p => p.steps), theoryFn(maxN));

    const scaleX = n => pad.l + (n / maxN) * cw;
    const scaleY = s => pad.t + ch - (s / maxSteps) * ch;

    // Grid lines + axis labels
    const ns = this._ns;
    const axisColor = '#cbd5e1';
    const gridColor = '#f1f5f9';

    // Y-axis
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (i / 4) * ch;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', pad.l); line.setAttribute('x2', W - pad.r);
      line.setAttribute('y1', y); line.setAttribute('y2', y);
      line.setAttribute('stroke', gridColor); line.setAttribute('stroke-width', '1');
      svg.appendChild(line);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', pad.l - 4); label.setAttribute('y', y + 3);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('font-size', '7'); label.setAttribute('fill', '#94a3b8');
      label.setAttribute('font-family', 'JetBrains Mono, monospace');
      label.textContent = Math.round(maxSteps * (1 - i / 4));
      svg.appendChild(label);
    }

    // X-axis
    const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xLabel.setAttribute('x', pad.l + cw / 2); xLabel.setAttribute('y', H - 3);
    xLabel.setAttribute('text-anchor', 'middle');
    xLabel.setAttribute('font-size', '7'); xLabel.setAttribute('fill', '#94a3b8');
    xLabel.setAttribute('font-family', 'JetBrains Mono, monospace');
    xLabel.textContent = `Total Input Length (n) — max ${maxN}`;
    svg.appendChild(xLabel);

    const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yLabel.setAttribute('x', 4); yLabel.setAttribute('y', pad.t + ch / 2);
    yLabel.setAttribute('text-anchor', 'middle');
    yLabel.setAttribute('font-size', '7'); yLabel.setAttribute('fill', '#94a3b8');
    yLabel.setAttribute('font-family', 'JetBrains Mono, monospace');
    yLabel.setAttribute('transform', `rotate(-90, 6, ${pad.t + ch / 2})`);
    yLabel.textContent = 'Steps';
    svg.appendChild(yLabel);

    // Theoretical complexity curve (faint)
    if (maxN > 0 && tc !== 'Custom') {
      const theoryPoints = [];
      for (let i = 0; i <= 40; i++) {
        const n = (i / 40) * maxN;
        theoryPoints.push(`${scaleX(n).toFixed(1)},${scaleY(theoryFn(n)).toFixed(1)}`);
      }
      const theoryPath = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      theoryPath.setAttribute('points', theoryPoints.join(' '));
      theoryPath.setAttribute('fill', 'none');
      theoryPath.setAttribute('stroke', 'rgba(16, 185, 129, 0.25)');
      theoryPath.setAttribute('stroke-width', '2');
      theoryPath.setAttribute('stroke-dasharray', '4 3');
      svg.appendChild(theoryPath);
    }

    // Actual data points + line
    if (dataPoints.length > 1) {
      const linePoints = dataPoints.map(p => `${scaleX(p.n).toFixed(1)},${scaleY(p.steps).toFixed(1)}`).join(' ');
      const actualLine = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      actualLine.setAttribute('points', linePoints);
      actualLine.setAttribute('fill', 'none');
      actualLine.setAttribute('stroke', '#10b981');
      actualLine.setAttribute('stroke-width', '2');
      svg.appendChild(actualLine);
    }

    // Dots for data points
    dataPoints.forEach(p => {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', scaleX(p.n).toFixed(1));
      dot.setAttribute('cy', scaleY(p.steps).toFixed(1));
      dot.setAttribute('r', '3');
      dot.setAttribute('fill', '#10b981');
      dot.setAttribute('stroke', '#fff');
      dot.setAttribute('stroke-width', '1');
      svg.appendChild(dot);
    });

    // Axis border lines
    const axisL = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axisL.setAttribute('x1', pad.l); axisL.setAttribute('x2', pad.l);
    axisL.setAttribute('y1', pad.t); axisL.setAttribute('y2', pad.t + ch);
    axisL.setAttribute('stroke', axisColor); axisL.setAttribute('stroke-width', '1');
    svg.appendChild(axisL);

    const axisB = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axisB.setAttribute('x1', pad.l); axisB.setAttribute('x2', W - pad.r);
    axisB.setAttribute('y1', pad.t + ch); axisB.setAttribute('y2', pad.t + ch);
    axisB.setAttribute('stroke', axisColor); axisB.setAttribute('stroke-width', '1');
    svg.appendChild(axisB);
  }

  // ===== EDITOR HINT =====
  _updateEditorHint(numTapes) {
    const hintEl = document.getElementById('editor-hint');
    if (!hintEl) return;
    const tapeCountSpan = document.getElementById('editor-tape-count');
    if (tapeCountSpan) tapeCountSpan.textContent = numTapes;
    hintEl.innerHTML = `Fill in all fields for a <span id="editor-tape-count">${numTapes}</span>-tape rule:`;
  }

  // Build workbench tape string inputs (for sandbox mode)
  _buildWorkbenchTapeInputs(numTapes) {
    const container = document.getElementById('workbench-tape-string-inputs');
    if (!container) return;
    container.innerHTML = '';

    for (let t = 0; t < numTapes; t++) {
      const group = document.createElement('div');
      group.className = 'config-group';

      const label = document.createElement('label');
      label.className = 'config-label';
      label.setAttribute('for', `workbench-tape-${t}`);
      label.textContent = `Tape ${t + 1} Input`;

      const input = document.createElement('input');
      input.className = 'config-input tape-input';
      input.id = `workbench-tape-${t}`;
      input.type = 'text';
      input.placeholder = t === 0 ? 'e.g. 10101' : '(work tape — leave empty)';
      input.spellcheck = false;

      input.addEventListener('input', (e) => {
        if (this.machine && typeof this.machine.setTape === 'function') {
          this.machine.setTape(t, e.target.value);
          this._renderTapes();
          this._clearTrace();
          this._updateControls();
          this._updateStateInfo();
          this._updateStats();
        }
      });

      group.appendChild(label);
      group.appendChild(input);
      container.appendChild(group);
    }
  }

  // ===== PARSE δ RULE INPUT =====
  // Auto-convert shorthand symbols in transition rule input
  _autoConvertSymbols(inputEl) {
    const pos = inputEl.selectionStart;
    let val = inputEl.value;
    const origLen = val.length;

    // d( or D( → δ(
    val = val.replace(/\bd\(/gi, 'δ(');
    // -> → →
    val = val.replace(/->/g, '→');
    // Standalone _ at word boundaries → □
    val = val.replace(/(?<=^|[,\s(=])_(?=$|[,\s)=])/g, '□');

    if (val !== inputEl.value) {
      inputEl.value = val;
      const diff = val.length - origLen;
      inputEl.setSelectionRange(pos + diff, pos + diff);
    }
  }

  _parseDeltaRule(input) {
    // Parse: δ(q0, a1, ..., ak) = (q1, b1, ..., bk, D1, ..., Dk)
    // Also accept without δ prefix: (q0, a) = (q1, b, R)
    // Also accept → instead of =
    let cleaned = input.replace(/^δ?\s*/, '').trim();
    // Normalize → to = for the top-level split (only the first → between tuples)
    cleaned = cleaned.replace(/\)\s*→\s*\(/, ') = (');

    // Match: (left_tuple) = (right_tuple)
    const match = cleaned.match(/^\(([^)]+)\)\s*=\s*\(([^)]+)\)$/);
    if (!match) return null;

    const leftParts = match[1].split(',').map(s => s.trim());
    const rightParts = match[2].split(',').map(s => s.trim());

    const numTapes = this.machine.config.numTapes;

    // Left side: (from_state, read1, read2, ..., readk) → k+1 parts
    if (leftParts.length !== numTapes + 1) return null;

    // Right side: (to_state, write1, ..., writek, move1, ..., movek) → 1 + 2k parts
    if (rightParts.length !== 1 + 2 * numTapes) return null;

    const fromState = leftParts[0];
    const reads = leftParts.slice(1).map(s => s === '□' ? this.machine.config.blankSymbol : s);
    const toState = rightParts[0];
    const writes = rightParts.slice(1, 1 + numTapes).map(s => s === '□' ? this.machine.config.blankSymbol : s);
    const moves = rightParts.slice(1 + numTapes).map(s => s.toUpperCase());

    // Validate moves
    for (const m of moves) {
      if (!['R', 'L', 'S'].includes(m)) return null;
    }

    return { from: fromState, read: reads, to: toState, write: writes, move: moves };
  }

  _addSandboxRule(ruleStr) {
    const errorEl = document.getElementById('editor-error');

    const parsed = this._parseDeltaRule(ruleStr);
    if (!parsed) {
      errorEl.textContent = `Invalid format. Expected: δ(q, ${Array(this.machine.config.numTapes).fill('a').join(', ')}) = (q', ${Array(this.machine.config.numTapes).fill('b').join(', ')}, ${Array(this.machine.config.numTapes).fill('D').join(', ')})`;
      errorEl.classList.remove('hidden');
      return false;
    }

    // Auto-add states that don't exist
    const allStates = [parsed.from, parsed.to];
    for (const s of allStates) {
      if (!this.machine.config.states.includes(s)) {
        this.machine.config.states.push(s);
        this.machine.config.stateDescriptions = this.machine.config.stateDescriptions || {};
        this.machine.config.stateDescriptions[s] = '';
      }
    }

    // Add transition
    this.machine.config.transitions.push(parsed);

    errorEl.classList.add('hidden');

    // Refresh everything
    this._buildRuleTable();
    this._renderEditorRulesList();
    this._renderEditorStatesList();
    this.graph.buildGraph(this.machine);
    this._updateStats();

    return true;
  }

  _addSandboxState(name, desc) {
    if (!name || this.machine.config.states.includes(name)) return false;
    this.machine.config.states.push(name);
    this.machine.config.stateDescriptions = this.machine.config.stateDescriptions || {};
    this.machine.config.stateDescriptions[name] = desc || '';

    this._renderEditorStatesList();
    this.graph.buildGraph(this.machine);
    this._updateStats();
    return true;
  }

  _removeSandboxRule(index) {
    this.machine.config.transitions.splice(index, 1);
    this._buildRuleTable();
    this._renderEditorRulesList();
    this.graph.buildGraph(this.machine);
    this._updateStats();
  }

  _renderEditorRulesList() {
    const list = document.getElementById('editor-rules-list');
    if (!list) return;
    list.innerHTML = '';

    const transitions = this.machine.config.transitions;
    if (transitions.length === 0) {
      list.innerHTML = '<div class="editor-empty">No rules defined yet. Add δ rules above.</div>';
      return;
    }

    transitions.forEach((t, i) => {
      const item = document.createElement('div');
      item.className = 'editor-rule-item';

      const text = document.createElement('span');
      text.className = 'editor-rule-text';
      text.textContent = this.machine.formatLinzDelta(t);

      const delBtn = document.createElement('button');
      delBtn.className = 'editor-btn editor-btn-del';
      delBtn.title = 'Delete Rule';
      delBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">close</span>';
      delBtn.addEventListener('click', () => this._removeSandboxRule(i));

      item.appendChild(text);
      item.appendChild(delBtn);
      list.appendChild(item);
    });
  }

  _renderEditorStatesList() {
    const list = document.getElementById('editor-states-list');
    if (!list) return;
    list.innerHTML = '';

    const states = this.machine.config.states;
    const acceptStates = this.machine.config.acceptStates;
    const rejectStates = this.machine.config.rejectStates || [];
    const initial = this.machine.config.initialState;

    states.forEach(s => {
      const item = document.createElement('div');
      item.className = 'editor-state-item';

      let badge = '';
      if (s === initial) badge = '<span class="editor-state-badge badge-initial">INITIAL</span>';
      if (acceptStates.includes(s)) badge += '<span class="editor-state-badge badge-accept">ACCEPT</span>';
      if (rejectStates.includes(s)) badge += '<span class="editor-state-badge badge-reject">REJECT</span>';

      const desc = this.machine.config.stateDescriptions?.[s] || '';
      item.innerHTML = `<span class="editor-state-name">${s}</span>${badge}<span class="editor-state-desc">${desc}</span>`;
      list.appendChild(item);
    });
  }

  // ===== CONTROLS =====
  step() {
    if (this.machine.getState().halted) return;

    // Push deep copy of current state natively before stepping forwards
    const prevState = this.machine.getState();
    this.historyStack.push(prevState);

    const initMsg = document.querySelector('.trace-init');
    if (initMsg) initMsg.remove();

    const result = this.machine.step();
    if (result) {
      this.graph.updateState(this.machine.getState().currentState, result.transition);
      this._renderTapes();
      this._addTraceEntry(result);
      this._highlightRule(result.transition);
      this._updateStateInfo();
      this._updateStats();
      this._updateAnalytics();
      this._renderAnalyticsChart();

      if (this.machine.getState().halted) {
        this._recordAnalyticsRun();
        this.stop();
      }
    }
  }

  stepBack() {
    if (this.historyStack.length === 0) return; // Nothing to pop

    // Halt any playing automations inherently when actively rewinding state overrides
    this.stop();

    const prevState = this.historyStack.pop();
    this.machine.restoreState(prevState);

    // Update the visual stack components purely targeting the previous history node
    this.graph.updateState(prevState.currentState, prevState.lastTransition);
    this._renderTapes();
    this._highlightRule(prevState.lastTransition);
    this._updateStateInfo();
    this._updateStats();
    this._updateAnalytics();
    if (this.complexityDataPoints.length > 0) this.complexityDataPoints.pop();
    this._renderComplexityChart();

    // Drop the frontmost child from the internal trace container actively
    const traceContainer = document.getElementById('trace-entries');
    if (traceContainer.firstChild) {
      traceContainer.removeChild(traceContainer.firstChild);
    }
  }

  play() {
    if (this.isPlaying || this.machine.getState().halted) return;
    this.isPlaying = true;
    this._updateControls();

    this.playInterval = setInterval(() => {
      this.step();
      if (this.machine.getState().halted) {
        this.stop();
      }
    }, this.speed);
  }

  stop() {
    this.isPlaying = false;
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
    this._updateControls();
  }

  reset() {
    this.stop();
    this._resetMachine();
  }

  setSpeed(ms) {
    this.speed = ms;
    if (this.isPlaying) {
      this.stop();
      this.play();
    }
  }

  _updateControls() {
    const playBtn = document.getElementById('btn-play');
    const pauseBtn = document.getElementById('btn-pause');

    if (this.isPlaying) {
      playBtn.classList.add('control-disabled');
      pauseBtn.classList.remove('control-disabled');
    } else {
      playBtn.classList.remove('control-disabled');
      pauseBtn.classList.add('control-disabled');
    }

    if (!this.machine) return;

    if (this.machine.getState().halted) {
      playBtn.classList.add('control-disabled');
      document.getElementById('btn-step').classList.add('control-disabled');
    } else {
      document.getElementById('btn-step').classList.remove('control-disabled');
    }
  }

  // ===== EVENT BINDINGS =====
  _bindEvents() {
    // Algorithm selector
    document.getElementById('algo-select').addEventListener('change', (e) => {
      this._loadAlgorithm(e.target.value);
    });

    // Tape count (dropdown for presets)
    document.getElementById('tape-count').addEventListener('change', (e) => {
      this._onTapeChange(parseInt(e.target.value) || 1);
    });

    // Tape count (number input for playground)
    document.getElementById('playground-tape-count').addEventListener('change', (e) => {
      const count = parseInt(e.target.value) || 1;
      this._onTapeChange(count);
      if (this.isSandboxMode) {
        this._buildWorkbenchTapeInputs(count);
        this._buildHeadStartInputs(count);
        this._updateWorkbenchSteps(count);
      }
    });

    // Symbol auto-conversion on rule input
    const ruleAutoConvert = document.getElementById('new-rule-input');
    if (ruleAutoConvert) {
      ruleAutoConvert.addEventListener('input', () => {
        this._autoConvertSymbols(ruleAutoConvert);
      });
    }

    // Control buttons
    document.getElementById('btn-play').addEventListener('click', () => this.play());
    document.getElementById('btn-pause').addEventListener('click', () => this.stop());
    document.getElementById('btn-step').addEventListener('click', () => this.step());
    const btnStepBack = document.getElementById('btn-step-back');
    if (btnStepBack) btnStepBack.addEventListener('click', () => this.stepBack());
    document.getElementById('btn-reset').addEventListener('click', () => this.reset());

    document.getElementById('btn-fast').addEventListener('click', () => {
      if (this.machine.getState().halted) return;
      const initMsg = document.querySelector('.trace-init');
      if (initMsg) initMsg.remove();

      let count = 0;
      const maxSteps = 500;
      while (!this.machine.getState().halted && count < maxSteps) {
        const prevState = this.machine.getState();
        this.historyStack.push(prevState);
        const result = this.machine.step();
        if (result) {
          this._addTraceEntry(result);
          this._highlightRule(result.transition);
        }
        count++;
      }
      const state = this.machine.getState();
      this.graph.updateState(state.currentState, this.machine.lastTransition);
      this._renderTapes();
      this._updateStateInfo();
      this._updateStats();
      this._updateAnalytics();
      if (state.halted) this._recordAnalyticsRun();
      this._renderAnalyticsChart();
    });

    // Speed slider
    document.getElementById('speed-slider').addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      const ms = Math.round(1050 - val * 10);
      this.speed = Math.max(50, ms);
      document.getElementById('speed-value').textContent = `${this.speed}ms`;
      if (this.isPlaying) {
        this.stop();
        this.play();
      }
    });

    // Note: dynamic tape inputs have enter-key listeners bound when they are generated in _buildDynamicTapeInputs

    // Load button
    document.getElementById('btn-load').addEventListener('click', () => {
      this.reset();
    });

    // Fullscreen toggle
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });

    const btnToggleRightSidebar = document.getElementById('btn-toggle-right-sidebar');
    if (btnToggleRightSidebar) {
      btnToggleRightSidebar.addEventListener('click', () => {
        this._setRightSidebarCollapsed(!this.isRightSidebarCollapsed);
      });
    }

    const resizeHandle = document.getElementById('right-sidebar-resize-handle');
    if (resizeHandle) {
      resizeHandle.addEventListener('pointerdown', (e) => {
        if (this.isRightSidebarCollapsed) return;
        e.preventDefault();
        const appLayout = document.getElementById('sim-view');
        const onMove = (moveEvent) => {
          if (!appLayout) return;
          const rect = appLayout.getBoundingClientRect();
          const proposedWidth = rect.right - moveEvent.clientX;
          this._applyRightSidebarWidth(proposedWidth, true);
        };
        const onUp = () => {
          document.body.classList.remove('sidebar-resizing');
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };

        document.body.classList.add('sidebar-resizing');
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp, { once: true });
      });
    }

    const leftResizeHandle = document.getElementById('left-sidebar-resize-handle');
    if (leftResizeHandle) {
      leftResizeHandle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const appLayout = document.getElementById('sim-view');
        const onMove = (moveEvent) => {
          if (!appLayout) return;
          const rect = appLayout.getBoundingClientRect();
          const proposedWidth = moveEvent.clientX - rect.left;
          this._applyLeftSidebarWidth(proposedWidth, true);
        };
        const onUp = () => {
          document.body.classList.remove('sidebar-resizing');
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };

        document.body.classList.add('sidebar-resizing');
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp, { once: true });
      });
    }

    // Tab switching for right panel (scoped to split-bottom only)
    const splitBottom = document.querySelector('.sidebar-split-bottom');
    if (splitBottom) {
      splitBottom.querySelectorAll('.panel-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          splitBottom.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('panel-tab-active'));
          tab.classList.add('panel-tab-active');
          const target = tab.dataset.tab;
          splitBottom.querySelectorAll('.panel-content').forEach(c => c.classList.add('hidden'));
          splitBottom.querySelector(`#panel-${target}`).classList.remove('hidden');
        });
      });
    }

    // Download JSON
    const btnDownload = document.getElementById('btn-download-json');
    if (btnDownload) {
      btnDownload.addEventListener('click', () => this._downloadMachineJSON());
    }

    // Clear analytics history
    const btnClear = document.getElementById('btn-clear-history');
    if (btnClear) {
      btnClear.addEventListener('click', () => this._clearAnalyticsHistory());
    }

    // Tab switching for left panel modes (Presets vs Playground)
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // Toggle the visual active tab state
        document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('mode-tab-active'));
        tab.classList.add('mode-tab-active');

        // Hide all mode contents
        document.querySelectorAll('.mode-content').forEach(c => c.classList.add('hidden'));

        // Show the targeted mode content
        const targetMode = tab.dataset.mode;
        document.getElementById(`mode-${targetMode}`).classList.remove('hidden');

        // Context switching logic
        if (targetMode === 'playground') {
           // Remember what preset they were looking at
           if (this.currentAlgoKey !== 'sandbox') {
             this.previousPresetKey = this.currentAlgoKey;
             this._loadAlgorithm('sandbox');
           }
        } else {
           // Switching back to Presets
           if (this.currentAlgoKey === 'sandbox') {
             this._loadAlgorithm(this.previousPresetKey || 'palindrome');
           }
        }
      });
    });

    // Global Learning Mode toggle
    const learningCb = document.getElementById('learning-mode-cb');
    if (learningCb) {
      learningCb.addEventListener('change', (e) => {
        this.graph.setGlobalLearningMode(e.target.checked);
      });
    }

    // ===== SANDBOX: Add Rule (now handled by structured form _addRuleFromStructuredForm) =====
    // Legacy text input support removed — the structured form has its own event bindings.

    // ===== SANDBOX: Add State =====
    const btnAddState = document.getElementById('btn-add-state');
    if (btnAddState) {
      btnAddState.addEventListener('click', () => {
        const nameInput = document.getElementById('new-state-name');
        const descInput = document.getElementById('new-state-desc');
        if (nameInput.value.trim()) {
          this._addSandboxState(nameInput.value.trim(), descInput.value.trim());
          nameInput.value = '';
          descInput.value = '';
        }
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.isPlaying ? this.stop() : this.play();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.step();
          break;
        case 'r':
          e.preventDefault();
          this.reset();
          break;
      }
    });

    this._setRightSidebarCollapsed(this.isRightSidebarCollapsed);
  }
  // ===== ANALYTICS: PERFORMANCE CHART (n vs steps) =====

  // Tape-count color palette for multi-series charting
  _tapeColor(tapeCount) {
    const colors = {
      1: '#ef4444', // Red
      2: '#3b82f6', // Blue
      3: '#22c55e', // Green
      4: '#a855f7', // Purple
    };
    return colors[tapeCount] || '#f59e0b';
  }

  _recordAnalyticsRun() {
    if (!this.machine) return;
    const state = this.machine.getState();
    
    // Filter Rejected Inputs
    if (state.rejected || state.currentState === 'q_rej') return;

    let n = 0;
    const numTapes = this.machine.config.numTapes || 1;
    for (let t = 0; t < numTapes; t++) {
      const el = document.getElementById(this.isSandboxMode ? `workbench-tape-${t}` : `tape-input-${t}`);
      if (el) n += el.value.length;
    }

    const steps = state.stepCount;
    let result = 'halt';
    if (state.accepted) result = 'accept';
    else if (state.rejected) result = 'reject'; // fallback just in case

    this.analyticsHistory.push({
      n,
      steps,
      result,
      algo: this.currentAlgoKey,
      tapes: this.machine.config.numTapes,
      timestamp: Date.now()
    });

    // Recompute fits per tape group on completed runs (visual stability)
    this._computeAllRegressionFits();

    this._renderAnalyticsHistory();
    this._renderAnalyticsChart();
  }

  // Build head start position inputs for playground mode
  _buildHeadStartInputs(numTapes) {
    const container = document.getElementById('head-start-inputs');
    if (!container) return;
    container.innerHTML = '';

    for (let t = 0; t < numTapes; t++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'head-start-item';

      const label = document.createElement('label');
      label.className = 'head-start-label';
      label.textContent = `T${t + 1}`;
      label.setAttribute('for', `head-start-${t}`);

      const input = document.createElement('input');
      input.className = 'config-input head-start-input';
      input.id = `head-start-${t}`;
      input.type = 'number';
      input.min = '0';
      input.value = '0';
      input.placeholder = '0';

      wrapper.appendChild(label);
      wrapper.appendChild(input);
      container.appendChild(wrapper);
    }
  }

  _renderAnalyticsHistory() {
    const list = document.getElementById('analytics-history-list');
    if (!list) return;
    list.innerHTML = '';

    if (this.analyticsHistory.length === 0) {
      list.innerHTML = '<div class="analytics-empty">No completed runs yet. Run the machine to completion to record data points.</div>';
      return;
    }

    // Show most recent first
    const runs = [...this.analyticsHistory].reverse();
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      const idx = this.analyticsHistory.length - i;

      const item = document.createElement('div');
      item.className = 'analytics-run-item';

      const num = document.createElement('span');
      num.className = 'analytics-run-num';
      num.textContent = `#${idx}`;

      const info = document.createElement('span');
      info.className = 'analytics-run-info';
      info.textContent = `n=${run.n} → ${run.steps} steps`;

      const badge = document.createElement('span');
      badge.className = 'analytics-run-result';
      if (run.result === 'accept') {
        badge.classList.add('analytics-run-result-accept');
        badge.textContent = 'ACC';
      } else if (run.result === 'reject') {
        badge.classList.add('analytics-run-result-reject');
        badge.textContent = 'REJ';
      } else {
        badge.classList.add('analytics-run-result-halt');
        badge.textContent = 'HALT';
      }

      item.appendChild(num);
      item.appendChild(info);
      item.appendChild(badge);
      list.appendChild(item);
    }
  }

  _renderAnalyticsChart() {
    const svg = document.getElementById('analytics-chart-svg');
    if (!svg) return;
    svg.innerHTML = '';

    const W = 300, H = 180;
    const pad = { t: 14, r: 14, b: 26, l: 36 };
    const cw = W - pad.l - pad.r;
    const ch = H - pad.t - pad.b;

    const completedRuns = this.analyticsHistory;

    // Live point: current run in progress
    let liveN = 0;
    const liveTapes = this.machine ? this.machine.config.numTapes : 1;
    for (let t = 0; t < liveTapes; t++) {
      const el = document.getElementById(this.isSandboxMode ? `workbench-tape-${t}` : `tape-input-${t}`);
      if (el) liveN += el.value.length;
    }
    const liveSteps = this.machine ? this.machine.getState().stepCount : 0;
    const isLive = this.machine && !this.machine.getState().halted && liveSteps > 0;

    // Compute axis maximums
    const allN = [...completedRuns.map(r => r.n), liveN].filter(v => v > 0);
    const allS = [...completedRuns.map(r => r.steps), liveSteps].filter(v => v > 0);

    if (allN.length === 0 && !isLive) {
      const emptyText = this._svgNS('text');
      emptyText.setAttribute('x', W / 2);
      emptyText.setAttribute('y', H / 2);
      emptyText.setAttribute('text-anchor', 'middle');
      emptyText.setAttribute('font-family', 'Inter, sans-serif');
      emptyText.setAttribute('font-size', '10');
      emptyText.setAttribute('fill', '#94a3b8');
      emptyText.textContent = 'Run the machine to see performance data';
      svg.appendChild(emptyText);
      this._updateMultiLegend([]);
      this._updateFormulaDisplay(null);
      return;
    }

    // ===== GROUP RUNS BY TAPE COUNT =====
    const tapeGroups = {};
    for (const run of completedRuns) {
      const k = run.tapes || 1;
      if (!tapeGroups[k]) tapeGroups[k] = [];
      tapeGroups[k].push(run);
    }
    const tapeKeys = Object.keys(tapeGroups).map(Number).sort();

    // Compute max including all fits
    const maxN = Math.max(1, ...allN);
    let fitMaxY = 0;
    for (const k of tapeKeys) {
      const fit = this._cachedFits[k];
      if (fit) {
        const y = fit.type === 'quadratic'
          ? fit.a * maxN * maxN + fit.b * maxN + fit.c
          : fit.k * maxN + fit.b;
        fitMaxY = Math.max(fitMaxY, y);
      }
    }
    const maxSteps = Math.max(1, ...allS, fitMaxY * 1.15);

    const scaleX = n => pad.l + (n / maxN) * cw;
    const scaleY = s => pad.t + ch - (s / maxSteps) * ch;

    // Grid lines
    const gridColor = '#f1f5f9';
    const axisColor = '#cbd5e1';

    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (i / 4) * ch;
      const line = this._svgNS('line');
      line.setAttribute('x1', pad.l); line.setAttribute('x2', W - pad.r);
      line.setAttribute('y1', y); line.setAttribute('y2', y);
      line.setAttribute('stroke', gridColor); line.setAttribute('stroke-width', '1');
      svg.appendChild(line);

      const label = this._svgNS('text');
      label.setAttribute('x', pad.l - 4); label.setAttribute('y', y + 3);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('font-size', '7'); label.setAttribute('fill', '#94a3b8');
      label.setAttribute('font-family', 'JetBrains Mono, monospace');
      label.textContent = Math.round(maxSteps * (1 - i / 4));
      svg.appendChild(label);
    }

    // X-axis label
    const xLabel = this._svgNS('text');
    xLabel.setAttribute('x', pad.l + cw / 2); xLabel.setAttribute('y', H - 4);
    xLabel.setAttribute('text-anchor', 'middle');
    xLabel.setAttribute('font-size', '7.5'); xLabel.setAttribute('fill', '#94a3b8');
    xLabel.setAttribute('font-family', 'JetBrains Mono, monospace');
    xLabel.textContent = 'Total Input Length (n)';
    svg.appendChild(xLabel);

    // Y-axis label
    const yLabel = this._svgNS('text');
    yLabel.setAttribute('x', 5); yLabel.setAttribute('y', pad.t + ch / 2);
    yLabel.setAttribute('text-anchor', 'middle');
    yLabel.setAttribute('font-size', '7.5'); yLabel.setAttribute('fill', '#94a3b8');
    yLabel.setAttribute('font-family', 'JetBrains Mono, monospace');
    yLabel.setAttribute('transform', `rotate(-90, 7, ${pad.t + ch / 2})`);
    yLabel.textContent = 'Steps';
    svg.appendChild(yLabel);

    // ===== MULTI-TAPE SERIES RENDERING =====
    const legendItems = [];

    for (const k of tapeKeys) {
      const groupRuns = tapeGroups[k];
      const color = this._tapeColor(k);
      const fit = this._cachedFits[k];

      // Fitted regression curve (dashed) — ONLY if 3+ distinct n values
      const distinctNInGroup = new Set(groupRuns.map(r => r.n)).size;
      if (fit && distinctNInGroup >= 3) {
        const fitPoints = [];
        for (let i = 0; i <= 50; i++) {
          const n = (i / 50) * maxN;
          const y = fit.type === 'quadratic'
            ? fit.a * n * n + fit.b * n + fit.c
            : fit.k * n + fit.b;
          const clamped = Math.max(0, y);
          if (clamped <= maxSteps * 1.05) {
            fitPoints.push(`${scaleX(n).toFixed(1)},${scaleY(clamped).toFixed(1)}`);
          }
        }
        if (fitPoints.length > 1) {
          const fitLine = this._svgNS('polyline');
          fitLine.setAttribute('points', fitPoints.join(' '));
          fitLine.setAttribute('fill', 'none');
          fitLine.setAttribute('stroke', color);
          fitLine.setAttribute('stroke-width', '1.5');
          fitLine.setAttribute('stroke-dasharray', '6 3');
          fitLine.setAttribute('opacity', '0.5');
          svg.appendChild(fitLine);

          // Fit label at end of curve
          const lastPt = fitPoints[fitPoints.length - 1].split(',');
          const fitLabel = this._svgNS('text');
          fitLabel.setAttribute('x', Math.min(parseFloat(lastPt[0]) + 2, W - pad.r - 10));
          fitLabel.setAttribute('y', Math.max(parseFloat(lastPt[1]) - 3, pad.t + 8));
          fitLabel.setAttribute('font-size', '7');
          fitLabel.setAttribute('fill', color);
          fitLabel.setAttribute('font-family', 'JetBrains Mono, monospace');
          fitLabel.setAttribute('font-weight', '700');
          fitLabel.textContent = fit.type === 'quadratic' ? 'O(n²)' : 'O(n)';
          svg.appendChild(fitLabel);
        }
      }

      // Line connecting data points — ONLY if 3+ distinct n values
      if (groupRuns.length > 1 && distinctNInGroup >= 3) {
        const sorted = [...groupRuns].sort((a, b) => a.n - b.n);
        const linePoints = sorted.map(r => `${scaleX(r.n).toFixed(1)},${scaleY(r.steps).toFixed(1)}`).join(' ');
        const actualLine = this._svgNS('polyline');
        actualLine.setAttribute('points', linePoints);
        actualLine.setAttribute('fill', 'none');
        actualLine.setAttribute('stroke', color);
        actualLine.setAttribute('stroke-width', '1.8');
        actualLine.setAttribute('stroke-linejoin', 'round');
        actualLine.setAttribute('opacity', '0.5');
        svg.appendChild(actualLine);
      }

      // Data point dots
      groupRuns.forEach((run, index) => {
        const isLatest = index === groupRuns.length - 1;
        const dot = this._svgNS('circle');
        dot.setAttribute('cx', scaleX(run.n).toFixed(1));
        dot.setAttribute('cy', scaleY(run.steps).toFixed(1));
        dot.setAttribute('r', isLatest ? '4.5' : '3');
        dot.setAttribute('fill', color);
        dot.setAttribute('stroke', '#fff');
        dot.setAttribute('stroke-width', '1.5');
        dot.setAttribute('opacity', isLatest ? '1' : '0.55');
        svg.appendChild(dot);

        const title = this._svgNS('title');
        title.textContent = `${k}-Tape: n=${run.n}, steps=${run.steps} (${run.result.toUpperCase()})`;
        dot.appendChild(title);
      });

      // Legend entry — show point count if <3 distinct
      const distinctNCount = new Set(groupRuns.map(r => r.n)).size;
      let fitClass;
      if (distinctNCount >= 3 && fit) {
        fitClass = fit.type === 'quadratic' ? 'O(n²) detected' : 'O(n) detected';
      } else {
        fitClass = `${distinctNCount}/3 pts`;
      }
      legendItems.push({ tapes: k, color, fitClass, distinctNCount });
    }

    // Live point (pulsing hollow circle)
    if (isLive) {
      const liveColor = this._tapeColor(liveTapes);
      const liveDot = this._svgNS('circle');
      liveDot.setAttribute('cx', scaleX(liveN).toFixed(1));
      liveDot.setAttribute('cy', scaleY(liveSteps).toFixed(1));
      liveDot.setAttribute('r', '5');
      liveDot.setAttribute('fill', 'none');
      liveDot.setAttribute('stroke', liveColor);
      liveDot.setAttribute('stroke-width', '2');
      liveDot.classList.add('analytics-live-dot');
      svg.appendChild(liveDot);

      const liveLabel = this._svgNS('text');
      liveLabel.setAttribute('x', parseFloat(scaleX(liveN).toFixed(1)) + 8);
      liveLabel.setAttribute('y', parseFloat(scaleY(liveSteps).toFixed(1)) + 3);
      liveLabel.setAttribute('font-size', '7');
      liveLabel.setAttribute('fill', liveColor);
      liveLabel.setAttribute('font-family', 'JetBrains Mono, monospace');
      liveLabel.setAttribute('font-weight', '700');
      liveLabel.textContent = `${liveSteps}`;
      svg.appendChild(liveLabel);
    }

    // Axis border lines
    const axisL = this._svgNS('line');
    axisL.setAttribute('x1', pad.l); axisL.setAttribute('x2', pad.l);
    axisL.setAttribute('y1', pad.t); axisL.setAttribute('y2', pad.t + ch);
    axisL.setAttribute('stroke', axisColor); axisL.setAttribute('stroke-width', '1');
    svg.appendChild(axisL);

    const axisB = this._svgNS('line');
    axisB.setAttribute('x1', pad.l); axisB.setAttribute('x2', W - pad.r);
    axisB.setAttribute('y1', pad.t + ch); axisB.setAttribute('y2', pad.t + ch);
    axisB.setAttribute('stroke', axisColor); axisB.setAttribute('stroke-width', '1');
    svg.appendChild(axisB);

    // Update legend + formula UI
    this._updateMultiLegend(legendItems);
    this._updateFormulaDisplay(null); // formula display now integrated into legend
  }

  // ===== MULTI-SERIES LEGEND =====
  _updateMultiLegend(legendItems) {
    const legendEl = document.getElementById('analytics-chart-legend');
    if (!legendEl) return;
    legendEl.innerHTML = '';

    if (legendItems.length === 0) {
      legendEl.innerHTML = '<span class="chart-legend-item" style="font-style:italic;color:#94a3b8">No data yet</span>';
      return;
    }

    for (const item of legendItems) {
      const span = document.createElement('span');
      span.className = 'chart-legend-item';
      span.innerHTML = `<span class="chart-dot" style="background:${item.color}"></span>${item.tapes}-Tape <span style="opacity:0.6">${item.fitClass}</span>`;
      legendEl.appendChild(span);
    }

    // Live indicator
    if (this.machine && !this.machine.getState().halted && this.machine.getState().stepCount > 0) {
      const liveSpan = document.createElement('span');
      liveSpan.className = 'chart-legend-item';
      liveSpan.innerHTML = '<span class="chart-dot" style="background:transparent;border:1.5px solid rgba(16,185,129,0.5)"></span>Live';
      legendEl.appendChild(liveSpan);
    }

    // Legend definition for n
    const nDefSpan = document.createElement('span');
    nDefSpan.className = 'chart-legend-item';
    nDefSpan.style.marginLeft = 'auto';
    nDefSpan.style.opacity = '0.8';
    nDefSpan.innerHTML = '<em>n</em> = Total Input Length';
    legendEl.appendChild(nDefSpan);
  }

  // ===== REGRESSION ENGINE: Least Squares Fitting (Data-Driven Only) =====

  // Compute independent regression fits for each tape-count group
  _computeAllRegressionFits() {
    const tapeGroups = {};
    for (const run of this.analyticsHistory) {
      const k = run.tapes || 1;
      if (!tapeGroups[k]) tapeGroups[k] = [];
      tapeGroups[k].push(run);
    }
    this._cachedFits = {};
    for (const k of Object.keys(tapeGroups)) {
      this._cachedFits[k] = this._computeRegressionFitSingle(tapeGroups[k], parseInt(k, 10));
    }
    // Legacy compatibility
    this._cachedFit = this._cachedFits[Object.keys(tapeGroups).pop()] || null;
  }

  _computeRegressionFitSingle(runs, tapeCount = 1) {
    if (!runs || runs.length < 2) return null;

    const distinctN = new Set(runs.map(r => r.n));
    if (distinctN.size < 2) return null;

    const xs = runs.map(r => r.n);
    const ys = runs.map(r => r.steps);

    const linFit = this._leastSquaresLinear(xs, ys);
    const linR2 = this._rSquared(xs, ys, x => linFit.k * x + linFit.b);

    if (distinctN.size >= 3) {
      const quadFit = this._leastSquaresQuadratic(xs, ys);
      const quadR2 = this._rSquared(xs, ys, x => quadFit.a * x * x + quadFit.b * x + quadFit.c);

      let quadWins = false;
      if (tapeCount === 1) {
        quadWins = quadR2 >= (linR2 - 0.05) && Math.abs(quadFit.a) > 0.001;
      } else {
        quadWins = quadR2 > (linR2 + 0.05) && Math.abs(quadFit.a) > 0.01;
      }

      if (quadWins) {
        return { type: 'quadratic', a: quadFit.a, b: quadFit.b, c: quadFit.c, r2: quadR2 };
      }
    }

    return { type: 'linear', k: linFit.k, b: linFit.b, r2: linR2 };
  }

  // Legacy wrapper
  _computeRegressionFit(runs) {
    const fit = this._computeRegressionFitSingle(runs);
    this._cachedFit = fit;
    return fit;
  }

  _leastSquaresLinear(xs, ys) {
    const n = xs.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += xs[i]; sumY += ys[i];
      sumXY += xs[i] * ys[i]; sumX2 += xs[i] * xs[i];
    }
    const denom = n * sumX2 - sumX * sumX;
    if (Math.abs(denom) < 1e-12) return { k: 0, b: sumY / n };
    const k = (n * sumXY - sumX * sumY) / denom;
    const b = (sumY - k * sumX) / n;
    return { k: Math.max(0.1, k), b };
  }

  _leastSquaresQuadratic(xs, ys) {
    // Solve for y = a*x² + b*x + c via normal equations
    const n = xs.length;
    let s1 = 0, s2 = 0, s3 = 0, s4 = 0;
    let sy = 0, sxy = 0, sx2y = 0;
    for (let i = 0; i < n; i++) {
      const x = xs[i], y = ys[i];
      const x2 = x * x, x3 = x2 * x, x4 = x2 * x2;
      s1 += x; s2 += x2; s3 += x3; s4 += x4;
      sy += y; sxy += x * y; sx2y += x2 * y;
    }
    // [n s1 s2 | sy  ]   [c]
    // [s1 s2 s3 | sxy ]   [b]
    // [s2 s3 s4 | sx2y]   [a]
    const A = [
      [n, s1, s2, sy],
      [s1, s2, s3, sxy],
      [s2, s3, s4, sx2y]
    ];
    // Gaussian elimination
    for (let col = 0; col < 3; col++) {
      let maxRow = col;
      for (let row = col + 1; row < 3; row++) {
        if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
      }
      [A[col], A[maxRow]] = [A[maxRow], A[col]];
      if (Math.abs(A[col][col]) < 1e-12) continue;
      for (let row = col + 1; row < 3; row++) {
        const factor = A[row][col] / A[col][col];
        for (let j = col; j <= 3; j++) A[row][j] -= factor * A[col][j];
      }
    }
    // Back-substitution
    const sol = [0, 0, 0];
    for (let i = 2; i >= 0; i--) {
      if (Math.abs(A[i][i]) < 1e-12) { sol[i] = 0; continue; }
      sol[i] = A[i][3];
      for (let j = i + 1; j < 3; j++) sol[i] -= A[i][j] * sol[j];
      sol[i] /= A[i][i];
    }
    return { c: sol[0], b: sol[1], a: Math.max(0, sol[2]) };
  }

  _rSquared(xs, ys, predict) {
    const n = ys.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < n; i++) {
      ssTot += (ys[i] - meanY) ** 2;
      ssRes += (ys[i] - predict(xs[i])) ** 2;
    }
    if (ssTot < 1e-12) return 1;
    return 1 - ssRes / ssTot;
  }

  // ===== UI UPDATERS =====
  _updateFormulaDisplay(fit) {
    const el = document.getElementById('analytics-formula-display');
    if (!el) return;

    // Build a summary line from all cached fits
    const fits = this._cachedFits || {};
    const fitKeys = Object.keys(fits).filter(k => fits[k]);

    // Check if any group has enough data
    const tapeGroups = {};
    for (const run of (this.analyticsHistory || [])) {
      const k = run.tapes || 1;
      if (!tapeGroups[k]) tapeGroups[k] = new Set();
      tapeGroups[k].add(run.n);
    }

    // Count total distinct n across all groups
    const anyGroupHas3 = Object.values(tapeGroups).some(s => s.size >= 3);

    if (!anyGroupHas3) {
      const totalRuns = (this.analyticsHistory || []).length;
      if (totalRuns === 0) {
        el.innerHTML = '<span class="formula-pending">Run the machine to begin complexity analysis</span>';
      } else {
        // Compute max distinct points across any group
        const maxDistinct = Math.max(0, ...Object.values(tapeGroups).map(s => s.size));
        el.innerHTML = `<span class="formula-pending">Collect at least 3 data points to derive complexity (${maxDistinct}/3 so far).</span>`;
      }
      return;
    }

    // Show per-tape-group derived complexity
    const parts = [];
    for (const k of fitKeys) {
      const f = fits[k];
      const groupDistinct = tapeGroups[k] ? tapeGroups[k].size : 0;
      const color = this._tapeColor(Number(k));

      if (groupDistinct >= 3) {
        const classStr = f.type === 'quadratic' ? 'O(n²)' : 'O(n)';
        const r2 = f.r2 !== null ? ` R²=${f.r2.toFixed(2)}` : '';
        parts.push(`<span style="color:${color};font-weight:700">${k}-Tape: ${classStr} detected</span><span style="opacity:0.5">${r2}</span>`);
      } else {
        parts.push(`<span style="color:${color};font-weight:700">${k}-Tape:</span> <span style="opacity:0.5">${groupDistinct}/3 pts</span>`);
      }
    }
    el.innerHTML = parts.join(' · ');
  }

  _svgNS(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
  }

  // ===== JSON EXPORT =====
  _downloadMachineJSON() {
    if (!this.machine) return;

    const config = this.machine.config;
    const exportData = {
      meta: {
        generator: 'TuringAtheneum',
        exportedAt: new Date().toISOString(),
        algorithm: this.currentAlgoKey,
        preset: this.currentPresetKey
      },
      machine: {
        name: config.name,
        description: config.description,
        numTapes: config.numTapes,
        states: config.states,
        initialState: config.initialState,
        acceptStates: config.acceptStates,
        rejectStates: config.rejectStates || [],
        inputAlphabet: config.inputAlphabet,
        tapeAlphabet: config.tapeAlphabet,
        blankSymbol: config.blankSymbol,
        stateDescriptions: config.stateDescriptions || {},
        transitions: config.transitions.map(t => ({
          from: t.from,
          read: t.read,
          to: t.to,
          write: t.write,
          move: t.move
        }))
      },
      analytics: {
        history: this.analyticsHistory,
        currentState: this.machine.getState()
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `turing-${this.currentAlgoKey || 'machine'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  _clearAnalyticsHistory() {
    this.analyticsHistory = [];
    this._cachedFit = null;
    this._cachedFits = {};
    this._renderAnalyticsHistory();
    this._renderAnalyticsChart();
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('[TuringAtheneum] Initializing app...');
    window.app = new App();
    console.log('[TuringAtheneum] App initialized successfully.');
    console.log('[TuringAtheneum] Graph nodes:', window.app.graph.nodes.length);
    console.log('[TuringAtheneum] Machine state:', window.app.machine.getState().currentState);
  } catch (e) {
    console.error('[TuringAtheneum] Init error:', e);
    document.getElementById('graph-container').innerHTML =
      '<div style="color:#ff5252;padding:2rem;font-family:monospace">Error: ' + e.message + '</div>';
  }
});
