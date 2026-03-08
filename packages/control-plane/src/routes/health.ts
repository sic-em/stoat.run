import type { FastifyInstance } from "fastify";
import type { SessionStore } from "../store.js";

export async function healthRoutes(
  app: FastifyInstance,
  { store }: { store: SessionStore }
): Promise<void> {
  app.get("/healthz", async (_req, reply) => {
    return reply.send({ status: "ok", sessions: store.count() });
  });
}
