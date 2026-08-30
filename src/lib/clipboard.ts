/**
 * Cross-cutting clipboard and file-download helpers.
 *
 * Used by the GenerateClient's result actions and the mini-history / sessions
 * list items, where the same two operations (`Copiar` a markdown string and
 * `Exportar` it as a `.md` file) recur. Centralizing them guarantees that the
 * success / error toasts and the filename convention stay identical across
 * the app.
 *
 * No state, no React — pure browser-API wrappers safe to call from any client
 * component or callback.
 */

/**
 * Write `text` to the system clipboard. Resolves with a structured result so
 * the caller decides what toast to fire (and the type lets us unit-test the
 * shape without mocking `navigator.clipboard`).
 */
export async function copyToClipboard(
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return { ok: false, error: "Clipboard API no disponible" };
  }
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

/**
 * Trigger a browser download of `text` as a markdown file. Synchronous
 * fire-and-forget — there is no useful result to return, and the browser
 * handles the actual save dialog.
 */
export function downloadAsMarkdown(filename: string, text: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([text], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Build the conventional `{slug}-{YYYY-MM-DD}.md` filename used by every
 * `Exportar` action in the app. Keeps the convention in one place.
 */
export function markdownFilename(
  modalityLabel: string,
  date: Date = new Date(),
): string {
  const slug = modalityLabel.toLowerCase().replace(/\s+/g, "-");
  const isoDate = date.toLocaleDateString("en-CA"); // YYYY-MM-DD
  return `${slug}-${isoDate}.md`;
}
