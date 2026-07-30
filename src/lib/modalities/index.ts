/**
 * Server-side modality facade.
 *
 * Imports from this module are server-only.
 * For client code, import directly from `./crossfit`.
 */
export { generateCrossFitSession } from "./crossfit-schemas";
export type { GenerateCrossFitSessionResult } from "./crossfit-schemas";
export { CrossFitSessionInputSchema } from "./crossfit-schemas";
export { CrossFitPlanSchema } from "./crossfit-schemas";
export type {
  CrossFitSessionInput,
  CrossFitPlan,
  WodFormat,
} from "./crossfit-schemas";
