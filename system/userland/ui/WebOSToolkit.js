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
        let isResolved = false;
        const doResolve = (val) => {
          if (!isResolved) {
            isResolved = true;
            resolve(val);
          }
        };

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
          onClose: () => doResolve(false)
        });

        btnCancel.addEventListener('click', () => {
          doResolve(false);
          modal.close();
        });

        btnOk.addEventListener('click', () => {
          doResolve(true);
          modal.close();
        });
      });
    }

    alertDialog(options = {}) {
      return new Promise((resolve) => {
        let isResolved = false;
        const doResolve = () => {
          if (!isResolved) {
            isResolved = true;
            resolve();
          }
        };

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
          onClose: () => doResolve()
        });

        btnOk.addEventListener('click', () => {
          doResolve();
          modal.close();
        });
      });
    }

    promptDialog(options = {}) {
      return new Promise((resolve) => {
        let isResolved = false;
        const doResolve = (val) => {
          if (!isResolved) {
            isResolved = true;
            resolve(val);
          }
        };

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
          title: options.title || this.t('dialog.prompt_title'),
          icon: options.icon || '✏️',
          body: body,
          footer: footer,
          width: options.width || 420,
          onClose: () => doResolve(null)
        });

        setTimeout(() => input.focus(), 100);

        const submit = () => {
          const val = input.value;
          doResolve(val);
          modal.close();
        };

        btnCancel.addEventListener('click', () => {
          doResolve(null);
          modal.close();
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
      const wrapper = document.createElement('div');
      wrapper.className = 'webos-slider-wrapper';

      const min = options.min !== undefined ? options.min : 0;
      const max = options.max !== undefined ? options.max : 100;
      const step = options.step !== undefined ? options.step : 1;
      const value = options.value !== undefined ? options.value : min;
      const unit = options.unit || '';

      const labelHtml = options.label ? `<label class="webos-slider-label">${this.escapeHtml(options.label)}</label>` : '';

      wrapper.innerHTML = `
        ${labelHtml}
        <div class="webos-slider-group">
          <input type="range" class="webos-slider-input" min="${min}" max="${max}" step="${step}" value="${value}" />
          <span class="webos-slider-value">${value}${unit}</span>
        </div>
      `;

      const input = wrapper.querySelector('.webos-slider-input');
      const valDisplay = wrapper.querySelector('.webos-slider-value');

      input.addEventListener('input', () => {
        valDisplay.textContent = `${input.value}${unit}`;
        if (typeof options.onChange === 'function') options.onChange(parseFloat(input.value));
      });

      return {
        element: wrapper,
        input: input,
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
    resolveText(text, allowHtml = false) {
      if (text == null) return '';
      const str = String(text);
      const i18n = (window.sys && window.sys.i18n) || window.I18nEngine;
      const translated = (i18n && typeof i18n.t === 'function' && str.includes('.')) ? i18n.t(str) : str;
      if (allowHtml || (typeof translated === 'string' && translated.includes('<') && translated.includes('>'))) {
        return translated;
      }
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

    /**
     * Standardized setting row container
     */
    settingRow(opts = {}) {
      const icon = opts.icon || '';
      const label = opts.label || '';
      const subLabel = opts.subLabel || '';
      const desc = opts.desc || '';
      const controlHtml = opts.controlHtml || '';
      const style = opts.style || '';
      const allowHtml = opts.allowHtml === true;

      const labelTrans = (typeof label === 'string' && label.includes('.')) ? this.t(label) : label;
      const descTrans = (typeof desc === 'string' && desc.includes('.')) ? this.t(desc) : desc;

      const titleFormatted = allowHtml ? labelTrans : this.escapeHtml(labelTrans);
      const descFormatted = allowHtml ? descTrans : this.escapeHtml(descTrans);

      return `
        <div class="sys-setting-row" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; padding:12px; border-bottom:1px solid var(--border-color, rgba(255,255,255,0.06)); ${style}">
          <div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1;">
            ${icon ? `<span style="font-size:1.4rem; flex-shrink:0;">${icon}</span>` : ''}
            <div style="min-width:0; flex:1;">
              <div style="font-weight:600; font-size:0.88rem;">
                ${titleFormatted}
                ${subLabel ? `<span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal; margin-left:6px;">${this.escapeHtml(subLabel)}</span>` : ''}
              </div>
              ${descTrans ? `<div style="font-size:0.75rem; color:var(--text-muted); line-height:1.35; margin-top:2px;">${descFormatted}</div>` : ''}
            </div>
          </div>
          <div style="flex-shrink:0;">
            ${controlHtml}
          </div>
        </div>
      `;
    }

    /**
     * Standardized toggle switch setting row
     */
    toggleRow(opts = {}) {
      const id = opts.id || '';
      const label = opts.label || '';
      const subLabel = opts.subLabel || '';
      const icon = opts.icon || '';
      const desc = opts.desc || '';
      const checked = opts.checked !== false;
      const disabled = opts.disabled === true;
      const actionClass = opts.actionClass || 'ui-toggle-input';
      const dataAttrs = opts.dataAttrs || {};
      const allowHtml = opts.allowHtml === true;

      const dataStr = Object.entries(dataAttrs)
        .map(([k, v]) => `data-${k}="${this.escapeHtml(String(v))}"`)
        .join(' ');

      const statusBadge = opts.statusLabel !== undefined ? opts.statusLabel : (checked ? this.t('settings.app_enabled') : this.t('settings.app_disabled'));
      const badgeHtml = statusBadge ? `
        <span style="font-size:0.8rem; color:${checked ? 'var(--accent-primary, #6366f1)' : 'var(--text-muted)'}; font-weight:600;">
          ${this.escapeHtml(statusBadge)}
        </span>
      ` : '';

      const control = `
        <label class="permission-toggle-row" style="margin:0; padding:0; border:none; display:flex; align-items:center; gap:8px;">
          ${badgeHtml}
          <input type="checkbox" ${id ? `id="${this.escapeHtml(id)}"` : ''} class="${this.escapeHtml(actionClass)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} ${dataStr} />
        </label>
      `;

      return this.settingRow({ icon, label, subLabel, desc, allowHtml, controlHtml: control, style: opts.style });
    }

    /**
     * Language select dropdown auto-populated from I18nEngine
     */
    languageSelect(opts = {}) {
      const id = opts.id || 'settingsLangListBox';
      const actionClass = opts.actionClass || 'settings-lang-select';
      const current = opts.currentLocale || (window.sys.i18n ? window.sys.i18n.currentLocale : 'fr');
      
      const locales = (window.sys.i18n && typeof window.sys.i18n.getAvailableLocales === 'function') 
        ? window.sys.i18n.getAvailableLocales()
        : (window.desktop && window.desktop.state && window.desktop.state.availableLocales) || {
            fr: { code: 'fr', name: 'Français', flag: '🇫🇷' },
            en: { code: 'en', name: 'English', flag: '🇬🇧' },
            ja: { code: 'ja', name: '日本語', flag: '🇯🇵' }
          };

      const optionsHtml = Object.entries(locales).map(([code, meta]) => {
        const flag = meta.flag || '🌐';
        const name = meta.name || code.toUpperCase();
        const isSelected = code === current ? 'selected' : '';
        return `<option value="${this.escapeHtml(code)}" ${isSelected}>${flag} ${this.escapeHtml(name)} (${code.toUpperCase()})</option>`;
      }).join('');

      return `
        <select id="${this.escapeHtml(id)}" class="${this.escapeHtml(actionClass)}" style="font-size:0.85rem; padding:6px 12px; border-radius:6px; background:var(--bg-main, rgba(0,0,0,0.3)); color:var(--text-main, #fff); border:1px solid var(--border-color, rgba(255,255,255,0.15)); cursor:pointer;">
          ${optionsHtml}
        </select>
      `;
    }

    /**
     * Theme Card Preview Widget
     */
    themeCard(opts = {}) {
      const theme = opts.theme || {};
      const isActive = theme.id === opts.activeThemeId;
      const mockupBg = theme.mockupBg || theme.bg_main || '#0f172a';
      const mockupCard = theme.mockupCard || theme.card_bg || '#1e293b';
      const mockupAccent = theme.mockupAccent || theme.accent || '#6366f1';
      const textMain = theme.text_main || '#fff';
      const textMuted = theme.text_muted || '#94a3b8';

      return `
        <div class="theme-card-preview ${isActive ? 'active' : ''}" data-theme-id="${this.escapeHtml(theme.id)}">
          <div class="theme-mockup-window" style="background:${mockupBg};">
            <div class="theme-mockup-header">
              <div class="theme-mockup-dots">
                <span style="background:#ef4444;"></span>
                <span style="background:#f59e0b;"></span>
                <span style="background:#10b981;"></span>
              </div>
              <span style="font-size:0.6rem; color:${textMuted}; margin-left:4px;">${this.escapeHtml(theme.name)}</span>
            </div>
            <div class="theme-mockup-body">
              <span class="theme-mockup-chip" style="background:${mockupCard}; color:${textMain}; border:1px solid rgba(255,255,255,0.1);">UI Window</span>
              <span class="theme-mockup-chip" style="background:${mockupAccent}; color:#ffffff;">Button</span>
            </div>
          </div>
          <div class="theme-palette-bar">
            <span style="background:${theme.bg_main || '#000'};"></span>
            <span style="background:${theme.window_bg || theme.bg_main || '#111'};"></span>
            <span style="background:${theme.header_bg || theme.card_bg || '#222'};"></span>
            <span style="background:${theme.polaroid_bg || '#fff'};"></span>
            <span style="background:${theme.accent || '#6366f1'};"></span>
          </div>
        </div>
      `;
    }

    /**
     * Theme Grid Widget
     */
    themeGrid(opts = {}) {
      const themes = opts.themes || (window.sys.theme ? window.sys.theme.getThemes() : []);
      const activeThemeId = opts.activeThemeId;
      return `
        <div class="themes-selection-grid">
          ${themes.map(t => this.themeCard({ theme: t, activeThemeId })).join('')}
        </div>
      `;
    }

    /**
     * Window Manager Styles Grid Widget
     */
    windowStyleCard(opts = {}) {
      const s = opts.style || {};
      const activeStyleId = opts.activeStyleId;
      const isActive = s.id === activeStyleId;
      const translatedName = s.nameKey ? this.t(s.nameKey) : '';
      const name = (translatedName && translatedName !== s.nameKey) ? translatedName : (s.name || s.id);
      const translatedDesc = s.descKey ? this.t(s.descKey) : '';
      const desc = (translatedDesc && translatedDesc !== s.descKey) ? translatedDesc : (s.desc || '');

      return `
        <div class="theme-card wm-style-card ${isActive ? 'active' : ''}" data-wm-style-id="${this.escapeHtml(s.id)}" style="cursor: pointer; padding: 12px; border-radius: 10px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: rgba(255,255,255,0.03); transition: all 0.2s ease;">
          <div class="wm-style-preview-box webos-window" data-wm-style="${this.escapeHtml(s.id)}" style="position: relative; pointer-events: none; margin-bottom: 10px; height: 54px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; flex-direction: column;">
            <div class="window-header" style="box-sizing: border-box;">
              <div class="window-traffic-lights">
                <button type="button" class="win-btn win-close"></button>
                <button type="button" class="win-btn win-minimize"></button>
                <button type="button" class="win-btn win-maximize"></button>
              </div>
              <div class="window-title-group">
                <span class="window-icon">${s.icon || '🗔'}</span>
                <span class="window-title-text" style="font-size: 0.72rem;">${this.escapeHtml(name)}</span>
              </div>
            </div>
            <div class="window-body" style="flex: 1; min-height: 20px;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">${s.icon || '🗔'} ${this.escapeHtml(name)}</span>
            ${isActive ? '<span class="theme-badge" style="font-size:0.7rem; background:var(--accent-primary, #6366f1); color:#fff; padding:2px 8px; border-radius:10px; font-weight:700;">Actif</span>' : ''}
          </div>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0; line-height: 1.3;">${this.escapeHtml(desc)}</p>
        </div>
      `;
    }

    windowStyleGrid(opts = {}) {
      const styles = opts.styles || (window.WindowManager ? window.WindowManager.getWindowStyles() : []);
      const activeStyleId = opts.activeStyleId;
      return `
        <div class="themes-selection-grid wm-styles-selection-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px;">
          ${styles.map(s => this.windowStyleCard({ style: s, activeStyleId })).join('')}
        </div>
      `;
    }

    /**
     * Wallpaper Grid Widget
     */
    wallpaperGrid(opts = {}) {
      const wallpapers = opts.wallpapers || (window.sys.theme ? window.sys.theme.getWallpapers() : []);
      const activeId = opts.activeWallpaperId;

      return `
        <div class="wallpaper-presets-grid" id="wallpaperPresetsGrid">
          ${wallpapers.map(w => {
            const nameTrans = (w.nameKey && w.nameKey.includes('.')) ? this.t(w.nameKey) : (w.name || w.id);
            const isActive = w.id === activeId;
            return `
              <div class="wallpaper-tile ${isActive ? 'active' : ''}" data-wallpaper-id="${this.escapeHtml(w.id)}" style="background: ${this.escapeHtml(w.style)};">
                <span class="wallpaper-tile-name">${this.escapeHtml(nameTrans)}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    /**
     * Toolbar Widget
     */
    createToolbar(container, options = {}) {
      if (!container) return;
      const toolbar = document.createElement('div');
      toolbar.className = `webos-toolbar ${options.className || ''}`;
      toolbar.style.display = 'flex';
      toolbar.style.alignItems = 'center';
      toolbar.style.gap = '8px';
      toolbar.style.padding = '8px 12px';
      toolbar.style.background = 'var(--header-bg, rgba(255, 255, 255, 0.05))';
      toolbar.style.borderBottom = '1px solid var(--border-color, rgba(255, 255, 255, 0.1))';

      (options.items || []).forEach(item => {
        if (item.type === 'separator') {
          const sep = document.createElement('div');
          sep.style.width = '1px';
          sep.style.height = '18px';
          sep.style.background = 'var(--border-color, rgba(255, 255, 255, 0.15))';
          sep.style.margin = '0 4px';
          toolbar.appendChild(sep);
        } else if (item.type === 'spacer') {
          const spacer = document.createElement('div');
          spacer.style.flex = '1';
          toolbar.appendChild(spacer);
        } else {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `webos-btn ${item.primary ? 'webos-btn-primary' : ''} ${item.danger ? 'webos-btn-danger' : ''} ${item.className || ''}`;
          if (item.id) btn.id = item.id;
          btn.innerHTML = `${item.icon ? `<span>${item.icon}</span> ` : ''}${item.label ? this.escapeHtml(item.label) : ''}`;
          if (item.title) btn.title = item.title;
          if (item.disabled) btn.disabled = true;
          if (typeof item.onClick === 'function') {
            btn.addEventListener('click', (e) => item.onClick(e, btn));
          }
          toolbar.appendChild(btn);
        }
      });

      container.appendChild(toolbar);
      return toolbar;
    }

    /**
     * StatusBar Widget
     */
    createStatusBar(container, options = {}) {
      if (!container) return;
      const bar = document.createElement('div');
      bar.className = 'webos-statusbar';
      bar.style.display = 'flex';
      bar.style.alignItems = 'center';
      bar.style.justifyContent = 'space-between';
      bar.style.padding = '4px 12px';
      bar.style.fontSize = '0.8rem';
      bar.style.color = 'var(--text-muted, #94a3b8)';
      bar.style.background = 'var(--header-bg, rgba(0, 0, 0, 0.2))';
      bar.style.borderTop = '1px solid var(--border-color, rgba(255, 255, 255, 0.08))';

      bar.innerHTML = `
        <div class="webos-statusbar-left" style="display:flex; align-items:center; gap:8px;">
          ${options.statusDot ? `<span class="webos-status-dot" style="width:8px; height:8px; border-radius:50%; background:${options.statusDotColor || '#22c55e'}; display:inline-block;"></span>` : ''}
          <span class="webos-statusbar-text">${this.escapeHtml(options.text || '')}</span>
        </div>
        <div class="webos-statusbar-right" style="display:flex; align-items:center; gap:12px;">
          ${options.extraHtml || ''}
        </div>
      `;

      container.appendChild(bar);
      return {
        element: bar,
        setText: (txt) => {
          const el = bar.querySelector('.webos-statusbar-text');
          if (el) el.textContent = txt;
        },
        setStatusColor: (color) => {
          const dot = bar.querySelector('.webos-status-dot');
          if (dot) dot.style.background = color;
        }
      };
    }

    /**
     * SplitView Layout Helper
     */
    createSplitView(container, options = {}) {
      if (!container) return;
      container.style.display = 'flex';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.overflow = 'hidden';

      const sidebar = document.createElement('div');
      sidebar.className = 'webos-split-sidebar';
      sidebar.style.width = typeof options.sidebarWidth === 'number' ? `${options.sidebarWidth}px` : (options.sidebarWidth || '240px');
      sidebar.style.borderRight = '1px solid var(--border-color, rgba(255, 255, 255, 0.1))';
      sidebar.style.overflowY = 'auto';
      sidebar.style.flexShrink = '0';

      const main = document.createElement('div');
      main.className = 'webos-split-main';
      main.style.flex = '1';
      main.style.overflowY = 'auto';

      container.appendChild(sidebar);
      container.appendChild(main);

      return { sidebar, main };
    }

    /**
     * Floating ContextMenu Helper
     */
    createContextMenu(event, items = [], options = {}) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();

      const existing = document.querySelector('.webos-context-menu');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

      const menu = document.createElement('div');
      menu.className = 'webos-context-menu';
      menu.style.position = 'fixed';
      menu.style.zIndex = '99999';
      menu.style.background = 'var(--window-bg, #1e293b)';
      menu.style.border = '1px solid var(--border-color, rgba(255, 255, 255, 0.15))';
      menu.style.borderRadius = '8px';
      menu.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
      menu.style.padding = '6px';
      menu.style.minWidth = '160px';

      items.forEach(item => {
        if (item.type === 'separator') {
          const sep = document.createElement('div');
          sep.style.height = '1px';
          sep.style.background = 'var(--border-color, rgba(255, 255, 255, 0.1))';
          sep.style.margin = '4px 0';
          menu.appendChild(sep);
        } else {
          const menuItem = document.createElement('div');
          menuItem.className = 'webos-context-item';
          menuItem.style.padding = '6px 12px';
          menuItem.style.borderRadius = '4px';
          menuItem.style.cursor = 'pointer';
          menuItem.style.display = 'flex';
          menuItem.style.alignItems = 'center';
          menuItem.style.gap = '8px';
          menuItem.style.fontSize = '0.85rem';
          menuItem.style.color = item.danger ? '#ef4444' : 'var(--text-main, #f8fafc)';
          menuItem.innerHTML = `${item.icon ? `<span>${item.icon}</span>` : ''} <span>${this.escapeHtml(item.label || '')}</span>`;

          menuItem.addEventListener('mouseenter', () => menuItem.style.background = 'rgba(99, 102, 241, 0.2)');
          menuItem.addEventListener('mouseleave', () => menuItem.style.background = 'transparent');
          menuItem.addEventListener('click', () => {
            if (menu.parentNode) menu.parentNode.removeChild(menu);
            if (typeof item.onClick === 'function') item.onClick();
          });
          menu.appendChild(menuItem);
        }
      });

      const x = event ? (event.clientX || 100) : 100;
      const y = event ? (event.clientY || 100) : 100;
      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;

      document.body.appendChild(menu);

      const closeMenu = (e) => {
        if (!menu.contains(e.target) && menu.parentNode) {
          menu.parentNode.removeChild(menu);
          document.removeEventListener('click', closeMenu);
        }
      };
      setTimeout(() => document.addEventListener('click', closeMenu), 50);

      return menu;
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
    showToast: toolkitInstance.showToast.bind(toolkitInstance),
    toastSuccess: toolkitInstance.toastSuccess.bind(toolkitInstance),
    toastError: toolkitInstance.toastError.bind(toolkitInstance),
    toastWarning: toolkitInstance.toastWarning.bind(toolkitInstance),
    toastInfo: toolkitInstance.toastInfo.bind(toolkitInstance),
    modal: {
      create: toolkitInstance.createModal.bind(toolkitInstance)
    },
    dialog: {
      confirm: toolkitInstance.confirmDialog.bind(toolkitInstance),
      alert: toolkitInstance.alertDialog.bind(toolkitInstance),
      prompt: toolkitInstance.promptDialog.bind(toolkitInstance)
    },
    confirmDialog: toolkitInstance.confirmDialog.bind(toolkitInstance),
    alertDialog: toolkitInstance.alertDialog.bind(toolkitInstance),
    promptDialog: toolkitInstance.promptDialog.bind(toolkitInstance),
    toolbar: toolkitInstance.createToolbar.bind(toolkitInstance),
    statusBar: toolkitInstance.createStatusBar.bind(toolkitInstance),
    splitView: toolkitInstance.createSplitView.bind(toolkitInstance),
    contextMenu: toolkitInstance.createContextMenu.bind(toolkitInstance),
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
    settingRow: toolkitInstance.settingRow.bind(toolkitInstance),
    toggleRow: toolkitInstance.toggleRow.bind(toolkitInstance),
    languageSelect: toolkitInstance.languageSelect.bind(toolkitInstance),
    themeCard: toolkitInstance.themeCard.bind(toolkitInstance),
    themeGrid: toolkitInstance.themeGrid.bind(toolkitInstance),
    windowStyleCard: toolkitInstance.windowStyleCard.bind(toolkitInstance),
    windowStyleGrid: toolkitInstance.windowStyleGrid.bind(toolkitInstance),
    wallpaperGrid: toolkitInstance.wallpaperGrid.bind(toolkitInstance),
    escapeHtml: toolkitInstance.escapeHtml.bind(toolkitInstance)
  };

  // Unified API Client for WebOS (api.php)
  if (typeof window.SyscallClient !== 'undefined' && !(window.sys.api instanceof window.SyscallClient)) {
    window.sys.api = new window.SyscallClient();
  }
})(window, document);
