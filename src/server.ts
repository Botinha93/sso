import { buildApp } from "./app.js";
import { loadConfig } from "./core/config.js";
import { pathToFileURL } from "node:url";

export const startServer = async () => {
  const config = loadConfig();
  const app = await buildApp();

  try {
    await app.listen({
      port: config.port,
      host: config.host
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startServer();
}
