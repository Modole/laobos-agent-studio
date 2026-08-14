import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(projectRoot, "desktop", "renderer"),
  base: "./",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4317,
    strictPort: true,
    fs: {
      allow: [projectRoot],
    },
  },
  build: {
    outDir: path.join(projectRoot, "dist-desktop"),
    emptyOutDir: true,
  },
});
