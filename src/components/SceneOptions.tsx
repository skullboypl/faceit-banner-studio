import { useContext } from 'react';
import { LanguageContext, SettingsContext } from '../generator/Generator';
import { SettingKey } from '../settings/manager';
import {
  SCENE_ANIMATIONS,
  SCENE_CHAT_SIDES,
  SCENE_HANDLE_REGEX,
  SCENE_KINDS,
  SCENE_RANGES,
  SCENE_SOCIALS,
  SCENE_TEXT_REGEX,
  type SceneKind,
  type SceneSocial,
  sceneSocialKey,
  sceneTextKey,
} from '../../widget/src/widget/scene-options';
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

/** Options of the full-screen scenes: which one the preview shows, its texts, the layout and the social links. */
export function SceneOptions() {
  const tl = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  if (!tl || !settings) return null;
  const kind = (SCENE_KINDS.find((entry) => entry === settings.get('sceneKind')) ?? 'starting') as SceneKind;
  const key = (name: string) => name as SettingKey;
  const setText = (name: string, value: string, pattern: RegExp) => {
    if (pattern.test(value)) settings.set(key(name), value);
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
            value={String(settings.get(key(sceneTextKey('Title', kind))) || '')}
            onChange={(event) => setText(sceneTextKey('Title', kind), event.target.value, SCENE_TEXT_REGEX)}
          />
        </div>
        <div className="setting">
          <label htmlFor="scene-note">{tl('scenes.note_field')}</label>
          <input
            id="scene-note"
            maxLength={90}
            placeholder={tl(`scene.${kind}.note`)}
            value={String(settings.get(key(sceneTextKey('Note', kind))) || '')}
            onChange={(event) => setText(sceneTextKey('Note', kind), event.target.value, SCENE_TEXT_REGEX)}
          />
        </div>
        {kind !== 'ending' && (
          <div className="setting">
            <label htmlFor="scene-countdown">{tl('scenes.countdown')}</label>
            <input
              id="scene-countdown"
              type="number"
              inputMode="numeric"
              min={SCENE_RANGES.countdown[0]}
              max={SCENE_RANGES.countdown[1]}
              value={Number(settings.get('sceneCountdown'))}
              onChange={(event) => {
                const value = Math.round(Number(event.target.value));
                if (Number.isFinite(value)) {
                  settings.set('sceneCountdown', Math.min(SCENE_RANGES.countdown[1], Math.max(SCENE_RANGES.countdown[0], value)));
                }
              }}
            />
            <small className="subtext">{tl('scenes.countdown.help')}</small>
          </div>
        )}
      </div>

      <div className="settings scene-options">
        <h3 className="card-heading">
          <StudioIcon name="layers" />
          {tl('scenes.layout')}
        </h3>
        <div className="setting">
          <Checkbox text={tl('scenes.chat')} setting={'sceneChat'} />
          {settings.get('sceneChat') && (
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
          )}
          <Checkbox text={tl('scenes.stats')} setting={'sceneStats'} />
        </div>
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
                value={String(settings.get(key(sceneSocialKey(social))) || '')}
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
