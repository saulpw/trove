// Bookmarklet widget — injected onto external pages via inline javascript: URL
// Closure variables (__TROVE_ORIGIN__ etc.) are defined in the wrapping scope
// constructed by frontend.ts updateBookmarkletHref()
import { initAutocomplete } from './autocomplete';
import { submitLink, reportProblem } from './addlink';

declare var trustedTypes: { createPolicy(name: string, rules: { createHTML: (s: string) => string }): { createHTML: (s: string) => string } } | undefined;
declare var __TROVE_ORIGIN__: string;
declare var __TROVE_URL__: string;
declare var __TROVE_TITLE__: string;
declare var __TROVE_SEL__: string;
declare var __TROVE_USER__: string;
declare var __TROVE_PASS__: string;

(function() {
  if (document.getElementById('trove-bookmarklet-widget')) return;

  // Trusted Types policy to bypass YouTube's require-trusted-types-for directive
  const tt = (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy)
    ? trustedTypes.createPolicy('trove', { createHTML: (s: string) => s })
    : { createHTML: (s: string) => s };

  const origin = (typeof __TROVE_ORIGIN__ !== 'undefined' && __TROVE_ORIGIN__) || location.origin;
  const pageUrl = (typeof __TROVE_URL__ !== 'undefined' && __TROVE_URL__) || location.href;
  const pageTitle = (typeof __TROVE_TITLE__ !== 'undefined' && __TROVE_TITLE__) || document.title || '';
  const selection = (typeof __TROVE_SEL__ !== 'undefined' && __TROVE_SEL__) || '';
  const username = (typeof __TROVE_USER__ !== 'undefined' && __TROVE_USER__) || '';
  const password = (typeof __TROVE_PASS__ !== 'undefined' && __TROVE_PASS__) || '';

  // Create host element with shadow DOM
  const host = document.createElement('div');
  host.id = 'trove-bookmarklet-widget';
  // Force host visible — some sites (e.g. Shopify) set display:none on generic divs
  host.style.cssText = 'display:block!important;visibility:visible!important;';
  // vimium etc. skip keys only when the retargeted activeElement looks editable
  host.setAttribute('contenteditable', 'true');
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'closed' });

  // Use adoptedStyleSheets to bypass CSP restrictions (e.g. YouTube)
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .panel {
      position: fixed; top: 12px; right: 12px; z-index: 2147483647;
      width: 340px; background: #fff; color-scheme: light; border: 1px solid #ccc; border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.2); font-family: system-ui, sans-serif; font-size: 14px; color: #333;
    }
    .header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid #eee; }
    .header strong { font-size: 15px; }
    .close { cursor: pointer; font-size: 20px; color: #999; line-height: 1; background: none; border: none; }
    .close:hover { color: #333; }
    .body { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
    label { font-size: 12px; color: #666; }
    input, textarea { width: 100%; padding: 6px 8px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; font-family: inherit; background: #fff; color: #333; }
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
    .check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #666; cursor: pointer; }
    .check input { width: auto; margin: 0; }
    button.submit {
      padding: 8px; font-size: 14px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px;
      background: #f5f5f5; width: 100%;
    }
    button.submit:hover { background: #e5e5e5; }
    .status { font-size: 13px; text-align: center; min-height: 1.2em; }
    .status.ok { color: #2a2; }
    .status.err { color: #c22; }
    .footer { text-align: right; }
    .footer button {
      background: none; border: none; padding: 0; font-family: inherit;
      font-size: 11px; color: #999; cursor: pointer; text-decoration: underline;
    }
    .footer button:hover { color: #333; }
  `);
  shadow.adoptedStyleSheets = [sheet];

  const panel = document.createElement('div');
  panel.className = 'panel';

  const hasAuth = username && password;
  const authHTML = hasAuth ? '' : `
    <label>Credentials</label>
    <div class="auth-row">
      <input type="text" id="tw-user" placeholder="Username" />
      <input type="password" id="tw-pass" placeholder="Password" />
    </div>`;

  panel.innerHTML = tt.createHTML(`
    <div class="header"><strong>add to trove</strong><button class="close">&times;</button></div>
    <div class="body">
      <label>URL</label>
      <input type="text" id="tw-url" value="${pageUrl.replace(/"/g, '&quot;')}" />
      <label>Title</label>
      <input type="text" id="tw-title" value="${pageTitle.replace(/"/g, '&quot;')}" placeholder="Page title" />
      ${authHTML}
      <label>Tags</label>
      <div class="tags-wrap">
        <input type="text" id="tw-tags" placeholder="Tags (space-separated)" autocomplete="off" />
        <div class="suggestions" id="tw-suggestions"></div>
      </div>
      <label class="check"><input type="checkbox" id="tw-autotag" /> auto-tag</label>
      <label>Notes</label>
      <textarea id="tw-notes" rows="3" placeholder="Select text on page to pull a quote">${selection.replace(/</g, '&lt;')}</textarea>
      <button class="submit" id="tw-submit">Add</button>
      <div class="status" id="tw-status"></div>
      <div class="footer"><button id="tw-report">report a problem</button></div>
    </div>`) as unknown as string;
  shadow.appendChild(panel);

  const $ = (id: string) => shadow.getElementById(id);
  ($('tw-tags') as HTMLInputElement).focus();

  const keyGuard = new AbortController();
  const closeWidget = () => { keyGuard.abort(); host.remove(); };

  // window capture runs before page document-capture listeners; composed:false clone stays in the shadow
  for (const type of ['keydown', 'keyup', 'keypress']) {
    window.addEventListener(type, (e) => {
      const ke = e as KeyboardEvent;
      if (!ke.composedPath().includes(host)) return;
      ke.stopPropagation();
      const clone = new KeyboardEvent(ke.type, {
        key: ke.key, code: ke.code, location: ke.location, repeat: ke.repeat, isComposing: ke.isComposing,
        ctrlKey: ke.ctrlKey, shiftKey: ke.shiftKey, altKey: ke.altKey, metaKey: ke.metaKey,
        bubbles: true, cancelable: true, composed: false,
      });
      if (!(shadow.activeElement ?? panel).dispatchEvent(clone)) ke.preventDefault();
    }, { capture: true, signal: keyGuard.signal });
  }

  // Close
  panel.querySelector('.close')!.addEventListener('click', closeWidget);

  // Tag autocomplete
  let allTags: string[] = [];

  fetch(origin + '/tags.jsonl').then(r => r.ok ? r.text() : '').then(text => {
    const tags: string[] = [];
    for (const line of text.trim().split(/\r?\n/)) {
      if (!line) continue;
      try { const t = JSON.parse(line).tag; if (t) tags.push(t); } catch {}
    }
    allTags = tags;
  }).catch(() => {});

  const tagsInput = $('tw-tags') as HTMLInputElement;
  const dropdown = $('tw-suggestions') as HTMLElement;

  initAutocomplete(tagsInput, dropdown, () => allTags, { maxResults: 8, trustedHTML: (s) => tt.createHTML(s) as unknown as string });

  // Enter key submits
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.defaultPrevented) {
      e.preventDefault();
      ($('tw-submit') as HTMLButtonElement).click();
    }
  });

  const fieldValue = (id: string) => ($(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value.trim() ?? '';
  const formValues = () => ({
    url: fieldValue('tw-url'),
    title: fieldValue('tw-title'),
    tags: fieldValue('tw-tags'),
    notes: fieldValue('tw-notes'),
    autotag: ($('tw-autotag') as HTMLInputElement).checked,
    username: hasAuth ? username : fieldValue('tw-user'),
    password: hasAuth ? password : fieldValue('tw-pass'),
    origin,
  });

  // Report a problem
  $('tw-report')!.addEventListener('click', async () => {
    const status = $('tw-status')!;
    status.textContent = 'Reporting...';
    status.className = 'status';
    const result = await reportProblem(formValues());
    status.textContent = result.success ? 'Reported, thanks!' : (result.error || 'Failed');
    status.className = result.success ? 'status ok' : 'status err';
  });

  // Submit
  $('tw-submit')!.addEventListener('click', async () => {
    const status = $('tw-status')!;
    const values = formValues();
    const { url, title, tags, notes, autotag, username: user, password: pass } = values;

    status.textContent = 'Submitting...';
    status.className = 'status';

    const result = await submitLink(values);

    if (result.success) {
      status.textContent = 'Added!';
      status.className = 'status ok';
      setTimeout(closeWidget, 1200);
    } else if (result.error === 'Network error') {
      // CSP blocks the cross-origin fetch — open trove /submit in a new tab instead
      const params = new URLSearchParams({ url, title, tags, notes, u: user, p: pass });
      if (autotag) params.set('autotag', '1');
      const submitUrl = origin + '/submit?' + params.toString();
      // wombat-escape: archive.org rewrites window.open(url); blob popup meta-refreshes itself to live trove
      const esc = submitUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      const blobUrl = URL.createObjectURL(new Blob(
        [`<!doctype html><meta charset=utf-8><meta http-equiv=refresh content="0;url=${esc}">`],
        { type: 'text/html' }));
      window.open(blobUrl, '_blank');
      status.textContent = 'Opened in new tab...';
      status.className = 'status ok';
      setTimeout(closeWidget, 1500);
    } else {
      status.textContent = result.error || 'Failed';
      status.className = 'status err';
    }
  });
})();
