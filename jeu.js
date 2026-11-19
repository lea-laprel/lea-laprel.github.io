/* =========================================================================
   Les Démons de Léa Laprel — version lecteur.

   Quatorze étapes à travers les quinze chapitres du roman, pour qui vient
   de refermer le livre. Le chapitre IX, « De Gaulle », n'a pas d'énigme :
   il s'annonce sur la passerelle qui suit la huitième salle.
   Ce fichier ne contient AUCUN contenu du roman : tout vit dans etapes.json.

   Règle de conception : aucune réponse n'est écrite dans la page avant
   d'être trouvée — ni texte, ni attribut, ni classe. Les lettres gagnées
   ne sont créées dans le document qu'au moment de la récompense.
   ========================================================================= */
(function () {
  'use strict';

  var FICHIER = 'etapes.json';
  var CLE = 'lea-laprel-lecteur.v1';
  /* Le questionnaire du lecteur est une autre page, derrière la même
     porte. Cette clé lui dit qu'on l'a franchie — elle ne contient que
     l'empreinte publique du code, jamais le code. */
  var CLE_PORTE = 'lea-laprel-porte-classe.v1';

  var ENCOURAGEMENTS = [
    'Pas encore. Rouvrez le chapitre : la réponse y est.',
    'Non — et ça ne coûte rien. Reprenez le passage, vous y étiez presque.',
    'Ce n’est pas ça. Ne devinez pas : le roman tranche.',
    'Raté. Relisez la scène, elle est plus précise que votre souvenir.'
  ];

  var jeu = null, etat = null, essais = {};

  /* ------------------------------------------------------- Outils ------ */

  function $(id) { return document.getElementById(id); }

  function el(balise, options, enfants) {
    var n = document.createElement(balise), k;
    if (options) {
      for (k in options) {
        if (!Object.prototype.hasOwnProperty.call(options, k)) continue;
        var v = options[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k === 'texte') n.textContent = v;
        else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v);
        else if (v === true) n.setAttribute(k, '');
        else n.setAttribute(k, v);
      }
    }
    if (enfants) {
      var liste = Object.prototype.toString.call(enfants) === '[object Array]' ? enfants : [enfants];
      for (var i = 0; i < liste.length; i++) {
        var c = liste[i];
        if (c === null || c === undefined || c === false) continue;
        n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return n;
  }

  function vider(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function annoncer(t) { var z = $('annonces'); if (z) z.textContent = t; }

  /* Comparaison souple : casse, accents, ponctuation, espaces. */
  var SANS = 'aaaaaaceeeeiiiinooooouuuuyy';
  var TABLE = null;
  function sansAccents(s) {
    if (!TABLE) {
      var src = 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ';
      TABLE = {};
      for (var i = 0; i < src.length; i++) TABLE[src.charAt(i)] = SANS.charAt(i);
    }
    var out = '';
    for (var j = 0; j < s.length; j++) {
      var c = s.charAt(j);
      out += TABLE[c] !== undefined ? TABLE[c] : c;
    }
    return out;
  }
  function normaliser(v) {
    var s = String(v === null || v === undefined ? '' : v).toLowerCase();
    s = s.replace(/œ/g, 'oe').replace(/æ/g, 'ae');
    s = sansAccents(s);
    return s.replace(/[^a-z0-9]+/g, ' ').replace(/^ | $/g, '');
  }

  /* Nombres écrits en lettres, pour accepter « vingt-sept » comme « 27 ». */
  var MOTS_NOMBRES = {
    zero: 0, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
    dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
    vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
    cent: 100, cents: 100, mille: 1000
  };
  function estEntier(m) { return /^[0-9]+$/.test(m); }
  function nombresDe(reponse) {
    var mots = normaliser(reponse).split(' '), trouves = [], i = 0;
    while (i < mots.length) {
      var mot = mots[i];
      if (!mot) { i++; continue; }
      if (estEntier(mot)) { trouves.push(parseInt(mot, 10)); i++; continue; }
      if (MOTS_NOMBRES[mot] === undefined) { i++; continue; }
      var total = 0, groupe = 0, precedent = '';
      while (i < mots.length) {
        var m = mots[i];
        if (m === 'et') {
          if (i + 1 < mots.length && MOTS_NOMBRES[mots[i + 1]] !== undefined) { i++; continue; }
          break;
        }
        var v = MOTS_NOMBRES[m];
        if (v === undefined) break;
        if (v === 100) groupe = (groupe === 0 ? 1 : groupe) * 100;
        else if (v === 1000) { total += (groupe === 0 ? 1 : groupe) * 1000; groupe = 0; }
        else if (v === 20 && precedent === 'quatre') groupe = groupe - 4 + 80;
        else groupe += v;
        precedent = m; i++;
      }
      trouves.push(total + groupe);
    }
    return trouves;
  }

  /* Une réponse est juste si elle égale la solution, l'une des variantes,
     ou — pour une solution numérique — si elle contient ce seul nombre. */
  /* --- Une empreinte plutôt qu'un mot en clair ---------------------
     Le code de la classe est imprimé dans le livre : il n'a pas à dormir
     en clair dans etapes.json, où le premier curieux le lirait sans
     ouvrir le roman. On y range son empreinte SHA-256, et le navigateur
     compare les empreintes. Elle est calculée ici, en synchrone : le
     fichier autonome s'ouvre parfois depuis le disque, où l'API de
     chiffrement du navigateur n'est pas disponible.
     Pour changer de code : node outils/empreinte.js <le nouveau code>.
     Cela protège de la lecture, pas d'un essai systématique — le
     contrôle se fait chez le lecteur, c'est la règle du jeu. */
  var SEL_PORTE = 'lea-laprel·porte·2027';

  /* La phrase de la finale ne dort pas non plus en clair : etapes.json
     n'en porte qu'un SAC de lettres (trié, donc muet sur l'ordre), un
     GABARIT « .... .... .’..... » pour le dernier indice, et cette
     empreinte.

     CE QUE CELA PROTÈGE, ET CE QUE CELA NE PROTÈGE PAS. Cela empêche de
     LIRE la fin : ouvrir le fichier de l'ENT dans un éditeur de texte
     ne donne plus rien. Cela n'empêche pas de la DEVINER par programme :
     le sel, le nombre de tours, le sac et le gabarit partent en ligne
     avec le reste, et le gabarit (4+4+1+5) croisé au vocabulaire du
     roman ne laisse que quelques centaines de phrases possibles —
     l'empreinte en désigne alors une, en quelques secondes. Quatre
     mille tours ne changent rien à cette échelle : ils ne sont là que
     pour écarter l'essai systématique bête, et pour que la
     vérification reste imperceptible au joueur (environ 100 ms).

     Autrement dit : une serrure contre la curiosité, pas contre
     quelqu'un qui écrit trente lignes de code. C'est le bon niveau
     pour un jeu de classe ; ce n'en serait pas un pour un secret.
     Pour la recalculer : node outils/phrase-finale.js. */
  var SEL_PHRASE = 'lea-laprel·phrase·2027';
  var TOURS_PHRASE = 4096;

  function sha256Hex(message) {
    var K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    var o = [], i, c;
    for (i = 0; i < message.length; i++) {
      c = message.charCodeAt(i);
      if (c < 0x80) o.push(c);
      else if (c < 0x800) o.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0xd800 || c >= 0xe000) o.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else {
        i++;
        var cp = 0x10000 + (((c & 0x3ff) << 10) | (message.charCodeAt(i) & 0x3ff));
        o.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      }
    }
    var bits = o.length * 8;
    o.push(0x80);
    while (o.length % 64 !== 56) o.push(0);
    o.push(0, 0, 0, 0, (bits >>> 24) & 255, (bits >>> 16) & 255, (bits >>> 8) & 255, bits & 255);
    var w = new Array(64), b, t;
    for (b = 0; b < o.length; b += 64) {
      for (t = 0; t < 16; t++) {
        w[t] = (o[b + t * 4] << 24) | (o[b + t * 4 + 1] << 16) | (o[b + t * 4 + 2] << 8) | o[b + t * 4 + 3];
      }
      for (t = 16; t < 64; t++) {
        var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = H[0], bb = H[1], cc = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[t] + w[t]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & bb) ^ (a & cc) ^ (bb & cc);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + cc) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var sortie = '';
    for (i = 0; i < 8; i++) sortie += ('00000000' + (H[i] >>> 0).toString(16)).slice(-8);
    return sortie;
  }

  /* L'empreinte d'un ordre de tuiles. Même recette que
     outils/phrase-finale.js, sel et nombre de tours compris : si l'une
     bouge, l'autre doit bouger avec elle. */
  function empreintePhrase(lettres) {
    var h = String(lettres || '').toUpperCase().replace(/[’']/g, '').replace(/[^A-ZÀ-ÝŒ]/g, '') + SEL_PHRASE;
    for (var i = 0; i < TOURS_PHRASE; i++) h = sha256Hex(h);
    return h;
  }

  function repondJuste(saisi, champ) {
    var n = normaliser(saisi);
    if (!n) return false;
    /* une empreinte remplace entièrement la solution en clair */
    if (champ.empreinte) return sha256Hex(n + SEL_PORTE) === String(champ.empreinte).toLowerCase();
    if (n === normaliser(champ.solution)) return true;
    var v = champ.variantes || [];
    for (var i = 0; i < v.length; i++) if (n === normaliser(v[i])) return true;
    if (champ.reponseNumerique === true) {
      var attendu = normaliser(champ.solution);
      if (!estEntier(attendu)) return false;
      var trouves = nombresDe(saisi), distincts = [];
      for (var k = 0; k < trouves.length; k++) if (distincts.indexOf(trouves[k]) === -1) distincts.push(trouves[k]);
      return distincts.length === 1 && distincts[0] === parseInt(attendu, 10);
    }
    return false;
  }

  /* ---- mélange déterministe, jamais l'ordre juste ni presque juste ---- */
  function graine(t) {
    var h = 2166136261;
    for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return h >>> 0;
  }
  function generateur(g) {
    var x = g >>> 0; if (x === 0) x = 0x9E3779B9;
    return function () { x ^= (x << 13); x >>>= 0; x ^= (x >>> 17); x ^= (x << 5); x >>>= 0; return x / 4294967296; };
  }
  function permutation(n, g) {
    var t = [], i; for (i = 0; i < n; i++) t.push(i);
    var r = generateur(g);
    for (i = n - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var tmp = t[i]; t[i] = t[j]; t[j] = tmp; }
    return t;
  }
  function horsPlace(p) { var c = 0; for (var i = 0; i < p.length; i++) if (p[i] !== i) c++; return c; }
  /* L'ORDRE DES PROPOSITIONS.
     Les options s'affichaient dans l'ordre où l'auteur les avait
     écrites — et la bonne venait presque toujours en tête : sur les
     soixante et une questions d'étude, elle était première soixante et
     une fois. Un élève qui cliquait toujours le premier bouton avait
     tout juste sans lire une ligne.

     On mélange donc à l'affichage, avec la graine de la partie : deux
     équipes n'ont pas le même ordre, et la même équipe retrouve le sien
     en reprenant, puisque la graine voyage dans son code.

     Permutation UNIFORME, et non le dérangement de melange() : un
     dérangement garantirait que la bonne réponse n'est jamais à sa
     place d'origine — « jamais la première » s'apprend aussi vite que
     « toujours la première ».

     « Vrai / Faux » garde son ordre : ces deux mots-là veulent dire
     quelque chose, et leur réponse est déjà partagée. */
  function optionsMelangees(options, format, cle) {
    if (!options || options.length < 2) return options;
    if (format === 'vraifaux') return options;
    var g = (etat && etat.graine) ? etat.graine : 0;
    var p = permutation(options.length, graine(cle + '|opt|' + g));
    var out = [];
    for (var i = 0; i < p.length; i++) out.push(options[p[i]]);
    return out;
  }

  function melange(n, cle) {
    var i, p;
    if (n < 2) { p = []; for (i = 0; i < n; i++) p.push(i); return p; }
    var base = graine(cle);
    for (i = 0; i < 400; i++) { p = permutation(n, (base + i * 2654435761) >>> 0); if (horsPlace(p) === n) return p; }
    for (i = 0; i < 400; i++) { p = permutation(n, (base + i * 40503) >>> 0); if (horsPlace(p) >= 3) return p; }
    p = []; for (i = 0; i < n; i++) p.push((i + 1) % n); return p;
  }

  /* --------------------------------------------------- Sauvegarde ----- */

  /* La signature change dès que la structure du jeu change : une partie
     commencée sur une version antérieure est écartée, pas rejouée de travers. */
  function signature(d) {
    return ['v4', d.titreJeu, d.etapes.length, d.lettres, Object.keys(d.versions || {}).join(',')].join('|');
  }

  function etatNeuf() {
    return {
      version: 1, signature: signature(jeu),
      mode: null,              /* 'public' ou 'eleves' */
      commence: false, entre: false,
      etape: 0, reussies: {}, travaux: {}, indices: {},
      ecouleMs: 0,             /* minuteur, version élèves seulement */
      ouvertes: 0,             /* parcours : dernier chapitre ouvert par le professeur */
      repriseVue: false,       /* parcours : l'offre de reprise a déjà été proposée */
      graine: 0,               /* le tirage des lettres de cette partie */
      boite: [],               /* les lettres gagnées, dans l'ordre où elles sont tombées */
      finale: 0, termine: false
    };
  }

  /* ---- Les deux versions : grand public et élèves ---- */

  function reglages() {
    var v = (jeu.versions || {})[etat.mode] || {};
    return v;
  }
  function estEleves() { return etat.mode === 'eleves'; }

  /* Le livrable mis en ligne ne contient que le grand public : il n'y a
     alors aucune version à choisir, et rien à proposer d'en changer. */
  function versionUnique() {
    var n = 0, v = jeu.versions || {};
    for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) n++;
    return n < 2;
  }

  /* Les chapitres réellement joués. Le professeur peut n'en retenir
     qu'une partie, par le fichier (versions.<version>.chapitres). */
  /* Une salle peut être réservée à une version : champ `versions` de
     l'étape, par exemple ["eleves"]. Sans ce champ, elle est ouverte aux
     deux. */
  function salleOuverteIci(e) {
    var v = e && e.versions;
    if (!v || !v.length) return true;
    return v.indexOf(etat.mode) !== -1;
  }

  /* --- Le mode parcours -------------------------------------------
     La classe peut jouer le jeu d'un trait, ou l'étaler : une salle
     après chaque chapitre lu. Dans ce second cas (versions.eleves.
     parcours), le professeur ouvre les salles au fil des semaines avec
     un code « CODE-5 » — le chiffre est le numéro du CHAPITRE lu, pas
     celui de la salle : le chapitre V en ouvre deux (V et V bis), et le
     chapitre IX n'en ouvre aucune. Les lettres des salles encore
     fermées ne sont pas offertes : elles attendent, et la finale reste
     close tant que la phrase n'est pas gagnée. */
  function enParcours() { return !!etat && estEleves() && reglages().parcours === true; }

  var CHIFFRES_ROMAINS = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  function rangRomain(texte) {
    var s = String(texte || '').toUpperCase().replace(/\s*BIS\s*$/, '').trim();
    if (!/^[IVXLCDM]+$/.test(s)) return 0;
    var total = 0, i, v, suivant;
    for (i = 0; i < s.length; i++) {
      v = CHIFFRES_ROMAINS[s.charAt(i)];
      suivant = i + 1 < s.length ? CHIFFRES_ROMAINS[s.charAt(i + 1)] : 0;
      total += v < suivant ? -v : v;
    }
    return total;
  }
  /* Le numéro de chapitre d'une salle, « V bis » compris. */
  function chapitreDe(e) { return rangRomain(e && e.chapitre); }

  function listeEtapes() {
    var tous = [], i;
    for (i = 0; i < jeu.etapes.length; i++) {
      if (salleOuverteIci(jeu.etapes[i])) tous.push(i);
    }
    if (!estEleves()) return tous;

    /* parcours : on ne garde que les salles des chapitres déjà ouverts.
       Une salle sans chapitre lisible (la séance bonus) vient en dernier
       et n'apparaît qu'une fois toutes les lettres gagnées. */
    if (enParcours()) {
      var plafond = Number(etat.ouvertes || 0);
      var garde = [];
      for (i = 0; i < tous.length; i++) {
        var e = jeu.etapes[tous[i]];
        var ch = chapitreDe(e);
        if (e.bonus === true) { if (phraseGagnee()) garde.push(tous[i]); continue; }
        if (ch && ch <= plafond) garde.push(tous[i]);
      }
      return garde;
    }
    /* Une séance raccourcie se règle par le fichier (versions.<v>.
       chapitres). L'adresse « ?etapes=1,5,9 » existait aussi : elle est
       retirée. Elle ne servait plus — la classe passe par les codes
       CODE-N, chapitre par chapitre, et le grand public sort de cette
       fonction bien avant d'y arriver. */
    var choix = reglages().chapitres || null;
    if (!choix || !choix.length) return tous;
    var garde = [];
    for (i = 0; i < choix.length; i++) {
      var n = choix[i] - 1;
      if (n >= 0 && n < jeu.etapes.length && garde.indexOf(n) === -1 &&
          salleOuverteIci(jeu.etapes[n])) garde.push(n);
    }
    garde.sort(function (a, b) { return a - b; });
    return garde.length ? garde : tous;
  }
  function sauver() { try { window.localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) {} }
  function charger() {
    try {
      var b = window.localStorage.getItem(CLE);
      if (!b) return null;
      var l = JSON.parse(b);
      return l && l.signature === signature(jeu) ? l : null;
    } catch (e) { return null; }
  }
  function effacer() { try { window.localStorage.removeItem(CLE); } catch (e) {} }

  /* --------------------------------------------- La phrase à former --- */

  /* Une lettre est acquise si son étape a été réussie — ou, hors parcours,
     si le professeur a retiré ce chapitre de la séance : une séance courte
     doit rester formable. En parcours, au contraire, les lettres encore
     fermées attendent : c'est la phrase qui se construit de semaine en
     semaine. */
  function etatDesLettres() {
    var jouees = listeEtapes(), out = [], gagnees = 0, aJouer = 0;
    for (var i = 0; i < jeu.etapes.length; i++) {
      var e = jeu.etapes[i];
      /* Une salle de passage ne donne pas de lettre : elle traverse la
         phrase sans y laisser de case. */
      if (!e.lettre) continue;
      /* Une salle réservée à l'autre version non plus : le chapitre III
         a deux salles, une par version, et une seule lettre. */
      if (!salleOuverteIci(e)) continue;
      var dansLaSeance = jouees.indexOf(i) > -1;
      if (dansLaSeance) aJouer++;
      if (etat.reussies['e' + i]) { out.push('gagnee'); gagnees++; }
      /* Hors parcours, une salle écartée de la séance offre sa lettre :
         une séance courte doit pouvoir former la phrase. En parcours,
         elle attend son tour — c'est tout l'intérêt. */
      else if (!dansLaSeance && !enParcours()) out.push('offerte');
      else out.push('attente');
    }
    return { cases: out, gagnees: gagnees, aJouer: aJouer };
  }

  /* Toutes les lettres de cette version sont-elles gagnées ? */
  function phraseGagnee() {
    if (!etat || !etat.reussies) return false;
    for (var i = 0; i < jeu.etapes.length; i++) {
      var e = jeu.etapes[i];
      if (!e.lettre || !salleOuverteIci(e)) continue;
      if (!etat.reussies['e' + i]) return false;
    }
    return true;
  }

  function majBandeau() {
    var zone = $('phrase');
    vider(zone);
    if (!etat.mode || !etat.entre) { zone.hidden = true; return; }
    zone.hidden = false;
    /* LA BOÎTE. Plus de cases vides en forme de phrase : elles disaient
       le nombre de mots, leurs longueurs, et jusqu'à la place de
       l'apostrophe — autant dire la réponse. Les lettres gagnées
       s'entassent ici, en vrac, dans l'ordre où elles sont tombées. */
    var lettres = boite();
    zone.appendChild(el('span', { class: 'boite-nom', texte: lettres.length ? 'Votre boîte' : 'Votre boîte est vide' }));
    lettres.forEach(function (L) {
      zone.appendChild(el('span', { class: 'case trouvee', texte: L }));
    });
    zone.setAttribute('aria-label', lettres.length
      ? 'Votre boîte : ' + lettres.join(', ')
      : 'Votre boîte est vide');
    /* Un seul système de comptage dans tout le jeu : les ÉTAPES de la
       séance. Le bandeau disait « 1 / 14 » (des lettres) pendant que le
       titre annonçait « étape 2 sur 15 » (des salles) : deux unités,
       deux dénominateurs, et personne n'y comprenait rien. La phrase,
       elle, se lit dans les cases juste à côté. */
    var compte = $('compte-lettres');
    if (compte) {
      var jouees = listeEtapes(), faites = 0;
      for (var k = 0; k < jouees.length; k++) if (etat.reussies['e' + jouees[k]]) faites++;
      compte.textContent = faites + ' / ' + jouees.length;
      compte.setAttribute('aria-label', faites + ' étape' + (faites > 1 ? 's' : '') +
        ' réussie' + (faites > 1 ? 's' : '') + ' sur ' + jouees.length);
      compte.setAttribute('title', 'Étapes réussies');
    }
  }

  /* ---------------------------------------- Minuteur (version élèves) -- */

  var horloge = null, dernierTop = 0, ticks = 0;

  function demarrerHorloge() {
    if (horloge || !estEleves() || etat.termine) return;
    dernierTop = Date.now();
    horloge = window.setInterval(battement, 1000);
    majChrono();
  }
  function arreterHorloge() { if (horloge) { window.clearInterval(horloge); horloge = null; } }
  function battement() {
    var n = Date.now();
    etat.ecouleMs += n - dernierTop;
    dernierTop = n;
    majChrono();
    if (++ticks % 5 === 0) sauver();
  }
  function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
  function majChrono() {
    var z = $('chrono');
    if (!z) return;
    if (!estEleves()) { z.hidden = true; return; }
    z.hidden = false;
    /* minutesParEtape suit la sélection de chapitres du professeur :
       six chapitres ne demandent pas la même séance que quatorze. */
    var r = reglages();
    var duree = (r.minutesParEtape ? r.minutesParEtape * listeEtapes().length : (r.dureeMinutes || 55)) * 60000;
    var reste = duree - etat.ecouleMs;
    if (reste <= 0) { z.textContent = 'temps écoulé'; z.classList.add('ecoule'); return; }
    var s = Math.floor(reste / 1000);
    z.textContent = pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
    z.classList.toggle('bientot', reste < 5 * 60000);
  }

  /* ------------------------------------------------------- Les salles ---- */

  /* Une étape, c'est une SALLE : son illustration en grand, et sur elle des
     repères — des touches posées sur les objets. On presse un objet, un
     volet s'ouvre : le texte du roman d'un côté, l'énigme de l'autre. Tout
     résolu, la salle s'ouvre et l'on passe au niveau suivant.

     L'étape nomme son lieu (« lieu-05 ») et place ses repères dans le champ
     `salle` : x, y en fractions de l'image horizontale, qui est la seule
     image jouable. La version verticale ne sert plus qu'à remplir le fond
     des écrans étroits, derrière la salle.

     Les `masques` couvrent, dans l'image, le détail qui donnerait la
     réponse : le 27 de la porte, le javelot planté dans le pot de fleurs,
     la canne brisée, les deux pigeons. Ils se lèvent à la réussite. */

  var OUVERTURE = 1800;   /* le temps de voir la salle s'ouvrir, en ms */

  function cheminImage(nom, suffixe) {
    var chemin = 'images/' + nom + '-' + suffixe + '.webp';
    /* dans la version « un seul fichier », les images sont embarquées */
    var integrees = window.IMAGES_INTEGREES;
    return (integrees && integrees[chemin]) || chemin;
  }

  /* Le fond de page : soit l'image en grand et nette (accueil, récompense,
     révélation), soit un remplissage flou derrière une salle. */
  function poserFond(nom, mode) {
    var hote = $('fond');
    if (!hote) return;
    vider(hote);
    document.body.classList.remove('avec-image', 'fond-net', 'fond-remplissage');
    if (!nom || !mode) return;
    document.body.classList.add('avec-image', 'fond-' + mode);
    hote.appendChild(el('picture', {}, [
      el('source', {
        media: '(orientation: portrait), (max-width: 760px)',
        srcset: cheminImage(nom, 'v')
      }),
      el('img', {
        src: cheminImage(nom, 'h'), alt: '', decoding: 'async',
        /* une image manquante ne doit pas laisser un écran noir :
           la page reprend simplement sa couleur de papier */
        onerror: function () {
          document.body.classList.remove('avec-image', 'fond-net', 'fond-remplissage');
        }
      })
    ]));
  }

  /* Les repères d'une salle. Sans données, une touche au centre : le jeu
     reste jouable, et le bandeau d'avertissement le signale. */
  function touchesDe(e, avecTexte) {
    var salle = e.salle || {};
    var liste = (salle.touches || []).filter(function (t) {
      return t.cle !== 'texte' || avecTexte;
    });
    if (!liste.length) liste = [{ cle: 'enigme', libelle: 'L’énigme', x: 0.5, y: 0.5 }];
    return liste;
  }

  /* Le plateau : l'image entière — jamais rognée, pour qu'aucun repère ne
     sorte du cadre — et par-dessus les masques et les touches. */
  function monterPlateau(nom, e, touches, ouvrir) {
    var plateau = el('div', { class: 'plateau' });
    plateau.appendChild(el('img', {
      class: 'plateau-image', src: cheminImage(nom, 'h'), alt: '', decoding: 'async',
      /* Une illustration qui manque ne doit pas laisser un trou noir :
         la salle se joue quand même, sur une plaque sombre. */
      onerror: function () { plateau.classList.add('sans-image'); }
    }));
    ((e.salle || {}).masques || []).forEach(function (m) {
      plateau.appendChild(el('div', {
        class: 'masque', 'aria-hidden': 'true',
        style: 'left:' + ((m.x - m.l / 2) * 100) + '%;top:' + ((m.y - m.h / 2) * 100) +
          '%;width:' + (m.l * 100) + '%;height:' + (m.h * 100) + '%'
      }));
    });
    var boutons = {};
    touches.forEach(function (t) {
      var b = el('button', {
        type: 'button', class: 'touche touche-' + t.cle,
        style: 'left:' + (t.x * 100) + '%;top:' + (t.y * 100) + '%;' +
          '--rayon:' + ((t.r || 0.045) * 100) + '%',
        'aria-label': t.libelle,
        onclick: function () { ouvrir(t.cle); }
      }, [
        el('span', { class: 'touche-pastille', 'aria-hidden': 'true' }),
        el('span', { class: 'touche-nom', 'aria-hidden': 'true', texte: t.libelle })
      ]);
      boutons[t.cle] = b;
      plateau.appendChild(b);
    });
    return { noeud: plateau, boutons: boutons };
  }

  /* Un volet : le panneau qui s'ouvre par-dessus la salle. */
  function monterVolet(titre, contenu, actions) {
    var h = el('h3', { tabindex: '-1', texte: titre });
    var rendre = null;
    var cadre = el('div', { class: 'volet-cadre' }, [
      el('div', { class: 'volet-entete' }, [
        h,
        el('button', {
          type: 'button', class: 'volet-fermer', 'aria-label': 'Fermer', texte: '✕',
          onclick: function () { api.fermer(); }
        })
      ]),
      el('div', { class: 'volet-corps' }, contenu),
      actions && actions.length ? el('div', { class: 'ligne-actions volet-actions' }, actions) : null
    ]);
    var noeud = el('div', {
      class: 'volet', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': titre,
      onkeydown: function (ev) { if (ev.key === 'Escape') { ev.stopPropagation(); api.fermer(); } },
      onclick: function (ev) { if (ev.target === noeud) api.fermer(); }
    }, [cadre]);

    var api = {
      noeud: noeud,
      ouvrir: function (retour) {
        rendre = retour || null;
        noeud.hidden = false;
        document.body.classList.add('volet-ouvert');
        /* sans cela, le navigateur fait défiler la page derrière le volet */
        try { h.focus({ preventScroll: true }); } catch (err) { h.focus(); }
      },
      fermer: function () {
        noeud.hidden = true;
        document.body.classList.remove('volet-ouvert');
        if (rendre && rendre.focus) rendre.focus();
      },
      ouvert: function () { return !noeud.hidden; }
    };
    return api;
  }

  /* -------------------------------------------------------- Écrans ---- */

  function montrer(noeud) {
    var scene = $('scene');
    vider(scene);
    scene.appendChild(noeud);
    /* L'illustration du lieu passe en fond de page. Sans lieu, la page
       reprend simplement sa couleur de papier. */
    var lieu = noeud.getAttribute ? noeud.getAttribute('data-image') : null;
    poserFond(lieu, noeud.getAttribute ? noeud.getAttribute('data-fond') : null);
    majBandeau();
    majChrono();
    var t = noeud.querySelector('h2');
    if (t) t.focus();
    if (window.scrollTo) window.scrollTo(0, 0);
    var r = $('btn-recommencer');
    if (r) {
      r.hidden = !etat.mode;
      r.textContent = versionUnique() ? 'Tout recommencer' : 'Changer de version';
    }
  }

  function rienDeGagne() {
    for (var k in etat.reussies) if (Object.prototype.hasOwnProperty.call(etat.reussies, k)) return false;
    return true;
  }

  function ecranCourant() {
    if (!etat.mode) return montrerAccueil();
    if (!etat.entre) return montrerPorte();
    /* Appareil neuf : avant de commencer, on demande si l'équipe a déjà
       un code. Une seule fois — ensuite on ne l'importune plus. */
    if (enParcours() && !etat.repriseVue && rienDeGagne()) return montrerReprise();
    if (etat.etape < listeEtapes().length) { demarrerHorloge(); return montrerEtape(etat.etape); }
    /* En parcours, la fin des salles ouvertes n'est pas la fin du jeu :
       la finale attend que la phrase entière soit gagnée. */
    if (enParcours() && !phraseGagnee()) return montrerFinSeance();
    return montrerFinale();
  }

  /* --- Parcours : reprendre sur un autre appareil --- */
  function montrerReprise() {
    var champ = el('input', {
      type: 'text', class: 'champ-saisie', autocomplete: 'off', autocapitalize: 'characters',
      spellcheck: 'false', maxlength: '9', 'aria-label': 'Code d’équipe, sept caractères'
    });
    var retour = el('p', { class: 'retour', hidden: true });

    function reprendre() {
      var lu = lireCodeEquipe(champ.value);
      if (!lu) {
        retour.hidden = false;
        retour.setAttribute('data-ton', 'echec');
        retour.textContent = 'Ce code ne ressemble à rien de connu. Sept caractères, recopiés de la fiche.';
        champ.focus(); champ.select();
        return;
      }
      var n = appliquerCodeEquipe(lu);
      etat.repriseVue = true;
      sauver();
      montrerPasserelle(
        n ? 'Votre équipe retrouve ' + n + ' salle' + (n > 1 ? 's' : '') + ' déjà ouverte' + (n > 1 ? 's' : '') + '.'
          : 'Ce code ne porte encore aucune salle gagnée.',
        'Continuer', function () { ecranCourant(); });
    }

    montrer(el('section', { class: 'ecran' }, [
      el('p', { class: 'sur-titre', texte: 'Votre équipe' }),
      el('h2', { tabindex: '-1', texte: 'Avez-vous déjà un code d’équipe ?' }),
      el('p', { class: 'narration', texte: 'Si votre équipe a joué lors d’une séance précédente, recopiez ici les sept caractères notés sur votre fiche. Vous retrouverez vos salles ET vos lettres sur cet appareil. Sinon, commencez : le code vous sera donné après la première salle.' }),
      el('div', { class: 'ligne-saisie' }, [champ]),
      retour,
      el('div', { class: 'ligne-actions' }, [
        el('button', { type: 'button', class: 'bouton', texte: 'Reprendre', onclick: reprendre }),
        el('button', {
          type: 'button', class: 'bouton bouton-secondaire', texte: 'Commencer sans code',
          onclick: function () { etat.repriseVue = true; sauver(); ecranCourant(); }
        })
      ])
    ]));
    champ.focus();
  }

  /* --- Parcours : la séance s'arrête, le jeu continue --- */
  function montrerFinSeance() {
    var p = etatDesLettres();
    var restantes = p.cases.length - p.gagnees;
    montrer(el('section', { class: 'ecran' }, [
      el('p', { class: 'sur-titre', texte: 'Fin de la séance' }),
      el('h2', { tabindex: '-1', texte: p.gagnees + ' lettre' + (p.gagnees > 1 ? 's' : '') + ' sur ' + p.cases.length }),
      el('p', { class: 'narration', texte: restantes === 1
        ? 'Il reste une salle à ouvrir. La phrase se complétera la prochaine fois.'
        : 'Il reste ' + restantes + ' salles à ouvrir. Votre professeur donnera le code de la prochaine après le chapitre suivant.' }),
      el('p', { class: 'code-equipe' }, [
        document.createTextNode('Code d’équipe à noter sur votre fiche : '),
        el('strong', { texte: codeEquipe() })
      ]),
      el('div', { class: 'ligne-actions' }, [
        /* La semaine suivante, l'appareil se souvient : il entre tout
           seul et ne redemande rien. Sans ce bouton, une équipe n'aurait
           aucun moyen de donner le nouveau code du tableau. */
        el('button', {
          type: 'button', class: 'bouton', texte: 'Entrer le code de la séance suivante',
          onclick: function () { etat.entre = false; sauver(); montrerPorte(); }
        }),
        el('button', {
          type: 'button', class: 'bouton bouton-secondaire', texte: 'Revoir les salles déjà ouvertes',
          onclick: function () { etat.etape = 0; sauver(); ecranCourant(); }
        })
      ])
    ]));
  }

  /* --- Accueil : deux portes --- */

  function montrerAccueil() {
    arreterHorloge();
    var reprise = etat.mode && (etat.entre || etat.etape > 0);
    var versions = jeu.versions || {};
    /* Une seule version — c'est le cas du livrable mis en ligne : il n'y
       a rien à choisir, on entre directement. */
    var seules = [];
    for (var nom in versions) if (Object.prototype.hasOwnProperty.call(versions, nom)) seules.push(nom);
    if (!reprise && seules.length === 1) {
      etat.mode = seules[0];
      etat.commence = true;
      sauver();
      return montrerPorte();
    }
    /* La boîte fermée, nette : elle ne cache aucune réponse. */
    var section = el('section', {
      class: 'ecran accueil', 'data-image': jeu.image || null, 'data-fond': 'net'
    }, [
      el('p', { class: 'sur-titre', texte: 'Escape game' }),
      el('h2', { tabindex: '-1', texte: jeu.titreJeu || '' }),
      jeu.sousTitre ? el('p', { class: 'narration', texte: jeu.sousTitre }) : null
    ]);

    if (reprise) {
      var nom = (versions[etat.mode] || {}).nom || etat.mode;
      section.appendChild(el('div', { class: 'consigne-lecture' }, [
        el('strong', { texte: 'Une partie est en cours' }),
        el('p', { texte: 'Version « ' + nom + ' » — ' + etatDesLettres().gagnees + ' lettre(s) déjà gagnée(s).' })
      ]));
      section.appendChild(el('div', { class: 'ligne-actions' }, [
        el('button', {
          class: 'bouton bouton-large', type: 'button', texte: 'Reprendre',
          onclick: function () { ecranCourant(); }
        }),
        el('button', { class: 'bouton bouton-secondaire', type: 'button', texte: 'Changer de version', onclick: recommencer })
      ]));
      montrer(section);
      return;
    }

    section.appendChild(el('p', { class: 'consigne-portes', texte: 'Deux entrées. Choisissez la vôtre.' }));
    var portes = el('div', { class: 'portes' });
    ['public', 'eleves'].forEach(function (mode) {
      var v = versions[mode];
      if (!v) return;
      var carte = el('button', {
        type: 'button', class: 'porte-carte',
        onclick: function () { etat.mode = mode; etat.commence = true; sauver(); ecranCourant(); }
      }, [
        el('span', { class: 'porte-titre', texte: v.nom || mode }),
        el('span', { class: 'porte-sous', texte: v.description || '' })
      ]);
      portes.appendChild(carte);
    });
    section.appendChild(portes);
    /* Une ligne discrète, sous les deux portes : le questionnaire n'est
       pas une troisième entrée, c'est ce que le code du livre ouvre
       aussi. La porte publique, elle, n'y conduit pas. */
    if (questionnaireDisponible() && (jeu.questionnaire || {}).annonceAccueil) {
      section.appendChild(el('p', { class: 'annonce-questionnaire', texte: jeu.questionnaire.annonceAccueil }));
    }
    if (jeu.avertissement) {
      section.appendChild(el('p', { class: 'avertissement-fort', texte: jeu.avertissement }));
    }
    montrer(section);
  }

  /* --- Le tirage des lettres ---------------------------------------
     Les lettres ne tombent plus dans l'ordre de la phrase : chacune des
     quatorze salles en donne une, mais laquelle dépend d'un tirage
     propre à la partie. Autrement, trois salles suffisaient à deviner
     la fin — et le jeu entier tient sur cette fin.

     Le tirage découle d'une graine, et la graine voyage dans le code
     d'équipe : deux appareils, même graine, mêmes lettres. Le grand
     public tire la sienne à chaque partie. */
  function nouvelleGraine() {
    var n = 0;
    try {
      if (window.crypto && window.crypto.getRandomValues) {
        var t = new Uint32Array(1);
        window.crypto.getRandomValues(t);
        n = t[0];
      }
    } catch (e) {}
    if (!n) n = Math.floor(Math.random() * 4294967296);
    return (n % 4095) + 1;            /* 1 à 4095 : douze bits, jamais zéro */
  }

  /* mulberry32 : court, sans dépendance, et le même partout */
  function hasard(graine) {
    var a = graine >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Le sac de lettres à distribuer. Il est rangé dans etapes.json par
     ordre alphabétique : il dit de quoi la phrase est faite, jamais
     dans quel ordre. Le tirage le mélange ensuite pour chaque équipe. */
  function lettresDuSac() {
    return String(jeu.lettres || '').toUpperCase().replace(/[^A-ZÀ-ÝŒ]/g, '').split('');
  }

  /* Les salles qui donnent une lettre, dans l'ordre, pour cette version. */
  function sallesALettre() {
    var out = [];
    for (var i = 0; i < jeu.etapes.length; i++) {
      if (jeu.etapes[i].lettre && salleOuverteIci(jeu.etapes[i])) out.push(i);
    }
    return out;
  }

  var TIRAGE = null, TIRAGE_CLE = null;
  function tirage() {
    var cle = (etat && etat.mode ? etat.mode : '') + ':' + (etat && etat.graine ? etat.graine : 0);
    if (TIRAGE && TIRAGE_CLE === cle) return TIRAGE;
    var lettres = lettresDuSac();
    var r = hasard(Number(etat && etat.graine) || 1);
    for (var i = lettres.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = lettres[i]; lettres[i] = lettres[j]; lettres[j] = t;
    }
    var salles = sallesALettre(), m = {};
    for (var k = 0; k < salles.length; k++) m[salles[k]] = lettres[k] || '';
    TIRAGE = m; TIRAGE_CLE = cle;
    return m;
  }
  function lettreDe(i) { return tirage()[i] || ''; }

  /* La boîte : les lettres gagnées, dans l'ordre où elles sont tombées.
     Après une reprise, l'ordre d'obtention est perdu — le code ne porte
     que les salles — et l'on reprend l'ordre des salles. */
  /* Les lettres dues, dans l'ordre des salles. Hors parcours, une salle
     écartée de la séance donne quand même la sienne : une séance courte
     doit pouvoir finir. */
  function lettresGagnees() {
    var out = [], salles = sallesALettre(), jouees = listeEtapes();
    for (var k = 0; k < salles.length; k++) {
      var i = salles[k];
      if (etat.reussies['e' + i] || (!enParcours() && jouees.indexOf(i) === -1)) out.push(lettreDe(i));
    }
    return out;
  }

  /* La boîte : les mêmes lettres, mais dans l'ordre où elles sont
     tombées. Après une reprise cet ordre est perdu — le code ne porte
     que les salles — et l'on complète dans l'ordre des salles. */
  function boite() {
    var reste = lettresGagnees(), out = [];
    (etat.boite || []).forEach(function (L) {
      var k = reste.indexOf(L);
      if (k !== -1) { out.push(L); reste.splice(k, 1); }
    });
    return out.concat(reste);
  }

  /* --- Le code d'équipe -------------------------------------------
     Une classe joue sur le téléphone du jour, pas sur « son »
     appareil : la progression doit pouvoir voyager. À la fin de chaque
     salle, le jeu affiche sept caractères à noter sur la fiche
     d'équipe ; les retaper ailleurs rend les salles déjà gagnées ET
     le tirage des lettres. Six caractères portent les dix-sept salles
     (un bit chacune) et la graine du tirage (douze bits), le septième
     est une clé qui attrape les fautes de recopie. On évite
     I, L, O et U à l'affichage, et on les rattrape à la saisie : une
     fiche se recopie à la main, souvent mal. */
  var ALPHABET32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  /* Un voile sur les bits : sans lui, une équipe qui n'a gagné qu'une
     salle recopie « 00014 », et le code ressemble à une erreur plutôt
     qu'à un code. Il ne protège rien — il donne sa tête à la chose. */
  var VOILE = 0x1A5C3E7;   /* vingt-neuf bits : salles ET graine */

  function cleDe(corps) {
    var somme = 0;
    for (var i = 0; i < corps.length; i++) somme += ALPHABET32.indexOf(corps.charAt(i)) * (i + 1);
    return ALPHABET32.charAt(somme % 32);
  }

  /* Le code porte DEUX choses : les salles gagnées (dix-sept bits) et la
     graine du tirage (douze bits). Sans la graine, une équipe qui change
     d'appareil retrouverait ses salles mais d'autres lettres. Vingt-neuf
     bits : six caractères, plus la clé de contrôle — sept. */
  var SALLES_MAX = 17;
  var DEUX17 = Math.pow(2, SALLES_MAX);

  function codeEquipe() {
    var bits = 0, i;
    for (i = 0; i < jeu.etapes.length && i < SALLES_MAX; i++) {
      if (etat.reussies['e' + i]) bits += Math.pow(2, i);
    }
    var graine = (Number(etat.graine) || 0) % 4096;
    var valeur = ((graine * DEUX17 + bits) ^ VOILE) >>> 0;
    var corps = '';
    for (i = 5; i >= 0; i--) corps += ALPHABET32.charAt(Math.floor(valeur / Math.pow(32, i)) % 32);
    return corps + cleDe(corps);
  }

  function lireCodeEquipe(saisi) {
    var s = String(saisi || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
      .replace(/[IL]/g, '1').replace(/O/g, '0').replace(/U/g, 'V');
    if (s.length !== 7) return null;
    var corps = s.slice(0, 6), i;
    for (i = 0; i < 6; i++) if (ALPHABET32.indexOf(corps.charAt(i)) === -1) return null;
    if (cleDe(corps) !== s.charAt(6)) return null;
    var valeur = 0;
    for (i = 0; i < 6; i++) valeur = valeur * 32 + ALPHABET32.indexOf(corps.charAt(i));
    valeur = (valeur ^ VOILE) >>> 0;
    var graine = Math.floor(valeur / DEUX17) % 4096;
    if (!graine) return null;               /* une partie a toujours sa graine */
    return { salles: valeur % DEUX17, graine: graine };
  }

  /* Où reprendre ? À la première salle non gagnée de la séance — pas au
     début : une équipe qui revient avec son code n'a pas à retraverser
     ce qu'elle a déjà ouvert. */
  function premiereNonFaite() {
    var jouees = listeEtapes();
    for (var p = 0; p < jouees.length; p++) {
      if (!etat.reussies['e' + jouees[p]]) return p;
    }
    return jouees.length;
  }

  function appliquerCodeEquipe(lu) {
    var n = 0;
    etat.graine = lu.graine;
    TIRAGE = null;                       /* le tirage suit la graine */
    for (var i = 0; i < jeu.etapes.length && i < SALLES_MAX; i++) {
      if (Math.floor(lu.salles / Math.pow(2, i)) % 2) { etat.reussies['e' + i] = true; n++; }
    }
    etat.boite = [];                     /* l'ordre d'obtention est perdu */
    etat.etape = premiereNonFaite();
    sauver();
    return n;
  }

  /* --- La porte d'entrée --- */

  /* Le bouton de la porte annonce le nombre d'étapes RÉELLEMENT au
     programme : le professeur peut n'en retenir que quelques-unes, et la
     salle de passage « Au fond » n'existe qu'en classe. Promettre
     quatorze étapes à qui en jouera trois était un petit mensonge. */
  var NOMBRES_EN_LETTRES = ['zéro', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six',
    'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];

  function direNombre(n) {
    return NOMBRES_EN_LETTRES[n] || String(n);
  }

  function libelleEntree() {
    var n = listeEtapes().length;
    if (n === 1) return 'Commencer l’étape';
    return 'Commencer les ' + direNombre(n) + ' étapes';
  }

  /* --- Le questionnaire du lecteur ---------------------------------
     Il ne vit pas dans ce fichier : c'est une autre page, qui a son
     propre moteur. Ici, on sait seulement l'annoncer et y conduire.
     Il demande une messagerie et des liens vers l'extérieur : dans le
     fichier autonome de l'ENT, ouvert depuis une clé USB, il n'aurait
     aucun sens. On ne le propose donc pas hors ligne. */
  function questionnaireDisponible() {
    if (!jeu.questionnaire || !jeu.questionnaire.adresse) return false;
    try { if (window.location.protocol === 'file:') return false; } catch (e) { return false; }
    return true;
  }

  /* Le code seul ouvre deux choses. On explique chacune en une phrase,
     et on ne décide pas à la place du lecteur. */
  function montrerChoixClasse() {
    var q = jeu.questionnaire || {};
    var duJeu = q.jeu || {};
    function carte(titre, resume, action) {
      return el('button', { type: 'button', class: 'porte-carte', onclick: action }, [
        el('span', { class: 'porte-titre', texte: titre }),
        el('span', { class: 'porte-sous', texte: resume })
      ]);
    }
    var section = el('section', { class: 'ecran accueil', 'data-fond': 'net' }, [
      el('p', { class: 'sur-titre', texte: 'Le code du livre' }),
      el('h2', { tabindex: '-1', texte: 'Deux chemins s’ouvrent' }),
      el('p', { class: 'consigne-portes', texte: 'Choisissez le vôtre. Vous pourrez revenir à l’autre plus tard.' }),
      el('div', { class: 'portes' }, [
        carte(duJeu.titre || 'L’escape game', duJeu.resume || '', function () {
          montrerPasserelle(((reglages().entree || {}).apres) || '', libelleEntree(), function () { ecranCourant(); });
        }),
        carte(q.titre || 'Le questionnaire du lecteur', q.resume || '', function () {
          window.location.href = q.adresse;
        })
      ])
    ]);
    montrer(section);
  }

  function montrerPorte() {
    var porte = reglages().entree || jeu.porte || {};
    var champ = el('input', { type: 'text', class: 'champ-saisie champ-porte', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', 'aria-label': porte.libelle || 'Le mot d’entrée' });
    var retour = el('p', { class: 'retour', hidden: true });
    var zoneIndice = el('div');

    /* Le code de la classe, un tiret, puis le numéro du CHAPITRE que
       l'on vient de lire — « …-5 ». Le code seul rouvre ce qui l'était
       déjà. (On n'écrit pas le code ici : il ne doit figurer dans aucun
       fichier publié, commentaires compris.) */
    function ouvrirPorte(saisi) {
      var m = /^\s*(.*?)[\s–—.\-]+(\d{1,2})\s*$/.exec(String(saisi || ''));
      if (enParcours() && m && repondJuste(m[1], porte)) {
        return { ok: true, ouvertes: Math.max(1, Math.min(99, parseInt(m[2], 10))), avecNumero: true };
      }
      /* Le code SEUL — celui qui est imprimé à la dernière page du livre —
         ouvre tout le jeu : un lecteur qui n'a pas de professeur ne doit
         pas tomber sur une seule salle et croire le jeu cassé. Sur un
         appareil déjà cadencé par le professeur, il garde en revanche le
         rythme de la classe. C'est le NUMÉRO qui restreint, pas le code. */
      if (repondJuste(saisi, porte)) {
        if (!enParcours()) return { ok: true, ouvertes: null };
        var deja = Number(etat.ouvertes || 0);
        return { ok: true, ouvertes: deja > 0 ? deja : 99 };
      }
      return { ok: false };
    }

    function tenter() {
      var essai = ouvrirPorte(champ.value);
      if (essai.ok) {
        etat.entre = true;
        /* Chaque partie a son tirage : la graine naît ici, et ne change
           plus — sauf si une reprise en apporte une autre. */
        if (!etat.graine) { etat.graine = nouvelleGraine(); TIRAGE = null; }
        if (essai.ouvertes !== null && essai.ouvertes !== undefined) etat.ouvertes = essai.ouvertes;
        /* Nouvelle séance : on reprend là où la classe s'était arrêtée,
           pas au premier chapitre. */
        if (enParcours()) etat.etape = premiereNonFaite();
        /* Le questionnaire du lecteur vit sur une autre page, derrière la
           même porte. On lui laisse ici la preuve qu'elle a été franchie :
           il compare cette empreinte à celle qu'il lit dans etapes.json,
           et n'a donc pas à redemander le code. */
        if (estEleves() && porte.empreinte) {
          try { window.localStorage.setItem(CLE_PORTE, String(porte.empreinte)); } catch (e) {}
        }
        sauver();
        /* Le code SEUL ouvre deux portes : le jeu, ou le questionnaire.
           Le code suivi d'un numéro, lui, est l'ordre du professeur pour
           la séance du jour — on n'interrompt pas la classe avec un
           choix. */
        if (estEleves() && !essai.avecNumero && questionnaireDisponible()) {
          return montrerChoixClasse();
        }
        montrerPasserelle(porte.apres || '', libelleEntree(), function () { ecranCourant(); });
      } else {
        essais.porte = (essais.porte || 0) + 1;
        retour.hidden = false;
        retour.setAttribute('data-ton', 'echec');
        retour.textContent = porte.refus || 'Ce n’est pas le bon mot.';
        montrerIndice(zoneIndice, porte.indice);
        champ.focus();
        champ.select();
      }
    }

    champ.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); tenter(); } });

    /* La porte d'entrée est une salle elle aussi : on presse le fermoir de
       la boîte, et le volet demande le mot. */
    var section = el('section', {
      class: 'ecran salle porte', 'data-image': jeu.image || null, 'data-fond': 'remplissage'
    }, [
      el('p', { class: 'sur-titre', texte: (reglages().nom || 'La porte') }),
      el('h2', { tabindex: '-1', texte: porte.titre || 'Le couvercle' })
    ]);

    var volet = monterVolet(porte.titre || 'Le couvercle', [
      el('p', { class: 'narration', texte: porte.question || '' }),
      el('p', {}, [champ]),
      retour,
      zoneIndice
    ], [
      el('button', { class: 'bouton bouton-large', type: 'button', texte: porte.bouton || 'Ouvrir', onclick: tenter }),
      porte.indice ? el('button', { class: 'bouton bouton-secondaire', type: 'button', texte: 'Un indice', onclick: function () { montrerIndice(zoneIndice, porte.indice); } }) : null
    ]);
    section.appendChild(volet.noeud);

    var touches = touchesDe({ salle: jeu.salle }, false);
    var plateau = monterPlateau(jeu.image, { salle: jeu.salle }, touches, function () {
      volet.ouvrir(plateau.boutons[touches[0].cle]);
      champ.focus();
    });
    section.appendChild(plateau.noeud);
    section.appendChild(el('p', { class: 'salle-consigne', texte: 'Pressez le fermoir.' }));
    section.appendChild(el('ul', { class: 'salle-liste' }, [
      el('li', {}, [el('button', {
        type: 'button', class: 'bouton bouton-secondaire bouton-repere', texte: touches[0].libelle,
        onclick: function () { volet.ouvrir(plateau.boutons[touches[0].cle]); champ.focus(); }
      })])
    ]));
    section.appendChild(el('p', { class: 'aide-clavier' }, [
      versionUnique() ? null : el('button', { type: 'button', class: 'lien-discret', texte: '← Revenir au choix de la version', onclick: function () { etat.mode = null; sauver(); montrerAccueil(); } })
    ]));
    montrer(section);
  }

  /* Un indice à la fois. La version élèves en a deux : le second renvoie
     à la page du livre. */
  function montrerIndice(zone, textes) {
    var liste = Object.prototype.toString.call(textes) === '[object Array]' ? textes : [textes];
    liste = liste.filter(function (t) { return !!t; });
    if (!liste.length) return;
    var deja = zone.querySelectorAll('.indice').length;
    if (deja >= liste.length) return;
    var texte = liste[deja];
    zone.appendChild(el('div', { class: 'indice' }, [
      el('p', { class: 'indice-titre', texte: liste.length > 1 ? 'Indice ' + (deja + 1) + ' sur ' + liste.length : 'Indice' }),
      el('p', { texte: texte })
    ]));
    annoncer('Indice : ' + texte);
  }

  /* Deux indices, dans les deux versions : le premier oriente, le second
     donne la page du livre. Le second ne s'obtient qu'en redemandant —
     celui qui veut chercher cherche, celui qui s'enlise avance. */
  function indicesDe(e) {
    return e.indice2 ? [e.indice, e.indice2] : [e.indice];
  }

  /* --- Écran de transition (une phrase du roman, puis on continue) --- */

  /* `apres` est soit une phrase, soit { texte, trou } : un dernier mot à
     compléter, sans lettre à gagner — cf. le compte rendu du chapitre XIV. */
  /* `image` : le lieu que l'on vient de quitter reste au fond, net
     désormais, le temps de la transition. */
  function montrerPasserelle(apres, libelle, suite, lettre, image) {
    var texte = '', trou = null;
    if (apres && typeof apres === 'object') { texte = apres.texte || ''; trou = apres.trou || null; }
    else texte = apres || '';

    var bloc = el('section', {
      class: 'ecran passerelle', 'data-image': image || null, 'data-fond': 'net'
    }, [
      el('p', { class: 'sur-titre', texte: lettre ? 'Étape réussie' : 'Ouvert' }),
      el('h2', { tabindex: '-1', texte: lettre ? 'Vous gagnez une lettre' : 'C’est bien ça' })
    ]);
    if (lettre) bloc.appendChild(el('p', { class: 'lettre-gagnee', texte: lettre }));
    if (texte) bloc.appendChild(el('p', { class: 'citation', texte: texte }));
    /* En parcours, la progression doit pouvoir changer d'appareil : on
       donne le code d'équipe après chaque salle, pas seulement à la fin
       de la séance — une équipe peut s'arrêter n'importe quand. */
    if (enParcours() && lettre !== undefined) {
      bloc.appendChild(el('p', { class: 'code-equipe' }, [
        document.createTextNode('Code d’équipe à noter sur votre fiche : '),
        el('strong', { texte: codeEquipe() })
      ]));
    }

    var champ = null, retour = null;
    if (trou) {
      champ = el('input', {
        type: 'text', class: 'champ-saisie champ-trou', autocomplete: 'off',
        autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Le mot manquant'
      });
      bloc.appendChild(el('p', { class: 'phrase-trous phrase-trous-seule' }, [
        document.createTextNode(trou.avant || ''),
        champ,
        document.createTextNode(trou.apres || '')
      ]));
      retour = el('p', { class: 'retour', hidden: true });
      bloc.appendChild(retour);
    }

    bloc.appendChild(el('div', { class: 'ligne-actions', style: 'justify-content:center' }, [
      el('button', {
        class: 'bouton bouton-large', type: 'button', texte: libelle,
        onclick: function () {
          if (trou && !repondJuste(champ.value, trou)) {
            retour.hidden = false;
            retour.setAttribute('data-ton', 'echec');
            retour.textContent = 'Ce n’est pas le mot du compte rendu.';
            champ.focus(); champ.select();
            return;
          }
          suite();
        }
      })
    ]));
    montrer(bloc);
    if (champ) champ.focus();
  }

  /* -------------------------------------------------------- Étapes ---- */

  /* Un passage porte soit "lignes" (un seul extrait), soit "extraits" :
     [{ titre, page, paragraphes }] quand la scène se lit à deux endroits
     du livre. Les deux écritures sont acceptées. */
  function extraitsDe(passage) {
    if (passage.extraits && passage.extraits.length) return passage.extraits;
    return [{ page: passage.page, lignes: passage.lignes, paragraphes: passage.paragraphes }];
  }
  /* Un passage porte soit "lignes" — l'extrait découpé comme le livre
     l'imprime, une entrée par ligne —, soit "extraits" : plusieurs
     morceaux, chacun avec son titre, sa page et ses lignes. Une ligne
     égale à « […] » marque un passage sauté. */
  /* L'extrait est stocké ligne à ligne, comme le livre les imprime. Une
     ligne égale à COUPURE marque un passage sauté : elle s'affiche
     « […] » et ne porte pas de numéro. */
  var COUPURE = '[…]';

  function lignesDe(extrait) { return extrait.lignes || []; }

  /* Toutes les lignes du passage, à plat, les coupures retirées : c'est
     la numérotation que voit la classe. « l. 19 » = lignesDu(p)[18]. */
  function lignesDu(passage) {
    var x = extraitsDe(passage), out = [], i, l, k;
    for (i = 0; i < x.length; i++) {
      l = lignesDe(x[i]);
      for (k = 0; k < l.length; k++) if (l[k] !== COUPURE) out.push(l[k]);
    }
    return out;
  }
  function nbLignes(passage) { return lignesDu(passage).length; }

  /* ------------------------------------------- Les renvois au texte ---- */

  /* Un renvoi est TOUJOURS un bout de texte, jamais un numéro. Le moteur
     retrouve le passage dans l'extrait et calcule « l. 19 » au moment de
     l'afficher : si vous rallongez un extrait, le numéro suit tout seul,
     et si le passage visé a disparu le bandeau de contrôle le dit.
     Trois écritures, dans etapes.json :
       "renvoi": "la phrase exacte, telle qu'elle est dans l'extrait"
       "renvoi": { "de": "première phrase visée", "a": "dernière phrase visée" }
       "renvoi": [ … , … ]            plusieurs renvois, une pastille chacun
     Sans "renvoi", c'est la citation entre guillemets de l'énoncé qui
     sert de repère : rien à écrire deux fois. */
  function aplatirTexte(s) {
    return String(s === null || s === undefined ? '' : s)
      .toLowerCase()
      .replace(/[’‘ʼ]/g, "'")
      .replace(/[^0-9a-zà-ÿ']+/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function citationDe(libelle) {
    var m = String(libelle || '').match(/«\s*([^»]{8,}?)\s*»/);
    return m ? m[1] : null;
  }
  function renvoisDe(q, champ) {
    var r = q[champ];
    if (r === null || r === undefined || r === '') {
      if (champ !== 'renvoi') return [];
      var c = citationDe(q.libelle);
      return c ? [c] : [];
    }
    return Object.prototype.toString.call(r) === '[object Array]' ? r : [r];
  }

  /* Un repère -> { debut, fin } en numéros de ligne (1 = la première),
     ou null si le bout de texte ne se trouve pas dans l'extrait. */
  function situer(ancre, lignes) {
    var plat = [], debuts = [], total = 0, i, t;
    for (i = 0; i < lignes.length; i++) {
      t = aplatirTexte(lignes[i]);
      debuts.push(total);
      plat.push(t);
      total += t.length + 1;
    }
    var texte = plat.join(' ');
    function numero(pos) {
      var n = 1;
      for (var j = 0; j < debuts.length; j++) if (pos >= debuts[j]) n = j + 1;
      return n;
    }
    function trouver(bout) {
      var a = aplatirTexte(bout);
      if (!a) return null;
      var p = texte.indexOf(a);
      return p === -1 ? null : { debut: numero(p), fin: numero(p + a.length - 1) };
    }
    if (ancre && typeof ancre === 'object') {
      var d = trouver(ancre.de), f = trouver(ancre.a);
      if (!d || !f) return null;
      return { debut: Math.min(d.debut, f.debut), fin: Math.max(d.fin, f.fin) };
    }
    return trouver(ancre);
  }

  /* « l. 19 », « l. 13 et 14 », « l. 13 à 22 ». */
  function nommerRenvoi(r) {
    if (r.debut === r.fin) return 'l. ' + r.debut;
    if (r.fin === r.debut + 1) return 'l. ' + r.debut + ' et ' + r.fin;
    return 'l. ' + r.debut + ' à ' + r.fin;
  }

  /* Les pastilles d'une question : un bouton par renvoi, qui va surligner
     les lignes dans l'extrait. Rien ne s'affiche s'il n'y a pas d'extrait
     (version grand public) ou si le repère ne se résout pas. */
  function monterRenvois(q, champ, passage) {
    var boutons = [];
    if (!passage) return boutons;
    var lignes = passage.lignes;
    renvoisDe(q, champ).forEach(function (ancre) {
      var r = situer(ancre, lignes);
      if (!r) return;
      boutons.push(el('button', {
        type: 'button', class: 'renvoi',
        texte: nommerRenvoi(r),
        'aria-label': 'Montrer ' + (r.debut === r.fin ? 'la ligne ' : 'les lignes ') +
          nommerRenvoi(r).replace('l. ', '') + ' dans l’extrait',
        onclick: function () { passage.viser(r.debut, r.fin); }
      }));
    });
    return boutons;
  }
  /* « 12 », « 12 et 14 », « 148 à 151 » : les pages se lisent comme on
     les dirait à voix haute. */
  function direPages(texte) {
    var nums = String(texte || '').match(/\d+/g) || [];
    var vus = [], i;
    for (i = 0; i < nums.length; i++) {
      var n = Number(nums[i]);
      if (vus.indexOf(n) === -1) vus.push(n);
    }
    vus.sort(function (a, b) { return a - b; });
    if (!vus.length) return '';
    if (vus.length === 1) return String(vus[0]);
    var suite = true;
    for (i = 1; i < vus.length; i++) if (vus[i] !== vus[i - 1] + 1) suite = false;
    if (suite && vus.length > 2) return vus[0] + ' à ' + vus[vus.length - 1];
    if (vus.length === 2) return vus[0] + ' et ' + vus[1];
    return vus.slice(0, -1).join(', ') + ' et ' + vus[vus.length - 1];
  }

  function pagesDe(passage) {
    var x = extraitsDe(passage), tout = [];
    for (var i = 0; i < x.length; i++) if (x[i].page) tout.push(x[i].page);
    return direPages(tout.join(' '));
  }

  /* Le numéro de ligne se lit dans la marge, de cinq en cinq, hors du
     texte : rien n'est collé aux mots du roman. Les pastilles des
     questions disent « l. 19 » et surlignent la ligne au clic. */
  function monterPassage(passage) {
    var bloc = el('section', { class: 'passage' });
    var corps = el('div', { class: 'passage-corps' });
    var morceaux = extraitsDe(passage), rang = 0, reperes = {};
    for (var m = 0; m < morceaux.length; m++) {
      var lignes = lignesDe(morceaux[m]);
      if (!lignes.length) continue;
      if (morceaux.length > 1) {
        corps.appendChild(el('p', {
          class: 'passage-situation',
          texte: (morceaux[m].titre || 'Plus loin') + (morceaux[m].page ? ' — p. ' + direPages(morceaux[m].page) : '')
        }));
      }
      var texte = el('div', { class: 'passage-texte' });
      for (var i = 0; i < lignes.length; i++) {
        if (lignes[i] === COUPURE) {
          texte.appendChild(el('p', { class: 'passage-coupure', 'aria-label': 'passage sauté', texte: COUPURE }));
          continue;
        }
        rang++;
        /* le numéro ne sort que de cinq en cinq, et reste hors du texte */
        var ligne = el('p', { class: 'passage-ligne' }, [
          el('span', { class: 'passage-num', 'aria-hidden': 'true', texte: rang % 5 === 0 ? String(rang) : '' }),
          el('span', { class: 'passage-mots', texte: lignes[i] })
        ]);
        reperes[rang] = ligne;
        texte.appendChild(ligne);
      }
      corps.appendChild(texte);
    }

    function afficher(ouvrir) {
      corps.hidden = !ouvrir;
      bouton.textContent = ouvrir ? 'Masquer le texte' : 'Afficher le texte';
      bouton.setAttribute('aria-expanded', ouvrir ? 'true' : 'false');
    }
    var bouton = el('button', {
      type: 'button', class: 'bouton bouton-secondaire bouton-petit',
      'aria-expanded': 'true', texte: 'Masquer le texte',
      onclick: function () { afficher(corps.hidden); }
    });

    var pages = pagesDe(passage);
    bloc.appendChild(el('div', { class: 'passage-entete' }, [
      el('h3', { texte: (passage.titre || 'Le passage') + (pages ? ' — p. ' + pages : '') }),
      el('span', { class: 'passage-compte', texte: nbLignes(passage) + ' lignes' }),
      bouton
    ]));
    bloc.appendChild(corps);

    /* Montrer les lignes visées par une pastille : on rouvre le texte
       s'il était masqué, on remonte l'extrait à l'écran, puis on fait
       défiler l'extrait lui-même jusqu'à la ligne. */
    function viser(debut, fin) {
      afficher(true);
      var marques = corps.querySelectorAll('.ligne-visee');
      for (var j = 0; j < marques.length; j++) marques[j].className = 'passage-ligne';
      var premier = null;
      for (var n = debut; n <= fin; n++) {
        if (!reperes[n]) continue;
        reperes[n].className = 'passage-ligne ligne-visee';
        if (!premier) premier = reperes[n];
      }
      if (!premier) return;
      if (bloc.scrollIntoView) bloc.scrollIntoView({ block: 'start', behavior: 'smooth' });
      var r = premier.getBoundingClientRect(), c = corps.getBoundingClientRect();
      corps.scrollTop += (r.top - c.top) - corps.clientHeight / 3;
    }

    return { noeud: bloc, lignes: lignesDu(passage), viser: viser };
  }

  /* --------------------------------------------- L'étude du texte ----- */

  /* Version élèves seulement. Entre l'extrait et l'énigme, quelques
     questions de langue et de compréhension, corrigées une par une au
     moment de valider : le groupe voit ce qui est juste sans perdre le
     reste de son travail. Aucune réponse n'existe dans la page avant
     d'être trouvée — l'explication n'apparaît qu'une fois la réponse
     juste, l'aide ne la contient pas. */
  function monterEtude(e, cle, passage) {
    var etude = e.etude || {};
    var questions = etude.questions || [];
    var cleE = cle + '|etude';
    var reponses = etat.travaux[cleE] || {};
    var retours = [], retoursTexte = [], retoursRenvois = [], cases = [];

    var bloc = el('section', { class: 'etude' });
    bloc.appendChild(el('div', { class: 'etude-entete' }, [
      el('h3', { texte: etude.titre || 'L’étude du texte' }),
      el('span', { class: 'etude-compte', texte: questions.length + ' questions' })
    ]));
    /* La consigne peut être propre à l'étape, ou commune à toute la
       séance (versions.eleves.consigneEtude) : une seule ligne à changer. */
    var consigne = etude.consigne || reglages().consigneEtude;
    if (consigne) bloc.appendChild(el('p', { class: 'etude-consigne', texte: consigne }));

    var liste = el('ol', { class: 'etude-questions' });

    questions.forEach(function (q, i) {
      var li = el('li', { class: 'etude-question' });
      cases[i] = li;
      if (q.domaine) li.appendChild(el('span', { class: 'etiquette-domaine', texte: q.domaine }));
      /* Le numéro de ligne n'est pas écrit dans l'énoncé : il est calculé
         et posé en pastille, qui va surligner le passage visé. */
      var enonce = el('p', { class: 'question-libelle' }, [q.libelle]);
      monterRenvois(q, 'renvoi', passage).forEach(function (b) {
        enonce.appendChild(document.createTextNode(' '));
        enonce.appendChild(b);
      });
      li.appendChild(enonce);

      var format = q.format || (q.options ? 'boutons' : 'saisie');
      var options = optionsMelangees(
        q.options || (format === 'vraifaux' ? ['Vrai', 'Faux'] : null),
        format, cleE + '|' + i);

      function garder(v) { reponses[i] = v; etat.travaux[cleE] = reponses; sauver(); }

      if (format === 'menus' && options) {
        var sel = el('select', {
          class: 'menu', 'aria-label': q.libelle,
          onchange: function () { garder(sel.value); }
        });
        sel.appendChild(el('option', { value: '', texte: '— choisir —' }));
        options.forEach(function (o) { sel.appendChild(el('option', { value: o, texte: o })); });
        if (reponses[i]) sel.value = reponses[i];
        li.appendChild(sel);
      } else if (options) {
        var groupe = el('div', { class: 'choix' + (format === 'vraifaux' ? ' choix-vf' : '') });
        options.forEach(function (o) {
          groupe.appendChild(el('button', {
            type: 'button', class: 'choix-bouton',
            'aria-pressed': reponses[i] === o ? 'true' : 'false',
            texte: o,
            onclick: function () {
              garder(o);
              [].forEach.call(groupe.querySelectorAll('button'), function (x) {
                x.setAttribute('aria-pressed', x.textContent === o ? 'true' : 'false');
              });
            }
          }));
        });
        li.appendChild(groupe);
      } else {
        var inp = el('input', {
          type: 'text', class: 'champ-saisie',
          inputmode: q.reponseNumerique ? 'numeric' : null,
          autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false',
          'aria-label': q.libelle, value: reponses[i] || '',
          oninput: function () { garder(inp.value); }
        });
        li.appendChild(el('div', { class: 'champ-ligne' }, [inp]));
      }

      /* Le retour : le texte, puis les pastilles de l'aide — elles ne
         paraissent que si la réponse est fausse, pour guider la relecture
         sans rien dévoiler. */
      var texteRetour = el('span');
      var renvoisRetour = el('span', { class: 'retour-renvois', hidden: true });
      monterRenvois(q, 'renvoiAide', passage).forEach(function (b) {
        renvoisRetour.appendChild(document.createTextNode(' '));
        renvoisRetour.appendChild(b);
      });
      var retour = el('p', { class: 'retour retour-question', hidden: true }, [texteRetour, renvoisRetour]);
      retours[i] = retour;
      retoursTexte[i] = texteRetour;
      retoursRenvois[i] = renvoisRetour;
      li.appendChild(retour);
      liste.appendChild(li);
    });

    bloc.appendChild(liste);

    function juste(i) {
      var q = questions[i], v = reponses[i];
      if (q.options || q.format === 'vraifaux' || q.format === 'menus' || q.format === 'boutons') {
        return !!v && normaliser(v) === normaliser(q.reponse);
      }
      return repondJuste(v || '', {
        solution: q.reponse, variantes: q.variantes, reponseNumerique: q.reponseNumerique
      });
    }

    return {
      noeud: bloc,
      total: questions.length,
      /* Corrige question par question et renvoie le nombre de bonnes. */
      corriger: function () {
        var bons = 0;
        questions.forEach(function (q, i) {
          var ok = juste(i), r = retours[i];
          if (ok) bons++;
          r.hidden = false;
          r.setAttribute('data-ton', ok ? 'succes' : 'echec');
          retoursTexte[i].textContent = ok
            ? (q.explication ? 'Juste. ' + q.explication : 'Juste.')
            : (q.aide ? 'Pas encore. ' + q.aide : 'Pas encore. Reprenez le passage.');
          retoursRenvois[i].hidden = ok;
          cases[i].setAttribute('data-etat', ok ? 'juste' : 'faux');
        });
        return bons;
      },
      complete: function () {
        for (var i = 0; i < questions.length; i++) if (!juste(i)) return false;
        return true;
      }
    };
  }

  function montrerEtape(position) {
    var jouees = listeEtapes();
    var index = jouees[position];
    var e = jeu.etapes[index];
    var cle = 'e' + index;
    var section = el('section', {
      class: 'ecran salle', 'data-image': e.image || null, 'data-fond': 'remplissage'
    });

    /* La séance bonus revient sur un chapitre déjà joué : annoncer
       « chapitre III » à la seizième étape embrouillerait. */
    section.appendChild(el('p', { class: 'sur-titre', texte: e.bonus === true
      ? 'Séance bonus — après les quatorze lettres'
      : 'Chapitre ' + e.chapitre + ' — étape ' + (position + 1) + ' sur ' + jouees.length }));
    section.appendChild(el('h2', { tabindex: '-1', texte: e.titre || '' }));

    var moteur = MOTEURS[e.format];
    if (!moteur) {
      section.appendChild(el('p', { class: 'narration', texte: 'Format inconnu : « ' + e.format + ' ».' }));
      montrer(section);
      return;
    }

    /* ---- ce que la salle contient ---- */
    var passage = null, etude = null;
    if (estEleves() && e.passage && nbLignes(e.passage)) passage = monterPassage(e.passage);
    if (estEleves() && e.etude && (e.etude.questions || []).length) etude = monterEtude(e, cle, passage);
    var avecTexte = !!(passage || etude);
    var etudeObligatoire = !!etude && reglages().etudeObligatoire !== false;

    var touches = touchesDe(e, avecTexte);
    var volets = {};
    var plateau = monterPlateau(e.image, e, touches, function (quoi) {
      if (volets[quoi]) volets[quoi].ouvrir(plateau.boutons[quoi]);
    });

    /* le message s'affiche en bas de l'image : il ne pousse rien */
    var message = el('p', { class: 'salle-message', hidden: true, role: 'status' });
    plateau.noeud.appendChild(message);
    var fait = { texte: !etudeObligatoire, enigme: false };

    function dire(texte, ton) {
      message.hidden = !texte;
      message.textContent = texte || '';
      if (ton) message.setAttribute('data-ton', ton); else message.removeAttribute('data-ton');
      if (texte) annoncer(texte);
    }
    function marquer(quoi) {
      var b = plateau.boutons[quoi];
      if (b) { b.classList.add('ouverte'); b.setAttribute('aria-label', b.getAttribute('aria-label') + ' — trouvé'); }
    }
    function reussir() {
      /* La lettre n'est plus celle du fichier : elle est tirée pour
         cette partie. Le champ « lettre » dit seulement que la salle en
         donne une. */
      var lettre = e.lettre ? lettreDe(index) : '';
      etat.reussies[cle] = true;
      if (lettre) {
        if (!etat.boite) etat.boite = [];
        etat.boite.push(lettre);
      }
      etat.etape = position + 1;
      sauver();
      plateau.noeud.classList.add('ouverte');
      dire(lettre
        ? 'La salle s’ouvre. Vous gagnez la lettre ' + lettre + '.'
        : 'La salle s’ouvre. Le passage est libre.', 'succes');
      window.setTimeout(function () {
        montrerPasserelle(e.apres || '',
          position + 1 < jouees.length ? 'Niveau suivant' : 'La finale',
          ecranCourant, lettre, e.image);
      }, OUVERTURE);
    }

    /* ---- le volet du texte : l'extrait, puis l'étude ---- */
    if (avecTexte) {
      var retourTexte = el('p', { class: 'retour', hidden: true });
      var verifier = etude ? el('button', {
        class: 'bouton', type: 'button', texte: 'Vérifier mes réponses',
        onclick: function () {
          var bons = etude.corriger();
          var tout = bons === etude.total;
          retourTexte.hidden = false;
          retourTexte.setAttribute('data-ton', tout ? 'succes' : 'echec');
          retourTexte.textContent = tout
            ? 'Les ' + etude.total + ' questions sont justes.'
            : bons + ' sur ' + etude.total + '. Ce qui est juste reste acquis.';
          annoncer(retourTexte.textContent);
          if (tout) {
            fait.texte = true;
            marquer('texte');
            volets.texte.fermer();
            if (fait.enigme) reussir();
            else dire('Le texte est fait. Il reste l’énigme.');
          }
        }
      }) : null;
      volets.texte = monterVolet(
        (passage && e.passage && e.passage.titre) || 'Le texte',
        [passage ? passage.noeud : null, etude ? etude.noeud : null, retourTexte],
        [verifier, el('button', {
          class: 'bouton bouton-secondaire', type: 'button', texte: 'Refermer',
          onclick: function () { volets.texte.fermer(); }
        })]
      );
      section.appendChild(volets.texte.noeud);
    }

    /* ---- le volet de l'énigme ---- */
    var corps = el('div', { class: 'jeu-corps' });
    var api = moteur(e, cle, corps);
    var retour = el('p', { class: 'retour', hidden: true });
    var zoneIndice = el('div');
    var valider = el('button', {
      class: 'bouton bouton-large', type: 'button', texte: 'Valider',
      onclick: function () {
        /* L'étude est corrigée au passage : même si l'énigme est fausse,
           le groupe garde le bénéfice des questions déjà justes. */
        var bons = etude ? etude.corriger() : 0;
        var etudeOk = !etudeObligatoire || bons === etude.total;
        if (etudeOk && etude) { fait.texte = true; marquer('texte'); }
        var enigmeOk = api.verifier();

        if (enigmeOk) {
          fait.enigme = true;
          marquer('enigme');
          valider.disabled = true;
          volets.enigme.fermer();
          if (etudeOk) { reussir(); return; }
          dire('L’énigme est juste. Il reste le texte : ' + bons + ' sur ' + etude.total + '.');
          return;
        }

        essais[cle] = (essais[cle] || 0) + 1;
        var texte = ENCOURAGEMENTS[(essais[cle] - 1) % ENCOURAGEMENTS.length];
        if (!etudeOk) texte = 'L’étude du texte : ' + bons + ' sur ' + etude.total + '. ' + texte;
        retour.hidden = false;
        retour.setAttribute('data-ton', 'echec');
        retour.textContent = texte;
        montrerIndice(zoneIndice, indicesDe(e));
        annoncer(texte);
      }
    });
    volets.enigme = monterVolet(e.titreEnigme || 'L’énigme',
      [e.enonce ? el('p', { class: 'narration', texte: e.enonce }) : null, corps, retour, zoneIndice],
      [valider, e.indice ? el('button', {
        class: 'bouton bouton-secondaire', type: 'button', texte: 'Un indice',
        onclick: function () { montrerIndice(zoneIndice, indicesDe(e)); }
      }) : null]);
    section.appendChild(volets.enigme.noeud);

    /* ---- la salle ---- */
    section.appendChild(plateau.noeud);
    section.appendChild(el('p', { class: 'salle-consigne', texte: touches.length > 1
      ? 'Deux repères dans cette salle. Pressez-les.'
      : 'Un repère dans cette salle. Pressez-le.' }));
    section.appendChild(el('ul', { class: 'salle-liste' }, touches.map(function (t) {
      return el('li', {}, [el('button', {
        type: 'button', class: 'bouton bouton-secondaire bouton-repere',
        texte: t.libelle,
        onclick: function () { if (volets[t.cle]) volets[t.cle].ouvrir(plateau.boutons[t.cle]); }
      })]);
    })));
    montrer(section);
  }

  /* ------------------------------------------------------- Moteurs ---- */

  var MOTEURS = {};

  /* --- Sélection : intrus à retirer, ou cartes à retourner --- */
  MOTEURS.selection = function (e, cle, hote) {
    var elements = e.elements || [];
    var attendus = e.aSelectionner || [];
    var ordre = melange(elements.length, cle + '|sel');
    var choisis = {};
    var sauv = etat.travaux[cle];
    if (sauv) for (var s in sauv) if (Object.prototype.hasOwnProperty.call(sauv, s)) choisis[s] = true;

    var liste = el('ul', { class: 'cartes' });
    for (var i = 0; i < ordre.length; i++) {
      (function (idx) {
        var texte = elements[idx];
        var b = el('button', {
          type: 'button', class: 'carte',
          'aria-pressed': choisis[texte] ? 'true' : 'false',
          texte: texte,
          onclick: function () {
            if (choisis[texte]) delete choisis[texte]; else choisis[texte] = true;
            b.setAttribute('aria-pressed', choisis[texte] ? 'true' : 'false');
            etat.travaux[cle] = choisis; sauver();
          }
        });
        liste.appendChild(el('li', {}, [b]));
      })(ordre[i]);
    }
    hote.appendChild(liste);
    if (e.aide) hote.appendChild(el('p', { class: 'aide-clavier', texte: e.aide }));

    return {
      verifier: function () {
        var n = 0;
        for (var k in choisis) if (Object.prototype.hasOwnProperty.call(choisis, k)) {
          if (attendus.indexOf(k) === -1) return false;
          n++;
        }
        return n === attendus.length;
      }
    };
  };

  /* --- Questions : menus déroulants, boutons, ou vrai/faux --- */
  MOTEURS.questions = function (e, cle, hote) {
    var questions = e.questions || [];
    var presentation = e.presentation || 'boutons';
    var reponses = etat.travaux[cle] || {};
    var liste = el('ol', { class: 'questions' });

    questions.forEach(function (q, i) {
      var li = el('li');
      li.appendChild(el('p', { class: 'question-libelle', texte: q.libelle }));
      var options = optionsMelangees(
        q.options || (presentation === 'vraifaux' ? ['Vrai', 'Faux'] : []),
        presentation, cle + '|' + i);

      if (presentation === 'menus') {
        var sel = el('select', {
          class: 'menu', 'aria-label': q.libelle,
          onchange: function () { reponses[i] = sel.value; etat.travaux[cle] = reponses; sauver(); }
        });
        sel.appendChild(el('option', { value: '', texte: '— choisir —' }));
        options.forEach(function (o) { sel.appendChild(el('option', { value: o, texte: o })); });
        if (reponses[i]) sel.value = reponses[i];
        li.appendChild(sel);
      } else {
        var groupe = el('div', { class: 'choix' + (presentation === 'vraifaux' ? ' choix-vf' : '') });
        options.forEach(function (o) {
          var b = el('button', {
            type: 'button', class: 'choix-bouton',
            'aria-pressed': reponses[i] === o ? 'true' : 'false',
            texte: o,
            onclick: function () {
              reponses[i] = o;
              etat.travaux[cle] = reponses; sauver();
              [].forEach.call(groupe.querySelectorAll('button'), function (x) {
                x.setAttribute('aria-pressed', x.textContent === o ? 'true' : 'false');
              });
            }
          });
          groupe.appendChild(b);
        });
        li.appendChild(groupe);
      }
      liste.appendChild(li);
    });

    hote.appendChild(liste);
    return {
      verifier: function () {
        for (var i = 0; i < questions.length; i++) {
          if (normaliser(reponses[i]) !== normaliser(questions[i].reponse)) return false;
        }
        return true;
      }
    };
  };

  /* --- Association : relier deux colonnes --- */
  MOTEURS.association = function (e, cle, hote) {
    var paires = e.paires || [];
    var n = paires.length;
    /* Les leurres occupent la colonne de droite sans avoir de correspondant :
       aucun lien vers eux ne peut être juste. */
    var droites = paires.map(function (p) { return p.droite; }).concat(e.leurres || []);
    var ordreDroite = melange(droites.length, cle + '|droite');
    var liens = etat.travaux[cle] ? JSON.parse(JSON.stringify(etat.travaux[cle])) : {};
    var choixGauche = -1;

    var grille = el('div', { class: 'assoc' });
    var colG = el('div', {}, [el('p', { class: 'colonne-titre', texte: e.titreGauche || 'À relier' }), el('ul', { class: 'colonne' })]);
    var colD = el('div', {}, [el('p', { class: 'colonne-titre', texte: e.titreDroite || 'Avec' }), el('ul', { class: 'colonne' })]);
    grille.appendChild(colG); grille.appendChild(colD);
    hote.appendChild(grille);
    hote.appendChild(el('p', { class: 'aide-clavier', texte: 'Cliquez à gauche, puis à droite. Recliquez sur un élément relié pour défaire le lien.' }));

    function numero(g) {
      var o = [], k;
      for (k in liens) if (Object.prototype.hasOwnProperty.call(liens, k)) o.push(Number(k));
      o.sort(function (a, b) { return a - b; });
      return o.indexOf(g) + 1;
    }
    function gaucheDe(d) {
      for (var k in liens) if (Object.prototype.hasOwnProperty.call(liens, k) && liens[k] === d) return Number(k);
      return -1;
    }
    function enregistrer() { etat.travaux[cle] = liens; sauver(); }

    function rendre() {
      var ulG = colG.querySelector('ul'), ulD = colD.querySelector('ul');
      vider(ulG); vider(ulD);
      for (var i = 0; i < n; i++) {
        (function (gi) {
          var lie = liens[gi] !== undefined;
          var b = el('button', {
            type: 'button', class: 'jeton' + (lie ? ' lie' : ''),
            'aria-pressed': choixGauche === gi ? 'true' : 'false',
            onclick: function () {
              if (lie) { delete liens[gi]; choixGauche = -1; enregistrer(); rendre(); return; }
              choixGauche = choixGauche === gi ? -1 : gi;
              rendre();
            }
          }, [
            el('span', { class: 'puce' + (lie ? '' : ' creuse'), texte: lie ? String(numero(gi)) : '0' }),
            el('span', { texte: paires[gi].gauche })
          ]);
          ulG.appendChild(el('li', {}, [b]));
        })(i);
      }
      for (var j = 0; j < droites.length; j++) {
        (function (pos) {
          var di = ordreDroite[pos];
          var g = gaucheDe(di), lie = g > -1;
          var b = el('button', {
            type: 'button', class: 'jeton' + (lie ? ' lie' : ''), 'aria-pressed': 'false',
            onclick: function () {
              if (lie) { delete liens[g]; enregistrer(); rendre(); return; }
              if (choixGauche < 0) { annoncer('Choisissez d’abord un élément à gauche.'); return; }
              liens[choixGauche] = di; choixGauche = -1; enregistrer(); rendre();
            }
          }, [
            el('span', { class: 'puce' + (lie ? '' : ' creuse'), texte: lie ? String(numero(g)) : '0' }),
            el('span', { texte: droites[di] })
          ]);
          ulD.appendChild(el('li', {}, [b]));
        })(j);
      }
    }
    rendre();

    return {
      verifier: function () {
        for (var i = 0; i < n; i++) if (liens[i] !== i) return false;
        return true;
      }
    };
  };

  /* --- Champs : code, cadenas, devinettes, scores, texte à trous --- */
  MOTEURS.champs = function (e, cle, hote) {
    var champs = e.champs || [];
    var valeurs = etat.travaux[cle] || {};
    var presentation = e.presentation || 'liste';
    var entrees = [];

    var conteneur = el('div', { class: 'champs champs-' + presentation });

    if (presentation === 'trous' && e.phrase) {
      /* La phrase contient des ___ : on y glisse les champs, dans l'ordre. */
      var morceaux = e.phrase.split(/_{2,}/);
      var p = el('p', { class: 'phrase-trous' });
      morceaux.forEach(function (m, i) {
        p.appendChild(document.createTextNode(m));
        if (i < morceaux.length - 1 && champs[i]) {
          var inp = champIndividuel(champs[i], i);
          p.appendChild(inp);
        }
      });
      conteneur.appendChild(p);
      /* les champs restants (ex. le prénom) sous la phrase */
      for (var k = morceaux.length - 1; k < champs.length; k++) {
        conteneur.appendChild(ligneChamp(champs[k], k));
      }
    } else {
      champs.forEach(function (c, i) { conteneur.appendChild(ligneChamp(c, i)); });
    }
    hote.appendChild(conteneur);
    if (e.aide) hote.appendChild(el('p', { class: 'aide-clavier', texte: e.aide }));

    function champIndividuel(c, i) {
      var inp = el('input', {
        type: c.clavier === 'nombre' ? 'text' : 'text',
        inputmode: c.clavier === 'nombre' ? 'numeric' : null,
        class: 'champ-saisie' + (presentation === 'cadenas' ? ' champ-cadenas' : '') + (presentation === 'trous' ? ' champ-trou' : ''),
        autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false',
        maxlength: c.longueur || null,
        'aria-label': c.libelle || ('réponse ' + (i + 1)),
        value: valeurs[i] || '',
        oninput: function () { valeurs[i] = inp.value; etat.travaux[cle] = valeurs; sauver(); }
      });
      entrees[i] = inp;
      return inp;
    }
    function ligneChamp(c, i) {
      var inp = champIndividuel(c, i);
      return el('div', { class: 'champ-ligne' }, [
        c.libelle ? el('label', { class: 'champ-libelle', texte: c.libelle }) : null,
        inp
      ]);
    }

    return {
      verifier: function () {
        for (var i = 0; i < champs.length; i++) {
          if (!entrees[i] || !repondJuste(entrees[i].value, champs[i])) return false;
        }
        return true;
      }
    };
  };

  /* --- Ordre : remettre des étapes dans l'ordre du récit --- */
  MOTEURS.ordre = function (e, cle, hote) {
    var etapes = e.etapesOrdre || [];
    var n = etapes.length;
    var sauv = etat.travaux[cle];
    var ordre = (sauv && sauv.length === n) ? sauv.slice() : melange(n, cle + '|ordre');
    var liste = el('ul', { class: 'tuiles' });
    var focusApres = null;

    function deplacer(de, vers) {
      if (vers < 0 || vers >= n) return;
      var item = ordre.splice(de, 1)[0];
      ordre.splice(vers, 0, item);
      etat.travaux[cle] = ordre.slice(); sauver();
      annoncer('Déplacé en position ' + (vers + 1) + ' sur ' + n + '.');
      rendre();
    }
    function rendre() {
      vider(liste);
      for (var pos = 0; pos < n; pos++) {
        (function (p) {
          var li = el('li', { class: 'tuile' });
          li.appendChild(el('span', { class: 'tuile-rang', 'aria-hidden': 'true', texte: String(p + 1) }));
          li.appendChild(el('span', { class: 'tuile-texte', texte: etapes[ordre[p]] }));
          var f = el('span', { class: 'tuile-fleches' });
          f.appendChild(el('button', {
            type: 'button', class: 'bouton', texte: '▲', 'aria-label': 'Monter : ' + etapes[ordre[p]],
            disabled: p === 0, onclick: function () { focusApres = { pos: p - 1, sens: 'haut' }; deplacer(p, p - 1); }
          }));
          f.appendChild(el('button', {
            type: 'button', class: 'bouton', texte: '▼', 'aria-label': 'Descendre : ' + etapes[ordre[p]],
            disabled: p === n - 1, onclick: function () { focusApres = { pos: p + 1, sens: 'bas' }; deplacer(p, p + 1); }
          }));
          li.appendChild(f);
          liste.appendChild(li);
        })(pos);
      }
      if (focusApres) {
        var cible = liste.children[Math.max(0, Math.min(n - 1, focusApres.pos))];
        if (cible) {
          var bs = cible.querySelectorAll('.tuile-fleches .bouton');
          var vise = focusApres.sens === 'haut' ? bs[0] : bs[1];
          if (vise && !vise.disabled) vise.focus(); else if (bs[0] && !bs[0].disabled) bs[0].focus(); else if (bs[1]) bs[1].focus();
        }
        focusApres = null;
      }
    }
    rendre();
    hote.appendChild(liste);
    hote.appendChild(el('p', { class: 'aide-clavier', texte: 'Utilisez les flèches ▲ ▼ pour déplacer chaque étape.' }));

    return { verifier: function () { for (var i = 0; i < n; i++) if (ordre[i] !== i) return false; return true; } };
  };

  /* --- Anagramme : recomposer un mot avec les mêmes lettres --- */
  /* --- Les tuiles de la finale --------------------------------------
     Quatorze lettres en vrac, « J’ÉTAIS » déjà posé devant, et la
     phrase à reconstituer. On déplace par TOUCHER : une tuile, puis sa
     destination, et les deux s'échangent. Le glisser-déposer natif est
     une misère sur iPhone ; l'échange marche au doigt, à la souris et
     au clavier, et se dit en une phrase.

     Les indices ne viennent qu'à la demande, l'un après l'autre. Le
     dernier montre enfin la forme de la phrase : jusque-là, rien ne
     trahit le nombre de mots ni leurs longueurs. */
  MOTEURS.tuiles = function (e, cle, hote) {
    /* Le moteur ne connaît plus la phrase. Il tient son GABARIT — un
       point par lettre, les espaces et l'apostrophe tels quels — qui
       donne le nombre de tuiles et le découpage en mots du dernier
       indice ; et son EMPREINTE, qui reconnaît le bon ordre sans le
       contenir. Rien ici ne peut être lu dans un éditeur de texte. */
    var forme = String(e.forme || '');
    var cases = (forme.match(/\./g) || []).length;
    var travail = etat.travaux[cle] || {};
    var ordre = (travail.ordre && travail.ordre.length === cases)
      ? travail.ordre.slice() : boite().slice();
    var vus = Number(travail.indices) || 0;
    var choisie = -1, focusApres = -1;

    var plateau = el('div', { class: 'tuiles-plateau' });
    var zoneIndices = el('div', { class: 'tuiles-indices' });
    var aide = el('p', { class: 'aide-clavier', texte: 'Touchez une lettre, puis la place où la mettre : les deux s’échangent.' });

    function enregistrer() {
      etat.travaux[cle] = { ordre: ordre.slice(), indices: vus };
      sauver();
    }

    function tuile(position) {
      var L = ordre[position] || '';
      return el('button', {
        type: 'button',
        class: 'tuile' + (position === choisie ? ' choisie' : ''),
        texte: L,
        'aria-label': 'Lettre ' + L + ', place ' + (position + 1) + (position === choisie ? ', choisie' : ''),
        'aria-pressed': position === choisie ? 'true' : 'false',
        onclick: function () {
          /* rendre() reconstruit tous les boutons : celui qui avait le
             focus disparaît, et un élève au clavier repartirait du haut
             de la page à chaque échange. On retient donc la place à
             retrouver, et on dit tout haut ce qui vient de se passer —
             le type « ordre » de la salle 15 fait déjà exactement cela. */
          var dire = '';
          if (choisie === -1) {
            choisie = position;
            dire = 'Lettre ' + (ordre[position] || '') + ' choisie, place ' + (position + 1) +
              '. Touchez maintenant la place où la mettre.';
          } else if (choisie === position) {
            choisie = -1;
            dire = 'Choix annulé.';
          } else {
            var depuis = choisie;
            var t = ordre[choisie]; ordre[choisie] = ordre[position]; ordre[position] = t;
            choisie = -1;
            enregistrer();
            dire = 'Les lettres des places ' + (depuis + 1) + ' et ' + (position + 1) +
              ' sont échangées. Place ' + (position + 1) + ' : ' + (ordre[position] || '') + '.';
          }
          focusApres = position;
          rendre();
          annoncer(dire);
        }
      });
    }

    /* La forme de la phrase — combien de mots, de quelle longueur, où
       tombe l'apostrophe — ne se montre qu'au dernier indice. Avant
       cela, tout est sur une seule rangée. */
    function rendre() {
      vider(plateau);
      var rang = 0, bloc;
      if (vus < 4) {
        bloc = el('div', { class: 'tuiles-mot' });
        for (var k = 0; k < cases; k++) bloc.appendChild(tuile(rang++));
        plateau.appendChild(bloc);
        rendreFocus();
        return;
      }
      forme.split(/\s+/).forEach(function (mot, gi) {
        if (gi > 0) plateau.appendChild(el('span', { class: 'tuiles-espace', 'aria-hidden': 'true' }));
        bloc = el('div', { class: 'tuiles-mot' });
        mot.split('').forEach(function (c) {
          if (c === '.') bloc.appendChild(tuile(rang++));
          else bloc.appendChild(el('span', { class: 'tuiles-liaison', 'aria-hidden': 'true', texte: c }));
        });
        plateau.appendChild(bloc);
      });
      rendreFocus();
    }

    /* Le plateau vient d'être reconstruit : on remet le focus sur la
       place où l'élève a agi, sinon le clavier repart du début. */
    function rendreFocus() {
      if (focusApres < 0) return;
      var boutons = plateau.querySelectorAll('.tuile');
      var vise = boutons[Math.max(0, Math.min(boutons.length - 1, focusApres))];
      focusApres = -1;
      if (vise && vise.focus) vise.focus();
    }

    var fixe = el('div', { class: 'tuiles-fixe' });
    String(e.fixe || '').split('').forEach(function (c) {
      fixe.appendChild(/[A-ZÀ-ÝŒ]/i.test(c)
        ? el('span', { class: 'tuile tuile-posee', texte: c.toUpperCase() })
        : el('span', { class: 'tuiles-liaison', 'aria-hidden': 'true', texte: c }));
    });

    function montrerIndices() {
      vider(zoneIndices);
      for (var i = 0; i < vus && i < (e.indices || []).length; i++) {
        zoneIndices.appendChild(el('p', { class: 'indice', texte: e.indices[i] }));
      }
    }

    var boutonIndice = el('button', {
      type: 'button', class: 'bouton bouton-secondaire',
      texte: 'Un indice', onclick: function () {
        if (vus >= (e.indices || []).length) return;
        vus++;
        enregistrer();
        montrerIndices();
        rendre();
        if (vus >= (e.indices || []).length) boutonIndice.disabled = true;
        annoncer('Indice ' + vus + ' sur ' + (e.indices || []).length + ' affiché.');
      }
    });
    if (vus >= (e.indices || []).length) boutonIndice.disabled = true;

    /* « tuiles-finale », et non « tuiles » : le type « ordre » de la
       salle 15 porte déjà ce nom-là pour sa liste, et les deux feuilles
       de style se marchaient dessus — la liste verticale se retrouvait
       en rangée centrée. Les lettres de la finale ont leur propre nom. */
    hote.appendChild(el('div', { class: 'tuiles-finale' }, [fixe, plateau]));
    hote.appendChild(aide);
    hote.appendChild(el('div', { class: 'ligne-actions ligne-actions-gauche' }, [boutonIndice]));
    hote.appendChild(zoneIndices);
    rendre();
    montrerIndices();

    return {
      verifier: function () {
        return !!e.empreinte && empreintePhrase(ordre.join('')) === String(e.empreinte).toLowerCase();
      }
    };
  };

  MOTEURS.anagramme = function (e, cle, hote) {
    var mots = e.mots || [];
    var saisies = etat.travaux[cle] || {};
    var zones = [];

    mots.forEach(function (m, idx) {
      var source = m.source.replace(/[^A-Za-zÀ-ÿ]/g, '').toUpperCase();
      var lettres = sansAccents(source.toLowerCase()).toUpperCase().split('');
      var pris = [];
      var composition = saisies[idx] || '';

      var bloc = el('div', { class: 'anagramme' });
      bloc.appendChild(el('p', { class: 'anagramme-source' }, [
        el('span', { class: 'anagramme-mot', texte: m.source }),
        el('span', { class: 'anagramme-fleche', 'aria-hidden': 'true', texte: ' → ' }),
        el('span', { class: 'anagramme-indice', texte: m.piste || '' })
      ]));

      var resultat = el('p', { class: 'anagramme-resultat', 'aria-live': 'polite' });
      var banque = el('div', { class: 'anagramme-banque' });

      function rendre() {
        resultat.textContent = composition || '—';
        vider(banque);
        lettres.forEach(function (L, i) {
          var utilisee = pris.indexOf(i) > -1;
          banque.appendChild(el('button', {
            type: 'button', class: 'lettre-jeton' + (utilisee ? ' utilisee' : ''),
            texte: L, disabled: utilisee, 'aria-label': 'Ajouter la lettre ' + L,
            onclick: function () { pris.push(i); composition += L; enregistrer(); rendre(); }
          }));
        });
      }
      function enregistrer() { saisies[idx] = composition; etat.travaux[cle] = saisies; sauver(); }

      var actions = el('div', { class: 'ligne-actions' }, [
        el('button', {
          type: 'button', class: 'bouton bouton-secondaire bouton-petit', texte: 'Effacer une lettre',
          onclick: function () { if (!pris.length) return; pris.pop(); composition = composition.slice(0, -1); enregistrer(); rendre(); }
        }),
        el('button', {
          type: 'button', class: 'bouton bouton-secondaire bouton-petit', texte: 'Tout effacer',
          onclick: function () { pris = []; composition = ''; enregistrer(); rendre(); }
        })
      ]);

      /* reprise d'une composition sauvegardée */
      if (composition) {
        var restantes = lettres.slice();
        var ok = true;
        composition.split('').forEach(function (c) {
          var i = restantes.indexOf(c);
          if (i === -1) { ok = false; return; }
          restantes[i] = null;
          pris.push(lettres.indexOf(c, 0));
        });
        if (!ok) { composition = ''; pris = []; }
        else { pris = []; var copie = lettres.slice(); composition.split('').forEach(function (c) { var i = copie.indexOf(c); if (i > -1) { pris.push(i); copie[i] = null; } }); }
      }

      bloc.appendChild(resultat);
      bloc.appendChild(banque);
      bloc.appendChild(actions);
      hote.appendChild(bloc);
      zones.push({ get: function () { return composition; }, cible: m.cible });
      rendre();
    });

    return {
      verifier: function () {
        for (var i = 0; i < zones.length; i++) {
          if (normaliser(zones[i].get()) !== normaliser(zones[i].cible)) return false;
        }
        return true;
      }
    };
  };

  /* -------------------------------------------------------- Finale ---- */

  /* Les deux premiers écrans sont communs ; le dernier dépend de la version :
     code du jeu concours pour le grand public, « Du roman à la mémoire »
     pour la classe. */
  function ecransFinale() {
    var f = jeu.finale || {};
    var communs = (f.ecrans || []).slice();
    var dernier = estEleves() ? f.revelationEleves : f.revelationPublic;
    if (dernier) communs.push(dernier);
    return communs;
  }

  function montrerFinale() {
    arreterHorloge();
    var ecrans = ecransFinale();
    var i = Math.min(etat.finale, ecrans.length - 1);
    var e = ecrans[i];
    if (!e) return montrerFin();

    if (e.type === 'revelation') return montrerRevelation(e);

    var section = el('section', { class: 'ecran etape' });
    section.appendChild(el('p', { class: 'sur-titre', texte: 'La finale — ' + (i + 1) + ' sur ' + ecrans.length }));
    section.appendChild(el('h2', { tabindex: '-1', texte: e.titre || '' }));
    if (e.enonce) section.appendChild(el('p', { class: 'narration', texte: e.enonce }));

    var corps = el('div', { class: 'jeu-corps' });
    section.appendChild(corps);
    var moteur = MOTEURS[e.format];
    var api = moteur ? moteur(e, 'f' + i, corps) : { verifier: function () { return true; } };

    var retour = el('p', { class: 'retour', hidden: true });
    var zoneIndice = el('div');

    section.appendChild(el('div', { class: 'ligne-actions' }, [
      el('button', {
        class: 'bouton bouton-large', type: 'button', texte: 'Valider',
        onclick: function () {
          if (api.verifier()) {
            etat.finale = i + 1; sauver();
            montrerPasserelle(e.apres || '', 'Continuer', function () { montrerFinale(); });
          } else {
            essais['f' + i] = (essais['f' + i] || 0) + 1;
            retour.hidden = false;
            retour.setAttribute('data-ton', 'echec');
            /* « Rouvrez le chapitre » n'a aucun sens devant des tuiles :
               un écran peut donner son propre mot d'encouragement. */
            retour.textContent = e.refus || ENCOURAGEMENTS[(essais['f' + i] - 1) % ENCOURAGEMENTS.length];
            montrerIndice(zoneIndice, e.indice);
          }
        }
      }),
      e.indice ? el('button', { class: 'bouton bouton-secondaire', type: 'button', texte: 'Un indice', onclick: function () { montrerIndice(zoneIndice, e.indice); } }) : null
    ]));
    section.appendChild(retour);
    section.appendChild(zoneIndice);
    montrer(section);
  }

  /* Le bouton du concours. L'adresse se fabrique à partir du bloc
     `concours` de l'écran final, et « {code} » y est remplacé par le code
     de l'édition : le code ne s'écrit donc qu'à un seul endroit. */
  function lienConcours(e) {
    var c = e.concours;
    if (!c || !c.courriel) return null;
    function poser(t) { return String(t === undefined ? '' : t).split('{code}').join(e.code || ''); }
    var parties = [];
    if (c.objet) parties.push('subject=' + encodeURIComponent(poser(c.objet)));
    if (c.corps) parties.push('body=' + encodeURIComponent(poser(c.corps)));
    return 'mailto:' + c.courriel + (parties.length ? '?' + parties.join('&') : '');
  }

  /* Le règlement vit à côté du jeu. Dans la version « un seul fichier »,
     il est embarqué : le lien s'ouvre alors depuis la page elle-même. */
  function lienReglement(chemin) {
    var texte = window.REGLEMENT_INTEGRE;
    if (!texte) return chemin;
    if (!lienReglement.url) {
      try {
        lienReglement.url = window.URL.createObjectURL(
          new window.Blob([texte], { type: 'text/html;charset=utf-8' }));
      } catch (err) { return chemin; }
    }
    return lienReglement.url;
  }

  function montrerRevelation(e) {
    etat.termine = true;
    sauver();
    /* Tout est trouvé : ici, le ciel s'ouvre — nette d'emblée. */
    var section = el('section', {
      class: 'ecran revelation-lecteur', 'data-image': e.image || null, 'data-fond': 'net'
    });
    section.appendChild(el('p', { class: 'sur-titre', texte: 'La révélation' }));
    section.appendChild(el('h2', { tabindex: '-1', texte: e.titre || '' }));
    (e.paragraphes || []).forEach(function (p) {
      section.appendChild(el('p', { class: 'narration', texte: p }));
    });

    if (e.code) {
      var adresseConcours = lienConcours(e);
      section.appendChild(el('div', { class: 'coffre-final' }, [
        el('p', { texte: e.libelleCode || 'Votre code :' }),
        el('p', { class: 'code-sortie', texte: e.code }),
        e.consigneCode ? el('p', { class: 'aide-clavier', texte: e.consigneCode }) : null,
        /* Ce qu'il y a à gagner, avant le bouton qui envoie le code. */
        (e.lots && (e.lots.liste || []).length) ? el('div', { class: 'lots' }, [
          el('p', { class: 'lots-titre', texte: e.lots.titre || 'À gagner' }),
          el('ol', { class: 'lots-liste' }, e.lots.liste.map(function (l) {
            return el('li', {}, [
              el('span', { class: 'lots-rang', texte: l.rang || '' }),
              l.texte || ''
            ]);
          }))
        ]) : null,
        adresseConcours ? el('p', {}, [
          el('a', {
            class: 'bouton bouton-large', href: adresseConcours,
            target: '_blank', rel: 'noopener',
            texte: e.libelleLien || 'Comment participer'
          })
        ]) : null,
        e.lienReglement ? el('p', { class: 'mention-concours' }, [
          e.rappel ? e.rappel + ' · ' : '',
          el('a', {
            href: lienReglement(e.lienReglement), target: '_blank', rel: 'noopener',
            texte: e.libelleReglement || 'Règlement complet'
          })
        ]) : null
      ]));
    }
    if (e.clinDoeil) {
      section.appendChild(el('p', { class: 'note', texte: e.clinDoeil }));
    }
    section.appendChild(el('div', { class: 'ligne-actions', style: 'justify-content:center' }, [
      el('button', { class: 'bouton bouton-secondaire', type: 'button', texte: 'Rejouer depuis le début', onclick: recommencer })
    ]));
    montrer(section);
  }

  function montrerFin() { montrerRevelation({ titre: 'Terminé', paragraphes: ['Merci d’avoir joué.'] }); }

  /* --------------------------------------------------- Recommencer ---- */

  function recommencer() {
    if (!jeu || !etat) return;
    if (!window.confirm((versionUnique() ? 'Tout recommencer ?' : 'Revenir au choix de la version ?') +
      '\n\nLa partie en cours et les lettres déjà gagnées seront perdues.')) return;
    arreterHorloge();
    effacer();
    etat = etatNeuf();
    essais = {};
    sauver();
    montrerAccueil();
  }

  /* --------------------------------------------------- Démarrage ------ */

  function controler(d) {
    var avis = [];
    if (!d.etapes || !d.etapes.length) { avis.push('Aucune étape dans etapes.json.'); return avis; }
    /* Les lettres se comptent PAR VERSION : une salle peut n'exister que
       d'un côté — le chapitre III en a une pour le grand public et une
       pour la classe, toutes deux porteuses du P. Les additionner
       donnerait quinze lettres pour une phrase qui en compte quatorze.
       Et l'on ne cite ici NI les lettres NI la phrase : un message de
       contrôle n'a pas à dévoiler la fin du jeu, même à l'auteur. */
    /* Les lettres ne sont plus écrites dans le fichier : chaque salle
       marquée en donne une, et le tirage décide laquelle. Ce qu'il faut
       vérifier, par version, c'est qu'il y a exactement autant de
       salles porteuses que de lettres dans la phrase — le tirage étant
       une permutation de ces lettres, l'anagramme est alors acquis.
       On ne cite ici ni les lettres ni la phrase. */
    var attendue = String(d.lettres || '').toUpperCase().replace(/[^A-ZÀ-ÝŒ]/g, '');
    var modes = d.versions ? Object.keys(d.versions) : [];
    if (!modes.length) modes = ['public'];
    modes.forEach(function (m) {
      var porteuses = 0;
      d.etapes.forEach(function (e) {
        if (e.versions && e.versions.indexOf(m) === -1) return;
        if (e.lettre) porteuses++;
      });
      if (porteuses !== attendue.length) {
        avis.push('Version « ' + m + ' » : ' + porteuses + ' salle(s) donnent une lettre, pour ' +
          attendue.length + ' attendue(s) — le tirage ne couvrirait pas la phrase.');
      }
    });
    /* Le sac, le gabarit et l'empreinte doivent parler de la même
       phrase. On ne peut pas vérifier l'empreinte sans la phrase — ce
       serait la contenir —, mais on peut vérifier que le gabarit compte
       autant de cases que le sac a de lettres, et qu'il y a bien une
       empreinte à comparer. Un sac trié, lui, ne dévoile aucun ordre. */
    var tuiles = ((d.finale || {}).ecrans || []).filter(function (x) { return x.format === 'tuiles'; })[0];
    if (tuiles) {
      var cases = (String(tuiles.forme || '').match(/\./g) || []).length;
      if (!tuiles.empreinte) avis.push('La finale en tuiles n’a pas d’empreinte : impossible de reconnaître la bonne réponse.');
      if (tuiles.solution) avis.push('La finale en tuiles garde une solution en clair : à remplacer par « forme » et « empreinte ».');
      if (!cases) avis.push('La finale en tuiles n’a pas de gabarit « forme » (un point par lettre).');
      else if (cases !== attendue.length) {
        avis.push('La finale en tuiles compte ' + cases + ' case(s) pour ' + attendue.length +
          ' lettre(s) distribuée(s).');
      }
    }
    if (d.phrase) avis.push('Le fichier garde une phrase en clair (« phrase ») : à remplacer par « lettres ».');
    d.etapes.forEach(function (e, i) {
      var ou = 'Étape ' + (i + 1) + ' (chapitre ' + e.chapitre + ')';
      if (!MOTEURS[e.format]) avis.push(ou + ' : format « ' + e.format + ' » inconnu.');
      if (!e.indice) avis.push(ou + ' : aucun indice.');
      /* Une étape sans illustration s'afficherait sur papier nu, sans rien
         dire : le bandeau le signale. */
      if (!e.image) avis.push(ou + ' : aucune illustration (champ « image »).');
      else if (!/^[a-z0-9-]+$/.test(e.image)) {
        avis.push(ou + ' : nom d’illustration inattendu « ' + e.image + ' » (exemple : lieu-05).');
      }
      /* Les repères de la salle : sans eux, plus rien à presser. */
      var salle = e.salle || {};
      var repereEnigme = false;
      (salle.touches || []).forEach(function (t, k) {
        var ouT = ou + ', repère ' + (k + 1);
        if (t.cle === 'enigme') repereEnigme = true;
        if (['texte', 'enigme'].indexOf(t.cle) === -1) {
          avis.push(ouT + ' : clé « ' + t.cle + ' » inconnue (attendu : texte ou enigme).');
        }
        if (!(t.x > 0 && t.x < 1) || !(t.y > 0 && t.y < 1)) {
          avis.push(ouT + ' (' + (t.libelle || '') + ') : position hors de l’image.');
        }
        if (!t.libelle) avis.push(ouT + ' : aucun libellé.');
      });
      if (!repereEnigme) avis.push(ou + ' : aucun repère pour l’énigme (champ « salle.touches »).');
      (salle.masques || []).forEach(function (m, k) {
        if (m.x - m.l / 2 < 0 || m.x + m.l / 2 > 1 || m.y - m.h / 2 < 0 || m.y + m.h / 2 > 1) {
          avis.push(ou + ', masque ' + (k + 1) + ' : déborde de l’image.');
        }
      });
      if (e.format === 'selection') {
        (e.aSelectionner || []).forEach(function (x) {
          if ((e.elements || []).indexOf(x) === -1) avis.push(ou + ' : « ' + x + ' » n’est pas dans la liste proposée.');
        });
      }
      if (e.format === 'questions') {
        (e.questions || []).forEach(function (q, k) {
          var opts = q.options || ['Vrai', 'Faux'];
          if (opts.indexOf(q.reponse) === -1) avis.push(ou + ', question ' + (k + 1) + ' : la réponse n’est pas dans les options.');
        });
      }
      if (e.etude) {
        var phrases = e.passage ? lignesDu(e.passage) : [];
        (e.etude.questions || []).forEach(function (q, k) {
          var ouQ = ou + ', étude du texte, question ' + (k + 1);
          if (!q.libelle) avis.push(ouQ + ' : aucun énoncé.');
          if (q.reponse === undefined || q.reponse === '') avis.push(ouQ + ' : aucune réponse.');
          var opts = q.options || (q.format === 'vraifaux' ? ['Vrai', 'Faux'] : null);
          if (opts && opts.indexOf(q.reponse) === -1) avis.push(ouQ + ' : la réponse n’est pas dans les options.');
          /* Les renvois : c'est ici que se voit un extrait modifié sans
             que les questions aient suivi. Un repère explicite doit se
             retrouver dans le texte ; une citation de l'énoncé aussi. */
          ['renvoi', 'renvoiAide'].forEach(function (champ) {
            renvoisDe(q, champ).forEach(function (ancre) {
              if (situer(ancre, phrases)) return;
              var quoi = typeof ancre === 'object' ? (ancre.de + ' … ' + ancre.a) : ancre;
              avis.push(ouQ + (champ === 'renvoi' ? '' : ' (aide)') +
                ' : « ' + String(quoi).slice(0, 60) + ' » ne se trouve pas dans l’extrait.');
            });
          });
          if (/\bl(?:igne)?s?\.\s*\d|\blignes?\s+\d/i.test(q.libelle || '')) {
            avis.push(ouQ + ' : un numéro de ligne est écrit dans l’énoncé ; utilisez « renvoi ».');
          }
        });
      }
      if (e.format === 'champs' && e.presentation === 'trous' && e.phrase) {
        var trous = (e.phrase.match(/_{2,}/g) || []).length;
        if (trous > (e.champs || []).length) avis.push(ou + ' : ' + trous + ' trous pour ' + (e.champs || []).length + ' champ(s).');
      }
    });
    var v = d.versions || {};
    /* Une seule version suffit : le livrable mis en ligne ne contient que
       le grand public, sans les extraits du roman. */
    if (!v.public && !v.eleves) avis.push('Aucune version dans etapes.json : ni « public », ni « eleves ».');
    ['public', 'eleves'].forEach(function (m) {
      if (!v[m]) return;
      if (!v[m].entree || (!v[m].entree.solution && !v[m].entree.empreinte)) {
        avis.push('La version « ' + m + ' » n’a ni mot d’entrée ni empreinte.');
      }
    });
    if (v.eleves) {
      var ch = v.eleves.chapitres || [];
      for (var k = 0; k < ch.length; k++) {
        if (ch[k] < 1 || ch[k] > d.etapes.length) avis.push('Version élèves : le chapitre ' + ch[k] + ' n’existe pas (1 à ' + d.etapes.length + ').');
      }
      /* On n'exige un extrait et une étude que des salles que la classe
         joue vraiment — ni celles du grand public, ni la séance bonus,
         qui revient sur un chapitre déjà lu et n'en montre rien. */
      var pourLaClasse = d.etapes.filter(function (e) {
        return (!e.versions || e.versions.indexOf('eleves') !== -1) && e.bonus !== true;
      });
      var sansPassage = pourLaClasse.filter(function (e) { return !e.passage || !nbLignes(e.passage); }).length;
      if (sansPassage) avis.push('Version élèves : ' + sansPassage + ' étape(s) sans passage du roman.');
      var sansEtude = pourLaClasse.filter(function (e) { return !e.etude || !(e.etude.questions || []).length; }).length;
      if (sansEtude) avis.push('Version élèves : ' + sansEtude + ' étape(s) sans étude du texte.');
    }
    var f = d.finale || {};
    var fin = f.revelationPublic;
    if (fin && fin.code) {
      var c = fin.concours;
      if (!c || !c.courriel) {
        avis.push('L’écran du concours affiche un code mais n’a pas d’adresse où l’envoyer (finale.revelationPublic.concours.courriel).');
      } else if (((c.corps || '') + (c.objet || '')).indexOf('{code}') === -1) {
        avis.push('Le message préparé par le bouton du concours ne reprend pas « {code} » : le lecteur devra recopier le code à la main.');
      }
      if (fin.lienParticiper) {
        avis.push('finale.revelationPublic.lienParticiper n’est plus lu : l’adresse se fabrique à partir du bloc « concours ».');
      }
    }
    if (!f.revelationPublic) avis.push('Il manque l’écran de fin du grand public (finale.revelationPublic).');
    if (!f.revelationEleves) avis.push('Il manque l’écran de fin de la classe (finale.revelationEleves).');
    [['d’entrée', d], ['de fin (grand public)', f.revelationPublic], ['de fin (classe)', f.revelationEleves]]
      .forEach(function (p) {
        if (p[1] && !p[1].image) avis.push('Il manque l’illustration ' + p[0] + ' (champ « image »).');
      });
    return avis;
  }

  /* Le bandeau de contrôle s'adresse à l'auteur, jamais aux joueurs : il
     nomme des champs de fichier, compte des lettres, et un message
     maladroit a déjà dévoilé la phrase finale à des lecteurs. Il ne
     paraît donc QUE sur demande expresse — ?debug=1 — et son texte n'est
     même pas déposé dans la page le reste du temps. La fabrication
     refuse de livrer s'il aurait quelque chose à dire : voir
     outils/controle-production.js. */
  function modeDeveloppeur() {
    try { return /(^|[?&])debug=1(&|$)/.test(window.location.search); }
    catch (e) { return false; }
  }

  function afficherAvertissements(avis) {
    var z = $('avertissements');
    vider(z);
    if (!modeDeveloppeur()) { z.hidden = true; return; }
    if (!avis.length) { z.hidden = true; return; }
    z.hidden = false;
    z.appendChild(el('strong', { texte: 'Avertissement — contenu de etapes.json à corriger :' }));
    var ul = el('ul');
    avis.forEach(function (a) { ul.appendChild(el('li', { texte: a })); });
    z.appendChild(ul);
  }

  function demarrer(donnees) {
    jeu = donnees;
    document.title = (jeu.titreJeu || 'Le jeu du lecteur');
    $('titre-jeu').textContent = jeu.titreJeu || '';
    afficherAvertissements(controler(jeu));
    etat = charger() || etatNeuf();
    $('btn-recommencer').addEventListener('click', recommencer);
    window.addEventListener('beforeunload', sauver);
    ecranCourant();
  }

  function repli(raison) {
    var entree = el('input', {
      type: 'file', accept: '.json,application/json', id: 'fichier-contenu',
      onchange: function () {
        var f = entree.files && entree.files[0];
        if (!f) return;
        var l = new FileReader();
        l.onload = function () {
          try { demarrer(JSON.parse(String(l.result))); }
          catch (err) { msg.hidden = false; msg.setAttribute('data-ton', 'echec'); msg.textContent = 'Fichier illisible : ' + err.message; }
        };
        l.readAsText(f, 'utf-8');
      }
    });
    var msg = el('p', { class: 'retour', hidden: true });
    var scene = $('scene');
    vider(scene);
    scene.appendChild(el('section', { class: 'ecran' }, [
      el('h2', { tabindex: '-1', texte: 'Le contenu du jeu n’a pas pu être chargé' }),
      el('div', { class: 'repli' }, [
        el('p', { texte: 'Le fichier ' + FICHIER + ' n’a pas pu être lu. C’est normal si la page a été ouverte par double-clic depuis un dossier.' }),
        el('p', { class: 'aide-clavier', texte: 'Détail : ' + raison }),
        el('p', {}, [el('label', { for: 'fichier-contenu', class: 'etiquette-fichier', texte: 'Charger etapes.json :' }), entree]),
        msg
      ])
    ]));
  }

  function lancer() {
    var integre = $('contenu-integre');
    if (integre) {
      try { demarrer(JSON.parse(integre.textContent)); } catch (e) { repli('contenu intégré illisible : ' + e.message); }
      return;
    }
    if (!window.fetch) { repli('ce navigateur ne sait pas récupérer le fichier.'); return; }
    window.fetch(FICHIER, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('réponse ' + r.status); return r.text(); })
      .then(function (t) { demarrer(JSON.parse(t)); })
      .catch(function (e) { repli(e && e.message ? e.message : String(e)); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lancer);
  else lancer();

})();
