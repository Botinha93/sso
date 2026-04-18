import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import { config } from "./core/config.js";
import { registerRoutes } from "./http/routes.js";
import { bootstrap } from "./bootstrap.js";
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
    await registerRoutes(app, services);
    return app;
};
