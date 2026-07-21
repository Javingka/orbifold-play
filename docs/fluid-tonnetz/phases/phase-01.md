# Phase 01 — Stack Glow Fluid Diamond

Status: complete on `fluid-tonnetz/phase-01`

**Purpose:** Ship the approved Stack Glow Diamond Tonnetz as a tactile, graph-coupled mobile surface while preserving every musical and interaction contract already in production.
**Gate:** The Pilot has approved Stack Glow, Laguna at rest, the controlled Resonance touch event, and a Radiant Button-inspired selected border for both in-scale and out-of-scale faces.
**Expected phase result:** All 24 canonical faces remain directly playable and gain deterministic Stack Glow material, scale-aware resting alpha, universal radiant selection, coupled touch motion, and reduced-motion behavior without changing audio, sequence, topology, notes, or hit testing.

---

## Step 01.1 — Production-boundary inventory

PROMPT → Read `docs/fluid-tonnetz/BRIEF.md`, `components/tonnetz-artifact.tsx`, `src/app/index.tsx`, `packages/music-core/src/finite-tonnetz.ts`, `packages/music-core/src/scales.ts`, their tests, and the existing reduced-motion/Reanimated examples; produce `docs/fluid-tonnetz/inventories/phase-01-inventory.md`, append the step handoff, and do not edit source code.

Implementation requirements:
- Record the current 24-face/20-node geometry, canonical triangle hit targets, chord-selection callback, sequence/audio path, scale-role resolver, label layers, and harmony playhead source.
- Derive first- and second-ring adjacency strictly from shared canonical edges and identify a framework-free home for the adjacency/material state plus its unit tests without putting visual policy in the pure music engine.
- Confirm the installed Skia/Reanimated APIs needed for inset paths, shared-clock gradients, blur/glow, transforms, and reduced motion on native and web; the plan must use one Canvas/shared clock, no new dependency, and no 24 independent runtime shaders.
- List the exact source/test/doc touch set and the direct-replacement boundary. The initiative branch is the reversibility boundary; no runtime flag is required after explicit Pilot approval.
- Surface any need to change topology, audio/scheduler semantics, canonical hit paths, dependencies, or the one-Canvas architecture as a blocker rather than broadening the phase.

Validation:
- `pnpm exec prettier --check docs/fluid-tonnetz/inventories/phase-01-inventory.md docs/fluid-tonnetz/phases/phase-01.md`
- Static comparison of the proposed touch set against the invariants in `AGENTS.md` and `ORBIFOLD_PLAY_BRIEF.md`.

Expected result:
- A Pilot-reviewable inventory that closes file ownership, test seams, fallback behavior, and reversibility before implementation begins.

CHECKPOINT → Commit message:
`docs(fluid-tonnetz): Phase 01 step 01.1 — inventory production boundaries`

---

## Step 01.2 — Implement and verify the fluid surface

PROMPT → After the production-boundary inventory closes without blockers, implement the approved experience, add focused tests, update the brief/handoff, and verify the complete instrument on mobile web; do not change chord identities, scale semantics, note vertices, audio generation/scheduling, sequence behavior, rhythm behavior, or canonical hit targets.

Implementation requirements:
- Render every face as an inset independent tile on the existing `#050609`-family stage while retaining exactly 24 unique major/minor identities and the 20 fixed shared note nodes above the moving tile layer.
- Apply deterministic Stack Glow palettes: coral/orange/gold for tonic, aqua/teal/mint for subdominant, orchid/pink/rose for dominant, and indigo/violet for out-of-scale material. Scale membership controls resting material only: in-scale faces are vivid; out-of-scale faces rest at `0.10` alpha with readable labels.
- Treat selection as an invariant independent of scale membership. Any selected face, including an out-of-scale face, becomes fully visible and receives a persistent animated radiant border with a moving luminous band and restrained breathing glow inspired by ReactICX Radiant Button. Reduced motion keeps the face fully visible with an equally unmistakable static radiant border.
- Implement Laguna + controlled Resonance from the canonical adjacency graph: press-in sinks the touched face over 90 ms; shared-edge neighbors counter-bob after 35 ms with lower amplitude; the second ring receives light energy only; transient motion settles in 700–850 ms; the selected face remains elevated and radiant afterward.
- Keep chord labels centered on and moving with their corresponding pieces while note badges remain fixed at canonical shared vertices.
- Keep Pressables on the untransformed canonical triangles, preserve their existing accessible chord/note labels, call `onSelect(face)` exactly once per completed tap, and preserve existing haptics.
- Use one Skia Canvas and one shared animation clock. Provide a no-runtime-shader fallback with ordinary Skia gradients/strokes, and do not add packages.
- Add framework-free tests for shared-edge/second-ring propagation, deterministic material resolution, out-of-scale resting alpha, and the selected-state override. Retain the existing finite-Tonnetz parity tests unchanged or extended, never weakened.
- Validate 320×568 and 390×844, stage contrast, rapid taps, scale changes while selected, repeated selection of the same face, selection of out-of-scale faces, existing playback behavior, and reduced motion.

Validation:
- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build:web`
- `pnpm exec prettier --check docs/fluid-tonnetz components packages src/app`
- Operability boot: `pnpm web` → the Harmony view opens on the `#050609` stage and every triangle remains playable.
- Manual mobile-web checks at 320×568 and 390×844; manual device check for touch response, audio, and haptics; repeat the principal checks with reduced motion enabled.

Expected result:
- The production Harmony view delivers the approved Stack Glow material and fluid interaction, including radiant selection for non-scale chords, while all existing musical behavior remains intact.

CHECKPOINT → Commit message:
`feat(fluid-tonnetz): Phase 01 step 01.2 — ship Stack Glow fluid Diamond`

---

## Phase Acceptance

- **A-01-01** — The enabled Harmony surface still exposes exactly 24 unique major/minor chord faces and 20 fixed shared note nodes, and every canonical face remains directly selectable.
  - Validation method: `integration`
- **A-01-02** — At rest, in-scale faces use recognizable Stack Glow tonal families and out-of-scale faces use readable indigo/violet material at `0.10` alpha on the production `#050609`-family background.
  - Validation method: `manual`
- **A-01-03** — Selecting any face, whether in-scale or out-of-scale, makes its material fully visible and leaves an unmistakable animated radiant border after touch motion settles.
  - Validation method: `manual`
- **A-01-04** — A touch sinks the selected face over 90 ms, moves only shared-edge neighbors after 35 ms at lower amplitude, gives the second ring light-only energy, and settles transient motion in 700–850 ms.
  - Validation method: `integration`
- **A-01-05** — Shared note badges remain fixed on canonical vertices, chord labels remain attached to their faces, and canonical hit targets select the same face exactly once despite visual transforms.
  - Validation method: `integration`
- **A-01-06** — Reduced motion removes displacement and traveling light while preserving full-opacity selection and a static radiant border for every selected face.
  - Validation method: `integration`
- **A-01-07** — The direct replacement preserves the existing one-callback-per-tap selection/audio/sequence behavior; no new package or runtime-shader dependency is required.
  - Validation method: `integration`
- **A-01-08** — A fresh operator can start the experience, select an out-of-scale chord, hear it through the existing flow, and stop playback at both required mobile viewport sizes.
  - Validation method: `operability`
- **A-01-09** — Tests, lint, typecheck, formatting, and the production web export complete successfully.
  - Validation method: `operability`

## Operability requirements

- **Boot commands**: `pnpm install` from a fresh clone, then `pnpm web` → Expo serves the Harmony view; `pnpm build:web` → static export succeeds.
- **Required data**: none; the finite Tonnetz and scale options remain deterministic in-repo data.
- **Required env vars / flags**: none.
- **Smoke checks**: at 320×568 and 390×844, select both an in-scale and out-of-scale chord, change scale while the chord remains selected, play/stop the sequence, confirm the audible-face sweep, repeat with reduced motion, and record browser/device plus observable result in the handoff.
- **Idempotency**: repeated start/build commands and repeated selection of the same face must not mutate generated files or accumulate animation timers/listeners.

## Partial coverage from prior phase (if any)

No prior completed phase or partial coverage exists; the interaction and style studies were pre-implementation scoping work.

## ADR Triggers

- **Fluid surface renderer boundary** — Trigger: inventory shows the approved one-Canvas/shared-clock design cannot be implemented without per-face runtime shaders, a new dependency, or moving canonical hit/note geometry.

## Handoff Note

At the end of this phase, the Dev appends per-step entries and a phase-completion entry to `docs/fluid-tonnetz/handoffs/phase-01-handoff.md`. Each entry includes an Acceptance Coverage Table; the final table maps A-01-01 through A-01-09 to concrete test files or named browser/device observations and leaves no manual or operability criterion self-graded without evidence.
