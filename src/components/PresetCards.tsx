import { useContext } from 'react';
import { LanguageContext, SettingsContext } from '../generator/Generator';
import { broadcastPresets } from '../../widget/src/styles/styles';
import { PresetThumb } from './PresetThumb';

/** Layout cards; `versus` picks the two-player layouts instead of the solo ones. */
export function PresetCards({ versus }: { versus: boolean }) {
  const settings = useContext(SettingsContext);
  const tl = useContext(LanguageContext);
  if (!settings || !tl) return null;

  return (
    <div
      className="broadcast-presets"
      role="group"
      aria-label={tl(versus ? 'versus.layouts' : 'studio.presets')}
    >
      {broadcastPresets
        .filter((preset) => Boolean(preset.versus) === versus)
        .map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="broadcast-preset"
            aria-pressed={settings.get('style') === preset.id}
            onClick={() => settings.set('style', preset.id)}
          >
            <PresetThumb id={preset.id} width={preset.width} height={preset.height} />
            <strong>
              {tl(`style.${preset.id}`)}
              {preset.animated && (
                <em className="anim-chip" title={tl('style.animated')}>
                  ANIM
                </em>
              )}
            </strong>
            <span>{tl(`style.${preset.id}.description`)}</span>
            <small>
              OBS · {preset.width} × {preset.height}
            </small>
          </button>
        ))}
    </div>
  );
}
