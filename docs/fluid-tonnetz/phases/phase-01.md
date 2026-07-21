# Phase 01 — Fluid Diamond Prototype

Status: proposed; awaiting interaction-direction approval

## Outcome

Deliver a mobile-web prototype in which the Diamond Tonnetz reads as 24 separate
floating pieces with coupled, graph-aware touch response and differentiated
dynamic color, without changing musical identity or audio behavior.

## In scope

- Inset every rendered face to create visible channels between pieces.
- Add independent face transforms for press, selection, and playhead states.
- Propagate touch response through the finite Tonnetz adjacency graph.
- Add deterministic per-face gradient palettes derived from tonal function,
  root, and quality.
- Preserve fixed shared note nodes above the moving tile layer.
- Provide reduced-motion and non-runtime-shader fallbacks.
- Measure animation smoothness at 320×568 and 390×844.

## Out of scope

- Changing the 24-face Diamond geometry or chord identities.
- Changing Strudel scheduling, harmony sequencing, scale semantics, or rhythm.
- Continuous physics simulation before the directed-motion prototype is
  approved.
- Adding dependencies before the existing Skia/Reanimated stack is exhausted.

## Acceptance criteria

- Press feedback begins immediately and the transient settles within 900 ms.
- The selected chord remains visually dominant after the transient ends.
- Shared-edge neighbors react less than the pressed face and no unrelated face
  moves as strongly.
- Every note circle remains exactly on its canonical shared vertex.
- In-scale and out-of-scale faces remain distinguishable without reading labels.
- Twenty-four independent shaders are not required for the first implementation.
- Tests, lint, typecheck, formatting, and web export remain clean.

## Pilot checkpoint

Approve the motion/material direction from `docs/fluid-tonnetz/BRIEF.md` before
production component work begins.
