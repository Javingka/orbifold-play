# Phase 02 Handoff — Offline spectral-flux rhythm detection

## Step 02.1 — Research inventory
**Date:** 2026-07-28 · **Status:** Complete.
Produced the harmony-learnings evaluation, the Phase 02 inventory, the phase
spec, and ADR 0032 (proposed). Confirmed `beatbox-lab_7.html` is present in
`reference/` and that Phase 01 ports it faithfully (live `ScriptProcessorNode`
detection + `AnalyserNode` classification). Surfaced OD-R1/R2/R3.

## Step 02.2 — Shared FFT extraction
**Date:** 2026-07-28 · **Status:** Complete.
- Added `packages/music-core/src/fft.ts` with `fftInPlace` (verbatim from
  `pyin.ts`, no behavior change).
- `pyin.ts` imports and re-exports it; the 11 pYIN parity tests remain green.

## Step 02.3 — Pure offline onset engine
**Date:** 2026-07-28 · **Status:** Complete.
- Added `packages/music-core/src/onset-detection.ts`:
  - Hann-windowed STFT (FFT 1024, hop 256) via the shared FFT;
  - multiband onset novelty: half-wave-rectified log-magnitude spectral flux
    (Dixon 2006) over the full band plus a normalized low-band (< 160 Hz) flux
    (weight 1.5) so kick onsets survive the full-band bass bias;
  - adaptive peak-picking (Böck et al. 2012): local-max over ±30 ms, adaptive
    local-mean-plus-delta threshold (delta = 8% of the novelty max), 90 ms
    refractory;
  - offline lane classification at the attack peak: `getByteFrequencyData`-
    scaled centroid (2048 FFT) with a byte-40 spectral noise gate, plus ZCR,
    using the prototype cutoffs (bdCut 1300, hhCut 4600, ZCR 0.15/0.35);
  - onset time reported at the refined attack peak.
- Added `packages/music-core/src/onset-detection.test.ts` (7 deterministic
  tests, seeded LCG noise).

### Source citation (ADR 0032, replaces the live prototype detector)
Dixon, "Onset Detection Revisited" (DAFx 2006); Böck, Krebs, Schedl (ISMIR
2012). Lane cutoffs retained from `beatbox-lab_7.html emitOnset()`.

### Key evidence
- Full-band spectral flux alone loses kicks (hat flux ~450 vs kick ~2.5 on the
  shared adaptive threshold); the low-band term recovers them. Asserted via the
  groove-timing and end-to-end tests.
- Isolated kick→pulse, snare→click, hat→air; soft offbeat hats between loud
  kicks are recovered (≥6 air onsets).

## Step 02.4 — AudioWorklet rewire
**Date:** 2026-07-28 · **Status:** Complete; static cleanup inspection below.
- `packages/audio/src/rhythm-capture.web.ts` records through an inline
  AudioWorklet module (Blob URL revoked after `addModule`, 1024-sample chunks
  transferred off the audio thread), falling back to the Phase 01
  ScriptProcessor path when AudioWorklet is unavailable.
- The realtime callback is reduced to a level meter plus a single
  envelope-gated `onHit('pulse')` flash for feedback; onsets are detected
  offline by `detectOnsets` after recording.
- Public API, phases (now including `analyzing`), progress, and error codes
  (`MICROPHONE_UNAVAILABLE`, `HTTPS_REQUIRED`, `TOO_FEW_HITS`) unchanged.
- Cleanup: the shared `finally` detaches the backend (port close + disconnect,
  or `onaudioprocess` removal + disconnect), disconnects source and silent
  gain, stops every track, and closes the AudioContext; the attach-failure path
  performs the same teardown.
- Tempo analysis uses onset times relative to record start with a ~5.8 ms
  novelty resolution.

> Note: `RhythmCapturePhase` gained `analyzing`. The dialog UI (Phase 01)
> should surface it like harmony's analyzing state; if it currently switches on
> known phases only, add the `analyzing` label. Flagged for the UI step / Pilot.

## Step 02.5 — Validation and evidence
**Date:** 2026-07-28 · **Status:** Complete except device follow-up (C-06).
- `pnpm typecheck` → passed.
- `pnpm lint` → passed.
- `pnpm test` → 14 files, 73 tests passed (Phase 01's 53 + pYIN 11 + onset 7,
  minus none; rhythm engine parity tests unchanged).
- `pnpm build:web` → passed.
- Engine evidence: a 10 s, 48 kHz four-bar backbeat analyzes in ~62 ms to
  bpm 100, pulse 2 / click 4 / air 4 — the intended structure.

### Acceptance Coverage

| ID | Behavior | Evidence | Type | Status |
|---|---|---|---|---|
| C-01 | Correct onset times; kick bass-bias mitigated | `onset-detection.test.ts` | unit | covered |
| C-02 | Lane classification + soft-hat recall | `onset-detection.test.ts` | unit | covered |
| C-03 | End-to-end groove → tempo + pattern | `onset-detection.test.ts` | unit | covered |
| C-04 | AudioWorklet + fallback, unchanged contract/cleanup | `rhythm-capture.web.ts` | proxy:static-analysis | partial — real-device record remains |
| C-05 | Full suite/lint/typecheck/build green | quality suite | integration | covered |
| C-06 | Phone HTTPS groove → correct editable pattern | — | operability | open — manual device pass |

### Remaining manual follow-up
C-06: on a phone over HTTPS, beatbox/tap a repeated groove and confirm the
editable pattern matches, including scrolling during recording to confirm the
AudioWorklet path records without dropouts. Confirm the dialog shows the new
`analyzing` phase.

### Source-control result
Implemented on branch `harmony-capture/phase-02` (continued session). Committed
per step. Not pushed/merged — Pilot review and ADR 0032 ratification pending.
