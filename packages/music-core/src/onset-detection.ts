// SPDX-License-Identifier: AGPL-3.0-only
// Offline percussive onset detection for rhythm capture (ADR 0032). Replaces
// beatbox-lab_7.html's live envelope state machine (detectOnset/confirmOnset/
// grabFeatures) with a record-then-analyze pipeline: log-magnitude spectral
// flux (Dixon 2006) plus adaptive peak-picking (Böck et al. 2012), and lane
// classification from spectral features measured over the recorded onset
// segment instead of one live AnalyserNode frame. It emits the SAME
// `CaptureOnset` contract the unchanged tempo/vote/quantize stage consumes.

import { fftInPlace } from './fft';
import type { CaptureLane, CaptureOnset } from './rhythm-capture';

export interface OnsetDetectionOptions {
  /** centroid (Hz) below which, with low ZCR, an onset is a low/pulse hit. */
  bassCutoffHz?: number;
  fftSize?: number;
  /** centroid (Hz) above which an onset is an air/high hit. */
  highCutoffHz?: number;
  hopSize?: number;
  /** Peak must exceed the local mean flux by this fraction of the flux range. */
  peakDelta?: number;
  /** Minimum seconds between accepted onsets (refractory). */
  refractorySeconds?: number;
  /** Absolute RMS floor; onset windows quieter than this are ignored. */
  rmsFloor?: number;
}

// beatbox-lab_7.html classification cutoffs (bdCut 1300, hhCut 4600) and its
// 90 ms refractory are retained as defaults so the lane semantics match the
// prototype the player already tuned against.
const DEFAULT_FFT_SIZE = 1_024;
const DEFAULT_HOP_SIZE = 256;
const DEFAULT_BASS_CUTOFF = 1_300;
const DEFAULT_HIGH_CUTOFF = 4_600;
const DEFAULT_REFRACTORY = 0.09;
const DEFAULT_PEAK_DELTA = 0.08;
const DEFAULT_RMS_FLOOR = 0.006;

// Böck peak-picking neighbourhoods, in seconds.
const PRE_MAX = 0.03;
const POST_MAX = 0.03;
const PRE_AVG = 0.1;
const POST_AVG = 0.07;

function hannWindow(size: number): Float64Array {
  const window = new Float64Array(size);
  for (let i = 0; i < size; i += 1) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  }
  return window;
}

export interface SpectralFlux {
  /** Combined multiband onset novelty (full-band flux + low-band flux). */
  novelty: Float64Array;
  /** RMS per frame over the analysis window. */
  rms: Float64Array;
}

// Low band (~< 160 Hz) captures kick/bass onsets that full-band spectral flux
// under-weights: a broadband hat raises hundreds of bins (flux in the hundreds)
// while a narrowband kick raises only two or three (flux ~2), so on a shared
// adaptive threshold the kick is lost. The two bands are normalized and summed
// so bass and treble onsets compete fairly.
const LOW_BAND_HZ = 160;
const LOW_BAND_WEIGHT = 1.5;

function normalizeInPlace(values: Float64Array): void {
  let maximum = 0;
  for (let i = 0; i < values.length; i += 1) maximum = Math.max(maximum, values[i] ?? 0);
  if (maximum <= 0) return;
  for (let i = 0; i < values.length; i += 1) values[i] = (values[i] ?? 0) / maximum;
}

/**
 * Multiband onset novelty: half-wave-rectified log-magnitude spectral flux
 * (Dixon 2006) over the full band plus a low-band flux, each normalized and
 * summed so kick onsets survive alongside hats and snares.
 */
export function spectralFlux(
  samples: ArrayLike<number>,
  fftSize: number,
  hopSize: number,
  sampleRate = 44_100,
): SpectralFlux {
  const bins = fftSize / 2;
  const window = hannWindow(fftSize);
  const frameCount = Math.max(0, Math.floor((samples.length - fftSize) / hopSize) + 1);
  const fullFlux = new Float64Array(Math.max(0, frameCount));
  const lowFlux = new Float64Array(Math.max(0, frameCount));
  const rms = new Float64Array(Math.max(0, frameCount));
  const real = new Float64Array(fftSize);
  const imag = new Float64Array(fftSize);
  const lowBinMax = Math.max(2, Math.round((LOW_BAND_HZ * fftSize) / sampleRate));
  // Seed `previous` from the first frame so frame 0 reports zero flux instead
  // of a full-spectrum spike against an all-zero history.
  let previous: Float64Array | null = null;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * hopSize;
    let squares = 0;
    for (let i = 0; i < fftSize; i += 1) {
      const value = samples[start + i] ?? 0;
      squares += value * value;
      real[i] = value * (window[i] ?? 0);
      imag[i] = 0;
    }
    rms[frame] = Math.sqrt(squares / fftSize);
    fftInPlace(real, imag);
    const magnitude = new Float64Array(bins);
    let flux = 0;
    let low = 0;
    for (let bin = 0; bin < bins; bin += 1) {
      const power = (real[bin] ?? 0) ** 2 + (imag[bin] ?? 0) ** 2;
      const logMagnitude = Math.log1p(Math.sqrt(power));
      magnitude[bin] = logMagnitude;
      const rise = logMagnitude - (previous?.[bin] ?? logMagnitude);
      if (rise > 0) {
        flux += rise;
        if (bin >= 1 && bin <= lowBinMax) low += rise;
      }
    }
    fullFlux[frame] = flux;
    lowFlux[frame] = low;
    previous = magnitude;
  }
  normalizeInPlace(fullFlux);
  normalizeInPlace(lowFlux);
  const novelty = new Float64Array(Math.max(0, frameCount));
  for (let frame = 0; frame < frameCount; frame += 1) {
    novelty[frame] = (fullFlux[frame] ?? 0) + LOW_BAND_WEIGHT * (lowFlux[frame] ?? 0);
  }
  return { novelty, rms };
}

interface OnsetFrame {
  frame: number;
  strength: number;
}

/** Adaptive peak-picking over the novelty curve (Böck et al. 2012). */
export function pickOnsetFrames(
  novelty: Float64Array,
  frameDuration: number,
  options: { peakDelta: number; refractorySeconds: number },
): OnsetFrame[] {
  const frameCount = novelty.length;
  if (frameCount < 3) return [];
  let maximum = 0;
  for (let i = 0; i < frameCount; i += 1) maximum = Math.max(maximum, novelty[i] ?? 0);
  if (maximum <= 0) return [];
  const preMax = Math.max(1, Math.round(PRE_MAX / frameDuration));
  const postMax = Math.max(1, Math.round(POST_MAX / frameDuration));
  const preAvg = Math.max(1, Math.round(PRE_AVG / frameDuration));
  const postAvg = Math.max(1, Math.round(POST_AVG / frameDuration));
  const refractoryFrames = Math.max(1, Math.round(options.refractorySeconds / frameDuration));
  const delta = options.peakDelta * maximum;
  const onsets: OnsetFrame[] = [];
  let lastOnset = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < frameCount; i += 1) {
    const value = novelty[i] ?? 0;
    let isLocalMax = true;
    for (let j = Math.max(0, i - preMax); j <= Math.min(frameCount - 1, i + postMax); j += 1) {
      if ((novelty[j] ?? 0) > value) {
        isLocalMax = false;
        break;
      }
    }
    if (!isLocalMax) continue;
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - preAvg); j <= Math.min(frameCount - 1, i + postAvg); j += 1) {
      sum += novelty[j] ?? 0;
      count += 1;
    }
    const localMean = count > 0 ? sum / count : 0;
    if (value >= localMean + delta && value > 0 && i - lastOnset >= refractoryFrames) {
      onsets.push({ frame: i, strength: value });
      lastOnset = i;
    }
  }
  return onsets;
}

interface OnsetFeatures {
  centroid: number;
  peak: number;
  peakSample: number;
  zcr: number;
}

// beatbox-lab_7.html grabFeatures() reads an AnalyserNode (FFT 2048) whose
// getByteFrequencyData compresses magnitude to a dB byte scale, and it samples
// at the attack peak. The offline measurement replicates both so the lane
// cutoffs (1300/4600 Hz, ZCR 0.15/0.35) keep their calibrated meaning.
const FEATURE_FFT = 2_048;
const ANALYSER_MIN_DB = -100;
const ANALYSER_MAX_DB = -30;
// Byte-spectrum noise gate: bins below this contribute neither to the centroid
// numerator nor denominator. Without it, hundreds of near-floor high-frequency
// bins (each mapped to ~byte 25 by the -100 dB floor) drag every centroid
// upward. Gating restores the prototype's calibrated lane separation and is
// the standard defense against a noise-inflated spectral centroid.
const CENTROID_GATE_BYTE = 40;

/** Web Audio getByteFrequencyData scaling: normalized dB mapped to [0, 255]. */
function toByteMagnitude(magnitude: number, fftSize: number): number {
  const normalized = magnitude / fftSize;
  if (normalized <= 0) return 0;
  const db = 20 * Math.log10(normalized);
  const scaled = (255 * (db - ANALYSER_MIN_DB)) / (ANALYSER_MAX_DB - ANALYSER_MIN_DB);
  return Math.max(0, Math.min(255, scaled));
}

/** Spectral features over the recorded onset segment (offline grabFeatures). */
function measureOnsetFeatures(
  samples: ArrayLike<number>,
  onsetSample: number,
  sampleRate: number,
): OnsetFeatures {
  // Align to the attack peak: the flux frame starts up to a window before the
  // transient, so measuring from there would read pre-attack noise.
  const searchEnd = Math.min(samples.length, onsetSample + Math.round(0.05 * sampleRate));
  let peakSample = onsetSample;
  let peakAbs = 0;
  for (let i = onsetSample; i < searchEnd; i += 1) {
    const magnitude = Math.abs(samples[i] ?? 0);
    if (magnitude > peakAbs) {
      peakAbs = magnitude;
      peakSample = i;
    }
  }
  // A 2048-sample window ending near the peak mirrors the analyser's history
  // at the moment the prototype grabs features.
  const windowStart = Math.max(0, Math.min(peakSample - 256, samples.length - FEATURE_FFT));
  const start = Math.max(0, windowStart);
  let squares = 0;
  let crossings = 0;
  let previousSign = 0;
  let counted = 0;
  const window = hannWindow(FEATURE_FFT);
  const real = new Float64Array(FEATURE_FFT);
  const imag = new Float64Array(FEATURE_FFT);
  for (let i = 0; i < FEATURE_FFT; i += 1) {
    const value = samples[start + i] ?? 0;
    real[i] = value * (window[i] ?? 0);
    imag[i] = 0;
    // ZCR and RMS over the transient body only, from the peak onward.
    if (start + i >= peakSample) {
      squares += value * value;
      const sign = value < 0 ? -1 : 1;
      if (counted > 0 && sign !== previousSign) crossings += 1;
      previousSign = sign;
      counted += 1;
    }
  }
  const peak = Math.sqrt(squares / Math.max(1, counted));
  const zcr = counted > 0 ? crossings / counted : 0;

  fftInPlace(real, imag);
  const bins = FEATURE_FFT / 2;
  const binHz = sampleRate / FEATURE_FFT;
  let numerator = 0;
  let denominator = 0;
  for (let bin = 1; bin < bins; bin += 1) {
    const magnitude = toByteMagnitude(
      Math.sqrt((real[bin] ?? 0) ** 2 + (imag[bin] ?? 0) ** 2),
      FEATURE_FFT,
    );
    if (magnitude < CENTROID_GATE_BYTE) continue;
    numerator += magnitude * bin * binHz;
    denominator += magnitude;
  }
  return {
    centroid: denominator > 0 ? numerator / denominator : 0,
    peak,
    peakSample,
    zcr,
  };
}

/** beatbox-lab_7.html emitOnset() lane rule, applied to offline features. */
function classifyLane(features: OnsetFeatures, bassCutoffHz: number, highCutoffHz: number): CaptureLane {
  if (features.centroid < bassCutoffHz && features.zcr < 0.15) return 'pulse';
  if (features.centroid > highCutoffHz || features.zcr > 0.35) return 'air';
  return 'click';
}

/**
 * Detect classified onsets from a complete recorded PCM buffer. Onset times
 * are seconds from the start of `samples`; pair with `captureStart = 0` when
 * feeding `analyzeRhythmCapture`.
 */
export function detectOnsets(
  samples: ArrayLike<number>,
  sampleRate: number,
  options: OnsetDetectionOptions = {},
): CaptureOnset[] {
  const fftSize = options.fftSize ?? DEFAULT_FFT_SIZE;
  const hopSize = options.hopSize ?? DEFAULT_HOP_SIZE;
  const bassCutoffHz = options.bassCutoffHz ?? DEFAULT_BASS_CUTOFF;
  const highCutoffHz = options.highCutoffHz ?? DEFAULT_HIGH_CUTOFF;
  const refractorySeconds = options.refractorySeconds ?? DEFAULT_REFRACTORY;
  const peakDelta = options.peakDelta ?? DEFAULT_PEAK_DELTA;
  const rmsFloor = options.rmsFloor ?? DEFAULT_RMS_FLOOR;
  if (sampleRate <= 0 || samples.length < fftSize * 2) return [];

  const { novelty, rms } = spectralFlux(samples, fftSize, hopSize, sampleRate);
  const frameDuration = hopSize / sampleRate;
  const frames = pickOnsetFrames(novelty, frameDuration, { peakDelta, refractorySeconds });
  const onsets: CaptureOnset[] = [];
  for (const { frame } of frames) {
    if ((rms[frame] ?? 0) < rmsFloor) continue;
    // The flux frame begins up to a window before the transient; the features
    // pass locates the true attack peak and returns it as the onset time.
    const onsetSample = frame * hopSize;
    const features = measureOnsetFeatures(samples, onsetSample, sampleRate);
    if (features.peak < rmsFloor) continue;
    onsets.push({
      lane: classifyLane(features, bassCutoffHz, highCutoffHz),
      peak: features.peak,
      time: features.peakSample / sampleRate,
    });
  }
  return onsets;
}
