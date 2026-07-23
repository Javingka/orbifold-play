// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';

import { createFiniteTonnetz } from './finite-tonnetz';
import { createHarmonySequenceEntry } from './harmony-sequence';

describe('harmony sequence entry', () => {
  it('preserves the current one-bar audible behavior by default', () => {
    const face = createFiniteTonnetz()[0];
    if (!face) throw new Error('Expected the finite Tonnetz to contain a face');
    expect(createHarmonySequenceEntry(face)).toEqual({ duration: 1, face, muted: false });
  });
});
