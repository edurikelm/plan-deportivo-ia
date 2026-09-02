/**
 * CrossFit modality — server-side entry point.
 *
 * Generator uses `MiniMax-Text-01` (text-01 — supports native JSON output
 * via prompt, even though `response_format: json_object` is rejected by the
 * API). The model returns clean JSON ~13s avg latency (vs ~30s for M2.7-highspeed).
 * The validated JSON is then converted to markdown for Copiar / Exportar.
 *
 * This module must only be imported in server contexts (API routes,
 * Server Components) — it pulls `openai` and uses Node.js semantics.
 */
import { z } from "zod";

// ─── Modality shape (shared type, no Node.js built-ins) ─────────────────────

/** A modality registered in the system (e.g. CrossFit). */
export interface Modality {
  id: string;
  label: string;
  description: string;
  accent: string;
  iconKey: string;
}

// ─── Input schema (Zod) ──────────────────────────────────────────────────────

export const WOD_FORMATS = [
  "AMRAP",
  "EMOM",
  "For Time",
  "Tabata",
  "Intervalos",
  "Aleatorio",
] as const;
export type WodFormat = (typeof WOD_FORMATS)[number];

export const DURATION_OPTIONS = [45, 60, 75, 90] as const;
export type DurationOption = (typeof DURATION_OPTIONS)[number];

export const CrossFitSessionInputSchema = z.object({
  durationMinutes: z.enum(["45", "60", "75", "90"]).default("60"),
  strengthSkill: z.string().min(1, "Strength/Skill es obligatorio"),
  wodFormat: z.enum(WOD_FORMATS),
  focusMovement: z.string().optional(),
  considerations: z.string().optional(),
});
export type CrossFitSessionInput = z.infer<typeof CrossFitSessionInputSchema>;

// ─── Output schema (Zod) — with defaults so missing fields fall through ──────

export const CrossFitPlanSchema = z.object({
  class_title: z.string().min(1).default("Sesión CrossFit"),
  focus_movement: z.string().default(""),
  estimated_duration_min: z.number().int().positive().default(60),
  sections: z.object({
    warm_up: z.object({
      duration_min: z.number().int().nonnegative().default(10),
      description: z.string().min(1).default("Calentamiento general."),
      exercises: z.array(z.string()).default([]),
    }),
    strength_skill: z.object({
      duration_min: z.number().int().nonnegative().default(20),
      description: z.string().min(1).default("Trabajo principal."),
      exercises: z.array(z.string()).default([]),
    }),
    wod: z.object({
      format: z.string().min(1).default("AMRAP"),
      time_cap_min: z.number().int().positive().default(12),
      description: z.string().min(1).default("Workout of the Day."),
      score_type: z.string().min(1).default("Rondas + Reps"),
      exercises: z.array(z.string()).default([]),
    }),
    cool_down: z.object({
      duration_min: z.number().int().nonnegative().default(8),
      description: z.string().min(1).default("Vuelta a la calma."),
      exercises: z.array(z.string()).default([]),
    }),
  }),
});
export type CrossFitPlan = z.infer<typeof CrossFitPlanSchema>;

// ─── Markdown converter ──────────────────────────────────────────────────────

export function crossfitPlanToMarkdown(plan: CrossFitPlan): string {
  const { sections } = plan;
  const exerciseList = (xs: readonly string[]): string[] =>
    xs.length > 0 ? ["", ...xs.map((x) => `- ${x}`)] : [];
  return [
    `# ${plan.class_title}`,
    ``,
    `**Enfoque:** ${plan.focus_movement}  `,
    `**Duración estimada:** ${plan.estimated_duration_min} min`,
    ``,
    `---`,
    ``,
    `## Warm-Up`,
    ``,
    `_${sections.warm_up.duration_min} min_`,
    ``,
    sections.warm_up.description,
    ...exerciseList(sections.warm_up.exercises),
    ``,
    `---`,
    ``,
    `## Strength / Skill`,
    ``,
    `_${sections.strength_skill.duration_min} min_`,
    ``,
    sections.strength_skill.description,
    ...exerciseList(sections.strength_skill.exercises),
    ``,
    `---`,
    ``,
    `## WOD — ${sections.wod.format}`,
    ``,
    `_${sections.wod.time_cap_min} min · ${sections.wod.score_type}_`,
    ``,
    sections.wod.description,
    ...exerciseList(sections.wod.exercises),
    ``,
    `---`,
    ``,
    `## Cool Down`,
    ``,
    `_${sections.cool_down.duration_min} min_`,
    ``,
    sections.cool_down.description,
    ...exerciseList(sections.cool_down.exercises),
  ]
    .filter(Boolean)
    .join("\n");
}

// ─── Aleatorio resolver ──────────────────────────────────────────────────────

const RESOLVED_FORMATS: Omit<WodFormat, "Aleatorio">[] = [
  "AMRAP",
  "EMOM",
  "For Time",
  "Tabata",
  "Intervalos",
];

export function resolveAleatorio(strengthSkill: string): WodFormat {
  let hash = 0;
  for (let i = 0; i < strengthSkill.length; i++) {
    hash = (hash << 5) - hash + strengthSkill.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % RESOLVED_FORMATS.length;
  return RESOLVED_FORMATS[index] as WodFormat;
}

// ─── Session generator ───────────────────────────────────────────────────────

/**
 * Provider and model identifier used by the CrossFit generator. Exported so
 * the `/settings` page (issue 0025) can surface them as read-only metadata
 * without hardcoding the same strings in two places. When the model
 * changes, update this constant — every call site (including the settings
 * page) will follow.
 */
export const PROVIDER = "MiniMax";
export const MODEL = "MiniMax-Text-01";

/**
 * System prompt that asks for JSON output via prompt (no `response_format` —
 * the API rejects it on Text-01, per eval report 0011). Defaults are baked
 * into the schema so that even a partial JSON response is recoverable.
 */
const JSON_SYSTEM_PROMPT = `Sos un coach deportivo especializado en CrossFit (CF-L3/L4). Tu única tarea es generar la estructura completa de una clase de CrossFit para los parámetros provistos. Respondé únicamente con un objeto JSON válido que cumpla este esquema exacto:

{
  "class_title": "string (título descriptivo y motivador)",
  "focus_movement": "string (movimiento técnico principal)",
  "estimated_duration_min": "integer (duración total en minutos)",
  "sections": {
    "warm_up": {
      "duration_min": "integer",
      "description": "string (prose introductoria del bloque, sin enumerar ejercicios)",
      "exercises": ["array de strings, cada uno una línea de la rutina — p. ej. '10 Scapular Pull Ups', '3x5 Air Squats'"]
    },
    "strength_skill": {
      "duration_min": "integer",
      "description": "string (prose introductoria)",
      "exercises": ["array de strings — p. ej. '5x5 Back Squat @ 70% 1RM'"]
    },
    "wod": {
      "format": "string (uno de: AMRAP, EMOM, \"For Time\", Tabata, Intervalos)",
      "time_cap_min": "integer",
      "description": "string (prose introductoria del WOD)",
      "score_type": "string (Rondas + Reps | Tiempo | Peso | Calorías)",
      "exercises": ["array de strings — p. ej. '5 Push Press (135/95 lbs)', '10 Pull Ups (RX)', '15 Box Jumps (24/20 in)'"]
    },
    "cool_down": {
      "duration_min": "integer",
      "description": "string (prose introductoria)",
      "exercises": ["array de strings — p. ej. '2 min Foam Rolling', '3x10 Banded Lat Stretch', '5 Downward Dogs'"]
    }
  }
}

Reglas:
1. Estructura obligatoria: 4 secciones en orden (warm_up, strength_skill, wod, cool_down).
2. Nomenclatura: terminología CrossFit oficial (Thrusters, Snatch, Double Unders, HSPU, RX, Scaled).
3. Coherencia: Warm-Up y Cool Down deben activar/recuperar los grupos del movimiento principal.
4. description = solo una prose introductoria. NO enumeres ejercicios dentro de description. Todos los ejercicios van como elementos del array exercises.
5. Respondé SOLO con el JSON. Sin texto antes ni después. Sin bloques markdown.`;

const RETRY_SYSTEM_PROMPT_SUFFIX = `

IMPORTANTE: Tu respuesta anterior fue rechazada porque contenía fences markdown (\`\`\`json), backticks, o texto antes/después del objeto JSON. Esta vez respondé EXCLUSIVAMENTE con el objeto JSON crudo, sin fences markdown, sin backticks, sin texto adicional antes ni después del JSON. Si tu respuesta anterior fue buena pero tuvo formato incorrecto, esta vez asegurate de emitir JSON puro.`;

// ─── Markdown fence stripper ───────────────────────────────────────────────────

/**
 * Strips leading and trailing markdown code fences from content.
 * Only strips if a clear opening fence exists at the start of the trimmed
 * content AND a clear closing fence exists at the end. If only an opening
 * fence is present (truncated response), strips only the opening and lets
 * the rest through — better to fail parsing and trigger the retry than to
 * silently discard content after a stray backtick.
 * Returns the content unchanged if no opening fence is detected.
 */
function stripMarkdownFences(content: string): string {
  const s = content.trim();

  const openMatch = s.match(/^```(\w+)?\s*\n?/);
  if (!openMatch) return s;

  const stripped = s.slice(openMatch[0].length);
  const closingFence = stripped.match(/\n?```\s*$/);
  if (!closingFence) return stripped.trim();

  return stripped.slice(0, stripped.length - closingFence[0].length).trim();
}

// ─── JSON parser with strip-and-retry ────────────────────────────────────────

/**
 * Attempts JSON.parse on the raw content.
 * On first failure, strips markdown fences and retries.
 * Throws with a diagnostic snippet if both attempts fail.
 */
function parseJsonResponse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch (firstErr) {
    const stripped = stripMarkdownFences(content);
    if (stripped !== content.trim()) {
      try {
        return JSON.parse(stripped);
      } catch {
        // Fall through — first error message is more useful for debugging.
      }
    }
    throw new Error(
      `Invalid JSON from AI: ${firstErr instanceof Error ? firstErr.message : String(firstErr)}. Raw start: ${content.slice(0, 200)}`,
    );
  }
}

export interface GenerateCrossFitSessionResult {
  content: string;
  structured: CrossFitPlan;
  model: string;
}

export async function generateCrossFitSession(
  input: CrossFitSessionInput,
): Promise<GenerateCrossFitSessionResult> {
  const resolvedFormat =
    input.wodFormat === "Aleatorio"
      ? resolveAleatorio(input.strengthSkill)
      : input.wodFormat;

  const userPrompt = [
    "Generá la sesión con estos parámetros:",
    "",
    `- Duración total objetivo: ${input.durationMinutes} min.`,
    `- Strength/Skill: ${input.strengthSkill}.`,
    `- Formato WOD: ${resolvedFormat}${input.wodFormat === "Aleatorio" ? " (resuelto de Aleatorio)" : ""}.`,
    input.focusMovement ? `- Movimiento foco: ${input.focusMovement}.` : "",
    input.considerations ? `- Consideraciones del entrenador: ${input.considerations}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    baseURL: "https://api.minimax.io/v1",
    apiKey: process.env.MINIMAX_API_KEY,
  });

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: JSON_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4096,
    // No response_format: Text-01 rejects it (see 0011 eval).
  });

  const rawContent =
    response.choices[0]?.message?.content ??
    (() => {
      throw new Error("Empty response from AI provider");
    })();

  let parsedJson: unknown;
  try {
    parsedJson = parseJsonResponse(rawContent);
  } catch (parseErr) {
    console.warn(
      `[generateCrossFitSession] First parse attempt failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}. Retrying with reinforced prompt.`,
    );
    // Retry una vez con prompt reforzado.
    const retryResponse = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: JSON_SYSTEM_PROMPT + RETRY_SYSTEM_PROMPT_SUFFIX },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });

    const retryContent =
      retryResponse.choices[0]?.message?.content ??
      (() => {
        throw new Error("Empty response from AI provider on retry");
      })();

    try {
      parsedJson = parseJsonResponse(retryContent);
    } catch (retryErr) {
      throw new Error(
        `Invalid JSON from AI after retry: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}. Raw start: ${retryContent.slice(0, 200)}`,
      );
    }
  }

  const result = CrossFitPlanSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new Error(
      `Zod validation failed: ${result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  const structured = result.data;
  const content = crossfitPlanToMarkdown(structured);
  return { content, structured, model: MODEL };
}
