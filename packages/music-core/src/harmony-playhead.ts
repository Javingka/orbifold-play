// SPDX-License-Identifier: AGPL-3.0-only

export interface HarmonyPlayhead {
  activeIndex: number;
  nextIndex: number;
  phase: number;
}

/** Maps Strudel's audible cycle position to a variable-duration chord progression. */
export function resolveHarmonyPlayhead(
  audibleCycle: number,
  durationsOrChordCount: readonly number[] | number,
): HarmonyPlayhead | null {
  if (!Number.isFinite(audibleCycle)) {
    return null;
  }

  const durations =
    typeof durationsOrChordCount === 'number'
      ? Number.isInteger(durationsOrChordCount) && durationsOrChordCount > 0
        ? Array.from({ length: durationsOrChordCount }, () => 1)
        : []
      : [...durationsOrChordCount];
  if (
    durations.length === 0 ||
    durations.some((duration) => !Number.isFinite(duration) || duration <= 0)
  ) {
    return null;
  }

  const totalDuration = durations.reduce((total, duration) => total + duration, 0);
  const progressionTime = ((audibleCycle % totalDuration) + totalDuration) % totalDuration;
  let elapsed = 0;
  let activeIndex = durations.length - 1;
  for (let index = 0; index < durations.length; index += 1) {
    const duration = durations[index] as number;
    if (progressionTime < elapsed + duration) {
      activeIndex = index;
      break;
    }
    elapsed += duration;
  }

  const activeDuration = durations[activeIndex] as number;
  const phase = (progressionTime - elapsed) / activeDuration;

  return {
    activeIndex,
    nextIndex: (activeIndex + 1) % durations.length,
    phase,
  };
}
