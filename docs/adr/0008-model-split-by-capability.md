# Model Split by Capability — Text-01 + M3

The system uses `MiniMax-Text-01` for CrossFit session generation and `MiniMax-M3` for the calculator's vision flow. Two models from the same provider, selected per capability.

**Status**: accepted

## Decision

### Why two models

`MiniMax-Text-01` is the empirically validated model for CrossFit: 100% JSON-valid output, ~13s avg latency, no `response_format` support (per `docs/agents/eval/eval-models-report.md`). It is text-only.

`MiniMax-M3` is the only model in MiniMax's public catalog that supports `image_url` content type (per `platform.minimax.io` API reference: *"image and video inputs are exclusive to the MiniMax-M3 model"*). It is also capable of text but has not been validated for CrossFit's specific JSON prompt pattern.

Splitting by capability:

- CrossFit keeps `MiniMax-Text-01`. The eval already proved Text-01 is reliable for this prompt. Migrating to M3 to "unify" introduces risk without benefit.
- Calculator Foto uses `MiniMax-M3`. M3 is the only option that supports vision. No trade-off here — Text-01 cannot do this job.

### Architecture

Each surface instantiates its own `OpenAI` client against `https://api.minimax.io/v1`:

- `src/lib/modalities/crossfit-schemas.ts` → `const MODEL = "MiniMax-Text-01"` (unchanged).
- `src/lib/calculator/vision.ts` (new) → `const VISION_MODEL = "MiniMax-M3"`.

Both use the same `MINIMAX_API_KEY` from `.env.local`. Same base URL. Different model constants. Two model constants is the documented expression of "two capabilities, two models".

### Vision verification gate

Before the Foto tab ships, `scripts/verify-vision.ts` (modeled after `scripts/eval-models.ts`) sends a test barbell photo to M3 with vision input, validates the response against the calculator's Zod schema, and reports whether M3 quality is acceptable for the calculator's use case. If verification fails:

- Options are picked explicitly by the user: pick a different vision-capable provider (OpenAI `gpt-4o-mini`, Anthropic Claude), keep Text-01 and drop Foto to MVP+1, or escalate to the provider for support.

The verification is a precondition, not an afterthought. Building the Foto tab on an unverified capability would invest work in an unconfirmed premise.

## Consequences

- The codebase has two model constants. This is intentional — it documents which model serves which capability. Adding a third capability adds a third constant; nothing generalizes.
- The `eval-models.ts` script is the template for `verify-vision.ts`. Adding vision tests follows the same eval pattern.
- Cost: two models may have different pricing. Out of scope to enumerate today; revisited if cost matters.
- If a future modality needs vision (e.g., an Olympic Lifting modality that generates sessions from a photo of technique), it uses M3 (or whatever vision model is current). The split-by-capability pattern extends naturally.
- `MiniMax-Text-01` is not in MiniMax's public model list. It may be a private alias, a beta, or deprecated. If it stops responding, CrossFit breaks. Migration path: change the constant in `crossfit-schemas.ts` to `MiniMax-M3`, re-run `npm run eval:models`, adjust the prompt or retry policy if JSON output quality regresses.

## Considered alternatives

- **Unify on `MiniMax-M3`**. Rejected. CrossFit's JSON output quality on M3 is unknown; Text-01 is empirically proven. Risk vs. reward is unfavorable.
- **Use OpenAI directly for vision** (`gpt-4o-mini`). Deferred. If M3 quality is insufficient for barbell photos, this is the fallback. Adds a second API key and a second provider abstraction. Out of scope for MVP.
- **Drop Foto tab**. Deferred to MVP+1. Same trigger as the OpenAI fallback. The user explicitly requested the Foto feature in the original brief; deferring is a scope reduction that should be chosen explicitly, not assumed.
- **Pick a vision model via empirical eval**. Out of scope for MVP. The user has high confidence that Text-01 is text-only; M3 is the documented multimodal model. The verify-vision script confirms whether M3 quality is acceptable for barbell photos specifically.

## Out of scope

- Per-modality model configuration UI.
- Cost tracking per model.
- A/B testing between models.
- Video input (M3 supports `video_url`, but the calculator's Foto flow is image-only for MVP).
