import logoDataUrl from "./assets/logo.webp";

(function () {
  const scriptTag = document.currentScript as HTMLScriptElement | null;
  if (!scriptTag) return;

  const slug =
    new URL(scriptTag.src).searchParams.get("slug") ??
    scriptTag.getAttribute("data-slug");
  if (!slug) return;

  const storageKey = `stoat:overlay:${slug}`;
  const defaultState = {
    x: null as number | null,
    y: null as number | null,
    collapsed: false,
  } as const;

  type OverlayState = {
    x: number | null;
    y: number | null;
    collapsed: boolean;
  };

  const loadState = (): OverlayState => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return { ...defaultState };
      const parsed = JSON.parse(raw) as Partial<OverlayState>;
      return {
        x: typeof parsed.x === "number" ? parsed.x : null,
        y: typeof parsed.y === "number" ? parsed.y : null,
        collapsed: Boolean(parsed.collapsed),
      };
    } catch {
      return { ...defaultState };
    }
  };

  const saveState = (state: OverlayState): void => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // ignore localStorage errors
    }
  };

  const host = document.createElement("div");
  host.id = "__stoat_overlay__";
  const shadow = host.attachShadow({ mode: "closed" });

  shadow.innerHTML = `
    <style id="stoat-style"></style>
    <div class="stoat-wrap" id="wrap">
      <div class="stoat-bar" id="bar">
        <img class="stoat-brand-logo" id="brandLogo" src="${logoDataUrl}" alt="Stoat.run" />
        <button class="stoat-btn copy" id="copy" aria-label="Copy URL">
          <span class="stoat-copy-icons" aria-hidden="true">
            <span class="stoat-copy-icon stoat-copy-icon-copy">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666" /><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" /></svg>
            </span>
            <span class="stoat-copy-icon stoat-copy-icon-check">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20.707 6.293a1 1 0 0 1 0 1.414l-10 10a1 1 0 0 1 -1.414 0l-5 -5a1 1 0 0 1 1.414 -1.414l4.293 4.293l9.293 -9.293a1 1 0 0 1 1.414 0" /></svg>
            </span>
          </span>
          <span>Copy</span>
        </button>
        <button class="stoat-btn close" id="close">Close Tunnel</button>
        <span class="stoat-right">
          <span class="stoat-divider" aria-hidden="true"></span>
          <span class="stoat-status"><span class="stoat-status-dot"></span>Connected</span>
          <span class="stoat-viewers">
            <span class="stoat-viewers-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>
            </span>
            <span id="viewers">0</span>
          </span>
        </span>
      </div>
    </div>
    <div class="stoat-feedback" id="feedback"></div>
  `;

  document.body.appendChild(host);

  const wrap = shadow.getElementById("wrap") as HTMLDivElement | null;
  const styleEl = shadow.getElementById("stoat-style") as HTMLStyleElement | null;
  const bar = shadow.getElementById("bar") as HTMLDivElement | null;
  const viewers = shadow.getElementById("viewers") as HTMLSpanElement | null;
  const brandLogo = shadow.getElementById("brandLogo") as HTMLImageElement | null;
  const copyBtn = shadow.getElementById("copy") as HTMLButtonElement | null;
  const closeBtn = shadow.getElementById("close") as HTMLButtonElement | null;
  const feedback = shadow.getElementById("feedback") as HTMLDivElement | null;
  if (
    !wrap ||
    !styleEl ||
    !bar ||
    !viewers ||
    !copyBtn ||
    !closeBtn ||
    !feedback ||
    !brandLogo
  ) {
    return;
  }

  const INLINE_STYLES = `
:host { all: initial; }
.stoat-wrap {
  position: fixed;
  width: max-content;
  z-index: 2147483647;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  user-select: none;
  transition: opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: transform, opacity;
}
:host {
  --stoat-radius: 10px;
  --stoat-ring: rgba(15, 23, 42, 0.18);
  --stoat-border: rgba(15, 23, 42, 0.12);
  --stoat-bg: #ffffff;
  --stoat-fg: #0f172a;
  --stoat-muted: #f1f5f9;
  --stoat-destructive: #f43f5e;
}
.stoat-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 8px;
  color: #0f172a;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: var(--stoat-radius);
  backdrop-filter: blur(6px);
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.18);
  transform-origin: center;
  transition:
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    width 220ms cubic-bezier(0.32, 0.72, 0, 1),
    padding 220ms cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 220ms cubic-bezier(0.32, 0.72, 0, 1);
  cursor: grab;
}
.stoat-bar:hover { box-shadow: 0 9px 28px rgba(15, 23, 42, 0.2); }
.stoat-bar:active { cursor: grabbing; }
.stoat-brand-logo {
  height: 48px;
  width: auto;
  object-fit: contain;
  display: block;
  pointer-events: none;
}
.stoat-btn {
  border: 0;
  background: transparent;
  color: #6b7280;
  border-radius: var(--stoat-radius);
  background-clip: padding-box;
  font-size: 12px;
  font-weight: 400;
  line-height: 1;
  height: 32px;
  padding: 0 10px;
  cursor: pointer;
  outline: none;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    background-color 160ms cubic-bezier(0.2, 0.8, 0.2, 1),
    border-color 160ms cubic-bezier(0.2, 0.8, 0.2, 1),
    color 160ms cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 160ms cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: none;
}
.stoat-btn:hover {
  background: rgba(15, 23, 42, 0.06);
}
.stoat-btn:active { transform: scale(0.97); }
.stoat-btn:focus-visible {
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--stoat-ring) 50%, transparent);
}
.stoat-btn.copy {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.stoat-btn.close { margin-right: 6px; }
.stoat-copy-icons {
  position: relative;
  width: 14px;
  height: 14px;
}
.stoat-copy-icon {
  position: absolute;
  inset: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    transform 220ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.stoat-copy-icon-copy {
  opacity: 1;
  transform: scale(1) rotate(0deg);
}
.stoat-copy-icon-check {
  opacity: 0;
  transform: scale(0.7) rotate(-10deg);
}
.stoat-btn.copy.copied .stoat-copy-icon-copy {
  opacity: 0;
  transform: scale(0.7) rotate(8deg);
}
.stoat-btn.copy.copied .stoat-copy-icon-check {
  opacity: 1;
  transform: scale(1) rotate(0deg);
}
.stoat-right { display: inline-flex; align-items: center; gap: 10px; padding-right: 2px; }
.stoat-divider { width: 1px; height: 18px; background: rgba(15, 23, 42, 0.18); }
.stoat-status { display: inline-flex; align-items: center; gap: 6px; color: #10b981 !important; font-size: 13px; font-weight: 400; }
.stoat-status-dot { width: 6px; height: 6px; border-radius: 999px; background: #10b981; }
.stoat-viewers { display: inline-flex; align-items: center; gap: 6px; color: #6b7280; font-size: 13px; font-weight: 400; }
.stoat-viewers-icon { display: inline-flex; align-items: center; justify-content: center; line-height: 1; }
.stoat-feedback {
  position: fixed;
  z-index: 2147483647;
  padding: 6px 10px;
  background: #0f172a;
  color: #f8fafc;
  border-radius: 8px;
  font-size: 11px;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 120ms ease, transform 120ms ease;
  pointer-events: none;
}
.stoat-feedback.show { opacity: 1; transform: translateY(0); }
@media (prefers-reduced-motion: reduce) {
  .stoat-wrap,
  .stoat-bar,
  .stoat-btn,
  .stoat-feedback {
    transition: none;
  }
}
`;
  styleEl.textContent = INLINE_STYLES;

  let state = loadState();
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let copyResetTimer: number | undefined;
  const EDGE_MARGIN = 18;
  const DRAG_MARGIN = 10;

  const clamp = (v: number, min: number, max: number): number =>
    Math.max(min, Math.min(v, max));

  const showFeedback = (msg: string): void => {
    feedback.textContent = msg;
    feedback.classList.add("show");
    const left = window.innerWidth / 2 - 60;
    const top = window.innerHeight - 60;
    feedback.style.left = `${Math.max(12, left)}px`;
    feedback.style.top = `${top}px`;
    window.setTimeout(() => feedback.classList.remove("show"), 900);
  };

  const setCollapsedUI = (collapsed: boolean): void => {
    state.collapsed = collapsed;
    saveState(state);
  };

  const getRect = (): { width: number; height: number } => {
    const r = bar.getBoundingClientRect();
    return { width: r.width, height: r.height };
  };

  const savePosition = (x: number, y: number): void => {
    state.x = x;
    state.y = y;
    saveState(state);
  };

  const placeByState = (): void => {
    const margin = EDGE_MARGIN;
    const { width, height } = getRect();
    const maxX = window.innerWidth - width - margin;
    const maxY = window.innerHeight - height - margin;
    const x = typeof state.x === "number" ? clamp(state.x, margin, maxX) : (window.innerWidth - width) / 2;
    const y = typeof state.y === "number" ? clamp(state.y, margin, maxY) : maxY;
    wrap.style.left = `${x}px`;
    wrap.style.top = `${y}px`;
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!isDragging) return;
    const { width, height } = getRect();
    const margin = DRAG_MARGIN;
    const x = clamp(event.clientX - dragOffset.x, margin, window.innerWidth - width - margin);
    const y = clamp(event.clientY - dragOffset.y, margin, window.innerHeight - height - margin);
    wrap.style.left = `${x}px`;
    wrap.style.top = `${y}px`;
  };

  const onPointerUp = (): void => {
    if (!isDragging) return;
    isDragging = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    const x = parseFloat(wrap.style.left || "0");
    const y = parseFloat(wrap.style.top || "0");
    savePosition(x, y);
  };

  bar.addEventListener("pointerdown", (event: PointerEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) return;
    const rect = wrap.getBoundingClientRect();
    dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    isDragging = true;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      copyBtn.classList.add("copied");
      if (copyResetTimer !== undefined) {
        window.clearTimeout(copyResetTimer);
      }
      copyResetTimer = window.setTimeout(() => {
        copyBtn.classList.remove("copied");
      }, 1200);
    } catch {
      showFeedback("Copy failed");
    }
  });

  closeBtn.addEventListener("click", async () => {
    wrap.style.opacity = "0";
    wrap.style.pointerEvents = "none";
    try {
      const token = scriptTag.getAttribute("data-token") ?? "";
      const params = new URLSearchParams({ slug });
      if (token) params.set("token", token);
      const res = await fetch(`/.stoat/close?${params.toString()}`, {
        method: "POST",
      });
      if (res.ok) {
        host.remove();
      } else {
        wrap.style.opacity = "1";
        wrap.style.pointerEvents = "";
        showFeedback("Close failed");
      }
    } catch {
      wrap.style.opacity = "1";
      wrap.style.pointerEvents = "";
      showFeedback("Close failed");
    }
  });

  const pollViewers = async (): Promise<void> => {
    try {
      const r = await fetch(`/.stoat/viewers?slug=${encodeURIComponent(slug)}`);
      if (!r.ok) return;
      const data = (await r.json()) as { count?: number };
      if (typeof data.count === "number") {
        viewers.textContent = `${data.count}`;
      }
    } catch {
      // ignore
    }
  };

  setCollapsedUI(false);
  placeByState();
  void pollViewers();
  const interval = window.setInterval(() => {
    void pollViewers();
  }, 5000);

  window.addEventListener("resize", placeByState);
  window.addEventListener("beforeunload", () => {
    window.clearInterval(interval);
    if (copyResetTimer !== undefined) {
      window.clearTimeout(copyResetTimer);
    }
  });
})();
