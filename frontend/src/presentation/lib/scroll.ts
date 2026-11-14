/** Smooth-scroll to a scene by its id and keep the URL hash shareable (#blink, #wifi, ...). */
export function scrollToScene(id: string, reduced: boolean): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  try { window.history.replaceState(window.history.state, '', `#${id}`); } catch { /* ignore */ }
}
