const state = {
  user: null,
  dossier: null,
  config: null,
  language: null,
  currentView: "auth",
  // Lecture relue depuis un lien de récupération (/r/<jeton>).
  recovery: null,
  // Jeton de la livraison affichée : c'est lui qui ouvre le PDF côté serveur.
  readingToken: null
};

// Offre de prix : montant libre à partir de 5 €, sans plafond. Les pastilles
// (5/10/20/30/50) ne sont que des suggestions ; celui qui veut donner plus le peut.
// 20 € est le montant proposé par défaut.
const MIN_PAYMENT_EUROS = 5;
const DEFAULT_PAYMENT_EUROS = 20;

const LANGUAGES = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "no", label: "Norsk", flag: "🇳🇴" },
  { code: "da", label: "Dansk", flag: "🇩🇰" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" }
];

const UI_STRINGS = {
  fr: {
    heroTag: "✦ Lecture personnalisée",
    heroTitle: "Bienvenue sur <span>Lastro</span>.",
    lead: "Ce que votre ciel dit de vous.",
    formTitle: "Votre lecture",
    dateLabel: "Date de naissance",
    hourLabel: "Heure", hourPrecisionLabel: "Précision",
    optExact: "Connue (précise)",
    optApprox: "Approximative",
    optUnknown: "Inconnue",
    optInterval: "Intervalle",
    timeLabel: "Heure",
    startLabel: "Début",
    endLabel: "Fin",
    placeLabel: "Lieu de naissance",
    placePlaceholder: "Ex. Paris, France",
    locateButton: "Localiser ce lieu",
    personalSummary: "Personnaliser — prénom & question (optionnel)",
    firstNameLabel: "Prénom",
    questionLabel: "Votre question",
    parentsSummary: "Parents — lecture transgénérationnelle (optionnel)",
    motherName: "Mère — nom",
    motherDate: "Mère — date",
    motherPlace: "Mère — lieu",
    fatherName: "Père — nom",
    fatherDate: "Père — date",
    fatherPlace: "Père — lieu",
    submit: "Recevoir ma lecture",
    progress: "Génération en cours — calcul puis rédaction (1 à 2 minutes environ).",
    payTitle: "Pendant que votre lecture se prépare…",
    payText: "Vous pouvez régler dès maintenant, au montant que vous voulez : le prix est libre.",
    payButton: "Régler par SumUp →",
    payNote: "Paiement sécurisé SumUp. Votre lecture continue de se générer en parallèle — rien n'est bloqué.",
    viewerTitle: "Votre lecture",
    viewerHint: "Elle est prête : téléchargez-la. Elle reste accessible 30 jours avec votre lien.",
    dlHtml: "HTML",
    dlMd: "Markdown",
    dlPdf: "PDF",
    proLink: "Connexion",
    placeConfirmed: "Lieu confirmé",
    placeAuto: "Localisé automatiquement",
    placeNote: "Ce lieu sera utilisé pour calculer votre thème.",
    placeFound: "Lieu trouvé ✓",
    aiNoticeTitle: "Texte généré par une intelligence artificielle",
    aiNoticeText: "Votre lecture est rédigée automatiquement à partir de vos données de naissance, dont le calcul est vérifié. Malgré les contrôles automatiques (dont une vérification par un second modèle), une IA peut se tromper, mal interpréter ou inventer une nuance : c'est un outil de réflexion, pas une vérité, ni un diagnostic, ni une prédiction d'événements.",
    aiConsent: "J'ai lu et compris : ce texte est généré par une IA et peut contenir des erreurs."
  },
  en: {
    heroTag: "✦ Personalised reading",
    heroTitle: "Welcome to <span>Lastro</span>.",
    lead: "What your sky says about you.",
    formTitle: "Your reading",
    dateLabel: "Date of birth",
    hourLabel: "Time", hourPrecisionLabel: "Precision",
    optExact: "Known (exact)",
    optApprox: "Approximate",
    optUnknown: "Unknown",
    optInterval: "Time range",
    timeLabel: "Time",
    startLabel: "From",
    endLabel: "To",
    placeLabel: "Place of birth",
    placePlaceholder: "e.g. London, UK",
    locateButton: "Find this place",
    personalSummary: "Personalise — first name & question (optional)",
    firstNameLabel: "First name",
    questionLabel: "Your question",
    parentsSummary: "Parents — transgenerational reading (optional)",
    motherName: "Mother — name",
    motherDate: "Mother — date",
    motherPlace: "Mother — place",
    fatherName: "Father — name",
    fatherDate: "Father — date",
    fatherPlace: "Father — place",
    submit: "Get my reading",
    progress: "Generating — calculation then writing (about 1–2 minutes).",
    payTitle: "While your reading is being prepared…",
    payText: "You can pay right now, whatever amount you want: the price is up to you.",
    payButton: "Pay with SumUp →",
    payNote: "Secure SumUp payment. Your reading keeps generating in parallel — nothing is blocked.",
    viewerTitle: "Your reading",
    viewerHint: "It is ready: download it. It stays available for 30 days with your link.",
    dlHtml: "HTML",
    dlMd: "Markdown",
    dlPdf: "PDF",
    proLink: "Sign in",
    placeConfirmed: "Place confirmed",
    placeAuto: "Found automatically",
    placeNote: "This place will be used to calculate your chart.",
    placeFound: "Place found ✓",
    aiNoticeTitle: "Text generated by artificial intelligence",
    aiNoticeText: "Your reading is written automatically from your birth data, whose calculation is verified. Despite automatic checks (including verification by a second model), an AI can make mistakes, misread or invent a nuance: this is a tool for reflection, not a truth, nor a diagnosis, nor a prediction of events.",
    aiConsent: "I have read and understood: this text is generated by an AI and may contain errors."
  },
  de: {
    heroTag: "✦ Persönliche Deutung",
    heroTitle: "Willkommen bei <span>Lastro</span>.",
    lead: "Was dein Himmel über dich sagt.",
    formTitle: "Deine Deutung",
    dateLabel: "Geburtsdatum",
    hourLabel: "Uhrzeit", hourPrecisionLabel: "Genauigkeit",
    optExact: "Bekannt (genau)",
    optApprox: "Ungefähr",
    optUnknown: "Unbekannt",
    optInterval: "Zeitspanne",
    timeLabel: "Uhrzeit",
    startLabel: "Von",
    endLabel: "Bis",
    placeLabel: "Geburtsort",
    placePlaceholder: "z. B. Berlin, Deutschland",
    locateButton: "Ort suchen",
    personalSummary: "Personalisieren — Vorname & Frage (optional)",
    firstNameLabel: "Vorname",
    questionLabel: "Deine Frage",
    parentsSummary: "Eltern — transgenerationale Deutung (optional)",
    motherName: "Mutter — Name",
    motherDate: "Mutter — Datum",
    motherPlace: "Mutter — Ort",
    fatherName: "Vater — Name",
    fatherDate: "Vater — Datum",
    fatherPlace: "Vater — Ort",
    submit: "Deutung erhalten",
    progress: "Wird erstellt — Berechnung, dann Text (etwa 1–2 Minuten).",
    payTitle: "Während deine Deutung entsteht …",
    payText: "Du kannst jetzt bezahlen, in der Höhe, die dir passt: der Preis ist frei.",
    payButton: "Mit SumUp bezahlen →",
    payNote: "Sichere Zahlung über SumUp. Deine Deutung wird parallel weiter erstellt — nichts wird blockiert.",
    viewerTitle: "Deine Deutung",
    viewerHint: "Sie ist fertig: Lade sie herunter. Mit deinem Link bleibt sie 30 Tage abrufbar.",
    dlHtml: "HTML",
    dlMd: "Markdown",
    dlPdf: "PDF",
    proLink: "Anmelden",
    placeConfirmed: "Ort bestätigt",
    placeAuto: "Automatisch gefunden",
    placeNote: "Dieser Ort wird für die Berechnung deines Horoskops verwendet.",
    placeFound: "Ort gefunden ✓",
    aiNoticeTitle: "Text von einer künstlichen Intelligenz erstellt",
    aiNoticeText: "Deine Deutung wird automatisch aus deinen Geburtsdaten erstellt, deren Berechnung geprüft ist. Trotz automatischer Kontrollen (inklusive einer Prüfung durch ein zweites Modell) kann eine KI sich irren, falsch deuten oder eine Nuance erfinden: Es ist ein Werkzeug zum Nachdenken, keine Wahrheit, keine Diagnose und keine Vorhersage von Ereignissen.",
    aiConsent: "Ich habe gelesen und verstanden: Dieser Text wird von einer KI erstellt und kann Fehler enthalten."
  },
  es: {
    heroTag: "✦ Lectura personalizada",
    heroTitle: "Bienvenido a <span>Lastro</span>.",
    lead: "Lo que tu cielo dice de ti.",
    formTitle: "Tu lectura",
    dateLabel: "Fecha de nacimiento",
    hourLabel: "Hora", hourPrecisionLabel: "Precisión",
    optExact: "Conocida (exacta)",
    optApprox: "Aproximada",
    optUnknown: "Desconocida",
    optInterval: "Intervalo",
    timeLabel: "Hora",
    startLabel: "Desde",
    endLabel: "Hasta",
    placeLabel: "Lugar de nacimiento",
    placePlaceholder: "p. ej. Madrid, España",
    locateButton: "Buscar este lugar",
    personalSummary: "Personalizar — nombre y pregunta (opcional)",
    firstNameLabel: "Nombre",
    questionLabel: "Tu pregunta",
    parentsSummary: "Padres — lectura transgeneracional (opcional)",
    motherName: "Madre — nombre",
    motherDate: "Madre — fecha",
    motherPlace: "Madre — lugar",
    fatherName: "Padre — nombre",
    fatherDate: "Padre — fecha",
    fatherPlace: "Padre — lugar",
    submit: "Recibir mi lectura",
    progress: "Generando — cálculo y redacción (1 a 2 minutos).",
    payTitle: "Mientras se prepara tu lectura…",
    payText: "Puedes pagar ahora, el importe que quieras: el precio es libre.",
    payButton: "Pagar con SumUp →",
    payNote: "Pago seguro con SumUp. Tu lectura sigue generándose en paralelo — nada se bloquea.",
    viewerTitle: "Tu lectura",
    viewerHint: "Está lista: descárgala. Sigue disponible 30 días con tu enlace.",
    dlHtml: "HTML",
    dlMd: "Markdown",
    dlPdf: "PDF",
    proLink: "Iniciar sesión",
    placeConfirmed: "Lugar confirmado",
    placeAuto: "Localizado automáticamente",
    placeNote: "Este lugar se usará para calcular tu carta.",
    placeFound: "Lugar encontrado ✓",
    aiNoticeTitle: "Texto generado por inteligencia artificial",
    aiNoticeText: "Tu lectura se redacta automáticamente a partir de tus datos de nacimiento, cuyo cálculo está verificado. A pesar de los controles automáticos (incluida una verificación por un segundo modelo), una IA puede equivocarse, malinterpretar o inventar un matiz: es una herramienta de reflexión, no una verdad, ni un diagnóstico, ni una predicción de acontecimientos.",
    aiConsent: "He leído y entendido: este texto está generado por una IA y puede contener errores."
  },
  it: {
    heroTag: "✦ Lettura personalizzata",
    heroTitle: "Benvenuto su <span>Lastro</span>.",
    lead: "Ciò che il tuo cielo dice di te.",
    formTitle: "La tua lettura",
    dateLabel: "Data di nascita",
    hourLabel: "Ora", hourPrecisionLabel: "Precisione",
    optExact: "Nota (precisa)",
    optApprox: "Approssimativa",
    optUnknown: "Sconosciuta",
    optInterval: "Intervallo",
    timeLabel: "Ora",
    startLabel: "Dalle",
    endLabel: "Alle",
    placeLabel: "Luogo di nascita",
    placePlaceholder: "es. Roma, Italia",
    locateButton: "Trova questo luogo",
    personalSummary: "Personalizza — nome e domanda (opzionale)",
    firstNameLabel: "Nome",
    questionLabel: "La tua domanda",
    parentsSummary: "Genitori — lettura transgenerazionale (opzionale)",
    motherName: "Madre — nome",
    motherDate: "Madre — data",
    motherPlace: "Madre — luogo",
    fatherName: "Padre — nome",
    fatherDate: "Padre — data",
    fatherPlace: "Padre — luogo",
    submit: "Ricevi la mia lettura",
    progress: "Generazione in corso — calcolo e scrittura (1–2 minuti).",
    payTitle: "Mentre la tua lettura si prepara…",
    payText: "Puoi pagare subito, l'importo che vuoi: il prezzo è libero.",
    payButton: "Paga con SumUp →",
    payNote: "Pagamento sicuro SumUp. La lettura continua in parallelo — nulla si blocca.",
    viewerTitle: "La tua lettura",
    viewerHint: "È pronta: scaricala. Resta disponibile 30 giorni con il tuo link.",
    dlHtml: "HTML",
    dlMd: "Markdown",
    dlPdf: "PDF",
    proLink: "Accedi",
    placeConfirmed: "Luogo confermato",
    placeAuto: "Trovato automaticamente",
    placeNote: "Questo luogo sarà usato per calcolare il tuo tema.",
    placeFound: "Luogo trovato ✓",
    aiNoticeTitle: "Testo generato da un'intelligenza artificiale",
    aiNoticeText: "La tua lettura è scritta automaticamente dai tuoi dati di nascita, il cui calcolo è verificato. Nonostante i controlli automatici (inclusa una verifica da parte di un secondo modello), un'IA può sbagliare, fraintendere o inventare una sfumatura: è uno strumento di riflessione, non una verità, né una diagnosi, né una previsione di eventi.",
    aiConsent: "Ho letto e capito: questo testo è generato da un'IA e può contenere errori."
  },
  pt: {
    heroTag: "✦ Leitura personalizada",
    heroTitle: "Bem-vindo à <span>Lastro</span>.",
    lead: "O que o seu céu diz sobre você.",
    formTitle: "A sua leitura",
    dateLabel: "Data de nascimento",
    hourLabel: "Hora", hourPrecisionLabel: "Precisão",
    optExact: "Conhecida (exata)",
    optApprox: "Aproximada",
    optUnknown: "Desconhecida",
    optInterval: "Intervalo",
    timeLabel: "Hora",
    startLabel: "Início",
    endLabel: "Fim",
    placeLabel: "Local de nascimento",
    placePlaceholder: "ex. Lisboa, Portugal",
    locateButton: "Localizar este lugar",
    personalSummary: "Personalizar — nome e pergunta (opcional)",
    firstNameLabel: "Nome",
    questionLabel: "A sua pergunta",
    parentsSummary: "Pais — leitura transgeracional (opcional)",
    motherName: "Mãe — nome",
    motherDate: "Mãe — data",
    motherPlace: "Mãe — local",
    fatherName: "Pai — nome",
    fatherDate: "Pai — data",
    fatherPlace: "Pai — local",
    submit: "Receber a minha leitura",
    progress: "A gerar — cálculo e redação (1 a 2 minutos).",
    payTitle: "Enquanto a sua leitura é preparada…",
    payText: "Pode pagar agora, o valor que quiser: o preço é livre.",
    payButton: "Pagar com SumUp →",
    payNote: "Pagamento seguro SumUp. A sua leitura continua a ser gerada em paralelo — nada fica bloqueado.",
    viewerTitle: "A sua leitura",
    viewerHint: "Está pronta: descarregue-a. Fica disponível 30 dias com o seu link.",
    dlHtml: "HTML",
    dlMd: "Markdown",
    dlPdf: "PDF",
    proLink: "Entrar",
    placeConfirmed: "Local confirmado",
    placeAuto: "Localizado automaticamente",
    placeNote: "Este local será usado para calcular o seu tema.",
    placeFound: "Local encontrado ✓",
    aiNoticeTitle: "Texto gerado por inteligência artificial",
    aiNoticeText: "A sua leitura é redigida automaticamente a partir dos seus dados de nascimento, cujo cálculo é verificado. Apesar dos controlos automáticos (incluindo uma verificação por um segundo modelo), uma IA pode errar, interpretar mal ou inventar um matiz: é uma ferramenta de reflexão, não uma verdade, nem um diagnóstico, nem uma previsão de acontecimentos.",
    aiConsent: "Li e compreendi: este texto é gerado por uma IA e pode conter erros."
  },
  no: {
    heroTag: "✦ Personlig lesning",
    heroTitle: "Velkommen til <span>Lastro</span>.",
    lead: "Hva himmelen din sier om deg.",
    formTitle: "Lesningen din",
    dateLabel: "Fødselsdato",
    hourLabel: "Klokkeslett", hourPrecisionLabel: "Presisjon",
    optExact: "Kjent (nøyaktig)",
    optApprox: "Omtrentlig",
    optUnknown: "Ukjent",
    optInterval: "Intervall",
    timeLabel: "Klokkeslett",
    startLabel: "Fra",
    endLabel: "Til",
    placeLabel: "Fødested",
    placePlaceholder: "f.eks. Oslo, Norge",
    locateButton: "Finn dette stedet",
    personalSummary: "Tilpass — fornavn og spørsmål (valgfritt)",
    firstNameLabel: "Fornavn",
    questionLabel: "Spørsmålet ditt",
    parentsSummary: "Foreldre — transgenerasjonell lesning (valgfritt)",
    motherName: "Mor — navn",
    motherDate: "Mor — dato",
    motherPlace: "Mor — sted",
    fatherName: "Far — navn",
    fatherDate: "Far — dato",
    fatherPlace: "Far — sted",
    submit: "Få lesningen min",
    progress: "Genererer — beregning og tekst (1–2 minutter).",
    payTitle: "Mens lesningen din forberedes …",
    payText: "Du kan betale nå, med det beløpet du ønsker: prisen er fri.",
    payButton: "Betal med SumUp →",
    payNote: "Sikker betaling via SumUp. Lesningen fortsetter i bakgrunnen — ingenting blokkeres.",
    viewerTitle: "Lesningen din",
    viewerHint: "Den er klar: last den ned. Den er tilgjengelig i 30 dager med lenken din.",
    dlHtml: "HTML",
    dlMd: "Markdown",
    dlPdf: "PDF",
    proLink: "Logg inn",
    placeConfirmed: "Stedet er bekreftet",
    placeAuto: "Funnet automatisk",
    placeNote: "Dette stedet brukes til å beregne horoskopet ditt.",
    placeFound: "Sted funnet ✓",
    aiNoticeTitle: "Tekst generert av kunstig intelligens",
    aiNoticeText: "Lesningen din skrives automatisk fra fødselsdataene dine, der beregningen er verifisert. Til tross for automatiske kontroller (inkludert en kontroll fra en annen modell) kan en KI ta feil, mistolke eller finne på en nyanse: det er et verktøy for refleksjon, ikke en sannhet, ikke en diagnose og ikke en forutsigelse av hendelser.",
    aiConsent: "Jeg har lest og forstått: denne teksten er laget av en KI og kan inneholde feil."
  },
  da: {
    heroTag: "✦ Personlig læsning",
    heroTitle: "Velkommen til <span>Lastro</span>.",
    lead: "Hvad din himmel siger om dig.",
    formTitle: "Din læsning",
    dateLabel: "Fødselsdato",
    hourLabel: "Klokkeslæt", hourPrecisionLabel: "Præcision",
    optExact: "Kendt (præcis)",
    optApprox: "Omtrentlig",
    optUnknown: "Ukendt",
    optInterval: "Interval",
    timeLabel: "Klokkeslæt",
    startLabel: "Fra",
    endLabel: "Til",
    placeLabel: "Fødested",
    placePlaceholder: "f.eks. København, Danmark",
    locateButton: "Find dette sted",
    personalSummary: "Tilpas — fornavn og spørgsmål (valgfrit)",
    firstNameLabel: "Fornavn",
    questionLabel: "Dit spørgsmål",
    parentsSummary: "Forældre — transgenerationel læsning (valgfrit)",
    motherName: "Mor — navn",
    motherDate: "Mor — dato",
    motherPlace: "Mor — sted",
    fatherName: "Far — navn",
    fatherDate: "Far — dato",
    fatherPlace: "Far — sted",
    submit: "Få min læsning",
    progress: "Genererer — beregning og tekst (1–2 minutter).",
    payTitle: "Mens din læsning forberedes …",
    payText: "Du kan betale nu, med det beløb du ønsker: prisen er fri.",
    payButton: "Betal med SumUp →",
    payNote: "Sikker betaling via SumUp. Din læsning fortsætter i baggrunden — intet blokeres.",
    viewerTitle: "Din læsning",
    viewerHint: "Den er klar: download den. Den er tilgængelig i 30 dage med dit link.",
    dlHtml: "HTML",
    dlMd: "Markdown",
    dlPdf: "PDF",
    proLink: "Log ind",
    placeConfirmed: "Sted bekræftet",
    placeAuto: "Fundet automatisk",
    placeNote: "Dette sted bruges til at beregne dit horoskop.",
    placeFound: "Sted fundet ✓",
    aiNoticeTitle: "Tekst genereret af kunstig intelligens",
    aiNoticeText: "Din læsning skrives automatisk ud fra dine fødselsdata, hvis beregning er verificeret. På trods af automatiske kontroller (herunder en kontrol fra en anden model) kan en AI tage fejl, fejltolke eller opfinde en nuance: det er et værktøj til refleksion, ikke en sandhed, ikke en diagnose og ikke en forudsigelse af begivenheder.",
    aiConsent: "Jeg har læst og forstået: denne tekst er genereret af en AI og kan indeholde fejl."
  },
  nl: {
    heroTag: "✦ Persoonlijke lezing",
    heroTitle: "Welkom bij <span>Lastro</span>.",
    lead: "Wat jouw hemel over je zegt.",
    formTitle: "Jouw lezing",
    dateLabel: "Geboortedatum",
    hourLabel: "Tijd", hourPrecisionLabel: "Precisie",
    optExact: "Bekend (exact)",
    optApprox: "Bij benadering",
    optUnknown: "Onbekend",
    optInterval: "Interval",
    timeLabel: "Tijd",
    startLabel: "Van",
    endLabel: "Tot",
    placeLabel: "Geboorteplaats",
    placePlaceholder: "bv. Amsterdam, Nederland",
    locateButton: "Deze plaats zoeken",
    personalSummary: "Personaliseren — voornaam en vraag (optioneel)",
    firstNameLabel: "Voornaam",
    questionLabel: "Jouw vraag",
    parentsSummary: "Ouders — transgenerationele lezing (optioneel)",
    motherName: "Moeder — naam",
    motherDate: "Moeder — datum",
    motherPlace: "Moeder — plaats",
    fatherName: "Vader — naam",
    fatherDate: "Vader — datum",
    fatherPlace: "Vader — plaats",
    submit: "Mijn lezing ontvangen",
    progress: "Bezig met genereren — berekening en tekst (1–2 minuten).",
    payTitle: "Terwijl jouw lezing wordt voorbereid …",
    payText: "Je kunt nu betalen, het bedrag dat je wilt: de prijs is vrij.",
    payButton: "Betalen met SumUp →",
    payNote: "Veilige betaling via SumUp. Jouw lezing wordt op de achtergrond verder gemaakt — niets wordt geblokkeerd.",
    viewerTitle: "Jouw lezing",
    viewerHint: "Ze is klaar: download ze. Met je link blijft ze 30 dagen beschikbaar.",
    dlHtml: "HTML",
    dlMd: "Markdown",
    dlPdf: "PDF",
    proLink: "Inloggen",
    placeConfirmed: "Plaats bevestigd",
    placeAuto: "Automatisch gevonden",
    placeNote: "Deze plaats wordt gebruikt om jouw kaart te berekenen.",
    placeFound: "Plaats gevonden ✓"
  }
};

const UI_EXTRA = {
  fr: {
    pdfHint: "Ouvre la fenêtre d'impression : choisissez « Enregistrer au format PDF ». Décochez « En-têtes et pieds de page » pour retirer la date et l'adresse.", backShort: "← Ma lecture", backToReading: "← Retour à ma lecture", authTitle: "Connexion", authSubmit: "Se connecter", emailLabel: "E-mail", passwordLabel: "Mot de passe",
    llmUnavailable: "La rédaction est momentanément indisponible : aucune lecture ne peut être commandée pour l'instant, et vous ne serez pas débité. Merci de réessayer dans quelques minutes.",
    payTitle: "Régler votre lecture", payText: "Choisissez librement le montant, puis payez ici même : carte bancaire, Apple Pay ou Google Pay.",
    payAmount: "Montant libre", payRange: "Le montant minimum est de 5 €.", payHint: "Minimum 5 € — vous pouvez donner plus si vous le souhaitez.", findSummary: "Vous avez déjà payé ? Retrouver ma lecture", findReferenceLabel: "Numéro de commande", findEmailLabel: "E-mail utilisé au paiement", findSubmit: "Renvoyer le lien", findSent: "Si une commande correspond à ces informations, le lien vient d'être envoyé par e-mail.", deliveryKeep: "Votre lecture est conservée 30 jours : gardez ce lien pour la retrouver ensuite.", deliveryCopy: "Copier le lien", deliveryCopied: "Lien copié ✓", deliveryOrderLabel: "Numéro de commande", deliveryEmailed: "Le lien vous a aussi été envoyé par e-mail.", deliveryDelete: "Supprimer ma lecture", recoveryPending: "Votre lecture est en cours de rédaction. Rechargez la page dans un instant.", recoveryFailed: "La rédaction a échoué. Vous pouvez la relancer sans repayer.", recoveryRetry: "Relancer la rédaction", recoveryUnknown: "Ce lien est inconnu ou a expiré.", testCodeToggle: "J'ai un code de test", testCodeLabel: "Code de test", testCodePlaceholder: "Collez votre code", testCodeHint: "Ce code remplace le paiement (usage interne uniquement).", testCodeApplied: "Lecture offerte avec le code de test.", payStart: "Continuer vers le paiement →", payPreparing: "Préparation du paiement…",
    payConfirmed: "Paiement confirmé ✓ — génération de votre lecture…", payContinue: "Paiement effectué ? Continuer →",
    payNote: "Paiement sécurisé par Stripe. Vos données bancaires ne passent jamais par nos serveurs ; la lecture est générée dès la confirmation du paiement. Votre lecture est conservée 30 jours, puis supprimée." },
  en: {
    pdfHint: "Opens the print window: choose “Save as PDF”. Uncheck “Headers and footers” to remove the date and the address.", backShort: "← My reading", backToReading: "← Back to my reading", authTitle: "Sign in", authSubmit: "Sign in", emailLabel: "Email", passwordLabel: "Password",
    llmUnavailable: "Writing is temporarily unavailable: no reading can be ordered right now, and you will not be charged. Please try again in a few minutes.",
    payTitle: "Pay for your reading", payText: "Choose any amount, then pay right here: card, Apple Pay or Google Pay.",
    payAmount: "Amount (free)", payRange: "The minimum amount is €5.", payHint: "Minimum €5 — you are welcome to give more.", findSummary: "Already paid? Find my reading", findReferenceLabel: "Order number", findEmailLabel: "Email used for payment", findSubmit: "Resend the link", findSent: "If an order matches this information, the link has just been emailed to you.", deliveryKeep: "Your reading is kept for 30 days: save this link to find it again.", deliveryCopy: "Copy the link", deliveryCopied: "Link copied ✓", deliveryOrderLabel: "Order number", deliveryEmailed: "The link has also been sent to you by email.", deliveryDelete: "Delete my reading", recoveryPending: "Your reading is being written. Reload the page in a moment.", recoveryFailed: "Writing failed. You can start it again without paying.", recoveryRetry: "Restart the writing", recoveryUnknown: "This link is unknown or has expired.", testCodeToggle: "I have a test code", testCodeLabel: "Test code", testCodePlaceholder: "Paste your code", testCodeHint: "This code replaces the payment (internal use only).", testCodeApplied: "Reading provided free with the test code.", payStart: "Continue to payment →", payPreparing: "Preparing the payment…",
    payConfirmed: "Payment confirmed ✓ — creating your reading…", payContinue: "Payment done? Continue →",
    payNote: "Secure payment by Stripe. Your card details never pass through our servers; your reading is created as soon as the payment is confirmed. Your reading is kept for 30 days, then deleted." },
  de: {
    pdfHint: "Öffnet das Druckfenster: wähle „Als PDF speichern“. Deaktiviere „Kopf- und Fußzeilen“, um Datum und Adresse zu entfernen.", backShort: "← Meine Deutung", backToReading: "← Zurück zu meiner Deutung", authTitle: "Anmelden", authSubmit: "Anmelden", emailLabel: "E-Mail", passwordLabel: "Passwort",
    llmUnavailable: "Die Texterstellung ist vorübergehend nicht verfügbar: Derzeit kann keine Lesung bestellt werden, und es wird nichts berechnet. Bitte versuchen Sie es in einigen Minuten erneut.",
    payTitle: "Deine Deutung bezahlen", payText: "Wähle den Betrag frei und zahle direkt hier: Karte, Apple Pay oder Google Pay.",
    payAmount: "Freier Betrag", payRange: "Der Mindestbetrag beträgt 5 €.", payHint: "Mindestens 5 € — Sie dürfen gerne mehr geben.", findSummary: "Schon bezahlt? Meine Lesung finden", findReferenceLabel: "Bestellnummer", findEmailLabel: "Bei der Zahlung verwendete E-Mail", findSubmit: "Link erneut senden", findSent: "Wenn eine Bestellung zu diesen Angaben passt, wurde der Link soeben per E-Mail verschickt.", deliveryKeep: "Deine Lesung wird 30 Tage aufbewahrt: Speichere diesen Link, um sie wiederzufinden.", deliveryCopy: "Link kopieren", deliveryCopied: "Link kopiert ✓", deliveryOrderLabel: "Bestellnummer", deliveryEmailed: "Der Link wurde dir auch per E-Mail geschickt.", deliveryDelete: "Meine Lesung löschen", recoveryPending: "Deine Lesung wird gerade verfasst. Lade die Seite gleich neu.", recoveryFailed: "Das Verfassen ist fehlgeschlagen. Du kannst es ohne erneute Zahlung neu starten.", recoveryRetry: "Verfassen neu starten", recoveryUnknown: "Dieser Link ist unbekannt oder abgelaufen.", testCodeToggle: "Ich habe einen Testcode", testCodeLabel: "Testcode", testCodePlaceholder: "Code einfügen", testCodeHint: "Dieser Code ersetzt die Zahlung (nur intern).", testCodeApplied: "Lesung mit Testcode kostenlos erstellt.", payStart: "Weiter zur Zahlung →", payPreparing: "Zahlung wird vorbereitet …",
    payConfirmed: "Zahlung bestätigt ✓ — deine Deutung wird erstellt …", payContinue: "Zahlung erledigt? Weiter →",
    payNote: "Sichere Zahlung über Stripe. Deine Kartendaten laufen nie über unsere Server; die Deutung wird nach Bestätigung der Zahlung erstellt. Deine Lesung wird 30 Tage aufbewahrt und dann gelöscht." },
  es: {
    pdfHint: "Abre la ventana de impresión: elige «Guardar como PDF». Desmarca «Encabezados y pies de página» para quitar la fecha y la dirección.", backShort: "← Mi lectura", backToReading: "← Volver a mi lectura", authTitle: "Iniciar sesión", authSubmit: "Iniciar sesión", emailLabel: "Correo electrónico", passwordLabel: "Contraseña",
    llmUnavailable: "La redacción no está disponible en este momento: ahora mismo no se puede pedir ninguna lectura y no se le cobrará. Vuelva a intentarlo en unos minutos.",
    payTitle: "Pagar tu lectura", payText: "Elige libremente el importe y paga aquí mismo: tarjeta, Apple Pay o Google Pay.",
    payAmount: "Importe libre", payRange: "El importe mínimo es de 5 €.", payHint: "Mínimo 5 € — puedes dar más si quieres.", findSummary: "¿Ya has pagado? Recuperar mi lectura", findReferenceLabel: "Número de pedido", findEmailLabel: "Correo usado en el pago", findSubmit: "Reenviar el enlace", findSent: "Si un pedido coincide con estos datos, el enlace acaba de enviarse por correo.", deliveryKeep: "Tu lectura se conserva 30 días: guarda este enlace para encontrarla después.", deliveryCopy: "Copiar el enlace", deliveryCopied: "Enlace copiado ✓", deliveryOrderLabel: "Número de pedido", deliveryEmailed: "El enlace también se te ha enviado por correo.", deliveryDelete: "Eliminar mi lectura", recoveryPending: "Tu lectura se está redactando. Recarga la página en un momento.", recoveryFailed: "La redacción ha fallado. Puedes reiniciarla sin volver a pagar.", recoveryRetry: "Reiniciar la redacción", recoveryUnknown: "Este enlace es desconocido o ha caducado.", testCodeToggle: "Tengo un código de prueba", testCodeLabel: "Código de prueba", testCodePlaceholder: "Pega tu código", testCodeHint: "Este código sustituye el pago (uso interno).", testCodeApplied: "Lectura gratuita con el código de prueba.", payStart: "Continuar al pago →", payPreparing: "Preparando el pago…",
    payConfirmed: "Pago confirmado ✓ — generando tu lectura…", payContinue: "¿Pago realizado? Continuar →",
    payNote: "Pago seguro con Stripe. Los datos de tu tarjeta nunca pasan por nuestros servidores; la lectura se genera al confirmarse el pago. Tu lectura se conserva 30 días y luego se elimina." },
  it: {
    pdfHint: "Apre la finestra di stampa: scegli «Salva come PDF». Deseleziona «Intestazioni e piè di pagina» per togliere data e indirizzo.", backShort: "← La mia lettura", backToReading: "← Torna alla mia lettura", authTitle: "Accedi", authSubmit: "Accedi", emailLabel: "E-mail", passwordLabel: "Password",
    llmUnavailable: "La scrittura non è disponibile al momento: ora non è possibile ordinare una lettura e non le verrà addebitato nulla. Riprovi tra qualche minuto.",
    payTitle: "Paga la tua lettura", payText: "Scegli liberamente l'importo e paga qui: carta, Apple Pay o Google Pay.",
    payAmount: "Importo libero", payRange: "L'importo minimo è di 5 €.", payHint: "Minimo 5 € — puoi dare di più se vuoi.", findSummary: "Hai già pagato? Ritrova la mia lettura", findReferenceLabel: "Numero d'ordine", findEmailLabel: "E-mail usata per il pagamento", findSubmit: "Invia di nuovo il link", findSent: "Se un ordine corrisponde a questi dati, il link è appena stato inviato per e-mail.", deliveryKeep: "La tua lettura è conservata 30 giorni: salva questo link per ritrovarla.", deliveryCopy: "Copia il link", deliveryCopied: "Link copiato ✓", deliveryOrderLabel: "Numero d'ordine", deliveryEmailed: "Il link ti è stato inviato anche per e-mail.", deliveryDelete: "Eliminare la mia lettura", recoveryPending: "La tua lettura è in scrittura. Ricarica la pagina tra un istante.", recoveryFailed: "La scrittura non è riuscita. Puoi riavviarla senza pagare di nuovo.", recoveryRetry: "Riavvia la scrittura", recoveryUnknown: "Questo link è sconosciuto o scaduto.", testCodeToggle: "Ho un codice di test", testCodeLabel: "Codice di test", testCodePlaceholder: "Incolla il codice", testCodeHint: "Questo codice sostituisce il pagamento (solo uso interno).", testCodeApplied: "Lettura gratuita con il codice di test.", payStart: "Vai al pagamento →", payPreparing: "Preparazione del pagamento…",
    payConfirmed: "Pagamento confermato ✓ — stiamo creando la tua lettura…", payContinue: "Pagamento fatto? Continua →",
    payNote: "Pagamento sicuro con Stripe. I dati della carta non passano mai dai nostri server; la lettura viene creata alla conferma del pagamento. La tua lettura è conservata 30 giorni, poi eliminata." },
  pt: {
    pdfHint: "Abre a janela de impressão: escolha «Guardar como PDF». Desmarque «Cabeçalhos e rodapés» para remover a data e o endereço.", backShort: "← A minha leitura", backToReading: "← Voltar à minha leitura", authTitle: "Entrar", authSubmit: "Entrar", emailLabel: "E-mail", passwordLabel: "Palavra-passe",
    llmUnavailable: "A redação está momentaneamente indisponível: neste momento não é possível encomendar uma leitura e não lhe será cobrado nada. Tente novamente dentro de alguns minutos.",
    payTitle: "Pagar a sua leitura", payText: "Escolha livremente o valor e pague aqui mesmo: cartão, Apple Pay ou Google Pay.",
    payAmount: "Valor livre", payRange: "O valor mínimo é de 5 €.", payHint: "Mínimo 5 € — pode dar mais se quiser.", findSummary: "Já pagou? Recuperar a minha leitura", findReferenceLabel: "Número do pedido", findEmailLabel: "E-mail usado no pagamento", findSubmit: "Reenviar o link", findSent: "Se um pedido corresponder a estes dados, o link acabou de ser enviado por e-mail.", deliveryKeep: "A sua leitura é conservada 30 dias: guarde este link para a encontrar depois.", deliveryCopy: "Copiar o link", deliveryCopied: "Link copiado ✓", deliveryOrderLabel: "Número do pedido", deliveryEmailed: "O link também foi enviado por e-mail.", deliveryDelete: "Eliminar a minha leitura", recoveryPending: "A sua leitura está a ser escrita. Recarregue a página dentro de instantes.", recoveryFailed: "A escrita falhou. Pode reiniciá-la sem pagar de novo.", recoveryRetry: "Reiniciar a escrita", recoveryUnknown: "Este link é desconhecido ou expirou.", testCodeToggle: "Tenho um código de teste", testCodeLabel: "Código de teste", testCodePlaceholder: "Cole o seu código", testCodeHint: "Este código substitui o pagamento (uso interno).", testCodeApplied: "Leitura gratuita com o código de teste.", payStart: "Continuar para o pagamento →", payPreparing: "A preparar o pagamento…",
    payConfirmed: "Pagamento confirmado ✓ — a gerar a sua leitura…", payContinue: "Pagamento feito? Continuar →",
    payNote: "Pagamento seguro pela Stripe. Os dados do cartão nunca passam pelos nossos servidores; a leitura é gerada quando o pagamento é confirmado. A sua leitura é conservada 30 dias e depois eliminada." },
  no: {
    pdfHint: "Åpner utskriftsvinduet: velg «Lagre som PDF». Fjern haken for «Topp- og bunntekst» for å fjerne dato og adresse.", backShort: "← Lesningen min", backToReading: "← Tilbake til lesningen min", authTitle: "Logg inn", authSubmit: "Logg inn", emailLabel: "E-post", passwordLabel: "Passord",
    llmUnavailable: "Teksten er midlertidig utilgjengelig: ingen lesning kan bestilles akkurat nå, og du blir ikke belastet. Prøv igjen om noen minutter.",
    payTitle: "Betal for lesningen din", payText: "Velg beløpet fritt og betal her: kort, Apple Pay eller Google Pay.",
    payAmount: "Fritt beløp", payRange: "Minimumsbeløpet er 5 €.", payHint: "Minimum 5 € — du kan gjerne gi mer.", findSummary: "Har du allerede betalt? Finn lesningen min", findReferenceLabel: "Ordrenummer", findEmailLabel: "E-post brukt ved betaling", findSubmit: "Send lenken på nytt", findSent: "Hvis en ordre samsvarer med disse opplysningene, er lenken nettopp sendt på e-post.", deliveryKeep: "Lesningen din oppbevares i 30 dager: ta vare på denne lenken for å finne den igjen.", deliveryCopy: "Kopier lenken", deliveryCopied: "Lenke kopiert ✓", deliveryOrderLabel: "Ordrenummer", deliveryEmailed: "Lenken er også sendt deg på e-post.", deliveryDelete: "Slett lesningen min", recoveryPending: "Lesningen din skrives nå. Last siden på nytt om litt.", recoveryFailed: "Skrivingen mislyktes. Du kan starte den på nytt uten å betale.", recoveryRetry: "Start skrivingen på nytt", recoveryUnknown: "Denne lenken er ukjent eller utløpt.", testCodeToggle: "Jeg har en testkode", testCodeLabel: "Testkode", testCodePlaceholder: "Lim inn koden", testCodeHint: "Denne koden erstatter betalingen (kun internt bruk).", testCodeApplied: "Lesningen er gratis med testkoden.", payStart: "Gå til betaling →", payPreparing: "Forbereder betalingen …",
    payConfirmed: "Betaling bekreftet ✓ — lesningen din lages …", payContinue: "Betalt? Fortsett →",
    payNote: "Sikker betaling via Stripe. Kortopplysningene går aldri via våre servere; lesningen lages så snart betalingen er bekreftet. Lesningen din oppbevares i 30 dager og slettes deretter." },
  da: {
    pdfHint: "Åbner udskriftsvinduet: vælg «Gem som PDF». Fjern markeringen i «Sidehoved og sidefod» for at fjerne dato og adresse.", backShort: "← Min læsning", backToReading: "← Tilbage til min læsning", authTitle: "Log ind", authSubmit: "Log ind", emailLabel: "E-mail", passwordLabel: "Adgangskode",
    llmUnavailable: "Teksten er midlertidigt utilgængelig: der kan ikke bestilles en læsning lige nu, og du bliver ikke opkrævet betaling. Prøv igen om et par minutter.",
    payTitle: "Betal for din læsning", payText: "Vælg beløbet frit og betal her: kort, Apple Pay eller Google Pay.",
    payAmount: "Frit beløb", payRange: "Minimumsbeløbet er 5 €.", payHint: "Minimum 5 € — du er velkommen til at give mere.", findSummary: "Har du allerede betalt? Find min læsning", findReferenceLabel: "Ordrenummer", findEmailLabel: "E-mail brugt ved betaling", findSubmit: "Send linket igen", findSent: "Hvis en ordre matcher disse oplysninger, er linket netop sendt på e-mail.", deliveryKeep: "Din læsning opbevares i 30 dage: gem dette link for at finde den igen.", deliveryCopy: "Kopiér linket", deliveryCopied: "Link kopieret ✓", deliveryOrderLabel: "Ordrenummer", deliveryEmailed: "Linket er også sendt til dig på e-mail.", deliveryDelete: "Slet min læsning", recoveryPending: "Din læsning skrives lige nu. Genindlæs siden om et øjeblik.", recoveryFailed: "Skrivningen mislykkedes. Du kan starte den igen uden at betale.", recoveryRetry: "Start skrivningen igen", recoveryUnknown: "Dette link er ukendt eller udløbet.", testCodeToggle: "Jeg har en testkode", testCodeLabel: "Testkode", testCodePlaceholder: "Indsæt din kode", testCodeHint: "Denne kode erstatter betalingen (kun intern brug).", testCodeApplied: "Læsningen er gratis med testkoden.", payStart: "Gå til betaling →", payPreparing: "Forbereder betalingen …",
    payConfirmed: "Betaling bekræftet ✓ — din læsning laves …", payContinue: "Betalt? Fortsæt →",
    payNote: "Sikker betaling via Stripe. Dine kortoplysninger går aldrig gennem vores servere; læsningen laves, så snart betalingen er bekræftet. Din læsning opbevares i 30 dage og slettes derefter." },
  nl: {
    pdfHint: "Opent het afdrukvenster: kies ‘Opslaan als pdf’. Vink ‘Kop- en voetteksten’ uit om datum en adres te verwijderen.", backShort: "← Mijn lezing", backToReading: "← Terug naar mijn lezing", authTitle: "Inloggen", authSubmit: "Inloggen", emailLabel: "E-mail", passwordLabel: "Wachtwoord",
    llmUnavailable: "Het schrijven is tijdelijk niet beschikbaar: er kan nu geen lezing worden besteld en u wordt niet belast. Probeer het over enkele minuten opnieuw.",
    payTitle: "Jouw lezing betalen", payText: "Kies vrij het bedrag en betaal hier: kaart, Apple Pay of Google Pay.",
    payAmount: "Vrij bedrag", payRange: "Het minimumbedrag is € 5.", payHint: "Minimaal € 5 — je mag gerust meer geven.", findSummary: "Al betaald? Mijn lezing terugvinden", findReferenceLabel: "Ordernummer", findEmailLabel: "E-mailadres gebruikt bij betaling", findSubmit: "Link opnieuw versturen", findSent: "Als een bestelling overeenkomt met deze gegevens, is de link zojuist per e-mail verzonden.", deliveryKeep: "Je lezing wordt 30 dagen bewaard: bewaar deze link om haar terug te vinden.", deliveryCopy: "Link kopiëren", deliveryCopied: "Link gekopieerd ✓", deliveryOrderLabel: "Ordernummer", deliveryEmailed: "De link is ook per e-mail naar je verzonden.", deliveryDelete: "Mijn lezing verwijderen", recoveryPending: "Je lezing wordt geschreven. Herlaad de pagina zo meteen.", recoveryFailed: "Het schrijven is mislukt. Je kunt het opnieuw starten zonder te betalen.", recoveryRetry: "Schrijven opnieuw starten", recoveryUnknown: "Deze link is onbekend of verlopen.", testCodeToggle: "Ik heb een testcode", testCodeLabel: "Testcode", testCodePlaceholder: "Plak je code", testCodeHint: "Deze code vervangt de betaling (alleen intern gebruik).", testCodeApplied: "Lezing gratis met de testcode.", payStart: "Doorgaan naar betaling →", payPreparing: "Betaling wordt voorbereid …",
    payConfirmed: "Betaling bevestigd ✓ — je lezing wordt gemaakt …", payContinue: "Betaald? Doorgaan →",
    payNote: "Veilige betaling via Stripe. Je kaartgegevens gaan nooit via onze servers; de lezing wordt gemaakt zodra de betaling is bevestigd. Je lezing wordt 30 dagen bewaard en daarna verwijderd.",
    aiNoticeTitle: "Tekst gegenereerd door kunstmatige intelligentie",
    aiNoticeText: "Je lezing wordt automatisch geschreven op basis van je geboortegegevens, waarvan de berekening geverifieerd is. Ondanks automatische controles (inclusief een controle door een tweede model) kan een AI zich vergissen, verkeerd interpreteren of een nuance verzinnen: het is een hulpmiddel om over na te denken, geen waarheid, geen diagnose en geen voorspelling van gebeurtenissen.",
    aiConsent: "Ik heb gelezen en begrepen: deze tekst is gegenereerd door een AI en kan fouten bevatten." }
};

// Textes de l'autocomplétion du lieu de naissance (9 langues).
const PLACE_STRINGS = {
  fr: {
    suggestionsTitle: "Villes proposées",
    approximate: "Aucun résultat exact — voici les lieux les plus proches :",
    none: "Aucun lieu trouvé. Vérifiez l'orthographe ou ajoutez le pays (ex. « Valence, Espagne »).",
    mapNote: "Déplacez le repère si le lieu n'est pas exact.",
    pinMoved: "Position ajustée — {distance} du point d'origine.",
    pinReset: "Revenir au point de départ",
    pinFar: "Déplacement de plus de 30 km : le fuseau horaire ({zone}) n'est pas recalculé. Si la ville était fausse, choisissez plutôt la bonne ville dans la liste.",
    calcPoint: "Point utilisé pour le calcul :",
    calcZone: "Heure de naissance interprétée en {zone}"
  },
  en: {
    suggestionsTitle: "Suggested places",
    approximate: "No exact match — closest places:",
    none: "No place found. Check the spelling or add the country (e.g. “Valencia, Spain”).",
    mapNote: "Drag the pin if the place is not exact.",
    pinMoved: "Position adjusted — {distance} from the original point.",
    pinReset: "Reset to the original point",
    pinFar: "Moved more than 30 km: the time zone ({zone}) is not recalculated. If the city was wrong, pick the right city from the list instead.",
    calcPoint: "Point used for the calculation:",
    calcZone: "Birth time interpreted in {zone}"
  },
  de: {
    suggestionsTitle: "Vorgeschlagene Orte",
    approximate: "Kein genauer Treffer — nächstgelegene Orte:",
    none: "Kein Ort gefunden. Prüfe die Schreibweise oder ergänze das Land (z. B. „Valencia, Spanien“).",
    mapNote: "Verschiebe die Markierung, wenn der Ort nicht genau ist.",
    pinMoved: "Position angepasst — {distance} vom ursprünglichen Punkt.",
    pinReset: "Zum Ausgangspunkt zurückkehren",
    pinFar: "Mehr als 30 km verschoben: Die Zeitzone ({zone}) wird nicht neu berechnet. Wenn die Stadt falsch war, wähle sie stattdessen aus der Liste.",
    calcPoint: "Für die Berechnung verwendeter Punkt:",
    calcZone: "Geburtszeit interpretiert in {zone}"
  },
  es: {
    suggestionsTitle: "Lugares sugeridos",
    approximate: "Sin coincidencia exacta: lugares más cercanos:",
    none: "No se ha encontrado el lugar. Comprueba la ortografía o añade el país (p. ej. «Valencia, España»).",
    mapNote: "Mueve el marcador si el lugar no es exacto.",
    pinMoved: "Posición ajustada — {distance} del punto original.",
    pinReset: "Volver al punto de partida",
    pinFar: "Desplazamiento de más de 30 km: la zona horaria ({zone}) no se recalcula. Si la ciudad era incorrecta, elige la ciudad correcta en la lista.",
    calcPoint: "Punto utilizado para el cálculo:",
    calcZone: "Hora de nacimiento interpretada en {zone}"
  },
  it: {
    suggestionsTitle: "Luoghi suggeriti",
    approximate: "Nessuna corrispondenza esatta: luoghi più vicini:",
    none: "Nessun luogo trovato. Controlla l'ortografia o aggiungi il paese (es. «Valencia, Spagna»).",
    mapNote: "Sposta il segnaposto se il luogo non è esatto.",
    pinMoved: "Posizione regolata — {distance} dal punto originale.",
    pinReset: "Torna al punto di partenza",
    pinFar: "Spostamento di oltre 30 km: il fuso orario ({zone}) non viene ricalcolato. Se la città era sbagliata, scegli quella giusta dall'elenco.",
    calcPoint: "Punto usato per il calcolo:",
    calcZone: "Ora di nascita interpretata in {zone}"
  },
  pt: {
    suggestionsTitle: "Locais sugeridos",
    approximate: "Sem correspondência exata — locais mais próximos:",
    none: "Nenhum local encontrado. Verifique a grafia ou acrescente o país (ex. «Valência, Espanha»).",
    mapNote: "Mova o marcador se o local não estiver exato.",
    pinMoved: "Posição ajustada — {distance} do ponto original.",
    pinReset: "Voltar ao ponto de partida",
    pinFar: "Deslocamento superior a 30 km: o fuso horário ({zone}) não é recalculado. Se a cidade estava errada, escolha a cidade correta na lista.",
    calcPoint: "Ponto utilizado no cálculo:",
    calcZone: "Hora de nascimento interpretada em {zone}"
  },
  no: {
    suggestionsTitle: "Foreslåtte steder",
    approximate: "Ingen eksakt treff — nærmeste steder:",
    none: "Fant ingen sted. Sjekk skrivemåten eller legg til landet (f.eks. «Valencia, Spania»).",
    mapNote: "Flytt markøren hvis stedet ikke er nøyaktig.",
    pinMoved: "Posisjon justert — {distance} fra utgangspunktet.",
    pinReset: "Tilbake til utgangspunktet",
    pinFar: "Flyttet mer enn 30 km: tidssonen ({zone}) beregnes ikke på nytt. Hvis byen var feil, velg riktig by fra listen.",
    calcPoint: "Punktet som brukes i beregningen:",
    calcZone: "Fødselstid tolket i {zone}"
  },
  da: {
    suggestionsTitle: "Foreslåede steder",
    approximate: "Ingen præcis matchning — nærmeste steder:",
    none: "Ingen steder fundet. Tjek stavemåden, eller tilføj landet (fx «Valencia, Spanien»).",
    mapNote: "Flyt markøren, hvis stedet ikke er præcist.",
    pinMoved: "Position justeret — {distance} fra udgangspunktet.",
    pinReset: "Tilbage til udgangspunktet",
    pinFar: "Flyttet mere end 30 km: tidszonen ({zone}) genberegnes ikke. Hvis byen var forkert, vælg den rigtige by på listen.",
    calcPoint: "Punktet, der bruges til beregningen:",
    calcZone: "Fødselstid fortolket i {zone}"
  },
  nl: {
    suggestionsTitle: "Voorgestelde plaatsen",
    approximate: "Geen exacte match — dichtstbijzijnde plaatsen:",
    none: "Geen plaats gevonden. Controleer de spelling of voeg het land toe (bv. ‘Valencia, Spanje’).",
    mapNote: "Verplaats de markering als de plaats niet exact is.",
    pinMoved: "Positie aangepast — {distance} van het oorspronkelijke punt.",
    pinReset: "Terug naar het oorspronkelijke punt",
    pinFar: "Meer dan 30 km verplaatst: de tijdzone ({zone}) wordt niet opnieuw berekend. Als de stad fout was, kies dan de juiste stad uit de lijst.",
    calcPoint: "Punt gebruikt voor de berekening:",
    calcZone: "Geboortetijd geïnterpreteerd in {zone}"
  }
};

function currentLanguage() {
  return state.language ?? "fr";
}

function placeStrings() {
  return PLACE_STRINGS[currentLanguage()] ?? PLACE_STRINGS.fr;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function uiStrings() {
  const code = currentLanguage();
  return { ...(UI_STRINGS[code] ?? UI_STRINGS.fr), ...(UI_EXTRA[code] ?? UI_EXTRA.fr) };
}

function setNodeText(selector, text) {
  const node = $(selector);
  if (node && typeof text === "string") {
    node.textContent = text;
  }
}

function setFieldLabelIn(formSelector, name, text) {
  const input = document.querySelector(`${formSelector} [name="${name}"]`);
  const label = input?.closest("label");
  if (!label || typeof text !== "string") {
    return;
  }
  for (const node of label.childNodes) {
    if (node.nodeType === 3 && node.textContent.trim()) {
      node.textContent = `${text} `;
      return;
    }
  }
}

function setFieldLabel(name, text) {
  const input = document.querySelector(`#express-form [name="${name}"]`);
  const label = input?.closest("label");
  if (!label || typeof text !== "string") {
    return;
  }
  for (const node of label.childNodes) {
    if (node.nodeType === 3 && node.textContent.trim()) {
      node.textContent = `${text} `;
      return;
    }
  }
}

function applyUITranslations() {
  const t = uiStrings();
  setNodeText("#guest-hero .hero-tag", t.heroTag);
  const title = $("#guest-hero h1");
  if (title) {
    title.innerHTML = t.heroTitle;
  }
  setNodeText("#guest-hero .guest-lead", t.lead);
  setNodeText("#express-form > h3", t.formTitle);

  setFieldLabel("birthDate", t.dateLabel);
  setFieldLabel("timePrecision", t.hourPrecisionLabel);
  setFieldLabel("timeValue", t.timeLabel);
  setFieldLabel("timeStart", t.startLabel);
  setFieldLabel("timeEnd", t.endLabel);
  setFieldLabel("birthPlace", t.placeLabel);
  setFieldLabel("firstName", t.firstNameLabel);
  setFieldLabel("intention", t.questionLabel);
  setFieldLabel("motherName", t.motherName);
  setFieldLabel("motherBirthDate", t.motherDate);
  setFieldLabel("motherBirthPlace", t.motherPlace);
  setFieldLabel("fatherName", t.fatherName);
  setFieldLabel("fatherBirthDate", t.fatherDate);
  setFieldLabel("fatherBirthPlace", t.fatherPlace);

  const placeInput = document.querySelector('#express-form [name="birthPlace"]');
  if (placeInput) {
    placeInput.placeholder = t.placePlaceholder;
  }
  setNodeText("#express-resolve-place", t.locateButton);

  const optionalBlocks = $all("#express-form details.express-optional");
  const personalSummary = optionalBlocks[0]?.querySelector("summary");
  if (personalSummary) {
    personalSummary.textContent = t.personalSummary;
  }
  const parentsSummary = optionalBlocks[1]?.querySelector("summary");
  if (parentsSummary) {
    parentsSummary.textContent = t.parentsSummary;
  }

  const submit = $("#express-form button[type='submit']");
  if (submit && !submit.disabled) {
    submit.textContent = t.submit;
  }
  setNodeText("#express-progress", t.progress);
  setNodeText("#pay-title", t.payTitle);
  setNodeText("#pay-text", t.payText);
  setNodeText("#pay-amount-label", t.payAmount);
  setNodeText("#recover-summary", t.findSummary);
  setNodeText("#recover-reference-label", t.findReferenceLabel);
  setNodeText("#recover-email-label", t.findEmailLabel);
  setNodeText("#recover-submit", t.findSubmit);
  setNodeText("#pay-hint", t.payHint);
  setNodeText("#test-code-toggle", t.testCodeToggle);
  setNodeText("#test-code-label", t.testCodeLabel);
  setNodeText("#test-code-hint", t.testCodeHint);
  const testCodeField = $("#test-code");
  if (testCodeField) {
    testCodeField.placeholder = t.testCodePlaceholder;
  }
  setNodeText("#pay-start", t.payStart);
  setNodeText("#pay-continue", t.payContinue);
  setNodeText("#pay-note", t.payNote);
  setNodeText("#ai-notice-title", t.aiNoticeTitle);
  setNodeText("#ai-notice-text", t.aiNoticeText);
  setNodeText("#ai-consent-label", t.aiConsent);
  setNodeText("#express-viewer h3", t.viewerTitle);
  setNodeText("#express-ready-hint", t.viewerHint);
  setNodeText("#guest-download-html", t.dlHtml);
  setNodeText("#guest-download-md", t.dlMd);
  setNodeText("#guest-download-pdf", t.dlPdf);
  const pdfButton = $("#guest-download-pdf");
  if (pdfButton) {
    pdfButton.title = t.pdfHint;
  }
  setNodeText("#guest-pro-link", t.proLink);
  setNodeText("#guest-back", t.backShort);
  setNodeText("#auth-back", t.backToReading);
  setNodeText("#login-form h3", t.authTitle);
  setNodeText("#login-form button[type='submit']", t.authSubmit);
  setFieldLabelIn("#login-form", "email", t.emailLabel);
  setFieldLabelIn("#login-form", "password", t.passwordLabel);

  const precision = $("#express-precision");
  if (precision?.options?.length >= 4) {
    precision.options[0].textContent = t.optExact;
    precision.options[1].textContent = t.optApprox;
    precision.options[2].textContent = t.optUnknown;
    precision.options[3].textContent = t.optInterval;
  }
  document.documentElement.lang = currentLanguage();
}

function initLanguageSelector() {
  const select = $("#guest-language");
  if (!select) {
    return;
  }
  const stored = localStorage.getItem("lastro_lang");
  const rawBrowser = String(navigator.language ?? "").slice(0, 2).toLowerCase();
  const browser = rawBrowser === "nb" || rawBrowser === "nn" ? "no" : rawBrowser;
  const supported = LANGUAGES.map((entry) => entry.code);
  state.language = supported.includes(stored) ? stored : supported.includes(browser) ? browser : "fr";
  select.innerHTML = LANGUAGES.map(
    (entry) => `<option value="${entry.code}">${entry.flag} ${entry.label}</option>`
  ).join("");
  select.value = state.language;
  select.addEventListener("change", () => {
    state.language = select.value;
    localStorage.setItem("lastro_lang", state.language);
    applyUITranslations();
  });
  applyUITranslations();
}

const titles = {
  auth: "Compte",
  express: "Votre lecture",
  offre: "Offre & prix",
  profile: "Profil",
  people: "Personnes",
  relations: "Relations",
  natal: "Thème natal",
  analyses: "Analyses",
  history: "Historique",
  methods: "Méthodes",
  deliverables: "Dossier client",
  commerce: "Tarifs & crédits",
  admin: "Administration"
};

const relationshipLabels = {
  mother: "mère",
  father: "père",
  grandparent: "grand-parent",
  great_grandparent: "arrière-grand-parent",
  sibling: "frère/sœur",
  child: "enfant",
  partner: "partenaire",
  ex_partner: "ex-partenaire",
  friend: "ami",
  associate: "associé",
  other: "autre"
};

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function showMessage(text, isError = false) {
  const box = $("#message");
  box.textContent = text;
  box.hidden = false;
  box.classList.toggle("error", isError);
}

function asForm(target) {
  if (target?.tagName === "FORM") {
    return target;
  }
  const closestForm = target?.closest?.("form");
  if (closestForm?.tagName === "FORM") {
    return closestForm;
  }
  return null;
}

function formData(target) {
  const form = asForm(target);
  if (!form) {
    throw new Error("Formulaire introuvable pour cette action.");
  }
  return Object.fromEntries(new FormData(form).entries());
}

function formPayload(target) {
  const data = formData(target);
  if (data.resolvedPlace) {
    data.resolvedPlace = JSON.parse(data.resolvedPlace);
  }
  return data;
}

function field(form, name) {
  return form.elements.namedItem(name);
}

function captureFormValues(form) {
  return Object.fromEntries([...new FormData(form).entries()]);
}

function restoreFormValues(form, values) {
  for (const [name, value] of Object.entries(values)) {
    const input = field(form, name);
    if (input) {
      input.value = value;
    }
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error ?? "Erreur inconnue");
    Object.assign(error, payload);
    throw error;
  }
  return payload;
}

function personName(person) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || "Sans nom";
}

function birthFor(personId) {
  return state.dossier?.birthData?.find((entry) => entry.personId === personId);
}

const PLACE_FORM_FOR_DETAILS = {
  "express-place-details": "#express-form",
  "profile-place-details": "#profile-form",
  "person-place-details": "#person-form",
  "natal-place-details": "#natal-form"
};

function formForDetails(detailsId) {
  const selector = PLACE_FORM_FOR_DETAILS[detailsId];
  return selector ? $(selector) : null;
}

function distanceInMeters(from, to) {
  const radius = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const deltaLat = toRad(to.latitude - from.latitude);
  const deltaLon = toRad(to.longitude - from.longitude);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const kilometers = meters / 1000;
  const formatted = new Intl.NumberFormat(currentLanguage(), {
    maximumFractionDigits: kilometers < 10 ? 1 : 0
  }).format(kilometers);
  return `${formatted} km`;
}

function placeDetails(place) {
  if (!place) {
    return "";
  }
  const t = uiStrings();
  const p = placeStrings();
  const name = place.selectedName ?? place.name ?? "";
  const confidence = String(place?.confidence ?? "").toLowerCase();
  const label = confidence.includes("verified") ? t.placeConfirmed : confidence.includes("unverified") || confidence.includes("external") ? t.placeAuto : t.placeConfirmed;
  const latitude = Number(place.latitude ?? place.normalizedForCalculation?.latitude);
  const longitude = Number(place.longitude ?? place.normalizedForCalculation?.longitude);
  const map =
    Number.isFinite(latitude) && Number.isFinite(longitude)
      ? `<div class="place-map-wrap">
          <div class="place-mini-map" data-lat="${latitude}" data-lon="${longitude}" data-label="${escapeHtml(name)}"></div>
          <p class="place-map-note">${escapeHtml(p.mapNote)}</p>
          <p class="place-calc-point"></p>
          <p class="place-pin-status" hidden></p>
          <button type="button" class="secondary place-pin-reset" hidden>${escapeHtml(p.pinReset)}</button>
        </div>`
      : "";
  return `
    <article class="item">
      <div class="item-title">
        <span>✓ ${escapeHtml(name)}</span>
        <span class="badge badge-ok">${label}</span>
      </div>
      <div class="meta">${t.placeNote}</div>
      ${map}
    </article>
  `;
}

function showResolvedPlace(targetId, place) {
  const box = $(`#${targetId}`);
  box.innerHTML = placeDetails(place);
  box.hidden = false;
  initPlaceMaps(box, { place, form: formForDetails(targetId) });
}

// --- Carte de contrôle (Leaflet + fonds OpenStreetMap, aucune clé requise) ---
const LEAFLET_CDN = "https://unpkg.com/leaflet@1.9.4/dist";
let leafletLoader = null;

function loadLeaflet() {
  if (window.L) {
    return Promise.resolve(window.L);
  }
  if (leafletLoader) {
    return leafletLoader;
  }
  leafletLoader = new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${LEAFLET_CDN}/leaflet.css`;
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = `${LEAFLET_CDN}/leaflet.js`;
    script.async = true;
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error("Carte indisponible")));
    script.onerror = () => reject(new Error("Carte indisponible"));
    document.head.appendChild(script);
  });
  leafletLoader.catch(() => {
    leafletLoader = null;
  });
  return leafletLoader;
}

function placePinIcon(L) {
  return L.divIcon({
    className: "place-pin",
    html: '<span class="place-pin-dot"></span>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
}

async function initPlaceMaps(container, { place = null, form = null } = {}) {
  if (!container) {
    return;
  }
  const nodes = $all(".place-mini-map", container);
  if (!nodes.length) {
    return;
  }
  let L;
  try {
    L = await loadLeaflet();
  } catch {
    $all(".place-map-wrap", container).forEach((wrap) => {
      wrap.hidden = true;
    });
    return;
  }
  const p = placeStrings();
  nodes.forEach((node) => {
    if (node.dataset.mapReady === "1") {
      return;
    }
    const latitude = Number(node.dataset.lat);
    const longitude = Number(node.dataset.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }
    node.dataset.mapReady = "1";
    const label = node.dataset.label ?? "";
    const map = L.map(node, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
    map.setView([latitude, longitude], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    const hidden = form ? field(form, "resolvedPlace") : null;
    const canMove = Boolean(form && hidden && place);
    const marker = L.marker([latitude, longitude], {
      draggable: canMove,
      autoPan: true,
      title: label,
      icon: placePinIcon(L)
    }).addTo(map);
    marker.bindTooltip(label, { direction: "top" });

    const wrap = node.closest(".place-map-wrap");
    const status = wrap?.querySelector(".place-pin-status") ?? null;
    const calcPoint = wrap?.querySelector(".place-calc-point") ?? null;
    const resetButton = wrap?.querySelector(".place-pin-reset") ?? null;
    const original = {
      latitude: Number(place?.normalizedForCalculation?.latitude ?? place?.latitude ?? latitude),
      longitude: Number(place?.normalizedForCalculation?.longitude ?? place?.longitude ?? longitude)
    };
    const timeZone = place?.normalizedForCalculation?.timeZone ?? place?.timeZone ?? "";

    // Point d'origine (gris) et trait pointillé : rendent visible ce qui a été
    // déplacé, pour que l'utilisateur voie que le calcul suivra le nouveau point.
    const originDot = L.circleMarker([original.latitude, original.longitude], {
      radius: 4,
      color: "#9aa3c7",
      weight: 2,
      fillColor: "#0b1230",
      fillOpacity: 1
    });
    const link = L.polyline(
      [
        [original.latitude, original.longitude],
        [latitude, longitude]
      ],
      { color: "#e9c46a", weight: 2, dashArray: "4 6", opacity: 0.9 }
    );
    let linkShown = false;
    const showLink = (visible) => {
      if (visible === linkShown) {
        return;
      }
      linkShown = visible;
      if (visible) {
        originDot.addTo(map);
        link.addTo(map);
      } else {
        map.removeLayer(originDot);
        map.removeLayer(link);
      }
    };

    // Affiche noir sur blanc le point exact qui partira au calcul, mis à jour
    // pendant le déplacement.
    const paintCalcPoint = (lat, lng) => {
      if (!calcPoint) {
        return;
      }
      calcPoint.textContent = `${p.calcPoint} ${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)} · ${p.calcZone.replace("{zone}", timeZone)}`;
    };
    paintCalcPoint(original.latitude, original.longitude);

    // Le repère déplacé change les coordonnées réellement utilisées par le
    // calcul : on réécrit le lieu résolu, en gardant la trace de l'ajustement
    // et en signalant que le fuseau horaire, lui, n'est pas recalculé.
    const writeAdjustedPlace = (lat, lng, movedMeters) => {
      if (!canMove) {
        return;
      }
      const nextLatitude = Number(lat.toFixed(5));
      const nextLongitude = Number(lng.toFixed(5));
      hidden.value = JSON.stringify({
        ...place,
        latitude: nextLatitude,
        longitude: nextLongitude,
        normalizedForCalculation: {
          ...(place.normalizedForCalculation ?? {}),
          latitude: nextLatitude,
          longitude: nextLongitude,
          timeZone: place.normalizedForCalculation?.timeZone ?? place.timeZone ?? null
        },
        confidence: "coordinates_manually_adjusted",
        resolutionSource: `${place.resolutionSource ?? "geocoding"} + ajustement manuel du repère`,
        manualAdjustment: {
          movedMeters: Math.round(movedMeters),
          originalLatitude: original.latitude,
          originalLongitude: original.longitude,
          timeZoneRecalculated: false
        }
      });
    };

    const showStatus = (movedMeters) => {
      if (!status) {
        return;
      }
      if (movedMeters < 5) {
        status.hidden = true;
        status.classList.remove("place-pin-warning");
        return;
      }
      if (movedMeters > 30000) {
        status.textContent = p.pinFar.replace("{zone}", timeZone);
        status.classList.add("place-pin-warning");
      } else {
        status.textContent = p.pinMoved.replace("{distance}", formatDistance(movedMeters));
        status.classList.remove("place-pin-warning");
      }
      status.hidden = false;
    };

    marker.on("drag", () => {
      const { lat, lng } = marker.getLatLng();
      paintCalcPoint(lat, lng);
      link.setLatLngs([
        [original.latitude, original.longitude],
        [lat, lng]
      ]);
      showLink(distanceInMeters(original, { latitude: lat, longitude: lng }) >= 5);
    });

    marker.on("dragend", () => {
      const { lat, lng } = marker.getLatLng();
      const movedMeters = distanceInMeters(original, { latitude: lat, longitude: lng });
      writeAdjustedPlace(lat, lng, movedMeters);
      paintCalcPoint(lat, lng);
      showStatus(movedMeters);
      showLink(movedMeters >= 5);
      if (resetButton) {
        resetButton.hidden = movedMeters < 5;
      }
    });

    resetButton?.addEventListener("click", () => {
      marker.setLatLng([original.latitude, original.longitude]);
      map.setView([original.latitude, original.longitude], map.getZoom());
      if (canMove) {
        hidden.value = JSON.stringify(place);
      }
      paintCalcPoint(original.latitude, original.longitude);
      showLink(false);
      if (status) {
        status.hidden = true;
        status.classList.remove("place-pin-warning");
      }
      resetButton.hidden = true;
    });

    setTimeout(() => map.invalidateSize(), 80);
  });
}

// --- Autocomplétion du lieu de naissance -----------------------------------
// L'utilisateur choisit une ville dans une liste : plus de faute de frappe
// possible, et le lieu retenu est celui validé par le serveur.
function attachPlaceAutocomplete(input, { detailsId, usePublic = false } = {}) {
  if (!input || input.dataset.placeAutocomplete === "1") {
    return;
  }
  const form = input.closest("form");
  if (!form) {
    return;
  }
  input.dataset.placeAutocomplete = "1";
  input.setAttribute("autocomplete", "off");
  input.setAttribute("spellcheck", "false");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");

  const wrap = document.createElement("div");
  wrap.className = "place-field";
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const list = document.createElement("div");
  list.className = "place-suggestions";
  list.setAttribute("role", "listbox");
  list.hidden = true;
  wrap.appendChild(list);

  let timer = null;
  let requestSeq = 0;
  let items = [];
  let active = -1;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const closeList = () => {
    clearTimer();
    list.hidden = true;
    list.innerHTML = "";
    items = [];
    active = -1;
    input.setAttribute("aria-expanded", "false");
  };

  const highlight = (index) => {
    active = index;
    $all(".place-suggestion", list).forEach((node, position) => {
      node.classList.toggle("active", position === index);
    });
  };

  const choose = async (place) => {
    closeList();
    input.value = place.name ?? "";
    await resolvePlaceForForm(form, detailsId, place.id, usePublic, input.name);
  };

  const render = (places, approximate) => {
    const p = placeStrings();
    items = places;
    list.innerHTML = "";
    if (!places.length) {
      const empty = document.createElement("p");
      empty.className = "place-suggestions-note";
      empty.textContent = p.none;
      list.appendChild(empty);
    } else {
      const title = document.createElement("p");
      title.className = "place-suggestions-note";
      title.textContent = approximate ? p.approximate : p.suggestionsTitle;
      list.appendChild(title);
      places.forEach((place) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "place-suggestion";
        button.setAttribute("role", "option");
        button.dataset.placeId = place.id ?? "";
        const name = document.createElement("span");
        name.className = "place-suggestion-name";
        name.textContent = place.name ?? "";
        const meta = document.createElement("span");
        meta.className = "place-suggestion-meta";
        meta.textContent = place.timeZone ?? "";
        button.append(name, meta);
        button.addEventListener("mousedown", (event) => {
          event.preventDefault();
          choose(place);
        });
        list.appendChild(button);
      });
    }
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    highlight(-1);
  };

  const search = async (query) => {
    const seq = (requestSeq += 1);
    const base = usePublic ? "/api/public/places" : "/api/places";
    try {
      const result = await api(`${base}/search?q=${encodeURIComponent(query)}`);
      if (seq !== requestSeq) {
        return;
      }
      render(result.places ?? [], Boolean(result.approximate));
    } catch {
      if (seq !== requestSeq) {
        return;
      }
      render([], false);
    }
  };

  input.addEventListener("input", () => {
    clearTimer();
    const query = input.value.trim();
    if (query.length < 3) {
      closeList();
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      search(query);
    }, 260);
  });

  input.addEventListener("focus", () => {
    if (items.length) {
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }
  });

  input.addEventListener("blur", () => {
    setTimeout(closeList, 180);
  });

  input.addEventListener("keydown", (event) => {
    if (list.hidden) {
      return;
    }
    const options = $all(".place-suggestion", list);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!options.length) {
        return;
      }
      event.preventDefault();
      const next = event.key === "ArrowDown" ? (active + 1) % options.length : (active - 1 + options.length) % options.length;
      highlight(next);
      options[next].scrollIntoView({ block: "nearest" });
      return;
    }
    if (event.key === "Enter" && active >= 0 && options[active]) {
      event.preventDefault();
      const place = items.find((entry) => entry.id === options[active].dataset.placeId);
      if (place) {
        choose(place);
      }
      return;
    }
    if (event.key === "Escape") {
      closeList();
    }
  });
}

// `targetName` : champ à résoudre et à réécrire avec le nom canonique. Le lieu de
// naissance principal écrit aussi le lieu résolu dans le champ caché
// `resolvedPlace` ; les lieux des parents n'ont besoin que du nom reconnu.
async function resolvePlaceForForm(form, detailsId, placeId = null, usePublic = false, targetName = "birthPlace") {
  const payload = formPayload(form);
  const target = field(form, targetName);
  const base = usePublic ? "/api/public/places" : "/api/places";
  try {
    const result = await api(`${base}/resolve`, {
      method: "POST",
      body: {
        query: target?.value ?? payload.birthPlace,
        birthDate: payload.birthDate,
        placeId
      }
    });
    if (targetName === "birthPlace") {
      field(form, "resolvedPlace").value = JSON.stringify(result.place);
    }
    if (target) {
      target.value = result.place.selectedName;
    }
    showResolvedPlace(detailsId, result.place);
    showMessage(uiStrings().placeFound);
    return result.place;
  } catch (error) {
    if (error.matches?.length) {
      const box = $(`#${detailsId}`);
      box.innerHTML = error.matches
        .map(
          (place) => `
            <article class="item">
              <div class="item-title"><span>${place.name}</span></div>
              <div class="meta">${place.country ?? "Choisissez ce lieu s'il s'agit du bon."}</div>
              <button class="secondary" data-resolve-place-id="${place.id}" type="button">C'est celui-ci</button>
            </article>
          `
        )
        .join("");
      box.hidden = false;
      $all("[data-resolve-place-id]", box).forEach((button) => {
        button.addEventListener("click", async () => {
          await resolvePlaceForForm(form, detailsId, button.dataset.resolvePlaceId, usePublic, targetName);
        });
      });
      showMessage(error.message, true);
      return null;
    }
    showMessage(error.message, true);
    return null;
  }
}

async function ensureResolvedPlace(form, detailsId, usePublic = false) {
  if (field(form, "resolvedPlace").value) {
    return true;
  }
  if (!field(form, "birthPlace").value.trim()) {
    showMessage("Indiquez le lieu de naissance.", true);
    return false;
  }
  return Boolean(await resolvePlaceForForm(form, detailsId, null, usePublic));
}

function setView(name) {
  state.currentView = name;
  $all(".view").forEach((view) => view.classList.remove("active"));
  $(`#${name}-view`).classList.add("active");
  $all(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  $("#view-title").textContent = titles[name];
  if (typeof updateGuestChrome === "function") {
    updateGuestChrome();
  }
}

function updateNav() {
  const authenticated = Boolean(state.user);
  const isAdmin = state.user?.primaryRole === "admin";
  $all(".nav-button").forEach((button) => {
    if (
      button.dataset.view !== "auth" &&
      button.dataset.view !== "methods" &&
      button.dataset.view !== "offre" &&
      button.dataset.view !== "express"
    ) {
      button.disabled = !authenticated;
    }
    if (button.dataset.view === "admin") {
      button.disabled = !isAdmin;
    }
  });
  $all(".admin-only").forEach((element) => {
    element.hidden = !isAdmin;
  });
  $("#session-state").textContent = authenticated ? state.user.email : "Non connecté";
  $("#account-tools").hidden = !authenticated;
}

function formatMoney(amountCents, currency) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency
  }).format(amountCents / 100);
}

function renderPeople() {
  const list = $("#people-list");
  if (!state.dossier?.people?.length) {
    list.innerHTML = '<p class="hint">Aucune personne enregistrée.</p>';
    return;
  }

  list.innerHTML = state.dossier.people
    .map((person) => {
      const birth = birthFor(person.id);
      const birthMeta = birth
        ? `${birth.birthDate ?? "date inconnue"} · ${birth.placeName ?? "lieu inconnu"} · heure ${birth.timePrecision}`
        : "Aucune donnée de naissance enregistrée";
      const deleteButton = person.isPrimary
        ? ""
        : `<button class="danger" data-delete-person="${person.id}" type="button">Supprimer</button>`;
      return `
        <article class="item">
          <div class="item-title">
            <span>${personName(person)}</span>
            <span class="badge">${person.isPrimary ? "profil" : "lié"}</span>
          </div>
          <div class="meta">${birthMeta}</div>
          ${deleteButton}
        </article>
      `;
    })
    .join("");

  $all("[data-delete-person]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/api/people/${button.dataset.deletePerson}`, { method: "DELETE" });
      await refreshDossier();
      showMessage("Personne supprimée.");
    });
  });
}

function renderRelationshipOptions() {
  const people = state.dossier?.people ?? [];
  for (const select of $all("#relationship-form select[name='fromPersonId'], #relationship-form select[name='toPersonId']")) {
    select.innerHTML = people.map((person) => `<option value="${person.id}">${personName(person)}</option>`).join("");
  }
  const natalPerson = $("#natal-person");
  if (natalPerson) {
    natalPerson.innerHTML = people.map((person) => `<option value="${person.id}">${personName(person)}</option>`).join("");
  }
  const deliverablePerson = $("#deliverable-person");
  if (deliverablePerson) {
    const withBirth = people.filter((person) => birthFor(person.id));
    deliverablePerson.innerHTML = withBirth.length
      ? withBirth.map((person) => `<option value="${person.id}">${personName(person)}</option>`).join("")
      : '<option value="">Aucune personne avec données de naissance</option>';
  }
}

function renderRelationships() {
  const list = $("#relationship-list");
  const relationships = state.dossier?.relationships ?? [];
  if (!relationships.length) {
    list.innerHTML = '<p class="hint">Aucune relation enregistrée.</p>';
    return;
  }

  const peopleById = new Map(state.dossier.people.map((person) => [person.id, person]));
  list.innerHTML = relationships
    .map((relationship) => `
      <article class="item">
        <div class="item-title">
          <span>${personName(peopleById.get(relationship.fromPersonId))} -> ${personName(peopleById.get(relationship.toPersonId))}</span>
          <span class="badge">${relationshipLabels[relationship.type] ?? relationship.type}</span>
        </div>
        <div class="meta">Statut : ${relationship.status}</div>
        <button class="danger" data-delete-relationship="${relationship.id}" type="button">Supprimer</button>
      </article>
    `)
    .join("");

  $all("[data-delete-relationship]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/api/relationships/${button.dataset.deleteRelationship}`, { method: "DELETE" });
      await refreshDossier();
      showMessage("Relation supprimée.");
    });
  });
}

function renderHistory() {
  const list = $("#history-list");
  const history = state.dossier?.history ?? [];
  if (!history.length) {
    list.innerHTML = '<p class="hint">Aucune modification enregistrée.</p>';
    return;
  }

  list.innerHTML = history
    .map((entry) => `
      <article class="timeline-entry">
        <strong>${entry.action}</strong>
        <div class="meta">${new Date(entry.createdAt).toLocaleString("fr-FR")} · ${entry.subjectType}</div>
      </article>
    `)
    .join("");
}

function renderAnalyses(analyses = state.dossier?.analyses ?? []) {
  const list = $("#analysis-list");
  if (!analyses.length) {
    list.innerHTML = '<p class="hint">Aucune analyse enregistrée.</p>';
    return;
  }

  list.innerHTML = analyses
    .map((analysis) => {
      const version = analysis.versions?.[0];
      const createdAt = new Date(analysis.createdAt).toLocaleString("fr-FR");
      const versionMeta = version ? `Version ${version.id} · ${version.methodVersionIds.length} méthode(s)` : "Aucune version";
      return `
        <article class="item">
          <div class="item-title">
            <span>${analysis.scope}</span>
            <span class="badge">${analysis.status}</span>
          </div>
          <div class="meta">${createdAt}</div>
          <div class="meta">${versionMeta}</div>
          ${(analysis.methodResults ?? [])
            .map((result) => `<div class="meta">${result.methodId} : ${result.status}</div>`)
            .join("")}
          ${(analysis.reports ?? [])
            .map(
              (report) => `
                <div class="report-preview">
                  <div class="item-title">
                    <span>Rapport ${report.id}</span>
                    <span class="badge">${report.status}</span>
                  </div>
                  ${report.sections.map((section) => `<div class="meta"><strong>${section.title}</strong> · ${section.body}</div>`).join("")}
                </div>
              `
            )
            .join("")}
          <button class="secondary" data-create-report="${analysis.id}" type="button">Générer rapport</button>
        </article>
      `;
    })
    .join("");

  $all("[data-create-report]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api(`/api/analyses/${button.dataset.createReport}/reports`, { method: "POST" });
        await refreshAnalyses();
        showMessage("Rapport contrôlé créé.");
      } catch (error) {
        showMessage(error.message, true);
      }
    });
  });
}

async function refreshAnalyses() {
  const { analyses } = await api("/api/analyses");
  const detailed = await Promise.all(
    analyses.map(async (analysis) => {
      const detail = await api(`/api/analyses/${analysis.id}`);
      const { reports } = await api(`/api/analyses/${analysis.id}/reports`);
      return { ...detail, reports };
    })
  );
  renderAnalyses(detailed);
}

async function renderMethods() {
  const { methods } = await api("/api/methods");
  $("#method-list").innerHTML = methods
    .map((method) => `
      <article class="item">
        <div class="item-title">
          <span>${method.name}</span>
          <span class="badge">${method.status}</span>
        </div>
        <div class="meta">${method.tradition} · production : ${method.productionEligible ? "oui" : "non"}</div>
        <div class="meta">${method.notes}</div>
      </article>
    `)
    .join("");
}

async function renderCommerce() {
  const summary = await api("/api/commerce");
  $("#credit-balance").textContent = summary.balance;
  $("#plan-list").innerHTML = summary.plans
    .map(
      (plan) => `
        <article class="item">
          <div class="item-title">
            <span>${plan.name}</span>
            <span class="badge">${plan.credits} crédits</span>
          </div>
          <div class="meta">${formatMoney(plan.amountCents, plan.currency)} · paiement réel non connecté</div>
          <button data-buy-plan="${plan.id}" type="button">Créditer en développement</button>
        </article>
      `
    )
    .join("");

  $("#credit-ledger").innerHTML = summary.ledger.length
    ? summary.ledger
        .map(
          (entry) => `
            <article class="timeline-entry">
              <strong>${entry.delta > 0 ? "+" : ""}${entry.delta} crédit(s)</strong>
              <div class="meta">${entry.reason} · ${new Date(entry.createdAt).toLocaleString("fr-FR")}</div>
            </article>
          `
        )
        .join("")
    : '<p class="hint">Aucune écriture de crédit.</p>';

  $all("[data-buy-plan]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api("/api/commerce/dev-credit-order", {
          method: "POST",
          body: { planId: button.dataset.buyPlan }
        });
        await renderCommerce();
        showMessage("Crédits de développement ajoutés.");
      } catch (error) {
        showMessage(error.message, true);
      }
    });
  });
}

async function renderAdmin() {
  const [summary, audit] = await Promise.all([api("/api/admin/summary"), api("/api/admin/audit?limit=25")]);
  $("#admin-counts").innerHTML = Object.entries(summary.counts)
    .map(
      ([label, value]) => `
        <article class="stat-card">
          <span>${label}</span>
          <strong>${value}</strong>
        </article>
      `
    )
    .join("");

  $("#admin-users").innerHTML = summary.users.length
    ? summary.users
        .map(
          (user) => `
            <article class="item">
              <div class="item-title">
                <span>${user.email}</span>
                <span class="badge">${user.primaryRole}</span>
              </div>
              <div class="meta">Créé : ${new Date(user.createdAt).toLocaleString("fr-FR")}</div>
              <div class="meta">Statut : ${user.deletedAt ? "supprimé" : "actif"}</div>
            </article>
          `
        )
        .join("")
    : '<p class="hint">Aucun utilisateur.</p>';

  $("#admin-audit").innerHTML = audit.auditLogs.length
    ? audit.auditLogs
        .map(
          (entry) => `
            <article class="timeline-entry">
              <strong>${entry.action}</strong>
              <div class="meta">${entry.subjectType} · ${entry.subjectId}</div>
              <div class="meta">${new Date(entry.createdAt).toLocaleString("fr-FR")} · propriétaire ${entry.ownerUserId}</div>
            </article>
          `
        )
        .join("")
    : '<p class="hint">Aucun log.</p>';
}

function fillProfileForm() {
  const primary = state.dossier?.people?.find((person) => person.isPrimary);
  if (!primary) {
    return;
  }
  const birth = birthFor(primary.id) ?? {};
  const form = $("#profile-form");
  field(form, "firstName").value = primary.firstName ?? "";
  field(form, "lastName").value = primary.lastName ?? "";
  field(form, "birthName").value = primary.birthName ?? "";
  field(form, "birthDate").value = birth.birthDate ?? "";
  field(form, "birthPlace").value = birth.placeName ?? "";
  field(form, "country").value = birth.country ?? "";
  field(form, "resolvedPlace").value = birth.resolvedPlace ? JSON.stringify(birth.resolvedPlace) : "";
  if (birth.resolvedPlace) {
    showResolvedPlace("profile-place-details", birth.resolvedPlace);
  }
  field(form, "timePrecision").value = birth.timePrecision ?? "unknown";
  field(form, "timeValue").value = birth.timeValue ?? "";
  field(form, "timeStart").value = birth.timeStart ?? "";
  field(form, "timeEnd").value = birth.timeEnd ?? "";
}

function fillNatalForm() {
  const form = $("#natal-form");
  if (!form || !state.dossier?.people?.length) {
    return;
  }
  const selectedPersonId = field(form, "personId").value || state.dossier.people.find((person) => person.isPrimary)?.id || state.dossier.people[0].id;
  field(form, "personId").value = selectedPersonId;
  const birth = birthFor(selectedPersonId) ?? {};
  field(form, "birthDate").value = birth.birthDate ?? "";
  field(form, "timeValue").value = birth.timeValue ?? "";
  field(form, "timeStart").value = birth.timeStart ?? "";
  field(form, "timeEnd").value = birth.timeEnd ?? "";
  field(form, "timePrecision").value = birth.timePrecision ?? "unknown";
  field(form, "birthPlace").value = birth.placeName ?? "";
  field(form, "resolvedPlace").value = birth.resolvedPlace ? JSON.stringify(birth.resolvedPlace) : "";
  if (birth.resolvedPlace) {
    showResolvedPlace("natal-place-details", birth.resolvedPlace);
  }
}

const NATAL_BODY_LABELS = {
  Sun: "☉ Soleil",
  Moon: "☽ Lune",
  Mercury: "☿ Mercure",
  Venus: "♀ Vénus",
  Mars: "♂ Mars",
  Jupiter: "♃ Jupiter",
  Saturn: "♄ Saturne"
};

const NATAL_SIGN_FR = {
  Aries: "Bélier",
  Taurus: "Taureau",
  Gemini: "Gémeaux",
  Cancer: "Cancer",
  Leo: "Lion",
  Virgo: "Vierge",
  Libra: "Balance",
  Scorpio: "Scorpion",
  Sagittarius: "Sagittaire",
  Capricorn: "Capricorne",
  Aquarius: "Verseau",
  Pisces: "Poissons"
};

function frSignName(sign) {
  return NATAL_SIGN_FR[sign] ?? sign;
}

function formatDegrees(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "";
  }
  const integer = Math.floor(Number(value));
  const minutes = Math.round((Number(value) - integer) * 60);
  return `${integer}°${String(Math.min(minutes, 59)).padStart(2, "0")}′`;
}

function natalHouseFor(body, houses) {
  if (!Array.isArray(houses) || houses.length === 0 || body.signIndex === null || body.signIndex === undefined) {
    return null;
  }
  const house = houses.find((entry) => entry.signIndex === body.signIndex);
  return house?.houseNumber ?? null;
}

function natalAspectList(result) {
  const infrastructure = result.structuralAstrology?.aspectInfrastructure;
  if (!Array.isArray(infrastructure)) {
    return [];
  }
  return infrastructure
    .map((pair) => {
      const best = pair.candidates?.[0] ?? null;
      return {
        label: `${NATAL_BODY_LABELS[pair.bodyA] ?? pair.bodyA} – ${NATAL_BODY_LABELS[pair.bodyB] ?? pair.bodyB}`,
        distance: pair.angularDistance,
        type: best?.type ?? null,
        exactness: best?.exactness ?? null
      };
    })
    .sort((first, second) => (first.exactness ?? 999) - (second.exactness ?? 999))
    .slice(0, 8);
}

function natalTimeDescription(norm) {
  const precision = norm.timePrecision;
  if (precision === "exact") {
    return `Heure de naissance : ${norm.timeValue} (exacte)`;
  }
  if (precision === "approximate") {
    return `Heure de naissance : ${norm.timeValue} (approximative — Ascendant et maisons sensibles à l'incertitude)`;
  }
  if (precision === "interval") {
    return `Heure de naissance : intervalle ${norm.timeStart} – ${norm.timeEnd} (aucune heure exacte inventée)`;
  }
  return "Heure de naissance : inconnue (l'Ascendant, les maisons et la secte n'ont pas été calculés)";
}

const ZODIAC_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
const PLANET_GLYPHS = {
  Sun: "☉",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄"
};

function polar(cx, cy, radius, degrees) {
  const angle = (Math.PI * degrees) / 180;
  return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) };
}

function natalChartSvg(result) {
  const size = 460;
  const c = size / 2;
  const outer = 204;
  const ring = 158;
  const planetR = 118;
  const bodies = Array.isArray(result.astronomicalCalculation?.bodies) ? result.astronomicalCalculation.bodies : [];
  const angles = result.astronomicalCalculation?.angles ?? {};
  const parts = [];

  parts.push(`<svg class="chart-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Carte du ciel">`);
  parts.push(`<defs>
    <radialGradient id="wheelBg" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f1eefb"/>
    </radialGradient>
  </defs>`);
  parts.push(`<circle cx="${c}" cy="${c}" r="${outer + 8}" fill="url(#wheelBg)" stroke="#e0dcf2"/>`);
  parts.push(`<circle cx="${c}" cy="${c}" r="${ring}" fill="none" stroke="#cfc9ea" stroke-width="1.4"/>`);
  parts.push(`<circle cx="${c}" cy="${c}" r="${planetR}" fill="none" stroke="#e5e1f4" stroke-width="1"/>`);
  parts.push(`<circle cx="${c}" cy="${c}" r="${48}" fill="#faf9ff" stroke="#e0dcf2"/>`);

  // 12 secteurs de signes
  for (let index = 0; index < 12; index += 1) {
    const startDeg = index * 30;
    const endDeg = startDeg + 30;
    const a = polar(c, c, ring, startDeg);
    const b = polar(c, c, outer, startDeg);
    const d = polar(c, c, outer, endDeg);
    const e = polar(c, c, ring, endDeg);
    const fill = index % 2 === 0 ? "rgba(255,255,255,0.9)" : "rgba(244,242,253,0.9)";
    const large = 0;
    parts.push(
      `<path d="M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)} A ${outer} ${outer} 0 ${large} 1 ${d.x.toFixed(1)} ${d.y.toFixed(1)} L ${e.x.toFixed(1)} ${e.y.toFixed(1)} A ${ring} ${ring} 0 ${large} 0 ${a.x.toFixed(1)} ${a.y.toFixed(1)} Z" fill="${fill}" stroke="#e6e2f5" stroke-width="0.8"/>`
    );
    const midDeg = startDeg + 15;
    const label = polar(c, c, (outer + ring) / 2 + 2, midDeg);
    parts.push(`<text x="${label.x.toFixed(1)}" y="${label.y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="15" fill="#6d7190">${ZODIAC_GLYPHS[index]}</text>`);
  }

  // limites de signes + repère de longitude
  for (let index = 0; index < 12; index += 1) {
    const deg = index * 30;
    const a = polar(c, c, ring, deg);
    const b = polar(c, c, outer, deg);
    parts.push(`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#dcd7f0" stroke-width="0.8"/>`);
  }

  // planètes (uniquement si longitude calculée)
  for (const body of bodies) {
    if (body.longitude === null || body.longitude === undefined || Number.isNaN(Number(body.longitude))) {
      continue;
    }
    const glyph = PLANET_GLYPHS[body.body] ?? "•";
    const p = polar(c, c, planetR, body.longitude);
    parts.push(`<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="17" fill="#23265e" font-weight="700">${glyph}</text>`);
  }

  // angles
  const drawAngle = (label, longitude, color) => {
    const inner = polar(c, c, planetR, longitude);
    const outerP = polar(c, c, outer, longitude);
    parts.push(`<line x1="${inner.x.toFixed(1)}" y1="${inner.y.toFixed(1)}" x2="${outerP.x.toFixed(1)}" y2="${outerP.y.toFixed(1)}" stroke="${color}" stroke-width="2"/>`);
    const pos = polar(c, c, outer + 18, longitude);
    const rotate = longitude > 90 && longitude < 270 ? longitude + 180 : longitude;
    parts.push(`<text x="${pos.x.toFixed(1)}" y="${pos.y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="800" fill="${color}" transform="rotate(${rotate} ${pos.x.toFixed(1)} ${pos.y.toFixed(1)})">${label}</text>`);
  };
  if (angles.ascendant?.longitude !== undefined && angles.ascendant?.longitude !== null) {
    drawAngle("ASC", angles.ascendant.longitude, "#4b3ac4");
  }
  if (angles.midheaven?.longitude !== undefined && angles.midheaven?.longitude !== null) {
    drawAngle("MC", angles.midheaven.longitude, "#c2850f");
  }

  parts.push(`<text x="${c}" y="${c - 4}" text-anchor="middle" dominant-baseline="central" font-size="13" fill="#6d7190">♁</text>`);
  parts.push(`</svg>`);
  return parts.join("\n");
}

function renderNatalResult(payload) {
  const result = payload.result;
  const norm = result.normalizedInput ?? {};
  const bodies = Array.isArray(result.astronomicalCalculation?.bodies) ? result.astronomicalCalculation.bodies : [];
  const angles = result.astronomicalCalculation?.angles ?? {};
  const rawHouses = result.structuralAstrology?.houses;
  const houses = Array.isArray(rawHouses) ? rawHouses : rawHouses?.houses ?? [];
  const sect = result.structuralAstrology?.sect;
  const person = state.dossier?.people?.find((entry) => entry.id === norm.personId);

  const placeLine = [norm.placeName, norm.country].filter(Boolean).join(", ");
  const aspects = natalAspectList(result);
  const bodiesRows = bodies
    .map((body) => {
      const label = NATAL_BODY_LABELS[body.body] ?? body.body;
      const sign = body.sign
        ? `${frSignName(body.sign)} ${formatDegrees(body.degreeInSign)}`
        : body.signRange
          ? `${frSignName(body.signRange.start)} → ${frSignName(body.signRange.end)}`
          : "position du jour";
      const house = natalHouseFor(body, houses);
      const retro = body.apparentMotion?.retrograde ? " · rétrograde" : "";
      return `<div class="chart-row"><span class="chart-label">${label}</span><strong>${sign}</strong><span class="chart-side">${house ? `maison ${house}` : "—"}${retro}</span></div>`;
    })
    .join("");

  const angleRows = angles.ascendant
    ? [
        `<div class="chart-row"><span class="chart-label">Ascendant</span><strong>${frSignName(angles.ascendant.sign)} ${formatDegrees(angles.ascendant.degreeInSign)}</strong><span class="chart-side">maison 1</span></div>`,
        `<div class="chart-row"><span class="chart-label">Milieu du Ciel</span><strong>${frSignName(angles.midheaven.sign)} ${formatDegrees(angles.midheaven.degreeInSign)}</strong></div>`,
        ...(sect?.chartSect
          ? [`<div class="chart-row"><span class="chart-label">Secte</span><strong>${sect.chartSect === "diurnal" ? "diurne (Soleil au-dessus de l'horizon)" : "nocturne"}</strong></div>`]
          : [])
      ].join("")
    : '<p class="hint">Heure inconnue ou intervalle : l’Ascendant et le Milieu du Ciel n’ont pas été calculés. Le reste du thème du jour reste valable en tendance.</p>';

  const aspectRows = aspects.length
    ? aspects
        .map(
          (aspect) =>
            `<div class="chart-row"><span class="chart-label">${aspect.label}</span><strong>${aspect.distance.toFixed(1)}°</strong><span class="chart-side">proche de : ${aspect.type} (écart ${aspect.exactness.toFixed(1)}°)</span></div>`
        )
        .join("")
    : '<p class="hint">Distances angulaires indisponibles (temps non précis).</p>';

  $("#natal-summary").innerHTML = `
    <article class="item hero-result">
      <div class="item-title">
        <span>${person ? personName(person) : "Thème"}</span>
        <span class="badge badge-ok">Calcul vérifié</span>
      </div>
      <div class="meta">${norm.birthDate} · ${placeLine || "lieu non précisé"} · ${natalTimeDescription(norm)}</div>
      <div class="meta">Fuseau ${norm.timeZone} · zodiaque tropical · maisons Whole Sign</div>
    </article>

    <article class="item chart-card">
      <div class="item-title"><span>Carte du ciel</span><span class="badge">tropical · Whole Sign</span></div>
      ${natalChartSvg(result)}
      <p class="hint">Tracé calculé d'après les longitudes vérifiées. ${angles.ascendant ? "" : "Heure inconnue : les planètes du jour sont indiquées sans Ascendant ni Milieu du Ciel."}</p>
    </article>

    <article class="item">
      <div class="item-title"><span>Planètes et points</span><span class="badge">${bodies.length + (angles.ascendant ? 2 : 0)}</span></div>
      ${bodiesRows}
      ${angleRows}
    </article>

    <article class="item">
      <div class="item-title"><span>Distances angulaires les plus proches d’un aspect</span><span class="badge">${aspects.length}</span></div>
      ${aspectRows}
      <p class="hint">Distances calculées, classées par proximité. Aucune règle d’orbe n’est encore activée : ce ne sont pas encore des « aspects validés ».</p>
    </article>

    <article class="note note-accent">
      <strong>Et l’interprétation ?</strong>
      <span>Le moteur calcule et vérifie ; il ne décide pas encore ce qui est « important » (aucune règle documentée validée). Pour une lecture complète et rédigée, ouvrez l’onglet <strong>Dossier client</strong> : il utilise ces mêmes données vérifiées comme socle.</span>
    </article>

    <article class="item tech-meta">
      <div class="item-title"><span>Référence du calcul</span><span class="badge">${result.methodVersion}</span></div>
      <div class="meta">Run : ${payload.calculationRun.id}</div>
      <div class="meta">Hachage du résultat : ${payload.calculationRun.resultHash}</div>
      <div class="meta">UTC : ${result.time?.utc ?? "—"}</div>
    </article>
  `;
  $("#natal-json").textContent = JSON.stringify(payload, null, 2);
}

function renderDossier() {
  fillProfileForm();
  renderPeople();
  renderRelationshipOptions();
  fillNatalForm();
  renderRelationships();
  renderHistory();
}

function downloadJson(filename, payload) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

const deliverableStatusLabels = {
  ready_for_human_review: "prêt pour relecture",
  needs_review: "à vérifier",
  template_draft: "brouillon sans rédacteur IA",
  generating: "en cours…",
  failed: "échec",
  generated: "généré"
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setDeliverableProgress(progress) {
  const panel = $("#deliverable-progress");
  const percent = progress
    ? Math.min(99, Math.round((progress.completedSteps / Math.max(1, progress.totalSteps)) * 100))
    : 0;
  $("#deliverable-progress-percent").textContent = `${percent} %`;
  $("#deliverable-progress-bar").style.width = `${percent}%`;
  $("#deliverable-progress-section").textContent = progress?.currentSection
    ? `Rédaction en cours : ${progress.currentSection.title}`
    : "Génération en cours…";
  panel.hidden = false;
}

async function pollDeliverableGeneration(id) {
  const maxAttempts = 90; // ~4 min à 2,5 s par essai
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const payload = await api(`/api/deliverables/${id}`);
    const status = payload.deliverable.status;
    if (status === "generating") {
      setDeliverableProgress(payload.deliverable.progress);
      await sleep(2500);
      continue;
    }
    return payload;
  }
  throw new Error("La génération a dépassé le temps d'attente. Vérifiez la liste des dossiers.");
}

function deliverableStatusLabel(status) {
  return deliverableStatusLabels[status] ?? status;
}

function fillDeliverablePersonSelect() {
  const people = state.dossier?.people ?? [];
  const withBirth = people.filter((person) => birthFor(person.id));
  const select = $("#deliverable-person");
  if (!select) {
    return;
  }
  select.innerHTML = withBirth.length
    ? withBirth.map((person) => `<option value="${person.id}">${personName(person)}</option>`).join("")
    : '<option value="">Aucune personne avec données de naissance</option>';
}

function renderDeliverables(deliverables) {
  const list = $("#deliverable-list");
  if (!deliverables.length) {
    list.innerHTML = '<p class="hint">Aucun dossier généré. Renseignez une personne avec sa naissance, puis générez.</p>';
    return;
  }

  list.innerHTML = deliverables
    .map((deliverable) => {
      const statusBadges = [
        `<span class="badge">${deliverableStatusLabel(deliverable.status)}</span>`,
        deliverable.reviewedByHuman ? '<span class="badge badge-ok">relu ✓</span>' : ""
      ].join(" ");
      const costLine =
        deliverable.costEstimate && deliverable.writerMode === "llm"
          ? ` · IA ≈ ${deliverable.costEstimate.usd.toFixed(4)}$ (${deliverable.costEstimate.totalTokens} tokens)`
          : deliverable.writerMode === "template"
            ? " · brouillon (socle local)"
            : "";
      const progressPart =
        deliverable.status === "generating" && deliverable.progress
          ? ` · ${Math.round((deliverable.progress.completedSteps / Math.max(1, deliverable.progress.totalSteps)) * 100)} %`
          : "";
      return `
      <article class="item">
        <div class="item-title">
          <span>${deliverable.title ?? deliverable.personLabel}</span>
          <span class="badge-row">${statusBadges}</span>
        </div>
        <div class="meta">${new Date(deliverable.createdAt).toLocaleString("fr-FR")} · ${deliverable.personLabel}${costLine}${progressPart}</div>
        <div class="split-actions">
          <button type="button" data-open-deliverable="${deliverable.id}">Ouvrir</button>
          <button class="secondary" type="button" data-download-deliverable="${deliverable.id}" data-format="html">HTML</button>
          <button class="secondary" type="button" data-download-deliverable="${deliverable.id}" data-format="md">Markdown</button>
          <button class="secondary" type="button" data-pdf-deliverable="${deliverable.id}">PDF</button>
          <button class="danger" type="button" data-delete-deliverable="${deliverable.id}">Supprimer</button>
        </div>
      </article>
    `;
    })
    .join("");

  $all("[data-open-deliverable]").forEach((button) => {
    button.addEventListener("click", () => openDeliverable(button.dataset.openDeliverable));
  });
  $all("[data-download-deliverable]").forEach((button) => {
    button.addEventListener("click", () => downloadDeliverable(button.dataset.downloadDeliverable, button.dataset.format));
  });
  $all("[data-pdf-deliverable]").forEach((button) => {
    button.addEventListener("click", () => exportDeliverablePdf(button.dataset.pdfDeliverable));
  });
  $all("[data-delete-deliverable]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Supprimer ce dossier ?")) {
        return;
      }
      await api(`/api/deliverables/${button.dataset.deleteDeliverable}`, { method: "DELETE" });
      await refreshDeliverables();
      showMessage("Dossier supprimé.");
    });
  });
}

async function refreshDeliverables() {
  if (!state.user) {
    return;
  }
  fillDeliverablePersonSelect();
  const payload = await api("/api/deliverables");
  renderDeliverables(payload.deliverables);
}

async function exportDeliverablePdf(id) {
  // Rendu serveur quand il est actif : un vrai fichier, sans la date ni l'adresse
  // que la fenêtre d'impression ajoute. Sinon, on garde l'impression.
  if (state.config?.pdfRenderer === "chromium") {
    try {
      const reponse = await fetch(`/api/deliverables/${id}/export?format=pdf`, {
        headers: { accept: "application/pdf" },
        credentials: "same-origin"
      });
      if (reponse.ok) {
        const blob = await reponse.blob();
        const lien = document.createElement("a");
        const adresse = URL.createObjectURL(blob);
        lien.href = adresse;
        // Le serveur nomme le fichier d'après le titre du document.
        lien.download = nomDepuisDisposition(reponse.headers.get("content-disposition")) ?? `dossier-${id}.pdf`;
        lien.click();
        URL.revokeObjectURL(adresse);
        return;
      }
      if (reponse.status !== 502 && reponse.status !== 503) {
        const payload = await reponse.json().catch(() => ({}));
        throw new Error(payload.error ?? "Export PDF impossible.");
      }
    } catch (error) {
      if (!/réseau|network|fetch/i.test(error.message ?? "")) {
        throw error;
      }
      // Panne réseau : on retombe sur l'impression plutôt que d'échouer.
    }
  }
  const response = await fetch(`/api/deliverables/${id}/export?format=html`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Export PDF impossible.");
  }
  const html = await response.text();
  // Même chemin que le parcours public : impression depuis un cadre invisible,
  // donc pas de fenêtre surgissante à autoriser.
  try {
    printHtmlInWindow(html);
  } catch (error) {
    throw new Error(error.message || "Impression impossible. Utilisez le bouton HTML.");
  }
  showMessage(uiStrings().pdfHint);
}

async function toggleDeliverableReview() {
  const id = state.activeDeliverableId;
  if (!id) {
    return;
  }
  const current = await api(`/api/deliverables/${id}`);
  const markReviewed = !current.deliverable.reviewedByHuman;
  const note = markReviewed ? window.prompt("Note de relecture (facultatif) :") ?? "" : "";
  const result = await api(`/api/deliverables/${id}/review`, {
    method: "PATCH",
    body: { reviewed: markReviewed, note }
  });
  await refreshDeliverables();
  await openDeliverable(id);
  showMessage(
    result.deliverable.reviewedByHuman
      ? "Dossier marqué comme relu (prêt pour livraison)."
      : "Relecture retirée."
  );
}

async function openDeliverable(id) {
  const payload = await api(`/api/deliverables/${id}`);
  const deliverable = payload.deliverable;
  const viewer = $("#deliverable-viewer");
  viewer.hidden = false;
  const reviewState = deliverable.reviewedByHuman ? " · relu ✓" : "";
  $("#deliverable-viewer-title").textContent = `Dossier — ${deliverable.personLabel}${reviewState}`;
  const reviewButton = $("#review-deliverable-button");
  if (reviewButton) {
    reviewButton.disabled = deliverable.status === "generating" || deliverable.status === "failed";
    reviewButton.textContent = deliverable.reviewedByHuman ? "Retirer « relu »" : "Marquer comme relu";
  }
  const cost = deliverable.costEstimate ? ` · IA ≈ ${deliverable.costEstimate.usd.toFixed(4)}$` : "";
  $("#deliverable-viewer-status").textContent = `${deliverableStatusLabel(deliverable.status)}${cost}`;
  $("#deliverable-frame").srcdoc = "";
  state.activeDeliverableId = id;

  if (deliverable.status === "generating") {
    $("#deliverable-frame").srcdoc =
      "<html><body style='font-family:sans-serif;display:grid;place-items:center;height:100vh;color:#444'><div style='text-align:center'><p style='font-size:1.4rem'>⏳ Génération en cours…</p><p>La barre de progression sous le bouton indique l'avancement.</p></div></body></html>";
    return;
  }
  if (deliverable.status === "failed") {
    $("#deliverable-frame").srcdoc =
      "<html><body style='font-family:sans-serif;display:grid;place-items:center;height:100vh;color:#c0392b'><p>⚠️ La génération a échoué : " +
      escapeHtml(deliverable.error ?? "") +
      "</p></body></html>";
    return;
  }
  const response = await fetch(`/api/deliverables/${id}/export?format=html`);
  const html = await response.text();
  $("#deliverable-frame").srcdoc = html;
}

async function downloadDeliverable(id, format) {
  const extension = format === "md" ? "md" : "html";
  const response = await fetch(`/api/deliverables/${id}/export?format=${extension}`);
  const text = await response.text();
  const blob = new Blob([text], { type: extension === "md" ? "text/markdown" : "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomDeFichier(titreDuDocument(text), extension, `dossier-${id}`);
  link.click();
  URL.revokeObjectURL(url);
}

function deliverableParentsFromForm(form) {
  const parents = [];
  const read = (role, prefix) => {
    const label = field(form, `${prefix}Name`)?.value.trim() ?? "";
    const birthDate = field(form, `${prefix}BirthDate`)?.value ?? "";
    const birthPlace = field(form, `${prefix}BirthPlace`)?.value.trim() ?? "";
    if (label || birthDate || birthPlace) {
      parents.push({
        role,
        label: label || null,
        birthDate: birthDate || null,
        birthPlace: birthPlace || null
      });
    }
  };
  read("mother", "mother");
  read("father", "father");
  return parents;
}

function bindPriceSlider() {
  const slider = $("#price-slider");
  if (!slider) {
    return;
  }
  const amountEl = $("#price-amount");
  const tierEl = $("#price-tier");
  const splitEl = $("#price-split");
  const confirmBox = $("#price-confirm");
  const confirmText = $("#price-confirm-text");
  const resultEl = $("#price-result");
  const chips = $all("#price-chips .chip");
  const shareChips = $all("#share-chips .chip");
  const PRICE_TIERS = [
    [500, "Légende du ciel — merci infini 💫"],
    [100, "Soutien précieux 💜"],
    [30, "Grand merci ✨"],
    [10, "Merci pour votre confiance 🙏"],
    [1, "Merci d'être là 💫"]
  ];
  let pendingPrice = null;

  const format = (value) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

  const activeShare = () => Number(shareChips.find((chip) => chip.classList.contains("active"))?.dataset.share ?? 0);

  function refresh() {
    const value = Number(slider.value);
    amountEl.textContent = format(value);
    for (const chip of chips) {
      chip.classList.toggle("active", Number(chip.dataset.price) === value);
    }
    const tier = PRICE_TIERS.find(([threshold]) => value >= threshold)?.[1] ?? "Merci d'être là 💫";
    tierEl.textContent = tier;
    updateSplit(value);
  }

  function updateSplit(value) {
    const share = activeShare();
    const authorPortion = Math.round((value * (100 - share)) / 100);
    const associationPortion = value - authorPortion;
    if (share === 0) {
      splitEl.textContent = `Intégralité pour votre lecture : ${format(authorPortion)}.`;
    } else {
      splitEl.textContent = `Répartition : ${format(authorPortion)} pour votre lecture · ${format(associationPortion)} reversé à l'association (maximum 50 %).`;
    }
  }

  function finish(value) {
    confirmBox.hidden = true;
    const share = activeShare();
    const authorPortion = Math.round((value * (100 - share)) / 100);
    const associationPortion = value - authorPortion;
    const tier = PRICE_TIERS.find(([threshold]) => value >= threshold)?.[1] ?? "Merci d'être là 💫";
    const lines = [
      `Choix enregistré (démo) : ${format(value)} pour votre lecture — ${tier}`,
      associationPortion > 0 ? `Dont ${format(associationPortion)} reversé à l'association (max 50 %).` : ""
    ];
    resultEl.textContent = lines.filter(Boolean).join(" ");
    showMessage(
      associationPortion > 0
        ? `Démo : merci pour ${format(authorPortion)} — ${format(associationPortion)} ira à l'association.`
        : `Démo : merci pour ${format(authorPortion)} — ${tier}`
    );
  }

  slider.addEventListener("input", () => {
    confirmBox.hidden = true;
    refresh();
  });

  for (const chip of chips) {
    chip.addEventListener("click", () => {
      slider.value = chip.dataset.price;
      confirmBox.hidden = true;
      refresh();
    });
  }
  for (const chip of shareChips) {
    chip.addEventListener("click", () => {
      for (const other of shareChips) {
        other.classList.toggle("active", other === chip);
      }
      refresh();
    });
  }

  $("#price-validate").addEventListener("click", () => {
    if (!confirmBox.hidden) {
      return;
    }
    const value = Number(slider.value);
    resultEl.textContent = "";
    if (value > 100) {
      pendingPrice = value;
      confirmText.textContent = `Vous êtes sur le point de choisir ${format(value)} pour votre lecture. C'est un montant élevé : confirmez-vous ?`;
      confirmBox.hidden = false;
      return;
    }
    finish(value);
  });

  $("#price-confirm-yes").addEventListener("click", () => {
    if (pendingPrice !== null) {
      finish(pendingPrice);
      pendingPrice = null;
    }
  });

  $("#price-confirm-no").addEventListener("click", () => {
    confirmBox.hidden = true;
    pendingPrice = null;
  });

  $("#price-reset").addEventListener("click", () => {
    slider.value = 10;
    pendingPrice = null;
    confirmBox.hidden = true;
    resultEl.textContent = "";
    for (const chip of shareChips) {
      chip.classList.toggle("active", Number(chip.dataset.share) === 0);
    }
    refresh();
  });

  refresh();
}

async function refreshDossier() {
  if (!state.user) {
    state.dossier = null;
    updateNav();
    return;
  }
  state.dossier = await api("/api/me");
  renderDossier();
  updateNav();
}

// Le titre du document imprimé sert de nom de fichier proposé par le navigateur :
// on le lit dans le HTML pour que le PDF s'appelle « Lecture symbolique — Caro »
// et non « Lastro — Lecture symbolique … ».
function titreDuDocument(html) {
  const trouve = String(html ?? "").match(/<title>([^<]*)<\/title>/i);
  return trouve ? trouve[1].trim() : "";
}

function nomDeFichier(titre, extension, defaut = "lecture-astrologique") {
  const base = String(titre ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || defaut}.${extension}`;
}

// Nom de fichier proposé par le serveur (`Content-Disposition`).
function nomDepuisDisposition(entete) {
  const correspondance = /filename="([^"]+)"/i.exec(String(entete ?? ""));
  return correspondance ? correspondance[1] : null;
}

// Le jeton de livraison se lit dans le lien de récupération (.../r/<jeton>).
function tokenFromDeliveryLink(link) {
  const valeur = String(link ?? "").trim();
  if (!valeur) return null;
  const correspondance = /\/r\/([A-Za-z0-9]+)\/?$/.exec(valeur);
  return correspondance ? correspondance[1] : null;
}

// Adresse du PDF produit par le serveur, quand il sait le produire.
//
// Le jeton de la livraison est le même secret que la lecture : sans lui, ou sans
// moteur PDF côté serveur, on ne propose pas de rendu automatique.
function pdfUrlForReading() {
  if (state.config?.pdfRenderer !== "chromium") return null;
  const token = state.recovery?.token ?? state.readingToken ?? null;
  if (!token) return null;
  return `/api/public/deliveries/${encodeURIComponent(token)}/pdf`;
}

// Télécharge le PDF du serveur. Renvoie `false` quand le serveur dit qu'il ne
// peut pas le produire (moteur absent ou panne) : l'appelant retombe alors sur
// l'impression du navigateur, sans rien dire de plus au client.
async function telechargerPdf(url) {
  const reponse = await fetch(url, { headers: { accept: "application/pdf" }, credentials: "same-origin" });
  if (reponse.status === 503 || reponse.status === 502) {
    return false;
  }
  if (!reponse.ok) {
    const payload = await reponse.json().catch(() => null);
    throw new Error(payload?.error ?? "Le PDF n'a pas pu être téléchargé.");
  }
  const blob = await reponse.blob();
  const lien = document.createElement("a");
  const adresse = URL.createObjectURL(blob);
  lien.href = adresse;
  lien.download =
    nomDepuisDisposition(reponse.headers.get("content-disposition")) ??
    nomDeFichier(titreDuDocument(state.guestReading?.html ?? ""), "pdf");
  lien.click();
  URL.revokeObjectURL(adresse);
  return true;
}

// Impression du document pour l'enregistrer en PDF.
//
// On imprime depuis un cadre invisible de la page courante, et non depuis une
// fenêtre pop-up : les pop-up bloquées laissaient une page HTML impossible à
// enregistrer en PDF. Si le cadre échoue (navigateur restrictif), on retombe
// sur l'ouverture d'un onglet, seul cas où l'autorisation peut être demandée.
function printHtmlInWindow(html) {
  // Le navigateur propose comme nom de fichier le titre du document imprimé :
  // on aligne le titre de la page hôte le temps de l'impression, puis on le
  // remet. Sans cela, le PDF enregistré portait le titre de l'application.
  const titre = titreDuDocument(html);
  const titrePage = document.title;
  if (titre) {
    document.title = titre;
  }
  const restaurerTitre = () => {
    if (titre) {
      document.title = titrePage;
    }
  };

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.opacity = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const cleanup = () => {
    setTimeout(() => frame.remove(), 60000);
  };

  try {
    const frameDocument = frame.contentWindow.document;
    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();
    frame.addEventListener("load", () => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      restaurerTitre();
      cleanup();
    });
    // Certains navigateurs ne déclenchent pas « load » sur un document écrit
    // à la main : on imprime quand même après un court délai.
    setTimeout(() => {
      if (document.body.contains(frame)) {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        restaurerTitre();
        cleanup();
      }
    }, 700);
    return;
  } catch {
    frame.remove();
    restaurerTitre();
  }

  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) {
    throw new Error("Impossible d'ouvrir l'aperçu d'impression. Utilisez le bouton HTML pour télécharger le document.");
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 500);
}

function updateGuestChrome() {
  const guest = !state.user;
  const onAuthView = state.currentView === "auth";
  const header = $("#guest-header");
  if (header) {
    header.hidden = !guest;
  }
  const backInHeader = $("#guest-back");
  if (backInHeader) {
    backInHeader.hidden = !(guest && onAuthView);
  }
  const proLink = $("#guest-pro-link");
  if (proLink) {
    proLink.hidden = guest && onAuthView;
  }
  const authBack = $("#auth-back");
  if (authBack) {
    authBack.hidden = !guest;
  }
}

function applyGuestLayout() {
  const guest = !state.user;
  document.body.classList.toggle("guest", guest);
  const hero = $("#guest-hero");
  if (hero) {
    hero.hidden = !guest;
  }
  updateGuestChrome();
  return guest;
}

function recoveryTokenFromPath(path = window.location.pathname) {
  const match = String(path).match(/^\/r\/([A-Za-z0-9]+)\/?$/);
  return match ? match[1] : null;
}

// Affiche le lien de récupération, le numéro de commande et les actions
// (copier, supprimer). Utilisé après un paiement et sur la page /r/<jeton>.
function renderDeliveryBox(delivery, { justPaid = false } = {}) {
  const box = $("#delivery-box");
  if (!box || !delivery) {
    return;
  }
  const t = uiStrings();
  const keep = $("#delivery-keep");
  if (keep) {
    keep.textContent = t.deliveryKeep;
  }
  const link = $("#delivery-link");
  if (link) {
    link.href = delivery.link;
    link.textContent = delivery.link;
  }
  const copy = $("#delivery-copy");
  if (copy) {
    copy.textContent = t.deliveryCopy;
    copy.dataset.link = delivery.link;
  }
  $("#delivery-order-label") && ($("#delivery-order-label").textContent = t.deliveryOrderLabel);
  const reference = $("#delivery-order-value");
  if (reference) {
    reference.textContent = delivery.reference ?? "";
  }
  const emailed = $("#delivery-emailed");
  if (emailed) {
    emailed.hidden = !delivery.emailSent;
    emailed.textContent = delivery.emailSent ? t.deliveryEmailed : "";
  }
  const remove = $("#delivery-delete");
  if (remove) {
    remove.textContent = t.deliveryDelete;
    remove.hidden = false;
  }
  box.hidden = false;
  box.classList.toggle("just-paid", justPaid);
}

function renderRecoveryState(status) {
  const box = $("#recovery-box");
  const message = $("#recovery-message");
  const retry = $("#recovery-retry");
  const t = uiStrings();
  if (!box || !message) {
    return;
  }
  const texts = {
    pending: t.recoveryPending,
    failed: t.recoveryFailed,
    unknown: t.recoveryUnknown
  };
  message.textContent = texts[status] ?? texts.unknown;
  box.hidden = false;
  if (retry) {
    retry.hidden = status !== "failed";
    retry.textContent = t.recoveryRetry;
  }
}

// Champs de lieu du parcours public : nom du champ → encadré de résultat.
// Toute ville saisie doit pouvoir être reconnue (lieu de naissance et ceux des
// parents), sans quoi le texte reçu n'est qu'une chaîne non vérifiée.
const EXPRESS_PLACE_FIELDS = [
  ["birthPlace", "express-place-details"],
  ["motherBirthPlace", "mother-place-details"],
  ["fatherBirthPlace", "father-place-details"]
];

function bindExpressForm() {
  const form = $("#express-form");
  if (!form) {
    return;
  }
  $("#express-resolve-place").addEventListener("click", () => {
    resolvePlaceForForm(form, "express-place-details", null, true);
  });
  field(form, "birthPlace").addEventListener("input", () => {
    field(form, "resolvedPlace").value = "";
    $("#express-place-details").hidden = true;
  });
  // Tous les champs de lieu du parcours public, avec leur encadré de résultat.
  // Les lieux des parents n'étaient branchés sur RIEN : on tapait une ville sans
  // reconnaissance ni correction possible. Cette liste est vérifiée par un test
  // contre les champs réellement présents dans le formulaire.
  for (const [nom, detailsId] of EXPRESS_PLACE_FIELDS) {
    const champ = field(form, nom);
    if (champ) {
      attachPlaceAutocomplete(champ, { detailsId, usePublic: true });
    }
  }

  const precisionSelect = field(form, "timePrecision");
  const timeWrap = $("#express-time-label");
  const timeText = $("#express-time-text");
  const marginWrap = $("#express-margin-label");
  const marginHint = $("#express-margin-hint");
  const intervalWrap = $("#express-interval-fields");
  const syncTimeVisibility = () => {
    const value = precisionSelect.value;
    timeWrap.hidden = !(value === "exact" || value === "approximate");
    intervalWrap.hidden = value !== "interval";
    // Heure approximative : on demande « vers quelle heure » et la marge qui
    // borne réellement les angles, les maisons et la secte.
    const approximate = value === "approximate";
    if (marginWrap) {
      marginWrap.hidden = !approximate;
    }
    if (marginHint) {
      marginHint.hidden = !approximate;
    }
    if (timeText) {
      timeText.textContent = approximate ? "Heure approximative (ex. 10:00)" : "Heure";
    }
  };
  precisionSelect.addEventListener("change", syncTimeVisibility);
  syncTimeVisibility();

  $("#guest-pro-link")?.addEventListener("click", () => {
    setView("auth");
  });

  const backToReading = () => setView("express");
  $("#guest-back")?.addEventListener("click", backToReading);
  $("#auth-back")?.addEventListener("click", backToReading);

  // ---------- paiement Stripe intégré (montant libre) ----------
  const amountInput = $("#pay-amount");
  const presets = $all("#pay-presets .chip");

  const syncPresets = () => {
    const amount = Number(amountInput?.value ?? 0);
    for (const chip of presets) {
      chip.classList.toggle("active", Number(chip.dataset.amount) === Math.round(amount * 100));
    }
  };
  if (amountInput) {
    amountInput.addEventListener("input", syncPresets);
  }
  for (const chip of presets) {
    chip.addEventListener("click", () => {
      if (amountInput) {
        amountInput.value = String(Math.round(Number(chip.dataset.amount) / 100));
      }
      syncPresets();
    });
  }

  const setPayStatus = (text) => {
    const status = $("#pay-status");
    if (status) {
      status.textContent = text ?? "";
      status.hidden = !text;
    }
  };

  const loadStripeJs = () => {
    if (window.Stripe) {
      return Promise.resolve(window.Stripe);
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.onload = () => resolve(window.Stripe);
      script.onerror = () => reject(new Error("Impossible de charger Stripe."));
      document.head.append(script);
    });
  };

  let embeddedCheckout = null;

  const startPayment = async () => {
    const body = state.pendingReadingBody;
    if (!body) {
      return;
    }
    // Code de test : aucun paiement, la lecture est offerte. Le code est vérifié
    // par le serveur, jamais ici.
    const testCode = testCodeInput ? testCodeInput.value.trim() : "";
    if (testCode) {
      const button = $("#pay-start");
      if (button) {
        button.disabled = true;
      }
      setPayStatus(uiStrings().payPreparing);
      await runGeneration(null, testCode);
      return;
    }
    const payments = state.config?.payments ?? {};
    // Montant libre : plancher à 5 €, aucun plafond (celui qui veut donner plus le peut).
    // Champ vide → on propose le montant par défaut (20 €) ; en dessous du minimum,
    // on corrige sur le minimum et on explique, sans jamais valider en silence.
    const raw = amountInput ? String(amountInput.value).trim() : "";
    const typed = raw === "" ? DEFAULT_PAYMENT_EUROS : Math.round(Number(raw));
    const belowMinimum = !Number.isFinite(typed) || typed < MIN_PAYMENT_EUROS;
    const euros = belowMinimum ? MIN_PAYMENT_EUROS : typed;
    if (amountInput) {
      amountInput.value = String(euros);
      syncPresets();
    }
    if (belowMinimum) {
      showMessage(uiStrings().payRange, true);
      return;
    }
    const startButton = $("#pay-start");
    startButton.disabled = true;
    setPayStatus(uiStrings().payPreparing);
    try {
      const session = await api("/api/public/checkout-session", {
        method: "POST",
        body: { amountCents: euros * 100, label: "Lecture symbolique Lastro" }
      });
      state.paymentSessionId = session.sessionId;
      const Stripe = await loadStripeJs();
      const stripe = Stripe(payments.publishableKey);
      if (embeddedCheckout) {
        embeddedCheckout.destroy();
        embeddedCheckout = null;
      }
      embeddedCheckout = await stripe.initEmbeddedCheckout({
        fetchClientSecret: async () => session.clientSecret,
        onComplete: () => runGeneration(state.paymentSessionId)
      });
      embeddedCheckout.mount("#checkout-container");
      $("#checkout-container").hidden = false;
      $("#pay-continue").hidden = false;
      startButton.hidden = true;
      setPayStatus("");
    } catch (error) {
      startButton.disabled = false;
      setPayStatus("");
      showMessage(error.message, true);
    }
  };

  // Accès gratuit de test : le code est saisi ici mais vérifié par le serveur
  // (aucun code n'est présent dans ce fichier, il vit dans les variables
  // d'environnement). Le lien n'apparaît que si un code est configuré.
  const testCodeBox = $("#test-code-box");
  const testCodeToggle = $("#test-code-toggle");
  const testCodeFields = $("#test-code-fields");
  const testCodeInput = $("#test-code");
  const syncTestCodeAvailability = () => {
    const enabled = Boolean(state.config?.testCodeEnabled);
    if (testCodeBox) {
      testCodeBox.hidden = !enabled;
    }
    if (testCodeToggle) {
      testCodeToggle.hidden = !enabled || !(testCodeFields?.hidden ?? true);
    }
  };
  testCodeToggle?.addEventListener("click", () => {
    if (testCodeFields) {
      testCodeFields.hidden = false;
    }
    testCodeToggle.hidden = true;
    testCodeInput?.focus();
  });
  testCodeInput?.addEventListener("input", () => {
    const hasCode = Boolean(testCodeInput.value.trim());
    const button = $("#pay-start");
    if (button && !button.hidden) {
      button.textContent = hasCode ? uiStrings().submit : uiStrings().payStart;
    }
  });
  syncTestCodeAvailability();

  const consent = $("#ai-consent");
  const startButton = $("#pay-start");
  const syncConsent = () => {
    if (startButton) {
      startButton.disabled = !(consent?.checked ?? false);
    }
  };
  consent?.addEventListener("change", syncConsent);
  syncConsent();

  $("#pay-start")?.addEventListener("click", startPayment);
  $("#pay-continue")?.addEventListener("click", () => {
    if (state.paymentSessionId) {
      runGeneration(state.paymentSessionId);
    }
  });

  const runGeneration = async (paymentSessionId = null, testCode = null) => {
    const form = $("#express-form");
    const submitButton = form.querySelector('button[type="submit"]');
    const body = state.pendingReadingBody;
    if (!body) {
      return;
    }
    const originalLabel = submitButton.textContent;
    try {
      submitButton.disabled = true;
      submitButton.textContent = `${uiStrings().submit} …`;
      $("#express-payment").hidden = true;
      $("#express-progress").hidden = false;
      showMessage(paymentSessionId ? uiStrings().payConfirmed : "Calcul puis rédaction de votre lecture… patientez 1 à 2 minutes.");

      const reading = await api("/api/public/readings", {
        method: "POST",
        body: { ...body, paymentSessionId, ...(testCode ? { testCode } : {}) }
      });
      state.guestReading = { html: reading.html, markdown: reading.markdown };
      state.readingToken = tokenFromDeliveryLink(reading.delivery?.link) ?? state.readingToken;
      $("#express-viewer").hidden = false;
      $("#express-frame").srcdoc = reading.html;
      $("#express-progress").hidden = true;
      const verification = reading.verification ?? null;
      const verificationSuffix =
        verification?.status === "checked"
          ? ` — vérification croisée : ${verification.issues.length} remarque(s), ${verification.correctedCount} correction(s).`
          : verification?.status === "failed"
            ? " — vérification croisée indisponible."
            : "";
      const prefix = reading.freeAccess
        ? `${uiStrings().testCodeApplied} `
        : reading.writerMode === "llm"
          ? "Lecture prête — téléchargez-la, elle n'est conservée nulle part."
          : "Lecture générée en brouillon technique (socle vérifié complet).";
      showMessage(`${prefix}${verificationSuffix}`);
      if (reading.delivery) {
        renderDeliveryBox(reading.delivery, { justPaid: true });
      }
    } catch (error) {
      $("#express-progress").hidden = true;
      $("#express-payment").hidden = false;
      syncConsent();
      showMessage(error.message, true);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(await ensureResolvedPlace(form, "express-place-details", true))) {
      return;
    }
    const payload = formPayload(form);
    // Marge d'incertitude : seulement pour une heure approximative. Le serveur
    // applique ±30 min par défaut si rien n'est envoyé.
    const marginField = field(form, "timeMarginMinutes");
    const timePrecision = payload.timePrecision ?? "unknown";
    state.pendingReadingBody = {
      firstName: payload.firstName || null,
      language: currentLanguage(),
      birthDate: payload.birthDate,
      timePrecision,
      timeValue: payload.timeValue || null,
      timeMarginMinutes:
        timePrecision === "approximate" && marginField?.value ? Number(marginField.value) : null,
      timeStart: payload.timeStart || null,
      timeEnd: payload.timeEnd || null,
      birthPlace: payload.birthPlace || null,
      resolvedPlace: payload.resolvedPlace ?? null,
      intention: payload.intention || null,
      parents: deliverableParentsFromForm(form)
    };

    const payments = state.config?.payments ?? {};
    // Même règle que côté serveur : pas de rédacteur, pas de vente. Le serveur
    // refuse de toute façon, mais autant ne pas ouvrir le paiement pour rien.
    if (payments.configured && state.config?.llmConfigured === false) {
      showMessage(uiStrings().llmUnavailable, true);
      return;
    }
    if (payments.configured) {
      const panel = $("#express-payment");
      panel.hidden = false;
      syncTestCodeAvailability();
      panel.scrollIntoView({ behavior: "smooth", block: "center" });
      syncPresets();
      return;
    }
    await runGeneration(null);
  });

  $("#guest-download-html").addEventListener("click", () => {
    if (!state.guestReading) return;
    const blob = new Blob([state.guestReading.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomDeFichier(titreDuDocument(state.guestReading.html), "html");
    link.click();
    URL.revokeObjectURL(url);
  });
  $("#guest-download-md").addEventListener("click", () => {
    if (!state.guestReading) return;
    const blob = new Blob([state.guestReading.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomDeFichier(titreDuDocument(state.guestReading.html), "md");
    link.click();
    URL.revokeObjectURL(url);
  });
  $("#guest-download-pdf").addEventListener("click", async () => {
    if (!state.guestReading) return;
    // Rendu serveur quand le moteur est actif : un vrai fichier, sans la date ni
    // l'adresse que la fenêtre d'impression ajoute. Sinon — ou si le rendu échoue
    // — on garde exactement le comportement d'avant : la fenêtre d'impression.
    const url = pdfUrlForReading();
    if (url) {
      try {
        if (await telechargerPdf(url)) {
          return;
        }
      } catch (error) {
        showMessage(error.message, true);
        return;
      }
    }
    try {
      printHtmlInWindow(state.guestReading.html);
      showMessage(uiStrings().pdfHint);
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  // --- lien de récupération : copier, relancer, supprimer -------------------
  const copyDeliveryLink = async () => {
    const button = $("#delivery-copy");
    const link = button?.dataset.link ?? $("#delivery-link")?.href ?? "";
    if (!link) {
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      showMessage(uiStrings().deliveryCopied);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : le lien
      // reste sélectionnable à l'écran.
      window.prompt(uiStrings().deliveryCopy, link);
    }
  };
  $("#delivery-copy")?.addEventListener("click", copyDeliveryLink);

  $("#delivery-delete")?.addEventListener("click", async () => {
    const token = state.recovery?.token ?? recoveryTokenFromPath();
    if (!token) {
      return;
    }
    try {
      await api(`/api/public/deliveries/${encodeURIComponent(token)}`, { method: "DELETE" });
      state.guestReading = null;
      state.readingToken = null;
      $("#delivery-box").hidden = true;
      $("#express-viewer").hidden = true;
      showMessage(uiStrings().deliveryDelete + " ✓");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#recovery-retry")?.addEventListener("click", async () => {
    const token = recoveryTokenFromPath();
    if (!token) {
      return;
    }
    const retry = $("#recovery-retry");
    retry.disabled = true;
    showMessage(uiStrings().payPreparing);
    try {
      const result = await api(`/api/public/deliveries/${encodeURIComponent(token)}/regenerate`, { method: "POST" });
      showDelivery(result.delivery, { token });
    } catch (error) {
      showMessage(error.message, true);
      renderRecoveryState("failed");
    } finally {
      retry.disabled = false;
    }
  });

  // Affiche une livraison : la lecture si elle est prête, sinon l'état en cours.
  const showDelivery = (delivery, { token } = {}) => {
    state.recovery = delivery ? { token: token ?? delivery.token ?? null, reference: delivery.reference } : null;
    state.readingToken = delivery ? token ?? delivery.token ?? null : null;
    $("#express-payment").hidden = true;
    $("#express-progress").hidden = true;
    if (!delivery) {
      $("#express-viewer").hidden = false;
      $("#express-frame").hidden = true;
      $("#express-actions").hidden = true;
      $("#delivery-box").hidden = true;
      renderRecoveryState("unknown");
      return;
    }
    if (delivery.status === "ready" && delivery.reading) {
      state.guestReading = { html: delivery.reading.html, markdown: delivery.reading.markdown };
      $("#express-viewer").hidden = false;
      $("#express-frame").hidden = false;
      $("#express-actions").hidden = false;
      $("#express-frame").srcdoc = delivery.reading.html ?? "";
      $("#recovery-box").hidden = true;
      renderDeliveryBox({ ...delivery, link: window.location.href }, { justPaid: false });
      return;
    }
    // Pas de lecture à montrer : on masque le cadre vide et les téléchargements.
    $("#express-viewer").hidden = false;
    $("#express-frame").hidden = true;
    $("#express-actions").hidden = true;
    $("#delivery-box").hidden = true;
    if (delivery.status === "failed") {
      renderRecoveryState("failed");
      return;
    }
    renderRecoveryState("pending");
  };

  const loadRecovery = async () => {
    const token = recoveryTokenFromPath();
    if (!token) {
      return;
    }
    document.body.classList.add("recovery");
    $("#guest-hero").hidden = true;
    const form = $("#express-form");
    if (form) {
      form.hidden = true;
    }
    try {
      const result = await api(`/api/public/deliveries/${encodeURIComponent(token)}`);
      showDelivery(result.delivery, { token });
    } catch {
      showDelivery(null, { token });
    }
  };

  window.__lastroLoadRecovery = loadRecovery;

  // « Vous avez déjà payé ? » : le client redonne son numéro de commande et son
  // e-mail ; le lien repart à cette adresse (réponse identique dans tous les cas).
  $("#recover-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = $("#recover-status");
    const submit = $("#recover-submit");
    if (submit) {
      submit.disabled = true;
    }
    if (status) {
      status.hidden = false;
      status.textContent = uiStrings().payPreparing;
    }
    try {
      await api("/api/public/deliveries/recover", {
        method: "POST",
        body: {
          reference: $("#recover-reference")?.value ?? "",
          email: $("#recover-email")?.value ?? ""
        }
      });
      if (status) {
        status.textContent = uiStrings().findSent;
      }
    } catch (error) {
      if (status) {
        status.textContent = error.message;
      }
    } finally {
      if (submit) {
        submit.disabled = false;
      }
    }
  });
}

function bindForms() {
  bindPriceSlider();
  bindExpressForm();
  initLanguageSelector();
  $("#register-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api("/api/auth/register", { method: "POST", body: formData(event.currentTarget) });
      $("#verify-form").email.value = result.user.email;
      showMessage(`Compte créé. Code de vérification développement : ${result.devVerificationCode}`);
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#verify-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/auth/verify", { method: "POST", body: formData(event.currentTarget) });
      showMessage("E-mail vérifié. Vous pouvez vous connecter.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api("/api/auth/login", { method: "POST", body: formData(event.currentTarget) });
      state.user = result.user;
      applyGuestLayout();
      await refreshDossier();
      setView("profile");
      showMessage("Connexion réussie.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#logout-button").addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST" });
    state.user = null;
    state.dossier = null;
    updateNav();
    applyGuestLayout();
    setView("express");
    showMessage("Déconnecté. Vous repartez sur la lecture simple.");
  });

  $("#export-account-button").addEventListener("click", async () => {
    try {
      const payload = await api("/api/me/export");
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(`astrolab-export-${date}.json`, payload);
      showMessage("Export préparé.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#delete-account-button").addEventListener("click", async () => {
    if (!confirm("Supprimer ce compte ? Cette action ferme les sessions et bloque les accès futurs.")) {
      return;
    }

    try {
      await api("/api/me", { method: "DELETE" });
      state.user = null;
      state.dossier = null;
      updateNav();
      applyGuestLayout();
      setView("express");
      showMessage("Compte supprimé. Vous repartez sur la lecture simple.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      if (!(await ensureResolvedPlace(form, "profile-place-details"))) {
        return;
      }
      await api("/api/me/profile", { method: "PUT", body: formPayload(form) });
      await refreshDossier();
      showMessage("Profil enregistré avec incertitude conservée.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#profile-resolve-place").addEventListener("click", async () => {
    await resolvePlaceForForm($("#profile-form"), "profile-place-details");
  });
  field($("#profile-form"), "birthPlace").addEventListener("input", () => {
    field($("#profile-form"), "resolvedPlace").value = "";
    $("#profile-place-details").hidden = true;
  });
  attachPlaceAutocomplete(field($("#profile-form"), "birthPlace"), { detailsId: "profile-place-details" });

  $("#natal-person").addEventListener("change", fillNatalForm);

  $("#natal-resolve-place").addEventListener("click", async () => {
    await resolvePlaceForForm($("#natal-form"), "natal-place-details");
  });
  field($("#natal-form"), "birthPlace").addEventListener("input", () => {
    field($("#natal-form"), "resolvedPlace").value = "";
    $("#natal-place-details").hidden = true;
  });
  attachPlaceAutocomplete(field($("#natal-form"), "birthPlace"), { detailsId: "natal-place-details" });

  $("#natal-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      if (!(await ensureResolvedPlace(form, "natal-place-details"))) {
        return;
      }
      const preservedValues = captureFormValues(form);
      const result = await api("/api/western-natal/calculate", { method: "POST", body: formPayload(form) });
      renderNatalResult(result);
      await refreshDossier();
      restoreFormValues(form, preservedValues);
      if (preservedValues.resolvedPlace) {
        showResolvedPlace("natal-place-details", JSON.parse(preservedValues.resolvedPlace));
      }
      showMessage("Calcul Western Natal V1 enregistré comme run de développement.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#copy-natal-json").addEventListener("click", async () => {
    try {
      await copyText($("#natal-json").textContent);
      showMessage("Artefact JSON copié.");
    } catch (error) {
      showMessage("Copie impossible depuis ce navigateur.", true);
    }
  });

  $("#person-resolve-place").addEventListener("click", async () => {
    await resolvePlaceForForm($("#person-form"), "person-place-details");
  });
  field($("#person-form"), "birthPlace").addEventListener("input", () => {
    field($("#person-form"), "resolvedPlace").value = "";
    $("#person-place-details").hidden = true;
  });
  attachPlaceAutocomplete(field($("#person-form"), "birthPlace"), { detailsId: "person-place-details" });

  $("#person-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const wantsBirth = Boolean(
        field(form, "birthDate").value || field(form, "birthPlace").value.trim() || field(form, "timeValue").value
      );
      if (wantsBirth && !(await ensureResolvedPlace(form, "person-place-details"))) {
        return;
      }
      await api("/api/people", { method: "POST", body: formPayload(form) });
      form.reset();
      await refreshDossier();
      showMessage("Personne ajoutée.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#relationship-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const body = formData(event.currentTarget);
      if (body.fromPersonId === body.toPersonId) {
        throw new Error("Choisissez deux personnes différentes.");
      }
      await api("/api/relationships", { method: "POST", body });
      await refreshDossier();
      showMessage("Relation enregistrée.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#analysis-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/analyses", { method: "POST", body: formData(event.currentTarget) });
      await refreshAnalyses();
      await refreshDossier();
      showMessage("Analyse versionnée créée.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $("#deliverable-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalLabel = submitButton ? submitButton.textContent : "";
    try {
      const personId = field(form, "personId").value;
      if (!personId) {
        throw new Error("Choisissez une personne disposant de données de naissance (onglet Profil).");
      }
      submitButton.disabled = true;
      submitButton.textContent = "Génération…";
      $("#deliverable-progress-label").textContent = "Génération du dossier en cours…";
      setDeliverableProgress({ completedSteps: 0, totalSteps: 12, currentSection: null });

      const body = {
        personId,
        intention: field(form, "intention").value.trim() || null,
        parents: deliverableParentsFromForm(form)
      };
      const started = await api("/api/deliverables", { method: "POST", body });
      const id = started.deliverable.id;
      const done = await pollDeliverableGeneration(id);
      const deliverable = done.deliverable;
      if (deliverable.status === "failed") {
        throw new Error(deliverable.error ?? "La génération a échoué. Réessayez.");
      }
      $("#deliverable-progress").hidden = true;
      await refreshDeliverables();
      await openDeliverable(id);
      showMessage(
        deliverable.writerMode === "llm"
          ? "Dossier généré avec rédaction IA — à relire avant livraison."
          : "Dossier généré en brouillon technique : socle vérifié complet ; configurez ASTROLAB_LLM_API_KEY pour activer la rédaction narrative."
      );
    } catch (error) {
      $("#deliverable-progress").hidden = true;
      showMessage(error.message, true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
      }
    }
  });

  $("#download-deliverable-html").addEventListener("click", () => {
    if (state.activeDeliverableId) {
      downloadDeliverable(state.activeDeliverableId, "html");
    }
  });
  $("#download-deliverable-md").addEventListener("click", () => {
    if (state.activeDeliverableId) {
      downloadDeliverable(state.activeDeliverableId, "md");
    }
  });
  $("#export-deliverable-pdf").addEventListener("click", async () => {
    if (!state.activeDeliverableId) {
      return;
    }
    try {
      await exportDeliverablePdf(state.activeDeliverableId);
    } catch (error) {
      showMessage(error.message, true);
    }
  });
  $("#review-deliverable-button").addEventListener("click", async () => {
    try {
      await toggleDeliverableReview();
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $all(".nav-button").forEach((button) => {
    button.addEventListener("click", async () => {
      setView(button.dataset.view);
      if (button.dataset.view === "analyses") {
        await refreshAnalyses();
      }
      if (button.dataset.view === "natal") {
        fillNatalForm();
      }
      if (button.dataset.view === "methods") {
        await renderMethods();
      }
      if (button.dataset.view === "deliverables") {
        await refreshDeliverables();
      }
      if (button.dataset.view === "commerce") {
        if (state.config?.commerceEnabled === false) {
          showMessage("La partie commerciale est désactivée sur cette instance.", true);
          return;
        }
        await renderCommerce();
      }
      if (button.dataset.view === "admin") {
        await renderAdmin();
      }
    });
  });
}

async function loadConfig() {
  try {
    state.config = await api("/api/config");
  } catch {
    state.config = { commerceEnabled: true, llmConfigured: false, production: false };
  }
  const commerceNav = document.querySelector('.nav-button[data-view="commerce"]');
  if (commerceNav && state.config.commerceEnabled === false) {
    commerceNav.hidden = true;
    const sectionLabel = commerceNav.previousElementSibling;
    if (sectionLabel?.classList.contains("nav-section")) {
      sectionLabel.hidden = true;
    }
  }
  if (state.config.allowRegistration === false) {
    const registerForm = $("#register-form");
    const verifyForm = $("#verify-form");
    if (registerForm) {
      registerForm.hidden = true;
    }
    if (verifyForm) {
      verifyForm.hidden = true;
    }
  }
}

async function boot() {
  bindForms();
  await loadConfig();
  if (recoveryTokenFromPath()) {
    // Lien de récupération : page visiteur, sans la coquille de l'espace pro,
    // et la lecture s'affiche à la place du formulaire.
    state.currentView = "express";
    applyGuestLayout();
    setView("express");
    if (typeof window.__lastroLoadRecovery === "function") {
      await window.__lastroLoadRecovery();
    }
    return;
  }
  const session = await api("/api/session");
  state.user = session.user;
  applyGuestLayout();
  if (state.user) {
    await refreshDossier();
    setView("profile");
  } else {
    updateNav();
    setView("express");
  }
  await renderMethods();
}

boot().catch((error) => showMessage(error.message, true));
