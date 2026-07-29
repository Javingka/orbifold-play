# Phase 01 Inventory — Repository isolation and agent-context cleanup

**Date:** 2026-07-29

**Branch:** `repository-isolation/phase-01`
**Scope:** documentation, inactive legacy files, and agent configuration only

## Initial state

- `main` matched `origin/main` at `28dd414` and had no working-tree changes.
- The Expo application validated successfully with 73 tests across 14 files.
- The repository also tracked the complete classic desktop runtime and tests,
  although Expo, TypeScript, ESLint, and Vitest excluded them.
- `CLAUDE.md` contained desktop Svelte/PIXI architecture, desktop initiatives,
  desktop ADRs, and an invalid desktop kickoff source.
- `AGENTS.md` was mobile-specific but still described desktop code as a
  temporary local porting source.

## Affected files

### Removed legacy families

- desktop runtime under `src/`, excluding `src/app/`;
- desktop `tests/` and golden-extraction `scripts/`;
- Svelte/Vite entry points and configuration;
- desktop initiatives and archive under `docs/`;
- desktop ADR 0001–0029;
- desktop-only public pages and screenshots;
- `ORBIFOLD_KICKOFF.md` and desktop voice-leading PDF.

### Retained mobile families

- `src/app/`, `components/`, `packages/`;
- mobile initiative documentation;
- ADR 0030–0033;
- mobile web manifest and sample assets;
- AGPL license and third-party notices;
- `reference/orbifold.html` and `reference/beatbox-lab_7.html` as isolated
  non-runtime parity snapshots.

### Updated governance

- `AGENTS.md`
- `CLAUDE.md`
- `.claude/agents/dev.md`
- `.claude/agents/planner.md`
- `.claude/settings.json`
- `README.md`
- `docs/README.md`
- `reference/README.md`

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Expo implicitly depends on a removed root file | Run a production web export after deletion |
| A mobile package imports removed desktop code | Search imports and run strict typecheck/tests |
| Prototype references become executable guidance | Keep them only under `reference/` with an explicit boundary README |
| Codex and Claude drift again | One authoritative `AGENTS.md`; tool adapter defers to it |
| Historical information becomes inaccessible | All removals remain recoverable in Git history and the desktop repository |

## Dependencies

No dependency additions or lockfile changes are required.

## Decision

The Pilot explicitly authorized the exact removal set and required the cleanup
to occur on a separate branch for review before any commit or integration.
