const RULE_NOT_ACTIVE = Object.freeze({
  id: null,
  status: "rule_version_not_active",
  documentaryStatus: "UNKNOWN",
  source: null
});

function bodyHouse(body, houses) {
  if (!Array.isArray(houses)) {
    return null;
  }
  return houses.find((house) => house.signIndex === body.signIndex) ?? null;
}

function calculatedFact(kind, dataUsed, value) {
  return {
    kind,
    layer: "calculated_fact",
    dataUsed,
    value
  };
}

function factorFromBody(body, houses) {
  const house = bodyHouse(body, houses);
  return {
    id: `factor.body.${body.body}`,
    type: "planet",
    label: body.body,
    importance: {
      level: "undetermined",
      reason: "importance non déterminée selon la méthode actuelle",
      rule: RULE_NOT_ACTIVE
    },
    calculatedFacts: [
      calculatedFact("ecliptic_position", ["astronomicalCalculation.bodies"], {
        longitude: body.longitude,
        longitudeRange: body.longitudeRange ?? null,
        sign: body.sign,
        signRange: body.signRange ?? null,
        degreeInSign: body.degreeInSign,
        latitude: body.latitude,
        marginWindow: body.marginWindow ?? null
      }),
      calculatedFact("sign_placement", ["structuralAstrology.signs"], {
        sign: body.sign,
        signRange: body.signRange ?? null,
        ruler: body.ruler
      }),
      ...(house
        ? [
            calculatedFact("whole_sign_house_placement", ["structuralAstrology.houses"], {
              houseNumber: house.houseNumber,
              houseSign: house.sign
            })
          ]
        : [])
    ],
    relations: [],
    interpretiveStatus: "not_interpreted_no_rule_version"
  };
}

function factorFromAngle(name, angle) {
  if (!angle) {
    return null;
  }
  return {
    id: `factor.angle.${name}`,
    type: "angle",
    label: name,
    importance: {
      level: "undetermined",
      reason: "importance non déterminée selon la méthode actuelle",
      rule: RULE_NOT_ACTIVE
    },
    calculatedFacts: [
      calculatedFact("angle_position", ["astronomicalCalculation.angles"], {
        longitude: angle.longitude,
        sign: angle.sign,
        degreeInSign: angle.degreeInSign,
        uncertaintyStatus: angle.uncertaintyStatus ?? null,
        uncertaintyWindow: angle.uncertaintyWindow ?? null
      })
    ],
    relations: [],
    interpretiveStatus: "not_interpreted_no_rule_version"
  };
}

function relation(factorA, relationType, factorB, dataUsed, value, status = "calculated_relation_no_interpretive_rule") {
  return {
    factorA,
    relation: relationType,
    factorB,
    dataUsed,
    value,
    detectionRule: {
      kind: "calculated_structure",
      status,
      ruleVersionId: null,
      source: null,
      confidence: "calculated"
    },
    interpretiveStatus: "not_interpreted_no_rule_version"
  };
}

function buildPlacementRelations(bodies, houses) {
  return bodies.flatMap((body) => {
    const house = bodyHouse(body, houses);
    return [
      relation(`factor.body.${body.body}`, "placed_in_sign", `sign.${body.sign ?? "unresolved"}`, ["structuralAstrology.signs"], {
        sign: body.sign,
        signRange: body.signRange ?? null
      }),
      ...(house
        ? [
            relation(`factor.body.${body.body}`, "placed_in_whole_sign_house", `house.${house.houseNumber}`, ["structuralAstrology.houses"], {
              houseNumber: house.houseNumber,
              houseSign: house.sign
            })
          ]
        : [])
    ];
  });
}

function buildAngleRelations(angles) {
  const relations = [];
  if (angles.ascendant) {
    relations.push(
      relation("factor.angle.ascendant", "placed_in_sign", `sign.${angles.ascendant.sign}`, ["astronomicalCalculation.angles"], {
        sign: angles.ascendant.sign,
        degreeInSign: angles.ascendant.degreeInSign
      })
    );
  }
  if (angles.midheaven) {
    relations.push(
      relation("factor.angle.midheaven", "placed_in_sign", `sign.${angles.midheaven.sign}`, ["astronomicalCalculation.angles"], {
        sign: angles.midheaven.sign,
        degreeInSign: angles.midheaven.degreeInSign
      })
    );
  }
  return relations;
}

function buildGeometricRelations(aspects) {
  return (aspects ?? []).map((aspect) =>
    relation(
      `factor.body.${aspect.bodyA}`,
      "geometric_angular_distance",
      `factor.body.${aspect.bodyB}`,
      ["structuralAstrology.aspectInfrastructure"],
      {
        angularDistance: aspect.angularDistance,
        nearestCandidate: aspect.candidates?.[0] ?? null,
        activeAspect: false
      },
      "relation géométrique détectée — règle d'interprétation non activée"
    )
  );
}

function uncertaintyItems(result) {
  const items = [
    {
      topic: "interpretation",
      status: "unavailable",
      reason: "No interpretive RuleVersion is active."
    },
    {
      topic: "importance",
      status: "undetermined",
      reason: "No validated methodological rule ranks dominant factors."
    }
  ];

  if (result.uncertainty?.indeterminable?.length) {
    items.push({
      topic: "time_dependent_outputs",
      status: "indeterminate",
      reason: "Some outputs depend on unavailable or uncertain birth time.",
      affectedOutputs: result.uncertainty.indeterminable
    });
  }

  if (result.uncertainty?.timeEvidence?.precision === "approximate") {
    const marginMinutes = result.uncertainty?.margin?.marginMinutes ?? result.uncertainty?.timeEvidence?.marginMinutes ?? null;
    const source = result.uncertainty?.margin?.marginSource ?? result.uncertainty?.timeEvidence?.marginSource ?? null;
    const unstable = result.uncertainty?.margin?.bodySignsNotStableWithinMargin ?? [];
    const marginLabel =
      marginMinutes === null
        ? "an undeclared margin"
        : `a declared ±${marginMinutes} min margin (${source === "default" ? "Lastro default" : "supplied by the client"})`;
    items.push({
      topic: "approximate_birth_time",
      status: "sensitive",
      reason: `Angles, houses and sect were calculated from a reference time inside ${marginLabel}.${
        result.uncertainty?.margin?.ascendantSignStableWithinMargin === false
          ? " The Ascendant changes sign inside that margin: it is not decidable."
          : ""
      }${unstable.length > 0 ? ` Body signs not stable inside the margin: ${unstable.join(", ")}.` : ""}`,
      affectedOutputs: result.uncertainty?.indeterminable ?? []
    });
  }

  const intervalAnalysis = result.uncertainty?.intervalAnalysis;
  if (intervalAnalysis) {
    const summary = intervalAnalysis.summary;
    const indeterminateCount = (summary.indeterminateTargets ?? []).length;
    const reason =
      indeterminateCount > 0
        ? `Sur l'intervalle fourni, ${summary.stableTargets.length} cible(s) restent dans le même signe, ${summary.sensitiveTargets.length} cible(s) franchissent une frontière de signe et ${indeterminateCount} cible(s) ne peuvent pas être classées (comportement non monotone possible en haute latitude). Les maisons Whole Sign changent à chaque franchissement de l'Ascendant.`
        : `Sur l'intervalle fourni, ${summary.stableTargets.length} cible(s) restent dans le même signe et ${summary.sensitiveTargets.length} cible(s) franchissent une frontière de signe. Les maisons Whole Sign changent à chaque franchissement de l'Ascendant.`;
    items.push({
      topic: "interval_time_output_stability",
      status: summary.sensitiveTargets.length > 0 ? "sensitive" : indeterminateCount > 0 ? "indeterminate" : "stable",
      reason,
      affectedOutputs: summary.sensitiveTargets,
      crossingInstantsStoredIn: "uncertainty.intervalAnalysis"
    });
  }

  return items;
}

export function analyzeWesternNatalPrototype(result) {
  const bodies = result.astronomicalCalculation.bodies;
  const houses = result.structuralAstrology.houses;
  const angles = result.astronomicalCalculation.angles;
  const factors = [
    ...bodies.map((body) => factorFromBody(body, houses)),
    factorFromAngle("ascendant", angles.ascendant),
    factorFromAngle("midheaven", angles.midheaven)
  ].filter(Boolean);
  const relations = [
    ...buildPlacementRelations(bodies, houses),
    ...buildAngleRelations(angles),
    ...buildGeometricRelations(result.structuralAstrology.aspectInfrastructure)
  ];

  return {
    schema: "astrolab.western_natal.analysis_prototype",
    schemaVersion: "0.1.0",
    methodId: result.methodId,
    methodVersion: result.methodVersion,
    status: "analysis_prototype_no_interpretive_rule_version",
    layers: {
      factsCalculated: true,
      importantFactors: "undetermined_without_validated_rule",
      factorRelations: "calculated_structural_relations_only",
      documentedInterpretation: "not_available_no_rule_version",
      synthesis: "limited_to_established_calculated_facts"
    },
    overview: {
      title: "Les éléments importants du thème",
      summary: "Les facteurs calculables sont structurés, mais leur importance astrologique reste non déterminée selon la méthode actuelle.",
      established: [
        "Positions astronomiques structurées disponibles.",
        ...(angles.ascendant ? ["Ascendant, MC et maisons Whole Sign disponibles."] : ["Ascendant, MC et maisons non calculés pour cette précision d'heure."]),
        "Relations géométriques disponibles sans règle d'interprétation activée."
      ]
    },
    factors,
    relations,
    uncertainties: uncertaintyItems(result),
    synthesis: {
      status: "limited",
      text: "Synthèse limitée aux faits calculés et aux relations structurelles. Aucune signification astrologique définitive n'est produite sans RuleVersion documentée."
    },
    guardrails: {
      separatesFactRuleInterpretationSynthesis: true,
      sourceCountingIsTruthScoring: false,
      aiNarrativeGenerated: false,
      ruleVersionsCreated: false
    }
  };
}
