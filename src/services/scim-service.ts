import { randomBytes } from "node:crypto";
import { ValidationError } from "../core/errors.js";
import type { GroupService } from "./group-service.js";
import type { UserService } from "./user-service.js";

const USER_SCHEMA_ID = "urn:ietf:params:scim:schemas:core:2.0:User";
const GROUP_SCHEMA_ID = "urn:ietf:params:scim:schemas:core:2.0:Group";
const LIST_SCHEMA_ID = "urn:ietf:params:scim:api:messages:2.0:ListResponse";

export class ScimService {
  constructor(
    private readonly userService: UserService,
    private readonly groupService: GroupService
  ) {}

  getServiceProviderConfig() {
    return {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: true },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: "oauthbearertoken",
          name: "OAuth Bearer Token",
          description: "Authentication scheme for SCIM endpoints.",
          specUri: "https://www.rfc-editor.org/rfc/rfc7644",
          primary: true
        }
      ]
    };
  }

  getSchemas() {
    return {
      Resources: [
        {
          id: USER_SCHEMA_ID,
          name: "User",
          description: "User Account",
          attributes: [
            { name: "userName", type: "string", multiValued: false, required: true, mutability: "readWrite", returned: "default", uniqueness: "server" },
            { name: "name", type: "complex", multiValued: false, required: false, mutability: "readWrite", returned: "default" },
            { name: "emails", type: "complex", multiValued: true, required: false, mutability: "readWrite", returned: "default" },
            { name: "active", type: "boolean", multiValued: false, required: false, mutability: "readWrite", returned: "default" }
          ],
          meta: { resourceType: "Schema", location: `/scim/v2/Schemas/${encodeURIComponent(USER_SCHEMA_ID)}` }
        },
        {
          id: GROUP_SCHEMA_ID,
          name: "Group",
          description: "Group",
          attributes: [
            { name: "displayName", type: "string", multiValued: false, required: true, mutability: "readWrite", returned: "default", uniqueness: "none" },
            { name: "members", type: "complex", multiValued: true, required: false, mutability: "readWrite", returned: "default" }
          ],
          meta: { resourceType: "Schema", location: `/scim/v2/Schemas/${encodeURIComponent(GROUP_SCHEMA_ID)}` }
        }
      ],
      totalResults: 2,
      startIndex: 1,
      itemsPerPage: 2,
      schemas: [LIST_SCHEMA_ID]
    };
  }

  getResourceTypes() {
    return {
      Resources: [
        {
          id: "User",
          name: "User",
          endpoint: "/Users",
          description: "User Account",
          schema: USER_SCHEMA_ID,
          meta: { resourceType: "ResourceType", location: "/scim/v2/ResourceTypes/User" }
        },
        {
          id: "Group",
          name: "Group",
          endpoint: "/Groups",
          description: "Group",
          schema: GROUP_SCHEMA_ID,
          meta: { resourceType: "ResourceType", location: "/scim/v2/ResourceTypes/Group" }
        }
      ],
      totalResults: 2,
      startIndex: 1,
      itemsPerPage: 2,
      schemas: [LIST_SCHEMA_ID]
    };
  }

  async listUsers(input: { startIndex?: number; count?: number; filter?: string }) {
    const all = await this.userService.listUsers();
    const filtered = this.filterUsers(all, input.filter);
    const startIndex = input.startIndex ?? 1;
    const count = input.count ?? 100;
    const startOffset = Math.max(0, startIndex - 1);
    const page = filtered.slice(startOffset, startOffset + count);

    return {
      schemas: [LIST_SCHEMA_ID],
      totalResults: filtered.length,
      startIndex,
      itemsPerPage: page.length,
      Resources: page.map((user) => this.toScimUser(user))
    };
  }

  async getUserById(id: string) {
    const user = await this.userService.findUserById(id);
    if (!user) {
      return undefined;
    }
    return this.toScimUser(user);
  }

  async createUser(input: {
    externalId?: string;
    userName: string;
    name?: { givenName?: string; familyName?: string };
    emails?: Array<{ value: string; primary?: boolean }>;
    active?: boolean;
    password?: string;
  }) {
    const primaryEmail = input.emails?.find((email) => email.primary)?.value ?? input.emails?.[0]?.value;
    const email = primaryEmail ?? this.syntheticEmailFromUserName(input.userName);
    const created = await this.userService.createUser({
      externalSource: "scim",
      externalId: input.externalId,
      email,
      username: input.userName,
      password: input.password ?? randomBytes(16).toString("hex"),
      givenName: input.name?.givenName ?? "SCIM",
      familyName: input.name?.familyName ?? "User",
      customAttributes: {
        scim_managed: "true"
      },
      roleIds: [],
      groupIds: [],
      active: input.active ?? true
    });

    return this.toScimUser(created);
  }

  async replaceUser(id: string, input: {
    externalId?: string;
    userName: string;
    name?: { givenName?: string; familyName?: string };
    emails?: Array<{ value: string; primary?: boolean }>;
    active?: boolean;
    password?: string;
  }) {
    const existing = await this.userService.findUserById(id);
    if (!existing) {
      throw new ValidationError("User not found");
    }

    const primaryEmail = input.emails?.find((email) => email.primary)?.value ?? input.emails?.[0]?.value;
    const updated = await this.userService.updateUserProfile(id, {
      externalSource: "scim",
      externalId: input.externalId,
      username: input.userName,
      email: primaryEmail ?? existing.email,
      givenName: input.name?.givenName ?? existing.givenName,
      familyName: input.name?.familyName ?? existing.familyName
    });
    if (!updated) {
      throw new ValidationError("User not found");
    }

    if (typeof input.active === "boolean") {
      await this.userService.setUserActive(id, input.active);
    }
    if (input.password) {
      await this.userService.resetPassword(id, input.password);
    }

    return this.toScimUser({
      ...updated,
      active: typeof input.active === "boolean" ? input.active : updated.active
    });
  }

  async patchUser(id: string, operations: Array<{ op: "add" | "replace" | "remove"; path?: string; value?: unknown }>) {
    const existing = await this.userService.findUserById(id);
    if (!existing) {
      throw new ValidationError("User not found");
    }

    const profilePatch: {
      externalSource?: string;
      externalId?: string;
      username?: string;
      email?: string;
      givenName?: string;
      familyName?: string;
    } = {};
    let activePatch: boolean | undefined;

    for (const operation of operations) {
      const path = (operation.path ?? "").toLowerCase();
      if (path === "username" && typeof operation.value === "string") {
        profilePatch.username = operation.value;
      }
      if ((path === "emails" || path === "emails[value eq \"primary\"].value") && Array.isArray(operation.value) && operation.value.length > 0) {
        const first = operation.value[0] as { value?: unknown };
        if (typeof first?.value === "string") {
          profilePatch.email = first.value;
        }
      }
      if (path === "name.givenname" && typeof operation.value === "string") {
        profilePatch.givenName = operation.value;
      }
      if (path === "name.familyname" && typeof operation.value === "string") {
        profilePatch.familyName = operation.value;
      }
      if (path === "active" && typeof operation.value === "boolean") {
        activePatch = operation.value;
      }
      if (path === "externalid" && typeof operation.value === "string") {
        profilePatch.externalSource = "scim";
        profilePatch.externalId = operation.value;
      }
    }

    const updatedProfile = await this.userService.updateUserProfile(id, profilePatch);
    if (!updatedProfile) {
      throw new ValidationError("User not found");
    }
    if (typeof activePatch === "boolean") {
      await this.userService.setUserActive(id, activePatch);
    }

    return this.toScimUser({
      ...updatedProfile,
      active: typeof activePatch === "boolean" ? activePatch : updatedProfile.active
    });
  }

  async deleteUser(id: string) {
    await this.userService.deleteUser(id);
  }

  async listGroups(input: { startIndex?: number; count?: number; filter?: string }) {
    const all = await this.groupService.listGroups();
    const filtered = this.filterGroups(all, input.filter);
    const startIndex = input.startIndex ?? 1;
    const count = input.count ?? 100;
    const startOffset = Math.max(0, startIndex - 1);
    const page = filtered.slice(startOffset, startOffset + count);

    return {
      schemas: [LIST_SCHEMA_ID],
      totalResults: filtered.length,
      startIndex,
      itemsPerPage: page.length,
      Resources: await Promise.all(page.map((group) => this.toScimGroup(group)))
    };
  }

  async getGroupById(id: string) {
    const group = await this.groupService.findGroupById(id);
    if (!group) {
      return undefined;
    }
    return this.toScimGroup(group);
  }

  async createGroup(input: { externalId?: string; displayName: string; members?: Array<{ value: string }> }) {
    const created = await this.groupService.createGroup({
      externalSource: "scim",
      externalId: input.externalId,
      name: input.displayName,
      description: `SCIM group ${input.displayName}`,
      roleIds: []
    });

    for (const member of input.members ?? []) {
      await this.groupService.assignUserToGroup({ userId: member.value, groupId: created.id });
    }

    return this.toScimGroup(created);
  }

  async replaceGroup(id: string, input: { externalId?: string; displayName: string; members?: Array<{ value: string }> }) {
    const existing = await this.groupService.findGroupById(id);
    if (!existing) {
      throw new ValidationError("Group not found");
    }

    await this.groupService.updateGroup(id, {
      externalSource: "scim",
      externalId: input.externalId,
      name: input.displayName,
      description: existing.description
    });

    const users = await this.userService.listUsers();
    for (const user of users) {
      const groupIds = await this.groupService.listGroupIdsForUser(user.id);
      if (groupIds.includes(id)) {
        await this.groupService.removeUserFromGroup({ userId: user.id, groupId: id });
      }
    }

    for (const member of input.members ?? []) {
      await this.groupService.assignUserToGroup({ userId: member.value, groupId: id });
    }

    const updated = await this.groupService.findGroupById(id);
    if (!updated) {
      throw new ValidationError("Group not found");
    }
    return this.toScimGroup(updated);
  }

  async patchGroup(id: string, operations: Array<{ op: "add" | "replace" | "remove"; path?: string; value?: unknown }>) {
    const existing = await this.groupService.findGroupById(id);
    if (!existing) {
      throw new ValidationError("Group not found");
    }

    for (const operation of operations) {
      const path = (operation.path ?? "").toLowerCase();
      if (path === "displayname" && typeof operation.value === "string") {
        await this.groupService.updateGroup(id, { name: operation.value });
      }
      if (path === "externalid" && typeof operation.value === "string") {
        await this.groupService.updateGroup(id, { externalSource: "scim", externalId: operation.value });
      }

      if (path === "members" && Array.isArray(operation.value)) {
        const members = operation.value as Array<{ value?: unknown }>;
        for (const member of members) {
          if (typeof member.value !== "string") {
            continue;
          }
          if (operation.op === "remove") {
            await this.groupService.removeUserFromGroup({ userId: member.value, groupId: id });
          } else {
            await this.groupService.assignUserToGroup({ userId: member.value, groupId: id });
          }
        }
      }
    }

    const updated = await this.groupService.findGroupById(id);
    if (!updated) {
      throw new ValidationError("Group not found");
    }
    return this.toScimGroup(updated);
  }

  async deleteGroup(id: string) {
    await this.groupService.deleteGroup(id);
  }

  private toScimUser(user: {
    id: string;
    externalId?: string;
    username: string;
    email: string;
    givenName: string;
    familyName: string;
    active: boolean;
    [key: string]: unknown;
  }) {
    return {
      schemas: [USER_SCHEMA_ID],
      id: user.id,
      externalId: user.externalId,
      userName: user.username,
      name: {
        givenName: user.givenName,
        familyName: user.familyName
      },
      emails: [
        {
          value: user.email,
          primary: true
        }
      ],
      active: user.active,
      meta: {
        resourceType: "User",
        location: `/scim/v2/Users/${user.id}`
      }
    };
  }

  private async toScimGroup(group: { id: string; name: string; externalId?: string; [key: string]: unknown }) {
    const users = await this.userService.listUsers();
    const members: Array<{ value: string; display: string }> = [];

    for (const user of users) {
      const groupIds = await this.groupService.listGroupIdsForUser(user.id);
      if (groupIds.includes(group.id)) {
        members.push({ value: user.id, display: user.username });
      }
    }

    return {
      schemas: [GROUP_SCHEMA_ID],
      id: group.id,
      externalId: group.externalId,
      displayName: group.name,
      members,
      meta: {
        resourceType: "Group",
        location: `/scim/v2/Groups/${group.id}`
      }
    };
  }

  private filterUsers<T extends { username: string; email: string }>(
    users: T[],
    filter: string | undefined
  ): T[] {
    if (!filter) {
      return users;
    }
    const matchUserName = filter.match(/^userName\s+eq\s+"(.+)"$/i);
    if (matchUserName) {
      const expected = matchUserName[1].toLowerCase();
      return users.filter((user) => user.username.toLowerCase() === expected);
    }
    const matchEmail = filter.match(/^emails\.value\s+eq\s+"(.+)"$/i);
    if (matchEmail) {
      const expected = matchEmail[1].toLowerCase();
      return users.filter((user) => user.email.toLowerCase() === expected);
    }
    return users;
  }

  private filterGroups<T extends { name: string }>(
    groups: T[],
    filter: string | undefined
  ): T[] {
    if (!filter) {
      return groups;
    }
    const matchDisplayName = filter.match(/^displayName\s+eq\s+"(.+)"$/i);
    if (matchDisplayName) {
      const expected = matchDisplayName[1].toLowerCase();
      return groups.filter((group) => group.name.toLowerCase() === expected);
    }
    return groups;
  }

  private syntheticEmailFromUserName(userName: string) {
    const normalized = userName.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_");
    return `${normalized}@scim.local`;
  }
}