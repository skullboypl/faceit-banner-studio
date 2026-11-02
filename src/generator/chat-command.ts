/** Chat bots the studio writes a ready `!elo` command for. `url` takes any bot that can print a web address. */
export const CHAT_BOTS = ['streamelements', 'nightbot', 'fossabot', 'url'] as const;
export type ChatBot = (typeof CHAT_BOTS)[number];

export const CHAT_LANGUAGES = ['en', 'pl', 'de', 'uk', 'ru', 'tr', 'pt', 'es', 'fr', 'cs'] as const;
export type ChatLanguage = (typeof CHAT_LANGUAGES)[number];

export const CHAT_PARTS = ['rank', 'kd', 'last'] as const;
export type ChatPart = (typeof CHAT_PARTS)[number];

export type ChatCommandOptions = {
  /** Site origin, for example https://faceitbanner.vxh.pl */
  origin: string;
  /** Answered when a viewer types the command alone. */
  nick: string;
  /** Command name without the "!". */
  cmd: string;
  lang: ChatLanguage;
  show: ChatPart[];
};

export const CHAT_COMMAND_PATH = '/api/faceit/elo';

/** Keeps a command name the way bots accept it: letters, digits, _ and -, at most 24 characters. */
export const cleanCommandName = (value: string) => value.replace(/^!+/, '').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 24);

/** Keeps a FACEIT nickname or player id: one word, at most 36 characters. */
export const cleanChatNick = (value: string) => value.trim().replace(/^@+/, '').split(/\s+/)[0]?.slice(0, 36) ?? '';

/** The address a bot reads. The viewer's text goes after `nick=`, so it is always the last parameter. */
export function chatCommandUrl({ origin, nick, cmd, lang, show }: ChatCommandOptions) {
  const params = new URLSearchParams();
  params.set('lang', lang);
  params.set('show', CHAT_PARTS.filter((part) => show.includes(part)).join(','));
  const name = cleanCommandName(cmd);
  if (name && name !== 'elo') params.set('cmd', name);
  const fallback = cleanChatNick(nick);
  if (fallback) params.set('default', fallback);
  return `${origin.replace(/\/$/, '')}${CHAT_COMMAND_PATH}?${params.toString()}&nick=`;
}

/** The reply text to paste into the bot. Each bot gets the viewer's words URL-encoded at the end of the address. */
export function chatCommandReply(bot: ChatBot, options: ChatCommandOptions) {
  const url = chatCommandUrl(options);
  switch (bot) {
    case 'streamelements': {
      /* $(1|text) is the first word, or the text when the viewer typed none */
      const fallback = cleanChatNick(options.nick);
      return `$(customapi ${url}$(queryescape ${fallback ? `$(1|${fallback})` : '$(1)'}))`;
    }
    case 'nightbot':
      return `$(urlfetch ${url}$(querystring))`;
    case 'fossabot':
      return `$(customapi ${url}$(querystring))`;
    case 'url':
      return url;
    default: {
      const unknown: never = bot;
      return unknown;
    }
  }
}

/** Nightbot also takes a new command typed in the chat by the streamer or a moderator. */
export const nightbotChatLine = (options: ChatCommandOptions) =>
  `!commands add !${cleanCommandName(options.cmd) || 'elo'} ${chatCommandReply('nightbot', options)}`;
