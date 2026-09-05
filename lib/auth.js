import crypto from "node:crypto";
import { mfaStore, encrypt, decrypt } from "./mfa-store.js";
const COOKIE_NAME = "__Host-devwrapped_admin";
const CHALLENGE = "__Host-devwrapped_challenge";
const MAX_AGE = 60 * 60 * 12;
export function safeEqual(a, b) {
  const x = Buffer.from(String(a)),
    y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function sign(value) {
  if (!process.env.SESSION_SECRET)
    throw new Error("Session signing is not configured");
  return crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(value)
    .digest("base64url");
}
function cookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((v) => {
        const i = v.indexOf("=");
        return i < 0 ? ["", ""] : [v.slice(0, i).trim(), v.slice(i + 1).trim()];
      }),
  );
}
const cookie = (name, value, age) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
export function passwordMatches(candidate) {
  return (
    typeof candidate === "string" &&
    candidate.length <= 256 &&
    Boolean(process.env.ADMIN_PASSWORD) &&
    safeEqual(candidate, process.env.ADMIN_PASSWORD)
  );
}
export function createSessionCookie(version) {
  if (!version)
    throw new Error("MFA must be verified before creating a session");
  const payload = Buffer.from(
    JSON.stringify({
      v: 2,
      mfa: version,
      expires: Math.floor(Date.now() / 1000) + MAX_AGE,
    }),
  ).toString("base64url");
  return cookie(COOKIE_NAME, `${payload}.${sign(payload)}`, MAX_AGE);
}
export function clearSessionCookie() {
  return cookie(COOKIE_NAME, "", 0);
}
export function clearChallengeCookie() {
  return cookie(CHALLENGE, "", 0);
}
export function createChallengeCookie(payload) {
  return cookie(
    CHALLENGE,
    encrypt(
      {
        ...payload,
        id: crypto.randomUUID(),
        expires: Date.now() + 5 * 60 * 1000,
      },
      "challenge",
    ),
    300,
  );
}
export function readChallenge(req) {
  try {
    const value = decrypt(cookies(req)[CHALLENGE] || "", "challenge");
    return value.expires > Date.now() ? value : null;
  } catch {
    return null;
  }
}
export async function isAuthenticated(req) {
  if (!process.env.SESSION_SECRET) return false;
  const parts = String(cookies(req)[COOKIE_NAME] || "").split(".");
  if (parts.length !== 2 || !safeEqual(parts[1], sign(parts[0]))) return false;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  } catch {
    return false;
  }
  if (
    payload.v !== 2 ||
    !Number.isFinite(payload.expires) ||
    payload.expires <= Math.floor(Date.now() / 1000) ||
    !payload.mfa
  )
    return false;
  // No fallback to password-only sessions when storage is unavailable.
  const { record } = await mfaStore.read();
  return record.enabled && safeEqual(payload.mfa, record.version);
}
export function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  if (!origin)
    return (
      !req.headers["sec-fetch-site"] ||
      req.headers["sec-fetch-site"] === "same-origin"
    );
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}
