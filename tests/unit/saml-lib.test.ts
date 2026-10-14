import test from "node:test";
import assert from "node:assert/strict";
import { createUnsignedSamlResponse, decodeSamlResponse, parseSamlAssertion } from "../../src/http/samllib.js";
import { validateSamlAssertionSecurity, validateSamlAssertionStructure } from "../../src/http/saml-assertion-validation.js";
import { SamlReplayProtectionService } from "../../src/services/saml-replay-protection-service.js";
import { SamlSignatureService } from "../../src/services/saml-signature-service.js";

test("SAML utility builds and parses unsigned response payload", () => {
  const generated = createUnsignedSamlResponse({
    issuer: "northstar:sso:idp",
    audience: "https://app.example/sp",
    destinationUrl: "https://app.example/saml/acs",
    subject: "alice@example.com",
    nameIdFormat: "emailAddress",
    inResponseTo: "req-123"
  });

  const xml = decodeSamlResponse(generated.encoded);
  const parsed = parseSamlAssertion(xml);

  assert.equal(parsed.subject, "alice@example.com");
  assert.equal(parsed.audience, "https://app.example/sp");
  assert.equal(parsed.destinationUrl, "https://app.example/saml/acs");
  assert.equal(parsed.requestId, "req-123");
  assert.equal(parsed.responseId, generated.responseId);
  assert.equal(parsed.assertionId, generated.assertionId);
});

test("SAML assertion validator rejects audience mismatch", () => {
  assert.throws(() => {
    validateSamlAssertionSecurity({
      assertion: {
        responseId: "resp-1",
        audience: "https://other.example/sp",
        destinationUrl: "https://app.example/saml/acs",
        notOnOrAfter: new Date(Date.now() + 60_000)
      },
      expectedAudience: "https://app.example/sp",
      expectedDestination: "https://app.example/saml/acs"
    });
  }, /audience/);
});

test("SAML assertion validator rejects expired assertions with skew", () => {
  assert.throws(() => {
    validateSamlAssertionSecurity({
      assertion: {
        responseId: "resp-2",
        audience: "https://app.example/sp",
        destinationUrl: "https://app.example/saml/acs",
        notOnOrAfter: new Date(Date.now() - 5 * 60_000)
      },
      expectedAudience: "https://app.example/sp",
      expectedDestination: "https://app.example/saml/acs",
      allowedClockSkewMs: 30_000
    });
  }, /expired/);
});

test("SAML assertion structure validator rejects wrapping-like duplicate assertions", () => {
  const xml = `
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
  <saml:Assertion ID="_a1">
    <saml:Conditions><saml:AudienceRestriction><saml:Audience>https://app.example/sp</saml:Audience></saml:AudienceRestriction></saml:Conditions>
    <saml:Subject><saml:SubjectConfirmation><saml:SubjectConfirmationData Recipient="https://app.example/saml/acs" /></saml:SubjectConfirmation></saml:Subject>
  </saml:Assertion>
  <saml:Assertion ID="_a2">
    <saml:Conditions><saml:AudienceRestriction><saml:Audience>https://app.example/sp</saml:Audience></saml:AudienceRestriction></saml:Conditions>
    <saml:Subject><saml:SubjectConfirmation><saml:SubjectConfirmationData Recipient="https://app.example/saml/acs" /></saml:SubjectConfirmation></saml:Subject>
  </saml:Assertion>
</samlp:Response>`;

  assert.throws(() => {
    validateSamlAssertionStructure(xml);
  }, /wrapping/i);
});

test("SAML replay protection reserves first use and blocks replay", () => {
  const replay = new SamlReplayProtectionService(10_000);
  const notOnOrAfter = new Date(Date.now() + 60_000);

  const first = replay.reserve("response-123", notOnOrAfter);
  const second = replay.reserve("response-123", notOnOrAfter);

  assert.equal(first, true);
  assert.equal(second, false);
});

test("SAML signature service signs and verifies response XML", () => {
  const service = new SamlSignatureService("unit-test-kid");
  const generated = createUnsignedSamlResponse({
    issuer: "northstar:sso:idp",
    audience: "https://app.example/sp",
    destinationUrl: "https://app.example/saml/acs",
    subject: "alice@example.com",
    nameIdFormat: "emailAddress"
  });

  const signed = service.signResponseXml(generated.xml);
  const verified = service.verifyResponseXml(signed.xml);

  assert.equal(verified.valid, true);
  assert.equal(verified.keyId, "unit-test-kid");
  assert.ok(verified.unsignedXml?.includes("<samlp:Response"));
});

test("SAML signature service rejects tampered signed XML", () => {
  const service = new SamlSignatureService("unit-test-kid");
  const generated = createUnsignedSamlResponse({
    issuer: "northstar:sso:idp",
    audience: "https://app.example/sp",
    destinationUrl: "https://app.example/saml/acs",
    subject: "alice@example.com",
    nameIdFormat: "emailAddress"
  });

  const signed = service.signResponseXml(generated.xml);
  const tampered = signed.xml.replace("https://app.example/sp", "https://evil.example/sp");
  const verified = service.verifyResponseXml(tampered);

  assert.equal(verified.valid, false);
  assert.match(verified.reason ?? "", /invalid/i);
});
