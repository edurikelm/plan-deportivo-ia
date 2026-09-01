---
label: feature
status: open
parent: 0018-ui-ux-polish
depends_on: []
blocks: []
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
