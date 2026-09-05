import crypto from "node:crypto";
import {
  get,
  head,
  put,
  BlobError,
  BlobNotFoundError,
  BlobPreconditionFailedError,
} from "@vercel/blob";
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
// Blob downloads can use a weak HTTP validator (W/"…") while the write
// API requires the canonical strong validator from head(). Never use a weak
// validator for ifMatch, and never pair a body with metadata from a newer version.
export function matchingStrongEtag(downloadEtag, metadataEtag) {
  if (
    typeof downloadEtag !== "string" ||
    typeof metadataEtag !== "string" ||
    !/^"[^"\r\n]+"$/.test(metadataEtag)
  )
    return null;
  return downloadEtag.replace(/^W\//, "") === metadataEtag
    ? metadataEtag
    : null;
}
function storageError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}
export function createMfaStore(blob = { get, head, put }) {
  return {
    async read() {
      for (let attempt = 0; attempt < 4; attempt++) {
        let result;
        try {
          result = await blob.get(PATH, { access: "private", useCache: false });
        } catch (error) {
          if (error instanceof BlobNotFoundError)
            return { record: emptyRecord(), etag: null };
          throw error;
        }
        if (!result) return { record: emptyRecord(), etag: null };
        if (result.statusCode !== 200 || !result.stream)
          throw storageError("MFA_BAD_READ");
        let metadata;
        try {
          metadata = await blob.head(PATH);
        } catch (error) {
          await result.stream.cancel();
          if (error instanceof BlobNotFoundError) continue;
          throw error;
        }
        const etag = matchingStrongEtag(result.blob?.etag, metadata.etag);
        if (!etag) {
          await result.stream.cancel();
          continue;
        }
        let record;
        try {
          record = decrypt(await new Response(result.stream).text(), "record");
        } catch {
          throw storageError("MFA_DECRYPT_FAILED");
        }
        if (
          typeof record.enabled !== "boolean" ||
          !Array.isArray(record.used) ||
          (record.enabled &&
            (!record.secret ||
              !record.version ||
              !Array.isArray(record.recovery)))
        )
          throw storageError("MFA_INVALID_RECORD");
        return { record, etag };
      }
      throw storageError("MFA_READ_VERSION_CONFLICT");
    },
    async write(record, etag) {
      if (etag !== null && !matchingStrongEtag(etag, etag))
        throw storageError("MFA_INVALID_WRITE_VERSION");
      await blob.put(PATH, encrypt(record, "record"), {
        access: "private",
        contentType: "application/octet-stream",
        addRandomSuffix: false,
        allowOverwrite: etag !== null,
        ...(etag !== null ? { ifMatch: etag } : {}),
      });
    },
  };
}
// Injection lets tests exercise the real encrypted storage adapter, not just mock it.
export const mfaStore = createMfaStore();
export async function updateMfa(change) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { record, etag } = await mfaStore.read();
    const result = await change(record);
    if (result.noWrite) return result;
    try {
      await mfaStore.write(record, etag);
      return result;
    } catch (error) {
      // SDK errors inherit name="Error"; use class identity, not error.name.
      if (error instanceof BlobPreconditionFailedError) continue;
      if (etag === null && error instanceof BlobError) {
        // Another enrollment may have won the create-only write race.
        const current = await mfaStore.read();
        if (current.etag !== null) continue;
      }
      throw error;
    }
  }
  throw storageError("MFA_WRITE_VERSION_CONFLICT");
}
