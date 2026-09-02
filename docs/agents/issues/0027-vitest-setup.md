---
label: chore
status: closed
parent: 0026-test-infra
depends_on: []
blocks: [0028, 0029, 0030, 0031]
closed_at: 2026-09-02
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

## Post-mortem (closed 2026-09-02)

### Lo que se hizo

2 commits en `0026-test-infra`:

- `e8cda72` — create umbrella spec 0026-test-infra + child 0027
- `9b70e79` — vitest + react-testing-library + jsdom setup (este commit)

### Acceptance criteria — todo verde

- [x] `npm test` ejecuta y sale con exit 0 (`Test Files 1 passed (1)`, `Tests 1 passed (1)`, `Duration 1.42s`).
- [x] El smoke test corre y reporta 1 test passed (`test/smoke.test.ts`).
- [x] `npm run build` sigue pasando (11/11 static pages, 4.7s compile + 4.8s typecheck + 417ms static).
- [x] `npm run lint` sigue pasando (0 errors, 1 warning preexistente en `verify-vision.ts` que ya estaba antes de 0027).
- [x] El alias `@/*` está configurado en `vitest.config.ts` con `resolve.alias` (verificable en 0028 con el primer `import { computeTotals } from "@/lib/calculator/history"`).

### Decisiones deliberadas (no triviales)

1. **Vitest UI omitido** (`@vitest/ui`): la spec lo listaba como opcional. Decidí no incluirlo porque (a) la dep es chica pero suma ~10MB al `node_modules`, (b) requiere un Vite dev server extra, (c) el feedback de `vitest run` en consola es suficiente para un proyecto de este tamaño. Si más adelante alguien lo necesita, agregarlo es `npm i -D @vitest/ui` + `"test:ui": "vitest --ui"` en `package.json`.

2. **Mock manual de `localStorage` (sin `happy-dom`)** para 0030: `Object.defineProperty(globalThis, "localStorage", { value: stub })` con un objeto que implementa `getItem`/`setItem`/`removeItem`/`key`/`length`/`clear`. Razón: `happy-dom` agrega ~5MB y un set de APIs que no necesitamos; jsdom ya provee `localStorage` real, y el mock manual es 8 líneas. Si en algún momento 0030 revela que el mock manual es insuficiente, evaluar `happy-dom`.

3. **Alias `@/*` resuelto manualmente** en `vitest.config.ts` con `resolve.alias` en vez de usar `vite-tsconfig-paths`. Razón: 4 líneas, evita una dep, y el alias es estático (no hay riesgo de divergencia con `tsconfig.json` paths porque Vitest y Next.js usan exactamente el mismo `paths` shape).

4. **Smoke test en `test/` (no en `src/`)**: la convención típica de Vitest es co-located con la impl, pero un smoke test no tiene "impl" — es un artefacto de infra. Lo puse en `test/smoke.test.ts` (carpeta nueva en la raíz) para que sea evidente su naturaleza temporal. Se borra en 0028 cuando entran los tests reales.

5. **`coverage/` ya estaba en `.gitignore`**: lo verifiqué y la línea 15 ya lo cubría. No hizo falta agregarlo. Lo menciono para que conste en el post-mortem que la decisión ya estaba tomada.

6. **`@testing-library/user-event` instalado pero no usado todavía**: la spec lo lista para 0031 (componentes). Lo instalé junto al resto de las deps de testing para evitar un commit extra en 0028/0031. La dep es ~50KB, despreciable.

### Patrones nuevos establecidos (consultar antes de introducir variantes)

- **Test files co-located con la impl** (M2+): el patrón es `src/lib/calculator/history.test.ts` (mismo directorio que `history.ts`). NO crear `__tests__/` o `tests/` separado para tests unitarios; el convention de Vitest es que estén junto al código que testean.
- **Test files para componentes en `_components/`** (M5): `src/app/<route>/_components/<component>.test.tsx`. Mismo principio de co-location.
- **Smoke test removed when first real test lands** (M2): ticket 0028 reemplaza `test/smoke.test.ts` por `src/lib/calculator/history.test.ts`. Si en algún momento se quiere un smoke test permanente (e.g. para CI healthcheck), crear uno nuevo, no reusar el de infra.

### Dependencias agregadas (devDependencies)

| Paquete | Versión instalada | Razón |
|---|---|---|
| `vitest` | `^3.2.7` | Test runner (TS sin config, jsdom nativo, ~10x más rápido que Jest) |
| `jsdom` | `^25` (o compatible) | Environment para tests que necesitan `localStorage`/`window` |
| `@testing-library/react` | `^16` | Render de componentes React |
| `@testing-library/jest-dom` | `^6` | Matchers como `toBeInTheDocument` |
| `@testing-library/user-event` | `^14` | Simulación de interacciones de usuario (0031) |

Total: 124 paquetes transitivos agregados. 0 peer dep warnings. 12 vulnerabilities preexistentes en el árbol (no relacionadas con este ticket; son de `undici`/`js-yaml`/etc. que ya estaban antes).

### Out of scope / no tocado

- **`happy-dom` no instalado** — explícitamente fuera del scope. El mock manual de `localStorage` es suficiente.
- **Coverage reporter (`@vitest/coverage-v8`)** no instalado. La spec del umbrella lo define como out-of-scope hasta tener ≥ 50% cobertura. Agregar `npm i -D @vitest/coverage-v8` + script `test:coverage` cuando llegue ese momento.
- **`vitest --ui`** no instalado (decisión #1 arriba).
- **No se agregó `vitest.config.ts` a `.prettierignore`** — no hay prettier configurado en el proyecto, así que no aplica.

### Comandos de referencia para próximas sesiones

```bash
npm test              # single run, exit 0 con success
npm run test:watch    # watch mode para dev
npm test -- --ui      # (opcional) abrir Vitest UI; requiere @vitest/ui instalado
```
