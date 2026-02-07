# Authentication Options for Link Submission

## Current Approach: Per-User Passwords

Each user has a unique username and password stored in the `TROVE_USERS` Netlify env var (format: `alice:pw1,bob:pw2`). Credentials are persisted in the browser via localStorage.

**Tradeoff:** Simple, zero OAuth friction, but passwords are plaintext in the env var. Acceptable for a small trusted group (10-100 users).

### How it works

1. User enters username + password in the sign-in form
2. Credentials saved to localStorage (persists across refreshes)
3. On submit, credentials sent to Netlify Function which verifies against `TROVE_USERS`
4. Username recorded as `submitted_by` in the GitHub issue

### Managing users

```bash
make add-user NAME=alice PASS=somepw
make remove-user NAME=alice
make list-users
```

Or directly: `python3 manage_users.py add|remove|list`

## Previous Approaches Considered

### Google OAuth (used previously, removed 2026-02-07)
Required re-authentication on every page refresh. Token was in-memory only, not persisted. Frequently bounced to Google page even during "silent" auth. Too much friction for a small trusted user base.

### Shared Password
Single password for all users. No per-user accountability.

### IP Logging Only
No real identity. IPs can be shared/spoofed.

## Decision Log

- 2026-02-07: Replaced Google OAuth with per-user password auth. OAuth was too friction-heavy for a small trusted group. Per-user passwords provide same accountability (`submitted_by: username`) with zero OAuth friction.
- 2026-01-29: Chose Google OAuth for initial implementation. Later found it too friction-heavy.
