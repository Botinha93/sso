import { ValidationError } from "../core/errors.js";
import type { InstanceSettings } from "../domain/models.js";
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

  private defaultSettings(): InstanceSettings {
    const configuredCors = parseCorsOrigins(process.env.CORS_ORIGIN);

    return {
      id: "instance",
      requireHttps: process.env.NODE_ENV === "production",
      secureCookies: process.env.NODE_ENV === "production",
      allowAnyCorsOrigin: configuredCors.length === 0,
      corsAllowedOrigins: configuredCors,
      requireHttpsRedirectUris: process.env.NODE_ENV === "production",
      requireS256Pkce: true,
      allowImplicitFlow: true,
      emailTransport: (process.env.EMAIL_TRANSPORT as "disabled" | "log" | "smtp" | undefined) ?? this.resolveDefaultEmailTransport(),
      emailFrom: process.env.EMAIL_FROM ?? "no-reply@example.local",
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
      smtpSecure: process.env.SMTP_SECURE === "true",
      smtpUser: process.env.SMTP_USER,
      smtpPass: process.env.SMTP_PASS,
      tokenSigningAlgorithm: "RS256",
      updatedAt: new Date()
    };
  }

  ensureDefaults() {
    const existing = this.repository.get();
    if (existing) {
      return existing;
    }

    const defaults = this.defaultSettings();
    return this.repository.upsert({ ...defaults, id: defaults.id });
  }

  getSettings() {
    return this.repository.get() ?? this.ensureDefaults();
  }

  updateSettings(input: Partial<Pick<InstanceSettings, "requireHttps" | "secureCookies" | "allowAnyCorsOrigin" | "corsAllowedOrigins" | "requireHttpsRedirectUris" | "requireS256Pkce" | "allowImplicitFlow" | "emailTransport" | "emailFrom" | "smtpHost" | "smtpPort" | "smtpSecure" | "smtpUser" | "smtpPass">>) {
    const current = this.getSettings();

    const next: Omit<InstanceSettings, "updatedAt"> = {
      ...current,
      requireHttps: input.requireHttps ?? current.requireHttps,
      secureCookies: input.secureCookies ?? current.secureCookies,
      allowAnyCorsOrigin: input.allowAnyCorsOrigin ?? current.allowAnyCorsOrigin,
      corsAllowedOrigins: input.corsAllowedOrigins ?? current.corsAllowedOrigins,
      requireHttpsRedirectUris: input.requireHttpsRedirectUris ?? current.requireHttpsRedirectUris,
      requireS256Pkce: input.requireS256Pkce ?? current.requireS256Pkce,
      allowImplicitFlow: input.allowImplicitFlow ?? current.allowImplicitFlow,
      emailTransport: input.emailTransport ?? current.emailTransport,
      emailFrom: input.emailFrom ?? current.emailFrom,
      smtpHost: input.smtpHost ?? current.smtpHost,
      smtpPort: input.smtpPort ?? current.smtpPort,
      smtpSecure: input.smtpSecure ?? current.smtpSecure,
      smtpUser: input.smtpUser ?? current.smtpUser,
      smtpPass: input.smtpPass ?? current.smtpPass,
      tokenSigningAlgorithm: "RS256"
    };

    if (!next.allowAnyCorsOrigin && next.corsAllowedOrigins.length === 0) {
      throw new ValidationError("Provide at least one allowed CORS origin or enable allow-any-origin");
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

  isCorsOriginAllowed(origin: string | undefined) {
    if (!origin) {
      return true;
    }

    const settings = this.getSettings();
    if (settings.allowAnyCorsOrigin) {
      return true;
    }

    return settings.corsAllowedOrigins.includes(origin);
  }

  shouldRequireHttps() {
    return this.getSettings().requireHttps;
  }

  shouldUseSecureCookies() {
    return this.getSettings().secureCookies;
  }

  validateRedirectUris(redirectUris: string[]) {
    const settings = this.getSettings();
    if (!settings.requireHttpsRedirectUris) {
      return;
    }

    const invalid = redirectUris.find((uri) => !isSecureRedirectUri(uri));
    if (invalid) {
      throw new ValidationError(`Redirect URI must use HTTPS unless it targets localhost: ${invalid}`);
    }
  }

  assertAuthorizeRequest(input: { responseType: "code" | "token"; codeChallengeMethod?: "S256" | "plain" }) {
    const settings = this.getSettings();

    if (!settings.allowImplicitFlow && input.responseType === "token") {
      throw new ValidationError("Implicit flow is disabled by instance settings");
    }

    if (settings.requireS256Pkce && input.codeChallengeMethod === "plain") {
      throw new ValidationError("Plain PKCE is disabled by instance settings; use S256");
    }
  }
}