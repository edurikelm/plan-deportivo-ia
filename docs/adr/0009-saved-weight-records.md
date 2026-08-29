# Saved Weight Records — Calculadora con Historial y Guardado Etiquetado

La Calculadora de Pesos pasa de ser un utility puramente efímero (auto-save del estado actual) a un utility con historial durable: cada cálculo puede **registrarse** con un nombre de ejercicio obligatorio, y la lista de registros vive en `localStorage` y se ofrece tanto como resumen dentro de la calculadora como en una ruta dedicada.

**Status**: propuesta — pendiente de aceptación por el equipo.

## Contexto

ADR-0007 ("Weight Calculator as `/tools` Surface") delimitó la calculadora como un utility manual, no una modalidad. Decisión explícita que sigue vigente: la calculadora **no** se convierte en una modalidad de IA. Lo que ADR-0007 sí dejó como **out of scope** — y este ADR viene a reconsiderar — es la frase:

> "Calculator as a saved entity (no `pd:calculator-saved` history)."

El Entrenador que usa la calculadora está en medio de una sesión real de entrenamiento: anota la barra que acaba de cargar, mira la foto, y se mueve al siguiente ejercicio. Sin historial, sólo le queda el portapapeles (`Copiar`) — un round-trip de pegar-en-otro-lado que rompe el flujo.

La necesidad concreta:

- **Recurrencia**: el mismo atleta repite la misma carga semana a semana. Necesita volver a un cálculo anterior sin tener que volver a tipear la barra + discos.
- **Trazabilidad**: el coach quiere saber qué cálculo corresponde a qué ejercicio ("Back Squat 80kg" vs "Press militar 30kg"), no sólo el desglose numérico.
- **Continuidad foto→historial**: el flujo actual del Foto tab (subir → revisar → aplicar al estado actual) es útil pero no durable; el desglose se pierde cuando se cierra la pestaña.

## Decisión

### Modelo: dos modos de captura coexistiendo

La calculadora persiste registros en dos modos, ambos en el mismo storage `pd:calculator-records`:

1. **Auto-log** (pasivo). Cada vez que el estado de la calculadora llega a un "punto estable" — barra y discos definidos, no en medio de un análisis de Foto — y el desglose es distinto del último auto-log, se persiste un `SavedWeightRecord` con `source: "auto-log"`, `exercise: null` y los totales calculados. La intención es reconstruir la sesión al final del día aunque el coach nunca haya apretado un botón.
2. **Guardar con etiqueta** (explícito). Un botón prominente en el footer de la calculadora abre un pequeño form inline (no modal pesado) que pide el **nombre del ejercicio** (obligatorio) y crea un `SavedWeightRecord` con `source: "manual" | "foto"`, `exercise` poblado, y los totales.

Ambos modos producen el mismo `SavedWeightRecord`. La diferencia es semántica: el auto-log es telemetría, el guardado explícito es la unidad con nombre que el coach consultará después.

### Modelo de datos

```ts
type RecordSource = "auto-log" | "manual" | "foto";

interface SavedWeightRecord {
  id: string;                 // crypto.randomUUID()
  createdAt: string;          // ISO
  exercise: string | null;    // null solo en auto-log; obligatorio en manual/foto
  barKg: number;              // siempre kg, snapshot
  discs: DiscRow[];           // snapshot, no referencia viva
  totalKg: number;            // calculado al persistir
  totalLb: number;            // calculado al persistir
  breakdownLine: string;      // pre-formateado vía formatBreakdownLine
  source: RecordSource;
}
```

`discs` es un **snapshot** de filas `DiscRow` (no referencia viva al estado actual de la calculadora). Si después el coach edita la carga actual, los registros viejos mantienen su desglose original.

### Storage

- Nueva key: `pd:calculator-records` (sigue el namespace `pd:*` del proyecto).
- Array de `SavedWeightRecord[]`, sin paginación en storage.
- Cap de auto-log: **200 registros**. Cuando se llega al cap, el más antiguo se descarta. Los registros manuales/foto **no** se descartan nunca (son la fuente de verdad del coach).
- Migración: ninguna. La key es nueva; ausencia = array vacío.
- Validación: al leer, se filtra con Zod (`SavedWeightRecordSchema`) por si una versión futura cambia el shape. Registros corruptos se descartan silenciosamente y se loguean en consola (mismo patrón que `getCalculatorState` actual).

### Helpers de storage

Siguen el patrón existente de `lib/storage.ts` para `SavedSession`:

- `getRecords(): SavedWeightRecord[]`
- `addRecord(r: SavedWeightRecord): void`
- `updateRecord(r: SavedWeightRecord): void` (reservado para futuro; el MVP no expone edición)
- `removeRecord(id: string): void`
- `getRecentRecords(limit = 5): SavedWeightRecord[]` — usado por el mini-panel, sólo registros **etiquetados** (`exercise !== null`)
- `getUniqueExercises(): string[]` — para el autocomplete del form de Guardar, dedupe case-insensitive preservando capitalización de la primera aparición

### Auto-log: comportamiento

- **Trigger**: debounce de **1500ms** desde el último cambio de barra o discos. Más largo que el debounce actual del draft (250ms) para que un "pase por la pantalla" no genere N registros.
- **Skip si**: `discs.length === 0` (estado vacío), o si el desglose es **idéntico al último auto-log** (hash `barKg + JSON.stringify(discs)`).
- **Pausa durante análisis Foto**: el timer se suspende mientras `fotoState.kind === "analyzing"` y se reanuda al volver a idle.
- **Foto aplicado**: cuando el usuario acepta el desglose del Foto tab, se persiste un registro con `source: "foto"` y `exercise: null`. Si el usuario lo Guarda con etiqueta después, se crea un **segundo** registro (manual con etiqueta) en lugar de promover el auto-log — más simple, y los IDs siguen siendo únicos.

### UX: dónde vive

Coincide con la decisión de "ambos" del usuario: resumen en la calculadora + ruta completa.

- **Mini-panel en `/tools/weight-calculator`**: debajo del bar visualization, sección nueva `REGISTROS` con las últimas 5 `SavedWeightRecord` **etiquetadas** (no auto-log; la rareza del verde señal se preserva). Cada fila: nombre de ejercicio en display italic, totales en mono tabular, fecha relativa ("hace 2h", "ayer"), botón ghost `Cargar` que reescribe el estado de la calculadora con ese registro. Footer de la sección: link `Ver historial completo →` a `/tools/weight-calculator/history`. Empty state: `"Todavía no guardaste cargas con nombre."`.
- **Página completa `/tools/weight-calculator/history`**: server shell + client list, todos los registros (etiquetados + auto-log), filtros por source y búsqueda por nombre de ejercicio, sort por fecha (default desc) / ejercicio / peso total, acciones por fila: `Cargar`, `Copiar`, `Eliminar` (con `window.confirm`).

### Botón Guardar con etiqueta

- Vive en el **footer sticky** junto a `Copiar` (a la izquierda de él, como acción primaria).
- Click → expande un **form inline** dentro del footer (no modal, no drawer): input de texto con label `Ejercicio` (placeholder `"Ej. Back Squat"`), autocomplete datalist con `getUniqueExercises()`, botones `Guardar` y `Cancelar`. El form ocupa el ancho del footer, no más.
- Validación: `exercise.trim().length > 0`. Submit deshabilitado mientras vacío.
- On submit: persiste el `SavedWeightRecord`, toast success, cierra el form, mini-panel se actualiza vía storage event.
- El footer sticky ya tiene altura generosa; el form inline lo expande sólo mientras está abierto (no rompe la sticky-position).

### Recargar un registro en la calculadora

Acción `Cargar` desde el mini-panel o desde la página de historial: reemplaza `barKg` y `discs` con el snapshot del registro. El draft actual (`pd:calculator-state`) se sobrescribe; el usuario que estaba editando algo distinto y no había guardado **lo pierde** — el botón pide `window.confirm` si el draft actual difiere del registro a cargar.

## Consecuencias

- Una nueva key `pd:calculator-records` se suma a `pd:sessions` y `pd:calculator-state`. Sigue el namespace `pd:*`; ningún cambio al sistema de storage.
- `src/lib/calculator/` gana un módulo `history.ts` con helpers puros (totales, hash de dedupe, formato, dedupe de ejercicios). Testable en aislamiento.
- La calculadora deja de ser puramente efímera. La consecuencia filosófica: **el utility gana una noción de tiempo** (registros ordenados por `createdAt`) que el manual tab y el Foto tab no tenían.
- El modelo de "ejercicio" es **string libre**, no un registro de movimientos. Esto preserva flexibilidad y no bloquea trabajo futuro (ver Considerados), pero significa que "Back Squat" y "Back squat" y "back squat" son tres entradas distintas en el autocomplete (normalización lowercase sólo para el datalist; los registros guardan la capitalización que tipeó el coach).
- `pd:calculator-state` (auto-save del draft) sigue existiendo. **Dos nociones de persistencia coexisten**: el draft es "lo que estoy editando ahora mismo", los records son "lo que ya pasó y le di nombre".
- El auto-log puede acumular ruido (un Entrenador que abre la calculadora, no escribe nada, y la cierra igual registra un auto-log con `barKg = 20, discs = []`). El dedupe por hash lo evita en la mayoría de los casos, y el cap de 200 + descarte del más antiguo es la red de seguridad.
- ADR-0007 sigue vigente: la calculadora no es una modalidad. Este ADR **no la convierte** en una; le agrega una capa de historial encima del utility manual. La regla "tools no son modalities" no se toca.
- ADR-0005 (content-sidebar exception) **no se aplica** aquí. La calculadora mantiene single-column estricto (`max-w-2xl` actual); el mini-panel de registros vive **debajo** del bar visualization, no como sidebar. Mantiene consistencia con el resto de `/tools/*` futuro y respeta la regla "no sidebar" del design system.

## Alternativas consideradas

- **Sólo auto-log (sin etiqueta)**. La calculadora sería un logger pasivo, pero el coach no podría distinguir "Back Squat 80" de "Press militar 30" mirando el historial. Se descartó porque el problema concreto que el coach reporta es la trazabilidad por ejercicio.
- **Sólo Guardar con etiqueta (sin auto-log)**. Más limpio y más simple, pero pierde la captura pasiva. Si el coach olvida Guardar, la sesión del día se pierde. Se descartó porque el caso "registré 12 cargas hoy y sólo me acuerdo de 3" es real y frecuente en el flujo del gym.
- **Ejercicio como objeto tipado (`{ id, label, category, ... }`)**. Crea un registry de movimientos. Potencialmente más rico, pero: (a) ningún flujo actual lo pide, (b) fuerza una decisión de taxonomía que el coach aún no hizo, (c) es trabajo para un ADR separado con su propio brief. Se descartó para MVP. **Marcado como work futuro** en el roadmap de tools.
- **Sidebar en `/tools/weight-calculator` con los registros**. Rompe ADR-0005 (que sólo aplica a `/generate/[modalityId]`) y la regla "no sidebar" del design system. Se descartó para mantener consistencia con la excepción documentada.
- **Modal/drawer para el form de Guardar**. Más overhead visual. El footer ya tiene altura para un form inline; un modal sería más peso del que el caso pide. Se descartó en favor del form inline.
- **Reutilizar `pd:sessions` con un `kind: "weight-record"`**. Tentador para reusar la mini-historia de CrossFit, pero mezcla dos dominios: las sesiones de CrossFit son output de IA con markdown estructurado, los registros de peso son snapshots numéricos. El storage compartido complica migraciones y queries. Se descartó.

## Out of scope (explícito)

- **Edición de un registro guardado** (`updateRecord` queda exportado en storage pero no usado en UI). Borrar + crear es suficiente para MVP.
- **Adjuntar foto al registro**. La foto es del momento del cálculo; el storage de data-URLs inflaría `localStorage` rápido. Si el coach la quiere, la vuelve a tomar.
- **Gráficas o trends por ejercicio** ("progresión de Back Squat en el tiempo"). Eso es un tool distinto (`/tools/progression`) que vive en el roadmap de tools pero no en este plan.
- **Cross-references con `SavedSession` de CrossFit** (que un WOD generado pueda enlazar a un registro de peso). Sería un feature de modalidades futuras. Se descarta aquí para no atar el diseño de peso a la IA.
- **Export masivo (CSV / JSON) de registros**. Reservado para cuando la historia crezca y el coach sienta la necesidad.
- **Sincronización entre dispositivos**. Sigue siendo local-first por ADR-0001.
- **Registry de movimientos** (modelo tipado de ejercicio). Marcado como work futuro; este plan lo deja como string libre intencionalmente.
- **Editar manualmente los totales**. Los totales son derivados del desglose; se recalculan al persistir y no se exponen a edición.

## Migration & rollout

- No se necesita migración de `pd:sessions` ni de `pd:calculator-state`.
- La key `pd:calculator-records` arranca vacía. Coaches que usaron la calculadora antes no pierden nada: su draft (`pd:calculator-state`) sigue intacto.
- Rollout: feature flag no es necesario (es una key nueva, no hay conflicto de lectura). Si un registro existente se corrompe (no debería, porque la key es nueva), el helper lo descarta silenciosamente.
- Si el equipo decide después revertir la feature: borrar la key `pd:calculator-records` no afecta a `pd:calculator-state` ni a `pd:sessions`. La reversibilidad es local y limpia.
