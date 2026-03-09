import logoDataUrl from "./assets/logo.webp";

type OverlayState = Readonly<{
  x: number | null;
  y: number | null;
}>;

type ViewerResponse = Readonly<{
  count?: number;
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
    transform 240ms cubic-bezier(0.32, 0.72, 0, 1);
}

.stoat-wrap.is-closing {
  opacity: 0;
  transform: translateY(20px) scale(0.97);
}

.stoat-bar {
  display: flex;
  align-items: center;
  gap: 4px;
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
  width: 12px;
  height: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

@media (prefers-reduced-motion: reduce) {
  .stoat-wrap,
  .stoat-btn,
  .stoat-copy-icon,
  .stoat-feedback {
    transition: none;
  }
}
`;

const EYE_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
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

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const getViewerCount = (value: unknown): number | null => {
  if (!value || typeof value !== "object") return null;
  const count = (value as ViewerResponse).count;
  return isFiniteNumber(count) ? count : null;
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
      <div class="stoat-bar" id="bar" role="region" aria-label="Tunnel overlay">
        <img class="stoat-logo" id="brandLogo" src="${logoDataUrl}" alt="stoat" width="36" height="36" draggable="false" />

        <button class="stoat-btn copy" id="copy" type="button">
          <span class="stoat-copy-icons" aria-hidden="true">
            <span class="stoat-copy-icon stoat-copy-icon-copy">${COPY_ICON}</span>
            <span class="stoat-copy-icon stoat-copy-icon-check">${CHECK_ICON}</span>
          </span>
          <span id="copyLabel">Copy URL</span>
        </button>

        <button class="stoat-btn" id="close" type="button">Close Tunnel</button>

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
  const feedback = shadowRoot.getElementById("feedback");

  if (
    !(wrap instanceof HTMLDivElement) ||
    !(bar instanceof HTMLDivElement) ||
    !(viewersEl instanceof HTMLSpanElement) ||
    !(copyButton instanceof HTMLButtonElement) ||
    !(copyLabel instanceof HTMLSpanElement) ||
    !(closeButton instanceof HTMLButtonElement) ||
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
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  const updateDragCursor = (): void => {
    bar.classList.toggle("is-grabbing", isDragging || isPressingDragArea);
  };

  const getWrapRect = (): DOMRect => wrap.getBoundingClientRect();

  const setPosition = (x: number, y: number): void => {
    wrap.style.left = `${x}px`;
    wrap.style.top = `${y}px`;
  };

  const savePosition = (x: number, y: number): void => {
    state = { x, y };
    saveState(storageKey, state);
  };

  const placeByState = (): void => {
    const rect = getWrapRect();
    const maxX = Math.max(EDGE_MARGIN, window.innerWidth - rect.width - EDGE_MARGIN);
    const maxY = Math.max(EDGE_MARGIN, window.innerHeight - rect.height - EDGE_MARGIN);

    const x =
      state.x === null
        ? clamp((window.innerWidth - rect.width) / 2, EDGE_MARGIN, maxX)
        : clamp(state.x, EDGE_MARGIN, maxX);

    const y =
      state.y === null
        ? clamp(window.innerHeight - rect.height - DEFAULT_BOTTOM_OFFSET, EDGE_MARGIN, maxY)
        : clamp(state.y, EDGE_MARGIN, maxY);

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

  const onPointerMove = (event: PointerEvent): void => {
    if (!isPressingDragArea) return;
    isDragging = true;
    updateDragCursor();

    const rect = getWrapRect();
    const maxX = Math.max(DRAG_MARGIN, window.innerWidth - rect.width - DRAG_MARGIN);
    const maxY = Math.max(DRAG_MARGIN, window.innerHeight - rect.height - DRAG_MARGIN);
    const nextX = clamp(event.clientX - dragOffsetX, DRAG_MARGIN, maxX);
    const nextY = clamp(event.clientY - dragOffsetY, DRAG_MARGIN, maxY);
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

  bar.addEventListener("pointerdown", (event: PointerEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) return;

    const rect = getWrapRect();
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;
    isPressingDragArea = true;
    updateDragCursor();

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
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
    placeByState();
    const x = Number.parseFloat(wrap.style.left);
    const y = Number.parseFloat(wrap.style.top);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      savePosition(x, y);
    }
  };

  const teardown = (): void => {
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

  placeByState();
  void pollViewers();
  viewersTimer = window.setInterval(() => {
    void pollViewers();
  }, VIEWERS_POLL_MS);

  window.addEventListener("resize", onResize);
  window.addEventListener("beforeunload", teardown);
})();
