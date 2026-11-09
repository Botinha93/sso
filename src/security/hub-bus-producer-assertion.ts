import { importSPKI, jwtVerify } from "jose";

export interface VerifiedHubBusProducerGrant {
  hubInstallationId: string;
  organizationId: string;
  projectId: string;
  applicationRegistrationId: string;
  appId: string;
  tenant: string;
  eventType: string;
  eventService: string;
  eventMember: string;
  serviceVersion: string;
  descriptorHash: string;
  schemaMajor: number;
  role: "event.publish";
  grantRevision: string;
  actorSubject: string;
  assertionId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const APP_ID = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function readJson(raw: string | undefined, name: string): unknown {
  try { return JSON.parse(raw ?? ""); } catch { throw new Error(`${name}_invalid`); }
}

export function isHubInstallationTrustedForBusProducer(input: { hubInstallationId: string; role: string }): boolean {
  try {
    const trust = readJson(process.env.NEXUSID_NEXUSHUB_PRODUCER_GRANT_KEYS_JSON, "hub_grant_keys");
    if (!Array.isArray(trust)) return false;
    return trust.some((raw) => raw && typeof raw === "object" && !Array.isArray(raw) && (() => {
      const row = raw as Record<string, unknown>;
      return row.hubInstallationId === input.hubInstallationId && typeof row.kid === "string" && typeof row.issuer === "string" &&
        typeof row.publicKeyPem === "string" && Array.isArray(row.allowedRoles) && row.allowedRoles.includes(input.role);
    })());
  } catch { return false; }
}

/** Verifies a Hub-signed, short-lived owner grant against operator-pinned Hub instance/key/role trust. */
export async function verifyHubBusProducerGrantAssertion(token: string, now = new Date()): Promise<VerifiedHubBusProducerGrant | undefined> {
  if (process.env.NEXUSID_NEXUSBUS_PRODUCER_ENROLLMENT_ENABLED !== "true" || token.length > 8_192) return undefined;
  const trust = readJson(process.env.NEXUSID_NEXUSHUB_PRODUCER_GRANT_KEYS_JSON, "hub_grant_keys");
  if (!Array.isArray(trust)) return undefined;
  const [protectedHeader] = token.split(".");
  let kid: unknown;
  try { kid = JSON.parse(Buffer.from(protectedHeader!, "base64url").toString("utf8")).kid; } catch { return undefined; }
  const key = trust.find((item) => item && typeof item === "object" && !Array.isArray(item) && (item as Record<string, unknown>).kid === kid);
  if (!key || typeof key !== "object") return undefined;
  const config = key as Record<string, unknown>;
  if (typeof config.issuer !== "string" || !/^https:\/\//.test(config.issuer) || !UUID.test(String(config.hubInstallationId)) || typeof config.publicKeyPem !== "string") return undefined;
  try {
    const publicKey = await importSPKI(config.publicKeyPem, "RS256");
    const verified = await jwtVerify(token, publicKey, {
      issuer: config.issuer,
      audience: "nexusid:nexusbus-producer-enrollment",
      algorithms: ["RS256"],
      clockTolerance: 2,
      maxTokenAge: "30s",
      currentDate: now,
    });
    const p = verified.payload;
    const claim: VerifiedHubBusProducerGrant = {
      hubInstallationId: String(p.hubInstallationId), organizationId: String(p.organizationId), projectId: String(p.projectId),
      applicationRegistrationId: String(p.applicationRegistrationId), appId: String(p.appId), tenant: String(p.tenant),
      eventType: String(p.eventType), eventService: String(p.eventService), eventMember: String(p.eventMember),
      serviceVersion: String(p.serviceVersion), descriptorHash: String(p.descriptorHash), schemaMajor: Number(p.schemaMajor),
      role: p.role as "event.publish", grantRevision: String(p.grantRevision), actorSubject: String(p.actorSubject), assertionId: String(p.jti),
    };
    if (config.hubInstallationId !== claim.hubInstallationId || !Array.isArray(config.allowedRoles) || !config.allowedRoles.includes(claim.role) || p.sub !== claim.actorSubject ||
        !UUID.test(claim.hubInstallationId) || !UUID.test(claim.organizationId) || !UUID.test(claim.projectId) || !UUID.test(claim.applicationRegistrationId) ||
        !APP_ID.test(claim.appId) || !IDENTIFIER.test(claim.tenant) || !IDENTIFIER.test(claim.eventService) ||
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(claim.eventType) || !/^[a-z][a-z0-9-]{0,63}$/.test(claim.eventMember) ||
        !VERSION.test(claim.serviceVersion) || !/^sha256:[0-9a-f]{64}$/.test(claim.descriptorHash) ||
        !Number.isSafeInteger(claim.schemaMajor) || claim.schemaMajor < 1 || claim.role !== "event.publish" ||
        !/^[1-9]\d*$/.test(claim.grantRevision) || !claim.actorSubject || claim.actorSubject.length > 512 || !UUID.test(claim.assertionId)) return undefined;
    return claim;
  } catch { return undefined; }
}
