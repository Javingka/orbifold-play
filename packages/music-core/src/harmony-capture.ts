// SPDX-License-Identifier: AGPL-3.0-only
// Pure monophonic capture analysis derived from melody-lab.html:
// yin(), segmentNotes(), detectKey(), fold(), and quantize().

import { createFiniteTonnetz, type FiniteTonnetzFace, type TonnetzQuality } from './finite-tonnetz';
import type { HarmonyDuration } from './harmony-duration';
import { SCALE_INTERVALS, type ScaleMode } from './scales';

export interface PitchFrame {
  aperiodicity: number;
  midi: number;
  rms: number;
  time: number;
}

export interface CapturedRootNote {
  confidence: number;
  midi: number;
  t0: number;
  t1: number;
}

export interface HarmonyCaptureEntry {
  duration: HarmonyDuration;
  face: FiniteTonnetzFace;
  midi: number;
  muted: false;
  qualitySource: 'suggested';
}

export interface HarmonyCaptureKey {
  confidence: number;
  mode: ScaleMode;
  rootPc: number;
}

export interface HarmonyCaptureAnalysis {
  bpm: number;
  confidence: number;
  entries: readonly HarmonyCaptureEntry[];
  key: HarmonyCaptureKey;
  repetitions: number;
}

export interface HarmonyCaptureOptions {
  bars?: 1 | 2;
  bpm?: number;
  frames?: readonly PitchFrame[];
  key?: Pick<HarmonyCaptureKey, 'mode' | 'rootPc'>;
  maximumEntries?: number;
}

const MODES = Object.keys(SCALE_INTERVALS) as ScaleMode[];
const FACE_BY_ID = createFiniteTonnetz();

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round(fraction * (sorted.length - 1))),
  );
  return sorted[index] ?? 0;
}

function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Prototype-parity YIN difference/CMND estimator (`melody-lab.html` yin()). */
export function estimateYinPitch(
  samples: ArrayLike<number>,
  sampleRate: number,
  minimumHz = 80,
  maximumHz = 1250,
  threshold = 0.18,
): { aperiodicity: number; frequency: number; midi: number } | null {
  if (sampleRate <= 0 || samples.length < 64 || minimumHz <= 0 || maximumHz <= minimumHz) {
    return null;
  }
  const tauMin = Math.max(2, Math.floor(sampleRate / maximumHz));
  const tauMax = Math.min(Math.floor(samples.length / 2), Math.ceil(sampleRate / minimumHz));
  const window = samples.length - tauMax;
  if (window < 32 || tauMax <= tauMin) return null;
  const difference = new Array<number>(tauMax + 1).fill(0);
  for (let tau = 1; tau <= tauMax; tau += 1) {
    let sum = 0;
    for (let index = 0; index < window; index += 1) {
      const delta = (samples[index] ?? 0) - (samples[index + tau] ?? 0);
      sum += delta * delta;
    }
    difference[tau] = sum;
  }
  const cmnd = new Array<number>(tauMax + 1).fill(1);
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau += 1) {
    running += difference[tau] ?? 0;
    cmnd[tau] = running > 1e-12 ? ((difference[tau] ?? 0) * tau) / running : 1;
  }
  let bestTau = -1;
  for (let tau = tauMin; tau < tauMax; tau += 1) {
    if ((cmnd[tau] ?? 1) < threshold) {
      while (tau + 1 <= tauMax && (cmnd[tau + 1] ?? 1) < (cmnd[tau] ?? 1)) tau += 1;
      bestTau = tau;
      break;
    }
  }
  if (bestTau < 0) {
    bestTau = tauMin;
    for (let tau = tauMin + 1; tau <= tauMax; tau += 1) {
      if ((cmnd[tau] ?? 1) < (cmnd[bestTau] ?? 1)) bestTau = tau;
    }
    if ((cmnd[bestTau] ?? 1) > 0.55) return null;
  }
  let refinedTau = bestTau;
  if (bestTau > 1 && bestTau < tauMax) {
    const before = cmnd[bestTau - 1] ?? 1;
    const peak = cmnd[bestTau] ?? 1;
    const after = cmnd[bestTau + 1] ?? 1;
    const denominator = 2 * (2 * peak - before - after);
    if (denominator !== 0) {
      const offset = (after - before) / denominator;
      if (Math.abs(offset) < 1) refinedTau += offset;
    }
  }
  const frequency = sampleRate / refinedTau;
  return {
    aperiodicity: cmnd[bestTau] ?? 1,
    frequency,
    midi: 69 + 12 * Math.log2(frequency / 440),
  };
}

/**
 * Prototype-parity offline pitch pass (`melody-lab.html` runAnalysis/pass).
 * A complete capture is decimated, scanned with overlapping YIN windows, then
 * rescanned with an adaptive window around the confidently observed register.
 */
export function extractHarmonyPitchFrames(
  samples: ArrayLike<number>,
  sampleRate: number,
  options: {
    maximumHz?: number;
    minimumHz?: number;
    threshold?: number;
    yinThreshold?: number;
  } = {},
): PitchFrame[] {
  if (sampleRate <= 0 || samples.length < sampleRate * 1.5) return [];
  const minimumHz = options.minimumHz ?? 80;
  const maximumHz = options.maximumHz ?? 2_400;
  const threshold = options.threshold ?? 0.014;
  const yinThreshold = options.yinThreshold ?? 0.18;
  const decimatedLength = Math.max(0, Math.floor((samples.length - 2) / 2));
  const decimated = new Float32Array(decimatedLength);
  for (let index = 0; index < decimatedLength; index += 1) {
    const source = index * 2 + 1;
    decimated[index] =
      ((samples[source - 1] ?? 0) +
        2 * (samples[source] ?? 0) +
        (samples[source + 1] ?? 0)) /
      4;
  }
  const decimatedRate = sampleRate / 2;

  const pass = (
    windowSize: number,
    hopSize: number,
    lowHz: number,
    highHz: number,
  ): PitchFrame[] => {
    const tauMax = Math.min(windowSize - 1, Math.ceil(decimatedRate / lowHz));
    const frameCount = Math.floor(
      (decimated.length - windowSize - tauMax) / hopSize,
    );
    if (frameCount < 1) return [];
    const frames: PitchFrame[] = [];
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const start = frameIndex * hopSize;
      let squares = 0;
      for (let index = 0; index < windowSize; index += 1) {
        const value = decimated[start + index] ?? 0;
        squares += value * value;
      }
      const rms = Math.sqrt(squares / windowSize);
      const input = decimated.subarray(start, start + windowSize + tauMax);
      const pitch =
        rms > threshold * 0.85
          ? estimateYinPitch(
              input,
              decimatedRate,
              lowHz,
              highHz,
              yinThreshold,
            )
          : null;
      frames.push({
        aperiodicity: pitch?.aperiodicity ?? 1,
        midi: pitch?.midi ?? 0,
        rms,
        time: (start + windowSize / 2) / decimatedRate,
      });
    }
    return frames;
  };

  const first = pass(1_024, 256, minimumHz, maximumHz);
  const confident = first
    .filter(
      (frame) =>
        frame.midi > 0 && frame.aperiodicity < yinThreshold * 0.8,
    )
    .map((frame) => frame.midi);
  if (confident.length < 12) return first;

  const lowMidi = percentile(confident, 0.08);
  const highMidi = percentile(confident, 0.92);
  const lowHz = Math.max(minimumHz, midiToFrequency(lowMidi - 9));
  const highHz = Math.min(maximumHz, midiToFrequency(highMidi + 9));
  if (highHz <= lowHz * 1.5) return first;
  const tauMax = Math.ceil(decimatedRate / lowHz);
  const adaptiveWindow = Math.max(
    320,
    Math.min(1_024, Math.round((3.2 * tauMax) / 32) * 32),
  );
  const adaptiveHop = adaptiveWindow <= 640 ? 128 : 256;
  const second = pass(adaptiveWindow, adaptiveHop, lowHz, highHz);
  return second.length > 10 ? second : first;
}

/** Prototype-parity voiced-frame segmentation (`segmentNotes()`). */
export function segmentPitchFrames(
  frames: readonly PitchFrame[],
  options: { jump?: number; minimumDuration?: number; threshold?: number; yinThreshold?: number } = {},
): CapturedRootNote[] {
  const threshold = options.threshold ?? 0.014;
  const yinThreshold = options.yinThreshold ?? 0.18;
  const jump = options.jump ?? 0.7;
  const minimumDuration = options.minimumDuration ?? 0.08;
  const correctedFrames = frames.map((frame, index) => {
    if (frame.midi <= 0) return frame;
    const neighbors = frames
      .slice(Math.max(0, index - 6), Math.min(frames.length, index + 7))
      .map((candidate) => candidate.midi)
      .filter((midi) => midi > 0);
    const reference = median(neighbors);
    if (reference <= 0 || Math.abs(frame.midi - reference) <= 6) return frame;
    const corrected = [-24, -12, 12, 24]
      .map((offset) => frame.midi + offset)
      .find((midi) => Math.abs(midi - reference) < 1.5);
    if (corrected !== undefined) return { ...frame, midi: corrected };
    if (Math.abs(frame.midi - reference) > 5) {
      return { ...frame, aperiodicity: 1, midi: 0 };
    }
    return frame;
  });
  const smoothedFrames = correctedFrames.map((frame, index) => {
    if (frame.midi <= 0) return frame;
    const values = correctedFrames
      .slice(Math.max(0, index - 1), Math.min(correctedFrames.length, index + 2))
      .map((candidate) => candidate.midi)
      .filter((midi) => midi > 0);
    return { ...frame, midi: median(values) };
  });
  const notes: CapturedRootNote[] = [];
  let active: PitchFrame[] = [];
  let unvoiced = 0;
  const frameDuration =
    median(
      frames
        .slice(1)
        .map((frame, index) => frame.time - (frames[index]?.time ?? frame.time))
        .filter((duration) => duration > 0),
    ) || 0.02;
  const close = (): void => {
    if (active.length < 3) {
      active = [];
      return;
    }
    const t0 = active[0]?.time ?? 0;
    const t1 = (active.at(-1)?.time ?? t0) + frameDuration;
    if (t1 - t0 >= minimumDuration) {
      const pitches = active.map((frame) => frame.midi);
      const core = pitches.length >= 5 ? pitches.slice(1, -1) : pitches;
      const midi = Math.round(median(core));
      notes.push({
        confidence: 1 - active.reduce((sum, frame) => sum + frame.aperiodicity, 0) / active.length,
        midi,
        t0,
        t1,
      });
    }
    active = [];
  };
  for (const frame of smoothedFrames) {
    const voiced =
      frame.midi > 0 && frame.rms > threshold && frame.aperiodicity < yinThreshold;
    if (!voiced) {
      unvoiced += 1;
      if (active.length > 0 && unvoiced >= 2) close();
      continue;
    }
    unvoiced = 0;
    if (active.length > 0) {
      const reference = median(active.slice(-5).map((candidate) => candidate.midi));
      if (Math.abs(frame.midi - reference) > jump) close();
    }
    active.push(frame);
  }
  close();
  const merged: CapturedRootNote[] = [];
  for (const note of notes) {
    const previous = merged.at(-1);
    if (
      previous &&
      previous.midi === note.midi &&
      note.t0 - previous.t1 <= Math.min(4 * frameDuration, 0.04)
    ) {
      previous.t1 = note.t1;
      previous.confidence = Math.min(previous.confidence, note.confidence);
    } else {
      merged.push({ ...note });
    }
  }
  return merged;
}

export function inferHarmonyKey(notes: readonly CapturedRootNote[]): HarmonyCaptureKey {
  const histogram = new Array<number>(12).fill(0);
  for (const note of notes) {
    histogram[positiveModulo(note.midi, 12)] =
      (histogram[positiveModulo(note.midi, 12)] ?? 0) + Math.max(0.01, note.t1 - note.t0);
  }
  let best = { rootPc: 0, mode: 'major' as ScaleMode, score: Number.NEGATIVE_INFINITY };
  let second = Number.NEGATIVE_INFINITY;
  for (let rootPc = 0; rootPc < 12; rootPc += 1) {
    for (const mode of MODES) {
      const intervals = SCALE_INTERVALS[mode];
      let score = 0;
      for (let pc = 0; pc < 12; pc += 1) {
        score += (histogram[pc] ?? 0) * (intervals.includes(positiveModulo(pc - rootPc, 12)) ? 1 : -1);
      }
      if (score > best.score) {
        second = best.score;
        best = { rootPc, mode, score };
      } else if (score > second) second = score;
    }
  }
  return {
    confidence: Math.max(0, Math.min(1, (best.score - second) / (Math.abs(best.score) + 1e-9))),
    mode: best.mode,
    rootPc: best.rootPc,
  };
}

function autocorrelation(values: readonly number[], lag: number): number {
  let sum = 0;
  let count = 0;
  for (let index = 0; index + lag < values.length; index += 1) {
    sum += (values[index] ?? 0) * (values[index + lag] ?? 0);
    count += 1;
  }
  return count === 0 ? 0 : sum / count;
}

/**
 * Prototype-parity onset comb estimator (`melody-lab.html` detectTempo()).
 * Frame-energy novelty anchors the pulse even when neighbouring melody notes
 * have unequal lengths; onset intervals remain the deterministic fallback.
 */
export function estimateHarmonyTempo(
  notes: readonly CapturedRootNote[],
  frames: readonly PitchFrame[] = [],
): number {
  if (frames.length >= 24) {
    const frameDuration =
      median(
        frames
          .slice(1)
          .map((frame, index) => frame.time - (frames[index]?.time ?? frame.time))
          .filter((duration) => duration > 0),
      ) || 0;
    if (frameDuration > 0) {
      const maxRms = Math.max(...frames.map((frame) => frame.rms), 1e-9);
      const novelty = frames.map((frame, index) =>
        index === 0
          ? 0
          : Math.max(0, frame.rms - (frames[index - 1]?.rms ?? frame.rms)) / maxRms,
      );
      for (const note of notes) {
        const index = Math.min(
          frames.length - 1,
          Math.max(0, Math.round(note.t0 / frameDuration)),
        );
        for (const offset of [-1, 0, 1]) {
          const target = index + offset;
          if (target < 0 || target >= novelty.length) continue;
          novelty[target] = (novelty[target] ?? 0) + (offset === 0 ? 2 : 0.6);
        }
      }
      const minimumLag = Math.max(2, Math.floor((60 / 190) / frameDuration));
      const maximumLag = Math.min(
        Math.ceil((60 / 55) / frameDuration),
        Math.floor(novelty.length / 3),
      );
      if (maximumLag > minimumLag + 2) {
        const weights = [1, 0.9, 0.5, 0.85, 0.4, 0.4, 0.3, 0.6];
        let bestLag = -1;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
          const bpm = 60 / (lag * frameDuration);
          const tempoPrior = Math.exp(-((Math.log(bpm / 105) / 0.55) ** 2) / 2);
          let comb = 0;
          for (let multiple = 1; multiple <= weights.length; multiple += 1) {
            comb +=
              autocorrelation(novelty, Math.round(lag * multiple)) *
              (weights[multiple - 1] ?? 0);
          }
          const score = comb * tempoPrior;
          if (score > bestScore) {
            bestScore = score;
            bestLag = lag;
          }
        }
        if (bestLag > 0) {
          const bpm = 60 / (bestLag * frameDuration);
          if (Number.isFinite(bpm)) return Math.max(40, Math.min(280, bpm));
        }
      }
    }
  }
  const intervals = notes
    .slice(1)
    .map((note, index) => note.t0 - (notes[index]?.t0 ?? note.t0))
    .filter((interval) => interval > 0.08);
  const period = median(intervals);
  if (period <= 0) return 120;
  let bpm = 60 / period;
  while (bpm < 55) bpm *= 2;
  while (bpm > 190) bpm /= 2;
  return Math.max(40, Math.min(280, bpm));
}

function suggestedQuality(rootPc: number, key: Pick<HarmonyCaptureKey, 'mode' | 'rootPc'>): TonnetzQuality {
  const intervals = SCALE_INTERVALS[key.mode];
  const degree = intervals.indexOf(positiveModulo(rootPc - key.rootPc, 12));
  if (degree < 0) return 'maj';
  const root = intervals[degree] ?? 0;
  const thirdIndex = degree + 2;
  const third = (intervals[thirdIndex % 7] ?? 0) + (thirdIndex >= 7 ? 12 : 0) - root;
  return third === 3 ? 'min' : 'maj';
}

function durationFromSamples(samples: readonly number[], baseLength: number): HarmonyDuration {
  if (samples.length < 2 || baseLength <= 0) return 1;
  const candidate = median(samples);
  if (candidate <= 0) return 1;
  const deviation = median(samples.map((value) => Math.abs(value - candidate)));
  if (deviation / candidate > 0.25) return 1;
  const ratio = candidate / baseLength;
  if (ratio >= 3.75) return 4;
  if (ratio >= 2.75) return 3;
  if (ratio >= 1.75) return 2;
  return 1;
}

function faceFor(rootPc: number, quality: TonnetzQuality): FiniteTonnetzFace {
  const face = FACE_BY_ID.find((candidate) => candidate.rootPc === rootPc && candidate.quality === quality);
  if (!face) throw new Error(`Missing finite Tonnetz face ${rootPc}:${quality}`);
  return face;
}

/** Fold repeated notes into a candidate progression, following `fold()`/`quantize()`. */
export function analyzeHarmonyCapture(
  notes: readonly CapturedRootNote[],
  options: HarmonyCaptureOptions = {},
): HarmonyCaptureAnalysis | null {
  if (notes.length < 3) return null;
  const bpm = Math.max(
    40,
    Math.min(280, options.bpm ?? estimateHarmonyTempo(notes, options.frames)),
  );
  const bars = options.bars ?? 1;
  const totalSteps = 16 * bars;
  const stepDuration = 60 / bpm / 4;
  const phraseDuration = totalSteps * stepDuration;
  let phase = 0;
  let phaseError = Number.POSITIVE_INFINITY;
  for (let candidateIndex = 0; candidateIndex < 48; candidateIndex += 1) {
    const candidate = (candidateIndex / 48) * stepDuration;
    const error = notes.reduce((sum, note) => {
      const position = (note.t0 - candidate) / stepDuration;
      return sum + Math.abs(position - Math.round(position));
    }, 0);
    if (error < phaseError) {
      phase = candidate;
      phaseError = error;
    }
  }
  const repetitions = Math.max(
    1,
    Math.round(((notes.at(-1)?.t1 ?? 0) - (notes[0]?.t0 ?? 0)) / phraseDuration),
  );
  const voteThreshold = Math.max(1, Math.ceil(repetitions / 2));
  const slots = new Map<number, { durations: number[]; roots: Map<number, number> }>();
  for (const note of notes) {
    const step = positiveModulo(
      Math.round((note.t0 - phase) / stepDuration),
      totalSteps,
    );
    const slot = slots.get(step) ?? { durations: [], roots: new Map<number, number>() };
    const rootPc = positiveModulo(Math.round(note.midi), 12);
    slot.roots.set(rootPc, (slot.roots.get(rootPc) ?? 0) + 1);
    slot.durations.push(Math.max(1, Math.round((note.t1 - note.t0) / stepDuration)));
    slots.set(step, slot);
  }
  const tally = (slot: { durations: number[]; roots: Map<number, number> }): number =>
    [...slot.roots.values()].reduce((sum, count) => sum + count, 0);
  const dominantRoot = (
    slot: { durations: number[]; roots: Map<number, number> },
  ): number =>
    [...slot.roots.entries()].sort(
      (a, b) => b[1] - a[1] || a[0] - b[0],
    )[0]?.[0] ?? 0;
  const owners = new Map<number, number>();
  const acceptedOwners = new Set<number>();
  const byStrength = [...slots.entries()].sort(
    (a, b) => tally(b[1]) - tally(a[1]) || a[0] - b[0],
  );
  for (const [step, slot] of byStrength) {
    const previous = positiveModulo(step - 1, totalSteps);
    const next = positiveModulo(step + 1, totalSteps);
    const neighbors = [previous, next]
      .filter((candidate) => acceptedOwners.has(candidate))
      .sort(
        (a, b) =>
          tally(slots.get(b) ?? slot) - tally(slots.get(a) ?? slot),
      );
    const owner = neighbors.find((candidate) => {
      const candidateSlot = slots.get(candidate);
      return (
        candidateSlot !== undefined &&
        (tally(slot) < 0.75 * tally(candidateSlot) ||
          dominantRoot(slot) === dominantRoot(candidateSlot))
      );
    });
    if (owner === undefined) {
      acceptedOwners.add(step);
      owners.set(step, step);
    } else {
      owners.set(step, owner);
    }
  }
  const foldedSlots = new Map<
    number,
    { durations: number[]; roots: Map<number, number> }
  >();
  for (const [step, slot] of slots) {
    const owner = owners.get(step) ?? step;
    const folded =
      foldedSlots.get(owner) ?? { durations: [], roots: new Map<number, number>() };
    folded.durations.push(...slot.durations);
    for (const [rootPc, count] of slot.roots) {
      folded.roots.set(rootPc, (folded.roots.get(rootPc) ?? 0) + count);
    }
    foldedSlots.set(owner, folded);
  }
  let accepted = [...foldedSlots.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([step, slot]) => {
      const root = [...slot.roots.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
      return root && root[1] >= voteThreshold ? [{ durations: slot.durations, rootPc: root[0], step }] : [];
    })
    .slice(0, options.maximumEntries ?? 16);
  if (accepted.length === 0) {
    accepted = [...foldedSlots.entries()]
      .sort(([a], [b]) => a - b)
      .map(([step, slot]) => ({
        durations: slot.durations,
        rootPc: dominantRoot(slot),
        step,
      }))
      .slice(0, options.maximumEntries ?? 16);
  }
  if (accepted.length === 0) return null;
  const key = options.key
    ? { ...options.key, confidence: 1 }
    : inferHarmonyKey(notes);
  const baseLength = median(accepted.map((entry) => median(entry.durations)).filter((value) => value > 0));
  const entries = accepted.map((entry): HarmonyCaptureEntry => {
    const quality = suggestedQuality(entry.rootPc, key);
    const matchingPitches = notes
      .map((note) => note.midi)
      .filter(
        (midi) => positiveModulo(Math.round(midi), 12) === entry.rootPc,
      );
    return {
      duration: durationFromSamples(entry.durations, baseLength),
      face: faceFor(entry.rootPc, quality),
      midi:
        Math.round(median(matchingPitches)) ||
        60 + positiveModulo(entry.rootPc, 12),
      muted: false,
      qualitySource: 'suggested',
    };
  });
  return {
    bpm,
    confidence: entries.length / Math.max(1, foldedSlots.size),
    entries,
    key,
    repetitions,
  };
}

export function setHarmonyCaptureBpm(
  analysis: HarmonyCaptureAnalysis,
  bpm: number,
): HarmonyCaptureAnalysis {
  return { ...analysis, bpm: Math.max(40, Math.min(280, Math.round(bpm))) };
}

export function updateHarmonyCaptureEntry(
  analysis: HarmonyCaptureAnalysis,
  index: number,
  patch: {
    duration?: HarmonyDuration;
    midi?: number;
    quality?: TonnetzQuality;
    rootPc?: number;
  },
): HarmonyCaptureAnalysis {
  if (!Number.isInteger(index) || index < 0 || index >= analysis.entries.length) return analysis;
  const entries = analysis.entries.map((entry, current) => {
    if (current !== index) return entry;
    const requestedRoot =
      patch.midi === undefined
        ? patch.rootPc
        : positiveModulo(Math.round(patch.midi), 12);
    const rootPc = positiveModulo(requestedRoot ?? entry.face.rootPc, 12);
    const quality = patch.quality ?? entry.face.quality;
    const rootDelta = positiveModulo(rootPc - entry.face.rootPc + 6, 12) - 6;
    return {
      ...entry,
      ...(patch.duration === undefined ? {} : { duration: patch.duration }),
      face: faceFor(rootPc, quality),
      midi:
        patch.midi === undefined
          ? entry.midi + rootDelta
          : Math.max(24, Math.min(108, Math.round(patch.midi))),
    };
  });
  return { ...analysis, entries };
}

export function removeHarmonyCaptureEntry(
  analysis: HarmonyCaptureAnalysis,
  index: number,
): HarmonyCaptureAnalysis {
  if (!Number.isInteger(index) || index < 0 || index >= analysis.entries.length) return analysis;
  return { ...analysis, entries: analysis.entries.filter((_, current) => current !== index) };
}
