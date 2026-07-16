// SPDX-License-Identifier: AGPL-3.0-only
// Browser-only Strudel adapter. Audio unlock is registered at module load but
// the AudioContext is resumed only by the first user click.
import {
  Pattern,
  defaultPrebake,
  evaluate,
  getAudioContext,
  initAudio,
  miniAllStrings,
  webaudioScheduler,
} from '@strudel/web';
import type { Cyclist } from '@strudel/web';

export interface PlaybackResult {
  ok: boolean;
  error?: string;
}

let scheduler: Cyclist | null = null;
let playing = false;

const readyPromise = (async () => {
  miniAllStrings();
  await defaultPrebake();
  scheduler = webaudioScheduler();
  const ownedScheduler = scheduler;
  const patternPrototype = Pattern.prototype as unknown as {
    play(this: unknown): unknown;
  };
  patternPrototype.play = function play(this: unknown) {
    ownedScheduler.setPattern(this as Parameters<Cyclist['setPattern']>[0], true);
    return this;
  };
})();

export function prepareStrudelAudio(): void {
  void readyPromise;
}

export async function playStrudel(code: string, bpm: number): Promise<PlaybackResult> {
  try {
    // resume() must be invoked synchronously from the gesture call stack. Some
    // browsers leave its Promise pending while they finish activating audio, so
    // do not block pattern preparation on that Promise.
    void initAudio({ disableWorklets: true });
    await readyPromise;
    if (!scheduler) return { ok: false, error: 'Audio scheduler unavailable' };
    scheduler.setCps(Math.max(40, Math.min(280, bpm)) / 240);
    await evaluate(code);
    playing = true;
    return { ok: true };
  } catch (error) {
    playing = false;
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function stopStrudel(): void {
  scheduler?.stop();
  playing = false;
}

export function strudelIsPlaying(): boolean {
  return playing;
}

export function getStrudelPhase(): number | null {
  if (!playing || !scheduler?.started) return null;
  try {
    const context = getAudioContext();
    const outputDelaySeconds =
      scheduler.latency + (context.baseLatency || 0) + (context.outputLatency || 0);
    const audibleCycle = scheduler.now() - outputDelaySeconds * scheduler.cps;
    const phase = ((audibleCycle % 1) + 1) % 1;
    return Number.isFinite(phase) ? phase : null;
  } catch {
    return null;
  }
}
