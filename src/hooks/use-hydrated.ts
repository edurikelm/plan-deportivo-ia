"use client";

import { useSyncExternalStore } from "react";

/**
 * Returns `false` during SSR and the first client render, `true` once the
 * component has hydrated on the client.
 *
 * Use it to gate UI that depends on browser-only state (localStorage,
 * window.matchMedia, etc.) so we don't render a misleading placeholder
 * before the real value is available.
 *
 * Implementation note: `useSyncExternalStore` with a no-op subscribe and a
 * snapshot that differs between server (`false`) and client (`true`) is the
 * idiomatic way to do this in React 18+. The server returns `false` so the
 * markup matches what the server produced; the client switches to `true` on
 * hydration, triggering a re-render with the real value.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}