import OpenAI from "openai";
import { buildUserPrompt, SYSTEM_PROMPT } from "./build-prompt";
import type { PlanInput } from "./types";

const MODEL = "MiniMax-M3";

const client = new OpenAI({
  apiKey: process.env.MINIMAX_API_KEY ?? "",
  baseURL: "https://api.minimax.io/v1",
});

export interface GenerateOptions {
  structure: string;
  planInput: PlanInput;
}

export interface GenerateResult {
  content: string;
  model: string;
}

export async function generatePlan({
  structure,
  planInput,
}: GenerateOptions): Promise<GenerateResult> {
  const userPrompt = buildUserPrompt(structure, planInput);

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  });

  const content = stripThinking(completion.choices[0].message.content ?? "");

  return { content, model: MODEL };
}

function stripThinking(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .trim();
}
