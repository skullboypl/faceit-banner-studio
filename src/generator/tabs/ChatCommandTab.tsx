import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LanguageContext } from '../contexts';
import { Checkbox } from '../../components/Checkbox.tsx';
import { InfoBox } from '../../components/InfoBox.tsx';
import {
  CHAT_BOTS,
  CHAT_KINDS,
  CHAT_LANGUAGES,
  CHAT_PARTS,
  type ChatBot,
  type ChatCommandOptions,
  type ChatKind,
  type ChatLanguage,
  type ChatPart,
  chatCommandReply,
  chatCommandUrl,
  cleanChatNick,
  cleanCommandName,
  nightbotChatLine,
} from '../chat-command';
import { languages } from '../../translations/translations';

const STORAGE_KEY = 'fcw_chat_command';
const PREVIEW_DEBOUNCE_MS = 600;

type Names = Record<ChatKind, string>;
type Saved = { nick: string; names: Names; lang: ChatLanguage; show: ChatPart[]; bot: ChatBot };

const DEFAULT_NAMES: Names = { elo: 'elo', last: 'last', kd: 'kd', avg: 'avg', live: 'live' };

const isLanguage = (value: unknown): value is ChatLanguage => CHAT_LANGUAGES.some((lang) => lang === value);
const isBot = (value: unknown): value is ChatBot => CHAT_BOTS.some((bot) => bot === value);
const isPart = (value: unknown): value is ChatPart => CHAT_PARTS.some((part) => part === value);
const isKind = (value: unknown): value is ChatKind => CHAT_KINDS.some((kind) => kind === value);

function readNames(saved: Record<string, unknown>): Names {
  const names = { ...DEFAULT_NAMES };
  /* The first version kept one command, as `cmd` */
  if (typeof saved.cmd === 'string' && saved.cmd) names.elo = saved.cmd;
  const stored = saved.names;
  if (stored && typeof stored === 'object') {
    for (const [kind, name] of Object.entries(stored)) {
      if (isKind(kind) && typeof name === 'string') names[kind] = name;
    }
  }
  return names;
}

function readSaved(fallbackNick: string, fallbackLang: string): Saved {
  const base: Saved = {
    nick: fallbackNick,
    names: { ...DEFAULT_NAMES },
    lang: isLanguage(fallbackLang) ? fallbackLang : 'en',
    show: ['rank', 'last'],
    bot: 'streamelements',
  };
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return base;
    const saved = raw as Record<string, unknown>;
    return {
      nick: typeof saved.nick === 'string' ? saved.nick : base.nick,
      names: readNames(saved),
      lang: isLanguage(saved.lang) ? saved.lang : base.lang,
      show: Array.isArray(saved.show) ? saved.show.filter(isPart) : base.show,
      bot: isBot(saved.bot) ? saved.bot : base.bot,
    };
  } catch {
    return base;
  }
}

/** Text to paste, a copy button, and the chat line Nightbot also accepts. */
const CommandCode = ({
  bot,
  options,
  copied,
  onCopy,
}: {
  bot: ChatBot;
  options: ChatCommandOptions;
  copied: string;
  onCopy: (value: string, label: string) => void;
}) => {
  const tl = useContext(LanguageContext);
  if (!tl) return null;
  const kind = options.kind ?? 'elo';
  const reply = chatCommandReply(bot, options);
  const chatLine = nightbotChatLine(options);
  return (
    <>
      <div className="chat-command-code">
        <textarea aria-label={tl('chat.reply')} readOnly value={reply} rows={3} onFocus={(event) => event.currentTarget.select()} />
        <button type="button" onClick={() => onCopy(reply, `${kind}:reply`)}>
          {copied === `${kind}:reply` ? tl('chat.copied') : tl('chat.copy')}
        </button>
      </div>
      {bot === 'nightbot' && (
        <>
          <p>{tl('chat.nightbot_chat')}</p>
          <div className="chat-command-code">
            <textarea aria-label={tl('chat.nightbot_chat')} readOnly value={chatLine} rows={3} onFocus={(event) => event.currentTarget.select()} />
            <button type="button" onClick={() => onCopy(chatLine, `${kind}:chat`)}>
              {copied === `${kind}:chat` ? tl('chat.copied') : tl('chat.copy')}
            </button>
          </div>
        </>
      )}
    </>
  );
};

/** Chat commands for bots: the viewer types !elo, !last, !kd, !avg or !live, alone or with a nickname. */
export const ChatCommandTab = ({ username, studioLanguage }: { username: string; studioLanguage: string }) => {
  const tl = useContext(LanguageContext);
  const [saved, setSaved] = useState<Saved>(() => readSaved(username, studioLanguage));
  const [previewKind, setPreviewKind] = useState<ChatKind>('elo');
  const [testNick, setTestNick] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState('');

  const update = useCallback((patch: Partial<Saved>) => {
    setSaved((current) => {
      const next = { ...current, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage blocked: the choice lasts for this visit */
      }
      return next;
    });
  }, []);

  const optionsFor = useCallback(
    (kind: ChatKind): ChatCommandOptions => ({
      origin: window.location.origin,
      nick: saved.nick,
      cmd: saved.names[kind],
      kind,
      lang: saved.lang,
      show: saved.show,
    }),
    [saved]
  );
  const nameOf = (kind: ChatKind) => cleanCommandName(saved.names[kind]) || kind;
  const previewOptions = useMemo(() => optionsFor(previewKind), [optionsFor, previewKind]);

  /* The same address the bot will read, so the preview is the answer the chat will get */
  useEffect(() => {
    const controller = new AbortController();
    setPreview(null);
    const timer = window.setTimeout(() => {
      fetch(`${chatCommandUrl(previewOptions)}${encodeURIComponent(cleanChatNick(testNick))}`, { cache: 'no-store', signal: controller.signal })
        .then((response) => response.text())
        .then(setPreview)
        .catch(() => undefined);
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [previewOptions, testNick]);

  const copy = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1200);
    } catch {
      /* the text stays selectable in the field */
    }
  }, []);

  if (!tl) return null;

  return (
    <>
      <div className={'settings chat-command'}>
        <h3 className="card-heading">{tl('chat.tab')}</h3>
        <p className="chat-command-intro">{tl('chat.intro', [nameOf('elo')])}</p>
        <div className={'setting flex'}>
          <div>
            <p>{tl('chat.nick')}</p>
            <input
              aria-label={tl('chat.nick')}
              value={saved.nick}
              maxLength={36}
              placeholder={username}
              onChange={(event) => update({ nick: cleanChatNick(event.target.value) })}
            />
          </div>
          <div>
            <p>{tl('chat.language')}</p>
            <select
              aria-label={tl('chat.language')}
              value={saved.lang}
              onChange={(event) => {
                if (isLanguage(event.target.value)) update({ lang: event.target.value });
              }}
            >
              {CHAT_LANGUAGES.map((id) => (
                <option key={id} value={id}>
                  {languages.find((language) => language.id === id)?.name ?? id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p>{tl('chat.bot')}</p>
            <select
              aria-label={tl('chat.bot')}
              value={saved.bot}
              onChange={(event) => {
                if (isBot(event.target.value)) update({ bot: event.target.value });
              }}
            >
              {CHAT_BOTS.map((bot) => (
                <option key={bot} value={bot}>
                  {tl(`chat.bot.${bot}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p>{tl(`chat.how.${saved.bot}`)}</p>
        <InfoBox content={<p>{tl('chat.limits')}</p>} style={'info'} />
      </div>

      {CHAT_KINDS.map((kind) => (
        <div className={'settings chat-command'} key={kind}>
          <h3 className="card-heading">{tl('chat.title', [nameOf(kind)])}</h3>
          <p className="chat-command-intro">{tl(`chat.kind.${kind}`)}</p>
          <div className={'setting'}>
            <p>{tl('chat.command')}</p>
            <input
              aria-label={`${tl('chat.command')} ${kind}`}
              value={saved.names[kind]}
              maxLength={24}
              placeholder={kind}
              onChange={(event) => update({ names: { ...saved.names, [kind]: cleanCommandName(event.target.value) } })}
            />
          </div>
          {kind === 'elo' && (
            <div className={'setting'}>
              <p>{tl('chat.parts')}</p>
              {CHAT_PARTS.map((part) => (
                <Checkbox
                  key={part}
                  text={tl(`chat.part.${part}`)}
                  state={saved.show.includes(part)}
                  setState={(on) =>
                    update({ show: on ? [...saved.show.filter((entry) => entry !== part), part] : saved.show.filter((entry) => entry !== part) })
                  }
                />
              ))}
            </div>
          )}
          <CommandCode bot={saved.bot} options={optionsFor(kind)} copied={copied} onCopy={copy} />
        </div>
      ))}

      <div className={'settings chat-command'}>
        <h3 className="card-heading">{tl('chat.preview')}</h3>
        <div className={'setting flex'}>
          <div>
            <p>{tl('chat.command')}</p>
            <select
              aria-label={tl('chat.command')}
              value={previewKind}
              onChange={(event) => {
                if (isKind(event.target.value)) setPreviewKind(event.target.value);
              }}
            >
              {CHAT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  !{nameOf(kind)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p>{tl('chat.test_nick')}</p>
            <input
              aria-label={tl('chat.test_nick')}
              value={testNick}
              maxLength={36}
              placeholder={saved.nick || username}
              onChange={(event) => setTestNick(event.target.value)}
            />
          </div>
        </div>
        <div className="chat-command-preview" aria-live="polite">
          <span className="chat-command-viewer">
            !{nameOf(previewKind)}
            {cleanChatNick(testNick) ? ` ${cleanChatNick(testNick)}` : ''}
          </span>
          <span className="chat-command-answer">{preview ?? tl('chat.loading')}</span>
        </div>
      </div>
    </>
  );
};
