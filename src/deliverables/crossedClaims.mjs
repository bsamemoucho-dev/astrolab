// Affirmations croisées : empêcher de faire dialoguer deux configurations que
// rien ne relie.
//
// Le moteur de composition ne produit un croisement que sous licence (corps
// partagé, figure calculée) et refuse les autres explicitement. Rien, jusqu'ici,
// n'empêchait le RÉDACTEUR d'écrire quand même « ces deux tensions se répondent ».
// Ce module détecte ces affirmations pour que le validateur les confronte aux
// croisements autorisés du chapitre.
//
// Principe de précision : on ne signale un croisement que si une MÊME PHRASE
// contient au moins deux aspects distincts ET un marqueur d'interaction
// explicite. Une énumération (« Mars oppose Saturne ; Mercure sextile Vénus »)
// n'est pas un croisement. Une phrase qui dit qu'il n'y a PAS de lien est
// explicitement exclue.
//
// Aucune heuristique sémantique : liste fermée de marqueurs, testable.

export const CROSSED_CLAIMS_VERSION = "lastro-crossed-claims@1.0.0";

// Verbes et formules qui affirment qu'une configuration agit sur une autre.
// Volontairement restreint : les simples connecteurs (« et », « tandis que »,
// « parallèlement », « enfin ») ne sont PAS des marqueurs d'interaction.
export const INTERACTION_MARKERS = Object.freeze([
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
export function detectCrossedClaims({ text, detectFacts } = {}) {
  if (typeof detectFacts !== "function") return [];
  const croisements = [];
  const vus = new Set();
  for (const phrase of decouperPhrases(text)) {
    const marqueur = marqueurDe(phrase);
    if (!marqueur) continue;
    if (estNiee(phrase)) continue;
    const aspects = (detectFacts(phrase) ?? []).filter((fact) => fact.type === "ASPECT");
    if (aspects.length < 2) continue;
    for (let i = 0; i < aspects.length; i += 1) {
      for (let j = i + 1; j < aspects.length; j += 1) {
        const premier = aspects[i];
        const second = aspects[j];
        if (cleFact(premier) === cleFact(second)) continue;
        const cle = [cleFact(premier), cleFact(second)].sort().join(">");
        if (vus.has(cle)) continue;
        vus.add(cle);
        croisements.push({ premier, second, marqueur, phrase });
      }
    }
  }
  return croisements;
}

// Un croisement est licencié si un croisement autorisé du chapitre cite les
// DEUX preuves concernées.
export function isCrossingLicensed({ premier, second, relations = [], identifier }) {
  const idPremier = identifier(premier.bodyA, premier.bodyB, premier.aspectType);
  const idSecond = identifier(second.bodyA, second.bodyB, second.aspectType);
  return (relations ?? []).some(
    (relation) =>
      Array.isArray(relation.evidenceRefs) &&
      relation.evidenceRefs.includes(idPremier) &&
      relation.evidenceRefs.includes(idSecond)
  );
}
