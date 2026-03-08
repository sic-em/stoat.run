// Vanilla JS IIFE overlay bundle
// This file is compiled as an IIFE and served at /.ferret/overlay.js

(function () {
  const scriptTag = document.currentScript as HTMLScriptElement | null;
  if (!scriptTag) return;

  const slug =
    new URL(scriptTag.src).searchParams.get("slug") ??
    scriptTag.getAttribute("data-slug");

  if (!slug) return;

  // Create shadow DOM container for style isolation
  const host = document.createElement("div");
  host.id = "__ferret_overlay__";
  const shadow = host.attachShadow({ mode: "closed" });

  shadow.innerHTML = `
    <style>
      .ferret-bar {
        position: fixed; bottom: 0; left: 0; right: 0;
        height: 40px; background: #18181b; color: #fafafa;
        display: flex; align-items: center; padding: 0 16px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px; z-index: 2147483647;
        border-top: 1px solid #27272a; gap: 16px;
        box-sizing: border-box;
      }
      .ferret-bar button {
        background: #27272a; color: #fafafa; border: 1px solid #3f3f46;
        border-radius: 4px; padding: 4px 10px; cursor: pointer;
        font-size: 12px; font-family: inherit;
      }
      .ferret-bar button:hover { background: #3f3f46; }
      .ferret-slug { color: #a1a1aa; }
      .ferret-viewers { color: #a1a1aa; }
      .ferret-spacer { flex: 1; }
    </style>
    <div class="ferret-bar">
      <span>🐾 Ferret</span>
      <span class="ferret-slug">/${slug}</span>
      <span class="ferret-viewers" id="fv">Viewers: 0</span>
      <span class="ferret-spacer"></span>
      <button id="fcopy">Copy URL</button>
      <button id="fclose">Close Tunnel</button>
    </div>
  `;

  document.body.appendChild(host);

  // Poll viewer count
  const pollViewers = async (): Promise<void> => {
    try {
      const r = await fetch(`/.ferret/viewers?slug=${slug}`);
      if (r.ok) {
        const data = (await r.json()) as { count: number };
        const el = shadow.getElementById("fv");
        if (el) el.textContent = `Viewers: ${data.count}`;
      }
    } catch {
      // ignore polling errors
    }
  };

  setInterval(() => { void pollViewers(); }, 5000);

  const copyBtn = shadow.getElementById("fcopy");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      void navigator.clipboard.writeText(window.location.href);
    });
  }

  const closeBtn = shadow.getElementById("fclose");
  if (closeBtn) {
    closeBtn.addEventListener("click", async () => {
      // Token must be provided externally if tunnel close is needed
      const token = scriptTag.getAttribute("data-token") ?? "";
      try {
        await fetch(`/.ferret/close?slug=${slug}&token=${token}`, {
          method: "POST",
        });
      } catch {
        // ignore
      }
    });
  }
})();
