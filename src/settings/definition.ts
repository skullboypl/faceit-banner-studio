import { colorSchemes, styles } from '../../widget/src/styles/styles';
import { languages } from '../translations/translations';
import { SettingDefinition } from './manager';

const HEX_REGEXP = /^[0-9a-fA-F]{3,8}$/;
const BANNER_FONT_OPTIONS = [
  'dm_sans',
  'arial',
  'comic_sans_ms',
  'courier_new',
  'garamond',
  'georgia',
  'helvetica',
  'impact',
  'inter',
  'lucida_sans',
  'merriweather',
  'montserrat',
  'open_sans',
  'oswald',
  'palatino_linotype',
  'playfair_display',
  'poppins',
  'roboto',
  'segoe_ui',
  'tahoma',
  'times_new_roman',
  'trebuchet_ms',
  'verdana',
  'kick_font',
];

export const SETTINGS_DEFINITIONS = {
  "orbitAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["orbit_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "orbit" }],
    "regex": HEX_REGEXP
  },
  "orbitLevelGlow": {
    "type": "boolean",
    "defaultValue": true,
    "query": ["orbit_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "orbit" }]
  },
  "orbitLevelGlowStrength": {
    "type": "number",
    "defaultValue": 8,
    "min": 2,
    "max": 20,
    "query": ["orbit_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "orbit" }, { "setting": "orbitLevelGlow", "value": true }]
  },
  "haloAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["halo_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "halo" }],
    "regex": HEX_REGEXP
  },
  "haloLevelGlow": {
    "type": "boolean",
    "defaultValue": true,
    "query": ["halo_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "halo" }]
  },
  "haloLevelGlowStrength": {
    "type": "number",
    "defaultValue": 8,
    "min": 2,
    "max": 20,
    "query": ["halo_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "halo" }, { "setting": "haloLevelGlow", "value": true }]
  },
  "pulseAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["pulse_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "pulse" }],
    "regex": HEX_REGEXP
  },
  "pulseLevelGlow": {
    "type": "boolean",
    "defaultValue": true,
    "query": ["pulse_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "pulse" }]
  },
  "pulseLevelGlowStrength": {
    "type": "number",
    "defaultValue": 8,
    "min": 2,
    "max": 20,
    "query": ["pulse_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "pulse" }, { "setting": "pulseLevelGlow", "value": true }]
  },
  "tickerAccent": {
    "type": "string",
    "defaultValue": "e7002c",
    "query": ["ticker_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "ticker" }],
    "regex": HEX_REGEXP
  },
  "tickerLevelGlow": {
    "type": "boolean",
    "defaultValue": false,
    "query": ["ticker_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "ticker" }]
  },
  "tickerLevelGlowStrength": {
    "type": "number",
    "defaultValue": 8,
    "min": 2,
    "max": 20,
    "query": ["ticker_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "ticker" }, { "setting": "tickerLevelGlow", "value": true }]
  },
  "tickerAutoplay": {
    "type": "boolean",
    "defaultValue": true,
    "query": ["ticker_autoplay"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "ticker" }]
  },
  "tickerSeconds": {
    "type": "number",
    "defaultValue": 6,
    "min": 3,
    "max": 20,
    "query": ["ticker_seconds"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "ticker" }]
  },
  "tickerHeadStat": {
    "type": "statistic_type",
    "defaultValue": "KD",
    "query": ["ticker_head_stat"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "ticker" }]
  },
  widgetMode: {
    type: 'string',
    defaultValue: 'solo',
    options: ['solo', 'versus'],
    query: ['mode'],
  },
  opponentId: {
    type: 'string',
    defaultValue: undefined,
    query: ['opponent_id'],
  },
  opponentName: {
    type: 'string',
    defaultValue: 'PAGO',
  },
  versusOpponentAccent: {
    type: 'string',
    defaultValue: '3b82f6',
    query: ['versus_opponent_accent'],
    regex: HEX_REGEXP,
  },
  "duelAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["duel_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "duel" }],
    "regex": HEX_REGEXP
  },
  "edgeAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["edge_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "edge" }],
    "regex": HEX_REGEXP
  },
  "faceoffAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["faceoff_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "faceoff" }],
    "regex": HEX_REGEXP
  },
  "clashAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["clash_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "clash" }],
    "regex": HEX_REGEXP
  },
  "tugAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["tug_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "tug" }],
    "regex": HEX_REGEXP
  },
  "rivalsAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["rivals_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "rivals" }],
    "regex": HEX_REGEXP
  },
  "matchupAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["matchup_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "matchup" }],
    "regex": HEX_REGEXP
  },
  "scoreboardAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["scoreboard_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "scoreboard" }],
    "regex": HEX_REGEXP
  },
  "cycleAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["cycle_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "cycle" }],
    "regex": HEX_REGEXP
  },
  "surgeAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["surge_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "surge" }],
    "regex": HEX_REGEXP
  },
  "cycleAutoplay": {
    "type": "boolean",
    "defaultValue": true,
    "query": ["cycle_autoplay"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "cycle" }]
  },
  "cycleSeconds": {
    "type": "number",
    "defaultValue": 5,
    "min": 3,
    "max": 20,
    "query": ["cycle_seconds"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "cycle" }]
  },
  "slabAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["slab_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "slab" }],
    "regex": HEX_REGEXP
  },
  "slabLevelGlow": {
    "type": "boolean",
    "defaultValue": false,
    "query": ["slab_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "slab" }]
  },
  "slabLevelGlowStrength": {
    "type": "number",
    "defaultValue": 8,
    "min": 2,
    "max": 20,
    "query": ["slab_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "slab" }, { "setting": "slabLevelGlow", "value": true }]
  },
  "gaugeAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["gauge_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "gauge" }],
    "regex": HEX_REGEXP
  },
  "gaugeLevelGlow": {
    "type": "boolean",
    "defaultValue": false,
    "query": ["gauge_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "gauge" }]
  },
  "gaugeLevelGlowStrength": {
    "type": "number",
    "defaultValue": 8,
    "min": 2,
    "max": 20,
    "query": ["gauge_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "gauge" }, { "setting": "gaugeLevelGlow", "value": true }]
  },
  "cardAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["card_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "card" }],
    "regex": HEX_REGEXP
  },
  "cardLevelGlow": {
    "type": "boolean",
    "defaultValue": false,
    "query": ["card_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "card" }]
  },
  "cardLevelGlowStrength": {
    "type": "number",
    "defaultValue": 8,
    "min": 2,
    "max": 20,
    "query": ["card_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "card" }, { "setting": "cardLevelGlow", "value": true }]
  },
  "reelAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["reel_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "reel" }],
    "regex": HEX_REGEXP
  },
  "reelLevelGlow": {
    "type": "boolean",
    "defaultValue": false,
    "query": ["reel_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "reel" }]
  },
  "reelLevelGlowStrength": {
    "type": "number",
    "defaultValue": 8,
    "min": 2,
    "max": 20,
    "query": ["reel_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "reel" }, { "setting": "reelLevelGlow", "value": true }]
  },
  "reelAutoplay": {
    "type": "boolean",
    "defaultValue": true,
    "query": ["reel_autoplay"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "reel" }]
  },
  "reelSeconds": {
    "type": "number",
    "defaultValue": 4,
    "min": 2,
    "max": 20,
    "query": ["reel_seconds"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "reel" }]
  },
  "ribbonAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["ribbon_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "ribbon" }],
    "regex": HEX_REGEXP
  },
  "ribbonLevelGlow": {
    "type": "boolean",
    "defaultValue": false,
    "query": ["ribbon_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "ribbon" }]
  },
  "ribbonLevelGlowStrength": {
    "type": "number",
    "defaultValue": 8,
    "min": 2,
    "max": 20,
    "query": ["ribbon_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "ribbon" }, { "setting": "ribbonLevelGlow", "value": true }]
  },
  "towerAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["tower_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "tower" }],
    "regex": HEX_REGEXP
  },
  "towerLevelGlow": {
    "type": "boolean",
    "defaultValue": false,
    "query": ["tower_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "tower" }]
  },
  "towerLevelGlowStrength": {
    "type": "number",
    "defaultValue": 8,
    "min": 2,
    "max": 20,
    "query": ["tower_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "tower" }, { "setting": "towerLevelGlow", "value": true }]
  },
  "dialsAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["dials_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "dials" }],
    "regex": HEX_REGEXP
  },
  "dialsLevelGlow": {
    "type": "boolean",
    "defaultValue": false,
    "query": ["dials_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "dials" }]
  },
  "dialsLevelGlowStrength": {
    "type": "number",
    "defaultValue": 8,
    "min": 2,
    "max": 20,
    "query": ["dials_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "dials" }, { "setting": "dialsLevelGlow", "value": true }]
  },
  "marqueeAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["marquee_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "marquee" }],
    "regex": HEX_REGEXP
  },
  "marqueeLevelGlow": {
    "type": "boolean",
    "defaultValue": false,
    "query": ["marquee_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "marquee" }]
  },
  "marqueeLevelGlowStrength": {
    "type": "number",
    "defaultValue": 8,
    "min": 2,
    "max": 20,
    "query": ["marquee_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "marquee" }, { "setting": "marqueeLevelGlow", "value": true }]
  },
  "tallyAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["tally_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "tally" }],
    "regex": HEX_REGEXP
  },
  "overlayAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["overlay_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "overlay" }],
    "regex": HEX_REGEXP
  },
  "ladderAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["ladder_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "ladder" }],
    "regex": HEX_REGEXP
  },
  "marqueeSeconds": {
    "type": "number",
    "defaultValue": 14,
    "min": 6,
    "max": 40,
    "query": ["marquee_seconds"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "marquee" }]
  },
  "primeAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": ["prime_accent"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "prime" }],
    "regex": HEX_REGEXP
  },
  "primeLevelGlow": {
    "type": "boolean",
    "defaultValue": false,
    "query": ["prime_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "prime" }]
  },
  "primeLevelGlowStrength": {
    "type": "number",
    "defaultValue": 8,
    "min": 2,
    "max": 20,
    "query": ["prime_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "prime" }, { "setting": "primeLevelGlow", "value": true }]
  },
  "broadcastAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": [
      "broadcast_accent"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "broadcast"
      }
    ],
    "regex": HEX_REGEXP
  },
  "railAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": [
      "rail_accent"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "rail"
      }
    ],
    "regex": HEX_REGEXP
  },
  "focusAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": [
      "focus_accent"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "focus"
      }
    ],
    "regex": HEX_REGEXP
  },
  "showcaseAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": [
      "showcase_accent"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "showcase"
      }
    ],
    "regex": HEX_REGEXP
  },
  "spotlightAccent": {
    "type": "string",
    "defaultValue": "ff5900",
    "query": [
      "spotlight_accent"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "spotlight"
      }
    ],
    "regex": HEX_REGEXP
  },
  "broadcastDensity": {
    "type": "string",
    "defaultValue": "comfortable",
    "query": [
      "broadcast_density"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "broadcast"
      }
    ],
    "options": [
      "comfortable",
      "compact"
    ]
  },
  "broadcastTiles": {
    "type": "boolean",
    "defaultValue": true,
    "query": [
      "broadcast_tiles"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "broadcast"
      }
    ]
  },
  "railStatsPosition": {
    "type": "string",
    "defaultValue": "right",
    "query": [
      "rail_stats_position"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "rail"
      }
    ],
    "options": [
      "right",
      "below"
    ]
  },
  "railShowLabels": {
    "type": "boolean",
    "defaultValue": true,
    "query": [
      "rail_show_labels"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "rail"
      }
    ]
  },
  "focusStatsLayout": {
    "type": "string",
    "defaultValue": "grid",
    "query": [
      "focus_stats_layout"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "focus"
      }
    ],
    "options": [
      "grid",
      "rows"
    ]
  },
  "focusLargeElo": {
    "type": "boolean",
    "defaultValue": true,
    "query": [
      "focus_large_elo"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "focus"
      }
    ]
  },
  "showcaseLevelGlow": {
    "type": "boolean",
    "defaultValue": true,
    "query": ["showcase_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "showcase" }]
  },
  "showcaseLevelGlowStrength": {
    "type": "number",
    "defaultValue": 8,
    "min": 2,
    "max": 20,
    "query": ["showcase_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "showcase" }, { "setting": "showcaseLevelGlow", "value": true }]
  },
  "showcaseRankPlace": {
    "type": "string",
    "defaultValue": "beside",
    "options": ["beside", "under"],
    "query": ["showcase_rank_place"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "showcase" }]
  },
  "spotlightLevelGlow": {
    "type": "boolean",
    "defaultValue": true,
    "query": ["spotlight_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "spotlight" }]
  },
  "spotlightLevelGlowStrength": {
    "type": "number",
    "defaultValue": 8,
    "min": 2,
    "max": 20,
    "query": ["spotlight_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "spotlight" }, { "setting": "spotlightLevelGlow", "value": true }]
  },
  "spotlightRankPlace": {
    "type": "string",
    "defaultValue": "beside",
    "options": ["beside", "under"],
    "query": ["spotlight_rank_place"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "spotlight" }]
  },
  "broadcastLevelGlow": {
    "type": "boolean",
    "defaultValue": false,
    "query": ["broadcast_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "broadcast" }]
  },
  "broadcastLevelGlowStrength": {
    "type": "number",
    "defaultValue": 8,
    "min": 2,
    "max": 20,
    "query": ["broadcast_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "broadcast" }, { "setting": "broadcastLevelGlow", "value": true }]
  },
  "broadcastRankPlace": {
    "type": "string",
    "defaultValue": "beside",
    "options": ["beside", "under"],
    "query": ["broadcast_rank_place"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "broadcast" }]
  },
  "railLevelGlow": {
    "type": "boolean",
    "defaultValue": false,
    "query": ["rail_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "rail" }]
  },
  "railLevelGlowStrength": {
    "type": "number",
    "defaultValue": 6,
    "min": 2,
    "max": 20,
    "query": ["rail_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "rail" }, { "setting": "railLevelGlow", "value": true }]
  },
  "focusLevelGlow": {
    "type": "boolean",
    "defaultValue": false,
    "query": ["focus_level_glow"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "focus" }]
  },
  "focusLevelGlowStrength": {
    "type": "number",
    "defaultValue": 8,
    "min": 2,
    "max": 20,
    "query": ["focus_level_glow_strength"],
    "requirements": [{ "setting": "bannerDesign", "value": "2026" }, { "setting": "style", "value": "focus" }, { "setting": "focusLevelGlow", "value": true }]
  },
  "showcaseSeconds": {
    "type": "number",
    "defaultValue": 6,
    "query": [
      "showcase_seconds"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "showcase"
      }
    ],
    "min": 3,
    "max": 20
  },
  "showcaseMotion": {
    "type": "string",
    "defaultValue": "slide",
    "query": [
      "showcase_motion"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "showcase"
      }
    ],
    "options": [
      "slide",
      "flip",
      "fade"
    ]
  },
  "showcaseAutoplay": {
    "type": "boolean",
    "defaultValue": true,
    "query": [
      "showcase_autoplay"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "showcase"
      }
    ]
  },
  "showcaseGlow": {
    "type": "boolean",
    "defaultValue": true,
    "query": [
      "showcase_glow"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "showcase"
      }
    ]
  },
  "showcaseProfile": {
    "type": "boolean",
    "defaultValue": true,
    "query": [
      "showcase_profile"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "showcase"
      }
    ]
  },
  "showcaseForm": {
    "type": "boolean",
    "defaultValue": true,
    "query": [
      "showcase_form"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "showcase"
      }
    ]
  },
  "showcaseTactics": {
    "type": "boolean",
    "defaultValue": true,
    "query": [
      "showcase_tactics"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "showcase"
      }
    ]
  },
  "showcaseSession": {
    "type": "boolean",
    "defaultValue": true,
    "query": [
      "showcase_session"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "showcase"
      }
    ]
  },
  "showcaseStat1": {
    "type": "statistic_type",
    "defaultValue": "ADR",
    "query": [
      "showcase_stat1"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "showcase"
      }
    ],
    "options": [
      "KILLS",
      "DEATHS",
      "ADR",
      "ASSISTS",
      "MVPS",
      "KR",
      "WINRATIO",
      "HSPERCENT",
      "KD",
      "RANKING",
      "WINSTREAK",
      "ENTRYRATE",
      "UTILITY",
      "FLASHRATE"
    ]
  },
  "showcaseStat2": {
    "type": "statistic_type",
    "defaultValue": "KR",
    "query": [
      "showcase_stat2"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "showcase"
      }
    ],
    "options": [
      "KILLS",
      "DEATHS",
      "ADR",
      "ASSISTS",
      "MVPS",
      "KR",
      "WINRATIO",
      "HSPERCENT",
      "KD",
      "RANKING",
      "WINSTREAK",
      "ENTRYRATE",
      "UTILITY",
      "FLASHRATE"
    ]
  },
  "showcaseStat3": {
    "type": "statistic_type",
    "defaultValue": "ENTRYRATE",
    "query": [
      "showcase_stat3"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "showcase"
      }
    ],
    "options": [
      "KILLS",
      "DEATHS",
      "ADR",
      "ASSISTS",
      "MVPS",
      "KR",
      "WINRATIO",
      "HSPERCENT",
      "KD",
      "RANKING",
      "WINSTREAK",
      "ENTRYRATE",
      "UTILITY",
      "FLASHRATE"
    ]
  },
  "showcaseStat4": {
    "type": "statistic_type",
    "defaultValue": "FLASHRATE",
    "query": [
      "showcase_stat4"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "showcase"
      }
    ],
    "options": [
      "KILLS",
      "DEATHS",
      "ADR",
      "ASSISTS",
      "MVPS",
      "KR",
      "WINRATIO",
      "HSPERCENT",
      "KD",
      "RANKING",
      "WINSTREAK",
      "ENTRYRATE",
      "UTILITY",
      "FLASHRATE"
    ]
  },
  "spotlightSeconds": {
    "type": "number",
    "defaultValue": 5,
    "query": [
      "spotlight_seconds"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "spotlight"
      }
    ],
    "min": 3,
    "max": 20
  },
  "spotlightMotion": {
    "type": "string",
    "defaultValue": "flip",
    "query": [
      "spotlight_motion"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "spotlight"
      }
    ],
    "options": [
      "slide",
      "flip",
      "fade"
    ]
  },
  "spotlightAutoplay": {
    "type": "boolean",
    "defaultValue": true,
    "query": [
      "spotlight_autoplay"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "spotlight"
      }
    ]
  },
  "spotlightGlow": {
    "type": "boolean",
    "defaultValue": true,
    "query": [
      "spotlight_glow"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "spotlight"
      }
    ]
  },
  "spotlightProfile": {
    "type": "boolean",
    "defaultValue": true,
    "query": [
      "spotlight_profile"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "spotlight"
      }
    ]
  },
  "spotlightForm": {
    "type": "boolean",
    "defaultValue": true,
    "query": [
      "spotlight_form"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "spotlight"
      }
    ]
  },
  "spotlightTactics": {
    "type": "boolean",
    "defaultValue": false,
    "query": [
      "spotlight_tactics"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "spotlight"
      }
    ]
  },
  "spotlightSession": {
    "type": "boolean",
    "defaultValue": true,
    "query": [
      "spotlight_session"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "spotlight"
      }
    ]
  },
  "spotlightStat1": {
    "type": "statistic_type",
    "defaultValue": "ADR",
    "query": [
      "spotlight_stat1"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "spotlight"
      }
    ],
    "options": [
      "KILLS",
      "DEATHS",
      "ADR",
      "ASSISTS",
      "MVPS",
      "KR",
      "WINRATIO",
      "HSPERCENT",
      "KD",
      "RANKING",
      "WINSTREAK",
      "ENTRYRATE",
      "UTILITY",
      "FLASHRATE"
    ]
  },
  "spotlightStat2": {
    "type": "statistic_type",
    "defaultValue": "KR",
    "query": [
      "spotlight_stat2"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "spotlight"
      }
    ],
    "options": [
      "KILLS",
      "DEATHS",
      "ADR",
      "ASSISTS",
      "MVPS",
      "KR",
      "WINRATIO",
      "HSPERCENT",
      "KD",
      "RANKING",
      "WINSTREAK",
      "ENTRYRATE",
      "UTILITY",
      "FLASHRATE"
    ]
  },
  "spotlightStat3": {
    "type": "statistic_type",
    "defaultValue": "ENTRYRATE",
    "query": [
      "spotlight_stat3"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "spotlight"
      }
    ],
    "options": [
      "KILLS",
      "DEATHS",
      "ADR",
      "ASSISTS",
      "MVPS",
      "KR",
      "WINRATIO",
      "HSPERCENT",
      "KD",
      "RANKING",
      "WINSTREAK",
      "ENTRYRATE",
      "UTILITY",
      "FLASHRATE"
    ]
  },
  "spotlightStat4": {
    "type": "statistic_type",
    "defaultValue": "FLASHRATE",
    "query": [
      "spotlight_stat4"
    ],
    "requirements": [
      {
        "setting": "bannerDesign",
        "value": "2026"
      },
      {
        "setting": "style",
        "value": "spotlight"
      }
    ],
    "options": [
      "KILLS",
      "DEATHS",
      "ADR",
      "ASSISTS",
      "MVPS",
      "KR",
      "WINRATIO",
      "HSPERCENT",
      "KD",
      "RANKING",
      "WINSTREAK",
      "ENTRYRATE",
      "UTILITY",
      "FLASHRATE"
    ]
  },
  bannerDesign: {
    type: 'string',
    defaultValue: '2026',
    defaultWidgetValue: 'legacy',
    options: ['2026', 'legacy'],
    query: ['design'],
  },
  showUpdateIntro: {
    type: 'boolean',
    defaultValue: true,
    query: ['intro'],
  },
  widgetLanguage: {
    type: 'string_undefined',
    defaultValue: undefined,
    options: [...languages.map((language) => language.id), undefined],
    query: ['lang'],
  },
  playerId: {
    type: 'string',
    defaultValue: undefined,
    query: ['player_id'],
  },
  bannerRadiusCustom: {
    type: 'boolean',
    defaultValue: false,
    query: ['banner_radius_custom'],
  },
  bannerRadius: {
    type: 'number',
    defaultValue: 14,
    min: 0,
    max: 48,
    query: ['banner_radius'],
  },
  bannerWidthMode: {
    type: 'string',
    defaultValue: 'recommended',
    options: ['auto', 'manual', 'recommended'],
    query: ['banner_width_mode'],
  },
  bannerWidth: {
    type: 'number',
    defaultValue: 500,
    min: 100,
    max: 1600,
    query: ['banner_width'],
  },
  bannerHeightMode: {
    type: 'string',
    defaultValue: 'recommended',
    options: ['auto', 'manual', 'recommended'],
    query: ['banner_height_mode'],
  },
  bannerHeight: {
    type: 'number',
    defaultValue: 300,
    min: 50,
    max: 1000,
    query: ['banner_height'],
  },
  autoWidth: {
    type: 'boolean',
    defaultValue: true,
    defaultWidgetValue: false,
    query: ['auto_width'],
  },
  onlyOfficialMatchesCount: {
    type: 'boolean',
    defaultValue: true,
    query: ['only_official'],
  },
  showRanking: {
    type: 'ranking_state',
    defaultValue: 2,
    defaultWidgetValue: 0,
    query: ['ranking'],
  },
  showEloDiff: {
    type: 'boolean',
    defaultValue: true,
    query: ['diff'],
  },
  showWinsLosses: {
    type: 'boolean',
    defaultValue: true,
    query: ['wins'],
  },
  hideBannerHeader: {
    type: 'boolean',
    defaultValue: false,
    query: ['hide_header'],
  },
  showIcons: {
    type: 'boolean',
    defaultValue: false,
    defaultWidgetValue: false,
    query: ['icons'],
  },
  showLevelIcon: {
    type: 'boolean',
    defaultValue: true,
    query: ['level_icon'],
  },
  showUsername: {
    type: 'boolean',
    defaultValue: true,
    query: ['name'],
  },
  showVerifiedBadge: {
    type: 'boolean',
    defaultValue: false,
    defaultWidgetValue: false,
    query: ['verified_badge'],
  },
  showEloSuffix: {
    type: 'boolean',
    defaultValue: true,
    query: ['suffix'],
  },
  showStatistics: {
    type: 'boolean',
    defaultValue: true,
    defaultWidgetValue: false,
    query: ['show_stats', 'avg'],
  },
  showEloProgressBar: {
    type: 'boolean',
    defaultValue: true,
    defaultWidgetValue: false,
    query: ['progress', 'eloBar'],
  },
  useBannerAsBackground: {
    type: 'boolean',
    defaultValue: true,
    defaultWidgetValue: false,
    query: ['banner'],
  },
  useAvatarAsBackground: {
    type: 'boolean',
    defaultValue: false,
    defaultWidgetValue: false,
    query: ['avatar'],
  },
  adjustBackgroundOpacity: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bg_opacity'],
  },
  adjustBackgroundBlur: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bg_blur'],
  },
  adjustBannerShadow: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_banner_shadow'],
  },
  adjustEloSuffixSpacing: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_elo_suffix_spacing'],
  },
  adjustLevelIconScale: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_level_icon_scale'],
  },
  adjustRankingIconScale: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_ranking_icon_scale'],
  },
  adjustRankingFontSize: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_ranking_font_size'],
  },
  adjustBannerFont: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_banner_font'],
  },
  adjustBannerFontSize: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_banner_font_size'],
  },
  backgroundOpacity: {
    type: 'number',
    defaultValue: 0.15,
    min: 0,
    max: 1,
    query: ['banner_opacity'],
    requirements: [
      {
        setting: 'adjustBackgroundOpacity',
        value: true,
      },
    ],
  },
  backgroundBlur: {
    type: 'number',
    defaultValue: 2,
    min: 0,
    max: 20,
    query: ['banner_blur'],
    requirements: [
      {
        setting: 'adjustBackgroundBlur',
        value: true,
      },
    ],
  },
  bannerShadowColor: {
    type: 'string',
    defaultValue: '000000',
    regex: HEX_REGEXP,
    query: ['banner_shadow_color'],
    requirements: [
      {
        setting: 'adjustBannerShadow',
        value: true,
      },
    ],
  },
  bannerShadowOpacity: {
    type: 'number',
    defaultValue: 0.35,
    min: 0,
    max: 1,
    query: ['banner_shadow_opacity'],
    requirements: [
      {
        setting: 'adjustBannerShadow',
        value: true,
      },
    ],
  },
  bannerShadowStrength: {
    type: 'number',
    defaultValue: 35,
    min: 0,
    max: 100,
    query: ['banner_shadow_strength'],
    requirements: [
      {
        setting: 'adjustBannerShadow',
        value: true,
      },
    ],
  },
  eloSuffixSpacing: {
    type: 'number',
    defaultValue: 4,
    min: 0,
    max: 20,
    query: ['elo_suffix_spacing'],
    requirements: [
      {
        setting: 'adjustEloSuffixSpacing',
        value: true,
      },
    ],
  },
  levelIconScale: {
    type: 'number',
    defaultValue: 0,
    min: -50,
    max: 50,
    query: ['level_icon_scale'],
    requirements: [
      {
        setting: 'adjustLevelIconScale',
        value: true,
      },
    ],
  },
  rankingIconScale: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['ranking_icon_scale'],
    requirements: [
      {
        setting: 'adjustRankingIconScale',
        value: true,
      },
    ],
  },
  rankingFontSize: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['ranking_font_size'],
    requirements: [
      {
        setting: 'adjustRankingFontSize',
        value: true,
      },
    ],
  },
  bannerFont: {
    type: 'string',
    defaultValue: 'dm_sans',
    options: BANNER_FONT_OPTIONS,
    query: ['banner_font'],
    requirements: [
      {
        setting: 'adjustBannerFont',
        value: true,
      },
    ],
  },
  adjustBannerFontWeightNickname: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfw_nick'],
    requirements: [{ setting: 'adjustBannerFont', value: true }],
  },
  bannerFontWeightNickname: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfw_nick'],
    requirements: [
      { setting: 'adjustBannerFont', value: true },
      { setting: 'adjustBannerFontWeightNickname', value: true },
    ],
  },
  adjustBannerFontSizeNickname: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfs_nick'],
    requirements: [{ setting: 'adjustBannerFontSize', value: true }],
  },
  bannerFontSizeNickname: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfs_nick'],
    requirements: [
      { setting: 'adjustBannerFontSize', value: true },
      { setting: 'adjustBannerFontSizeNickname', value: true },
    ],
  },
  adjustBannerFontWeightElo: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfw_elo'],
    requirements: [{ setting: 'adjustBannerFont', value: true }],
  },
  bannerFontWeightElo: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfw_elo'],
    requirements: [
      { setting: 'adjustBannerFont', value: true },
      { setting: 'adjustBannerFontWeightElo', value: true },
    ],
  },
  adjustBannerFontSizeElo: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfs_elo'],
    requirements: [{ setting: 'adjustBannerFontSize', value: true }],
  },
  bannerFontSizeElo: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfs_elo'],
    requirements: [
      { setting: 'adjustBannerFontSize', value: true },
      { setting: 'adjustBannerFontSizeElo', value: true },
    ],
  },
  adjustBannerFontWeightEloSuffix: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfw_elo_suffix'],
    requirements: [{ setting: 'adjustBannerFont', value: true }],
  },
  bannerFontWeightEloSuffix: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfw_elo_suffix'],
    requirements: [
      { setting: 'adjustBannerFont', value: true },
      { setting: 'adjustBannerFontWeightEloSuffix', value: true },
    ],
  },
  adjustBannerFontSizeEloSuffix: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfs_elo_suffix'],
    requirements: [{ setting: 'adjustBannerFontSize', value: true }],
  },
  bannerFontSizeEloSuffix: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfs_elo_suffix'],
    requirements: [
      { setting: 'adjustBannerFontSize', value: true },
      { setting: 'adjustBannerFontSizeEloSuffix', value: true },
    ],
  },
  adjustBannerFontWeightEloDiff: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfw_elo_diff'],
    requirements: [{ setting: 'adjustBannerFont', value: true }],
  },
  bannerFontWeightEloDiff: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfw_elo_diff'],
    requirements: [
      { setting: 'adjustBannerFont', value: true },
      { setting: 'adjustBannerFontWeightEloDiff', value: true },
    ],
  },
  adjustBannerFontSizeEloDiff: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfs_elo_diff'],
    requirements: [{ setting: 'adjustBannerFontSize', value: true }],
  },
  bannerFontSizeEloDiff: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfs_elo_diff'],
    requirements: [
      { setting: 'adjustBannerFontSize', value: true },
      { setting: 'adjustBannerFontSizeEloDiff', value: true },
    ],
  },
  adjustBannerFontWeightWinsValue: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfw_wins_value'],
    requirements: [{ setting: 'adjustBannerFont', value: true }],
  },
  bannerFontWeightWinsValue: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfw_wins_value'],
    requirements: [
      { setting: 'adjustBannerFont', value: true },
      { setting: 'adjustBannerFontWeightWinsValue', value: true },
    ],
  },
  adjustBannerFontSizeWinsValue: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfs_wins_value'],
    requirements: [{ setting: 'adjustBannerFontSize', value: true }],
  },
  bannerFontSizeWinsValue: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfs_wins_value'],
    requirements: [
      { setting: 'adjustBannerFontSize', value: true },
      { setting: 'adjustBannerFontSizeWinsValue', value: true },
    ],
  },
  adjustBannerFontWeightWinsLabel: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfw_wins_label'],
    requirements: [{ setting: 'adjustBannerFont', value: true }],
  },
  bannerFontWeightWinsLabel: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfw_wins_label'],
    requirements: [
      { setting: 'adjustBannerFont', value: true },
      { setting: 'adjustBannerFontWeightWinsLabel', value: true },
    ],
  },
  adjustBannerFontSizeWinsLabel: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfs_wins_label'],
    requirements: [{ setting: 'adjustBannerFontSize', value: true }],
  },
  bannerFontSizeWinsLabel: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfs_wins_label'],
    requirements: [
      { setting: 'adjustBannerFontSize', value: true },
      { setting: 'adjustBannerFontSizeWinsLabel', value: true },
    ],
  },
  adjustBannerFontWeightLossesValue: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfw_losses_value'],
    requirements: [{ setting: 'adjustBannerFont', value: true }],
  },
  bannerFontWeightLossesValue: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfw_losses_value'],
    requirements: [
      { setting: 'adjustBannerFont', value: true },
      { setting: 'adjustBannerFontWeightLossesValue', value: true },
    ],
  },
  adjustBannerFontSizeLossesValue: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfs_losses_value'],
    requirements: [{ setting: 'adjustBannerFontSize', value: true }],
  },
  bannerFontSizeLossesValue: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfs_losses_value'],
    requirements: [
      { setting: 'adjustBannerFontSize', value: true },
      { setting: 'adjustBannerFontSizeLossesValue', value: true },
    ],
  },
  adjustBannerFontWeightLossesLabel: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfw_losses_label'],
    requirements: [{ setting: 'adjustBannerFont', value: true }],
  },
  bannerFontWeightLossesLabel: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfw_losses_label'],
    requirements: [
      { setting: 'adjustBannerFont', value: true },
      { setting: 'adjustBannerFontWeightLossesLabel', value: true },
    ],
  },
  adjustBannerFontSizeLossesLabel: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfs_losses_label'],
    requirements: [{ setting: 'adjustBannerFontSize', value: true }],
  },
  bannerFontSizeLossesLabel: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfs_losses_label'],
    requirements: [
      { setting: 'adjustBannerFontSize', value: true },
      { setting: 'adjustBannerFontSizeLossesLabel', value: true },
    ],
  },
  adjustBannerFontWeightStatistics: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfw_stats'],
    requirements: [{ setting: 'adjustBannerFont', value: true }],
  },
  bannerFontWeightStatistics: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfw_stats'],
    requirements: [
      { setting: 'adjustBannerFont', value: true },
      { setting: 'adjustBannerFontWeightStatistics', value: true },
    ],
  },
  adjustBannerFontSizeStatistics: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_bfs_stats'],
    requirements: [{ setting: 'adjustBannerFontSize', value: true }],
  },
  bannerFontSizeStatistics: {
    type: 'number',
    defaultValue: 50,
    min: 0,
    max: 200,
    query: ['bfs_stats'],
    requirements: [
      { setting: 'adjustBannerFontSize', value: true },
      { setting: 'adjustBannerFontSizeStatistics', value: true },
    ],
  },
  refreshInterval: {
    type: 'number',
    defaultValue: 60,
    min: 10,
    max: 120,
    query: ['refresh'],
  },
  colorScheme: {
    type: 'string',
    defaultValue: 'faceit',
    options: colorSchemes,
    query: ['scheme', 'color_scheme'],
  },
  style: {
    type: 'string',
    defaultValue: 'prime',
    defaultWidgetValue: 'rounded',
    options: styles.map((style) => style.id),
    query: ['style'],
  },
  animatedDeckAnimation: {
    type: 'string',
    defaultValue: 'fade',
    options: ['fade', 'slide_up', 'zoom'],
    query: ['anim_type'],
    requirements: [
      {
        setting: 'style',
        value: 'animated',
      },
    ],
  },
  animatedDeckShowHeader: {
    type: 'boolean',
    defaultValue: true,
    query: ['anim_show_header'],
    requirements: [
      {
        setting: 'style',
        value: 'animated',
      },
    ],
  },
  animatedDeckShowStats: {
    type: 'boolean',
    defaultValue: true,
    query: ['anim_show_stats'],
    requirements: [
      {
        setting: 'style',
        value: 'animated',
      },
    ],
  },
  animatedDeckShowMatches: {
    type: 'boolean',
    defaultValue: true,
    query: ['anim_show_matches'],
    requirements: [
      {
        setting: 'style',
        value: 'animated',
      },
    ],
  },
  animatedDeckOrderHeader: {
    type: 'number',
    defaultValue: 1,
    min: 1,
    max: 3,
    query: ['anim_order_header'],
    requirements: [
      {
        setting: 'style',
        value: 'animated',
      },
    ],
  },
  animatedDeckOrderStats: {
    type: 'number',
    defaultValue: 2,
    min: 1,
    max: 3,
    query: ['anim_order_stats'],
    requirements: [
      {
        setting: 'style',
        value: 'animated',
      },
    ],
  },
  animatedDeckOrderMatches: {
    type: 'number',
    defaultValue: 3,
    min: 1,
    max: 3,
    query: ['anim_order_matches'],
    requirements: [
      {
        setting: 'style',
        value: 'animated',
      },
    ],
  },
  customBorderColor1: {
    type: 'string',
    defaultValue: '595959',
    regex: HEX_REGEXP,
    query: ['border1'],
    requirements: [
      {
        setting: 'colorScheme',
        value: 'custom',
      },
    ],
  },
  customInlineCSS: {
    type: 'string',
    defaultValue: '',
    query: ['inline_css_b64', 'inline_css'],
  },
  customBorderColor1Opacity: {
    type: 'number',
    defaultValue: 1,
    min: 0,
    max: 1,
    query: ['border1_opacity'],
    requirements: [
      {
        setting: 'colorScheme',
        value: 'custom',
      },
    ],
  },
  customBorderColor2: {
    type: 'string',
    defaultValue: '8d8d8d',
    regex: HEX_REGEXP,
    query: ['border2'],
    requirements: [
      {
        setting: 'colorScheme',
        value: 'custom',
      },
    ],
  },
  customBorderColor2Opacity: {
    type: 'number',
    defaultValue: 1,
    min: 0,
    max: 1,
    query: ['border2_opacity'],
    requirements: [
      {
        setting: 'colorScheme',
        value: 'custom',
      },
    ],
  },
  adjustBorderWidth: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_border_width', 'adjustBorderWidth', 'adjust_bw'],
    requirements: [
      {
        setting: 'colorScheme',
        value: 'custom',
      },
    ],
  },
  borderWidth: {
    type: 'number',
    defaultValue: 1,
    min: 0,
    max: 12,
    query: ['border_width', 'width', 'bw'],
    requirements: [
      {
        setting: 'colorScheme',
        value: 'custom',
      },
      {
        setting: 'adjustBorderWidth',
        value: true,
      },
    ],
  },
  adjustStatisticsSeparator: {
    type: 'boolean',
    defaultValue: false,
    query: ['adjust_stats_separator'],
    requirements: [
      {
        setting: 'colorScheme',
        value: 'custom',
      },
    ],
  },
  customStatisticsSeparatorColor: {
    type: 'string',
    defaultValue: '595959',
    regex: HEX_REGEXP,
    query: ['stats_separator_color'],
    requirements: [
      {
        setting: 'colorScheme',
        value: 'custom',
      },
      {
        setting: 'adjustStatisticsSeparator',
        value: true,
      },
    ],
  },
  customStatisticsSeparatorOpacity: {
    type: 'number',
    defaultValue: 1,
    min: 0,
    max: 1,
    query: ['stats_separator_opacity'],
    requirements: [
      {
        setting: 'colorScheme',
        value: 'custom',
      },
      {
        setting: 'adjustStatisticsSeparator',
        value: true,
      },
    ],
  },
  statisticsSeparatorWidth: {
    type: 'number',
    defaultValue: 1,
    min: 0,
    max: 12,
    query: ['stats_separator_width'],
    requirements: [
      {
        setting: 'colorScheme',
        value: 'custom',
      },
      {
        setting: 'adjustStatisticsSeparator',
        value: true,
      },
    ],
  },
  customTextColor: {
    type: 'string',
    defaultValue: 'ffffff',
    regex: HEX_REGEXP,
    query: ['color'],
    requirements: [
      {
        setting: 'colorScheme',
        value: 'custom',
      },
    ],
  },
  customBackgroundColor: {
    type: 'string',
    defaultValue: '121212',
    regex: HEX_REGEXP,
    query: ['bg_color', 'bg-color'],
    requirements: [
      {
        setting: 'colorScheme',
        value: 'custom',
      },
    ],
  },
  statSlot1: {
    type: 'statistic_type',
    defaultValue: 'KILLS',
  },
  statSlot2: {
    type: 'statistic_type',
    defaultValue: 'KD',
  },
  statSlot3: {
    type: 'statistic_type',
    defaultValue: 'HSPERCENT',
  },
  statSlot4: {
    type: 'statistic_type',
    defaultValue: 'WINRATIO',
  },
  saveSession: {
    type: 'boolean',
    defaultValue: true,
    query: ['save_session'],
  },
  averageStatsMatchCount: {
    type: 'number',
    defaultValue: 30,
    query: ['avg_matches'],
  },
  widgetOpacity: {
    type: 'number',
    defaultValue: 1,
    min: 0,
    max: 1,
    query: ['opacity'],
  },
  customCSS: {
    type: 'string_undefined',
    defaultValue: undefined,
    query: ['css'],
  },
} satisfies Record<string, SettingDefinition>;
