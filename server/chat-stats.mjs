import { postgresCall, redisCall } from './store.mjs';

/**
 * How often the chat commands are used across the whole site: every channel's bot calls added together, all time
 * and today, plus how many channels use them. Each call still notes its channel (the nickname the command answers
 * when a viewer types none) so the channels can be counted.
 *
 * Postgres keeps the numbers. Calls are gathered in memory and written in one statement every FLUSH_MS, so a busy
 * chat costs one write every half minute, not one per message. Redis is only a cache of the sums: a missing key is
 * rebuilt from Postgres plus the calls not written yet, and a call only bumps keys that are already there.
 * With both down the numbers live in this process until it restarts.
 */
const PREFIX = 'fb:chatcmd2:';
export const CHAT_STATS_FLUSH_MS = 30_000;
/** A flush starts early once this many (channel, day, command) rows wait. */
const FLUSH_EARLY_ROWS = 2000;
/** The cached sums are rebuilt from Postgres at least daily, so cache and table cannot drift for long. */
const CACHE_TTL_SECONDS = 24 * 60 * 60;
/** A day's numbers are only read on that day; two days of room covers the time zones. */
const DAY_TTL_SECONDS = 2 * 24 * 60 * 60;
/** The channel count moves slowly: it is worked out again every few minutes. */
const CHANNELS_TTL_SECONDS = 5 * 60;
const MEMORY_CHANNELS_LIMIT = 50_000;

/** Bumps each hash that exists; a missing one is left for the next read to rebuild from Postgres. */
const BUMP_EXISTING = `for _, key in ipairs(KEYS) do
  if redis.call('EXISTS', key) == 1 then redis.call('HINCRBY', key, ARGV[1], 1) end
end
return 1`;

/** "2026-11-03", in UTC, like the other day counters of this server. */
export const chatDay = (at = new Date()) => at.toISOString().slice(0, 10);

const totalKey = () => `${PREFIX}total`;
const siteDayKey = (day) => `${PREFIX}site-day:${day}`;
const channelsKey = () => `${PREFIX}channels`;
const rowKey = (owner, day, kind) => `${owner}\n${day}\n${kind}`;

function emptyCounts(kinds) {
  return Object.fromEntries(kinds.map((kind) => [kind, 0]));
}

/** Field counts of a hash or of query rows, as whole numbers; unknown kinds are left out. */
function countsFrom(raw, kinds) {
  const out = emptyCounts(kinds);
  if (!raw || typeof raw !== 'object') return out;
  for (const kind of kinds) {
    const value = Number(raw[kind]);
    if (Number.isFinite(value) && value > 0) out[kind] = Math.floor(value);
  }
  return out;
}

const rowsToCounts = (rows, kinds) => countsFrom(Object.fromEntries((rows ?? []).map((row) => [row.kind, row.n])), kinds);

export function createChatStats({
  kinds,
  redis = redisCall,
  postgres = postgresCall,
  now = () => new Date(),
  flushMs = CHAT_STATS_FLUSH_MS,
  setTimer = (run, ms) => setTimeout(run, ms),
}) {
  /** Calls not in Postgres yet, and the ones a running flush is writing. */
  let pending = new Map();
  let flushing = new Map();
  let timer = null;
  let running = null;
  /** Everything counted since this process started: the answer when Redis and Postgres are both down. */
  const memory = { total: emptyCounts(kinds), days: new Map(), channels: new Set() };

  /** Calls waiting for Postgres, all time or on one day. */
  const unsaved = (day) => {
    const out = emptyCounts(kinds);
    for (const map of [pending, flushing]) {
      for (const [key, n] of map) {
        const [, rowDay, kind] = key.split('\n');
        if ((!day || rowDay === day) && kind in out) out[kind] += n;
      }
    }
    return out;
  };
  /** Channels of the calls waiting for Postgres. */
  const unsavedChannels = () => {
    const owners = new Set();
    for (const map of [pending, flushing]) {
      for (const key of map.keys()) {
        const owner = key.split('\n')[0];
        if (owner) owners.add(owner);
      }
    }
    return [...owners];
  };

  const flush = async () => {
    if (running) return running;
    if (!pending.size) return undefined;
    running = (async () => {
      flushing = pending;
      pending = new Map();
      const owners = [];
      const days = [];
      const kindList = [];
      const counts = [];
      for (const [key, n] of flushing) {
        const [owner, day, kind] = key.split('\n');
        owners.push(owner);
        days.push(day);
        kindList.push(kind);
        counts.push(n);
      }
      const saved = await postgres(async (pool) => {
        await pool.query(
          `INSERT INTO chat_command_counts (owner, day, kind, n)
           SELECT * FROM unnest($1::varchar[], $2::date[], $3::varchar[], $4::bigint[])
           ON CONFLICT (owner, day, kind) DO UPDATE SET n = chat_command_counts.n + EXCLUDED.n`,
          [owners, days, kindList, counts]
        );
        return true;
      }).catch(() => undefined);
      /* Not written: the calls go back in line for the next try */
      if (saved !== true) {
        for (const [key, n] of flushing) pending.set(key, (pending.get(key) ?? 0) + n);
      }
      flushing = new Map();
    })().finally(() => {
      running = null;
      if (pending.size) schedule();
    });
    return running;
  };

  const schedule = () => {
    if (timer) return;
    timer = setTimer(() => {
      timer = null;
      void flush();
    }, flushMs);
    timer?.unref?.();
  };

  /** One answered command. `owner` is the channel's lowercased nickname, or '' when the link names none. */
  const record = async (kind, owner = '') => {
    if (!kinds.includes(kind)) return;
    const day = chatDay(now());
    const key = rowKey(owner, day, kind);
    pending.set(key, (pending.get(key) ?? 0) + 1);
    memory.total[kind] += 1;
    const today = memory.days.get(day) ?? emptyCounts(kinds);
    today[kind] += 1;
    memory.days.set(day, today);
    for (const old of memory.days.keys()) if (old !== day) memory.days.delete(old);
    if (owner && memory.channels.size < MEMORY_CHANNELS_LIMIT) memory.channels.add(owner);
    if (pending.size >= FLUSH_EARLY_ROWS) void flush();
    else schedule();
    const keys = [totalKey(), siteDayKey(day)];
    await redis((client) => client.eval(BUMP_EXISTING, keys.length, ...keys, kind));
  };

  /** Sums from Postgres plus what is still waiting, all time or for one day; undefined when Postgres is down. */
  const fromPostgres = async (day) => {
    const rows = await postgres(async (pool) =>
      day
        ? (await pool.query('SELECT kind, SUM(n)::bigint AS n FROM chat_command_counts WHERE day = $1 GROUP BY kind', [day])).rows
        : (await pool.query('SELECT kind, SUM(n)::bigint AS n FROM chat_command_counts GROUP BY kind')).rows
    ).catch(() => undefined);
    if (rows === undefined) return undefined;
    const saved = rowsToCounts(rows, kinds);
    const waiting = unsaved(day);
    return Object.fromEntries(kinds.map((kind) => [kind, saved[kind] + waiting[kind]]));
  };

  /** Channels that used a command: the stored ones and the ones still waiting, counted once. */
  const channelsFromPostgres = async () => {
    const rows = await postgres(async (pool) =>
      (
        await pool.query(
          `SELECT COUNT(*)::int AS n FROM (
             SELECT owner FROM chat_command_counts WHERE owner <> ''
             UNION SELECT unnest($1::varchar[])
           ) AS channels`,
          [unsavedChannels()]
        )
      ).rows
    ).catch(() => undefined);
    const n = Number(rows?.[0]?.n);
    return rows === undefined || !Number.isFinite(n) ? undefined : n;
  };

  /** The site's numbers: Redis first, Postgres for a missing key, this process's memory last. */
  const read = async () => {
    const day = chatDay(now());
    const scopes = [
      { name: 'total', key: totalKey(), ttl: CACHE_TTL_SECONDS, day: '' },
      { name: 'today', key: siteDayKey(day), ttl: DAY_TTL_SECONDS, day },
    ];
    const cached = await redis((client) => Promise.all([...scopes.map((scope) => client.hgetall(scope.key)), client.get(channelsKey())]));
    const result = { total: emptyCounts(kinds), today: emptyCounts(kinds), channels: 0 };
    const rebuilt = [];
    for (const [index, scope] of scopes.entries()) {
      const hit = Array.isArray(cached) ? cached[index] : undefined;
      if (hit && Object.keys(hit).length) {
        result[scope.name] = countsFrom(hit, kinds);
        continue;
      }
      const sums = await fromPostgres(scope.day);
      if (sums) {
        result[scope.name] = sums;
        rebuilt.push({ scope, sums });
      } else {
        result[scope.name] = scope.day ? { ...(memory.days.get(day) ?? emptyCounts(kinds)) } : { ...memory.total };
      }
    }
    const cachedChannels = Array.isArray(cached) ? Number(cached[scopes.length]) : NaN;
    let freshChannels;
    if (Number.isFinite(cachedChannels) && cached[scopes.length] !== null) result.channels = cachedChannels;
    else {
      freshChannels = await channelsFromPostgres();
      result.channels = freshChannels ?? memory.channels.size;
    }
    /* A flush in the middle of writing could count its calls twice: the cache waits for the next read */
    if ((rebuilt.length || freshChannels !== undefined) && !running) {
      await redis(async (client) => {
        const batch = client.multi();
        for (const { scope, sums } of rebuilt) {
          batch.hset(scope.key, sums);
          batch.expire(scope.key, scope.ttl);
        }
        if (freshChannels !== undefined) batch.set(channelsKey(), String(freshChannels), 'EX', CHANNELS_TTL_SECONDS);
        await batch.exec();
      });
    }
    return result;
  };

  return { record, read, flush };
}
