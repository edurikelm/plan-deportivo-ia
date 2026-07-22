# Single-user local architecture

The app serves exactly one Entrenador per browser, with no auth, no DB, and no cloud sync. All state — Clases, Ideas, the focus field — persists in `localStorage` under `pd:classes` and `pd:ideas`.

Chosen over multi-user from day one because: (a) the user is a single coach with one workflow, (b) zero infra is the minimum viable surface for a minimalist tool, (c) the API key + persistence layer are easy to swap if collaboration is needed later.

**Status**: accepted

**Considered alternatives**:
- Multi-tenant with Supabase + Auth — rejected: adds infra cost and DX overhead disproportionate to v1 scope.
- GitHub as auth + persistence — rejected: overfits to developer identity and doesn't match a coach's mental model.

**Consequences**:
- Cannot recover data if the browser's storage is cleared (acceptable for v1, no criticality).
- Cannot share Ideas across devices without manual file export.
- The MiniMax API key sits server-side in `.env.local`; the client cannot generate without the proxy route (intentional — keeps the key off the browser).
- Adding multi-user is non-trivial (auth, DB, conflict resolution) — this ADR locks the architecture until deliberately reversed.
