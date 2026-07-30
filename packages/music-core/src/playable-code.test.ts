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

  it('arranges variable chord durations without changing global tempo', () => {
    const code = harmonyPattern([
      { rootPc: 0, quality: 'maj', duration: 0.5 },
      { rootPc: 9, quality: 'min', duration: 2 },
      { rootPc: 5, quality: 'maj', duration: 1, muted: true },
    ]);
    expect(code).toContain('[0.5, note("c3,e3,g3")');
    expect(code).toContain('.slow(0.5)');
    expect(code).toContain('[2, note("a3,c4,e4")');
    expect(code).toContain('.slow(2)');
    expect(code).toContain('[1, silence]');
    expect(code).not.toContain('.fast');
  });

  it('returns silence when every timed chord is muted', () => {
    expect(
      harmonyPattern([
        { rootPc: 0, quality: 'maj', duration: 2, muted: true },
        { rootPc: 9, quality: 'min', duration: 0.5, muted: true },
      ]),
    ).toBe('silence');
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

  it('voices the synthesized kit per role without sample assets', () => {
    const kick = rhythmPattern({ steps: [1, 0, 0, 0], soundId: 'kit', role: 'pulse', audioOrbit: 2 });
    // Pitch-enveloped sine kick, no sample token.
    expect(kick).toContain('.s("sine")');
    expect(kick).toContain('.penv(24)');
    expect(kick).not.toContain('cajon');
    expect(kick).toContain('.orbit(2)');

    const snare = rhythmPattern({ steps: [1, 0, 0, 0], soundId: 'kit', role: 'click', audioOrbit: 3 });
    expect(snare).toContain('stack(');
    expect(snare).toContain('.s("white")');

    const hat = rhythmPattern({ steps: [1, 0, 0, 0], soundId: 'kit', role: 'air', audioOrbit: 4 });
    expect(hat).toContain('.hpf(6500)');

    for (const code of [kick, snare, hat]) {
      expect(code).not.toContain('.fast');
      expect(code).not.toContain('.slow');
    }
  });
});
