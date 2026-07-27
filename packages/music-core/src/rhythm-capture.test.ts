// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';

import {
  analyzeRhythmCapture,
  foldCaptureToOneBar,
  rescaleCaptureTempo,
  setCaptureTempo,
  setCapturedStep,
  type CaptureOnset,
} from './rhythm-capture';

function repeatedPattern(bpm: number, repetitions: number): CaptureOnset[] {
  const step = 60 / bpm / 4;
  const events: CaptureOnset[] = [];
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const offset = repetition * 16 * step;
    [0, 8].forEach((index) =>
      events.push({ lane: 'pulse', peak: 0.08, time: offset + index * step }),
    );
    [4, 12].forEach((index) =>
      events.push({ lane: 'click', peak: 0.06, time: offset + index * step }),
    );
    [2, 6, 10, 14].forEach((index) =>
      events.push({ lane: 'air', peak: 0.04, time: offset + index * step }),
    );
  }
  return events;
}

describe('rhythm capture analysis (beatbox-lab_7 parity)', () => {
  it('detects tempo and quantizes repeated classified onsets', () => {
    const onsets = repeatedPattern(120, 4);
    const result = analyzeRhythmCapture(onsets, 0, 8, 512 / 48_000);
    expect(result).not.toBeNull();
    if (!result) throw new Error('Expected capture analysis');
    expect(result?.bpm).toBeCloseTo(120, 0);
    const pulseHits = result.appliedPattern.pulse
      .map((active, index) => (active ? index : -1))
      .filter((index) => index >= 0);
    expect(pulseHits).toHaveLength(2);
    expect((pulseHits[1] ?? 0) - (pulseHits[0] ?? 0)).toBe(8);
    expect(result?.appliedPattern.click.filter(Boolean)).toHaveLength(2);
    expect(result?.appliedPattern.air.filter(Boolean)).toHaveLength(4);
  });

  it('preserves two bars and folds their union into the current 16-step view', () => {
    const folded = foldCaptureToOneBar({
      pulse: [1, ...new Array<number>(15).fill(0), 0, 0, 1, ...new Array<number>(13).fill(0)],
      click: new Array<number>(32).fill(0),
      air: new Array<number>(32).fill(0),
    });
    expect(folded.pulse[0]).toBe(1);
    expect(folded.pulse[2]).toBe(1);
  });

  it('supports explicit half/double tempo correction and requantizes step positions', () => {
    const result = analyzeRhythmCapture(repeatedPattern(120, 4), 0, 8, 512 / 48_000);
    expect(result).not.toBeNull();
    if (!result) throw new Error('Expected capture analysis');
    const doubled = rescaleCaptureTempo(result, 2);
    expect(doubled.bpm).toBeCloseTo(result.bpm * 2);
    const originalPulse = result.appliedPattern.pulse.findIndex(Boolean);
    expect(doubled.appliedPattern.pulse.findIndex(Boolean)).toBe((originalPulse * 2) % 16);
  });

  it('rejects captures with too few onsets', () => {
    expect(analyzeRhythmCapture(repeatedPattern(120, 1).slice(0, 2), 0, 8, 0.01)).toBeNull();
  });

  it('lets the player refine a visible step across preserved source bars', () => {
    const result = analyzeRhythmCapture(repeatedPattern(120, 4), 0, 8, 512 / 48_000);
    if (!result) throw new Error('Expected capture analysis');
    const edited = setCapturedStep(result, 'click', 1, true);
    expect(edited.appliedPattern.click[1]).toBe(1);
    expect(edited.fullPattern.click[1]).toBe(1);
    if (edited.bars === 2) expect(edited.fullPattern.click[17]).toBe(1);
  });

  it('sets a review tempo directly without accumulating changes or moving edits', () => {
    const result = analyzeRhythmCapture(repeatedPattern(120, 4), 0, 8, 512 / 48_000);
    if (!result) throw new Error('Expected capture analysis');
    const edited = setCapturedStep(result, 'air', 1, true);
    const half = setCaptureTempo(edited, result.bpm / 2);
    const doubled = setCaptureTempo(half, result.bpm * 2);
    expect(doubled.bpm).toBeCloseTo(result.bpm * 2);
    expect(doubled.appliedPattern).toEqual(edited.appliedPattern);
  });
});
