type Brand<T, B extends string> = T & { readonly __brand: B };

export interface BasicAuth {
  user: string;
  pass: string;
}

export type Slug = Brand<string, "Slug">;
export type SessionToken = Brand<string, "SessionToken">;

export interface Session {
  slug: Slug;
  token: SessionToken;
  localPort: number;
  basicAuth: BasicAuth | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface SessionCreateRequest {
  localPort: number;
  desiredSlug?: string | null;
  basicAuth?: BasicAuth | null;
  expiresIn?: number;
}

export interface SessionCreateResponse {
  slug: string;
  token: string;
  edgeUrl: string;
  publicUrl: string;
  expiresAt: string;
  basicAuth: BasicAuth | null;
}

export interface SessionGetResponse {
  slug: string;
  expiresAt: string;
  basicAuth: BasicAuth | null;
  active: boolean;
}

export type SessionErrorCode =
  | "token_required"
  | "slug_taken"
  | "session_not_found"
  | "invalid_token";

export interface SessionErrorResponse {
  error: SessionErrorCode;
}

export type SessionErrorFor<TCode extends SessionErrorCode> = {
  error: TCode;
};

export function asSlug(value: string): Slug {
  return value as Slug;
}

export function asSessionToken(value: string): SessionToken {
  return value as SessionToken;
}
