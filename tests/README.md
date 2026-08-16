# 🧪 Suites de Tests Unitaires - SimpleGallery

Ce dossier contient les suites de tests unitaires automatisées de **SimpleGallery**.
La suite est conçue **sans aucune dépendance externe** et s'exécute directement en PHP CLI.

---

## 🚀 Exécution des Tests

Pour exécuter la suite complète de tests (Sécurité + Fonctionnalités Générales) :

```bash
php tests/run_tests.php
```

Pour exécuter une suite de tests spécifique :

```bash
# Tests de Sécurité & Protection
php tests/SecurityUnitTest.php

# Tests Fonctionnels Généraux (Découpage, Cache, Dotfiles, Recherche, Archives)
php tests/GeneralUnitTest.php
```


---

## 🛡️ Périmètre des Tests de Sécurité

La suite vérifie automatiquement **6 piliers fondamentaux de sécurité** :

### 1. 🔍 Path Traversal & Canonisation des Chemins
- Tentatives de saut de répertoire (`../../etc/passwd`, `..\\..\\Windows`, `....//....//config.php`).
- Tentatives d'injection d'octets nuls (`\0`), encodages URL (`%2f`, `%00`), et mélanges de séparateurs.
- Confirmation que tous les accès hors de la racine de la galerie sont strictement rejetés (`null`).
- Confirmation que les accès aux fichiers et dossiers légitimes de la galerie fonctionnent.

### 2. 🧼 Sanitisation SVG (XSS & XXE)
- Injection de balises exécutables `<script>`, `<iframe>`, `<foreignObject>`.
- Attributs d'événements JavaScript inline (`onload`, `onclick`, `onerror`).
- Schémas d'URI malveillants `javascript:` dans les liens et images.
- Prévention contre les attaques XXE (XML External Entity injection).

### 3. 🔑 Jetons de Sécurité CSRF & Sessions
- Génération de jetons cryptographiquement sûrs (`random_bytes`).
- Validation à temps constant (`hash_equals`) pour éviter les attaques par canal auxiliaire (Timing Attacks).
- Rejet systématique des jetons invalides, nuls ou modifiés.

### 4. 🔐 Authentification Administrateur & Stockage des Hashs
- Hachage de mot de passe fort (`PASSWORD_DEFAULT` / BCRYPT).
- Stockage Isolé dans le fichier masqué `.admin_password_hash` sans modification du code source PHP de `config.php`.
- Vérification des entrées valides et rejet des mots de passe erronés.

### 5. 📁 Contrôle d'Accès aux Dossiers (Confidentialité & Protection)
- Dossiers Publics (accès libre).
- Dossiers Privés (`.private`) : invisibles et inaccessibles sans session administrateur active.
- Dossiers Protégés par mot de passe (`.password`) : verrouillés jusqu'à validation du mot de passe en session (`$_SESSION['unlocked_dirs']`).

### 6. ⏱️ Limiteur de Débit (Rate Limiting Anti-Bruteforce)
- Comptage et blocage automatique après dépassement du nombre maximal de tentatives (ex. 5 tentatives / 15 min pour la connexion admin et le déverrouillage de dossiers).
- Réinitialisation après expiration ou succès.

### 7. 🚫 Filtrage des Extensions de Téléversement & Double Extensions
- Rejet systématique des extensions exécutables (.php, .phtml, .phar, .sh, .exe, .cgi, etc.).
- Blocage des attaques à double extension (`malicious.php.jpg`, `shell.phtml.png`).
- Rejet des fichiers masqués et dotfiles.

### 8. 🛡️ Audit des Directives .htaccess
- Vérification de la désactivation du Directory Indexing (`Options -Indexes`).
- Verification de la protection des fichiers système et masqués.
- Blocage d'accès externe sur `functions.php`, `config.php`, `.admin_password_hash`.
- Enforcement de la directive Content-Security-Policy sur les fichiers SVG.
