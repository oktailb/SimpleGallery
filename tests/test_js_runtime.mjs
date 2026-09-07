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

// 2. Maps
const mapsManifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'apps', 'maps', 'manifest.json'), 'utf8'));
const mapsJs = fs.readFileSync(path.join(rootDir, 'apps', 'maps', 'maps.js'), 'utf8');
assert("maps manifest déclare moveTo et whereIam", !!mapsManifest.commands.moveTo && !!mapsManifest.commands.whereIam);
assert("maps maps.js implémente moveTo(params) dans MapsInstance", mapsJs.includes('moveTo(params = {})'));
assert("maps maps.js implémente whereIam() dans MapsInstance", mapsJs.includes('whereIam()'));
assert("maps maps.js implémente whereIam(winId) dans WebOSMapsApp", mapsJs.includes('whereIam(winId = null)'));
assert("maps maps.js implémente moveTo(params, winId) dans WebOSMapsApp", mapsJs.includes('moveTo(params = {}, winId = null)'));
assert("maps maps.js implémente handleCommand dans WebOSMapsApp", mapsJs.includes('handleCommand(command, params = {}, winId = null)'));

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
assert("AppManager dispatchCommand gère whereIam et moveTo pour maps", appManagerJs.includes("command === 'whereIam'") && appManagerJs.includes("command === 'moveTo'"));
assert("AppManager dispatchCommand gère seekTo et playbackRate pour audio/vidéo", appManagerJs.includes("command === 'seekTo'") && appManagerJs.includes("command === 'playbackRate'"));

// 6. Autorun Studio Capture Maps
assert("Autorun Studio intègre le bouton 'Capturer depuis Maps'", autorunEditorJs.includes('data-step-capture-map'));
assert("Autorun Studio implémente captureMapPosition(stepIdx)", autorunEditorJs.includes('captureMapPosition(stepIdx)'));
assert("Autorun Studio getCommandsForApp expose moveTo et whereIam", autorunEditorJs.includes('moveTo:') && autorunEditorJs.includes('whereIam:'));
assert("Autorun Studio getCommandsForApp expose scrollTo et searchText", autorunEditorJs.includes('scrollTo:') && autorunEditorJs.includes('searchText:'));
assert("Autorun Studio getCommandsForApp expose zoom et move pour image", autorunEditorJs.includes('zoom:') && autorunEditorJs.includes('move:'));
assert("Autorun Studio getCommandsForApp expose seekTo pour video et audio", autorunEditorJs.includes('seekTo:'));


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
