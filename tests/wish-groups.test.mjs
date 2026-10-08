import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupBySet } from '../site/assets/js/wish-groups.js';

const w = (session, set) => ({ session, set });

test('wishes are grouped Overworld, Nether, End, keeping their order inside each group', () => {
  const groups = groupBySet([w('a', 'nether'), w('b', 'overworld'), w('c', 'end'), w('d', 'nether'), w('e', 'overworld')]);
  assert.deepEqual(groups.map((g) => g.title), ['Overworld', 'Nether', 'End']);
  assert.deepEqual(groups.map((g) => g.wishes.map((x) => x.session)), [['b', 'e'], ['a', 'd'], ['c']]);
});

test('a set with no wishes gets no group', () => {
  const groups = groupBySet([w('a', 'overworld'), w('b', 'nether')]);
  assert.deepEqual(groups.map((g) => g.set), ['overworld', 'nether']);
});

test('an unknown set still shows, after the known ones, titled by its name', () => {
  const groups = groupBySet([w('a', 'aether'), w('b', 'end')]);
  assert.deepEqual(groups.map((g) => g.title), ['End', 'aether']);
});
