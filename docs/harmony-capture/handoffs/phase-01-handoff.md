# Phase 01 Handoff — Guided Mobile Harmony Capture

## Step 01.2 — Pure monophonic capture analysis and editable result model

**Date:** 2026-07-27  
**Status:** Implementation complete; reviewable uncommitted work because the
Pilot has not authorized commit/stage operations.

### What changed

- Added `packages/music-core/src/harmony-capture.ts` with:
  - dependency-free YIN f0 estimation over browser-compatible PCM array data;
  - pure voiced-frame segmentation with local octave-error correction;
  - duration-weighted key inference;
  - repetition folding into at most 16 finite Tonnetz faces;
  - ADR 0030 quality suggestions and conservative 1–4 bar duration promotion;
  - immutable root, quality, duration, removal, and BPM edits.
- Added `packages/music-core/src/harmony-capture.test.ts` with nine
  deterministic tests.
- Ratified ADR 0030 after Pilot Checkpoint #2 approval.

### Prototype parity

- `estimateYinPitch()` cites and follows `melody-lab.html` `yin()` (line 432):
  squared difference, cumulative mean normalized difference, threshold valley,
  fallback minimum, and parabolic refinement.
- `segmentPitchFrames()` cites and follows `segmentNotes()` (line 705):
  voiced threshold, running-median pitch jump, minimum frames/duration, and
  median pitch.
- `inferHarmonyKey()` retains the duration-weighted pitch-class principle from
  `detectKey()` (line 765).
- `analyzeHarmonyCapture()` retains the repeated phrase position/vote/median
  length behavior from `fold()` (line 484) and `quantize()` (line 880).
- Intentional deviations are governed by ADR 0030: roots replace melody tokens,
  quality is suggested rather than detected, duration is relative harmony time,
  and prototype `setcpm` is absent.

### Validation

- `pnpm exec vitest run packages/music-core/src/harmony-capture.test.ts`
  → 1 file passed, 9 tests passed.
- `pnpm typecheck` → passed.
- No dependency, platform, UI, persistence, build, desktop-repository, stage,
  commit, push, PR, or merge operation occurred.

### Acceptance Coverage

| Acceptance ID | Required behavior | Test file | Test type | Gap status |
|---|---|---|---|---|
| A-02 | Repeated roots produce deterministic prototype-cited pitch, segmentation, key, vote, and duration results | `packages/music-core/src/harmony-capture.test.ts` | unit | covered |
| A-03 | Candidate output uses finite `maj|min` faces, supported durations, and the configured entry cap | `packages/music-core/src/harmony-capture.test.ts` | unit | covered |
| A-04 | Root, quality, duration, removal, and BPM edits return a new candidate suitable for active-preview rebuilding | `packages/music-core/src/harmony-capture.test.ts` | unit | partial — UI active-preview wiring is step 01.4 |
| A-10 | Existing behavior remains unchanged when capture is inactive | targeted test + `pnpm typecheck` | integration | partial — full `pnpm test` runs in steps 01.4–01.5 |

### Pending review constraint

The methodology's commit-message and committed-diff checklist items cannot be
evaluated until the Pilot explicitly authorizes a commit. Source scope,
acceptance mapping, targeted tests, prototype citations, no-dependency rule,
and pure-module boundaries are available for review now.

## Step 01.3 — Web microphone acquisition and native limitation

**Date:** 2026-07-27  
**Status:** Implementation complete as uncommitted work.

### What changed

- Added the platform-resolved `harmony-capture` audio module.
- Web requires a secure context, requests raw microphone constraints after a
  gesture, calibrates for two seconds, uses a neutral three-second countdown,
  captures for twelve seconds, reports level/pitch/progress, and delegates all
  musical semantics to `packages/music-core`.
- Abort/error/success paths disconnect nodes, stop every media track, and close
  the AudioContext in `finally`.
- Native rejects explicitly that capture is currently mobile-web-only.

### Validation

- `pnpm typecheck` → passed.
- `pnpm lint` → passed.
- Static cleanup inspection confirms `onaudioprocess` removal, node
  disconnection, track stop, and AudioContext close share the `finally` path.

### Acceptance Coverage

| Acceptance ID | Required behavior | Test file | Test type | Gap status |
|---|---|---|---|---|
| A-01 | Adapter reports permission, calibration, countdown, recording, and analyzing phases | `packages/audio/src/harmony-capture.web.ts` | proxy:static-analysis | partial — real gesture/microphone evidence is step 01.5 |
| A-07 | HTTPS, unavailable microphone, insufficient notes, analysis failure, and native limitation have stable outcomes | platform adapter sources | proxy:static-analysis | partial — user-facing copy and real-device evidence are steps 01.4–01.5 |
| A-10 | New platform modules preserve current builds and strict types | `pnpm typecheck`, `pnpm lint` | integration | partial — full suite/build remain |

## Step 01.4 — Mobile review, preview, and explicit replacement

**Date:** 2026-07-27  
**Status:** Implementation complete as uncommitted work.

### What changed

- Added a Harmony-view microphone entry point and a full-screen,
  safe-area-contained `HarmonyCaptureDialog`.
- Added explicit intro, permission, calibration, neutral-countdown, recording,
  analysis, editable-result, second-confirmation, and recoverable-error states.
- The result editor supports root, suggested `maj|min` quality, ½/1/2/3/4-bar
  duration, deletion, BPM adjustment, and record again. The slider value is the
  candidate tempo applied only after confirmation; there is no redundant BPM
  opt-out control.
- Tapping any piano-roll cell selects its column without mutating pitch. Root,
  quality, duration, and removal live in a Reactix-derived Bottom Sheet with
  swipe-down and backdrop dismissal, preserving the compact control design
  without covering or compressing the piano roll.
- Candidate preview uses existing harmony codegen and Strudel playback. Every
  root, quality, duration, removal, or BPM edit rebuilds an active preview.
- Apply maps only the confirmed candidate to the existing
  `HarmonySequenceEntry` contract. It does not change `selectedScale` or any
  rhythm layer.
- Generalized the existing tempo slider and preview button accessibility labels
  without changing their rhythm-capture defaults.
- Added explicit roles, states, labels, and minimum 44-point targets to dialog
  actions and editor controls.

### Validation

- `pnpm typecheck` → passed.
- `pnpm lint` → passed.
- `pnpm test` → 12 files passed, 51 tests passed.
- `pnpm build:web` → passed; Expo exported `dist`.
- In-app responsive inspection at 320×568 and 390×844 → intro copy and
  `USE MICROPHONE` remained fully visible without document overflow; the
  Harmony microphone opened the dialog and reached `WAITING FOR MICROPHONE`.
- `git diff --check` → passed.

### Acceptance Coverage

| Acceptance ID | Required behavior | Evidence | Test type | Gap status |
|---|---|---|---|---|
| A-01 | Guided Harmony entry and all capture states | dialog source + local mobile-browser interaction | proxy:manual | partial — grant/record on a physical HTTPS phone remains |
| A-04 | Editable candidate and live preview rebuild | immutable unit tests + dialog callback wiring | unit + proxy:static-analysis | covered in code; physical audio observation remains |
| A-05 | Candidate-only preview and explicit Pause/Stop | candidate-only codegen + dialog-local preview state | proxy:static-analysis | covered in code; physical audio observation remains |
| A-06 | Second confirmation before replacement | result → confirmation → `onApply` wiring | proxy:manual | covered in local UI; cancel with a physical flow remains |
| A-08 | 320×568 and 390×844 usability | responsive browser inspection | manual | covered for intro; populated-result overflow remains physical/manual |
| A-09 | No polyphonic quality claim | intro/result copy and `qualitySource: suggested` | static-analysis | covered |
| A-10 | Existing behavior stays green | full typecheck/lint/test/build | integration | covered |

## Step 01.5 — HTTPS mobile operability and phase evidence

**Date:** 2026-07-27  
**Status:** Partially validated; physical-device HTTPS capture remains an
explicit pre-merge gate.

### Evidence completed

- Repeated the required repository preflight in
  `/Users/virtualmachine/Development/personal/orbifold-play` on
  `harmony-capture/phase-01`.
- Ran the complete quality suite successfully:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test` (51/51)
  - `pnpm build:web`
- Served the Expo web application locally and inspected effective 320×568 and
  390×844 browser viewports.
- Verified the microphone action is a user gesture and advances to the
  permission state.
- Verified the native adapter returns the intentional mobile-web-only
  limitation.
- The temporary Expo server modified `tsconfig.json` formatting automatically;
  that known generated change was restored, and `tsconfig.json` has no diff.

### Remaining pre-merge gate

No physical phone and externally reachable HTTPS origin were attached to this
Codex session. Therefore this handoff does **not** claim A-11 or the real-audio
parts of A-01/A-04/A-05/A-06/A-07/A-08. Before merge review, open a secure Expo
web URL on a phone and exercise permission grant/denial, room calibration,
countdown, successful and insufficient capture, populated-result scrolling,
edits during preview, Pause, record again, cancel, confirmed replacement, and
microphone/preview cleanup.

### Source-control constraint

No stage, commit, push, PR, merge, dependency addition, persistence, upload, or
desktop-repository operation occurred. Commit review remains pending explicit
Pilot authorization.
