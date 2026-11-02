import { createRateLimiter } from '../shared/rate-limit.mjs';
import { clientIp } from '../shared/client-ip.mjs';
import { readFaceit } from './faceit-proxy.mjs';
import { count } from './log.mjs';

/**
 * `!elo nickname` for chat bots (StreamElements, Nightbot, Fossabot and any bot that can read a URL).
 * GET /api/faceit/elo?nick=…&default=…&lang=pl&show=rank,last&cmd=elo answers one line of plain text.
 * Bots print the body as it is and ignore the status, so every answer, errors included, is a 200 with a sentence.
 */
export const CHAT_COMMAND_PATH = '/api/faceit/elo';
/** StreamElements and Nightbot cut a reply after 400 characters. */
export const CHAT_REPLY_MAX = 380;
export const CHAT_LANGUAGES = ['en', 'pl', 'de', 'uk', 'ru', 'tr', 'pt', 'es', 'fr', 'cs'];
export const CHAT_PARTS = ['rank', 'kd', 'last'];
const DEFAULT_PARTS = ['rank', 'last'];
const RECENT_MATCHES = 20;
const FORM_MATCHES = 5;
/** Bots wait a few seconds at most: the ranking and the matches are left out rather than make the reply late. */
const EXTRAS_DEADLINE_MS = 3000;
const PLAYER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TEXT = {
  en: { level: 'Level {0}', calibrating: 'calibrating', last: 'Last: {0}', notFound: 'Player {0} not found on FACEIT.', noCs2: '{0} has not played CS2 on FACEIT.', unavailable: 'FACEIT is not answering right now, try again in a minute.', noNick: 'Type a FACEIT nickname: !{0} nickname' },
  pl: { level: 'Poziom {0}', calibrating: 'kalibracja', last: 'Ostatnie: {0}', notFound: 'Nie ma gracza {0} na FACEIT.', noCs2: '{0} nie grał w CS2 na FACEIT.', unavailable: 'FACEIT nie odpowiada, spróbuj za minutę.', noNick: 'Podaj nick FACEIT: !{0} nick' },
  de: { level: 'Level {0}', calibrating: 'Einstufung läuft', last: 'Zuletzt: {0}', notFound: 'Spieler {0} gibt es auf FACEIT nicht.', noCs2: '{0} hat auf FACEIT kein CS2 gespielt.', unavailable: 'FACEIT antwortet gerade nicht, versuch es in einer Minute.', noNick: 'Gib einen FACEIT-Namen an: !{0} name' },
  uk: { level: 'Рівень {0}', calibrating: 'калібрування', last: 'Останні: {0}', notFound: 'Гравця {0} немає на FACEIT.', noCs2: '{0} не грав у CS2 на FACEIT.', unavailable: 'FACEIT зараз не відповідає, спробуйте за хвилину.', noNick: 'Вкажіть нік FACEIT: !{0} нік' },
  ru: { level: 'Уровень {0}', calibrating: 'калибровка', last: 'Последние: {0}', notFound: 'Игрока {0} нет на FACEIT.', noCs2: '{0} не играл в CS2 на FACEIT.', unavailable: 'FACEIT сейчас не отвечает, попробуйте через минуту.', noNick: 'Укажите ник FACEIT: !{0} ник' },
  tr: { level: 'Seviye {0}', calibrating: 'kalibrasyonda', last: 'Son maçlar: {0}', notFound: "FACEIT'te {0} adlı oyuncu yok.", noCs2: "{0} FACEIT'te CS2 oynamamış.", unavailable: 'FACEIT şu an yanıt vermiyor, bir dakika sonra tekrar dene.', noNick: 'Bir FACEIT kullanıcı adı yaz: !{0} kullanıcıadı' },
  pt: { level: 'Nível {0}', calibrating: 'em calibração', last: 'Últimas: {0}', notFound: 'O jogador {0} não existe na FACEIT.', noCs2: '{0} não jogou CS2 na FACEIT.', unavailable: 'A FACEIT não está respondendo agora, tente de novo em um minuto.', noNick: 'Digite um nick da FACEIT: !{0} nick' },
  es: { level: 'Nivel {0}', calibrating: 'en calibración', last: 'Últimas: {0}', notFound: 'No existe el jugador {0} en FACEIT.', noCs2: '{0} no ha jugado CS2 en FACEIT.', unavailable: 'FACEIT no responde ahora, prueba en un minuto.', noNick: 'Escribe un nick de FACEIT: !{0} nick' },
  fr: { level: 'Niveau {0}', calibrating: 'en calibrage', last: 'Derniers : {0}', notFound: "Le joueur {0} n'existe pas sur FACEIT.", noCs2: "{0} n'a pas joué à CS2 sur FACEIT.", unavailable: 'FACEIT ne répond pas pour le moment, réessaie dans une minute.', noNick: 'Indique un pseudo FACEIT : !{0} pseudo' },
  cs: { level: 'Úroveň {0}', calibrating: 'kalibrace', last: 'Poslední: {0}', notFound: 'Hráč {0} na FACEIT není.', noCs2: '{0} na FACEIT nehrál CS2.', unavailable: 'FACEIT teď neodpovídá, zkus to za minutu.', noNick: 'Zadej přezdívku FACEIT: !{0} přezdívka' },
};

const fill = (text, value) => text.replace('{0}', value);

/** The first word a viewer typed, without the @ chat adds to names. Anything that cannot be a nickname is dropped. */
export function chatNick(raw) {
  const word = String(raw ?? '').trim().split(/\s+/)[0] ?? '';
  const nick = word.replace(/^@+/, '');
  if (nick.length < 2 || nick.length > 36) return '';
  return /^[\p{L}\p{N}_.-]+$/u.test(nick) ? nick : '';
}

/** Reads the query of one request: who to look up, in which language, and which parts to add. */
export function chatRequest(rawUrl) {
  const url = new URL(rawUrl || '/', 'http://localhost');
  const lang = CHAT_LANGUAGES.includes(url.searchParams.get('lang') ?? '') ? url.searchParams.get('lang') : 'en';
  const asked = (url.searchParams.get('show') ?? '').split(',').map((part) => part.trim());
  const show = url.searchParams.has('show') ? CHAT_PARTS.filter((part) => asked.includes(part)) : DEFAULT_PARTS;
  const cmd = (url.searchParams.get('cmd') ?? '').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 24) || 'elo';
  return {
    nick: chatNick(url.searchParams.get('nick')) || chatNick(url.searchParams.get('default')),
    lang,
    show,
    cmd,
  };
}

const parse = (entry) => {
  try {
    return entry?.status === 200 ? JSON.parse(entry.body) : null;
  } catch {
    return null;
  }
};

const number = (value) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

/** K/D over the recent matches (kills divided by deaths) and the newest results, newest first. */
export function recentForm(items) {
  const rows = Array.isArray(items) ? items.slice(0, RECENT_MATCHES) : [];
  let kills = 0;
  let deaths = 0;
  const form = [];
  for (const row of rows) {
    const stats = row?.stats ?? {};
    kills += number(stats.Kills);
    deaths += number(stats.Deaths);
    if (form.length < FORM_MATCHES && (stats.Result === '1' || stats.Result === 1)) form.push('W');
    else if (form.length < FORM_MATCHES && (stats.Result === '0' || stats.Result === 0)) form.push('L');
  }
  return { kd: rows.length && deaths > 0 ? kills / deaths : null, form };
}

/** FACEIT nicknames are case-sensitive, chat is not: the search finds the player whose nickname matches in any case. */
async function searchPlayer(nick, read) {
  const found = parse(await read(`/search/players?nickname=${encodeURIComponent(nick)}&limit=20`));
  const wanted = nick.toLowerCase();
  const match = (Array.isArray(found?.items) ? found.items : []).find(
    (item) => typeof item?.nickname === 'string' && item.nickname.toLowerCase() === wanted && PLAYER_ID.test(String(item.player_id || ''))
  );
  return match ? String(match.player_id).toLowerCase() : '';
}

const withDeadline = (promise, ms) =>
  Promise.race([promise.catch(() => null), new Promise((resolve) => setTimeout(() => resolve(null), ms).unref?.())]);

/** One line for the chat. `read` is a cached FACEIT read; tests pass their own. */
export async function chatReply({ nick, lang, show, cmd }, read = readFaceit) {
  const text = TEXT[lang] ?? TEXT.en;
  if (!nick) return fill(text.noNick, cmd);
  let profileEntry = await read(PLAYER_ID.test(nick) ? `/players/${nick.toLowerCase()}` : `/players?nickname=${encodeURIComponent(nick)}`);
  if (profileEntry?.status === 404 && !PLAYER_ID.test(nick)) {
    const id = await searchPlayer(nick, read);
    if (id) profileEntry = await read(`/players/${id}`);
  }
  if (profileEntry?.status === 404 || profileEntry?.status === 400) return fill(text.notFound, nick);
  const profile = parse(profileEntry);
  if (!profile) return text.unavailable;
  const name = typeof profile.nickname === 'string' ? profile.nickname : nick;
  const cs2 = profile.games?.cs2;
  if (!cs2 || !Number.isFinite(Number(cs2.faceit_elo))) return fill(text.noCs2, name);
  const id = String(profile.player_id || '').toLowerCase();
  const calibrating = cs2.is_calibrating === true;
  const region = typeof cs2.region === 'string' && /^[A-Za-z0-9_-]{2,8}$/.test(cs2.region) ? cs2.region : 'EU';

  const wantsRank = show.includes('rank') && !calibrating && PLAYER_ID.test(id);
  const wantsMatches = (show.includes('kd') || show.includes('last')) && PLAYER_ID.test(id);
  const [rankEntry, matchesEntry] = await Promise.all([
    wantsRank ? withDeadline(read(`/rankings/games/cs2/regions/${region}/players/${id}`), EXTRAS_DEADLINE_MS) : null,
    wantsMatches ? withDeadline(read(`/players/${id}/games/cs2/stats?limit=100`), EXTRAS_DEADLINE_MS) : null,
  ]);

  const parts = [`${name}: ${Math.round(Number(cs2.faceit_elo))} ELO`];
  parts.push(calibrating ? text.calibrating : fill(text.level, String(Number(cs2.skill_level) || 1)));
  const position = Number(parse(rankEntry)?.position);
  if (wantsRank && Number.isInteger(position) && position >= 1) parts.push(`#${position} ${region.toUpperCase()}`);
  const recent = recentForm(parse(matchesEntry)?.items);
  if (show.includes('kd') && recent.kd !== null) parts.push(`K/D ${recent.kd.toFixed(2)}`);
  if (show.includes('last') && recent.form.length) parts.push(fill(text.last, recent.form.join(' ')));
  return parts.join(' · ').slice(0, CHAT_REPLY_MAX);
}

/** Bots answer for many channels from a few addresses, and every answer is cached: a generous limit per address. */
const limit = createRateLimiter({ perMinute: 600 });

/** Serves the chat command. Returns false when the path is not this one. */
export async function handleChatCommand(req, res, { unlimitedRate = false, read = readFaceit } = {}) {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  if (pathname !== CHAT_COMMAND_PATH) return false;
  const send = (status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(body);
  };
  if (req.method !== 'GET') {
    send(405, 'GET only');
    return true;
  }
  const request = chatRequest(req.url);
  const ip = clientIp(req.headers, req.socket?.remoteAddress, Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1));
  if (!unlimitedRate && !limit(ip)) {
    send(200, (TEXT[request.lang] ?? TEXT.en).unavailable);
    return true;
  }
  count('chat.elo');
  send(200, await chatReply(request, read));
  return true;
}
