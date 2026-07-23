// SPDX-License-Identifier: AGPL-3.0-only
import type { FiniteTonnetzFace } from './finite-tonnetz';
import type { HarmonyDuration } from './harmony-duration';

export interface HarmonySequenceEntry {
  duration: HarmonyDuration;
  face: FiniteTonnetzFace;
  muted: boolean;
}

export function createHarmonySequenceEntry(face: FiniteTonnetzFace): HarmonySequenceEntry {
  return { duration: 1, face, muted: false };
}
