import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LanguageContext } from '../contexts';
import { Checkbox } from '../../components/Checkbox.tsx';
import { InfoBox } from '../../components/InfoBox.tsx';
import {
  CHAT_BOTS,
  CHAT_LANGUAGES,
  CHAT_PARTS,
  type ChatBot,
  type ChatCommandOptions,
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

type Saved = { nick: string; cmd: string; lang: ChatLanguage; show: ChatPart[]; bot: ChatBot };

const isLanguage = (value: unknown): value is ChatLanguage => CHAT_LANGUAGES.some((lang) => lang === value);
const isBot = (value: unknown): value is ChatBot => CHAT_BOTS.some((bot) => bot === value);
const isPart = (value: unknown): value is ChatPart => CHAT_PARTS.some((part) => part === value);

function readSaved(fallbackNick: string, fallbackLang: string): Saved {
  const base: Saved = {
    nick: fallbackNick,
    cmd: 'elo',
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
      cmd: typeof saved.cmd === 'string' && saved.cmd ? saved.cmd : base.cmd,
      lang: isLanguage(saved.lang) ? saved.lang : base.lang,
      show: Array.isArray(saved.show) ? saved.show.filter(isPart) : base.show,
      bot: isBot(saved.bot) ? saved.bot : base.bot,
    };
  } catch {
    return base;
  }
}

/** "!elo" for chat bots: the viewer types the command, the bot answers with ELO, level and recent matches. */
export const ChatCommandTab = ({ username, studioLanguage }: { username: string; studioLanguage: string }) => {
  const tl = useContext(LanguageContext);
  const [saved, setSaved] = useState<Saved>(() => readSaved(username, studioLanguage));
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

  const options: ChatCommandOptions = useMemo(
    () => ({ origin: window.location.origin, nick: saved.nick, cmd: saved.cmd, lang: saved.lang, show: saved.show }),
    [saved]
  );
  const command = cleanCommandName(saved.cmd) || 'elo';
  const reply = chatCommandReply(saved.bot, options);

  /* The same address the bot will read, so the preview is the answer the chat will get */
  useEffect(() => {
    const controller = new AbortController();
    setPreview(null);
    const timer = window.setTimeout(() => {
      fetch(`${chatCommandUrl(options)}${encodeURIComponent(cleanChatNick(testNick))}`, { cache: 'no-store', signal: controller.signal })
        .then((response) => response.text())
        .then(setPreview)
        .catch(() => undefined);
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [options, testNick]);

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
        <h3 className="card-heading">{tl('chat.title', [command])}</h3>
        <p className="chat-command-intro">{tl('chat.intro', [command])}</p>
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
            <p>{tl('chat.command')}</p>
            <input
              aria-label={tl('chat.command')}
              value={saved.cmd}
              maxLength={24}
              onChange={(event) => update({ cmd: cleanCommandName(event.target.value) })}
            />
          </div>
        </div>
        <div className={'setting flex'}>
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
      </div>

      <div className={'settings chat-command'}>
        <h3 className="card-heading">{tl(`chat.bot.${saved.bot}`)}</h3>
        <p>{tl(`chat.how.${saved.bot}`, [command])}</p>
        <div className="chat-command-code">
          <textarea aria-label={tl('chat.reply')} readOnly value={reply} rows={3} onFocus={(event) => event.currentTarget.select()} />
          <button type="button" onClick={() => copy(reply, 'reply')}>
            {copied === 'reply' ? tl('chat.copied') : tl('chat.copy')}
          </button>
        </div>
        {saved.bot === 'nightbot' && (
          <>
            <p>{tl('chat.nightbot_chat')}</p>
            <div className="chat-command-code">
              <textarea aria-label={tl('chat.nightbot_chat')} readOnly value={nightbotChatLine(options)} rows={3} onFocus={(event) => event.currentTarget.select()} />
              <button type="button" onClick={() => copy(nightbotChatLine(options), 'chat')}>
                {copied === 'chat' ? tl('chat.copied') : tl('chat.copy')}
              </button>
            </div>
          </>
        )}
        <InfoBox content={<p>{tl('chat.limits')}</p>} style={'info'} />
      </div>

      <div className={'settings chat-command'}>
        <h3 className="card-heading">{tl('chat.preview')}</h3>
        <div className={'setting'}>
          <p>{tl('chat.test_nick')}</p>
          <input
            aria-label={tl('chat.test_nick')}
            value={testNick}
            maxLength={36}
            placeholder={saved.nick || username}
            onChange={(event) => setTestNick(event.target.value)}
          />
        </div>
        <div className="chat-command-preview" aria-live="polite">
          <span className="chat-command-viewer">!{command}{cleanChatNick(testNick) ? ` ${cleanChatNick(testNick)}` : ''}</span>
          <span className="chat-command-answer">{preview ?? tl('chat.loading')}</span>
        </div>
      </div>
    </>
  );
};
