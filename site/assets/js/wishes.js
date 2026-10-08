// ---------- Wishes granted ----------
// Renders site/data/wishes.json (generated at publish time) as compact advancement-style
// cards. Hidden entirely on fetch failure or an empty list: no empty widget on the live page.
import { el } from './dom.js';

const SET_LABEL = { overworld: 'Overworld set', nether: 'Nether set', end: 'End set' };

// The wish log always says "Shenron"; the Nether set's Shenron is named Nuova Shenron in game.
function dragonLabel(dragon, set) {
  return dragon === 'Shenron' && set === 'nether' ? 'Nuova Shenron' : dragon;
}

function dateLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function wishCard(w) {
  const avatarImg = el('img', {
    className: 'pixel',
    src: `https://mc-heads.net/avatar/${w.uuid}/64`,
    width: 64,
    height: 64,
    loading: 'lazy',
    alt: w.player,
  });
  const fallbackIcon = el('i', { className: 'ph-bold ph-user', ariaHidden: 'true', hidden: true });
  avatarImg.addEventListener('error', () => {
    avatarImg.hidden = true;
    fallbackIcon.hidden = false;
  }, { once: true });

  const meta = el('p', { className: 'adv__cmd' });
  meta.append(
    w.player,
    ' · ',
    dragonLabel(w.dragon, w.set),
    ' · ',
    SET_LABEL[w.set] || w.set,
    ' · ',
    dateLabel(w.granted),
  );

  return el('li', { className: 'adv' },
    el('span', { className: 'frame frame--avatar' }, avatarImg, fallbackIcon),
    el('div', { className: 'adv__body' },
      el('p', { className: 'adv__title' }, w.title),
      el('p', { className: 'adv__text' }, w.line),
      meta,
    ),
  );
}

(async () => {
  const section = document.getElementById('wishes');
  const list = document.getElementById('wish-list');
  if (!section || !list) return;

  try {
    const res = await fetch('data/wishes.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`wishes.json ${res.status}`);
    const data = await res.json();
    const wishes = Array.isArray(data.wishes) ? data.wishes : [];
    if (!wishes.length) return;

    list.append(...wishes.map(wishCard));
    section.hidden = false;
  } catch {
    // Fetch failed or malformed data: keep the section hidden, nothing to show.
  }
})();
