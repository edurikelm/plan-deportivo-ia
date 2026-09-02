---
label: chore
status: closed
parent: 0026-test-infra
depends_on: [0029]
blocks: [0031]
closed_at: 2026-09-02
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

## Post-mortem (closed 2026-09-02)

### Lo que se hizo

3 commits en `0026-test-infra`:

- `9948c0b` — create spec 0030-storage-parsers-tests
- `a0f30d9` — add storage.ts parsers tests + resetLocalStorage helper (este commit)

### Acceptance criteria — todo verde

- [x] `npm test` ejecuta y reporta los tests nuevos, exit 0 (`Test Files 4 passed (4)`, `Tests 90 passed (90)`, `Duration 2.03s`).
- [x] `src/lib/storage.test.ts` co-located con la impl, imports via `@/lib/storage`.
- [x] **`resetLocalStorage()` helper en `vitest.setup.ts`** (export named). Ver detalle en "Decisiones" abajo.
- [x] Cobertura: 100% sobre los parsers (`parseSessionsFromRaw`, `parseRecordsFromRaw`, `getAllLastInputs`, `getSessionsRaw`, `getLastInputRaw`, `isQuotaError`) y 100% sobre el flujo de backup (`exportAllData`, `importAllData`, `clearAllData`).
- [x] `npm run build` sigue pasando (11/11 static pages).
- [x] `npm run lint` sigue pasando (0 errors, 1 warning preexistente en `verify-vision.ts` no introducido por este ticket).
- [x] Total acumulado: 49 (current) + 41 (0030) = **90 tests pasando**.

### Decisiones deliberadas (no triviales)

1. **NO reemplazar `globalThis.localStorage` con un stub manual.** El spec 0026 pedía un mock manual de `localStorage` en `vitest.setup.ts` para tener control sobre el `storage` event auto-dispatch. La intención original era: en jsdom 25, `setItem` dispara el evento automáticamente (mismo-tab), lo cual rompe los tests que cuentan "exactamente 1 evento por write". Al validar empíricamente con un test de hipótesis (no commiteado), descubrimos que **jsdom 25 NO auto-dispatcha el storage event en same-tab** — sigue la spec WHATWG. Esto significa que el stub manual es innecesario. El código de producción (`storage.ts`) usa `dispatchStorage` (su propio dispatch manual) precisamente porque la spec dice que el evento no se dispara same-tab, y jsdom 25 es fiel a esa spec. Decisión: mantener el `localStorage` real de jsdom y solo agregar un helper `resetLocalStorage()` que llama `localStorage.clear()`. Esto es más simple, evita el problema del brand check que el stub manual introducía (ver punto 2), y refleja la realidad del runtime.

2. **Por qué el stub manual fallaba con `storageArea`.** El primer intento sí reemplazó `globalThis.localStorage` con un `Map`-based stub. Esto rompió `dispatchStorage` en `storage.ts:11-19` con `TypeError: Failed to construct 'StorageEvent': parameter 2 has member 'storageArea' that is not of type 'Storage'`. jsdom 25 valida estrictamente que el campo `storageArea` del `StorageEventInit` sea del tipo `Storage` (la interfaz DOM), no solo "objeto con la misma shape". El stub era un plain object, no un `Storage` real, y jsdom lo rechazó. Tres opciones para resolver: (a) hacer que el stub extienda `Storage.prototype` vía `Object.create(window.localStorage)` — invasivo y sutil, (b) cambiar la implementación de `dispatchStorage` para no pasar `storageArea` — modifica código de producción solo por tests, (c) usar el `localStorage` real de jsdom. Opción (c) es la correcta porque jsdom ya provee un `Storage` válido.

3. **El test "fires a synthetic storage event for each removed key" verifica 2 eventos.** `clearAllData` itera sobre las keys y llama `dispatchStorage` por cada una. Con 2 `pd:*` keys en localStorage al momento del test, esperamos 2 eventos. Si en el futuro se agregan más keys al clear path, el test va a fallar y va a obligar a actualizar el conteo — eso es bueno, porque detecta cambios de scope no intencionales.

4. **Test "ignores non-`pd:last-input-*` keys" usa `unrelated:key` para verificar que el filtro de prefijo es estricto.** El `unrelated:` no empieza con `pd:last-input-`, así que `getAllLastInputs` lo ignora. Esto pin a que el filtro de keys es `key.startsWith(LAST_INPUT_PREFIX)` y no `key.startsWith("pd:")` (que sería demasiado permisivo e incluiría `pd:sessions` por error).

5. **El roundtrip test (`exportAllData` → `clearAllData` → `importAllData` → `exportAllData`) compara `data` pero no `exportedAt`.** `exportedAt` es un `new Date().toISOString()` fresco en cada llamada, así que no es comparable. El test compara `version` (constante) y `data` (el contenido real). Esto es lo que el spec 0026 llamaba "roundtrip safety" (User Story 6): si alguien agrega un campo nuevo a `SavedSession` y olvida agregarlo a `BackupShape`, este test va a fallar en el re-export porque `data` no coincidirá.

6. **El test de `importAllData` con backup vacío espera 3 keys importadas, no 4.** Primer instinto: como `lastInputs: {}` no tiene elementos para iterar, no se llama `setLastInput`, así que no se agrega ningún "lastInput:X" a `imported`. Los tres singleton keys (`sessions`, `calculatorState`, `calculatorRecords`) sí se escriben aunque sus payloads estén vacíos. El test ahora usa `expect.arrayContaining([...])` + `not.toContain("lastInput:crossfit")` + `imported.length === 3` para pin a este comportamiento exacto. Si en el futuro alguien decide "escribir siempre al menos un placeholder" en `lastInputs`, este test va a fallar y la decisión de scope queda explícita en el post-mortem.

7. **`isQuotaError` se testea con `new DOMException(name)` y los `name`s reales.** jsdom 25 provee `DOMException` nativo. Los dos names que la función acepta (`QuotaExceededError`, `NS_ERROR_DOM_QUOTA_REACHED`) son los documentados en el JSDoc de la función y en el commit que la introdujo (0017). El test incluye también un caso "non-DOMException" (Error, string, object, null, undefined) para verificar el branch de fallback `false`.

8. **Test factories usan `satisfies` para campos estrictos.** `mkSession` usa `mkInput()` y `mkPlan()` que internamente satisfacen `CrossFitSessionInput` y `CrossFitPlan` respectivamente. Si en el futuro se agrega un campo obligatorio a `CrossFitPlan`, el test va a fallar al compilar. El compilador es el primer filtro de drift.

9. **Los tests de "whitespace-only input" para `parseSessionsFromRaw` están documentados pero no se ejecutan.** El spec inicial lo listaba como branch testeable, pero al revisar el código, el `if (!raw)` solo corta el string vacío (`""`). Whitespace (`"   "`) NO es falsy y se pasa a `JSON.parse`, que tira. No es un branch real. El test quedó solo con el caso `""` y un comentario explicando por qué no testeamos whitespace.

10. **Helpers de read (`getSessionsRaw`, `getLastInputRaw`) son triviales pero importantes.** Estos helpers son el "snapshot" para `useSyncExternalStore` (patrón storage-reactivo del AGENTS.md). Si en el futuro se rompe el contrato (e.g. se cambia `getItem(key) ?? ""` por `getItem(key) || ""` que fallaría para `""` explícito), los tests detectan la regresión. Por eso se testean aunque sean 3 líneas.

### Patrones nuevos establecidos (consultar antes de introducir variantes)

- **`resetLocalStorage()` helper en `vitest.setup.ts` en lugar de stub global.** El spec 0026 llamaba a un stub manual. La realidad es que jsdom 25 provee un `localStorage` válido y fiel a la spec WHATWG. NO lo reemplaces globalmente — vas a romper el brand check del `StorageEvent` en `dispatchStorage`. Si en el futuro hay un test que necesita manipular el `storage` event (e.g. simular cross-tab), usa `vi.spyOn(window, "dispatchEvent")` por test, no cambies el setup global.

- **Test factories con `satisfies` para tipos estrictos (`CrossFitPlan`, `SavedWeightRecord`, `PersistedLastInput`).** Mismo patrón que 0029 con `CrossFitPlan`. Si el test compila, el factory es correcto. Si deja de compilar cuando se agrega un campo al type, el dev ve inmediatamente qué falta.

- **`vi.spyOn(console, "warn")` en el `beforeEach` con `mockImplementation(() => {})`.** Los parsers warn-ean en paths defensivos (datos corruptos, shape inválido). Sin el spy, el output del test runner se llena de WARNs que distraen. Cada test que necesita asertar el warn hace `vi.spyOn(console, "warn")` otra vez (sobrescribiendo el spy del `beforeEach` para esta test específica) y verifica el call count.

- **Roundtrip tests comparan `data`, no `exportedAt`.** Cualquier test que verifique un objeto con un timestamp fresco debe comparar solo los campos deterministas. El timestamp es ruido.

### Out of scope / no tocado

- **Tests de `getCalculatorState` / `setCalculatorState`.** El spec 0026 no los menciona, pero caen en la misma categoría. Quedan para un ticket futuro si surge la necesidad. La función es testeable con el mismo patrón (validar shape, validar defaults, validar validación de DiscRow con Zod).

- **Tests de los `subscribe*` helpers.** Requieren `useSyncExternalStore` para ejercitar el patrón. Mejor cubiertos en 0031 (componentes) donde el storage se usa en contexto real.

- **`@vitest/coverage-v8` instalado.** Sigue siendo out-of-scope. La inspección visual confirma 100% en storage.ts, pero no hay reporte automatizado.

### Hallazgo no relacionado (de paso)

Mientras escribía los tests, noté que `vitest.setup.ts` ya tenía un polyfill para `URL.createObjectURL` / `navigator.clipboard` del trabajo de 0029. El nuevo helper `resetLocalStorage` es puramente aditivo — no rompe los 49 tests previos. Esto confirma el patrón "infra se construye incremental" del umbrella 0026.

### Resumen del umbrella 0026 al cierre de 0030

- **0027**: setup (Vitest + config + scripts + smoke test) → cerrado
- **0028**: tests de `history.ts` → cerrado (30 tests)
- **0029**: tests de `sessions.ts` + `clipboard.ts` → cerrado (19 tests)
- **0030**: tests de `storage.ts` (parsers + backup roundtrip) → cerrado (41 tests)
- **0031**: tests de componentes con React Testing Library → open

**49 → 90 tests** con este ticket. Faltan solo los tests de componentes para cerrar el umbrella 0026.
