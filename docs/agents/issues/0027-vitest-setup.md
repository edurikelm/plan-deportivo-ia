---
label: chore
status: open
parent: 0026-test-infra
depends_on: []
blocks: [0028, 0029, 0030, 0031]
---

# 0027 — Vitest setup (no tests yet)

## Parent

[0026 — Test infrastructure](../0026-test-infra.md)

## What to build

1. **`vitest.config.ts`** en la raíz del proyecto:
   ```ts
   import { defineConfig } from "vitest/config";
   import path from "node:path";

   export default defineConfig({
     resolve: {
       alias: {
         "@": path.resolve(__dirname, "./src"),
       },
     },
     test: {
       environment: "jsdom",
       setupFiles: ["./vitest.setup.ts"],
       include: ["**/*.{test,spec}.{ts,tsx}"],
       exclude: ["node_modules", ".next", ".opencode", "dist", ".agents"],
     },
   });
   ```

2. **`vitest.setup.ts`** en la raíz del proyecto:
   ```ts
   import "@testing-library/jest-dom/vitest";
   ```

3. **Scripts en `package.json`**:
   - `"test": "vitest run"` — single run, exit 0 con success.
   - `"test:watch": "vitest"` — watch mode para dev.

4. **Smoke test** en `test/smoke.test.ts`:
   ```ts
   import { describe, it, expect } from "vitest";

   describe("test infra smoke", () => {
     it("runner is alive", () => {
       expect(1 + 1).toBe(2);
     });
   });
   ```

5. **`.gitignore`**: agregar `coverage/`.

6. **Dependencias a instalar** (devDependencies):
   - `vitest`
   - `jsdom`
   - `@testing-library/react`
   - `@testing-library/jest-dom`
   - `@testing-library/user-event`

## Blocked by

None.

## Acceptance criteria

- [ ] `npm test` ejecuta y sale con exit 0.
- [ ] El smoke test corre y reporta 1 test passed.
- [ ] `npm run build` sigue pasando (no se rompió nada).
- [ ] `npm run lint` sigue pasando.
- [ ] El alias `@/*` está configurado en `vitest.config.ts` (verificable en 0028 cuando se escriba un test con `import { computeTotals } from "@/lib/calculator/history"`).

## Manual end-to-end test

```bash
npm install
npm test
# Expect: 1 test passed, exit 0
npm run build
# Expect: build pasa, 11/11 static pages
npm run lint
# Expect: 0 errors
```

## Post-mortem (TBD)
