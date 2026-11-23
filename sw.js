/* Service worker : permet de jouer sans réseau une fois la page ouverte
   une première fois, tout en récupérant les mises à jour quand il y a du
   réseau (réseau d'abord, cache en secours). Ainsi, une modification de
   salles.json est prise en compte dès que l'élève a de la connexion. */

var CACHE = 'lea-laprel-public-v21';
var FICHIERS = [
  './',
  './index.html',
  './style.css',
  './jeu.js',
  './avis.js',
  './etapes.json',
  './reglement.html',
  './questionnaire.html',
  './questionnaire.js',
  './questionnaire.css',
  './questionnaire.json',
  './manifest.webmanifest',
  './icone-192.png',
  './icone-512.png',
  './icone-180.png',
  './images/lieu-00-h.webp',
  './images/lieu-00-v.webp',
  './images/lieu-01-h.webp',
  './images/lieu-01-v.webp',
  './images/lieu-02-h.webp',
  './images/lieu-02-v.webp',
  './images/lieu-03-h.webp',
  './images/lieu-03-v.webp',
  './images/lieu-04-h.webp',
  './images/lieu-04-v.webp',
  './images/lieu-05-h.webp',
  './images/lieu-05-v.webp',
  './images/lieu-05b-h.webp',
  './images/lieu-05b-v.webp',
  './images/lieu-06-h.webp',
  './images/lieu-06-v.webp',
  './images/lieu-07-h.webp',
  './images/lieu-07-v.webp',
  './images/lieu-08-h.webp',
  './images/lieu-08-v.webp',
  './images/lieu-09-h.webp',
  './images/lieu-09-v.webp',
  './images/lieu-10-h.webp',
  './images/lieu-10-v.webp',
  './images/lieu-11-h.webp',
  './images/lieu-11-v.webp',
  './images/lieu-12-h.webp',
  './images/lieu-12-v.webp',
  './images/lieu-13-h.webp',
  './images/lieu-13-v.webp',
  './images/lieu-14-h.webp',
  './images/lieu-14-v.webp',
  './images/lieu-15-h.webp',
  './images/lieu-15-v.webp'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(FICHIERS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (noms) {
        return Promise.all(noms.map(function (n) {
          return n === CACHE ? null : caches.delete(n);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(function (reponse) {
        var copie = reponse.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copie); });
        return reponse;
      })
      .catch(function () {
        return caches.match(e.request).then(function (r) {
          return r || caches.match('./index.html');
        });
      })
  );
});
