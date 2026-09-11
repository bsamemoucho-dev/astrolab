// Ce que le rédacteur reçoit VRAIMENT, vérifié sans réseau et sans coût.
//
// Les consignes de plafond de langage ne servent à rien si elles ne partent pas :
// on intercepte l'appel au rédacteur, on relit l'invite système envoyée, et on
// vérifie qu'elle interdit bien ce que les faits ne permettent pas d'affirmer.
//
// Deux cas réels ont motivé ces tests :
//   - heure approximative : le signe d'un angle peut changer dans la marge ;
//   - heure inconnue : le signe de la Lune balaie plusieurs signes sur la journée,
//     et le modèle en nommait un — jusqu'à huit sections sur onze amputées.

import assert from "node:assert/strict";
import test from "node:test";

import { calculateWesternNatalChart } from "../src/astro/westernNatal.mjs";
import { LANGUAGES, docStrings } from "../src/deliverables/i18n.mjs";
import { buildSocle } from "../src/deliverables/socle.mjs";
import { createPublicReading } from "../src/models/publicReadingService.mjs";

const LIEU = {
  selectedName: "Paris, France",
  country: "France",
  normalizedForCalculation: { latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris" }
};

async function invitesEnvoyees(input, { language = "fr", birthDate = "1970-06-15", resolvedPlace = LIEU } = {}) {
  const captures = [];
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    captures.push({ url: String(url), body: JSON.parse(init.body) });
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Texte de remplacement pour le test." } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      })
    };
  };
  try {
    await createPublicReading(
      { firstName: "Test", language, birthDate, resolvedPlace, ...input },
      { crossCheck: false, config: { apiKey: "test", baseUrl: "https://exemple.invalid/v1", model: "test" } }
    );
  } finally {
    globalThis.fetch = fetchOriginal;
  }
  return {
    systemes: captures.map((capture) => capture.body.messages.find((message) => message.role === "system").content),
    utilisateurs: captures.map((capture) => JSON.parse(capture.body.messages.find((message) => message.role === "user").content))
  };
}

test("heure inconnue : l'invite interdit de nommer le signe d'un corps non établi", async () => {
  const { systemes, utilisateurs } = await invitesEnvoyees({ timePrecision: "unknown" });
  assert.ok(systemes.length >= 8, `sections envoyées : ${systemes.length}`);
  const systeme = systemes[0];
  assert.match(systeme, /le signe de ces corps n'est PAS établi/i);
  assert.match(systeme, /Lune/, "le corps concerné doit être nommé tel que le lecteur le voit");
  assert.match(systeme, /aucun signe/i);
  // Le fait brut est aussi transmis, pour que le modèle sache de quoi on parle.
  assert.deepEqual(utilisateurs[0].signsNotEstablished, ["Moon"]);
  // Et l'angle reste explicitement non calculé.
  assert.match(systeme, /Ascendant/i);
});

test("heure approximative : l'invite borne le signe des angles par la marge", async () => {
  // 15 janvier 1990 à Paris : l'Ascendant franchit une frontière de signe dans la
  // marge, donc il n'est pas décidable et les maisons non plus.
  const instable = await invitesEnvoyees(
    { timeValue: "12:30", timePrecision: "approximate", timeMarginMinutes: 30 },
    { birthDate: "1990-01-15" }
  );
  assert.match(instable.systemes[0], /marge de ±30 min/i);
  assert.match(instable.systemes[0], /CHANGE à l'intérieur de la marge/i);
  assert.match(instable.systemes[0], /aucune maison/i);
  assert.equal(instable.utilisateurs[0].approximateBirthTime.housesDecidableWithinMargin, false);

  // Même heure, marge plus serrée : le signe est stable, la consigne change de ton
  // (probabilité forte) et les maisons redeviennent utilisables.
  const stable = await invitesEnvoyees({ timeValue: "12:30", timePrecision: "approximate", timeMarginMinutes: 15 });
  assert.match(stable.systemes[0], /ne change pas/i);
  assert.match(stable.systemes[0], /probabilité forte/i);
  assert.equal(stable.utilisateurs[0].approximateBirthTime.housesDecidableWithinMargin, true);

  // Aucun corps n'est « non établi » ici : la consigne ne doit pas apparaître.
  assert.doesNotMatch(stable.systemes[0], /le signe de ces corps n'est PAS établi/i);
  assert.deepEqual(stable.utilisateurs[0].signsNotEstablished, []);
});

test("heure exacte : aucune consigne d'incertitude n'est envoyée", async () => {
  const { systemes, utilisateurs } = await invitesEnvoyees({ timeValue: "12:30", timePrecision: "exact" });
  const systeme = systemes[0];
  assert.doesNotMatch(systeme, /marge de ±/i);
  assert.doesNotMatch(systeme, /le signe de ces corps n'est PAS établi/i);
  assert.equal(utilisateurs[0].approximateBirthTime, undefined);
  assert.deepEqual(utilisateurs[0].signsNotEstablished, []);
});

test("l'annexe dit explicitement qu'un signe n'est pas établi, dans les neuf langues", () => {
  for (const { code } of LANGUAGES) {
    const strings = docStrings(code);
    const socle = buildSocle(
      calculateWesternNatalChart({
        birthDate: "1970-06-15",
        timePrecision: "unknown",
        latitude: 48.8566,
        longitude: 2.3522,
        timeZone: "Europe/Paris"
      }).result,
      strings
    );
    assert.deepEqual(socle.signsNotEstablished, ["Moon"], `${code} : corps non établi mal identifié`);
    const lune = socle.facts.find((fact) => fact.id === "body.Moon");
    // Une plage seule (« Balance → Scorpion ») laissait croire qu'un signe pouvait
    // être retenu : le fait doit dire que le signe n'est pas établi.
    assert.match(lune.value, new RegExp(strings.values.signNotEstablished.slice(0, 18)), `${code} : mention absente`);
  }
});

test("l'annexe publiée porte la marge dans la langue du document", async () => {
  // Le contrôle de mesure cherchait la chaîne française : faux négatif en anglais.
  for (const language of ["fr", "en", "de", "nl"]) {
    const socle = buildSocle(
      calculateWesternNatalChart({
        birthDate: "1990-01-15",
        timeValue: "12:30",
        timePrecision: "approximate",
        timeMarginMinutes: 30,
        latitude: 48.8566,
        longitude: 2.3522,
        timeZone: "Europe/Paris"
      }).result,
      docStrings(language)
    );
    const libelle = docStrings(language).labels.margin;
    const fait = socle.facts.find((entry) => entry.id === "uncertainty.margin");
    assert.ok(fait, `${language} : fait de marge absent`);
    assert.equal(fait.label, libelle, `${language} : libellé de marge non localisé`);
  }
});
