// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Expo's official with-skia example.
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { use, useEffect, type ReactNode } from 'react';

let skiaPromise: Promise<void> | null = null;

function loadSkia(): Promise<void> {
  skiaPromise ??= LoadSkiaWeb();
  return skiaPromise;
}

export function AsyncSkia() {
  use(loadSkia());
  return null;
}

export function SkiaReady({ children }: { children: ReactNode }) {
  use(loadSkia());
  useEffect(() => {
    document.getElementById('orbifold-boot')?.remove();
  }, []);
  return children;
}
