// SPDX-License-Identifier: AGPL-3.0-only
// Sound palette metadata shared by the mobile rhythm engine and its selector UI.

export type RhythmOrbitRole = 'pulse' | 'click' | 'air';

export type RhythmSoundId =
  'kit' | 'hybrid' | 'cajon' | 'conga' | 'wood' | 'shaker' | 'sub' | 'digital' | 'noise';

interface RhythmSoundBase {
  id: RhythmSoundId;
  title: string;
  subtitle: string;
}

export interface HybridRhythmSound extends RhythmSoundBase {
  kind: 'hybrid';
}

/** Role-aware synthesized drum kit: kick / snare / hat per orbit role. */
export interface KitRhythmSound extends RhythmSoundBase {
  kind: 'kit';
}

export interface SampleRhythmSound extends RhythmSoundBase {
  kind: 'sample';
  sampleName: 'cajon' | 'conga' | 'wood' | 'shaker';
  variants: number;
  gain: number;
  hpf: number;
  lpf: number;
  room: number;
  roomSize: number;
  pan: number;
}

export interface SynthRhythmSound extends RhythmSoundBase {
  kind: 'synth';
  instrument: 'sine' | 'square' | 'white';
  note: string;
  gain: number;
  decay: number;
  hpf: number;
  lpf: number;
  room: number;
  roomSize: number;
  pan: number;
}

export type RhythmSoundOption =
  | HybridRhythmSound
  | KitRhythmSound
  | SampleRhythmSound
  | SynthRhythmSound;

export const RHYTHM_SOUND_OPTIONS = [
  // First entry is the app default (getRhythmSoundOption falls back to it).
  { id: 'kit', kind: 'kit', title: 'KIT', subtitle: 'KICK SNARE HAT' },
  { id: 'hybrid', kind: 'hybrid', title: 'HYBRID', subtitle: 'ORGANIC + SYNTH' },
  {
    id: 'cajon',
    kind: 'sample',
    title: 'CAJÓN',
    subtitle: 'WARM BODY',
    sampleName: 'cajon',
    variants: 4,
    gain: 0.68,
    hpf: 45,
    lpf: 7600,
    room: 0.12,
    roomSize: 1.8,
    pan: 0.46,
  },
  {
    id: 'conga',
    kind: 'sample',
    title: 'CONGA',
    subtitle: 'ROUND SKIN',
    sampleName: 'conga',
    variants: 4,
    gain: 0.62,
    hpf: 55,
    lpf: 6800,
    room: 0.16,
    roomSize: 2.2,
    pan: 0.54,
  },
  {
    id: 'wood',
    kind: 'sample',
    title: 'WOOD',
    subtitle: 'CLEAR ATTACK',
    sampleName: 'wood',
    variants: 4,
    gain: 0.5,
    hpf: 180,
    lpf: 9400,
    room: 0.18,
    roomSize: 1.7,
    pan: 0.42,
  },
  {
    id: 'shaker',
    kind: 'sample',
    title: 'SHAKER',
    subtitle: 'OPEN TEXTURE',
    sampleName: 'shaker',
    variants: 4,
    gain: 0.42,
    hpf: 900,
    lpf: 13_000,
    room: 0.28,
    roomSize: 3.2,
    pan: 0.58,
  },
  {
    id: 'sub',
    kind: 'synth',
    title: 'SUB',
    subtitle: 'DEEP SINE',
    instrument: 'sine',
    note: 'c2',
    gain: 0.34,
    decay: 0.18,
    hpf: 25,
    lpf: 720,
    room: 0.04,
    roomSize: 1.2,
    pan: 0.5,
  },
  {
    id: 'digital',
    kind: 'synth',
    title: 'DIGITAL',
    subtitle: 'SHARP PLUCK',
    instrument: 'square',
    note: 'g4',
    gain: 0.13,
    decay: 0.05,
    hpf: 100,
    lpf: 3800,
    room: 0.12,
    roomSize: 1.5,
    pan: 0.45,
  },
  {
    id: 'noise',
    kind: 'synth',
    title: 'NOISE',
    subtitle: 'SOFT AIR',
    instrument: 'white',
    note: 'c6',
    gain: 0.075,
    decay: 0.055,
    hpf: 3200,
    lpf: 12_000,
    room: 0.3,
    roomSize: 3.4,
    pan: 0.57,
  },
] as const satisfies readonly RhythmSoundOption[];

export function getRhythmSoundOption(id: RhythmSoundId): RhythmSoundOption {
  return RHYTHM_SOUND_OPTIONS.find((option) => option.id === id) ?? RHYTHM_SOUND_OPTIONS[0];
}
