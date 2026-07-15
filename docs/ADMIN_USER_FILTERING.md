# Admin user listing filters

NexusID admin APIs support filtering users by group membership, active status, text search, pagination, and exact custom-attribute matches.

By default, user listing APIs return **human users only**. Machine-to-machine (M2M) / service identities are omitted unless you explicitly opt in. Manage and list those accounts via `GET /api/admin/service-identities`, or pass `includeServiceUsers=true` when you need them in a users list.

## `GET /api/admin/users`

| Query param | Description |
|-------------|-------------|
| `search` / `q` | Case-insensitive match on username, email, given name, family name, or id |
| `group` | Group name (exact or case-insensitive substring) |
| `active` | `true` or `false` |
| `includeServiceUsers` | `true` to include M2M/service identities (`isServiceUser=true`). Default / omitted / `false` excludes them |
| `page` | Page number (default 1 when `pageSize` is set) |
| `pageSize` | Items per page (default 50 when `page` is set) |
| `customAttribute.{key}` | Exact match on normalized custom attribute key |

### Examples

List active managers in the `gestor` group for a given area:

```http
GET /api/admin/users?group=gestor&active=true&customAttribute.connect_jc_area_principal=RH
```

List direct reports for a manager (Connect JC pattern):

```http
GET /api/admin/users?active=true&customAttribute.connect_jc_gestor={manager_sub}
```

Include service identities in the same listing:

```http
GET /api/admin/users?includeServiceUsers=true
```

## `GET /api/admin/groups/{id}/users`

Same filter query params as `GET /api/admin/users`, applied to direct group members only. Each returned user includes `customAttributes`. Service identities are excluded by default; pass `includeServiceUsers=true` to include them (for example when reviewing M2M membership on a group).

### Example

```http
GET /api/admin/groups/{gestorGroupId}/users?active=true&customAttribute.connect_jc_area_principal=Financeiro
```

Include service identities among group members:

```http
GET /api/admin/groups/{groupId}/users?includeServiceUsers=true
```

## Service identities (M2M)

Service identities are stored as users with `isServiceUser=true`, but they are a separate operational surface:

| Goal | API |
|------|-----|
| List / manage M2M accounts | `GET /api/admin/service-identities` |
| Include M2M rows in a users query | `GET /api/admin/users?includeServiceUsers=true` |
| Human directory only (default) | `GET /api/admin/users` (omit the flag) |

The Admin **Users** view lists human users. The **Service Identities** view lists M2M accounts.

## SDK usage

### TypeScript

```typescript
const managers = await client.admin.users.list({
  group: 'gestor',
  active: true,
  customAttributes: { connect_jc_area_principal: 'RH' }
});

// Opt in to M2M / service identities
const everyone = await client.admin.users.list({
  includeServiceUsers: true
});

const groupMembers = await client.admin.groups.listUsers(groupId, {
  active: true,
  customAttributes: { connect_jc_area_principal: 'RH' }
});

const groupMembersWithSi = await client.admin.groups.listUsers(groupId, {
  includeServiceUsers: true
});
```

### Python

```python
managers = admin.users.list(group="gestor", active=True, **{
    "customAttribute.connect_jc_area_principal": "RH",
})

everyone = admin.users.list(includeServiceUsers=True)

members = admin.groups.users(group_id, active=True, **{
    "customAttribute.connect_jc_area_principal": "RH",
})

members_with_si = admin.groups.users(group_id, includeServiceUsers=True)
```

## Notes

- Filters are combined with logical AND.
- Custom attribute keys are normalized (`connect_jc.cargo` → `connect_jc_cargo`).
- Listing currently resolves filters in memory after loading users; suitable for moderate directory sizes.
- Pagination totals reflect the filtered set (service identities are not counted when excluded).
