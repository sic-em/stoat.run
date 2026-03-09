export type OverlayPosition = Readonly<{
  x: number;
  y: number;
}>;

export type OverlayEventError = Readonly<{
  code?: string;
  message?: string;
}>;

export type OverlayRequestEvent = Readonly<{
  id: string;
  ts: string;
  method: string;
  path: string;
  query?: Record<string, unknown>;
  status: number;
  latencyMs: number;
  reqBytes: number;
  resBytes: number;
  userAgent?: string | null;
  traceId?: string | null;
  error?: OverlayEventError | null;
  headers?: Record<string, string>;
}>;

export type OverlayEventRowModel = Readonly<{
  event: OverlayRequestEvent;
  time: string;
  expanded: boolean;
}>;
