<!--
SPDX-License-Identifier: AGPL-3.0-only
-->

# Phase 01 Handoff — Segment-feature percussion lane classification

## Step 01.1 — Beatbox fixture corpus and baseline evidence

**Date:** 2026-07-29 · **Status:** Complete.

- Added `packages/music-core/src/onset-classification.test.ts` with a
  deterministic vocal-beatbox corpus: 6 classes (`vocalKick`, `breathyKick`,
  `vocalSnare`, `darkSnare`, `vocalHat`, `clap`) × 3 velocities (1 / 0.5 /
  0.22) over a phone-like broadband noise floor (0.004), all rendered with
  seeded-LCG noise — no `Math.random`. Every item is verified to detect as
  exactly one onset near its scheduled time through the unchanged ADR 0032
  detection stage.
- Fixture note: a long sustained "tss" defeats the current engine's
  local-mean peak test (its own flux plateau), so the corpus sibilant is kept
  short. Recorded as a known engine limitation for a future phase; the
  detection stage is out of scope here.
- **Baseline confusion matrix** (prototype `emitOnset()` rule, measured over
  the corpus; rows = truth, columns = prediction):

  | truth \ pred | pulse | click | air | missed |
  |---|---|---|---|---|
  | pulse (6) | 1 | 2 | 3 | 0 |
  | click (9) | 1 | 3 | 5 | 0 |
  | air (3) | 0 | 0 | 3 | 0 |

  **11 / 18 misclassified.** Root cause captured in the fixtures: the
  byte-dB-scaled centroid is strongly velocity-dependent — the identical
  "bum" render reads 1002 Hz at soft velocity but 3197 Hz loud, crossing the
  1300 Hz lane cutoff; a small breath layer (4% amplitude) pushes it past
  10 kHz. The clean drum-machine fixtures in `onset-detection.test.ts`
  remain the no-regression set and stay green.
- No production code changed in this step.

## Step 01.2 — Onset-segment feature extractor

**Date:** 2026-07-29 · **Status:** Complete.

- Added `measureOnsetSegmentFeatures()` to
  `packages/music-core/src/onset-detection.ts` (pure, deterministic,
  dependency-free): linear-power band-energy ratios over the four lane bands
  (< 160 Hz / 160–1300 / 1300–4600 / > 4600, aligned with the retained lane
  semantics), spectral flatness, the prototype-identical byte-dB centroid and
  ZCR, decay time (−20 dB short-window RMS envelope scan, 0.25 s cap), and
  attack sharpness (post-peak vs. pre-attack 10 ms RMS ratio).
- D-01 tests (4) assert ground truth: pure tones at 100 / 700 / 3000 /
  8000 Hz concentrate > 85% of energy in their band with flatness < 0.1;
  white noise reports flatness > 0.4, ZCR > 0.3, high-band dominance;
  `exp(−30t)` decays in 76.8 ms ± tolerance while a sustained tone exceeds
  the scan bound; a hit from silence scores attack ≈ 1 vs. ≈ 0.5 for a
  100 ms swell.

## Step 01.3 — Deterministic lane classifier v2

**Date:** 2026-07-29 · **Status:** Complete.

- Added `classifySegmentLane()` (ADR 0034): deterministic weighted scores
  over band ratios + ZCR, hand-calibrated on the step 01.1 corpus feature
  dump. The mid-band penalty in the air score separates a broadband clap
  (mid-heavy → `click`) from a sibilant hat (pure high band → `air`). Ties
  resolve toward `click`, the prototype's own fallback.
- `detectOnsets()` now classifies with v2; `classifyLane()` (prototype rule)
  stays exported with its cutoffs as the tested comparison baseline. The
  `bassCutoffHz`/`highCutoffHz` options remain for API stability and now
  parameterize only the baseline rule — documented in the option comments
  (the web adapter never passed them).
- **Comparative result (D-02):** classifier v2 resolves the corpus with
  **0 / 18 errors vs. the baseline's 11 / 18**, asserted exactly in a
  deterministic unit test. Key mechanism: linear-power band ratios are
  velocity-invariant where the byte-dB centroid moves > 3× across the same
  sound's velocity range.
- `CaptureOnset` contract unchanged (`lane`, `peak`, `time`).

## Step 01.4 — Integration regression

**Date:** 2026-07-29 · **Status:** Complete.

- `packages/audio/src/rhythm-capture.web.ts` untouched (git diff confirms
  the only source change is `onset-detection.ts` plus the new test file).
  Adapter API, phases, error codes, and cleanup semantics unchanged.
- Full suite green with v2 active: 15 files, 80 tests (73 prior + 7 new),
  including the unchanged onset-detection tests (clean drum fixtures classify
  identically — the D-02 no-regression clause), the end-to-end
  backbeat → `analyzeRhythmCapture` test (D-03), pYIN/harmony parity tests,
  and the rhythm tempo/quantize parity tests.

## Step 01.5 — Validation and evidence

**Date:** 2026-07-29 · **Status:** Complete; D-06 device pass satisfied.

### Quality suite

- `pnpm typecheck` → passed.
- `pnpm lint` → passed.
- `pnpm test` → 15 files, 83 tests passed (73 pre-phase + 10 new; final run
  after the Codex-review fixes).
- `pnpm build:web` → passed; Expo exported `dist`.

### Independent review (Codex, 2026-07-29)

A Codex audit of the engine diff confirmed: no textual change to novelty or
peak-picking, detection timing behavior preserved, purity/dependencies/
`CaptureOnset` shape unchanged, and the D-02 assertion not vacuous. Findings
and their resolution:

| # | Finding | Resolution |
|---|---|---|
| 1 (High) | Classifier ignores flatness/decay/attack/centroid despite ADR wording | ADR 0034 amended to match reality: the classifier deliberately consumes only corpus-proven discriminative features (band ratios + ZCR); the rest are exposed for diagnostics/future retuning — no uncalibrated weights |
| 2 (Med) | "Segment" band energy covers one fixed ~46 ms frame, not attack+decay | Documented in the extractor doc comment and ADR; decay separately scans 250 ms |
| 3 (Med) | Buffer-edge clamping distortion untested | Added boundary tests (onset at buffer start and near end): features stay finite and well-formed; clamping identical to the pre-existing prototype measurement |
| 4 (Med) | Silence reports flatness ≈ 1 via the epsilon | Fixed: flatness reports 0 below the epsilon floor; silent-segment test added |
| 5 (Med) | Attack pre-window skips 10 ms before the peak | Deliberate (the skipped span is the ambiguous rise); now documented in code and ADR |
| 6 (Med) | D-02 compared classifiers from different anchors | Fixed: D-02 now feeds both classifiers the same measured features; a separate test asserts `detectOnsets`' own anchoring resolves to identical lanes on every corpus item |
| 7 (Med) | 0/18 is in-sample calibration, not generalization evidence | Acknowledged explicitly in the ADR, this handoff, and the D-02 test comment; generalization is exactly the D-06 device pass |
| 8 (Low) | Decay window fixed at 128 samples (sample-rate dependent) | Fixed: window is now time-based (3 ms), relevant since the web adapter typically runs at 48 kHz |

Post-fix suite: 15 files, 83 tests, all green; typecheck/lint/build re-run
clean (see below). The step 01.6 addendum adds one more test → 84 total.

### Acceptance Coverage

| ID | Required behavior | Evidence | Type | Status |
|---|---|---|---|---|
| D-01 | Deterministic, correct feature values on known synthetic signals | `onset-classification.test.ts` (4 feature tests) | unit | covered |
| D-02 | v2 strictly fewer corpus errors than prototype rule; no clean-fixture regression | `onset-classification.test.ts` comparative test (0 vs 11) + unchanged `onset-detection.test.ts` lane test | unit | covered |
| D-03 | Mixed groove resolves end-to-end to intended tempo and lanes | `onset-detection.test.ts` end-to-end test (green with v2) | unit | covered |
| D-04 | Public contracts unchanged (`CaptureOnset`, analysis, adapter API, error codes, cleanup) | git diff surface + full suite | static + integration | covered |
| D-05 | Full suite, lint, typecheck, web build pass | quality suite above | integration | covered |
| D-06 | Phone HTTPS beatbox groove shows visibly correct lanes | Pilot device pass 2026-07-29 | operability | **covered** |
| D-07 | Capture-guidance copy + default synthesized kick/snare/hat kit | `playable-code.test.ts` + Pilot device pass | unit + operability | covered |

### Device verification (D-06) — 2026-07-29

The Pilot tested the guided capture flow on a physical phone over the HTTPS
tunnel (`expo start --web --tunnel`) and confirmed the beatboxed groove
classifies its lanes correctly — a clear improvement over the Phase 02
baseline. D-06 is satisfied.

## Step 01.6 — Capture guidance and synthesized kit (Pilot addendum)

**Date:** 2026-07-29 · **Status:** Complete.

Two Pilot-requested usability follow-ons, folded in after D-06:

- **Capture-guidance copy** (`components/rhythm-capture-dialog.tsx`,
  copy-only): the intro checklist and the live recording hint now name the
  best-recognized mouth sounds — “bum” (kick), “pa” (snare), “tss” (hat).
- **Default synthesized kit** (`packages/music-core/src/rhythm-sounds.ts`,
  `packages/music-core/src/playable-code.ts`): new `kit` rhythm sound —
  role-aware kick (pitch-enveloped sine), snare (tone + noise), hat
  (high-passed noise) — added alongside `hybrid` and the sample/synth
  options, no sample assets. The three initial rhythm layers in
  `src/app/index.tsx` now default to `kit`, so the out-of-the-box sounds read
  as kick/snare/hat and match the capture lanes. The sound selector lists it
  automatically. Covered by `playable-code.test.ts` ("voices the synthesized
  kit per role without sample assets"); the pure/codegen boundary is intact.

### Source-control status

Implemented on branch `detection-uplift/phase-01`. **Nothing committed** —
awaiting explicit Pilot authorization per `AGENTS.md`. Planned checkpoint
commits:

1. `test(detection-uplift): Phase 01 step 01.1 — beatbox fixture corpus and baseline`
2. `feat(detection-uplift): Phase 01 step 01.2 — onset-segment feature extractor`
3. `feat(detection-uplift): Phase 01 step 01.3 — segment-feature lane classifier`
4. `test(detection-uplift): Phase 01 step 01.4 — integration regression`
5. `test(detection-uplift): Phase 01 step 01.5 — validation evidence and handoff`
6. `feat(detection-uplift): Phase 01 step 01.6 — capture guidance and synthesized kit`

(The five engine steps may be squashed by content; the Pilot may prefer a
single phase commit. Final commit shape is the Pilot's call at authorization.)

### For Pilot ratification

- ADR 0034 — ratify (Proposed → Accepted); D-06 device pass is confirmed.
- Register proposal: **Lane classification is segment-feature based.**
  `detectOnsets` classifies from linear-power band ratios + ZCR
  (`classifySegmentLane`, ADR 0034); the prototype centroid/ZCR rule remains
  only as the exported tested baseline. Source: ADR 0034.

### Known limitations / deferred

- One lane per onset (coincident kick+hat merge) — unchanged; candidate
  Phase 02.
- Long sustained sibilants can defeat the ADR 0032 peak-picker's local-mean
  test (found while building the corpus) — detection-stage issue, out of
  scope this phase, noted for future scoping.
- Classifier weights are calibrated on synthetic fixtures; the D-06 device
  pass is the real-voice floor check, and weights are localized constants in
  `onset-detection.ts` for cheap retuning.
