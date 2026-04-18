import { createHash, randomBytes } from "node:crypto";
import { nanoid } from "nanoid";
import { AuthenticationError, ValidationError } from "../core/errors.js";
import type { AppConfig, FederationProviderConfig } from "../core/config.js";
import { hashPassword } from "../security/password.js";
import { AuthenticationFlowService } from "./authentication-flow-service.js";
import type {
  FederationProviderRepository,
  FederatedIdentityRepository,
  FederationTransactionRepository,
  UserRepository
} from "../repositories/contracts.js";

const asBase64Url = (buffer: Buffer): string => buffer.toString("base64url");

const normalizeEmail = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class FederationService {
  constructor(
    private readonly appConfig: AppConfig,
    private readonly userRepository: UserRepository,
    private readonly federationProviderRepository: FederationProviderRepository,
    private readonly federatedIdentityRepository: FederatedIdentityRepository,
    private readonly federationTransactionRepository: FederationTransactionRepository,
    private readonly authenticationFlowService: AuthenticationFlowService
  ) {}

  listProviders() {
    return this.getEffectiveProviders().filter((provider) => provider.enabled).map((provider) => ({
      id: provider.id,
      label: provider.label
    }));
  }

  listConfiguredProviders() {
    const envProviders = this.appConfig.federation.providers;
    const dbProviders = this.federationProviderRepository.list();
    const envIds = new Set(envProviders.map((provider) => provider.id));

    const fromEnv = envProviders.map((provider) => ({
      ...provider,
      enabled: true,
      source: "env" as const,
      hasSecret: Boolean(provider.clientSecret),
      secretPreview: provider.clientSecret ? `${provider.clientSecret.slice(0, 4)}...${provider.clientSecret.slice(-4)}` : ""
    }));

    const fromDb = dbProviders
      .filter((provider) => !envIds.has(provider.id))
      .map((provider) => ({
        ...provider,
        source: "db" as const,
        hasSecret: Boolean(provider.clientSecret),
        secretPreview: provider.clientSecret ? `${provider.clientSecret.slice(0, 4)}...${provider.clientSecret.slice(-4)}` : ""
      }));

    return [...fromEnv, ...fromDb];
  }

  createProvider(input: {
    id: string;
    label: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    userInfoEndpoint: string;
    clientId: string;
    clientSecret: string;
    scopes: string[];
    enabled: boolean;
  }) {
    if (this.appConfig.federation.providers.some((provider) => provider.id === input.id)) {
      throw new ValidationError("Provider id is reserved by environment configuration");
    }

    if (this.federationProviderRepository.findById(input.id)) {
      throw new ValidationError("Provider id already exists");
    }

    return this.federationProviderRepository.create(input);
  }

  updateProvider(id: string, input: {
    label?: string;
    authorizationEndpoint?: string;
    tokenEndpoint?: string;
    userInfoEndpoint?: string;
    clientId?: string;
    clientSecret?: string;
    scopes?: string[];
    enabled?: boolean;
  }) {
    if (this.appConfig.federation.providers.some((provider) => provider.id === id)) {
      throw new ValidationError("Environment providers are read-only");
    }

    const existing = this.federationProviderRepository.findById(id);
    if (!existing) {
      throw new ValidationError("Federation provider not found");
    }

    const updated = this.federationProviderRepository.update(id, {
      label: input.label,
      authorizationEndpoint: input.authorizationEndpoint,
      tokenEndpoint: input.tokenEndpoint,
      userInfoEndpoint: input.userInfoEndpoint,
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      scopes: input.scopes,
      enabled: input.enabled
    });

    if (!updated) {
      throw new ValidationError("Failed to update federation provider");
    }

    return updated;
  }

  deleteProvider(id: string) {
    if (this.appConfig.federation.providers.some((provider) => provider.id === id)) {
      throw new ValidationError("Environment providers are read-only");
    }

    this.federationProviderRepository.delete(id);
  }

  getAuthorizationRedirect(providerId: string, redirectAfterLogin: string) {
    this.authenticationFlowService.assertStageEnabled("federation");

    const provider = this.requireProvider(providerId);
    this.federationTransactionRepository.purgeExpired(new Date());

    const state = nanoid(48);
    const codeVerifier = asBase64Url(randomBytes(48));
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

    const callbackUri = `${this.appConfig.issuer}/auth/federation/${provider.id}/callback`;

    this.federationTransactionRepository.create({
      state,
      providerId: provider.id,
      codeVerifier,
      redirectAfterLogin,
      expiresAt: new Date(Date.now() + 1000 * 60 * 10)
    });

    const authorizeUrl = new URL(provider.authorizationEndpoint);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", provider.clientId);
    authorizeUrl.searchParams.set("redirect_uri", callbackUri);
    authorizeUrl.searchParams.set("scope", provider.scopes.join(" "));
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");

    return authorizeUrl.toString();
  }

  async completeLogin(input: { providerId: string; code: string; state: string }) {
    const provider = this.requireProvider(input.providerId);
    const transaction = this.federationTransactionRepository.consume(input.state);

    if (!transaction || transaction.providerId !== provider.id) {
      throw new AuthenticationError("Invalid federation transaction state");
    }

    if (transaction.expiresAt.getTime() < Date.now()) {
      throw new AuthenticationError("Federation transaction expired");
    }

    const callbackUri = `${this.appConfig.issuer}/auth/federation/${provider.id}/callback`;

    const tokenResponse = await fetch(provider.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        redirect_uri: callbackUri,
        code_verifier: transaction.codeVerifier
      })
    });

    if (!tokenResponse.ok) {
      throw new AuthenticationError("Failed to exchange federation authorization code");
    }

    const tokenJson = await tokenResponse.json() as { access_token?: string };
    const accessToken = tokenJson.access_token;

    if (!accessToken) {
      throw new AuthenticationError("Federation token response missing access_token");
    }

    const userInfoResponse = await fetch(provider.userInfoEndpoint, {
      headers: { authorization: `Bearer ${accessToken}` }
    });

    if (!userInfoResponse.ok) {
      throw new AuthenticationError("Failed to fetch user info from identity provider");
    }

    const userInfo = await userInfoResponse.json() as Record<string, unknown>;
    const subject = typeof userInfo.sub === "string" ? userInfo.sub : undefined;
    const email = normalizeEmail(userInfo.email);

    if (!subject) {
      throw new ValidationError("Federation user profile missing subject identifier");
    }

    const existingIdentity = this.federatedIdentityRepository.findByProviderSubject(provider.id, subject);

    if (existingIdentity) {
      const existingUser = this.userRepository.findById(existingIdentity.userId);
      if (!existingUser) {
        throw new AuthenticationError("Linked user not found for federated identity");
      }
      this.federatedIdentityRepository.touchLogin(existingIdentity.id, new Date());
      return {
        user: existingUser,
        redirectAfterLogin: transaction.redirectAfterLogin
      };
    }

    let user = email ? this.userRepository.findByEmail(email) : undefined;

    if (!user) {
      const baseUsername = (email?.split("@")[0] ?? `federated_${provider.id}`).replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 24);
      const preferredUsername = typeof userInfo.preferred_username === "string" ? userInfo.preferred_username : undefined;
      const nameSeed = preferredUsername ?? baseUsername ?? "federated_user";
      const username = `${nameSeed.slice(0, 24)}_${nanoid(6)}`;
      const givenName = typeof userInfo.given_name === "string" ? userInfo.given_name : "Federated";
      const familyName = typeof userInfo.family_name === "string" ? userInfo.family_name : "User";

      user = this.userRepository.create({
        email: email ?? `${username}@federated.local`,
        username,
        passwordHash: hashPassword(asBase64Url(randomBytes(32))),
        givenName,
        familyName,
        customAttributes: {},
        active: true
      });
    }

    this.federatedIdentityRepository.create({
      providerId: provider.id,
      providerSubject: subject,
      userId: user.id,
      email
    });

    return {
      user,
      redirectAfterLogin: transaction.redirectAfterLogin
    };
  }

  private requireProvider(providerId: string): FederationProviderConfig {
    const provider = this.getEffectiveProviders().find((item) => item.id === providerId && item.enabled);
    if (!provider) {
      throw new ValidationError("Unknown federation provider");
    }
    return provider;
  }

  private getEffectiveProviders(): Array<FederationProviderConfig & { enabled: boolean }> {
    const envProviders = this.appConfig.federation.providers.map((provider) => ({ ...provider, enabled: true }));
    const dbProviders = this.federationProviderRepository.list();
    const envIds = new Set(envProviders.map((provider) => provider.id));

    const dbMapped = dbProviders
      .filter((provider) => !envIds.has(provider.id))
      .map((provider) => ({
        id: provider.id,
        label: provider.label,
        authorizationEndpoint: provider.authorizationEndpoint,
        tokenEndpoint: provider.tokenEndpoint,
        userInfoEndpoint: provider.userInfoEndpoint,
        clientId: provider.clientId,
        clientSecret: provider.clientSecret,
        scopes: provider.scopes,
        enabled: provider.enabled
      }));

    return [...envProviders, ...dbMapped];
  }
}
