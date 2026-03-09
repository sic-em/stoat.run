export const EASING = [0.32, 0.72, 0, 1] as const;

export const OVERLAY_TRANSITION = { duration: 0.24, ease: EASING } as const;

export const DRAWER_MIN_WIDTH = 820;
export const DEFAULT_BOTTOM_OFFSET = 24;
export const EDGE_MARGIN = 12;
export const STORAGE_KEY = 'stoat:overlay-preview:position';
export const COPY_RESET_MS = 1500;

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const getStatusVariant = (status: number): 'destructive' | 'outline' | 'secondary' => {
  if (status >= 400) return 'destructive';
  if (status >= 300) return 'outline';
  return 'secondary';
};

export const formatDetailMap = (value: unknown): string => {
  if (!value || typeof value !== 'object') return 'none';
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return 'none';

  return entries
    .map(([key, raw]) => {
      if (Array.isArray(raw)) {
        return `${key}: ${raw.map((item) => String(item)).join(', ')}`;
      }
      if (raw === null || raw === undefined) return `${key}: none`;
      if (typeof raw === 'object') return `${key}: ${JSON.stringify(raw)}`;
      return `${key}: ${String(raw)}`;
    })
    .join('\n');
};
