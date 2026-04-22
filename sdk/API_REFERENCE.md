# SDK API Reference

This file is generated from sdk/src/index.ts. Do not edit manually.

Generated at: 2026-04-22T16:12:47.962Z

## Runtime API Documentation

### createAdminClient

**Purpose:** Creates an admin client for typed administrative APIs.

**Declared in:** ./admin/client.js

**Parameters:**

- options: ClientOptions

**Returns:** AdminClient

### createAuthAPI

**Purpose:** Creates an auth API helper for token lifecycle operations.

**Declared in:** ./auth/client.js

**Parameters:**

- client: ClientInstance

**Returns:** AuthAPI

### buildAuthorizeUrl

**Purpose:** Builds an OAuth authorization URL from client parameters.

**Declared in:** ./auth/oauth.js

**Parameters:**

- baseUrl: string
- params: OAuthAuthorizeParams

**Returns:** string

### createCodeChallenge

**Purpose:** Derives a PKCE code challenge from a verifier.

**Declared in:** ./auth/pkce.js

**Parameters:**

- codeVerifier: string

**Returns:** Promise<string>

### createCodeVerifier

**Purpose:** Generates a PKCE code verifier string.

**Declared in:** ./auth/pkce.js

**Parameters:**

- length: number

**Returns:** string

### generatePKCEPair

**Purpose:** Generates both PKCE verifier and challenge values.

**Declared in:** ./auth/pkce.js

**Parameters:**

- length: number

**Returns:** Promise<PKCEPair>

### createClient

**Purpose:** Creates the base HTTP SDK client instance.

**Declared in:** ./core/client.js

**Parameters:**

- options: ClientOptions

**Returns:** ClientInstance

### createPortalAPI

**Purpose:** Creates a portal API helper for current logged-in user actions.

**Declared in:** ./portal/client.js

**Parameters:**

- client: ClientInstance

**Returns:** PortalAPI

### pollWorkflowState

**Purpose:** Polls a state fetcher until a terminal condition is met.

**Declared in:** ./governance/polling.js

**Parameters:**

- fetchState: () => Promise<T>
- options: PollWorkflowOptions<T>

**Returns:** Promise<T>

### waitForAccessRequestTerminalState

**Purpose:** Waits until an access request reaches a terminal status.

**Declared in:** ./governance/polling.js

**Parameters:**

- accessRequests: Pick<AccessRequestsAPI, "list">
- requestId: string
- options: WaitForAccessRequestOptions = {}

**Returns:** Promise<SDKAccessRequest>

### waitForElevationTerminalState

**Purpose:** Waits until an elevation request reaches a terminal status.

**Declared in:** ./governance/polling.js

**Parameters:**

- elevations: Pick<ElevationsAPI, "get">
- requestId: string
- options: WaitForElevationOptions = {}

**Returns:** Promise<SDKElevationRequest>

### APIClientError

**Purpose:** Base SDK error with standardized metadata.

**Declared in:** ./core/errors.js

**Parameters:**

- message: string
- options: APIClientErrorOptions = {}

**Returns:** APIClientError

### APIRequestTimeoutError

**Purpose:** Error raised when request timeout is reached.

**Declared in:** ./core/errors.js

**Parameters:**

- message: string
- options: APIClientErrorOptions = {}

**Returns:** APIRequestTimeoutError

### APIResponseError

**Purpose:** Error raised for non-2xx HTTP responses.

**Declared in:** ./core/errors.js

**Parameters:**

- message: string
- options: APIClientErrorOptions = {}

**Returns:** APIResponseError

## Type Exports Index

- AccessReviewDecisionInput
- AccessReviewListQuery
- AccessReviewsAPI
- AccessRequestDecisionInput
- AccessRequestListQuery
- AccessRequestsAPI
- AdminClient
- AppListQuery
- AppsAPI
- ApproveElevationInput
- AssignGroupRoleInput
- AssignRoleInput
- AssignUserGroupInput
- CheckElevationAccessInput
- CheckElevationAccessResult
- ClientsAPI
- ConnectorsAPI
- ConnectorRunListQuery
- ConnectorRunStatus
- ConnectorStatus
- ConnectorType
- CreateAccessRequestInput
- CreateAccessReviewCampaignInput
- CreateAppInput
- CreateBreakGlassInput
- CreateConnectorInput
- CreateConnectorMappingInput
- CreateGroupInput
- CreateOAuthClientInput
- CreateOAuthScopeInput
- CreateElevationInput
- CreateRoleInput
- CreateUserInput
- CreatedUserSummary
- ElevationListQuery
- ElevationSessionStatus
- ElevationSessionsQuery
- ElevationStatus
- ElevationsAPI
- GroupListQuery
- GroupsAPI
- GrantType
- OAuthClientListQuery
- ProcessElevationExpirationsResult
- ProcessExpiredAccessRequestsInput
- ProcessExpiredAccessRequestsResult
- RoleScope
- RoleListQuery
- RolesAPI
- SDKAccessRequest
- SDKAccessReviewCampaign
- SDKAccessReviewCampaignDetails
- SDKAccessReviewCampaignResult
- SDKAccessReviewItem
- SDKApp
- SDKBreakGlassResult
- SDKConnector
- SDKConnectorMapping
- SDKConnectorRun
- SDKElevationRequest
- SDKElevationSession
- SDKGroup
- SDKOAuthClient
- SDKOAuthScope
- SDKRole
- SDKUser
- ScopeListQuery
- ScopesAPI
- StalledAccessRequest
- StalledAccessRequestsResponse
- UpdateOAuthClientInput
- UpdateConnectorInput
- UpdateAppInput
- UpdateGroupInput
- UpdateRoleInput
- UpdatedUserSummary
- UpdateUserInput
- UserListQuery
- UsersAPI
- APIErrorPayload
- AuthConfig
- ClientInstance
- ClientOptions
- ListPageQuery
- QueryValue
- RequestOptions
- RetryPolicy
- AuthAPI
- AuthorizationCodeTokenInput
- BearerAuthConfig
- ClientCredentialsInput
- OAuthAuthorizeParams
- OAuthResponseType
- OAuthScope
- OAuthTokenResponse
- OAuthTokenTypeHint
- PKCEPair
- RefreshTokenInput
- RevokeTokenInput
- SessionAuthConfig
- TokenExchangeInput
- CreateServiceIdentityInput
- RotateServiceIdentityCredentialInput
- SDKIssuedServiceIdentityCredential
- SDKServiceIdentity
- SDKServiceIdentityCredential
- SDKServiceIdentityUsage
- ServiceIdentityCredentialIssueInput
- ServiceIdentityStatus
- ServiceIdentityWithCredentials
- UpdateServiceIdentityInput
- WorkloadAPI
- CreateProvisioningMappingInput
- CreateScimTokenInput
- ProvisioningAPI
- ProvisioningMappingsAPI
- ProvisioningTokensAPI
- ReconciliationAPI
- ReconciliationInput
- SDKCreatedScimToken
- SDKProvisioningJob
- SDKProvisioningMapping
- SDKScimToken
- ChangePortalPasswordInput
- PortalAPI
- SDKPortalApp
- SDKPortalMe
- SDKPortalRolePermissions
- UpdatePortalProfileInput
- UploadPortalAvatarResult
- CertificateType
- CreateServiceProviderInput
- ListAssertionAuditsQuery
- ListServiceProvidersQuery
- NameIdFormat
- PaginatedResponse
- RotateServiceProviderCertificateInput
- SamlAdminAPI
- SamlAssertionAuditsAPI
- SamlServiceProvidersAPI
- SDKSamlAssertionAudit
- SDKSamlNameIdMapping
- SDKSamlServiceProvider
- SDKSamlServiceProviderDetail
- UpdateServiceProviderInput
- UploadServiceProviderMetadataInput
- UploadMetadataResult

## Export Groups

### Runtime from ./admin/client.js

- createAdminClient

### Runtime from ./auth/client.js

- createAuthAPI

### Runtime from ./auth/oauth.js

- buildAuthorizeUrl

### Runtime from ./auth/pkce.js

- createCodeChallenge
- createCodeVerifier
- generatePKCEPair

### Runtime from ./core/client.js

- createClient

### Runtime from ./portal/client.js

- createPortalAPI

### Runtime from ./governance/polling.js

- pollWorkflowState
- waitForAccessRequestTerminalState
- waitForElevationTerminalState

### Runtime from ./core/errors.js

- APIClientError
- APIRequestTimeoutError
- APIResponseError

### Types from ./admin/types.js

- AccessReviewDecisionInput
- AccessReviewListQuery
- AccessReviewsAPI
- AccessRequestDecisionInput
- AccessRequestListQuery
- AccessRequestsAPI
- AdminClient
- AppListQuery
- AppsAPI
- ApproveElevationInput
- AssignGroupRoleInput
- AssignRoleInput
- AssignUserGroupInput
- CheckElevationAccessInput
- CheckElevationAccessResult
- ClientsAPI
- ConnectorsAPI
- ConnectorRunListQuery
- ConnectorRunStatus
- ConnectorStatus
- ConnectorType
- CreateAccessRequestInput
- CreateAccessReviewCampaignInput
- CreateAppInput
- CreateBreakGlassInput
- CreateConnectorInput
- CreateConnectorMappingInput
- CreateGroupInput
- CreateOAuthClientInput
- CreateOAuthScopeInput
- CreateElevationInput
- CreateRoleInput
- CreateUserInput
- CreatedUserSummary
- ElevationListQuery
- ElevationSessionStatus
- ElevationSessionsQuery
- ElevationStatus
- ElevationsAPI
- GroupListQuery
- GroupsAPI
- GrantType
- OAuthClientListQuery
- ProcessElevationExpirationsResult
- ProcessExpiredAccessRequestsInput
- ProcessExpiredAccessRequestsResult
- RoleScope
- RoleListQuery
- RolesAPI
- SDKAccessRequest
- SDKAccessReviewCampaign
- SDKAccessReviewCampaignDetails
- SDKAccessReviewCampaignResult
- SDKAccessReviewItem
- SDKApp
- SDKBreakGlassResult
- SDKConnector
- SDKConnectorMapping
- SDKConnectorRun
- SDKElevationRequest
- SDKElevationSession
- SDKGroup
- SDKOAuthClient
- SDKOAuthScope
- SDKRole
- SDKUser
- ScopeListQuery
- ScopesAPI
- StalledAccessRequest
- StalledAccessRequestsResponse
- UpdateOAuthClientInput
- UpdateConnectorInput
- UpdateAppInput
- UpdateGroupInput
- UpdateRoleInput
- UpdatedUserSummary
- UpdateUserInput
- UserListQuery
- UsersAPI

### Types from ./core/types.js

- APIErrorPayload
- AuthConfig
- ClientInstance
- ClientOptions
- ListPageQuery
- QueryValue
- RequestOptions
- RetryPolicy

### Types from ./auth/types.js

- AuthAPI
- AuthorizationCodeTokenInput
- BearerAuthConfig
- ClientCredentialsInput
- OAuthAuthorizeParams
- OAuthResponseType
- OAuthScope
- OAuthTokenResponse
- OAuthTokenTypeHint
- PKCEPair
- RefreshTokenInput
- RevokeTokenInput
- SessionAuthConfig
- TokenExchangeInput

### Types from ./workload/types.js

- CreateServiceIdentityInput
- RotateServiceIdentityCredentialInput
- SDKIssuedServiceIdentityCredential
- SDKServiceIdentity
- SDKServiceIdentityCredential
- SDKServiceIdentityUsage
- ServiceIdentityCredentialIssueInput
- ServiceIdentityStatus
- ServiceIdentityWithCredentials
- UpdateServiceIdentityInput
- WorkloadAPI

### Types from ./provisioning/types.js

- CreateProvisioningMappingInput
- CreateScimTokenInput
- ProvisioningAPI
- ProvisioningMappingsAPI
- ProvisioningTokensAPI
- ReconciliationAPI
- ReconciliationInput
- SDKCreatedScimToken
- SDKProvisioningJob
- SDKProvisioningMapping
- SDKScimToken

### Types from ./portal/types.js

- ChangePortalPasswordInput
- PortalAPI
- SDKPortalApp
- SDKPortalMe
- SDKPortalRolePermissions
- UpdatePortalProfileInput
- UploadPortalAvatarResult

### Types from ./federation/types.js

- CertificateType
- CreateServiceProviderInput
- ListAssertionAuditsQuery
- ListServiceProvidersQuery
- NameIdFormat
- PaginatedResponse
- RotateServiceProviderCertificateInput
- SamlAdminAPI
- SamlAssertionAuditsAPI
- SamlServiceProvidersAPI
- SDKSamlAssertionAudit
- SDKSamlNameIdMapping
- SDKSamlServiceProvider
- SDKSamlServiceProviderDetail
- UpdateServiceProviderInput
- UploadServiceProviderMetadataInput
- UploadMetadataResult
