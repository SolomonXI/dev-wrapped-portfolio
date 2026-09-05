import {
  clearSessionCookie,
  createSessionCookie,
  isAuthenticated,
  isSameOrigin,
  passwordMatches,
} from "../lib/auth.js";

// Best-effort per-instance throttling. Production-wide protection belongs in Vercel Firewall.
const attempts = new Map();
function throttled(req) {
  const now = Date.now();
  for (const [key, value] of attempts)
    if (value.until < now) attempts.delete(key);
  const key = String(
    req.headers["x-vercel-forwarded-for"] ||
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "unknown",
  ).split(",")[0];
  const entry = attempts.get(key) || { count: 0, until: now + 60000 };
  entry.count++;
  attempts.set(key, entry);
  return entry.count > 10;
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "GET")
    return res.status(200).json({ authenticated: isAuthenticated(req) });

  if (["POST", "DELETE"].includes(req.method) && !isSameOrigin(req))
    return res.status(403).json({ error: "Invalid request origin" });

  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearSessionCookie());
    return res.status(200).json({ authenticated: false });
  }

  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  if (!isSameOrigin(req))
    return res.status(403).json({ error: "Invalid request origin" });
  if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD)
    return res.status(503).json({ error: "Owner sign-in is not configured." });
  if (throttled(req)) {
    res.setHeader("Retry-After", "60");
    return res
      .status(429)
      .json({
        error: "Too many attempts. Please wait a minute and try again.",
      });
  }
  if (!passwordMatches(req.body?.password)) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return res.status(401).json({ error: "Incorrect password" });
  }

  res.setHeader("Set-Cookie", createSessionCookie());
  return res.status(200).json({ authenticated: true });
}
