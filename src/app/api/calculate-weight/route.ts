import { NextRequest, NextResponse } from "next/server";
import {
  calculateBreakdownFromImage,
  crossCheckBreakdown,
  VISION_MODEL,
} from "@/lib/calculator";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function POST(req: NextRequest) {
  // Parse multipart/form-data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_image" }, { status: 400 });
  }

  const file = formData.get("image");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "invalid_image" }, { status: 400 });
  }

  // Validate MIME type
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ ok: false, error: "unsupported_format" }, { status: 400 });
  }

  // Validate size
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "image_too_large" }, { status: 400 });
  }

  // Encode to base64
  let imageBase64: string;
  let mimeType: string;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    imageBase64 = buffer.toString("base64");
    mimeType = file.type;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_image" }, { status: 400 });
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
    const breakdown = await calculateBreakdownFromImage(imageBase64, mimeType);
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
