// SPDX-License-Identifier: AGPL-3.0-only
// Scale intervals and diatonic-face mapping ported from Orbifold's scales engine.

import type { FiniteTonnetzFace, TonnetzQuality } from './finite-tonnetz';

export type ScaleMode =
  | 'major'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'minor'
  | 'locrian'
  | 'harmonic:minor';

export type TonalFunction = 'tonic' | 'subdominant' | 'dominant';

export interface DiatonicFaceRole {
  degree: number;
  tonalFunction: TonalFunction;
}

export const SCALE_INTERVALS: Record<ScaleMode, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  minor: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  'harmonic:minor': [0, 2, 3, 5, 7, 8, 11],
};

function qualityForDegree(intervals: readonly number[], degree: number): TonnetzQuality | null {
  const root = intervals[degree] as number;
  const thirdDegree = degree + 2;
  const fifthDegree = degree + 4;
  const third =
    (intervals[thirdDegree % intervals.length] as number) +
    (thirdDegree >= intervals.length ? 12 : 0) -
    root;
  const fifth =
    (intervals[fifthDegree % intervals.length] as number) +
    (fifthDegree >= intervals.length ? 12 : 0) -
    root;

  if (third === 4 && fifth === 7) return 'maj';
  if (third === 3 && fifth === 7) return 'min';
  return null;
}

function tonalFunctionForDegree(degree: number): TonalFunction {
  if ([0, 2, 5].includes(degree)) return 'tonic';
  if ([1, 3].includes(degree)) return 'subdominant';
  return 'dominant';
}

export function resolveDiatonicFaceRole(
  face: Pick<FiniteTonnetzFace, 'quality' | 'rootPc'>,
  rootPc: number,
  mode: ScaleMode,
): DiatonicFaceRole | null {
  const intervals = SCALE_INTERVALS[mode];

  for (let degree = 0; degree < intervals.length; degree += 1) {
    const quality = qualityForDegree(intervals, degree);
    if (quality === null) continue;
    const degreeRoot = (rootPc + (intervals[degree] as number)) % 12;
    if (face.rootPc === degreeRoot && face.quality === quality) {
      return { degree, tonalFunction: tonalFunctionForDegree(degree) };
    }
  }

  return null;
}
