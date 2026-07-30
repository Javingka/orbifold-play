// SPDX-License-Identifier: AGPL-3.0-only
// Browser microphone adapter for rhythm capture. ADR 0032: recording runs
// through an AudioWorklet (audio-thread callbacks that UI work cannot starve)
// with the legacy ScriptProcessor path as a fallback, and onsets are detected
// offline from the complete recorded PCM by the pure spectral-flux engine
// instead of a live envelope state machine.
import { type CaptureLane, type RhythmCaptureAnalysis } from '@/packages/music-core/src/rhythm-capture';
import { analyzeRhythmBufferDetailed } from '@/packages/music-core/src/rhythm-detection';

/** Recorded PCM handed back so the UI can re-detect at a new sensitivity. */
export interface CapturedRhythmBuffer {
  ambientFloor: number;
  captureSeconds: number;
  sampleRate: number;
  samples: Float32Array;
}

export type RhythmCapturePhase = 'permission' | 'calibrating' | 'countdown' | 'recording' | 'analyzing';

export interface RhythmCaptureProgress {
  phase: RhythmCapturePhase;
  progress: number;
  secondsLeft: number;
}

export interface CaptureRhythmOptions {
  captureSeconds?: number;
  /**
   * Recorded PCM + the onset count at the capture sensitivity, so the review
   * UI can show "N hits" and re-detect without re-recording or re-detecting.
   */
  onCaptured?: (buffer: CapturedRhythmBuffer, onsetCount: number) => void;
  onHit?: (lane: CaptureLane) => void;
  onLevel?: (level: number, threshold: number) => void;
  onProgress?: (progress: RhythmCaptureProgress) => void;
  /** Detection sensitivity 0..1 (default 0.5); higher admits more onsets. */
  sensitivity?: number;
  signal?: AbortSignal;
}

const SCRIPT_BUFFER_SIZE = 512;
const WORKLET_CHUNK_SIZE = 1_024;
const ENV_RELEASE = 0.7;
const FLOOR_FACTOR = 4;
/** Live envelope re-arm threshold for the recording flash (feedback only). */
const HIT_RELEASE_RATIO = 0.6;

const WORKLET_PROCESSOR_NAME = 'rhythm-capture-recorder';
const WORKLET_SOURCE = `
class RhythmCaptureRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(${WORKLET_CHUNK_SIZE});
    this.offset = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    let index = 0;
    while (index < channel.length) {
      const take = Math.min(this.buffer.length - this.offset, channel.length - index);
      this.buffer.set(channel.subarray(index, index + take), this.offset);
      this.offset += take;
      index += take;
      if (this.offset === this.buffer.length) {
        this.port.postMessage(this.buffer, [this.buffer.buffer]);
        this.buffer = new Float32Array(${WORKLET_CHUNK_SIZE});
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('${WORKLET_PROCESSOR_NAME}', RhythmCaptureRecorder);
`;

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

interface RecorderBackend {
  detach: () => void;
  kind: 'script-processor' | 'worklet';
}

async function attachWorklet(
  context: AudioContext,
  source: MediaStreamAudioSourceNode,
  silent: GainNode,
  onChunk: (chunk: Float32Array) => void,
): Promise<RecorderBackend | null> {
  if (typeof AudioWorkletNode !== 'function' || !context.audioWorklet) return null;
  const moduleUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
  try {
    await context.audioWorklet.addModule(moduleUrl);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
  const node = new AudioWorkletNode(context, WORKLET_PROCESSOR_NAME, {
    channelCount: 1,
    numberOfInputs: 1,
    numberOfOutputs: 1,
  });
  node.port.onmessage = (event: MessageEvent): void => {
    if (event.data instanceof Float32Array) onChunk(event.data);
  };
  source.connect(node);
  node.connect(silent);
  return {
    detach: (): void => {
      node.port.onmessage = null;
      node.port.close();
      node.disconnect();
    },
    kind: 'worklet',
  };
}

function attachScriptProcessor(
  context: AudioContext,
  source: MediaStreamAudioSourceNode,
  silent: GainNode,
  onChunk: (chunk: Float32Array) => void,
): RecorderBackend {
  const processor = context.createScriptProcessor(SCRIPT_BUFFER_SIZE, 1, 1);
  processor.onaudioprocess = (event): void => {
    onChunk(new Float32Array(event.inputBuffer.getChannelData(0)));
  };
  source.connect(processor);
  processor.connect(silent);
  return {
    detach: (): void => {
      processor.onaudioprocess = null;
      processor.disconnect();
    },
    kind: 'script-processor',
  };
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
  let context: AudioContext;
  try {
    context = new AudioContext();
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }
  let source: MediaStreamAudioSourceNode;
  let silent: GainNode;
  try {
    source = context.createMediaStreamSource(stream);
    silent = context.createGain();
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    await context.close();
    throw error;
  }
  silent.gain.value = 0;
  silent.connect(context.destination);

  type CaptureMode = 'calibrating' | 'idle' | 'recording';
  let mode: CaptureMode = 'calibrating';
  const ambient: number[] = [];
  const recordedChunks: Float32Array[] = [];
  let threshold = 0.015;
  // Live envelope for the recording flash only; the real onsets are found
  // offline. `flashArmed` gates one flash per audible attack.
  let envelope = 0;
  let noiseFloor = 0.004;
  let noiseDeviation = 0.0008;
  let flashArmed = true;

  const onChunk = (chunk: Float32Array): void => {
    const rms = rmsOf(chunk);
    if (mode === 'calibrating') ambient.push(rms);
    if (mode === 'recording') recordedChunks.push(chunk);
    envelope = rms > envelope ? rms : ENV_RELEASE * envelope + (1 - ENV_RELEASE) * rms;
    if (envelope < noiseFloor) noiseFloor = 0.9 * noiseFloor + 0.1 * envelope;
    else noiseFloor *= 1.0006;
    if (envelope < noiseFloor * 2.2) {
      noiseDeviation = 0.99 * noiseDeviation + 0.01 * Math.abs(envelope - noiseFloor);
    }
    const effectiveThreshold = Math.max(threshold, noiseFloor + FLOOR_FACTOR * noiseDeviation);
    options.onLevel?.(envelope, effectiveThreshold);
    if (mode === 'recording') {
      if (flashArmed && envelope > effectiveThreshold) {
        flashArmed = false;
        options.onHit?.('pulse');
      } else if (!flashArmed && envelope < effectiveThreshold * HIT_RELEASE_RATIO) {
        flashArmed = true;
      }
    }
  };

  let backend: RecorderBackend;
  try {
    backend =
      (await attachWorklet(context, source, silent, onChunk)) ??
      attachScriptProcessor(context, source, silent, onChunk);
  } catch (error) {
    silent.disconnect();
    source.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    await context.close();
    throw error;
  }

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
    mode = 'recording';
    const startedAt = performance.now();
    let elapsed = 0;
    while (elapsed < captureSeconds) {
      aborted(options.signal);
      elapsed = (performance.now() - startedAt) / 1000;
      options.onProgress?.({
        phase: 'recording',
        progress: Math.min(1, elapsed / captureSeconds),
        secondsLeft: Math.max(0, captureSeconds - elapsed),
      });
      await wait(100, options.signal);
    }
    mode = 'idle';

    options.onProgress?.({ phase: 'analyzing', progress: 1, secondsLeft: 0 });
    const sampleCount = recordedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const samples = new Float32Array(sampleCount);
    let sampleOffset = 0;
    for (const chunk of recordedChunks) {
      samples.set(chunk, sampleOffset);
      sampleOffset += chunk.length;
    }
    const ambientFloor = Math.max(0.005, threshold * 0.6);
    // One detection pass yields both the pattern and the raw onset count.
    const detail = analyzeRhythmBufferDetailed(samples, context.sampleRate, captureSeconds, {
      ambientFloor,
      ...(options.sensitivity !== undefined ? { sensitivity: options.sensitivity } : {}),
    });
    options.onCaptured?.(
      { ambientFloor, captureSeconds, sampleRate: context.sampleRate, samples },
      detail.onsetCount,
    );
    if (!detail.analysis) throw new Error('TOO_FEW_HITS');
    return detail.analysis;
  } finally {
    backend.detach();
    source.disconnect();
    silent.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    await context.close();
  }
}
