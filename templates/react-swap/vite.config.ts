import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
  },
  server: {
    // Proxy /api/* to fluidnative.com in dev — avoids CORS entirely.
    // The browser calls localhost:5173/api/... (same origin),
    // Vite forwards it to fluidnative.com server-side.
    proxy: {
      "/api": {
        target:       "https://fluidnative.com",
        changeOrigin: true,
        secure:       true,
      },
    },
  },
});
