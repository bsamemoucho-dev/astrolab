// Builds the verified "socle" from a Western Natal structured result.
// This layer never interprets: it only formats calculated facts (French display,
// provenance kept) for the client dossier. No orb, no rule, no AI wording here.

import { formatDegreeInSign, frBody, frSign } from "./french.mjs";
import { localeDetails, docStrings } from "./i18n.mjs";

// Petits gabarits de phrase (« sur la marge ±{n} min ») : une seule mécanique,
// aucune concaténation de morceaux traduits à la main.
function fillTemplate(template, values) {
  return String(template ?? "").replace(/\{(\w+)\}/g, (match, key) =>
    values[key] === undefined || values[key] === null ? match : String(values[key])
  );
}

function marginLabel(margin, details) {
  const V = details?.values ?? {};
  const template = margin?.marginSource === "default" ? V.marginDefault : V.marginSupplied;
  const fallback = margin?.marginSource === "default" ? "±{n} min (valeur par défaut Lastro)" : "±{n} min (précisée par le client)";
  return fillTemplate(template ?? fallback, { n: margin?.marginMinutes ?? "?" });
}

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
//
// Avec une heure approximative, le signe peut aussi changer DANS la marge : il
// n'est alors pas décidable et l'annexe écrit la frontière au lieu du signe.
function placementLabel(body, details, options = {}) {
  const degreeKnown = Number.isFinite(body.degreeInSign);
  const degree = degreeKnown ? ` ${formatDegreeInSign(body.degreeInSign)}` : "";
  const marginWindow = options.marginWindow ?? null;
  if (marginWindow && !marginWindow.signStable) {
    const from = localizedSignName(marginWindow.signAtWindowStart, details);
    const to = localizedSignName(marginWindow.signAtWindowEnd, details);
    return { signFr: `${from} → ${to}`, label: `${from} → ${to}`, signStable: false };
  }
  if (body.sign) {
    return { signFr: localizedSignName(body.sign, details), label: `${localizedSignName(body.sign, details)}${degree}`, signStable: true };
  }
  const range = body.signRange ?? null;
  if (range?.start && range?.end) {
    const from = localizedSignName(range.start, details);
    const to = localizedSignName(range.end, details);
    return { signFr: `${from} → ${to}`, label: `${from} → ${to}`, signStable: false };
  }
  const unknown = details?.values?.unknown ?? "inconnu";
  return { signFr: unknown, label: unknown, signStable: null };
}

function bodyFact(body, houses, details, options = {}) {
  const marginWindow = body.marginWindow ?? null;
  const placement = placementLabel(body, details, { marginWindow });
  const signName = placement.signFr;
  const retrograde = body.apparentMotion?.retrograde ?? false;
  const houseWord = details?.labels?.house ?? "maison";
  const wholeSign = details?.values?.wholeSignShort ?? "Whole Sign";
  const house = options.housesDecidable === false ? null : houseNumberForBody(body, houses);
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
    temporalStatus: body.temporalStatus ?? null,
    signStableWithinMargin: marginWindow ? marginWindow.signStable : null,
    marginWindow
  };
}

function angleFact(name, angle, details, window = null, marginMinutes = null) {
  if (!angle) {
    return null;
  }
  const V = details?.values ?? {};
  const signName = localizedSignName(angle.sign, details);
  const base = {
    id: `angle.${name}`,
    label: name === "ascendant" ? details?.labels?.asc ?? "Ascendant" : name === "midheaven" ? details?.labels?.mc ?? "Milieu du Ciel" : name,
    sign: angle.sign,
    signFr: signName,
    degreeInSign: angle.degreeInSign,
    degreeLabel: `${signName} ${formatDegreeInSign(angle.degreeInSign)}`,
    longitude: angle.longitude,
    uncertaintyStatus: angle.uncertaintyStatus ?? null,
    signStableWithinMargin: window ? window.signStable : null,
    signsInWindow: window?.signsInWindow ?? null,
    marginMinutes: window ? marginMinutes : null
  };
  if (!window) {
    return base;
  }
  const from = `${formatDegreeInSign(window.degreeAtWindowStart)} ${localizedSignName(window.signAtWindowStart, details)}`;
  const to = `${formatDegreeInSign(window.degreeAtWindowEnd)} ${localizedSignName(window.signAtWindowEnd, details)}`;
  const range = `${from} → ${to}`;
  return {
    ...base,
    marginRangeLabel: range,
    degreeLabel: window.signStable
      ? `${base.degreeLabel} · ${V.signStable ?? "signe stable sur toute la marge"} (${range})`
      : `${V.signNotDecidable ?? "signe non décidable dans la marge"} (${range})`,
    decidableWithinMargin: window.signStable
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
  const angleWindow = angles.uncertaintyWindow ?? null;
  const margin = uncertainty.margin ?? null;
  const houseUncertainty = structural.houseUncertainty ?? null;
  const housesDecidable = houseUncertainty ? houseUncertainty.housesDecidableWithinMargin !== false : true;

  const bodyFacts = bodies.map((body) => bodyFact(body, houses, details, { housesDecidable }));
  const ascendant = angleFact("ascendant", angles.ascendant, details, angleWindow?.ascendant ?? null, angleWindow?.marginMinutes ?? null);
  const midheaven = angleFact("midheaven", angles.midheaven, details, angleWindow?.midheaven ?? null, angleWindow?.marginMinutes ?? null);
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
    { id: "method.houses", label: L.houses ?? "Système de maisons", value: V.wholeSign ?? "Whole Sign (maisons entières)" },
    // La marge retenue est écrite noir sur blanc : c'est elle qui borne tout ce
    // qui est calculé à partir de l'heure, et elle doit rester vérifiable.
    ...(margin
      ? [{ id: "uncertainty.margin", label: L.margin ?? "Marge d'incertitude retenue", value: marginLabel(margin, details) }]
      : [])
  ];

  for (const body of bodyFacts) {
    const housePart = body.houseLabel ? ` · ${body.houseLabel}` : "";
    const retroPart = body.retrograde ? ` · ${L.retro ?? "rétrograde"}` : "";
    const unstablePart = body.signStableWithinMargin === false ? ` · ${V.signNotDecidable ?? "signe non décidable dans la marge"}` : "";
    facts.push({ id: body.id, label: body.label, value: `${body.degreeLabel}${housePart}${retroPart}${unstablePart}` });
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
    // Heure approximative : la marge est connue, et tout ce qui dépend de
    // l'heure est présenté comme borné par elle — jamais comme exact.
    uncertaintyNotes.push(
      fillTemplate(U.approximate ?? "Heure de naissance approximative : l'Ascendant, le Milieu du Ciel, les maisons et la secte ont été calculés sur la marge déclarée {margin}.", {
        margin: marginLabel(margin, details)
      })
    );
    if (margin?.ascendantSignStableWithinMargin) {
      uncertaintyNotes.push(
        fillTemplate(U.approximateStable ?? "Sur toute cette marge, le signe de l'Ascendant reste {sign} : il est donné comme probable, jamais comme exact.", {
          sign: localizedSignName(angleWindow?.ascendant?.signAtWindowStart ?? angles.ascendant?.sign, details)
        })
      );
    } else if (angleWindow?.ascendant) {
      uncertaintyNotes.push(
        fillTemplate(U.approximateUnstable ?? "Le signe de l'Ascendant change dans cette marge ({from} → {to}) : il n'est pas décidable, et les maisons non plus.", {
          from: localizedSignName(angleWindow.ascendant.signAtWindowStart, details),
          to: localizedSignName(angleWindow.ascendant.signAtWindowEnd, details)
        })
      );
    }
    const unstableBodies = margin?.bodySignsNotStableWithinMargin ?? [];
    if (unstableBodies.length > 0) {
      uncertaintyNotes.push(
        fillTemplate(U.approximateBodySigns ?? "Ces corps changent aussi de signe dans la marge : {bodies}.", {
          bodies: unstableBodies.map((body) => localizedBodyName(body, details)).join(", ")
        })
      );
    }
    if (margin?.sectStableWithinMargin === false) {
      uncertaintyNotes.push(U.approximateSect ?? "La secte (diurne ou nocturne) bascule dans cette marge : elle n'est pas affichée.");
    }
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
    housesAvailable: houses.length > 0 && housesDecidable,
    housesDecidableWithinMargin: housesDecidable,
    // Ce que le rédacteur et le détecteur de langage doivent respecter : plafond
    // de langage quand l'heure est approximative. Aucun angle, aucune maison,
    // aucun signe instable ne doit être affirmé.
    timeLanguageCap: margin
      ? {
          timePrecision: normalizedInput.timePrecision,
          marginMinutes: margin.marginMinutes,
          marginSource: margin.marginSource,
          ascendantSignStableWithinMargin: Boolean(margin.ascendantSignStableWithinMargin),
          ascendantSignsInWindow: angleWindow?.ascendant?.signsInWindow ?? null,
          midheavenSignStableWithinMargin: Boolean(margin.midheavenSignStableWithinMargin),
          midheavenSignsInWindow: angleWindow?.midheaven?.signsInWindow ?? null,
          housesDecidableWithinMargin: housesDecidable,
          sectStableWithinMargin: margin.sectStableWithinMargin !== false,
          bodySignsNotStableWithinMargin: margin.bodySignsNotStableWithinMargin ?? []
        }
      : null,
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
