// Builds the verified "socle" from a Western Natal structured result.
// This layer never interprets: it only formats calculated facts (French display,
// provenance kept) for the client dossier. No orb, no rule, no AI wording here.

import { formatDegreeInSign, frBody, frSign } from "./french.mjs";

function houseNumberForBody(body, houses) {
  if (!Array.isArray(houses) || houses.length === 0 || body.signIndex === null || body.signIndex === undefined) {
    return null;
  }
  const house = houses.find((entry) => entry.signIndex === body.signIndex);
  return house ? house.houseNumber : null;
}

function bodyFact(body, houses) {
  const house = houseNumberForBody(body, houses);
  const sign = frSign(body.sign);
  const retrograde = body.apparentMotion?.retrograde ?? false;
  return {
    id: `body.${body.body}`,
    label: frBody(body.body),
    sign: body.sign,
    signFr: sign.fr,
    degreeInSign: body.degreeInSign,
    degreeLabel: `${sign.fr} ${formatDegreeInSign(body.degreeInSign)}`,
    longitude: body.longitude,
    house: house,
    houseLabel: house ? `maison ${house} (Whole Sign)` : null,
    retrograde: retrograde,
    temporalStatus: body.temporalStatus ?? null
  };
}

function angleFact(name, angle) {
  if (!angle) {
    return null;
  }
  const sign = frSign(angle.sign);
  return {
    id: `angle.${name}`,
    label: name === "ascendant" ? "Ascendant" : name === "midheaven" ? "Milieu du Ciel" : name,
    sign: angle.sign,
    signFr: sign.fr,
    degreeInSign: angle.degreeInSign,
    degreeLabel: `${sign.fr} ${formatDegreeInSign(angle.degreeInSign)}`,
    longitude: angle.longitude,
    uncertaintyStatus: angle.uncertaintyStatus ?? null
  };
}

function aspectFacts(aspectInfrastructure) {
  if (!Array.isArray(aspectInfrastructure)) {
    return [];
  }
  return aspectInfrastructure
    .map((pair) => {
      const best = pair.candidates?.[0] ?? null;
      return {
        bodyA: pair.bodyA,
        bodyB: pair.bodyB,
        angularDistance: pair.angularDistance,
        closestCandidate: best ? best.type : null,
        exactness: best ? best.exactness : null
      };
    })
    .sort((first, second) => (first.exactness ?? 999) - (second.exactness ?? 999))
    .slice(0, 12);
}

export function buildSocle(payload) {
  const normalizedInput = payload.normalizedInput ?? {};
  const astronomical = payload.astronomicalCalculation ?? {};
  const structural = payload.structuralAstrology ?? {};
  const uncertainty = payload.uncertainty ?? {};
  const bodies = Array.isArray(astronomical.bodies) ? astronomical.bodies : [];
  const houses = Array.isArray(structural.houses) ? structural.houses : structural.houses?.houses ?? [];
  const angles = astronomical.angles ?? {};

  const bodyFacts = bodies.map((body) => bodyFact(body, houses));
  const ascendant = angleFact("ascendant", angles.ascendant);
  const midheaven = angleFact("midheaven", angles.midheaven);
  const sect = structural.sect?.chartSect === "unknown" ? null : structural.sect?.chartSect ?? null;

  const placeName = normalizedInput.placeName ?? null;
  const country = normalizedInput.country ?? null;
  const placeLabel = placeName && country && !placeName.toLowerCase().includes(country.toLowerCase())
    ? `${placeName}, ${country}`
    : placeName ?? "—";
  const facts = [
    { id: "identity.date", label: "Date de naissance", value: normalizedInput.birthDate },
    ...(normalizedInput.timePrecision === "exact" || normalizedInput.timePrecision === "approximate"
      ? [{ id: "identity.time", label: "Heure de naissance", value: `${normalizedInput.timeValue} (${normalizedInput.timePrecision === "exact" ? "exacte" : "approximative"})` }]
      : normalizedInput.timePrecision === "interval"
        ? [{ id: "identity.time", label: "Heure de naissance (intervalle)", value: `${normalizedInput.timeStart} – ${normalizedInput.timeEnd}` }]
        : [{ id: "identity.time", label: "Heure de naissance", value: "inconnue" }]),
    { id: "identity.place", label: "Lieu de naissance", value: placeLabel },
    { id: "identity.timezone", label: "Fuseau horaire", value: normalizedInput.timeZone },
    { id: "identity.coordinates", label: "Coordonnées", value: `${normalizedInput.latitude}, ${normalizedInput.longitude}` },
    { id: "method.zodiac", label: "Zodiaque", value: "tropical" },
    { id: "method.houses", label: "Système de maisons", value: "Whole Sign (maisons entières)" }
  ];

  for (const body of bodyFacts) {
    const housePart = body.houseLabel ? ` · ${body.houseLabel}` : "";
    const retroPart = body.retrograde ? " · rétrograde" : "";
    facts.push({ id: body.id, label: body.label, value: `${body.degreeLabel}${housePart}${retroPart}` });
  }

  if (ascendant) {
    facts.push({ id: ascendant.id, label: ascendant.label, value: ascendant.degreeLabel });
  }
  if (midheaven) {
    facts.push({ id: midheaven.id, label: midheaven.label, value: midheaven.degreeLabel });
  }
  if (sect) {
    facts.push({
      id: "sect",
      label: "Secte du thème",
      value: sect === "diurnal" ? "diurne (Soleil au-dessus de l'horizon)" : "nocturne (Soleil sous l'horizon)"
    });
  }

  const aspectList = aspectFacts(structural.aspectInfrastructure);
  for (const aspect of aspectList) {
    if (aspect.closestCandidate) {
      facts.push({
        id: `aspect.${aspect.bodyA}.${aspect.bodyB}`,
        label: `${frBody(aspect.bodyA)} – ${frBody(aspect.bodyB)}`,
        value: `distance angulaire ${aspect.angularDistance.toFixed(1)}°, plus proche candidat : ${aspect.closestCandidate} (écart ${aspect.exactness.toFixed(2)}°) — aucune règle d'orbe active`
      });
    }
  }

  if (uncertainty.intervalAnalysis) {
    const summary = uncertainty.intervalAnalysis.summary;
    facts.push({
      id: "uncertainty.interval",
      label: "Analyse d'intervalle",
      value: `${summary.stableTargets.length} cible(s) stable(s), ${summary.sensitiveTargets.length} sensible(s), ${summary.indeterminateTargets.length} indéterminée(s)`
    });
  }

  const uncertaintyNotes = [];
  if (normalizedInput.timePrecision === "unknown") {
    uncertaintyNotes.push("Heure de naissance inconnue : l'Ascendant, le Milieu du Ciel, les maisons et la secte n'ont pas été calculés. Les positions planétaires du jour sont fournies en tendance.");
  } else if (normalizedInput.timePrecision === "approximate") {
    uncertaintyNotes.push("Heure de naissance approximative : l'Ascendant et les maisons ont été calculés sur l'heure de référence mais restent sensibles à la marge d'incertitude (inconnue).");
  } else if (normalizedInput.timePrecision === "interval") {
    uncertaintyNotes.push("Heure de naissance fournie en intervalle : aucune heure exacte n'a été inventée ; les franchissements de signes à l'intérieur de l'intervalle sont détaillés dans l'analyse de stabilité.");
  }

  return {
    schema: "astrolab.western_natal.socle_livrable",
    methodId: payload.methodId ?? "western-natal",
    methodVersion: payload.methodVersion ?? null,
    status: payload.status ?? "calculated_development_not_production",
    person: {
      firstName: null,
      intention: null
    },
    birth: {
      date: normalizedInput.birthDate,
      timePrecision: normalizedInput.timePrecision,
      timeValue: normalizedInput.timeValue ?? null,
      timeStart: normalizedInput.timeStart ?? null,
      timeEnd: normalizedInput.timeEnd ?? null,
      placeName: normalizedInput.placeName ?? null,
      timeZone: normalizedInput.timeZone ?? null
    },
    anglesAvailable: Boolean(ascendant),
    bodies: bodyFacts,
    ascendant,
    midheaven,
    sect,
    housesAvailable: houses.length > 0,
    aspectGeometry: aspectList,
    facts,
    uncertaintyNotes,
    warnings: uncertainty.warnings ?? []
  };
}

export function renderSocleAnnex(socle, strings = null) {
  const t = strings ?? {
    annexTitle: "Annexe technique — socle de calcul vérifié",
    annexIntro:
      "Cette annexe contient les seules données calculées et vérifiées utilisées pour ce dossier. Aucune interprétation n'y figure.",
    person: "Personne",
    uncertaintyLimits: "Limites d'incertitude",
    engineWarnings: "Avertissements du moteur de calcul"
  };
  const lines = [`# ${t.annexTitle}`, "", t.annexIntro, ""];
  if (socle.person?.firstName) {
    lines.push(`${t.person} : ${socle.person.firstName}`, "");
  }
  for (const fact of socle.facts) {
    lines.push(`- **${fact.label}** : ${fact.value}`);
  }
  if (socle.uncertaintyNotes.length > 0) {
    lines.push("", `${t.uncertaintyLimits} :`, "");
    for (const note of socle.uncertaintyNotes) {
      lines.push(`- ${note}`);
    }
  }
  if (socle.warnings.length > 0) {
    lines.push("", `${t.engineWarnings} :`, "");
    for (const warning of socle.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  lines.push(
    "",
    `Méthode : ${socle.methodId} (${socle.methodVersion}) — statut ${socle.status}.`,
    "Les positions sont calculées par astronomy-engine@2.1.19 (validé contre les fixtures JPL Horizons du référentiel de test V1)."
  );
  return lines.join("\n");
}
