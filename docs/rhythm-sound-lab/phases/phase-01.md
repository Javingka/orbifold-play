# Phase 01 — Rhythm sound lab

Status: implemented on `rhythm-sound-lab/phase-01`

## Purpose

Replace the mobile rhythm prototype's identical raw oscillator hits with a
sample-first, textural sound system while preserving its Euclidean timing,
interactive steps, synchronized playhead, and compact mobile interface.

## Scope

- Register the existing 16 local CC0 OGG samples as four four-variant palettes:
  cajón, conga, wood, and shaker.
- Add deterministic round-robin sample selection and a repeatable velocity
  accent pattern without microtiming, `.fast`, or `.slow`.
- Give Pulse, Click, and Air independent Strudel audio orbits so their room,
  filtering, stereo position, and compression do not overwrite each other.
- Provide eight sound choices: Hybrid, Cajón, Conga, Wood, Shaker, Sub,
  Digital, and Noise. Hybrid combines a role-specific organic sample with a
  restrained synthesized layer.
- Reuse the top contextual control: it opens musical scales in Harmony and
  orbit sounds in Rhythm.
- Adapt the scale-dialog motion and translucent surface to a Rhythm modal that
  identifies Pulse as outer, Click as middle, and Air as inner.
- Apply sound choices live when transport is playing without changing steps or
  view/playhead timing.
- Audition a short one-shot directly from every sound card. Preview audio uses
  an independent Web Audio path and never replaces or restarts the Strudel
  pattern scheduler.
- Add no dependency and retain the local/offline sample license.

## Acceptance criteria

- **A-01-01** — Rhythm opens a contextual sound dialog from the same header
  location used by the Harmony scale dialog.
- **A-01-02** — The modal visibly maps every ring to its name, position, color,
  and current sound, and allows independent sound selection.
- **A-01-03** — Cajón, conga, wood, and shaker resolve to four local variants;
  active hits rotate deterministically across them.
- **A-01-04** — Per-hit dynamics and effects add depth without tempo modifiers
  or microtiming; one Strudel cycle remains one 4/4 bar.
- **A-01-05** — Changing sounds during playback keeps the transport and
  playhead running and does not mutate rhythm steps.
- **A-01-06** — The closed and open states remain usable at 320×568 and
  390×844.
- **A-01-07** — Tests, typecheck, lint, formatting, and web export pass.
- **A-01-08** — Tapping any sound card emits an immediate preview while the
  transport remains stopped or continues playing unchanged.

## Validation

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build:web
```

Manual browser checks cover every orbit tab, per-orbit live selection, sample
loading diagnostics, transport continuity, modal close, and the two required
mobile viewports.

## Checkpoint

Commit message:
`feat(rhythm-sound): Phase 01 step 01.1 — add orbit sound lab`

Fast-follow commit message:
`feat(rhythm-sound): Phase 01 step 01.2 — audition sound cards`
