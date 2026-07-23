// SPDX-License-Identifier: AGPL-3.0-only

import { HARMONY_DURATION_STEPS } from '../../music-core/src/harmony-duration';

export function durationIndexFromPosition(x: number, width: number): number {
  if (width <= 0) return 0;
  const normalized = Math.max(0, Math.min(1, x / width));
  return Math.round(normalized * (HARMONY_DURATION_STEPS.length - 1));
}
