# SimpleGallery 🚀

**SimpleGallery** est une galerie web ultra-légère, ultra-rapide et moderne conçue en **PHP 8+ / JavaScript Vanilla** (sans frameworks lourds ni dépendances complexes).

Le principe fondamental du projet d'origine (2005) est conservé : **pour publier des nouveaux médias (photos, vidéos, musique, documents), il suffit simplement de les copier dans n'importe quel dossier sur le serveur.**

---

## ✨ Fonctionnalités Principales

- 📸 **Rendu Polaroid Ultra-Réaliste & Mode Grille** :
  - **Mode Polaroid** : Cartes style tirage argentique Polaroid 600 (marges authentiques, papier coquille d'œuf texturé, effet de reflet brillant, ruban adhésif *Washi Tape* translucide, inclinaisons naturelles et police d'encre manuscrite *Caveat*).
  - **Mode Grille** : Grille responsive épurée avec zoom au survol.
- ⚡ **Génération & Cache de Vignettes Intelligent** ([thumb.php](file:///home/oktail/Documents/GitHub/SimpleGallery/thumb.php)) :
  - **Photos** : Découpage et redimensionnement automatique via l'extension **PHP GD** avec gestion de la rotation EXIF des smartphones. *Bascule automatique en stream direct si l'extension GD n'est pas installée*, garantissant que les vignettes d'images ne sont **jamais vides ou cassées**.
  - **Vidéos** : Extraction automatique d'une image poster (à 1.0s) via **FFmpeg** pour les fichiers `.mp4`, `.webm`, `.mov`, `.mkv`, etc.
  - Mise en cache automatique dans le dossier `.thumbnails/` au format WebP / JPEG optimisé.
- 🎬 **Support Média HTML5 Natif** : Plus aucun plugin Flash (`.swf`). Lecture directe des vidéos et musiques dans le navigateur.
- 📁 **Surcharge de Configuration par Fichiers Cachés (*Dotfiles Unix*)** : Personnalisez facilement l'apparence, les commentaires ou le titre de n'importe quel dossier à l'aide de fichiers cachés (`.comment`, `.bg`, `.title`, `.desc`, `.theme`).
- 🎨 **Thèmes & Couleurs Configurables** : Sélectionnez un thème préconfiguré (`polaroid-classic`, `dark-glass`, `light-minimal`, `cyberpunk`) ou personnalisez vos propres couleurs dans `config.php`.
- 🔍 **Recherche & Filtres en Temps Réel** : Filtrage instantané par type de média (Photos, Vidéos, Musique, Documents, Archives) et barre de recherche.
- 🔎 **Lightbox Fullscreen** : Visionneuse intégrée avec navigation au clavier (`←` / `→` / `Échap`), affichage des métadonnées/commentaires et bouton de téléchargement direct.
- 🔒 **Sécurité Renforcée** : Protection stricte contre le *Directory Traversal* (`../`).

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
├── config.php        # Configuration générale (thème, titre, extensions autorisées)
├── api.php           # API REST JSON PHP (scan des répertoires, dotfiles & métadonnées)
├── thumb.php         # Moteur de vignettes (GD, FFmpeg, cache .thumbnails & stream direct)
├── index.php         # Application Web HTML5 SPA (interface principale)
├── css/
│   └── gallery.css   # Style CSS3, effet Polaroid réaliste & grille responsive
├── js/
│   └── gallery.js    # Logique client Vanilla ES6+ (AJAX, Lightbox, filtres, dotfiles)
└── .thumbnails/      # Dossier de cache des vignettes (créé automatiquement)
```

---

## 💻 Installation

1. Copiez les fichiers de **SimpleGallery** sur votre serveur web PHP (compatible Apache, Nginx, LiteSpeed, Caddy avec PHP 7.4+ ou PHP 8+).
2. Optionnel : activez l'extension PHP `gd` pour le redimensionnement d'images et installez `ffmpeg` pour l'extraction de vignettes vidéo (si non présents, la galerie utilisera automatiquement les fallbacks en direct sans erreur).
3. Glissez vos dossiers de photos et médias directement dans le répertoire.
4. Ouvrez `index.php` dans votre navigateur web !

---

## 📄 Licence
[MIT License](LICENSE)
