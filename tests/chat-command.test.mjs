import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_REPLY_MAX, chatNick, chatReply, chatRequest, handleChatCommand, recentForm } from '../server/chat-command.mjs';
import { faceitTarget } from '../server/faceit-proxy.mjs';

const id = '10b53a6d-5fc9-4095-920c-2953cfa62486';
const ok = (body) => ({ status: 200, body: JSON.stringify(body) });
const match = (result, kills = 20, deaths = 10) => ({ stats: { Result: result, Kills: String(kills), Deaths: String(deaths) } });

/** A fake FACEIT behind the shared cache: answers by path and records what was asked. */
function fakeRead({ nickname = 'SkullBoy', elo = 3184, calibrating = false, position = 512, items } = {}) {
  const asked = [];
  const read = async (path) => {
    asked.push(path);
    if (path.startsWith('/players?nickname=')) {
      return decodeURIComponent(path.split('=')[1]) === nickname
        ? ok({ player_id: id, nickname, games: { cs2: { faceit_elo: elo, skill_level: 10, region: 'EU', is_calibrating: calibrating } } })
        : { status: 404, body: '{}' };
    }
    if (path.startsWith('/search/players')) return ok({ items: [{ nickname: 'SkullBoyFan', player_id: '22222222-2222-2222-2222-222222222222' }, { nickname, player_id: id }] });
    if (path === `/players/${id}`) return ok({ player_id: id, nickname, games: { cs2: { faceit_elo: elo, skill_level: 10, region: 'EU' } } });
    if (path.startsWith('/rankings/')) return ok({ position });
    if (path.includes('/games/cs2/stats')) return ok({ items: items ?? [match('1'), match('1'), match('0', 10, 20), match('1'), match('0'), match('1')] });
    return { status: 404, body: '{}' };
  };
  return { read, asked };
}

test('a chat nick is the first word without the @, and junk is not a nick', () => {
  assert.equal(chatNick('@SkullBoy'), 'SkullBoy');
  assert.equal(chatNick('  SkullBoy  extra words'), 'SkullBoy');
  assert.equal(chatNick('a'), '');
  assert.equal(chatNick('<script>'), '');
  assert.equal(chatNick('/ban'), '');
  assert.equal(chatNick(''), '');
});

test('the request falls back to the streamer nick, English and the default parts', () => {
  assert.deepEqual(chatRequest('/api/faceit/elo?nick=&default=SkullBoy'), { nick: 'SkullBoy', lang: 'en', show: ['rank', 'last'], cmd: 'elo' });
  assert.deepEqual(chatRequest('/api/faceit/elo?nick=%40other&default=SkullBoy&lang=pl&show=kd,bogus&cmd=faceit'), {
    nick: 'other',
    lang: 'pl',
    show: ['kd'],
    cmd: 'faceit',
  });
  assert.equal(chatRequest('/api/faceit/elo?lang=xx').lang, 'en');
});

test('a reply has the ELO, level, place and the last five results', async () => {
  const { read } = fakeRead();
  const reply = await chatReply({ nick: 'SkullBoy', lang: 'pl', show: ['rank', 'kd', 'last'], cmd: 'elo' }, read);
  assert.equal(reply, 'SkullBoy: 3184 ELO · Poziom 10 · #512 EU · K/D 1.57 · Ostatnie: W W L W L');
});

test('a nick typed in another case is found through the search', async () => {
  const { read, asked } = fakeRead();
  const reply = await chatReply({ nick: 'skullboy', lang: 'en', show: [], cmd: 'elo' }, read);
  assert.equal(reply, 'SkullBoy: 3184 ELO · Level 10');
  assert.ok(asked.some((path) => path.startsWith('/search/players')));
});

test('an unknown player, a missing nick and a FACEIT outage each answer one sentence', async () => {
  const { read } = fakeRead();
  assert.equal(await chatReply({ nick: 'Nobody', lang: 'en', show: [], cmd: 'elo' }, async (path) => (path.startsWith('/search') ? ok({ items: [] }) : read(path))), 'Player Nobody not found on FACEIT.');
  assert.equal(await chatReply({ nick: '', lang: 'pl', show: [], cmd: 'faceit' }, read), 'Podaj nick FACEIT: !faceit nick');
  assert.equal(await chatReply({ nick: 'SkullBoy', lang: 'de', show: [], cmd: 'elo' }, async () => ({ status: 502, body: '{}' })), 'FACEIT antwortet gerade nicht, versuch es in einer Minute.');
});

test('a calibrating player shows no level and no place', async () => {
  const { read, asked } = fakeRead({ calibrating: true });
  assert.equal(await chatReply({ nick: 'SkullBoy', lang: 'en', show: ['rank'], cmd: 'elo' }, read), 'SkullBoy: 3184 ELO · calibrating');
  assert.ok(!asked.some((path) => path.startsWith('/rankings/')));
});

test('a reply is never longer than a bot can print', async () => {
  const { read } = fakeRead({ nickname: 'X'.repeat(30) });
  const reply = await chatReply({ nick: 'X'.repeat(30), lang: 'tr', show: ['rank', 'kd', 'last'], cmd: 'elo' }, read);
  assert.ok(reply.length <= CHAT_REPLY_MAX);
});

test('recentForm counts K/D over twenty matches and keeps five results', () => {
  const items = Array.from({ length: 25 }, (_, index) => match(index % 2 ? '0' : '1', 10, 5));
  const recent = recentForm(items);
  assert.equal(recent.kd, 2);
  assert.deepEqual(recent.form, ['W', 'L', 'W', 'L', 'W']);
  assert.deepEqual(recentForm(undefined), { kd: null, form: [] });
});

test('the endpoint answers plain text with status 200, and leaves other paths alone', async () => {
  const { read } = fakeRead();
  const response = () => {
    const res = { headers: {}, statusCode: 0, body: '', setHeader: (name, value) => (res.headers[name.toLowerCase()] = value), end: (body) => (res.body = body) };
    return res;
  };
  const res = response();
  const handled = await handleChatCommand({ url: '/api/faceit/elo?nick=SkullBoy&lang=en&show=', method: 'GET', headers: {}, socket: {} }, res, { unlimitedRate: true, read });
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /^text\/plain/);
  assert.equal(res.body, 'SkullBoy: 3184 ELO · Level 10');
  assert.equal(await handleChatCommand({ url: '/api/faceit/v4/players', method: 'GET', headers: {}, socket: {} }, response(), { read }), false);
});

test('the proxy allows the player search, always for CS2', () => {
  const target = faceitTarget('/api/faceit/v4/search/players?nickname=SkullBoy&limit=20&game=csgo');
  assert.equal(target.upstream, 'https://open.faceit.com/data/v4/search/players?nickname=skullboy&game=cs2&offset=0&limit=20');
  assert.equal(faceitTarget('/api/faceit/v4/search/players?nickname=%3Cx%3E'), null);
});
