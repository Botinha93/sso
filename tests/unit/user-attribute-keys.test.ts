import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeCustomAttributeMap,
  normalizeUserAttributeKey
} from "../../src/domain/user-attribute-keys.js";

test("normalizeUserAttributeKey lowercases and replaces non-alphanumeric separators", () => {
  assert.equal(normalizeUserAttributeKey("connect_jc.cargo"), "connect_jc_cargo");
  assert.equal(normalizeUserAttributeKey("Connect_JC.Gestor"), "connect_jc_gestor");
});

test("normalizeCustomAttributeMap canonicalizes keys and omits empty values when requested", () => {
  assert.deepEqual(
    normalizeCustomAttributeMap({
      "connect_jc.cargo": "Vendedor",
      "connect_jc.gestor": "  ",
      "connect_jc.matricula": "123"
    }),
    {
      connect_jc_cargo: "Vendedor",
      connect_jc_gestor: "  ",
      connect_jc_matricula: "123"
    }
  );

  assert.deepEqual(
    normalizeCustomAttributeMap(
      {
        "connect_jc.cargo": "Vendedor",
        "connect_jc.gestor": "  "
      },
      { omitEmptyValues: true }
    ),
    {
      connect_jc_cargo: "Vendedor"
    }
  );
});
