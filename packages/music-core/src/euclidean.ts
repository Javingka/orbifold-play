// SPDX-License-Identifier: AGPL-3.0-only
// Ported from Orbifold src/core/rhythm/euclid.ts and
// reference/orbifold.html lines 794–813.

export function bjorklund(hits: number, steps: number): number[] {
  const boundedSteps = Math.max(1, Math.round(steps));
  const boundedHits = Math.max(0, Math.min(boundedSteps, Math.round(hits)));
  if (boundedHits === 0) return new Array<number>(boundedSteps).fill(0);
  if (boundedHits === boundedSteps) return new Array<number>(boundedSteps).fill(1);

  let ones: number[][] = Array.from({ length: boundedHits }, () => [1]);
  let zeros: number[][] = Array.from({ length: boundedSteps - boundedHits }, () => [0]);

  while (zeros.length > 1) {
    const pairs = Math.min(ones.length, zeros.length);
    const combined: number[][] = [];
    const remainder: number[][] = [];

    for (let index = 0; index < pairs; index += 1) {
      const one = ones[index];
      const zero = zeros[index];
      if (one && zero) combined.push([...one, ...zero]);
    }

    const source = ones.length > pairs ? ones : zeros;
    for (let index = pairs; index < source.length; index += 1) {
      const item = source[index];
      if (item) remainder.push(item);
    }

    ones = combined;
    zeros = remainder;
  }

  return [...ones, ...zeros].flat();
}

export function rotate<T>(values: readonly T[], amount: number): T[] {
  if (values.length === 0) return [];
  const offset = ((Math.round(amount) % values.length) + values.length) % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}
