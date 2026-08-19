/**
 * SimpleGallery 2026 - Settings Application
 */
(function(window) {
  'use strict';

  const SettingsApp = {
    id: 'settings',
    name: 'Settings Manager',
    open() {
      const modal = document.getElementById('folderSettingsModal') || document.getElementById('adminLoginModal');
      if (modal) modal.classList.add('open');
    }
  };

  window.SettingsApp = SettingsApp;
})(window);
