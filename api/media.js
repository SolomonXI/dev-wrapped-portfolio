import { randomUUID } from "node:crypto";
import { get, put } from "@vercel/blob";
import { isAuthenticated, isSameOrigin } from "../lib/auth.js";
const MAX = 3 * 1024 * 1024;
export function imageType(buffer) {
  if (buffer.length < 12) return null;
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return ["png", "image/png"];
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return ["jpg", "image/jpeg"];
  if (["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6)))
    return ["gif", "image/gif"];
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return ["webp", "image/webp"];
  return null;
}
export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") {
    const key = req.query?.key;
    // Only intentionally public artwork can be fetched. Never allow content/site.json or arbitrary blob paths.
    if (
      typeof key !== "string" ||
      !/^media\/[0-9a-f-]{36}\.(png|jpg|gif|webp)$/.test(key)
    )
      return res.status(404).json({ error: "Image not found" });
    try {
      const result = await get(key, { access: "private" });
      if (result?.statusCode !== 200 || !result.stream)
        return res.status(404).end();
      const ext = key.split(".").pop();
      res.setHeader(
        "Content-Type",
        {
          png: "image/png",
          jpg: "image/jpeg",
          gif: "image/gif",
          webp: "image/webp",
        }[ext],
      );
      res.setHeader("Cache-Control", "private, max-age=86400");
      return res
        .status(200)
        .send(Buffer.from(await new Response(result.stream).arrayBuffer()));
    } catch (error) {
      return res
        .status(error?.name === "BlobNotFoundError" ? 404 : 503)
        .json({ error: "Image unavailable" });
    }
  }
  if (req.method !== "POST") return res.status(405).end();
  if (!(await isAuthenticated(req)))
    return res
      .status(401)
      .json({ error: "Please sign in again before uploading." });
  if (!isSameOrigin(req))
    return res.status(403).json({ error: "Invalid request origin" });
  const encoded = req.body?.data;
  if (typeof encoded !== "string" || encoded.length > Math.ceil(MAX / 3) * 4)
    return res
      .status(413)
      .json({ error: "Choose an image smaller than 3 MB." });
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
    return res.status(400).json({ error: "Invalid image data." });
  const bytes = Buffer.from(encoded, "base64"),
    type = imageType(bytes);
  if (!type || bytes.length > MAX)
    return res
      .status(400)
      .json({ error: "Use a PNG, JPG, WebP or GIF image under 3 MB." });
  try {
    const key = `media/${randomUUID()}.${type[0]}`;
    await put(key, bytes, {
      access: "private",
      contentType: type[1],
      addRandomSuffix: false,
    });
    return res
      .status(200)
      .json({ url: "/api/media?key=" + encodeURIComponent(key) });
  } catch (error) {
    console.error("Image upload failed", error);
    return res
      .status(503)
      .json({ error: "Could not upload the image. Please try again." });
  }
}
