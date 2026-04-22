# TypeScript Client SDK Roadmap

This document defines the roadmap and implementation task lists for a TypeScript client SDK for the IAM platform.

The SDK is a client library, not a local IAM engine. Its job is to authenticate users, consume platform endpoints, and provide typed convenience wrappers around existing server capabilities such as admin elevations, access governance, SCIM, SAML, and workload identity.

## Goals

- Provide a typed TypeScript client for the platform's public and admin APIs.
- Make common integration tasks simple: authentication, token handling, endpoint consumption, and admin workflows.
- Reduce direct `fetch` boilerplate and improve reliability with typed requests, responses, and errors.
- Expose the platform's differentiators through ergonomic client APIs, especially apps, role-linked permissions, access governance, and elevation controls.
- Support browser, Node.js, and server-side framework integrations.

## Non-goals

- Do not reimplement authorization, policy evaluation, or role resolution locally.
- Do not duplicate server-side business rules in the SDK.
- Do not build a local identity store or session engine.
- Do not hide platform concepts behind generic abstractions that erase unique features.

## Primary SDK Use Cases

1. Authenticate end users with OAuth and OpenID Connect flows.
2. Consume public or protected APIs with typed request helpers.
3. Use admin APIs for users, groups, apps, roles, and governance workflows.
4. Manage elevation requests and sessions for privileged admin actions.
5. Integrate external systems with SCIM, SAML, workload identity, and connectors.

## Product Shape

The initial SDK should be published as one package with internally separated modules. If adoption grows, it can later be split into multiple published packages without changing the top-level API shape.

Proposed package name:

- `@nexusid/sdk`

Proposed internal module layout:

- `core`: HTTP transport, retries, base client, error model, auth headers, pagination helpers.
- `auth`: login helpers, OAuth token flows, OpenID Connect helpers, PKCE utilities, token refresh, revocation.
- `admin`: admin clients for users, groups, roles, apps, access requests, access reviews, and elevation APIs.
- `governance`: convenience wrappers for approval and review workflows.
- `provisioning`: SCIM token and mapping APIs, reconciliation jobs.
- `federation`: SAML service provider management and assertion audit clients.
- `workload`: service identity and token exchange clients.
- `connectors`: connector CRUD, sync, run status, and mappings.
- `frameworks`: optional helpers for Express, Fastify, Next.js, and frontend applications.

## Design Principles

- Typed-first API surface generated or aligned from `openapi.yaml`.
- Clear split between public client and admin client.
- Minimal hidden behavior: SDK methods should map closely to real platform endpoints.
- Runtime-safe input validation for SDK-specific configuration.
- Predictable error objects with HTTP status, error code, retryability, and request id metadata.
- Environment portability across browser and Node.js runtimes.
- Support for session cookie auth and bearer token auth.

## Core SDK Surface

### Core client

- `createClient(options)`
- `createAdminClient(options)`
- shared request pipeline with:
  - base URL
  - timeout
  - retry policy
  - custom `fetch` implementation
  - default headers
  - request id propagation

### Auth module

- authorize URL builder
- PKCE helper generation
- token exchange helpers
- refresh token helper
- token revocation helper
- session-aware request support

### Resource modules

- apps
- users
- groups
- roles
- permissions and role-linked permission views
- OAuth clients and scopes
- access requests
- access reviews
- elevations
- SCIM provisioning
- SAML admin endpoints
- workload identities
- connectors

### Convenience flows

- authenticate and attach credentials to client
- create access request and poll status
- request elevation, approve elevation, activate elevation, revoke elevation
- rotate workload credentials
- trigger connector sync and inspect run history

## Differentiators To Highlight In The SDK

These are the platform features the SDK should make especially easy to consume.

### Apps as first-class platform objects

- App-aware API methods should expose `appId` naturally in request inputs and response types.
- Examples and docs should show how apps scope users, groups, roles, OAuth clients, and customization.

### Permissions inside roles

- The SDK should expose role and permission data in a way that preserves the platform's model.
- The SDK should not flatten everything into coarse scopes when the platform uses role-linked permissions.
- Provide helper methods to fetch role details, permission views, and app-scoped entitlement data.

### Elevation and break-glass admin actions

- Elevation lifecycle should be first-class in the admin client.
- The SDK should make it easy for admin tools to request, approve, activate, check, and revoke elevations.
- Break-glass flows must be clearly separated and explicit in naming.

### Access governance workflows

- Access request creation, approval, rejection, listing, and review campaigns should have dedicated methods.
- SDK docs should show workflow-oriented examples instead of only raw endpoint usage.

## Proposed Public API Shape

```ts
import { createClient, createAdminClient } from "@nexusid/sdk";

const client = createClient({
  baseUrl: "https://iam.example.com",
  auth: {
    type: "bearer",
    token: process.env.NEXUSID_TOKEN!
  }
});

const admin = createAdminClient({
  baseUrl: "https://iam.example.com",
  auth: {
    type: "session",
    cookie: "sid=..."
  }
});

const apps = await admin.apps.list();
const request = await admin.accessRequests.create({
  subjectUserId: "user_123",
  entitlementType: "role",
  entitlementValue: "role_admin",
  justification: "Temporary access for incident response"
});

const elevation = await admin.elevations.create({
  resource: "connectors",
  action: "sync",
  justification: "Production connector retry"
});
```

## Delivery Phases

## Phase 1: Foundation

Objective: establish a reliable typed client base and initial auth support.

### Deliverables

- package scaffold
- TypeScript build and packaging pipeline
- shared HTTP client
- error model
- auth configuration model
- basic generated or handwritten API types

### Task list

- [x] Create SDK workspace directory and package scaffold.
- [x] Configure TypeScript build, declaration output, and dual ESM support strategy.
- [x] Implement transport layer with pluggable `fetch`.
- [x] Add timeout and retry support.
- [x] Add typed error classes and error normalization.
- [x] Define client initialization API.
- [ ] Add CI for build, lint, and tests.
- [ ] Add release versioning strategy.

## Phase 2: Authentication

Objective: make login and credential handling practical for integrators.

### Deliverables

- OAuth and OpenID Connect helpers
- PKCE utilities
- token refresh and revocation
- session-cookie support

### Task list

- [x] Implement authorize URL helper.
- [x] Implement PKCE code verifier and challenge helpers.
- [x] Implement token endpoint client methods.
- [x] Implement refresh token flow helper.
- [x] Implement token revocation helper.
- [x] Add session cookie authentication support.
- [x] Write browser SPA example.
- [x] Write server-side Express example.

## Phase 3: Core Admin Resource Clients

Objective: cover the most common administrative endpoint groups.

### Deliverables

- apps client
- users client
- groups client
- roles client
- OAuth clients and scopes client

### Task list

- [x] Implement apps API methods.
- [x] Implement users API methods.
- [x] Implement groups API methods.
- [x] Implement roles API methods.
- [x] Implement OAuth clients API methods.
- [x] Implement scopes API methods.
- [x] Add pagination and filtering helpers where needed.
- [x] Add integration tests against representative endpoints.

## Phase 4: Governance And Elevation

Objective: make privileged workflows easy to integrate from admin applications.

### Deliverables

- access requests client
- access reviews client
- elevations client
- workflow-oriented examples

### Task list

- [x] Implement access request create, list, approve, and reject methods.
- [x] Implement access review campaign and decision methods.
- [x] Implement elevation create, approve, activate, revoke, get, list, and check methods.
- [x] Implement break-glass elevation method with explicit naming.
- [x] Add helper for polling long-running governance workflow states.
- [x] Add admin console example covering elevation lifecycle.
- [x] Add documentation for required admin permissions and expected failure modes.

## Phase 5: Enterprise Integrations

Objective: cover enterprise-facing integration surfaces already present in the platform.

### Deliverables

- SCIM provisioning client
- SAML admin client
- workload identity client
- connectors client

### Task list

- [x] Implement SCIM provisioning token methods.
- [x] Implement provisioning mappings methods.
- [x] Implement reconciliation job methods.
- [x] Implement SAML service provider CRUD methods.
- [x] Implement SAML metadata upload and certificate rotation methods.
- [x] Implement SAML assertion audit list methods.
- [x] Implement workload identity CRUD and credential lifecycle methods.
- [x] Implement token exchange helper.
- [x] Implement connectors CRUD, sync trigger, run list, and mappings methods.
- [x] Add enterprise integration examples for SCIM and SAML onboarding.

## Phase 6: Developer Experience And Stabilization

Objective: make the SDK easy to adopt and safe to evolve.

### Deliverables

- polished documentation
- compatibility guarantees
- examples and templates
- contract testing

### Task list

- [x] Generate API reference docs from source, explain auth flows and how a client/server apps authenticates both ends.
- [x] Publish getting-started guide.
- [x] Publish migration and versioning policy.
- [x] Add OpenAPI drift checks (with allowlist baseline for currently undocumented endpoints).
- [x] Add contract tests against API fixtures or local test server.
- [x] Add framework-specific usage recipes.
- [x] Add changelog and release automation.
- [x] Define deprecation policy for public methods and types.

## Initial Repository Structure

```text
sdk/
  package.json
  tsconfig.json
  src/
    governance/
    provisioning/
    federation/
```

## Suggested Milestones

1. Milestone A: client foundation and auth.
2. Milestone B: apps, users, groups, roles, OAuth clients.
3. Milestone C: access governance and elevations.
4. Milestone D: SCIM, SAML, workload identity, connectors.
5. Milestone E: documentation, contract tests, and first public release.

## Acceptance Criteria For V1

- A developer can authenticate with OAuth or session credentials using documented SDK helpers.
- A developer can call public and admin endpoints without writing raw request boilerplate.
- An admin application can manage elevations through dedicated SDK methods.
- App-scoped resources are represented clearly in types and examples.
- Role-linked permission data can be consumed without flattening away platform semantics.
- SDK documentation includes at least one full example for auth, admin management, and elevation workflow.

## Open Decisions

- Decide whether the first release is a single package or a monorepo with multiple published packages.
- Decide whether client types are generated from `openapi.yaml` or maintained as handwritten curated models.
- Decide minimum runtime support targets for browser, Node.js, Bun, and edge runtimes.
- Decide whether to ship framework adapters in the first release or after core stabilization.

## Immediate Next Tasks

- [ ] Confirm SDK package name and publishing scope.
- [ ] Confirm single-package versus monorepo strategy.
- [x] Identify the first endpoint groups for implementation in v0.1.0.
- [ ] Define the auth support matrix for browser and server consumers.
- [x] Create the initial `sdk/` workspace and package files.
- [x] Implement the base client and auth configuration types.
