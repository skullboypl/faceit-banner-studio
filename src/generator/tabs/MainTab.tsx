import { Language, languages } from '../../translations/translations.ts';
import { Checkbox } from '../../components/Checkbox.tsx';
import { Dispatch, useContext, useEffect, useState } from 'react';
import { LanguageContext, SettingsContext } from '../Generator.tsx';
import { InfoBox } from '../../components/InfoBox.tsx';
import {
  getPlayerProfile,
  getVerifiedBadgeType,
  VerifiedBadgeType,
} from '../../../widget/src/utils/faceit_util.ts';
import { ShowRanking } from '../../../widget/src/widget/Widget.tsx';
import type { VersusPlayer } from '../../../widget/src/widget/Widget.tsx';
import { presetMode, BannerMode } from '../../../widget/src/styles/styles.ts';
import { parseRoster } from '../../../shared/banner-modes.mjs';
import { BANNER_MODES, type BannerCatalog } from '../../../shared/banner-catalog.mjs';
import { UserIcon } from '../../assets/icons/tabler/UserIcon.tsx';
import { StudioIcon } from '../../components/StudioIcon.tsx';
import { PopupOptions } from '../../components/PopupOptions.tsx';
import { LOGIN_URL } from '../../components/FaceitLoginButton.tsx';

type Props = {
  playerExists: boolean | undefined;
  username: string;
  playerAvatar?: string;
  language: Language;
  setLanguage: Dispatch<Language>;
  setUsername: Dispatch<string>;
  setPlayerElo: Dispatch<number>;
  setPlayerLevel: Dispatch<number>;
  setPlayerAvatar: Dispatch<string | undefined>;
  setPlayerBanner: Dispatch<string | undefined>;
  setPlayerRegion: Dispatch<string | undefined>;
  setPlayerCountry: Dispatch<string | undefined>;
  setPlayerVerifiedBadge: Dispatch<VerifiedBadgeType>;
  setPlayerExists: Dispatch<boolean>;
  setSelectedTabIndex: Dispatch<number>;
  opponent?: VersusPlayer;
  setOpponent: Dispatch<VersusPlayer | undefined>;
  /** Nickname of the logged-in FACEIT account, when there is one. */
  accountNickname?: string;
  /** Admins see every mode. Everyone else only sees modes the catalog marks visible. */
  admin?: boolean;
  catalog?: BannerCatalog;
};

export const MainTab = ({
  playerExists,
  playerAvatar,
  username,
  language,
  setLanguage,
  setUsername,
  setPlayerElo,
  setPlayerLevel,
  setPlayerAvatar,
  setPlayerBanner,
  setPlayerRegion,
  setPlayerCountry,
  setPlayerVerifiedBadge,
  setPlayerExists,
  setSelectedTabIndex,
  opponent,
  setOpponent,
  accountNickname,
  admin = false,
  catalog,
}: Props) => {
  const tl = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  const [opponentStatus, setOpponentStatus] = useState<
    'idle' | 'loading' | 'found' | 'missing'
  >('idle');
  const mode = (settings?.get('widgetMode') as BannerMode) || 'solo';
  const versusMode = mode === 'versus';
  const opponentName = String(settings?.get('opponentName') ?? '');

  /* VERSUS: look the opponent up as the name is typed */
  useEffect(() => {
    if (!settings || !versusMode) return;
    const name = opponentName.trim();
    if (!name) {
      setOpponent(undefined);
      setOpponentStatus('idle');
      return;
    }
    setOpponentStatus('loading');
    const timeout = setTimeout(() => {
      getPlayerProfile(name).then((res) => {
        if (res && res.games.cs2) {
          settings.set('opponentId', res.player_id);
          setOpponent({
            username: res.nickname,
            avatar: res.avatar,
            country: res.country,
            elo: res.games.cs2.faceit_elo,
            level: res.games.cs2.skill_level,
            kd: 1.05,
            adr: 78.4,
            winRate: 52,
            hs: 44,
          });
          setOpponentStatus('found');
        } else {
          setOpponent(undefined);
          setOpponentStatus('missing');
        }
      });
    }, 500);
    return () => clearTimeout(timeout);
  }, [opponentName, versusMode]);

  const switchMode = (next: BannerMode) => {
    if (!settings) return;
    settings.set('widgetMode', next);
    if (next !== 'solo') settings.set('bannerDesign', '2026');
    if (presetMode(String(settings.get('style'))) !== next) {
      const fallback: Record<BannerMode, string> = {
        solo: 'prime',
        versus: 'duel',
        team: 'lineup',
        split: 'splitset',
        popup: 'livecard',
      };
      settings.set('style', fallback[next]);
    }
    if (next === 'team' && !parseRoster(String(settings.get('teamRoster') || '')).length && username.trim()) {
      settings.set('teamRoster', username.trim());
    }
  };

  useEffect(() => {
    if (!settings || !tl) return;
    const timeout = setTimeout(() => {
      getPlayerProfile(username).then((res) => {
        if (res && res.games.cs2) {
          settings.set('playerId', res.player_id);
          setPlayerAvatar(res.avatar);
          setPlayerBanner(res.cover_image);
          setPlayerRegion(res.games.cs2.region);
          setPlayerCountry(res.country);
          setPlayerVerifiedBadge(getVerifiedBadgeType(res));
          setPlayerElo(res.games.cs2.faceit_elo);
          setPlayerLevel(res.games.cs2.skill_level);
          setPlayerExists(true);
        } else {
          setPlayerRegion(undefined);
          setPlayerCountry(undefined);
          setPlayerVerifiedBadge('none');
          setPlayerElo(100);
          setPlayerLevel(1);
          setPlayerExists(false);
        }
      });
    }, 500);
    return () => {
      clearTimeout(timeout);
    };
  }, [
    username,
    settings,
    tl,
    setPlayerAvatar,
    setPlayerBanner,
    setPlayerCountry,
    setPlayerElo,
    setPlayerExists,
    setPlayerLevel,
    setPlayerRegion,
    setPlayerVerifiedBadge,
  ]);

  if (!settings || !tl) {
    return null;
  }

  return (
    <>
      <div className={'settings design-version'}>
        <h3 className="card-heading">{tl('mode.title')}</h3>
        <div className="design-switch mode-switch" role="group" aria-label={tl('mode.title')}>
          {BANNER_MODES.filter((entry) => admin || catalog?.[entry] !== false).map((entry) => (
            <button
              key={entry}
              type="button"
              className="design-switch-option"
              aria-pressed={mode === entry}
              onClick={() => switchMode(entry)}
            >
              <span className="design-switch-mark" aria-hidden="true">
                {entry === 'solo' ? '1' : entry === 'versus' ? 'VS' : entry === 'team' ? '10' : entry === 'split' ? 'R+' : '●'}
              </span>
              <span className="design-switch-text">
                <strong>{tl(`mode.${entry}`)}</strong>
                <small>{tl(`mode.${entry}.tagline`)}</small>
              </span>
              {admin && (
                <span
                  className={`mode-eye${catalog?.[entry] === false ? ' is-off' : ''}`}
                  title={catalog?.[entry] === false ? 'Ukryte w konfiguratorze' : 'Widoczne dla wszystkich'}
                >
                  <StudioIcon name={catalog?.[entry] === false ? 'eye-off' : 'eye'} />
                </span>
              )}
            </button>
          ))}
        </div>
        {versusMode && (
          <>
            <div className="setting">
              <div className={'flex profile-row'}>
                {opponent?.avatar ? (
                  <img src={opponent.avatar} className={'player-avatar'} alt="" />
                ) : (
                  <span className={'player-avatar empty'}>
                    <UserIcon />
                  </span>
                )}
                <div>
                  <p>{tl('versus.opponent')}</p>
                  <input
                    aria-label={tl('versus.opponent')}
                    placeholder={tl('versus.opponent.placeholder')}
                    value={opponentName}
                    onChange={(event) =>
                      settings.set('opponentName', event.target.value)
                    }
                  />
                </div>
              </div>
              {opponentStatus === 'missing' && (
                <InfoBox
                  content={tl('generator.settings.player_not_found')}
                  style={'severe'}
                />
              )}
              {opponentStatus === 'found' && opponent && (
                <p className="subtext">
                  {opponent.username} · {opponent.elo} ELO · lvl {opponent.level}
                </p>
              )}
              {opponentStatus === 'idle' && (
                <p className="subtext">{tl('versus.opponent.help')}</p>
              )}
            </div>
          </>
        )}
        {mode === 'team' && (
          <TeamRosterEditor />
        )}
        {mode === 'split' && (
          <>
            <div className="setting">
              <label htmlFor="split-radar">{tl('split.radar')}</label>
              <select
                id="split-radar"
                value={String(settings.get('splitRadar'))}
                onChange={(event) => settings.set('splitRadar', event.target.value)}
              >
                {(['combat', 'aim', 'results'] as const).map((option) => (
                  <option key={option} value={option}>
                    {tl(`split.radar.${option}`)}
                  </option>
                ))}
              </select>
              <p className="subtext">{tl('split.radar.help')}</p>
            </div>
            <div className="setting">
              <label htmlFor="split-camera">{tl('split.camera')}</label>
              <select
                id="split-camera"
                value={String(settings.get('splitMini'))}
                onChange={(event) => settings.set('splitMini', event.target.value)}
              >
                {(['identity', 'elo', 'session', 'form'] as const).map((option) => (
                  <option key={option} value={option}>
                    {tl(`split.mini.${option}`)}
                  </option>
                ))}
              </select>
              <p className="subtext">{tl('split.camera.help')}</p>
            </div>
          </>
        )}
        <div className="look-cta">
          <div className="look-cta-text">
            <small>{tl(mode === 'solo' ? 'cta.layout' : `cta.${mode}_layout`)}</small>
            <strong>
              {tl(`style.${String(settings.get('style'))}`)}
            </strong>
          </div>
      {mode === 'popup' && <PopupOptions />}
          <button
            type="button"
            className="look-cta-button"
            onClick={() => setSelectedTabIndex(1)}
          >
            {tl('cta.change_look')}
            <StudioIcon name="arrow" />
          </button>
        </div>
      </div>
      <div className={'settings'}>
        <h3 className="card-heading">
          <UserIcon />
          {tl('studio.profile')}
        </h3>
        <div className={'setting'}>
          {accountNickname ? (
            <div className="account-cta">
              <button
                type="button"
                className="account-cta-button"
                disabled={accountNickname.toLowerCase() === username.toLowerCase()}
                title={tl('profile.use_account.hint')}
                onClick={() => setUsername(accountNickname.slice(0, 12))}
              >
                <UserIcon />
                <span>
                  {tl('profile.use_account')}
                  <strong>{accountNickname}</strong>
                </span>
              </button>
              <small>{tl('profile.or_type')}</small>
            </div>
          ) : (
            <p className="account-hint">
              {tl('profile.guest_hint')}{' '}
              <a href={LOGIN_URL}>{tl('profile.guest_login')}</a>
            </p>
          )}
          <div className={'flex profile-row'}>
            {playerAvatar ? (
              <img src={playerAvatar} className={'player-avatar'} alt="" />
            ) : (
              <span className={'player-avatar empty'}>
                <UserIcon />
              </span>
            )}
            <div>
              <p>{tl('generator.settings.faceit_name')}</p>
              <input
                aria-label={tl('generator.settings.faceit_name')}
                max={12}
                value={username}
                onChange={(e) => {
                  if (e.target.value.length > 12) return;
                  setUsername(e.target.value);
                }}
              />
            </div>
          </div>
          {!playerExists && (
            <InfoBox
              content={tl('generator.settings.player_not_found')}
              style={'severe'}
            />
          )}
        </div>
        <div className={'setting flex'}>
          <div>
            <p>{tl('generator.settings.language')}</p>
            <select
              aria-label={tl('generator.settings.language')}
              value={language.id}
              onChange={(event) => {
                const language =
                  languages.find(
                    (language) => language.id === event.target.value
                  ) || languages[0];
                setLanguage(language);
                localStorage.setItem('fcw_lang', language.id);
              }}
            >
              {languages.map((language) => {
                return (
                  <option key={language.id} value={language.id}>
                    {language.name}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <p>{tl('generator.settings.widget_language')}</p>
            <select
              aria-label={tl('generator.settings.widget_language')}
              value={settings.get('widgetLanguage') as string | undefined}
              onChange={(event) => {
                if (event.target.value === 'default') {
                  settings.set('widgetLanguage', undefined);
                  return;
                }
                const language =
                  languages.find(
                    (language) => language.id === event.target.value
                  ) || languages[0];
                settings.set('widgetLanguage', language.id);
              }}
            >
              <option key={'default'} value={'default'}>
                {tl('generator.settings.widget_language.default')}
              </option>
              {languages.map((language) => {
                return (
                  <option key={language.id} value={language.id}>
                    {language.name}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>
      <div className={'settings'}>
        <h3 className="card-heading">
          <StudioIcon name="layers" />
          {tl('studio.visible_elements')}
        </h3>
        <div className={'setting'}>
          <Checkbox
            text={tl('generator.settings.show_level_icon')}
            setting={'showLevelIcon'}
          />
          <Checkbox
            text={tl('generator.settings.show_username')}
            setting={'showUsername'}
          />
          <Checkbox
            text={tl('generator.settings.show_verified_badge')}
            setting={'showVerifiedBadge'}
          />
          <Checkbox
            text={tl('generator.settings.show_elo_suffix')}
            setting={'showEloSuffix'}
          />
          <Checkbox
            text={tl('generator.settings.show_elo_diff')}
            setting={'showEloDiff'}
          />
          <Checkbox
            text={tl('generator.settings.show_wins_losses')}
            setting={'showWinsLosses'}
          />
          <Checkbox
            text={tl('generator.settings.show_elo_progress_bar')}
            setting={'showEloProgressBar'}
          />
          <Checkbox
            text={tl('generator.settings.show_icons')}
            setting={'showIcons'}
          />
          <Checkbox
            text={tl('generator.settings.show_kd')}
            setting={'showStatistics'}
          />
          <Checkbox
            text={tl('generator.settings.hide_banner_header')}
            setting={'hideBannerHeader'}
          />
          <div className={'setting'}>
            <p>{tl('generator.settings.show_ranking')}</p>
            <select
              aria-label={tl('generator.settings.show_ranking')}
              value={settings.get('showRanking')}
              onChange={(e) =>
                settings.set(
                  'showRanking',
                  parseInt(e.target.value) as ShowRanking
                )
              }
            >
              {Object.entries(ShowRanking).map(([key, value]) => {
                if (typeof value !== 'number') return;
                return (
                  <option key={key} value={value}>
                    {tl(`ranking_state.${key}`)}{' '}
                  </option>
                );
              })}
            </select>
          </div>
          <button
            className="secondary-link"
            onClick={() => {
              setSelectedTabIndex(1);
            }}
          >
            {tl('generator.settings.adjust_style')}
            <StudioIcon name="arrow" />
          </button>
        </div>
      </div>
      <div className={'settings'}>
        <h3 className="card-heading">
          <StudioIcon name="settings" />
          {tl('studio.behavior')}
        </h3>
        <div className={'setting'}>
          <Checkbox
            text={tl('generator.settings.auto_width')}
            setting={'autoWidth'}
          />
          <Checkbox
            text={tl('generator.settings.update_intro')}
            setting={'showUpdateIntro'}
            helpTitle={tl('generator.settings.update_intro.help')}
          />
          <Checkbox
            text={tl('generator.settings.save_session')}
            setting={'saveSession'}
            helpTitle={tl('generator.settings.save_session.help')}
          />
        </div>
      </div>
      <hr />
      <p style={{ marginTop: '16px' }} className={'subtext'}>
        {tl('generator.description')}
      </p>
    </>
  );
};

function TeamRosterEditor() {
  const tl = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  const [draft, setDraft] = useState('');
  if (!tl || !settings) return null;
  const names = parseRoster(String(settings.get('teamRoster') || ''));
  const add = () => {
    const next = parseRoster([...names, draft].join(','));
    settings.set('teamRoster', next.join(','));
    setDraft('');
  };
  return (
    <div className="setting roster-editor">
      <p>{tl('team.roster')}</p>
      <div className="roster-add">
        <input
          aria-label={tl('team.roster')}
          placeholder={tl('team.placeholder')}
          value={draft}
          maxLength={30}
          disabled={names.length >= 10}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <button
          className="roster-submit"
          type="button"
          onClick={add}
          disabled={names.length >= 10 || !draft.trim()}
        >
          {tl('team.add')}
        </button>
      </div>
      <ul>
        {names.map((name) => (
          <li key={name}>
            <span>{name}</span>
            <button
              className="roster-remove"
              type="button"
              aria-label={tl('team.remove', [name])}
              onClick={() => settings.set('teamRoster', names.filter((entry) => entry !== name).join(','))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <p className="subtext">{tl('team.help')}</p>
    </div>
  );
}
