/**
 * Vision verification — sends a test barbell photo to MiniMax-M3 with vision
 * input, validates the response against the calculator's Zod schema, and
 * reports whether M3 quality is acceptable for the Foto tab.
 *
 * Run with: `npx tsx scripts/verify-vision.ts [path-to-image]`
 *
 * If no image path is provided, uses an inline SVG of a stylized barbell as
 * a baseline test. The synthetic image may not be understood by the model,
 * but it confirms the API accepts `image_url` content and returns valid JSON.
 *
 * Output: console table with latency, JSON validity, Zod validity, and a
 * preview of the parsed breakdown.
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
const VISION_MODEL = "MiniMax-M3";
const API_KEY = process.env.MINIMAX_API_KEY;

if (!API_KEY) {
  console.error("✗ MINIMAX_API_KEY not set. Set it in env or .env.local.");
  process.exit(1);
}

const client = new OpenAI({ baseURL: BASE_URL, apiKey: API_KEY });

// ─── Zod schema (mirror of calculator breakdown) ────────────────────────────

const DiscRowSchema = z.object({
  weight: z.number().positive(),
  unit: z.enum(["kg", "lb"]),
  count: z.number().int().min(1),
});

const BreakdownSchema = z.object({
  barKg: z.number().positive(),
  discs: z.array(DiscRowSchema),
  totalKg: z.number().positive(),
  totalLb: z.number().positive(),
});

type Breakdown = z.infer<typeof BreakdownSchema>;

// ─── System prompt (mirror of calculator Foto flow) ─────────────────────────

const VISION_SYSTEM_PROMPT = `Sos un asistente que identifica el equipamiento en una foto de una barra de levantamiento. Tu única tarea es devolver un objeto JSON válido con este esquema exacto:

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

// ─── Test image: inline SVG baseline (rendered to PNG via sharp) ────────────

/**
 * A minimalist SVG of a barbell with two plates per side. Used as the default
 * test image when no path is provided — confirms the API accepts vision input
 * even if the synthetic image confuses the model.
 *
 * M3 only accepts JPEG, PNG, GIF, WEBP (not SVG). We render the SVG to PNG
 * with sharp before encoding as base64.
 */
const BASELINE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100">
  <!-- Bar -->
  <rect x="50" y="48" width="300" height="4" fill="#888"/>
  <!-- Sleeves (thicker ends where plates load) -->
  <rect x="40" y="46" width="20" height="8" fill="#666"/>
  <rect x="340" y="46" width="20" height="8" fill="#666"/>
  <!-- Plates left side (red = 25kg, blue = 20kg, yellow = 10kg) -->
  <rect x="80" y="30" width="20" height="40" fill="#c0392b"/>
  <rect x="100" y="35" width="15" height="30" fill="#2980b9"/>
  <rect x="115" y="40" width="10" height="20" fill="#f1c40f"/>
  <!-- Plates right side (mirror) -->
  <rect x="300" y="30" width="20" height="40" fill="#c0392b"/>
  <rect x="285" y="35" width="15" height="30" fill="#2980b9"/>
  <rect x="275" y="40" width="10" height="20" fill="#f1c40f"/>
</svg>`;

// ─── Image loading ───────────────────────────────────────────────────────────

interface LoadedImage {
  base64: string;
  mimeType: string;
  source: "cli-arg" | "baseline-svg";
}

async function loadImage(cliPath: string | undefined): Promise<LoadedImage> {
  if (cliPath) {
    const absPath = path.resolve(cliPath);
    if (!fs.existsSync(absPath)) {
      console.error(`✗ Image not found: ${absPath}`);
      process.exit(1);
    }
    const ext = path.extname(absPath).toLowerCase().replace(".", "");
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
    };
    const mimeType = mimeMap[ext];
    if (!mimeType) {
      console.error(`✗ Unsupported format: .${ext}. Use JPEG, PNG, GIF, or WEBP.`);
      process.exit(1);
    }
    const base64 = fs.readFileSync(absPath).toString("base64");
    return { base64, mimeType, source: "cli-arg" };
  }

  // Baseline SVG: render to PNG via sharp (M3 doesn't accept SVG MIME).
  // Use sharp transitively (Next.js bundles it). If unavailable, fail loud.
  console.log("ℹ No image path provided — rendering inline SVG baseline to PNG.");
  console.log("  This confirms API accepts vision input. For real quality");
  console.log("  testing, pass a barbell photo: npx tsx scripts/verify-vision.ts photo.jpg");
  console.log("");
  try {
    // Dynamic import — sharp is optional and may not always be present.
    const sharpModule = await import("sharp" as string).catch(() => null);
    if (!sharpModule) {
      console.error(
        "✗ sharp not available. Either install it (`npm i -D sharp`) or pass an image path.",
      );
      process.exit(1);
    }
    const sharp = (sharpModule as { default: typeof import("sharp") }).default ?? sharpModule;
    const pngBuffer = await sharp(Buffer.from(BASELINE_SVG)).png().toBuffer();
    return {
      base64: pngBuffer.toString("base64"),
      mimeType: "image/png",
      source: "baseline-svg",
    };
  } catch (e) {
    console.error(`✗ Failed to render baseline SVG: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

// ─── JSON parser (strip fences + retry-friendly) ─────────────────────────────

function stripMarkdownFences(content: string): string {
  const s = content.trim();
  const openMatch = s.match(/^```(\w+)?\s*\n?/);
  if (!openMatch) return s;
  const stripped = s.slice(openMatch[0].length);
  const closingFence = stripped.match(/\n?```\s*$/);
  if (!closingFence) return stripped.trim();
  return stripped.slice(0, stripped.length - closingFence[0].length).trim();
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const stripped = stripMarkdownFences(content);
    try {
      return JSON.parse(stripped);
    } catch (e) {
      throw new Error(
        `JSON parse failed: ${e instanceof Error ? e.message : String(e)}. Raw start: ${content.slice(0, 200)}`,
      );
    }
  }
}

// ─── Verification runner ─────────────────────────────────────────────────────

interface VerifyResult {
  source: "cli-arg" | "baseline-svg";
  latencyMs: number;
  totalTokens: number | null;
  responseLength: number;
  rawPreview: string;
  jsonValid: boolean;
  schemaValid: boolean;
  breakdown: Breakdown | null;
  crossCheckOk: boolean | null;
  crossCheckDetail: string;
  verdict: "ok" | "warn" | "fail";
}

async function runVerification(image: LoadedImage): Promise<VerifyResult> {
  const start = Date.now();
  let rawContent = "";
  try {
    // Cast to any to bypass OpenAI SDK types — MiniMax supports image_url and thinking
    const response = await client.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        { role: "system", content: VISION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Identificá la barra y los discos en esta imagen." },
            { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.base64}`, detail: "default" } },
          ],
        },
      ],
      temperature: 0.3, // Lower than CrossFit's 0.7 — we want deterministic identification
      max_tokens: 1024,
      thinking: { type: "disabled" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    rawContent = response.choices[0]?.message?.content ?? "";
    const latency = Date.now() - start;

    let jsonValid = false;
    let schemaValid = false;
    let breakdown: Breakdown | null = null;
    let parseError = "";

    try {
      const parsed = parseJson(rawContent);
      jsonValid = typeof parsed === "object" && parsed !== null;
      if (jsonValid) {
        const result = BreakdownSchema.safeParse(parsed);
        schemaValid = result.success;
        if (result.success) {
          breakdown = result.data;
        } else {
          parseError = result.error.issues
            .slice(0, 2)
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
        }
      }
    } catch (e) {
      parseError = e instanceof Error ? e.message : String(e);
    }

    // Cross-check: do the IA-reported totals match the breakdown sum?
    let crossCheckOk: boolean | null = null;
    let crossCheckDetail = "";
    if (breakdown) {
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
      crossCheckOk = kgDiff < tolerance && lbDiff < tolerance;
      crossCheckDetail = crossCheckOk
        ? `totals match (Δkg=${kgDiff.toFixed(4)}, Δlb=${lbDiff.toFixed(4)})`
        : `MISMATCH — computed ${computedKg.toFixed(3)}kg / ${computedLb.toFixed(3)}lb, IA says ${breakdown.totalKg}kg / ${breakdown.totalLb}lb (Δkg=${kgDiff.toFixed(3)}, Δlb=${lbDiff.toFixed(3)})`;
    }

    let verdict: VerifyResult["verdict"] = "fail";
    if (schemaValid && crossCheckOk === true) {
      verdict = "ok";
    } else if (jsonValid) {
      verdict = "warn"; // Got JSON but failed Zod or cross-check
    }

    return {
      source: image.source,
      latencyMs: latency,
      totalTokens: response.usage?.total_tokens ?? null,
      responseLength: rawContent.length,
      rawPreview: rawContent.slice(0, 200).replace(/\n/g, " "),
      jsonValid,
      schemaValid,
      breakdown,
      crossCheckOk,
      crossCheckDetail,
      verdict,
    };
  } catch (err) {
    return {
      source: image.source,
      latencyMs: Date.now() - start,
      totalTokens: null,
      responseLength: rawContent.length,
      rawPreview: rawContent.slice(0, 200).replace(/\n/g, " "),
      jsonValid: false,
      schemaValid: false,
      breakdown: null,
      crossCheckOk: null,
      crossCheckDetail: `API call failed: ${err instanceof Error ? err.message : String(err)}`,
      verdict: "fail",
    };
  }
}

// ─── Reporting ───────────────────────────────────────────────────────────────

function formatResult(r: VerifyResult): string {
  const verdictIcon = { ok: "✓", warn: "⚠", fail: "✗" }[r.verdict];
  const verdictText = {
    ok: "VERIFIED — M3 returns valid breakdown with matching totals.",
    warn: "PARTIAL — JSON parsed but Zod or cross-check failed.",
    fail: "FAILED — vision path is not viable.",
  }[r.verdict];

  const lines: string[] = [];
  lines.push(`Source:        ${r.source}`);
  lines.push(`Latency:       ${r.latencyMs}ms`);
  lines.push(`Tokens:        ${r.totalTokens ?? "-"}`);
  lines.push(`Response size: ${r.responseLength} chars`);
  lines.push(`JSON valid:    ${r.jsonValid ? "✓" : "✗"}`);
  lines.push(`Zod valid:     ${r.schemaValid ? "✓" : "✗"}`);
  lines.push(`Cross-check:   ${r.crossCheckOk === true ? "✓" : r.crossCheckOk === false ? "�" : "—"}`);
  if (r.crossCheckDetail) lines.push(`  └─ ${r.crossCheckDetail}`);
  if (r.breakdown) {
    const b = r.breakdown;
    lines.push(`Breakdown:`);
    lines.push(`  bar:    ${b.barKg} kg`);
    lines.push(`  discs:  ${b.discs.map((d) => `${d.weight}${d.unit}×${d.count}`).join(", ") || "(none)"}`);
    lines.push(`  total:  ${b.totalKg} kg / ${b.totalLb} lb`);
  }
  lines.push(`Raw preview:   ${r.rawPreview}`);
  lines.push("");
  lines.push(`Verdict: ${verdictIcon} ${verdictText}`);
  return lines.join("\n");
}

async function main() {
  console.log("=".repeat(70));
  console.log("Vision verification — MiniMax-M3 barbell photo identification");
  console.log("=".repeat(70));
  console.log("");

  const cliArg = process.argv[2];
  const image = await loadImage(cliArg);

  console.log(`Model: ${VISION_MODEL}`);
  console.log(`Endpoint: ${BASE_URL}`);
  console.log(`Image source: ${image.source}`);
  console.log("");
  console.log("Running verification…");
  console.log("");

  const result = await runVerification(image);

  console.log("=".repeat(70));
  console.log("RESULT");
  console.log("=".repeat(70));
  console.log("");
  console.log(formatResult(result));
  console.log("");

  // Save a short report for the project record.
  const reportDir = path.resolve("docs/agents/eval");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, "verify-vision-report.md");
  const report = [
    `# Vision Verification Report`,
    ``,
    `Generated at: ${new Date().toISOString()}`,
    ``,
    `Model: \`${VISION_MODEL}\``,
    `Image source: ${result.source}`,
    ``,
    `## Result`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Latency | ${result.latencyMs}ms |`,
    `| Tokens | ${result.totalTokens ?? "-"} |`,
    `| JSON valid | ${result.jsonValid ? "yes" : "no"} |`,
    `| Zod valid | ${result.schemaValid ? "yes" : "no"} |`,
    `| Cross-check | ${result.crossCheckOk === true ? "match" : result.crossCheckOk === false ? "mismatch" : "—"} |`,
    `| Verdict | **${result.verdict.toUpperCase()}** |`,
    ``,
    result.crossCheckDetail ? `> ${result.crossCheckDetail}\n` : "",
    result.breakdown
      ? [
          `## Parsed breakdown`,
          ``,
          "```json",
          JSON.stringify(result.breakdown, null, 2),
          "```",
          ``,
        ].join("\n")
      : "",
    `## Raw response (first 200 chars)`,
    ``,
    "```",
    result.rawPreview,
    "```",
  ].join("\n");
  fs.writeFileSync(reportPath, report);
  console.log(`Report saved to: ${reportPath}`);

  process.exit(result.verdict === "fail" ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
