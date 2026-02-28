import bookmarkletCode from './_build/bookmarklet-code.txt';
import { getCredentials, clearCredentials, isSignedIn, showSignIn, handleSignIn, togglePasswordVisibility, initSignInForm } from './auth';
import { renderTag, renderTagSidebar, initTagMenu, initSidebarTagMenu, handleAddTagClick, isUserTag, userTagUsername } from './tags';
import { initAutocomplete } from './autocomplete';

interface Link {
  url: string;
  added: string;
  title?: string;
  tags?: string;
  notes?: string;
  thumbnail?: string;
  duration?: string;
  channel?: string;
}

interface PageConfig {
  title: string;
  heading: string;
  filter: (link: Link) => boolean;
  pageTags: string[];
  tagFilters: string[];
  truncate: boolean;
}

// Parse path or hash to get tag filters: /foo/bar or #foo/bar → ['foo', 'bar']
// Tags starting with '-' are exclusions: /foo/-bar → include 'foo', exclude 'bar'
function getTagFilters(): string[] {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash) {
    return hash.split('/').filter(s => s.length > 0);
  }
  return window.location.pathname
    .split('/')
    .filter(segment => segment.length > 0 && segment !== 'index.html');
}

// Filter links by time period based on their added date
function filterLinksByTime(links: Link[], period: string): Link[] {
  if (period === 'all') return links;

  const now = new Date();
  const cutoff = new Date();

  switch (period) {
    case 'day':
      cutoff.setDate(now.getDate() - 1);
      break;
    case 'week':
      cutoff.setDate(now.getDate() - 7);
      break;
    case 'month':
      cutoff.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      cutoff.setFullYear(now.getFullYear() - 1);
      break;
    default:
      return links;
  }

  return links.filter(link => {
    if (!link.added) return false;
    const added = new Date(link.added);
    return added >= cutoff;
  });
}

// Parse tags from space-separated string to array
export const parseTags = (tags: string | undefined): string[] => tags ? tags.split(' ').filter(t => t) : [];

// Ratings stored in localStorage: { url: number }
const RATINGS_KEY = 'trove_ratings';
export const getRatings = (): Record<string, number> => JSON.parse(localStorage.getItem(RATINGS_KEY) || '{}');
const getRating = (url: string): number => getRatings()[url] || 0;
const setRating = (url: string, n: number): void => {
  const ratings = getRatings();
  if (n === 0) { delete ratings[url]; } else { ratings[url] = n; }
  localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
};

// Tag descriptions loaded from tags.jsonl
let tagDescriptions: Record<string, string> = {};
export const getTagDescriptions = (): Record<string, string> => tagDescriptions;

// All known tag names (from tags.jsonl)
let allTagNames: string[] = [];
export const getAllTagNames = (): string[] => allTagNames;

// Store all loaded links for client-side filtering
let allLinks: Link[] = [];
// Store current filtered links for re-sorting
let currentLinks: Link[] = [];
// Store current page tags to exclude from display
let currentPageTags: string[] = [];
export const getCurrentPageTags = (): string[] => currentPageTags;
export const currentPath = () => currentPageTags.length ? '/' + currentPageTags.join('/') : '';
// Track hidden count for current filter
let currentHiddenCount = 0;
// Whether current page truncates display
let currentTruncate = false;
// Whether we're showing hidden links
let showingHidden = false;

// Format date with progressive detail based on recency:
// - Different year    → "2025"
// - Same year         → "2026-01"
// - Same month        → "2026-02-01"
// - Same day          → "2026-02-02 14:30"
const formatDate = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

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

// Format duration from "M:SS" or "H:MM:SS" to compact form: "45s", "3m", "1h45m"
const formatDuration = (dur: string | undefined): string => {
  if (!dur) return '';
  const parts = dur.split(':').map(Number);
  let secs: number, mins: number, hrs: number;
  if (parts.length === 3) { [hrs, mins, secs] = parts; }
  else if (parts.length === 2) { [mins, secs] = parts; hrs = 0; }
  else return dur;
  const total = hrs * 3600 + mins * 60 + secs;
  if (total < 60) return `${total}s`;
  if (total < 3600) return `${Math.floor(total / 60)}m`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return m > 0 ? `${h}h${m}m` : `${h}h`;
};

// Normalize URL: prepend https:// if missing protocol
const normalizeUrl = (url: string): string => {
  if (url && !url.includes('://')) {
    return 'https://' + url;
  }
  return url;
};

function sortLinks(links: Link[], sortBy: string): Link[] {
  const sorted = [...links];
  switch (sortBy) {
    case 'oldest':
      sorted.sort((a, b) => (a.added || '').localeCompare(b.added || ''));
      break;
    case 'alpha':
      sorted.sort((a, b) => (a.title || a.url).toLowerCase().localeCompare((b.title || b.url).toLowerCase()));
      break;
    case 'fewest-tags':
      sorted.sort((a, b) => parseTags(a.tags).length - parseTags(b.tags).length);
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

function renderLinks(links: Link[]): void {
  const container = document.getElementById('links')!;
  const ratings = getRatings();
  container.innerHTML = links.map(link => {
    const allTags = parseTags(link.tags).filter(t => !currentPageTags.includes(t));
    const userTags = allTags.filter(t => isUserTag(t)).sort();
    const regularTags = allTags.filter(t => !isUserTag(t)).sort();
    const tags = [...userTags, ...regularTags];
    let domain = link.url;
    try { domain = new URL(link.url).hostname.replace(/^www\./, ''); } catch {}
    const escapedUrl = link.url.replace(/'/g, "\\'");
    const rating = ratings[link.url] || 0;
    const ratingClass = rating > 0 ? 'positive' : rating < 0 ? 'negative' : 'zero';
    const imgSrc = link.thumbnail || (/\.(jpe?g|png|gif|webp)(\?.*)?$/i.test(link.url) ? link.url : '');
    const imgAlt = (link.title || '').replace(/"/g, '&quot;');
    const metaParts = [domain];
    if (link.added) metaParts.push(formatDate(link.added));
    if (link.duration) metaParts.push(formatDuration(link.duration));
    if (link.channel) metaParts.push(link.channel);
    return `
    <a class="link-anchor" href="${link.url}" target="_blank" rel="noopener" draggable="false">
      <div class="link"
           data-url="${link.url}"
           data-added="${link.added || ''}"
           ${link.title ? `data-title="${link.title.replace(/"/g, '&quot;')}"` : ''}
           ${tags.length ? `data-tags="${tags.join(' ')}"` : ''}>
        <div class="card-body">
          <div class="card-rating">
            <span class="rate-up" onclick="handleRateUp(event, '${escapedUrl}', this)" title="Love">❤️</span>
            <span class="rating-value ${ratingClass}">${rating}</span>
            <span class="rate-down" onclick="handleRateDown(event, '${escapedUrl}', this)" title="Bury">♠️</span>
          </div>
          <div class="card-left">
            <div class="title-row">
              <span class="title">${link.title || link.url}</span>
            </div>
            <span class="meta-line">${metaParts.join(' · ')}</span>
            ${link.notes ? `<div class="notes">${link.notes}</div>` : ''}
            <div class="card-bottom"><span class="tags">${tags.map(t => renderTag(t)).join(' ')}</span><button class="add-tag-btn" onclick="handleAddTagClick(event, this)">+</button></div>
          </div>
          ${imgSrc ? `<div class="card-thumb"><img src="${imgSrc}" alt="${imgAlt}" loading="lazy"></div>` : ''}
          ${isSignedIn() ? `<div class="card-actions"><span class="card-edit-btn" onclick="handleEditCardClick(event, this)">✏️</span><span class="card-delete-btn" onclick="handleDeleteClick(event, '${escapedUrl}', this)">🗑️</span></div>` : ''}
        </div>
      </div>
    </a>`;
  }).join('');
}

function applySort(): void {
  const sortBy = (document.getElementById('sort-select') as HTMLSelectElement).value;
  const sorted = sortLinks(currentLinks, sortBy);
  renderLinks(sorted);
}

// Resolve page config from current route: title, heading, filter, pageTags
function getPageConfig(): PageConfig {
  const tagFilters = getTagFilters();
  const includeTags = tagFilters.filter(t => !t.startsWith('-'));
  const excludeTags = tagFilters.filter(t => t.startsWith('-')).map(t => t.slice(1));

  if (includeTags.includes('_favs')) {
    const ratings = getRatings();
    return {
      title: '_favs - trove',
      heading: '<a href="/" data-nav>trove</a> <span class="breadcrumb-sep">/</span> _favs',
      filter: link => (ratings[link.url] || 0) > 0,
      pageTags: [],
      tagFilters,
      truncate: false,
    };
  }

  if (includeTags.includes('_peeves')) {
    const ratings = getRatings();
    showingHidden = true;
    return {
      title: '_peeves - trove',
      heading: '<a href="/" data-nav>trove</a> <span class="breadcrumb-sep">/</span> _peeves',
      filter: link => (ratings[link.url] || 0) < 0,
      pageTags: [],
      tagFilters,
      truncate: false,
    };
  }

  const tagFilter = (link: Link): boolean => {
    const linkTags = parseTags(link.tags);
    return includeTags.every(tag => linkTags.includes(tag))
        && excludeTags.every(tag => !linkTags.includes(tag));
  };

  if (tagFilters.length > 0) {
    const crumbs = [`<a href="/" data-nav>trove</a>`];
    tagFilters.forEach(t => {
      const label = t.startsWith('-') ? `-${t.slice(1)}` : t;
      crumbs.push(`<a href="/${t}" data-nav>${label}</a>`);
    });
    return {
      title: tagFilters.join('/') + ' - trove',
      heading: crumbs.join(' <span class="breadcrumb-sep">&#x2229;</span> '),
      filter: tagFilter,
      pageTags: tagFilters,
      tagFilters,
      truncate: false,
    };
  }

  return {
    title: 'trove',
    heading: '<a href="/" data-nav>trove</a>',
    filter: tagFilter,
    pageTags: tagFilters,
    tagFilters,
    truncate: true,
  };
}

// Filter allLinks by current URL and render
export function filterAndRender(): void {
  showingHidden = false;
  const container = document.getElementById('links')!;
  const sortControls = document.getElementById('sort-controls')!;
  const timeFilterControls = document.getElementById('time-filter-controls')!;
  const page = getPageConfig();

  // Update heading
  const h1 = document.querySelector('h1')!;
  h1.innerHTML = page.heading;
  document.title = page.title;

  // Apply time filter once for all pages
  timeFilterControls.style.display = 'block';
  const timePeriod = (document.getElementById('time-filter-select') as HTMLSelectElement).value;
  const filteredLinks = filterLinksByTime(allLinks, timePeriod);

  // Apply search filter
  const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
  const query = (searchInput?.value || '').trim().toLowerCase();
  const searchedLinks = query
    ? filteredLinks.filter(link => {
        const title = (link.title || '').toLowerCase();
        const tags = (link.tags || '').toLowerCase();
        const notes = (link.notes || '').toLowerCase();
        return title.includes(query) || tags.includes(query) || notes.includes(query);
      })
    : filteredLinks;

  // Filter links using page-specific filter
  const ratings = getRatings();
  const tagMatchedLinks = searchedLinks.filter(page.filter);

  currentHiddenCount = tagMatchedLinks.filter(link => (ratings[link.url] || 0) < 0).length;
  const visibleLinks = tagMatchedLinks.filter(link => (ratings[link.url] || 0) >= 0);
  const hiddenLinksList = tagMatchedLinks.filter(link => (ratings[link.url] || 0) < 0);
  const links = showingHidden ? hiddenLinksList : visibleLinks;

  if (links.length === 0) {
    sortControls.style.display = 'none';
    timeFilterControls.style.display = 'none';
    renderTagSidebar([], []);
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
  currentPageTags = page.pageTags;
  currentTruncate = page.truncate;
  updateLinkCountDisplay();
  const sortBy = (document.getElementById('sort-select') as HTMLSelectElement).value;
  const sorted = sortLinks(links, sortBy);
  const displayLinks = page.truncate ? sorted.slice(0, 100) : sorted;
  renderLinks(displayLinks);
  renderTagSidebar(links, page.pageTags);
}

function handleRateUp(event: Event, url: string, btn: HTMLElement): void {
  event.preventDefault();
  event.stopPropagation();
  const newRating = getRating(url) + 1;
  setRating(url, newRating);
  const ratingEl = btn.closest('.card-rating')!;
  const valueEl = ratingEl.querySelector('.rating-value')!;
  valueEl.textContent = String(newRating);
  valueEl.className = 'rating-value ' + (newRating > 0 ? 'positive' : newRating < 0 ? 'negative' : 'zero');
}

function handleRateDown(event: Event, url: string, btn: HTMLElement): void {
  event.preventDefault();
  event.stopPropagation();
  const oldRating = getRating(url);
  const newRating = oldRating - 1;
  setRating(url, newRating);
  // If rating just went negative, hide the card (unless showing hidden)
  if (oldRating >= 0 && newRating < 0 && !showingHidden) {
    btn.closest('.link-anchor')!.remove();
    currentLinks = currentLinks.filter(l => l.url !== url);
    currentHiddenCount++;
    updateLinkCountDisplay();
    return;
  }
  const ratingEl = btn.closest('.card-rating')!;
  const valueEl = ratingEl.querySelector('.rating-value')!;
  valueEl.textContent = String(newRating);
  valueEl.className = 'rating-value ' + (newRating > 0 ? 'positive' : newRating < 0 ? 'negative' : 'zero');
}

function toggleShowHidden(): void {
  showingHidden = !showingHidden;
  filterAndRender();
}

function updateLinkCountDisplay(): void {
  const count = currentLinks.length;
  let suffix: string;
  if (showingHidden) {
    suffix = ` (<a href="#" onclick="toggleShowHidden(); return false;">show visible</a>)`;
  } else if (currentHiddenCount > 0) {
    suffix = ` (<a href="#" onclick="toggleShowHidden(); return false;">${currentHiddenCount} hidden</a>)`;
  } else {
    suffix = '';
  }
  const truncated = currentTruncate && count > 100;
  const displayCount = truncated ? 100 : count;
  const truncSuffix = truncated ? ` of ${count}` : '';
  document.getElementById('link-count')!.innerHTML = `${displayCount}${truncSuffix} link${count === 1 ? '' : 's'}${suffix}`;
}

function handleDeleteClick(event: Event, url: string, btn: HTMLElement): void {
  event.preventDefault();
  event.stopPropagation();
  submitToBackend({ action: 'vote_delete', url });
  const anchor = btn.closest('.link-anchor') as HTMLElement;
  anchor.remove();
  currentLinks = currentLinks.filter(l => l.url !== url);
  updateLinkCountDisplay();
}

function handleEditCardClick(event: Event, btn: HTMLElement): void {
  event.preventDefault();
  event.stopPropagation();

  const linkEl = btn.closest('.link') as HTMLElement;
  const url = linkEl.dataset.url!;
  const oldTitle = linkEl.dataset.title || '';
  const oldTags = linkEl.dataset.tags || '';

  // Prevent link navigation while editing
  const anchor = linkEl.closest('.link-anchor') as HTMLAnchorElement;
  const blockClick = (ev: Event) => { ev.preventDefault(); };
  anchor.addEventListener('click', blockClick);
  linkEl.classList.add('editing');

  // Replace title with input
  const titleRow = linkEl.querySelector('.title-row') as HTMLElement;
  const titleRowHTML = titleRow.innerHTML;
  titleRow.innerHTML = `<input class="edit-title-input" value="${oldTitle.replace(/"/g, '&quot;')}">`;
  const titleInput = titleRow.querySelector('.edit-title-input') as HTMLInputElement;

  // Replace tags + add-btn with tags input
  const cardBottom = linkEl.querySelector('.card-bottom') as HTMLElement;
  const cardBottomHTML = cardBottom.innerHTML;
  cardBottom.style.position = 'relative';
  cardBottom.innerHTML = `<input class="edit-tags-input" value="${oldTags.replace(/"/g, '&quot;')}" placeholder="space-separated tags"><div class="tag-autocomplete-dropdown"></div>`;
  const tagsInput = cardBottom.querySelector('.edit-tags-input') as HTMLInputElement;
  const tagsDropdown = cardBottom.querySelector('.tag-autocomplete-dropdown') as HTMLElement;
  initAutocomplete(tagsInput, tagsDropdown, () => getAllTagNames());

  // Add stacked action buttons between card-left and thumbnail
  const cardLeft = linkEl.querySelector('.card-left') as HTMLElement;
  const actionsCol = document.createElement('div');
  actionsCol.className = 'edit-card-actions';
  actionsCol.innerHTML = `<button class="vote-delete-btn" title="Vote for deletion">🗑️</button><button class="edit-save-btn">Save</button><button class="edit-cancel-btn">Cancel</button>`;
  cardLeft.insertAdjacentElement('afterend', actionsCol);

  const cancel = () => {
    titleRow.innerHTML = titleRowHTML;
    cardBottom.innerHTML = cardBottomHTML;
    cardBottom.style.position = '';
    actionsCol.remove();
    linkEl.classList.remove('editing');
    anchor.removeEventListener('click', blockClick);
  };

  const save = () => {
    const newTitle = titleInput.value.trim();
    const newTags = tagsInput.value.trim().split(/\s+/).filter(t => t).join(' ');

    if (newTitle && newTitle !== oldTitle) {
      linkEl.dataset.title = newTitle;
      submitToBackend({ action: 'set_title', url, title: newTitle });
    }

    const oldTagSet = new Set(oldTags.split(/\s+/).filter(t => t));
    const newTagSet = new Set(newTags.split(/\s+/).filter(t => t));
    const creds2 = getCredentials();
    const currentUser2 = creds2?.username || '';
    const addedTags = [...newTagSet].filter(t => !oldTagSet.has(t) && (!isUserTag(t) || userTagUsername(t) === currentUser2));
    const removedTags = [...oldTagSet].filter(t => !newTagSet.has(t));
    if (addedTags.length > 0) {
      submitToBackend({ action: 'add_tag', url, tags: addedTags.join(' ') });
    }
    for (const tag of removedTags) {
      submitToBackend({ action: 'remove_tag', url, tags: tag });
    }

    linkEl.dataset.tags = newTags;
    cancel();

    // Update restored DOM with new values
    const titleEl = linkEl.querySelector('.title') as HTMLElement | null;
    if (titleEl && newTitle) titleEl.textContent = newTitle;
    const tagsEl = linkEl.querySelector('.tags') as HTMLElement | null;
    if (tagsEl) {
      const displayTags = newTags.split(/\s+/).filter(t => t && !currentPageTags.includes(t)).sort();
      tagsEl.innerHTML = displayTags.map(t => renderTag(t)).join(' ');
    }
  };

  actionsCol.querySelector('.edit-cancel-btn')!.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); cancel(); });
  actionsCol.querySelector('.edit-save-btn')!.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); save(); });
  actionsCol.querySelector('.vote-delete-btn')!.addEventListener('click', (e) => { handleDeleteClick(e, url, actionsCol); });

  titleInput.focus();
}

export async function submitToBackend(fields: Record<string, string>): Promise<void> {
  const creds = getCredentials();
  if (!creds) { showSignIn(true); return; }
  try {
    await fetch('/.netlify/functions/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, username: creds.username, password: creds.password }),
    });
  } catch (e) {
    console.error('Failed to submit:', e);
  }
}

async function loadLinks(): Promise<void> {
  const container = document.getElementById('links')!;

  try {
    const response = await fetch('/trove.jsonl');
    const text = await response.text();
    allLinks = text.trim().split('\n').filter(line => line).map(line => {
      const link: Link = JSON.parse(line);
      link.url = normalizeUrl(link.url);
      return link;
    });

    filterAndRender();
  } catch (err) {
    container.innerHTML = '<div class="empty">Failed to load links.</div>';
    console.error(err);
  }
}

function signOut(): void {
  clearCredentials();
  document.getElementById('auth-signout')!.style.display = 'none';
  document.getElementById('auth-btn')!.style.display = '';
  updateBookmarkletHref();

  if (currentLinks.length > 0) {
    applySort();
  }
}

function onAuthSuccess(username: string): void {
  document.getElementById('auth-signout')!.style.display = '';
  document.getElementById('auth-btn')!.style.display = 'none';
  updateBookmarkletHref();

  if (currentLinks.length > 0) {
    applySort();
  }
}

// Handle browser back/forward navigation
window.addEventListener('popstate', () => {
  if (allLinks.length > 0) {
    filterAndRender();
  }
});

// Handle hash changes for #/tags route
window.addEventListener('hashchange', () => {
  if (allLinks.length > 0) {
    filterAndRender();
  }
});

// Set bookmarklet link href with current origin
function updateBookmarkletHref(): void {
  const link = document.getElementById('bookmarklet') as HTMLAnchorElement | null;
  if (!link) return;
  const origin = location.origin;
  const creds = getCredentials();
  const userVar = creds ? JSON.stringify(creds.username) : '""';
  const passVar = creds ? JSON.stringify(creds.password) : '""';
  link.href = `javascript:void((function(){var __TROVE_ORIGIN__=${JSON.stringify(origin)},__TROVE_URL__=location.href,__TROVE_TITLE__=document.title,__TROVE_SEL__=(window.getSelection()||"").toString(),__TROVE_USER__=${userVar},__TROVE_PASS__=${passVar};${bookmarkletCode}})())`;
}

// Check for existing credentials on page load
function initAuth(): void {
  const creds = getCredentials();
  if (creds) {
    onAuthSuccess(creds.username);
  }
}

// Handle breadcrumb navigation without page reload
function initBreadcrumbNav(): void {
  document.querySelector('h1')!.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest('a[data-nav]') as HTMLAnchorElement | null;
    if (link) {
      e.preventDefault();
      history.pushState(null, '', link.getAttribute('href')!);
      filterAndRender();
    }
  });
}

// Expose functions to global scope for onclick handlers in HTML
declare const window: Window & {
  handleRateUp: typeof handleRateUp;
  handleRateDown: typeof handleRateDown;
  toggleShowHidden: typeof toggleShowHidden;
  handleDeleteClick: typeof handleDeleteClick;
  handleEditCardClick: typeof handleEditCardClick;
  handleAddTagClick: typeof handleAddTagClick;
  showSignIn: typeof showSignIn;
  handleSignIn: () => void;
  signOut: typeof signOut;
  togglePasswordVisibility: typeof togglePasswordVisibility;
  applySort: typeof applySort;
  filterAndRender: typeof filterAndRender;
};

(window as any).handleRateUp = handleRateUp;
(window as any).handleRateDown = handleRateDown;
(window as any).toggleShowHidden = toggleShowHidden;
(window as any).handleDeleteClick = handleDeleteClick;
(window as any).handleEditCardClick = handleEditCardClick;
(window as any).handleAddTagClick = handleAddTagClick;
(window as any).showSignIn = showSignIn;
(window as any).handleSignIn = () => handleSignIn(onAuthSuccess);
(window as any).signOut = signOut;
(window as any).togglePasswordVisibility = togglePasswordVisibility;
(window as any).applySort = applySort;
(window as any).filterAndRender = filterAndRender;

// Load tag descriptions from tags.jsonl
async function loadTagDescriptions(): Promise<void> {
  try {
    const resp = await fetch('/tags.jsonl');
    if (!resp.ok) return;
    const text = await resp.text();
    const names: string[] = [];
    text.trim().split('\n').filter(l => l).forEach(line => {
      const obj = JSON.parse(line);
      names.push(obj.tag);
      if (obj.description) tagDescriptions[obj.tag] = obj.description;
    });
    allTagNames = names;
  } catch {}
}

// Initialize on page load
updateBookmarkletHref();
initAuth();
initSignInForm(() => handleSignIn(onAuthSuccess));
if (document.getElementById('links')) {
  initBreadcrumbNav();
  initTagMenu();
  initSidebarTagMenu();
  loadTagDescriptions();
  loadLinks();
}
