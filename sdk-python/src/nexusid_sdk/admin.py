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


class OAuthClientsAPI:
    def __init__(self, client: NexusIDClient) -> None:
        self._client = client

    def list(self, **query: Any) -> gm.GetApiAdminClientsResponse:
        return cast(gm.GetApiAdminClientsResponse, self._client.get("/api/admin/clients", query=query))

    def create(self, payload: gm.PostApiAdminClientsRequestBody) -> gm.PostApiAdminClientsResponse:
        return cast(gm.PostApiAdminClientsResponse, self._client.post("/api/admin/clients", body=payload))


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
        self.clients = OAuthClientsAPI(self)
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
