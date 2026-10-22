#!/usr/bin/env node

/**
 * Adopt an existing NexusID instance into NexusHub by registering a confidential
 * OAuth client. This does not create users, roles, app assignments, or modify
 * existing clients.
 */
import { open, unlink } from "node:fs/promises";
import path from "node:path";

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
  if (url.protocol === "http:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error(`${name} must use HTTPS outside localhost`);
  }
  if (url.username || url.password || url.hash) {
    throw new Error(`${name} must not contain credentials or a fragment`);
  }
  return url;
};

const run = async () => {
  const issuerUrl = asHttpUrl(required("NEXUSID_ISSUER"), "NEXUSID_ISSUER");
  if (issuerUrl.search) throw new Error("NEXUSID_ISSUER must not contain a query string");
  issuerUrl.pathname = issuerUrl.pathname.replace(/\/+$/, "");
  issuerUrl.search = "";
  issuerUrl.hash = "";
  const hubOrigin = asHttpUrl(required("NEXUS_PUBLIC_ORIGIN"), "NEXUS_PUBLIC_ORIGIN");
  const callbackUrl = new URL("/auth/callback", hubOrigin);
  const outputPath = path.resolve(required("NEXUSHUB_OIDC_CONFIG_OUT"));
  const adminToken = required("NEXUSID_ADMIN_ACCESS_TOKEN");

  const discoveryUrl = new URL(".well-known/openid-configuration", `${issuerUrl.href.replace(/\/$/, "")}/`);
  const discoveryResponse = await fetch(discoveryUrl, { headers: { accept: "application/json" } });
  if (!discoveryResponse.ok) throw new Error(`NexusID discovery failed with HTTP ${discoveryResponse.status}`);
  const discovery = await discoveryResponse.json();
  if (discovery.issuer !== issuerUrl.href.replace(/\/$/, "")) {
    throw new Error("NexusID discovery issuer does not match NEXUSID_ISSUER");
  }
  if (!discovery.registration_endpoint || !discovery.authorization_endpoint || !discovery.token_endpoint) {
    throw new Error("NexusID discovery document is missing required OIDC endpoints");
  }

  const registerResponse = await fetch(discovery.registration_endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({
      client_name: "NexusHub",
      redirect_uris: [callbackUrl.href],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_post",
      scope: [
        "openid",
        "profile",
        "email",
        "nexushub.installations:write",
        "nexushub.operations:read",
        "nexushub.operations:resume",
        "nexushub.organizations:read",
        "nexushub.organizations:write",
        "nexushub.projects:read",
        "nexushub.projects:write",
        "nexushub.applications:read",
        "nexushub.applications:write"
      ].join(" ")
    })
  });
  if (!registerResponse.ok) {
    let errorCode = "registration_failed";
    try {
      const error = await registerResponse.json();
      if (typeof error.error === "string") errorCode = error.error;
    } catch {}
    throw new Error(`NexusID client registration failed (HTTP ${registerResponse.status}, ${errorCode})`);
  }

  const client = await registerResponse.json();
  if (typeof client.client_id !== "string" || typeof client.client_secret !== "string") {
    throw new Error("NexusID returned an incomplete client registration response");
  }

  const config = {
    issuer: discovery.issuer,
    authorizationEndpoint: discovery.authorization_endpoint,
    tokenEndpoint: discovery.token_endpoint,
    jwksUri: discovery.jwks_uri,
    clientId: client.client_id,
    clientSecret: client.client_secret,
    redirectUri: callbackUrl.href,
    scopes: [
      "openid",
      "profile",
      "email",
      "nexushub.installations:write",
      "nexushub.operations:read",
      "nexushub.operations:resume",
      "nexushub.organizations:read",
      "nexushub.organizations:write",
      "nexushub.projects:read",
      "nexushub.projects:write",
      "nexushub.applications:read",
      "nexushub.applications:write"
    ],
    tokenEndpointAuthMethod: client.token_endpoint_auth_method
  };

  let file;
  try {
    file = await open(outputPath, "wx", 0o600);
    await file.writeFile(`${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8" });
    await file.sync();
  } catch (error) {
    if (file) {
      await file.close().catch(() => {});
      await unlink(outputPath).catch(() => {});
    }
    throw new Error(`Could not create private config at ${outputPath}; no existing file was overwritten. If registration succeeded, remove the newly-created client in NexusID Admin before retrying.`);
  }
  await file.close();
  console.log(`Registered NexusHub OAuth client ${client.client_id}. Credentials saved to ${outputPath} with owner-only permissions.`);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "NexusHub adoption failed");
  process.exitCode = 1;
});
