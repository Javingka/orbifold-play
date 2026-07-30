<!--
SPDX-License-Identifier: AGPL-3.0-only
-->

# ADR 0034 — Segment-feature percussion lane classification supersedes prototype cutoffs

- **Status:** Accepted — ratified by Pilot 2026-07-29, confirmed on a physical
  device (D-06)
- **Date:** 2026-07-29
- **Initiative / Phase:** detection-uplift / Phase 01
- **Deciders:** Pilot (Javier)

## Context

Rhythm-capture lane classification (`pulse` | `click` | `air`) currently uses
the rule ported from `beatbox-lab_7.html emitOnset()`: spectral centroid
against two cutoffs (1300 Hz, 4600 Hz) plus ZCR against two thresholds
(0.15, 0.35), measured — since ADR 0032 — offline at each onset's attack
peak. Two features and four constants cannot separate vocal beatbox classes
reliably: a breathy "bum" with high-frequency leakage, a soft "tss", or a
"pa" with a dark tail land on the wrong side of a single centroid cutoff.
This was logged as OD-R3 ("scope of lane classification rework") in
`docs/rhythm-capture/evaluation-harmony-learnings.md` and deliberately
deferred in rhythm-capture Phase 02.

The Pilot's 2026-07-29 detection-uplift review resolved the surrounding
architecture questions: detection stays 100% client-side in pure
`packages/music-core` engines (no backend, no detection API), harmony
capture stays monophonic-voice-only by design, and no trained model or ML
inference runtime is adopted (the same reasoning as ADR 0031's OD-13
deferral of neural pitch trackers).

## Decision

1. **Feature stage:** each accepted onset gets a deterministic feature
   vector measured from the recorded PCM: four linear-power band-energy
   ratios (< 160 Hz, 160–1300 Hz, 1300–4600 Hz, > 4600 Hz) and spectral
   flatness over the same fixed ~46 ms attack window the prototype
   measurement uses (peak near its start); spectral centroid and ZCR
   retaining the existing byte-scaled measurement and noise gate; decay time
   to a −20 dB drop over a separate 250 ms envelope scan
   (sample-rate-independent window); and attack sharpness comparing 10 ms of
   post-peak energy against the 10 ms of context ending 10 ms before the
   peak (the skipped span is the ambiguous rise itself). All computed in
   `packages/music-core/src/onset-detection.ts`, dependency-free and
   unit-tested against synthetic signals with known ground truth, including
   silence (flatness reports 0, not the epsilon artifact) and buffer-edge
   clamping.
2. **Classifier stage:** a deterministic weighted-score classifier replaces
   the two-threshold cutoff rule inside `detectOnsets`. It deliberately
   consumes only the features the calibration corpus proved discriminative —
   the four band ratios (velocity-invariant, unlike the byte-dB centroid)
   plus ZCR. Flatness, decay, attack sharpness, and centroid are exposed by
   the extractor for diagnostics and future retuning but carry **no weight
   yet**: adding weights that no failing fixture justifies would be
   uncalibrated guesswork. It is hand-calibrated against a deterministic
   beatbox-like fixture corpus (velocity spread, phone-like noise floor,
   seeded noise only) and must beat the prototype rule on that corpus in a
   comparative unit test that feeds both classifiers the same measured
   features, with no regression on clean isolated kick/snare/hat fixtures.
   The corpus result is in-sample calibration evidence by construction; the
   out-of-sample check is the Pilot's physical-device pass (D-06).
3. **Authority:** the classification stage's cited authority becomes this
   ADR plus its in-repo fixture evidence; the `beatbox-lab_7.html`
   `emitOnset()` cutoffs are retained only as the *semantic anchor* for what
   the three lanes mean (isolated kick → `pulse`, snare → `click`,
   hat → `air`) and as the tested comparison baseline. This mirrors how
   ADR 0031/0032 replaced prototype parity with cited methods for their
   stages. Prototype parity remains fully in force for the unchanged
   tempo/phase/vote/quantize stage (`analyzeRhythmCapture`).
4. **Contracts unchanged:** `CaptureOnset` (`lane`, `peak`, `time`),
   `RhythmCaptureAnalysis`, the web adapter API, phases, error codes, and
   cleanup semantics do not change. Onset novelty, peak-picking, and
   AudioWorklet acquisition (ADR 0032) do not change.
5. **Explicitly rejected for this stage:** a trained on-device model (needs
   an inference-runtime dependency and shipped weights on a mobile-web
   bundle that already carries CanvasKit — a separate Pilot decision if the
   deterministic classifier proves insufficient); a backend classification
   service (conflicts with the instant offline capture promise and adds
   hosting, privacy, and ops obligations); adopting DeepBeat/BeatVOX/
   DrumScript (unmaintained or Python-only research code, not portable to
   this runtime).

## Consequences

- Beatboxed grooves on real phones classify lanes from eight robust segment
  features instead of two instantaneous ones, with fixture-proven
  improvement and no contract or UI blast radius.
- The pure engine gains a feature extractor and a small classifier, still
  deterministic, dependency-free, and unit-testable — consistent with the
  established `pyin.ts`/`onset-detection.ts` pattern.
- Hand calibration against synthetic fixtures may not capture every real
  voice; the comparative-baseline test and the Pilot device pass (D-06)
  guard the floor, and thresholds/weights remain localized to the pure
  engine for cheap later retuning.
- One lane per onset remains a known limitation (coincident kick+hat still
  merge); multi-lane splitting stays deferred to a candidate Phase 02.
