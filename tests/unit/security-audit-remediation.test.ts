import test from "node:test";
import assert from "node:assert/strict";
import { toSessionRef } from "../../src/security/session-ref.js";
import { TranslationService } from "../../src/services/translation-service.js";
import { evaluateProvisioningMappings } from "../../src/services/provisioning-mapping-engine.js";
import { redactConnectorConfig } from "../../src/services/connector-service.js";
import { EventHookService } from "../../src/services/event-hook-service.js";
import type { EventHook, EventNotification } from "../../src/domain/models.js";

process.env.NODE_ENV = "test";

test("toSessionRef is a truncated sha256 and not the raw id", () => {
  const sessionId = "sess_live_credential";
  const ref = toSessionRef(sessionId);
  assert.equal(ref.length, 16);
  assert.notEqual(ref, sessionId);
  assert.equal(toSessionRef(sessionId), ref);
});

test("translation language lookup ignores Object.prototype keys", () => {
  const service = new TranslationService();
  assert.equal(service.isValidLanguage("en"), true);
  assert.equal(service.isValidLanguage("constructor"), false);
  assert.equal(service.isValidLanguage("__proto__"), false);
});

test("mapping engine refuses system-managed and prototype target keys", () => {
  const timestamp = new Date("2026-04-20T00:00:00.000Z");
  const result = evaluateProvisioningMappings({
    customAttributes: {
      incoming: "yes",
      password_changed_at: "keep"
    },
    mappings: [
      {
        id: "map-sys",
        name: "sys",
        sourceAttribute: "incoming",
        targetAttribute: "customAttributes.password_changed_at",
        enabled: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: "map-proto",
        name: "proto",
        sourceAttribute: "incoming",
        targetAttribute: "__proto__",
        enabled: true,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ]
  });

  assert.equal(result.drift.length, 0);
  assert.equal(result.nextCustomAttributes.password_changed_at, "keep");
});

test("connector config redacts secret-like keys", () => {
  const redacted = redactConnectorConfig({
    baseUrl: "https://ldap.example",
    bindPassword: "hunter2",
    token: "abc",
    retryMaxAttempts: 3
  });
  assert.equal(redacted.baseUrl, "https://ldap.example");
  assert.equal(redacted.bindPassword, "********");
  assert.equal(redacted.token, "********");
  assert.equal(redacted.retryMaxAttempts, 3);
});

test("event hook create returns a signing secret once and redacts it from lists", async () => {
  const hooks: EventHook[] = [];
  const notifications: EventNotification[] = [];
  const service = new EventHookService(
    {
      list: async () => hooks,
      listByEventType: async () => hooks,
      findById: async (id) => hooks.find((hook) => hook.id === id),
      create: async (hook) => {
        const created = { ...hook, createdAt: new Date(), updatedAt: new Date() };
        hooks.push(created);
        return created;
      },
      update: async () => undefined,
      delete: async () => undefined
    },
    {
      list: async () => notifications,
      create: async (notification) => {
        const created = { ...notification, id: "n1", createdAt: new Date() };
        notifications.push(created);
        return created;
      }
    }
  );

  const created = await service.createHook({
    eventType: "user.created",
    targetUrl: "https://example.test/hooks",
    method: "POST",
    headers: { authorization: "Bearer receiver-token" }
  });

  assert.equal(typeof created.signingSecret, "string");
  assert.equal(created.headers.authorization, "Bearer receiver-token");
  assert.equal(created.headers._ssoSigningSecret, undefined);
  assert.equal(created.hasSigningSecret, true);

  const listed = await service.listHooks();
  assert.equal(listed[0]?.signingSecret, undefined);
  assert.equal(listed[0]?.headers._ssoSigningSecret, undefined);
  assert.equal(listed[0]?.hasSigningSecret, true);
});

test("recovery service hashes tickets and replaces prior challenges for the same user", async () => {
  const { RecoveryService } = await import("../../src/services/recovery-service.js");
  const service = new RecoveryService();
  const first = service.createChallenge({ userId: "user-1" });
  const second = service.createChallenge({ userId: "user-1" });

  assert.notEqual(first.ticket, second.ticket);
  assert.throws(() => service.getChallenge(first.ticket));
  assert.equal(service.getChallenge(second.ticket).userId, "user-1");
  assert.equal(service.verifyCode({ ticket: second.ticket, code: second.verificationCode }), true);
});
