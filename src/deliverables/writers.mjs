// Writers for client dossier sections.
//
// Two implementations:
// - LLM writer: OpenAI-compatible chat completions (fetch), configured by env
//   ASTROLAB_LLM_API_KEY / ASTROLAB_LLM_BASE_URL / ASTROLAB_LLM_MODEL. It only ever
//   receives verified facts and writing directives, never permission to create facts.
// - Template writer (fallback, deterministic, no network): used when no LLM is
//   configured or in tests. It explicitly states that narrative writing is disabled,
//   so a dossier produced without a key is never mistaken for a finished client text.

import { FRAME_DIRECTIVES } from "./plan.mjs";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

export function llmConfiguration() {
  const apiKey = process.env.ASTROLAB_LLM_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return {
    apiKey,
    baseUrl: process.env.ASTROLAB_LLM_BASE_URL?.trim() || DEFAULT_BASE_URL,
    model: process.env.ASTROLAB_LLM_MODEL?.trim() || DEFAULT_MODEL
  };
}

export async function callChatCompletions(config, { system, user, temperature = 0.7 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        temperature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const error = new Error(`LLM request failed (${response.status}) ${detail.slice(0, 300)}`);
      error.status = 502;
      throw error;
    }
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) {
      const error = new Error("LLM returned an empty response");
      error.status = 502;
      throw error;
    }
    const usage = data?.usage ?? null;
    return {
      text: text.trim(),
      model: config.model,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens ?? null,
            completionTokens: usage.completion_tokens ?? null,
            totalTokens: usage.total_tokens ?? null
          }
        : null
    };
  } finally {
    clearTimeout(timeout);
  }
}

// Quand l'heure de naissance est inconnue, l'axe et les maisons ne sont pas
// calculés : sans cette consigne, le modèle comble le vide et invente un
// ascendant, ce qui est une conclusion fausse présentée comme un fait.
const TIME_UNKNOWN_DIRECTIVE =
  "Règle absolue : l'heure de naissance n'est pas connue. L'Ascendant, le Milieu du Ciel, le Descendant, le Fond du Ciel, les maisons et la secte NE SONT PAS calculés. Tu ne dois jamais les nommer, les supposer, les déduire ni les évoquer indirectement : pas de « votre ascendant », pas de « en maison 7 », pas de « selon votre heure de naissance ». Rédige uniquement à partir des planètes, des signes et des aspects effectivement calculés, et indique clairement, quand c'est utile, que l'axe et les maisons ne peuvent pas être établis sans l'heure de naissance.";

function buildSystemPrompt(section, context = {}) {
  const languageName = context.languageName ?? "French";
  const parts = [
    "Tu es l'auteur expert d'un dossier de lecture symbolique et astrologique personnalisé.",
    languageName === "French"
      ? "Tu écris en français, avec respect, profondeur, clarté et humanité."
      : `Tu écris en ${languageName}, avec respect, profondeur, clarté et humanité. Tout le texte produit doit être en ${languageName}, jamais en français.`,
    "Adaptation culturelle : n'effectue pas une traduction mot à mot. Écris comme un auteur natif de cette culture, avec son ton, ses tournures et ses références ; adapte les exemples, les métaphores et les conventions (dates, ordre des noms, unités) au public visé. Ne cite aucune référence culturelle française.",
    ...(context.styleGuide ? [`Guide de style attendu : ${context.styleGuide}`] : []),
    ...(context.uncertainty?.timeKnown === false
      ? [
          TIME_UNKNOWN_DIRECTIVE,
          `Éléments explicitement non calculés : ${(context.uncertainty.indeterminable ?? []).join(", ") || "ascendant, maisons, secte"}.`
        ]
      : []),
    ...FRAME_DIRECTIVES,
    `Section à produire : « ${section.title} ».`,
    ...(section.directives ?? [])
  ];
  return parts.join("\n");
}

function buildUserPayload(section, context) {
  return JSON.stringify(
    {
      section: section.id,
      person: context.person ?? {},
      parents: context.parents ?? [],
      intention: context.intention ?? null,
      socleFacts: context.socle?.facts ?? [],
      alreadyWritten: context.previousSections ?? [],
      birthTimeKnown: context.uncertainty?.timeKnown ?? null,
      notCalculated: context.uncertainty?.indeterminable ?? [],
      calculationWarnings: context.uncertainty?.warnings ?? [],
      instruction: "Rédige uniquement le corps de cette section (sans titre répété), en paragraphes continus."
    },
    null,
    2
  );
}

export async function writeWithLlm(section, context, config) {
  const result = await callChatCompletions(config, {
    system: buildSystemPrompt(section, context),
    user: buildUserPayload(section, context)
  });
  return {
    text: stripCodeFences(result.text),
    provider: "llm",
    model: config.model,
    usage: result.usage
  };
}

function stripCodeFences(text) {
  const match = text.match(/^```(?:markdown)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1].trim() : text;
}

export function writeWithTemplate(section) {
  const note =
    "Rédaction narrative non activée : aucune clé de rédacteur IA n'est configurée " +
    "(variable ASTROLAB_LLM_API_KEY). Cette section est donc un brouillon technique, " +
    "pas un texte de livraison. L'annexe « socle de calcul vérifié » ci-dessous est complète " +
    "et utilisable telle quelle.";
  return {
    text: `_Section « ${section.title} » — brouillon généré sans rédacteur IA._\n\n${note}`,
    provider: "template"
  };
}

export async function writeSection(section, context, options = {}) {
  if (options.writerFn) {
    const result = await options.writerFn(section, context);
    return typeof result === "string" ? { text: result, provider: "injected" } : result;
  }
  if (options.config) {
    return writeWithLlm(section, context, options.config);
  }
  const configured = llmConfiguration();
  if (configured) {
    return writeWithLlm(section, context, configured);
  }
  return writeWithTemplate(section);
}
