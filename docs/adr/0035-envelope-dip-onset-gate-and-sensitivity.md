<!--
SPDX-License-Identifier: AGPL-3.0-only
-->

# ADR 0035 — Rising-energy onset gate, detection sensitivity, and a device-local sensitivity preference

<!-- Filename retains "envelope-dip" from the original draft; the decision
     below is a rising-energy gate (see §Decision.1). -->


- **Status:** Accepted — ratified by Pilot 2026-07-30, validated on device
  (E-06)
- **Date:** 2026-07-30
- **Initiative / Phase:** detection-uplift / Phase 02
- **Deciders:** Pilot (Javier)

## Context

Real rhythm captures over-detect: a single sustained "tss" produces 3 onsets
and a "bum" produces 2 (measured; see
`docs/detection-uplift/inventories/phase-02-inventory.md`). Two independent
causes:

1. **Secondary peaks inside one transient** (the "bum"): a vocal hit has an
   attack plus a later lip-release/tail sub-peak more than 90 ms away, above
   the adaptive threshold — accepted as a second onset.
2. **Sustained non-transient sounds** (the "tss"): spectral flux (Dixon 2006)
   measures spectral *change*, and a sustained sibilant keeps producing
   positive novelty that re-peaks above the adaptive local mean for its whole
   duration. Neither a reasonable refractory nor a higher `peakDelta` fixes
   this without also suppressing legitimate fast hits (16th notes at 120 BPM
   are 125 ms apart).

A global sensitivity knob alone can fix cause 1 but structurally cannot fix
cause 2. The Pilot resolved OD-1–OD-6 (inventory §9): an algorithmic fix, a
sensitivity slider that re-detects the already-recorded buffer live plus a
calibration-tap pre-check, and persistence of the tuned sensitivity as a
per-voice reference.

## Decision

1. **Rising-energy onset gate (peak-picking refinement).** In
   `pickOnsetFrames` (`packages/music-core/src/onset-detection.ts`), accept a
   novelty peak as an onset only if the **RMS envelope is rising into it** —
   the windowed-average RMS over the ~30 ms into the peak must exceed the
   preceding window by a ratio strictly above 1 (default 1.08). This
   supersedes the "energy dipped below a fraction of the previous peak" idea
   from the original draft: a slowly **decaying** sustain eventually crosses
   any fixed dip threshold, so a valley test is fragile, whereas a sustain's
   envelope is never rising at its spurious internal peaks. A modest
   refractory increase (0.09 → 0.11 s) absorbs a lip-release sub-peak inside
   one plosive. Additionally, the RMS floor is applied **inside** the picker
   so sub-floor lead-in/room-noise peaks never consume the refractory window
   or the first-onset exemption. It refines — does not replace — ADR 0032's
   Dixon/Böck peak-picking; the STFT/flux novelty and the lane classifier
   (ADR 0034) are untouched.

   Known tradeoff: a soft hit layered over a louder decaying tail may not
   raise total RMS and can be dropped; the sensitivity control is the escape
   hatch, and this is a documented limitation rather than a regression from
   the prior envelope detector.
2. **Sensitivity model.** A pure monotonic mapping turns one scalar into
   `{ rmsFloor, refractorySeconds, peakDelta, dipFraction }`, bounded so the
   default keeps legitimate grooves intact. Unit-tested for monotonicity.
3. **Offline re-detection.** Because ADR 0032 already made detection offline
   on the complete recorded buffer, re-detection at a new sensitivity is just
   calling `detectOnsets` again on the same PCM — no re-recording. The web
   adapter retains the recorded buffer (via `onCaptured`) and the review UI's
   sensitivity slider re-analyzes it live. (A separate one-sound
   "calibration tap" pre-check was prototyped and removed at Pilot direction —
   the result-view slider tunes the actual groove, making a pre-check
   redundant.)
4. **Authoritative source for the detection refinement:** this ADR plus its
   deterministic single-utterance fixtures. The tempo/phase/vote/quantize
   stage keeps its prototype parity; ADR 0032/0034 stand.
5. **Contracts unchanged.** `CaptureOnset`, `RhythmCaptureAnalysis`, existing
   capture phases, error codes, and cleanup semantics are unchanged; the
   re-detection and calibration surfaces are additive.

### Persistence boundary (OD-4)

The tuned sensitivity persists across sessions as a **device-local preference:
a single scalar**. This is deliberately distinct from the content persistence
the product brief defers (sessions, composition timeline, song import, project
state). Persisting one detection-sensitivity number is a settings-style
preference, not musical-content persistence, and sets **no precedent** for the
latter. If the mechanism (e.g. `localStorage`) is later reused for content,
that remains a separate, brief-level decision.

## Consequences

- A single performed sound yields a single onset; the player can tune
  detection to their voice/room and see the recorded groove re-analyze live;
  the preference is remembered.
- The pure engine gains a dip gate and a sensitivity mapping, still
  deterministic, dependency-free, and unit-testable — consistent with
  `pyin.ts`/`onset-detection.ts`.
- Risk: a genuinely fast repeated identical hit could be merged by the dip
  gate; the dip fraction/refractory are the tunables the sensitivity slider
  exposes, and the Pilot device pass (E-06) is the real-voice floor check.
- A first, narrowly-scoped device-local preference exists in the app; the
  boundary above keeps it from becoming content persistence.
- Multi-lane onset splitting remains deferred.
