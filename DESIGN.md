# Design — Argument Dependency Closure Ledger

A locked presentation direction for the public single-page application. It constrains the Claude redesign without changing product behavior or frontend infrastructure.

## Genre

Modern-minimal institutional workbench.

## Macrostructure

- Application page: Workbench with an asymmetric active-case canvas.
- Embedded public documentation: Long-document rhythm inside the same page.
- Navigation: compact task-oriented anchors; no route fiction.

## Theme

- Near-black green paper with quiet layered surfaces.
- Warm off-white ink and muted sage secondary text.
- One mint/verdigris signal color reserved for current, selected, or verified states.
- Amber for reconciliation and red only for terminal failure.
- All final colors must be declared as named OKLCH tokens and consumed through variables.

## Typography

- Display: system serif stack, upright, high contrast, used sparingly for identity and major outcomes.
- Body: system sans-serif stack for controls and explanation.
- Mono: system monospace only for hashes, IDs, revisions, and JSON.
- Long product name must wrap safely at 320px; headings never use italic styling.

## Spacing and shape

- Named 4px-derived spacing tokens.
- Hairline rules and deliberate negative space carry section boundaries.
- Small-to-medium radii; avoid a page made entirely of floating rounded cards.
- Controls remain single-line where possible and expose a visible focus ring.

## Motion

- No ornamental entrance animation.
- Real pending transactions may use a rotating circular indicator plus text.
- Hover/press feedback uses transform or opacity only.
- `prefers-reduced-motion` removes rotation while preserving the visible status symbol and text.

## Brand mark

A lightweight local graph-closure mark: multiple dependency nodes converge on a bounded root/closure form. It must work at favicon-like and masthead sizes without external assets.

## Public voice

Precise, calm, and non-promotional. Say what the ledger records and what users can verify. Never claim truth, correctness of arguments, legal force, automatic fairness, or completion before authoritative readback.

## Must share

Brand mark, typography roles, status colors, action voice, focus treatment, and transaction terminology across every section/state.

## Allowed variation

The orientation band may be more editorial while the active workspace is denser. Documentation may use a longer reading measure, but must retain the same tokens and public voice.
