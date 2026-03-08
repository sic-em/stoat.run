import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin.ts"],
  format: ["cjs"],
  target: "node20",
  outDir: "dist",
  banner: {
    js: "#!/usr/bin/env node",
  },
  clean: true,
});
