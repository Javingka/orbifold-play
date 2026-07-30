// SPDX-License-Identifier: AGPL-3.0-only
// Phase 02 (ADR 0035): the pure re-detection glue used by both the web adapter
// and the review UI. Re-running at a new sensitivity on the same buffer must
// change the result without any re-recording.
import { describe, expect, it } from 'vitest';

import { analyzeRhythmBuffer, countRhythmOnsets } from './rhythm-detection';

const SAMPLE_RATE = 44_100;
const LEAD_IN = 0.1;

function createNoise(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0xffffffff - 0.5;
  };
}

/** A four-bar backbeat (reused shape from onset-detection tests). */
function backbeat(bpm: number, bars: number): Float32Array {
  const step = 60 / bpm / 4;
  const noise = createNoise(9);
  const seconds = LEAD_IN + bars * 16 * step + 0.2;
  const out = new Float32Array(Math.round(seconds * SAMPLE_RATE));
  for (let i = 0; i < out.length; i += 1) out[i] = 0.004 * noise();
  const addHit = (atSeconds: number, kind: 'kick' | 'snare' | 'hat'): void => {
    const length = Math.round(0.12 * SAMPLE_RATE);
    const offset = Math.round(atSeconds * SAMPLE_RATE);
    for (let i = 0; i < length; i += 1) {
      const t = i / SAMPLE_RATE;
      let v: number;
      if (kind === 'kick') v = 0.9 * Math.exp(-t * 32) * Math.sin(2 * Math.PI * (80 * Math.exp(-t * 12) + 45) * t);
      else if (kind === 'snare') v = Math.exp(-t * 42) * (0.6 * Math.sin(2 * Math.PI * 190 * t) + 0.4 * (noise() - noise()));
      else v = Math.exp(-t * 55) * 0.7 * (noise() - noise());
      const target = offset + i;
      if (target < out.length) out[target] = (out[target] ?? 0) + v;
    }
  };
  for (let bar = 0; bar < bars; bar += 1) {
    const base = LEAD_IN + bar * 16 * step;
    for (const s of [0, 8]) addHit(base + s * step, 'kick');
    for (const s of [4, 12]) addHit(base + s * step, 'snare');
    for (const s of [2, 6, 10, 14]) addHit(base + s * step, 'hat');
  }
  return out;
}

describe('rhythm buffer re-detection (Phase 02, ADR 0035)', () => {
  it('analyzes a recorded groove to the intended tempo at default sensitivity', () => {
    const samples = backbeat(120, 3);
    const analysis = analyzeRhythmBuffer(samples, SAMPLE_RATE, samples.length / SAMPLE_RATE);
    expect(analysis).not.toBeNull();
    expect(analysis?.bpm ?? 0).toBeGreaterThan(108);
    expect(analysis?.bpm ?? 0).toBeLessThan(132);
  });

  it('re-detects the same buffer at different sensitivities without re-recording (E-04)', () => {
    const samples = backbeat(120, 3);
    const low = countRhythmOnsets(samples, SAMPLE_RATE, { sensitivity: 0.05 });
    const mid = countRhythmOnsets(samples, SAMPLE_RATE, { sensitivity: 0.5 });
    const high = countRhythmOnsets(samples, SAMPLE_RATE, { sensitivity: 0.95 });
    // Monotonic non-decreasing; a clean, well-separated groove is intentionally
    // stable across sensitivity (the strict-change proof is the "tss" in
    // onset-overdetection.test.ts). The default recovers the full backbeat.
    expect(low).toBeLessThanOrEqual(mid);
    expect(mid).toBeLessThanOrEqual(high);
    expect(mid).toBeGreaterThanOrEqual(8);
  });

  it('honors the ambient floor as a hard lower bound even at max sensitivity', () => {
    const noise = createNoise(3);
    const quiet = new Float32Array(Math.round(1.5 * SAMPLE_RATE));
    for (let i = 0; i < quiet.length; i += 1) quiet[i] = 0.02 * noise();
    // With a high ambient floor, pure noise yields no onsets even wide open.
    expect(countRhythmOnsets(quiet, SAMPLE_RATE, { sensitivity: 1, ambientFloor: 0.05 })).toBe(0);
  });
});
