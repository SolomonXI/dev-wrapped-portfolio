import fs from "node:fs/promises";
import path from "node:path";
import { isAuthenticated } from "../lib/auth.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: http: data:; frame-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!["GET", "HEAD"].includes(req.method)) return res.status(405).end();
  if (!(await isAuthenticated(req))) {
    res.setHeader("Location", "/");
    return res.status(303).end();
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res
    .status(200)
    .send(
      req.method === "HEAD"
        ? ""
        : await fs.readFile(
            path.join(process.cwd(), "lib/studio.html"),
            "utf8",
          ),
    );
}
