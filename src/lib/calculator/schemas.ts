/**
 * Calculator — server-side schemas, M3 client, and breakdown utilities.
 * Safe to import in both API routes and Server Components.
 */
import { z } from "zod";

// ─── DiscRow ────────────────────────────────────────────────────────────────

export const DiscRowSchema = z.object({
  weight: z.number().positive("El peso debe ser mayor a 0"),
  unit: z.enum(["kg", "lb"]),
  count: z.number().int().min(1, "La cantidad debe ser al menos 1"),
});
export type DiscRow = z.infer<typeof DiscRowSchema>;

// ─── Breakdown ─────────────────────────────────────────────────────────────

export const BreakdownSchema = z.object({
  barKg: z.number().positive(),
  discs: z.array(DiscRowSchema),
  totalKg: z.number().positive(),
  totalLb: z.number().positive(),
});
export type Breakdown = z.infer<typeof BreakdownSchema>;

// ─── CalculatorState (localStorage shape) ─────────────────────────────────

export type CalculatorState = {
  barKg: number;
  discs: DiscRow[];
};

// ─── SavedWeightRecord (persisted history entry) ────────────────────────────

import type { RecordSource, SavedWeightRecord } from "../types";

export const RecordSourceSchema = z.enum(["auto-log", "manual", "foto"]);

export const SavedWeightRecordSchema = z.object({
  id: z.string().min(1),
  // We accept any non-empty string for createdAt and trust the runtime to
  // produce ISO 8601. Strict ISO validation would over-reject records
  // written by older code paths before we standardized the format.
  createdAt: z.string().min(1),
  // null only for auto-log; manual/foto require a non-empty trimmed name.
  exercise: z
    .string()
    .trim()
    .min(1, "El nombre del ejercicio no puede estar vacío")
    .max(80, "El nombre del ejercicio es demasiado largo")
    .nullable(),
  barKg: z.number().positive("El peso de la barra debe ser mayor a 0"),
  discs: z.array(DiscRowSchema),
  totalKg: z.number().positive(),
  totalLb: z.number().positive(),
  breakdownLine: z
    .string()
    .min(1, "El desglose no puede estar vacío")
    .max(200, "El desglose es demasiado largo"),
  source: RecordSourceSchema,
  // Reps: required for new manual records, null for legacy/foto. The
  // `.default(null)` lets legacy records (pre-0036) rehydrate without
  // the field — they get `reps: null` and are excluded from 1RM
  // estimation but still appear in the progression charts.
  reps: z
    .number()
    .int("Las reps deben ser un número entero")
    .min(1, "Las reps deben ser al menos 1")
    .nullable()
    .default(null),
  // Manual override flag. Defaults to false so legacy records parse
  // without the field. Drives the 1RM aggregation when set.
  isOneRepMax: z.boolean().default(false),
});

export type { RecordSource, SavedWeightRecord };

// ─── Vision model constants ─────────────────────────────────────────────────

export const VISION_MODEL = "MiniMax-M3";

export const VISION_SYSTEM_PROMPT = `Sos un asistente que identifica el equipamiento en una foto de una barra de levantamiento. Tu única tarea es devolver un objeto JSON válido con este esquema exacto:

{
  "barKg": number,        // peso de la barra sola, en kg. Defaults: Olympic=20, Women's=15.
  "discs": [{              // discos cargados, UNO POR LADO. Si ambos lados tienen los
    "weight": number,      // mismos discos, listá UNA entrada por peso (no dupliques).
    "unit": "kg" | "lb",   // unidad reportada en la placa (o estimada por tamaño).
    "count": integer       // cantidad de placas de este peso en UN lado. Default 1.
  }],
  "totalKg": number,       // barKg + 2 × Σ(disc.weight_kg × disc.count). Calculado.
  "totalLb": number        // totalKg × 2.20462. Calculado.
}

Reglas:
1. Si no podés identificar la barra, devolvé barKg = 20 (default Olympic) y marcalo
   con un campo "uncertain": true. El usuario va a confirmar manualmente.
2. Identificá los discos por color y tamaño, no por marcas. Las marcas pueden estar
   gastadas o ser ilegibles.
3. Si una placa parece estar entre dos tamaños estándar (ej. 1.25 kg vs 1 kg),
   estimá a la baja y avisá con "uncertain": true en la entrada correspondiente.
4. Devolvé SOLO el JSON. Sin texto antes ni después. Sin fences markdown.`;

// ─── M3 vision call ─────────────────────────────────────────────────────────

/**
 * Sends an image to MiniMax-M3 with vision input and returns a validated Breakdown.
 * Uses `thinking: { type: "disabled" }` to get clean JSON.
 */
export async function calculateBreakdownFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<Breakdown> {
  const { default: OpenAI } = await import("openai");

  const client = new OpenAI({
    baseURL: "https://api.minimax.io/v1",
    apiKey: process.env.MINIMAX_API_KEY,
  });

  const dataUrl = `data:${mimeType};base64,${imageBase64}`;

  // Build the message content parts array — image_url is MiniMax-specific, not in the OpenAI SDK types
  type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
  const contentParts: ContentPart[] = [
    { type: "text", text: "Identificá los pesos en esta barra." },
    { type: "image_url", image_url: { url: dataUrl } },
  ];

  // Cast to any to bypass OpenAI SDK types — MiniMax supports image_url and thinking
  const response = await client.chat.completions.create({
    model: VISION_MODEL,
    messages: [{ role: "user", content: contentParts }],
    thinking: { type: "disabled" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  const rawContent =
    response.choices[0]?.message?.content ??
    (() => {
      throw new Error("Empty response from vision model");
    })();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error(
      `Invalid JSON from vision model: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = BreakdownSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Zod validation failed: ${result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  return result.data;
}

// ─── Cross-check ────────────────────────────────────────────────────────────

export interface CrossCheckResult {
  ok: boolean;
  detail: string;
  computedKg: number;
  computedLb: number;
}

/**
 * Computes totals from the breakdown and compares against IA-reported totals.
 * Uses 50g tolerance for floating-point rounding.
 */
export function crossCheckBreakdown(breakdown: Breakdown): CrossCheckResult {
  const lbToKg = (lb: number) => lb / 2.20462;
  const computedKg =
    breakdown.barKg +
    breakdown.discs.reduce(
      (acc, d) =>
        acc +
        2 *
          (d.unit === "kg"
            ? d.weight * d.count
            : lbToKg(d.weight) * d.count),
      0,
    );
  const computedLb = computedKg * 2.20462;
  const kgDiff = Math.abs(computedKg - breakdown.totalKg);
  const lbDiff = Math.abs(computedLb - breakdown.totalLb);
  const tolerance = 0.05; // 50 grams
  const ok = kgDiff < tolerance && lbDiff < tolerance;
  const detail = ok
    ? `totals match (Δkg=${kgDiff.toFixed(4)}, Δlb=${lbDiff.toFixed(4)})`
    : `MISMATCH — computed ${computedKg.toFixed(3)}kg / ${computedLb.toFixed(3)}lb, IA says ${breakdown.totalKg}kg / ${breakdown.totalLb}lb (Δkg=${kgDiff.toFixed(3)}, Δlb=${lbDiff.toFixed(3)})`;

  return { ok, detail, computedKg, computedLb };
}

// ─── Display formatter ──────────────────────────────────────────────────────

/**
 * Formats the calculator state as a human-readable breakdown line for the sticky footer.
 * e.g. "20kg + (55lb + 2.5kg)×2"
 *
 * Spec rules:
 * - count === 1 rows → grouped into a single parenthesised segment + "×2"
 * - count > 1 rows → rendered inline as "(weightunit)×count"
 * - empty discs → just "{barKg}kg"
 */
export function formatBreakdownLine(state: CalculatorState): string {
  const bar = `${state.barKg}kg`;

  if (state.discs.length === 0) return bar;

  const singleCount = state.discs.filter((d) => d.count === 1);
  const multiCount = state.discs.filter((d) => d.count > 1);

  const parts: string[] = [bar];

  // All count===1 discs grouped into "(a + b + c)×2"
  if (singleCount.length > 0) {
    const labels = singleCount.map((d) => `${d.weight}${d.unit}`);
    parts.push(`(${labels.join(" + ")})×2`);
  }

  // count>1 discs rendered inline as "(xkg)×n"
  for (const disc of multiCount) {
    parts.push(`(${disc.weight}${disc.unit})×${disc.count}`);
  }

  return parts.join(" + ");
}
