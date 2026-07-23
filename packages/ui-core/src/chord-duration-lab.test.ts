// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';

import { durationIndexFromPosition } from './chord-duration-lab';

describe('chord duration lab helpers', () => {
  it('maps the five slider regions to stepped duration indexes', () => {
    expect(durationIndexFromPosition(0, 100)).toBe(0);
    expect(durationIndexFromPosition(25, 100)).toBe(1);
    expect(durationIndexFromPosition(50, 100)).toBe(2);
    expect(durationIndexFromPosition(75, 100)).toBe(3);
    expect(durationIndexFromPosition(100, 100)).toBe(4);
  });

  it('clamps pointer positions outside the rail', () => {
    expect(durationIndexFromPosition(-20, 100)).toBe(0);
    expect(durationIndexFromPosition(140, 100)).toBe(4);
    expect(durationIndexFromPosition(10, 0)).toBe(0);
  });
});
