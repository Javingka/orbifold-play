// SPDX-License-Identifier: AGPL-3.0-only
// Browser-only Strudel adapter. Audio unlock is registered at module load but
// the AudioContext is resumed only by the first user click.
import {
  Pattern,
  defaultPrebake,
  evaluate,
  getAudioContext,
  initAudio,
  miniAllStrings,
  samples,
  webaudioScheduler,
} from '@strudel/web';
import type { Cyclist } from '@strudel/web';

import {
  getRhythmSoundOption,
  type RhythmOrbitRole,
  type RhythmSoundId,
  type SampleRhythmSound,
  type SynthRhythmSound,
} from '@/packages/music-core/src/rhythm-sounds';

import { buildRhythmSampleMap } from './rhythm-sample-map';

export interface PlaybackResult {
  ok: boolean;
  error?: string;
}

let scheduler: Cyclist | null = null;
let playing = false;
let previewRequest = 0;
let previewSources: AudioScheduledSourceNode[] = [];
const previewBuffers = new Map<string, Promise<AudioBuffer>>();
const previewSampleMap = buildRhythmSampleMap();
const previewVariantCursor = new Map<string, number>();

const readyPromise = (async () => {
  miniAllStrings();
  await Promise.all([defaultPrebake(), samples(buildRhythmSampleMap())]);
  scheduler = webaudioScheduler();
  const ownedScheduler = scheduler;
  const patternPrototype = Pattern.prototype as unknown as {
    play(this: unknown): unknown;
  };
  patternPrototype.play = function play(this: unknown) {
    ownedScheduler.setPattern(this as Parameters<Cyclist['setPattern']>[0], true);
    return this;
  };
})();

export function prepareStrudelAudio(): void {
  void readyPromise;
}

function stopPreviewSources(): void {
  for (const source of previewSources) {
    try {
      source.stop();
    } catch {
      // A source that already ended cannot be stopped again.
    }
  }
  previewSources = [];
}

function trackPreviewSource(source: AudioScheduledSourceNode): void {
  previewSources.push(source);
  source.addEventListener('ended', () => {
    previewSources = previewSources.filter((current) => current !== source);
  });
}

function previewSampleUrl(sound: SampleRhythmSound): string {
  const variants = previewSampleMap[sound.sampleName] ?? [];
  const cursor = previewVariantCursor.get(sound.sampleName) ?? 0;
  previewVariantCursor.set(sound.sampleName, cursor + 1);
  return variants[cursor % Math.max(1, variants.length)] ?? '';
}

async function loadPreviewBuffer(context: AudioContext, url: string): Promise<AudioBuffer> {
  const cached = previewBuffers.get(url);
  if (cached) return cached;
  const loading = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Unable to load preview sample: ${response.status}`);
      return response.arrayBuffer();
    })
    .then((data) => context.decodeAudioData(data));
  previewBuffers.set(url, loading);
  try {
    return await loading;
  } catch (error) {
    previewBuffers.delete(url);
    throw error;
  }
}

function connectPreviewChain(
  context: AudioContext,
  source: AudioNode,
  hpf: number,
  lpf: number,
  panValue: number,
  gainValue: number,
): GainNode {
  const highpass = context.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = hpf;
  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = lpf;
  const gain = context.createGain();
  gain.gain.value = gainValue;
  const pan = context.createStereoPanner();
  pan.pan.value = (panValue - 0.5) * 2;
  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(pan);
  pan.connect(context.destination);
  return gain;
}

function playSamplePreview(
  context: AudioContext,
  buffer: AudioBuffer,
  sound: SampleRhythmSound,
  gainScale = 1,
): void {
  const source = context.createBufferSource();
  source.buffer = buffer;
  connectPreviewChain(context, source, sound.hpf, sound.lpf, sound.pan, sound.gain * gainScale);
  trackPreviewSource(source);
  source.start();
}

function noteFrequency(note: string): number {
  const match = /^([a-g])([#b]?)(-?\d+)$/i.exec(note);
  if (!match) return 440;
  const noteName = match[1]?.toLowerCase();
  if (!noteName || !['a', 'b', 'c', 'd', 'e', 'f', 'g'].includes(noteName)) return 440;
  const pitchClass = ({ c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 } as const)[
    noteName as 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g'
  ];
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  const midi = (Number(match[3]) + 1) * 12 + pitchClass + accidental;
  return 440 * 2 ** ((midi - 69) / 12);
}

function playSynthPreview(context: AudioContext, sound: SynthRhythmSound, gainScale = 1): void {
  const now = context.currentTime;
  const duration = Math.max(0.09, sound.decay + 0.08);
  let source: OscillatorNode | AudioBufferSourceNode;
  if (sound.instrument === 'white') {
    const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * duration),
      context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    source = noise;
  } else {
    const oscillator = context.createOscillator();
    oscillator.type = sound.instrument;
    const frequency = noteFrequency(sound.note);
    oscillator.frequency.setValueAtTime(sound.id === 'sub' ? frequency * 1.5 : frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency, now + 0.06);
    source = oscillator;
  }
  const gain = connectPreviewChain(context, source, sound.hpf, sound.lpf, sound.pan, 0.0001);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sound.gain * gainScale), now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  trackPreviewSource(source);
  source.start(now);
  source.stop(now + duration + 0.02);
}

const HYBRID_PREVIEW: Record<
  RhythmOrbitRole,
  { sample: RhythmSoundId; synth: RhythmSoundId; sampleGain: number; synthGain: number }
> = {
  pulse: { sample: 'cajon', synth: 'sub', sampleGain: 0.85, synthGain: 0.34 },
  click: { sample: 'wood', synth: 'noise', sampleGain: 0.92, synthGain: 0.28 },
  air: { sample: 'shaker', synth: 'noise', sampleGain: 0.9, synthGain: 0.22 },
};

export async function previewRhythmSound(
  soundId: RhythmSoundId,
  role: RhythmOrbitRole,
): Promise<PlaybackResult> {
  const request = ++previewRequest;
  stopPreviewSources();
  try {
    // This starts in the card's gesture call stack and does not touch the pattern scheduler.
    void initAudio({ disableWorklets: true });
    await readyPromise;
    const context = getAudioContext();
    if (context.state === 'suspended') await context.resume();
    const sound = getRhythmSoundOption(soundId);

    if (sound.kind === 'sample') {
      const url = previewSampleUrl(sound);
      if (!url) throw new Error(`No preview sample registered for ${sound.sampleName}`);
      const buffer = await loadPreviewBuffer(context, url);
      if (request !== previewRequest) return { ok: true };
      playSamplePreview(context, buffer, sound);
      return { ok: true };
    }

    if (sound.kind === 'synth') {
      playSynthPreview(context, sound);
      return { ok: true };
    }

    const hybrid = HYBRID_PREVIEW[role];
    const sample = getRhythmSoundOption(hybrid.sample);
    const synth = getRhythmSoundOption(hybrid.synth);
    if (sample.kind !== 'sample' || synth.kind !== 'synth') {
      throw new Error('Invalid hybrid preview configuration');
    }
    const sampleUrl = previewSampleUrl(sample);
    if (!sampleUrl) throw new Error(`No preview sample registered for ${sample.sampleName}`);
    const buffer = await loadPreviewBuffer(context, sampleUrl);
    if (request !== previewRequest) return { ok: true };
    playSamplePreview(context, buffer, sample, hybrid.sampleGain);
    playSynthPreview(context, synth, hybrid.synthGain);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function playStrudel(code: string, bpm: number): Promise<PlaybackResult> {
  try {
    // resume() must be invoked synchronously from the gesture call stack. Some
    // browsers leave its Promise pending while they finish activating audio, so
    // do not block pattern preparation on that Promise.
    void initAudio({ disableWorklets: true });
    await readyPromise;
    if (!scheduler) return { ok: false, error: 'Audio scheduler unavailable' };
    scheduler.setCps(Math.max(40, Math.min(280, bpm)) / 240);
    await evaluate(code);
    playing = true;
    return { ok: true };
  } catch (error) {
    playing = false;
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function stopStrudel(): void {
  scheduler?.stop();
  stopPreviewSources();
  playing = false;
}

export function strudelIsPlaying(): boolean {
  return playing;
}

export function getStrudelCycle(): number | null {
  if (!playing || !scheduler?.started) return null;
  try {
    const context = getAudioContext();
    const outputDelaySeconds =
      scheduler.latency + (context.baseLatency || 0) + (context.outputLatency || 0);
    const audibleCycle = scheduler.now() - outputDelaySeconds * scheduler.cps;
    return Number.isFinite(audibleCycle) ? audibleCycle : null;
  } catch {
    return null;
  }
}

export function getStrudelPhase(): number | null {
  const audibleCycle = getStrudelCycle();
  return audibleCycle === null ? null : ((audibleCycle % 1) + 1) % 1;
}
