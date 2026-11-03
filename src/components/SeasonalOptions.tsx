import { useContext } from 'react';
import { LanguageContext, SettingsContext } from '../generator/Generator';
import { XMAS_LIGHT_COLORS, XMAS_SNOW_AMOUNTS } from '../../widget/src/widget/seasonal';
import { Checkbox } from './Checkbox';
import { StudioIcon } from './StudioIcon';

/** Look tab, every mode: Christmas lights, snow, a snow cap and frost on the banner. All off until switched on. */
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
        <Checkbox text={tl('xmas.frost')} setting={'xmasFrost'} />
      </div>
    </div>
  );
}
