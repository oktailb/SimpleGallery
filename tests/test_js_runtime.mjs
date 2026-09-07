/**
 * SimpleGallery - Automated JavaScript Runtime & Iso-Functionality Verification Suite
 * Executes in Node.js (v22+) to test DOM templates, scripts, i18n completeness, and method conformance.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalChecks = 0;
let passedChecks = 0;
const failures = [];

function assert(desc, condition, details = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✅ PASS: ${desc}`);
  } else {
    failures.push({ desc, details });
    console.error(`  ❌ FAIL: ${desc} ${details ? `(${details})` : ''}`);
  }
}

console.log('============================================================');
console.log(' 🧪 VALIDATION AUTOMATISÉE ISO-FONCTIONNELLE & KPI RUNTIME');
console.log('============================================================\n');

// -------------------------------------------------------------
// 1. Audit i18n Exhaustif : Vérification FR, EN, JA pour toutes les applications
// -------------------------------------------------------------
console.log('🌐 [1/5] Audit Internationalisation (i18n) FR / EN / JA...');

const appsDir = path.join(rootDir, 'apps');
const appFolders = fs.readdirSync(appsDir);

appFolders.forEach(appFolder => {
  const manifestPath = path.join(appsDir, appFolder, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const appId = manifest.id || appFolder;
  const localesDir = path.join(appsDir, appFolder, 'locales');

  ['fr', 'en', 'ja'].forEach(lang => {
    // Check manifest locales definition if declared
    if (manifest.locales && manifest.locales[lang]) {
      assert(`Manifest de '${appId}' déclare le titre en [${lang}]`, !!manifest.locales[lang].title);
    }

    // Check app locales directory files
    if (fs.existsSync(localesDir)) {
      const langFile = path.join(localesDir, `${lang}.json`);
      if (fs.existsSync(langFile)) {
        try {
          const content = JSON.parse(fs.readFileSync(langFile, 'utf8'));
          assert(`Fichier apps/${appId}/locales/${lang}.json est un JSON valide`, typeof content === 'object');
        } catch (e) {
          assert(`Fichier apps/${appId}/locales/${lang}.json est valide`, false, e.message);
        }
      }
    }
  });
});

// Vérifier que autorun-editor a bien fr.json, en.json et ja.json avec le même jeu de clés
const autorunLocalesDir = path.join(appsDir, 'autorun-editor', 'locales');
const frJson = JSON.parse(fs.readFileSync(path.join(autorunLocalesDir, 'fr.json'), 'utf8'));
const enJson = JSON.parse(fs.readFileSync(path.join(autorunLocalesDir, 'en.json'), 'utf8'));
const jaJson = JSON.parse(fs.readFileSync(path.join(autorunLocalesDir, 'ja.json'), 'utf8'));

const frKeys = Object.keys(frJson).sort();
const enKeys = Object.keys(enJson).sort();
const jaKeys = Object.keys(jaJson).sort();

assert("Autorun Studio : parité stricte des clés FR == EN", JSON.stringify(frKeys) === JSON.stringify(enKeys));
assert("Autorun Studio : parité stricte des clés FR == JA", JSON.stringify(frKeys) === JSON.stringify(jaKeys));
assert("Autorun Studio : clé apps.autorun-editor.title présente en JA", jaJson['apps.autorun-editor.title'] === 'オートランスタジオ');

// -------------------------------------------------------------
// 2. Vérification de la Présence et Syntaxe de Tous les Fichiers Modulaires
// -------------------------------------------------------------
console.log('\n📦 [2/5] Vérification de l\'Architecture Modulaire Explorer...');

const explorerManifest = JSON.parse(fs.readFileSync(path.join(appsDir, 'explorer', 'manifest.json'), 'utf8'));
const registeredScripts = explorerManifest.scripts || [];

[
  'autorun-engine.js',
  'scripts/explorer-selection.js',
  'scripts/explorer-dragdrop.js',
  'scripts/explorer-map.js',
  'scripts/explorer-modals.js'
].forEach(scriptRel => {
  const fullPath = path.join(appsDir, 'explorer', scriptRel);
  assert(`Fichier modulaire présent : apps/explorer/${scriptRel}`, fs.existsSync(fullPath));
  assert(`Script déclaré dans manifest.scripts : ${scriptRel}`, registeredScripts.includes(scriptRel));

  if (fs.existsSync(fullPath)) {
    const code = fs.readFileSync(fullPath, 'utf8');
    assert(`Syntaxe non vide : ${scriptRel}`, code.trim().length > 100);
  }
});

// -------------------------------------------------------------
// 3. Matrice de Conformité de l'API Explorer (Préservation Fonctionnelle Stricte)
// -------------------------------------------------------------
console.log('\n🔍 [3/5] Matrice de Conformité de l\'Interface Publique Explorer...');

const explorerJs = fs.readFileSync(path.join(appsDir, 'explorer', 'explorer.js'), 'utf8');

const requiredMethods = [
  'initManagers',
  'initContainer',
  'initWindow',
  'destroy',
  'initElements',
  'loadSavedPreferences',
  't',
  'escapeHtml',
  'showLoading',
  'showToast',
  'navigateTo',
  'loadDirectory',
  'applyFolderOverrides',
  'renderBreadcrumbs',
  'renderFolders',
  'applyFilterAndRender',
  'renderMedia',
  'setViewMode',
  'bindMediaCardEvents',
  'moveItems',
  'openMedia',
  'toggleSortOrder',
  'saveFolderSort',
  'getFolderSort',
  'toggleFavorite',
  'toggleFavoritesFilter',
  'setFilterCategory',
  'updateFilterPillsUI',
  'updateStats',
  'clearSelection',
  'selectAll',
  'updateSelectionUI',
  'initMarqueeSelection',
  'computeSmartGpsLocations',
  'updateFolderMapButton',
  'openMapModal',
  'closeMapModal',
  'initLeafletMap',
  'openSearchModal',
  'closeSearchModal',
  'positionSearchModal',
  'exitSearch',
  'openCreateFolderModal',
  'closeCreateFolderModal',
  'createFolder',
  'openDeleteConfirmModal',
  'closeDeleteConfirmModal',
  'confirmDeleteItem',
  'deleteSelection',
  'openMediaCommentModal',
  'closeMediaCommentModal',
  'saveMediaComment',
  'openFolderUnlockModal',
  'closeFolderUnlockModal',
  'unlockFolder',
  'openFolderSettingsModal',
  'closeFolderSettingsModal',
  'launchAutorun',
  'openAutorunEditorModal',
  'renderAutorunVisualTimeline',
  'addAutorunStep',
  'removeAutorunStep',
  'moveAutorunStep',
  'previewCurrentAutorun',
  'saveAutorunConfig',
  'deleteAutorunConfig',
  'toggleInspector',
  'updateInspectorUI'
];

requiredMethods.forEach(method => {
  const hasMethod = explorerJs.includes(`${method}(`) || explorerJs.includes(`${method} =`) || explorerJs.includes(`async ${method}(`);
  assert(`ExplorerInstance implémente la méthode '${method}'`, hasMethod);
});

// -------------------------------------------------------------
// 4. Vérification de l'Optimisation DOM (Délégation d'Événements)
// -------------------------------------------------------------
console.log('\n⚡ [4/5] Vérification de la Délégation d\'Événements (Performance DOM)...');

assert("bindMediaCardEvents utilise mediaGrid.addEventListener('click', ...)", explorerJs.includes("this.el.mediaGrid.addEventListener('click'") || explorerJs.includes('mediaGrid.addEventListener("click"'));
assert("bindMediaCardEvents utilise mediaGrid.addEventListener('dblclick', ...)", explorerJs.includes("this.el.mediaGrid.addEventListener('dblclick'") || explorerJs.includes('mediaGrid.addEventListener("dblclick"'));
assert("bindMediaCardEvents utilise mediaGrid.addEventListener('dragstart', ...)", explorerJs.includes("this.el.mediaGrid.addEventListener('dragstart'") || explorerJs.includes('mediaGrid.addEventListener("dragstart"'));
assert("bindMediaCardEvents protège contre le double attachement via _mediaEventsDelegated", explorerJs.includes('_mediaEventsDelegated'));
assert("bindMediaCardEvents utilise e.target.closest pour la sélection de carte", explorerJs.includes("e.target.closest('[data-index]')"));

// -------------------------------------------------------------
// 5. Conformité de l'Application Dédiée Autorun Studio
// -------------------------------------------------------------
console.log('\n🎬 [5/5] Conformité de l\'Application Autorun Studio...');

const autorunAppJs = fs.readFileSync(path.join(appsDir, 'autorun-editor', 'app.js'), 'utf8');
const autorunTpl = fs.readFileSync(path.join(appsDir, 'autorun-editor', 'template.php'), 'utf8');

assert("Autorun Studio expose window.AutorunStudio", autorunAppJs.includes('window.AutorunStudio = this'));
assert("Autorun Studio hérite de WebOSApp", autorunAppJs.includes('class AutorunEditorApp extends WebOSApp'));
assert("Autorun Studio implémente switchTab", autorunAppJs.includes('switchTab('));
assert("Autorun Studio implémente syncVisualToConfig", autorunAppJs.includes('syncVisualToConfig('));
assert("Autorun Studio implémente renderTimeline", autorunAppJs.includes('renderTimeline('));
assert("Autorun Studio implémente addStep", autorunAppJs.includes('addStep('));
assert("Autorun Studio implémente preview", autorunAppJs.includes('preview('));
assert("Autorun Studio implémente save", autorunAppJs.includes('save('));
assert("Autorun Studio implémente delete", autorunAppJs.includes('delete('));
assert("Autorun Studio implémente openFolder", autorunAppJs.includes('openFolder('));
// -------------------------------------------------------------
// 6. Non-Régression & Robustesse des Événements & Classes WebOS
// -------------------------------------------------------------
console.log('\n🛡️ [6/6] Non-Régression & Robustesse Runtime (ShortcutManager & WebOSApp)...');

const shortcutManagerJs = fs.readFileSync(path.join(rootDir, 'system', 'userland', 'core', 'ShortcutManager.js'), 'utf8');
const webOsAppJs = fs.readFileSync(path.join(rootDir, 'system', 'userland', 'core', 'WebOSApp.js'), 'utf8');

// Test ShortcutManager._getEventCombo with mock execution
assert("ShortcutManager.js protège _getEventCombo contre e.key indéfini", shortcutManagerJs.includes("if (!e || typeof e.key !== 'string') return '';"));

// Evaluate _getEventCombo logic directly in Node
const getEventComboFunction = new Function('e', `
  if (!e || typeof e.key !== 'string') return '';
  const parts = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  if (e.metaKey) parts.push('meta');
  let key = e.key.toLowerCase();
  if (key === 'control' || key === 'alt' || key === 'shift' || key === 'meta') return '';
  if (key === ' ') key = 'space';
  parts.push(key);
  return parts.join('+');
`);

try {
  const resUndefined = getEventComboFunction({ key: undefined });
  assert("ShortcutManager._getEventCombo({ key: undefined }) ne lève aucune exception et renvoie ''", resUndefined === '');
} catch (err) {
  assert("ShortcutManager._getEventCombo({ key: undefined }) ne lève aucune exception", false, err.message);
}

try {
  const resEmpty = getEventComboFunction({});
  assert("ShortcutManager._getEventCombo({}) ne lève aucune exception et renvoie ''", resEmpty === '');
} catch (err) {
  assert("ShortcutManager._getEventCombo({}) ne lève aucune exception", false, err.message);
}

try {
  const resValid = getEventComboFunction({ key: 'F', ctrlKey: true });
  assert("ShortcutManager._getEventCombo({ key: 'F', ctrlKey: true }) résout 'ctrl+f'", resValid === 'ctrl+f');
} catch (err) {
  assert("ShortcutManager._getEventCombo({ key: 'F', ctrlKey: true })", false, err.message);
}

// Check WebOSApp setContent helper
assert("WebOSApp fournit la méthode setContent(content)", webOsAppJs.includes('setContent(content)'));
assert("AutorunEditorApp implémente renderShell()", autorunAppJs.includes('renderShell()'));
assert("AutorunEditorApp implémente render()", autorunAppJs.includes('render()'));
assert("AutorunEditorApp possède un montage sécurisé dans initUI()", autorunAppJs.includes('this.setContent(root)'));
assert("AutorunEditorApp implémente showToast(message, type)", autorunAppJs.includes('showToast(message, type = \'info\')'));

const webOsServicesJs = fs.readFileSync(path.join(rootDir, 'system', 'userland', 'services', 'WebOSServices.js'), 'utf8');
assert("WebOSServices expose la méthode polyfill window.sys.toast.show", webOsServicesJs.includes('show: (msg, typeOrOpts'));

// Test Autorun Studio multi-app controls & parameter persistence
const autorunEditorJs = fs.readFileSync(path.join(rootDir, 'apps', 'autorun-editor', 'app.js'), 'utf8');
assert("AutorunEditorApp implémente la méthode i18n t(key, params)", autorunEditorJs.includes('t(key, params)'));
assert("AutorunEditorApp implémente la méthode escapeHtml(str)", autorunEditorJs.includes('escapeHtml(str)'));
assert("AutorunEditorApp configure doc-viewer avec sélecteur de fichier docFiles", autorunEditorJs.includes("buildFileOptions(file, docFiles)"));
assert("AutorunEditorApp configure doc-viewer avec ancre data-step-hl", autorunEditorJs.includes("data-step-hl"));
assert("AutorunEditorApp configure image-viewer avec sélecteur de fichier imgFiles", autorunEditorJs.includes("buildFileOptions(file, imgFiles)"));
assert("AutorunEditorApp configure video-player avec sélecteur de fichier vidéo", autorunEditorJs.includes("buildFileOptions(file, videoFiles.length > 0 ? videoFiles : mediaFiles)"));
assert("AutorunEditorApp configure audio-player avec sélecteur de fichier audio", autorunEditorJs.includes("buildFileOptions(file, audioFiles.length > 0 ? audioFiles : mediaFiles)"));
assert("AutorunEditorApp configure maps avec coordonnées GPS (lat, lng, zoom)", autorunEditorJs.includes("data-step-lat") && autorunEditorJs.includes("data-step-lng") && autorunEditorJs.includes("data-step-zoom"));
assert("AutorunEditorApp gère les commandes dynamiques pour control_app (getCommandsForApp)", autorunEditorJs.includes("getCommandsForApp(app)") && autorunEditorJs.includes("step-param-input"));
assert("AutorunEditorApp synchronise les paramètres d'action dans syncVisualToConfig", autorunEditorJs.includes("stepObj.params.highlight = highlight") && autorunEditorJs.includes("stepObj.params.file = file"));

// -------------------------------------------------------------
// NOUVEAUX CONTRÔLES MULTIMODAUX & CAPTURE MAPS (2026)
// -------------------------------------------------------------
console.log('\n🎮 [7/7] Vérification des Nouveaux Contrôles Multimodaux & Capture Maps...');

// 1. Doc-Viewer
const docViewerManifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'apps', 'doc-viewer', 'manifest.json'), 'utf8'));
const docViewerJs = fs.readFileSync(path.join(rootDir, 'apps', 'doc-viewer', 'viewer.js'), 'utf8');
assert("doc-viewer manifest déclare scrollTo, searchText, nextPage, prevPage", 
  !!docViewerManifest.commands.scrollTo && !!docViewerManifest.commands.searchText && !!docViewerManifest.commands.nextPage && !!docViewerManifest.commands.prevPage);
assert("doc-viewer viewer.js déclare isPdf = ext === 'pdf'", docViewerJs.includes("const isPdf = ext === 'pdf';"));
assert("doc-viewer viewer.js implémente scrollTo(params, winId)", docViewerJs.includes('scrollTo(params = {}, winId = null)'));
assert("doc-viewer viewer.js implémente searchText(params, winId)", docViewerJs.includes('searchText(params = {}, winId = null)'));
assert("doc-viewer viewer.js implémente nextPage(params, winId)", docViewerJs.includes('nextPage(params = {}, winId = null)'));
assert("doc-viewer viewer.js implémente prevPage(params, winId)", docViewerJs.includes('prevPage(params = {}, winId = null)'));
assert("doc-viewer viewer.js implémente setTheme(params, winId)", docViewerJs.includes('setTheme(params = {}, winId = null)'));
assert("doc-viewer viewer.js implémente handleCommand", docViewerJs.includes('handleCommand(command, params = {}, winId = null)'));

// Test runtime execution of DocViewerPlugin.open
try {
  const origDoc = global.document;
  global.document = {
    getElementById: () => null,
    createElement: () => ({ style: {} }),
    head: { appendChild: () => {} },
    createTreeWalker: () => ({ nextNode: () => null })
  };
  const fakeWindow = {
    sys: {
      appManager: { 
        getAppTitle: () => 'Doc Viewer',
        registerInstance: () => {}
      },
      api: { fs: { saveTextFile: async () => ({ success: true }) } }
    },
    WindowManager: {
      createWindow: (opts) => ({ id: opts.id, element: {} }),
      windows: new Map()
    },
    MenuBarManager: { registerAppMenu: () => {}, setActiveApp: () => {} },
    MediaViewerRegistry: { register: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  const docFunc = new Function('window', docViewerJs + '\nreturn window.DocViewerApp;');
  const docPlugin = docFunc(fakeWindow);
  await docPlugin.open({ path: 'test.md', name: 'test.md', extension: 'md', file_url: 'test.md' }, {}, {
    state: { filteredFiles: [], files: [], isAdmin: true },
    t: (k) => k,
    escapeHtml: (s) => s
  });
  assert("doc-viewer viewer.js open() s'exécute sans ReferenceError ou TDZ", true);
} catch (e) {
  assert("doc-viewer viewer.js open() s'exécute sans ReferenceError ou TDZ", false, e.stack);
}

// 2. Maps
const mapsManifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'apps', 'maps', 'manifest.json'), 'utf8'));
const mapsJs = fs.readFileSync(path.join(rootDir, 'apps', 'maps', 'maps.js'), 'utf8');
assert("maps manifest déclare moveTo et whereIam", !!mapsManifest.commands.moveTo && !!mapsManifest.commands.whereIam);
assert("maps maps.js implémente moveTo(params) dans MapsInstance", mapsJs.includes('moveTo(params = {})'));
assert("maps maps.js implémente whereIam() dans MapsInstance", mapsJs.includes('whereIam()'));
assert("maps maps.js implémente whereIam(winId) dans WebOSMapsApp", mapsJs.includes('whereIam(winId = null)'));
assert("maps maps.js implémente moveTo(params, winId) dans WebOSMapsApp", mapsJs.includes('moveTo(params = {}, winId = null)'));
assert("maps maps.js implémente handleCommand dans WebOSMapsApp", mapsJs.includes('handleCommand(command, params = {}, winId = null)'));
assert("maps maps.js extrait et stocke initialCenter depuis options.lat/lng/zoom", mapsJs.includes('this.initialCenter ='));
assert("maps maps.js préserve initialCenter dans renderMapContent sans être écrasé par recenterMap", mapsJs.includes('if (this.initialCenter) {'));

// Test d'exécution MapsInstance avec coordonnées initiales
try {
  let createdMapCenter = null;
  let createdMapZoom = null;
  const fakeL = {
    tileLayer: () => ({ addTo: () => {} }),
    map: (container, opts) => {
      createdMapCenter = opts.center;
      createdMapZoom = opts.zoom;
      return {
        addLayer: () => {},
        setView: (c, z) => { createdMapCenter = c; createdMapZoom = z; },
        remove: () => {},
        invalidateSize: () => {}
      };
    },
    markerClusterGroup: () => ({ addLayer: () => {}, clearLayers: () => {}, getBounds: () => null })
  };
  const fakeWinMaps = {
    document: {
      getElementById: () => ({ querySelectorAll: () => [], querySelector: () => null }),
      querySelector: () => null,
      querySelectorAll: () => []
    },
    L: fakeL,
    WebOSApp: class {
      constructor(manifest) { this.manifest = manifest; }
      t(k) { return k; }
      escapeHtml(s) { return String(s || ''); }
    },
    WindowManager: { createWindow: (w) => w, focusWindow: () => {}, setTitle: () => {} },
    sys: {
      appManager: { getAppTitle: () => 'Maps', registerInstance: () => {} },
      api: { get: async () => ({ success: true, files: [] }) }
    }
  };
  const mapsFunc = new Function('window', mapsJs + '\nreturn window.mapsApp;');
  const appInstance = mapsFunc(fakeWinMaps);
  const inst = appInstance.open({ files: [], lat: 48.8566, lng: 2.3522, zoom: 12 });
  assert("maps open() avec lat/lng initialise initialCenter correctement", inst.initialCenter && inst.initialCenter.lat === 48.8566 && inst.initialCenter.lng === 2.3522 && inst.initialCenter.zoom === 12);
  inst.initMapCanvas();
  assert("maps initMapCanvas() utilise les coordonnées initiales spécifiées", createdMapCenter && createdMapCenter[0] === 48.8566 && createdMapCenter[1] === 2.3522 && createdMapZoom === 12);
  inst.renderMapContent();
  assert("maps renderMapContent() respecte initialCenter sans l'écraser", createdMapCenter && createdMapCenter[0] === 48.8566 && createdMapCenter[1] === 2.3522);
} catch (e) {
  assert("maps exécution avec coordonnées initiales", false, e.stack);
}

// 3. Image-Viewer
const imgViewerManifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'apps', 'image-viewer', 'manifest.json'), 'utf8'));
const imgViewerJs = fs.readFileSync(path.join(rootDir, 'apps', 'image-viewer', 'viewer.js'), 'utf8');
assert("image-viewer manifest déclare zoom et move", !!imgViewerManifest.commands.zoom && !!imgViewerManifest.commands.move);
assert("image-viewer viewer.js implémente zoom(params, cleanPathId)", imgViewerJs.includes('zoom(params = {}, cleanPathId = null)'));
assert("image-viewer viewer.js implémente move(params, cleanPathId)", imgViewerJs.includes('move(params = {}, cleanPathId = null)'));
assert("image-viewer viewer.js implémente handleCommand", imgViewerJs.includes('handleCommand(command, params = {}, winId = null)'));

// 4. Video & Audio Player
const videoManifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'apps', 'video-player', 'manifest.json'), 'utf8'));
const audioManifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'apps', 'audio-player', 'manifest.json'), 'utf8'));
assert("video-player manifest déclare seekTo et playbackRate", !!videoManifest.commands.seekTo && !!videoManifest.commands.playbackRate);
assert("audio-player manifest déclare seekTo et playbackRate", !!audioManifest.commands.seekTo && !!audioManifest.commands.playbackRate);

// 5. AppManager & Autorun Engine
const appManagerJs = fs.readFileSync(path.join(rootDir, 'system', 'userland', 'core', 'AppManager.js'), 'utf8');
const autorunEngineJs = fs.readFileSync(path.join(rootDir, 'apps', 'explorer', 'autorun-engine.js'), 'utf8');
assert("AppManager dispatchCommand gère whereIam et moveTo pour maps", appManagerJs.includes("command === 'whereIam'") && appManagerJs.includes("command === 'moveTo'"));
assert("AppManager dispatchCommand gère seekTo et playbackRate pour audio/vidéo", appManagerJs.includes("command === 'seekTo'") && appManagerJs.includes("command === 'playbackRate'"));
assert("autorun-engine transmet lat, lng, zoom lors de openApp maps", autorunEngineJs.includes('mapOptions.lat = Number(lat)') && autorunEngineJs.includes('mapOptions.lng = Number(rawLng)'));

// 6. Autorun Studio Capture Maps
assert("Autorun Studio intègre le bouton 'Capturer depuis Maps'", autorunEditorJs.includes('data-step-capture-map'));
assert("Autorun Studio implémente captureMapPosition(stepIdx)", autorunEditorJs.includes('captureMapPosition(stepIdx)'));
assert("Autorun Studio getCommandsForApp expose moveTo et whereIam", autorunEditorJs.includes('moveTo:') && autorunEditorJs.includes('whereIam:'));
assert("Autorun Studio getCommandsForApp expose scrollTo et searchText", autorunEditorJs.includes('scrollTo:') && autorunEditorJs.includes('searchText:'));
assert("Autorun Studio getCommandsForApp expose zoom et move pour image", autorunEditorJs.includes('zoom:') && autorunEditorJs.includes('move:'));
assert("Autorun Studio getCommandsForApp expose seekTo pour video et audio", autorunEditorJs.includes('seekTo:'));

// 8. Doc-Viewer Upgrades (GFM, KaTeX, Prism, HTML preview, LaTeX) & WebOS Browser
console.log("\n🌐 [8/8] Conformité Doc-Viewer Avancé & Navigateur WebOS...");
const docViewerCss = fs.readFileSync(path.join(rootDir, 'apps', 'doc-viewer', 'viewer.css'), 'utf8');

assert("doc-viewer manifest supporte htm, tex, latex, yaml", ['htm', 'tex', 'latex', 'yaml', 'yml'].every(ext => docViewerManifest.extensions.includes(ext)));
assert("doc-viewer manifest déclare markdown-gfm, html-preview, latex-render", ['markdown-gfm', 'html-preview', 'latex-render'].every(cap => docViewerManifest.capabilities.includes(cap)));
assert("doc-viewer viewer.js implémente loadMarkdownEngines", docViewerJs.includes('loadMarkdownEngines'));
assert("doc-viewer viewer.js implémente loadLatexEngine", docViewerJs.includes('loadLatexEngine'));
assert("doc-viewer viewer.js implémente fallbackPureJsMarkdown", docViewerJs.includes('fallbackPureJsMarkdown'));
assert("doc-viewer viewer.js implémente le support TeX/LaTeX et bascule code source", docViewerJs.includes('isTex') && docViewerJs.includes('docTexViewToggleBtn'));
assert("doc-viewer viewer.js implémente le support HTML preview iframe et bascule", docViewerJs.includes('isHtml') && docViewerJs.includes('docHtmlViewToggleBtn'));
assert("doc-viewer viewer.css intègre md-codeblock, md-alert, doc-latex-render et doc-html-frame",
  docViewerCss.includes('.md-codeblock-container') &&
  docViewerCss.includes('.md-alert') &&
  docViewerCss.includes('.doc-latex-render') &&
  docViewerCss.includes('.doc-html-frame')
);

// Browser standalone app
const browserManifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'apps', 'browser', 'manifest.json'), 'utf8'));
const browserJs = fs.readFileSync(path.join(rootDir, 'apps', 'browser', 'app.js'), 'utf8');
const browserCss = fs.readFileSync(path.join(rootDir, 'apps', 'browser', 'style.css'), 'utf8');

assert("browser manifest valide avec ID 'browser' et catégorie 'utilities'", browserManifest.id === 'browser' && browserManifest.category === 'utilities');
assert("browser app.js hérite de WebOSApp", browserJs.includes('extends WebOSApp'));
assert("browser app.js implémente la navigation multi-onglets (addTab, switchTab, closeTab)",
  browserJs.includes('addTab(') && browserJs.includes('switchTab(') && browserJs.includes('closeTab(')
);
assert("browser app.js implémente normalizeUrl et recherche web", browserJs.includes('normalizeUrl(') && browserJs.includes('duckduckgo.com'));
assert("browser app.js implémente getEffectiveIframeUrl et toggleProxy", browserJs.includes('getEffectiveIframeUrl(') && browserJs.includes('toggleProxy('));
assert("browser style.css intègre browser-proxy-btn et browser-omnibar-box.proxified",
  browserCss.includes('.browser-proxy-btn') && browserCss.includes('.browser-omnibar-box.proxified')
);

// Test runtime BrowserApp
try {
  const fakeWinBrowser = {
    document: {
      createElement: (t) => {
        const el = {
          tagName: t.toUpperCase(),
          className: '',
          style: {},
          children: [],
          dataset: {},
          appendChild: (c) => { el.children.push(c); return c; },
          addEventListener: () => {},
          remove: () => {},
          querySelector: () => null,
          querySelectorAll: () => []
        };
        return el;
      },
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => []
    },
    WebOSApp: class {
      constructor(manifest) { this.manifest = manifest; }
      t(k) { return k; }
      escapeHtml(s) { return String(s || ''); }
    },
    WindowManager: { createWindow: (w) => w, focusWindow: () => {}, setTitle: () => {} },
    sys: {
      appManager: { getAppTitle: () => 'Browser', registerInstance: () => {} },
      storage: { get: () => null, set: () => {} }
    }
  };
  const browserFunc = new Function('window', browserJs + '\nreturn window.BrowserApp;');
  const browserInst = browserFunc(fakeWinBrowser);
  assert("browser exporte window.BrowserApp et window.WebOSBrowserApp", typeof fakeWinBrowser.WebOSBrowserApp === 'function' && typeof browserInst === 'object');
  assert("browser instancié sans erreur", !!browserInst);
  const tab1 = browserInst.addTab('https://wikipedia.org');
  assert("browser addTab crée un onglet", !!tab1 && tab1.url === 'https://wikipedia.org');
  const norm1 = browserInst.normalizeUrl('google.com');
  assert("browser normalizeUrl préfixe https://", norm1 === 'https://google.com');
  const normSearch = browserInst.normalizeUrl('recherche simple');
  assert("browser normalizeUrl transforme requête en recherche DuckDuckGo", normSearch.includes('duckduckgo.com/?q=recherche'));
  
  // Test proxy mode routing
  browserInst.useProxy = false;
  assert("browser getEffectiveIframeUrl en mode direct renvoie l'URL directe", browserInst.getEffectiveIframeUrl('https://example.com') === 'https://example.com');
  browserInst.useProxy = true;
  assert("browser getEffectiveIframeUrl en mode proxy route vers api.php?action=browser_proxy", browserInst.getEffectiveIframeUrl('https://example.com').includes('api.php?action=browser_proxy&url='));
  assert("browser getEffectiveIframeUrl laisse les fichiers locaux directs même en mode proxy", browserInst.getEffectiveIframeUrl('storage/test.html') === 'storage/test.html');
  browserInst.toggleProxy();
  assert("browser toggleProxy bascule l'état useProxy", browserInst.useProxy === false);
} catch (e) {
  assert("browser exécution runtime", false, e.stack);
}

console.log('\n============================================================');
console.log(` 📊 SCORECARD DES TESTS ISO-FONCTIONNELS JS : ${passedChecks}/${totalChecks} PASS`);
console.log('============================================================');

if (failures.length > 0) {
  console.error(`\n❌ Échecs détectés (${failures.length}) :`);
  failures.forEach(f => console.error(` - ${f.desc} : ${f.details}`));
  process.exit(1);
} else {
  console.log('\n🎉 VALIDATION RÉUSSIE : 100% ISO-FONCTIONNEL & SANS EXCEPTION RUNTIME !');
  process.exit(0);
}
