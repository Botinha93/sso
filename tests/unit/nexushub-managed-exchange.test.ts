import assert from "node:assert/strict";
import test from "node:test";
import { managedNexusHubExchangeBindingMismatch } from "../../src/security/nexushub-managed-exchange.js";

const managedHub = { profileId: "nexushub" as const, profileVersion: 1 as const, installationId: "nh_installation_1" };

test("managed NexusHub exchange requires its consent-bound profile and exact installation", () => {
  assert.equal(managedNexusHubExchangeBindingMismatch(managedHub, {}), true, "generic exchange must not bypass user consent");
  assert.equal(managedNexusHubExchangeBindingMismatch(managedHub, {
    profileId: "nexushub", profileVersion: 1, installationId: "nh_installation_other"
  }), true, "a managed credential cannot assert another installation");
  assert.equal(managedNexusHubExchangeBindingMismatch(managedHub, {
    profileId: "nexushub", profileVersion: 1, installationId: managedHub.installationId
  }), false);
});

test("ordinary OAuth clients keep generic RFC 8693 exchange behavior", () => {
  assert.equal(managedNexusHubExchangeBindingMismatch(undefined, {}), false);
  assert.equal(managedNexusHubExchangeBindingMismatch({
    profileId: "liberide", profileVersion: 1, installationId: "li_installation_1"
  }, {}), false);
});
