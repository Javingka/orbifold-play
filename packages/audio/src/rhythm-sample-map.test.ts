// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';

import { buildRhythmSampleMap } from './rhythm-sample-map';

describe('mobile rhythm sample map', () => {
  it('registers four local round-robin variants for every organic sound', () => {
    const map = buildRhythmSampleMap();
    expect(Object.keys(map)).toEqual(['cajon', 'conga', 'wood', 'shaker']);
    expect(Object.values(map).every((variants) => variants.length === 4)).toBe(true);
    expect(map.cajon?.[0]).toBe('samples/cajon_0.ogg');
    expect(map.shaker?.[3]).toBe('samples/shaker_3.ogg');
  });

  it('normalizes a deployment base path', () => {
    expect(buildRhythmSampleMap('/orbifold-play').wood?.[2]).toBe(
      '/orbifold-play/samples/wood_2.ogg',
    );
  });
});
