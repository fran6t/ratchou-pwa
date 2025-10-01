/* 
 * Service Worker Ratchou (version commentée pour débutant)
 * --------------------------------------------------------
 * Objectif : faire fonctionner l'app 100% hors-ligne et gérer les mises à jour.
 * Idées clés :
 * 1) On versionne les caches avec APP_VERSION -> à chaque changement, on recrée des caches.
 * 2) On précache le minimum pour démarrer hors-ligne (HTML, CSS, JS de base, manifest, icônes).
 * 3) On intercepte les navigations HTML et on renvoie un "fallback" (index.html) en cas d'offline.
 * 4) On isole les requêtes non-GET (POST/PUT/DELETE) -> le SW ne les gère pas.
 * 5) On active navigationPreload pour accélérer le premier chargement.
 * 1.0.1 Corriger la persistance des sélections dans les panels du formulaire rapide…)
 */

// 1) VERSIONNAGE : incrémente APP_VERSION à chaque release
const APP_VERSION = '1.0.2'; // <- augmente ce nombre quand tu déploies une nouvelle version

// ⚠️ IMPORTANT : CHEMINS PWA À SYNCHRONISER MANUELLEMENT
// Les chemins sont définis dans js/pwa/install.js lignes 20-21
// DEV:  swPath = '/ratchou/sw.js'  | scopePath = '/ratchou/'
// PROD: swPath = '/sw.js'          | scopePath = '/'
// ⚠️ NE PAS OUBLIER DE METTRE À JOUR LES DEUX FICHIERS !

// 2) Noms de caches basés sur la version (important pour invalider l'ancien cache)
const STATIC_CACHE = `ratchou-static-${APP_VERSION}`;
const DYNAMIC_CACHE = `ratchou-dyn-${APP_VERSION}`;

// 3) Fichiers à précacher (minimum viable).
//    ⚠️ Mets uniquement des fichiers qui existent VRAIMENT et qui sont communs à toutes les pages.
// START:STATIC_FILES
const STATIC_FILES = [
  './assets/css/app.css',
  './assets/css/bootstrap-icons.min.css',
  './assets/css/bootstrap.min.css',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/js/bootstrap.bundle.min.js',
  './dashboard.html',
  './index.html',
  './js/components/backup-reminder.js',
  './js/components/component-loader.js',
  './js/components/fixed-footer.js',
  './js/components/header.js',
  './js/components/import-export.js',
  './js/components/modals.js',
  './js/components/sidebar.js',
  './js/core/auth.js',
  './js/core/crypto-utils.js',
  './js/core/indexeddb-wrapper.js',
  './js/core/models/base-model.js',
  './js/core/models/beneficiaires-model.js',
  './js/core/models/categories-model.js',
  './js/core/models/comptes-model.js',
  './js/core/models/mouvements-model.js',
  './js/core/models/recurrents-model.js',
  './js/core/models/type_depenses-model.js',
  './js/core/private-mode-detector.js',
  './js/core/ratchou-app.js',
  './js/core/theme-manager.js',
  './js/core/utils.js',
  './js/lib/jszip.min.js',
  './js/pages/accounts.js',
  './js/pages/beneficiaires.js',
  './js/pages/categories.js',
  './js/pages/dashboard.js',
  './js/pages/export.js',
  './js/pages/main-controller.js',
  './js/pages/mouvements.js',
  './js/pages/parametres.js',
  './js/pages/projection.js',
  './js/pages/pwa.js',
  './js/pages/recurrents.js',
  './js/pages/type_depenses.js',
  './js/pwa/install.js',
  './js/pwa/persistence.js',
  './manage/beneficiaires.html',
  './manage/categories.html',
  './manage/comptes.html',
  './manage/export.html',
  './manage/mouvements.html',
  './manage/parametres.html',
  './manage/projection.html',
  './manage/pwa.html',
  './manage/recurrents.html',
  './manage/type_depenses.html',
  './manifest.json',
  './persistence-required.html',
  './sw.js',

];
// END:STATIC_FILES

// INSTALLATION : on crée/alimente le cache statique
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // "cache: 'reload'" force le navigateur à re-télécharger ces fichiers (évite d'anciennes versions)
    await cache.addAll(STATIC_FILES.map(u => new Request(u, { cache: 'reload' })));
    // Ne pas faire skipWaiting() automatiquement - attendre la demande explicite de l'utilisateur
    console.log('[SW] Installation terminée, en attente de l\'autorisation utilisateur pour l\'activation');
  })());
});

// ACTIVATION : on nettoie les anciens caches + on accélère les navigations avec navigationPreload
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Active la "pré-chargement" des navigations si dispo (le navigateur fait la requête réseau en parallèle)
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }

    // On supprime tous les caches qui ne correspondent pas à la version courante
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => ![STATIC_CACHE, DYNAMIC_CACHE].includes(k)).map(k => caches.delete(k))
    );

    // Prend le contrôle immédiatement des pages ouvertes
    await self.clients.claim();
  })());
});

// FETCH : intercepte les requêtes réseau
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1) NAVIGATIONS HTML (quand on ouvre/charge une page). 
  //    But : si le réseau est coupé, renvoyer index.html depuis le cache pour ne pas avoir "Vous êtes hors connexion".
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // Si navigationPreload est actif, on récupère sa réponse (sinon on fait un fetch normal)
        const preload = await event.preloadResponse;
        const response = preload || await fetch(request);
        // On met la page en cache dynamique pour les prochains coups
        const dyn = await caches.open(DYNAMIC_CACHE);
        dyn.put(request, response.clone());
        return response;
      } catch (err) {
        // Réseau KO -> on tente d'abord de trouver la page demandée dans le cache
        const cached = await caches.match(request);
        if (cached) return cached;
        // Sinon: fallback sur index.html (doit être dans STATIC_FILES)
        return caches.match('./index.html');
      }
    })());
    return; // on ne descend pas plus bas
  }

  // 2) NE PAS INTERCEPTER LES REQUÊTES NON-GET (POST/PUT/DELETE). 
  //    Important pour éviter les effets indésirables.
  if (request.method !== 'GET') return;

  // 3) Pour le reste (CSS/JS/images/global) -> "cache-first", puis réseau si manquant.
  event.respondWith((async () => {
    // a) si c'est déjà en cache (static/dynamic), on renvoie direct
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      // b) sinon on tente le réseau
      const res = await fetch(request);
      // On ne met en cache que des réponses valides
      if (res && res.status === 200 && (res.type === 'basic' || res.type === 'opaque')) {
        const dyn = await caches.open(DYNAMIC_CACHE);
        dyn.put(request, res.clone());
      }
      return res;
    } catch (err) {
      // c) Le réseau échoue (offline)
      // si c'est une image, renvoyer une icône par défaut
      if (request.destination === 'image') {
        const fallbackImg = await caches.match('./assets/icons/icon-192.png');
        if (fallbackImg) return fallbackImg;
      }
      // sinon, renvoyer un 504 "Offline" vide
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});

// COMMUNICATION : permet au script de page de demander au SW d'activer la nouvelle version immédiatement
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Demande de mise à jour reçue de l\'utilisateur, activation en cours...');
    self.skipWaiting();
  }
});

/* 
 * NOTES POUR DÉBUTANT
 * -------------------
 * - APP_VERSION : change ce numéro à chaque déploiement (ex: '1.0.1', '1.0.2', ...).
 *   -> le nom des caches change -> l'ancien cache est supprimé dans 'activate' -> les nouveaux fichiers sont pris en compte.
 * - STATIC_FILES : commence minimal (index.html + CSS/JS cœur). Rajoute au fur et à mesure si nécessaire.
 * - navigate fallback : si le téléphone est en mode avion, l'app démarre quand même car 'index.html' est renvoyé depuis le cache.
 * - navigationPreload : accélère la 1ère navigation en permettant au navigateur de faire la requête réseau pendant que le SW se réveille.
 * - Non-GET : le SW ne s'occupe pas des POST/PUT/DELETE pour éviter d'endommager la logique applicative.
 */
