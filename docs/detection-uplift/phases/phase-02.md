<!--
SPDX-License-Identifier: AGPL-3.0-only
-->

# Phase 02 — Rhythm over-detection fix and detection sensitivity control

**Initiative:** `detection-uplift`
**Branch:** `detection-uplift/phase-02`
**Date scoped:** 2026-07-30

**Purpose:** Stop rhythm capture from producing more onsets than the player
performed (a single "tss" detects as 3, a "bum" as 2), and give the player a
sensitivity control to tune detection to their own voice and room. Fixes the
over-detection diagnosed in
`docs/detection-uplift/inventories/phase-02-inventory.md`.

**Gate:** Pilot report (2026-07-30) of ~3× over-detection, plus Pilot
resolutions of OD-1–OD-6 (inventory §9):

- OD-1 — algorithmic fix: envelope-dip gate + modest refractory increase.
- OD-2/3/5 — a sensitivity slider in the result view that re-runs detection on
  the already-recorded PCM live, plus a one-sound calibration-tap pre-check;
  both share one sensitivity value.
- OD-4 — persist the tuned sensitivity as a per-voice reference, scoped as a
  narrow device-local preference (single scalar), distinct from the deferred
  content persistence.
- OD-6 — this is Phase 02; multi-lane onset splitting is deferred to a later
  phase.

**Expected phase result:** A single performed sound detects as a single onset
across "bum/pa/tss"; the player can slide sensitivity and watch the recorded
groove's onset count/pattern update instantly; the chosen sensitivity is
remembered for next time. Tempo/quantize/lane semantics and the
`CaptureOnset`/`RhythmCaptureAnalysis` contracts are unchanged.

---

## Authority and references

- `AGENTS.md` hard invariants: `packages/music-core` stays pure (no React,
  DOM, Expo, Skia, audio/platform APIs); native/web adapters stay separate;
  no new dependencies without Pilot approval (this phase adds **none**); never
  commit/push/merge without explicit Pilot authorization.
- ADR 0032 (Accepted) — offline spectral-flux onset detection. This phase
  refines the **peak-picking stage** (`pickOnsetFrames`) and adds a
  sensitivity mapping; it does not change the STFT/flux novelty, the lane
  classifier (ADR 0034), the AudioWorklet acquisition, or the
  tempo/phase/vote/quantize parity stage.
- ADR 0035 (Proposed, this phase) — records the envelope-dip gate as a
  peak-picking refinement, the sensitivity model + offline re-detection, and
  the narrow device-local sensitivity-preference persistence boundary. Pilot
  ratifies at the final checkpoint after device validation.
- `ORBIFOLD_PLAY_BRIEF.md` — persistence of musical content is deferred; the
  sensitivity preference is explicitly **not** that (ADR 0035 §boundary).

## Steps

### Step 02.1 — Over-detection fixture and baseline

Add a deterministic test rendering realistic **single** vocal utterances
(seeded LCG, no `Math.random`): a "bum" (plosive + breathy tail + lip-release
sub-peak), a clean "pa", and a sustained "tss" (~300 ms). Assert the current
`detectOnsets` over-detects (bum → 2, tss → 3) — the recorded baseline this
phase must beat. No production change in this step.

CHECKPOINT → `test(detection-uplift): Phase 02 step 02.1 — over-detection fixtures and baseline`

### Step 02.2 — Envelope-dip gate in peak-picking

In `packages/music-core/src/onset-detection.ts`, extend `pickOnsetFrames` (or
add a post-pass over its output) so a new onset is accepted only if the energy
envelope has fallen below a fraction of the previous accepted onset's peak
since that onset (a sustained sound never dips → fires once; a real second hit
dips → survives), combined with a modest refractory increase. Deterministic:
the dip fraction and refractory are named constants. Expose the dip fraction,
refractory, `peakDelta`, and `rmsFloor` so the sensitivity mapping (02.3) can
drive them.

Acceptance: on the 02.1 fixtures, "bum" → 1, "pa" → 1, "tss" → 1, while the
existing `onset-detection.test.ts` groove/soft-hat/end-to-end tests stay green
(no regression on legitimate distinct hits, including soft offbeat hats and
16th-note spacing).

CHECKPOINT → `feat(detection-uplift): Phase 02 step 02.2 — envelope-dip onset gate`

### Step 02.3 — Sensitivity model and offline re-detection

Add a pure `detectionSensitivity`-style mapping in `onset-detection.ts`: one
0–1 (or labelled) scalar → `{ rmsFloor, refractorySeconds, peakDelta, dipFraction }`,
monotonic and unit-tested (higher sensitivity → more onsets, lower → fewer,
bounded so legitimate grooves survive at the default). `detectOnsets` accepts
the mapped options. Because detection is already offline on the full buffer,
re-detection is just calling `detectOnsets` again on the same PCM with a new
sensitivity — add the pure entry point the adapter/UI will call.

CHECKPOINT → `feat(detection-uplift): Phase 02 step 02.3 — detection sensitivity model`

### Step 02.4 — Adapter: expose recorded buffer + re-detect; calibration tap

In `packages/audio/src/rhythm-capture.web.ts` (and the native stub for parity):

- retain the recorded PCM so the UI can re-run detection at a new sensitivity
  without re-recording, returning a fresh `RhythmCaptureAnalysis`;
- add a short **calibration-tap** capture mode (reuse the AudioWorklet path):
  record ~1.5 s, run `detectOnsets`, report the onset count;
- default sensitivity comes from the stored per-voice reference when present.

Public phases, progress, error codes (`MICROPHONE_UNAVAILABLE`,
`HTTPS_REQUIRED`, `TOO_FEW_HITS`), and cleanup semantics stay unchanged for the
existing capture path; new surfaces are additive.

CHECKPOINT → `feat(detection-uplift): Phase 02 step 02.4 — recorded-buffer re-detection and calibration tap`

### Step 02.5 — UI: sensitivity slider, calibration pre-check, persistence

In `components/rhythm-capture-dialog.tsx`:

- a **sensitivity slider** in the result view that re-detects the recorded
  groove live and updates the shown onset count and pattern (reuse
  `CaptureTempoSlider`'s interaction pattern where it fits);
- a compact **calibration** affordance near the start button: "emit one sound
  → detected N" with the same slider, as a pre-check;
- persist the chosen sensitivity as a per-voice reference (device-local, a
  single scalar) and preload it next time.

Keep accessibility roles, reduced-motion, and the 320×568 / 390×844 layouts.
Persistence is a narrow device-local preference only (ADR 0035 boundary).

CHECKPOINT → `feat(detection-uplift): Phase 02 step 02.5 — sensitivity slider, calibration, persistence`

### Step 02.6 — Validation, device pass, and handoff

- Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build:web`; all pass.
- UI verified at 320×568 and 390×844.
- Device validation (Pilot): over HTTPS on a physical phone, a single "bum",
  "pa", and "tss" each detect as one onset at the default; sliding sensitivity
  changes the count sensibly; a full groove's over-detection is gone; the
  chosen sensitivity is remembered on the next capture.
- Append per-step entries with an Acceptance Coverage Table to
  `docs/detection-uplift/handoffs/phase-02-handoff.md`, including before/after
  onset counts.
- Present ADR 0035 for ratification. No commit/push/merge/PR without explicit
  Pilot authorization.

CHECKPOINT → `test(detection-uplift): Phase 02 step 02.6 — validation evidence and handoff`

---

## Phase Acceptance

- **E-01** — On the single-utterance fixtures, the current engine over-detects
  (bum → 2, tss → 3): the recorded baseline.
  - Validation method: `unit`
- **E-02** — With the dip gate, each single utterance ("bum", "pa", "tss")
  detects as exactly one onset, with no regression on the existing
  groove/soft-hat/end-to-end onset tests.
  - Validation method: `unit`
- **E-03** — The sensitivity mapping is monotonic and bounded: higher → more
  onsets, lower → fewer, and the default keeps legitimate grooves intact.
  - Validation method: `unit`
- **E-04** — Re-running detection on the same recorded PCM at a new
  sensitivity yields a fresh analysis without re-recording; the existing
  capture contract, phases, error codes, and cleanup are unchanged.
  - Validation method: static analysis + `integration`
- **E-05** — Full regression suite, lint, typecheck, and web build pass;
  behavior outside peak-picking / the additive UI is unchanged.
  - Validation method: `integration`
- **E-06** — On a phone over HTTPS: single sounds detect as single onsets, the
  slider re-detects the recorded groove live, over-detection is gone, and the
  tuned sensitivity is remembered next session.
  - Validation method: `operability` (manual Pilot device pass)

## Exclusions

- No change to STFT/flux novelty, lane classification (ADR 0034), AudioWorklet
  acquisition, tempo estimation, quantization, or folding.
- No simultaneous multi-lane onset splitting (deferred to a later phase).
- No content persistence (sessions, timeline, import); only a single
  device-local sensitivity scalar.
- No backend, no new dependencies, no ML runtime.
- No changes to harmony capture, pYIN, or the harmony editor.

## ADR Triggers

- **Peak-picking refinement + sensitivity/persistence model** — ADR 0035
  (Proposed): the envelope-dip gate refines ADR 0032's peak-picking; the
  sensitivity model and offline re-detection are recorded; the device-local
  sensitivity-preference persistence boundary is fixed. Pilot ratifies after
  E-06.

## Handoff Note

The implementing agent appends per-step entries to
`docs/detection-uplift/handoffs/phase-02-handoff.md`, each with date, status,
what changed, evidence, and the Acceptance Coverage Table at step 02.6.
