#!/usr/bin/env node

/**
 * Adopt an existing NexusID instance into NexusHub by registering a confidential
 * OAuth client. This does not create users, roles, app assignments, or modify
 * existing clients.
 */
import { open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const profilePath = fileURLToPath(new URL("../config/nexushub-oidc-profile.json", import.meta.url));

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
  const profile = JSON.parse(await readFile(profilePath, "utf8"));

  // Reserve the destination before the remote side effect. NexusID's registration
  // endpoint does not support idempotency keys, so a second invocation must not
  // create another client when this installation already has a config file.
  let file;
  try {
    file = await open(outputPath, "wx", 0o600);
    await file.writeFile(`${JSON.stringify({ status: "registration_in_progress" }, null, 2)}\n`, "utf8");
    await file.sync();
  } catch {
    throw new Error(`Could not reserve private config at ${outputPath}; an existing file is never overwritten. If this is a stale registration_in_progress file, first check NexusID Admin for an existing NexusHub client before removing it.`);
  }

  let registrationAttempted = false;
  try {
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

    registrationAttempted = true;
    const registerResponse = await fetch(discovery.registration_endpoint, {
      method: "POST",
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
    if (!registerResponse.ok) {
      let errorCode = "registration_failed";
      try {
        const error = await registerResponse.json();
        if (typeof error.error === "string") errorCode = error.error;
      } catch {}
      throw new Error(`NexusID client registration failed (HTTP ${registerResponse.status}, ${errorCode})`);
    }

    // A successful response means a client may exist even if parsing or storing
    // the response fails; preserve the reservation for manual reconciliation.
    registrationAttempted = true;
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
      scopes: profile.scopes,
      tokenEndpointAuthMethod: client.token_endpoint_auth_method
    };

    try {
      await file.truncate(0);
      await file.writeFile(`${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8" });
      await file.sync();
    } catch {
      throw new Error(`NexusID registered client ${client.client_id}, but its credentials could not be saved at ${outputPath}. The reserved file was retained to prevent accidental duplicate registration; recover the secret from the registration response if available or remove this client in NexusID Admin before retrying.`);
    }
    await file.close();
    console.log(`Registered NexusHub OAuth client ${client.client_id}. Credentials saved to ${outputPath} with owner-only permissions.`);
  } catch (error) {
    await file.close().catch(() => {});
    if (!registrationAttempted) await unlink(outputPath).catch(() => {});
    throw error;
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "NexusHub adoption failed");
  process.exitCode = 1;
});
