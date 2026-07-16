# Phase 01 — First Playable Instrument

## Outcome

Deliver an installable mobile-web prototype with two full-screen playable views:
the finite 24-face harmony artifact and Euclidean rhythm orbits. The release is
successful when a new user can produce and stop synchronized sound without
opening a settings panel or reading instructions.

## In scope

### 01.1 Foundation

- Scaffold Expo/React Native Web with TypeScript strict.
- Configure exact dependency versions, lint, formatting, tests, typecheck, and a
  static web export.
- Add an installable PWA manifest and mobile viewport/safe-area behavior.
- Preserve AGPL-3.0 and ReactICX MIT notices.

### 01.2 Pure finite Tonnetz model

- Port the pitch/chord/scale/Tonnetz/voice-leading engines without UI imports.
- Define a deterministic connected set of 24 triangle identities, one for every
  `(rootPc, maj|min)` pair.
- Prove uniqueness, Tonnetz pitch-class formula, adjacency, P/L/R labels, and
  prototype-equivalent voice-leading with unit tests.

### 01.3 Harmony interaction

- Render the 24-face artifact as one responsive Skia canvas.
- Tap faces to append chords to an ordered, removable progression.
- Show an audio-clock playhead across the progression: active chord, within-bar
  progress, next chord, and auto-follow for off-screen chords.
- Play the progression from the unified transport and accept live additions
  without restarting the scheduler clock.
- Animate selection, shared-tone edges, and voice-leading travel.
- Provide reduced-motion behavior and reliable touch hit-testing.

### 01.4 Euclidean orbit interaction

- Port Bjorklund generation, rotation, and layer-to-Strudel codegen with parity
  tests.
- Render concentric playable orbits with a synchronized playhead.
- Toggle steps and adjust hits/rotation with touch-first gestures.

### 01.5 Controls and transport

- Add a two-view swipe/morph transition.
- Adapt ReactICX Stacked Chips for key, mode, sound, and tempo.
- Keep one Play/Stop transport visible in both views and expose Harmony/Rhythm
  inclusion toggles through the Stacked Chips interaction.
- Queue live changes on the next cycle.

### 01.6 Mobile verification

- Verify representative narrow and wide phone viewports.
- Verify audio unlock, chord/rhythm playback, tempo, queued changes, and Stop.
- Verify a clear fallback when the GPU surface cannot initialize.
- Run test, lint, typecheck, and web export cleanly.

## Out of scope

- Native iOS/Android audio implementation or app-store builds.
- Diminished, augmented, or power-chord faces.
- Saved sessions, composition, AI, import, staff editing, or desktop parity.
- Reusing the old Svelte/PIXI application shell.

## Acceptance criteria

- Exactly 24 unique major/minor chords are directly playable from one finite
  on-screen object.
- Triangle taps build an ordered progression that can be edited and played.
- At least three independent Euclidean layers can play together and visibly show
  their current step.
- The first sound is impossible before a user gesture.
- Key, mode, sound, and BPM changes are reachable without leaving the instrument.
- Stop is always visible while audio is active and silences all patterns.
- The app remains usable at 320 CSS pixels wide and respects safe-area insets.
- Pure-engine tests cite their Orbifold/prototype source and demonstrate parity.
- `pnpm test`, `pnpm lint`, `pnpm typecheck`, and the production web export pass.

## Validation

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build:web
```

Manual verification is required on mobile Safari and Chrome because headless tests
cannot prove perceived audio/visual synchronization or haptic feel.

## Pilot checkpoints

1. Approve the 24-face silhouette before interaction polish.
2. Approve the harmony gesture and sound behavior before rhythm implementation.
3. Approve the orbit gesture vocabulary before closing the phase.
4. Ratify any change to the audio engine or first-release chord set.
