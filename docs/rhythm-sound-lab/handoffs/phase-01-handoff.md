# Phase 01 handoff

## Step 01.1 — Sample-first orbit sound lab

Status: complete

The mobile engine now registers the repository's four CC0 percussion palettes
and emits deterministic round-robin variants with patterned velocity. Organic,
synthetic, and role-specific Hybrid sources share no timing modifiers. Pulse,
Click, and Air use separate audio effect orbits.

The transport-line button is contextual: Harmony retains the musical-scale
dialog and Rhythm opens a matching translucent sound dialog. Its colored tabs
map Pulse/outer, Click/middle, and Air/inner, show each current sound, and drive
an eight-option carousel. Selections apply immediately to an active pattern.

## Acceptance Coverage Table

| Acceptance | Evidence | Status |
| --- | --- | --- |
| A-01-01 | Browser exposes one contextual control in the same transport-line position for both views | Pass |
| A-01-02 | Browser accessibility tree and screenshots show three colored tabs with outer/middle/inner mapping and current selections | Pass |
| A-01-03 | Pure tests assert four local variants and exact deterministic sample tokens | Pass |
| A-01-04 | Pure codegen tests assert velocity/effect output and absence of `.fast`/`.slow` | Pass |
| A-01-05 | Browser changed Click from Wood to Conga while `RHYTHM PLAYING` remained active and no audio error appeared | Pass |
| A-01-06 | Open and closed dialog inspected at 390×844 and 320×568 | Pass |
| A-01-07 | Test, typecheck, lint, formatting, and web export pass | Pass |

## Validation

- `pnpm test`: 7 files, 27 tests passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build:web`: passed.
- Browser sample diagnostics loaded Cajón, Wood, Shaker, and Conga variants
  without a failed request or `AUDIO ERROR` state.
- Browser 390×844: all orbit tabs and eight sound choices were reachable;
  independent Pulse/Cajón, Click/Wood, and Air/Shaker state was visible.
- Browser 320×568: live-playing modal, three orbit mappings, carousel, readout,
  and transport remained visible and interactive.
- No dependency, rhythm-step, tempo, or persisted-data change.

## Step 01.2 — Independent card audition

Status: complete

Every sound card now selects and immediately auditions its sound. Organic
cards rotate through their local sample variants; Sub, Digital, and Noise use
a short synthesized preview; Hybrid combines the role-specific organic and
synthetic sources. A new tap cancels only the previous preview.

Preview playback uses the existing Web Audio context but never calls
`evaluate()` or changes the Strudel scheduler pattern. Re-tapping the already
selected card therefore auditions it without reapplying the rhythm. Changing a
sound while playing still updates the pattern and overlays the short preview,
while the transport and playhead remain active.

## Step 01.2 Acceptance Coverage Table

| Acceptance | Evidence | Status |
| --- | --- | --- |
| A-01-05 | Browser selected and auditioned Conga while `RHYTHM PLAYING` remained active | Pass |
| A-01-07 | Test, typecheck, lint, formatting, and web export pass | Pass |
| A-01-08 | Browser selected/auditioned Cajón with stopped transport; selection changed, Play remained idle, and no preview error was logged | Pass |
