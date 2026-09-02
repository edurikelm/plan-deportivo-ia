---
label: chore
status: open
parent: 0026-test-infra
depends_on: [0029]
blocks: [0031]
---

# 0030 — Tests para los parsers de `src/lib/storage.ts`

## Parent

[0026 — Test infrastructure](../0026-test-infra.md)

## What to build

Tests unitarios de los tres parsers defensivos de `storage.ts` y un test de roundtrip para el flujo de backup (`exportAllData` / `importAllData` / `clearAllData`). Los parsers leen `localStorage` en el camino de producción, así que necesitamos un mock de `localStorage` en `vitest.setup.ts` para poder testearlos.

### Mock de `localStorage` en `vitest.setup.ts`

- Stub in-memory que implementa `getItem`, `setItem`, `removeItem`, `key`, `length`, `clear` con la semántica real del spec (single source of truth, sin quota por default).
- `Object.defineProperty(globalThis, "localStorage", { value: stub, configurable: true, writable: true })` para que `storage.ts` lo use.
- `dispatchEvent` para `StorageEvent` ya está provisto por jsdom; los tests de `dispatchStorage` lo aprovechan.
- Factory de reset por-test (`localStorage.clear()` en `beforeEach`) para que no haya leak entre tests.

### `parseSessionsFromRaw(raw)` (~5 tests)

- `""` (string vacío) → `[]`.
- JSON válido con array de 2 `SavedSession` → retorna el array.
- JSON inválido (`"not json"`, `"{not array}"`, `"42"`) → `[]` + no throw.
- JSON con shape no-array (e.g. `{"sessions": [...]}`) → `[]` + `console.warn` llamado.
- `null` como input (cast `as string`) → `[]` defensivo (cualquier falsy → `[]`).

### `parseRecordsFromRaw(raw)` (~6 tests)

- `""` → `[]`.
- JSON válido con array de 2 records válidos → retorna los 2 records.
- JSON con 1 record válido + 1 record corrupto (e.g. `barKg: -5`) → retorna solo el válido + `console.warn` por el corrupto.
- JSON con 1 record válido + 1 record con `source: "auto-log"` (todavía soportado por el enum) → ambos pasan.
- JSON con 1 record con `source: "invalid-source"` (fuera del enum) → solo el válido.
- JSON inválido → `[]` + no throw.

### `getAllLastInputs()` (~5 tests)

- Sin keys en `localStorage` → `{}`.
- 1 `pd:last-input-crossfit` válida → `{ crossfit: {...} }`.
- 3 keys (`pd:last-input-crossfit`, `pd:last-input-powerlifting`, `pd:last-input-hipertrofia`) → todas en el map.
- Mezcla con keys no-`pd:last-input-*` (e.g. `pd:sessions`, `pd:calculator-records`) → solo las `pd:last-input-*`.
- 1 key corrupta (JSON inválido) → se omite silenciosamente.

### Roundtrip de backup (~3 tests)

- `exportAllData()` con `localStorage` poblado → `BackupShape` con `version: 1` + `exportedAt` ISO.
- `exportAllData()` → `importAllData(shape)` → mismo contenido (sessions, calculatorState, calculatorRecords, lastInputs).
- `importAllData(shape)` → `exportAllData()` → `version: 1` y datos equivalentes.
- `clearAllData()` → todas las `pd:*` keys removidas + no quedan otras keys (asumiendo que el stub empieza solo con `pd:*`).
- `importAllData` con `shape.data.sessions` corruptas (e.g. circular) → `result.ok === false` + `errors` poblado.

### Helpers de read para `useSyncExternalStore` (~2 tests)

- `getSessionsRaw()` con `pd:sessions` vacío → `""`.
- `getSessionsRaw()` con data → retorna el JSON string verbatim.
- `getLastInputRaw("crossfit")` con key vacía → `""`.

## Blocked by

- **0029** (sessions + clipboard tests) — la infra (vitest.setup.ts, jsdom) ya está probada. Este ticket sigue el mismo patrón: extender setup + co-located tests.

## Acceptance criteria

- [ ] `npm test` ejecuta y reporta los tests nuevos, exit 0.
- [ ] `src/lib/storage.test.ts` co-located con la impl.
- [ ] Mock de `localStorage` en `vitest.setup.ts` (extensión aditiva, no rompe tests existentes).
- [ ] Cobertura de los parsers: 100% (todas las funciones son testeables sin DOM, sin React, sin async).
- [ ] `npm run build` sigue pasando.
- [ ] `npm run lint` sigue pasando.
- [ ] Total acumulado: 49 (current) + 20+ (0030) = ~70+ tests pasando.

## Manual end-to-end test

```bash
npm test
# Expect: 49 (current) + 20+ (0030) tests passed, exit 0
npm run build
npm run lint
```

## Out of scope / no tocado

- **Tests de `getCalculatorState` / `setCalculatorState`**: el spec 0026 no los menciona explícitamente, pero caen en la misma categoría (parsers con validación). Si hay tiempo, agregar 2-3 tests (defaults, corrupto, válido). Si no, queda para un ticket futuro.
- **Tests de los `subscribe*` helpers**: requieren `useSyncExternalStore` para ejercitar el patrón; mejor cubiertos por los tests de componentes en 0031.
- **Tests de `isQuotaError`**: la función es trivial (3 líneas) y se cubre indirectamente en los tests de `importAllData` con `QuotaExceededError`. Si en el futuro hay lógica condicional basada en `isQuotaError`, agregar tests dedicados.
- **Coverage gate** (`@vitest/coverage-v8`): sigue siendo out-of-scope hasta que 0031 esté mergeado.

## Patrones esperados (consultar 0029 antes de introducir variantes)

- Co-located: `src/lib/storage.test.ts` con imports `@/lib/storage`.
- `describe` por función, `it` por branch.
- `beforeEach(() => localStorage.clear())` para reset entre tests (no usar `afterEach` para reset — el `localStorage.clear()` debe ejecutarse antes de que cada test empiece a poblar).
- `vi.spyOn(console, "warn")` para verificar los `console.warn` de los parsers (silenciar el output durante los tests con `vi.fn().mockImplementation(() => {})`).
- Factory `mkRecord` con `satisfies SavedWeightRecord` para crear records válidos en los tests.
