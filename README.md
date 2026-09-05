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

## Editing — your private creator studio

Click **Owner sign in** in the portfolio sidebar or footer. Enter your existing admin password, then the six-digit Google Authenticator code. On first use, scan the QR code in Google Authenticator (or enter the time-based setup key), verify the code, and save your eight recovery codes. MFA enrollment is required before editor access. A valid MFA session opens the Studio directly for up to 12 hours; no URL editing or GitHub token is needed.

- Wrapped-inspired charcoal, lime, lavender and pink workspace with focused section navigation.
- Edit profile, contact, links, homepage copy/stats, projects, grouped skills, experience, and credentials.
- Upload PNG/JPEG/WebP/GIF artwork up to 3 MB, select existing local logos/covers, or paste image URLs. Uploaded artwork is public when its media URL is known; do not upload confidential files.
- Reorder collections and individual skills; feature or hide projects; hide experiences/credentials.
- Edit main headings and page introductions; customise seven colour tokens, homepage section order/visibility, and featured-project count. Fixed navigation labels, recap wording and layout details remain design code.
- Live previews of all six public pages at desktop and phone widths. Draft edits only affect the preview.
- Automatic browser drafts, explicit recovery/discard, undo/redo, JSON backup import/export, unsaved-change warnings, and publish feedback.
- **Publish changes** saves to private Vercel Blob. Deployment never overwrites portfolio content.

### Access protection

`/admin`, `/admin/`, `/admin/index.html` and `/api/studio` run the same server-side session check. Signed-out requests redirect to the public homepage without receiving editor HTML. Direct URLs remain usable by an already authenticated owner; URL obscurity is not the security boundary. The old exported admin URLs lead through the same protected entry.

The editor template lives in `lib/studio.html`, bundled only for the function. The static build uses a public-file allowlist, and `/lib/*` is also denied by routing. Explicit routes run before filesystem matching so trailing-slash and legacy paths cannot bypass the gate. HTML responses are private/no-store, disallow framing, and use a CSP. Saving and uploads separately require a signed HttpOnly/Secure/SameSite session and enforce same-origin checks. Logout clears the browser cookie. Password sign-in has basic per-instance throttling; configure Vercel Firewall for distributed brute-force protection. Session cookies are signed, expire after 12 hours, and are checked against the current MFA credential version. Old password-only cookies are invalid. Signing out clears this browser; replacing the authenticator or recovery codes revokes existing credential versions across devices. Rotate `SESSION_SECRET` to revoke all signed cookies if compromise is suspected.

Drafts are local to the browser, not cross-device cloud drafts, and remain after logout for recovery. On shared devices, discard or download drafts before leaving. Uploaded unused media is not automatically deleted. This is a single-owner editor: coordinate edits across devices to avoid last-write-wins overwrites.

## Data and architecture

- **`content/site.json` in private Vercel Blob is the production source of truth.** Deploying a new design does not overwrite saved content.
- `data/site.json`: initial/fallback content only.
- `api/content.js`: public reads and authenticated writes.
- `api/admin-auth.js` / `lib/auth.js`: password verification and signed HttpOnly, Secure, SameSite cookies.
- `assets/wrapped.js` / `assets/wrapped.css`: shared public renderer and design system.
- `api/studio.js`, `lib/studio.html`, `assets/admin.js`, `assets/admin.css`: the studio.
- `assets/images`: local project, experience, and technology assets.
- Older exported Stitch files are retained in Git for reference. Legacy dashboard, project-detail, and admin URLs redirect to the redesigned public pages or working studio.
- `api/contact.js` is an unused legacy integration; the redesigned contact page uses honest mail links.

Required Vercel environment variables: `BLOB_READ_WRITE_TOKEN`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `MFA_ENCRYPTION_KEY`. The MFA encryption key is an independent cryptographically random secret stored as a sensitive production Vercel environment variable. Never commit credentials. The MFA update adds its encryption key; it does not change your admin password or session-signing secret.

## Authenticator security and recovery

- RFC 6238 TOTP via OTPAuth: SHA-1, six digits, 30-second period, ±1 step drift; accepted time steps cannot be reused.
- First factor yields only an encrypted, HttpOnly/Secure/SameSite challenge cookie valid for five minutes. Only verified enrollment or a successful second factor can issue an editor session.
- The QR code is generated on your own server. Seeds and recovery codes never go to a third-party QR service, portfolio JSON, localStorage, or browser drafts.
- `security/owner-mfa.json` is separate from public portfolio content in private Blob storage and encrypted with AES-256-GCM. Only recovery-code hashes are persisted. The public media proxy explicitly cannot read this path.
- Blob ETag compare-and-swap updates prevent concurrent OTP/recovery-code reuse and lost security-state updates. Downloads may provide weak HTTP validators; the adapter matches the downloaded body to the canonical strong ETag from Blob metadata before writing. Conflicting versions are re-read, never overwritten unconditionally. SDK conflicts are identified by their error classes (their `name` can simply be `Error`). Five wrong second-factor attempts lock verification for five minutes across function instances; creating a new challenge does not reset the lock. Password attempts also have basic per-instance throttling; use Vercel Firewall for broader distributed abuse protection.
- Completed challenges are consumed. A storage/decryption failure fails closed; it never silently resets MFA or allows password-only access.
- Studio → **Account security** can replace an authenticator or generate new recovery codes. Both require the password plus a fresh app code or unused recovery code. Existing protection stays active until a replacement app is verified. There is no web-facing MFA-disable or password-only reset endpoint.
- **Do not rotate/delete `MFA_ENCRYPTION_KEY` casually.** It decrypts the authenticator seed; changing `SESSION_SECRET` is the appropriate session-revocation operation. Keep infrastructure recovery access protected separately.
- Lost phone: use an unused recovery code *along with your password*, then reconnect an authenticator from Account security. Keep enough unused codes for reauthentication. If you lose the phone and every recovery code, recovery requires verified Vercel project administration—not a public reset link. An authorised infrastructure recovery should rotate the admin password and session secret, preserve an encrypted backup, then deliberately reset the private MFA record and re-enroll. Never delete public portfolio content during account recovery.
- TOTP protects against a leaked password but is not phishing-resistant like a passkey/security key. Never share app codes or recovery codes.

## Development and checks

Install dependencies with `npm ci`. Run `npm run check` for JavaScript syntax validation.

Unit tests additionally cover RFC TOTP vectors, encryption integrity, mandatory enrollment, replay/concurrency rejection, durable lockout, recovery-code reuse, credential rotation, legacy-cookie rejection, and fail-closed storage errors.

For browser tests, install Chromium with `npx playwright install chromium`, then run `npm test`. Tests use a loopback-only server with the real studio/auth handlers and in-memory mocked content persistence. Production is never written during tests. They never write production content. Tests cover routes, small screens, project filters/dialogs, recap navigation, technology images, experience expansion, admin preview/save integration, escaping, empty/error states, and signed-session validation.

For Vercel-backed local development use `vercel dev` from this project after linking it to the correct Vercel project. Use a development Blob store if testing writes; production content must not be used for destructive tests.

## Deployment

The repository is linked to the `dev-wrapped-portfolio` Vercel project. Deploy after checks, and verify the production alias. No front-end framework build is required.

Production: https://dev-wrapped-portfolio.vercel.app/

The project also has `devwrapped.me` and `www.devwrapped.me` assigned. Registrar DNS and valid TLS must be configured independently; deploying does not change Namecheap DNS.
