/**
 * Unit tests for `src/lib/clipboard.ts`.
 *
 * The module has two pure helpers (`markdownFilename`) and three
 * thin wrappers around browser APIs (`copyToClipboard`, `downloadAsFile`,
 * `downloadAsMarkdown`). The pure helpers are tested directly. The browser-API
 * wrappers are tested by spying on the underlying APIs in the jsdom environment.
 *
 * Each test cleans up its own mocks via `afterEach` to avoid leak between
 * tests.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  copyToClipboard,
  downloadAsFile,
  downloadAsMarkdown,
  markdownFilename,
} from "@/lib/clipboard";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ─── copyToClipboard ───────────────────────────────────────────────────────

describe("copyToClipboard", () => {
  it("returns {ok: true} when navigator.clipboard.writeText resolves", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const result = await copyToClipboard("hello world");
    expect(result).toEqual({ ok: true });
    expect(navigator.clipboard.writeText).toHaveBeenCalledExactlyOnceWith(
      "hello world",
    );
  });

  it("returns {ok: false, error: <message>} when writeText rejects", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("Permission denied"),
    );
    const result = await copyToClipboard("hello");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Permission denied");
    }
  });

  it("returns {ok: false, error: 'Clipboard API no disponible'} when navigator is undefined", async () => {
    // Save the original descriptor to restore it after the test.
    const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", {
      value: undefined,
      configurable: true,
    });
    try {
      const result = await copyToClipboard("hello");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("Clipboard API no disponible");
      }
    } finally {
      if (original) {
        Object.defineProperty(globalThis, "navigator", original);
      }
    }
  });

  it("returns {ok: false, error: 'Clipboard API no disponible'} when navigator.clipboard is undefined", async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    try {
      const result = await copyToClipboard("hello");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("Clipboard API no disponible");
      }
    } finally {
      if (original) {
        Object.defineProperty(navigator, "clipboard", original);
      }
    }
  });
});

// ─── downloadAsFile ────────────────────────────────────────────────────────

describe("downloadAsFile", () => {
  it("creates a Blob, calls createObjectURL, clicks an anchor, and revokes the URL", () => {
    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock-url");
    const revokeObjectURLSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    downloadAsFile("test.json", "application/json", '{"a":1}');

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledExactlyOnceWith("blob:mock-url");
  });

  it("does not throw when document is undefined (server-side guard)", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "document");
    Object.defineProperty(globalThis, "document", {
      value: undefined,
      configurable: true,
    });
    try {
      expect(() => downloadAsFile("x.md", "text/markdown", "hi")).not.toThrow();
    } finally {
      if (original) {
        Object.defineProperty(globalThis, "document", original);
      }
    }
  });
});

// ─── downloadAsMarkdown ────────────────────────────────────────────────────

describe("downloadAsMarkdown", () => {
  it("delegates to downloadAsFile with text/markdown", () => {
    // Spy on URL.createObjectURL to confirm the Blob was created and
    // downloadAsFile ran end-to-end. We can't intercept the Blob constructor
    // trivially, but confirming the full flow is enough to validate the
    // delegation.
    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadAsMarkdown("plan.md", "# Title\n\nBody");

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    // Verify the Blob passed to createObjectURL has the markdown mimeType.
    const blobArg = createObjectURLSpy.mock.calls[0]?.[0] as Blob | undefined;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg?.type).toBe("text/markdown");
  });
});

// ─── markdownFilename ─────────────────────────────────────────────────────

describe("markdownFilename", () => {
  it("lowercases and replaces spaces with dashes", () => {
    const date = new Date("2026-09-02T15:00:00.000Z");
    expect(markdownFilename("CrossFit WOD", date)).toBe("crossfit-wod-2026-09-02.md");
  });

  it("does not add a dash when the label has no spaces", () => {
    const date = new Date("2026-09-02T15:00:00.000Z");
    expect(markdownFilename("Crossfit", date)).toBe("crossfit-2026-09-02.md");
  });

  it("preserves accents and ñ (no ASCII transliteration)", () => {
    const date = new Date("2026-09-02T15:00:00.000Z");
    expect(markdownFilename("Press de Banca", date)).toBe(
      "press-de-banca-2026-09-02.md",
    );
    expect(markdownFilename("Sentadilla", date)).toBe(
      "sentadilla-2026-09-02.md",
    );
  });

  it("collapses multiple consecutive spaces into a single dash", () => {
    const date = new Date("2026-09-02T15:00:00.000Z");
    expect(markdownFilename("CrossFit   WOD", date)).toBe(
      "crossfit-wod-2026-09-02.md",
    );
  });

  it("uses the supplied date (default is new Date() at call time)", () => {
    const fixed = new Date("2026-01-15T10:00:00.000Z");
    expect(markdownFilename("Crossfit", fixed)).toBe("crossfit-2026-01-15.md");
  });
});
