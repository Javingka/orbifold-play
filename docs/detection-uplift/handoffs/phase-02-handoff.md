<!--
SPDX-License-Identifier: AGPL-3.0-only
-->

# Phase 02 Handoff — Rhythm over-detection fix and detection sensitivity control

## Step 02.1 — Over-detection fixtures and baseline

**Date:** 2026-07-30 · **Status:** Complete.

- Added `packages/music-core/src/onset-overdetection.test.ts` with realistic
  single vocal utterances (seeded LCG): a "bum" (plosive + breath tail +
  lip-release sub-peak), a clean "pa", and a sustained "tss" (~300 ms).
- **Baseline (gate disabled, 90 ms refractory):** `pa` → 1 (already correct),
  `bum` → **2**, `tss` → **3**. This reproduces the Pilot's ~3× report and is
  the E-01 baseline the fix must beat.

## Step 02.2 — Envelope rising-energy onset gate

**Date:** 2026-07-30 · **Status:** Complete.

- Diagnosis refined the ADR's "dip" idea: a slowly **decaying** sustain
  eventually crosses any fixed dip threshold, so a valley test is fragile. The
  robust discriminator is a **rising-energy (re-attack) gate** — a true onset
  is an attack (RMS rising into it); the spurious extra onsets of a held "tss"
  sit on the decay slope. Implemented in `pickOnsetFrames`
  (`packages/music-core/src/onset-detection.ts`) comparing **windowed-average**
  RMS (30 ms) before vs. into a novelty peak, so noisy per-frame RMS does not
  decide.
- Root-cause fix uncovered while implementing: `pickOnsetFrames` accepted
  **sub-floor lead-in/room-noise** novelty peaks (the `rmsFloor` was applied
  only downstream in `detectOnsets`), and those spurious peaks consumed the
  first-onset exemption and started the refractory clock, suppressing the real
  attack. The floor is now applied **inside** the picker. Refractory nudged
  0.09 → 0.11 s (still below a 16th note at 120 BPM) to absorb the "bum"
  lip-release.
- **Result (defaults):** `pa` → 1, `bum` → 1, `tss` → 1 (E-02), with the
  existing `onset-detection.test.ts` groove / soft-offbeat-hat / end-to-end
  tests unchanged (no regression on legitimate distinct hits).

## Step 02.3 — Detection sensitivity model

**Date:** 2026-07-30 · **Status:** Complete.

- Added `detectionSensitivityOptions(sensitivity)` and `DEFAULT_SENSITIVITY`
  (0.5): a monotonic piecewise-linear map from one 0..1 scalar to
  `{ rmsFloor, refractorySeconds, peakDelta, minRiseRatio }`, where 0.5
  reproduces the calibrated defaults, higher admits more onsets, and lower
  fewer. E-03 asserts monotonic onset count (a "tss": strict ≤ default ≤
  lenient, lenient > strict) and that the default keeps a single hit single.

## Step 02.4 — Adapter re-detection and calibration tap

**Date:** 2026-07-30 · **Status:** Complete.

- Added the pure glue `packages/music-core/src/rhythm-detection.ts`
  (`analyzeRhythmBuffer`, `countRhythmOnsets`): detect + tempo/vote/quantize at
  a sensitivity, with the ambient floor as a **hard lower bound** so nothing is
  detected below room noise even wide open. Unit-tested
  (`rhythm-detection.test.ts`, E-04): a recorded groove re-analyzes at any
  sensitivity without re-recording; monotonic count; floor respected.
- `packages/audio/src/rhythm-capture.web.ts`: `captureRhythm` gains a
  `sensitivity` option and an `onCaptured` callback handing back the recorded
  PCM (`CapturedRhythmBuffer`) so the UI can re-detect; added
  `captureCalibrationTap` (records ~1.6 s of one sound, returns the onset count
  + buffer). Existing phases, error codes, cleanup, and the
  `RhythmCaptureAnalysis` return are unchanged; new surfaces are additive. The
  native stub mirrors the exports.

## Step 02.5 — UI slider, calibration, persistence

**Date:** 2026-07-30 · **Status:** Complete.

- `components/sensitivity-slider.tsx`: a dependency-free 0..1 slider showing
  "N hits detected", accessible (`adjustable` role, increment/decrement).
- `components/rhythm-capture-dialog.tsx`: the result view re-detects the
  recorded groove live as the slider moves (offline pass on the same PCM, ADR
  0035); the intro offers a "test one sound" calibration tap that shows the
  count and the same slider. The tuned sensitivity is preloaded on open and
  saved on confirm.
- Persistence: `packages/audio/src/sensitivity-store.{web,native}.ts` — a
  single device-local scalar (`localStorage` on web, in-memory native), guarded
  to degrade to the default. **Scoped as a preference, not the deferred
  musical-content persistence** (ADR 0035 boundary).

## Step 02.6 — Validation and evidence

**Date:** 2026-07-30 · **Status:** Complete; device-validated (E-06) and ADR
0035 ratified.

### Quality suite

- `pnpm typecheck` → passed.
- `pnpm lint` → passed.
- `pnpm test` → 18 files, 90 tests passed (86 pre-phase + 4 new across
  `onset-overdetection.test.ts` and `rhythm-detection.test.ts`).
- `pnpm build:web` → passed; Expo exported `dist`.

### Independent review (Codex, 2026-07-30)

Codex confirmed the pure-core boundary, unchanged `CaptureOnset`/
`RhythmCaptureAnalysis` shapes, and determinism for finite inputs, and raised
9 findings — all addressed:

| # | Finding | Resolution |
|---|---|---|
| 1 (High) | Slider could show a new count while keeping/applying stale analysis when re-detection returns null | `changeSensitivity` now flags `reanalysisTooFew`, stops preview, and disables USE with a "raise sensitivity" hint until the pattern returns |
| 2 (High) | Implemented gate ≠ ADR "dip"; at ratio 1 a flat sustain passed | Default rise ratio raised to 1.08 (strictly rising, flat sustains now rejected); ADR 0035 reworded to describe the rising-energy gate and its soft-hit-over-tail tradeoff |
| 3 (Med) | Calibration not concurrency-safe / abortable | Added a `calibrationBusy` state disabling both capture buttons; the tap re-checks the abort signal before publishing |
| 4 (Med) | Calibration leaked the mic stream if AudioContext construction failed | `new AudioContext()` now inside a try that stops tracks on failure |
| 5 (Med) | Calibration used a hardcoded floor, ignoring room noise | The tap estimates the floor from the quietest quarter of the recording (min 0.006) |
| 6 (Med) | Detection ran twice per pointer event and twice at capture | Added `analyzeRhythmBufferDetailed` (one pass → analysis + count); the slider and the adapter each detect once |
| 7 (Low) | Default floor 0.006 vs prior 0.005 could drop soft hits | Sensitivity map mid floor set to 0.005 to match the prior effective floor |
| 8 (Low) | NaN sensitivity propagated into params, disabling floor checks | `lerp3` falls back to the default for non-finite input |
| 9 (Low) | Sensitivity saved only on confirm | Also saved on close, so calibration/review tuning persists |

Post-fix suite: 18 files, 90 tests green; typecheck/lint/build clean.
Findings 3–5 concerned the calibration tap, which was subsequently removed at
Pilot direction (step 02.7); their fixes were in place while it existed.

### Acceptance Coverage

| ID | Required behavior | Evidence | Type | Status |
|---|---|---|---|---|
| E-01 | Pre-gate baseline over-detects (bum 2, tss 3) | `onset-overdetection.test.ts` | unit | covered |
| E-02 | Each single utterance → one onset, no groove regression | `onset-overdetection.test.ts` + unchanged `onset-detection.test.ts` | unit | covered |
| E-03 | Sensitivity monotonic and bounded; default keeps single hits single | `onset-overdetection.test.ts` | unit | covered |
| E-04 | Re-detect same buffer at new sensitivity; floor as lower bound | `rhythm-detection.test.ts` | unit | covered |
| E-05 | Full suite, lint, typecheck, build pass | quality suite | integration | covered |
| E-06 | Phone HTTPS: single sounds → single onsets, live slider, remembered | Pilot device validation 2026-07-30 | operability | covered |

### Device verification (E-06) — 2026-07-30

The Pilot exercised the capture flow on a physical phone over the HTTPS tunnel,
confirmed the over-detection fix and the live result-view sensitivity slider,
and directed the final UI (remove the calibration pre-check, keep the enlarged
rolling countdown). E-06 is satisfied.

### Source-control status

Implemented on branch `detection-uplift/phase-02`; committed and merged to
`main` at Pilot authorization on 2026-07-30.

### For Pilot ratification

- ADR 0035 — Accepted (ratified 2026-07-30, device-validated).
- Register proposal: **Rhythm detection has a sensitivity control with a
  rising-energy onset gate.** `detectOnsets` rejects novelty peaks whose RMS
  envelope is not rising (ADR 0035), and one persisted device-local scalar
  drives `{rmsFloor, refractory, peakDelta, minRiseRatio}` via
  `detectionSensitivityOptions`; the review UI re-detects the recorded buffer
  live. Source: ADR 0035.

## Step 02.7 — Rolling countdown; calibration tap removed (Pilot addendum)

**Date:** 2026-07-30 · **Status:** Complete.

Pilot review resolved two UI questions:

- **Calibration "test one sound" removed.** After trying it on device the
  Pilot judged the pre-check not useful (the result-view sensitivity slider
  already tunes the actual groove), so it was removed entirely: the
  `captureCalibrationTap` adapter function and its `CalibrationTap*` types, and
  all calibration UI/state in `rhythm-capture-dialog.tsx`. The primary
  sensitivity control (result-view slider, offline re-detection, persistence)
  is unchanged.
- **Rolling countdown kept and shared.** `components/rolling-counter.tsx`: a
  ReactICX-inspired rolling number for React Native (per-digit vertical strip
  sliding with Reanimated; no new dependency — Reanimated is already used
  across the app). The pre-record "GET READY" 3-2-1 now renders as a large
  (64 px) rolling counter in **both** the rhythm and harmony capture dialogs,
  replacing the small inline `GET READY · N` text.

This addendum touches the harmony capture dialog only to share the countdown
component (no change to harmony detection or analysis). Suite green (90 tests),
typecheck/lint/build clean.

### Known limitations / deferred

- The rising-energy gate could, in principle, merge two genuinely fast
  identical hits with no envelope dip between them, or drop a soft hit layered
  over a louder decaying tail; the sensitivity slider is the escape hatch.
- Simultaneous multi-lane onset splitting remains deferred to a later phase.
