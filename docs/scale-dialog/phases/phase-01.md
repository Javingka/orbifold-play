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
- Use the recovered height for a larger responsive Diamond Tonnetz stage,
  independent from the Rhythm stage height.
- Add a lightweight ReactICX Animated Text-inspired, staggered character hint
  beneath the Harmony title. It alternates navigation guidance and is also a
  direct, accessible control for opening Rhythm.
- Strengthen the dialog's translucent surface with a moderate dark blur and
  higher-alpha scale cards while retaining live Tonnetz visibility.
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
- **A-01-06** — The Diamond uses the recovered vertical space at 320×568 and
  390×844 without clipping the sequence or transport controls.
- **A-01-07** — Harmony exposes an animated swipe-to-Rhythm hint; tapping the
  hint opens Rhythm and reduced-motion users receive static guidance.

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

Fast-follow commit message:
`fix(scale-dialog): Phase 01 step 01.2 — strengthen modal and expand Tonnetz`
