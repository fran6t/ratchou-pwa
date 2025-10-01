# Ratchou

**Version 1.0.1**

# Gestion Dépenses Familiales — PWA/IndexedDB (100% Offline)

Application minimaliste pour suivre les comptes et les mouvements familiaux, pensée pour être **très simple**, **100% offline** et **installable** comme une PWA. Frontend en **HTML5/CSS3/JavaScript ES6+** vanilla, base de données **IndexedDB** locale.

---

## 1) Objectifs & principes

- **Frontend** : HTML5, CSS3, JavaScript ES6+ vanilla (pas de framework)
- **Base de données** : IndexedDB (navigateur) pour stockage local
- **PWA** : Progressive Web App installable, Service Worker pour cache offline
- **UI** : Bootstrap 5.x (**local**, pas de CDN), HTML/CSS/JS vanilla
- **Architecture** : Modulaire avec séparation modèles/composants/pages
- **Confidentialité** : **100% offline**, aucune ressource externe (CDN, polices, trackers)
- **Clés UUID** : Toutes les clés primaires sont des **UUID** pour éviter les conflits
- **Intégrité applicative** : Contraintes métier gérées par le code JavaScript
- **Authentication** : Code d'accès à 4 chiffres avec système de guards centralisé
- **Export/Import** : Sauvegarde et restauration complète en JSON
- **Multi-devises** : Support EUR (centimes) et BTC (satoshis) avec conversion automatique
- **Thème adaptatif** : Mode dark/light/auto avec détection système

---

## 2) Architecture PWA

### Structure des fichiers
```
ratchou/
├── index.html              # Page de connexion (entrée principale)
├── dashboard.html          # Tableau de bord principal
├── manifest.json           # Manifeste PWA
├── sw.js                   # Service Worker
├── assets/                 # Ressources statiques (100% local)
│   ├── css/               # Bootstrap + styles custom
│   ├── js/                # Bootstrap Bundle
│   ├── icons/             # Icônes PWA (192px, 512px)
│   ├── img/               # Images et logo
│   └── fonts/             # Polices locales
├── js/
│   ├── core/              # Couche application
│   │   ├── ratchou-app.js        # Orchestrateur principal
│   │   ├── auth.js               # Gestion authentification + guards
│   │   ├── indexeddb-wrapper.js  # Abstraction IndexedDB
│   │   ├── utils.js              # Utilitaires (+ conversion devises)
│   │   ├── theme-manager.js      # Gestion thème dark/light/auto
│   │   ├── crypto-utils.js       # Utilitaires cryptographiques
│   │   └── models/               # Modèles de données
│   │       ├── base-model.js     # Modèle de base (CRUD)
│   │       ├── comptes-model.js
│   │       ├── categories-model.js
│   │       ├── payees-model.js
│   │       ├── type_depenses-model.js
│   │       ├── mouvements-model.js
│   │       └── recurrents-model.js
│   ├── components/        # Composants réutilisables
│   │   ├── header.js
│   │   ├── sidebar.js
│   │   ├── modals.js
│   │   ├── import-export.js
│   │   └── component-loader.js
│   └── pages/             # Contrôleurs de pages
│       ├── login.js
│       └── dashboard.js
└── manage/                # Pages de gestion
    ├── comptes.html
    ├── categories.html
    ├── beneficiaires.html
    ├── type_depenses.html
    ├── mouvements.html
    └── recurrents.html
```

### Capacités PWA
- **Installation** : Installable sur mobile/desktop depuis le navigateur
- **Offline** : Fonctionne entièrement hors ligne après première visite
- **Cache intelligent** : Service Worker avec stratégies de cache optimisées
- **Shortcuts** : Raccourcis rapides vers "Nouvelle dépense" et "Comptes"
- **Icônes adaptatives** : Support des icônes maskables pour Android
- **Notifications** : (Futur) Rappels pour dépenses récurrentes

---

## 3) Schéma IndexedDB

La base utilise **7 stores** (équivalent tables) avec **indexes** pour performances :

### Store `user`
- **Clé** : `code_acces` (string)
- **Usage** : Code d'accès à 4 chiffres (défaut: `1234`)

### Store `accounts`
- **Clé** : `id` (UUID)
- **Champs** : `nom_compte`, `balance`, `currency`, `is_principal`, `date_maj`
- **Index** : `name`, `principal`, `date_maj`
- **Devises** : EUR (balance en centimes), BTC (balance en satoshis)
- **Équivaut** : TABLE COMPTES (version PHP)

### Store `categories`
- **Clé** : `id` (UUID) 
- **Champs** : `libelle`, `is_mandatory`
- **Index** : `name`, `mandatory`
- **Équivaut** : TABLE CATEGORIES

### Store `payees`
- **Clé** : `id` (UUID)
- **Champs** : `libelle`
- **Index** : `name`  
- **Équivaut** : TABLE BENEFICIAIRES

### Store `expense_types`
- **Clé** : `id` (UUID)
- **Champs** : `libelle`, `is_default`
- **Index** : `name`, `default`
- **Équivaut** : TABLE TYPE_DEPENSES

### Store `transactions`
- **Clé** : `id` (UUID)
- **Champs** : `date_mouvement`, `amount`, `account_id`, `category_id`, `payee_id`, `expense_type_id`, `description`
- **Index** : `date`, `account_id`, `category_id`, `amount`, `date_account`
- **Équivaut** : TABLE MOUVEMENTS

### Store `recurring_expenses`
- **Clé** : `id` (UUID)
- **Champs** : `libelle`, `amount`, `account_id`, `day_of_month`, `frequency`, `is_active`, `date_maj`, `last_execution`
- **Index** : `account_id`, `active`, `day_month`, `date_maj`
- **Équivaut** : TABLE DEPENSES_FIXES

---

## 4) Données par défaut (seed)

L'application initialise automatiquement avec ces données de référence :

### Comptes (6 comptes par défaut)
1. **Compte Principal** (EUR, principal, 0€)
2. **Budget Sem. 1** (EUR, 200€)
3. **Budget Sem. 2** (EUR, 200€)
4. **Budget Sem. 3** (EUR, 200€)
5. **Budget Sem. 4** (EUR, 200€)
6. **Compte BTC** (BTC, 0 satoshi)

**Note :** Ordre d'affichage = compte principal en premier, puis par ordre alphabétique

### Catégories (15 suggestions)
1. Alimentation / Courses  
2. Logement (Loyer / Crédit)  
3. Charges / Énergie (Élec/Gaz/Eau)  
4. Internet / Téléphone  
5. Assurances  
6. Impôts / Taxes  
7. Transports (Carburant/TP)  
8. Santé (Médecin/Pharmacie/Mutuelle)  
9. Éducation / Garde  
10. Loisirs / Culture  
11. Vêtements  
12. Cadeaux / Fêtes  
13. Épargne / Placement  
14. Revenus (Salaire/Pension)  
15. Divers

### Bénéficiaires (≤ 20 suggestions)
Carrefour, Leclerc, Intermarché, Lidl, Amazon, SNCF, TotalEnergies, EDF, Engie, Orange, Free, SFR, GMF, MAIF, Ameli, Urssaf, Trésor Public, Pharmacie, Médecin, Propriétaire

### Types de dépenses (6)
1. Espèces  
2. Carte bancaire  
3. Virement  
4. Chèque  
5. Prélèvement automatique  
6. Autre

---

## 5) Gestion multi-devises

### Devises supportées
- **EUR (Euro)** - Devise par défaut, stockage en **centimes**
- **BTC (Bitcoin)** - Crypto-monnaie, stockage en **satoshis**

### Conversion et stockage
Les montants sont stockés dans IndexedDB selon l'unité minimale :
- **EUR :** 1€ = 100 centimes
- **BTC :** 1 BTC = 100 000 000 satoshis

### Utilitaires de conversion (`RatchouUtils.currency`)

```javascript
// Conversion vers unité de stockage
RatchouUtils.currency.toStorageUnit(1.5, 'EUR')    // → 150 centimes
RatchouUtils.currency.toStorageUnit(0.00000001, 'BTC')  // → 1 satoshi

// Conversion depuis unité de stockage
RatchouUtils.currency.fromStorageUnit(150, 'EUR')  // → 1.50 €
RatchouUtils.currency.fromStorageUnit(100000000, 'BTC')  // → 1.00000000 BTC

// Formatage avec symbole
RatchouUtils.currency.formatWithCurrency(150, 'EUR')  // → "1,50 €"
RatchouUtils.currency.formatWithCurrency(100000000, 'BTC')  // → "1,00000000 ₿"
```

### Précision d'affichage
- **EUR :** 2 décimales (ex: 1,50 €)
- **BTC :** 8 décimales (ex: 0,00000001 ₿)

### ⚠️ Migration importante
**Méthodes legacy (EUR uniquement) à éviter :**
```javascript
// ❌ Deprecated
RatchouUtils.currency.toCents(amount)
RatchouUtils.currency.toEuros(cents)

// ✅ Correct (multi-devises)
const currency = account.currency || 'EUR';
RatchouUtils.currency.toStorageUnit(amount, currency)
RatchouUtils.currency.fromStorageUnit(amount, currency)
```

---

## 6) Interface utilisateur

### Page de connexion (`index.html`)
- **Saisie** : Code d'accès 4 chiffres + nom d'appareil (premier démarrage)
- **Design** : Gradient moderne, logo Ratchou, responsive
- **Sécurité** : Guard automatique, redirection si déjà connecté
- **Device ID** : Génération automatique d'identifiant unique basé sur le nom d'appareil

### Tableau de bord (`dashboard.html`)
- **En-tête** : Solde du compte principal (cliquable pour correction) + menu hamburger
- **Formulaire rapide** : Ajout transaction (Montant, Catégorie, Bénéficiaire, Type, Description)
- **Historique** : 20 dernières transactions en temps réel
- **Traitement automatique** : Vérification dépenses récurrentes au démarrage

### Menu hamburger (navigation)
1. **COMPTES** — Gestion multi-comptes + multi-devises + désignation principal
2. **MOUVEMENTS** — Recherche, modification, suppression transactions
3. **CATÉGORIES** — CRUD + flag "dépense obligatoire"
4. **BÉNÉFICIAIRES** — CRUD bénéficiaires
5. **TYPES DE DÉPENSES** — CRUD types paiement
6. **DÉPENSES RÉCURRENTES** — CRUD + activation/désactivation
7. **PARAMÈTRES** — Configuration thème (dark/light/auto)
8. **Export/Import** — Export ZIP/JSON + fonctions de partage intégrées
9. **Changer code d'accès** — Modal sécurisée

---

## 7) API JavaScript (exemples d'usage)

### Initialisation de l'application
```javascript
// Démarrage principal
await ratchouApp.initialize();

// Authentification
const loginResult = await ratchouApp.login('1234');
if (loginResult.success) {
    location.replace('dashboard.html');
}
```

### Authentification avec guards et device ID
```javascript
// Pages application (nécessitent connexion)
if (window.auth && typeof window.auth.guardPage === 'function') {
    if (!auth.guardPage('app')) return;
}

// Page de connexion (redirige si déjà connecté)
if (window.auth && typeof window.auth.guardPage === 'function') {
    if (!auth.guardPage('login')) return;
}

// Gestion du device ID
const deviceId = RatchouUtils.device.setDeviceId('Mon-Ordinateur');
const currentDeviceId = RatchouUtils.device.getCurrentDeviceId();
```

### Manipulation des données
```javascript
// Récupération données dashboard
const dashboardData = await ratchouApp.getDashboardData();

// Travail avec les modèles
const categories = await ratchouApp.models.categories.getAll();

// Création transaction avec multi-devises
const account = await ratchouApp.models.accounts.getById('uuid-compte');
const currency = account.currency || 'EUR';
const amountInStorage = RatchouUtils.currency.toStorageUnit(-50.00, currency);

const newTransaction = await ratchouApp.models.transactions.create({
    amount: amountInStorage,  // -5000 centimes ou satoshis selon devise
    account_id: account.id,
    category_id: 'uuid-categorie',
    payee_id: 'uuid-beneficiaire',
    expense_type_id: 'uuid-type',
    description: 'Courses Carrefour'
});

// Export/Import avec formats multiples
const exportData = await ratchouApp.exportToJSON();
await ratchouApp.importFromJSON(jsonData, deviceId, accessCode);

// Export ZIP avec partage
import { exportDataAsZip, exportDataWithFormat } from './js/components/import-export.js';
const result = await exportDataAsZip((percent, message) => {
    console.log(`${percent}%: ${message}`);
});

// Import depuis ZIP
const importResult = await importData(file, onProgress, deviceId, accessCode);
```

### Gestion des comptes
```javascript
// Correction manuelle du solde (multi-devises)
const account = await ratchouApp.models.accounts.getById(accountId);
const currency = account.currency || 'EUR';
const newBalanceStorage = RatchouUtils.currency.toStorageUnit(newBalance, currency);
await ratchouApp.models.accounts.updateBalance(accountId, newBalanceStorage);

// Recalcul automatique
await ratchouApp.models.accounts.recalculateBalance(accountId);
```

### Gestion du thème
```javascript
// Configuration du thème
await ThemeManager.initialize();

// Changer le thème
ThemeManager.setTheme('dark');   // 'light', 'dark', ou 'auto'

// Obtenir le thème actuel
const currentTheme = ThemeManager.getCurrentTheme();  // Thème utilisateur
const effectiveTheme = ThemeManager.getEffectiveTheme();  // Thème appliqué
```

---

## 8) Installation et déploiement

### Prérequis
- **Serveur web** : Apache, Nginx ou serveur de développement
- **Navigateur moderne** : Support IndexedDB + Service Workers
- **HTTPS recommandé** : Pour installation PWA optimale

### Installation
1. **Cloner le projet** dans le répertoire web
2. **Servir les fichiers** via serveur web (pas d'accès file://)
3. **Première visite** : L'app initialise automatiquement IndexedDB
4. **Installation PWA** : Bannière d'installation apparaît automatiquement

### Configuration
- **Premier démarrage** : Choix libre du code d'accès + nom d'appareil
- **Base de données** : Auto-créée au premier lancement
- **Données seed** : Chargées automatiquement si DB vide
- **Device ID** : Généré automatiquement à partir du nom d'appareil
- **Version cache** : À incrémenter dans `sw.js` à chaque mise à jour

### Mise à jour
1. **Modifier le code** selon besoins
2. **Incrémenter `APP_VERSION`** dans `sw.js`
3. **Déployer** : Le Service Worker gère la mise à jour automatique
4. **Utilisateurs** : Rechargement automatique des nouveaux fichiers

---

## 9) Fonctionnalités avancées

### Dépenses récurrentes automatiques
- **Vérification au démarrage** : Contrôle des échéances dues
- **Génération automatique** : Création des mouvements manquants
- **Gestion fin de mois** : Report intelligent (29/30/31 → dernier jour)
- **Historique** : Tracking via `last_execution`

### Export/Import avancé
- **Formats multiples** : JSON simple ou ZIP compressé avec README
- **Nommage intelligent** : `ratchou-{device_id}-{aaammjjhhmm}.{ext}`
- **Import universel** : Support JSON et ZIP automatique
- **Partage intégré** : Gmail, WhatsApp, Web Share API, copie instructions
- **Métadonnées** : Tracking automatique des sauvegardes

### Correction de solde
- **Solde cliquable** : Modal de correction rapide
- **Multi-devises** : Respect de la devise du compte
- **Recalcul intelligent** : Intègre nouveaux mouvements post-correction
- **Historique** : Traçabilité des corrections manuelles

### Thème adaptatif
- **3 modes** : Light, Dark, Auto (détection système)
- **Bootstrap natif** : Utilise `data-bs-theme="dark"`
- **Persistance** : Stockage localStorage
- **Détection système** : Media query `prefers-color-scheme`
- **Configuration** : Interface dans Paramètres

---

## 10) Sécurité & confidentialité

### 🔒 Principes de sécurité
- **100% local** : Aucune donnée transmise à un serveur
- **Zéro tracking** : Pas de CDN, analytics ou ressources externes  
- **Chiffrement recommandé** : Stockage sur disque/partition chiffrée
- **Isolation** : Données confinées au domaine d'origine
- **Code ouvert** : Audit possible du code JavaScript

### 🛡️ Recommandations utilisateur
- **Compte séparé** : Utilisateur dédié sur l'ordinateur
- **Chiffrement disque** : FileVault, BitLocker, VeraCrypt
- **Sauvegarde** : Export JSON régulier hors ligne

### 🔐 Recommandations déploiement
- **HTTPS obligatoire** : Certificat SSL/TLS
- **Headers sécurisés** : CSP, HSTS, X-Frame-Options
- **Pas de logs** : Éviter logging des requêtes
- **Serveur minimal** : Serveur de fichiers statiques uniquement

---

## 11) Évolution et développement

### Architecture modulaire
- **Modèles** : `js/core/models/` - Logique métier et CRUD
- **Composants** : `js/components/` - Éléments UI réutilisables  
- **Pages** : `js/pages/` - Contrôleurs de pages
- **Core** : `js/core/` - Services fondamentaux

### Extensibilité
- **Nouveaux stores** : Ajout facile via `indexeddb-wrapper.js`
- **Composants** : Architecture modulaire pour réutilisabilité
- **Thèmes** : CSS custom par-dessus Bootstrap
- **Plugins** : Système de chargement dynamique

### Roadmap
- **Traduction** : Mise en place système de traduction
- **Notifications push** : Rappels dépenses récurrentes
- **Synchronisation** : Multi-appareils via serveur optionnel
- **Analyse** : Graphiques de dépenses et tendances
- **Catégories avancées** : Sous-catégories et budgets
- **Devises supplémentaires** : USD, GBP, etc.

### Bonnes pratiques développement
1. **Multi-devises obligatoire** : Toujours utiliser `toStorageUnit()` / `fromStorageUnit()` avec paramètre `currency`
2. **Éviter méthodes legacy** : Ne plus utiliser `toCents()` / `toEuros()`
3. **Booléens → Numériques** : Utiliser 0/1 pour les champs indexés IndexedDB
4. **Thème adaptatif** : Utiliser variables CSS Bootstrap (`--bs-*`)
5. **Guards centralisés** : Authentification via `auth.guardPage()`

---

## 12) Partage

### Partage entre appareils

**Export pour partage**
- **Format ZIP recommandé** : Compression + README automatique
- **Nommage intelligent** : `ratchou-{device}-{date}.zip`
- **Instructions incluses** : Guide d'import dans le fichier README.txt

**Méthodes de partage intégrées**
- **📧 Gmail** : Template pré-rempli avec instructions
- **💬 WhatsApp** : Message formaté avec guide d'import  
- **📱 Web Share** : Partage natif mobile (Android/iOS)
- **📋 Copie** : Instructions dans le presse-papiers
- **💾 Téléchargement** : Fichier local pour transfert manuel

**Réception et import**
1. **Formats supportés** : `.json` et `.zip` détectés automatiquement
2. **Configuration requise** : Nouveau code d'accès + nom d'appareil
3. **Remplacement complet** : Les données existantes sont écrasées
4. **Vérification** : Intégrité contrôlée après import

---

**Ratchou PWA** — Gestion familiale moderne, privée et 100% offline 🚀