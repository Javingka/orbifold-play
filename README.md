# Orbifold Play

Orbifold Play is a mobile-first harmony and rhythm instrument. It keeps the
tested Tonnetz, voice-leading, Euclidean rhythm, and Strudel foundations of
[Orbifold](https://github.com/Javingka/orbifold), but presents them as two
tactile, game-like musical objects.

The first playable release is intentionally narrow:

- one finite Tonnetz artifact with the 12 major and 12 minor triads;
- one full-screen Euclidean rhythm orbit view;
- immediate touch interaction, visible transport, and minimal controls;
- an Expo/React Native Web PWA rendered with React Native Skia.

See [ORBIFOLD_PLAY_BRIEF.md](ORBIFOLD_PLAY_BRIEF.md) and
[Phase 01](docs/mobile-play/phases/phase-01.md).

## Development

```sh
pnpm install
pnpm web
pnpm test
pnpm lint
pnpm typecheck
pnpm build:web
```

Audio must begin from a user gesture. The browser implementation uses
`@strudel/web`; native audio is a later adapter, not part of Phase 01.

## License

AGPL-3.0. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
