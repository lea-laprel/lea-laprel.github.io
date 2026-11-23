/* Le questionnaire du lecteur — Les Démons de Léa Laprel.
 *
 * Soixante questions, quatre par chapitre, à répondre au fil de la
 * lecture. Une note sur vingt, une mention, un diplôme, et — si le
 * lecteur le veut — un mot pour l'auteur.
 *
 * POURQUOI UNE PAGE À PART. L'escape game est un jeu d'équipe, avec des
 * salles, des lettres et un chronomètre ; ceci est un examen qu'on passe
 * seul, chapitre après chapitre, en reposant le livre. Deux rythmes, deux
 * moteurs. Les mêler aurait alourdi l'un et brouillé l'autre. La page
 * partage en revanche la feuille de style du site, sa porte et son
 * vocabulaire.
 *
 * CE QUI EST VOULU, ET QU'IL NE FAUT PAS « CORRIGER » :
 *   — un chapitre ne s'ouvre qu'une fois le précédent terminé : on ne
 *     répond pas à des questions sur un chapitre qu'on n'a pas lu ;
 *   — une seule tentative par question, et la correction vient APRÈS le
 *     chapitre, jamais pendant : sinon on devine en deux essais ;
 *   — les propositions sont mélangées, avec une graine propre au lecteur,
 *     stable d'une séance à l'autre : son ordre ne doit pas bouger sous
 *     ses yeux entre deux visites ;
 *   — rien n'est envoyé nulle part. Le courriel part de la messagerie du
 *     lecteur, qui peut tout relire et tout modifier avant d'envoyer ;
 *   — l'encart « laisser un avis » vient APRÈS l'envoi, séparé, et ne
 *     promet rien en échange : les règles d'Amazon l'exigent, et
 *     l'honnêteté aussi.
 */
(function () {
  'use strict';

  var CLE = 'lea-laprel-questionnaire.v1';
  var ALPHABET32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  var COURRIEL = 'lesdemonsdelealaprel@gmail.com';

  var qcm = null, etat = null;
  var scene = document.getElementById('scene');

  /* ------------------------------------------------------- petit DOM --- */

  function el(nom, attributs, enfants) {
    var n = document.createElement(nom), k;
    attributs = attributs || {};
    for (k in attributs) {
      if (!Object.prototype.hasOwnProperty.call(attributs, k)) continue;
      var v = attributs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'texte') n.textContent = v;
      else if (k === 'onclick') n.addEventListener('click', v);
      else if (k === 'oninput') n.addEventListener('input', v);
      else if (k === 'class') n.className = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    (enfants || []).forEach(function (e) { if (e) n.appendChild(e); });
    return n;
  }
  function vider(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function annoncer(t) { var z = document.getElementById('annonces'); if (z) z.textContent = t; }
  function montrer(noeud) {
    vider(scene);
    scene.appendChild(noeud);
    majBandeau();
    var t = noeud.querySelector('h2');
    if (t) t.focus();
    if (window.scrollTo) window.scrollTo(0, 0);
    brancherEntree(noeud);
  }

  /* La touche Entrée valide partout où il y a un champ : taper Entrée,
     c'est presser le bouton qui valide. Les champs qui s'en chargent
     déjà portent data-entree et sont laissés tranquilles. */
  var VALIDE = /^(Valider|Entrer|Reprendre|Continuer|Envoyer)/;
  function brancherEntree(noeud) {
    if (!noeud || !noeud.addEventListener) return;
    noeud.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' || ev.defaultPrevented) return;
      var cible = ev.target;
      if (!cible || cible.tagName !== 'INPUT') return;
      if (cible.type && cible.type !== 'text' && cible.type !== 'search') return;
      if (cible.getAttribute('data-entree')) return;
      var boutons = noeud.querySelectorAll('button');
      for (var i = 0; i < boutons.length; i++) {
        if (boutons[i].disabled) continue;
        if (VALIDE.test(boutons[i].textContent.trim())) {
          ev.preventDefault();
          boutons[i].click();
          return;
        }
      }
    });
  }

  /* --------------------------------------------------------- l'état --- */

  /* Tout tient sur l'appareil, dans un seul objet. Les réponses sont
     rangées par NUMÉRO DE CHAPITRE, et chaque réponse est l'indice de la
     proposition choisie DANS L'ORDRE DU FICHIER — l'ordre affiché change
     d'un lecteur à l'autre, celui du fichier ne bouge pas. */
  function etatNeuf() {
    return { version: 1, signature: signature(), graine: nouvelleGraine(),
      reponses: {}, repris: {}, prenom: '', ville: '', etoiles: 0, avis: '' };
  }
  function signature() {
    return 'q1|' + (qcm.chapitres || []).length + '|' +
      (qcm.chapitres || []).reduce(function (n, c) { return n + c.questions.length; }, 0);
  }
  /* Combien de questions ont reçu une réponse ? C'est la mesure de ce
     qu'on ne veut pas perdre : elle ne fait que monter. */
  function avancement(e) {
    if (!e || !e.reponses) return -1;
    var n = 0, k;
    for (k in e.reponses) {
      if (!Object.prototype.hasOwnProperty.call(e.reponses, k)) continue;
      (e.reponses[k] || []).forEach(function (x) {
        if (x !== null && x !== undefined && x >= 0) n++;
      });
    }
    return n;
  }

  /* Deux onglets sur le questionnaire, c'est vite arrivé. L'onglet
     oublié effaçait le travail de l'autre, et redonnait même une
     tentative sur un chapitre déjà joué. On relit donc avant d'écrire,
     et on s'abstient si l'autre a répondu à davantage de questions.
     `force` est réservé aux retours en arrière voulus : tout
     recommencer, ou appliquer un code de reprise. */
  /* Un navigateur qui refuse d'enregistrer ne plante pas le
     questionnaire : il le fait simplement disparaître au premier
     rechargement. On le dit, une fois. */
  var stockageSignale = false;
  function signalerStockageRefuse() {
    if (stockageSignale) return;
    stockageSignale = true;
    var z = document.getElementById('avertissements');
    if (!z) return;
    vider(z);
    z.hidden = false;
    z.className = 'bandeau bandeau-alerte';
    z.appendChild(el('strong', { texte: 'Votre navigateur bloque l’enregistrement : ' }));
    z.appendChild(document.createTextNode('vos réponses ne seront pas conservées si vous quittez la page.'));
    annoncer('Votre navigateur bloque l’enregistrement : vos réponses ne seront pas conservées si vous quittez la page.');
  }

  function sauver(force) {
    try {
      if (force !== true) {
        var surDisque = charger();
        if (surDisque && avancement(surDisque) > avancement(etat)) return;
      }
      window.localStorage.setItem(CLE, JSON.stringify(etat));
    } catch (e) { signalerStockageRefuse(); }
  }
  /* Les réponses sont rangées par NUMÉRO de chapitre, pas par rang :
     une question corrigée, un chapitre ajouté, et tout le reste garde
     son sens. On migre donc au lieu de jeter — on ne garde que les
     chapitres qui existent encore et dont le nombre de questions n'a
     pas bougé, et on dit combien ont dû être abandonnés. */
  var chapitresPerdus = 0;
  function charger() {
    try {
      var b = window.localStorage.getItem(CLE);
      if (!b) return null;
      var l = JSON.parse(b);
      if (!l || !l.reponses) return null;
      if (l.signature === signature()) return l;
      return migrer(l);
    } catch (e) { signalerStockageRefuse(); return null; }
  }

  function migrer(ancien) {
    var garde = {}, repris = {}, perdus = 0;
    (qcm.chapitres || []).forEach(function (c) {
      var cle = String(c.numero);
      var r = ancien.reponses[cle];
      if (!r) return;
      if (r.length !== c.questions.length) { perdus++; return; }
      garde[cle] = r;
      if ((ancien.repris || {})[cle]) repris[cle] = true;
    });
    Object.keys(ancien.reponses).forEach(function (cle) {
      if (!garde[cle] && !(qcm.chapitres || []).some(function (c) { return String(c.numero) === cle; })) perdus++;
    });
    chapitresPerdus = perdus;
    ancien.reponses = garde;
    ancien.repris = repris;
    ancien.signature = signature();
    return ancien;
  }
  function effacer() { try { window.localStorage.removeItem(CLE); } catch (e) {} }

  /* ------------------------------------------- hasard et mélange ------ */

  function nouvelleGraine() {
    var n = 0;
    try {
      if (window.crypto && window.crypto.getRandomValues) {
        var t = new Uint32Array(1); window.crypto.getRandomValues(t); n = t[0];
      }
    } catch (e) {}
    if (!n) n = (new Date().getTime() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    return (n % 4095) + 1;
  }
  function graine(t) {
    var h = 2166136261, i;
    for (i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }
  function generateur(g) {
    var a = g >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* L'ordre d'affichage des propositions. Il dépend du lecteur (sa
     graine) et de la question : deux lecteurs voisins n'ont pas la bonne
     réponse au même rang, et le même lecteur retrouve le même ordre en
     revenant. On renvoie des INDICES, pour pouvoir noter ce qui a été
     choisi dans l'ordre du fichier. */
  function ordreAffichage(chapitre, rang, nombre) {
    var t = [], i;
    for (i = 0; i < nombre; i++) t.push(i);
    var r = generateur(graine('q|' + chapitre + '|' + rang + '|' + etat.graine));
    for (i = nombre - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var x = t[i]; t[i] = t[j]; t[j] = x;
    }
    return t;
  }

  /* ------------------------------------------------- l'avancement ----- */

  function chapitre(n) {
    var l = qcm.chapitres || [];
    for (var i = 0; i < l.length; i++) if (l[i].numero === n) return l[i];
    return null;
  }
  function reponsesDe(n) { return (etat.reponses || {})[String(n)] || null; }
  function chapitreFait(n) {
    var r = reponsesDe(n);
    if (!r) return false;
    for (var i = 0; i < r.length; i++) if (r[i] === null || r[i] === undefined || r[i] < 0) return false;
    return true;
  }
  function scoreDe(n) {
    var r = reponsesDe(n), ch = chapitre(n), bons = 0;
    if (!r || !ch) return 0;
    ch.questions.forEach(function (q, i) {
      if (r[i] !== undefined && r[i] !== null && q.options[r[i]] === q.reponse) bons++;
    });
    return bons;
  }
  function chapitreOuvert(n) {
    if (n <= 1) return true;
    return chapitreFait(n - 1);
  }
  function premierNonFait() {
    var l = qcm.chapitres || [];
    for (var i = 0; i < l.length; i++) if (!chapitreFait(l[i].numero)) return l[i].numero;
    return 0;
  }
  function totalBons() {
    return (qcm.chapitres || []).reduce(function (t, c) { return t + scoreDe(c.numero); }, 0);
  }
  function totalQuestions() {
    return (qcm.chapitres || []).reduce(function (t, c) { return t + c.questions.length; }, 0);
  }
  function toutFini() { return premierNonFait() === 0; }

  function note() {
    var n = totalBons() / totalQuestions() * 20;
    return Math.round(n * 2) / 2;      /* au demi-point */
  }
  function noteEcrite(n) {
    return String(n).replace('.', ',');
  }
  function mention() {
    var m = qcm.mentions || [], n = note();
    for (var i = 0; i < m.length; i++) if (n <= m[i].jusqua) return m[i];
    return m[m.length - 1] || { nom: '', phrase: '' };
  }

  function majBandeau() {
    var compte = document.getElementById('compte-score');
    var jauge = document.getElementById('jauge');
    var barre = document.getElementById('jauge-barre');
    if (!compte || !jauge || !barre) return;
    var faits = (qcm.chapitres || []).filter(function (c) { return chapitreFait(c.numero); }).length;
    var montrerJauge = faits > 0;
    compte.hidden = !montrerJauge;
    jauge.hidden = !montrerJauge;
    if (!montrerJauge) return;
    compte.textContent = totalBons() + ' / ' + totalQuestions();
    barre.style.width = Math.round(faits / (qcm.chapitres || []).length * 100) + '%';
    jauge.setAttribute('role', 'progressbar');
    jauge.setAttribute('aria-valuemin', '0');
    jauge.setAttribute('aria-valuemax', String((qcm.chapitres || []).length));
    jauge.setAttribute('aria-valuenow', String(faits));
    jauge.setAttribute('aria-label', faits + ' chapitre(s) sur ' + (qcm.chapitres || []).length);
  }

  /* --------------------------------------------- le code de reprise --- */

  /* Neuf caractères qui portent l'essentiel : pour chacun des quinze
     chapitres, un chiffre de 0 à 5 — 0 s'il n'est pas fait, sinon le
     score plus un. Quinze chiffres en base six tiennent sur trente-neuf
     bits, donc huit caractères, plus une clé qui attrape les fautes de
     recopie. Le code ne porte PAS le détail de chaque réponse : il
     rapporte les scores, pas les corrections.
     On évite I, L, O et U à l'affichage — une fiche se recopie à la
     main, souvent mal. */
  /* DEUX caractères de contrôle : la première clé, pondérée par le
     rang, attrape l'inversion de deux lettres voisines ; la seconde,
     pondérée par les puissances de trois, attrape toute lettre fausse.
     Une seule clé laissait passer des codes faux, et le questionnaire
     inventait alors des scores. (Même recette que le code d'équipe du
     jeu : si l'une change, l'autre doit changer avec elle.) */
  function cleDe(corps) {
    var s1 = 0, s2 = 0, poids = 1, i;
    for (i = 0; i < corps.length; i++) {
      var v = ALPHABET32.indexOf(corps.charAt(i));
      s1 += v * (i + 1);
      poids = (poids * 3) % 32;
      s2 += v * poids;
    }
    return ALPHABET32.charAt(s1 % 32) + ALPHABET32.charAt(s2 % 32);
  }
  function codeReprise() {
    var l = qcm.chapitres || [], valeur = 0, i;
    for (i = l.length - 1; i >= 0; i--) {
      var n = l[i].numero;
      valeur = valeur * 6 + (chapitreFait(n) ? scoreDe(n) + 1 : 0);
    }
    var corps = '';
    for (i = 0; i < 8; i++) {
      corps = ALPHABET32.charAt(valeur % 32) + corps;
      valeur = Math.floor(valeur / 32);
    }
    return corps + cleDe(corps);
  }
  function lireCodeReprise(saisi) {
    var s = String(saisi || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
      .replace(/I/g, '1').replace(/L/g, '1').replace(/O/g, '0').replace(/U/g, 'V');
    if (s.length !== 10) return { erreur: 'forme' };
    var corps = s.slice(0, 8);
    for (var i = 0; i < 8; i++) if (ALPHABET32.indexOf(corps.charAt(i)) === -1) return { erreur: 'forme' };
    if (cleDe(corps) !== s.slice(8)) return { erreur: 'cle' };
    var valeur = 0;
    for (i = 0; i < 8; i++) valeur = valeur * 32 + ALPHABET32.indexOf(corps.charAt(i));
    var l = qcm.chapitres || [], scores = {}, fini = false;
    for (i = 0; i < l.length; i++) {
      var d = valeur % 6;
      valeur = Math.floor(valeur / 6);
      /* COHÉRENCE : on lit les chapitres dans l'ordre, et un chapitre
         fait après un chapitre qui ne l'est pas n'existe pas — le
         questionnaire ne s'ouvre que de proche en proche. Un code qui
         le prétend est fabriqué, ou mal recopié. */
      if (d > 0) {
        if (fini) return { erreur: 'incoherent' };
        if (d - 1 > l[i].questions.length) return { erreur: 'incoherent' };
        scores[l[i].numero] = d - 1;
      } else fini = true;
    }
    if (valeur !== 0) return { erreur: 'incoherent' };   /* des bits en trop */
    return { scores: scores };
  }
  /* Appliquer un code : on ne connaît que les scores, pas les réponses.
     On reconstitue donc des réponses « plausibles » — les bonnes pour le
     nombre de points obtenus, les premières fausses pour le reste. Le
     total et la note sont exacts ; le détail des corrections passées,
     lui, est perdu, et on le dit au lecteur. */
  /* Un code REMPLACE le questionnaire de l'appareil, il ne s'y ajoute
     pas : l'ancienne version fusionnait, et une faute de recopie
     laissait des chapitres fantômes que même le bon code ne pouvait
     plus effacer.
     Les chapitres ainsi retrouvés sont MARQUÉS : le code ne porte que
     des scores, pas les réponses. On garde donc le compte juste, mais
     on n'ira pas montrer une correction que personne n'a passée. */
  function appliquerCodeReprise(scores) {
    var n = 0;
    etat.reponses = {};
    etat.repris = {};
    (qcm.chapitres || []).forEach(function (c) {
      var s = scores[c.numero];
      if (s === undefined) return;
      n++;
      var r = [];
      c.questions.forEach(function (q, i) {
        var bonne = q.options.indexOf(q.reponse);
        if (i < s) { r.push(bonne); return; }
        var faux = 0;
        for (var k = 0; k < q.options.length; k++) if (k !== bonne) { faux = k; break; }
        r.push(faux);
      });
      etat.reponses[String(c.numero)] = r;
      etat.repris[String(c.numero)] = true;
    });
    sauver(true);                  /* voulu : le code de reprise fait autorité */
    return n;
  }

  /* ------------------------------------------------------ le sommaire --- */

  function montrerSommaire() {
    var l = qcm.chapitres || [];
    var faits = l.filter(function (c) { return chapitreFait(c.numero); }).length;
    var suivant = premierNonFait();

    var liste = el('ol', { class: 'sommaire' });
    l.forEach(function (c) {
      var fait = chapitreFait(c.numero);
      var ouvert = chapitreOuvert(c.numero);
      var etatTexte = fait ? scoreDe(c.numero) + ' / ' + c.questions.length
        : (ouvert ? 'à faire' : 'fermé');
      var li = el('li', { class: 'sommaire-ligne' + (fait ? ' fait' : '') + (ouvert ? '' : ' ferme') });
      var corps = el('span', { class: 'sommaire-corps' }, [
        el('span', { class: 'sommaire-rang', texte: c.romain }),
        el('span', { class: 'sommaire-titre', texte: c.titre }),
        el('span', { class: 'sommaire-etat', texte: etatTexte })
      ]);
      if (ouvert) {
        li.appendChild(el('button', {
          type: 'button', class: 'sommaire-bouton',
          'aria-label': 'Chapitre ' + c.romain + ', ' + c.titre + ' — ' + etatTexte,
          onclick: function () { fait ? montrerCorrection(c.numero, true) : montrerAvertissement(c.numero); }
        }, [corps]));
      } else {
        li.appendChild(el('span', { class: 'sommaire-bouton sommaire-inerte' }, [corps]));
        li.appendChild(el('span', { class: 'sommaire-note', texte: 'Terminez le chapitre précédent.' }));
      }
      liste.appendChild(li);
    });

    var section = el('section', { class: 'ecran' }, [
      el('p', { class: 'sur-titre', texte: 'Le questionnaire du lecteur' }),
      el('h2', { tabindex: '-1', texte: faits ? 'Votre lecture, chapitre par chapitre' : 'Quinze chapitres, soixante questions' }),
      el('p', { class: 'narration', texte: faits
        ? faits + ' chapitre(s) sur ' + l.length + ' — ' + totalBons() + ' bonne(s) réponse(s) sur ' + totalQuestions() + '.'
        : 'Quatre questions par chapitre. Répondez au fil de votre lecture : un chapitre ne s’ouvre qu’une fois le précédent terminé.' }),
      /* Le questionnaire est ouvert à tous, y compris à qui n'a pas
         encore lu le roman : il doit donc dire lui-même, d'entrée, ce
         qu'il risque de dévoiler. L'avertissement reste à chaque visite
         — on peut revenir des semaines plus tard, et avoir oublié. */
      qcm.avertissement ? el('div', { class: 'consigne-lecture' }, [
        el('strong', { texte: qcm.avertissement })
      ]) : null,
      /* une mise à jour du questionnaire a pu rendre des chapitres
         incomparables : on le dit plutôt que de les escamoter */
      chapitresPerdus ? el('div', { class: 'consigne-lecture' }, [
        el('strong', { texte: 'Le questionnaire a été mis à jour.' }),
        el('p', { texte: chapitresPerdus + ' chapitre(s) déjà répondu(s) ont changé et ont dû être remis à zéro. Le reste de vos réponses est intact.' })
      ]) : null,
      liste
    ]);

    if (suivant) {
      var ch = chapitre(suivant);
      section.appendChild(el('div', { class: 'ligne-actions' }, [
        el('button', {
          class: 'bouton bouton-large', type: 'button',
          texte: (reponsesDe(suivant) ? 'Reprendre le chapitre ' : 'Chapitre ') + ch.romain,
          onclick: function () { montrerAvertissement(suivant); }
        })
      ]));
    } else {
      section.appendChild(el('div', { class: 'ligne-actions' }, [
        el('button', { class: 'bouton bouton-large', type: 'button', texte: 'Voir ma note',
          onclick: montrerResultat })
      ]));
    }

    section.appendChild(el('div', { class: 'ligne-actions ligne-actions-gauche' }, [
      el('button', { class: 'bouton bouton-secondaire', type: 'button', texte: 'Changer d’appareil',
        onclick: montrerReprise }),
      el('button', { class: 'bouton bouton-secondaire', type: 'button', texte: 'Recommencer le questionnaire',
        onclick: function () {
          if (!window.confirm('Tout effacer et recommencer depuis le chapitre I ? Vos réponses et votre note seront perdues.')) return;
          effacer();
          etat = etatNeuf();
          sauver(true);              /* voulu : on repart de zéro */
          annoncer('Questionnaire remis à zéro.');
          montrerSommaire();
        } })
    ]));
    montrer(section);
  }

  /* L'avertissement avant d'ouvrir un chapitre : on ne répond pas à des
     questions sur un chapitre qu'on n'a pas lu. */
  function montrerAvertissement(n) {
    var c = chapitre(n);
    var reprise = reponsesDe(n);
    montrer(el('section', { class: 'ecran' }, [
      el('p', { class: 'sur-titre', texte: 'Chapitre ' + c.romain }),
      el('h2', { tabindex: '-1', texte: c.titre }),
      el('div', { class: 'consigne-lecture' }, [
        el('strong', { texte: 'Ne répondez qu’après avoir lu ce chapitre.' }),
        el('p', { texte: 'Il commence page ' + c.page + ' du livre. Quatre questions, une seule tentative chacune : la correction vient à la fin du chapitre.' })
      ]),
      el('div', { class: 'ligne-actions' }, [
        el('button', { class: 'bouton bouton-large', type: 'button',
          texte: reprise ? 'Reprendre' : 'J’ai lu ce chapitre',
          onclick: function () { montrerQuestion(n, premiereSansReponse(n)); } }),
        el('button', { class: 'bouton bouton-secondaire', type: 'button', texte: 'Retour au sommaire',
          onclick: montrerSommaire })
      ])
    ]));
  }

  function premiereSansReponse(n) {
    var r = reponsesDe(n), c = chapitre(n);
    if (!r) return 0;
    for (var i = 0; i < c.questions.length; i++) {
      if (r[i] === undefined || r[i] === null || r[i] < 0) return i;
    }
    return c.questions.length;
  }

  /* ------------------------------------------------------ une question --- */

  function montrerQuestion(n, rang) {
    var c = chapitre(n);
    if (rang >= c.questions.length) return montrerCorrection(n, false);
    var q = c.questions[rang];
    var ordre = ordreAffichage(n, rang, q.options.length);
    var choisi = null;
    var retour = el('p', { class: 'retour', hidden: true });

    var boutons = [];
    var liste = el('div', { class: 'choix' });
    ordre.forEach(function (indiceFichier) {
      var b = el('button', {
        type: 'button', class: 'choix-bouton', texte: q.options[indiceFichier],
        onclick: function () {
          if (choisi !== null) return;              /* une seule tentative */
          choisi = indiceFichier;
          boutons.forEach(function (x) { x.disabled = true; });
          b.classList.add('choisi');
          b.setAttribute('aria-pressed', 'true');
          enregistrer(n, rang, indiceFichier);
          retour.hidden = false;
          retour.setAttribute('data-ton', 'neutre');
          retour.textContent = rang + 1 < c.questions.length
            ? 'Réponse enregistrée. La correction vient à la fin du chapitre.'
            : 'Réponse enregistrée. Voici la correction du chapitre.';
          annoncer(retour.textContent);
          window.setTimeout(function () {
            if (rang + 1 < c.questions.length) montrerQuestion(n, rang + 1);
            else montrerCorrection(n, false);
          }, 700);
        }
      });
      boutons.push(b);
      liste.appendChild(b);
    });

    montrer(el('section', { class: 'ecran' }, [
      el('p', { class: 'sur-titre', texte: 'Chapitre ' + c.romain + ' — question ' + (rang + 1) + ' sur ' + c.questions.length }),
      el('h2', { tabindex: '-1', texte: q.libelle }),
      liste,
      retour,
      el('p', { class: 'aide-clavier', texte: 'Une seule réponse, une seule fois.' })
    ]));
  }

  function enregistrer(n, rang, indice) {
    var cle = String(n);
    var c = chapitre(n);
    if (!etat.reponses[cle]) {
      etat.reponses[cle] = [];
      for (var i = 0; i < c.questions.length; i++) etat.reponses[cle].push(-1);
    }
    etat.reponses[cle][rang] = indice;
    if (etat.repris) delete etat.repris[cle];   /* rejoué pour de vrai */
    sauver();
  }

  /* ------------------------------------------------ la correction ----- */

  function montrerCorrection(n, depuisSommaire) {
    var c = chapitre(n), r = reponsesDe(n) || [];
    var bons = scoreDe(n);

    /* Un chapitre retrouvé par code n'a pas de correction à montrer :
       le code ne porte qu'un score. Inventer les réponses pour remplir
       l'écran serait mentir au lecteur sur ce qu'il a répondu. */
    if ((etat.repris || {})[String(n)]) {
      var suite = premierNonFait();
      var gestes = [];
      if (suite && suite !== n) {
        gestes.push(el('button', { class: 'bouton bouton-large', type: 'button',
          texte: 'Chapitre ' + chapitre(suite).romain,
          onclick: function () { montrerAvertissement(suite); } }));
      }
      gestes.push(el('button', { class: 'bouton bouton-secondaire', type: 'button',
        texte: 'Retour au sommaire', onclick: montrerSommaire }));
      return montrer(el('section', { class: 'ecran' }, [
        el('p', { class: 'sur-titre', texte: 'Chapitre ' + c.romain }),
        el('h2', { tabindex: '-1', texte: bons + ' bonne(s) réponse(s) sur ' + c.questions.length }),
        el('div', { class: 'consigne-lecture' }, [
          el('strong', { texte: 'Chapitre retrouvé par votre code de reprise.' }),
          el('p', { texte: 'Le code porte vos scores, pas le détail de vos réponses : la correction de ce chapitre a été lue sur l’appareil où vous l’avez passé, et ne peut pas être reconstituée ici.' })
        ]),
        el('div', { class: 'ligne-actions' }, gestes)
      ]));
    }

    var liste = el('ol', { class: 'correction' });
    c.questions.forEach(function (q, i) {
      var donnee = r[i];
      var juste = donnee !== undefined && donnee !== null && donnee >= 0 && q.options[donnee] === q.reponse;
      var bloc = el('li', { class: 'correction-ligne' + (juste ? ' juste' : ' faux') }, [
        el('p', { class: 'correction-question', texte: q.libelle }),
        el('p', { class: 'correction-reponse' }, [
          el('span', { class: 'correction-marque', 'aria-hidden': 'true', texte: juste ? '✔' : '✘' }),
          el('span', { texte: (juste ? 'Juste : ' : 'La réponse était : ') + q.reponse })
        ])
      ]);
      if (!juste && donnee !== undefined && donnee !== null && donnee >= 0) {
        bloc.appendChild(el('p', { class: 'correction-donnee', texte: 'Vous aviez répondu : ' + q.options[donnee] }));
      }
      bloc.appendChild(el('p', { class: 'correction-explication' }, [
        document.createTextNode(q.explication + ' '),
        el('span', { class: 'correction-page', texte: 'p. ' + q.page })
      ]));
      liste.appendChild(bloc);
    });

    var suivant = premierNonFait();
    var actions = [];
    if (!depuisSommaire && suivant && suivant !== n) {
      var ch = chapitre(suivant);
      actions.push(el('button', { class: 'bouton bouton-large', type: 'button',
        texte: 'Chapitre ' + ch.romain, onclick: function () { montrerAvertissement(suivant); } }));
    }
    if (!suivant) {
      actions.push(el('button', { class: 'bouton bouton-large', type: 'button',
        texte: 'Voir ma note', onclick: montrerResultat }));
    }
    actions.push(el('button', { class: 'bouton bouton-secondaire', type: 'button',
      texte: 'Retour au sommaire', onclick: montrerSommaire }));

    montrer(el('section', { class: 'ecran' }, [
      el('p', { class: 'sur-titre', texte: 'Chapitre ' + c.romain + ' — correction' }),
      el('h2', { tabindex: '-1', texte: bons + ' bonne(s) réponse(s) sur ' + c.questions.length }),
      liste,
      el('div', { class: 'ligne-actions' }, actions)
    ]));
  }

  /* ------------------------------------------------- changer d'appareil --- */

  function montrerReprise() {
    var champ = el('input', { type: 'text', class: 'champ-saisie', autocomplete: 'off',
      autocapitalize: 'characters', spellcheck: 'false', maxlength: '12', 'data-entree': 'propre',
      'aria-label': 'Code de reprise, dix caractères' });
    var retour = el('p', { class: 'retour', hidden: true });

    function reprendre() {
      var lu = lireCodeReprise(champ.value);
      if (lu && lu.erreur) {
        retour.hidden = false;
        retour.setAttribute('data-ton', 'echec');
        retour.textContent = lu.erreur === 'incoherent'
          ? 'Code incorrect, vérifiez-le : il décrit des chapitres faits dans le désordre.'
          : 'Code incorrect, vérifiez-le. Dix caractères, recopiés tels quels.';
        annoncer(retour.textContent);
        champ.focus(); champ.select();
        return;
      }
      /* Le code fait autorité, donc il efface : on prévient avant. */
      var dejaLa = (qcm.chapitres || []).filter(function (c) { return chapitreFait(c.numero); }).length;
      if (dejaLa && !window.confirm('Cet appareil a déjà ' + dejaLa + ' chapitre(s) terminé(s).\n\n' +
        'Le code de reprise va les remplacer par ceux qu’il porte. Continuer ?')) {
        champ.focus(); champ.select();
        return;
      }
      var n = appliquerCodeReprise(lu.scores);
      annoncer(n + ' chapitre(s) retrouvé(s).');
      montrerSommaire();
    }
    champ.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); reprendre(); } });

    montrer(el('section', { class: 'ecran' }, [
      el('p', { class: 'sur-titre', texte: 'Changer d’appareil' }),
      el('h2', { tabindex: '-1', texte: 'Votre code de reprise' }),
      el('p', { class: 'narration', texte: 'Notez ces dix caractères. Sur un autre téléphone, ouvrez le questionnaire et entrez ce code : vous retrouverez vos chapitres et votre score.' }),
      el('p', { class: 'code-reprise' }, [el('strong', { texte: codeReprise() })]),
      el('p', { class: 'narration petite', texte: 'Il porte vos scores par chapitre, pas le détail de chaque réponse : les corrections déjà lues ne reviendront pas.' }),
      el('hr', { class: 'filet' }),
      el('p', { class: 'narration', texte: 'Vous avez déjà un code ? Recopiez-le ici.' }),
      el('p', {}, [champ]),
      retour,
      el('div', { class: 'ligne-actions' }, [
        el('button', { class: 'bouton bouton-large', type: 'button', texte: 'Reprendre', onclick: reprendre }),
        el('button', { class: 'bouton bouton-secondaire', type: 'button', texte: 'Retour au sommaire', onclick: montrerSommaire })
      ])
    ]));
  }

  /* ------------------------------------------------------- le résultat --- */

  function montrerResultat() {
    var n = note(), m = mention();
    var section = el('section', { class: 'ecran' }, [
      el('p', { class: 'sur-titre', texte: 'Questionnaire terminé' }),
      el('h2', { tabindex: '-1', texte: noteEcrite(n) + ' sur 20' }),
      el('p', { class: 'mention-nom', texte: m.nom }),
      el('p', { class: 'narration', texte: m.phrase }),
      el('p', { class: 'narration petite', texte: totalBons() + ' bonnes réponses sur ' + totalQuestions() + '.' })
    ]);

    var detail = el('ul', { class: 'detail-chapitres' });
    (qcm.chapitres || []).forEach(function (c) {
      detail.appendChild(el('li', {}, [
        el('span', { class: 'detail-rang', texte: c.romain }),
        el('span', { class: 'detail-titre', texte: c.titre }),
        el('span', { class: 'detail-score', texte: scoreDe(c.numero) + '/' + c.questions.length })
      ]));
    });
    section.appendChild(detail);

    section.appendChild(el('div', { class: 'ligne-actions' }, [
      el('button', { class: 'bouton bouton-large', type: 'button', texte: 'Mon diplôme', onclick: montrerDiplome }),
      el('button', { class: 'bouton bouton-secondaire', type: 'button', texte: 'Un mot pour l’auteur', onclick: montrerMot })
    ]));
    section.appendChild(el('div', { class: 'ligne-actions ligne-actions-gauche' }, [
      el('button', { class: 'bouton bouton-secondaire', type: 'button', texte: 'Revoir les corrections', onclick: montrerSommaire })
    ]));
    montrer(section);
  }

  /* --------------------------------------------------------- diplôme --- */

  /* Dessiné dans le navigateur, sur une toile : rien n'est demandé à un
     serveur, et le lecteur garde son prénom pour lui s'il préfère.
     Deux versions : celle du site, sombre et dorée, et une version
     claire qui ne vide pas une cartouche d'encre à l'impression.

     Le dessin suit le modèle de l'auteur (Diplome_Memoire_du_Nord) :
     lampe de mineur au trait, surtitre en petites capitales espacées,
     titre doré, note et mention côte à côte séparées d'un filet, et une
     ligne de terrils au bas de la page. A4 couché, 150 points par pouce. */
  var POLICE = '"Palatino Linotype", "Book Antiqua", Palatino, "TeX Gyre Pagella", Georgia, serif';
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
    'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function dessinerDiplome(toile, clair) {
    var L = 1754, H = 1240;
    toile.width = L; toile.height = H;
    var c = toile.getContext('2d');

    var fond = clair ? '#fbf7ee' : '#16110c';
    var encre = clair ? '#2a2017' : '#efe6d4';
    var or = clair ? '#9a7428' : '#c9a24a';
    var douce = clair ? '#6d5f4c' : '#9d9180';
    var terril = clair ? '#ece2cd' : '#241b12';

    c.fillStyle = fond; c.fillRect(0, 0, L, H);

    /* --- les terrils, derrière tout le reste --- */
    c.save();
    c.beginPath();
    c.rect(68, 66, L - 136, H - 132);
    c.clip();
    /* Des terrils, pas des pics : ce sont des collines de schiste, et
       elles s'arrondissent depuis soixante ans. */
    c.fillStyle = terril;
    c.beginPath();
    c.moveTo(68, H - 66);
    c.lineTo(68, 1118);
    c.lineTo(340, 1118);
    c.bezierCurveTo(420, 1118, 430, 1052, 505, 1052);
    c.bezierCurveTo(580, 1052, 592, 1118, 672, 1118);
    c.lineTo(960, 1118);
    c.bezierCurveTo(1080, 1118, 1090, 1028, 1195, 1028);
    c.bezierCurveTo(1300, 1028, 1315, 1104, 1425, 1104);
    c.lineTo(L - 68, 1104);
    c.lineTo(L - 68, H - 66);
    c.closePath();
    c.fill();
    c.restore();

    /* --- le double filet --- */
    c.strokeStyle = or;
    c.lineWidth = 2.5;
    c.strokeRect(50, 35, L - 100, H - 70);
    c.lineWidth = 1.5;
    c.strokeRect(68, 66, L - 136, H - 132);

    /* --- les écritures --- */
    function police(taille, poids, italique) {
      c.font = (italique ? 'italic ' : '') + (poids ? poids + ' ' : '') + taille + 'px ' + POLICE;
    }
    function centre(t, y, taille, couleur, poids, italique) {
      police(taille, poids, italique);
      c.fillStyle = couleur; c.textAlign = 'center';
      c.fillText(t, L / 2, y);
    }
    /* Les petites capitales espacées : aucune toile ne sait le faire,
       on pose les lettres une à une. */
    function capitales(t, y, taille, couleur, espacement, centreX) {
      police(taille, '', false);
      c.fillStyle = couleur;
      var lettres = String(t).toUpperCase().split('');
      var large = lettres.reduce(function (s, x) { return s + c.measureText(x).width + espacement; }, -espacement);
      var x = (centreX === undefined ? L / 2 : centreX) - large / 2;
      c.textAlign = 'left';
      lettres.forEach(function (lettre) {
        c.fillText(lettre, x, y);
        x += c.measureText(lettre).width + espacement;
      });
      c.textAlign = 'center';
    }

    /* --- la lampe de mineur, au trait --- */
    (function lampe(cx, haut) {
      c.save();
      c.strokeStyle = or; c.lineWidth = 3;
      c.lineJoin = 'round'; c.lineCap = 'round';
      /* l'anneau */
      c.beginPath(); c.arc(cx, haut + 7, 7, Math.PI, 0); c.stroke();
      /* la tige */
      c.beginPath(); c.moveTo(cx, haut + 14); c.lineTo(cx, haut + 22); c.stroke();
      /* le chapeau */
      c.beginPath();
      c.moveTo(cx - 20, haut + 34); c.lineTo(cx - 13, haut + 22);
      c.lineTo(cx + 13, haut + 22); c.lineTo(cx + 20, haut + 34);
      c.closePath(); c.stroke();
      /* le corps, et ses barreaux */
      c.beginPath(); c.rect(cx - 17, haut + 34, 34, 48); c.stroke();
      c.lineWidth = 1.6;
      [-8, 0, 8].forEach(function (d) {
        c.beginPath(); c.moveTo(cx + d, haut + 38); c.lineTo(cx + d, haut + 78); c.stroke();
      });
      /* le socle */
      c.lineWidth = 3;
      c.beginPath(); c.rect(cx - 21, haut + 82, 42, 10); c.stroke();
      c.beginPath(); c.moveTo(cx - 14, haut + 92); c.lineTo(cx + 14, haut + 92); c.stroke();
      c.restore();
    })(L / 2, 172);

    capitales('Les Démons de Léa Laprel · Le questionnaire du lecteur', 299, 25, douce, 5.5);
    centre('Diplôme de la Mémoire du Nord', 374, 62, or, '700');

    var prenom = String(etat.prenom || '').trim();
    centre('est décerné à', 452, 26, douce, '', true);
    centre(prenom || 'Lecteur du coron', 522, 56, encre, '', true);

    centre('pour avoir descendu les quinze chapitres du roman', 585, 27, encre);
    centre('et rapporté au jour la mémoire des corons.', 627, 27, encre);

    /* --- note et mention, de part et d'autre d'un filet --- */
    var n = note(), m = mention();
    var axe = L / 2;
    c.strokeStyle = or; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(axe, 690); c.lineTo(axe, 782); c.stroke();

    var gauche = axe - 190, droite = axe + 190;
    capitales('Note', 712, 18, douce, 5, gauche);
    police(56, '700', false);
    var valeur = noteEcrite(n), surVingt = '/20';
    var largeValeur = c.measureText(valeur).width;
    police(30, '', false);
    var largeSur = c.measureText(surVingt).width;
    var depart = gauche - (largeValeur + largeSur) / 2;
    c.textAlign = 'left'; c.fillStyle = encre;
    police(56, '700', false); c.fillText(valeur, depart, 764);
    police(30, '', false); c.fillStyle = douce;
    c.fillText(surVingt, depart + largeValeur, 764);
    c.textAlign = 'center';

    /* « Gueule noire d'honneur » est deux fois plus long que « Porion » :
       centré comme lui, il passerait sur le filet. On le décale vers la
       droite juste ce qu'il faut, plutôt que de le rapetisser — une
       mention qu'on a méritée se lit en grand. */
    police(44, '700', false);
    var largeMention = c.measureText(m.nom).width;
    var centreMention = Math.max(droite, axe + 46 + largeMention / 2);
    centreMention = Math.min(centreMention, L - 110 - largeMention / 2);
    capitales('Mention', 712, 18, douce, 5, centreMention);
    police(44, '700', false);
    c.fillStyle = or; c.textAlign = 'center';
    c.fillText(m.nom, centreMention, 762);

    centre('« ' + m.phrase + ' »', 855, 25, encre, '', true);

    /* --- le bas de page --- */
    var d = new Date();
    capitales('Fait le', 1057, 17, douce, 5, 318);
    centre('', 0, 10, douce);
    police(28, '', false); c.fillStyle = encre; c.textAlign = 'center';
    c.fillText(d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear(), 318, 1092);

    police(40, '', true); c.fillStyle = encre;
    c.fillText('Paul Cardon', L - 318, 1055);
    capitales('L’auteur', 1090, 17, douce, 5, L - 318);
  }

  function montrerDiplome() {
    var toile = el('canvas', { class: 'diplome-toile', 'aria-label': 'Votre diplôme de la Mémoire du Nord' });
    var clair = false;
    var champ = el('input', { type: 'text', class: 'champ-saisie', maxlength: '24',
      autocomplete: 'given-name', 'aria-label': 'Votre prénom, facultatif',
      placeholder: 'Votre prénom (facultatif)' });
    champ.value = etat.prenom || '';
    var lien = el('a', { class: 'bouton bouton-large', href: '#', texte: 'Télécharger le diplôme' });

    function redessiner() {
      dessinerDiplome(toile, clair);
      try {
        toile.toBlob(function (b) {
          if (!b) return;
          if (lien.dataset && lien.dataset.url) URL.revokeObjectURL(lien.dataset.url);
          var u = URL.createObjectURL(b);
          lien.href = u;
          lien.setAttribute('download', 'Diplome-de-la-Memoire-du-Nord.png');
          if (lien.dataset) lien.dataset.url = u;
        }, 'image/png');
      } catch (e) {}
    }
    champ.addEventListener('input', function () {
      etat.prenom = champ.value.replace(/[<>]/g, '').slice(0, 24);
      sauver();
      redessiner();
    });

    var bascule = el('button', { class: 'bouton bouton-secondaire', type: 'button',
      texte: 'Version imprimable', onclick: function () {
        clair = !clair;
        bascule.textContent = clair ? 'Version du site' : 'Version imprimable';
        annoncer(clair ? 'Diplôme sur fond clair, pour l’impression.' : 'Diplôme sur fond sombre.');
        redessiner();
      } });

    montrer(el('section', { class: 'ecran' }, [
      el('p', { class: 'sur-titre', texte: 'Votre diplôme' }),
      el('h2', { tabindex: '-1', texte: 'Diplôme de la Mémoire du Nord' }),
      el('p', { class: 'narration', texte: 'Votre prénom n’est pas obligatoire — le diplôme se décerne alors « au Lecteur du coron ». Rien n’est envoyé nulle part : l’image est fabriquée sur votre appareil.' }),
      el('p', {}, [champ]),
      el('div', { class: 'diplome-cadre' }, [toile]),
      el('div', { class: 'ligne-actions' }, [lien, bascule]),
      el('p', { class: 'narration petite', texte: 'Sur iPhone, vous pouvez aussi appuyer longuement sur l’image pour l’enregistrer.' }),
      el('div', { class: 'ligne-actions ligne-actions-gauche' }, [
        el('button', { class: 'bouton bouton-secondaire', type: 'button', texte: 'Un mot pour l’auteur', onclick: montrerMot }),
        el('button', { class: 'bouton bouton-secondaire', type: 'button', texte: 'Ma note', onclick: montrerResultat })
      ])
    ]));
    redessiner();
  }

  /* ------------------------------------------------ un mot pour l'auteur --- */

  function corpsDuMessage() {
    var n = note(), m = mention(), lignes = [];
    var prenom = String(etat.prenom || '').trim();
    var ville = String(etat.ville || '').trim();
    lignes.push('Bonjour,');
    lignes.push('');
    lignes.push('Je viens de terminer le questionnaire du lecteur.');
    lignes.push('');
    lignes.push('Note : ' + noteEcrite(n) + '/20 — mention « ' + m.nom + ' »');
    lignes.push('Bonnes réponses : ' + totalBons() + ' sur ' + totalQuestions());
    if (prenom) lignes.push('Prénom : ' + prenom);
    if (ville) lignes.push('Ville : ' + ville);
    lignes.push('');
    lignes.push('Détail par chapitre :');
    (qcm.chapitres || []).forEach(function (c) {
      lignes.push('  ' + c.romain + '. ' + c.titre + ' — ' + scoreDe(c.numero) + '/' + c.questions.length);
    });
    if (etat.etoiles) {
      lignes.push('');
      lignes.push('Ma note pour le roman : ' + etat.etoiles + '/5');
    }
    if (String(etat.avis || '').trim()) {
      lignes.push('');
      lignes.push('Mon avis :');
      lignes.push(String(etat.avis).trim());
    }
    lignes.push('');
    lignes.push('—');
    lignes.push('Envoyé depuis le questionnaire du lecteur, lea-laprel.github.io');
    return lignes.join('\n');
  }
  function objetDuMessage() {
    var prenom = String(etat.prenom || '').trim();
    return 'Questionnaire du lecteur — ' + (prenom ? prenom + ' — ' : '') + noteEcrite(note()) + '/20';
  }

  function montrerMot() {
    var prenom = el('input', { type: 'text', class: 'champ-saisie', maxlength: '24',
      autocomplete: 'given-name', 'aria-label': 'Votre prénom, facultatif', placeholder: 'Prénom (facultatif)' });
    var ville = el('input', { type: 'text', class: 'champ-saisie', maxlength: '32',
      autocomplete: 'address-level2', 'aria-label': 'Votre ville, facultatif', placeholder: 'Ville (facultatif)' });
    var avis = el('textarea', { class: 'champ-saisie champ-avis', rows: '5',
      'aria-label': 'Votre avis sur le roman', placeholder: 'Ce que le roman vous a fait…' });
    prenom.value = etat.prenom || '';
    ville.value = etat.ville || '';
    avis.value = etat.avis || '';

    var etoiles = el('div', { class: 'etoiles', role: 'group', 'aria-label': 'Votre note pour le roman, de 1 à 5' });
    var boutons = [];
    function peindre() {
      boutons.forEach(function (b, i) {
        var pleine = i < (etat.etoiles || 0);
        b.textContent = pleine ? '★' : '☆';
        b.classList.toggle('pleine', pleine);
        b.setAttribute('aria-pressed', pleine ? 'true' : 'false');
      });
    }
    for (var i = 1; i <= 5; i++) {
      (function (valeur) {
        var b = el('button', { type: 'button', class: 'etoile', texte: '☆',
          'aria-label': valeur + ' étoile' + (valeur > 1 ? 's' : ''),
          onclick: function () {
            etat.etoiles = etat.etoiles === valeur ? 0 : valeur;
            sauver(); peindre(); majLienMail();
            annoncer(etat.etoiles ? etat.etoiles + ' étoile(s) sur 5.' : 'Note retirée.');
          } });
        boutons.push(b); etoiles.appendChild(b);
      })(i);
    }
    peindre();

    var retour = el('p', { class: 'retour', hidden: true });

    /* Un VRAI lien « mailto: », pas une navigation faite en script.
       C'est ce que les téléphones savent le mieux ouvrir, le lecteur
       voit où il va en appuyant longuement, et l'adresse construite se
       relit — un envoi qu'on ne peut pas vérifier est un envoi dont on
       ne sait rien. Il se reconstruit à chaque frappe. */
    var lienMail = el('a', { class: 'bouton bouton-large', href: '#', texte: 'Envoyer à l’auteur' });
    var avertissementLong = el('p', { class: 'narration petite', hidden: true,
      texte: 'Votre avis est long : certaines messageries tronquent les messages préparés de cette façon. Si le vôtre arrive coupé, utilisez plutôt « Copier mon message ».' });
    function majLienMail() {
      var url = 'mailto:' + COURRIEL +
        '?subject=' + encodeURIComponent(objetDuMessage()) +
        '&body=' + encodeURIComponent(corpsDuMessage());
      lienMail.setAttribute('href', url);
      /* Au-delà d'environ deux mille caractères, certaines messageries
         coupent. On ne raccourcit pas les mots du lecteur : on le
         prévient, et le bouton « Copier » reste là pour ça. */
      avertissementLong.hidden = url.length < 1900;
    }
    lienMail.addEventListener('click', function () {
      retour.hidden = false;
      retour.setAttribute('data-ton', 'neutre');
      retour.textContent = 'Votre messagerie s’ouvre avec le message déjà écrit. Rien n’est parti tant que vous n’appuyez pas sur « Envoyer » dans votre messagerie.';
      annoncer(retour.textContent);
    });

    function retenir() {
      etat.prenom = prenom.value.replace(/[<>]/g, '').slice(0, 24);
      etat.ville = ville.value.replace(/[<>]/g, '').slice(0, 32);
      etat.avis = avis.value.slice(0, 1200);
      sauver();
      majLienMail();
    }
    [prenom, ville, avis].forEach(function (c) { c.addEventListener('input', retenir); });
    majLienMail();

    function copier() {
      retenir();
      var texte = objetDuMessage() + '\n\n' + corpsDuMessage();
      function dire(ok) {
        retour.hidden = false;
        retour.setAttribute('data-ton', ok ? 'succes' : 'echec');
        retour.textContent = ok
          ? 'Message copié. Collez-le dans un courriel à ' + COURRIEL + '.'
          : 'La copie n’a pas fonctionné. Sélectionnez le texte ci-dessous à la main.';
        annoncer(retour.textContent);
        if (!ok) {
          var zone = el('textarea', { class: 'champ-saisie champ-avis', rows: '10', readonly: true });
          zone.value = texte;
          retour.parentNode.insertBefore(zone, retour.nextSibling);
          zone.focus(); zone.select();
        }
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(texte).then(function () { dire(true); }, function () { dire(false); });
          return;
        }
      } catch (e) {}
      dire(false);
    }

    var section = el('section', { class: 'ecran' }, [
      el('p', { class: 'sur-titre', texte: 'Un mot pour l’auteur' }),
      el('h2', { tabindex: '-1', texte: 'Entièrement facultatif' }),
      el('p', { class: 'narration', texte: 'Quelle note donneriez-vous au roman ?' }),
      etoiles,
      el('p', { class: 'narration', texte: 'Votre avis' }),
      el('p', {}, [avis]),
      el('div', { class: 'deux-champs' }, [prenom, ville]),
      el('div', { class: 'ligne-actions' }, [
        lienMail,
        el('button', { class: 'bouton bouton-secondaire', type: 'button', texte: 'Copier mon message', onclick: copier })
      ]),
      retour,
      avertissementLong,
      el('p', { class: 'narration petite', texte: 'Votre message part depuis votre propre messagerie ; ce site ne conserve aucune donnée.' })
    ]);

    var encart = encartAvis();
    if (encart) section.appendChild(encart);
    section.appendChild(el('div', { class: 'ligne-actions ligne-actions-gauche' }, [
      el('button', { class: 'bouton bouton-secondaire', type: 'button', texte: 'Mon diplôme', onclick: montrerDiplome }),
      el('button', { class: 'bouton bouton-secondaire', type: 'button', texte: 'Ma note', onclick: montrerResultat })
    ]));
    montrer(section);
  }

  /* L'encart des avis vient APRÈS l'envoi, et il est séparé. Aucun lien
     avec la note, la mention ou le diplôme : les règles d'Amazon
     interdisent d'échanger un avis contre quoi que ce soit, et un avis
     acheté ne vaut rien de toute façon. */
  /* Le même encart que les deux autres modes : il vit dans avis.js,
     avec ses adresses et ses mots. Si le fichier manquait, on ne
     montrerait rien plutôt qu'un encart à moitié écrit. */
  function encartAvis() {
    if (!window.LV_AVIS || !window.LV_AVIS.encart) return null;
    return window.LV_AVIS.encart(el, 'public');
  }

  /* ------------------------------------------------------- démarrage --- */

  function erreur(message) {
    montrer(el('section', { class: 'ecran' }, [
      el('h2', { tabindex: '-1', texte: 'Le questionnaire n’a pas pu s’ouvrir' }),
      el('p', { class: 'narration', texte: message }),
      el('p', { class: 'aide-clavier' }, [el('a', { class: 'lien-discret', href: 'index.html', texte: '← Revenir au jeu' })])
    ]));
  }

  function lire(adresse) {
    return fetch(adresse, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(adresse + ' : ' + r.status);
      return r.json();
    });
  }

  /* Le questionnaire est en accès libre : il ne lit plus etapes.json,
     il n'a plus de porte à garder. Il s'ouvre, il prévient, et il
     commence. */
  lire('questionnaire.json').then(function (contenu) {
    qcm = contenu;
    etat = charger() || etatNeuf();
    sauver();
    /* Plus d'écrasement entre onglets : on rejoint celui qui a avancé. */
    window.addEventListener('storage', function (ev) {
      if (ev.key !== CLE || !ev.newValue) return;
      var arrive = null;
      try { arrive = JSON.parse(ev.newValue); } catch (e) { return; }
      if (!arrive || arrive.signature !== signature()) return;
      if (avancement(arrive) <= avancement(etat)) return;
      etat = arrive;
      annoncer('Le questionnaire a avancé dans un autre onglet. Cet écran se remet à jour.');
      if (toutFini()) montrerResultat(); else montrerSommaire();
    });
    if (toutFini()) return montrerResultat();
    montrerSommaire();
  }).catch(function (e) {
    erreur('Les questions n’ont pas pu être chargées (' + e.message + '). Rechargez la page, ou revenez au jeu.');
  });
})();
