import { useContext } from 'react';
import { LanguageContext, SettingsContext } from '../generator/Generator';
import { SettingKey } from '../settings/manager';
import {
  TEAM_ANIMATIONS,
  TEAM_AVATAR_SHAPES,
  TEAM_DENSITIES,
  TEAM_RANGES,
  TEAM_ROWS,
  TEAM_SORTS,
  TEAM_THEMES,
  TEAM_WINDOWS,
  TEAM_TITLE_MAX,
  readTeamOptions,
} from '../../widget/src/widget/team-options';
import { Checkbox } from './Checkbox';

/** Plain helpers shared by the roster panels: a labelled select and a labelled slider. */
function useFields() {
  const settings = useContext(SettingsContext);
  const tl = useContext(LanguageContext);
  if (!settings || !tl) return null;
  const options = readTeamOptions((key) => settings.get(key as SettingKey));

  const select = (id: string, setting: SettingKey, label: string, value: string, choices: readonly string[], prefix: string) => (
    <div className="popup-field">
      <label htmlFor={id}>{tl(label)}</label>
      <select id={id} value={value} onChange={(event) => settings.set(setting, event.target.value as never)}>
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {tl(`${prefix}.${choice}`)}
          </option>
        ))}
      </select>
    </div>
  );
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
  return { settings, tl, options, select, slider };
}

/** Roster banner, Settings tab: what is shown (pictures, stat columns, heading) and how the list is ordered. */
export function TeamOptionsPanel() {
  const fields = useFields();
  if (!fields) return null;
  const { settings, tl, options, select } = fields;
  return (
    <div className="settings mode-options team-options">
      <h3 className="card-heading">{tl('team.options.title')}</h3>

      <section className="popup-group">
        <h4>{tl('team.group.data')}</h4>
        {select('team-window', 'teamMatchWindow', 'team.match_window', String(options.matchWindow), TEAM_WINDOWS.map(String), 'team.window')}
        <Checkbox text={tl('team.show_form')} setting="teamShowForm" />
        <Checkbox text={tl('team.show_player_form')} setting="teamShowPlayerForm" />
        <Checkbox text={tl('team.show_avatars')} setting="teamShowAvatars" />
        <Checkbox text={tl('team.show_levels')} setting="teamShowLevels" />
        <Checkbox text={tl('team.show_elo')} setting="teamShowElo" />
        <Checkbox text={tl('team.show_kd')} setting="teamShowKd" />
        <Checkbox text={tl('team.show_wr')} setting="teamShowWinRate" />
        <Checkbox text={tl('team.show_hs')} setting="teamShowHs" />
        <Checkbox text={tl('team.show_adr')} setting="teamShowAdr" />
        <Checkbox text={tl('team.show_kr')} setting="teamShowKr" />
        <Checkbox text={tl('team.show_matches')} setting="teamShowMatches" />
        <Checkbox text={tl('team.show_wins')} setting="teamShowWins" />
        <Checkbox text={tl('team.show_streak')} setting="teamShowStreak" />
        <Checkbox text={tl('team.show_avg')} setting="teamShowAvg" />
        <div className="popup-field">
          <label htmlFor="team-title">{tl('team.title_label')}</label>
          <input
            id="team-title"
            value={options.title}
            maxLength={TEAM_TITLE_MAX}
            placeholder={tl('team.kicker')}
            onChange={(event) => settings.set('teamTitle', event.target.value as never)}
          />
        </div>
      </section>

      <section className="popup-group">
        <h4>{tl('team.group.list')}</h4>
        {select('team-sort', 'teamSort', 'team.sort', options.sort, TEAM_SORTS, 'team.sort')}
        <Checkbox text={tl('team.show_rank')} setting="teamShowRank" />
        <Checkbox text={tl('team.elo_bar')} setting="teamEloBar" />
        <Checkbox text={tl('team.highlight_top')} setting="teamHighlightTop" />
      </section>
    </div>
  );
}

const COLOR_FIELDS = [
  { setting: 'teamPanelColor', key: 'panelColor', label: 'team.color.panel', fallback: '#14141a' },
  { setting: 'teamTextColor', key: 'textColor', label: 'team.color.text', fallback: '#f6f3f1' },
  { setting: 'teamBarColor', key: 'barColor', label: 'team.color.bar', fallback: '#ff5900' },
  { setting: 'teamTopColor', key: 'topColor', label: 'team.color.top', fallback: '#ff5900' },
] as const;

/** Roster banner, Look tab: panel theme, row style, shapes, size, colours and the entrance. */
export function TeamLookOptions() {
  const fields = useFields();
  if (!fields) return null;
  const { settings, tl, options, select, slider } = fields;
  const changed = COLOR_FIELDS.some((field) => options[field.key] !== '');
  return (
    <div className="settings mode-options team-look">
      <h3 className="card-heading">{tl('team.look.title')}</h3>

      <section className="popup-group">
        <h4>{tl('team.group.style')}</h4>
        {select('team-theme', 'teamTheme', 'team.theme', options.theme, TEAM_THEMES, 'team.theme')}
        {select('team-rows', 'teamRows', 'team.rows', options.rows, TEAM_ROWS, 'team.rows')}
        {select('team-avatar-shape', 'teamAvatarShape', 'team.avatar_shape', options.avatarShape, TEAM_AVATAR_SHAPES, 'team.shape')}
        {select('team-density', 'teamDensity', 'team.density', options.density, TEAM_DENSITIES, 'team.density')}
        {slider('team-radius', 'teamRadius', 'team.radius', options.radius, TEAM_RANGES.radius)}
        {options.theme !== 'clear' && slider('team-opacity', 'teamOpacity', 'team.opacity', options.opacity, TEAM_RANGES.opacity)}
        {slider('team-font-scale', 'teamFontScale', 'team.font_scale', options.fontScale, TEAM_RANGES.fontScale)}
        <Checkbox text={tl('team.labels')} setting="teamLabels" />
        {select('team-animation', 'teamAnimation', 'team.animation', options.animation, TEAM_ANIMATIONS, 'team.anim')}
      </section>

      <section className="popup-group">
        <h4>{tl('team.group.colors')}</h4>
        {COLOR_FIELDS.map((field) => {
          const value = options[field.key];
          return (
            <div key={field.setting} className="popup-field popup-accent">
              <label htmlFor={`team-${field.setting}`}>{tl(field.label)}</label>
              <span className="team-color-value">
                {value ? `#${value}` : <em>{tl('team.color.theme')}</em>}
                <input
                  id={`team-${field.setting}`}
                  type="color"
                  value={value ? `#${value}` : field.fallback}
                  onChange={(event) => settings.set(field.setting, event.target.value.slice(1) as never)}
                />
              </span>
            </div>
          );
        })}
        <button
          type="button"
          className="secondary-link"
          disabled={!changed}
          onClick={() => COLOR_FIELDS.forEach((field) => settings.set(field.setting, '' as never))}
        >
          {tl('team.color.reset')}
        </button>
      </section>
    </div>
  );
}
