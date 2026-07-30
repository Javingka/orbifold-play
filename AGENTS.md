# AGENTS.md

This is the shared project contract for every coding agent, including Codex and
Claude Code. Tool-specific files may add operational details, but they must not
override this file.

## Repository boundary

Orbifold Play is the independent mobile-first application located at:

`/Users/virtualmachine/Development/personal/orbifold-play`

The separate desktop application is located at:

`/Users/virtualmachine/Development/personal/Orbifold`

The desktop repository is always out of scope. Never open, read, edit, execute,
reset, merge, or otherwise operate on it while working on Orbifold Play. Do not
copy its runtime or documentation into this repository.

Before any change, run from the Orbifold Play repository:

```sh
pwd
git branch --show-current
git status --short
```

Preserve existing changes and stop if the repository boundary is ambiguous.

## Product source of truth

Read these before designing or changing behavior:

1. `ORBIFOLD_PLAY_BRIEF.md`
2. the active phase in `docs/<initiative>/phases/`
3. related initiative documentation in `docs/`
4. relevant mobile ADRs in `docs/adr/`
5. the current implementation

`ORBIFOLD_PLAY_BRIEF.md` is the product brief. There is no desktop kickoff
document in this repository.

The HTML files under `reference/` are immutable, non-runtime parity sources.
They may be consulted only when an approved phase explicitly ports behavior.
They are not application architecture and must never be imported by production
code.

## Current initiative

**None active — awaiting Pilot scoping.**

Completed mobile initiatives include the first playable instrument,
fluid Tonnetz, scale dialog, chord-duration interactions, rhythm-sound
interactions, rhythm capture through Phase 02, harmony capture through
Phase 02, and detection uplift Phase 01 (segment-feature percussion lane
classification, ADR 0034).

Deferred work currently includes:

- optional neural pitch tracking after a dependency/model-size decision;
- simultaneous multi-lane onset splitting for coincident percussion (the
  candidate detection-uplift Phase 02);
- long sustained-sibilant onsets can defeat the ADR 0032 peak-picker's
  local-mean test (a detection-stage limitation surfaced during
  detection-uplift Phase 01);
- an optional hybrid backend "pro" detection service, only if a client-side
  accuracy ceiling justifies the hosting/privacy cost (detection-uplift
  inventory Option B, not scoped).

If no approved phase file exists, do not infer or invent a next phase.

## Stack and source layout

- Expo + React Native + React Native Web/PWA
- TypeScript strict
- React Native Skia
- Reanimated, Gesture Handler, Expo Haptics, and Safe Area
- Strudel behind platform-specific audio adapters
- Vitest for pure engines
- pnpm with exact dependency versions

Runtime ownership:

- `src/app/`: Expo Router application shell and screen composition
- `components/`: React Native UI
- `packages/music-core/`: pure musical logic
- `packages/ui-core/`: pure renderer-independent UI calculations
- `packages/audio/`: audio and platform adapters
- `public/`: mobile web manifest and required runtime assets
- `reference/`: non-runtime parity sources only

No Svelte, PIXI, Vite application shell, desktop composition system, desktop
agent, or desktop persistence code belongs in this repository.

## Hard invariants

- Pure code in `packages/music-core` cannot import React, DOM, Expo, Skia, or
  audio/platform APIs.
- Microphone, Web Audio, and platform access stay in `packages/audio`.
- Native and web adapters remain separate.
- Audio starts only after an explicit user gesture.
- Playing state and Stop are always obvious.
- `pc(i,j) = (7i + 4j) mod 12`.
- The finite artifact has exactly 24 faces: 12 major and 12 minor.
- One Strudel cycle is one 4/4 bar. Tempo uses `setCps(bpm/240)`; never use
  `.fast` or `.slow` for global tempo.
- Ports cite the exact reference source and include parity tests.
- Keep AGPL-3.0 headers, the license, and third-party notices.

## Documentation and decisions

Initiative documentation uses:

```text
docs/<initiative>/
  inventories/
  phases/
  handoffs/
```

Important architectural decisions live in `docs/adr/`. The Pilot alone edits
`docs/mobile-play/decisions.md`; agents may only propose entries in handoffs.

Documentation must record scope, decisions, rejected alternatives, acceptance
criteria, references, validation, known limitations, and deferred work.
Phase and inventory files are planning-time records; handoffs and accepted ADRs
carry the final implementation status.

## Workflow

Before implementation:

1. inventory the current architecture and affected files;
2. document risks and dependencies;
3. present real Orbifold Play UI/UX options when visuals change;
4. wait for explicit Pilot approval.

Implementation uses `<initiative>/phase-NN` branches and stays within the
approved phase. Do not add dependencies without justification and Pilot
approval.

Never commit, push, merge, open a PR, or rewrite history without explicit Pilot
authorization. This rule applies equally to Codex, Claude Code, and subagents.

## Validation

For every code or configuration change, run:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build:web
```

For UI changes, also verify 320×568 and 390×844. Microphone/audio behavior must
be verified over HTTPS on a real supported browser or device; a successful
build alone is not audio validation.

## Git

- Main branch: `main`
- Initiative branches: `<initiative>/phase-NN`
- Commits: `<type>(<scope>): Phase NN step NN.N — <description>`
- Never force-push or rewrite shared history.
