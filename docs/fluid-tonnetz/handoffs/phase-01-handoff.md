# Phase 01 handoff

## Step 01.1 — Production-boundary inventory

Status: complete

The inventory records the existing geometry, selection/audio boundary, scale
resolver, label layers, graph derivation, one-Canvas implementation seam, test
home, exact touch set, and direct-replacement reversibility boundary. No blocker
or ADR trigger was found. Production implementation may proceed under the
Pilot's explicit approval of Stack Glow and universal radiant selection.

### Acceptance Coverage Table

| Acceptance | Step 01.1 evidence | Status |
| --- | --- | --- |
| A-01-01 | Existing `finite-tonnetz.test.ts`; inventory geometry contract | Covered for implementation |
| A-01-02 | Inventory material seam and approved Stack Glow palettes | Covered for implementation |
| A-01-03 | Selected-state invariant documented independently of scale | Covered for implementation |
| A-01-04 | Canonical shared-edge BFS defines distance 0/1/2 behavior | Covered for implementation |
| A-01-05 | Fixed notes, moving chord labels, canonical hits inventoried | Covered for implementation |
| A-01-06 | Reduced-motion fallback boundary inventoried | Covered for implementation |
| A-01-07 | Existing callback/audio path and no-dependency boundary recorded | Covered for implementation |
| A-01-08 | Mobile operability scenarios enumerated | Pending implementation |
| A-01-09 | Validation command set closed in the phase | Pending implementation |

### Validation

- `pnpm test`: 17/17 baseline tests passed before source changes.
- Static invariant review: no planned topology, audio, sequence, rhythm, hit-
  target, dependency, or data-model change.

## Step 01.2 — Implement and verify the fluid surface

Status: complete

The production Tonnetz now renders inset Stack Glow pieces on the existing
single Skia Canvas. A framework-free UI model derives graph rings, material
roles, resting alpha, selected overrides, and reduced-motion policy. Each tap
increments an interaction token, so repeated taps on the same face retrigger the
physical response while `onSelect(face)` still fires exactly once.

Every selected face is fully visible and receives a persistent moving sweep
border plus breathing blur glow, including out-of-scale faces. Chord labels
mirror the face displacement; the 20 shared note badges and all canonical hit
polygons remain fixed.

### Acceptance Coverage Table

| Acceptance | Evidence | Status |
| --- | --- | --- |
| A-01-01 | Existing `finite-tonnetz.test.ts`; browser exposed 24 canonical chord buttons at 320×568 and 390×844 | Pass |
| A-01-02 | `fluid-tonnetz.test.ts`; C-major browser observation shows six vivid Stack Glow faces and translucent outside material | Pass |
| A-01-03 | Selected C♯ major while outside C major: material became fully visible with radiant border; pure selected override test | Pass |
| A-01-04 | Shared-edge BFS unit test; 90/35 ms and distance-2 light sequences in `TonnetzArtifact` | Pass |
| A-01-05 | Browser retained 20 fixed note labels and canonical accessible buttons; repeated C♯ tap produced exactly two sequence entries | Pass |
| A-01-06 | Reduced-motion policy test disables geometry/traveling radiance while selected material and static border remain | Pass |
| A-01-07 | No dependency or audio-source change; Play reached `HARMONY + RHYTHM PLAYING`, Stop returned to ready with no audio error | Pass |
| A-01-08 | Browser smoke passed at 320×568 and 390×844, including out-of-scale selection and scale change with Em selected | Pass |
| A-01-09 | 22 tests, lint, typecheck, formatting, and web export passed | Pass |

### Validation

- `pnpm test`: 6 files, 22 tests passed.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm format`: passed; direct `docs/fluid-tonnetz` check passed.
- `pnpm build:web`: passed; Expo exported the production web bundle.
- Browser 390×844: C♯ outside C major selected at full material with radiant
  border; same-face repeat appended one sequence entry per tap; Em remained full
  and radiant after changing from C major to C minor.
- Browser 320×568: 24 chord targets rendered without horizontal clipping; C♯
  selection remained legible and radiant; Play/Stop completed without audio
  error.
- Browser console: zero errors. Existing React Native Web deprecation warnings
  remain outside this phase; the Tonnetz path construction uses the current
  immutable Skia PathBuilder API.

## Phase completion

Phase 01 is complete. No ADR trigger fired, no dependency was added, and no
change was made to Tonnetz identity, scale semantics, canonical hits, audio,
sequence, rhythm, or saved data.
