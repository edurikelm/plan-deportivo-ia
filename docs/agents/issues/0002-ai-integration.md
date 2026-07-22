---
label: feature
status: closed
closed_at: 2026-07-22
---

## Resultado

Smoke test pasado contra la `MINIMAX_API_KEY` real del usuario. El POST a `/api/generate` con una Clase crossfit devolvió markdown razonable (≈900 chars, contiene Skill/Strength/WOD, sin bloques `think`). El filter `stripThinkBlocks()` elimina reasoning tokens. 400 para payload inválido, 500 sin key, 502 upstream. `runtime = 'nodejs'` explícito.

## What to build

Wire the LLM. Build the MiniMax client (OpenAI SDK with `baseURL` set to `https://api.minimax.io/v1` and `MINIMAX_API_KEY` from env), the prompt builder (derive system prompt from a `Clase`; user prompt includes optional `focus` override), and the API route `POST /api/generate` that proxies the request so the API key never reaches the client. Strip `…` and `…` blocks from the response before returning.

Verify by `curl`-ing `/api/generate` with a valid Clase-shaped payload (no need for the UI yet). End-to-end smoke test in this slice is the same curl: a real response from `MiniMax-M3` that contains a markdown plan, no `…` block.

## Acceptance criteria

- [ ] `src/lib/minimax.ts` exports a `generateIdea({ clase, focus })` that returns `{ content, model }`. Uses `MiniMax-M3` with `temperature: 0.7`, `max_tokens: 4096`.
- [ ] `src/lib/build-prompt.ts` exports `buildSystemPrompt(clase)` and `buildUserPrompt(clase, focus?)` matching the template in `CONTEXT.md` § Construcción del Prompt.
- [ ] `app/api/generate/route.ts` POST receives `{ clase, focus? }`, validates minimally (clase has name + structure + exercises), returns `{ ok: true, content, model }` or `{ ok: false, error }` with appropriate HTTP code (400 for bad payload, 500 for missing key, 502 for upstream failure).
- [ ] Response content has no `…` or `…` blocks (filter applied).
- [ ] `MINIMAX_API_KEY` is only read on the server; no client file references it.
- [ ] Smoke test with real key returns markdown for a sample Clase (crossfit) in this slice's PR.

## Blocked by

- #0001 (needs the `Clase` type)
