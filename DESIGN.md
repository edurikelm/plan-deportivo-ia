---
name: "Plan Deportivo IA"
description: "Dark-first, alto contraste, deportivo. Una pizarra de jugadas para que el Entrenador firme Ideas antes de bajar al gym."
colors:
  canvas: "oklch(0.13 0.005 270)"
  panel: "oklch(0.18 0.008 270)"
  bone: "oklch(0.96 0.005 80)"
  signal: "oklch(0.91 0.27 130)"
  signal-deep: "oklch(0.78 0.16 130)"
  mute: "oklch(0.62 0.005 80)"
  hairline: "oklch(1 0 0 / 10%)"
  hairline-strong: "oklch(1 0 0 / 18%)"
  destructive: "oklch(0.66 0.20 25)"
  popover: "oklch(0.20 0.008 270)"
typography:
  display:
    fontFamily: "Archivo Narrow, sans-serif"
    fontWeight: 600
    letterSpacing: "-0.015em"
    purpose: "Títulos de Idea, nombre de Clase en status strip, tab labels."
  body:
    fontFamily: "Inter, sans-serif"
    fontWeight: 400
    letterSpacing: "0"
    purpose: "Todo el resto."
  mono:
    fontFamily: "Geist Mono, monospace"
    fontFeature: "tabular-nums"
    purpose: "Numerales (tiempo, conteos), valores en el markdown renderizado, IDs visibles."
rounded:
  none: "0px"
  sm: "2px"
  md: "4px"
  lg: "8px"
  note: "Sistema squarish por defecto; chalk-card usa rounded-none (0px) explícitamente."
spacing:
  hairline: "1px"
  inset-card: "1.25rem"
  gap-section: "2rem"
  container: "48rem"
  note: "Sidebar ausente en MVP. Single-column con max-w-3xl y mobile-first. Espacio generoso por encima de un encabezado."
components:
  chalk-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.bone}"
    rounded: "{rounded.none}"
    padding: "{spacing.inset-card}"
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.md}"
    padding: "0.875rem 1.25rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.625rem"
  status-strip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.bone}"
    rounded: "{rounded.none}"
    padding: "0.75rem 1rem"
  badge-exercise:
    backgroundColor: "transparent"
    textColor: "{colors.mute}"
    rounded: "{rounded.sm}"
    padding: "0.125rem 0.5rem"
---

# Design System: Plan Deportivo IA

## Overview

**Creative North Star: "The Coach's Chalkboard."**

Plan Deportivo IA no le entrega al Entrenador una burbuja de chat ni una terminal oscura. Le entrega una **pizarra**: una superficie de tono papel-negro donde cada Idea es una hoja que el coach firma con un marcador de tiza antes de bajarla al gym. La identidad visual rechaza tres categorías de default: (a) el chat-asistente con badges "pensando…", (b) el dark-utility-console con tipografía mono y neon que pretende ser "deportivo" por cliché, (c) la papelería cream con serif editorial que un brief deportivo tampoco pidió.

La pantalla entera está construida con una sola restricción que el coach nunca pierde de vista: **un único color señal (verde césped a la frecuencia del marcado de cancha) aparece sólo donde algo le pide al coach que actúe o que confirme que algo está pasando.** El resto es jerarquía de luminosidad: matte canvas, panel apenas un punto más alto, tipografía hueso. Sin gradientes, sin glows, sin sombras blandas, sin esquinas blandas.

**Key Characteristics:**

- **Single-voice accent.** El verde señal está prohibido como decoración. Aparece en CTAs primarias, estados de focus, la tira de estado cuando el LLM está trabajando, y los numerales activos. Su rareza es el punto.
- **Hairline chrome.** Bordes de 1px en `oklch(1 0 0 / 10%)` separan panel de canvas, card de card. Cualquier "profundidad" se consigue con brillo de luminosidad, no con `box-shadow`.
- **Type as formation.** Display condensed italic (Archivo Narrow) lleva las hojas de Idea y los nombres de Clase; Inter carga la UI funcional; Geist Mono en tabular-nums carga todo lo que sea número (cargas, tiempo, conteos, IDs).
- **One orchestrated motion.** La única transición coreografiada en la superficie es la **tira de estado** en `/classes/[id]/generate`: pasiva → signal-fill cronómetro al apretar **Generar** → pasiva cuando aterriza el LLM. El resto se asienta.
- **Operate, not Persuade.** La energía del lenguaje visual es la de una herramienta de preparación: scanable, densa en datos, contenida en decoración.

## Colors

Una sola paleta en una sola página: matte canvas, panel apenas un escalón arriba, señal verde césped reservado para el elemento activo. Bone white para texto; mute para texto apagado; hairline para bordes y separadores. Destructive rojo se reserva para errores y la confirmación de borrado de una Clase. Sin colores secundarios ni terciarios — el brief lo prohíbe por estrategia de Operate.

### Primary

- **Turf Signal** (`oklch(0.91 0.27 130)` ≈ `#C7F23A`): la voz activa del sistema. Carga CTAs primarias (`Generar`, `Guardar cambios`), el relleno de la tira de estado cuando el LLM está trabajando, focus rings, y los numerales activos en listas de ejercicios. **Nunca aparece como fill de fondo decorativo ni como color de texto en estado pasivo.**

### Secondary

- **No secondary.** El sistema tiene una sola voz de color. El segundo registro lo da la luminosidad (`panel` un paso arriba de `canvas`), no una segunda familia cromática.

### Tertiary

- **No tertiary.** Mismo motivo que Secondary.

### Neutral

- **Matte Canvas** (`oklch(0.13 0.005 270)` ≈ `#0A0B0D`): fondo de toda la app. Ligeramente frío, casi negro pero no bit-perfect — permite que el texto hueso flote sin parecer un OLED puro.
- **Chalkboard Panel** (`oklch(0.18 0.008 270)` ≈ `#13151A`): fondo de la chalk card. Separado del canvas por una hairline de `10% blanco`, no por contraste dramático.
- **Bone White** (`oklch(0.96 0.005 80)` ≈ `#F5F4F0`): texto principal, títulos, placeholders en estado activo. Levemente cálido para no ser blanco-azul.
- **Mute** (`oklch(0.62 0.005 80)` ≈ `#9B9B97`): texto apagado (labels, metadatos secundarios, placeholders en estado pasivo). Siempre sobre canvas o panel.
- **Hairline** (`oklch(1 0 0 / 10%)`): borde universal de 1px. La "costura" del sistema.
- **Hairline Strong** (`oklch(1 0 0 / 18%)`): borde usado sólo cuando la hairline estándar no alcanza el contraste necesario para separar dos paneles en layouts densos.

### Semantic

- **Destructive Red** (`oklch(0.66 0.20 25)`): confirmación de borrado, errores no-recuperables. Texto sobre canvas, nunca fill.

### Named Rules

- **The Single-Voice Rule.** Sólo el verde señal está permitido ser saturado. Todo lo demás vive en la luminosidad. Si una superficie pide color para distinguir dos estados, usá mute vs. bone, no dos colores.
- **The Rarity Rule.** Signal no llena más del 8% de cualquier pantalla en estado pasivo. En estado activo (Generando), la tira de estado entera puede tomar el color — es la excepción que valida la regla.
- **The Hairline Rule.** Un borde no puede superar 1px. Si necesitás más separación, subí la luminosidad del fondo, no el grosor del trazo.

## Typography

**Display Font:** Archivo Narrow (con fallback sans). Cargada vía `next/font/google` con weights 500/600/700 y estilos normal/italic.

**Body Font:** Inter (con fallback sans). Variable, ya cargada.

**Label/Mono Font:** Geist Mono (con fallback monospace). Activada con `font-variant-numeric: tabular-nums` en todos los contextos donde aparecen numerales — tiempo, conteos, cargas, IDs visibles.

**Character:** El display condensed italic le da a las Ideas la "voz del número de camiseta": los títulos se inclinan, son angostos y legibles a tamaño grande. Inter sostiene la UI sin pelearse con el display — son de la misma familia tipográfica básica (sans geométrica humanista), sólo que Inter es la cara operativa y Archivo Narrow es la cara-de-hoja. Geist Mono interviene sólo cuando hay un número en juego; nunca como tipo de párrafo.

### Hierarchy

- **Display** (Archivo Narrow, 600/700, italic, `clamp(1.75rem, 4vw, 2.5rem)`, line-height 1.05): el título de cada Idea, el nombre de la Clase en la status strip.
- **Headline** (Archivo Narrow, 600, normal o italic, `1.25rem`, line-height 1.2): nombre de la Clase en cards de la lista, encabezados de chalk card cuando la hay.
- **Title** (Inter, 600, `1rem`, line-height 1.25): botones primarios en MAYÚSCULAS + tracking, labels de fieldset, textos de acción.
- **Body** (Inter, 400, `0.9375rem`, line-height 1.55): párrafos de ayuda, metadatos, contenido de markdown renderizado. Max-width 65-75ch cuando es prosa.
- **Label** (Inter, 500 uppercase, `0.6875rem`, letter-spacing `+0.08em`): etiquetas de campo, estados de la status strip (GENERAR · IDLE · ACTIVE). Tracking generoso pero no decorativo.
- **Mono** (Geist Mono, 400/500, `0.875rem`, tabular): cifras de carga, conteos de ejercicios, IDs visibles, el markdown crudo en vista de editor.

### Named Rules

- **The Type-Voice Rule.** El display italic sólo se usa en nombres propios (Idea, Clase). Nunca en UI labels ni en párrafos de ayuda.
- **The Tabular Rule.** Cualquier número visible al usuario (no sólo en datos) usa `font-variant-numeric: tabular-nums` para que las cifras no salten cuando cambian.
- **The Measure Rule.** Prosa limitada a 65–75ch. En la chalk card el contenido se permite correr hasta `max-w-prose`, pero los metadatos que flanquean el título viven en una sola línea compacta.

## Layout

Sin sidebar en el MVP. Una columna, mobile-first, con `max-w-3xl` (48rem) en desktop para que el ojo del coach no necesite girar la cabeza. Las cuatro rutas comparten un **status strip** fijo arriba — un header funcional, no decorativo — que lleva a la izquierda el nombre de la Clase activa y a la derecha la píldora de acción primaria (`Generar`, `Nueva Clase`, `Guardar`). La chalk card vive en un `chalk-card` container con padding generoso (`1.25rem`) y hairline-border.

### Responsive rhythm

- **Mobile (default)**: single-column, status strip edge-to-edge, padding `1rem` lateral.
- **md+**: `max-w-3xl` centrado, padding `1.5rem` lateral, status strip con mejor aire arriba y abajo.
- **No breakpoints de tipografía**. La escala es fija; los cambios de layout no se disfrazan de cambios de letra.

### Density

- **Operate-dense.** Cards de Clase en la lista muestran nombre + duración + conteo de ejercicios en una sola línea horizontal con metadatos en mono tabular. La chalk card admite lectura vertical (heading, bloques de markdown) con separadores hairline entre bloques.

### Named Rules

- **The Status Strip Rule.** La navegación primaria vive arriba, no a la izquierda. Si una superficie nueva pide rutas, siguen siendo strip o sheet — no reintroducir sidebar.
- **The Containment Rule.** Cualquier contenedor (card, sheet, modal) tiene hairline border y padding ≥ `1.25rem`. Ningún contenedor sin padding interior.

## Elevation & Depth

**No shadows. No glow. No gradients.** Profundidad se construye únicamente con luminosidad: el panel vive en `oklch(0.18)` contra un canvas en `oklch(0.13)`, y cuando algo pide más elevación (un popover, un overlay de carga) salta a `oklch(0.20)`. Los separadores son hairlines `1px`, no sombras.

### The Hairline Field

Una border `1px solid var(--border)` separa panel de canvas, card de card, item de item. No hay borde "decorativo" — cada uno divide algo. La excepción única: la **regla de tiza** en la chalk card durante edit mode, que es una border-left de `1px signal` y funciona como focus indicator (no como decoración). Cualquier borde de más de 1px está prohibido.

### Named Rules

- **The Flat-By-Default Rule.** Ningún componente lleva `box-shadow` por defecto. Los overlays de carga y los toasts usan opacidad alta sobre canvas, no blur ni glow.
- **The Lift-By-Color Rule.** Para distinguir jerarquía, cambiá la luminosidad del fondo (`bg-panel` → `bg-popover`), nunca agregues blur o sombra.

## Shapes

Sistema squarish: el radio por defecto es `0.25rem` (4px) heredado del `--radius` de shadcn, y los componentes chalk (chalk card, status strip, inputs) se fuerzan a `rounded-none` cuando la forma necesita ser decididamente cuadrada — papel, no botón.

### Rectangle language

- **Chalk card** (`0px`): sin radio. Es papel, no botón.
- **Botones primarios** (`4px`): apenas suavizados. Suficiente para que el dedo los encuentre, no tanto para que parezcan amables.
- **Inputs y textareas** (`2px`): sutiles, casi rectos.
- **Badges/chips de ejercicios** (`2px`): apenas levantado del fondo.
- **Status strip** (`0px`): la franja horizontal es deliberadamente cuadrada.
- **Toasts** (`4px`): igual que primarios — la jerarquía de radio sigue a la de CTA.

### Borders

- **Default hairline**: `1px solid oklch(1 0 0 / 10%)`.
- **Focus hairline**: `1px solid var(--signal)`.
- **Error hairline**: `1px solid var(--destructive)`.
- **Active rule (edit mode chalk card)**: border-left `1px solid var(--signal)` — el único borde coloreado del sistema, justificado como focus indicator.

### Named Rules

- **The Almost-Square Rule.** El radio por defecto nunca sube de `4px`. Si necesitás algo más redondo, decime por qué — la respuesta rara vez sobrevive el escrutinio.
- **The Square Paper Rule.** Las superficies que contienen Ideas (chalk card, editor de markdown, result render) son cuadrados vivos. Las que ejecutan acciones (botones, chips) son apenas suavizadas.

## Components

### Buttons

- **Shape:** `4px` radius, contenido `0.875rem 1.25rem`, h-default `2.5rem`.
- **Primary (signal)**: relleno verde señal, texto canvas. Hover: oscurece a `signal-deep`. Disabled: opacity-50 sin cambio de color.
- **Secondary (outline)**: sin fill, hairline border, texto bone. Hover: surface bump a `bg-secondary`.
- **Ghost (text-only)**: sin fill ni border visibles. Hover: surface bump a `bg-muted`. Es la elección para las acciones inline en la chalk card (`Copiar`, `Exportar`, `Regenerar`, `Editar`).
- **Destructive**: fill `bg-destructive/10`, texto destructive. Para confirmación de borrado de Clase.

### Chips (de ejercicios)

- **Style:** outline-only, hairline border, texto mute, `2px` radius.
- **Estado:** clickable si la superficie lo permite. Selected = `bg-signal text-signal-foreground`. Sin shadow, sin fill en estado pasivo.

### Cards / Containers

- **Chalk Card:** `rounded-none`, `1px` hairline border, `bg-panel`, padding `1.25rem`. Sin sombra. Tipografía: heading en display condensed italic, body en Inter con `prose prose-invert`.
- **Container plano (formularios)**: misma hairline chalk card. Inputs en columna con label uppercase tracking-plus.

### Inputs / Fields

- **Style:** stroke hairline border, sin radius (o `2px` si prefersub), `bg-transparent`, texto bone, placeholder mute.
- **Focus:** border pasa a `signal` con ring `signal/30`.
- **Error:** border destructive, anillo `destructive/20`. Mensaje de error debajo en destructive, texto `0.8125rem`.
- **Disabled:** opacity-50 sin cambio de cursor.

### Navigation

- **Status Strip** fija arriba, full-width, hairline-bottom. Lleva el nombre de la Clase actual (display) a la izquierda y la acción primaria (label uppercase + tracking) a la derecha. No hay navegación lateral.
- **Back** en cada status strip: botón ghost icon-only con ícono `ArrowLeft`.

### Status Strip (signature component)

El componente que define el sistema. Estado pasivo: `bg-canvas`, hairline-bottom sutil. Estado activo (Generando): relleno `bg-signal`, texto `text-canvas`, y un cronómetro tabular monospace que tica desde el momento del submit. Cuando la Idea aterriza, vuelve a pasivo con una transición `200ms ease-out` (la única transición orquestada del sistema). Lleva en su esquina derecha un indicador de ID de la Idea cuando ya está generada (`ID 12AB · 3 EJERCICIOS`).

### Chalk Card (signature component)

El contenedor genérico del resultado para modalidades sin render dedicado. Misma hairline en toda su frontera, sin sombras ni radius, fondo `bg-panel`. El título en display condensed italic; los valores numéricos del markdown se renderizan en Geist Mono tabular. Cuando entra en edit mode, una `border-left: 1px solid var(--signal)` aparece en el contenedor completo — la "regla de tiza" como focus indicator.

### CrossFitPlanView (modalidad CrossFit)

Para la modalidad CrossFit, el resultado se renderiza con `CrossFitPlanView` en lugar del chalk-card fluido genérico. El componente muestra exactamente 4 bloques (Warm-Up, Strength/Skill, WOD, Cool Down), cada uno con label en display italic, duración en Geist Mono tabular, y contenido en Inter con `prose prose-invert`. Hairline entre bloques. El modo edición aplica la regla de tiza (border-left signal) sobre el bloque activo. Agregar futuras modalidades requiere solo un nuevo componente de render (BodybuildPlanView, GymnasticsPlanView, etc.) sin cambios en el layout circundante.

### Toasts

- Top-right per Sonner default. Color tints via custom styles: success = bone sobre signal, error = bone sobre destructive, info = bone sobre panel. Sin glow. Texto uppercase tracking-plus en el título si lo tiene.

## Do's and Don'ts

Concreto, fundamentado en la dirección comprometida o en una regla confirmada del brief. No son preferencias — son invariantes hasta que la siguiente revisión los cambie con motivo.

### Do

- **Do** usa `bg-signal` sólo para CTAs primarias, focus rings, y la status strip en estado activo. Nunca como fill decorativo.
- **Do** escribe todos los numerales visibles en Geist Mono o Inter con `tabular-nums`. Un conteo que cambia no debe hacer saltar la composición.
- **Do** usá el status strip como navegación primaria. La píldora a la derecha es la acción que la pantalla está esperando.
- **Do** mantene la chalk card cuadrada (`rounded-none`); los botones y chips ya cargan el radio.
- **Do** tratá cada Sesión como una hoja firmada. El resultado (chalk card o CrossFitPlanView) es la hoja; las acciones inline (Guardar, Copiar, Exportar, Regenerar) son anotaciones al pie, no una toolbar encima.

### Don't

- **Don't** agregues `box-shadow`, `backdrop-filter`, glow, ni gradientes a ningún componente. Si necesitás jerarquía, cambiá la luminosidad del fondo.
- **Don't** introduzcas una segunda familia de color saturado. Bone, mute, hairline, destructive y signal. Esas cinco son la paleta entera.
- **Don't** renderices la respuesta del LLM como chat bubble. La Idea va en una chalk card, leyéndose como una hoja, no como una conversación.
- **Don't** uses un radius mayor a `4px` en ningún componente del MVP. Si creés que la superficie lo necesita, el motivo tiene que sobrevivir el escrutinio.
- **Don't** uses Icon-only buttons como acciones principales. Una acción primaria con label uppercase + tracking siempre se ve más cercana al "volante de controles" que el sistema pide; las icon-only son para el back, en la status strip.
- **Don't** mantengas el icono de `Loader2` rotando mientras Generar espera. La motion coreografiada es la status strip — el botón primario cambia de label y se desactiva, no rota un spinner.
- **Don't** inventes un sidebar o un patrón de navegación lateral. El sistema es vertical-stack + status strip por diseño.
