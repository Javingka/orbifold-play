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

## Step 01.3 — Restore compact topology and extend visual continuity

Status: complete

The finite model now uses the Pilot-approved compact lattice cut with vertex
rows `1–4–5–5–4–1`. Its top C major and bottom A minor close the diamond; all
interior horizontal bases are actual shared Tonnetz vertices for the opposite
major/minor faces. The projection now exposes that relationship directly.

The complete Tonnetz render/hit layer supports two-finger pinch and explicit
`− / 1× / +` controls from 1× through 2×. Harmony-sequence badges use the same
material resolver as their source faces and render as one lazy Skia strip. The
playing badge has the radiant sweep and clock phase; the following badge is
marked `NEXT`.

### Acceptance Coverage Table

| Acceptance | Evidence | Status |
| --- | --- | --- |
| A-01-01 | `finite-tonnetz.test.ts`: 24 identities, 20 shared vertices | Pass |
| A-01-05 | Browser selection after zoom added exactly C then C♯ | Pass |
| A-01-07 | No dependency/audio/rhythm change; Play/Stop completed | Pass |
| A-01-09 | 23 tests, lint, typecheck, and web export passed | Pass |
| A-01-10 | Exact pitch rows asserted in `finite-tonnetz.test.ts`; 390×844 visual matched the compact reference | Pass |
| A-01-11 | 390×844 `+` control enlarged the complete Diamond; C remained selectable afterward | Pass |
| A-01-12 | Browser showed orange C and violet C♯ badges; Play produced `NOW/NEXT`, radiant active edge, and advancing phase | Pass |

### Validation

- `pnpm test`: 6 files, 23 tests passed.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm build:web`: passed.
- Browser 390×844: compact chord rows were C; A♭/Cm/E♭/Gm/B♭/Dm/F;
  E/A♭m/B/E♭m/F♯/B♭m/C♯/Fm; Em/G/Bm/D/F♯m/A/C♯m; Am, with 20
  visible shared-note badges.
- Browser 390×844 after zoom: C and C♯ hit targets remained correct; the
  sequence used matching Stack Glow gradients and the audio-clock playhead.
- Browser console after clean server boot: zero errors; existing React Native
  Web deprecation warnings remain outside this step.

## Phase completion

Phase 01 remains complete after the Pilot-authorized topology correction. No
ADR trigger fired, no dependency was added, and chord identity, scale semantics,
audio, rhythm, and saved data remain unchanged.
