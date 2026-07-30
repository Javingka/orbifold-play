<!--
SPDX-License-Identifier: AGPL-3.0-only
-->

# Phase 02 Inventory — Rhythm over-detection and detection calibration

**Date:** 2026-07-30
**Initiative:** `detection-uplift`
**Status:** Draft — awaiting Pilot review. No source changes; planning only.
**Trigger:** Pilot reports that real rhythm captures produce **more onsets than
performed** — "for every beat the user plays, the system captures ~3." The
Pilot proposes a calibration affordance near the start button: the user emits
a single sound, the system shows how many onsets it detected, and a slider
tunes detection so the user can build a per-voice reference.

---

## 1. The problem is real and reproducible (measured)

A throwaway diagnostic rendered realistic **single** vocal utterances (not the
deliberately-shortened Phase 01 fixtures) and ran the shipped `detectOnsets`
at the app's actual `rmsFloor`:

| Single utterance | Onsets detected | Over-detection |
|---|---|---|
| "pa" — clean plosive | 1 | none (correct) |
| "bum" — plosive + breathy tail + lip release | 2 | 2× |
| "tss" — sustained sibilant (~300 ms) | 3 | 3× |

This matches the Pilot's report exactly, and it matches a signal I already
flagged during Phase 01 (a sustained "tss" produced 5–7 candidate onsets at a
loose floor; I worked around it by shortening the corpus fixture). The bug was
latent in the shipped engine — the Phase 01 corpus avoided it rather than
fixing it.

## 2. Root cause: two distinct mechanisms, not one

The over-detection has **two independent causes**, which matters because a
single sensitivity knob cannot fix both.

### Cause A — Secondary peaks inside one transient (the "bum" → 2 case)

A vocal "bum" is not a single clean transient: it has an attack, then a
breath tail, then a lip-release sub-peak tens of milliseconds later. The
current peak-picker (`pickOnsetFrames`,
`packages/music-core/src/onset-detection.ts`) uses:

- a 90 ms refractory (`DEFAULT_REFRACTORY = 0.09`), and
- an adaptive threshold `local-mean + 0.08 × novelty-max`
  (`DEFAULT_PEAK_DELTA = 0.08`).

A sub-peak >90 ms after the attack and above the adaptive threshold is
accepted as a second onset. Measured: raising the refractory to 150 ms **or**
the delta to 0.15 collapses "bum" from 2 onsets to 1. So Cause A is tunable
with existing parameters.

### Cause B — Sustained non-transient sounds (the "tss" → 3 case)

Spectral flux (Dixon 2006) measures spectral *change*. A sustained sibilant
keeps producing positive novelty for its whole ~300 ms because its noise
spectrum fluctuates frame to frame, so the novelty curve **re-peaks above the
adaptive local mean repeatedly** during one continuous sound. Measured:

- refractory 90 → 150 ms: "tss" stays at **3**;
- refractory 200 ms: "tss" drops to 2, but 200 ms also suppresses legitimate
  fast hits (16th notes at 120 BPM are 125 ms apart);
- peak delta 0.08 → 0.15 → 0.25: "tss" stays at 3, then 2 only at 0.25.

**Neither a reasonable refractory nor a higher delta fixes Cause B without
also killing real fast hits.** A sustained sound needs an algorithm that
recognizes the sound is *continuing*, not restarting — a global sensitivity
slider alone structurally cannot do this. This is the key finding for
evaluating the Pilot's proposal.

## 3. Evaluating the Pilot's calibration proposal

The proposal — tap once, see the count, tune with a slider — is a genuinely
good feedback loop and fits the app: rhythm capture already has an ambient
calibration phase, so a detection calibration is a natural sibling. It gives
the user control, a concrete "is it hearing me right?" check, and a per-voice
reference. It should be part of the solution.

But §2 shows it is **not sufficient on its own**: the slider can only move
global parameters (floor / refractory / delta / sensitivity), which fixes
Cause A (the "bum") but cannot fix Cause B (the sustained "tss") without
harming fast legitimate hits. The recommendation is therefore to **pair** the
UX with an algorithmic fix for sustained sounds.

### A stronger version of the same idea (offline re-detection)

Because ADR 0032 already made detection **offline on the complete recorded
buffer**, we can re-run `detectOnsets` on the *same* recording with a
different sensitivity **without re-recording**. That unlocks a better UX than
a separate calibration tap:

- the user records their groove once;
- in the result view, a sensitivity slider re-analyzes the already-recorded
  PCM instantly and the onset count / pattern updates live;
- the calibration tap (record one sound, expect a count of 1) remains useful
  as a quick pre-check and to auto-suggest a starting sensitivity.

This is cheap (a 10 s capture analyzes in ~60 ms per ADR 0032) and turns the
Pilot's idea into "record once, then scrub detection until it matches what you
played." It is surfaced as OD-5 below.

## 4. Proposed algorithmic fix for Cause B — envelope-dip gate

Standard transient detection requires the signal to **decay before a new
attack** counts. Add a gate to `pickOnsetFrames` (or a post-pass): accept a
new onset only if the energy envelope (or novelty) has fallen below a fraction
(e.g. 40 %) of the previous onset's peak since that onset. A sustained "tss"
never dips, so it fires once; a real second hit does dip, so it survives. This
is deterministic, unit-testable on synthetic signals, pure, and adds no
dependency — the same shape as every prior detection-uplift change. Combine
with a modest refractory increase to also clean up Cause A.

Effort is contained: `pickOnsetFrames` already has the novelty and per-frame
RMS in hand. Risk is a real fast repeated same-sound hit being merged; the
dip fraction and refractory are the tunables the calibration slider can expose.

## 5. Affected files (for a future phase, not this inventory)

| Concern | File |
|---|---|
| Peak-picking + dip gate + sensitivity mapping | `packages/music-core/src/onset-detection.ts` (pure) |
| Sensitivity → {floor, refractory, delta, dip} mapping | new pure helper in `onset-detection.ts` |
| Offline re-detection on recorded PCM | `packages/audio/src/rhythm-capture.web.ts` (expose the recorded buffer / a re-analyze entry) |
| Calibration tap + sensitivity slider UI | `components/rhythm-capture-dialog.tsx` |
| Determinism tests | `packages/music-core/src/onset-detection.test.ts` / a new test |

The `CaptureOnset` → `RhythmCaptureAnalysis` contract and the tempo/quantize
parity stage stay unchanged, exactly as in Phase 01.

## 6. Open decisions for the Pilot

- **OD-1 — Algorithmic scope.** Add the envelope-dip gate + modest refractory
  bump (recommended, fixes both causes), vs. parameter-tuning only (fixes the
  "bum" but not the sustained "tss"), vs. a larger onset-model rework
  (unnecessary for this symptom).
- **OD-2 — Calibration UX scope.** (a) A one-tap calibration that just
  auto-picks a sensitivity; (b) an interactive slider with live re-test
  (recommended); (c) a fixed improved default with no new UI. These can be
  combined.
- **OD-3 — Where the slider acts.** On a dedicated calibration tap only, or —
  stronger — also on the recorded groove in the result view via offline
  re-detection (OD-5). Recommended: both, sharing one sensitivity value.
- **OD-4 — Persistence.** Does the tuned sensitivity persist across sessions
  (a per-voice reference), or reset each capture? The brief defers
  persistence broadly, so a per-session default is the low-risk start; a
  stored reference is a later, separately-approved step.
- **OD-5 — Adopt offline re-detection UX?** Record once, then scrub
  sensitivity to re-analyze the same buffer live (§3). Recommended — it is a
  small adapter change over the existing offline architecture and is a
  better fit than a separate calibration recording.
- **OD-6 — Sequencing vs. the earlier Phase 02 candidate.** The previously
  flagged Phase 02 candidate was *simultaneous multi-lane onset splitting*.
  Over-detection degrades **every** capture, while multi-lane splitting is an
  edge case; recommend this over-detection work becomes Phase 02 and
  multi-lane splitting moves to a later phase.

## 7. Risks and constraints

- The dip gate and any sensitivity mapping stay inside `packages/music-core`
  and must remain free of React/DOM/Expo/Skia/audio-platform imports per
  `AGENTS.md`; achievable as pure DSP, same as `pyin.ts`/`onset-detection.ts`.
- Calibration/slider UI touches `rhythm-capture-dialog.tsx` and must keep the
  existing accessibility, reduced-motion, and 320×568 / 390×844 guarantees;
  any new control needs a device pass, not just a build.
- No new dependencies; no backend (consistent with Phase 01's Option A).
- The device pass is mandatory acceptance: synthetic fixtures prove the dip
  gate deterministically, but "does the count match what I played" is an
  on-phone check with a real voice, like D-06.

## 8. What this inventory is not

No ADR, phase file, branch, or code — inventory-first per `AGENTS.md`. It is a
decision-ready diagnosis of the over-detection Pilot report plus an evaluation
of the calibration proposal, for the Pilot to resolve OD-1–OD-6 before a
`phase-02.md` is scoped. An ADR will be warranted if the dip gate changes the
cited detection-stage authority (Dixon/Böck) the way ADR 0032/0034 did.

## 9. Pilot resolutions (2026-07-30)

- **OD-1 — Resolved:** algorithmic fix. Add the envelope-dip gate plus a
  modest refractory increase; not parameter-tuning alone.
- **OD-2 / OD-3 / OD-5 — Resolved (record-once + live slider):** the primary
  control is a sensitivity slider in the **result view** that re-runs
  `detectOnsets` on the already-recorded PCM instantly (no re-record), with a
  quick one-sound **calibration tap** as a pre-check. Both share one
  sensitivity value.
- **OD-4 — Resolved (persist as reference):** the tuned sensitivity is stored
  as a per-voice reference across sessions. Scoped narrowly as a **device-local
  preference** (a single scalar), explicitly distinct from the content
  persistence (sessions, timeline, import) the brief defers; the ADR records
  this boundary so it sets no precedent for persisting musical content.
- **OD-6 — Resolved (my recommendation):** this over-detection work becomes
  **Phase 02**; simultaneous multi-lane onset splitting moves to a later
  phase.

Outcome: proceed to `docs/detection-uplift/phases/phase-02.md` and ADR 0035
(Proposed) on branch `detection-uplift/phase-02`.
