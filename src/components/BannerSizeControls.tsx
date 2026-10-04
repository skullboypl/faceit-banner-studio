import { useContext } from 'react';
import { LanguageContext, SettingsContext } from '../generator/Generator';
import {
  BannerSizeMode,
  getBannerSizeLimits,
  getRecommendedWidth,
  resolveBannerSize,
} from '../../widget/src/utils/banner_size';
import { resolveBannerStyle } from '../../widget/src/styles/styles';
import { SettingKey } from '../settings/manager';

type Axis = 'Width' | 'Height';

const MODES: BannerSizeMode[] = ['auto', 'recommended', 'manual'];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function BannerSizeControls() {
  const settings = useContext(SettingsContext);
  const tl = useContext(LanguageContext);
  if (!settings || !tl || settings.get('bannerDesign') !== '2026') return null;

  const style = resolveBannerStyle(settings.get('style'), '2026');
  const limits = getBannerSizeLimits(style);
  if (!limits) return null;

  const allAxes: { axis: Axis; min: number; max: number; natural: number }[] = [
    { axis: 'Width', min: limits.minWidth, max: limits.maxWidth, natural: limits.width },
    { axis: 'Height', min: limits.minHeight, max: limits.maxHeight, natural: limits.height },
  ];
  const axes = limits.square ? allAxes.slice(0, 1) : allAxes;

  const widthMode = settings.get('bannerWidthMode') as BannerSizeMode;
  const heightMode = settings.get('bannerHeightMode') as BannerSizeMode;
  const result = resolveBannerSize({
    style,
    widthMode,
    width: settings.get('bannerWidth'),
    heightMode,
    height: settings.get('bannerHeight'),
    recommendedWidth: getRecommendedWidth(style, Boolean(settings.get('showStatistics'))),
    viewportWidth: Infinity,
    viewportHeight: Infinity,
  });
  const bothAuto =
    widthMode === 'auto' && (limits.square || heightMode === 'auto');

  const modeLabel = (mode: BannerSizeMode) =>
    mode === 'auto'
      ? 'AUTO'
      : tl(mode === 'manual' ? 'size.manual' : 'size.recommended');

  return (
    <details className="banner-size">
      <summary className="banner-size-heading">
        <h4>{tl('size.title')}</h4>
        <span>
          {limits.square
            ? modeLabel(widthMode)
            : `${modeLabel(widthMode)} × ${modeLabel(heightMode)}`}
          {' · '}
          {result?.width ?? limits.width} × {result?.height ?? tl('size.content')}
          {result?.height ? ' px' : ''}
        </span>
      </summary>
      {axes.map(({ axis, min, max, natural }) => {
        const modeKey = `banner${axis}Mode` as SettingKey;
        const valueKey = `banner${axis}` as SettingKey;
        const mode = settings.get(modeKey) as BannerSizeMode;
        const value = clamp(Number(settings.get(valueKey)), min, max);
        const label = tl(
          limits.square ? 'size.side' : axis === 'Width' ? 'size.width' : 'size.height'
        );
        return (
          <div className="banner-size-row" key={axis}>
            <div className="banner-size-label">
              <strong>{label}</strong>
              <div className="banner-size-mode" role="group" aria-label={label}>
                {MODES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={mode === option}
                    onClick={() => {
                      if (option === 'manual' && mode !== 'manual') {
                        settings.set(valueKey, natural);
                      }
                      settings.set(modeKey, option);
                    }}
                  >
                    {modeLabel(option)}
                  </button>
                ))}
              </div>
            </div>
            <div className="banner-size-input">
              <input
                type="range"
                aria-label={label}
                min={min}
                max={max}
                step={1}
                value={mode === 'manual' ? value : mode === 'auto' ? max : natural}
                disabled={mode !== 'manual'}
                onChange={(event) =>
                  settings.set(valueKey, Number(event.currentTarget.value))
                }
              />
              {mode === 'manual' ? (
                <span className="banner-size-value">
                  <input
                    type="number"
                    aria-label={label}
                    min={min}
                    max={max}
                    value={value}
                    onChange={(event) => {
                      const next = Number(event.currentTarget.value);
                      if (!Number.isNaN(next)) settings.set(valueKey, next);
                    }}
                    onBlur={(event) =>
                      settings.set(
                        valueKey,
                        clamp(Number(event.currentTarget.value) || natural, min, max)
                      )
                    }
                  />
                  px
                </span>
              ) : (
                <span className="banner-size-value">
                  {mode === 'auto'
                    ? 'AUTO'
                    : axis === 'Height'
                      ? tl('size.content_short')
                      : `${natural} px`}
                </span>
              )}
            </div>
            <small>
              {mode === 'recommended'
                ? axis === 'Height'
                  ? tl('size.recommended_content')
                  : tl('size.recommended_width', [String(natural)])
                : tl(mode === 'auto' ? 'size.auto_limit' : 'size.limit', [
                    String(min),
                    String(max),
                  ])}
            </small>
          </div>
        );
      })}
      <p className="subtext">
        {bothAuto
          ? tl('size.help.auto')
          : tl('size.help.manual', [
              String(result?.width ?? limits.width),
              result?.height ? String(result.height) : tl('size.content'),
            ])}
      </p>
    </details>
  );
}

export function BannerRadiusControl() {
  const settings = useContext(SettingsContext);
  const tl = useContext(LanguageContext);
  if (!settings || !tl || settings.get('bannerDesign') !== '2026') return null;
  if (resolveBannerStyle(settings.get('style'), '2026') === 'pulse') return null;

  const custom = settings.get('bannerRadiusCustom');
  return (
    <div className="banner-radius">
      <div className="banner-size-heading">
        <h4>{tl('radius.title')}</h4>
        <div className="banner-size-mode" role="group" aria-label={tl('radius.title')}>
          <button
            type="button"
            aria-pressed={!custom}
            onClick={() => settings.set('bannerRadiusCustom', false)}
          >
            {tl('radius.default')}
          </button>
          <button
            type="button"
            aria-pressed={custom}
            onClick={() => settings.set('bannerRadiusCustom', true)}
          >
            {tl('size.manual')}
          </button>
        </div>
      </div>
      <div className="banner-size-input">
        <input
          type="range"
          aria-label={tl('radius.title')}
          min={0}
          max={48}
          step={1}
          value={settings.get('bannerRadius')}
          disabled={!custom}
          onChange={(event) =>
            settings.set('bannerRadius', Number(event.currentTarget.value))
          }
        />
        <span className="banner-size-value">
          {custom ? `${settings.get('bannerRadius')} px` : tl('radius.default')}
        </span>
      </div>
    </div>
  );
}
