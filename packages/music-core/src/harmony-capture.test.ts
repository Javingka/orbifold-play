// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';

import {
  analyzeHarmonyCapture,
  estimateYinPitch,
  estimateHarmonyTempo,
  extractHarmonyPitchFrames,
  extractPyinCapture,
  inferHarmonyKey,
  removeHarmonyCaptureEntry,
  segmentPitchFrames,
  setHarmonyCaptureBpm,
  updateHarmonyCaptureEntry,
  type CapturedRootNote,
} from './harmony-capture';

function sine(frequency: number, sampleRate = 8_000, length = 2_048): number[] {
  return Array.from({ length }, (_, index) => Math.sin((2 * Math.PI * frequency * index) / sampleRate));
}

function repeatedRoots(lengths = [1, 1, 2], repetitions = 3): CapturedRootNote[] {
  const notes: CapturedRootNote[] = [];
  const roots = [60, 65, 67];
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    for (let index = 0; index < roots.length; index += 1) {
      const t0 = repetition * 2 + index * 0.5;
      notes.push({
        confidence: 0.95,
        midi: roots[index] ?? 60,
        t0,
        t1: t0 + (lengths[index] ?? 1) * 0.25,
      });
    }
  }
  return notes;
}

function repeatedWhistle(sampleRate = 16_000): Float32Array {
  const frequencies = [880, 1_174.66, 1_318.51];
  const values: number[] = [];
  const append = (frequency: number, seconds: number, amplitude: number): void => {
    const length = Math.round(sampleRate * seconds);
    for (let index = 0; index < length; index += 1) {
      values.push(
        amplitude *
          Math.sin((2 * Math.PI * frequency * index) / sampleRate),
      );
    }
  };
  for (let repetition = 0; repetition < 3; repetition += 1) {
    for (const frequency of frequencies) {
      append(frequency, 0.3, 0.35);
      append(440, 0.12, 0);
    }
  }
  return Float32Array.from(values);
}

/**
 * Sung-like fixture (ADR 0031 / B-03): a C3–F3–G3–C3 root phrase with rich
 * harmonics, ±30-cent vibrato, deterministic noise, and short breaths,
 * repeated three times at ~100 BPM.
 */
function sungProgression(sampleRate = 24_000): Float32Array {
  let noiseState = 5 >>> 0;
  const noise = (): number => {
    noiseState = (noiseState * 1_664_525 + 1_013_904_223) >>> 0;
    return noiseState / 0xffffffff - 0.5;
  };
  const values: number[] = [];
  const roots = [130.81, 174.61, 196, 130.81];
  for (let repetition = 0; repetition < 3; repetition += 1) {
    for (const hz of roots) {
      const length = Math.round(0.5 * sampleRate);
      let phase = 0;
      for (let index = 0; index < length; index += 1) {
        const t = index / sampleRate;
        const vibrato = 2 ** ((0.3 / 12) * Math.sin(2 * Math.PI * 5.5 * t));
        phase += (2 * Math.PI * hz * vibrato) / sampleRate;
        const sample =
          Math.sin(phase) +
          0.6 * Math.sin(2 * phase) +
          0.4 * Math.sin(3 * phase) +
          0.25 * Math.sin(4 * phase);
        values.push(0.35 * sample + 0.05 * noise());
      }
      const breath = Math.round(0.1 * sampleRate);
      for (let index = 0; index < breath; index += 1) values.push(0.004 * noise());
    }
  }
  return Float32Array.from(values);
}

describe('pYIN capture pipeline (ADR 0031, B-03)', () => {
  it('resolves a noisy repeated sung phrase to the intended progression end-to-end', () => {
    const { frames, notes } = extractPyinCapture(sungProgression(), 24_000, {
      rmsThreshold: 0.01,
    });
    expect(notes.length).toBeGreaterThanOrEqual(12);
    expect(
      new Set(notes.map((note) => ((note.midi % 12) + 12) % 12)),
    ).toEqual(new Set([0, 5, 7]));
    const analysis = analyzeHarmonyCapture(notes, { frames });
    expect(analysis).not.toBeNull();
    expect(analysis?.entries.map((entry) => entry.face.rootPc)).toEqual([0, 5, 7, 0]);
    expect(analysis?.bpm ?? 0).toBeGreaterThan(80);
    expect(analysis?.bpm ?? 0).toBeLessThan(125);
  });

  it('reports too little material for silence through the pYIN pipeline', () => {
    const silence = new Float32Array(24_000 * 3);
    const { notes } = extractPyinCapture(silence, 24_000);
    expect(notes.length).toBeLessThan(3);
  });
});

describe('pure harmony capture (melody-lab parity and ADR 0030)', () => {
  it('estimates monophonic f0 with the prototype YIN contract', () => {
    const result = estimateYinPitch(sine(440), 8_000, 80, 1_250);
    expect(Math.abs((result?.frequency ?? 0) - 440)).toBeLessThan(1);
    expect(result?.midi).toBeCloseTo(69, 0);
  });

  it('recognizes a repeated whistle phrase above the former 1250 Hz ceiling', () => {
    const frames = extractHarmonyPitchFrames(repeatedWhistle(), 16_000, {
      maximumHz: 2_400,
      minimumHz: 80,
      threshold: 0.01,
    });
    const notes = segmentPitchFrames(frames, { threshold: 0.01 });
    expect(notes.length).toBeGreaterThanOrEqual(8);
    expect(new Set(notes.map((note) => note.midi))).toEqual(
      new Set([81, 86, 88]),
    );
    expect(analyzeHarmonyCapture(notes)).not.toBeNull();
  });

  it('segments stable voiced frames and rejects silence', () => {
    const frames = Array.from({ length: 12 }, (_, index) => ({
      aperiodicity: 0.05,
      midi: 60.05,
      rms: 0.05,
      time: index * 0.02,
    }));
    expect(segmentPitchFrames(frames)).toEqual([
      expect.objectContaining({ midi: 60, t0: 0, t1: 0.24 }),
    ]);
    expect(
      segmentPitchFrames(frames.map((frame) => ({ ...frame, rms: 0.001 }))),
    ).toEqual([]);
  });

  it('corrects an isolated octave error against the local running median', () => {
    const frames = Array.from({ length: 12 }, (_, index) => ({
      aperiodicity: 0.05,
      midi: index === 6 ? 72 : 60,
      rms: 0.05,
      time: index * 0.02,
    }));
    expect(segmentPitchFrames(frames)).toEqual([
      expect.objectContaining({ midi: 60 }),
    ]);
  });

  it('infers a compatible tonal context from duration-weighted roots', () => {
    const key = inferHarmonyKey(repeatedRoots());
    expect(key.rootPc).toBeGreaterThanOrEqual(0);
    expect(key.rootPc).toBeLessThan(12);
  });

  it('normalizes the repeated onset period into the prototype tempo range', () => {
    expect(estimateHarmonyTempo(repeatedRoots())).toBeCloseTo(120);
  });

  it('uses frame-energy novelty to retain pulse when note lengths vary', () => {
    const frames = Array.from({ length: 300 }, (_, index) => ({
      aperiodicity: 0.06,
      midi: 60,
      rms: index % 25 === 0 ? 0.16 : 0.01,
      time: index * 0.02,
    }));
    const notes = [0, 0.5, 1, 1.5, 2, 2.5].map((t0, index) => ({
      confidence: 0.9,
      midi: 60 + (index % 3),
      t0,
      t1: t0 + (index % 2 === 0 ? 0.18 : 0.34),
    }));
    expect(estimateHarmonyTempo(notes, frames)).toBeCloseTo(120, 0);
  });

  it('folds repetitions into supported editable faces and preserves a clear long root', () => {
    const result = analyzeHarmonyCapture(repeatedRoots(), {
      bars: 1,
      bpm: 120,
      key: { mode: 'major', rootPc: 0 },
    });
    expect(result).not.toBeNull();
    expect(result?.entries.map((entry) => [entry.face.rootPc, entry.face.quality])).toEqual([
      [0, 'maj'],
      [5, 'maj'],
      [7, 'maj'],
    ]);
    expect(result?.entries.map((entry) => entry.duration)).toEqual([1, 1, 2]);
    expect(result?.entries.every((entry) => entry.qualitySource === 'suggested')).toBe(true);
  });

  it('falls back to one bar when repeated duration is inconsistent', () => {
    const notes = repeatedRoots();
    const gNotes = notes.filter((note) => note.midi === 67);
    if (gNotes[0]) gNotes[0].t1 = gNotes[0].t0 + 0.25;
    if (gNotes[1]) gNotes[1].t1 = gNotes[1].t0 + 1.25;
    const result = analyzeHarmonyCapture(notes, {
      bpm: 120,
      key: { mode: 'major', rootPc: 0 },
    });
    expect(result?.entries.at(-1)?.duration).toBe(1);
  });

  it('rejects insufficient material and caps the result', () => {
    expect(analyzeHarmonyCapture(repeatedRoots().slice(0, 2))).toBeNull();
    const result = analyzeHarmonyCapture(repeatedRoots([1, 1, 1], 6), {
      bpm: 120,
      maximumEntries: 2,
    });
    expect(result?.entries.length).toBeLessThanOrEqual(2);
  });

  it('edits immutably within existing roots, qualities, durations, and BPM bounds', () => {
    const result = analyzeHarmonyCapture(repeatedRoots(), {
      bpm: 120,
      key: { mode: 'major', rootPc: 0 },
    });
    if (!result) throw new Error('Expected analysis');
    const edited = updateHarmonyCaptureEntry(result, 0, {
      duration: 0.5,
      midi: 69,
      quality: 'min',
    });
    expect(edited).not.toBe(result);
    expect(edited.entries[0]).toEqual(
      expect.objectContaining({
        duration: 0.5,
        face: expect.objectContaining({ quality: 'min', rootPc: 9 }),
        midi: 69,
      }),
    );
    expect(result.entries[0]?.face.rootPc).toBe(0);
    expect(setHarmonyCaptureBpm(result, 999).bpm).toBe(280);
    expect(removeHarmonyCaptureEntry(result, 1).entries).toHaveLength(result.entries.length - 1);
  });
});
