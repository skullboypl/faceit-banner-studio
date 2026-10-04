import { useContext } from 'react';
import { LanguageContext, SettingsContext } from '../generator/Generator';
import { SettingKey } from '../settings/manager';
import { isVersusStyle, resolveBannerStyle } from '../../widget/src/styles/styles';
import { Checkbox } from './Checkbox';
import { Statistic } from './Statistic';
import { StatisticType } from '../generator/tabs/StatisticsTab';

export function PresetSettings() {
  const settings = useContext(SettingsContext);
  const tl = useContext(LanguageContext);
  if (!settings || !tl || settings.get('bannerDesign') !== '2026') return null;
  const style = resolveBannerStyle(settings.get('style'), '2026');
  const key = (suffix: string) => `${style}${suffix}` as SettingKey;
  const animated = style === 'showcase' || style === 'spotlight';
  const select = (suffix: string, label: string, options: string[]) => (
    <div className="setting">
      <label htmlFor={`preset-${suffix}`}>{tl(`preset.${label}`)}</label>
      <select id={`preset-${suffix}`} value={String(settings.get(key(suffix)))} onChange={(event) => settings.set(key(suffix), event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{tl(`preset.option.${option}`)}</option>)}
      </select>
    </div>
  );
  if (isVersusStyle(style)) {
    return (
      <div className="settings preset-options">
        <h3 className="card-heading">{tl('preset.settings', [tl(`style.${style}`)])}</h3>
        <p className="subtext">{tl('preset.saved_separately')}</p>
        <div className="setting preset-accent">
          <label htmlFor="preset-accent">{tl('versus.accent_me')}</label>
          <input id="preset-accent" type="color" value={`#${settings.get(key('Accent'))}`} onChange={(event) => settings.set(key('Accent'), event.target.value.slice(1))} />
        </div>
        {style === 'cycle' && (
          <>
            <Checkbox text={tl('preset.autoplay')} setting={key('Autoplay')} />
            <div className="setting">
              <label htmlFor="preset-duration">{tl('preset.duration', [String(settings.get(key('Seconds')))])}</label>
              <input id="preset-duration" type="range" min="3" max="20" step="1" value={Number(settings.get(key('Seconds')))} onChange={(event) => settings.set(key('Seconds'), Number(event.target.value))} />
            </div>
          </>
        )}
        <div className="setting preset-accent">
          <label htmlFor="preset-accent-rival">{tl('versus.accent_rival')}</label>
          <input id="preset-accent-rival" type="color" value={`#${settings.get('versusOpponentAccent')}`} onChange={(event) => settings.set('versusOpponentAccent', event.target.value.slice(1))} />
        </div>
      </div>
    );
  }
  return (
    <div className="settings preset-options">
      <h3 className="card-heading">{tl('preset.settings', [tl(`style.${style}`)])}</h3>
      <p className="subtext">{tl('preset.saved_separately')}</p>
      <div className="setting preset-accent">
        <label htmlFor="preset-accent">{tl('preset.accent')}</label>
        <input id="preset-accent" type="color" value={`#${settings.get(key('Accent'))}`} onChange={(event) => settings.set(key('Accent'), event.target.value.slice(1))} />
      </div>
      <Checkbox text={tl('preset.level_glow')} setting={key('LevelGlow')} />
      {settings.get(key('LevelGlow')) && (
        <div className="setting">
          <label htmlFor="preset-level-glow">{tl('preset.level_glow_strength', [String(settings.get(key('LevelGlowStrength')))])}</label>
          <input id="preset-level-glow" type="range" min="2" max="20" step="1" value={Number(settings.get(key('LevelGlowStrength')))} onChange={(event) => settings.set(key('LevelGlowStrength'), Number(event.target.value))} />
        </div>
      )}
      {!['rail', 'focus', 'orbit', 'halo', 'pulse', 'ticker', 'slab', 'gauge', 'card', 'reel', 'ribbon', 'tower', 'dials', 'marquee', 'prime'].includes(style) && select('RankPlace', 'rank_place', ['beside', 'under'])}
      {style === 'broadcast' && <>{select('Density', 'density', ['comfortable', 'compact'])}<Checkbox text={tl('preset.tiles')} setting={key('Tiles')} /></>}
      {style === 'rail' && <>{select('StatsPosition', 'stats_position', ['right', 'below'])}<Checkbox text={tl('preset.labels')} setting={key('ShowLabels')} /></>}
      {style === 'focus' && <>{select('StatsLayout', 'stats_layout', ['grid', 'rows'])}<Checkbox text={tl('preset.large_elo')} setting={key('LargeElo')} /></>}
      {style === 'marquee' && (
        <div className="setting">
          <label htmlFor="preset-marquee">{tl('preset.marquee_speed', [String(settings.get(key('Seconds')))])}</label>
          <input id="preset-marquee" type="range" min="6" max="40" step="1" value={Number(settings.get(key('Seconds')))} onChange={(event) => settings.set(key('Seconds'), Number(event.target.value))} />
        </div>
      )}
      {style === 'reel' && <>
        <Checkbox text={tl('preset.autoplay')} setting={key('Autoplay')} />
        <div className="setting">
          <label htmlFor="preset-duration">{tl('preset.duration', [String(settings.get(key('Seconds')))])}</label>
          <input id="preset-duration" type="range" min="2" max="20" step="1" value={Number(settings.get(key('Seconds')))} onChange={(event) => settings.set(key('Seconds'), Number(event.target.value))} />
        </div>
      </>}
      {style === 'ticker' && <>
        <Checkbox text={tl('preset.autoplay')} setting={key('Autoplay')} />
        <div className="setting">
          <label htmlFor="preset-duration">{tl('preset.duration', [String(settings.get(key('Seconds')))])}</label>
          <input id="preset-duration" type="range" min="3" max="20" step="1" value={Number(settings.get(key('Seconds')))} onChange={(event) => settings.set(key('Seconds'), Number(event.target.value))} />
        </div>
        <div className="setting">
          <label htmlFor="preset-head-stat">{tl('preset.head_stat')}</label>
          <select id="preset-head-stat" value={String(settings.get(key('HeadStat')))} onChange={(event) => settings.set(key('HeadStat'), event.target.value as never)}>
            {Object.values(StatisticType).map((value) => <option key={value} value={value}>{tl(`stat.${value.toLowerCase()}`)}</option>)}
          </select>
        </div>
      </>}
      {animated && <>
        <Checkbox text={tl('preset.autoplay')} setting={key('Autoplay')} />
        <div className="setting">
          <label htmlFor="preset-duration">{tl('preset.duration', [String(settings.get(key('Seconds')))])}</label>
          <input id="preset-duration" type="range" min="3" max="20" step="1" value={Number(settings.get(key('Seconds')))} onChange={(event) => settings.set(key('Seconds'), Number(event.target.value))} />
        </div>
        {select('Motion', 'motion', ['slide','flip','fade'])}
        <Checkbox text={tl('preset.glow')} setting={key('Glow')} />
        <h4>{tl('preset.pages')}</h4>
        {['Profile','Form','Tactics','Session'].map((page) => <Checkbox key={page} text={tl(`widget.page.${page.toLowerCase()}`)} setting={key(page)} />)}
        <p className="subtext">{tl('preset.pages_help')}</p>
        {settings.get(key('Tactics')) && <>
          <h4>{tl('preset.extra_stats')}</h4>
          <div className="preset-extra-stats">{[1,2,3,4].map((slot) => <Statistic key={slot} slot={String(slot)} setting={key(`Stat${slot}`)} />)}</div>
        </>}
      </>}
    </div>
  );
}
