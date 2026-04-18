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
export const config = {
    port: asNumber("PORT", 4000),
    host: process.env.HOST ?? "127.0.0.1",
    databasePath: process.env.DATABASE_PATH ?? "./data/sso.sqlite",
    issuer: required("ISSUER", "http://localhost:4000"),
    ttl: {
        accessTokenSeconds: asNumber("JWT_ACCESS_TTL_SECONDS", 900),
        idTokenSeconds: asNumber("JWT_ID_TTL_SECONDS", 900),
        refreshTokenSeconds: asNumber("JWT_REFRESH_TTL_SECONDS", 60 * 60 * 24 * 30)
    },
    admin: {
        email: required("ADMIN_EMAIL", "admin@example.com"),
        password: required("ADMIN_PASSWORD", "change-me-now")
    }
};
