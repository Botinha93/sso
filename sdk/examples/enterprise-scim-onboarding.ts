import { createAdminClient } from "../src/index.js";

async function main() {
  const admin = createAdminClient({
    baseUrl: "https://iam.example.com",
    auth: {
      type: "bearer",
      token: process.env.NEXUSID_ADMIN_TOKEN ?? "replace-with-admin-token"
    }
  });

  const token = await admin.provisioning.tokens.create({
    label: "HRIS SCIM Provisioning",
    expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60_000).toISOString()
  });

  console.log("Provisioning token created:", token.id);

  await admin.provisioning.mappings.create({
    name: "Department To OU",
    sourceAttribute: "department",
    targetAttribute: "ou",
    enabled: true
  });

  await admin.provisioning.mappings.create({
    name: "Cost Center To Employee Type",
    sourceAttribute: "costCenter",
    targetAttribute: "employeeType",
    transformExpression: "String(value).toUpperCase()",
    enabled: true
  });

  const dryRunJob = await admin.provisioning.reconciliation.runReconcile({ dryRun: true });
  console.log("Dry run summary:", dryRunJob.summary);

  const liveJob = await admin.provisioning.reconciliation.runReconcile({ dryRun: false });
  console.log("Live reconcile status:", liveJob.status);
}

void main();
