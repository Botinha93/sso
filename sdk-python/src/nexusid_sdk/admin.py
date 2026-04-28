from __future__ import annotations

from typing import Any, cast

from .client import NexusIDClient, RetryPolicy
from .generated import models as gm


class AccessRequestsAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self, **query: Any) -> gm.GetApiAdminAccessRequestsResponse:
        return cast(gm.GetApiAdminAccessRequestsResponse, self._client.get("/api/admin/access-requests", query=query))

    def create(self, payload: gm.PostApiAdminAccessRequestsRequestBody) -> gm.PostApiAdminAccessRequestsResponse:
        return cast(gm.PostApiAdminAccessRequestsResponse, self._client.post("/api/admin/access-requests", body=payload))

    def approve(
        self,
        request_id: str,
        payload: gm.PostApiAdminAccessRequestsByIdApproveRequestBody | None = None,
    ) -> gm.PostApiAdminAccessRequestsByIdApproveResponse:
        return cast(
            gm.PostApiAdminAccessRequestsByIdApproveResponse,
            self._client.post(f"/api/admin/access-requests/{request_id}/approve", body=payload or {}),
        )

    def reject(
        self,
        request_id: str,
        payload: gm.PostApiAdminAccessRequestsByIdRejectRequestBody | None = None,
    ) -> gm.PostApiAdminAccessRequestsByIdRejectResponse:
        return cast(
            gm.PostApiAdminAccessRequestsByIdRejectResponse,
            self._client.post(f"/api/admin/access-requests/{request_id}/reject", body=payload or {}),
        )

    def process_expirations(self, *, dry_run: bool = False) -> gm.PostApiAdminAccessRequestsProcessExpirationsResponse:
        payload: gm.PostApiAdminAccessRequestsProcessExpirationsRequestBody = {"dryRun": dry_run}
        return cast(gm.PostApiAdminAccessRequestsProcessExpirationsResponse, self._client.post(
            "/api/admin/access-requests/process-expirations",
            body=payload,
        ))

    def stalled(self, *, stalled_after_minutes: int) -> gm.GetApiAdminAccessRequestsStalledResponse:
        return cast(gm.GetApiAdminAccessRequestsStalledResponse, self._client.get(
            "/api/admin/access-requests/stalled",
            query={"stalledAfterMinutes": stalled_after_minutes},
        ))


class ElevationsAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self, **query: Any) -> gm.GetApiAdminElevationsResponse:
        return cast(gm.GetApiAdminElevationsResponse, self._client.get("/api/admin/elevations", query=query))

    def create(self, payload: gm.PostApiAdminElevationsRequestBody) -> gm.PostApiAdminElevationsResponse:
        return cast(gm.PostApiAdminElevationsResponse, self._client.post("/api/admin/elevations", body=payload))

    def get(self, elevation_id: str) -> gm.GetApiAdminElevationsByIdResponse:
        return cast(gm.GetApiAdminElevationsByIdResponse, self._client.get(f"/api/admin/elevations/{elevation_id}"))

    def sessions(self, **query: Any) -> gm.GetApiAdminElevationsSessionsResponse:
        return cast(gm.GetApiAdminElevationsSessionsResponse, self._client.get("/api/admin/elevations/sessions", query=query))

    def approve(
        self,
        elevation_id: str,
        payload: gm.PostApiAdminElevationsByIdApproveRequestBody | None = None,
    ) -> gm.PostApiAdminElevationsByIdApproveResponse:
        return cast(
            gm.PostApiAdminElevationsByIdApproveResponse,
            self._client.post(f"/api/admin/elevations/{elevation_id}/approve", body=payload or {}),
        )

    def activate(self, elevation_id: str) -> gm.PostApiAdminElevationsByIdActivateResponse:
        return cast(gm.PostApiAdminElevationsByIdActivateResponse, self._client.post(f"/api/admin/elevations/{elevation_id}/activate"))

    def revoke(
        self,
        elevation_id: str,
        payload: gm.PostApiAdminElevationsByIdRevokeRequestBody | None = None,
    ) -> gm.PostApiAdminElevationsByIdRevokeResponse:
        return cast(
            gm.PostApiAdminElevationsByIdRevokeResponse,
            self._client.post(f"/api/admin/elevations/{elevation_id}/revoke", body=payload or {}),
        )

    def process_expirations(self) -> gm.PostApiAdminElevationsProcessExpirationsResponse:
        return cast(gm.PostApiAdminElevationsProcessExpirationsResponse, self._client.post("/api/admin/elevations/process-expirations"))

    def check(self, *, resource: str, action: str) -> gm.PostApiAdminElevationsCheckResponse:
        payload: gm.PostApiAdminElevationsCheckRequestBody = {"resource": resource, "action": action}
        return cast(gm.PostApiAdminElevationsCheckResponse, self._client.post("/api/admin/elevations/check", body=payload))

    def break_glass(self, payload: gm.PostApiAdminElevationsBreakGlassRequestBody) -> gm.PostApiAdminElevationsBreakGlassResponse:
        return cast(gm.PostApiAdminElevationsBreakGlassResponse, self._client.post("/api/admin/elevations/break-glass", body=payload))


class UsersAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self, **query: Any) -> gm.GetApiAdminUsersResponse:
        return cast(gm.GetApiAdminUsersResponse, self._client.get("/api/admin/users", query=query))

    def create(self, payload: gm.PostApiAdminUsersRequestBody) -> gm.PostApiAdminUsersResponse:
        return cast(gm.PostApiAdminUsersResponse, self._client.post("/api/admin/users", body=payload))

    def update(self, user_id: str, payload: gm.PatchApiAdminUsersByIdRequestBody) -> gm.PatchApiAdminUsersByIdResponse:
        return cast(gm.PatchApiAdminUsersByIdResponse, self._client.patch(f"/api/admin/users/{user_id}", body=payload))

    def reset_password(self, user_id: str, payload: gm.PostApiAdminUsersByIdResetPasswordRequestBody) -> None:
        self._client.post(f"/api/admin/users/{user_id}/reset-password", body=payload)

    def delete(self, user_id: str) -> None:
        self._client.delete(f"/api/admin/users/{user_id}")


class RolesAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self) -> gm.GetApiAdminRolesResponse:
        return cast(gm.GetApiAdminRolesResponse, self._client.get("/api/admin/roles"))

    def create(self, payload: gm.PostApiAdminRolesRequestBody) -> gm.PostApiAdminRolesResponse:
        return cast(gm.PostApiAdminRolesResponse, self._client.post("/api/admin/roles", body=payload))

    def update(self, role_id: str, payload: gm.PutApiAdminRolesByIdRequestBody) -> gm.PutApiAdminRolesByIdResponse:
        return cast(gm.PutApiAdminRolesByIdResponse, self._client.put(f"/api/admin/roles/{role_id}", body=payload))

    def delete(self, role_id: str) -> None:
        self._client.delete(f"/api/admin/roles/{role_id}")


class OAuthClientsAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self, **query: Any) -> gm.GetApiAdminClientsResponse:
        return cast(gm.GetApiAdminClientsResponse, self._client.get("/api/admin/clients", query=query))

    def create(self, payload: gm.PostApiAdminClientsRequestBody) -> gm.PostApiAdminClientsResponse:
        return cast(gm.PostApiAdminClientsResponse, self._client.post("/api/admin/clients", body=payload))

    def update(self, client_id: str, payload: gm.PutApiAdminClientsByIdRequestBody) -> gm.PutApiAdminClientsByIdResponse:
        return cast(gm.PutApiAdminClientsByIdResponse, self._client.put(f"/api/admin/clients/{client_id}", body=payload))

    def delete(self, client_id: str) -> None:
        self._client.delete(f"/api/admin/clients/{client_id}")


class AppsAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self, **query: Any) -> list[dict[str, Any]]:
        return cast(list[dict[str, Any]], self._client.get("/api/admin/apps", query=query or None))

    def create(self, payload: dict[str, Any]) -> dict[str, Any]:
        return cast(dict[str, Any], self._client.post("/api/admin/apps", body=payload))

    def update(self, app_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return cast(dict[str, Any], self._client.put(f"/api/admin/apps/{app_id}", body=payload))

    def delete(self, app_id: str) -> None:
        self._client.delete(f"/api/admin/apps/{app_id}")


class ProvisioningTokensAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self) -> gm.GetApiAdminProvisioningTokensResponse:
        return cast(gm.GetApiAdminProvisioningTokensResponse, self._client.get("/api/admin/provisioning/tokens"))

    def create(self, payload: gm.PostApiAdminProvisioningTokensRequestBody) -> gm.PostApiAdminProvisioningTokensResponse:
        return cast(gm.PostApiAdminProvisioningTokensResponse, self._client.post("/api/admin/provisioning/tokens", body=payload))

    def revoke(self, token_id: str) -> gm.DeleteApiAdminProvisioningTokensByIdResponse:
        self._client.delete(f"/api/admin/provisioning/tokens/{token_id}")
        return None


class ProvisioningMappingsAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self) -> gm.GetApiAdminProvisioningMappingsResponse:
        return cast(gm.GetApiAdminProvisioningMappingsResponse, self._client.get("/api/admin/provisioning/mappings"))

    def create(self, payload: gm.PostApiAdminProvisioningMappingsRequestBody) -> gm.PostApiAdminProvisioningMappingsResponse:
        return cast(gm.PostApiAdminProvisioningMappingsResponse, self._client.post("/api/admin/provisioning/mappings", body=payload))

    def delete(self, mapping_id: str) -> gm.DeleteApiAdminProvisioningMappingsByIdResponse:
        self._client.delete(f"/api/admin/provisioning/mappings/{mapping_id}")
        return None


class ReconciliationAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def jobs(self, **query: Any) -> gm.GetApiAdminProvisioningJobsResponse:
        return cast(gm.GetApiAdminProvisioningJobsResponse, self._client.get("/api/admin/provisioning/jobs", query=query))

    def queue(self, *, limit: int | None = None) -> gm.GetApiAdminProvisioningDeprovisioningQueueResponse:
        query = {"limit": limit} if limit is not None else None
        return cast(gm.GetApiAdminProvisioningDeprovisioningQueueResponse, self._client.get("/api/admin/provisioning/deprovisioning-queue", query=query))

    def reconcile(
        self,
        payload: gm.PostApiAdminProvisioningJobsReconcileRequestBody | None = None,
    ) -> gm.PostApiAdminProvisioningJobsReconcileResponse:
        return cast(gm.PostApiAdminProvisioningJobsReconcileResponse, self._client.post("/api/admin/provisioning/jobs/reconcile", body=payload or {}))


class ProvisioningAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self.tokens = ProvisioningTokensAPI(client)
        self.mappings = ProvisioningMappingsAPI(client)
        self.reconciliation = ReconciliationAPI(client)


class ServiceIdentitiesAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self) -> gm.GetApiAdminServiceIdentitiesResponse:
        return cast(gm.GetApiAdminServiceIdentitiesResponse, self._client.get("/api/admin/service-identities"))

    def create(self, payload: gm.PostApiAdminServiceIdentitiesRequestBody) -> gm.PostApiAdminServiceIdentitiesResponse:
        return cast(gm.PostApiAdminServiceIdentitiesResponse, self._client.post("/api/admin/service-identities", body=payload))

    def get(self, identity_id: str) -> gm.GetApiAdminServiceIdentitiesByIdResponse:
        return cast(gm.GetApiAdminServiceIdentitiesByIdResponse, self._client.get(f"/api/admin/service-identities/{identity_id}"))

    def update(self, identity_id: str, payload: gm.PatchApiAdminServiceIdentitiesByIdRequestBody) -> gm.PatchApiAdminServiceIdentitiesByIdResponse:
        return cast(gm.PatchApiAdminServiceIdentitiesByIdResponse, self._client.patch(f"/api/admin/service-identities/{identity_id}", body=payload))

    def delete(self, identity_id: str) -> gm.DeleteApiAdminServiceIdentitiesByIdResponse:
        self._client.delete(f"/api/admin/service-identities/{identity_id}")
        return None

    def issue_credential(
        self,
        identity_id: str,
        payload: gm.PostApiAdminServiceIdentitiesByIdCredentialsRequestBody | None = None,
    ) -> gm.PostApiAdminServiceIdentitiesByIdCredentialsResponse:
        return cast(gm.PostApiAdminServiceIdentitiesByIdCredentialsResponse, self._client.post(
            f"/api/admin/service-identities/{identity_id}/credentials",
            body=payload or {},
        ))

    def rotate_credential(
        self,
        identity_id: str,
        payload: gm.PostApiAdminServiceIdentitiesByIdCredentialsRotateRequestBody,
    ) -> gm.PostApiAdminServiceIdentitiesByIdCredentialsRotateResponse:
        return cast(gm.PostApiAdminServiceIdentitiesByIdCredentialsRotateResponse, self._client.post(
            f"/api/admin/service-identities/{identity_id}/credentials/rotate",
            body=payload,
        ))

    def revoke_credential(self, identity_id: str, credential_id: str) -> gm.DeleteApiAdminServiceIdentitiesByIdCredentialsByCredentialIdResponse:
        self._client.delete(f"/api/admin/service-identities/{identity_id}/credentials/{credential_id}")
        return None

    def usage(self, identity_id: str) -> gm.GetApiAdminServiceIdentitiesByIdUsageResponse:
        return cast(gm.GetApiAdminServiceIdentitiesByIdUsageResponse, self._client.get(f"/api/admin/service-identities/{identity_id}/usage"))


class ConnectorsAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self) -> gm.GetApiAdminConnectorsResponse:
        return cast(gm.GetApiAdminConnectorsResponse, self._client.get("/api/admin/connectors"))

    def create(self, payload: gm.PostApiAdminConnectorsRequestBody) -> gm.PostApiAdminConnectorsResponse:
        return cast(gm.PostApiAdminConnectorsResponse, self._client.post("/api/admin/connectors", body=payload))

    def get(self, connector_id: str) -> gm.GetApiAdminConnectorsByIdResponse:
        return cast(gm.GetApiAdminConnectorsByIdResponse, self._client.get(f"/api/admin/connectors/{connector_id}"))

    def update(self, connector_id: str, payload: gm.PatchApiAdminConnectorsByIdRequestBody) -> gm.PatchApiAdminConnectorsByIdResponse:
        return cast(gm.PatchApiAdminConnectorsByIdResponse, self._client.patch(f"/api/admin/connectors/{connector_id}", body=payload))

    def delete(self, connector_id: str) -> gm.DeleteApiAdminConnectorsByIdResponse:
        self._client.delete(f"/api/admin/connectors/{connector_id}")
        return None

    def sync(self, connector_id: str) -> gm.PostApiAdminConnectorsByIdSyncResponse:
        return cast(gm.PostApiAdminConnectorsByIdSyncResponse, self._client.post(f"/api/admin/connectors/{connector_id}/sync"))

    def runs(self, connector_id: str, *, limit: int | None = None) -> gm.GetApiAdminConnectorsByIdRunsResponse:
        query = {"limit": limit} if limit is not None else None
        return cast(gm.GetApiAdminConnectorsByIdRunsResponse, self._client.get(f"/api/admin/connectors/{connector_id}/runs", query=query))

    def mappings(self, connector_id: str) -> gm.GetApiAdminConnectorsByIdMappingsResponse:
        return cast(gm.GetApiAdminConnectorsByIdMappingsResponse, self._client.get(f"/api/admin/connectors/{connector_id}/mappings"))

    def create_mapping(self, connector_id: str, payload: gm.PostApiAdminConnectorsByIdMappingsRequestBody) -> gm.PostApiAdminConnectorsByIdMappingsResponse:
        return cast(gm.PostApiAdminConnectorsByIdMappingsResponse, self._client.post(f"/api/admin/connectors/{connector_id}/mappings", body=payload))

    def delete_mapping(self, connector_id: str, mapping_id: str) -> gm.DeleteApiAdminConnectorsByConnectorIdMappingsByMappingIdResponse:
        self._client.delete(f"/api/admin/connectors/{connector_id}/mappings/{mapping_id}")
        return None


class SamlServiceProvidersAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self, **query: Any) -> gm.GetApiAdminSamlServiceProvidersResponse:
        return cast(gm.GetApiAdminSamlServiceProvidersResponse, self._client.get("/api/admin/saml/service-providers", query=query))

    def create(self, payload: gm.PostApiAdminSamlServiceProvidersRequestBody) -> gm.PostApiAdminSamlServiceProvidersResponse:
        return cast(gm.PostApiAdminSamlServiceProvidersResponse, self._client.post("/api/admin/saml/service-providers", body=payload))

    def get(self, service_provider_id: str) -> gm.GetApiAdminSamlServiceProvidersByIdResponse:
        return cast(gm.GetApiAdminSamlServiceProvidersByIdResponse, self._client.get(f"/api/admin/saml/service-providers/{service_provider_id}"))

    def update(self, service_provider_id: str, payload: gm.PatchApiAdminSamlServiceProvidersByIdRequestBody) -> gm.PatchApiAdminSamlServiceProvidersByIdResponse:
        return cast(gm.PatchApiAdminSamlServiceProvidersByIdResponse, self._client.patch(f"/api/admin/saml/service-providers/{service_provider_id}", body=payload))

    def delete(self, service_provider_id: str) -> gm.DeleteApiAdminSamlServiceProvidersByIdResponse:
        self._client.delete(f"/api/admin/saml/service-providers/{service_provider_id}")
        return None

    def upload_metadata(
        self,
        service_provider_id: str,
        payload: gm.PostApiAdminSamlServiceProvidersByIdMetadataRequestBody,
    ) -> gm.PostApiAdminSamlServiceProvidersByIdMetadataResponse:
        return cast(gm.PostApiAdminSamlServiceProvidersByIdMetadataResponse, self._client.post(
            f"/api/admin/saml/service-providers/{service_provider_id}/metadata",
            body=payload,
        ))

    def rotate_certificate(
        self,
        service_provider_id: str,
        payload: gm.PostApiAdminSamlServiceProvidersByIdCertificatesRotateRequestBody,
    ) -> gm.PostApiAdminSamlServiceProvidersByIdCertificatesRotateResponse:
        return cast(gm.PostApiAdminSamlServiceProvidersByIdCertificatesRotateResponse, self._client.post(
            f"/api/admin/saml/service-providers/{service_provider_id}/certificates/rotate",
            body=payload,
        ))


class SamlAssertionAuditsAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self, **query: Any) -> gm.GetApiAdminSamlAssertionsResponse:
        return cast(gm.GetApiAdminSamlAssertionsResponse, self._client.get("/api/admin/saml/assertions", query=query))


class SamlAdminAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self.service_providers = SamlServiceProvidersAPI(client)
        self.assertions = SamlAssertionAuditsAPI(client)


class GroupsAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self) -> gm.GetApiAdminGroupsResponse:
        return cast(gm.GetApiAdminGroupsResponse, self._client.get("/api/admin/groups"))

    def create(self, payload: gm.PostApiAdminGroupsRequestBody) -> gm.PostApiAdminGroupsResponse:
        return cast(gm.PostApiAdminGroupsResponse, self._client.post("/api/admin/groups", body=payload))

    def update(self, group_id: str, payload: gm.PutApiAdminGroupsByIdRequestBody) -> gm.PutApiAdminGroupsByIdResponse:
        return cast(gm.PutApiAdminGroupsByIdResponse, self._client.put(f"/api/admin/groups/{group_id}", body=payload))

    def delete(self, group_id: str) -> None:
        self._client.delete(f"/api/admin/groups/{group_id}")

    def assign_role(self, payload: gm.PostApiAdminGroupRoleAssignmentsRequestBody) -> None:
        self._client.post("/api/admin/group-role-assignments", body=payload)

    def remove_role(self, payload: gm.AssignGroupRoleRequestBody) -> None:
        self._client.delete("/api/admin/group-role-assignments", body=payload)

    def assign_user(self, payload: gm.PostApiAdminUserGroupsRequestBody) -> None:
        self._client.post("/api/admin/user-groups", body=payload)

    def remove_user(self, payload: gm.AssignUserGroupRequestBody) -> None:
        self._client.delete("/api/admin/user-groups", body=payload)


class ScopesAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self) -> gm.GetApiAdminScopesResponse:
        return cast(gm.GetApiAdminScopesResponse, self._client.get("/api/admin/scopes"))

    def create(self, payload: gm.PostApiAdminScopesRequestBody) -> gm.PostApiAdminScopesResponse:
        return cast(gm.PostApiAdminScopesResponse, self._client.post("/api/admin/scopes", body=payload))

    def delete(self, scope_id: str) -> None:
        self._client.delete(f"/api/admin/scopes/{scope_id}")


class TenantsAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self) -> gm.GetApiAdminTenantsResponse:
        return cast(gm.GetApiAdminTenantsResponse, self._client.get("/api/admin/tenants"))

    def create(self, payload: gm.PostApiAdminTenantsRequestBody) -> gm.PostApiAdminTenantsResponse:
        return cast(gm.PostApiAdminTenantsResponse, self._client.post("/api/admin/tenants", body=payload))

    def update(self, tenant_id: str, payload: gm.PutApiAdminTenantsRequestBody) -> gm.PutApiAdminTenantsResponse:
        return cast(gm.PutApiAdminTenantsResponse, self._client.put(f"/api/admin/tenants/{tenant_id}", body=payload))


class SessionsAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self) -> gm.GetApiAdminSessionsResponse:
        return cast(gm.GetApiAdminSessionsResponse, self._client.get("/api/admin/sessions"))

    def revoke(self, session_id: str) -> None:
        self._client.delete(f"/api/admin/sessions/{session_id}")


class ConsentsAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self) -> gm.GetApiAdminConsentsResponse:
        return cast(gm.GetApiAdminConsentsResponse, self._client.get("/api/admin/consents"))

    def revoke(self, consent_id: str) -> None:
        self._client.delete(f"/api/admin/consents/{consent_id}")


class DevicesAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self) -> gm.GetApiAdminDevicesResponse:
        return cast(gm.GetApiAdminDevicesResponse, self._client.get("/api/admin/devices"))

    def revoke_request(self, device_code: str) -> None:
        self._client.delete(f"/api/admin/devices/requests/{device_code}")

    def revoke_session(self, session_id: str) -> None:
        self._client.delete(f"/api/admin/devices/sessions/{session_id}")


class AuditAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self, *, limit: int | None = None) -> gm.GetApiAdminAuditResponse:
        query = {"limit": limit} if limit is not None else None
        return cast(gm.GetApiAdminAuditResponse, self._client.get("/api/admin/audit", query=query))


class AuthenticationFlowsAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self) -> gm.GetApiAdminAuthenticationFlowsResponse:
        return cast(gm.GetApiAdminAuthenticationFlowsResponse, self._client.get("/api/admin/authentication/flows"))

    def create(self, payload: gm.PostApiAdminAuthenticationFlowsRequestBody) -> gm.PostApiAdminAuthenticationFlowsResponse:
        return cast(gm.PostApiAdminAuthenticationFlowsResponse, self._client.post("/api/admin/authentication/flows", body=payload))

    def update(self, flow_id: str, payload: gm.PutApiAdminAuthenticationFlowsByIdRequestBody) -> gm.PutApiAdminAuthenticationFlowsByIdResponse:
        return cast(gm.PutApiAdminAuthenticationFlowsByIdResponse, self._client.put(f"/api/admin/authentication/flows/{flow_id}", body=payload))

    def delete(self, flow_id: str) -> None:
        self._client.delete(f"/api/admin/authentication/flows/{flow_id}")


class UserAttributesAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self) -> gm.GetApiAdminUserAttributesResponse:
        return cast(gm.GetApiAdminUserAttributesResponse, self._client.get("/api/admin/user-attributes"))

    def create(self, payload: gm.PostApiAdminUserAttributesRequestBody) -> gm.PostApiAdminUserAttributesResponse:
        return cast(gm.PostApiAdminUserAttributesResponse, self._client.post("/api/admin/user-attributes", body=payload))

    def update(self, attribute_id: str, payload: gm.PutApiAdminUserAttributesByIdRequestBody) -> gm.PutApiAdminUserAttributesByIdResponse:
        return cast(gm.PutApiAdminUserAttributesByIdResponse, self._client.put(f"/api/admin/user-attributes/{attribute_id}", body=payload))

    def delete(self, attribute_id: str) -> None:
        self._client.delete(f"/api/admin/user-attributes/{attribute_id}")

    def set_group_assignment(self, attribute_id: str, payload: gm.PutApiAdminUserAttributesByIdGroupsRequestBody) -> None:
        self._client.put(f"/api/admin/user-attributes/{attribute_id}/groups", body=payload)

    def remove_group_assignment(self, attribute_id: str, group_id: str) -> None:
        self._client.delete(f"/api/admin/user-attributes/{attribute_id}/groups/{group_id}")


class PoliciesAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self) -> gm.GetApiAdminPoliciesResponse:
        return cast(gm.GetApiAdminPoliciesResponse, self._client.get("/api/admin/policies"))

    def create(self, payload: gm.PostApiAdminPoliciesRequestBody) -> gm.PostApiAdminPoliciesResponse:
        return cast(gm.PostApiAdminPoliciesResponse, self._client.post("/api/admin/policies", body=payload))

    def update(self, policy_id: str, payload: gm.PutApiAdminPoliciesByIdRequestBody) -> gm.PutApiAdminPoliciesByIdResponse:
        return cast(gm.PutApiAdminPoliciesByIdResponse, self._client.put(f"/api/admin/policies/{policy_id}", body=payload))

    def delete(self, policy_id: str) -> None:
        self._client.delete(f"/api/admin/policies/{policy_id}")

    def set_assignment(self, policy_id: str, payload: gm.PutApiAdminPoliciesByIdAssignmentsRequestBody) -> None:
        self._client.put(f"/api/admin/policies/{policy_id}/assignments", body=payload)

    def remove_assignment(self, policy_id: str, payload: gm.RemovePolicyAssignmentRequestBody) -> None:
        self._client.delete(f"/api/admin/policies/{policy_id}/assignments", body=payload)

    def evaluate(self, payload: dict[str, Any]) -> Any:
        return self._client.post("/api/admin/policies/evaluate", body=payload)

    def decisions(self, *, limit: int | None = None) -> gm.GetApiAdminPoliciesDecisionsResponse:
        query = {"limit": limit} if limit is not None else None
        return cast(gm.GetApiAdminPoliciesDecisionsResponse, self._client.get("/api/admin/policies/decisions", query=query))


class EventHooksAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self) -> gm.GetApiAdminEventHooksResponse:
        return cast(gm.GetApiAdminEventHooksResponse, self._client.get("/api/admin/events/hooks"))

    def create(self, payload: gm.PostApiAdminEventHooksRequestBody) -> gm.PostApiAdminEventHooksResponse:
        return cast(gm.PostApiAdminEventHooksResponse, self._client.post("/api/admin/events/hooks", body=payload))

    def update(self, hook_id: str, payload: gm.PutApiAdminEventHooksByIdRequestBody) -> gm.PutApiAdminEventHooksByIdResponse:
        return cast(gm.PutApiAdminEventHooksByIdResponse, self._client.put(f"/api/admin/events/hooks/{hook_id}", body=payload))

    def delete(self, hook_id: str) -> None:
        self._client.delete(f"/api/admin/events/hooks/{hook_id}")

    def test(self, hook_id: str, payload: dict[str, Any] | None = None) -> Any:
        return self._client.post(f"/api/admin/events/hooks/{hook_id}/test", body=payload or {})

    def types(self) -> gm.GetApiAdminEventTypesResponse:
        return cast(gm.GetApiAdminEventTypesResponse, self._client.get("/api/admin/events/types"))

    def notifications(self, *, limit: int | None = None) -> gm.GetApiAdminEventNotificationsResponse:
        query = {"limit": limit} if limit is not None else None
        return cast(gm.GetApiAdminEventNotificationsResponse, self._client.get("/api/admin/events/notifications", query=query))


class FederationAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self) -> gm.GetApiAdminFederationProvidersResponse:
        return cast(gm.GetApiAdminFederationProvidersResponse, self._client.get("/api/admin/federation/providers"))

    def create(self, payload: gm.PostApiAdminFederationProvidersRequestBody) -> gm.PostApiAdminFederationProvidersResponse:
        return cast(gm.PostApiAdminFederationProvidersResponse, self._client.post("/api/admin/federation/providers", body=payload))

    def update(self, provider_id: str, payload: gm.PutApiAdminFederationProvidersByIdRequestBody) -> gm.PutApiAdminFederationProvidersByIdResponse:
        return cast(gm.PutApiAdminFederationProvidersByIdResponse, self._client.put(f"/api/admin/federation/providers/{provider_id}", body=payload))

    def delete(self, provider_id: str) -> None:
        self._client.delete(f"/api/admin/federation/providers/{provider_id}")


class SettingsAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def get(self) -> gm.GetApiAdminSettingsResponse:
        return cast(gm.GetApiAdminSettingsResponse, self._client.get("/api/admin/settings"))

    def update(self, payload: gm.PutApiAdminSettingsRequestBody) -> gm.PutApiAdminSettingsResponse:
        return cast(gm.PutApiAdminSettingsResponse, self._client.put("/api/admin/settings", body=payload))


class SecurityAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def risk_events(self, *, limit: int | None = None) -> gm.GetApiAdminSecurityRiskEventsResponse:
        query = {"limit": limit} if limit is not None else None
        return cast(gm.GetApiAdminSecurityRiskEventsResponse, self._client.get("/api/admin/security/risk-events", query=query))


class RoleAssignmentsAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def assign(self, payload: gm.PostApiAdminRoleAssignmentsRequestBody) -> None:
        self._client.post("/api/admin/role-assignments", body=payload)


class AdminClient(NexusIDClient):
    def __init__(
        self,
        *,
        base_url: str,
        auth: dict[str, Any] | None = None,
        timeout_seconds: float = 30.0,
        retry: RetryPolicy | None = None,
        default_headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(
            base_url=base_url,
            auth=auth,
            timeout_seconds=timeout_seconds,
            retry=retry,
            default_headers=default_headers,
        )
        self.access_requests = AccessRequestsAPI(self)
        self.elevations = ElevationsAPI(self)
        self.users = UsersAPI(self)
        self.roles = RolesAPI(self)
        self.role_assignments = RoleAssignmentsAPI(self)
        self.groups = GroupsAPI(self)
        self.clients = OAuthClientsAPI(self)
        self.scopes = ScopesAPI(self)
        self.tenants = TenantsAPI(self)
        self.apps = AppsAPI(self)
        self.sessions = SessionsAPI(self)
        self.consents = ConsentsAPI(self)
        self.devices = DevicesAPI(self)
        self.audit = AuditAPI(self)
        self.authentication_flows = AuthenticationFlowsAPI(self)
        self.user_attributes = UserAttributesAPI(self)
        self.policies = PoliciesAPI(self)
        self.event_hooks = EventHooksAPI(self)
        self.federation = FederationAPI(self)
        self.settings = SettingsAPI(self)
        self.security = SecurityAPI(self)
        self.provisioning = ProvisioningAPI(self)
        self.service_identities = ServiceIdentitiesAPI(self)
        self.connectors = ConnectorsAPI(self)
        self.saml = SamlAdminAPI(self)

    def with_auth(self, auth: dict[str, Any]) -> "AdminClient":
        return create_admin_client(
            base_url=self.base_url,
            auth=auth,
            timeout_seconds=self._timeout_seconds,
            retry=self._retry,
            default_headers=self._default_headers,
        )


def create_admin_client(
    *,
    base_url: str,
    auth: dict[str, Any] | None = None,
    timeout_seconds: float = 30.0,
    retry: RetryPolicy | None = None,
    default_headers: dict[str, str] | None = None,
) -> AdminClient:
    return AdminClient(
        base_url=base_url,
        auth=auth,
        timeout_seconds=timeout_seconds,
        retry=retry,
        default_headers=default_headers,
    )
