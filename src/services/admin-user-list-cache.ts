import type {
  Group,
  GroupAppAssignment,
  GroupRoleAssignment,
  GroupUserAttributeAssignment,
  Role,
  User,
  UserAppAssignment,
  UserAttributeDefinition,
  UserGroupAssignment,
  UserRoleAssignment
} from "../domain/models.js";

export type SerializedAdminUser = Omit<User, "passwordHash"> & {
  customAttributes: Record<string, string>;
  directCustomAttributes: Record<string, string>;
  inheritedCustomAttributes: Record<string, string>;
  appId?: string;
  appIds: string[];
  directAppIds: string[];
  inheritedAppIds: string[];
  inheritedAppSources: Array<{ appId: string; groupId: string; groupName: string }>;
  roles: string[];
  directRoleIds: string[];
  groups: string[];
};

export type AdminUserListCache = {
  groupsById: Map<string, Group>;
  rolesById: Map<string, Role>;
  roleAssignmentsByUser: Map<string, UserRoleAssignment[]>;
  groupIdsByUser: Map<string, string[]>;
  appIdsByUser: Map<string, string[]>;
  groupRoleIdsByGroup: Map<string, string[]>;
  groupAppAssignmentsByGroup: Map<string, GroupAppAssignment[]>;
  groupCustomAttributesByGroup: Map<string, Record<string, string>>;
};

const indexByUser = <T extends { userId: string }>(rows: T[]) => {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const existing = map.get(row.userId);
    if (existing) {
      existing.push(row);
    } else {
      map.set(row.userId, [row]);
    }
  }
  return map;
};

const indexIdsByUser = (rows: Array<{ userId: string; groupId?: string; appId?: string }>, field: "groupId" | "appId") => {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const value = row[field];
    if (!value) {
      continue;
    }
    const existing = map.get(row.userId);
    if (existing) {
      existing.push(value);
    } else {
      map.set(row.userId, [value]);
    }
  }
  return map;
};

const indexRoleIdsByGroup = (rows: GroupRoleAssignment[]) => {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.groupId);
    if (existing) {
      existing.push(row.roleId);
    } else {
      map.set(row.groupId, [row.roleId]);
    }
  }
  return map;
};

const indexAppAssignmentsByGroup = (rows: GroupAppAssignment[]) => {
  const map = new Map<string, GroupAppAssignment[]>();
  for (const row of rows) {
    const existing = map.get(row.groupId);
    if (existing) {
      existing.push(row);
    } else {
      map.set(row.groupId, [row]);
    }
  }
  return map;
};

const buildGroupCustomAttributes = (
  assignments: GroupUserAttributeAssignment[],
  definitionsById: Map<string, UserAttributeDefinition>
) => {
  const map = new Map<string, Record<string, string>>();
  for (const assignment of assignments) {
    if (!assignment.enabled || assignment.value === undefined) {
      continue;
    }
    const definition = definitionsById.get(assignment.attributeId);
    if (!definition?.enabled) {
      continue;
    }
    const existing = map.get(assignment.groupId) ?? {};
    existing[definition.key] = assignment.value;
    map.set(assignment.groupId, existing);
  }
  return map;
};

export const buildAdminUserListCache = (input: {
  groups: Group[];
  roles: Role[];
  userRoleAssignments: UserRoleAssignment[];
  userGroupAssignments: UserGroupAssignment[];
  userAppAssignments: UserAppAssignment[];
  groupRoleAssignments: GroupRoleAssignment[];
  groupAppAssignments: GroupAppAssignment[];
  groupUserAttributeAssignments: GroupUserAttributeAssignment[];
  attributeDefinitions: UserAttributeDefinition[];
}): AdminUserListCache => {
  const enabledDefinitionsById = new Map(
    input.attributeDefinitions.filter((definition) => definition.enabled).map((definition) => [definition.id, definition])
  );

  return {
    groupsById: new Map(input.groups.map((group) => [group.id, group])),
    rolesById: new Map(input.roles.map((role) => [role.id, role])),
    roleAssignmentsByUser: indexByUser(input.userRoleAssignments),
    groupIdsByUser: indexIdsByUser(input.userGroupAssignments, "groupId"),
    appIdsByUser: indexIdsByUser(input.userAppAssignments, "appId"),
    groupRoleIdsByGroup: indexRoleIdsByGroup(input.groupRoleAssignments),
    groupAppAssignmentsByGroup: indexAppAssignmentsByGroup(input.groupAppAssignments),
    groupCustomAttributesByGroup: buildGroupCustomAttributes(input.groupUserAttributeAssignments, enabledDefinitionsById)
  };
};

export const serializeAdminUserFromCache = (user: User, cache: AdminUserListCache): SerializedAdminUser => {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  const groupIds = cache.groupIdsByUser.get(user.id) ?? [];
  const groups = groupIds
    .map((groupId) => cache.groupsById.get(groupId)?.name)
    .filter((name): name is string => Boolean(name));

  const directRoleIds = Array.from(
    new Set((cache.roleAssignmentsByUser.get(user.id) ?? []).map((assignment) => assignment.roleId))
  );
  const inheritedRoleIds = groupIds.flatMap((groupId) => cache.groupRoleIdsByGroup.get(groupId) ?? []);
  const effectiveRoleIds = Array.from(new Set([...directRoleIds, ...inheritedRoleIds]));
  const roles = effectiveRoleIds
    .map((roleId) => cache.rolesById.get(roleId)?.name)
    .filter((name): name is string => Boolean(name));

  const directCustomAttributes = user.customAttributes ?? {};
  const inheritedCustomAttributes: Record<string, string> = {};
  for (const groupId of groupIds) {
    const groupCustomAttributes = cache.groupCustomAttributesByGroup.get(groupId) ?? {};
    for (const [key, value] of Object.entries(groupCustomAttributes)) {
      if (!(key in inheritedCustomAttributes)) {
        inheritedCustomAttributes[key] = value;
      }
    }
  }

  const assignedDirectAppIds = cache.appIdsByUser.get(user.id) ?? [];
  const directAppIds = assignedDirectAppIds.length > 0 ? assignedDirectAppIds : (user.appId ? [user.appId] : []);

  const inheritedAppSources: Array<{ appId: string; groupId: string; groupName: string }> = [];
  const seenSources = new Set<string>();
  for (const groupId of groupIds) {
    const group = cache.groupsById.get(groupId);
    if (!group) {
      continue;
    }

    const addSource = (appId: string) => {
      const key = `${appId}::${groupId}`;
      if (seenSources.has(key)) {
        return;
      }
      seenSources.add(key);
      inheritedAppSources.push({ appId, groupId, groupName: group.name });
    };

    for (const assignment of cache.groupAppAssignmentsByGroup.get(groupId) ?? []) {
      addSource(assignment.appId);
    }
    if (group.appId) {
      addSource(group.appId);
    }
  }

  const inheritedAppIds = Array.from(new Set(inheritedAppSources.map((source) => source.appId)));
  const appIds = Array.from(new Set([...directAppIds, ...inheritedAppIds]));

  return {
    ...safeUser,
    customAttributes: {
      ...inheritedCustomAttributes,
      ...directCustomAttributes
    },
    directCustomAttributes,
    inheritedCustomAttributes,
    appId: appIds[0],
    appIds,
    directAppIds,
    inheritedAppIds,
    inheritedAppSources,
    roles,
    directRoleIds,
    groups
  };
};
