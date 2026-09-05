import { BlobPreconditionFailedError } from "@vercel/blob";
import { test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import handler from "../api/admin-auth.js";
import { mfaStore, emptyRecord, encrypt, decrypt } from "../lib/mfa-store.js";
import {
  isAuthenticated,
  readChallenge,
  createSessionCookie,
} from "../lib/auth.js";
import { authenticator, validStep, recoveryHash } from "../lib/totp.js";
process.env.SESSION_SECRET = "test-session-secret-never-production";
process.env.MFA_ENCRYPTION_KEY = "test-encryption-key-never-production";
process.env.ADMIN_PASSWORD = "test-password";
let record, etag;
mock.method(mfaStore, "read", async () => ({
  record: structuredClone(record),
  etag,
}));
mock.method(mfaStore, "write", async (next, expected) => {
  if (expected !== etag) {
    throw new BlobPreconditionFailedError();
  }
  record = structuredClone(next);
  etag = String(Number(etag || 0) + 1);
});
beforeEach(() => {
  record = emptyRecord();
  etag = null;
});
function client() {
  let jar = {};
  const ip = crypto.randomUUID();
  return {
    get cookie() {
      return Object.entries(jar)
        .map(([k, v]) => k + "=" + v)
        .join("; ");
    },
    set cookie(v) {
      jar = Object.fromEntries(v.split(";").map((x) => x.trim().split("=")));
    },
    async call(body, method = "POST", origin = "https://example.com") {
      const res = {
        code: 200,
        headers: {},
        setHeader(k, v) {
          this.headers[k] = v;
        },
        status(s) {
          this.code = s;
          return this;
        },
        json(v) {
          this.body = v;
          return this;
        },
      };
      await handler(
        {
          method,
          body,
          headers: {
            host: "example.com",
            origin,
            cookie: this.cookie,
            "x-vercel-forwarded-for": ip,
          },
        },
        res,
      );
      for (const cookie of [res.headers["Set-Cookie"]].flat().filter(Boolean)) {
        const [k, v] = cookie.split(";")[0].split("=");
        if (v) jar[k] = v;
        else delete jar[k];
      }
      return res;
    },
  };
}
async function enroll(c) {
  const start = await c.call({ password: "test-password" });
  assert.equal(start.body.step, "enroll");
  const seed = start.body.secret;
  const done = await c.call({
    action: "enroll",
    code: authenticator(seed).generate(),
  });
  assert.equal(done.code, 200);
  return { seed, codes: done.body.recoveryCodes, done };
}
async function password(c, intent = "login") {
  const res = await c.call({ password: "test-password", intent });
  assert.equal(res.body.step, "verify");
}

test("RFC 6238 SHA-1 vector, narrow time window, invalid and replayed codes", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(validStep(secret, "287082", -1, 59000), 1);
  assert.equal(validStep(secret, "287082", 1, 59000), null);
  assert.equal(validStep(secret, "000000", -1, 59000), null);
  assert.equal(validStep(secret, "287082", -1, 150000), null);
});
test("seed encryption authenticates ciphertext and separates cookie/record purposes", () => {
  const encrypted = encrypt({ secret: "private-seed" }, "record");
  assert.ok(!encrypted.includes("private-seed"));
  assert.equal(decrypt(encrypted, "record").secret, "private-seed");
  assert.throws(() => decrypt(encrypted, "challenge"));
  assert.throws(() => decrypt(encrypted.slice(0, -5) + "abcde", "record"));
});
test("password never grants editor access; enrollment needs valid code and returns eight recovery codes", async () => {
  const c = client();
  const start = await c.call({ password: "test-password" });
  assert.equal(start.body.step, "enroll");
  assert.match(start.body.qr, /^data:image\/png;base64,/);
  assert.equal(await isAuthenticated({ headers: { cookie: c.cookie } }), false);
  const bad = await c.call({ action: "enroll", code: "abcdef" });
  assert.equal(bad.code, 401);
  assert.equal(record.enabled, false);
  const good = await c.call({
    action: "enroll",
    code: authenticator(start.body.secret).generate(),
  });
  assert.equal(good.body.recoveryCodes.length, 8);
  assert.equal(new Set(good.body.recoveryCodes).size, 8);
  assert.equal(await isAuthenticated({ headers: { cookie: c.cookie } }), true);
  assert.ok(record.recovery.every((x) => /^[a-f0-9]{64}$/.test(x)));
  assert.ok(!JSON.stringify(record).includes(good.body.recoveryCodes[0]));
});
test("existing authenticator is never revealed during password verification and used OTP is rejected", async () => {
  const owner = client();
  const { seed } = await enroll(owner);
  const c = client();
  await password(c);
  assert.equal(await isAuthenticated({ headers: { cookie: c.cookie } }), false);
  assert.equal(
    (await c.call({ action: "verify", code: authenticator(seed).generate() }))
      .code,
    401,
  );
  record.lastStep = -1;
  const ok = await c.call({
    action: "verify",
    code: authenticator(seed).generate(),
  });
  assert.equal(ok.body.authenticated, true);
  assert.equal(ok.body.secret, undefined);
  assert.equal(ok.body.recoveryCodes, undefined);
});
test("recovery codes are single-use and cannot replace the password", async () => {
  const owner = client();
  const { codes } = await enroll(owner);
  const c = client();
  assert.equal(
    (await c.call({ action: "verify", recovery: true, code: codes[0] })).code,
    401,
  );
  await password(c);
  assert.equal(
    (await c.call({ action: "verify", recovery: true, code: codes[0] })).body
      .authenticated,
    true,
  );
  const other = client();
  await password(other);
  assert.equal(
    (await other.call({ action: "verify", recovery: true, code: codes[0] }))
      .code,
    401,
  );
  assert.equal(record.recovery.length, 7);
});
test("atomic writes allow only one concurrent use of a recovery code", async () => {
  const owner = client();
  const { codes } = await enroll(owner);
  const a = client(),
    b = client();
  await password(a);
  await password(b);
  const results = await Promise.all([
    a.call({ action: "verify", recovery: true, code: codes[0] }),
    b.call({ action: "verify", recovery: true, code: codes[0] }),
  ]);
  assert.deepEqual(results.map((x) => x.code).sort(), [200, 401]);
  assert.equal(record.recovery.length, 7);
});
test("durable failed-code lockout survives new password challenges", async () => {
  const owner = client();
  await enroll(owner);
  const c = client();
  await password(c);
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await c.call({ action: "verify", code: "not-a-code" })).code,
      401,
    );
  assert.ok(record.lockedUntil > Date.now());
  assert.equal((await client().call({ password: "test-password" })).code, 429);
  assert.equal((await c.call({ action: "verify", code: "123456" })).code, 429);
});
test("replacing authenticator requires both factors, keeps old setup until confirmation, revokes old sessions", async () => {
  const owner = client();
  const { seed, codes } = await enroll(owner);
  const oldCookie = owner.cookie;
  const c = client();
  await password(c, "replace");
  const next = await c.call({
    action: "verify",
    recovery: true,
    code: codes[0],
  });
  assert.equal(next.body.step, "enroll");
  assert.equal(record.secret, seed);
  assert.notEqual(next.body.secret, seed);
  assert.equal(await isAuthenticated({ headers: { cookie: oldCookie } }), true);
  const finish = await c.call({
    action: "enroll",
    code: authenticator(next.body.secret).generate(),
  });
  assert.equal(finish.body.authenticated, true);
  assert.equal(record.secret, next.body.secret);
  assert.equal(
    await isAuthenticated({ headers: { cookie: oldCookie } }),
    false,
  );
  assert.equal(await isAuthenticated({ headers: { cookie: c.cookie } }), true);
});
test("new recovery codes revoke old codes and sessions without removing authenticator", async () => {
  const owner = client();
  const { seed, codes } = await enroll(owner);
  const oldCookie = owner.cookie;
  const c = client();
  await password(c, "backup");
  const next = await c.call({
    action: "verify",
    recovery: true,
    code: codes[0],
  });
  assert.equal(next.body.recoveryCodes.length, 8);
  assert.equal(record.secret, seed);
  assert.ok(!record.recovery.includes(recoveryHash(codes[1])));
  assert.equal(
    await isAuthenticated({ headers: { cookie: oldCookie } }),
    false,
  );
});
test("old password-only cookies, tampered challenges and cross-origin mutations fail", async () => {
  const expires = String(Math.floor(Date.now() / 1000) + 3600),
    sig = crypto
      .createHmac("sha256", process.env.SESSION_SECRET)
      .update(expires)
      .digest("base64url");
  assert.equal(
    await isAuthenticated({
      headers: { cookie: "__Host-devwrapped_admin=" + expires + "." + sig },
    }),
    false,
  );
  const c = client();
  await c.call({ password: "test-password" });
  assert.equal(
    readChallenge({ headers: { cookie: c.cookie + "broken" } }),
    null,
  );
  assert.equal(
    (
      await c.call(
        { action: "enroll", code: "123456" },
        "POST",
        "https://attacker.test",
      )
    ).code,
    403,
  );
});
test("storage outage never falls back to fresh enrollment or password-only login", async () => {
  const original = mfaStore.read;
  mfaStore.read = async () => {
    throw new Error("Unavailable");
  };
  try {
    const result = await client().call({ password: "test-password" });
    assert.equal(result.code, 503);
    assert.equal(result.body.secret, undefined);
    assert.throws(() => createSessionCookie());
  } finally {
    mfaStore.read = original;
  }
});
