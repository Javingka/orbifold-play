# Phase 01 Inventory — Guided Mobile Harmony Capture

**Created:** 2026-07-27
**Phase file:** `docs/harmony-capture/phases/phase-01.md`

## Files that will be touched

| Path | Current purpose | Change planned |
|---|---|---|
| `CLAUDE.md` | Inherited methodology/project context | Record Orbifold Play as the independent active product, desktop Orbifold as reference-only, and `harmony-capture` as the active initiative. |
| `docs/harmony-capture/phases/phase-01.md` | Does not exist on `main` | Define the approved feature phase, acceptance, operability, and ADR triggers. |
| `docs/harmony-capture/inventories/phase-01-inventory.md` | Does not exist on `main` | Record this read-only scope and decision checkpoint. |
| `docs/harmony-capture/handoffs/phase-01-handoff.md` | Does not exist on `main` | Accumulate step evidence and Acceptance Coverage Tables after implementation begins. |
| `packages/music-core/src/harmony-capture.ts` | Does not exist | Add the pure PCM/pitch analysis result, repeated-root translation, and immutable candidate-edit operations. |
| `packages/music-core/src/harmony-capture.test.ts` | Does not exist | Add synthetic/parity/error/translation/edit tests. |
| `packages/audio/src/harmony-capture.web.ts` | Does not exist | Add secure-context microphone acquisition, calibration/countdown/capture lifecycle, and pure-analyzer invocation. |
| `packages/audio/src/harmony-capture.native.ts` | Does not exist | Add the explicit native unsupported adapter. |
| `packages/audio/src/harmony-capture.ts` | Does not exist | Add the platform-resolution export matching rhythm capture. |
| `components/harmony-capture-dialog.tsx` | Does not exist | Add the full-screen capture state machine and mobile result editor. |
| `components/capture-tempo-slider.tsx` | Rhythm-specific reusable tempo control | Generalize accessibility text through optional props while preserving current rhythm defaults. |
| `components/flexi-preview-button.tsx` | Rhythm-specific preview/Pause control | Generalize accessibility text through optional props while preserving current rhythm defaults. |
| `src/app/index.tsx` | Owns local harmony/rhythm state and shared Strudel transport | Add Harmony microphone entry, candidate preview callbacks, resource stop behavior, and confirmed sequence replacement. |

Thirteen files are planned. This remains below the inventory threshold and is one vertical feature slice; no desktop repository, persistence, backend, build configuration, dependency manifest, or rhythm analysis file is in scope.

## Existing behavior to preserve

- Orbifold Play remains an Expo + React Native mobile-first product; the separate desktop Orbifold repository is reference-only and is never modified or combined.
- `FiniteTonnetzFace` continues to support exactly 24 unique faces and only `TonnetzQuality = 'maj' | 'min'` (`packages/music-core/src/finite-tonnetz.ts`).
- Harmony remains a maximum 16-entry local sequence (`src/app/index.tsx`, `MAX_SEQUENCE_LENGTH`) of `HarmonySequenceEntry` values with supported `HarmonyDuration` values `[0.5, 1, 2, 3, 4]`.
- Existing Tonnetz taps append chords, sequence remove/mute/duration controls work, and live playback re-evaluates without changing the clock contract.
- Tempo continues through `playStrudel(code, bpm)` and the scheduler `setCps(bpm/240)`; prototype `setcpm` output is not portable and will not be used.
- Existing Harmony and Rhythm playback share an obvious Play/Stop transport.
- Rhythm capture keeps its current state machine, HTTPS/native errors, active-preview retiming, edit behavior, accessibility labels, and explicit replacement semantics.
- Audio still starts only after a user gesture.
- Closing a capture or preview still stops audible output and releases microphone resources.
- AGPL-3.0 SPDX headers, TypeScript strictness, exact dependency versions, and the four existing quality commands remain intact.

Relevant regression tests:

- `packages/music-core/src/finite-tonnetz.test.ts`
- `packages/music-core/src/harmony-sequence.test.ts`
- `packages/music-core/src/harmony-duration.test.ts`
- `packages/music-core/src/playable-code.test.ts`
- `packages/music-core/src/rhythm-capture.test.ts`

## New behavior to introduce

- A microphone entry appears only in the Harmony view and stops existing playback before capture.
- The intro explicitly asks for one root note per intended chord, repeated 3–4 times; it never promises polyphonic chord detection.
- Web guides permission, two-second room calibration, neutral countdown, recording, analysis, result, confirmation, and recoverable errors.
- Pure analysis converts a repeated monophonic root phrase into at most 16 editable, currently playable chord candidates.
- The result displays the detected BPM reference and permits root, suggested `maj|min` quality, duration, removal, and BPM edits.
- Candidate preview uses the current Orbifold Play harmony sound/codegen without mutating the current sequence, selected Tonnetz face, selected scale, or rhythm.
- Every candidate edit rebuilds an already-active preview; Pause/Stop remains immediately reachable.
- Record again, close, error, and cancel preserve current harmony and stop capture/preview resources.
- Applying requires a second explicit confirmation and only then replaces the current harmony; the approved BPM policy is applied at that same boundary.
- Web errors explain HTTPS and permission requirements; native states that microphone harmony capture is currently available only in the mobile web app.

## Acceptance ID coverage plan

| Acceptance ID | Behavior | Planned test type | Planned test file | Step that covers it |
|---|---|---|---|---|
| A-01 | Guided capture states start after a gesture | manual | HTTPS mobile checklist in `docs/harmony-capture/handoffs/phase-01-handoff.md` | 01.4–01.5 |
| A-02 | Repeated roots produce deterministic prototype-cited results | unit | `packages/music-core/src/harmony-capture.test.ts` | 01.2 |
| A-03 | Results stay within roots, `maj|min`, supported durations, and 16 entries | unit | `packages/music-core/src/harmony-capture.test.ts` | 01.2 |
| A-04 | Candidate edits update an active preview | manual plus pure unit | `packages/music-core/src/harmony-capture.test.ts` and HTTPS mobile checklist | 01.2, 01.4–01.5 |
| A-05 | Preview is stoppable and isolated from live app state | manual | HTTPS mobile checklist in handoff | 01.4–01.5 |
| A-06 | Only confirmed replacement mutates current harmony | manual | HTTPS mobile checklist in handoff | 01.4–01.5 |
| A-07 | HTTPS/permission/signal/native limitations are explicit | manual plus proxy static analysis | Platform adapter inspection and HTTPS mobile checklist | 01.3, 01.5 |
| A-08 | 320×568 and 390×844 layouts remain reachable/accessibly labeled | manual | Device/browser layout checklist in handoff | 01.4–01.5 |
| A-09 | UI never claims monophonic analysis detected chord quality | manual plus proxy static analysis | Dialog copy inspection and mobile checklist | 01.4–01.5 |
| A-10 | Existing behavior passes unchanged outside capture | integration | Existing `packages/**/*.test.ts` suite through `pnpm test` | 01.2–01.5 |
| A-11 | A fresh operator completes the secure mobile flow | operability | Commands/device/URL/observations in handoff | 01.5 |

The repository has no React Native component-test renderer or E2E harness in its current dependency/test configuration. A-05 and A-06 therefore cannot honestly use the `integration` method written in the initial phase file without either a new dependency or changing their validation method to `manual`; OD-5 below requires Pilot resolution.

## Tests to add or modify

- Add `packages/music-core/src/harmony-capture.test.ts`:
  - deterministic YIN/f0 behavior on synthetic sine/harmonic signals;
  - silence and insufficient voiced-material rejection;
  - octave correction and note segmentation parity fixtures;
  - repeated-motif order, cap, deduplication, key/tempo reference, and approved duration semantics;
  - result conversion to existing Tonnetz faces;
  - immutable root/quality/duration/removal/BPM edits;
  - unsupported quality prevention and prototype source citations.
- Extend no existing rhythm-capture test unless generalizing a shared component changes a pure contract; rhythm behavior is otherwise regression-covered by `pnpm test` plus manual smoke.
- Run the full existing `packages` Vitest suite to protect finite Tonnetz, harmony sequence, duration, playable code, scales, rhythm capture, and audio sample behavior.
- Record manual secure-device evidence for microphone lifecycle, active preview updates, app-state isolation, explicit confirmation, errors, native limitation, accessibility, and both required viewports.

## Open decisions surfaced

**Resolution required before step 01.2.** These cannot be silently inherited:

- **OD-1 — Source of suggested `maj|min` quality.** Candidates: A) use the capture-detected key/mode; diatonic major/minor triads map directly, diminished falls back to minor and augmented falls back to major because the supported fallback preserves the third; B) use the currently selected C-rooted scale instead of detected key; C) default every root to major and make no tonal suggestion. Recommendation: **A**, always labeled “suggested” and always editable, because the microphone detects only a root and never chord quality.
- **OD-2 — Initial captured duration.** Candidates: A) every accepted root becomes one 1-bar chord, leaving supported duration editing to the review screen; B) quantize prototype sixteenth-step spans upward to the nearest supported `HarmonyDuration`; C) discard roots that would require durations below ½ bar. Recommendation: **A** for Phase 01; it is honest, deterministic, compatible with the current model, and avoids inventing timing the harmony model cannot represent.
- **OD-3 — Apply candidate BPM.** Superseded UI resolution: the BPM slider value is part of the candidate and is applied only at confirmed replacement. Releasing the slider at a value is the explicit tempo choice, so no independent checkbox is shown.
- **OD-4 — Detected key versus the current scale UI.** Candidates: A) show detected key as a reference and use it for suggestions, but do not change `selectedScale`; B) extend the scale selector to arbitrary roots in this phase; C) ignore detected key completely. Recommendation: **A**; B expands the product surface beyond capture and C discards useful prototype output.
- **OD-5 — Evidence for state isolation and confirmed replacement.** Candidates: A) keep the no-new-dependency rule and amend A-05/A-06 validation from `integration` to `manual`, backed by pure candidate unit tests and explicit HTTPS device evidence; B) approve a React Native component/E2E test dependency and expand scope. Recommendation: **A**.

## Source-of-truth check

- **Prototype producer source**: `melody-lab.html` `arm()` (line 317), `yin()` (432), `decimate2()` (460), `rawTrack()` (466), `fold()` (484), `runAnalysis()` (611), `finishAnalysis()` (658), `segmentNotes()` (705), `detectKey()` (765), `detectTempo()` (822), and `quantize()` (880). These produce monophonic notes, key, tempo, repetition, and a quantized melody; they do not produce chord qualities.
- **Current app model producer/source**: `createFiniteTonnetz()` in `packages/music-core/src/finite-tonnetz.ts` publishes every supported root/quality face; `createHarmonySequenceEntry()` in `packages/music-core/src/harmony-sequence.ts` publishes the sequence entry shape; `HARMONY_DURATION_STEPS` in `packages/music-core/src/harmony-duration.ts` publishes valid durations.
- **Consumer code**: planned `packages/music-core/src/harmony-capture.ts` will resolve candidate roots/qualities against `createFiniteTonnetz()` and return entries compatible with `HarmonySequenceEntry`; `src/app/index.tsx` will consume them only for candidate preview and confirmed replacement.
- **Shape alignment**: roots are normalized to pitch classes 0–11; qualities are constrained to `maj|min`; durations are constrained to `HarmonyDuration`; results are capped at `MAX_SEQUENCE_LENGTH = 16`. No prototype field is copied into live state without translation.

There is no backend, remote API, uploaded audio, persistence schema, or cross-repository runtime data consumption.

## New dependencies needed

None. Options requiring a component-test framework or third-party polyphonic/chroma detector are excluded unless the Pilot reverses the no-new-dependency constraint.

## Environment, CI, build, or deployment changes needed

- No CI, deployment, manifest, or build configuration change.
- Operability requires using the repository's existing Expo HTTPS/tunnel capability on a real phone. The exact command and secure URL will be recorded during step 01.5; no new runtime env variable is planned.

## Decisions Register check

- `docs/mobile-play/decisions.md` has no vigent entries.
- The product brief and `AGENTS.md` remain binding: independent mobile architecture, pure music engines, current transport clock, explicit Stop, mobile visual checks, AGPL lineage, and exact dependencies.
- Candidate future Register entry for Pilot consideration after OD resolution: “Harmony microphone capture is monophonic root-sequence capture; qualities are editable tonal suggestions, not detected chords.”

## Project-specific verification tables

No backend contract, flag-off request, or backend-derived fixture tables apply.

Prototype parity is required for the pure functions actually ported. Each corresponding test must cite the `melody-lab.html` function and fixture behavior; deliberate deviations are:

- no desktop lab/calibration controls in the mobile UI;
- no polyphonic chord claim;
- no prototype `setcpm`;
- no direct sixteenth-note melody output;
- translation only into existing Orbifold Play faces and durations.

## Pilot review

The Pilot approved the inventory on 2026-07-27. Step 01.2 remains gated by
Checkpoint #2 approval of ADR 0030, which records the model semantics resolved
below.

## Pilot resolutions

- **OD-1 → A.** Use the capture-detected key/mode for editable quality
  suggestions. Major/minor diatonic triads map directly; diminished falls back
  to minor and augmented falls back to major to preserve the detected third.
  Copy must identify every quality as a suggestion, never as a detected chord.
- **OD-2 → A with B for clear extensions.** Every accepted root defaults safely
  to 1 bar. A root may be promoted to 2, 3, or 4 bars when its repeated,
  quantized duration is consistently longer than the phrase's typical root
  duration. The deterministic promotion and fallback thresholds are specified
  in ADR 0030. Automatic ½-bar assignment is excluded; the player may select
  ½ bar manually in review.
- **OD-3 → A, UI refinement.** Candidate BPM mutates the live app only at
  confirmed replacement. The slider itself is the explicit tempo choice and no
  independent application checkbox is shown.
- **OD-4 → A.** Detected key is a reference and suggestion input only. It does
  not change `selectedScale`.
- **OD-5 → A.** No component/E2E dependency is added. State isolation and
  explicit replacement use pure candidate unit tests plus explicit HTTPS
  mobile evidence; A-05 and A-06 use `manual` validation.
