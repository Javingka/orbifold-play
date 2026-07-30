// SPDX-License-Identifier: AGPL-3.0-only
// Phase 01 of detection-uplift (ADR 0034): a deterministic vocal-beatbox
// fixture corpus that stresses lane classification harder than the clean
// drum-machine fixtures in onset-detection.test.ts. Every render is seeded
// (LCG) — no Math.random — so confusion counts are exact and stable.
import { describe, expect, it } from 'vitest';

import {
  classifyLane,
  classifySegmentLane,
  detectOnsets,
  measureOnsetSegmentFeatures,
} from './onset-detection';
import type { CaptureLane } from './rhythm-capture';

const SAMPLE_RATE = 44_100;

function createNoise(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0xffffffff - 0.5;
  };
}

/**
 * Vocal-beatbox hit classes. Unlike the drum-machine fixtures, these model
 * how a mouth actually produces the sounds: a "bum" carries breath noise on
 * top of its fundamental, a "pa" can be dark enough to sit under the
 * prototype's 1300 Hz centroid cutoff, and a "tss" is a sustained sibilant
 * rather than a snappy metal hat.
 */
export type BeatboxKind =
  | 'vocalKick' // "bum": swept low fundamental + soft breath tail
  | 'breathyKick' // "bum" with prominent breath — high-frequency leakage
  | 'vocalSnare' // "pa": band-limited noise burst + mid tone
  | 'darkSnare' // "ka" with a dark tail — low centroid, low ZCR
  | 'vocalHat' // "tss": sustained sibilant noise
  | 'clap'; // broadband transient burst

/** Ground-truth lane per class in the 3-lane scheme. */
export const BEATBOX_TRUTH: Record<BeatboxKind, CaptureLane> = {
  breathyKick: 'pulse',
  clap: 'click',
  darkSnare: 'click',
  vocalHat: 'air',
  vocalKick: 'pulse',
  vocalSnare: 'click',
};

function renderBeatboxHit(
  kind: BeatboxKind,
  velocity: number,
  sampleRate: number,
  noise: () => number,
): Float32Array {
  // The sibilant is kept short: the current spectral-flux engine (out of
  // scope here, ADR 0032) loses a long sustained "tss" because its own flux
  // plateau defeats the local-mean peak test. A short crisp "tss" is still a
  // realistic mouth hat and keeps every corpus item detectable.
  const length = Math.round((kind === 'vocalHat' ? 0.1 : 0.22) * sampleRate);
  const out = new Float32Array(length);
  let phase = 0;
  let lowpass1 = 0;
  let lowpass2 = 0;
  let previousNoise = 0;
  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    let value: number;
    if (kind === 'vocalKick' || kind === 'breathyKick') {
      // Swept fundamental 140 → 55 Hz, integrated per sample for a smooth
      // pitch drop, with a breath-noise layer shaped by a one-pole low-pass.
      // A mouth "bum" has a ~3 ms soft attack; an instant step would splash
      // broadband energy across the analysis window and read as a click.
      const frequency = 55 + 85 * Math.exp(-t * 18);
      phase += (2 * Math.PI * frequency) / sampleRate;
      const attack = Math.min(1, t / 0.003);
      const body = attack * Math.exp(-t * 20) * Math.sin(phase);
      const n = noise();
      const breathPole = kind === 'breathyKick' ? 0.55 : 0.95;
      lowpass1 = breathPole * lowpass1 + (1 - breathPole) * n;
      const breathLevel = kind === 'breathyKick' ? 0.3 : 0.04;
      const breath = breathLevel * Math.exp(-t * 8) * lowpass1 * 3;
      value = 0.9 * body + breath;
    } else if (kind === 'vocalSnare' || kind === 'darkSnare') {
      // Noise burst through a one-pole low-pass plus a tonal body. The dark
      // variant filters harder and leans more on the tone, dropping the
      // centroid below the prototype's bass cutoff.
      const n = noise();
      const pole = kind === 'darkSnare' ? 0.975 : 0.85;
      lowpass1 = pole * lowpass1 + (1 - pole) * n;
      lowpass2 = pole * lowpass2 + (1 - pole) * lowpass1;
      const toneLevel = kind === 'darkSnare' ? 0.6 : 0.35;
      const toneHz = kind === 'darkSnare' ? 175 : 210;
      const noiseGain = kind === 'darkSnare' ? 14 : 4.5;
      const decay = Math.exp(-t * 30);
      value = decay * (toneLevel * Math.sin(2 * Math.PI * toneHz * t) + noiseGain * lowpass2);
    } else if (kind === 'vocalHat') {
      // Sibilant "tss": first-difference (high-pass) noise with a slightly
      // slower attack than a drum hat and a sustained decay.
      const n = noise();
      value = Math.exp(-t * 55) * 0.8 * (n - previousNoise) * 2;
      previousNoise = n;
    } else {
      // Clap: short broadband burst with mild low-pass so it stays mid-heavy.
      const n = noise();
      lowpass1 = 0.5 * lowpass1 + 0.5 * n;
      value = Math.exp(-t * 50) * 2.2 * lowpass1;
    }
    out[i] = velocity * value;
  }
  return out;
}

export interface CorpusItem {
  kind: BeatboxKind;
  signal: Float32Array;
  truth: CaptureLane;
  velocity: number;
}

const VELOCITIES = [1, 0.5, 0.22] as const;
const HIT_AT = 0.3;
const ITEM_SECONDS = 0.8;
/** Phone-like broadband noise floor at moderate SNR. */
const FLOOR = 0.004;

/**
 * The corpus: every class at three velocities over a noise floor. Seeds are
 * derived from position so each item is independent and reproducible.
 */
export function renderCorpus(sampleRate = SAMPLE_RATE): CorpusItem[] {
  const items: CorpusItem[] = [];
  const kinds = Object.keys(BEATBOX_TRUTH) as BeatboxKind[];
  kinds.sort();
  for (const [kindIndex, kind] of kinds.entries()) {
    for (const [velocityIndex, velocity] of VELOCITIES.entries()) {
      const seed = 1_000 + kindIndex * 17 + velocityIndex * 101;
      const noise = createNoise(seed);
      const signal = new Float32Array(Math.round(ITEM_SECONDS * sampleRate));
      for (let i = 0; i < signal.length; i += 1) signal[i] = FLOOR * noise();
      const hit = renderBeatboxHit(kind, velocity, sampleRate, noise);
      const offset = Math.round(HIT_AT * sampleRate);
      for (let i = 0; i < hit.length; i += 1) {
        const target = offset + i;
        if (target < signal.length) signal[target] = (signal[target] ?? 0) + (hit[i] ?? 0);
      }
      items.push({ kind, signal, truth: BEATBOX_TRUTH[kind], velocity });
    }
  }
  return items;
}

export interface ConfusionCounts {
  errors: number;
  matrix: Record<CaptureLane, Record<CaptureLane | 'missed', number>>;
  total: number;
}

export function emptyConfusion(): ConfusionCounts {
  const row = (): Record<CaptureLane | 'missed', number> => ({
    air: 0,
    click: 0,
    missed: 0,
    pulse: 0,
  });
  return { errors: 0, matrix: { air: row(), click: row(), pulse: row() }, total: 0 };
}

/** Classify each corpus item through the full detection path. */
export function scoreCorpus(
  items: readonly CorpusItem[],
  classify: (item: CorpusItem) => CaptureLane | null,
): ConfusionCounts {
  const counts = emptyConfusion();
  for (const item of items) {
    const predicted = classify(item);
    counts.total += 1;
    if (predicted === null) {
      counts.matrix[item.truth].missed += 1;
      counts.errors += 1;
    } else {
      counts.matrix[item.truth][predicted] += 1;
      if (predicted !== item.truth) counts.errors += 1;
    }
  }
  return counts;
}

describe('onset-segment features (Phase 01 step 01.2, D-01)', () => {
  const HIT = 0.3;
  const hitSample = Math.round(HIT * SAMPLE_RATE);
  // detectOnsets hands the feature stage a frame-aligned sample slightly
  // before the attack; mimic that offset here.
  const onsetSample = hitSample - 100;

  function toneBurst(frequencyHz: number, decayRate: number, seconds = 0.8): Float32Array {
    const out = new Float32Array(Math.round(seconds * SAMPLE_RATE));
    for (let i = hitSample; i < out.length; i += 1) {
      const t = (i - hitSample) / SAMPLE_RATE;
      out[i] = 0.5 * Math.exp(-t * decayRate) * Math.sin(2 * Math.PI * frequencyHz * t);
    }
    return out;
  }

  it('concentrates band energy in the band containing a pure tone', () => {
    const cases: readonly [number, keyof ReturnType<typeof measureOnsetSegmentFeatures>['bandRatios']][] = [
      [100, 'low'],
      [700, 'lowMid'],
      [3_000, 'mid'],
      [8_000, 'high'],
    ];
    for (const [frequency, band] of cases) {
      const features = measureOnsetSegmentFeatures(toneBurst(frequency, 10), onsetSample, SAMPLE_RATE);
      expect(features.bandRatios[band], `${frequency} Hz → ${band}`).toBeGreaterThan(0.85);
      expect(features.flatness, `${frequency} Hz flatness`).toBeLessThan(0.1);
    }
  });

  it('reports high flatness, high ZCR, and high-band dominance for white noise', () => {
    const noise = createNoise(77);
    const signal = new Float32Array(Math.round(0.8 * SAMPLE_RATE));
    for (let i = hitSample; i < signal.length; i += 1) {
      const t = (i - hitSample) / SAMPLE_RATE;
      signal[i] = 0.5 * Math.exp(-t * 10) * noise() * 2;
    }
    const features = measureOnsetSegmentFeatures(signal, onsetSample, SAMPLE_RATE);
    expect(features.flatness).toBeGreaterThan(0.4);
    expect(features.zcr).toBeGreaterThan(0.3);
    // White noise spreads energy ∝ bandwidth; the >4600 Hz band holds ~79%.
    expect(features.bandRatios.high).toBeGreaterThan(0.6);
  });

  it('measures decay time against a known exponential envelope', () => {
    // exp(-30 t) falls 20 dB at t = ln(10)/30 ≈ 76.8 ms.
    const fast = measureOnsetSegmentFeatures(toneBurst(700, 30), onsetSample, SAMPLE_RATE);
    expect(fast.decaySeconds).toBeGreaterThan(0.05);
    expect(fast.decaySeconds).toBeLessThan(0.11);
    // A sustained tone never drops 20 dB inside the scan window.
    const sustained = measureOnsetSegmentFeatures(toneBurst(700, 0), onsetSample, SAMPLE_RATE);
    expect(sustained.decaySeconds).toBeGreaterThan(0.2);
  });

  it('reports zero flatness for a silent segment instead of drifting to 1', () => {
    const silence = new Float32Array(Math.round(0.8 * SAMPLE_RATE));
    const features = measureOnsetSegmentFeatures(silence, onsetSample, SAMPLE_RATE);
    expect(features.flatness).toBe(0);
  });

  it('stays finite and well-formed for onsets clamped at the buffer edges', () => {
    const atStart = new Float32Array(Math.round(0.8 * SAMPLE_RATE));
    for (let i = 0; i < atStart.length; i += 1) {
      const t = i / SAMPLE_RATE;
      atStart[i] = 0.5 * Math.exp(-t * 20) * Math.sin(2 * Math.PI * 700 * t);
    }
    const nearEnd = new Float32Array(Math.round(0.8 * SAMPLE_RATE));
    const endHit = nearEnd.length - 400;
    for (let i = endHit; i < nearEnd.length; i += 1) {
      const t = (i - endHit) / SAMPLE_RATE;
      nearEnd[i] = 0.5 * Math.exp(-t * 20) * Math.sin(2 * Math.PI * 700 * t);
    }
    for (const [signal, anchor] of [
      [atStart, 0],
      [nearEnd, endHit - 100],
    ] as const) {
      const features = measureOnsetSegmentFeatures(signal, anchor, SAMPLE_RATE);
      const ratios = features.bandRatios;
      const total = ratios.low + ratios.lowMid + ratios.mid + ratios.high;
      expect(Number.isFinite(features.flatness)).toBe(true);
      expect(Number.isFinite(features.decaySeconds)).toBe(true);
      expect(features.attackSharpness).toBeGreaterThanOrEqual(0);
      expect(features.attackSharpness).toBeLessThanOrEqual(1);
      expect(total).toBeGreaterThanOrEqual(0);
      expect(total).toBeLessThanOrEqual(1.0001);
    }
  });

  it('distinguishes a hit from silence from a slow swell via attack sharpness', () => {
    const sharp = measureOnsetSegmentFeatures(toneBurst(700, 20), onsetSample, SAMPLE_RATE);
    expect(sharp.attackSharpness).toBeGreaterThan(0.9);
    const swellStart = hitSample - Math.round(0.1 * SAMPLE_RATE);
    const swell = new Float32Array(Math.round(0.8 * SAMPLE_RATE));
    for (let i = swellStart; i < swell.length; i += 1) {
      const t = (i - swellStart) / SAMPLE_RATE;
      const ramp = Math.min(1, t / 0.1);
      swell[i] = 0.5 * ramp * Math.sin(2 * Math.PI * 700 * t);
    }
    const soft = measureOnsetSegmentFeatures(swell, onsetSample, SAMPLE_RATE);
    expect(soft.attackSharpness).toBeLessThan(0.75);
    expect(soft.attackSharpness).toBeGreaterThan(0.35);
  });
});

describe('beatbox corpus baseline (Phase 01 step 01.1)', () => {
  const items = renderCorpus();

  it('every corpus item is detected as exactly one onset near the scheduled time', () => {
    for (const item of items) {
      const onsets = detectOnsets(item.signal, SAMPLE_RATE, { rmsFloor: 0.004 });
      expect(onsets.length, `${item.kind} @${item.velocity}`).toBe(1);
      // Loose bound: a noisy sibilant's absolute peak can land tens of ms
      // into the hit. Timing precision is asserted by onset-detection.test.ts;
      // here we only prove the corpus is cleanly detectable.
      expect(Math.abs((onsets[0]?.time ?? 0) - HIT_AT), `${item.kind} @${item.velocity}`).toBeLessThan(
        0.08,
      );
    }
  });

  // The prototype rule applied to the same measured segment (its centroid and
  // ZCR are computed identically to the pre-ADR-0034 path, so this is the
  // faithful baseline even though detectOnsets now classifies with v2).
  const baselineClassify = (item: CorpusItem) =>
    classifyLane(
      measureOnsetSegmentFeatures(item.signal, Math.round(HIT_AT * SAMPLE_RATE) - 100, SAMPLE_RATE),
    );

  it('documents the prototype-rule baseline confusion on the corpus', () => {
    const baseline = scoreCorpus(items, baselineClassify);
    expect(baseline.total).toBe(18);
    // Measured 2026-07-29 (step 01.1); the deterministic corpus keeps these
    // exact. The dB-byte centroid is strongly velocity-dependent — the same
    // "bum" reads 1002 Hz soft but 3197 Hz loud — which is the failure this
    // phase exists to fix. Step 01.3 must beat this error count (D-02).
    expect(baseline.errors).toBe(11);
    expect(baseline.matrix.pulse).toEqual({ air: 3, click: 2, missed: 0, pulse: 1 });
    expect(baseline.matrix.click).toEqual({ air: 5, click: 3, missed: 0, pulse: 1 });
    expect(baseline.matrix.air).toEqual({ air: 3, click: 0, missed: 0, pulse: 0 });
  });

  it('classifier v2 strictly beats the prototype rule on the corpus (D-02)', () => {
    // Both classifiers read the SAME measured features from the same anchor,
    // so this compares classification alone, not detection anchoring.
    const baseline = scoreCorpus(items, baselineClassify);
    const v2 = scoreCorpus(items, (item) =>
      classifySegmentLane(
        measureOnsetSegmentFeatures(
          item.signal,
          Math.round(HIT_AT * SAMPLE_RATE) - 100,
          SAMPLE_RATE,
        ),
      ),
    );
    expect(v2.errors).toBeLessThan(baseline.errors);
    // Measured 2026-07-29: the band-ratio classifier resolves the full
    // corpus. In-sample calibration evidence — the out-of-sample check is
    // the D-06 device pass.
    expect(v2.errors).toBe(0);
  });

  it('the full detection path assigns the same lanes as the anchored classifier', () => {
    // Ties the D-02 result to production: detectOnsets' own frame anchoring
    // must resolve to the same peak, features, and lane per corpus item.
    for (const item of items) {
      const onsets = detectOnsets(item.signal, SAMPLE_RATE, { rmsFloor: 0.004 });
      const anchored = classifySegmentLane(
        measureOnsetSegmentFeatures(
          item.signal,
          Math.round(HIT_AT * SAMPLE_RATE) - 100,
          SAMPLE_RATE,
        ),
      );
      expect(onsets[0]?.lane, `${item.kind} @${item.velocity}`).toBe(anchored);
    }
  });
});
