/* L'encart des avis — un seul composant pour les trois modes.
 *
 * Le grand public le voit après la révélation, la classe aussi (dans
 * une version écrite pour des élèves), et le questionnaire du lecteur
 * après son bouton d'envoi. Trois pages, trois moteurs, mais UNE seule
 * place où vivent les adresses et les mots : une adresse recopiée à
 * trois endroits finit toujours par diverger de deux d'entre eux.
 *
 * CE QUI EST VOULU, ET QU'IL NE FAUT PAS « CORRIGER » :
 *   — l'encart vient APRÈS ce qui précède (le concours, l'envoi du
 *     courriel), séparé par un filet, jamais dans le même cadre : les
 *     règles d'Amazon interdisent de lier un avis à un gain, et un avis
 *     échangé contre quelque chose ne vaut rien ;
 *   — côté public, une ligne dit en toutes lettres que l'avis n'a aucun
 *     lien avec le jeu concours ;
 *   — côté classe, Babelio vient en premier : c'est gratuit, c'est un
 *     réseau de lecteurs, et un élève de quinze ans n'a pas de compte
 *     Amazon ;
 *   — hors connexion (le fichier de l'ENT, ouvert depuis une clé USB),
 *     les liens restent cliquables mais on prévient qu'il faudra du
 *     réseau : un lien grisé ne s'explique pas, une phrase si.
 *
 * Usage : window.LV_AVIS.encart(el, 'public' | 'eleves')
 * où `el` est la fabrique de nœuds de la page appelante — les deux en
 * ont une, de même signature, et on ne va pas en écrire une troisième.
 */
(function () {
  'use strict';

  var LIENS = {
    amazon: 'https://www.amazon.fr/review/create-review?asin=B0HND5PBXK',
    /* Si l'application Amazon détourne le lien ci-dessus et dépose le
       lecteur sur l'accueil, remplacez-le par celui-ci : la fiche du
       livre, d'où l'on écrit aussi un avis. */
    amazonSecours: 'https://www.amazon.fr/dp/B0HND5PBXK',
    babelio: 'https://www.babelio.com/livres/Cardon-Les-demons-de-Lea-Laprel/2156936'
  };

  var LIBELLES = {
    amazon: 'Laisser un avis sur Amazon',
    babelio: 'Laisser un avis sur Babelio'
  };

  var TEXTES = {
    public: {
      titre: 'Vous avez aimé le roman ?',
      texte: 'Un avis, même de deux lignes, aide beaucoup un auteur indépendant à faire connaître son livre. Une note en étoiles suffit.',
      ordre: ['amazon', 'babelio'],
      comptes: 'Sur Amazon, il faut être connecté à son compte. Sur Babelio, il suffit d’un compte gratuit, puis de toucher « Contribuer » et « Publier une critique ».'
    },
    eleves: {
      titre: 'Vous avez aimé l’histoire de Léa ?',
      texte: 'Vous pouvez partager votre avis sur Babelio, le réseau social des lecteurs, ou en parler autour de vous.',
      ordre: ['babelio', 'amazon'],
      notes: { amazon: '(compte Amazon nécessaire)' }
    }
  };

  var HORS_LIGNE = '(connexion internet nécessaire)';

  function horsLigne() {
    try { return window.location.protocol === 'file:'; } catch (e) { return false; }
  }

  function encart(el, mode) {
    var t = TEXTES[mode] || TEXTES.public;
    var sansReseau = horsLigne();
    var bloc = el('aside', { class: 'encart-avis' }, [
      el('p', { class: 'encart-titre', texte: t.titre }),
      el('p', { texte: t.texte })
    ]);

    t.ordre.forEach(function (quoi) {
      var note = (t.notes || {})[quoi];
      bloc.appendChild(el('a', {
        class: 'lien-avis', href: LIENS[quoi], target: '_blank', rel: 'noopener',
        texte: '→ ' + LIBELLES[quoi] + (note ? ' ' + note : '')
      }));
    });

    if (sansReseau) {
      bloc.appendChild(el('p', { class: 'petite', texte: HORS_LIGNE }));
    } else if (t.comptes) {
      bloc.appendChild(el('p', { class: 'petite', texte: t.comptes }));
    }
    return bloc;
  }

  window.LV_AVIS = { liens: LIENS, libelles: LIBELLES, textes: TEXTES, encart: encart };
})();
