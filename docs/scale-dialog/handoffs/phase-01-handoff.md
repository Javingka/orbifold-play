# Phase 01 handoff

## Step 01.1 — Transparent scale dialog

Status: complete

The scale selector now opens from a compact musical-scale icon beside the
Harmony status line. The former in-flow carousel is removed and its 62 px
allocation is returned to the page. The Rhythm stage retains its previous
height.

The new stage-local dialog adapts the ReactICX perspective/scale/fade motion
without its opaque panel or heavy backdrop blur. It reuses the existing
carousel, keeps the Tonnetz visible through alpha-enabled cards, and applies
every scale selection live while remaining open. Backdrop, close button, and a
transition to Rhythm all dismiss it.

## Acceptance Coverage Table

| Acceptance | Evidence | Status |
| --- | --- | --- |
| A-01-01 | 390×844 and 320×568 closed-state browser screenshots; unique accessible scale-menu trigger | Pass |
| A-01-02 | Dialog centered inside the shortened Harmony stage at both required viewports | Pass |
| A-01-03 | Browser changed C major to C minor while dialog remained open; Tonnetz colors visibly changed through the cards | Pass |
| A-01-04 | Existing 23 pure tests pass; scale resolver and audio/sequence files unchanged | Pass |
| A-01-05 | Test, typecheck, lint, formatting, and web export pass | Pass |

## Validation

- `pnpm test`: 6 files, 23 tests passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build:web`: passed.
- Browser 390×844: trigger opened the overlay, C minor selection updated the
  Tonnetz without closing it, and explicit close retained C minor.
- Browser 320×568: closed stage and open dialog remained fully visible without
  horizontal clipping or collision with the readout/transport.
- No dependency, audio, rhythm, chord, sequence, or saved-data change.

## Step 01.2 — Stronger surface and recovered stage height

Status: complete

The stage no longer subtracts the old carousel's 62 px from Harmony. Harmony
now has its own responsive 284–420 px height range, so the Diamond directly
occupies the recovered space while Rhythm retains its independent sizing.

The dialog combines a moderate 24-intensity dark blur with higher-alpha panel
and card layers. Scale names are easier to scan, but live Tonnetz recoloring
remains perceptible behind the surface. An Animated Text-inspired staggered
hint now alternates between swipe and tap guidance below “Harmonic object”;
tapping it opens Rhythm and reduced-motion mode leaves the guidance static.

## Step 01.2 Acceptance Coverage Table

| Acceptance | Evidence | Status |
| --- | --- | --- |
| A-01-03 | Moderate blurred panel and higher-alpha cards retain visible live Tonnetz recoloring | Pass |
| A-01-04 | Navigation hint delegates to the existing view-change path; music state contracts are unchanged | Pass |
| A-01-05 | Test, typecheck, lint, formatting, and web export pass | Pass |
| A-01-06 | Browser checks at 320×568 and 390×844 show the larger Diamond without transport clipping | Pass |
| A-01-07 | Browser click on the animated hint opens Rhythm; accessibility and reduced-motion behavior are defined | Pass |
