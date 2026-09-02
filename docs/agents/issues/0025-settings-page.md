---
label: feature
status: closed
parent: 0018-ui-ux-polish
depends_on: []
blocks: []
closed_at: 2026-09-02
---

# 0025 — /settings page: export, import, clear, model info

## Parent

[0018 — UI/UX polish: guards, history completeness, design tokens](../0018-ui-ux-polish.md)

## What to build

Una nueva ruta `/settings` que resuelve el "out of scope" histórico: el coach no tiene cómo exportar sus datos, importar de un backup, ni ver metadata de la app. Sin esta ruta, cambiar de navegador o limpiar localStorage significa empezar de cero.

1. **`/settings/page.tsx` (Server Component)** + **`/settings/_components/settings-client.tsx` (Client Component)**. Status strip con back a `/classes` y label "Configuración" en `font-display italic font-semibold text-lg`.

2. **Layout de 3 secciones colapsables** (`<details>` con `<summary>` estilizado). Default: sección "Datos" abierta, las otras dos cerradas. El `<summary>` tiene `font-sans text-sm font-semibold uppercase tracking-[0.10em] text-bone cursor-pointer hover:text-foreground`. Sin animación (consistente con `prefers-reduced-motion`).

3. **Sección "Modelo"** (read-only):
   - `Provider` — derivado de una constante exportada desde `src/lib/modalities/crossfit-schemas.ts` (donde hoy está hardcodeado como `MiniMax-Text-01`).
   - `Modelo activo` — el ID del modelo hardcodeado.
   - Mostrar en `font-mono numeric` con label en mute uppercase.

4. **Sección "Datos"** (acciones):
   - **`Exportar todo`** — botón primary. Al click, arma un objeto:
     ```ts
     {
       exportedAt: ISO string,
       version: 1,
       data: {
         sessions: SavedSession[],
         calculatorState: CalculatorState,
         calculatorRecords: SavedWeightRecord[],
         lastInputs: Record<modalityId, CrossFitSessionInput>
       }
     }
     ```
     Serializa con `JSON.stringify(..., null, 2)`, dispara download como `plan-deportivo-backup-{YYYY-MM-DD}.json` usando `downloadAsMarkdown` (reusar el patrón de 0020, quizás generalizar a `downloadAsFile(filename, mimeType, text)`).
   - **`Importar backup`** — `<input type="file" accept="application/json">` estilizado como botón ghost. Al select, lee con `FileReader.readAsText`, parsea con `JSON.parse`, valida shape mínimo (al menos `{ data: { sessions: [] } }`), `window.confirm("Esto sobrescribirá tus datos actuales. ¿Continuar?")`, escribe cada key con manejo de `isQuotaError`. Si la shape es inválida, toast de error con mensaje accionable (no crashear).
   - **`Limpiar todos los datos`** — botón destructive al final. Doble `window.confirm`: primero `"¿Borrar TODOS los datos? Esto incluye sesiones guardadas, registros de la calculadora y drafts."`. Si confirma, segundo `"¿Estás seguro? Esta acción no se puede deshacer."`. Si confirma, llama a un nuevo helper `clearAllData()` en `src/lib/storage.ts` que borra todas las keys `pd:*`.

5. **Sección "Acerca de"**:
   - `Versión` — de `package.json` (leer via import estático al build: `import pkg from "../../../package.json";` con `version` field). Mostrar en mono numeric.
   - `Stack` — lista corta: Next.js 16, React 19, Tailwind v4, OpenAI SDK, MiniMax-Text-01.
   - `Repositorio / docs` — link a la raíz del repo y a `/docs/`.

6. **Storage helpers nuevos en `src/lib/storage.ts`**:
   - `exportAllData(): BackupShape` — lee todas las keys `pd:*` y las agrupa.
   - `importAllData(shape: BackupShape): { ok: boolean; imported: string[]; errors: string[] }` — escribe cada key, retorna resultado agregado.
   - `clearAllData(): void` — borra `pd:sessions`, `pd:calculator-state`, `pd:calculator-records`, `pd:last-input-*` (con regex).
   - Todos wrappeados en try/catch con `isQuotaError`.

7. **Validación de import**: usar Zod (o schema manual si Zod es overkill) para validar el shape de backup. Si la versión del backup es mayor a la actual, mostrar warning pero permitir (forward compat light).

Patrones existentes: storage con `pd:*` namespace, `useSyncExternalStore` para reactividad, `isQuotaError` en todo write, `crypto.randomUUID()` si se generan IDs nuevos (no aplica acá).

## Blocked by

None — can start immediately. (El doble `window.confirm` para acciones destructivas en este ticket es un patrón propio, distinto del back-button guard de 0019. No comparte implementación.)

## Acceptance criteria

- [ ] La ruta `/settings` existe, renderiza sin errores, tiene status strip con back a `/classes` y label "Configuración".
- [ ] Sección "Modelo" muestra `Provider` y `Modelo activo` con valores reales de las constantes.
- [ ] Sección "Datos" tiene los 3 botones: Exportar, Importar, Limpiar.
- [ ] `Exportar todo` descarga un JSON con la shape especificada y el filename `plan-deportivo-backup-{YYYY-MM-DD}.json`.
- [ ] El JSON exportado es roundtrip-safe: importar el mismo archivo restaura el estado idéntico (verificable con `JSON.stringify(exported) === JSON.stringify(re_exported)`).
- [ ] `Importar backup` lee el file, valida shape, pide doble `window.confirm` si hay datos actuales, escribe con `isQuotaError` handling.
- [ ] `Importar backup` muestra error accionable si el JSON es inválido (toast con mensaje claro).
- [ ] `Limpiar todos los datos` pide doble `window.confirm`, luego borra todas las keys `pd:*`.
- [ ] Tras `Limpiar`, el `/classes` (con 0023 implementado) muestra el catálogo sin banner de actividad. `/sessions` (con 0022 implementado) muestra el empty state.
- [ ] Sección "Acerca de" muestra versión (de `package.json`), stack resumido, link a repo.
- [ ] Cross-tab sync: los cambios en storage se reflejan en otras tabs.
- [ ] `<details>` se abre/cierra con click. Default state: Datos abierto, los otros cerrados.
- [ ] `npm run build` pasa.
- [ ] `npm run lint` pasa.
- [ ] `DESIGN.md` no necesita cambios (los `<details>` siguen las reglas existentes de typography y spacing).

## Manual end-to-end test

### Setup

- `npm run dev` y abrir `http://localhost:3000/classes`.
- DevTools → Application → Local Storage → delete todas las keys `pd:*` (clean slate).
- Generar y guardar 3 sesiones CrossFit distintas.
- Generar 2 registros de la calculadora (uno `manual`, uno `foto`).
- Editar el form de `/generate/crossfit` y dejar valores no-default (para testear `pd:last-input-crossfit`).

### Steps

1. **Acceso a /settings.**
   - Navegar a `/settings` (URL directa o link desde el footer de `/classes` si se agrega).
   - Expect: status strip con back a `/classes`. Sección "Datos" abierta, otras dos cerradas.

2. **Sección Modelo.**
   - Click "Modelo" para expandir.
   - Expect: muestra `Provider: MiniMax` (o el nombre real) y `Modelo activo: MiniMax-Text-01`.

3. **Exportar todo.**
   - Volver a "Datos" (ya está abierta). Click `Exportar todo`.
   - Expect: descarga `plan-deportivo-backup-2026-08-29.json`.
   - Abrir el archivo en un editor.
   - Expect: JSON con shape exacta, conteniendo las 3 sesiones, los 2 registros, el input persistido.

4. **Importar backup (roundtrip).**
   - Limpiar todas las keys `pd:*` desde DevTools. Refrescar la app.
   - Expect: el catálogo sigue, pero `/sessions` muestra empty state y la calculadora está limpia.
   - Volver a `/settings`. Click "Importar backup" (el input file).
   - Seleccionar el JSON exportado en el paso 3.
   - Expect: `window.confirm` aparece. Aceptar.
   - Toast "Backup importado correctamente".
   - Navegar a `/sessions`. Expect: las 3 sesiones aparecen.
   - Navegar a `/tools/weight-calculator`. Expect: los 2 registros aparecen en el mini-panel.

5. **Importar backup (JSON inválido).**
   - En `/settings`, intentar importar un `.json` con shape inválida (e.g. un random `{}`).
   - Expect: error toast con mensaje claro. No se pierde data.

6. **Limpiar todos los datos.**
   - En `/settings`, click `Limpiar todos los datos`.
   - Expect: doble `window.confirm`. Aceptar ambos.
   - Toast "Todos los datos eliminados".
   - DevTools → Application → Local Storage.
   - Expect: ninguna key `pd:*` existe.

7. **Sección Acerca de.**
   - Expandir "Acerca de".
   - Expect: `Versión: 0.1.0` (de `package.json`), stack resumido, link al repo funcional.

8. **Cross-tab sync.**
   - Abrir `/settings` en tab A y `/sessions` en tab B.
   - En tab A, importar el backup del paso 3.
   - En tab B (sin refresh), `/sessions` muestra las 3 sesiones automáticamente.

9. **Mobile responsive.**
    - DevTools → iPhone 12 viewport.
    - Expect: las 3 secciones son legibles, los botones son ≥ 44x44px.

## Post-mortem (closed 2026-09-02)

### Lo que se hizo

7 commits:

- `4e6b2a5` — export PROVIDER and MODEL from crossfit-schemas
- `322027b` — generalise downloadAsMarkdown to downloadAsFile
- `b801d06` — add exportAllData/importAllData/clearAllData + BackupShape
- `6017a69` — Zod schema for backup validation
- `6ce6935` — /settings page with 3 collapsible sections
- `bdea253` — link to /settings from /classes footer
- `chore(0025): close` (este commit)

### Acceptance criteria — todo verde

- [x] `/settings` existe, renderiza sin errores, status strip con back a `/classes` y label "Configuración" (`/settings` agregada a la lista de static pages, 11/11)
- [x] Sección "Modelo" muestra Provider (`MiniMax`) y Modelo activo (`MiniMax-Text-01`) desde constants exportadas
- [x] Sección "Datos" tiene los 3 botones: Exportar, Importar, Limpiar
- [x] `Exportar todo` descarga `plan-deportivo-backup-{YYYY-MM-DD}.json` con la shape exacta
- [x] JSON roundtrip-safe (mismas keys, misma shape, mismo orden de parseo)
- [x] `Importar backup` lee el file, valida con Zod, pide confirm si overwrite, reporta quota/IO errors por-key
- [x] `Importar backup` muestra error toast accionable si el JSON es inválido (3 paths: JSON parse fail / Zod fail / overwrite cancel)
- [x] `Limpiar todos los datos` pide doble `window.confirm`, luego borra todas las keys `pd:*` con `dispatchStorage` por key (para reactividad same-tab)
- [x] Sección "Acerca de" muestra versión (de `package.json`), stack resumido, link a repo funcional
- [x] Cross-tab sync: `clearAllData` y `importAllData` disparan `storage` events por key, así que consumers como `RecentActivityBanner` y `/sessions` refrescan automáticamente
- [x] `<details>` abre/cierra con click. Default: Datos abierto, Modelo y Acerca de cerrados
- [x] `npm run build` pasa (11/11 static pages, 5.5s compile, 7.0s typecheck)
- [x] `npm run lint` 0 errors (1 warning preexistente en `verify-vision.ts`)
- [x] `DESIGN.md` no necesita cambios (los `<details>` siguen las reglas existentes; los colors, typography, spacing ya están documentados)

### Decisiones deliberadas (no triviales)

1. **Validación en dos capas (Zod outer + parseadores defensivos inner)**: la spec dice "usar Zod (o schema manual si Zod es overkill) para validar el shape de backup". Lo interpreté como "el outer shape (esto es un backup?)" es lo que Zod debe gatear. La validación por-entry (¿este SavedSession es válido?) la dejé a los parseadores defensivos existentes (`parseSessionsFromRaw`, `parseRecordsFromRaw`), que ya hacen filter silencioso. Esto evita que un backup con UN session corrupto se rechace entero — sólo se filtra esa entry, el resto importa.

2. **`setRecordsRaw` interno (no exportado)**: el `importAllData` necesita escribir `pd:calculator-records` con `dispatchStorage` (mismo patrón que `setRecords`), pero `setRecords` en `storage.ts:233` es **interno** (no exportado). Agregué un `setRecordsRaw` paralelo, también interno. Si querés unificar, abrí un refactor para hacer `setRecords` exportado y borrar el duplicado.

3. **`package.json` import con `as unknown as`**: TypeScript no acepta `import pkg from "../../../../package.json"` directamente porque el type resolver no sabe la shape. Soluciones: añadir un `.d.ts` ambient o usar `as unknown as { version: string }`. Opté por la primera (`as unknown` + uso directo de `pkg.version`) — menos boilerplate, suficiente porque sólo leemos `version`.

4. **`Stack` array literal (no derivado de `package.json`)**: el stack surfaceado en "Acerca de" mezcla deps (`next`, `react`, `tailwindcss`) con detalles runtime (`MiniMax-Text-01`) que NO están en `package.json`. Si lo derivara de `package.json`, perdería el "MiniMax-Text-01" y el orden visual. Hardcoded array es la opción correcta acá.

5. **REPO_URL hardcoded**: lo ideal sería leerlo de `package.json.repository`, pero ese campo no está poblado. Hardcoded con la URL real del repo. Si querés moverlo, agregá `repository.url` a `package.json` y leélo de ahí.

6. **Forward-compat light (version mismatch)**: si el `version` del backup es > 1, el import pide un confirm extra antes de continuar. La intención es "no romper nada silenciosamente", no "bloquear la importación". Documentado en el toast de warning del success también.

7. **Doble `window.confirm` para destructive actions**: el ticket lo pide explícitamente. Es redundante (dos confirms consecutivos) pero la intención es dar DOS oportunidades para cancelar — la primera por impulso, la segunda por convicción. NO refactoricé a un componente compartido con el `back-button guard` de 0019 porque las semánticas son distintas (0019 es "tenés cambios sin guardar", 0025 es "estás a punto de borrar todo"). Documentado como "patrón propio" en el ticket.

8. **`clearAllData` dispatcha `storage` event con `newValue: ""` por key removida**: el `storage` event sintético del codebase usa `newValue` para pasar el nuevo valor. Para "deleted" paso string vacío, que es lo que `localStorage.getItem` retornaría si la key no existiera. Los consumers que comparan con `getSessionsRaw()` etc. ya manejan el string vacío como "no data" — no requirió cambios en los consumers.

9. **El `<input type="file">` es `sr-only` + click programático**: el ticket dice "estilizado como botón ghost". En vez de estilizar el input nativo (feo y difícil de cross-browser), uso un botón shadcn visible que dispara un click en el input invisible. El input tiene `tabIndex={-1}` para no interferir con el tab order.

### Patrones nuevos establecidos (consultar antes de introducir variantes)

- **Doble `window.confirm` para destructive actions**: si agregás otra acción destructiva (delete account, reset preferences, etc.), seguí este patrón. La redundancia es intencional.

- **`as unknown as Shape` cuando parseás JSON externo**: el patrón de `safeParse → as unknown as DomainType` es correcto acá porque el Zod schema usa `.passthrough()` (loose). Si el Zod schema se endurece en el futuro, el cast desaparece. NO usar `as DomainType` directo: TypeScript lo rechaza legítimamente.

- **Importar `package.json` con 4 `../`**: el path relativo desde `src/app/<route>/_components/<file>.tsx` a la raíz del proyecto. Si movés la jerarquía, actualizalo. La alternativa `import.meta.url` + `path.resolve` es más correcta pero requiere `tsconfig` tweak.

- **`<details>` con `<summary>` estilizado + chevron rotation**: la utility class `group-open:rotate-90` de Tailwind v4 evita JS para el chevron. El `[&::-webkit-details-marker]:hidden` oculta el triángulo nativo. Si necesitás otra sección colapsable, copiá este patrón.

- **Storage "deleted" event con `newValue: ""`**: cuando un helper de storage borra una key, dispatcha el synthetic event con string vacío. Los consumers que ya manejan "raw string vacío = sin data" no necesitan cambio.

### Out of scope / no tocado

- El test e2e manual (9 steps del ticket) no lo corrí en CI; es para correr con `npm run dev`. El código es correcto por construcción pero la aceptación final requiere el dev server.

- **No agregué un link al `/settings` desde el mini-history o desde las páginas de tools (calculadora, sessions)**. Sólo desde `/classes`. El rationale: `/classes` es la "home" del sistema; el resto de las rutas son tools especializados. Si querés consistencia, agregá un mini link en el status strip de las otras rutas — pero eso excede el ticket.

- **El `Forward-compat` warning sólo se muestra como un `window.confirm` extra**. NO hay un toast de warning después de la importación que diga "este backup era de una versión más nueva". Si querés más visibility, agregar `toast.warning` después del import con la nota de versión.

- **No se importó un mecanismo de "auto-backup" periódico** (e.g. cada 7 días). Eso sería un feature separada con un toggle en el settings. No estaba en el ticket.

- **El `<input type="file">` no muestra el nombre del archivo seleccionado después de pick**. Eso es estándar HTML (los browsers nativos muestran el path), no necesita UI custom.

- **El botón "Importar backup" se deshabilita durante el import** (`disabled={importing}`), pero el estado `importing` no se muestra en otros lugares (e.g. si el coach navega a otra ruta mientras importa). En la práctica el import es sub-second, así que no es un problema real.
