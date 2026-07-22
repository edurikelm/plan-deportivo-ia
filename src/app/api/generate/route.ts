import { generatePlan } from "@/lib/minimax";
import type { PlanInput } from "@/lib/types";

interface RequestBody {
  structure: string;
  planInput: PlanInput;
}

interface SuccessResponse {
  ok: true;
  content: string;
  model: string;
}

interface ErrorResponse {
  ok: false;
  error: string;
}

export async function POST(req: Request): Promise<Response> {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return Response.json(
      { ok: false, error: "JSON inválido" } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  if (!body.structure || typeof body.structure !== "string") {
    return Response.json(
      { ok: false, error: "Estructura faltante o inválida" } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  if (!body.planInput || typeof body.planInput !== "object") {
    return Response.json(
      { ok: false, error: "Datos del plan faltantes o inválidos" } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  if (!process.env.MINIMAX_API_KEY) {
    return Response.json(
      { ok: false, error: "API key no configurada en el servidor" } satisfies ErrorResponse,
      { status: 500 },
    );
  }

  try {
    const result = await generatePlan({
      structure: body.structure,
      planInput: body.planInput,
    });
    return Response.json({
      ok: true,
      content: result.content,
      model: result.model,
    } satisfies SuccessResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al generar el plan";
    return Response.json(
      { ok: false, error: message } satisfies ErrorResponse,
      { status: 502 },
    );
  }
}
