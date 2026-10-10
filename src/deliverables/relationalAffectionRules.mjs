export const RELATIONAL_AFFECTION_SCOPE = "individual_relational.affection";

const INTERPRETATION_LIBRARY_VERSION = "lastro-interpretation-library@0.2.0";

const COMMON_FORBIDDEN = Object.freeze([
  "diagnostic psychologique",
  "événement biographique inventé",
  "prédiction",
  "fatalisme",
  "certitude sur un tiers"
]);

function scopeNote(text, note) {
  return { text, note };
}

function forbiddenText(entry) {
  return typeof entry === "string" ? entry : entry.text;
}

function forbiddenScopeNotes(entries = []) {
  return entries
    .filter((entry) => entry && typeof entry === "object" && entry.note)
    .map((entry) => ({ forbidden: entry.text, note: entry.note }));
}

function mergeForbiddenEntries(entries = []) {
  const byText = new Map();
  for (const entry of entries) {
    const text = forbiddenText(entry);
    const existing = byText.get(text);
    if (!existing || (typeof entry === "object" && entry.note)) {
      byText.set(text, entry);
    }
  }
  return [...byText.values()];
}

export const RELATIONAL_AFFECTION_SELECTION_POLICY = Object.freeze({
  maxAspectRulesInProse: 2,
  maxAttentionPoints: 1,
  aspectPriority: "normalized_exactness",
  fallback: "venus_sign_when_no_certain_aspect_and_sign_stable"
});

export const AFFECTION_MOON_VENUS_FORBIDDEN = Object.freeze([
  scopeNote("besoin d'être rassuré ou protégé", "relève de « Besoins relationnels »"),
  scopeNote("besoin de fusion ou de proximité", "relève de « Besoin d'espace et de proximité »"),
  "dépendance affective",
  "rôle maternel, parental ou protecteur",
  "capacité à deviner les émotions de l'autre",
  "manière de recevoir l'affection",
  scopeNote("compatibilité ou incompatibilité émotionnelle avec une autre personne", "relèverait d'une future synastrie")
]);

const AFFECTION_MOON_VENUS_FLUID_FORBIDDEN = Object.freeze([
  "empathie parfaite ou compréhension émotionnelle garantie",
  "harmonie émotionnelle garantie ou absence de conflits",
  "facilité relationnelle générale",
  "réussite ou stabilité de la relation"
]);

export const AFFECTION_VENUS_JUPITER_FORBIDDEN = Object.freeze([
  "extravagance permanente",
  "démesure présentée comme un trait général",
  "dépenses, cadeaux coûteux ou affection exprimée par l'argent",
  "chance en amour ou facilité à trouver un partenaire",
  "multiplicité des relations ou infidélité",
  "promesses non tenues ou engagement superficiel",
  "indulgence excessive ou complaisance",
  "attitude protectrice, paternaliste ou condescendante",
  "convictions morales, religieuses ou philosophiques",
  scopeNote("besoin de plaisir, de confort ou d'abondance", "relève de « Besoins relationnels »"),
  "réussite ou harmonie de la relation",
  "manière dont l'autre réagit aux encouragements",
  scopeNote("manière de recevoir l'affection", "relève de « Besoins relationnels »"),
  scopeNote("compatibilité avec une autre personne", "relèverait d'une future synastrie")
]);

export const AFFECTION_VENUS_SATURN_FORBIDDEN = Object.freeze([
  "froideur, distance ou absence émotionnelle",
  "incapacité à aimer ou à exprimer son affection",
  "blocage affectif ou inhibition permanente",
  "peur de l'intimité, du rejet ou de l'abandon",
  "frustration, privation ou manque d'affection",
  "pessimisme ou méfiance",
  "rigidité, contrôle ou autorité dans la relation",
  "affection vécue comme une obligation ou un devoir",
  "sacrifice de soi ou dévouement imposé",
  "affection conditionnelle, devant être gagnée ou méritée",
  "lenteur systématique à s'engager",
  "différence d'âge ou attirance pour une personne plus âgée",
  "fidélité garantie ou promesse de durée de la relation",
  "relation karmique, destinée ou inévitable",
  scopeNote("besoin de sécurité, de stabilité ou de cadre", "relève de « Besoins relationnels »"),
  "statut social, ambition ou réussite professionnelle",
  scopeNote("manière de recevoir l'affection", "relève de « Besoins relationnels »"),
  scopeNote("compatibilité avec une autre personne", "relèverait d'une future synastrie")
]);

function ruleSlug(value) {
  return String(value ?? "").toLowerCase();
}

function aspectRuleId(bodyA, bodyB, aspectType) {
  return `western.relational.affection.${ruleSlug(bodyA)}_${ruleSlug(bodyB)}.${ruleSlug(aspectType)}@1`;
}

function signRuleId(sign) {
  return `western.relational.affection.venus.sign.${ruleSlug(sign)}@1`;
}

function affectionRuleBase({ ruleId, evidenceType, match, centralTheme, spontaneousTheme, resourceTheme, attentionTheme = null, forbidden = [], sourceKind }) {
  const forbiddenEntries = mergeForbiddenEntries([...COMMON_FORBIDDEN, ...forbidden]);
  return {
    ruleId,
    evidenceType,
    match,
    scope: [RELATIONAL_AFFECTION_SCOPE],
    provenance: "LASTRO_RULE",
    subtype: "RELATIONAL_INTERPRETATION",
    version: INTERPRETATION_LIBRARY_VERSION,
    themes: [spontaneousTheme],
    relationalAffection: {
      axisId: "affection",
      sourceKind,
      centralTheme,
      spontaneousThemes: [spontaneousTheme],
      resourceThemes: [resourceTheme],
      attentionThemes: attentionTheme ? [attentionTheme] : []
    },
    forbidden: forbiddenEntries.map(forbiddenText),
    forbiddenScopeNotes: forbiddenScopeNotes(forbiddenEntries)
  };
}

function venusSignRule(sign, data) {
  return affectionRuleBase({
    ruleId: signRuleId(sign),
    evidenceType: "NATAL_BODY_SIGN",
    match: { body: "Venus", sign },
    sourceKind: "fallback_venus_sign",
    ...data
  });
}

function affectionAspectRule(bodyA, bodyB, aspectType, data, familyForbidden = []) {
  const { forbidden = [], ...ruleData } = data;
  return affectionRuleBase({
    ruleId: aspectRuleId(bodyA, bodyB, aspectType),
    evidenceType: "NATAL_ASPECT",
    match: { bodies: [bodyA, bodyB], aspectType },
    sourceKind: "aspect",
    forbidden: [...familyForbidden, ...forbidden],
    ...ruleData
  });
}

const VENUS_SIGN_RULES = [
  venusSignRule("Aries", {
    centralTheme: "une affection exprimée de façon directe, spontanée et enthousiaste",
    spontaneousTheme: "manifester son affection rapidement et ouvertement, par un geste concret ou un élan visible",
    resourceTheme: "capacité à rendre son affection explicite et à lui donner une forme concrète",
    forbidden: ["agressivité", "jalousie ou possessivité", "instabilité affective", "incapacité à s'engager", "besoin de conquête", "besoin d'une réponse immédiate", "libido ou comportement sexuel", "manière de recevoir l'affection", "manque d'affection dans les moments calmes", scopeNote("initiative de rencontre ou fait de faire le premier pas", "relève de « Manière d'entrer en relation »")]
  }),
  venusSignRule("Taurus", {
    centralTheme: "une affection exprimée avec constance, par des attentions concrètes et régulières",
    spontaneousTheme: "manifester son affection par des gestes tangibles et des marques d'attention répétées",
    resourceTheme: "capacité à inscrire l'expression de son affection dans des gestes concrets et suivis",
    forbidden: ["possessivité ou jalousie", "matérialisme", "affection nécessairement exprimée par l'argent ou par des cadeaux", "absence d'expression verbale", "rigidité, entêtement ou résistance au changement", "lenteur ou passivité dans la relation", "fidélité garantie ou durée de la relation", scopeNote("besoin de sécurité ou de stabilité", "relève de « Besoins relationnels »"), scopeNote("sensualité sexuelle ou libido", "relève de « Désir, initiative et manière d'agir »"), scopeNote("besoin de proximité physique", "relève de « Besoin d'espace et de proximité »"), scopeNote("manière de recevoir l'affection", "relève de « Besoins relationnels »")]
  }),
  venusSignRule("Gemini", {
    centralTheme: "une affection exprimée par la complicité, le jeu et la curiosité partagée",
    spontaneousTheme: "manifester son affection en partageant des découvertes, de l'humour et des moments de complicité ludique",
    resourceTheme: "capacité à rendre son affection visible par l'intérêt porté aux centres d'intérêt de l'autre et par le plaisir de partager avec lui",
    forbidden: ["inconstance, superficialité ou dispersion affective", "infidélité ou difficulté à s'engager", "détachement émotionnel ou affection « cérébrale »", scopeNote("besoin de variété ou de nouveauté", "relève de « Besoins relationnels »"), scopeNote("séduction ou flirt", "relève de « Manière d'entrer en relation » ou de « Désir, initiative et manière d'agir »"), "affection nécessairement exprimée par les mots ou par la conversation", scopeNote("manière de formuler, ton, tact, éloquence ou qualité de l'expression verbale", "relève de « Communication relationnelle »"), scopeNote("compatibilité intellectuelle avec l'autre", "relèverait d'une future synastrie"), scopeNote("manière de recevoir l'affection", "relève de « Besoins relationnels »")]
  }),
  venusSignRule("Cancer", {
    centralTheme: "une affection exprimée par le soin et par l'attention portée à ce qui compte pour l'autre",
    spontaneousTheme: "manifester son affection en prenant soin de l'autre, par des attentions adaptées à son quotidien et par des moments accueillants",
    resourceTheme: "capacité à traduire son affection en gestes de soin attentifs et concrets",
    forbidden: ["surprotection, possessivité ou jalousie", "susceptibilité, humeur changeante ou repli sur soi", "dépendance affective", "rôle parental ou maternel dans la relation", "capacité à deviner instinctivement les besoins de l'autre", scopeNote("besoin d'être rassuré, de sécurité ou de cocon", "relève de « Besoins relationnels »"), scopeNote("besoin de fusion ou de proximité", "relève de « Besoin d'espace et de proximité »"), "mémoire affective, attachement au passé ou nostalgie", "domesticité ou affection nécessairement exprimée par le foyer, la cuisine ou la famille", "manière dont l'autre interprète ces attentions", scopeNote("manière de recevoir l'affection", "relève de « Besoins relationnels »")]
  }),
  venusSignRule("Leo", {
    centralTheme: "une affection exprimée avec chaleur, générosité et de façon visible",
    spontaneousTheme: "manifester son affection ouvertement, en valorisant l'autre et en exprimant clairement ce que l'on apprécie chez lui ou chez elle",
    resourceTheme: "capacité à donner des marques d'affection chaleureuses, explicites et généreuses",
    forbidden: [scopeNote("besoin d'admiration, d'attention ou de reconnaissance", "relève de « Besoins relationnels »"), "orgueil, vanité ou égocentrisme", "théâtralité ou affection mise en scène", "démonstration nécessairement publique", "domination ou volonté de contrôle", "possessivité ou jalousie", "affection conditionnelle ou attente de retour", "générosité nécessairement matérielle ou financière", scopeNote("séduction ou volonté de plaire", "relève de « Manière d'entrer en relation » ou de « Désir, initiative et manière d'agir »"), "manière dont l'autre reçoit ces manifestations", scopeNote("manière de recevoir l'affection", "relève de « Besoins relationnels »")]
  }),
  venusSignRule("Virgo", {
    centralTheme: "une affection exprimée par l'aide concrète, le service rendu et l'attention aux détails pratiques",
    spontaneousTheme: "manifester son affection en proposant une aide utile, en rendant service et en portant attention aux détails du quotidien",
    resourceTheme: "capacité à traduire son affection en actes pratiques et en attentions précises",
    forbidden: ["esprit critique, exigence ou perfectionnisme", "froideur ou réserve émotionnelle", "anxiété ou inquiétude", "sacrifice de soi ou dévouement excessif", "volonté de contrôler, corriger ou organiser l'autre", "compétence pratique ou sens de l'organisation garantis", "affection nécessairement exprimée par les tâches domestiques", scopeNote("besoin de se sentir utile", "relève de « Besoins relationnels »"), "tendance à donner des solutions ou des conseils", scopeNote("manière de formuler ou de conseiller", "relève de « Communication relationnelle »"), "manière dont l'autre accueille cette aide", scopeNote("manière de recevoir l'affection", "relève de « Besoins relationnels »")]
  }),
  venusSignRule("Libra", {
    centralTheme: "une affection exprimée par les égards, la considération et la place accordée à l'autre",
    spontaneousTheme: "manifester son affection par des attentions délicates et en tenant compte des préférences de l'autre dans les moments et les choix partagés",
    resourceTheme: "capacité à rendre son affection visible par des gestes de considération et par une véritable place faite à l'autre",
    forbidden: [scopeNote("attente de réciprocité ou de retour affectif", "relève de « Besoins relationnels »"), scopeNote("évitement des conflits ou des désaccords", "relève de « Manière d'aborder les désaccords »"), scopeNote("besoin d'harmonie, d'approbation ou de vivre en couple", "relève de « Besoins relationnels »"), "indécision ou hésitation affective", "superficialité ou attachement aux apparences", "complaisance ou effacement de soi", "peur de la solitude", scopeNote("séduction ou charme", "relève de « Manière d'entrer en relation »"), scopeNote("tact, ton, formulation ou recherche d'accord dans la parole", "relève de « Communication relationnelle »"), "manière dont l'autre réagit à ces égards", scopeNote("manière de recevoir l'affection", "relève de « Besoins relationnels »")]
  }),
  venusSignRule("Scorpio", {
    centralTheme: "une affection exprimée avec intensité, profondeur et implication personnelle",
    spontaneousTheme: "manifester son affection par un investissement personnel marqué et en accordant de l'importance aux moments affectivement significatifs dans le lien",
    resourceTheme: "capacité à maintenir une présence affectivement engagée lorsque la relation traverse un moment difficile ou émotionnellement chargé",
    forbidden: ["jalousie, possessivité ou méfiance", "besoin de contrôle, rapport de pouvoir ou manipulation", "obsession, dépendance ou fusion", "rancune ou esprit de vengeance", "goût du secret ou dissimulation", "fonctionnement affectif en « tout ou rien »", "fidélité garantie ou promesse de durée de la relation", "soutien inconditionnel ou disponibilité garantie", scopeNote("intensité sexuelle ou libido", "relève de « Désir, initiative et manière d'agir »"), scopeNote("besoin de profondeur, d'exclusivité ou de confiance", "relève de « Besoins relationnels »"), scopeNote("besoin de fusion ou de proximité", "relève de « Besoin d'espace et de proximité »"), "préférence pour le tête-à-tête ou discrétion en groupe", scopeNote("manière de recevoir l'affection", "relève de « Besoins relationnels »")]
  }),
  venusSignRule("Sagittarius", {
    centralTheme: "une affection exprimée par l'enthousiasme, l'encouragement et le partage d'expériences",
    spontaneousTheme: "manifester son affection en proposant des découvertes, des projets ou des expériences à vivre ensemble",
    resourceTheme: "capacité à exprimer son affection en soutenant les projets de l'autre et en ouvrant des possibilités à partager",
    forbidden: ["inconstance, infidélité ou difficulté à s'engager", "fuite, désinvolture ou légèreté affective", "imprudence ou goût du risque", "optimisme permanent ou tempérament forcément positif", "absence d'attentions dans le quotidien", scopeNote("besoin de liberté ou d'indépendance", "relève de « Besoin d'espace et de proximité »"), scopeNote("besoin d'aventure, de voyage ou de nouveauté", "relève de « Besoins relationnels »"), "capacité à faire grandir ou évoluer l'autre", scopeNote("franchise ou manière de dire les choses", "relève de « Communication relationnelle »"), scopeNote("séduction ou goût de la conquête", "relève de « Manière d'entrer en relation »"), scopeNote("compatibilité philosophique, morale ou spirituelle", "relèverait d'une future synastrie"), "manière dont l'autre réagit à ces propositions", scopeNote("manière de recevoir l'affection", "relève de « Besoins relationnels »")]
  }),
  venusSignRule("Capricorn", {
    centralTheme: "une affection exprimée par une implication suivie, le soutien de ce qui se construit et la contribution aux responsabilités partagées",
    spontaneousTheme: "manifester son affection en soutenant les objectifs de l'autre et en prenant une part concrète dans les engagements décidés ensemble",
    resourceTheme: "capacité à traduire son affection en implication dans des projets et des responsabilités qui demandent de la continuité",
    forbidden: ["froideur, distance ou difficulté à exprimer ses émotions", "rigidité ou austérité", "calcul, intérêt ou ambition dans la relation", "autorité ou volonté de contrôle", "pessimisme ou méfiance", "lenteur à s'engager ou peur de l'engagement", "importance du statut social ou des apparences", "soutien nécessairement professionnel ou financier", "sens des responsabilités ou fiabilité garantis", "fidélité garantie ou promesse de durée de la relation", scopeNote("besoin de sécurité, de stabilité ou de cadre", "relève de « Besoins relationnels »"), "manière dont l'autre vit ou évalue cette implication", scopeNote("manière de recevoir l'affection", "relève de « Besoins relationnels »")]
  }),
  venusSignRule("Aquarius", {
    centralTheme: "une affection exprimée de manière personnalisée, en accordant de l'importance à la singularité de l'autre",
    spontaneousTheme: "manifester son affection par des attentions personnalisées, inspirées par les goûts, les intérêts ou les particularités de l'autre",
    resourceTheme: "capacité à donner à son affection une forme personnelle, même lorsqu'elle ne suit pas les codes habituels",
    forbidden: ["acceptation inconditionnelle ou absence totale de jugement", "détachement, froideur ou distance émotionnelle", "affection « amicale plutôt qu'amoureuse »", "excentricité, provocation ou goût de la rébellion", "originalité ou créativité garanties", "imprévisibilité ou instabilité affective", "difficulté à s'engager", "intellectualisation des sentiments", "opinions politiques, sociales ou humanitaires particulières", scopeNote("besoin de liberté, d'indépendance ou d'espace", "relève de « Besoin d'espace et de proximité »"), scopeNote("respect ou gestion de l'autonomie de l'autre", "relève de « Besoin d'espace et de proximité »"), "manière dont l'autre interprète ces attentions", scopeNote("manière de recevoir l'affection", "relève de « Besoins relationnels »")]
  }),
  venusSignRule("Pisces", {
    centralTheme: "une affection exprimée avec tendresse, par une attention aux émotions exprimées et par des gestes délicats ou symboliques",
    spontaneousTheme: "manifester son affection par des attentions sensibles ou évocatrices, particulièrement dans les moments émotionnellement significatifs",
    resourceTheme: "capacité à donner à son affection une expression tendre, nuancée et symbolique",
    forbidden: ["capacité à deviner ce que l'autre ressent", "empathie parfaite ou compréhension émotionnelle garantie", "hypersensibilité ou intuition particulière", "sacrifice de soi ou dévouement excessif", "idéalisation, illusion ou naïveté", "romantisme irréaliste", "amour inconditionnel ou compassion universelle", "manque de limites ou confusion", "fuite ou évitement", "dépendance affective", "posture de sauveur ou de victime", "absence de gestes concrets", "talent artistique, spiritualité ou médiumnité", scopeNote("besoin de fusion ou de proximité", "relève de « Besoin d'espace et de proximité »"), scopeNote("besoin d'être compris ou soutenu", "relève de « Besoins relationnels »"), "manière dont l'autre interprète les gestes symboliques", scopeNote("manière de recevoir l'affection", "relève de « Besoins relationnels »")]
  })
];

const MOON_VENUS_RULES = [
  affectionAspectRule("Moon", "Venus", "conjunction", {
    centralTheme: "proximité entre la sensibilité affective, le soin et la manière de manifester son affection",
    spontaneousTheme: "manifester son affection par la tendresse, le soin et une attention portée aux émotions exprimées par l'autre",
    resourceTheme: "capacité à traduire son attention émotionnelle en marques d'affection visibles et concrètes",
    forbidden: [...AFFECTION_MOON_VENUS_FLUID_FORBIDDEN, scopeNote("manière de recevoir l'affection", "relève de « Besoins relationnels »"), "humeur changeante ou hypersensibilité"]
  }, AFFECTION_MOON_VENUS_FORBIDDEN),
  affectionAspectRule("Moon", "Venus", "trine", {
    centralTheme: "accord fluide entre la sensibilité affective et la manière de manifester son affection",
    spontaneousTheme: "exprimer sa tendresse de manière fluide dans les gestes et les attentions de la relation",
    resourceTheme: "capacité à maintenir une cohérence entre l'attention émotionnelle et les marques d'affection exprimées",
    forbidden: AFFECTION_MOON_VENUS_FLUID_FORBIDDEN
  }, AFFECTION_MOON_VENUS_FORBIDDEN),
  affectionAspectRule("Moon", "Venus", "sextile", {
    centralTheme: "possibilité de mobiliser sa sensibilité affective pour manifester son affection lorsque le contexte s'y prête",
    spontaneousTheme: "saisir les moments propices pour manifester sa tendresse par une attention liée à la situation",
    resourceTheme: "capacité à adapter la forme de ses marques d'affection au contexte du moment",
    forbidden: AFFECTION_MOON_VENUS_FLUID_FORBIDDEN
  }, AFFECTION_MOON_VENUS_FORBIDDEN),
  affectionAspectRule("Moon", "Venus", "square", {
    centralTheme: "tension entre la sensibilité émotionnelle, le soin et la manière de manifester son affection",
    spontaneousTheme: "le soin concret et la tendresse explicite occupent tous deux une place dans la manière de manifester son affection",
    resourceTheme: "capacité à réunir une attention concrète et une marque de tendresse explicite dans une même manifestation",
    attentionTheme: "le soin que la personne apporte peut parfois tenir lieu d'expression affective, sans qu'une marque de tendresse distincte soit exprimée au même moment",
    forbidden: ["absence d'affection ou de tendresse", "incapacité à aimer ou à prendre soin de l'autre", "difficulté générale à exprimer ses sentiments", "contradiction permanente ou ambivalence affective", "instabilité émotionnelle ou humeur changeante", "conflits relationnels garantis", "insatisfaction affective", "incompréhension garantie de la part de l'autre", "échec ou instabilité de la relation"]
  }, AFFECTION_MOON_VENUS_FORBIDDEN),
  affectionAspectRule("Moon", "Venus", "opposition", {
    centralTheme: "polarité entre la sensibilité émotionnelle, le soin et la manière de manifester son affection",
    spontaneousTheme: "manifester son affection par le soin et l'attention émotionnelle comme par des marques de tendresse explicites",
    resourceTheme: "capacité à mobiliser selon le moment le registre du soin ou celui de la tendresse",
    attentionTheme: "l'un des deux registres peut momentanément prendre davantage de place que l'autre, de sorte que le soin et la tendresse explicite ne sont pas toujours manifestés en même temps",
    forbidden: ["absence d'affection ou de tendresse", "incapacité à aimer ou à prendre soin de l'autre", "difficulté générale à exprimer ses sentiments", "contradiction permanente ou ambivalence affective", "alternance systématique ou comportement imprévisible", "instabilité émotionnelle ou humeur changeante", "conflits relationnels garantis", "insatisfaction affective", "projection de l'un des deux registres sur le partenaire", "incompréhension garantie de la part de l'autre", "échec ou instabilité de la relation"]
  }, AFFECTION_MOON_VENUS_FORBIDDEN)
];

const SUN_VENUS_RULES = [
  affectionAspectRule("Sun", "Venus", "conjunction", {
    centralTheme: "proximité entre l'expression personnelle, ce qui est valorisé et la manière de manifester son affection",
    spontaneousTheme: "manifester son affection en exprimant l'estime et l'importance accordées à l'autre",
    resourceTheme: "capacité à donner à ses marques d'affection une forme personnelle, explicite et assumée",
    forbidden: ["charme, beauté ou pouvoir de séduction", "popularité ou facilité à plaire", "talent artistique ou sens esthétique particulier", "narcissisme, vanité ou égocentrisme", scopeNote("besoin d'admiration, d'approbation ou de reconnaissance", "relève de « Besoins relationnels »"), "estime de soi élevée ou faible", "affection nécessairement démonstrative ou publique", "générosité permanente", "fidélité garantie ou engagement durable", "harmonie ou réussite de la relation", scopeNote("formulation, tact ou qualité de la parole", "relève de « Communication relationnelle »"), scopeNote("attirance, désir ou comportement sexuel", "relève de « Désir, initiative et manière d'agir »"), scopeNote("initiative de rencontre ou volonté de plaire", "relève de « Manière d'entrer en relation »"), "manière dont l'autre reçoit cette valorisation", scopeNote("manière de recevoir l'affection", "relève de « Besoins relationnels »"), scopeNote("compatibilité avec une autre personne", "relèverait d'une future synastrie")]
  })
];

const VENUS_JUPITER_RULES = [
  affectionAspectRule("Venus", "Jupiter", "conjunction", {
    centralTheme: "affection et générosité étroitement associées",
    spontaneousTheme: "manifester son affection avec générosité, en donnant volontiers de son temps et de son attention",
    resourceTheme: "capacité à associer ses marques d'affection à l'encouragement et au soutien des initiatives de l'autre"
  }, AFFECTION_VENUS_JUPITER_FORBIDDEN),
  affectionAspectRule("Venus", "Jupiter", "trine", {
    centralTheme: "circulation fluide entre l'affection, la générosité et l'encouragement",
    spontaneousTheme: "exprimer son affection par une présence généreuse et des encouragements dans le cours de la relation",
    resourceTheme: "capacité à associer de manière fluide marques d'affection et soutien chaleureux"
  }, AFFECTION_VENUS_JUPITER_FORBIDDEN),
  affectionAspectRule("Venus", "Jupiter", "sextile", {
    centralTheme: "générosité affective disponible, mobilisée lorsqu'une occasion se présente",
    spontaneousTheme: "saisir les occasions de faire plaisir à l'autre ou de l'encourager",
    resourceTheme: "capacité à mobiliser une présence chaleureuse ou un encouragement dans une situation concrète"
  }, AFFECTION_VENUS_JUPITER_FORBIDDEN),
  affectionAspectRule("Venus", "Jupiter", "square", {
    centralTheme: "tension entre l'élan affectif et l'ampleur donnée à son expression",
    spontaneousTheme: "manifester son affection avec élan et générosité",
    resourceTheme: "capacité à investir largement du temps et de l'attention dans ses marques d'affection",
    attentionTheme: "l'élan généreux peut parfois donner à une marque d'affection une ampleur plus importante que sa forme initiale"
  }, AFFECTION_VENUS_JUPITER_FORBIDDEN),
  affectionAspectRule("Venus", "Jupiter", "opposition", {
    centralTheme: "polarité entre une marque d'affection centrée sur le lien et un mouvement plus large de générosité ou d'encouragement",
    spontaneousTheme: "manifester son affection par des attentions personnelles comme par un soutien ou des encouragements plus larges",
    resourceTheme: "capacité à mobiliser selon le moment une expression affective ciblée ou plus ample",
    attentionTheme: "l'une de ces deux échelles d'expression peut momentanément prendre davantage de place que l'autre, de sorte que l'attention personnelle et l'élan généreux ne sont pas toujours associés"
  }, AFFECTION_VENUS_JUPITER_FORBIDDEN)
];

const VENUS_SATURN_RULES = [
  affectionAspectRule("Venus", "Saturn", "conjunction", {
    centralTheme: "affection, mesure et continuité étroitement associées",
    spontaneousTheme: "manifester son affection par des gestes suivis et par une implication concrète dans la relation",
    resourceTheme: "capacité à donner à l'expression de son affection une forme concrète qui s'inscrit dans la durée"
  }, AFFECTION_VENUS_SATURN_FORBIDDEN),
  affectionAspectRule("Venus", "Saturn", "trine", {
    centralTheme: "accord fluide entre l'affection, la constance et la mesure",
    spontaneousTheme: "exprimer son affection par des gestes réguliers, cohérents et suivis dans le temps",
    resourceTheme: "capacité à associer de manière fluide marques d'affection et continuité"
  }, AFFECTION_VENUS_SATURN_FORBIDDEN),
  affectionAspectRule("Venus", "Saturn", "sextile", {
    centralTheme: "capacité disponible pour donner une suite concrète à une marque d'affection",
    spontaneousTheme: "saisir les occasions d'inscrire une marque d'affection dans un acte concret ou un engagement précis",
    resourceTheme: "capacité à prolonger une marque d'affection par un acte concret lorsque la situation s'y prête"
  }, AFFECTION_VENUS_SATURN_FORBIDDEN),
  affectionAspectRule("Venus", "Saturn", "square", {
    centralTheme: "tension entre l'élan affectif et la volonté de lui donner une forme mesurée ou durable",
    spontaneousTheme: "manifester son affection par des gestes réfléchis, concrets et investis",
    resourceTheme: "capacité à transformer un élan affectif en une marque d'affection construite et suivie",
    attentionTheme: "l'expression de l'affection peut parfois être différée pendant que la personne cherche une forme qu'elle estime pouvoir réellement soutenir"
  }, AFFECTION_VENUS_SATURN_FORBIDDEN),
  affectionAspectRule("Venus", "Saturn", "opposition", {
    centralTheme: "polarité entre l'expression spontanée de l'affection et une expression plus réfléchie et suivie",
    spontaneousTheme: "manifester son affection par des gestes directs comme par des engagements concrets dans la relation",
    resourceTheme: "capacité à mobiliser selon le moment l'élan spontané ou l'engagement suivi",
    attentionTheme: "l'élan spontané et l'engagement suivi peuvent s'exprimer à des moments différents plutôt que dans un même geste"
  }, AFFECTION_VENUS_SATURN_FORBIDDEN)
];

export const RELATIONAL_AFFECTION_RULES = Object.freeze([
  ...VENUS_SIGN_RULES,
  ...MOON_VENUS_RULES,
  ...SUN_VENUS_RULES,
  ...VENUS_JUPITER_RULES,
  ...VENUS_SATURN_RULES
]);
