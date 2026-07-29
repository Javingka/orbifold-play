# Phase 01 Handoff — Repository isolation

**Date:** 2026-07-29

**Branch:** `repository-isolation/phase-01`
**Commit:** none — Pilot review required

## Scope delivered

- Removed the inactive Orbifold desktop runtime, tests, configuration,
  initiative documentation, ADRs, and public-only desktop assets.
- Preserved the Expo application, mobile packages and documentation, audio
  samples, licensing, and two non-runtime parity snapshots.
- Replaced divergent Codex/Claude context with one authoritative shared
  contract in `AGENTS.md`.
- Aligned Claude subagents and permissions with the same no-implicit-scope and
  no-unauthorized-Git rules.
- Added ADR 0033 and explicit documentation/reference maps.

## Alternatives rejected

- warning banners around the retained desktop tree;
- moving the duplicate desktop application into a searchable `legacy/` folder;
- maintaining two complete agent-context documents.

## Acceptance coverage

| ID | Evidence | Status |
| --- | --- | --- |
| R-01 | tracked-root and framework-residue audit | pass |
| R-02 | import-boundary and pure-core platform search | pass |
| R-03 | documentation-root and ADR audit | pass |
| R-04 | AGENTS/CLAUDE/subagent review plus JSON parse | pass |
| R-05 | license, notice, sample, SPDX, and reference checks | pass |
| R-06 | typecheck, lint, 73/73 tests, web export | pass |
| R-07 | `repository-isolation/phase-01`, no commit or push | pass |

## Validation performed

- `pnpm typecheck` — pass
- `pnpm lint` — pass
- `pnpm test` — pass, 73 tests in 14 files
- `pnpm build:web` — pass
- 320×568 web smoke — pass; exact viewport width, no horizontal overflow,
  Play control visible, no console errors
- 390×844 web smoke — pass; Harmony and Rhythm views render, view switch works,
  exact viewport width, no horizontal overflow, Play control visible
- `.claude/settings.json` JSON parse — pass
- working-tree import/framework residue and `git diff --check` audits — pass

The browser reports existing React Native Web deprecation warnings for
`shadow*`, `textShadow*`, and `props.pointerEvents`. They are unrelated to this
cleanup and do not prevent rendering or interaction.

## Known limitations

- Removed content remains in the existing Git history. A history rewrite would
  be destructive and is explicitly out of scope.
- Physical microphone/audio behavior is unchanged by this cleanup and is not
  re-proven by build validation.

## Deferred work

None from repository isolation. Product-level deferred work remains listed in
`AGENTS.md`.
