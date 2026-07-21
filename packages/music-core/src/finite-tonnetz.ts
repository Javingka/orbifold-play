// SPDX-License-Identifier: AGPL-3.0-only
// Finite Tonnetz identity derived from Orbifold src/core/theory/tonnetz.ts.

export type TonnetzQuality = 'maj' | 'min';

export interface TonnetzCell {
  i: number;
  j: number;
  rootPc: number;
}

export interface TonnetzVertex {
  i: number;
  j: number;
  pitchClass: number;
}

export interface FiniteTonnetzFace {
  id: string;
  cell: TonnetzCell;
  rootPc: number;
  quality: TonnetzQuality;
  pitchClasses: readonly [number, number, number];
  vertices: readonly [TonnetzVertex, TonnetzVertex, TonnetzVertex];
}

export function tonnetzPc(i: number, j: number): number {
  return (((7 * i + 4 * j) % 12) + 12) % 12;
}

function triad(rootPc: number, quality: TonnetzQuality): readonly [number, number, number] {
  const third = quality === 'maj' ? 4 : 3;
  return [rootPc, (rootPc + third) % 12, (rootPc + 7) % 12];
}

function vertex(i: number, j: number): TonnetzVertex {
  return { i, j, pitchClass: tonnetzPc(i, j) };
}

function createFace(i: number, j: number, quality: TonnetzQuality): FiniteTonnetzFace {
  const a = vertex(i, j);
  const b = vertex(i + 1, j);
  const c = vertex(i, j + 1);
  const d = vertex(i + 1, j + 1);
  const rootPc = quality === 'maj' ? a.pitchClass : c.pitchClass;

  return {
    id: `${i}:${j}:${quality}`,
    cell: { i, j, rootPc: a.pitchClass },
    rootPc,
    quality,
    pitchClasses: triad(rootPc, quality),
    vertices: quality === 'maj' ? [a, b, c] : [b, c, d],
  };
}

/**
 * Centrally symmetric Diamond Tonnetz cut from the compact 4 × 3 fundamental
 * region. Two opposite boundary faces are replaced by their periodic Tonnetz
 * equivalents: (0,0,maj) → (0,3,maj) and (3,2,min) → (3,-1,min).
 *
 * The cut keeps all 24 major/minor identities exactly once, while every face is
 * still derived from shared lattice vertices using pc(i,j) = 7i + 4j (mod 12).
 * This is the finite mobile silhouette; it is not a visual remapping of chords.
 */
export function createFiniteTonnetz(): readonly FiniteTonnetzFace[] {
  const faces: FiniteTonnetzFace[] = [createFace(3, -1, 'min')];

  for (let j = 0; j < 3; j += 1) {
    for (let i = 0; i < 4; i += 1) {
      if (!(i === 0 && j === 0)) faces.push(createFace(i, j, 'maj'));
      if (!(i === 3 && j === 2)) faces.push(createFace(i, j, 'min'));
    }
  }

  faces.push(createFace(0, 3, 'maj'));
  return faces;
}
