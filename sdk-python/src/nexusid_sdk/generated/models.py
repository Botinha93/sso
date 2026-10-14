# Generated from openapi.yaml by scripts/generate-python-sdk-models.mjs
# Do not edit by hand.
from __future__ import annotations

from typing import Any, Literal, TypeAlias, Union
from typing_extensions import NotRequired, TypedDict

class AccessRequest(TypedDict):
    id: str
    requesterId: str
    subjectUserId: str
    entitlementType: str
    entitlementValue: NotRequired[str]
    status: Literal["pending", "approved", "rejected", "expired", "cancelled"]
    justification: NotRequired[str]
    expiresAt: NotRequired[str | None]
    createdAt: str
    updatedAt: NotRequired[str]

class AccessReviewCampaign(TypedDict):
    id: str
    name: str
    description: NotRequired[str | None]
    status: Literal["active", "closed"]
    createdByUserId: str
    dueAt: NotRequired[str | None]
    createdAt: str
    updatedAt: NotRequired[str]

class AccessReviewItem(TypedDict):
    id: str
    campaignId: str
    subjectUserId: str
    entitlementType: Literal["role", "group"]
    entitlementValue: str
    currentState: Literal["granted"]
    decision: NotRequired[Literal["certified", "revoked"] | None]
    decidedByUserId: NotRequired[str | None]
    decisionRationale: NotRequired[str | None]
    decidedAt: NotRequired[str | None]
    createdAt: str
    updatedAt: NotRequired[str]

class AuthenticationFlow(TypedDict):
    name: str
    description: str
    designation: Literal["authentication", "authorization", "enrollment", "invalidation", "recovery", "stage_configuration", "unenrollment"]
    enabled: bool
    grantTypes: list[Literal["authorization_code", "client_credentials", "refresh_token", "password", "device_code"]]
    stages: list[AuthenticationStage]
    id: str
    createdAt: str
    updatedAt: str

class AuthenticationFlowBase(TypedDict):
    name: NotRequired[str]
    description: NotRequired[str]
    designation: NotRequired[Literal["authentication", "authorization", "enrollment", "invalidation", "recovery", "stage_configuration", "unenrollment"]]
    enabled: NotRequired[bool]
    grantTypes: NotRequired[list[Literal["authorization_code", "client_credentials", "refresh_token", "password", "device_code"]]]
    stages: NotRequired[list[AuthenticationStage]]

class AuthenticationFlowCreate(TypedDict):
    name: str
    description: str
    designation: NotRequired[Literal["authentication", "authorization", "enrollment", "invalidation", "recovery", "stage_configuration", "unenrollment"]]
    enabled: NotRequired[bool]
    grantTypes: list[Literal["authorization_code", "client_credentials", "refresh_token", "password", "device_code"]]
    stages: list[AuthenticationStage]

class AuthenticationFlowUpdate(TypedDict):
    name: NotRequired[str]
    description: NotRequired[str]
    designation: NotRequired[Literal["authentication", "authorization", "enrollment", "invalidation", "recovery", "stage_configuration", "unenrollment"]]
    enabled: NotRequired[bool]
    grantTypes: NotRequired[list[Literal["authorization_code", "client_credentials", "refresh_token", "password", "device_code"]]]
    stages: NotRequired[list[AuthenticationStage]]

class AuthenticationStage(TypedDict):
    type: Literal["password", "federation", "consent", "mfa_totp", "mfa_webauthn", "risk_check", "identification", "email_verification", "captcha", "prompt", "user_write", "user_login", "user_logout"]
    required: bool
    order: int

class BreakGlassElevationResponse(TypedDict):
    breakGlassId: str
    request: BreakGlassElevationResponseRequest
    session: BreakGlassElevationResponseSession

class BreakGlassElevationResponseRequest(TypedDict):
    id: str
    status: Literal["active"]
    correlationId: str
    resource: str
    action: str
    expiresAt: str

class BreakGlassElevationResponseSession(TypedDict):
    id: str
    status: Literal["active"]
    startedAt: str
    expiresAt: str

class Connector(TypedDict):
    id: str
    name: str
    type: Literal["ldap", "scim", "csv", "sql", "custom"]
    status: Literal["active", "inactive", "error"]
    config: dict[str, Any]
    schedule: NotRequired[str | None]
    lastSyncAt: NotRequired[str | None]
    createdAt: str
    updatedAt: str

class ConnectorMapping(TypedDict):
    id: str
    connectorId: str
    sourceField: str
    targetField: str
    transform: NotRequired[str | None]
    createdAt: NotRequired[str]

class ConnectorRun(TypedDict):
    id: str
    connectorId: str
    status: Literal["pending", "running", "succeeded", "failed", "cancelled"]
    startedAt: NotRequired[str | None]
    completedAt: NotRequired[str | None]
    error: NotRequired[str | None]
    usersCreated: NotRequired[int]
    usersUpdated: NotRequired[int]
    usersDeleted: NotRequired[int]
    groupsCreated: NotRequired[int]
    groupsUpdated: NotRequired[int]
    groupsDeleted: NotRequired[int]
    createdAt: str

class DeleteApiAccountMfaWebauthnCredentialsByCredentialIdPathParams(TypedDict):
    credentialId: str

class DeleteApiAdminAuthenticationFlowsByIdPathParams(TypedDict):
    id: str

class DeleteApiAdminConnectorsByConnectorIdMappingsByMappingIdPathParams(TypedDict):
    connectorId: str
    mappingId: str

class DeleteApiAdminConnectorsByIdPathParams(TypedDict):
    id: str

class DeleteApiAdminPluginsByIdPathParams(TypedDict):
    id: str

class DeleteApiAdminProvisioningMappingsByIdPathParams(TypedDict):
    id: str

class DeleteApiAdminProvisioningTokensByIdPathParams(TypedDict):
    id: str

class DeleteApiAdminSamlServiceProvidersByIdPathParams(TypedDict):
    id: str

class DeleteApiAdminServiceIdentitiesByIdCredentialsByCredentialIdPathParams(TypedDict):
    id: str
    credentialId: str

class DeleteApiAdminServiceIdentitiesByIdPathParams(TypedDict):
    id: str

class DeleteApiPortalAccountRequestBody(TypedDict):
    currentPassword: NotRequired[str]

class DeleteScimV2GroupsByIdPathParams(TypedDict):
    id: str

class DeleteScimV2UsersByIdPathParams(TypedDict):
    id: str

class ElevationRequest(TypedDict):
    id: str
    correlationId: str
    requesterId: str
    justification: str
    resource: str
    action: str
    status: Literal["pending", "approved", "active", "revoked", "expired"]
    approvedByUserId: NotRequired[str | None]
    approvedAt: NotRequired[str | None]
    activatedAt: NotRequired[str | None]
    expiresAt: NotRequired[str | None]
    revokedAt: NotRequired[str | None]
    revokedByUserId: NotRequired[str | None]
    createdAt: str
    updatedAt: NotRequired[str]

class ElevationSession(TypedDict):
    id: str
    correlationId: str
    elevationRequestId: str
    requesterId: str
    resource: str
    action: str
    status: Literal["active", "revoked", "expired"]
    startedAt: str
    expiresAt: str
    endedAt: NotRequired[str | None]
    createdAt: str
    updatedAt: NotRequired[str]

class GetApiAccountMfaTotpResponse200(TypedDict):
    enabled: NotRequired[bool]

class GetApiAccountMfaWebauthnCredentialsResponse200Item(TypedDict):
    id: NotRequired[str]
    credentialId: NotRequired[str]
    displayName: NotRequired[str]
    transports: NotRequired[list[str]]
    aaguid: NotRequired[str | None]
    signCount: NotRequired[int]
    createdAt: NotRequired[str]
    lastUsedAt: NotRequired[str | None]

class GetApiAdminAccessRequestsQueryParams(TypedDict):
    status: NotRequired[Literal["pending", "approved", "rejected", "expired", "cancelled"]]
    limit: NotRequired[int]

class GetApiAdminAccessRequestsStalledQueryParams(TypedDict):
    stalledAfterMinutes: int

class GetApiAdminAccessRequestsStalledResponse200Item(TypedDict):
    request: NotRequired[AccessRequest]
    minutesOverdue: NotRequired[int]

class GetApiAdminAccessReviewsCampaignsByIdPathParams(TypedDict):
    id: str

class GetApiAdminAccessReviewsCampaignsByIdResponse200(TypedDict):
    campaign: NotRequired[AccessReviewCampaign]
    items: NotRequired[list[AccessReviewItem]]

class GetApiAdminClientsQueryParams(TypedDict):
    limit: NotRequired[int]
    offset: NotRequired[int]

class GetApiAdminClientsResponse200(TypedDict):
    items: NotRequired[list[OAuthClient]]
    total: NotRequired[int]

class GetApiAdminConnectorsByIdMappingsPathParams(TypedDict):
    id: str

class GetApiAdminConnectorsByIdPathParams(TypedDict):
    id: str

class GetApiAdminConnectorsByIdRunsPathParams(TypedDict):
    id: str

class GetApiAdminConnectorsByIdRunsQueryParams(TypedDict):
    limit: NotRequired[int]

class GetApiAdminElevationsByIdPathParams(TypedDict):
    id: str

class GetApiAdminElevationsQueryParams(TypedDict):
    status: NotRequired[Literal["pending", "approved", "active", "revoked", "expired"]]
    limit: NotRequired[int]

class GetApiAdminElevationsSessionsQueryParams(TypedDict):
    status: NotRequired[Literal["active", "revoked", "expired"]]
    limit: NotRequired[int]

class GetApiAdminGroupsByIdUsersPathParams(TypedDict):
    id: str

class GetApiAdminGroupsByIdUsersResponse200(TypedDict):
    userIds: NotRequired[list[str]]
    users: NotRequired[list[GetApiAdminGroupsByIdUsersResponse200UsersItem]]

class GetApiAdminGroupsByIdUsersResponse200UsersItem(TypedDict):
    id: NotRequired[str]
    email: NotRequired[str]
    username: NotRequired[str]
    givenName: NotRequired[str]
    familyName: NotRequired[str]
    isServiceUser: NotRequired[bool]
    active: NotRequired[bool]

class GetApiAdminMeResponse200(TypedDict):
    id: NotRequired[str]
    email: NotRequired[str]
    username: NotRequired[str]
    givenName: NotRequired[str]
    familyName: NotRequired[str]
    avatarUrl: NotRequired[str | None]
    roles: NotRequired[list[str]]
    groups: NotRequired[list[str]]
    permissions: NotRequired[list[str]]

class GetApiAdminMetricsAuthQueryParams(TypedDict):
    startHour: NotRequired[str]
    endHour: NotRequired[str]
    event: NotRequired[str]

class GetApiAdminMetricsAuthResponse200Item(TypedDict):
    timestamp: NotRequired[str]
    event: NotRequired[str]
    count: NotRequired[int]
    successCount: NotRequired[int]
    failureCount: NotRequired[int]

class GetApiAdminPluginsResponse200(TypedDict):
    data: NotRequired[list[dict[str, Any]]]

class GetApiAdminPoliciesDecisionsQueryParams(TypedDict):
    limit: NotRequired[int]

class GetApiAdminPoliciesDecisionsResponse200Item(TypedDict):
    id: NotRequired[str]
    createdAt: NotRequired[str]
    actorId: NotRequired[str]
    clientId: NotRequired[str]
    ip: NotRequired[str]
    resource: NotRequired[str]
    action: NotRequired[str]
    allow: NotRequired[bool]
    deniedBy: NotRequired[list[str]]
    context: NotRequired[dict[str, Any]]

class GetApiAdminProvisioningDeprovisioningQueueQueryParams(TypedDict):
    limit: NotRequired[int]

class GetApiAdminProvisioningDeprovisioningQueueResponse200Item(TypedDict):
    id: NotRequired[str]
    userId: NotRequired[str]
    status: NotRequired[Literal["pending", "processing", "completed", "failed"]]
    reason: NotRequired[str]
    createdAt: NotRequired[str]

class GetApiAdminProvisioningJobsQueryParams(TypedDict):
    limit: NotRequired[int]
    offset: NotRequired[int]

class GetApiAdminProvisioningJobsResponse200Item(TypedDict):
    id: NotRequired[str]
    connectorId: NotRequired[str]
    status: NotRequired[Literal["pending", "running", "succeeded", "failed"]]
    startedAt: NotRequired[str]
    completedAt: NotRequired[str | None]
    usersCreated: NotRequired[int]
    usersUpdated: NotRequired[int]
    usersDeleted: NotRequired[int]
    createdAt: NotRequired[str]

class GetApiAdminProvisioningMappingsResponse200Item(TypedDict):
    id: NotRequired[str]
    sourceField: NotRequired[str]
    targetField: NotRequired[str]
    transform: NotRequired[str | None]
    createdAt: NotRequired[str]

class GetApiAdminProvisioningTokensResponse200Item(TypedDict):
    id: NotRequired[str]
    name: NotRequired[str]
    token: NotRequired[str]
    expiresAt: NotRequired[str | None]
    createdAt: NotRequired[str]

class GetApiAdminSamlAssertionsQueryParams(TypedDict):
    spId: NotRequired[str]
    limit: NotRequired[int]
    offset: NotRequired[int]
    startDate: NotRequired[str]
    endDate: NotRequired[str]

class GetApiAdminSamlAssertionsResponse200(TypedDict):
    items: list[SamlAssertionAudit]
    total: int
    limit: int
    offset: int

class GetApiAdminSamlServiceProvidersByIdPathParams(TypedDict):
    id: str

class GetApiAdminSamlServiceProvidersQueryParams(TypedDict):
    limit: NotRequired[int]
    offset: NotRequired[int]
    enabled: NotRequired[Literal["true", "false"]]

class GetApiAdminSamlServiceProvidersResponse200(TypedDict):
    items: list[SamlServiceProvider]
    total: int
    limit: int
    offset: int

class GetApiAdminSecurityRiskEventsQueryParams(TypedDict):
    limit: NotRequired[int]

class GetApiAdminSecurityRiskEventsResponse200Item(TypedDict):
    id: NotRequired[str]
    type: NotRequired[str]
    severity: NotRequired[Literal["low", "medium", "high", "critical"]]
    description: NotRequired[str]
    affectedUserId: NotRequired[str | None]
    detectedAt: NotRequired[str]
    auditEvents: NotRequired[list[str]]

class GetApiAdminServiceIdentitiesByIdPathParams(TypedDict):
    id: str

class GetApiAdminServiceIdentitiesByIdUsagePathParams(TypedDict):
    id: str

class GetApiAdminServiceIdentitiesByIdUsageResponse200(TypedDict):
    serviceIdentityId: NotRequired[str]
    credentials: NotRequired[list[GetApiAdminServiceIdentitiesByIdUsageResponse200CredentialsItem]]

class GetApiAdminServiceIdentitiesByIdUsageResponse200CredentialsItem(TypedDict):
    credentialId: NotRequired[str]
    status: NotRequired[Literal["active", "revoked", "expired"]]
    lastUsedAt: NotRequired[str | None]
    usageCount: NotRequired[int]
    createdAt: NotRequired[str]

class GetApiAdminUsersByIdGroupsPathParams(TypedDict):
    id: str

class GetApiAdminUsersByIdGroupsResponse200(TypedDict):
    groupIds: NotRequired[list[str]]
    groups: NotRequired[list[GetApiAdminUsersByIdGroupsResponse200GroupsItem]]

class GetApiAdminUsersByIdGroupsResponse200GroupsItem(TypedDict):
    id: NotRequired[str]
    name: NotRequired[str]
    description: NotRequired[str]

class GetApiAdminUsersByIdPathParams(TypedDict):
    id: str

class GetApiAdminUsersByIdPermissionsPathParams(TypedDict):
    id: str

class GetApiAdminUsersByIdPermissionsResponse200(TypedDict):
    permissions: NotRequired[list[str]]

class GetApiAdminUsersByIdResponse200(TypedDict):
    pass

class GetApiAdminUsersByIdRolesPathParams(TypedDict):
    id: str

class GetApiAdminUsersByIdRolesResponse200(TypedDict):
    roleIds: NotRequired[list[str]]
    roles: NotRequired[list[GetApiAdminUsersByIdRolesResponse200RolesItem]]

class GetApiAdminUsersByIdRolesResponse200RolesItem(TypedDict):
    id: NotRequired[str]
    name: NotRequired[str]
    scope: NotRequired[Literal["platform", "tenant"]]
    appId: NotRequired[str | None]
    permissions: NotRequired[list[str]]

class GetApiAdminUsersQueryParams(TypedDict):
    search: NotRequired[str]
    q: NotRequired[str]
    limit: NotRequired[int]
    offset: NotRequired[int]
    appId: NotRequired[str]

class GetApiAdminUsersResponse200(TypedDict):
    items: NotRequired[list[GetApiAdminUsersResponse200ItemsItem]]
    total: NotRequired[int]

class GetApiAdminUsersResponse200ItemsItem(TypedDict):
    id: NotRequired[str]
    username: NotRequired[str]
    email: NotRequired[str]
    givenName: NotRequired[str]
    familyName: NotRequired[str]
    active: NotRequired[bool]
    isServiceUser: NotRequired[bool]
    createdAt: NotRequired[str]

class GetApiPortalLanguageDefaultResponse200(TypedDict):
    language: NotRequired[str]
    supportedLanguages: NotRequired[list[str]]

class GetApiPortalMeResponse200(TypedDict):
    id: NotRequired[str]
    username: NotRequired[str]
    email: NotRequired[str]
    givenName: NotRequired[str]
    familyName: NotRequired[str]
    avatarUrl: NotRequired[str | None]
    preferredLanguage: NotRequired[str]
    customAttributes: NotRequired[dict[str, Any]]
    active: NotRequired[bool]
    apps: NotRequired[list[GetApiPortalMeResponse200AppsItem]]
    roles: NotRequired[list[str]]
    groups: NotRequired[list[str]]
    permissions: NotRequired[list[str]]
    createdAt: NotRequired[str]

class GetApiPortalMeResponse200AppsItem(TypedDict):
    id: NotRequired[str]
    name: NotRequired[str]
    url: NotRequired[str | None]
    icon: NotRequired[str | None]

class GetAuthFederationProvidersResponse200Item(TypedDict):
    id: NotRequired[str]
    label: NotRequired[str]

class GetOauthAuthorizeQueryParams(TypedDict):
    response_type: Literal["code", "token", "code token", "code id_token", "id_token token", "code id_token token"]
    client_id: str
    redirect_uri: str
    scope: str
    state: NotRequired[str]
    approval_prompt: NotRequired[Literal["auto", "force"]]

class GetOauthFrontchannelLogoutQueryParams(TypedDict):
    iss: NotRequired[str]
    sid: NotRequired[str]

class GetOauthUserinfoQueryParams(TypedDict):
    format: NotRequired[Literal["json", "signed", "jwt"]]

class GetOauthUserinfoResponse200(TypedDict):
    sub: NotRequired[str]
    preferred_username: NotRequired[str]
    email: NotRequired[str]
    email_verified: NotRequired[bool]
    name: NotRequired[str]
    given_name: NotRequired[str]
    family_name: NotRequired[str]
    picture: NotRequired[str]
    updated_at: NotRequired[int]
    roles: NotRequired[list[str]]
    groups: NotRequired[list[str]]
    permissions: NotRequired[list[str]]

class GetSamlMetadataQueryParams(TypedDict):
    spId: str

class GetScimV2GroupsByIdPathParams(TypedDict):
    id: str

class GetScimV2GroupsByIdResponse200(TypedDict):
    schemas: NotRequired[list[str]]
    id: NotRequired[str]
    displayName: NotRequired[str]

class GetScimV2GroupsQueryParams(TypedDict):
    startIndex: NotRequired[int]
    count: NotRequired[int]
    filter: NotRequired[str]

class GetScimV2GroupsResponse200(TypedDict):
    schemas: NotRequired[list[str]]
    totalResults: NotRequired[int]
    startIndex: NotRequired[int]
    itemsPerPage: NotRequired[int]
    Resources: NotRequired[list[dict[str, Any]]]

class GetScimV2ResourceTypesResponse200(TypedDict):
    schemas: NotRequired[list[str]]
    resourceTypes: NotRequired[list[dict[str, Any]]]

class GetScimV2SchemasResponse200(TypedDict):
    schemas: NotRequired[list[str]]
    totalResults: NotRequired[int]

class GetScimV2ServiceProviderConfigResponse200(TypedDict):
    documentationUri: NotRequired[str]
    supported: NotRequired[list[str]]
    schemas: NotRequired[list[str]]

class GetScimV2UsersByIdPathParams(TypedDict):
    id: str

class GetScimV2UsersByIdResponse200(TypedDict):
    schemas: NotRequired[list[str]]
    id: NotRequired[str]
    userName: NotRequired[str]

class GetScimV2UsersQueryParams(TypedDict):
    startIndex: NotRequired[int]
    count: NotRequired[int]
    filter: NotRequired[str]

class GetScimV2UsersResponse200(TypedDict):
    schemas: NotRequired[list[str]]
    totalResults: NotRequired[int]
    startIndex: NotRequired[int]
    itemsPerPage: NotRequired[int]
    Resources: NotRequired[list[dict[str, Any]]]

class GetWellKnownJwksJsonResponse200(TypedDict):
    keys: NotRequired[list[GetWellKnownJwksJsonResponse200KeysItem]]

class GetWellKnownJwksJsonResponse200KeysItem(TypedDict):
    kty: NotRequired[str]
    kid: NotRequired[str]
    use: NotRequired[str]
    n: NotRequired[str]
    e: NotRequired[str]

class GetWellKnownOpenidConfigurationResponse200(TypedDict):
    issuer: NotRequired[str]
    authorization_endpoint: NotRequired[str]
    token_endpoint: NotRequired[str]
    userinfo_endpoint: NotRequired[str]
    jwks_uri: NotRequired[str]
    response_types_supported: NotRequired[list[str]]
    subject_types_supported: NotRequired[list[str]]
    grant_types_supported: NotRequired[list[str]]

class IssuedServiceIdentityCredential(TypedDict):
    credential: ServiceIdentityCredential
    plainClientSecret: str

class OAuthClient(TypedDict):
    id: str
    appId: NotRequired[str | None]
    name: str
    secret: str
    redirectUris: list[str]
    allowedScopes: list[str]
    grants: list[str]
    requirePkce: NotRequired[bool]
    resources: NotRequired[list[str]]
    flowIds: NotRequired[list[str]]
    accessTokenTtlSeconds: NotRequired[int | None]
    refreshTokenTtlSeconds: NotRequired[int | None]
    createdAt: str

class PatchApiAdminConnectorsByIdPathParams(TypedDict):
    id: str

class PatchApiAdminConnectorsByIdRequestBody(TypedDict):
    name: NotRequired[str]
    type: NotRequired[Literal["ldap", "scim", "csv", "sql", "custom"]]
    status: NotRequired[Literal["active", "inactive", "error"]]
    config: NotRequired[dict[str, Any]]
    schedule: NotRequired[str]

class PatchApiAdminSamlServiceProvidersByIdPathParams(TypedDict):
    id: str

class PatchApiAdminSamlServiceProvidersByIdRequestBody(TypedDict):
    entityId: NotRequired[str]
    acsUrl: NotRequired[str]
    sloUrl: NotRequired[str | None]
    signingCertificate: NotRequired[str]
    encryptionCertificate: NotRequired[str | None]
    nameIdFormat: NotRequired[Literal["persistent", "transient", "emailAddress"]]
    enabled: NotRequired[bool]

class PatchApiAdminServiceIdentitiesByIdPathParams(TypedDict):
    id: str

class PatchApiAdminServiceIdentitiesByIdRequestBody(TypedDict):
    name: NotRequired[str]
    description: NotRequired[str]
    status: NotRequired[Literal["active", "inactive", "suspended"]]
    allowedScopes: NotRequired[list[str]]
    allowedAudiences: NotRequired[list[str]]
    metadata: NotRequired[dict[str, Any]]

class PatchApiPortalProfileRequestBody(TypedDict):
    givenName: NotRequired[str]
    familyName: NotRequired[str]
    avatarUrl: NotRequired[str]
    email: NotRequired[str]
    username: NotRequired[str]
    preferredLanguage: NotRequired[str]
    customAttributes: NotRequired[dict[str, str]]

class PatchApiPortalProfileResponse200(TypedDict):
    message: NotRequired[str]
    user: NotRequired[dict[str, Any]]

class PatchScimV2GroupsByIdPathParams(TypedDict):
    id: str

class PatchScimV2GroupsByIdResponse200(TypedDict):
    schemas: NotRequired[list[str]]
    id: NotRequired[str]

class PatchScimV2UsersByIdPathParams(TypedDict):
    id: str

class PatchScimV2UsersByIdResponse200(TypedDict):
    schemas: NotRequired[list[str]]
    id: NotRequired[str]

class PostApiAccountMfaTotpEnrollResponse200(TypedDict):
    enrollmentId: NotRequired[str]
    secret: NotRequired[str]
    otpauthUri: NotRequired[str]
    expiresIn: NotRequired[int]

class PostApiAccountMfaTotpVerifyRequestBody(TypedDict):
    enrollmentId: str
    code: str

class PostApiAccountMfaTotpVerifyResponse200(TypedDict):
    enabled: NotRequired[bool]

class PostApiAccountMfaWebauthnRegisterBeginRequestBody(TypedDict):
    displayName: NotRequired[str]

class PostApiAccountMfaWebauthnRegisterBeginResponse200(TypedDict):
    registrationId: NotRequired[str]
    challenge: NotRequired[str]
    rp: NotRequired[PostApiAccountMfaWebauthnRegisterBeginResponse200Rp]
    user: NotRequired[PostApiAccountMfaWebauthnRegisterBeginResponse200User]
    pubKeyCredParams: NotRequired[list[dict[str, Any]]]

class PostApiAccountMfaWebauthnRegisterBeginResponse200Rp(TypedDict):
    name: NotRequired[str]

class PostApiAccountMfaWebauthnRegisterBeginResponse200User(TypedDict):
    id: NotRequired[str]
    name: NotRequired[str]
    displayName: NotRequired[str]

class PostApiAccountMfaWebauthnRegisterFinishRequestBody(TypedDict):
    registrationId: str
    credentialId: str
    publicKey: str
    transports: NotRequired[list[str]]
    aaguid: NotRequired[str | None]
    signCount: NotRequired[int]
    displayName: NotRequired[str | None]

class PostApiAccountMfaWebauthnRegisterFinishResponse200(TypedDict):
    credentialId: NotRequired[str]
    displayName: NotRequired[str]
    createdAt: NotRequired[str]

class PostApiAdminAccessRequestsByIdApprovePathParams(TypedDict):
    id: str

class PostApiAdminAccessRequestsByIdApproveRequestBody(TypedDict):
    rationale: NotRequired[str]

class PostApiAdminAccessRequestsByIdRejectPathParams(TypedDict):
    id: str

class PostApiAdminAccessRequestsByIdRejectRequestBody(TypedDict):
    reason: NotRequired[str]

class PostApiAdminAccessRequestsProcessExpirationsRequestBody(TypedDict):
    dryRun: NotRequired[bool]

class PostApiAdminAccessRequestsProcessExpirationsResponse200(TypedDict):
    processed: NotRequired[int]
    revoked: NotRequired[int]
    dryRun: NotRequired[bool]

class PostApiAdminAccessRequestsRequestBody(TypedDict):
    subjectUserId: str
    entitlementType: str
    entitlementValue: str
    justification: str
    expiresAt: NotRequired[str | None]

class PostApiAdminAccessReviewsCampaignsRequestBody(TypedDict):
    name: str
    description: NotRequired[str]
    dueAt: NotRequired[str | None]

class PostApiAdminAccessReviewsCampaignsResponse201(TypedDict):
    campaign: NotRequired[AccessReviewCampaign]
    itemsGenerated: NotRequired[int]

class PostApiAdminAccessReviewsItemsByIdDecisionPathParams(TypedDict):
    id: str

class PostApiAdminAccessReviewsItemsByIdDecisionRequestBody(TypedDict):
    decision: Literal["certified", "revoked"]
    rationale: NotRequired[str]

class PostApiAdminAppsByIdImagePathParams(TypedDict):
    id: str

class PostApiAdminAppsByIdImageRequestBody(TypedDict):
    file: str

class PostApiAdminAppsByIdImageResponse200(TypedDict):
    imageUrl: NotRequired[str]

class PostApiAdminAuthorizationCheckRequestBody(TypedDict):
    userId: str
    resource: str
    action: str
    decisionStrategy: NotRequired[Literal["deny_overrides", "allow_overrides", "first_applicable"]]
    tenantId: NotRequired[str]
    clientId: NotRequired[str]
    ip: NotRequired[str]
    context: NotRequired[dict[str, Any]]

class PostApiAdminAuthorizationCheckResponse200(TypedDict):
    decisionStrategy: NotRequired[Literal["deny_overrides", "allow_overrides", "first_applicable"]]
    allow: NotRequired[bool]
    deniedBy: NotRequired[list[str]]
    decisions: NotRequired[list[PostApiAdminAuthorizationCheckResponse200DecisionsItem]]

class PostApiAdminAuthorizationCheckResponse200DecisionsItem(TypedDict):
    policyId: NotRequired[str]
    key: NotRequired[str]
    name: NotRequired[str]
    effect: NotRequired[Literal["allow", "deny"]]
    priority: NotRequired[int]
    applied: NotRequired[bool]
    allow: NotRequired[bool]
    message: NotRequired[str]

class PostApiAdminClientsRequestBody(TypedDict):
    name: str
    appId: NotRequired[str | None]
    redirectUris: list[str]
    allowedScopes: NotRequired[list[str]]
    grants: list[str]
    requirePkce: NotRequired[bool]
    resources: NotRequired[list[str]]
    flowIds: NotRequired[list[str]]
    accessTokenTtlSeconds: NotRequired[int | None]
    refreshTokenTtlSeconds: NotRequired[int | None]

class PostApiAdminConnectorsByIdMappingsPathParams(TypedDict):
    id: str

class PostApiAdminConnectorsByIdMappingsRequestBody(TypedDict):
    sourceField: str
    targetField: str
    transform: NotRequired[str]

class PostApiAdminConnectorsByIdSyncPathParams(TypedDict):
    id: str

class PostApiAdminConnectorsByIdSyncResponse202(TypedDict):
    runId: NotRequired[str]
    status: NotRequired[Literal["pending"]]

class PostApiAdminConnectorsRequestBody(TypedDict):
    name: str
    type: Literal["ldap", "scim", "csv", "sql", "custom"]
    config: dict[str, Any]
    schedule: NotRequired[str]

class PostApiAdminElevationsBreakGlassRequestBody(TypedDict):
    resource: str
    action: str
    reason: str
    requesterId: NotRequired[str | None]
    durationMinutes: NotRequired[float]

class PostApiAdminElevationsByIdActivatePathParams(TypedDict):
    id: str

class PostApiAdminElevationsByIdActivateResponse200(TypedDict):
    request: NotRequired[ElevationRequest]
    session: NotRequired[ElevationSession]

class PostApiAdminElevationsByIdApprovePathParams(TypedDict):
    id: str

class PostApiAdminElevationsByIdApproveRequestBody(TypedDict):
    rationale: NotRequired[str]

class PostApiAdminElevationsByIdRevokePathParams(TypedDict):
    id: str

class PostApiAdminElevationsByIdRevokeRequestBody(TypedDict):
    reason: NotRequired[str]

class PostApiAdminElevationsCheckRequestBody(TypedDict):
    resource: str
    action: str

class PostApiAdminElevationsCheckResponse200(TypedDict):
    allowed: bool
    hasSession: bool
    sessionId: NotRequired[str | None]
    expiresAt: NotRequired[str | None]

class PostApiAdminElevationsProcessExpirationsResponse200(TypedDict):
    expired: int
    revokedSessions: NotRequired[int]

class PostApiAdminElevationsRequestBody(TypedDict):
    justification: str
    resource: str
    action: str
    durationMinutes: int

class PostApiAdminPluginsRequestBody(TypedDict):
    manifest: dict[str, Any]
    bundleBase64: str
    activate: NotRequired[bool]

class PostApiAdminPluginsResponse201(TypedDict):
    pass

class PostApiAdminPluginsValidateRequestBody(TypedDict):
    manifest: dict[str, Any]
    bundleBase64: NotRequired[str]

class PostApiAdminPluginsValidateResponse200(TypedDict):
    valid: NotRequired[bool]
    errors: NotRequired[list[str]]
    warnings: NotRequired[list[str]]

class PostApiAdminPoliciesEvaluateRequestBody(TypedDict):
    userId: str
    resource: str
    action: str
    decisionStrategy: NotRequired[Literal["deny_overrides", "allow_overrides", "first_applicable"]]
    tenantId: NotRequired[str]
    clientId: NotRequired[str]
    ip: NotRequired[str]
    context: NotRequired[dict[str, Any]]

class PostApiAdminPoliciesEvaluateResponse200(TypedDict):
    decisionStrategy: NotRequired[Literal["deny_overrides", "allow_overrides", "first_applicable"]]
    allow: NotRequired[bool]
    deniedBy: NotRequired[list[str]]
    decisions: NotRequired[list[PostApiAdminPoliciesEvaluateResponse200DecisionsItem]]

class PostApiAdminPoliciesEvaluateResponse200DecisionsItem(TypedDict):
    policyId: NotRequired[str]
    key: NotRequired[str]
    name: NotRequired[str]
    effect: NotRequired[Literal["allow", "deny"]]
    priority: NotRequired[int]
    applied: NotRequired[bool]
    allow: NotRequired[bool]
    message: NotRequired[str]

class PostApiAdminProvisioningJobsReconcileRequestBody(TypedDict):
    connectorId: NotRequired[str]
    dryRun: NotRequired[bool]

class PostApiAdminProvisioningJobsReconcileResponse202(TypedDict):
    jobId: NotRequired[str]
    status: NotRequired[str]
    startedAt: NotRequired[str]

class PostApiAdminProvisioningMappingsRequestBody(TypedDict):
    sourceField: str
    targetField: str
    transform: NotRequired[str | None]

class PostApiAdminProvisioningMappingsResponse201(TypedDict):
    id: NotRequired[str]
    sourceField: NotRequired[str]
    targetField: NotRequired[str]
    transform: NotRequired[str | None]
    createdAt: NotRequired[str]

class PostApiAdminProvisioningTokensRequestBody(TypedDict):
    name: str
    expiresAt: NotRequired[str | None]

class PostApiAdminProvisioningTokensResponse201(TypedDict):
    id: NotRequired[str]
    name: NotRequired[str]
    token: NotRequired[str]
    expiresAt: NotRequired[str | None]
    createdAt: NotRequired[str]

class PostApiAdminSamlServiceProvidersByIdCertificatesRotatePathParams(TypedDict):
    id: str

class PostApiAdminSamlServiceProvidersByIdCertificatesRotateRequestBody(TypedDict):
    certificateType: NotRequired[Literal["signing", "encryption"]]
    certificate: str

class PostApiAdminSamlServiceProvidersByIdMetadataPathParams(TypedDict):
    id: str

class PostApiAdminSamlServiceProvidersByIdMetadataRequestBody(TypedDict):
    metadata: str
    overwriteManualFields: NotRequired[bool]

class PostApiAdminSamlServiceProvidersByIdMetadataResponse200(TypedDict):
    serviceProvider: SamlServiceProvider
    imported: PostApiAdminSamlServiceProvidersByIdMetadataResponse200Imported

class PostApiAdminSamlServiceProvidersByIdMetadataResponse200Imported(TypedDict):
    entityId: NotRequired[str]
    acsUrl: NotRequired[str]
    sloUrl: NotRequired[str | None]
    hasSigningCertificate: NotRequired[bool]

class PostApiAdminSamlServiceProvidersRequestBody(TypedDict):
    entityId: str
    acsUrl: str
    sloUrl: NotRequired[str | None]
    signingCertificate: str
    encryptionCertificate: NotRequired[str | None]
    nameIdFormat: NotRequired[Literal["persistent", "transient", "emailAddress"]]
    enabled: NotRequired[bool]

class PostApiAdminServiceIdentitiesByIdCredentialsPathParams(TypedDict):
    id: str

class PostApiAdminServiceIdentitiesByIdCredentialsRequestBody(TypedDict):
    expiresInDays: NotRequired[int]

class PostApiAdminServiceIdentitiesByIdCredentialsRotatePathParams(TypedDict):
    id: str

class PostApiAdminServiceIdentitiesByIdCredentialsRotateRequestBody(TypedDict):
    credentialId: str
    expiresInDays: NotRequired[int]

class PostApiAdminServiceIdentitiesRequestBody(TypedDict):
    name: str
    description: NotRequired[str]
    status: NotRequired[Literal["active", "inactive", "suspended"]]
    allowedScopes: NotRequired[list[str]]
    allowedAudiences: NotRequired[list[str]]
    ownerId: NotRequired[str]
    metadata: NotRequired[dict[str, Any]]

class PostApiAdminSettingsDatabaseMigrateRequestBody(TypedDict):
    provider: Literal["postgresql", "mysql"]
    externalDatabaseUrl: str
    sqlitePath: NotRequired[str]

class PostApiAdminSettingsDatabaseMigrateResponse200(TypedDict):
    pass

class PostApiAdminSettingsDatabaseTestRequestBody(TypedDict):
    provider: Literal["postgresql", "mysql"]
    externalDatabaseUrl: str

class PostApiAdminSettingsDatabaseTestResponse200(TypedDict):
    pass

class PostApiAdminSettingsTestEmailRequestBody(TypedDict):
    to: str
    subject: NotRequired[str]
    message: NotRequired[str]

class PostApiAdminSettingsTestEmailResponse200(TypedDict):
    ok: NotRequired[bool]

class PostApiAdminUsersByIdAvatarPathParams(TypedDict):
    id: str

class PostApiAdminUsersByIdAvatarRequestBody(TypedDict):
    file: str

class PostApiAdminUsersByIdAvatarResponse200(TypedDict):
    avatarUrl: NotRequired[str]

class PostApiAdminUsersRequestBody(TypedDict):
    appId: NotRequired[str]
    appIds: NotRequired[list[str]]
    externalSource: NotRequired[str]
    externalId: NotRequired[str]
    isServiceUser: NotRequired[bool]
    avatarUrl: NotRequired[str]
    email: str
    username: str
    password: NotRequired[str]
    passwordHash: NotRequired[str]
    givenName: str
    familyName: str
    customAttributes: NotRequired[dict[str, str]]
    roleIds: NotRequired[list[str]]
    groupIds: NotRequired[list[str]]

class PostApiAdminUsersResponse201(TypedDict):
    id: NotRequired[str]
    email: NotRequired[str]
    username: NotRequired[str]

class PostApiPortalAvatarRequestBody(TypedDict):
    file: str

class PostApiPortalAvatarResponse200(TypedDict):
    avatarUrl: NotRequired[str]

class PostApiPortalChangePasswordRequestBody(TypedDict):
    currentPassword: str
    newPassword: str

class PostApiPortalChangePasswordResponse200(TypedDict):
    message: NotRequired[str]

class PostAuthLoginMfaRequestBody(TypedDict):
    mfaTicket: str
    code: str

class PostAuthLoginMfaResponse200(TypedDict):
    pass

class PostAuthLoginRequestBody(TypedDict):
    email: str
    password: str
    clientId: NotRequired[str]
    tenantSlug: NotRequired[str]
    scope: NotRequired[list[str]]

class PostAuthLoginResponse200(TypedDict):
    pass

class PostAuthLoginResponse202(TypedDict):
    mfaRequired: NotRequired[bool]
    mfaTicket: NotRequired[str]
    expiresIn: NotRequired[int]

class PostAuthLoginWebauthnBeginRequestBody(TypedDict):
    identifier: str
    clientId: NotRequired[str | None]
    tenantSlug: NotRequired[str | None]
    scope: NotRequired[list[str]]

class PostAuthLoginWebauthnBeginResponse200(TypedDict):
    loginId: NotRequired[str]
    challenge: NotRequired[str]
    allowCredentials: NotRequired[list[dict[str, Any]]]

class PostAuthLoginWebauthnFinishRequestBody(TypedDict):
    loginId: str
    credentialId: str
    signCount: NotRequired[int]
    assertion: NotRequired[str]

class PostAuthLoginWebauthnFinishResponse200(TypedDict):
    sessionId: NotRequired[str]
    accessToken: NotRequired[str]
    expiresIn: NotRequired[int]

class PostAuthRecoveryRequestBody(TypedDict):
    recoveryTicket: str
    code: NotRequired[str]
    verificationCode: NotRequired[str]
    newPassword: str
    clientId: NotRequired[str]
    tenantSlug: NotRequired[str]
    scope: NotRequired[list[str]]

class PostAuthRecoveryRequestRequestBody(TypedDict):
    identifier: str
    clientId: NotRequired[str]
    tenantSlug: NotRequired[str]

class PostAuthRecoveryRequestResponse200(TypedDict):
    status: NotRequired[str]
    expiresIn: NotRequired[int]

class PostAuthRecoveryResponse200(TypedDict):
    pass

class PostConnectRegisterRequestBody(TypedDict):
    app_id: NotRequired[str]
    client_name: str
    redirect_uris: list[str]
    grant_types: NotRequired[list[Literal["authorization_code", "client_credentials", "refresh_token", "password", "device_code", "token_exchange", "jwt_bearer", "saml2_bearer", "ciba"]]]
    response_types: NotRequired[list[Literal["code", "token", "code token", "code id_token", "id_token token", "code id_token token"]]]
    scope: NotRequired[str]

class PostConnectRegisterResponse201(TypedDict):
    client_id: str
    client_secret: str
    client_name: str
    redirect_uris: NotRequired[list[str]]
    grant_types: NotRequired[list[str]]
    scope: NotRequired[str]

class PostOauthBackchannelLogoutRequestBody(TypedDict):
    logout_token: str

class PostOauthBackchannelLogoutResponse200(TypedDict):
    revoked: NotRequired[bool]

class PostOauthCibaApproveRequestBody(TypedDict):
    auth_req_id: str
    username: str
    password: str
    approve: bool

class PostOauthCibaApproveResponse200(TypedDict):
    status: NotRequired[Literal["approved", "denied"]]

class PostOauthCibaAuthenticateRequestBody(TypedDict):
    client_id: str
    client_secret: str
    login_hint: str
    scope: NotRequired[str]
    binding_message: NotRequired[str]
    user_code: NotRequired[str]

class PostOauthCibaAuthenticateResponse200(TypedDict):
    auth_req_id: str
    expires_in: int
    interval: int

class PostOauthDeviceAuthorizeRequestBody(TypedDict):
    client_id: str
    client_secret: str
    scope: NotRequired[str]

class PostOauthDeviceAuthorizeResponse200(TypedDict):
    device_code: NotRequired[str]
    user_code: NotRequired[str]
    verification_uri: NotRequired[str]
    expires_in: NotRequired[int]
    interval: NotRequired[int]

class PostOauthDeviceVerifyRequestBody(TypedDict):
    user_code: str
    username: str
    password: str
    approve: NotRequired[bool]

class PostOauthDeviceVerifyResponse200(TypedDict):
    status: NotRequired[Literal["approved", "denied"]]

class PostOauthIntrospectRequestBody(TypedDict):
    token: str

class PostOauthIntrospectResponse200(TypedDict):
    active: NotRequired[bool]
    scope: NotRequired[str]
    client_id: NotRequired[str]
    username: NotRequired[str]
    token_type: NotRequired[str]
    exp: NotRequired[int]
    iat: NotRequired[int]

class PostOauthTokenExchangeRequestBody(TypedDict):
    grant_type: Literal["urn:ietf:params:oauth:grant-type:token-exchange"]
    subject_token: str
    subject_token_type: str
    audience: NotRequired[str]
    scope: NotRequired[str]

class PostOauthTokenExchangeResponse200(TypedDict):
    access_token: str
    token_type: Literal["Bearer"]
    expires_in: int
    scope: NotRequired[str]

class PostOauthTokenRequestBodyOption1(TypedDict):
    grant_type: Literal["authorization_code"]
    code: str
    client_id: str
    client_secret: str
    redirect_uri: str
    code_verifier: NotRequired[str]

class PostOauthTokenRequestBodyOption2(TypedDict):
    grant_type: Literal["refresh_token"]
    refresh_token: str
    client_id: str
    client_secret: str

class PostOauthTokenRequestBodyOption3(TypedDict):
    grant_type: Literal["client_credentials"]
    client_id: str
    client_secret: str
    scope: NotRequired[str]

class PostOauthTokenRequestBodyOption4(TypedDict):
    grant_type: Literal["password"]
    username: str
    password: str
    client_id: str
    client_secret: str
    scope: NotRequired[str]

class PostOauthTokenRequestBodyOption5(TypedDict):
    grant_type: Literal["urn:ietf:params:oauth:grant-type:device_code"]
    device_code: str
    client_id: str
    client_secret: str

class PostOauthTokenRequestBodyOption6(TypedDict):
    grant_type: Literal["urn:ietf:params:oauth:grant-type:jwt-bearer"]
    assertion: str
    client_id: str
    client_secret: str
    scope: NotRequired[str]

class PostOauthTokenRequestBodyOption7(TypedDict):
    grant_type: Literal["urn:ietf:params:oauth:grant-type:saml2-bearer"]
    assertion: str
    client_id: str
    client_secret: str
    scope: NotRequired[str]

class PostOauthTokenRequestBodyOption8(TypedDict):
    grant_type: Literal["urn:openid:params:grant-type:ciba"]
    auth_req_id: str
    client_id: str
    client_secret: str

class PostOauthTokenResponse200(TypedDict):
    access_token: str
    token_type: Literal["Bearer"]
    expires_in: int
    refresh_token: NotRequired[str]
    id_token: NotRequired[str]

class PostOauthTokenRevokeRequestBody(TypedDict):
    token: str
    client_id: str
    client_secret: str

class PostOauthTokenRevokeResponse200(TypedDict):
    revoked: NotRequired[bool]

class PostSamlAcsBySpIdPathParams(TypedDict):
    spId: str

class PostSamlAcsBySpIdRequestBody(TypedDict):
    SAMLResponse: str
    RelayState: NotRequired[str]

class PostSamlAcsBySpIdResponse200(TypedDict):
    accepted: NotRequired[bool]
    userId: NotRequired[str]
    sessionId: NotRequired[str]

class PostSamlSloRequestBody(TypedDict):
    sessionId: NotRequired[str]
    relayState: NotRequired[str]
    reason: NotRequired[str]

class PostSamlSloResponse200(TypedDict):
    revoked: NotRequired[bool]
    sessionId: NotRequired[str]

class PostSamlSsoRequestBody(TypedDict):
    spId: str
    requestId: NotRequired[str]
    relayState: NotRequired[str]
    userId: NotRequired[str]
    responseMode: NotRequired[Literal["form_post", "json"]]

class PostSamlSsoResponse200(TypedDict):
    samlResponse: NotRequired[str]
    relayState: NotRequired[str]

class PostScimV2GroupsResponse201(TypedDict):
    schemas: NotRequired[list[str]]
    id: NotRequired[str]
    displayName: NotRequired[str]

class PostScimV2UsersResponse201(TypedDict):
    schemas: NotRequired[list[str]]
    id: NotRequired[str]
    userName: NotRequired[str]
    meta: NotRequired[dict[str, Any]]

class PutApiAdminAuthenticationFlowsByIdPathParams(TypedDict):
    id: str

class PutScimV2GroupsByIdPathParams(TypedDict):
    id: str

class PutScimV2GroupsByIdResponse200(TypedDict):
    schemas: NotRequired[list[str]]
    id: NotRequired[str]

class PutScimV2UsersByIdPathParams(TypedDict):
    id: str

class PutScimV2UsersByIdResponse200(TypedDict):
    schemas: NotRequired[list[str]]
    id: NotRequired[str]

class SamlAssertionAudit(TypedDict):
    id: NotRequired[str]
    spId: NotRequired[str]
    requestId: NotRequired[str]
    responseId: NotRequired[str]
    subject: NotRequired[str]
    audience: NotRequired[str]
    assertionId: NotRequired[str]
    issueInstant: NotRequired[str]
    notOnOrAfter: NotRequired[str]
    destinationUrl: NotRequired[str]
    statusCode: NotRequired[str]
    createdAt: NotRequired[str]

class SamlServiceProvider(TypedDict):
    id: NotRequired[str]
    entityId: NotRequired[str]
    acsUrl: NotRequired[str]
    sloUrl: NotRequired[str | None]
    signingCertificate: NotRequired[str]
    encryptionCertificate: NotRequired[str | None]
    nameIdFormat: NotRequired[Literal["persistent", "transient", "emailAddress"]]
    enabled: NotRequired[bool]
    createdAt: NotRequired[str]
    updatedAt: NotRequired[str]

class ServiceIdentity(TypedDict):
    id: str
    name: str
    description: NotRequired[str | None]
    ownerId: NotRequired[str | None]
    appId: NotRequired[str | None]
    status: Literal["active", "inactive", "suspended"]
    allowedScopes: list[str]
    allowedAudiences: list[str]
    metadata: NotRequired[dict[str, Any] | None]
    createdAt: str
    updatedAt: str

class ServiceIdentityCredential(TypedDict):
    id: str
    serviceIdentityId: str
    clientId: str
    clientSecretHash: NotRequired[str]
    plainClientSecret: NotRequired[str]
    expiresAt: NotRequired[str | None]
    revokedAt: NotRequired[str | None]
    rotatedFromId: NotRequired[str | None]
    lastUsedAt: NotRequired[str | None]
    createdAt: str

class ServiceIdentityWithCredentials(TypedDict):
    id: str
    name: str
    description: NotRequired[str | None]
    ownerId: NotRequired[str | None]
    appId: NotRequired[str | None]
    status: Literal["active", "inactive", "suspended"]
    allowedScopes: list[str]
    allowedAudiences: list[str]
    metadata: NotRequired[dict[str, Any] | None]
    createdAt: str
    updatedAt: str
    credentials: NotRequired[list[ServiceIdentityCredential]]

AssignGroupRoleRequestBody: TypeAlias = "Any"
AssignUserGroupRequestBody: TypeAlias = "Any"
DeleteApiAccountMfaTotpResponse: TypeAlias = "None"
DeleteApiAccountMfaWebauthnCredentialsByCredentialIdResponse: TypeAlias = "None"
DeleteApiAdminAuthenticationFlowsByIdResponse: TypeAlias = "None"
DeleteApiAdminConnectorsByConnectorIdMappingsByMappingIdResponse: TypeAlias = "None"
DeleteApiAdminConnectorsByIdResponse: TypeAlias = "None"
DeleteApiAdminPluginsByIdResponse: TypeAlias = "None"
DeleteApiAdminProvisioningMappingsByIdResponse: TypeAlias = "None"
DeleteApiAdminProvisioningTokensByIdResponse: TypeAlias = "None"
DeleteApiAdminSamlServiceProvidersByIdResponse: TypeAlias = "None"
DeleteApiAdminServiceIdentitiesByIdCredentialsByCredentialIdResponse: TypeAlias = "None"
DeleteApiAdminServiceIdentitiesByIdResponse: TypeAlias = "None"
DeleteApiPortalAccountResponse: TypeAlias = "None"
DeleteScimV2GroupsByIdResponse: TypeAlias = "None"
DeleteScimV2UsersByIdResponse: TypeAlias = "None"
GetApiAccountMfaTotpResponse: TypeAlias = "GetApiAccountMfaTotpResponse200"
GetApiAccountMfaWebauthnCredentialsResponse: TypeAlias = "GetApiAccountMfaWebauthnCredentialsResponse200"
GetApiAccountMfaWebauthnCredentialsResponse200: TypeAlias = "list[GetApiAccountMfaWebauthnCredentialsResponse200Item]"
GetApiAdminAccessRequestsResponse: TypeAlias = "GetApiAdminAccessRequestsResponse200"
GetApiAdminAccessRequestsResponse200: TypeAlias = "list[AccessRequest]"
GetApiAdminAccessRequestsStalledResponse: TypeAlias = "GetApiAdminAccessRequestsStalledResponse200"
GetApiAdminAccessRequestsStalledResponse200: TypeAlias = "list[GetApiAdminAccessRequestsStalledResponse200Item]"
GetApiAdminAccessReviewsCampaignsByIdResponse: TypeAlias = "GetApiAdminAccessReviewsCampaignsByIdResponse200"
GetApiAdminAppsResponse: TypeAlias = "Any"
GetApiAdminAuditResponse: TypeAlias = "Any"
GetApiAdminAuthenticationFlowsResponse: TypeAlias = "GetApiAdminAuthenticationFlowsResponse200"
GetApiAdminAuthenticationFlowsResponse200: TypeAlias = "list[AuthenticationFlow]"
GetApiAdminClientsResponse: TypeAlias = "GetApiAdminClientsResponse200"
GetApiAdminConnectorsByIdMappingsResponse: TypeAlias = "GetApiAdminConnectorsByIdMappingsResponse200"
GetApiAdminConnectorsByIdMappingsResponse200: TypeAlias = "list[ConnectorMapping]"
GetApiAdminConnectorsByIdResponse: TypeAlias = "GetApiAdminConnectorsByIdResponse200"
GetApiAdminConnectorsByIdResponse200: TypeAlias = "Connector"
GetApiAdminConnectorsByIdRunsResponse: TypeAlias = "GetApiAdminConnectorsByIdRunsResponse200"
GetApiAdminConnectorsByIdRunsResponse200: TypeAlias = "list[ConnectorRun]"
GetApiAdminConnectorsResponse: TypeAlias = "GetApiAdminConnectorsResponse200"
GetApiAdminConnectorsResponse200: TypeAlias = "list[Connector]"
GetApiAdminConsentsResponse: TypeAlias = "Any"
GetApiAdminDevicesResponse: TypeAlias = "Any"
GetApiAdminElevationsByIdResponse: TypeAlias = "GetApiAdminElevationsByIdResponse200"
GetApiAdminElevationsByIdResponse200: TypeAlias = "ElevationRequest"
GetApiAdminElevationsResponse: TypeAlias = "GetApiAdminElevationsResponse200"
GetApiAdminElevationsResponse200: TypeAlias = "list[ElevationRequest]"
GetApiAdminElevationsSessionsResponse: TypeAlias = "GetApiAdminElevationsSessionsResponse200"
GetApiAdminElevationsSessionsResponse200: TypeAlias = "list[ElevationSession]"
GetApiAdminEventHooksResponse: TypeAlias = "Any"
GetApiAdminEventNotificationsResponse: TypeAlias = "Any"
GetApiAdminEventTypesResponse: TypeAlias = "Any"
GetApiAdminFederationProvidersResponse: TypeAlias = "Any"
GetApiAdminGroupsByIdUsersResponse: TypeAlias = "GetApiAdminGroupsByIdUsersResponse200"
GetApiAdminGroupsResponse: TypeAlias = "Any"
GetApiAdminMeResponse: TypeAlias = "GetApiAdminMeResponse200"
GetApiAdminMetricsAuthResponse: TypeAlias = "GetApiAdminMetricsAuthResponse200"
GetApiAdminMetricsAuthResponse200: TypeAlias = "list[GetApiAdminMetricsAuthResponse200Item]"
GetApiAdminPluginsResponse: TypeAlias = "GetApiAdminPluginsResponse200"
GetApiAdminPoliciesDecisionsResponse: TypeAlias = "GetApiAdminPoliciesDecisionsResponse200"
GetApiAdminPoliciesDecisionsResponse200: TypeAlias = "list[GetApiAdminPoliciesDecisionsResponse200Item]"
GetApiAdminPoliciesResponse: TypeAlias = "Any"
GetApiAdminProvisioningDeprovisioningQueueResponse: TypeAlias = "GetApiAdminProvisioningDeprovisioningQueueResponse200"
GetApiAdminProvisioningDeprovisioningQueueResponse200: TypeAlias = "list[GetApiAdminProvisioningDeprovisioningQueueResponse200Item]"
GetApiAdminProvisioningJobsResponse: TypeAlias = "GetApiAdminProvisioningJobsResponse200"
GetApiAdminProvisioningJobsResponse200: TypeAlias = "list[GetApiAdminProvisioningJobsResponse200Item]"
GetApiAdminProvisioningMappingsResponse: TypeAlias = "GetApiAdminProvisioningMappingsResponse200"
GetApiAdminProvisioningMappingsResponse200: TypeAlias = "list[GetApiAdminProvisioningMappingsResponse200Item]"
GetApiAdminProvisioningTokensResponse: TypeAlias = "GetApiAdminProvisioningTokensResponse200"
GetApiAdminProvisioningTokensResponse200: TypeAlias = "list[GetApiAdminProvisioningTokensResponse200Item]"
GetApiAdminRolesResponse: TypeAlias = "Any"
GetApiAdminSamlAssertionsResponse: TypeAlias = "GetApiAdminSamlAssertionsResponse200"
GetApiAdminSamlServiceProvidersByIdResponse: TypeAlias = "GetApiAdminSamlServiceProvidersByIdResponse200"
GetApiAdminSamlServiceProvidersByIdResponse200: TypeAlias = "SamlServiceProvider"
GetApiAdminSamlServiceProvidersResponse: TypeAlias = "GetApiAdminSamlServiceProvidersResponse200"
GetApiAdminScopesResponse: TypeAlias = "Any"
GetApiAdminSecurityRiskEventsResponse: TypeAlias = "GetApiAdminSecurityRiskEventsResponse200"
GetApiAdminSecurityRiskEventsResponse200: TypeAlias = "list[GetApiAdminSecurityRiskEventsResponse200Item]"
GetApiAdminServiceIdentitiesByIdResponse: TypeAlias = "GetApiAdminServiceIdentitiesByIdResponse200"
GetApiAdminServiceIdentitiesByIdResponse200: TypeAlias = "ServiceIdentityWithCredentials"
GetApiAdminServiceIdentitiesByIdUsageResponse: TypeAlias = "GetApiAdminServiceIdentitiesByIdUsageResponse200"
GetApiAdminServiceIdentitiesResponse: TypeAlias = "GetApiAdminServiceIdentitiesResponse200"
GetApiAdminServiceIdentitiesResponse200: TypeAlias = "list[ServiceIdentity]"
GetApiAdminSessionsResponse: TypeAlias = "Any"
GetApiAdminSettingsResponse: TypeAlias = "Any"
GetApiAdminTenantsResponse: TypeAlias = "Any"
GetApiAdminUserAttributesResponse: TypeAlias = "Any"
GetApiAdminUsersByIdGroupsResponse: TypeAlias = "GetApiAdminUsersByIdGroupsResponse200"
GetApiAdminUsersByIdPermissionsResponse: TypeAlias = "GetApiAdminUsersByIdPermissionsResponse200"
GetApiAdminUsersByIdResponse: TypeAlias = "GetApiAdminUsersByIdResponse200"
GetApiAdminUsersByIdRolesResponse: TypeAlias = "GetApiAdminUsersByIdRolesResponse200"
GetApiAdminUsersResponse: TypeAlias = "GetApiAdminUsersResponse200"
GetApiPortalLanguageDefaultResponse: TypeAlias = "GetApiPortalLanguageDefaultResponse200"
GetApiPortalMeResponse: TypeAlias = "GetApiPortalMeResponse200"
GetAuthFederationProvidersResponse: TypeAlias = "GetAuthFederationProvidersResponse200"
GetAuthFederationProvidersResponse200: TypeAlias = "list[GetAuthFederationProvidersResponse200Item]"
GetOauthAuthorizeResponse: TypeAlias = "Any"
GetOauthFrontchannelLogoutResponse: TypeAlias = "GetOauthFrontchannelLogoutResponse200"
GetOauthFrontchannelLogoutResponse200: TypeAlias = "str"
GetOauthLogoutResponse: TypeAlias = "Any"
GetOauthUserinfoResponse: TypeAlias = "GetOauthUserinfoResponse200"
GetSamlMetadataResponse: TypeAlias = "GetSamlMetadataResponse200"
GetSamlMetadataResponse200: TypeAlias = "str"
GetScimV2GroupsByIdResponse: TypeAlias = "GetScimV2GroupsByIdResponse200"
GetScimV2GroupsResponse: TypeAlias = "GetScimV2GroupsResponse200"
GetScimV2ResourceTypesResponse: TypeAlias = "GetScimV2ResourceTypesResponse200"
GetScimV2SchemasResponse: TypeAlias = "GetScimV2SchemasResponse200"
GetScimV2ServiceProviderConfigResponse: TypeAlias = "GetScimV2ServiceProviderConfigResponse200"
GetScimV2UsersByIdResponse: TypeAlias = "GetScimV2UsersByIdResponse200"
GetScimV2UsersResponse: TypeAlias = "GetScimV2UsersResponse200"
GetWellKnownJwksJsonResponse: TypeAlias = "GetWellKnownJwksJsonResponse200"
GetWellKnownOpenidConfigurationResponse: TypeAlias = "GetWellKnownOpenidConfigurationResponse200"
PatchApiAdminConnectorsByIdResponse: TypeAlias = "PatchApiAdminConnectorsByIdResponse200"
PatchApiAdminConnectorsByIdResponse200: TypeAlias = "Connector"
PatchApiAdminSamlServiceProvidersByIdResponse: TypeAlias = "PatchApiAdminSamlServiceProvidersByIdResponse200"
PatchApiAdminSamlServiceProvidersByIdResponse200: TypeAlias = "SamlServiceProvider"
PatchApiAdminServiceIdentitiesByIdResponse: TypeAlias = "PatchApiAdminServiceIdentitiesByIdResponse200"
PatchApiAdminServiceIdentitiesByIdResponse200: TypeAlias = "ServiceIdentity"
PatchApiAdminUsersByIdRequestBody: TypeAlias = "Any"
PatchApiAdminUsersByIdResponse: TypeAlias = "Any"
PatchApiPortalProfileResponse: TypeAlias = "PatchApiPortalProfileResponse200"
PatchScimV2GroupsByIdResponse: TypeAlias = "PatchScimV2GroupsByIdResponse200"
PatchScimV2UsersByIdResponse: TypeAlias = "PatchScimV2UsersByIdResponse200"
PostApiAccountMfaTotpEnrollResponse: TypeAlias = "PostApiAccountMfaTotpEnrollResponse200"
PostApiAccountMfaTotpVerifyResponse: TypeAlias = "PostApiAccountMfaTotpVerifyResponse200"
PostApiAccountMfaWebauthnRegisterBeginResponse: TypeAlias = "PostApiAccountMfaWebauthnRegisterBeginResponse200"
PostApiAccountMfaWebauthnRegisterFinishResponse: TypeAlias = "PostApiAccountMfaWebauthnRegisterFinishResponse200"
PostApiAdminAccessRequestsByIdApproveResponse: TypeAlias = "PostApiAdminAccessRequestsByIdApproveResponse200"
PostApiAdminAccessRequestsByIdApproveResponse200: TypeAlias = "AccessRequest"
PostApiAdminAccessRequestsByIdRejectResponse: TypeAlias = "PostApiAdminAccessRequestsByIdRejectResponse200"
PostApiAdminAccessRequestsByIdRejectResponse200: TypeAlias = "AccessRequest"
PostApiAdminAccessRequestsProcessExpirationsResponse: TypeAlias = "PostApiAdminAccessRequestsProcessExpirationsResponse200"
PostApiAdminAccessRequestsResponse: TypeAlias = "PostApiAdminAccessRequestsResponse201"
PostApiAdminAccessRequestsResponse201: TypeAlias = "AccessRequest"
PostApiAdminAccessReviewsCampaignsResponse: TypeAlias = "PostApiAdminAccessReviewsCampaignsResponse201"
PostApiAdminAccessReviewsItemsByIdDecisionResponse: TypeAlias = "PostApiAdminAccessReviewsItemsByIdDecisionResponse200"
PostApiAdminAccessReviewsItemsByIdDecisionResponse200: TypeAlias = "AccessReviewItem"
PostApiAdminAppsByIdImageResponse: TypeAlias = "PostApiAdminAppsByIdImageResponse200"
PostApiAdminAppsRequestBody: TypeAlias = "Any"
PostApiAdminAppsResponse: TypeAlias = "Any"
PostApiAdminAuthenticationFlowsRequestBody: TypeAlias = "AuthenticationFlowCreate"
PostApiAdminAuthenticationFlowsResponse: TypeAlias = "PostApiAdminAuthenticationFlowsResponse201"
PostApiAdminAuthenticationFlowsResponse201: TypeAlias = "AuthenticationFlow"
PostApiAdminAuthorizationCheckResponse: TypeAlias = "PostApiAdminAuthorizationCheckResponse200"
PostApiAdminClientsResponse: TypeAlias = "PostApiAdminClientsResponse201"
PostApiAdminClientsResponse201: TypeAlias = "OAuthClient"
PostApiAdminConnectorsByIdMappingsResponse: TypeAlias = "PostApiAdminConnectorsByIdMappingsResponse201"
PostApiAdminConnectorsByIdMappingsResponse201: TypeAlias = "ConnectorMapping"
PostApiAdminConnectorsByIdSyncResponse: TypeAlias = "PostApiAdminConnectorsByIdSyncResponse202"
PostApiAdminConnectorsResponse: TypeAlias = "PostApiAdminConnectorsResponse201"
PostApiAdminConnectorsResponse201: TypeAlias = "Connector"
PostApiAdminElevationsBreakGlassResponse: TypeAlias = "PostApiAdminElevationsBreakGlassResponse201"
PostApiAdminElevationsBreakGlassResponse201: TypeAlias = "BreakGlassElevationResponse"
PostApiAdminElevationsByIdActivateResponse: TypeAlias = "PostApiAdminElevationsByIdActivateResponse200"
PostApiAdminElevationsByIdApproveResponse: TypeAlias = "PostApiAdminElevationsByIdApproveResponse200"
PostApiAdminElevationsByIdApproveResponse200: TypeAlias = "ElevationRequest"
PostApiAdminElevationsByIdRevokeResponse: TypeAlias = "PostApiAdminElevationsByIdRevokeResponse200"
PostApiAdminElevationsByIdRevokeResponse200: TypeAlias = "ElevationRequest"
PostApiAdminElevationsCheckResponse: TypeAlias = "PostApiAdminElevationsCheckResponse200"
PostApiAdminElevationsProcessExpirationsResponse: TypeAlias = "PostApiAdminElevationsProcessExpirationsResponse200"
PostApiAdminElevationsResponse: TypeAlias = "PostApiAdminElevationsResponse201"
PostApiAdminElevationsResponse201: TypeAlias = "ElevationRequest"
PostApiAdminEventHooksRequestBody: TypeAlias = "Any"
PostApiAdminEventHooksResponse: TypeAlias = "Any"
PostApiAdminFederationProvidersRequestBody: TypeAlias = "Any"
PostApiAdminFederationProvidersResponse: TypeAlias = "Any"
PostApiAdminGroupRoleAssignmentsRequestBody: TypeAlias = "Any"
PostApiAdminGroupsRequestBody: TypeAlias = "Any"
PostApiAdminGroupsResponse: TypeAlias = "Any"
PostApiAdminPluginsResponse: TypeAlias = "PostApiAdminPluginsResponse201"
PostApiAdminPluginsValidateResponse: TypeAlias = "PostApiAdminPluginsValidateResponse200"
PostApiAdminPoliciesEvaluateResponse: TypeAlias = "PostApiAdminPoliciesEvaluateResponse200"
PostApiAdminPoliciesRequestBody: TypeAlias = "Any"
PostApiAdminPoliciesResponse: TypeAlias = "Any"
PostApiAdminProvisioningJobsReconcileResponse: TypeAlias = "PostApiAdminProvisioningJobsReconcileResponse202"
PostApiAdminProvisioningMappingsResponse: TypeAlias = "PostApiAdminProvisioningMappingsResponse201"
PostApiAdminProvisioningTokensResponse: TypeAlias = "PostApiAdminProvisioningTokensResponse201"
PostApiAdminRoleAssignmentsRequestBody: TypeAlias = "Any"
PostApiAdminRolesRequestBody: TypeAlias = "Any"
PostApiAdminRolesResponse: TypeAlias = "Any"
PostApiAdminSamlServiceProvidersByIdCertificatesRotateResponse: TypeAlias = "PostApiAdminSamlServiceProvidersByIdCertificatesRotateResponse200"
PostApiAdminSamlServiceProvidersByIdCertificatesRotateResponse200: TypeAlias = "SamlServiceProvider"
PostApiAdminSamlServiceProvidersByIdMetadataResponse: TypeAlias = "PostApiAdminSamlServiceProvidersByIdMetadataResponse200"
PostApiAdminSamlServiceProvidersResponse: TypeAlias = "PostApiAdminSamlServiceProvidersResponse201"
PostApiAdminSamlServiceProvidersResponse201: TypeAlias = "SamlServiceProvider"
PostApiAdminScopesRequestBody: TypeAlias = "Any"
PostApiAdminScopesResponse: TypeAlias = "Any"
PostApiAdminServiceIdentitiesByIdCredentialsResponse: TypeAlias = "PostApiAdminServiceIdentitiesByIdCredentialsResponse201"
PostApiAdminServiceIdentitiesByIdCredentialsResponse201: TypeAlias = "IssuedServiceIdentityCredential"
PostApiAdminServiceIdentitiesByIdCredentialsRotateResponse: TypeAlias = "PostApiAdminServiceIdentitiesByIdCredentialsRotateResponse201"
PostApiAdminServiceIdentitiesByIdCredentialsRotateResponse201: TypeAlias = "IssuedServiceIdentityCredential"
PostApiAdminServiceIdentitiesResponse: TypeAlias = "PostApiAdminServiceIdentitiesResponse201"
PostApiAdminServiceIdentitiesResponse201: TypeAlias = "ServiceIdentity"
PostApiAdminSettingsDatabaseMigrateResponse: TypeAlias = "PostApiAdminSettingsDatabaseMigrateResponse200"
PostApiAdminSettingsDatabaseTestResponse: TypeAlias = "PostApiAdminSettingsDatabaseTestResponse200"
PostApiAdminSettingsTestEmailResponse: TypeAlias = "PostApiAdminSettingsTestEmailResponse200"
PostApiAdminTenantsRequestBody: TypeAlias = "Any"
PostApiAdminTenantsResponse: TypeAlias = "Any"
PostApiAdminUserAttributesRequestBody: TypeAlias = "Any"
PostApiAdminUserAttributesResponse: TypeAlias = "Any"
PostApiAdminUserGroupsRequestBody: TypeAlias = "Any"
PostApiAdminUsersByIdAvatarResponse: TypeAlias = "PostApiAdminUsersByIdAvatarResponse200"
PostApiAdminUsersByIdResetPasswordRequestBody: TypeAlias = "Any"
PostApiAdminUsersResponse: TypeAlias = "PostApiAdminUsersResponse201"
PostApiPortalAvatarResponse: TypeAlias = "PostApiPortalAvatarResponse200"
PostApiPortalChangePasswordResponse: TypeAlias = "PostApiPortalChangePasswordResponse200"
PostAuthLoginMfaResponse: TypeAlias = "PostAuthLoginMfaResponse200"
PostAuthLoginResponse: TypeAlias = "Union[PostAuthLoginResponse200, PostAuthLoginResponse202]"
PostAuthLoginWebauthnBeginResponse: TypeAlias = "PostAuthLoginWebauthnBeginResponse200"
PostAuthLoginWebauthnFinishResponse: TypeAlias = "PostAuthLoginWebauthnFinishResponse200"
PostAuthLogoutResponse: TypeAlias = "Any"
PostAuthRecoveryRequestResponse: TypeAlias = "PostAuthRecoveryRequestResponse200"
PostAuthRecoveryResponse: TypeAlias = "PostAuthRecoveryResponse200"
PostConnectRegisterResponse: TypeAlias = "PostConnectRegisterResponse201"
PostOauthBackchannelLogoutResponse: TypeAlias = "PostOauthBackchannelLogoutResponse200"
PostOauthCibaApproveResponse: TypeAlias = "PostOauthCibaApproveResponse200"
PostOauthCibaAuthenticateResponse: TypeAlias = "PostOauthCibaAuthenticateResponse200"
PostOauthDeviceAuthorizeResponse: TypeAlias = "PostOauthDeviceAuthorizeResponse200"
PostOauthDeviceVerifyResponse: TypeAlias = "PostOauthDeviceVerifyResponse200"
PostOauthIntrospectResponse: TypeAlias = "PostOauthIntrospectResponse200"
PostOauthTokenExchangeResponse: TypeAlias = "PostOauthTokenExchangeResponse200"
PostOauthTokenRequestBody: TypeAlias = "Union[PostOauthTokenRequestBodyOption1, PostOauthTokenRequestBodyOption2, PostOauthTokenRequestBodyOption3, PostOauthTokenRequestBodyOption4, PostOauthTokenRequestBodyOption5, PostOauthTokenRequestBodyOption6, PostOauthTokenRequestBodyOption7, PostOauthTokenRequestBodyOption8]"
PostOauthTokenResponse: TypeAlias = "PostOauthTokenResponse200"
PostOauthTokenRevokeResponse: TypeAlias = "PostOauthTokenRevokeResponse200"
PostSamlAcsBySpIdResponse: TypeAlias = "PostSamlAcsBySpIdResponse200"
PostSamlSloResponse: TypeAlias = "PostSamlSloResponse200"
PostSamlSsoResponse: TypeAlias = "PostSamlSsoResponse200"
PostScimV2GroupsResponse: TypeAlias = "PostScimV2GroupsResponse201"
PostScimV2UsersResponse: TypeAlias = "PostScimV2UsersResponse201"
PutApiAdminAppsByIdRequestBody: TypeAlias = "Any"
PutApiAdminAppsByIdResponse: TypeAlias = "Any"
PutApiAdminAuthenticationFlowsByIdRequestBody: TypeAlias = "AuthenticationFlowUpdate"
PutApiAdminAuthenticationFlowsByIdResponse: TypeAlias = "PutApiAdminAuthenticationFlowsByIdResponse200"
PutApiAdminAuthenticationFlowsByIdResponse200: TypeAlias = "AuthenticationFlow"
PutApiAdminClientsByIdRequestBody: TypeAlias = "Any"
PutApiAdminClientsByIdResponse: TypeAlias = "Any"
PutApiAdminEventHooksByIdRequestBody: TypeAlias = "Any"
PutApiAdminEventHooksByIdResponse: TypeAlias = "Any"
PutApiAdminFederationProvidersByIdRequestBody: TypeAlias = "Any"
PutApiAdminFederationProvidersByIdResponse: TypeAlias = "Any"
PutApiAdminGroupsByIdRequestBody: TypeAlias = "Any"
PutApiAdminGroupsByIdResponse: TypeAlias = "Any"
PutApiAdminPoliciesByIdAssignmentsRequestBody: TypeAlias = "Any"
PutApiAdminPoliciesByIdRequestBody: TypeAlias = "Any"
PutApiAdminPoliciesByIdResponse: TypeAlias = "Any"
PutApiAdminRolesByIdRequestBody: TypeAlias = "Any"
PutApiAdminRolesByIdResponse: TypeAlias = "Any"
PutApiAdminSettingsRequestBody: TypeAlias = "Any"
PutApiAdminSettingsResponse: TypeAlias = "Any"
PutApiAdminTenantsRequestBody: TypeAlias = "Any"
PutApiAdminTenantsResponse: TypeAlias = "Any"
PutApiAdminUserAttributesByIdGroupsRequestBody: TypeAlias = "Any"
PutApiAdminUserAttributesByIdRequestBody: TypeAlias = "Any"
PutApiAdminUserAttributesByIdResponse: TypeAlias = "Any"
PutScimV2GroupsByIdResponse: TypeAlias = "PutScimV2GroupsByIdResponse200"
PutScimV2UsersByIdResponse: TypeAlias = "PutScimV2UsersByIdResponse200"
RemovePolicyAssignmentRequestBody: TypeAlias = "Any"

__all__ = [
    "AccessRequest",
    "AccessReviewCampaign",
    "AccessReviewItem",
    "AssignGroupRoleRequestBody",
    "AssignUserGroupRequestBody",
    "AuthenticationFlow",
    "AuthenticationFlowBase",
    "AuthenticationFlowCreate",
    "AuthenticationFlowUpdate",
    "AuthenticationStage",
    "BreakGlassElevationResponse",
    "BreakGlassElevationResponseRequest",
    "BreakGlassElevationResponseSession",
    "Connector",
    "ConnectorMapping",
    "ConnectorRun",
    "DeleteApiAccountMfaTotpResponse",
    "DeleteApiAccountMfaWebauthnCredentialsByCredentialIdPathParams",
    "DeleteApiAccountMfaWebauthnCredentialsByCredentialIdResponse",
    "DeleteApiAdminAuthenticationFlowsByIdPathParams",
    "DeleteApiAdminAuthenticationFlowsByIdResponse",
    "DeleteApiAdminConnectorsByConnectorIdMappingsByMappingIdPathParams",
    "DeleteApiAdminConnectorsByConnectorIdMappingsByMappingIdResponse",
    "DeleteApiAdminConnectorsByIdPathParams",
    "DeleteApiAdminConnectorsByIdResponse",
    "DeleteApiAdminPluginsByIdPathParams",
    "DeleteApiAdminPluginsByIdResponse",
    "DeleteApiAdminProvisioningMappingsByIdPathParams",
    "DeleteApiAdminProvisioningMappingsByIdResponse",
    "DeleteApiAdminProvisioningTokensByIdPathParams",
    "DeleteApiAdminProvisioningTokensByIdResponse",
    "DeleteApiAdminSamlServiceProvidersByIdPathParams",
    "DeleteApiAdminSamlServiceProvidersByIdResponse",
    "DeleteApiAdminServiceIdentitiesByIdCredentialsByCredentialIdPathParams",
    "DeleteApiAdminServiceIdentitiesByIdCredentialsByCredentialIdResponse",
    "DeleteApiAdminServiceIdentitiesByIdPathParams",
    "DeleteApiAdminServiceIdentitiesByIdResponse",
    "DeleteApiPortalAccountRequestBody",
    "DeleteApiPortalAccountResponse",
    "DeleteScimV2GroupsByIdPathParams",
    "DeleteScimV2GroupsByIdResponse",
    "DeleteScimV2UsersByIdPathParams",
    "DeleteScimV2UsersByIdResponse",
    "ElevationRequest",
    "ElevationSession",
    "GetApiAccountMfaTotpResponse",
    "GetApiAccountMfaTotpResponse200",
    "GetApiAccountMfaWebauthnCredentialsResponse",
    "GetApiAccountMfaWebauthnCredentialsResponse200",
    "GetApiAccountMfaWebauthnCredentialsResponse200Item",
    "GetApiAdminAccessRequestsQueryParams",
    "GetApiAdminAccessRequestsResponse",
    "GetApiAdminAccessRequestsResponse200",
    "GetApiAdminAccessRequestsStalledQueryParams",
    "GetApiAdminAccessRequestsStalledResponse",
    "GetApiAdminAccessRequestsStalledResponse200",
    "GetApiAdminAccessRequestsStalledResponse200Item",
    "GetApiAdminAccessReviewsCampaignsByIdPathParams",
    "GetApiAdminAccessReviewsCampaignsByIdResponse",
    "GetApiAdminAccessReviewsCampaignsByIdResponse200",
    "GetApiAdminAppsResponse",
    "GetApiAdminAuditResponse",
    "GetApiAdminAuthenticationFlowsResponse",
    "GetApiAdminAuthenticationFlowsResponse200",
    "GetApiAdminClientsQueryParams",
    "GetApiAdminClientsResponse",
    "GetApiAdminClientsResponse200",
    "GetApiAdminConnectorsByIdMappingsPathParams",
    "GetApiAdminConnectorsByIdMappingsResponse",
    "GetApiAdminConnectorsByIdMappingsResponse200",
    "GetApiAdminConnectorsByIdPathParams",
    "GetApiAdminConnectorsByIdResponse",
    "GetApiAdminConnectorsByIdResponse200",
    "GetApiAdminConnectorsByIdRunsPathParams",
    "GetApiAdminConnectorsByIdRunsQueryParams",
    "GetApiAdminConnectorsByIdRunsResponse",
    "GetApiAdminConnectorsByIdRunsResponse200",
    "GetApiAdminConnectorsResponse",
    "GetApiAdminConnectorsResponse200",
    "GetApiAdminConsentsResponse",
    "GetApiAdminDevicesResponse",
    "GetApiAdminElevationsByIdPathParams",
    "GetApiAdminElevationsByIdResponse",
    "GetApiAdminElevationsByIdResponse200",
    "GetApiAdminElevationsQueryParams",
    "GetApiAdminElevationsResponse",
    "GetApiAdminElevationsResponse200",
    "GetApiAdminElevationsSessionsQueryParams",
    "GetApiAdminElevationsSessionsResponse",
    "GetApiAdminElevationsSessionsResponse200",
    "GetApiAdminEventHooksResponse",
    "GetApiAdminEventNotificationsResponse",
    "GetApiAdminEventTypesResponse",
    "GetApiAdminFederationProvidersResponse",
    "GetApiAdminGroupsByIdUsersPathParams",
    "GetApiAdminGroupsByIdUsersResponse",
    "GetApiAdminGroupsByIdUsersResponse200",
    "GetApiAdminGroupsByIdUsersResponse200UsersItem",
    "GetApiAdminGroupsResponse",
    "GetApiAdminMeResponse",
    "GetApiAdminMeResponse200",
    "GetApiAdminMetricsAuthQueryParams",
    "GetApiAdminMetricsAuthResponse",
    "GetApiAdminMetricsAuthResponse200",
    "GetApiAdminMetricsAuthResponse200Item",
    "GetApiAdminPluginsResponse",
    "GetApiAdminPluginsResponse200",
    "GetApiAdminPoliciesDecisionsQueryParams",
    "GetApiAdminPoliciesDecisionsResponse",
    "GetApiAdminPoliciesDecisionsResponse200",
    "GetApiAdminPoliciesDecisionsResponse200Item",
    "GetApiAdminPoliciesResponse",
    "GetApiAdminProvisioningDeprovisioningQueueQueryParams",
    "GetApiAdminProvisioningDeprovisioningQueueResponse",
    "GetApiAdminProvisioningDeprovisioningQueueResponse200",
    "GetApiAdminProvisioningDeprovisioningQueueResponse200Item",
    "GetApiAdminProvisioningJobsQueryParams",
    "GetApiAdminProvisioningJobsResponse",
    "GetApiAdminProvisioningJobsResponse200",
    "GetApiAdminProvisioningJobsResponse200Item",
    "GetApiAdminProvisioningMappingsResponse",
    "GetApiAdminProvisioningMappingsResponse200",
    "GetApiAdminProvisioningMappingsResponse200Item",
    "GetApiAdminProvisioningTokensResponse",
    "GetApiAdminProvisioningTokensResponse200",
    "GetApiAdminProvisioningTokensResponse200Item",
    "GetApiAdminRolesResponse",
    "GetApiAdminSamlAssertionsQueryParams",
    "GetApiAdminSamlAssertionsResponse",
    "GetApiAdminSamlAssertionsResponse200",
    "GetApiAdminSamlServiceProvidersByIdPathParams",
    "GetApiAdminSamlServiceProvidersByIdResponse",
    "GetApiAdminSamlServiceProvidersByIdResponse200",
    "GetApiAdminSamlServiceProvidersQueryParams",
    "GetApiAdminSamlServiceProvidersResponse",
    "GetApiAdminSamlServiceProvidersResponse200",
    "GetApiAdminScopesResponse",
    "GetApiAdminSecurityRiskEventsQueryParams",
    "GetApiAdminSecurityRiskEventsResponse",
    "GetApiAdminSecurityRiskEventsResponse200",
    "GetApiAdminSecurityRiskEventsResponse200Item",
    "GetApiAdminServiceIdentitiesByIdPathParams",
    "GetApiAdminServiceIdentitiesByIdResponse",
    "GetApiAdminServiceIdentitiesByIdResponse200",
    "GetApiAdminServiceIdentitiesByIdUsagePathParams",
    "GetApiAdminServiceIdentitiesByIdUsageResponse",
    "GetApiAdminServiceIdentitiesByIdUsageResponse200",
    "GetApiAdminServiceIdentitiesByIdUsageResponse200CredentialsItem",
    "GetApiAdminServiceIdentitiesResponse",
    "GetApiAdminServiceIdentitiesResponse200",
    "GetApiAdminSessionsResponse",
    "GetApiAdminSettingsResponse",
    "GetApiAdminTenantsResponse",
    "GetApiAdminUserAttributesResponse",
    "GetApiAdminUsersByIdGroupsPathParams",
    "GetApiAdminUsersByIdGroupsResponse",
    "GetApiAdminUsersByIdGroupsResponse200",
    "GetApiAdminUsersByIdGroupsResponse200GroupsItem",
    "GetApiAdminUsersByIdPathParams",
    "GetApiAdminUsersByIdPermissionsPathParams",
    "GetApiAdminUsersByIdPermissionsResponse",
    "GetApiAdminUsersByIdPermissionsResponse200",
    "GetApiAdminUsersByIdResponse",
    "GetApiAdminUsersByIdResponse200",
    "GetApiAdminUsersByIdRolesPathParams",
    "GetApiAdminUsersByIdRolesResponse",
    "GetApiAdminUsersByIdRolesResponse200",
    "GetApiAdminUsersByIdRolesResponse200RolesItem",
    "GetApiAdminUsersQueryParams",
    "GetApiAdminUsersResponse",
    "GetApiAdminUsersResponse200",
    "GetApiAdminUsersResponse200ItemsItem",
    "GetApiPortalLanguageDefaultResponse",
    "GetApiPortalLanguageDefaultResponse200",
    "GetApiPortalMeResponse",
    "GetApiPortalMeResponse200",
    "GetApiPortalMeResponse200AppsItem",
    "GetAuthFederationProvidersResponse",
    "GetAuthFederationProvidersResponse200",
    "GetAuthFederationProvidersResponse200Item",
    "GetOauthAuthorizeQueryParams",
    "GetOauthAuthorizeResponse",
    "GetOauthFrontchannelLogoutQueryParams",
    "GetOauthFrontchannelLogoutResponse",
    "GetOauthFrontchannelLogoutResponse200",
    "GetOauthLogoutResponse",
    "GetOauthUserinfoQueryParams",
    "GetOauthUserinfoResponse",
    "GetOauthUserinfoResponse200",
    "GetSamlMetadataQueryParams",
    "GetSamlMetadataResponse",
    "GetSamlMetadataResponse200",
    "GetScimV2GroupsByIdPathParams",
    "GetScimV2GroupsByIdResponse",
    "GetScimV2GroupsByIdResponse200",
    "GetScimV2GroupsQueryParams",
    "GetScimV2GroupsResponse",
    "GetScimV2GroupsResponse200",
    "GetScimV2ResourceTypesResponse",
    "GetScimV2ResourceTypesResponse200",
    "GetScimV2SchemasResponse",
    "GetScimV2SchemasResponse200",
    "GetScimV2ServiceProviderConfigResponse",
    "GetScimV2ServiceProviderConfigResponse200",
    "GetScimV2UsersByIdPathParams",
    "GetScimV2UsersByIdResponse",
    "GetScimV2UsersByIdResponse200",
    "GetScimV2UsersQueryParams",
    "GetScimV2UsersResponse",
    "GetScimV2UsersResponse200",
    "GetWellKnownJwksJsonResponse",
    "GetWellKnownJwksJsonResponse200",
    "GetWellKnownJwksJsonResponse200KeysItem",
    "GetWellKnownOpenidConfigurationResponse",
    "GetWellKnownOpenidConfigurationResponse200",
    "IssuedServiceIdentityCredential",
    "OAuthClient",
    "PatchApiAdminConnectorsByIdPathParams",
    "PatchApiAdminConnectorsByIdRequestBody",
    "PatchApiAdminConnectorsByIdResponse",
    "PatchApiAdminConnectorsByIdResponse200",
    "PatchApiAdminSamlServiceProvidersByIdPathParams",
    "PatchApiAdminSamlServiceProvidersByIdRequestBody",
    "PatchApiAdminSamlServiceProvidersByIdResponse",
    "PatchApiAdminSamlServiceProvidersByIdResponse200",
    "PatchApiAdminServiceIdentitiesByIdPathParams",
    "PatchApiAdminServiceIdentitiesByIdRequestBody",
    "PatchApiAdminServiceIdentitiesByIdResponse",
    "PatchApiAdminServiceIdentitiesByIdResponse200",
    "PatchApiAdminUsersByIdRequestBody",
    "PatchApiAdminUsersByIdResponse",
    "PatchApiPortalProfileRequestBody",
    "PatchApiPortalProfileResponse",
    "PatchApiPortalProfileResponse200",
    "PatchScimV2GroupsByIdPathParams",
    "PatchScimV2GroupsByIdResponse",
    "PatchScimV2GroupsByIdResponse200",
    "PatchScimV2UsersByIdPathParams",
    "PatchScimV2UsersByIdResponse",
    "PatchScimV2UsersByIdResponse200",
    "PostApiAccountMfaTotpEnrollResponse",
    "PostApiAccountMfaTotpEnrollResponse200",
    "PostApiAccountMfaTotpVerifyRequestBody",
    "PostApiAccountMfaTotpVerifyResponse",
    "PostApiAccountMfaTotpVerifyResponse200",
    "PostApiAccountMfaWebauthnRegisterBeginRequestBody",
    "PostApiAccountMfaWebauthnRegisterBeginResponse",
    "PostApiAccountMfaWebauthnRegisterBeginResponse200",
    "PostApiAccountMfaWebauthnRegisterBeginResponse200Rp",
    "PostApiAccountMfaWebauthnRegisterBeginResponse200User",
    "PostApiAccountMfaWebauthnRegisterFinishRequestBody",
    "PostApiAccountMfaWebauthnRegisterFinishResponse",
    "PostApiAccountMfaWebauthnRegisterFinishResponse200",
    "PostApiAdminAccessRequestsByIdApprovePathParams",
    "PostApiAdminAccessRequestsByIdApproveRequestBody",
    "PostApiAdminAccessRequestsByIdApproveResponse",
    "PostApiAdminAccessRequestsByIdApproveResponse200",
    "PostApiAdminAccessRequestsByIdRejectPathParams",
    "PostApiAdminAccessRequestsByIdRejectRequestBody",
    "PostApiAdminAccessRequestsByIdRejectResponse",
    "PostApiAdminAccessRequestsByIdRejectResponse200",
    "PostApiAdminAccessRequestsProcessExpirationsRequestBody",
    "PostApiAdminAccessRequestsProcessExpirationsResponse",
    "PostApiAdminAccessRequestsProcessExpirationsResponse200",
    "PostApiAdminAccessRequestsRequestBody",
    "PostApiAdminAccessRequestsResponse",
    "PostApiAdminAccessRequestsResponse201",
    "PostApiAdminAccessReviewsCampaignsRequestBody",
    "PostApiAdminAccessReviewsCampaignsResponse",
    "PostApiAdminAccessReviewsCampaignsResponse201",
    "PostApiAdminAccessReviewsItemsByIdDecisionPathParams",
    "PostApiAdminAccessReviewsItemsByIdDecisionRequestBody",
    "PostApiAdminAccessReviewsItemsByIdDecisionResponse",
    "PostApiAdminAccessReviewsItemsByIdDecisionResponse200",
    "PostApiAdminAppsByIdImagePathParams",
    "PostApiAdminAppsByIdImageRequestBody",
    "PostApiAdminAppsByIdImageResponse",
    "PostApiAdminAppsByIdImageResponse200",
    "PostApiAdminAppsRequestBody",
    "PostApiAdminAppsResponse",
    "PostApiAdminAuthenticationFlowsRequestBody",
    "PostApiAdminAuthenticationFlowsResponse",
    "PostApiAdminAuthenticationFlowsResponse201",
    "PostApiAdminAuthorizationCheckRequestBody",
    "PostApiAdminAuthorizationCheckResponse",
    "PostApiAdminAuthorizationCheckResponse200",
    "PostApiAdminAuthorizationCheckResponse200DecisionsItem",
    "PostApiAdminClientsRequestBody",
    "PostApiAdminClientsResponse",
    "PostApiAdminClientsResponse201",
    "PostApiAdminConnectorsByIdMappingsPathParams",
    "PostApiAdminConnectorsByIdMappingsRequestBody",
    "PostApiAdminConnectorsByIdMappingsResponse",
    "PostApiAdminConnectorsByIdMappingsResponse201",
    "PostApiAdminConnectorsByIdSyncPathParams",
    "PostApiAdminConnectorsByIdSyncResponse",
    "PostApiAdminConnectorsByIdSyncResponse202",
    "PostApiAdminConnectorsRequestBody",
    "PostApiAdminConnectorsResponse",
    "PostApiAdminConnectorsResponse201",
    "PostApiAdminElevationsBreakGlassRequestBody",
    "PostApiAdminElevationsBreakGlassResponse",
    "PostApiAdminElevationsBreakGlassResponse201",
    "PostApiAdminElevationsByIdActivatePathParams",
    "PostApiAdminElevationsByIdActivateResponse",
    "PostApiAdminElevationsByIdActivateResponse200",
    "PostApiAdminElevationsByIdApprovePathParams",
    "PostApiAdminElevationsByIdApproveRequestBody",
    "PostApiAdminElevationsByIdApproveResponse",
    "PostApiAdminElevationsByIdApproveResponse200",
    "PostApiAdminElevationsByIdRevokePathParams",
    "PostApiAdminElevationsByIdRevokeRequestBody",
    "PostApiAdminElevationsByIdRevokeResponse",
    "PostApiAdminElevationsByIdRevokeResponse200",
    "PostApiAdminElevationsCheckRequestBody",
    "PostApiAdminElevationsCheckResponse",
    "PostApiAdminElevationsCheckResponse200",
    "PostApiAdminElevationsProcessExpirationsResponse",
    "PostApiAdminElevationsProcessExpirationsResponse200",
    "PostApiAdminElevationsRequestBody",
    "PostApiAdminElevationsResponse",
    "PostApiAdminElevationsResponse201",
    "PostApiAdminEventHooksRequestBody",
    "PostApiAdminEventHooksResponse",
    "PostApiAdminFederationProvidersRequestBody",
    "PostApiAdminFederationProvidersResponse",
    "PostApiAdminGroupRoleAssignmentsRequestBody",
    "PostApiAdminGroupsRequestBody",
    "PostApiAdminGroupsResponse",
    "PostApiAdminPluginsRequestBody",
    "PostApiAdminPluginsResponse",
    "PostApiAdminPluginsResponse201",
    "PostApiAdminPluginsValidateRequestBody",
    "PostApiAdminPluginsValidateResponse",
    "PostApiAdminPluginsValidateResponse200",
    "PostApiAdminPoliciesEvaluateRequestBody",
    "PostApiAdminPoliciesEvaluateResponse",
    "PostApiAdminPoliciesEvaluateResponse200",
    "PostApiAdminPoliciesEvaluateResponse200DecisionsItem",
    "PostApiAdminPoliciesRequestBody",
    "PostApiAdminPoliciesResponse",
    "PostApiAdminProvisioningJobsReconcileRequestBody",
    "PostApiAdminProvisioningJobsReconcileResponse",
    "PostApiAdminProvisioningJobsReconcileResponse202",
    "PostApiAdminProvisioningMappingsRequestBody",
    "PostApiAdminProvisioningMappingsResponse",
    "PostApiAdminProvisioningMappingsResponse201",
    "PostApiAdminProvisioningTokensRequestBody",
    "PostApiAdminProvisioningTokensResponse",
    "PostApiAdminProvisioningTokensResponse201",
    "PostApiAdminRoleAssignmentsRequestBody",
    "PostApiAdminRolesRequestBody",
    "PostApiAdminRolesResponse",
    "PostApiAdminSamlServiceProvidersByIdCertificatesRotatePathParams",
    "PostApiAdminSamlServiceProvidersByIdCertificatesRotateRequestBody",
    "PostApiAdminSamlServiceProvidersByIdCertificatesRotateResponse",
    "PostApiAdminSamlServiceProvidersByIdCertificatesRotateResponse200",
    "PostApiAdminSamlServiceProvidersByIdMetadataPathParams",
    "PostApiAdminSamlServiceProvidersByIdMetadataRequestBody",
    "PostApiAdminSamlServiceProvidersByIdMetadataResponse",
    "PostApiAdminSamlServiceProvidersByIdMetadataResponse200",
    "PostApiAdminSamlServiceProvidersByIdMetadataResponse200Imported",
    "PostApiAdminSamlServiceProvidersRequestBody",
    "PostApiAdminSamlServiceProvidersResponse",
    "PostApiAdminSamlServiceProvidersResponse201",
    "PostApiAdminScopesRequestBody",
    "PostApiAdminScopesResponse",
    "PostApiAdminServiceIdentitiesByIdCredentialsPathParams",
    "PostApiAdminServiceIdentitiesByIdCredentialsRequestBody",
    "PostApiAdminServiceIdentitiesByIdCredentialsResponse",
    "PostApiAdminServiceIdentitiesByIdCredentialsResponse201",
    "PostApiAdminServiceIdentitiesByIdCredentialsRotatePathParams",
    "PostApiAdminServiceIdentitiesByIdCredentialsRotateRequestBody",
    "PostApiAdminServiceIdentitiesByIdCredentialsRotateResponse",
    "PostApiAdminServiceIdentitiesByIdCredentialsRotateResponse201",
    "PostApiAdminServiceIdentitiesRequestBody",
    "PostApiAdminServiceIdentitiesResponse",
    "PostApiAdminServiceIdentitiesResponse201",
    "PostApiAdminSettingsDatabaseMigrateRequestBody",
    "PostApiAdminSettingsDatabaseMigrateResponse",
    "PostApiAdminSettingsDatabaseMigrateResponse200",
    "PostApiAdminSettingsDatabaseTestRequestBody",
    "PostApiAdminSettingsDatabaseTestResponse",
    "PostApiAdminSettingsDatabaseTestResponse200",
    "PostApiAdminSettingsTestEmailRequestBody",
    "PostApiAdminSettingsTestEmailResponse",
    "PostApiAdminSettingsTestEmailResponse200",
    "PostApiAdminTenantsRequestBody",
    "PostApiAdminTenantsResponse",
    "PostApiAdminUserAttributesRequestBody",
    "PostApiAdminUserAttributesResponse",
    "PostApiAdminUserGroupsRequestBody",
    "PostApiAdminUsersByIdAvatarPathParams",
    "PostApiAdminUsersByIdAvatarRequestBody",
    "PostApiAdminUsersByIdAvatarResponse",
    "PostApiAdminUsersByIdAvatarResponse200",
    "PostApiAdminUsersByIdResetPasswordRequestBody",
    "PostApiAdminUsersRequestBody",
    "PostApiAdminUsersResponse",
    "PostApiAdminUsersResponse201",
    "PostApiPortalAvatarRequestBody",
    "PostApiPortalAvatarResponse",
    "PostApiPortalAvatarResponse200",
    "PostApiPortalChangePasswordRequestBody",
    "PostApiPortalChangePasswordResponse",
    "PostApiPortalChangePasswordResponse200",
    "PostAuthLoginMfaRequestBody",
    "PostAuthLoginMfaResponse",
    "PostAuthLoginMfaResponse200",
    "PostAuthLoginRequestBody",
    "PostAuthLoginResponse",
    "PostAuthLoginResponse200",
    "PostAuthLoginResponse202",
    "PostAuthLoginWebauthnBeginRequestBody",
    "PostAuthLoginWebauthnBeginResponse",
    "PostAuthLoginWebauthnBeginResponse200",
    "PostAuthLoginWebauthnFinishRequestBody",
    "PostAuthLoginWebauthnFinishResponse",
    "PostAuthLoginWebauthnFinishResponse200",
    "PostAuthLogoutResponse",
    "PostAuthRecoveryRequestBody",
    "PostAuthRecoveryRequestRequestBody",
    "PostAuthRecoveryRequestResponse",
    "PostAuthRecoveryRequestResponse200",
    "PostAuthRecoveryResponse",
    "PostAuthRecoveryResponse200",
    "PostConnectRegisterRequestBody",
    "PostConnectRegisterResponse",
    "PostConnectRegisterResponse201",
    "PostOauthBackchannelLogoutRequestBody",
    "PostOauthBackchannelLogoutResponse",
    "PostOauthBackchannelLogoutResponse200",
    "PostOauthCibaApproveRequestBody",
    "PostOauthCibaApproveResponse",
    "PostOauthCibaApproveResponse200",
    "PostOauthCibaAuthenticateRequestBody",
    "PostOauthCibaAuthenticateResponse",
    "PostOauthCibaAuthenticateResponse200",
    "PostOauthDeviceAuthorizeRequestBody",
    "PostOauthDeviceAuthorizeResponse",
    "PostOauthDeviceAuthorizeResponse200",
    "PostOauthDeviceVerifyRequestBody",
    "PostOauthDeviceVerifyResponse",
    "PostOauthDeviceVerifyResponse200",
    "PostOauthIntrospectRequestBody",
    "PostOauthIntrospectResponse",
    "PostOauthIntrospectResponse200",
    "PostOauthTokenExchangeRequestBody",
    "PostOauthTokenExchangeResponse",
    "PostOauthTokenExchangeResponse200",
    "PostOauthTokenRequestBody",
    "PostOauthTokenRequestBodyOption1",
    "PostOauthTokenRequestBodyOption2",
    "PostOauthTokenRequestBodyOption3",
    "PostOauthTokenRequestBodyOption4",
    "PostOauthTokenRequestBodyOption5",
    "PostOauthTokenRequestBodyOption6",
    "PostOauthTokenRequestBodyOption7",
    "PostOauthTokenRequestBodyOption8",
    "PostOauthTokenResponse",
    "PostOauthTokenResponse200",
    "PostOauthTokenRevokeRequestBody",
    "PostOauthTokenRevokeResponse",
    "PostOauthTokenRevokeResponse200",
    "PostSamlAcsBySpIdPathParams",
    "PostSamlAcsBySpIdRequestBody",
    "PostSamlAcsBySpIdResponse",
    "PostSamlAcsBySpIdResponse200",
    "PostSamlSloRequestBody",
    "PostSamlSloResponse",
    "PostSamlSloResponse200",
    "PostSamlSsoRequestBody",
    "PostSamlSsoResponse",
    "PostSamlSsoResponse200",
    "PostScimV2GroupsResponse",
    "PostScimV2GroupsResponse201",
    "PostScimV2UsersResponse",
    "PostScimV2UsersResponse201",
    "PutApiAdminAppsByIdRequestBody",
    "PutApiAdminAppsByIdResponse",
    "PutApiAdminAuthenticationFlowsByIdPathParams",
    "PutApiAdminAuthenticationFlowsByIdRequestBody",
    "PutApiAdminAuthenticationFlowsByIdResponse",
    "PutApiAdminAuthenticationFlowsByIdResponse200",
    "PutApiAdminClientsByIdRequestBody",
    "PutApiAdminClientsByIdResponse",
    "PutApiAdminEventHooksByIdRequestBody",
    "PutApiAdminEventHooksByIdResponse",
    "PutApiAdminFederationProvidersByIdRequestBody",
    "PutApiAdminFederationProvidersByIdResponse",
    "PutApiAdminGroupsByIdRequestBody",
    "PutApiAdminGroupsByIdResponse",
    "PutApiAdminPoliciesByIdAssignmentsRequestBody",
    "PutApiAdminPoliciesByIdRequestBody",
    "PutApiAdminPoliciesByIdResponse",
    "PutApiAdminRolesByIdRequestBody",
    "PutApiAdminRolesByIdResponse",
    "PutApiAdminSettingsRequestBody",
    "PutApiAdminSettingsResponse",
    "PutApiAdminTenantsRequestBody",
    "PutApiAdminTenantsResponse",
    "PutApiAdminUserAttributesByIdGroupsRequestBody",
    "PutApiAdminUserAttributesByIdRequestBody",
    "PutApiAdminUserAttributesByIdResponse",
    "PutScimV2GroupsByIdPathParams",
    "PutScimV2GroupsByIdResponse",
    "PutScimV2GroupsByIdResponse200",
    "PutScimV2UsersByIdPathParams",
    "PutScimV2UsersByIdResponse",
    "PutScimV2UsersByIdResponse200",
    "RemovePolicyAssignmentRequestBody",
    "SamlAssertionAudit",
    "SamlServiceProvider",
    "ServiceIdentity",
    "ServiceIdentityCredential",
    "ServiceIdentityWithCredentials",
]
