import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE = "settlesignal_workspace";
export const ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function configuredPassword(): string | null {
  const password = process.env.SETTLESIGNAL_ADMIN_PASSWORD;
  return password && password.length >= 12 ? password : null;
}

function configuredSecret(): string | null {
  const secret = process.env.SETTLESIGNAL_ADMIN_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

export function isAccessConfigured(): boolean {
  return configuredPassword() !== null && configuredSecret() !== null;
}

export function matchesAccessPassword(candidate: string): boolean {
  const expected = configuredPassword();
  if (!expected || !configuredSecret() || typeof candidate !== "string" || candidate.length > 4096) return false;
  const actualDigest = createHash("sha256").update(candidate, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

export function createAccessToken(nowSeconds = Math.floor(Date.now() / 1000)): string {
  const secret = configuredSecret();
  if (!secret || !configuredPassword()) throw new Error("SettleSignal workspace access is not configured.");
  const expiresAt = Math.floor(nowSeconds) + ACCESS_MAX_AGE_SECONDS;
  const payload = `v1.${expiresAt}`;
  const signature = createHmac("sha256", secret).update(payload, "utf8").digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAccessToken(token: string | null | undefined, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (typeof token !== "string" || token.length > 128) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !/^\d+$/.test(parts[1])) return false;
  const expiresAt = Number(parts[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= nowSeconds || expiresAt > nowSeconds + ACCESS_MAX_AGE_SECONDS + 60) return false;
  const secret = configuredSecret();
  if (!secret || !configuredPassword()) return false;
  const payload = `v1.${expiresAt}`;
  const expectedSignature = createHmac("sha256", secret).update(payload, "utf8").digest("base64url");
  if (parts[2].length !== expectedSignature.length) return false;
  return timingSafeEqual(Buffer.from(parts[2], "utf8"), Buffer.from(expectedSignature, "utf8"));
}
