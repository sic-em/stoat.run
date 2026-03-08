import type { Session, Slug } from "./types.js";
import { asSlug } from "./types.js";

export class SessionStore {
  private readonly map = new Map<Slug, Session>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60_000);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  create(session: Session): void {
    this.map.set(session.slug, session);
  }

  get(slug: string | Slug): Session | undefined {
    return this.map.get(asSlug(slug));
  }

  delete(slug: string | Slug): boolean {
    return this.map.delete(asSlug(slug));
  }

  has(slug: string | Slug): boolean {
    return this.map.has(asSlug(slug));
  }

  count(): number {
    return this.map.size;
  }

  private cleanup(): void {
    const now = new Date();
    for (const [slug, session] of this.map) {
      if (session.expiresAt < now) {
        this.map.delete(slug);
      }
    }
  }

  destroy(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
    }
  }
}
