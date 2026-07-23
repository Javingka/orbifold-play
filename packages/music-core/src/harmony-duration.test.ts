// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';

import {
  harmonyDurationLabel,
  isHarmonyDuration,
  HARMONY_DURATION_STEPS,
} from './harmony-duration';

describe('harmony duration', () => {
  it('keeps the current one-bar behavior in the supported duration scale', () => {
    expect(HARMONY_DURATION_STEPS).toEqual([0.5, 1, 2, 3, 4]);
    expect(harmonyDurationLabel(0.5)).toBe('½ BAR');
    expect(harmonyDurationLabel(1)).toBe('1 BAR');
    expect(harmonyDurationLabel(4)).toBe('4 BARS');
  });

  it('rejects unsupported and non-finite durations', () => {
    expect(isHarmonyDuration(3)).toBe(true);
    expect(isHarmonyDuration(1.5)).toBe(false);
    expect(isHarmonyDuration(Number.NaN)).toBe(false);
  });
});
