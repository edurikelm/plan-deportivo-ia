---
label: chore
status: open
parent: 0012-saved-weight-records
phase: 7
adr: 0009-saved-weight-records
depends_on:
  - 0018-polish-and-edge-cases
blocks: []
affects:
  - CONTEXT.md
  - PRODUCT.md
---

# 0019 — Fase 7: Documentación & verify (cierre del umbrella)

## Contexto

Séptima y última fase del umbrella [0012-saved-weight-records](./0012-saved-weight-records.md). Después de que las seis fases anteriores (dominio, guardar, auto-log, mini-panel, página de historial, polish) están merged, esta fase:

1. Verifica end-to-end que la feature funciona como un todo.
2. Actualiza la documentación de dominio (`CONTEXT.md`, `PRODUCT.md`) para reflejar el estado final.
3. Cierra formalmente el umbrella 0012 y cada uno de los 0013-0019 con sus post-mortems.

Esta fase es típicamente el último commit antes de marcar el umbrella como `closed`. No introduce código nuevo (excepto ajustes documentales si los hay).

## Tareas

### 1. Verificación end-to-end manual

Seguir este script completo. Cada paso debe pasar. Si alguno falla, abrir un issue de bug inmediato y no cerrar el umbrella hasta resolverlo.

**Setup inicial**:
- [ ] Limpiar `localStorage` del browser: en devtools, `localStorage.clear()`.
- [ ] Recargar la calculadora. Debe abrir con defaults (`barKg: 20, discs: []`).
- [ ] El mini-panel de registros debe mostrar el empty state.

**Captura manual**:
- [ ] Manual tab. Setear `barKg: 60`, agregar disco `{25, kg, 1}`, disco `{20, kg, 1}`. Total esperado: 60 + 2 × (25 + 20) = 150 kg.
- [ ] Click `Guardar`. Form inline aparece.
- [ ] Tipear "Back Squat". Datalist vacío (primera vez). Submit. Toast "Carga guardada".
- [ ] El mini-panel muestra "Back Squat · 150.0 kg · 330.7 lb".
- [ ] Setear `barKg: 60`, agregar disco `{25, kg, 1}`, disco `{10, kg, 1}`, disco `{10, kg, 1}`. Total: 60 + 2 × (25 + 10 + 10) = 150 kg.
- [ ] Click `Guardar`, tipear "Front Squat", submit.
- [ ] Mini-panel muestra Front Squat y Back Squat (en orden inverso de creación, Front primero).

**Captura auto-log**:
- [ ] Cambiar `barKg: 60` → `barKg: 65`. Esperar 2 segundos (más que el debounce de 1500ms).
- [ ] En devtools, `JSON.parse(localStorage.getItem("pd:calculator-records"))`. Debe haber un nuevo registro con `source: "auto-log"`, `barKg: 65`, `exercise: null`.
- [ ] Cambiar `barKg: 65` → `barKg: 60` → `barKg: 65` rápido. Sólo **1** auto-log total con `barKg: 65` (dedupe por hash).

**Captura foto**:
- [ ] Foto tab. Subir una foto de prueba (cualquier imagen JPG/PNG que tengas local).
- [ ] Esperar el preview. Si el modelo tarda más de 60s, retry.
- [ ] Click `Aplicar a la carga`. Toast "Carga aplicada".
- [ ] Inmediatamente en devtools, hay un nuevo registro con `source: "foto"`, `exercise: null`.
- [ ] La calculadora vuelve al Manual tab con la carga aplicada.

**Persistencia tras refresh**:
- [ ] Refresh la página.
- [ ] El mini-panel sigue mostrando Back Squat, Front Squat, y los auto-logs (los manuales etiquetados, no los auto-logs).
- [ ] El estado de la calculadora es el último que tenía (la carga del foto aplicado).

**Página de historial**:
- [ ] Click en `Ver historial completo →`.
- [ ] La página lista todos los registros: 2 manuales (Back Squat, Front Squat) + N auto-logs + 1 foto.
- [ ] Filtrar por "Auto-log". Sólo los auto-logs.
- [ ] Filtrar por "Manual". Sólo Back Squat y Front Squat.
- [ ] Buscar "squat". Ambos manuales matchean (case-insensitive).
- [ ] Sort por peso descendente. El más pesado primero.
- [ ] Click `Cargar` en Front Squat. La calculadora abre con la carga de Front Squat.
- [ ] Volver a la página de historial.
- [ ] Click `Copiar` en Back Squat. Pegar en otra app (notepad, terminal). Muestra el texto correcto.
- [ ] Click `Eliminar` en un auto-log. Confirm. Toast. La lista se reduce.

**Cap de auto-log** (opcional, hacer si hay tiempo):
- [ ] En devtools, hardcodear 200 auto-logs en `pd:calculator-records`. Reload.
- [ ] Hacer un cambio de barra (genera nuevo auto-log). La cuenta vuelve a 200. El más antiguo se fue. Los manuales y fotos siguen intactos.

**Empty state final**:
- [ ] `localStorage.clear()`. Reload.
- [ ] Calculadora: mini-panel empty state.
- [ ] Página de historial: empty state "Sin registros todavía".

### 2. Actualizar `CONTEXT.md`

Verificar que la documentación existente (preparada en este plan, antes de implementar) sigue siendo correcta. Si durante la implementación hubo cambios, reflejar aquí.

Secciones a verificar / ajustar:

- [ ] § **Modelo de Datos > SavedWeightRecord**: el shape descrito en este plan debe matchear el `src/lib/types.ts` final.
- [ ] § **Reglas del Negocio > Auto-log de la calculadora**: el `AUTO_LOG_DEBOUNCE_MS` documentado debe matchear el código.
- [ ] § **Reglas del Negocio > Guardar con etiqueta (manual)**: descripción del form inline debe ser exacta.
- [ ] § **Reglas del Negocio > Cargar un registro**: el `window.confirm` y el flujo de la página de historial deben estar documentados.
- [ ] § **Storage Schema**: las tres keys (`pd:sessions`, `pd:calculator-state`, `pd:calculator-records`) deben estar listadas.
- [ ] § **Rutas de la App**: `/tools/weight-calculator` (con el mini-panel) y `/tools/weight-calculator/history` deben estar en la tabla.
- [ ] § **Términos del Dominio**: `SavedWeightRecord`, `Auto-log`, `Guardar con etiqueta`, `Cargar (en historial)`, `Mini-panel de registros`, `Página de historial` deben estar en el glosario.
- [ ] § **Ver también**: el link a `docs/adr/0009-saved-weight-records.md` debe estar presente.

Si algún punto no matchea, ajustar `CONTEXT.md` en este PR. No es deseable dejar la doc desincronizada del código.

### 3. Actualizar `PRODUCT.md`

Ídem `CONTEXT.md`. Verificar que la documentación pre-implementación sigue siendo exacta.

- [ ] § **Domain model**: el shape de `SavedWeightRecord` documentado debe matchear el código.
- [ ] § **Surfaces**: la tabla de rutas debe incluir `/tools/weight-calculator` (con el mini-panel) y `/tools/weight-calculator/history`.
- [ ] § **Capabilities and Constraints**: la frase sobre "registrar cálculos de peso" debe estar presente.
- [ ] § **Open / deliberately undecided**: el item "Registry de movimientos tipado" debe seguir listado (no se implementó).
- [ ] § **Evidence on Hand**: los links a `docs/adr/0009-saved-weight-records.md` y `docs/agents/issues/0012-saved-weight-records.md` deben estar presentes.

### 4. Cerrar el umbrella 0012

Editar `docs/agents/issues/0012-saved-weight-records.md` y:

- Cambiar el frontmatter:
  ```yaml
  status: closed
  closed_at: YYYY-MM-DD
  ```
- Agregar al final una sección `## Resultado` con:
  - Resumen de 2-3 oraciones de qué se entregó.
  - Links a los 7 PRs / issues cerrados.
  - Lecciones aprendidas (si las hay).
  - Métricas: número de líneas agregadas, archivos creados, archivos modificados (`git diff --shortstat` desde el branch base).

### 5. Cerrar issues 0013-0019

Para cada uno:

- Cambiar el frontmatter a `status: closed` y `closed_at: YYYY-MM-DD`.
- Agregar al final una sección `## Resultado` con:
  - Qué se entregó en ese PR.
  - Hash del commit (opcional).
  - Decisiones durables que el PR agregó (si alguna no estaba ya en el issue).
  - Follow-ups pendientes que el PR descubrió (si los hay).

### 6. PR final de cierre

- PR description: link al umbrella 0012, lista de los 7 issues cerrados con links a sus PRs, screenshot/gif del flujo end-to-end.
- Asignar reviewer.
- Después de mergear, taggear un release (no como parte de este issue, pero dejarlo en el PR description como sugerencia).

## Aceptación

- [ ] El script de verificación end-to-end (sección 1) pasa 100%.
- [ ] `CONTEXT.md` y `PRODUCT.md` están sincronizados con el código merged.
- [ ] Los 8 issues (0012 + 0013-0019) están cerrados con sus post-mortems.
- [ ] PR final mergeado.
- [ ] No quedan TODOs en el código de la feature (los TODOs que queden deben ser follow-ups, no trabajo a medio terminar).
- [ ] `npm run build` y `npm run lint` siguen verdes.
- [ ] No quedan referencias rotas (e.g., a un archivo que se borró, a un componente que se renombró).

## Decisiones durables (a documentar en el cierre)

Después de la implementación, estas son las decisiones que se espera que el equipo documente formalmente en `CONTEXT.md` o como ADRs adicionales si surgen:

- El cap de 200 sobre auto-log. Si tras uso real el equipo decide cambiarlo, es un ADR aparte.
- El debounce de 1500ms. Idem.
- La normalización de ejercicio (trim + collapse, no lowercase). Idem.
- El form inline vs. modal/drawer. Esto ya está en ADR-0009, no necesita nuevo ADR.
- El comportamiento de `Cargar` desde la página de historial (escribe a draft antes de navegar). Si el equipo cambia esto, es un ADR.

Si surge una decisión nueva **durante** la implementación que no estaba en el plan, abrir un ADR en este PR (no en uno aparte) y referenciarla en el cierre del umbrella.

## Out of scope

- Nuevas features o fixes que no estaban en el plan. Esos van a issues nuevos.
- Refactor de código preexistente. Si urge, se hace en PRs paralelos.
- Documentación de usuario (e.g., un README en `/tools/weight-calculator`). El sistema no tiene user-facing docs en MVP.

## Follow-ups identificados durante la implementación

Si durante la verificación se descubre algo que amerita un issue aparte (no para fix inmediato, pero para track), listarlo en esta sección al cerrar el umbrella. Ejemplos esperados:

- Si el coach reporta fricción con el cap 200 → issue de tuning.
- Si el coach pide filtro por fecha → issue de feature.
- Si el coach pide export CSV/JSON → issue de feature.
- Si el equipo decide sumar tests automatizados → issue de infra de testing.
- Si la página de historial se vuelve lenta con muchos registros → issue de virtualización.

Cada follow-up se numera secuencialmente después de 0019 y se referencia desde el cierre del umbrella.
