// SPDX-License-Identifier: AGPL-3.0-only
// Browser microphone adapter for the pure monophonic harmony-capture engine.
// ADR 0031: recording runs through an AudioWorklet (audio-thread callbacks
// that UI work cannot starve) with the Phase 01 ScriptProcessor path as a
// fallback, and analysis routes through the pYIN Viterbi pipeline.
import {
  analyzeHarmonyCapture,
  estimateYinPitch,
  extractPyinCapture,
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

const SCRIPT_BUFFER_SIZE = 512;
const WORKLET_CHUNK_SIZE = 1_024;
const TAIL_SIZE = 4_096;
/** Seconds of live level/pitch feedback between preview estimations. */
const PITCH_PREVIEW_INTERVAL = 0.12;

const WORKLET_PROCESSOR_NAME = 'harmony-capture-recorder';
const WORKLET_SOURCE = `
class HarmonyCaptureRecorder extends AudioWorkletProcessor {
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
registerProcessor('${WORKLET_PROCESSOR_NAME}', HarmonyCaptureRecorder);
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
  const moduleUrl = URL.createObjectURL(
    new Blob([WORKLET_SOURCE], { type: 'application/javascript' }),
  );
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
  const tail = new Float32Array(TAIL_SIZE);
  let threshold = 0.014;
  let lastPreviewAt = 0;

  const onChunk = (chunk: Float32Array): void => {
    const rms = rmsOf(chunk);
    if (mode === 'calibrating') ambient.push(rms);
    if (mode === 'recording') recordedChunks.push(chunk);
    options.onLevel?.(rms, threshold);
    tail.copyWithin(0, chunk.length);
    tail.set(chunk, tail.length - chunk.length);
    const now = context.currentTime;
    if (mode !== 'recording' || now - lastPreviewAt < PITCH_PREVIEW_INTERVAL) return;
    lastPreviewAt = now;
    const pitch = rms >= threshold * 0.85
      ? estimateYinPitch(tail, context.sampleRate, 80, 2_400, 0.18)
      : null;
    options.onPitch?.(
      pitch ? Math.round(pitch.midi) : null,
      pitch ? Math.max(0, 1 - pitch.aperiodicity) : 0,
    );
  };

  let backend: RecorderBackend;
  try {
    backend = (await attachWorklet(context, source, silent, onChunk)) ??
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
    await wait(2_000, options.signal);
    const mean = ambient.reduce((sum, value) => sum + value, 0) / Math.max(1, ambient.length);
    const deviation =
      Math.sqrt(
        ambient.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
          Math.max(1, ambient.length),
      ) || 0.001;
    threshold = Math.max(mean + 5 * deviation, 0.005);
    mode = 'idle';

    for (let remaining = 3; remaining > 0; remaining -= 1) {
      options.onProgress?.({
        phase: 'countdown',
        progress: (3 - remaining) / 3,
        secondsLeft: remaining,
      });
      await wait(1_000, options.signal);
    }

    const captureSeconds = options.captureSeconds ?? 12;
    mode = 'recording';
    const startedAt = performance.now();
    let elapsed = 0;
    while (elapsed < captureSeconds) {
      aborted(options.signal);
      elapsed = (performance.now() - startedAt) / 1_000;
      options.onProgress?.({
        phase: 'recording',
        progress: Math.min(1, elapsed / captureSeconds),
        secondsLeft: Math.max(0, captureSeconds - elapsed),
      });
      await wait(100, options.signal);
    }
    mode = 'idle';

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
    // The pure engine high-passes the signal, so the ambient-derived gate is
    // scaled down slightly; rumble that raised the ambient floor is filtered
    // out before the engine measures frame RMS.
    const { frames, notes } = extractPyinCapture(samples, context.sampleRate, {
      rmsThreshold: Math.max(0.006, threshold * 0.75),
    });
    if (notes.length < 3) throw new Error('TOO_FEW_NOTES');
    const analysis = analyzeHarmonyCapture(notes, { frames });
    if (!analysis || analysis.entries.length === 0) throw new Error('ANALYSIS_FAILED');
    return analysis;
  } finally {
    backend.detach();
    source.disconnect();
    silent.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    await context.close();
  }
}
