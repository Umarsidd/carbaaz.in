import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const apiTarget = env.VITE_PROXY_TARGET || "http://localhost:3000";
  return {
    plugins: [tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        "/api": apiTarget,
        "/uploads": apiTarget,
      },
    },
  };
});
