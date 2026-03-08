import type { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { loadConfig } from "../config.js";
import type { SessionStore } from "../store.js";
import { generateUniqueSlug } from "../slug.js";
import { validateToken } from "../auth.js";
import { isExpired, formatExpiresAt } from "../expiry.js";
import type {
  SessionErrorFor,
  SessionCreateRequest,
  SessionCreateResponse,
  SessionGetResponse,
  Slug,
} from "../types.js";
import { asSessionToken, asSlug } from "../types.js";

interface SlugParams {
  slug: string;
}

interface TokenQuery {
  token?: string;
}

type CreateReplyByStatus = {
  201: SessionCreateResponse;
  409: SessionErrorFor<"slug_taken">;
};

type GetReplyByStatus = {
  200: SessionGetResponse;
  400: SessionErrorFor<"token_required">;
  403: SessionErrorFor<"invalid_token">;
  404: SessionErrorFor<"session_not_found">;
};

type DeleteReplyByStatus = {
  204: undefined;
  400: SessionErrorFor<"token_required">;
  403: SessionErrorFor<"invalid_token">;
  404: SessionErrorFor<"session_not_found">;
};

export async function sessionRoutes(
  app: FastifyInstance,
  { store }: { store: SessionStore }
): Promise<void> {
  const config = loadConfig();

  const makePublicUrl = (slug: Slug): string => {
    if (config.publicBase.includes("{slug}")) {
      return config.publicBase.replace("{slug}", slug);
    }
    const base = config.publicBase.replace(/\/$/, "");
    return base.replace("://", `://${slug}.`);
  };

  // POST /sessions
  app.post<{ Body: SessionCreateRequest; Reply: CreateReplyByStatus }>(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["localPort"],
          properties: {
            localPort: { type: "number" },
            desiredSlug: { type: "string", nullable: true },
            basicAuth: {
              type: "object",
              nullable: true,
              properties: {
                user: { type: "string" },
                pass: { type: "string" },
              },
              required: ["user", "pass"],
            },
            expiresIn: { type: "number" },
          },
        },
      },
    },
    async (req, reply) => {
      const { localPort, desiredSlug, basicAuth, expiresIn } = req.body;
      const expirySeconds = expiresIn ?? config.defaultExpirySecs;
      const expiresAt = new Date(Date.now() + expirySeconds * 1000);

      let slug: Slug;
      if (desiredSlug) {
        const desired = asSlug(desiredSlug);
        if (store.has(desired)) {
          return reply.status(409).send({ error: "slug_taken" });
        }
        slug = desired;
      } else {
        slug = generateUniqueSlug(store);
      }

      const token = asSessionToken(uuidv4());
      const session = {
        slug,
        token,
        localPort,
        basicAuth: basicAuth ?? null,
        expiresAt,
        createdAt: new Date(),
      };
      store.create(session);

      const response: SessionCreateResponse = {
        slug,
        token,
        edgeUrl: `${config.edgeBase}/tunnel`,
        publicUrl: makePublicUrl(slug),
        expiresAt: expiresAt.toISOString(),
        basicAuth: basicAuth ?? null,
      };

      return reply.status(201).send(response);
    }
  );

  // GET /sessions/:slug
  app.get<{
    Params: SlugParams;
    Querystring: TokenQuery;
    Reply: GetReplyByStatus;
  }>(
    "/:slug",
    async (req, reply) => {
      const slug = asSlug(req.params.slug);
      const { token } = req.query;

      if (!token) {
        return reply.status(400).send({ error: "token_required" });
      }

      const result = validateToken(slug, token, store);
      if (result === "not_found") {
        return reply.status(404).send({ error: "session_not_found" });
      }
      if (result === "invalid_token") {
        return reply.status(403).send({ error: "invalid_token" });
      }

      const session = store.get(slug);
      if (!session) {
        return reply.status(404).send({ error: "session_not_found" });
      }
      const response: SessionGetResponse = {
        slug: session.slug,
        expiresAt: formatExpiresAt(session),
        basicAuth: session.basicAuth,
        active: !isExpired(session),
      };

      return reply.status(200).send(response);
    }
  );

  // DELETE /sessions/:slug
  app.delete<{
    Params: SlugParams;
    Querystring: TokenQuery;
    Reply: DeleteReplyByStatus;
  }>(
    "/:slug",
    async (req, reply) => {
      const slug = asSlug(req.params.slug);
      const { token } = req.query;

      if (!token) {
        return reply.status(400).send({ error: "token_required" });
      }

      const result = validateToken(slug, token, store);
      if (result === "not_found") {
        return reply.status(404).send({ error: "session_not_found" });
      }
      if (result === "invalid_token") {
        return reply.status(403).send({ error: "invalid_token" });
      }

      store.delete(slug);
      return reply.status(204).send(undefined);
    }
  );
}
