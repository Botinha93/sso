import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, jwtVerify, SignJWT } from "jose";
import { isJwtVerificationError } from "../../src/security/jwt.js";

test("isJwtVerificationError maps jose algorithm rejections used by userinfo", async () => {
  const { publicKey } = await generateKeyPair("RS256");
  const hs256Token = await new SignJWT({ sub: "user-1" })
    .setProtectedHeader({ alg: "HS256" })
    .sign(new TextEncoder().encode("not-the-idp-signing-key"));

  await assert.rejects(
    () => jwtVerify(hs256Token, publicKey, { algorithms: ["RS256"] }),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, "ERR_JOSE_ALG_NOT_ALLOWED");
      assert.equal(isJwtVerificationError(error), true);
      return true;
    }
  );

  assert.equal(isJwtVerificationError({ code: "ERR_JWT_EXPIRED", name: "JWTExpired" }), true);
  assert.equal(isJwtVerificationError({ code: "ERR_SOMETHING_ELSE", name: "Error" }), false);
});
