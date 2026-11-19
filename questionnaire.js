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
  /* La porte du jeu dépose ici l'empreinte du code quand elle s'ouvre :
     celui qui arrive par l'écran de choix n'a pas à retaper le code. */
  var CLE_PORTE = 'lea-laprel-porte-classe.v1';
  var SEL_PORTE = 'lea-laprel·porte·2027';
  var ALPHABET32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  var COURRIEL = 'lesdemonsdelealaprel@gmail.com';

  var jeu = null, qcm = null, etat = null;
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
  }

  /* --------------------------------------------------------- l'état --- */

  /* Tout tient sur l'appareil, dans un seul objet. Les réponses sont
     rangées par NUMÉRO DE CHAPITRE, et chaque réponse est l'indice de la
     proposition choisie DANS L'ORDRE DU FICHIER — l'ordre affiché change
     d'un lecteur à l'autre, celui du fichier ne bouge pas. */
  function etatNeuf() {
    return { version: 1, signature: signature(), graine: nouvelleGraine(),
      reponses: {}, prenom: '', ville: '', etoiles: 0, avis: '' };
  }
  function signature() {
    return 'q1|' + (qcm.chapitres || []).length + '|' +
      (qcm.chapitres || []).reduce(function (n, c) { return n + c.questions.length; }, 0);
  }
  function sauver() {
    try { window.localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) {}
  }
  function charger() {
    try {
      var b = window.localStorage.getItem(CLE);
      if (!b) return null;
      var l = JSON.parse(b);
      return l && l.signature === signature() ? l : null;
    } catch (e) { return null; }
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
  function cleDe(corps) {
    var somme = 0;
    for (var i = 0; i < corps.length; i++) somme += ALPHABET32.indexOf(corps.charAt(i)) * (i + 1);
    return ALPHABET32.charAt(somme % 32);
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
    if (s.length !== 9) return null;
    var corps = s.slice(0, 8);
    for (var i = 0; i < 8; i++) if (ALPHABET32.indexOf(corps.charAt(i)) === -1) return null;
    if (cleDe(corps) !== s.charAt(8)) return null;
    var valeur = 0;
    for (i = 0; i < 8; i++) valeur = valeur * 32 + ALPHABET32.indexOf(corps.charAt(i));
    var l = qcm.chapitres || [], scores = {};
    for (i = 0; i < l.length; i++) {
      var d = valeur % 6;
      valeur = Math.floor(valeur / 6);
      if (d > 0) scores[l[i].numero] = d - 1;
    }
    return scores;
  }
  /* Appliquer un code : on ne connaît que les scores, pas les réponses.
     On reconstitue donc des réponses « plausibles » — les bonnes pour le
     nombre de points obtenus, les premières fausses pour le reste. Le
     total et la note sont exacts ; le détail des corrections passées,
     lui, est perdu, et on le dit au lecteur. */
  function appliquerCodeReprise(scores) {
    var n = 0;
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
    });
    sauver();
    return n;
  }

  /* -------------------------------------------------------- la porte --- */

  function normaliserMot(v) {
    var s = String(v === null || v === undefined ? '' : v).toLowerCase();
    s = s.replace(/œ/g, 'oe').replace(/æ/g, 'ae');
    s = s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;
    return s.replace(/[^a-z0-9]+/g, ' ').replace(/^ | $/g, '');
  }
  function empreinteAttendue() {
    var v = (jeu.versions || {}).eleves || {};
    return String((v.entree || {}).empreinte || '').toLowerCase();
  }
  function porteDejaFranchie() {
    try {
      return window.localStorage.getItem(CLE_PORTE) === empreinteAttendue() && !!empreinteAttendue();
    } catch (e) { return false; }
  }
  /* Le code n'est écrit nulle part : on compare des empreintes. Ici, la
     page est servie en https, donc l'API de chiffrement du navigateur
     existe — pas besoin de réécrire SHA-256 comme le fait le jeu, qui
     doit, lui, fonctionner depuis une clé USB. */
  function verifierCode(saisi) {
    var attendue = empreinteAttendue();
    if (!attendue) return Promise.resolve(false);
    var mot = normaliserMot(saisi);
    if (!mot) return Promise.resolve(false);
    try {
      var octets = new TextEncoder().encode(mot + SEL_PORTE);
      return window.crypto.subtle.digest('SHA-256', octets).then(function (brut) {
        var hex = Array.prototype.map.call(new Uint8Array(brut), function (o) {
          return ('0' + o.toString(16)).slice(-2);
        }).join('');
        return hex === attendue;
      });
    } catch (e) { return Promise.resolve(false); }
  }

  function montrerPorte() {
    var champ = el('input', { type: 'text', class: 'champ-saisie champ-porte', autocomplete: 'off',
      autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Le code imprimé dans le livre' });
    var retour = el('p', { class: 'retour', hidden: true });

    function tenter() {
      verifierCode(champ.value).then(function (ok) {
        if (!ok) {
          retour.hidden = false;
          retour.setAttribute('data-ton', 'echec');
          retour.textContent = 'Ce n’est pas le code du livre. Il est imprimé à la dernière page, sous le QR code.';
          annoncer(retour.textContent);
          champ.focus(); champ.select();
          return;
        }
        try { window.localStorage.setItem(CLE_PORTE, empreinteAttendue()); } catch (e) {}
        montrerSommaire();
      });
    }
    champ.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); tenter(); }
    });

    montrer(el('section', { class: 'ecran' }, [
      el('p', { class: 'sur-titre', texte: 'Le questionnaire du lecteur' }),
      el('h2', { tabindex: '-1', texte: 'Le code du livre, s’il vous plaît' }),
      el('p', { class: 'narration', texte: 'Soixante questions sur le roman, quatre par chapitre. Le code est imprimé à la dernière page, sous le QR code — le même que pour le jeu.' }),
      el('p', {}, [champ]),
      retour,
      el('div', { class: 'ligne-actions' }, [
        el('button', { class: 'bouton bouton-large', type: 'button', texte: 'Entrer', onclick: tenter })
      ]),
      el('p', { class: 'aide-clavier' }, [
        el('a', { class: 'lien-discret', href: 'index.html', texte: '← Revenir au jeu' })
      ])
    ]));
    champ.focus();
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
          sauver();
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
    sauver();
  }

  /* ------------------------------------------------ la correction ----- */

  function montrerCorrection(n, depuisSommaire) {
    var c = chapitre(n), r = reponsesDe(n) || [];
    var bons = scoreDe(n);
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
      autocapitalize: 'characters', spellcheck: 'false', maxlength: '11',
      'aria-label': 'Code de reprise, neuf caractères' });
    var retour = el('p', { class: 'retour', hidden: true });

    function reprendre() {
      var lu = lireCodeReprise(champ.value);
      if (!lu) {
        retour.hidden = false;
        retour.setAttribute('data-ton', 'echec');
        retour.textContent = 'Ce code ne ressemble à rien de connu. Neuf caractères, recopiés tels quels.';
        champ.focus(); champ.select();
        return;
      }
      var n = appliquerCodeReprise(lu);
      annoncer(n + ' chapitre(s) retrouvé(s).');
      montrerSommaire();
    }
    champ.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); reprendre(); } });

    montrer(el('section', { class: 'ecran' }, [
      el('p', { class: 'sur-titre', texte: 'Changer d’appareil' }),
      el('h2', { tabindex: '-1', texte: 'Votre code de reprise' }),
      el('p', { class: 'narration', texte: 'Notez ces neuf caractères. Sur un autre téléphone, entrez le code du livre, puis ce code : vous retrouverez vos chapitres et votre score.' }),
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
     claire qui ne vide pas une cartouche d'encre à l'impression. */
  function dessinerDiplome(toile, clair) {
    var L = 1754, H = 1240;                  /* A4 couché, à 150 points par pouce */
    toile.width = L; toile.height = H;
    var c = toile.getContext('2d');
    var fond = clair ? '#ffffff' : '#1e1a17';
    var encre = clair ? '#1b1714' : '#f3ece1';
    var or = clair ? '#8a6a28' : '#c9a227';
    var douce = clair ? '#5d534a' : '#bdb2a3';

    c.fillStyle = fond; c.fillRect(0, 0, L, H);

    /* un double filet, comme un encadrement de papeterie */
    c.strokeStyle = or; c.lineWidth = 6;
    c.strokeRect(50, 50, L - 100, H - 100);
    c.lineWidth = 2;
    c.strokeRect(72, 72, L - 144, H - 144);

    function texte(t, y, taille, couleur, police, espacement) {
      c.fillStyle = couleur;
      c.font = (police || '') + ' ' + taille + 'px Cambria, Georgia, "Times New Roman", serif';
      c.textAlign = 'center';
      if (espacement) {
        /* l'espacement des lettres n'existe pas sur toutes les toiles :
           on l'écrit à la main, lettre par lettre */
        var lettres = String(t).split('');
        var large = lettres.reduce(function (s, x) { return s + c.measureText(x).width + espacement; }, -espacement);
        var x = L / 2 - large / 2;
        c.textAlign = 'left';
        lettres.forEach(function (x2) { c.fillText(x2, x, y); x += c.measureText(x2).width + espacement; });
        c.textAlign = 'center';
        return;
      }
      c.fillText(t, L / 2, y);
    }

    texte('LES DÉMONS DE LÉA LAPREL', 190, 44, or, '700', 6);
    texte('roman de Paul Cardon', 240, 30, douce, 'italic');

    texte('Diplôme de lecteur', 390, 86, encre, '700');

    var prenom = String(etat.prenom || '').trim();
    texte(prenom ? 'décerné à' : 'décerné au lecteur', 500, 32, douce, 'italic');
    if (prenom) texte(prenom, 590, 72, encre, '700');

    var n = note(), m = mention();
    texte(noteEcrite(n) + ' sur 20', 760, 96, or, '700');
    texte('mention « ' + m.nom + ' »', 830, 44, encre, '700');
    texte(totalBons() + ' bonnes réponses sur ' + totalQuestions() +
      ', à travers les quinze chapitres du roman.', 900, 28, douce, 'italic');

    var d = new Date();
    var mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
      'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    texte('Fait le ' + d.getDate() + ' ' + mois[d.getMonth()] + ' ' + d.getFullYear(), 1020, 28, douce, '');

    c.strokeStyle = douce; c.lineWidth = 1;
    c.beginPath(); c.moveTo(L / 2 - 200, 1105); c.lineTo(L / 2 + 200, 1105); c.stroke();
    texte('Paul Cardon', 1150, 34, encre, 'italic');
  }

  function montrerDiplome() {
    var toile = el('canvas', { class: 'diplome-toile', 'aria-label': 'Votre diplôme de lecteur' });
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
          lien.setAttribute('download', 'Diplome-de-lecteur-Lea-Laprel.png');
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
      el('h2', { tabindex: '-1', texte: 'Diplôme de lecteur' }),
      el('p', { class: 'narration', texte: 'Votre prénom n’est pas obligatoire — le diplôme se décerne aussi « au lecteur ». Rien n’est envoyé nulle part : l’image est fabriquée sur votre appareil.' }),
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

    section.appendChild(encartAvis());
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
  function encartAvis() {
    var a = qcm.avis || {};
    function lien(texte, href) {
      return el('a', { class: 'lien-avis', href: href, target: '_blank', rel: 'noopener', texte: '→ ' + texte });
    }
    return el('aside', { class: 'encart-avis' }, [
      el('p', { class: 'encart-titre', texte: 'Vous avez aimé le roman ?' }),
      el('p', { texte: 'Un avis, même de deux lignes, aide beaucoup un auteur indépendant à faire connaître son livre. Une note en étoiles suffit.' }),
      a.amazon ? lien('Laisser un avis sur Amazon', a.amazon) : null,
      a.babelio ? lien('Laisser un avis sur Babelio', a.babelio) : null,
      el('p', { class: 'petite', texte: 'Sur Amazon, il faut être connecté à son compte. Sur Babelio, il suffit d’un compte gratuit, puis de toucher « Contribuer » et « Publier une critique ».' })
    ]);
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

  Promise.all([lire('etapes.json'), lire('questionnaire.json')]).then(function (deux) {
    jeu = deux[0]; qcm = deux[1];
    etat = charger() || etatNeuf();
    sauver();
    if (!porteDejaFranchie()) return montrerPorte();
    if (toutFini()) return montrerResultat();
    montrerSommaire();
  }).catch(function (e) {
    erreur('Les questions n’ont pas pu être chargées (' + e.message + '). Rechargez la page, ou revenez au jeu.');
  });
})();
