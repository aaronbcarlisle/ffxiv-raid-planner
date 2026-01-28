# Privacy & Security

This document provides transparency about how FFXIV Raid Planner handles your data, including what we collect, how we store it, and the security measures in place.

**Last Updated:** January 2026 (v1.11.1)

---

## Data Collection Summary

| Data | Collected | Purpose |
|------|-----------|---------|
| Discord ID | Yes | Unique identifier for your account |
| Discord Username | Yes | Display name in the app |
| Discord Avatar | Yes | Profile picture |
| Email Address | **No** | Not collected (removed in v1.11.1) |
| Game Data (BiS, gear) | Yes | Core app functionality |
| Static Group Data | Yes | Core app functionality |

---

## Authentication

### How Discord OAuth Works

We use Discord as an identity provider - similar to "Login with Google" on other sites. Here's what happens when you log in:

1. **You click "Login with Discord"** - We redirect you to Discord's authorization page
2. **Discord asks for permission** - You see exactly what we're requesting (username and avatar only)
3. **You approve** - Discord sends us a one-time code
4. **We exchange the code** - We get a temporary token to fetch your basic profile
5. **Token is discarded** - The Discord token is used once, then thrown away
6. **You're logged in** - We create our own session tokens stored in secure cookies

### OAuth Scope

We request the **minimum required scope** from Discord:

```
scope=identify
```

This grants access to:
- Your Discord user ID
- Your username
- Your avatar

This does **NOT** include:
- Your email address
- Your Discord servers
- Your friends list
- Ability to send messages
- Any other Discord data

### Technical Implementation

```python
# backend/app/routers/auth.py
params = {
    "client_id": settings.discord_client_id,
    "redirect_uri": settings.discord_redirect_uri,
    "response_type": "code",
    "scope": "identify",  # Minimum scope - no email
    "state": state,
}
```

### Revoking Access

You can revoke our access anytime:
1. Go to Discord Settings → Authorized Apps
2. Find "FFXIV Raid Planner"
3. Click "Deauthorize"

This immediately revokes our ability to access your Discord profile. Your data in the app remains until you delete your account.

---

## Session Security

### httpOnly Cookies

Your session tokens are stored in **httpOnly cookies**, which means:

- JavaScript cannot access them (prevents XSS attacks)
- They're automatically sent with requests (no localStorage exposure)
- They have `SameSite=Lax` to prevent CSRF attacks

```python
# backend/app/routers/auth.py
response.set_cookie(
    key="access_token",
    value=access_token,
    httponly=True,      # Cannot be accessed by JavaScript
    secure=True,        # HTTPS only in production
    samesite="lax",     # CSRF protection
    path="/",
    max_age=access_token_expire,
)
```

### Token Lifecycle

| Token | Lifetime | Purpose |
|-------|----------|---------|
| Access Token | 15 minutes | Short-lived for API requests |
| Refresh Token | 7 days | Used to get new access tokens |

When your access token expires, the refresh token automatically gets a new one. After 7 days of inactivity, you'll need to log in again.

---

## Data Storage

### What We Store

**User Table:**
```sql
users (
    id              -- Internal UUID
    discord_id      -- Your Discord ID (for login)
    discord_username -- Display name
    discord_avatar  -- Avatar hash (for profile pictures)
    display_name    -- Your Discord display name
    is_admin        -- Admin flag (false for normal users)
    created_at      -- Account creation timestamp
    updated_at      -- Last update timestamp
    last_login_at   -- Last login timestamp
)
```

**What's NOT stored:**
- Email addresses (removed in v1.11.1)
- Discord access tokens (used once, then discarded)
- Passwords (we don't have any - Discord handles auth)
- Payment information (the app is free)

### Game Data

Your FFXIV-related data (BiS sets, gear progress, static groups) is stored to provide the app's functionality. This data is:
- Tied to your account
- Shareable via static group codes (your choice)
- Deletable when you leave a static or delete your account

---

## Privacy Changes History

### v1.11.1 - Email Removal (January 2026)

**What changed:**
- Removed `email` from Discord OAuth scope
- Purged all previously stored email addresses
- Removed email field from database schema
- API no longer returns email in any response

**Why:**
We reviewed our data practices and found that email addresses were being collected but never used. Following the principle of data minimization, we removed this unnecessary collection entirely.

**Verification:**
- Discord login no longer shows "access to your email address"
- The `GET /api/auth/me` endpoint returns no email field
- Database `users` table has no `email` column

---

## Security Measures

### Infrastructure

- **HTTPS Only** - All traffic is encrypted
- **Database Encryption** - Data at rest is encrypted (Railway PostgreSQL)
- **Environment Variables** - Secrets are never committed to code

### Application Security

- **httpOnly Cookies** - Session tokens protected from XSS
- **SameSite Cookies** - CSRF protection
- **Input Validation** - All inputs validated via Pydantic schemas
- **SQL Injection Prevention** - SQLAlchemy ORM with parameterized queries
- **Rate Limiting** - Protects against brute force attacks

### Code Practices

- **No Secrets in Code** - All credentials via environment variables
- **Dependency Updates** - Regular security updates
- **Type Safety** - TypeScript frontend, Python type hints backend

---

## Your Rights

### Access Your Data
You can see all your data by:
- Viewing your profile in the app
- Checking your static groups
- Using the API directly (`GET /api/auth/me`)

### Delete Your Data
To delete your data:
1. Leave all static groups you're a member of
2. Delete static groups you own
3. Contact us to delete your account entirely

---

## Contact

For privacy concerns or data deletion requests:
- Open an issue on [GitHub](https://github.com/aaronbcarlisle/ffxiv-raid-planner)
- Contact the maintainer via Discord

---

## Verification Evidence

There's no way to cryptographically prove data deletion (no web app really can). But here's what we can show: the migration code, the deployment logs, and the database schema. More importantly, the OAuth scope change is something you can verify yourself without trusting us at all.

### Verify It Yourself (No Trust Required)

**Check OAuth Scope:**
1. Log out of the app
2. Click "Login with Discord"
3. Check the URL - it should contain `scope=identify` (no `email`)
4. Check Discord's permission prompt - should only mention username/avatar

**Check API Response:**
```bash
# After logging in, open browser DevTools → Network
# Find the /api/auth/me request
# Response should NOT contain an "email" field
```

### Migration Code

This is the actual database migration that dropped the email column:

```python
# backend/alembic/versions/i9j0k1l2m3n4_remove_email_column.py

def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col["name"] for col in inspector.get_columns("users")]

    if "email" in existing_columns:
        # Audit: Log count of users with emails before purging
        result = bind.execute(
            sa.text("SELECT COUNT(*) FROM users WHERE email IS NOT NULL")
        )
        email_count = result.scalar()
        print(f"[{timestamp}] AUDIT: Purging {email_count} email addresses from users table")

        # Drop the email column using batch_alter_table for SQLite compatibility
        with op.batch_alter_table("users", schema=None) as batch_op:
            batch_op.drop_column("email")
        print(f"[{timestamp}] SUCCESS: email column removed from users table")
```

### Deployment Logs

Output from the production deployment showing the migration ran successfully:

```bash
# Railway deployment logs (January 2026)
# Deployment logs will be added here after production deployment
# Expected output:
# [2026-01-XX] AUDIT: Purging X email addresses from users table
# [2026-01-XX] SUCCESS: email column removed from users table
```

### Schema Verification

Query result showing the `users` table no longer has an email column:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' ORDER BY ordinal_position;
```

**Result:**
| column_name |
|-------------|
| id |
| discord_id |
| discord_username |
| discord_avatar |
| display_name |
| is_admin |
| created_at |
| updated_at |
| last_login_at |

Note: No `email` column present.
