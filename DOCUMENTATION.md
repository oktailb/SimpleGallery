# 📖 Spécifications & Documentation Technique Interne - SimpleGallery WebOS

Ce document détaille l'architecture logicielle, les interfaces de programmation (API), le bus d'événements, le système de fenêtrage et le format standardisé pour concevoir et intégrer de nouvelles applications modulaires dans **SimpleGallery WebOS**.

---

## 📑 Sommaire
1. [Architecture Globale du Système](#1-architecture-globale-du-système)
2. [Couches Logicielles (Kernel vs Userland)](#2-couches-logicielles-kernel-vs-userland)
3. [Format & Structure d'une Application Modulaire](#3-format--structure-dune-application-modulaire)
4. [Schéma du `manifest.json`](#4-schéma-du-manifestjson)
5. [Cycle de Vie & Interface d'une Application JS](#5-cycle-de-vie--interface-dune-application-js)
6. [API Système & Services Globaux](#6-api-système--services-globaux)
   - [WindowManager (`window.WindowManager`)](#windowmanager-windowwindowmanager)
   - [MenuBarManager (`window.MenuBarManager`)](#menubarmanager-windowmenubarmanager)
   - [AppManager (`window.sys.appManager`)](#appmanager-windowsysappmanager)
   - [EventBus IPC (`window.sys.events`)](#eventbus-ipc-windowsysevents)
   - [Moteur Internationalisation I18nEngine (`window.I18nEngine`)](#moteur-internationalisation-i18nengine-windowi18nengine)
   - [MediaViewerRegistry (`window.sys.mediaViewer`)](#mediaviewerregistry-windowsysmediaviewer)
   - [SyscallClient (`window.sys.syscall`)](#syscallclient-windowsyssyscall)
7. [Internationalisation (i18n) & Changement Dynamique](#7-internationalisation-i18n--changement-dynamique)
8. [Tutoriel : Créer une Nouvelle Application en 5 Minutes](#8-tutoriel--créer-une-nouvelle-application-en-5-minutes)

---

## 1. Architecture Globale du Système

SimpleGallery repose sur une architecture de type **Micro-WebOS** découplant le noyau serveur (PHP) et l'espace utilisateur côté navigateur (Vanilla JS / CSS3) :

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          APPLICATIONS WEBOS                            │
│  [Explorer]  [Image Viewer]  [Video]  [Audio]  [Docs/MD]  [Maps] [Games]│
├────────────────────────────────────────────────────────────────────────┤
│                       COUCHE USERLAND (Navigateur)                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  WindowManager   │  │  MenuBarManager  │  │     AppManager       │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │   EventBus IPC   │  │    I18nEngine    │  │ MediaViewerRegistry  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  SyscallClient (Client RPC / API)                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│                        COUCHE KERNEL & SYSCALLS (PHP)                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                KernelGateway (Gateway & Contrôle d'Accès)        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ PluginDiscovery  │  │    FileSystem    │  │     ThumbEngine      │  │
│  │ (Auto-Scan Apps) │  │  (Dotfiles/EXIF) │  │   (GD / FFmpeg WebP) │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Couches Logicielles (Kernel vs Userland)

### 🖥️ 2.1 Espace Kernel (Serveur PHP)
- **`system/kernel/PluginDiscovery.php`** : Scanne récursivement le dossier `apps/`, découvre automatiquement les `manifest.json`, enregistre les points d'entrée JS/CSS/Templates et agrège les dictionnaires de traduction `locales/*.json`.
- **`system/kernel/KernelGateway.php` & `api.php`** : Valide les requêtes entrantes, vérifie les jetons CSRF, contrôle l'authentification et dispatche les appels de bas niveau.
- **`system/kernel/FileSystem.php` & `functions.php`** : Gestion sécurisée des fichiers avec protection stricte contre le *Path Traversal* (`../`), lecture/écriture des *dotfiles* (`.title`, `.desc`, `.comment`, `.bg`, `.theme`, `.private`, `.password`) et lecture des métadonnées EXIF/ID3.
- **`thumb.php`** : Pipeline de génération de vignettes asynchrone (PHP GD pour les photos, extraction FFmpeg pour les vidéos).

### 🌐 2.2 Espace Userland (Client JavaScript)
- **`system/userland/core/WindowManager.js`** : Moteur de fenêtres flottantes multi-instances (déplacement, redimensionnement, empilement z-index, réduction dans le dock, maximisation, plein écran).
- **`system/userland/core/MenuBarManager.js`** : Barre supérieure de menu contextuelle de style macOS adaptée dynamiquement à l'application active au premier plan.
- **`system/userland/core/AppManager.js`** : Registre centralisé des applications installées et gestionnaire de lancement par ID d'application (`appId`).
- **`system/userland/core/EventBus.js`** : Bus de messages IPC (*Inter-Process Communication*) asynchrone pour la communication inter-applications et système.
- **`system/userland/i18n/I18nEngine.js`** : Moteur de traduction multi-langues avec interpolation de paramètres et rafraîchissement réactif en direct.
- **`system/userland/core/MediaViewerRegistry.js`** : Mappeur d'associations de types MIME et extensions de fichiers vers leurs applications lectrices dédiées.

---

## 3. Format & Structure d'une Application Modulaire

Toutes les applications modulaires résident dans le répertoire `apps/<nom-app>/` ou un sous-dossier de catégorie (ex: `apps/games/<nom-jeu>/`).

### Structure Type de Fichiers :
```text
apps/mon-application/
├── manifest.json        # Métadonnées, permissions, icône, types MIME associés
├── app.js               # Code JavaScript principal & instance d'application
├── style.css            # Styles CSS isolés et animations
├── template.php         # (Optionnel) Modals HTML ou squelettes pré-injectés
└── locales/             # Fichiers de localisation i18n
    ├── fr.json          # Traductions françaises
    ├── en.json          # Traductions anglaises
    └── ja.json          # Traductions japonaises
```

---

## 4. Schéma du `manifest.json`

Le fichier `manifest.json` déclare l'identité, les dépendances et les capacités de l'application auprès du `PluginDiscovery` du Kernel :

```json
{
  "id": "mon-app",
  "name": "Mon Application",
  "version": "1.0.0",
  "description": "Description de mon application pour le lanceur WebOS",
  "icon": "🚀",
  "category": "utilities",
  "main": "app.js",
  "css": "style.css",
  "template": "template.php",
  "mime_types": [
    "application/x-custom",
    "text/plain"
  ],
  "extensions": [
    "custom",
    "txt"
  ],
  "window": {
    "width": 800,
    "height": 600,
    "minWidth": 400,
    "minHeight": 300,
    "resizable": true,
    "maximizable": true
  },
  "locales": {
    "fr": {
      "title": "Mon Application",
      "description": "Outil d'utilitaire WebOS moderne"
    },
    "en": {
      "title": "My Application",
      "description": "Modern WebOS utility tool"
    },
    "ja": {
      "title": "マイアプリケーション",
      "description": "モダンなWebOSユーティリティツール"
    }
  }
}
```

---

## 5. Cycle de Vie & Interface d'une Application JS

Une application s'enregistre auprès de `window.sys.appManager` et doit implémenter la méthode `.open(fileOrParams, options)` :

```javascript
(function(window) {
  'use strict';

  // 1. Instance individuelle d'une fenêtre de l'application
  class MonAppInstance {
    constructor(app, id, options = {}) {
      this.app = app;
      this.id = id;
      this.winId = `mon-app-${id}`;
      this.options = options;
      this.win = null;
      this.el = {};

      // Souscription réactive au changement de langue
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
        ? window.sys.appManager.getAppTitle('mon-app')
        : this.t('apps.mon_app.title');

      const bodyHtml = `
        <div class="mon-app-container" id="monApp-${this.id}">
          <div class="mon-app-header">
            <span id="monAppStatus-${this.id}">${this.t('apps.mon_app.ready')}</span>
            <button type="button" class="mon-app-btn" id="monAppActionBtn-${this.id}">
              ${this.t('apps.mon_app.action')}
            </button>
          </div>
          <div class="mon-app-body" id="monAppBody-${this.id}"></div>
        </div>
      `;

      this.win = window.WindowManager.createWindow({
        id: this.winId,
        appId: 'mon-app',
        appName: appTitle,
        title: appTitle,
        icon: '🚀',
        width: 720,
        height: 520,
        content: bodyHtml,
        onFocus: () => {
          this.updateMenuBar();
        },
        onLocaleChanged: () => {
          this.updateLocale();
        },
        onClose: () => {
          if (this.localeUnsub) this.localeUnsub();
          this.app.instances.delete(this.id);
        }
      });

      this.cacheDom();
      this.bindEvents();
    }

    cacheDom() {
      this.el.status = document.getElementById(`monAppStatus-${this.id}`);
      this.el.actionBtn = document.getElementById(`monAppActionBtn-${this.id}`);
    }

    bindEvents() {
      if (this.el.actionBtn) {
        this.el.actionBtn.onclick = () => this.doAction();
      }
    }

    updateMenuBar() {
      if (!window.MenuBarManager) return;
      window.MenuBarManager.registerAppMenu('mon-app', (container) => {
        container.innerHTML = `
          <button type="button" class="app-menu-pill" id="menuMonAppAction">
            ${this.t('apps.mon_app.action')}
          </button>
        `;
        const btn = document.getElementById('menuMonAppAction');
        if (btn) btn.onclick = () => this.doAction();
      });
    }

    updateLocale() {
      const appTitle = (window.sys && window.sys.appManager)
        ? window.sys.appManager.getAppTitle('mon-app')
        : this.t('apps.mon_app.title');

      if (window.WindowManager) {
        window.WindowManager.setTitle(this.winId, appTitle);
      }

      if (this.el.status) this.el.status.textContent = this.t('apps.mon_app.ready');
      if (this.el.actionBtn) this.el.actionBtn.textContent = this.t('apps.mon_app.action');

      this.updateMenuBar();
    }

    doAction() {
      if (window.sys && window.sys.desktop) {
        window.sys.desktop.showToast(this.t('apps.mon_app.success'), 'success');
      }
    }
  }

  // 2. Gestionnaire racine de l'application
  class WebOSMonApp {
    constructor() {
      this.instances = new Map();
      this.instanceCounter = 0;
    }

    t(key, replacements = {}) {
      if (window.I18nEngine) return window.I18nEngine.t(key, replacements);
      return key;
    }

    open(fileOrParams = {}, options = {}) {
      this.instanceCounter++;
      const id = this.instanceCounter;
      const instance = new MonAppInstance(this, id, Object.assign({}, fileOrParams, options));
      this.instances.set(id, instance);
      return instance;
    }
  }

  // 3. Enregistrement auprès du WebOS
  const monApp = new WebOSMonApp();
  window.MonApp = monApp;
  if (window.sys && window.sys.appManager) {
    window.sys.appManager.registerInstance('mon-app', monApp);
  }

})(window);
```

---

## 6. API Système & Services Globaux

### `WindowManager` (`window.WindowManager`)
Gestionnaire de fenêtres du bureau :
- `createWindow(config)` : Crée et affiche une nouvelle fenêtre.
- `setTitle(windowId, newTitle)` : Modifie dynamiquement le titre de la fenêtre et du dock.
- `focusWindow(windowId)` : Place la fenêtre au premier plan.
- `minimizeWindow(windowId)` : Réduit la fenêtre dans le dock.
- `maximizeWindow(windowId)` : Alterne entre mode plein écran et taille flottante.
- `closeWindow(windowId)` : Ferme proprement la fenêtre et déclenche `onClose()`.

### `MenuBarManager` (`window.MenuBarManager`)
Barre de menus contextuelle supérieure :
- `registerAppMenu(appId, (container) => void)` : Enregistre le générateur de boutons d'action spécifiques à l'application active.
- `restoreDefaultMenu()` : Restaure les menus par défaut du bureau.

### `AppManager` (`window.sys.appManager`)
Registre des applications installées :
- `launchApp(appId, params)` : Lance une application par son identifiant unique.
- `registerInstance(appId, instance)` : Enregistre le contrôleur racine de l'application.
- `getAppTitle(appId)` : Récupère le nom traduit de l'application dans la langue courante.
- `getAppDescription(appId)` : Récupère la description traduite.

### `EventBus IPC` (`window.sys.events` ou `window.EventBus`)
Bus de communication événementielle :
- `on(eventName, callback)` : Écoute un événement et retourne une fonction de désinscription `() => void`.
- `once(eventName, callback)` : Écoute un événement une seule fois.
- `emit(eventName, payload)` : Diffuse un événement à tous les écouteurs actifs.
- `off(eventName, callback)` : Retire un écouteur.

#### Événements Système Fréquents :
| Événement | Description | Payload |
|---|---|---|
| `locale:changed` | Déclenché lors du basculement de langue | `{ code: 'fr'\|'en'\|'ja', translations: Object }` |
| `window:focus` | Une fenêtre passe au premier plan | `{ windowId, appId }` |
| `window:close` | Une fenêtre est fermée | `{ windowId, appId }` |
| `app:launch` | Une application est lancée | `{ appId, params }` |
| `folder:changed` | L'explorateur a navigué dans un dossier | `{ folder: 'vacances' }` |

### `I18nEngine` (`window.I18nEngine`)
Moteur de traduction :
- `t(key, replacements)` : Traduit une clé avec remplacement d'arguments `{count}`, `{size}`, etc.
- `setTranslations(code, translationsMap)` : Met à jour le dictionnaire actif.

### `SyscallClient` (`window.sys.syscall`)
Passerelle d'appels API vers le serveur :
- `call(action, payload)` : Effectue un appel JSON sécurisé avec jeton CSRF automatique.

---

## 7. Internationalisation (i18n) & Changement Dynamique

### 🌐 7.1 Emplacement des Fichiers de Traduction
Chaque application contient son propre dossier `locales/` :
- `apps/<app>/locales/fr.json`
- `apps/<app>/locales/en.json`
- `apps/<app>/locales/ja.json`

### 📦 7.2 Format des Clés
Toutes les clés de jeu ou d'application doivent être préfixées par le namespace de l'application :
```json
{
  "translations": {
    "games.8queens.title": "Jeu des 8 Dames",
    "games.8queens.queens_count": "👑 {count}/{total} Dames",
    "games.8queens.conflicts_count": "⚠️ {count} Conflits"
  }
}
```

### ⚡ 7.3 Agrégation & Propagation
1. Au chargement et lors de chaque appel `api.php?action=get_locale&code=...`, `PluginDiscovery.php` fusionne automatiquement toutes les traductions découvertes dans le dictionnaire global.
2. Le basculement de langue dans le bureau émet `locale:changed` sur l'EventBus.
3. Chaque fenêtre ouverte exécute sa méthode `updateLocale()` sans recharger la page.

---

## 8. Tutoriel : Créer une Nouvelle Application en 5 Minutes

### Étape 1 : Créer le dossier
Créez `apps/mon-outil/`.

### Étape 2 : Créer le `manifest.json`
```json
{
  "id": "mon-outil",
  "name": "Mon Outil",
  "icon": "⚡",
  "main": "app.js",
  "css": "style.css",
  "locales": {
    "fr": { "title": "Mon Outil Rapide" },
    "en": { "title": "My Quick Tool" },
    "ja": { "title": "クイックツール" }
  }
}
```

### Étape 3 : Créer `locales/fr.json`, `en.json`, `ja.json`
```json
// fr.json
{
  "translations": {
    "apps.mon_outil.hello": "Bonjour depuis SimpleGallery WebOS !"
  }
}
```

### Étape 4 : Créer `app.js`
Implémentez la structure documentée à la [Section 5](#5-cycle-de-vie--interface-dune-application-js).

### Étape 5 : Tester
Rechargez le navigateur : votre application est automatiquement découverte par le Kernel, listée dans le menu des applications et prête à être exécutée !
