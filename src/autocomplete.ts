// Shared tag autocomplete logic used by frontend and bookmarklet

export interface AutocompleteOptions {
  maxResults?: number;
  itemClass?: string;
  trustedHTML?: (html: string) => string;
}

function currentPartial(input: HTMLInputElement): string {
  const val = input.value;
  const cursor = input.selectionStart ?? val.length;
  const before = val.slice(0, cursor);
  const lastSpace = before.lastIndexOf(' ');
  return before.slice(lastSpace + 1);
}

function existingTags(input: HTMLInputElement): string[] {
  return input.value.split(' ').filter(t => t);
}

function pickTag(tag: string, input: HTMLInputElement, dropdown: HTMLElement): void {
  const val = input.value;
  const cursor = input.selectionStart ?? val.length;
  const before = val.slice(0, cursor);
  const lastSpace = before.lastIndexOf(' ');
  const after = val.slice(cursor);
  const nextSpace = after.indexOf(' ');
  const afterCut = nextSpace >= 0 ? after.slice(nextSpace) : '';
  input.value = before.slice(0, lastSpace + 1) + tag + ' ' + afterCut.trimStart();
  dropdown.classList.remove('open');
  input.focus();
}

export function initAutocomplete(
  input: HTMLInputElement,
  dropdown: HTMLElement,
  getTags: () => string[],
  options: AutocompleteOptions = {},
): void {
  const maxResults = options.maxResults ?? 10;
  const itemClass = options.itemClass ?? 'tag-option';
  const trustedHTML = options.trustedHTML ?? ((s: string) => s);
  let activeIdx = -1;

  function showSuggestions(): void {
    const partial = currentPartial(input).toLowerCase();
    if (!partial) { dropdown.classList.remove('open'); return; }
    const existing = new Set(existingTags(input));
    const allTags = getTags();
    const matches = allTags.filter(t => !existing.has(t) && t.toLowerCase().includes(partial)).slice(0, maxResults);
    if (matches.length === 0) { dropdown.classList.remove('open'); return; }
    activeIdx = -1;
    dropdown.innerHTML = trustedHTML(matches.map(t => `<div class="${itemClass}">${t}</div>`).join('')) as unknown as string;
    dropdown.classList.add('open');
  }

  input.addEventListener('input', showSuggestions);

  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!dropdown.classList.contains('open')) return;
    const items = dropdown.querySelectorAll<HTMLElement>(`.${itemClass}`);
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, items.length - 1); items.forEach((el, i) => el.classList.toggle('active', i === activeIdx)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); items.forEach((el, i) => el.classList.toggle('active', i === activeIdx)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pickTag(items[activeIdx].textContent!, input, dropdown); }
    else if (e.key === 'Escape') { dropdown.classList.remove('open'); }
  });

  dropdown.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    const opt = (e.target as HTMLElement).closest(`.${itemClass}`) as HTMLElement | null;
    if (opt) pickTag(opt.textContent!, input, dropdown);
  });

  input.addEventListener('blur', () => { setTimeout(() => dropdown.classList.remove('open'), 150); });
}
