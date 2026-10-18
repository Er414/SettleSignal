import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCESS_MAX_AGE_SECONDS,
  createAccessToken,
  isAccessConfigured,
  matchesAccessPassword,
  verifyAccessToken,
} from "./access-token";

test("workspace access fails closed and tokens expire or reject tampering", () => {
  const oldPassword = process.env.SETTLESIGNAL_ADMIN_PASSWORD;
  const oldSecret = process.env.SETTLESIGNAL_ADMIN_SECRET;

  try {
    delete process.env.SETTLESIGNAL_ADMIN_PASSWORD;
    delete process.env.SETTLESIGNAL_ADMIN_SECRET;
    assert.equal(isAccessConfigured(), false);
    assert.equal(verifyAccessToken("v1.1000.invalid", 1000), false);

    process.env.SETTLESIGNAL_ADMIN_PASSWORD = "a-strong-workspace-passphrase";
    process.env.SETTLESIGNAL_ADMIN_SECRET = "s".repeat(64);
    assert.equal(isAccessConfigured(), true);
    assert.equal(matchesAccessPassword("a-strong-workspace-passphrase"), true);
    assert.equal(matchesAccessPassword("a-different-passphrase"), false);

    const token = createAccessToken(1000);
    assert.equal(verifyAccessToken(token, 1001), true);
    assert.equal(verifyAccessToken(token, 1000 + ACCESS_MAX_AGE_SECONDS), false);
    assert.equal(verifyAccessToken(`${token}x`, 1001), false);
    assert.equal(verifyAccessToken("v1.not-a-time.signature", 1001), false);
  } finally {
    if (oldPassword === undefined) delete process.env.SETTLESIGNAL_ADMIN_PASSWORD;
    else process.env.SETTLESIGNAL_ADMIN_PASSWORD = oldPassword;
    if (oldSecret === undefined) delete process.env.SETTLESIGNAL_ADMIN_SECRET;
    else process.env.SETTLESIGNAL_ADMIN_SECRET = oldSecret;
  }
});
