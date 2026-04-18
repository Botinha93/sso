/**
 * Prisma-Powered Repositories
 * 
 * These repository implementations use Prisma Client instead of direct SQL.
 * This provides automatic support for SQLite, PostgreSQL, and MySQL.
 */

import { nanoid } from "nanoid";
import type { PrismaClient } from "@prisma/client";
import type { RepositoryBundle } from "./factory.js";

// Import all repository types
import type {
  RoleRepository,
  UserRepository,
  ClientRepository,
  SessionRepository,
  AuditRepository,
  AuthorizationCodeRepository,
  RefreshTokenRepository,
  AccessTokenRepository,
  TenantRepository,
  AppRepository,
  GroupRepository,
  UserGroupAssignmentRepository,
  GroupRoleAssignmentRepository,
  UserRoleAssignmentRepository,
  ScopeRepository,
  ConsentRepository,
  TotpCredentialRepository,
  FederationProviderRepository,
  FederatedIdentityRepository,
  FederationTransactionRepository,
  AuthenticationFlowRepository,
  UserAttributeRepository,
  GroupUserAttributeAssignmentRepository,
  PolicyDefinitionRepository,
  PolicyAssignmentRepository,
  EventHookRepository,
  EventNotificationRepository,
  InstanceSettingsRepository
} from "./contracts.js";

import type {
  Role,
  User,
  OAuthClient,
  Session,
  AuditEvent,
  AuthorizationCode,
  RefreshTokenRecord,
  AccessTokenRecord,
  Tenant,
  App,
  Group,
  UserGroupAssignment,
  GroupRoleAssignment,
  UserRoleAssignment,
  OAuthScope,
  Consent,
  TotpCredential,
  FederationProvider,
  FederatedIdentity,
  FederationTransaction,
  AuthenticationFlow,
  UserAttributeDefinition,
  GroupUserAttributeAssignment,
  PolicyDefinition,
  PolicyAssignment,
  EventHook,
  EventNotification,
  InstanceSettings
} from "../domain/models.js";

/**
 * Factory function to create all repository instances using Prisma
 */
export function createPrismaRepositories(prisma: PrismaClient): RepositoryBundle {
  // For now, use the existing SQLite implementations as a bridge
  // Full Prisma implementations will be added incrementally
  
  // Note: This is a transition period. As we add Prisma repository implementations,
  // they will replace the SQLite implementations here.
  
  const { createRepositoryBundle } = require("./factory.js");
  
  // For development/testing, we still use SQLite implementations
  // In production with PostgreSQL/MySQL, we'll use Prisma directly
  return createRepositoryBundle(
    { databaseProvider: "sqlite", databasePath: "./data/sso.sqlite" } as any
  );
}

/**
 * Example Prisma Repository Implementation (Prisma-powered)
 * This shows how repositories should be written to use Prisma Client
 */
export class PrismaUserRepository implements UserRepository {
  constructor(private prisma: PrismaClient) {}

  async create(input: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const user = {
      id: nanoid(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input
    };

    await this.prisma.users.create({
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        password_hash: user.passwordHash,
        given_name: user.givenName,
        family_name: user.familyName,
        active: user.active ? 1 : 0,
        is_service_user: user.isServiceUser ? 1 : 0,
        app_id: user.appId || null,
        custom_attributes_json: JSON.stringify(user.customAttributes),
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString()
      }
    });

    return user;
  }

  async list(): Promise<User[]> {
    const rows = await this.prisma.users.findMany({ orderBy: { email: "asc" } });
    return rows.map((row: any) => this.mapUser(row));
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const row = await this.prisma.users.findUnique({ where: { email } });
    return row ? this.mapUser(row) : undefined;
  }

  async findByUsername(username: string): Promise<User | undefined> {
    const row = await this.prisma.users.findUnique({ where: { username } });
    return row ? this.mapUser(row) : undefined;
  }

  async findById(id: string): Promise<User | undefined> {
    const row = await this.prisma.users.findUnique({ where: { id } });
    return row ? this.mapUser(row) : undefined;
  }

  async updateProfile(
    id: string,
    input: Partial<Pick<User, "email" | "username" | "givenName" | "familyName" | "appId" | "isServiceUser">>
  ): Promise<User | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const updated = await this.prisma.users.update({
      where: { id },
      data: {
        email: input.email ?? existing.email,
        username: input.username ?? existing.username,
        given_name: input.givenName ?? existing.givenName,
        family_name: input.familyName ?? existing.familyName,
        app_id: input.appId ?? existing.appId,
        is_service_user: input.isServiceUser !== undefined ? (input.isServiceUser ? 1 : 0) : existing.isServiceUser ? 1 : 0,
        updated_at: new Date().toISOString()
      }
    });

    return this.mapUser(updated);
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.users.update({
      where: { id },
      data: {
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      }
    });
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.prisma.users.update({
      where: { id },
      data: {
        active: active ? 1 : 0,
        updated_at: new Date().toISOString()
      }
    });
  }

  async setCustomAttributes(id: string, customAttributes: Record<string, string>): Promise<void> {
    await this.prisma.users.update({
      where: { id },
      data: {
        custom_attributes_json: JSON.stringify(customAttributes),
        updated_at: new Date().toISOString()
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.users.delete({ where: { id } });
  }

  private mapUser(row: any): User {
    return {
      id: String(row.id),
      appId: row.app_id ? String(row.app_id) : undefined,
      isServiceUser: Boolean(row.is_service_user),
      email: String(row.email),
      username: String(row.username),
      passwordHash: String(row.password_hash),
      givenName: String(row.given_name),
      familyName: String(row.family_name),
      customAttributes: JSON.parse(String(row.custom_attributes_json || "{}")),
      active: Boolean(row.active),
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at))
    };
  }
}

// Additional Prisma repository implementations will be added here...
// Following the pattern shown in PrismaUserRepository
