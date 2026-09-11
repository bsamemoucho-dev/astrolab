// Builds the verified "socle" from a Western Natal structured result.
// This layer never interprets: it only formats calculated facts (French display,
// provenance kept) for the client dossier. No orb, no rule, no AI wording here.

import { formatDegreeInSign, frBody, frSign } from "./french.mjs";
import { localeDetails, docStrings } from "./i18n.mjs";

function houseNumberForBody(body, houses) {
  if (!Array.isArray(houses) || houses.length === 0 || body.signIndex === null || body.signIndex === undefined) {
    return null;
  }
  const house = houses.find((entry) => entry.signIndex === body.signIndex);
  return house ? house.houseNumber : null;
}

function localizedBodyName(body, details) {
  return details?.planets?.[body] ?? frBody(body);
}

function localizedSignName(sign, details) {
  return details?.signs?.[sign] ?? frSign(sign).fr;
}

// Sans heure de naissance, ni le degré ni parfois le signe ne sont calculables :
// on n'affiche alors aucune valeur inventée (« null 0°00′ » ou « 0°00′ »), et on
// donne la plage réellement balayée quand le signe change dans la journée.
function placementLabel(body, details) {
  const degreeKnown = Number.isFinite(body.degreeInSign);
  const degree = degreeKnown ? ` ${formatDegreeInSign(body.degreeInSign)}` : "";
  if (body.sign) {
    return { signFr: localizedSignName(body.sign, details), label: `${localizedSignName(body.sign, details)}${degree}` };
  }
  const range = body.signRange ?? null;
  if (range?.start && range?.end) {
    const from = localizedSignName(range.start, details);
    const to = localizedSignName(range.end, details);
    return { signFr: `${from} → ${to}`, label: `${from} → ${to}` };
  }
  const unknown = details?.values?.unknown ?? "inconnu";
  return { signFr: unknown, label: unknown };
}

function bodyFact(body, houses, details) {
  const house = houseNumberForBody(body, houses);
  const placement = placementLabel(body, details);
  const signName = placement.signFr;
  const retrograde = body.apparentMotion?.retrograde ?? false;
  const houseWord = details?.labels?.house ?? "maison";
  const wholeSign = details?.values?.wholeSignShort ?? "Whole Sign";
  return {
    id: `body.${body.body}`,
    label: localizedBodyName(body.body, details),
    sign: body.sign,
    signFr: signName,
    degreeInSign: body.degreeInSign,
    degreeLabel: placement.label,
    longitude: body.longitude,
    house: house,
    houseLabel: house ? `${houseWord} ${house} (${wholeSign})` : null,
    retrograde: retrograde,
    temporalStatus: body.temporalStatus ?? null
  };
}

function angleFact(name, angle, details) {
  if (!angle) {
    return null;
  }
  const signName = localizedSignName(angle.sign, details);
  return {
    id: `angle.${name}`,
    label: name === "ascendant" ? details?.labels?.asc ?? "Ascendant" : name === "midheaven" ? details?.labels?.mc ?? "Milieu du Ciel" : name,
    sign: angle.sign,
    signFr: signName,
    degreeInSign: angle.degreeInSign,
    degreeLabel: `${signName} ${formatDegreeInSign(angle.degreeInSign)}`,
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

export function buildSocle(payload, strings = null) {
  const details = strings ?? docStrings("fr");
  const L = details.labels ?? {};
  const V = details.values ?? {};
  const normalizedInput = payload.normalizedInput ?? {};
  const astronomical = payload.astronomicalCalculation ?? {};
  const structural = payload.structuralAstrology ?? {};
  const uncertainty = payload.uncertainty ?? {};
  const bodies = Array.isArray(astronomical.bodies) ? astronomical.bodies : [];
  const houses = Array.isArray(structural.houses) ? structural.houses : structural.houses?.houses ?? [];
  const angles = astronomical.angles ?? {};

  const bodyFacts = bodies.map((body) => bodyFact(body, houses, details));
  const ascendant = angleFact("ascendant", angles.ascendant, details);
  const midheaven = angleFact("midheaven", angles.midheaven, details);
  const sect = structural.sect?.chartSect === "unknown" ? null : structural.sect?.chartSect ?? null;

  const placeName = normalizedInput.placeName ?? null;
  const country = normalizedInput.country ?? null;
  const placeLabel = placeName && country && !placeName.toLowerCase().includes(country.toLowerCase())
    ? `${placeName}, ${country}`
    : placeName ?? "—";
  const facts = [
    { id: "identity.date", label: L.date ?? "Date de naissance", value: normalizedInput.birthDate },
    ...(normalizedInput.timePrecision === "exact" || normalizedInput.timePrecision === "approximate"
      ? [{ id: "identity.time", label: L.time ?? "Heure de naissance", value: `${normalizedInput.timeValue} (${normalizedInput.timePrecision === "exact" ? V.exact ?? "exacte" : V.approximate ?? "approximative"})` }]
      : normalizedInput.timePrecision === "interval"
        ? [{ id: "identity.time", label: L.timeInterval ?? "Heure de naissance (intervalle)", value: `${normalizedInput.timeStart} – ${normalizedInput.timeEnd}` }]
        : [{ id: "identity.time", label: L.time ?? "Heure de naissance", value: V.unknown ?? "inconnue" }]),
    { id: "identity.place", label: L.place ?? "Lieu de naissance", value: placeLabel },
    { id: "identity.timezone", label: L.tz ?? "Fuseau horaire", value: normalizedInput.timeZone },
    { id: "identity.coordinates", label: L.coords ?? "Coordonnées", value: `${normalizedInput.latitude}, ${normalizedInput.longitude}` },
    { id: "method.zodiac", label: L.zodiac ?? "Zodiaque", value: V.tropical ?? "tropical" },
    { id: "method.houses", label: L.houses ?? "Système de maisons", value: V.wholeSign ?? "Whole Sign (maisons entières)" }
  ];

  for (const body of bodyFacts) {
    const housePart = body.houseLabel ? ` · ${body.houseLabel}` : "";
    const retroPart = body.retrograde ? ` · ${L.retro ?? "rétrograde"}` : "";
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
      label: L.sect ?? "Secte du thème",
      value: sect === "diurnal" ? V.diurnal ?? "diurne" : V.nocturnal ?? "nocturne"
    });
  }

  const aspectList = aspectFacts(structural.aspectInfrastructure);
  for (const aspect of aspectList) {
    if (aspect.closestCandidate) {
      facts.push({
        id: `aspect.${aspect.bodyA}.${aspect.bodyB}`,
        label: `${localizedBodyName(aspect.bodyA, details)} – ${localizedBodyName(aspect.bodyB, details)}`,
        value: `${L.aspect ?? "distance angulaire"} ${aspect.angularDistance.toFixed(1)}°, ${L.closest ?? "plus proche candidat"} : ${aspect.closestCandidate} (${L.gap ?? "écart"} ${aspect.exactness.toFixed(2)}°) — ${L.noOrb ?? "aucune règle d'orbe active"}`
      });
    }
  }

  if (uncertainty.intervalAnalysis) {
    const summary = uncertainty.intervalAnalysis.summary;
    facts.push({
      id: "uncertainty.interval",
      label: L.interval ?? "Analyse d'intervalle",
      value: `${summary.stableTargets.length} ${L.stable ?? "stable(s)"}, ${summary.sensitiveTargets.length} ${L.sensitive ?? "sensible(s)"}, ${summary.indeterminateTargets.length} ${L.indeterminate ?? "indéterminée(s)"}`
    });
  }

  const U = details.uncertainty ?? {};
  const uncertaintyNotes = [];
  if (normalizedInput.timePrecision === "unknown") {
    uncertaintyNotes.push(U.unknown ?? "Heure de naissance inconnue : l'Ascendant, le Milieu du Ciel, les maisons et la secte n'ont pas été calculés.");
  } else if (normalizedInput.timePrecision === "approximate") {
    uncertaintyNotes.push(U.approximate ?? "Heure de naissance approximative : l'Ascendant et les maisons dépendent d'une marge d'incertitude inconnue.");
  } else if (normalizedInput.timePrecision === "interval") {
    uncertaintyNotes.push(U.interval ?? "Heure de naissance fournie en intervalle : aucune heure exacte n'a été inventée.");
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
