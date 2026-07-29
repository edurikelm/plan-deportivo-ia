import OpenAI from "openai";
import type { Clase } from "./types";
import { buildSystemPrompt, buildUserPrompt } from "./build-prompt";

const MODEL = "MiniMax-M3";
const TEMPERATURE = 0.7;
const MAX_TOKENS = 4096;

/**
 * Vendor-specific params the OpenAI SDK doesn't yet type. Local extension so
 * tsc validates the shape (catches a typo, narrows the union) instead of
 * relying on an object-spread bypass at the call site. Keep this surface
 * narrow — only what MiniMax actually exposes.
 */
interface MiniMaxChatParams {
  thinking?: { type: "disabled" | "adaptive" };
}

type CreateParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming &
  MiniMaxChatParams;

function createClient(): OpenAI {
  return new OpenAI({
    baseURL: "https://api.minimax.io/v1",
    apiKey: process.env.MINIMAX_API_KEY,
  });
}

/**
 * Strips thought/analysis blocks from the response content.
 * Filters out `<think>…</think>` blocks (MiniMax reasoning tokens).
 */
function stripThinkBlocks(content: string): string {
  return content
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface GenerateIdeaOptions {
  clase: Clase;
  focus?: string;
}

export interface GenerateIdeaResult {
  content: string;
  model: string;
}

/**
 * Generates an idea for a given Clase by calling MiniMax-M3.
 * Returns the stripped content and model name.
 */
export async function generateIdea({
  clase,
  focus,
}: GenerateIdeaOptions): Promise<GenerateIdeaResult> {
  const client = createClient();

  const systemPrompt = buildSystemPrompt(clase);
  const userPrompt = buildUserPrompt(clase, focus);

  // Build the request body into a local typed variable so tsc validates the
  // `thinking` shape (otherwise the SDK's excess-property check rejects it).
  const params: CreateParams = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    // MiniMax-specific: turn off M3's built-in reasoning. Default is ON and
    // emits … blocks that stripThinkBlocks() already filters; disabling it
    // upstream saves latency/cost in this flow. Tradeoff: more complex
    // focuses or long structures may rely on internal planning — verify
    // quality with smoke tests (see docs/agents/issues/0008).
    thinking: { type: "disabled" },
  };

  const response = await client.chat.completions.create(params);

  const rawContent =
    response.choices[0]?.message?.content ??
    (() => {
      throw new Error("Empty response from MiniMax");
    })();

  const content = stripThinkBlocks(rawContent);

  return { content, model: MODEL };
}
