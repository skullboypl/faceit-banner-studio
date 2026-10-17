import { useContext } from 'react';
import { LanguageContext, SettingsContext } from '../generator/Generator';
import { SettingKey } from '../settings/manager';
import {
  POPUP_ANIMATIONS,
  POPUP_LAYOUTS,
  POPUP_ME_STATS,
  POPUP_POSITIONS,
  POPUP_RANGES,
  POPUP_THEMES,
  PopupFontKey,
  PopupLookKey,
  PopupOptions as PopupOptionValues,
  PopupPhase,
  fontKeysFor,
  lookFor,
  popupMinWidth,
  readPopupOptions,
  timingFor,
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

/** The shared setting behind each look key, used while "separate look per phase" is off. */
const LOOK_SETTING: Record<PopupLookKey, SettingKey> = {
  layout: 'popupLayout',
  theme: 'popupTheme',
  animation: 'popupAnimation',
  position: 'popupPosition',
  scale: 'popupScale',
  widthPct: 'popupWidthPct',
  radius: 'popupRadius',
  opacity: 'popupOpacity',
  mapBg: 'popupMapBg',
  mapBlur: 'popupMapBlur',
  mapOpacity: 'popupMapOpacity',
};

/** OBS browser sources for a full-screen overlay are 1920 x 1080. */
const FRAME_WIDTH = 1920;

function useControls() {
  const settings = useContext(SettingsContext);
  const tl = useContext(LanguageContext);
  if (!settings || !tl) return null;
  const base = readPopupOptions((key) => settings.get(key as SettingKey));
  const phase = ((settings.get('popupPreview') as PopupPhase) || 'live') as PopupPhase;
  /** What the look controls show: the previewed phase's own look when each phase has one. */
  const options = lookFor(base, phase);
  /** The roster lists exist in every layout except the strip, and not in the compact card. */
  const rosters = options.layout !== 'strip' && !options.compact;

  /** Writes a look setting globally, or into the previewed phase's overrides when they are enabled. */
  const setLook = (key: PopupLookKey, value: string | number | boolean) => {
    if (!base.perPhase) {
      settings.set(LOOK_SETTING[key], value as never);
      return;
    }
    const next = { ...base.phaseLook, [phase]: { ...base.phaseLook[phase], [key]: value } };
    settings.set('popupPhaseLook', JSON.stringify(next) as never);
  };

  const slider = (
    id: string,
    label: string,
    value: number,
    range: readonly [number, number],
    step: number,
    onChange: (value: number) => void
  ) => (
    <div className="popup-field">
      <label htmlFor={`popup-${id}`}>{tl(label, [String(value)])}</label>
      <input
        id={`popup-${id}`}
        type="range"
        min={range[0]}
        max={range[1]}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
  const select = (
    id: string,
    label: string,
    value: string,
    choices: readonly string[],
    prefix: string,
    onChange: (value: string) => void
  ) => (
    <div className="popup-field">
      <label htmlFor={`popup-${id}`}>{tl(label)}</label>
      <select id={`popup-${id}`} value={value} onChange={(event) => onChange(event.target.value)}>
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {tl(`${prefix}.${choice}`)}
          </option>
        ))}
      </select>
    </div>
  );
  return { settings, tl, base, options, phase, rosters, setLook, slider, select };
}

/** Which match phase the widget preview shows: before the match, live, or the result. */
export function PopupPhaseSwitch() {
  const settings = useContext(SettingsContext);
  const tl = useContext(LanguageContext);
  if (!settings || !tl) return null;
  return (
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
            <small>{tl(`popup.phase.${phase}.hint`)}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

/** A small drawing of each layout, so the choice is visible before it is made. */
function PopupLayoutThumb({ layout }: { layout: (typeof POPUP_LAYOUTS)[number] }) {
  const row = (x: number, y: number, key: string) => <rect key={key} x={x} y={y} width="17" height="2.4" rx="1.2" fill="currentColor" opacity="0.55" />;
  return (
    <svg className="layout-thumb" viewBox="0 0 64 40" aria-hidden="true">
      <rect x="1" y="1" width="62" height="38" rx="4" fill="none" stroke="currentColor" opacity="0.35" />
      {layout === 'card' && (
        <>
          <rect x="6" y="6" width="14" height="2.4" rx="1.2" fill="var(--preset-accent, #ff6b18)" />
          <rect x="27" y="11" width="10" height="5" rx="1.5" fill="currentColor" />
          {[0, 1, 2, 3, 4].map((i) => row(6, 21 + i * 3.4, `l${i}`))}
          {[0, 1, 2, 3, 4].map((i) => row(41, 21 + i * 3.4, `r${i}`))}
        </>
      )}
      {layout === 'stack' && (
        <>
          <rect x="6" y="5" width="14" height="2.4" rx="1.2" fill="var(--preset-accent, #ff6b18)" />
          <rect x="27" y="5" width="10" height="4.4" rx="1.5" fill="currentColor" />
          {[0, 1, 2].map((i) => row(23, 12 + i * 3.4, `a${i}`))}
          <rect x="6" y="23.2" width="52" height="0.8" fill="currentColor" opacity="0.25" />
          {[0, 1, 2].map((i) => row(23, 26 + i * 3.4, `b${i}`))}
        </>
      )}
      {layout === 'strip' && (
        <>
          <rect x="6" y="14" width="14" height="3" rx="1.5" fill="currentColor" opacity="0.7" />
          <rect x="6" y="20" width="9" height="2.4" rx="1.2" fill="currentColor" opacity="0.4" />
          <rect x="26" y="13" width="12" height="7" rx="2" fill="currentColor" />
          <rect x="44" y="14" width="14" height="3" rx="1.5" fill="currentColor" opacity="0.7" />
          <rect x="49" y="20" width="9" height="2.4" rx="1.2" fill="currentColor" opacity="0.4" />
        </>
      )}
    </svg>
  );
}

/** Layout, preview phase and the per-phase switch, shown inside the "Theme and layout" card of the Look tab. */
export function PopupLayoutPicker() {
  const controls = useControls();
  if (!controls) return null;
  const { tl, options, setLook } = controls;
  return (
    <div className="popup-layout-picker">
      <p className="popup-layout-title">{tl('popup.layout')}</p>
      <div className="design-switch popup-layouts" role="group" aria-label={tl('popup.layout')}>
        {POPUP_LAYOUTS.map((choice) => (
          <button
            key={choice}
            type="button"
            className="design-switch-option"
            aria-pressed={options.layout === choice}
            onClick={() => setLook('layout', choice)}
          >
            <PopupLayoutThumb layout={choice} />
            <span className="design-switch-text">
              <strong>{tl(`popup.lay.${choice}`)}</strong>
              <small>{tl(`popup.lay.${choice}.hint`)}</small>
            </span>
          </button>
        ))}
      </div>

      <p className="popup-layout-title">{tl('popup.preview')}</p>
      <PopupPhaseSwitch />
      <p className="subtext">{tl('popup.phases.help')}</p>
      <Checkbox text={tl('popup.per_phase')} setting="popupPerPhase" helpTitle={tl('popup.per_phase.help')} />
      <p className="subtext">{tl('popup.preview.hint')}</p>
    </div>
  );
}

/** Two-column needs and where the chosen width lands on a 1920 px OBS source. */
function sizeHints(options: PopupOptionValues, tl: (text: string, args?: string[]) => string) {
  const min = popupMinWidth(options, 'post');
  const wanted = Math.round((FRAME_WIDTH * options.widthPct) / 100);
  const actual = Math.min(FRAME_WIDTH, Math.max(wanted, min));
  return {
    min: tl('popup.min_two', [String(min), String(Math.ceil((min / FRAME_WIDTH) * 100))]),
    actual: tl('popup.at_1920', [String(actual)]),
  };
}

/** Text sizes of each element, kept separately for every layout. */
export function PopupFontOptions() {
  const controls = useControls();
  if (!controls) return null;
  const { settings, tl, base, options, slider } = controls;
  const layout = options.layout;
  const own = base.fonts[layout] ?? {};
  const save = (fonts: typeof base.fonts) => settings.set('popupFonts', (Object.keys(fonts).length ? JSON.stringify(fonts) : '') as never);
  const change = (key: PopupFontKey, value: number) => save({ ...base.fonts, [layout]: { ...own, [key]: value } });
  const reset = () => {
    const rest = { ...base.fonts };
    delete rest[layout];
    save(rest);
  };
  return (
    <details className="banner-size popup-fonts">
      <summary className="banner-size-heading">
        <h4>{tl('popup.fonts.title')}</h4>
        <span>{Object.keys(own).length ? `${Object.keys(own).length} ✎` : '100%'}</span>
      </summary>
      <div className="popup-size-body">
        <p className="subtext">{tl('popup.fonts.for', [tl(`popup.lay.${layout}`)])}</p>
        {fontKeysFor(layout).map((key) =>
          slider(`font-${key}`, `popup.font.${key}`, own[key] ?? 100, POPUP_RANGES.font, 5, (value) => change(key, value))
        )}
        <p className="subtext">{tl('popup.fonts.help')}</p>
        <button type="button" className="secondary-link popup-fonts-reset" onClick={reset} disabled={!Object.keys(own).length}>
          {tl('popup.fonts.reset')}
        </button>
      </div>
    </details>
  );
}

/** Popup card appearance: lives in the Look tab. */
export function PopupLookOptions() {
  const controls = useControls();
  if (!controls) return null;
  const { settings, tl, base, options, phase, setLook, slider, select } = controls;
  const hints = sizeHints(options, tl);
  return (
    <div className="settings popup-options">
      <h3 className="card-heading">{tl('popup.group.look')}</h3>
      {base.perPhase && <p className="subtext popup-editing">{tl('popup.editing', [tl(`popup.phase.${phase}`)])}</p>}

      <section className="popup-group">
        <h4>{tl('popup.sub.place')}</h4>
        <div className="popup-place">
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
                onClick={() => setLook('position', position)}
              />
            ))}
          </div>
          <p className="subtext">
            {tl('popup.position')}: <strong>{tl(`popup.pos.${options.position}`)}</strong>
          </p>
        </div>
      </section>

      <section className="popup-group">
        <h4>{tl('popup.size')}</h4>
        {slider('popupScale', 'popup.scale', options.scale, POPUP_RANGES.scale, 5, (value) => setLook('scale', value))}
        {slider('popupWidthPct', 'popup.width', options.widthPct, POPUP_RANGES.widthPct, 1, (value) => setLook('widthPct', value))}
        <p className="subtext">{hints.min}</p>
        <p className="subtext">{hints.actual}</p>
      </section>

      <section className="popup-group">
        <h4>{tl('popup.sub.style')}</h4>
        {select('popupTheme', 'popup.theme', options.theme, POPUP_THEMES, 'popup.theme', (value) => setLook('theme', value))}
        <div className="popup-field popup-accent">
          <label htmlFor="popup-accent">{tl('preset.accent')}</label>
          <input
            id="popup-accent"
            type="color"
            value={`#${settings.get('livecardAccent')}`}
            onChange={(event) => settings.set('livecardAccent', event.target.value.slice(1))}
          />
        </div>
        {slider('popupRadius', 'popup.radius', options.radius, POPUP_RANGES.radius, 1, (value) => setLook('radius', value))}
        {options.theme !== 'clear' &&
          slider('popupOpacity', 'popup.opacity', options.opacity, POPUP_RANGES.opacity, 2, (value) => setLook('opacity', value))}
        {select('popupAnimation', 'popup.animation', options.animation, POPUP_ANIMATIONS, 'popup.anim', (value) => setLook('animation', value))}
      </section>

      <section className="popup-group">
        <h4>{tl('popup.sub.background')}</h4>
        <Checkbox text={tl('popup.map_bg')} state={options.mapBg} setState={(value) => setLook('mapBg', value)} />
        {options.mapBg &&
          slider('popupMapBlur', 'popup.map_blur', options.mapBlur, POPUP_RANGES.mapBlur, 1, (value) => setLook('mapBlur', value))}
        {options.mapBg &&
          slider('popupMapOpacity', 'popup.map_opacity', options.mapOpacity, POPUP_RANGES.mapOpacity, 1, (value) => setLook('mapOpacity', value))}
      </section>

      <section className="popup-group">
        <PopupFontOptions />
      </section>
    </div>
  );
}

/** Popup timing and content: lives in the Settings tab under the player profile. */
export function PopupOptions() {
  const controls = useControls();
  if (!controls) return null;
  const { settings, tl, base, phase, rosters, slider } = controls;
  const timing = timingFor(base, phase);
  const setTiming = (key: 'seconds' | 'delay', value: number) => {
    const next = {
      ...base.phaseTiming,
      [phase]: { ...base.phaseTiming[phase], seconds: timing.seconds, delay: timing.delay, [key]: value },
    };
    settings.set('popupPhaseTiming', JSON.stringify(next) as never);
  };
  return (
    <>
      <div className="settings popup-options">
        <h3 className="card-heading">{tl('popup.group.when')}</h3>
        <Checkbox text={tl('popup.pre')} setting="popupPre" />
        <Checkbox text={tl('popup.live')} setting="popupLive" />
        <Checkbox text={tl('popup.post')} setting="popupPost" />
        <PopupPhaseSwitch />
        <p className="subtext">{tl('popup.timing.help', [tl(`popup.phase.${phase}`)])}</p>
        {slider('popupSeconds', 'popup.hold', timing.seconds, POPUP_RANGES.seconds, 1, (value) => setTiming('seconds', value))}
        {slider('popupDelay', 'popup.delay', timing.delay, POPUP_RANGES.delay, 1, (value) => setTiming('delay', value))}
        <p className="subtext">{tl('popup.help')}</p>
      </div>

      <div className="settings popup-options">
        <h3 className="card-heading">{tl('popup.group.content')}</h3>
        {base.layout !== 'strip' && <Checkbox text={tl('popup.compact')} setting="popupCompact" />}
        <Checkbox text={tl('popup.show_map')} setting="popupShowMap" />
        <Checkbox text={tl('popup.show_score')} setting="popupShowScore" />
        <Checkbox text={tl('popup.show_teams')} setting="popupShowTeams" />
        <Checkbox text={tl('popup.show_avg')} setting="popupShowAvg" />
        {base.layout === 'strip' && <Checkbox text={tl('popup.show_avatars')} setting="popupShowAvatars" />}
        {rosters && (
          <>
            <Checkbox text={tl('popup.show_avatars')} setting="popupShowAvatars" />
            <Checkbox text={tl('popup.show_levels')} setting="popupShowLevels" />
            <Checkbox text={tl('popup.show_country')} setting="popupShowCountry" />
            <Checkbox text={tl('popup.show_elo')} setting="popupShowElo" />
            <Checkbox text={tl('popup.highlight')} setting="popupHighlightMe" />
            <Checkbox text={tl('popup.sort_elo')} setting="popupSortElo" />
            <p className="subtext">{tl('popup.sort_elo.help')}</p>
          </>
        )}
      </div>

      {base.post && (
        <div className="settings popup-options">
          <h3 className="card-heading">{tl('popup.group.me')}</h3>
          <Checkbox text={tl('popup.show_me')} setting="popupShowMe" />
          {rosters && <Checkbox text={tl('popup.scoreboard')} setting="popupScoreboard" />}
          {(base.showMe || (base.scoreboard && rosters)) && (
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
