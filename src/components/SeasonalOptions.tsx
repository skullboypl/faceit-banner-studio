import { useContext } from 'react';
import { LanguageContext, SettingsContext } from '../generator/Generator';
import { XMAS_INSET_MAX, XMAS_LIGHT_COLORS, XMAS_SNOW_AMOUNTS, readXmasOptions, xmasActive } from '../../widget/src/widget/seasonal';
import { Checkbox } from './Checkbox';
import { StudioIcon } from './StudioIcon';

/** Look tab, every mode: Christmas lights, snow, snow on the top and bottom edges and frost on the banner. All off until switched on. */
export function SeasonalOptions() {
  const tl = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  if (!tl || !settings) return null;

  return (
    <div className="settings seasonal-options">
      <h3 className="card-heading">
        <StudioIcon name="snowflake" />
        {tl('xmas.title')}
      </h3>
      <p className="subtext">{tl('xmas.help')}</p>
      <div className="setting">
        <Checkbox text={tl('xmas.lights')} setting={'xmasLights'} />
        {settings.get('xmasLights') && (
          <div className="scene-segment xmas-colors" role="group" aria-label={tl('xmas.colors')}>
            {XMAS_LIGHT_COLORS.map((colors) => (
              <button key={colors} type="button" aria-pressed={settings.get('xmasLightColors') === colors} onClick={() => settings.set('xmasLightColors', colors)}>
                <span className={`xmas-swatch colors-${colors}`} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                {tl(`xmas.colors.${colors}`)}
              </button>
            ))}
          </div>
        )}
        <Checkbox text={tl('xmas.snow')} setting={'xmasSnow'} />
        {settings.get('xmasSnow') && (
          <div className="scene-segment" role="group" aria-label={tl('xmas.amount')}>
            {XMAS_SNOW_AMOUNTS.map((amount) => (
              <button key={amount} type="button" aria-pressed={settings.get('xmasSnowAmount') === amount} onClick={() => settings.set('xmasSnowAmount', amount)}>
                {tl(`xmas.amount.${amount}`)}
              </button>
            ))}
          </div>
        )}
        <Checkbox text={tl('xmas.cap')} setting={'xmasCap'} />
        <Checkbox text={tl('xmas.drift')} setting={'xmasDrift'} />
        <Checkbox text={tl('xmas.frost')} setting={'xmasFrost'} />
        {xmasActive(readXmasOptions((key) => settings.get(key as never))) && (
          <div className="setting xmas-inset">
            <label htmlFor="xmas-inset">{tl('xmas.inset', [String(settings.get('xmasInset'))])}</label>
            <input
              id="xmas-inset"
              type="range"
              min="0"
              max={XMAS_INSET_MAX}
              step="1"
              value={Number(settings.get('xmasInset')) || 0}
              onChange={(event) => settings.set('xmasInset', Number(event.target.value))}
            />
            <p className="subtext">{tl('xmas.inset.help')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
