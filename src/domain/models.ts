export type RoleScope = "platform" | "tenant";
export type GrantType = "authorization_code" | "client_credentials" | "refresh_token";

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  scope: RoleScope;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  givenName: string;
  familyName: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthClient {
  id: string;
  name: string;
  secret: string;
  redirectUris: string[];
  allowedScopes: string[];
  grants: GrantType[];
  requirePkce: boolean;
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  clientId: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
}

export interface AuthorizationCode {
  id: string;
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string[];
  codeChallenge?: string;
  codeChallengeMethod?: "S256";
  expiresAt: Date;
  createdAt: Date;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  createdAt: Date;
}

export interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  tenantId?: string;
  createdAt: Date;
}

export interface Consent {
  id: string;
  userId: string;
  clientId: string;
  scope: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshTokenRecord {
  id: string;
  tokenId: string;
  tokenHash: string;
  userId: string;
  clientId: string;
  sessionId: string;
  scope: string[];
  expiresAt: Date;
  createdAt: Date;
  consumedAt?: Date;
  revokedAt?: Date;
  rotatedFromTokenId?: string;
}

export interface AccessTokenRecord {
  id: string;
  tokenId: string;
  userId: string;
  clientId: string;
  sessionId: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt?: Date;
}

export interface TokenBundle {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  scope: string;
}
