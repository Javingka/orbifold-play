// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';

import { estimateYinPitch } from './harmony-capture';
import {
  cumulativeMeanNormalizedDifference,
  extractFrameCandidates,
  fftInPlace,
  segmentNotes,
  trackPitch,
  yinDifference,
  type PyinFrame,
} from './pyin';

const SAMPLE_RATE = 24_000;

/** Deterministic LCG noise so fixtures never depend on Math.random. */
function createNoise(seed = 1): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0xffffffff - 0.5;
  };
}

interface ToneSegment {
  amplitude: number | ((t: number) => number);
  /** Partial amplitudes indexed from the fundamental. */
  harmonics?: readonly number[];
  hz: number | ((t: number) => number);
  seconds: number;
}

function renderTone(
  segments: readonly ToneSegment[],
  noiseLevel = 0,
  sampleRate = SAMPLE_RATE,
): Float32Array {
  const noise = createNoise(7);
  const values: number[] = [];
  for (const segment of segments) {
    const length = Math.round(segment.seconds * sampleRate);
    let phase = 0;
    for (let i = 0; i < length; i += 1) {
      const t = i / sampleRate;
      const hz = typeof segment.hz === 'function' ? segment.hz(t) : segment.hz;
      const amplitude =
        typeof segment.amplitude === 'function' ? segment.amplitude(t) : segment.amplitude;
      phase += (2 * Math.PI * hz) / sampleRate;
      let sample = 0;
      const harmonics = segment.harmonics ?? [1, 0.5, 0.3, 0.2];
      for (let h = 0; h < harmonics.length; h += 1) {
        sample += (harmonics[h] ?? 0) * Math.sin((h + 1) * phase);
      }
      values.push(amplitude * sample + noiseLevel * noise());
    }
  }
  return Float32Array.from(values);
}

function voicedMidis(frames: readonly PyinFrame[]): number[] {
  return frames.filter((frame) => frame.midi > 0 && frame.rms > 0.01).map((frame) => frame.midi);
}

describe('pYIN primitives', () => {
  it('computes the FFT consistently with a direct DFT', () => {
    const n = 16;
    const real = new Float64Array(n);
    const imag = new Float64Array(n);
    const noise = createNoise(3);
    for (let i = 0; i < n; i += 1) real[i] = noise();
    const expected = Array.from({ length: n }, (_, k) => {
      let re = 0;
      let im = 0;
      for (let j = 0; j < n; j += 1) {
        const angle = (-2 * Math.PI * k * j) / n;
        re += (real[j] ?? 0) * Math.cos(angle);
        im += (real[j] ?? 0) * Math.sin(angle);
      }
      return { im, re };
    });
    fftInPlace(real, imag);
    for (let k = 0; k < n; k += 1) {
      expect(real[k]).toBeCloseTo(expected[k]?.re ?? 0, 8);
      expect(imag[k]).toBeCloseTo(expected[k]?.im ?? 0, 8);
    }
  });

  it('matches the direct O(N^2) YIN difference function', () => {
    const frameLength = 256;
    const windowLength = 128;
    const tauMax = 96;
    const frame = new Float64Array(frameLength);
    const noise = createNoise(11);
    for (let i = 0; i < frameLength; i += 1) frame[i] = noise();
    const fast = yinDifference(frame, windowLength, tauMax);
    for (let tau = 0; tau <= tauMax; tau += 1) {
      let direct = 0;
      for (let j = 0; j < windowLength; j += 1) {
        const delta = (frame[j] ?? 0) - (frame[j + tau] ?? 0);
        direct += delta * delta;
      }
      expect(fast[tau]).toBeCloseTo(direct, 6);
    }
  });

  it('distributes candidate probability over CMND troughs', () => {
    const tone = renderTone([{ amplitude: 0.5, harmonics: [1], hz: 220, seconds: 0.2 }]);
    const frame = new Float64Array(2_048);
    for (let i = 0; i < frame.length; i += 1) frame[i] = tone[i] ?? 0;
    const cmnd = cumulativeMeanNormalizedDifference(yinDifference(frame, 1_024, 400));
    const candidates = extractFrameCandidates(cmnd, 8, 400);
    expect(candidates.length).toBeGreaterThan(0);
    const total = candidates.reduce((sum, candidate) => sum + candidate.probability, 0);
    expect(total).toBeGreaterThan(0.5);
    expect(total).toBeLessThanOrEqual(1.000001);
    const best = [...candidates].sort((a, b) => b.probability - a.probability)[0];
    expect(SAMPLE_RATE / (best?.tau ?? 1)).toBeCloseTo(220, 0);
  });
});

describe('pYIN pitch tracking (B-01)', () => {
  it('decodes a clean tone to the correct semitone', () => {
    const frames = trackPitch(
      renderTone([{ amplitude: 0.4, hz: 220, seconds: 1 }]),
      SAMPLE_RATE,
    );
    const midis = voicedMidis(frames);
    expect(midis.length).toBeGreaterThan(40);
    for (const midi of midis) expect(Math.abs(midi - 57)).toBeLessThan(0.35);
  });

  it('resolves the strong-second-harmonic octave trap that defeats single-threshold YIN', () => {
    // Fundamental 196 Hz (G3) at 0.25 against a second harmonic at 1.0: the
    // CMND trough at the half period dips under the fixed 0.18 threshold, so
    // the Phase 01 estimator locks one octave high (~G4, midi 67).
    const trap = renderTone([
      { amplitude: 0.45, harmonics: [0.25, 1, 0.1], hz: 196, seconds: 1 },
    ]);
    const window = new Float32Array(4_096);
    for (let i = 0; i < window.length; i += 1) window[i] = trap[SAMPLE_RATE / 2 + i] ?? 0;
    const legacy = estimateYinPitch(window, SAMPLE_RATE, 80, 2_400, 0.18);
    expect(legacy?.midi ?? 0).toBeGreaterThan(60); // octave error: ~G4 (67)
    const frames = trackPitch(trap, SAMPLE_RATE);
    const midis = voicedMidis(frames);
    expect(midis.length).toBeGreaterThan(40);
    const correct = midis.filter((midi) => Math.abs(midi - 55) < 0.5).length;
    expect(correct / midis.length).toBeGreaterThan(0.9);
  });

  it('follows vibrato without fragmenting and reports silence as unvoiced', () => {
    const vibrato = renderTone([
      {
        amplitude: 0.4,
        hz: (t) => 220 * 2 ** ((0.6 / 12) * Math.sin(2 * Math.PI * 5.5 * t)),
        seconds: 1.2,
      },
      { amplitude: 0, hz: 220, seconds: 0.4 },
    ]);
    const frames = trackPitch(vibrato, SAMPLE_RATE);
    const notes = segmentNotes(frames);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.midi).toBe(57);
    const tail = frames.filter((frame) => frame.time > 1.25);
    expect(tail.every((frame) => frame.midi === 0 || frame.rms < 0.01)).toBe(true);
  });

  it('survives broadband noise at low SNR', () => {
    const noisy = renderTone([{ amplitude: 0.35, hz: 220, seconds: 1 }], 0.18);
    const midis = voicedMidis(trackPitch(noisy, SAMPLE_RATE));
    expect(midis.length).toBeGreaterThan(30);
    const correct = midis.filter((midi) => Math.abs(midi - 57) < 0.5).length;
    expect(correct / midis.length).toBeGreaterThan(0.85);
  });
});

describe('pYIN note segmentation (B-02)', () => {
  it('bridges a brief amplitude dip inside one note', () => {
    const dip = renderTone([
      {
        amplitude: (t) => (t > 0.45 && t < 0.48 ? 0.15 : 0.4),
        hz: 220,
        seconds: 1,
      },
    ]);
    const notes = segmentNotes(trackPitch(dip, SAMPLE_RATE));
    expect(notes).toHaveLength(1);
    expect(notes[0]?.midi).toBe(57);
  });

  it('splits notes separated by silence and steps between pitches', () => {
    const phrase = renderTone([
      { amplitude: 0.4, hz: 220, seconds: 0.4 },
      { amplitude: 0, hz: 220, seconds: 0.15 },
      { amplitude: 0.4, hz: 293.66, seconds: 0.4 },
      { amplitude: 0.4, hz: 329.63, seconds: 0.4 },
    ]);
    const notes = segmentNotes(trackPitch(phrase, SAMPLE_RATE));
    expect(notes.map((note) => note.midi)).toEqual([57, 62, 64]);
  });

  it('re-articulates repeated same-pitch notes on an energy onset', () => {
    const repeated = renderTone([
      {
        amplitude: (t) => {
          const local = t % 0.5;
          return local > 0.4 ? 0.06 : 0.4;
        },
        hz: 220,
        seconds: 1.5,
      },
    ]);
    const notes = segmentNotes(trackPitch(repeated, SAMPLE_RATE));
    expect(notes.length).toBe(3);
    expect(notes.every((note) => note.midi === 57)).toBe(true);
  });

  it('returns nothing for silence or noise-only input', () => {
    const silent = renderTone([{ amplitude: 0, hz: 220, seconds: 1 }], 0.02);
    expect(segmentNotes(trackPitch(silent, SAMPLE_RATE))).toEqual([]);
  });
});
