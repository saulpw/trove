import './domstub';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { handler } = require('../../netlify/functions/submit.js');

test('submission endpoint carries thumbnail adds, edits, and clears', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    const issue = JSON.parse(options.body as string);
    bodies.push(issue.body);
    return { ok: true, json: async () => ({ html_url: 'https://example.com/issue' }) } as Response;
  });
  const oldEnv = { ...process.env };
  t.after(() => { process.env = oldEnv; });
  process.env.GITHUB_TOKEN = 'test-only';
  process.env.GITHUB_REPO = 'test/test';
  process.env.TROVE_USERS = 'tester:test-password';
  const bodies: string[] = [];
  const submit = (fields: object) => handler({ httpMethod: 'POST', body: JSON.stringify({
    url: 'https://example.com/artist', username: 'tester', password: 'test-password', ...fields,
  }) });

  for (const action of ['add', 'set_thumbnail']) {
    for (const thumbnail of ['https://example.com/art.png', '']) {
      const response = await submit({ action, thumbnail });
      assert.equal(response.statusCode, 200);
      assert.ok(bodies.at(-1)!.split('\n').includes(`thumbnail: ${thumbnail}`));
      if (action === 'set_thumbnail') assert.match(bodies.at(-1)!, /action: set_thumbnail/);
    }
  }
  assert.equal((await submit({})).statusCode, 200);
  assert.doesNotMatch(bodies.at(-1)!, /thumbnail:/);
  const accepted = bodies.length;
  for (const thumbnail of [null, 1, {}, 'javascript:alert(1)', 'data:image/png;base64,abc', 'https://user:password@example.com/image.png', 'https://example.com/image.png\nurl: https://other.com']) {
    assert.equal((await submit({ thumbnail })).statusCode, 400);
  }
  assert.equal((await submit({ action: 'set_thumbnail' })).statusCode, 400);
  assert.equal(bodies.length, accepted);
});
