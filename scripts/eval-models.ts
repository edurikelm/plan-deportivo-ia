/**
 * Model evaluation — compares MiniMax-M2.7-highspeed (markdown) against
 * MiniMax-Text-01 (JSON via response_format) on a representative CrossFit
 * input battery.
 *
 * Run with: `npm run eval:models` (requires MINIMAX_API_KEY in env or .env.local).
 * Output: console table + markdown report at docs/agents/eval/eval-models-report.md.
 *
 * Captures per call: latency, total tokens, response size, format validity
 * (markdown headers for M2.7; JSON parse + Zod schema for Text-01).
 */
import OpenAI from "openai";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";

// ─── .env loader (Node 22 doesn't auto-load .env.local for standalone scripts) ─

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(".env.local"));
loadEnvFile(path.resolve(".env"));

// ─── Config ─────────────────────────────────────────────────────────────────

const BASE_URL = "https://api.minimax.io/v1";
const API_KEY = process.env.MINIMAX_API_KEY;
if (!API_KEY) {
  console.error("✗ MINIMAX_API_KEY not set. Set it in env or .env.local.");
  process.exit(1);
}

const client = new OpenAI({ baseURL: BASE_URL, apiKey: API_KEY });

// ─── Test inputs ────────────────────────────────────────────────────────────

type TestInput = {
  label: string;
  durationMinutes: "45" | "60" | "75" | "90";
  strengthSkill: string;
  wodFormat: "AMRAP" | "EMOM" | "For Time" | "Tabata" | "Intervalos" | "Aleatorio";
  focusMovement?: string;
  considerations?: string;
};

const INPUTS: TestInput[] = [
  {
    label: "AMRAP + Back Squat",
    durationMinutes: "60",
    strengthSkill: "Back Squat 5x5 @ 70% 1RM",
    wodFormat: "AMRAP",
  },
  {
    label: "EMOM + Snatch",
    durationMinutes: "60",
    strengthSkill: "Power Snatch technique 5x3 @ 60%",
    wodFormat: "EMOM",
  },
  {
    label: "Aleatorio + Thruster",
    durationMinutes: "60",
    strengthSkill: "Thruster 5x5 strict",
    wodFormat: "Aleatorio",
  },
  {
    label: "Tabata + Muscle-up",
    durationMinutes: "45",
    strengthSkill: "Strict Muscle-up progressions 4x3",
    wodFormat: "Tabata",
    focusMovement: "Muscle-up",
  },
  {
    label: "For Time + Deadlift",
    durationMinutes: "75",
    strengthSkill: "Deadlift 5x3 @ 80%",
    wodFormat: "For Time",
    considerations: "Lesión leve en hombro derecho",
  },
  {
    label: "Intervalos + Handstand",
    durationMinutes: "90",
    strengthSkill: "Handstand hold 4x30s + Wall walks",
    wodFormat: "Intervalos",
    focusMovement: "Handstand",
  },
];

// ─── Prompts ────────────────────────────────────────────────────────────────

const MARKDOWN_SYSTEM_PROMPT = [
  "Sos un coach deportivo especializado en CrossFit (CF-L3/L4). Tu única tarea es generar la estructura completa de una clase de CrossFit para los parámetros provistos.",
  "",
  "## Estructura obligatoria",
  "Toda clase debe tener exactamente 4 secciones en este orden:",
  "1. Warm-Up (Calentamiento)",
  "2. Strength / Skill (Técnica o Fuerza)",
  "3. WOD (Workout of the Day)",
  "4. Cool Down (Vuelta a la calma)",
  "",
  "## Formatos WOD permitidos",
  "AMRAP, EMOM, For Time, Tabata, Intervalos.",
  "",
  "## Nomenclatura",
  "Usá terminología técnica oficial de CrossFit en inglés/español estándar (Thrusters, Snatch, Double Unders, HSPU, RX, Scaled, Time Cap).",
  "",
  "## Coherencia anatómica",
  "El Warm-Up y el Cool Down deben estar diseñados directamente para los grupos musculares y patrones del movimiento principal y del WOD.",
  "",
  "## Formato de salida",
  "Respondé ÚNICAMENTE con el markdown de la sesión, con esta jerarquía exacta de headers:",
  "- `# {Título de la clase}` (en la primera línea)",
  "- `## Warm-Up`",
  "- `## Strength / Skill`",
  "- `## WOD — {formato}`",
  "- `## Cool Down`",
  "",
  "Sin prosa antes ni después del markdown. Sin bloques de código ```.",
].join("\n");

const JSON_SYSTEM_PROMPT = `Sos un coach deportivo especializado en CrossFit (CF-L3/L4). Tu única tarea es generar la estructura completa de una clase de CrossFit para los parámetros provistos. Respondé únicamente con un objeto JSON válido que cumpla este esquema exacto:

{
  "class_title": "string (título descriptivo y motivador)",
  "focus_movement": "string (movimiento técnico principal)",
  "estimated_duration_min": "integer (duración total en minutos)",
  "sections": {
    "warm_up": { "duration_min": "integer", "description": "string no vacío" },
    "strength_skill": { "duration_min": "integer", "description": "string no vacío" },
    "wod": {
      "format": "string (uno de: AMRAP, EMOM, \"For Time\", Tabata, Intervalos)",
      "time_cap_min": "integer",
      "description": "string no vacío",
      "score_type": "string (Rondas + Reps | Tiempo | Peso | Calorías)"
    },
    "cool_down": { "duration_min": "integer", "description": "string no vacío" }
  }
}

Reglas:
1. Estructura obligatoria: 4 secciones en orden (warm_up, strength_skill, wod, cool_down).
2. Nomenclatura: terminología CrossFit oficial (Thrusters, Snatch, Double Unders, HSPU, RX, Scaled).
3. Coherencia: Warm-Up y Cool Down deben activar/recuperar los grupos del movimiento principal.
4. Respondé SOLO con el JSON. Sin texto antes ni después. Sin bloques markdown.`;

function buildUserPrompt(input: TestInput): string {
  return [
    "Generá la sesión con estos parámetros:",
    "",
    `- Duración total objetivo: ${input.durationMinutes} min.`,
    `- Strength/Skill: ${input.strengthSkill}.`,
    `- Formato WOD: ${input.wodFormat}.`,
    input.focusMovement ? `- Movimiento foco: ${input.focusMovement}.` : "",
    input.considerations ? `- Consideraciones del entrenador: ${input.considerations}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// ─── Zod schema (for Text-01 JSON validation) ───────────────────────────────

const CrossFitPlanEvalSchema = z.object({
  class_title: z.string().min(1).default("Sesión CrossFit"),
  focus_movement: z.string().default(""),
  estimated_duration_min: z.number().int().positive().default(60),
  sections: z.object({
    warm_up: z.object({
      duration_min: z.number().int().nonnegative().default(10),
      description: z.string().min(1).default("Calentamiento general."),
    }),
    strength_skill: z.object({
      duration_min: z.number().int().nonnegative().default(20),
      description: z.string().min(1).default("Trabajo principal."),
    }),
    wod: z.object({
      format: z.string().min(1).default("AMRAP"),
      time_cap_min: z.number().int().positive().default(12),
      description: z.string().min(1).default("Workout of the Day."),
      score_type: z.string().min(1).default("Rondas + Reps"),
    }),
    cool_down: z.object({
      duration_min: z.number().int().nonnegative().default(8),
      description: z.string().min(1).default("Vuelta a la calma."),
    }),
  }),
});

// ─── Eval runner ────────────────────────────────────────────────────────────

type EvalResult = {
  input: string;
  model: string;
  latencyMs: number;
  totalTokens: number | null;
  responseLength: number;
  success: boolean;
  error?: string;
  formatValid?: boolean;
  formatDetail?: string;
  preview: string;
};

async function evalMarkdown(input: TestInput): Promise<EvalResult> {
  const start = Date.now();
  try {
    const response = await client.chat.completions.create({
      model: "MiniMax-M2.7-highspeed",
      messages: [
        { role: "system", content: MARKDOWN_SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });
    const latency = Date.now() - start;
    const content = response.choices[0]?.message?.content ?? "";
    const headersOK = ["# ", "## Warm-Up", "## Strength / Skill", "## WOD", "## Cool Down"].every((h) =>
      content.includes(h),
    );
    const headersMissing = ["# ", "## Warm-Up", "## Strength / Skill", "## WOD", "## Cool Down"].filter(
      (h) => !content.includes(h),
    );
    return {
      input: input.label,
      model: "MiniMax-M2.7-highspeed",
      latencyMs: latency,
      totalTokens: response.usage?.total_tokens ?? null,
      responseLength: content.length,
      success: true,
      formatValid: headersOK,
      formatDetail: headersOK ? "all 4 headers" : `missing: ${headersMissing.join(", ")}`,
      preview: content.slice(0, 200).replace(/\|/g, "\\|").replace(/\n/g, " "),
    };
  } catch (err) {
    return {
      input: input.label,
      model: "MiniMax-M2.7-highspeed",
      latencyMs: Date.now() - start,
      totalTokens: null,
      responseLength: 0,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      preview: "",
    };
  }
}

async function evalMarkdownThinkingOff(input: TestInput): Promise<EvalResult> {
  const start = Date.now();
  try {
    const response = await client.chat.completions.create({
      model: "MiniMax-M2.7-highspeed",
      messages: [
        { role: "system", content: MARKDOWN_SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
      temperature: 0.7,
      max_tokens: 4096,
      // @ts-expect-error MiniMax-specific param not in OpenAI SDK types
      thinking: { type: "disabled" },
    });
    const latency = Date.now() - start;
    const content = response.choices[0]?.message?.content ?? "";
    const headersOK = ["# ", "## Warm-Up", "## Strength / Skill", "## WOD", "## Cool Down"].every((h) =>
      content.includes(h),
    );
    const headersMissing = ["# ", "## Warm-Up", "## Strength / Skill", "## WOD", "## Cool Down"].filter(
      (h) => !content.includes(h),
    );
    return {
      input: input.label,
      model: "M2.7-highspeed+thinking:off",
      latencyMs: latency,
      totalTokens: response.usage?.total_tokens ?? null,
      responseLength: content.length,
      success: true,
      formatValid: headersOK,
      formatDetail: headersOK ? "all 4 headers" : `missing: ${headersMissing.join(", ")}`,
      preview: content.slice(0, 200).replace(/\|/g, "\\|").replace(/\n/g, " "),
    };
  } catch (err) {
    return {
      input: input.label,
      model: "M2.7-highspeed+thinking:off",
      latencyMs: Date.now() - start,
      totalTokens: null,
      responseLength: 0,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      preview: "",
    };
  }
}

async function evalJsonTextNoFormat(input: TestInput): Promise<EvalResult> {
  const start = Date.now();
  try {
    // No response_format — just prompt-based JSON. Tests if Text-01 returns
    // valid JSON anyway (the ADR-0003 claim was that Text-01 supports
    // response_format, but the empirical run shows it rejects the param).
    const response = await client.chat.completions.create({
      model: "MiniMax-Text-01",
      messages: [
        { role: "system", content: JSON_SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });
    const latency = Date.now() - start;
    const content = response.choices[0]?.message?.content ?? "";

    let parsed: unknown = null;
    let jsonValid = false;
    let schemaValid = false;
    let detail = "";
    try {
      parsed = JSON.parse(content);
      jsonValid = typeof parsed === "object" && parsed !== null;
    } catch (e) {
      detail = `JSON.parse failed: ${e instanceof Error ? e.message : String(e)}`;
    }

    if (jsonValid) {
      const result = CrossFitPlanEvalSchema.safeParse(parsed);
      schemaValid = result.success;
      if (!schemaValid && result.error) {
        detail = `Zod: ${result.error.issues.slice(0, 2).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`;
      }
    }

    return {
      input: input.label,
      model: "MiniMax-Text-01 (no response_format)",
      latencyMs: latency,
      totalTokens: response.usage?.total_tokens ?? null,
      responseLength: content.length,
      success: true,
      formatValid: schemaValid,
      formatDetail: jsonValid ? (schemaValid ? "JSON + Zod valid" : `JSON valid, ${detail}`) : detail,
      preview: content.slice(0, 200).replace(/\|/g, "\\|").replace(/\n/g, " "),
    };
  } catch (err) {
    return {
      input: input.label,
      model: "MiniMax-Text-01 (no response_format)",
      latencyMs: Date.now() - start,
      totalTokens: null,
      responseLength: 0,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      preview: "",
    };
  }
}

async function evalJsonText(input: TestInput): Promise<EvalResult> {
  const start = Date.now();
  try {
    const response = await client.chat.completions.create({
      model: "MiniMax-Text-01",
      messages: [
        { role: "system", content: JSON_SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });
    const latency = Date.now() - start;
    const content = response.choices[0]?.message?.content ?? "";

    let parsed: unknown = null;
    let jsonValid = false;
    let schemaValid = false;
    let detail = "";
    try {
      parsed = JSON.parse(content);
      jsonValid = typeof parsed === "object" && parsed !== null;
    } catch (e) {
      detail = `JSON.parse failed: ${e instanceof Error ? e.message : String(e)}`;
    }

    if (jsonValid) {
      const result = CrossFitPlanEvalSchema.safeParse(parsed);
      schemaValid = result.success;
      if (!schemaValid && result.error) {
        detail = `Zod: ${result.error.issues.slice(0, 2).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`;
      }
    }

    return {
      input: input.label,
      model: "MiniMax-Text-01",
      latencyMs: latency,
      totalTokens: response.usage?.total_tokens ?? null,
      responseLength: content.length,
      success: true,
      formatValid: schemaValid,
      formatDetail: jsonValid ? (schemaValid ? "JSON + Zod valid" : `JSON valid, ${detail}`) : detail,
      preview: content.slice(0, 200).replace(/\|/g, "\\|").replace(/\n/g, " "),
    };
  } catch (err) {
    return {
      input: input.label,
      model: "MiniMax-Text-01",
      latencyMs: Date.now() - start,
      totalTokens: null,
      responseLength: 0,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      preview: "",
    };
  }
}

// ─── Reporting ──────────────────────────────────────────────────────────────

function formatTable(results: EvalResult[]): string {
  const lines = [
    "| Input | Model | Success | Latency | Tokens | Format | Detail | Preview |",
    "|-------|-------|---------|---------|--------|--------|--------|---------|",
  ];
  for (const r of results) {
    const format = r.success ? (r.formatValid ? "✓" : "✗") : "—";
    const tokens = r.totalTokens ?? "-";
    const success = r.success ? "✓" : "✗";
    const detail = (r.formatDetail ?? r.error ?? "").replace(/\|/g, "\\|").slice(0, 60);
    const preview = r.preview.slice(0, 80);
    lines.push(
      `| ${r.input} | ${r.model} | ${success} | ${r.latencyMs}ms | ${tokens} | ${format} | ${detail} | ${preview} |`,
    );
  }
  return lines.join("\n");
}

async function main() {
  console.log("=".repeat(80));
  console.log("CrossFit model evaluation");
  console.log("=".repeat(80));
  console.log(`Comparing 4 configurations:`);
  console.log(`  1. MiniMax-M2.7-highspeed (markdown, default)`);
  console.log(`  2. MiniMax-M2.7-highspeed (markdown, thinking: disabled)`);
  console.log(`  3. MiniMax-Text-01 (JSON prompt, no response_format)`);
  console.log(`  4. MiniMax-Text-01 (JSON prompt, response_format: json_object)`);
  console.log(`${INPUTS.length} inputs × 4 configurations = ${INPUTS.length * 4} calls.`);
  console.log("");

  const results: EvalResult[] = [];

  for (const input of INPUTS) {
    console.log(`▶ ${input.label}...`);
    const md = await evalMarkdown(input);
    results.push(md);
    console.log(`  M2.7-highspeed:             ${md.latencyMs}ms, success=${md.success}, format=${md.formatValid ? "✓" : "✗"}`);

    const mdOff = await evalMarkdownThinkingOff(input);
    results.push(mdOff);
    console.log(`  M2.7+thinking:off:          ${mdOff.latencyMs}ms, success=${mdOff.success}, format=${mdOff.formatValid ? "✓" : "✗"}`);

    const txtNo = await evalJsonTextNoFormat(input);
    results.push(txtNo);
    console.log(`  Text-01 (no response_fmt):  ${txtNo.latencyMs}ms, success=${txtNo.success}, format=${txtNo.formatValid ? "✓" : "✗"}`);

    const txt = await evalJsonText(input);
    results.push(txt);
    console.log(`  Text-01 (response_fmt):     ${txt.latencyMs}ms, success=${txt.success}, format=${txt.formatValid ? "✓" : "✗"}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("RESULTS");
  console.log("=".repeat(80));
  console.log("");
  console.log(formatTable(results));

  // Summary
  const configs = [
    { name: "MiniMax-M2.7-highspeed", filter: (r: EvalResult) => r.model === "MiniMax-M2.7-highspeed" },
    { name: "M2.7-highspeed+thinking:off", filter: (r: EvalResult) => r.model === "M2.7-highspeed+thinking:off" },
    { name: "MiniMax-Text-01 (no response_format)", filter: (r: EvalResult) => r.model === "MiniMax-Text-01 (no response_format)" },
    { name: "MiniMax-Text-01 (response_format)", filter: (r: EvalResult) => r.model === "MiniMax-Text-01" },
  ];

  const summary = configs.map((c) => {
    const subset = results.filter(c.filter);
    const avgLatency = subset.reduce((a, r) => a + r.latencyMs, 0) / subset.length;
    const success = subset.filter((r) => r.success).length;
    const valid = subset.filter((r) => r.formatValid).length;
    return { name: c.name, success, valid, avgLatency, total: subset.length };
  });

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  for (const s of summary) {
    console.log(`${s.name}:`);
    console.log(`  Success: ${s.success}/${s.total}`);
    console.log(`  Format valid: ${s.valid}/${s.total}`);
    console.log(`  Avg latency: ${s.avgLatency.toFixed(0)}ms`);
    console.log("");
  }

  console.log("Verdict:");
  const text01NoFormat = summary[2];
  const m2Standard = summary[0];
  const m2ThinkingOff = summary[1];
  let verdictText: string;
  const text01LatencyGain = (1 - text01NoFormat.avgLatency / m2Standard.avgLatency) * 100;
  const text01SuccessRate = text01NoFormat.valid / text01NoFormat.total;
  if (text01SuccessRate >= 0.83 && text01NoFormat.avgLatency < m2Standard.avgLatency) {
    verdictText = `✅ ADOPT MiniMax-Text-01 (no response_format). ${text01SuccessRate * 100}% JSON valid, ${text01LatencyGain.toFixed(0)}% latency reduction (${text01NoFormat.avgLatency.toFixed(0)}ms vs ${m2Standard.avgLatency.toFixed(0)}ms). Re-introduce structured output.`;
  } else if (text01SuccessRate >= 0.83) {
    verdictText = `🟡 MiniMax-Text-01 returns valid JSON but is not faster. Latency tradeoff for structured output.`;
  } else if (m2ThinkingOff.avgLatency < m2Standard.avgLatency * 0.85) {
    verdictText = `✅ M2.7-highspeed with thinking:disabled is significantly faster. Adopt this combination.`;
  } else {
    verdictText = `❌ No clear winner. Stick with M2.7-highspeed (current).`;
  }
  console.log(`  ${verdictText}`);

  // Save report
  const reportPath = path.resolve("docs/agents/eval/eval-models-report.md");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const summaryTable = [
    `| Model | Success | Format-valid | Avg Latency |`,
    `|-------|---------|--------------|-------------|`,
    ...summary.map((s) => `| ${s.name} | ${s.success}/${s.total} | ${s.valid}/${s.total} | ${s.avgLatency.toFixed(0)}ms |`),
  ].join("\n");
  const reportContent = [
    `# Model Evaluation Report`,
    ``,
    `Generated at: ${new Date().toISOString()}`,
    ``,
    `Inputs: ${INPUTS.length} representative CrossFit combinations (varied wodFormat, strengthSkill, optional focus/considerations).`,
    `Configurations tested:`,
    `1. MiniMax-M2.7-highspeed (markdown, default — no thinking param)`,
    `2. MiniMax-M2.7-highspeed (markdown, thinking: disabled)`,
    `3. MiniMax-Text-01 (JSON prompt, no response_format)`,
    `4. MiniMax-Text-01 (JSON prompt, response_format: json_object)`,
    ``,
    `## Results`,
    ``,
    formatTable(results),
    ``,
    `## Summary`,
    ``,
    summaryTable,
    ``,
    `## Verdict`,
    ``,
    verdictText,
  ].join("\n");
  fs.writeFileSync(reportPath, reportContent);
  console.log(`\nReport saved to: ${reportPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
