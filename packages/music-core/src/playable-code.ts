// SPDX-License-Identifier: AGPL-3.0-only
// Minimal mobile-play codegen derived from Orbifold's chordToStrudel() and
// rhythmLayerToStrudelLine() engines.

import type { TonnetzQuality } from './finite-tonnetz';
import type { HarmonyDuration } from './harmony-duration';
import {
  getRhythmSoundOption,
  type RhythmOrbitRole,
  type RhythmSoundId,
  type SampleRhythmSound,
  type SynthRhythmSound,
} from './rhythm-sounds';

const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'] as const;
const INTERVALS: Record<TonnetzQuality, readonly [number, number, number]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
};

export interface PlayableChord {
  duration?: HarmonyDuration;
  muted?: boolean;
  rootPc: number;
  quality: TonnetzQuality;
}

export interface PlayableRhythmLayer {
  steps: readonly number[];
  soundId: RhythmSoundId;
  role: RhythmOrbitRole;
  audioOrbit: number;
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
  const usesDefaultTiming = chords.every((chord) => (chord.duration ?? 1) === 1 && !chord.muted);
  if (usesDefaultTiming && chords.length === 1) return chordPattern(chords[0] as PlayableChord);
  if (usesDefaultTiming) {
    const progression = chords.map((chord) => `[${chordVoicing(chord).join(',')}]`).join(' ');
    return `note("<${progression}>")${HARMONY_CHAIN}`;
  }

  const segments = chords.map((chord) => {
    const duration = chord.duration ?? 1;
    const pattern = chord.muted ? 'silence' : `${chordPattern(chord)}.slow(${duration})`;
    return `  [${duration}, ${pattern}]`;
  });
  if (chords.every((chord) => chord.muted)) return 'silence';
  return `arrange(\n${segments.join(',\n')}\n)`;
}

function velocityPattern(steps: readonly number[]): string {
  let hit = 0;
  return steps
    .map((active, stepIndex) => {
      if (!active) return '0';
      const velocity = stepIndex === 0 ? 1 : ([0.78, 0.9, 0.72, 0.84] as const)[hit % 4];
      hit += 1;
      return String(velocity);
    })
    .join(' ');
}

function sampleTokens(steps: readonly number[], sampleName: string, variants: number): string {
  let hit = 0;
  return steps
    .map((active) => {
      if (!active) return '~';
      const token = `${sampleName}:${hit % variants}`;
      hit += 1;
      return token;
    })
    .join(' ');
}

function noteTokens(steps: readonly number[], note: string): string {
  return steps.map((active) => (active ? note : '~')).join(' ');
}

function sampleRhythmPattern(layer: PlayableRhythmLayer, sound: SampleRhythmSound): string {
  const samples = sampleTokens(layer.steps, sound.sampleName, sound.variants);
  const velocity = velocityPattern(layer.steps);
  return `s("${samples}").velocity("${velocity}").gain(${sound.gain}).hpf(${sound.hpf}).lpf(${sound.lpf}).room(${sound.room}).roomsize(${sound.roomSize}).pan(${sound.pan}).compressor("-18:4:6:.003:.08").orbit(${layer.audioOrbit})`;
}

function synthRhythmPattern(layer: PlayableRhythmLayer, sound: SynthRhythmSound): string {
  const notes = noteTokens(layer.steps, sound.note);
  const velocity = velocityPattern(layer.steps);
  return `note("${notes}").s("${sound.instrument}").velocity("${velocity}").gain(${sound.gain}).attack(0.001).decay(${sound.decay}).sustain(0).release(0.03).hpf(${sound.hpf}).lpf(${sound.lpf}).room(${sound.room}).roomsize(${sound.roomSize}).pan(${sound.pan}).compressor("-18:4:6:.003:.08").orbit(${layer.audioOrbit})`;
}

function hybridRhythmPattern(layer: PlayableRhythmLayer): string {
  const velocity = velocityPattern(layer.steps);
  const sources: Record<RhythmOrbitRole, readonly [string, string]> = {
    pulse: [
      `s("${sampleTokens(layer.steps, 'cajon', 4)}").gain(0.58)`,
      `note("${noteTokens(layer.steps, 'c2')}").s("sine").gain(0.11).attack(0.001).decay(0.16).sustain(0).release(0.03).penv(7).pdecay(0.07)`,
    ],
    click: [
      `s("${sampleTokens(layer.steps, 'wood', 4)}").gain(0.48)`,
      `note("${noteTokens(layer.steps, 'g5')}").s("white").gain(0.025).attack(0.001).decay(0.025).sustain(0).release(0.02)`,
    ],
    air: [
      `s("${sampleTokens(layer.steps, 'shaker', 4)}").gain(0.38)`,
      `note("${noteTokens(layer.steps, 'c6')}").s("white").gain(0.018).attack(0.001).decay(0.045).sustain(0).release(0.03)`,
    ],
  };
  const [organic, synth] = sources[layer.role];
  const effects: Record<RhythmOrbitRole, string> = {
    pulse: '.hpf(35).lpf(7200).room(0.12).roomsize(2).pan(0.47)',
    click: '.hpf(190).lpf(9800).room(0.18).roomsize(1.8).pan(0.43)',
    air: '.hpf(1000).lpf(13500).room(0.3).roomsize(3.5).pan(0.58)',
  };
  return `stack(${organic},${synth}).velocity("${velocity}")${effects[layer.role]}.compressor("-18:4:6:.003:.08").orbit(${layer.audioOrbit})`;
}

export function rhythmPattern(layer: PlayableRhythmLayer): string {
  const sound = getRhythmSoundOption(layer.soundId);
  if (sound.kind === 'sample') return sampleRhythmPattern(layer, sound);
  if (sound.kind === 'synth') return synthRhythmPattern(layer, sound);
  return hybridRhythmPattern(layer);
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
