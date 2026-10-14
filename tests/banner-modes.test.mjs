import { test } from 'node:test';
import assert from 'node:assert/strict';
import { averageElo, matchPhase, parseRoster, TEAM_LIMIT } from '../shared/banner-modes.mjs';

test('a roster keeps order, drops duplicates and stops at ten', () => {
  const names = parseRoster(' s1mple, NiKo, s1mple, ropz, broky, frozen, karrigan, rain, device, magisk, extra, dup ');
  assert.equal(names.length, TEAM_LIMIT);
  assert.equal(names[0], 's1mple');
  assert.equal(names.filter((name) => name.toLowerCase() === 's1mple').length, 1);
  assert.equal(names[9], 'extra');
  assert.equal(names.includes('dup'), false);
  assert.deepEqual(parseRoster(''), []);
});

test('match status maps onto before, live and after', () => {
  assert.equal(matchPhase('VOTING'), 'pre');
  assert.equal(matchPhase('READY'), 'pre');
  assert.equal(matchPhase('ONGOING'), 'live');
  assert.equal(matchPhase('FINISHED'), 'post');
  assert.equal(matchPhase('CANCELLED'), 'idle');
});

test('average elo ignores missing values', () => {
  assert.equal(averageElo([{ elo: 1800 }, { elo: 0 }, { elo: 2000 }]), 1900);
  assert.equal(averageElo([]), 0);
});
