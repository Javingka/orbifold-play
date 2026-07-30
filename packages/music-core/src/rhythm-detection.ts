// SPDX-License-Identifier: AGPL-3.0-only
// Pure glue (ADR 0035) between the offline onset detector and the rhythm
// analyzer, parameterized by one detection-sensitivity scalar. Because ADR
// 0032 already detects onsets offline on the complete recorded buffer, both
// the web adapter and the review UI can re-analyze the SAME recording at a new
// sensitivity by calling `analyzeRhythmBuffer` again — no re-recording.
import {
  DEFAULT_SENSITIVITY,
  detectOnsets,
  detectionSensitivityOptions,
} from './onset-detection';
import { analyzeRhythmCapture, type RhythmCaptureAnalysis } from './rhythm-capture';

export interface RhythmBufferOptions {
  /** Ambient-calibrated RMS floor; used as a lower bound on the sensitivity floor. */
  ambientFloor?: number;
  /** Novelty hop used for tempo-analysis time resolution (defaults to 256/sr). */
  hopSeconds?: number;
  /** Detection sensitivity 0..1 (default 0.5 reproduces the calibrated defaults). */
  sensitivity?: number;
}

function detectionOptions(sampleRate: number, options: RhythmBufferOptions) {
  const sensitivity = options.sensitivity ?? DEFAULT_SENSITIVITY;
  const mapped = detectionSensitivityOptions(sensitivity);
  // The room floor is a hard lower bound: never detect below ambient noise,
  // even at maximum sensitivity.
  const rmsFloor = Math.max(mapped.rmsFloor, options.ambientFloor ?? 0);
  return { ...mapped, rmsFloor };
}

/** Count onsets in a recorded buffer at a sensitivity (for the calibration tap). */
export function countRhythmOnsets(
  samples: ArrayLike<number>,
  sampleRate: number,
  options: RhythmBufferOptions = {},
): number {
  return detectOnsets(samples, sampleRate, detectionOptions(sampleRate, options)).length;
}

export interface RhythmBufferDetail {
  analysis: RhythmCaptureAnalysis | null;
  /** Raw onsets found (before tempo folding); what the UI shows as "N hits". */
  onsetCount: number;
}

/**
 * Detect onsets once and run the unchanged tempo/vote/quantize analysis,
 * returning both the analysis (null when too few onsets) and the raw onset
 * count. A single detection pass — callers that need both the count and the
 * pattern (the live sensitivity slider, initial capture) must not detect twice.
 */
export function analyzeRhythmBufferDetailed(
  samples: ArrayLike<number>,
  sampleRate: number,
  captureSeconds: number,
  options: RhythmBufferOptions = {},
): RhythmBufferDetail {
  const onsets = detectOnsets(samples, sampleRate, detectionOptions(sampleRate, options));
  const hopSeconds = options.hopSeconds ?? 256 / sampleRate;
  return {
    analysis: analyzeRhythmCapture(onsets, 0, captureSeconds, hopSeconds),
    onsetCount: onsets.length,
  };
}

/**
 * Detect onsets in a recorded buffer at the given sensitivity and run the
 * unchanged tempo/vote/quantize analysis. Returns null when too few onsets are
 * found (same as `analyzeRhythmCapture`).
 */
export function analyzeRhythmBuffer(
  samples: ArrayLike<number>,
  sampleRate: number,
  captureSeconds: number,
  options: RhythmBufferOptions = {},
): RhythmCaptureAnalysis | null {
  return analyzeRhythmBufferDetailed(samples, sampleRate, captureSeconds, options).analysis;
}
