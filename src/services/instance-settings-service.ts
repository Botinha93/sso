import { ValidationError } from "../core/errors.js";
import type { InstanceSettings, UiCustomizationSettings, UiSurface, UiSurfaceCustomization } from "../domain/models.js";
import type { InstanceSettingsRepository } from "../repositories/contracts.js";

const parseCorsOrigins = (raw: string | undefined): string[] => {
  if (!raw || raw.trim().length === 0) {
    return [];
  }

  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const isSecureRedirectUri = (value: string) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol === "https:") {
    return true;
  }

  return parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
};

export class InstanceSettingsService {
  constructor(private readonly repository: InstanceSettingsRepository) {}

  private resolveDefaultEmailTransport() {
    return process.env.NODE_ENV === "production" ? "disabled" : "log";
  }

  private defaultUiCustomizations(): UiCustomizationSettings {
    return {
      defaultBySurface: {
        admin_login: {
          title: "NexusID",
          subtitle: "Sign in to the identity administration workspace."
        },
        consent: {
          title: "Authorization Request",
          subtitle: "Review requested permissions before approving access."
        },
        portal_login: {
          title: "Account Portal",
          subtitle: "Sign in to access your account"
        },
        portal_launcher: {
          title: "Account Portal",
          subtitle: "Launch your assigned applications"
        }
      },
      byClientId: {},
      byAppId: {}
    };
  }

  private normalizeUiCustomizations(input: unknown): UiCustomizationSettings {
    const defaults = this.defaultUiCustomizations();
    if (!input || typeof input !== "object") {
      return defaults;
    }

    const data = input as Partial<UiCustomizationSettings>;

    const normalizeSurfaceMap = (value: unknown): Partial<Record<UiSurface, UiSurfaceCustomization>> => {
      if (!value || typeof value !== "object") {
        return {};
      }

      const source = value as Record<string, unknown>;
      const result: Partial<Record<UiSurface, UiSurfaceCustomization>> = {};
      const surfaces: UiSurface[] = ["admin_login", "consent", "portal_login", "portal_launcher"];

      for (const surface of surfaces) {
        const entry = source[surface];
        if (!entry || typeof entry !== "object") continue;
        const raw = entry as Record<string, unknown>;
        result[surface] = {
          title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : undefined,
          subtitle: typeof raw.subtitle === "string" && raw.subtitle.trim() ? raw.subtitle.trim() : undefined,
          logoUrl: typeof raw.logoUrl === "string" && raw.logoUrl.trim() ? raw.logoUrl.trim() : undefined,
          primaryColor: typeof raw.primaryColor === "string" && raw.primaryColor.trim() ? raw.primaryColor.trim() : undefined,
          accentColor: typeof raw.accentColor === "string" && raw.accentColor.trim() ? raw.accentColor.trim() : undefined,
          backgroundCss: typeof raw.backgroundCss === "string" && raw.backgroundCss.trim() ? raw.backgroundCss.trim() : undefined
        };
      }

      return result;
    };

    const normalizeScoped = (value: unknown): Record<string, Partial<Record<UiSurface, UiSurfaceCustomization>>> => {
      if (!value || typeof value !== "object") return {};
      const source = value as Record<string, unknown>;
      const mapped: Record<string, Partial<Record<UiSurface, UiSurfaceCustomization>>> = {};
      for (const [key, val] of Object.entries(source)) {
        if (!key.trim()) continue;
        mapped[key] = normalizeSurfaceMap(val);
      }
      return mapped;
    };

    return {
      defaultBySurface: {
        ...defaults.defaultBySurface,
        ...normalizeSurfaceMap(data.defaultBySurface)
      },
      byClientId: normalizeScoped(data.byClientId),
      byAppId: normalizeScoped(data.byAppId)
    };
  }

  private defaultSettings(): InstanceSettings {
    const configuredCors = parseCorsOrigins(process.env.CORS_ORIGIN);

    return {
      id: "instance",
      databaseProvider: (process.env.DATABASE_PROVIDER as "sqlite" | "postgresql" | "mysql" | undefined) ?? "sqlite",
      databasePath: process.env.DATABASE_PATH ?? "./data/sso.sqlite",
      externalDatabaseUrl: process.env.DATABASE_URL,
      requireHttps: false,
      secureCookies: false,
      allowAnyCorsOrigin: configuredCors.length === 0,
      corsAllowedOrigins: configuredCors,
      requireHttpsRedirectUris: false,
      requireS256Pkce: true,
      allowImplicitFlow: true,
      loginFailureWindowMs: process.env.LOGIN_FAILURE_WINDOW_MS ? Number(process.env.LOGIN_FAILURE_WINDOW_MS) : 15 * 60 * 1000,
      loginLockoutThreshold: process.env.LOGIN_LOCKOUT_THRESHOLD ? Number(process.env.LOGIN_LOCKOUT_THRESHOLD) : 5,
      loginLockoutDurationMs: process.env.LOGIN_LOCKOUT_MS ? Number(process.env.LOGIN_LOCKOUT_MS) : 15 * 60 * 1000,
      sessionAnomalyConcurrencyThreshold: process.env.SESSION_ANOMALY_CONCURRENCY_THRESHOLD ? Number(process.env.SESSION_ANOMALY_CONCURRENCY_THRESHOLD) : 5,
      emailTransport: (process.env.EMAIL_TRANSPORT as "disabled" | "log" | "smtp" | undefined) ?? this.resolveDefaultEmailTransport(),
      emailFrom: process.env.EMAIL_FROM ?? "no-reply@example.local",
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
      smtpSecure: process.env.SMTP_SECURE === "true",
      smtpUser: process.env.SMTP_USER,
      smtpPass: process.env.SMTP_PASS,
      uiCustomizations: this.defaultUiCustomizations(),
      tokenSigningAlgorithm: "RS256",
      updatedAt: new Date()
    };
  }

  async ensureDefaults() {
    const existing = await this.repository.get();
    if (existing) {
      return existing;
    }

    const defaults = this.defaultSettings();
    return this.repository.upsert({ ...defaults, id: defaults.id });
  }

  async getSettings() {
    const existing = await this.repository.get();
    if (!existing) {
      return this.ensureDefaults();
    }

    return {
      ...existing,
      uiCustomizations: this.normalizeUiCustomizations(existing.uiCustomizations)
    };
  }

  async updateSettings(input: Partial<Pick<InstanceSettings, "databaseProvider" | "databasePath" | "externalDatabaseUrl" | "requireHttps" | "secureCookies" | "allowAnyCorsOrigin" | "corsAllowedOrigins" | "requireHttpsRedirectUris" | "requireS256Pkce" | "allowImplicitFlow" | "loginFailureWindowMs" | "loginLockoutThreshold" | "loginLockoutDurationMs" | "sessionAnomalyConcurrencyThreshold" | "emailTransport" | "emailFrom" | "smtpHost" | "smtpPort" | "smtpSecure" | "smtpUser" | "smtpPass" | "uiCustomizations">>) {
    const current = await this.getSettings();

    const next: Omit<InstanceSettings, "updatedAt"> = {
      ...current,
      databaseProvider: input.databaseProvider ?? current.databaseProvider,
      databasePath: input.databasePath ?? current.databasePath,
      externalDatabaseUrl: input.externalDatabaseUrl ?? current.externalDatabaseUrl,
      requireHttps: input.requireHttps ?? current.requireHttps,
      secureCookies: input.secureCookies ?? current.secureCookies,
      allowAnyCorsOrigin: input.allowAnyCorsOrigin ?? current.allowAnyCorsOrigin,
      corsAllowedOrigins: input.corsAllowedOrigins ?? current.corsAllowedOrigins,
      requireHttpsRedirectUris: input.requireHttpsRedirectUris ?? current.requireHttpsRedirectUris,
      requireS256Pkce: input.requireS256Pkce ?? current.requireS256Pkce,
      allowImplicitFlow: input.allowImplicitFlow ?? current.allowImplicitFlow,
      loginFailureWindowMs: input.loginFailureWindowMs ?? current.loginFailureWindowMs,
      loginLockoutThreshold: input.loginLockoutThreshold ?? current.loginLockoutThreshold,
      loginLockoutDurationMs: input.loginLockoutDurationMs ?? current.loginLockoutDurationMs,
      sessionAnomalyConcurrencyThreshold: input.sessionAnomalyConcurrencyThreshold ?? current.sessionAnomalyConcurrencyThreshold,
      emailTransport: input.emailTransport ?? current.emailTransport,
      emailFrom: input.emailFrom ?? current.emailFrom,
      smtpHost: input.smtpHost ?? current.smtpHost,
      smtpPort: input.smtpPort ?? current.smtpPort,
      smtpSecure: input.smtpSecure ?? current.smtpSecure,
      smtpUser: input.smtpUser ?? current.smtpUser,
      smtpPass: input.smtpPass ?? current.smtpPass,
      uiCustomizations: input.uiCustomizations ? this.normalizeUiCustomizations(input.uiCustomizations) : current.uiCustomizations,
      tokenSigningAlgorithm: "RS256"
    };

    if (!next.allowAnyCorsOrigin && next.corsAllowedOrigins.length === 0) {
      throw new ValidationError("Provide at least one allowed CORS origin or enable allow-any-origin");
    }

    if (next.databaseProvider === "sqlite") {
      if (!next.databasePath || next.databasePath.trim().length === 0) {
        throw new ValidationError("Database path is required when database provider is sqlite");
      }
    } else if (!next.externalDatabaseUrl || next.externalDatabaseUrl.trim().length === 0) {
      throw new ValidationError("External database URL is required when using PostgreSQL or MySQL");
    }

    for (const origin of next.corsAllowedOrigins) {
      try {
        const parsed = new URL(origin);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error("unsupported");
        }
      } catch {
        throw new ValidationError(`Invalid CORS origin: ${origin}`);
      }
    }

    if (next.loginFailureWindowMs < 60_000) {
      throw new ValidationError("Login failure window must be at least 60 seconds");
    }

    if (next.loginLockoutThreshold < 1) {
      throw new ValidationError("Login lockout threshold must be at least 1 attempt");
    }

    if (next.loginLockoutDurationMs < 60_000) {
      throw new ValidationError("Login lockout duration must be at least 60 seconds");
    }

    if (next.sessionAnomalyConcurrencyThreshold < 1) {
      throw new ValidationError("Session anomaly concurrency threshold must be at least 1");
    }

    if (next.emailTransport === "smtp") {
      if (!next.emailFrom) {
        throw new ValidationError("Email from address is required when SMTP transport is enabled");
      }
      if (!next.smtpHost) {
        throw new ValidationError("SMTP host is required when SMTP transport is enabled");
      }
      if (!next.smtpPort || Number.isNaN(next.smtpPort)) {
        throw new ValidationError("SMTP port is required when SMTP transport is enabled");
      }
    }

    return this.repository.upsert(next);
  }

  async resolveUiCustomization(input: {
    surface: UiSurface;
    clientId?: string;
    appId?: string;
  }): Promise<UiSurfaceCustomization> {
    const settings = await this.getSettings();
    const defaults = settings.uiCustomizations.defaultBySurface[input.surface] ?? {};
    const byClient = input.clientId
      ? settings.uiCustomizations.byClientId[input.clientId]?.[input.surface] ?? {}
      : {};
    const byApp = input.appId
      ? settings.uiCustomizations.byAppId[input.appId]?.[input.surface] ?? {}
      : {};

    return {
      ...defaults,
      ...byClient,
      ...byApp
    };
  }

  async isCorsOriginAllowed(origin: string | undefined) {
    if (!origin) {
      return true;
    }

    const settings = await this.getSettings();
    if (settings.allowAnyCorsOrigin) {
      return true;
    }

    return settings.corsAllowedOrigins.includes(origin);
  }

  async shouldRequireHttps() {
    return (await this.getSettings()).requireHttps;
  }

  async shouldUseSecureCookies() {
    return (await this.getSettings()).secureCookies;
  }

  async validateRedirectUris(redirectUris: string[]) {
    const settings = await this.getSettings();
    if (!settings.requireHttpsRedirectUris) {
      return;
    }

    const invalid = redirectUris.find((uri) => !isSecureRedirectUri(uri));
    if (invalid) {
      throw new ValidationError(`Redirect URI must use HTTPS unless it targets localhost: ${invalid}`);
    }
  }

  async assertAuthorizeRequest(input: { responseType: "code" | "token" | "code token"; codeChallengeMethod?: "S256" | "plain" }) {
    const settings = await this.getSettings();

    const includesToken = input.responseType.split(" ").includes("token");
    if (!settings.allowImplicitFlow && includesToken) {
      throw new ValidationError("Implicit flow is disabled by instance settings");
    }

    if (settings.requireS256Pkce && input.codeChallengeMethod === "plain") {
      throw new ValidationError("Plain PKCE is disabled by instance settings; use S256");
    }
  }

  async getSecuritySettings() {
    const settings = await this.getSettings();
    return {
      loginFailureWindowMs: settings.loginFailureWindowMs,
      loginLockoutThreshold: settings.loginLockoutThreshold,
      loginLockoutDurationMs: settings.loginLockoutDurationMs,
      sessionAnomalyConcurrencyThreshold: settings.sessionAnomalyConcurrencyThreshold
    };
  }
}