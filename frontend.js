// Parse path or hash to get tag filters: /foo/bar or #foo/bar → ['foo', 'bar']
// Tags starting with '-' are exclusions: /foo/-bar → include 'foo', exclude 'bar'
function getTagFilters() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash) {
    return hash.split('/').filter(s => s.length > 0);
  }
  return window.location.pathname
    .split('/')
    .filter(segment => segment.length > 0 && segment !== 'index.html');
}

// Parse tags from space-separated string to array
const parseTags = (tags) => tags ? tags.split(' ').filter(t => t) : [];

// Hidden links stored in localStorage
const HIDDEN_KEY = 'trove_hidden_links';
const getHiddenLinks = () => JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
const hideLink = (url) => {
  const hidden = getHiddenLinks();
  if (!hidden.includes(url)) {
    hidden.push(url);
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
  }
};
const unhideLink = (url) => {
  const hidden = getHiddenLinks().filter(u => u !== url);
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
};

// Store all loaded links for client-side filtering
let allLinks = [];
// Store current filtered links for re-sorting
let currentLinks = [];
// Store current page tags to exclude from display
let currentPageTags = [];
// Track hidden count for current filter
let currentHiddenCount = 0;
// Whether we're showing hidden links
let showingHidden = false;

// Format date with progressive detail based on recency:
// - Different year    → "2025"
// - Same year         → "2026-01"
// - Same month        → "2026-02-01"
// - Same day          → "2026-02-02 14:30"
const formatDate = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');

  if (d.getFullYear() !== now.getFullYear()) {
    return `${d.getFullYear()}`;
  }
  if (d.getMonth() !== now.getMonth()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }
  if (d.getDate() !== now.getDate()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Normalize URL: prepend https:// if missing protocol
const normalizeUrl = (url) => {
  if (url && !url.includes('://')) {
    return 'https://' + url;
  }
  return url;
};

function sortLinks(links, sortBy) {
  const sorted = [...links];
  switch (sortBy) {
    case 'oldest':
      sorted.sort((a, b) => (a.added || '').localeCompare(b.added || ''));
      break;
    case 'alpha':
      sorted.sort((a, b) => (a.title || a.url).toLowerCase().localeCompare((b.title || b.url).toLowerCase()));
      break;
    case 'random':
      for (let i = sorted.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
      }
      break;
    case 'newest':
    default:
      sorted.sort((a, b) => (b.added || '').localeCompare(a.added || ''));
      break;
  }
  return sorted;
}

function renderLinks(links) {
  const container = document.getElementById('links');
  const currentPath = '/' + currentPageTags.join('/');
  const hideHandler = showingHidden ? 'handleUnhide' : 'handleHide';
  const hideLabel = showingHidden ? 'Unhide' : 'Hide';
  container.innerHTML = links.map(link => {
    const tags = parseTags(link.tags).filter(t => !currentPageTags.includes(t));
    let domain = link.url;
    try { domain = new URL(link.url).hostname.replace(/^www\./, ''); } catch {}
    const escapedUrl = link.url.replace(/'/g, "\\'");
    const renderTag = (t) => `<span class="tag-wrap"><span class="tag" data-tag="${t}">#${t}</span><span class="tag-menu"><span data-href="/${t}">→ /${t}</span><span data-href="${currentPath}/${t}">+ ${currentPath}/${t}</span><span data-href="${currentPath}/-${t}">− ${currentPath}/-${t}</span></span></span>`;
    return `
    <a class="link-anchor" href="${link.url}" target="_blank" rel="noopener">
      <div class="link"
           data-url="${link.url}"
           data-added="${link.added || ''}"
           ${link.title ? `data-title="${link.title.replace(/"/g, '&quot;')}"` : ''}
           ${tags.length ? `data-tags="${tags.join(' ')}"` : ''}>
        <div class="card-top">
          ${link.added ? `<span class="added">${formatDate(link.added)}</span>` : '<span></span>'}
          <span>
            <span class="hide-btn" onclick="${hideHandler}(event, '${escapedUrl}', this)">${hideLabel}</span>
          </span>
        </div>
        <div class="title-row">
          <span class="title">${link.title || link.url}</span>
        </div>
        <span class="url">${domain}</span>
        ${link.notes ? `<div class="notes">${link.notes}</div>` : ''}
        <div class="card-bottom"><span class="tags">${tags.map(renderTag).join(' ')}</span><button class="add-tag-btn" onclick="handleAddTagClick(event, this)">+</button></div>
      </div>
    </a>`;
  }).join('');
}

function applySort() {
  const sortBy = document.getElementById('sort-select').value;
  const sorted = sortLinks(currentLinks, sortBy);
  renderLinks(sorted);
}

// Navigate to a tag without full page reload
function navigateToTag(tag) {
  history.pushState(null, '', '/' + tag);
  filterAndRender();
}

// Set up tag click handlers (delegated)
function initTagMenu() {
  document.getElementById('links').addEventListener('click', (e) => {
    const menuItem = e.target.closest('.tag-menu [data-href]');
    const tag = e.target.closest('.tag[data-tag]');
    if (menuItem) {
      e.preventDefault();
      e.stopPropagation();
      history.pushState(null, '', menuItem.dataset.href);
      filterAndRender();
    } else if (tag) {
      e.preventDefault();
      e.stopPropagation();
      navigateToTag(tag.dataset.tag);
    }
  });
}

// Filter allLinks by current URL and render
function filterAndRender() {
  const container = document.getElementById('links');
  const sortControls = document.getElementById('sort-controls');
  const tagFilters = getTagFilters();

  // Pre-populate tags input with current filters (exclude negated tags)
  const tagsInput = document.getElementById('link-tags');
  const includeTags = tagFilters.filter(t => !t.startsWith('-'));
  if (tagsInput) tagsInput.value = includeTags.join(' ');

  // Update heading to show active filters
  if (tagFilters.length > 0) {
    document.querySelector('h1 a').textContent = tagFilters.map(t =>
      t.startsWith('-') ? `-#${t.slice(1)}` : `#${t}`
    ).join(' ');
    document.title = tagFilters.join('/') + ' - trove';
  } else {
    document.querySelector('h1 a').textContent = 'trove';
    document.title = 'trove';
  }

  // Front page: show tag list with counts (no sort controls)
  if (tagFilters.length === 0) {
    sortControls.style.display = 'none';
    const tagCounts = {};
    allLinks.forEach(link => {
      parseTags(link.tags).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const sortedTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1]);

    if (sortedTags.length === 0) {
      container.innerHTML = '<div class="empty">No tags found.</div>';
      return;
    }

    container.innerHTML = '<ul class="tag-list">' + sortedTags.map(([tag, count]) =>
      `<li><span class="tag-wrap"><a href="/${tag}" class="tag" data-tag="${tag}">#${tag}</a><span class="tag-menu"><a href="/${tag}">→ /${tag}</a></span></span><span class="count">(${count})</span></li>`
    ).join('') + '</ul>';
    return;
  }

  // Filter links by tags (must have ALL included tags, none of excluded tags)
  const excludeTags = tagFilters.filter(t => t.startsWith('-')).map(t => t.slice(1));
  const hiddenLinks = getHiddenLinks();

  // First filter by tags only to count hidden links
  const tagMatchedLinks = allLinks.filter(link => {
    const linkTags = parseTags(link.tags);
    const hasAllIncluded = includeTags.every(tag => linkTags.includes(tag));
    const hasNoneExcluded = excludeTags.every(tag => !linkTags.includes(tag));
    return hasAllIncluded && hasNoneExcluded;
  });

  currentHiddenCount = tagMatchedLinks.filter(link => hiddenLinks.includes(link.url)).length;
  const visibleLinks = tagMatchedLinks.filter(link => !hiddenLinks.includes(link.url));
  const hiddenLinksList = tagMatchedLinks.filter(link => hiddenLinks.includes(link.url));
  const links = showingHidden ? hiddenLinksList : visibleLinks;

  if (links.length === 0) {
    sortControls.style.display = 'none';
    if (showingHidden) {
      container.innerHTML = '<div class="empty">No hidden links. <a href="#" onclick="toggleShowHidden(); return false;">Show all</a></div>';
    } else {
      const hiddenText = currentHiddenCount > 0
        ? ` (<a href="#" onclick="toggleShowHidden(); return false;">${currentHiddenCount} hidden</a>)`
        : '';
      container.innerHTML = `<div class="empty">No links found.${hiddenText}</div>`;
    }
    return;
  }

  // Show sort controls, link count, and render sorted links
  sortControls.style.display = 'block';
  currentLinks = links;
  currentPageTags = includeTags;
  updateLinkCountDisplay();
  const sortBy = document.getElementById('sort-select').value;
  const sorted = sortLinks(links, sortBy);
  renderLinks(sorted);
}

function handleHide(event, url, btn) {
  event.preventDefault();
  event.stopPropagation();
  hideLink(url);
  btn.closest('.link-anchor').remove();
  currentLinks = currentLinks.filter(l => l.url !== url);
  currentHiddenCount++;
  updateLinkCountDisplay();
}

function handleUnhide(event, url, btn) {
  event.preventDefault();
  event.stopPropagation();
  unhideLink(url);
  btn.closest('.link-anchor').remove();
  currentLinks = currentLinks.filter(l => l.url !== url);
  currentHiddenCount--;
  updateLinkCountDisplay();
}

function toggleShowHidden() {
  showingHidden = !showingHidden;
  filterAndRender();
}

function updateLinkCountDisplay() {
  const count = currentLinks.length;
  let suffix;
  if (showingHidden) {
    suffix = ` (<a href="#" onclick="toggleShowHidden(); return false;">show visible</a>)`;
  } else if (currentHiddenCount > 0) {
    suffix = ` (<a href="#" onclick="toggleShowHidden(); return false;">${currentHiddenCount} hidden</a>)`;
  } else {
    suffix = '';
  }
  document.getElementById('link-count').innerHTML = `${count} link${count === 1 ? '' : 's'}${suffix}`;
}

function handleAddTagClick(event, btn) {
  event.preventDefault();
  event.stopPropagation();

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'add-tag-input';
  input.placeholder = 'tag tag...';

  const linkEl = btn.closest('.link');
  const url = linkEl.dataset.url;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tags = input.value.trim();
      if (tags) {
        submitTagsForLink(url, tags, linkEl, input, btn);
      } else {
        restoreAddButton(input, btn);
      }
    } else if (e.key === 'Escape') {
      restoreAddButton(input, btn);
    }
  });

  input.addEventListener('blur', () => {
    // Small delay to allow click events to fire first
    setTimeout(() => {
      if (document.body.contains(input)) {
        restoreAddButton(input, btn);
      }
    }, 100);
  });

  btn.style.display = 'none';
  btn.parentNode.insertBefore(input, btn);
  input.focus();
}

function restoreAddButton(input, btn) {
  if (input.parentNode) {
    input.remove();
  }
  btn.style.display = '';
}

async function submitTagsForLink(url, tags, linkEl, input, btn) {
  const creds = getCredentials();
  if (!creds) { showSignIn(); return; }

  // Optimistically add tags to UI
  const tagsEl = linkEl.querySelector('.tags');
  const currentPath = '/' + currentPageTags.join('/');
  const newTags = tags.split(' ').filter(t => t && !currentPageTags.includes(t));

  newTags.forEach(t => {
    const wrap = document.createElement('span');
    wrap.className = 'tag-wrap';
    wrap.innerHTML = `<span class="tag" data-tag="${t}">#${t}</span><span class="tag-menu"><span data-href="/${t}">→ /${t}</span><span data-href="${currentPath}/${t}">+ ${currentPath}/${t}</span><span data-href="${currentPath}/-${t}">− ${currentPath}/-${t}</span></span>`;
    tagsEl.appendChild(wrap);
    tagsEl.appendChild(document.createTextNode(' '));
  });

  restoreAddButton(input, btn);

  // Submit to backend
  try {
    await fetch('/.netlify/functions/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, tags, notes: '', username: creds.username, password: creds.password }),
    });
  } catch (e) {
    console.error('Failed to submit tags:', e);
  }
}

async function loadLinks() {
  const container = document.getElementById('links');

  try {
    const response = await fetch('/trove.jsonl');
    const text = await response.text();
    allLinks = text.trim().split('\n').filter(line => line).map(line => {
      const link = JSON.parse(line);
      link.url = normalizeUrl(link.url);
      return link;
    });

    filterAndRender();
  } catch (err) {
    container.innerHTML = '<div class="empty">Failed to load links.</div>';
    console.error(err);
  }
}

// Auth: per-user password stored in localStorage
const CREDS_KEY = 'trove_credentials';

function getCredentials() {
  const stored = localStorage.getItem(CREDS_KEY);
  if (!stored) return null;
  try { return JSON.parse(stored); } catch { return null; }
}

function saveCredentials(username, password) {
  localStorage.setItem(CREDS_KEY, JSON.stringify({ username, password }));
}

function clearCredentials() {
  localStorage.removeItem(CREDS_KEY);
}

function isSignedIn() {
  return getCredentials() !== null;
}

function showSignIn() {
  document.getElementById('signin-form').style.display = 'flex';
  document.getElementById('auth-username').focus();
}

async function handleSignIn() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const status = document.getElementById('auth-status');

  if (!username || !password) {
    status.textContent = 'Enter username and password';
    status.className = 'status-error';
    return;
  }

  status.textContent = 'Signing in...';
  status.className = '';

  try {
    const response = await fetch('/.netlify/functions/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      saveCredentials(username, password);
      status.textContent = '';
      document.getElementById('signin-form').style.display = 'none';
      onAuthSuccess(username);
    } else {
      const result = await response.json();
      status.textContent = result.error || 'Sign in failed';
      status.className = 'status-error';
    }
  } catch (e) {
    status.textContent = 'Network error';
    status.className = 'status-error';
  }
}

function signOut() {
  clearCredentials();
  document.getElementById('auth-user').style.display = 'none';
  document.getElementById('signout-btn').style.display = 'none';
  document.getElementById('auth-btn').style.display = '';

  if (currentLinks.length > 0) {
    applySort();
  }
}

function onAuthSuccess(username) {
  document.getElementById('auth-user').textContent = username;
  document.getElementById('auth-user').style.display = '';
  document.getElementById('auth-btn').style.display = 'none';
  document.getElementById('signout-btn').style.display = '';

  if (!bookmarkletMode && currentLinks.length > 0) {
    applySort();
  }
}

async function submitLink() {
  const urlInput = document.getElementById('link-url');
  const tagsInput = document.getElementById('link-tags');
  const notesInput = document.getElementById('link-notes');
  const status = document.getElementById('submit-status');
  const url = urlInput.value.trim();
  const tags = tagsInput.value.trim();
  const notes = notesInput.value.trim();

  if (!url) {
    status.textContent = 'Enter a URL';
    status.className = 'status-error';
    return;
  }

  const creds = getCredentials();
  if (!creds) {
    showSignIn();
    return;
  }

  status.textContent = 'Submitting...';
  status.className = '';

  try {
    const response = await fetch('/.netlify/functions/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, tags, notes, username: creds.username, password: creds.password }),
    });

    const result = await response.json();

    if (response.ok) {
      status.textContent = 'Submitted!';
      status.className = 'status-success';
      if (bookmarkletMode) {
        setTimeout(() => window.close(), 500);
      } else {
        urlInput.value = '';
        // Re-populate tags from current page filters
        const tagFilters = getTagFilters();
        tagsInput.value = tagFilters.filter(t => !t.startsWith('-')).join(' ');
        notesInput.value = '';
      }
    } else {
      status.textContent = result.error || 'Failed';
      status.className = 'status-error';
    }
  } catch (e) {
    status.textContent = 'Network error';
    status.className = 'status-error';
  }
}

// Handle browser back/forward navigation
window.addEventListener('popstate', () => {
  if (allLinks.length > 0) {
    filterAndRender();
  }
});

// Bookmarklet popup mode
let bookmarkletMode = false;

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    submit: params.get('submit') === '1',
    url: params.get('url') || '',
  };
}

function initBookmarkletMode() {
  const params = getUrlParams();
  if (!params.submit) return false;

  bookmarkletMode = true;
  document.body.classList.add('bookmarklet-mode');

  // Hide main content, show only add form
  document.getElementById('sort-controls').style.display = 'none';
  document.getElementById('link-count').style.display = 'none';
  document.getElementById('links').style.display = 'none';

  // Pre-fill URL
  document.getElementById('link-url').value = params.url;

  return true;
}

// Set bookmarklet link href with current origin
function initBookmarkletLink() {
  const link = document.getElementById('bookmarklet');
  if (link) {
    const origin = location.origin;
    link.href = "javascript:window.open('" + origin + "/?submit=1&url='+encodeURIComponent(location.href),'trove','width=450,height=350')";
  }
}

// Check for existing credentials on page load
function initAuth() {
  const creds = getCredentials();
  if (creds) {
    onAuthSuccess(creds.username);
  }
}

// Allow Enter key to submit sign-in form
function initSignInForm() {
  const form = document.getElementById('signin-form');
  if (form) {
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSignIn();
      }
    });
  }
}

// Initialize on page load
initBookmarkletLink();
initAuth();
initSignInForm();
if (!initBookmarkletMode()) {
  initTagMenu();
  loadLinks();
}
