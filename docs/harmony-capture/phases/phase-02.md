# Phase 02 — High-accuracy monophonic detection engine

**Purpose:** Replace the Phase 01 prototype-parity YIN pipeline with a
pYIN-class probabilistic pitch tracker and a dropout-free AudioWorklet capture
path so that sung, hummed, or whistled root phrases are detected reliably on a
phone.
**Gate:** Pilot direction (2026-07-28): current detection quality is
unacceptable; deep-researched, substantially better engine requested. ADR 0031
records the deliberate departure from `melody-lab.html` parity for the
estimation stage (OD-12).
**Expected phase result:** The same capture UX and result contract as Phase 01,
but the analysis produces the intended root sequence from realistic noisy
vocal input, and the recorder no longer loses audio under mobile UI load.

---

## Step 02.1 — Research inventory

PROMPT → Research state-of-the-art monophonic pitch tracking suitable for a
dependency-free TypeScript engine, audit the Phase 01 pipeline's failure
modes, and produce `docs/harmony-capture/inventories/phase-02-inventory.md`
surfacing every decision; STOP without implementing source code.

Expected result: reviewable inventory with OD-12/OD-13 surfaced. **Done —
see inventory.**

---

## Step 02.2 — Pure pYIN engine

PROMPT → Implement `packages/music-core/src/pyin.ts`: FFT-accelerated YIN
difference/CMND, Beta-prior multi-threshold candidate extraction with
Boltzmann trough weighting, banded Viterbi decoding over fine pitch bins with
paired voiced/unvoiced states, and note segmentation over the decoded track
with energy-onset splitting of repeated same-pitch notes.

Implementation requirements:
- No React, DOM, Expo, Skia, Web Audio, timers, or platform imports; no new
  dependency; deterministic; SPDX/AGPL headers.
- Parameters follow the pYIN paper / librosa defaults (100 thresholds,
  Beta(2, 18), Boltzmann(2), switch 0.01, no-trough 0.01, transition rate
  ≈ 35.92 oct/s) and are cited in code.
- Output reuses the existing `PitchFrame`/`CapturedRootNote` contracts.
- Deterministic synthetic tests: harmonic-rich tones, strong-second-harmonic
  octave trap, vibrato, short unvoiced gaps bridged by voicing states,
  repeated same-pitch note splitting, noise robustness, silence rejection.

Validation: `pnpm exec vitest run packages/music-core/src/pyin.test.ts`,
`pnpm typecheck`.

CHECKPOINT → `feat(harmony-capture): Phase 02 step 02.2 — add pYIN Viterbi engine`

---

## Step 02.3 — Pipeline rewire

PROMPT → Add pYIN-based extraction/segmentation entry points to
`packages/music-core/src/harmony-capture.ts` feeding the unchanged
key/tempo/fold/edit stages, keeping every Phase 01 export and test intact.

Implementation requirements:
- New `extractPyinPitchFrames`/`segmentPyinNotes` (names may vary) produce the
  same frame/note contracts consumed by `analyzeHarmonyCapture`.
- High-pass pre-filtering and decimation stay inside the pure engine.
- Full-pipeline fixture: a noisy, vibrato-laden, repeated sung-like phrase
  resolves to the intended root progression end-to-end.

Validation: `pnpm exec vitest run packages/music-core`, `pnpm typecheck`.

CHECKPOINT → `feat(harmony-capture): Phase 02 step 02.3 — route capture through pYIN`

---

## Step 02.4 — AudioWorklet acquisition

PROMPT → Upgrade `packages/audio/src/harmony-capture.web.ts` to record through
an AudioWorklet (inline module, no bundler asset), falling back to the Phase 01
ScriptProcessor path when AudioWorklet is unavailable, preserving the phase,
progress, error, cancellation, and cleanup contracts.

Implementation requirements:
- Identical public API and error codes; every exit path still stops tracks,
  disconnects nodes, and closes the AudioContext.
- Recording integrity: worklet chunks are copied and transferred off the audio
  thread; no per-callback main-thread analysis during recording.
- Live level/pitch preview stays functional in both paths.

Validation: `pnpm typecheck`, `pnpm lint`, static cleanup-path inspection in
the handoff.

CHECKPOINT → `feat(harmony-capture): Phase 02 step 02.4 — record via AudioWorklet`

---

## Step 02.5 — Validation and evidence

PROMPT → Run the complete quality suite, record engine-quality evidence
(fixture accuracy old vs. new) in the handoff, and finalize
`docs/harmony-capture/handoffs/phase-02-handoff.md`; do not push or merge
without Pilot authorization.

Validation: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build:web`.

CHECKPOINT → `test(harmony-capture): Phase 02 step 02.5 — verify pYIN capture quality`

---

## Phase Acceptance

- **B-01** — Synthetic voice-like fixtures (rich harmonics, strong second
  harmonic, vibrato, jitter, noise) decode to the correct semitone track; the
  octave-trap fixture that defeats single-threshold YIN is resolved.
  - Validation method: `unit`
- **B-02** — Viterbi voicing bridges short unvoiced gaps without fragmenting
  notes, and energy onsets split repeated same-pitch notes into separate
  `CapturedRootNote`s.
  - Validation method: `unit`
- **B-03** — A noisy repeated sung-like phrase resolves end-to-end through
  `analyzeHarmonyCapture` to the intended root progression.
  - Validation method: `unit`
- **B-04** — Web capture records through AudioWorklet when available and falls
  back cleanly; the adapter contract, error codes, and cleanup are unchanged.
  - Validation method: `manual` + static analysis
- **B-05** — The full regression suite, lint, typecheck, and web build pass;
  behavior outside harmony capture is unchanged.
  - Validation method: `integration`
- **B-06** — On a phone over HTTPS, a sung/whistled repeated phrase yields a
  visibly correct editable progression. (Carried manual follow-up from Phase
  01 A-11.)
  - Validation method: `operability` (manual device pass)

## ADR Triggers

- **Estimation-stage parity departure (OD-12)** — ADR 0031, pending Pilot
  ratification at Checkpoint #2.

## Handoff Note

The Dev appends per-step entries to
`docs/harmony-capture/handoffs/phase-02-handoff.md`.
