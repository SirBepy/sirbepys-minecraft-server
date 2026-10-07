import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicWishes } from '../tools/lib/wishes.mjs';

const GEN = '2026-10-08T12:00:00.000Z';
const jsonl = (lines) => lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n');

test('joins a session\'s chat, grant and public records', () => {
  const text = jsonl([
    { time: '2026-10-01T10:00:00Z', session: 's1', dragon: 'Shenron', wishesLeft: 2, player: 'Alice', uuid: 'u-1', message: 'I wish for a sword', set: 'nether' },
    { time: '2026-10-01T10:05:00Z', session: 's1', type: 'grant', count: 1, note: 'gave sword', set: 'nether' },
    { time: '2026-10-01T10:06:00Z', session: 's1', type: 'public', title: 'A new blade', line: 'Alice wished for a sword' },
  ]);
  const result = publicWishes(text, GEN);
  assert.equal(result.generated, GEN);
  assert.equal(result.wishes.length, 1);
  assert.deepEqual(result.wishes[0], {
    session: 's1',
    player: 'Alice',
    uuid: 'u-1',
    dragon: 'Shenron',
    set: 'nether',
    granted: '2026-10-01T10:05:00Z',
    title: 'A new blade',
    line: 'Alice wished for a sword',
  });
});

test('the latest public record wins when several exist for a session', () => {
  const text = jsonl([
    { time: '2026-10-01T09:00:00Z', session: 's1', dragon: 'Porunga', player: 'Bob', uuid: 'u-2', message: 'hi' },
    { time: '2026-10-01T09:05:00Z', session: 's1', type: 'grant', count: 1, note: 'n' },
    { time: '2026-10-01T09:06:00Z', session: 's1', type: 'public', title: 'First draft', line: 'old' },
    { time: '2026-10-01T09:10:00Z', session: 's1', type: 'public', title: 'Final', line: 'new' },
  ]);
  const result = publicWishes(text, GEN);
  assert.equal(result.wishes.length, 1);
  assert.equal(result.wishes[0].title, 'Final');
  assert.equal(result.wishes[0].line, 'new');
});

test('granted uses the earliest grant record when a session has several', () => {
  const text = jsonl([
    { time: '2026-10-01T08:00:00Z', session: 's1', dragon: 'Shenron', player: 'Cass', uuid: 'u-3', message: 'hi' },
    { time: '2026-10-01T08:10:00Z', session: 's1', type: 'grant', count: 1, note: 'second' },
    { time: '2026-10-01T08:05:00Z', session: 's1', type: 'grant', count: 1, note: 'first' },
    { time: '2026-10-01T08:12:00Z', session: 's1', type: 'public', title: 'T', line: 'L' },
  ]);
  const result = publicWishes(text, GEN);
  assert.equal(result.wishes[0].granted, '2026-10-01T08:05:00Z');
});

test('set falls back from grant to chat to overworld, and sorts newest-granted first', () => {
  const text = jsonl([
    // s1: grant carries its own set
    { time: '2026-10-02T00:00:00Z', session: 's1', dragon: 'Shenron', player: 'A', uuid: 'u-a', message: 'm', set: 'nether' },
    { time: '2026-10-02T00:01:00Z', session: 's1', type: 'grant', count: 1, note: 'n', set: 'end' },
    { time: '2026-10-02T00:02:00Z', session: 's1', type: 'public', title: 'T1', line: 'L1' },
    // s2: grant has no set, falls back to the chat record's set
    { time: '2026-10-03T00:00:00Z', session: 's2', dragon: 'Porunga', player: 'B', uuid: 'u-b', message: 'm', set: 'nether' },
    { time: '2026-10-03T00:01:00Z', session: 's2', type: 'grant', count: 1, note: 'n' },
    { time: '2026-10-03T00:02:00Z', session: 's2', type: 'public', title: 'T2', line: 'L2' },
    // s3: neither grant nor chat carries a set, defaults to overworld
    { time: '2026-10-04T00:00:00Z', session: 's3', dragon: 'Shenron', player: 'C', uuid: 'u-c', message: 'm' },
    { time: '2026-10-04T00:01:00Z', session: 's3', type: 'grant', count: 1, note: 'n' },
    { time: '2026-10-04T00:02:00Z', session: 's3', type: 'public', title: 'T3', line: 'L3' },
  ]);
  const result = publicWishes(text, GEN);
  assert.equal(result.wishes.length, 3);
  assert.deepEqual(result.wishes.map((w) => w.session), ['s3', 's2', 's1'], 'sorted newest-granted first');
  assert.equal(result.wishes.find((w) => w.session === 's1').set, 'end');
  assert.equal(result.wishes.find((w) => w.session === 's2').set, 'nether');
  assert.equal(result.wishes.find((w) => w.session === 's3').set, 'overworld');
});

test('a session with a grant but no public record is not listed', () => {
  const text = jsonl([
    { time: '2026-10-01T00:00:00Z', session: 's1', dragon: 'Shenron', player: 'A', uuid: 'u-a', message: 'm' },
    { time: '2026-10-01T00:01:00Z', session: 's1', type: 'grant', count: 1, note: 'n' },
  ]);
  const result = publicWishes(text, GEN);
  assert.deepEqual(result.wishes, []);
});

test('a session with a public record but no grant is not listed', () => {
  const text = jsonl([
    { time: '2026-10-01T00:00:00Z', session: 's1', dragon: 'Shenron', player: 'A', uuid: 'u-a', message: 'm' },
    { time: '2026-10-01T00:01:00Z', session: 's1', type: 'public', title: 'T', line: 'L' },
  ]);
  const result = publicWishes(text, GEN);
  assert.deepEqual(result.wishes, []);
});

test('note and message never appear anywhere in the output', () => {
  const text = jsonl([
    { time: '2026-10-01T00:00:00Z', session: 's1', dragon: 'Shenron', player: 'A', uuid: 'u-a', message: 'SECRET-MESSAGE-TEXT' },
    { time: '2026-10-01T00:01:00Z', session: 's1', type: 'grant', count: 1, note: 'SECRET-NOTE-TEXT' },
    { time: '2026-10-01T00:02:00Z', session: 's1', type: 'public', title: 'T', line: 'L' },
  ]);
  const result = publicWishes(text, GEN);
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('SECRET-MESSAGE-TEXT'));
  assert.ok(!serialized.includes('SECRET-NOTE-TEXT'));
  assert.deepEqual(Object.keys(result.wishes[0]), ['session', 'player', 'uuid', 'dragon', 'set', 'granted', 'title', 'line']);
});

test('malformed lines are skipped silently', () => {
  const text = [
    '{not valid json',
    '',
    JSON.stringify({ time: '2026-10-01T00:00:00Z', session: 's1', dragon: 'Shenron', player: 'A', uuid: 'u-a', message: 'm' }),
    '   ',
    JSON.stringify({ time: '2026-10-01T00:01:00Z', session: 's1', type: 'grant', count: 1, note: 'n' }),
    JSON.stringify({ time: '2026-10-01T00:02:00Z', session: 's1', type: 'public', title: 'T', line: 'L' }),
    '"just a string"',
    '42',
  ].join('\n');
  const result = publicWishes(text, GEN);
  assert.equal(result.wishes.length, 1);
  assert.equal(result.wishes[0].session, 's1');
});
