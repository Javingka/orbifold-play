# Phase 01 — Transparent scale dialog

Status: complete on `scale-dialog/phase-01`

## Purpose

Recover the permanent vertical space occupied by the musical-scale carousel
while preserving live scale exploration and keeping the Tonnetz visible behind
the selector.

## Scope

- Replace the in-flow carousel with a 24 px scale-menu button immediately left
  of the transport status phrase in Harmony view.
- Adapt the ReactICX Dialog entrance/exit mechanics to a stage-local,
  transparent overlay centered over the Diamond Tonnetz.
- Reuse the existing `ScaleBlurCarousel` and scale state; selecting a card must
  recolor the Tonnetz immediately without closing the dialog.
- Give scale cards translucent backgrounds and keep the overlay backdrop light
  enough to perceive the changing triangles behind them.
- Close from the explicit close button, the surrounding backdrop, or a switch
  to Rhythm view.
- Remove the former 62 px carousel allocation from the Harmony stage without
  shrinking the Rhythm stage or changing audio, chord, sequence, and scale
  semantics.
- Add no dependency.

## Acceptance criteria

- **A-01-01** — No scale carousel occupies permanent height in Harmony view;
  the compact menu trigger is reachable and reports the current scale.
- **A-01-02** — The dialog is centered within the Tonnetz stage, enters and
  exits smoothly, and remains usable at 320×568 and 390×844.
- **A-01-03** — Cards and dialog background remain translucent enough to see
  the Tonnetz, and scale changes are visible behind the still-open dialog.
- **A-01-04** — Scale selection, Harmony/Rhythm navigation, chord targets,
  audio, and sequence behavior retain their prior contracts.
- **A-01-05** — Tests, typecheck, lint, formatting, and web export pass.

## Validation

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build:web
```

Manual browser checks are required at 320×568 and 390×844 for translucency,
layering, live recoloring, close behavior, and recovered vertical space.

## Checkpoint

Commit message:
`feat(scale-dialog): Phase 01 step 01.1 — move scale picker into transparent dialog`
