// General reference vocabulary only. This module receives no birth data,
// grants no interpretive licence and never invokes a writer or a calculation.
import { docStrings } from "./i18n.mjs";

export const CHART_GLOSSARY_VERSION = "lastro-chart-glossary@1.0.0";

const COPY = {
  fr: {
    title: "Comprendre votre carte", term: "Terme", meaning: "Repère de lecture", house: "Maison", domain: "Domaine symbolique",
    intro: "Ces repères expliquent le vocabulaire astrologique. Les domaines des maisons sont des conventions symboliques : ils ne décrivent pas à eux seuls votre personnalité, votre situation ni des événements à venir.",
    terms: [
      ["Signe", "L’un des douze secteurs de 30° du zodiaque tropical."],
      ["Maison", "Secteur associé à un domaine de vie. Lastro utilise les maisons entières, selon le signe de l’Ascendant."],
      ["Aspect", "Écart angulaire entre deux points, retenu selon les angles et tolérances de Lastro."],
      ["Ascendant (AC)", "Point du zodiaque qui se lève à l’horizon est ; il dépend de l’heure et du lieu de naissance."],
      ["Orbe réel", "Écart, en degrés, entre l’angle mesuré et l’angle exact de l’aspect."],
      ["Orbe maximal", "Seuil de tolérance choisi dans la convention Lastro pour retenir cet aspect."]
    ],
    houses: ["Identité.", "Ressources.", "Parole.", "Famille.", "Création, expression personnelle et jeu.", "Travail quotidien.", "Relations, partenariats et engagements.", "Transformation.", "Vision.", "Vocation.", "Collectif.", "Intériorité."]
  },
  en: {
    title: "Understanding your chart", term: "Term", meaning: "Reading aid", house: "House", domain: "Symbolic domain",
    intro: "These reference points explain astrological vocabulary. House domains are symbolic conventions: on their own they do not describe your personality, circumstances or future events.",
    terms: [
      ["Sign", "One of the twelve 30° sectors of the tropical zodiac."],
      ["House", "A sector associated with a life domain. Lastro uses whole-sign houses, based on the Ascendant’s sign."],
      ["Aspect", "An angular relationship between two points, retained using Lastro’s reference angles and tolerances."],
      ["Ascendant (AC)", "The zodiacal point rising on the eastern horizon; it depends on the birth time and location."],
      ["Actual orb", "The difference in degrees between the measured angle and the exact aspect angle."],
      ["Maximum orb", "The tolerance threshold chosen in Lastro’s convention for retaining that aspect."]
    ],
    houses: ["Identity.", "Resources.", "Speech.", "Family.", "Creation, personal expression and play.", "Daily work.", "Relationships, partnerships and commitments.", "Transformation.", "Vision.", "Vocation.", "Collective life.", "Inner life."]
  },
  de: {
    title: "Ihre Karte verstehen", term: "Begriff", meaning: "Lesehilfe", house: "Haus", domain: "Symbolischer Bereich",
    intro: "Dieses Glossar erklärt astrologische Begriffe. Hausbereiche sind symbolische Konventionen: allein beschreiben sie weder Persönlichkeit, Lebenslage noch zukünftige Ereignisse.",
    terms: [
      ["Zeichen", "Einer der zwölf 30°-Abschnitte des tropischen Tierkreises."],
      ["Haus", "Ein Lebensbereich zugeordneter Abschnitt. Lastro nutzt Ganzzeichenhäuser, ausgehend vom Zeichen des Aszendenten."],
      ["Aspekt", "Eine Winkelbeziehung zwischen zwei Punkten nach den Referenzwinkeln und Toleranzen von Lastro."],
      ["Aszendent (AC)", "Der am östlichen Horizont aufsteigende Tierkreispunkt; er hängt von Geburtszeit und Geburtsort ab."],
      ["Tatsächlicher Orbis", "Abweichung in Grad zwischen dem gemessenen Winkel und dem exakten Aspektwinkel."],
      ["Maximaler Orbis", "Die in der Lastro-Konvention gewählte Toleranzgrenze zur Berücksichtigung dieses Aspekts."]
    ],
    houses: ["Identität.", "Ressourcen.", "Sprache.", "Familie.", "Kreation, persönlicher Ausdruck und Spiel.", "Alltägliche Arbeit.", "Beziehungen, Partnerschaften und Verpflichtungen.", "Transformation.", "Vision.", "Berufung.", "Gemeinschaft.", "Inneres Leben."]
  },
  es: {
    title: "Comprender su carta", term: "Término", meaning: "Clave de lectura", house: "Casa", domain: "Ámbito simbólico",
    intro: "Estas claves explican el vocabulario astrológico. Los ámbitos de las casas son convenciones simbólicas: por sí solos no describen su personalidad, su situación ni acontecimientos futuros.",
    terms: [
      ["Signo", "Uno de los doce sectores de 30° del zodiaco tropical."],
      ["Casa", "Sector asociado a un ámbito vital. Lastro utiliza casas de signo entero, según el signo del Ascendente."],
      ["Aspecto", "Relación angular entre dos puntos, retenida según los ángulos y tolerancias de Lastro."],
      ["Ascendente (AC)", "Punto del zodiaco que asciende por el horizonte oriental; depende de la hora y el lugar de nacimiento."],
      ["Orbe real", "Diferencia en grados entre el ángulo medido y el ángulo exacto del aspecto."],
      ["Orbe máximo", "Umbral de tolerancia elegido por la convención Lastro para retener ese aspecto."]
    ],
    houses: ["Identidad.", "Recursos.", "Palabra.", "Familia.", "Creación, expresión personal y juego.", "Trabajo cotidiano.", "Relaciones, colaboraciones y compromisos.", "Transformación.", "Visión.", "Vocación.", "Colectivo.", "Vida interior."]
  },
  it: {
    title: "Comprendere la vostra carta", term: "Termine", meaning: "Chiave di lettura", house: "Casa", domain: "Ambito simbolico",
    intro: "Questi riferimenti spiegano il vocabolario astrologico. Gli ambiti delle case sono convenzioni simboliche: da soli non descrivono la vostra personalità, la vostra situazione o eventi futuri.",
    terms: [
      ["Segno", "Uno dei dodici settori di 30° dello zodiaco tropicale."],
      ["Casa", "Settore associato a un ambito della vita. Lastro usa case a segno intero, secondo il segno dell’Ascendente."],
      ["Aspetto", "Relazione angolare tra due punti, selezionata secondo gli angoli e le tolleranze Lastro."],
      ["Ascendente (AC)", "Punto dello zodiaco che sorge all’orizzonte orientale; dipende dall’ora e dal luogo di nascita."],
      ["Orbe reale", "Differenza in gradi tra l’angolo misurato e l’angolo esatto dell’aspetto."],
      ["Orbe massimo", "Soglia di tolleranza scelta nella convenzione Lastro per considerare questo aspetto."]
    ],
    houses: ["Identità.", "Risorse.", "Parola.", "Famiglia.", "Creazione, espressione personale e gioco.", "Lavoro quotidiano.", "Relazioni, collaborazioni e impegni.", "Trasformazione.", "Visione.", "Vocazione.", "Collettività.", "Vita interiore."]
  },
  pt: {
    title: "Compreender o seu mapa", term: "Termo", meaning: "Referência de leitura", house: "Casa", domain: "Domínio simbólico",
    intro: "Estas referências explicam o vocabulário astrológico. Os domínios das casas são convenções simbólicas: por si só não descrevem a sua personalidade, situação ou acontecimentos futuros.",
    terms: [
      ["Signo", "Um dos doze setores de 30° do zodíaco tropical."],
      ["Casa", "Setor associado a um domínio da vida. Lastro usa casas de signo inteiro, segundo o signo do Ascendente."],
      ["Aspeto", "Relação angular entre dois pontos, retida segundo os ângulos e tolerâncias Lastro."],
      ["Ascendente (AC)", "Ponto do zodíaco que nasce no horizonte oriental; depende da hora e do local de nascimento."],
      ["Orbe real", "Diferença em graus entre o ângulo medido e o ângulo exato do aspeto."],
      ["Orbe máximo", "Limiar de tolerância escolhido na convenção Lastro para reter esse aspeto."]
    ],
    houses: ["Identidade.", "Recursos.", "Palavra.", "Família.", "Criação, expressão pessoal e jogo.", "Trabalho quotidiano.", "Relações, parcerias e compromissos.", "Transformação.", "Visão.", "Vocação.", "Coletivo.", "Vida interior."]
  },
  no: {
    title: "Forstå kartet ditt", term: "Begrep", meaning: "Lesehjelp", house: "Hus", domain: "Symbolsk område",
    intro: "Disse holdepunktene forklarer astrologiske begreper. Husenes livsområder er symbolske konvensjoner; alene beskriver de verken personligheten din, situasjonen din eller fremtidige hendelser.",
    terms: [
      ["Tegn", "En av de tolv sektorene på 30° i den tropiske dyrekretsen."],
      ["Hus", "En sektor knyttet til et livsområde. Lastro bruker heltegnhus ut fra ascendantens tegn."],
      ["Aspekt", "En vinkelforbindelse mellom to punkter, valgt etter Lastros referansevinkler og toleranser."],
      ["Ascendant (AC)", "Dyrekretspunktet som stiger ved den østlige horisonten; det avhenger av fødselstid og fødested."],
      ["Faktisk orb", "Forskjellen i grader mellom den målte vinkelen og den eksakte aspektvinkelen."],
      ["Maksimal orb", "Toleransegrensen Lastros konvensjon bruker for å ta med dette aspektet."]
    ],
    houses: ["Identitet.", "Ressurser.", "Språk.", "Familie.", "Skaping, personlig uttrykk og lek.", "Daglig arbeid.", "Relasjoner, partnerskap og forpliktelser.", "Forvandling.", "Visjon.", "Kall.", "Fellesskap.", "Indre liv."]
  },
  da: {
    title: "Forstå dit kort", term: "Begreb", meaning: "Læsehjælp", house: "Hus", domain: "Symbolsk område",
    intro: "Disse holdepunkter forklarer astrologiske begreber. Husenes livsområder er symbolske konventioner; alene beskriver de hverken din personlighed, din situation eller fremtidige begivenheder.",
    terms: [
      ["Tegn", "En af de tolv sektorer på 30° i den tropiske dyrekreds."],
      ["Hus", "En sektor knyttet til et livsområde. Lastro bruger heltegnshuse ud fra ascendantens tegn."],
      ["Aspekt", "En vinkelforbindelse mellem to punkter, valgt efter Lastros referencevinkler og tolerancer."],
      ["Ascendant (AC)", "Dyrekredspunktet, der stiger ved den østlige horisont; det afhænger af fødselstid og fødested."],
      ["Faktisk orbis", "Forskellen i grader mellem den målte vinkel og den præcise aspektvinkel."],
      ["Maksimal orbis", "Den tolerancegrænse, Lastros konvention bruger til at medtage dette aspekt."]
    ],
    houses: ["Identitet.", "Ressourcer.", "Sprog.", "Familie.", "Skabelse, personligt udtryk og leg.", "Dagligt arbejde.", "Relationer, partnerskaber og forpligtelser.", "Forvandling.", "Vision.", "Kald.", "Fællesskab.", "Indre liv."]
  },
  nl: {
    title: "Uw kaart begrijpen", term: "Begrip", meaning: "Leeshulp", house: "Huis", domain: "Symbolisch domein",
    intro: "Deze aanknopingspunten verklaren astrologische begrippen. De huisdomeinen zijn symbolische conventies; op zichzelf beschrijven ze niet uw persoonlijkheid, omstandigheden of toekomstige gebeurtenissen.",
    terms: [
      ["Teken", "Een van de twaalf sectoren van 30° van de tropische dierenriem."],
      ["Huis", "Een sector die aan een levensgebied is gekoppeld. Lastro gebruikt hele-tekenhuizen op basis van het teken van de ascendant."],
      ["Aspect", "Een hoekrelatie tussen twee punten, geselecteerd volgens Lastro’s referentiehoeken en toleranties."],
      ["Ascendant (AC)", "Het dierenriempunt dat aan de oostelijke horizon opkomt; het hangt af van geboortetijd en geboorteplaats."],
      ["Werkelijke orb", "Het verschil in graden tussen de gemeten hoek en de exacte aspecthoek."],
      ["Maximale orb", "De tolerantiegrens die Lastro’s conventie gebruikt om dit aspect te selecteren."]
    ],
    houses: ["Identiteit.", "Hulpbronnen.", "Spraak.", "Familie.", "Creatie, persoonlijke expressie en spel.", "Dagelijks werk.", "Relaties, partnerschappen en verbintenissen.", "Transformatie.", "Visie.", "Roeping.", "Collectief.", "Innerlijk leven."]
  }
};

// This is a general appendix, intentionally independent of every person's
// placements and the LLM plan. Twelve domain names follow the published guide.
export function chartGlossarySection(strings = null) {
  const t = strings ?? docStrings("fr");
  const copy = COPY[t.lang] ?? COPY.fr;
  const table = (headers, rows) => [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
  const text = [copy.intro, table([copy.term, copy.meaning], copy.terms), table([copy.house, copy.domain], copy.houses.map((domain, index) => [`${copy.house} ${index + 1}`, domain]))].join("\n\n");
  return {
    id: "comprendre-votre-carte",
    title: copy.title,
    kind: "reference",
    provider: "reference",
    badgeCode: "symbolic",
    badgeLabel: t.badgeSymbolic,
    status: "ok",
    referenceVersion: CHART_GLOSSARY_VERSION,
    text,
    validation: { ok: true, issues: [], scope: "general_reference_only" }
  };
}
