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
