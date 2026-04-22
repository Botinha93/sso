# Deprecation Policy

This policy defines how public SDK methods and types are deprecated and removed.

## Scope

Applies to all public exports from `sdk/src/index.ts`, including:

- runtime functions
- error classes
- interfaces and type aliases

## Deprecation Lifecycle

1. Announcement
   - Mark symbol as deprecated in docs and release notes.
   - Provide an explicit replacement path.
2. Compatibility window
   - Keep deprecated symbol available for at least one full minor release.
3. Removal
   - Remove only in a major release.

## Communication Requirements

Each deprecation must include:

- affected symbol name
- reason for deprecation
- replacement symbol or migration strategy
- earliest planned removal version

## Type-Level Guidance

- Preserve backward compatibility where possible with additive changes.
- Avoid changing semantics of existing types in-place.
- Prefer introducing new types and marking old ones deprecated.

## Runtime Behavior Guidance

- Avoid silent behavior changes on existing public methods.
- If runtime semantics must change, release under a major version.

## Emergency Exceptions

If security or correctness requires immediate removal:

- publish urgent release notes
- provide mitigation guidance
- publish replacement as quickly as possible
