import { createRateLimiter } from '../shared/rate-limit.mjs';
import { clientIp } from '../shared/client-ip.mjs';
import { readFaceit } from './faceit-proxy.mjs';
import { count } from './log.mjs';
import { averageElo, matchPhase } from '../shared/banner-modes.mjs';

/**
 * Chat commands for bots (StreamElements, Nightbot, Fossabot and any bot that can read a URL):
 * !elo, !last, !kd, !avg and !live, each with an optional nickname.
 * GET /api/faceit/elo?type=last&nick=…&default=…&lang=pl&show=rank,last&cmd=last answers one line of plain text.
 * Bots print the body as it is and ignore the status, so every answer, errors included, is a 200 with a sentence.
 */
export const CHAT_COMMAND_PATH = '/api/faceit/elo';
/** StreamElements and Nightbot cut a reply after 400 characters. */
export const CHAT_REPLY_MAX = 380;
export const CHAT_LANGUAGES = ['en', 'pl', 'de', 'uk', 'ru', 'tr', 'pt', 'es', 'fr', 'cs'];
export const CHAT_PARTS = ['rank', 'kd', 'last'];
/** What a command answers. `live` reads the same lobby and match data as the match popup. */
export const CHAT_KINDS = ['elo', 'last', 'kd', 'avg', 'live'];
const DEFAULT_PARTS = ['rank', 'last'];
const RECENT_MATCHES = 20;
const FORM_MATCHES = 5;
/** Bots wait a few seconds at most: the ranking and the matches are left out rather than make the reply late. */
const EXTRAS_DEADLINE_MS = 3000;
/** The ten profiles behind the team averages of !live get less time: the match itself is the answer. */
const ROSTER_DEADLINE_MS = 2500;
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

/** Texts of !last, !kd, !avg and !live. */
const MORE = {
  en: { lastMatch: 'Last match', agoMin: '{0} min ago', agoHour: '{0} h ago', agoDay: '{0} d ago', noMatches: '{0} has no CS2 matches on FACEIT yet.', matches: '{0} matches', lastShort: 'last match', avgOf: 'average of {0} matches', kills: 'kills', wins: 'wins', liveNow: '{0} is playing now', lobby: '{0} is in a lobby', notPlaying: '{0} is not in a match right now.', avgElo: 'avg ELO' },
  pl: { lastMatch: 'Ostatni mecz', agoMin: '{0} min temu', agoHour: '{0} godz. temu', agoDay: '{0} dni temu', noMatches: '{0} nie ma jeszcze meczów CS2 na FACEIT.', matches: '{0} meczów', lastShort: 'ostatni mecz', avgOf: 'średnia z {0} meczów', kills: 'zabójstwa', wins: 'wygrane', liveNow: '{0} gra teraz', lobby: '{0} jest w lobby meczu', notPlaying: '{0} nie gra teraz meczu.', avgElo: 'śr. ELO' },
  de: { lastMatch: 'Letztes Match', agoMin: 'vor {0} Min.', agoHour: 'vor {0} Std.', agoDay: 'vor {0} T.', noMatches: '{0} hat noch keine CS2-Matches auf FACEIT.', matches: '{0} Matches', lastShort: 'letztes Match', avgOf: 'Schnitt aus {0} Matches', kills: 'Kills', wins: 'Siege', liveNow: '{0} spielt gerade', lobby: '{0} ist in einer Match-Lobby', notPlaying: '{0} ist gerade in keinem Match.', avgElo: 'Ø ELO' },
  uk: { lastMatch: 'Останній матч', agoMin: '{0} хв тому', agoHour: '{0} год тому', agoDay: '{0} дн. тому', noMatches: '{0} ще не має матчів CS2 на FACEIT.', matches: '{0} матчів', lastShort: 'останній матч', avgOf: 'середнє за {0} матчів', kills: 'вбивства', wins: 'перемоги', liveNow: '{0} зараз грає', lobby: '{0} у лобі матчу', notPlaying: '{0} зараз не грає матч.', avgElo: 'сер. ELO' },
  ru: { lastMatch: 'Последний матч', agoMin: '{0} мин назад', agoHour: '{0} ч назад', agoDay: '{0} дн. назад', noMatches: 'У {0} ещё нет матчей CS2 на FACEIT.', matches: '{0} матчей', lastShort: 'последний матч', avgOf: 'в среднем за {0} матчей', kills: 'убийства', wins: 'победы', liveNow: '{0} сейчас играет', lobby: '{0} в лобби матча', notPlaying: '{0} сейчас не играет матч.', avgElo: 'ср. ELO' },
  tr: { lastMatch: 'Son maç', agoMin: '{0} dk önce', agoHour: '{0} sa önce', agoDay: '{0} gün önce', noMatches: "{0} henüz FACEIT'te CS2 maçı oynamamış.", matches: '{0} maç', lastShort: 'son maç', avgOf: '{0} maç ortalaması', kills: 'öldürme', wins: 'galibiyet', liveNow: '{0} şu an oynuyor', lobby: '{0} maç lobisinde', notPlaying: '{0} şu an maçta değil.', avgElo: 'ort. ELO' },
  pt: { lastMatch: 'Última partida', agoMin: 'há {0} min', agoHour: 'há {0} h', agoDay: 'há {0} d', noMatches: '{0} ainda não tem partidas de CS2 na FACEIT.', matches: '{0} partidas', lastShort: 'última partida', avgOf: 'média de {0} partidas', kills: 'abates', wins: 'vitórias', liveNow: '{0} está jogando agora', lobby: '{0} está no lobby de uma partida', notPlaying: '{0} não está em uma partida agora.', avgElo: 'ELO médio' },
  es: { lastMatch: 'Última partida', agoMin: 'hace {0} min', agoHour: 'hace {0} h', agoDay: 'hace {0} d', noMatches: '{0} aún no tiene partidas de CS2 en FACEIT.', matches: '{0} partidas', lastShort: 'última partida', avgOf: 'media de {0} partidas', kills: 'bajas', wins: 'victorias', liveNow: '{0} está jugando ahora', lobby: '{0} está en el lobby de una partida', notPlaying: '{0} no está en una partida ahora.', avgElo: 'ELO medio' },
  fr: { lastMatch: 'Dernier match', agoMin: 'il y a {0} min', agoHour: 'il y a {0} h', agoDay: 'il y a {0} j', noMatches: "{0} n'a encore aucun match CS2 sur FACEIT.", matches: '{0} matchs', lastShort: 'dernier match', avgOf: 'moyenne sur {0} matchs', kills: 'kills', wins: 'victoires', liveNow: '{0} joue en ce moment', lobby: "{0} est dans le lobby d'un match", notPlaying: "{0} n'est pas en match en ce moment.", avgElo: 'ELO moyen' },
  cs: { lastMatch: 'Poslední zápas', agoMin: 'před {0} min', agoHour: 'před {0} h', agoDay: 'před {0} d', noMatches: '{0} zatím nemá na FACEIT žádné zápasy CS2.', matches: '{0} zápasů', lastShort: 'poslední zápas', avgOf: 'průměr z {0} zápasů', kills: 'zabití', wins: 'výhry', liveNow: '{0} právě hraje', lobby: '{0} je v lobby zápasu', notPlaying: '{0} teď nehraje zápas.', avgElo: 'prům. ELO' },
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
  const kind = CHAT_KINDS.includes(url.searchParams.get('type') ?? '') ? url.searchParams.get('type') : 'elo';
  const cmd = (url.searchParams.get('cmd') ?? '').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 24) || kind;
  return {
    nick: chatNick(url.searchParams.get('nick')) || chatNick(url.searchParams.get('default')),
    lang,
    show,
    cmd,
    kind,
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

/** The profile behind a chat nick, or the sentence that says why there is none. */
async function findPlayer(nick, text, read) {
  let entry = await read(PLAYER_ID.test(nick) ? `/players/${nick.toLowerCase()}` : `/players?nickname=${encodeURIComponent(nick)}`);
  if (entry?.status === 404 && !PLAYER_ID.test(nick)) {
    const id = await searchPlayer(nick, read);
    if (id) entry = await read(`/players/${id}`);
  }
  if (entry?.status === 404 || entry?.status === 400) return { reply: fill(text.notFound, nick) };
  const profile = parse(entry);
  if (!profile) return { reply: text.unavailable };
  const name = typeof profile.nickname === 'string' ? profile.nickname : nick;
  const cs2 = profile.games?.cs2;
  if (!cs2 || !Number.isFinite(Number(cs2.faceit_elo))) return { reply: fill(text.noCs2, name) };
  const id = String(profile.player_id || '').toLowerCase();
  if (!PLAYER_ID.test(id)) return { reply: text.unavailable };
  return { name, cs2, id };
}

/** "de_mirage" → "Mirage". */
export function mapName(raw) {
  const value = String(raw ?? '').trim().replace(/^de_/i, '');
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

/** "13 / 9" → "13:9". */
const scoreOf = (raw) => {
  const numbers = String(raw ?? '').match(/\d+/g);
  return numbers && numbers.length >= 2 ? `${numbers[0]}:${numbers[1]}` : '';
};

function ago(finishedAt, now, more) {
  const ms = Number(finishedAt);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  /* FACEIT gives this one in milliseconds; seconds would land in 1970 */
  const minutes = Math.max(0, Math.round((now - (ms < 1e12 ? ms * 1000 : ms)) / 60_000));
  if (minutes < 60) return fill(more.agoMin, String(Math.max(1, minutes)));
  if (minutes < 48 * 60) return fill(more.agoHour, String(Math.round(minutes / 60)));
  return fill(more.agoDay, String(Math.round(minutes / 1440)));
}

/** Averages over the recent matches. K/D is total kills over total deaths; the rest are per-match means. */
export function recentAverages(items, size = RECENT_MATCHES) {
  const rows = Array.isArray(items) ? items.slice(0, size) : [];
  if (!rows.length) return null;
  let kills = 0;
  let deaths = 0;
  let adr = 0;
  let hs = 0;
  let kr = 0;
  let wins = 0;
  for (const row of rows) {
    const stats = row?.stats ?? {};
    kills += number(stats.Kills);
    deaths += number(stats.Deaths);
    adr += number(stats.ADR ?? stats['Average Damage per Round']);
    hs += number(stats['Headshots %']);
    kr += number(stats['K/R Ratio']);
    if (stats.Result === '1' || stats.Result === 1) wins += 1;
  }
  const n = rows.length;
  return {
    matches: n,
    kd: deaths > 0 ? kills / deaths : kills,
    kills: kills / n,
    adr: adr / n,
    hs: hs / n,
    kr: kr / n,
    winRate: (wins / n) * 100,
  };
}

const fixed = (value, digits) => (Number.isFinite(value) ? value.toFixed(digits) : '0');

async function eloReply({ name, cs2, id }, { show }, text, read) {
  const calibrating = cs2.is_calibrating === true;
  const region = typeof cs2.region === 'string' && /^[A-Za-z0-9_-]{2,8}$/.test(cs2.region) ? cs2.region : 'EU';
  const wantsRank = show.includes('rank') && !calibrating;
  const wantsMatches = show.includes('kd') || show.includes('last');
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
  return parts.join(' · ');
}

async function matchRows({ id }, text, read) {
  const entry = await read(`/players/${id}/games/cs2/stats?limit=100`);
  const body = parse(entry);
  if (!body) return { reply: text.unavailable };
  return { items: Array.isArray(body.items) ? body.items : [] };
}

async function lastReply(player, text, more, read, now) {
  const { reply, items } = await matchRows(player, text, read);
  if (reply) return reply;
  const stats = items[0]?.stats;
  if (!stats) return fill(more.noMatches, player.name);
  const result = stats.Result === '1' || stats.Result === 1 ? 'W' : stats.Result === '0' || stats.Result === 0 ? 'L' : '';
  const kills = number(stats.Kills);
  const deaths = number(stats.Deaths);
  const parts = [`${player.name} · ${more.lastMatch}: ${mapName(stats.Map) || '?'}`];
  const score = scoreOf(stats.Score);
  if (result || score) parts.push([result, score].filter(Boolean).join(' '));
  parts.push(`${kills}-${deaths}-${number(stats.Assists)}`);
  parts.push(`K/D ${fixed(deaths > 0 ? kills / deaths : kills, 2)}`);
  const adr = number(stats.ADR ?? stats['Average Damage per Round']);
  if (adr > 0) parts.push(`ADR ${fixed(adr, 0)}`);
  parts.push(`HS ${fixed(number(stats['Headshots %']), 0)}%`);
  const when = ago(stats['Match Finished At'], now, more);
  if (when) parts.push(when);
  return parts.join(' · ');
}

async function kdReply(player, text, more, read) {
  const { reply, items } = await matchRows(player, text, read);
  if (reply) return reply;
  const recent = recentAverages(items);
  if (!recent) return fill(more.noMatches, player.name);
  const parts = [`${player.name}: K/D ${fixed(recent.kd, 2)} (${fill(more.matches, String(recent.matches))})`];
  const last = recentAverages(items, 1);
  if (last) parts.push(`${more.lastShort} ${fixed(last.kd, 2)}`);
  return parts.join(' · ');
}

async function avgReply(player, text, more, read) {
  const { reply, items } = await matchRows(player, text, read);
  if (reply) return reply;
  const recent = recentAverages(items);
  if (!recent) return fill(more.noMatches, player.name);
  return [
    `${player.name} · ${fill(more.avgOf, String(recent.matches))}: K/D ${fixed(recent.kd, 2)}`,
    `K/R ${fixed(recent.kr, 2)}`,
    `ADR ${fixed(recent.adr, 1)}`,
    `HS ${fixed(recent.hs, 0)}%`,
    `${fixed(recent.kills, 1)} ${more.kills}`,
    `${fixed(recent.winRate, 0)}% ${more.wins}`,
  ].join(' · ');
}

const rosterIds = (team) =>
  (Array.isArray(team?.roster) ? team.roster : Array.isArray(team?.players) ? team.players : [])
    .map((player) => String(player?.player_id || '').toLowerCase())
    .filter((playerId) => PLAYER_ID.test(playerId))
    .slice(0, 5);

/** Average ELO of a team, from the same cached profile reads the banners use; 0 when FACEIT was too slow. */
async function teamElo(ids, read) {
  const profiles = await Promise.all(ids.map((playerId) => withDeadline(read(`/players/${playerId}`), ROSTER_DEADLINE_MS)));
  return averageElo(profiles.map((entry) => ({ elo: parse(entry)?.games?.cs2?.faceit_elo })));
}

/** The lobby or running match, read the way the match popup reads it: the active lookup, then the match. */
async function liveReply(player, text, more, read) {
  const active = parse(await read(`/players/${player.id}/active`));
  const matchId = typeof active?.match_id === 'string' ? active.match_id : '';
  if (!matchId) return active ? fill(more.notPlaying, player.name) : text.unavailable;
  const details = parse(await withDeadline(read(`/matches/${matchId}`), EXTRAS_DEADLINE_MS)) ?? {};
  const phase = matchPhase(String(details.status || active.status || ''));
  const parts = [fill(phase === 'pre' ? more.lobby : more.liveNow, player.name)];
  const map = mapName(details.voting?.map?.pick?.[0]);
  if (map) parts.push(map);
  const left = Number(details.results?.score?.faction1);
  const right = Number(details.results?.score?.faction2);
  const teams = [details.teams?.faction1, details.teams?.faction2];
  const mine = rosterIds(teams[1]).includes(player.id) ? 1 : 0;
  if (Number.isFinite(left) && Number.isFinite(right)) parts.push(mine === 1 ? `${right}:${left}` : `${left}:${right}`);
  const [own, rival] = await Promise.all([teamElo(rosterIds(teams[mine]), read), teamElo(rosterIds(teams[1 - mine]), read)]);
  if (own > 0 && rival > 0) parts.push(`${more.avgElo} ${own} vs ${rival}`);
  parts.push(`faceit.com/en/cs2/room/${matchId}`);
  return parts.join(' · ');
}

/** One line for the chat. `read` is a cached FACEIT read; tests pass their own. */
export async function chatReply({ nick, lang, show = DEFAULT_PARTS, cmd = 'elo', kind = 'elo' }, read = readFaceit, now = Date.now()) {
  const text = TEXT[lang] ?? TEXT.en;
  const more = MORE[lang] ?? MORE.en;
  if (!nick) return fill(text.noNick, cmd);
  const player = await findPlayer(nick, text, read);
  if (player.reply) return player.reply;
  let reply;
  if (kind === 'last') reply = await lastReply(player, text, more, read, now);
  else if (kind === 'kd') reply = await kdReply(player, text, more, read);
  else if (kind === 'avg') reply = await avgReply(player, text, more, read);
  else if (kind === 'live') reply = await liveReply(player, text, more, read);
  else reply = await eloReply(player, { show }, text, read);
  return reply.slice(0, CHAT_REPLY_MAX);
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
  count(`chat.${request.kind}`);
  send(200, await chatReply(request, read));
  return true;
}
