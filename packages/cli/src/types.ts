export interface BasicAuth {
  user: string;
  pass: string;
}

export interface PersistedSession {
  slug: string;
  token: string;
  localPort: number;
  publicUrl: string;
  edgeUrl: string;
  expiresAt: string;
  pid: number;
  startedAt: string;
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

export interface StreamOpenPayload {
  method: string;
  url: string;
  headers: Record<string, string | string[]>;
  remoteAddr: string;
}

export interface ResponseInitPayload {
  statusCode: number;
  headers: Record<string, string | string[]>;
}

export interface AuthPayload {
  slug: string;
  token: string;
  version: string;
}

export interface AuthOkPayload {
  slug: string;
  publicUrl: string;
  expiresAt: string;
}

export interface AuthErrPayload {
  code: string;
  message: string;
}

export interface ViewerCountPayload {
  count: number;
}

export interface GoAwayPayload {
  reason: string;
}

export interface StreamRstPayload {
  code: number;
  reason: string;
}

export type ConnectionState =
  | { status: "disconnected" }
  | { status: "connecting" }
  | { status: "connected"; slug: string; publicUrl: string }
  | { status: "reconnecting"; attempt: number }
  | { status: "error"; message: string };
