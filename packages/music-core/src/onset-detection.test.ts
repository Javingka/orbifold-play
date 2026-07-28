// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';

import { analyzeRhythmCapture } from './rhythm-capture';
import {
  detectOnsets,
  pickOnsetFrames,
  spectralFlux,
  type OnsetDetectionOptions,
} from './onset-detection';

const SAMPLE_RATE = 44_100;

function createNoise(seed = 1): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0xffffffff - 0.5;
  };
}

type HitKind = 'kick' | 'snare' | 'hat';

/**
 * Synthetic percussive hits with distinct spectra:
 * - kick: low sine (~80 Hz) with a fast decay → low centroid, low ZCR;
 * - snare: mid tone plus noise burst → mid centroid;
 * - hat: high-passed noise burst → high centroid, high ZCR.
 */
function renderHit(kind: HitKind, sampleRate: number, noise: () => number): Float32Array {
  const length = Math.round(0.12 * sampleRate);
  const out = new Float32Array(length);
  // Two-pole low-pass state for the snare's band-limited noise body.
  let lowpass1 = 0;
  let lowpass2 = 0;
  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    if (kind === 'kick') {
      const decay = Math.exp(-t * 32);
      const sweep = 80 * Math.exp(-t * 12) + 45;
      out[i] = 0.9 * decay * Math.sin(2 * Math.PI * sweep * t);
    } else if (kind === 'snare') {
      // Tonal body (~190 Hz) plus low-passed noise so the centroid lands in
      // the mid ("click") band; a fast decay keeps the energy at the attack so
      // the sustain does not produce a secondary flux peak.
      const decay = Math.exp(-t * 42);
      const n = noise();
      lowpass1 = 0.85 * lowpass1 + 0.15 * n;
      lowpass2 = 0.85 * lowpass2 + 0.15 * lowpass1;
      out[i] = decay * (0.65 * Math.sin(2 * Math.PI * 190 * t) + 0.35 * lowpass2 * 2.5);
    } else {
      const decay = Math.exp(-t * 55);
      // Crude high-pass: first difference of white noise raises the centroid.
      out[i] = decay * 0.7 * (noise() - noise());
    }
  }
  return out;
}

interface ScheduledHit {
  atSeconds: number;
  kind: HitKind;
}

function renderSequence(
  hits: readonly ScheduledHit[],
  seconds: number,
  noiseLevel: number,
  sampleRate = SAMPLE_RATE,
): Float32Array {
  const noise = createNoise(9);
  const out = new Float32Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < out.length; i += 1) out[i] = noiseLevel * noise();
  for (const hit of hits) {
    const rendered = renderHit(hit.kind, sampleRate, noise);
    const offset = Math.round(hit.atSeconds * sampleRate);
    for (let i = 0; i < rendered.length; i += 1) {
      const target = offset + i;
      if (target >= 0 && target < out.length) out[target] = (out[target] ?? 0) + (rendered[i] ?? 0);
    }
  }
  return out;
}

/**
 * A one-bar groove at `bpm` with the three lanes on distinct steps so each
 * onset has a single instrument (kick 1&3, snare 2&4, hats on the offbeat
 * "and"s). Coincident kick+hat hits merge into one onset in any single-lane
 * detector — prototype included — so the fixture keeps them separated.
 */
// Lead-in silence mirrors a real capture: the player starts after the
// countdown, so no hit lands on the first sample (which spectral flux, having
// no prior frame, cannot register).
const LEAD_IN = 0.1;

function backbeat(bpm: number, bars: number, noiseLevel = 0.004): Float32Array {
  const step = 60 / bpm / 4;
  const hits: ScheduledHit[] = [];
  for (let bar = 0; bar < bars; bar += 1) {
    const base = LEAD_IN + bar * 16 * step;
    for (const s of [0, 8]) hits.push({ atSeconds: base + s * step, kind: 'kick' });
    for (const s of [4, 12]) hits.push({ atSeconds: base + s * step, kind: 'snare' });
    for (const s of [2, 6, 10, 14]) hits.push({ atSeconds: base + s * step, kind: 'hat' });
  }
  const seconds = LEAD_IN + bars * 16 * step + 0.2;
  return renderSequence(hits, seconds, noiseLevel);
}

describe('spectral-flux primitives', () => {
  it('produces a novelty peak at a hit and near-zero in silence', () => {
    const signal = renderSequence([{ atSeconds: 0.5, kind: 'snare' }], 1, 0.002);
    const { novelty } = spectralFlux(signal, 1_024, 256);
    const hopDuration = 256 / SAMPLE_RATE;
    const hitFrame = Math.round(0.5 / hopDuration);
    let peakFrame = 0;
    for (let i = 0; i < novelty.length; i += 1) {
      if ((novelty[i] ?? 0) > (novelty[peakFrame] ?? 0)) peakFrame = i;
    }
    expect(Math.abs(peakFrame - hitFrame)).toBeLessThan(6);
    const earlyQuiet = novelty.slice(2, hitFrame - 10);
    const quietMax = earlyQuiet.reduce((max, value) => Math.max(max, value), 0);
    expect(quietMax).toBeLessThan((novelty[peakFrame] ?? 0) * 0.5);
  });

  it('picks the right number of onset frames for evenly spaced hits', () => {
    const hits = [0.3, 0.8, 1.3, 1.8, 2.3].map(
      (atSeconds): ScheduledHit => ({ atSeconds, kind: 'snare' }),
    );
    const signal = renderSequence(hits, 2.7, 0.003);
    const { novelty } = spectralFlux(signal, 1_024, 256);
    const picked = pickOnsetFrames(novelty, 256 / SAMPLE_RATE, {
      peakDelta: 0.08,
      refractorySeconds: 0.09,
    });
    expect(picked).toHaveLength(5);
  });
});

describe('offline onset detection (ADR 0032)', () => {
  const options: OnsetDetectionOptions = { rmsFloor: 0.004 };

  it('recovers every hit of a groove with correct timing', () => {
    const onsets = detectOnsets(backbeat(120, 1), SAMPLE_RATE, options);
    // 2 kick + 2 snare + 4 hat on distinct steps → 8 onsets per bar.
    expect(onsets.length).toBeGreaterThanOrEqual(8);
    const step = 60 / 120 / 4;
    for (const onset of onsets) {
      const position = (onset.time - 0.1) / step;
      expect(Math.abs(position - Math.round(position))).toBeLessThan(0.35);
    }
  });

  it('classifies isolated kick, snare, and hat hits into the right lanes', () => {
    const kick = detectOnsets(
      renderSequence([{ atSeconds: 0.3, kind: 'kick' }], 0.8, 0.002),
      SAMPLE_RATE,
      options,
    );
    const snare = detectOnsets(
      renderSequence([{ atSeconds: 0.3, kind: 'snare' }], 0.8, 0.002),
      SAMPLE_RATE,
      options,
    );
    const hat = detectOnsets(
      renderSequence([{ atSeconds: 0.3, kind: 'hat' }], 0.8, 0.002),
      SAMPLE_RATE,
      options,
    );
    expect(kick[0]?.lane).toBe('pulse');
    expect(snare[0]?.lane).toBe('click');
    expect(hat[0]?.lane).toBe('air');
  });

  it('detects soft offbeat hats a live envelope would miss between loud kicks', () => {
    const step = 60 / 120 / 4;
    const leadIn = 0.1;
    const hits: ScheduledHit[] = [];
    for (const s of [0, 8]) hits.push({ atSeconds: leadIn + s * step, kind: 'kick' });
    // Soft hats on every step except where the loud kicks land.
    for (let s = 0; s < 16; s += 1) {
      if (s !== 0 && s !== 8) hits.push({ atSeconds: leadIn + s * step, kind: 'hat' });
    }
    const signal = renderSequence(hits, leadIn + 16 * step + 0.2, 0.003);
    const onsets = detectOnsets(signal, SAMPLE_RATE, options);
    const airHits = onsets.filter((onset) => onset.lane === 'air').length;
    expect(airHits).toBeGreaterThanOrEqual(6);
  });

  it('feeds analyzeRhythmCapture end-to-end to the intended pattern', () => {
    const signal = backbeat(120, 3);
    const onsets = detectOnsets(signal, SAMPLE_RATE, options);
    const analysis = analyzeRhythmCapture(onsets, 0, signal.length / SAMPLE_RATE, 256 / SAMPLE_RATE);
    expect(analysis).not.toBeNull();
    expect(analysis?.bpm ?? 0).toBeGreaterThan(108);
    expect(analysis?.bpm ?? 0).toBeLessThan(132);
    expect((analysis?.appliedPattern.pulse ?? []).filter(Boolean).length).toBeGreaterThanOrEqual(2);
    expect((analysis?.appliedPattern.air ?? []).filter(Boolean).length).toBeGreaterThanOrEqual(4);
  });

  it('returns nothing for near-silence', () => {
    const silence = renderSequence([], 2, 0.0015);
    expect(detectOnsets(silence, SAMPLE_RATE, options)).toEqual([]);
  });
});
