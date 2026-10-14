import { describe, expect, test } from 'vitest';
import { createViolationTracker, moderate, normalizeForMatching, type ModerationKind } from './moderation';

const check = (text: string, kind: ModerationKind = 'body') => moderate(text, kind);
const blocked = (text: string, category: string, kind: ModerationKind = 'body') =>
  expect(check(text, kind), text).toMatchObject({ ok: false, category });
const clean = (text: string, kind: ModerationKind = 'body') => expect(check(text, kind), text).toEqual({ ok: true });

describe('clean text passes', () => {
  test.each([
    'Chciałbym ciemny motyw generatora, bo wieczorem razi w oczy.',
    'Please add an animated avatar to the Orbit style.',
    'Błąd: glow ikonki levelu jest ucięty z lewej strony w Showcase.',
    'Level 10, ELO 2500, 1337 kills i wersja 3.6.0 działa świetnie!',
    'Baner na OBS się nie odświeża po 60 sekundach (Chrome 130).',
    'Fajnie by było mieć ranking graczy, którzy mają teraz baner online.',
  ])('%s', (text) => clean(text));

  test('words that merely contain a bad word are fine (the Scunthorpe problem)', () => {
    for (const text of ['Scunthorpe United', 'the classic assassin class', 'Dickens wrote novels', 'analiza statystyk', 'cocktail party', 'grass is green', 'Essex and Middlesex', 'kasztan i kasa fiskalna'])
      clean(text);
  });

  test('allowlisted links are fine in a post', () => {
    clean('Zobacz dokumentację: https://faceitbanner.vxh.pl/docs/ i repo https://github.com/skullboypl/faceit-banner-faceitbanner.vxh.pl');
  });
});

describe('profanity and hate', () => {
  test.each(['to jest kurwa niedorzeczne', 'what the fuck is this', 'you are an asshole', 'jebany baner', 'ty chuju', 'ty kutasie'])('%s', (text) => blocked(text, 'profanity'));

  test.each(['heil hitler', 'white power forever', 'you are a nigger', 'kys loser'])('%s', (text) => blocked(text, 'hate'));

  test('evasion by spacing, punctuation, repeats, leetspeak, accents and zero-width characters', () => {
    for (const text of ['k u r w a', 'k.u.r.w.a', 'ku.rwa', 'kuuuurwa', 'kurw@', 'f u c k', 'sh1t', 'b1tch', 'ass h0le', 'ku​rwa', 'ѕhit', 'fuсk', 'PIERDOLE to', 'chuuuj'])
      expect(check(text), text).toMatchObject({ ok: false });
  });

  test('applies to titles, comments and banner names too', () => {
    blocked('kurwa mać', 'profanity', 'title');
    blocked('fuck this', 'profanity', 'comment');
    blocked('my shit banner', 'profanity', 'name');
  });
});

describe('scam, cheats, adult and drugs topics', () => {
  test.each([
    'Darmowe skiny CS2 tutaj, kliknij i odbierz',
    'best online casino with bonus',
    'kasyno online bonus bez depozytu',
    'free skins giveaway click here',
    'invest in crypto airdrop now',
    'szybki zarobek, pożyczka bez BIK',
    'use my promo code for 1xbet',
    'keydrop daje nagrody',
  ])('%s → scam', (text) => blocked(text, 'scam'));

  test.each(['sprzedam wallhack do CS2', 'cheap elo boost service', 'buy aimbot undetected', 'bypass vac ban', 'kup cheaty na faceit'])('%s → cheats', (text) => blocked(text, 'cheats'));

  test.each(['watch porn here', 'xxx videos', 'nude photos'])('%s → adult', (text) => blocked(text, 'adult'));
  test.each(['kupię kokainę', 'weed for sale cheap', 'sprzedam mefedron'])('%s → drugs', (text) => blocked(text, 'drugs'));

  test('a legitimate mention of an unrelated word is not a topic hit', () => {
    clean('Boost kontrastu w stylu glass jest za słaby');
    clean('Mogę podać mój nick na FACEIT: donk666');
  });
});

describe('links', () => {
  test('shorteners, invites, raw IPs, punycode and dangerous schemes are always blocked', () => {
    for (const text of ['see https://bit.ly/3abc', 'join https://discord.gg/abcd', 'tinyurl.com/xyz', 'https://t.me/scammer', 'http://192.168.1.10/login', 'https://xn--pple-43d.com', 'javascript:alert(1)', 'data:text/html;base64,AAAA'])
      blocked(text, 'links');
  });

  test('one external link is allowed in a post body, two are not', () => {
    clean('Przykład tutaj: https://example.com/page', 'body');
    blocked('A https://example.com i B https://example.org', 'links', 'body');
  });

  test('external links are not allowed in titles, comments and names', () => {
    for (const kind of ['title', 'comment', 'name'] as const) blocked('https://example.com/page', 'links', kind);
  });

  test('a bare domain counts as a link', () => {
    blocked('wejdź na superdeal.xyz po prezent', 'links', 'comment');
  });

  test('plain dotted text that is not a domain is fine', () => {
    clean('wersja 3.6.0, godz. 12.30, patrz pkt 2.1 oraz np. tak');
  });
});

describe('personal data', () => {
  test.each(['zadzwoń +48 600 123 456', 'pisz na kontakt@example.pl', 'moja karta 4111 1111 1111 1111', 'konto PL61 1090 1014 0000 0712 1981 2874', 'tel 600-123-456'])('%s', (text) => blocked(text, 'personal_data'));

  test('ordinary numbers are not personal data', () => {
    clean('ELO 2500, 1337 kills, 12345678 punktów, rok 2026');
  });
});

describe('spam shapes', () => {
  test.each([
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'DODAJCIE TO NATYCHMIAST BARDZO PROSZE WSZYSCY',
    'dziękuję!!!!!!!!!!!!!!!!!!',
    'ok ok ok ok ok ok ok ok ok ok',
    '😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀',
    'pls @a @b @c @d @e',
  ])('%s', (text) => blocked(text, 'spam'));

  test('seven repeats of one word are still fine', () => {
    clean('ok ok ok ok ok ok ok');
  });

  test('short shouting like "CS2 ELO" is fine', () => {
    clean('CS2 ELO OK');
  });
});

describe('result and robustness', () => {
  test('the reason never echoes the matched text', () => {
    const result = check('to jest kurwa niedorzeczne');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.toLowerCase()).not.toContain('kurwa');
  });

  test('a 4000 character body is checked fast and a pathological one does not hang', () => {
    const body = 'lorem ipsum dolor sit amet '.repeat(150);
    const started = performance.now();
    check(body);
    check('a'.repeat(4000));
    check(('a. ' + 'b.'.repeat(500)).repeat(3));
    check(' '.repeat(4000));
    expect(performance.now() - started).toBeLessThan(250);
  });

  test('empty and whitespace-only input is clean here (length rules live elsewhere)', () => {
    clean('');
    clean('   ');
  });

  test('normalizeForMatching removes accents, invisibles, case and homoglyphs', () => {
    expect(normalizeForMatching('Żółć​')).toBe('zolc');
    expect(normalizeForMatching('ѕhіt')).toBe('shit');
  });
});

describe('violation tracker', () => {
  test('five violations within an hour lock the user for an hour', () => {
    let now = 0;
    const tracker = createViolationTracker({ now: () => now });
    for (let i = 0; i < 4; i++) tracker.record('u1');
    expect(tracker.isLocked('u1')).toBe(false);
    tracker.record('u1');
    expect(tracker.isLocked('u1')).toBe(true);
    now = 59 * 60_000;
    expect(tracker.isLocked('u1')).toBe(true);
    now = 61 * 60_000;
    expect(tracker.isLocked('u1')).toBe(false);
  });

  test('violations older than an hour do not add up, and users are independent', () => {
    let now = 0;
    const tracker = createViolationTracker({ now: () => now });
    for (let i = 0; i < 4; i++) tracker.record('u1');
    now = 2 * 3_600_000;
    tracker.record('u1');
    expect(tracker.isLocked('u1')).toBe(false);
    expect(tracker.isLocked('u2')).toBe(false);
  });

  test('retryAfterSeconds tells how long the lock lasts', () => {
    const now = 0;
    const tracker = createViolationTracker({ now: () => now });
    for (let i = 0; i < 5; i++) tracker.record('u1');
    expect(tracker.retryAfterSeconds('u1')).toBeGreaterThan(3500);
    expect(tracker.retryAfterSeconds('nobody')).toBe(0);
  });
});
