import fs from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { isAuthenticated, isSameOrigin } from "../lib/auth.js";

import { validContent } from "../assets/content-validation.js";

const BLOB_PATH = "content/site.json";
const MAX_SIZE = 1024 * 1024;

async function readContent() {
  try {
    const result = await get(BLOB_PATH, { access: "private", useCache: false });
    if (result?.statusCode === 200 && result.stream) {
      return JSON.parse(await new Response(result.stream).text());
    }
  } catch (error) {
    if (error?.name !== "BlobNotFoundError") throw error;
  }

  const fallback = await fs.readFile(
    path.join(process.cwd(), "data", "site.json"),
    "utf8",
  );
  return JSON.parse(fallback);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "GET") {
    try {
      return res.status(200).json(await readContent());
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Content could not be loaded" });
    }
  }

  if (req.method !== "PUT")
    return res.status(405).json({ error: "Method not allowed" });
  if (!(await isAuthenticated(req)))
    return res.status(401).json({ error: "Please sign in again" });
  if (!isSameOrigin(req))
    return res.status(403).json({ error: "Invalid request origin" });

  const content = req.body;
  const serialized = JSON.stringify(content);
  if (!validContent(content))
    return res.status(400).json({ error: "Invalid portfolio content" });
  if (Buffer.byteLength(serialized) > MAX_SIZE)
    return res.status(413).json({ error: "Portfolio content is too large" });

  try {
    const blob = await put(BLOB_PATH, `${JSON.stringify(content, null, 2)}\n`, {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
    });
    return res
      .status(200)
      .json({ ok: true, updatedAt: new Date().toISOString(), etag: blob.etag });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Content could not be saved" });
  }
}
