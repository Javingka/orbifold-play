// SPDX-License-Identifier: AGPL-3.0-only
// Finite Tonnetz identity ported from reference/orbifold.html.

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
 * Compact Diamond Tonnetz agreed for the mobile instrument.
 *
 * Its vertex rows contain 1–4–5–5–4–1 notes. Every interior horizontal edge
 * is the literal shared base of an opposite major/minor pair, so adjacent chord
 * faces reuse the same Tonnetz vertices instead of merely repeating labels.
 * The cut contains all 24 major/minor identities exactly once.
 */
export function createFiniteTonnetz(): readonly FiniteTonnetzFace[] {
  const faces: FiniteTonnetzFace[] = [createFace(0, 0, 'maj')];

  for (let i = 0; i < 4; i += 1) faces.push(createFace(i, -1, 'maj'));
  for (let i = 0; i < 3; i += 1) faces.push(createFace(i, -1, 'min'));

  for (let i = 0; i < 4; i += 1) {
    faces.push(createFace(i, -2, 'maj'));
    faces.push(createFace(i, -2, 'min'));
  }

  for (let i = 1; i < 4; i += 1) faces.push(createFace(i, -3, 'maj'));
  for (let i = 0; i < 4; i += 1) faces.push(createFace(i, -3, 'min'));

  faces.push(createFace(3, -4, 'min'));
  return faces;
}
