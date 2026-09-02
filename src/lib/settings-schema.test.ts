/**
 * Unit tests for `src/lib/settings-schema.ts`.
 *
 * The file exports the `BackupShapeSchema` (a Zod schema for the outer
 * shape of a backup file) and the `ParsedBackupShape` type. The schema
 * is intentionally loose on the per-entry shape — per-entry validation
 * is delegated to the defensive parsers in `storage.ts`. These tests
 * pin the outer-shape contract: "this is or is not a backup file".
 */
import { describe, it, expect } from "vitest";
import { BackupShapeSchema } from "./settings-schema";

const mkValidBackup = () => ({
  exportedAt: "2026-09-02T10:00:00.000Z",
  version: 1,
  data: {
    sessions: [
      { id: "ss-1", title: "Test", createdAt: "2026-09-01", modalityId: "crossfit" },
    ],
    calculatorState: { barKg: 20, discs: [] },
    calculatorRecords: [],
    lastInputs: {},
  },
});

describe("BackupShapeSchema", () => {
  it("accepts a fully populated valid backup", () => {
    const result = BackupShapeSchema.safeParse(mkValidBackup());
    expect(result.success).toBe(true);
  });

  it("accepts a backup with extra fields on sessions (passthrough)", () => {
    // Sessions are validated loosely because the real SavedSession does
    // not have a Zod schema. The outer-shape gate only rejects "this is
    // not a backup file at all" — extra fields are allowed.
    const backup = mkValidBackup();
    backup.data.sessions.push({ id: "ss-2", customField: "anything" });
    const result = BackupShapeSchema.safeParse(backup);
    expect(result.success).toBe(true);
  });

  it("rejects a backup with missing exportedAt", () => {
    const backup = mkValidBackup();
    delete (backup as { exportedAt?: string }).exportedAt;
    const result = BackupShapeSchema.safeParse(backup);
    expect(result.success).toBe(false);
  });

  it("rejects a backup with empty exportedAt", () => {
    const result = BackupShapeSchema.safeParse({
      ...mkValidBackup(),
      exportedAt: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a backup with negative version", () => {
    const result = BackupShapeSchema.safeParse({
      ...mkValidBackup(),
      version: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a backup with non-integer version", () => {
    const result = BackupShapeSchema.safeParse({
      ...mkValidBackup(),
      version: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a backup with sessions not an array", () => {
    const result = BackupShapeSchema.safeParse({
      ...mkValidBackup(),
      data: { ...mkValidBackup().data, sessions: "not an array" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a backup with calculatorState.barKg = 0", () => {
    const result = BackupShapeSchema.safeParse({
      ...mkValidBackup(),
      data: {
        ...mkValidBackup().data,
        calculatorState: { barKg: 0, discs: [] },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a backup with calculatorState.discs not an array", () => {
    const result = BackupShapeSchema.safeParse({
      ...mkValidBackup(),
      data: {
        ...mkValidBackup().data,
        calculatorState: { barKg: 20, discs: "not an array" },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a lastInput that doesn't have the required wodFormat (not a string)", () => {
    const result = BackupShapeSchema.safeParse({
      ...mkValidBackup(),
      data: {
        ...mkValidBackup().data,
        lastInputs: {
          crossfit: { durationMinutes: "60", strengthSkill: "Snatch", wodFormat: 123 },
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a lastInput with extra fields (passthrough on LooseLastInputSchema)", () => {
    const result = BackupShapeSchema.safeParse({
      ...mkValidBackup(),
      data: {
        ...mkValidBackup().data,
        lastInputs: {
          crossfit: {
            durationMinutes: "60",
            strengthSkill: "Snatch",
            wodFormat: "AMRAP",
            focusMovement: "Hip thrust",
            customField: "ignored",
          },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a backup where data is missing", () => {
    const result = BackupShapeSchema.safeParse({
      exportedAt: "2026-09-02T10:00:00.000Z",
      version: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a backup where data is not an object", () => {
    const result = BackupShapeSchema.safeParse({
      exportedAt: "2026-09-02T10:00:00.000Z",
      version: 1,
      data: "not an object",
    });
    expect(result.success).toBe(false);
  });
});
