# Vista de Análisis de Ejercicio con Entry desde el Catálogo

La calculadora de pesos gana una vista de análisis por ejercicio (gráficos de progresión, tabla de Prilepin, historial del ejercicio). El acceso a esa vista se hace desde una nueva card en el catálogo `/classes` (sección `HERRAMIENTAS`), que apunta a la ruta `/tools/weight-calculator/history` refactorizada para listar ejercicios únicos en lugar de la lista plana de registros.

**Status**: propuesta — pendiente de aceptación por el equipo.

## Contexto

ADR-0007 (`weight-calculator-as-tools-surface`) estableció la calculadora como un utility manual bajo `/tools`, no como una modalidad de IA. ADR-0009 (`saved-weight-records`) le agregó historial durable (`pd:calculator-records`) y la página `/tools/weight-calculator/history` con búsqueda, filtros por `source`, y sort.

El grill R1-Q2 / R2-Q5 / R4-Q13 cerró que la nueva vista de análisis debe entrar al usuario por una **card de catálogo**, no por la lista plana de registros. Tres razones:

1. **El catálogo ya es la "puerta" del sistema**. `/classes` lista modalidades y herramientas; la calculadora ya vive ahí. La nueva vista es *otra* herramienta del mismo sistema, no un sub-producto de la calculadora.
2. **La lista plana de registros se vuelve ruido cuando hay drill-down**. Con la vista de análisis por ejercicio, ver "todos los 143 registros" sin agrupar pierde valor: el coach no piensa en registros, piensa en ejercicios. La ruta `/history` pasa de "lista de registros" a "lista de ejercicios".
3. **El catálogo crece con la app**. La estructura de `/classes` ya es extensible (sección `MODALIDADES DEL SISTEMA` + `HERRAMIENTAS`). Sumar una card nueva en `HERRAMIENTAS` es consistente con el patrón existente.

## Decisión

### Entry point: card nueva en `/classes`

`/classes/page.tsx` suma una segunda card en la sección `HERRAMIENTAS` (debajo de `Calculadora de Pesos`):

```
┌─────────────────────────────────────────┐
│ HERRAMIENTAS                            │
│                                         │
│ Calculadora de Pesos                    │
│ Calculá el peso total de una sesión…    │
│ [Abrir calculadora →]                   │
│                                         │
│ Ejercicios guardados                    │  ← NUEVA
│ Visualizá progresión, 1RM estimado      │
│ y tabla de RM por ejercicio.            │
│ [Ver ejercicios →]                      │
└─────────────────────────────────────────┘
```

La card apunta a `/tools/weight-calculator/history` (refactorizado).

### `/history` refactorizado: lista de ejercicios

`/tools/weight-calculator/history` deja de ser la lista plana de `SavedWeightRecord`. Pasa a ser una **lista de ejercicios únicos** derivados de los registros, ordenados por último uso (`max(createdAt)` desc). Cada fila:

| Campo | Fuente |
|---|---|
| Nombre del ejercicio | `exercise` (case-insensitive dedupe, preserva la capitalización del primer match) |
| Cantidad de registros | `count(records where exercise matchea)` |
| Último registro | `max(createdAt)`, `totalKg` correspondiente |
| Mejor registro | `max(totalKg where reps === 1)` si existe; sino `aggregateExerciseOneRepMax` (ADR-0010) |

Click en una fila → `/tools/weight-calculator/exercise/[name]` (vista de análisis).

La lista plana de registros (búsqueda, filtros por `source`, sort por fecha) **se elimina** de esta ruta. Las acciones que la necesitaban (`Cargar` un registro específico, eliminar un registro viejo) sobreviven en:

- **Mini-panel de la calculadora** (5 últimos registros etiquetados, ya existe).
- **Vista de análisis del ejercicio** (lista del ejercicio específico con `Cargar` + `Eliminar` por fila, issue 0038).

### Vista de análisis: ruta nueva `/tools/weight-calculator/exercise/[name]`

Nueva ruta que muestra, dado un `exercise` específico:

1. **3 charts** (Recharts): progresión de `totalKg` en el tiempo, volumen (`totalKg × reps`) por sesión, e1RM rolling (ventana de 3 últimos registros).
2. **Tabla de Prilepin** (1-12 reps × % de 1RM, sticky sidebar en desktop).
3. **Lista del ejercicio**: todos los registros del ejercicio ordenados por `createdAt` desc, con `Cargar`, `Eliminar`, y toggle `Marcar 1RM` por fila.

El segmento `[name]` codifica el nombre del ejercicio. La búsqueda de registros es **case-insensitive** pero la capitalización del primer match se preserva para el título y el breadcrumb.

Composición de la página: header con nombre + summary (count, 1RM estimado, último registro) + grid 3-col de charts en desktop (stack vertical en mobile) + tabla Prilepin (sticky sidebar 18rem en desktop, stack en mobile) + lista del ejercicio full-width abajo.

### Patrones reutilizados

- **Mini-historial del `/generate` (ADR-0005)**: el patrón "main column + sidebar sticky con historial" se reusa en la vista de análisis, pero invertido: el sidebar lleva la **tabla Prilepin** (que es la respuesta inmediata del coach) y el main column lleva los **charts** (que requieren más lectura).
- **External store subscription** (`useSyncExternalStore` sobre `pd:calculator-records`): el patrón ya vive en `history-page-client.tsx` y `saved-records-panel.tsx`. La nueva vista de análisis lo reusa para reaccionar a cambios cross-tab.
- **Storage parser con Zod**: el `SavedWeightRecordSchema` extendido (ADR-0010) se parsea una vez en el root de la vista de análisis, y los records se filtran/agrupan por ejercicio en memoria.

## Consecuencias

- Nueva ruta `/tools/weight-calculator/exercise/[name]/page.tsx` + `_components/analysis-page-client.tsx`. Estructura simétrica a la de `/tools/weight-calculator/history`.
- `/tools/weight-calculator/history/_components/history-page-client.tsx` se reescribe para mostrar la lista de ejercicios. La lista plana (búsqueda/filtros/sort) **se elimina** de esta ruta.
- `/classes/page.tsx` suma una card adicional. No se introduce un registry nuevo; la card es un `<li>` literal como la calculadora, no un objeto en `MODALITIES` ni en un array de "tools" (las tools no son modalidades, no se reutiliza el registry — mismo principio que ADR-0007).
- La acción `Cargar` un registro específico se traslada a la vista de análisis (lista del ejercicio) y al mini-panel. El coach que quería buscar "el Press de banca del 3 de marzo" lo hace desde la vista de análisis del Press de banca, no desde una lista global.
- La acción `Eliminar` un registro: igual, vive en la vista de análisis por ejercicio. Si en algún momento se echa de menos la lista plana, se reincorpora en una iteración posterior (ver Out of scope).
- ADR-0005 (content-sidebar exception) **se reusa** en la vista de análisis: la tabla Prilepin en sidebar 18rem sticky es exactamente la excepción documentada. ADR-0005 ya cubre el rationale responsive.
- ADR-0009 (saved weight records) sigue vigente: el modelo de `SavedWeightRecord` no cambia (sólo se extiende via ADR-0010). Este ADR reorganiza **cómo se navega** a los registros, no el modelo.
- ADR-0007 (calculator as tools surface) sigue vigente: la calculadora no es una modalidad. La nueva vista de análisis es otra tool, no convierte a la calculadora en una modalidad. La regla "tools no son modalities" no se toca.
- La navegación del catálogo queda: `/classes` → 2 cards en `HERRAMIENTAS` (Calculadora + Ejercicios guardados) + N cards en `MODALIDADES DEL SISTEMA` (CrossFit por ahora). Si en el futuro se suman más tools, el patrón se repite.
- La URL `/tools/weight-calculator/history` cambia de significado. **Bookmarkeable**: si el coach tenía un bookmark a la lista plana, ahora aterriza en la lista de ejercicios. No es un redirect porque la ruta existe; sólo cambia el contenido. Si en algún momento se quiere preservar el acceso a la vista plana, se puede agregar `/tools/weight-calculator/records` (ver Out of scope).
- Dependencia nueva: `recharts` (~100KB gz). Se suma a `package.json` y al bundle del cliente. La vista de análisis es client-only (igual que el resto de la calculadora), así que el impacto en SSR es cero.

## Alternativas consideradas

- **Entry point: click en el nombre del ejercicio en cada fila de la lista plana de `/history`** (grill R2 Q5 opcion A original). Se descartó porque requiere pasar por la calculadora o el historial para llegar al análisis. El catálogo es la "puerta" del sistema; la vista de análisis es una tool más del catálogo.
- **Entry point: drawer lateral desde `/history`** (grill R1 Q2 opcion B). Se descartó porque pierde deep-linking y mete scroll lock. La card del catálogo es más limpia.
- **Entry point: tab `Análisis` en la calculadora** (grill R2 Q5 opcion D). Se descartó porque la calculadora es el *editor* de cargas, no el *visor*. Mezclar editor y visor en la misma ruta confunde.
- **Mantener la lista plana como vista alternativa toggleable** (grill R4 Q13 opcion C). Se descartó porque suma UI sin pedirlo el problema. La vista de análisis + mini-panel cubren el caso "ver mis registros".
- **Doble ruta: `/history` para ejercicios, `/history/records` para lista plana** (grill R4 Q13 opcion B). Considerado. Se descartó porque preserva una vista que pierde valor con la nueva estructura. Si alguien la extraña, se agrega en su propio issue.
- **Vista de análisis con sidebar de historial (estilo `/generate`)** (grill R2 Q7 opcion A). Se descartó porque la tabla Prilepin es la respuesta inmediata del coach, y meterla en sidebar sticky maximiza su visibilidad. La lista del ejercicio (más larga) va full-width abajo.
- **Charting custom SVG en lugar de Recharts** (grill R1 Q3 opcion D). Se descartó por costo/tiempo. Recharts cubre LineChart, BarChart, ResponsiveContainer, y permite override de styling via className para el look chalk. Si en algún momento se necesita algo que Recharts no banque (e.g. animaciones coreografiadas con el design system), `visx` es un upgrade natural.

## Out of scope (explícito)

- **Lista plana de registros preservada** en `/tools/weight-calculator/records` o como toggle. Si el coach la extraña, se agrega en un issue separado.
- **Vista de análisis global (todos los ejercicios en una sola página)**: el grill R2 Q1 opcion C lo propuso. Queda como work futuro si el coach quiere comparar ejercicios lado a lado.
- **Comparación entre ejercicios (gráfico agregado de 1RM por ejercicio)**: work futuro, no se pide en v1.
- **Búsqueda global de registros por fecha/peso**: la lista plana lo tenía. La vista de análisis por ejercicio lo reemplaza parcialmente (el coach busca por ejercicio, no por fecha). Si hace falta búsqueda global, se agrega en un issue separado.
- **Foto tab integración con el análisis**: ADR-0009 registraba foto como `source: "foto"`, `exercise: null`. El Foto tab está desactivado (issue 0039). Si se reactiva Foto, los registros foto siguen excluidos del análisis (sin `exercise` no se agrupan).
- **Export de la vista de análisis** (PNG/MD): grill R4 Q15 decidió no exportar en v1. Queda como work futuro.
- **Notificaciones cuando un ejercicio supera un 1RM anterior**: work futuro, requiere definir el threshold.

## Migration & rollout

- No se necesita migración de storage. Los registros existentes se reagrupan in-memory al primer read de la nueva vista.
- `/tools/weight-calculator/history` cambia de contenido, no de URL. Bookmarks viejos siguen funcionando (abren la nueva lista de ejercicios). Si el coach tenía un flujo de "abrir history y scrollear", se rompe — pero el flujo equivalente es "abrir history, click en el ejercicio, scrollear dentro del ejercicio", que es estrictamente más rico.
- Rollback: si el drill-down por ejercicio resulta ser muy friccionado, restaurar la lista plana es restaurar la versión vieja de `history-page-client.tsx` (git revert). Cero migración de storage.
- La card de catálogo es aditiva. Si se quiere sacar (por ejemplo, si el coach decide que quiere la lista plana), se borra el `<li>` correspondiente. Sin impacto en el resto del catálogo.
