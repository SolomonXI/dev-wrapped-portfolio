import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMfaStore,
  emptyRecord,
  encrypt,
  matchingStrongEtag,
} from "../lib/mfa-store.js";
process.env.MFA_ENCRYPTION_KEY = "test-only-storage-adapter-encryption";
const response = (record, etag) => ({
  statusCode: 200,
  stream: new Response(encrypt(record, "record")).body,
  blob: { etag },
});

test("weak download validator is matched to canonical metadata, never sent to a write", async () => {
  const record = {
    ...emptyRecord(),
    enabled: true,
    secret: "test-secret",
    version: "version-1",
    recovery: ["test-hash"],
  };
  let saved;
  const store = createMfaStore({
    get: async () => response(record, 'W/"version1"'),
    head: async () => ({ etag: '"version1"' }),
    put: async (path, body, options) => {
      saved = options;
    },
  });
  const read = await store.read();
  assert.deepEqual(read.record, record);
  assert.equal(read.etag, '"version1"');
  await store.write(read.record, read.etag);
  assert.equal(saved.ifMatch, '"version1"');
  assert.equal(saved.allowOverwrite, true);
});
test("body/metadata race is retried rather than overwriting newer security state", async () => {
  let reads = 0;
  const store = createMfaStore({
    get: async () => {
      reads++;
      return response(
        { ...emptyRecord(), failures: reads },
        reads === 1 ? 'W/"old"' : 'W/"new"',
      );
    },
    head: async () => ({ etag: '"new"' }),
    put: async () => {
      throw new Error("must not write");
    },
  });
  const result = await store.read();
  assert.equal(reads, 2);
  assert.equal(result.record.failures, 2);
  assert.equal(result.etag, '"new"');
});
test("missing, mismatched, or weak-only metadata fails closed", async () => {
  assert.equal(matchingStrongEtag('W/"a"', '"a"'), '"a"');
  for (const [a, b] of [
    ['W/"a"', '"b"'],
    ['W/"a"', 'W/"a"'],
    ["", ""],
    [undefined, '"a"'],
  ])
    assert.equal(matchingStrongEtag(a, b), null);
  const store = createMfaStore({
    get: async () => response(emptyRecord(), 'W/"a"'),
    head: async () => ({ etag: '"b"' }),
    put: async () => assert.fail("must not write"),
  });
  await assert.rejects(() => store.read(), {
    code: "MFA_READ_VERSION_CONFLICT",
  });
  await assert.rejects(() => store.write(emptyRecord(), 'W/"a"'), {
    code: "MFA_INVALID_WRITE_VERSION",
  });
});
test("first enrollment stays create-only and existing record writes remain conditional", async () => {
  let saved;
  const store = createMfaStore({
    get: async () => null,
    head: async () => assert.fail("head not needed"),
    put: async (path, body, options) => {
      saved = options;
    },
  });
  assert.equal((await store.read()).etag, null);
  await store.write(emptyRecord(), null);
  assert.equal(saved.allowOverwrite, false);
  assert.equal(saved.ifMatch, undefined);
});
