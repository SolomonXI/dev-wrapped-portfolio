import crypto from "node:crypto";
import { get, put } from "@vercel/blob";
const PATH = "security/owner-mfa.json";
function key() {
  if (!process.env.MFA_ENCRYPTION_KEY)
    throw new Error("MFA encryption is not configured");
  return crypto
    .createHash("sha256")
    .update(process.env.MFA_ENCRYPTION_KEY)
    .digest();
}
export function encrypt(value, purpose) {
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from("devwrapped:" + purpose));
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}
export function decrypt(value, purpose) {
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length < 29) throw new Error("Invalid encrypted record");
  const cipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key(),
    bytes.subarray(0, 12),
  );
  cipher.setAAD(Buffer.from("devwrapped:" + purpose));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString(
      "utf8",
    ),
  );
}
export const emptyRecord = () => ({
  enabled: false,
  version: null,
  failures: 0,
  lockedUntil: 0,
  used: [],
});
// Methods are separated to test real handlers against an atomic in-memory store, never production data.
export const mfaStore = {
  async read() {
    let result;
    try {
      result = await get(PATH, { access: "private", useCache: false });
    } catch (error) {
      if (error?.name === "BlobNotFoundError")
        return { record: emptyRecord(), etag: null };
      throw error;
    }
    if (!result) return { record: emptyRecord(), etag: null };
    if (result.statusCode !== 200 || !result.stream)
      throw new Error("MFA storage unavailable");
    const record = decrypt(await new Response(result.stream).text(), "record");
    if (
      typeof record.enabled !== "boolean" ||
      !Array.isArray(record.used) ||
      (record.enabled &&
        (!record.secret || !record.version || !Array.isArray(record.recovery)))
    )
      throw new Error("Invalid MFA record");
    return { record, etag: result.blob.etag };
  },
  async write(record, etag) {
    await put(PATH, encrypt(record, "record"), {
      access: "private",
      contentType: "application/octet-stream",
      addRandomSuffix: false,
      allowOverwrite: Boolean(etag),
      ...(etag ? { ifMatch: etag } : {}),
    });
  },
};
export async function updateMfa(change) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { record, etag } = await mfaStore.read();
    const result = await change(record);
    if (result.noWrite) return result;
    try {
      await mfaStore.write(record, etag);
      return result;
    } catch (error) {
      if (
        !["BlobPreconditionFailedError", "BlobAlreadyExistsError"].includes(
          error?.name,
        )
      )
        throw error;
    }
  }
  throw new Error("Security record changed. Try again.");
}
