export interface ControlPlaneConfig {
  port: number;
  edgeBase: string;
  publicBase: string;
  defaultExpirySecs: number;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sanitizeBase(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ControlPlaneConfig {
  return {
    port: parsePositiveInt(env.PORT, 4000),
    edgeBase: sanitizeBase(
      env.STOAT_EDGE_BASE ?? "wss://edge.discova.us",
      "wss://edge.discova.us"
    ),
    publicBase: sanitizeBase(
      (env.STOAT_PUBLIC_BASE ?? "https://{slug}.discova.us").replace(
        /\s+/g,
        ""
      ),
      "https://{slug}.discova.us"
    ),
    defaultExpirySecs: parsePositiveInt(env.DEFAULT_EXPIRY_SECS, 86400),
  };
}
