const SQLI_PATTERNS: RegExp[] = [
  /\bunion\s+select\b/i,
  /\b(select|insert|update|delete|drop|alter|truncate|exec|execute)\b\s+[^\n\r]{0,120}\b(from|into|table|set)\b/i,
  /(?:'|")\s*(?:or|and)\s+(?:'|"|\d)/i,
  /\b(?:or|and)\b\s+\d+\s*=\s*\d+/i,
  /(?:--|\/\*|\*\/|#)\s*(?:or|and|union|select|insert|update|delete|drop)\b/i,
  /\binformation_schema\b/i,
  /\bxp_cmdshell\b/i
];

const MAX_SCAN_DEPTH = 6;

function containsSuspiciousSqlPattern(value: string) {
  const normalized = value.trim();
  if (normalized.length < 4) {
    return false;
  }

  return SQLI_PATTERNS.some((pattern) => pattern.test(normalized));
}

function scanValue(value: unknown, depth: number): boolean {
  if (depth > MAX_SCAN_DEPTH) {
    return false;
  }

  if (typeof value === "string") {
    return containsSuspiciousSqlPattern(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => scanValue(item, depth + 1));
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => scanValue(item, depth + 1));
  }

  return false;
}

export function hasSqlInjectionPayload(input: {
  body: unknown;
  query: unknown;
  params: unknown;
  headers: unknown;
}) {
  return (
    scanValue(input.body, 0) ||
    scanValue(input.query, 0) ||
    scanValue(input.params, 0) ||
    scanValue(input.headers, 0)
  );
}
