# Surface Brief — `/generate/[modalityId]`

**Surface**: `/generate/crossfit` (y future `/generate/{modalityId}`)
**Mode**: Operate (formulario + resultado + mini-historial)
**Adjacent files**: `/classes`, `/api/generate`

## Audience, job, action, proof

- **Audience**: single Entrenador frente a la pantalla después de elegir CrossFit en el catálogo.
- **Job**: completar el formulario de sesión → generar → leer resultado → guardar/copiar/exportar.
- **Primary action**: **Generar** (signal) ejecuta la llamada al LLM y muestra el resultado.
- **Proof real**: sesión generada con 4 fases (Warm-Up, Strength/Skill, WOD, Cool Down) renderizadas en bloques.

## Layout (3 zonas verticales)

### Zona 1 — Status Strip
- Izquierda: nombre de la modalidad activa en display italic ("CROSSFIT").
- Derecha: píldora "GENERAR" (signal) mientras el form está vacío/invalido; cambia a estado activo mientras el LLM trabaja.

### Zona 2 — Formulario (cliente, hasta que se genera)
- Campos (CrossFit):
  - **Duración**: selector (45 / 60 / 75 / 90 min) — default 60.
  - **Strength / Skill**: textarea requerido. Placeholder: "描述 técnica o fuerza del día…"
  - **Formato WOD**: selector requerido (`AMRAP`, `EMOM`, `For Time`, `Tabata`, `Intervalos`). `Aleatorio` no se expone.
  - **Ejercicio principal** (opcional): textarea. Placeholder: "Movement principal del día…"
  - **Consideraciones** (opcional): textarea. Placeholder: "Notas o restricciones…"
- Validación inline: errores bajo cada campo en destructive.
- Botón "GENERAR" deshabilitado hasta que los campos requeridos estén llenos.

### Zona 3 — Resultado (aparece después de generar)

#### 3a. CrossFitPlanView (render de las 4 fases)
- `CrossFitPlanView` renderiza las 4 fases como bloques separados.
- Cada bloque: label de fase en display italic, duración en mono tabular, contenido en body Inter con `prose prose-invert`.
- Sin bordes redondeados — forma squarish papel.
- Hairline entre bloques.
- Modo edición: border-left `1px solid var(--signal)` como focus indicator (regla de tiza).

#### 3b. Acciones del resultado
- Fila de acciones debajo del resultado: **GUARDAR** · **REGENERAR** · **COPIAR** · **EXPORTAR .md**
- `Guardar`: siempre disponible cuando hay resultado. Persiste en `pd:sessions`.
- `Regenerar`: mismo input, reemplaza resultado activo. Pide confirmación si hay cambios sin guardar.
- `Copiar`: copia `markdown` al portapapeles.
- `Exportar .md`: descarga `{modalityId}-{YYYY-MM-DD}.md`.
- En desktop: acciones inline en una fila. En mobile: stack vertical.

#### 3c. Mini-historial
- Debajo de las acciones: lista de las últimas 5 sesiones guardadas.
- Cada item: título de sesión + fecha + duración en mono tabular.
- Click en item: future — por ahora no hace nada (placeholder para navegación a sesión guardada).

## States

- **Formulario vacío**: campos en estado idle, placeholder mute, GENERAR disabled.
- **Formulario inválido**: errores inline en destructive bajo cada campo requerido.
- **Generando**: status strip pasa a signal-fill, GENERAR cambia label a "GENERANDO…" y se deshabilita. No spinner animado en el botón — la status strip es el indicator.
- **Resultado exitoso**: zona 3 aparece con CrossFitPlanView y acciones.
- **Error**: toast con mensaje genérico. Formulario permanece accesible para reintentar.

## Components involved

- `status-strip` (signature) — signal-fill state durante generación
- `CrossFitPlanView` (signature) — render de 4 bloques para CrossFit; future `BodybuildPlanView`, etc.
- `chalk-card` (signature) — envuelve el resultado
- `button-primary` — GENERAR
- `button-ghost` — REGENERAR, COPIAR, EXPORTAR
- `textarea` — campos de formulario
- `select` — Duración y Formato WOD
- `badge` — mini-historial items
- `toast` — errores

## Animation

- Transición formulario → resultado: ninguno (reemplazo inmediato).
- Status strip idle → signal-fill: `200ms ease-out` (única transición coreografiada del sistema).
- Hover en acciones ghost: surface bump. Sin glow, sin scale.

## Open / undecided

- Navegación desde mini-historial item a sesión guardada — deferred.
- Modo edición del resultado (toggle markdown ↔ textarea): por ahora solo se guarda el resultado como se muestra.
- Streaming del LLM — out of scope.
