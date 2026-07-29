<!--
SPDX-License-Identifier: AGPL-3.0-only
-->

# ADR 0031 — pYIN/Viterbi harmony-capture engine replaces prototype-parity YIN

- **Status:** Accepted — ratified by Pilot 2026-07-29, confirmed on a physical
  device
- **Date:** 2026-07-28
- **Initiative / Phase:** harmony-capture / Phase 02
- **Deciders:** Pilot (Javier)

## Context

Phase 01 ported `melody-lab.html`'s single-threshold YIN estimator, local
octave correction, and threshold segmentation under the project's Prototype
Parity checklist item. Real-world detection quality is unacceptable. The
prototype itself is the accuracy bottleneck: per-frame single-threshold YIN
commits to harmonic/octave errors, has no temporal model, and its heuristic
repairs are unreliable on breathy or vibrato-laden voices. Additionally, the
`ScriptProcessorNode` recorder drops buffers on a busy mobile main thread,
corrupting the PCM before analysis begins.

## Decision

1. **Estimation stage:** adopt the pYIN algorithm (Mauch & Dixon, ICASSP 2014)
   implemented dependency-free in `packages/music-core/src/pyin.ts`:
   - FFT-accelerated YIN difference function and CMND;
   - ~100 threshold candidates under a Beta(2, 18) prior with Boltzmann(2)
     trough weighting and `no_trough_prob 0.01`;
   - banded Viterbi decoding over 1/5-semitone pitch bins with paired
     voiced/unvoiced states, `switch_prob 0.01`, transition width derived from
     ≈ 35.92 octaves/s (librosa-validated defaults);
   - note segmentation over the decoded track: voicing runs, sustained pitch
     steps, and energy-onset splitting for repeated same-pitch notes.
2. **Authoritative source:** for the estimation stage, the pYIN paper and
   librosa's parameterization replace `melody-lab.html` as the cited source of
   behavior (OD-12). Prototype parity remains in force for the unchanged
   key/tempo/fold/translation stages (ADR 0030 untouched). Phase 01 estimator
   exports remain present and tested.
3. **Acquisition:** record via AudioWorklet (audio-thread callbacks, no UI
   starvation) with the Phase 01 ScriptProcessor path as fallback. Contract,
   error codes, and cleanup semantics are unchanged.
4. **Neural front ends deferred (OD-13):** CREPE/SwiftF0/RMVPE-class trackers
   score higher but require a pinned inference-runtime dependency and multi-MB
   weights; adopting one is a separate Pilot decision. The engine keeps the
   frame-candidate stage swappable for that future.

## Consequences

- Detection accuracy on sung/whistled input moves from fragile single-frame
  heuristics to the reference classical method for monophonic transcription.
- The pure engine grows an FFT and a Viterbi decoder (~all O(N log N) /
  banded), still dependency-free, deterministic, and unit-testable.
- The Prototype Parity checklist item is satisfied by paper/parameter citation
  plus deterministic synthetic fixtures for the estimation stage.
- Offline analysis of a 12 s capture costs more CPU than Phase 01 but runs
  once per capture in the existing `analyzing` phase.
