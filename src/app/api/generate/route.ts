import { NextRequest, NextResponse } from "next/server";
import { generateIdea } from "@/lib/minimax";
import type { Clase } from "@/lib/types";

export const runtime = "nodejs";
// Server-side hard cap on the route: Next.js will respond 504 after 90s.
// The client enforces a softer 60s timeout; this is the safety net so a
// stuck upstream call doesn't pin the route forever.
export const maxDuration = 90;

interface GenerateBody {
  clase: unknown;
  focus?: string;
}

function validateClase(value: unknown): Clase | null {
  if (typeof value !== "object" || value === null) return null;

  const obj = value as Record<string, unknown>;

  if (typeof obj.id !== "string" || !obj.id.trim()) return null;
  if (typeof obj.name !== "string" || !obj.name.trim()) return null;
  if (typeof obj.structure !== "string" || !obj.structure.trim()) return null;
  if (typeof obj.durationMinutes !== "number" || obj.durationMinutes <= 0)
    return null;
  if (typeof obj.createdAt !== "string" || !obj.createdAt.trim()) return null;

  if (!Array.isArray(obj.exercises))
    return null;
  if (!obj.exercises.every((e) => typeof e === "string" && e.trim()))
    return null;

  return obj as unknown as Clase;
}

export async function POST(req: NextRequest) {
  let body: GenerateBody;

  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const clase = validateClase(body.clase);
  if (!clase) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "clase is required and must have id, name, structure, exercises (array of non-empty strings), durationMinutes (> 0), and createdAt",
      },
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
    const { content, model } = await generateIdea({
      clase,
      focus: body.focus,
    });

    return NextResponse.json({ ok: true, content, model });
  } catch (err) {
    console.error("MiniMax upstream error:", err);
    return NextResponse.json(
      { ok: false, error: "Upstream AI service error" },
      { status: 502 },
    );
  }
}
