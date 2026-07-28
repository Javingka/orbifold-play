// SPDX-License-Identifier: AGPL-3.0-only
// Browser microphone adapter for the pure monophonic harmony-capture engine.
import {
  analyzeHarmonyCapture,
  estimateYinPitch,
  extractHarmonyPitchFrames,
  segmentPitchFrames,
  type HarmonyCaptureAnalysis,
} from '@/packages/music-core/src/harmony-capture';

export type HarmonyCapturePhase =
  | 'permission'
  | 'calibrating'
  | 'countdown'
  | 'recording'
  | 'analyzing';

export interface HarmonyCaptureProgress {
  phase: HarmonyCapturePhase;
  progress: number;
  secondsLeft: number;
}

export interface CaptureHarmonyOptions {
  captureSeconds?: number;
  onLevel?: (level: number, threshold: number) => void;
  onPitch?: (midi: number | null, confidence: number) => void;
  onProgress?: (progress: HarmonyCaptureProgress) => void;
  signal?: AbortSignal;
}

const BUFFER_SIZE = 512;
const TAIL_SIZE = 4096;

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

function rmsOf(samples: Float32Array): number {
  let squares = 0;
  for (const sample of samples) squares += sample * sample;
  return Math.sqrt(squares / Math.max(1, samples.length));
}

export async function captureHarmony(
  options: CaptureHarmonyOptions = {},
): Promise<HarmonyCaptureAnalysis> {
  aborted(options.signal);
  if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
    throw new Error('MICROPHONE_UNAVAILABLE');
  }
  if (!window.isSecureContext) throw new Error('HTTPS_REQUIRED');

  options.onProgress?.({ phase: 'permission', progress: 0, secondsLeft: 0 });
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { autoGainControl: false, echoCancellation: false, noiseSuppression: false },
  });
  let context: AudioContext;
  try {
    context = new AudioContext();
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }
  let source: MediaStreamAudioSourceNode;
  let processor: ScriptProcessorNode;
  let silent: GainNode;
  try {
    source = context.createMediaStreamSource(stream);
    processor = context.createScriptProcessor(BUFFER_SIZE, 1, 1);
    silent = context.createGain();
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    await context.close();
    throw error;
  }
  silent.gain.value = 0;
  source.connect(processor);
  processor.connect(silent);
  silent.connect(context.destination);

  const ambient: number[] = [];
  const recordedChunks: Float32Array[] = [];
  const tail = new Float32Array(TAIL_SIZE);
  let threshold = 0.014;
  let captureStart = Number.POSITIVE_INFINITY;
  let captureEnd = Number.NEGATIVE_INFINITY;
  let callbackCount = 0;

  processor.onaudioprocess = (event): void => {
    const input = event.inputBuffer.getChannelData(0);
    const rms = rmsOf(input);
    if (captureStart === Number.POSITIVE_INFINITY) ambient.push(rms);
    options.onLevel?.(rms, threshold);
    tail.copyWithin(0, input.length);
    tail.set(input, tail.length - input.length);

    const now = context.currentTime;
    if (now >= captureStart && now < captureEnd) {
      recordedChunks.push(new Float32Array(input));
    }
    if (now < captureStart || now >= captureEnd || callbackCount++ % 4 !== 0) return;
    const pitch = rms >= threshold * 0.85
      ? estimateYinPitch(tail, context.sampleRate, 80, 2_400, 0.18)
      : null;
    options.onPitch?.(
      pitch ? Math.round(pitch.midi) : null,
      pitch ? Math.max(0, 1 - pitch.aperiodicity) : 0,
    );
  };

  try {
    await context.resume();
    options.onProgress?.({ phase: 'calibrating', progress: 0, secondsLeft: 2 });
    await wait(2_000, options.signal);
    const mean = ambient.reduce((sum, value) => sum + value, 0) / Math.max(1, ambient.length);
    const deviation =
      Math.sqrt(
        ambient.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
          Math.max(1, ambient.length),
      ) || 0.001;
    threshold = Math.max(mean + 5 * deviation, 0.005);

    for (let remaining = 3; remaining > 0; remaining -= 1) {
      options.onProgress?.({
        phase: 'countdown',
        progress: (3 - remaining) / 3,
        secondsLeft: remaining,
      });
      await wait(1_000, options.signal);
    }

    const captureSeconds = options.captureSeconds ?? 12;
    captureStart = context.currentTime;
    captureEnd = captureStart + captureSeconds;
    const startedAt = performance.now();
    while (context.currentTime < captureEnd) {
      aborted(options.signal);
      const elapsed = (performance.now() - startedAt) / 1_000;
      options.onProgress?.({
        phase: 'recording',
        progress: Math.min(1, elapsed / captureSeconds),
        secondsLeft: Math.max(0, captureSeconds - elapsed),
      });
      await wait(100, options.signal);
    }

    options.onProgress?.({ phase: 'analyzing', progress: 1, secondsLeft: 0 });
    const sampleCount = recordedChunks.reduce(
      (sum, chunk) => sum + chunk.length,
      0,
    );
    const samples = new Float32Array(sampleCount);
    let sampleOffset = 0;
    for (const chunk of recordedChunks) {
      samples.set(chunk, sampleOffset);
      sampleOffset += chunk.length;
    }
    const frames = extractHarmonyPitchFrames(samples, context.sampleRate, {
      maximumHz: 2_400,
      minimumHz: 80,
      threshold,
    });
    const notes = segmentPitchFrames(frames, { threshold });
    if (notes.length < 3) throw new Error('TOO_FEW_NOTES');
    const analysis = analyzeHarmonyCapture(notes, { frames });
    if (!analysis || analysis.entries.length === 0) throw new Error('ANALYSIS_FAILED');
    return analysis;
  } finally {
    processor.onaudioprocess = null;
    processor.disconnect();
    source.disconnect();
    silent.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    await context.close();
  }
}
