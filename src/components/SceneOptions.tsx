import { useContext } from 'react';
import { LanguageContext, SettingsContext } from '../generator/Generator';
import { SettingKey } from '../settings/manager';
import {
  SCENE_ANIMATIONS,
  SCENE_CHAT_SIDES,
  SCENE_CHAT_STYLES,
  SCENE_HANDLE_REGEX,
  SCENE_KINDS,
  SCENE_MOTIONS,
  SCENE_PART_GROUPS,
  SCENE_RANGES,
  SCENE_SOCIALS,
  SCENE_TEXT_REGEX,
  SCENE_THEMES,
  SCENE_WOW_THEMES,
  type SceneKind,
  type ScenePart,
  type SceneSocial,
  readSceneParts,
  sceneSocialKey,
  sceneTextKey,
  writeSceneParts,
} from '../../widget/src/widget/scene-options';
import { MAP_ART, MAP_PREVIEW_IDS } from '../../widget/src/widget/map-art';
import { Checkbox } from './Checkbox';
import { StudioIcon, type IconName } from './StudioIcon';

const KIND_ICONS: Record<SceneKind, IconName> = { starting: 'broadcast', brb: 'history', ending: 'heart' };
const SOCIAL_NAMES: Record<SceneSocial, string> = {
  twitch: 'Twitch',
  kick: 'Kick',
  youtube: 'YouTube',
  x: 'X',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  discord: 'Discord',
};
/** What each field takes: a channel, an account, or a Discord invite. */
const SOCIAL_PLACEHOLDERS: Record<SceneSocial, 'channel' | 'account' | 'invite'> = {
  twitch: 'channel',
  kick: 'channel',
  youtube: 'channel',
  x: 'account',
  instagram: 'account',
  tiktok: 'account',
  discord: 'invite',
};

const asKey = (name: string) => name as SettingKey;

/** A labelled slider showing its value, for the number options of the scenes. */
function Slider({ id, label, setting, range, unit = '%' }: { id: string; label: string; setting: SettingKey; range: [number, number]; unit?: string }) {
  const settings = useContext(SettingsContext);
  if (!settings) return null;
  const value = Number(settings.get(setting));
  return (
    <div className="scene-slider">
      <label htmlFor={id}>
        <span>{label}</span>
        <b>
          {value}
          {unit}
        </b>
      </label>
      <input
        id={id}
        type="range"
        min={range[0]}
        max={range[1]}
        value={value}
        onChange={(event) => settings.set(setting, Number(event.target.value))}
      />
    </div>
  );
}

/** Settings tab: which scene the preview shows, its texts and timer, and the social links. */
export function SceneOptions() {
  const tl = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  if (!tl || !settings) return null;
  const kind = (SCENE_KINDS.find((entry) => entry === settings.get('sceneKind')) ?? 'starting') as SceneKind;
  const setText = (name: string, value: string, pattern: RegExp) => {
    if (pattern.test(value)) settings.set(asKey(name), value);
  };

  return (
    <>
      <div className="settings scene-options">
        <h3 className="card-heading">
          <StudioIcon name="monitor" />
          {tl('scenes.title')}
        </h3>
        <p className="subtext">{tl('scenes.help')}</p>
        <div className="design-switch scene-kinds" role="group" aria-label={tl('scenes.pick')}>
          {SCENE_KINDS.map((entry) => (
            <button key={entry} type="button" className="design-switch-option" aria-pressed={kind === entry} onClick={() => settings.set('sceneKind', entry)}>
              <span className="design-switch-mark" aria-hidden="true">
                <StudioIcon name={KIND_ICONS[entry]} />
              </span>
              <span className="design-switch-text">
                <strong>{tl(`scenes.kind.${entry}`)}</strong>
                <small>{tl(`scenes.kind.${entry}.tagline`)}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="setting">
          <label htmlFor="scene-title">{tl('scenes.title_field')}</label>
          <input
            id="scene-title"
            maxLength={90}
            placeholder={tl(`scene.${kind}.title`)}
            value={String(settings.get(asKey(sceneTextKey('Title', kind))) || '')}
            onChange={(event) => setText(sceneTextKey('Title', kind), event.target.value, SCENE_TEXT_REGEX)}
          />
        </div>
        <div className="setting">
          <label htmlFor="scene-note">{tl('scenes.note_field')}</label>
          <input
            id="scene-note"
            maxLength={90}
            placeholder={tl(`scene.${kind}.note`)}
            value={String(settings.get(asKey(sceneTextKey('Note', kind))) || '')}
            onChange={(event) => setText(sceneTextKey('Note', kind), event.target.value, SCENE_TEXT_REGEX)}
          />
        </div>
        {kind !== 'ending' && (
          <div className="setting">
            <Slider id="scene-countdown" label={tl('scenes.countdown')} setting={'sceneCountdown'} range={SCENE_RANGES.countdown} unit=" min" />
            <small className="subtext">{tl('scenes.countdown.help')}</small>
          </div>
        )}
        <p className="subtext scene-tab-hint">{tl('scenes.tabs_hint')}</p>
      </div>

      <div className="settings scene-options">
        <h3 className="card-heading">
          <StudioIcon name="user" />
          {tl('scenes.socials')}
        </h3>
        <p className="subtext">{tl('scenes.socials.help')}</p>
        <div className="scene-socials-grid">
          {SCENE_SOCIALS.map((social) => (
            <label key={social} className="scene-social-field">
              <span>{SOCIAL_NAMES[social]}</span>
              <input
                value={String(settings.get(asKey(sceneSocialKey(social))) || '')}
                maxLength={48}
                spellCheck={false}
                placeholder={tl(`scenes.placeholder.${SOCIAL_PLACEHOLDERS[social]}`)}
                onChange={(event) => setText(sceneSocialKey(social), event.target.value.trim(), SCENE_HANDLE_REGEX)}
              />
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

/** Look tab: theme, background, the chat panel and the sizes. */
export function SceneLookOptions() {
  const tl = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  if (!tl || !settings) return null;
  const map = String(settings.get('sceneMap') || '');

  return (
    <>
      <div className="settings scene-options">
        <h3 className="card-heading">
          <StudioIcon name="palette" />
          {tl('scenes.theme')}
        </h3>
        <div className="design-switch scene-themes" role="group" aria-label={tl('scenes.theme')}>
          {SCENE_THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              className="design-switch-option"
              aria-pressed={settings.get('sceneTheme') === theme}
              onClick={() => settings.set('sceneTheme', theme)}
            >
              <span className={`scene-theme-thumb is-${theme}`} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="design-switch-text">
                <strong>
                  {tl(`scenes.theme.${theme}`)}
                  {SCENE_WOW_THEMES.includes(theme) && <em className="anim-chip">WOW</em>}
                </strong>
                <small>{tl(`scenes.theme.${theme}.tagline`)}</small>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="settings scene-options">
        <h3 className="card-heading">
          <StudioIcon name="layers" />
          {tl('scenes.background')}
        </h3>
        <div className="setting">
          <p>{tl('scenes.animation')}</p>
          <div className="design-switch scene-animations" role="group" aria-label={tl('scenes.animation')}>
            {SCENE_ANIMATIONS.map((animation) => (
              <button
                key={animation}
                type="button"
                className="design-switch-option"
                aria-pressed={settings.get('sceneAnimation') === animation}
                onClick={() => settings.set('sceneAnimation', animation)}
              >
                <span className={`scene-anim-swatch is-${animation}`} aria-hidden="true" />
                <span className="design-switch-text">
                  <strong>{tl(`scenes.anim.${animation}`)}</strong>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="setting">
          <p>{tl('scenes.map')}</p>
          <div className="scene-maps" role="group" aria-label={tl('scenes.map')}>
            <button type="button" className="scene-map-pick is-none" aria-pressed={map === ''} onClick={() => settings.set('sceneMap', '')}>
              <span>{tl('scenes.map.none')}</span>
            </button>
            {MAP_PREVIEW_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className="scene-map-pick"
                aria-pressed={map === id}
                style={{ backgroundImage: `url("${MAP_ART[id]}")` }}
                onClick={() => settings.set('sceneMap', id)}
              >
                <span>{id === 'dust2' ? 'Dust 2' : id.charAt(0).toUpperCase() + id.slice(1)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="scene-sliders">
          {map && <Slider id="scene-map-blur" label={tl('scenes.map_blur')} setting={'sceneMapBlur'} range={SCENE_RANGES.mapBlur} unit=" px" />}
          <Slider id="scene-dim" label={tl('scenes.dim')} setting={'sceneDim'} range={SCENE_RANGES.dim} />
        </div>
        <div className="setting">
          <p>{tl('scenes.motion')}</p>
          <div className="scene-segment" role="group" aria-label={tl('scenes.motion')}>
            {SCENE_MOTIONS.map((motion) => (
              <button key={motion} type="button" aria-pressed={settings.get('sceneMotion') === motion} onClick={() => settings.set('sceneMotion', motion)}>
                {tl(`scenes.motion.${motion}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings scene-options">
        <h3 className="card-heading">
          <StudioIcon name="message" />
          {tl('scenes.layout')}
        </h3>
        <div className="setting">
          <Checkbox text={tl('scenes.chat')} setting={'sceneChat'} />
          {settings.get('sceneChat') && (
            <>
              <div className="design-switch scene-sides" role="group" aria-label={tl('scenes.chat_side')}>
                {SCENE_CHAT_SIDES.map((side) => (
                  <button key={side} type="button" className="design-switch-option" aria-pressed={settings.get('sceneChatSide') === side} onClick={() => settings.set('sceneChatSide', side)}>
                    <span className={`scene-side-thumb is-${side}`} aria-hidden="true">
                      <i />
                      <i />
                    </span>
                    <span className="design-switch-text">
                      <strong>{tl(`scenes.side.${side}`)}</strong>
                    </span>
                  </button>
                ))}
              </div>
              <p>{tl('scenes.chat_style')}</p>
              <div className="scene-segment" role="group" aria-label={tl('scenes.chat_style')}>
                {SCENE_CHAT_STYLES.map((style) => (
                  <button key={style} type="button" aria-pressed={settings.get('sceneChatStyle') === style} onClick={() => settings.set('sceneChatStyle', style)}>
                    {tl(`scenes.chat_style.${style}`)}
                  </button>
                ))}
              </div>
              <div className="scene-sliders">
                <Slider id="scene-chat-width" label={tl('scenes.chat_width')} setting={'sceneChatWidth'} range={SCENE_RANGES.chatWidth} />
              </div>
            </>
          )}
        </div>
        <div className="scene-sliders">
          <Slider id="scene-scale" label={tl('scenes.scale')} setting={'sceneScale'} range={SCENE_RANGES.scale} />
          <Slider id="scene-title-scale" label={tl('scenes.title_scale')} setting={'sceneTitleScale'} range={SCENE_RANGES.title} />
        </div>
      </div>
    </>
  );
}

/** Statistics tab: the player card and which numbers it shows. */
export function SceneStatsOptions() {
  const tl = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  if (!tl || !settings) return null;
  const parts = readSceneParts(settings.get('sceneParts'));
  const togglePart = (part: ScenePart) => {
    const next = new Set(parts);
    if (next.has(part)) next.delete(part);
    else next.add(part);
    settings.set('sceneParts', writeSceneParts(next));
  };

  return (
    <div className="settings scene-options">
      <h3 className="card-heading">
        <StudioIcon name="stats" />
        {tl('scenes.parts')}
      </h3>
      <Checkbox text={tl('scenes.stats')} setting={'sceneStats'} />
      <div className="setting scene-parts">
        {SCENE_PART_GROUPS.map(({ group, parts: groupParts }) => (
          <div className="scene-part-group" key={group}>
            <span>{tl(`scenes.parts.${group}`)}</span>
            <div className="scene-part-chips" role="group" aria-label={tl(`scenes.parts.${group}`)}>
              {groupParts.map((part) => (
                <button key={part} type="button" className="scene-part-chip" aria-pressed={parts.has(part)} onClick={() => togglePart(part)}>
                  <StudioIcon name={parts.has(part) ? 'check' : 'plus'} />
                  {tl(`scenes.part.${part}`)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
