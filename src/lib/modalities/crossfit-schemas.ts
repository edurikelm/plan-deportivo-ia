/**
 * CrossFit modality — server-side entry point.
 *
 * This module uses Node.js built-ins (fs, path) and must only be imported
 * in server contexts (API routes, Server Components).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";

// ─── Types ──────────────────────────────────────────────────────────────────

/** A modality registered in the system (e.g. CrossFit). */
export interface Modality {
  id: string;
  label: string;
  description: string;
  accent: string;
  iconKey: string;
}

// ─── Canonical context ────────────────────────────────────────────────────────

export function loadCrossFitContext(): string {
  return readFileSync(
    join(process.cwd(), "docs", "instrucciones-crossfit.md"),
    "utf-8",
  );
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

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

export const CrossFitPlanSchema = z.object({
  class_title: z.string().min(1).optional().default("Sesión CrossFit"),
  focus_movement: z.string().min(1).optional().default(""),
  estimated_duration_min: z.number().int().positive().optional().default(60),
  sections: z.object({
    warm_up: z.object({
      duration_min: z.number().int().nonnegative().optional().default(10),
      description: z.string().min(1).optional().default("Calentamiento general."),
    }),
    strength_skill: z.object({
      duration_min: z.number().int().nonnegative().optional().default(20),
      description: z.string().min(1).optional().default("Trabajo principal."),
    }),
    wod: z.object({
      format: z.string().min(1).optional().default("AMRAP"),
      time_cap_min: z.number().int().positive().optional().default(12),
      description: z.string().min(1).optional().default("Workout of the Day."),
      score_type: z.string().min(1).optional().default("Rondas + Reps"),
    }),
    cool_down: z.object({
      duration_min: z.number().int().nonnegative().optional().default(8),
      description: z.string().min(1).optional().default("Vuelta a la calma."),
    }),
  }),
});
export type CrossFitPlan = z.infer<typeof CrossFitPlanSchema>;

// ─── Markdown converter ───────────────────────────────────────────────────────

export function crossfitPlanToMarkdown(plan: CrossFitPlan): string {
  const { sections } = plan;
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
    ``,
    `---`,
    ``,
    `## Strength / Skill`,
    ``,
    `_${sections.strength_skill.duration_min} min_`,
    ``,
    sections.strength_skill.description,
    ``,
    `---`,
    ``,
    `## WOD — ${sections.wod.format}`,
    ``,
    `_${sections.wod.time_cap_min} min · ${sections.wod.score_type}_`,
    ``,
    sections.wod.description,
    ``,
    `---`,
    ``,
    `## Cool Down`,
    ``,
    `_${sections.cool_down.duration_min} min_`,
    ``,
    sections.cool_down.description,
  ]
    .filter(Boolean)
    .join("\n");
}

// ─── Aleatorio resolver ───────────────────────────────────────────────────────

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

// ─── Session generator ────────────────────────────────────────────────────────

export async function generateCrossFitSession(
  input: CrossFitSessionInput,
): Promise<{ content: string; structured: CrossFitPlan; model: string }> {
  const context = loadCrossFitContext();
  const resolvedFormat =
    input.wodFormat === "Aleatorio"
      ? resolveAleatorio(input.strengthSkill)
      : input.wodFormat;

  const systemPrompt = [
    context,
    "",
    `## Parámetros de esta sesión`,
    `- Strength/Skill: ${input.strengthSkill}`,
    `- Formato WOD: ${resolvedFormat}${input.wodFormat === "Aleatorio" ? " (resuelto de Aleatorio)" : ""}`,
    input.focusMovement ? `- Movimiento foco: ${input.focusMovement}` : "",
    input.considerations ? `- Consideraciones del entrenador: ${input.considerations}` : "",
    `- Duración total objetivo: ${input.durationMinutes} min`,
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = [
    `Generá la estructura de la clase de CrossFit para esta sesión.`,
    ``,
    `Parámetros:`,
    `- Strength/Skill: ${input.strengthSkill}`,
    `- Formato WOD: ${resolvedFormat}`,
    input.focusMovement ? `- Foco de movimiento: ${input.focusMovement}` : "",
    input.considerations ? `- Consideraciones: ${input.considerations}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Call LLM — no response_format (MiniMax-M3 does not support it)
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    baseURL: "https://api.minimax.io/v1",
    apiKey: process.env.MINIMAX_API_KEY,
  });

  const response = await client.chat.completions.create({
    model: "MiniMax-M3",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4096,
    // @ts-expect-error MiniMax-specific param not in OpenAI SDK types
    thinking: { type: "disabled" as const },
  });

  const rawContent =
    response.choices[0]?.message?.content ??
    (() => {
      throw new Error("Empty response from AI provider");
    })();

  // Strip think blocks
  const strippedContent = rawContent
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Extract JSON object — LLM may add ```json fences or surrounding prose.
  // Falls back to the first balanced { ... } block when fences are missing
  // or malformed (e.g. unclosed fence inside a truncated response).
  function extractPlanJson(raw: string): string {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced && fenced[1]) {
      const candidate = fenced[1].trim();
      if (candidate.startsWith("{") && candidate.endsWith("}")) {
        return candidate;
      }
    }
    const firstBrace = raw.indexOf("{");
    if (firstBrace === -1) return "";
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = firstBrace; i < raw.length; i++) {
      const ch = raw[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return raw.slice(firstBrace, i + 1);
      }
    }
    return "";
  }

  // Parse + validate with Zod — retry once on failure.
  // `parseError` records the LAST error (either JSON.parse or Zod safeParse).
  let parsed: CrossFitPlan | undefined;
  let parseError: Error | null = null;
  let planJson = extractPlanJson(strippedContent);

  for (let attempt = 0; attempt < 2; attempt++) {
    let jsonCandidate: unknown;
    if (planJson) {
      try {
        jsonCandidate = JSON.parse(planJson);
      } catch (err) {
        parseError = err instanceof Error ? err : new Error(String(err));
      }
    } else {
      parseError = new Error("No JSON object found in LLM response");
    }

    if (jsonCandidate !== undefined) {
      const result = CrossFitPlanSchema.safeParse(jsonCandidate);
      if (result.success) {
        parsed = result.data;
        parseError = null;
        break;
      }
      parseError = result.error;
    }

    if (attempt === 0) {
      const retryResponse = await client.chat.completions.create({
        model: "MiniMax-M3",
        messages: [
          {
            role: "system",
            content:
              systemPrompt +
              "\n\nIMPORTANTE: Respondé EXCLUSIVAMENTE con un único objeto JSON válido (RFC 8259), sin texto antes ni después, sin bloques de markdown ``` ni fences. Todas las comillas dentro de los strings deben ser escapadas con \\\\.",
          },
          {
            role: "user",
            content:
              userPrompt +
              "\n\nReintentá la generación. Devolvé únicamente el objeto JSON completo y bien formado.",
          },
        ],
        temperature: 0.5,
        max_tokens: 4096,
        // @ts-expect-error MiniMax-specific param not in OpenAI SDK types
        thinking: { type: "disabled" as const },
      });
      const retryContent = retryResponse.choices[0]?.message?.content ?? "";
      planJson = extractPlanJson(retryContent);
    }
  }

  if (!parsed) {
    throw new Error(
      `Invalid JSON from AI after 2 attempts: ${parseError?.message ?? "unknown"}`,
    );
  }

  const content = crossfitPlanToMarkdown(parsed);
  return { content, structured: parsed, model: "MiniMax-M3" };
}
