import { describe, expect, it, vi } from "vitest";
import { createClient } from "../../src/core/client.js";
import { createAuthAPI } from "../../src/auth/client.js";

describe("NexusHub delegated token exchange", () => {
  it("serializes the opt-in Hub profile and signed application actor tuple", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "delegated" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    const auth = createAuthAPI(createClient({ baseUrl: "https://id.example.com", fetch: fetchMock as unknown as typeof fetch }));

    await auth.exchangeToken({
      subjectToken: "user-token",
      subjectTokenType: "urn:ietf:params:oauth:token-type:access_token",
      audience: "https://crm.example",
      scope: ["crm.conversations:read"],
      clientId: "hub-client",
      clientSecret: "hub-secret",
      nexusHubProfile: "nexushub:1",
      nexusHubInstallationId: "installation-1",
      nexusHubActorAppId: "crm-app",
      nexusHubActorRegistrationId: "registration-1",
      nexusHubActorOrganizationId: "org-1",
      nexusHubActorProjectId: "project-1"
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: "user-token",
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      requested_token_type: undefined,
      audience: "https://crm.example",
      scope: "crm.conversations:read",
      client_id: "hub-client",
      client_secret: "hub-secret",
      nexushub_profile: "nexushub:1",
      nexushub_installation_id: "installation-1",
      nexushub_actor_app_id: "crm-app",
      nexushub_actor_registration_id: "registration-1",
      nexushub_actor_organization_id: "org-1",
      nexushub_actor_project_id: "project-1"
    });
  });

  it("keeps ordinary token exchange free of NexusHub profile fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "exchanged" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    const auth = createAuthAPI(createClient({ baseUrl: "https://id.example.com", fetch: fetchMock as unknown as typeof fetch }));
    await auth.exchangeToken({ subjectToken: "token", subjectTokenType: "access_token" });
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body).not.toHaveProperty("nexushub_profile");
    expect(body).not.toHaveProperty("nexushub_installation_id");
  });
});
