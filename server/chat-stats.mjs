import { postgresCall, redisCall } from './store.mjs';

/**
 * How often the chat commands are used: across the site, per streamer (the nickname the command answers when a
 * viewer types none, which the studio puts in every command), and per streamer today.
 *
 * Postgres keeps the numbers. Calls are gathered in memory and written in one statement every FLUSH_MS, so a busy
 * chat costs one write every half minute, not one per message. Redis is only a cache of the sums: a missing key is
 * rebuilt from Postgres plus the calls not written yet, and a call only bumps keys that are already there.
 * With both down the numbers live in this process until it restarts.
 */
const PREFIX = 'fb:chatcmd2:';
export const CHAT_STATS_FLUSH_MS = 30_000;
/** A flush starts early once this many (streamer, day, command) rows wait. */
const FLUSH_EARLY_ROWS = 2000;
/** The cached sums are rebuilt from Postgres at least daily, so cache and table cannot drift for long. */
const CACHE_TTL_SECONDS = 24 * 60 * 60;
/** A day's numbers are only read on that day; two days of room covers the time zones. */
const DAY_TTL_SECONDS = 2 * 24 * 60 * 60;
const MEMORY_LIMIT = 5000;

/** Bumps each hash that exists; a missing one is left for the next read to rebuild from Postgres. */
const BUMP_EXISTING = `for _, key in ipairs(KEYS) do
  if redis.call('EXISTS', key) == 1 then redis.call('HINCRBY', key, ARGV[1], 1) end
end
return 1`;

/** "2026-11-03", in UTC, like the other day counters of this server. */
export const chatDay = (at = new Date()) => at.toISOString().slice(0, 10);

const totalKey = () => `${PREFIX}total`;
const ownerKey = (owner) => `${PREFIX}owner:${owner}`;
const dayKey = (owner, day) => `${PREFIX}day:${day}:${owner}`;
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
  const memory = new Map();

  const bumpMemory = (key, kind) => {
    const bag = memory.get(key) ?? {};
    bag[kind] = (bag[kind] ?? 0) + 1;
    memory.delete(key);
    memory.set(key, bag);
    while (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value);
  };

  /** Calls waiting for Postgres that fall in one scope: the site, one streamer, or one streamer on one day. */
  const unsaved = (match) => {
    const out = emptyCounts(kinds);
    for (const map of [pending, flushing]) {
      for (const [key, n] of map) {
        const [owner, day, kind] = key.split('\n');
        if (match(owner, day) && kind in out) out[kind] += n;
      }
    }
    return out;
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

  /** One answered command. `owner` is the streamer's lowercased nickname, or '' when the link names none. */
  const record = async (kind, owner = '') => {
    if (!kinds.includes(kind)) return;
    const day = chatDay(now());
    const key = rowKey(owner, day, kind);
    pending.set(key, (pending.get(key) ?? 0) + 1);
    const keys = [totalKey(), ...(owner ? [ownerKey(owner), dayKey(owner, day)] : [])];
    keys.forEach((cacheKey) => bumpMemory(cacheKey, kind));
    if (pending.size >= FLUSH_EARLY_ROWS) void flush();
    else schedule();
    await redis((client) => client.eval(BUMP_EXISTING, keys.length, ...keys, kind));
  };

  /** The sums of one scope from Postgres plus what is still waiting; undefined when Postgres is down. */
  const fromPostgres = async (scope, owner, day) => {
    const rows = await postgres(async (pool) => {
      if (scope === 'total') {
        return (await pool.query('SELECT kind, SUM(n)::bigint AS n FROM chat_command_counts GROUP BY kind')).rows;
      }
      if (scope === 'mine') {
        return (await pool.query('SELECT kind, SUM(n)::bigint AS n FROM chat_command_counts WHERE owner = $1 GROUP BY kind', [owner])).rows;
      }
      return (await pool.query('SELECT kind, n FROM chat_command_counts WHERE owner = $1 AND day = $2', [owner, day])).rows;
    }).catch(() => undefined);
    if (rows === undefined) return undefined;
    const saved = rowsToCounts(rows, kinds);
    const waiting = unsaved((rowOwner, rowDay) =>
      scope === 'total' ? true : scope === 'mine' ? rowOwner === owner : rowOwner === owner && rowDay === day
    );
    return Object.fromEntries(kinds.map((kind) => [kind, saved[kind] + waiting[kind]]));
  };

  /** The numbers for one streamer, plus the whole site: Redis first, Postgres for a missing key, memory last. */
  const read = async (owner = '') => {
    const day = chatDay(now());
    const scopes = [
      { name: 'total', key: totalKey(), ttl: CACHE_TTL_SECONDS },
      ...(owner
        ? [
            { name: 'mine', key: ownerKey(owner), ttl: CACHE_TTL_SECONDS },
            { name: 'today', key: dayKey(owner, day), ttl: DAY_TTL_SECONDS },
          ]
        : []),
    ];
    const cached = await redis((client) => Promise.all(scopes.map((scope) => client.hgetall(scope.key))));
    const result = { total: emptyCounts(kinds), mine: emptyCounts(kinds), today: emptyCounts(kinds) };
    const rebuilt = [];
    for (const [index, scope] of scopes.entries()) {
      const hit = Array.isArray(cached) ? cached[index] : undefined;
      if (hit && Object.keys(hit).length) {
        result[scope.name] = countsFrom(hit, kinds);
        continue;
      }
      const sums = await fromPostgres(scope.name, owner, day);
      if (sums) {
        result[scope.name] = sums;
        rebuilt.push({ scope, sums });
      } else {
        result[scope.name] = countsFrom(memory.get(scope.key), kinds);
      }
    }
    /* A flush in the middle of writing could count its calls twice: the cache waits for the next read */
    if (rebuilt.length && !running) {
      await redis(async (client) => {
        const batch = client.multi();
        for (const { scope, sums } of rebuilt) {
          batch.hset(scope.key, sums);
          batch.expire(scope.key, scope.ttl);
        }
        await batch.exec();
      });
    }
    return result;
  };

  return { record, read, flush };
}
