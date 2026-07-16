# AGENTS.md

## Product source of truth

Read `ORBIFOLD_PLAY_BRIEF.md` and the active phase in
`docs/mobile-play/phases/` before changing behavior. The classic Orbifold code
remains in the repository temporarily as a porting source, not as the new UI
architecture.

## Stack

- Expo + React Native + TypeScript strict
- React Native Web/PWA as the first shipping target
- React Native Skia for the instrument surface
- React Native Reanimated + Expo Blur/Haptics for interaction
- `@strudel/web` behind a browser audio adapter
- Vitest for pure engines
- pnpm with exact dependency versions

## Hard invariants

- Pure music engines have no React, DOM, Expo, Skia, or audio imports.
- `pc(i,j) = (7i + 4j) mod 12`.
- Phase 01's finite artifact has exactly 24 unique faces: 12 major and 12 minor.
- One Strudel cycle is one 4/4 bar. Tempo uses scheduler `setCps(bpm/240)`;
  never `.fast` or `.slow` for global tempo.
- Audio starts only after a user gesture.
- Playing state and Stop are always obvious.
- New ports cite their Orbifold/prototype source and include parity tests.
- Keep AGPL-3.0 headers and third-party notices.

## Validation

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build:web
```

Run visual checks at 320×568 and 390×844 for UI changes. Audio/haptics require
manual device verification.

## Git

- Main branch: `main`
- Initiative branches: `<initiative>/phase-NN`
- Commits: `<type>(<scope>): Phase NN step NN.N — <description>`
- Never rewrite or force-push shared history.
