# Plugin Development Guide

This document defines the plugin contract for the NexusID extension runtime.

## Runtime model

- Plugins are uploaded through Admin > Plugins.
- Each plugin includes a manifest and a ZIP bundle.
- Active plugins are loaded by the runtime and invoked when matching events are emitted.
- Runtime executes plugin handlers in a sandboxed VM context with timeout constraints.

## Manifest contract

A plugin manifest must contain:

```json
{
  "id": "acme.audit-enricher",
  "name": "ACME Audit Enricher",
  "version": "1.0.0",
  "description": "Optional description",
  "entrypoint": "dist/index.js",
  "permissions": ["events:emit", "users:read"],
  "hooks": ["user.created", "auth.login.succeeded"],
  "homepage": "https://plugins.example.com/acme-audit-enricher"
}
```

Validation highlights:

- `id`: lowercase slug format, 3-64 chars, supports `.`, `_`, `-`
- `version`: semantic version string
- `entrypoint`: relative path in ZIP bundle, no `..`
- `hooks`: event types that should trigger plugin execution

## Entrypoint contract

The entrypoint file must export an `onEvent(event, api)` function:

```javascript
module.exports.onEvent = async function onEvent(event, api) {
  if (event.type === 'user.created') {
    api.log('Observed user creation', { userId: event.payload?.userId || 'unknown' })
  }
}
```

### Event object

- `type`: emitted event type
- `payload`: event payload from platform service
- `sentAt`: ISO timestamp when runtime dispatch started

### Runtime API

- `api.log(message, metadata?)`: emits plugin runtime audit logs

## Available event hooks

Plugins may declare hooks from emitted platform events, including examples such as:

- `user.created`
- `user.updated`
- `user.deleted`
- `auth.login.succeeded`
- `auth.login.failed`
- `auth.logout`
- `connector.sync.failed`

## Admin APIs

- `GET /api/admin/plugins`
- `POST /api/admin/plugins/validate`
- `POST /api/admin/plugins`
- `DELETE /api/admin/plugins/:id`

## Packaging

1. Build plugin JavaScript output.
2. Place compiled entrypoint path matching `manifest.entrypoint`.
3. ZIP the plugin output.
4. Upload ZIP through Admin > Plugins.
5. Validate first, then upload with optional activation.

## Security guidance

- Keep handlers deterministic and short-running.
- Avoid dynamic code generation and hidden side effects.
- Request minimal permissions.
- Declare only required hooks.
- Review runtime logs and plugin audit events after deployment.

---

## App permission format

When an app or service registers custom permissions during bootstrap (e.g. via `AppService.updateApp` with a `resources` array, or by assigning permissions directly to a role), the permission string **must** follow this format:

```
{appId}:{resourceName}:{action}
```

For example, for an app with id `cat-app` and resource `cat-errors`:

```
cat-app:cat-errors:view
cat-app:cat-errors:add
cat-app:cat-errors:change
cat-app:cat-errors:delete
```

### Why this matters

System (built-in) permissions use the two-segment format `{resource}:{action}` (e.g. `users:view`). App-specific permissions **must** be prefixed with the appId as the first segment so the admin UI can:

1. Identify which app owns the resource.
2. Group the permission rows correctly under that app's section in the Roles permission matrix.
3. Distinguish app permissions from system permissions without ambiguity.

### Registering resources on an app

Declare the resource names on the app record (without the appId prefix — that is added by the permission key convention):

```typescript
await adminClient.apps.update(appId, {
  resources: ["cat-errors", "cat-reports"]
})
```

Then when assigning permissions to a role, use the full three-segment key:

```typescript
await adminClient.roles.update(roleId, {
  permissions: [
    "cat-app:cat-errors:view",
    "cat-app:cat-errors:change",
  ]
})
```

The admin UI Roles page will render these under the app's labelled section in the permission matrix.
