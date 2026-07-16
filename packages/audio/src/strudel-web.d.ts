// SPDX-License-Identifier: AGPL-3.0-only
// @strudel/web@1.0.3 does not ship TypeScript declarations.
declare module '@strudel/web' {
  export interface Cyclist {
    setCps(cps: number): void;
    setPattern(pattern: unknown, autostart?: boolean): void;
    stop(): void;
  }

  export interface Pattern {
    [key: string]: unknown;
  }

  export const Pattern: {
    new (...args: unknown[]): Pattern;
    prototype: Pattern;
  };

  export function defaultPrebake(): Promise<void>;
  export function evaluate(code: string, autoplay?: boolean): Promise<void>;
  export function initAudio(options?: Record<string, unknown>): Promise<void>;
  export function miniAllStrings(): void;
  export function webaudioScheduler(options?: Record<string, unknown>): Cyclist;
}
