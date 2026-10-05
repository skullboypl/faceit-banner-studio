import {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Widget } from '../../widget/src/widget/Widget.tsx';
import {
  Language,
  languages,
  tl as translate,
} from '../translations/translations.ts';
import { MainTab } from './tabs/MainTab.tsx';
import { StyleTab } from './tabs/StyleTab.tsx';
import { StatisticsTab } from './tabs/StatisticsTab.tsx';
import { GeneratedWidgetModal } from '../components/GeneratedWidgetModal.tsx';
import { InfoBox } from '../components/InfoBox.tsx';
import { Footer } from '../components/Footer.tsx';
import { PreviewCarousel } from '../components/PreviewCarousel.tsx';
import { StudioIcon } from '../components/StudioIcon.tsx';
import { TimelineIcon } from '../assets/icons/tabler/TimelineIcon.tsx';
import { ShareIcon } from '../assets/icons/tabler/ShareIcon.tsx';
import { BrandTwitchIcon } from '../assets/icons/tabler/BrandTwitchIcon.tsx';
import { BrandYoutubeIcon } from '../assets/icons/tabler/BrandYoutubeIcon.tsx';
import { BrandDiscordIcon } from '../assets/icons/tabler/BrandDiscordIcon.tsx';
import { BrandTiktokIcon } from '../assets/icons/tabler/BrandTiktokIcon.tsx';
import nukePreview from '../assets/previews/nuke.png';
import miragePreview from '../assets/previews/mirage.png';
import ancientPreview from '../assets/previews/ancient.png';
import dust2Preview from '../assets/previews/dust2.png';
import overpassPreview from '../assets/previews/overpass.png';
import { useSearchParams } from 'react-router-dom';
import {
  SetSettingFunction,
  SettingValue,
  SettingDefinition,
  SettingKey,
  Settings,
  SettingValueType,
  useSettings,
} from '../settings/manager.ts';
import { SETTINGS_DEFINITIONS } from '../settings/definition.ts';
import { resolveBannerStyle } from '../../widget/src/styles/styles';
import type { VersusPlayer } from '../../widget/src/widget/Widget.tsx';
import { VerifiedBadgeType } from '../../widget/src/utils/faceit_util.ts';
import { OnlineBannerCount } from '../components/OnlineBannerCount.tsx';
import { getPlayerProfile } from '../../widget/src/utils/faceit_util.ts';

export const LanguageContext = createContext<
  ((text: string, args?: string[]) => string) | null
>(null);
export const SettingsContext = createContext<{
  settings: Settings;
  get: <K extends SettingKey>(key: K) => SettingValueType<K>;
  set: SetSettingFunction;
} | null>(null);

const DEFAULT_GENERATOR_USERNAME = 'donk666';
const PREVIEW_BACKGROUNDS: Record<string, string> = {
  nuke: nukePreview,
  mirage: miragePreview,
  ancient: ancientPreview,
  dust2: dust2Preview,
  overpass: overpassPreview,
};

export const Generator = () => {
  const [playerExists, setPlayerExists] = useState<boolean>(true);
  const [generatedURL, setGeneratedURL] = useState<string | undefined>();
  const [generatedURLMode, setGeneratedURLMode] = useState<
    'widget' | 'settings'
  >('widget');
  const [username, setUsername] = useState<string>(
    localStorage.getItem('fcw_generator_username') || DEFAULT_GENERATOR_USERNAME
  );
  const [opponent, setOpponent] = useState<VersusPlayer | undefined>();
  const [playerElo, setPlayerElo] = useState<number>(100);
  const [playerLevel, setPlayerLevel] = useState<number>(1);
  const [playerAvatar, setPlayerAvatar] = useState<string | undefined>();
  const [playerBanner, setPlayerBanner] = useState<string | undefined>();
  const [playerRegion, setPlayerRegion] = useState<string | undefined>();
  const [playerCountry, setPlayerCountry] = useState<string | undefined>();
  const [playerVerifiedBadge, setPlayerVerifiedBadge] =
    useState<VerifiedBadgeType>('none');
  const [searchParams] = useSearchParams();
  const [language, setLanguage] = useState<Language>(
    languages.find((language) => language.id === searchParams.get('lang')) ||
      languages.find((language) => language.id === localStorage.fcw_lang) ||
      languages.find((language) => language.id === navigator.language) ||
      languages[0]
  );
  const [previewBackground, setPreviewBackground] = useState<string>('ancient');
  const [shareCopied, setShareCopied] = useState<boolean>(false);
  const [importLinkValue, setImportLinkValue] = useState<string>('');
  const [importStatus, setImportStatus] = useState<'success' | 'error' | null>(
    null
  );
  const [importStatusText, setImportStatusText] = useState<string>('');
  const shareCopiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [introReplay, setIntroReplay] = useState(0);
  const selectTab = useCallback((index: number) => {
    setSelectedTabIndex(index);
    if (window.matchMedia('(max-width: 1000px)').matches) {
      requestAnimationFrame(() => {
        document
          .getElementById('studio-settings-title')
          ?.scrollIntoView({ block: 'start' });
      });
    } else {
      document.getElementById('root')?.scrollTo({ top: 0 });
    }
  }, []);

  const tl = useCallback(
    (text: string, args?: string[]) => {
      return translate(language, text, args);
    },
    [language]
  );

  const { settings, getSetting, setSetting, loadSettingsFromQuery } =
    useSettings(false, 'fcw_generator_settings');

  useLayoutEffect(() => {
    const description = document.getElementsByName('description');
    (description[0] as HTMLMetaElement).content = tl('meta.description');
  }, [language]);

  useEffect(() => {
    document.getElementsByTagName('html')[0].classList.add(`generator`);
    return () => {
      document.getElementsByTagName('html')[0].classList.remove(`generator`);
      if (shareCopiedTimeoutRef.current) {
        clearTimeout(shareCopiedTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('fcw_generator_username', username);
  }, [username]);

  useEffect(() => {
    loadSettingsFromQuery();

    // A saved widget link without a design version must keep its original look.
    if (
      !searchParams.has('design') &&
      ['player_id', 'style', 'stats'].some((key) => searchParams.has(key))
    ) {
      setSetting('bannerDesign', 'legacy');
    }

    const queryUsername = searchParams.get('username');
    if (queryUsername) {
      setUsername(queryUsername);
    }

    const stats = searchParams.get('stats')?.split(',');
    if (stats && stats.length > 0) {
      if (stats[0]) setSetting('statSlot1', stats[0] as Settings['statSlot1']);
      if (stats[1]) setSetting('statSlot2', stats[1] as Settings['statSlot2']);
      if (stats[2]) setSetting('statSlot3', stats[2] as Settings['statSlot3']);
      if (stats[3]) setSetting('statSlot4', stats[3] as Settings['statSlot4']);
    }
  }, [searchParams, loadSettingsFromQuery, setSetting]);

  const buildSettingsQueryParams = useCallback(() => {
    const encodeBase64Utf8 = (value: string): string => {
      const bytes = new TextEncoder().encode(value);
      let binary = '';
      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }
      return btoa(binary);
    };

    const params: {
      [key: string]:
        | string
        | (string | undefined)
        | number
        | boolean
        | string[];
    } = {};

    Object.entries(SETTINGS_DEFINITIONS).forEach(
      ([setting, definition]: [string, SettingDefinition]) => {
        if (!definition.query || definition.query.length === 0) return;
        if (definition.requirements && definition.requirements.length !== 0) {
          for (const requirement of definition.requirements) {
            if (
              getSetting(requirement.setting as SettingKey) !==
              requirement.value
            )
              return;
          }
        }
        if (getSetting(setting) === undefined) return;

        if (setting === 'customInlineCSS') {
          const inlineCss = String(getSetting(setting) || '').trim();
          if (!inlineCss) {
            return;
          }
          params[definition.query[0]] = encodeBase64Utf8(inlineCss);
          return;
        }

        params[definition.query[0]] = getSetting(setting);
      }
    );

    if (!params.lang) {
      params.lang = language.id;
    }

    params.stats = [
      settings.statSlot1,
      settings.statSlot2,
      settings.statSlot3,
      settings.statSlot4,
    ].toString();

    return params;
  }, [settings, language]);

  const generateWidgetURL = useCallback(() => {
    const params = buildSettingsQueryParams();
    setGeneratedURLMode('widget');
    setGeneratedURL(
      `${window.location.protocol}//${window.location.host}/widget/${jsonToQuery(params)}`
    );
  }, [buildSettingsQueryParams]);

  const jsonToQuery = useCallback(
    (params: {
      [key: string]:
        | string
        | (string | undefined)
        | number
        | boolean
        | string[];
    }) => {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined) return;
        query.set(key, String(value));
      });
      return `?${query.toString()}`;
    },
    []
  );

  const copySettingsURLToClipboard = useCallback(async () => {
    const params = buildSettingsQueryParams();
    params.username = username;
    const settingsURL = `${window.location.protocol}//${window.location.host}/${jsonToQuery(params)}`;

    try {
      await navigator.clipboard.writeText(settingsURL);
      setShareCopied(true);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = settingsURL;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setShareCopied(true);
    }

    if (shareCopiedTimeoutRef.current) {
      clearTimeout(shareCopiedTimeoutRef.current);
    }
    shareCopiedTimeoutRef.current = setTimeout(() => {
      setShareCopied(false);
    }, 2000);
  }, [buildSettingsQueryParams, jsonToQuery, username]);

  const importSettingsFromBannerURL = useCallback(async () => {
    const decodeBase64Utf8 = (value: string): string | null => {
      try {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
      } catch {
        return null;
      }
    };

    const rawInput = importLinkValue.trim();

    if (!rawInput) {
      setImportStatus('error');
      setImportStatusText(tl('generator.import.error.empty'));
      return;
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(rawInput);
    } catch {
      try {
        parsedUrl = new URL(rawInput, window.location.origin);
      } catch {
        setImportStatus('error');
        setImportStatusText(tl('generator.import.error.invalid'));
        return;
      }
    }

    const params = parsedUrl.searchParams;
    let importedAnyValue = false;

    if (params.get('username')) {
      setUsername(params.get('username') || username);
      importedAnyValue = true;
    }

    const playerIdFromLink = params.get('player_id') || params.get('playerId');
    if (playerIdFromLink) {
      const playerProfile = await getPlayerProfile(playerIdFromLink);
      if (playerProfile?.nickname) {
        setUsername(playerProfile.nickname);
        importedAnyValue = true;
      }
    }

    if (params.get('lang')) {
      const selectedLanguage =
        languages.find((language) => language.id === params.get('lang')) ||
        language;
      setLanguage(selectedLanguage);
      importedAnyValue = true;
    }

    const parseBooleanFromQuery = (raw: string): boolean | null => {
      const normalized = raw.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off'].includes(normalized)) return false;
      return null;
    };

    (
      Object.entries(SETTINGS_DEFINITIONS) as [SettingKey, SettingDefinition][]
    ).forEach(([key, definition]) => {
      if (!definition.query || definition.query.length === 0) {
        return;
      }

      for (const queryKey of definition.query) {
        const valueFromQuery = params.get(queryKey);
        if (!valueFromQuery) {
          continue;
        }

        let parsedValue: SettingValue;
        if (
          definition.type === 'number' ||
          definition.type === 'ranking_state'
        ) {
          const number =
            definition.type === 'ranking_state'
              ? parseInt(valueFromQuery)
              : parseFloat(valueFromQuery);
          if (Number.isNaN(number)) {
            continue;
          }
          parsedValue = number;
        } else if (definition.type === 'boolean') {
          const boolValue = parseBooleanFromQuery(valueFromQuery);
          if (boolValue === null) {
            continue;
          }
          parsedValue = boolValue;
        } else {
          if (key === 'customInlineCSS') {
            parsedValue =
              queryKey === 'inline_css_b64'
                ? decodeBase64Utf8(valueFromQuery) || ''
                : valueFromQuery;
          } else {
            parsedValue = valueFromQuery;
          }
        }

        if (setSetting(key, parsedValue as SettingValueType<typeof key>)) {
          importedAnyValue = true;
        }
        break;
      }
    });

    const importedStats = params.get('stats')?.split(',') || [];
    if (importedStats[0]) {
      importedAnyValue =
        setSetting('statSlot1', importedStats[0] as Settings['statSlot1']) ||
        importedAnyValue;
    }
    if (importedStats[1]) {
      importedAnyValue =
        setSetting('statSlot2', importedStats[1] as Settings['statSlot2']) ||
        importedAnyValue;
    }
    if (importedStats[2]) {
      importedAnyValue =
        setSetting('statSlot3', importedStats[2] as Settings['statSlot3']) ||
        importedAnyValue;
    }
    if (importedStats[3]) {
      importedAnyValue =
        setSetting('statSlot4', importedStats[3] as Settings['statSlot4']) ||
        importedAnyValue;
    }

    const rawBorderWidth =
      params.get('border_width') || params.get('width') || params.get('bw');
    if (rawBorderWidth) {
      const parsedBorderWidth = parseFloat(rawBorderWidth);
      if (!Number.isNaN(parsedBorderWidth)) {
        setSetting('colorScheme', 'custom');
        setSetting('adjustBorderWidth', true);
        importedAnyValue =
          setSetting('borderWidth', parsedBorderWidth) || importedAnyValue;
      }
    }

    if (!importedAnyValue) {
      setImportStatus('error');
      setImportStatusText(tl('generator.import.error.no_settings'));
      return;
    }

    setSetting(
      'bannerDesign',
      params.get('design') === '2026' ? '2026' : 'legacy'
    );
    setImportStatus('success');
    setImportStatusText(tl('generator.import.success'));
  }, [importLinkValue, language, setSetting, tl, username]);

  const clearCache = useCallback(() => {
    if (!window.confirm(tl('generator.cache.confirm'))) {
      return;
    }

    const keysToRemove = [
      'fcw_generator_username',
      'fcw_generator_settings',
      'fcw_lang',
      'fcw_session_start',
      'fcw_session_end',
      'fcw_session_player-id',
      'fcw_session_starting-elo',
    ];

    keysToRemove.forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  }, [tl]);

  const tabs = [
    {
      name: tl('generator.settings.title'),
      component: (
        <MainTab
          key={'main'}
          playerExists={playerExists}
          username={username}
          playerAvatar={playerAvatar}
          language={language}
          setUsername={setUsername}
          setPlayerElo={setPlayerElo}
          setPlayerLevel={setPlayerLevel}
          setPlayerAvatar={setPlayerAvatar}
          setPlayerBanner={setPlayerBanner}
          setPlayerRegion={setPlayerRegion}
          setPlayerCountry={setPlayerCountry}
          setPlayerVerifiedBadge={setPlayerVerifiedBadge}
          setPlayerExists={setPlayerExists}
          setLanguage={setLanguage}
          setSelectedTabIndex={selectTab}
          opponent={opponent}
          setOpponent={setOpponent}
        />
      ),
    },
    {
      name: tl('generator.theme.title'),
      component: (
        <StyleTab
          key={'style'}
          username={username}
          playerAvatar={playerAvatar}
          playerBanner={playerBanner}
        />
      ),
    },
    {
      name: tl('generator.stats.title'),
      component: <StatisticsTab key={'stats'} />,
    },
  ];

  return (
    <LanguageContext.Provider value={tl}>
      <SettingsContext.Provider
        value={{ settings, get: getSetting, set: setSetting }}
      >
        <GeneratedWidgetModal
          language={language}
          url={generatedURL}
          mode={generatedURLMode}
          setURL={setGeneratedURL}
        />
        <header className="studio-sidebar">
          <a
            className="studio-brand"
            href="/"
            aria-label="FACEIT Banner Studio"
          >
            <span className="studio-mark" aria-hidden="true">
              <StudioIcon name="layers" />
            </span>
            <span>
              Banner<span className="brand-subtitle">STUDIO / FACEIT</span>
            </span>
          </a>
          <p className="nav-caption">{tl('studio.workspace')}</p>
          {import.meta.env.VITE_IS_TESTING && (
            <InfoBox
              content={
                <p>
                  {tl('generator.testing')}{' '}
                  <a href="https://faceitbanner.vxh.pl">
                    {tl('generator.testing.stable')}
                  </a>
                </p>
              }
              style={'info'}
            />
          )}
          <nav className={'tabs'} aria-label={tl('studio.workspace')}>
            {tabs.map((tab, index) => {
              return (
                <button
                  key={tab.name}
                  aria-label={tab.name}
                  title={tab.name}
                  aria-current={index === selectedTabIndex ? 'page' : undefined}
                  onClick={() => {
                    selectTab(index);
                  }}
                  className={index === selectedTabIndex ? 'active' : ''}
                >
                  <StudioIcon
                    name={(['settings', 'palette', 'stats'] as const)[index]}
                  />
                  <span>{tab.name}</span>
                  <StudioIcon name="chevron" />
                </button>
              );
            })}
            <a
              className="docs-tab hub-tab"
              href="https://vxh.pl/"
              title={tl('studio.hub')}
              aria-label={tl('studio.hub')}
            >
              <StudioIcon name="home" />
              <span>{tl('studio.hub')}</span>
            </a>
            <a
              className="docs-tab"
              href="/docs/"
              title={tl('studio.docs')}
              aria-label={tl('studio.docs')}
            >
              <StudioIcon name="book" />
              <span>{tl('studio.docs')}</span>
              <StudioIcon name="arrow" />
            </a>
          </nav>
          <div
            className="sidebar-lang"
            role="group"
            aria-label={tl('generator.settings.language')}
          >
            {languages.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={entry.id === language.id}
                title={tl(`language.label.${entry.id}`)}
                onClick={() => {
                  setLanguage(entry);
                  localStorage.setItem('fcw_lang', entry.id);
                }}
              >
                <img
                  className="flag"
                  src={`https://flagcdn.com/${entry.id === 'en' ? 'gb' : entry.id}.svg`}
                  alt=""
                />
                <span>{tl(`language.label.${entry.id}`)}</span>
              </button>
            ))}
          </div>
          <OnlineBannerCount />
          <div className="sidebar-note">
            <span className="game-label">CS2</span>
            <p>{tl('studio.sidebar_note')}</p>
            <small>by Skull</small>
          </div>
        </header>
        <div className="studio-workspace">
          <div className="studio-topbar">
            <span>
              {tl('studio.workspace')}{' '}
              <span className="breadcrumb-divider">/</span>{' '}
              <strong>{tabs[selectedTabIndex].name}</strong>
            </span>
            <span className="obs-tag">
              <StudioIcon name="monitor" />
              OBS STUDIO
            </span>
          </div>
          <div className="studio-heading">
            <div>
              <p className="studio-eyebrow">FACEIT / COUNTER-STRIKE 2</p>
              <h1>{tl('studio.title')}</h1>
              <p>{tl('studio.description')}</p>
            </div>
            <span className="studio-heading-symbol" aria-hidden="true">
              <StudioIcon name="layers" />
            </span>
          </div>
          <main className="studio-main">
            <section
              className={'fixed-width'}
              aria-labelledby="studio-settings-title"
            >
              <div className="section-heading">
                <h2 id="studio-settings-title">
                  {tabs[selectedTabIndex].name}
                </h2>
                <span>{tl('studio.settings_hint')}</span>
              </div>
              <div className="tab-content" key={selectedTabIndex}>
                {tabs[selectedTabIndex].component}
              </div>
              <div className={'cache-reset-row'}>
                <button className={'cache-reset-button'} onClick={clearCache}>
                  {tl('generator.cache.clear')}
                </button>
              </div>
            </section>
            <section className={'preview'}>
              <div className={'settings preview-card'}>
                <div className="preview-heading">
                  <h2>
                    <StudioIcon name="monitor" />
                    {translate(language, 'generator.preview.title')}
                  </h2>
                  <span className="live-label">
                    <i />
                    {tl('studio.live')}
                  </span>
                </div>
                <div className="preview-stage">
                  <div
                    key={previewBackground}
                    className="preview-scene"
                    style={{
                      backgroundImage: `url(${PREVIEW_BACKGROUNDS[previewBackground]})`,
                    }}
                  />
                  <span className="scene-label">
                    CS2<span>/</span>
                    {tl(`generator.preview.${previewBackground}`)}
                  </span>
                  <div
                    className={`${resolveBannerStyle(getSetting('style'), getSetting('bannerDesign'))}-theme ${getSetting('colorScheme')}-scheme preview ${previewBackground}`}
                  >
                    {(getSetting('style') !== 'custom' ||
                      (getSetting('style') === 'custom' &&
                        getSetting('customCSS') !== 'https://example.com')) && (
                      <Widget
                        preview={true}
                        introReplay={introReplay}
                        previewAvatar={playerAvatar}
                        previewBanner={playerBanner}
                        previewUsername={username}
                        previewRegion={playerRegion}
                        previewCountry={playerCountry}
                        previewVerifiedBadge={playerVerifiedBadge}
                        previewElo={playerElo}
                        previewLevel={playerLevel}
                        previewLanguage={language}
                        previewOpponent={opponent}
                      />
                    )}
                  </div>
                </div>
                <PreviewCarousel
                  language={language}
                  previewBackground={previewBackground}
                  setPreviewBackground={setPreviewBackground}
                />
                <p className="preview-caption">{tl('studio.preview_hint')}</p>
                {getSetting('showUpdateIntro') && (
                  <button
                    className="secondary-link intro-replay"
                    onClick={() => setIntroReplay((value) => value + 1)}
                  >
                    {tl('studio.replay_intro')}
                  </button>
                )}
                <div className="export-heading">
                  <h3>{tl('studio.export_title')}</h3>
                  <span>OBS · Streamlabs</span>
                </div>
                <div className={'flex export-actions'}>
                  <button
                    className={'with-icon primary-action'}
                    onClick={() => {
                      generateWidgetURL();
                    }}
                  >
                    <TimelineIcon />
                    {tl('studio.generate')}
                    <StudioIcon name="arrow" />
                  </button>
                  <button
                    className={'with-icon'}
                    onClick={() => {
                      copySettingsURLToClipboard();
                    }}
                  >
                    <ShareIcon />
                    {tl('generator.share.button')}
                  </button>
                </div>
                <details className="import-settings">
                  <summary>{tl('studio.import')}</summary>
                  <div className={'import-link-row'}>
                    <input
                      type={'text'}
                      aria-label={tl('generator.import.placeholder')}
                      value={importLinkValue}
                      onChange={(event) => {
                        setImportLinkValue(event.target.value);
                        if (importStatus) {
                          setImportStatus(null);
                          setImportStatusText('');
                        }
                      }}
                      placeholder={tl('generator.import.placeholder')}
                    />
                    <button onClick={importSettingsFromBannerURL}>
                      {tl('generator.import.button')}
                    </button>
                  </div>
                </details>
                {shareCopied && (
                  <small style={{ display: 'block', marginTop: '8px' }}>
                    {tl('generator.share.copied_to_clipboard')}
                  </small>
                )}
                {importStatus && (
                  <small
                    className={
                      importStatus === 'success'
                        ? 'import-status success'
                        : 'import-status error'
                    }
                  >
                    {importStatusText}
                  </small>
                )}
              </div>
              <div className="obs-guide">
                <span className="guide-icon">
                  <StudioIcon name="monitor" />
                </span>
                <div>
                  <h3>{tl('studio.obs_title')}</h3>
                  <p>{tl('studio.obs_help')}</p>
                </div>
              </div>
              <div className={'social-links-wrap'}>
                <p className={'social-links-label'}>
                  {tl('generator.socials')}
                </p>
                <div className={'social-links'}>
                  <a
                    href={'https://www.twitch.tv/skullboypl'}
                    target={'_blank'}
                    rel={'noreferrer'}
                    title={'Twitch'}
                  >
                    <BrandTwitchIcon />
                  </a>
                  <a
                    href={'https://www.youtube.com/watch?v=IcJNgxAH2Ps'}
                    target={'_blank'}
                    rel={'noreferrer'}
                    title={'YouTube'}
                  >
                    <BrandYoutubeIcon />
                  </a>
                  <a
                    href={'https://discord.skullmedia.pl'}
                    target={'_blank'}
                    rel={'noreferrer'}
                    title={'Discord'}
                  >
                    <BrandDiscordIcon />
                  </a>
                  <a
                    href={'https://www.tiktok.com/@skullboypl'}
                    target={'_blank'}
                    rel={'noreferrer'}
                    title={'TikTok'}
                  >
                    <BrandTiktokIcon />
                  </a>
                </div>
                <div className={'mini-promo'}>
                  <p>{tl('generator.recommended')}</p>
                  <a
                    className={'smoothwizard-promo'}
                    href={'https://smoothwizard.com/'}
                    target={'_blank'}
                    rel={'noreferrer'}
                  >
                    <img
                      src={
                        'https://smoothwizard.com/wp-content/uploads/2023/12/SmoothWizard-Logo-e1701539638732.png'
                      }
                      alt={'SmoothWizard'}
                    />
                    <span>
                      <strong>{tl('generator.smoothwizard.title')}</strong>
                      <small>{tl('generator.smoothwizard.subtitle')}</small>
                    </span>
                  </a>
                </div>
              </div>
            </section>
          </main>
          <Footer />
        </div>
      </SettingsContext.Provider>
    </LanguageContext.Provider>
  );
};
