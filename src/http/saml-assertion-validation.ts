import { ValidationError } from "../core/errors.js";
import type { ParsedSamlAssertion } from "./samllib.js";

const SAML_STATUS_SUCCESS = "urn:oasis:names:tc:SAML:2.0:status:Success";

const countMatches = (xml: string, pattern: RegExp): number => {
  return xml.match(pattern)?.length ?? 0;
};

export const validateSamlAssertionStructure = (xml: string) => {
  const responseCount = countMatches(xml, /<samlp:Response\b/gi);
  const assertionCount = countMatches(xml, /<saml:Assertion\b/gi);
  const audienceCount = countMatches(xml, /<saml:Audience>/gi);
  const subjectConfirmationDataCount = countMatches(xml, /<saml:SubjectConfirmationData\b/gi);

  if (responseCount !== 1 || assertionCount !== 1 || audienceCount !== 1 || subjectConfirmationDataCount !== 1) {
    throw new ValidationError("SAML assertion structure is ambiguous (possible signature wrapping)");
  }
};

export const validateSamlAssertionSecurity = (input: {
  assertion: ParsedSamlAssertion;
  expectedAudience: string;
  expectedDestination: string;
  now?: Date;
  allowedClockSkewMs?: number;
}) => {
  const now = input.now ?? new Date();
  const allowedClockSkewMs = input.allowedClockSkewMs ?? 2 * 60 * 1000;

  // Audience and destination are mandatory: an assertion that omits them
  // must not be accepted just because there is nothing to compare against.
  if (!input.assertion.audience || input.assertion.audience !== input.expectedAudience) {
    throw new ValidationError("SAML assertion audience does not match service provider entityId");
  }

  if (!input.assertion.destinationUrl || input.assertion.destinationUrl !== input.expectedDestination) {
    throw new ValidationError("SAML assertion destination does not match service provider ACS URL");
  }

  if (input.assertion.statusCode && input.assertion.statusCode !== SAML_STATUS_SUCCESS) {
    throw new ValidationError("SAML response status is not Success");
  }

  if (!input.assertion.notOnOrAfter) {
    throw new ValidationError("SAML assertion is missing NotOnOrAfter");
  }

  if (input.assertion.notOnOrAfter.getTime() <= now.getTime() - allowedClockSkewMs) {
    throw new ValidationError("SAML assertion has expired");
  }

  if (input.assertion.issueInstant && input.assertion.issueInstant.getTime() > now.getTime() + allowedClockSkewMs) {
    throw new ValidationError("SAML assertion was issued in the future");
  }

  if (!input.assertion.responseId) {
    throw new ValidationError("SAML response is missing a response ID");
  }
};
