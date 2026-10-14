import test from "node:test";
import assert from "node:assert/strict";
import { createTestContext } from "../helpers/test-app.js";

test("media routes allow cross-origin embedding", async (t) => {
  const { app } = await createTestContext("integration-media-headers");

  t.after(async () => {
    await app.close();
  });

  const defaultAvatar = await app.inject({
    method: "GET",
    url: "/media/defaults/user/male.svg"
  });

  assert.equal(defaultAvatar.statusCode, 200);
  assert.equal(defaultAvatar.headers["cross-origin-resource-policy"], "cross-origin");
  assert.match(defaultAvatar.headers["content-type"] ?? "", /image\/svg\+xml/);

  const defaultAppImage = await app.inject({
    method: "GET",
    url: "/media/defaults/app/grid.svg"
  });

  assert.equal(defaultAppImage.statusCode, 200);
  assert.equal(defaultAppImage.headers["cross-origin-resource-policy"], "cross-origin");

  const health = await app.inject({
    method: "GET",
    url: "/health"
  });

  assert.equal(health.statusCode, 200);
  assert.equal(health.headers["cross-origin-resource-policy"], "same-origin");
});
