// Turns the plugin's wishes.jsonl (chat lines, grant records, public records) into the public
// "wishes granted" list: only sessions that have BOTH a grant and a public record are listed,
// and `note`/`message` (chat text, internal grant notes) never make it into the output.

function parseLines(jsonlText) {
  const records = [];
  for (const line of jsonlText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const rec = JSON.parse(trimmed);
      if (rec && typeof rec === 'object' && typeof rec.session === 'string' && typeof rec.time === 'string') {
        records.push(rec);
      }
    } catch {
      // malformed line: skip silently
    }
  }
  return records;
}

export function publicWishes(jsonlText, generatedIso) {
  const sessions = new Map();
  const order = (s) => {
    if (!sessions.has(s)) sessions.set(s, { grants: [], publics: [], chat: null });
    return sessions.get(s);
  };

  for (const rec of parseLines(jsonlText)) {
    const bucket = order(rec.session);
    if (rec.type === 'grant') {
      bucket.grants.push(rec);
    } else if (rec.type === 'public') {
      bucket.publics.push(rec);
    } else if (!rec.type && bucket.chat === null) {
      // First chat record seen for this session (file order).
      bucket.chat = rec;
    }
  }

  const wishes = [];
  for (const [session, { grants, publics, chat }] of sessions) {
    if (grants.length === 0 || publics.length === 0) continue;

    let earliestGrant = grants[0];
    for (const g of grants.slice(1)) {
      if (Date.parse(g.time) < Date.parse(earliestGrant.time)) earliestGrant = g;
    }

    let latestPublic = publics[0];
    for (const p of publics.slice(1)) {
      if (Date.parse(p.time) >= Date.parse(latestPublic.time)) latestPublic = p;
    }

    wishes.push({
      session,
      player: chat?.player ?? null,
      uuid: chat?.uuid ?? null,
      dragon: chat?.dragon ?? null,
      set: earliestGrant.set ?? chat?.set ?? 'overworld',
      granted: earliestGrant.time,
      title: latestPublic.title,
      line: latestPublic.line,
    });
  }

  wishes.sort((a, b) => Date.parse(b.granted) - Date.parse(a.granted));

  return { generated: generatedIso, wishes };
}
