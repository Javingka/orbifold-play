// SPDX-License-Identifier: AGPL-3.0-only

export interface HarmonyPlayhead {
  activeIndex: number;
  nextIndex: number;
  phase: number;
}

/** Maps Strudel's audible cycle position to one chord per cycle/bar. */
export function resolveHarmonyPlayhead(
  audibleCycle: number,
  chordCount: number,
): HarmonyPlayhead | null {
  if (!Number.isFinite(audibleCycle) || !Number.isInteger(chordCount) || chordCount <= 0) {
    return null;
  }

  const completedCycles = Math.floor(audibleCycle);
  const activeIndex = ((completedCycles % chordCount) + chordCount) % chordCount;
  const phase = audibleCycle - completedCycles;

  return {
    activeIndex,
    nextIndex: (activeIndex + 1) % chordCount,
    phase,
  };
}
