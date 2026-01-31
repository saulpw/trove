# Authentication Options for Link Submission

## Current Approach: Full OAuth (Option 4)

Users sign in with Google OAuth using `spreadsheets` scope. This grants full read/write access to all their spreadsheets, but we only use it to append to our single trove sheet. The upside: we capture user email for accountability.

**Tradeoff:** Scary permission prompt ("access all your spreadsheets") but simple implementation and full user identity.

## Alternative Approaches

### Option 1: OAuth for Identity + Service Account for Writes (Recommended Future)

- User signs in with `email` scope only (benign "see your email" prompt)
- Netlify Function validates the ID token, extracts email
- Service account (server-side) appends row to sheet with that email

**Pros:** Minimal permissions, user identity, service account only accesses shared sheet
**Cons:** Requires Netlify Function, two auth mechanisms

### Option 2: Shared Password

- Simple secret token field in the UI
- Anyone with password can submit
- Optional self-reported name field (honor system)

**Pros:** Dead simple, no OAuth
**Cons:** No real identity, password can leak

### Option 3: IP Logging Only

- Netlify Function captures IP address
- No user authentication
- Traceable after-the-fact if abuse occurs

**Pros:** No login friction
**Cons:** No identity, IPs can be spoofed/shared

## Google OAuth Scope Limitations

Google doesn't offer a "single spreadsheet" scope. Available options:

| Scope | Access |
|-------|--------|
| `spreadsheets` | Full read/write to ALL user sheets |
| `spreadsheets.readonly` | Read-only to all sheets |
| `drive.file` | Only files app created/opened (won't work for pre-existing sheet) |
| `email` | Just user's email address |

## Service Account Notes

- Created in Google Cloud Console under IAM & Admin
- Download JSON key, store securely (never commit)
- Share target sheet with service account's email (Editor access)
- Use from server-side only (Netlify Function)
- Only has access to explicitly shared sheets

## Decision Log

- 2026-01-29: Chose Option 4 (full OAuth) for initial implementation. Acceptable for small trusted user base. Revisit Option 1 if permission prompt scares users.
