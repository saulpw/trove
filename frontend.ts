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
const parseTags = (tags: string | undefined): string[] => tags ? tags.split(' ').filter(t => t) : [];

// Ratings stored in localStorage: { url: number }
const RATINGS_KEY = 'trove_ratings';
const getRatings = (): Record<string, number> => JSON.parse(localStorage.getItem(RATINGS_KEY) || '{}');
const getRating = (url: string): number => getRatings()[url] || 0;
const setRating = (url: string, n: number): void => {
  const ratings = getRatings();
  if (n === 0) { delete ratings[url]; } else { ratings[url] = n; }
  localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
};

// Store all loaded links for client-side filtering
let allLinks: Link[] = [];
// Store current filtered links for re-sorting
let currentLinks: Link[] = [];
// Store current page tags to exclude from display
let currentPageTags: string[] = [];
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

function renderTag(t: string, currentPath: string): string {
  const renameOpt = isSignedIn() ? `<span class="rename-tag-trigger" data-tag="${t}">✎ rename</span>` : '';
  return `<span class="tag-wrap"><span class="tag" data-tag="${t}">#${t}</span><span class="tag-menu"><span data-href="/${t}">→ /${t}</span><span data-href="${currentPath}/${t}">+ ${currentPath}/${t}</span><span data-href="${currentPath}/-${t}">− ${currentPath}/-${t}</span>${renameOpt}</span></span>`;
}

function renderLinks(links: Link[]): void {
  const container = document.getElementById('links')!;
  const currentPath = '/' + currentPageTags.join('/');
  const ratings = getRatings();
  container.innerHTML = links.map(link => {
    const tags = parseTags(link.tags).filter(t => !currentPageTags.includes(t)).sort();
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
    <a class="link-anchor" href="${link.url}" target="_blank" rel="noopener">
      <div class="link"
           data-url="${link.url}"
           data-added="${link.added || ''}"
           ${link.title ? `data-title="${link.title.replace(/"/g, '&quot;')}"` : ''}
           ${tags.length ? `data-tags="${tags.join(' ')}"` : ''}>
        <div class="card-body">
          <div class="card-rating">
            <span class="rate-up" onclick="handleRateUp(event, '${escapedUrl}', this)">❤️</span>
            <span class="rating-value ${ratingClass}">${rating}</span>
            <span class="rate-down" onclick="handleRateDown(event, '${escapedUrl}', this)">💣</span>
          </div>
          <div class="card-left">
            <div class="title-row">
              <span class="title">${link.title || link.url}</span>
              ${isSignedIn() ? `<span class="edit-title-btn" onclick="handleEditTitleClick(event, this)">✏️</span>` : ''}
            </div>
            <span class="meta-line">${metaParts.join(' · ')}</span>
            ${link.notes ? `<div class="notes">${link.notes}</div>` : ''}
            <div class="card-bottom"><span class="tags">${tags.map(t => renderTag(t, currentPath)).join(' ')}</span><button class="add-tag-btn" onclick="handleAddTagClick(event, this)">+</button></div>
          </div>
          ${imgSrc ? `<div class="card-thumb"><img src="${imgSrc}" alt="${imgAlt}" loading="lazy"></div>` : ''}
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

// Navigate to a tag without full page reload
function navigateToTag(tag: string): void {
  history.pushState(null, '', '/' + tag);
  filterAndRender();
}

// Set up tag click handlers (delegated)
function initTagMenu(): void {
  document.getElementById('links')!.addEventListener('click', (e) => {
    const renameTrigger = (e.target as HTMLElement).closest('.rename-tag-trigger') as HTMLElement | null;
    if (renameTrigger) {
      e.preventDefault();
      e.stopPropagation();
      const tagName = renameTrigger.dataset.tag!;
      const linkEl = renameTrigger.closest('.link') as HTMLElement;
      handleRenameTagClick(tagName, linkEl);
      return;
    }
    const menuItem = (e.target as HTMLElement).closest('.tag-menu [data-href]') as HTMLElement | null;
    const tag = (e.target as HTMLElement).closest('.tag[data-tag]') as HTMLElement | null;
    if (menuItem) {
      e.preventDefault();
      e.stopPropagation();
      history.pushState(null, '', menuItem.dataset.href!);
      filterAndRender();
    } else if (tag) {
      e.preventDefault();
      e.stopPropagation();
      navigateToTag(tag.dataset.tag!);
    }
  });
}

function renderTagSidebar(links: Array<{ tags?: string }>, pageTags: string[]): void {
  const sidebar = document.getElementById('tag-sidebar')!;
  const tagCounts: Record<string, number> = {};
  links.forEach(link => {
    parseTags(link.tags).forEach(tag => {
      if (!pageTags.includes(tag)) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    });
  });
  const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (sorted.length === 0) {
    sidebar.innerHTML = '';
    sidebar.style.display = 'none';
    return;
  }
  sidebar.style.display = '';
  const pseudoTags = `<span class="sidebar-tag sidebar-pseudo" data-tag="_favs"><span class="tag">#_favs</span></span><span class="sidebar-tag sidebar-pseudo" data-tag="_peeves"><span class="tag">#_peeves</span></span>`;
  sidebar.innerHTML = pseudoTags + sorted.map(([tag, count]) =>
    `<span class="sidebar-tag" data-tag="${tag}"><span class="tag">#${tag}</span> <span class="sidebar-count">(${count})</span></span>`
  ).join('') + `<div class="sidebar-menu"></div>`;
}

function closeSidebarMenu(): void {
  const menu = document.querySelector('#tag-sidebar .sidebar-menu') as HTMLElement & { _tag?: string } | null;
  if (menu) { menu.classList.remove('open'); menu._tag = undefined; }
}

function initSidebarTagMenu(): void {
  const sidebar = document.getElementById('tag-sidebar')!;
  sidebar.addEventListener('click', (e) => {
    const renameTrigger = (e.target as HTMLElement).closest('.sidebar-menu .rename-tag-trigger') as HTMLElement | null;
    if (renameTrigger) {
      e.preventDefault();
      e.stopPropagation();
      const tagName = renameTrigger.dataset.tag!;
      closeSidebarMenu();
      handleRenameSidebarTag(tagName);
      return;
    }
    const menuItem = (e.target as HTMLElement).closest('.sidebar-menu [data-href]') as HTMLElement | null;
    if (menuItem) {
      e.preventDefault();
      e.stopPropagation();
      closeSidebarMenu();
      history.pushState(null, '', menuItem.dataset.href!);
      filterAndRender();
      return;
    }
    const tagEl = (e.target as HTMLElement).closest('.sidebar-tag[data-tag]') as HTMLElement | null;
    if (tagEl) {
      e.preventDefault();
      e.stopPropagation();
      // Pseudo-tags navigate directly
      if (tagEl.classList.contains('sidebar-pseudo')) {
        history.pushState(null, '', '/' + tagEl.dataset.tag!);
        filterAndRender();
        return;
      }
      const menu = sidebar.querySelector('.sidebar-menu') as HTMLElement & { _tag?: string; _entered?: boolean };
      const tag = tagEl.dataset.tag!;
      if (menu._tag === tag) {
        closeSidebarMenu();
        return;
      }
      const currentPath = '/' + currentPageTags.join('/');
      const renameOpt = isSignedIn() ? `<span class="rename-tag-trigger" data-tag="${tag}">✎ rename</span>` : '';
      menu.innerHTML = `<span data-href="/${tag}">→ /${tag}</span><span data-href="${currentPath}/${tag}">+ ${currentPath}/${tag}</span><span data-href="${currentPath}/-${tag}">− ${currentPath}/-${tag}</span>${renameOpt}`;
      // Position menu next to the clicked tag
      const tagRect = tagEl.getBoundingClientRect();
      const sidebarRect = sidebar.getBoundingClientRect();
      menu.style.top = (tagRect.top - sidebarRect.top + tagRect.height) + 'px';
      menu._tag = tag;
      menu._entered = false;
      menu.classList.add('open');
    }
  });
  sidebar.addEventListener('mouseenter', (e) => {
    const menu = sidebar.querySelector('.sidebar-menu') as HTMLElement & { _entered?: boolean } | null;
    if (menu && e.target === menu) menu._entered = true;
  }, true);
  sidebar.addEventListener('mouseleave', (e) => {
    const menu = sidebar.querySelector('.sidebar-menu') as HTMLElement & { _entered?: boolean } | null;
    if (menu && e.target === menu && menu._entered) closeSidebarMenu();
  }, true);
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('#tag-sidebar')) closeSidebarMenu();
  });
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
      pageTags: includeTags,
      tagFilters,
      truncate: false,
    };
  }

  return {
    title: 'trove',
    heading: '<a href="/" data-nav>trove</a>',
    filter: tagFilter,
    pageTags: includeTags,
    tagFilters,
    truncate: true,
  };
}

// Filter allLinks by current URL and render
function filterAndRender(): void {
  showingHidden = false;
  const container = document.getElementById('links')!;
  const sortControls = document.getElementById('sort-controls')!;
  const timeFilterControls = document.getElementById('time-filter-controls')!;
  const page = getPageConfig();

  // Pre-populate tags input with current filters (exclude negated tags)
  const tagsInput = document.getElementById('link-tags') as HTMLInputElement | null;
  if (tagsInput) tagsInput.value = page.pageTags.join(' ');

  // Update heading
  const h1 = document.querySelector('h1')!;
  h1.innerHTML = page.heading;
  document.title = page.title;

  // Apply time filter once for all pages
  timeFilterControls.style.display = 'block';
  const timePeriod = (document.getElementById('time-filter-select') as HTMLSelectElement).value;
  const filteredLinks = filterLinksByTime(allLinks, timePeriod);

  // Filter links using page-specific filter
  const ratings = getRatings();
  const tagMatchedLinks = filteredLinks.filter(page.filter);

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

function handleEditTitleClick(event: Event, btn: HTMLElement): void {
  event.preventDefault();
  event.stopPropagation();

  const linkEl = btn.closest('.link') as HTMLElement;
  const titleEl = linkEl.querySelector('.title') as HTMLElement;
  const url = linkEl.dataset.url!;
  const currentTitle = linkEl.dataset.title || '';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'edit-title-input';
  input.value = currentTitle;

  const cancel = () => { input.remove(); titleEl.style.display = ''; btn.style.display = ''; };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== currentTitle) {
        titleEl.textContent = newTitle;
        linkEl.dataset.title = newTitle;
        cancel();
        submitToBackend({ url, title: newTitle });
      } else { cancel(); }
    } else if (e.key === 'Escape') { cancel(); }
  });

  input.addEventListener('blur', () => { setTimeout(() => { if (document.body.contains(input)) cancel(); }, 100); });

  titleEl.style.display = 'none';
  btn.style.display = 'none';
  titleEl.parentNode!.insertBefore(input, titleEl);
  input.focus();
  input.select();
}

function handleAddTagClick(event: Event, btn: HTMLElement): void {
  event.preventDefault();
  event.stopPropagation();

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'add-tag-input';
  input.placeholder = 'tag tag...';

  const linkEl = btn.closest('.link') as HTMLElement;
  const url = linkEl.dataset.url!;

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
  btn.parentNode!.insertBefore(input, btn);
  input.focus();
}

function restoreAddButton(input: HTMLInputElement, btn: HTMLElement): void {
  if (input.parentNode) {
    input.remove();
  }
  btn.style.display = '';
}

async function submitToBackend(fields: Record<string, string>): Promise<void> {
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

async function submitTagsForLink(url: string, tags: string, linkEl: HTMLElement, input: HTMLInputElement, btn: HTMLElement): Promise<void> {
  // Optimistically add tags to UI
  const tagsEl = linkEl.querySelector('.tags')!;
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
  submitToBackend({ url, tags });
}

function showRenameInput(hideEl: HTMLElement, tagName: string, onConfirm: (newTags: string[]) => void): void {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'rename-tag-input';
  input.value = tagName;

  const cancel = () => { input.remove(); hideEl.style.display = ''; };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const newTagStr = input.value.trim();
      if (newTagStr && newTagStr !== tagName) {
        onConfirm(newTagStr.split(/\s+/).filter(t => t));
        cancel();
      } else { cancel(); }
    } else if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
  });

  input.addEventListener('blur', () => { setTimeout(() => { if (document.body.contains(input)) cancel(); }, 100); });

  hideEl.style.display = 'none';
  hideEl.parentNode!.insertBefore(input, hideEl);
  input.focus();
  input.select();
}

function handleRenameTagClick(tagName: string, linkEl: HTMLElement): void {
  const tagWrap = linkEl.querySelector(`.tag-wrap .tag[data-tag="${tagName}"]`)!.closest('.tag-wrap') as HTMLElement;
  showRenameInput(tagWrap, tagName, (newTags) => {
    const currentPath = '/' + currentPageTags.join('/');
    newTags.forEach(t => {
      tagWrap.insertAdjacentHTML('beforebegin', renderTag(t, currentPath) + ' ');
    });
    tagWrap.remove();
    const oldTags = (linkEl.dataset.tags || '').split(' ').filter(t => t);
    linkEl.dataset.tags = oldTags.filter(t => t !== tagName).concat(newTags).join(' ');
    submitToBackend({ action: 'rename_tag', remove_tag: tagName, add_tags: newTags.join(' '), urls: linkEl.dataset.url! });
  });
}

function handleRenameSidebarTag(tagName: string): void {
  const sidebar = document.getElementById('tag-sidebar')!;
  const sidebarTag = sidebar.querySelector(`.sidebar-tag[data-tag="${tagName}"]`) as HTMLElement | null;
  if (!sidebarTag) return;

  showRenameInput(sidebarTag, tagName, (newTags) => {
    const currentPath = '/' + currentPageTags.join('/');
    const affectedUrls: string[] = [];

    document.querySelectorAll<HTMLElement>('#links .link').forEach(linkEl => {
      const tags = (linkEl.dataset.tags || '').split(' ').filter(t => t);
      if (!tags.includes(tagName)) return;
      affectedUrls.push(linkEl.dataset.url!);
      const updatedTags = tags.filter(t => t !== tagName).concat(newTags);
      linkEl.dataset.tags = updatedTags.join(' ');
      linkEl.querySelector('.tags')!.innerHTML = updatedTags.filter(t => !currentPageTags.includes(t)).map(t => renderTag(t, currentPath)).join(' ');
    });

    const visibleLinks: Array<{ tags: string }> = [];
    document.querySelectorAll<HTMLElement>('#links .link').forEach(linkEl => {
      visibleLinks.push({ tags: linkEl.dataset.tags || '' });
    });
    renderTagSidebar(visibleLinks, currentPageTags);

    if (affectedUrls.length > 0) {
      submitToBackend({ action: 'rename_tag', remove_tag: tagName, add_tags: newTags.join(' '), urls: affectedUrls.join(' ') });
    }
  });
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

// Auth: per-user password stored in localStorage
const CREDS_KEY = 'trove_credentials';

interface Credentials {
  username: string;
  password: string;
}

function getCredentials(): Credentials | null {
  const stored = localStorage.getItem(CREDS_KEY);
  if (!stored) return null;
  try { return JSON.parse(stored); } catch { return null; }
}

function saveCredentials(username: string, password: string): void {
  localStorage.setItem(CREDS_KEY, JSON.stringify({ username, password }));
}

function clearCredentials(): void {
  localStorage.removeItem(CREDS_KEY);
}

function isSignedIn(): boolean {
  return getCredentials() !== null;
}

function togglePasswordVisibility(): void {
  const input = document.getElementById('auth-password') as HTMLInputElement;
  const svg = input.nextElementSibling!.querySelector('svg')!;
  const shut = svg.querySelector('.eye-shut') as HTMLElement;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  shut.style.display = isHidden ? '' : 'none';
}

function showSignIn(show: boolean): void {
  const overlay = document.getElementById('signin-overlay')!;
  overlay.style.display = show ? 'flex' : 'none';
  if (show) (document.getElementById('auth-username') as HTMLInputElement).focus();
}

async function handleSignIn(): Promise<void> {
  const username = (document.getElementById('auth-username') as HTMLInputElement).value.trim();
  const password = (document.getElementById('auth-password') as HTMLInputElement).value;
  const status = document.getElementById('auth-status')!;

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
      showSignIn(false);
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

  if (!bookmarkletMode && currentLinks.length > 0) {
    applySort();
  }
}

async function submitLink(): Promise<void> {
  const urlInput = document.getElementById('link-url') as HTMLInputElement;
  const tagsInput = document.getElementById('link-tags') as HTMLInputElement;
  const notesInput = document.getElementById('link-notes') as HTMLTextAreaElement;
  const status = document.getElementById('submit-status')!;
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
    showSignIn(true);
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

// Tag autocomplete
let allTags: string[] = [];

async function loadTags(): Promise<void> {
  try {
    const resp = await fetch('/tags.json');
    if (resp.ok) allTags = await resp.json();
  } catch {}
}

function initTagAutocomplete(): void {
  const input = document.getElementById('link-tags') as HTMLInputElement | null;
  const dropdown = document.getElementById('tag-suggestions') as HTMLElement | null;
  if (!input || !dropdown) return;
  initAutocomplete(input, dropdown, () => allTags);
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

// Bookmarklet popup mode
let bookmarkletMode = false;

function getUrlParams(): { submit: boolean; url: string } {
  const params = new URLSearchParams(window.location.search);
  return {
    submit: params.get('submit') === '1',
    url: params.get('url') || '',
  };
}

function initBookmarkletMode(): boolean {
  const params = getUrlParams();
  if (!params.submit) return false;

  bookmarkletMode = true;
  document.body.classList.add('bookmarklet-mode');

  // Hide main content, show only add form
  document.getElementById('sort-controls')!.style.display = 'none';
  document.getElementById('link-count')!.style.display = 'none';
  document.getElementById('links')!.style.display = 'none';

  // Pre-fill URL
  (document.getElementById('link-url') as HTMLInputElement).value = params.url;

  return true;
}

// Set bookmarklet link href with current origin
function initBookmarkletLink(): void {
  const link = document.getElementById('bookmarklet') as HTMLAnchorElement | null;
  if (!link) return;
  updateBookmarkletHref();
}

function updateBookmarkletHref(): void {
  const link = document.getElementById('bookmarklet') as HTMLAnchorElement | null;
  if (!link) return;
  const origin = location.origin;
  const creds = getCredentials();
  const userAttr = creds ? `s.dataset.troveUser=${JSON.stringify(creds.username)};s.dataset.trovePass=${JSON.stringify(creds.password)};` : '';
  link.href = `javascript:void(function(){var s=document.createElement('script');s.dataset.troveOrigin=${JSON.stringify(origin)};s.dataset.troveUrl=location.href;s.dataset.troveSelection=window.getSelection().toString();${userAttr}s.src=${JSON.stringify(origin+'/bookmarklet.js')};document.body.appendChild(s);}())`;
}

// Check for existing credentials on page load
function initAuth(): void {
  const creds = getCredentials();
  if (creds) {
    onAuthSuccess(creds.username);
  }
}

// Allow Enter key to submit sign-in form, Escape to close
function initSignInForm(): void {
  const overlay = document.getElementById('signin-overlay');
  if (overlay) {
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); handleSignIn(); }
      else if (e.key === 'Escape') { showSignIn(false); }
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) showSignIn(false);
    });
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
  handleEditTitleClick: typeof handleEditTitleClick;
  handleAddTagClick: typeof handleAddTagClick;
  showSignIn: typeof showSignIn;
  handleSignIn: typeof handleSignIn;
  signOut: typeof signOut;
  togglePasswordVisibility: typeof togglePasswordVisibility;
  submitLink: typeof submitLink;
  applySort: typeof applySort;
  filterAndRender: typeof filterAndRender;
};

(window as any).handleRateUp = handleRateUp;
(window as any).handleRateDown = handleRateDown;
(window as any).toggleShowHidden = toggleShowHidden;
(window as any).handleEditTitleClick = handleEditTitleClick;
(window as any).handleAddTagClick = handleAddTagClick;
(window as any).showSignIn = showSignIn;
(window as any).handleSignIn = handleSignIn;
(window as any).signOut = signOut;
(window as any).togglePasswordVisibility = togglePasswordVisibility;
(window as any).submitLink = submitLink;
(window as any).applySort = applySort;
(window as any).filterAndRender = filterAndRender;

// Initialize on page load
initBookmarkletLink();
initAuth();
initSignInForm();
loadTags();
initTagAutocomplete();
if (document.getElementById('links') && !initBookmarkletMode()) {
  initBreadcrumbNav();
  initTagMenu();
  initSidebarTagMenu();
  loadLinks();
}
