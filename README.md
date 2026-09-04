# Dev Wrapped

An editable developer portfolio deployed on Vercel.

## Content editor

Visit `/admin/` to edit profile details, homepage copy, statistics, projects,
skills, experience, certificates, and social links.

Publishing uses the GitHub Contents API so the site does not need a database:

1. Create a **fine-grained GitHub personal access token**.
2. Limit repository access to `SolomonXI/dev-wrapped-portfolio`.
3. Grant **Contents: Read and write** and no other repository permissions.
4. Paste it into the editor and choose **Save & publish**.

The token is held only in the open tab. It is not committed, sent to Vercel,
or saved in local storage. Publishing updates `data/site.json`; the connected
Vercel project deploys the commit automatically.

The editor also supports browser drafts plus JSON backup import/export.

## Structure

- `data/site.json` — the single source of truth for visible content
- `assets/site.js` — loads and renders content on public pages
- `assets/styles.css` — shared public design
- `admin/` and `assets/admin.js` — owner-facing visual editor
- `api/contact.js` — optional SendGrid contact endpoint retained for future use

## Local preview

Serve the repository root with any static server, for example:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Domain

The Vercel project includes `devwrapped.me` and `www.devwrapped.me`. DNS must be
configured at the registrar before Vercel can issue TLS certificates.
