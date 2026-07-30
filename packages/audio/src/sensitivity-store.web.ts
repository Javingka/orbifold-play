// SPDX-License-Identifier: AGPL-3.0-only
// Device-local persistence of the rhythm-detection sensitivity (ADR 0035).
// This is a single scalar preference — deliberately NOT the musical-content
// persistence the product brief defers. Web uses localStorage, guarded so a
// missing/blocked store degrades to the default rather than throwing.
import { DEFAULT_SENSITIVITY } from '@/packages/music-core/src/onset-detection';

const STORAGE_KEY = 'orbifold-play:rhythm-sensitivity';

export function loadSensitivity(): number {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_SENSITIVITY;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_SENSITIVITY;
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) return DEFAULT_SENSITIVITY;
    return Math.max(0, Math.min(1, value));
  } catch {
    return DEFAULT_SENSITIVITY;
  }
}

export function saveSensitivity(value: number): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, String(Math.max(0, Math.min(1, value))));
  } catch {
    // Persistence is best-effort; ignore quota/security errors.
  }
}
