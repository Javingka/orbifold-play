// SPDX-License-Identifier: AGPL-3.0-only
// pYIN monophonic pitch tracker (Mauch & Dixon, ICASSP 2014) with
// librosa-validated default parameters (100 thresholds, Beta(2, 18) prior,
// Boltzmann(2) trough weighting, switch/no-trough probability 0.01, maximum
// transition rate ~35.92 octaves/s). See ADR 0031: this module replaces the
// melody-lab.html single-threshold YIN estimation stage and is deliberately
// cited against the paper/parameters rather than the prototype.

import { fftInPlace } from './fft';

export { fftInPlace };

export interface PyinFrame {
  /** Continuous decoded pitch in MIDI numbers; 0 when the frame is unvoiced. */
  midi: number;
  rms: number;
  time: number;
  voicedProbability: number;
}

export interface PyinNote {
  confidence: number;
  midi: number;
  t0: number;
  t1: number;
}

export interface PyinTrackOptions {
  /** Bins per semitone of the Viterbi pitch grid. */
  binsPerSemitone?: number;
  maximumHz?: number;
  minimumHz?: number;
  /** Maximum probability granted to the global CMND minimum when no trough is under a threshold. */
  noTroughProbability?: number;
  /** Probability of switching between voiced and unvoiced states per frame. */
  switchProbability?: number;
}

export interface PyinSegmentOptions {
  minimumDuration?: number;
  minimumFrames?: number;
  /** Log-amplitude rise over the recent minimum that re-articulates a note. */
  onsetLogRise?: number;
  /** Sustained pitch step (semitones) that starts a new note. */
  pitchStep?: number;
  /** RMS gate; frames below it are treated as unvoiced. */
  rmsThreshold?: number;
}

const THRESHOLD_COUNT = 100;
const BETA_A = 2;
const BETA_B = 18;
const BOLTZMANN = 2;
const FRAME_LENGTH = 2_048;
const WINDOW_LENGTH = 1_024;
const HOP_LENGTH = 256;
const MAX_TRANSITION_OCTAVES_PER_SECOND = 35.92;

function frequencyToMidi(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440);
}

/**
 * Fast YIN difference function over one frame:
 * `d(tau) = r_head(0) + r_tail(tau) - 2 * crossCorrelation(tau)`,
 * with the cross term computed through the FFT.
 */
export function yinDifference(
  frame: Float64Array,
  windowLength: number,
  tauMax: number,
): Float64Array {
  const usableTauMax = Math.min(tauMax, frame.length - windowLength);
  const difference = new Float64Array(Math.max(0, usableTauMax + 1));
  if (usableTauMax < 1 || windowLength < 2) return difference;
  let size = 1;
  while (size < frame.length + windowLength) size <<= 1;
  const aRe = new Float64Array(size);
  const aIm = new Float64Array(size);
  const bRe = new Float64Array(size);
  const bIm = new Float64Array(size);
  for (let i = 0; i < frame.length; i += 1) aRe[i] = frame[i] ?? 0;
  // Reversed head so the linear correlation appears as a convolution.
  for (let i = 0; i < windowLength; i += 1) bRe[i] = frame[windowLength - 1 - i] ?? 0;
  fftInPlace(aRe, aIm);
  fftInPlace(bRe, bIm);
  for (let i = 0; i < size; i += 1) {
    const re = (aRe[i] ?? 0) * (bRe[i] ?? 0) - (aIm[i] ?? 0) * (bIm[i] ?? 0);
    const im = (aRe[i] ?? 0) * (bIm[i] ?? 0) + (aIm[i] ?? 0) * (bRe[i] ?? 0);
    aRe[i] = re;
    aIm[i] = im;
  }
  fftInPlace(aRe, aIm, true);
  // crossCorrelation(tau) = sum_j frame[j] * frame[j + tau], j < windowLength.
  const cross = (tau: number): number => aRe[windowLength - 1 + tau] ?? 0;
  let headEnergy = 0;
  for (let i = 0; i < windowLength; i += 1) headEnergy += (frame[i] ?? 0) ** 2;
  let tailEnergy = headEnergy;
  for (let tau = 0; tau <= usableTauMax; tau += 1) {
    if (tau > 0) {
      tailEnergy +=
        (frame[windowLength + tau - 1] ?? 0) ** 2 - (frame[tau - 1] ?? 0) ** 2;
    }
    difference[tau] = Math.max(0, headEnergy + tailEnergy - 2 * cross(tau));
  }
  return difference;
}

/** Cumulative mean normalized difference (YIN eq. 8). */
export function cumulativeMeanNormalizedDifference(difference: Float64Array): Float64Array {
  const cmnd = new Float64Array(difference.length).fill(1);
  let running = 0;
  for (let tau = 1; tau < difference.length; tau += 1) {
    running += difference[tau] ?? 0;
    cmnd[tau] = running > 1e-12 ? ((difference[tau] ?? 0) * tau) / running : 1;
  }
  return cmnd;
}

export interface PyinFrameCandidate {
  probability: number;
  /** Parabolically refined period in samples. */
  tau: number;
}

function betaThresholdPrior(): Float64Array {
  const prior = new Float64Array(THRESHOLD_COUNT);
  let sum = 0;
  for (let i = 0; i < THRESHOLD_COUNT; i += 1) {
    const t = (i + 1) / THRESHOLD_COUNT;
    const value = t ** (BETA_A - 1) * (1 - t) ** (BETA_B - 1);
    prior[i] = value;
    sum += value;
  }
  for (let i = 0; i < THRESHOLD_COUNT; i += 1) prior[i] = (prior[i] ?? 0) / sum;
  return prior;
}

const THRESHOLD_PRIOR = betaThresholdPrior();

/**
 * pYIN stage 1: pitch candidates with probabilities from a Beta(2, 18) prior
 * over YIN thresholds and Boltzmann(2) weighting over qualifying troughs.
 */
export function extractFrameCandidates(
  cmnd: Float64Array,
  tauMin: number,
  tauMax: number,
  noTroughProbability = 0.01,
): PyinFrameCandidate[] {
  const troughs: { refinedTau: number; value: number }[] = [];
  const limit = Math.min(tauMax, cmnd.length - 2);
  for (let tau = Math.max(2, tauMin); tau <= limit; tau += 1) {
    const before = cmnd[tau - 1] ?? 1;
    const value = cmnd[tau] ?? 1;
    const after = cmnd[tau + 1] ?? 1;
    if (value <= before && value <= after && value < 1) {
      let refinedTau = tau;
      const denominator = 2 * (2 * value - before - after);
      if (denominator !== 0) {
        const offset = (after - before) / denominator;
        if (Math.abs(offset) < 1) refinedTau += offset;
      }
      troughs.push({ refinedTau, value });
    }
  }
  if (troughs.length === 0) return [];
  let globalMinIndex = 0;
  for (let i = 1; i < troughs.length; i += 1) {
    if ((troughs[i]?.value ?? 1) < (troughs[globalMinIndex]?.value ?? 1)) globalMinIndex = i;
  }
  const probabilities = new Float64Array(troughs.length);
  for (let t = 0; t < THRESHOLD_COUNT; t += 1) {
    const threshold = (t + 1) / THRESHOLD_COUNT;
    const prior = THRESHOLD_PRIOR[t] ?? 0;
    const below: number[] = [];
    for (let i = 0; i < troughs.length; i += 1) {
      if ((troughs[i]?.value ?? 1) < threshold) below.push(i);
    }
    if (below.length === 0) {
      probabilities[globalMinIndex] =
        (probabilities[globalMinIndex] ?? 0) + prior * noTroughProbability;
      continue;
    }
    let weightSum = 0;
    for (let j = 0; j < below.length; j += 1) weightSum += Math.exp(-BOLTZMANN * j);
    for (let j = 0; j < below.length; j += 1) {
      const index = below[j] ?? 0;
      probabilities[index] =
        (probabilities[index] ?? 0) + (prior * Math.exp(-BOLTZMANN * j)) / weightSum;
    }
  }
  return troughs.map((trough, index) => ({
    probability: probabilities[index] ?? 0,
    tau: trough.refinedTau,
  }));
}

function decimateAndFilter(
  samples: ArrayLike<number>,
  sampleRate: number,
): { rate: number; signal: Float64Array } {
  let signal: Float64Array;
  let rate = sampleRate;
  if (sampleRate > 30_000) {
    const length = Math.max(0, Math.floor((samples.length - 2) / 2));
    signal = new Float64Array(length);
    for (let i = 0; i < length; i += 1) {
      const source = i * 2 + 1;
      signal[i] =
        ((samples[source - 1] ?? 0) + 2 * (samples[source] ?? 0) + (samples[source + 1] ?? 0)) / 4;
    }
    rate = sampleRate / 2;
  } else {
    signal = new Float64Array(samples.length);
    for (let i = 0; i < samples.length; i += 1) signal[i] = samples[i] ?? 0;
  }
  // First-order high-pass (~55 Hz) against rumble and handling noise.
  const r = 1 - (2 * Math.PI * 55) / rate;
  let previousInput = 0;
  let previousOutput = 0;
  for (let i = 0; i < signal.length; i += 1) {
    const input = signal[i] ?? 0;
    previousOutput = input - previousInput + r * previousOutput;
    previousInput = input;
    signal[i] = previousOutput;
  }
  return { rate, signal };
}

/**
 * pYIN stage 2: banded Viterbi decoding over 1/5-semitone pitch bins with
 * paired voiced/unvoiced states carrying pitch memory through silence.
 */
export function trackPitch(
  samples: ArrayLike<number>,
  sampleRate: number,
  options: PyinTrackOptions = {},
): PyinFrame[] {
  if (sampleRate <= 0 || samples.length < FRAME_LENGTH) return [];
  const minimumHz = options.minimumHz ?? 65;
  const maximumHz = options.maximumHz ?? 3_000;
  const binsPerSemitone = options.binsPerSemitone ?? 5;
  const switchProbability = options.switchProbability ?? 0.01;
  const noTroughProbability = options.noTroughProbability ?? 0.01;
  const { rate, signal } = decimateAndFilter(samples, sampleRate);
  if (signal.length < FRAME_LENGTH) return [];

  const tauMin = Math.max(2, Math.floor(rate / maximumHz));
  const tauMax = Math.min(FRAME_LENGTH - WINDOW_LENGTH, Math.ceil(rate / minimumHz));
  if (tauMax <= tauMin + 2) return [];
  const minMidi = Math.floor(frequencyToMidi(minimumHz));
  const maxMidi = Math.ceil(frequencyToMidi(Math.min(maximumHz, rate / tauMin)));
  const binCount = (maxMidi - minMidi) * binsPerSemitone + 1;
  const midiOfBin = (bin: number): number => minMidi + bin / binsPerSemitone;
  const binOfMidi = (midi: number): number =>
    Math.max(0, Math.min(binCount - 1, Math.round((midi - minMidi) * binsPerSemitone)));

  const frameCount = Math.floor((signal.length - FRAME_LENGTH) / HOP_LENGTH) + 1;
  if (frameCount < 1) return [];
  const hopSeconds = HOP_LENGTH / rate;
  const transitionWidth = Math.max(
    2,
    Math.round(MAX_TRANSITION_OCTAVES_PER_SECOND * 12 * hopSeconds * binsPerSemitone),
  );
  const logTriangle = new Float64Array(transitionWidth + 1);
  {
    let sum = 0;
    for (let d = 0; d <= transitionWidth; d += 1) {
      sum += (transitionWidth + 1 - d) * (d === 0 ? 1 : 2);
    }
    for (let d = 0; d <= transitionWidth; d += 1) {
      logTriangle[d] = Math.log((transitionWidth + 1 - d) / sum);
    }
  }
  const logStay = Math.log(1 - switchProbability);
  const logSwitch = Math.log(switchProbability);

  interface AnalyzedFrame {
    candidates: PyinFrameCandidate[];
    rms: number;
    time: number;
    voicedProbability: number;
  }
  const analyzed: AnalyzedFrame[] = [];
  const frame = new Float64Array(FRAME_LENGTH);
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const start = frameIndex * HOP_LENGTH;
    let squares = 0;
    for (let i = 0; i < FRAME_LENGTH; i += 1) {
      const value = signal[start + i] ?? 0;
      frame[i] = value;
      if (i < WINDOW_LENGTH) squares += value * value;
    }
    const rms = Math.sqrt(squares / WINDOW_LENGTH);
    const difference = yinDifference(frame, WINDOW_LENGTH, tauMax);
    const cmnd = cumulativeMeanNormalizedDifference(difference);
    const candidates = extractFrameCandidates(cmnd, tauMin, tauMax, noTroughProbability).filter(
      (candidate) => {
        const midi = frequencyToMidi(rate / candidate.tau);
        return midi >= minMidi && midi <= maxMidi;
      },
    );
    let voicedProbability = 0;
    for (const candidate of candidates) voicedProbability += candidate.probability;
    analyzed.push({
      candidates,
      rms,
      time: (start + WINDOW_LENGTH / 2) / rate,
      voicedProbability: Math.min(1, voicedProbability),
    });
  }

  // Banded Viterbi over 2 * binCount states: [0, binCount) voiced,
  // [binCount, 2 * binCount) unvoiced shadows of the same pitch bin.
  const stateCount = 2 * binCount;
  let delta = new Float64Array(stateCount).fill(Math.log(1 / stateCount));
  let next = new Float64Array(stateCount);
  const backpointers: Int32Array[] = [];
  const logObservationVoiced = new Float64Array(binCount);
  for (const current of analyzed) {
    logObservationVoiced.fill(Number.NEGATIVE_INFINITY);
    for (const candidate of current.candidates) {
      const bin = binOfMidi(frequencyToMidi(rate / candidate.tau));
      const existing = logObservationVoiced[bin] ?? Number.NEGATIVE_INFINITY;
      const combined = Number.isFinite(existing)
        ? Math.exp(existing) + candidate.probability
        : candidate.probability;
      logObservationVoiced[bin] = Math.log(Math.max(1e-12, combined));
    }
    const logObservationUnvoiced = Math.log(
      Math.max(1e-12, (1 - current.voicedProbability) / binCount),
    );
    const pointer = new Int32Array(stateCount);
    for (let bin = 0; bin < binCount; bin += 1) {
      let bestVoiced = Number.NEGATIVE_INFINITY;
      let bestVoicedFrom = bin;
      let bestUnvoiced = Number.NEGATIVE_INFINITY;
      let bestUnvoicedFrom = bin + binCount;
      const low = Math.max(0, bin - transitionWidth);
      const high = Math.min(binCount - 1, bin + transitionWidth);
      for (let from = low; from <= high; from += 1) {
        const jump = logTriangle[Math.abs(from - bin)] ?? Number.NEGATIVE_INFINITY;
        const fromVoiced = (delta[from] ?? Number.NEGATIVE_INFINITY) + jump;
        const fromUnvoiced = (delta[from + binCount] ?? Number.NEGATIVE_INFINITY) + jump;
        const toVoiced = Math.max(fromVoiced + logStay, fromUnvoiced + logSwitch);
        if (toVoiced > bestVoiced) {
          bestVoiced = toVoiced;
          bestVoicedFrom = fromVoiced + logStay >= fromUnvoiced + logSwitch ? from : from + binCount;
        }
        const toUnvoiced = Math.max(fromUnvoiced + logStay, fromVoiced + logSwitch);
        if (toUnvoiced > bestUnvoiced) {
          bestUnvoiced = toUnvoiced;
          bestUnvoicedFrom =
            fromUnvoiced + logStay >= fromVoiced + logSwitch ? from + binCount : from;
        }
      }
      next[bin] = bestVoiced + (logObservationVoiced[bin] ?? Number.NEGATIVE_INFINITY);
      pointer[bin] = bestVoicedFrom;
      next[bin + binCount] = bestUnvoiced + logObservationUnvoiced;
      pointer[bin + binCount] = bestUnvoicedFrom;
    }
    backpointers.push(pointer);
    const swap = delta;
    delta = next;
    next = swap;
    // Renormalize to avoid drifting toward -Infinity on long captures.
    let maxLog = Number.NEGATIVE_INFINITY;
    for (let s = 0; s < stateCount; s += 1) {
      const value = delta[s] ?? Number.NEGATIVE_INFINITY;
      if (value > maxLog) maxLog = value;
    }
    if (Number.isFinite(maxLog)) {
      for (let s = 0; s < stateCount; s += 1) delta[s] = (delta[s] ?? 0) - maxLog;
    }
  }

  let state = binCount;
  let bestFinal = Number.NEGATIVE_INFINITY;
  for (let s = 0; s < stateCount; s += 1) {
    const value = delta[s] ?? Number.NEGATIVE_INFINITY;
    if (value > bestFinal) {
      bestFinal = value;
      state = s;
    }
  }
  const statePath = new Int32Array(analyzed.length);
  for (let frameIndex = analyzed.length - 1; frameIndex >= 0; frameIndex -= 1) {
    statePath[frameIndex] = state;
    state = backpointers[frameIndex]?.[state] ?? state;
  }

  return analyzed.map((current, frameIndex) => {
    const decodedState = statePath[frameIndex] ?? binCount;
    const voiced = decodedState < binCount;
    const bin = voiced ? decodedState : decodedState - binCount;
    let midi = 0;
    if (voiced) {
      midi = midiOfBin(bin);
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const candidate of current.candidates) {
        const candidateMidi = frequencyToMidi(rate / candidate.tau);
        const distance = Math.abs(candidateMidi - midi);
        if (distance <= 1.5 / binsPerSemitone && distance < bestDistance) {
          bestDistance = distance;
          midi = candidateMidi;
        }
      }
    }
    return {
      midi,
      rms: current.rms,
      time: current.time,
      voicedProbability: current.voicedProbability,
    };
  });
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

/**
 * Note segmentation over the decoded track: voicing runs, sustained pitch
 * steps, and log-energy onsets that re-articulate repeated same-pitch notes.
 */
export function segmentNotes(
  frames: readonly PyinFrame[],
  options: PyinSegmentOptions = {},
): PyinNote[] {
  const rmsThreshold = options.rmsThreshold ?? 0.008;
  const pitchStep = options.pitchStep ?? 0.6;
  const onsetLogRise = options.onsetLogRise ?? Math.log(2.2);
  const minimumFrames = options.minimumFrames ?? 3;
  const minimumDuration = options.minimumDuration ?? 0.08;
  if (frames.length < minimumFrames) return [];
  const hop =
    median(
      frames
        .slice(1)
        .map((frame, index) => frame.time - (frames[index]?.time ?? frame.time))
        .filter((duration) => duration > 0),
    ) || 0.011;

  const onset = new Array<boolean>(frames.length).fill(false);
  let lastOnsetIndex = Number.NEGATIVE_INFINITY;
  for (let i = 2; i < frames.length; i += 1) {
    let recentMinimum = Number.POSITIVE_INFINITY;
    for (let j = Math.max(0, i - 6); j < i; j += 1) {
      recentMinimum = Math.min(recentMinimum, frames[j]?.rms ?? 0);
    }
    const rise = Math.log((frames[i]?.rms ?? 0) + 1e-6) - Math.log(recentMinimum + 1e-6);
    if (rise > onsetLogRise && i - lastOnsetIndex > 0.12 / hop) {
      onset[i] = true;
      lastOnsetIndex = i;
    }
  }

  const notes: (PyinNote & { startedByOnset: boolean })[] = [];
  let active: PyinFrame[] = [];
  let activeStartedByOnset = false;
  let unvoicedRun = 0;
  const close = (): void => {
    if (active.length >= minimumFrames) {
      const t0 = active[0]?.time ?? 0;
      const t1 = (active.at(-1)?.time ?? t0) + hop;
      if (t1 - t0 >= minimumDuration) {
        const pitches = active.map((frame) => frame.midi);
        const core = pitches.length >= 5 ? pitches.slice(1, -1) : pitches;
        notes.push({
          confidence:
            active.reduce((sum, frame) => sum + frame.voicedProbability, 0) / active.length,
          midi: Math.round(median(core)),
          startedByOnset: activeStartedByOnset,
          t0,
          t1,
        });
      }
    }
    active = [];
    activeStartedByOnset = false;
  };
  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    if (!frame) continue;
    const voiced = frame.midi > 0 && frame.rms > rmsThreshold;
    if (!voiced) {
      unvoicedRun += 1;
      if (active.length > 0 && unvoicedRun >= 2) close();
      continue;
    }
    unvoicedRun = 0;
    if (active.length > 0) {
      const reference = median(active.slice(-5).map((candidate) => candidate.midi));
      if (Math.abs(frame.midi - reference) > pitchStep || onset[i] === true) {
        close();
        if (onset[i] === true) activeStartedByOnset = true;
      }
    }
    active.push(frame);
  }
  close();

  const merged: PyinNote[] = [];
  for (const note of notes) {
    const previous = merged.at(-1);
    if (
      previous &&
      !note.startedByOnset &&
      previous.midi === note.midi &&
      note.t0 - previous.t1 <= 0.03
    ) {
      previous.t1 = note.t1;
      previous.confidence = Math.min(previous.confidence, note.confidence);
    } else {
      merged.push({ confidence: note.confidence, midi: note.midi, t0: note.t0, t1: note.t1 });
    }
  }
  return merged;
}
