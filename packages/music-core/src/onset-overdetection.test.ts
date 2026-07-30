// SPDX-License-Identifier: AGPL-3.0-only
// Phase 02 of detection-uplift (ADR 0035): realistic SINGLE vocal utterances
// that the shipped engine over-detects (a sustained "tss" → 3 onsets, a "bum"
// → 2). Deterministic, seeded-LCG noise only. Step 02.1 records the baseline;
// step 02.2's dip gate must collapse each utterance to one onset.
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SENSITIVITY,
  detectOnsets,
  detectionSensitivityOptions,
} from './onset-detection';

const SAMPLE_RATE = 44_100;

function createNoise(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0xffffffff - 0.5;
  };
}

export type UtteranceKind = 'bum' | 'pa' | 'tss';

/**
 * One realistic mouth sound over a phone-like noise floor. Unlike the Phase 01
 * corpus (deliberately shortened so each fired once), these keep the natural
 * duration and internal structure that make the shipped engine over-fire:
 * - "bum": low plosive + breath tail + a lip-release sub-peak ~90 ms later;
 * - "pa": a clean single plosive (the control — should always be one onset);
 * - "tss": a sustained sibilant held ~300 ms.
 */
export function renderUtterance(kind: UtteranceKind, seconds = 0.8): Float32Array {
  const n = createNoise(42);
  const out = new Float32Array(Math.round(seconds * SAMPLE_RATE));
  const hitAt = Math.round(0.3 * SAMPLE_RATE);
  const durationSeconds = kind === 'tss' ? 0.32 : kind === 'bum' ? 0.28 : 0.22;
  const length = Math.round(durationSeconds * SAMPLE_RATE);
  let phase = 0;
  let lowpass1 = 0;
  let lowpass2 = 0;
  let previousNoise = 0;
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE;
    let value: number;
    if (kind === 'bum') {
      const frequency = 55 + 85 * Math.exp(-t * 16);
      phase += (2 * Math.PI * frequency) / SAMPLE_RATE;
      const body = Math.exp(-t * 14) * Math.sin(phase);
      const nz = n();
      lowpass1 = 0.6 * lowpass1 + 0.4 * nz;
      const breath = 0.18 * Math.exp(-t * 6) * lowpass1 * 3;
      const bump =
        t > 0.09 ? 0.4 * Math.exp(-(t - 0.09) * 30) * Math.sin(2 * Math.PI * 90 * t) : 0;
      value = 0.9 * body + breath + bump;
    } else if (kind === 'pa') {
      const nz = n();
      lowpass1 = 0.8 * lowpass1 + 0.2 * nz;
      lowpass2 = 0.8 * lowpass2 + 0.2 * lowpass1;
      value = Math.exp(-t * 26) * (0.35 * Math.sin(2 * Math.PI * 210 * t) + 5 * lowpass2);
    } else {
      const nz = n();
      const envelope = Math.min(1, t / 0.01) * Math.exp(-t * 6);
      value = envelope * 0.7 * (nz - previousNoise) * 2;
      previousNoise = nz;
    }
    out[hitAt + i] = value;
  }
  const floorNoise = createNoise(7);
  for (let i = 0; i < out.length; i += 1) out[i] = (out[i] ?? 0) + 0.004 * floorNoise();
  return out;
}

/** App-representative floor (rhythm-capture.web.ts uses max(0.005, …)). */
const APP_RMS_FLOOR = 0.01;

/** The pre-ADR-0035 configuration: no rising-energy gate, 90 ms refractory. */
const BASELINE = { rmsFloor: APP_RMS_FLOOR, minRiseRatio: 0, refractorySeconds: 0.09 } as const;

function countOnsets(kind: UtteranceKind, options: Parameters<typeof detectOnsets>[2]): number {
  return detectOnsets(renderUtterance(kind), SAMPLE_RATE, options).length;
}

describe('rhythm over-detection (Phase 02, ADR 0035)', () => {
  it('step 02.1 baseline — the pre-gate engine over-detects single utterances (E-01)', () => {
    // Measured 2026-07-30: "pa" is already correct; "bum" and "tss" over-fire.
    // This is the bug the phase fixes, reproduced by disabling the gate.
    expect(countOnsets('pa', BASELINE)).toBe(1);
    expect(countOnsets('bum', BASELINE)).toBe(2);
    expect(countOnsets('tss', BASELINE)).toBe(3);
  });

  it('step 02.2 fix — each single utterance detects as exactly one onset (E-02)', () => {
    // Default detectOnsets now applies the rising-energy gate + 110 ms
    // refractory, so a held "tss" and a "bum" with a lip-release sub-peak each
    // resolve to one onset.
    expect(countOnsets('pa', { rmsFloor: APP_RMS_FLOOR })).toBe(1);
    expect(countOnsets('bum', { rmsFloor: APP_RMS_FLOOR })).toBe(1);
    expect(countOnsets('tss', { rmsFloor: APP_RMS_FLOOR })).toBe(1);
  });

  it('step 02.3 — sensitivity is monotonic and the default keeps a single hit single (E-03)', () => {
    // The default sensitivity reproduces the calibrated one-onset behavior.
    const defaults = detectionSensitivityOptions(DEFAULT_SENSITIVITY);
    expect(defaults.refractorySeconds).toBeCloseTo(0.11, 5);
    expect(defaults.minRiseRatio).toBeCloseTo(1.08, 5);

    // Onset count is non-decreasing in sensitivity: a held "tss" stays a
    // single onset while strict/default, and only a high sensitivity re-admits
    // its internal fluctuations.
    const countAt = (s: number): number =>
      detectOnsets(renderUtterance('tss'), SAMPLE_RATE, detectionSensitivityOptions(s)).length;
    const strict = countAt(0);
    const mid = countAt(0.5);
    const lenient = countAt(1);
    expect(strict).toBeLessThanOrEqual(mid);
    expect(mid).toBeLessThanOrEqual(lenient);
    expect(lenient).toBeGreaterThan(strict);
    expect(mid).toBe(1);
  });
});
