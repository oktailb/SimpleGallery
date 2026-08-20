# SimpleGallery WebOS 🚀

**SimpleGallery** est une galerie multimédia et un **environnement WebOS moderne, ultra-rapide et modulaire** conçu en **PHP 7.4+ / PHP 8+ et JavaScript Vanilla pur** (zéro framework lourd, zéro dépendance complexe).

Le principe fondamental d'origine (2005) reste intact : **pour publier de nouveaux médias (photos, vidéos, musique, documents, archives), il suffit simplement de les déposer dans n'importe quel dossier sur le serveur.**

---

## 🌟 Vue d'Ensemble & Fonctionnalités Utilisateur

### 🖥️ 1. Environnement de Bureau WebOS (Style macOS / Modern Desktop)
- **Gestionnaire de Fenêtres Multi-Tâches (`WindowManager`)** : Déplacez, redimensionnez, maximisez, minimisez dans le dock et empilez librement vos fenêtres d'applications avec gestion fluide du `z-index`.
- **Barre Supérieure Contextuelle (`MenuBarManager`)** : Menu d'application dynamique (façon macOS) adapté à l'application active au premier plan, horloge système en direct, indicateurs de statut et sélecteur de langue instantané.
- **Dock & Barre des Tâches** : Accès rapide aux applications épinglées, restauration de fenêtres réduites et indicateurs de processus actifs.
- **Raccourcis de Bureau & Grille Personnalisable** : Raccourcis configurables, drag-and-drop, choix du fond d'écran et des thèmes.
- **Internationalisation Complète (i18n)** : Interface et jeux traduits en **Français (FR)**, **Anglais (EN)** et **Japonais (JA)** avec **basculement réactif en temps réel** (aucun rechargement de page nécessaire).

---

### 📂 2. Suite Complète d'Applications Intégrées (`apps/`)

| Application | Icône | Description & Capacités |
|---|:---:|---|
| **Explorateur de Fichiers** | 📁 | Navigation arborescente double volet, fil d'Ariane, tri, recherche en direct, sélection multiple, téléversement par glisser-déposer, création de dossiers, gestion des permissions, modes d'affichage **Polaroid 600**, **Grille Moderne**, **Liste** et **Compact**. |
| **Visionneuse d'Images** | 🖼️ | Moteur interactif de zoom profond (*Deep Zoom* jusqu'à 10x), déplacement à la souris (*Pan/Drag*), rotation 90°, filtres colorimétriques (luminosité, contraste, saturation, sépia, inversion, flou) et panneau d'inspection des métadonnées EXIF. |
| **Lecteur Vidéo HTML5** | 🎬 | Lecteur vidéo complet avec gestion des pistes de sous-titres (`.vtt`, `.srt`), sélection de la vitesse de lecture (0.25x à 2x), mode cinéma, *Picture-in-Picture* (PiP) et capture d'écran instantanée. |
| **Lecteur Audio & Musique** | 🎵 | Lecteur musical avec analyseur de spectre / onde sonore dynamique en temps réel (*Canvas Visualizer*), lecture des pochettes et tags ID3, listes de lecture, lecture aléatoire et répétition. |
| **Lecteur & Éditeur de Documents** | 📄 | **PDF** (rendu vectoriel PDF.js avec miniatures et pagination), **Markdown** (visionneuse et éditeur scindé en direct avec rendu de listes, tableaux, formules et mise en forme riche), **Éditeur de Code Source** (coloration syntaxique Prism.js pour 50+ langages, numérotation des lignes, thèmes sombre/clair et sauvegarde directe sur le serveur). |
| **Gestionnaire d'Archives** | 📦 | Exploration directe du contenu des archives ZIP, extraction de fichiers et création d'archives à la volée. |
| **Cartes & Géolocalisation** | 🗺️ | Carte interactive du monde (Leaflet / OpenStreetMap) avec regroupement automatique par clusters (*Clustering*) des photos géotaggées par GPS EXIF et traçage d'itinéraires. |
| **Jeu des 8 Dames** | 👑 | Puzzle classique des N-Dames (échiquier de 4x4 à 12x12), solveur procédural complet par backtracking, explorateur interactif de solutions, rayons de menace dynamiques, indices et démo automatique. |
| **Foot Pong Arcade** | ⚽ | Jeu d'arcade rétro physique 1v1 avec raquettes inclinables à la souris, rebonds balistiques, système de particules, niveaux de difficulté IA (Facile, Moyen, Pro, Légende) et chronomètre de match. |
| **Tours de Hanoï** | 🗼 | Casse-tête mathématique (3 à 8 disques), glisser-déposer et placement au clic, calcul du minimum optimal d'étapes ($2^n - 1$), solveur récursif pas-à-pas animé et indices intelligents. |
| **Tuyaux & Réseau Connecté** | 🔧 | Puzzle procédural de connexion de réseau (*Netwalk*), simulation de fluide dynamique, prévention des fuites, mode boucle cyclique circulaire (**Tore**) et solveur automatique. |

---

## ⚡ Installation & Démarrage Rapide

### Prérequis
- **PHP 7.4+** ou **PHP 8.0+** (extensions recommandées : `gd`, `exif`, `fileinfo`, `zip`).
- Optionnel : **FFmpeg** installé sur la machine hôte pour la génération automatique des vignettes d'affiches vidéo.

### 1. Démarrage Local Immédiat
Lancez simplement le script de démarrage local inclus :

```bash
./start.sh
# Ou en spécifiant un port particulier :
./start.sh 8080
```
Ouvrez ensuite `http://localhost:8080` dans votre navigateur.

---

### 2. Déploiement sur Serveur Web (Apache, Nginx, LiteSpeed, Caddy)
1. Téléversez l'ensemble des fichiers du projet dans la racine de votre hébergement web (`public_html` ou `/var/www/html/SimpleGallery`).
2. Accordez les permissions d'écriture nécessaires au serveur web :
   ```bash
   chown -R www-data:www-data /var/www/html/SimpleGallery
   chmod -R 775 /var/www/html/SimpleGallery
   ```
3. Initialisez le mot de passe d'administration via la ligne de commande :
   ```bash
   php set_admin_password.php "VotreMotDePasseSecret"
   ```
4. Déposez vos dossiers de photos et médias : ils sont immédiatement détectés et prêts à être explorés !

---

## 🔐 Mode Administration & Sécurité

- **Authentification Robuste** : Mot de passe haché par algorithme BCRYPT stocké de manière sécurisée dans `config.php`.
- **Protection CSRF Globale** : Toutes les requêtes d'écriture, téléversement et modifications exigent un jeton de session anti-CSRF valide.
- **Isolation du Système de Fichiers** : Filtrage strict contre le *Directory Traversal* (`../`).
- **Gestion des Fichiers en Mode Admin** :
  - Cliquez sur **🔑 Admin** dans la barre supérieure pour vous connecter.
  - Éditez les métadonnées, titres, bannières descriptives et légendes directement depuis l'interface web.
  - Déverrouillez la création de dossiers, le renommage, le déplacement, la suppression et le téléversement de fichiers par glisser-déposer.

---

## 📂 Configuration par Fichiers Cachés (*Dotfiles Unix*)

SimpleGallery vous permet de personnaliser individuellement n'importe quel sous-dossier sans base de données, simplement en y plaçant des fichiers texte cachés :

| Fichier | Rôle & Fonctionnalité | Exemple Rapide |
|---|---|---|
| **`.title`** | Surcharge le nom d'affichage du dossier (en-tête, fil d'Ariane, grille). | `Vacances d'Été 2026 🏖️` |
| **`.desc`** / **`.description`** | Affiche une bannière descriptive élégante en haut du dossier. | `Album souvenir de notre voyage en Espagne.` |
| **`.comment`** | Associe des légendes personnalisées aux médias du dossier (`fichier.jpg = Légende`). | `photo1.jpg = Plage au coucher du soleil` |
| **`.bg`** | Définit une image locale ou une couleur/dégradé CSS en fond d'écran. | `#0f172a` ou `fond.jpg` |
| **`.theme`** | Applique un thème visuel dédié à ce répertoire (`polaroid-classic`, `dark-glass`, `light-minimal`, `cyberpunk`). | `dark-glass` |
| **`.private`** | Masque le dossier aux visiteurs publics (visible uniquement pour l'Admin). | *Fichier vide ou "private"* |
| **`.password`** | Protège l'accès au dossier par un mot de passe dédié. | *Hash BCRYPT* |

---

## ⌨️ Raccourcis Clavier Principaux

| Raccourci | Action |
|---|---|
| `<Flèche Gauche>` / `<Flèche Droite>` | Élément précédent / suivant |
| `+` ou `=` / `-` ou `_` | Zoom avant / arrière |
| `Glisser Souris` (*Drag*) | Déplacer l'image agrandie (*Pan*) |
| `Double Clic` | Alterne entre zoom normal (1x) et zoom centré (2.5x) |
| `R` | Rotation de l'image de 90° |
| `0` | Réinitialiser le zoom (100%) |
| `F` | Basculer en mode Plein Écran (*Fullscreen*) |
| `Échap` | Fermer la visionneuse active |

---

## 🛠️ Architecture Interne & Guide Développeur

Pour comprendre le fonctionnement interne du système, l'architecture du Kernel, le cycle de vie des fenêtres, le bus d'événements IPC, le système de localisation dynamique ou pour **créer vos propres applications modulaires**, consultez la documentation technique complète :

👉 **[Consulter DOCUMENTATION.md](DOCUMENTATION.md)**

---

## 📄 Licence
Ce projet est distribué sous licence [MIT License](LICENSE).
