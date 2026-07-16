// SPDX-License-Identifier: AGPL-3.0-only
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const BOOT_STYLES = `
  #orbifold-boot {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    background: #050609;
    color: #697184;
    font: 800 8px/1 system-ui, sans-serif;
    letter-spacing: 1.8px;
  }
  #orbifold-boot-shape {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: #8aa0ff;
    box-shadow: 0 0 0 13px rgba(138, 160, 255, 0.08);
    animation: orbifold-morph 950ms cubic-bezier(.65, 0, .35, 1) infinite alternate;
  }
  #orbifold-boot-core {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(5, 6, 9, 0.78);
  }
  @keyframes orbifold-morph {
    0% { border-radius: 8px; opacity: .7; transform: rotate(0deg) scale(.76, .76); }
    50% { border-radius: 28px; opacity: 1; transform: rotate(68deg) scale(1.22, 1); }
    100% { border-radius: 14px; opacity: .78; transform: rotate(135deg) scale(.74, .82); }
  }
  @media (prefers-reduced-motion: reduce) {
    #orbifold-boot-shape { animation: none; border-radius: 22px; transform: rotate(24deg); }
  }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#050609" />
        <link rel="manifest" href="/manifest.json" />
        <style dangerouslySetInnerHTML={{ __html: BOOT_STYLES }} />
        <ScrollViewStyleReset />
      </head>
      <body>
        <div id="orbifold-boot" role="progressbar" aria-label="Preparing Orbifold instrument">
          <div id="orbifold-boot-shape">
            <div id="orbifold-boot-core" />
          </div>
          <span>FORMING INSTRUMENT</span>
        </div>
        {children}
      </body>
    </html>
  );
}
