# Admin user listing filters

NexusID admin APIs support filtering users by group membership, active status, text search, pagination, and exact custom-attribute matches.

## `GET /api/admin/users`

| Query param | Description |
|-------------|-------------|
| `search` / `q` | Case-insensitive match on username, email, given name, family name, or id |
| `group` | Group name (exact or case-insensitive substring) |
| `active` | `true` or `false` |
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

## `GET /api/admin/groups/{id}/users`

Same filter query params as `GET /api/admin/users`, applied to direct group members only. Each returned user includes `customAttributes`.

### Example

```http
GET /api/admin/groups/{gestorGroupId}/users?active=true&customAttribute.connect_jc_area_principal=Financeiro
```

## SDK usage

### TypeScript

```typescript
const managers = await client.admin.users.list({
  group: 'gestor',
  active: true,
  customAttributes: { connect_jc_area_principal: 'RH' }
});

const groupMembers = await client.admin.groups.listUsers(groupId, {
  active: true,
  customAttributes: { connect_jc_area_principal: 'RH' }
});
```

### Python

```python
managers = admin.users.list(group="gestor", active=True, **{
    "customAttribute.connect_jc_area_principal": "RH",
})

members = admin.groups.users(group_id, active=True, **{
    "customAttribute.connect_jc_area_principal": "RH",
})
```

## Notes

- Filters are combined with logical AND.
- Custom attribute keys are normalized (`connect_jc.cargo` → `connect_jc_cargo`).
- Listing currently resolves filters in memory after loading users; suitable for moderate directory sizes.
