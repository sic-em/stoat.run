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
    edge: "bottom",
    ratio: 0.5,
    collapsed: false,
  } as const;

  type Edge = "top" | "bottom" | "left" | "right";
  type OverlayState = {
    edge: Edge;
    ratio: number;
    collapsed: boolean;
  };

  const loadState = (): OverlayState => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return { ...defaultState };
      const parsed = JSON.parse(raw) as Partial<OverlayState>;
      if (
        parsed.edge !== "top" &&
        parsed.edge !== "bottom" &&
        parsed.edge !== "left" &&
        parsed.edge !== "right"
      ) {
        return { ...defaultState };
      }
      return {
        edge: parsed.edge,
        ratio:
          typeof parsed.ratio === "number" && parsed.ratio >= 0 && parsed.ratio <= 1
            ? parsed.ratio
            : defaultState.ratio,
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
        <span class="stoat-slug" id="slugchip">/${slug}</span>
        <span class="stoat-viewers" id="viewers">Viewers: 0</span>
        <span class="stoat-spacer" id="spacer"></span>
        <button class="stoat-btn copy" id="copy" aria-label="Copy URL">
          <span class="stoat-copy-icons" aria-hidden="true">
            <span class="stoat-copy-icon stoat-copy-icon-copy">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666" /><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" /></svg>
            </span>
            <span class="stoat-copy-icon stoat-copy-icon-check">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20.707 6.293a1 1 0 0 1 0 1.414l-10 10a1 1 0 0 1 -1.414 0l-5 -5a1 1 0 0 1 1.414 -1.414l4.293 4.293l9.293 -9.293a1 1 0 0 1 1.414 0" /></svg>
            </span>
          </span>
          <span>Copy URL</span>
        </button>
        <button class="stoat-btn close" id="close">Close</button>
        <button class="stoat-btn icon" id="toggle" aria-label="Collapse overlay">
          <span class="stoat-caret stoat-caret-down" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </span>
          <span class="stoat-caret stoat-caret-right" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </span>
        </button>
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
  const slugChip = shadow.getElementById("slugchip") as HTMLSpanElement | null;
  const spacer = shadow.getElementById("spacer") as HTMLSpanElement | null;
  const copyBtn = shadow.getElementById("copy") as HTMLButtonElement | null;
  const closeBtn = shadow.getElementById("close") as HTMLButtonElement | null;
  const toggleBtn = shadow.getElementById("toggle") as HTMLButtonElement | null;
  const feedback = shadow.getElementById("feedback") as HTMLDivElement | null;
  if (
    !wrap ||
    !styleEl ||
    !bar ||
    !viewers ||
    !copyBtn ||
    !closeBtn ||
    !toggleBtn ||
    !feedback ||
    !brandLogo ||
    !slugChip ||
    !spacer
  ) {
    return;
  }

  const INLINE_STYLES = `
:host { all: initial; }
.stoat-wrap {
  position: fixed;
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
  --stoat-destructive: #b91c1c;
}
.stoat-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  color: #0f172a;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 14px;
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
  height: 52px;
  width: auto;
  object-fit: contain;
  display: block;
  pointer-events: none;
}
.stoat-slug {
  font-size: 11px;
  color: #475569;
  background: rgba(15, 23, 42, 0.06);
  border-radius: 999px;
  padding: 3px 8px;
  max-width: 180px;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
.stoat-viewers {
  font-size: 11px;
  color: #334155;
  background: rgba(15, 23, 42, 0.06);
  border-radius: 999px;
  padding: 3px 8px;
  white-space: nowrap;
}
.stoat-spacer { flex: 1; min-width: 8px; }
.stoat-btn {
  border: 0;
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.98) 0%,
      rgba(248, 250, 252, 0.96) 100%
    );
  color: var(--stoat-fg);
  border-radius: var(--stoat-radius);
  background-clip: padding-box;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  height: 30px;
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
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.7) inset,
    0 1px 2px rgba(15, 23, 42, 0.06);
}
.stoat-btn:hover {
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 1) 0%,
      rgba(241, 245, 249, 0.98) 100%
    );
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
.stoat-btn.close { color: #b91c1c; }
.stoat-btn.close:hover {
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 1) 0%,
      color-mix(in oklab, var(--stoat-destructive) 8%, white) 100%
    );
}
.stoat-btn.icon {
  width: 30px;
  min-width: 30px;
  height: 30px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-color: transparent;
  border-radius: calc(var(--stoat-radius) - 1px);
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.98) 0%,
      rgba(248, 250, 252, 0.96) 100%
    );
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.7) inset,
    0 1px 2px rgba(15, 23, 42, 0.06);
}
.stoat-btn.icon:hover {
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 1) 0%,
      rgba(241, 245, 249, 0.98) 100%
    );
}
.stoat-btn.icon:focus-visible {
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--stoat-ring) 50%, transparent);
}
.stoat-caret {
  width: 16px;
  height: 16px;
  color: #475569;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.stoat-caret-right { display: none; }
.stoat-bar.collapsed .stoat-caret-down { display: none; }
.stoat-bar.collapsed .stoat-caret-right { display: inline-flex; }
.stoat-bar.collapsed {
  padding: 3px;
  gap: 3px;
  border-radius: 10px;
}
.stoat-bar.collapsed .stoat-brand-logo {
  height: 34px;
}
.stoat-bar.collapsed .stoat-btn.icon {
  width: 24px;
  min-width: 24px;
  height: 24px;
  border-radius: 8px;
}
.stoat-wrap.closing .stoat-bar {
  width: 28px;
  padding: 4px;
  gap: 0;
  border-radius: 999px;
  overflow: hidden;
  transform: scale(0.94);
  transition:
    transform 280ms cubic-bezier(0.32, 0.72, 0, 1),
    opacity 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    width 280ms cubic-bezier(0.32, 0.72, 0, 1),
    padding 280ms cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 280ms cubic-bezier(0.32, 0.72, 0, 1);
}
.stoat-wrap.closing .stoat-bar > * {
  opacity: 0;
  width: 0;
  margin: 0;
  padding-left: 0;
  padding-right: 0;
  border-width: 0;
  pointer-events: none;
  transition:
    opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    width 260ms cubic-bezier(0.32, 0.72, 0, 1);
}
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
  // Always start each overlay session at bottom-center.
  state.edge = "bottom";
  state.ratio = 0.5;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let copyResetTimer: number | undefined;
  const EDGE_MARGIN = 18;
  const DRAG_MARGIN = 10;
  const CLOSE_MORPH_MS = 280;

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
    bar.classList.toggle("collapsed", collapsed);
    copyBtn.style.display = collapsed ? "none" : "";
    closeBtn.style.display = collapsed ? "none" : "";
    viewers.style.display = collapsed ? "none" : "";
    brandLogo.style.display = collapsed ? "none" : "";
    brandLogo.style.cursor = "default";
    slugChip.style.display = collapsed ? "none" : "";
    spacer.style.display = collapsed ? "none" : "";
    toggleBtn.style.display = "";
    saveState(state);
  };

  const getRect = (): { width: number; height: number } => {
    const r = bar.getBoundingClientRect();
    return { width: r.width, height: r.height };
  };

  const placeByState = (): void => {
    const margin = EDGE_MARGIN;
    const { width, height } = getRect();
    const maxX = window.innerWidth - width - margin;
    const maxY = window.innerHeight - height - margin;

    let x = margin;
    let y = margin;
    if (state.edge === "top" || state.edge === "bottom") {
      x = clamp(margin + (maxX - margin) * state.ratio, margin, maxX);
      y = state.edge === "top" ? margin : maxY;
    } else {
      y = clamp(margin + (maxY - margin) * state.ratio, margin, maxY);
      x = state.edge === "left" ? margin : maxX;
    }
    wrap.style.left = `${x}px`;
    wrap.style.top = `${y}px`;
  };

  const snap = (x: number, y: number): void => {
    const margin = EDGE_MARGIN;
    const { width, height } = getRect();
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const distTop = centerY;
    const distBottom = window.innerHeight - centerY;
    const distLeft = centerX;
    const distRight = window.innerWidth - centerX;
    const min = Math.min(distTop, distBottom, distLeft, distRight);

    let edge: Edge = "bottom";
    if (min === distTop) edge = "top";
    else if (min === distLeft) edge = "left";
    else if (min === distRight) edge = "right";

    state.edge = edge;
    if (edge === "top" || edge === "bottom") {
      const maxX = window.innerWidth - width - margin;
      const clampedX = clamp(x, margin, maxX);
      state.ratio = maxX <= margin ? 0.5 : (clampedX - margin) / (maxX - margin);
    } else {
      const maxY = window.innerHeight - height - margin;
      const clampedY = clamp(y, margin, maxY);
      state.ratio = maxY <= margin ? 0.5 : (clampedY - margin) / (maxY - margin);
    }
    saveState(state);
    placeByState();
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
    snap(x, y);
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

  toggleBtn.addEventListener("click", () => {
    setCollapsedUI(!state.collapsed);
    placeByState();
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
    const token = scriptTag.getAttribute("data-token") ?? "";
    wrap.classList.add("closing");
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, CLOSE_MORPH_MS);
    });
    try {
      const params = new URLSearchParams({ slug });
      if (token) params.set("token", token);
      const res = await fetch(`/.stoat/close?${params.toString()}`, {
        method: "POST",
      });
      if (res.ok) {
        showFeedback("Tunnel closed");
        window.setTimeout(() => {
          host.remove();
        }, 120);
      } else {
        wrap.classList.remove("closing");
        showFeedback("Close failed");
      }
    } catch {
      wrap.classList.remove("closing");
      showFeedback("Close failed");
    }
  });

  const pollViewers = async (): Promise<void> => {
    try {
      const r = await fetch(`/.stoat/viewers?slug=${encodeURIComponent(slug)}`);
      if (!r.ok) return;
      const data = (await r.json()) as { count?: number };
      if (typeof data.count === "number") {
        viewers.textContent = `Viewers: ${data.count}`;
      }
    } catch {
      // ignore
    }
  };

  setCollapsedUI(state.collapsed);
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
