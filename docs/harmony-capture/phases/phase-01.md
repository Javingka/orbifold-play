# Phase 01 — Guided Mobile Harmony Capture

**Purpose:** Add a mobile-first microphone workflow that turns a repeated monophonic root phrase into a reviewable major/minor chord sequence without changing the current harmony until explicit confirmation.
**Gate:** The Pilot approved the guided root-sequence UX option; step 01.1 must inventory the current harmony/rhythm-capture contracts and resolve its open model-semantic decisions before implementation begins.
**Expected phase result:** A mobile-web player can capture roots through the microphone, review and edit a compatible Orbifold Play progression, audition every edit, and explicitly replace the current harmony, while native builds communicate that capture is not yet supported.

---

## Step 01.1 — Inventory capture and harmony contracts

PROMPT → Read the approved prototype, the complete rhythm-capture integration, current harmony sequence/codegen/transport contracts, mobile layout constraints, and relevant project decisions; produce `docs/harmony-capture/inventories/phase-01-inventory.md`, surface every model-semantic decision required by steps 01.2–01.4, and STOP without implementing source code.

Implementation requirements:
- Cite the relevant `melody-lab.html` functions and distinguish portable monophonic behavior from unsupported polyphonic chord recognition.
- Map every planned source/test file and preserve the current `maj|min`, 16-entry, duration, transport, scale, and explicit-stop contracts.
- Resolve no open decision silently; in particular inventory quality suggestion, captured timing-to-duration reduction, detected BPM application, and arbitrary detected-key interaction with the current C-rooted scale UI.
- Confirm that no dependency, persistence, backend, upload, or desktop-repository change is needed.

Validation:
- Compare the inventory against the phase Acceptance IDs and the inventory template.
- Confirm `git diff --check` and that no source file changed in this step.

Expected result:
- A reviewable inventory with an Acceptance coverage plan and explicit decisions for Pilot resolution before step 01.2.

CHECKPOINT → Intended commit message, only if the Pilot later authorizes a commit:
`docs(harmony-capture): Phase 01 step 01.1 — inventory guided root capture`

---

## Step 01.2 — Pure monophonic capture analysis and editable result model

PROMPT → Implement the approved, deterministic harmony-capture analysis in `packages/music-core` from PCM-derived pitch frames or another renderer/audio-independent input, porting only the justified `melody-lab.html` behavior and translating its repeated monophonic root phrase into Orbifold Play-compatible editable chord entries.

Implementation requirements:
- Keep the module free of React, DOM, Expo, Skia, Web Audio, timers, and platform imports.
- Port with source citations and parity fixtures the approved subset of YIN/f0 estimation, octave correction, note segmentation, key/tempo estimation, repetition voting, and quantization.
- Represent only roots and supported `maj|min` qualities; never label polyphonic chord quality as microphone-detected.
- Default every captured root to one bar, then promote it conservatively to 2, 3, or 4 bars only under ADR 0030's repeated-duration consistency contract; keep ½ bar available only as a manual review edit.
- Enforce the current maximum sequence length and `HarmonyDuration` values without widening the existing music model.
- Provide pure immutable edits for root, quality, duration, removal, and explicit BPM adjustment so an active preview can be rebuilt from the new value.
- Add deterministic synthetic-signal and translation tests covering silence, insufficient notes, octave errors, repeated motifs, caps, supported qualities/durations, and prototype parity.
- Preserve SPDX/AGPL headers and add no dependency.

Validation:
- `pnpm exec vitest run packages/music-core/src/harmony-capture.test.ts`
- `pnpm typecheck`

Expected result:
- A pure, tested analysis/result contract that produces only sequences Orbifold Play can already play and edit.

CHECKPOINT → Intended commit message, only if the Pilot later authorizes a commit:
`feat(harmony-capture): Phase 01 step 01.2 — add pure root phrase analysis`

---

## Step 01.3 — Web microphone acquisition and native limitation

PROMPT → Add platform-isolated harmony-capture adapters in `packages/audio`, mirroring the lifecycle and error contract of rhythm capture while passing captured signal data into the pure step 01.2 analyzer.

Implementation requirements:
- Implement `harmony-capture.web.ts`, `harmony-capture.native.ts`, and the platform-resolution export without importing UI components into the adapter.
- Require a secure web context, request microphone access only after a user gesture, disable browser audio processing where supported, calibrate room noise, provide a neutral countdown, report recording/analysis progress, honor cancellation, stop every media track, disconnect nodes, and close the audio context in all exit paths.
- Return stable error codes for unavailable microphone, HTTPS requirement, denied permission, insufficient voiced material, and analysis failure.
- The native adapter must reject with a clear supported-product limitation and must not silently use Web Audio.
- Do not upload, persist, or log captured audio.
- Add no dependency and preserve SPDX/AGPL headers.

Validation:
- `pnpm typecheck`
- `pnpm lint`
- Static platform-resolution and cleanup-path inspection recorded in the handoff.

Expected result:
- Web capture safely feeds the pure analyzer; native callers receive an intentional unsupported result.

CHECKPOINT → Intended commit message, only if the Pilot later authorizes a commit:
`feat(harmony-capture): Phase 01 step 01.3 — add microphone platform adapters`

---

## Step 01.4 — Mobile review, preview, and explicit replacement

PROMPT → Integrate a full-screen Harmony Capture dialog and Harmony-view microphone entry point using the rhythm-capture interaction architecture, current harmony sequence model, and existing Strudel transport.

Implementation requirements:
- Stop current playback before recording and keep microphone capture unavailable behind any non-Harmony surface.
- Use explicit states for intro, permission, calibration, countdown, recording, analysis, result, confirmation, and recoverable error.
- Explain that the player should sing, whistle, or play one root note per intended chord and repeat the phrase; do not claim direct chord recognition.
- Show a compact result editor supporting root, `maj|min` quality, supported duration, deletion, record-again, and a detected-BPM reference. Tapping a piano-roll column selects it without changing its root; editing occurs in a Reactix-derived Bottom Sheet so the piano roll keeps its full width and remains visually understandable.
- Treat the BPM slider value as part of the candidate. Releasing it at a value means that value will be applied on confirmation; do not add a redundant tempo-application checkbox.
- Reuse or generalize the existing touch-first tempo/preview controls without regressing rhythm-capture accessibility labels or behavior.
- Preview only the candidate harmony through the current harmony sound/codegen; do not mutate the current `sequence`, selected chord, scale, or rhythm.
- Root, quality, duration, removal, and BPM edits must immediately restart/retime an active preview from the edited candidate.
- Closing, recording again, applying, or encountering an error must clearly stop preview and release capture resources.
- Require a second explicit confirmation before replacing the current harmony; cancel leaves the current harmony byte-for-byte unchanged.
- Keep primary preview/Stop and Use actions reachable at 320×568 and 390×844 with safe-area support, accessible roles/states/labels, minimum touch targets, and reduced-motion compatibility.
- Add no dependency and preserve SPDX/AGPL headers.

Validation:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build:web`
- Manual layout/accessibility checks at 320×568 and 390×844.

Expected result:
- Harmony capture feels native to Orbifold Play, remains fully reversible until confirmation, and never obscures how to stop preview.

CHECKPOINT → Intended commit message, only if the Pilot later authorizes a commit:
`feat(harmony-capture): Phase 01 step 01.4 — integrate mobile capture review`

---

## Step 01.5 — HTTPS mobile operability and phase evidence

PROMPT → Validate the complete workflow on a real mobile browser through HTTPS, verify the intentional native limitation, run the full quality suite, and finalize the phase handoff with prototype citations and Acceptance Coverage evidence; do not commit, push, open a PR, or merge without separate Pilot authorization.

Implementation requirements:
- Exercise permission grant and denial, calibration, countdown, successful capture, insufficient-material retry, candidate editing, active-preview updates, Pause/Stop, record again, cancel, and confirmed replacement.
- Verify that existing harmony and rhythm playback remain unchanged outside the new dialog.
- Verify microphone tracks and preview audio stop after close, retry, error, and apply.
- Record device/browser, secure URL mechanism, commands, observations, and any remaining manual-only gaps in the handoff.
- Confirm native displays its intentional unsupported message.

Validation:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build:web`
- HTTPS mobile checks at effective 320×568 and 390×844 layouts.

Expected result:
- The phase has reproducible quality-suite evidence and real secure-device operability evidence suitable for Pilot merge review.

CHECKPOINT → Intended commit message, only if the Pilot later authorizes a commit:
`test(harmony-capture): Phase 01 step 01.5 — verify HTTPS mobile operability`

---

## Phase Acceptance

- **A-01** — A Harmony-view player can start a clearly described monophonic root capture after a user gesture and follow permission, calibration, countdown, recording, and analysis states.
  - Validation method: `manual`
- **A-02** — Repeated synthetic and recorded root phrases produce deterministic ordered results with prototype-cited pitch, segmentation, tempo, and repetition behavior.
  - Validation method: `unit`
- **A-03** — The result editor exposes only playable Orbifold Play roots, `maj|min` qualities, supported durations, and at most 16 entries.
  - Validation method: `unit`
- **A-04** — The player can edit root, quality, duration, sequence membership, and BPM before applying, and every edit updates an active preview.
  - Validation method: `manual`
- **A-05** — Candidate preview has an immediately reachable Pause/Stop and never mutates the current harmony, scale, rhythm, or selected chord.
  - Validation method: `manual`
- **A-06** — Current harmony is replaced only after a second explicit confirmation; cancel, close, error, and record-again preserve it.
  - Validation method: `manual`
- **A-07** — Web communicates HTTPS, permission, and insufficient-signal failures clearly; native communicates that harmony capture is currently web-only.
  - Validation method: `manual`
- **A-08** — The dialog remains usable and its primary actions remain visible/reachable at 320×568 and 390×844 with accessible labels, states, and touch targets.
  - Validation method: `manual`
- **A-09** — The product never claims to detect chord quality from the monophonic microphone analysis and identifies inferred/suggested qualities as editable suggestions.
  - Validation method: `manual`
- **A-10** — Existing Harmony, Rhythm, transport, rhythm capture, and codegen behavior pass the full regression suite unchanged when harmony capture is not active.
  - Validation method: `integration`
- **A-11** — From a clean install/build, an operator can serve Orbifold Play through HTTPS on a phone, complete capture → edit → preview → confirm, and stop all audio.
  - Validation method: `operability`

## Operability requirements

- **Boot commands**: `pnpm install` when dependencies are absent, then the repository's documented Expo web HTTPS/tunnel command → Orbifold Play loads on a phone with a secure origin and working microphone permission.
- **Required data**: No fixtures, accounts, persistence, or backend data; the player supplies a repeated root phrase.
- **Required env vars / flags**: No new product env vars or feature flags; the secure mobile URL mechanism must be documented in the handoff.
- **Smoke checks**: Run the complete capture → review/edit → preview/Pause → confirm flow and verify cancel leaves an existing progression unchanged.
- **Idempotency**: Repeating capture, closing/reopening the dialog, and rebuilding web must not leave microphone tracks, preview audio, or mutated candidate state behind.

## Partial coverage from prior phase (if any)

No prior harmony-capture phase or partial coverage exists.

## ADR Triggers

- **Root-to-quality suggestion semantics** — Triggered by the Pilot's OD-1 resolution; recorded in ADR 0030 before step 01.2.
- **Captured timing reduction** — Triggered by the Pilot's hybrid OD-2 resolution; recorded in ADR 0030 before step 01.2.
- **Capture analysis contract** — Trigger: step 01.2 requires thresholds, defaults, confidence meaning, or fallback behavior not directly justified by prototype parity and synthetic fixtures.

## Handoff Note

At the end of this phase, the Dev appends per-step entries and a phase-completion entry to `docs/harmony-capture/handoffs/phase-01-handoff.md`. See `handoff-template.md`.
