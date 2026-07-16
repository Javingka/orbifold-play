// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Expo's official with-skia example.
const fs = require('fs');
const path = require('path');

const publicFolder = path.join(process.cwd(), 'public');
fs.mkdirSync(publicFolder, { recursive: true });

const wasmSrc = require.resolve('canvaskit-wasm/bin/full/canvaskit.wasm', {
  paths: [require.resolve('@shopify/react-native-skia')],
});
const wasmDest = path.join(publicFolder, 'canvaskit.wasm');
fs.copyFileSync(wasmSrc, wasmDest);
