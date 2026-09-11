// Traçabilité des affirmations d'une lecture.
//
// Quatre natures, jamais mélangées :
//   CALCULATED       position astronomique calculée et vérifiée
//   TRADITIONAL_RULE règle issue d'une tradition identifiée (sourcée)
//   LASTRO_RULE      convention interne Lastro, documentée et versionnée
//   LLM_SYNTHESIS    formulation produite par le modèle à partir de ce qui précède
//
// Une convergence ne peut jamais augmenter la certitude **factuelle** : elle
// n'augmente que la force du langage symbolique. Le plafond de langage est fixé
// par la qualité des données disponibles, pas par le nombre d'indicateurs.

export const PROVENANCE = Object.freeze({
  calculated: "CALCULATED",
  traditionalRule: "TRADITIONAL_RULE",
  lastroRule: "LASTRO_RULE",
  llmSynthesis: "LLM_SYNTHESIS"
});

// Convention de synthèse : à ce jour, aucune règle interprétative traditionnelle
// n'est active. Le document doit le dire plutôt que de le laisser croire.
export const CONVERGENCE_RULE_VERSION = Object.freeze({
  id: "lastro-convergence",
  version: "1.0.0",
  nature: PROVENANCE.lastroRule,
  purpose: "hierarchiser les convergences interpretatives d'une lecture",
  disclaimer: "Ne constitue pas une regle astrologique traditionnelle.",
  traditionalRulesActive: false
});

export function provenanceSummary() {
  return {
    astronomy: PROVENANCE.calculated,
    traditionalRules: CONVERGENCE_RULE_VERSION.traditionalRulesActive ? PROVENANCE.traditionalRule : null,
    lastroConvention: `${CONVERGENCE_RULE_VERSION.id}@${CONVERGENCE_RULE_VERSION.version}`,
    text: PROVENANCE.llmSynthesis,
    note: CONVERGENCE_RULE_VERSION.disclaimer
  };
}
