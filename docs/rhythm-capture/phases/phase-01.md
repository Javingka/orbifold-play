# Phase 01 — Guided Mobile Rhythm Capture

## Outcome

Add an optional microphone workflow to the mobile Rhythm view. A player records a
repeated beatbox groove, reviews the detected tempo and three classified rhythm
lanes, listens before applying, and explicitly confirms replacement of the
current rhythm.

## Ratified product decisions

- Preserve a detected two-bar, 32-step result in the analysis while folding the
  union of both bars into the current 16-step orbit view.
- Applying a capture replaces all three current rhythm orbits only after an
  explicit confirmation.
- Show the detected BPM as a reference on a touch-first slider. The slider
  snaps to integer BPM values and familiar musical tempo anchors; edits retime
  an active preview immediately. Applying that BPM to Orbifold remains enabled
  by default and can be switched off independently.

## Implementation

- Port the peak-onset, autocorrelation/comb-filter tempo detection, loop-length
  selection, phase search, repetition voting, and quantization behavior from
  `/Users/virtualmachine/Downloads/beatbox-lab_7.html`.
- Keep tempo/pattern analysis pure and cover it with deterministic tests.
- Isolate microphone and Web Audio behavior in a web adapter; native builds show
  an explicit unsupported message until a native audio adapter exists.
- Add a full-screen, mobile-first capture dialog opened beside the rhythm sound
  control, so the capture editor does not clip the instrument surface.
- Calibrate room noise for two seconds, use a neutral three-second countdown,
  capture ten seconds, and classify low/mid/air hits into pulse/click/air.
- Stop existing playback before recording so speaker output cannot contaminate
  microphone analysis.
- Allow result audition without mutating the current rhythm; the central
  play/pause control retimes the audible preview live as the BPM slider moves.

## Validation

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build:web
```

Validated in a mobile browser: microphone capture, repeat recording, editable
step grid, play/pause audition, BPM adjustment during active playback, and
explicit rhythm replacement. The secure test URL requires HTTPS; native builds
continue to display the intentional unsupported message until a native audio
adapter is introduced.
