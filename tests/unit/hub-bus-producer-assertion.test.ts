import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { importPKCS8 } from "jose";
import { SignJWT } from "jose";
import { verifyHubBusProducerGrantAssertion } from "../../src/security/hub-bus-producer-assertion.js";

const hubInstallationId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";
const applicationRegistrationId = "44444444-4444-4444-8444-444444444444";
const event = {
  hubInstallationId, organizationId, projectId, applicationRegistrationId,
  appId: "com.example.nexushub-demo", tenant: "tenant-demo", eventType: "com.example.nexushub-demo.note.created.v1",
  eventService: "com.example.nexushub-demo", eventMember: "created", serviceVersion: "1.0.0",
  descriptorHash: "sha256:c7900a4a317340013f6bb6a3903bfcaa25225c495b780fa8f387ff9a46f249dc",
  schemaMajor: 1, role: "event.publish" as const, grantRevision: "7", actorSubject: "owner-subject",
};

async function signedGrant(privateKeyPem: string, kid: string, override: Record<string, unknown> = {}, now = new Date()) {
  return new SignJWT({ ...event, ...override })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid })
    .setIssuer("https://hub.example.test")
    .setSubject(event.actorSubject)
    .setAudience("nexusid:nexusbus-producer-enrollment")
    .setJti("55555555-5555-4555-8555-555555555555")
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(now.getTime() / 1000) + 30)
    .sign(await importPKCS8(privateKeyPem, "RS256"));
}

test("NexusID accepts owner assertions from operator-pinned Hub instances within the configured role ceiling", async (t) => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  const kid = `test-${createHash("sha256").update(publicKey).digest("hex")}`;
  const values = new Map<string, string | undefined>([
    ["NEXUSID_NEXUSBUS_PRODUCER_ENROLLMENT_ENABLED", process.env.NEXUSID_NEXUSBUS_PRODUCER_ENROLLMENT_ENABLED],
    ["NEXUSID_NEXUSHUB_PRODUCER_GRANT_KEYS_JSON", process.env.NEXUSID_NEXUSHUB_PRODUCER_GRANT_KEYS_JSON],
  ]);
  t.after(() => { for (const [name, value] of values) value === undefined ? delete process.env[name] : process.env[name] = value; });
  process.env.NEXUSID_NEXUSBUS_PRODUCER_ENROLLMENT_ENABLED = "true";
  process.env.NEXUSID_NEXUSHUB_PRODUCER_GRANT_KEYS_JSON = JSON.stringify([{ issuer: "https://hub.example.test", hubInstallationId, kid, publicKeyPem: publicKey, allowedRoles: ["event.publish"] }]);
  const now = new Date();
  const token = await signedGrant(privateKey, kid, {}, now);
  const accepted = await verifyHubBusProducerGrantAssertion(token, now);
  assert.equal(accepted?.applicationRegistrationId, applicationRegistrationId);
  assert.equal(accepted?.eventMember, "created");
  assert.equal(accepted?.role, "event.publish");
  assert.equal(accepted?.assertionId, "55555555-5555-4555-8555-555555555555");

  const anotherApprovedMember = await signedGrant(privateKey, kid, { eventMember: "other" }, now);
  assert.equal((await verifyHubBusProducerGrantAssertion(anotherApprovedMember, now))?.eventMember, "other", "the pinned Hub owner assertion authorizes dynamic exact event bindings");
  const widenedRole = await signedGrant(privateKey, kid, { role: "event.publish,contract.publish" }, now);
  assert.equal(await verifyHubBusProducerGrantAssertion(widenedRole, now), undefined, "the signed claim cannot widen the operator-pinned role ceiling");
  const expired = await signedGrant(privateKey, kid, {}, new Date(now.getTime() - 60_000));
  assert.equal(await verifyHubBusProducerGrantAssertion(expired, now), undefined);
  const wrongKey = await signedGrant(privateKey, "untrusted-kid", {}, now);
  assert.equal(await verifyHubBusProducerGrantAssertion(wrongKey, now), undefined);

  process.env.NEXUSID_NEXUSBUS_PRODUCER_ENROLLMENT_ENABLED = "false";
  assert.equal(await verifyHubBusProducerGrantAssertion(token, now), undefined, "feature-off deployment fails closed");
});
