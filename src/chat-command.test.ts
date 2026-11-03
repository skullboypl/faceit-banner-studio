import { describe, expect, test } from 'vitest';
import { chatCommandReply, chatCommandUrl, chatStatsUrl, cleanCommandName, nightbotChatLine, sumChatStats, type ChatCommandOptions } from './generator/chat-command';

const options: ChatCommandOptions = { origin: 'https://faceitbanner.vxh.pl/', nick: 'SkullBoy', cmd: 'elo', lang: 'pl', show: ['last', 'rank'] };

describe('chat command', () => {
  test('the address ends with nick=, so every bot can append what the viewer typed', () => {
    expect(chatCommandUrl(options)).toBe('https://faceitbanner.vxh.pl/api/faceit/elo?lang=pl&show=rank%2Clast&default=SkullBoy&nick=');
    expect(chatCommandUrl({ ...options, cmd: 'faceit', nick: '' })).toBe('https://faceitbanner.vxh.pl/api/faceit/elo?lang=pl&show=rank%2Clast&cmd=faceit&nick=');
  });

  test('each bot gets its own variables for the viewer text', () => {
    const url = chatCommandUrl(options);
    expect(chatCommandReply('streamelements', options)).toBe(`$(customapi ${url}$(queryescape $(1|SkullBoy)))`);
    expect(chatCommandReply('streamelements', { ...options, nick: '' })).toBe(`$(customapi ${chatCommandUrl({ ...options, nick: '' })}$(queryescape $(1)))`);
    expect(chatCommandReply('nightbot', options)).toBe(`$(urlfetch ${url}$(querystring))`);
    expect(chatCommandReply('fossabot', options)).toBe(`$(customapi ${url}$(querystring))`);
    expect(chatCommandReply('url', options)).toBe(url);
  });

  test('every other command names its type, and keeps no ELO parts', () => {
    expect(chatCommandUrl({ ...options, kind: 'live', cmd: 'live' })).toBe('https://faceitbanner.vxh.pl/api/faceit/elo?type=live&lang=pl&default=SkullBoy&nick=');
    expect(chatCommandUrl({ ...options, kind: 'avg', cmd: 'stats' })).toBe('https://faceitbanner.vxh.pl/api/faceit/elo?type=avg&lang=pl&cmd=stats&default=SkullBoy&nick=');
    expect(nightbotChatLine({ ...options, kind: 'last', cmd: '' })).toMatch(/^!commands add !last \$\(urlfetch .*type=last/);
  });

  test('Nightbot can add the command from chat, and the command name stays a plain word', () => {
    expect(nightbotChatLine({ ...options, cmd: '!faceit' })).toMatch(/^!commands add !faceit \$\(urlfetch /);
    expect(cleanCommandName('!!el o<>')).toBe('elo');
  });

  test('the studio preview is marked so it is not counted, and the counters have their own address', () => {
    expect(chatCommandUrl({ ...options, preview: true })).toContain('&preview=1&nick=');
    expect(chatCommandUrl(options)).not.toContain('preview');
    expect(chatStatsUrl('https://faceitbanner.vxh.pl/', '@SkullBoy')).toBe('https://faceitbanner.vxh.pl/api/faceit/elo/stats?nick=SkullBoy');
    expect(sumChatStats({ elo: 3, last: 1, kd: 0, avg: 2, live: 4 })).toBe(10);
    expect(sumChatStats(undefined)).toBe(0);
  });
});
