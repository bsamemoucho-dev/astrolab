// Diagnostics éditoriaux — MESURER, jamais réécrire.
//
// Exigence du commanditaire : un détecteur de recopie ne doit pas devenir un
// nouveau motif de rejet avec réécriture payante. Ces fonctions ne bloquent rien
// et ne déclenchent aucun appel : elles produisent des mesures lisibles, à
// interpréter par un humain.
//
// Ce qu'elles mesurent :
//   - la dépendance aux formulations sources (plus longue suite de mots recopiée) ;
//   - la nouveauté d'un chapitre (recouvrement avec les idées qu'il possède) ;
//   - les répétitions entre chapitres (n-grammes partagés) ;
//   - la couverture des croisements autorisés (les relations sont-elles servies ?).

export const EDITORIAL_DIAGNOSTICS_VERSION = "lastro-editorial-diagnostics@1.0.0";

const MOTS_VIDES = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "à", "au", "aux",
  "en", "dans", "sur", "pour", "par", "avec", "sans", "que", "qui", "dont", "où",
  "est", "sont", "peut", "peuvent", "cette", "ces", "son", "sa", "ses", "votre",
  "vous", "il", "elle", "on", "ne", "pas", "plus", "très", "comme", "mais", "si"
]);

export function normaliser(texte) {
  return String(texte ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mots(texte) {
  const normalise = normaliser(texte);
  return normalise ? normalise.split(" ") : [];
}

export function motsPleins(texte) {
  return mots(texte).filter((mot) => !MOTS_VIDES.has(mot) && mot.length > 2);
}

// Plus longue suite de mots d'une source retrouvée telle quelle dans le texte.
// `sources` : chaînes (règles, thèmes) ou objets {label}.
export function verbatimDependency({ text, sources = [], minRun = 3 } = {}) {
  const corpus = ` ${normaliser(text)} `;
  let maxRun = 0;
  let pireSource = null;
  const spans = [];
  for (const source of sources) {
    const libelle = typeof source === "string" ? source : source?.label ?? "";
    const suite = mots(libelle);
    if (suite.length < minRun) continue;
    let meilleur = 0;
    for (let i = 0; i < suite.length; i += 1) {
      for (let j = suite.length; j - i > meilleur && j - i >= minRun; j -= 1) {
        if (corpus.includes(` ${suite.slice(i, j).join(" ")} `)) {
          meilleur = j - i;
          break;
        }
      }
    }
    if (meilleur >= minRun) spans.push({ source: libelle, run: meilleur });
    if (meilleur > maxRun) {
      maxRun = meilleur;
      pireSource = libelle;
    }
  }
  spans.sort((gauche, droite) => droite.run - gauche.run);
  return { maxRun, worstSource: pireSource, spans, sourcesExaminees: sources.length };
}

// Nouveauté : part des mots pleins du texte qui viennent des idées possédées.
// Un chapitre dont presque tous les mots pleins viennent de ses sources ne fait
// que reformuler.
export function chapterNovelty({ text, ownedLabels = [] } = {}) {
  const vocabulaire = new Set(ownedLabels.flatMap((label) => motsPleins(label)));
  const pleins = motsPleins(text);
  if (pleins.length === 0) return { filledWords: 0, fromSources: 0, novelRatio: 0 };
  const dedans = pleins.filter((mot) => vocabulaire.has(mot)).length;
  return {
    filledWords: pleins.length,
    fromSources: dedans,
    novelRatio: Math.round(((pleins.length - dedans) / pleins.length) * 100) / 100
  };
}

// Recouvrement lexical (Jaccard sur les mots pleins) : mesure grossière mais
// robuste de la redondance de CONTENU entre deux chapitres, là où les n-grammes
// exacts ne voient plus rien dès que la formulation change.
export function lexicalOverlap(premier, second) {
  const a = new Set(motsPleins(premier));
  const b = new Set(motsPleins(second));
  if (a.size === 0 || b.size === 0) return 0;
  let communs = 0;
  for (const mot of a) if (b.has(mot)) communs += 1;
  return Math.round((communs / (a.size + b.size - communs)) * 100) / 100;
}

// Répétitions entre chapitres : n-grammes exacts ET recouvrement lexical.
export function crossChapterRepetition({ sections = [], n = 5, seuil = 0.12, seuilLexical = 0.2 } = {}) {
  const jeux = sections.map((section) => {
    const suite = motsPleins(section.text);
    const grammes = new Set();
    for (let i = 0; i + n <= suite.length; i += 1) grammes.add(suite.slice(i, i + n).join(" "));
    return { id: section.id, grammes };
  });
  const paires = [];
  for (let i = 0; i < jeux.length; i += 1) {
    for (let j = i + 1; j < jeux.length; j += 1) {
      const petit = jeux[i].grammes.size <= jeux[j].grammes.size ? jeux[i] : jeux[j];
      const grand = petit === jeux[i] ? jeux[j] : jeux[i];
      if (petit.grammes.size === 0) continue;
      let communs = 0;
      for (const gramme of petit.grammes) if (grand.grammes.has(gramme)) communs += 1;
      const ratio = communs / petit.grammes.size;
      const lexical = lexicalOverlap(sections[i].text ?? "", sections[j].text ?? "");
      if (ratio >= seuil || lexical >= seuilLexical) {
        paires.push({
          a: jeux[i].id,
          b: jeux[j].id,
          sharedNgrams: communs,
          ngramRatio: Math.round(ratio * 100) / 100,
          lexicalRatio: lexical
        });
      }
    }
  }
  return paires.sort((gauche, droite) => droite.lexicalRatio - gauche.lexicalRatio);
}

// Les croisements autorisés sont-ils réellement servis par le chapitre ?
// Heuristique : les deux corps d'une relation doivent apparaître dans le texte.
export function relationCoverage({ text, relations = [] } = {}) {
  const corpus = normaliser(text);
  const servies = [];
  const manquees = [];
  for (const relation of relations) {
    const corps = (relation.corps ?? []).map((body) => normaliser(String(body)));
    const presente = corps.length > 0 && corps.every((body) => corpus.includes(body));
    (presente ? servies : manquees).push(relation.relationId ?? relation.label ?? "relation");
  }
  return { servies, manquees, couverture: relations.length === 0 ? null : servies.length / relations.length };
}

// Synthèse d'un dossier. Aucune note globale : des mesures, pas un score.
export function diagnose({ sections = [], editorialPlan = null } = {}) {
  const diagnostics = sections.map((section) => ({
    id: section.id,
    words: mots(section.text).length,
    verbatim: verbatimDependency({ text: section.text, sources: section.sources ?? [] }),
    novelty: chapterNovelty({ text: section.text, ownedLabels: section.ownedLabels ?? [] }),
    relationCoverage: relationCoverage({ text: section.text, relations: section.relations ?? [] })
  }));
  return {
    version: EDITORIAL_DIAGNOSTICS_VERSION,
    sections: diagnostics,
    repetitions: crossChapterRepetition({ sections }),
    plan: editorialPlan
      ? {
          ideas: editorialPlan.ideas?.length ?? 0,
          relations: editorialPlan.relations?.length ?? 0,
          refusals: editorialPlan.rejected?.length ?? 0,
          gaps: (editorialPlan.gaps ?? []).map((gap) => gap.code)
        }
      : null
  };
}
