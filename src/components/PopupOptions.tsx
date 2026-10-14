import { useContext } from 'react';
import { LanguageContext, SettingsContext } from '../generator/Generator';
import { SettingKey } from '../settings/manager';
import {
  POPUP_ANIMATIONS,
  POPUP_ME_STATS,
  POPUP_POSITIONS,
  POPUP_RANGES,
  POPUP_THEMES,
  readPopupOptions,
} from '../../widget/src/widget/popup-options';
import { Checkbox } from './Checkbox';

const ME_KEYS = {
  kills: 'popupMeKills',
  deaths: 'popupMeDeaths',
  assists: 'popupMeAssists',
  kd: 'popupMeKd',
  adr: 'popupMeAdr',
  hs: 'popupMeHs',
  mvps: 'popupMeMvps',
} as const;

/** Popup-mode controls. Only options that change the card as configured are shown. */
export function PopupOptions() {
  const settings = useContext(SettingsContext);
  const tl = useContext(LanguageContext);
  if (!settings || !tl) return null;
  const options = readPopupOptions((key) => settings.get(key as SettingKey));

  const slider = (key: SettingKey, label: string, value: number, range: readonly [number, number], step = 1) => (
    <div className="setting popup-slider">
      <label htmlFor={`popup-${key}`}>{tl(label, [String(value)])}</label>
      <input
        id={`popup-${key}`}
        type="range"
        min={range[0]}
        max={range[1]}
        step={step}
        value={value}
        onChange={(event) => settings.set(key, Number(event.target.value) as never)}
      />
    </div>
  );
  const select = (key: SettingKey, label: string, value: string, choices: readonly string[], prefix: string) => (
    <div className="setting">
      <label htmlFor={`popup-${key}`}>{tl(label)}</label>
      <select id={`popup-${key}`} value={value} onChange={(event) => settings.set(key, event.target.value as never)}>
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {tl(`${prefix}.${choice}`)}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <div className="settings popup-options">
        <h3 className="card-heading">{tl('popup.group.when')}</h3>
        <Checkbox text={tl('popup.pre')} setting="popupPre" />
        <Checkbox text={tl('popup.live')} setting="popupLive" />
        <Checkbox text={tl('popup.post')} setting="popupPost" />
        {slider('popupSeconds', 'popup.hold', options.seconds, POPUP_RANGES.seconds)}
        {slider('popupDelay', 'popup.delay', options.delay, POPUP_RANGES.delay)}
        <div className="design-switch popup-phase" role="group" aria-label={tl('popup.preview')}>
          {(['pre', 'live', 'post'] as const).map((phase) => (
            <button
              key={phase}
              type="button"
              className="design-switch-option"
              aria-pressed={settings.get('popupPreview') === phase}
              onClick={() => settings.set('popupPreview', phase)}
            >
              <span className="design-switch-text">
                <strong>{tl(`popup.phase.${phase}`)}</strong>
              </span>
            </button>
          ))}
        </div>
        <p className="subtext">{tl('popup.help')}</p>
      </div>

      <div className="settings popup-options">
        <h3 className="card-heading">{tl('popup.group.look')}</h3>
        <div className="setting">
          <p>{tl('popup.position')}</p>
          <div className="popup-position" role="radiogroup" aria-label={tl('popup.position')}>
            {POPUP_POSITIONS.map((position) => (
              <button
                key={position}
                type="button"
                role="radio"
                aria-checked={options.position === position}
                aria-label={tl(`popup.pos.${position}`)}
                title={tl(`popup.pos.${position}`)}
                data-position={position}
                onClick={() => settings.set('popupPosition', position)}
              />
            ))}
          </div>
        </div>
        {slider('popupScale', 'popup.scale', options.scale, POPUP_RANGES.scale, 5)}
        {slider('popupWidth', 'popup.width', options.width, POPUP_RANGES.width, 10)}
        {slider('popupRadius', 'popup.radius', options.radius, POPUP_RANGES.radius)}
        {select('popupTheme', 'popup.theme', options.theme, POPUP_THEMES, 'popup.theme')}
        {options.theme !== 'clear' && slider('popupOpacity', 'popup.opacity', options.opacity, POPUP_RANGES.opacity, 2)}
        {select('popupAnimation', 'popup.animation', options.animation, POPUP_ANIMATIONS, 'popup.anim')}
      </div>

      <div className="settings popup-options">
        <h3 className="card-heading">{tl('popup.group.content')}</h3>
        <Checkbox text={tl('popup.compact')} setting="popupCompact" />
        <Checkbox text={tl('popup.show_map')} setting="popupShowMap" />
        <Checkbox text={tl('popup.show_score')} setting="popupShowScore" />
        <Checkbox text={tl('popup.show_teams')} setting="popupShowTeams" />
        <Checkbox text={tl('popup.show_avg')} setting="popupShowAvg" />
        {!options.compact && (
          <>
            <Checkbox text={tl('popup.show_levels')} setting="popupShowLevels" />
            <Checkbox text={tl('popup.show_elo')} setting="popupShowElo" />
            <Checkbox text={tl('popup.highlight')} setting="popupHighlightMe" />
            <Checkbox text={tl('popup.sort_elo')} setting="popupSortElo" />
          </>
        )}
      </div>

      {options.post && (
        <div className="settings popup-options">
          <h3 className="card-heading">{tl('popup.group.me')}</h3>
          <Checkbox text={tl('popup.show_me')} setting="popupShowMe" />
          {options.showMe && (
            <div className="popup-stat-grid">
              {POPUP_ME_STATS.map((stat) => (
                <Checkbox key={stat} text={tl(`popup.me.${stat}`)} setting={ME_KEYS[stat]} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
