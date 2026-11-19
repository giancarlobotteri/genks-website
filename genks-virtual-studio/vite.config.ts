import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The studio calendar lives on the existing GENKS backend. Same-origin proxy (no redirect): the request
// reaches /api/availability there unchanged. Production does the same with a rewrite in vercel.json.
const BACKEND = process.env.GENKS_BACKEND_ORIGIN ?? "https://app.prodbygenks.com";
// Behind an outbound proxy (HTTPS_PROXY) the request is tunnelled through it, if the optional
// `https-proxy-agent` package is installed (npm i -D https-proxy-agent); otherwise it connects directly.
async function outboundAgent() {
  const outbound = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!outbound) return {};
  try {
    const { HttpsProxyAgent } = await import("https-proxy-agent" as string);
    return { agent: new HttpsProxyAgent(outbound) };
  } catch {
    return {};
  }
}
const proxy = { "/api/availability": { target: BACKEND, changeOrigin: true, secure: true, ...(await outboundAgent()) } };

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173, proxy },
  preview: { proxy },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1000,
    rollupOptions: { output: { manualChunks: id => (id.includes("node_modules/three") ? "three" : undefined) } },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
} as import("vite").UserConfig & { test: unknown });
