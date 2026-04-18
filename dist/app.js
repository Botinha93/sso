import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import { config } from "./core/config.js";
import { registerRoutes } from "./http/routes.js";
import { bootstrap } from "./bootstrap.js";
export const buildApp = async () => {
    const app = Fastify({ logger: true });
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
        origin: process.env.CORS_ORIGIN ?? true,
        credentials: true,
        methods: ["GET", "POST", "OPTIONS"]
    });
    await app.register(rateLimit, {
        max: 100,
        timeWindow: "1 minute",
        // Stricter limit for sensitive auth endpoints
        keyGenerator: (req) => req.ip
    });
    const services = await bootstrap(config);
    await registerRoutes(app, services);
    return app;
};
