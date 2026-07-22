// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';

import { buildPlayablePattern, chordPattern, harmonyPattern, rhythmPattern } from './playable-code';

describe('mobile playable Strudel codegen', () => {
  it('emits a simultaneous ascending chord voicing', () => {
    expect(chordPattern({ rootPc: 9, quality: 'min' })).toContain('note("a3,c4,e4")');
  });

  it('emits visible rhythm steps without global time stretching', () => {
    const code = rhythmPattern({
      steps: [1, 0, 1, 0],
      soundId: 'sub',
      role: 'pulse',
      audioOrbit: 2,
    });
    expect(code).toContain('note("c2 ~ c2 ~")');
    expect(code).not.toContain('.fast');
    expect(code).not.toContain('.slow');
  });

  it('emits an ordered slow chord sequence', () => {
    expect(
      harmonyPattern([
        { rootPc: 0, quality: 'maj' },
        { rootPc: 9, quality: 'min' },
      ]),
    ).toContain('note("<[c3,e3,g3] [a3,c4,e4]>")');
  });

  it('stacks harmony and rhythm and returns silence for an empty snapshot', () => {
    expect(buildPlayablePattern({})).toBe('silence');
    expect(
      buildPlayablePattern({
        chords: [{ rootPc: 0, quality: 'maj' }],
        rhythmLayers: [
          {
            steps: [1, 0, 0, 0],
            soundId: 'digital',
            role: 'click',
            audioOrbit: 3,
          },
        ],
      }),
    ).toMatch(/^stack\(/);
  });

  it('round-robins local samples and keeps timing modifiers out of rhythm code', () => {
    const code = rhythmPattern({
      steps: [1, 0, 1, 1, 0, 1],
      soundId: 'cajon',
      role: 'pulse',
      audioOrbit: 2,
    });
    expect(code).toContain('s("cajon:0 ~ cajon:1 cajon:2 ~ cajon:3")');
    expect(code).toContain('.velocity("1 0 0.9 0.72 0 0.84")');
    expect(code).toContain('.orbit(2)');
    expect(code).not.toContain('.fast');
    expect(code).not.toContain('.slow');
  });

  it('builds role-specific hybrid layers without moving their events', () => {
    const code = rhythmPattern({
      steps: [1, 0, 0, 1],
      soundId: 'hybrid',
      role: 'air',
      audioOrbit: 4,
    });
    expect(code).toContain('shaker:0 ~ ~ shaker:1');
    expect(code).toContain('.hpf(1000)');
    expect(code).toContain('.orbit(4)');
    expect(code).not.toContain('.fast');
    expect(code).not.toContain('.slow');
  });
});
