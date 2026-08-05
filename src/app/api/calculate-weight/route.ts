import { NextRequest, NextResponse } from "next/server";
import {
  calculateBreakdownFromImage,
  crossCheckBreakdown,
  VISION_MODEL,
} from "@/lib/calculator";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
// Roughly 4/3 of base64-encoded bytes — leave headroom for the data-URL prefix.
const MAX_DATA_URL_LENGTH = Math.ceil((MAX_BYTES * 4) / 3) + 64;

interface RequestBody {
  imageDataUrl?: string;
}

export async function POST(req: NextRequest) {
  // Parse JSON body — client sends a data URL so we don't need multipart.
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_image" },
      { status: 400 },
    );
  }

  const imageDataUrl = body.imageDataUrl;
  if (typeof imageDataUrl !== "string") {
    return NextResponse.json(
      { ok: false, error: "invalid_image" },
      { status: 400 },
    );
  }

  if (imageDataUrl.length > MAX_DATA_URL_LENGTH) {
    return NextResponse.json(
      { ok: false, error: "image_too_large" },
      { status: 400 },
    );
  }

  // Validate the data-URL header (`data:<mime>;base64,<...>`)
  const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json(
      { ok: false, error: "invalid_image" },
      { status: 400 },
    );
  }
  const mimeType = match[1];
  const base64 = match[2];

  if (!ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json(
      { ok: false, error: "unsupported_format" },
      { status: 400 },
    );
  }

  // API key guard — same pattern as /api/generate
  if (!process.env.MINIMAX_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "Server configuration error" },
      { status: 500 },
    );
  }

  // Call vision model
  try {
    const breakdown = await calculateBreakdownFromImage(base64, mimeType);
    const crossCheck = crossCheckBreakdown(breakdown);

    return NextResponse.json({
      ok: true,
      breakdown,
      model: VISION_MODEL,
      crossCheck,
    });
  } catch (err) {
    console.error("[/api/calculate-weight] upstream error:", err);
    return NextResponse.json(
      { ok: false, error: "upstream_error" },
      { status: 502 },
    );
  }
}
