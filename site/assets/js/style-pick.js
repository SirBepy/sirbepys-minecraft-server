// Temporary A/B/C style picker while the owner chooses a direction; delete with the losing themes.
// The choice lives in sessionStorage so it survives moving between the home and join pages.
(() => {
  const STYLES = { a: 'Dig down', b: 'Incendium', c: 'Title screen' };
  const fromUrl = new URLSearchParams(location.search).get('style');
  let style = STYLES[fromUrl] ? fromUrl : sessionStorage.getItem('style');
  if (!STYLES[style]) style = 'a';
  sessionStorage.setItem('style', style);
  document.documentElement.dataset.theme = style;

  document.addEventListener('DOMContentLoaded', () => {
    const box = document.createElement('div');
    box.className = 'stylepick';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Preview style');
    box.append(Object.assign(document.createElement('span'), { textContent: 'Style' }));
    for (const [key, name] of Object.entries(STYLES)) {
      const b = Object.assign(document.createElement('button'), { type: 'button', textContent: key.toUpperCase(), title: name });
      b.setAttribute('aria-pressed', String(key === style));
      b.addEventListener('click', () => {
        sessionStorage.setItem('style', key);
        const url = new URL(location.href);
        url.searchParams.delete('style');
        location.replace(url);
      });
      box.append(b);
    }
    document.body.append(box);
  });
})();
