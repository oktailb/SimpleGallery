# 📖 Documentation Technique — SimpleGallery WebOS

Ce document décrit l'architecture complète, les conventions de développement et les API disponibles pour créer et intégrer des applications dans **SimpleGallery WebOS**.

---

## 📑 Sommaire

1. [Architecture Globale](#1-architecture-globale)
2. [Couche Kernel (PHP)](#2-couche-kernel-php)
3. [Couche Userland (JavaScript)](#3-couche-userland-javascript)
4. [Séparation `config/` vs `storage/`](#4-séparation-config-vs-storage)
5. [Format d'une Application Modulaire](#5-format-dune-application-modulaire)
6. [Classe de Base `WebOSApp`](#6-classe-de-base-webosapp)
7. [API Services Globaux](#7-api-services-globaux)
8. [Toolkit UI (`window.sys.ui`)](#8-toolkit-ui-windowsysui)
9. [Internationalisation (i18n)](#9-internationalisation-i18n)
10. [Créer une Application en 5 Minutes](#10-créer-une-application-en-5-minutes)
11. [Règles d'Architecture & Antipatterns Interdits](#11-règles-darchitecture--antipatterns-interdits)

---

## 1. Architecture Globale

SimpleGallery WebOS est un **micro-WebOS** qui découple complètement le noyau serveur (PHP) et l'espace utilisateur côté navigateur (Vanilla JS / CSS3).

```text
┌──────────────────────────────────────────────────────────────────────┐
│                        APPLICATIONS WEBOS                            │
│  [Explorer]  [ImageViewer]  [VideoPlayer]  [Tribune]  [SystemMonitor]│
│  [AudioPlayer]  [MarkdownViewer]  [Maps]  [Games]  [TemplateApp] ... │
├──────────────────────────────────────────────────────────────────────┤
│                    USERLAND (Navigateur / JS)                        │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │
│  │ WindowManager  │  │ MenuBarManager  │  │    AppManager        │  │
│  └────────────────┘  └─────────────────┘  └──────────────────────┘  │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │
│  │  EventBus IPC  │  │   I18nEngine    │  │  MediaViewerRegistry │  │
│  └────────────────┘  └─────────────────┘  └──────────────────────┘  │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │
│  │  SyscallClient │  │  WebOSApp Base  │  │    WebOSToolkit UI   │  │
│  └────────────────┘  └─────────────────┘  └──────────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│                     KERNEL (Serveur PHP)                             │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │
│  │ KernelGateway  │  │ PluginDiscovery │  │    Auth / Security   │  │
│  └────────────────┘  └─────────────────┘  └──────────────────────┘  │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │
│  │  FileSystem/VFS│  │  ThumbEngine    │  │  I18n / Metadata     │  │
│  └────────────────┘  └─────────────────┘  └──────────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│                  DONNÉES PERSISTANTES                                 │
│  config/  ← Configuration système (gérée par le kernel)             │
│  storage/ ← Données applicatives (gérées par les apps)              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Couche Kernel (PHP)

Tout le code serveur réside dans `system/kernel/`.

### 2.1 Points d'Entrée HTTP

| Fichier | Rôle |
|---|---|
| `system/endpoints/api.php` | API système principale (explorer, metadata, auth, cache…) |
| `apps/<id>/api.php` | API privée de chaque application (isolée par namespace) |
| `system/endpoints/thumb.php` | Génération de vignettes (GD / FFmpeg) |
| `index.php` | Shell HTML du desktop WebOS |

### 2.2 Composants Kernel

| Classe / Fichier | Description |
|---|---|
| `system/kernel/PluginDiscovery.php` | Scanne `apps/`, charge les `manifest.json`, agrège CSS/JS/locales |
| `KernelGateway` | Valide CSRF, authentification et dispatche les actions |
| `system/kernel/Auth/` | `AuthManager` : sessions, login/logout, vérification admin |
| `system/kernel/FS/VFS.php` | Système de fichiers virtuel sécurisé (protection path-traversal) |
| `system/kernel/Config/` | `ConfigRepository` : lecture de `config/config.php`, `desktop.json` |
| `system/kernel/I18n/` | Chargement et fusion des dictionnaires de traduction |
| `system/kernel/Metadata/` | `ExifParser`, `VideoMetadata`, `AudioMetadata` |
| `system/kernel/Media/` | `ThumbEngine` (GD + FFmpeg), `ImageProcessor` |
| `system/kernel/Security/` | Validation entrées, protection XSS/CSRF |
| `system/kernel/Search/` | Moteur de recherche plein-texte sur les fichiers |
| `system/kernel/functions.php` | Helpers globaux PHP (`__t()`, `json_response()`, etc.) |

### 2.3 Backend d'une Application (API Privée)

Chaque application peut exposer son propre `api.php` dans son dossier :

```php
<?php
// apps/mon-outil/api.php
require_once __DIR__ . '/../../system/kernel/functions.php';

// Vérifier l'authentification si nécessaire
AuthManager::requireLogin();

// Utiliser StorageRepository pour les données applicatives
$storage = StorageRepository::forApp('mon-outil');

$action = $_POST['action'] ?? $_GET['action'] ?? '';

switch ($action) {
    case 'get_data':
        $data = $storage->get('my_data', []);
        json_response(['success' => true, 'data' => $data]);
        break;

    case 'save_data':
        $payload = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $storage->set('my_data', $payload['data'] ?? []);
        json_response(['success' => true]);
        break;

    default:
        json_response(['success' => false, 'error' => 'Unknown action'], 400);
}
```

### 2.4 `StorageRepository` — Stockage Applicatif

**Règle essentielle** : toute donnée appartenant à une application va dans `storage/apps/<id>/`.

```php
// Obtenir un dépôt de stockage isolé pour une application
$storage = StorageRepository::forApp('mon-outil');

// Lire un fichier JSON (retourne $default si inexistant)
$notes = $storage->get('notes', []);

// Écrire de façon atomique (temp-file + rename)
$storage->set('notes', $notes);

// Supprimer une clé
$storage->delete('notes');

// Chemin réel : storage/apps/mon-outil/notes.json
```

### 2.5 `ConfigRepository` — Configuration Système

**Règle essentielle** : tout ce qui est géré par le système (thème par défaut, limites système, clés de sécurité) va dans `config/`.

```php
// Lire depuis config/config.php (tableau PHP)
$maxUploadMB = ConfigRepository::get('max_upload_mb', 50);

// Lire depuis config/desktop.json
$desktopCfg = ConfigRepository::getDesktop();
$defaultTheme = $desktopCfg['theme'] ?? 'dark-default';
```

---

## 3. Couche Userland (JavaScript)

Tout le code navigateur réside dans `system/userland/`.

### 3.1 Core (`system/userland/core/`)

| Fichier | Classe(s) / Global | Rôle |
|---|---|---|
| `SyscallClient.js` | `SyscallClient`, `window.sys.api`, `window.sys.syscall` | Client RPC unifié vers les API PHP |
| `AppManager.js` | `window.sys.appManager` | Registre et lanceur d'applications |
| `WindowManager.js` | `window.WindowManager` | Moteur de fenêtres flottantes |
| `MenuBarManager.js` | `window.MenuBarManager` | Barre de menus contextuelle (style macOS) |
| `EventBus.js` | `window.EventBus`, `window.sys.events` | Bus IPC événementiel inter-applications |
| `WebOSApp.js` | `window.sys.App` | Classe de base pour toutes les applications |
| `MediaViewerRegistry.js` | `window.sys.mediaViewer` | Association MIME → application lectrice |
| `IconHelper.js` | `window.IconHelper` | Résolution d'icônes par extension/MIME |
| `GalleryViewRegistry.js` | `window.GalleryViewRegistry` | Vues personnalisées de la galerie |

### 3.2 UI (`system/userland/ui/`)

| Fichier | Global | Rôle |
|---|---|---|
| `WebOSToolkit.js` | `window.sys.ui`, `window.sys.storage`, `window.sys.dialog`, `window.sys.audio`, `window.sys.filePicker` | Toolkit UI déclaratif, stockage namespacé, dialogues, audio, sélecteur de fichiers |
| `MetadataInspector.js` | `window.sys.showMetadata` | Panneau d'inspection EXIF / vidéo / audio |

---

## 4. Séparation `config/` vs `storage/`

Cette règle est **fondamentale** dans l'architecture de SimpleGallery :

| Dossier | Quoi y mettre | Qui le gère | Exemples |
|---|---|---|---|
| `config/` | Configuration **système** : paramètres globaux, sécurité, MIME types, thèmes disponibles | Kernel PHP, admin | `config.php`, `desktop.json`, `security.php`, `themes.php` |
| `storage/` | Données **applicatives** : contenu créé par les apps ou l'utilisateur | Applications elles-mêmes | `storage/apps/tribune/messages.json`, `storage/autostart.json` |

**Principe mnémotechnique** :
- `config/` → ce que **le système décide** (réglages d'installation, limites, clés)
- `storage/` → ce que **l'utilisateur ou l'application crée** (notes, préférences d'app, messages, uploads)

> **Cas particulier** : `settings` et `system-monitor` sont des applications système. Leurs préférences utilisateur (ex: onglet sélectionné) vont dans `storage/apps/settings/` et `storage/apps/system-monitor/` car ce sont des données changeantes. Leurs valeurs par défaut restent dans `config/`.

### 4.1 Structure de `config/`

```text
config/
├── config.php          # Paramètres système principaux (PHP array)
├── desktop.json        # Configuration du bureau (thème, langue, dock)
├── security.php        # Clés CSRF, politiques de sécurité
├── mime_types.php      # Association extensions → MIME types
└── themes.php          # Liste des thèmes disponibles
```

### 4.2 Structure de `storage/`

```text
storage/
├── autostart.json          # Apps à lancer au démarrage
├── apps/                   # Données propres à chaque application
│   ├── tribune/            # Données de la tribune (messages, boards)
│   ├── settings/           # Préférences enregistrées par l'app Settings
│   ├── system-monitor/     # État sauvegardé du System Monitor
│   └── mon-outil/          # Données de votre application (créé automatiquement)
├── media/                  # Uploads temporaires / cache media
└── session/                # Sessions PHP actives
```

---

## 5. Format d'une Application Modulaire

Toutes les applications résident dans `apps/<id>/` (ou sous-dossier `apps/games/<id>/`).

### 5.1 Structure des Fichiers

```text
apps/mon-outil/
├── manifest.json           # OBLIGATOIRE — métadonnées, permissions, MIME
├── app.js                  # OBLIGATOIRE — code JS principal (classe héritant WebOSApp)
├── style.css               # (Recommandé) — styles CSS isolés
├── api.php                 # (Optionnel) — backend PHP privé de l'application
├── template.php            # (Optionnel) — fragments HTML pré-rendus serveur
└── locales/                # (Recommandé) — fichiers de traduction i18n
    ├── fr.json
    ├── en.json
    └── ja.json
```

### 5.2 Schéma du `manifest.json`

```json
{
  "id": "mon-outil",
  "name": "Mon Outil",
  "version": "1.0.0",
  "description": "Description de l'application",
  "icon": "⚡",
  "category": "utilities",
  "main": "app.js",
  "css": "style.css",
  "template": "template.php",
  "mime_types": ["text/plain"],
  "extensions": ["txt"],
  "window": {
    "width": 800,
    "height": 600,
    "minWidth": 400,
    "minHeight": 300,
    "resizable": true
  },
  "locales": {
    "fr": { "title": "Mon Outil", "description": "Un outil utile" },
    "en": { "title": "My Tool", "description": "A useful tool" },
    "ja": { "title": "ツール", "description": "便利なツール" }
  }
}
```

**Champs clés** :
- `id` : identifiant unique kebab-case, utilisé pour les routes, l'EventBus et `StorageRepository::forApp(id)`
- `mime_types` + `extensions` : si renseignés, l'application s'enregistre comme lecteur par défaut dans `MediaViewerRegistry`
- `locales` dans le manifest : traductions inline du nom de l'app (pour le lanceur)

---

## 6. Classe de Base `WebOSApp`

`WebOSApp` (`window.sys.App`) est la classe de base de **toutes** les applications modernes. Elle supprime ~65% de boilerplate.

### 6.1 Anatomie Complète

```javascript
(function(window) {
  'use strict';

  class MonApp extends (window.sys && window.sys.App || window.WebOSApp) {
    constructor() {
      super({
        id: 'mon-outil',                    // Identifiant unique (obligatoire)
        title: 'apps.mon_outil.title',      // Clé i18n ou chaîne littérale
        icon: '⚡',
        width: 820,
        height: 560,
        resizable: true,
        tabs: [                             // Onglets (facultatif)
          { id: 'main',    label: 'mon_outil.tab_main',    icon: '🏠' },
          { id: 'settings', label: 'mon_outil.tab_settings', icon: '⚙️' }
        ],
        state: {                            // État initial de l'application
          items: [],
          filter: 'all'
        }
      });

      // API privée de l'application → apps/mon-outil/api.php
      const syscall = (window.sys && window.sys.syscall) || (window.sys && window.sys.api);
      this.appApi = syscall ? syscall.forApp('mon-outil') : null;
    }

    // ── Hooks de cycle de vie ──────────────────────────────────────────

    /** Appelé UNE seule fois à l'initialisation (avant la 1ère ouverture de fenêtre) */
    onInit() {
      // Souscription automatiquement nettoyée à la fermeture de la fenêtre
      this.subscribe('folder:changed', (data) => {
        this.toast.info(this.t('mon_outil.folder_changed'));
      });
    }

    /** Appelé à chaque fois qu'une fenêtre est ouverte (peut être multi-instance) */
    onOpen() {
      this.registerMenus();
      this.loadData();
      this.toast.success(this.t('mon_outil.ready'));
    }

    /** Appelé juste avant la fermeture de la fenêtre */
    onClose() {
      // Nettoyage manuel si nécessaire (WebOSApp gère les subscriptions auto)
    }

    /** Appelé lors d'un changement de thème */
    onThemeChanged(themeName) {
      // Ajuster les styles dynamiques si nécessaire
    }

    // ── Rendu des onglets ──────────────────────────────────────────────

    /**
     * Retourne le HTML d'un onglet donné.
     * Appelé automatiquement par WebOSApp lors du switch d'onglet.
     */
    renderTab(tabId) {
      if (tabId === 'main') return this.renderMainTab();
      if (tabId === 'settings') return this.renderSettingsTab();
      return '';
    }

    renderMainTab() {
      return `
        <div class="mon-outil-container">
          ${window.sys.ui.card({
            title: this.t('mon_outil.items_card'),
            icon: '📋',
            content: `<div id="monOutilItems">${this.renderItems()}</div>`
          })}
        </div>
      `;
    }

    renderSettingsTab() {
      return window.sys.ui.card({
        title: this.t('mon_outil.settings_card'),
        icon: '⚙️',
        content: window.sys.ui.forms.switch({
          label: 'mon_outil.enable_notifications',
          checked: this.storage.get('notifications', true),
          onChange: (val) => this.storage.set('notifications', val)
        })
      });
    }

    renderItems() {
      if (!this.state.items.length) {
        return `<p style="color:var(--text-muted)">${this.t('mon_outil.no_items')}</p>`;
      }
      return this.state.items.map(item =>
        `<div class="mon-outil-item">${this.escapeHtml(item.name)}</div>`
      ).join('');
    }

    // ── Événements DOM ─────────────────────────────────────────────────

    /**
     * Appelé automatiquement après chaque rendu du DOM.
     * Toujours appeler super.bindEvents(container) en premier.
     */
    bindEvents(container) {
      super.bindEvents(container);

      window.sys.ui.bindActions(container, {
        'click #monOutilAddBtn': () => this.addItem(),
        'click .mon-outil-delete': (btn) => this.deleteItem(btn.dataset.id)
      });
    }

    // ── Logique Métier ─────────────────────────────────────────────────

    async loadData() {
      try {
        const res = await this.appApi.get('get_items');
        if (res.success) {
          this.state.items = res.items || [];
          // Mettre à jour uniquement le composant concerné
          const el = document.getElementById('monOutilItems');
          if (el) el.innerHTML = this.renderItems();
        }
      } catch (e) {
        this.toast.error(this.t('mon_outil.load_error'));
      }
    }

    registerMenus() {
      if (!window.MenuBarManager) return;
      window.MenuBarManager.registerAppMenus('mon-outil', [
        {
          id: 'file',
          label: 'Fichier',
          items: [
            { id: 'add-item', label: '➕ Ajouter', action: () => this.addItem() },
            { separator: true },
            { id: 'close', label: 'Fermer', action: () => this.close() }
          ]
        }
      ]);
    }
  }

  // Enregistrement auprès de l'AppManager
  if (window.sys && window.sys.appManager) {
    window.sys.appManager.register(new MonApp());
  }

})(window);
```

### 6.2 Propriétés & Méthodes Héritées

| Propriété / Méthode | Type | Description |
|---|---|---|
| `this.id` | `string` | Identifiant de l'application |
| `this.state` | `Object` | État réactif de l'application |
| `this.storage` | `StorageHelper` | Stockage localStorage namespacé `webos_app_<id>_<key>` |
| `this.api` | `SyscallClient` | Accès à l'API **système** (`system/endpoints/api.php`) |
| `this.toast` | `ToastHelper` | Notifications : `.success(msg)`, `.info(msg)`, `.error(msg)`, `.warning(msg)` |
| `this.dialog` | `DialogHelper` | Dialogues : `.confirm({title, message, onConfirm})`, `.alert({title, message})` |
| `this.isAdmin` | `boolean` | `true` si l'utilisateur a les droits admin |
| `this.t(key, vars)` | `string` | Traduction i18n avec interpolation (`{var}`) |
| `this.escapeHtml(str)` | `string` | Échappement anti-XSS |
| `this.subscribe(event, cb)` | `Function` | Souscription EventBus avec nettoyage automatique |
| `this.switchTab(tabId)` | `void` | Changer d'onglet programmatiquement |
| `this.close()` | `void` | Fermer la fenêtre de l'application |
| `this.window` | `HTMLElement` | Élément DOM de la fenêtre active |

---

## 7. API Services Globaux

### 7.1 `SyscallClient` (`window.sys.api`, `window.sys.syscall`)

Client RPC unifié pour communiquer avec le serveur PHP. **Ne jamais utiliser `fetch()` directement.**

```javascript
// API Système (system/endpoints/api.php)
const sysRes = await window.sys.api.get('get_system_info');
const loginRes = await window.sys.api.post('login', { password: '...' });

// API Privée d'une Application (apps/<id>/api.php)
const appApi = window.sys.api.forApp('mon-outil');
const data = await appApi.get('get_items');
const saved = await appApi.post('save_item', { name: 'Test' });

// Upload de fichier avec progression
const uploadRes = await window.sys.api.upload('upload_media', formData, (percent) => {
  console.log(`Upload: ${percent}%`);
});

// Générer une URL d'API (pour <img src="...">)
const thumbUrl = window.sys.api.url('get_thumbnail', { file: 'vacation/photo.jpg' });

// Accès aux helpers haut niveau
await window.sys.api.fs.list('vacation/');
await window.sys.api.fs.createFolder('vacation', 'été-2024');
await window.sys.api.auth.login('motdepasse');
```

### 7.2 `WindowManager` (`window.WindowManager`)

```javascript
// Créer une fenêtre flottante
const win = window.WindowManager.createWindow({
  id: 'mon-win-123',
  appId: 'mon-outil',
  title: 'Titre',
  icon: '⚡',
  width: 800,
  height: 600,
  content: '<div>Contenu HTML</div>',
  onFocus: () => { /* fenêtre au premier plan */ },
  onClose: () => { /* nettoyage */ }
});

window.WindowManager.setTitle('mon-win-123', 'Nouveau Titre');
window.WindowManager.minimizeWindow('mon-win-123');
window.WindowManager.maximizeWindow('mon-win-123');
window.WindowManager.closeWindow('mon-win-123');
```

### 7.3 `MenuBarManager` (`window.MenuBarManager`)

```javascript
// Enregistrer des menus pour l'application active
window.MenuBarManager.registerAppMenus('mon-outil', [
  {
    id: 'fichier',
    label: 'Fichier',
    items: [
      { id: 'new',  label: '📄 Nouveau', action: () => monApp.createNew() },
      { separator: true },
      { id: 'quit', label: 'Quitter',    action: () => monApp.close() }
    ]
  },
  {
    id: 'affichage',
    label: 'Affichage',
    items: [
      { id: 'refresh', label: '🔄 Actualiser', action: () => monApp.refresh() }
    ]
  }
]);

// Restaurer les menus système par défaut (quand l'app perd le focus)
window.MenuBarManager.restoreDefaultMenu();
```

### 7.4 `AppManager` (`window.sys.appManager`)

```javascript
// Lancer une application installée
window.sys.appManager.launchApp('image-viewer', { file: 'photos/sunset.jpg' });

// Enregistrer une application (fait dans app.js)
window.sys.appManager.register(new MonApp());

// Obtenir le titre traduit d'une app
const title = window.sys.appManager.getAppTitle('mon-outil');
```

### 7.5 `EventBus IPC` (`window.sys.events` / `window.EventBus`)

```javascript
// Écouter un événement (retourne une fonction de désabonnement)
const unsub = window.sys.events.on('folder:changed', (data) => {
  console.log('Dossier actif :', data.folder);
});
unsub(); // Se désabonner

// Écouter une seule fois
window.sys.events.once('app:ready', () => console.log('Prêt !'));

// Émettre un événement personnalisé
window.sys.events.emit('mon-outil:item-added', { name: 'test', id: 42 });
```

#### Événements Système Réservés

| Événement | Payload | Description |
|---|---|---|
| `locale:changed` | `{ code, translations }` | Changement de langue |
| `theme:changed` | `{ theme }` | Changement de thème |
| `window:focus` | `{ windowId, appId }` | Fenêtre portée au premier plan |
| `window:close` | `{ windowId, appId }` | Fenêtre fermée |
| `app:launch` | `{ appId, params }` | Application lancée |
| `folder:changed` | `{ folder }` | Navigation dans un dossier (explorateur) |
| `filepicker:select` | `{ file, path }` | Fichier sélectionné via FilePickerService |

### 7.6 `FilePickerService` (`window.sys.filePicker`)

Permet à une application d'ouvrir le sélecteur de fichiers de la galerie.

```javascript
window.sys.filePicker.openModal({
  title: 'Choisir une image',
  allowMultiple: false,
  filter: 'image',           // 'image' | 'video' | 'audio' | null (tous)
  onSelect: (selected) => {
    const file = Array.isArray(selected) ? selected[0] : selected;
    console.log('Fichier :', file.path, file.name, file.size_formatted);
    // Ouvrir dans le visualiseur
    window.sys.mediaViewer.openFile(file);
    // Afficher les métadonnées
    window.sys.showMetadata(file);
  }
});
```

### 7.7 `ClipboardService` (`window.sys.clipboard`)

Presse-papiers universel WebOS avec interopérabilité presse-papiers système du navigateur :

```javascript
// Copier des fichiers
window.sys.clipboard.copyFiles([
  { path: 'photos/vacances.jpg', name: 'vacances.jpg' }
]);

// Couper des fichiers (déplacement)
window.sys.clipboard.cutFiles(['photos/note.txt']);

// Coller les données dans le presse-papiers
const clip = window.sys.clipboard.paste();
// -> { type: 'files', data: [...], op: 'copy' | 'cut' }

// Copier du texte libre
window.sys.clipboard.copy('Hello WebOS', 'text');
```

### 7.8 `ShortcutManager` (`window.sys.shortcuts`)

Gestionnaire centralisé des raccourcis clavier pour le bureau, les fenêtres et l'explorateur :

```javascript
// Enregistrer un raccourci personnalisé
window.sys.shortcuts.register('ctrl+shift+k', () => {
  console.log('Raccourci exécuté !');
}, { description: 'Mon Raccourci' });

// Raccourcis Système par défaut :
// - Alt+W : Fermer la fenêtre active
// - Alt+M : Agrandir / Restaurer la fenêtre active
// - Alt+H / Ctrl+Alt+D : Afficher le bureau (minimiser tout)
// - Ctrl+Alt+T : Ouvrir le Moniteur Système
// - Ctrl+Alt+E : Ouvrir l'Explorateur de Fichiers
// - Ctrl+Alt+S : Ouvrir les Paramètres
// - Ctrl+Alt+B : Ouvrir la Tribune Libre
// - Ctrl+C / Ctrl+X / Ctrl+V : Copier / Couper / Coller dans l'explorateur
// - Espace : Aperçu rapide du fichier sélectionné
// - Suppr / Retour arrière : Supprimer l'élément sélectionné
```

### 7.9 `MediaViewerRegistry` (`window.sys.mediaViewer`)

```javascript
// Ouvrir un fichier dans son application lectrice associée
window.sys.mediaViewer.openFile({ path: 'movies/film.mp4', name: 'film.mp4' });

// Enregistrer une application comme lecteur pour des types MIME
window.sys.mediaViewer.register(['text/plain', 'text/markdown'], 'markdown-viewer');
```

### 7.10 `I18nEngine` (`window.I18nEngine`)

```javascript
// Traduire une clé (avec interpolation optionnelle)
const msg = window.I18nEngine.t('mon_outil.items_count', { count: 42 });
// → "42 éléments" (si fr.json contient "mon_outil.items_count": "{count} éléments")

// Changer la langue (émet 'locale:changed' sur l'EventBus)
window.I18nEngine.setLanguage('en');
```

---

## 8. Toolkit UI (`window.sys.ui`)

`WebOSToolkit` (`window.sys.ui`) fournit des composants HTML réutilisables avec thème automatique.

### 8.1 `sys.ui.card(options)` — Carte Glassmorphism

```javascript
const html = window.sys.ui.card({
  title: 'mon_outil.card_title',  // Clé i18n résolue automatiquement
  icon: '📋',
  headerAction: '<button class="webos-btn">Action</button>',
  content: '<p>Contenu HTML...</p>'
});
```

### 8.2 `sys.ui.infoGrid(items)` — Grille Métriques

```javascript
const html = window.sys.ui.infoGrid([
  { label: 'sysmon.server_os',      value: 'Linux 6.x' },
  { label: 'sysmon.php_version',    value: '8.4.20' },
  { label: 'sysmon.disk_free',      value: '120 GB', highlight: true }
]);
```

### 8.3 `sys.ui.gauge(options)` — Jauge de Télémétrie

```javascript
const html = window.sys.ui.gauge({
  icon: '💾',
  label: 'sysmon.disk_used_label',
  value: '45.2%',
  percent: 45.2,
  detail: '120 GB / <strong>256 GB</strong>'
});
```

### 8.4 `sys.ui.forms.switch(options)` — Interrupteur

```javascript
const html = window.sys.ui.forms.switch({
  id: 'mySwitch',
  label: 'mon_outil.enable_feature',
  checked: true,
  onChange: (enabled) => console.log('État :', enabled)
});
```

### 8.5 `sys.ui.forms.slider(options)` — Curseur

```javascript
const html = window.sys.ui.forms.slider({
  id: 'mySlider',
  label: 'mon_outil.volume_level',
  min: 0, max: 100, value: 80,
  unit: '%',
  onChange: (val) => console.log('Valeur :', val)
});
```

### 8.6 `sys.ui.bindActions(container, map)` — Délégation d'Événements

```javascript
window.sys.ui.bindActions(container, {
  'click #myButton':   (btn)      => this.doAction(),
  'change #mySelect':  (select)   => this.onFilter(select.value),
  'click .delete-btn': (btn, e)   => this.deleteItem(btn.dataset.id)
});
```

### 8.7 Composants CSS Natifs

Des classes CSS sont disponibles globalement (thème automatique) :

```html
<!-- Boutons -->
<button class="webos-btn">Défaut</button>
<button class="webos-btn webos-btn-primary">Primaire</button>
<button class="webos-btn webos-btn-danger">Danger</button>

<!-- Champ de recherche / input texte -->
<input type="text" class="webos-search-input" placeholder="...">

<!-- Scrollbar personnalisée -->
<div class="webos-scrollable">...</div>
```

---

## 9. Internationalisation (i18n)

### 9.1 Emplacement des Traductions

Chaque application contient ses propres traductions dans `locales/` :

```text
apps/mon-outil/locales/
├── fr.json     # Français
├── en.json     # Anglais
└── ja.json     # Japonais
```

### 9.2 Format des Fichiers

```json
{
  "translations": {
    "mon_outil.tab_main": "Principal",
    "mon_outil.tab_settings": "Paramètres",
    "mon_outil.items_count": "{count} éléments",
    "mon_outil.no_items": "Aucun élément.",
    "mon_outil.folder_changed": "Dossier changé : {folder}"
  }
}
```

**Règles de nommage** :
- Préfixer par le namespace de l'application : `mon_outil.`
- Utiliser `{variable}` pour l'interpolation
- Toujours fournir `fr.json`, `en.json`, `ja.json`

### 9.3 Utilisation en JavaScript

```javascript
// Simple
this.t('mon_outil.no_items');

// Avec interpolation
this.t('mon_outil.items_count', { count: 42 });

// INTERDIT : pas de fallback hardcodé
// ❌ this.t('mon_outil.no_items') || 'Aucun élément'
// ✅ this.t('mon_outil.no_items')   ← le moteur retourne la clé si traduction manquante
```

### 9.4 Utilisation en PHP (templates)

```php
<!-- template.php -->
<h1><?= htmlspecialchars(__t('mon_outil.title'), ENT_QUOTES, 'UTF-8') ?></h1>
<p data-i18n="mon_outil.description"></p>

<!-- Attributs réactifs (mis à jour sans rechargement de page) -->
<input data-i18n-placeholder="mon_outil.search_placeholder" type="text">
<button data-i18n-title="mon_outil.close_tooltip" class="webos-btn">✕</button>
```

### 9.5 Chargement & Propagation

1. `PluginDiscovery.php` agrège automatiquement tous les `locales/*.json` au démarrage
2. Le changement de langue émet `locale:changed` sur l'EventBus
3. `WebOSApp` écoute cet événement et appelle `onThemeChanged()` / ré-render automatiquement

---

## 10. Créer une Application en 5 Minutes

### Étape 1 — Créer le Dossier

```bash
mkdir apps/mon-outil
mkdir apps/mon-outil/locales
```

### Étape 2 — `manifest.json`

```json
{
  "id": "mon-outil",
  "name": "Mon Outil",
  "icon": "⚡",
  "main": "app.js",
  "css": "style.css",
  "locales": {
    "fr": { "title": "Mon Outil" },
    "en": { "title": "My Tool" },
    "ja": { "title": "ツール" }
  }
}
```

### Étape 3 — `locales/fr.json`

```json
{
  "translations": {
    "mon_outil.tab_main": "Principal",
    "mon_outil.hello": "Bonjour depuis SimpleGallery WebOS !"
  }
}
```

### Étape 4 — `app.js`

```javascript
(function(window) {
  'use strict';

  class MonOutil extends (window.sys && window.sys.App) {
    constructor() {
      super({
        id: 'mon-outil',
        title: 'apps.mon_outil.title',
        icon: '⚡',
        width: 600,
        height: 400,
        tabs: [
          { id: 'main', label: 'mon_outil.tab_main', icon: '🏠' }
        ]
      });
    }

    onOpen() {
      this.toast.info(this.t('mon_outil.hello'));
    }

    renderTab(tabId) {
      if (tabId === 'main') {
        return window.sys.ui.card({
          title: 'mon_outil.tab_main',
          icon: '⚡',
          content: `<p>${this.t('mon_outil.hello')}</p>
                    <button type="button" class="webos-btn webos-btn-primary" id="monOutilBtn">Cliquez !</button>`
        });
      }
      return '';
    }

    bindEvents(container) {
      super.bindEvents(container);
      window.sys.ui.bindActions(container, {
        'click #monOutilBtn': () => this.toast.success('Ça marche ! 🎉')
      });
    }
  }

  if (window.sys && window.sys.appManager) {
    window.sys.appManager.register(new MonOutil());
  }

})(window);
```

### Étape 5 — `style.css` (optionnel)

```css
/* Vos styles isolés — utilisez var(--bg-card), var(--text-main), etc. */
```

### Étape 6 — Tester

Rechargez le navigateur : votre application est **automatiquement découverte** par `PluginDiscovery`, listée dans le menu des applications et prête à être utilisée !

Pour un backend privé, ajoutez `api.php` (voir [section 2.3](#23-backend-dune-application-api-privée)) et accédez-y via :

```javascript
const syscall = (window.sys && window.sys.syscall) || (window.sys && window.sys.api);
this.appApi = syscall ? syscall.forApp('mon-outil') : null;
const res = await this.appApi.get('get_items');
```

---

## 11. Règles d'Architecture & Antipatterns Interdits

Ces règles garantissent la cohérence et la maintenabilité du projet.

### ✅ Règle 1 — Utiliser `sys.api` pour tous les appels HTTP

```javascript
// ❌ INTERDIT
fetch('system/endpoints/api.php?action=get_system_info')
new XMLHttpRequest()

// ✅ REQUIS
const res = await this.api.get('get_system_info');
const res = await this.appApi.post('save_item', { name: 'test' });
```

### ✅ Règle 2 — Pas de fallback hardcodé dans `this.t()`

```javascript
// ❌ INTERDIT (cache les traductions manquantes)
this.t('mon_outil.title') || 'Mon Outil'
this.t('mon_outil.title', {}, 'Mon Outil')

// ✅ REQUIS (la clé est retournée si manquante → visible immédiatement)
this.t('mon_outil.title')
```

### ✅ Règle 3 — `storage.set()` plutôt que `localStorage` brut

```javascript
// ❌ INTERDIT (risque de collisions entre apps)
localStorage.setItem('theme', 'dark')

// ✅ REQUIS (namespacé automatiquement sous webos_app_mon-outil_theme)
this.storage.set('theme', 'dark')
```

### ✅ Règle 4 — `this.subscribe()` plutôt que `EventBus.on()` nu

```javascript
// ❌ INTERDIT (fuite mémoire si la fenêtre se ferme sans se désabonner)
window.sys.events.on('folder:changed', this.onFolderChange.bind(this));

// ✅ REQUIS (désinscription automatique à la fermeture de la fenêtre)
this.subscribe('folder:changed', (data) => this.onFolderChange(data));
```

### ✅ Règle 5 — `config/` vs `storage/` (côté PHP)

```php
// ❌ INTERDIT — données d'app dans config/
file_put_contents(__DIR__ . '/../../config/notes.json', json_encode($notes));

// ✅ REQUIS — données dans storage/apps/<id>/
$storage = StorageRepository::forApp('mon-outil');
$storage->set('notes', $notes);
```

### ✅ Règle 6 — Héritage de `WebOSApp` pour les nouvelles apps

```javascript
// ❌ DÉCONSEILLÉ — implementation manuelle de tout le cycle de vie
class MonApp {
  constructor() { /* tout from scratch */ }
  // 200 lignes de boilerplate...
}

// ✅ REQUIS — hériter de WebOSApp
class MonApp extends (window.sys && window.sys.App) {
  constructor() {
    super({ id: 'mon-app', title: '...', icon: '⚡' });
  }
  // Seulement le code métier !
}
```

---

*Documentation mise à jour le 2026-08-30 — Reflète l'architecture post-refactoring avec séparation `config/` vs `storage/`, classe `WebOSApp`, `SyscallClient` unifié, et système de plugins auto-découverts.*
