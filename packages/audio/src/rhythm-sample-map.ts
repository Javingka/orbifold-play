// SPDX-License-Identifier: AGPL-3.0-only
// Local CC0 rhythm samples used by the mobile instrument.

export function buildRhythmSampleMap(base = ''): Record<string, string[]> {
  const normalizedBase = base.length === 0 || base.endsWith('/') ? base : `${base}/`;
  const sampleRoot = `${normalizedBase}samples/`;
  return {
    cajon: ['cajon_0', 'cajon_1', 'cajon_2', 'cajon_3'].map((name) => `${sampleRoot}${name}.ogg`),
    conga: ['conga_0', 'conga_1', 'conga_2', 'conga_3'].map((name) => `${sampleRoot}${name}.ogg`),
    wood: ['wood_0', 'wood_1', 'wood_2', 'wood_3'].map((name) => `${sampleRoot}${name}.ogg`),
    shaker: ['shaker_0', 'shaker_1', 'shaker_2', 'shaker_3'].map(
      (name) => `${sampleRoot}${name}.ogg`,
    ),
  };
}
