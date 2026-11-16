import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: id => (id.includes("node_modules/three") ? "three" : undefined) } },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
} as import("vite").UserConfig & { test: unknown });
