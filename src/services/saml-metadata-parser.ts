export interface ParsedSamlServiceProviderMetadata {
  entityId?: string;
  acsUrl?: string;
  sloUrl?: string;
  signingCertificate?: string;
}

const extractAttribute = (xml: string, tagName: string, attributeName: string): string | undefined => {
  const pattern = new RegExp(`<${tagName}\\b[^>]*\\s${attributeName}=["']([^"']+)["'][^>]*>`, "i");
  return pattern.exec(xml)?.[1]?.trim();
};

const normalizeCertificate = (certificate: string): string => {
  const body = certificate
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (!body) {
    return "";
  }

  const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `-----BEGIN CERTIFICATE-----\n${wrapped}\n-----END CERTIFICATE-----`;
};

export const parseSamlServiceProviderMetadata = (metadataXml: string): ParsedSamlServiceProviderMetadata => {
  const xml = metadataXml.trim();

  const entityMatch = /<EntityDescriptor\b[^>]*\bentityID=["']([^"']+)["'][^>]*>/i.exec(xml);
  const acsUrl = extractAttribute(xml, "AssertionConsumerService", "Location");
  const sloUrl = extractAttribute(xml, "SingleLogoutService", "Location");
  const certificateMatch = /<X509Certificate>([\s\S]*?)<\/X509Certificate>/i.exec(xml);

  const parsed: ParsedSamlServiceProviderMetadata = {
    entityId: entityMatch?.[1]?.trim(),
    acsUrl,
    sloUrl
  };

  if (certificateMatch?.[1]) {
    const normalized = normalizeCertificate(certificateMatch[1]);
    if (normalized) {
      parsed.signingCertificate = normalized;
    }
  }

  return parsed;
};
