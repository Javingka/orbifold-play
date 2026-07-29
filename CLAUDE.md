# CLAUDE.md

This file is the project-specific layer of the Pilot+Planner+Machine methodology. It overrides defaults from the methodology skill where needed and provides project-specific context.

## About this project

Orbifold Play is the independent mobile-first Expo + React Native instrument
defined by [`ORBIFOLD_PLAY_BRIEF.md`](ORBIFOLD_PLAY_BRIEF.md). It may consult the
classic Orbifold desktop implementation and prototypes as porting references for
tested music theory and Strudel behavior, but it does not share the desktop
application's UI architecture, initiative state, branches, or implementation
scope.

Repository boundary: work for Orbifold Play stays inside this repository. Never
modify, combine, or treat the separate Orbifold desktop repository as the active
project.

## Methodology

This project follows the **Pilot + Planner + Machine** methodology, encoded as the `pilot-machine` skill.

The skill activates automatically based on triggers (phase prompts, phase NN, inventory steps, handoffs, blockers, ADRs). For full doctrine, see `references/methodology.md`.

The Planner has two sub-modes: scoping (writing the next phase) and review (judging each step against the Pilot Review Checklist). After APPROVE, the Dev auto-continues to the next step.

Planner and Dev run as **isolated subagents** (`.claude/agents/planner.md`, `.claude/agents/dev.md`). Hooks in `.claude/hooks/` notify/pause at the five Pilot checkpoints.

## Current initiative

**None active — awaiting Pilot scoping.** `harmony-capture` and
`rhythm-capture` are both complete through Phase 02 as of 2026-07-29 (see
below). No phase file exists past `phase-02` for either; the Dev must write a
`phase-missing` blocker rather than invent scope if asked to continue either
initiative without a new phase file.

**Deferred items available for next initiative:**

- Neural pitch tracking (CREPE/SPICE/RMVPE/SwiftF0-class) as an optional
  upgrade to the pYIN estimation stage — deferred from harmony-capture Phase
  02 (OD-13); requires a new pinned inference-runtime dependency and a
  multi-MB model download, a Pilot decision.
- Per-band multi-lane onset splitting (a coincident kick+hat currently merges
  into one classified onset) — deferred from rhythm-capture Phase 02 (OD-R3).
- Per-chord `lpf`/`lpq` direct user slider (D-3) — deferred from harmonic-rhythm-improvements Phase 01 triage.
- Custom sample hosting for 10 remaining sampleMap fallbacks — deferred from authentic-groove.
- Agent `notes` schema extension (NoteSlot support for autopilot/agent) — deferred from note-placement Phase 01 (OD-3 = Option B).

**Previous initiatives:**

- `harmony-capture` (Phases 01–02, **complete, merged to `main` 2026-07-29**) —
  guided mobile microphone capture of a repeated monophonic root phrase into a
  reviewable/editable major/minor chord progression. Phase 01: capture UX,
  pure prototype-parity YIN analysis (`packages/music-core/src/
  harmony-capture.ts`), web/native adapters, full dialog with preview/confirm
  (ADR 0030; see phase-01 handoff for that phase's exact test count). Phase 02
  (**Pilot-directed quality overhaul** — Phase 01 detection
  was unacceptable in real use): replaced the single-threshold YIN estimator
  with a dependency-free **pYIN** engine (`packages/music-core/src/pyin.ts`) —
  FFT-accelerated YIN difference/CMND, Beta(2,18)-prior multi-threshold
  candidates, Boltzmann(2) trough weighting, banded Viterbi decoding over
  1/5-semitone voiced/unvoiced states (librosa-validated parameters) — plus
  onset-aware note segmentation, and moved web acquisition from a main-thread
  `ScriptProcessorNode` to an **AudioWorklet** (fallback preserved). ADR 0031
  (Accepted): the estimation stage intentionally cites the pYIN paper/librosa
  instead of `melody-lab.html` parity (OD-12); prior estimator exports and
  tests remain. Confirmed working on a physical device. Docs:
  `docs/harmony-capture/`.

- `rhythm-capture` (Phase 01 + Phase 02, **complete, merged to `main`
  2026-07-29**) — guided mobile beatbox/tap capture of a repeated groove into
  a reviewable/editable 3-lane (`pulse`/`click`/`air`) pattern. Phase 01
  (merged earlier via PR #1): prototype-parity live onset detection ported
  from `beatbox-lab_7.html`, tempo/vote/quantize engine
  (`packages/music-core/src/rhythm-capture.ts`), capture dialog. Phase 02
  (same Pilot-directed overhaul as harmony-capture, applying the same
  learnings — see `docs/rhythm-capture/evaluation-harmony-learnings.md`):
  replaced the live `ScriptProcessorNode` envelope state machine + per-frame
  `AnalyserNode` classification with an **offline** engine
  (`packages/music-core/src/onset-detection.ts`) — Hann-windowed STFT,
  **multiband spectral-flux novelty** (Dixon 2006 full-band flux + a
  normalized low-band term so kick onsets survive the full-band bass bias),
  **adaptive peak-picking** (Böck et al. 2012), and offline lane
  classification at the attack peak reusing the prototype's calibrated
  cutoffs (bdCut 1300 Hz, hhCut 4600 Hz, ZCR 0.15/0.35). Web acquisition moved
  to AudioWorklet (fallback preserved); the realtime callback is now a level
  meter plus one feedback flash only. The tempo/vote/quantize stage
  (`analyzeRhythmCapture`) is unchanged and keeps its `beatbox-lab_7.html`
  parity. Extracted the shared `packages/music-core/src/fft.ts` (used by both
  pYIN and the onset engine) from `pyin.ts`, no behavior change. ADR 0032
  (Accepted): detection-stage parity departure (OD-R1), cites Dixon
  2006/Böck 2012 instead of the prototype's live detector. Confirmed working
  on a physical device. Docs: `docs/rhythm-capture/`. (`pnpm test` across
  `packages/**` — the pure-engine suite covering both initiatives — stood at
  73 tests / 14 files as of this merge.)

- `song-import` (Phases 01–04, **complete, merged to `main` 2026-07-16**) — interpret real music: given a song (name/link — audio-file and Pipeline-A DSP ingestion deferred), extract its rhythm/harmony and build a representative Session. Phase 01: data-model foundation (`pow` quality end-to-end, `Block.label`, schema v7; OD-1/OD-2; 2104 tests). Phase 02: `importSession` pure translator (structured chart → `SavedSession`; OD-3 Option A input contract; ADR 0026; 2129 tests). Phase 03: user-facing ingestion surface (`applyImportSession` OD-6/ADR 0027, `ImportSong.svelte`, `sendImport`/`IMPORT_SYSTEM_PROMPT` OD-4/ADR 0028; re-scoped for OD-7 per-section rhythmic signatures, `IMPORT_SCHEMA_VERSION` 1→2; 2178 tests). Phase 04: closing polish — `setChordQuality()` + Header quality control maj/min/dim/aug/pow (OD-8/OD-9); latency-offset recalibration folding Strudel's `Cyclist.latency` scheduler lookahead into the auto-measured playhead offset (OD-10, ADR 0029 — reduces, does not eliminate, the see/hear gap; progressive drift stays deferred); 2186 tests. Checkpoint #5 (2026-07-16): ADR 0029 ratified; `tonnetz-scene.ts` `_lastPick` staleness bug fixed as a fast-follow (OD-11, not deferred); merged to `main` via merge commit. OD-5 (YouTube-link oEmbed resolution) remains deferred to a future initiative. Docs: `docs/song-import/`.

- `note-placement` (Phase 01, complete, branch `note-placement/phase-01`, merged to `main` at `abf213d`) — `NoteSlot` third slot type (`Chord | RestSlot | NoteSlot`), `SESSION_SCHEMA_VERSION` → 6, codegen `note("C4").s("triangle")…` via `resolveChordAttrs`, Tonnetz vertex click → note (spatial hit-test, no toggle), Pentagrama `pNote` paint + pitch-offset overlay, timbre attributes (`instrument`/`preset`/`gain`/`room`/`decay`/`attack`/`lpf`), floating sound panel on chord slots, unified sound selector in Header; 2069 tests. Docs: `docs/note-placement/`.

- `authentic-groove` (Phases 01–09 + post-09 fixes, **complete**, merged `main` 2026-06-26) — genre-authentic sample palette (ADR 0025), multi-layer locked recipes, native step counts, velocity accents, swing/humanization, 16-sound palette, StepEditor, orbit sound switcher, euclid preview widget; 2020 tests. Docs: `docs/authentic-groove/`.
- `ai-jam` (Phases 01 + 06–07, complete, merged `main` 2026-06-22) — autopilot LLM evolution loop, batched plan consumption (ADR 0024), harmony preset chips, waiting message; ADRs 0022–0024; 1589 tests.
- `ai-composition-authoring` (Phase 01, complete, merged `main` 2026-06-18) — agent `saveAsBlock` skill; ADR 0021; 732 tests.
- `editable-composition` (Phase 01, complete, merged `main` 2026-06-18) — Block-as-State foundation; ADR 0020; 682 tests.
- `harmonic-rhythm-improvements` (Phases 01–03, complete, merged `main` 2026-06-18) — oscillator/presets/chord sound; ADRs 0018–0019.
- Prior: `orbifold-v2` (Phases 01–11) in `docs/orbifold-v2/`; `orbifold-v1` (Phases 0–8) in `docs/orbifold-v1/`.

## Project-specific conventions

### Stack (confirmed for Orbifold Play)

- **Build/dev:** Expo + React Native Web/PWA
- **Language:** TypeScript (`strict`)
- **UI:** React Native
- **Graphics:** React Native Skia
- **Interaction:** React Native Reanimated + Expo Blur/Haptics
- **Audio:** Strudel (`@strudel/web`, pinned) behind platform adapters
- **Tests:** Vitest for pure engines
- **Quality:** ESLint + TypeScript
- **Package manager:** pnpm with exact dependency versions

### Branch and commit

- Main branch: `main`
- Initiative branch pattern: `<initiative-name>/phase-NN` (prior: `harmony-capture/phase-NN`, `rhythm-capture/phase-NN`, `song-import/phase-NN`, `note-placement/phase-NN`, `authentic-groove/phase-NN`, `ai-jam/phase-NN`, `ai-composition-authoring/phase-NN`, `editable-composition/phase-NN`, `harmonic-rhythm-improvements/phase-NN`, `orbifold-v2/phase-NN`)
- Commit format: `<type>(<scope>): Phase NN step NN.N — <description>` (types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`)
- PR convention: one PR (or one merge commit) per phase, with its acceptance criteria verified, without breaking prior phases.

### Spec location

Specs are the phase files in `docs/<initiative>/phases/phase-NN.md`. The master brief is `ORBIFOLD_KICKOFF.md` (architecture, domain model, invariants). Initiative specs: `docs/harmony-capture/phases/`, `docs/rhythm-capture/phases/`, `docs/song-import/phases/`, `docs/note-placement/phases/`, `docs/authentic-groove/phases/`, `docs/ai-jam/phases/`, `docs/ai-composition-authoring/phases/`, `docs/harmonic-rhythm-improvements/phases/`, `docs/orbifold-v2/phases/`, and `docs/orbifold-v1/phases/`.

### Test commands

- Run all tests: `pnpm test`
- Run a specific test: `pnpm exec vitest run <pattern>`
- Run lint: `pnpm lint`
- Run typecheck: `pnpm exec tsc --noEmit`
- Build: `pnpm build`
- Dev server: `pnpm dev`

These are referenced by phase files in their Validation sections. (Until Phase 0 scaffolds `package.json`, these scripts do not yet exist — Phase 0 creates them and its operability criterion is that all of them pass clean.)

## Project-specific guardrails

These are hard invariants from `ORBIFOLD_KICKOFF.md` §6. Do NOT break them; a step that would requires a Pilot decision (surface it).

**Musical / engine**
- 1 Strudel cycle = 1 bar of 4/4. Tempo is set by the app via the global clock — **`setcps`** (`bpm/240` for 4/4) — emitted into the re-evaluated pattern header. **Never** use `.fast`/`.slow` for tempo (they time-stretch patterns and break the geometry/voice-leading timing). BPM changes by re-evaluating. **Note:** `setcpm` does NOT exist in the pinned `@strudel/web@1.0.3` (only `setcps`/`setbpm` are registered); the original prototype's tempo control was a latent no-op bug. Phase 2 fixes it via `setcps` to meet the kickoff §8 / A-02-05 acceptance. See ADR 0005. (Supersedes the original "setcpm only" invariant from kickoff §6.)
- Tonnetz: `pc(i,j) = (7i + 4j) mod 12`. ▲ = major triad, ▼ = minor.
- P·L·R = the three triads sharing an edge with the current one (two common tones, one voice moves 1–2 semitones).
- Minimal voice-leading = shortest path in the orbifold (sum signed `circDelta`, pick the permutation with the smallest Σ).
- Chords: commas = block, spaces = arpeggio. Per-chord volume via `.gain("<g1 g2 …>")` aligned to the sequence.
- Composition: tracks → `stack(...)` (sound together); blocks in a track → `arrange([bars, code], …)`; pad shorter tracks with `silence` so they realign.
- The agent may only generate what the UI supports (kickoff §7); live changes re-queue to the **next cycle**.

**Code**
- TS `strict`. Engines in `core/**` have NO DOM/PIXI/Svelte imports → unit-testable.
- Audio starts only after a user gesture; feature-detect WebGL and degrade with a clear message.
- No keys/API in the repo. Agent tokens: per-user, in `localStorage` (or a future serverless proxy).
- Keep the **AGPL-3.0** header/license (inherited from Strudel).

**Product / UX**
- Always make it obvious **what is playing** and how to stop it (clear transport: Rhythm / Harmony / Session / Composition / preview).
- Pedagogical: live code drawer, tooltips on key terms (E(k,n), rot…), color legend, P·L·R legend.
- Tonal-function colors: tonic `#f3b15a`, subdominant `#56cfc4`, dominant `#e87bac`, accent `#8aa0ff`.

**Live sources — do not assume from memory.** When unsure of a Strudel or PIXI API, consult current docs before asserting: Strudel `https://strudel.cc/learn/` · PixiJS `https://pixijs.com/8.x/` · Web Audio MDN.

## Project-specific checklist additions

The base Pilot Review Checklist has 8 items. Additions for this project:

### Prototype parity (enable for every code-porting step)

For each step that ports logic from `reference/orbifold.html`, the Dev's handoff must cite the prototype source (line ranges or function names) and demonstrate behavioral fidelity — for pure engines, tests asserting the same outputs (e.g., identical Strudel strings, same voice-leading Σ and signs); for render/UI, a parity note describing observed equivalence. A step claiming a port without a prototype citation is REVISED.

### Reversibility / flag-off (enable when a step changes runtime behavior behind a flag)

When a step gates new behavior behind a flag, the handoff states what the system does with the flag off and confirms the byte-identical guarantee (output on identical input matches pre-phase `main` with the flag default).

Contract Verification and Fixtures-from-backend additions are **not applicable** — this initiative has no backend (static app; agent calls go directly to the user's provider with the user's key).

## Definition of Done specific to this project

Beyond methodology defaults:
- Pure-engine ports are proven against the prototype's behavior (Prototype parity item above), not just "a test is green."
- `tsc --noEmit`, `pnpm lint`, and `pnpm test` pass clean at the end of every code-touching phase.
- The AGPL-3.0 header/license is present and intact.
- Dependency versions are pinned (no caret ranges) for PIXI and Strudel.

## Permission tuning

`.claude/settings.json` is tuned to minimize permission fatigue. This project's tuning beyond the pack defaults:
- Added `pnpm` test/run/build/dev/exec and `pnpm install`/`pnpm add` (the latter two as `ask`, since new deps need Pilot awareness).
- Added writes to root config files needed by Phase 0 (`package.json`, `tsconfig*.json`, `vite.config.*`, `index.html`, `*.config.*`, `.eslintrc*`, `.prettier*`, `svelte.config.*`, `LICENSE`, `README.md`, `CLAUDE.md`).
- `git push` moved from `deny` to `ask` (Pilot authorized at Phase 01); `git push --force`/`-f` remain `deny`.
- Other destructive ops (hard reset, `rm -rf`, publish, deploy) remain `deny`/`ask` — those are Pilot decisions.

## Context hygiene (when to /clear)

Subagent mode is in use, so Planner/Dev invocations already get isolated context. In the orchestrating (Pilot-assistant) session, `/clear`:
- **Between phases** — once a handoff is finalized, before the next scoping.
- **After a substantial blocker resolution** — before resuming.
- **When the agent contradicts an earlier decision** — context-drift sign.

Do NOT clear mid-step or during a REVISE iteration cycle.

## Decisions Register

`docs/mobile-play/decisions.md`. Required reading every Planner and Dev invocation. **Only the Pilot writes.**

See `references/decisions-register-convention.md` for entry format.

## Glossary

`docs/glossary.md`. Grows on demand. See `references/glossary-convention.md`.

## Pilot identity

Pilot: Javier (jcruzsm@gmail.com)
