import { ValidationError } from "../core/errors.js";

export const PASSWORD_CHANGED_AT_ATTRIBUTE_KEY = "password_changed_at";

export function normalizeUserAttributeKey(key: string) {
  const normalized = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  if (!normalized || normalized.length < 2) {
    throw new ValidationError("Attribute key must be at least 2 characters");
  }
  return normalized;
}

export function isSystemManagedUserAttributeKey(key: string) {
  try {
    return normalizeUserAttributeKey(key) === PASSWORD_CHANGED_AT_ATTRIBUTE_KEY;
  } catch {
    return false;
  }
}

export function omitSystemManagedCustomAttributes(customAttributes: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(customAttributes).filter(([key]) => !isSystemManagedUserAttributeKey(key))
  );
}

export function normalizeCustomAttributeMap(
  customAttributes: Record<string, string> | undefined,
  options?: { omitEmptyValues?: boolean }
) {
  if (!customAttributes) {
    return {} as Record<string, string>;
  }

  const omitEmptyValues = options?.omitEmptyValues ?? false;
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(customAttributes)) {
    const canonicalKey = normalizeUserAttributeKey(key);
    const nextValue = omitEmptyValues ? value.trim() : value;
    if (omitEmptyValues && nextValue.length === 0) {
      continue;
    }
    normalized[canonicalKey] = nextValue;
  }

  return normalized;
}
