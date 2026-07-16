// SPDX-License-Identifier: AGPL-3.0-only
// Minimal mobile-play codegen derived from Orbifold's chordToStrudel() and
// rhythmLayerToStrudelLine() engines.

import type { TonnetzQuality } from './finite-tonnetz';

const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'] as const;
const INTERVALS: Record<TonnetzQuality, readonly [number, number, number]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
};

export interface PlayableChord {
  rootPc: number;
  quality: TonnetzQuality;
}

export interface PlayableRhythmLayer {
  steps: readonly number[];
  instrument: 'sine' | 'square' | 'white';
  note: string;
  gain: number;
  decay: number;
  lpf: number;
}

export interface PlayableSnapshot {
  chords?: readonly PlayableChord[];
  rhythmLayers?: readonly PlayableRhythmLayer[];
}

const HARMONY_CHAIN =
  '.s("triangle").lpf(1800).gain(0.34).room(0.25).attack(0.02).decay(0.45).sustain(0.16).release(0.7)';

function chordVoicing(chord: PlayableChord, octave = 3): string[] {
  return INTERVALS[chord.quality].map((interval) => {
    const absolute = chord.rootPc + interval;
    const pitchClass = ((absolute % 12) + 12) % 12;
    const noteOctave = octave + Math.floor(absolute / 12);
    return `${NOTE_NAMES[pitchClass]}${noteOctave}`;
  });
}

export function chordPattern(chord: PlayableChord): string {
  const notes = chordVoicing(chord).join(',');
  return `note("${notes}")${HARMONY_CHAIN}`;
}

export function harmonyPattern(chords: readonly PlayableChord[]): string {
  if (chords.length === 0) return 'silence';
  if (chords.length === 1) return chordPattern(chords[0] as PlayableChord);
  const progression = chords.map((chord) => `[${chordVoicing(chord).join(',')}]`).join(' ');
  return `note("<${progression}>")${HARMONY_CHAIN}`;
}

export function rhythmPattern(layer: PlayableRhythmLayer): string {
  const notes = layer.steps.map((active) => (active ? layer.note : '~')).join(' ');
  return `note("${notes}").s("${layer.instrument}").lpf(${layer.lpf}).gain(${layer.gain}).attack(0.001).decay(${layer.decay}).sustain(0).release(0.02)`;
}

export function buildPlayablePattern(snapshot: PlayableSnapshot): string {
  const lines: string[] = [];
  if (snapshot.chords?.length) lines.push(harmonyPattern(snapshot.chords));
  for (const layer of snapshot.rhythmLayers ?? []) {
    if (layer.steps.some(Boolean)) lines.push(rhythmPattern(layer));
  }

  if (lines.length === 0) return 'silence';
  if (lines.length === 1) return lines[0] ?? 'silence';
  return `stack(\n${lines.map((line) => `  ${line}`).join(',\n')}\n)`;
}
