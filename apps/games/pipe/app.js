/**
 * SimpleGallery 2026 - Pipe Connect & Netwalk Game
 * Modern WebOS multi-instance puzzle app with procedural spanning-tree generation,
 * wrap-around circular map (torus) mode, real-time energy flow propagation, hint solver, and sound FX.
 */
(function(window) {
  'use strict';

  class PipeSoundEngine {
    constructor() {
      this.ctx = null;
    }

    ensureContext() {
      if (!this.ctx && typeof AudioContext !== 'undefined') {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playRotate() {
      try {
        this.ensureContext();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.05);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
      } catch (e) {}
    }

    playFlow() {
      try {
        this.ensureContext();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.linearRampToValueAtTime(720, now + 0.08);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.11);
      } catch (e) {}
    }

    playVictory() {
      try {
        this.ensureContext();
        if (!this.ctx) return;
        const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
        notes.forEach((freq, i) => {
          const now = this.ctx.currentTime + i * 0.1;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.38);
        });
      } catch (e) {}
    }
  }

  class PipeInstance {
    constructor(app, id, options = {}) {
      this.app = app;
      this.id = id;
      this.winId = `pipe-${id}`;
      this.options = options;

      this.sound = new PipeSoundEngine();
      this.gridSize = parseInt(options.gridSize, 10) || 5; // 4 to 8
      this.isWrapAround = (options.wrap === true || options.isWrapAround === true); // Torus mode
      
      this.grid = []; // 2D array of cells: { r, c, baseMask: [U,R,D,L], currentAngle: 0, targetAngle: 0, connected: false }
      this.source = { r: 0, c: 0 };
      this.movesCount = 0;
      this.startTime = null;
      this.elapsedSeconds = 0;
      this.timerInterval = null;
      this.isWon = false;
      this.autoSolving = false;

      this.win = null;
      this.el = {};

      this.initWindow();
    }

    t(key, replacements = {}) {
      return this.app.t(key, replacements);
    }

    initWindow() {
      const appTitle = (window.sys && window.sys.appManager)
        ? window.sys.appManager.getAppTitle('pipe')
        : (this.t('games.pipe.title') || "Tuyaux & Réseau Connecté");

      const defaultW = Math.min(760, Math.max(500, Math.round(window.innerWidth * 0.65)));
      const defaultH = Math.min(820, Math.max(540, Math.round(window.innerHeight * 0.85)));

      const bodyHtml = `
        <div class="pipe-app" id="pipeApp-${this.id}">
          <!-- Header Bar -->
          <div class="pipe-header">
            <div class="pipe-stats">
              <span class="pipe-stat-pill connected" id="connectedPill-${this.id}">
                ⚡ <span id="connectedCount-${this.id}">0</span>/<span id="totalCellsCount-${this.id}">${this.gridSize * this.gridSize}</span> Connectés
              </span>
              <span class="pipe-stat-pill ${this.isWrapAround ? 'wrap-mode' : ''}" id="wrapModePill-${this.id}">
                ${this.isWrapAround ? this.t('games.pipe.wrap_on') : this.t('games.pipe.wrap_off')}
              </span>
              <span class="pipe-stat-pill">
                ⏱️ <span id="timerVal-${this.id}">00:00</span>
              </span>
              <span class="pipe-stat-pill">
                🎯 <span id="movesVal-${this.id}">0</span> Rotations
              </span>
            </div>

            <div class="pipe-controls">
              <button type="button" class="pipe-btn" id="hintBtn-${this.id}" title="${this.t('games.pipe.hint')}">
                ${this.t('games.pipe.hint')}
              </button>
              <button type="button" class="pipe-btn accent" id="solveBtn-${this.id}" title="${this.t('games.pipe.solver')}">
                ${this.t('games.pipe.solver')}
              </button>
              <button type="button" class="pipe-btn primary" id="resetBtn-${this.id}" title="${this.t('games.pipe.new_puzzle')}">
                ${this.t('games.pipe.new_puzzle')}
              </button>
            </div>
          </div>

          <!-- Arena -->
          <div class="pipe-arena" id="pipeArena-${this.id}">
            <div class="pipe-grid-wrapper ${this.isWrapAround ? 'circular-wrap' : ''}" id="gridWrapper-${this.id}">
              ${this.isWrapAround ? `
                <div class="wrap-indicator-top">${this.t('games.pipe.wrap_north')}</div>
                <div class="wrap-indicator-bottom">${this.t('games.pipe.wrap_south')}</div>
                <div class="wrap-indicator-left">${this.t('games.pipe.wrap_west')}</div>
                <div class="wrap-indicator-right">${this.t('games.pipe.wrap_east')}</div>
              ` : ''}
              <div class="pipe-grid" id="pipeGrid-${this.id}"></div>
            </div>

            <!-- Victory Modal -->
            <div class="pipe-modal" id="victoryModal-${this.id}" style="display:none;">
              <div class="pipe-card">
                <div style="font-size:3.5rem;margin-bottom:0.5rem;">⚡</div>
                <div class="pipe-card-title">${this.t('games.pipe.victory_title')}</div>
                <p id="winMsg-${this.id}" style="color:#e2e8f0;margin-bottom:1.5rem;font-weight:600;"></p>
                <div style="display:flex;gap:12px;justify-content:center;">
                  <button type="button" class="pipe-btn primary" id="winPlayAgainBtn-${this.id}">
                    ${this.t('games.pipe.play_again')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      this.win = window.WindowManager.createWindow({
        id: this.winId,
        appId: 'pipe',
        appName: appTitle,
        title: `${appTitle} (${this.gridSize}x${this.gridSize}${this.isWrapAround ? ' - ' + this.t('games.pipe.wrap_on') : ''})`,
        icon: '🔧',
        width: defaultW,
        height: defaultH,
        content: bodyHtml,
        onFocus: () => {
          this.updateMenuBar();
        },
        onClose: () => {
          this.stopTimer();
          this.app.instances.delete(this.id);
        },
        onResize: () => {
          this.resizeGrid();
        }
      });

      this.cacheDom();
      this.bindEvents();
      this.generatePuzzle();
    }

    cacheDom() {
      this.el.app = document.getElementById(`pipeApp-${this.id}`);
      this.el.grid = document.getElementById(`pipeGrid-${this.id}`);
      this.el.gridWrapper = document.getElementById(`gridWrapper-${this.id}`);
      this.el.connectedCount = document.getElementById(`connectedCount-${this.id}`);
      this.el.totalCellsCount = document.getElementById(`totalCellsCount-${this.id}`);
      this.el.timerVal = document.getElementById(`timerVal-${this.id}`);
      this.el.movesVal = document.getElementById(`movesVal-${this.id}`);
      this.el.wrapModePill = document.getElementById(`wrapModePill-${this.id}`);
      this.el.victoryModal = document.getElementById(`victoryModal-${this.id}`);
      this.el.winMsg = document.getElementById(`winMsg-${this.id}`);
    }

    bindEvents() {
      const resetBtn = document.getElementById(`resetBtn-${this.id}`);
      const hintBtn = document.getElementById(`hintBtn-${this.id}`);
      const solveBtn = document.getElementById(`solveBtn-${this.id}`);
      const winPlayAgainBtn = document.getElementById(`winPlayAgainBtn-${this.id}`);

      if (resetBtn) resetBtn.onclick = () => this.generatePuzzle();
      if (hintBtn) hintBtn.onclick = () => this.showHint();
      if (solveBtn) solveBtn.onclick = () => this.autoSolve();
      if (winPlayAgainBtn) winPlayAgainBtn.onclick = () => { this.hideVictory(); this.generatePuzzle(); };
    }

    updateMenuBar() {
      if (!window.MenuBarManager) return;
      window.MenuBarManager.registerAppMenu('pipe', (container) => {
        container.innerHTML = `
          <div class="app-menu-left">
            <button type="button" class="app-menu-pill" id="menuPipeNewBtn">${this.t('games.pipe.new_puzzle')}</button>
            <button type="button" class="app-menu-pill" id="menuPipeHintBtn">${this.t('games.pipe.hint')}</button>
            <button type="button" class="app-menu-pill" id="menuPipeSolveBtn">${this.t('games.pipe.solver')}</button>
            <button type="button" class="app-menu-pill ${this.isWrapAround ? 'active' : ''}" id="menuPipeWrapBtn">
              ${this.isWrapAround ? this.t('games.pipe.wrap_btn_on') : this.t('games.pipe.wrap_btn_off')}
            </button>
            <select class="app-menu-pill" id="menuPipeSizeSelect" style="background:rgba(255,255,255,0.1);color:#fff;border:none;border-radius:8px;padding:4px 8px;cursor:pointer;">
              ${[4,5,6,7,8].map(n => `<option value="${n}" ${n === this.gridSize ? 'selected' : ''} style="background:#0f172a;color:#fff;">${this.t('games.pipe.size_select', { size: n })}</option>`).join('')}
            </select>
          </div>
          <div class="app-menu-right">
            <button type="button" class="app-menu-pill" id="menuPipeFsBtn">${this.t('games.pipe.fullscreen')}</button>
          </div>
        `;

        const newBtn = container.querySelector('#menuPipeNewBtn');
        const hintBtn = container.querySelector('#menuPipeHintBtn');
        const solveBtn = container.querySelector('#menuPipeSolveBtn');
        const wrapBtn = container.querySelector('#menuPipeWrapBtn');
        const sizeSelect = container.querySelector('#menuPipeSizeSelect');
        const fsBtn = container.querySelector('#menuPipeFsBtn');

        if (newBtn) newBtn.onclick = () => this.generatePuzzle();
        if (hintBtn) hintBtn.onclick = () => this.showHint();
        if (solveBtn) solveBtn.onclick = () => this.autoSolve();
        if (wrapBtn) wrapBtn.onclick = () => this.toggleWrapAround();
        if (sizeSelect) sizeSelect.onchange = (e) => this.setGridSize(parseInt(e.target.value, 10));
        if (fsBtn) fsBtn.onclick = () => { if (window.WindowManager) window.WindowManager.toggleMaximize(this.winId); };
      });
      window.MenuBarManager.setActiveApp('pipe');
    }

    toggleWrapAround() {
      this.isWrapAround = !this.isWrapAround;
      if (this.win) {
        const appTitle = (window.sys && window.sys.appManager)
          ? window.sys.appManager.getAppTitle('pipe')
          : (this.t('games.pipe.title') || "Tuyaux & Réseau Connecté");
        this.win.setTitle(`${appTitle} (${this.gridSize}x${this.gridSize}${this.isWrapAround ? ' - ' + this.t('games.pipe.wrap_on') : ''})`);
      }
      if (this.el.wrapModePill) {
        this.el.wrapModePill.className = `pipe-stat-pill ${this.isWrapAround ? 'wrap-mode' : ''}`;
        this.el.wrapModePill.textContent = this.isWrapAround ? this.t('games.pipe.wrap_on') : this.t('games.pipe.wrap_off');
      }
      if (this.el.gridWrapper) {
        if (this.isWrapAround) {
          this.el.gridWrapper.classList.add('circular-wrap');
        } else {
          this.el.gridWrapper.classList.remove('circular-wrap');
        }
      }
      this.updateMenuBar();
      this.generatePuzzle();
    }

    setGridSize(n) {
      if (n < 3 || n > 10) return;
      this.gridSize = n;
      if (this.win) {
        const appTitle = (window.sys && window.sys.appManager)
          ? window.sys.appManager.getAppTitle('pipe')
          : (this.t('games.pipe.title') || "Tuyaux & Réseau Connecté");
        this.win.setTitle(`${appTitle} (${this.gridSize}x${this.gridSize}${this.isWrapAround ? ' - ' + this.t('games.pipe.wrap_on') : ''})`);
      }
      if (this.el.totalCellsCount) this.el.totalCellsCount.textContent = n * n;
      this.generatePuzzle();
    }

    /**
     * Procedural Spanning-Tree Puzzle Generator
     */
    generatePuzzle() {
      const n = this.gridSize;
      const total = n * n;
      this.source = { r: Math.floor(n / 2), c: Math.floor(n / 2) };

      // Initialize empty grid [U, R, D, L]
      this.grid = [];
      for (let r = 0; r < n; r++) {
        const row = [];
        for (let c = 0; c < n; c++) {
          row.push({
            r,
            c,
            baseMask: [0, 0, 0, 0], // [Up, Right, Down, Left]
            currentAngle: 0,
            targetAngle: 0,
            solutionAngle: 0,
            connected: false,
            isSource: (r === this.source.r && c === this.source.c)
          });
        }
        this.grid.push(row);
      }

      // Generate Spanning Tree with randomized DFS
      const visited = new Set();
      const stack = [{ r: this.source.r, c: this.source.c }];
      visited.add(`${this.source.r},${this.source.c}`);

      const DIRS = [
        { dr: -1, dc: 0, outDir: 0, inDir: 2 }, // Up
        { dr: 0, dc: 1, outDir: 1, inDir: 3 },  // Right
        { dr: 1, dc: 0, outDir: 2, inDir: 0 },  // Down
        { dr: 0, dc: -1, outDir: 3, inDir: 1 }  // Left
      ];

      while (stack.length > 0) {
        const curr = stack[stack.length - 1];
        const neighbors = [];

        DIRS.forEach(d => {
          let nr = curr.r + d.dr;
          let nc = curr.c + d.dc;

          if (this.isWrapAround) {
            nr = (nr + n) % n;
            nc = (nc + n) % n;
          }

          if (nr >= 0 && nr < n && nc >= 0 && nc < n && !visited.has(`${nr},${nc}`)) {
            neighbors.push({ nr, nc, outDir: d.outDir, inDir: d.inDir });
          }
        });

        if (neighbors.length > 0) {
          const chosen = neighbors[Math.floor(Math.random() * neighbors.length)];
          // Connect current cell to chosen neighbor
          this.grid[curr.r][curr.c].baseMask[chosen.outDir] = 1;
          this.grid[chosen.nr][chosen.nc].baseMask[chosen.inDir] = 1;

          visited.add(`${chosen.nr},${chosen.nc}`);
          stack.push({ r: chosen.nr, c: chosen.nc });
        } else {
          stack.pop();
        }
      }

      // Scramble: Randomly rotate each tile (except optionally the source hub)
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const cell = this.grid[r][c];
          cell.solutionAngle = 0; // The baseMask is the solution

          const randTurns = Math.floor(Math.random() * 4); // 0, 1, 2, 3 turns of 90 deg
          cell.currentAngle = randTurns * 90;
          cell.targetAngle = cell.currentAngle;
        }
      }

      this.movesCount = 0;
      this.isWon = false;
      this.hideVictory();
      this.renderGrid();
      this.recalculateFlow();
      this.startTimer();
    }

    /**
     * Calculates active port mask after applying current rotation angle
     */
    getRotatedMask(cell) {
      const turns = Math.round((cell.currentAngle % 360 + 360) % 360 / 90);
      const mask = [...cell.baseMask];
      // Clockwise shift by turns
      for (let t = 0; t < turns; t++) {
        const last = mask.pop();
        mask.unshift(last);
      }
      return mask; // [Up, Right, Down, Left]
    }

    /**
     * Propagates energy / fluid flow starting from the source hub
     */
    recalculateFlow() {
      const n = this.gridSize;
      // Reset connected state
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          this.grid[r][c].connected = false;
        }
      }

      const sourceCell = this.grid[this.source.r][this.source.c];
      sourceCell.connected = true;

      const queue = [sourceCell];
      const visited = new Set([`${this.source.r},${this.source.c}`]);

      const DIRS = [
        { dr: -1, dc: 0, outDir: 0, inDir: 2 }, // Up
        { dr: 0, dc: 1, outDir: 1, inDir: 3 },  // Right
        { dr: 1, dc: 0, outDir: 2, inDir: 0 },  // Down
        { dr: 0, dc: -1, outDir: 3, inDir: 1 }  // Left
      ];

      let connectedCount = 1;

      while (queue.length > 0) {
        const curr = queue.shift();
        const currMask = this.getRotatedMask(curr);

        DIRS.forEach(d => {
          if (currMask[d.outDir] === 1) {
            let nr = curr.r + d.dr;
            let nc = curr.c + d.dc;

            if (this.isWrapAround) {
              nr = (nr + n) % n;
              nc = (nc + n) % n;
            }

            if (nr >= 0 && nr < n && nc >= 0 && nc < n) {
              const neighbor = this.grid[nr][nc];
              const neighborMask = this.getRotatedMask(neighbor);

              // Check if neighbor opens back towards curr
              if (neighborMask[d.inDir] === 1) {
                if (!visited.has(`${nr},${nc}`)) {
                  visited.add(`${nr},${nc}`);
                  neighbor.connected = true;
                  connectedCount++;
                  queue.push(neighbor);
                }
              }
            }
          }
        });
      }

      // Update UI connected count
      if (this.el.connectedCount) this.el.connectedCount.textContent = connectedCount;

      // Update DOM cell classes
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const cellEl = document.getElementById(`pipeCell-${this.id}-${r}-${c}`);
          if (cellEl) {
            if (this.grid[r][c].connected) {
              cellEl.classList.add('connected');
            } else {
              cellEl.classList.remove('connected');
            }
          }
        }
      }

      // Check Win Condition: All cells connected & NO dead-end open leaks
      if (connectedCount === n * n && !this.isWon) {
        let hasLeak = false;
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            const cell = this.grid[r][c];
            const mask = this.getRotatedMask(cell);
            DIRS.forEach(d => {
              if (mask[d.outDir] === 1) {
                let nr = r + d.dr;
                let nc = c + d.dc;
                if (this.isWrapAround) {
                  nr = (nr + n) % n;
                  nc = (nc + n) % n;
                }
                if (nr < 0 || nr >= n || nc < 0 || nc >= n) {
                  hasLeak = true;
                } else {
                  const nMask = this.getRotatedMask(this.grid[nr][nc]);
                  if (nMask[d.inDir] !== 1) {
                    hasLeak = true;
                  }
                }
              }
            });
          }
        }

        if (!hasLeak) {
          this.isWon = true;
          this.stopTimer();
          this.sound.playVictory();
          this.celebrateVictory();
        }
      }
    }

    renderGrid() {
      if (!this.el.grid) return;
      const n = this.gridSize;
      this.el.grid.innerHTML = '';
      this.el.grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
      this.el.grid.style.gridTemplateRows = `repeat(${n}, 1fr)`;

      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const cell = this.grid[r][c];
          const cellEl = document.createElement('div');
          cellEl.className = `pipe-cell ${cell.isSource ? 'source-cell' : ''}`;
          cellEl.id = `pipeCell-${this.id}-${r}-${c}`;

          const svg = this.createPipeSvg(cell);
          cellEl.appendChild(svg);

          // Left Click = Clockwise 90 deg
          cellEl.onclick = (e) => {
            e.preventDefault();
            this.rotateCell(r, c, 90);
          };

          // Right Click = Counter-Clockwise 90 deg
          cellEl.oncontextmenu = (e) => {
            e.preventDefault();
            this.rotateCell(r, c, -90);
          };

          this.el.grid.appendChild(cellEl);
        }
      }

      this.resizeGrid();
    }

    resizeGrid() {
      const arena = document.getElementById(`pipeArena-${this.id}`);
      if (!arena || !this.el.grid) return;

      const availW = arena.clientWidth - 80;
      const availH = arena.clientHeight - 80;
      const boardSize = Math.min(540, Math.max(280, Math.min(availW, availH)));

      this.el.grid.style.width = `${boardSize}px`;
      this.el.grid.style.height = `${boardSize}px`;
    }

    rotateCell(r, c, deltaAngle) {
      if (this.isWon) return;
      const cell = this.grid[r][c];
      cell.currentAngle += deltaAngle;
      this.movesCount++;
      if (this.el.movesVal) this.el.movesVal.textContent = this.movesCount;

      const svg = document.getElementById(`pipeSvg-${this.id}-${r}-${c}`);
      if (svg) {
        svg.style.transform = `rotate(${cell.currentAngle}deg)`;
      }

      this.sound.playRotate();
      this.recalculateFlow();
    }

    createPipeSvg(cell) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.className.baseVal = 'pipe-svg';
      svg.id = `pipeSvg-${this.id}-${cell.r}-${cell.c}`;
      svg.style.transform = `rotate(${cell.currentAngle}deg)`;

      const mask = cell.baseMask; // [Up, Right, Down, Left]
      const paths = [];

      if (mask[0]) paths.push('M50,50 L50,0');
      if (mask[1]) paths.push('M50,50 L100,50');
      if (mask[2]) paths.push('M50,50 L50,100');
      if (mask[3]) paths.push('M50,50 L0,50');

      const d = paths.join(' ');

      // Outer Pipe Body
      const bodyPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      bodyPath.setAttribute('d', d);
      bodyPath.className.baseVal = 'pipe-body';
      svg.appendChild(bodyPath);

      // Inner Pipe Liquid / Core
      const innerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      innerPath.setAttribute('d', d);
      innerPath.className.baseVal = 'pipe-inner';
      svg.appendChild(innerPath);

      // Source Hub Terminal circle
      if (cell.isSource) {
        const hub = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hub.setAttribute('cx', '50');
        hub.setAttribute('cy', '50');
        hub.setAttribute('r', '14');
        hub.className.baseVal = 'pipe-source-hub';
        svg.appendChild(hub);
      }

      return svg;
    }

    showHint() {
      const n = this.gridSize;
      // Find a misplaced pipe
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const cell = this.grid[r][c];
          const currTurns = Math.round((cell.currentAngle % 360 + 360) % 360 / 90);
          if (currTurns !== 0) {
            // Found misplaced tile
            const cellEl = document.getElementById(`pipeCell-${this.id}-${r}-${c}`);
            if (cellEl) {
              cellEl.classList.add('hint-active');
              setTimeout(() => cellEl.classList.remove('hint-active'), 1800);
            }
            if (window.sys && window.sys.desktop && typeof window.sys.desktop.showToast === 'function') {
              window.sys.desktop.showToast(this.t('games.pipe.hint_msg', { row: r + 1, col: c + 1 }), 'info');
            }
            return;
          }
        }
      }
    }

    autoSolve() {
      const n = this.gridSize;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const cell = this.grid[r][c];
          cell.currentAngle = 0;
          const svg = document.getElementById(`pipeSvg-${this.id}-${r}-${c}`);
          if (svg) {
            svg.style.transform = `rotate(0deg)`;
          }
        }
      }
      this.recalculateFlow();
    }

    celebrateVictory() {
      if (this.el.winMsg) {
        this.el.winMsg.textContent = this.t('games.pipe.victory_msg', {
          size: this.gridSize,
          moves: this.movesCount,
          time: this.formatTime(this.elapsedSeconds)
        });
      }
      if (this.el.victoryModal) {
        this.el.victoryModal.style.display = 'flex';
      }
      if (window.sys && window.sys.desktop && typeof window.sys.desktop.showToast === 'function') {
        window.sys.desktop.showToast(`🎉 ${this.t('games.pipe.victory_title')}`, 'success');
      }
    }

    hideVictory() {
      if (this.el.victoryModal) {
        this.el.victoryModal.style.display = 'none';
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
  }

  class WebOSPipeApp {
    constructor() {
      this.instances = new Map();
      this.instanceCounter = 0;
    }

    open(options = {}) {
      this.instanceCounter++;
      const id = this.instanceCounter;
      const instance = new PipeInstance(this, id, options);
      this.instances.set(id, instance);
      return instance;
    }
  }

  // Instantiate and mount WebOS Pipe Game App
  const pipeApp = new WebOSPipeApp();
  window.PipeApp = pipeApp;
  window.pipeApp = pipeApp;

  if (window.sys && window.sys.appManager) {
    window.sys.appManager.registerInstance('pipe', pipeApp);
  }

})(window);
