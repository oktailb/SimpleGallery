/**
 * SimpleGallery - Explorer Selection & Marquee Manager (apps/explorer/scripts/explorer-selection.js)
 * Handles item selection (single, Shift-range, toggle), rubber-band marquee selection, and keyboard navigation.
 */
(function(window) {
  'use strict';

  class ExplorerSelectionManager {
    constructor(instance) {
      this.inst = instance;
    }

    clearSelection() {
      this.inst.state.selectedPaths.clear();
      this.inst.state.lastSelectedIndex = null;
      this.inst.updateSelectionUI();
    }

    selectAll() {
      this.inst.state.selectedPaths.clear();
      this.inst.state.filteredFiles.forEach(f => this.inst.state.selectedPaths.add(f.path));
      this.inst.updateSelectionUI();
    }

    selectItem(index, e = null) {
      const file = this.inst.state.filteredFiles[index];
      if (!file) return;

      const isMulti = e && (e.ctrlKey || e.metaKey);
      const isRange = e && e.shiftKey;

      if (isRange && this.inst.state.lastSelectedIndex !== null) {
        const start = Math.min(this.inst.state.lastSelectedIndex, index);
        const end = Math.max(this.inst.state.lastSelectedIndex, index);
        this.inst.state.selectedPaths.clear();
        for (let i = start; i <= end; i++) {
          if (this.inst.state.filteredFiles[i]) {
            this.inst.state.selectedPaths.add(this.inst.state.filteredFiles[i].path);
          }
        }
      } else if (isMulti) {
        if (this.inst.state.selectedPaths.has(file.path)) {
          this.inst.state.selectedPaths.delete(file.path);
        } else {
          this.inst.state.selectedPaths.add(file.path);
          this.inst.state.lastSelectedIndex = index;
        }
      } else {
        this.inst.state.selectedPaths.clear();
        this.inst.state.selectedPaths.add(file.path);
        this.inst.state.lastSelectedIndex = index;
      }

      this.inst.updateSelectionUI();
    }

    updateSelectionUI() {
      const count = this.inst.state.selectedPaths.size;
      if (!this.inst.el.mediaGrid) return;

      this.inst.el.mediaGrid.querySelectorAll('[data-index]').forEach(card => {
        const idx = parseInt(card.dataset.index, 10);
        const f = this.inst.state.filteredFiles[idx];
        if (f && this.inst.state.selectedPaths.has(f.path)) {
          card.classList.add('selected');
        } else {
          card.classList.remove('selected');
        }
      });

      if (this.inst.el.selectionToolbar) {
        if (count > 0) {
          this.inst.el.selectionToolbar.classList.add('visible');
          if (this.inst.el.selectionToolbarCount) {
            this.inst.el.selectionToolbarCount.textContent = `${count} sélectionné${count > 1 ? 's' : ''}`;
          }
        } else {
          this.inst.el.selectionToolbar.classList.remove('visible');
        }
      }

      // Update Inspector panel if open
      if (this.inst.isInspectorOpen && count === 1) {
        const first = Array.from(this.inst.state.selectedPaths)[0];
        const file = this.inst.state.filteredFiles.find(f => f.path === first);
        if (file) this.inst.updateInspectorUI(file);
      }
    }

    initMarqueeSelection() {
      const container = this.inst.containerEl;
      if (!container) return;

      let isSelecting = false;
      let startX = 0;
      let startY = 0;
      let marqueeEl = null;

      const onMouseDown = (e) => {
        if (e.button !== 0) return;
        const target = e.target;
        if (target.closest('.media-card, .polaroid-card, .folder-card, button, input, a, .selection-toolbar, .explorer-inspector-drawer')) {
          return;
        }

        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;

        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          this.clearSelection();
        }

        if (!marqueeEl) {
          marqueeEl = document.createElement('div');
          marqueeEl.className = 'explorer-selection-marquee';
          marqueeEl.style.cssText = 'position:fixed;border:1.5px solid rgba(99,102,241,0.8);background:rgba(99,102,241,0.15);pointer-events:none;z-index:9999;border-radius:3px;display:none;';
          document.body.appendChild(marqueeEl);
        }
      };

      const onMouseMove = (e) => {
        if (!isSelecting || !marqueeEl) return;
        const currentX = e.clientX;
        const currentY = e.clientY;
        const minX = Math.min(startX, currentX);
        const maxX = Math.max(startX, currentX);
        const minY = Math.min(startY, currentY);
        const maxY = Math.max(startY, currentY);
        const width = maxX - minX;
        const height = maxY - minY;

        if (width > 4 || height > 4) {
          marqueeEl.style.display = 'block';
          marqueeEl.style.left = `${minX}px`;
          marqueeEl.style.top = `${minY}px`;
          marqueeEl.style.width = `${width}px`;
          marqueeEl.style.height = `${height}px`;

          const marqueeRect = { left: minX, right: maxX, top: minY, bottom: maxY };
          if (this.inst.el.mediaGrid) {
            this.inst.el.mediaGrid.querySelectorAll('[data-index]').forEach(card => {
              const cardRect = card.getBoundingClientRect();
              const intersects = !(
                cardRect.right < marqueeRect.left ||
                cardRect.left > marqueeRect.right ||
                cardRect.bottom < marqueeRect.top ||
                cardRect.top > marqueeRect.bottom
              );

              const idx = parseInt(card.dataset.index, 10);
              const file = this.inst.state.filteredFiles[idx];
              if (file) {
                if (intersects) {
                  this.inst.state.selectedPaths.add(file.path);
                } else if (!e.ctrlKey && !e.metaKey) {
                  this.inst.state.selectedPaths.delete(file.path);
                }
              }
            });
            this.updateSelectionUI();
          }
        }
      };

      const onMouseUp = () => {
        if (isSelecting) {
          isSelecting = false;
          if (marqueeEl) {
            marqueeEl.style.display = 'none';
          }
        }
      };

      container.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);

      this._cleanupMarquee = () => {
        container.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        if (marqueeEl && marqueeEl.parentNode) {
          marqueeEl.parentNode.removeChild(marqueeEl);
        }
      };
    }

    destroy() {
      if (this._cleanupMarquee) {
        this._cleanupMarquee();
      }
    }
  }

  window.ExplorerSelectionManager = ExplorerSelectionManager;

})(window);
