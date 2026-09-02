import "@testing-library/jest-dom/vitest";

// ─── DOM polyfills for browser APIs not implemented by jsdom 25 ────────────
//
// jsdom 25 does not implement `URL.createObjectURL` / `URL.revokeObjectURL`,
// and `navigator.clipboard.writeText` is either missing or exposed as a
// non-configurable getter. Both of these are called by production code in
// `src/lib/clipboard.ts` (`downloadAsFile` and `copyToClipboard`). Without
// these polyfills, `vi.spyOn(URL, "createObjectURL")` fails with
// "createObjectURL does not exist", which makes the corresponding tests
// impossible to write.
//
// The polyfilled functions are no-op stand-ins. Tests replace them with
// `vi.spyOn(...)` to assert call counts / return values, and
// `vi.restoreAllMocks()` (called in each test's `afterEach`) reverts the
// spy back to the no-op — so the polyfill stays in place across tests.

if (typeof URL.createObjectURL !== "function") {
  Object.defineProperty(URL, "createObjectURL", {
    value: () => "blob:default",
    configurable: true,
    writable: true,
  });
}
if (typeof URL.revokeObjectURL !== "function") {
  Object.defineProperty(URL, "revokeObjectURL", {
    value: () => {},
    configurable: true,
    writable: true,
  });
}

// Replace `navigator.clipboard` with a fresh object that has a real
// `writeText` method. This makes the property spyable from the tests
// while preserving the runtime behavior (`Promise.resolve()`).
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: () => Promise.resolve() },
  configurable: true,
  writable: true,
});

// ─── localStorage isolation helper ───────────────────────────────────────────
//
// jsdom 25 provides a real, working `localStorage`. Two design decisions
// follow from that:
//
//   1. We do NOT replace `globalThis.localStorage` with a custom stub. The
//      reason the umbrella spec (0026) called for a manual stub was to
//      avoid the same-tab `storage` event auto-dispatch some test
//      environments exhibit. jsdom 25 follows the WHATWG spec strictly:
//      same-tab `setItem` does NOT auto-dispatch. The real localStorage
//      is correct.
//
//   2. We expose a `resetLocalStorage()` helper for tests that need a
//      clean slate. Calling `localStorage.clear()` between tests in
//      `beforeEach` keeps state isolated. The helper is a one-liner but
//      making it a named export documents intent and gives future helpers
//      (e.g. `seedLocalStorage(map)`) a place to build on.

/**
 * Clears every key from `window.localStorage`. Tests should call this in
 * `beforeEach` to ensure isolation between tests. Exposed as a named
 * export so test files can import it explicitly and the intent is
 * searchable.
 */
export function resetLocalStorage(): void {
  window.localStorage.clear();
}
