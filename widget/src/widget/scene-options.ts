/** Full-screen scenes for the parts of a stream without the game: before it starts, a break, and the end. */
export const SCENE_KINDS = ['starting', 'brb', 'ending'] as const;
export type SceneKind = (typeof SCENE_KINDS)[number];

/** Moving backgrounds. `none` keeps the scene still, for slow PCs or a calm look. */
export const SCENE_ANIMATIONS = ['aurora', 'grid', 'embers', 'none'] as const;
export type SceneAnimation = (typeof SCENE_ANIMATIONS)[number];

export const SCENE_CHAT_SIDES = ['right', 'left'] as const;
export type SceneChatSide = (typeof SCENE_CHAT_SIDES)[number];

/** Social links shown at the bottom, in this order. */
export const SCENE_SOCIALS = ['twitch', 'kick', 'youtube', 'x', 'instagram', 'tiktok', 'discord'] as const;
export type SceneSocial = (typeof SCENE_SOCIALS)[number];

export const SCENE_RANGES = { countdown: [0, 90] as [number, number] };

/** Text a streamer types for a title or a note: no markup, no control characters. */
export const SCENE_TEXT_REGEX = /^[^<>\p{Cc}]{0,90}$/u;
/** A channel name, handle or invite code: letters, digits and the few marks they use. */
export const SCENE_HANDLE_REGEX = /^[\p{L}\p{N}_.\-/@]{0,48}$/u;

export type SceneOptions = {
  kind: SceneKind;
  titles: Record<SceneKind, string>;
  notes: Record<SceneKind, string>;
  /** Minutes the "starting" and "be right back" timers count down from when the source loads; 0 hides them. */
  countdown: number;
  chat: boolean;
  chatSide: SceneChatSide;
  stats: boolean;
  animation: SceneAnimation;
  socials: { kind: SceneSocial; handle: string }[];
};

type Get = (key: string) => unknown;

const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  list.find((entry) => entry === value) ?? fallback;

const text = (value: unknown) => (typeof value === 'string' && SCENE_TEXT_REGEX.test(value) ? value.trim() : '');

/** Handles keep their own spelling, without a leading @ that chat names often carry. */
export const cleanHandle = (value: unknown) =>
  typeof value === 'string' && SCENE_HANDLE_REGEX.test(value.trim()) ? value.trim().replace(/^@+/, '') : '';

const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Setting key of a per-scene text, e.g. sceneTitleBrb. */
export const sceneTextKey = (field: 'Title' | 'Note', kind: SceneKind) => `scene${field}${capital(kind)}`;
/** Setting key of a social handle, e.g. sceneTwitch. */
export const sceneSocialKey = (kind: SceneSocial) => `scene${capital(kind)}`;

export function readSceneOptions(get: Get): SceneOptions {
  const per = (field: 'Title' | 'Note') =>
    Object.fromEntries(SCENE_KINDS.map((kind) => [kind, text(get(sceneTextKey(field, kind)))])) as Record<SceneKind, string>;
  const countdown = Number(get('sceneCountdown'));
  return {
    kind: pick(SCENE_KINDS, get('sceneKind'), 'starting'),
    titles: per('Title'),
    notes: per('Note'),
    countdown: Number.isFinite(countdown) ? Math.min(SCENE_RANGES.countdown[1], Math.max(0, Math.round(countdown))) : 5,
    chat: get('sceneChat') !== false,
    chatSide: pick(SCENE_CHAT_SIDES, get('sceneChatSide'), 'right'),
    stats: get('sceneStats') !== false,
    animation: pick(SCENE_ANIMATIONS, get('sceneAnimation'), 'aurora'),
    socials: SCENE_SOCIALS.map((kind) => ({ kind, handle: cleanHandle(get(sceneSocialKey(kind))) })).filter((entry) => entry.handle),
  };
}

/** The address a viewer would type, shown under the handle. */
export function socialAddress(kind: SceneSocial, handle: string): string {
  switch (kind) {
    case 'twitch':
      return `twitch.tv/${handle}`;
    case 'kick':
      return `kick.com/${handle}`;
    case 'youtube':
      return `youtube.com/@${handle}`;
    case 'x':
      return `x.com/${handle}`;
    case 'instagram':
      return `instagram.com/${handle}`;
    case 'tiktok':
      return `tiktok.com/@${handle}`;
    case 'discord':
      return handle.includes('/') ? handle : `discord.gg/${handle}`;
    default: {
      const unknown: never = kind;
      return unknown;
    }
  }
}

/** "4:05" for a countdown; hours appear only past one hour. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** Only the timer scenes count down; the end of a stream has nothing to wait for. */
export const sceneHasCountdown = (kind: SceneKind, minutes: number) => kind !== 'ending' && minutes > 0;
