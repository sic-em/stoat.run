import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadConfig } from "./config.js";
import { SessionStore } from "./store.js";
import { sessionRoutes } from "./routes/sessions.js";
import { healthRoutes } from "./routes/health.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const store = new SessionStore();
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(healthRoutes, { store });
  await app.register(sessionRoutes, { prefix: "/sessions", store });
  app.addHook("onClose", async () => {
    store.destroy();
  });

  await app.listen({ port: config.port, host: "0.0.0.0" });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
