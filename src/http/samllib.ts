import { Buffer } from "node:buffer";
import { nanoid } from "nanoid";

export interface ParsedSamlAssertion {
  responseId?: string;
  requestId?: string;
  assertionId?: string;
  audience?: string;
  subject?: string;
  destinationUrl?: string;
  issueInstant?: Date;
  notOnOrAfter?: Date;
  statusCode?: string;
}

export interface ExtractedSamlSignature {
  unsignedXml: string;
  signature: string;
  keyId?: string;
}

const escapeXml = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const isoTimestamp = (value: Date): string => value.toISOString();

const extract = (xml: string, pattern: RegExp): string | undefined => {
  const match = xml.match(pattern);
  return match?.[1];
};

const parseDate = (value: string | undefined): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const createUnsignedSamlResponse = (input: {
  issuer: string;
  audience: string;
  destinationUrl: string;
  subject: string;
  inResponseTo?: string;
  nameIdFormat: "persistent" | "transient" | "emailAddress";
  relayState?: string;
  lifetimeSeconds?: number;
}) => {
  const now = new Date();
  const lifetimeSeconds = Math.max(30, input.lifetimeSeconds ?? 300);
  const notOnOrAfter = new Date(now.getTime() + (lifetimeSeconds * 1000));
  const responseId = `_${nanoid()}`;
  const assertionId = `_${nanoid()}`;

  const nameIdFormat = input.nameIdFormat === "emailAddress"
    ? "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
    : input.nameIdFormat === "transient"
      ? "urn:oasis:names:tc:SAML:2.0:nameid-format:transient"
      : "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:Response
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${escapeXml(responseId)}"
  Version="2.0"
  IssueInstant="${isoTimestamp(now)}"
  Destination="${escapeXml(input.destinationUrl)}"
  ${input.inResponseTo ? `InResponseTo="${escapeXml(input.inResponseTo)}"` : ""}
>
  <saml:Issuer>${escapeXml(input.issuer)}</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success" />
  </samlp:Status>
  <saml:Assertion ID="${escapeXml(assertionId)}" Version="2.0" IssueInstant="${isoTimestamp(now)}">
    <saml:Issuer>${escapeXml(input.issuer)}</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="${nameIdFormat}">${escapeXml(input.subject)}</saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData NotOnOrAfter="${isoTimestamp(notOnOrAfter)}" Recipient="${escapeXml(input.destinationUrl)}" ${input.inResponseTo ? `InResponseTo="${escapeXml(input.inResponseTo)}"` : ""} />
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="${isoTimestamp(now)}" NotOnOrAfter="${isoTimestamp(notOnOrAfter)}">
      <saml:AudienceRestriction>
        <saml:Audience>${escapeXml(input.audience)}</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AuthnStatement AuthnInstant="${isoTimestamp(now)}" SessionIndex="_${nanoid()}">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>
  </saml:Assertion>
</samlp:Response>`;

  return {
    responseId,
    assertionId,
    issueInstant: now,
    notOnOrAfter,
    relayState: input.relayState,
    xml,
    encoded: Buffer.from(xml, "utf-8").toString("base64")
  };
};

export const decodeSamlResponse = (encoded: string): string => {
  return Buffer.from(encoded, "base64").toString("utf-8");
};

export const attachSamlSignature = (input: { xml: string; signature: string; keyId: string }) => {
  const signatureTag = `<saml:Signature xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" Algorithm="rsa-sha256" KeyId="${escapeXml(input.keyId)}">${escapeXml(input.signature)}</saml:Signature>`;
  if (!input.xml.includes("</samlp:Response>")) {
    throw new Error("SAML response XML is missing closing Response tag");
  }

  return input.xml.replace("</samlp:Response>", `  ${signatureTag}\n</samlp:Response>`);
};

export const extractSamlSignature = (xml: string): ExtractedSamlSignature | undefined => {
  const signatureMatch = xml.match(/\s*<saml:Signature\b([^>]*)>([^<]+)<\/saml:Signature>\s*<\/samlp:Response>\s*$/is);
  if (!signatureMatch) {
    return undefined;
  }

  const attributes = signatureMatch[1] ?? "";
  const signature = signatureMatch[2]?.trim();
  if (!signature) {
    return undefined;
  }

  const keyId = attributes.match(/\bKeyId="([^"]+)"/i)?.[1];
  const unsignedXml = xml.replace(signatureMatch[0], "\n</samlp:Response>");

  return {
    unsignedXml,
    signature,
    keyId
  };
};

export const parseSamlAssertion = (xml: string): ParsedSamlAssertion => {
  const responseId = extract(xml, /<samlp:Response[^>]*\sID="([^"]+)"/i);
  const requestId = extract(xml, /<samlp:Response[^>]*\sInResponseTo="([^"]+)"/i);
  const destinationUrl = extract(xml, /<samlp:Response[^>]*\sDestination="([^"]+)"/i);
  const assertionId = extract(xml, /<saml:Assertion[^>]*\sID="([^"]+)"/i);
  const audience = extract(xml, /<saml:Audience>([^<]+)<\/saml:Audience>/i);
  const subject = extract(xml, /<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/i);
  const statusCode = extract(xml, /<samlp:StatusCode[^>]*\sValue="([^"]+)"/i);

  const issueInstant = parseDate(
    extract(xml, /<saml:Assertion[^>]*\sIssueInstant="([^"]+)"/i)
      ?? extract(xml, /<samlp:Response[^>]*\sIssueInstant="([^"]+)"/i)
  );

  const notOnOrAfter = parseDate(
    extract(xml, /<saml:SubjectConfirmationData[^>]*\sNotOnOrAfter="([^"]+)"/i)
      ?? extract(xml, /<saml:Conditions[^>]*\sNotOnOrAfter="([^"]+)"/i)
  );

  return {
    responseId,
    requestId,
    assertionId,
    audience,
    subject,
    destinationUrl,
    issueInstant,
    notOnOrAfter,
    statusCode
  };
};
