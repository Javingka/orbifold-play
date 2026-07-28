# Phase 02 Inventory — Offline spectral-flux rhythm detection

**Date:** 2026-07-28
**Initiative:** rhythm-capture
**Step:** 02.1 (research + inventory; source changes follow in 02.2–02.4)

## Problem statement

Rhythm capture Phase 01 is a faithful port of `beatbox-lab_7.html`: onset
detection runs live in a `ScriptProcessorNode` callback and classification
reads an `AnalyserNode` at callback time. This is the pre-Phase-02 harmony
architecture, with the same failure modes (see the harmony learnings
evaluation `docs/rhythm-capture/evaluation-harmony-learnings.md`):

1. Main-thread `ScriptProcessorNode` starves under mobile UI load → lost /
   mistimed onsets.
2. `AnalyserNode` spectrum is read at callback time, not at the attack →
   smeared lane classification.
3. No look-ahead → cannot use peak-picking pre/post context.

## Research summary (verified 2026-07-28)

- **Spectral flux** (Dixon, "Onset Detection Revisited", DAFx 2006): half-wave
  rectified positive difference of (log-)magnitude spectra is the standard
  percussive onset novelty; far more sensitive to soft hi-hats than an RMS
  envelope.
- **Adaptive peak-picking** (Böck, Krebs, Schedl, "Evaluating the Online
  Capabilities of Onset Detection Methods", ISMIR 2012): local-max over
  pre/post windows + adaptive local-mean-plus-delta threshold + refractory.
- **Spectral-flux bass bias:** full-band flux under-weights narrowband kick
  onsets (a broadband hat raises hundreds of bins, a kick two or three).
  Verified empirically here (hat flux ~450 vs kick ~2.5); mitigated with a
  normalized low-band flux term.
- **AudioWorklet** for dropout-free capture (proven in harmony Phase 02).
- The pYIN engine's `fftInPlace` is generic and reused via a new shared
  `packages/music-core/src/fft.ts`.

## Planned / delivered files

| File | Action |
|---|---|
| `packages/music-core/src/fft.ts` | new — shared FFT extracted from `pyin.ts` |
| `packages/music-core/src/pyin.ts` | import + re-export the shared FFT (no behavior change) |
| `packages/music-core/src/onset-detection.ts` | new — spectral flux, peak-picking, offline lane classification |
| `packages/music-core/src/onset-detection.test.ts` | new — deterministic fixtures |
| `packages/audio/src/rhythm-capture.web.ts` | AudioWorklet + offline detection rewire |
| `docs/adr/0032-offline-spectral-flux-rhythm-capture.md` | new ADR |

Downstream contracts unchanged: `CaptureOnset`, `RhythmCaptureAnalysis`,
`analyzeRhythmCapture`, the review/edit/preview UI, error codes, and the native
adapter's intentional limitation.

## Open decisions surfaced

- **OD-R1 — Detection-stage parity departure.** The new engine cites the onset
  literature + the prototype's lane cutoffs instead of `beatbox-lab_7.html`'s
  live `detectOnset()`. Recorded in ADR 0032. **Pending Pilot ratification.**
- **OD-R2 — Live feedback.** Resolved in-scope: keep a lightweight
  envelope-gated flash during recording for feedback only; onsets come from the
  offline pass. No per-onset live classification.
- **OD-R3 — Coincident hits.** One lane per onset is retained (prototype
  parity). Simultaneous kick+hat merges into one classified onset; a per-band
  multi-lane split is **deferred** to a future initiative.

## Acceptance coverage plan

See Phase 02 Acceptance IDs C-01…C-06 in
`docs/rhythm-capture/phases/phase-02.md`.
