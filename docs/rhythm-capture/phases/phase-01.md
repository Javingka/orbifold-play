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
- Show detected BPM with `Use N BPM` enabled by default. Provide half/double
  correction and only update the app tempo while that choice remains enabled.

## Implementation

- Port the peak-onset, autocorrelation/comb-filter tempo detection, loop-length
  selection, phase search, repetition voting, and quantization behavior from
  `/Users/virtualmachine/Downloads/beatbox-lab_7.html`.
- Keep tempo/pattern analysis pure and cover it with deterministic tests.
- Isolate microphone and Web Audio behavior in a web adapter; native builds show
  an explicit unsupported message until a native audio adapter exists.
- Add a stage-local, mobile-first capture dialog beside the rhythm sound control.
- Calibrate room noise for two seconds, use a neutral three-second countdown,
  capture ten seconds, and classify low/mid/air hits into pulse/click/air.
- Stop existing playback before recording so speaker output cannot contaminate
  microphone analysis.
- Allow result audition without mutating the current rhythm.

## Validation

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build:web
```

Visually verify the intro and result surfaces at 320×568 and 390×844. Real
microphone quality and perceived classification still require manual tests on
mobile Safari and Chrome before merge or push.
