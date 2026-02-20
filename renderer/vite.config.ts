import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const currentDir = dirname(fileURLToPath(import.meta.url));
const rootPackagePath = resolve(currentDir, "..", "package.json");
const rootPackageVersion = JSON.parse(readFileSync(rootPackagePath, "utf-8")).version ?? "0.0.0";

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Electron production runs via file://, so assets must be relative.
  base: command === "build" ? "./" : "/",
  define: {
    __APP_VERSION__: JSON.stringify(rootPackageVersion),
  },
  plugins: [react()],
}));
