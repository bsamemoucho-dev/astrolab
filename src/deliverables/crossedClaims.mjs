// Affirmations croisées : empêcher de faire dialoguer deux configurations que
// rien ne relie.
//
// Le moteur de composition ne produit un croisement que sous licence (corps
// partagé, figure calculée) et refuse les autres explicitement. Rien, jusqu'ici,
// n'empêchait le RÉDACTEUR d'écrire quand même « ces deux tensions se répondent ».
// Ce module détecte ces affirmations pour que le validateur les confronte aux
// croisements autorisés du chapitre.
//
// Détecter deux aspects explicites dans une phrase, ou leurs antécédents
// dans les phrases/blocs précédents lorsqu’un renvoi explicite les relie. Une énumération (« Mars oppose Saturne ; Mercure sextile Vénus »)
// n'est pas un croisement. Une phrase qui dit qu'il n'y a PAS de lien est
// explicitement exclue.
//
// Aucune heuristique sémantique : liste fermée de marqueurs, testable.

export const CROSSED_CLAIMS_VERSION = "lastro-crossed-claims@1.1.0";

// Verbes et formules qui affirment qu'une configuration agit sur une autre.
// Volontairement restreint : les simples connecteurs (« et », « tandis que »,
// « parallèlement », « enfin ») ne sont PAS des marqueurs d'interaction.
export const INTERACTION_MARKERS = Object.freeze([
  "mise à l’épreuve par",
  "mise à l'épreuve par",
  "mis à l’épreuve par",
  "mis à l'épreuve par",
  "renforce",
  "contrecarre",
  "se répondent",
  "se répond",
  "résonnent",
  "résonne",
  "se renforcent",
  "se renforce",
  "se compensent",
  "se compense",
  "s'équilibrent",
  "s'équilibre",
  "se tempèrent",
  "se tempère",
  "tempère",
  "tempèrent",
  "contrebalance",
  "contrebalancent",
  "dialoguent",
  "dialogue",
  "s'articulent",
  "s'articule",
  "s'éclairent",
  "s'éclaire",
  "se nourrissent",
  "se nourrit",
  "nourrit",
  "forment ensemble",
  "forment un couple",
  "vont ensemble",
  "s'additionnent",
  "se cumulent",
  "se neutralisent",
  "se contredisent",
  "se rejoignent",
  "se prolongent",
  "prolonge",
  "met en relation",
  "mettent en relation",
  "relie",
  "relient",
  "fait dialoguer",
  "font dialoguer"
]);

// Une phrase qui nie le lien ne doit pas être signalée.
const NEGATIONS = [
  /\bne\s+[^.!?]{0,60}\b(pas|plus|jamais|guère)\b/i,
  /\bsans\s+(lien|rapport|relation)\b/i,
  /\baucun(e)?\s+(lien|rapport|relation)\b/i,
  /\brien\s+ne\s+(les\s+)?relie\b/i,
  /\bindépendamment\b/i
];

function decouperPhrases(texte) {
  return String(texte ?? "")
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 0);
}

function cleFact(fact) {
  return [fact.bodyA, fact.bodyB, fact.aspectType].map((valeur) => String(valeur ?? "").toLowerCase()).sort().join("|");
}

function marqueurDe(phrase) {
  const normalisee = phrase.toLowerCase();
  return INTERACTION_MARKERS.find((marqueur) => normalisee.includes(marqueur)) ?? null;
}

function estNiee(phrase) {
  return NEGATIONS.some((motif) => motif.test(phrase));
}

// `detectFacts` est injecté pour éviter un cycle d'import avec le validateur.
export function detectCrossedClaims({ text, contextText = "", detectFacts } = {}) {
  if (typeof detectFacts !== "function") return [];
  const croisements = [];
  const vus = new Set();
  const antecedents = new Map((detectFacts(contextText) ?? []).filter((fact) => fact.type === "ASPECT").map((fact) => [canonicalAspectKey(fact), fact]));
  for (const phrase of decouperPhrases(text)) {
    const explicites = (detectFacts(phrase) ?? []).filter((fact) => fact.type === "ASPECT");
    for (const fact of explicites) antecedents.set(canonicalAspectKey(fact), fact);
    const marqueur = marqueurDe(phrase);
    if (!marqueur) continue;
    if (estNiee(phrase)) continue;
    // Resolve only explicit anaphoric interactions. If several antecedents are
    // possible, every possible pair must be licensed; never invent a licence.
    const anaphorique = /\b(ces deux|ces configurations|ces aspects|cette harmonie|cette tension|cet aspect|précédemment|évoqué[es]*)\b/iu.test(phrase);
    const aspects = explicites.length >= 2 ? explicites : anaphorique ? [...antecedents.values()] : explicites;
    if (aspects.length < 2) continue;
    for (let i = 0; i < aspects.length; i += 1) {
      for (let j = i + 1; j < aspects.length; j += 1) {
        const premier = aspects[i];
        const second = aspects[j];
        if (cleFact(premier) === cleFact(second)) continue;
        const cle = [cleFact(premier), cleFact(second)].sort().join(">");
        if (vus.has(cle)) continue;
        vus.add(cle);
        croisements.push({ premier, second, marqueur, phrase, provenance: explicites.length >= 2 ? "explicit_sentence" : "contextual_antecedents" });
      }
    }
  }
  return croisements;
}

// Clé canonique d'un aspect : l'ordre des deux corps ne compte pas. Le texte
// peut écrire « Jupiter trigone au Soleil » là où l'identifiant de preuve est
// `aspect.sun.jupiter.trine` — comparer les chaînes telles quelles produirait un
// faux refus.
export function canonicalAspectKey({ bodyA, bodyB, aspectType }) {
  return [String(bodyA ?? "").toLowerCase(), String(bodyB ?? "").toLowerCase()].sort().join("|") +
    "|" + String(aspectType ?? "").toLowerCase();
}

// Un croisement est licencié si un croisement autorisé du chapitre cite les
// DEUX preuves concernées, quel que soit l'ordre des corps.
export function isCrossingLicensed({ premier, second, relations = [], resolveRef }) {
  const clePremier = canonicalAspectKey(premier);
  const cleSecond = canonicalAspectKey(second);
  const cleDe = (ref) => {
    const valeur = resolveRef ? resolveRef(ref) : null;
    return valeur ? canonicalAspectKey(valeur) : null;
  };
  return (relations ?? []).some((relation) => {
    const cles = (relation.evidenceRefs ?? []).map(cleDe).filter(Boolean);
    return cles.includes(clePremier) && cles.includes(cleSecond);
  });
}
