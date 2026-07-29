// SPDX-License-Identifier: AGPL-3.0-only
// Shared dependency-free radix-2 FFT, used by the pYIN pitch tracker and the
// spectral-flux onset detector. Extracted verbatim from pyin.ts (no behavior
// change) so both capture engines share one transform.

/** In-place iterative radix-2 complex FFT (inverse when `invert`). */
export function fftInPlace(real: Float64Array, imag: Float64Array, invert = false): void {
  const n = real.length;
  if (n < 2 || (n & (n - 1)) !== 0 || imag.length !== n) {
    throw new Error('fftInPlace requires power-of-two matching arrays');
  }
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; (j & bit) !== 0; bit >>= 1) j ^= bit;
    j |= bit;
    if (i < j) {
      const tr = real[i] ?? 0;
      real[i] = real[j] ?? 0;
      real[j] = tr;
      const ti = imag[i] ?? 0;
      imag[i] = imag[j] ?? 0;
      imag[j] = ti;
    }
  }
  for (let length = 2; length <= n; length <<= 1) {
    const angle = ((invert ? 1 : -1) * 2 * Math.PI) / length;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let start = 0; start < n; start += length) {
      let curRe = 1;
      let curIm = 0;
      const half = length >> 1;
      for (let offset = 0; offset < half; offset += 1) {
        const even = start + offset;
        const odd = even + half;
        const oddRe = (real[odd] ?? 0) * curRe - (imag[odd] ?? 0) * curIm;
        const oddIm = (real[odd] ?? 0) * curIm + (imag[odd] ?? 0) * curRe;
        real[odd] = (real[even] ?? 0) - oddRe;
        imag[odd] = (imag[even] ?? 0) - oddIm;
        real[even] = (real[even] ?? 0) + oddRe;
        imag[even] = (imag[even] ?? 0) + oddIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
  if (invert) {
    for (let i = 0; i < n; i += 1) {
      real[i] = (real[i] ?? 0) / n;
      imag[i] = (imag[i] ?? 0) / n;
    }
  }
}
