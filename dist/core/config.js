const required = (name, fallback) => {
    const value = process.env[name] ?? fallback;
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
};
const asNumber = (name, fallback) => {
    const raw = process.env[name];
    return raw ? Number(raw) : fallback;
};
const asBoolean = (name, fallback) => {
    const raw = process.env[name];
    if (raw === undefined) {
        return fallback;
    }
    const normalized = raw.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
        return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
        return false;
    }
    throw new Error(`Invalid boolean environment variable: ${name}`);
};
const asHost = () => {
    const raw = process.env.HOST;
    if (!raw) {
        return "0.0.0.0";
    }
    const normalized = raw.trim();
    return normalized.length > 0 ? normalized : "0.0.0.0";
};
const resolveCookieSecret = () => {
    const configured = process.env.COOKIE_SECRET?.trim();
    if (configured) {
        return configured;
    }
    if (process.env.NODE_ENV === "production") {
        throw new Error("Missing required environment variable: COOKIE_SECRET");
    }
    return "northstar-sso-cookie-secret";
};
const asFederationProviders = () => {
    const raw = process.env.FEDERATION_PROVIDERS_JSON;
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        return parsed.filter((provider) => Boolean(provider.id &&
            provider.label &&
            provider.authorizationEndpoint &&
            provider.tokenEndpoint &&
            provider.userInfoEndpoint &&
            provider.clientId &&
            provider.clientSecret)).map((provider) => ({
            ...provider,
            scopes: provider.scopes?.length ? provider.scopes : ["openid", "profile", "email"]
        }));
    }
    catch {
        throw new Error("FEDERATION_PROVIDERS_JSON must be valid JSON array");
    }
};
export const loadConfig = () => ({
    port: asNumber("PORT", 4000),
    host: asHost(),
    trustProxy: asBoolean("TRUST_PROXY", false),
    cookieSecret: resolveCookieSecret(),
    databaseProvider: (() => {
        const raw = (process.env.DATABASE_PROVIDER ?? "sqlite").toLowerCase();
        if (raw === "sqlite" || raw === "postgresql" || raw === "mysql") {
            return raw;
        }
        throw new Error("DATABASE_PROVIDER must be one of: sqlite, postgresql, mysql");
    })(),
    databasePath: process.env.DATABASE_PATH ?? "./data/sso.sqlite",
    externalDatabaseUrl: process.env.DATABASE_URL,
    issuer: required("ISSUER", "http://localhost:4000"),
    ttl: {
        accessTokenSeconds: asNumber("JWT_ACCESS_TTL_SECONDS", 900),
        idTokenSeconds: asNumber("JWT_ID_TTL_SECONDS", 900),
        refreshTokenSeconds: asNumber("JWT_REFRESH_TTL_SECONDS", 60 * 60 * 24 * 30)
    },
    admin: {
        email: required("ADMIN_EMAIL", "admin@example.com"),
        password: required("ADMIN_PASSWORD", "change-me-now")
    },
    federation: {
        providers: asFederationProviders()
    }
});
export const config = loadConfig();
