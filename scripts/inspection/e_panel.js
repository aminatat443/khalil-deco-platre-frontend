(() => {
  const a = document.querySelector('aside[aria-live="polite"]');
  if (!a) return 'panneau absent';
  const lines = a.innerText.split('\n').map(l => l.trim()).filter(Boolean);
  const btn = Array.from(a.querySelectorAll('button')).find(x => /WhatsApp/.test(x.textContent));
  return JSON.stringify({ lignes: lines.slice(0, 6), bouton: btn.textContent.replace(/\s+/g,' ').trim() });
})()
