import Fastify from "fastify";
import { config } from "./core/config.js";
import { registerRoutes } from "./http/routes.js";
import { bootstrap } from "./bootstrap.js";
export const buildApp = async () => {
    const app = Fastify({
        logger: true
    });
    const services = await bootstrap(config);
    await registerRoutes(app, services);
    return app;
};
