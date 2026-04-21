import Database from "better-sqlite3";
import { nanoid } from "nanoid";
import type { ServiceIdentity, ServiceIdentityCredential, ServiceIdentityStatus } from "../domain/models.js";
import type { ServiceIdentityRepository, ServiceIdentityCredentialRepository } from "./contracts.js";

type DbRow = Record<string, unknown>;

function mapServiceIdentity(row: DbRow): ServiceIdentity {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : undefined,
    ownerId: row.owner_id ? String(row.owner_id) : undefined,
    appId: row.app_id ? String(row.app_id) : undefined,
    status: String(row.status) as ServiceIdentityStatus,
    allowedScopes: row.allowed_scopes_json ? JSON.parse(String(row.allowed_scopes_json)) : [],
    allowedAudiences: row.allowed_audiences_json ? JSON.parse(String(row.allowed_audiences_json)) : [],
    metadata: row.metadata_json ? JSON.parse(String(row.metadata_json)) : undefined,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at))
  };
}

function mapServiceIdentityCredential(row: DbRow): ServiceIdentityCredential {
  return {
    id: String(row.id),
    serviceIdentityId: String(row.service_identity_id),
    clientId: String(row.client_id),
    clientSecretHash: String(row.client_secret_hash),
    expiresAt: row.expires_at ? new Date(String(row.expires_at)) : undefined,
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)) : undefined,
    rotatedFromId: row.rotated_from_id ? String(row.rotated_from_id) : undefined,
    lastUsedAt: row.last_used_at ? new Date(String(row.last_used_at)) : undefined,
    createdAt: new Date(String(row.created_at))
  };
}

export class SqliteServiceIdentityRepository implements ServiceIdentityRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: Omit<ServiceIdentity, "id" | "createdAt" | "updatedAt">): ServiceIdentity {
    const id = nanoid();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO service_identities (id, name, description, owner_id, app_id, status, allowed_scopes_json, allowed_audiences_json, metadata_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.name,
      input.description ?? null,
      input.ownerId ?? null,
      input.appId ?? null,
      input.status,
      JSON.stringify(input.allowedScopes),
      JSON.stringify(input.allowedAudiences),
      input.metadata ? JSON.stringify(input.metadata) : null,
      now,
      now
    );

    return { id, ...input, createdAt: new Date(now), updatedAt: new Date(now) };
  }

  list(): ServiceIdentity[] {
    const rows = this.db.prepare("SELECT * FROM service_identities ORDER BY created_at DESC").all() as DbRow[];
    return rows.map(mapServiceIdentity);
  }

  findById(id: string): ServiceIdentity | undefined {
    const row = this.db.prepare("SELECT * FROM service_identities WHERE id = ?").get(id) as DbRow | undefined;
    return row ? mapServiceIdentity(row) : undefined;
  }

  update(id: string, input: Partial<Omit<ServiceIdentity, "id" | "createdAt">>): ServiceIdentity | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const updated: ServiceIdentity = { ...existing, ...input, updatedAt: new Date() };
    this.db.prepare(`
      UPDATE service_identities
      SET name = ?, description = ?, owner_id = ?, app_id = ?, status = ?, allowed_scopes_json = ?, allowed_audiences_json = ?, metadata_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.name,
      updated.description ?? null,
      updated.ownerId ?? null,
      updated.appId ?? null,
      updated.status,
      JSON.stringify(updated.allowedScopes),
      JSON.stringify(updated.allowedAudiences),
      updated.metadata ? JSON.stringify(updated.metadata) : null,
      updated.updatedAt.toISOString(),
      id
    );

    return updated;
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM service_identity_credentials WHERE service_identity_id = ?").run(id);
    this.db.prepare("DELETE FROM service_identities WHERE id = ?").run(id);
  }
}

export class SqliteServiceIdentityCredentialRepository implements ServiceIdentityCredentialRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: Omit<ServiceIdentityCredential, "id" | "createdAt">): ServiceIdentityCredential {
    const id = nanoid();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO service_identity_credentials (id, service_identity_id, client_id, client_secret_hash, expires_at, revoked_at, rotated_from_id, last_used_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.serviceIdentityId,
      input.clientId,
      input.clientSecretHash,
      input.expiresAt?.toISOString() ?? null,
      input.revokedAt?.toISOString() ?? null,
      input.rotatedFromId ?? null,
      input.lastUsedAt?.toISOString() ?? null,
      now
    );

    return { id, ...input, createdAt: new Date(now) };
  }

  listByServiceIdentity(serviceIdentityId: string): ServiceIdentityCredential[] {
    const rows = this.db.prepare("SELECT * FROM service_identity_credentials WHERE service_identity_id = ? ORDER BY created_at DESC").all(serviceIdentityId) as DbRow[];
    return rows.map(mapServiceIdentityCredential);
  }

  findById(id: string): ServiceIdentityCredential | undefined {
    const row = this.db.prepare("SELECT * FROM service_identity_credentials WHERE id = ?").get(id) as DbRow | undefined;
    return row ? mapServiceIdentityCredential(row) : undefined;
  }

  findByClientId(clientId: string): ServiceIdentityCredential | undefined {
    const row = this.db.prepare("SELECT * FROM service_identity_credentials WHERE client_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1").get(clientId) as DbRow | undefined;
    return row ? mapServiceIdentityCredential(row) : undefined;
  }

  revoke(id: string, revokedAt: Date): void {
    this.db.prepare("UPDATE service_identity_credentials SET revoked_at = ? WHERE id = ?").run(revokedAt.toISOString(), id);
  }

  touchLastUsed(id: string, usedAt: Date): void {
    this.db.prepare("UPDATE service_identity_credentials SET last_used_at = ? WHERE id = ?").run(usedAt.toISOString(), id);
  }
}
