// Vocabulaire des détecteurs, par langue.
//
// Pourquoi ce fichier existe : les règles de sécurité factuelle (rien d'affirmé
// qui ne soit calculé, pas de contradiction planète ↔ signe, pas de placeholder,
// pas d'angle présenté comme exact) doivent tenir dans les NEUF langues vendues.
// Écrites en français seulement, elles laissaient passer une erreur factuelle
// dans huit langues sur neuf — et pire, elles refusaient une phrase anglaise
// correcte parce que le mot juste y est « trine ».
//
// Ce vocabulaire n'est jamais imprimé : ce ne sont pas des chaînes d'interface,
// donc il ne vit pas dans i18n.mjs. Les noms de planètes, de signes et d'aspects
// ne sont pas recopiés ici : ils sont dérivés des tables i18n, seule source de
// vérité pour ce que le lecteur voit.

const NOT_LETTER_BEFORE = "(?<![\\p{L}\\p{N}])";
const NOT_LETTER_AFTER = "(?![\\p{L}\\p{N}])";

// Frontières de mot tenant compte des accents : `\b` considère « é », « ê » ou
// « ø » comme des non-lettres, ce qui fabrique des mots inexistants (« complète »
// contient « te », « quête » contient « te »).
export function wordRegex(word, flags = "iu") {
  return new RegExp(`${NOT_LETTER_BEFORE}(?:${word})${NOT_LETTER_AFTER}`, flags);
}

// Correspondance de PRÉFIXE de mot : frontière à gauche seulement.
//
// Pourquoi c'est nécessaire : les noms de signes et d'angles s'infléchissent.
// « Aszendent » devient « Ascendanten » (norvégien), « Löwe » devient « im
// Löwen » (allemand), « Stier » devient « Stieren ». Une correspondance de mot
// exact ne voyait RIEN dans ces cas : la règle de sécurité était silencieusement
// absente de ces langues. Le préfixe attrape l'inflexion.
//
// Contrepartie assumée : un mot plus long qui COMMENCE par le nom compte comme
// le nom. Pour les signes et les angles, le risque pratique est négligeable
// (il faudrait « Leonardo » à côté de « Sun »), et le coût de l'oubli — une
// affirmation fausse livrée — est bien plus élevé. Les noms de corps, eux,
// restent en mot exact : « Sun » ne doit pas correspondre à « sunny ».
export function prefixRegex(word, flags = "iu") {
  return new RegExp(`${NOT_LETTER_BEFORE}(?:${word})`, flags);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeForMatch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

// ---------------------------------------------------------------------------
// Marqueurs d'approximation, d'incertitude ou de frontière : leur présence dans
// une phrase indique que le texte annonce lui-même sa fragilité.
// ---------------------------------------------------------------------------
const HEDGE_WORDS = {
  fr: [
    "probablement", "sans doute", "vraisemblablement", "apparemment", "peut-être", "peut etre",
    "possible", "hypothèse", "semble", "semblent", "semblerait", "sembleraient",
    "frontière", "ne peut pas être tranché", "ne peut pas être déterminé",
    "ne peuvent pas être tranchés", "ne peuvent pas être déterminés", "indécidable",
    "marge", "incertitude", "approximative", "approximatif", "environ", "autour de",
    "vers", "plage", "plutôt", "tendance", "selon", "borne", "bornée", "borné"
  ],
  en: [
    "probably", "likely", "presumably", "apparently", "perhaps", "maybe", "possibly", "possible",
    "hypothesis", "seems", "seem", "seemingly", "boundary", "cannot be determined",
    "cannot be decided", "not decidable", "undecidable", "margin", "uncertainty",
    "approximate", "approximately", "around", "about", "roughly", "range", "rather",
    "tendency", "according to", "bounded", "within the margin", "borderline"
  ],
  de: [
    "wahrscheinlich", "vermutlich", "wohl", "möglicherweise", "vielleicht", "anscheinend",
    "scheinbar", "hypothese", "scheint", "scheinen", "grenze", "nicht entscheidbar",
    "nicht bestimmbar", "spanne", "marge", "unsicherheit", "ungefähr", "etwa", "circa",
    "rund", "gegen", "bereich", "tendenz", "laut", "im rahmen", "begrenzt", "grenzbereich"
  ],
  es: [
    "probablemente", "sin duda", "al parecer", "aparentemente", "quizá", "quizás", "tal vez",
    "posible", "hipótesis", "parece", "parecen", "frontera", "no se puede determinar",
    "no es decidible", "no decidible", "indecidible", "margen", "incertidumbre",
    "aproximada", "aproximado", "alrededor de", "hacia", "unos", "aproximadamente",
    "rango", "más bien", "tendencia", "según", "acotado", "límite"
  ],
  it: [
    "probabilmente", "senza dubbio", "apparentemente", "forse", "magari", "possibile",
    "ipotesi", "sembra", "sembrano", "confine", "non decidibile", "non può essere determinato",
    "indecidibile", "margine", "incertezza", "approssimativa", "approssimativo", "circa",
    "intorno a", "verso", "all'incirca", "intervallo", "piuttosto", "tendenza", "secondo",
    "entro il margine", "limite"
  ],
  pt: [
    "provavelmente", "sem dúvida", "aparentemente", "talvez", "possível", "hipótese", "parece",
    "parecem", "fronteira", "não pode ser determinado", "não decidível", "indecidível",
    "margem", "incerteza", "aproximada", "aproximado", "cerca de", "por volta de", "volta de",
    "aproximadamente", "intervalo", "antes", "tendência", "segundo", "dentro da margem", "limite"
  ],
  no: [
    "sannsynligvis", "trolig", "antakelig", "muligens", "kanskje", "tilsynelatende", "hypotese",
    "ser ut til", "grense", "ikke avgjørbar", "ikke avgjørbart", "kan ikke avgjøres",
    "margin", "usikkerhet", "omtrentlig", "omtrent", "cirka", "rundt", "mot", "område",
    "tendens", "ifølge", "innenfor marginen", "grenseområde"
  ],
  da: [
    "sandsynligvis", "formentlig", "muligvis", "måske", "tilsyneladende", "hypotese",
    "ser ud til", "grænse", "ikke afgørbar", "ikke afgørbart", "kan ikke afgøres",
    "margin", "usikkerhed", "omtrentlig", "omtrent", "cirka", "omkring", "mod", "område",
    "tendens", "ifølge", "inden for marginen", "grænseområde"
  ],
  nl: [
    "waarschijnlijk", "vermoedelijk", "wellicht", "misschien", "mogelijk", "schijnbaar",
    "hypothese", "lijkt", "lijken", "grens", "niet te bepalen", "niet beslisbaar",
    "onbeslisbaar", "marge", "onzekerheid", "bij benadering", "ongeveer", "omstreeks",
    "rond", "tegen", "bereik", "tendens", "volgens", "binnen de marge", "grenszone"
  ]
};

// Mots possessifs : « votre prénom » est un placeholder, « votre Lune » non.
const POSSESSIVE_WORDS = {
  fr: ["votre", "vos", "ton", "ta", "tes"],
  en: ["your"],
  de: ["ihr", "ihre", "dein", "deine"],
  es: ["su", "sus", "tu", "tus"],
  it: ["vostro", "vostra", "vostri", "vostre", "tuo", "tua", "tuoi", "tue"],
  pt: ["seu", "sua", "seus", "suas", "teu", "tua", "teus", "tuas"],
  no: ["din", "ditt", "dine", "deres"],
  da: ["din", "dit", "dine", "jeres", "deres"],
  nl: ["je", "jouw", "uw"]
};

// Champs d'identité : ce sont eux qui trahissent un gabarit non rempli.
//
// Les formes fléchies sont écrites explicitement plutôt que devinées par un
// préfixe : en norvégien, en danois et en allemand, le champ apparaît souvent à
// la forme définie ou déclinée (« fornavnet ditt », « Ihr Vorname », « im
// Namen »). Un préfixe large ferait correspondre « by » (ville) à « bygge ».
const IDENTITY_FIELD_WORDS = {
  fr: ["prénom", "prenom", "nom", "ville", "date", "heure", "lieu"],
  en: ["first name", "name", "city", "date", "time", "place"],
  de: ["vorname", "vornamen", "name", "namen", "stadt", "datum", "zeit", "ort", "orte"],
  es: ["nombre", "nombres", "ciudad", "fecha", "hora", "lugar"],
  it: ["nome", "nomi", "città", "citta", "data", "ora", "luogo"],
  pt: ["nome", "nomes", "cidade", "data", "hora", "local"],
  no: ["fornavn", "fornavnet", "navn", "navnet", "by", "byen", "dato", "datoen", "tid", "tiden", "sted", "stedet"],
  da: ["fornavn", "fornavnet", "navn", "navnet", "by", "byen", "dato", "datoen", "tid", "tiden", "sted", "stedet"],
  nl: ["voornaam", "naam", "namen", "stad", "datum", "tijd", "plaats"]
};

// Verbes d'instruction qu'on ne trouve que dans un gabarit.
const FILL_IN_WORDS = {
  fr: ["insérer", "insérez", "ajouter", "ajoutez", "compléter", "complétez"],
  en: ["insert", "add", "fill in", "complete"],
  de: ["einfügen", "ergänzen", "hinzufügen", "ausfüllen"],
  es: ["insertar", "añadir", "agregar", "completar", "rellenar"],
  it: ["inserire", "aggiungere", "completare"],
  pt: ["inserir", "adicionar", "acrescentar", "completar", "preencher"],
  no: ["sett inn", "legg til", "fyll ut", "fullfør"],
  da: ["indsæt", "tilføj", "udfyld", "færdiggør"],
  nl: ["invoegen", "toevoegen", "aanvullen", "invullen"]
};

// Marqueurs de degré précis (le symbole ° est universel et traité à part).
const DEGREE_WORDS = {
  fr: ["degré", "degrés"],
  en: ["degree", "degrees"],
  de: ["grad"],
  es: ["grado", "grados"],
  it: ["grado", "gradi"],
  pt: ["grau", "graus"],
  no: ["grad", "grader"],
  da: ["grad", "grader"],
  nl: ["graad", "graden"]
};

function tableFor(table, language) {
  return table[language] ?? table.fr;
}

export function hedgeWords(language) {
  return tableFor(HEDGE_WORDS, language);
}

// Les motifs sont compilés une fois par langue : un document fait plusieurs
// centaines de phrases, il n'est pas question de reconstruire vingt-cinq
// expressions régulières à chaque phrase.
const HEDGE_PATTERN_CACHE = new Map();

export function hedgePattern(language) {
  const code = String(language ?? "fr").slice(0, 2).toLowerCase();
  if (!HEDGE_PATTERN_CACHE.has(code)) {
    HEDGE_PATTERN_CACHE.set(
      code,
      tableFor(HEDGE_WORDS, code).map((word) => wordRegex(escapeRegex(word)))
    );
  }
  return HEDGE_PATTERN_CACHE.get(code);
}

export function hasHedgeIn(sentence, language) {
  return hedgePattern(language).some((pattern) => pattern.test(sentence));
}

export function possessiveWords(language) {
  return tableFor(POSSESSIVE_WORDS, language);
}

export function identityFieldWords(language) {
  return tableFor(IDENTITY_FIELD_WORDS, language);
}

export function fillInWords(language) {
  return tableFor(FILL_IN_WORDS, language);
}

export function degreeWords(language) {
  return tableFor(DEGREE_WORDS, language);
}

// ---------------------------------------------------------------------------
// Index dérivés des tables i18n : les noms que le LECTEUR voit.
// ---------------------------------------------------------------------------
function invertLocalizedTable(table) {
  const index = new Map();
  for (const [canonical, localized] of Object.entries(table ?? {})) {
    if (!localized) {
      continue;
    }
    index.set(normalizeForMatch(localized), canonical);
  }
  return index;
}

// Les index sont mémorisés par objet de chaînes (docStrings est mis en cache par
// langue côté appelant) : on ne reconstruit pas les tables à chaque phrase.
const INDEX_CACHE = new WeakMap();

function cachedIndex(strings, table, key) {
  if (!strings || typeof strings !== "object") {
    return invertLocalizedTable(table);
  }
  let entry = INDEX_CACHE.get(strings);
  if (!entry) {
    entry = new Map();
    INDEX_CACHE.set(strings, entry);
  }
  if (!entry.has(key)) {
    entry.set(key, invertLocalizedTable(table));
  }
  return entry.get(key);
}

export function localizedBodyIndex(strings) {
  return cachedIndex(strings, strings?.planets, "planets");
}

export function localizedSignIndex(strings) {
  return cachedIndex(strings, strings?.signs, "signs");
}

export function localizedAspectIndex(strings) {
  return cachedIndex(strings, strings?.aspects, "aspects");
}

// Retrouve les clés canoniques citées dans une phrase, via un index localisé.
// `allowInflection` : correspondance de préfixe pour les noms qui se déclinent
// (signes, angles) ; mot exact pour les corps.
export function canonicalKeysIn(sentence, index, options = {}) {
  const normalized = normalizeForMatch(sentence);
  const matcher = options.allowInflection ? prefixRegex : wordRegex;
  const found = new Set();
  for (const [localized, canonical] of index ?? []) {
    if (matcher(escapeRegex(localized)).test(normalized)) {
      found.add(canonical);
    }
  }
  return [...found];
}

// Un tableau de bord : quelles langues couvrent quoi. Utilisé par les tests pour
// qu'une régression de couverture soit visible plutôt que silencieuse.
export const DETECTOR_LANGUAGES = Object.freeze(["fr", "en", "de", "es", "it", "pt", "no", "da", "nl"]);
