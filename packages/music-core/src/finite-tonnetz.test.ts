// SPDX-License-Identifier: AGPL-3.0-only
// Parity source: Orbifold src/core/theory/tonnetz.ts and reference/orbifold.html
// buildTonnetz() triangle rules.
import { describe, expect, it } from 'vitest';

import { createFiniteTonnetz, tonnetzPc } from './finite-tonnetz';

describe('finite Diamond Tonnetz', () => {
  it('preserves the Tonnetz pitch-class formula for negative coordinates', () => {
    expect(tonnetzPc(0, 0)).toBe(0);
    expect(tonnetzPc(1, 0)).toBe(7);
    expect(tonnetzPc(0, 1)).toBe(4);
    expect(tonnetzPc(-1, 0)).toBe(5);
  });

  it('contains exactly the 24 major/minor pitch-class triads once', () => {
    const faces = createFiniteTonnetz();
    const identities = faces.map((face) => `${face.rootPc}:${face.quality}`);

    expect(faces).toHaveLength(24);
    expect(new Set(identities).size).toBe(24);
    expect(faces.filter((face) => face.quality === 'maj')).toHaveLength(12);
    expect(faces.filter((face) => face.quality === 'min')).toHaveLength(12);
  });

  it('keeps prototype triangle pitch classes for every cell', () => {
    for (const face of createFiniteTonnetz()) {
      const { i, j } = face.cell;
      const vertices =
        face.quality === 'maj'
          ? [tonnetzPc(i, j), tonnetzPc(i + 1, j), tonnetzPc(i, j + 1)]
          : [tonnetzPc(i + 1, j), tonnetzPc(i, j + 1), tonnetzPc(i + 1, j + 1)];

      expect(new Set(face.pitchClasses)).toEqual(new Set(vertices));
      expect(face.vertices.map((vertex) => vertex.pitchClass)).toEqual(vertices);
    }
  });

  it('forms one edge-connected Diamond Tonnetz with shared note vertices', () => {
    const faces = createFiniteTonnetz();
    const vertexKey = (vertex: (typeof faces)[number]['vertices'][number]): string =>
      `${vertex.i}:${vertex.j}`;
    const edgeKeys = faces.map((face) => {
      const [a, b, c] = face.vertices.map(vertexKey);
      return [[a, b].sort().join('|'), [b, c].sort().join('|'), [c, a].sort().join('|')];
    });
    const neighbors = faces.map(() => new Set<number>());

    for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
      for (let candidateIndex = faceIndex + 1; candidateIndex < faces.length; candidateIndex += 1) {
        if (edgeKeys[faceIndex]?.some((edge) => edgeKeys[candidateIndex]?.includes(edge))) {
          neighbors[faceIndex]?.add(candidateIndex);
          neighbors[candidateIndex]?.add(faceIndex);
        }
      }
    }

    const visited = new Set([0]);
    const pending = [0];
    while (pending.length > 0) {
      const current = pending.pop() as number;
      for (const neighbor of neighbors[current] ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        pending.push(neighbor);
      }
    }

    const pitchByVertex = new Map<string, Set<number>>();
    for (const face of faces) {
      for (const vertex of face.vertices) {
        const pitches = pitchByVertex.get(vertexKey(vertex)) ?? new Set<number>();
        pitches.add(vertex.pitchClass);
        pitchByVertex.set(vertexKey(vertex), pitches);
      }
    }

    expect(visited.size).toBe(24);
    expect(pitchByVertex.size).toBe(20);
    expect([...pitchByVertex.values()].every((pitches) => pitches.size === 1)).toBe(true);
    expect(faces.map((face) => face.id)).toContain('0:0:maj');
    expect(faces.map((face) => face.id)).toContain('3:-4:min');
    expect(faces.map((face) => face.id)).not.toContain('3:-1:min');
    expect(faces.map((face) => face.id)).not.toContain('0:-3:maj');
  });

  it('uses the approved 1–4–5–5–4–1 compact Diamond vertex rows', () => {
    const vertices = new Map<string, { i: number; j: number; pitchClass: number }>();
    for (const face of createFiniteTonnetz()) {
      for (const item of face.vertices) vertices.set(`${item.i}:${item.j}`, item);
    }

    const rows = [1, 0, -1, -2, -3, -4].map((j) =>
      [...vertices.values()]
        .filter((item) => item.j === j)
        .sort((left, right) => left.i - right.i)
        .map((item) => item.pitchClass),
    );

    expect(rows).toEqual([
      [4],
      [0, 7, 2, 9],
      [8, 3, 10, 5, 0],
      [4, 11, 6, 1, 8],
      [7, 2, 9, 4],
      [0],
    ]);
  });
});
