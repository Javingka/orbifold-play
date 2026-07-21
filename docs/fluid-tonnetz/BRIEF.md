# Fluid Tonnetz — Experience Brief

Status: interaction exploration

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

## Recommended synthesis

Use **Laguna as the resting material** and borrow one controlled event from
**Resonance**:

- press-in: selected face sinks over 90 ms;
- impact: three shared-edge neighbors counter-bob after 35 ms;
- second ring: gradient energy only, without geometry movement;
- settle: all transient motion resolves within 700–850 ms;
- selection: the chosen face stays identifiable through elevation, edge glow,
  and saturated mesh color after the water response ends;
- playhead: a separate slow luminous sweep, never another bounce.

This preserves calm between gestures while making every touch feel physical and
connected.

## Material and color grammar

- Each face receives a deterministic four-stop palette derived from chord root,
  quality, and tonal function, so adjacent tiles do not look cloned.
- Tonic faces center on `#f3b15a`, subdominant on `#56cfc4`, dominant on
  `#e87bac`, and non-diatonic/accent faces on desaturated `#8aa0ff` families.
- In-scale tiles use higher contrast and slow internal gradient movement.
- Out-of-scale tiles retain a visible chord label but use low-contrast, nearly
  static gradients.
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

- ReactICX Cinematic Carousel: item separation through perspective, scale,
  opacity, rotation, translation, and focus-dependent blur.
- ReactICX Mesh Gradient: Skia runtime shader driven by shared time, resolution,
  four colors, noise, blur, and contrast.
- ReactICX Skia Ripple: tap-originated wave controlled by amplitude, frequency,
  decay, speed, and duration.
- ReactICX Glow: animated outline as a state signal rather than a permanent
  decoration.

## Decision gate

Before production implementation, approve:

1. resting direction: Laguna, Resonance, or Archipelago;
2. propagation: edge neighbors only or two graph rings;
3. gradient energy: subtle, expressive, or dramatic;
4. whether the selected face stays raised or slightly submerged after release.
