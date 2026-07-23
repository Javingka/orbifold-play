// SPDX-License-Identifier: AGPL-3.0-only

export const HARMONY_DURATION_STEPS = [0.5, 1, 2, 3, 4] as const;
export type HarmonyDuration = (typeof HARMONY_DURATION_STEPS)[number];

export function harmonyDurationLabel(duration: HarmonyDuration): string {
  if (duration === 0.5) return '½ BAR';
  return `${duration} ${duration === 1 ? 'BAR' : 'BARS'}`;
}

export function isHarmonyDuration(value: number): value is HarmonyDuration {
  return HARMONY_DURATION_STEPS.some((duration) => duration === value);
}
