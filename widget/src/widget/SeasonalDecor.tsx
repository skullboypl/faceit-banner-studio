import { CSSProperties } from 'react';
import { XMAS_BULBS, XMAS_FLAKES, type XmasOptions, xmasActive } from './seasonal';

/** Fixed spread for the flakes and bulbs, so a reload looks the same and nothing depends on Math.random. */
const flakeStyle = (index: number): CSSProperties =>
  ({
    '--x': `${(index * 37 + 11) % 100}%`,
    '--size': `${2 + ((index * 7) % 4)}px`,
    '--fall': `${7 + ((index * 13) % 7)}s`,
    '--delay': `${-((index * 17) % 11)}s`,
    '--sway': `${2.6 + ((index * 5) % 3)}s`,
    '--alpha': `${0.55 + ((index * 3) % 5) / 10}`,
  }) as CSSProperties;

const bulbStyle = (index: number): CSSProperties =>
  ({
    '--twinkle': `${1.6 + ((index * 7) % 5) * 0.35}s`,
    '--twinkle-delay': `${-((index * 11) % 9) * 0.3}s`,
  }) as CSSProperties;

/**
 * Christmas extras laid over a banner. It sits inside the banner frame, takes no clicks and is hidden from screen
 * readers. Full-screen sources (popup, scenes) pass a larger scale so the lights and flakes read at 1920 × 1080.
 */
export function SeasonalDecor({ options, scale = 1 }: { options: XmasOptions; scale?: number }) {
  if (!xmasActive(options)) return null;
  return (
    <div
      className={`seasonal-decor colors-${options.colors}${options.cap ? ' has-cap' : ''}`}
      style={{ '--decor-scale': scale, '--xmas-inset': `${options.inset}px` } as CSSProperties}
      aria-hidden="true"
      data-testid="seasonal-decor"
    >
      {options.frost && <i className="xmas-frost" />}
      {options.snow && (
        <div className="xmas-snow">
          {Array.from({ length: XMAS_FLAKES[options.amount] }, (_, index) => (
            <i key={index} style={flakeStyle(index)} />
          ))}
        </div>
      )}
      {options.cap && <i className="xmas-cap" />}
      {options.drift && <i className="xmas-drift" />}
      {options.lights && (
        <div className="xmas-lights">
          <i className="xmas-wire" />
          <div className="xmas-bulbs">
            {Array.from({ length: XMAS_BULBS }, (_, index) => (
              <i key={index} style={bulbStyle(index)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
