#!/usr/bin/env node

/**
 * Adopt an existing NexusID instance into NexusHub by registering a confidential
 * OAuth client. This does not create users, roles, app assignments, or modify
 * existing clients. The unauthenticated --preflight mode only reads discovery.
 */
import { open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const profilePath = fileURLToPath(new URL("../config/nexushub-oidc-profile.json", import.meta.url));
const expectedHubScopes = [
  "nexushub.installations:write",
  "nexushub.operations:read",
  "nexushub.operations:resume",
  "nexushub.organizations:read",
  "nexushub.organizations:write",
  "nexushub.projects:read",
  "nexushub.projects:write",
  "nexushub.applications:read",
  "nexushub.applications:write"
];
const loadProfile = async () => {
  const profile = JSON.parse(await readFile(profilePath, "utf8"));
  if (profile.profileId !== "nexushub" || profile.profileVersion !== 1) {
    throw new Error("Unsupported NexusHub OIDC profile; review its profileId/profileVersion before provisioning");
  }
  if (profile.clientName !== "NexusHub" ||
      profile.tokenEndpointAuthMethod !== "client_secret_post" ||
      !Array.isArray(profile.grantTypes) || profile.grantTypes.length !== 3 ||
      !profile.grantTypes.includes("authorization_code") || !profile.grantTypes.includes("refresh_token") ||
      !profile.grantTypes.includes("token_exchange") ||
      !Array.isArray(profile.responseTypes) || profile.responseTypes.length !== 1 || profile.responseTypes[0] !== "code") {
    throw new Error("Invalid NexusHub OIDC client profile; expected the reviewed confidential authorization-code profile");
  }
  // The Hub API registers this exact route in services/hub-api/src/oidc.ts.
  // Allowing another syntactically safe path here would issue a client that
  // cannot complete login, while keeping profileVersion at 1 would make that
  // unreviewed contract change look compatible.
  if (profile.redirectPath !== "/auth/callback") {
    throw new Error("NexusHub OIDC profile v1 redirectPath must be exactly /auth/callback");
  }
  if (typeof profile.redirectPath !== "string" || !profile.redirectPath.startsWith("/") ||
      profile.redirectPath.startsWith("//") || profile.redirectPath.includes("\\") ||
      /[?#\u0000-\u001f]/.test(profile.redirectPath) ||
      profile.redirectPath.split("/").some((segment) => segment === "." || segment === "..")) {
    throw new Error("NexusHub OIDC profile redirectPath must be a clean absolute path without query, fragment, or traversal segments");
  }
  if (!Array.isArray(profile.identityScopes) || profile.identityScopes.length !== 3 ||
      !["openid", "profile", "email"].every((scope) => profile.identityScopes.includes(scope)) ||
      !Array.isArray(profile.hubScopes) || profile.hubScopes.length !== 9 ||
      profile.hubScopes.some((scope) => !scope || typeof scope.name !== "string" ||
        !/^nexushub\.[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?$/.test(scope.name) ||
        typeof scope.description !== "string" || !scope.description.trim()) ||
      expectedHubScopes.some((name) => !profile.hubScopes.some((scope) => scope.name === name))) {
    throw new Error("Invalid NexusHub OIDC profile scope catalog; review the versioned identity and Hub scope set");
  }
  const scopes = [...profile.identityScopes, ...profile.hubScopes.map((scope) => scope.name)];
  if (new Set(scopes).size !== scopes.length || scopes.some((scope) => !scope.trim())) {
    throw new Error("NexusHub OIDC profile scopes must be non-empty and unique");
  }
  return { ...profile, scopes };
};
const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const asHttpUrl = (value, name) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL`);
  }
  if (!["https:", "http:"].includes(url.protocol)) throw new Error(`${name} must use HTTP(S)`);
  if (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error(`${name} must use HTTPS outside localhost`);
  }
  if (url.username || url.password || url.hash) throw new Error(`${name} must not contain credentials or a fragment`);
  return url;
};

const issuerFromEnvironment = () => {
  const issuer = asHttpUrl(required("NEXUSID_ISSUER"), "NEXUSID_ISSUER");
  if (issuer.search) throw new Error("NEXUSID_ISSUER must not contain a query string");
  issuer.pathname = issuer.pathname.replace(/\/+$/, "");
  issuer.search = "";
  issuer.hash = "";
  return issuer;
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10_000),
    headers: { accept: "application/json", ...options.headers }
  });
  if (!response.ok) throw new Error(`NexusID discovery failed with HTTP ${response.status}`);
  return parseBoundedJson(response, 256 * 1024, "NexusID discovery document");
};

// Discovery and registration are operator-facing bootstrap inputs. Bound the
// response independently of Content-Length so a proxy or compromised issuer
// cannot make the installer buffer an unbounded body before validation.
const readBoundedText = async (response, maxBytes, description) => {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new Error(`${description} exceeds the ${maxBytes}-byte limit`);
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error(`${description} exceeds the ${maxBytes}-byte limit`);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
};

const parseBoundedJson = async (response, maxBytes, description) => {
  const body = await readBoundedText(response, maxBytes, description);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${description} is not valid JSON`);
  }
};

const discover = async (issuer, profile) => {
  const discoveryUrl = new URL(".well-known/openid-configuration", `${issuer.href.replace(/\/$/, "")}/`);
  const discovery = await fetchJson(discoveryUrl, { redirect: "error" });
  const expectedIssuer = issuer.href.replace(/\/$/, "");
  if (discovery.issuer !== expectedIssuer) throw new Error("NexusID discovery issuer does not match NEXUSID_ISSUER");
  for (const field of ["authorization_endpoint", "token_endpoint", "jwks_uri", "registration_endpoint"]) {
    if (typeof discovery[field] !== "string") throw new Error(`NexusID discovery document is missing ${field}`);
    const endpoint = asHttpUrl(discovery[field], `NexusID ${field}`);
    if (endpoint.protocol !== issuer.protocol) throw new Error(`NexusID ${field} must use the issuer's transport security`);
    if (field === "registration_endpoint" && endpoint.origin !== issuer.origin) {
      throw new Error("NexusID registration_endpoint must share the issuer origin because the operator bearer token is sent there");
    }
  }
  // The Hub's token exchange currently sends its confidential-client secret in
  // the request body. OAuth metadata defaults to client_secret_basic when this
  // field is omitted, so accepting an absent list would produce a config that
  // cannot complete the Hub's code exchange.
  if (!Array.isArray(discovery.token_endpoint_auth_methods_supported) ||
      !discovery.token_endpoint_auth_methods_supported.includes(profile.tokenEndpointAuthMethod)) {
    throw new Error(`NexusID discovery must explicitly support ${profile.tokenEndpointAuthMethod} for the Hub token exchange`);
  }
  return discovery;
};

const run = async () => {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--preflight" || args.length > 1)) {
    throw new Error("Usage: npm run nexushub:adopt | npm run nexushub:preflight");
  }
  const preflight = args.includes("--preflight");
  const issuer = issuerFromEnvironment();
  const hubOrigin = asHttpUrl(required("NEXUS_PUBLIC_ORIGIN"), "NEXUS_PUBLIC_ORIGIN");
  // The callback is derived from the public origin, not a base URL. Reject
  // paths and query strings instead of silently discarding an operator typo
  // when resolving the profile's absolute callback path.
  if (hubOrigin.pathname !== "/" || hubOrigin.search) {
    throw new Error("NEXUS_PUBLIC_ORIGIN must be an origin without a path or query string");
  }
  const profile = await loadProfile();
  const callbackUrl = new URL(profile.redirectPath, hubOrigin);

  // Discovery completes before a local marker is created or any credentials are
  // read. The preflight is safe to run during development: it sends no token and
  // performs no remote mutation.
  const discovery = await discover(issuer, profile);
  if (preflight) {
    console.log(`NexusID discovery is compatible for issuer ${discovery.issuer}.`);
    console.log(`Registration endpoint: ${discovery.registration_endpoint}`);
    console.log(`Callback to configure: ${callbackUrl.href}`);
    console.log("No operator credential was read and no client registration was attempted.");
    console.log("Registration still requires the broad clients:add permission; NexusID has no Hub-specific permission, profile lookup, or idempotency key.");
    return;
  }

  // NexusID currently exposes only broad clients:add authorization for this
  // registration endpoint. Require an explicit operator acknowledgement so a
  // Hub installer cannot silently treat this manual adoption path as a
  // least-privilege, idempotent managed provisioning API.
  if (process.env.NEXUSID_ACKNOWLEDGE_BROAD_CLIENTS_ADD !== "true") {
    throw new Error("NexusID has no Hub-scoped, idempotent client provisioning API. For this operator-managed RFC 7591 registration only, set NEXUSID_ACKNOWLEDGE_BROAD_CLIENTS_ADD=true after reviewing docs/NEXUSHUB_ADOPTION.md; managed NexusHub provisioning remains gated on issuer-side ownership, authorization, transactional profile storage, and secret recovery.");
  }

  const outputPath = path.resolve(required("NEXUSHUB_OIDC_CONFIG_OUT"));
  const adminToken = required("NEXUSID_ADMIN_ACCESS_TOKEN");
  // Reserve only after discovery has succeeded. An existing file, including an
  // ambiguity marker, is never overwritten by a retry.
  let file;
  try {
    file = await open(outputPath, "wx", 0o600);
    await file.writeFile(`${JSON.stringify({ status: "registration_in_progress" }, null, 2)}\n`, "utf8");
    await file.sync();
  } catch {
    throw new Error(`Could not reserve private config at ${outputPath}; an existing file is never overwritten. If this is a stale registration_in_progress file, check NexusID Admin for an existing NexusHub client before removing it.`);
  }

  let registrationMayHaveCreatedClient = false;
  try {
    let response;
    try {
      // Redirects are forbidden so the operator bearer token cannot be forwarded
      // to a different endpoint. A timeout or connection loss remains ambiguous.
      response = await fetch(discovery.registration_endpoint, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: {
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify({
          client_name: profile.clientName,
          redirect_uris: [callbackUrl.href],
          grant_types: profile.grantTypes,
          response_types: profile.responseTypes,
          token_endpoint_auth_method: profile.tokenEndpointAuthMethod,
          scope: profile.scopes.join(" ")
        })
      });
    } catch (error) {
      registrationMayHaveCreatedClient = true;
      throw new Error(`NexusID registration outcome is ambiguous (${error instanceof Error ? error.name : "network error"}). The reservation was retained; reconcile in NexusID Admin before retrying.`);
    }

    if (!response.ok) {
      let errorCode = "registration_failed";
      try {
        const error = await parseBoundedJson(response, 64 * 1024, "NexusID registration error response");
        if (typeof error.error === "string") errorCode = error.error;
      } catch {}
      // The current NexusID handler returns these statuses before creating a
      // client: disabled/unauthorized (403/401) and validation errors (400).
      // Other statuses may originate after a write or in an intermediary.
      registrationMayHaveCreatedClient = ![400, 401, 403].includes(response.status);
      throw new Error(`NexusID client registration failed (HTTP ${response.status}, ${errorCode})${registrationMayHaveCreatedClient ? "; outcome may be ambiguous, reservation retained for manual reconciliation" : "; no client was created, safe to correct the cause and retry"}`);
    }

    registrationMayHaveCreatedClient = true;
    const client = await parseBoundedJson(response, 64 * 1024, "NexusID registration response");
    if (typeof client.client_id !== "string" || typeof client.client_secret !== "string") {
      throw new Error("NexusID returned an incomplete client registration response; reservation retained for manual reconciliation");
    }
    if (client.token_endpoint_auth_method !== profile.tokenEndpointAuthMethod) {
      throw new Error(`NexusID registered the client with ${String(client.token_endpoint_auth_method)} instead of ${profile.tokenEndpointAuthMethod}; reservation retained for manual reconciliation`);
    }
    const config = {
      issuer: discovery.issuer,
      authorizationEndpoint: discovery.authorization_endpoint,
      tokenEndpoint: discovery.token_endpoint,
      jwksUri: discovery.jwks_uri,
      clientId: client.client_id,
      clientSecret: client.client_secret,
      redirectUri: callbackUrl.href,
      scopes: profile.scopes,
      tokenEndpointAuthMethod: client.token_endpoint_auth_method
    };

    try {
      await file.truncate(0);
      const contents = Buffer.from(`${JSON.stringify(config, null, 2)}\n`, "utf8");
      const written = await file.write(contents, 0, contents.length, 0);
      if (written.bytesWritten !== contents.length) throw new Error("Incomplete credential write");
      await file.sync();
    } catch {
      throw new Error(`NexusID registered client ${client.client_id}, but its credentials could not be saved at ${outputPath}. The reservation was retained; remove this client in NexusID Admin before retrying unless the returned secret can be recovered securely.`);
    }
    await file.close();
    console.log(`Registered NexusHub OAuth client ${client.client_id}. Credentials saved to ${outputPath} with owner-only permissions.`);
  } catch (error) {
    await file.close().catch(() => {});
    if (!registrationMayHaveCreatedClient) await unlink(outputPath).catch(() => {});
    throw error;
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "NexusHub adoption failed");
  process.exitCode = 1;
});
