import { type CSSProperties, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LanguageContext } from '../contexts';
import { Checkbox } from '../../components/Checkbox.tsx';
import { InfoBox } from '../../components/InfoBox.tsx';
import { StudioIcon, type IconName } from '../../components/StudioIcon.tsx';
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
  type ChatStats,
  chatCommandReply,
  chatCommandUrl,
  chatStatsUrl,
  sumChatStats,
  cleanChatNick,
  cleanCommandName,
  nightbotChatLine,
} from '../chat-command';
import { languages } from '../../translations/translations';

const STORAGE_KEY = 'fcw_chat_command';
const PREVIEW_DEBOUNCE_MS = 600;
const COPIED_MS = 1200;
/** The counters move with every chat command: read them again now and then while the tab is open. */
const STATS_REFRESH_MS = 60_000;
const STATS_DEBOUNCE_MS = 500;

type Names = Record<ChatKind, string>;
type Saved = { nick: string; names: Names; lang: ChatLanguage; show: ChatPart[]; bot: ChatBot };

const DEFAULT_NAMES: Names = { elo: 'elo', last: 'last', kd: 'kd', avg: 'avg', live: 'live' };
const KIND_ICONS: Record<ChatKind, IconName> = { elo: 'trend', last: 'history', kd: 'crosshair', avg: 'gauge', live: 'broadcast' };
/** Short marks for the bot switch: initials, not logos. */
const BOT_MARKS: Record<ChatBot, { mark: string; variable: string }> = {
  streamelements: { mark: 'SE', variable: '$(customapi)' },
  nightbot: { mark: 'NB', variable: '$(urlfetch)' },
  fossabot: { mark: 'FB', variable: '$(customapi)' },
  url: { mark: 'URL', variable: 'custom API' },
};

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

/** One block of text to paste, with its copy button. */
const CodeBlock = ({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) => {
  const tl = useContext(LanguageContext);
  if (!tl) return null;
  return (
    <div className="chat-code">
      <span className="chat-code-label">{label}</span>
      <textarea aria-label={label} readOnly value={value} rows={3} spellCheck={false} onFocus={(event) => event.currentTarget.select()} />
      <button type="button" className={`chat-code-copy${copied ? ' is-copied' : ''}`} onClick={onCopy}>
        <StudioIcon name={copied ? 'check' : 'copy'} />
        <span>{copied ? tl('chat.copied') : tl('chat.copy')}</span>
      </button>
    </div>
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
  const [stats, setStats] = useState<ChatStats | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

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
      fetch(`${chatCommandUrl({ ...previewOptions, preview: true })}${encodeURIComponent(cleanChatNick(testNick))}`, { cache: 'no-store', signal: controller.signal })
        .then((response) => response.text())
        .then(setPreview)
        .catch(() => undefined);
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [previewOptions, testNick]);

  /* How often each command was called, for this streamer and for the whole site */
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(chatStatsUrl(window.location.origin, saved.nick), { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: ChatStats | null) => {
          if (alive && body?.total) setStats(body);
        })
        .catch(() => undefined);
    const first = window.setTimeout(load, STATS_DEBOUNCE_MS);
    const again = window.setInterval(load, STATS_REFRESH_MS);
    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(again);
    };
  }, [saved.nick]);

  const copy = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), COPIED_MS);
    } catch {
      /* the text stays selectable in the field */
    }
  }, []);

  const showPreview = (kind: ChatKind) => {
    setPreviewKind(kind);
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (!tl) return null;

  const viewerLine = `!${nameOf(previewKind)}${cleanChatNick(testNick) ? ` ${cleanChatNick(testNick)}` : ''}`;
  const number = new Intl.NumberFormat(studioLanguage);
  const compact = new Intl.NumberFormat(studioLanguage, { notation: 'compact', maximumFractionDigits: 1 });
  const short = (value: number) => (value >= 10_000 ? compact.format(value) : number.format(value));
  const hasOwner = Boolean(cleanChatNick(saved.nick));
  const mineTotal = sumChatStats(stats?.mine);
  const busiest = Math.max(1, ...CHAT_KINDS.map((kind) => stats?.mine[kind] ?? 0));
  const top = stats && mineTotal > 0 ? CHAT_KINDS.reduce((best, kind) => ((stats.mine[kind] ?? 0) > (stats.mine[best] ?? 0) ? kind : best), CHAT_KINDS[0]) : null;

  return (
    <div className="chat-tab">
      <div className={'settings chat-setup'}>
        <h3 className="card-heading">
          <StudioIcon name="bot" />
          {tl('chat.setup')}
        </h3>
        <p className="chat-lead">{tl('chat.intro', [nameOf('elo')])}</p>
        <div className="chat-stats" aria-live="polite">
          <div className="chat-stat">
            <span>{tl('chat.stats.mine')}</span>
            <b title={number.format(mineTotal)}>{hasOwner && stats ? short(mineTotal) : '—'}</b>
          </div>
          <div className="chat-stat">
            <span>{tl('chat.stats.today')}</span>
            <b>{hasOwner && stats ? short(sumChatStats(stats.today)) : '—'}</b>
          </div>
          <div className="chat-stat">
            <span>{tl('chat.stats.top')}</span>
            <b className="is-command">{top ? `!${nameOf(top)}` : '—'}</b>
          </div>
          <div className="chat-stat is-site">
            <span>{tl('chat.stats.site')}</span>
            <b title={stats ? number.format(sumChatStats(stats.total)) : ''}>{stats ? short(sumChatStats(stats.total)) : '—'}</b>
          </div>
        </div>
        <p className="chat-stats-hint">{hasOwner ? tl('chat.stats.hint') : tl('chat.stats.no_nick')}</p>
        <div className="design-switch chat-bot-switch" role="group" aria-label={tl('chat.bot')}>
          {CHAT_BOTS.map((bot) => (
            <button key={bot} type="button" className="design-switch-option" aria-pressed={saved.bot === bot} onClick={() => update({ bot })}>
              <span className="design-switch-mark" aria-hidden="true">
                {BOT_MARKS[bot].mark}
              </span>
              <span className="design-switch-text">
                <strong>{tl(`chat.bot.${bot}`)}</strong>
                <small>{BOT_MARKS[bot].variable}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="chat-setup-fields">
          <label>
            <span>{tl('chat.nick')}</span>
            <input value={saved.nick} maxLength={36} placeholder={username} onChange={(event) => update({ nick: cleanChatNick(event.target.value) })} />
          </label>
          <label>
            <span>{tl('chat.language')}</span>
            <select
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
          </label>
        </div>
        <div className="chat-howto">
          <StudioIcon name="book" />
          <p>{tl(`chat.how.${saved.bot}`)}</p>
        </div>
        <InfoBox content={<p>{tl('chat.limits')}</p>} style={'info'} />
      </div>

      <div className="section-heading chat-section-heading">
        <h2>{tl('chat.commands')}</h2>
        <span>{CHAT_KINDS.length}</span>
      </div>

      <div className="chat-commands">
        {CHAT_KINDS.map((kind) => {
          const options = optionsFor(kind);
          return (
            <section className={`settings chat-card chat-card--${kind}`} key={kind} aria-labelledby={`chat-card-${kind}`}>
              <div className="chat-card-head">
                <span className="chat-card-icon" aria-hidden="true">
                  <StudioIcon name={KIND_ICONS[kind]} />
                </span>
                <div className="chat-card-title">
                  <h3 id={`chat-card-${kind}`}>!{nameOf(kind)}</h3>
                  <p>{tl(`chat.kind.${kind}`)}</p>
                </div>
                {hasOwner && stats && (
                  <div className="chat-card-count" title={tl('chat.stats.calls_title', [number.format(stats.mine[kind] ?? 0), `!${nameOf(kind)}`])}>
                    <b>{short(stats.mine[kind] ?? 0)}</b>
                    <small>{tl('chat.stats.calls')}</small>
                    {(stats.today[kind] ?? 0) > 0 && <em>{tl('chat.stats.today_short', [short(stats.today[kind] ?? 0)])}</em>}
                    <i style={{ '--share': (stats.mine[kind] ?? 0) / busiest } as CSSProperties} aria-hidden="true" />
                  </div>
                )}
                <button type="button" className="chat-card-try" aria-label={`${tl('chat.try')} !${nameOf(kind)}`} title={tl('chat.try')} onClick={() => showPreview(kind)}>
                  <StudioIcon name="eye" />
                  <span>{tl('chat.try')}</span>
                </button>
              </div>

              <label className="chat-name">
                <span>{tl('chat.command')}</span>
                <span className="chat-name-field">
                  <span className="chat-name-prefix" aria-hidden="true">
                    !
                  </span>
                  <input
                    aria-label={`${tl('chat.command')} !${kind}`}
                    value={saved.names[kind]}
                    maxLength={24}
                    placeholder={kind}
                    spellCheck={false}
                    onChange={(event) => update({ names: { ...saved.names, [kind]: cleanCommandName(event.target.value) } })}
                  />
                </span>
              </label>

              {kind === 'elo' && (
                <div className="chat-parts">
                  <span className="chat-parts-label">{tl('chat.parts')}</span>
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

              <CodeBlock
                label={tl('chat.reply')}
                value={chatCommandReply(saved.bot, options)}
                copied={copied === `${kind}:reply`}
                onCopy={() => copy(chatCommandReply(saved.bot, options), `${kind}:reply`)}
              />
              {saved.bot === 'nightbot' && (
                <CodeBlock
                  label={tl('chat.nightbot_chat')}
                  value={nightbotChatLine(options)}
                  copied={copied === `${kind}:chat`}
                  onCopy={() => copy(nightbotChatLine(options), `${kind}:chat`)}
                />
              )}
            </section>
          );
        })}
      </div>

      <div className={'settings chat-preview-card'} ref={previewRef}>
        <h3 className="card-heading">
          <StudioIcon name="message" />
          {tl('chat.preview')}
        </h3>
        <div className="chat-preview-kinds" role="group" aria-label={tl('chat.command')}>
          {CHAT_KINDS.map((kind) => (
            <button key={kind} type="button" aria-pressed={previewKind === kind} onClick={() => setPreviewKind(kind)}>
              <StudioIcon name={KIND_ICONS[kind]} />
              <span>!{nameOf(kind)}</span>
            </button>
          ))}
        </div>
        <label className="chat-preview-nick">
          <span>{tl('chat.test_nick')}</span>
          <input value={testNick} maxLength={36} placeholder={saved.nick || username} onChange={(event) => setTestNick(event.target.value)} />
        </label>
        <div className="chat-window" aria-live="polite">
          <div className="chat-line chat-line--viewer">
            <span className="chat-avatar" aria-hidden="true">
              <StudioIcon name="user" />
            </span>
            <span className="chat-bubble">
              <strong>{tl('chat.viewer')}</strong>
              {viewerLine}
            </span>
          </div>
          <div className="chat-line chat-line--bot">
            <span className="chat-avatar" aria-hidden="true">
              <StudioIcon name="bot" />
            </span>
            <span className={`chat-bubble${preview === null ? ' is-loading' : ''}`}>
              <strong>{saved.bot === 'url' ? tl('chat.bot') : tl(`chat.bot.${saved.bot}`)}</strong>
              {preview ?? tl('chat.loading')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
