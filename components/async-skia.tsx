// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Expo's official with-skia example.
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { use } from 'react';

let skiaPromise: Promise<void> | null = null;

function loadSkia(): Promise<void> {
  skiaPromise ??= LoadSkiaWeb();
  return skiaPromise;
}

export function AsyncSkia() {
  use(loadSkia());
  return null;
}
