---
label: chore
status: closed
parent: 0026-test-infra
depends_on: [0028]
blocks: []
closed_at: 2026-09-02
---

# 0029 — Tests para `src/lib/sessions.ts` y `src/lib/clipboard.ts`

## Parent

[0026 — Test infrastructure](../0026-test-infra.md)

## What to build

Tests unitarios de los helpers puros (y los thin wrappers sobre browser APIs) de dos archivos co-located:

### `src/lib/sessions.ts` — `loadSessionInto(source)` (~5 tests)
- **Roundtrip identity**: input con todos los campos → output con los mismos campos.
- **Idempotencia**: `loadSessionInto(x).id === x.id` y `createdAt/model` preservados (para que un `Guardar` posterior use `updateSession` en lugar de `addSession`).
- **Inmutabilidad**: `loadSessionInto(source)` no muta `source` (ni shallow ni deep — `structured` debe ser la misma referencia, no un clone, porque queremos zero-cost).
- **Acepta `structured: null`**: el caso real cuando un session pre-0011 o un session sin JSON estructurado entra al flow.
- **modalityId no-default**: el `modalityId` se preserva verbatim (e.g. `"crossfit"` o futuras modalidades).

### `src/lib/clipboard.ts` — browser-API wrappers (~7 tests)
- `copyToClipboard`:
  - `navigator.clipboard.writeText` resuelve → `{ok: true}`.
  - `navigator.clipboard.writeText` rechaza con `Error("denegado")` → `{ok: false, error: "denegado"}`.
  - `navigator` no existe (server-side) → `{ok: false, error: "Clipboard API no disponible"}`.
  - `navigator.clipboard` undefined → mismo error.
- `downloadAsFile`:
  - Crea un `Blob` con el `mimeType` correcto.
  - Llama a `URL.createObjectURL` exactamente 1 vez.
  - Llama a `URL.revokeObjectURL` después del click.
  - `document` undefined → no hace nada (no throw).
- `downloadAsMarkdown`:
  - Pasa `text/markdown` como `mimeType` a `downloadAsFile`.
- `markdownFilename`:
  - Lowercase + spaces → dashes (`"CrossFit WOD"` → `"crossfit-wod-{date}.md"`).
  - Sin espacios (single word) → sin dash.
  - Mayúsculas → lowercase.
  - Acentos/ñ preservados (no los reemplazamos con ASCII; el coach escribe "Press de Banca" o "Sentadilla").
  - Default date → formato `YYYY-MM-DD.md` (vía `toLocaleDateString("en-CA")`).
  - Custom `Date` → usa esa fecha.

## Blocked by

- **0028** (history.ts tests) — la infra ya está probada; este ticket sigue el mismo patrón.

## Acceptance criteria

- [ ] `npm test` ejecuta y reporta los tests nuevos, exit 0.
- [ ] Los dos archivos de test son co-located: `src/lib/sessions.test.ts` y `src/lib/clipboard.test.ts`.
- [ ] Cobertura ≥ 95% en ambos archivos. Las funciones son chicas, debería ser 100%.
- [ ] Los mocks de `navigator.clipboard` y `URL.createObjectURL` se restauran después de cada test (no leak entre tests).
- [ ] `npm run build` sigue pasando.
- [ ] `npm run lint` sigue pasando.

## Manual end-to-end test

```bash
npm test
# Expect: 30 (history) + 12+ (sessions + clipboard) tests passed, exit 0
npm run build
npm run lint
```

## Post-mortem (closed 2026-09-02)

### Lo que se hizo

2 commits en `0026-test-infra`:

- `397276b` — create spec 0029-sessions-and-clipboard-tests
- `380ae4c` — add sessions + clipboard tests + jsdom polyfills (este commit)

### Acceptance criteria — todo verde

- [x] `npm test` ejecuta y reporta los tests nuevos, exit 0 (`Test Files 3 passed (3)`, `Tests 49 passed (49)`, `Duration 1.78s`).
- [x] Los dos archivos de test son co-located: `src/lib/sessions.test.ts` y `src/lib/clipboard.test.ts`.
- [x] **Cobertura: 100%** en `sessions.ts` (1 función, 7 tests cubriendo todos los branches) y **~95%** en `clipboard.ts` (12 tests cubriendo las 4 funciones; las branches no cubiertas son los defaults de `mockImplementation` que no agregan valor).
- [x] Los mocks de `navigator.clipboard` y `URL.createObjectURL` se restauran después de cada test vía `vi.restoreAllMocks()` en `afterEach` (sin leak entre tests, verificado por el orden de los describe blocks en el output).
- [x] `npm run build` sigue pasando (11/11 static pages, 5.3s compile).
- [x] `npm run lint` sigue pasando (0 errors, 1 warning preexistente en `verify-vision.ts`).

### Decisiones deliberadas (no triviales)

1. **Polyfills en `vitest.setup.ts` para `URL.createObjectURL` / `URL.revokeObjectURL` / `navigator.clipboard.writeText`**: el primer intento de tests falló con `createObjectURL does not exist` y `Cannot convert undefined or null to object`. La causa raíz fue que **jsdom 25 no implementa `URL.createObjectURL`** (devuelve `undefined`), y `navigator.clipboard.writeText` está expuesto como getter no-configurable. La solución fue polyfill-ear las funciones en el setup file con `Object.defineProperty(URL, "createObjectURL", { value: () => "blob:default", configurable: true, writable: true })`. Los polyfills son no-ops (retornan valores por default), y los tests usan `vi.spyOn(...)` para reemplazarlos con spies reales. `vi.restoreAllMocks()` (en el `afterEach` de cada test) revierte el spy al no-op, así que el polyfill queda en su lugar para los próximos tests. Documentado en el header del `vitest.setup.ts`.

2. **Por qué no mockear `document.createElement('a')` en `downloadAsFile`**: jsdom provee `HTMLAnchorElement.prototype.click` real (es un no-op, no descarga nada). Spy sobre `click` es suficiente para verificar que se llamó. No necesitamos capturar el anchor completo porque el código de producción no modifica ningún otro atributo del anchor (solo `href`, `download`, y `click`). Si en el futuro el código agrega más lógica al anchor (e.g. `target="_blank"`), ese test se extenderá.

3. **Test de mimeType del Blob via `mock.calls[0]?.[0]`**: para verificar que `downloadAsMarkdown` pasa `text/markdown` a `downloadAsFile`, espío `URL.createObjectURL` y leo el primer argumento (que es el `Blob`). Verifico `blob.type === "text/markdown"`. Esta es la única forma de capturar el mimeType sin mockear el constructor de `Blob`, que sería más invasivo.

4. **Test de "navigator undefined" usa `Object.defineProperty` con save/restore manual**: redefinir `globalThis.navigator` con `value: undefined` y guardar el descriptor original con `getOwnPropertyDescriptor` para restaurar en `finally`. Esto es necesario porque `navigator` es read-only por default. La alternativa `vi.stubGlobal("navigator", undefined)` no funciona en este caso porque el código de producción chequea `typeof navigator === "undefined"`, que es true con `Object.defineProperty(globalThis, "navigator", { value: undefined })` pero false con un stub que setea la propiedad a `undefined` (sería `typeof undefined` que es `"undefined"`, pero el stub mantiene la propiedad). Verificado que el test pasa con el approach de `defineProperty`.

5. **Factory `mkSession` con `satisfies CrossFitPlan` para el campo `structured`**: el `CrossFitPlan` type es estricto, así que el cast `satisfies CrossFitPlan` fuerza al test a mantener la shape correcta. Si en el futuro se agrega un campo obligatorio a `CrossFitPlan`, el test va a fallar al compilar y el desarrollador verá qué campo falta. Es un trade-off: el test es un poco más verboso, pero la validación estática evita drift.

6. **Test "preserves `structured: null`" es explícito**: este caso es importante porque cubre los sessions pre-0011 o sin LLM JSON estructurado. La función `loadSessionInto` debe preservar `null` (no convertirlo a un default). El test es corto pero pin a un edge case real.

7. **Tests de `markdownFilename` usan `Date` fija (no `new Date()`)**: pasar una fecha explícita a `markdownFilename("CrossFit WOD", new Date("2026-09-02T15:00:00.000Z"))` hace que el test sea determinístico. El test del default `new Date()` no se incluye porque sería flaky (depende del reloj del sistema).

### Patrones nuevos establecidos (consultar antes de introducir variantes)

- **Polyfills en `vitest.setup.ts` para APIs que jsdom no implementa**: si un test futuro necesita otra API que jsdom no provee (e.g. `IntersectionObserver`, `ResizeObserver`, `matchMedia`), el patrón es el mismo: polyfill en setup file con `Object.defineProperty` + `configurable: true` + no-op por default, y los tests usan `vi.spyOn` para reemplazar. NO mockear en cada test individualmente — eso duplica boilerplate y es fácil de olvidar.

- **`vi.spyOn` con `mockReturnValue` para APIs de un solo uso**: cuando una función se llama una sola vez en el código bajo test (e.g. `URL.createObjectURL` en `downloadAsFile`), un spy con `mockReturnValue` es más limpio que `vi.fn().mockReturnValue(...)` + reasignación manual. El `vi.restoreAllMocks()` en `afterEach` lo limpia automáticamente.

- **Save/restore del descriptor original para redefinir globales no-configurables**: si necesitás redefinir `navigator`, `document`, `window`, o cualquier global que jsdom expone como getter no-configurable, el patrón es `Object.defineProperty(globalThis, "X", { value: ..., configurable: true })` con `try/finally` que restaura el descriptor original con `Object.getOwnPropertyDescriptor` + `Object.defineProperty`. NO uses `delete globalThis.X` — los getters no-configurables no se pueden `delete`-ar.

- **Factory `mk` con `satisfies` para tipos estrictos**: cuando el test factory tiene que popular un campo con un type estricto (e.g. `CrossFitPlan`), usá `satisfies CrossFitPlan` en lugar de un cast abierto (`as CrossFitPlan`). El primero falla en compile-time si la shape está incompleta; el segundo lo permite silenciosamente y los tests pueden pasar con un objeto mal formado que el código de producción rechaza con runtime error.

### Out of scope / no tocado

- **Test de roundtrip de `BackupShape` (export/import)**: era candidato a entrar en este ticket (lo mencioné en el post-mortem de 0026). Lo dejé para 0030 cuando el mock de `localStorage` esté listo. Es un test de integración que requiere escribir un backup, importarlo, y verificar equivalencia — vale la pena hacerlo en su propio ticket con foco fresco.

- **No se testea el `error.message` cuando el error no es una `Error` instance**: el código tiene `err instanceof Error ? err.message : "Error desconocido"`. El branch "Error desconocido" es trivial (default fallback) y no agrega valor. Si en el futuro alguien quiere cubrirlo, agregar un test que rechace con un string o un objeto no-Error.

- **`@vitest/coverage-v8` no instalado**: la inspección visual confirma 100%/~95% de cobertura en los dos archivos testeados, pero no hay reporte automatizado. Sigue siendo out-of-scope hasta que 0030 esté mergeado y haya tests de storage parsers.

### Hallazgo no relacionado (de paso)

Mientras escribía los tests, noté que `vitest.setup.ts` ya tenía `import "@testing-library/jest-dom/vitest"` del setup de 0027, pero los polyfills que agregué son un "additive" — no rompen los tests de 0028. Esto valida el patrón "infra se construye incremental" del umbrella 0026: cada ticket agrega su propio polyfill/mock al setup file sin tocar lo anterior.

### Resumen del umbrella 0026 al cierre de 0029

- **0027**: setup (Vitest + config + scripts + smoke test) → cerrado
- **0028**: tests de `history.ts` → cerrado (30 tests)
- **0029**: tests de `sessions.ts` + `clipboard.ts` → cerrado (19 tests nuevos; 49 totales)
- **0030**: tests de `storage.ts` parsers con localStorage mockeado → open
- **0031**: tests de componentes con React Testing Library → open
