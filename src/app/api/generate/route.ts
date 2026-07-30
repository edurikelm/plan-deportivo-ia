import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CrossFitSessionInputSchema } from "@/lib/modalities";
import { generateCrossFitSession } from "@/lib/modalities";

export const runtime = "nodejs";
// Server-side hard cap: Next.js responds 504 after 90s.
export const maxDuration = 90;

// ─── Request body ────────────────────────────────────────────────────────────

const GenerateBodySchema = z.object({
  modalityId: z.string().min(1),
  input: z.unknown(),
});

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = GenerateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "modalityId is required" },
      { status: 400 },
    );
  }

  const { modalityId, input } = parsed.data;

  if (modalityId !== "crossfit") {
    return NextResponse.json(
      { ok: false, error: `Unknown modality: ${modalityId}` },
      { status: 400 },
    );
  }

  const inputResult = CrossFitSessionInputSchema.safeParse(input);
  if (!inputResult.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid input: " + inputResult.error.message },
      { status: 400 },
    );
  }

  if (!process.env.MINIMAX_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "Server configuration error" },
      { status: 500 },
    );
  }

  try {
    const result = await generateCrossFitSession(inputResult.data);
    return NextResponse.json({
      ok: true,
      content: result.content,
      structured: result.structured,
      model: result.model,
    });
  } catch (err) {
    console.error("[/api/generate] upstream error:", err);
    return NextResponse.json(
      { ok: false, error: "Upstream AI service error" },
      { status: 502 },
    );
  }
}
