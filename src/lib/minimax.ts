import OpenAI from "openai";
import type { Clase } from "./types";
import { buildSystemPrompt, buildUserPrompt } from "./build-prompt";

const MODEL = "MiniMax-M3";
const TEMPERATURE = 0.7;
const MAX_TOKENS = 4096;

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

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
  });

  const rawContent =
    response.choices[0]?.message?.content ??
    (() => {
      throw new Error("Empty response from MiniMax");
    })();

  const content = stripThinkBlocks(rawContent);

  return { content, model: MODEL };
}
