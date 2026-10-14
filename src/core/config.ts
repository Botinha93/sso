import { randomBytes } from "node:crypto";
import { applyRuntimeDatabaseConfig } from "./runtime-database-config.js";

const required = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const asNumber = (name: string, fallback: number): number => {
  const raw = process.env[name];
  return raw ? Number(raw) : fallback;
};

/**
 * TRUST_PROXY accepts the same shapes Fastify does: a boolean, a hop count
 * (e.g. "2" when Cloudflare and nginx both sit in front of the app), or a
 * comma-separated list of proxy addresses/CIDRs. A bare "true" trusts the
 * left-most X-Forwarded-For entry, which a client can spoof, so a hop count
 * or address list is recommended for production.
 */
const asTrustProxy = (): boolean | number | string | string[] => {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw) {
    return false;
  }

  const normalized = raw.toLowerCase();
  if (["true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "off"].includes(normalized)) {
    return false;
  }
  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  const entries = raw.split(",").map((value) => value.trim()).filter(Boolean);
  return entries.length === 1 ? entries[0] : entries;
};

const asHost = (): string => {
  const raw = process.env.HOST;
  if (!raw) {
    return "0.0.0.0";
  }

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : "0.0.0.0";
};

const resolveCookieSecret = (): string => {
  const configured = process.env.COOKIE_SECRET?.trim();
  if (configured) {
    if (process.env.NODE_ENV === "production" && configured.length < 32) {
      throw new Error("COOKIE_SECRET must be at least 32 characters in production (generate with: openssl rand -hex 32)");
    }
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing required environment variable: COOKIE_SECRET");
  }

  // Session cookies are signed with this secret. Outside production a random
  // per-process value is used instead of a well-known constant, so a
  // deployment that forgot NODE_ENV=production does not ship a guessable key.
  // Sessions are invalidated on restart in that mode.
  if (!process.env.__GENERATED_COOKIE_SECRET) {
    process.env.__GENERATED_COOKIE_SECRET = randomBytes(32).toString("hex");
    if (process.env.NODE_ENV !== "test") {
      console.warn("[config] COOKIE_SECRET is not set; using a random per-process secret. Set COOKIE_SECRET for stable sessions.");
    }
  }
  return process.env.__GENERATED_COOKIE_SECRET;
};

export interface FederationProviderConfig {
  id: string;
  label: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
}

const asFederationProviders = (): FederationProviderConfig[] => {
  const raw = process.env.FEDERATION_PROVIDERS_JSON;
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as FederationProviderConfig[];
    return parsed.filter((provider) =>
      Boolean(
        provider.id &&
          provider.label &&
          provider.authorizationEndpoint &&
          provider.tokenEndpoint &&
          provider.userInfoEndpoint &&
          provider.clientId &&
          provider.clientSecret
      )
    ).map((provider) => ({
      ...provider,
      scopes: provider.scopes?.length ? provider.scopes : ["openid", "profile", "email"]
    }));
  } catch {
    throw new Error("FEDERATION_PROVIDERS_JSON must be valid JSON array");
  }
};

export interface AppConfig {
  port: number;
  host: string;
  trustProxy: boolean | number | string | string[];
  cookieSecret: string;
  databaseProvider: "sqlite" | "postgresql" | "mysql";
  databasePath: string;
  externalDatabaseUrl?: string;
  issuer: string;
  admin: {
    email: string;
    password: string;
  };
  federation: {
    providers: FederationProviderConfig[];
  };
}

export const loadConfig = (): AppConfig => applyRuntimeDatabaseConfig({
  port: asNumber("PORT", 4000),
  host: asHost(),
  trustProxy: asTrustProxy(),
  cookieSecret: resolveCookieSecret(),
  databaseProvider: "sqlite",
  databasePath: process.env.DATABASE_PATH ?? "./data/sso.sqlite",
  externalDatabaseUrl: undefined,
  // A trailing slash would make discovery advertise "//oauth/..." endpoints
  // and produce an `iss` value strict clients reject.
  issuer: required("ISSUER", "http://localhost:4000").replace(/\/+$/, ""),
  admin: {
    email: required("ADMIN_EMAIL", "admin@example.com"),
    password: required("ADMIN_PASSWORD", "change-me-now")
  },
  federation: {
    providers: asFederationProviders()
  }
});

export const config: AppConfig = loadConfig();
