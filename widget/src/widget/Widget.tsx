const percentToFontWeight = (value: number) => {
  const clamped = Math.max(0, Math.min(100, value));
  return Math.round(100 + (clamped / 100) * 800);
};
import { Statistic } from '../components/Statistic.tsx';
import { UpdateIntro } from '../components/UpdateIntro.tsx';
import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  CSSProperties,
  useMemo,
  useLayoutEffect,
  ReactElement,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Language,
  languages,
  tl,
} from '../../../src/translations/translations.ts';
import { getPlayerStats, VerifiedBadgeType } from '../utils/faceit_util.ts';
import {
  BannerSizeMode,
  getBannerSizeLimits,
  getRecommendedWidth,
  resolveBannerSize,
} from '../utils/banner_size.ts';
import { Level1 } from '../components/levels/Level1.tsx';
import { Level2 } from '../components/levels/Level2.tsx';
import { Level3 } from '../components/levels/Level3.tsx';
import { Level4 } from '../components/levels/Level4.tsx';
import { Level5 } from '../components/levels/Level5.tsx';
import { Level6 } from '../components/levels/Level6.tsx';
import { Level7 } from '../components/levels/Level7.tsx';
import { Level8 } from '../components/levels/Level8.tsx';
import { Level9 } from '../components/levels/Level9.tsx';
import { Level10 } from '../components/levels/Level10.tsx';
import { Challenger } from '../components/levels/Challenger.tsx';

import { StatisticType } from '../../../src/generator/tabs/StatisticsTab.tsx';

import '../styles/themes/normal.less';
import '../styles/themes/animated.less';
import '../styles/themes/rounded.less';
import '../styles/themes/compact.less';
import '../styles/themes/rounded-compact.less';
import '../styles/themes/radar.less';
import '../styles/themes/classic.less';
const BANNER_RADIUS_MAP: Record<string, number> = {
  normal: 12,
  rounded: 16,
  'rounded-compact': 20,
  compact: 12,
  radar: 100,
  classic: 6,
  amoled: 12,
  aurora: 16,
  auroraflow: 16,
  banner: 12,
  card: 14,
  circle: 50,
  circuit: 14,
  glass: 16,
  horizon: 10,
  justelo: 12,
  justelomatches: 12,
  justelomatchesname: 12,
  justeloname: 12,
  neon: 14,
  photon: 16,
  pulsegrid: 14,
  ripple: 50,
  sidebar: 12,
  split: 12,
  stack: 12,
  terminal: 8,
};

// NEW themes
import '../styles/themes/amoled.less';
import '../styles/themes/aurora.less';
import '../styles/themes/auroraflow.less';
import '../styles/themes/banner.less';
import '../styles/themes/card.less';
import '../styles/themes/circle.less';
import '../styles/themes/circuit.less';
import '../styles/themes/glass.less';
import '../styles/themes/horizon.less';
import '../styles/themes/justelo.less';
import '../styles/themes/justelomatches.less';
import '../styles/themes/justelomatchesname.less';
import '../styles/themes/justeloname.less';
import '../styles/themes/neon.less';
import '../styles/themes/photon.less';
import '../styles/themes/pulsegrid.less';
import '../styles/themes/radar.less';
import '../styles/themes/ripple.less';
import '../styles/themes/sidebar.less';
import '../styles/themes/split.less';
import '../styles/themes/stack.less';
import '../styles/themes/terminal.less';

import '../styles/color_schemes.less';
import '../styles/banner-2026.less';
import '../styles/broadcast-presets.less';
import '../styles/avatar-presets.less';
import '../styles/ticker-preset.less';
import '../styles/versus-preset.less';
import '../styles/solo-extra.less';
import '../styles/stats-extra.less';
import '../styles/promo-2026.less';
import {
  resolveBannerStyle,
  broadcastPresets,
  isVersusStyle,
} from '../styles/styles';
import { BroadcastDeck, BroadcastSlide } from '../components/BroadcastDeck';
import { SettingsContext } from '../../../src/generator/Generator.tsx';
import { SettingKey, useSettings } from '../../../src/settings/manager.ts';
import { TimelineIcon } from '../../../src/assets/icons/tabler/TimelineIcon.tsx';
import { ArrowUpIcon } from '../../../src/assets/icons/tabler/ArrowUpIcon.tsx';
import { ArrowDownIcon } from '../../../src/assets/icons/tabler/ArrowDownIcon.tsx';
import { VerifiedBadgeIcon } from '../../../src/assets/icons/faceit/VerifiedBadgeIcon.tsx';
import { VerifiedGoldBadgeIcon } from '../../../src/assets/icons/faceit/VerifiedGoldBadgeIcon.tsx';

const REGION_FLAG_MAP: Record<string, string> = {
  EU: 'eu',
};

const levelIcons = [
  <Level1 />,
  <Level2 />,
  <Level3 />,
  <Level4 />,
  <Level5 />,
  <Level6 />,
  <Level7 />,
  <Level8 />,
  <Level9 />,
  <Level10 />,
  <Challenger />,
  <Challenger />,
  <Challenger />,
  <Challenger />,
];

const eloDistribution = [
  ['#eee', 100, 500],
  ['#1CE400', 501, 750],
  ['#1CE400', 751, 900],
  ['#FFC800', 901, 1050],
  ['#FFC800', 1051, 1200],
  ['#FFC800', 1201, 1350],
  ['#FFC800', 1351, 1530],
  ['#FF6309', 1531, 1750],
  ['#FF6309', 1750, 2000],
  ['#FE1F00', 2001],
  ['#e80128', 2001] /* Challenger: 4-1000 */,
  ['#d9a441', 2001] /* Challenger: 1 */,
  ['#c7d0d5', 2001] /* Challenger: 2 */,
  ['#bf7145', 2001] /* Challenger: 3 */,
];

export enum ShowRanking {
  DISABLED = 0,
  SHOW = 1,
  ONLY_WHEN_CHALLENGER = 2,
  COUNTRY = 3,
  BOTH = 4,
}

type AnimatedCardKey = 'header' | 'stats' | 'matches';

const BANNER_FONT_FAMILY_MAP: Record<string, string> = {
  dm_sans: "'DM Sans', sans-serif",
  arial: 'Arial, sans-serif',
  comic_sans_ms: "'Comic Sans MS', cursive",
  courier_new: "'Courier New', monospace",
  garamond: 'Garamond, serif',
  georgia: 'Georgia, serif',
  helvetica: 'Helvetica, Arial, sans-serif',
  impact: 'Impact, sans-serif',
  inter: "'Inter', sans-serif",
  lucida_sans: "'Lucida Sans', sans-serif",
  merriweather: "'Merriweather', serif",
  montserrat: "'Montserrat', sans-serif",
  open_sans: "'Open Sans', sans-serif",
  oswald: "'Oswald', sans-serif",
  palatino_linotype: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
  playfair_display: "'Playfair Display', serif",
  poppins: "'Poppins', sans-serif",
  roboto: "'Roboto', sans-serif",
  segoe_ui: "'Segoe UI', sans-serif",
  tahoma: 'Tahoma, sans-serif',
  times_new_roman: "'Times New Roman', serif",
  trebuchet_ms: "'Trebuchet MS', sans-serif",
  verdana: 'Verdana, sans-serif',
  kick_font: "'KickFont', sans-serif",
};

const hexToRgba = (hexColor: string, opacity: number) => {
  const hex = hexColor.replace('#', '').trim();

  let r = 0;
  let g = 0;
  let b = 0;
  let baseAlpha = 1;

  if (hex.length === 3 || hex.length === 4) {
    r = parseInt(`${hex[0]}${hex[0]}`, 16);
    g = parseInt(`${hex[1]}${hex[1]}`, 16);
    b = parseInt(`${hex[2]}${hex[2]}`, 16);
    if (hex.length === 4) {
      baseAlpha = parseInt(`${hex[3]}${hex[3]}`, 16) / 255;
    }
  } else if (hex.length === 6 || hex.length === 8) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
    if (hex.length === 8) {
      baseAlpha = parseInt(hex.substring(6, 8), 16) / 255;
    }
  }

  const clampedOpacity = Math.max(0, Math.min(1, opacity));
  const alpha = Math.max(0, Math.min(1, baseAlpha * clampedOpacity));

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** How long the session survives after the widget was last open. */
const SESSION_KEEP_MS = 1000 * 60 * 60 * 2;

const percentToFontScale = (value: number) => {
  const clamped = Math.max(0, Math.min(100, value));
  return 0.5 + clamped / 100;
};

/** The second player shown by the VERSUS banners. */
export type VersusPlayer = {
  username: string;
  avatar?: string;
  country?: string;
  elo: number;
  level: number;
  kd: number;
  adr: number;
  winRate: number;
  hs: number;
};

export const Widget = ({
  preview,
  previewAvatar,
  previewBanner,
  previewUsername,
  previewRegion,
  previewCountry,
  previewVerifiedBadge,
  previewElo,
  previewLevel,
  previewLanguage,
  previewOpponent,
  introReplay = 0,
}: {
  preview: boolean;
  previewAvatar?: string;
  previewBanner?: string;
  previewUsername?: string;
  previewRegion?: string;
  previewCountry?: string;
  previewVerifiedBadge?: VerifiedBadgeType;
  previewElo?: number;
  previewLevel?: number;
  previewLanguage?: Language;
  previewOpponent?: VersusPlayer;
  introReplay?: number;
}) => {
  const [username, setUsername] = useState<string>();
  const [avatar, setAvatar] = useState<string>();
  const [banner, setBanner] = useState<string>();
  const [verifiedBadge, setVerifiedBadge] = useState<VerifiedBadgeType>('none');

  const [level, setLevel] = useState(1);
  const [language, setLanguage] = useState<Language>(languages[0]);
  const [startingElo, setStartingElo] = useState<number>(0);
  const [elo, setElo] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [ranking, setRanking] = useState(0);
  const [countryRanking, setCountryRanking] = useState(0);
  const [country, setCountry] = useState<string | undefined>();
  const [region, setRegion] = useState<string | undefined>();
  const [adr, setAdr] = useState(0);
  const [assists, setAssists] = useState(0);
  const [mvps, setMvps] = useState(0);
  const [krRatio, setKrRatio] = useState(0);
  const [kills, setKills] = useState(0);
  const [deaths, setDeaths] = useState(0);
  const [kdRatio, setKDRatio] = useState(0);
  const [hsPercent, setHSPercent] = useState(0);
  const [winsPercent, setWinsPercent] = useState(0);
  const [winStreak, setWinStreak] = useState(0);
  const [entryRate, setEntryRate] = useState(0);
  const [utilityDamagePerRound, setUtilityDamagePerRound] = useState(0);
  const [flashSuccessRate, setFlashSuccessRate] = useState(0);
  const [avgMatches, setAvgMatches] = useState(0);
  const [currentEloDistribution, setCurrentEloDistribution] = useState<
    [number, (string | number)[]]
  >([1, eloDistribution[0]]);
  const [compatibilityMode, setCompatibilityMode] = useState<boolean>(false);
  const [stats, setStats] = useState<StatisticType[]>([
    StatisticType.KILLS,
    StatisticType.KD,
    StatisticType.WINRATIO,
    StatisticType.HSPERCENT,
  ]);
  const [tickerPage, setTickerPage] = useState(0);
  const [versusPage, setVersusPage] = useState(0);
  const [reelIndex, setReelIndex] = useState(0);
  const [opponent, setOpponent] = useState<VersusPlayer>();
  const [animatedDeckIndex, setAnimatedDeckIndex] = useState(0);
  const [animatedDeckHeight, setAnimatedDeckHeight] = useState<number>(0);
  const animatedMeasureRef = useRef<HTMLDivElement>(null);

  const { settings, getSetting, setSetting, loadSettingsFromQuery } =
    useSettings(true);
  const overrides = useContext(SettingsContext);

  const SETTINGS = useMemo(() => {
    return overrides || { settings, get: getSetting, set: setSetting };
  }, [overrides, settings]);
  const resolvedStyle = resolveBannerStyle(SETTINGS.get('style'), SETTINGS.get('bannerDesign'));
  const isDeckPreset = resolvedStyle === 'showcase' || resolvedStyle === 'spotlight';
  const isTicker = resolvedStyle === 'ticker';
  const isVersus = isVersusStyle(resolvedStyle);
  const isSoloExtra = ['slab', 'gauge', 'card', 'reel', 'ribbon', 'tower', 'dials', 'marquee'].includes(resolvedStyle);

  /* Banner sizing: AUTO follows the OBS browser window, manual uses own values */
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const [previewCardWidth, setPreviewCardWidth] = useState(Infinity);
  /* The preview has no OBS window, so AUTO there means the banner's own size. */
  const previewLimits = preview ? getBannerSizeLimits(resolvedStyle) : undefined;
  const isSizedBanner =
    SETTINGS.get('bannerDesign') === '2026' && SETTINGS.get('style') !== 'custom';
  const bannerSize = isSizedBanner
    ? resolveBannerSize({
        style: resolvedStyle,
        widthMode: SETTINGS.get('bannerWidthMode') as BannerSizeMode,
        width: SETTINGS.get('bannerWidth'),
        heightMode: SETTINGS.get('bannerHeightMode') as BannerSizeMode,
        recommendedWidth: getRecommendedWidth(
          resolvedStyle,
          Boolean(SETTINGS.get('showStatistics'))
        ),
        height: SETTINGS.get('bannerHeight'),
        viewportWidth: previewLimits?.width ?? viewport.width,
        viewportHeight: previewLimits?.height ?? viewport.height,
      })
    : undefined;
  /* The preview is shown inside a card, so it only shrinks to fit it. */
  const previewFit =
    bannerSize && preview ? Math.min(1, previewCardWidth / bannerSize.width) : 1;
  const bannerZoom = bannerSize ? bannerSize.scale * previewFit : undefined;

  useEffect(() => {
    if (!bannerSize) return;

    if (!preview) {
      const update = () =>
        setViewport({ width: window.innerWidth, height: window.innerHeight });
      update();
      window.addEventListener('resize', update);
      document.documentElement.classList.add('banner-sized');
      return () => {
        window.removeEventListener('resize', update);
        document.documentElement.classList.remove('banner-sized');
      };
    }

    /* The preview has no OBS window, so it fits the card it is shown in. */
    const parent = wrapperRef.current?.parentElement;
    if (!parent) return;
    const update = () => {
      const styles = getComputedStyle(parent);
      setPreviewCardWidth(
        parent.clientWidth -
          parseFloat(styles.paddingLeft) -
          parseFloat(styles.paddingRight)
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [preview, !!bannerSize]);
  const isAvatarPreset = resolvedStyle === 'orbit' || resolvedStyle === 'halo' || resolvedStyle === 'pulse' || resolvedStyle === 'prime';
  const isStaticPreset = resolvedStyle === 'broadcast' || resolvedStyle === 'rail' || resolvedStyle === 'focus' || isAvatarPreset;
  const isBroadcastPreset = broadcastPresets.some((preset) => preset.id === resolvedStyle);
  const presetAccent = isBroadcastPreset
    ? String(SETTINGS.get(`${resolvedStyle}Accent` as SettingKey) || 'ff5900')
    : undefined;

  const translate = useCallback(
    (text: string, args?: string[]) => {
      return tl(language, text, args);
    },
    [language]
  );

  const [searchParams] = useSearchParams();
  // Dynamicznie dodaj/usuń link do Kick Font
  useEffect(() => {
    if (SETTINGS.get('bannerFont') === 'kick_font') {
      if (!document.getElementById('kick-font-link')) {
        const link = document.createElement('link');
        link.id = 'kick-font-link';
        link.rel = 'stylesheet';
        link.href = '/fonts/kick-font.css';
        document.head.appendChild(link);
      }
    } else {
      const existing = document.getElementById('kick-font-link');
      if (existing) existing.remove();
    }
  }, [SETTINGS]);

  useEffect(() => {
    if (!previewElo || !previewLevel) return;
    setElo(previewElo);
    setLevel(previewLevel);
    setCurrentEloDistribution(getEloDistribution(previewLevel, 1337));
  }, [previewElo, previewLevel]);

  useEffect(() => {
    if (!overrides || !preview) return;
    setStats([
      overrides.get('statSlot1'),
      overrides.get('statSlot2'),
      overrides.get('statSlot3'),
      overrides.get('statSlot4'),
    ]);
  }, [preview, overrides]);

  /* Load settings */
  useLayoutEffect(() => {
    if (preview) return;
    loadSettingsFromQuery();
    const statsQ = searchParams.get('stats');
    if (statsQ) setStats(statsQ.split(',') as StatisticType[]);
  }, [searchParams]);

  useLayoutEffect(() => {
    setLanguage(
      languages.find((lang) => lang.id === SETTINGS.get('widgetLanguage')) ||
        previewLanguage ||
        languages[0]
    );
  }, [SETTINGS, previewLanguage]);

  /** Returns a path to a level icon */
  const getIcon = useCallback(() => {
    if (level === 10 && ranking <= 1000 && !preview) {
      if (ranking === 1) return levelIcons[11];
      else if (ranking === 2) return levelIcons[12];
      else if (ranking === 3) return levelIcons[13];
      return levelIcons[10]; /* Challenger */
    }
    return levelIcons[level - 1];
  }, [level, ranking, preview]);

  /** Returns a color, min ELO and max ELO of a level */
  const getEloDistribution = useCallback(
    (level: number, ranking: number): [number, (string | number)[]] => {
      if (level === 10 && ranking <= 1000) {
        if (ranking === 1) return [12, eloDistribution[11]];
        else if (ranking === 2) return [13, eloDistribution[12]];
        else if (ranking === 3) return [14, eloDistribution[13]];
        return [11, eloDistribution[10]]; /* Challenger */
      }
      return [level, eloDistribution[level - 1]];
    },
    [preview]
  );

  /* Update player stats */
  useEffect(() => {
    if (preview) return;
    const saveSession = SETTINGS.get('saveSession');
    const playerId = SETTINGS.get('playerId');
    if (!playerId) {
      return;
    }

    /*
     * The session lives in this browser's own storage (the OBS browser data), so
     * a restarted OBS keeps wins, losses and the ELO change for 2 hours after the
     * widget was last open. After that, or for another player, it starts from zero.
     */
    const now = Date.now();
    let startDate = new Date(now);
    let sessionExpired = true;
    if (saveSession) {
      const savedStart = Date.parse(localStorage.getItem('fcw_session_start') ?? '');
      const savedEnd = Date.parse(localStorage.getItem('fcw_session_end') ?? '');
      const samePlayer = localStorage.getItem('fcw_session_player-id') === playerId;
      if (samePlayer && !Number.isNaN(savedStart) && !Number.isNaN(savedEnd) && now <= savedEnd) {
        startDate = new Date(savedStart);
        sessionExpired = false;
      } else {
        localStorage.setItem('fcw_session_start', new Date(now).toISOString());
        localStorage.setItem('fcw_session_player-id', playerId);
        localStorage.removeItem('fcw_session_starting-elo');
      }
    }
    const extendSession = () => {
      if (!saveSession) return;
      localStorage.setItem(
        'fcw_session_end',
        new Date(Date.now() + SESSION_KEEP_MS).toISOString()
      );
    };
    extendSession();
    window.addEventListener('pagehide', extendSession);
    const getStats = (firstTime?: boolean) => {
      getPlayerStats(
        playerId,
        SETTINGS.get('averageStatsMatchCount'),
        startDate,
        searchParams.get('only_official') === 'true'
      ).then((player) => {
        if (!player) return;
        setUsername(player.username);
        setAvatar(player.avatar);
        setBanner(player.banner);
        setVerifiedBadge(player.verifiedBadge);

        if (!player || !player.elo || !player.level) return;
        if (firstTime) {
          const startingElo = saveSession
            ? Number(localStorage.getItem('fcw_session_starting-elo'))
            : 0;
          if (saveSession && !sessionExpired && startingElo) {
            setStartingElo(startingElo);
          } else {
            if (saveSession) {
              localStorage.setItem('fcw_session_starting-elo', String(player.elo));
            }
            setStartingElo(player.elo);
          }
        } else {
          extendSession();
        }

        setElo(player.elo);
        setLevel(player.level);

        setWins(player.wins);
        setLosses(player.losses);

        setAdr(player.avg.adr);
        setAssists(player.avg.assists);
        setMvps(player.avg.mvps);
        setKrRatio(player.avg.kr);
        setKills(player.avg.kills);
        setDeaths(player.avg.deaths);
        setKDRatio(player.avg.kd);
        setHSPercent(player.avg.hspercent);
        setWinsPercent(
          Math.round((player.avg.wins / player.avg.matches) * 100)
        );
        setAvgMatches(player.avg.matches);
        setWinStreak(player.avg.winStreak);
        setEntryRate(player.avg.entryRate);
        setUtilityDamagePerRound(player.avg.utilityDamagePerRound);
        setFlashSuccessRate(player.avg.flashSuccessRate);

        setRanking(player.ranking);
        setCountryRanking(player.countryRanking);
        setCountry(player.country);
        setRegion(player.region);
        setCurrentEloDistribution(
          getEloDistribution(player.level, player.ranking)
        );
      });
    };
    getStats(true);

    /* Check for older Chromium version */
    const userAgent = window.navigator.userAgent;
    const chromeVersion = userAgent
      .split(' ')
      .find((version) => version.startsWith('Chrome/'));
    if (
      chromeVersion &&
      parseInt(chromeVersion.split('/')[1].split('.')[0]) < 120
    ) {
      setCompatibilityMode(true);
    }

    let refreshDelay = 60;
    const refreshParam = searchParams.get('refresh');
    if (refreshParam) {
      refreshDelay = parseInt(refreshParam);
    }

    if (refreshDelay < 10) {
      refreshDelay = 10;
    }

    /* Set widget style and color scheme */
    document
      .getElementsByTagName('html')[0]
      .classList.add(`${resolvedStyle}-theme`);
    document
      .getElementsByTagName('html')[0]
      .classList.add(`${SETTINGS.get('colorScheme')}-scheme`);
    if (SETTINGS.get('autoWidth'))
      document.getElementsByTagName('html')[0].classList.add(`auto-width`);

    const interval = setInterval(
      getStats,
      1000 * SETTINGS.get('refreshInterval') || 60000
    );
    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', extendSession);
      document
        .getElementsByTagName('html')[0]
        .classList.remove(`${resolvedStyle}-theme`);
      document
        .getElementsByTagName('html')[0]
        .classList.remove(`${SETTINGS.get('colorScheme')}-scheme`);
      if (SETTINGS.get('autoWidth'))
        document.getElementsByTagName('html')[0].classList.remove(`auto-width`);
    };
  }, [SETTINGS]);

  /* Custom CSS */
  useEffect(() => {
    const customCSS = SETTINGS.get('customCSS');
    if (SETTINGS.get('style') !== 'custom' || !customCSS) return;

    const head = document.head;
    const link = document.createElement('link');
    link.type = 'text/css';
    link.rel = 'stylesheet';
    link.href = customCSS;

    head.appendChild(link);
    return () => {
      head.removeChild(link);
    };
  }, [SETTINGS]);

  /** Returns player statistic */
  const getStat = useCallback(
    (stat: StatisticType) => {
      switch (stat) {
        case StatisticType.ADR:
          if (!preview && (!adr || !avgMatches)) return null;
          return `${preview ? '82.5' : Math.round((adr / avgMatches) * 10) / 10}`;
        case StatisticType.ASSISTS:
          if (!preview && (!assists || !avgMatches)) return null;
          return `${preview ? 4 : Math.round(assists / avgMatches)}`;
        case StatisticType.MVPS:
          if (!preview && (!mvps || !avgMatches)) return null;
          return `${preview ? 3 : Math.round(mvps / avgMatches)}`;
        case StatisticType.KR:
          if (!preview && (!krRatio || !avgMatches)) return null;
          return `${preview ? '0.9' : Math.round((krRatio / avgMatches) * 100) / 100}`;
        case StatisticType.KILLS:
          if (!preview && (!kills || !avgMatches)) return null;
          return `${preview ? 20 : Math.round(kills / avgMatches)}`;
        case StatisticType.DEATHS:
          if (!preview && (!deaths || !avgMatches)) return null;
          return `${preview ? 10 : Math.round(deaths / avgMatches)}`;
        case StatisticType.HSPERCENT:
          if (!preview && (!hsPercent || !avgMatches)) return null;
          return `${preview ? '50' : Math.round(hsPercent / avgMatches)}%`;
        case StatisticType.KD:
          if (!preview && (!kdRatio || !avgMatches)) return null;
          return `${preview ? '2' : Math.round((kdRatio / avgMatches) * 100) / 100}`;
        case StatisticType.WINRATIO:
          if (!preview && !winsPercent) return null;
          return `${preview ? '50' : winsPercent}%`;
        case StatisticType.RANKING:
          if (!preview && !ranking) return null;
          return `#${preview ? 999 : ranking}`;
        case StatisticType.WINSTREAK:
          return `${preview ? 5 : winStreak}`;
        case StatisticType.ENTRYRATE:
          return `${preview ? 67 : Math.round(entryRate)}%`;
        case StatisticType.UTILITY:
          return `${preview ? '3.0' : utilityDamagePerRound}`;
        case StatisticType.FLASHRATE:
          return `${preview ? 51 : Math.round(flashSuccessRate)}%`;
        default:
          return `???`;
      }
    },
    [
      adr,
      assists,
      mvps,
      krRatio,
      kills,
      deaths,
      winsPercent,
      hsPercent,
      kdRatio,
      ranking,
      avgMatches,
      winStreak,
      entryRate,
      utilityDamagePerRound,
      flashSuccessRate,
    ]
  );

  /** Returns player ELO text */
  const getEloDiff = useCallback(() => {
    let diff = 0;

    if (!preview) {
      diff = elo - startingElo;
    }

    let diffArrow: ReactElement | null = null;
    let diffStyle: string = '';

    if (diff > 0) {
      diffArrow = <ArrowUpIcon />;
      diffStyle = 'gain';
    } else if (diff < 0) {
      diffArrow = <ArrowDownIcon />;
      diffStyle = 'loss';
    }

    return (
      <span className={`diff ${diffStyle}`}>
        ({SETTINGS.get('showIcons') ? diffArrow : null}
        {diff >= 0 ? `+${diff}` : String(diff)})
      </span>
    );
  }, [language, elo, startingElo, SETTINGS]);

  const hasStatsToShow =
    preview || stats.some((stat) => getStat(stat) !== null);
  const hasMatchesToShow = preview || wins > 0 || losses > 0;
  const isAnimatedStyle = SETTINGS.get('style') === 'animated';

  const animatedCardOrder = [
    {
      key: 'header' as AnimatedCardKey,
      order: Number(SETTINGS.get('animatedDeckOrderHeader') || 1),
      visible: Boolean(SETTINGS.get('animatedDeckShowHeader')),
    },
    {
      key: 'stats' as AnimatedCardKey,
      order: Number(SETTINGS.get('animatedDeckOrderStats') || 2),
      visible:
        Boolean(SETTINGS.get('animatedDeckShowStats')) &&
        Boolean(SETTINGS.get('showStatistics')) &&
        hasStatsToShow,
    },
    {
      key: 'matches' as AnimatedCardKey,
      order: Number(SETTINGS.get('animatedDeckOrderMatches') || 3),
      visible:
        Boolean(SETTINGS.get('animatedDeckShowMatches')) && hasMatchesToShow,
    },
  ]
    .filter((entry) => entry.visible)
    .sort((a, b) => a.order - b.order);

  useEffect(() => {
    if (!isAnimatedStyle) {
      setAnimatedDeckIndex(0);
      return;
    }

    if (animatedCardOrder.length <= 1) {
      setAnimatedDeckIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setAnimatedDeckIndex(
        (previous) => (previous + 1) % animatedCardOrder.length
      );
    }, 4200);

    return () => {
      clearInterval(interval);
    };
  }, [isAnimatedStyle, animatedCardOrder.length]);

  useEffect(() => {
    if (animatedCardOrder.length === 0) {
      setAnimatedDeckIndex(0);
      return;
    }

    if (animatedDeckIndex >= animatedCardOrder.length) {
      setAnimatedDeckIndex(0);
    }
  }, [animatedCardOrder.length, animatedDeckIndex]);

  useLayoutEffect(() => {
    if (!isAnimatedStyle) {
      setAnimatedDeckHeight(0);
      return;
    }

    const measureRoot = animatedMeasureRef.current;
    if (!measureRoot) {
      return;
    }

    const cards = Array.from(
      measureRoot.querySelectorAll('.animated-card')
    ) as HTMLElement[];
    if (cards.length === 0) {
      setAnimatedDeckHeight(0);
      return;
    }

    const maxHeight = Math.max(...cards.map((card) => card.offsetHeight));
    setAnimatedDeckHeight(maxHeight);
  }, [
    isAnimatedStyle,
    animatedCardOrder.length,
    SETTINGS.settings,
    wins,
    losses,
    elo,
    ranking,
    countryRanking,
    stats,
  ]);

  /* Versus: loads the opponent and keeps them up to date */
  const opponentId = SETTINGS.get('opponentId');
  useEffect(() => {
    if (preview || !isVersus || !opponentId) return;
    const load = () =>
      getPlayerStats(
        opponentId,
        SETTINGS.get('averageStatsMatchCount'),
        new Date(),
        searchParams.get('only_official') === 'true'
      ).then((player) => {
        if (!player || !player.elo || !player.level) return;
        const matches = player.avg.matches || 1;
        setOpponent({
          username: player.username,
          avatar: player.avatar,
          country: player.country,
          elo: player.elo,
          level: player.level,
          kd: Math.round((player.avg.kd / matches) * 100) / 100,
          adr: Math.round((player.avg.adr / matches) * 10) / 10,
          winRate: Math.round((player.avg.wins / matches) * 100),
          hs: Math.round(player.avg.hspercent / matches),
        });
      });
    load();
    const interval = setInterval(
      load,
      1000 * (SETTINGS.get('refreshInterval') || 60)
    );
    return () => clearInterval(interval);
  }, [preview, isVersus, opponentId]);

  /* Solo "reel": one statistic at a time, rolling */
  useEffect(() => {
    if (resolvedStyle !== 'reel' || !SETTINGS.get('reelAutoplay')) return;
    const seconds = Math.max(2, Number(SETTINGS.get('reelSeconds')) || 4);
    const interval = setInterval(
      () => setReelIndex((index) => index + 1),
      seconds * 1000
    );
    return () => clearInterval(interval);
  }, [resolvedStyle, SETTINGS.get('reelAutoplay'), SETTINGS.get('reelSeconds')]);

  /* Versus "cycle": rotates between ELO, aim and results */
  useEffect(() => {
    if (resolvedStyle !== 'cycle' || !SETTINGS.get('cycleAutoplay')) return;
    const seconds = Math.max(3, Number(SETTINGS.get('cycleSeconds')) || 5);
    const interval = setInterval(
      () => setVersusPage((page) => (page + 1) % 3),
      seconds * 1000
    );
    return () => clearInterval(interval);
  }, [resolvedStyle, SETTINGS.get('cycleAutoplay'), SETTINGS.get('cycleSeconds')]);

  /* Ticker: alternates between "today" and "last matches" */
  useEffect(() => {
    if (!isTicker || !SETTINGS.get('tickerAutoplay')) return;
    const seconds = Math.max(3, Number(SETTINGS.get('tickerSeconds')) || 6);
    const interval = setInterval(
      () => setTickerPage((page) => (page + 1) % 2),
      seconds * 1000
    );
    return () => clearInterval(interval);
  }, [isTicker, SETTINGS.get('tickerAutoplay'), SETTINGS.get('tickerSeconds')]);

  /** Share of the current level already earned, used as the avatar ring progress. */
  const levelProgress =
    level === 10
      ? 1
      : Math.min(
          1,
          Math.max(
            0,
            (elo - (currentEloDistribution[1][1] as number)) /
              ((currentEloDistribution[1][2] as number) -
                (currentEloDistribution[1][1] as number))
          )
        );

  /** One continuous ring: levels 1-10 with the progress inside the current level. */
  const levelRingFill =
    level >= 10 ? 1 : Math.max(0.03, (level - 1 + levelProgress) / 10);

  const renderOrb = (
    avatarSrc: string | undefined,
    name: string,
    orbLevel: number,
    orbElo: number,
    icon: ReactElement | undefined
  ) => {
    const [, range] = getEloDistribution(orbLevel, 1337);
    const min = Number(range[1]);
    const max = Number(range[2]);
    const progress =
      orbLevel >= 10 || !max
        ? 1
        : Math.min(1, Math.max(0, (orbElo - min) / (max - min)));
    const fill =
      orbLevel >= 10 ? 1 : Math.max(0.03, (orbLevel - 1 + progress) / 10);
    return (
      <div
        className={'avatar-orb'}
        style={
          { '--faceit-level': `var(--faceit-level-${orbLevel})` } as CSSProperties
        }
      >
        <svg className={'orb-ring'} viewBox="0 0 100 100" aria-hidden="true">
          <circle className={'orb-track'} cx={50} cy={50} r={46} />
          <circle
            className={'orb-progress'}
            cx={50}
            cy={50}
            r={46}
            pathLength={100}
            strokeDasharray={`${fill * 100} 100`}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <span className={'orb-photo'}>
          {avatarSrc ? (
            <img src={avatarSrc} alt="" />
          ) : (
            <span className={'orb-fallback'}>{name.charAt(0).toUpperCase()}</span>
          )}
        </span>
        {icon && <span className={'orb-level'}>{icon}</span>}
      </div>
    );
  };

  const renderAvatarOrb = () =>
    renderOrb(
      preview ? previewAvatar : avatar,
      username || previewUsername || 'Player',
      level,
      elo,
      SETTINGS.get('showLevelIcon') ? getIcon() : undefined
    );

  const renderHeaderCard = (showProgressInsideHeader = false) => (
    <>
      <div className={'level'}>
        {isAvatarPreset
          ? renderAvatarOrb()
          : SETTINGS.get('showLevelIcon') && getIcon()}

        <div className={'elo'}>
          {SETTINGS.get('showUsername') && (
            <h2 className={elo === 0 ? 'skeleton' : ''}>
              {username || previewUsername || 'Player'}{' '}
              {SETTINGS.get('showVerifiedBadge') &&
                (preview
                  ? previewVerifiedBadge && previewVerifiedBadge !== 'none'
                  : verifiedBadge !== 'none') && (
                  <span className={'verified-badge'}>
                    {(preview ? previewVerifiedBadge : verifiedBadge) ===
                    'gold' ? (
                      <VerifiedGoldBadgeIcon />
                    ) : (
                      <VerifiedBadgeIcon />
                    )}
                  </span>
                )}
            </h2>
          )}
          <p
            className={`${SETTINGS.get('showUsername') ? '' : 'username-hidden'} ${elo === 0 ? 'skeleton' : ''}`}
          >
            {SETTINGS.get('showIcons') && <TimelineIcon />}{' '}
            <span className={'elo-value'}>{String(elo)}</span>
            {SETTINGS.get('showEloSuffix') && (
              <span className={'elo-suffix'}>ELO</span>
            )}{' '}
            {SETTINGS.get('showEloDiff') && getEloDiff()}
          </p>
          {SETTINGS.get('showRanking') !== ShowRanking.DISABLED && (
            <p className={'ranking'}>
              {(SETTINGS.get('showRanking') === ShowRanking.SHOW ||
                SETTINGS.get('showRanking') === ShowRanking.BOTH ||
                (SETTINGS.get('showRanking') ===
                  ShowRanking.ONLY_WHEN_CHALLENGER &&
                  ranking <= 1000 &&
                  !preview)) && (
                <span
                  className={`region-ranking ${!preview && ranking === 0 ? 'skeleton' : ''}`}
                >
                  {REGION_FLAG_MAP[
                    (preview
                      ? previewRegion || 'EU'
                      : region || 'EU'
                    ).toUpperCase()
                  ] ? (
                    <img
                      className={'flag'}
                      src={`https://flagcdn.com/${REGION_FLAG_MAP[(preview ? previewRegion || 'EU' : region || 'EU').toUpperCase()]}.svg`}
                      alt={preview ? previewRegion || 'EU' : region || 'EU'}
                    />
                  ) : (
                    <span className={'no-icon'}>
                      {(preview
                        ? previewRegion || 'EU'
                        : region || 'EU'
                      ).toUpperCase()}
                    </span>
                  )}
                  {`#${ranking || 1337}`}
                </span>
              )}
              {(SETTINGS.get('showRanking') === ShowRanking.COUNTRY ||
                SETTINGS.get('showRanking') === ShowRanking.BOTH) && (
                <span
                  className={`country-ranking ${!preview && countryRanking === 0 ? 'skeleton' : ''}`}
                >
                  {(preview ? previewCountry : country) ? (
                    <img
                      className={'flag'}
                      src={`https://flagcdn.com/${preview ? previewCountry : country}.svg`}
                      alt={preview ? previewCountry : country}
                    />
                  ) : (
                    <span className={'no-icon'}>
                      {(preview
                        ? previewCountry || '?'
                        : country || '?'
                      ).toUpperCase()}
                    </span>
                  )}
                  {`#${preview ? 1337 : countryRanking || 1337}`}
                </span>
              )}
            </p>
          )}
        </div>
      </div>
      {showProgressInsideHeader && SETTINGS.get('showEloProgressBar') && (
        <div className={'progress-bar'}>
          <div
            className={'progress'}
            style={{
              width:
                level === 10
                  ? '100%'
                  : `${((elo - (currentEloDistribution[1][1] as number)) / ((currentEloDistribution[1][2] as number) - (currentEloDistribution[1][1] as number))) * 100}%`,
            }}
          ></div>
        </div>
      )}
    </>
  );

  const renderStatsCard = () => (
    <div className={'average'}>
      {stats.map((stat) => {
        return (
          <div className={'stat'} key={`animated-stat-${stat}`}>
            <p>{translate(`widget.${stat.toLowerCase()}`)}</p>
            <p>{getStat(stat) || <span className={'skeleton'}>???</span>}</p>
          </div>
        );
      })}
    </div>
  );

  const renderMatchesCard = () => (
    <div className={'matches'}>
      <div className={'stats'}>
        <Statistic
          color={'green'}
          value={String(wins)}
          text={translate('widget.wins')}
        />
        <Statistic
          color={'red'}
          value={String(losses)}
          text={translate('widget.losses')}
        />
      </div>
    </div>
  );

  const renderTicker = () => {
    const headStat = SETTINGS.get('tickerHeadStat') as StatisticType;
    const showRank = preview || (ranking > 0 && ranking <= 1000);
    const flagCode = (preview ? previewCountry : country) || 'pl';
    const countryPlace = preview ? 2 : countryRanking;
    const cell = (value: ReactElement | string | null, label: string, tone = '') => (
      <div className={`ticker-cell ${tone}`} key={label}>
        <b>{value ?? <span className={'skeleton'}>??</span>}</b>
        <span>{label}</span>
      </div>
    );
    const pair = (a: StatisticType, b: StatisticType) => {
      const first = getStat(a);
      const second = getStat(b);
      return first && second ? `${first.replace('%', '')}/${second}` : null;
    };
    const pages = [
      {
        id: 'today',
        title: translate('widget.ticker.today'),
        cells: [
          cell(String(wins), translate('widget.wins'), 'win'),
          cell(String(losses), translate('widget.losses'), 'loss'),
          cell(pair(StatisticType.KILLS, StatisticType.ADR), translate('widget.ticker.kills_adr')),
          cell(getStat(StatisticType.KD), 'K/D'),
        ],
      },
      {
        id: 'last',
        title: translate('widget.ticker.last'),
        cells: [
          cell(getStat(StatisticType.WINRATIO), translate('widget.ticker.winrate')),
          cell(pair(StatisticType.KILLS, StatisticType.ADR), translate('widget.ticker.kills_adr')),
          cell(pair(StatisticType.KD, StatisticType.KR), 'K/D / K/R'),
        ],
      },
    ];
    const page = pages[tickerPage % pages.length];
    return (
      <div className={'ticker'}>
        <div className={'ticker-head'}>
          <div className={'ticker-left'}>
            {showRank ? (
              <span className={'ticker-rank'}>
                <b>#{preview ? 17 : ranking}</b>
                <span
                  className={'ticker-challenger'}
                  style={
                    preview
                      ? ({ '--faceit-level': 'var(--faceit-level-11)' } as CSSProperties)
                      : undefined
                  }
                >
                  {preview ? levelIcons[10] : getIcon()}
                </span>
              </span>
            ) : (
              SETTINGS.get('showLevelIcon') && (
                <span className={'ticker-level'}>{getIcon()}</span>
              )
            )}
            <span className={`ticker-elo ${elo === 0 ? 'skeleton' : ''}`}>
              {String(elo)}
            </span>
          </div>
          <div className={'ticker-center'}>
            <b>{getStat(headStat) || <span className={'skeleton'}>?.??</span>}</b>
            <span>{headStat === StatisticType.KD ? 'KDR' : translate(`widget.${headStat.toLowerCase()}`)}</span>
          </div>
          <div className={'ticker-right'}>
            <img className={'flag'} src={`https://flagcdn.com/${flagCode}.svg`} alt={flagCode} />
            <span>#{countryPlace || '?'}</span>
          </div>
        </div>
        <div className={'ticker-page'} key={page.id}>
          <p className={'ticker-title'}>{page.title}</p>
          <div className={'ticker-cells'} data-count={page.cells.length}>
            {page.cells}
          </div>
        </div>
      </div>
    );
  };

  const renderVersus = () => {
    const meName = username || previewUsername || 'Player';
    const mocked: VersusPlayer = {
      username: 'Rival',
      elo: 1840,
      level: 8,
      country: 'pl',
      kd: 1.05,
      adr: 78.4,
      winRate: 52,
      hs: 44,
    };
    const rival = (preview ? previewOpponent : opponent) ?? mocked;
    const me: VersusPlayer = {
      username: meName,
      avatar: preview ? previewAvatar : avatar,
      country: (preview ? previewCountry : country) || 'pl',
      elo,
      level,
      kd: preview
        ? 1.22
        : avgMatches
          ? Math.round((kdRatio / avgMatches) * 100) / 100
          : 0,
      adr: preview
        ? 82.5
        : avgMatches
          ? Math.round((adr / avgMatches) * 10) / 10
          : 0,
      winRate: preview ? 56 : winsPercent,
      hs: preview ? 48 : avgMatches ? Math.round(hsPercent / avgMatches) : 0,
    };
    const diff = me.elo - rival.elo;
    const lead = diff === 0 ? 'even' : diff > 0 ? 'me' : 'rival';
    const total = Math.max(1, me.elo + rival.elo);
    const mePercent = Math.round((me.elo / total) * 100);
    const diffText = `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff)}`;
    const myAccent = `#${presetAccent || 'ff5900'}`;
    const rivalAccent = `#${String(SETTINGS.get('versusOpponentAccent') || '3b82f6')}`;
    const vsStyle = {
      '--vs-me': myAccent,
      '--vs-rival': rivalAccent,
    } as CSSProperties;
    const orbFor = (player: VersusPlayer) =>
      renderOrb(
        player.avatar,
        player.username,
        player.level,
        player.elo,
        levelIcons[player.level - 1]
      );
    const flag = (player: VersusPlayer) =>
      player.country ? (
        <img
          className={'flag'}
          src={`https://flagcdn.com/${player.country.toLowerCase()}.svg`}
          alt={player.country}
        />
      ) : null;
    const side = (player: VersusPlayer, who: 'me' | 'rival') => (
      <div className={`vs-side vs-${who}`}>
        {orbFor(player)}
        <div className={'vs-id'}>
          <h2>
            {flag(player)}
            <span>{player.username}</span>
          </h2>
          <p>
            <b>{String(player.elo)}</b>
            <small>ELO</small>
          </p>
        </div>
      </div>
    );
    const diffBadge = (
      <div className={`vs-diff lead-${lead}`}>
        <span className={'vs-badge'}>VS</span>
        <b>{diffText}</b>
        <small>{translate('widget.versus.advantage')}</small>
      </div>
    );

    if (resolvedStyle === 'edge') {
      return (
        <div className={'versus versus-edge'} style={vsStyle}>
          {side(me, 'me')}
          <div className={'vs-meter'}>
            <div className={'vs-bar'} aria-hidden="true">
              <i className={'vs-bar-me'} style={{ width: `${mePercent}%` }} />
              <i className={'vs-bar-rival'} style={{ width: `${100 - mePercent}%` }} />
            </div>
            <div className={`vs-edge-diff lead-${lead}`}>
              <span>VS</span>
              <b>{diffText}</b>
            </div>
          </div>
          {side(rival, 'rival')}
        </div>
      );
    }

    if (resolvedStyle === 'faceoff') {
      const rows: { label: string; a: number; b: number; fmt: (value: number) => string }[] = [
        { label: 'ELO', a: me.elo, b: rival.elo, fmt: String },
        { label: 'K/D', a: me.kd, b: rival.kd, fmt: (v) => v.toFixed(2) },
        { label: 'ADR', a: me.adr, b: rival.adr, fmt: (v) => v.toFixed(1) },
        { label: translate('widget.winratio'), a: me.winRate, b: rival.winRate, fmt: (v) => `${v}%` },
        { label: 'HS %', a: me.hs, b: rival.hs, fmt: (v) => `${v}%` },
      ];
      return (
        <div className={'versus versus-faceoff'} style={vsStyle}>
          <div className={'vs-top'}>
            {side(me, 'me')}
            {diffBadge}
            {side(rival, 'rival')}
          </div>
          <div className={'vs-rows'}>
            {rows.slice(1).map((row) => (
              <div className={'vs-row'} key={row.label}>
                <b className={row.a > row.b ? 'win' : row.a < row.b ? 'lose' : ''}>
                  {row.fmt(row.a)}
                </b>
                <span>{row.label}</span>
                <b className={row.b > row.a ? 'win' : row.b < row.a ? 'lose' : ''}>
                  {row.fmt(row.b)}
                </b>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const cmpRows: {
      label: string;
      a: number;
      b: number;
      fmt: (value: number) => string;
    }[] = [
      { label: 'ELO', a: me.elo, b: rival.elo, fmt: String },
      { label: 'K/D', a: me.kd, b: rival.kd, fmt: (v) => v.toFixed(2) },
      { label: 'ADR', a: me.adr, b: rival.adr, fmt: (v) => v.toFixed(1) },
      { label: translate('widget.winratio'), a: me.winRate, b: rival.winRate, fmt: (v) => `${v}%` },
      { label: 'HS %', a: me.hs, b: rival.hs, fmt: (v) => `${v}%` },
    ];
    const tone = (mine: number, theirs: number) =>
      mine > theirs ? 'win' : mine < theirs ? 'lose' : '';
    const cmpCell = (row: (typeof cmpRows)[number]) => (
      <div className={'vs-cell'} key={row.label}>
        <b className={tone(row.a, row.b)}>{row.fmt(row.a)}</b>
        <small>{row.label}</small>
        <b className={tone(row.b, row.a)}>{row.fmt(row.b)}</b>
      </div>
    );

    if (resolvedStyle === 'tally') {
      const mine = cmpRows.filter((row) => row.a > row.b).length;
      const theirs = cmpRows.filter((row) => row.b > row.a).length;
      return (
        <div className={'versus versus-tally'} style={vsStyle}>
          <div className={'vs-top'}>
            {side(me, 'me')}
            <div className={'tally-score'}>
              <b className={mine >= theirs ? 'lead' : ''}>{mine}</b>
              <span>:</span>
              <b className={theirs > mine ? 'lead' : ''}>{theirs}</b>
              <small>{translate('widget.versus.categories')}</small>
            </div>
            {side(rival, 'rival')}
          </div>
          <div className={'tally-chips'}>
            {cmpRows.map((row) => (
              <div
                className={`tally-chip ${row.a > row.b ? 'me' : row.b > row.a ? 'rival' : 'even'}`}
                key={row.label}
              >
                <small>{row.label}</small>
                <b>{row.a > row.b ? row.fmt(row.a) : row.b > row.a ? row.fmt(row.b) : '='}</b>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (resolvedStyle === 'overlay') {
      /* Every axis runs from 0 to a fixed top value, so the polygon size means something */
      const scales = [3000, 2, 120, 100, 100];
      const axes = cmpRows;
      const cx = 130;
      const cy = 120;
      const radius = 84;
      const spot = (index: number, share: number, reach = 1) => {
        const angle = (Math.PI * 2 * index) / axes.length;
        return {
          x: cx + Math.sin(angle) * radius * share * reach,
          y: cy - Math.cos(angle) * radius * share * reach,
        };
      };
      const share = (value: number, index: number) =>
        Math.min(1, Math.max(0.02, value / scales[index]));
      const polygon = (pick: (row: (typeof cmpRows)[number]) => number) =>
        axes
          .map((row, index) => {
            const p = spot(index, share(pick(row), index));
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          })
          .join(' ');
      return (
        <div className={'versus versus-overlay'} style={vsStyle}>
          <div className={'ov-head'}>
            {side(me, 'me')}
            {side(rival, 'rival')}
          </div>
          <svg viewBox="0 0 260 240" className={'ov-radar'} aria-hidden="true">
            {[0.25, 0.5, 0.75, 1].map((ring) => (
              <polygon
                key={ring}
                className={'ov-ring'}
                points={axes
                  .map((_, index) => {
                    const p = spot(index, ring);
                    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                  })
                  .join(' ')}
              />
            ))}
            {axes.map((_, index) => {
              const p = spot(index, 1);
              return (
                <line key={`spoke-${index}`} className={'ov-spoke'} x1={cx} y1={cy} x2={p.x} y2={p.y} />
              );
            })}
            {[0.25, 0.5, 0.75, 1].map((ring) => (
              <text key={`tick-${ring}`} x={cx + 3} y={cy - radius * ring + 9} className={'ov-tick'}>
                {Math.round(scales[0] * ring)}
              </text>
            ))}
            <polygon className={'ov-shape ov-me'} points={polygon((row) => row.a)} />
            <polygon className={'ov-shape ov-rival'} points={polygon((row) => row.b)} />
            {axes.map((row, index) => {
              const mine = spot(index, share(row.a, index));
              const theirs = spot(index, share(row.b, index));
              return (
                <g key={`dots-${row.label}`}>
                  <circle cx={mine.x} cy={mine.y} r={3} className={'ov-dot ov-me'} />
                  <circle cx={theirs.x} cy={theirs.y} r={3} className={'ov-dot ov-rival'} />
                </g>
              );
            })}
            {axes.map((row, index) => {
              const p = spot(index, 1, 1.24);
              const anchor = p.x < cx - 4 ? 'end' : p.x > cx + 4 ? 'start' : 'middle';
              return (
                <text key={row.label} x={p.x} y={p.y - 6} className={'ov-label'} textAnchor={anchor}>
                  <tspan x={p.x} className={'ov-name'}>{row.label}</tspan>
                  <tspan x={p.x} dy={12} className={'ov-val ov-me'}>{row.fmt(row.a)}</tspan>
                  <tspan x={p.x} dy={11} className={'ov-val ov-rival'}>{row.fmt(row.b)}</tspan>
                </text>
              );
            })}
          </svg>
        </div>
      );
    }

    if (resolvedStyle === 'ladder') {
      /* Segments are as wide as their ELO range, so the gap between players is to scale */
      const levelSpans = [400, 250, 150, 150, 150, 150, 180, 220, 250, 1000];
      const totalSpan = levelSpans.reduce((sum, span) => sum + span, 0);
      const placement = (player: VersusPlayer) =>
        Math.min(98, Math.max(2, ((Math.min(3000, Math.max(100, player.elo)) - 100) / (totalSpan - 100)) * 100));
      const mark = (player: VersusPlayer, who: 'me' | 'rival') => (
        <div
          className={`ladder-mark vs-${who}`}
          style={{ left: `${placement(player)}%` }}
        >
          <div className={'ladder-pin'}>{orbFor(player)}</div>
          <b>{String(player.elo)}</b>
        </div>
      );
      return (
        <div className={'versus versus-ladder'} style={vsStyle}>
          <div className={'ladder-top'}>
            <span className={'vs-me'}>{flag(me)} {me.username}</span>
            <div className={`vs-edge-diff lead-${lead}`}>
              <b>{diffText}</b>
              <small>{translate('widget.versus.advantage')}</small>
            </div>
            <span className={'vs-rival'}>{rival.username} {flag(rival)}</span>
          </div>
          <div
            className={'ladder-track'}
            style={{ gridTemplateColumns: levelSpans.map((span) => `${span}fr`).join(' ') }}
          >
            {Array.from({ length: 10 }, (_, index) => (
              <i
                key={index}
                style={{ background: `var(--faceit-level-${index + 1})` }}
              />
            ))}
            {mark(me, 'me')}
            {mark(rival, 'rival')}
          </div>
          <div className={'ladder-scale'}>
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>
      );
    }

    if (resolvedStyle === 'matchup') {
      return (
        <div className={'versus versus-matchup'} style={vsStyle}>
          <div className={'vs-top'}>
            {side(me, 'me')}
            {diffBadge}
            {side(rival, 'rival')}
          </div>
          <div className={'vs-butterfly'}>
            {cmpRows.slice(1).map((row) => {
              const top = Math.max(row.a, row.b, 1);
              return (
                <div className={'vs-bfrow'} key={row.label}>
                  <b className={tone(row.a, row.b)}>{row.fmt(row.a)}</b>
                  <div className={'vs-bf-half vs-bf-left'}>
                    <i style={{ width: `${(row.a / top) * 100}%` }} />
                  </div>
                  <span>{row.label}</span>
                  <div className={'vs-bf-half vs-bf-right'}>
                    <i style={{ width: `${(row.b / top) * 100}%` }} />
                  </div>
                  <b className={tone(row.b, row.a)}>{row.fmt(row.b)}</b>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (resolvedStyle === 'scoreboard') {
      return (
        <div className={'versus versus-scoreboard'} style={vsStyle}>
          {side(me, 'me')}
          <div className={'vs-cells'}>{cmpRows.slice(0, 4).map(cmpCell)}</div>
          {side(rival, 'rival')}
        </div>
      );
    }

    if (resolvedStyle === 'cycle') {
      const pages = [
        { id: 'elo', title: 'ELO', rows: [cmpRows[0]] },
        { id: 'aim', title: translate('widget.versus.aim'), rows: [cmpRows[1], cmpRows[2]] },
        { id: 'results', title: translate('widget.versus.results'), rows: [cmpRows[3], cmpRows[4]] },
      ];
      const page = pages[versusPage % pages.length];
      return (
        <div className={'versus versus-cycle'} style={vsStyle} data-lead={lead}>
          {side(me, 'me')}
          <div className={'vs-cycle-page'} key={page.id}>
            <p className={'vs-cycle-title'}>{page.title}</p>
            <div className={'vs-cells'}>{page.rows.map(cmpCell)}</div>
            {page.id === 'elo' && (
              <div className={`vs-edge-diff lead-${lead}`}>
                <span>{translate('widget.versus.advantage')}</span>
                <b>{diffText}</b>
              </div>
            )}
          </div>
          {side(rival, 'rival')}
        </div>
      );
    }

    if (resolvedStyle === 'clash') {
      return (
        <div className={'versus versus-clash'} style={vsStyle}>
          {side(me, 'me')}
          {diffBadge}
          {side(rival, 'rival')}
        </div>
      );
    }

    if (resolvedStyle === 'tug' || resolvedStyle === 'surge') {
      return (
        <div
          className={`versus versus-${resolvedStyle}`}
          style={vsStyle}
          data-lead={lead}
        >
          <div className={'vs-tug-top'}>
            {side(me, 'me')}
            {side(rival, 'rival')}
          </div>
          <div className={'vs-tug-bar'}>
            <i className={'vs-bar-me'} style={{ width: `${mePercent}%` }} />
            <i className={'vs-bar-rival'} style={{ width: `${100 - mePercent}%` }} />
            <span
              className={`vs-tug-diff lead-${lead}`}
              style={{ left: `${mePercent}%` }}
            >
              <b>{diffText}</b>
            </span>
          </div>
        </div>
      );
    }

    if (resolvedStyle === 'rivals') {
      const lines: { player: VersusPlayer; who: 'me' | 'rival'; percent: number }[] = [
        { player: me, who: 'me', percent: mePercent },
        { player: rival, who: 'rival', percent: 100 - mePercent },
      ];
      const leader = diff >= 0 ? me : rival;
      return (
        <div className={'versus versus-rivals'} style={vsStyle}>
          {lines.map(({ player, who, percent }) => (
            <div className={`vs-line vs-${who}`} key={who}>
              {orbFor(player)}
              <div className={'vs-line-main'}>
                <h2>
                  {flag(player)}
                  <span>{player.username}</span>
                </h2>
                <div className={'vs-line-bar'}>
                  <i style={{ width: `${percent}%` }} />
                </div>
              </div>
              <b className={'vs-line-elo'}>{String(player.elo)}</b>
            </div>
          ))}
          <div className={`vs-foot lead-${lead}`}>
            <span>
              {diff === 0 ? 'VS' : leader.username}
            </span>
            <b>{diffText}</b>
            <small>{translate('widget.versus.advantage')}</small>
          </div>
        </div>
      );
    }

    return (
      <div className={'versus versus-duel'} style={vsStyle}>
        {side(me, 'me')}
        {diffBadge}
        {side(rival, 'rival')}
      </div>
    );
  };

  const renderSoloExtra = () => {
    const name = username || previewUsername || 'Player';
    const avatarSrc = preview ? previewAvatar : avatar;
    const coverSrc = (preview ? previewBanner : banner) || avatarSrc;
    const levelBadge = SETTINGS.get('showLevelIcon') ? getIcon() : null;
    const statCell = (stat: StatisticType) => (
      <div className={'solo-stat'} key={`solo-${stat}`}>
        <small>{translate(`widget.${stat.toLowerCase()}`)}</small>
        <b>{getStat(stat) || <span className={'skeleton'}>??</span>}</b>
      </div>
    );
    const eloLine = (
      <p className={`solo-elo ${elo === 0 ? 'skeleton' : ''}`}>
        <b>{String(elo)}</b>
        {SETTINGS.get('showEloSuffix') && <small>ELO</small>}
        {SETTINGS.get('showEloDiff') && getEloDiff()}
      </p>
    );

    const kdNumber = preview ? 1.22 : avgMatches ? kdRatio / avgMatches : 0;
    const hsNumber = preview ? 48 : avgMatches ? hsPercent / avgMatches : 0;
    const winNumber = preview ? 56 : winsPercent;
    const dial = (label: string, text: string, fraction: number) => (
      <div className={'dial'} key={label}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className={'dial-track'} cx={50} cy={50} r={42} />
          <circle
            className={'dial-fill'}
            cx={50}
            cy={50}
            r={42}
            pathLength={100}
            strokeDasharray={`${Math.max(0, Math.min(1, fraction)) * 100} 100`}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <b>{text}</b>
        <small>{label}</small>
      </div>
    );

    if (resolvedStyle === 'ribbon') {
      return (
        <div className={'solo solo-ribbon'}>
          <div className={'ribbon-id'}>
            {levelBadge && <span className={'ribbon-level'}>{levelBadge}</span>}
            <div>
              <h2>{name}</h2>
              {eloLine}
            </div>
          </div>
          <div className={'solo-stats'}>
            <div className={'solo-stat win'}>
              <small>{translate('widget.wins')}</small>
              <b>{String(wins)}</b>
            </div>
            <div className={'solo-stat loss'}>
              <small>{translate('widget.losses')}</small>
              <b>{String(losses)}</b>
            </div>
            {stats.map(statCell)}
          </div>
        </div>
      );
    }

    if (resolvedStyle === 'tower') {
      return (
        <div className={'solo solo-tower'}>
          {renderOrb(avatarSrc, name, level, elo, levelBadge ?? undefined)}
          <h2>{name}</h2>
          {eloLine}
          <div className={'tower-rows'}>
            {stats.map((stat) => (
              <div className={'tower-row'} key={`tower-${stat}`}>
                <small>{translate(`widget.${stat.toLowerCase()}`)}</small>
                <b>{getStat(stat) || <span className={'skeleton'}>??</span>}</b>
              </div>
            ))}
          </div>
          <div className={'solo-pills'}>
            <span className={'win'}><b>{String(wins)}</b> {translate('widget.wins')}</span>
            <span className={'loss'}><b>{String(losses)}</b> {translate('widget.losses')}</span>
          </div>
        </div>
      );
    }

    if (resolvedStyle === 'dials') {
      return (
        <div className={'solo solo-dials'}>
          <div className={'dials-id'}>
            {levelBadge && <span className={'dials-level'}>{levelBadge}</span>}
            <h2>{name}</h2>
            {eloLine}
          </div>
          <div className={'dials-row'}>
            {dial(translate('widget.winratio'), `${winNumber}%`, winNumber / 100)}
            {dial('HS %', `${Math.round(hsNumber)}%`, hsNumber / 100)}
            {dial('K/D', kdNumber ? kdNumber.toFixed(2) : '?', kdNumber / 2)}
          </div>
        </div>
      );
    }

    if (resolvedStyle === 'marquee') {
      const chips = [
        <span className={'marq-chip win'} key="w"><small>{translate('widget.wins')}</small><b>{String(wins)}</b></span>,
        <span className={'marq-chip loss'} key="l"><small>{translate('widget.losses')}</small><b>{String(losses)}</b></span>,
        ...stats.map((stat) => (
          <span className={'marq-chip'} key={stat}>
            <small>{translate(`widget.${stat.toLowerCase()}`)}</small>
            <b>{getStat(stat) || '??'}</b>
          </span>
        )),
      ];
      return (
        <div className={'solo solo-marquee'}>
          <div className={'marq-head'}>
            {levelBadge && <span className={'marq-level'}>{levelBadge}</span>}
            <h2>{name}</h2>
            {eloLine}
          </div>
          <div className={'marq-track'}>
            <div
              className={'marq-belt'}
              style={{ '--marq-seconds': `${Number(SETTINGS.get('marqueeSeconds')) || 14}s` } as CSSProperties}
            >
              <div className={'marq-set'}>{chips}</div>
              <div className={'marq-set'} aria-hidden="true">{chips}</div>
            </div>
          </div>
        </div>
      );
    }

    if (resolvedStyle === 'gauge') {
      return (
        <div className={'solo solo-gauge'}>
          <div className={'gauge-dial'}>
            <svg viewBox="0 0 200 110" aria-hidden="true">
              <path className={'gauge-track'} d="M 20 100 A 80 80 0 0 1 180 100" pathLength={100} />
              <path
                className={'gauge-fill'}
                d="M 20 100 A 80 80 0 0 1 180 100"
                pathLength={100}
                strokeDasharray={`${levelRingFill * 100} 100`}
              />
            </svg>
            <div className={'gauge-center'}>
              {levelBadge && <span className={'gauge-level'}>{levelBadge}</span>}
              {eloLine}
            </div>
          </div>
          <h2>{name}</h2>
          <div className={'solo-pills'}>
            <span className={'win'}><b>{String(wins)}</b> {translate('widget.wins')}</span>
            <span className={'loss'}><b>{String(losses)}</b> {translate('widget.losses')}</span>
          </div>
        </div>
      );
    }

    if (resolvedStyle === 'card') {
      return (
        <div className={'solo solo-card'}>
          <div
            className={'card-cover'}
            style={coverSrc ? { backgroundImage: `url("${coverSrc}")` } : undefined}
          >
            {levelBadge && <span className={'card-level'}>{levelBadge}</span>}
          </div>
          <div className={'card-body'}>
            <h2>{name}</h2>
            {eloLine}
            <div className={'solo-stats'}>{stats.map(statCell)}</div>
          </div>
        </div>
      );
    }

    if (resolvedStyle === 'reel') {
      const active = stats[reelIndex % stats.length];
      return (
        <div className={'solo solo-reel'}>
          <div className={'reel-main'}>
            {levelBadge && <span className={'reel-level'}>{levelBadge}</span>}
            <div>
              <h2>{name}</h2>
              {eloLine}
            </div>
          </div>
          <div className={'reel-window'}>
            <div className={'reel-item'} key={`${active}-${reelIndex}`}>
              <small>{translate(`widget.${active.toLowerCase()}`)}</small>
              <b>{getStat(active) || <span className={'skeleton'}>??</span>}</b>
            </div>
            <div className={'reel-dots'}>
              {stats.map((stat, index) => (
                <i key={`dot-${stat}`} className={index === reelIndex % stats.length ? 'on' : ''} />
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={'solo solo-slab'}>
        {levelBadge && <span className={'slab-level'}>{levelBadge}</span>}
        <div className={'slab-id'}>
          <h2>{name}</h2>
          {eloLine}
        </div>
        <div className={'solo-stats'}>{stats.slice(0, 3).map(statCell)}</div>
      </div>
    );
  };

  const renderStatGrid = (list: StatisticType[], keyPrefix: string) => (
    <div className={'average deck-stats'}>
      {list.map((stat) => (
        <div className={'stat'} key={`${keyPrefix}-${stat}`}>
          <p>{translate(`widget.${stat.toLowerCase()}`)}</p>
          <p>{getStat(stat) || <span className={'skeleton'}>???</span>}</p>
        </div>
      ))}
    </div>
  );

  const deckSlides: BroadcastSlide[] = [];
  if (isDeckPreset) {
    const pageOn = (name: string) =>
      Boolean(SETTINGS.get(`${resolvedStyle}${name}` as SettingKey));
    if (pageOn('Profile')) {
      deckSlides.push({
        id: 'profile',
        label: translate('widget.page.profile'),
        content: <div className={'deck-profile'}>{renderHeaderCard(true)}</div>,
      });
    }
    if (pageOn('Form')) {
      deckSlides.push({
        id: 'form',
        label: translate('widget.page.form'),
        content: renderStatGrid(stats, 'form'),
      });
    }
    if (pageOn('Tactics')) {
      const tacticStats = [1, 2, 3, 4].map(
        (slot) =>
          SETTINGS.get(`${resolvedStyle}Stat${slot}` as SettingKey) as StatisticType
      );
      deckSlides.push({
        id: 'tactics',
        label: translate('widget.page.tactics'),
        content: renderStatGrid(tacticStats, 'tactics'),
      });
    }
    if (pageOn('Session')) {
      deckSlides.push({
        id: 'session',
        label: translate('widget.page.session'),
        content: <div className={'deck-session'}>{renderMatchesCard()}</div>,
      });
    }
    if (deckSlides.length === 0) {
      deckSlides.push({
        id: 'profile',
        label: translate('widget.page.profile'),
        content: <div className={'deck-profile'}>{renderHeaderCard(true)}</div>,
      });
    }
  }

  return (
    <>
      {SETTINGS.get('colorScheme') === 'custom' && (
        <style>{`
                .wrapper {
                    --text: #${SETTINGS.get('customTextColor')} !important;
                    --subtext: #${SETTINGS.get('customTextColor')} !important;
              --border-1: ${hexToRgba(SETTINGS.get('customBorderColor1') as string, SETTINGS.get('customBorderColor1Opacity') as number)} !important;
              --border-2: ${hexToRgba(SETTINGS.get('customBorderColor2') as string, SETTINGS.get('customBorderColor2Opacity') as number)} !important;
            ${SETTINGS.get('adjustBorderWidth') ? `--border-width: ${SETTINGS.get('borderWidth')}px !important;` : ''}
            ${SETTINGS.get('adjustBorderWidth') && (SETTINGS.get('borderWidth') as number) <= 0 ? `--border-overlay-opacity: 0 !important;` : ''}
                ${SETTINGS.get('adjustStatisticsSeparator') ? `--stats-separator-color: ${hexToRgba(SETTINGS.get('customStatisticsSeparatorColor') as string, SETTINGS.get('customStatisticsSeparatorOpacity') as number)} !important;` : ''}
            ${SETTINGS.get('adjustStatisticsSeparator') ? `--stats-separator-width: ${SETTINGS.get('statisticsSeparatorWidth')}px !important;` : ''}
                    --border-rotation: 0deg !important;
                    --background: #${SETTINGS.get('customBackgroundColor')} !important;
                }
            `}</style>
      )}
      {(SETTINGS.get('useBannerAsBackground') ||
        SETTINGS.get('useAvatarAsBackground')) && (
        <style>{`
                .wrapper {
                    --banner-url: url("${SETTINGS.get('useAvatarAsBackground') ? (preview ? previewAvatar : avatar) : preview ? previewBanner : banner}") !important;
                    ${SETTINGS.get('adjustBackgroundOpacity') ? `--banner-opacity: ${SETTINGS.get('backgroundOpacity')} !important;` : ''}
              ${SETTINGS.get('adjustBackgroundBlur') ? `--banner-blur: ${SETTINGS.get('backgroundBlur')}px !important;` : ''}
            --banner-radius: ${BANNER_RADIUS_MAP[SETTINGS.get('style')] ?? 12}px !important;
                }
            `}</style>
      )}
      {SETTINGS.get('widgetOpacity') !== 1 && (
        <style>{`.wrapper {
					--background-opacity: ${SETTINGS.get('widgetOpacity')} !important;
				}`}</style>
      )}
      {(SETTINGS.get('customInlineCSS') as string).trim().length > 0 && (
        <style>{SETTINGS.get('customInlineCSS') as string}</style>
      )}
      {SETTINGS.get('adjustLevelIconScale') && (
        <style>{`
                .wrapper .level svg.faceit-level {
                    transform: scale(${1 + (SETTINGS.get('levelIconScale') as number) / 100});
                    transform-origin: center center;
                }
            `}</style>
      )}
      {SETTINGS.get('adjustRankingIconScale') && (
        <style>{`
            .wrapper .flag {
              height: ${(0.7 * percentToFontScale(SETTINGS.get('rankingIconScale') as number)).toFixed(2)}rem !important;
              width: auto !important;
            }
          `}</style>
      )}
      {SETTINGS.get('adjustRankingFontSize') && (
        <style>{`
            .wrapper .widget .level .elo p.ranking {
              font-size: ${percentToFontScale(SETTINGS.get('rankingFontSize') as number)}em !important;
            }
          `}</style>
      )}
      {SETTINGS.get('adjustBannerFont') && (
        <style>{`
                .wrapper .widget,
                .wrapper .widget * {
                    font-family: ${BANNER_FONT_FAMILY_MAP[(SETTINGS.get('bannerFont') as string) || 'dm_sans'] || BANNER_FONT_FAMILY_MAP.dm_sans} !important;
                  }
                ${SETTINGS.get('adjustBannerFontWeightNickname') ? `.wrapper .widget .level .elo h2 { font-weight: ${percentToFontWeight(SETTINGS.get('bannerFontWeightNickname'))} !important; }` : ''}
                ${SETTINGS.get('adjustBannerFontWeightElo') ? `.wrapper .widget .level .elo p .elo-value { font-weight: ${percentToFontWeight(SETTINGS.get('bannerFontWeightElo'))} !important; }` : ''}
                ${SETTINGS.get('adjustBannerFontWeightEloSuffix') ? `.wrapper .widget .level .elo p .elo-suffix { font-weight: ${percentToFontWeight(SETTINGS.get('bannerFontWeightEloSuffix'))} !important; }` : ''}
                ${SETTINGS.get('adjustBannerFontWeightEloDiff') ? `.wrapper .widget .level .elo p .diff { font-weight: ${percentToFontWeight(SETTINGS.get('bannerFontWeightEloDiff'))} !important; }` : ''}
                ${SETTINGS.get('adjustBannerFontWeightWinsValue') ? `.wrapper .widget .matches .stat.green .stat-value { font-weight: ${percentToFontWeight(SETTINGS.get('bannerFontWeightWinsValue'))} !important; }` : ''}
                ${SETTINGS.get('adjustBannerFontWeightWinsLabel') ? `.wrapper .widget .matches .stat.green .stat-label { font-weight: ${percentToFontWeight(SETTINGS.get('bannerFontWeightWinsLabel'))} !important; }` : ''}
                ${SETTINGS.get('adjustBannerFontWeightLossesValue') ? `.wrapper .widget .matches .stat.red .stat-value { font-weight: ${percentToFontWeight(SETTINGS.get('bannerFontWeightLossesValue'))} !important; }` : ''}
                ${SETTINGS.get('adjustBannerFontWeightLossesLabel') ? `.wrapper .widget .matches .stat.red .stat-label { font-weight: ${percentToFontWeight(SETTINGS.get('bannerFontWeightLossesLabel'))} !important; }` : ''}
                ${SETTINGS.get('adjustBannerFontWeightStatistics') ? `.wrapper .widget .average .stat p { font-weight: ${percentToFontWeight(SETTINGS.get('bannerFontWeightStatistics'))} !important; }` : ''}
            `}</style>
      )}
      {SETTINGS.get('adjustBannerFontSize') && (
        <style>{`
            ${SETTINGS.get('adjustBannerFontSizeNickname') ? `.wrapper .widget .level .elo h2 { font-size: ${percentToFontScale(SETTINGS.get('bannerFontSizeNickname') as number)}em !important; }` : ''}
            ${SETTINGS.get('adjustBannerFontSizeElo') ? `.wrapper .widget .level .elo p .elo-value { font-size: ${percentToFontScale(SETTINGS.get('bannerFontSizeElo') as number)}em !important; }` : ''}
            ${SETTINGS.get('adjustBannerFontSizeEloSuffix') ? `.wrapper .widget .level .elo p .elo-suffix { font-size: ${percentToFontScale(SETTINGS.get('bannerFontSizeEloSuffix') as number)}em !important; }` : ''}
            ${SETTINGS.get('adjustBannerFontSizeEloDiff') ? `.wrapper .widget .level .elo p .diff { font-size: ${percentToFontScale(SETTINGS.get('bannerFontSizeEloDiff') as number)}em !important; }` : ''}
            ${SETTINGS.get('adjustBannerFontSizeWinsValue') ? `.wrapper .widget .matches .stat.green .stat-value, .wrapper .widget .deck-session .stat.green .stat-value { font-size: ${percentToFontScale(SETTINGS.get('bannerFontSizeWinsValue') as number)}em !important; }` : ''}
            ${SETTINGS.get('adjustBannerFontSizeWinsLabel') ? `.wrapper .widget .matches .stat.green .stat-label, .wrapper .widget .deck-session .stat.green .stat-label { font-size: ${percentToFontScale(SETTINGS.get('bannerFontSizeWinsLabel') as number)}em !important; }` : ''}
            ${SETTINGS.get('adjustBannerFontSizeLossesValue') ? `.wrapper .widget .matches .stat.red .stat-value, .wrapper .widget .deck-session .stat.red .stat-value { font-size: ${percentToFontScale(SETTINGS.get('bannerFontSizeLossesValue') as number)}em !important; }` : ''}
            ${SETTINGS.get('adjustBannerFontSizeLossesLabel') ? `.wrapper .widget .matches .stat.red .stat-label, .wrapper .widget .deck-session .stat.red .stat-label { font-size: ${percentToFontScale(SETTINGS.get('bannerFontSizeLossesLabel') as number)}em !important; }` : ''}
            ${SETTINGS.get('adjustBannerFontSizeStatistics') ? `.wrapper .widget .average .stat p, .wrapper .widget .deck-stats .stat p { font-size: ${percentToFontScale(SETTINGS.get('bannerFontSizeStatistics') as number)}em !important; }` : ''}
        `}</style>
      )}
      {SETTINGS.get('adjustEloSuffixSpacing') &&
        SETTINGS.get('showEloSuffix') && (
          <style>{`
                .wrapper .widget .level .elo p .elo-suffix {
                margin-left: ${SETTINGS.get('eloSuffixSpacing')}px !important;
                }
            `}</style>
        )}
      {isSizedBanner &&
        SETTINGS.get('bannerRadiusCustom') &&
        resolvedStyle !== 'pulse' && (
          <style>{`
                .wrapper.banner-design-2026 {
                  --banner-radius: ${SETTINGS.get('bannerRadius')}px !important;
                  border-radius: ${Number(SETTINGS.get('bannerRadius')) + 1}px !important;
                }
                .wrapper.banner-design-2026 .widget {
                  border-radius: ${SETTINGS.get('bannerRadius')}px !important;
                }
            `}</style>
        )}
      {SETTINGS.get('adjustBannerShadow') && (
        <style>{`
                .wrapper .widget {
                box-shadow: 0 ${Math.round((SETTINGS.get('bannerShadowStrength') as number) / 4)}px ${Math.round((SETTINGS.get('bannerShadowStrength') as number) * 0.8)}px ${hexToRgba(SETTINGS.get('bannerShadowColor') as string, SETTINGS.get('bannerShadowOpacity') as number)} !important;
                }
            `}</style>
      )}
      <div
        ref={wrapperRef}
        className={`wrapper banner-load-enter${compatibilityMode ? ' compatibility' : ''}${SETTINGS.get('bannerDesign') === '2026' && SETTINGS.get('style') !== 'custom' ? ' banner-design-2026' : ''}${bannerSize ? ' banner-fill' : ''}`}
        data-layout={resolvedStyle}
        data-density={
          resolvedStyle === 'broadcast'
            ? String(SETTINGS.get('broadcastDensity'))
            : undefined
        }
        data-tiles={
          resolvedStyle === 'broadcast'
            ? SETTINGS.get('broadcastTiles')
              ? 'on'
              : 'off'
            : undefined
        }
        data-stats-position={
          resolvedStyle === 'rail'
            ? String(SETTINGS.get('railStatsPosition'))
            : undefined
        }
        data-labels={
          resolvedStyle === 'rail'
            ? SETTINGS.get('railShowLabels')
              ? 'on'
              : 'off'
            : undefined
        }
        data-stats-layout={
          resolvedStyle === 'focus'
            ? String(SETTINGS.get('focusStatsLayout'))
            : undefined
        }
        data-large-elo={
          resolvedStyle === 'focus'
            ? SETTINGS.get('focusLargeElo')
              ? 'on'
              : 'off'
            : undefined
        }
        data-level-glow={
          isBroadcastPreset
            ? SETTINGS.get(`${resolvedStyle}LevelGlow` as SettingKey)
              ? 'on'
              : 'off'
            : undefined
        }
        data-rank={
          ['showcase', 'spotlight', 'broadcast'].includes(resolvedStyle)
            ? String(SETTINGS.get(`${resolvedStyle}RankPlace` as SettingKey))
            : undefined
        }
        style={
          {
            ...(bannerSize && bannerZoom
              ? {
                  width: `${bannerSize.layoutWidth}px`,
                  maxWidth: 'none',
                  ...(bannerSize.layoutHeight
                    ? { height: `${bannerSize.layoutHeight}px` }
                    : {}),
                  zoom: bannerZoom,
                }
              : {}),
            '--faceit-level': `var(--faceit-level-${currentEloDistribution[0]})`,
            ...(presetAccent
              ? {
                  '--preset-accent': `#${presetAccent}`,
                  '--preset-accent-soft': `#${presetAccent}33`,
                }
              : {}),
            ...(isBroadcastPreset
              ? { '--level-glow': `${SETTINGS.get(`${resolvedStyle}LevelGlowStrength` as SettingKey)}px` }
              : {}),
          } as CSSProperties
        }
      >
        <UpdateIntro enabled={SETTINGS.get('showUpdateIntro')} language={language} replay={introReplay} />
        <div
          className={`widget ${SETTINGS.get('useBannerAsBackground') || SETTINGS.get('useAvatarAsBackground') ? 'banner' : ''}`}
        >
          {isSoloExtra ? (
            renderSoloExtra()
          ) : isVersus ? (
            renderVersus()
          ) : isTicker ? (
            renderTicker()
          ) : isDeckPreset ? (
            <BroadcastDeck
              slides={deckSlides}
              seconds={Number(SETTINGS.get(`${resolvedStyle}Seconds` as SettingKey))}
              motion={String(SETTINGS.get(`${resolvedStyle}Motion` as SettingKey))}
              autoplay={Boolean(SETTINGS.get(`${resolvedStyle}Autoplay` as SettingKey))}
              glow={Boolean(SETTINGS.get(`${resolvedStyle}Glow` as SettingKey))}
              intro={Boolean(SETTINGS.get('showUpdateIntro'))}
              title={translate('widget.deck.title')}
              pauseLabel={translate('widget.deck.pause')}
              playLabel={translate('widget.deck.play')}
            />
          ) : isAnimatedStyle ? (
            <div
              className={'animated-deck'}
              style={
                animatedDeckHeight > 0
                  ? ({ minHeight: `${animatedDeckHeight}px` } as CSSProperties)
                  : undefined
              }
            >
              <div className={'animated-deck-measure'} ref={animatedMeasureRef}>
                {animatedCardOrder.map((entry) => (
                  <div
                    key={`animated-measure-${entry.key}`}
                    className={`animated-card ${entry.key}`}
                  >
                    {entry.key === 'header' && renderHeaderCard(true)}
                    {entry.key === 'stats' && renderStatsCard()}
                    {entry.key === 'matches' && renderMatchesCard()}
                  </div>
                ))}
              </div>
              {animatedCardOrder.length > 0 && (
                <div
                  key={`animated-card-${animatedCardOrder[animatedDeckIndex].key}-${animatedDeckIndex}`}
                  className={`animated-card ${animatedCardOrder[animatedDeckIndex].key} anim-${String(SETTINGS.get('animatedDeckAnimation') || 'fade').replace(/_/g, '-')}`}
                >
                  {animatedCardOrder[animatedDeckIndex].key === 'header' &&
                    renderHeaderCard(true)}
                  {animatedCardOrder[animatedDeckIndex].key === 'stats' &&
                    renderStatsCard()}
                  {animatedCardOrder[animatedDeckIndex].key === 'matches' &&
                    renderMatchesCard()}
                </div>
              )}
            </div>
          ) : (
            <>
              {isStaticPreset && (
                <div className="broadcast-kicker">
                  <span>
                    FACEIT <b>/</b> CS2
                  </span>
                  <span>{translate('widget.session')}</span>
                </div>
              )}
              <div className={'player-stats'}>
                {renderHeaderCard(false)}
                <div className={'matches'}>
                  <div className={'stats'}>
                    <Statistic
                      color={'green'}
                      value={String(wins)}
                      text={translate('widget.wins')}
                    />
                    <Statistic
                      color={'red'}
                      value={String(losses)}
                      text={translate('widget.losses')}
                    />
                  </div>
                </div>
              </div>
              {SETTINGS.get('showStatistics') && (
                <div className={'average'}>
                  {stats.map((stat) => {
                    return (
                      <div className={'stat'} key={`default-stat-${stat}`}>
                        <p>{translate(`widget.${stat.toLowerCase()}`)}</p>
                        <p>
                          {getStat(stat) || (
                            <span className={'skeleton'}>???</span>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
              {SETTINGS.get('showEloProgressBar') && (
                <div className={'progress-bar'}>
                  <div
                    className={'progress'}
                    style={{
                      width:
                        level === 10
                          ? '100%'
                          : `${((elo - (currentEloDistribution[1][1] as number)) / ((currentEloDistribution[1][2] as number) - (currentEloDistribution[1][1] as number))) * 100}%`,
                    }}
                  ></div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};
