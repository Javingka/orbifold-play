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
  /**
   * Prototype-rule bass cutoff (Hz). Since ADR 0034 `detectOnsets` classifies
   * with `classifySegmentLane`; this option only parameterizes the exported
   * baseline `classifyLane` and is kept for API stability.
   */
  bassCutoffHz?: number;
  fftSize?: number;
  /** Prototype-rule air cutoff (Hz); same ADR 0034 status as `bassCutoffHz`. */
  highCutoffHz?: number;
  hopSize?: number;
  /** Peak must exceed the local mean flux by this fraction of the flux range. */
  peakDelta?: number;
  /** Minimum seconds between accepted onsets (refractory). */
  refractorySeconds?: number;
  /** Absolute RMS floor; onset windows quieter than this are ignored. */
  rmsFloor?: number;
  /**
   * Rising-energy gate strength (ADR 0035): the RMS envelope must rise into a
   * novelty peak by at least this ratio for it to count as an onset, which
   * rejects the extra onsets a single sustained sound would otherwise spawn.
   * 1 = must be rising; higher = sharper attack required; ≤ 0 disables it.
   */
  minRiseRatio?: number;
}

// beatbox-lab_7.html classification cutoffs (bdCut 1300, hhCut 4600) and its
// 90 ms refractory are retained as defaults so the lane semantics match the
// prototype the player already tuned against.
const DEFAULT_FFT_SIZE = 1_024;
const DEFAULT_HOP_SIZE = 256;
const DEFAULT_BASS_CUTOFF = 1_300;
const DEFAULT_HIGH_CUTOFF = 4_600;
// Refractory nudged up from the prototype's 90 ms (still below a 16th note at
// 120 BPM, 125 ms) so a lip-release sub-peak inside one "bum" is absorbed; the
// rising-energy gate below handles sustained sounds the refractory cannot.
const DEFAULT_REFRACTORY = 0.11;
const DEFAULT_PEAK_DELTA = 0.08;
const DEFAULT_RMS_FLOOR = 0.006;
// Require the RMS envelope to be rising into a novelty peak by this ratio
// (ADR 0035). Strictly above 1 so a flat, constant-energy sustain (nowAvg ==
// pastAvg) is rejected, not just a decaying one, while a real attack (a sharp
// RMS rise) clears it comfortably.
const DEFAULT_MIN_RISE_RATIO = 1.08;

// ─── Detection sensitivity model (ADR 0035) ─────────────────────────────────
/** Sensitivity that reproduces the calibrated defaults. */
export const DEFAULT_SENSITIVITY = 0.5;

export interface DetectionSensitivityOptions {
  minRiseRatio: number;
  peakDelta: number;
  refractorySeconds: number;
  rmsFloor: number;
}

/** Piecewise-linear through (0 → strict, 0.5 → default, 1 → lenient). */
function lerp3(sensitivity: number, atLow: number, atMid: number, atHigh: number): number {
  // A non-finite sensitivity (NaN) must not poison the parameters — an NaN
  // floor would silently disable every floor check — so fall back to default.
  const s = Number.isFinite(sensitivity) ? sensitivity : DEFAULT_SENSITIVITY;
  const t = Math.min(1, Math.max(0, s));
  return t <= 0.5
    ? atLow + (atMid - atLow) * (t / 0.5)
    : atMid + (atHigh - atMid) * ((t - 0.5) / 0.5);
}

/**
 * Map one sensitivity scalar (0..1, default 0.5) to the four peak-picking
 * parameters. Every parameter moves monotonically with sensitivity so the
 * resulting onset count is non-decreasing: a higher value lowers the floor,
 * refractory, peak delta, and rise ratio, admitting more onsets; 0.5
 * reproduces the calibrated defaults, so a captured groove is unchanged until
 * the player deliberately moves the control.
 */
export function detectionSensitivityOptions(sensitivity: number): DetectionSensitivityOptions {
  return {
    minRiseRatio: lerp3(sensitivity, 1.6, DEFAULT_MIN_RISE_RATIO, 0.6),
    peakDelta: lerp3(sensitivity, 0.16, DEFAULT_PEAK_DELTA, 0.04),
    refractorySeconds: lerp3(sensitivity, 0.16, DEFAULT_REFRACTORY, 0.07),
    // Mid matches the prior effective floor (0.005) so default-sensitivity
    // capture does not lose soft hits that the old path admitted.
    rmsFloor: lerp3(sensitivity, 0.022, 0.005, 0.0025),
  };
}

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

// Rising-energy (re-attack) gate window, in seconds. A true onset is an
// attack — the RMS envelope rises into it. Spurious extra onsets on one
// sustained sound (a held "tss") sit on the decay slope where the envelope is
// falling, so requiring a rise rejects them. This is robust where a fixed
// "energy dipped below a fraction" valley test is not: a slowly decaying
// sustain eventually crosses any fixed dip threshold, but its envelope is
// never rising at the spurious peaks. The comparison uses windowed averages
// (not two point samples) because a noisy sound's per-frame RMS fluctuates —
// averaging lets the attack/decay trend, not frame noise, decide. (ADR 0035.)
const RISE_WINDOW = 0.03;

/** Adaptive peak-picking over the novelty curve (Böck et al. 2012). */
export function pickOnsetFrames(
  novelty: Float64Array,
  frameDuration: number,
  options: {
    peakDelta: number;
    refractorySeconds: number;
    /** RMS-per-frame envelope; enables the rising-energy gate when provided. */
    rms?: ArrayLike<number>;
    /**
     * Minimum ratio rms[peak] / rms[peak − RISE_WINDOW] for a novelty peak to
     * count as an onset. 1 = must be rising; > 1 requires a sharper attack;
     * ≤ 0 or absent disables the gate.
     */
    minRiseRatio?: number;
    /**
     * RMS floor applied here (not only downstream) when provided, so
     * sub-floor novelty peaks in lead-in/room noise never become onsets nor
     * consume the refractory window or first-onset exemption. Requires `rms`.
     */
    rmsFloor?: number;
  },
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
  const rms = options.rms;
  const minRiseRatio = options.minRiseRatio ?? 0;
  const rmsFloor = options.rmsFloor ?? 0;
  const riseFrames = Math.max(1, Math.round(RISE_WINDOW / frameDuration));
  const onsets: OnsetFrame[] = [];
  let lastOnset = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < frameCount; i += 1) {
    const value = novelty[i] ?? 0;
    // Sub-floor room/lead-in noise must not become a candidate at all: a
    // spurious floor peak would otherwise claim the first-onset exemption and
    // start the refractory clock, suppressing the real attack that follows.
    if (rmsFloor > 0 && rms && (rms[i] ?? 0) < rmsFloor) continue;
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
    if (value < localMean + delta || value <= 0 || i - lastOnset < refractoryFrames) continue;
    // Rising-energy gate: reject a novelty peak whose RMS envelope is not
    // rising into it (a fluctuation on a decaying sustain), keeping genuine
    // re-attacks. The first onset (lastOnset === −∞) is always eligible.
    // Compare the mean RMS over the window ending at the peak against the mean
    // over the preceding window, so frame-to-frame noise does not decide.
    if (minRiseRatio > 0 && rms && Number.isFinite(lastOnset)) {
      let nowSum = 0;
      let nowCount = 0;
      for (let j = Math.max(0, i - riseFrames + 1); j <= i; j += 1) {
        nowSum += rms[j] ?? 0;
        nowCount += 1;
      }
      let pastSum = 0;
      let pastCount = 0;
      for (let j = Math.max(0, i - 2 * riseFrames + 1); j <= Math.max(0, i - riseFrames); j += 1) {
        pastSum += rms[j] ?? 0;
        pastCount += 1;
      }
      const nowAvg = nowCount > 0 ? nowSum / nowCount : 0;
      const pastAvg = pastCount > 0 ? pastSum / pastCount : 0;
      if (nowAvg < minRiseRatio * pastAvg) continue;
    }
    onsets.push({ frame: i, strength: value });
    lastOnset = i;
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

// ─── Phase 01 detection-uplift (ADR 0034): onset-segment features ───────────
// Band edges align with the retained lane semantics: the low band is the
// spectral-flux kick band (< 160 Hz), and the two prototype centroid cutoffs
// (1300 / 4600 Hz) split the rest, so each ratio reads as "energy on this
// side of a boundary the lanes were already tuned against".
const BAND_LOW_HZ = 160;
const BAND_LOW_MID_HZ = 1_300;
const BAND_MID_HZ = 4_600;
const DECAY_DROP_DB = 20;
const DECAY_SCAN_SECONDS = 0.25;
/** Envelope RMS window in seconds so decay resolution is sample-rate free. */
const DECAY_WINDOW_SECONDS = 0.003;
const ATTACK_WINDOW_SECONDS = 0.01;

export interface OnsetBandRatios {
  /** > 4600 Hz. */
  high: number;
  /** < 160 Hz. */
  low: number;
  /** 160–1300 Hz. */
  lowMid: number;
  /** 1300–4600 Hz. */
  mid: number;
}

export interface OnsetSegmentFeatures {
  /**
   * Post-attack energy against its immediate pre-attack context, in (0, 1]:
   * ~1 for a hit rising out of silence, ~0.5 inside a sustained sound.
   */
  attackSharpness: number;
  /** Linear-power spectral energy fractions over the four lane bands. */
  bandRatios: OnsetBandRatios;
  /** Byte-dB-scaled centroid (Hz), identical to the prototype measurement. */
  centroid: number;
  /** Seconds for the post-peak envelope to fall 20 dB (clamped to the scan). */
  decaySeconds: number;
  /** Spectral flatness (geometric / arithmetic mean of linear power), 0–1. */
  flatness: number;
  /** RMS from the attack peak onward (same value detectOnsets reports). */
  peak: number;
  peakSample: number;
  /** Zero-crossing rate from the attack peak, identical to the prototype. */
  zcr: number;
}

/**
 * Deterministic feature vector over a recorded onset segment. Extends the
 * prototype's centroid/ZCR pair with linear-power band ratios, spectral
 * flatness, decay time, and attack sharpness measured from the PCM itself.
 *
 * Window scope: band ratios and flatness describe the same fixed
 * `FEATURE_FFT` attack window the prototype measurement uses (~46 ms at
 * 44.1 kHz, peak near its start); decay scans a separate 250 ms envelope.
 * At the extreme first/last window of a buffer the frame is clamped exactly
 * as the prototype measurement clamps (real captures have countdown lead-in
 * and trailing room, so onsets never live there in practice).
 */
export function measureOnsetSegmentFeatures(
  samples: ArrayLike<number>,
  onsetSample: number,
  sampleRate: number,
): OnsetSegmentFeatures {
  const base = measureOnsetFeatures(samples, onsetSample, sampleRate);
  const { peakSample } = base;

  // Linear power spectrum over the same 2048-sample window the prototype
  // measurement uses, so band ratios and flatness describe the same segment.
  const windowStart = Math.max(0, Math.min(peakSample - 256, samples.length - FEATURE_FFT));
  const window = hannWindow(FEATURE_FFT);
  const real = new Float64Array(FEATURE_FFT);
  const imag = new Float64Array(FEATURE_FFT);
  for (let i = 0; i < FEATURE_FFT; i += 1) {
    real[i] = (samples[windowStart + i] ?? 0) * (window[i] ?? 0);
    imag[i] = 0;
  }
  fftInPlace(real, imag);
  const bins = FEATURE_FFT / 2;
  const binHz = sampleRate / FEATURE_FFT;
  let lowPower = 0;
  let lowMidPower = 0;
  let midPower = 0;
  let highPower = 0;
  let logSum = 0;
  let linearSum = 0;
  const EPSILON = 1e-12;
  for (let bin = 1; bin < bins; bin += 1) {
    const power = (real[bin] ?? 0) ** 2 + (imag[bin] ?? 0) ** 2;
    const hz = bin * binHz;
    if (hz < BAND_LOW_HZ) lowPower += power;
    else if (hz < BAND_LOW_MID_HZ) lowMidPower += power;
    else if (hz < BAND_MID_HZ) midPower += power;
    else highPower += power;
    logSum += Math.log(power + EPSILON);
    linearSum += power + EPSILON;
  }
  const totalPower = lowPower + lowMidPower + midPower + highPower;
  const safeTotal = totalPower > 0 ? totalPower : 1;
  const count = bins - 1;
  // Below the epsilon floor the geometric/arithmetic ratio drifts toward 1
  // (silence would read "perfectly noise-like"); report 0 instead. Segments
  // this quiet never reach classification — detectOnsets gates on rmsFloor.
  const flatness =
    totalPower > EPSILON * count ? Math.exp(logSum / count) / (linearSum / count) : 0;

  // Decay: short-window RMS envelope from the peak until it falls 20 dB
  // below its maximum (or the scan window ends).
  const scanEnd = Math.min(samples.length, peakSample + Math.round(DECAY_SCAN_SECONDS * sampleRate));
  const decayWindow = Math.max(16, Math.round(DECAY_WINDOW_SECONDS * sampleRate));
  let envelopePeak = 0;
  let decaySample = scanEnd;
  const hop = Math.max(1, Math.floor(decayWindow / 2));
  const dropRatio = 10 ** (-DECAY_DROP_DB / 20);
  for (let start = peakSample; start + decayWindow <= scanEnd; start += hop) {
    let squares = 0;
    for (let i = 0; i < decayWindow; i += 1) {
      const value = samples[start + i] ?? 0;
      squares += value * value;
    }
    const rms = Math.sqrt(squares / decayWindow);
    if (rms > envelopePeak) envelopePeak = rms;
    else if (envelopePeak > 0 && rms <= envelopePeak * dropRatio) {
      decaySample = start;
      break;
    }
  }
  const decaySeconds = Math.max(0, (decaySample - peakSample) / sampleRate);

  // Attack sharpness: 10 ms RMS after the peak vs. the 10 ms of context
  // ending 10 ms before the peak. The skipped 10 ms is deliberate — it holds
  // the ambiguous rise itself, which belongs to neither "before" nor
  // "after". Rising out of silence → ~1; inside sustained sound → ~0.5.
  // An empty pre-window (onset at the very buffer start) reads as maximally
  // sharp, the correct bias for a hit with no prior context.
  const attackSamples = Math.max(1, Math.round(ATTACK_WINDOW_SECONDS * sampleRate));
  let preSquares = 0;
  let preCount = 0;
  for (let i = Math.max(0, peakSample - 2 * attackSamples); i < Math.max(0, peakSample - attackSamples); i += 1) {
    const value = samples[i] ?? 0;
    preSquares += value * value;
    preCount += 1;
  }
  let postSquares = 0;
  let postCount = 0;
  for (let i = peakSample; i < Math.min(samples.length, peakSample + attackSamples); i += 1) {
    const value = samples[i] ?? 0;
    postSquares += value * value;
    postCount += 1;
  }
  const preRms = preCount > 0 ? Math.sqrt(preSquares / preCount) : 0;
  const postRms = postCount > 0 ? Math.sqrt(postSquares / postCount) : 0;
  const attackSharpness = postRms + preRms > 0 ? postRms / (postRms + preRms) : 0;

  return {
    attackSharpness,
    bandRatios: {
      high: highPower / safeTotal,
      low: lowPower / safeTotal,
      lowMid: lowMidPower / safeTotal,
      mid: midPower / safeTotal,
    },
    centroid: base.centroid,
    decaySeconds,
    flatness,
    peak: base.peak,
    peakSample,
    zcr: base.zcr,
  };
}

/**
 * beatbox-lab_7.html emitOnset() lane rule. Kept exported as the tested
 * comparison baseline for ADR 0034; `detectOnsets` no longer uses it.
 */
export function classifyLane(
  features: { centroid: number; zcr: number },
  bassCutoffHz: number = DEFAULT_BASS_CUTOFF,
  highCutoffHz: number = DEFAULT_HIGH_CUTOFF,
): CaptureLane {
  if (features.centroid < bassCutoffHz && features.zcr < 0.15) return 'pulse';
  if (features.centroid > highCutoffHz || features.zcr > 0.35) return 'air';
  return 'click';
}

// ADR 0034 lane scores, hand-calibrated on the deterministic beatbox corpus
// (onset-classification.test.ts). Linear-power band ratios are velocity-
// invariant, unlike the byte-dB centroid the prototype rule reads, which
// moves by more than 3× between soft and loud renderings of the same sound.
// The mid-band penalty in the air score separates a broadband clap (mid-heavy
// → click) from a sibilant hat (almost pure high band → air).
const PULSE_LOW_WEIGHT = 2.2;
const PULSE_TOP_PENALTY = 0.6;
const CLICK_LOW_MID_WEIGHT = 1.6;
const CLICK_MID_WEIGHT = 2.0;
const AIR_HIGH_WEIGHT = 1.8;
const AIR_MID_PENALTY = 1.5;
const AIR_ZCR_WEIGHT = 0.5;

/**
 * ADR 0034 segment-feature lane classifier. Deterministic weighted scores
 * over the band-ratio/ZCR features; ties resolve toward `click`, the
 * prototype's own fallback lane.
 */
export function classifySegmentLane(features: OnsetSegmentFeatures): CaptureLane {
  const { bandRatios, zcr } = features;
  const pulseScore =
    PULSE_LOW_WEIGHT * bandRatios.low - PULSE_TOP_PENALTY * (bandRatios.mid + bandRatios.high);
  const clickScore = CLICK_LOW_MID_WEIGHT * bandRatios.lowMid + CLICK_MID_WEIGHT * bandRatios.mid;
  const airScore =
    AIR_HIGH_WEIGHT * bandRatios.high -
    AIR_MID_PENALTY * bandRatios.mid +
    AIR_ZCR_WEIGHT * Math.min(1, zcr);
  if (airScore > clickScore && airScore > pulseScore) return 'air';
  if (pulseScore > clickScore) return 'pulse';
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
  const refractorySeconds = options.refractorySeconds ?? DEFAULT_REFRACTORY;
  const peakDelta = options.peakDelta ?? DEFAULT_PEAK_DELTA;
  const rmsFloor = options.rmsFloor ?? DEFAULT_RMS_FLOOR;
  const minRiseRatio = options.minRiseRatio ?? DEFAULT_MIN_RISE_RATIO;
  if (sampleRate <= 0 || samples.length < fftSize * 2) return [];

  const { novelty, rms } = spectralFlux(samples, fftSize, hopSize, sampleRate);
  const frameDuration = hopSize / sampleRate;
  const frames = pickOnsetFrames(novelty, frameDuration, {
    peakDelta,
    refractorySeconds,
    rms,
    minRiseRatio,
    rmsFloor,
  });
  const onsets: CaptureOnset[] = [];
  for (const { frame } of frames) {
    if ((rms[frame] ?? 0) < rmsFloor) continue;
    // The flux frame begins up to a window before the transient; the features
    // pass locates the true attack peak and returns it as the onset time.
    const onsetSample = frame * hopSize;
    const features = measureOnsetSegmentFeatures(samples, onsetSample, sampleRate);
    if (features.peak < rmsFloor) continue;
    onsets.push({
      // ADR 0034: segment-feature classification. The prototype cutoff rule
      // stays available as `classifyLane` (and via the bassCutoffHz /
      // highCutoffHz options, which only that rule reads).
      lane: classifySegmentLane(features),
      peak: features.peak,
      time: features.peakSample / sampleRate,
    });
  }
  return onsets;
}
