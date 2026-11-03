import { redisCall } from './store.mjs';

/**
 * How often the chat commands are used: across the site, per streamer (the nickname the command answers when a
 * viewer types none, which the studio puts in every command), and per streamer today. Redis keeps the numbers across
 * restarts; without it they live in memory until the next one.
 */
const PREFIX = 'fb:chatcmd:';
/** A day's numbers are only read on that day; two days of room covers the time zones. */
const DAY_TTL_SECONDS = 2 * 24 * 60 * 60;
/** Streamer keys stay while the commands are used; a year without a call lets one go. */
const OWNER_TTL_SECONDS = 365 * 24 * 60 * 60;
const MEMORY_LIMIT = 5000;

/** "2026-11-03", in UTC, like the other day counters of this server. */
export const chatDay = (at = new Date()) => at.toISOString().slice(0, 10);

const ownerKey = (owner) => `${PREFIX}owner:${owner}`;
const dayKey = (owner, day) => `${PREFIX}day:${day}:${owner}`;
const TOTAL_KEY = `${PREFIX}total`;

/** Field counts of a hash, as numbers; anything that is not a known kind is left out. */
function counts(raw, kinds) {
  const out = Object.fromEntries(kinds.map((kind) => [kind, 0]));
  if (!raw || typeof raw !== 'object') return out;
  for (const kind of kinds) {
    const value = Number(raw[kind]);
    if (Number.isFinite(value) && value > 0) out[kind] = Math.floor(value);
  }
  return out;
}

export function createChatStats({ kinds, redis = redisCall, now = () => new Date() }) {
  const memory = new Map();
  const bump = (key, kind) => {
    const bag = memory.get(key) ?? {};
    bag[kind] = (bag[kind] ?? 0) + 1;
    memory.delete(key);
    memory.set(key, bag);
    while (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value);
  };

  /** One answered command. `owner` is the streamer's lowercased nickname, or '' when the link names none. */
  const record = async (kind, owner) => {
    if (!kinds.includes(kind)) return;
    const day = chatDay(now());
    const keys = [TOTAL_KEY, ...(owner ? [ownerKey(owner), dayKey(owner, day)] : [])];
    keys.forEach((key) => bump(key, kind));
    await redis(async (client) => {
      const batch = client.multi();
      batch.hincrby(TOTAL_KEY, kind, 1);
      if (owner) {
        batch.hincrby(ownerKey(owner), kind, 1);
        batch.expire(ownerKey(owner), OWNER_TTL_SECONDS);
        batch.hincrby(dayKey(owner, day), kind, 1);
        batch.expire(dayKey(owner, day), DAY_TTL_SECONDS);
      }
      await batch.exec();
    });
  };

  /** The numbers for one streamer, plus the whole site. Redis when it answers, this process's memory when not. */
  const read = async (owner) => {
    const day = chatDay(now());
    const keys = [TOTAL_KEY, ...(owner ? [ownerKey(owner), dayKey(owner, day)] : [])];
    const stored = await redis(async (client) => Promise.all(keys.map((key) => client.hgetall(key))));
    const pick = (index, key) => counts(Array.isArray(stored) ? stored[index] : memory.get(key), kinds);
    return {
      total: pick(0, TOTAL_KEY),
      mine: owner ? pick(1, ownerKey(owner)) : counts(null, kinds),
      today: owner ? pick(2, dayKey(owner, day)) : counts(null, kinds),
    };
  };

  return { record, read };
}
