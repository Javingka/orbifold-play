# Phase 01 — Isolate Orbifold Play from the desktop repository

**Status:** Complete — awaiting Pilot review and Git authorization

**Branch:** `repository-isolation/phase-01`

## Outcome

Deliver an Orbifold Play tree that contains only mobile runtime, mobile
documentation, required assets, and explicitly isolated parity snapshots.
Codex and Claude Code must receive the same project state and repository
boundary.

## In scope

- remove inactive desktop runtime, tests, build configuration, assets, and
  documentation from the working tree;
- retain only mobile initiative and ADR history;
- isolate reference prototypes from runtime code;
- make `AGENTS.md` authoritative across agent services;
- align Claude subagents and permission configuration with the shared contract;
- document the repository boundary in ADR 0033;
- validate the full mobile application after cleanup.

## Out of scope

- changes to musical behavior, UI, audio, or capture engines;
- dependency changes;
- access to or modification of the separate desktop repository;
- Git history rewriting;
- commit, push, merge, deployment, or PR creation.

## Acceptance criteria

- **R-01:** No tracked Svelte, PIXI, Vite desktop runtime or desktop test tree
  remains outside Git history.
- **R-02:** Production mobile code has no import from `reference/` or a desktop
  source path.
- **R-03:** Current documentation lists only Orbifold Play initiatives and
  mobile ADRs.
- **R-04:** Codex, Claude Code, and their subagents share the same repository
  boundary, current initiative state, validation commands, and Git authority.
- **R-05:** AGPL headers, third-party notices, audio samples, and parity
  snapshots remain intact.
- **R-06:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build:web`
  pass after deletion.
- **R-07:** Work remains isolated on `repository-isolation/phase-01` without a
  commit or push.

## Validation

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build:web
```

Also inspect tracked roots, search for desktop framework terms and forbidden
imports, validate Claude JSON configuration, and confirm the branch/status.
