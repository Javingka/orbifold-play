// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';

import { resolveHarmonyPlayhead } from './harmony-playhead';

describe('resolveHarmonyPlayhead', () => {
  it('advances one chord per audible Strudel cycle', () => {
    expect(resolveHarmonyPlayhead(10.25, 3)).toEqual({
      activeIndex: 1,
      nextIndex: 2,
      phase: 0.25,
    });
    expect(resolveHarmonyPlayhead(11.75, 3)).toEqual({
      activeIndex: 2,
      nextIndex: 0,
      phase: 0.75,
    });
  });

  it('wraps the playhead across the complete progression', () => {
    expect(resolveHarmonyPlayhead(12, 3)).toEqual({
      activeIndex: 0,
      nextIndex: 1,
      phase: 0,
    });
  });

  it('uses each chord duration to normalize its local progress bar', () => {
    expect(resolveHarmonyPlayhead(0.25, [0.5, 2, 1])).toEqual({
      activeIndex: 0,
      nextIndex: 1,
      phase: 0.5,
    });
    expect(resolveHarmonyPlayhead(1.5, [0.5, 2, 1])).toEqual({
      activeIndex: 1,
      nextIndex: 2,
      phase: 0.5,
    });
    expect(resolveHarmonyPlayhead(3, [0.5, 2, 1])).toEqual({
      activeIndex: 2,
      nextIndex: 0,
      phase: 0.5,
    });
  });

  it('keeps muted-slot timing possible by treating durations independently from sound', () => {
    expect(resolveHarmonyPlayhead(4.25, [1, 3])).toEqual({
      activeIndex: 0,
      nextIndex: 1,
      phase: 0.25,
    });
  });

  it('rejects invalid cycle and progression inputs', () => {
    expect(resolveHarmonyPlayhead(Number.NaN, 4)).toBeNull();
    expect(resolveHarmonyPlayhead(2, 0)).toBeNull();
    expect(resolveHarmonyPlayhead(2, 2.5)).toBeNull();
    expect(resolveHarmonyPlayhead(2, [1, 0, 2])).toBeNull();
  });
});
