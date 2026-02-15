// Bookmarklet frame — loaded inside an iframe on the trove origin
// Reads page URL/title/selection from query params, credentials from localStorage
import { initAutocomplete } from './autocomplete';
import { submitLink } from './addlink';

const params = new URLSearchParams(location.search);
const pageUrl = params.get('url') || '';
const pageTitle = params.get('title') || '';
const selection = params.get('sel') || '';

// Credentials passed via URL hash fragment (not sent to server)
const hash = new URLSearchParams(location.hash.slice(1));
const hashUser = hash.get('user') || '';
const hashPass = hash.get('pass') || '';
const hasAuth = !!(hashUser && hashPass);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, string>, ...children: (string | Node)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of children) e.append(c);
  return e;
}

const closeBtn = el('button', { class: 'close' }, '\u00d7');
document.body.appendChild(
  el('div', {},
    el('div', { class: 'header' },
      el('strong', {}, 'add to trove'),
      closeBtn),
    el('div', { class: 'body' },
      el('label', {}, 'URL'),
      el('input', { type: 'text', id: 'tw-url', value: pageUrl, readonly: '' }),
      el('label', {}, 'Title'),
      el('input', { type: 'text', id: 'tw-title', value: pageTitle, placeholder: 'Page title' }),
      ...(!hasAuth ? [
        el('label', {}, 'Credentials'),
        el('div', { class: 'auth-row' },
          el('input', { type: 'text', id: 'tw-user', placeholder: 'Username' }),
          el('input', { type: 'password', id: 'tw-pass', placeholder: 'Password' })),
      ] : []),
      el('label', {}, 'Tags'),
      el('div', { class: 'tags-wrap' },
        el('input', { type: 'text', id: 'tw-tags', placeholder: 'Tags (space-separated)', autocomplete: 'off' }),
        el('div', { class: 'suggestions', id: 'tw-suggestions' })),
      el('label', {}, 'Notes'),
      el('textarea', { id: 'tw-notes', rows: '3', placeholder: 'Select text on page to pull a quote' }, selection),
      el('button', { class: 'submit', id: 'tw-submit' }, 'Add'),
      el('div', { class: 'status', id: 'tw-status' }))));

// Tell parent iframe our content height
parent.postMessage({ type: 'trove-resize', height: document.body.scrollHeight }, '*');

const $ = (id: string) => document.getElementById(id);
($('tw-tags') as HTMLInputElement).focus();

// Close
closeBtn.addEventListener('click', () => parent.postMessage('trove-close', '*'));

// Tag autocomplete (same-origin fetch, no CSP issues)
let allTags: string[] = [];
fetch('/tags.json').then(r => r.ok ? r.json() : []).then(t => { allTags = t; }).catch(() => {});

const tagsInput = $('tw-tags') as HTMLInputElement;
const dropdown = $('tw-suggestions') as HTMLElement;
initAutocomplete(tagsInput, dropdown, () => allTags, { maxResults: 8 });

// Submit (same-origin fetch, no CSP issues)
$('tw-submit')!.addEventListener('click', async () => {
  const status = $('tw-status')!;
  const url = ($('tw-url') as HTMLInputElement).value.trim();
  const title = ($('tw-title') as HTMLInputElement).value.trim();
  const tags = ($('tw-tags') as HTMLInputElement).value.trim();
  const notes = ($('tw-notes') as HTMLTextAreaElement).value.trim();
  const username = hasAuth ? hashUser : ($('tw-user') ? ($('tw-user') as HTMLInputElement).value.trim() : '');
  const password = hasAuth ? hashPass : ($('tw-pass') ? ($('tw-pass') as HTMLInputElement).value.trim() : '');

  status.textContent = 'Submitting...';
  status.className = 'status';

  const result = await submitLink({ url, title, tags, notes, username, password });

  if (result.success) {
    status.textContent = 'Added!';
    status.className = 'status ok';
    setTimeout(() => parent.postMessage('trove-close', '*'), 1200);
  } else {
    status.textContent = result.error || 'Failed';
    status.className = 'status err';
  }
});
