# Surface Brief — `/classes`

**Surface**: `/classes` (`src/app/classes/page.tsx` + `src/app/classes/_components/classes-list-client.tsx`)
**Mode**: Operate (catálogo + navegación a generación)
**Adjacent files**: `/generate/[modalityId]`

## Audience, job, action, proof

- **Audience**: single Entrenador opening the app to pick a modality and generate a session.
- **Job**: choose a modality to generate a session.
- **Primary action**: on modality cards, **Generar** (signal) navigates to `/generate/{modalityId}`.
- **Proof real**: nombre de la modalidad, descripción corta, color de acento. Sin ejercicios, sin duración fija.
- **Constraints**: sin DB, sin auth. Single-browser. Modalidades fijas del sistema, no creadas por el usuario.

## States & ranges

- **1–N Modalidades**: stack vertical con hairline entre cards. Cada card es `chalk-card` (no rounded), nombre en display italic, descripción a continuación, color accent en un borde lateral sutil. Botón "Generar" alineado abajo a la derecha.
- **Loading**: no aplica (modalidades vienen del código, no de storage).
- **Empty**: imposible en la práctica (CrossFit siempre presente como mínimo).

## Interaction & layout

- **Top**: status strip con label "MODALIDADES" a la izquierda (display italic) y sin CTA derecha en esta pantalla.
- **Body**: container `max-w-3xl mx-auto px-5 md:px-8`. Grid de cards de modalidad.
- **Card**: layout vertical con título + descripción + borde accent lateral. Acciones "GENERAR →" abajo a la derecha en ghost o text-only. Hover: hairline pasa de 10% a 18%. Sin sombras.
- **No sidebar.** Status strip es la navegación.

## Components involved

- `status-strip` (signature)
- `chalk-card` (signature) con borde accent por modalidad
- `button-primary` (para "Generar")
- `button-ghost` (para acciones secundarias)
- Sin icon-only buttons como acciones principales — texto uppercase + tracking

## Animation

- Hover: solo cambio de hairline border y surface bumps. Sin scale, sin translate, sin glow.

## Open / undecided

- Sin soporte para reorder o drag.
- Sin filtros ni búsqueda.

## Resolución previa

- **Estilo aplicado**: respetar TYPE-VOICE RULE (Archivo Narrow italic para nombres de modalidad), SQUARE PAPER RULE (cards cuadradas), SINGLE-VOICE RULE (signal solo en CTA "Generar").
- **Sin neon glow**, sin glass, sin tracker eyebrows, sin section numbers.
