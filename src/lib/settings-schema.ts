/**
 * Zod schemas for the `/settings` page (issue 0025). Validates the *outer*
 * shape of a backup file at import time. Per-entry validation of the nested
 * data (sessions, records) is delegated to the defensive parsers in
 * `storage.ts` (`parseSessionsFromRaw`, `parseRecordsFromRaw`), which
 * drop corrupt entries silently. The outer-shape gate is what rejects
 * "this is not a backup file at all" — e.g. a random `{}` or a markdown
 * file picked by mistake.
 */
import { z } from "zod";

/**
 * Loose shape for a single session entry. The real `SavedSession` does not
 * have a Zod schema today (its `structured` field is loose), so we accept
 * the most general shape and let the per-entry parser drop bad rows.
 */
const LooseSessionSchema = z.object({}).passthrough();

/**
 * Loose shape for a single saved weight record. Same rationale as sessions.
 */
const LooseRecordSchema = z.object({}).passthrough();

/**
 * Loose shape for a persisted last input. We only need the type-check on
 * `wodFormat` to filter out garbage that wouldn't be a valid string.
 */
const LooseLastInputSchema = z
  .object({
    durationMinutes: z.string(),
    strengthSkill: z.string(),
    wodFormat: z.string(),
  })
  .passthrough();

export const BackupShapeSchema = z.object({
  exportedAt: z.string().min(1, "Falta exportedAt"),
  version: z.number().int().nonnegative(),
  data: z.object({
    sessions: z.array(LooseSessionSchema),
    calculatorState: z.object({
      barKg: z.number().positive(),
      discs: z.array(z.object({}).passthrough()),
    }),
    calculatorRecords: z.array(LooseRecordSchema),
    lastInputs: z.record(z.string(), LooseLastInputSchema),
  }),
});

export type ParsedBackupShape = z.infer<typeof BackupShapeSchema>;
