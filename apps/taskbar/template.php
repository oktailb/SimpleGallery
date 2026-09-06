<?php
// SimpleGallery WebOS - Taskbar Application Template
// Mounted into the DOM when the taskbar app is enabled.
?>
<footer id="webosTaskbar" class="webos-taskbar app-footer">
  <!-- Left: Brand info & Cookie Settings -->
  <div class="taskbar-left-zone">
    <a href="https://github.com/oktailb/SimpleGallery" target="_blank" rel="noopener noreferrer" class="taskbar-brand-link" title="SimpleGallery on GitHub">
      📸 <strong><?php echo htmlspecialchars($gallery_title ?? 'SimpleGallery', ENT_QUOTES, 'UTF-8'); ?></strong>
    </a>
    <span class="taskbar-tech">PHP &amp; JS</span>
    <span class="taskbar-separator">•</span>
    <button type="button" id="openCookieSettingsBtn" class="taskbar-cookie-btn" title="Gérer vos préférences de confidentialité et cookies" data-i18n-title="cookie.footer_link" data-i18n="cookie.footer_link">
      🍪 Cookies
    </button>
    <div id="cookieConsentBanner" style="display:none;"></div>
  </div>

  <!-- Center: Running Applications & Pinned Apps -->
  <div class="taskbar-apps-container" id="taskbarAppsContainer"></div>

  <!-- Right: System Tray (Telemetry, Clock, Show Desktop) -->
  <div class="taskbar-tray-container" id="taskbarTrayContainer">
    <button type="button" class="taskbar-tray-btn" id="taskbarSysmonBtn" title="Moniteur Système (Télémétrie)">
      <span class="taskbar-tray-icon">📊</span>
      <span id="taskbarFpsPill" class="taskbar-tray-pill">60 FPS</span>
    </button>

    <button type="button" class="taskbar-clock-btn" id="taskbarCalendarBtn" title="Calendrier &amp; Horloge">
      <span id="taskbarClockTime" class="taskbar-clock-time">--:--</span>
      <span id="taskbarClockDate" class="taskbar-clock-date">--/--</span>
    </button>

    <button type="button" class="taskbar-show-desktop" id="taskbarShowDesktopBtn" title="Afficher le Bureau"></button>
  </div>
</footer>

<!-- Floating Hover Preview Card (Window Peeking) -->
<div id="taskbarPreviewCard" class="taskbar-preview-card" style="display: none;"></div>

<!-- Mini Calendar Popover -->
<div id="taskbarCalendarPopover" class="taskbar-calendar-popover" style="display: none;"></div>
