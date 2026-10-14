import { createAdminClient } from "../src/index.js";

async function main() {
  const admin = createAdminClient({
    baseUrl: "https://iam.example.com",
    auth: {
      type: "bearer",
      token: process.env.NEXUSID_ADMIN_TOKEN ?? "replace-with-admin-token"
    }
  });

  const app = await admin.apps.create({
    name: "Support Console",
    description: "Internal support operations app",
    url: "https://support.example.com"
  });

  console.log("Created app:", app.id);

  const user = await admin.users.create({
    appId: app.id,
    email: "operator@example.com",
    username: "operator",
    password: "ChangeMe123!",
    givenName: "Support",
    familyName: "Operator",
    roleIds: [],
    groupIds: []
  });

  console.log("Created user:", user.id);

  await admin.users.update(user.id, {
    appId: app.id,
    active: true,
    customAttributes: { team: "support" }
  });

  const apps = await admin.apps.list();
  const users = await admin.users.list();

  console.log("Apps:", apps.length, "Users:", users.length);
}

void main();