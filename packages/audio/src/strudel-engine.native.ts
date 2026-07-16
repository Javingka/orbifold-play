// SPDX-License-Identifier: AGPL-3.0-only
export interface PlaybackResult {
  ok: boolean;
  error?: string;
}

export function prepareStrudelAudio(): void {}

export async function playStrudel(_code: string, _bpm: number): Promise<PlaybackResult> {
  return { ok: false, error: 'Native audio adapter is not implemented yet' };
}

export function stopStrudel(): void {}

export function strudelIsPlaying(): boolean {
  return false;
}
