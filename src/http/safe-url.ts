import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ValidationError } from "../core/errors.js";

/**
 * Accepts only same-origin, path-absolute redirect targets ("/foo?bar").
 * Rejects protocol-relative ("//evil"), backslash tricks ("/\evil") and
 * anything a browser could interpret as a different origin.
 */
export const isSafeLocalRedirect = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    return false;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return false;
  }
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(value) || value.includes("\\")) {
    return false;
  }
  try {
    const parsed = new URL(value, "http://localhost.invalid");
    return parsed.origin === "http://localhost.invalid" && parsed.pathname.startsWith("/");
  } catch {
    return false;
  }
};

export const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const PRIVATE_V4_RANGES: Array<[number, number]> = [
  [0x00000000, 0xff000000], // 0.0.0.0/8
  [0x0a000000, 0xff000000], // 10.0.0.0/8
  [0x7f000000, 0xff000000], // 127.0.0.0/8
  [0x64400000, 0xffc00000], // 100.64.0.0/10 (carrier NAT)
  [0xa9fe0000, 0xffff0000], // 169.254.0.0/16 (link-local / cloud metadata)
  [0xac100000, 0xfff00000], // 172.16.0.0/12
  [0xc0a80000, 0xffff0000], // 192.168.0.0/16
  [0xc0000000, 0xffffff00], // 192.0.0.0/24
  [0xe0000000, 0xf0000000], // 224.0.0.0/4 multicast
  [0xf0000000, 0xf0000000]  // 240.0.0.0/4 reserved + broadcast
];

const ipv4ToInt = (address: string) => {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return undefined;
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
};

export const isPrivateOrLocalAddress = (address: string): boolean => {
  const family = isIP(address);
  if (family === 4) {
    const value = ipv4ToInt(address);
    if (value === undefined) {
      return true;
    }
    return PRIVATE_V4_RANGES.some(([network, mask]) => ((value & mask) >>> 0) === network);
  }

  if (family === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::" || normalized === "::1") {
      return true;
    }
    // IPv4-mapped addresses (::ffff:a.b.c.d)
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) {
      return isPrivateOrLocalAddress(mapped[1]);
    }
    return normalized.startsWith("fc") || normalized.startsWith("fd") // fc00::/7 unique local
      || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") // fe80::/10 link-local
      || normalized.startsWith("ff"); // multicast
  }

  return true;
};

const LOCAL_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "metadata", "metadata.google.internal", "instance-data"]);

export const allowPrivateOutboundTargets = () =>
  process.env.NODE_ENV === "test" || process.env.ALLOW_PRIVATE_OUTBOUND_TARGETS === "true";

/**
 * Validates a URL the server will connect to on behalf of an operator or
 * client (webhooks, federation endpoints, CIBA notification endpoints).
 * Blocks non-HTTP schemes and private/loopback/link-local destinations so
 * the identity provider cannot be turned into an SSRF proxy.
 */
export const assertSafeOutboundUrl = async (
  raw: string,
  options: { label?: string; requireHttps?: boolean; allowPrivate?: boolean } = {}
) => {
  const label = options.label ?? "URL";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ValidationError(`${label} must be a valid absolute URL`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ValidationError(`${label} must use http or https`);
  }
  if (options.requireHttps && parsed.protocol !== "https:") {
    throw new ValidationError(`${label} must use https`);
  }
  if (parsed.username || parsed.password) {
    throw new ValidationError(`${label} must not embed credentials`);
  }

  const allowPrivate = options.allowPrivate ?? allowPrivateOutboundTargets();
  if (allowPrivate) {
    return parsed;
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".internal") || hostname.endsWith(".local")) {
    throw new ValidationError(`${label} must not target a local or internal host`);
  }

  if (isIP(hostname)) {
    if (isPrivateOrLocalAddress(hostname)) {
      throw new ValidationError(`${label} must not target a private or reserved address`);
    }
    return parsed;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    // An unresolvable host cannot reach anything; the connection attempt itself
    // will fail. Failing closed here would only break legitimately configured
    // hosts during a DNS outage.
    return parsed;
  }

  if (addresses.some((entry) => isPrivateOrLocalAddress(entry.address))) {
    throw new ValidationError(`${label} must not resolve to a private or reserved address`);
  }

  return parsed;
};

const ALLOWED_DATABASE_URL_PARAMS = new Set([
  "sslmode", "ssl", "schema", "connection_limit", "connect_timeout", "pool_timeout",
  "application_name", "sslaccept", "charset", "timezone", "socket_timeout", "pgbouncer"
]);

/**
 * External database URLs are supplied by operators through the setup and
 * administration screens. Driver options that read local files or enable
 * server-initiated file transfer (LOAD DATA LOCAL INFILE, sslcert/sslkey
 * paths, unix sockets) are rejected.
 */
export const assertSafeDatabaseUrl = (raw: string, provider: "postgresql" | "mysql") => {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ValidationError("External database URL must be a valid URL");
  }

  const allowedProtocols = provider === "postgresql"
    ? new Set(["postgres:", "postgresql:"])
    : new Set(["mysql:"]);
  if (!allowedProtocols.has(parsed.protocol)) {
    throw new ValidationError(`External database URL scheme does not match provider ${provider}`);
  }

  if (!parsed.hostname) {
    throw new ValidationError("External database URL must include a host");
  }

  for (const key of parsed.searchParams.keys()) {
    if (!ALLOWED_DATABASE_URL_PARAMS.has(key.toLowerCase())) {
      throw new ValidationError(`Unsupported database URL option: ${key}`);
    }
  }

  return parsed;
};
