# NexusID signing-key rotation

NexusID loads its signing key set during bootstrap and does not hot-reload it. Rotation is an explicit restart-based operation using the protected `data/.jwt-signing-keys.json` file. New key files use schema version 1; staged overlap writes version 2. NexusID signs new tokens with the active private key and publishes the active plus at most one previous **public** key in its JWKS. The previous public key is also used to validate prior issuer tokens locally while the overlap is configured. A schema-v2 persisted keyset takes precedence over legacy `JWT_PRIVATE_KEY_PEM`/`JWT_PUBLIC_KEY_PEM` environment overrides, so staging cannot silently succeed while those old overrides keep signing. Startup rejects a malformed previous JWK, duplicate active/previous key IDs, private fields in the previous JWK, an invalid retirement timestamp, or a mismatched active private/public pair.

Stage a rotation against the authoritative key file:

```sh
npm run keys:rotate -- --file data/.jwt-signing-keys.json --previous-valid-until 2026-11-23T12:00:00.000Z
```

Before changing the active signer, create a point-in-time protected copy in a separate recovery location:

```sh
npm run keys:backup -- --file data/.jwt-signing-keys.json --to /secure/recovery/nexusid-signing-keys-2026-10-25.json
```

The command validates that the source keyset loads, requires a regular source file with no group/other permissions, and publishes the copy atomically with mode `0600`. It refuses to overwrite an existing destination and requires a non-symlink backup directory that is not group/world writable. The backup contains the active private key in plaintext JSON: place it on encrypted, access-controlled storage outside the application host and retain it under your secret-retention policy. This local command does not encrypt or replicate the backup.

To recover a backup onto an active signing-key path:

```sh
npm run keys:restore -- --from /secure/recovery/nexusid-signing-keys-2026-10-25.json --to data/.jwt-signing-keys.json
```

The command validates the backup the same way `keys:backup` validates its source, and publishes the restored file atomically with mode `0600`. It refuses to overwrite an existing destination unless `--force` is passed, since restoring is normally recovery onto a missing or corrupt file rather than routine replacement of a live one; pass `--force` for an intentional rollback onto a path that still has a file.

Set `previous-valid-until` later than the maximum possible expiry of every token signed by the old key, including configured client access-token lifetimes, refresh-token lifetimes, clock skew, and any locally issued token types. The command refuses a non-future deadline, a key file with group/other permissions, and a second rotation while a previous key is still present. It atomically replaces the protected file, preserving mode `0600`; the active new private key is kept in the file, while the old key is copied into the previous-public-only JWKS field.

Back up the protected file securely, stage the same resulting file for every NexusID instance, drain traffic, and restart all instances from that version. Do not perform a rolling restart where old processes continue signing with A while new processes sign with B and each advertises different JWKS content. After restart, check `/.well-known/jwks.json` for both key IDs. Hub and other relying parties can then refresh their JWKS caches and accept tokens signed with either key. Continue serving the old public key until the deadline; do not retire it early.

After the expiry fence has elapsed, retire the previous public key:

```sh
npm run keys:rotate -- --file data/.jwt-signing-keys.json --retire
```

Drain and restart all NexusID instances again, then verify JWKS contains only the new active key. Relying parties retain cached old public keys until their cache expires or they refresh; NexusID cannot revoke a public key from remote caches. Keep the new active private key and the prior protected backup according to the organization’s secret-retention policy. If rollback is needed before any B-signed token is issued, run `keys:restore --force` with the prior protected backup and restart. After B-signed tokens exist, do not roll back to A-only; retain B as active and preserve both public keys until all B/A deployment transitions are resolved.

Unit tests exercise staging, public-only overlap, active signing identity, retirement deadlines, permission checks, and one-predecessor policy. `node --import tsx --test tests/unit/signing-key-rotation-cli.test.ts` additionally invokes the documented backup and rotate CLI commands as child processes against a disposable protected key file; it verifies mode `0600`, no-overwrite behavior, active/previous public JWKS shape, private-key-free command output, and denial of early retirement without changing the key file. The NexusHub process acceptance exercises the service restarts and relying-party refresh path. NexusID does not currently automate fleet-wide rollout, key backup custody, or cache invalidation at external relying parties.
