// Bookmarklet widget — injected onto external pages via inline javascript: URL
// Closure variables (__TROVE_ORIGIN__ etc.) are defined in the wrapping scope
// constructed by frontend.ts updateBookmarkletHref()
import { initAutocomplete } from './autocomplete';
import { submitLink } from './addlink';

declare var __TROVE_ORIGIN__: string;
declare var __TROVE_URL__: string;
declare var __TROVE_TITLE__: string;
declare var __TROVE_SEL__: string;
declare var __TROVE_USER__: string;
declare var __TROVE_PASS__: string;

(function() {
  if (document.getElementById('trove-bookmarklet-widget')) return;

  const origin = (typeof __TROVE_ORIGIN__ !== 'undefined' && __TROVE_ORIGIN__) || location.origin;
  const pageUrl = (typeof __TROVE_URL__ !== 'undefined' && __TROVE_URL__) || location.href;
  const pageTitle = (typeof __TROVE_TITLE__ !== 'undefined' && __TROVE_TITLE__) || document.title || '';
  const selection = (typeof __TROVE_SEL__ !== 'undefined' && __TROVE_SEL__) || '';
  const username = (typeof __TROVE_USER__ !== 'undefined' && __TROVE_USER__) || '';
  const password = (typeof __TROVE_PASS__ !== 'undefined' && __TROVE_PASS__) || '';

  // Create host element with shadow DOM
  const host = document.createElement('div');
  host.id = 'trove-bookmarklet-widget';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .panel {
      position: fixed; top: 12px; right: 12px; z-index: 2147483647;
      width: 340px; background: #fff; border: 1px solid #ccc; border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.2); font-family: system-ui, sans-serif; font-size: 14px; color: #333;
    }
    .header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid #eee; }
    .header strong { font-size: 15px; }
    .close { cursor: pointer; font-size: 20px; color: #999; line-height: 1; background: none; border: none; }
    .close:hover { color: #333; }
    .body { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
    label { font-size: 12px; color: #666; }
    input, textarea { width: 100%; padding: 6px 8px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; font-family: inherit; }
    input:read-only { background: #f5f5f5; color: #666; }
    textarea { resize: vertical; min-height: 48px; }
    .tags-wrap { position: relative; }
    .suggestions {
      display: none; position: absolute; left: 0; right: 0; top: 100%;
      background: #fff; border: 1px solid #ddd; border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-height: 150px; overflow-y: auto; z-index: 10;
    }
    .suggestions.open { display: block; }
    .suggestions .tag-option { padding: 4px 8px; cursor: pointer; }
    .suggestions .tag-option:hover, .suggestions .tag-option.active { background: #f0f6ff; }
    .auth-row { display: flex; gap: 6px; }
    .auth-row input { flex: 1; }
    button.submit {
      padding: 8px; font-size: 14px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px;
      background: #f5f5f5; width: 100%;
    }
    button.submit:hover { background: #e5e5e5; }
    .status { font-size: 13px; text-align: center; min-height: 1.2em; }
    .status.ok { color: #2a2; }
    .status.err { color: #c22; }
  `;
  shadow.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'panel';

  const hasAuth = username && password;
  const authHTML = hasAuth ? '' : `
    <label>Credentials</label>
    <div class="auth-row">
      <input type="text" id="tw-user" placeholder="Username" />
      <input type="password" id="tw-pass" placeholder="Password" />
    </div>`;

  panel.innerHTML = `
    <div class="header"><strong>add to trove</strong><button class="close">&times;</button></div>
    <div class="body">
      <label>URL</label>
      <input type="text" id="tw-url" value="${pageUrl.replace(/"/g, '&quot;')}" readonly />
      <label>Title</label>
      <input type="text" id="tw-title" value="${pageTitle.replace(/"/g, '&quot;')}" placeholder="Page title" />
      ${authHTML}
      <label>Tags</label>
      <div class="tags-wrap">
        <input type="text" id="tw-tags" placeholder="Tags (space-separated)" autocomplete="off" />
        <div class="suggestions" id="tw-suggestions"></div>
      </div>
      <label>Notes</label>
      <textarea id="tw-notes" rows="3" placeholder="Notes (optional)">${selection.replace(/</g, '&lt;')}</textarea>
      <button class="submit" id="tw-submit">Add</button>
      <div class="status" id="tw-status"></div>
    </div>`;
  shadow.appendChild(panel);

  const $ = (id: string) => shadow.getElementById(id);
  ($('tw-tags') as HTMLInputElement).focus();

  // Stop keyboard events from reaching the host page (e.g. YouTube shortcuts)
  panel.addEventListener('keydown', (e) => e.stopPropagation());
  panel.addEventListener('keyup', (e) => e.stopPropagation());
  panel.addEventListener('keypress', (e) => e.stopPropagation());

  // Close
  panel.querySelector('.close')!.addEventListener('click', () => host.remove());

  // Tag autocomplete
  let allTags: string[] = [];

  fetch(origin + '/tags.json').then(r => r.ok ? r.json() : []).then(t => allTags = t).catch(() => {});

  const tagsInput = $('tw-tags') as HTMLInputElement;
  const dropdown = $('tw-suggestions') as HTMLElement;

  initAutocomplete(tagsInput, dropdown, () => allTags, { maxResults: 8 });

  // Submit
  $('tw-submit')!.addEventListener('click', async () => {
    const status = $('tw-status')!;
    const url = ($('tw-url') as HTMLInputElement).value.trim();
    const title = ($('tw-title') as HTMLInputElement).value.trim();
    const tags = ($('tw-tags') as HTMLInputElement).value.trim();
    const notes = ($('tw-notes') as HTMLTextAreaElement).value.trim();
    const user = hasAuth ? username : ($('tw-user') ? ($('tw-user') as HTMLInputElement).value.trim() : '');
    const pass = hasAuth ? password : ($('tw-pass') ? ($('tw-pass') as HTMLInputElement).value.trim() : '');

    status.textContent = 'Submitting...';
    status.className = 'status';

    const result = await submitLink({ url, title, tags, notes, username: user, password: pass, origin });

    if (result.success) {
      status.textContent = 'Added!';
      status.className = 'status ok';
      setTimeout(() => host.remove(), 1200);
    } else {
      status.textContent = result.error || 'Failed';
      status.className = 'status err';
    }
  });
})();
