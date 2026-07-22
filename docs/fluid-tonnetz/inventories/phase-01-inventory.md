# Phase 01 production-boundary inventory

Date: 2026-07-21

## Existing production contracts

- `createFiniteTonnetz()` returns 24 unique major/minor faces. Its existing test
  proves one edge-connected Diamond and exactly 20 shared note vertices.
- `TonnetzArtifact` projects canonical lattice vertices once, builds one Skia
  path and one fixed `Pressable` hit polygon per face, and renders note badges in
  a separate overlay above the Canvas.
- A completed face tap calls `onSelect(face)`. `Page.handleChordSelect` appends
  that face to the harmony sequence, updates the readout, emits one selection
  haptic, and re-evaluates the existing Strudel pattern only when harmony is
  already playing.
- `resolveDiatonicFaceRole()` is the authoritative scale-membership and tonal-
  function resolver. A null role means out of scale; it never means disabled.
- The harmony playhead belongs to `HarmonySequence` and does not need to move
  into the Tonnetz for this phase.
- Chord labels currently occupy face centers in a React Native overlay. Note
  labels occupy the 20 canonical lattice vertices and must remain fixed.

## Interaction graph

Adjacency is derived from canonical shared edges, not visual distance. Each face
contributes three normalized vertex-pair keys. Breadth-first traversal from the
touched face yields:

- distance 0: touched face — sink and rebound;
- distance 1: shared-edge neighbors — smaller delayed counter-bob;
- distance 2: light-energy overlay only;
- greater distances: no touch response.

The framework-free implementation belongs in
`packages/ui-core/src/fluid-tonnetz.ts`, because graph distance drives a visual
interaction and Stack Glow colors/alpha are presentation policy rather than
music theory. Focused Vitest coverage will live beside it.

## Rendering and animation seam

- Keep the existing single Skia Canvas and create inset face paths from the
  canonical points. Canonical paths remain available for topology and hit tests.
- Render Stack Glow fills with ordinary Skia `LinearGradient` shaders clipped by
  each inset path. No runtime-effect shader or new dependency is required.
- Use one Skia `useClock()` value for the selected radiant sweep. React Native
  Skia accepts Reanimated shared/derived values directly as component props;
  `SweepGradient` supports animated start/end angles.
- Use per-face Reanimated values for transient translation, scale, material
  opacity, and second-ring energy. Reduced motion resolves them to stable state
  without traveling light or displacement.
- Mirror each face transform on its centered React Native chord label. Keep the
  note-badge overlay and canonical `Pressable` layer untransformed.
- The selected-state override is independent of scale: selected material opacity
  is full and the radiant border renders for both role-bearing and null-role
  faces. Resting out-of-scale opacity is exactly `0.10`.

## Planned touch set

- Add `packages/ui-core/src/fluid-tonnetz.ts`.
- Add `packages/ui-core/src/fluid-tonnetz.test.ts`.
- Update `components/tonnetz-artifact.tsx`.
- Update `docs/fluid-tonnetz/BRIEF.md` and the phase handoff.

No change is planned for `src/app/index.tsx`, audio code, Strudel scheduling,
finite-Tonnetz identity, scale semantics, sequence behavior, rhythm behavior,
dependencies, or saved data.

## Reversibility and blockers

The initiative branch is the reversibility boundary; the Pilot approved direct
replacement, so no runtime flag is needed. Reverting the implementation commit
restores the prior renderer without a data migration. Inventory found no need to
change topology, canonical hit paths, audio behavior, dependencies, or the
one-Canvas architecture, so there is no ADR trigger or implementation blocker.

## Validation boundary

- Pure tests: graph rings, deterministic role palette, `0.10` resting alpha,
  universal selected opacity/border override, and reduced-motion state.
- Static checks: existing 24-face/20-node tests remain unchanged and passing.
- Browser checks: 320×568 and 390×844, in-scale and out-of-scale selection,
  repeated same-face taps, rapid taps, scale changes while selected, readable
  labels, fixed notes, reduced motion, and unchanged play/stop behavior.
