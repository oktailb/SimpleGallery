/**
 * SimpleGallery WebOS - WebOSToolkit Engine (`window.sys.ui` / `window.WebOSToolkit`)
 * Standardized IHM Toolkit offering UI components, widgets, feedback mechanisms, and interactions.
 */

(function (window, document) {
  'use strict';

  class WebOSToolkitClass {
    constructor() {
      this.toastContainer = null;
      this.activeModal = null;
      this.initToastContainer();
    }

    t(key, replacements = {}) {
      if (window.sys && window.sys.i18n && typeof window.sys.i18n.t === 'function') {
        return window.sys.i18n.t(key, replacements);
      }
      if (window.I18nEngine && typeof window.I18nEngine.t === 'function') {
        return window.I18nEngine.t(key, replacements);
      }
      return key;
    }

    // =========================================================================
    // 1. Toast Notification System (`sys.ui.toast`)
    // =========================================================================
    initToastContainer() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._ensureToastContainer());
      } else {
        this._ensureToastContainer();
      }
    }

    _ensureToastContainer() {
      if (!this.toastContainer) {
        let el = document.querySelector('.webos-toast-container');
        if (!el) {
          el = document.createElement('div');
          el.className = 'webos-toast-container';
          document.body.appendChild(el);
        }
        this.toastContainer = el;
      }
      return this.toastContainer;
    }

    showToast(message, options = {}) {
      const container = this._ensureToastContainer();
      const type = options.type || 'info';
      const duration = options.duration !== undefined ? options.duration : 3500;
      const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠️',
        info: 'ℹ️'
      };

      const toast = document.createElement('div');
      toast.className = `webos-toast webos-toast-${type}`;
      toast.innerHTML = `
        <span class="webos-toast-icon">${options.icon || icons[type] || 'ℹ️'}</span>
        <div class="webos-toast-message">${message}</div>
        <button type="button" class="webos-toast-close" title="Fermer">✕</button>
      `;

      const closeBtn = toast.querySelector('.webos-toast-close');
      const dismiss = () => {
        toast.classList.add('webos-toast-exit');
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 200);
      };

      closeBtn.addEventListener('click', dismiss);
      container.appendChild(toast);

      if (duration > 0) {
        setTimeout(dismiss, duration);
      }
      return toast;
    }

    toastSuccess(msg, options = {}) { return this.showToast(msg, { ...options, type: 'success' }); }
    toastError(msg, options = {}) { return this.showToast(msg, { ...options, type: 'error' }); }
    toastWarning(msg, options = {}) { return this.showToast(msg, { ...options, type: 'warning' }); }
    toastInfo(msg, options = {}) { return this.showToast(msg, { ...options, type: 'info' }); }

    // =========================================================================
    // 2. Modals & Dialog System (`sys.ui.modal` & `sys.ui.dialog`)
    // =========================================================================
    createModal(options = {}) {
      const backdrop = document.createElement('div');
      backdrop.className = 'webos-modal-backdrop';

      const card = document.createElement('div');
      card.className = 'webos-modal-card';
      if (options.width) card.style.maxWidth = typeof options.width === 'number' ? `${options.width}px` : options.width;

      const header = document.createElement('div');
      header.className = 'webos-modal-header';
      header.innerHTML = `
        <div class="webos-modal-title">
          ${options.icon ? `<span>${options.icon}</span>` : ''}
          <span>${options.title || ''}</span>
        </div>
        <button type="button" class="webos-modal-close" title="Fermer">✕</button>
      `;

      const body = document.createElement('div');
      body.className = 'webos-modal-body';
      if (typeof options.body === 'string') {
        body.innerHTML = options.body;
      } else if (options.body instanceof HTMLElement) {
        body.appendChild(options.body);
      }

      const footer = document.createElement('div');
      footer.className = 'webos-modal-footer';
      if (options.footer instanceof HTMLElement) {
        footer.appendChild(options.footer);
      } else if (typeof options.footer === 'string') {
        footer.innerHTML = options.footer;
      }

      card.appendChild(header);
      card.appendChild(body);
      if (options.footer) card.appendChild(footer);
      backdrop.appendChild(card);

      const close = () => {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        if (typeof options.onClose === 'function') options.onClose();
      };

      header.querySelector('.webos-modal-close').addEventListener('click', close);
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop && options.closeOnBackdrop !== false) close();
      });

      const onKeyDown = (e) => {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', onKeyDown);
          close();
        }
      };
      document.addEventListener('keydown', onKeyDown);

      document.body.appendChild(backdrop);
      return { backdrop, card, body, footer, close };
    }

    confirmDialog(options = {}) {
      return new Promise((resolve) => {
        const okText = options.okText || this.t('dialog.ok');
        const cancelText = options.cancelText || this.t('dialog.cancel');
        const isDanger = options.danger || false;

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = '10px';

        const btnCancel = document.createElement('button');
        btnCancel.className = 'webos-btn';
        btnCancel.textContent = cancelText;

        const btnOk = document.createElement('button');
        btnOk.className = `webos-btn ${isDanger ? 'webos-btn-danger' : 'webos-btn-primary'}`;
        btnOk.textContent = okText;

        footer.appendChild(btnCancel);
        footer.appendChild(btnOk);

        const modal = this.createModal({
          title: options.title || this.t('dialog.confirm_title'),
          icon: options.icon || (isDanger ? '⚠️' : '❓'),
          body: `<p style="margin:0;">${options.message || ''}</p>`,
          footer: footer,
          width: options.width || 420,
          onClose: () => resolve(false)
        });

        btnCancel.addEventListener('click', () => {
          modal.close();
          resolve(false);
        });

        btnOk.addEventListener('click', () => {
          modal.close();
          resolve(true);
        });
      });
    }

    alertDialog(options = {}) {
      return new Promise((resolve) => {
        const okText = options.okText || this.t('dialog.ok');

        const btnOk = document.createElement('button');
        btnOk.className = 'webos-btn webos-btn-primary';
        btnOk.textContent = okText;

        const modal = this.createModal({
          title: options.title || this.t('dialog.alert_title'),
          icon: options.icon || 'ℹ️',
          body: `<p style="margin:0;">${options.message || ''}</p>`,
          footer: btnOk,
          width: options.width || 400,
          onClose: () => resolve()
        });

        btnOk.addEventListener('click', () => {
          modal.close();
          resolve();
        });
      });
    }

    promptDialog(options = {}) {
      return new Promise((resolve) => {
        const okText = options.okText || this.t('dialog.ok');
        const cancelText = options.cancelText || this.t('dialog.cancel');

        const body = document.createElement('div');
        body.innerHTML = `
          <p style="margin:0 0 12px 0;">${options.message || ''}</p>
          <input type="text" class="webos-search-input" value="${options.defaultValue || ''}" placeholder="${options.placeholder || ''}" style="padding-left:12px;" />
        `;
        const input = body.querySelector('input');

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.gap = '10px';

        const btnCancel = document.createElement('button');
        btnCancel.className = 'webos-btn';
        btnCancel.textContent = cancelText;

        const btnOk = document.createElement('button');
        btnOk.className = 'webos-btn webos-btn-primary';
        btnOk.textContent = okText;

        footer.appendChild(btnCancel);
        footer.appendChild(btnOk);

        const modal = this.createModal({
          title: options.title || this.t('dialog.prompt_title', 'Saisie'),
          icon: options.icon || '✏️',
          body: body,
          footer: footer,
          width: options.width || 420,
          onClose: () => resolve(null)
        });

        setTimeout(() => input.focus(), 100);

        const submit = () => {
          const val = input.value;
          modal.close();
          resolve(val);
        };

        btnCancel.addEventListener('click', () => {
          modal.close();
          resolve(null);
        });

        btnOk.addEventListener('click', submit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') submit();
        });
      });
    }

    // =========================================================================
    // 3. Segmented Controls & Tabs (`sys.ui.segmented` & `sys.ui.tabs`)
    // =========================================================================
    segmentedControl(container, options = {}) {
      if (!container) return;
      container.className = 'webos-segmented';
      container.innerHTML = '';

      let currentValue = options.value || (options.items && options.items[0]?.id);

      (options.items || []).forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `webos-segmented-btn ${item.id === currentValue ? 'active' : ''}`;
        btn.innerHTML = `${item.icon ? `<span>${item.icon}</span> ` : ''}${item.label || item.id}`;

        btn.addEventListener('click', () => {
          container.querySelectorAll('.webos-segmented-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentValue = item.id;
          if (typeof options.onChange === 'function') options.onChange(item.id, item);
        });

        container.appendChild(btn);
      });

      return {
        getValue: () => currentValue,
        setValue: (val) => {
          const target = container.querySelector(`.webos-segmented-btn[data-id="${val}"]`);
          if (target) target.click();
        }
      };
    }

    tabs(container, options = {}) {
      if (!container) return;
      const isVertical = options.orientation === 'vertical';
      container.className = `webos-tabs-nav ${isVertical ? 'vertical' : ''}`;
      container.innerHTML = '';

      let activeId = options.selectedId || (options.items && options.items[0]?.id);

      (options.items || []).forEach((item) => {
        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        tabBtn.className = `webos-tab-item ${item.id === activeId ? 'active' : ''}`;
        tabBtn.innerHTML = `${item.icon ? `<span>${item.icon}</span>` : ''} <span>${item.label || item.id}</span>`;

        tabBtn.addEventListener('click', () => {
          container.querySelectorAll('.webos-tab-item').forEach(b => b.classList.remove('active'));
          tabBtn.classList.add('active');
          activeId = item.id;
          if (typeof options.onChange === 'function') options.onChange(item.id, item);
        });

        container.appendChild(tabBtn);
      });

      return {
        getActiveId: () => activeId,
        setActive: (id) => {
          const buttons = container.querySelectorAll('.webos-tab-item');
          (options.items || []).forEach((item, idx) => {
            if (item.id === id && buttons[idx]) buttons[idx].click();
          });
        }
      };
    }

    // =========================================================================
    // 4. Form Widgets (Switch, Slider, SearchInput)
    // =========================================================================
    createSwitch(options = {}) {
      const label = document.createElement('label');
      label.className = 'webos-switch-label';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'webos-switch-input';
      if (options.checked) input.checked = true;
      if (options.disabled) input.disabled = true;

      const track = document.createElement('span');
      track.className = 'webos-switch-track';
      track.innerHTML = '<span class="webos-switch-thumb"></span>';

      label.appendChild(input);
      label.appendChild(track);
      if (options.label) {
        const textNode = document.createElement('span');
        textNode.textContent = options.label;
        label.appendChild(textNode);
      }

      input.addEventListener('change', () => {
        if (typeof options.onChange === 'function') options.onChange(input.checked);
      });

      return {
        element: label,
        input: input,
        isChecked: () => input.checked,
        setChecked: (val) => { input.checked = !!val; }
      };
    }

    createSearchInput(container, options = {}) {
      if (!container) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'webos-search-wrapper';

      wrapper.innerHTML = `
        <span class="webos-search-icon">🔍</span>
        <input type="text" class="webos-search-input" placeholder="${options.placeholder || 'Rechercher...'}" value="${options.value || ''}" />
        <button type="button" class="webos-search-clear" style="display:none;" title="Effacer">✕</button>
      `;

      const input = wrapper.querySelector('.webos-search-input');
      const clearBtn = wrapper.querySelector('.webos-search-clear');
      let timer = null;

      const updateClearVisibility = () => {
        clearBtn.style.display = input.value ? 'flex' : 'none';
      };

      const triggerSearch = () => {
        updateClearVisibility();
        if (typeof options.onSearch === 'function') options.onSearch(input.value);
      };

      input.addEventListener('input', () => {
        updateClearVisibility();
        if (options.debounceMs !== 0) {
          clearTimeout(timer);
          timer = setTimeout(triggerSearch, options.debounceMs || 250);
        } else {
          triggerSearch();
        }
      });

      clearBtn.addEventListener('click', () => {
        input.value = '';
        input.focus();
        triggerSearch();
      });

      container.appendChild(wrapper);
      updateClearVisibility();

      return {
        wrapper,
        input,
        getValue: () => input.value,
        setValue: (val) => {
          input.value = val;
          updateClearVisibility();
          triggerSearch();
        }
      };
    }

    createSlider(options = {}) {
      const group = document.createElement('div');
      group.className = 'webos-slider-group';

      const min = options.min !== undefined ? options.min : 0;
      const max = options.max !== undefined ? options.max : 100;
      const step = options.step !== undefined ? options.step : 1;
      const value = options.value !== undefined ? options.value : min;
      const unit = options.unit || '';

      group.innerHTML = `
        <input type="range" class="webos-slider-input" min="${min}" max="${max}" step="${step}" value="${value}" />
        <span class="webos-slider-value">${value}${unit}</span>
      `;

      const input = group.querySelector('.webos-slider-input');
      const valDisplay = group.querySelector('.webos-slider-value');

      input.addEventListener('input', () => {
        valDisplay.textContent = `${input.value}${unit}`;
        if (typeof options.onChange === 'function') options.onChange(parseFloat(input.value));
      });

      return {
        element: group,
        getValue: () => parseFloat(input.value),
        setValue: (val) => {
          input.value = val;
          valDisplay.textContent = `${val}${unit}`;
        }
      };
    }

    // =========================================================================
    // 5. Pan & Zoom Engine (`sys.ui.panzoom`)
    // =========================================================================
    panzoom(element, options = {}) {
      if (!element) return;
      let scale = options.initialScale || 1;
      let translateX = 0;
      let translateY = 0;
      let isDragging = false;
      let startX = 0;
      let startY = 0;

      const minScale = options.minScale || 0.5;
      const maxScale = options.maxScale || 10;

      const updateTransform = () => {
        element.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        if (typeof options.onTransform === 'function') {
          options.onTransform({ scale, translateX, translateY });
        }
      };

      element.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1.15 : 0.85;
        const newScale = Math.min(Math.max(scale * delta, minScale), maxScale);
        scale = newScale;
        updateTransform();
      }, { passive: false });

      element.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        element.style.cursor = 'grabbing';
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
      });

      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          element.style.cursor = 'grab';
        }
      });

      element.addEventListener('dblclick', () => {
        scale = scale === 1 ? 2.5 : 1;
        translateX = 0;
        translateY = 0;
        updateTransform();
      });

      return {
        reset: () => { scale = 1; translateX = 0; translateY = 0; updateTransform(); },
        getTransform: () => ({ scale, translateX, translateY })
      };
    }

    // =========================================================================
    // 6. Data Tables (`sys.ui.dataTable`)
    // =========================================================================
    createDataTable(container, options = {}) {
      if (!container) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'webos-table-wrapper';

      const table = document.createElement('table');
      table.className = 'webos-table';

      const thead = document.createElement('thead');
      const trHead = document.createElement('tr');
      (options.columns || []).forEach(col => {
        const th = document.createElement('th');
        th.textContent = col.title || col.key;
        trHead.appendChild(th);
      });
      thead.appendChild(trHead);

      const tbody = document.createElement('tbody');
      (options.data || []).forEach(row => {
        const tr = document.createElement('tr');
        (options.columns || []).forEach(col => {
          const td = document.createElement('td');
          td.innerHTML = col.render ? col.render(row[col.key], row) : (row[col.key] || '');
          tr.appendChild(td);
        });
        if (typeof options.onRowClick === 'function') {
          tr.addEventListener('click', () => options.onRowClick(row, tr));
        }
        tbody.appendChild(tr);
      });

      table.appendChild(thead);
      table.appendChild(tbody);
      wrapper.appendChild(table);
      container.appendChild(wrapper);
      return wrapper;
    }

    // =========================================================================
    // 7. Feedback Elements (`sys.ui.emptyState`, `sys.ui.spinner`)
    // =========================================================================
    // 8. Sparkline & Canvas Charts (`sys.ui.chart`)
    // =========================================================================
    // =========================================================================
    // 8. Sparkline & Canvas Charts (`sys.ui.chart`)
    // =========================================================================
    sparkline(canvas, options = {}) {
      if (!canvas || !canvas.getContext) return;
      const ctx = canvas.getContext('2d');
      const data = options.data || [];
      const cssWidth = options.width || canvas.clientWidth || 300;
      const cssHeight = options.height || canvas.clientHeight || 80;

      // Handle HiDPI Crisp Canvas Rendering
      const dpr = window.devicePixelRatio || 1;
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      if (data.length < 2) {
        ctx.restore();
        return;
      }

      const color = options.color || '#6366f1';
      const fill = options.fill !== false;
      const showGrid = options.grid !== false;
      const showDot = options.dot !== false;

      const padding = options.padding || 8;
      const renderW = cssWidth - padding * 2;
      const renderH = cssHeight - padding * 2;

      const min = options.min !== undefined ? options.min : Math.min(...data);
      const max = options.max !== undefined ? options.max : Math.max(...data, min + 1);
      const range = (max - min) || 1;

      // 1. Draw Background Grid Lines
      if (showGrid) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let yRatio of [0.25, 0.5, 0.75]) {
          const y = padding + renderH * yRatio;
          ctx.moveTo(padding, y);
          ctx.lineTo(padding + renderW, y);
        }
        ctx.stroke();
      }

      // Calculate Point Coordinates
      const points = data.map((val, i) => {
        const x = padding + (i / (data.length - 1)) * renderW;
        const norm = (val - min) / range;
        const y = padding + renderH - (norm * renderH);
        return { x, y };
      });

      // 2. Draw Smooth Sparkline Path
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

      ctx.strokeStyle = color;
      ctx.lineWidth = options.lineWidth || 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = options.glow ? 6 : 0;
      ctx.stroke();

      // 3. Draw Gradient Fill Under Curve
      if (fill) {
        const fillPath = new Path2D();
        fillPath.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2;
          const yc = (points[i].y + points[i + 1].y) / 2;
          fillPath.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        fillPath.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        fillPath.lineTo(points[points.length - 1].x, padding + renderH);
        fillPath.lineTo(points[0].x, padding + renderH);
        fillPath.closePath();

        const grad = ctx.createLinearGradient(0, padding, 0, padding + renderH);
        grad.addColorStop(0, options.fillColor || `${color}33`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fill(fillPath);
      }

      // 4. Draw Glowing Current Point Dot
      if (showDot) {
        const last = points[points.length - 1];
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    createBreadcrumb(container, options = {}) {
      if (!container) return;
      container.className = 'breadcrumbs-container';
      const nav = document.createElement('nav');
      nav.className = 'breadcrumbs';
      
      const items = options.items || [];
      items.forEach((item, index) => {
        const isLast = index === items.length - 1;
        const span = document.createElement('span');
        span.className = `crumb-item ${isLast ? 'crumb-active' : ''}`;
        span.innerHTML = `${item.icon ? `<span class="crumb-icon">${item.icon}</span> ` : ''}<span>${item.label}</span>`;
        if (!isLast && typeof options.onClick === 'function') {
          span.style.cursor = 'pointer';
          span.addEventListener('click', () => options.onClick(item, index));
        }
        nav.appendChild(span);
        if (!isLast) {
          const sep = document.createElement('span');
          sep.className = 'crumb-separator';
          sep.textContent = '/';
          nav.appendChild(sep);
        }
      });
      container.innerHTML = '';
      container.appendChild(nav);
      return container;
    }

    createEmptyState(container, options = {}) {
      if (!container) return;
      const div = document.createElement('div');
      div.className = 'webos-empty-state';
      div.innerHTML = `
        <div class="webos-empty-icon">${options.icon || '📭'}</div>
        <div class="webos-empty-title">${options.title || 'Aucune donnée'}</div>
        <div class="webos-empty-desc">${options.description || ''}</div>
      `;
      if (options.actionLabel && typeof options.onAction === 'function') {
        const btn = document.createElement('button');
        btn.className = 'webos-btn webos-btn-primary';
        btn.textContent = options.actionLabel;
        btn.addEventListener('click', options.onAction);
        div.appendChild(btn);
      }
      container.appendChild(div);
      return div;
    }

    createSpinner(container) {
      const spinner = document.createElement('span');
      spinner.className = 'webos-spinner';
      if (container) container.appendChild(spinner);
      return spinner;
    }

    // =========================================================================
    // 9. Event Delegation & Action Binding (`sys.ui.bindActions`)
    // =========================================================================
    bindActions(container, actionMap = {}) {
      if (!container) return;
      if (!container._sysActionMap) {
        container._sysActionMap = {};
      }
      Object.assign(container._sysActionMap, actionMap);

      if (!container._sysBoundEvents) {
        container._sysBoundEvents = new Set();
      }

      Object.keys(actionMap).forEach(key => {
        const parts = key.split(' ');
        const eventName = parts[0];

        if (!container._sysBoundEvents.has(eventName)) {
          container._sysBoundEvents.add(eventName);

          container.addEventListener(eventName, (e) => {
            if (!container._sysActionMap) return;
            Object.keys(container._sysActionMap).forEach(actionKey => {
              const [evt, ...selectorParts] = actionKey.split(' ');
              if (evt !== eventName) return;
              const selector = selectorParts.join(' ');
              if (!selector) return;
              const target = e.target.closest(selector);
              if (target && container.contains(target)) {
                container._sysActionMap[actionKey](target, e);
              }
            });
          });
        }
      });
    }

    // =========================================================================
    // 10. Cards, Gauges & Info Grids (`sys.ui.card`, `sys.ui.gauge`)
    // =========================================================================
    resolveText(text) {
      if (text == null) return '';
      const str = String(text);
      const i18n = (window.sys && window.sys.i18n) || window.I18nEngine;
      const translated = (i18n && typeof i18n.t === 'function' && str.includes('.')) ? i18n.t(str) : str;
      return this.escapeHtml(translated);
    }

    createCard(options = {}) {
      const titleText = options.title ? this.resolveText(options.title) : '';
      const titleHtml = titleText ? `<h4 class="webos-card-title">${options.icon ? `<span>${options.icon}</span>` : ''}<span>${titleText}</span></h4>` : '';
      const headerHtml = (titleHtml || options.headerAction) ? `
        <div class="webos-card-header">
          ${titleHtml}
          ${options.headerAction || ''}
        </div>
      ` : '';

      return `
        <div class="webos-card ${options.className || ''}">
          ${headerHtml}
          <div class="webos-card-body">
            ${options.content || ''}
          </div>
        </div>
      `;
    }

    createGauge(options = {}) {
      const percent = options.percent !== undefined ? options.percent : 0;
      const statusClass = percent > (options.dangerThreshold || 85) ? 'danger' : (percent > (options.warningThreshold || 65) ? 'warning' : '');
      const labelText = options.label ? this.resolveText(options.label) : '';
      const detailText = options.detail ? this.resolveText(options.detail) : '';

      return `
        <div class="webos-gauge-card ${options.className || ''}">
          <div class="webos-gauge-top">
            <span class="webos-gauge-label">${options.icon ? `${options.icon} ` : ''}${labelText}</span>
            <span class="webos-gauge-val">${options.value || `${percent}%`}</span>
          </div>
          <div class="webos-progress-bar">
            <div class="webos-progress-fill ${statusClass}" style="width: ${Math.min(100, Math.max(0, percent))}%;"></div>
          </div>
          ${detailText ? `<span style="font-size: 0.72rem; color: var(--webos-ui-text-muted);">${detailText}</span>` : ''}
        </div>
      `;
    }

    escapeHtml(str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    createInfoGrid(items = []) {
      return `
        <div class="webos-info-grid">
          ${items.map(item => `
            <div class="webos-info-row">
              <span class="webos-info-label">${this.resolveText(item.label)}</span>
              <span class="webos-info-val" style="${item.style || ''}">${this.resolveText(item.value)}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    createChipList(chips = []) {
      return `
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          ${chips.map(chip => `
            <span class="webos-chip ${chip.enabled ? 'enabled' : (chip.disabled ? 'disabled' : '')}" style="${chip.style || ''}">
              ${chip.icon ? `<span>${chip.icon}</span> ` : ''}${this.resolveText(chip.label)}
            </span>
          `).join('')}
        </div>
      `;
    }

    createChartCard(options = {}) {
      const title = this.resolveText(options.title);
      const icon = options.icon ? `${options.icon} ` : '';
      const valStyle = options.valueColor ? `style="color: ${options.valueColor};"` : '';

      const footerHtml = (options.footerLeft || options.footerRight) ? `
        <div class="webos-chart-footer">
          <span>${this.resolveText(options.footerLeft)}</span>
          <span>${this.resolveText(options.footerRight)}</span>
        </div>
      ` : '';

      return `
        <div class="webos-chart-card ${options.className || ''}">
          <div class="webos-chart-header">
            <span class="webos-chart-title">${icon}${title}</span>
            <span class="webos-chart-val" ${options.valueId ? `id="${options.valueId}"` : ''} ${valStyle}>${this.resolveText(options.value)}</span>
          </div>
          <div class="webos-canvas-wrapper">
            <canvas id="${options.canvasId}" class="webos-chart-canvas"></canvas>
          </div>
          ${footerHtml}
        </div>
      `;
    }

    createChartGrid(cards = []) {
      const cardsHtml = Array.isArray(cards) ? cards.map(c => typeof c === 'string' ? c : this.createChartCard(c)).join('') : '';
      return `<div class="webos-charts-grid">${cardsHtml}</div>`;
    }
  }

  // Instantiate and bind to global namespace
  const toolkitInstance = new WebOSToolkitClass();
  window.WebOSToolkit = toolkitInstance;
  window.sys = window.sys || {};
  window.sys.ui = {
    toast: {
      show: toolkitInstance.showToast.bind(toolkitInstance),
      success: toolkitInstance.toastSuccess.bind(toolkitInstance),
      error: toolkitInstance.toastError.bind(toolkitInstance),
      warning: toolkitInstance.toastWarning.bind(toolkitInstance),
      info: toolkitInstance.toastInfo.bind(toolkitInstance)
    },
    modal: {
      create: toolkitInstance.createModal.bind(toolkitInstance)
    },
    dialog: {
      confirm: toolkitInstance.confirmDialog.bind(toolkitInstance),
      alert: toolkitInstance.alertDialog.bind(toolkitInstance),
      prompt: toolkitInstance.promptDialog.bind(toolkitInstance)
    },
    segmented: toolkitInstance.segmentedControl.bind(toolkitInstance),
    tabs: toolkitInstance.tabs.bind(toolkitInstance),
    breadcrumb: toolkitInstance.createBreadcrumb.bind(toolkitInstance),
    forms: {
      switch: toolkitInstance.createSwitch.bind(toolkitInstance),
      searchInput: toolkitInstance.createSearchInput.bind(toolkitInstance),
      slider: toolkitInstance.createSlider.bind(toolkitInstance)
    },
    panzoom: toolkitInstance.panzoom.bind(toolkitInstance),
    dataTable: toolkitInstance.createDataTable.bind(toolkitInstance),
    chart: {
      sparkline: toolkitInstance.sparkline.bind(toolkitInstance),
      card: toolkitInstance.createChartCard.bind(toolkitInstance),
      grid: toolkitInstance.createChartGrid.bind(toolkitInstance)
    },
    feedback: {
      emptyState: toolkitInstance.createEmptyState.bind(toolkitInstance),
      spinner: toolkitInstance.createSpinner.bind(toolkitInstance)
    },
    bindActions: toolkitInstance.bindActions.bind(toolkitInstance),
    card: toolkitInstance.createCard.bind(toolkitInstance),
    gauge: toolkitInstance.createGauge.bind(toolkitInstance),
    infoGrid: toolkitInstance.createInfoGrid.bind(toolkitInstance),
    chipList: toolkitInstance.createChipList.bind(toolkitInstance),
    escapeHtml: toolkitInstance.escapeHtml.bind(toolkitInstance)
  };

  // Unified API Client for WebOS (api.php)
  window.sys.api = {
    async get(action, params = {}) {
      const url = new URL('api.php', window.location.href);
      url.searchParams.set('action', action);
      Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    },
    async post(action, payload = {}) {
      const csrf = window.CSRF_TOKEN || (window.sys && window.sys.csrf) || document.querySelector('meta[name="csrf-token"]')?.content || '';
      const body = { action, csrf_token: csrf, ...payload };
      const res = await fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    }
  };
})(window, document);
