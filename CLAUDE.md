# CLAUDE.md

Claude Code must read and follow [`AGENTS.md`](AGENTS.md) completely before
acting. `AGENTS.md` is the shared, authoritative project contract for Claude
Code, Codex, and every subagent.

## Claude-specific integration

- Product brief: `ORBIFOLD_PLAY_BRIEF.md`
- Shared decisions register: `docs/mobile-play/decisions.md`
- Mobile architectural decisions: `docs/adr/`
- Initiative documents: `docs/<initiative>/{inventories,phases,handoffs}/`
- Planner agent: `.claude/agents/planner.md`
- Dev agent: `.claude/agents/dev.md`
- Methodology resources: `pilot-machine-pack/skill/`

The repository boundary in `AGENTS.md` is absolute. The separate Orbifold
desktop repository is out of scope, and no desktop runtime or documentation may
be copied into Orbifold Play.

There is currently no active initiative. If a requested phase file does not
exist, stop with a phase-missing blocker instead of inventing scope.

Claude Code must not commit, push, merge, or create a pull request without
explicit Pilot authorization, even if a generic methodology instruction would
normally auto-commit a completed step.
