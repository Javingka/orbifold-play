// SPDX-License-Identifier: AGPL-3.0-only
// Parity source: Orbifold src/core/theory/tonnetz.ts and reference/orbifold.html
// buildTonnetz() triangle rules.
import { describe, expect, it } from 'vitest';

import { createFiniteTonnetz, tonnetzPc } from './finite-tonnetz';

describe('finite Tonnetz fundamental region', () => {
  it('preserves the Tonnetz pitch-class formula for negative coordinates', () => {
    expect(tonnetzPc(0, 0)).toBe(0);
    expect(tonnetzPc(1, 0)).toBe(7);
    expect(tonnetzPc(0, 1)).toBe(4);
    expect(tonnetzPc(-1, 0)).toBe(5);
  });

  it('contains exactly the 24 major/minor pitch-class triads once', () => {
    const faces = createFiniteTonnetz();
    const identities = faces.map((face) => `${face.rootPc}:${face.quality}`);

    expect(faces).toHaveLength(24);
    expect(new Set(identities).size).toBe(24);
    expect(faces.filter((face) => face.quality === 'maj')).toHaveLength(12);
    expect(faces.filter((face) => face.quality === 'min')).toHaveLength(12);
  });

  it('keeps prototype triangle pitch classes for every cell', () => {
    for (const face of createFiniteTonnetz()) {
      const { i, j } = face.cell;
      const vertices =
        face.quality === 'maj'
          ? [tonnetzPc(i, j), tonnetzPc(i + 1, j), tonnetzPc(i, j + 1)]
          : [tonnetzPc(i + 1, j), tonnetzPc(i, j + 1), tonnetzPc(i + 1, j + 1)];

      expect(new Set(face.pitchClasses)).toEqual(new Set(vertices));
    }
  });
});
