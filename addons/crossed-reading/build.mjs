// Independent local preview. Existing production modules are imported read-only;
// no server, store, writer, transport or customer lifecycle is started here.
import { calculateWesternNatalChart } from "../../src/astro/westernNatal.mjs";
import { ASTROLAB_MODEL_VERSION, EPHEMERIS_VERSION } from "../../src/astro/constants.mjs";
import { buildSocle } from "../../src/deliverables/socle.mjs";
import { buildDossierEvidence } from "../../src/deliverables/dossierEvidence.mjs";
import { INTERPRETATION_LIBRARY_VERSION, rulesForEvidence } from "../../src/deliverables/interpretationRules.mjs";

const INPUT_KEYS = new Set(["birth", "personLabel", "generatedAt"]);
const BIRTH_KEYS = new Set([
  "birthDate", "timePrecision", "timeValue", "timeStart", "timeEnd", "timeMarginMinutes",
  "latitude", "longitude", "timeZone", "placeName", "country", "coordinateSource", "coordinateConfidence"
]);
const ASTROLOGICAL_PROOFS = new Set(["NATAL_BODY_SIGN", "NATAL_BODY_HOUSE", "ANGLE_SIGN", "NATAL_ASPECT"]);
const UNAVAILABLE = Object.freeze([
  { id: "outer-natal-interpretation", title: "Planètes lentes natales", reason: "Cet aperçu natal porte sur les sept corps traditionnels. Uranus, Neptune et Pluton sont calculables dans un autre module existant, mais ne sont ni ajoutés ni interprétés ici." },
  { id: "jyotisha-natal", title: "Lecture sidérale / Jyotish", reason: "La couche tropicale ne fournit pas le résultat sidéral ; le complément autonome le calcule séparément." },
  { id: "jyotisha-nakshatras", title: "Nakshatras et padas", reason: "La couche tropicale ne fournit pas de nakshatra ni de pada ; ils exigent le calcul sidéral séparé." },
  { id: "jyotisha-dashas", title: "Dashas", reason: "La couche tropicale ne fournit pas de dashas ; le complément les calcule séparément depuis la Lune sidérale." },
  { id: "chinese-bazi", title: "BaZi / quatre piliers", reason: "La couche tropicale ne fournit pas de quatre piliers ; le complément les calcule séparément selon leurs frontières solaires." },
  { id: "western-progressions", title: "Progressions", reason: "Aucun calculateur de progressions n’est implémenté pour ce complément." },
  { id: "western-cycles", title: "Cycles et transits personnels", reason: "Le moteur de transits existant n’est pas appelé par cet aperçu natal ; aucune période n’est simulée." },
  { id: "jungian-archetypes", title: "Archétypes", reason: "Aucune règle d’attribution d’archétype n’est active pour ce complément." },
  { id: "transgenerational", title: "Lecture transgénérationnelle", reason: "Aucune méthode familiale n’est active ; aucune donnée parentale supplémentaire n’est collectée." }
]);

function fail(code, message) {
  const error = new TypeError(message);
  error.code = code;
  throw error;
}

function assertRecord(value, allowedKeys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    fail(code, "Un objet simple est requis.");
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowedKeys.has(key)) {
      fail(code, "Le complément accepte uniquement ses champs d’entrée déclarés ; aucun fait ou cadre externe ne peut être injecté.");
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value")) fail(code, "Les accesseurs ne sont pas des données d’entrée autorisées.");
  }
}

function birthInput(value) {
  assertRecord(value, BIRTH_KEYS, "UNSUPPORTED_BIRTH_INPUT");
  const input = {};
  for (const key of BIRTH_KEYS) {
    if (!Object.hasOwn(value, key)) continue;
    const item = value[key];
    if (item === null || item === undefined) {
      input[key] = item;
    } else if (["latitude", "longitude", "timeMarginMinutes"].includes(key)) {
      if (!["number", "string"].includes(typeof item) || !String(item).trim() || !Number.isFinite(Number(item))) {
        fail("INVALID_BIRTH_VALUE", "Les coordonnées et marges doivent être numériques.");
      }
      input[key] = Number(item);
    } else {
      if (typeof item !== "string") fail("INVALID_BIRTH_VALUE", "Les champs de naissance textuels doivent être des chaînes.");
      input[key] = item.trim();
    }
  }
  return input;
}

function previewDate(value) {
  if (value === undefined) return new Date().toISOString();
  if (typeof value !== "string" || !value.trim() || Number.isNaN(new Date(value).getTime())) {
    fail("INVALID_PREVIEW_DATE", "generatedAt doit être une date valide.");
  }
  return new Date(value).toISOString();
}

export function buildIndependentReading(input = {}) {
  assertRecord(input, INPUT_KEYS, "UNSUPPORTED_READING_INPUT");
  const natalInput = birthInput(input.birth);
  if (input.personLabel !== undefined && input.personLabel !== null
      && (typeof input.personLabel !== "string" || input.personLabel.length > 200)) {
    fail("INVALID_PERSON_LABEL", "Le libellé est une chaîne de 200 caractères au maximum.");
  }
  const personLabel = input.personLabel?.trim() || null;
  const generatedAt = previewDate(input.generatedAt);
  const calculation = calculateWesternNatalChart(natalInput, { calculatedAt: generatedAt });
  const result = calculation.result;
  // All evidence is constructed by the tropical engine in this function. No
  // caller-supplied result, zodiac, house system or rule collection is accepted.
  const evidence = buildDossierEvidence({ natalResult: result, natalRun: calculation.calculationRun, generatedAt });
  const entries = evidence.evidence.flatMap((proof) => {
    if (!ASTROLOGICAL_PROOFS.has(proof.type) || proof.certainty?.stableAcrossApplicableWindow !== true) return [];
    // Default scope excludes individual-relational rules, whose more limited
    // roles cannot be promoted to a general reading by this catalogue.
    return rulesForEvidence(proof).map((rule) => ({
      evidenceId: proof.evidenceId,
      ruleId: rule.ruleId,
      themes: [...(rule.themes ?? [])],
      frame: "western-tropical"
    }));
  });
  const birth = Object.fromEntries([...BIRTH_KEYS].filter((key) => Object.hasOwn(result.normalizedInput, key))
    .map((key) => [key, result.normalizedInput[key]]));
  // Provenance labels are declarations, not geocoding or address verification.
  birth.coordinateMetadata = { status: "declared", verified: false };
  return {
    schema: "lastro.independent_reading@0.1.0",
    status: "local_preview",
    personLabel,
    generatedAt,
    birth,
    tropical: {
      frame: {
        method: "western-natal",
        zodiac: "tropical",
        houseSystem: "WHOLE_SIGN",
        methodVersion: result.methodVersion,
        modelVersion: ASTROLAB_MODEL_VERSION,
        astronomyEngineVersion: result.parameters.astronomyEngineVersion,
        ephemerisVersion: EPHEMERIS_VERSION,
        aspectRuleVersion: result.structuralAstrology.aspects.ruleVersionId,
        interpretationLibraryVersion: INTERPRETATION_LIBRARY_VERSION,
        evidenceVersion: evidence.version,
        timeZone: result.time.timeZone,
        timezoneDatabaseVersion: result.parameters.timezoneDatabaseVersion,
        utc: result.time.utc,
        utcRange: { ...result.time.utcRange },
        coordinateSystem: result.normalizedInput.coordinateSystem
      },
      result,
      socle: buildSocle(result),
      evidence
    },
    symbolic: { status: "catalogue_only", entries },
    unavailable: UNAVAILABLE.map((item) => ({ ...item })),
    crossTraditionSynthesis: { status: "not_licensed" }
  };
}
