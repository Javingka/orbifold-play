// SPDX-License-Identifier: AGPL-3.0-only
// Native stub for the sensitivity preference (ADR 0035). Rhythm capture is a
// web-app feature today; native keeps an in-memory value only.
import { DEFAULT_SENSITIVITY } from '@/packages/music-core/src/onset-detection';

let current = DEFAULT_SENSITIVITY;

export function loadSensitivity(): number {
  return current;
}

export function saveSensitivity(value: number): void {
  current = Math.max(0, Math.min(1, value));
}
