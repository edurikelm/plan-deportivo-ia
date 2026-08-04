# Robust JSON Parsing with Strip-and-Retry

The LLM `MiniMax-Text-01` sometimes wraps its JSON output in markdown code fences (```` ```json\n{...}\n``` ````) despite the system prompt explicitly forbidding fences. The current strict `JSON.parse` fails on these responses and surfaces a 502 error to the user, requiring a manual retry via the `Regenerar` button.

We add a defense-in-depth layer: strip leading/trailing markdown fences before parsing, and retry the API call once with a reinforced prompt if the stripped parse still fails.

**Status**: accepted

## Decision

- `generateCrossFitSession` first attempts `JSON.parse(rawContent)` directly.
- On failure, it strips a leading/trailing markdown fence (```` ``` ````, with or without language tag) and re-attempts parse.
- If both attempts fail, the function retries the API call **once** with an augmented system prompt that reinforces "JSON only, no fences, no prose".
- The retry's response goes through the same parse → strip → parse flow.
- If the retry also fails, the function throws with the retry's raw content snippet.
- Latency impact: zero on the happy path (LLM emits clean JSON). One extra API round-trip (~13s) only when both the original response is invalid AND the strip can't recover it.

## Considered alternatives

- **Strip fences only, no retry** — rejected. Doesn't cover prose-wrapped responses (F3, F4); user still gets 502 in those cases.
- **Retry only, no strip** — rejected. Wastes a retry on the most common failure mode (F2) that the strip can recover cheaply.
- **Re-evaluate `response_format: json_object`** — rejected. Issue 0011 eval proved the API rejects it with HTTP 400; re-testing is speculative.
- **Fall back to markdown parsing (0010 path)** — rejected. Loses structured output benefits (`CrossFitPlanView`, `sections.*.exercises` arrays). The strip-and-retry should cover the vast majority of cases.

## Consequences

- `CONTEXT.md` updates the "Generación" rule: retry policy changes from "ninguno" to "uno, sólo si el strip de fences falla".
- ADR-0003's original "retry once" claim was retracted in CONTEXT.md; this ADR restores the retry with a more nuanced policy.
- The stripper is intentionally narrow: it only strips if a clear opening fence is present at the start of the content. Prose-wrapped responses (F3/F4) bypass the stripper and rely on the retry.
- The retry uses the same model and `temperature: 0.7`. A separate `RETRY_SYSTEM_PROMPT_SUFFIX` is appended to the system prompt that emphasizes the failure mode observed in the first attempt.
- All Zod validation behavior is unchanged: defaults absorb partial JSON. Zod rejection (rare) surfaces as 502 with no retry — manual `Regenerar` from the client.