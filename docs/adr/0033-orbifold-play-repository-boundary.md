<!--
SPDX-License-Identifier: AGPL-3.0-only
-->

# ADR 0033 — Orbifold Play is a physically isolated mobile repository

- **Status:** Accepted — explicitly authorized by the Pilot 2026-07-29
- **Date:** 2026-07-29
- **Initiative / Phase:** repository-isolation / Phase 01
- **Deciders:** Pilot (Javier)

## Context

Orbifold Play began from repository history that also contained the classic
Orbifold desktop runtime, tests, build configuration, assets, ADRs, and
initiative records. The Expo build ignored most of those files, but their
presence created a material risk that a coding agent would treat Svelte/PIXI
code or desktop documentation as current mobile architecture.

The risk was amplified by a large `CLAUDE.md` inherited from the desktop
project. Codex read the concise mobile `AGENTS.md`, while Claude Code received a
mixture of mobile and desktop instructions. Passing builds did not remove that
governance divergence.

## Decision

1. Orbifold Play contains only its Expo/React Native runtime, mobile packages,
   mobile initiative documentation, required assets, and licenses.
2. The separate Orbifold desktop repository is always out of scope and is
   never opened or modified during Orbifold Play work.
3. Historical prototype snapshots may remain only under `reference/`, are
   non-runtime, and cannot be imported by production code.
4. `AGENTS.md` is the shared authoritative contract for Codex, Claude Code, and
   subagents. `CLAUDE.md` contains only Claude-specific integration details and
   defers to `AGENTS.md`.
5. Desktop runtime, tests, configuration, initiative history, and ADR 0001–0029
   are removed from the Orbifold Play working tree. They remain recoverable in
   Git history.
6. New initiatives use `docs/<initiative>/{inventories,phases,handoffs}/`.
   Mobile architectural decisions remain in `docs/adr/`.

## Alternatives rejected

### Keep the desktop tree with warning banners

Rejected because agents search and infer from file presence. Warnings reduce
but do not remove the chance of importing or editing the wrong architecture.

### Move the desktop tree to a `legacy/` directory

Rejected because it would still duplicate the desktop repository and remain
searchable as apparently local implementation guidance.

### Keep separate full instruction files for Codex and Claude

Rejected because duplicated state inevitably drifts. A shared contract with a
small tool adapter has one authoritative product state.

## Consequences

- Repository searches, type ownership, and documentation now describe only the
  mobile application.
- Pure ports retain auditable parity sources without retaining a second
  application runtime.
- A future port requiring information beyond the snapshots must be scoped and
  explicitly authorized; agents cannot silently consult the desktop repository.
- Git history remains large until a separate, explicitly approved history
  rewrite. Rewriting history is not part of this decision.

## Verification

- no tracked Svelte/PIXI/Vite desktop runtime or desktop test tree;
- no production import from `reference/`;
- Codex and Claude instructions agree on repository, state, workflow, and Git
  authority;
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build:web` pass.
