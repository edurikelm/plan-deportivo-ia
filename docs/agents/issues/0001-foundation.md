---
label: feature
status: open
---

## What to build

Set up the data layer: TypeScript types for `Clase` and `Idea`, a typed wrapper around `localStorage` for the keys `pd:classes` and `pd:ideas` (with cross-tab `StorageEvent` notification so multiple tabs see updates), and a `useLocalStorage<T>` hook backed by `useSyncExternalStore` (avoid the `react-hooks/set-state-in-effect` lint rule that Next.js 16 enforces).

Verify with a tiny throwaway component or dev console: creating a Clase and an Idea, reloading, reading back — both persist.

## Acceptance criteria

- [ ] `src/lib/types.ts` exports `Clase`, `Idea`, plus an empty-constant initializer per slice (`EMPTY_CLASE`, `EMPTY_IDEA`).
- [ ] `src/lib/storage.ts` exports `getClasses`, `setClasses`, `addClass`, `updateClass`, `removeClass`, `getIdeas`, `setIdeas`, `addIdea`, `updateIdea`, `removeIdeasByClass`, with cross-tab `StorageEvent` dispatch on writes.
- [ ] `src/hooks/use-local-storage.ts` is `useSyncExternalStore`-based, accepts a `key` and an initial value, returns `[value, setValue]`. Handles SSR (`getServerSnapshot` returns a sentinel so server-render and first client render don't mismatch).
- [ ] Manual smoke test: creating a Clase + Idea persists across `F5` reload.

## Blocked by

None — can start immediately.
