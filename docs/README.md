# Orbifold Play documentation

This directory contains only Orbifold Play product and initiative records.
Desktop Orbifold documentation belongs to the separate desktop repository and
must not be restored or recreated here.

## Authoritative documents

- Product intent and boundaries: `../ORBIFOLD_PLAY_BRIEF.md`
- Shared agent contract: `../AGENTS.md`
- Pilot Decisions Register: `mobile-play/decisions.md`
- Mobile architectural decisions: `adr/`

## Mobile initiative history

- `mobile-play/` — first playable instrument
- `fluid-tonnetz/` — fluid Tonnetz interaction
- `scale-dialog/` — scale selection dialog
- `chord-duration-lab/` — chord-duration interaction
- `rhythm-sound-lab/` — rhythm sound interaction
- `rhythm-capture/` — microphone rhythm capture
- `harmony-capture/` — microphone harmony capture
- `detection-uplift/` — segment-feature percussion lane classification

Each new initiative must use `inventories/`, `phases/`, and `handoffs/`.
Planning-time statements such as “proposed” or “pending” remain historical;
accepted ADRs and final handoffs are authoritative for completion status.

## Non-runtime references

Prototype snapshots live under `../reference/`. They exist solely for approved
parity work and are not part of the application or its architecture.
