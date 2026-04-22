import { createAdminClient } from "../src/index.js";

async function main() {
  const admin = createAdminClient({
    baseUrl: "https://iam.example.com",
    auth: {
      type: "bearer",
      token: process.env.NEXUSID_ADMIN_TOKEN ?? "replace-with-admin-token"
    }
  });

  const serviceProvider = await admin.saml.serviceProviders.create({
    entityId: "https://service.example.com/saml",
    acsUrl: "https://service.example.com/saml/acs",
    nameIdFormat: "emailAddress"
  });

  console.log("Service provider created:", serviceProvider.id);

  await admin.saml.serviceProviders.uploadMetadata(serviceProvider.id, {
    metadata: "<EntityDescriptor>...</EntityDescriptor>",
    overwriteManualFields: true
  });

  await admin.saml.serviceProviders.rotateCertificate(serviceProvider.id, {
    certificateType: "signing",
    certificate: "-----BEGIN CERTIFICATE-----..."
  });

  const audits = await admin.saml.assertions.list({
    spId: serviceProvider.id,
    limit: 20,
    offset: 0
  });

  console.log("Recent assertion audits:", audits.total);
}

void main();
