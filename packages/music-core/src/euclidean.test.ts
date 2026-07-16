// SPDX-License-Identifier: AGPL-3.0-only
// Parity source: Orbifold src/core/rhythm/euclid.ts and
// reference/orbifold.html lines 794–813.
import { describe, expect, it } from 'vitest';

import { bjorklund, rotate } from './euclidean';

describe('Euclidean rhythm engine', () => {
  it('distributes four hits over sixteen steps', () => {
    expect(bjorklund(4, 16)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  });

  it('preserves the requested hit and step counts', () => {
    const pattern = bjorklund(5, 12);
    expect(pattern).toHaveLength(12);
    expect(pattern.reduce((sum, value) => sum + value, 0)).toBe(5);
  });

  it('rotates in both directions', () => {
    expect(rotate([1, 0, 0, 1], 1)).toEqual([0, 0, 1, 1]);
    expect(rotate([1, 0, 0, 1], -1)).toEqual([1, 1, 0, 0]);
  });
});
