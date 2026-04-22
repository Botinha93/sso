import { createAdminClient } from "../src/index.js";

async function main() {
  const baseUrl = "https://iam.example.com";

  // Simulate separate operator and approver personas with separate tokens.
  const userAdmin = createAdminClient({
    baseUrl,
    auth: {
      type: "bearer",
      token: process.env.NEXUSID_USER_TOKEN ?? "replace-with-user-token"
    }
  });

  const approverAdmin = createAdminClient({
    baseUrl,
    auth: {
      type: "bearer",
      token: process.env.NEXUSID_APPROVER_TOKEN ?? "replace-with-approver-token"
    }
  });

  const roleId = process.env.NEXUSID_ROLE_ID ?? "role_connector_operator";
  const userId = process.env.NEXUSID_USER_ID ?? "user_123";

  // 1) User requests elevated entitlement via access request workflow.
  const accessRequest = await userAdmin.accessRequests.create({
    subjectUserId: userId,
    entitlementType: "role",
    entitlementValue: roleId,
    justification: "Need connector rerun privileges for production incident"
  });

  console.log("Access request submitted:", accessRequest.id, accessRequest.status);

  // 2) Admin approver allows the request.
  const approvedRequest = await approverAdmin.accessRequests.approve(accessRequest.id, {
    rationale: "Approved for active Sev-1 incident window"
  });

  console.log("Access request approved:", approvedRequest.id, approvedRequest.status);

  // 3) User requests temporary elevation for a privileged action.
  const elevation = await userAdmin.elevations.create({
    resource: "connectors",
    action: "sync",
    justification: "Retry failed production sync after upstream outage",
    durationMinutes: 30
  });

  console.log("Elevation requested:", elevation.id, elevation.status);

  // 4) Admin approves and user activates the elevation session.
  const approvedElevation = await approverAdmin.elevations.approve(elevation.id, {
    rationale: "Approved for incident mitigation"
  });

  const activeElevation = await userAdmin.elevations.activate(approvedElevation.id);

  console.log("Elevation activated:", activeElevation.id, activeElevation.status);

  // Optional: check if current identity is allowed for the operation.
  const elevationAccess = await userAdmin.elevations.check({
    resource: "connectors",
    action: "sync"
  });

  console.log("Elevation access check:", elevationAccess.allowed, elevationAccess.sessionId);

  // 5) Emergency path: explicit break-glass request + immediate session.
  const breakGlass = await approverAdmin.elevations.breakGlass({
    resource: "connectors",
    action: "sync",
    reason: "Emergency override for stuck deprovisioning connector",
    requesterId: userId,
    durationMinutes: 15
  });

  console.log("Break-glass granted:", breakGlass.breakGlassId, breakGlass.session.id);
}

void main();
