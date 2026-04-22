import { createAdminClient } from "../src/index.js";

async function main() {
  const admin = createAdminClient({
    baseUrl: "https://iam.example.com",
    auth: {
      type: "bearer",
      token: process.env.NEXUSID_ADMIN_TOKEN ?? "replace-with-admin-token"
    }
  });

  const role = await admin.roles.create({
    name: "connector-operator",
    description: "Can run and inspect connector jobs",
    permissions: ["connectors.read", "connectors.sync"],
    scope: "platform"
  });

  const group = await admin.groups.create({
    name: "Operations",
    description: "Operations team group",
    roleIds: []
  });

  await admin.groups.assignRole({
    groupId: group.id,
    roleId: role.id
  });

  await admin.groups.assignUser({
    groupId: group.id,
    userId: "user_123"
  });

  const roles = await admin.roles.list();
  const groups = await admin.groups.list();

  console.log("Roles:", roles.length, "Groups:", groups.length);
}

void main();