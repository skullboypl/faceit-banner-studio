import { useContext } from 'react';
import { LanguageContext, SettingsContext } from '../generator/Generator';
import { SettingKey } from '../settings/manager';
import { Checkbox } from './Checkbox';
import {
  CAMERA_PRESETS,
  RADAR_PRESETS,
  SPLIT_AXES,
  SPLIT_BITS,
  SPLIT_CHART_LOOKS,
  SPLIT_DATA_LOOKS,
  SPLIT_MOTION_LOOKS,
  SPLIT_RANGES,
  SPLIT_THEMES,
  SPLIT_VIEWS,
  readSplitOptions,
  sameChoice,
  writeChoice,
} from '../../widget/src/widget/split-options';

const RADAR_CHIPS = ['combat', 'aim', 'results', 'full'] as const;
const CAMERA_CHIPS = ['identity', 'elo', 'session', 'form', 'bar'] as const;

function useSplit() {
  const settings = useContext(SettingsContext);
  const tl = useContext(LanguageContext);
  if (!settings || !tl) return null;
  const options = readSplitOptions((key) => settings.get(key as SettingKey));
  return { settings, tl, options };
}

function Presets<T extends string>({
  chips,
  current,
  presets,
  onPick,
  tl,
}: {
  chips: readonly T[];
  current: readonly string[];
  presets: Record<T, readonly string[]>;
  onPick: (id: T) => void;
  tl: (text: string) => string;
}) {
  return (
    <div className="split-presets">
      {chips.map((id) => (
        <button key={id} type="button" aria-pressed={sameChoice(current, presets[id])} onClick={() => onPick(id)}>
          {tl(`split.preset.${id}`)}
        </button>
      ))}
    </div>
  );
}

function Choice({
  chips,
  value,
  prefix,
  onPick,
  tl,
}: {
  chips: readonly string[];
  value: string;
  prefix: string;
  onPick: (id: string) => void;
  tl: (text: string) => string;
}) {
  return (
    <div className="split-presets">
      {chips.map((id) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onPick(id)}>
          {tl(`${prefix}${id}`)}
        </button>
      ))}
    </div>
  );
}

/** Split banner, Settings tab: anything can go on the radar, anything on the bar under the camera. */
export function SplitOptionsPanel() {
  const fields = useSplit();
  if (!fields) return null;
  const { settings, tl, options } = fields;
  const look =
    options.view === 'data'
      ? { chips: SPLIT_DATA_LOOKS, value: options.dataLook, prefix: 'split.data.', setting: 'splitDataLook' as const }
      : options.view === 'motion'
        ? { chips: SPLIT_MOTION_LOOKS, value: options.motionLook, prefix: 'split.motion.', setting: 'splitMotionLook' as const }
        : { chips: SPLIT_CHART_LOOKS, value: options.chartLook, prefix: 'split.chart.', setting: 'splitChartLook' as const };
  return (
    <div className="settings popup-options split-options">
      <h3 className="card-heading">{tl('split.options.title')}</h3>
      <p className="subtext">{tl('split.options.help')}</p>

      <section className="popup-group">
        <h4>{tl('split.options.radar')}</h4>
        <Choice
          chips={SPLIT_VIEWS}
          value={options.view}
          prefix="split.view."
          tl={tl}
          onPick={(id) => settings.set('splitView', id as never)}
        />
        <p className="split-kicker">{tl('split.view.look')}</p>
        <Choice
          chips={look.chips}
          value={look.value}
          prefix={look.prefix}
          tl={tl}
          onPick={(id) => settings.set(look.setting, id as never)}
        />
        <p className="subtext">{tl(`split.${options.view}.help`)}</p>
        <p className="split-kicker">{tl('split.view.fields')}</p>
        <Presets
          chips={RADAR_CHIPS}
          current={options.axes}
          presets={RADAR_PRESETS}
          tl={tl}
          onPick={(id) => settings.set('splitAxes', RADAR_PRESETS[id].join(',') as never)}
        />
        <div className="popup-stat-grid">
          {SPLIT_AXES.map((axis) => (
            <Checkbox
              key={axis}
              text={tl(`split.axis.${axis}`)}
              state={options.axes.includes(axis)}
              setState={(on) => settings.set('splitAxes', writeChoice(SPLIT_AXES, options.axes, axis, on) as never)}
            />
          ))}
        </div>
        <p className="subtext">{tl('split.radar.help')}</p>
      </section>

      <section className="popup-group">
        <h4>{tl('split.options.camera')}</h4>
        <Presets
          chips={CAMERA_CHIPS}
          current={options.bits}
          presets={CAMERA_PRESETS}
          tl={tl}
          onPick={(id) => settings.set('splitCamera', CAMERA_PRESETS[id].join(',') as never)}
        />
        <div className="popup-stat-grid">
          {SPLIT_BITS.map((bit) => (
            <Checkbox
              key={bit}
              text={tl(`split.bit.${bit}`)}
              state={options.bits.includes(bit)}
              setState={(on) => settings.set('splitCamera', writeChoice(SPLIT_BITS, options.bits, bit, on) as never)}
            />
          ))}
        </div>
        <p className="subtext">{tl('split.camera.help')}</p>
      </section>
    </div>
  );
}

/** Split banner, Look tab: plate theme, accent, radius, opacity and type size. */
export function SplitLookOptions() {
  const fields = useSplit();
  if (!fields) return null;
  const { settings, tl, options } = fields;
  const layoutAccent = String(settings.get('splitsetAccent' as SettingKey) || 'ff5900');
  const slider = (id: string, setting: SettingKey, label: string, value: number, range: readonly [number, number]) => (
    <div className="popup-field">
      <label htmlFor={id}>{tl(label, [String(value)])}</label>
      <input
        id={id}
        type="range"
        min={range[0]}
        max={range[1]}
        step={1}
        value={value}
        onChange={(event) => settings.set(setting, Number(event.target.value) as never)}
      />
    </div>
  );
  return (
    <div className="settings popup-options split-options">
      <h3 className="card-heading">{tl('split.look.title')}</h3>
      <section className="popup-group">
        <div className="popup-field">
          <label htmlFor="split-theme">{tl('split.theme')}</label>
          <select id="split-theme" value={options.theme} onChange={(event) => settings.set('splitTheme', event.target.value as never)}>
            {SPLIT_THEMES.map((theme) => (
              <option key={theme} value={theme}>
                {tl(`split.theme.${theme}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="popup-field popup-accent">
          <label htmlFor="split-accent">{tl('split.accent')}</label>
          <span className="team-color-value">
            {options.accent ? `#${options.accent}` : <em>{tl('split.accent.layout')}</em>}
            <input
              id="split-accent"
              type="color"
              value={`#${options.accent || layoutAccent}`}
              onChange={(event) => settings.set('splitAccent', event.target.value.slice(1) as never)}
            />
          </span>
        </div>
        {options.accent && (
          <button type="button" className="secondary-link" onClick={() => settings.set('splitAccent', '' as never)}>
            {tl('split.accent.reset')}
          </button>
        )}
        {slider('split-radius', 'splitRadius', 'split.radius', options.radius, SPLIT_RANGES.radius)}
        {options.theme !== 'clear' && slider('split-opacity', 'splitOpacity', 'split.opacity', options.opacity, SPLIT_RANGES.opacity)}
        {slider('split-font', 'splitFont', 'split.font', options.font, SPLIT_RANGES.font)}
      </section>
    </div>
  );
}
