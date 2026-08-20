/**
 * SimpleGallery 2026 - 8 Queens Chess Puzzle App
 * Modern WebOS multi-instance puzzle game with real-time threat detection,
 * complete backtracking solver (92 solutions for 8x8), hint system, and customizable board sizes.
 */
(function(window) {
  'use strict';

  class EightQueensInstance {
    constructor(app, id, options = {}) {
      this.app = app;
      this.id = id;
      this.winId = `eight-queens-${id}`;
      this.options = options;

      this.boardSize = parseInt(options.boardSize, 10) || 8;
      this.theme = options.theme || 'cyber';
      this.queens = []; // Array of {r, c}
      this.movesCount = 0;
      this.startTime = null;
      this.elapsedSeconds = 0;
      this.timerInterval = null;
      this.isWon = false;
      this.showThreatRays = true;
      this.showSafeHints = false;

      this.allSolutions = [];
      this.solutionIndex = -1;
      this.autoPlayInterval = null;

      this.win = null;
      this.el = {};

      this.computeSolutions();
      this.initWindow();
    }

    t(key, replacements = {}) {
      return this.app.t(key, replacements);
    }

    escapeHtml(str) {
      return this.app.escapeHtml(str);
    }

    /**
     * Compute all solutions using backtracking solver
     */
    computeSolutions() {
      const n = this.boardSize;
      const solutions = [];
      const board = new Array(n).fill(-1); // board[row] = col

      const isSafe = (row, col) => {
        for (let r = 0; r < row; r++) {
          const c = board[r];
          if (c === col || Math.abs(c - col) === Math.abs(r - row)) {
            return false;
          }
        }
        return true;
      };

      const solve = (row) => {
        if (row === n) {
          solutions.push([...board]);
          return;
        }
        for (let col = 0; col < n; col++) {
          if (isSafe(row, col)) {
            board[row] = col;
            solve(row + 1);
            board[row] = -1;
          }
        }
      };

      solve(0);
      this.allSolutions = solutions;
    }

    initWindow() {
      const appTitle = (window.sys && window.sys.appManager)
        ? window.sys.appManager.getAppTitle('8queens')
        : "Jeu des 8 Dames";

      const defaultW = Math.min(760, Math.max(500, Math.round(window.innerWidth * 0.65)));
      const defaultH = Math.min(820, Math.max(540, Math.round(window.innerHeight * 0.85)));

      const bodyHtml = `
        <div class="eight-queens-app theme-${this.theme}" id="eightQueensApp-${this.id}">
          <!-- Top Stats Bar -->
          <div class="eight-queens-header">
            <div class="eight-queens-stats">
              <span class="eight-queens-stat-pill success" id="queensCountPill-${this.id}">
                👑 <span id="placedCount-${this.id}">0</span>/${this.boardSize} Dames
              </span>
              <span class="eight-queens-stat-pill" id="conflictPill-${this.id}">
                ⚡ <span id="conflictCount-${this.id}">0</span> Conflits
              </span>
              <span class="eight-queens-stat-pill">
                ⏱️ <span id="timerVal-${this.id}">00:00</span>
              </span>
              <span class="eight-queens-stat-pill">
                🎯 <span id="movesVal-${this.id}">0</span> Coups
              </span>
            </div>

            <div class="eight-queens-controls">
              <button type="button" class="eight-queens-btn" id="hintBtn-${this.id}" title="Afficher les cases sûres">
                💡 Indice
              </button>
              <button type="button" class="eight-queens-btn primary" id="solveBtn-${this.id}" title="Résoudre avec l'IA">
                🤖 Solveur
              </button>
              <button type="button" class="eight-queens-btn" id="resetBtn-${this.id}" title="Recommencer la partie">
                🔄 Recommencer
              </button>
            </div>
          </div>

          <!-- Game Arena -->
          <div class="eight-queens-body" id="boardArena-${this.id}">
            <div class="chessboard-wrapper" id="chessWrapper-${this.id}">
              <!-- Column labels (A-H) -->
              <div class="board-coords-col" id="colLabels-${this.id}"></div>
              
              <div class="chessboard-inner-row">
                <!-- Row labels (1-8) -->
                <div class="board-coords-row" id="rowLabels-${this.id}"></div>

                <!-- Grid -->
                <div class="chessboard-grid" id="chessGrid-${this.id}">
                  <canvas class="threat-canvas" id="threatCanvas-${this.id}"></canvas>
                </div>
              </div>
            </div>

            <!-- Victory Modal -->
            <div class="eight-queens-victory-modal" id="victoryModal-${this.id}" style="display:none;">
              <div class="victory-card">
                <div class="victory-crown">👑</div>
                <div class="victory-title">VICTOIRE !</div>
                <div class="victory-subtitle">Vous avez placé les ${this.boardSize} dames sans aucun conflit !</div>
                <div class="victory-stats">
                  <div class="victory-stat-item">
                    <div class="victory-stat-val" id="winTimeVal-${this.id}">00:00</div>
                    <div class="victory-stat-lbl">Temps</div>
                  </div>
                  <div class="victory-stat-item">
                    <div class="victory-stat-val" id="winMovesVal-${this.id}">0</div>
                    <div class="victory-stat-lbl">Coups</div>
                  </div>
                  <div class="victory-stat-item">
                    <div class="victory-stat-val">${this.allSolutions.length}</div>
                    <div class="victory-stat-lbl">Solutions Possibles</div>
                  </div>
                </div>
                <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                  <button type="button" class="eight-queens-btn primary" id="winPlayAgainBtn-${this.id}">
                    🔄 Rejouer
                  </button>
                  <button type="button" class="eight-queens-btn accent" id="winExploreBtn-${this.id}">
                    📋 Explorer les Solutions
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Solutions Browser Bar -->
          <div class="solution-browser-bar" id="solutionBar-${this.id}">
            <div style="display:flex;align-items:center;gap:8px;">
              <span>📚 Base : <strong>${this.allSolutions.length} solutions trouvées</strong> (${this.boardSize}x${this.boardSize})</span>
              <span id="solIndexBadge-${this.id}" style="color:var(--text-muted);"></span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <button type="button" class="eight-queens-btn" id="prevSolBtn-${this.id}">◀ Précédente</button>
              <button type="button" class="eight-queens-btn" id="nextSolBtn-${this.id}">Suivante ▶</button>
              <button type="button" class="eight-queens-btn accent" id="autoPlayBtn-${this.id}">▶ Démo Auto</button>
            </div>
          </div>
        </div>
      `;

      this.win = window.WindowManager.createWindow({
        id: this.winId,
        appId: '8queens',
        appName: appTitle,
        title: `${appTitle} (${this.boardSize}x${this.boardSize})`,
        icon: '👑',
        width: defaultW,
        height: defaultH,
        content: bodyHtml,
        onFocus: () => {
          this.updateMenuBar();
        },
        onClose: () => {
          this.stopTimer();
          this.stopAutoPlay();
          this.app.instances.delete(this.id);
        },
        onResize: () => {
          this.renderBoard();
        }
      });

      this.cacheDomElements();
      this.bindEvents();
      this.renderBoard();
      this.startTimer();
    }

    cacheDomElements() {
      this.el.app = document.getElementById(`eightQueensApp-${this.id}`);
      this.el.grid = document.getElementById(`chessGrid-${this.id}`);
      this.el.canvas = document.getElementById(`threatCanvas-${this.id}`);
      this.el.colLabels = document.getElementById(`colLabels-${this.id}`);
      this.el.rowLabels = document.getElementById(`rowLabels-${this.id}`);
      this.el.placedCount = document.getElementById(`placedCount-${this.id}`);
      this.el.conflictCount = document.getElementById(`conflictCount-${this.id}`);
      this.el.conflictPill = document.getElementById(`conflictPill-${this.id}`);
      this.el.timerVal = document.getElementById(`timerVal-${this.id}`);
      this.el.movesVal = document.getElementById(`movesVal-${this.id}`);
      this.el.victoryModal = document.getElementById(`victoryModal-${this.id}`);
      this.el.solIndexBadge = document.getElementById(`solIndexBadge-${this.id}`);
    }

    bindEvents() {
      const resetBtn = document.getElementById(`resetBtn-${this.id}`);
      const hintBtn = document.getElementById(`hintBtn-${this.id}`);
      const solveBtn = document.getElementById(`solveBtn-${this.id}`);
      const prevSolBtn = document.getElementById(`prevSolBtn-${this.id}`);
      const nextSolBtn = document.getElementById(`nextSolBtn-${this.id}`);
      const autoPlayBtn = document.getElementById(`autoPlayBtn-${this.id}`);
      const winPlayAgainBtn = document.getElementById(`winPlayAgainBtn-${this.id}`);
      const winExploreBtn = document.getElementById(`winExploreBtn-${this.id}`);

      if (resetBtn) resetBtn.onclick = () => this.restart();
      if (hintBtn) hintBtn.onclick = () => this.toggleHints();
      if (solveBtn) solveBtn.onclick = () => this.showNextSolution();
      if (prevSolBtn) prevSolBtn.onclick = () => this.showPrevSolution();
      if (nextSolBtn) nextSolBtn.onclick = () => this.showNextSolution();
      if (autoPlayBtn) autoPlayBtn.onclick = () => this.toggleAutoPlay();
      if (winPlayAgainBtn) winPlayAgainBtn.onclick = () => { this.hideVictory(); this.restart(); };
      if (winExploreBtn) winExploreBtn.onclick = () => { this.hideVictory(); this.showNextSolution(); };
    }

    updateMenuBar() {
      if (!window.MenuBarManager) return;
      window.MenuBarManager.registerAppMenu('8queens', (container) => {
        container.innerHTML = `
          <div class="app-menu-left">
            <button type="button" class="app-menu-pill" id="menu8qNewBtn">🔄 Nouvelle Partie</button>
            <button type="button" class="app-menu-pill" id="menu8qHintBtn">💡 Indice</button>
            <button type="button" class="app-menu-pill" id="menu8qSolveBtn">🤖 Résoudre</button>
            <select class="app-menu-pill" id="menu8qSizeSelect" style="background:rgba(255,255,255,0.1);color:#fff;border:none;border-radius:8px;padding:4px 8px;cursor:pointer;">
              ${[4,5,6,7,8,9,10,12].map(n => `<option value="${n}" ${n === this.boardSize ? 'selected' : ''} style="background:#1e293b;color:#fff;">Taille : ${n}x${n}</option>`).join('')}
            </select>
            <select class="app-menu-pill" id="menu8qThemeSelect" style="background:rgba(255,255,255,0.1);color:#fff;border:none;border-radius:8px;padding:4px 8px;cursor:pointer;">
              <option value="cyber" ${this.theme === 'cyber' ? 'selected' : ''} style="background:#1e293b;color:#fff;">🎨 Cyber Néon</option>
              <option value="wood" ${this.theme === 'wood' ? 'selected' : ''} style="background:#1e293b;color:#fff;">🎨 Bois Classique</option>
              <option value="emerald" ${this.theme === 'emerald' ? 'selected' : ''} style="background:#1e293b;color:#fff;">🎨 Émeraude</option>
            </select>
          </div>
          <div class="app-menu-right">
            <button type="button" class="app-menu-pill" id="menu8qFsBtn">⛶ Plein Écran</button>
          </div>
        `;

        const newBtn = container.querySelector('#menu8qNewBtn');
        const hintBtn = container.querySelector('#menu8qHintBtn');
        const solveBtn = container.querySelector('#menu8qSolveBtn');
        const sizeSelect = container.querySelector('#menu8qSizeSelect');
        const themeSelect = container.querySelector('#menu8qThemeSelect');
        const fsBtn = container.querySelector('#menu8qFsBtn');

        if (newBtn) newBtn.onclick = () => this.restart();
        if (hintBtn) hintBtn.onclick = () => this.toggleHints();
        if (solveBtn) solveBtn.onclick = () => this.showNextSolution();
        if (sizeSelect) sizeSelect.onchange = (e) => this.setBoardSize(parseInt(e.target.value, 10));
        if (themeSelect) themeSelect.onchange = (e) => this.setTheme(e.target.value);
        if (fsBtn) fsBtn.onclick = () => { if (window.WindowManager) window.WindowManager.toggleMaximize(this.winId); };
      });
      window.MenuBarManager.setActiveApp('8queens');
    }

    renderBoard() {
      if (!this.el.grid) return;
      const n = this.boardSize;

      // Calculate square size based on arena available space
      const arena = document.getElementById(`boardArena-${this.id}`);
      const maxW = arena ? (arena.clientWidth - 80) : 520;
      const maxH = arena ? (arena.clientHeight - 80) : 520;
      const boardPx = Math.min(560, Math.max(300, Math.min(maxW, maxH)));
      const cellSize = Math.floor(boardPx / n);
      const totalBoardSize = cellSize * n;

      this.el.grid.style.width = `${totalBoardSize}px`;
      this.el.grid.style.height = `${totalBoardSize}px`;
      this.el.grid.style.gridTemplateColumns = `repeat(${n}, ${cellSize}px)`;
      this.el.grid.style.gridTemplateRows = `repeat(${n}, ${cellSize}px)`;

      // Column labels (A, B, C, ...)
      const colLetters = 'ABCDEFGHIJKL'.split('').slice(0, n);
      if (this.el.colLabels) {
        this.el.colLabels.style.width = `${totalBoardSize}px`;
        this.el.colLabels.innerHTML = colLetters.map(l => `<span style="width:${cellSize}px;text-align:center;">${l}</span>`).join('');
      }

      // Row labels (1, 2, 3, ...)
      if (this.el.rowLabels) {
        this.el.rowLabels.style.height = `${totalBoardSize}px`;
        this.el.rowLabels.innerHTML = Array.from({ length: n }, (_, i) => `<span style="height:${cellSize}px;display:flex;align-items:center;">${n - i}</span>`).join('');
      }

      // Clear grid cells (preserve threat canvas)
      const existingCanvas = this.el.canvas;
      this.el.grid.innerHTML = '';
      if (existingCanvas) {
        existingCanvas.width = totalBoardSize;
        existingCanvas.height = totalBoardSize;
        this.el.grid.appendChild(existingCanvas);
      }

      const conflicts = this.getConflicts();
      const safeSpots = this.showSafeHints ? this.getSafeSpots() : new Set();

      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const isLight = (r + c) % 2 === 0;
          const cell = document.createElement('div');
          cell.className = `chess-cell ${isLight ? 'cell-light' : 'cell-dark'}`;
          cell.dataset.row = r;
          cell.dataset.col = c;
          cell.style.width = `${cellSize}px`;
          cell.style.height = `${cellSize}px`;

          const hasQueen = this.queens.some(q => q.r === r && q.c === c);
          const isConflicted = conflicts.queensWithConflict.some(q => q.r === r && q.c === c);
          const isSafe = safeSpots.has(`${r},${c}`);

          if (isSafe && !hasQueen) {
            cell.classList.add('safe-hint');
          }

          if (hasQueen) {
            const piece = document.createElement('div');
            piece.className = `queen-piece ${isConflicted ? 'conflict' : ''}`;
            piece.textContent = '👑';
            piece.style.fontSize = `${Math.round(cellSize * 0.58)}px`;
            cell.appendChild(piece);
          }

          cell.onclick = () => this.onCellClick(r, c);
          this.el.grid.appendChild(cell);
        }
      }

      this.updateStats();
      this.drawThreatRays();
    }

    onCellClick(r, c) {
      if (this.isWon) return;
      this.stopAutoPlay();
      this.solutionIndex = -1;
      if (this.el.solIndexBadge) this.el.solIndexBadge.textContent = '';

      const idx = this.queens.findIndex(q => q.r === r && q.c === c);
      if (idx !== -1) {
        // Remove queen
        this.queens.splice(idx, 1);
      } else {
        // Only allow placing up to N queens
        if (this.queens.length >= this.boardSize) {
          // If a queen is already on this row, replace it
          const rowQueenIdx = this.queens.findIndex(q => q.r === r);
          if (rowQueenIdx !== -1) {
            this.queens.splice(rowQueenIdx, 1);
          } else {
            return;
          }
        }
        this.queens.push({ r, c });
      }

      this.movesCount++;
      this.renderBoard();
      this.checkWinCondition();
    }

    getConflicts() {
      const conflicts = [];
      const conflictedQueens = new Set();

      for (let i = 0; i < this.queens.length; i++) {
        for (let j = i + 1; j < this.queens.length; j++) {
          const q1 = this.queens[i];
          const q2 = this.queens[j];

          const sameRow = (q1.r === q2.r);
          const sameCol = (q1.c === q2.c);
          const sameDiag = (Math.abs(q1.r - q2.r) === Math.abs(q1.c - q2.c));

          if (sameRow || sameCol || sameDiag) {
            conflicts.push({ q1, q2, type: sameRow ? 'row' : (sameCol ? 'col' : 'diag') });
            conflictedQueens.add(q1);
            conflictedQueens.add(q2);
          }
        }
      }

      return {
        count: conflicts.length,
        conflicts,
        queensWithConflict: Array.from(conflictedQueens)
      };
    }

    getSafeSpots() {
      const safe = new Set();
      const n = this.boardSize;

      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (this.queens.some(q => q.r === r && q.c === c)) continue;
          let ok = true;
          for (const q of this.queens) {
            if (q.r === r || q.c === c || Math.abs(q.r - r) === Math.abs(q.c - c)) {
              ok = false;
              break;
            }
          }
          if (ok) safe.add(`${r},${c}`);
        }
      }
      return safe;
    }

    drawThreatRays() {
      if (!this.el.canvas || !this.showThreatRays) return;
      const ctx = this.el.canvas.getContext('2d');
      if (!ctx) return;

      const w = this.el.canvas.width;
      const h = this.el.canvas.height;
      ctx.clearRect(0, 0, w, h);

      const n = this.boardSize;
      const cellSize = w / n;
      const { conflicts } = this.getConflicts();

      if (conflicts.length === 0) return;

      conflicts.forEach(({ q1, q2 }) => {
        const x1 = (q1.c + 0.5) * cellSize;
        const y1 = (q1.r + 0.5) * cellSize;
        const x2 = (q2.c + 0.5) * cellSize;
        const y2 = (q2.r + 0.5) * cellSize;

        // Draw laser threat ray
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();
      });
    }

    updateStats() {
      const n = this.boardSize;
      const placed = this.queens.length;
      const { count } = this.getConflicts();

      if (this.el.placedCount) this.el.placedCount.textContent = placed;
      if (this.el.conflictCount) this.el.conflictCount.textContent = count;
      if (this.el.movesVal) this.el.movesVal.textContent = this.movesCount;

      if (this.el.conflictPill) {
        if (count > 0) {
          this.el.conflictPill.className = 'eight-queens-stat-pill danger';
        } else if (placed === n) {
          this.el.conflictPill.className = 'eight-queens-stat-pill success';
        } else {
          this.el.conflictPill.className = 'eight-queens-stat-pill';
        }
      }
    }

    checkWinCondition() {
      const n = this.boardSize;
      const { count } = this.getConflicts();

      if (this.queens.length === n && count === 0 && !this.isWon) {
        this.isWon = true;
        this.stopTimer();
        this.celebrateVictory();
      }
    }

    celebrateVictory() {
      const winTimeVal = document.getElementById(`winTimeVal-${this.id}`);
      const winMovesVal = document.getElementById(`winMovesVal-${this.id}`);
      if (winTimeVal) winTimeVal.textContent = this.formatTime(this.elapsedSeconds);
      if (winMovesVal) winMovesVal.textContent = this.movesCount;

      if (this.el.victoryModal) {
        this.el.victoryModal.style.display = 'flex';
      }

      if (window.sys && window.sys.desktop && typeof window.sys.desktop.showToast === 'function') {
        window.sys.desktop.showToast(`🎉 VICTOIRE ! Échiquier ${this.boardSize}x${this.boardSize} résolu en ${this.formatTime(this.elapsedSeconds)} !`, 'success');
      }
    }

    hideVictory() {
      if (this.el.victoryModal) {
        this.el.victoryModal.style.display = 'none';
      }
    }

    toggleHints() {
      this.showSafeHints = !this.showSafeHints;
      this.renderBoard();
    }

    showNextSolution() {
      if (this.allSolutions.length === 0) return;
      this.solutionIndex = (this.solutionIndex + 1) % this.allSolutions.length;
      this.applySolution(this.solutionIndex);
    }

    showPrevSolution() {
      if (this.allSolutions.length === 0) return;
      this.solutionIndex = (this.solutionIndex - 1 + this.allSolutions.length) % this.allSolutions.length;
      this.applySolution(this.solutionIndex);
    }

    applySolution(idx) {
      const sol = this.allSolutions[idx];
      if (!sol) return;

      this.queens = sol.map((col, row) => ({ r: row, c: col }));
      this.isWon = true;
      this.stopTimer();

      if (this.el.solIndexBadge) {
        this.el.solIndexBadge.textContent = `(Solution ${idx + 1} / ${this.allSolutions.length})`;
      }

      this.renderBoard();
    }

    toggleAutoPlay() {
      if (this.autoPlayInterval) {
        this.stopAutoPlay();
      } else {
        const autoBtn = document.getElementById(`autoPlayBtn-${this.id}`);
        if (autoBtn) autoBtn.textContent = '⏸ Pause';
        this.showNextSolution();
        this.autoPlayInterval = setInterval(() => {
          this.showNextSolution();
        }, 900);
      }
    }

    stopAutoPlay() {
      if (this.autoPlayInterval) {
        clearInterval(this.autoPlayInterval);
        this.autoPlayInterval = null;
        const autoBtn = document.getElementById(`autoPlayBtn-${this.id}`);
        if (autoBtn) autoBtn.textContent = '▶ Démo Auto';
      }
    }

    startTimer() {
      this.stopTimer();
      this.startTime = Date.now();
      this.timerInterval = setInterval(() => {
        this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        if (this.el.timerVal) {
          this.el.timerVal.textContent = this.formatTime(this.elapsedSeconds);
        }
      }, 1000);
    }

    stopTimer() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    }

    formatTime(sec) {
      const m = Math.floor(sec / 60).toString().padStart(2, '0');
      const s = (sec % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    }

    restart() {
      this.stopAutoPlay();
      this.queens = [];
      this.movesCount = 0;
      this.isWon = false;
      this.solutionIndex = -1;
      if (this.el.solIndexBadge) this.el.solIndexBadge.textContent = '';
      this.hideVictory();
      this.renderBoard();
      this.startTimer();
    }

    setBoardSize(n) {
      if (n < 4 || n > 12) return;
      this.boardSize = n;
      this.computeSolutions();

      if (this.win) {
        const appTitle = (window.sys && window.sys.appManager)
          ? window.sys.appManager.getAppTitle('8queens')
          : "Jeu des 8 Dames";
        this.win.setTitle(`${appTitle} (${this.boardSize}x${this.boardSize})`);
      }

      const solBar = document.getElementById(`solutionBar-${this.id}`);
      if (solBar) {
        const strong = solBar.querySelector('strong');
        if (strong) strong.textContent = `${this.allSolutions.length} solutions trouvées`;
      }

      this.restart();
    }

    setTheme(theme) {
      this.theme = theme;
      if (this.el.app) {
        this.el.app.className = `eight-queens-app theme-${theme}`;
      }
      this.renderBoard();
    }
  }

  class WebOS8QueensApp {
    constructor() {
      this.instances = new Map();
      this.instanceCounter = 0;
    }

    t(key, replacements = {}) {
      if (window.I18nEngine) return window.I18nEngine.t(key, replacements);
      return key;
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    open(options = {}) {
      this.instanceCounter++;
      const id = this.instanceCounter;
      const instance = new EightQueensInstance(this, id, options);
      this.instances.set(id, instance);
      return instance;
    }
  }

  // Instantiate and mount WebOS Eight Queens Game App
  window.EightQueensApp = new WebOS8QueensApp();

})(window);
