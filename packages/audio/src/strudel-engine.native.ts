// SPDX-License-Identifier: AGPL-3.0-only
import type { RhythmOrbitRole, RhythmSoundId } from '@/packages/music-core/src/rhythm-sounds';

export interface PlaybackResult {
  ok: boolean;
  error?: string;
}

export function prepareStrudelAudio(): void {}

export async function playStrudel(_code: string, _bpm: number): Promise<PlaybackResult> {
  return { ok: false, error: 'Native audio adapter is not implemented yet' };
}

export async function previewRhythmSound(
  _soundId: RhythmSoundId,
  _role: RhythmOrbitRole,
): Promise<PlaybackResult> {
  return { ok: false, error: 'Native audio adapter is not implemented yet' };
}

export function stopStrudel(): void {}

export function strudelIsPlaying(): boolean {
  return false;
}

export function getStrudelCycle(): number | null {
  return null;
}

export function getStrudelPhase(): number | null {
  return null;
}
