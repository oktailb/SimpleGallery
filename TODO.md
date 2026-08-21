# 🚀 SimpleGallery WebOS — Feuille de Route & Spécifications des Nouvelles Applications (TODO)

Ce document détaille la vision, l'architecture et les spécifications techniques des futures applications, utilitaires et améliorations du système **SimpleGallery WebOS**.

---

## 📑 Sommaire
1. [🛠️ Terminal WebOS & Shell Interactif (CLI / Bash)](#1-terminal-webos--shell-interactif-cli--bash)
2. [💻 IDE Multi-Langages, Détection d'Environnement & Débogueur](#2-ide-multi-langages-détection-denvironnement--débogueur)
3. [📊 Moniteur Système & Gestionnaire de Tâches (*Activity Monitor*)](#3-moniteur-système--gestionnaire-de-tâches-activity-monitor)
4. [📈 Calculatrice Scientifique & Traceur de Courbes Graphiques](#4-calculatrice-scientifique--traceur-de-courbes-graphiques)
5. [🕹️ Émulateurs Rétro 8/16-Bits, Ordinateurs Anciens & Doom Wasm](#5-émulateurs-rétro-816-bits-ordinateurs-anciens--doom-wasm)
6. [🖥️ Barre des Tâches & Dock Évolué ("Next-Gen Taskbar")](#6-barre-des-tâches--dock-évolué-next-gen-taskbar)
7. [💬 Chat / Tribune Libre (*Client Bouchot & Coincoin LinuxFR*)](#7-chat--tribune-libre-client-bouchot--coincoin-linuxfr)
8. [📑 Suite Bureautique & Support des Formats ODF XML (OpenDocument)](#8-suite-bureautique--support-des-formats-odf-xml-opendocument)
9. [🗄️ Client SQL & Gestionnaire de Bases de Données (SQLite / MySQL)](#9-client-sql--gestionnaire-de-bases-de-données-sqlite--mysql)
10. [👥 Jeux Multijoueurs & Table Virtuelle de JDR (VTT)](#10-jeux-multijoueurs--table-virtuelle-de-jdr-vtt)

---

## 1. 🛠️ Terminal WebOS & Shell Interactif (CLI / Bash)
*ID App* : `terminal` | *Catégorie* : `system` | *Icône* : `💻`

### Objectifs & Architecture
Un émulateur de terminal complet sous WebOS (intégrant une interface xterm.js ou un moteur virtuel pur JS/DOM) avec adaptation dynamique aux droits d'accès.

### Spécifications Fonctionnelles
* **Mode Invité (Read-Only sécurisé)** :
  * Navigation dans l'arborescence de la galerie : `cd`, `pwd`, `ls -l`, `tree`.
  * Consultation et recherche de contenu : `cat`, `head`, `tail`, `grep`, `find`, `file`, `stat`, `du`, `df`.
  * Commandes système WebOS : `help`, `clear`, `theme [nom]`, `locale [code]`, `history`, `date`, `echo`, `man`.
* **Mode Administrateur (Read-Write & Commandes Mutantes)** :
  * Manipulation de fichiers : `mkdir`, `touch`, `rm`, `mv`, `cp`, `chmod`, `rename`.
  * Gestion WebOS : `ps` (liste des fenêtres ouvertes), `kill [pid|winId]`, `sysinfo`, `run-tests`.
  * **Option "Vrai Shell / Bash" (si activé dans config.php par l'admin)** :
    * Passerelle d'exécution sécurisée (via `proc_open` / WebSocket / streaming AJAX) avec isolation `escapeshellarg` et dossier racine vérifié.
    * Support des tuyaux (`|`), redirections (`>`, `>>`) et scripts batch.

---

## 2. 💻 IDE Multi-Langages, Détection d'Environnement & Débogueur
*ID App* : `code-studio` | *Catégorie* : `productivity` | *Icône* : `⚡`

### Objectifs & Architecture
Un environnement de développement complet intégré, capable de transformer SimpleGallery en station de travail pour coder, tester et déboguer directement dans le navigateur.

### Spécifications Fonctionnelles
* **Détection Automatique des Compilateurs / Interpréteurs Hôte** :
  * Endpoint backend `api.php?action=detect_toolchain` analysant les binaires disponibles :
    * `gcc` / `g++` (C / C++)
    * `python` / `python3` (Python)
    * `perl` (Perl)
    * `php` (PHP CLI)
    * `node` / `npm` (JavaScript / Node.js)
    * `rustc` (Rust)
    * `go` (Go)
    * Interpréteur **BASIC rétro** (moteur GW-BASIC / Chip-8 / JS-BASIC embarqué en pur JavaScript).
* **Éditeur de Code Avancé** :
  * Coloration syntaxique multi-langages, indentation automatique, pliage de code, mini-carte (Minimap).
  * Auto-complétion de base et recherche / remplacement par expressions régulières (`Regex`).
* **Console d'Exécution & Débogueur** :
  * Bouton `▶ Exécuter (F5)` avec affichage en direct des flux `stdout` et `stderr`.
  * Débogueur pas à pas pour les scripts interprétés (points d'arrêt, inspection des variables locales, pile d'appels).

---

## 3. 📊 Moniteur Système & Gestionnaire de Tâches (*Activity Monitor*)
*ID App* : `system-monitor` | *Catégorie* : `system` | *Icône* : `📈`

### Objectifs & Architecture
Tableau de bord de télémétrie en temps réel combinant les métriques clientes du navigateur et les diagnostics du serveur PHP.

### Spécifications Fonctionnelles
* **Métriques Client (WebOS Frontend)** :
  * Liste des fenêtres et processus actifs avec PID interne, nom d'application et mémorisation d'état.
  * Consommation mémoire JavaScript (`performance.memory`), taux de rafraîchissement (FPS de l'EventBus/DOM).
  * Possibilité de forcer la fermeture d'une application gelée (*Force Quit*).
* **Métriques Serveur (Backend PHP)** :
  * Utilisation CPU et mémoire RAM (`memory_get_usage`, `sys_getloadavg` si disponible).
  * Espace disque total, utilisé et disponible sur le volume de stockage.
  * État des caches JSON des dossiers, statistiques sur les miniatures générées et logs d'erreurs récents.

---

## 4. 📈 Calculatrice Scientifique & Traceur de Courbes Graphiques
*ID App* : `graphing-calc` | *Catégorie* : `utilities` | *Icône* : `📐`

### Objectifs & Architecture
Outil mathématique complet à double volet : calculatrice multifonctions et moteur de tracé géométrique/graphique sur Canvas 2D.

### Spécifications Fonctionnelles
* **Modes de Calcul** :
  * **Standard & Scientifique** : Trigonométrie (`sin`, `cos`, `tan`), logarithmes (`log`, `ln`), exponentielles, factorielles, puissances et racines.
  * **Mode Programmeur** : Conversions instantanées Décimal / Hexadécimal / Binaire / Octal, opérations bit-à-bit (`AND`, `OR`, `XOR`, `NOT`, `SHL`, `SHR`).
* **Traceur de Fonctions Graphiques $f(x)$** :
  * Tracé simultané de plusieurs courbes avec couleurs personnalisées.
  * Zoom interactif, déplacement sur la grille (Pan), repérage automatique des racines, extrema et intersections.
  * Export du graphique tracé en image PNG ou sauvegarde dans la galerie.

---

## 5. 🕹️ Émulateurs Rétro 8/16-Bits, Ordinateurs Anciens & Doom Wasm
*ID App* : `retro-station` | *Catégorie* : `games` | *Icône* : `👾`

### Objectifs & Architecture
Plateforme d'émulation et de rétrogaming intégrée, exécutant des cœurs WebAssembly ou pur JS directement dans des fenêtres WebOS redimensionnables.

### Spécifications Fonctionnelles
* **Systèmes Émulés** :
  * **Consoles de Jeux Rétro** : NES (Nintendo Entertainment System), Game Boy / Game Boy Color, Chip-8.
  * **Micro-Ordinateurs 8/16-bits** : Commodore 64, ZX Spectrum, Amstrad CPC, Apple II.
  * **Classiques PC Rétro** : Doom Classic Shareware (Wasm), DOSBox-lite pour lancer de vieux exécutables `.exe`/`.com`.
* **Fonctionnalités WebOS Intégrées** :
  * Glisser-déposer de fichiers ROMs (`.nes`, `.gb`, `.d64`, `.tap`, `.wad`) depuis l'Explorateur de fichiers.
  * Sauvegarde instantanée des états (*Save States*) dans le `localStorage` ou dans un dossier utilisateur.
  * Support complet des manettes de jeu USB / Bluetooth via l'API HTML5 Gamepad.

---

## 6. 🖥️ Barre des Tâches & Dock Évolué ("Next-Gen Taskbar")
*Composant* : `system/userland/core/TaskbarManager.js` | *Région* : `WebOS Shell`

### Objectifs & Architecture
Faire évoluer le dock actuel vers une barre des tâches complète de système d'exploitation moderne (façon macOS Dock + Windows 11 Taskbar).

### Spécifications Fonctionnelles
* **Prévisualisation au Survol (Window Peeking / Hover Cards)** :
  * Affichage d'une miniature en direct de la fenêtre lors du passage de la souris sur l'icône de la barre des tâches.
* **Menu Démarrer / Lanceur d'Applications Réorganisé** :
  * Barre de recherche rapide d'applications et raccourcis avec filtres par catégorie.
  * Liste des fichiers récemment ouverts et statut d'administration.
* **Zone de Notification & Plateau Système (System Tray)** :
  * Horloge interactive avec calendrier pop-up.
  * Contrôle du volume global, indicateur de connexion réseau/batterie.
  * Centre de notifications toast regroupant les alertes de téléchargement, erreurs et événements.
* **Bureaux Virtuels / Espaces de Travail Multiples (Workspaces)** :
  * Possibilité de basculer entre plusieurs bureaux virtuels indépendants (`Bureau 1`, `Bureau 2`, `Bureau 3`).

---

## 7. 💬 Chat / Tribune Libre (*Client Bouchot & Coincoin LinuxFR*)
*ID App* : `tribune` | *Catégorie* : `communication` | *Icône* : `🦆`

### Objectifs & Architecture
Client de messagerie instantanée inspiré de la culture des tribunes libres / bouchots (style LinuxFR, DaCode, DLFP) avec horodatage strict et interactivité temps réel.

### Spécifications Fonctionnelles
* **Format Tribune & Bouchot** :
  * Horodatage précis `HH:MM:SS` pour chaque message.
  * Clic sur une horloge pour insérer une référence de réponse (`14:25:30`) avec mise en surbrillance automatique au survol (*coincoin tracking*).
  * support des totoz (avec toggle nsfw)
* **Authentification & Personnalisation** :
  * Identification via cookie utilisateur ou pseudonyme libre (avec badge distinctif pour l'administrateur).
  * User-Agent configurable ou signature personnalisée.
* **Moteur & Ergonomie** :
  * Flux temps réel (Server-Sent Events `SSE` ou polling configurable avec backoff intelligent).
  * Raccourcis clavier (touche `Entrée` pour poster, `Tab` pour auto-compléter les horloges).
  * Alertes sonores légères (Web Audio API) configurables lors d'une mention ou d'un nouveau post.

---

## 8. 📑 Suite Bureautique & Support des Formats ODF XML (OpenDocument)
*ID App* : `office-suite` (`doc-viewer`, `calc`, `slides`) | *Catégorie* : `productivity` | *Icône* : `📋`

### Objectifs & Architecture
Support étendu des formats de documents bureautiques ouverts (norme ISO/IEC 26300 OpenDocument) et tableur interactif.

### Spécifications Fonctionnelles
* **Visionneuse Native ODF XML** :
  * **`.odt` (OpenDocument Text)** : Décompression ZIP côté client/serveur, parsing de `content.xml` et `styles.xml` avec rendu CSS fidèle (titres, listes, tableaux, images intégrées).
  * **`.ods` (OpenDocument Spreadsheet)** : Rendu sous forme de tableur interactif avec onglets de feuilles.
  * **`.odp` (OpenDocument Presentation)** : Rendu des diapositives avec navigation clavier (`PageUp`/`PageDown`).
* **Tableur Calc Interactif (`apps/calc`)** :
  * Édition et création de fichiers `.csv`, `.tsv`, `.ods` et `.xlsx`.
  * Moteur de formules mathématiques (`=SUM()`, `=AVERAGE()`, `=COUNT()`, `=IF()`, etc.).
  * Tri des colonnes, filtres, mise en forme conditionnelle et export direct dans la galerie.

---

## 9. 🗄️ Client SQL & Gestionnaire de Bases de Données (SQLite / MySQL)
*ID App* : `sql-client` | *Catégorie* : `development` | *Icône* : `🗄️`

### Objectifs & Architecture
Gestionnaire de bases de données relationnelles permettant d'explorer et de requêter des fichiers SQLite locaux ou des serveurs distants.

### Spécifications Fonctionnelles
* ** Support des bases distantes ** :
  * connexion via socket (en mode client lourd)
  * support des sockets linux
* **Support SQLite Local Transparent** :
  * Ouverture directe de tout fichier `.sqlite`, `.sqlite3`, `.db` présent dans la galerie (via l'extension PHP `pdo_sqlite` côté backend ou `sql.js` en pur WebAssembly côté client).
* **Explorateur de Schéma & Tables** :
  * Arborescence des tables, vues, index, déclencheurs (`triggers`) et structure des colonnes (types, contraintes, clés primaires/étrangères).
* **Console de Requêtes SQL & Résultats** :
  * Éditeur SQL avec coloration syntaxique et suggestions de noms de tables/colonnes.
  * Grille de résultats paginée, triable et filtrable avec export en `JSON`, `CSV` ou `SQL Inserts`.

---

## 10. 👥 Jeux Multijoueurs & Table Virtuelle de JDR (VTT)
*ID Apps* : `jdr-vtt`, `chess-2p`, `konquest` | *Catégorie* : `games` | *Icône* : `🎲`

### Objectifs & Architecture
Extension des modules de jeux pour supporter le jeu à plusieurs, soit en local sur le même écran, soit en réseau synchrone/asynchrone.

### Spécifications Fonctionnelles
* **Table Virtuelle de JDR / VTT (`apps/games/jdr`)** :
  * Intégration des modules existants : Chat MJ/Joueur, fiches de personnages, lanceur de dés polyédriques (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`).
  * Carte tactique avec brouillard de guerre (*Fog of War*), grille carrée/hexagonale et déplacement de pions/tokens.
* **Échecs & Dames 2 Joueurs** :
  * Mode 1 vs 1 local avec rotation de l'échiquier ou mode synchronisé via polling `api.php`.
* **Konquest / 4X Spatial** :
  * Jeu de conquête planétaire au tour par tour contre l'ordinateur ou d'autres joueurs.

---

## 📋 Priorisation & Phases de Réalisation

| Phase | Domaine | Applications & Modules Clés |
| :--- | :--- | :--- |
| **Phase 1** | *Système & Diagnostics* | **Moniteur Système** (`system-monitor`), **Terminal WebOS sécurisé** (`terminal`), **Évolution Taskbar / Dock**. |
| **Phase 2** | *Productivité & Outils* | **Calculatrice Scientifique & Graphique** (`graphing-calc`), **Suite Bureautique & ODF XML** (`doc-viewer` / `calc`), **Client SQL** (`sql-client`). |
| **Phase 3** | *Développement & Chat* | **IDE Multi-Langages & Toolchain** (`code-studio`), **Client Tribune / Bouchot** (`tribune`). |
| **Phase 4** | *Rétrogaming & Multijoueur* | **Émulateur Rétro & Doom Wasm** (`retro-station`), **Table Virtuelle JDR & Jeux 2P** (`jdr-vtt`). |
