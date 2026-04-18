import type {
  AccessTokenRecord,
  AuthorizationCode,
  Consent,
  OAuthClient,
  RefreshTokenRecord,
  Role,
  Session,
  Tenant,
  User,
  UserRoleAssignment
} from "../domain/models.js";

export interface RoleRepository {
  create(input: Omit<Role, "id" | "createdAt">): Role;
  list(): Role[];
  findByIds(ids: string[]): Role[];
  findByName(name: string): Role | undefined;
}

export interface UserRepository {
  create(input: Omit<User, "id" | "createdAt" | "updatedAt">): User;
  list(): User[];
  findByEmail(email: string): User | undefined;
  findById(id: string): User | undefined;
}

export interface ClientRepository {
  create(input: Omit<OAuthClient, "createdAt">): OAuthClient;
  findById(id: string): OAuthClient | undefined;
}

export interface SessionRepository {
  create(input: Omit<Session, "id">): Session;
  findById(id: string): Session | undefined;
}

export interface AuthorizationCodeRepository {
  create(input: Omit<AuthorizationCode, "id" | "createdAt">): AuthorizationCode;
  consume(code: string): AuthorizationCode | undefined;
}

export interface TenantRepository {
  create(input: Omit<Tenant, "id" | "createdAt">): Tenant;
  list(): Tenant[];
  findBySlug(slug: string): Tenant | undefined;
  findById(id: string): Tenant | undefined;
}

export interface UserRoleAssignmentRepository {
  assign(input: Omit<UserRoleAssignment, "id" | "createdAt">): UserRoleAssignment;
  listByUser(userId: string): UserRoleAssignment[];
}

export interface ConsentRepository {
  upsert(input: Omit<Consent, "id" | "createdAt" | "updatedAt">): Consent;
  findByUserAndClient(userId: string, clientId: string): Consent | undefined;
}

export interface RefreshTokenRepository {
  create(input: Omit<RefreshTokenRecord, "id" | "createdAt">): RefreshTokenRecord;
  findActiveByHash(tokenHash: string): RefreshTokenRecord | undefined;
  markConsumed(tokenId: string, consumedAt: Date): void;
  revokeTokenFamily(tokenId: string, revokedAt: Date): void;
  revokeByTokenId(tokenId: string, revokedAt: Date): void;
}

export interface AccessTokenRepository {
  create(input: Omit<AccessTokenRecord, "id" | "createdAt">): AccessTokenRecord;
  isRevoked(tokenId: string): boolean;
  revokeByTokenId(tokenId: string, revokedAt: Date): void;
}
