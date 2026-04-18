import type { AppConfig } from "./core/config.js";
import { createSigningKeys } from "./security/keys.js";
import { JwtService } from "./security/jwt.js";
import {
  SqliteAccessTokenRepository,
  SqliteAuthorizationCodeRepository,
  SqliteClientRepository,
  SqliteConsentRepository,
  SqliteDatabase,
  SqliteRefreshTokenRepository,
  SqliteRoleRepository,
  SqliteSessionRepository,
  SqliteTenantRepository,
  SqliteUserRepository,
  SqliteUserRoleAssignmentRepository
} from "./repositories/sqlite.js";
import { AuthService } from "./services/auth-service.js";
import { OidcService } from "./services/oidc-service.js";
import { RoleService } from "./services/role-service.js";
import { TenantService } from "./services/tenant-service.js";
import { UserService } from "./services/user-service.js";

export const bootstrap = async (config: AppConfig) => {
  const sqlite = new SqliteDatabase(config.databasePath);
  sqlite.migrate();

  const roleRepository = new SqliteRoleRepository(sqlite.connection);
  const tenantRepository = new SqliteTenantRepository(sqlite.connection);
  const assignmentRepository = new SqliteUserRoleAssignmentRepository(sqlite.connection);
  const userRepository = new SqliteUserRepository(sqlite.connection);
  const clientRepository = new SqliteClientRepository(sqlite.connection);
  const sessionRepository = new SqliteSessionRepository(sqlite.connection);
  const authorizationCodeRepository = new SqliteAuthorizationCodeRepository(sqlite.connection);
  const consentRepository = new SqliteConsentRepository(sqlite.connection);
  const refreshTokenRepository = new SqliteRefreshTokenRepository(sqlite.connection);
  const accessTokenRepository = new SqliteAccessTokenRepository(sqlite.connection);

  const roleService = new RoleService(roleRepository, assignmentRepository, tenantRepository);
  const userService = new UserService(userRepository, roleService);
  const tenantService = new TenantService(tenantRepository);

  const adminRole =
    roleRepository.findByName("platform_admin") ??
    roleService.createRole({
      name: "platform_admin",
      description: "Full access to platform identity administration",
      permissions: ["users:write", "users:read", "roles:write", "roles:read", "clients:write", "tenants:write"],
      scope: "platform"
    });

  if (!userRepository.findByEmail(config.admin.email)) {
    userService.createUser({
      email: config.admin.email,
      username: "admin",
      password: config.admin.password,
      givenName: "Platform",
      familyName: "Administrator",
      roleIds: [adminRole.id]
    });
  }

  if (!tenantRepository.findBySlug("default")) {
    tenantService.createTenant({
      slug: "default",
      name: "Default Tenant"
    });
  }

  if (!clientRepository.findById("sso-admin-ui")) {
    clientRepository.create({
      id: "sso-admin-ui",
      name: "SSO Admin UI",
      secret: "super-secret-admin-client",
      redirectUris: ["http://localhost:3000/callback"],
      allowedScopes: ["openid", "profile", "email", "offline_access", "roles"],
      grants: ["authorization_code", "refresh_token"],
      requirePkce: true
    });
  }

  const signingKeys = await createSigningKeys();
  const jwtService = new JwtService(signingKeys, config);
  const authService = new AuthService(
    userService,
    roleService,
    clientRepository,
    sessionRepository,
    authorizationCodeRepository,
    consentRepository,
    refreshTokenRepository,
    accessTokenRepository,
    tenantRepository,
    jwtService
  );
  const oidcService = new OidcService(config, jwtService);

  return {
    roleService,
    tenantService,
    userService,
    authService,
    oidcService
  };
};
