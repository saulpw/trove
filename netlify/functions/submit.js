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

  const { url, title, tags, notes, username, password, action, remove_tag, add_tags, urls } = body;

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

  let issueTitle, issueBody;

  if (action === 'rename_tag') {
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
    issueTitle = `Link submission: ${url}`;
    issueBody = [
      `url: ${url}`,
      title ? `title: ${title}` : null,
      tags ? `tags: ${tags}` : null,
      notes ? `notes: ${notes}` : null,
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
          labels: ['submission'],
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
