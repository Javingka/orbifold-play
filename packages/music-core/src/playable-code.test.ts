// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';

import { buildPlayablePattern, chordPattern, rhythmPattern } from './playable-code';

describe('mobile playable Strudel codegen', () => {
  it('emits a simultaneous ascending chord voicing', () => {
    expect(chordPattern({ rootPc: 9, quality: 'min' })).toContain('note("a3,c4,e4")');
  });

  it('emits visible rhythm steps without global time stretching', () => {
    const code = rhythmPattern({
      steps: [1, 0, 1, 0],
      instrument: 'sine',
      note: 'c2',
      gain: 0.5,
      decay: 0.1,
      lpf: 900,
    });
    expect(code).toContain('note("c2 ~ c2 ~")');
    expect(code).not.toContain('.fast');
    expect(code).not.toContain('.slow');
  });

  it('stacks harmony and rhythm and returns silence for an empty snapshot', () => {
    expect(buildPlayablePattern({})).toBe('silence');
    expect(
      buildPlayablePattern({
        chord: { rootPc: 0, quality: 'maj' },
        rhythmLayers: [
          {
            steps: [1, 0, 0, 0],
            instrument: 'square',
            note: 'g4',
            gain: 0.2,
            decay: 0.04,
            lpf: 2400,
          },
        ],
      }),
    ).toMatch(/^stack\(/);
  });
});
