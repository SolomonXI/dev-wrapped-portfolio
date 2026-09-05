import crypto from "node:crypto";
import { TOTP, Secret } from "otpauth";
export const newSecret = () => new Secret({ size: 20 }).base32;
export const authenticator = (secret) =>
  new TOTP({
    issuer: "Dev Wrapped",
    label: "Portfolio owner",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });
export function validStep(secret, code, lastStep = -1, now = Date.now()) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return null;
  const delta = authenticator(secret).validate({
    token: code,
    window: 1,
    timestamp: now,
  });
  if (delta === null) return null;
  const step = Math.floor(now / 30000) + delta;
  return step > lastStep ? step : null;
}
export const recoveryHash = (code) =>
  crypto
    .createHash("sha256")
    .update(
      "devwrapped-recovery:" +
        String(code)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, ""),
    )
    .digest("hex");
export const newRecovery = () =>
  Array.from({ length: 8 }, () =>
    crypto
      .randomBytes(10)
      .toString("hex")
      .toUpperCase()
      .match(/.{1,5}/g)
      .join("-"),
  );
