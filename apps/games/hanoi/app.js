/**
 * SimpleGallery 2026 - Towers of Hanoi Game
 * Modern WebOS multi-instance puzzle app with 3 to 8 customizable disks,
 * recursive optimal solver, step-by-step hints, audio synthesizers, and victory celebrations.
 */
(function(window) {
  'use strict';

  class HanoiSoundEngine {
    get audio() { return (window.sys && window.sys.audio) || null; }
    playPickup() { if (this.audio) this.audio.playClick(); }
    playDrop() { if (this.audio) this.audio.playMove(); }
    playError() { if (this.audio) this.audio.playError(); }
    playVictory() { if (this.audio) this.audio.playWin(); }
  }

  class HanoiInstance {
    constructor(app, id, options = {}) {
      this.app = app;
      this.id = id;
      this.winId = `hanoi-${id}`;
      this.options = options;

      this.sound = new HanoiSoundEngine();
      this.diskCount = parseInt(options.diskCount, 10) || 4; // 3 to 8
      this.pegs = [[], [], []]; // Peg 0 (A), Peg 1 (B), Peg 2 (C)
      this.selectedPeg = null; // index of selected source peg (0..2)
      this.movesCount = 0;
      this.startTime = null;
      this.elapsedSeconds = 0;
      this.timerInterval = null;
      this.isWon = false;
      this.autoSolveInterval = null;

      this.win = null;
      this.el = {};

      if (window.sys && window.sys.events) {
        this.localeUnsub = window.sys.events.on('locale:changed', () => this.updateLocale());
      }

      this.initWindow();
    }

    t(key, replacements = {}) {
      return this.app.t(key, replacements);
    }

    getMinMoves() {
      return Math.pow(2, this.diskCount) - 1;
    }

    initWindow() {
      const appTitle = (window.sys && window.sys.appManager)
        ? window.sys.appManager.getAppTitle('hanoi')
        : (this.t('games.hanoi.title') || "Tours de Hanoï");

      const defaultW = Math.min(840, Math.max(540, Math.round(window.innerWidth * 0.70)));
      const defaultH = Math.min(680, Math.max(450, Math.round(window.innerHeight * 0.75)));

      const bodyHtml = `
        <div class="hanoi-app" id="hanoiApp-${this.id}">
          <!-- Header Bar -->
          <div class="hanoi-header">
            <div class="hanoi-stats">
              <span class="hanoi-stat-pill highlight" id="disksPill-${this.id}">
                🗼 <span id="diskCountVal-${this.id}">${this.diskCount}</span> Disques
              </span>
              <span class="hanoi-stat-pill">
                <span id="movesLabel-${this.id}">${this.t('games.hanoi.moves_count', { count: this.movesCount, min: this.getMinMoves() })}</span>
              </span>
              <span class="hanoi-stat-pill">
                ⏱️ <span id="timerVal-${this.id}">00:00</span>
              </span>
            </div>

            <div class="hanoi-controls">
              <button type="button" class="hanoi-btn" id="hintBtn-${this.id}" title="${this.t('games.hanoi.hint')}">
                ${this.t('games.hanoi.hint')}
              </button>
              <button type="button" class="hanoi-btn accent" id="solveBtn-${this.id}" title="${this.t('games.hanoi.auto_demo')}">
                ${this.t('games.hanoi.auto_demo')}
              </button>
              <button type="button" class="hanoi-btn primary" id="resetBtn-${this.id}" title="${this.t('games.hanoi.restart')}">
                ${this.t('games.hanoi.restart')}
              </button>
            </div>
          </div>

          <!-- Playing Arena -->
          <div class="hanoi-arena" id="hanoiArena-${this.id}">
            <div class="hanoi-stage">
              <!-- Base Platform -->
              <div class="hanoi-base-bar"></div>

              <!-- Peg A (0) -->
              <div class="hanoi-peg-col" id="pegCol-${this.id}-0" data-peg="0">
                <div class="hanoi-peg-pole"></div>
                <div class="hanoi-disks-stack" id="pegStack-${this.id}-0"></div>
                <div class="hanoi-peg-label">${this.t('games.hanoi.peg_a')}</div>
              </div>

              <!-- Peg B (1) -->
              <div class="hanoi-peg-col" id="pegCol-${this.id}-1" data-peg="1">
                <div class="hanoi-peg-pole"></div>
                <div class="hanoi-disks-stack" id="pegStack-${this.id}-1"></div>
                <div class="hanoi-peg-label">${this.t('games.hanoi.peg_b')}</div>
              </div>

              <!-- Peg C (2) -->
              <div class="hanoi-peg-col" id="pegCol-${this.id}-2" data-peg="2">
                <div class="hanoi-peg-pole"></div>
                <div class="hanoi-disks-stack" id="pegStack-${this.id}-2"></div>
                <div class="hanoi-peg-label">${this.t('games.hanoi.peg_c')}</div>
              </div>
            </div>

            <!-- Victory Modal -->
            <div class="hanoi-modal" id="victoryModal-${this.id}" style="display:none;">
              <div class="hanoi-card">
                <div class="hanoi-card-title">${this.t('games.hanoi.victory_title')}</div>
                <div class="hanoi-stars" id="winStars-${this.id}">⭐⭐⭐</div>
                <p id="winMsg-${this.id}" style="color:#e2e8f0;margin-bottom:1.5rem;font-weight:600;"></p>
                <div style="display:flex;gap:12px;justify-content:center;">
                  <button type="button" class="hanoi-btn primary" id="winPlayAgainBtn-${this.id}">
                    ${this.t('games.hanoi.play_again')}
                  </button>
                  <button type="button" class="hanoi-btn accent" id="winNextLevelBtn-${this.id}">
                    ${this.t('games.hanoi.next_level')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      this.win = window.WindowManager.createWindow({
        id: this.winId,
        appId: 'hanoi',
        appName: appTitle,
        title: `${appTitle} (${this.diskCount} disques)`,
        icon: '🗼',
        width: defaultW,
        height: defaultH,
        content: bodyHtml,
        onFocus: () => {
          this.updateMenuBar();
        },
        onLocaleChanged: () => {
          this.updateLocale();
        },
        onClose: () => {
          if (this.localeUnsub) this.localeUnsub();
          this.stopTimer();
          this.stopAutoSolve();
          this.app.instances.delete(this.id);
        }
      });

      this.cacheDom();
      this.bindEvents();
      this.resetPuzzle();
    }

    cacheDom() {
      this.el.app = document.getElementById(`hanoiApp-${this.id}`);
      this.el.movesLabel = document.getElementById(`movesLabel-${this.id}`);
      this.el.timerVal = document.getElementById(`timerVal-${this.id}`);
      this.el.diskCountVal = document.getElementById(`diskCountVal-${this.id}`);
      this.el.victoryModal = document.getElementById(`victoryModal-${this.id}`);
      this.el.winStars = document.getElementById(`winStars-${this.id}`);
      this.el.winMsg = document.getElementById(`winMsg-${this.id}`);

      this.el.pegCols = [
        document.getElementById(`pegCol-${this.id}-0`),
        document.getElementById(`pegCol-${this.id}-1`),
        document.getElementById(`pegCol-${this.id}-2`)
      ];

      this.el.pegStacks = [
        document.getElementById(`pegStack-${this.id}-0`),
        document.getElementById(`pegStack-${this.id}-1`),
        document.getElementById(`pegStack-${this.id}-2`)
      ];
    }

    bindEvents() {
      const resetBtn = document.getElementById(`resetBtn-${this.id}`);
      const hintBtn = document.getElementById(`hintBtn-${this.id}`);
      const solveBtn = document.getElementById(`solveBtn-${this.id}`);
      const winPlayAgainBtn = document.getElementById(`winPlayAgainBtn-${this.id}`);
      const winNextLevelBtn = document.getElementById(`winNextLevelBtn-${this.id}`);

      if (resetBtn) resetBtn.onclick = () => this.resetPuzzle();
      if (hintBtn) hintBtn.onclick = () => this.showHint();
      if (solveBtn) solveBtn.onclick = () => this.toggleAutoSolve();
      if (winPlayAgainBtn) winPlayAgainBtn.onclick = () => { this.hideVictory(); this.resetPuzzle(); };
      if (winNextLevelBtn) winNextLevelBtn.onclick = () => {
        this.hideVictory();
        this.setDiskCount(Math.min(8, this.diskCount + 1));
      };

      this.el.pegCols.forEach((col, idx) => {
        if (col) {
          col.onclick = () => this.onPegClick(idx);
        }
      });
    }

    updateMenuBar() {
      if (!window.MenuBarManager) return;
      window.MenuBarManager.registerAppMenu('hanoi', (container) => {
        container.innerHTML = `
          <div class="app-menu-left">
            <button type="button" class="app-menu-pill" id="menuHanoiNewBtn">${this.t('games.hanoi.restart')}</button>
            <button type="button" class="app-menu-pill" id="menuHanoiHintBtn">${this.t('games.hanoi.hint')}</button>
            <button type="button" class="app-menu-pill" id="menuHanoiSolveBtn">${this.autoSolveInterval ? this.t('games.hanoi.pause_demo') : this.t('games.hanoi.auto_demo')}</button>
            <select class="app-menu-pill" id="menuHanoiDisksSelect" style="background:rgba(255,255,255,0.1);color:#fff;border:none;border-radius:8px;padding:4px 8px;cursor:pointer;">
              ${[3,4,5,6,7,8].map(n => `<option value="${n}" ${n === this.diskCount ? 'selected' : ''} style="background:#1e1b4b;color:#fff;">${this.t('games.hanoi.disks_select', { count: n, moves: Math.pow(2,n)-1 })}</option>`).join('')}
            </select>
          </div>
          <div class="app-menu-right">
            <button type="button" class="app-menu-pill" id="menuHanoiFsBtn">${this.t('games.hanoi.fullscreen')}</button>
          </div>
        `;

        const newBtn = container.querySelector('#menuHanoiNewBtn');
        const hintBtn = container.querySelector('#menuHanoiHintBtn');
        const solveBtn = container.querySelector('#menuHanoiSolveBtn');
        const disksSelect = container.querySelector('#menuHanoiDisksSelect');
        const fsBtn = container.querySelector('#menuHanoiFsBtn');

        if (newBtn) newBtn.onclick = () => this.resetPuzzle();
        if (hintBtn) hintBtn.onclick = () => this.showHint();
        if (solveBtn) solveBtn.onclick = () => this.toggleAutoSolve();
        if (disksSelect) disksSelect.onchange = (e) => this.setDiskCount(parseInt(e.target.value, 10));
        if (fsBtn) fsBtn.onclick = () => { if (window.WindowManager) window.WindowManager.toggleMaximize(this.winId); };
      });
      window.MenuBarManager.setActiveApp('hanoi');
    }

    resetPuzzle() {
      this.stopAutoSolve();
      this.pegs = [[], [], []];
      for (let i = this.diskCount; i >= 1; i--) {
        this.pegs[0].push(i);
      }
      this.selectedPeg = null;
      this.movesCount = 0;
      this.isWon = false;
      this.clearHints();
      this.hideVictory();
      this.renderTowers();
      this.startTimer();
    }

    setDiskCount(count) {
      if (count < 3 || count > 8) return;
      this.diskCount = count;
      if (window.WindowManager) {
        const appTitle = (window.sys && window.sys.appManager)
          ? window.sys.appManager.getAppTitle('hanoi')
          : (this.t('games.hanoi.title') || "Tours de Hanoï");
        window.WindowManager.setTitle(this.winId, `${appTitle} (${this.diskCount} disques)`);
      }
      if (this.el.diskCountVal) this.el.diskCountVal.textContent = this.diskCount;
      this.resetPuzzle();
    }

    onPegClick(pegIdx) {
      if (this.isWon || this.autoSolveInterval) return;
      this.clearHints();

      // Case 1: No peg selected -> Pick up top disk of clicked peg
      if (this.selectedPeg === null) {
        if (this.pegs[pegIdx].length === 0) return; // empty peg
        this.selectedPeg = pegIdx;
        this.sound.playPickup();
        this.renderTowers();
        return;
      }

      // Case 2: Clicked the same peg -> Deselect
      if (this.selectedPeg === pegIdx) {
        this.selectedPeg = null;
        this.renderTowers();
        return;
      }

      // Case 3: Transfer disk from selectedPeg to pegIdx
      const fromStack = this.pegs[this.selectedPeg];
      const toStack = this.pegs[pegIdx];
      const movingDisk = fromStack[fromStack.length - 1];
      const targetTopDisk = toStack.length > 0 ? toStack[toStack.length - 1] : Infinity;

      if (movingDisk > targetTopDisk) {
        // ILLEGAL MOVE: Cannot put larger disk on top of smaller disk!
        this.sound.playError();
        if (window.sys && window.sys.desktop && typeof window.sys.desktop.showToast === 'function') {
          window.sys.desktop.showToast(this.t('games.hanoi.illegal_move'), "warning");
        }
        this.selectedPeg = null;
        this.renderTowers();
        return;
      }

      // Legal move!
      fromStack.pop();
      toStack.push(movingDisk);
      this.movesCount++;
      this.selectedPeg = null;
      this.sound.playDrop();
      this.renderTowers();
      this.checkWinCondition();
    }

    renderTowers() {
      if (this.el.movesLabel) {
        this.el.movesLabel.innerHTML = this.t('games.hanoi.moves_count', { count: this.movesCount, min: this.getMinMoves() });
      }

      this.pegs.forEach((stack, pegIdx) => {
        const stackEl = this.el.pegStacks[pegIdx];
        const colEl = this.el.pegCols[pegIdx];
        if (!stackEl || !colEl) return;

        stackEl.innerHTML = '';
        if (this.selectedPeg === pegIdx) {
          colEl.classList.add('source-active');
        } else {
          colEl.classList.remove('source-active');
        }

        stack.forEach((diskVal, diskIdx) => {
          const diskEl = document.createElement('div');
          const isTop = (diskIdx === stack.length - 1);
          const isSelected = (this.selectedPeg === pegIdx && isTop);

          diskEl.className = `hanoi-disk disk-${diskVal} ${isSelected ? 'selected' : ''}`;
          diskEl.textContent = diskVal;
          stackEl.appendChild(diskEl);
        });
      });
    }

    checkWinCondition() {
      // Victory if all disks are on Peg C (2)
      if (this.pegs[2].length === this.diskCount) {
        this.isWon = true;
        this.stopTimer();
        this.sound.playVictory();
        this.celebrateVictory();
      }
    }

    celebrateVictory() {
      const min = this.getMinMoves();
      const moves = this.movesCount;
      const efficiency = Math.round((min / moves) * 100);

      let stars = '⭐⭐⭐';
      if (moves > min * 1.5) stars = '⭐';
      else if (moves > min) stars = '⭐⭐';

      if (this.el.winStars) this.el.winStars.textContent = stars;
      if (this.el.winMsg) {
        this.el.winMsg.textContent = this.t('games.hanoi.victory_msg', {
          moves,
          min,
          time: this.formatTime(this.elapsedSeconds),
          efficiency
        });
      }
      if (this.el.victoryModal) {
        this.el.victoryModal.style.display = 'flex';
      }

      if (window.sys && window.sys.desktop && typeof window.sys.desktop.showToast === 'function') {
        window.sys.desktop.showToast(`🎉 ${this.t('games.hanoi.victory_title')}`, 'success');
      }
    }

    hideVictory() {
      if (this.el.victoryModal) {
        this.el.victoryModal.style.display = 'none';
      }
    }

    clearHints() {
      this.el.pegCols.forEach(col => {
        if (col) {
          col.classList.remove('hint-source', 'hint-target');
        }
      });
    }

    showHint() {
      const moves = [];
      const solve = (n, from, to, aux) => {
        if (n === 1) {
          moves.push({ from, to });
          return;
        }
        solve(n - 1, from, aux, to);
        moves.push({ from, to });
        solve(n - 1, aux, to, from);
      };

      solve(this.diskCount, 0, 2, 1);
      const nextMove = moves[this.movesCount % moves.length];
      if (!nextMove) return;

      this.clearHints();
      if (this.el.pegCols[nextMove.from]) this.el.pegCols[nextMove.from].classList.add('hint-source');
      if (this.el.pegCols[nextMove.to]) this.el.pegCols[nextMove.to].classList.add('hint-target');

      if (window.sys && window.sys.desktop && typeof window.sys.desktop.showToast === 'function') {
        const pegNames = ['A', 'B', 'C'];
        window.sys.desktop.showToast(this.t('games.hanoi.hint_msg', { from: pegNames[nextMove.from], to: pegNames[nextMove.to] }), 'info');
      }
    }

    toggleAutoSolve() {
      if (this.autoSolveInterval) {
        this.stopAutoSolve();
      } else {
        this.resetPuzzle();
        const solveBtn = document.getElementById(`solveBtn-${this.id}`);
        if (solveBtn) solveBtn.textContent = this.t('games.hanoi.pause_demo');

        const moves = [];
        const solve = (n, from, to, aux) => {
          if (n === 1) {
            moves.push({ from, to });
            return;
          }
          solve(n - 1, from, aux, to);
          moves.push({ from, to });
          solve(n - 1, aux, to, from);
        };
        solve(this.diskCount, 0, 2, 1);

        let step = 0;
        this.autoSolveInterval = setInterval(() => {
          if (step >= moves.length) {
            this.stopAutoSolve();
            return;
          }
          const m = moves[step];
          const disk = this.pegs[m.from].pop();
          this.pegs[m.to].push(disk);
          this.movesCount++;
          this.sound.playDrop();
          this.renderTowers();
          step++;

          if (step >= moves.length) {
            this.stopAutoSolve();
            this.checkWinCondition();
          }
        }, 550);
      }
    }

    stopAutoSolve() {
      if (this.autoSolveInterval) {
        clearInterval(this.autoSolveInterval);
        this.autoSolveInterval = null;
        const solveBtn = document.getElementById(`solveBtn-${this.id}`);
        if (solveBtn) solveBtn.textContent = this.t('games.hanoi.auto_demo');
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

    updateLocale() {
      const appTitle = (window.sys && window.sys.appManager)
        ? window.sys.appManager.getAppTitle('hanoi')
        : (this.t('games.hanoi.title') || "Tours de Hanoï");

      if (window.WindowManager) {
        window.WindowManager.setTitle(this.winId, `${appTitle} (${this.diskCount} disques)`);
      }

      if (this.el.diskCountVal) this.el.diskCountVal.textContent = this.diskCount;
      if (this.el.movesLabel) {
        this.el.movesLabel.innerHTML = this.t('games.hanoi.moves_count', { count: this.movesCount, min: this.getMinMoves() });
      }

      const hintBtn = document.getElementById(`hintBtn-${this.id}`);
      const solveBtn = document.getElementById(`solveBtn-${this.id}`);
      const resetBtn = document.getElementById(`resetBtn-${this.id}`);
      const winPlayAgainBtn = document.getElementById(`winPlayAgainBtn-${this.id}`);
      const winNextLevelBtn = document.getElementById(`winNextLevelBtn-${this.id}`);
      const winTitle = this.el.victoryModal ? this.el.victoryModal.querySelector('.hanoi-card-title') : null;

      if (hintBtn) { hintBtn.textContent = this.t('games.hanoi.hint'); hintBtn.title = this.t('games.hanoi.hint'); }
      if (solveBtn) { solveBtn.textContent = this.autoSolveInterval ? this.t('games.hanoi.pause_demo') : this.t('games.hanoi.auto_demo'); }
      if (resetBtn) { resetBtn.textContent = this.t('games.hanoi.restart'); resetBtn.title = this.t('games.hanoi.restart'); }
      if (winPlayAgainBtn) winPlayAgainBtn.textContent = this.t('games.hanoi.play_again');
      if (winNextLevelBtn) winNextLevelBtn.textContent = this.t('games.hanoi.next_level');
      if (winTitle) winTitle.textContent = this.t('games.hanoi.victory_title');

      const pegNames = [this.t('games.hanoi.peg_a'), this.t('games.hanoi.peg_b'), this.t('games.hanoi.peg_c')];
      this.el.pegCols.forEach((col, idx) => {
        if (col) {
          const lbl = col.querySelector('.hanoi-peg-label');
          if (lbl) lbl.textContent = pegNames[idx];
        }
      });

      if (this.isWon) {
        this.celebrateVictory();
      }

      this.updateMenuBar();
    }
  }

  const WebOSGameApp = (window.sys && window.sys.GameApp) || window.WebOSGameApp || Object;

  class WebOSHanoiApp extends WebOSGameApp {
    constructor() {
      super({
        id: 'hanoi',
        title: 'apps.hanoi.title',
        icon: '🗼'
      });
      this.instances = new Map();
      this.instanceCounter = 0;
    }

    open(options = {}) {
      this.instanceCounter++;
      const id = this.instanceCounter;
      const instance = new HanoiInstance(this, id, options);
      this.instances.set(id, instance);
      return instance;
    }

    onLocaleChanged() {
      this.instances.forEach(inst => inst.updateLocale());
    }
  }

  // Instantiate and mount WebOS Hanoi App
  const hanoiApp = new WebOSHanoiApp();
  window.HanoiApp = hanoiApp;
  window.hanoiApp = hanoiApp;

  if (window.sys && window.sys.appManager) {
    window.sys.appManager.registerInstance('hanoi', hanoiApp);
  }

})(window);
