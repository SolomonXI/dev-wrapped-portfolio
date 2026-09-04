# Dev Wrapped

An editable developer portfolio deployed on Vercel.

## Content editor

Visit `/admin/` to edit profile details, homepage copy, statistics, projects,
skills, experience, certificates, and social links.

The editor uses a normal password login. A signed, HTTP-only session cookie
keeps the administrator signed in for 30 days. Saving writes the portfolio JSON
to a private Vercel Blob store, so changes appear immediately without a GitHub
token, commit, or deployment.

The editor also supports browser drafts plus JSON backup import/export.

## Structure

- `data/site.json` — initial/fallback content for a new storage setup
- `api/content.js` — public reads and authenticated content writes
- `api/admin-auth.js` and `lib/auth.js` — password login and signed sessions
- Vercel Blob `content/site.json` — the live content source of truth
- `assets/styles.css` — shared public design
- `admin/` and `assets/admin.js` — owner-facing visual editor
- `api/contact.js` — optional SendGrid contact endpoint retained for future use

## Local preview

Pull the Vercel development environment and start Vercel's local server:

```bash
vercel env pull .env.local --environment development
vercel dev
```

Required environment variables are `BLOB_READ_WRITE_TOKEN`, `ADMIN_PASSWORD`,
and `SESSION_SECRET`.

## Domain

The Vercel project includes `devwrapped.me` and `www.devwrapped.me`. DNS must be
configured at the registrar before Vercel can issue TLS certificates.
