# Phase 02 — Offline spectral-flux rhythm detection

**Purpose:** Replace the Phase 01 live-envelope onset detector with an offline
spectral-flux + adaptive peak-picking engine and dropout-free AudioWorklet
capture, so kick/snare/hat onsets are recovered reliably from realistic
percussion on a phone. Mirrors harmony Phase 02 (ADR 0031) for rhythm.
**Gate:** Pilot direction (2026-07-28) after the harmony engine shipped: apply
the same learnings to rhythm. ADR 0032 records the deliberate departure from
`beatbox-lab_7.html` parity for the detection stage (OD-R1).
**Expected phase result:** Same capture UX and result contract as Phase 01,
but onsets come from the complete recording analyzed offline, and the recorder
no longer loses audio under mobile UI load.

---

## Step 02.1 — Research inventory
Done — `docs/rhythm-capture/inventories/phase-02-inventory.md`,
`docs/rhythm-capture/evaluation-harmony-learnings.md`, ADR 0032 (proposed).

## Step 02.2 — Shared FFT extraction
Extract `fftInPlace` to `packages/music-core/src/fft.ts`; import + re-export
from `pyin.ts`. pYIN parity tests stay green.
CHECKPOINT → `refactor(music-core): Phase 02 step 02.2 — extract shared FFT`

## Step 02.3 — Pure offline onset engine
`packages/music-core/src/onset-detection.ts`: Hann STFT, multiband spectral-flux
novelty (full band + normalized low band), Böck adaptive peak-picking, offline
lane classification (byte-scaled centroid + ZCR at the attack peak, prototype
cutoffs). Emits the unchanged `CaptureOnset` contract. Deterministic fixtures.
CHECKPOINT → `feat(rhythm-capture): Phase 02 step 02.3 — add spectral-flux onset engine`

## Step 02.4 — AudioWorklet rewire
`packages/audio/src/rhythm-capture.web.ts`: record PCM off-thread with
ScriptProcessor fallback; realtime callback reduced to meter + one
envelope-gated flash; onsets detected offline; same error codes and cleanup.
CHECKPOINT → `feat(rhythm-capture): Phase 02 step 02.4 — record via AudioWorklet`

## Step 02.5 — Validation and evidence
Full quality suite + engine evidence in the handoff. No push/merge without
Pilot authorization.
CHECKPOINT → `test(rhythm-capture): Phase 02 step 02.5 — verify onset detection quality`

---

## Phase Acceptance

- **C-01** — Synthetic kick/snare/hat fixtures decode to onsets at the correct
  times; a full-band-flux bass bias is mitigated so kicks are recovered.
  - Validation method: `unit`
- **C-02** — Isolated kick, snare, and hat classify into `pulse`, `click`,
  `air`; soft offbeat hats between loud kicks are recovered.
  - Validation method: `unit`
- **C-03** — A multi-bar groove resolves end-to-end through
  `analyzeRhythmCapture` to the intended tempo and lane pattern.
  - Validation method: `unit`
- **C-04** — Web capture records through AudioWorklet with clean fallback; the
  adapter contract, error codes, and cleanup are unchanged.
  - Validation method: `manual` + static analysis
- **C-05** — Full regression suite, lint, typecheck, and web build pass;
  behavior outside rhythm capture is unchanged.
  - Validation method: `integration`
- **C-06** — On a phone over HTTPS, a beatboxed/tapped repeated groove yields a
  visibly correct editable pattern.
  - Validation method: `operability` (manual device pass)

## ADR Triggers
- **Detection-stage parity departure (OD-R1)** — ADR 0032, pending Pilot
  ratification at Checkpoint #2.

## Handoff Note
The Dev appends per-step entries to
`docs/rhythm-capture/handoffs/phase-02-handoff.md`.
