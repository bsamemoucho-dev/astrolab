// Chapitre « Votre thème en mots simples » (convention lastro-mots-simples@1.1.0).
//
// Une version accessible du thème pour les lecteurs qui découvrent l'astrologie :
// chaque placement est traduit en mots courants, sans jargon. Il DIT LA MÊME
// CHOSE que la lecture complète parce qu'il est construit avec le même
// vocabulaire :
// - les fonctions des planètes et les couleurs des signes viennent de
//   BODY_THEMES et SIGN_THEMES, la base des règles d'interprétation natales ;
// - les domaines des maisons viennent du glossaire « Comprendre votre carte » ;
// - le sens des aspects vient des conventions Lastro (tension, circulation plus
//   facile, conjonction selon les corps).
//
// Calculé, sans rédacteur IA : aucun appel payant, aucune invention possible.
// Un signe ou une maison non décidable dans la marge d'heure n'est jamais
// affirmé ; un Ascendant simplement stable est écrit « probable ».

import { HOUSE_DOMAINS_FR } from "./chartGlossary.mjs";
import { BODY_THEMES, SIGN_THEMES } from "./interpretationRules.mjs";

export const PLAIN_LANGUAGE_VERSION = "lastro-mots-simples@1.1.0";
export const PLAIN_LANGUAGE_SECTION_ID = "mots-simples";

const BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];

// Ce que chaque planète représente, en mots de tous les jours. Les cinq premières
// reprennent mot pour mot la page d'accueil (« Pourquoi votre thème ne se résume
// pas à votre signe ») ; Jupiter et Saturne suivent leurs thèmes de règle.
const BODY_PLAIN = Object.freeze({
  Sun: { name: "Le Soleil", short: "le Soleil", plain: "ce que vous cherchez à incarner" },
  Moon: { name: "La Lune", short: "la Lune", feminine: true, plural: true, plain: "vos besoins émotionnels" },
  Mercury: { name: "Mercure", short: "Mercure", plain: "votre manière de penser et de communiquer" },
  Venus: { name: "Vénus", short: "Vénus", feminine: true, plain: "ce que vous aimez et ce qui compte pour vous" },
  Mars: { name: "Mars", short: "Mars", plain: "votre manière d'agir et de vous affirmer" },
  Jupiter: { name: "Jupiter", short: "Jupiter", plain: "votre façon d'élargir votre horizon et de faire confiance" },
  Saturn: { name: "Saturne", short: "Saturne", plain: "votre rapport aux règles, aux responsabilités et aux limites" }
});

const SIGN_FR = Object.freeze({
  Aries: "Bélier", Taurus: "Taureau", Gemini: "Gémeaux", Cancer: "Cancer", Leo: "Lion", Virgo: "Vierge",
  Libra: "Balance", Scorpio: "Scorpion", Sagittarius: "Sagittaire", Capricorn: "Capricorne",
  Aquarius: "Verseau", Pisces: "Poissons"
});

// Article devant le nom du signe : « le Capricorne », « la Balance », « les Gémeaux ».
const SIGN_ARTICLE = Object.freeze({
  Aries: "le", Taurus: "le", Gemini: "les", Cancer: "le", Leo: "le", Virgo: "la",
  Libra: "la", Scorpio: "le", Sagittarius: "le", Capricorn: "le", Aquarius: "le", Pisces: "les"
});

const SUPPORT_CONJUNCTIONS = new Set(["Sun|Venus", "Moon|Venus", "Jupiter|Venus"]);
const TENSION_CONJUNCTIONS = new Set(["Mars|Saturn"]);

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function signWithArticle(sign) {
  const article = SIGN_ARTICLE[sign];
  const name = SIGN_FR[sign];
  return article === "les" ? `les ${name}` : `${article} ${name}`;
}

// « de construction », mais « d'ouverture », « d'intensité ».
function deFr(word) {
  return /^[aeiouyhéèêàâîôû]/i.test(word) ? `d'${word}` : `de ${word}`;
}

function listFr(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} et ${items.at(-1)}`;
}

function houseDomain(house) {
  const raw = HOUSE_DOMAINS_FR[house - 1];
  return raw ? raw.replace(/\.$/, "").toLowerCase() : null;
}

function housesUsable(socle) {
  return socle?.housesAvailable === true && socle?.housesDecidableWithinMargin !== false;
}

function bodyBlock(body, socle) {
  const words = BODY_PLAIN[body.body];
  const signThemes = SIGN_THEMES[body.sign];
  if (!words || !signThemes || !SIGN_FR[body.sign]) {
    return null;
  }
  if (body.signStableWithinMargin === false) {
    return [
      `#### ${capitalize(words.short)} : signe non décidable`,
      `**${words.name}** représente ${words.plain}. Avec la marge d'heure indiquée, ${words.short} change de signe : aucun signe n'est affirmé pour lui dans ce dossier.`
    ].join("\n\n");
  }
  const house = housesUsable(socle) && Number.isInteger(body.house) ? body.house : null;
  const title = `${capitalize(words.short)} en ${SIGN_FR[body.sign]}${house ? `, maison ${house}` : ""}`;
  const bullets = [
    `- **${words.name}** représente ${words.plain} : ${listFr(BODY_THEMES[body.body])}.`,
    `- **${capitalize(signWithArticle(body.sign))}** lui donne une couleur ${deFr(listFr(signThemes))}.`
  ];
  const domain = house ? houseDomain(house) : null;
  if (domain) {
    bullets.push(`- **La maison ${house}** est, dans la convention des maisons, le secteur associé à ce domaine : ${domain}.`);
  }
  if (body.retrograde === true) {
    bullets.push(`- **Rétrograde** : vue depuis la Terre, la planète semblait reculer dans le ciel à votre naissance. C'est un phénomène d'optique, noté ici sans interprétation supplémentaire.`);
  }
  const [first, second] = signThemes;
  return [
    `#### ${title}`,
    bullets.join("\n"),
    `**En clair :** ${words.name.charAt(0).toLowerCase() === "l" ? words.short : words.name} vous parle ${deFr(words.plain)}, sur un mode fait ${deFr(first)} et ${deFr(second)}.`
  ].join("\n\n");
}

function ascendantBlock(socle) {
  const asc = socle?.ascendant;
  if (!asc || !SIGN_THEMES[asc.sign] || asc.decidableWithinMargin === false || asc.signStableWithinMargin === false) {
    return null;
  }
  const probable = asc.marginMinutes ? " (probable)" : "";
  return [
    `#### L'Ascendant en ${SIGN_FR[asc.sign]}${probable}`,
    [`- **L'Ascendant** est le point du zodiaque qui se levait à l'horizon à votre naissance. Il représente symboliquement votre manière d'aborder une situation, le premier pas vers les autres.`,
    `- **${capitalize(signWithArticle(asc.sign))}** lui donne une couleur ${deFr(listFr(SIGN_THEMES[asc.sign]))}.`,
    ...(probable ? ["- **Probable** : avec la marge d'heure indiquée, ce signe reste le même du début à la fin de la fenêtre, mais l'heure exacte n'est pas connue."] : [])].join("\n")
  ].join("\n\n");
}

// Chaque aspect est dit en français courant (« en harmonie », « en tension »)
// avec son nom technique entre parenthèses ; la définition de chaque famille
// d'aspects n'est donnée qu'UNE fois, dans la légende, et non répétée à chaque
// ligne. Le sens suit les conventions Lastro : carré et opposition = tension à
// accorder ; trigone et sextile = circulation plus facile, qui reste à mettre en
// œuvre ; conjonction = selon les corps réunis.
const ASPECT_FR = Object.freeze({ conjunction: "conjonction", opposition: "opposition", square: "carré", trine: "trigone", sextile: "sextile" });

function toFr(short) {
  return short.startsWith("le ") ? `au ${short.slice(3)}` : `à ${short}`;
}

function aspectTitle(aspect, a, b) {
  const first = capitalize(a.short);
  switch (aspect.type) {
    case "opposition": return `${first} face ${toFr(b.short)} (opposition)`;
    case "square": return `${first} en tension avec ${b.short} (carré)`;
    case "trine": return `${first} en harmonie avec ${b.short} (trigone)`;
    case "sextile": return `${first} en accord avec ${b.short} (sextile)`;
    case "conjunction": return `${first} réuni${a.feminine ? "e" : ""} ${toFr(b.short)} (conjonction)`;
    default: return null;
  }
}

function aspectSentence(aspect, a, b) {
  const pair = [aspect.bodyA, aspect.bodyB].sort().join("|");
  // Sujet = la fonction de la première planète ; accord du verbe selon qu'elle
  // est au singulier (« ce que vous… », « votre manière… ») ou au pluriel
  // (« vos besoins émotionnels »).
  const verb = (singular, plural) => (a.plural ? plural : singular);
  switch (aspect.type) {
    case "opposition": return `${a.plain} ${verb("tire", "tirent")} dans une autre direction que ${b.plain}. L'enjeu est de trouver un équilibre entre les deux.`;
    case "square": return `${a.plain} ${verb("se frotte", "se frottent")} à ${b.plain}. L'enjeu est de les accorder plutôt que de choisir l'un contre l'autre.`;
    case "trine": return `${a.plain} ${verb("trouve", "trouvent")} facilement un appui dans ${b.plain}.`;
    case "sextile": return `${a.plain} ${verb("peut", "peuvent")} s'appuyer sur ${b.plain}.`;
    case "conjunction":
      if (SUPPORT_CONJUNCTIONS.has(pair)) return `${a.plain} ${verb("va", "vont")} de pair avec ${b.plain}, et l'un soutient l'autre.`;
      if (TENSION_CONJUNCTIONS.has(pair)) return `${a.plain} ${verb("va", "vont")} de pair avec ${b.plain}, mais sous tension. Les deux demandent à être accordés.`;
      return `${a.plain} ${verb("va", "vont")} de pair avec ${b.plain}, sans que l'un l'emporte d'avance.`;
    default: return null;
  }
}

function retainedPlainAspects(socle) {
  return (socle?.retainedAspects ?? []).filter(
    (aspect) => aspect.marginStable !== false && BODY_PLAIN[aspect.bodyA] && BODY_PLAIN[aspect.bodyB] && ASPECT_FR[aspect.type]
  );
}

function aspectLines(aspects) {
  return aspects.map((aspect) => {
    const a = BODY_PLAIN[aspect.bodyA];
    const b = BODY_PLAIN[aspect.bodyB];
    return `- **${aspectTitle(aspect, a, b)}** : ${aspectSentence(aspect, a, b)}`;
  });
}

// Légende : seulement les familles d'aspects présentes dans la carte.
function aspectLegend(aspects) {
  const types = new Set(aspects.map((aspect) => aspect.type));
  const lines = [];
  if (types.has("conjunction")) lines.push("- **Conjonction** : deux planètes très proches l'une de l'autre, qui agissent ensemble.");
  const easy = ["trine", "sextile"].filter((type) => types.has(type)).map((type) => (type === "trine" ? "trigone" : "sextile"));
  if (easy.length) lines.push(`- **${capitalize(easy.join(", "))}** : une circulation plus facile entre deux parts de vous ; c'est un atout, qui reste à mettre en œuvre.`);
  const hard = ["square", "opposition"].filter((type) => types.has(type)).map((type) => (type === "square" ? "carré" : "opposition"));
  if (hard.length) lines.push(`- **${capitalize(hard.join(", "))}** : une tension entre deux besoins, qui demande à être accordée plutôt que tranchée.`);
  return lines;
}

export function renderPlainLanguageText(socle) {
  const parts = [
    "Ce chapitre traduit votre thème en mots de tous les jours, pour pouvoir le lire sans connaître l'astrologie. Il dit la même chose que les chapitres détaillés, avec le même vocabulaire, mais en plus court. Chaque ligne explique ce que représente un élément de votre carte du ciel et la couleur que lui donne votre thème. Ce sont des repères symboliques à éprouver, pas un portrait figé ni une prédiction.",
    "### Vos planètes, une par une"
  ];
  for (const name of BODIES) {
    const body = (socle?.bodies ?? []).find((entry) => entry.body === name);
    const block = body ? bodyBlock(body, socle) : null;
    if (block) parts.push(block);
  }
  const asc = ascendantBlock(socle);
  if (asc) {
    parts.push("### Votre Ascendant");
    parts.push(asc);
  }
  const aspects = retainedPlainAspects(socle);
  if (aspects.length > 0) {
    parts.push("### Les liens entre vos planètes");
    parts.push("Un aspect est un angle particulier entre deux planètes : il indique que deux parts de vous dialoguent. Par convention :");
    parts.push(aspectLegend(aspects).join("\n"));
    parts.push("Dans votre carte :");
    parts.push(aspectLines(aspects).join("\n"));
  }
  parts.push(
    "Pour aller plus loin, les chapitres suivants reprennent ces mêmes éléments et les développent : comment ils se combinent, et ce qu'ils peuvent éclairer dans vos relations, vos émotions et votre manière d'agir."
  );
  return parts.join("\n\n");
}

// Section prête pour le rendu, ou null hors français ou sans planète lisible.
export function plainLanguageSection({ socle, language = "fr" }) {
  if (language !== "fr") return null;
  const readable = (socle?.bodies ?? []).some((body) => BODY_PLAIN[body.body] && SIGN_THEMES[body.sign]);
  if (!readable) return null;
  return {
    id: PLAIN_LANGUAGE_SECTION_ID,
    title: "Votre thème en mots simples",
    kind: "plain",
    provider: "calculated",
    badgeCode: "symbolic",
    badgeLabel: "Lecture symbolique",
    status: "ok",
    validation: { ok: true, issues: [] },
    methodVersion: PLAIN_LANGUAGE_VERSION,
    text: renderPlainLanguageText(socle)
  };
}
