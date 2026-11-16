import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "VITE_");
  const apiTarget = env.VITE_API_URL?.trim().replace(/\/+$/, "") || "http://127.0.0.1:3001";

  return {
    root: __dirname,
    server: {
      host: "::",
      port: Number(env.VITE_PORT) || 8080,
      watch: {
        // Vitest files are never served to the browser; watching them only reloads the admin session.
        ignored: ["**/src/test/**"],
      },
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
        "/media": { target: apiTarget, changeOrigin: true },
      },
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
