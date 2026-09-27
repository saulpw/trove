import './domstub';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderThumbnail } from '../../src/frontend';

const link = { url: 'https://example.com/artist', added: '', title: 'Artist' };

test('ordinary links have no thumbnail by default or after clearing', () => {
  assert.equal(renderThumbnail(link), '');
  assert.equal(renderThumbnail({ ...link, thumbnail: '' }), '');
});

test('explicit thumbnail overrides direct image and escapes attributes', () => {
  const html = renderThumbnail({ ...link, url: 'https://example.com/direct.jpg', thumbnail: 'https://example.com/art.png?a=1&b=2' });
  assert.match(html, /src="https:\/\/example.com\/art.png\?a=1&amp;b=2"/);
  assert.doesNotMatch(html, /direct.jpg/);
  assert.match(html, /referrerpolicy="no-referrer"/);
});

test('clearing still previews direct image links', () => {
  const html = renderThumbnail({ ...link, url: 'https://example.com/art.PNG?size=small#art', thumbnail: '' });
  assert.match(html, /src="https:\/\/example.com\/art.PNG\?size=small#art"/);
});

test('broken image handler removes the entire thumbnail container', () => {
  const html = renderThumbnail({ ...link, thumbnail: 'https://example.com/broken.png' });
  const handler = html.match(/onerror="([^"]+)"/)![1];
  let removed = false;
  new Function(handler).call({ parentElement: { remove: () => { removed = true; } } });
  assert.equal(removed, true);
});

test('unsafe schemes and credential-bearing thumbnails are not rendered', () => {
  for (const thumbnail of ['javascript:alert(1)', 'data:image/png;base64,abc', 'https://user:password@example.com/a.png', 'not a URL']) {
    assert.equal(renderThumbnail({ ...link, thumbnail }), '');
  }
});
