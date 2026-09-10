// Vérification croisée du texte par un second modèle (Google Gemini).
//
// Objectif : relire la lecture rédigée par le premier modèle, la comparer aux
// faits calculés et corrigés, signaler les contradictions/inventions, et
// proposer une version corrigée quand c'est nécessaire.
//
// Activation par variables d'environnement :
//   GOOGLE_API_KEY (ou GEMINI_API_KEY) — clé de l'API Google AI
//   GEMINI_MODEL                        — par défaut « gemini-2.5-flash »
//   ASTROLAB_CROSS_CHECK=0              — désactive la vérification
//
// Si aucune clé n'est fournie, la vérification est simplement ignorée.

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export function crossCheckConfiguration() {
  const apiKey = (process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    return null;
  }
  return {
    apiKey,
    model: (process.env.GEMINI_MODEL ?? "").trim() || "gemini-2.5-flash"
  };
}

export function crossCheckEnabled() {
  return Boolean(crossCheckConfiguration()) && process.env.ASTROLAB_CROSS_CHECK !== "0";
}

function parseJsonObject(text) {
  const cleaned = String(text ?? "").replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function crossCheckReading({ sections = [], socle = null, language = "fr" } = {}) {
  const config = crossCheckConfiguration();
  if (!config) {
    return { status: "skipped", reason: "no_api_key", provider: null, model: null, issues: [], corrections: {} };
  }
  if (process.env.ASTROLAB_CROSS_CHECK === "0") {
    return { status: "skipped", reason: "disabled", provider: "gemini", model: config.model, issues: [], corrections: {} };
  }

  const written = sections.filter((section) => section.provider === "llm" && section.text?.trim());
  if (written.length === 0) {
    return { status: "skipped", reason: "nothing_to_check", provider: "gemini", model: config.model, issues: [], corrections: {} };
  }

  const facts = (socle?.facts ?? []).map((fact) => `- ${fact.label} : ${fact.value}`).join("\n");
  const texts = written.map((section) => `### ${section.id}\n${section.text}`).join("\n\n");

  const prompt = [
    "Tu es un vérificateur rigoureux de lectures astrologiques symboliques.",
    "On te donne (A) les FAITS CALCULÉS ET VÉRIFIÉS, et (B) des TEXTES rédigés par une IA.",
    "Ta mission : repérer uniquement (1) les contradictions avec les faits, (2) les éléments inventés qui ne figurent pas dans les faits, (3) les erreurs de langue ou de style graves, (4) les affirmations trop certaines ou culpabilisantes.",
    "Ne réécris pas pour le plaisir : si un texte est correct, ne le renvoie pas.",
    `Réponds UNIQUEMENT en JSON valide, sans texte autour, sous cette forme :`,
    '{"issues":[{"section":"identifiant","severity":"error|warning","message":"explication courte"}],"corrections":{"identifiant":"texte corrigé complet"}}',
    `Les textes sont en langue « ${language} » : les corrections doivent rester dans cette langue, garder le même style, le même ton et une longueur comparable.`,
    "N'ajoute aucun fait nouveau qui ne soit pas dans les FAITS VÉRIFIÉS.",
    "",
    "(A) FAITS VÉRIFIÉS :",
    facts || "(aucun)",
    "",
    "(B) TEXTES À VÉRIFIER :",
    texts
  ].join("\n");

  try {
    const response = await fetch(
      `${GEMINI_ENDPOINT}/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
        })
      }
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        status: "failed",
        reason: `gemini_${response.status}`,
        detail: detail.slice(0, 200),
        provider: "gemini",
        model: config.model,
        issues: [],
        corrections: {}
      };
    }
    const data = await response.json();
    const text = (data?.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("");
    const parsed = parseJsonObject(text);
    return {
      status: "checked",
      reason: null,
      provider: "gemini",
      model: config.model,
      issues: Array.isArray(parsed?.issues) ? parsed.issues : [],
      corrections: parsed?.corrections && typeof parsed.corrections === "object" ? parsed.corrections : {}
    };
  } catch (error) {
    return {
      status: "failed",
      reason: "network_error",
      detail: String(error?.message ?? "").slice(0, 200),
      provider: "gemini",
      model: config.model,
      issues: [],
      corrections: {}
    };
  }
}
