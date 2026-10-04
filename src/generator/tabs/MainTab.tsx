import { Language, languages } from '../../translations/translations.ts';
import { Checkbox } from '../../components/Checkbox.tsx';
import { Dispatch, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageContext, SettingsContext } from '../Generator.tsx';
import { InfoBox } from '../../components/InfoBox.tsx';
import {
  getPlayerProfile,
  getVerifiedBadgeType,
  VerifiedBadgeType,
} from '../../../widget/src/utils/faceit_util.ts';
import { ShowRanking } from '../../../widget/src/widget/Widget.tsx';
import type { VersusPlayer } from '../../../widget/src/widget/Widget.tsx';
import { isVersusStyle } from '../../../widget/src/styles/styles.ts';
import { UserIcon } from '../../assets/icons/tabler/UserIcon.tsx';
import { StudioIcon } from '../../components/StudioIcon.tsx';

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
}: Props) => {
  const navigate = useNavigate();
  const tl = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  const [opponentStatus, setOpponentStatus] = useState<
    'idle' | 'loading' | 'found' | 'missing'
  >('idle');
  const versusMode = settings?.get('widgetMode') === 'versus';
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

  const switchMode = (mode: 'solo' | 'versus') => {
    if (!settings) return;
    settings.set('widgetMode', mode);
    if (mode === 'versus') {
      settings.set('bannerDesign', '2026');
      if (!isVersusStyle(String(settings.get('style')))) {
        settings.set('style', 'duel');
      }
    } else if (isVersusStyle(String(settings.get('style')))) {
      settings.set('style', 'showcase');
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
        <div className="design-switch" role="group" aria-label={tl('mode.title')}>
          {(['solo', 'versus'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className="design-switch-option"
              aria-pressed={(versusMode ? 'versus' : 'solo') === mode}
              onClick={() => switchMode(mode)}
            >
              <span className="design-switch-mark" aria-hidden="true">
                {mode === 'solo' ? '1' : 'VS'}
              </span>
              <span className="design-switch-text">
                <strong>{tl(`mode.${mode}`)}</strong>
                <small>{tl(`mode.${mode}.tagline`)}</small>
              </span>
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
        <div className="look-cta">
          <div className="look-cta-text">
            <small>{tl(versusMode ? 'cta.versus_layout' : 'cta.layout')}</small>
            <strong>
              {tl(`style.${String(settings.get('style'))}`)}
            </strong>
          </div>
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
                navigate(`?lang=${language.id}`);
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
