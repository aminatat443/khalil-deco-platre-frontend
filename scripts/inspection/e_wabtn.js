(() => {
  const b = Array.from(document.querySelectorAll('[role="dialog"] a')).find(a => /WhatsApp/.test(a.textContent));
  return JSON.stringify({ href: b ? b.href : null, texte: b && b.textContent.trim() });
})()
