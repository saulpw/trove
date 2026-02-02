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

// Store current filtered links for re-sorting
let currentLinks = [];
// Store current page tags to exclude from display
let currentPageTags = [];

const formatDate = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Always include a "grosser" unit for context
  if (d.getFullYear() !== now.getFullYear()) {
    // Different year: show MMM YYYY
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  } else if (d.getMonth() !== now.getMonth()) {
    // Same year, different month: show MMM DD
    return `${months[d.getMonth()]} ${d.getDate()}`;
  } else if (d.getDate() !== now.getDate()) {
    // Same month, different day: show MMM DD
    return `${months[d.getMonth()]} ${d.getDate()}`;
  } else {
    // Same day: show MMM DD HH:MM
    return `${months[d.getMonth()]} ${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
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
  container.innerHTML = links.map(link => {
    const tags = parseTags(link.tags).filter(t => !currentPageTags.includes(t));
    let domain = link.url;
    try { domain = new URL(link.url).hostname.replace(/^www\./, ''); } catch {}
    const escapedUrl = link.url.replace(/'/g, "\\'");
    return `
    <div class="link"
         onclick="handleLinkClick(event, '${escapedUrl}')"
         data-url="${link.url}"
         data-added="${link.added || ''}"
         ${link.title ? `data-title="${link.title.replace(/"/g, '&quot;')}"` : ''}
         ${tags.length ? `data-tags="${tags.join(' ')}"` : ''}>
      <div class="card-top">
        ${link.added ? `<span class="added">${formatDate(link.added)}</span>` : '<span></span>'}
        <span>
          <span class="hide-btn" onclick="handleHide('${escapedUrl}', this); event.stopPropagation();">x</span>
        </span>
      </div>
      <div class="title-row">
        <span class="title">${link.title || link.url}</span>
      </div>
      <span class="url">${domain}</span>
      ${link.notes ? `<div class="notes">${link.notes}</div>` : ''}
      ${tags.length ? `<div class="card-bottom"><span class="tags">${tags.map(t => `<a href="/${t}" class="tag" onclick="event.stopPropagation()">#${t}</a>`).join(' ')}</span></div>` : ''}
    </div>`;
  }).join('');
}

function handleLinkClick(event, url) {
  // Don't navigate if clicking on interactive elements
  if (event.target.closest('.hide-btn') || event.target.closest('.tag')) {
    return;
  }
  window.open(url, '_blank');
}

function applySort() {
  const sortBy = document.getElementById('sort-select').value;
  const sorted = sortLinks(currentLinks, sortBy);
  renderLinks(sorted);
}

function handleHide(url, btn) {
  hideLink(url);
  btn.closest('.link').remove();
  currentLinks = currentLinks.filter(l => l.url !== url);
}

async function loadLinks() {
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
  }

  try {
    const response = await fetch('/trove.jsonl');
    const text = await response.text();
    const allLinks = text.trim().split('\n').filter(line => line).map(line => {
      const link = JSON.parse(line);
      link.url = normalizeUrl(link.url);
      return link;
    });

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
        `<li><a href="/${tag}">#${tag}</a><span class="count">(${count})</span></li>`
      ).join('') + '</ul>';
      return;
    }

    // Filter links by tags (must have ALL included tags, none of excluded tags)
    const excludeTags = tagFilters.filter(t => t.startsWith('-')).map(t => t.slice(1));
    const hiddenLinks = getHiddenLinks();
    const links = allLinks.filter(link => {
      if (hiddenLinks.includes(link.url)) return false;
      const linkTags = parseTags(link.tags);
      const hasAllIncluded = includeTags.every(tag => linkTags.includes(tag));
      const hasNoneExcluded = excludeTags.every(tag => !linkTags.includes(tag));
      return hasAllIncluded && hasNoneExcluded;
    });

    if (links.length === 0) {
      sortControls.style.display = 'none';
      container.innerHTML = '<div class="empty">No links found.</div>';
      return;
    }

    // Show sort controls, link count, and render sorted links
    sortControls.style.display = 'block';
    document.getElementById('link-count').textContent = `${links.length} link${links.length === 1 ? '' : 's'}`;
    currentLinks = links;
    currentPageTags = includeTags;
    const sortBy = document.getElementById('sort-select').value;
    const sorted = sortLinks(links, sortBy);
    renderLinks(sorted);
  } catch (err) {
    container.innerHTML = '<div class="empty">Failed to load links.</div>';
    console.error(err);
  }
}

// Google Auth
let accessToken = null;
let tokenClient = null;

function initGoogleAuth() {
  const clientId = window.GOOGLE_CLIENT_ID || '';
  if (!clientId) {
    document.getElementById('auth-btn').textContent = 'No OAuth configured';
    document.getElementById('auth-btn').disabled = true;
    return;
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'email',
    callback: (response) => {
      if (response.access_token) {
        accessToken = response.access_token;
        document.getElementById('auth-btn').textContent = 'Signed in';
        document.getElementById('auth-btn').disabled = true;
      }
    },
  });
}

function handleAuth() {
  if (tokenClient) {
    tokenClient.requestAccessToken();
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

  if (!accessToken) {
    status.textContent = 'Sign in first';
    status.className = 'status-error';
    return;
  }

  status.textContent = 'Submitting...';
  status.className = '';

  try {
    const response = await fetch('/.netlify/functions/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, tags, notes, googleToken: accessToken }),
    });

    const result = await response.json();

    if (response.ok) {
      status.textContent = 'Submitted!';
      status.className = 'status-success';
      urlInput.value = '';
      // Re-populate tags from current page filters
      const tagFilters = getTagFilters();
      tagsInput.value = tagFilters.filter(t => !t.startsWith('-')).join(' ');
      notesInput.value = '';
    } else {
      status.textContent = result.error || 'Failed';
      status.className = 'status-error';
    }
  } catch (e) {
    status.textContent = 'Network error';
    status.className = 'status-error';
  }
}

// Version display
function loadVersion() {
  fetch('/version.txt')
    .then(r => r.text())
    .then(v => document.getElementById('version').textContent = 'v' + v.trim())
    .catch(() => {});
}

// Initialize on page load
loadLinks();
loadVersion();
