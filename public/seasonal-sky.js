// Public astronomical snapshot only. No horoscope, model call, birth data or
// payment is requested by this independent homepage enhancement.
const SIGNS = Object.freeze(["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]);
const GLYPHS = Object.freeze(["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"]);
const GUIDE_SLUGS = Object.freeze(["belier", "taureau", "gemeaux", "cancer", "lion", "vierge", "balance", "scorpion", "sagittaire", "capricorne", "verseau", "poissons"]);
const COPY = Object.freeze({
  fr: {
    signs: ["Bélier", "Taureau", "Gémeaux", "Cancer", "Lion", "Vierge", "Balance", "Scorpion", "Sagittaire", "Capricorne", "Verseau", "Poissons"],
    kicker: "Le signe du moment", fact: name => `Le Soleil est actuellement en ${name}, dans le zodiaque tropical.`,
    invitation: "Prenez un instant pour explorer ce signe et son univers symbolique.",
    guide: "Découvrir ce signe →", sky: "Explorer le ciel du moment", paris: "heure de Paris"
  },
  en: {
    signs: ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"],
    kicker: "The sign of the moment", fact: name => `The Sun is currently in ${name} in the tropical zodiac.`,
    invitation: "Take a moment to explore this sign and its symbolic world.",
    guide: "Explore this sign →", sky: "Explore the current sky", paris: "Paris time"
  },
  de: {
    signs: ["Widder", "Stier", "Zwillinge", "Krebs", "Löwe", "Jungfrau", "Waage", "Skorpion", "Schütze", "Steinbock", "Wassermann", "Fische"],
    kicker: "Das Zeichen des Augenblicks", fact: name => `Die Sonne steht im tropischen Tierkreis derzeit im Zeichen ${name}.`,
    invitation: "Nehmen Sie sich einen Moment Zeit, dieses Zeichen und seine Symbolik zu entdecken.",
    guide: "Dieses Zeichen entdecken →", sky: "Den aktuellen Himmel entdecken", paris: "Pariser Zeit"
  },
  es: {
    signs: ["Aries", "Tauro", "Géminis", "Cáncer", "Leo", "Virgo", "Libra", "Escorpio", "Sagitario", "Capricornio", "Acuario", "Piscis"],
    kicker: "El signo del momento", fact: name => `El Sol está actualmente en ${name}, en el zodiaco tropical.`,
    invitation: "Tómate un momento para descubrir este signo y su universo simbólico.",
    guide: "Descubrir este signo →", sky: "Explorar el cielo del momento", paris: "hora de París"
  },
  it: {
    signs: ["Ariete", "Toro", "Gemelli", "Cancro", "Leone", "Vergine", "Bilancia", "Scorpione", "Sagittario", "Capricorno", "Acquario", "Pesci"],
    kicker: "Il segno del momento", fact: name => `Il Sole si trova attualmente in ${name}, nello zodiaco tropicale.`,
    invitation: "Prenditi un momento per esplorare questo segno e il suo universo simbolico.",
    guide: "Scopri questo segno →", sky: "Esplora il cielo del momento", paris: "ora di Parigi"
  },
  pt: {
    signs: ["Carneiro", "Touro", "Gémeos", "Caranguejo", "Leão", "Virgem", "Balança", "Escorpião", "Sagitário", "Capricórnio", "Aquário", "Peixes"],
    kicker: "O signo do momento", fact: name => `O Sol está atualmente em ${name}, no zodíaco tropical.`,
    invitation: "Reserve um momento para explorar este signo e o seu universo simbólico.",
    guide: "Descobrir este signo →", sky: "Explorar o céu do momento", paris: "hora de Paris"
  },
  no: {
    signs: ["Væren", "Tyren", "Tvillingene", "Krepsen", "Løven", "Jomfruen", "Vekten", "Skorpionen", "Skytten", "Steinbukken", "Vannmannen", "Fiskene"],
    kicker: "Øyeblikkets tegn", fact: name => `Solen står nå i ${name} i den tropiske dyrekretsen.`,
    invitation: "Ta et øyeblikk til å utforske dette tegnet og dets symbolske verden.",
    guide: "Utforsk dette tegnet →", sky: "Utforsk himmelen akkurat nå", paris: "Paris-tid"
  },
  da: {
    signs: ["Vædderen", "Tyren", "Tvillingerne", "Krebsen", "Løven", "Jomfruen", "Vægten", "Skorpionen", "Skytten", "Stenbukken", "Vandmanden", "Fiskene"],
    kicker: "Øjeblikkets tegn", fact: name => `Solen står nu i ${name} i den tropiske dyrekreds.`,
    invitation: "Brug et øjeblik på at udforske dette tegn og dets symbolske univers.",
    guide: "Udforsk dette tegn →", sky: "Udforsk himlen lige nu", paris: "Paris-tid"
  },
  nl: {
    signs: ["Ram", "Stier", "Tweelingen", "Kreeft", "Leeuw", "Maagd", "Weegschaal", "Schorpioen", "Boogschutter", "Steenbok", "Waterman", "Vissen"],
    kicker: "Het teken van dit moment", fact: name => `De zon staat momenteel in ${name}, in de tropische dierenriem.`,
    invitation: "Neem even de tijd om dit teken en zijn symbolische wereld te ontdekken.",
    guide: "Ontdek dit teken →", sky: "Ontdek de hemel van dit moment", paris: "Parijse tijd"
  }
});

export function seasonalSkyCopy(snapshot, language = "fr") {
  if (!snapshot || snapshot.schema !== "lastro.seasonal_sky@1.0.0"
      || snapshot.referenceTimeZone !== "Europe/Paris" || snapshot.zodiac !== "tropical"
      || typeof snapshot.asOfUtc !== "string") return null;
  const instant = new Date(snapshot.asOfUtc);
  const longitude = snapshot.sun?.longitude;
  const signIndex = SIGNS.indexOf(snapshot.sun?.signId);
  if (!Number.isFinite(instant.getTime()) || typeof longitude !== "number"
      || !Number.isFinite(longitude) || longitude < 0 || longitude >= 360
      || signIndex !== Math.floor(longitude / 30)) return null;
  const requested = typeof language === "string" ? language.toLowerCase().split("-")[0] : "en";
  const locale = Object.hasOwn(COPY, requested) ? requested : "en";
  const copy = COPY[locale];
  const name = copy.signs[signIndex];
  return {
    locale, title: name, glyph: GLYPHS[signIndex], kicker: copy.kicker,
    fact: copy.fact(name), invitation: copy.invitation,
    date: `${new Intl.DateTimeFormat(locale, { timeZone: "Europe/Paris", year: "numeric", month: "long", day: "numeric" }).format(instant)} · ${copy.paris}`,
    dateTime: instant.toISOString(),
    // Existing guides are French. Never present an untranslated French article
    // as if it were part of one of the other language experiences.
    guideHref: `/guides/signes/${GUIDE_SLUGS[signIndex]}.html`, guideLabel: copy.guide,
    skyHref: "/ciel/", skyLabel: copy.sky, showFrenchLinks: locale === "fr"
  };
}

export function renderSeasonalSky(root, snapshot, language = "fr") {
  if (!root) return false;
  const copy = seasonalSkyCopy(snapshot, language);
  if (!copy) { root.hidden = true; return false; }
  const node = name => root.querySelector(`#seasonal-sky-${name}`);
  const required = ["symbol", "kicker", "title", "fact", "invitation", "date", "guide", "ciel"];
  if (required.some(name => !node(name))) { root.hidden = true; return false; }
  for (const [name, value] of Object.entries({ symbol: copy.glyph, kicker: copy.kicker, title: copy.title, fact: copy.fact, invitation: copy.invitation, date: copy.date })) {
    node(name).textContent = value;
  }
  node("date").dateTime = copy.dateTime;
  for (const [name, href, label] of [["guide", copy.guideHref, copy.guideLabel], ["ciel", copy.skyHref, copy.skyLabel]]) {
    node(name).href = href;
    node(name).textContent = label;
    node(name).hidden = !copy.showFrenchLinks;
  }
  root.hidden = false;
  return true;
}

export async function mountSeasonalSky({ documentRef = globalThis.document, fetchImpl = globalThis.fetch, Observer = globalThis.MutationObserver } = {}) {
  const root = documentRef?.getElementById("seasonal-sky");
  if (!root || typeof fetchImpl !== "function") return { rendered: false };
  let snapshot;
  try {
    const response = await fetchImpl("/api/public/seasonal-sky", {
      method: "GET", credentials: "omit", headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error("Seasonal snapshot unavailable");
    snapshot = await response.json();
  } catch {
    // There is deliberately no calendar-based or invented sign fallback.
    root.hidden = true;
    return { rendered: false };
  }
  const render = () => renderSeasonalSky(root, snapshot, documentRef.documentElement.lang);
  const rendered = render();
  let observer;
  if (rendered && typeof Observer === "function") {
    observer = new Observer(render);
    observer.observe(documentRef.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }
  return { rendered, disconnect: () => observer?.disconnect() };
}

if (typeof document !== "undefined") void mountSeasonalSky();
