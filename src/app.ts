import Fastify, { type FastifyServerOptions } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import { loadConfig } from "./core/config.js";
import { registerRoutes } from "./http/routes.js";
import { MAX_IMAGE_UPLOAD_BYTES } from "./http/upload-limits.js";
import { bootstrap } from "./bootstrap.js";
import { hasSqlInjectionPayload } from "./http/sql-injection-guard.js";

export const emitStartupConfigWarnings = async (
  app: Pick<ReturnType<typeof Fastify>, "log">,
  instanceSettingsService: { getSettings: () => Promise<{ allowImplicitFlow: boolean }> }
) => {
  const settings = await instanceSettingsService.getSettings();
  if (settings.allowImplicitFlow) {
    app.log.warn(
      {
        setting: "allowImplicitFlow",
        value: true,
        recommendation: "Disable allowImplicitFlow and use authorization_code + PKCE for user-facing apps."
      },
      "Startup security warning: implicit flow is enabled"
    );
  }
};

export const buildApp = async () => {
  const config = loadConfig();
  const serverOptions: FastifyServerOptions = {
    logger: process.env.NODE_ENV !== "test",
    // Fastify accepts a numeric hop count at runtime (proxy-addr); the type
    // definitions only list the other shapes.
    trustProxy: config.trustProxy as FastifyServerOptions["trustProxy"]
  };
  const app = Fastify(serverOptions);
  const services = await bootstrap(config);
  await emitStartupConfigWarnings(app, services.instanceSettingsService);

  app.addHook("onClose", async () => {
    await services.dispose();
  });

  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/health") {
      return;
    }

    if (!await services.instanceSettingsService.shouldRequireHttps()) {
      return;
    }

    const forwardedProto = request.headers["x-forwarded-proto"];
    const isForwardedHttps = Array.isArray(forwardedProto)
      ? forwardedProto.includes("https")
      : String(forwardedProto ?? "").split(",").map((part) => part.trim()).includes("https");

    const isSecure = request.protocol === "https" || isForwardedHttps;
    if (isSecure) {
      return;
    }

    return reply.status(426).send({
      error: "https_required",
      message: "HTTPS is required by instance settings"
    });
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // The SPA bundles are external module scripts; the only inline scripts the
        // server emits (auto-submit forms) carry a per-response nonce instead.
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  });

  // Helmet defaults to CORP same-origin, which blocks avatars and other media
  // from being embedded in third-party apps (e.g. via OIDC picture claims).
  app.addHook("onSend", async (request, reply, payload) => {
    const path = request.url.split("?")[0] ?? "";
    if (path.startsWith("/media/")) {
      reply.header("Cross-Origin-Resource-Policy", "cross-origin");
    }
    return payload;
  });
  await app.register(cookie, { secret: config.cookieSecret });
  await app.register(cors, {
    delegator: (request, callback) => {
      const origin = request.headers.origin;
      services.instanceSettingsService
        .getSettings()
        .then((settings) => {
          const explicitlyAllowed = Boolean(origin) && settings.corsAllowedOrigins.includes(origin as string);
          const allowed = !origin || explicitlyAllowed || settings.allowAnyCorsOrigin;
          callback(null, {
            origin: allowed,
            // Credentialed cross-origin access is only granted to origins the
            // operator listed explicitly, never to a wildcard.
            credentials: explicitlyAllowed,
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
          });
        })
        .catch((error) => callback(error as Error, {}));
    }
  });
  await app.register(rateLimit, {
    max: async () => {
      const { rateLimitMultiplier } = await services.instanceSettingsService.getRateLimitSettings();
      return Math.max(1, Math.round(100 * rateLimitMultiplier));
    },
    timeWindow: "1 minute",
    hook: "preHandler",
    // Key strictly on the caller's IP. Body fields such as client_id and the
    // session cookie are attacker-controlled and would let a caller mint a
    // fresh bucket per request. Per-client buckets are applied on top of this
    // limit by the endpoint-specific limiter in routes.ts.
    keyGenerator: (req) => `ip:${req.ip ?? "unknown"}`
  });
  // SCIM clients send application/scim+json (RFC 7644 §3.1); parse it as JSON.
  app.addContentTypeParser(
    ["application/scim+json", "application/scim+json; charset=utf-8"],
    { parseAs: "string" },
    (_request, body, done) => {
      try {
        done(null, body.length > 0 ? JSON.parse(String(body)) : {});
      } catch (error) {
        done(error as Error, undefined);
      }
    }
  );

  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: MAX_IMAGE_UPLOAD_BYTES
    }
  });

  app.addHook("preValidation", async (request, reply) => {
    const guardEnabled = process.env.SQLI_GUARD_ENABLED !== "false";
    if (!guardEnabled) {
      return;
    }

    const suspicious = hasSqlInjectionPayload({
      body: request.body,
      query: request.query,
      params: request.params,
      headers: request.headers
    });

    if (!suspicious) {
      return;
    }

    if (process.env.NODE_ENV === "production") {
      request.log.warn(
        {
          event: "security.sql_injection_blocked",
          method: request.method,
          url: request.url,
          ip: request.ip,
          userAgent: request.headers["user-agent"]
        },
        "Blocked request by SQL injection protection"
      );
    }

    await services.auditRepository.log({
      type: "security_sqli_blocked",
      actorType: "system",
      ip: request.ip,
      metadata: {
        method: request.method,
        url: request.url,
        userAgent: request.headers["user-agent"]
      }
    });
    await services.eventHookService.emit("security.sqli_blocked", {
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers["user-agent"]
    });

    return reply.status(400).send({
      error: "invalid_request",
      message: "Request blocked by SQL injection protection"
    });
  });

  await registerRoutes(app, services);

  return app;
};
