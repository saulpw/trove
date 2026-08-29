import './domstub';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isUserTag, userTagSymbol, userTagUsername, renderTag } from '../../src/tags';

describe('isUserTag', () => {
  test('plain tag', () => assert.equal(isUserTag('games'), false));
  test('leading digit is not a user tag', () => assert.equal(isUserTag('1990s'), false));
  test('at-prefixed', () => assert.equal(isUserTag('@saul'), true));
  test('underscore pseudo-tag counts as a user tag', () => assert.equal(isUserTag('_favs'), true));
  test('empty string', () => assert.equal(isUserTag(''), false));
});

describe('userTagSymbol', () => {
  test('single symbol', () => assert.equal(userTagSymbol('@saul'), '@'));
  test('symbol run', () => assert.equal(userTagSymbol('~~bob'), '~~'));
  test('plain tag has none', () => assert.equal(userTagSymbol('games'), ''));
});

describe('userTagUsername', () => {
  test('strips the leading symbol', () => assert.equal(userTagUsername('@saul'), 'saul'));
  test('strips only the leading run', () => assert.equal(userTagUsername('@saul.pw'), 'saul.pw'));
  test('plain tag is unchanged', () => assert.equal(userTagUsername('games'), 'games'));
});

describe('renderTag with no active filter', () => {
  test('markup and URL-syntax menu labels', () =>
    assert.equal(renderTag('games'),
      '<span class="tag-wrap"><span class="tag" data-tag="games">games</span>'
      + '<span class="tag-menu"><span data-href="/games">games</span>'
      + '<span data-href="/-games">-games</span></span></span>'));

  test('user tags get the tag-user class', () =>
    assert.match(renderTag('@saul'), /class="tag tag-user" data-tag="@saul"/));

  test('menu offers include and exclude hrefs', () => {
    const html = renderTag('@saul');
    assert.match(html, /data-href="\/@saul"/);
    assert.match(html, /data-href="\/-@saul"/);
  });

  test('tag text is html-escaped', () => {
    const html = renderTag('a<b');
    assert.equal(html.includes('a<b'), false);
    assert.match(html, /data-tag="a&lt;b"/);
    assert.match(html, /data-href="\/a&lt;b"/);
  });
});
