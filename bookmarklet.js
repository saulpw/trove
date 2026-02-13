// Bookmarklet widget — injected onto external pages via bookmarklet
// Loaded as: javascript:(function(){...load this script with data attrs...})()
(function() {
  if (document.getElementById('trove-bookmarklet-widget')) return;

  const script = document.currentScript || document.querySelector('script[data-trove-origin]');
  const origin = (script && script.dataset.troveOrigin) || 'https://trove.pw';
  const pageUrl = (script && script.dataset.troveUrl) || location.href;
  const selection = (script && script.dataset.troveSelection) || '';
  const username = (script && script.dataset.troveUser) || '';
  const password = (script && script.dataset.trovePass) || '';

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
    .suggestions div { padding: 4px 8px; cursor: pointer; }
    .suggestions div:hover, .suggestions div.active { background: #f0f6ff; }
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

  const $ = (id) => shadow.getElementById(id);
  $('tw-tags').focus();

  // Close
  panel.querySelector('.close').addEventListener('click', () => host.remove());

  // Tag autocomplete
  let allTags = [];
  let activeIdx = -1;

  fetch(origin + '/tags.json').then(r => r.ok ? r.json() : []).then(t => allTags = t).catch(() => {});

  const tagsInput = $('tw-tags');
  const dropdown = $('tw-suggestions');

  function currentPartial() {
    const val = tagsInput.value;
    const cursor = tagsInput.selectionStart;
    const before = val.slice(0, cursor);
    const lastSpace = before.lastIndexOf(' ');
    return before.slice(lastSpace + 1);
  }

  function showSuggestions() {
    const partial = currentPartial().toLowerCase();
    if (!partial) { dropdown.classList.remove('open'); return; }
    const existing = new Set(tagsInput.value.split(' ').filter(t => t));
    const matches = allTags.filter(t => !existing.has(t) && t.toLowerCase().includes(partial)).slice(0, 8);
    if (!matches.length) { dropdown.classList.remove('open'); return; }
    activeIdx = -1;
    dropdown.innerHTML = matches.map(t => `<div>${t}</div>`).join('');
    dropdown.classList.add('open');
  }

  function pickTag(tag) {
    const val = tagsInput.value;
    const cursor = tagsInput.selectionStart;
    const before = val.slice(0, cursor);
    const lastSpace = before.lastIndexOf(' ');
    const after = val.slice(cursor);
    const nextSpace = after.indexOf(' ');
    const afterCut = nextSpace >= 0 ? after.slice(nextSpace) : '';
    tagsInput.value = before.slice(0, lastSpace + 1) + tag + ' ' + afterCut.trimStart();
    dropdown.classList.remove('open');
    tagsInput.focus();
  }

  tagsInput.addEventListener('input', showSuggestions);
  tagsInput.addEventListener('keydown', (e) => {
    if (!dropdown.classList.contains('open')) return;
    const items = dropdown.querySelectorAll('div');
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, items.length - 1); items.forEach((el, i) => el.classList.toggle('active', i === activeIdx)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); items.forEach((el, i) => el.classList.toggle('active', i === activeIdx)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pickTag(items[activeIdx].textContent); }
    else if (e.key === 'Escape') { dropdown.classList.remove('open'); }
  });
  dropdown.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const opt = e.target.closest('div');
    if (opt) pickTag(opt.textContent);
  });
  tagsInput.addEventListener('blur', () => { setTimeout(() => dropdown.classList.remove('open'), 150); });

  // Submit
  $('tw-submit').addEventListener('click', async () => {
    const status = $('tw-status');
    const url = $('tw-url').value.trim();
    const tags = $('tw-tags').value.trim();
    const notes = $('tw-notes').value.trim();
    const user = hasAuth ? username : ($('tw-user') ? $('tw-user').value.trim() : '');
    const pass = hasAuth ? password : ($('tw-pass') ? $('tw-pass').value.trim() : '');

    if (!user || !pass) { status.textContent = 'Enter credentials'; status.className = 'status err'; return; }

    status.textContent = 'Submitting...';
    status.className = 'status';

    try {
      const resp = await fetch(origin + '/.netlify/functions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, tags, notes, username: user, password: pass }),
      });
      const result = await resp.json();
      if (resp.ok) {
        status.textContent = 'Added!';
        status.className = 'status ok';
        setTimeout(() => host.remove(), 1200);
      } else {
        status.textContent = result.error || 'Failed';
        status.className = 'status err';
      }
    } catch {
      status.textContent = 'Network error';
      status.className = 'status err';
    }
  });
})();
