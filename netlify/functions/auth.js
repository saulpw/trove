exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const { TROVE_USERS } = process.env;
  if (!TROVE_USERS) {
    return { statusCode: 500, body: JSON.stringify({ error: 'No users configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { username, password } = body;
  if (!username || !password) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Username and password required' }) };
  }

  const users = {};
  TROVE_USERS.split(',').forEach(entry => {
    const [u, ...pParts] = entry.split(':');
    if (u) users[u.trim()] = pParts.join(':').trim();
  });

  if (!users[username] || users[username] !== password) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid credentials' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
