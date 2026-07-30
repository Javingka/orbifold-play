// SPDX-License-Identifier: AGPL-3.0-only
import type { CaptureRhythmOptions } from './rhythm-capture.web';
import type { RhythmCaptureAnalysis } from '@/packages/music-core/src/rhythm-capture';

export type {
  CapturedRhythmBuffer,
  CaptureRhythmOptions,
  RhythmCapturePhase,
  RhythmCaptureProgress,
} from './rhythm-capture.web';

export async function captureRhythm(
  _options: CaptureRhythmOptions = {},
): Promise<RhythmCaptureAnalysis> {
  throw new Error('Rhythm capture is currently available in the mobile web app.');
}
