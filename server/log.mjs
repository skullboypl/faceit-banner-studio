/**
 * One short line per event, and one summary line a minute, instead of a line per request.
 * Format: `HH:MM:SS [scope] message` (UTC). Counters are collected with count() and peak(), printed by startSummary().
 */
const stamp = () => new Date().toISOString().slice(11, 19);

export const log = (scope, message) => console.log(`${stamp()} [${scope}] ${message}`);
export const warn = (scope, message) => console.warn(`${stamp()} [${scope}] ${message}`);
export const fail = (scope, message) => console.error(`${stamp()} [${scope}] ${message}`);

const counters = new Map();

export function count(name, amount = 1) {
  counters.set(name, (counters.get(name) ?? 0) + amount);
}

/** Keeps the highest value seen since the last summary. */
export function peak(name, value) {
  if (value > (counters.get(name) ?? 0)) counters.set(name, value);
}

/** The counters since the last call, as a plain object; they start again from zero. */
export function takeSnapshot() {
  const snapshot = Object.fromEntries(counters);
  counters.clear();
  return snapshot;
}

const lastSeen = new Map();

/** True the first time and then only after `intervalMs`: keeps a repeating problem to one line per interval. */
export function once(key, intervalMs, now = Date.now) {
  const current = now();
  if (lastSeen.has(key) && current - lastSeen.get(key) < intervalMs) return false;
  lastSeen.set(key, current);
  return true;
}

/** One readable line for a period, or null when nothing happened. */
export function formatSummary(snapshot, seconds) {
  const n = (name) => snapshot[name] ?? 0;
  if (!Object.values(snapshot).some((value) => value > 0)) return null;
  const parts = [];
  if (n('faceit.sent') || n('faceit.r429') || n('faceit.dropped') || n('faceit.full')) {
    parts.push(
      `FACEIT: ${n('faceit.sent')} req (${(n('faceit.sent') / seconds).toFixed(1)}/s), 429: ${n('faceit.r429')}, retried: ${n('faceit.retried')}, ` +
        `dropped: ${n('faceit.dropped')}, refused: ${n('faceit.full')}, queue peak: ${n('faceit.queue')}`
    );
  }
  if (n('cache.hit') || n('cache.miss')) {
    parts.push(`cache: ${n('cache.hit')} hit, ${n('cache.miss')} miss, ${n('cache.stale')} stale, ${n('cache.kept')} kept (no new match)`);
  }
  if (n('live.builds')) parts.push(`live list: ${n('live.builds')} builds, ${n('live.partial')} partial`);
  if (n('img.copy') || n('img.redirect') || n('img.miss')) {
    parts.push(`images: ${n('img.copy')} copy, ${n('img.redirect')} redirect, ${n('img.miss')} miss, ${n('img.late')} late, ${n('img.limited')} limited`);
  }
  return `[last ${seconds}s] ${parts.join(' | ')}`;
}

let timer;

/** Prints the summary line every `seconds`; does nothing when LOG_SUMMARY=0. The timer never keeps the process alive. */
export function startSummary(seconds = 60) {
  if (timer || process.env.LOG_SUMMARY === '0') return;
  timer = setInterval(() => {
    const line = formatSummary(takeSnapshot(), seconds);
    if (line) log('stats', line.replace(/^\[last (\d+s)\] /, 'last $1: '));
  }, seconds * 1000);
  timer.unref?.();
}
