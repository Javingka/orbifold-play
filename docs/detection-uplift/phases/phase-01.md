<!--
SPDX-License-Identifier: AGPL-3.0-only
-->

# Phase 01 — Segment-feature percussion lane classification

**Initiative:** `detection-uplift`
**Branch:** `detection-uplift/phase-01`
**Date scoped:** 2026-07-29

**Purpose:** Improve rhythm-capture lane accuracy (kick/snare/hat →
`pulse`/`click`/`air`) by replacing the prototype's two-threshold
centroid/ZCR rule with a deterministic multi-feature classifier measured over
each recorded onset segment. This resolves OD-R3, deferred since
rhythm-capture Phase 02 (ADR 0032).

**Gate:** Pilot direction (2026-07-29) after reviewing
`docs/detection-uplift/inventories/phase-01-inventory.md`:

- OD-1 resolved — harmony capture stays **monophonic-voice-only by design**.
  No polyphonic chord recognition (Chordino/chroma/HMM path) is in scope for
  this or any currently planned phase.
- OD-2 resolved — Option A: detection remains **100% client-side** in pure
  `packages/music-core` engines. No backend, no detection API service, no
  on-device ML inference runtime.
- OD-3 resolved — richer **deterministic** features only; no trained model,
  no new dependency.
- OD-4 resolved — sequencing: lane-classification uplift first (this phase);
  simultaneous multi-lane onset splitting is the candidate Phase 02, scoped
  only after this phase's handoff; harmony gets no phase now.

**Expected phase result:** Same capture UX, same public adapter API, same
`CaptureOnset`/`RhythmCaptureAnalysis` contracts, but a beatboxed
"bum/pa/tss" groove on a real phone classifies its lanes noticeably better,
with fixture-suite evidence comparing the new classifier against the
prototype rule on identical inputs.

---

## Authority and references

- `AGENTS.md` hard invariants: `packages/music-core` stays pure (no React,
  DOM, Expo, Skia, audio/platform APIs); exact-pinned dependencies only with
  Pilot approval (this phase adds **none**); never commit/push/merge without
  explicit Pilot authorization.
- ADR 0032 (Accepted) — offline spectral-flux onset detection. This phase
  changes **only** the lane-classification stage inside
  `packages/music-core/src/onset-detection.ts`. Onset novelty, peak-picking,
  AudioWorklet acquisition, and the tempo/phase/vote/quantize stage
  (`analyzeRhythmCapture`, prototype-parity) are out of scope and must not
  change behavior.
- ADR 0034 (Proposed, this phase) — records the departure from the
  `beatbox-lab_7.html emitOnset()` cutoff rule as the classification
  authority, exactly as ADR 0031/0032 recorded their own parity departures.
  Pilot ratifies at the final checkpoint after device validation.
- `reference/beatbox-lab_7.html` — immutable non-runtime parity source; may
  be consulted only to keep the retained lane *semantics* aligned; no code is
  copied from it.

## Steps

### Step 01.1 — Fixture corpus and baseline evidence

Extend `packages/music-core/src/onset-detection.test.ts` (or add a dedicated
fixture module under `packages/music-core/src/`) with a deterministic
synthetic corpus that stresses the current classifier. All noise uses the
existing seeded-LCG approach — no `Math.random`. Corpus must include at
minimum:

- vocal-kick-like hits: low fundamental with downward pitch drop plus a soft
  noise tail (a "bum", not a clean sine);
- vocal-snare-like hits: band-limited noise burst with mid centroid ("pa"/"ka");
- vocal-hat-like hits: short high-passed noise ("tss"), at both loud and soft
  velocities;
- clap-like broadband transients;
- every class repeated across at least three velocities and with a
  phone-like broadband noise floor added at moderate SNR;
- a mixed groove interleaving all classes at realistic spacing.

Run the **current** `classifyLane` rule over the corpus and record its
per-class confusion matrix in the handoff as the baseline. Do not change any
production code in this step.

CHECKPOINT → `test(detection-uplift): Phase 01 step 01.1 — beatbox fixture corpus and baseline`

### Step 01.2 — Onset-segment feature extractor

In `packages/music-core/src/onset-detection.ts`, add a pure, exported
feature extractor computed from the recorded PCM over each accepted onset's
attack-plus-decay segment (windows anchored at the refined attack peak):

- band energies over four bands aligned with the retained semantics:
  low (< 160 Hz), low-mid (160–1300 Hz), mid (1300–4600 Hz),
  high (> 4600 Hz), reported as ratios of segment energy;
- spectral flatness of the segment spectrum;
- spectral centroid and ZCR (kept from the current implementation, same
  byte-scaled measurement and noise gate so existing meaning is preserved);
- decay time: time from the attack peak until the segment envelope falls a
  fixed dB amount (e.g. −20 dB), clamped to the analysis window;
- attack sharpness: rise time or peak-to-mean ratio over the pre-peak window.

Every feature is deterministic and unit-tested against synthetic signals with
known expected values (e.g., pure low tone → low-band ratio ≈ 1, flatness
low; white noise → flatness high, decay tracks the envelope).

CHECKPOINT → `feat(detection-uplift): Phase 01 step 01.2 — onset-segment feature extractor`

### Step 01.3 — Deterministic lane classifier v2

Add a new exported classifier that maps the step-01.2 feature vector to a
`CaptureLane` plus an internal margin/score:

- deterministic weighted scoring or nearest-centroid over normalized
  features — hand-calibrated against the step-01.1 corpus; **no trained
  model, no new dependency, no randomness**;
- class boundaries chosen so the retained prototype semantics still hold on
  the clean isolated fixtures (isolated kick → `pulse`, snare → `click`,
  hat → `air`);
- `detectOnsets` switches to the new classifier; the existing
  `classifyLane` rule remains exported and tested as the comparison
  baseline;
- the `CaptureOnset` contract (`lane`, `peak`, `time`) is **unchanged** — the
  classifier's score is not added to the public contract in this phase.

Comparative acceptance is quantitative: on the step-01.1 corpus, v2 must
have strictly fewer total misclassifications than the baseline rule, with no
per-class regression on the clean isolated fixtures. The comparison is a
deterministic unit test, not a claim in prose.

CHECKPOINT → `feat(detection-uplift): Phase 01 step 01.3 — segment-feature lane classifier`

### Step 01.4 — Integration regression

- `packages/audio/src/rhythm-capture.web.ts` requires no API change; verify
  by inspection and by the full suite that phases, progress, error codes
  (`MICROPHONE_UNAVAILABLE`, `HTTPS_REQUIRED`, `TOO_FEW_HITS`), and cleanup
  are untouched.
- The end-to-end groove fixture (onsets → `analyzeRhythmCapture` → tempo +
  pattern) still resolves to the intended tempo, now with correct lanes on
  the harder corpus.
- Confirm no changes leaked into pYIN, harmony capture, or the
  tempo/quantize parity stage (their tests pass unmodified).

CHECKPOINT → `test(detection-uplift): Phase 01 step 01.4 — integration regression`

### Step 01.5 — Validation, device pass, and handoff

- Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build:web`; all must
  pass.
- Device validation (Pilot): over HTTPS on a physical phone, capture a
  repeated beatboxed groove mixing "bum/pa/tss"; the editable pattern must
  show visibly correct lane assignment, and at minimum not worse than the
  Phase 02 baseline on the same performance.
- Append per-step entries with an Acceptance Coverage Table to
  `docs/detection-uplift/handoffs/phase-01-handoff.md`, including the
  before/after confusion matrices from steps 01.1/01.3.
- Present ADR 0034 for Pilot ratification. No commit, push, merge, or PR at
  any step without explicit Pilot authorization.

CHECKPOINT → `test(detection-uplift): Phase 01 step 01.5 — validation evidence and handoff`

### Step 01.6 — Capture guidance and synthesized kit (Pilot addendum, post-D-06)

After the Pilot confirmed D-06 on a physical phone, the Pilot requested two
usability follow-ons folded into this phase before closing it:

1. **Capture guidance copy.** The rhythm-capture dialog now tells the player
   which mouth sounds classify best — “bum” (kick), “pa” (snare),
   “tss” (hat) — in both the intro checklist and the live recording hint.
   Copy-only change to `components/rhythm-capture-dialog.tsx`.
2. **Default drum-like kit.** Added a new `kit` rhythm sound: a role-aware
   synthesized kick/snare/hat (pitch-enveloped sine kick, tone+noise snare,
   high-passed noise hat) generated in
   `packages/music-core/src/playable-code.ts`, alongside — not replacing —
   the existing `hybrid` and sample/synth options. The three initial rhythm
   layers now default to `kit` so the out-of-the-box sounds read as
   kick/snare/hat, matching the capture lanes. No sample assets added; the
   selector UI lists it automatically (it renders `RHYTHM_SOUND_OPTIONS` and
   does not branch on `kind`).

This addendum keeps the pure/codegen boundary: the kit is Strudel codegen in
`music-core`, unit-tested in `playable-code.test.ts`. Contracts elsewhere are
unchanged.

CHECKPOINT → `feat(detection-uplift): Phase 01 step 01.6 — capture guidance and synthesized kit`

---

## Phase Acceptance

- **D-01** — The feature extractor computes deterministic, correct values on
  synthetic signals with known ground truth (band ratios, flatness, decay,
  attack, centroid, ZCR).
  - Validation method: `unit`
- **D-02** — On the beatbox-like fixture corpus (velocity spread + noise
  floor), classifier v2 makes strictly fewer misclassifications than the
  prototype cutoff rule, with no regression on clean isolated kick/snare/hat.
  - Validation method: `unit` (deterministic comparative test)
- **D-03** — A mixed multi-velocity groove resolves end-to-end through
  `analyzeRhythmCapture` to the intended tempo and a correctly-laned pattern.
  - Validation method: `unit`
- **D-04** — Public contracts are unchanged: `CaptureOnset`,
  `RhythmCaptureAnalysis`, the web adapter API, phases, error codes, and
  cleanup semantics.
  - Validation method: static analysis + `integration`
- **D-05** — Full regression suite, lint, typecheck, and web build pass;
  behavior outside the lane-classification stage is unchanged.
  - Validation method: `integration`
- **D-06** — On a phone over HTTPS, a beatboxed "bum/pa/tss" groove yields
  visibly correct lane assignment in the editable pattern.
  - Validation method: `operability` (manual Pilot device pass)
- **D-07** (step 01.6 addendum) — The capture dialog states the “bum/pa/tss”
  guidance, and the default `kit` sound voices kick/snare/hat per orbit role
  through codegen with no new sample assets.
  - Validation method: `unit` (`playable-code.test.ts`) + `operability`
    (Pilot device pass)

## Exclusions

- No polyphonic chord recognition, chroma extraction, or chord HMM (OD-1).
- No backend, upload pipeline, or detection API service (OD-2).
- No trained model or ML inference runtime (OD-3); no new dependencies of
  any kind.
- No changes to onset novelty, peak-picking, AudioWorklet acquisition, tempo
  estimation, quantization, or folding. (Step 01.6 addendum touches capture
  guidance copy and adds a codegen-only `kit` sound; it changes no detection
  or analysis behavior.)
- No simultaneous multi-lane onset splitting — that is the candidate
  Phase 02 of this initiative, scoped only after this phase's handoff.
- No changes to harmony capture, pYIN, or the harmony editor.

## ADR Triggers

- **Lane-classification authority departure** — ADR 0034 (Proposed):
  segment-feature classification supersedes the `beatbox-lab_7.html`
  `emitOnset()` cutoff rule as the classification stage's cited authority.
  Pilot ratifies after D-06.

## Handoff Note

The implementing agent appends per-step entries to
`docs/detection-uplift/handoffs/phase-01-handoff.md`, each with date, status,
what changed, evidence, and the Acceptance Coverage Table at step 01.5.
