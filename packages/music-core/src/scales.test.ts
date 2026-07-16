// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';

import type { TonnetzQuality } from './finite-tonnetz';
import { resolveDiatonicFaceRole } from './scales';

function face(rootPc: number, quality: TonnetzQuality) {
  return { rootPc, quality };
}

describe('resolveDiatonicFaceRole', () => {
  it('maps finite C-major faces to the original tonal functions', () => {
    expect(resolveDiatonicFaceRole(face(0, 'maj'), 0, 'major')).toEqual({
      degree: 0,
      tonalFunction: 'tonic',
    });
    expect(resolveDiatonicFaceRole(face(2, 'min'), 0, 'major')).toEqual({
      degree: 1,
      tonalFunction: 'subdominant',
    });
    expect(resolveDiatonicFaceRole(face(7, 'maj'), 0, 'major')).toEqual({
      degree: 4,
      tonalFunction: 'dominant',
    });
  });

  it('does not mark a non-diatonic quality at the same root', () => {
    expect(resolveDiatonicFaceRole(face(0, 'min'), 0, 'major')).toBeNull();
  });

  it('supports the natural-minor tonic', () => {
    expect(resolveDiatonicFaceRole(face(0, 'min'), 0, 'minor')).toEqual({
      degree: 0,
      tonalFunction: 'tonic',
    });
  });
});
