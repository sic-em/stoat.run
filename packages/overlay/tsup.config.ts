import { defineConfig } from "tsup";

export default defineConfig([
  // IIFE bundle for the overlay script
  {
    entry: { overlay: "src/overlay.ts" },
    format: ["iife"],
    globalName: "StoatOverlayBundle",
    target: "es2020",
    outDir: "dist",
    minify: true,
    platform: "browser",
  },
  // ESM for React component
  {
    entry: { StoatOverlay: "src/StoatOverlay.tsx" },
    format: ["esm"],
    target: "es2020",
    outDir: "dist",
    external: ["react"],
    dts: true,
  },
  // CJS for middleware
  {
    entry: { middleware: "src/middleware.ts", meta: "src/meta.ts" },
    format: ["cjs"],
    target: "node20",
    outDir: "dist",
    dts: true,
  },
]);
