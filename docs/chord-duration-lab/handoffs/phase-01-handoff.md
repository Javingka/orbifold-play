# Phase 01 Handoff — Chord Duration Lab

## Scope delivered

An isolated, non-production laboratory at `/duration-lab` with three interactive chord-duration
editors. Each prototype owns local mock progression state, so deleting or muting a laboratory
chord cannot affect the main instrument.

## Recommendation

**Elastic Rail was selected after review.** It has the least context shift, makes the new tap
contract immediately understandable, and consumes less vertical space than the two floating
alternatives. Its refined gesture now expands the track while dragging, adds elastic endpoint
resistance and spring return, and dismisses from a tap outside the editor. The response was tuned
down after visual review so it remains tactile without dominating the compact editor.

## Behavioral decisions represented

- Default: `1 BAR`, matching the current application.
- Duration range: stepped `½ / 1 / 2 / 3 / 4` bars for comparison.
- Mute: retains order and duration.
- Muted badge: reduced color/alpha only; no redundant `M` marker.
- Duration badge: filled dots for complete bars and one hollow dot for `½ BAR`.
- Delete: explicit destructive action; badge taps only select or close the editor.

## Production impact

None. `HarmonySequence`, the sequence state in `src/app/index.tsx`, Strudel pattern generation,
and the playhead resolver are unchanged.

## Validation

- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `pnpm test`
- `pnpm build:web`
- Mobile visual and touch inspection of `/duration-lab`
