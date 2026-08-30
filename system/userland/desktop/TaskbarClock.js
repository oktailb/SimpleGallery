/**
 * SimpleGallery WebOS - Taskbar Clock & Interactive Calendar Popover
 */

(function (window, document) {
  'use strict';

  class TaskbarClock {
    constructor() {
      this.timeEl = null;
      this.dateEl = null;
      this.btnEl = null;
      this.popoverEl = null;
      this.showDesktopBtn = null;
      this.currentCalDate = new Date();
      this.clockInterval = null;
    }

    init() {
      this.timeEl = document.getElementById('taskbarClockTime');
      this.dateEl = document.getElementById('taskbarClockDate');
      this.btnEl = document.getElementById('taskbarCalendarBtn');
      this.popoverEl = document.getElementById('taskbarCalendarPopover');
      this.showDesktopBtn = document.getElementById('taskbarShowDesktopBtn');

      if (!this.timeEl || !this.dateEl) return;

      this.updateClock();
      if (this.clockInterval) clearInterval(this.clockInterval);
      this.clockInterval = setInterval(() => this.updateClock(), 1000);

      if (this.btnEl && this.popoverEl) {
        this.btnEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleCalendar();
        });

        document.addEventListener('click', (e) => {
          if (!this.btnEl.contains(e.target) && !this.popoverEl.contains(e.target)) {
            this.closeCalendar();
          }
        });
      }

      if (this.showDesktopBtn) {
        this.showDesktopBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (window.WindowManager && typeof window.WindowManager.toggleMinimizeAll === 'function') {
            window.WindowManager.toggleMinimizeAll();
          }
        });
      }
    }

    updateClock() {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');

      if (this.timeEl) this.timeEl.textContent = `${hours}:${minutes}`;
      if (this.dateEl) this.dateEl.textContent = `${day}/${month}`;
    }

    toggleCalendar() {
      if (!this.popoverEl) return;
      const isOpen = this.popoverEl.style.display !== 'none';
      if (isOpen) {
        this.closeCalendar();
      } else {
        this.renderCalendar(this.currentCalDate);
        this.popoverEl.style.display = 'block';
        if (this.btnEl) this.btnEl.classList.add('active');
      }
    }

    closeCalendar() {
      if (this.popoverEl) this.popoverEl.style.display = 'none';
      if (this.btnEl) this.btnEl.classList.remove('active');
    }

    renderCalendar(targetDate) {
      if (!this.popoverEl) return;

      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();
      const today = new Date();

      const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];
      const dayNames = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

      const firstDayOfMonth = new Date(year, month, 1).getDay();
      const startingDay = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1; // Monday start
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      let daysHtml = '';
      for (let i = 0; i < startingDay; i++) {
        daysHtml += `<div class="cal-day empty"></div>`;
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const isToday = (d === today.getDate() && month === today.getMonth() && year === today.getFullYear());
        daysHtml += `<div class="cal-day ${isToday ? 'today' : ''}">${d}</div>`;
      }

      this.popoverEl.innerHTML = `
        <div class="cal-header">
          <button type="button" class="cal-nav-btn" id="calPrevMonthBtn">&lsaquo;</button>
          <div class="cal-title">${monthNames[month]} ${year}</div>
          <button type="button" class="cal-nav-btn" id="calNextMonthBtn">&rsaquo;</button>
        </div>
        <div class="cal-weekdays">
          ${dayNames.map(name => `<div class="cal-weekday">${name}</div>`).join('')}
        </div>
        <div class="cal-grid">
          ${daysHtml}
        </div>
      `;

      const prevBtn = this.popoverEl.querySelector('#calPrevMonthBtn');
      const nextBtn = this.popoverEl.querySelector('#calNextMonthBtn');

      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.currentCalDate = new Date(year, month - 1, 1);
          this.renderCalendar(this.currentCalDate);
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.currentCalDate = new Date(year, month + 1, 1);
          this.renderCalendar(this.currentCalDate);
        });
      }
    }
  }

  window.sys = window.sys || {};
  window.sys.taskbarClock = new TaskbarClock();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.sys.taskbarClock.init());
  } else {
    window.sys.taskbarClock.init();
  }

})(window, document);
