# Orbifold Play — Product Brief

Status: kickoff draft

Date: 2026-07-16

Pilot: Javier

## Product intent

Orbifold Play is a mobile-first musical instrument that turns harmony and rhythm
into two tactile, game-like objects. It inherits Orbifold's tested music theory
and Strudel behavior, but deliberately does not inherit its desktop information
architecture or DAW-style interface.

The first release has one promise: a person can open the app, touch a harmonic
shape or a rhythm orbit, and immediately make something musical.

## First playable experience

### Harmony object

- A finite Tonnetz artifact containing exactly 24 triangular faces: the 12 major
  and 12 minor pitch-class triads, each represented once.
- The artifact is a deliberate 5–7–7–5 Hexagon Tonnetz silhouette, not an
  infinite Tonnetz wallpaper.
- A compact ReactICX-style Blur Carousel selects a C-rooted mode; diatonic faces
  receive tonic, subdominant, and dominant colors while every chord stays playable.
- Tap appends a chord to a visible progression. The unified transport plays the
  ordered progression and accepts live additions without restarting its clock.
- The progression highlights the audible chord, fills its chip through the bar,
  marks the next chord, and auto-follows longer sequences.
- The active face, shared tones, and motion between chords are unmistakable.

The existing `dim`, `aug`, and `pow` qualities are outside this first artifact.
They need a later visual grammar because standard Tonnetz triangular faces encode
major and minor triads.

### Rhythm object

- A separate full-screen view of concentric Euclidean rhythm orbits.
- Tap a step to toggle it; drag an orbit to rotate it; hits and step count use
  compact touch controls.
- Visual playheads and audio share the same cycle anchor.

### Shared controls

- Audio starts only after an explicit user gesture.
- One Play/Stop transport remains visible in both views and independently routes
  Harmony and Rhythm into the same musical clock.
- Harmony and Rhythm are pages of a ReactICX-style Parallax Carousel: swipe the
  instrument area or use the synchronized Gooey Switch to change views.
- A persistent Harmony/Rhythm position indicator remains in the same place on
  both pages.
- Key, mode, sound, and tempo are secondary controls presented through the
  ReactICX Stacked Chips interaction.
- The app respects reduced-motion and provides a non-WebGL failure message.

## Technical direction

- Expo + React Native + TypeScript strict, with mobile web/PWA as the first
  shipping target.
- React Native Skia for the GPU visual surface and shader-capable effects.
- React Native Reanimated, Expo Blur, and Expo Haptics for tactile UI motion.
- `@strudel/web` behind a web audio adapter. A native audio adapter is explicitly
  deferred; native store packaging must not silently depend on WebAudio.
- Pure theory/rhythm/codegen modules remain renderer- and framework-independent.
- Exact dependency versions only.

## Reuse boundary

Port and retain tests for the pure musical modules that define:

- pitch classes, chords, scales, and tonal function;
- finite Tonnetz identity and P/L/R relationships;
- minimal voice leading;
- Bjorklund/Euclidean rhythm generation and rotation;
- Strudel code generation and the browser scheduler bridge.

Do not port Svelte stores, PIXI scenes, desktop panels, drawers, composition UI,
agent UI, or persistence into the first playable release.

## Product guardrails

- One Strudel cycle is one 4/4 bar; tempo uses the scheduler's `setCps(bpm/240)`.
- Never use `.fast` or `.slow` as global tempo controls.
- Musical identity is independent of pixel coordinates.
- Every sound has visible playing feedback and an immediately reachable Stop.
- Tonal-function colors remain tonic `#f3b15a`, subdominant `#56cfc4`, dominant
  `#e87bac`, and accent `#8aa0ff`.
- AGPL-3.0 lineage and third-party notices remain intact.

## Deferred capabilities

Sessions, composition timeline, AI authoring, song import, persistence, staff
editing, and desktop layouts are intentionally deferred until the core mobile
instrument is delightful and stable.
