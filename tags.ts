// Tag sidebar, tag menus, and tag editing operations

import { isSignedIn } from './auth';
import { getCurrentPageTags, currentPath, parseTags, submitToBackend, filterAndRender, getRatings, getTagDescriptions } from './frontend';

function renderTagMenu(tag: string, opts?: { sidebar?: boolean }): string {
  const path = currentPath();
  const pathDisplay = path.slice(1);
  const editOpt = opts?.sidebar && isSignedIn() ? `<span class="edit-tag-trigger" data-tag="${tag}">✎ edit</span>` : '';
  const addLabel = pathDisplay ? `${pathDisplay} ∩ ${tag}` : tag;
  const excludeLabel = pathDisplay ? `${pathDisplay} ∩ ~${tag}` : `~${tag}`;
  return `<span data-href="${path}/${tag}">${addLabel}</span><span data-href="${path}/-${tag}">${excludeLabel}</span>${editOpt}`;
}

export function renderTag(t: string): string {
  return `<span class="tag-wrap"><span class="tag" data-tag="${t}">#${t}</span><span class="tag-menu">${renderTagMenu(t)}</span></span>`;
}

export function renderTagSidebar(links: Array<{ url: string; tags?: string }>, pageTags: string[]): void {
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
  const ratings = getRatings();
  let favsCount = 0, peevesCount = 0;
  links.forEach(link => {
    const r = ratings[link.url] || 0;
    if (r > 0) favsCount++;
    if (r < 0) peevesCount++;
  });
  const pseudoTags = (favsCount > 0 ? `<span class="sidebar-tag sidebar-pseudo" data-tag="_favs"><span class="tag">\u2665</span> <span class="sidebar-count">(${favsCount})</span></span>` : '')
    + (peevesCount > 0 ? `<span class="sidebar-tag sidebar-pseudo" data-tag="_peeves"><span class="tag">\u2660</span> <span class="sidebar-count">(${peevesCount})</span></span>` : '');
  const descs = getTagDescriptions();
  sidebar.innerHTML = pseudoTags + sorted.map(([tag, count]) => {
    const desc = descs[tag];
    const titleAttr = desc ? ` title="${desc.replace(/"/g, '&quot;')}"` : '';
    return `<span class="sidebar-tag" data-tag="${tag}"${titleAttr}><span class="tag">#${tag}</span> <span class="sidebar-count">(${count})</span></span>`;
  }).join('') + `<div class="sidebar-menu"></div>`;
}

export function closeSidebarMenu(): void {
  const menu = document.querySelector('#tag-sidebar .sidebar-menu') as HTMLElement & { _tag?: string } | null;
  if (menu) { menu.classList.remove('open'); menu._tag = undefined; }
}

export function initSidebarTagMenu(): void {
  const sidebar = document.getElementById('tag-sidebar')!;
  sidebar.addEventListener('click', (e) => {
    const editTrigger = (e.target as HTMLElement).closest('.sidebar-menu .edit-tag-trigger') as HTMLElement | null;
    if (editTrigger) {
      e.preventDefault();
      e.stopPropagation();
      const tagName = editTrigger.dataset.tag!;
      closeSidebarMenu();
      handleEditSidebarTag(tagName);
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
      menu.innerHTML = renderTagMenu(tag, { sidebar: true });
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

// Navigate to a tag without full page reload
function navigateToTag(tag: string): void {
  history.pushState(null, '', '/' + tag);
  filterAndRender();
}

export function initTagMenu(): void {
  document.getElementById('links')!.addEventListener('click', (e) => {
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

export function handleAddTagClick(event: Event, btn: HTMLElement): void {
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

async function submitTagsForLink(url: string, tags: string, linkEl: HTMLElement, input: HTMLInputElement, btn: HTMLElement): Promise<void> {
  const pageTags = getCurrentPageTags();
  const tagsEl = linkEl.querySelector('.tags')!;
  const newTags = tags.split(' ').filter(t => t && !pageTags.includes(t));

  newTags.forEach(t => {
    tagsEl.insertAdjacentHTML('beforeend', renderTag(t) + ' ');
  });

  restoreAddButton(input, btn);
  submitToBackend({ action: 'add_tag', url, tags });
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

function handleRemoveTag(tagName: string, linkEl: HTMLElement): void {
  const tagWrap = linkEl.querySelector(`.tag-wrap .tag[data-tag="${tagName}"]`)?.closest('.tag-wrap') as HTMLElement | null;
  if (tagWrap) tagWrap.remove();
  const oldTags = (linkEl.dataset.tags || '').split(' ').filter(t => t);
  linkEl.dataset.tags = oldTags.filter(t => t !== tagName).join(' ');
  submitToBackend({ action: 'remove_tag', url: linkEl.dataset.url!, tags: tagName });
}

function handleRenameTagClick(tagName: string, linkEl: HTMLElement): void {
  const tagWrap = linkEl.querySelector(`.tag-wrap .tag[data-tag="${tagName}"]`)!.closest('.tag-wrap') as HTMLElement;
  showRenameInput(tagWrap, tagName, (newTags) => {
    newTags.forEach(t => {
      tagWrap.insertAdjacentHTML('beforebegin', renderTag(t) + ' ');
    });
    tagWrap.remove();
    const oldTags = (linkEl.dataset.tags || '').split(' ').filter(t => t);
    linkEl.dataset.tags = oldTags.filter(t => t !== tagName).concat(newTags).join(' ');
    submitToBackend({ action: 'rename_tag', remove_tag: tagName, add_tags: newTags.join(' '), urls: linkEl.dataset.url! });
  });
}

function renameTagGlobally(tagName: string, newTags: string[]): void {
  const pageTags = getCurrentPageTags();
  const affectedUrls: string[] = [];
  document.querySelectorAll<HTMLElement>('#links .link').forEach(linkEl => {
    const tags = (linkEl.dataset.tags || '').split(' ').filter(t => t);
    if (!tags.includes(tagName)) return;
    affectedUrls.push(linkEl.dataset.url!);
    const updatedTags = tags.filter(t => t !== tagName).concat(newTags);
    linkEl.dataset.tags = updatedTags.join(' ');
    linkEl.querySelector('.tags')!.innerHTML = updatedTags.filter(t => !pageTags.includes(t)).map(t => renderTag(t)).join(' ');
  });
  const visibleLinks: Array<{ url: string; tags: string }> = [];
  document.querySelectorAll<HTMLElement>('#links .link').forEach(linkEl => {
    visibleLinks.push({ url: linkEl.dataset.url || '', tags: linkEl.dataset.tags || '' });
  });
  renderTagSidebar(visibleLinks, pageTags);
  if (affectedUrls.length > 0) {
    submitToBackend({ action: 'rename_tag', remove_tag: tagName, add_tags: newTags.join(' '), urls: affectedUrls.join(' ') });
  }
}

function handleEditSidebarTag(tagName: string): void {
  const overlay = document.getElementById('edit-tag-overlay')!;
  const nameInput = document.getElementById('edit-tag-name') as HTMLInputElement;
  const descInput = document.getElementById('edit-tag-desc') as HTMLTextAreaElement;
  const descs = getTagDescriptions();

  nameInput.value = tagName;
  descInput.value = descs[tagName] || '';
  overlay.style.display = '';

  const close = () => { overlay.style.display = 'none'; };

  const onSave = () => {
    const newName = nameInput.value.trim();
    const newDesc = descInput.value.trim();
    close();

    if (newDesc !== (descs[tagName] || '')) {
      const effectiveTag = newName || tagName;
      if (newDesc) descs[effectiveTag] = newDesc;
      else delete descs[effectiveTag];
      submitToBackend({ action: 'set_tag_desc', tag: effectiveTag, description: newDesc });
    }

    if (newName && newName !== tagName) {
      renameTagGlobally(tagName, newName.split(/\s+/).filter(t => t));
    } else {
      // Update tooltip in place
      const el = document.querySelector(`#tag-sidebar .sidebar-tag[data-tag="${tagName}"]`) as HTMLElement | null;
      if (el) newDesc ? el.title = newDesc : el.removeAttribute('title');
    }
  };

  document.getElementById('edit-tag-save')!.onclick = onSave;
  document.getElementById('edit-tag-cancel')!.onclick = close;
  document.getElementById('edit-tag-close')!.onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  nameInput.focus();
}
