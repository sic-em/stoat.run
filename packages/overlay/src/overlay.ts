import logoDataUrl from "./assets/logo.webp";

type OverlayState = Readonly<{
  x: number | null;
  y: number | null;
}>;

type ViewerResponse = Readonly<{
  count?: number;
}>;

type OverlayEventError = Readonly<{
  code?: string;
  message?: string;
}>;

type OverlayRequestEvent = Readonly<{
  id: string;
  ts: string;
  slug: string;
  method: string;
  path: string;
  query?: Record<string, unknown>;
  status: number;
  latencyMs: number;
  reqBytes: number;
  resBytes: number;
  clientIpHash?: string | null;
  userAgent?: string | null;
  traceId?: string | null;
  error?: OverlayEventError | null;
  headers?: Record<string, string>;
  redacted?: boolean;
}>;

const DEFAULT_STATE: OverlayState = Object.freeze({
  x: null,
  y: null,
});

const STORAGE_PREFIX = "stoat:overlay:";
const COPY_RESET_MS = 1500;
const VIEWERS_POLL_MS = 5000;
const DEFAULT_BOTTOM_OFFSET = 24;
const EDGE_MARGIN = 12;
const DRAG_MARGIN = 10;
const MAX_EVENTS = 200;
const STREAM_RETRY_MAX_MS = 15000;
const DRAWER_MIN_WIDTH = 820;

const INLINE_STYLES = `
:host {
  all: initial;
  color-scheme: light;
}

.stoat-wrap {
  position: fixed;
  z-index: 2147483647;
  width: max-content;
  user-select: none;
  touch-action: none;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
  font-family: "IBM Plex Sans", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  transition:
    opacity 240ms cubic-bezier(0.32, 0.72, 0, 1),
    transform 240ms cubic-bezier(0.32, 0.72, 0, 1),
    width 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

.stoat-wrap.is-closing {
  opacity: 0;
  transform: translateY(20px) scale(0.97);
}

.stoat-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  color: #0f172a;
  padding: 6px 12px;
  box-shadow:
    0 10px 15px -3px rgba(15, 23, 42, 0.1),
    0 4px 6px -4px rgba(15, 23, 42, 0.1);
  cursor: grab;
}

.stoat-bar.is-grabbing {
  cursor: grabbing;
}

.stoat-logo {
  width: 36px;
  height: 36px;
  object-fit: contain;
  display: block;
  flex-shrink: 0;
  pointer-events: none;
}

.stoat-btn {
  min-height: 32px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition:
    color 180ms cubic-bezier(0.32, 0.72, 0, 1),
    background-color 180ms cubic-bezier(0.32, 0.72, 0, 1),
    transform 120ms cubic-bezier(0.32, 0.72, 0, 1);
}

.stoat-btn-icon {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stoat-btn:hover {
  color: #0f172a;
  background: #f1f5f9;
}

.stoat-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px #0f172a;
}

.stoat-btn:active {
  transform: scale(0.97);
}

.stoat-copy-icons {
  position: relative;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.stoat-copy-icon {
  position: absolute;
  inset: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    opacity 160ms cubic-bezier(0.32, 0.72, 0, 1),
    transform 160ms cubic-bezier(0.32, 0.72, 0, 1);
}

.stoat-copy-icon-copy {
  opacity: 1;
  transform: scale(1);
}

.stoat-copy-icon-check {
  opacity: 0;
  transform: scale(0.94);
}

.stoat-btn.copy.copied .stoat-copy-icon-copy {
  opacity: 0;
  transform: scale(0.94);
}

.stoat-btn.copy.copied .stoat-copy-icon-check {
  opacity: 1;
  transform: scale(1);
}

.stoat-divider {
  width: 1px;
  height: 12px;
  margin: 0 2px;
  background: #e2e8f0;
}

.stoat-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #16a34a;
  font-size: 12px;
}

.stoat-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #22c55e;
}

.stoat-viewers {
  margin-left: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #64748b;
  font-size: 12px;
}

.stoat-viewers-icon {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.stoat-debug-pill {
  margin-left: 2px;
}

.stoat-feedback {
  position: fixed;
  left: 50%;
  bottom: 78px;
  transform: translateX(-50%) translateY(4px);
  z-index: 2147483647;
  border-radius: 8px;
  padding: 6px 10px;
  background: #0f172a;
  color: #f8fafc;
  font-size: 11px;
  line-height: 1.2;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 140ms cubic-bezier(0.32, 0.72, 0, 1),
    transform 140ms cubic-bezier(0.32, 0.72, 0, 1);
}

.stoat-feedback.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.stoat-drawer {
  position: absolute;
  left: 0;
  bottom: calc(100% - 1px);
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e2e8f0;
  border-bottom: 0;
  border-radius: 12px 12px 0 0;
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 12px 18px -8px rgba(15, 23, 42, 0.2);
  opacity: 0;
  transform: translateY(6px);
  clip-path: inset(98% 0 0 0 round 12px 12px 0 0);
  pointer-events: none;
  transition:
    opacity 220ms cubic-bezier(0.32, 0.72, 0, 1),
    transform 220ms cubic-bezier(0.32, 0.72, 0, 1),
    clip-path 220ms cubic-bezier(0.32, 0.72, 0, 1);
}

.stoat-drawer.open {
  opacity: 1;
  transform: translateY(0);
  clip-path: inset(0 0 0 0 round 12px 12px 0 0);
  pointer-events: auto;
}

.stoat-wrap.drawer-open .stoat-bar {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.stoat-drawer-actions {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid #e2e8f0;
  cursor: grab;
}

.stoat-events {
  height: 260px;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  font-size: 11px;
}

.stoat-wrap.is-grabbing .stoat-drawer-actions {
  cursor: grabbing;
}

.stoat-events-empty {
  padding: 16px 12px;
  color: #94a3b8;
}

.stoat-event-item {
  border-bottom: 1px solid #f1f5f9;
}

.stoat-event-item:last-child {
  border-bottom: 0;
}

.stoat-event-toggle {
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  display: grid;
  grid-template-columns: 66px 50px 1fr 60px 60px;
  gap: 8px;
  padding: 7px 12px;
  align-items: center;
  text-align: left;
  cursor: pointer;
  font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
}

.stoat-event-toggle:hover {
  background: #f8fafc;
}

.stoat-event-toggle:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px #0f172a;
}

.stoat-event-details {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition:
    max-height 220ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 180ms cubic-bezier(0.32, 0.72, 0, 1);
}

.stoat-event-item.expanded .stoat-event-details {
  max-height: 220px;
  opacity: 1;
}

.stoat-event-details-inner {
  padding: 0 12px 10px 12px;
  font-size: 11px;
  line-height: 1.4;
  color: #475569;
  font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
}

.stoat-event-meta {
  margin-top: 4px;
  display: grid;
  grid-template-columns: 68px 1fr;
  gap: 4px 8px;
  white-space: pre-wrap;
  word-break: break-word;
}

.stoat-event-meta-key {
  color: #64748b;
}

.stoat-badge-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 10px;
  padding: 2px 6px;
  border: 1px solid #e2e8f0;
}

.stoat-badge-status.s2 {
  background: #ecfdf5;
  border-color: #bbf7d0;
  color: #166534;
}

.stoat-badge-status.s3 {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.stoat-badge-status.s4,
.stoat-badge-status.s5 {
  background: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
}

.stoat-latency-slow {
  color: #b45309;
  font-weight: 600;
}

.stoat-metrics {
  white-space: nowrap;
}

@media (max-width: 900px) {
  .stoat-events { height: 220px; }
  .stoat-event-toggle {
    grid-template-columns: 60px 42px 1fr 52px 52px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stoat-wrap,
  .stoat-btn,
  .stoat-copy-icon,
  .stoat-feedback,
  .stoat-drawer {
    transition: none;
  }
  .stoat-event-details {
    transition: none;
  }
}
`;

const EYE_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
  <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
</svg>
`;

const COPY_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667v-8.666" />
  <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
</svg>
`;

const CHECK_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
  <path d="M20.707 6.293a1 1 0 0 1 0 1.414l-10 10a1 1 0 0 1 -1.414 0l-5 -5a1 1 0 0 1 1.414 -1.414l4.293 4.293l9.293 -9.293a1 1 0 0 1 1.414 0" />
</svg>
`;

const TRASH_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
  <path d="M4 7l16 0" />
  <path d="M10 11l0 6" />
  <path d="M14 11l0 6" />
  <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
  <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
</svg>
`;

const BUG_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
  <path d="M9 9v-1a3 3 0 0 1 6 0v1" />
  <path d="M8 9h8a6 6 0 0 1 1 3v3a5 5 0 0 1 -10 0v-3a6 6 0 0 1 1 -3" />
  <path d="M3 13l4 0" />
  <path d="M17 13l4 0" />
  <path d="M12 20l0 -6" />
  <path d="M4 19l3.35 -2" />
  <path d="M20 19l-3.35 -2" />
  <path d="M4 7l3.75 2.4" />
  <path d="M20 7l-3.75 2.4" />
</svg>
`;

const TUNNEL_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
  <path d="M20 16l-4 4" />
  <path d="M7 12l5 5l-1.5 1.5a3.536 3.536 0 1 1 -5 -5l1.5 -1.5" />
  <path d="M17 12l-5 -5l1.5 -1.5a3.536 3.536 0 1 1 5 5l-1.5 1.5" />
  <path d="M3 21l2.5 -2.5" />
  <path d="M18.5 5.5l2.5 -2.5" />
  <path d="M10 11l-2 2" />
  <path d="M13 14l-2 2" />
  <path d="M16 16l4 4" />
</svg>
`;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const getViewerCount = (value: unknown): number | null => {
  if (!value || typeof value !== "object") return null;
  const count = (value as ViewerResponse).count;
  return isFiniteNumber(count) ? count : null;
};

const toEventError = (value: unknown): OverlayEventError | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const code = typeof candidate.code === "string" ? candidate.code : undefined;
  const message = typeof candidate.message === "string" ? candidate.message : undefined;
  if (!code && !message) return null;
  return { code, message };
};

const toOverlayEvent = (value: unknown): OverlayRequestEvent | null => {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const id = typeof v.id === "string" ? v.id : "";
  const ts = typeof v.ts === "string" ? v.ts : new Date().toISOString();
  const slug = typeof v.slug === "string" ? v.slug : "";
  const method = typeof v.method === "string" ? v.method.toUpperCase() : "GET";
  const path = typeof v.path === "string" ? v.path : "/";
  const status = isFiniteNumber(v.status) ? v.status : 0;
  const latencyMs = isFiniteNumber(v.latencyMs) ? v.latencyMs : 0;
  const reqBytes = isFiniteNumber(v.reqBytes) ? v.reqBytes : 0;
  const resBytes = isFiniteNumber(v.resBytes) ? v.resBytes : 0;
  if (!id || !slug || !status) return null;

  return {
    id,
    ts,
    slug,
    method,
    path,
    query: typeof v.query === "object" && v.query !== null ? (v.query as Record<string, unknown>) : {},
    status,
    latencyMs,
    reqBytes,
    resBytes,
    clientIpHash: typeof v.clientIpHash === "string" ? v.clientIpHash : null,
    userAgent: typeof v.userAgent === "string" ? v.userAgent : null,
    traceId: typeof v.traceId === "string" ? v.traceId : null,
    error: toEventError(v.error),
    headers: typeof v.headers === "object" && v.headers !== null ? (v.headers as Record<string, string>) : {},
    redacted: Boolean(v.redacted),
  };
};

const loadState = (storageKey: string): OverlayState => {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_STATE;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_STATE;

    const candidate = parsed as Partial<Record<"x" | "y", unknown>>;
    return {
      x: isFiniteNumber(candidate.x) ? candidate.x : null,
      y: isFiniteNumber(candidate.y) ? candidate.y : null,
    };
  } catch {
    return DEFAULT_STATE;
  }
};

const saveState = (storageKey: string, state: OverlayState): void => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
};

const escapeHTML = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getStatusClass = (status: number): string => {
  if (status >= 500) return "s5";
  if (status >= 400) return "s4";
  if (status >= 300) return "s3";
  return "s2";
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}b`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}kb`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}mb`;
};

const formatDetailMap = (value: unknown): string => {
  if (!value || typeof value !== "object") return "none";
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "none";

  return entries
    .map(([key, raw]) => {
      if (Array.isArray(raw)) {
        return `${key}: ${raw.map((item) => String(item)).join(", ")}`;
      }
      if (raw === null || raw === undefined) {
        return `${key}: none`;
      }
      if (typeof raw === "object") {
        return `${key}: ${JSON.stringify(raw)}`;
      }
      return `${key}: ${String(raw)}`;
    })
    .join("\n");
};

(function bootstrapOverlay() {
  const scriptTag = document.currentScript as HTMLScriptElement | null;
  if (!scriptTag) return;

  const slug =
    new URL(scriptTag.src).searchParams.get("slug") ??
    scriptTag.getAttribute("data-slug");
  if (!slug || !document.body) return;

  const storageKey = `${STORAGE_PREFIX}${slug}`;
  const host = document.createElement("div");
  host.id = "__stoat_overlay__";

  const shadowRoot = host.attachShadow({ mode: "closed" });
  shadowRoot.innerHTML = `
    <style id="stoat-style">${INLINE_STYLES}</style>
    <div class="stoat-wrap" id="wrap">
      <div class="stoat-drawer" id="drawer">
        <div class="stoat-drawer-actions">
          <button class="stoat-btn" id="clearEvents" type="button">
            <span class="stoat-btn-icon" aria-hidden="true">${TRASH_ICON}</span>
            <span>Clear</span>
          </button>
          <button class="stoat-btn" id="copyVisible" type="button">Copy Visible</button>
        </div>

        <div class="stoat-events" id="eventsList">
          <div class="stoat-events-empty" id="eventsEmpty">Waiting for events...</div>
        </div>
      </div>

      <div class="stoat-bar" id="bar" role="region" aria-label="Tunnel overlay">
        <img class="stoat-logo" src="${logoDataUrl}" alt="stoat" width="36" height="36" draggable="false" />

        <button class="stoat-btn copy" id="copy" type="button">
          <span class="stoat-copy-icons" aria-hidden="true">
            <span class="stoat-copy-icon stoat-copy-icon-copy">${COPY_ICON}</span>
            <span class="stoat-copy-icon stoat-copy-icon-check">${CHECK_ICON}</span>
          </span>
          <span id="copyLabel">Copy URL</span>
        </button>

        <button class="stoat-btn stoat-debug-pill" id="debugToggle" type="button" aria-expanded="false">
          <span class="stoat-btn-icon" aria-hidden="true">${BUG_ICON}</span>
          <span id="debugLabel">Debug</span>
        </button>
        <button class="stoat-btn" id="close" type="button">
          <span class="stoat-btn-icon" aria-hidden="true">${TUNNEL_ICON}</span>
          <span>Close Tunnel</span>
        </button>

        <span class="stoat-divider" aria-hidden="true"></span>

        <span class="stoat-status" aria-live="polite">
          <span class="stoat-status-dot" aria-hidden="true"></span>
          Connected
        </span>

        <span class="stoat-viewers" aria-label="Viewers">
          <span class="stoat-viewers-icon" aria-hidden="true">${EYE_ICON}</span>
          <span id="viewers">0</span>
        </span>
      </div>
    </div>

    <div class="stoat-feedback" id="feedback" role="status" aria-live="polite"></div>
  `;

  document.body.appendChild(host);

  const wrap = shadowRoot.getElementById("wrap");
  const bar = shadowRoot.getElementById("bar");
  const viewersEl = shadowRoot.getElementById("viewers");
  const copyButton = shadowRoot.getElementById("copy");
  const copyLabel = shadowRoot.getElementById("copyLabel");
  const closeButton = shadowRoot.getElementById("close");
  const debugToggle = shadowRoot.getElementById("debugToggle");
  const debugLabel = shadowRoot.getElementById("debugLabel");
  const drawer = shadowRoot.getElementById("drawer");
  const clearEventsBtn = shadowRoot.getElementById("clearEvents");
  const copyVisibleBtn = shadowRoot.getElementById("copyVisible");
  const eventsList = shadowRoot.getElementById("eventsList");
  const feedback = shadowRoot.getElementById("feedback");

  if (
    !(wrap instanceof HTMLDivElement) ||
    !(bar instanceof HTMLDivElement) ||
    !(viewersEl instanceof HTMLSpanElement) ||
    !(copyButton instanceof HTMLButtonElement) ||
    !(copyLabel instanceof HTMLSpanElement) ||
    !(closeButton instanceof HTMLButtonElement) ||
    !(debugToggle instanceof HTMLButtonElement) ||
    !(debugLabel instanceof HTMLSpanElement) ||
    !(drawer instanceof HTMLDivElement) ||
    !(clearEventsBtn instanceof HTMLButtonElement) ||
    !(copyVisibleBtn instanceof HTMLButtonElement) ||
    !(eventsList instanceof HTMLDivElement) ||
    !(feedback instanceof HTMLDivElement)
  ) {
    host.remove();
    return;
  }

  let state = loadState(storageKey);
  let isDragging = false;
  let isPressingDragArea = false;
  let copyResetTimer: number | null = null;
  let feedbackTimer: number | null = null;
  let viewersTimer: number | null = null;
  let reconnectTimer: number | null = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let drawerOpen = false;
  let eventSource: EventSource | null = null;
  let reconnectDelay = 1000;
  let baseWrapWidth = 0;

  const events: OverlayRequestEvent[] = [];
  const expandedEventIds = new Set<string>();

  const updateDragCursor = (): void => {
    bar.classList.toggle("is-grabbing", isDragging || isPressingDragArea);
    wrap.classList.toggle("is-grabbing", isDragging || isPressingDragArea);
  };

  const getWrapRect = (): DOMRect => wrap.getBoundingClientRect();

  const setPosition = (x: number, y: number): void => {
    wrap.style.left = `${x}px`;
    wrap.style.top = `${y}px`;
  };

  const getCurrentPosition = (): { x: number; y: number } => {
    const rect = getWrapRect();
    const x = Number.parseFloat(wrap.style.left);
    const y = Number.parseFloat(wrap.style.top);
    return {
      x: Number.isFinite(x) ? x : rect.left,
      y: Number.isFinite(y) ? y : rect.top,
    };
  };

  const measureBaseWrapWidth = (): void => {
    const previousWidth = wrap.style.width;
    wrap.style.width = "max-content";
    const measured = Math.ceil(bar.getBoundingClientRect().width);
    if (measured > 0) {
      baseWrapWidth = measured;
    }
    wrap.style.width = previousWidth;
  };

  const applyWrapWidth = (): void => {
    if (!baseWrapWidth) {
      measureBaseWrapWidth();
    }
    const targetWidth = drawerOpen
      ? Math.max(baseWrapWidth, DRAWER_MIN_WIDTH)
      : baseWrapWidth;
    if (targetWidth > 0) {
      wrap.style.width = `${targetWidth}px`;
    }
  };

  const getTopGuardOffset = (openState: boolean): number => {
    if (!openState) return 0;
    const drawerHeight = Math.ceil(drawer.getBoundingClientRect().height);
    return Math.max(0, drawerHeight - 1);
  };

  const getDragBounds = (
    rect: DOMRect,
    margin: number,
    openState: boolean = drawerOpen,
  ): { minX: number; maxX: number; minY: number; maxY: number } => {
    const minX = margin;
    const maxX = Math.max(minX, window.innerWidth - rect.width - margin);
    const minY = margin + getTopGuardOffset(openState);
    const maxY = Math.max(minY, window.innerHeight - rect.height - margin);
    return { minX, maxX, minY, maxY };
  };

  const savePosition = (x: number, y: number): void => {
    state = { x, y };
    saveState(storageKey, state);
  };

  const placeByState = (): void => {
    const rect = getWrapRect();
    const bounds = getDragBounds(rect, EDGE_MARGIN);

    const x =
      state.x === null
        ? clamp((window.innerWidth - rect.width) / 2, bounds.minX, bounds.maxX)
        : clamp(state.x, bounds.minX, bounds.maxX);

    const y =
      state.y === null
        ? clamp(window.innerHeight - rect.height - DEFAULT_BOTTOM_OFFSET, bounds.minY, bounds.maxY)
        : clamp(state.y, bounds.minY, bounds.maxY);

    setPosition(x, y);
  };

  const showFeedback = (message: string): void => {
    feedback.textContent = message;
    feedback.classList.add("show");

    if (feedbackTimer !== null) {
      window.clearTimeout(feedbackTimer);
    }
    feedbackTimer = window.setTimeout(() => {
      feedback.classList.remove("show");
      feedbackTimer = null;
    }, 900);
  };

  const setCopied = (copied: boolean): void => {
    copyButton.classList.toggle("copied", copied);
    copyLabel.textContent = copied ? "Copied" : "Copy URL";
  };

  const renderEvents = (): void => {
    if (events.length === 0) {
      eventsList.innerHTML = '<div class="stoat-events-empty">Waiting for events...</div>';
      return;
    }

    const rows = events
      .map((event) => {
        const date = new Date(event.ts);
        const hh = String(date.getHours()).padStart(2, "0");
        const mm = String(date.getMinutes()).padStart(2, "0");
        const ss = String(date.getSeconds()).padStart(2, "0");
        const statusClass = getStatusClass(event.status);
        const slowClass = event.latencyMs > 800 ? "stoat-latency-slow" : "";
        const summary = `${escapeHTML(event.path)}${event.error?.message ? ` (${escapeHTML(event.error.message)})` : ""}`;

        const expanded = expandedEventIds.has(event.id);
        const queryText = escapeHTML(formatDetailMap(event.query));
        const headersText = escapeHTML(formatDetailMap(event.headers));
        const errorText = escapeHTML(
          event.error ? JSON.stringify(event.error, null, 2) : "none",
        );
        const traceText = escapeHTML(event.traceId ?? "none");
        const uaText = escapeHTML(event.userAgent ?? "none");
        const ipHashText = escapeHTML(event.clientIpHash ?? "none");

        return `<div class="stoat-event-item ${expanded ? "expanded" : ""}">
          <button
            class="stoat-event-toggle"
            type="button"
            data-event-id="${escapeHTML(event.id)}"
            aria-expanded="${expanded ? "true" : "false"}"
          >
            <span>${hh}:${mm}:${ss}</span>
            <span>${escapeHTML(event.method)}</span>
            <span title="${summary}">${summary}</span>
            <span class="stoat-badge-status ${statusClass}">${event.status}</span>
          <span class="stoat-metrics ${slowClass}">${event.latencyMs}ms</span>
        </button>
          <div class="stoat-event-details">
            <div class="stoat-event-details-inner">
              <div class="stoat-event-meta"><span class="stoat-event-meta-key">traceId</span><span>${traceText}</span></div>
              <div class="stoat-event-meta"><span class="stoat-event-meta-key">reqBytes</span><span>${event.reqBytes}</span></div>
              <div class="stoat-event-meta"><span class="stoat-event-meta-key">resBytes</span><span>${event.resBytes}</span></div>
              <div class="stoat-event-meta"><span class="stoat-event-meta-key">userAgent</span><span>${uaText}</span></div>
              <div class="stoat-event-meta"><span class="stoat-event-meta-key">client</span><span>${ipHashText}</span></div>
              <div class="stoat-event-meta"><span class="stoat-event-meta-key">query</span><span>${queryText}</span></div>
              <div class="stoat-event-meta"><span class="stoat-event-meta-key">headers</span><span>${headersText}</span></div>
              <div class="stoat-event-meta"><span class="stoat-event-meta-key">error</span><span>${errorText}</span></div>
            </div>
          </div>
        </div>`;
      })
      .join("");

    eventsList.innerHTML = rows;
  };

  const pushEvent = (event: OverlayRequestEvent): void => {
    events.unshift(event);
    if (events.length > MAX_EVENTS) {
      events.length = MAX_EVENTS;
    }
    renderEvents();
  };

  const clearReconnectTimer = (): void => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const closeEventStream = (): void => {
    clearReconnectTimer();
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };

  const scheduleReconnect = (): void => {
    if (!drawerOpen || reconnectTimer !== null) return;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      openEventStream();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, STREAM_RETRY_MAX_MS);
  };

  const openEventStream = (): void => {
    if (!drawerOpen) return;
    closeEventStream();

    const params = new URLSearchParams({ slug });
    const token = scriptTag.getAttribute("data-token") ?? "";
    if (token) params.set("token", token);

    const source = new EventSource(`/.stoat/events?${params.toString()}`);
    eventSource = source;

    source.onopen = () => {
      reconnectDelay = 1000;
    };

    source.addEventListener("request", (raw) => {
      const message = raw as MessageEvent<string>;
      let parsed: unknown;
      try {
        parsed = JSON.parse(message.data);
      } catch {
        return;
      }
      const event = toOverlayEvent(parsed);
      if (!event) return;
      pushEvent(event);
    });

    source.onerror = () => {
      if (eventSource === source) {
        eventSource.close();
        eventSource = null;
      }
      scheduleReconnect();
    };
  };

  const setDrawerOpen = (open: boolean): void => {
    const beforeRect = getWrapRect();
    const beforeCenterX = beforeRect.left + beforeRect.width / 2;
    const { y: currentY } = getCurrentPosition();

    drawerOpen = open;
    wrap.classList.toggle("drawer-open", open);
    drawer.classList.toggle("open", open);
    debugToggle.setAttribute("aria-expanded", String(open));
    debugLabel.textContent = open ? "Hide Debug" : "Debug";
    applyWrapWidth();
    const afterRect = getWrapRect();
    const bounds = getDragBounds(afterRect, EDGE_MARGIN, open);
    const nextX = clamp(
      beforeCenterX - afterRect.width / 2,
      bounds.minX,
      bounds.maxX,
    );
    const nextY = clamp(currentY, bounds.minY, bounds.maxY);
    setPosition(nextX, nextY);
    savePosition(nextX, nextY);

    if (open) {
      openEventStream();
      return;
    }
    closeEventStream();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!isPressingDragArea) return;
    isDragging = true;
    updateDragCursor();

    const rect = getWrapRect();
    const bounds = getDragBounds(rect, DRAG_MARGIN);
    const nextX = clamp(event.clientX - dragOffsetX, bounds.minX, bounds.maxX);
    const nextY = clamp(event.clientY - dragOffsetY, bounds.minY, bounds.maxY);
    setPosition(nextX, nextY);
  };

  const stopDragging = (): void => {
    if (!isPressingDragArea && !isDragging) return;

    isPressingDragArea = false;
    if (isDragging) {
      const x = Number.parseFloat(wrap.style.left);
      const y = Number.parseFloat(wrap.style.top);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        savePosition(x, y);
      }
    }
    isDragging = false;
    updateDragCursor();

    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDragging);
    window.removeEventListener("pointercancel", stopDragging);
  };

  const beginDrag = (event: PointerEvent): void => {
    const rect = getWrapRect();
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;
    isPressingDragArea = true;
    updateDragCursor();

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
  };

  bar.addEventListener("pointerdown", (event: PointerEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) return;
    beginDrag(event);
  });

  drawer.addEventListener("pointerdown", (event: PointerEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) return;
    if (target?.closest(".stoat-events")) return;
    beginDrag(event);
  });

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (copyResetTimer !== null) {
        window.clearTimeout(copyResetTimer);
      }
      copyResetTimer = window.setTimeout(() => {
        setCopied(false);
        copyResetTimer = null;
      }, COPY_RESET_MS);
    } catch {
      showFeedback("Copy failed");
    }
  });

  closeButton.addEventListener("click", async () => {
    wrap.classList.add("is-closing");
    wrap.style.pointerEvents = "none";

    try {
      const token = scriptTag.getAttribute("data-token") ?? "";
      const params = new URLSearchParams({ slug });
      if (token) params.set("token", token);

      const response = await fetch(`/.stoat/close?${params.toString()}`, {
        method: "POST",
      });
      if (response.ok) {
        teardown();
        return;
      }
    } catch {
      // handled below
    }

    wrap.classList.remove("is-closing");
    wrap.style.pointerEvents = "";
    showFeedback("Close failed");
  });

  debugToggle.addEventListener("click", () => {
    setDrawerOpen(!drawerOpen);
  });

  clearEventsBtn.addEventListener("click", () => {
    events.length = 0;
    renderEvents();
  });

  copyVisibleBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(events, null, 2));
      showFeedback(`Copied ${events.length} events`);
    } catch {
      showFeedback("Copy failed");
    }
  });

  eventsList.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const toggle = target?.closest<HTMLButtonElement>(".stoat-event-toggle");
    if (!toggle) return;
    const eventId = toggle.getAttribute("data-event-id");
    if (!eventId) return;

    if (expandedEventIds.has(eventId)) {
      expandedEventIds.delete(eventId);
    } else {
      expandedEventIds.add(eventId);
    }
    renderEvents();
  });

  const pollViewers = async (): Promise<void> => {
    try {
      const response = await fetch(`/.stoat/viewers?slug=${encodeURIComponent(slug)}`);
      if (!response.ok) return;

      const json: unknown = await response.json();
      const count = getViewerCount(json);
      if (count !== null) {
        viewersEl.textContent = String(count);
      }
    } catch {
      // ignore fetch failures
    }
  };

  const onResize = (): void => {
    measureBaseWrapWidth();
    applyWrapWidth();
    placeByState();
    const x = Number.parseFloat(wrap.style.left);
    const y = Number.parseFloat(wrap.style.top);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      savePosition(x, y);
    }
  };

  const teardown = (): void => {
    closeEventStream();
    stopDragging();
    window.removeEventListener("resize", onResize);
    window.removeEventListener("beforeunload", teardown);

    if (copyResetTimer !== null) {
      window.clearTimeout(copyResetTimer);
      copyResetTimer = null;
    }
    if (feedbackTimer !== null) {
      window.clearTimeout(feedbackTimer);
      feedbackTimer = null;
    }
    if (viewersTimer !== null) {
      window.clearInterval(viewersTimer);
      viewersTimer = null;
    }

    host.remove();
  };

  renderEvents();
  measureBaseWrapWidth();
  applyWrapWidth();
  placeByState();
  void pollViewers();
  viewersTimer = window.setInterval(() => {
    void pollViewers();
  }, VIEWERS_POLL_MS);

  window.addEventListener("resize", onResize);
  window.addEventListener("beforeunload", teardown);
})();
