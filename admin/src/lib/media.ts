/** Resolve image sources for display (absolute URLs as-is, relative paths unchanged). */
export function resolveMediaSrc(url?: string | null): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed;
  }

  return `/${trimmed.replace(/^\/+/, '')}`;
}

/** Use on update requests to clear stored images (empty input → null). */
export function imageFieldForUpdate(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Use on create requests (omit empty values). */
export function imageFieldForCreate(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function iconFieldForUpdate(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function iconFieldForCreate(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
