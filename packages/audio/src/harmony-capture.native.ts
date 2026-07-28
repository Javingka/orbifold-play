// SPDX-License-Identifier: AGPL-3.0-only
import type { HarmonyCaptureAnalysis } from '@/packages/music-core/src/harmony-capture';
import type { CaptureHarmonyOptions } from './harmony-capture.web';

export type {
  CaptureHarmonyOptions,
  HarmonyCapturePhase,
  HarmonyCaptureProgress,
} from './harmony-capture.web';

export async function captureHarmony(
  _options: CaptureHarmonyOptions = {},
): Promise<HarmonyCaptureAnalysis> {
  throw new Error('Harmony capture is currently available in the mobile web app.');
}
