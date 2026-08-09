# SimpleGallery 🚀

**SimpleGallery** est une galerie web ultra-légère, ultra-rapide et moderne conçue en **PHP 8+ / JavaScript Vanilla** (sans frameworks lourds ni dépendances complexes).

Le principe fondamental du projet d'origine (2005) est conservé : **pour publier des nouveaux médias (photos, vidéos, musique, documents), il suffit simplement de les copier dans n'importe quel dossier sur le serveur.**

---

## ✨ Fonctionnalités Principales

- 🔄 **Orientation Automatique des Photos (EXIF)** :
  - Détection et orientation automatique à 100% des photos smartphone / appareils numériques (verticales / horizontales) via `image-orientation: from-image` en CSS3 et `exif_read_data` / `imagerotate` en PHP.
- 🔎 **Explorateur d'Images Interactif (Zoom & Déplacement)** :
  - **Zoom Avant / Arrière** : Via les boutons `➕` / `➖`, la molette de la souris, ou les touches clavier `+` / `-`.
  - **Déplacement à la souris (*Pan / Drag*)** : Glissez-déposez l'image à la souris ou au doigt pour explorer les détails.
  - **Double-Clic** : Alterne rapidement entre le zoom 1x et 2.5x centré.
  - **Rotation 90°** : Bouton `⟳` ou touche `R` pour pivoter les photos à la volée.
  - **Bouton Réinitialiser** : Recommencez le zoom à 100% via le bouton `🔄` ou la touche `0`.
- 📸 **Rendu Polaroid Ultra-Réaliste & Mode Grille** :
  - **Mode Polaroid** : Cartes style tirage argentique Polaroid 600 (marges authentiques, papier coquille d'œuf texturé, effet de reflet brillant, ruban adhésif *Washi Tape* translucide, inclinaisons naturelles et police d'encre manuscrite *Caveat*).
  - **Mode Grille** : Grille responsive épurée avec zoom au survol.
- ⚡ **Génération & Cache de Vignettes Intelligent** ([thumb.php](file:///home/oktail/Documents/GitHub/SimpleGallery/thumb.php)) :
  - **Photos** : Redimensionnement automatique via l'extension **PHP GD** avec gestion de la rotation EXIF. *Bascule automatique en stream direct si GD n'est pas installé*.
  - **Vidéos** : Extraction automatique d'une image poster (à 1.0s) via **FFmpeg** pour les fichiers `.mp4`, `.webm`, `.mov`, `.mkv`, etc.
  - Mise en cache automatique dans le dossier `.thumbnails/` au format WebP / JPEG optimisé.
- 🎬 **Support Média HTML5 Natif** : Lecture directe des vidéos et musiques dans le navigateur (zéro Flash).
- 📁 **Surcharge de Configuration par Fichiers Cachés (*Dotfiles Unix*)** : Personnalisez les commentaires, fonds d'écran, titres et thèmes par dossier via `.comment`, `.bg`, `.title`, `.desc`, `.theme`.
- 🎨 **Thèmes & Couleurs Configurables** : Sélection de thèmes (`polaroid-classic`, `dark-glass`, `light-minimal`, `cyberpunk`) ou couleurs sur mesure dans `config.php`.
- 🔍 **Recherche & Filtres en Temps Réel** : Filtrage instantané par type de média et barre de recherche.
- 🔐 **Mode Administrateur & Authentification** : Authentification sécurisée par mot de passe haché (BCRYPT) enregistré dans `config.php` via le script CLI `set_admin_password.php` ou l'interface web.
- 🔒 **Sécurité Renforcement** : Protection stricte contre le *Directory Traversal* (`../`).

---

## ⌨️ Raccourcis Clavier dans la Lightbox

| Raccourci | Action |
|---|---|
| `<Flèche Gauche>` / `<Flèche Droite>` | Élément précédent / suivant |
| `Swipe Gauche / Droite` (Mobile) | Navigation tactile fluide |
| `+` ou `=` | Zoom avant |
| `-` ou `_` | Zoom arrière |
| `Glisser Souris` | Déplacer l'image (*Pan / Drag*) |
| `Double Clic` | Basculer entre zoom 1x et 2.5x |
| `0` | Réinitialiser le zoom (100%) |
| `R` | Rotation de l'image de 90° |
| `F` | Basculer en mode Plein Écran (*Fullscreen*) |
| `Échap` | Fermer la visionneuse Lightbox |

---

## 🔐 Configuration du Mode Administration (`set_admin_password.php`)

SimpleGallery intègre un **mode administration** sécurisé pour déverrouiller des fonctionnalités de gestion.

### 1. Initialiser ou Modifier le Mot de Passe Admin via CLI

Exécutez la commande suivante dans votre terminal à la racine du projet pour générer et enregistrer le hash BCRYPT dans [config.php](file:///home/oktail/Documents/GitHub/SimpleGallery/config.php) :

```bash
php set_admin_password.php "VotreMotDePasseSecret"
```

### 2. Se Connecter et Modifier le Mot de Passe via l'Interface Web

- Cliquez sur le bouton **🔑 Admin** dans la barre d'outils de l'application.
- Saisissez votre mot de passe pour activer le mode **🛡️ Admin Active**.
- Vous pouvez ensuite modifier votre mot de passe directement depuis le formulaire du modal administration.

### 3. Désactiver le Mode Admin

Pour désactiver temporairement le mode administration, définissez la variable `$admin_password_hash` sur une chaîne vide dans `config.php` :

```php
$admin_password_hash = '';
```

---

## 📂 Configuration par Fichiers Cachés (*Dotfiles Unix*)

Chaque dossier de la galerie peut être personnalisé individuellement en y déposant simplement des fichiers cachés Unix :

| Fichier | Rôle & Usage | Exemple / Syntaxe |
|---|---|---|
| **`.comment`** | Associe des commentaires ou légendes aux fichiers du dossier. | **Format legacy 2005** :<br>```text<br>photo1.jpg<br>Souvenir de vacances à la plage<br>video2.mp4<br>Saut en parachute<br>```<br><br>**Format Clé-Valeur** :<br>```text<br>photo1.jpg = Souvenir de vacances à la plage<br>``` |
| **`.bg`** | Définit une image de fond spécifique ou une couleur CSS pour le dossier. | **Image locale** : `fond.jpg`<br>**Couleur / Dégradé CSS** : `#0f172a` ou `linear-gradient(to right, #0f172a, #1e1b4b)` |
| **`.title`** | Surcharge le nom affiché du dossier dans l'en-tête et le fil d'Ariane (*breadcrumbs*). | `Vacances d'Été 2025` |
| **`.desc`** ou **`.description`** | Affiche une bannière descriptive en haut de la galerie pour ce dossier. | `Collection de photos et vidéos prises lors de notre voyage en Espagne.` |
| **`.theme`** | Applique un thème de couleur spécifique uniquement pour ce dossier. | **Nom de thème** : `cyberpunk`<br>ou **Couleurs personnalisées** :<br>```text<br>accent = #ec4899<br>polaroid_bg = #fef08a<br>``` |

---

## 🎨 Configuration du Thème (`config.php`)

Dans [config.php](file:///home/oktail/Documents/GitHub/SimpleGallery/config.php), vous pouvez choisir un thème global ou ajuster les paramètres :

```php
// Sélection du thème global ('polaroid-classic', 'dark-glass', 'light-minimal', 'cyberpunk')
$theme_preset = 'polaroid-classic';

// Titre par défaut de la galerie
$gallery_title = "SimpleGallery";

// Dimensions maximales des vignettes (en pixels)
$thumb_width = 360;
$thumb_height = 360;
```

---

## 🛠️ Structure du Projet

```text
SimpleGallery/
├── config.php            # Configuration générale (thèmes, titre, hash admin)
├── api.php               # API REST JSON PHP (scan des répertoires, dotfiles & auth admin)
├── thumb.php             # Moteur de vignettes (GD, FFmpeg, cache .thumbnails & stream direct)
├── set_admin_password.php # Script CLI pour générer/mettre à jour le mot de passe admin
├── index.php             # Application Web HTML5 SPA (interface principale & modal admin)
├── css/
│   └── gallery.css       # Style CSS3, effet Polaroid réaliste, grille & modal admin
├── js/
│   └── gallery.js        # Logique client (moteur de zoom/déplacement, AJAX, Lightbox, auth admin)
└── .thumbnails/          # Dossier de cache des vignettes (créé automatiquement)
```

---

## 💻 Installation

1. Copiez les fichiers de **SimpleGallery** sur votre serveur web PHP (compatible Apache, Nginx, LiteSpeed, Caddy avec PHP 7.4+ ou PHP 8+).
2. Optionnel : activez l'extension PHP `gd` pour le redimensionnement d'images et installez `ffmpeg` pour l'extraction de vignettes vidéo.
3. Définissez le mot de passe d'administration via la commande : `php set_admin_password.php "VotreMotDePasse"`
4. Glissez vos dossiers de photos et médias directement dans le répertoire.
5. Ouvrez `index.php` dans votre navigateur web !

---

## 📄 Licence
[MIT License](LICENSE)
