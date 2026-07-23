# Chord Duration Lab — Phase 01

## Objective

Explore three mobile-first interactions for editing how long a chord remains in the harmony
sequence, without changing the production sequence or audio model yet.

## Shared interaction contract

- Tapping a chord badge opens its editor; it never deletes immediately.
- `1 BAR` reproduces today's duration and is the default.
- Available prototype steps are `½`, `1`, `2`, `3`, and `4` bars.
- Mute preserves the chord and its time slot.
- A muted badge is communicated only through reduced color and opacity, without an extra icon.
- Delete is an explicit `×` satellite action.
- Every prototype is usable by touch and exposes accessibility labels.

## Options

### 01 — Elastic Rail

The selected badge unfolds into a compact inline rail. Its inspiration is ReactICX Elastic
Slider: a direct stepped gesture with the value always near the thumb. The editor keeps the
smallest spatial jump and is the selected production baseline. While dragging, the rail grows
slightly, stretches with restrained resistance beyond either endpoint, and springs back without
losing the chosen duration. Tapping elsewhere in its card closes the editor. Full bars use filled
dots in the badge; a half bar uses one small hollow dot.

### 02 — Glass Popover

A blurred local pod points back to the selected badge. It combines the placement model of a
dropdown with the directness of a seekbar. It protects the sequence strip geometry, but requires
more empty space below it.

### 03 — Pocket Sheet

A small bottom sheet rises inside the sequence card. It makes labels and actions clearest and
offers the largest touch targets. It is the most explicit option and also the most spatially
dominant.

## Acceptance criteria

- A dedicated `/duration-lab` route presents all three options in the current Orbifold style.
- Each option independently supports selecting, changing duration, muting, deleting, and reset.
- Production harmony badges and audio output remain untouched.
- Typecheck, lint, tests, and web export pass.
- The route is visually checked at mobile widths.

## Deferred production decisions

- Persisted sequence schema and migration.
- Strudel generation for mixed chord durations.
- Playhead phase across variable and muted slots.
- Whether sub-bar durations are in the first production release.
