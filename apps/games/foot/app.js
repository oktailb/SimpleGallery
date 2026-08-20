/**
 * SimpleGallery 2026 - Foot Pong Arcade Game
 * Modern WebOS multi-instance arcade soccer pong with dynamic mouse angle paddle physics,
 * ball spin, AI bot opponent, sound synthesizers, and goal celebration VFX.
 */
(function(window) {
  'use strict';

  class FootSoundEngine {
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

    playKick(power = 1) {
      try {
        this.ensureContext();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(140 * power, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.13);
      } catch (e) {}
    }

    playBounce() {
      try {
        this.ensureContext();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.06);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.07);
      } catch (e) {}
    }

    playWhistle() {
      try {
        this.ensureContext();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.linearRampToValueAtTime(2200, now + 0.1);
        osc.frequency.linearRampToValueAtTime(1900, now + 0.25);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.32);
      } catch (e) {}
    }

    playGoal() {
      try {
        this.ensureContext();
        if (!this.ctx) return;
        this.playWhistle();
        const now = this.ctx.currentTime;
        // Crowd cheer noise synthesis
        const bufferSize = this.ctx.sampleRate * 1.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.7));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(now);
      } catch (e) {}
    }
  }

  class FootGameInstance {
    constructor(app, id, options = {}) {
      this.app = app;
      this.id = id;
      this.winId = `foot-${id}`;
      this.options = options;

      this.sound = new FootSoundEngine();
      this.difficulty = options.difficulty || 'normal'; // easy, normal, pro
      this.mode = options.mode || 'match'; // match, arcade

      // Virtual Coordinate Pitch Space: 1024 x 768
      this.V_WIDTH = 1024;
      this.V_HEIGHT = 768;
      this.GOAL_TOP = 260;
      this.GOAL_BOTTOM = 508;
      this.GOAL_DEPTH = 50;

      // Scores & Timers
      this.playerScore = 0;
      this.cpuScore = 0;
      this.targetScore = 5;
      this.matchDuration = 120; // seconds
      this.matchElapsed = 0;
      this.timerInterval = null;
      this.isPaused = false;
      this.isGameOver = false;

      // Ball State
      this.ball = {
        x: 512,
        y: 384,
        vx: 0,
        vy: 0,
        radius: 12,
        speed: 6.5,
        trail: []
      };

      // Player 1 Paddle (Mouse-Driven)
      this.player = {
        x: 180,
        y: 384,
        prevX: 180,
        prevY: 384,
        angle: 0,
        targetAngle: 0,
        size: 38,
        color: '#38bdf8'
      };

      // CPU Paddle (AI-Driven)
      this.cpu = {
        x: 844,
        y: 384,
        vx: 0,
        vy: 0,
        angle: Math.PI,
        size: 38,
        speed: 4.8,
        reactionLag: 0.15,
        color: '#f87171'
      };

      this.particles = [];
      this.animFrameId = null;
      this.win = null;
      this.canvas = null;
      this.ctx = null;
      this.el = {};

      if (window.sys && window.sys.events) {
        this.localeUnsub = window.sys.events.on('locale:changed', () => this.updateLocale());
      }

      this.initWindow();
    }

    t(key, replacements = {}) {
      return this.app.t(key, replacements);
    }

    initWindow() {
      const appTitle = (window.sys && window.sys.appManager)
        ? window.sys.appManager.getAppTitle('foot')
        : (this.t('games.foot.title') || "Foot Pong Arcade");

      const defaultW = Math.min(880, Math.max(540, Math.round(window.innerWidth * 0.72)));
      const defaultH = Math.min(680, Math.max(420, Math.round(window.innerHeight * 0.78)));

      const bodyHtml = `
        <div class="foot-pong-app" id="footApp-${this.id}">
          <!-- Scoreboard Header -->
          <div class="foot-header">
            <div class="foot-scoreboard">
              <div class="foot-team player">
                <span>${this.t('games.foot.player')}</span>
                <span class="foot-score-badge" id="playerScore-${this.id}">0</span>
              </div>
              <span style="font-weight:900;color:rgba(255,255,255,0.4);">:</span>
              <div class="foot-team cpu">
                <span class="foot-score-badge" id="cpuScore-${this.id}">0</span>
                <span>${this.t('games.foot.cpu')}</span>
              </div>
            </div>

            <div class="foot-meta">
              <span class="foot-pill">⏱️ <span id="timerBadge-${this.id}">02:00</span></span>
              <span class="foot-pill" id="diffBadge-${this.id}">${this.getDiffLabel()}</span>
            </div>

            <div style="display:flex;align-items:center;gap:8px;">
              <button type="button" class="foot-btn" id="pauseBtn-${this.id}">${this.isPaused ? this.t('games.foot.resume') : this.t('games.foot.pause')}</button>
              <button type="button" class="foot-btn primary" id="resetBtn-${this.id}">${this.t('games.foot.new_match')}</button>
            </div>
          </div>

          <!-- Arena Pitch Viewport -->
          <div class="foot-arena" id="footArena-${this.id}">
            <div class="foot-canvas-wrapper" id="canvasWrapper-${this.id}">
              <canvas class="foot-canvas" id="footCanvas-${this.id}" width="1024" height="768"></canvas>
              <div class="foot-goal-banner" id="goalBanner-${this.id}">⚽ BUUUT !!!</div>
            </div>

            <!-- Match Over Modal -->
            <div class="foot-modal" id="footModal-${this.id}" style="display:none;">
              <div class="foot-card">
                <div class="foot-card-title" id="modalTitle-${this.id}">${this.t('games.foot.match_over')}</div>
                <div class="foot-card-score" id="modalScore-${this.id}">0 - 0</div>
                <p id="modalMsg-${this.id}" style="color:#e2e8f0;margin-bottom:1.5rem;font-weight:600;"></p>
                <div style="display:flex;justify-content:center;gap:12px;">
                  <button type="button" class="foot-btn primary" id="modalReplayBtn-${this.id}">${this.t('games.foot.replay')}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      this.win = window.WindowManager.createWindow({
        id: this.winId,
        appId: 'foot',
        appName: appTitle,
        title: `${appTitle} (1v1)`,
        icon: '⚽',
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
          this.stopLoop();
          this.app.instances.delete(this.id);
        },
        onResize: () => {
          this.resizeCanvas();
        }
      });

      this.cacheDom();
      this.bindEvents();
      this.resizeCanvas();
      this.resetMatch();
      this.startLoop();
    }

    cacheDom() {
      this.canvas = document.getElementById(`footCanvas-${this.id}`);
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.el.playerScore = document.getElementById(`playerScore-${this.id}`);
      this.el.cpuScore = document.getElementById(`cpuScore-${this.id}`);
      this.el.timerBadge = document.getElementById(`timerBadge-${this.id}`);
      this.el.diffBadge = document.getElementById(`diffBadge-${this.id}`);
      this.el.goalBanner = document.getElementById(`goalBanner-${this.id}`);
      this.el.modal = document.getElementById(`footModal-${this.id}`);
      this.el.modalTitle = document.getElementById(`modalTitle-${this.id}`);
      this.el.modalScore = document.getElementById(`modalScore-${this.id}`);
      this.el.modalMsg = document.getElementById(`modalMsg-${this.id}`);
      this.el.canvasWrapper = document.getElementById(`canvasWrapper-${this.id}`);
    }

    bindEvents() {
      const resetBtn = document.getElementById(`resetBtn-${this.id}`);
      const pauseBtn = document.getElementById(`pauseBtn-${this.id}`);
      const replayBtn = document.getElementById(`modalReplayBtn-${this.id}`);

      if (resetBtn) resetBtn.onclick = () => this.resetMatch();
      if (pauseBtn) pauseBtn.onclick = () => this.togglePause();
      if (replayBtn) replayBtn.onclick = () => { this.hideModal(); this.resetMatch(); };

      if (this.canvas) {
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
      }
    }

    updateMenuBar() {
      if (!window.MenuBarManager) return;
      window.MenuBarManager.registerAppMenu('foot', (container) => {
        container.innerHTML = `
          <div class="app-menu-left">
            <button type="button" class="app-menu-pill" id="menuFootNewBtn">${this.t('games.foot.new_match')}</button>
            <button type="button" class="app-menu-pill" id="menuFootPauseBtn">${this.isPaused ? this.t('games.foot.resume') : this.t('games.foot.pause')}</button>
            <select class="app-menu-pill" id="menuFootDiffSelect" style="background:rgba(255,255,255,0.1);color:#fff;border:none;border-radius:8px;padding:4px 8px;cursor:pointer;">
              <option value="easy" ${this.difficulty === 'easy' ? 'selected' : ''} style="background:#022c22;color:#fff;">${this.t('games.foot.diff_easy')}</option>
              <option value="normal" ${this.difficulty === 'normal' ? 'selected' : ''} style="background:#022c22;color:#fff;">${this.t('games.foot.diff_normal')}</option>
              <option value="pro" ${this.difficulty === 'pro' ? 'selected' : ''} style="background:#022c22;color:#fff;">${this.t('games.foot.diff_pro')}</option>
            </select>
          </div>
          <div class="app-menu-right">
            <button type="button" class="app-menu-pill" id="menuFootFsBtn">${this.t('games.foot.fullscreen')}</button>
          </div>
        `;

        const newBtn = container.querySelector('#menuFootNewBtn');
        const pauseBtn = container.querySelector('#menuFootPauseBtn');
        const diffSelect = container.querySelector('#menuFootDiffSelect');
        const fsBtn = container.querySelector('#menuFootFsBtn');

        if (newBtn) newBtn.onclick = () => this.resetMatch();
        if (pauseBtn) pauseBtn.onclick = () => this.togglePause();
        if (diffSelect) diffSelect.onchange = (e) => this.setDifficulty(e.target.value);
        if (fsBtn) fsBtn.onclick = () => { if (window.WindowManager) window.WindowManager.toggleMaximize(this.winId); };
      });
      window.MenuBarManager.setActiveApp('foot');
    }

    getDiffLabel() {
      if (this.difficulty === 'easy') return this.t('games.foot.diff_easy');
      if (this.difficulty === 'pro') return this.t('games.foot.diff_pro');
      return this.t('games.foot.diff_normal');
    }

    setDifficulty(diff) {
      this.difficulty = diff;
      if (diff === 'easy') {
        this.cpu.speed = 3.6;
        this.cpu.reactionLag = 0.22;
      } else if (diff === 'pro') {
        this.cpu.speed = 6.2;
        this.cpu.reactionLag = 0.08;
      } else {
        this.cpu.speed = 4.8;
        this.cpu.reactionLag = 0.15;
      }
      if (this.el.diffBadge) this.el.diffBadge.textContent = this.getDiffLabel();
    }

    resizeCanvas() {
      const arena = document.getElementById(`footArena-${this.id}`);
      if (!arena || !this.el.canvasWrapper) return;

      const availW = arena.clientWidth - 24;
      const availH = arena.clientHeight - 24;

      const aspect = this.V_WIDTH / this.V_HEIGHT; // 4:3
      let w = availW;
      let h = Math.round(w / aspect);

      if (h > availH) {
        h = availH;
        w = Math.round(h * aspect);
      }

      this.el.canvasWrapper.style.width = `${w}px`;
      this.el.canvasWrapper.style.height = `${h}px`;
    }

    onMouseMove(e) {
      if (this.isPaused || this.isGameOver) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.V_WIDTH / rect.width;
      const scaleY = this.V_HEIGHT / rect.height;

      const rawX = (e.clientX - rect.left) * scaleX;
      const rawY = (e.clientY - rect.top) * scaleY;

      // Constrain player to left half of pitch
      const targetX = Math.max(40, Math.min(this.V_WIDTH * 0.48, rawX));
      const targetY = Math.max(40, Math.min(this.V_HEIGHT - 40, rawY));

      const dx = targetX - this.player.x;
      const dy = targetY - this.player.y;

      // Dynamic angle calculation based on motion vector
      if (Math.hypot(dx, dy) > 2) {
        this.player.targetAngle = Math.atan2(dy, dx);
      }

      this.player.prevX = this.player.x;
      this.player.prevY = this.player.y;
      this.player.x = targetX;
      this.player.y = targetY;
    }

    onTouchMove(e) {
      if (e.touches && e.touches[0]) {
        e.preventDefault();
        this.onMouseMove(e.touches[0]);
      }
    }

    togglePause() {
      this.isPaused = !this.isPaused;
      const pauseBtn = document.getElementById(`pauseBtn-${this.id}`);
      if (pauseBtn) pauseBtn.textContent = this.isPaused ? this.t('games.foot.resume') : this.t('games.foot.pause');
      this.updateMenuBar();
    }

    resetMatch() {
      this.playerScore = 0;
      this.cpuScore = 0;
      this.matchElapsed = 0;
      this.isGameOver = false;
      this.isPaused = false;
      this.setDifficulty(this.difficulty);
      this.updateScoreUI();
      this.resetBall(1); // 1 = toward player, -1 = toward CPU
      this.startTimer();
      this.sound.playWhistle();
    }

    resetBall(direction = 1) {
      this.ball.x = this.V_WIDTH / 2;
      this.ball.y = this.V_HEIGHT / 2;
      const angle = (Math.random() * 0.8 - 0.4) + (direction === 1 ? 0 : Math.PI);
      const speed = 6.0;
      this.ball.vx = Math.cos(angle) * speed;
      this.ball.vy = Math.sin(angle) * speed;
      this.ball.trail = [];
    }

    startTimer() {
      clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        if (this.isPaused || this.isGameOver) return;
        this.matchElapsed++;
        const remaining = Math.max(0, this.matchDuration - this.matchElapsed);
        if (this.el.timerBadge) {
          const m = Math.floor(remaining / 60).toString().padStart(2, '0');
          const s = (remaining % 60).toString().padStart(2, '0');
          this.el.timerBadge.textContent = `${m}:${s}`;
        }
        if (remaining <= 0) {
          this.endMatch();
        }
      }, 1000);
    }

    updateScoreUI() {
      if (this.el.playerScore) this.el.playerScore.textContent = this.playerScore;
      if (this.el.cpuScore) this.el.cpuScore.textContent = this.cpuScore;
    }

    handleGoal(scoringTeam) {
      this.sound.playGoal();
      if (scoringTeam === 'player') {
        this.playerScore++;
      } else {
        this.cpuScore++;
      }
      this.updateScoreUI();

      // Show goal banner
      if (this.el.goalBanner) {
        this.el.goalBanner.textContent = scoringTeam === 'player' ? this.t('games.foot.goal_player') : this.t('games.foot.goal_cpu');
        this.el.goalBanner.classList.add('active');
        setTimeout(() => {
          if (this.el.goalBanner) this.el.goalBanner.classList.remove('active');
        }, 1500);
      }

      if (this.playerScore >= this.targetScore || this.cpuScore >= this.targetScore) {
        this.endMatch();
      } else {
        setTimeout(() => {
          this.resetBall(scoringTeam === 'player' ? -1 : 1);
        }, 1600);
      }
    }

    endMatch() {
      this.isGameOver = true;
      clearInterval(this.timerInterval);

      if (this.el.modal) {
        const isWin = this.playerScore > this.cpuScore;
        const isDraw = this.playerScore === this.cpuScore;

        if (this.el.modalTitle) {
          this.el.modalTitle.textContent = isWin ? this.t('games.foot.win_title') : (isDraw ? this.t('games.foot.draw_title') : this.t('games.foot.lose_title'));
          this.el.modalTitle.style.color = isWin ? '#fbbf24' : (isDraw ? '#38bdf8' : '#f87171');
        }
        if (this.el.modalScore) this.el.modalScore.textContent = `${this.playerScore} - ${this.cpuScore}`;
        if (this.el.modalMsg) {
          this.el.modalMsg.textContent = isWin
            ? this.t('games.foot.win_msg', { diff: this.getDiffLabel() })
            : (isDraw ? this.t('games.foot.draw_msg') : this.t('games.foot.lose_msg'));
        }
        this.el.modal.style.display = 'flex';
      }
    }

    hideModal() {
      if (this.el.modal) this.el.modal.style.display = 'none';
    }

    startLoop() {
      const loop = () => {
        this.update();
        this.draw();
        this.animFrameId = requestAnimationFrame(loop);
      };
      this.animFrameId = requestAnimationFrame(loop);
    }

    stopLoop() {
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
      clearInterval(this.timerInterval);
    }

    update() {
      if (this.isPaused || this.isGameOver) return;

      // Smooth player angle rotation towards target angle
      let angleDiff = this.player.targetAngle - this.player.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.player.angle += angleDiff * 0.2;

      // CPU AI Logic
      const targetCpuY = this.ball.y;
      const cpuDy = targetCpuY - this.cpu.y;
      this.cpu.y += Math.sign(cpuDy) * Math.min(Math.abs(cpuDy), this.cpu.speed);
      this.cpu.y = Math.max(40, Math.min(this.V_HEIGHT - 40, this.cpu.y));

      // CPU angle orienting towards player goal
      const cpuTargetAngle = Math.atan2(this.V_HEIGHT / 2 - this.cpu.y, -300);
      this.cpu.angle += (cpuTargetAngle - this.cpu.angle) * 0.1;

      // Ball Physics
      this.ball.x += this.ball.vx;
      this.ball.y += this.ball.vy;

      // Ball Trail
      this.ball.trail.push({ x: this.ball.x, y: this.ball.y, alpha: 1.0 });
      if (this.ball.trail.length > 8) this.ball.trail.shift();

      // Top / Bottom Wall Bounces
      if (this.ball.y - this.ball.radius <= 0) {
        this.ball.y = this.ball.radius;
        this.ball.vy = Math.abs(this.ball.vy);
        this.sound.playBounce();
      } else if (this.ball.y + this.ball.radius >= this.V_HEIGHT) {
        this.ball.y = this.V_HEIGHT - this.ball.radius;
        this.ball.vy = -Math.abs(this.ball.vy);
        this.sound.playBounce();
      }

      // Left Wall / Goal check
      if (this.ball.x - this.ball.radius <= 0) {
        if (this.ball.y >= this.GOAL_TOP && this.ball.y <= this.GOAL_BOTTOM) {
          // Goal for CPU!
          this.handleGoal('cpu');
          this.ball.vx = 0;
          this.ball.vy = 0;
        } else {
          this.ball.x = this.ball.radius;
          this.ball.vx = Math.abs(this.ball.vx);
          this.sound.playBounce();
        }
      }

      // Right Wall / Goal check
      if (this.ball.x + this.ball.radius >= this.V_WIDTH) {
        if (this.ball.y >= this.GOAL_TOP && this.ball.y <= this.GOAL_BOTTOM) {
          // Goal for Player!
          this.handleGoal('player');
          this.ball.vx = 0;
          this.ball.vy = 0;
        } else {
          this.ball.x = this.V_WIDTH - this.ball.radius;
          this.ball.vx = -Math.abs(this.ball.vx);
          this.sound.playBounce();
        }
      }

      // Player Collision (Paddle with dynamic deflection angle)
      this.checkPaddleCollision(this.player, true);

      // CPU Collision
      this.checkPaddleCollision(this.cpu, false);

      // Update Particles
      this.particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.03;
        if (p.alpha <= 0) this.particles.splice(idx, 1);
      });
    }

    checkPaddleCollision(paddle, isPlayer) {
      const dist = Math.hypot(this.ball.x - paddle.x, this.ball.y - paddle.y);
      if (dist < paddle.size + this.ball.radius) {
        // Impact vector
        const impactAngle = Math.atan2(this.ball.y - paddle.y, this.ball.x - paddle.x);
        const normalAngle = paddle.angle + (isPlayer ? 0 : Math.PI);
        const deflection = (impactAngle + normalAngle) / 2;

        const currentSpeed = Math.min(14, Math.hypot(this.ball.vx, this.ball.vy) * 1.05 + 0.3);
        this.ball.vx = Math.cos(deflection) * currentSpeed;
        this.ball.vy = Math.sin(deflection) * currentSpeed;

        // Ensure horizontal velocity keeps ball advancing
        if (isPlayer && this.ball.vx < 2) this.ball.vx = 2.5;
        if (!isPlayer && this.ball.vx > -2) this.ball.vx = -2.5;

        this.sound.playKick(currentSpeed / 8);

        // Spawn hit sparks
        for (let i = 0; i < 8; i++) {
          this.particles.push({
            x: this.ball.x,
            y: this.ball.y,
            vx: (Math.random() * 4 - 2),
            vy: (Math.random() * 4 - 2),
            color: paddle.color,
            alpha: 1.0
          });
        }
      }
    }

    draw() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.V_WIDTH, this.V_HEIGHT);

      // 1. Draw Football Pitch
      this.drawPitch(ctx);

      // 2. Draw Ball Trail
      this.ball.trail.forEach((t, i) => {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${(i / this.ball.trail.length) * 0.35})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, this.ball.radius * (0.5 + 0.5 * (i / this.ball.trail.length)), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 3. Draw Ball
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255,255,255,0.6)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // Ball pentagon pattern
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(this.ball.x, this.ball.y, this.ball.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 4. Draw Paddles
      this.drawPaddle(ctx, this.player, true);
      this.drawPaddle(ctx, this.cpu, false);

      // 5. Draw Particles
      this.particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    drawPitch(ctx) {
      // Grass Stripes
      const stripes = 8;
      const stripeW = this.V_WIDTH / stripes;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#15803d' : '#166534';
        ctx.fillRect(i * stripeW, 0, stripeW, this.V_HEIGHT);
      }

      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 4;

      // Outer Pitch Border
      ctx.strokeRect(20, 20, this.V_WIDTH - 40, this.V_HEIGHT - 40);

      // Halfway Line & Center Circle
      ctx.beginPath();
      ctx.moveTo(this.V_WIDTH / 2, 20);
      ctx.lineTo(this.V_WIDTH / 2, this.V_HEIGHT - 20);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(this.V_WIDTH / 2, this.V_HEIGHT / 2, 80, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.V_WIDTH / 2, this.V_HEIGHT / 2, 5, 0, Math.PI * 2);
      ctx.fill();

      // Left Penalty Box & Goal
      ctx.strokeRect(20, 184, 160, 400);
      ctx.strokeRect(20, 260, 60, 248);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.fillRect(0, this.GOAL_TOP, 20, this.GOAL_BOTTOM - this.GOAL_TOP);

      // Right Penalty Box & Goal
      ctx.strokeRect(this.V_WIDTH - 180, 184, 160, 400);
      ctx.strokeRect(this.V_WIDTH - 80, 260, 60, 248);
      ctx.fillStyle = 'rgba(248, 113, 113, 0.15)';
      ctx.fillRect(this.V_WIDTH - 20, this.GOAL_TOP, 20, this.GOAL_BOTTOM - this.GOAL_TOP);

      ctx.restore();
    }

    drawPaddle(ctx, paddle, isPlayer) {
      ctx.save();
      ctx.translate(paddle.x, paddle.y);
      ctx.rotate(paddle.angle);

      // Butterfly / Bowtie Soccer Paddle with Glow
      ctx.shadowColor = paddle.color;
      ctx.shadowBlur = 12;

      // Base triangle 1
      ctx.fillStyle = paddle.color;
      ctx.beginPath();
      ctx.moveTo(paddle.size, paddle.size * 0.7);
      ctx.lineTo(paddle.size, -paddle.size * 0.7);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();

      // Base triangle 2 (counter-wing)
      ctx.fillStyle = isPlayer ? '#0284c7' : '#dc2626';
      ctx.beginPath();
      ctx.moveTo(-paddle.size * 0.6, paddle.size * 0.5);
      ctx.lineTo(-paddle.size * 0.6, -paddle.size * 0.5);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();

      // Center pivot ring
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
    updateLocale() {
      const appTitle = (window.sys && window.sys.appManager)
        ? window.sys.appManager.getAppTitle('foot')
        : (this.t('games.foot.title') || "Foot Pong Arcade");

      if (window.WindowManager) {
        window.WindowManager.setTitle(this.winId, `${appTitle} (1v1)`);
      }

      const playerTeam = this.el.app ? this.el.app.querySelector('.foot-team.player span:first-child') : null;
      const cpuTeam = this.el.app ? this.el.app.querySelector('.foot-team.cpu span:last-child') : null;
      const pauseBtn = document.getElementById(`pauseBtn-${this.id}`);
      const resetBtn = document.getElementById(`resetBtn-${this.id}`);
      const replayBtn = document.getElementById(`modalReplayBtn-${this.id}`);

      if (playerTeam) playerTeam.textContent = this.t('games.foot.player');
      if (cpuTeam) cpuTeam.textContent = this.t('games.foot.cpu');
      if (this.el.diffBadge) this.el.diffBadge.textContent = this.getDiffLabel();
      if (pauseBtn) pauseBtn.textContent = this.isPaused ? this.t('games.foot.resume') : this.t('games.foot.pause');
      if (resetBtn) resetBtn.textContent = this.t('games.foot.new_match');
      if (replayBtn) replayBtn.textContent = this.t('games.foot.replay');

      if (this.isGameOver) {
        this.endMatch();
      }

      this.updateMenuBar();
    }
  }

  class WebOSFootApp {
    constructor() {
      this.instances = new Map();
      this.instanceCounter = 0;

      if (window.sys && window.sys.events) {
        window.sys.events.on('locale:changed', () => {
          this.instances.forEach(inst => inst.updateLocale());
        });
      }
    }

    t(key, replacements = {}) {
      if (window.I18nEngine) return window.I18nEngine.t(key, replacements);
      return key;
    }

    open(options = {}) {
      this.instanceCounter++;
      const id = this.instanceCounter;
      const instance = new FootGameInstance(this, id, options);
      this.instances.set(id, instance);
      return instance;
    }
  }

  // Instantiate and mount WebOS Foot Pong App
  const footApp = new WebOSFootApp();
  window.FootApp = footApp;
  window.footApp = footApp;

  if (window.sys && window.sys.appManager) {
    window.sys.appManager.registerInstance('foot', footApp);
  }

})(window);
