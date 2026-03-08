import type { SessionStore } from "./store.js";
import type { SessionToken, Slug } from "./types.js";
import { asSessionToken, asSlug } from "./types.js";

export type TokenValidationResult = "ok" | "not_found" | "invalid_token";

export function validateToken(
  slug: string | Slug,
  token: string | SessionToken,
  store: SessionStore
): TokenValidationResult {
  const session = store.get(asSlug(slug));
  if (!session) return "not_found";
  if (session.token !== asSessionToken(token)) return "invalid_token";
  return "ok";
}
