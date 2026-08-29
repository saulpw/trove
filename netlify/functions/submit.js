const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method not allowed' };
  }

  const { GITHUB_TOKEN, GITHUB_REPO, TROVE_USERS } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Server not configured' }) };
  }

  if (!TROVE_USERS) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'No users configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { url, title, tags, notes, autotag, username, password, action, remove_tag, add_tags, urls, tag, description } = body;

  if (!username || !password) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Authentication required' }) };
  }

  // Verify username:password against TROVE_USERS env var (format: alice:pw1,bob:pw2)
  const users = {};
  TROVE_USERS.split(',').forEach(entry => {
    const [u, ...pParts] = entry.split(':');
    if (u) users[u.trim()] = pParts.join(':').trim();
  });

  if (!users[username] || users[username] !== password) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid credentials' }) };
  }

  let issueTitle, issueBody, issueLabel = 'submission';

  if (action === 'report') {
    if (!url) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'report requires url' }) };
    }
    let host;
    try { host = new URL(url).hostname; } catch { host = url; }
    issueLabel = 'bookmarklet-problem';
    issueTitle = `bookmarklet problem on ${host}`;
    issueBody = [
      `action: report`,
      `url: ${url}`,
      title ? `title: ${title}` : null,
      notes ? `notes: ${notes}` : null,
      `submitted_by: ${username}`,
    ].filter(Boolean).join('\n');
  } else if (action === 'set_tag_desc') {
    if (!tag) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'set_tag_desc requires tag' }) };
    }
    issueTitle = `Set tag description: ${tag}`;
    issueBody = [
      `action: set_tag_desc`,
      `tag: ${tag}`,
      `description: ${description || ''}`,
      `submitted_by: ${username}`,
    ].join('\n');
  } else if (action === 'rename_tag') {
    if (!remove_tag || !add_tags || !urls) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'rename_tag requires remove_tag, add_tags, and urls' }) };
    }
    issueTitle = `Rename tag: ${remove_tag} → ${add_tags}`;
    issueBody = [
      `action: rename_tag`,
      `remove_tag: ${remove_tag}`,
      `add_tags: ${add_tags}`,
      `urls: ${urls}`,
      `submitted_by: ${username}`,
    ].join('\n');
  } else {
    if (!url) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'URL required' }) };
    }
    const effectiveAction = action || 'add';
    issueTitle = effectiveAction === 'add'
      ? `Link submission: ${url}`
      : `${effectiveAction}: ${url}`;
    issueBody = [
      effectiveAction !== 'add' ? `action: ${effectiveAction}` : null,
      `url: ${url}`,
      title ? `title: ${title}` : null,
      tags ? `tags: ${tags}` : null,
      notes ? `notes: ${notes}` : null,
      autotag ? `autotag: true` : null,
      `submitted_by: ${username}`,
    ].filter(Boolean).join('\n');
  }

  try {
    const ghResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/issues`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'trove-submit',
        },
        body: JSON.stringify({
          title: issueTitle,
          body: issueBody,
          labels: [issueLabel],
        }),
      }
    );

    if (!ghResponse.ok) {
      const err = await ghResponse.json();
      console.error('GitHub API error:', err);
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Failed to create issue' }) };
    }

    const issue = await ghResponse.json();
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, issueUrl: issue.html_url }),
    };
  } catch (e) {
    console.error('GitHub request failed:', e);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'GitHub request failed' }) };
  }
};
