// Splits the wishes list into one group per Dragon Ball set, in world order. Kept free of the DOM
// so node tests can import it (wishes.js renders on import).
const SET_ORDER = ['overworld', 'nether', 'end'];
const SET_TITLE = { overworld: 'Overworld', nether: 'Nether', end: 'End' };

export function groupBySet(wishes) {
  const bySet = new Map();
  for (const w of wishes) {
    if (!bySet.has(w.set)) bySet.set(w.set, []);
    bySet.get(w.set).push(w);
  }
  // A set the site doesn't know yet still shows, after the three known ones.
  const order = [...SET_ORDER, ...[...bySet.keys()].filter((s) => !SET_ORDER.includes(s))];
  return order
    .filter((set) => bySet.has(set))
    .map((set) => ({ set, title: SET_TITLE[set] || set, wishes: bySet.get(set) }));
}
