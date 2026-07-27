// SPDX-License-Identifier: AGPL-3.0-only
// Browser microphone adapter for the pure beatbox-lab rhythm analysis.
import {
  analyzeRhythmCapture,
  type CaptureLane,
  type CaptureOnset,
  type RhythmCaptureAnalysis,
} from '@/packages/music-core/src/rhythm-capture';

export type RhythmCapturePhase = 'permission' | 'calibrating' | 'countdown' | 'recording';

export interface RhythmCaptureProgress {
  phase: RhythmCapturePhase;
  progress: number;
  secondsLeft: number;
}

export interface CaptureRhythmOptions {
  captureSeconds?: number;
  onHit?: (lane: CaptureLane) => void;
  onLevel?: (level: number, threshold: number) => void;
  onProgress?: (progress: RhythmCaptureProgress) => void;
  signal?: AbortSignal;
}

const FFT_SIZE = 2048;
const BUFFER_SIZE = 512;
const ENV_RELEASE = 0.7;
const FLOOR_FACTOR = 4;
const PEAK_MARGIN = 1.25;
const RELEASE_RATIO = 0.6;

function aborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Capture cancelled', 'AbortError');
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Capture cancelled', 'AbortError'));
      },
      { once: true },
    );
  });
}

export async function captureRhythm(
  options: CaptureRhythmOptions = {},
): Promise<RhythmCaptureAnalysis> {
  aborted(options.signal);
  if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
    throw new Error('MICROPHONE_UNAVAILABLE');
  }
  if (!window.isSecureContext) {
    throw new Error('HTTPS_REQUIRED');
  }
  options.onProgress?.({ phase: 'permission', progress: 0, secondsLeft: 0 });
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { autoGainControl: false, echoCancellation: false, noiseSuppression: false },
  });
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0;
  const processor = context.createScriptProcessor(BUFFER_SIZE, 1, 1);
  const silent = context.createGain();
  silent.gain.value = 0;
  source.connect(analyser);
  source.connect(processor);
  processor.connect(silent);
  silent.connect(context.destination);

  const frequency = new Uint8Array(analyser.frequencyBinCount);
  const waveform = new Float32Array(FFT_SIZE);
  const ambient: number[] = [];
  const onsets: CaptureOnset[] = [];
  let envelope = 0;
  let previousEnvelope = 0;
  let noiseFloor = 0.004;
  let noiseDeviation = 0.0008;
  let threshold = 0.015;
  let captureStart = Number.POSITIVE_INFINITY;
  let captureEnd = Number.NEGATIVE_INFINITY;
  let state: 'idle' | 'rising' | 'refractory' = 'idle';
  let peak = 0;
  let valley = Number.POSITIVE_INFINITY;
  let attackTime = 0;
  let lastEmit = Number.NEGATIVE_INFINITY;
  let fallingFrames = 0;
  let peakFeatures = { centroid: 0, zcr: 0 };

  const features = (): { centroid: number; zcr: number } => {
    analyser.getByteFrequencyData(frequency);
    analyser.getFloatTimeDomainData(waveform);
    const binHz = context.sampleRate / FFT_SIZE;
    let numerator = 0;
    let denominator = 0;
    for (let index = 1; index < frequency.length; index += 1) {
      const magnitude = frequency[index] ?? 0;
      numerator += magnitude * index * binHz;
      denominator += magnitude;
    }
    let crossings = 0;
    for (let index = 1; index < waveform.length; index += 1) {
      if ((waveform[index - 1] ?? 0) < 0 !== (waveform[index] ?? 0) < 0) crossings += 1;
    }
    return {
      centroid: denominator > 0 ? numerator / denominator : 0,
      zcr: crossings / waveform.length,
    };
  };

  processor.onaudioprocess = (event): void => {
    const buffer = event.inputBuffer.getChannelData(0);
    let squares = 0;
    for (const sample of buffer) squares += sample * sample;
    const rms = Math.sqrt(squares / buffer.length);
    const time = context.currentTime;
    envelope = rms > envelope ? rms : ENV_RELEASE * envelope + (1 - ENV_RELEASE) * rms;
    if (captureStart === Number.POSITIVE_INFINITY) ambient.push(rms);
    if (envelope < noiseFloor) noiseFloor = 0.9 * noiseFloor + 0.1 * envelope;
    else noiseFloor *= 1.0006;
    if (envelope < noiseFloor * 2.2) {
      noiseDeviation = 0.99 * noiseDeviation + 0.01 * Math.abs(envelope - noiseFloor);
    }
    const effectiveThreshold = Math.max(threshold, noiseFloor + FLOOR_FACTOR * noiseDeviation);
    options.onLevel?.(envelope, effectiveThreshold);

    if (time >= captureStart && time < captureEnd) {
      if (state === 'idle') {
        valley = Math.min(valley, envelope);
        if (envelope > effectiveThreshold && envelope > previousEnvelope) {
          state = 'rising';
          attackTime = time;
          peak = envelope;
          fallingFrames = 0;
          peakFeatures = features();
        }
      } else if (state === 'rising') {
        if (envelope >= peak) {
          peak = envelope;
          fallingFrames = 0;
          peakFeatures = features();
        } else if (envelope < peak * 0.7) {
          fallingFrames += 1;
        } else {
          fallingFrames = 0;
        }
        if (fallingFrames >= 2 || time - attackTime > 0.25) {
          const prominence = peak - (valley === Number.POSITIVE_INFINITY ? noiseFloor : valley);
          if (
            peak >= effectiveThreshold * PEAK_MARGIN &&
            prominence >= 3 * noiseDeviation &&
            attackTime - lastEmit > 0.09
          ) {
            const lane: CaptureLane =
              peakFeatures.centroid < 1300 && peakFeatures.zcr < 0.15
                ? 'pulse'
                : peakFeatures.centroid > 4600 || peakFeatures.zcr > 0.35
                  ? 'air'
                  : 'click';
            onsets.push({ lane, peak, time: attackTime });
            options.onHit?.(lane);
            lastEmit = attackTime;
            state = 'refractory';
          } else {
            state = 'idle';
            valley = peak;
          }
        }
      } else if (
        envelope < effectiveThreshold * RELEASE_RATIO ||
        envelope < peak * 0.35 ||
        time - attackTime > 0.4
      ) {
        state = 'idle';
        valley = envelope;
      }
    }
    previousEnvelope = envelope;
  };

  try {
    await context.resume();
    options.onProgress?.({ phase: 'calibrating', progress: 0, secondsLeft: 2 });
    await wait(2000, options.signal);
    const mean = ambient.reduce((sum, value) => sum + value, 0) / Math.max(1, ambient.length);
    const deviation =
      Math.sqrt(
        ambient.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, ambient.length),
      ) || 0.001;
    threshold = Math.max(mean + 5 * deviation, 0.006);

    for (let remaining = 3; remaining > 0; remaining -= 1) {
      options.onProgress?.({
        phase: 'countdown',
        progress: (3 - remaining) / 3,
        secondsLeft: remaining,
      });
      await wait(1000, options.signal);
    }

    const captureSeconds = options.captureSeconds ?? 10;
    captureStart = context.currentTime;
    captureEnd = captureStart + captureSeconds;
    const startedAt = performance.now();
    while (context.currentTime < captureEnd) {
      aborted(options.signal);
      const elapsed = (performance.now() - startedAt) / 1000;
      options.onProgress?.({
        phase: 'recording',
        progress: Math.min(1, elapsed / captureSeconds),
        secondsLeft: Math.max(0, captureSeconds - elapsed),
      });
      await wait(100, options.signal);
    }
    const analysis = analyzeRhythmCapture(
      onsets,
      captureStart,
      captureSeconds,
      BUFFER_SIZE / context.sampleRate,
    );
    if (!analysis) throw new Error('TOO_FEW_HITS');
    return analysis;
  } finally {
    processor.disconnect();
    source.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    await context.close();
  }
}
