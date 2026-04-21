import { ValidationError } from "../core/errors.js";
import type { ParsedSamlAssertion } from "./samllib.js";

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

  if (input.assertion.audience && input.assertion.audience !== input.expectedAudience) {
    throw new ValidationError("SAML assertion audience does not match service provider entityId");
  }

  if (input.assertion.destinationUrl && input.assertion.destinationUrl !== input.expectedDestination) {
    throw new ValidationError("SAML assertion destination does not match service provider ACS URL");
  }

  if (input.assertion.notOnOrAfter && input.assertion.notOnOrAfter.getTime() <= now.getTime() - allowedClockSkewMs) {
    throw new ValidationError("SAML assertion has expired");
  }

  if (!input.assertion.responseId) {
    throw new ValidationError("SAML response is missing a response ID");
  }
};
