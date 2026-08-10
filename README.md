Dev Wrapped — site

This folder contains a 1:1 export of the portfolio.

Local preview

- Install Vercel CLI: npm i -g vercel
- Run: vercel dev

Contact form

- The serverless endpoint is at /api/contact (site/api/contact.js). It will send email via SendGrid if the following env vars are set:
  - SENDGRID_API_KEY
  - CONTACT_TO_EMAIL
  - (optional) CONTACT_FROM_EMAIL
- If not configured, submissions are logged to server logs.

Deployment

- Recommended: Vercel (zero config). From the repo root: vercel --prod
- Netlify is also supported (move site/api to netlify/functions).

Notes

- Do NOT commit any API keys. Use the hosting provider's secret manager.
- To make the site fully 1:1, review each subfolder/index.html and update absolute links if needed.
