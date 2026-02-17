// Thin bookmarklet injector — creates an iframe to the trove origin
// The iframe runs same-origin with trove, bypassing host page CSP restrictions
// Closure variables set by frontend.ts updateBookmarkletHref()

declare var __TROVE_ORIGIN__: string;
declare var __TROVE_USER__: string;
declare var __TROVE_PASS__: string;

(function() {
  if (document.getElementById('trove-bookmarklet-widget')) return;

  const origin = (typeof __TROVE_ORIGIN__ !== 'undefined' && __TROVE_ORIGIN__) || location.origin;
  const user = (typeof __TROVE_USER__ !== 'undefined' && __TROVE_USER__) || '';
  const pass = (typeof __TROVE_PASS__ !== 'undefined' && __TROVE_PASS__) || '';
  const url = encodeURIComponent(location.href);
  const title = encodeURIComponent(document.title || '');
  const sel = encodeURIComponent((window.getSelection() || '').toString());

  const container = document.createElement('div');
  container.id = 'trove-bookmarklet-widget';
  container.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;width:340px;border:none;';

  const iframe = document.createElement('iframe');
  iframe.src = `${origin}/bookmarklet-frame.html?url=${url}&title=${title}&sel=${sel}#user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`;
  iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,0.2);';
  container.appendChild(iframe);
  document.body.appendChild(container);

  window.addEventListener('message', (e) => {
    if (e.origin !== origin) return;
    if (e.data === 'trove-close') container.remove();
    if (e.data?.type === 'trove-resize') container.style.height = e.data.height + 'px';
  });
})();
