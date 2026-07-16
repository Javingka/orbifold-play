// SPDX-License-Identifier: AGPL-3.0-only
// Finite Tonnetz identity derived from Orbifold src/core/theory/tonnetz.ts.

export type TonnetzQuality = 'maj' | 'min';

export interface TonnetzCell {
  i: number;
  j: number;
  rootPc: number;
}

export interface FiniteTonnetzFace {
  id: string;
  cell: TonnetzCell;
  rootPc: number;
  quality: TonnetzQuality;
  pitchClasses: readonly [number, number, number];
}

export function tonnetzPc(i: number, j: number): number {
  return (((7 * i + 4 * j) % 12) + 12) % 12;
}

function triad(rootPc: number, quality: TonnetzQuality): readonly [number, number, number] {
  const third = quality === 'maj' ? 4 : 3;
  return [rootPc, (rootPc + third) % 12, (rootPc + 7) % 12];
}

/**
 * Compact 4 × 3 fundamental region. Its cell roots are all twelve pitch classes
 * exactly once because pc(i,j) = 7i + 4j (mod 12). Splitting every cell into its
 * upward major and downward minor triangle yields all 24 major/minor triads once.
 */
export function createFiniteTonnetz(): readonly FiniteTonnetzFace[] {
  const faces: FiniteTonnetzFace[] = [];

  for (let j = 0; j < 3; j += 1) {
    for (let i = 0; i < 4; i += 1) {
      const cellRoot = tonnetzPc(i, j);
      const cell = { i, j, rootPc: cellRoot };
      const minorRoot = tonnetzPc(i, j + 1);

      faces.push({
        id: `${i}:${j}:maj`,
        cell,
        rootPc: cellRoot,
        quality: 'maj',
        pitchClasses: triad(cellRoot, 'maj'),
      });
      faces.push({
        id: `${i}:${j}:min`,
        cell,
        rootPc: minorRoot,
        quality: 'min',
        pitchClasses: triad(minorRoot, 'min'),
      });
    }
  }

  return faces;
}
