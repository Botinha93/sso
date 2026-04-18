import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import { config } from "./core/config.js";
import { registerRoutes } from "./http/routes.js";
import { bootstrap } from "./bootstrap.js";
import { hasSqlInjectionPayload } from "./http/sql-injection-guard.js";

export const buildApp = async () => {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test", trustProxy: true });
  const services = await bootstrap(config);

  app.addHook("onRequest", async (request, reply) => {
    if (!services.instanceSettingsService.shouldRequireHttps()) {
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
      message: "HTTPS is required in production"
    });
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
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
  await app.register(cookie, { secret: process.env.COOKIE_SECRET ?? "northstar-sso-cookie-secret" });
  await app.register(cors, {
    origin(origin, callback) {
      callback(null, services.instanceSettingsService.isCorsOriginAllowed(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    // Stricter limit for sensitive auth endpoints
    keyGenerator: (req) => req.ip
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

    services.auditRepository.log({
      type: "security_sqli_blocked",
      actorType: "system",
      ip: request.ip,
      metadata: {
        method: request.method,
        url: request.url,
        userAgent: request.headers["user-agent"]
      }
    });

    return reply.status(400).send({
      error: "invalid_request",
      message: "Request blocked by SQL injection protection"
    });
  });

  await registerRoutes(app, services);

  return app;
};
