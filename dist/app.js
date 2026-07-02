import Fastify from "fastify";
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
const parseBasicAuthClient = (authorization) => {
    const header = Array.isArray(authorization) ? authorization[0] : authorization;
    if (!header || !header.toLowerCase().startsWith("basic ")) {
        return undefined;
    }
    try {
        const decoded = Buffer.from(header.slice("basic ".length).trim(), "base64").toString("utf8");
        const separator = decoded.indexOf(":");
        if (separator <= 0) {
            return undefined;
        }
        const clientId = decoded.slice(0, separator);
        return clientId.length > 0 ? clientId : undefined;
    }
    catch {
        return undefined;
    }
};
export const emitStartupConfigWarnings = async (app, instanceSettingsService) => {
    const settings = await instanceSettingsService.getSettings();
    if (settings.allowImplicitFlow) {
        app.log.warn({
            setting: "allowImplicitFlow",
            value: true,
            recommendation: "Disable allowImplicitFlow and use authorization_code + PKCE for user-facing apps."
        }, "Startup security warning: implicit flow is enabled");
    }
};
export const buildApp = async () => {
    const config = loadConfig();
    const app = Fastify({ logger: process.env.NODE_ENV !== "test", trustProxy: config.trustProxy });
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
        origin(origin, callback) {
            services.instanceSettingsService
                .isCorsOriginAllowed(origin)
                .then((allowed) => callback(null, allowed))
                .catch((error) => callback(error, false));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    });
    await app.register(rateLimit, {
        max: 100,
        timeWindow: "1 minute",
        // Run after body parsing so the OAuth client_id is available when keying.
        hook: "preHandler",
        keyGenerator: (req) => {
            const ip = req.ip ?? "unknown";
            const body = (req.body ?? {});
            const bodyClientId = typeof body.client_id === "string" && body.client_id.length > 0
                ? body.client_id
                : typeof body.clientId === "string" && body.clientId.length > 0
                    ? body.clientId
                    : undefined;
            if (bodyClientId) {
                // Bucket per OAuth client + IP so one client hitting its limit does
                // not block other clients sharing the same egress IP (NAT/proxy).
                return `client:${bodyClientId}|ip:${ip}`;
            }
            const basic = parseBasicAuthClient(req.headers.authorization);
            if (basic) {
                return `client:${basic}|ip:${ip}`;
            }
            const sid = req.cookies?.sid;
            if (sid) {
                return `sid:${sid}|ip:${ip}`;
            }
            return `ip:${ip}`;
        }
    });
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
            request.log.warn({
                event: "security.sql_injection_blocked",
                method: request.method,
                url: request.url,
                ip: request.ip,
                userAgent: request.headers["user-agent"]
            }, "Blocked request by SQL injection protection");
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
