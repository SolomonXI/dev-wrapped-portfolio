import crypto from "node:crypto";
import QRCode from "qrcode";
import {
  clearSessionCookie,
  clearChallengeCookie,
  createSessionCookie,
  createChallengeCookie,
  readChallenge,
  isAuthenticated,
  isSameOrigin,
  passwordMatches,
  safeEqual,
} from "../lib/auth.js";
import { mfaStore, updateMfa } from "../lib/mfa-store.js";
import {
  authenticator,
  newSecret,
  validStep,
  newRecovery,
  recoveryHash,
} from "../lib/totp.js";
const attempts = new Map();
function throttled(req) {
  const now = Date.now();
  for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
  const key = String(
    req.headers["x-vercel-forwarded-for"] ||
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "unknown",
  ).split(",")[0];
  const v = attempts.get(key) || { count: 0, until: now + 60000 };
  v.count++;
  attempts.set(key, v);
  return v.count > 15;
}
function failure(
  record,
  message = "Incorrect or already used code. Try the next code from your app.",
) {
  record.failures = (record.failures || 0) + 1;
  if (record.failures >= 5) {
    record.lockedUntil = Date.now() + 5 * 60000;
    record.failures = 0;
  }
  return { error: message, status: 401 };
}
async function enrollment(res, version = null) {
  const secret = newSecret();
  res.setHeader(
    "Set-Cookie",
    createChallengeCookie({ kind: "enroll", version, secret }),
  );
  const qr = await QRCode.toDataURL(authenticator(secret).toString(), {
    width: 260,
    margin: 4,
    errorCorrectionLevel: "M",
  });
  return res.status(200).json({ step: "enroll", secret, qr });
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  try {
    if (req.method === "GET")
      return res
        .status(200)
        .json({ authenticated: await isAuthenticated(req) });
    if (!["POST", "DELETE"].includes(req.method))
      return res.status(405).json({ error: "Method not allowed" });
    if (!isSameOrigin(req))
      return res.status(403).json({ error: "Invalid request origin" });
    if (req.method === "DELETE") {
      res.setHeader("Set-Cookie", [
        clearSessionCookie(),
        clearChallengeCookie(),
      ]);
      return res.status(200).json({ authenticated: false });
    }
    if (
      !process.env.SESSION_SECRET ||
      !process.env.ADMIN_PASSWORD ||
      !process.env.MFA_ENCRYPTION_KEY
    )
      return res.status(503).json({
        error: "Secure sign-in is unavailable. Please try again later.",
      });
    const action = req.body?.action || "password";
    if (action === "cancel") {
      res.setHeader("Set-Cookie", clearChallengeCookie());
      return res.status(200).json({ ok: true });
    }
    if (throttled(req)) {
      res.setHeader("Retry-After", "60");
      return res
        .status(429)
        .json({ error: "Too many attempts. Wait a minute and try again." });
    }
    if (action === "password") {
      if (!passwordMatches(req.body?.password)) {
        await new Promise((r) => setTimeout(r, 500));
        return res.status(401).json({ error: "Incorrect password" });
      }
      const intent = ["replace", "backup"].includes(req.body.intent)
        ? req.body.intent
        : "login";
      const { record } = await mfaStore.read();
      if (record.lockedUntil > Date.now())
        return res.status(429).json({
          error: "Too many incorrect codes. Wait five minutes and try again.",
        });
      if (!record.enabled) return await enrollment(res);
      res.setHeader(
        "Set-Cookie",
        createChallengeCookie({
          kind: "verify",
          version: record.version,
          intent,
        }),
      );
      return res.status(200).json({ step: "verify" });
    }
    if (!["verify", "enroll"].includes(action))
      return res.status(400).json({ error: "Invalid sign-in action" });
    const challenge = readChallenge(req);
    if (!challenge || challenge.kind !== action) {
      res.setHeader("Set-Cookie", clearChallengeCookie());
      return res.status(401).json({
        error: "Sign-in expired. Start again with your password.",
        restart: true,
      });
    }
    const result = await updateMfa((record) => {
      const now = Date.now();
      record.used = record.used.filter((x) => x.expires > now);
      if (record.lockedUntil > now)
        return {
          error: "Too many incorrect codes. Wait five minutes and try again.",
          status: 429,
          noWrite: true,
        };
      if (
        record.version !== challenge.version ||
        record.used.some((x) => x.id === challenge.id)
      )
        return {
          error: "This sign-in has already been used or replaced. Start again.",
          status: 401,
          restart: true,
          noWrite: true,
        };
      let codes;
      if (action === "enroll") {
        const step = validStep(challenge.secret, req.body.code);
        if (step === null)
          return failure(
            record,
            "That code did not match. Check your phone’s automatic time setting and try again.",
          );
        codes = newRecovery();
        Object.assign(record, {
          enabled: true,
          secret: challenge.secret,
          version: crypto.randomUUID(),
          lastStep: step,
          recovery: codes.map(recoveryHash),
        });
      } else {
        if (!record.enabled)
          return {
            error: "Restart sign-in to set up your authenticator.",
            status: 401,
            restart: true,
            noWrite: true,
          };
        if (req.body.recovery === true) {
          if (
            typeof req.body.code !== "string" ||
            !/^[A-Za-z0-9-]{20,24}$/.test(req.body.code)
          )
            return failure(record, "Invalid recovery code.");
          const hash = recoveryHash(req.body.code),
            i = record.recovery.findIndex((x) => safeEqual(x, hash));
          if (i < 0)
            return failure(record, "Invalid or already used recovery code.");
          record.recovery.splice(i, 1);
        } else {
          const step = validStep(record.secret, req.body.code, record.lastStep);
          if (step === null) return failure(record);
          record.lastStep = step;
        }
        if (challenge.intent === "backup") {
          codes = newRecovery();
          record.recovery = codes.map(recoveryHash);
          record.version = crypto.randomUUID();
        }
      }
      record.failures = 0;
      record.lockedUntil = 0;
      record.used.push({ id: challenge.id, expires: challenge.expires });
      return {
        version: record.version,
        codes,
        replace: action === "verify" && challenge.intent === "replace",
        recoveryUsed: req.body.recovery === true,
      };
    });
    if (result.error)
      return res
        .status(result.status)
        .json({ error: result.error, restart: result.restart || false });
    if (result.replace) return await enrollment(res, result.version);
    res.setHeader("Set-Cookie", [
      createSessionCookie(result.version),
      clearChallengeCookie(),
    ]);
    return res.status(200).json({
      authenticated: true,
      step: result.codes ? "recovery" : "done",
      recoveryCodes: result.codes,
      recoveryUsed: result.recoveryUsed,
    });
  } catch (error) {
    console.error(
      "Secure sign-in failed:",
      /^MFA_[A-Z_]+$/.test(error?.code || "")
        ? error.code
        : error?.constructor?.name || "Error",
    );
    return res.status(503).json({
      error:
        "Secure sign-in is temporarily unavailable. Nothing has been bypassed; please try again.",
    });
  }
}
