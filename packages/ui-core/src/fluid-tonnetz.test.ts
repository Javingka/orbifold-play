// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';

import { createFiniteTonnetz } from '../../music-core/src/finite-tonnetz';
import {
  resolveFluidTonnetzMaterial,
  resolveFluidTonnetzMotionPolicy,
  resolveFluidTonnetzRings,
} from './fluid-tonnetz';

describe('fluid Tonnetz interaction model', () => {
  it('derives only the requested graph rings from canonical shared edges', () => {
    const faces = createFiniteTonnetz();
    const origin = faces.find((face) => face.id === '1:1:maj');
    expect(origin).toBeDefined();

    const distances = resolveFluidTonnetzRings(faces, origin?.id ?? '', 2);
    expect(distances.get(origin?.id ?? '')).toBe(0);
    expect([...distances.values()].every((distance) => distance >= 0 && distance <= 2)).toBe(true);
    expect([...distances.values()]).toContain(1);
    expect([...distances.values()]).toContain(2);
    expect(distances.size).toBeLessThan(faces.length);
  });

  it('returns no propagation for an unknown face or invalid distance', () => {
    const faces = createFiniteTonnetz();
    expect(resolveFluidTonnetzRings(faces, 'unknown')).toEqual(new Map());
    expect(resolveFluidTonnetzRings(faces, faces[0]?.id ?? '', -1)).toEqual(new Map());
  });

  it('uses deterministic Stack Glow roles and out-of-scale resting alpha', () => {
    const faces = createFiniteTonnetz();
    const tonic = faces.find((face) => face.rootPc === 0 && face.quality === 'maj');
    const outside = faces.find((face) => face.rootPc === 1 && face.quality === 'maj');
    expect(tonic).toBeDefined();
    expect(outside).toBeDefined();
    if (!tonic || !outside) throw new Error('Expected canonical C and C sharp major faces');

    const tonicMaterial = resolveFluidTonnetzMaterial(tonic, 0, 'major', false);
    const outsideMaterial = resolveFluidTonnetzMaterial(outside, 0, 'major', false);

    expect(tonicMaterial).toMatchObject({ inScale: true, opacity: 0.96, role: 'tonic' });
    expect(tonicMaterial.colors).toEqual(['#FF6B6B', '#FF8E53', '#FFD166']);
    expect(outsideMaterial).toMatchObject({
      inScale: false,
      opacity: 0.1,
      radiant: false,
      role: 'outside',
    });
    expect(resolveFluidTonnetzMaterial(outside, 0, 'major', false).gradientAngle).toBe(
      outsideMaterial.gradientAngle,
    );
  });

  it('makes every selected face fully visible and radiant regardless of scale', () => {
    const outside = createFiniteTonnetz().find(
      (face) => face.rootPc === 1 && face.quality === 'maj',
    );
    expect(outside).toBeDefined();
    if (!outside) throw new Error('Expected canonical C sharp major face');

    expect(resolveFluidTonnetzMaterial(outside, 0, 'major', true)).toMatchObject({
      inScale: false,
      labelOpacity: 1,
      opacity: 1,
      radiant: true,
      role: 'outside',
    });
  });

  it('removes traveling motion but preserves the selected material in reduced-motion mode', () => {
    expect(resolveFluidTonnetzMotionPolicy(true, true)).toEqual({
      animateGeometry: false,
      animateRadiance: false,
      selectedOffset: 0,
      selectedScale: 1,
    });
    expect(resolveFluidTonnetzMotionPolicy(false, true)).toEqual({
      animateGeometry: true,
      animateRadiance: true,
      selectedOffset: -2,
      selectedScale: 1.018,
    });
  });
});
