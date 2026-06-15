# nexusid-sdk (Python)

Python SDK for NexusID APIs.

This mirrors the TypeScript SDK's ergonomics with:
- a reusable HTTP client
- OAuth helpers
- admin and portal API modules
- PKCE and authorize URL helpers

## Install (local repo)

```bash
pip install -e ./sdk-python
```

## Quick start

```python
from nexusid_sdk import create_client, create_admin_client, create_auth_api

client = create_client(base_url="https://iam.example.com")
auth = create_auth_api(client)

token = auth.exchange_client_credentials(
    client_id="my-client",
    client_secret="my-secret",
    scope=["openid", "profile"],
)

admin = create_admin_client(
    base_url="https://iam.example.com",
    auth={"type": "bearer", "token": token["access_token"]},
)

users = admin.users.list(limit=20, offset=0)
print(users)
```

## Common APIs

- `auth.exchange_authorization_code(...)`
- `auth.exchange_refresh_token(...)`
- `auth.exchange_client_credentials(...)`
- `auth.exchange_jwt_bearer(...)`
- `auth.exchange_saml2_bearer(...)`
- `auth.start_ciba_authentication(...)`
- `auth.approve_ciba_authentication(...)`
- `auth.exchange_ciba_token(...)`
- `auth.exchange_token(...)`
- `auth.revoke_token(...)`
- `auth.get_userinfo(...)` — roles, groups, and flattened permissions
- `auth.get_userinfo_signed()` — signed JWT UserInfo
- `admin.me.get()` — current admin user with roles, groups, permissions
- `admin.users.list(...)`
- `admin.users.get(user_id)` — full admin detail for a single user (profile, custom attributes, groups, roles)
- `admin.clients.list(...)`
- `admin.permissions.list()`
- `admin.access_requests.create(...)`
- `admin.elevations.create(...)`
- `admin.service_identities.create(...)`
- `admin.connectors.list()`
- `portal.me()`

## Packaging

```bash
cd sdk-python
python -m pip install -U build
python -m build
```

## Generated OpenAPI Models

The SDK ships with generated type models in `src/nexusid_sdk/generated/models.py`.

Regenerate after `openapi.yaml` changes:

```bash
npm run generate:sdk:python:models
```

## Examples

- `examples/basic_usage.py`
- `examples/assertion_ciba_auth.py`
- `examples/ciba_polling_negative_path.py`
