# Phase 02 Inventory — High-accuracy monophonic detection engine

**Date:** 2026-07-28
**Initiative:** harmony-capture
**Step:** 02.1 (research + inventory; no source change)

## Problem statement

Phase 01 shipped a prototype-parity YIN pipeline. In real use the Pilot reports
detection quality is far below acceptable. Root causes identified by code
review of `packages/music-core/src/harmony-capture.ts` and
`packages/audio/src/harmony-capture.web.ts`:

1. **Acquisition loses audio.** `ScriptProcessorNode` (deprecated) runs its
   callback on the main thread. On a mobile browser running the React Native
   Web UI, callbacks are skipped under load, so the recorded PCM has silent
   gaps and discontinuities that corrupt every later stage.
2. **Single-threshold YIN is fragile.** `estimateYinPitch()` commits to the
   first CMND valley under a fixed 0.18 threshold. Breathy onsets, strong
   second harmonics, and vibrato produce octave/harmonic errors that the
   ad-hoc ±12/±24 local-median correction in `segmentPitchFrames()` only
   partially repairs, and sometimes repairs in the wrong direction.
3. **Per-frame decisions have no temporal model.** Each frame is estimated
   independently; there is no cost for musically impossible frame-to-frame
   jumps, so isolated errors survive and fragment notes.
4. **Segmentation cannot split repeated same-pitch notes.** Notes are split
   only on pitch jumps and unvoiced gaps; a repeated root sung legato
   ("da-da") folds into one long note, losing progression entries.

## Research summary (state of the art, verified 2026-07-28)

- **pYIN** (Mauch & Dixon, ICASSP 2014; `code.soundsoftware.ac.uk/projects/pyin`)
  replaces the fixed YIN threshold with ~100 thresholds drawn from a
  Beta(2, 18) prior, yielding multiple pitch candidates with probabilities per
  frame, then Viterbi-decodes a hidden Markov model over fine pitch bins with
  paired voiced/unvoiced states. It is the reference method for monophonic
  singing transcription (used by Tony/Sonic Visualiser) and materially
  outperforms plain YIN on sung audio (~91–97% raw pitch accuracy on singing
  benchmarks vs. plain YIN, per `github.com/lars76/pitch-benchmark` and the
  original paper's 30-hour synthesized-singing evaluation).
- **Neural trackers** (CREPE 2018, SPICE, RMVPE, SwiftF0) score higher still
  (95–96% on Vocadito/MIR-1K), but require model weights (MBs) plus an
  inference runtime — a new pinned dependency and download budget that needs a
  Pilot decision. Deferred; see OD-13.
- **librosa `pyin`** documents well-validated defaults: 100 thresholds,
  Beta(2, 18) prior, Boltzmann(2) trough weighting, `switch_prob 0.01`,
  `no_trough_prob 0.01`, max transition rate ≈ 35.92 octaves/s.
- **AudioWorklet** is the supported real-time capture path: audio callbacks run
  on a dedicated audio thread and cannot be starved by UI work.
- The **FFT-accelerated difference function** (standard fast-YIN identity
  `d(τ) = r_head(0) + r_tail(τ) − 2·acf(τ)`) reduces the per-frame cost from
  O(N·τmax) to O(N log N), which pays for the extra pYIN candidates.

## Planned scope

Pure engine work in `packages/music-core` (new `pyin.ts`, rewired capture
pipeline entry points in `harmony-capture.ts`), plus an acquisition upgrade in
`packages/audio/src/harmony-capture.web.ts`. Downstream contracts —
`CapturedRootNote`, `HarmonyCaptureAnalysis`, key/tempo/fold/edit functions,
dialog UI, error codes — are unchanged.

## Planned files

| File | Action |
|---|---|
| `packages/music-core/src/pyin.ts` | new — FFT, fast CMND, candidate generation, Viterbi decoding, note segmentation |
| `packages/music-core/src/pyin.test.ts` | new — deterministic synthetic fixtures |
| `packages/music-core/src/harmony-capture.ts` | add pYIN pipeline entry points; keep Phase 01 exports intact |
| `packages/music-core/src/harmony-capture.test.ts` | extend — full-pipeline fixtures |
| `packages/audio/src/harmony-capture.web.ts` | AudioWorklet capture with ScriptProcessor fallback |
| `docs/adr/0031-pyin-viterbi-capture-engine.md` | new ADR |

## Open decisions surfaced

- **OD-12 — Prototype parity vs. detection quality.** The Phase 01 checklist
  requires prototype (`melody-lab.html`) parity for ported engines. The pYIN
  engine intentionally abandons prototype parity for the estimation stage
  because the prototype is the accuracy problem. Proposed resolution: the new
  engine cites the pYIN paper and librosa parameters as its authoritative
  source instead, with deterministic synthetic fixtures as evidence; Phase 01
  functions remain exported and tested. Recorded in ADR 0031. **Pending Pilot
  ratification.**
- **OD-13 — Neural upgrade path.** CREPE/SwiftF0-class accuracy requires a new
  runtime dependency and multi-MB model download. Deferred to a future
  initiative; the pure pYIN engine is designed so the frame-candidate stage
  could be swapped for a neural front end later. **Pending Pilot decision if
  pursued.**

## Acceptance coverage plan

See Phase 02 Acceptance IDs B-01…B-06 in `docs/harmony-capture/phases/phase-02.md`.
