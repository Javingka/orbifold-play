// SPDX-License-Identifier: AGPL-3.0-only

import type { FiniteTonnetzFace, TonnetzVertex } from '../../music-core/src/finite-tonnetz';
import {
  resolveDiatonicFaceRole,
  type ScaleMode,
  type TonalFunction,
} from '../../music-core/src/scales';

export type FluidTonnetzRole = TonalFunction | 'outside';

export interface FluidTonnetzMaterial {
  colors: readonly [string, string, string];
  edgeColor: string;
  gradientAngle: number;
  inScale: boolean;
  labelOpacity: number;
  opacity: number;
  radiant: boolean;
  role: FluidTonnetzRole;
}

export interface FluidTonnetzMotionPolicy {
  animateGeometry: boolean;
  animateRadiance: boolean;
  selectedOffset: number;
  selectedScale: number;
}

const STACK_GLOW_COLORS: Record<FluidTonnetzRole, readonly [string, string, string]> = {
  tonic: ['#FF6B6B', '#FF8E53', '#FFD166'],
  subdominant: ['#4ECDC4', '#44A08D', '#9CF5DE'],
  dominant: ['#F093FB', '#F5576C', '#FF8FB4'],
  outside: ['#667EEA', '#764BA2', '#1D2640'],
};

function vertexKey(vertex: Pick<TonnetzVertex, 'i' | 'j'>): string {
  return `${vertex.i}:${vertex.j}`;
}

function edgeKeys(face: Pick<FiniteTonnetzFace, 'vertices'>): readonly string[] {
  const [a, b, c] = face.vertices.map(vertexKey);
  return [[a, b].sort().join('|'), [b, c].sort().join('|'), [c, a].sort().join('|')];
}

export function resolveFluidTonnetzRings(
  faces: readonly FiniteTonnetzFace[],
  originId: string,
  maxDistance = 2,
): ReadonlyMap<string, number> {
  if (!Number.isInteger(maxDistance) || maxDistance < 0) return new Map();

  const originIndex = faces.findIndex((face) => face.id === originId);
  if (originIndex < 0) return new Map();

  const edges = faces.map(edgeKeys);
  const neighbors = faces.map(() => new Set<number>());

  for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
    for (let candidateIndex = faceIndex + 1; candidateIndex < faces.length; candidateIndex += 1) {
      if (edges[faceIndex]?.some((edge) => edges[candidateIndex]?.includes(edge))) {
        neighbors[faceIndex]?.add(candidateIndex);
        neighbors[candidateIndex]?.add(faceIndex);
      }
    }
  }

  const distances = new Map<number, number>([[originIndex, 0]]);
  const pending = [originIndex];
  while (pending.length > 0) {
    const current = pending.shift() as number;
    const distance = distances.get(current) as number;
    if (distance >= maxDistance) continue;

    for (const neighbor of neighbors[current] ?? []) {
      if (distances.has(neighbor)) continue;
      distances.set(neighbor, distance + 1);
      pending.push(neighbor);
    }
  }

  return new Map(
    [...distances.entries()].map(([faceIndex, distance]) => [
      (faces[faceIndex] as FiniteTonnetzFace).id,
      distance,
    ]),
  );
}

export function resolveFluidTonnetzMaterial(
  face: Pick<FiniteTonnetzFace, 'quality' | 'rootPc'>,
  scaleRootPc: number,
  scaleMode: ScaleMode,
  selected: boolean,
): FluidTonnetzMaterial {
  const scaleRole = resolveDiatonicFaceRole(face, scaleRootPc, scaleMode);
  const role = scaleRole?.tonalFunction ?? 'outside';
  const colors = STACK_GLOW_COLORS[role];
  const inScale = scaleRole !== null;

  return {
    colors,
    edgeColor: colors[2],
    gradientAngle: (face.rootPc * 29 + (face.quality === 'min' ? 17 : 0)) % 180,
    inScale,
    labelOpacity: selected ? 1 : inScale ? 0.96 : 0.5,
    opacity: selected ? 1 : inScale ? 0.96 : 0.1,
    radiant: selected,
    role,
  };
}

export function resolveFluidTonnetzMotionPolicy(
  reduceMotion: boolean,
  selected: boolean,
): FluidTonnetzMotionPolicy {
  return {
    animateGeometry: !reduceMotion,
    animateRadiance: !reduceMotion,
    selectedOffset: selected && !reduceMotion ? -2 : 0,
    selectedScale: selected && !reduceMotion ? 1.018 : 1,
  };
}
