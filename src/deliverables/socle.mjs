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

// Aspects retenus par la convention Lastro. Ce ne sont plus des « candidats
// géométriques » : l'orbe appliqué est écrit, et un aspect qui ne tient pas sur
// toute la marge d'incertitude n'est pas retenu.
function aspectName(type, details) {
  return details?.aspects?.[type] ?? type ?? "";
}

function orbTableLabel(convention, details) {
  const withLuminaries = details?.values?.withLuminaries ?? "avec le Soleil ou la Lune";
  return (convention?.orbTable ?? [])
    .map((entry) => `${aspectName(entry.type, details)} ${entry.orbDegrees}° (${entry.orbDegreesWithLuminary}° ${withLuminaries})`)
    .join(" · ");
}

function retainedAspectFacts(aspectConvention, details) {
  const items = Array.isArray(aspectConvention?.items) ? aspectConvention.items : [];
  return items
    .filter((item) => item.retained)
    .map((item) => ({
      id: item.id,
      bodyA: item.bodyA,
      bodyB: item.bodyB,
      type: item.type,
      aspectLabel: aspectName(item.type, details),
      angularDistance: item.angularDistance,
      exactness: item.exactness,
      orbUsed: item.orbUsed,
      orbWithLuminary: item.orbWithLuminary,
      marginStable: item.marginStability ? item.marginStability.stable : null
    }));
}

function discardedByMargin(aspectConvention) {
  const items = Array.isArray(aspectConvention?.items) ? aspectConvention.items : [];
  return items.filter((item) => item.discardedReason === "not_stable_within_declared_margin");
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

  const aspectList = retainedAspectFacts(structural.aspects, details);
  if (structural.aspects) {
    facts.push({
      id: "method.aspects",
      label: L.aspects ?? "Aspects retenus (convention Lastro)",
      value: `${structural.aspects.ruleVersionId} — ${orbTableLabel(structural.aspects, details)}`
    });
    facts.push({
      id: "method.aspectGeometry",
      label: L.aspectGeometry ?? "Géométrie angulaire examinée",
      value: fillTemplate(
        V.aspectsSummary ?? "{examined} couples examinés · {retained} aspects retenus · {marginDiscarded} écartés par la marge",
        {
          examined: structural.aspects.summary?.examinedPairs ?? 0,
          retained: structural.aspects.summary?.retained ?? 0,
          marginDiscarded: structural.aspects.summary?.discardedNotStableWithinMargin ?? 0
        }
      )
    });
  }
  for (const aspect of aspectList) {
    facts.push({
      id: aspect.id,
      label: `${localizedBodyName(aspect.bodyA, details)} – ${localizedBodyName(aspect.bodyB, details)}`,
      value: `${aspect.aspectLabel}, ${L.orb ?? "orbe"} ${aspect.orbUsed}°, ${L.gap ?? "écart"} ${aspect.exactness.toFixed(2)}°`
    });
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
    const marginDiscarded = discardedByMargin(structural.aspects);
    if (marginDiscarded.length > 0) {
      uncertaintyNotes.push(
        fillTemplate(U.aspectNotStableWithinMargin ?? "Aspects écartés car ils ne tiennent pas sur toute la marge d'incertitude : {list}.", {
          list: marginDiscarded
            .map(
              (item) =>
                `${localizedBodyName(item.bodyA, details)} – ${localizedBodyName(item.bodyB, details)} (${aspectName(item.candidateType, details)})`
            )
            .join(", ")
        })
      );
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
    retainedAspects: aspectList,
    aspectConvention: structural.aspects
      ? {
          ruleVersionId: structural.aspects.ruleVersionId,
          nature: structural.aspects.nature,
          orbTable: structural.aspects.orbTable,
          summary: structural.aspects.summary,
          patterns: aspectList.map((aspect) => `${aspect.bodyA}-${aspect.bodyB}:${aspect.type}`),
          discardedNotStableWithinMargin: discardedByMargin(structural.aspects).map(
            (item) => `${item.bodyA}-${item.bodyB}:${item.candidateType}`
          )
        }
      : null,
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
    methodNote:
      "Positions astronomiques calculées localement, sans accès Internet, avec astronomy-engine 2.1.19. Zodiaque tropical, maisons Whole Sign (maisons entières). Aucune interprétation n'est produite par le moteur."
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
  // Les avertissements bruts du moteur restent dans les données pour l'audit
  // interne : ils ne sont plus recopiés ici. Un document vendu n'expose ni
  // statut interne, ni langage de préproduction, ni texte anglais non traduit.
  lines.push("", t.annexMethod ?? t.methodNote);
  return lines.join("\n");
}
