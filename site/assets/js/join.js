document.documentElement.classList.add('js');

// A link to a collapsed box (e.g. Voice chat -> "install the mods") opens it too.
for (const link of document.querySelectorAll('a[href^="#"]')) {
  const target = document.getElementById(link.getAttribute('href').slice(1));
  if (target instanceof HTMLDetailsElement) link.addEventListener('click', () => { target.open = true; });
}

for (const btn of document.querySelectorAll('[data-copy]')) {
  const label = btn.querySelector('span');
  const original = label.textContent;
  const icon = btn.querySelector('i');
  let timer = 0;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      label.textContent = 'Copied!';
      icon.className = 'ph-bold ph-check';
      btn.dataset.copied = '';
    } catch {
      label.textContent = 'Select';
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      label.textContent = original;
      icon.className = 'ph-bold ph-copy';
      delete btn.dataset.copied;
    }, 2000);
  });
}
