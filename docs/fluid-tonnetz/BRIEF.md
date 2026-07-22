# Fluid Tonnetz — Experience Brief

Status: Stack Glow implemented and verified on `fluid-tonnetz/phase-01`

Date: 2026-07-21

## Product intent

Make every face of the Diamond Tonnetz feel like an independent musical object
floating in a coupled field. Touching a chord should create weight, depth, and a
small response through its real Tonnetz neighbors without compromising chord,
note, scale, or playhead legibility.

## Non-negotiable musical structure

- The Diamond remains exactly 24 unique faces and 20 shared note nodes.
- Notes remain fixed at canonical Tonnetz vertices and render once, above the
  moving tile layer.
- Motion propagation follows shared-edge graph distance, not arbitrary screen
  distance.
- Triangle motion never changes identity, hit-testing, audio timing, or the
  ordered chord sequence.
- Tonic, subdominant, dominant, and accent colors remain recognizable.

## Layer model

1. **Topology:** faint canonical edges and fixed note nodes.
2. **Tiles:** slightly inset triangular pieces, leaving dark channels between
   neighboring faces so each reads as a separate object.
3. **Material:** a clipped gradient per tile, animated from one shared clock with
   a stable phase offset per chord.
4. **Interaction:** press depth, neighbor response, selected elevation, and
   playhead energy are independent signals.

The fixed topology solves the apparent conflict between independent floating
pieces and shared musical notes: the pieces can move in depth while their note
anchors remain exact.

## Directions

### A. Laguna

- Quiet surface; no perpetual idle motion.
- Pressed face sinks gently and rebounds with a critically damped spring.
- Only shared-edge neighbors counter-bob by a much smaller amount.
- Soft mesh gradients move almost imperceptibly; out-of-scale faces remain dark.
- Best legibility and most premium restraint.

### B. Resonance

- The impact propagates through two graph distances with short staggered delays.
- Shared-edge neighbors react first; shared-vertex/second-ring faces react later.
- Gradients compress toward the touch and release with the wave.
- Strongest expression of the Tonnetz as a connected musical field, but busier
  during fast chord entry.

### C. Archipelago

- Larger channels and a subtle independent idle drift make every face read as a
  separate floating component.
- Touch sinks deeper and produces stronger parallax/shadow separation.
- Most spectacular still image and demo behavior, but continuous motion risks
  weakening note alignment and competing with the harmony playhead.

## Approved interaction synthesis

Use **Laguna as the resting material** and one controlled event from
**Resonance**. The Pilot approved this direction on 2026-07-21:

- press-in: selected face sinks over 90 ms;
- impact: three shared-edge neighbors counter-bob after 35 ms;
- second ring: gradient energy only, without geometry movement;
- settle: all transient motion resolves within 700–850 ms;
- selection: the chosen face stays identifiable through elevation, edge glow,
  and saturated mesh color after the water response ends;
- playhead: a separate slow luminous sweep, never another bounce.

This preserves calm between gestures while making every touch feel physical and
connected.

## Selected-face invariant

Scale membership controls only the resting material. Every selected face,
including an out-of-scale face, becomes fully visible and receives a persistent
animated radiant border inspired by ReactICX Radiant Button: a moving luminous
band plus a restrained breathing glow. Reduced-motion mode retains the same
selection hierarchy through a static radiant border.

## Style studies

All three studies use the production screen base `#050609`, retain the current
tonic/subdominant/dominant identities, and render out-of-scale faces through
real alpha rather than opaque gray.

### 1. Stack Glow — recommended

- Adapts the saturated two-color gradient language from ReactICX Stacked Cards.
- Tonic moves through coral, orange, and soft gold.
- Subdominant moves through aqua, teal, and mint.
- Dominant moves through orchid, pink, and rose.
- Out-of-scale faces use indigo/violet material at 10% alpha.
- Best balance of color pleasure, immediate scale recognition, and contrast on
  the Orbifold background.

### 2. Night Prism

- Uses hotter warm gradients and electric cyan/blue/violet contrasts.
- Out-of-scale faces drop to 6.5% alpha.
- Most energetic and game-like direction, but it competes more strongly with
  the selected chord and harmony playhead.

### 3. Functional Opal

- Preserves Orbifold's existing functional colors inside pale opalescent ramps.
- Out-of-scale faces remain more present at 14% alpha.
- Most coherent with the current product palette and most legible, but less
  disruptive than Stack Glow.

## Material and color grammar

- Each face receives a deterministic three-stop palette derived from chord root,
  quality, and tonal function, so adjacent tiles do not look cloned.
- The approved production palette will keep tonic warm, subdominant aqua/teal,
  dominant orchid/pink, and non-diatonic faces in indigo/violet families.
- In-scale tiles use higher contrast and slow internal gradient movement.
- Out-of-scale tiles retain a visible chord label but use 6.5–14% material alpha
  and nearly static gradients.
- The selected tile increases saturation and edge light rather than becoming a
  flat unrelated color.

## Technical direction

- Keep one Skia canvas; model each face as an independently transformed Skia
  group rather than 24 React Native layout views.
- Use Reanimated shared values for per-face depth and a pure adjacency engine for
  propagation distances.
- Start with Skia radial/sweep gradients sharing one clock. Do not begin with 24
  independent runtime shaders.
- Consider a mesh runtime shader only for selected and in-scale faces after
  measuring mobile-web frame time.
- Keep press hit targets at the canonical triangle geometry even while the
  rendered tile is inset or transformed.
- Reduced motion removes idle gradient travel and neighbor displacement while
  retaining immediate selection feedback.

## Reference extraction

- ReactICX Stacked Cards: saturated two-color gradients over a near-black
  background, softened by translucent surfaces and controlled blur.
- ReactICX Cinematic Carousel: item separation through perspective, scale,
  opacity, rotation, translation, and focus-dependent blur.
- ReactICX Mesh Gradient: Skia runtime shader driven by shared time, resolution,
  four colors, noise, blur, and contrast.
- ReactICX Skia Ripple: tap-originated wave controlled by amplitude, frequency,
  decay, speed, and duration.
- ReactICX Glow: animated outline as a state signal rather than a permanent
  decoration.

## Production decision

The Pilot approved Stack Glow for production on 2026-07-21, together with
Laguna at rest, first-ring geometry response, second-ring light response, and a
selected face that remains slightly raised and radiant regardless of scale
membership.
