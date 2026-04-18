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
export const config = {
    port: asNumber("PORT", 4000),
    host: process.env.HOST ?? "127.0.0.1",
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
};
