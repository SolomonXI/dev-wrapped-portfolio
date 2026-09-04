import crypto from 'node:crypto';

const COOKIE_NAME = '__Host-devwrapped_admin';
const MAX_AGE = 60 * 60 * 24 * 30;

function sign(value) {
  const secret = process.env.SESSION_SECRET || '';
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function passwordMatches(candidate) {
  return Boolean(process.env.ADMIN_PASSWORD) && safeEqual(candidate || '', process.env.ADMIN_PASSWORD);
}

export function createSessionCookie() {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  const value = `${expires}.${sign(String(expires))}`;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function isAuthenticated(req) {
  if (!process.env.SESSION_SECRET) return false;
  const cookies = Object.fromEntries(String(req.headers.cookie || '').split(';').map(part => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));
  const [expires, signature] = String(cookies[COOKIE_NAME] || '').split('.');
  if (!expires || !signature || Number(expires) < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(signature, sign(expires));
}

export function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
