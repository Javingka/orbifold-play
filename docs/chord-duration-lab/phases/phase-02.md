# Chord Duration — Phase 02 Production Integration

## Objective

Promote the approved Elastic Rail interaction from `/duration-lab` into the production harmony
sequence, including audible variable duration, mute, explicit delete, and duration-aware playhead
timing.

## Runtime contract

- Every sequence entry owns its Tonnetz face, duration, and mute state.
- New chords default to `1 BAR`, audible, preserving the pre-phase behavior.
- Supported durations are `½ / 1 / 2 / 3 / 4` Strudel cycles; one cycle remains one 4/4 bar.
- A muted chord remains in the progression and consumes its configured duration.
- Variable chords are emitted as locally stretched segments inside `arrange`; global BPM is not
  changed.
- The playhead uses cumulative entry durations and normalizes each active badge phase from zero
  to one. Badge width remains constant.

## UI contract

- Tapping a badge opens Elastic Rail instead of deleting it.
- The editor floats upward so Play/Stop remains visible at mobile height.
- Tapping outside the editor dismisses it.
- `M` toggles mute and `×` explicitly deletes.
- Muted badges use reduced alpha without an additional marker.
- Full bars use filled duration dots; `½ BAR` uses a hollow dot.

## Acceptance criteria

- Default one-bar codegen remains compatible with the previous progression output.
- Mixed duration and mute codegen is unit tested.
- Playhead tests cover half-, multi-bar, wrap, and muted-slot timing.
- Production playback accepts and runs a variable-duration sequence without an audio error.
- The transport remains visible while Elastic Rail is open at 390 × 844.
- Typecheck, lint, all tests, formatting, and web export pass.
