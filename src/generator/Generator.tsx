import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LanguageContext, SettingsContext } from './contexts.ts';
import { toQueryString, widgetQueryParams } from '../settings/widget-query';
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
import { CookieNotice } from '../components/CookieNotice.tsx';
import { PreviewCarousel } from '../components/PreviewCarousel.tsx';
import { StudioIcon } from '../components/StudioIcon.tsx';
import { StudioBrand } from '../components/StudioBrand.tsx';
import { LiveRanking } from '../live/LiveRanking.tsx';
import { TwitchStreamers } from '../live/TwitchStreamers.tsx';
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
import { ObsMonitor } from '../components/ObsMonitor.tsx';
import { lookFor, popupCardWidth, popupCloseUp, readPopupOptions } from '../../widget/src/widget/popup-options';
import type { PopupPhase } from '../../widget/src/widget/popup-options';
import { ConflictDialog } from '../components/ConflictDialog.tsx';
import { DonateLink } from '../components/DonateLink.tsx';
import { MyBannersPanel } from '../components/MyBannersPanel.tsx';
import { ProfilePanel } from '../components/ProfilePanel.tsx';
import { AccountMenu } from '../components/AccountMenu.tsx';
import { LanguageSelect } from '../components/LanguageSelect.tsx';
import { MobileMenu } from '../components/MobileMenu.tsx';
import { FeedbackBoard } from '../feedback/FeedbackBoard.tsx';
import { pickLanguage } from '../translations/detect.ts';
import { useCloudSync, WORKSPACE_RESET_KEY } from '../cloud/useCloudSync.ts';
import { logout as apiLogout } from '../cloud/api.ts';
import { useSession } from '../cloud/useSession.ts';
import {
  defaultBannerCatalog,
  normalizeBannerCatalog,
  type BannerCatalog,
} from '../../shared/banner-catalog.mjs';
import { getPlayerProfile } from '../../widget/src/utils/faceit_util.ts';
import { formatMenuCount, getLiveBoard, LIVE_LIST_REFRESH_MS, subscribeLiveStreamerCount, subscribeOnlineCount } from '../utils/presence.ts';

export { LanguageContext, SettingsContext } from './contexts.ts';

const DEFAULT_GENERATOR_USERNAME = 'donk666';
/** Tabs pinned to the phone's bottom bar; the rest live in the full-screen menu. */
const PINNED_TABS = 3;
/** The feedback board needs the whole width, so it hides the widget preview. */
const FEEDBACK_TAB_INDEX = 4;
const TAB_ICONS = ['settings', 'palette', 'stats', 'cloud', 'message'] as const;
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
  const [playerCalibrating, setPlayerCalibrating] = useState(false);
  const [playerAvatar, setPlayerAvatar] = useState<string | undefined>();
  const [playerBanner, setPlayerBanner] = useState<string | undefined>();
  const [playerRegion, setPlayerRegion] = useState<string | undefined>();
  const [playerCountry, setPlayerCountry] = useState<string | undefined>();
  const [playerVerifiedBadge, setPlayerVerifiedBadge] =
    useState<VerifiedBadgeType>('none');
  const [searchParams] = useSearchParams();
  const [language, setLanguage] = useState<Language>(() =>
    pickLanguage(
      {
        param: searchParams.get('lang'),
        saved: localStorage.getItem('fcw_lang'),
        browser: navigator.languages?.length
          ? navigator.languages
          : [navigator.language],
      },
      languages
    )
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

  const pathname = useLocation().pathname;
  const onLive = pathname === '/live';
  const onStreamers = pathname === '/streamers';
  const onPublicPage = onLive || onStreamers;
  const [liveStreamerCount, setLiveStreamerCount] = useState<number | null>(null);
  const [onlineBannerCount, setOnlineBannerCount] = useState<number | null>(null);
  const navigate = useNavigate();
  const [selectedTabIndex, setSelectedTabIndex] = useState(() => {
    const value = Number(new URLSearchParams(window.location.search).get('tab'));
    return Number.isInteger(value) && value >= 0 && value <= 4 ? value : 0;
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compactSidebar, setCompactSidebar] = useState(() =>
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(min-width: 701px) and (max-width: 1280px)').matches
  );
  const [compactSidebarOpen, setCompactSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('fcw_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const sidebarExpanded = compactSidebar ? compactSidebarOpen : !sidebarCollapsed;
  useEffect(() => subscribeOnlineCount(setOnlineBannerCount), []);
  useEffect(() => {
    let active = true;
    let pending = false;
    const controller = new AbortController();
    const unsubscribe = subscribeLiveStreamerCount((count) => {
      if (active) setLiveStreamerCount(count);
    });
    const refresh = async () => {
      if (onPublicPage || document.hidden || pending) return;
      pending = true;
      try {
        await getLiveBoard(controller.signal);
      } catch {
        /* The menu count is optional when the public list is unavailable. */
      } finally {
        pending = false;
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, LIVE_LIST_REFRESH_MS);
    const onVisibility = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribe();
    };
  }, [onPublicPage]);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(min-width: 701px) and (max-width: 1280px)');
    const update = () => {
      setCompactSidebar(media.matches);
      if (!media.matches) setCompactSidebarOpen(false);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!compactSidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCompactSidebarOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', close);
    };
  }, [compactSidebarOpen]);
  const toggleSidebar = useCallback(() => {
    if (compactSidebar) {
      setCompactSidebarOpen((open) => !open);
      return;
    }
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      try {
        localStorage.setItem('fcw_sidebar_collapsed', next ? '1' : '0');
      } catch {
        /* The preference is optional when storage is blocked. */
      }
      return next;
    });
  }, [compactSidebar]);
  const [introReplay, setIntroReplay] = useState(0);
  const selectTab = useCallback((index: number) => {
    setCompactSidebarOpen(false);
    setSelectedTabIndex(index);
    const params = new URLSearchParams(window.location.search);
    if (onPublicPage || params.get('panel') || params.get('tab') !== String(index)) {
      navigate(`/?tab=${index}`);
    }
    if (window.matchMedia('(max-width: 1000px)').matches) {
      requestAnimationFrame(() => {
        document
          .getElementById('studio-settings-title')
          ?.scrollIntoView({ block: 'start' });
      });
    } else {
      document.getElementById('root')?.scrollTo({ top: 0 });
    }
  }, [navigate, onPublicPage]);
  const openProfile = useCallback(() => {
    setCompactSidebarOpen(false);
    navigate('/?panel=profile');
    document.getElementById('root')?.scrollTo({ top: 0 });
  }, [navigate]);
  const showProfile = !onPublicPage && searchParams.get('panel') === 'profile';

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

  const session = useSession();
  const [catalog, setCatalog] = useState<BannerCatalog>(defaultBannerCatalog);
  useEffect(() => {
    let cancel = false;
    fetch('/api/catalog', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!cancel && body?.modes) setCatalog(normalizeBannerCatalog(body.modes));
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = language.id;
  }, [language]);
  const applyCloudSettings = useCallback(
    (cloud: Partial<Settings>) => {
      for (const [key, value] of Object.entries(cloud)) {
        setSetting(key as SettingKey, value as never);
      }
    },
    [setSetting]
  );
  const cloudSync = useCloudSync(settings, applyCloudSettings, session.user);

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

  const buildSettingsQueryParams = useCallback(
    () => widgetQueryParams((key) => getSetting(key), language.id),
    [getSetting, language]
  );

  const generateWidgetURL = useCallback(() => {
    const params = buildSettingsQueryParams();
    setGeneratedURLMode('widget');
    setGeneratedURL(
      `${window.location.protocol}//${window.location.host}/widget/${jsonToQuery(params)}`
    );
  }, [buildSettingsQueryParams]);

  const jsonToQuery = toQueryString;

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

    // The account copy holds every mode. Mark the reset first so a pending save cannot
    // put the old workspace back, then let the next load write defaults. Saved banners stay.
    localStorage.setItem(WORKSPACE_RESET_KEY, '1');
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
          setPlayerCalibrating={setPlayerCalibrating}
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
          accountNickname={session.user?.nickname}
          accountGuid={session.user?.guid}
          admin={session.admin}
          catalog={catalog}
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
    {
      name: tl('banners.title'),
      component: <MyBannersPanel key={'banners'} user={session.user} />,
    },
    {
      name: tl('feedback.title'),
      component: (
        <FeedbackBoard
          key={'feedback'}
          user={session.user}
          admin={session.admin}
        />
      ),
    },
  ];

  /* Popup mode: close-up preview, plus a small OBS monitor that always shows the whole 1920 x 1080 source */
  const isPopupMode = getSetting('widgetMode') === 'popup';
  const popupPhase = ((getSetting('popupPreview') as PopupPhase) || 'live') as PopupPhase;
  const popupOptions = readPopupOptions((key) => getSetting(key as SettingKey));
  const popupView = lookFor(popupOptions, popupPhase);
  const popupCardPx = popupCardWidth(popupOptions, popupPhase);
  const popupSizeKey = `${popupCardPx}|${popupView.scale}|${JSON.stringify(popupView.fonts[popupView.layout] ?? {})}`;
  const [popupResizing, setPopupResizing] = useState(false);
  const popupSizeSeen = useRef(popupSizeKey);
  /* While the size is being changed the main preview shows the whole frame, so the change can be judged in place */
  useEffect(() => {
    if (popupSizeSeen.current === popupSizeKey) return;
    popupSizeSeen.current = popupSizeKey;
    setPopupResizing(true);
    const timer = window.setTimeout(() => setPopupResizing(false), 1600);
    return () => window.clearTimeout(timer);
  }, [popupSizeKey]);
  /* The card is measured on the monitor, where the whole frame is visible, and the close-up is fitted to what was measured */
  const monitorScreen = useRef<HTMLDivElement | null>(null);
  const [cardShare, setCardShare] = useState<{ width: number; height: number }>();
  useLayoutEffect(() => {
    if (!isPopupMode) return;
    const screen = monitorScreen.current;
    const article = screen?.querySelector('.match-popup article');
    const frame = screen?.querySelector('.wrapper');
    if (!article || !frame) return;
    const measure = () => {
      const f = frame.getBoundingClientRect();
      const a = article.getBoundingClientRect();
      if (f.width <= 0 || f.height <= 0) return;
      const next = { width: Math.round((a.width / f.width) * 1000) / 1000, height: Math.round((a.height / f.height) * 1000) / 1000 };
      setCardShare((prev) => (prev && prev.width === next.width && prev.height === next.height ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(article);
    observer.observe(frame);
    return () => observer.disconnect();
  });
  const popupZoom = popupCloseUp(popupOptions, popupPhase, cardShare);

  const previewStage = (
    <>
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
          getSetting('customCSS') !==
            'https://example.com')) && (
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
          previewCalibrating={playerCalibrating}
          previewLanguage={language}
          previewOpponent={opponent}
        />
      )}
    </div>
    </>
  );

  return (
    <LanguageContext.Provider value={tl}>
      <SettingsContext.Provider
        value={{ settings, get: getSetting, set: setSetting }}
      >
        <ConflictDialog conflict={cloudSync.conflict} />
        <MobileMenu
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          tabs={tabs.map((tab, index) => ({
            name: tab.name,
            icon: TAB_ICONS[index],
          }))}
          selectedIndex={selectedTabIndex}
          onSelectTab={selectTab}
          languages={languages}
          currentLanguage={language}
          onLanguage={(entry) => {
            setLanguage(entry);
            localStorage.setItem('fcw_lang', entry.id);
          }}
          user={session.user}
          admin={session.admin}
          syncState={cloudSync.state}
          lastSavedAt={cloudSync.lastSavedAt}
          onLogout={() => {
            void apiLogout()
              .catch(() => undefined)
              .finally(session.refresh);
          }}
          onOpenProfile={openProfile}
          liveStreamerCount={liveStreamerCount}
          onlineBannerCount={onlineBannerCount}
        />
        <GeneratedWidgetModal
          language={language}
          url={generatedURL}
          mode={generatedURLMode}
          setURL={setGeneratedURL}
        />
        <header className={`studio-sidebar ${sidebarExpanded ? 'is-expanded' : 'is-collapsed'}${compactSidebar ? ' is-compact' : ''}`}>
          <StudioBrand />
          <div className="mobile-header-live" aria-label={tl('menu.community')}>
            <Link
              className="mobile-header-live-item mobile-header-live-item--streamers"
              to="/streamers"
              aria-current={onStreamers ? 'page' : undefined}
              onClick={() => setCompactSidebarOpen(false)}
            >
              <i className="stream-menu-dot" aria-hidden="true" />
              <span>
                <strong>{formatMenuCount(liveStreamerCount)}</strong>
                <small>{tl('streamers.title')}</small>
              </span>
            </Link>
            <Link
              className="mobile-header-live-item mobile-header-live-item--banners"
              to="/live"
              aria-current={onLive ? 'page' : undefined}
              onClick={() => setCompactSidebarOpen(false)}
            >
              <span className="online-pulse" aria-hidden="true"><i /></span>
              <span>
                <strong>{formatMenuCount(onlineBannerCount)}</strong>
                <small>{tl('studio.online_banners')}</small>
              </span>
            </Link>
          </div>
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
            <button
              type="button"
              className="sidebar-collapse-toggle"
              aria-label={sidebarExpanded ? tl('menu.close') : tl('menu.open')}
              title={sidebarExpanded ? tl('menu.close') : tl('menu.open')}
              aria-expanded={sidebarExpanded}
              onClick={toggleSidebar}
            >
              <StudioIcon name="chevron" />
              <span>{sidebarExpanded ? tl('menu.close') : tl('menu.open')}</span>
            </button>
            <span className="nav-group-label">{tl('menu.banner_settings')}</span>
            {tabs.slice(0, PINNED_TABS).map((tab, index) => {
              return (
                <button
                  key={tab.name}
                  aria-label={tab.name}
                  title={tab.name}
                  aria-current={!onPublicPage && !showProfile && index === selectedTabIndex ? 'page' : undefined}
                  data-overflow={index >= PINNED_TABS ? 'true' : undefined}
                  onClick={() => {
                    selectTab(index);
                    if (onPublicPage) navigate(`/?tab=${index}`);
                  }}
                  className={!onPublicPage && !showProfile && index === selectedTabIndex ? 'active' : ''}
                >
                  <StudioIcon name={TAB_ICONS[index]} />
                  <span>{tab.name}</span>
                  <StudioIcon name="chevron" />
                </button>
              );
            })}
            <span className="nav-group-label">{tl('menu.additional')}</span>
            {tabs.slice(PINNED_TABS).map((tab, offset) => {
              const index = offset + PINNED_TABS;
              return (
                <button
                  key={tab.name}
                  aria-label={tab.name}
                  title={tab.name}
                  aria-current={!onPublicPage && !showProfile && index === selectedTabIndex ? 'page' : undefined}
                  data-overflow="true"
                  onClick={() => {
                    selectTab(index);
                    if (onPublicPage) navigate(`/?tab=${index}`);
                  }}
                  className={!onPublicPage && !showProfile && index === selectedTabIndex ? 'active' : ''}
                >
                  <StudioIcon name={TAB_ICONS[index]} />
                  <span>{tab.name}</span>
                  <StudioIcon name="chevron" />
                </button>
              );
            })}
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
            <a className="sidebar-hub-link" href="https://vxh.pl/" title={tl('studio.hub')}>
              <StudioIcon name="home" />
              <span>{tl('studio.hub')}</span>
              <StudioIcon name="arrow" />
            </a>
            <span className="nav-group-label nav-group-label--community">{tl('menu.community')}</span>
            <Link
              className={`docs-tab streamers-tab${onStreamers ? ' active' : ''}`}
              to="/streamers"
              title={tl('streamers.title')}
              aria-label={tl('streamers.title')}
              aria-current={onStreamers ? 'page' : undefined}
              onClick={() => setCompactSidebarOpen(false)}
            >
              <div className="streamer-menu-signal" aria-hidden="true">
                <i className="stream-menu-dot" />
              </div>
              <div className="streamer-menu-copy">
                <strong>{formatMenuCount(liveStreamerCount)}</strong>
                <span>{tl('streamers.title')}</span>
              </div>
              <small>{tl('streamers.online_short')}</small>
            </Link>
            <OnlineBannerCount />
            <button
              type="button"
              className="mobile-menu-toggle"
              aria-label={tl('menu.open')}
              aria-haspopup="dialog"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
            >
              <StudioIcon name="menu" />
              <span>{tl('menu.title')}</span>
            </button>
          </nav>
          <div className="sidebar-foot">
            <DonateLink variant="header" />
            <LanguageSelect
              languages={languages}
              current={language}
              onChange={(entry) => {
                setLanguage(entry);
                localStorage.setItem('fcw_lang', entry.id);
              }}
            />
          </div>
          <div className="sidebar-note">
            <span className="game-label">CS2</span>
            <p>{tl('studio.sidebar_note')}</p>
            <small>by Skull</small>
          </div>
        </header>
        {compactSidebar && compactSidebarOpen && (
          <button
            type="button"
            className="sidebar-overlay"
            aria-label={tl('menu.close')}
            onClick={() => setCompactSidebarOpen(false)}
          />
        )}
        <div className="studio-workspace">
          <div className="studio-topbar">
            <span>
              {tl('studio.workspace')}{' '}
              <span className="breadcrumb-divider">/</span>{' '}
              <strong>{onStreamers ? tl('streamers.title') : onLive ? tl('live.title') : showProfile ? tl('account.profile') : tabs[selectedTabIndex].name}</strong>
            </span>
            <span className="topbar-right">
              <span className="obs-tag">
                <StudioIcon name="monitor" />
                OBS STUDIO
              </span>
              <AccountMenu
                user={session.user}
                admin={session.admin}
                loading={session.loading}
                syncState={cloudSync.state}
                lastSavedAt={cloudSync.lastSavedAt}
                onOpenBanners={() => selectTab(3)}
                onOpenProfile={openProfile}
                onLogout={() => {
                  void apiLogout()
                    .catch(() => undefined)
                    .finally(session.refresh);
                }}
              />
            </span>
          </div>
          <div className="studio-heading">
            <div>
              <p className="studio-eyebrow">FACEIT / COUNTER-STRIKE 2</p>
              <h1>{onStreamers ? tl('streamers.title') : tl('studio.title')}</h1>
              <p>{onStreamers ? tl('streamers.lead') : tl('studio.description')}</p>
            </div>
            <span className="studio-heading-symbol" aria-hidden="true">
              <StudioIcon name="layers" />
            </span>
          </div>
            <main
            className={`studio-main${onLive ? ' studio-main--live' : onStreamers ? ' studio-main--streamers' : selectedTabIndex === FEEDBACK_TAB_INDEX && !showProfile ? ' studio-main--wide' : ''}`}
          >
            <section
              className={'fixed-width'}
              aria-labelledby="studio-settings-title"
            >
              <div className="section-heading">
                <h2 id="studio-settings-title">
                  {onStreamers ? tl('streamers.title') : onLive ? tl('live.title') : showProfile ? tl('account.profile') : tabs[selectedTabIndex].name}
                </h2>
                <span>{onStreamers ? tl('streamers.section_lead') : onLive ? tl('live.lead') : tl('studio.settings_hint')}</span>
              </div>
              <div className="tab-content" key={onStreamers ? 'streamers' : onLive ? 'live' : showProfile ? 'profile' : selectedTabIndex}>
                {onStreamers ? <TwitchStreamers /> : onLive ? <LiveRanking /> : showProfile ? <ProfilePanel /> : tabs[selectedTabIndex].component}
              </div>
            </section>
            {!onPublicPage && (showProfile || selectedTabIndex !== FEEDBACK_TAB_INDEX) && (
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
                    <span className="preview-reset">
                      <button
                        type="button"
                        className="cache-reset-button"
                        onClick={clearCache}
                      >
                        {tl('generator.cache.clear')}
                      </button>
                      <span
                        className="badge help"
                        role="img"
                        tabIndex={0}
                        title={tl('generator.cache.tooltip')}
                        aria-label={tl('generator.cache.tooltip')}
                      >
                        ?
                      </span>
                    </span>
                  </div>
                  {isPopupMode ? (
                    <div className="popup-closeup">
                      <div
                        className="preview-stage"
                        style={{
                          transform: `scale(${popupResizing ? 1 : popupZoom.zoom})`,
                          transformOrigin: popupZoom.origin,
                        }}
                      >
                        {previewStage}
                      </div>
                    </div>
                  ) : (
                    <div className="preview-stage">{previewStage}</div>
                  )}
                  {isPopupMode && (
                    <div className="obs-monitor-card">
                      <ObsMonitor cardWidth={popupCardPx} screenRef={(element) => (monitorScreen.current = element)}>
                        <div className="preview-stage">{previewStage}</div>
                      </ObsMonitor>
                      <p className="subtext">{tl('obs.monitor.hint')}</p>
                    </div>
                  )}
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
            )}
          </main>
          <Footer />
          <CookieNotice />
        </div>
      </SettingsContext.Provider>
    </LanguageContext.Provider>
  );
};
