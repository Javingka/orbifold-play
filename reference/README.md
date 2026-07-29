# Reference-only sources

Files in this directory are immutable reference snapshots used to verify
explicitly approved musical behavior ports.

- `orbifold.html`: historical prototype source for finite Tonnetz and Euclidean
  behavior already ported into pure Orbifold Play modules.
- `beatbox-lab_7.html`: rhythm-capture parity source.

These files:

- are not production code;
- are not included by Expo, TypeScript, ESLint, or Vitest;
- must never be imported by `src/app`, `components`, or `packages`;
- do not authorize access to or modification of the separate Orbifold desktop
  repository;
- may be changed only when the Pilot explicitly approves replacing a reference
  snapshot.
