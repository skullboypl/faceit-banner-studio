/**
 * Every request to the FACEIT Data API passes through here. FACEIT allows 20 requests per second per key
 * (ratelimit-limit: 20, 20;w=1), and a burst, such as a roster loading or the live list filling, used to
 * exceed that and come back as 429. The gate spreads requests out instead of failing them, retries a 429 after the
 * pause FACEIT asks for, and refuses new work only when the queue is absurdly long.
 */
const API_HOST = 'open.faceit.com';

/**
 * The key this server uses for the FACEIT Data API. Create it as a "server side" key in the FACEIT developer portal and
 * set FACEIT_SERVER_KEY. FACEIT_API_KEY and VITE_FACEIT_API_KEY still work, so an existing setup keeps running.
 * The browser has its own key (VITE_FACEIT_CLIENT_KEY) that is only a fallback.
 */
export const faceitServerKey = () =>
  process.env.FACEIT_SERVER_KEY || process.env.FACEIT_API_KEY || process.env.VITE_FACEIT_API_KEY || '';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isFaceitApi = (url) => {
  try {
    return new URL(String(url)).hostname === API_HOST;
  } catch {
    return false;
  }
};

/** How long FACEIT asks to wait, from Retry-After or the ratelimit-reset header (seconds). Defaults to a second. */
function pauseFrom(response) {
  const raw = response.headers?.get('retry-after') ?? response.headers?.get('ratelimit-reset');
  const seconds = Number(raw);
  const ms = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000;
  return Math.min(5000, Math.max(250, ms));
}

export function createFaceitGate({
  rps = Number(process.env.FACEIT_RPS) || 16,
  retries = 2,
  maxQueue = 400,
  /** Slots of each second that background work (`priority: 'low'`) leaves free for banners. */
  reserve = 4,
  fetcher = (...args) => fetch(...args),
  now = Date.now,
  sleep = wait,
} = {}) {
  const starts = [];
  const queue = [];
  const background = [];
  let pumping = false;

  const pump = async () => {
    if (pumping) return;
    pumping = true;
    while (queue.length || background.length) {
      /* Banners first; background work only while it leaves `reserve` slots of the second free */
      const lane = queue.length ? queue : background;
      const limit = lane === queue ? rps : Math.max(1, rps - reserve);
      const current = now();
      while (starts.length && current - starts[0] >= 1000) starts.shift();
      if (starts.length >= limit) {
        await sleep(starts[0] + 1000 - current);
        continue;
      }
      starts.push(now());
      lane.shift()();
    }
    pumping = false;
  };

  const schedule = (run, low) =>
    new Promise((resolve, reject) => {
      if (queue.length + background.length >= maxQueue) return reject(new Error('faceit_queue_full'));
      (low ? background : queue).push(() => run().then(resolve, reject));
      void pump();
    });

  /** 0 when nothing waits, 1 when about three seconds of requests are queued. */
  const pressure = () => Math.min(1, (queue.length + background.length) / (rps * 3));

  /** Like fetch, with `timeoutMs` counted from the moment the request is actually sent. */
  async function gatedFetch(url, init = {}) {
    const { timeoutMs, signal, priority, ...rest } = init;
    const options = () => ({ ...rest, signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : signal });
    if (!isFaceitApi(url)) return fetcher(url, options());
    for (let attempt = 0; ; attempt++) {
      const response = await schedule(() => fetcher(url, options()), priority === 'low');
      if (response.status !== 429 || attempt >= retries) return response;
      await sleep(pauseFrom(response) + Math.floor(Math.random() * 150));
    }
  }

  return { fetch: gatedFetch, pressure };
}

const shared = createFaceitGate();

/** The one gate every module shares, so the limit holds for the whole process. */
export const faceitFetch = (url, init) => shared.fetch(url, init);
export const faceitPressure = () => shared.pressure();
