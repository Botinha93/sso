import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAdminUserFilters,
  filterAdminUsers,
  parseAdminListQuery,
  parseCustomAttributeFilters
} from "../../src/http/list-search.js";

test("parseCustomAttributeFilters reads customAttribute.* query keys", () => {
  assert.deepEqual(
    parseCustomAttributeFilters({
      "customAttribute.connect_jc_area_principal": "RH",
      "customAttribute.connect_jc.gestor": "user-1",
      unrelated: "ignored"
    }),
    {
      connect_jc_area_principal: "RH",
      connect_jc_gestor: "user-1"
    }
  );
});

test("parseAdminListQuery parses group, active, and pagination", () => {
  assert.deepEqual(
    parseAdminListQuery({
      group: "gestor",
      active: "true",
      page: "2",
      pageSize: "25",
      search: "ana"
    }),
    {
      group: "gestor",
      active: true,
      page: 2,
      pageSize: 25,
      search: "ana",
      customAttributes: {}
    }
  );
});

test("applyAdminUserFilters matches active and custom attributes", () => {
  const users = [
    { id: "1", active: true, customAttributes: { connect_jc_area_principal: "RH" } },
    { id: "2", active: true, customAttributes: { connect_jc_area_principal: "TI" } },
    { id: "3", active: false, customAttributes: { connect_jc_area_principal: "RH" } }
  ];
  const parsed = parseAdminListQuery({
    active: "true",
    "customAttribute.connect_jc_area_principal": "RH"
  });
  assert.deepEqual(applyAdminUserFilters(users, parsed), [users[0]]);
});

test("filterAdminUsers applies search and pagination", () => {
  const users = [
    { id: "1", active: true, username: "ana", customAttributes: {} },
    { id: "2", active: true, username: "bruno", customAttributes: {} },
    { id: "3", active: true, username: "ana-clara", customAttributes: {} }
  ];
  const filtered = filterAdminUsers(users, { search: "ana", page: "1", pageSize: "1" }, [
    (user) => user.username
  ]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, "1");
});
