# Migration And Versioning Policy

## Versioning Rules

- SDK follows semantic versioning (`MAJOR.MINOR.PATCH`).
- `PATCH`:
  - bug fixes
  - internal improvements without API surface changes
- `MINOR`:
  - backward-compatible new APIs, types, and options
- `MAJOR`:
  - breaking runtime behavior changes
  - removed or renamed public exports
  - incompatible type signature changes

## Compatibility Promise

- Public exports from `sdk/src/index.ts` are the compatibility contract.
- Additive changes are preferred over mutation of existing contracts.
- Deprecated APIs remain for at least one minor release before removal.

## Deprecation Process

1. Mark export/type as deprecated in docs and release notes.
2. Provide direct replacement guidance and examples.
3. Keep compatibility through at least one minor release.
4. Remove only in the next major release.

## Migration Guidance

When upgrading versions:

1. Read release notes and deprecation sections.
2. Regenerate or refresh your local API reference snapshots.
3. Run `npm run check:sdk` and your app type checks.
4. Validate critical auth and admin workflows in staging.

## Breaking Change Categories

- Renaming/removing exports in `index.ts`
- Changing required fields in request input interfaces
- Changing return shape of public methods
- Altering default auth or retry behavior in incompatible ways

## Recommended Upgrade Testing

- OAuth auth code + PKCE flow
- Session-cookie server route flow
- Core admin CRUD calls
- Governance workflows (access request and elevation)
- Enterprise integration calls (SCIM/SAML/connectors)
