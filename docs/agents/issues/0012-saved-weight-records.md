---
label: feature
status: open
parent: null
ready-for-agent: true
adr: 0009-saved-weight-records
---

# 0012 — Saved Weight Records: historial + guardado etiquetado en la Calculadora

## Problem Statement

El Entrenador usa la Calculadora de Pesos durante sesiones de entrenamiento para calcular el peso total de una barra cargada. Hoy la calculadora es **efímera**: el coach tipea barra + discos, copia el resultado al portapapeles, y el cálculo se pierde. No hay forma de:

- Registrar qué ejercicio se hizo con qué carga.
- Recargar un cálculo previo en la calculadora sin re-tipiarlo.
- Recorrer el historial de cálculos de una sesión o un día.
- Distinguir "Back Squat a 80kg" de "Press militar a 30kg" cuando miro cálculos pasados.

Para un coach que pasa por 6-12 ejercicios por sesión y repite ciclos semanalmente, esto significa re-tipear las mismas combinaciones de barra y discos cada vez, o mantener un spreadsheet paralelo.

## Solution

Agregar un **historial durable de cálculos de peso** a la calculadora, con dos modos de captura coexistiendo:

1. **Auto-log (pasivo)** — cada vez que la calculadora llega a un estado estable, se captura automáticamente un registro con `source: "auto-log"` y sin nombre de ejercicio. Es la red de seguridad para coaches que olvidan guardar.
2. **Guardar con etiqueta (explícito)** — un botón en el footer sticky abre un form inline que pide un nombre de ejercicio (obligatorio). Al submit, crea un registro con `source: "manual"` (o `"foto"` si viene del Foto tab) y el nombre poblado.

Los registros viven en `localStorage` (key `pd:calculator-records`). Se exponen en dos superficies:

- **Mini-panel en la calculadora** — últimas 5 cargas etiquetadas con botón `Cargar` (rehidrata el estado) + link al historial completo.
- **Página de historial completa** (`/tools/weight-calculator/history`) — ruta dedicada con búsqueda, filtros por source, sort y acciones por fila (`Cargar`, `Copiar`, `Eliminar`).

Las decisiones arquitectónicas durables están en [ADR-0009](../adr/0009-saved-weight-records.md). La calculadora sigue siendo un **utility manual**, no se convierte en una modalidad de IA.

## User Stories

1. As an Entrenador, I want to type a bar + discs in the calculator, so that I can compute the total weight and plan my next set.
2. As an Entrenador, I want a `Save` button in the calculator footer, so that I can persist the current calculation with a name.
3. As an Entrenador, I want the `Save` form to require an exercise name, so that my history is organized by exercise.
4. As an Entrenador, I want the exercise name field to autocomplete from my previous saves, so that I don't retype "Back Squat" every session.
5. As an Entrenador, I want the calculator to auto-capture each stable state, so that I don't lose work if I forget to save.
6. As an Entrenador, I want auto-logged records to be invisible in the quick-access panel, so that the panel only shows records I named intentionally.
7. As an Entrenador, I want to see my last 5 named records in the calculator, so that I can quickly reload a previous load.
8. As an Entrenador, I want a `Load` button on each saved record, so that I can rehydrate the calculator with one click.
9. As an Entrenador, I want a `Confirm` dialog before `Load` overwrites a different current state, so that I don't lose work in progress.
10. As an Entrenador, I want a `See full history` link from the mini-panel, so that I can browse all records.
11. As an Entrenador, I want the full history page to show all records (named + auto-log), so that I have a complete log.
12. As an Entrenador, I want to filter the history by source (auto-log / manual / photo), so that I can focus on what I want.
13. As an Entrenador, I want to search the history by exercise name (case-insensitive), so that I can find a specific exercise quickly.
14. As an Entrenador, I want to sort the history by date / exercise / weight, so that I can organize the view.
15. As an Entrenador, I want to `Copy` a record's breakdown to the clipboard, so that I can paste it into a chat or note.
16. As an Entrenador, I want to `Delete` a record with a confirm dialog, so that I can clean up my history.
17. As an Entrenador, I want the auto-log to dedupe identical states typed in quick succession, so that the history doesn't fill with noise.
18. As an Entrenador, I want a cap on auto-logged records (oldest discarded), so that localStorage doesn't fill up.
19. As an Entrenador, I want named records to never be discarded, so that I don't lose intentionally-saved work.
20. As an Entrenador, I want Foto-accepted loads to be logged with `source: "photo"`, so that I can attribute which loads came from a photo.
21. As an Entrenador, I want a record's breakdown to be a frozen snapshot, so that editing the current state doesn't corrupt my history.
22. As an Entrenador, I want the history to survive page refresh, so that closing the tab doesn't lose my records.
23. As an Entrenador, I want changes in one tab to be reflected in another tab, so that I can keep working in two windows.
24. As an Entrenador, I want relative dates ("2h ago") in the mini-panel and absolute dates in the full history, so that I can scan quickly in one and audit precisely in the other.
25. As an Entrenador, I want the calculator to remain a tool (not become a modality), so that I keep a clear mental model of what the app does.
26. As an Entrenador, I want the `Save` form to be inline (not a modal or drawer), so that I keep context with the totals I'm saving.
27. As an Entrenador, I want empty states in both surfaces when there are no records, so that the UI doesn't feel broken.
28. As an Entrenador, I want the `Save` form to support Escape to cancel, so that I can dismiss it quickly.
29. As an Entrenador, I want the calculator mini-panel to only show in the Manual tab (not the Photo tab), so that the Photo flow doesn't compete with the preview.
30. As an Entrenador using a keyboard, I want all actions (Save, Load, Delete, Copy) to be reachable via Tab and Enter, so that I don't need a mouse.
31. As an Entrenador on mobile, I want touch targets ≥ 44px, so that I can tap accurately.
32. As an Entrenador on mobile, I want the search bar in the full history to be sticky, so that I can filter while scrolling.

## Implementation Decisions

- **New storage key** — `pd:calculator-records` sigue el namespace `pd:*` existente. Ausencia = array vacío, sin migración. La key `pd:calculator-state` (auto-save del draft) sigue intacta — dos nociones de persistencia coexisten: el draft es lo que se está editando, los records son lo que ya pasó.
- **Data model** — `SavedWeightRecord { id, createdAt, exercise, barKg, discs, totalKg, totalLb, breakdownLine, source }`. `discs` es un snapshot, no referencia viva al estado actual de la calculadora. `exercise` es `string | null`: null sólo en `auto-log`; obligatorio en `manual` y `foto`.
- **Validation** — schema Zod (`SavedWeightRecordSchema`) aplicado por entrada al leer. Las corruptas se descartan con `console.warn`, siguiendo el patrón existente de `getCalculatorState`.
- **Auto-log debounce** — 1500ms. Más largo que el debounce del draft (250ms) para que un pase por la pantalla no genere N registros.
- **Auto-log dedupe** — hash de `barKg + sortedDiscs`. El sort es estable y considera `{weight, unit, count}` como clave compuesta, para que dos discos distintos con el mismo peso pero distinta unidad no colisionen.
- **Auto-log cap** — 200 registros. Cuando se excede, se descarta el más antiguo. Los registros `manual` y `foto` **nunca** se descartan.
- **Foto attribution** — cuando el preview del Foto tab se aplica, se persiste un registro con `source: "foto"` **inmediato** (no debounced). La atribución de origen se preserva aunque el coach edite después.
- **Save form** — inline en el footer sticky, no modal ni drawer. El form expande el footer verticalmente; los totales quedan visibles debajo. Auto-focus al input al abrir. Escape cierra.
- **Exercise name normalization** — trim + collapse whitespace; se preserva la capitalización del coach. El autocomplete dedupea case-insensitive pero guarda la capitalización de la primera aparición.
- **Load behavior (mini-panel)** — `window.confirm` si el draft actual difiere del registro a cargar. Si coincide, no-op silencioso.
- **Load behavior (full history page)** — escribe a `pd:calculator-state` **antes** de navegar, para que la calculadora abra ya con la carga correcta. Sin flash de "vacío → aplicada".
- **Mini-panel filter** — sólo `exercise !== null` (etiquetados). Los auto-logs no aparecen en el panel rápido; sólo en la página completa.
- **Mini-panel limit** — 5 registros, ordenados por `createdAt` desc.
- **Full history features** — search (case-insensitive includes sobre `exercise`); filter chips (Todos / Auto-log / Manual / Foto); sort (date-desc default, date-asc, exercise, weight-desc); acciones por fila (Load, Copy, Delete).
- **Storage events** — los componentes se suscriben a `window.addEventListener("storage", ...)` filtrando por `e.key === "pd:calculator-records"` para reaccionar a cambios cross-tab y same-tab. Cleanup en unmount.
- **Layout** — la calculadora sigue single-column estricto (respetando ADR-0005, cuya excepción de sidebar sólo aplica a `/generate/[modalityId]`). El mini-panel vive **debajo** del bar visualization, no como sidebar. La página de historial usa `max-w-2xl` (consistencia con la calculadora).
- **Edge cases** — quota exceeded → toast con copy claro; corrupt data → discard + warn; double-click en Save → botón disabled durante el submit; foto + manual posterior → dos registros con IDs únicos, no se deduplica (atribuciones distintas).
- **No new model** — esta feature no llama al LLM. La infra existente (MiniMax-Text-01 para CrossFit, MiniMax-M3 para Foto) no se toca.

## Testing Decisions

El proyecto **no tiene infra de tests** hoy (no hay `vitest`, `jest`, ni `node:test` configurado en `package.json`). El umbrella explícitamente difiere agregar infra de tests a un PR aparte (citado en el issue 0012 inicial). Por lo tanto:

- **No se agregan tests automatizados en este spec.** La verificación es manual end-to-end, scripteada en el ticket de polish (0017) y ejecutada antes de mergear.
- **El seam de testing futuro** (cuando el equipo agregue infra) es el más alto posible: los **helpers puros** en `lib/calculator/history.ts` (`computeTotals`, `hashState`, `normalizeExerciseName`, `dedupeExercises`). Cubren la lógica más decision-rich del feature y son trivialmente testeables sin DOM, sin storage, sin React.
- **Prior art en el repo** — no hay. El equipo decidirá si suma `vitest` (recomendado por velocidad y zero-config para Vite/Next) o `node:test` (built-in, sin dependencias). Decisión fuera de scope de este spec.
- **Manual verification surface** — el script del ticket 0017 cubre los flujos principales: save manual, auto-log, foto → manual, persistence tras refresh, filtros, sort, load, copy, delete, empty states, cap de auto-log.

## Out of Scope

- Convertir la calculadora en una modalidad de IA (sigue utility manual).
- Registry tipado de movimientos (el campo `exercise` es string libre; el autocomplete ayuda a la consistencia).
- Sincronización entre dispositivos.
- Adjuntar una foto al registro (la foto del momento es efímera por el peso en storage).
- Gráficas o trends por ejercicio (sería un tool separado, e.g. `/tools/progression`).
- Bulk delete / multi-select.
- Edit inline de un registro existente (sólo create + delete; el helper `updateRecord` queda exportado pero no usado en UI).
- Export CSV/JSON del historial.
- Cross-references con `SavedSession` de CrossFit (un WOD generado podría enlazar a un registro de peso, pero eso es feature de modalidades futuras).
- Test infra automatizada (deferida a PR aparte).
- Paginación en la página de historial (asumimos < 2000 registros en uso típico).

## Further Notes

- **Issue umbrella** — este spec. La implementación se parte en 5 vertical slice tickets (0013-0017), cada uno produciendo un PR mergeable independientemente. El ticket 0017 cierra formalmente este umbrella y todos los sub-tickets.
- **ADR de soporte** — [docs/adr/0009-saved-weight-records.md](../adr/0009-saved-weight-records.md). Contiene el rationale, las alternativas consideradas, y las consecuencias durables.
- **ADRs que se respetan** — ADR-0007 (la calculadora vive en `/tools`, no es una modalidad), ADR-0005 (la excepción de sidebar no aplica a esta ruta), ADR-0001 (local-first, sin infra nueva), ADR-0008 (no se introduce un modelo nuevo).
- **Documentación de dominio actualizada** — `CONTEXT.md` (modelo `SavedWeightRecord`, storage schema, glosario, rutas) y `PRODUCT.md` (capabilities, surfaces, evidence) reflejan el estado de este spec.
- **Local-first por diseño** — no hay backend nuevo, no hay nueva dependencia de runtime, no hay migraciones de storage. La reversibilidad es local: borrar `pd:calculator-records` no afecta otras keys.
- **Naming consistency** — el storage usa la convención `pd:*`, los componentes siguen el patrón de sufijos `_components/*.tsx` y barrels `index.ts` del proyecto, los iconos vienen de `lucide-react` (versión ya en uso), los estilos siguen el design system (chalk card, hairlines, sin shadows, sin modales).

## Children (vertical slice tickets)

- [0013 — Save a labeled record](./0013-save-labeled-record.md) — can start immediately
- [0014 — Auto-log captures stable states](./0014-auto-log.md) — blocked by 0013
- [0015 — Mini-panel in the calculator shows last 5 labeled records](./0015-mini-panel.md) — blocked by 0013 (parallel with 0014, 0016)
- [0016 — Full history page with search, filters, sort, and per-row actions](./0016-history-page.md) — blocked by 0013 (parallel with 0014, 0015)
- [0017 — Polish, edge cases, and end-to-end verification](./0017-polish-and-verify.md) — blocked by 0013, 0014, 0015, 0016

> Note: an earlier breakdown with 7 horizontal-layer tickets (0013-0019) was archived to `.archive/` when the work was re-cut into the 5 vertical slices above. The archived files are kept for historical reference only and are not part of the active work.
