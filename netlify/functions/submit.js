exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const { GITHUB_TOKEN, GITHUB_REPO } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { url, tags, notes, googleToken } = body;

  if (!url) {
    return { statusCode: 400, body: JSON.stringify({ error: 'URL required' }) };
  }

  if (!googleToken) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Authentication required' }) };
  }

  // Verify Google token and get user email
  let email;
  try {
    const tokenResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${googleToken}`
    );
    if (!tokenResponse.ok) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }
    const tokenInfo = await tokenResponse.json();
    email = tokenInfo.email;
    if (!email) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Could not get email from token' }) };
    }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Token verification failed' }) };
  }

  // Create GitHub issue
  const issueBody = [
    `url: ${url}`,
    tags ? `tags: ${tags}` : null,
    notes ? `notes: ${notes}` : null,
    `submitted_by: ${email}`,
  ].filter(Boolean).join('\n');

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
          title: `Link submission: ${url}`,
          body: issueBody,
          labels: ['submission'],
        }),
      }
    );

    if (!ghResponse.ok) {
      const err = await ghResponse.json();
      console.error('GitHub API error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create issue' }) };
    }

    const issue = await ghResponse.json();
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, issueUrl: issue.html_url }),
    };
  } catch (e) {
    console.error('GitHub request failed:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'GitHub request failed' }) };
  }
};
