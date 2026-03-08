import type { Session } from "./types.js";

export function isExpired(session: Session): boolean {
  return session.expiresAt < new Date();
}

export function formatExpiresAt(session: Session): string {
  return session.expiresAt.toISOString();
}
