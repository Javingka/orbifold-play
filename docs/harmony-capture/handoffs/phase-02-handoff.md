# Phase 02 Handoff — High-accuracy monophonic detection engine

## Step 02.1 — Research inventory

**Date:** 2026-07-28
**Status:** Complete.

- Audited the Phase 01 pipeline and identified four failure classes:
  main-thread `ScriptProcessorNode` buffer loss, single-threshold YIN
  octave/harmonic errors, absence of a temporal model, and inability to split
  repeated same-pitch notes.
- Researched current monophonic pitch tracking (pYIN paper, librosa
  parameterization, `lars76/pitch-benchmark`, CREPE/SPICE/RMVPE/SwiftF0
  neural trackers, AudioWorklet capture).
- Produced `docs/harmony-capture/inventories/phase-02-inventory.md`, phase
  spec `docs/harmony-capture/phases/phase-02.md`, and ADR 0031 (Proposed),
  surfacing OD-12 (parity departure) and OD-13 (deferred neural upgrade).

## Step 02.2 — Pure pYIN engine

**Date:** 2026-07-28
**Status:** Implemented; all targeted tests pass.

### What changed

- Added `packages/music-core/src/pyin.ts` (dependency-free, platform-free):
  - iterative radix-2 FFT and FFT-accelerated YIN difference function
    (`d(τ) = r_head(0) + r_tail(τ) − 2·cross(τ)`), verified against the direct
    O(N²) computation in tests;
  - CMND and pYIN stage-1 candidate extraction: 100 thresholds under a
    Beta(2, 18) prior, Boltzmann(2) weighting over qualifying troughs,
    `no_trough_prob 0.01`, parabolic τ refinement;
  - pYIN stage-2 banded Viterbi over 1/5-semitone bins with paired
    voiced/unvoiced states (pitch memory through silence), triangular
    transition window from ≈35.92 octaves/s, `switch_prob 0.01`, log-space
    renormalization;
  - decimation (>30 kHz → half rate) and a first-order ~55 Hz high-pass
    against rumble inside the pure engine;
  - note segmentation over the decoded track: voicing runs, sustained pitch
    steps, and log-energy onset re-articulation with onset-aware merging.
- Added `packages/music-core/src/pyin.test.ts` (11 deterministic tests, seeded
  LCG noise, no `Math.random`).

### Source citation (ADR 0031, replaces prototype parity for this stage)

Mauch & Dixon, "pYIN: A fundamental frequency estimator using probabilistic
threshold distributions", ICASSP 2014; parameter defaults follow librosa
`pyin` (100 thresholds, Beta(2, 18), Boltzmann(2), switch/no-trough 0.01,
max transition rate 35.92 oct/s).

### Key evidence

- The strong-second-harmonic octave trap (196 Hz fundamental at 0.25 vs.
  second harmonic at 1.0) makes the Phase 01 `estimateYinPitch` lock one
  octave high (~midi 67); the pYIN tracker decodes >90% of voiced frames
  within ±0.5 semitone of the true midi 55. Asserted deterministically in
  `pyin.test.ts`.
- ±60-cent vibrato stays one unfragmented note; broadband noise at low SNR
  keeps >85% of frames within ±0.5 semitone; repeated same-pitch notes are
  split on energy onsets; silence yields no notes.

## Step 02.3 — Pipeline rewire

**Date:** 2026-07-28
**Status:** Implemented; full package tests pass.

- Added `extractPyinCapture()` to `packages/music-core/src/harmony-capture.ts`
  mapping pYIN output onto the unchanged `PitchFrame`/`CapturedRootNote`
  contracts (`aperiodicity` carries `1 − voicedProbability`), feeding the
  existing key/tempo/fold/edit stages untouched.
- Every Phase 01 export and its tests remain intact (parity tests still pass).
- Added the B-03 end-to-end fixture: a C3–F3–G3–C3 sung-like phrase with rich
  harmonics, ±30-cent vibrato, deterministic noise, and breaths, repeated
  three times, resolves to entries `[0, 5, 7, 0]` with BPM in (80, 125).

## Step 02.4 — AudioWorklet acquisition

**Date:** 2026-07-28
**Status:** Implemented; static cleanup inspection recorded below.

- `packages/audio/src/harmony-capture.web.ts` now records through an inline
  AudioWorklet module (Blob URL, revoked after `addModule`); the worklet
  batches 1024-sample chunks and transfers them off the audio thread.
- Falls back to the Phase 01 ScriptProcessor path when AudioWorklet is
  unavailable or module registration fails.
- Public API, phases, progress reporting, and error codes
  (`MICROPHONE_UNAVAILABLE`, `HTTPS_REQUIRED`, `TOO_FEW_NOTES`,
  `ANALYSIS_FAILED`) are unchanged.
- Cleanup: the shared `finally` path detaches the backend (port close +
  disconnect, or `onaudioprocess` removal + disconnect), disconnects source
  and silent gain, stops every media track, and closes the AudioContext; the
  pre-`try` attach failure path performs the same teardown.
- During recording the main thread only meters chunk RMS; the live pitch
  preview runs at most every 120 ms on the 4096-sample tail.
- Analysis routes through `extractPyinCapture` with the ambient-calibrated
  gate scaled by 0.75 (the engine high-passes rumble out before RMS gating).

## Step 02.5 — Validation and evidence

**Date:** 2026-07-28
**Status:** Complete except the physical-device follow-up (B-06).

### Quality suite

- `pnpm typecheck` → passed.
- `pnpm lint` → passed.
- `pnpm test` → 13 files, 66 tests passed (Phase 01's 53 + 13 new).
- `pnpm build:web` → passed; Expo exported `dist`.

### Engine evidence

- Offline analysis of a 12 s, 48 kHz capture: 328 ms, 1117 decoded frames,
  correct entries `[0, 5, 7, 0]`, BPM 100.4 (well inside the existing
  `analyzing` phase budget).
- Octave-trap comparison (see step 02.2): Phase 01 estimator fails by one
  octave where the pYIN tracker is >90% correct.

### Acceptance Coverage

| Acceptance ID | Required behavior | Test file | Test type | Gap status |
|---|---|---|---|---|
| B-01 | Correct semitone decoding on harmonic-rich, octave-trap, vibrato, and noisy fixtures | `packages/music-core/src/pyin.test.ts` | unit | covered |
| B-02 | Gap bridging and onset splitting of repeated same-pitch notes | `packages/music-core/src/pyin.test.ts` | unit | covered |
| B-03 | Noisy repeated sung phrase resolves end-to-end to the intended progression | `packages/music-core/src/harmony-capture.test.ts` | unit | covered |
| B-04 | AudioWorklet recording with clean fallback, unchanged contract and cleanup | `packages/audio/src/harmony-capture.web.ts` | proxy:static-analysis | partial — real-device grant/record remains manual |
| B-05 | Full regression suite, lint, typecheck, build pass | full quality suite | integration | covered |
| B-06 | Physical HTTPS phone capture yields a visibly correct progression | — | operability | open — carried manual follow-up (Phase 01 A-11) |

### Remaining manual follow-up

B-06 requires a phone on a secure origin: grant permission, sing/whistle a
repeated root phrase, and verify the editable progression matches the sung
roots, including on a deliberately busy UI (scroll during recording) to
confirm the AudioWorklet path records without dropouts.

### Source-control result

Implemented on branch `harmony-capture/phase-02`; committed per step. Not
pushed and not merged — Pilot review (Checkpoint #5) pending, along with ADR
0031 ratification (Checkpoint #2, OD-12/OD-13).
