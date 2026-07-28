<!--
SPDX-License-Identifier: AGPL-3.0-only
-->

# Evaluation — Applying harmony-capture learnings to rhythm capture

**Date:** 2026-07-28
**Author:** Pilot-assist evaluation (pre-inventory)
**Purpose:** Assess which improvements from `harmony-capture` Phase 02
(pYIN/Viterbi engine + AudioWorklet acquisition, ADR 0031) should be carried
into rhythm capture, and how. This is an evaluation to seed a future
`rhythm-capture/phase-02`; it changes no source.

---

## 1. The central learning

The single most valuable change in harmony Phase 02 was **not** the pYIN
algorithm itself. It was the **architecture shift**:

> Stop doing analysis inside the real-time `ScriptProcessorNode` callback.
> Record raw PCM off the audio thread (AudioWorklet), then analyze the
> complete buffer offline in a pure, testable engine.

Rhythm capture today does the opposite of that, and it is the same failure the
harmony pipeline had — plus one that is arguably worse.

## 2. How rhythm capture works today

`packages/audio/src/rhythm-capture.web.ts` performs **all onset detection live**
inside `processor.onaudioprocess`:

- A `ScriptProcessorNode` (512-sample buffer, main thread) runs an envelope
  follower and a 4-state onset machine (`idle → rising → refractory`) with
  peak/valley/refractory bookkeeping (lines 118–186).
- Lane classification (`pulse | click | air`) reads spectral **centroid** and
  **zero-crossing rate** from an `AnalyserNode` *at the moment the callback
  fires* (`features()`, lines 97–116, 161–166).
- Only the resulting sparse `CaptureOnset[]` (lane, peak, time) is passed to
  the pure engine `analyzeRhythmCapture()`, which does tempo (comb filter),
  phase search, voting, and quantization.

### Failure modes (same root cause as harmony)

1. **Dropped buffers → lost or mistimed onsets.** `ScriptProcessorNode` runs on
   the main thread; on a busy mobile RN-Web UI, callbacks are starved. A missed
   callback during an attack means a missing hit or a wrong onset time. This is
   exactly the acquisition bug harmony Phase 02 fixed.
2. **Feature extraction is temporally smeared.** `AnalyserNode.getByteFrequencyData`
   returns whatever is current when the callback runs, not the samples of the
   onset that triggered the state change. Lane classification therefore reads a
   slightly wrong window, so kick/snare/hihat get mislabeled.
3. **No look-ahead.** A live state machine can only react to the past. Robust
   onset detection needs a novelty curve with pre/post context around each peak
   (standard peak-picking). The current design structurally cannot do this.
4. **Onset timing quantized to callback cadence**, not to the signal.

## 3. What transfers, and how directly

| Harmony Phase 02 learning | Transfers to rhythm? | Effort | Value |
|---|---|---|---|
| **AudioWorklet acquisition** (record off the audio thread, fallback to ScriptProcessor) | **Directly** — near-identical code to `harmony-capture.web.ts` | Low | High |
| **Record-then-analyze-offline** (realtime callback becomes recorder + level meter only) | **Directly** — the paradigm, not the pitch code | Medium | High |
| **Shared FFT** (`fftInPlace` from `pyin.ts`) | **Directly** — reuse for spectral flux; extract to `packages/music-core/src/fft.ts` | Low | High (synergy) |
| **Better core algorithm** (single-threshold → probabilistic + temporal model) | **By analogy** — amplitude state-machine → spectral-flux novelty + adaptive peak-picking | Medium | High |
| **Better feature stage** (Viterbi pitch refinement) | **By analogy** — classify lanes from robust offline spectral features over the onset segment, not one live frame | Medium | Medium |
| **Comb-filter tempo estimation** | **Already shared** — both engines use the same `COMB_WEIGHTS` comb + tempo prior | — | (already good) |
| **pYIN / Viterbi pitch tracking** | **No** — rhythm has no f0. (A Viterbi over the tempo grid is possible but the existing phase-search + voting already quantizes well; low priority.) | High | Low |

## 4. Recommended rhythm engine (the analog of pYIN→rhythm)

Replace the live envelope state machine with an **offline onset detector** on
the recorded PCM:

1. **Spectral-flux novelty** — STFT (reuse the shared FFT), half-wave-rectified
   positive difference of log-magnitude across frames. Far more sensitive to
   soft hi-hats and layered percussion than an RMS envelope, and it is the
   standard onset novelty function (Dixon 2006; Böck superflux 2013).
2. **Adaptive peak-picking** — threshold = moving mean/median of the novelty
   over a local window + a fixed bias; accept a peak if it is the local maximum
   within a pre/post window and above threshold, with a refractory minimum
   (~50–70 ms). This is deterministic and unit-testable on synthetic signals.
3. **Offline lane features** — for each accepted onset, compute centroid,
   high/low band-energy ratio, ZCR and spectral flatness over a fixed post-onset
   window from the recorded PCM (no `AnalyserNode`). Classify `pulse|click|air`
   from these. More robust and reproducible than the current single-frame read.
4. Feed the resulting `CaptureOnset[]` into the **unchanged**
   `analyzeRhythmCapture()` — tempo, phase, voting, folding, and the entire
   edit/preview/apply UI stay exactly as they are.

This keeps the blast radius small: the downstream contract
(`CaptureOnset` → `RhythmCaptureAnalysis`) and the UI are untouched, just like
harmony kept `analyzeHarmonyCapture` and the dialog untouched.

## 5. Reusable synergy: extract the FFT

`fftInPlace` in `packages/music-core/src/pyin.ts` is generic. Extract it to
`packages/music-core/src/fft.ts`, re-export from `pyin.ts` (no behavior change,
parity tests still pass), and reuse it for the spectral-flux STFT. One FFT,
two capture engines.

## 6. Open decisions to surface at inventory (Pilot)

- **OD-R1 — Prototype parity vs. detection quality.** Rhythm capture cites
  `beatbox-lab_7.html` parity in `rhythm-capture.ts`. Moving to spectral-flux
  onset detection deliberately departs from that prototype's live-envelope
  `detectOnset()`, exactly as ADR 0031 departed from `melody-lab.html`. Needs a
  new ADR and Pilot ratification. (Note: the `beatbox-lab_7.html` source is
  referenced in code comments but is **not present** in `reference/` — only
  `orbifold.html` is. Confirm the prototype is available before scoping a
  parity-based step, or scope the new engine as paper-cited like ADR 0031.)
- **OD-R2 — Keep live feedback?** The onset "hit" flashes (`onHit`) give live
  feedback while recording. Offline detection means hits are known only after
  recording. Decide: keep a lightweight live envelope purely for the flash/meter
  (not for the final analysis), or drop live per-hit feedback and keep only the
  level meter. Harmony kept a throttled live pitch preview for exactly this
  reason.
- **OD-R3 — Scope of lane classification rework.** Minimal (offline features,
  same thresholds) vs. a richer 4+ feature classifier.

## 7. Suggested phase shape (Pilot+Planner+Machine)

Mirror harmony Phase 02:

- **02.1 Inventory** — audit current pipeline, confirm/handle the missing
  `beatbox-lab` prototype, surface OD-R1..R3, write ADR (proposed).
- **02.2 Shared FFT extraction** — `fft.ts`, re-export from `pyin.ts`, parity
  tests green.
- **02.3 Pure offline onset engine** — spectral flux + adaptive peak-picking +
  offline lane features in music-core, deterministic synthetic tests (kick/snare/
  hihat fixtures, soft-hihat recall, dropped-frame robustness, silence).
- **02.4 AudioWorklet rewire** — `rhythm-capture.web.ts` records PCM off-thread,
  realtime callback reduced to meter (+ optional live flash per OD-R2), same
  error codes and cleanup.
- **02.5 Validation** — full suite + device pass; old-vs-new onset recall
  evidence in the handoff.

## 8. Bottom line

The highest-value, lowest-risk win is **AudioWorklet + record-then-analyze**,
which alone removes the dropped-onset problem, reusing proven harmony code. The
spectral-flux engine is the true quality lift (the rhythm analog of pYIN) and
should follow. pYIN's pitch/Viterbi specifics do **not** carry over, but the
shared FFT and comb tempo estimator already do. Net: one new initiative,
roughly the same shape and effort as harmony Phase 02, with meaningful code
reuse.
