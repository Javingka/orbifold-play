// SPDX-License-Identifier: AGPL-3.0-only
// Pure rhythm-capture analysis ported from beatbox-lab_7.html:
// detectOnset(), analyzeFreestyle(), applyAnalysis(), and rescaleTempo().

export type CaptureLane = 'pulse' | 'click' | 'air';

export interface CaptureOnset {
  lane: CaptureLane;
  peak: number;
  time: number;
}

export interface CapturePattern {
  air: readonly number[];
  click: readonly number[];
  pulse: readonly number[];
}

export interface RhythmCaptureAnalysis {
  appliedPattern: CapturePattern;
  bars: 1 | 2;
  beatPeriod: number;
  bpm: number;
  confidence: number;
  fullPattern: CapturePattern;
  repetitions: number;
}

export type CaptureTempoFactor = 0.5 | 0.8 | 1.2 | 2;

const COMB_WEIGHTS = [1, 0.9, 0.5, 0.85, 0.4, 0.4, 0.3, 0.6] as const;
const SMOOTHING_KERNEL = [0.25, 0.6, 1, 0.6, 0.25] as const;

function autocorrelation(values: readonly number[], lag: number): number {
  let sum = 0;
  let count = 0;
  for (let index = 0; index + lag < values.length; index += 1) {
    sum += (values[index] ?? 0) * (values[index + lag] ?? 0);
    count += 1;
  }
  return count > 0 ? sum / count : 0;
}

function combScore(values: readonly number[], beatLag: number): number {
  return COMB_WEIGHTS.reduce(
    (score, weight, index) =>
      score + autocorrelation(values, Math.round(beatLag * (index + 1))) * weight,
    0,
  );
}

function emptyPattern(length: number): Record<CaptureLane, number[]> {
  return {
    pulse: new Array<number>(length).fill(0),
    click: new Array<number>(length).fill(0),
    air: new Array<number>(length).fill(0),
  };
}

export function foldCaptureToOneBar(pattern: CapturePattern): CapturePattern {
  const foldLane = (steps: readonly number[]): number[] =>
    Array.from({ length: 16 }, (_, index) =>
      steps.some((active, sourceIndex) => sourceIndex % 16 === index && active === 1) ? 1 : 0,
    );
  return {
    pulse: foldLane(pattern.pulse),
    click: foldLane(pattern.click),
    air: foldLane(pattern.air),
  };
}

export function rescaleCaptureTempo(
  analysis: RhythmCaptureAnalysis,
  factor: CaptureTempoFactor,
): RhythmCaptureAnalysis {
  const scaleLane = (steps: readonly number[]): number[] => {
    const scaled = new Array<number>(steps.length).fill(0);
    steps.forEach((active, index) => {
      if (!active) return;
      const target = Math.round(index * factor) % steps.length;
      scaled[target] = 1;
    });
    return scaled;
  };
  const fullPattern: Record<CaptureLane, number[]> = {
    pulse: scaleLane(analysis.fullPattern.pulse),
    click: scaleLane(analysis.fullPattern.click),
    air: scaleLane(analysis.fullPattern.air),
  };
  return {
    ...analysis,
    appliedPattern: foldCaptureToOneBar(fullPattern),
    beatPeriod: analysis.beatPeriod / factor,
    bpm: analysis.bpm * factor,
    fullPattern,
  };
}

/** Set an explicit review BPM without moving the player's refined grid. */
export function setCaptureTempo(
  analysis: RhythmCaptureAnalysis,
  bpm: number,
): RhythmCaptureAnalysis {
  const clampedBpm = Math.max(40, Math.min(280, bpm));
  return { ...analysis, beatPeriod: 60 / clampedBpm, bpm: clampedBpm };
}

/**
 * Edit the 16-step representation the player sees. A capture may preserve two
 * source bars; an edit is applied at the matching step in every source bar so
 * the preview and the eventual one-bar Orbit result stay in agreement.
 */
export function setCapturedStep(
  analysis: RhythmCaptureAnalysis,
  lane: CaptureLane,
  step: number,
  active: boolean,
): RhythmCaptureAnalysis {
  if (!Number.isInteger(step) || step < 0 || step >= 16) return analysis;
  const fullPattern: Record<CaptureLane, number[]> = {
    pulse: [...analysis.fullPattern.pulse],
    click: [...analysis.fullPattern.click],
    air: [...analysis.fullPattern.air],
  };
  for (let index = step; index < fullPattern[lane].length; index += 16) {
    fullPattern[lane][index] = active ? 1 : 0;
  }
  return {
    ...analysis,
    appliedPattern: foldCaptureToOneBar(fullPattern),
    fullPattern,
  };
}

export function analyzeRhythmCapture(
  onsets: readonly CaptureOnset[],
  captureStart: number,
  captureDuration: number,
  frameDuration: number,
): RhythmCaptureAnalysis | null {
  const frameCount = Math.max(1, Math.ceil(captureDuration / frameDuration) + 1);
  if (onsets.length < 3 || frameCount < 20) return null;

  const novelty = new Array<number>(frameCount).fill(0);
  for (const onset of onsets) {
    const index = Math.round((onset.time - captureStart) / frameDuration);
    if (index >= 0 && index < novelty.length) {
      novelty[index] = Math.max(novelty[index] ?? 0, onset.peak);
    }
  }

  const smoothed = new Array<number>(novelty.length).fill(0);
  novelty.forEach((value, index) => {
    if (value <= 0) return;
    for (let offset = -2; offset <= 2; offset += 1) {
      const target = index + offset;
      if (target >= 0 && target < smoothed.length) {
        smoothed[target] = (smoothed[target] ?? 0) + value * (SMOOTHING_KERNEL[offset + 2] ?? 0);
      }
    }
  });

  const lagMin = Math.floor(60 / 180 / frameDuration);
  const lagMax = Math.ceil(60 / 60 / frameDuration);
  const weighted = new Array<number>(lagMax + 1).fill(0);
  let bestLag = lagMin;
  let bestScore = -1;
  for (let lag = lagMin; lag <= lagMax; lag += 1) {
    const bpm = 60 / (lag * frameDuration);
    const preference = Math.exp(-((Math.log(bpm / 110) / 0.5) ** 2) / 2);
    const score = combScore(smoothed, lag) * preference;
    weighted[lag] = score;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  let refinedLag = bestLag;
  if (bestLag > lagMin && bestLag < lagMax) {
    const before = weighted[bestLag - 1] ?? 0;
    const peak = weighted[bestLag] ?? 0;
    const after = weighted[bestLag + 1] ?? 0;
    const denominator = before - 2 * peak + after;
    if (denominator !== 0) refinedLag += (0.5 * (before - after)) / denominator;
  }

  const beatPeriod = refinedLag * frameDuration;
  const bpm = 60 / beatPeriod;
  const range = weighted.slice(lagMin, lagMax + 1);
  const mean = range.reduce((sum, value) => sum + value, 0) / Math.max(1, range.length);
  const confidence = Math.max(0, Math.min(1, (bestScore - mean) / (bestScore + 0.000001)));
  const lag4 = Math.round(refinedLag * 4);
  const lag8 = Math.round(refinedLag * 8);
  const bars: 1 | 2 =
    lag8 < smoothed.length * 0.85 &&
    autocorrelation(smoothed, lag8) > 0.88 * autocorrelation(smoothed, lag4)
      ? 2
      : 1;

  const stepDuration = beatPeriod / 4;
  const totalSteps = 16 * bars;
  const loopDuration = totalSteps * stepDuration;
  let bestPhase = 0;
  let bestError = Number.POSITIVE_INFINITY;
  for (let candidate = 0; candidate < 24; candidate += 1) {
    const phase = (candidate / 24) * stepDuration;
    const error = onsets.reduce((sum, onset) => {
      const position = (onset.time - captureStart - phase) / stepDuration;
      return sum + Math.abs(position - Math.round(position));
    }, 0);
    if (error < bestError) {
      bestError = error;
      bestPhase = phase;
    }
  }

  const votes: Record<CaptureLane, Map<number, number>> = {
    pulse: new Map(),
    click: new Map(),
    air: new Map(),
  };
  let firstOnset = Number.POSITIVE_INFINITY;
  let lastOnset = Number.NEGATIVE_INFINITY;
  for (const onset of onsets) {
    const globalStep = Math.round((onset.time - captureStart - bestPhase) / stepDuration);
    const step = ((globalStep % totalSteps) + totalSteps) % totalSteps;
    votes[onset.lane].set(step, (votes[onset.lane].get(step) ?? 0) + 1);
    firstOnset = Math.min(firstOnset, onset.time);
    lastOnset = Math.max(lastOnset, onset.time);
  }
  const repetitions = Math.max(1, Math.round((lastOnset - firstOnset) / loopDuration));
  const voteThreshold = Math.max(1, Math.ceil(repetitions / 2));
  const fullPattern = emptyPattern(totalSteps);
  (Object.keys(votes) as CaptureLane[]).forEach((lane) => {
    votes[lane].forEach((count, step) => {
      if (count >= voteThreshold) fullPattern[lane][step] = 1;
    });
  });

  const firstPulse = fullPattern.pulse.findIndex(Boolean);
  const shift = firstPulse > 0 ? firstPulse - (firstPulse % 4) : 0;
  if (shift > 0) {
    (Object.keys(fullPattern) as CaptureLane[]).forEach((lane) => {
      const steps = fullPattern[lane];
      fullPattern[lane] = [...steps.slice(shift), ...steps.slice(0, shift)];
    });
  }

  return {
    appliedPattern: foldCaptureToOneBar(fullPattern),
    bars,
    beatPeriod,
    bpm,
    confidence,
    fullPattern,
    repetitions,
  };
}
