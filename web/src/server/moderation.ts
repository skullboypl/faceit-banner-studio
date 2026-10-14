/**
 * Content moderation for user text: profanity, hate, scam / cheat-selling / adult / drug topics, risky links,
 * personal data and spam shapes. Pure functions, no I/O.
 *
 * Matching works on a normalised copy (accents, invisible characters, case, look-alike letters, leetspeak,
 * stretched letters and spacing tricks are undone) and compares whole words, so words that merely contain a bad
 * word ("Scunthorpe", "assassin") pass. The reason never repeats the matched text.
 */
export type ModerationKind = 'title' | 'body' | 'comment' | 'name';
export type ModerationCategory = 'profanity' | 'hate' | 'scam' | 'cheats' | 'adult' | 'drugs' | 'personal_data' | 'links' | 'spam';
export type ModerationResult = { ok: true } | { ok: false; category: ModerationCategory; reason: string };

const REASONS: Record<ModerationCategory, string> = {
  profanity: 'This text contains language that is not allowed.',
  hate: 'This text contains hateful or threatening language.',
  scam: 'This text looks like gambling, scam or promotion content.',
  cheats: 'Selling or promoting cheats and boosting is not allowed.',
  adult: 'Adult content is not allowed here.',
  drugs: 'Content about illegal drugs is not allowed.',
  personal_data: 'Please do not post contact details or payment data.',
  links: 'This text contains a link that is not allowed.',
  spam: 'This text looks like spam.',
};

const MAX_CHECKED_LENGTH = 10_000;

// ---------------------------------------------------------------------------------------------------------------
// Normalisation

/** Letters that look like Latin ones, or that NFKD does not decompose. */
const LOOKALIKES: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x', ѕ: 's', і: 'i', ј: 'j',
  ł: 'l', ø: 'o', đ: 'd', ß: 'ss', æ: 'ae', œ: 'oe',
};
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

export function normalizeForMatching(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[\p{Cf}­]/gu, '')
    .toLowerCase()
    .replace(/[Ѐ-ӿłøđßæœ]/g, (char) => LOOKALIKES[char] ?? char);
}

const leetspeak = (text: string) => text.replace(/[01345 7@$]/g, (char) => LEET[char] ?? char);
const collapse = (text: string, min: number) => text.replace(new RegExp(`([a-z])\\1{${min - 1},}`, 'g'), '$1');

/** Variants of one text that the word lists are matched against. */
function matchingViews(normalized: string) {
  const glued = normalized.replace(/(?<=[a-z0-9])[.\-_*'`~+|\\/,:;]+(?=[a-z0-9])/g, '');
  const build = (source: string) => {
    const tokens = source.split(/[^a-z0-9]+/).filter(Boolean);
    // "k u r w a": three or more single letters in a row become one word
    const joined: string[] = [];
    let run = '';
    for (const token of tokens) {
      if (token.length === 1 && /[a-z]/.test(token)) run += token;
      else {
        if (run) joined.push(run);
        run = '';
        joined.push(token);
      }
    }
    if (run) joined.push(run);
    // "ass hole": a short word followed by another one is also checked as a single word
    const pairs = joined.slice(0, -1).filter((token) => token.length <= 6).map((token, i) => token + joined[i + 1]);
    return [...new Set([...joined, ...pairs, ...joined.map((t) => collapse(t, 2)), ...joined.map((t) => collapse(t, 3))])];
  };
  const raw = build(glued);
  const leet = build(leetspeak(glued));
  const words = new Set([...raw, ...leet]);
  const sentence = (source: string) => ` ${source.split(/[^a-z0-9]+/).filter(Boolean).join(' ')} `;
  return { words, sentences: [sentence(glued), sentence(leetspeak(glued)), sentence(collapse(leetspeak(glued), 3))] };
}

// ---------------------------------------------------------------------------------------------------------------
// Word lists (exact words, stems that match any inflection, and phrases)

type Terms = { words?: string[]; stems?: string[]; phrases?: string[] };

const PROFANITY: Terms = {
  words: ['jeb', 'jebac', 'jebany', 'jebana', 'jebane', 'jebnac', 'jebie', 'cwel', 'cwele', 'szmata', 'szmato', 'suka', 'fuck', 'fucking', 'fucked', 'fucker', 'motherfucker', 'shit', 'shitty', 'bullshit', 'bitch', 'bitches', 'asshole', 'cunt', 'dick', 'dickhead', 'bastard', 'whore', 'slut', 'kutas', 'kutasie'],
  stems: ['kurw', 'wkurw', 'pierdol', 'pierdal', 'spierdal', 'skurwy', 'chuj', 'huj', 'pizd', 'dziwk', 'zajeb', 'odjeb', 'przejeb'],
};
const HATE: Terms = {
  words: ['nigger', 'niggers', 'nigga', 'niggas', 'faggot', 'fagot', 'tranny', 'retard', 'retarded', 'kys'],
  phrases: ['heil hitler', 'sieg heil', 'white power', 'kill yourself', 'zydzi do gazu', 'gas the jews', 'hang yourself'],
};
const SCAM: Terms = {
  words: ['casino', 'airdrop', 'giveaway', 'forex', 'keydrop', 'hellcase', 'gamdom', 'csgoempire', '1xbet', 'onlyfans', 'betting'],
  stems: ['kasyn', 'bukmacher', 'zaklad', 'pozyczk', 'chwilowk'],
  phrases: ['free skins', 'free skin', 'darmowe skiny', 'darmowy skin', 'darmowych skinow', 'szybki zarobek', 'earn money fast', 'make money fast', 'click here', 'promo code', 'kod promocyjny', 'bonus bez depozytu', 'no deposit bonus', 'steam gift card', 'crypto airdrop', 'invest in crypto', 'inwestuj w krypto', 'skin giveaway'],
};
const CHEATS: Terms = {
  words: ['wallhack', 'wallhacks', 'aimbot', 'triggerbot', 'spoofer', 'cheaty'],
  phrases: ['elo boost', 'elo boosting', 'boosting service', 'buy cheat', 'buy cheats', 'kup cheat', 'sprzedam cheat', 'undetected cheat', 'bypass vac', 'bypass faceit', 'cheap boost'],
};
const ADULT: Terms = {
  words: ['porn', 'porno', 'xxx', 'nude', 'nudes', 'sex', 'seks', 'onlyfans'],
  stems: ['erotyczn'],
  phrases: ['sex cam', 'adult videos'],
};
const DRUGS: Terms = {
  words: ['cocaine', 'mdma', 'heroin', 'meth'],
  stems: ['kokain', 'amfetamin', 'mefedron', 'marihuan', 'heroin'],
  phrases: ['weed for sale', 'buy weed', 'kup trawe'],
};

function hits(terms: Terms, views: ReturnType<typeof matchingViews>): boolean {
  const { words, sentences } = views;
  if (terms.words?.some((word) => words.has(word))) return true;
  if (terms.stems?.some((stem) => [...words].some((word) => word.startsWith(stem)))) return true;
  return terms.phrases?.some((phrase) => sentences.some((sentence) => sentence.includes(` ${phrase} `))) ?? false;
}

// ---------------------------------------------------------------------------------------------------------------
// Links

const TLDS = 'com|net|org|pl|io|gg|xyz|ru|cn|info|biz|top|site|online|shop|store|club|vip|live|link|click|tk|ml|ga|cf|gq|me|tv|co|de|eu|uk|us|app|dev|ly|to|cc|ws|su|icu|fun|buzz';
const URL_PATTERN = new RegExp(
  `(?:https?:\\/\\/|www\\.)[^\\s<>"']+|\\b[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.(?:${TLDS})\\b(?:\\/[^\\s<>"']*)?`,
  'gi'
);
const DANGEROUS_SCHEME = /\b(?:javascript|vbscript|data|file):/i;
const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'cutt.ly', 'is.gd', 'rebrand.ly', 'shorturl.at', 'ow.ly', 'tiny.cc', 'bit.do', 'buff.ly', 'rb.gy', 'discord.gg', 't.me', 'wa.me', 'telegram.me', 'linktr.ee'];
const INVITE_PATH = /^(?:discord(?:app)?\.com)\/invite\b/i;
const ALLOWED_HOSTS = ['faceitbanner.vxh.pl', 'vxh.pl', 'faceit.com', 'github.com', 'youtube.com', 'youtu.be', 'twitch.tv', 'imgur.com'];

const hostOf = (link: string) =>
  link
    .replace(/^(?:https?:\/\/)/i, '')
    .replace(/^[^/@]*@/, '')
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, '')
    .replace(/^www\./i, '')
    .toLowerCase();

const sameOrSubdomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

function linkVerdict(text: string, kind: ModerationKind): boolean {
  if (DANGEROUS_SCHEME.test(text)) return true;
  const links = text.slice(0, MAX_CHECKED_LENGTH).match(URL_PATTERN) ?? [];
  let allowed = 0;
  let external = 0;
  for (const link of links) {
    const host = hostOf(link);
    const bare = link.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '');
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
    if (host.split('.').some((label) => label.startsWith('xn--'))) return true;
    if (SHORTENERS.some((short) => sameOrSubdomain(host, short)) || INVITE_PATH.test(bare)) return true;
    if (ALLOWED_HOSTS.some((domain) => sameOrSubdomain(host, domain))) allowed++;
    else external++;
  }
  if (kind === 'title' || kind === 'name') return links.length > 0;
  if (kind === 'comment') return external > 0 || allowed > 2;
  return external > 1 || allowed > 2;
}

// ---------------------------------------------------------------------------------------------------------------
// Personal data and spam shapes

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;
const PHONE = /(?:^|[^\d])(?:\+\d{1,3}[\s-]?)?\d{3}[\s-]\d{3}[\s-]\d{3}(?!\d)|(?:^|[^\d])\d{9}(?!\d)/;
const IBAN = /\b[a-z]{2}\d{2}(?:\s?\d{4}){5,7}\b/i;
const CARD = /\b(?:\d[ -]?){13,19}\b/g;

function luhn(digits: string): boolean {
  let sum = 0;
  let flip = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (flip) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    flip = !flip;
  }
  return sum % 10 === 0;
}

function hasPersonalData(text: string): boolean {
  if (EMAIL.test(text) || PHONE.test(text) || IBAN.test(text)) return true;
  return (text.match(CARD) ?? []).some((candidate) => {
    const digits = candidate.replace(/\D/g, '');
    return digits.length >= 13 && digits.length <= 19 && luhn(digits);
  });
}

/** Word repeats are counted on the raw text. The matching set drops duplicates on purpose. */
function spamTokens(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function looksLikeSpam(text: string, words: string[]): boolean {
  if (/(.)\1{9,}/su.test(text)) return true;
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length >= 20 && letters.filter((char) => char !== char.toLowerCase()).length / letters.length > 0.7) return true;
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  if ([...counts.values()].some((count) => count >= 8)) return true;
  if ((text.match(/\p{Extended_Pictographic}/gu) ?? []).length > 15) return true;
  return (text.match(/@\w/g) ?? []).length > 3;
}

// ---------------------------------------------------------------------------------------------------------------

export function moderate(rawText: string, kind: ModerationKind = 'body'): ModerationResult {
  const text = rawText.slice(0, MAX_CHECKED_LENGTH);
  if (text.trim() === '') return { ok: true };

  const normalized = normalizeForMatching(text);
  const views = matchingViews(normalized);
  const verdict = (category: ModerationCategory): ModerationResult => ({ ok: false, category, reason: REASONS[category] });

  if (hits(HATE, views)) return verdict('hate');
  if (hits(PROFANITY, views)) return verdict('profanity');
  if (kind !== 'name') {
    if (hits(SCAM, views)) return verdict('scam');
    if (hits(CHEATS, views)) return verdict('cheats');
    if (hits(ADULT, views)) return verdict('adult');
    if (hits(DRUGS, views)) return verdict('drugs');
  }
  if (hasPersonalData(text)) return verdict('personal_data');
  if (linkVerdict(text, kind)) return verdict('links');
  if (looksLikeSpam(text, spamTokens(text))) return verdict('spam');
  return { ok: true };
}

/** A block that did not come from scanning the text (the honeypot). The reason never quotes the input. */
export function blocked(category: ModerationCategory): Extract<ModerationResult, { ok: false }> {
  return { ok: false, category, reason: REASONS[category] };
}

// ---------------------------------------------------------------------------------------------------------------

/** Five blocked attempts within an hour lock the user out of writing for an hour. */
export function createViolationTracker({ now = Date.now }: { now?: () => number } = {}) {
  const HOUR = 3_600_000;
  const recent = new Map<string, number[]>();
  const lockedUntil = new Map<string, number>();

  return {
    record(userId: string) {
      const current = now();
      const times = (recent.get(userId) ?? []).filter((time) => current - time < HOUR);
      times.push(current);
      recent.set(userId, times);
      if (times.length >= 5) {
        lockedUntil.set(userId, current + HOUR);
        recent.delete(userId);
      }
    },
    isLocked(userId: string) {
      return (lockedUntil.get(userId) ?? 0) > now();
    },
    retryAfterSeconds(userId: string) {
      return Math.max(0, Math.ceil(((lockedUntil.get(userId) ?? 0) - now()) / 1000));
    },
  };
}
