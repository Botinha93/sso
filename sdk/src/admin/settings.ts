import type { ClientInstance } from "../core/types.js";
import type {
  DatabaseMigrationInput,
  DatabaseMigrationResult,
  SDKAdminSettings,
  SendTestEmailInput,
  SendTestEmailResult,
  SettingsAPI,
  TestDatabaseConnectionInput,
  TestDatabaseConnectionResult,
  UpdateAdminSettingsInput
} from "./types.js";

/**
 * Creates the Settings admin API module.
 *
 * Supports reading and updating admin configuration settings.
 */
export const createSettingsAPI = (client: ClientInstance): SettingsAPI => ({
  get: () => client.get<SDKAdminSettings>("/api/admin/settings"),
  update: (input: UpdateAdminSettingsInput) => client.put<SDKAdminSettings>("/api/admin/settings", { body: input }),
  testEmail: (input: SendTestEmailInput) => client.post<SendTestEmailResult>("/api/admin/settings/test-email", { body: input }),
  testDatabase: (input: TestDatabaseConnectionInput) => client.post<TestDatabaseConnectionResult>("/api/admin/settings/database/test", { body: input }),
  migrateDatabase: (input: DatabaseMigrationInput) => client.post<DatabaseMigrationResult>("/api/admin/settings/database/migrate", { body: input })
});
