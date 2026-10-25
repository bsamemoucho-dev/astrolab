// Labels for the calculated natal-chart panel only. No interpretation is added.
const LABELS = {
  fr: {
    uncertainty: "Arc et ? : position incertaine dans la plage de naissance.",
    indicativePositions: "Positions indicatives à l’heure de naissance indiquée.",
    title: "Thème natal", legend: "Lire la carte", harmony: "Sextile · trigone", tension: "Carré · opposition", conjunction: "Conjonction",
    aspects: "Seuls les aspects calculés sont tracés. Bleu : harmonie symbolique ; rouge : tension symbolique ; gris : conjonction sans classement automatique.",
    points: "Repère : degré calculé ; trait fin : symbole décalé pour la lisibilité.",
    angles: "AC : Ascendant · DS : Descendant · MC : Milieu du Ciel · FC : Fond du Ciel. Chiffres : maisons entières. R : rétrograde apparent.",
    limits: "Ces conventions symboliques ne prédisent aucun événement.",
    approximate: "heure approximative", unknownTime: "heure inconnue", positions: "Positions planétaires", minute: "min", locale: "fr-FR"
  },
  en: {
    uncertainty: "Arc and ?: uncertain position within the birth-time range.",
    indicativePositions: "Indicative positions at the stated birth time.",
    title: "Birth chart", legend: "Reading the chart", harmony: "Sextile · trine", tension: "Square · opposition", conjunction: "Conjunction",
    aspects: "Lines show only aspects retained by the calculation. Blue: symbolic harmony; red: symbolic tension; grey: conjunction, with no automatic classification.",
    points: "Each marker shows the calculated degree. A fine leader connects a symbol moved for readability.",
    angles: "AC: Ascendant · DS: Descendant · MC: Midheaven · FC: lower meridian. Numbers 1–12: whole-sign houses. R: apparent retrograde motion.",
    limits: "These astrological conventions are symbolic; they do not indicate certain events or measured personality traits.",
    approximate: "approximate time", unknownTime: "time unknown", positions: "Planetary positions", minute: "min", locale: "en-GB"
  },
  de: {
    uncertainty: "Bogen und ?: unsichere Position innerhalb der Geburtsspanne.",
    indicativePositions: "Ungefähre Positionen zur angegebenen Geburtszeit.",
    title: "Geburtshoroskop", legend: "Die Karte lesen", harmony: "Sextil · Trigon", tension: "Quadrat · Opposition", conjunction: "Konjunktion",
    aspects: "Die Linien zeigen ausschließlich berechnete, berücksichtigte Aspekte. Blau: symbolische Harmonie; Rot: symbolische Spannung; Grau: Konjunktion ohne automatische Zuordnung.",
    points: "Jede Markierung zeigt den berechneten Grad. Eine feine Linie verbindet ein aus Platzgründen versetztes Symbol.",
    angles: "AC: Aszendent · DS: Deszendent · MC: Himmelsmitte · FC: Himmelstiefe. Zahlen 1–12: Ganzzeichenhäuser. R: scheinbar rückläufige Bewegung.",
    limits: "Diese astrologischen Konventionen sind symbolisch; sie bezeichnen weder sichere Ereignisse noch gemessene Eigenschaften.",
    approximate: "ungefähre Uhrzeit", unknownTime: "Uhrzeit unbekannt", positions: "Planetenpositionen", minute: "Min.", locale: "de-DE"
  },
  es: {
    uncertainty: "Arco y ?: posición incierta dentro del intervalo de nacimiento.",
    indicativePositions: "Posiciones orientativas a la hora de nacimiento indicada.",
    title: "Carta natal", legend: "Cómo leer la carta", harmony: "Sextil · trígono", tension: "Cuadratura · oposición", conjunction: "Conjunción",
    aspects: "Las líneas muestran solo los aspectos retenidos por el cálculo. Azul: armonía simbólica; rojo: tensión simbólica; gris: conjunción, sin clasificación automática.",
    points: "Cada marca señala el grado calculado. Una línea fina conecta el símbolo desplazado para facilitar la lectura.",
    angles: "AC: Ascendente · DS: Descendente · MC: Medio Cielo · FC: Fondo del Cielo. Números 1–12: casas de signo entero. R: movimiento retrógrado aparente.",
    limits: "Estas convenciones astrológicas son simbólicas; no señalan acontecimientos seguros ni rasgos medidos.",
    approximate: "hora aproximada", unknownTime: "hora desconocida", positions: "Posiciones planetarias", minute: "min", locale: "es-ES"
  },
  it: {
    uncertainty: "Arco e ?: posizione incerta nell’intervallo di nascita.",
    indicativePositions: "Posizioni indicative all’ora di nascita dichiarata.",
    title: "Tema natale", legend: "Leggere la carta", harmony: "Sestile · trigono", tension: "Quadratura · opposizione", conjunction: "Congiunzione",
    aspects: "Le linee mostrano solo gli aspetti mantenuti dal calcolo. Blu: armonia simbolica; rosso: tensione simbolica; grigio: congiunzione, senza classificazione automatica.",
    points: "Ogni riferimento indica il grado calcolato. Una linea sottile collega il simbolo spostato per renderlo leggibile.",
    angles: "AC: Ascendente · DS: Discendente · MC: Medio Cielo · FC: Fondo Cielo. Numeri 1–12: case a segno intero. R: moto retrogrado apparente.",
    limits: "Queste convenzioni astrologiche sono simboliche; non indicano eventi certi né caratteristiche misurate.",
    approximate: "ora approssimativa", unknownTime: "ora sconosciuta", positions: "Posizioni planetarie", minute: "min", locale: "it-IT"
  },
  pt: {
    uncertainty: "Arco e ?: posição incerta no intervalo de nascimento.",
    indicativePositions: "Posições indicativas à hora de nascimento indicada.",
    title: "Mapa natal", legend: "Ler o mapa", harmony: "Sextil · trígono", tension: "Quadratura · oposição", conjunction: "Conjunção",
    aspects: "As linhas mostram apenas os aspetos retidos pelo cálculo. Azul: harmonia simbólica; vermelho: tensão simbólica; cinzento: conjunção, sem classificação automática.",
    points: "Cada marca indica o grau calculado. Uma linha fina liga o símbolo deslocado para facilitar a leitura.",
    angles: "AC: Ascendente · DS: Descendente · MC: Meio do Céu · FC: Fundo do Céu. Números 1–12: casas de signo inteiro. R: movimento retrógrado aparente.",
    limits: "Estas convenções astrológicas são simbólicas; não indicam acontecimentos certos nem características medidas.",
    approximate: "hora aproximada", unknownTime: "hora desconhecida", positions: "Posições planetárias", minute: "min", locale: "pt-PT"
  },
  no: {
    uncertainty: "Bue og ?: usikker posisjon innenfor fødselstidsintervallet.",
    indicativePositions: "Veiledende posisjoner ved oppgitt fødselstid.",
    title: "Fødselshoroskop", legend: "Slik leses kartet", harmony: "Sekstil · trigon", tension: "Kvadrat · opposisjon", conjunction: "Konjunksjon",
    aspects: "Linjene viser bare aspektene som er beholdt i beregningen. Blått: symbolsk harmoni; rødt: symbolsk spenning; grått: konjunksjon uten automatisk klassifisering.",
    points: "Hver markør viser beregnet grad. En tynn linje forbinder et symbol som er flyttet for lesbarhet.",
    angles: "AC: ascendant · DS: descendant · MC: himmelmidten · FC: nedre meridian. Tall 1–12: heltegnhus. R: tilsynelatende retrograd bevegelse.",
    limits: "Disse astrologiske konvensjonene er symbolske; de angir verken sikre hendelser eller målte egenskaper.",
    approximate: "omtrentlig klokkeslett", unknownTime: "ukjent klokkeslett", positions: "Planetposisjoner", minute: "min", locale: "nb-NO"
  },
  da: {
    uncertainty: "Bue og ?: usikker position inden for fødselstidsintervallet.",
    indicativePositions: "Vejledende positioner på det oplyste fødselstidspunkt.",
    title: "Fødselshoroskop", legend: "Sådan læses kortet", harmony: "Sekstil · trigon", tension: "Kvadrat · opposition", conjunction: "Konjunktion",
    aspects: "Linjerne viser kun de aspekter, som beregningen har beholdt. Blå: symbolsk harmoni; rød: symbolsk spænding; grå: konjunktion uden automatisk klassifikation.",
    points: "Hver markør viser den beregnede grad. En tynd linje forbinder et symbol, der er flyttet for læsbarhedens skyld.",
    angles: "AC: ascendant · DS: descendant · MC: himmelmidten · FC: nedre meridian. Tal 1–12: heltegnshuse. R: tilsyneladende retrograd bevægelse.",
    limits: "Disse astrologiske konventioner er symbolske; de angiver hverken sikre begivenheder eller målte egenskaber.",
    approximate: "omtrentligt tidspunkt", unknownTime: "ukendt tidspunkt", positions: "Planetpositioner", minute: "min", locale: "da-DK"
  },
  nl: {
    uncertainty: "Boog en ?: onzekere positie binnen het geboortetijdsinterval.",
    indicativePositions: "Indicatieve posities op de opgegeven geboortetijd.",
    title: "Geboortehoroscoop", legend: "De kaart lezen", harmony: "Sextiel · driehoek", tension: "Vierkant · oppositie", conjunction: "Conjunctie",
    aspects: "De lijnen tonen uitsluitend aspecten die door de berekening zijn behouden. Blauw: symbolische harmonie; rood: symbolische spanning; grijs: conjunctie zonder automatische indeling.",
    points: "Elk merkteken toont de berekende graad. Een dunne lijn verbindt een symbool dat voor de leesbaarheid is verplaatst.",
    angles: "AC: ascendant · DS: descendant · MC: midhemel · FC: onderste meridiaan. Cijfers 1–12: hele-tekenhuizen. R: schijnbaar retrograde beweging.",
    limits: "Deze astrologische conventies zijn symbolisch; ze duiden geen zekere gebeurtenissen of gemeten eigenschappen aan.",
    approximate: "geschatte tijd", unknownTime: "tijd onbekend", positions: "Planeetposities", minute: "min", locale: "nl-NL"
  }
};

export function natalChartLabels(language = "fr") {
  return LABELS[language] ?? LABELS.fr;
}
