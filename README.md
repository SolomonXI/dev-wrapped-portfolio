# Dev Wrapped — The developer edition

An editable software-engineering portfolio, with the energy of a Wrapped recap and the clarity of a professional portfolio. Built with semantic HTML, CSS, and vanilla JavaScript, served by Vercel.

## Public experience

- Dark charcoal, electric green, lavender, and pink palette; editorial typography and CSS record artwork.
- Overview: introduction, editable statistics, featured projects, profile, toolkit, experience, and contact.
- Selected work: tag filters, individual project dialogs, real live/source links, and labelled concept artwork.
- Toolkit: locally hosted technology logos and explicitly self-assessed confidence levels.
- Career journey: expandable roles preserving the QuackHost co-ownership experience.
- Credentials: honest empty state until actual credentials are added.
- Contact: email links, copy-email control, public socials; no pretend form submission.
- Five-chapter interactive recap using the current content. Keyboard arrows, Escape, focus restoration, and reduced-motion support.
- Responsive navigation, image fallbacks, accessible dialogs, and recoverable loading errors.

Existing public paths remain supported:
`/`, `/featured_projects_wrapped_visual/`, `/skills_wrapped/`,
`/experience_wrapped/`, `/certificates_wrapped/`, `/contact_me/`.

## Editing

Open `/admin/`. Your password and existing signed session continue to work.

Edit your profile, homepage headline/introduction, statistics, projects, skill icons, experience images, certificates, and social links. Choose any page in the live preview selector. Typing changes only the preview; **Save changes** publishes to the private Blob store.

Browser drafts and JSON import/export are retained. The editor previews scale to the available width. Imported/browser drafts must be reviewed before publishing. Editorial section headings, colour tokens, and layout are design code; personal content comes from the editor.

## Data and architecture

- **`content/site.json` in private Vercel Blob is the production source of truth.** Deploying a new design does not overwrite saved content.
- `data/site.json`: initial/fallback content only.
- `api/content.js`: public reads and authenticated writes.
- `api/admin-auth.js` / `lib/auth.js`: password verification and signed HttpOnly, Secure, SameSite cookies.
- `assets/wrapped.js` / `assets/wrapped.css`: shared public renderer and design system.
- `admin/index.html`, `assets/admin.js`, `assets/admin.css`: the studio.
- `assets/images`: local project, experience, and technology assets.
- Older exported Stitch files are retained in Git for reference. Legacy dashboard, project-detail, and admin URLs redirect to the redesigned public pages or working studio.
- `api/contact.js` is an unused legacy integration; the redesigned contact page uses honest mail links.

Required Vercel environment variables: `BLOB_READ_WRITE_TOKEN`, `ADMIN_PASSWORD`, `SESSION_SECRET`. Never commit credentials. The redesign does not rotate passwords or modify these environment variables.

## Development and checks

Install dependencies with `npm ci`. Run `npm run check` for JavaScript syntax validation.

For browser tests, install Chromium with `npx playwright install chromium`, then run `npm test`. Tests use a loopback-only static server and in-memory mocked content/auth endpoints. They never write production content. Tests cover routes, small screens, project filters/dialogs, recap navigation, technology images, experience expansion, admin preview/save integration, escaping, empty/error states, and signed-session validation.

For Vercel-backed local development use `vercel dev` from this project after linking it to the correct Vercel project. Use a development Blob store if testing writes; production content must not be used for destructive tests.

## Deployment

The repository is linked to the `dev-wrapped-portfolio` Vercel project. Deploy after checks, and verify the production alias. No front-end framework build is required.

Production: https://dev-wrapped-portfolio.vercel.app/

The project also has `devwrapped.me` and `www.devwrapped.me` assigned. Registrar DNS and valid TLS must be configured independently; deploying does not change Namecheap DNS.
